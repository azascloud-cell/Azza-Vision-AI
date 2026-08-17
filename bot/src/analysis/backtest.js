const { fetchCandles } = require('../market/data');
const { analyzeTimeframe, calculateSignal } = require('./strategy');
const {
  ema, rsi, atr,
  isRejectionCandle, isSidewaysCandle,
  detectBOS, detectCHOCH, detectLiquiditySweep,
} = require('./indicators');

const POINTS     = 0.1;
const SL_POINTS  = 40 * POINTS;
const TP1_POINTS = 60 * POINTS;
const TP2_POINTS = 125 * POINTS;
const BE_TRIGGER = 28 * POINTS;   // Profit >= 28 pips → aktifkan BE

async function fetchHistoricalCandles(days) {
  const m5Count  = Math.min(days * 24 * 12, 5000);
  const h1Count  = Math.min(days * 24, 500);
  const h4Count  = Math.min(days * 6, 200);

  const [m5, h1, h4] = await Promise.all([
    fetchCandles('5m',  m5Count),
    fetchCandles('60m', h1Count),
    fetchCandles('4h',  h4Count),
  ]);
  return { m5, h1, h4 };
}

function analyzeWindow(m5Window, h1Window, h4Window) {
  if (m5Window.length < 30 || h1Window.length < 10 || h4Window.length < 10) return null;

  const h4Analysis = analyzeTimeframe(h4Window);
  const h1Analysis = analyzeTimeframe(h1Window);

  const h4Bull = h4Analysis.bias.includes('BUY');
  const h4Bear = h4Analysis.bias.includes('SELL');
  const h1Bull = h1Analysis.bias.includes('BUY');
  const h1Bear = h1Analysis.bias.includes('SELL');

  const aligned = (h4Bull && h1Bull) || (h4Bear && h1Bear);
  if (!aligned) return null;

  const direction = h4Bull && h1Bull ? 'BUY' : 'SELL';

  const lastM5 = m5Window[m5Window.length - 1];
  if (isSidewaysCandle(lastM5)) return null;

  const body = Math.abs(lastM5.close - lastM5.open);
  const range = lastM5.high - lastM5.low;
  if (range === 0 || body / range < 0.2) return null;

  const atrArr = atr(m5Window, 14);
  const lastAtr = atrArr[atrArr.length - 1];
  if (body < lastAtr * 0.3) return null;

  if (!isRejectionCandle(lastM5, direction)) return null;

  const sweep = detectLiquiditySweep(m5Window);
  const bos   = detectBOS(m5Window);

  let confidence = 50;
  if (h4Analysis.bias.includes('STRONG')) confidence += 15;
  else confidence += 8;
  if (h1Analysis.bias.includes('STRONG')) confidence += 15;
  else confidence += 8;
  if (sweep) confidence += 10;
  if (bos)   confidence += 10;
  confidence = Math.min(confidence, 97);

  if (confidence < parseInt(process.env.MIN_CONFIDENCE || '65')) return null;

  const entry = lastM5.close;
  const levels = calculateSignal(entry, direction);

  return { direction, entry: levels.entry, tp1: levels.tp1, tp2: levels.tp2, sl: levels.sl, confidence, time: lastM5.time };
}

// ─── SIMULATE TRADE (dengan Breakeven logic yang benar) ───────────────────────
// Breakeven: jika profit >= BE_TRIGGER (28 pips), pindah SL ke entry.
// Setelah BE aktif: jika harga kembali ke entry = BREAKEVEN, bukan LOSS.
function simulateTrade(signal, futureCandles) {
  const { direction, entry, tp1, tp2, sl: originalSl } = signal;
  let result     = 'OPEN';
  let tp1Reached = false;
  let beActive   = false;
  let effectiveSl = originalSl;
  let pips       = 0;

  for (const candle of futureCandles) {
    if (direction === 'BUY') {
      // Cek profit saat ini untuk BE
      const currentProfit = candle.high - entry;
      if (!beActive && currentProfit >= BE_TRIGGER) {
        beActive    = true;
        effectiveSl = entry;  // SL dipindah ke entry
      }

      // TP1 check
      if (!tp1Reached && candle.high >= tp1) {
        tp1Reached = true;
        // Tidak ditutup — monitor terus ke TP2
      }

      // TP2: WIN penuh
      if (candle.high >= tp2) {
        result = 'WIN';
        pips   = 125;
        break;
      }

      // SL / BE check
      if (candle.low <= effectiveSl) {
        if (beActive && tp1Reached) {
          result = 'TP1_BREAKEVEN';
          pips   = 0;
        } else if (beActive) {
          result = 'BREAKEVEN';
          pips   = 0;
        } else {
          result = 'LOSS';
          pips   = -40;
        }
        break;
      }
    } else {
      // SELL
      const currentProfit = entry - candle.low;
      if (!beActive && currentProfit >= BE_TRIGGER) {
        beActive    = true;
        effectiveSl = entry;
      }

      if (!tp1Reached && candle.low <= tp1) {
        tp1Reached = true;
      }

      if (candle.low <= tp2) {
        result = 'WIN';
        pips   = 125;
        break;
      }

      if (candle.high >= effectiveSl) {
        if (beActive && tp1Reached) {
          result = 'TP1_BREAKEVEN';
          pips   = 0;
        } else if (beActive) {
          result = 'BREAKEVEN';
          pips   = 0;
        } else {
          result = 'LOSS';
          pips   = -40;
        }
        break;
      }
    }
  }

  // Trade masih open di akhir candle yang tersedia
  if (result === 'OPEN') {
    if (tp1Reached) {
      // TP1 sempat tercapai tapi TP2 belum — anggap WIN dari TP1 saja
      result = 'WIN';
      pips   = 60;
    } else {
      result = 'OPEN';
      pips   = 0;
    }
  }

  const hitTP = result === 'WIN' ? (pips === 125 ? 'TP2' : 'TP1') : null;
  return { result, pips, hitTP, tp1Reached, beTriggered: beActive };
}

