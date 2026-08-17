/**
 * crash_guard.js — Crash Recovery & Abnormal Shutdown Detection
 *
 * Saat startup: cek apakah shutdown sebelumnya normal atau abnormal.
 * Jika abnormal, kirim notifikasi ke owner via Telegram.
 *
 * AZZAVISION AI v4.0
 */

const fs   = require('fs').promises;
const path = require('path');
const { debugLog } = require('./debug_mode');

const GUARD_FILE = path.resolve('./data/shutdown_guard.json');

// ─── WRITE NORMAL SHUTDOWN ────────────────────────────────────────────────────
/**
 * markNormalShutdown() — Tandai shutdown sebagai normal
 * Dipanggil dari SIGINT / SIGTERM handler
 */
async function markNormalShutdown() {
  try {
    await fs.writeFile(GUARD_FILE, JSON.stringify({
      normal: true,
      timestamp: new Date().toISOString(),
      pid: process.pid,
    }, null, 2));
    debugLog('INFO', 'Normal shutdown ditandai.');
  } catch (err) {
    console.error('[CRASH_GUARD] Gagal tulis shutdown marker:', err.message);
  }
}

// ─── CHECK + MARK STARTUP (atomic) ───────────────────────────────────────────
/**
 * checkAndMarkStartup() — Baca state shutdown sebelumnya, lalu tulis marker startup baru.
 * Harus dipanggil sekali saat startup. Hasilnya diteruskan ke notifyCrashRecovery().
 *
 * Logic:
 *  - Jika GUARD_FILE tidak ada        → startup pertama, bukan crash
 *  - Jika GUARD_FILE ada, normal=true → shutdown sebelumnya normal
 *  - Jika GUARD_FILE ada, normal=false / running=true → crash sebelumnya
 *
 * @returns {{ wasAbnormal: boolean, lastTimestamp: string|null }}
 */
async function checkAndMarkStartup() {
  let result = { wasAbnormal: false, lastTimestamp: null };

  // 1. Baca state sebelumnya
  try {
    const raw  = await fs.readFile(GUARD_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (data.running === true && data.normal !== true) {
      // Bot ditulis sebagai "sedang berjalan" tapi tidak di-shutdown normal → crash
      result = { wasAbnormal: true, lastTimestamp: data.timestamp };
    } else if (data.normal === false && !data.running) {
      result = { wasAbnormal: true, lastTimestamp: data.timestamp };
    }
    // Jika normal === true → shutdown bersih, tidak ada crash
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // File corrupt / tidak bisa dibaca → anggap tidak abnormal
      console.warn('[CRASH_GUARD] Tidak bisa baca guard file:', err.message);
    }
    // ENOENT = startup pertama, bukan crash
  }

  // 2. Tulis marker "bot sedang berjalan" (running = true, normal belum)
  try {
    await fs.writeFile(GUARD_FILE, JSON.stringify({
      running:   true,
      normal:    false,
      timestamp: new Date().toISOString(),
      pid:       process.pid,
    }, null, 2));
  } catch (err) {
    console.error('[CRASH_GUARD] Gagal tulis startup marker:', err.message);
  }

  return result;
}

// Alias untuk backward compat — kini tidak dipakai langsung, gunakan checkAndMarkStartup
async function markStartup() {
  return checkAndMarkStartup();
}

// ─── CHECK ABNORMAL SHUTDOWN (deprecated, gunakan checkAndMarkStartup) ─────────
async function checkAbnormalShutdown() {
  return { wasAbnormal: false, lastTimestamp: null }; // lihat checkAndMarkStartup
}

// ─── GET LAST BACKUP INFO ─────────────────────────────────────────────────────
/**
 * Ambil info backup terakhir untuk notifikasi crash recovery
 */
async function getLastBackupSummary() {
  try {
    const statusFile = path.resolve('./data/backup_status.json');
    const raw = await fs.readFile(statusFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── NOTIFY OWNER ─────────────────────────────────────────────────────────────
/**
 * notifyCrashRecovery(bot) — Kirim notifikasi crash ke owner jika shutdown abnormal
 * Dipanggil SETELAH markStartup() sudah menimpa file, sehingga state sebelumnya
 * harus sudah dibaca terlebih dahulu oleh checkAndMarkStartup().
 * @param {object} bot - Telegraf bot instance
 * @param {{ wasAbnormal: boolean, lastTimestamp: string|null }} crashInfo
 */
async function notifyCrashRecovery(bot, crashInfo) {
  try {
    const { wasAbnormal, lastTimestamp } = crashInfo || {};
    if (!wasAbnormal) return;

    const ownerId = process.env.OWNER_ID;
    if (!ownerId) return;

    debugLog('INFO', `Abnormal shutdown terdeteksi. Last timestamp: ${lastTimestamp}`);

    // Format tanggal
    let lastShutdownStr = 'Unknown';
    if (lastTimestamp) {
      try {
        const { toWIB } = require('./wib_time');
        const wib = toWIB(new Date(lastTimestamp));
        lastShutdownStr = `${wib.dateNum} ${wib.month} ${wib.year} ${wib.hours}:${wib.minutes} WIB`;
      } catch {
        lastShutdownStr = lastTimestamp;
      }
    }

    // Info backup terakhir
    const backupSummary = await getLastBackupSummary();
    let backupLine = '<i>Belum ada backup tercatat.</i>';
    if (backupSummary) {
      try {
        const { toWIB } = require('./wib_time');
        const bwib = toWIB(new Date(backupSummary.timestamp));
        const bDate = `${bwib.dateNum} ${bwib.month} ${bwib.year} ${bwib.hours}:${bwib.minutes} WIB`;
        const valid = backupSummary.allValid ? '✅ VALID' : '⚠️ PARTIAL';
        backupLine = `<b>${bDate}</b>\nStatus: <b>${valid}</b>`;
      } catch { /* skip */ }
    }

    const msg = [
      `⚠️ <b>CRASH RECOVERY DETECTED</b>`,
      ``,
      `Bot terdeteksi berhenti secara tidak normal.`,
      ``,
      `🕐 <b>Last Shutdown:</b>`,
      lastShutdownStr,
      ``,
      `📦 <b>Latest Backup:</b>`,
      backupLine,
      ``,
      `Bot kini sudah kembali online.`,
      `Gunakan /backupstatus untuk cek kondisi backup.`,
    ].join('\n');

    await bot.telegram.sendMessage(ownerId, msg, { parse_mode: 'HTML' });
    debugLog('INFO', 'Crash recovery notification terkirim ke owner.');
  } catch (err) {
    console.error('[CRASH_GUARD] Gagal kirim notif crash:', err.message);
  }
}

// ─── REGISTER SHUTDOWN HOOKS ──────────────────────────────────────────────────
/**
 * registerShutdownHooks(bot) — Daftarkan SIGINT/SIGTERM handler untuk normal shutdown
 */
function registerShutdownHooks(bot) {
  async function gracefulShutdown(signal) {
    console.log(`[CRASH_GUARD] ${signal} diterima — shutdown normal.`);
    await markNormalShutdown();
    bot.stop(signal);
    process.exit(0);
  }

  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.once('SIGINT',  () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

module.exports = {
  markNormalShutdown,
  markStartup,
  checkAndMarkStartup,
  checkAbnormalShutdown,
  notifyCrashRecovery,
  registerShutdownHooks,
};
