const { getDailyStats, getWeeklyStats } = require('../../database/db');
const { toWIB, todayWIB }               = require('../../utils/wib_time');

function moodEmoji(winRate) {
  const pct = parseFloat(winRate);
  if (pct >= 80) return '🔥';
  if (pct >= 60) return '💪';
  if (pct >= 50) return '😐';
  return '😓';
}

function pipBar(pips) {
  const abs    = Math.abs(pips);
  const filled = Math.min(Math.round(abs / 20), 10);
  const bar    = (pips >= 0 ? '🟩' : '🟥').repeat(filled) + '⬜'.repeat(10 - filled);
  return bar;
}

// Konversi "2026-06-22" (YYYY-MM-DD) ke "Minggu, 22 Juni 2026"
function formatDateID(ymdStr) {
  if (!ymdStr) return ymdStr;
  try {
    // parse sebagai UTC midnight lalu konversi ke WIB
    const d = new Date(`${ymdStr}T00:00:00.000Z`);
    const w = toWIB(d);
    return `${w.dayName}, ${w.dateNum} ${w.month} ${w.year}`;
  } catch {
    return ymdStr;
  }
}

function formatDailyReport(s, date) {
  const netSign  = s.netPips >= 0 ? '+' : '';
  const netEmoji = s.netPips >= 0 ? '📈' : '📉';
  const be       = s.breakevens || 0;
  const wib      = toWIB();

  return [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 <b>AZZAVISION AI — DAILY REPORT</b>`,
    `📆 Tanggal: <b>${formatDateID(date)}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 <b>RINGKASAN HARI INI</b>`,
    ``,
    `📌 Total Trades   : <code>${s.total}</code>`,
    `✅ Wins           : <code>${s.wins}</code>`,
    `❌ Losses         : <code>${s.losses}</code>`,
    `🔒 Breakevens     : <code>${be}</code>`,
    ``,
    `🎯 Win Rate       : <code>${s.winRate}%</code>  ${moodEmoji(s.winRate)}`,
    `${netEmoji} Net Pips       : <code>${netSign}${Number(s.netPips).toFixed(1)} pts</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>DETAIL SINYAL</b>`,
    ``,
    `🟢 BUY Signal     : <code>${s.buyCount}</code>`,
    `🔴 SELL Signal    : <code>${s.sellCount}</code>`,
    `📡 Avg Confidence : <code>${s.avgConf}%</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `ℹ️ <i>Win Rate = WIN / (WIN+LOSS) — BREAKEVEN tidak dihitung sebagai WIN maupun LOSS</i>`,
    ``,
    s.total === 0
      ? `⏳ <i>Belum ada sinyal tertutup hari ini.</i>`
      : `${pipBar(s.netPips)}`,
    ``,
    wib.line,
    ``,
    `⚡ <i>AZZAVISION AI v3.0 | Daily Performance Tracker</i>`,
  ].join('\n');
}

function formatWeeklyReport(rows) {
  if (!rows || rows.length === 0) {
    const wib = toWIB();
    return [
      `📊 <b>AZZAVISION AI — WEEKLY SUMMARY</b>`,
      ``,
      `⏳ <i>Belum ada data sinyal 7 hari terakhir.</i>`,
      ``,
      wib.line,
    ].join('\n');
  }

  const totalWins       = rows.reduce((s, r) => s + r.wins, 0);
  const totalLosses     = rows.reduce((s, r) => s + r.losses, 0);
  const totalBreakevens = rows.reduce((s, r) => s + (r.breakevens || 0), 0);
  const totalSignals    = rows.reduce((s, r) => s + r.total, 0);
  const totalPips       = rows.reduce((s, r) => s + r.net_pips, 0);

  const decidedTotal = totalWins + totalLosses;
  const overallWR    = decidedTotal > 0 ? ((totalWins / decidedTotal) * 100).toFixed(1) : '0.0';
  const wib          = toWIB();

  const dayLines = rows.map((r) => {
    const decided = r.wins + r.losses;
    const wr      = decided > 0 ? ((r.wins / decided) * 100).toFixed(0) : '0';
    const pipSign = r.net_pips >= 0 ? '+' : '';
    const dot     = parseFloat(wr) >= 60 ? '🟢' : parseFloat(wr) >= 50 ? '🟡' : '🔴';
    const beStr   = r.breakevens > 0 ? ` BE:${r.breakevens}` : '';
    // r.day adalah string YYYY-MM-DD dari DB — tampilkan sebagai "22 Jun"
    let dayLabel = r.day;
    try {
      const d = new Date(`${r.day}T00:00:00.000Z`);
      const w = toWIB(d);
      dayLabel = `${String(w.dateNum).padStart(2,'0')} ${w.month.slice(0,3)}`;
    } catch { /* keep original */ }
    return `${dot} <code>${dayLabel}</code>  W:<b>${r.wins}</b> L:<b>${r.losses}</b>${beStr}  ${pipSign}${Number(r.net_pips).toFixed(0)}pts  [${wr}%]`;
  });

  const netSign = totalPips >= 0 ? '+' : '';

  return [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 <b>AZZAVISION AI — 7 DAY SUMMARY</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    ...dayLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 <b>TOTAL 7 HARI</b>`,
    ``,
    `✅ Total Setup  : <code>${totalSignals}</code>`,
    `🏆 Win          : <code>${totalWins}</code>`,
    `❌ Loss         : <code>${totalLosses}</code>`,
    `🔒 Breakeven    : <code>${totalBreakevens}</code>`,
    `🎯 Win Rate     : <code>${overallWR}%</code>  ${moodEmoji(overallWR)}`,
    `💹 Net Pips     : <code>${netSign}${totalPips.toFixed(1)} pts</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    wib.line,
    ``,
    `⚡ <i>AZZAVISION AI v3.0 | Weekly Performance</i>`,
  ].join('\n');
}

async function registerDaily(bot) {
  bot.command('daily', async (ctx) => {
    try {
      // Gunakan tanggal WIB — bukan UTC — agar laporan sesuai hari Indonesia
      const today   = todayWIB();
      const stats   = await getDailyStats(today);
      const message = formatDailyReport(stats, today);
      await ctx.replyWithHTML(message);
    } catch (err) {
      console.error('[DAILY] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Gagal mengambil data harian.</b>\n<code>${err.message}</code>`);
    }
  });

  bot.command('daily7', async (ctx) => {
    try {
      const rows    = await getWeeklyStats();
      const message = formatWeeklyReport(rows);
      await ctx.replyWithHTML(message);
    } catch (err) {
      console.error('[DAILY7] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Gagal mengambil data 7 hari.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerDaily, formatDailyReport, formatWeeklyReport };
