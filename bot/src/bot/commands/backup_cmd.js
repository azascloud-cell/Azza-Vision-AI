/**
 * backup_cmd.js — Backup Commands untuk AZZAVISION AI v4.0
 *
 * Commands:
 *   /backup               — Full backup sekarang
 *   /backup source        — Backup source saja
 *   /backup data          — Backup database saja
 *   /backup config        — Backup config saja
 *   /backup on            — Aktifkan auto backup
 *   /backup off           — Nonaktifkan auto backup
 *   /backup auto          — Set mode auto
 *   /backup manual        — Set mode manual
 *   /backup telegram on   — Aktifkan kirim ke Telegram
 *   /backup telegram off  — Nonaktifkan kirim ke Telegram
 *   /backupstatus         — Status backup terakhir
 *   /backuphistory        — Daftar backup tersimpan
 *   /restorelist          — Sama seperti backuphistory
 *
 * AZZAVISION AI v4.0
 */

const {
  runFullBackup,
  backupSource,
  backupDatabase,
  backupConfig,
  getBackupList,
  getBackupStatus,
  getStorageUsed,
  runSelfTest,
  getSettings,
  updateSettings,
  formatBytes,
  BACKUP_ROOT,
  backupFull,
} = require('../../utils/backup_engine');
const { debugLog } = require('../../utils/debug_mode');
const { toWIB }   = require('../../utils/wib_time');
const { renderBanner } = require('../../banner');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
function formatResultLine(r) {
  if (r.skipped) return `⏭️ <b>${r.label}:</b> Dilewati (${r.reason})`;
  if (r.success) return `✅ <b>${r.label}:</b> ${r.name}\n   📏 ${formatBytes(r.size)} | ⏱️ ${r.duration}`;
  return `❌ <b>${r.label}:</b> GAGAL — ${r.error || 'unknown error'}`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  try {
    const wib = toWIB(new Date(isoStr));
    return `${wib.dateNum} ${wib.month} ${wib.year} ${wib.hours}:${wib.minutes} WIB`;
  } catch { return isoStr; }
}

function formatNextBackup(isoStr) {
  if (!isoStr) return 'Setiap 00:00 WIB';
  try {
    const d = new Date(isoStr);
    const wib = toWIB(d);
    return `${wib.dateNum} ${wib.month} ${wib.year} ${wib.hours}:${wib.minutes} WIB`;
  } catch { return '00:00 WIB setiap hari'; }
}

