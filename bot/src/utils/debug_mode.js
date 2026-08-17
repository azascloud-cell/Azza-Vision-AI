/**
 * debug_mode.js — Developer Debug Mode untuk AZZAVISION AI v4.0
 *
 * /debug on  → Aktifkan debug mode
 * /debug off → Nonaktifkan debug mode
 *
 * Semua aktivitas penting di-log ke logs/debug.log
 * Log otomatis dirotasi agar tidak memenuhi storage.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR     = path.resolve('./logs');
const LOG_FILE    = path.join(LOG_DIR, 'debug.log');
const MAX_LOG_MB  = 5;       // rotasi jika > 5 MB
const MAX_LOG_BACKUPS = 3;   // simpan 3 backup rotasi

// ─── STATE ────────────────────────────────────────────────────────────────────
let _debugEnabled = false;

// Pastikan folder logs ada
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch { /* skip */ }

// ─── LOG ROTATION ─────────────────────────────────────────────────────────────
function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_LOG_MB * 1024 * 1024) return;

    // Rotasi: hapus backup paling lama, geser yang ada
    for (let i = MAX_LOG_BACKUPS; i >= 1; i--) {
      const from = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      const to   = `${LOG_FILE}.${i}`;
      if (fs.existsSync(from)) {
        try { fs.renameSync(from, to); } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
}

// ─── DEBUG LOG ────────────────────────────────────────────────────────────────
/**
 * debugLog(category, message) — Log aktivitas ke file dan console jika debug aktif
 *
 * Kategori: CALLBACK, AI_REQUEST, AI_RESPONSE, EXPORT, SIGNAL, TRADE,
 *           SCHEDULER, BACKUP, ERROR, INFO, STARTUP, SCAN
 *
 * @param {string} category
 * @param {string} message
 */
function debugLog(category, message) {
  try {
    const ts    = new Date().toISOString();
    const line  = `[${ts}] [${category}] ${message}\n`;

    // Selalu log ERROR ke console
    if (category === 'ERROR') {
      console.error(`[DEBUG:${category}] ${message}`);
    } else if (_debugEnabled) {
      console.log(`[DEBUG:${category}] ${message}`);
    }

    // Tulis ke file jika debug aktif atau kategori ERROR
    if (_debugEnabled || category === 'ERROR') {
      rotateLogIfNeeded();
      fs.appendFileSync(LOG_FILE, line, 'utf8');
    }
  } catch { /* jangan crash jika logging gagal */ }
}

// ─── STATE MANAGEMENT ─────────────────────────────────────────────────────────
function isDebugMode() { return _debugEnabled; }

function setDebugMode(enabled) {
  _debugEnabled = !!enabled;
  const status = _debugEnabled ? 'ON' : 'OFF';
  debugLog('INFO', `Debug mode diset ke ${status}`);
  console.log(`[DEBUG_MODE] Debug mode: ${status}`);
}

// ─── READ LOG ─────────────────────────────────────────────────────────────────
/**
 * getDebugLog(lines?) — Baca N baris terakhir dari debug.log
 * @param {number} lines - jumlah baris terakhir yang dibaca
 * @returns {string}
 */
function getDebugLog(lines = 50) {
  try {
    if (!fs.existsSync(LOG_FILE)) return '(debug.log belum ada)';
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const allLines = content.split('\n').filter(Boolean);
    return allLines.slice(-lines).join('\n') || '(log kosong)';
  } catch (err) {
    return `(error baca log: ${err.message})`;
  }
}

/**
 * clearDebugLog() — Kosongkan debug.log
 */
function clearDebugLog() {
  try {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
    return true;
  } catch { return false; }
}

/**
 * getDebugLogSize() — Ukuran file log dalam KB
 */
function getDebugLogSize() {
  try {
    if (!fs.existsSync(LOG_FILE)) return 0;
    return Math.round(fs.statSync(LOG_FILE).size / 1024);
  } catch { return 0; }
}

module.exports = {
  debugLog,
  isDebugMode,
  setDebugMode,
  getDebugLog,
  clearDebugLog,
  getDebugLogSize,
  LOG_FILE,
};
