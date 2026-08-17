/**
 * report_cmd.js — Report Management Commands v4.0
 *
 * /setreportchannel <id>  — Set channel khusus untuk report
 * /report on              — Aktifkan report otomatis
 * /report off             — Matikan report otomatis
 * /report daily           — Hanya kirim daily report
 * /report weekly          — Hanya kirim weekly report
 * /report both            — Kirim keduanya (default)
 * /report now             — Kirim daily report sekarang
 * /report status          — Lihat status report
 * /dailyreport            — Tampilkan daily report hari ini
 * /dailyreport YYYY-MM-DD — Tampilkan daily report tanggal tertentu
 * /weeklyreport           — Tampilkan weekly report minggu ini
 * /weeklyreport last      — Tampilkan weekly report dari history
 * /reporthistory          — Daftar 10 report terakhir
 */

'use strict';

const { getReportSettings, saveReportSettings,
        getDailyReport, getLatestWeeklyReport,
        getRecentDailyHistory } = require('../../database/report_store');
const { getExtendedDailyStats, getExtendedWeeklyStats } = require('../../database/db_extended');
const { runDailyReport, runWeeklyReport,
        formatDailyReportV4, formatWeeklyReportV4,
        getAIDailyInsight, getAIWeeklyReview } = require('../../scheduler/report_scheduler');
const { todayWIB, toWIB } = require('../../utils/wib_time');
const { isOwner }         = require('./owner');
const { renderBanner }    = require('../../banner');

// ─── VALIDATE DATE FORMAT ─────────────────────────────────────────────────────
function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

