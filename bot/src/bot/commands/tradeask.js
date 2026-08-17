/**
 * tradeask.js — /tradeask <id> <pertanyaan>
 *
 * Owner dapat mengajukan pertanyaan spesifik tentang trade tertentu.
 * Groq menjawab BERDASARKAN SNAPSHOT SAAT ENTRY — bukan market sekarang.
 */

'use strict';

const { getSignalById } = require('../../database/db');
const { callAI }        = require('../../analysis/ai_engine');
const { toWIB, isoToWIBShort } = require('../../utils/wib_time');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── MESSAGE SPLITTER (Telegram max 4096 chars per message) ───────────────────
function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { parts.push(remaining); break; }
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < maxLen / 2) cut = maxLen;
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return parts;
}

async function safeSendHTML(ctx, text, extra) {
  const parts = splitMessage(text);
  for (let i = 0; i < parts.length; i++) {
    const opts = (i === parts.length - 1 && extra) ? extra : {};
    await ctx.replyWithHTML(parts[i], opts);
  }
}

function sv(v) {
  if (v === null || v === undefined) return 'N/A';
  return String(v);
}

function calcDuration(openAt, closeAt) {
  try {
    const ms = new Date(closeAt) - new Date(openAt);
    if (isNaN(ms) || ms < 0) return 'N/A';
    const h  = Math.floor(ms / 3_600_000);
    const m  = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}j ${m}m` : `${m} menit`;
  } catch { return 'N/A'; }
}

// ─── PENDING QUESTIONS STATE (in-memory) ────────────────────────────────────
// Tracks users waiting to type their question after /tradeask <id>
const pendingQuestions = new Map(); // userId -> { tradeId, expiresAt }

function setPendingQuestion(userId, tradeId) {
  pendingQuestions.set(String(userId), {
    tradeId,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
  });
}

function getPendingQuestion(userId) {
  const entry = pendingQuestions.get(String(userId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    pendingQuestions.delete(String(userId));
    return null;
  }
  return entry;
}

function clearPendingQuestion(userId) {
  pendingQuestions.delete(String(userId));
}

// ─── BUILD ASK PROMPT ────────────────────────────────────────────────────────
function buildAskPrompt(signal, question) {
  const snapshot   = signal.snapshot || {};
  const duration   = calcDuration(signal.created_at, signal.closed_at);

  const h4  = snapshot.h4  || signal.h4_bias  || 'N/A';
  const h1  = snapshot.h1  || signal.h1_bias  || 'N/A';
  const m15 = snapshot.m15 || signal.m15_bias || 'N/A';
  const m5  = snapshot.m5  || signal.m5_signal || 'N/A';
  const m1  = snapshot.m1  || signal.m1_bias  || 'N/A';
  const session    = snapshot.session    || signal.session    || 'N/A';
  const volatility = snapshot.volatility || signal.volatility || 'N/A';
  const newsSummary = snapshot.news_summary || signal.news_summary || 'Tidak tersedia';
  const entryReasons = snapshot.entry_reasons || signal.entry_reasons || 'N/A';
  const stratName  = signal.strategy || 'Multi-Strategy Analysis';
  const ensembleScore = snapshot.ensemble_score || 'N/A';

  const aiReview = signal.ai_review;
  const aiReviewText = aiReview
    ? `Verdict: ${aiReview.verdict || 'N/A'} | Score: ${aiReview.score || 'N/A'}`
    : 'Tidak tersedia';

  return `
Kamu adalah Senior Professional Gold Trader dengan pengalaman lebih dari 20 tahun.
Kamu menjawab pertanyaan tentang trade XAUUSD yang sudah SELESAI.

PENTING: Jawaban HARUS berdasarkan snapshot kondisi market SAAT TRADE TERJADI.
JANGAN menggunakan kondisi market saat ini.
JANGAN memberikan jawaban generik.

=== DATA TRADE #${sv(signal.id)} ===
Pair         : XAUUSD
Direction    : ${sv(signal.direction)}
Entry        : ${sv(signal.entry)}
TP1          : ${sv(signal.tp1)}
TP2          : ${sv(signal.tp2)}
SL           : ${sv(signal.sl)}
Close Price  : ${sv(signal.close_price || 'N/A')}
Profit Pips  : ${sv(signal.pips)} pips
Hasil        : ${sv(signal.status)}
Durasi       : ${duration}
Confidence   : ${sv(signal.confidence)}%
TP1 Hit      : ${signal.tp1_hit ? 'YA' : 'TIDAK'}
Breakeven    : ${signal.breakeven_triggered ? 'AKTIF' : 'TIDAK'}

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

=== BERITA SAAT ENTRY ===
${sv(newsSummary)}

=== AI REVIEW SEBELUM ENTRY ===
${aiReviewText}

=== STRATEGI ===
${sv(stratName)}

=== PERTANYAAN DARI TRADER ===
${question}

=== TUGAS ===
Jawab pertanyaan di atas secara mendalam, spesifik, dan berdasarkan data trade tersebut.
Gunakan bahasa Indonesia yang profesional dan ramah.
Jika pertanyaan melibatkan skenario hipotetis ("kalau...", "seandainya..."), analisis berdasarkan kondisi SAAT ITU.

Output HARUS valid JSON:
{
  "answer": "Jawaban lengkap dan mendalam berdasarkan data trade (3-6 kalimat spesifik)",
  "key_points": ["Poin kunci 1", "Poin kunci 2", "Poin kunci 3"],
  "follow_up_hint": "Pertanyaan lanjutan yang mungkin berguna untuk trader (opsional)"
}`.trim();
}

// ─── HANDLE QUESTION ────────────────────────────────────────────────────────
async function handleTradeQuestion(ctx, signal, question) {
  const loadMsg = await ctx.replyWithHTML(`⏳ <b>Groq sedang menganalisis Trade #${signal.id}...</b>`).catch(() => null);

  try {
    const prompt  = buildAskPrompt(signal, question);
    const aiData  = await callAI(prompt);
    const wib     = toWIB();

    if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});

    if (!aiData || !aiData.answer) {
      return ctx.replyWithHTML([
        `❓ <b>Tanya AI — Trade #${signal.id}</b>`,
        ``,
        `<b>Pertanyaan:</b> ${question}`,
        ``,
        `⚠️ <i>AI tidak tersedia saat ini. Coba lagi nanti.</i>`,
      ].join('\n'));
    }

    const keyPoints = Array.isArray(aiData.key_points) && aiData.key_points.length > 0
      ? '\n\n<b>Poin Kunci:</b>\n' + aiData.key_points.map(p => `• ${p}`).join('\n')
      : '';

    const followUp = aiData.follow_up_hint
      ? `\n\n💡 <i>${aiData.follow_up_hint}</i>`
      : '';

    const { Markup } = require('telegraf');
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('❓ Tanya Lagi', `tradeask_start_${signal.id}`),
        Markup.button.callback('📖 Full Replay', `replay_${signal.id}`),
      ],
    ]);

    await safeSendHTML(ctx, [
      `━━━━━━━━━━━━━━━━━━`,
      `❓ <b>TANYA AI — Trade #${signal.id}</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `<b>Pertanyaan:</b>`,
      question,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `🤖 <b>Jawaban AI</b>`,
      ``,
      aiData.answer + keyPoints + followUp,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `⚡ <i>Groq AI — Berdasarkan snapshot Trade #${signal.id}</i>`,
      wib.line,
    ].join('\n'), keyboard);

  } catch (err) {
    console.error('[TRADEASK] Error:', err.message);
    if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
    await ctx.replyWithHTML(`❌ <b>Gagal mendapatkan jawaban AI.</b>\n<code>${err.message}</code>`);
  }
}

