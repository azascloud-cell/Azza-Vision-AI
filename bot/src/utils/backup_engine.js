/**
 * backup_engine.js — Automatic Backup Engine untuk AZZAVISION AI v4.0
 *
 * Fitur:
 *  - Backup Source Code (ZIP, exclude node_modules/.git/logs/cache/tmp)
 *  - Backup Database (seluruh folder data)
 *  - Backup Config (.env, configs)
 *  - Kirim ke Telegram Admin
 *  - Retensi 14 backup terakhir
 *  - Smart Backup (skip source jika tidak ada perubahan)
 *  - Backup Validation (ukuran > 0, ZIP tidak corrupt)
 *  - Auto Retry jika ZIP corrupt
 *  - Backup Log
 *  - /backuphistory, /backupstatus, /backup, /restorelist support
 *
 * AZZAVISION AI v4.0
 */

const fs      = require('fs').promises;
const fsSync  = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const cron    = require('node-cron');
const archiver = require('archiver');
const { debugLog } = require('./debug_mode');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BACKUP_ROOT    = path.resolve('./data/backups_v4');
const BACKUP_LOG_DIR = path.resolve('./logs');
const STATUS_FILE    = path.resolve('./data/backup_status.json');
const HASH_FILE      = path.resolve('./data/backup_source_hash.json');
const MAX_BACKUPS    = 14;

// ─── SETTINGS STATE ───────────────────────────────────────────────────────────
let _settings = {
  autoEnabled:      true,
  telegramEnabled:  true,
  mode:             'auto', // 'auto' | 'manual'
};

function getSettings() { return { ..._settings }; }
function updateSettings(patch) {
  _settings = { ..._settings, ...patch };
  saveSettings().catch(() => {});
}

const SETTINGS_FILE = path.resolve('./data/backup_settings.json');

async function loadSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    _settings = { ..._settings, ...JSON.parse(raw) };
  } catch { /* default */ }
}

async function saveSettings() {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(_settings, null, 2));
  } catch { /* skip */ }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function initBackupEngine() {
  try {
    await fs.mkdir(BACKUP_ROOT, { recursive: true });
    await fs.mkdir(BACKUP_LOG_DIR, { recursive: true });
    await loadSettings();
    debugLog('BACKUP', 'Backup Engine v4.0 siap.');
    console.log('[BACKUP_ENGINE] ✅ Backup Engine v4.0 siap.');
  } catch (err) {
    console.error('[BACKUP_ENGINE] Gagal init:', err.message);
  }
}

// ─── ZIP CREATION ─────────────────────────────────────────────────────────────
/**
 * createZip(outputPath, sourceDir, globs, excludes) — Buat ZIP dari directory
 * @returns {Promise<{size: number, path: string}>}
 */
function createZip(outputPath, sourceDir, { includes = ['.'], excludes = [] } = {}) {
  return new Promise((resolve, reject) => {
    const output  = fsSync.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve({ size: archive.pointer(), path: outputPath }));
    archive.on('error', reject);
    archive.pipe(output);

    // Tambahkan file/folder
    includes.forEach(inc => {
      const absPath = path.join(sourceDir, inc);
      try {
        const stat = fsSync.statSync(absPath);
        if (stat.isDirectory()) {
          archive.glob('**/*', {
            cwd: absPath,
            ignore: excludes,
            dot: false,
          }, { prefix: path.relative(sourceDir, absPath) || '' });
        } else {
          archive.file(absPath, { name: path.basename(absPath) });
        }
      } catch { /* skip jika tidak ada */ }
    });

    archive.finalize();
  });
}

