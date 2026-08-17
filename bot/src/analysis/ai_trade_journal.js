/**
 * ai_trade_journal.js — AI Trade Journal Engine v1.0
 *
 * Menggunakan Groq AI (via ai_engine.js) untuk membuat jurnal trading
 * yang unik dan dinamis setelah setiap trade selesai.
 *
 * Dipanggil oleh scanner.js setelah trade WIN / LOSS / BREAKEVEN.
 * Fallback ke template sederhana jika AI tidak tersedia.
 */

'use strict';

const { callAI }      = require('./ai_engine');
const { toWIB }       = require('../utils/wib_time');
const { getAllStrategyStats } = require('../database/strategy_stats');
const { getStats }    = require('../database/db');

// ─── SAFE STRING ──────────────────────────────────────────────────────────────
function s(v) {
  if (v === null || v === undefined) return 'N/A';
  return String(v);
}

// ─── DURATION CALCULATOR ──────────────────────────────────────────────────────
function calcDuration(openAt, closeAt) {
  try {
    const ms  = new Date(closeAt) - new Date(openAt);
    if (isNaN(ms) || ms < 0) return 'N/A';
    const h   = Math.floor(ms / 3_600_000);
    const m   = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}j ${m}m`;
    return `${m} menit`;
  } catch {
    return 'N/A';
  }
}

// ─── SESSION HELPER ───────────────────────────────────────────────────────────
function getSessionLabel() {
  const utcHour = new Date().getUTCHours();
  if (utcHour >= 22 || utcHour < 2)  return 'Sydney';
  if (utcHour >= 0  && utcHour < 9)  return 'Tokyo';
  if (utcHour >= 7  && utcHour < 16) return 'London';
  if (utcHour >= 13 && utcHour < 22) return 'New York';
  return 'Overlap';
}

// ─── FALLBACK TEMPLATE ────────────────────────────────────────────────────────
function fallbackJournal(signal, status, closePrice, strategies) {
  const wib       = toWIB();
  const isWin     = status === 'WIN';
  const isBE      = status === 'BREAKEVEN' || status === 'TP1_BREAKEVEN';
  const emoji     = isWin ? '🏆' : isBE ? '🔒' : '❌';
  const outcome   = isWin ? `WIN (+${signal.pips} pips)` : isBE ? 'BREAKEVEN' : `LOSS (${signal.pips} pips)`;
  const stratLines = (strategies && strategies.length > 0)
    ? strategies.map(s => `✅ ${s}`).join('\n')
    : '• Multi-Strategy Analysis';

  let reflection = '';
  let lesson     = '';
  let motivation = '';

  if (isWin) {
    reflection = 'Trade berhasil karena timeframe utama aligned dan momentum tetap kuat hingga TP tercapai.';
    lesson     = 'Setup seperti ini layak diprioritaskan saat semua timeframe sudah aligned.';
    motivation = 'Trade terbaik bukan yang selalu profit, melainkan yang selalu mengikuti rencana.';
  } else if (isBE) {
    reflection = 'Momentum mulai melemah setelah TP1. Perlindungan modal menjadi keputusan terbaik.';
    lesson     = 'Walaupun TP2 gagal tercapai, trade tetap berkualitas karena disiplin menjaga risiko.';
    motivation = 'Menjaga modal adalah kemenangan tersendiri. Trader yang bertahan, akhirnya akan menang.';
  } else {
    reflection = 'Trade gagal bukan karena strategi buruk. Momentum tidak berlanjut dan harga menyentuh SL.';
    lesson     = 'Evaluasi kondisi market sebelum entry berikutnya. Setiap loss adalah data berharga.';
    motivation = 'Seorang trader profesional bukan yang tidak pernah loss, tapi yang selalu belajar dari loss.';
  }

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `📝 <b>AI TRADE JOURNAL</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `Trade #${signal.id}`,
    ``,
    `${emoji} <b>${outcome}</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🤖 <b>AI Reflection</b>`,
    ``,
    reflection,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>Strategi Digunakan</b>`,
    ``,
    stratLines,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📚 <b>Pelajaran</b>`,
    ``,
    lesson,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `💬 <i>${motivation}</i>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `⚡ <i>AZZAVISION AI | AI Learning Engine</i>`,
    wib.line,
  ].join('\n');
}

// ─── BUILD AI PROMPT ──────────────────────────────────────────────────────────
function buildPrompt(signal, status, closePrice, strategies, stratStats, overallStats) {
  const isWin     = status === 'WIN';
  const isBE      = status === 'BREAKEVEN' || status === 'TP1_BREAKEVEN';
  const isLoss    = status === 'LOSS';
  const duration  = calcDuration(signal.created_at, signal.closed_at || new Date().toISOString());
  const session   = getSessionLabel();

  const outcome   = isWin ? `WIN (+${signal.pips} pips)`
    : isBE ? `BREAKEVEN (TP1_BREAKEVEN — modal terlindungi)`
    : `LOSS (${signal.pips} pips)`;

  const stratLines = (strategies && strategies.length > 0)
    ? strategies.join(', ')
    : 'Multi-Strategy Analysis';

  // Strategi stats untuk self-learning context
  const stratStatsText = stratStats && stratStats.length > 0
    ? stratStats.slice(0, 5).map(st =>
        `${st.name}: ${st.wins}W/${st.losses}L (WR ${st.winRate}%)`
      ).join('\n')
    : 'Belum ada data strategi.';

  // Overall bot performance
  const botPerf = overallStats
    ? `Total: ${overallStats.total} | Win: ${overallStats.wins} | Loss: ${overallStats.losses} | WR: ${overallStats.winRate}% | Net: ${overallStats.netPips} pips`
    : 'Belum ada data.';

  // Current strategy streak context
  const currentStrat  = strategies && strategies.length > 0 ? strategies[0] : 'Unknown';
  const stratEntry    = stratStats ? stratStats.find(st => st.name === currentStrat) : null;
  const stratContext  = stratEntry
    ? `${currentStrat}: ${stratEntry.wins}W / ${stratEntry.losses}L / WR ${stratEntry.winRate}%`
    : `${currentStrat}: Data baru`;

  return `
Kamu adalah Senior Professional Gold Trader dengan pengalaman lebih dari 20 tahun dan mentor trading.
Kamu menganalisis trade XAUUSD yang baru saja selesai dan membuat jurnal trading yang UNIK, MENDALAM, dan BERBEDA setiap kali.
JANGAN menggunakan template. JANGAN mengulang kalimat generik. Analisis harus spesifik sesuai data berikut.

=== DATA TRADE ===
Trade ID     : #${s(signal.id)}
Pair         : XAUUSD
Direction    : ${s(signal.direction)}
Entry        : ${s(signal.entry)}
Close Price  : ${s(closePrice)}
TP1          : ${s(signal.tp1)}
TP2          : ${s(signal.tp2)}
SL           : ${s(signal.sl)}
Profit Pips  : ${s(signal.pips)} pips
Durasi Trade : ${duration}
Outcome      : ${outcome}

=== SETUP TEKNIKAL ===
Strategy     : ${stratLines}
Confidence   : ${s(signal.confidence)}%
TP1 Hit      : ${signal.tp1_hit ? 'YA' : 'TIDAK'}
Breakeven    : ${signal.breakeven_triggered ? 'AKTIF' : 'TIDAK'}

=== MULTI-TIMEFRAME ===
H4 Bias      : ${s(signal.h4_bias || signal.analysis?.h4?.bias)}
H1 Bias      : ${s(signal.h1_bias || signal.analysis?.h1?.bias)}
M15          : ${s(signal.m15_bias || signal.analysis?.m15?.bias)}
M5           : ${s(signal.m5_signal || signal.analysis?.m5?.bias)}
M1           : ${s(signal.m1_bias || signal.analysis?.m1?.bias)}

=== KONTEKS MARKET ===
Session      : ${session}
Trade Open   : ${s(signal.created_at)}
Trade Close  : ${s(signal.closed_at || new Date().toISOString())}

=== AI REVIEW SAAT ENTRY ===
${signal.ai_review ? JSON.stringify(signal.ai_review) : 'Tidak tersedia'}

=== STRATEGI PERFORMANCE ===
${stratStatsText}

=== KONTEKS STRATEGI SAAT INI ===
${stratContext}

=== OVERALL BOT PERFORMANCE ===
${botPerf}

=== INSTRUKSI ===
Buat jurnal trading yang unik dan natural. Gunakan temperatur tinggi agar bahasa bervariasi.
Jangan mengulangi kalimat dari jurnal sebelumnya. Analisis spesifik berdasarkan data di atas.

Untuk ${isWin ? 'WIN' : isBE ? 'BREAKEVEN' : 'LOSS'}:
${isWin ? '- Jelaskan MENGAPA trade ini berhasil secara spesifik\n- Faktor teknikal apa yang paling berkontribusi\n- Apakah confidence 90%+ terbukti akurat\n- Beri nilai setup quality dan jelaskan' : ''}
${isLoss ? '- KRITIK setup jika ada kelemahan\n- Jelaskan faktor kegagalan secara spesifik\n- Apa yang seharusnya berbeda\n- Beri nilai setup quality dan jelaskan' : ''}
${isBE ? '- Jelaskan mengapa BREAKEVEN adalah keputusan tepat\n- Apakah sinyal melemah sebelum TP2\n- Beri nilai setup quality dan jelaskan' : ''}
- Berikan pelajaran trading yang spesifik
- Berikan satu kalimat motivasi profesional yang BERBEDA setiap kali
- Pertimbangkan histori strategi dalam analisis (self-learning)
- Beri saran untuk trade berikutnya

Output HARUS valid JSON dengan struktur berikut:
{
  "reflection": "Analisis mendalam mengapa trade berhasil/gagal (3-5 kalimat, SPESIFIK)",
  "success_factors": ["Faktor 1", "Faktor 2", "Faktor 3"],
  "lesson": "Pelajaran trading yang spesifik dan actionable (2-3 kalimat)",
  "critique": "Kritik jujur jika ada kelemahan setup (1-2 kalimat, atau 'Setup ini sudah baik.')",
  "next_suggestion": "Saran untuk trade berikutnya (1-2 kalimat)",
  "self_learning": "Konteks histori strategi dan implikasinya (1-2 kalimat)",
  "setup_quality_score": 8.5,
  "setup_quality_reason": "Alasan skor setup quality (1-2 kalimat)",
  "motivation": "Satu kalimat motivasi profesional yang unik dan berbeda",
  "ai_evaluation": "Evaluasi singkat apakah confidence akurat dan apakah trade layak dijadikan referensi (1-2 kalimat)"
}`.trim();
}

// ─── FORMAT AI JOURNAL MESSAGE ─────────────────────────────────────────────────
function formatAIJournal(signal, status, closePrice, strategies, aiData) {
  const wib       = toWIB();
  const isWin     = status === 'WIN';
  const isBE      = status === 'BREAKEVEN' || status === 'TP1_BREAKEVEN';
  const pips      = signal.pips || 0;
  const pipSign   = pips > 0 ? '+' : '';

  let outcomeEmoji, outcomeLabel;
  if (isWin) {
    outcomeEmoji  = pips >= 125 ? '🏆' : '✅';
    outcomeLabel  = `WIN TP${pips >= 125 ? '2' : '1'} (${pipSign}${pips} pips)`;
  } else if (isBE) {
    outcomeEmoji  = '🔒';
    outcomeLabel  = status === 'TP1_BREAKEVEN' ? 'TP1 + BREAKEVEN' : 'BREAKEVEN';
  } else {
    outcomeEmoji  = '❌';
    outcomeLabel  = `LOSS (${pips} pips)`;
  }

  const factorEmoji = isWin ? '✅' : isBE ? '🔒' : '⚠️';
  const factorLines = Array.isArray(aiData.success_factors) && aiData.success_factors.length > 0
    ? aiData.success_factors.map(f => `${factorEmoji} ${f}`).join('\n')
    : `${factorEmoji} Analisis faktor tidak tersedia`;

  const qualityScore = typeof aiData.setup_quality_score === 'number'
    ? aiData.setup_quality_score.toFixed(1)
    : '—';

  const lines = [
    `━━━━━━━━━━━━━━━━━━`,
    `📝 <b>AI TRADE JOURNAL</b>`,
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
    isWin  ? `📊 <b>Faktor Keberhasilan</b>` :
    isBE   ? `📊 <b>Faktor Keputusan BE</b>` :
             `📊 <b>Faktor Kegagalan</b>`,
    ``,
    factorLines,
    ``,
  ];

  if (aiData.critique && aiData.critique !== 'Setup ini sudah baik.') {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`⚠️ <b>Kritik AI</b>`);
    lines.push(``);
    lines.push(aiData.critique);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`📚 <b>Pelajaran</b>`);
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

  if (aiData.next_suggestion) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`🎯 <b>Saran Berikutnya</b>`);
    lines.push(``);
    lines.push(aiData.next_suggestion);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`📈 <b>Setup Quality</b>`);
  lines.push(``);
  lines.push(`<b>${qualityScore} / 10</b>`);
  if (aiData.setup_quality_reason) {
    lines.push(aiData.setup_quality_reason);
  }
  lines.push(``);

  if (aiData.ai_evaluation) {
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`🧠 <b>AI Evaluation</b>`);
    lines.push(``);
    lines.push(aiData.ai_evaluation);
    lines.push(``);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  if (aiData.motivation) {
    lines.push(`💬 <i>${aiData.motivation}</i>`);
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
  }
  lines.push(`🤖 <i>AI Trade Journal — AZZAVISION AI | AI Learning Engine</i>`);
  lines.push(wib.line);

  return lines.join('\n');
}

// ─── MAIN EXPORT: generateAITradeJournal ─────────────────────────────────────
/**
 * Generates an AI-powered trade journal message.
 *
 * @param {object} signal      — signal object dari DB (with all fields)
 * @param {string} status      — 'WIN' | 'LOSS' | 'BREAKEVEN' | 'TP1_BREAKEVEN'
 * @param {number} closePrice  — harga saat trade ditutup
 * @param {string[]} strategies — nama strategi yang dipakai
 * @returns {Promise<string>}  — HTML message string untuk Telegram
 */
async function generateAITradeJournal(signal, status, closePrice, strategies) {
  let stratStats    = null;
  let overallStats  = null;

  // Ambil data strategi dan overall stats secara paralel (non-fatal)
  try {
    [stratStats, overallStats] = await Promise.all([
      getAllStrategyStats().catch(() => []),
      getStats().catch(() => null),
    ]);
  } catch {
    stratStats   = [];
    overallStats = null;
  }

  const prompt = buildPrompt(signal, status, closePrice, strategies, stratStats, overallStats);

  try {
    const aiData = await callAI(prompt);

    if (!aiData || !aiData.reflection) {
      console.warn('[AI-JOURNAL] AI returned empty/invalid data — using fallback template');
      return fallbackJournal(signal, status, closePrice, strategies);
    }

    console.log(`[AI-JOURNAL] ✅ Jurnal AI berhasil dibuat untuk Trade #${signal.id} (${status})`);
    return formatAIJournal(signal, status, closePrice, strategies, aiData);

  } catch (err) {
    console.warn('[AI-JOURNAL] AI call gagal — fallback ke template:', err.message);
    return fallbackJournal(signal, status, closePrice, strategies);
  }
}

module.exports = { generateAITradeJournal };