async function runBacktest(days) {
  const { m5, h1, h4 } = await fetchHistoricalCandles(days);

  const cutoff     = Date.now() - days * 24 * 60 * 60 * 1000;
  const m5Filtered = m5.filter(c => c.time >= cutoff);

  const signals  = [];
  const WINDOW_M5 = 60;
  const STEP      = 15;

  for (let i = WINDOW_M5; i < m5Filtered.length - 20; i += STEP) {
    const m5Window  = m5Filtered.slice(i - WINDOW_M5, i);
    const windowEnd = m5Window[m5Window.length - 1].time;

    const h1Window = h1.filter(c => c.time <= windowEnd).slice(-30);
    const h4Window = h4.filter(c => c.time <= windowEnd).slice(-30);

    if (h1Window.length < 10 || h4Window.length < 10) continue;

    const signal = analyzeWindow(m5Window, h1Window, h4Window);
    if (!signal) continue;

    if (signals.length > 0) {
      const lastSig = signals[signals.length - 1];
      if (signal.time - lastSig.time < 4 * 60 * 60 * 1000) continue;
    }

    const futureCandles = m5Filtered.slice(i, i + 100);
    const tradeResult   = simulateTrade(signal, futureCandles);

    signals.push({
      ...signal,
      ...tradeResult,
      date: new Date(signal.time).toISOString().slice(0, 10),
    });
  }

  const closed      = signals.filter(s => s.result !== 'OPEN');
  const wins        = closed.filter(s => s.result === 'WIN');
  const losses      = closed.filter(s => s.result === 'LOSS');
  const breakevens  = closed.filter(s => s.result === 'BREAKEVEN' || s.result === 'TP1_BREAKEVEN');
  const tp1Hits     = wins.filter(s => s.hitTP === 'TP1').length;
  const tp2Hits     = wins.filter(s => s.hitTP === 'TP2').length;
  const beCount     = breakevens.length;
  const netPips     = closed.reduce((s, t) => s + t.pips, 0);
  const winPips     = wins.reduce((s, t) => s + t.pips, 0);
  const lossPips    = Math.abs(losses.reduce((s, t) => s + t.pips, 0));

  const decidedTrades = wins.length + losses.length;
  const winRate       = decidedTrades > 0 ? ((wins.length / decidedTrades) * 100).toFixed(2) : '0.00';
  const profitFactor  = lossPips > 0 ? (winPips / lossPips).toFixed(2) : wins.length > 0 ? '∞' : '0.00';
  const avgConf       = signals.length > 0 ? (signals.reduce((s, t) => s + t.confidence, 0) / signals.length).toFixed(1) : '0';
  const maxDD         = calcMaxDrawdown(signals);

  // R:R stats
  const rrTp1  = (TP1_POINTS / SL_POINTS).toFixed(2);
  const rrTp2  = (TP2_POINTS / SL_POINTS).toFixed(2);

  return {
    days,
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: beCount,
    tp1Hits,
    tp2Hits,
    netPips: netPips.toFixed(1),
    winRate,
    profitFactor,
    avgConf,
    maxDD: maxDD.toFixed(1),
    rrTp1,
    rrTp2,
    signals,
  };
}

function calcMaxDrawdown(signals) {
  let peak = 0, dd = 0, runningPnl = 0;
  for (const s of signals) {
    if (s.result === 'OPEN') continue;
    runningPnl += s.pips;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > dd) dd = drawdown;
  }
  return dd;
}

module.exports = { runBacktest };