// ─── REGISTER ALL REPORT COMMANDS ────────────────────────────────────────────
function registerReportCommands(bot) {

  // ── /setreportchannel ────────────────────────────────────────────────────────
  bot.command('setreportchannel', async (ctx) => {
    if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

    const parts     = ctx.message.text.trim().split(/\s+/);
    const channelId = parts[1]?.trim();

    if (!channelId) {
      const settings = await getReportSettings();
      return ctx.replyWithHTML(
        `⚙️ <b>Report Channel</b>\n\n` +
        `📡 Channel sekarang: <code>${settings.reportChannelId || process.env.CHANNEL_ID || '(belum diset)'}</code>\n\n` +
        `Cara pakai:\n<code>/setreportchannel @namaChannel</code>\n<code>/setreportchannel -100xxxxxxxxxx</code>`
      );
    }

    const isValid = channelId.startsWith('@') || (channelId.startsWith('-') && !isNaN(channelId));
    if (!isValid) {
      return ctx.replyWithHTML(`❌ Format tidak valid. Gunakan <code>@channel</code> atau <code>-100xxxxxxx</code>`);
    }

    const settings = await getReportSettings();
    settings.reportChannelId = channelId;
    await saveReportSettings(settings);

    await ctx.replyWithHTML(
      `✅ <b>Report channel diset!</b>\n\n📡 Channel: <code>${channelId}</code>\n\n` +
      `Report otomatis akan dikirim ke channel ini.\n` +
      `<i>Channel sinyal tidak berubah.</i>`
    );
  });

  // ── /report ──────────────────────────────────────────────────────────────────
  bot.command('report', async (ctx) => {
    if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

    const parts  = ctx.message.text.trim().split(/\s+/);
    const sub    = parts[1]?.toLowerCase();
    const settings = await getReportSettings();

    // Status (no subcommand)
    if (!sub || sub === 'status') {
      const ch     = settings.reportChannelId || process.env.CHANNEL_ID || '(belum diset)';
      const mode   = settings.mode || 'both';
      const status = settings.enabled && mode !== 'off' ? '🟢 AKTIF' : '🔴 MATI';

      return ctx.replyWithHTML([
        `━━━━━━━━━━━━━━━━━━━━`,
        `📊 <b>REPORT STATUS</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${status}`,
        `📡 Channel   : <code>${ch}</code>`,
        `📋 Mode      : <b>${mode.toUpperCase()}</b>`,
        ``,
        `🕐 Daily    : setiap 00:00 WIB`,
        `🕐 Weekly   : setiap Sabtu 00:00 WIB`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `<b>Commands:</b>`,
        `<code>/report on</code> — aktifkan`,
        `<code>/report off</code> — matikan`,
        `<code>/report daily</code> — hanya daily`,
        `<code>/report weekly</code> — hanya weekly`,
        `<code>/report both</code> — keduanya`,
        `<code>/report now</code> — kirim sekarang`,
      ].join('\n'));
    }

    if (sub === 'on') {
      settings.enabled = true;
      if (!settings.mode || settings.mode === 'off') settings.mode = 'both';
      await saveReportSettings(settings);
      return ctx.replyWithHTML(`✅ <b>Report otomatis diaktifkan.</b>\nMode: <code>${settings.mode}</code>`);
    }

    if (sub === 'off') {
      settings.enabled = false;
      settings.mode    = 'off';
      await saveReportSettings(settings);
      return ctx.replyWithHTML(`🔴 <b>Report otomatis dimatikan.</b>`);
    }

    if (sub === 'daily') {
      settings.enabled = true;
      settings.mode    = 'daily';
      await saveReportSettings(settings);
      return ctx.replyWithHTML(`✅ Mode diset ke <b>DAILY ONLY</b>.\nReport dikirim setiap 00:00 WIB.`);
    }

    if (sub === 'weekly') {
      settings.enabled = true;
      settings.mode    = 'weekly';
      await saveReportSettings(settings);
      return ctx.replyWithHTML(`✅ Mode diset ke <b>WEEKLY ONLY</b>.\nReport dikirim setiap Sabtu 00:00 WIB.`);
    }

    if (sub === 'both') {
      settings.enabled = true;
      settings.mode    = 'both';
      await saveReportSettings(settings);
      return ctx.replyWithHTML(`✅ Mode diset ke <b>BOTH</b>.\nDaily + Weekly report aktif.`);
    }

    if (sub === 'now') {
      await ctx.replyWithHTML(`⏳ <b>Membuat dan mengirim daily report sekarang...</b>`);
      try {
        await runDailyReport();
        return ctx.replyWithHTML(`✅ <b>Daily report berhasil dikirim.</b>`);
      } catch (err) {
        return ctx.replyWithHTML(`❌ Gagal kirim report: <code>${err.message}</code>`);
      }
    }

    return ctx.replyWithHTML(
      `❓ Subcommand tidak dikenal: <code>${sub}</code>\n\n` +
      `Gunakan: <code>/report on|off|daily|weekly|both|now|status</code>`
    );
  });

  // ── /dailyreport ─────────────────────────────────────────────────────────────
  bot.command('dailyreport', async (ctx) => {
    const parts  = ctx.message.text.trim().split(/\s+/);
    const dateArg = parts[1]?.trim();

    let targetDate;
    if (dateArg && isValidDate(dateArg)) {
      targetDate = dateArg;
    } else if (dateArg) {
      return ctx.replyWithHTML(`❌ Format tanggal tidak valid. Gunakan: <code>YYYY-MM-DD</code>`);
    } else {
      targetDate = todayWIB();
    }

    try {
      await ctx.replyWithHTML(`⏳ <i>Membuat daily report untuk ${targetDate}...</i>`);

      // Try from history first
      const cached = await getDailyReport(targetDate);
      if (cached?.reportText) {
        return ctx.replyWithHTML(cached.reportText);
      }

      // Generate fresh
      const stats      = await getExtendedDailyStats(targetDate);
      const aiInsight  = await getAIDailyInsight(stats);
      const reportText = formatDailyReportV4(stats, targetDate, aiInsight);

      try {
        const buffer = await renderBanner('daily_report', {
          subtitle: targetDate,
          rows: [
            { label: 'Total Trades', value: stats.total },
            { label: 'Win', value: stats.wins, color: '#2ECC71' },
            { label: 'Loss', value: stats.losses, color: '#F14158' },
            { label: 'Breakeven', value: stats.breakevens || 0 },
            { label: 'Win Rate', value: `${stats.winRate}%` },
            { label: 'Net Pips', value: `${parseFloat(stats.netPips) >= 0 ? '+' : ''}${stats.netPips}` },
            { label: 'Profit Factor', value: stats.profitFactor },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[DAILYREPORT-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(reportText);
    } catch (err) {
      await ctx.replyWithHTML(`❌ <b>Gagal buat daily report.</b>\n<code>${err.message}</code>`);
    }
  });

  // ── /weeklyreport ────────────────────────────────────────────────────────────
  bot.command('weeklyreport', async (ctx) => {
    const parts  = ctx.message.text.trim().split(/\s+/);
    const sub    = parts[1]?.toLowerCase();

    try {
      // /weeklyreport last → ambil dari history
      if (sub === 'last') {
        const cached = await getLatestWeeklyReport();
        if (!cached) {
          return ctx.replyWithHTML(`⏳ <i>Belum ada weekly report tersimpan.</i>`);
        }
        return ctx.replyWithHTML(cached.reportText || `<i>Report kosong.</i>`);
      }

      await ctx.replyWithHTML(`⏳ <i>Membuat weekly report...</i>`);
      const stats      = await getExtendedWeeklyStats(7);
      const aiReview   = await getAIWeeklyReview(stats);
      const reportText = formatWeeklyReportV4(stats, aiReview);

      try {
        const buffer = await renderBanner('weekly_report', {
          subtitle: '7 Hari Terakhir',
          rows: [
            { label: 'Total Trades', value: stats.total },
            { label: 'Win', value: stats.wins, color: '#2ECC71' },
            { label: 'Loss', value: stats.losses, color: '#F14158' },
            { label: 'Breakeven', value: stats.breakevens || 0 },
            { label: 'Win Rate', value: `${stats.winRate}%` },
            { label: 'Net Pips', value: `${parseFloat(stats.netPips) >= 0 ? '+' : ''}${stats.netPips}` },
            { label: 'Profit Factor', value: stats.profitFactor },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[WEEKLYREPORT-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(reportText);
    } catch (err) {
      await ctx.replyWithHTML(`❌ <b>Gagal buat weekly report.</b>\n<code>${err.message}</code>`);
    }
  });

  // ── /reporthistory ───────────────────────────────────────────────────────────
  bot.command('reporthistory', async (ctx) => {
    try {
      const history = await getRecentDailyHistory(10);
      if (!history || history.length === 0) {
        return ctx.replyWithHTML(`📂 <b>Report History</b>\n\n⏳ <i>Belum ada report tersimpan.</i>`);
      }

      const lines = [
        `━━━━━━━━━━━━━━━━━━━━`,
        `📂 <b>REPORT HISTORY (10 Terakhir)</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
      ];

      history.slice().reverse().forEach((r, i) => {
        const s  = r.stats || {};
        const wr = s.winRate || '0.0';
        const np = parseFloat(s.netPips || 0);
        const npStr = (np >= 0 ? '+' : '') + np.toFixed(1);
        const wrEmoji = parseFloat(wr) >= 60 ? '🟢' : parseFloat(wr) >= 50 ? '🟡' : '🔴';
        lines.push(`${wrEmoji} <b>${r.date}</b>  W:${s.wins||0} L:${s.losses||0}  WR:${wr}%  ${npStr}pts`);
        if (i < history.length - 1) lines.push(`   📌 <code>/dailyreport ${r.date}</code>`);
        lines.push(``);
      });

      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`💡 <i>Gunakan /dailyreport YYYY-MM-DD untuk detail.</i>`);

      await ctx.replyWithHTML(lines.join('\n'));
    } catch (err) {
      await ctx.replyWithHTML(`❌ Gagal ambil history: <code>${err.message}</code>`);
    }
  });
}

module.exports = { registerReportCommands };
