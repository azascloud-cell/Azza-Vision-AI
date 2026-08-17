/**
 * ensemble.js — Ensemble Strategy Scoring
 *
 * Daripada mengandalkan satu strategi, gabungkan beberapa teknik:
 *   Trendline     → +20 poin
 *   Engulfing     → +15 poin
 *   Supply&Demand → +25 poin
 *   Divergence    → +10 poin
 *   Fibonacci     → +15 poin
 *   EMA Trend     → +10 poin
 *   BOS/CHOCH     → +10 poin
 *   Risk Filter   → validasi akhir (multiplier)
 *
 * Jika total skor ≥ 75 → sinyal valid (bisa dikonfigurasi via ENV ENSEMBLE_MIN_SCORE)
 */

const { ema, rsi, atr, macd, detectBOS, detectCHOCH, detectLiquiditySweep } = require('./indicators');

const ENSEMBLE_MIN_SCORE = parseInt(process.env.ENSEMBLE_MIN_SCORE || '75');

// ─── DETEKSI TRENDLINE BOUNCE ──────────────────────────────────────────────────
function detectTrendlineBounce(candles, direction) {
  if (!candles || candles.length < 20) return { active: false, score: 0 };

  const last20  = candles.slice(-20);
  const lows    = last20.map(c => c.low);
  const highs   = last20.map(c => c.high);
  const last    = candles[candles.length - 1];

  if (direction === 'BUY') {
    // Trendline naik: swing low semakin tinggi
    const minLow  = Math.min(...lows);
    const maxLow  = Math.max(...lows);
    const trendUp = lows[lows.length - 1] > lows[0];
    // Harga mendekati trendline (±0.3% dari swing low terakhir)
    const swingLowLast = Math.min(...lows.slice(-5));
    const near    = last.low <= swingLowLast * 1.003;
    if (trendUp && near) return { active: true, score: 20, reason: 'Trendline Bounce Bullish' };
  } else {
    // Trendline turun: swing high semakin rendah
    const trendDown = highs[highs.length - 1] < highs[0];
    const swingHighLast = Math.max(...highs.slice(-5));
    const near    = last.high >= swingHighLast * 0.997;
    if (trendDown && near) return { active: true, score: 20, reason: 'Trendline Bounce Bearish' };
  }

  return { active: false, score: 0 };
}

// ─── DETEKSI ENGULFING ─────────────────────────────────────────────────────────
function detectEngulfing(candles, direction) {
  if (!candles || candles.length < 3) return { active: false, score: 0 };

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  if (direction === 'BUY') {
    const prevBearish  = prev.close < prev.open;
    const lastBullish  = last.close > last.open;
    const engulfs      = last.open <= prev.close && last.close >= prev.open;
    if (prevBearish && lastBullish && engulfs) {
      return { active: true, score: 15, reason: 'Bullish Engulfing' };
    }
  } else {
    const prevBullish  = prev.close > prev.open;
    const lastBearish  = last.close < last.open;
    const engulfs      = last.open >= prev.close && last.close <= prev.open;
    if (prevBullish && lastBearish && engulfs) {
      return { active: true, score: 15, reason: 'Bearish Engulfing' };
    }
  }

  return { active: false, score: 0 };
}

// ─── DETEKSI SUPPLY & DEMAND ZONE ─────────────────────────────────────────────
function detectSupplyDemand(candles, direction) {
  if (!candles || candles.length < 30) return { active: false, score: 0 };

  const last50   = candles.slice(-50);
  const last      = candles[candles.length - 1];
  const atrArr    = atr(candles, 14);
  const lastAtr   = atrArr[atrArr.length - 1] || 0.5;

  // Cari area konsolidasi (base candle) sebelum move besar
  for (let i = last50.length - 10; i >= 5; i--) {
    const base = last50[i];
    const baseBody = Math.abs(base.close - base.open);
    const isBase   = baseBody < lastAtr * 0.5; // candle kecil = base

    if (!isBase) continue;

    // Demand zone: base di bawah, harga kembali ke sana dari atas
    if (direction === 'BUY') {
      const zoneTop    = Math.max(base.open, base.close) + lastAtr * 0.3;
      const zoneBottom = Math.min(base.open, base.close) - lastAtr * 0.3;
      if (last.low <= zoneTop && last.high >= zoneBottom) {
        return { active: true, score: 25, reason: `Demand Zone @ ${zoneBottom.toFixed(2)}-${zoneTop.toFixed(2)}` };
      }
    }

    // Supply zone: base di atas, harga kembali ke sana dari bawah
    if (direction === 'SELL') {
      const zoneTop    = Math.max(base.open, base.close) + lastAtr * 0.3;
      const zoneBottom = Math.min(base.open, base.close) - lastAtr * 0.3;
      if (last.high >= zoneBottom && last.low <= zoneTop) {
        return { active: true, score: 25, reason: `Supply Zone @ ${zoneBottom.toFixed(2)}-${zoneTop.toFixed(2)}` };
      }
    }
  }

  return { active: false, score: 0 };
}

