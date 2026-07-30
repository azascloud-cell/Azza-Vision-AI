/**
 * key_manager.js — Multi API Key Rotation Manager untuk Twelve Data
 *
 * Fitur:
 *  - Round-robin rotasi hingga 54+ key
 *  - Proactive rate limit: hitung request per menit per key, rotasi sebelum kena 429
 *  - Auto skip key yang rate-limited / cooling down
 *  - Auto skip key invalid (401/403) selamanya
 *  - Auto recovery setelah cooldown habis
 *  - Persistensi status ke data/api_key_status.json
 *  - Retry up to 3 key berbeda sebelum throw error
 */

const fs   = require('fs').promises;
const path = require('path');

const KEY_FILE    = path.resolve('./data/api_keys.json');
const STATUS_FILE = path.resolve('./data/api_key_status.json');

const COOLDOWN_MS      = 60 * 1000;      // 60 detik cooldown per key setelah rate limit reaktif
const LONG_COOLDOWN    = 5 * 60 * 1000;  // 5 menit jika sudah 3x kena limit
const MAX_RETRIES      = 3;
const MAX_REQ_PER_MIN  = 7;              // Twelve Data free plan: 8/min, kita pakai 7 (safety margin)
const REQ_WINDOW_MS    = 60 * 1000;      // Window 1 menit untuk hitung request

// ─── STATUS TYPES ─────────────────────────────────────────────────────────────
const STATUS = {
  ACTIVE:      'active',
  COOLING:     'cooling',
  INVALID:     'invalid',
};

// ─── IN-MEMORY STATE ──────────────────────────────────────────────────────────
let keys        = [];   // ['key1', 'key2', ...]
let keyStatus   = {};   // { 'key1': { status, cooldownUntil, errorCount, hitCount, lastUsed } }
let keyReqLog   = {};   // { 'key1': [timestamp1, timestamp2, ...] } — request timestamps per key
let currentIdx  = 0;
let initialized = false;

// Write queue for status persistence
let statusQueue = Promise.resolve();
function enqueueStatusWrite(fn) {
  statusQueue = statusQueue.then(fn).catch((e) => console.warn('[KEY-MGR] Status write err:', e.message));
}

