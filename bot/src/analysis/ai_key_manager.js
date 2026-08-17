/**
 * ai_key_manager.js — AI API Key Manager
 *
 * Menyimpan, merotasi, dan melacak status semua API Key untuk
 * Groq, OpenRouter, dan Gemini.
 *
 * Status key:
 *   ACTIVE   — siap digunakan
 *   COOLDOWN — kena rate-limit, tunggu sampai cooldownUntil
 *   INVALID  — 401/403, tidak bisa dipakai
 *   DISABLED — dinonaktifkan manual oleh owner
 *
 * Storage: data/ai_keys.json (konsisten dengan pola JSON storage project)
 */

const fs   = require('fs');
const path = require('path');

const KEYS_FILE     = path.resolve('./data/ai_keys.json');
const PROVIDER_FILE = path.resolve('./data/ai_provider.json');

const STATUS = {
  ACTIVE:   'ACTIVE',
  COOLDOWN: 'COOLDOWN',
  INVALID:  'INVALID',
  DISABLED: 'DISABLED',
};

const PROVIDERS = ['groq', 'openrouter', 'gemini'];

// ─── INTERNAL I/O ─────────────────────────────────────────────────────────────
function loadKeys() {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      for (const p of PROVIDERS) {
        if (!Array.isArray(parsed[p])) parsed[p] = [];
      }
      return parsed;
    }
  } catch { /* */ }
  return { groq: [], openrouter: [], gemini: [] };
}

function saveKeys(data) {
  const dir = path.dirname(KEYS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

function loadProviderConfig() {
  try {
    if (fs.existsSync(PROVIDER_FILE)) {
      return JSON.parse(fs.readFileSync(PROVIDER_FILE, 'utf8'));
    }
  } catch { /* */ }
  return { primary: null, mode: 'auto' };
}

function saveProviderConfig(cfg) {
  const dir = path.dirname(PROVIDER_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROVIDER_FILE, JSON.stringify(cfg, null, 2));
}

// ─── AUTO-RECOVER COOLDOWN ────────────────────────────────────────────────────
function resolveStatus(k) {
  if (k.status === STATUS.COOLDOWN && k.cooldownUntil && Date.now() >= k.cooldownUntil) {
    return STATUS.ACTIVE;
  }
  return k.status;
}

// ─── KEY ROTATION: next active key for a provider ─────────────────────────────
/**
 * Kembalikan list key yang siap dipakai (ACTIVE), sudah otomatis recover dari COOLDOWN.
 * Urutan: round-robin berdasarkan `lastUsedAt` (yang paling lama tidak dipakai duluan).
 */
function getReadyKeys(provider) {
  const data = loadKeys();
  const keys = (data[provider] || []).map((k, i) => ({
    ...k,
    index:  i + 1,
    status: resolveStatus(k),
  }));
  return keys
    .filter(k => k.status === STATUS.ACTIVE)
    .sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0)); // least-recently-used first
}

function markKeyUsed(provider, keyValue) {
  const data = loadKeys();
  const keys = data[provider] || [];
  for (const k of keys) {
    if (k.key === keyValue) { k.lastUsedAt = Date.now(); break; }
  }
  saveKeys(data);
}

function markKeyLimit(provider, keyValue, retryAfterMs = 60_000) {
  const data = loadKeys();
  for (const k of (data[provider] || [])) {
    if (k.key === keyValue) {
      k.status       = STATUS.COOLDOWN;
      k.cooldownUntil = Date.now() + retryAfterMs;
      k.lastError    = '429/quota exceeded';
      k.lastErrorAt  = Date.now();
      break;
    }
  }
  saveKeys(data);
}