// ─── DETEKSI RSI DIVERGENCE ────────────────────────────────────────────────────
function detectDivergence(candles, direction) {
  if (!candles || candles.length < 20) return { active: false, score: 0 };

  const rsiArr = rsi(candles, 14);
  if (rsiArr.length < 10) return { active: false, score: 0 };

  const last5Prices = candles.slice(-10).map(c => c.close);
  const last5Rsi    = rsiArr.slice(-10);

  if (direction === 'BUY') {
    // Harga Lower Low tapi RSI Higher Low → Bullish Divergence
    const priceLowerLow = last5Prices[last5Prices.length - 1] < Math.min(...last5Prices.slice(0, -1));
    const rsiHigherLow  = last5Rsi[last5Rsi.length - 1] > Math.min(...last5Rsi.slice(0, -1));
    if (priceLowerLow && rsiHigherLow && last5Rsi[last5Rsi.length - 1] < 45) {
      return { active: true, score: 10, reason: 'RSI Bullish Divergence' };
    }
  } else {
    // Harga Higher High tapi RSI Lower High → Bearish Divergence
    const priceHigherHigh = last5Prices[last5Prices.length - 1] > Math.max(...last5Prices.slice(0, -1));
    const rsiLowerHigh    = last5Rsi[last5Rsi.length - 1] < Math.max(...last5Rsi.slice(0, -1));
    if (priceHigherHigh && rsiLowerHigh && last5Rsi[last5Rsi.length - 1] > 55) {
      return { active: true, score: 10, reason: 'RSI Bearish Divergence' };
    }
  }

  return { active: false, score: 0 };
}

// ─── DETEKSI FIBONACCI 61.8% ───────────────────────────────────────────────────
function detectFibonacci(candles, direction) {
  if (!candles || candles.length < 30) return { active: false, score: 0 };

  const last30 = candles.slice(-30);
  const highs  = last30.map(c => c.high);
  const lows   = last30.map(c => c.low);
  const swing_high = Math.max(...highs);
  const swing_low  = Math.min(...lows);
  const last       = candles[candles.length - 1];
  const range      = swing_high - swing_low;

  if (range < 0.1) return { active: false, score: 0 };

  // Fibonacci levels
  const fib618 = direction === 'BUY'
    ? swing_high - range * 0.618
    : swing_low  + range * 0.618;

  const fib50  = direction === 'BUY'
    ? swing_high - range * 0.5
    : swing_low  + range * 0.5;

  const tolerance = range * 0.03; // 3% toleransi

  const near618 = Math.abs(last.close - fib618) <= tolerance;
  const near50  = Math.abs(last.close - fib50)  <= tolerance;

  if (near618) return { active: true, score: 15, reason: `Fibo 61.8% @ ${fib618.toFixed(2)}` };
  if (near50)  return { active: true, score: 8,  reason: `Fibo 50% @ ${fib50.toFixed(2)}` };

  return { active: false, score: 0 };
}

// ─── DETEKSI EMA TREND ALIGNMENT ──────────────────────────────────────────────
function detectEmaTrend(candles, direction) {
  if (!candles || candles.length < 55) return { active: false, score: 0 };

  const ema20 = ema(candles, 20);
  const ema50 = ema(candles, 50);
  const last  = candles[candles.length - 1];

  const e20 = ema20[ema20.length - 1];
  const e50 = ema50[ema50.length - 1];

  if (direction === 'BUY'  && e20 > e50 && last.close > e20) return { active: true, score: 10, reason: 'EMA Bullish Stack' };
  if (direction === 'SELL' && e20 < e50 && last.close < e20) return { active: true, score: 10, reason: 'EMA Bearish Stack' };

  return { active: false, score: 0 };
}

// ─── DETEKSI BOS/CHOCH ─────────────────────────────────────────────────────────
function detectStructure(candles, direction) {
  if (!candles || candles.length < 20) return { active: false, score: 0 };

  const bos   = detectBOS(candles);
  const choch = detectCHOCH(candles);
  const sweep = detectLiquiditySweep(candles);

  if (direction === 'BUY') {
    if (bos   === 'BULLISH_BOS')   return { active: true, score: 10, reason: 'Bullish BOS' };
    if (choch === 'BULLISH_CHOCH') return { active: true, score: 8,  reason: 'Bullish CHOCH' };
    if (sweep === 'BULLISH_SWEEP') return { active: true, score: 6,  reason: 'Bullish Liquidity Sweep' };
  } else {
    if (bos   === 'BEARISH_BOS')   return { active: true, score: 10, reason: 'Bearish BOS' };
    if (choch === 'BEARISH_CHOCH') return { active: true, score: 8,  reason: 'Bearish CHOCH' };
    if (sweep === 'BEARISH_SWEEP') return { active: true, score: 6,  reason: 'Bearish Liquidity Sweep' };
  }

  return { active: false, score: 0 };
}

// ─── MAIN ENSEMBLE SCORER ─────────────────────────────────────────────────────
/**
 * Hitung ensemble score dari semua teknik.
 * @param {object} tfData - { m1, m5, m15, h1, h4 }
 * @param {string} direction - 'BUY' | 'SELL'
 * @returns {{ totalScore, passed, components, ranking }}
 */