// ─── LOAD KEYS ────────────────────────────────────────────────────────────────
async function loadKeys() {
  const loaded = new Set();

  // 1. Dari data/api_keys.json
  try {
    const raw = await fs.readFile(KEY_FILE, 'utf8');
    const json = JSON.parse(raw);
    if (Array.isArray(json.keys)) {
      json.keys.filter(k => k && k.trim()).forEach(k => loaded.add(k.trim()));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[KEY-MGR] Gagal baca api_keys.json:', e.message);
  }

  // 2. Dari env TWELVE_DATA_KEYS (koma-separated)
  const envKeys = process.env.TWELVE_DATA_KEYS;
  if (envKeys) {
    envKeys.split(',').map(k => k.trim()).filter(Boolean).forEach(k => loaded.add(k));
  }

  // 3. Fallback ke TWELVEDATA_API_KEY tunggal
  const single = process.env.TWELVEDATA_API_KEY;
  if (single && single.trim()) loaded.add(single.trim());

  return [...loaded];
}

// ─── LOAD / SAVE STATUS ───────────────────────────────────────────────────────
async function loadStatus() {
  try {
    const raw = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStatus() {
  enqueueStatusWrite(async () => {
    try {
      await fs.writeFile(STATUS_FILE, JSON.stringify(keyStatus, null, 2), 'utf8');
    } catch (e) {
      console.warn('[KEY-MGR] Gagal simpan status:', e.message);
    }
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  if (initialized) return;
  initialized = true;

  keys = await loadKeys();
  if (keys.length === 0) {
    console.error('[KEY-MGR] ❌ Tidak ada API key tersedia! Cek data/api_keys.json atau .env');
    return;
  }

  const savedStatus = await loadStatus();

  // Inisialisasi status semua key
  for (const k of keys) {
    if (savedStatus[k]) {
      keyStatus[k] = savedStatus[k];
    } else {
      keyStatus[k] = {
        status:        STATUS.ACTIVE,
        cooldownUntil: 0,
        errorCount:    0,
        hitCount:      0,
        lastUsed:      null,
      };
    }
    // Init request log (in-memory saja, tidak perlu persist)
    keyReqLog[k] = [];
  }

  // Recover key yang cooling tapi sudah melewati cooldown
  let recovered = 0;
  for (const k of keys) {
    if (keyStatus[k].status === STATUS.COOLING && Date.now() > keyStatus[k].cooldownUntil) {
      keyStatus[k].status        = STATUS.ACTIVE;
      keyStatus[k].cooldownUntil = 0;
      recovered++;
    }
  }

  const activeCount = countActive();
  console.log(`[KEY-MGR] ✅ ${keys.length} API key dimuat | Active: ${activeCount} | Recovered: ${recovered} | Max req/min per key: ${MAX_REQ_PER_MIN}`);
  if (recovered > 0) saveStatus();
}

// ─── PROACTIVE RATE LIMIT CHECK ───────────────────────────────────────────────
// Cek apakah key sudah terlalu banyak request dalam 1 menit terakhir
function isRateLimitedProactively(k) {
  if (!keyReqLog[k]) { keyReqLog[k] = []; return false; }
  const now    = Date.now();
  const window = now - REQ_WINDOW_MS;
  // Hapus timestamp yang lebih tua dari 1 menit
  keyReqLog[k] = keyReqLog[k].filter(ts => ts > window);
  return keyReqLog[k].length >= MAX_REQ_PER_MIN;
}

function recordRequest(k) {
  if (!keyReqLog[k]) keyReqLog[k] = [];
  keyReqLog[k].push(Date.now());
}

function reqCountInWindow(k) {
  if (!keyReqLog[k]) return 0;
  const now    = Date.now();
  const window = now - REQ_WINDOW_MS;
  return keyReqLog[k].filter(ts => ts > window).length;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function countActive() {
  return keys.filter(k => isAvailable(k)).length;
}

function isAvailable(k) {
  const s = keyStatus[k];
  if (!s) return false;
  if (s.status === STATUS.INVALID) return false;
  if (s.status === STATUS.COOLING) {
    if (Date.now() > s.cooldownUntil) {
      s.status        = STATUS.ACTIVE;
      s.cooldownUntil = 0;
      return true;
    }
    return false;
  }
  // Proactive check: terlalu banyak request dalam 1 menit?
  if (isRateLimitedProactively(k)) return false;
  return true;
}

// ─── GET CURRENT KEY ──────────────────────────────────────────────────────────
function getKey() {
  if (keys.length === 0) {
    const single = process.env.TWELVEDATA_API_KEY;
    if (single) return single;
    throw new Error('Tidak ada API key tersedia. Cek data/api_keys.json atau .env');
  }

  // Round-robin: cari key berikutnya yang available
  for (let i = 0; i < keys.length; i++) {
    const idx = (currentIdx + i) % keys.length;
    if (isAvailable(keys[idx])) {
      currentIdx = idx;
      const k = keys[idx];
      keyStatus[k].lastUsed = new Date().toISOString();
      keyStatus[k].hitCount++;
      recordRequest(k);
      return k;
    }
  }

  // Semua key sedang cooling atau throttled — pakai yang paling cepat recover
  const coolingKeys = keys.filter(k => keyStatus[k]?.status === STATUS.COOLING);
  if (coolingKeys.length > 0) {
    coolingKeys.sort((a, b) => keyStatus[a].cooldownUntil - keyStatus[b].cooldownUntil);
    const best = coolingKeys[0];
    const secsLeft = Math.ceil((keyStatus[best].cooldownUntil - Date.now()) / 1000);
    console.warn(`[KEY-MGR] ⚠️ Semua key throttled — dipaksa pakai key #${keys.indexOf(best) + 1} (cooldown: ${secsLeft}s lagi)`);
    recordRequest(best);
    return best;
  }

  // Semua kena proactive throttle — pakai yang request-nya paling sedikit
  const byReqCount = [...keys].filter(k => keyStatus[k]?.status !== STATUS.INVALID)
    .sort((a, b) => reqCountInWindow(a) - reqCountInWindow(b));
  if (byReqCount.length > 0) {
    const best = byReqCount[0];
    console.warn(`[KEY-MGR] ⚠️ Semua key mendekati rate limit — rotasi ke key #${keys.indexOf(best) + 1} (${reqCountInWindow(best)} req/min)`);
    recordRequest(best);
    return best;
  }

  throw new Error('Semua API key tidak tersedia (invalid atau cooling). Tambah key baru di data/api_keys.json');
}

// ─── MARK RATE LIMITED ────────────────────────────────────────────────────────
function markRateLimited(apiKey) {
  const s = keyStatus[apiKey];
  if (!s || s.status === STATUS.INVALID) return;

  s.errorCount++;
  const cooldown = s.errorCount >= 3 ? LONG_COOLDOWN : COOLDOWN_MS;
  s.status        = STATUS.COOLING;
  s.cooldownUntil = Date.now() + cooldown;

  // Reset proactive counter untuk key ini
  if (keyReqLog[apiKey]) keyReqLog[apiKey] = [];

  const idx     = keys.indexOf(apiKey);
  const nextIdx = findNextAvailableIdx(idx);
  const nextKey = nextIdx >= 0 ? `Key ${nextIdx + 1}` : 'tidak ada';

  const nowStr = new Date().toUTCString();
  console.warn(
    `[API ROTATION]\n  Previous : Key ${idx + 1} (...${apiKey.slice(-6)})\n  Reason   : Rate Limit (reaktif)\n  Cooldown : ${cooldown / 1000}s\n  Current  : ${nextKey}\n  Time     : ${nowStr}`
  );

  if (nextIdx >= 0) currentIdx = nextIdx;
  saveStatus();
}

// ─── MARK INVALID ─────────────────────────────────────────────────────────────
function markInvalid(apiKey) {
  const s = keyStatus[apiKey];
  if (!s) return;

  const prev = s.status;
  if (prev === STATUS.INVALID) return;

  s.status = STATUS.INVALID;
  const idx     = keys.indexOf(apiKey);
  const nextIdx = findNextAvailableIdx(idx);
  const nextKey = nextIdx >= 0 ? `Key ${nextIdx + 1}` : 'tidak ada';

  console.error(
    `[API ROTATION]\n  Previous : Key ${idx + 1} (...${apiKey.slice(-6)})\n  Reason   : Invalid (401/403)\n  Current  : ${nextKey}\n  Time     : ${new Date().toUTCString()}`
  );

  if (nextIdx >= 0) currentIdx = nextIdx;
  saveStatus();
}

function findNextAvailableIdx(fromIdx) {
  for (let i = 1; i <= keys.length; i++) {
    const idx = (fromIdx + i) % keys.length;
    if (isAvailable(keys[idx])) return idx;
  }
  return -1;
}

// ─── IS RATE LIMIT ERROR ──────────────────────────────────────────────────────
function isRateLimitError(err) {
  const status = err.response?.status;
  const msg    = (err.response?.data?.message || err.message || '').toLowerCase();
  if (status === 429) return true;
  if (msg.includes('rate limit'))       return true;
  if (msg.includes('quota exceeded'))   return true;
  if (msg.includes('credits exhaust'))  return true;
  if (msg.includes('too many request')) return true;
  if (msg.includes('api calls limit'))  return true;
  return false;
}

function isInvalidError(err) {
  const status = err.response?.status;
  return status === 401 || status === 403;
}

// ─── EXECUTE WITH RETRY ───────────────────────────────────────────────────────
// fn(apiKey) — fungsi yang menerima API key dan mengembalikan Promise
async function executeWithRetry(fn) {
  await init();

  let lastError  = null;
  const tried    = new Set();
  const maxTries = Math.min(MAX_RETRIES, Math.max(1, keys.length));

  for (let attempt = 0; attempt < maxTries; attempt++) {
    let apiKey;
    try {
      apiKey = getKey();
    } catch (keyErr) {
      throw new Error(`[KEY-MGR] Tidak ada key tersedia: ${keyErr.message}`);
    }

    if (tried.has(apiKey)) {
      currentIdx = (currentIdx + 1) % keys.length;
      continue;
    }
    tried.add(apiKey);

    try {
      const result = await fn(apiKey);
      return result;
    } catch (err) {
      lastError = err;

      if (isInvalidError(err)) {
        markInvalid(apiKey);
        currentIdx = (currentIdx + 1) % keys.length;
        continue;
      }

      if (isRateLimitError(err)) {
        markRateLimited(apiKey);
        continue;
      }

      // Error lain (network, timeout, dll) — lempar langsung
      throw err;
    }
  }

  throw lastError || new Error('Semua retry gagal');
}

// ─── STATUS SUMMARY ───────────────────────────────────────────────────────────
function getStatusSummary() {
  const now = Date.now();
  const list = keys.map((k, i) => {
    const s = keyStatus[k] || { status: STATUS.ACTIVE };
    let displayStatus = s.status;
    if (s.status === STATUS.COOLING && now > s.cooldownUntil) {
      s.status = STATUS.ACTIVE;
      displayStatus = STATUS.ACTIVE;
    }
    const reqInWindow = reqCountInWindow(k);
    const isProactiveThrottle = displayStatus === STATUS.ACTIVE && reqInWindow >= MAX_REQ_PER_MIN;
    return {
      index:              i + 1,
      keyShort:           `...${k.slice(-8)}`,
      status:             isProactiveThrottle ? 'throttled' : displayStatus,
      cooldownUntil:      s.cooldownUntil || 0,
      errorCount:         s.errorCount    || 0,
      hitCount:           s.hitCount      || 0,
      lastUsed:           s.lastUsed      || null,
      isCurrent:          i === currentIdx,
      reqInWindow,
      maxReqPerMin:       MAX_REQ_PER_MIN,
    };
  });

  const totalActive   = list.filter(k => k.status === STATUS.ACTIVE).length;
  const totalCooling  = list.filter(k => k.status === STATUS.COOLING).length;
  const totalInvalid  = list.filter(k => k.status === STATUS.INVALID).length;
  const totalThrottle = list.filter(k => k.status === 'throttled').length;
  const currentKey    = keys[currentIdx] ? `Key ${currentIdx + 1} (...${keys[currentIdx].slice(-8)})` : '-';

  return { list, total: keys.length, totalActive, totalCooling, totalInvalid, totalThrottle, currentKey, maxReqPerMin: MAX_REQ_PER_MIN };
}

module.exports = {
  init,
  getKey,
  executeWithRetry,
  markRateLimited,
  markInvalid,
  isRateLimitError,
  isInvalidError,
  getStatusSummary,
  STATUS,
};
