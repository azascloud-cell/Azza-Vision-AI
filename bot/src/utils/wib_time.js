/**
 * wib_time.js — Format waktu Indonesia (WIB = UTC+7)
 *
 * ATURAN TAMPILAN:
 *   - Semua timestamp yang ditampilkan ke user WAJIB dikonversi ke WIB.
 *   - Penyimpanan internal (DB, log server) tetap UTC — jangan ubah.
 *   - Gunakan isoToWIBShort() untuk konversi dari string ISO UTC.
 *   - Gunakan todayWIB() untuk mendapatkan tanggal hari ini dalam WIB.
 */

const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];

/**
 * Konversi Date ke WIB (UTC+7).
 * @param {Date} [date=new Date()]
 * @returns {{
 *   dayName, dateNum, monthNum, month, year,
 *   hours, minutes, seconds,
 *   full, short, compact, line
 * }}
 */
function toWIB(date = new Date()) {
  const wib      = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const dayName  = DAYS_ID[wib.getUTCDay()];
  const dateNum  = wib.getUTCDate();
  const monthNum = wib.getUTCMonth() + 1;          // 1–12
  const month    = MONTHS_ID[wib.getUTCMonth()];
  const year     = wib.getUTCFullYear();
  const hh       = String(wib.getUTCHours()).padStart(2, '0');
  const mm       = String(wib.getUTCMinutes()).padStart(2, '0');
  const ss       = String(wib.getUTCSeconds()).padStart(2, '0');
  const ddStr    = String(dateNum).padStart(2, '0');
  const mmStr    = String(monthNum).padStart(2, '0');

  return {
    dayName,
    dateNum,
    monthNum,
    month,
    year,
    hours:   hh,
    minutes: mm,
    seconds: ss,
    // "Minggu, 22 Juni 2026 — 04:55 WIB"
    full:    `${dayName}, ${dateNum} ${month} ${year} — ${hh}:${mm} WIB`,
    // "22 Jun 2026 04:55 WIB"
    short:   `${dateNum} ${MONTHS_ID[wib.getUTCMonth()].slice(0, 3)} ${year} ${hh}:${mm} WIB`,
    // "2026-06-22" — berguna untuk query database
    compact: `${year}-${mmStr}-${ddStr}`,
    // Dua baris siap pakai untuk pesan Telegram
    line:    `🕐 ${dayName}, ${dateNum} ${month} ${year}\n🕒 ${hh}:${mm} WIB (UTC+7)`,
  };
}

/**
 * Konversi string ISO UTC (dari DB) ke format WIB pendek untuk tampilan UI.
 * Contoh: "2026-06-22T04:55:00.000Z" → "22 Jun 2026 11:55 WIB"
 * @param {string|null} isoStr
 * @returns {string}
 */
function isoToWIBShort(isoStr) {
  if (!isoStr) return '-';
  try {
    return toWIB(new Date(isoStr)).short;
  } catch {
    // fallback: tampilkan apa adanya tanpa crash
    return String(isoStr).slice(0, 16).replace('T', ' ');
  }
}

/**
 * Konversi string ISO UTC ke format WIB panjang.
 * Contoh: "2026-06-22T04:55:00.000Z" → "Minggu, 22 Juni 2026 — 11:55 WIB"
 * @param {string|null} isoStr
 * @returns {string}
 */
function isoToWIBFull(isoStr) {
  if (!isoStr) return '-';
  try {
    return toWIB(new Date(isoStr)).full;
  } catch {
    return String(isoStr).slice(0, 16).replace('T', ' ');
  }
}

/**
 * Ambil tanggal hari ini dalam WIB sebagai string YYYY-MM-DD.
 * Berguna agar laporan /daily menggunakan hari WIB, bukan UTC.
 * @returns {string} contoh: "2026-06-22"
 */
function todayWIB() {
  return toWIB().compact;
}

/**
 * Cek apakah sekarang jam H:MM WIB tertentu (toleransi ±1 menit).
 */
function isNowWIB(targetHour, targetMinute) {
  const now = toWIB();
  const h   = parseInt(now.hours);
  const m   = parseInt(now.minutes);
  return h === targetHour && Math.abs(m - targetMinute) <= 1;
}

/**
 * Ambil jam WIB saat ini (0–23).
 */
function currentHourWIB() {
  return parseInt(toWIB().hours);
}

module.exports = { toWIB, isoToWIBShort, isoToWIBFull, todayWIB, isNowWIB, currentHourWIB };