// ─── /backup COMMAND ──────────────────────────────────────────────────────────
async function handleBackup(ctx, bot) {
  if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

  const args  = (ctx.message?.text || '').split(/\s+/).slice(1);
  const sub   = (args[0] || '').toLowerCase();
  const sub2  = (args[1] || '').toLowerCase();


    // /backup full — satu file ZIP berisi semua (source + data + config + dashboard)
    if (sub === 'full') {
      const loadMsg = await ctx.replyWithHTML('📦 <b>Membuat Full Backup...</b>\n<i>Proses 30–90 detik, harap tunggu.</i>');
      try {
        const wib     = toWIB();
        const dateStr = `${wib.year}-${String(wib.monthNum).padStart(2,'0')}-${String(wib.dateNum).padStart(2,'0')}`;
        const r = await backupFull(dateStr);
        if (!r.success) throw new Error(r.error);

        const caption = [
          '📦 <b>AZZAVISION AI — Full Backup</b>',
          '',
          `📅 <b>Tanggal:</b> ${dateStr}`,
          `📏 <b>Ukuran:</b> ${formatBytes(r.size)}`,
          `⏱️ <b>Durasi:</b> ${r.duration}`,
          '',
          '✅ Berisi: Source + Data + Config + Dashboard',
          '📋 Baca <b>RESTORE.md</b> di dalam ZIP untuk cara deploy ke panel baru',
        ].join('\n');

        const fsNode = require('fs');
        await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
        await ctx.replyWithDocument(
          { source: fsNode.createReadStream(r.path), filename: r.name },
          { caption, parse_mode: 'HTML' }
        );
      } catch (err) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, undefined,
          `❌ <b>Full Backup Gagal:</b>\n<code>${err.message}</code>`, { parse_mode: 'HTML' }).catch(() => {});
      }
      return;
    }
    
  // /backup on/off/auto/manual/telegram
  if (sub === 'on') {
    updateSettings({ autoEnabled: true });
    return ctx.replyWithHTML('✅ <b>Auto Backup:</b> Diaktifkan.');
  }
  if (sub === 'off') {
    updateSettings({ autoEnabled: false });
    return ctx.replyWithHTML('⛔ <b>Auto Backup:</b> Dinonaktifkan.');
  }
  if (sub === 'auto') {
    updateSettings({ mode: 'auto', autoEnabled: true });
    return ctx.replyWithHTML('🔄 <b>Mode:</b> Auto backup aktif.');
  }
  if (sub === 'manual') {
    updateSettings({ mode: 'manual', autoEnabled: false });
    return ctx.replyWithHTML('🔧 <b>Mode:</b> Manual — auto backup nonaktif.');
  }
  if (sub === 'telegram') {
    if (sub2 === 'on') {
      updateSettings({ telegramEnabled: true });
      return ctx.replyWithHTML('✅ <b>Telegram Send:</b> Diaktifkan.');
    }
    if (sub2 === 'off') {
      updateSettings({ telegramEnabled: false });
      return ctx.replyWithHTML('⛔ <b>Telegram Send:</b> Dinonaktifkan.');
    }
    return ctx.replyWithHTML('❓ Gunakan: /backup telegram on atau /backup telegram off');
  }

  // /backup source | data | config
  if (sub === 'source') {
    const msg = await ctx.replyWithHTML('⏳ <b>Backup source code...</b>');
    const dateStr = new Date().toISOString().slice(0, 10);
    const r = await backupSource(dateStr, false);
    r.label = 'Source Code';
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
      formatResultLine(r), { parse_mode: 'HTML' }).catch(() => {});
    debugLog('BACKUP', `/backup source oleh owner: ${r.success ? r.name : r.error}`);
    return;
  }

  if (sub === 'data') {
    const msg = await ctx.replyWithHTML('⏳ <b>Backup database...</b>');
    const dateStr = new Date().toISOString().slice(0, 10);
    const r = await backupDatabase(dateStr);
    r.label = 'Database';
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
      formatResultLine(r), { parse_mode: 'HTML' }).catch(() => {});
    debugLog('BACKUP', `/backup data oleh owner: ${r.success ? r.name : r.error}`);
    return;
  }

  if (sub === 'config') {
    const msg = await ctx.replyWithHTML('⏳ <b>Backup config...</b>');
    const dateStr = new Date().toISOString().slice(0, 10);
    const r = await backupConfig(dateStr);
    r.label = 'Config';
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
      formatResultLine(r), { parse_mode: 'HTML' }).catch(() => {});
    debugLog('BACKUP', `/backup config oleh owner: ${r.success ? r.name : r.error}`);
    return;
  }

  // /backup — full backup
  const loadingMsg = await ctx.replyWithHTML('⏳ <b>Menjalankan full backup...</b>\n\n<i>Ini bisa memakan beberapa detik.</i>');

  try {
    const { results, log, totalDuration } = await runFullBackup(bot, {
      smartSource: false,   // manual backup: force backup source
      sendTelegram: false,  // jangan kirim dua kali (sudah di sini)
      label: 'Manual Backup (/backup)',
    });

    const lines = [
      `📦 <b>MANUAL BACKUP SELESAI</b>`,
      ``,
      ...results.map(formatResultLine),
      ``,
      `⏱️ Total: ${totalDuration}`,
    ];

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      lines.join('\n'), { parse_mode: 'HTML' }).catch(() => {});

    try {
      const buffer = await renderBanner('backup', {
        rows: results.map(r => ({
          label: r.label,
          value: r.skipped ? 'Dilewati' : r.success ? formatBytes(r.size) : 'GAGAL',
          color: r.skipped ? undefined : r.success ? '#2ECC71' : '#F14158',
        })),
      });
      await ctx.replyWithPhoto({ source: buffer });
    } catch (bannerErr) {
      console.error('[BACKUP-BANNER] Gagal render banner:', bannerErr.message);
    }

    // Kirim file ZIP ke owner
    for (const r of results) {
      if (!r.success || r.skipped) continue;
      if (r.size > 50 * 1024 * 1024) {
        await ctx.replyWithHTML(`ℹ️ ${r.name} terlalu besar (${formatBytes(r.size)}) untuk dikirim via Telegram.`);
        continue;
      }
      try {
        await ctx.telegram.sendDocument(ctx.chat.id, {
          source: r.path,
          filename: r.name,
        }, { caption: `📦 ${r.label}` });
      } catch (e) {
        await ctx.replyWithHTML(`⚠️ Gagal kirim ${r.name}: ${e.message}`);
      }
    }
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `❌ <b>Backup gagal:</b>\n<code>${err.message}</code>`, { parse_mode: 'HTML' }).catch(() => {});
  }
}

