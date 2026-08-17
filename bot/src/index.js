const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

require('dotenv').config({ override: false });

const { debugLog, isDebugMode }   = require('./utils/debug_mode');
const { createBot, registeredActions, registeredCommands } = require('./bot');
const { startScanner }            = require('./analysis/scanner');
const { setStartTime }            = require('./bot/commands/status');
const { autoRetrain }             = require('./analysis/learning');
const { initBackupDir, runDailyBackups } = require('./utils/backup');
const { initBackupEngine, startBackupScheduler, runFullBackup } = require('./utils/backup_engine');
const { init: initKeyManager }    = require('./market/key_manager');
const { scheduleDailyLearning }  = require('./bot/commands/learning_mode');
const { loadChannelId }           = require('./utils/channel_store');
const { runCallbackValidation }  = require('./bot/debug/callback_validator');
const { startReportScheduler }   = require('./scheduler/report_scheduler');
const { checkAndMarkStartup, notifyCrashRecovery, registerShutdownHooks } = require('./utils/crash_guard');
const { startTradeScannerScheduler } = require('./analysis/trade_scanner');
const { checkAPIHealth }          = require('./utils/api_health');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('[FATAL] BOT_TOKEN belum di-set. Cek file .env kamu.');
  process.exit(1);
}

const hasMultiKeys = !!process.env.TWELVE_DATA_KEYS;
const hasSingleKey = !!process.env.TWELVEDATA_API_KEY;
if (!hasMultiKeys && !hasSingleKey) {
  console.warn('[WARN] TWELVEDATA_API_KEY / TWELVE_DATA_KEYS belum di-set.');
}

if (!process.env.CHANNEL_ID) {
  console.warn('[WARN] CHANNEL_ID belum di-set. Sinyal tidak akan dikirim ke channel.');
}

const startTs = Date.now();
setStartTime(startTs);

const bot = createBot(BOT_TOKEN);

async function main() {
  const interval    = parseInt(process.env.SCAN_INTERVAL     || '6000');
  const cooldownH   = parseInt(process.env.SIGNAL_COOLDOWN_H || '4');
  const minConf     = parseInt(process.env.MIN_CONFIDENCE    || '65');
  const ensembleMin = parseInt(process.env.ENSEMBLE_MIN_SCORE || '75');
  const entryMode   = process.env.ENTRY_MODE || 'aggressive';

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ⚡  AZZAVISION AI v5.0 — AI Trade Scanner + Multi-AI Engine');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  📡 Price Tick       : ${interval / 1000}s`);
  console.log(`  🎯 Min Confidence   : ${minConf}%`);
  console.log(`  🏆 Ensemble Min     : ${ensembleMin}/100`);
  console.log(`  🔒 Signal Cooldown  : ${cooldownH} jam`);
  console.log(`  📢 Channel          : ${process.env.CHANNEL_ID || 'not configured'}`);
  console.log(`  💾 Database         : ${process.env.DB_PATH    || './data/signals.json'}`);
  console.log(`  🏦 MM Engine        : Broker-Aware (HFM, Exness, XM, IC Markets, FBS)`);
  console.log(`  🆕 MM Commands      : /balance /risk /broker /lot /profile`);
  console.log(`  🔍 Debug Commands   : /callbackcheck /callbacklog /buttonhealth /debug`);
  console.log(`  📊 Report Commands  : /dailyreport /weeklyreport /report /reporthistory`);
  console.log(`  📰 News v5.0        : Kategori + Weighted Scoring + AI Verdict`);
  console.log(`  💾 Backup v5.0      : /backup /backupstatus /backuphistory /restorelist`);
  console.log(`  🔬 Self Test        : /selftest`);
  console.log(`  🔭 Trade Scanner    : /scan short | /scan medium | /scan long`);
  console.log(`  🤖 AI Engine        : Gemini → OpenRouter → Groq → Offline AI`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // ── Crash Guard: baca state shutdown sebelumnya SEBELUM tulis marker startup ──
  const crashInfo = await checkAndMarkStartup();

  await loadChannelId();
  await initBackupDir();            // backup lama (JSON snapshots)
  await initBackupEngine();         // backup engine v5.0 (ZIP)
  await initKeyManager();

  debugLog('STARTUP', 'AZZAVISION AI v5.0 startup dimulai.');

  // ── API Health Check saat startup ────────────────────────────────────────────
  console.log('[STARTUP] Menjalankan API health check...');
  checkAPIHealth().then(results => {
    for (const r of results) {
      const status = r.ok ? '✅' : '❌';
      console.log(`[API-HEALTH] ${status} ${r.provider.toUpperCase()} — ${r.message}`);
    }
  }).catch(e => console.warn('[API-HEALTH] Health check error:', e.message));

  // ── Crash Recovery: kirim notif jika shutdown sebelumnya abnormal ─────────────
  if (crashInfo.wasAbnormal) {
    setTimeout(async () => {
      try {
        await notifyCrashRecovery(bot, crashInfo);
      } catch (err) {
        console.error('[STARTUP] Crash recovery notify gagal:', err.message);
      }
    }, 5000);
  }

  console.log('[STARTUP] Menjalankan auto retrain...');
  await autoRetrain();

  console.log('[STARTUP] Membuat daily backup (JSON snapshots)...');
  await runDailyBackups();

  // ── Old-style JSON backup interval (backward compat) ─────────────────────────
  setInterval(async () => {
    debugLog('SCHEDULER', 'JSON daily backup terjadwal.');
    console.log('[BACKUP] Menjalankan daily JSON backup terjadwal...');
    await runDailyBackups();
  }, 24 * 60 * 60 * 1000);

  scheduleDailyLearning(bot);
  startScanner(bot);

  await bot.launch({ allowedUpdates: ['message', 'callback_query'] });
  console.log('[BOT] ✅ Launched dan polling untuk update Telegram.');
  debugLog('STARTUP', 'Bot Telegram launched.');

  // ── v5.0 Auto Performance Report Scheduler ────────────────────────────────
  startReportScheduler(bot);
  console.log('[SCHEDULER] ✅ Report Scheduler v5.0 aktif (daily + weekly).');

  // ── v5.0 Backup Engine Scheduler ─────────────────────────────────────────
  startBackupScheduler(bot);
  console.log('[SCHEDULER] ✅ Backup Engine Scheduler aktif (00:00 WIB).');

  // ── v5.0 Trade Scanner AI Scheduler ──────────────────────────────────────
  startTradeScannerScheduler(bot);
  console.log('[SCHEDULER] ✅ Trade Scanner AI aktif (SHORT/MEDIUM/LONG).');

  // ── Register graceful shutdown hooks (Crash Guard) ────────────────────────
  registerShutdownHooks(bot);

  // ── Callback Validator (setelah 3 detik) ──────────────────────────────────
  setTimeout(async () => {
    console.log('[VALIDATOR] Menjalankan validasi callback & command...');
    debugLog('STARTUP', 'Callback validator dimulai.');
    await runCallbackValidation(bot, registeredActions, registeredCommands);
  }, 3000);
}

main().catch((err) => {
  console.error('[FATAL] Gagal start bot:', err.message);
  debugLog('ERROR', `FATAL startup: ${err.message}\n${err.stack}`);
  process.exit(1);
});