function calculateEnsemble(tfData, direction) {
  const { m5, h1, h4 } = tfData;

  const components = [];

  // 1. Trendline (gunakan H1)
  const tl = detectTrendlineBounce(h1, direction);
  components.push({ name: 'Trendline', ...tl, maxScore: 20 });

  // 2. Engulfing (gunakan M5)
  const eng = detectEngulfing(m5, direction);
  components.push({ name: 'Engulfing', ...eng, maxScore: 15 });

  // 3. Supply & Demand (gunakan H4)
  const sd = detectSupplyDemand(h4, direction);
  components.push({ name: 'Supply & Demand', ...sd, maxScore: 25 });

  // 4. RSI Divergence (gunakan H1)
  const div = detectDivergence(h1, direction);
  components.push({ name: 'Divergence', ...div, maxScore: 10 });

  // 5. Fibonacci (gunakan H4)
  const fib = detectFibonacci(h4, direction);
  components.push({ name: 'Fibonacci', ...fib, maxScore: 15 });

  // 6. EMA Trend (gunakan H1)
  const emaTrend = detectEmaTrend(h1, direction);
  components.push({ name: 'EMA Trend', ...emaTrend, maxScore: 10 });

  // 7. BOS/CHOCH/Sweep (gunakan M5)
  const struct = detectStructure(m5, direction);
  components.push({ name: 'Market Structure', ...struct, maxScore: 10 });

  const totalScore = components.reduce((s, c) => s + (c.score || 0), 0);
  const maxPossible = 105; // sum of all maxScores
  const normalizedScore = Math.round((totalScore / maxPossible) * 100);

  const activeComponents = components.filter(c => c.active);
  const passed = normalizedScore >= ENSEMBLE_MIN_SCORE;

  // Ranking: urutkan berdasarkan score tertinggi
  const ranking = [...activeComponents]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((c, i) => ({
      rank: i + 1,
      name: c.name,
      confidence: Math.round(((c.score || 0) / (c.maxScore || 1)) * 100),
      reason: c.reason || '',
    }));

  return {
    totalScore: normalizedScore,
    rawScore: totalScore,
    passed,
    minRequired: ENSEMBLE_MIN_SCORE,
    components,
    activeComponents,
    ranking,
    direction,
  };
}

/**
 * Format pesan Ensemble untuk Telegram
 */
function formatEnsembleBlock(ensemble) {
  if (!ensemble || ensemble.activeComponents.length === 0) return '';

  const rankEmoji = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣'];
  const lines = [
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🏆 <b>SETUP RANKING</b>`,
  ];

  ensemble.ranking.slice(0, 3).forEach((r, i) => {
    lines.push(`${rankEmoji[i]} <b>${r.name}</b>`);
    lines.push(`   Confidence: <code>${r.confidence}%</code>${r.reason ? ` — ${r.reason}` : ''}`);
  });

  lines.push(``);
  lines.push(`📊 <b>Ensemble Score</b>: <code>${ensemble.totalScore}/100</code> ${ensemble.passed ? '✅' : '⏳'}`);

  return lines.join('\n');
}

/**
 * Format Setup Explanation untuk sinyal
 */
function formatSetupExplanation(ensemble, analysis) {
  if (!ensemble) return '';

  const techniques = ensemble.activeComponents.map(c => `• ${c.name}${c.reason ? ` (${c.reason})` : ''}`);

  // Buat alasan naratif
  let narrative = '';
  const has_sd  = ensemble.activeComponents.find(c => c.name === 'Supply & Demand');
  const has_eng = ensemble.activeComponents.find(c => c.name === 'Engulfing');
  const has_tl  = ensemble.activeComponents.find(c => c.name === 'Trendline');
  const has_div = ensemble.activeComponents.find(c => c.name === 'Divergence');
  const has_fib = ensemble.activeComponents.find(c => c.name === 'Fibonacci');

  const parts = [];
  if (has_sd)  parts.push(ensemble.direction === 'BUY' ? 'harga memantul dari demand zone' : 'harga menyentuh supply zone');
  if (has_eng) parts.push(ensemble.direction === 'BUY' ? 'muncul bullish engulfing' : 'muncul bearish engulfing');
  if (has_tl)  parts.push(ensemble.direction === 'BUY' ? 'trendline naik masih solid' : 'trendline turun masih solid');
  if (has_div) parts.push('RSI divergence terdeteksi');
  if (has_fib) parts.push('harga di level Fibonacci kunci');

  if (parts.length > 0) {
    narrative = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    if (parts.length > 1) narrative += ', ' + parts.slice(1).join(', ');
    narrative += '.';
  }

  const lines = [
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `📚 <b>SETUP TERDETEKSI</b>`,
    ``,
    `<b>Strategy:</b>`,
    ...techniques,
  ];

  if (narrative) {
    lines.push(``);
    lines.push(`<b>Alasan:</b>`);
    lines.push(narrative);
  }

  return lines.join('\n');
}

module.exports = {
  calculateEnsemble,
  formatEnsembleBlock,
  formatSetupExplanation,
  ENSEMBLE_MIN_SCORE,
};