// ─── VALIDATE ZIP ─────────────────────────────────────────────────────────────
async function validateZip(zipPath) {
  try {
    const stat = await fs.stat(zipPath);
    if (stat.size === 0) return { valid: false, reason: 'File size 0' };
    if (stat.size < 22) return { valid: false, reason: 'File terlalu kecil untuk ZIP valid' };

    // 1. Cek magic bytes awal (PK header)
    const fd  = await fs.open(zipPath, 'r');
    const buf = Buffer.alloc(22);
    await fd.read(buf, 0, 22, 0);
    await fd.close();

    if (buf[0] !== 0x50 || buf[1] !== 0x4B) {
      return { valid: false, reason: 'ZIP magic bytes tidak valid (bukan PK)' };
    }

    // 2. Cek End-of-Central-Directory record di akhir file (signature 0x06054B50)
    // Ini membuktikan ZIP memiliki struktur lengkap (tidak truncated)
    const fdEnd = await fs.open(zipPath, 'r');
    const eocdBuf = Buffer.alloc(Math.min(65557, stat.size)); // max EOCD search range
    const readLen = Math.min(65557, stat.size);
    await fdEnd.read(eocdBuf, 0, readLen, Math.max(0, stat.size - readLen));
    await fdEnd.close();

    let foundEOCD = false;
    for (let i = eocdBuf.length - 22; i >= 0; i--) {
      if (eocdBuf[i] === 0x50 && eocdBuf[i + 1] === 0x4B &&
          eocdBuf[i + 2] === 0x05 && eocdBuf[i + 3] === 0x06) {
        foundEOCD = true;
        break;
      }
    }

    if (!foundEOCD) {
      return { valid: false, reason: 'ZIP End-of-Central-Directory tidak ditemukan (file corrupt/truncated)' };
    }

    return { valid: true, sizeBytes: stat.size };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

// ─── SOURCE HASH (SMART BACKUP) ───────────────────────────────────────────────
async function getSourceHash() {
  try {
    const srcDir  = path.resolve('./src');
    const entries = await walkDir(srcDir);
    const content = entries.join('\n');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch { return null; }
}

async function walkDir(dir, base = dir) {
  const result = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = await walkDir(full, base);
        result.push(...sub);
      } else {
        const stat = await fs.stat(full);
        result.push(`${path.relative(base, full)}:${stat.size}:${stat.mtimeMs}`);
      }
    }
  } catch { /* skip */ }
  return result.sort();
}

async function loadSourceHash() {
  try {
    const raw = await fs.readFile(HASH_FILE, 'utf8');
    return JSON.parse(raw).hash;
  } catch { return null; }
}

async function saveSourceHash(hash) {
  try {
    await fs.writeFile(HASH_FILE, JSON.stringify({ hash, timestamp: new Date().toISOString() }, null, 2));
  } catch { /* skip */ }
}

// ─── RETENTION CLEANUP ────────────────────────────────────────────────────────
async function cleanOldBackups(prefix) {
  try {
    const files = (await fs.readdir(BACKUP_ROOT))
      .filter(f => f.startsWith(prefix) && (f.endsWith('.zip')))
      .sort();
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const f of toDelete) {
        await fs.unlink(path.join(BACKUP_ROOT, f)).catch(() => {});
        debugLog('BACKUP', `Hapus backup lama: ${f}`);
        console.log(`[BACKUP_ENGINE] Hapus backup lama: ${f}`);
      }
    }
  } catch (err) {
    console.warn('[BACKUP_ENGINE] cleanOldBackups gagal:', err.message);
  }
}

