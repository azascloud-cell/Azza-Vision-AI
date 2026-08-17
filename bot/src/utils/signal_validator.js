/**
 * signal_validator.js — Strict Signal Validation
 *
 * WAJIB: Validasi ketat sebelum sinyal dibuat, disimpan, atau dimonitor.
 * Tidak ada sinyal yang boleh lolos dengan nilai tidak valid.
 *
 * Rules:
 *   - entry  > 0
 *   - tp1    > 0
 *   - tp2    > 0
 *   - sl     > 0
 *   - direction = 'BUY' | 'SELL'
 *   - Semua nilai harus finite (bukan NaN atau Infinity)
 *   - BUY  : tp1 > entry > sl  dan  tp2 > tp1
 *   - SELL : tp1 < entry < sl  dan  tp2 < tp1
 */

const VALID_DIRECTIONS = new Set(['BUY', 'SELL']);

/**
 * Validasi data sinyal sebelum dibuat / dikirim.
 * @param {object} data - { direction, entry, tp1, tp2, sl }
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateSignal(data) {
  const { direction, entry, tp1, tp2, sl } = data || {};

  // 1. Direction harus BUY atau SELL
  if (!VALID_DIRECTIONS.has(direction)) {
    return { valid: false, reason: `Direction tidak valid: "${direction}"` };
  }

  // 2. Semua nilai harus ada dan merupakan number finite
  for (const [key, val] of [['entry', entry], ['tp1', tp1], ['tp2', tp2], ['sl', sl]]) {
    if (typeof val !== 'number' || !isFinite(val)) {
      return { valid: false, reason: `${key} bukan angka valid: ${val}` };
    }
    if (val <= 0) {
      return { valid: false, reason: `${key} harus > 0, dapat: ${val}` };
    }
  }

  // 3. Logika arah harus benar
  if (direction === 'BUY') {
    if (!(tp1 > entry)) {
      return { valid: false, reason: `BUY: tp1 (${tp1}) harus > entry (${entry})` };
    }
    if (!(tp2 > tp1)) {
      return { valid: false, reason: `BUY: tp2 (${tp2}) harus > tp1 (${tp1})` };
    }
    if (!(sl < entry)) {
      return { valid: false, reason: `BUY: sl (${sl}) harus < entry (${entry})` };
    }
  } else { // SELL
    if (!(tp1 < entry)) {
      return { valid: false, reason: `SELL: tp1 (${tp1}) harus < entry (${entry})` };
    }
    if (!(tp2 < tp1)) {
      return { valid: false, reason: `SELL: tp2 (${tp2}) harus < tp1 (${tp1})` };
    }
    if (!(sl > entry)) {
      return { valid: false, reason: `SELL: sl (${sl}) harus > entry (${entry})` };
    }
  }

  // 4. Nilai harus realistis untuk XAUUSD (gold biasanya $1500 - $5000)
  if (entry < 500 || entry > 10000) {
    return { valid: false, reason: `Entry (${entry}) di luar range realistis XAUUSD ($500-$10000)` };
  }

  return { valid: true };
}

/**
 * Validasi harga saat ini sebelum digunakan untuk membuat sinyal.
 * @param {number|null|undefined} price
 * @returns {{ valid: boolean, reason?: string }}
 */
function validatePrice(price) {
  if (typeof price !== 'number' || !isFinite(price)) {
    return { valid: false, reason: `Harga bukan angka valid: ${price}` };
  }
  if (price <= 0) {
    return { valid: false, reason: `Harga harus > 0, dapat: ${price}` };
  }
  if (price < 500 || price > 10000) {
    return { valid: false, reason: `Harga (${price}) di luar range realistis XAUUSD` };
  }
  return { valid: true };
}

/**
 * Validasi sinyal yang ada di database (sebelum dimonitor).
 * Sinyal corrupt dari DB tidak boleh dimonitor.
 * @param {object} sig - signal record dari DB
 * @returns {boolean}
 */
function isSignalMonitorable(sig) {
  if (!sig) return false;
  const { id, direction, entry, tp1, tp2, sl } = sig;

  // Cepat: cukup direction dan entry valid, detail validasi untuk signal baru
  if (!VALID_DIRECTIONS.has(direction)) {
    console.warn(`[VALIDATOR] Signal #${id} dilewati: direction tidak valid (${direction})`);
    return false;
  }

  const vals = [
    ['entry', entry], ['tp1', tp1], ['tp2', tp2], ['sl', sl]
  ];
  for (const [key, val] of vals) {
    const v = parseFloat(val);
    if (!isFinite(v) || v <= 0) {
      console.warn(`[VALIDATOR] Signal #${id} dilewati: ${key}=${val} tidak valid`);
      return false;
    }
  }

  return true;
}

module.exports = { validateSignal, validatePrice, isSignalMonitorable };
