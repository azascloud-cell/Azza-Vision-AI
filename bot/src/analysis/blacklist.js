/**
 * blacklist.js — Blacklist Kondisi Market Buruk
 *
 * Bot belajar menghindari kondisi yang sering menghasilkan loss:
 *  - Sideways ekstrem (ATR sangat rendah)
 *  - Spread melebar (deteksi dari volatilitas spike sesaat)
 *  - Volatilitas terlalu rendah
 *  - Kondisi high-impact news (jadwal hardcoded jam berita NFP dll)
 */

const { atr } = require('./indicators');

// ─── IN-MEMORY BLACKLIST LOG ───────────────────────────────────────────────────
// Rolling window 100 entri terakhir kondisi buruk
const blacklistLog = [];
const MAX_LOG = 100;

// ─── KONDISI SIDEWAYS EKSTREM ──────────────────────────────────────────────────
function isSidewaysExtreme(candles) {
  if (!candles || candles.length < 20) return false;

  const last20   = candles.slice(-20);
  const highs    = last20.map(c => c.high);
  const lows     = last20.map(c => c.low);
  const range    = Math.max(...highs) - Math.min(...lows);
  const avgClose = last20.reduce((s, c) => s + c.close, 0) / last20.length;

  // Range kurang dari 0.3% dari harga = sideways ekstrem untuk XAUUSD
  return range / avgClose < 0.003;
}

// ─── VOLATILITAS TERLALU RENDAH ────────────────────────────────────────────────
function isVolatilityTooLow(candles) {
  if (!candles || candles.length < 14) return false;

  const atrArr   = atr(candles, 14);
  const lastAtr  = atrArr[atrArr.length - 1];
  const last     = candles[candles.length - 1];

  // ATR < 0.1% dari harga = volatilitas terlalu rendah
  return lastAtr / last.close < 0.001;
}

// ─── JADWAL BERITA BERDAMPAK TINGGI (WIB) ─────────────────────────────────────
// Hindari masuk 30 menit sebelum & sesudah berita high-impact
const HIGH_IMPACT_HOURS_WIB = [
  // NFP (Jumat pertama setiap bulan) ~19:30 WIB
  { day: 5, hour: 19, minute: 0,  label: 'NFP Window' },
  { day: 5, hour: 19, minute: 30, label: 'NFP Release' },
  // CPI USA ~19:30 WIB
  { day: 3, hour: 19, minute: 30, label: 'CPI Window' },
  // FOMC (Rabu) ~01:00 WIB (hari berikutnya)
  { day: 4, hour: 1,  minute: 0,  label: 'FOMC Decision' },
  // US Market Open (Senin-Jumat) ~19:30 WIB
  { day: null, hour: 19, minute: 30, label: 'US Market Open' },
];

function isNearHighImpactNews() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // WIB
  const hour   = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const day    = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri

  for (const slot of HIGH_IMPACT_HOURS_WIB) {
    if (slot.day !== null && slot.day !== day) continue;
    const slotMinutes = slot.hour * 60 + slot.minute;
    const nowMinutes  = hour * 60 + minute;
    if (Math.abs(nowMinutes - slotMinutes) <= 30) {
      return { active: true, label: slot.label };
    }
  }
  return { active: false };
}

// ─── SPREAD MELEBAR (heuristik dari body candle vs range) ─────────────────────
function isSpreadWidened(candles) {
  if (!candles || candles.length < 5) return false;

  const last5 = candles.slice(-5);
  const atrArr = atr(candles, 14);
  const lastAtr = atrArr[atrArr.length - 1];

  // Jika banyak candle dengan body sangat kecil tapi range besar = spread melebar
  const suspiciousCount = last5.filter(c => {
    const body  = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    return range > lastAtr * 2 && body < range * 0.1;
  }).length;

  return suspiciousCount >= 2;
}

// ─── CEK SEMUA KONDISI BLACKLIST ──────────────────────────────────────────────
/**
 * @param {object} tfData - { m5, h1, h4 }
 * @returns {{ blocked: boolean, reasons: string[], penalty: number }}
 */
function checkBlacklist(tfData) {
  const { m5, h1 } = tfData;
  const reasons = [];
  let penalty   = 0;

  if (isSidewaysExtreme(m5)) {
    reasons.push('⚠️ Sideways ekstrem (range M5 sangat sempit)');
    penalty += 20;
  }

  if (isVolatilityTooLow(m5)) {
    reasons.push('⚠️ Volatilitas terlalu rendah');
    penalty += 15;
  }

  if (isSpreadWidened(m5)) {
    reasons.push('⚠️ Spread terdeteksi melebar');
    penalty += 25;
  }

  const news = isNearHighImpactNews();
  if (news.active) {
    reasons.push(`⚠️ Menjelang berita: ${news.label}`);
    penalty += 30;
  }

  // Log kondisi buruk
  if (reasons.length > 0) {
    blacklistLog.push({
      timestamp: new Date().toISOString(),
      reasons,
      penalty,
    });
    if (blacklistLog.length > MAX_LOG) blacklistLog.shift();
  }

  // Blocked jika penalty terlalu tinggi
  const blocked = penalty >= 40;

  return { blocked, reasons, penalty };
}

/**
 * Format pesan blacklist untuk /status atau /why
 */
function formatBlacklistStatus() {
  const recent = blacklistLog.slice(-5);
  if (recent.length === 0) return 'Tidak ada kondisi blacklist terdeteksi.';

  return recent.map(e => {
    const time = new Date(e.timestamp);
    const wib  = new Date(time.getTime() + 7 * 60 * 60 * 1000);
    const hhmm = `${String(wib.getUTCHours()).padStart(2,'0')}:${String(wib.getUTCMinutes()).padStart(2,'0')}`;
    return `[${hhmm} WIB] ${e.reasons.join(', ')} (penalti: -${e.penalty})`;
  }).join('\n');
}

/**
 * Ambil semua kondisi blacklist aktif saat ini
 */
function getCurrentBlacklistReasons(tfData) {
  return checkBlacklist(tfData);
}

module.exports = {
  checkBlacklist,
  getCurrentBlacklistReasons,
  formatBlacklistStatus,
  isNearHighImpactNews,
  isSidewaysExtreme,
  isVolatilityTooLow,
};
