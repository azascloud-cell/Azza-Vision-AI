/**
 * backup.js — Auto backup system untuk AZZAVISION AI v2.1
 *
 * Tiga lapisan perlindungan data:
 *  1. backupBeforeWrite(srcPath) — buat .backup.json sebelum setiap write
 *  2. dailySnapshot(srcPath)    — simpan snapshot bertanggal setiap 24 jam
 *  3. cleanOldBackups(dir, pfx) — pertahankan max 30 backup, hapus yang lama
 *
 * Semua fungsi TIDAK melempar error — jika backup gagal, proses write tetap
 * berjalan normal supaya data utama tidak terganggu.
 */

const fs   = require('fs').promises;
const path = require('path');

const BACKUP_DIR  = path.resolve('./data/backups');
const MAX_BACKUPS = 30;

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function initBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(`[BACKUP] Direktori backup siap: ${BACKUP_DIR}`);
  } catch (err) {
    console.error('[BACKUP] Gagal buat direktori backup:', err.message);
  }
}

// ─── BACKUP BEFORE WRITE ──────────────────────────────────────────────────────
// Dipanggil sebelum setiap atomic write — buat .backup.json di folder backups
async function backupBeforeWrite(srcPath) {
  try {
    await fs.access(srcPath); // pastikan file ada sebelum dicopy
    const baseName  = path.basename(srcPath, path.extname(srcPath));
    const destPath  = path.join(BACKUP_DIR, `${baseName}.backup.json`);
    await fs.copyFile(srcPath, destPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[BACKUP] backupBeforeWrite gagal (${path.basename(srcPath)}):`, err.message);
    }
  }
}

// ─── DAILY SNAPSHOT ───────────────────────────────────────────────────────────
// Buat snapshot bertanggal setiap 24 jam — dipanggil dari index.js
async function dailySnapshot(srcPath) {
  try {
    await fs.access(srcPath);
    const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const baseName = path.basename(srcPath, path.extname(srcPath));
    const destPath = path.join(BACKUP_DIR, `${baseName}_${today}.json`);

    // Jangan timpa jika sudah ada snapshot hari ini
    try {
      await fs.access(destPath);
      return; // sudah ada
    } catch { /* belum ada, lanjut */ }

    await fs.copyFile(srcPath, destPath);
    console.log(`[BACKUP] Daily snapshot: ${path.basename(destPath)}`);

    // Bersihkan backup lama setelah membuat yang baru
    await cleanOldBackups(BACKUP_DIR, baseName + '_');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[BACKUP] dailySnapshot gagal (${path.basename(srcPath)}):`, err.message);
    }
  }
}

// ─── CLEAN OLD BACKUPS ────────────────────────────────────────────────────────
// Pertahankan max MAX_BACKUPS file dengan prefix tertentu — hapus yang paling lama
async function cleanOldBackups(dir, prefix) {
  try {
    const files = (await fs.readdir(dir))
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort(); // nama file sudah ber-tanggal — sort abjad = sort cronologis

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const file of toDelete) {
        await fs.unlink(path.join(dir, file)).catch(() => {});
        console.log(`[BACKUP] Hapus backup lama: ${file}`);
      }
    }
  } catch (err) {
    console.warn('[BACKUP] cleanOldBackups gagal:', err.message);
  }
}

// ─── RUN DAILY BACKUPS (semua file data) ──────────────────────────────────────
async function runDailyBackups() {
  const dbPath    = path.resolve(process.env.DB_PATH     || './data/signals.json');
  const learnPath = path.resolve(process.env.LEARN_PATH  || './data/learning_dataset.json');

  await dailySnapshot(dbPath);
  await dailySnapshot(learnPath);
  console.log('[BACKUP] Daily backup selesai.');
}

// ─── BACKUP STATUS ────────────────────────────────────────────────────────────
async function getBackupInfo() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const stats = await fs.stat(BACKUP_DIR);
    return { dir: BACKUP_DIR, count: files.length, files: files.sort().slice(-5) };
  } catch {
    return { dir: BACKUP_DIR, count: 0, files: [] };
  }
}

module.exports = {
  initBackupDir,
  backupBeforeWrite,
  dailySnapshot,
  runDailyBackups,
  cleanOldBackups,
  getBackupInfo,
};
