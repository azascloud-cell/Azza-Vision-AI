/**
 * tradejournal.js — /tradejournal <id>
 *
 * Owner dapat meminta AI membuat ulang jurnal trading berdasarkan snapshot
 * yang disimpan saat trade terjadi. Bukan berdasarkan market sekarang.
 */

'use strict';

const { getSignalById, getStats, getAllSignals } = require('../../database/db');
const { getAllStrategyStats }                    = require('../../database/strategy_stats');
const { callAI }                                 = require('../../analysis/ai_engine');
const { toWIB, isoToWIBShort }                  = require('../../utils/wib_time');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── MESSAGE SPLITTER (Telegram max 4096 chars per message) ───────────────────
function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }
    // Try to cut at a newline near the limit
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < maxLen / 2) cut = maxLen; // no good newline found — cut hard
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return parts;
}

// ─── SAFE SEND (handles 4096 char limit) ─────────────────────────────────────
async function safeSendHTML(ctx, text, extra) {
  const parts = splitMessage(text);
  for (let i = 0; i < parts.length; i++) {
    const opts = (i === parts.length - 1 && extra) ? extra : {};
    await ctx.replyWithHTML(parts[i], opts);
  }
}

// ─── DURATION ─────────────────────────────────────────────────────────────────
function calcDuration(openAt, closeAt) {
  try {
    const ms = new Date(closeAt) - new Date(openAt);
    if (isNaN(ms) || ms < 0) return 'N/A';
    const h  = Math.floor(ms / 3_600_000);
    const m  = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}j ${m}m` : `${m} menit`;
  } catch { return 'N/A'; }
}

function sv(v) {
  if (v === null || v === undefined) return 'N/A';
  return String(v);
}

// ─── STRATEGY STREAK ──────────────────────────────────────────────────────────
async function getStrategyStreak(strategyName, currentTradeId) {
  try {
    const all     = await getAllSignals();
    const closed  = all
      .filter(s => s.status && s.status !== 'OPEN')
      .sort((a, b) => new Date(a.closed_at || a.created_at) - new Date(b.closed_at || b.created_at));

    const mine = closed.filter(s => {
      const strat = s.strategy || s.h4_bias || '';
      return strat.toLowerCase().includes(strategyName.toLowerCase());
    });

    if (mine.length === 0) return null;

    // Find current trade position
    const idx = mine.findIndex(s => s.id === currentTradeId);
    if (idx < 0) return null;

    // Count streak before this trade (same result)
    const current = mine[idx];
    let streak = 1;
    let type   = current.status === 'WIN' ? 'WIN' : current.status === 'LOSS' ? 'LOSS' : 'BREAKEVEN';

    for (let i = idx - 1; i >= 0; i--) {
      if (mine[i].status === current.status) streak++;
      else break;
    }

    // Win rate for this strategy
    const wins   = mine.slice(0, idx + 1).filter(s => s.status === 'WIN').length;
    const losses = mine.slice(0, idx + 1).filter(s => s.status === 'LOSS').length;
    const wr     = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

    return { streak, type, wins, losses, winRate: wr, totalTrades: idx + 1 };
  } catch {
    return null;
  }
}

// ─── BUILD AI REPLAY PROMPT ───────────────────────────────────────────────────
function buildReplayPrompt(signal, stratStats, overallStats, streakData) {
  const duration   = calcDuration(signal.created_at, signal.closed_at);
  const snapshot   = signal.snapshot || {};
  const aiReview   = signal.ai_review;

  const h4  = snapshot.h4  || signal.h4_bias  || 'N/A';
  const h1  = snapshot.h1  || signal.h1_bias  || 'N/A';
  const m15 = snapshot.m15 || signal.m15_bias || 'N/A';
  const m5  = snapshot.m5  || signal.m5_signal || 'N/A';
  const m1  = snapshot.m1  || signal.m1_bias  || 'N/A';
  const session   = snapshot.session   || signal.session   || 'N/A';
  const volatility = snapshot.volatility || signal.volatility || 'N/A';
  const newsSummary = snapshot.news_summary || signal.news_summary || 'Tidak tersedia';
  const entryReasons = snapshot.entry_reasons || signal.entry_reasons || 'N/A';
  const confluence  = snapshot.confluence  || signal.confluence  || 'N/A';
  const strategyName = signal.strategy || 'Multi-Strategy Analysis';
  const ensembleScore = snapshot.ensemble_score || signal.ensemble_score || 'N/A';

  const isWin  = signal.status === 'WIN';
  const isBE   = signal.status === 'BREAKEVEN' || signal.status === 'TP1_BREAKEVEN';
  const isLoss = signal.status === 'LOSS';

  const stratLine = stratStats && stratStats.length > 0
    ? stratStats.slice(0, 5).map(s => `${s.name}: ${s.wins}W/${s.losses}L (WR ${s.winRate}%)`).join('\n')
    : 'Belum ada data strategi.';

  const streakLine = streakData
    ? `${streakData.type} ke-${streakData.streak} berturut-turut | WR: ${streakData.winRate}% | Total: ${streakData.totalTrades} trades`
    : 'Data streak tidak tersedia';

  const botPerf = overallStats
    ? `Total: ${overallStats.total} | Win: ${overallStats.wins} | Loss: ${overallStats.losses} | WR: ${overallStats.winRate}% | Net: ${overallStats.netPips} pips`
    : 'N/A';

  const aiReviewText = aiReview
    ? `Verdict: ${aiReview.verdict || 'N/A'} | Score: ${aiReview.score || 'N/A'} | Reasons: ${(aiReview.reasons || []).join(', ')}`
    : 'Tidak tersedia';

  return `
Kamu adalah Senior Professional Gold Trader dengan pengalaman lebih dari 20 tahun, sekaligus Trading Mentor dan Risk Manager.

Kamu sedang menganalisis trade XAUUSD yang sudah SELESAI berdasarkan snapshot kondisi market SAAT ENTRY.
JANGAN menggunakan kondisi market saat ini.
JANGAN menggunakan template.
Analisis HARUS spesifik, mendalam, dan unik berdasarkan data berikut.

=== IDENTITAS TRADE ===
Trade ID     : #${sv(signal.id)}
Pair         : XAUUSD
Direction    : ${sv(signal.direction)}
Entry        : ${sv(signal.entry)}
Close Price  : ${sv(signal.close_price || 'N/A')}
TP1          : ${sv(signal.tp1)}
TP2          : ${sv(signal.tp2)}
SL           : ${sv(signal.sl)}
Profit Pips  : ${sv(signal.pips)} pips
Hasil        : ${sv(signal.status)}
Durasi       : ${duration}
TP1 Hit      : ${signal.tp1_hit ? 'YA' : 'TIDAK'}
Breakeven    : ${signal.breakeven_triggered ? 'AKTIF' : 'TIDAK'}
Confidence   : ${sv(signal.confidence)}%

=== SNAPSHOT MARKET SAAT ENTRY ===
H4 Bias      : ${sv(h4)}
H1 Bias      : ${sv(h1)}
M15 Bias     : ${sv(m15)}
M5 Signal    : ${sv(m5)}
M1 Bias      : ${sv(m1)}
Session      : ${sv(session)}
Volatility   : ${sv(volatility)}
Ensemble     : ${sv(ensembleScore)}

=== ALASAN ENTRY ===
${sv(entryReasons)}

=== CONFLUENCE ===
${sv(confluence)}

=== BERITA SAAT ENTRY ===
${sv(newsSummary)}

=== AI REVIEW SEBELUM ENTRY ===
${aiReviewText}

=== STRATEGI ===
${sv(strategyName)}

=== HISTORI STRATEGI ===
${stratLine}

=== STREAK STRATEGI INI ===
${streakLine}

=== OVERALL BOT PERFORMANCE ===
${botPerf}

=== OPEN: ${signal.created_at ? isoToWIBShort(signal.created_at) : 'N/A'} | CLOSE: ${signal.closed_at ? isoToWIBShort(signal.closed_at) : 'N/A'} ===

=== TUGAS ===
Buat analisis mendalam sebagai Senior Gold Trader + Mentor. Gunakan bahasa Indonesia profesional.
JANGAN template. Setiap kata harus specific berdasarkan data di atas.

${isWin ? 'Ini adalah trade WIN. Jelaskan faktor keberhasilan, kualitas setup, apakah entry optimal, apakah TP/SL ideal.' : ''}
${isLoss ? 'Ini adalah trade LOSS. KRITIK setup jika ada kelemahan. Jelaskan faktor kegagalan, apakah entry terlalu agresif, apakah SL perlu diubah.' : ''}
${isBE ? 'Ini adalah BREAKEVEN. Jelaskan mengapa BE adalah keputusan tepat, apakah momentum melemah setelah TP1.' : ''}

Output HARUS valid JSON:
{
  "reflection": "Analisis mendalam mengapa trade ini berhasil/gagal (4-6 kalimat, SANGAT SPESIFIK)",
  "why_result": "Penjelasan teknikal mendalam mengapa outcome ini terjadi (3-5 kalimat)",
  "entry_quality": "Apakah entry sudah optimal? Apakah bisa lebih baik? (2-3 kalimat)",
  "tp_sl_quality": "Apakah TP dan SL sudah ideal berdasarkan kondisi saat itu? (2-3 kalimat)",
  "setup_factors": ["Faktor 1 yang spesifik", "Faktor 2", "Faktor 3"],
  "critique": "Kritik jujur jika ada kelemahan setup atau keputusan manajemen trade. Kosong jika setup sempurna.",
  "lesson": "Pelajaran trading yang actionable dan spesifik (2-4 kalimat)",
  "self_learning": "Analisis berdasarkan histori strategi dan streak. Apakah strategi ini layak prioritas? (2 kalimat)",
  "next_advice": "Saran konkret untuk trade berikutnya jika setup serupa muncul (2 kalimat)",
  "setup_quality_score": 8.7,
  "setup_quality_reason": "Alasan skor kualitas setup yang spesifik (1-2 kalimat)",
  "motivation": "Satu kalimat motivasi profesional yang unik dan relevan dengan kondisi trade ini"
}`.trim();
}

// ─── FORMAT REPLAY MESSAGE ─────────────────────────────────────────────────────
function formatReplayMessage(signal, aiData) {
  const snapshot  = signal.snapshot || {};
  const isWin     = signal.status === 'WIN';
  const isBE      = signal.status === 'BREAKEVEN' || signal.status === 'TP1_BREAKEVEN';
  const pips      = signal.pips || 0;
  const pipSign   = pips > 0 ? '+' : '';

  const h4  = snapshot.h4  || signal.h4_bias  || 'N/A';
  const h1  = snapshot.h1  || signal.h1_bias  || 'N/A';
  const m15 = snapshot.m15 || signal.m15_bias || 'N/A';
  const m5  = snapshot.m5  || signal.m5_signal || 'N/A';
  const m1  = snapshot.m1  || signal.m1_bias  || 'N/A';
  const session    = snapshot.session    || signal.session    || 'N/A';
  const volatility = snapshot.volatility || signal.volatility || 'N/A';
  const stratName  = signal.strategy || 'Multi-Strategy';
  const duration   = calcDuration(signal.created_at, signal.closed_at);

  let outcomeEmoji, outcomeLabel;
  if (isWin) {
    outcomeEmoji = pips >= 125 ? '🏆' : '✅';
    outcomeLabel = `WIN TP${pips >= 125 ? '2' : '1'} (${pipSign}${pips} pips)`;
  } else if (isBE) {
    outcomeEmoji = '🔒';
    outcomeLabel = signal.status === 'TP1_BREAKEVEN' ? 'TP1 + BREAKEVEN' : 'BREAKEVEN';
  } else {
    outcomeEmoji = '❌';
    outcomeLabel = `LOSS (${pips} pips)`;
  }

  const factorEmoji = isWin ? '✅' : isBE ? '🔒' : '⚠️';
  const factors = Array.isArray(aiData.setup_factors) && aiData.setup_factors.length > 0
    ? aiData.setup_factors.map(f => `${factorEmoji} ${f}`).join('\n')
    : `${factorEmoji} Data tidak tersedia`;

  const qualityScore = typeof aiData.setup_quality_score === 'number'
    ? aiData.setup_quality_score.toFixed(1)
    : '—';

  const wib = toWIB();

  const lines = [
    `━━━━━━━━━━━━━━━━━━`,
    `📖 <b>AI TRADE REPLAY</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `Trade #${signal.id}`,
    ``,
    `${outcomeEmoji} <b>${outcomeLabel}</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🤖 <b>AI Reflection</b>`,
    ``,
    aiData.reflection || '—',
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>Snapshot Saat Entry</b>`,
    ``,
    `<b>H4</b>       : <code>${sv(h4)}</code>`,
    `<b>H1</b>       : <code>${sv(h1)}</code>`,
    `<b>M15</b>      : <code>${sv(m15)}</code>`,
    `<b>M5</b>       : <code>${sv(m5)}</code>`,
    `<b>M1</b>       : <code>${sv(m1)}</code>`,
    `<b>Confidence</b>: <code>${sv(signal.confidence)}%</code>`,
    `<b>Strategy</b> : <code>${sv(stratName)}</code>`,
    `<b>Session</b>  : <code>${sv(session)}</code>`,
    `<b>Volatility</b>: <code>${sv(volatility)}</code>`,
    `<b>Durasi</b>   : <code>${duration}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    isWin  ? `📚 <b>Mengapa Trade Berhasil?</b>` :
    isBE   ? `📚 <b>Mengapa BE Keputusan Tepat?</b>` :
             `📚 <b>Mengapa Trade Gagal?</b>`,
    ``,
    aiData.why_result || '—',
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🎯 <b>Apakah Entry Sudah Optimal?</b>`,
    ``,
    aiData.entry_quality || '—',
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📈 <b>Apakah TP dan SL Sudah Ideal?</b>`,
    ``,
    aiData.tp_sl_quality || '—',
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>Faktor Utama</b>`,
    ``,
    factors,
    ``,
  ];

  if (aiData.critique && aiData.critique.trim()) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`⚠️ <b>Kritik AI</b>`);
    lines.push(``);
    lines.push(aiData.critique);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`📖 <b>Pelajaran Trading</b>`);
  lines.push(``);
  lines.push(aiData.lesson || '—');
  lines.push(``);

  if (aiData.self_learning) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`🧠 <b>Self Learning</b>`);
    lines.push(``);
    lines.push(aiData.self_learning);
    lines.push(``);
  }

  if (aiData.next_advice) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`🎯 <b>Saran Untuk Trade Berikutnya</b>`);
    lines.push(``);
    lines.push(aiData.next_advice);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`⭐ <b>Setup Quality</b>`);
  lines.push(``);
  lines.push(`<b>${qualityScore} / 10</b>`);
  if (aiData.setup_quality_reason) lines.push(aiData.setup_quality_reason);
  lines.push(``);

  if (aiData.motivation) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`💬 <i>${aiData.motivation}</i>`);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚡ <i>Generated by Groq AI — AZZAVISION AI Trade Replay</i>`);
  lines.push(wib.line);

  return lines.join('\n');
}