// ─── /backupstatus ────────────────────────────────────────────────────────────
async function handleBackupStatus(ctx) {
  if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

  try {
    const status  = await getBackupStatus();
    const storage = await getStorageUsed();
    const settings = getSettings();

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 <b>BACKUP STATUS</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    if (status) {
      const allOk = status.allValid ? '✅ OK' : '⚠️ PARTIAL';
      lines.push(`🕐 Last Backup  : ${formatDateTime(status.timestamp)}`);
      lines.push(`⏰ Next Backup  : ${formatNextBackup(status.nextBackup)}`);
      lines.push(`💾 Storage Used : ${formatBytes(storage)}`);
      lines.push(`🗂️ Retention    : Max 14 backup`);
      lines.push(`📋 Status       : ${allOk}`);
      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`⚙️ <b>PENGATURAN</b>`);
      lines.push(`Auto Backup : ${settings.autoEnabled ? '✅ ON' : '⛔ OFF'}`);
      lines.push(`Mode        : ${settings.mode}`);
      lines.push(`Telegram    : ${settings.telegramEnabled ? '✅ ON' : '⛔ OFF'}`);
      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`<b>Hasil Backup Terakhir:</b>`);
      (status.results || []).forEach(r => {
        if (r.skipped) lines.push(`  ⏭️ ${r.label}: Dilewati`);
        else if (r.success) lines.push(`  ✅ ${r.label}: ${r.name || '-'} (${formatBytes(r.size)})`);
        else lines.push(`  ❌ ${r.label}: GAGAL`);
      });
    } else {
      lines.push(`⚠️ Belum ada backup tercatat.`);
      lines.push(`Jalankan /backup untuk backup pertama.`);
      lines.push(`💾 Storage Used : ${formatBytes(storage)}`);
    }

    lines.push(``, `━━━━━━━━━━━━━━━━━━━━`);
    await ctx.replyWithHTML(lines.join('\n'));
  } catch (err) {
    await ctx.replyWithHTML(`❌ <b>Gagal cek status:</b>\n<code>${err.message}</code>`);
  }
}

// ─── /backuphistory & /restorelist ────────────────────────────────────────────
async function handleBackupHistory(ctx) {
  if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

  try {
    const list = await getBackupList();

    if (list.length === 0) {
      return ctx.replyWithHTML([
        `━━━━━━━━━━━━━━━━━━━━`,
        `📂 <b>BACKUP HISTORY</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `⚠️ Belum ada backup tersimpan.`,
        `Jalankan /backup untuk mulai backup.`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n'));
    }

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `📂 <b>BACKUP HISTORY (${list.length} file)</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ];

    // Kelompokkan per tanggal
    const byDate = {};
    list.forEach(f => {
      const date = f.name.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'lain-lain';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(f);
    });

    for (const [date, files] of Object.entries(byDate)) {
      lines.push(`📅 <b>${date}</b>`);
      files.forEach(f => {
        const icon = f.name.includes('source') ? '📁'
                   : f.name.includes('data')   ? '💾'
                   : f.name.includes('config')  ? '⚙️'
                   : f.name.includes('pre-update') ? '📸'
                   : '📦';
        lines.push(`  ${icon} <code>${f.name}</code>`);
        lines.push(`     ${formatBytes(f.size)} — ${formatDateTime(f.mtime)}`);
      });
      lines.push('');
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💡 <i>Gunakan /backupstatus untuk detail status.</i>`);

    await ctx.replyWithHTML(lines.join('\n'));
  } catch (err) {
    await ctx.replyWithHTML(`❌ <b>Gagal ambil history:</b>\n<code>${err.message}</code>`);
  }
}

// ─── /selftest ────────────────────────────────────────────────────────────────
async function handleSelfTest(ctx, bot) {
  if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

  const loadingMsg = await ctx.replyWithHTML('⏳ <b>Menjalankan Self Test...</b>');

  try {
    const tests = await runSelfTest(bot);
    const pass  = tests.filter(t => t.ok).length;
    const fail  = tests.filter(t => !t.ok).length;

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔬 <b>SELF TEST RESULT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${pass === tests.length ? '✅' : '⚠️'} ${pass}/${tests.length} tests passed`,
      ``,
    ];

    tests.forEach(t => {
      lines.push(t.ok
        ? `✅ ${t.name}`
        : `❌ ${t.name}: ${t.reason}`
      );
    });

    lines.push('', `━━━━━━━━━━━━━━━━━━━━`);
    if (fail > 0) {
      lines.push(`⚠️ ${fail} test gagal. Cek log untuk detail.`);
    } else {
      lines.push(`🎉 Semua test PASS! Sistem siap.`);
    }

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      lines.join('\n'), { parse_mode: 'HTML' }).catch(() => {});
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `❌ <b>Self test error:</b>\n<code>${err.message}</code>`, { parse_mode: 'HTML' }).catch(() => {});
  }
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
function registerBackupCommands(bot) {
  // /backup dan semua sub-command
  bot.command('backup', (ctx) => handleBackup(ctx, bot));

  // /backupstatus
  bot.command('backupstatus', handleBackupStatus);

  // /backuphistory
  bot.command('backuphistory', handleBackupHistory);

  // /restorelist — alias untuk backuphistory
  bot.command('restorelist', handleBackupHistory);

  // /selftest
  bot.command('selftest', (ctx) => handleSelfTest(ctx, bot));

  console.log('[BACKUP_CMD] ✅ Backup commands registered: /backup /backupstatus /backuphistory /restorelist /selftest');
}

module.exports = { registerBackupCommands };
