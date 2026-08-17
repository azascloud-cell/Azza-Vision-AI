/**
 * debug_cmd.js — Developer Debug Mode Commands
 *
 * /debug on   — Aktifkan debug mode
 * /debug off  — Nonaktifkan debug mode
 * /debug log  — Tampilkan 50 baris terakhir debug.log
 * /debug clear — Kosongkan debug.log
 * /debug status — Status debug mode
 *
 * AZZAVISION AI v4.0
 */

const {
  isDebugMode,
  setDebugMode,
  getDebugLog,
  clearDebugLog,
  getDebugLogSize,
} = require('../../utils/debug_mode');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

async function handleDebug(ctx) {
  if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

  const args = (ctx.message?.text || '').split(/\s+/).slice(1);
  const sub  = (args[0] || '').toLowerCase();

  if (sub === 'on') {
    setDebugMode(true);
    return ctx.replyWithHTML([
      `🔧 <b>DEBUG MODE: ON</b>`,
      ``,
      `Semua aktivitas penting akan di-log ke:`,
      `<code>logs/debug.log</code>`,
      ``,
      `Gunakan /debug log untuk melihat log.`,
      `Gunakan /debug off untuk menonaktifkan.`,
    ].join('\n'));
  }

  if (sub === 'off') {
    setDebugMode(false);
    return ctx.replyWithHTML([
      `⛔ <b>DEBUG MODE: OFF</b>`,
      ``,
      `Logging dihentikan.`,
      `Log terakhir tetap tersimpan di <code>logs/debug.log</code>`,
    ].join('\n'));
  }

  if (sub === 'log') {
    const logContent = getDebugLog(50);
    const sizKB      = getDebugLogSize();
    const truncated  = logContent.length > 3500 ? logContent.slice(-3500) : logContent;
    return ctx.replyWithHTML([
      `📋 <b>DEBUG LOG (50 baris terakhir)</b>`,
      `📏 Ukuran: ${sizKB} KB`,
      ``,
      `<pre>${truncated.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    ].join('\n'));
  }

  if (sub === 'clear') {
    const ok = clearDebugLog();
    return ctx.replyWithHTML(ok
      ? `🗑️ <b>Debug log dihapus.</b>`
      : `❌ Gagal hapus debug log.`
    );
  }

  // /debug atau /debug status — tampilkan status
  const mode   = isDebugMode();
  const sizKB  = getDebugLogSize();
  return ctx.replyWithHTML([
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔧 <b>DEVELOPER DEBUG MODE</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Status  : ${mode ? '🟢 <b>ON</b>' : '🔴 <b>OFF</b>'}`,
    `Log Size: <code>${sizKB} KB</code>`,
    `Log File: <code>logs/debug.log</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>Perintah:</b>`,
    `/debug on     — Aktifkan`,
    `/debug off    — Nonaktifkan`,
    `/debug log    — Lihat 50 baris terakhir`,
    `/debug clear  — Hapus log`,
    ``,
    `<b>Kategori log:</b>`,
    `[CALLBACK] [AI_REQUEST] [AI_RESPONSE]`,
    `[EXPORT] [SIGNAL] [TRADE] [SCHEDULER]`,
    `[BACKUP] [ERROR] [INFO] [SCAN]`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
  ].join('\n'));
}

function registerDebugModeCommands(bot) {
  bot.command('debug', handleDebug);
  console.log('[DEBUG_CMD] ✅ Debug commands registered: /debug');
}

module.exports = { registerDebugModeCommands };
