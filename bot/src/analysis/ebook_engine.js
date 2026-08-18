/**
 * ebook_engine.js — E-Book Strategy Engine
 *
 * Menjalankan semua strategi dari strategy_library.js terhadap data market terkini.
 * Menghasilkan sinyal berbasis strategi e-book (berdampingan dengan AZZAVISION Signal Strategy).
 *
 * Mode: HYBRID — kedua engine berjalan secara independen.
 */

const { runAllStrategies, pickBestEbookSignal } = require('./strategy_library');
const { isMarketOpen } = require('../utils/market_hours');
const { validatePrice, validateSignal } = require('../utils/signal_validator');
const { getAllTimeframes }   = require('../market/data');
const { calculateSignal }   = require('./strategy');
const { insertSignal }      = require('../database/db');
const { generateSignalChart } = require('../chart/generator');
const { getPriceCache }     = require('../market/cache');

// ─── FORMAT EBOOK SIGNAL MESSAGE ─────────────────────────────────────────────
function formatEbookSignalMessage(signal, levels, ebookResult) {
  // FIX: direction diambil dari signal (ebookResult), BUKAN dari levels.
  // calculateSignal() hanya mengembalikan { entry, tp1, tp2, sl } tanpa direction.
  const direction = signal.direction;
  const { entry, tp1, tp2, sl } = levels;

  const dir = direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';

  const riskPips  = Math.abs(entry - sl);
  const pipsTp1   = Math.round(Math.abs(tp1 - entry) / 0.1);
  const pipsTp2   = Math.round(Math.abs(tp2 - entry) / 0.1);
  const pipsSl    = Math.round(riskPips / 0.1);
  const rrTp1     = (Math.abs(tp1 - entry) / riskPips).toFixed(2);
  const rrTp2     = (Math.abs(tp2 - entry) / riskPips).toFixed(2);

  const supportingLine = ebookResult.supportingStrategies && ebookResult.supportingStrategies.length > 0
    ? `\n📚 <b>Confluences</b>: ${ebookResult.supportingStrategies.join(', ')}`
    : '';

  const confirmsLines = (ebookResult.confirmations || []).map(c => `   ✅ ${c}`).join('\n');

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `📚 <b>AZZAVISION AI — E-BOOK SIGNAL</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🪙 <b>Pair</b>    : <code>XAUUSD</code>`,
    ``,
    `${dir}`,
    `<b>Direction : ${direction}</b>`,
    ``,
    `🎯 <b>Entry</b>   : <code>${entry.toFixed(2)}</code>`,
    ``,
    `💰 <b>TP1</b>     : <code>${tp1.toFixed(2)}</code>  (+${pipsTp1} pips | R:R 1:${rrTp1})`,
    `💰 <b>TP2</b>     : <code>${tp2.toFixed(2)}</code>  (+${pipsTp2} pips | R:R 1:${rrTp2})`,
    ``,
    `🛑 <b>SL</b>      : <code>${sl.toFixed(2)}</code>  (${pipsSl} pips)`,
    `🔒 <b>BE Trigger</b>: +28 pips dari entry`,
    ``,
    `📡 <b>Confidence</b> : <code>${ebookResult.confidence}%</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `📚 <b>Strategy</b>:`,
    `   ${ebookResult.strategyName}`,
    ``,
    `📖 <b>Referensi</b>:`,
    `   ${ebookResult.ebookRef}`,
    ``,
    `📝 <b>Reason</b>:`,
    `   ${ebookResult.reason}`,
    ``,
    `🔍 <b>Confirmasi</b>:`,
    confirmsLines,
    supportingLine,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `⚡ <i>E-Book Strategy Engine | AZZAVISION AI v2.5.0</i>`,
    `⚠️ <i>Manage risk. Max 1-2% per trade.</i>`,
  ].filter(l => l !== undefined).join('\n');
}

// ─── RUN EBOOK ENGINE ─────────────────────────────────────────────────────────
// Jalankan semua strategi e-book, kembalikan sinyal terbaik jika ada
async function runEbookEngine(tfData) {
  try {
    const candles = tfData || await getAllTimeframes();
    const minConf = parseInt(process.env.MIN_CONFIDENCE || '65');

    const allSignals  = runAllStrategies(candles);
    const bestSignal  = pickBestEbookSignal(allSignals, minConf);

    return {
      allSignals,
      bestSignal,
      totalChecked: allSignals.length,
    };
  } catch (e) {
    console.warn('[EBOOK-ENGINE] Error:', e.message);
    return { allSignals: [], bestSignal: null, totalChecked: 0 };
  }
}

// ─── BROADCAST EBOOK SIGNAL ───────────────────────────────────────────────────
// Kirim sinyal ke channel dan simpan ke DB (sama seperti Abang WAN signal)
async function broadcastEbookSignal(bot, ebookResult, currentPrice) {
  const channelId = process.env.CHANNEL_ID;
  if (!channelId) return null;

  // Guard: jangan broadcast saat market tutup
  if (!isMarketOpen()) {
    console.log('[EBOOK-ENGINE] Market CLOSED — skip broadcast');
    return null;
  }

  const { direction, confidence } = ebookResult;

  // Validasi harga sebelum calculateSignal
  const priceCheck = validatePrice(currentPrice);
  if (!priceCheck.valid) {
    console.warn(`[EBOOK-ENGINE] ⛔ Harga tidak valid — ${priceCheck.reason}`);
    return null;
  }

  // Validasi direction
  if (!['BUY','SELL'].includes(direction)) {
    console.warn(`[EBOOK-ENGINE] ⛔ Direction tidak valid: ${direction}`);
    return null;
  }

  const levels = calculateSignal(currentPrice, direction);

  // Validasi hasil calculateSignal
  const sigCheck = validateSignal({ direction, ...levels });
  if (!sigCheck.valid) {
    console.warn(`[EBOOK-ENGINE] ⛔ Signal tidak valid — ${sigCheck.reason}`);
    return null;
  }

  // FIX: Teruskan direction ke dalam object levels agar formatEbookSignalMessage
  // menerima satu object signal yang konsisten.
  const message = formatEbookSignalMessage(ebookResult, levels, ebookResult);

  let signalId = null;
  try {
    // Build fake analysis object untuk chart
    const fakeAnalysis = {
      m1:  { bias: 'NEUTRAL',  strength: 50, rsi: 50 },
      m5:  { bias: direction,  strength: 65, rsi: 50 },
      m15: { bias: direction,  strength: 60, rsi: 50 },
      h1:  { bias: direction,  strength: 70, rsi: 50 },
      h4:  { bias: direction,  strength: 75, rsi: 50 },
    };

    const chartBuf = await generateSignalChart({
      direction,
      entry:      levels.entry,
      tp1:        levels.tp1,
      tp2:        levels.tp2,
      sl:         levels.sl,
      confidence,
      analysis:   fakeAnalysis,
    }).catch(() => null);

    let sentMsg = null;
    if (chartBuf) {
      sentMsg = await bot.telegram.sendPhoto(channelId, { source: chartBuf }, {
        caption:    message,
        parse_mode: 'HTML',
      });
    } else {
      sentMsg = await bot.telegram.sendMessage(channelId, message, { parse_mode: 'HTML' });
    }

    // 📌 Pin sinyal — hanya sinyal yang dipin, bukan watchlist/notif lain.
    let pinnedMessageId = null;
    try {
      if (sentMsg && sentMsg.message_id) {
        await bot.telegram.pinChatMessage(channelId, sentMsg.message_id);
        pinnedMessageId = sentMsg.message_id;
        console.log(`[EBOOK-ENGINE] 📌 Signal ter-pin (#${pinnedMessageId})`);
      }
    } catch (pinErr) {
      console.warn('[EBOOK-ENGINE] Gagal pin sinyal:', pinErr.message);
    }

    // Save to DB
    signalId = await insertSignal({
      direction,
      entry:      levels.entry,
      tp1:        levels.tp1,
      tp2:        levels.tp2,
      sl:         levels.sl,
      confidence,
      strategy:   `EBOOK:${ebookResult.strategyName}`,
      pinned_message_id: pinnedMessageId,
    });

    console.log(`[EBOOK-ENGINE] ✅ Signal #${signalId} terkirim (${direction} @ ${levels.entry} | ${ebookResult.strategyName})`);
  } catch (err) {
    console.error('[EBOOK-ENGINE] Broadcast error:', err.message);
  }

  return signalId;
}

module.exports = {
  runEbookEngine,
  broadcastEbookSignal,
  formatEbookSignalMessage,
};
