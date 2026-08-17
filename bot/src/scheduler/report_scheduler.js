/**
 * report_scheduler.js — Auto Performance Report Scheduler v4.0
 *
 * Menjalankan laporan otomatis ke channel Telegram:
 * - Daily  : setiap hari pukul 00:00 WIB (17:00 UTC)
 * - Weekly : setiap Sabtu pukul 00:00 WIB (Jumat 17:00 UTC)
 *
 * Berjalan async — tidak mengganggu market scanner.
 * Retry kirim channel maksimal 3 kali.
 * Simpan history 365 hari di report_store.js.
 */

'use strict';

const cron = require('node-cron');
const { getExtendedDailyStats, getExtendedWeeklyStats } = require('../database/db_extended');
const { saveDailyReport, saveWeeklyReport, getReportSettings } = require('../database/report_store');
const { toWIB, todayWIB } = require('../utils/wib_time');
const engine = require('../analysis/ai_engine');

let _bot       = null;
let _startedAt = null;

// ─── FORMATTER: DAILY REPORT V4 ──────────────────────────────────────────────
function formatDailyReportV4(s, date, aiInsight) {
  const netSign  = parseFloat(s.netPips) >= 0 ? '+' : '';
  const netEmoji = parseFloat(s.netPips) >= 0 ? '📈' : '📉';
  const wr       = parseFloat(s.winRate);
  const wrEmoji  = wr >= 70 ? '🔥' : wr >= 55 ? '💪' : wr >= 45 ? '😐' : '😓';
  const be       = s.breakevens || 0;
  const wib      = toWIB();

  function durStr(min) {
    if (min === null || min === undefined) return 'N/A';
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📅 <b>AZZAVISION AI v5.0 — DAILY REPORT</b>`,
    `📆 <b>${formatDateID(date)}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 <b>RINGKASAN HARI INI</b>`,
    ``,
    `📌 Total Trades      : <code>${s.total}</code>`,
    `✅ Win               : <code>${s.wins}</code>`,
    `❌ Loss              : <code>${s.losses}</code>`,
    `🔒 Breakeven         : <code>${be}</code>`,
    ``,
    `🎯 Win Rate          : <code>${s.winRate}%</code>  ${wrEmoji}`,
    `${netEmoji} Net Pips       : <code>${netSign}${s.netPips} pts</code>`,
    `💹 Profit Factor     : <code>${s.profitFactor}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>DETAIL SINYAL</b>`,
    ``,
    `🟢 BUY Signal        : <code>${s.buyCount}</code>`,
    `🔴 SELL Signal       : <code>${s.sellCount}</code>`,
    `📡 Avg Confidence    : <code>${s.avgConf}%</code>`,
    `⏱ Avg Duration      : <code>${durStr(s.avgDurationMin)}</code>`,
    ``,
    `🔥 Longest Win Streak : <code>${s.longestWinStreak}</code>`,
    `📉 Longest Loss Streak: <code>${s.longestLossStreak}</code>`,
    ``,
  ];

  // Strategy
  if (s.bestStrategy) {
    const bs = s.bestStrategy;
    const bsWR = (bs.wins + bs.losses) > 0
      ? ((bs.wins / (bs.wins + bs.losses)) * 100).toFixed(0) : '0';
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`🥇 <b>HIGHLIGHTS HARI INI</b>`);
    lines.push(``);
    lines.push(`🥇 Best Strategy : <b>${bs.name}</b> (WR: ${bsWR}%, ${bs.pips >= 0 ? '+' : ''}${bs.pips.toFixed(0)} pts)`);
  }

  if (s.bestTrade) {
    const bt = s.bestTrade;
    lines.push(`🏆 Best Trade    : <code>${bt.direction} @ ${bt.entry || '-'}</code> → <code>+${bt.pips} pts</code>`);
  }

  if (s.worstTrade) {
    const wt = s.worstTrade;
    lines.push(`📉 Worst Trade   : <code>${wt.direction} @ ${wt.entry || '-'}</code> → <code>${wt.pips} pts</code>`);
  }

  if (s.highestConf) {
    lines.push(`🔥 Highest Conf  : <code>${s.highestConf.confidence}%</code> (${s.highestConf.direction})`);
  }

  if (s.lowestConf) {
    lines.push(`📊 Lowest Conf   : <code>${s.lowestConf.confidence}%</code> (${s.lowestConf.direction})`);
  }

  lines.push(``);

  // AI Insight
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`🤖 <b>AI DAILY INSIGHT</b>`);
  lines.push(``);

  if (aiInsight) {
    lines.push(aiInsight);
  } else {
    lines.push(`<i>AI Insight unavailable.</i>`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(wib.line);
  lines.push(``);
  lines.push(`⚡ <i>AZZAVISION AI v5.0 | Auto Performance Report</i>`);

  return lines.join('\n');
}

// ─── FORMATTER: WEEKLY REPORT V4 ─────────────────────────────────────────────
function formatWeeklyReportV4(s, aiReview) {
  const netSign  = parseFloat(s.netPips) >= 0 ? '+' : '';
  const netEmoji = parseFloat(s.netPips) >= 0 ? '📈' : '📉';
  const wr       = parseFloat(s.winRate);
  const wrEmoji  = wr >= 70 ? '🔥' : wr >= 55 ? '💪' : wr >= 45 ? '😐' : '😓';
  const wib      = toWIB();

  function durStr(min) {
    if (min === null || min === undefined) return 'N/A';
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 <b>AZZAVISION AI v5.0 — WEEKLY REPORT</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 <b>RINGKASAN 7 HARI</b>`,
    ``,
    `📌 Total Trades      : <code>${s.total}</code>`,
    `✅ Win               : <code>${s.wins}</code>`,
    `❌ Loss              : <code>${s.losses}</code>`,
    `🔒 Breakeven         : <code>${s.breakevens}</code>`,
    ``,
    `🎯 Win Rate          : <code>${s.winRate}%</code>  ${wrEmoji}`,
    `${netEmoji} Net Pips       : <code>${netSign}${s.netPips} pts</code>`,
    `💹 Profit Factor     : <code>${s.profitFactor}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>DETAIL SINYAL</b>`,
    ``,
    `🟢 BUY Signal        : <code>${s.buyCount}</code>`,
    `🔴 SELL Signal       : <code>${s.sellCount}</code>`,
    `📡 Avg Confidence    : <code>${s.avgConf}%</code>`,
    `⏱ Avg Duration      : <code>${durStr(s.avgDurationMin)}</code>`,
    ``,
    `🔥 Longest Win Streak : <code>${s.longestWinStreak}</code>`,
    `📉 Longest Loss Streak: <code>${s.longestLossStreak}</code>`,
    ``,
  ];

  // Strategy breakdown
  if (s.bestStrategy || s.worstStrategy) {
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`📈 <b>STRATEGY REPORT</b>`);
    lines.push(``);

    if (s.bestStrategy) {
      const bs = s.bestStrategy;
      const bsWR = (bs.wins + bs.losses) > 0 ? ((bs.wins / (bs.wins + bs.losses)) * 100).toFixed(0) : '0';
      lines.push(`🥇 Best Strategy  : <b>${bs.name}</b>`);
      lines.push(`   W:${bs.wins} L:${bs.losses} WR:${bsWR}% Pips:${bs.pips >= 0 ? '+' : ''}${bs.pips.toFixed(0)}`);
    }

    if (s.worstStrategy && s.worstStrategy.name !== s.bestStrategy?.name) {
      const ws = s.worstStrategy;
      const wsWR = (ws.wins + ws.losses) > 0 ? ((ws.wins / (ws.wins + ws.losses)) * 100).toFixed(0) : '0';
      lines.push(`📉 Worst Strategy : <b>${ws.name}</b>`);
      lines.push(`   W:${ws.wins} L:${ws.losses} WR:${wsWR}% Pips:${ws.pips >= 0 ? '+' : ''}${ws.pips.toFixed(0)}`);
    }

    lines.push(``);
  }

  // Hall of Fame
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`🏆 <b>HALL OF FAME</b>`);
  lines.push(``);

  if (s.bestStrategy) {
    const bs = s.bestStrategy;
    const bsWR = (bs.wins + bs.losses) > 0 ? ((bs.wins / (bs.wins + bs.losses)) * 100).toFixed(0) : '0';
    lines.push(`🥇 Best Strategy    : <b>${bs.name}</b> (${bsWR}%)`);
  }

  if (s.bestTrade) {
    const bt = s.bestTrade;
    lines.push(`🏆 Best Trade       : <code>${bt.direction} +${bt.pips} pts</code>`);
  }

  if (s.highestConf) {
    lines.push(`🔥 Highest Conf     : <code>${s.highestConf.confidence}%</code> (${s.highestConf.direction})`);
  }

  if (s.fastestTp2) {
    const dur = s.fastestTp2;
    const dMin = dur.closed_at && dur.created_at
      ? Math.round((new Date(dur.closed_at) - new Date(dur.created_at)) / 60000)
      : null;
    if (dMin !== null) {
      lines.push(`⚡ Fastest TP2      : <code>${dMin < 60 ? dMin + 'm' : Math.floor(dMin / 60) + 'h' + (dMin % 60) + 'm'}</code>`);
    }
  }

  if (s.longestWinStreak > 0) {
    lines.push(`🎯 Best Win Streak  : <code>${s.longestWinStreak} trades</code>`);
  }

  lines.push(``);

  // Per-day rows
  if (s.dayRows && s.dayRows.length > 0) {
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`📆 <b>PER DAY</b>`);
    lines.push(``);

    s.dayRows.forEach(r => {
      const decided = r.wins + r.losses;
      const dayWR   = decided > 0 ? ((r.wins / decided) * 100).toFixed(0) : '0';
      const dot     = parseFloat(dayWR) >= 60 ? '🟢' : parseFloat(dayWR) >= 50 ? '🟡' : '🔴';
      const pipSign = r.net_pips >= 0 ? '+' : '';
      let dayLabel  = r.day;
      try {
        const { toWIB: tw } = require('../utils/wib_time');
        const d = new Date(`${r.day}T00:00:00.000Z`);
        const w = tw(d);
        dayLabel = `${String(w.dateNum).padStart(2,'0')} ${w.month.slice(0,3)}`;
      } catch { /* keep original */ }
      const beStr = r.breakevens > 0 ? ` BE:${r.breakevens}` : '';
      lines.push(`${dot} <code>${dayLabel}</code>  W:<b>${r.wins}</b> L:<b>${r.losses}</b>${beStr}  ${pipSign}${Number(r.net_pips).toFixed(0)}pts [${dayWR}%]`);
    });

    lines.push(``);
  }

  // AI Weekly Review
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`🤖 <b>AI WEEKLY REVIEW</b>`);
  lines.push(``);

  if (aiReview) {
    lines.push(aiReview);
  } else {
    lines.push(`<i>AI Weekly Review unavailable.</i>`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(wib.line);
  lines.push(``);
  lines.push(`⚡ <i>AZZAVISION AI v5.0 | Weekly Performance Report</i>`);

  return lines.join('\n');
}

// ─── AI DAILY INSIGHT ─────────────────────────────────────────────────────────
async function getAIDailyInsight(stats) {
  if (stats.total === 0) return null;

  const prompt = `Kamu adalah AI analis trading profesional.

Data trading hari ini (XAUUSD Gold):
- Total Trades: ${stats.total}
- Win: ${stats.wins}, Loss: ${stats.losses}, Breakeven: ${stats.breakevens}
- Win Rate: ${stats.winRate}%
- Net Pips: ${stats.netPips}
- Profit Factor: ${stats.profitFactor}
- BUY: ${stats.buyCount}, SELL: ${stats.sellCount}
- Avg Confidence: ${stats.avgConf}%
- Best Strategy: ${stats.bestStrategy?.name || 'N/A'}
- Longest Win Streak: ${stats.longestWinStreak}
- Longest Loss Streak: ${stats.longestLossStreak}

Buat analisis singkat dalam Bahasa Indonesia (MAKSIMAL 150 kata) mencakup:
1. Ringkasan performa
2. Penyebab win/loss
3. Strategi terbaik
4. Kondisi market hari ini
5. Saran besok

Output HARUS valid JSON:
{"insight": "teks analisis di sini..."}`;

  try {
    const result = await engine.callAI(prompt);
    return result?.insight || null;
  } catch (err) {
    console.warn('[SCHEDULER] AI Daily Insight gagal:', err.message);
    return null;
  }
}

// ─── AI WEEKLY REVIEW ─────────────────────────────────────────────────────────
async function getAIWeeklyReview(stats) {
  if (stats.total === 0) return null;

  const stratInfo = stats.strategies?.slice(0, 5).map(st => {
    const wr = (st.wins + st.losses) > 0 ? ((st.wins / (st.wins + st.losses)) * 100).toFixed(0) : '0';
    return `${st.name}: W${st.wins} L${st.losses} WR${wr}% Pips${st.pips >= 0 ? '+' : ''}${st.pips.toFixed(0)}`;
  }).join('; ') || 'Tidak ada data strategi';

  const prompt = `Kamu adalah AI analis trading profesional.

Data trading 7 hari terakhir (XAUUSD Gold):
- Total Trades: ${stats.total}
- Win: ${stats.wins}, Loss: ${stats.losses}, Breakeven: ${stats.breakevens}
- Win Rate: ${stats.winRate}%
- Net Pips: ${stats.netPips}
- Profit Factor: ${stats.profitFactor}
- Avg Confidence: ${stats.avgConf}%
- Strategy breakdown: ${stratInfo}
- Longest Win Streak: ${stats.longestWinStreak}
- Longest Loss Streak: ${stats.longestLossStreak}

Buat review mingguan dalam Bahasa Indonesia (MAKSIMAL 200 kata) mencakup:
1. Apa yang berkembang minggu ini
2. Apa yang menurun
3. Strategi yang meningkat
4. Strategi yang harus diprioritaskan
5. Strategi yang harus difilter
6. Target minggu depan

Output HARUS valid JSON:
{"review": "teks review di sini..."}`;

  try {
    const result = await engine.callAI(prompt);
    return result?.review || null;
  } catch (err) {
    console.warn('[SCHEDULER] AI Weekly Review gagal:', err.message);
    return null;
  }
}

// ─── DATE HELPER ──────────────────────────────────────────────────────────────
function formatDateID(ymdStr) {
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
  const DAYS   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  if (!ymdStr) return ymdStr;
  try {
    const d = new Date(`${ymdStr}T00:00:00.000Z`);
    const w = toWIB(d);
    return `${w.dayName}, ${w.dateNum} ${w.month} ${w.year}`;
  } catch {
    return ymdStr;
  }
}

// ─── SEND WITH RETRY ─────────────────────────────────────────────────────────
async function sendWithRetry(channelId, text, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      await _bot.telegram.sendMessage(channelId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      console.log(`[SCHEDULER] ✅ Terkirim ke ${channelId} (attempt ${i})`);
      return true;
    } catch (err) {
      console.warn(`[SCHEDULER] Gagal kirim (attempt ${i}/${retries}): ${err.message}`);
      if (i < retries) await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
  console.error(`[SCHEDULER] ❌ Gagal kirim setelah ${retries} percobaan.`);
  return false;
}

// ─── RUN DAILY REPORT ─────────────────────────────────────────────────────────
async function runDailyReport(targetDate) {
  console.log('[SCHEDULER] Memulai daily report...');
  try {
    const settings   = await getReportSettings();
    if (!settings.enabled || settings.mode === 'off') return;
    if (settings.mode === 'weekly') return;

    const date       = targetDate || todayWIB();
    const channelId  = settings.reportChannelId || process.env.CHANNEL_ID;

    if (!channelId) {
      console.warn('[SCHEDULER] Daily report: CHANNEL_ID belum diset');
      return;
    }

    const stats      = await getExtendedDailyStats(date);
    const aiInsight  = await getAIDailyInsight(stats);
    const reportText = formatDailyReportV4(stats, date, aiInsight);

    await sendWithRetry(channelId, reportText);
    await saveDailyReport(date, stats, aiInsight, reportText);

    console.log(`[SCHEDULER] ✅ Daily report selesai untuk ${date}`);
  } catch (err) {
    console.error('[SCHEDULER] Daily report error:', err.message);
  }
}

// ─── RUN WEEKLY REPORT ────────────────────────────────────────────────────────
async function runWeeklyReport() {
  console.log('[SCHEDULER] Memulai weekly report...');
  try {
    const settings  = await getReportSettings();
    if (!settings.enabled || settings.mode === 'off') return;
    if (settings.mode === 'daily') return;

    const channelId = settings.reportChannelId || process.env.CHANNEL_ID;
    if (!channelId) {
      console.warn('[SCHEDULER] Weekly report: CHANNEL_ID belum diset');
      return;
    }

    const stats     = await getExtendedWeeklyStats(7);
    const aiReview  = await getAIWeeklyReview(stats);
    const weekKey   = todayWIB();
    const reportText = formatWeeklyReportV4(stats, aiReview);

    await sendWithRetry(channelId, reportText);
    await saveWeeklyReport(weekKey, stats, aiReview, reportText);

    console.log(`[SCHEDULER] ✅ Weekly report selesai untuk week-of ${weekKey}`);
  } catch (err) {
    console.error('[SCHEDULER] Weekly report error:', err.message);
  }
}

// ─── START SCHEDULER ─────────────────────────────────────────────────────────
function startReportScheduler(bot) {
  if (_startedAt) {
    console.log('[SCHEDULER] Sudah berjalan — skip init ulang.');
    return;
  }

  _bot       = bot;
  _startedAt = Date.now();

  // Daily: setiap hari pukul 17:00 UTC = 00:00 WIB
  cron.schedule('0 17 * * *', () => {
    console.log('[SCHEDULER] 🕐 Trigger: Daily Report (00:00 WIB)');
    setImmediate(() => runDailyReport().catch(err => console.error('[SCHEDULER]', err.message)));
  }, { timezone: 'UTC' });

  // Weekly: setiap Jumat pukul 17:00 UTC = Sabtu 00:00 WIB
  cron.schedule('0 17 * * 5', () => {
    console.log('[SCHEDULER] 🕐 Trigger: Weekly Report (Sabtu 00:00 WIB)');
    setImmediate(() => runWeeklyReport().catch(err => console.error('[SCHEDULER]', err.message)));
  }, { timezone: 'UTC' });

  console.log('[SCHEDULER] ✅ Report Scheduler aktif:');
  console.log('[SCHEDULER]    Daily  → setiap 00:00 WIB');
  console.log('[SCHEDULER]    Weekly → setiap Sabtu 00:00 WIB');
}

module.exports = {
  startReportScheduler,
  runDailyReport,
  runWeeklyReport,
  formatDailyReportV4,
  formatWeeklyReportV4,
  getAIDailyInsight,
  getAIWeeklyReview,
};
