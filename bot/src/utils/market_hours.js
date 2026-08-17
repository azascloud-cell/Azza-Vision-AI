/**
 * market_hours.js — XAUUSD Market Hours Detector
 *
 * XAUUSD Spot Gold trade jam:
 *   Buka  : Minggu 22:00 UTC
 *   Tutup : Jumat 22:00 UTC
 *   Sabtu  : TUTUP sepanjang hari
 *   Minggu : TUTUP sebelum jam 22:00 UTC
 *
 * Fungsi ini mengembalikan status market saat ini
 * dan waktu buka/tutup berikutnya.
 */

// Session windows (UTC hours)
const SESSIONS = {
  SYDNEY:   { start: 22, end:  7, label: 'Sydney Session'   },
  TOKYO:    { start:  0, end:  9, label: 'Tokyo Session'    },
  LONDON:   { start:  8, end: 17, label: 'London Session'   },
  NEW_YORK: { start: 13, end: 22, label: 'New York Session' },
};

/**
 * Kembalikan true jika market XAUUSD sedang buka.
 * Market tutup: Jumat 22:00 UTC → Minggu 22:00 UTC
 */
function isMarketOpen() {
  const now    = new Date();
  const day    = now.getUTCDay();   // 0=Minggu,1=Senin,...,6=Sabtu
  const hour   = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const timeMin = hour * 60 + minute; // menit sejak midnight UTC

  // Sabtu: selalu tutup
  if (day === 6) return false;

  // Minggu: tutup sebelum jam 22:00 UTC
  if (day === 0 && timeMin < 22 * 60) return false;

  // Jumat: tutup dari jam 22:00 UTC
  if (day === 5 && timeMin >= 22 * 60) return false;

  return true;
}

/**
 * Kembalikan session aktif berdasarkan waktu UTC sekarang.
 * Bisa ada lebih dari satu session aktif (overlap London+NY).
 */
function getActiveSessions() {
  const now   = new Date();
  const hour  = now.getUTCHours();
  const active = [];

  // Sydney crossing midnight: aktif jam 22-24 dan 0-7 UTC
  const sydneyActive = hour >= 22 || hour < 7;
  if (sydneyActive) active.push('Sydney');

  if (hour >= 0  && hour < 9)  active.push('Tokyo');
  if (hour >= 8  && hour < 17) active.push('London');
  if (hour >= 13 && hour < 22) active.push('New York');

  return active;
}

/**
 * Kembalikan label session aktif (untuk display).
 */
function getSessionLabel() {
  if (!isMarketOpen()) {
    const now = new Date();
    const day = now.getUTCDay();
    if (day === 6) return 'Weekend Session (Saturday)';
    if (day === 0) return 'Weekend Session (Sunday Pre-Open)';
    return 'Weekend Session';
  }

  const active = getActiveSessions();
  if (active.length === 0) return 'Inter-Session';
  return active.join(' + ') + ' Session';
}

/**
 * Waktu market buka berikutnya (dalam ms dari sekarang).
 * Berguna untuk log "tunggu X jam lagi".
 */
function msUntilMarketOpen() {
  if (isMarketOpen()) return 0;

  const now    = new Date();
  const day    = now.getUTCDay();
  const hour   = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const second = now.getUTCSeconds();

  // Hitung hari Minggu jam 22:00 UTC berikutnya
  // Mulai dari sekarang, cari kapan hari = 0 (Minggu) dan jam = 22
  let hoursUntil = 0;

  if (day === 5 && hour >= 22) {
    // Jumat setelah tutup → Minggu 22:00 = ~48 jam
    const elapsedMinsToday = (hour - 22) * 60 + minute;
    hoursUntil = (48 * 60 - elapsedMinsToday) * 60 * 1000 - second * 1000;
  } else if (day === 6) {
    // Sabtu → Minggu 22:00
    const elapsedMinsSat = hour * 60 + minute;
    hoursUntil = ((24 + 22) * 60 - elapsedMinsSat) * 60 * 1000 - second * 1000;
  } else if (day === 0) {
    // Minggu sebelum 22:00
    const elapsedMinsSun = hour * 60 + minute;
    const targetMins     = 22 * 60;
    hoursUntil = (targetMins - elapsedMinsSun) * 60 * 1000 - second * 1000;
  }

  return Math.max(hoursUntil, 0);
}

/**
 * Format waktu tunggu menjadi string "Xh Ym".
 */
function formatTimeUntilOpen() {
  const ms  = msUntilMarketOpen();
  const h   = Math.floor(ms / 3_600_000);
  const m   = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Kembalikan objek status market lengkap untuk tampilan bot.
 */
function getMarketStatus() {
  const open    = isMarketOpen();
  const session = getSessionLabel();

  if (!open) {
    return {
      open: false,
      emoji: '🟡',
      label: 'CLOSED',
      session,
      timeUntilOpen: formatTimeUntilOpen(),
      scannerStatus: '⏳ Scanner paused until market opens',
    };
  }

  return {
    open: true,
    emoji: '🟢',
    label: 'OPEN',
    session,
    timeUntilOpen: null,
    scannerStatus: '🟢 Scanner AKTIF',
  };
}

module.exports = {
  isMarketOpen,
  getActiveSessions,
  getSessionLabel,
  getMarketStatus,
  msUntilMarketOpen,
  formatTimeUntilOpen,
};