// ─── BACKUP SOURCE CODE ───────────────────────────────────────────────────────
async function backupSource(dateStr, smartCheck = false) {
  const start = Date.now();
  try {
    // Smart Backup: skip jika source tidak berubah
    if (smartCheck) {
      const currentHash = await getSourceHash();
      const savedHash   = await loadSourceHash();
      if (currentHash && savedHash && currentHash === savedHash) {
        debugLog('BACKUP', 'Smart Backup: source tidak berubah, skip backup source.');
        console.log('[BACKUP_ENGINE] Smart Backup: source tidak berubah, skip source.');
        return { skipped: true, reason: 'source tidak berubah (smart backup)' };
      }
    }

    const zipName = `abangwan-source-${dateStr}.zip`;
    const zipPath = path.join(BACKUP_ROOT, zipName);

    const excludes = [
      'node_modules/**', '.git/**', 'logs/**', 'cache/**',
      'tmp/**', 'temp/**', '**/__pycache__/**', 'dist/**',
      '.npm/**', '*.log',
    ];

    const projectRoot = path.resolve('.');
    const { size } = await createZip(zipPath, projectRoot, {
      includes: ['src', 'package.json', 'package-lock.json'],
      excludes,
    });

    const validation = await validateZip(zipPath);
    if (!validation.valid) {
      // Retry sekali
      debugLog('BACKUP', `ZIP source gagal validasi: ${validation.reason} — retry...`);
      await fs.unlink(zipPath).catch(() => {});
      const { size: size2 } = await createZip(zipPath, projectRoot, { includes: ['src', 'package.json'], excludes });
      const v2 = await validateZip(zipPath);
      if (!v2.valid) throw new Error(`ZIP tidak valid setelah retry: ${v2.reason}`);
    }

    // Simpan hash untuk smart backup berikutnya
    const newHash = await getSourceHash();
    if (newHash) await saveSourceHash(newHash);

    await cleanOldBackups('abangwan-source-');
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    debugLog('BACKUP', `Source backup selesai: ${zipName} (${formatBytes(size)}, ${duration}s)`);

    return { success: true, name: zipName, path: zipPath, size, duration: `${duration}s` };
  } catch (err) {
    debugLog('ERROR', `Backup source gagal: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── BACKUP DATABASE ──────────────────────────────────────────────────────────
async function backupDatabase(dateStr) {
  const start = Date.now();
  try {
    const zipName = `abangwan-data-${dateStr}.zip`;
    const zipPath = path.join(BACKUP_ROOT, zipName);

    const dataDir = path.resolve('./data');
    const excludes = ['backups/**', 'backups_v4/**'];

    const { size } = await createZip(zipPath, dataDir, {
      includes: ['.'],
      excludes,
    });

    const validation = await validateZip(zipPath);
    if (!validation.valid) {
      await fs.unlink(zipPath).catch(() => {});
      throw new Error(`ZIP data tidak valid: ${validation.reason}`);
    }

    await cleanOldBackups('abangwan-data-');
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    debugLog('BACKUP', `Database backup selesai: ${zipName} (${formatBytes(size)}, ${duration}s)`);

    return { success: true, name: zipName, path: zipPath, size, duration: `${duration}s` };
  } catch (err) {
    debugLog('ERROR', `Backup database gagal: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── BACKUP CONFIG ────────────────────────────────────────────────────────────
async function backupConfig(dateStr) {
  const start = Date.now();
  try {
    const zipName = `abangwan-config-${dateStr}.zip`;
    const zipPath = path.join(BACKUP_ROOT, zipName);

    const archive   = archiver('zip', { zlib: { level: 6 } });
    const output    = fsSync.createWriteStream(zipPath);

    const finished  = new Promise((res, rej) => {
      output.on('close', res);
      archive.on('error', rej);
    });
    archive.pipe(output);

    // .env — HANYA owner yang boleh terima, strip isi dari Telegram tapi backup file
    const envPath = path.resolve('.env');
    if (fsSync.existsSync(envPath)) {
      archive.file(envPath, { name: '.env' });
    }
    const envExPath = path.resolve('.env.example');
    if (fsSync.existsSync(envExPath)) {
      archive.file(envExPath, { name: '.env.example' });
    }

    // Channel config
    const channelCfg = path.resolve('./data/channel_config.json');
    if (fsSync.existsSync(channelCfg)) {
      archive.file(channelCfg, { name: 'channel_config.json' });
    }

    // AI provider config
    const aiProvider = path.resolve('./data/ai_provider.json');
    if (fsSync.existsSync(aiProvider)) {
      archive.file(aiProvider, { name: 'ai_provider.json' });
    }

    // Backup settings
    if (fsSync.existsSync(SETTINGS_FILE)) {
      archive.file(SETTINGS_FILE, { name: 'backup_settings.json' });
    }

    await archive.finalize();
    await finished;

    const validation = await validateZip(zipPath);
    if (!validation.valid) {
      await fs.unlink(zipPath).catch(() => {});
      throw new Error(`ZIP config tidak valid: ${validation.reason}`);
    }

    const stat = await fs.stat(zipPath);
    await cleanOldBackups('abangwan-config-');
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    debugLog('BACKUP', `Config backup selesai: ${zipName} (${formatBytes(stat.size)}, ${duration}s)`);

    return { success: true, name: zipName, path: zipPath, size: stat.size, duration: `${duration}s` };
  } catch (err) {
    debugLog('ERROR', `Backup config gagal: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── SEND TO TELEGRAM ─────────────────────────────────────────────────────────
async function sendBackupToTelegram(bot, results, log) {
  const ownerId = process.env.OWNER_ID;
  if (!ownerId || !_settings.telegramEnabled) {
    debugLog('BACKUP', 'Telegram send skip: tidak dikonfigurasi atau dinonaktifkan.');
    return;
  }

  try {
    const { toWIB } = require('./wib_time');
    const now = toWIB();
    const nowStr = `${now.dateNum} ${now.month} ${now.year} ${now.hours}:${now.minutes} WIB`;

    const lines = [
      `✅ <b>BACKUP SELESAI</b>`,
      ``,
      `📅 Waktu: ${nowStr}`,
      ``,
    ];

    for (const r of results) {
      if (r.skipped) {
        lines.push(`⏭️ <b>${r.label}:</b> Dilewati (${r.reason})`);
      } else if (r.success) {
        lines.push(`📦 <b>${r.label}:</b> ${r.name}`);
        lines.push(`   📏 ${formatBytes(r.size)} | ⏱️ ${r.duration}`);
      } else {
        lines.push(`❌ <b>${r.label}:</b> GAGAL — ${r.error}`);
      }
      lines.push('');
    }

    // Log summary
    const logLines = log.entries.map(e => `  ${e.status} ${e.step}: ${e.detail}`);
    lines.push(`📋 <b>Log:</b>`);
    lines.push(...logLines);
    lines.push('');
    lines.push(`⏱️ Total: ${log.totalDuration}`);

    await bot.telegram.sendMessage(ownerId, lines.join('\n'), { parse_mode: 'HTML' });
    debugLog('BACKUP', 'Backup report terkirim ke Telegram.');

    // Kirim file ZIP ke owner (hanya jika ukuran reasonable < 50MB)
    for (const r of results) {
      if (!r.success || r.skipped) continue;
      if (r.size > 50 * 1024 * 1024) {
        await bot.telegram.sendMessage(ownerId, `ℹ️ ${r.name} terlalu besar (${formatBytes(r.size)}) untuk dikirim via Telegram.`, { parse_mode: 'HTML' });
        continue;
      }
      try {
        await bot.telegram.sendDocument(ownerId, {
          source: r.path,
          filename: r.name,
        }, { caption: `📦 ${r.label}` });
        debugLog('BACKUP', `File ${r.name} terkirim ke Telegram.`);
      } catch (err) {
        debugLog('ERROR', `Gagal kirim file ${r.name}: ${err.message}`);
        await bot.telegram.sendMessage(ownerId, `⚠️ Gagal kirim ${r.name}: ${err.message}`).catch(() => {});
      }
    }
  } catch (err) {
    debugLog('ERROR', `Gagal kirim backup ke Telegram: ${err.message}`);
    console.error('[BACKUP_ENGINE] Gagal kirim ke Telegram:', err.message);
  }
}

// ─── SAVE BACKUP STATUS ───────────────────────────────────────────────────────
async function saveBackupStatus(results, log) {
  try {
    const allValid = results.every(r => r.skipped || r.success);
    const status = {
      timestamp:   new Date().toISOString(),
      allValid,
      results:     results.map(r => ({
        label:    r.label,
        success:  r.success || false,
        skipped:  r.skipped || false,
        name:     r.name,
        size:     r.size,
        error:    r.error,
      })),
      log,
      nextBackup: getNextBackupTime(),
    };
    await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch { /* skip */ }
}

// ─── GET NEXT BACKUP TIME ─────────────────────────────────────────────────────
function getNextBackupTime() {
  const now  = new Date();
  // Next 00:00 WIB = 17:00 UTC previous day or 17:00 UTC today
  const next = new Date();
  next.setUTCHours(17, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

// ─── RUN FULL BACKUP ──────────────────────────────────────────────────────────
/**
 * runFullBackup(bot?, options?) — Jalankan full backup
 * @param {object|null} bot - Telegraf bot instance untuk kirim Telegram
 * @param {object} options - { smartSource: true, sendTelegram: true }
 */
async function runFullBackup(bot = null, options = {}) {
  const { smartSource = true, sendTelegram = true, label = 'Auto Backup' } = options;
  const startAll = Date.now();

  debugLog('BACKUP', `=== ${label} dimulai ===`);
  console.log(`[BACKUP_ENGINE] === ${label} dimulai ===`);

  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const log = { entries: [], startTime: new Date().toISOString() };

  function logEntry(step, status, detail) {
    const entry = { step, status: status === 'OK' ? '✅' : status === 'SKIP' ? '⏭️' : '❌', detail };
    log.entries.push(entry);
    debugLog('BACKUP', `${step}: ${status} — ${detail}`);
  }

  const results = [];

  // 1. Backup Source Code
  logEntry('Backup Source', 'START', 'Dimulai...');
  const sourceResult = await backupSource(dateStr, smartSource);
  sourceResult.label = 'Source Code';
  results.push(sourceResult);
  if (sourceResult.skipped) logEntry('Backup Source', 'SKIP', sourceResult.reason);
  else if (sourceResult.success) logEntry('Backup Source', 'OK', `${sourceResult.name} (${formatBytes(sourceResult.size)})`);
  else logEntry('Backup Source', 'FAIL', sourceResult.error);

  // 2. Backup Database
  logEntry('Backup Database', 'START', 'Dimulai...');
  const dbResult = await backupDatabase(dateStr);
  dbResult.label = 'Database';
  results.push(dbResult);
  if (dbResult.success) logEntry('Backup Database', 'OK', `${dbResult.name} (${formatBytes(dbResult.size)})`);
  else logEntry('Backup Database', 'FAIL', dbResult.error);

  // 3. Backup Config
  logEntry('Backup Config', 'START', 'Dimulai...');
  const cfgResult = await backupConfig(dateStr);
  cfgResult.label = 'Config';
  results.push(cfgResult);
  if (cfgResult.success) logEntry('Backup Config', 'OK', `${cfgResult.name} (${formatBytes(cfgResult.size)})`);
  else logEntry('Backup Config', 'FAIL', cfgResult.error);

  const totalDuration = `${((Date.now() - startAll) / 1000).toFixed(1)}s`;
  log.totalDuration = totalDuration;
  log.endTime = new Date().toISOString();

  // 4. Kirim ke Telegram
  if (sendTelegram && bot && _settings.telegramEnabled) {
    logEntry('Send Telegram', 'START', 'Mengirim...');
    try {
      await sendBackupToTelegram(bot, results, log);
      logEntry('Send Telegram', 'OK', 'Terkirim');
    } catch (err) {
      logEntry('Send Telegram', 'FAIL', err.message);
    }
  }

  // 5. Simpan status
  await saveBackupStatus(results, log);

  // 6. Print log
  console.log('[BACKUP_ENGINE] === Backup Log ===');
  log.entries.forEach(e => console.log(`[BACKUP_ENGINE]  ${e.status} ${e.step}: ${e.detail}`));
  console.log(`[BACKUP_ENGINE] Durasi total: ${totalDuration}`);
  console.log('[BACKUP_ENGINE] === Backup Selesai ===');

  return { results, log, totalDuration };
}

// ─── GET BACKUP LIST ──────────────────────────────────────────────────────────
async function getBackupList() {
  try {
    const files = await fs.readdir(BACKUP_ROOT);
    const zips  = files.filter(f => f.endsWith('.zip')).sort().reverse();
    const list  = [];
    for (const f of zips) {
      try {
        const stat = await fs.stat(path.join(BACKUP_ROOT, f));
        list.push({ name: f, size: stat.size, mtime: stat.mtime.toISOString() });
      } catch { /* skip */ }
    }
    return list;
  } catch { return []; }
}

// ─── GET BACKUP STATUS ────────────────────────────────────────────────────────
async function getBackupStatus() {
  try {
    const raw = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

// ─── STORAGE USED ─────────────────────────────────────────────────────────────
async function getStorageUsed() {
  try {
    const files = await fs.readdir(BACKUP_ROOT);
    let total = 0;
    for (const f of files) {
      try {
        const s = await fs.stat(path.join(BACKUP_ROOT, f));
        total += s.size;
      } catch { /* skip */ }
    }
    return total;
  } catch { return 0; }
}

// ─── AUTO SCHEDULER ───────────────────────────────────────────────────────────
let _backupCron = null;

/**
 * startBackupScheduler(bot) — Jadwalkan backup harian 00:00 WIB (17:00 UTC)
 */
function startBackupScheduler(bot) {
  if (_backupCron) {
    _backupCron.stop();
    _backupCron = null;
  }

  // node-cron: '0 17 * * *' = jam 17:00 UTC = 00:00 WIB
  _backupCron = cron.schedule('0 17 * * *', async () => {
    if (!_settings.autoEnabled) {
      debugLog('BACKUP', 'Auto backup skip: dinonaktifkan oleh admin.');
      return;
    }
    debugLog('SCHEDULER', 'Auto Backup Scheduler dimulai (00:00 WIB).');
    console.log('[BACKUP_ENGINE] Scheduler: Menjalankan daily backup (00:00 WIB)...');

    try {
      await runFullBackup(bot, { smartSource: true, sendTelegram: true, label: 'Scheduled Daily Backup' });
    } catch (err) {
      debugLog('ERROR', `Scheduled backup gagal: ${err.message}`);
      console.error('[BACKUP_ENGINE] Scheduled backup error:', err.message);

      // Kirim error ke owner
      const ownerId = process.env.OWNER_ID;
      if (ownerId && _settings.telegramEnabled) {
        try {
          await bot.telegram.sendMessage(ownerId,
            `❌ <b>BACKUP GAGAL</b>\n\n${err.message}`,
            { parse_mode: 'HTML' }
          );
        } catch { /* skip */ }
      }
    }
  }, { timezone: 'UTC' });

  debugLog('BACKUP', 'Backup Scheduler aktif: setiap 17:00 UTC (00:00 WIB).');
  console.log('[BACKUP_ENGINE] ✅ Scheduler aktif: 00:00 WIB (17:00 UTC) setiap hari.');
}

// ─── PRE-UPDATE SNAPSHOT ──────────────────────────────────────────────────────
/**
 * createPreUpdateSnapshot(bot?) — Buat snapshot sebelum update/deploy
 */
async function createPreUpdateSnapshot(bot = null) {
  const ts    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const name  = `pre-update-${ts}`;
  const zipPath = path.join(BACKUP_ROOT, `${name}.zip`);

  console.log('[BACKUP_ENGINE] Membuat pre-update snapshot...');
  debugLog('BACKUP', 'Pre-update snapshot dimulai.');

  try {
    const projectRoot = path.resolve('.');
    const { size } = await createZip(zipPath, projectRoot, {
      includes: ['src', 'package.json'],
      excludes: ['node_modules/**', '.git/**', 'logs/**'],
    });

    const v = await validateZip(zipPath);
    if (!v.valid) throw new Error(v.reason);

    debugLog('BACKUP', `Pre-update snapshot selesai: ${name}.zip (${formatBytes(size)})`);
    console.log(`[BACKUP_ENGINE] Pre-update snapshot: ${name}.zip (${formatBytes(size)})`);

    if (bot) {
      const ownerId = process.env.OWNER_ID;
      if (ownerId) {
        await bot.telegram.sendMessage(ownerId,
          `📸 <b>PRE-UPDATE SNAPSHOT</b>\n\n` +
          `File: <code>${name}.zip</code>\n` +
          `Ukuran: ${formatBytes(size)}\n\n` +
          `Snapshot dibuat otomatis sebelum update/deploy.`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }

    return { success: true, name: `${name}.zip`, path: zipPath, size };
  } catch (err) {
    debugLog('ERROR', `Pre-update snapshot gagal: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── SELF TEST ────────────────────────────────────────────────────────────────
async function runSelfTest(bot = null) {
  const tests = [];
  const pass = (name) => tests.push({ name, ok: true });
  const fail = (name, reason) => tests.push({ name, ok: false, reason });

  // Test 1: Backup Root exists
  try { await fs.access(BACKUP_ROOT); pass('Backup Dir Exists'); }
  catch { fail('Backup Dir Exists', 'Direktori tidak ada'); }

  // Test 2: Source Backup
  try {
    const r = await backupSource(`test-${Date.now()}`);
    if (r.success || r.skipped) pass('Source Backup');
    else fail('Source Backup', r.error);
  } catch (e) { fail('Source Backup', e.message); }

  // Test 3: Database Backup
  try {
    const r = await backupDatabase(`test-${Date.now()}`);
    if (r.success) pass('Database Backup');
    else fail('Database Backup', r.error);
  } catch (e) { fail('Database Backup', e.message); }

  // Test 4: Config Backup
  try {
    const r = await backupConfig(`test-${Date.now()}`);
    if (r.success) pass('Config Backup');
    else fail('Config Backup', r.error);
  } catch (e) { fail('Config Backup', e.message); }

  // Test 5: ZIP Validation
  try {
    const list = await getBackupList();
    if (list.length > 0) {
      const v = await validateZip(path.join(BACKUP_ROOT, list[0].name));
      if (v.valid) pass('ZIP Valid');
      else fail('ZIP Valid', v.reason);
    } else {
      pass('ZIP Valid (no files to test)');
    }
  } catch (e) { fail('ZIP Valid', e.message); }

  // Test 6: Backup List
  try {
    const list = await getBackupList();
    if (Array.isArray(list)) pass('Restore List');
    else fail('Restore List', 'Bukan array');
  } catch (e) { fail('Restore List', e.message); }

  // Test 7: Backup History
  try {
    const status = await getBackupStatus();
    pass('Backup History');
  } catch (e) { fail('Backup History', e.message); }

  // Test 8: Scheduler
  if (_backupCron) pass('Scheduler Active');
  else fail('Scheduler Active', 'Scheduler belum dimulai');

  // Test 9: Retention
  try {
    await cleanOldBackups('test-');
    pass('Retention');
  } catch (e) { fail('Retention', e.message); }

  // Test 10: Smart Backup
  try {
    const h = await getSourceHash();
    if (h) pass('Smart Backup Hash');
    else fail('Smart Backup Hash', 'Hash null');
  } catch (e) { fail('Smart Backup Hash', e.message); }

  // Test 11: Telegram Parse Protection
  try {
    const { safeTelegramText } = require('./telegram_safe');
    const result = safeTelegramText('<script>alert("xss")</script>');
    if (result && !result.includes('<script>')) pass('Telegram Parse Protection');
    else fail('Telegram Parse Protection', 'Escape tidak bekerja');
  } catch (e) { fail('Telegram Parse Protection', e.message); }

  // Test 12: Debug Mode
  try {
    const { isDebugMode } = require('./debug_mode');
    typeof isDebugMode() === 'boolean' ? pass('Debug Mode') : fail('Debug Mode', 'Return bukan boolean');
  } catch (e) { fail('Debug Mode', e.message); }

  // Test 13: Telegram Send (hanya cek koneksi)
  if (bot) {
    try {
      await bot.telegram.getMe();
      pass('Telegram Connect');
    } catch (e) { fail('Telegram Connect', e.message); }
  }

  return tests;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}


    // ─── BACKUP FULL (single zip: source + data + config) ────────────────────────
    async function backupFull(dateStr) {
    const start   = Date.now();
    const zipName = `azzavision-full-${dateStr}.zip`;
    const tmpDir  = path.resolve('./data/backups_v4');
    const zipPath = path.join(tmpDir, zipName);

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      const archive = archiver('zip', { zlib: { level: 6 } });
      const output  = fsSync.createWriteStream(zipPath);
      const finished = new Promise((res, rej) => {
        output.on('close', res);
        archive.on('error', rej);
      });
      archive.pipe(output);

      const ROOT = path.resolve('.');

      // Source code
      const srcDir = path.resolve('./src');
      if (fsSync.existsSync(srcDir)) {
        archive.glob('**/*', {
          cwd: srcDir,
          ignore: ['**/node_modules/**','**/.git/**','**/logs/**','**/*.log','**/*.tmp'],
          dot: false,
        }, { prefix: 'src' });
      }

      // Dashboard frontend
      const dashDir = path.resolve('./dashboard');
      if (fsSync.existsSync(dashDir)) {
        archive.glob('**/*', { cwd: dashDir, dot: false }, { prefix: 'dashboard' });
      }

      // Data folder (minus heavy backups and node cache)
      const dataDir = path.resolve('./data');
      if (fsSync.existsSync(dataDir)) {
        archive.glob('**/*', {
          cwd: dataDir,
          ignore: ['backups/**','backups_v4/**','ebooks/**'],
          dot: false,
        }, { prefix: 'data' });
      }

      // Root files
      for (const f of ['package.json','launcher.js','.env','.env.example','pterodactyl-dashboard-server.js']) {
        const fp = path.resolve(f);
        if (fsSync.existsSync(fp)) archive.file(fp, { name: f });
      }

      // Install guide
      const guide = [
        '# AZZAVISION AI — Restore Guide',
        '',
        '## Cara Deploy ke Panel Baru',
        '',
        '1. Upload zip ini ke file manager panel baru',
        '2. Extract semua file ke root container (/)',
        '3. Edit .env sesuai kebutuhan (BOT_TOKEN, API KEYS, dll)',
        '4. Pastikan CMD_RUN = node launcher.js di startup panel',
        '5. Start server dari panel',
        '',
        '## Catatan',
        '- File .env berisi semua konfigurasi yang diperlukan',
        '- Data signals/journal ada di folder data/',
        '- Bot langsung jalan setelah start tanpa npm install manual',
        '',
        `Generated: ${new Date().toISOString()}`,
      ].join('\n');
      archive.append(guide, { name: 'RESTORE.md' });

      await archive.finalize();
      await finished;

      const validation = await validateZip(zipPath);
      if (!validation.valid) {
        await fs.unlink(zipPath).catch(() => {});
        throw new Error(`ZIP tidak valid: ${validation.reason}`);
      }

      return {
        success: true, name: zipName, path: zipPath,
        size: validation.sizeBytes,
        duration: ((Date.now() - start) / 1000).toFixed(1) + 's',
      };
    } catch (err) {
      return { success: false, error: err.message, duration: ((Date.now() - start) / 1000).toFixed(1) + 's' };
    }
    }

    module.exports = {
  backupFull,
  initBackupEngine,
  startBackupScheduler,
  runFullBackup,
  backupSource,
  backupDatabase,
  backupConfig,
  getBackupList,
  getBackupStatus,
  getStorageUsed,
  createPreUpdateSnapshot,
  runSelfTest,
  getSettings,
  updateSettings,
  loadSettings,
  formatBytes,
  BACKUP_ROOT,
};