function markKeyInvalid(provider, keyValue) {
  const data = loadKeys();
  for (const k of (data[provider] || [])) {
    if (k.key === keyValue) {
      k.status      = STATUS.INVALID;
      k.lastError   = 'INVALID KEY (401/403)';
      k.lastErrorAt = Date.now();
      break;
    }
  }
  saveKeys(data);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
function addKey(provider, keyValue) {
  if (!PROVIDERS.includes(provider)) throw new Error(`Provider tidak valid: ${provider}`);
  const data = loadKeys();
  if (!data[provider]) data[provider] = [];
  if (data[provider].some(k => k.key === keyValue)) {
    throw new Error('Key sudah ada — duplikat ditolak.');
  }
  data[provider].push({
    key:     keyValue,
    status:  STATUS.ACTIVE,
    addedAt: Date.now(),
    lastUsedAt: 0,
  });
  saveKeys(data);
  return data[provider].length;
}

function removeKey(provider, selector) {
  const data = loadKeys();
  const keys = data[provider] || [];
  let i;
  // Support both: index number (1-based) OR full key string
  if (/^\d+$/.test(String(selector))) {
    i = Number(selector) - 1;
    if (i < 0 || i >= keys.length) throw new Error(`Index tidak valid (1-${keys.length})`);
  } else {
    i = keys.findIndex(k => k.key === String(selector));
    if (i === -1) throw new Error('Key tidak ditemukan — pastikan format persis sama.');
  }
  keys.splice(i, 1);
  data[provider] = keys;
  saveKeys(data);
}

function enableKey(provider, oneBasedIndex) {
  const data = loadKeys();
  const k    = (data[provider] || [])[oneBasedIndex - 1];
  if (!k) throw new Error('Key tidak ditemukan');
  k.status       = STATUS.ACTIVE;
  k.cooldownUntil = null;
  k.lastError    = null;
  k.lastErrorAt  = null;
  saveKeys(data);
}

function disableKey(provider, oneBasedIndex) {
  const data = loadKeys();
  const k    = (data[provider] || [])[oneBasedIndex - 1];
  if (!k) throw new Error('Key tidak ditemukan');
  k.status = STATUS.DISABLED;
  saveKeys(data);
}

// ─── DISPLAY HELPERS ─────────────────────────────────────────────────────────
function maskKey(key) {
  if (!key || key.length < 10) return '***';
  return key.slice(0, 6) + '***' + key.slice(-4);
}

function getDashboard() {
  const data = loadKeys();
  const now  = Date.now();
  const result = {};

  for (const p of PROVIDERS) {
    const keys = (data[p] || []).map((k, i) => ({
      index:        i + 1,
      masked:       maskKey(k.key),
      status:       resolveStatus(k),
      cooldownUntil: k.cooldownUntil,
      lastError:    k.lastError,
    }));
    result[p] = {
      total:    keys.length,
      active:   keys.filter(k => k.status === STATUS.ACTIVE).length,
      cooldown: keys.filter(k => k.status === STATUS.COOLDOWN).length,
      invalid:  keys.filter(k => k.status === STATUS.INVALID).length,
      disabled: keys.filter(k => k.status === STATUS.DISABLED).length,
      keys,
    };
  }

  return result;
}

// ─── ENV KEY FALLBACK ─────────────────────────────────────────────────────────
// Jika tidak ada key di ai_keys.json, coba ambil dari env vars
function getEnvKey(provider) {
  if (provider === 'gemini')     return process.env.GEMINI_API_KEY || null;
  if (provider === 'groq')       return process.env.GROQ_API_KEY || null;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY || null;
  return null;
}

// ─── PROVIDER CONFIG ──────────────────────────────────────────────────────────
function setProviderConfig(provider, mode = 'manual') {
  saveProviderConfig({ primary: provider, mode, updatedAt: Date.now() });
}

function getProviderConfig() {
  return loadProviderConfig();
}

module.exports = {
  STATUS,
  PROVIDERS,
  getReadyKeys,
  markKeyUsed,
  markKeyLimit,
  markKeyInvalid,
  addKey,
  removeKey,
  enableKey,
  disableKey,
  maskKey,
  getDashboard,
  getEnvKey,
  setProviderConfig,
  getProviderConfig,
};