// ─── REGISTER COMMAND ────────────────────────────────────────────────────────
function registerTradeAsk(bot) {
  bot.command('tradeask', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Perintah ini hanya untuk owner.</b>');
    }

    const text   = ctx.message?.text?.trim() || '';
    const parts  = text.split(/\s+/);
    const rawId  = parts[1];

    if (!rawId || isNaN(Number(rawId))) {
      return ctx.replyWithHTML([
        `❓ <b>TANYA AI TENTANG TRADE</b>`,
        ``,
        `Penggunaan:`,
        `<code>/tradeask &lt;id&gt; &lt;pertanyaan&gt;</code>`,
        ``,
        `Atau dua langkah:`,
        `<code>/tradeask &lt;id&gt;</code>  → bot akan meminta pertanyaan`,
        ``,
        `Contoh:`,
        `<code>/tradeask 51 Kenapa AI memilih SELL?</code>`,
        `<code>/tradeask 51 Kalau entry 5 menit lebih lambat bagaimana?</code>`,
        `<code>/tradeask 51 Apa kelemahan utama trade ini?</code>`,
      ].join('\n'));
    }

    const id       = Number(rawId);
    const question = parts.slice(2).join(' ').trim();

    try {
      const signal = await getSignalById(id);

      if (!signal) {
        return ctx.replyWithHTML(`❌ Trade #${id} tidak ditemukan.`);
      }

      if (signal.status === 'OPEN') {
        return ctx.replyWithHTML(`⏳ Trade #${id} masih <b>OPEN</b>. Pertanyaan hanya tersedia setelah trade selesai.`);
      }

      if (!question) {
        // Dua-langkah: minta pertanyaan
        setPendingQuestion(ctx.from.id, id);
        return ctx.replyWithHTML([
          `❓ <b>TANYA AI — Trade #${id}</b>`,
          ``,
          `<b>Hasil   :</b> <code>${signal.status} (${signal.pips >= 0 ? '+' : ''}${signal.pips} pips)</code>`,
          `<b>Direction:</b> <code>${signal.direction}</code>`,
          `<b>Entry  :</b> <code>${signal.entry}</code>`,
          ``,
          `Ketik pertanyaanmu sekarang. Contoh:`,
          `• <i>Kenapa AI memilih SELL?</i>`,
          `• <i>Kenapa TP cuma 125 pips?</i>`,
          `• <i>Apakah entry bisa lebih bagus?</i>`,
          `• <i>Kalau entry 5 menit lebih lambat bagaimana?</i>`,
          `• <i>Apa kelemahan trade ini?</i>`,
          ``,
          `⏰ <i>Pertanyaan akan kedaluwarsa dalam 5 menit.</i>`,
        ].join('\n'));
      }

      // Langsung jawab
      await handleTradeQuestion(ctx, signal, question);

    } catch (err) {
      console.error('[TRADEASK] Error:', err.message);
      await ctx.replyWithHTML(`❌ <b>Gagal.</b>\n<code>${err.message}</code>`);
    }
  });

  // ── Intercept pending questions ────────────────────────────────────────────
  bot.on('message', async (ctx, next) => {
    const text = ctx.message?.text || '';
    if (text.startsWith('/')) return next(); // let command handlers handle it

    if (!isOwner(ctx)) return next();

    const pending = getPendingQuestion(ctx.from?.id);
    if (!pending) return next();

    // User answered the pending question
    clearPendingQuestion(ctx.from.id);

    try {
      const signal = await getSignalById(pending.tradeId);
      if (!signal) {
        await ctx.replyWithHTML(`❌ Trade #${pending.tradeId} tidak ditemukan.`);
        return next();
      }
      await handleTradeQuestion(ctx, signal, text);
    } catch (err) {
      console.error('[TRADEASK-PENDING] Error:', err.message);
    }

    return next();
  });
}

module.exports = { registerTradeAsk, setPendingQuestion, getPendingQuestion, clearPendingQuestion, handleTradeQuestion };