// ─── FALLBACK REPLAY ─────────────────────────────────────────────────────────
function fallbackReplay(signal) {
  const snapshot   = signal.snapshot || {};
  const isWin      = signal.status === 'WIN';
  const isBE       = signal.status === 'BREAKEVEN' || signal.status === 'TP1_BREAKEVEN';
  const pips       = signal.pips || 0;
  const pipSign    = pips > 0 ? '+' : '';
  const outcomeEmoji = isWin ? '✅' : isBE ? '🔒' : '❌';
  const duration   = calcDuration(signal.created_at, signal.closed_at);
  const wib        = toWIB();

  const h4  = snapshot.h4  || signal.h4_bias  || 'N/A';
  const h1  = snapshot.h1  || signal.h1_bias  || 'N/A';
  const m15 = snapshot.m15 || signal.m15_bias || 'N/A';
  const m5  = snapshot.m5  || signal.m5_signal || 'N/A';
  const session    = snapshot.session    || signal.session    || 'N/A';
  const volatility = snapshot.volatility || signal.volatility || 'N/A';
  const stratName  = signal.strategy || 'Multi-Strategy';

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `📖 <b>AI TRADE REPLAY — Trade #${signal.id}</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `${outcomeEmoji} <b>${signal.status} (${pipSign}${pips} pips)</b>`,
    ``,
    `📊 <b>Snapshot Saat Entry</b>`,
    ``,
    `H4       : <code>${sv(h4)}</code>`,
    `H1       : <code>${sv(h1)}</code>`,
    `M15      : <code>${sv(m15)}</code>`,
    `M5       : <code>${sv(m5)}</code>`,
    `Conf     : <code>${sv(signal.confidence)}%</code>`,
    `Strategy : <code>${sv(stratName)}</code>`,
    `Session  : <code>${sv(session)}</code>`,
    `Vol      : <code>${sv(volatility)}</code>`,
    `Durasi   : <code>${duration}</code>`,
    ``,
    `📌 Entry  : <code>${sv(signal.entry)}</code>`,
    `🎯 TP1   : <code>${sv(signal.tp1)}</code>`,
    `🎯 TP2   : <code>${sv(signal.tp2)}</code>`,
    `🛑 SL    : <code>${sv(signal.sl)}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `⚠️ <i>AI tidak tersedia — data snapshot ditampilkan.</i>`,
    wib.line,
  ].join('\n');
}

// ─── MAIN: GENERATE REPLAY ───────────────────────────────────────────────────
async function generateTradeReplay(signal) {
  let stratStats   = [];
  let overallStats = null;
  let streakData   = null;

  try {
    [stratStats, overallStats] = await Promise.all([
      getAllStrategyStats().catch(() => []),
      getStats().catch(() => null),
    ]);
    const stratName = signal.strategy || 'Multi-Strategy';
    streakData = await getStrategyStreak(stratName, signal.id).catch(() => null);
  } catch { /* non-fatal */ }

  const prompt = buildReplayPrompt(signal, stratStats, overallStats, streakData);

  try {
    const aiData = await callAI(prompt);
    if (!aiData || !aiData.reflection) {
      return fallbackReplay(signal);
    }
    return formatReplayMessage(signal, aiData);
  } catch (err) {
    console.warn('[TRADE-REPLAY] AI gagal:', err.message);
    return fallbackReplay(signal);
  }
}

// ─── REGISTER COMMAND ─────────────────────────────────────────────────────────
function registerTradeJournal(bot) {
  bot.command('tradejournal', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Perintah ini hanya untuk owner.</b>');
    }

    const args  = ctx.message?.text?.trim().split(/\s+/);
    const rawId = args[1];

    if (!rawId || isNaN(Number(rawId))) {
      return ctx.replyWithHTML([
        `📖 <b>AI TRADE REPLAY</b>`,
        ``,
        `Penggunaan: <code>/tradejournal &lt;id&gt;</code>`,
        `Contoh   : <code>/tradejournal 51</code>`,
        ``,
        `Gunakan <code>/tradehistory</code> untuk melihat daftar trade.`,
      ].join('\n'));
    }

    const id     = Number(rawId);
    const loadMsg = await ctx.replyWithHTML(`⏳ <b>Mengambil data Trade #${id}...</b>`).catch(() => null);

    try {
      const signal = await getSignalById(id);

      if (!signal) {
        if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
        return ctx.replyWithHTML(`❌ Trade #${id} tidak ditemukan.`);
      }

      if (signal.status === 'OPEN') {
        if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
        return ctx.replyWithHTML(`⏳ Trade #${id} masih <b>OPEN</b>. Replay hanya tersedia setelah trade selesai.`);
      }

      if (loadMsg) await ctx.telegram.editMessageText(
        ctx.chat.id, loadMsg.message_id, null,
        `⏳ <b>Mengirim ke Groq AI...</b>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});

      const replayMsg = await generateTradeReplay(signal);

      if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});

      const { Markup } = require('telegraf');
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('❓ Tanya AI', `tradeask_start_${id}`),
          Markup.button.callback('📊 Detail', `tradedetail_${id}`),
        ],
        [
          Markup.button.callback('📈 Strategy Stats', `stratstat_trade_${id}`),
        ],
      ]);

      // safeSendHTML auto-splits messages that exceed Telegram's 4096 char limit
      await safeSendHTML(ctx, replayMsg, keyboard);

    } catch (err) {
      console.error('[TRADEJOURNAL] Error:', err.message);
      if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ <b>Gagal membuat replay.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerTradeJournal, generateTradeReplay, fallbackReplay };
