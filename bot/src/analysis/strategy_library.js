/**
 * strategy_library.js — E-Book Strategy Library
 *
 * Setiap fungsi mengimplementasikan satu strategi dari koleksi e-book:
 *  - HHLL (Higher High / Lower Low)
 *  - Supply & Demand
 *  - Fibonacci Retracement (61.8%)
 *  - Engulfing Pattern
 *  - RSI Divergence
 *  - Trendline Bounce
 *  - Round Number Rejection
 *  - Multi-EMA Follow Trend
 *  - Sniper High Confluence
 *  - M5 Scalp Momentum
 *
 * Setiap strategi mengembalikan:
 *  null — tidak ada sinyal
 *  { direction, confidence, strategyName, ebookRef, reason, confirmations, category }
 */

const { ema, rsi, atr, macd, detectBOS, detectCHOCH } = require('./indicators');

const POINTS     = 0.1;
const SL_POINTS  = 40 * POINTS;
const TP1_POINTS = 60 * POINTS;
const TP2_POINTS = 125 * POINTS;

// ─── HELPER UTILS ─────────────────────────────────────────────────────────────

function lastN(arr, n) {
  return arr.slice(-n);
}

function swingHighs(candles, lookback = 20) {
  const arr = lastN(candles, lookback);
  const highs = arr.map(c => c.high);
  const sorted = [...highs].sort((a, b) => b - a);
  return sorted.slice(0, 3);
}

function swingLows(candles, lookback = 20) {
  const arr = lastN(candles, lookback);
  const lows = arr.map(c => c.low);
  const sorted = [...lows].sort((a, b) => a - b);
  return sorted.slice(0, 3);
}

function emaSlope(emaArr, periods = 5) {
  if (emaArr.length < periods + 1) return 0;
  const recent = emaArr[emaArr.length - 1];
  const past   = emaArr[emaArr.length - 1 - periods];
  return recent - past;
}

function isGreenCandle(c) { return c.close > c.open; }
function isRedCandle(c)   { return c.close < c.open; }

function candleBody(c)  { return Math.abs(c.close - c.open); }
function candleRange(c) { return c.high - c.low; }

function roundToNearest(price, step = 50) {
  return Math.round(price / step) * step;
}

// ─── 1. HHLL STRATEGY ────────────────────────────────────────────────────────
// Referensi: HHLL TRADING STRATEGY.pdf
// Konsep: Trend = serangkaian HH+HL (bull) atau LH+LL (bear)
// Entry saat pullback selesai dan momentum baru dimulai
function strategyHHLL(candles) {
  const { h4, h1, m5 } = candles;
  if (!h1 || h1.length < 30 || !m5 || m5.length < 20) return null;

  const h1Last20  = lastN(h1, 20);
  const h1Closes  = h1Last20.map(c => c.close);
  const h1Highs   = h1Last20.map(c => c.high);
  const h1Lows    = h1Last20.map(c => c.low);

  // Detect HH/HL sequence on H1
  let hhCount = 0, hlCount = 0, lhCount = 0, llCount = 0;
  for (let i = 2; i < h1Highs.length; i++) {
    if (h1Highs[i] > h1Highs[i-2]) hhCount++;
    if (h1Lows[i]  > h1Lows[i-2])  hlCount++;
    if (h1Highs[i] < h1Highs[i-2]) lhCount++;
    if (h1Lows[i]  < h1Lows[i-2])  llCount++;
  }

  const isBullish = hhCount >= 3 && hlCount >= 2;
  const isBearish = lhCount >= 3 && llCount >= 2;
  if (!isBullish && !isBearish) return null;

  const direction = isBullish ? 'BUY' : 'SELL';

  // M5 confirmation: current M5 must show momentum in direction
  const m5Cur  = m5[m5.length - 1];
  const m5Prev = m5[m5.length - 2];
  const m5Momentum = direction === 'BUY'
    ? isGreenCandle(m5Cur) && m5Cur.close > m5Prev.high
    : isRedCandle(m5Cur)   && m5Cur.close < m5Prev.low;
  if (!m5Momentum) return null;

  // H4 alignment (optional bonus)
  let h4Aligned = false;
  if (h4 && h4.length >= 5) {
    const h4Cur = h4[h4.length - 1];
    const h4Ema = ema(h4, 20);
    h4Aligned = direction === 'BUY'
      ? h4Cur.close > h4Ema[h4Ema.length - 1]
      : h4Cur.close < h4Ema[h4Ema.length - 1];
  }

  const confirmations = ['H1 HH/HL sequence', 'M5 momentum break'];
  if (h4Aligned) confirmations.push('H4 EMA aligned');

  const conf = 55 + hhCount * 3 + (h4Aligned ? 10 : 0);

  return {
    direction,
    confidence: Math.min(conf, 82),
    strategyName: 'HHLL Trend Following',
    ebookRef: 'HHLL Trading Strategy',
    reason: direction === 'BUY'
      ? `H1 membentuk pola Higher High (${hhCount}x) & Higher Low (${hlCount}x). M5 breakout mengkonfirmasi resumption.`
      : `H1 membentuk pola Lower High (${lhCount}x) & Lower Low (${llCount}x). M5 breakdown mengkonfirmasi resumption.`,
    confirmations,
    category: 'Trend Following',
  };
}

// ─── 2. SUPPLY & DEMAND ───────────────────────────────────────────────────────
// Referensi: TEKNIK SUPPLY DAN DEMAND.pdf
// Konsep: Identifikasi zona konsolidasi sebagai supply (resistansi) atau demand (support)
// Entry saat harga kembali ke zona dengan rejection candle
function strategySupplyDemand(candles) {
  const { h4, h1, m5 } = candles;
  if (!h1 || h1.length < 40 || !m5 || m5.length < 20) return null;

  const h1Slice   = lastN(h1, 40);
  const h1Highs   = h1Slice.map(c => c.high);
  const h1Lows    = h1Slice.map(c => c.low);
  const lastH1    = h1Slice[h1Slice.length - 1];

  // Find recent swing high/low (potential supply/demand zones)
  const recentHigh = Math.max(...h1Highs.slice(-15));
  const recentLow  = Math.min(...h1Lows.slice(-15));
  const midRange   = (recentHigh + recentLow) / 2;
  const currentPrice = m5[m5.length - 1].close;

  // Determine zone proximity (within 0.5% of zone)
  const zoneThreshold = currentPrice * 0.005;
  const nearDemand = Math.abs(currentPrice - recentLow) < zoneThreshold;
  const nearSupply = Math.abs(currentPrice - recentHigh) < zoneThreshold;

  if (!nearDemand && !nearSupply) return null;

  const direction = nearDemand ? 'BUY' : 'SELL';

  // M5 rejection candle at zone
  const m5Cur  = m5[m5.length - 1];
  const m5Body = candleBody(m5Cur);
  const m5Range = candleRange(m5Cur);
  if (m5Range === 0) return null;

  // Require rejection (wick > body)
  const upperWick = m5Cur.high - Math.max(m5Cur.open, m5Cur.close);
  const lowerWick = Math.min(m5Cur.open, m5Cur.close) - m5Cur.low;

  const validRejection = direction === 'BUY'
    ? lowerWick > m5Body && isGreenCandle(m5Cur)
    : upperWick > m5Body && isRedCandle(m5Cur);

  if (!validRejection) return null;

  // H4 bias alignment
  let h4Aligned = false;
  if (h4 && h4.length >= 10) {
    const h4Ema20 = ema(h4, 20);
    const h4Cur   = h4[h4.length - 1];
    h4Aligned = direction === 'BUY'
      ? h4Cur.close > h4Ema20[h4Ema20.length - 1]
      : h4Cur.close < h4Ema20[h4Ema20.length - 1];
  }

  const zone = direction === 'BUY' ? 'Demand' : 'Supply';
  const zonePrice = direction === 'BUY' ? recentLow : recentHigh;
  const confirmations = [`${zone} zone teridentifikasi (${zonePrice.toFixed(2)})`, 'Rejection candle M5'];
  if (h4Aligned) confirmations.push('H4 trend searah');

  const conf = 60 + (h4Aligned ? 12 : 0) + (validRejection ? 8 : 0);

  return {
    direction,
    confidence: Math.min(conf, 85),
    strategyName: 'Supply & Demand Zone',
    ebookRef: 'Teknik Supply Dan Demand',
    reason: direction === 'BUY'
      ? `Harga menyentuh zona Demand di ${zonePrice.toFixed(2)} dengan candle rejection bullish pada M5.`
      : `Harga menyentuh zona Supply di ${zonePrice.toFixed(2)} dengan candle rejection bearish pada M5.`,
    confirmations,
    category: 'Support & Resistance',
  };
}

// ─── 3. FIBONACCI RETRACEMENT ─────────────────────────────────────────────────
// Referensi: ILMU FIBONACCI by Jayzee FX.pdf & TEKNIK FIBO DERHAKA.pdf
// Konsep: Hitung Fibonacci 61.8% dari swing move terakhir pada H1
// Entry saat harga pullback ke level 61.8% dengan M5 konfirmasi
function strategyFibonacci(candles) {
  const { h4, h1, m5 } = candles;
  if (!h1 || h1.length < 30 || !m5 || m5.length < 10) return null;

  const h1Slice = lastN(h1, 30);
  const highs   = h1Slice.map(c => c.high);
  const lows    = h1Slice.map(c => c.low);

  const swingHigh = Math.max(...highs);
  const swingLow  = Math.min(...lows);
  const swingRange = swingHigh - swingLow;
  if (swingRange < 1) return null;  // Terlalu kecil

  // Determine trend from H1 EMA
  const h1Ema20 = ema(h1Slice, 20);
  const h1Last  = h1Slice[h1Slice.length - 1];
  const isTrendUp = h1Last.close > h1Ema20[h1Ema20.length - 1];

  const currentPrice = m5[m5.length - 1].close;

  // Fibonacci 61.8% level
  const fib618Bull = swingHigh - swingRange * 0.618;  // Bullish: pull back ke 61.8% dari swing
  const fib618Bear = swingLow  + swingRange * 0.618;  // Bearish: rally ke 61.8% dari swing

  const fibThreshold = swingRange * 0.02;  // 2% of range = proximity zone

  const nearBull618 = isTrendUp  && Math.abs(currentPrice - fib618Bull) < fibThreshold;
  const nearBear618 = !isTrendUp && Math.abs(currentPrice - fib618Bear) < fibThreshold;

  if (!nearBull618 && !nearBear618) return null;

  const direction = nearBull618 ? 'BUY' : 'SELL';
  const fibLevel  = nearBull618 ? fib618Bull : fib618Bear;

  // M5 momentum confirmation at Fib level
  const m5Cur  = m5[m5.length - 1];
  const m5Prev = m5[m5.length - 2];
  const m5Confirms = direction === 'BUY'
    ? isGreenCandle(m5Cur) && m5Cur.close > m5Prev.close
    : isRedCandle(m5Cur)   && m5Cur.close < m5Prev.close;

  if (!m5Confirms) return null;

  // RSI check — not overbought/oversold opposite direction
  const rsiArr  = rsi(m5, 14);
  const lastRsi = rsiArr[rsiArr.length - 1];
  const rsiOk   = direction === 'BUY' ? lastRsi < 65 : lastRsi > 35;

  const confirmations = [`Fibonacci 61.8% level (${fibLevel.toFixed(2)})`, 'M5 momentum konfirmasi'];
  if (rsiOk) confirmations.push(`RSI ${lastRsi.toFixed(0)} dalam range aman`);

  const conf = 58 + (rsiOk ? 10 : 0) + (m5Confirms ? 8 : 0);

  return {
    direction,
    confidence: Math.min(conf, 82),
    strategyName: 'Fibonacci 61.8% Retracement',
    ebookRef: 'Ilmu Fibonacci by Jayzee FX & Teknik Fibo Derhaka',
    reason: direction === 'BUY'
      ? `Harga pullback ke Fibonacci 61.8% (${fibLevel.toFixed(2)}) dalam uptrend H1. Candle M5 bullish mengkonfirmasi reversal.`
      : `Harga rally ke Fibonacci 61.8% (${fibLevel.toFixed(2)}) dalam downtrend H1. Candle M5 bearish mengkonfirmasi reversal.`,
    confirmations,
    category: 'Fibonacci',
  };
}

// ─── 4. ENGULFING PATTERN ─────────────────────────────────────────────────────
// Referensi: RAHSIA ENGULFING.pdf & 7 Powerful Candlestick Pattern.pdf
// Konsep: Engulfing candle yang menelan candle sebelumnya = reversal kuat
// Harus terjadi di zona kunci (support/resistance) dan selaras H4 trend
function strategyEngulfing(candles) {
  const { h4, h1, m5 } = candles;
  if (!m5 || m5.length < 10 || !h1 || h1.length < 10) return null;

  const m5Cur  = m5[m5.length - 1];
  const m5Prev = m5[m5.length - 2];
  const m5Prev2 = m5[m5.length - 3];

  // Engulfing: current body fully engulfs previous candle body
  const prevBodyHigh = Math.max(m5Prev.open, m5Prev.close);
  const prevBodyLow  = Math.min(m5Prev.open, m5Prev.close);
  const curBodyHigh  = Math.max(m5Cur.open, m5Cur.close);
  const curBodyLow   = Math.min(m5Cur.open, m5Cur.close);

  const bullEngulf = isGreenCandle(m5Cur) && isRedCandle(m5Prev) &&
    curBodyLow  <= prevBodyLow  &&
    curBodyHigh >= prevBodyHigh &&
    candleBody(m5Cur) > candleBody(m5Prev);

  const bearEngulf = isRedCandle(m5Cur) && isGreenCandle(m5Prev) &&
    curBodyHigh >= prevBodyHigh &&
    curBodyLow  <= prevBodyLow  &&
    candleBody(m5Cur) > candleBody(m5Prev);

  if (!bullEngulf && !bearEngulf) return null;

  const direction = bullEngulf ? 'BUY' : 'SELL';

  // H1 and H4 alignment
  const h1Ema  = ema(h1, 20);
  const h1Last = h1[h1.length - 1];
  const h1Aligned = direction === 'BUY'
    ? h1Last.close > h1Ema[h1Ema.length - 1]
    : h1Last.close < h1Ema[h1Ema.length - 1];

  let h4Aligned = false;
  if (h4 && h4.length >= 10) {
    const h4Ema = ema(h4, 20);
    const h4Last = h4[h4.length - 1];
    h4Aligned = direction === 'BUY'
      ? h4Last.close > h4Ema[h4Ema.length - 1]
      : h4Last.close < h4Ema[h4Ema.length - 1];
  }

  if (!h1Aligned && !h4Aligned) return null;

  // Engulfing strength ratio
  const engulfRatio = candleBody(m5Cur) / (candleBody(m5Prev) || 1);
  const isStrong = engulfRatio >= 1.5;

  const confirmations = [`${direction === 'BUY' ? 'Bullish' : 'Bearish'} Engulfing M5 (${engulfRatio.toFixed(1)}x)`];
  if (h1Aligned) confirmations.push('H1 trend searah');
  if (h4Aligned) confirmations.push('H4 trend searah');
  if (isStrong)  confirmations.push(`Strong engulf (${engulfRatio.toFixed(1)}x body)`)

  const conf = 58 + (h1Aligned ? 8 : 0) + (h4Aligned ? 12 : 0) + (isStrong ? 8 : 0);

  return {
    direction,
    confidence: Math.min(conf, 88),
    strategyName: 'Engulfing Candle Pattern',
    ebookRef: 'Rahsia Engulfing & 7 Powerful Candlestick Pattern',
    reason: direction === 'BUY'
      ? `Bullish Engulfing terbentuk pada M5 — candle hijau menelan candle merah sebelumnya (${engulfRatio.toFixed(1)}x ukuran). ${h4Aligned ? 'H4 & ' : ''}H1 trend bullish.`
      : `Bearish Engulfing terbentuk pada M5 — candle merah menelan candle hijau sebelumnya (${engulfRatio.toFixed(1)}x ukuran). ${h4Aligned ? 'H4 & ' : ''}H1 trend bearish.`,
    confirmations,
    category: 'Candlestick Pattern',
  };
}

// ─── 5. RSI DIVERGENCE ────────────────────────────────────────────────────────
// Referensi: TeknikDivergence.pdf
// Konsep: Price membuat HH tapi RSI membuat LH = bearish divergence (reversal)
//         Price membuat LL tapi RSI membuat HL = bullish divergence (reversal)
function strategyDivergence(candles) {
  const { h1, m15, m5 } = candles;
  if (!h1 || h1.length < 20 || !m15 || m15.length < 20) return null;

  function checkDivergence(src) {
    if (src.length < 15) return null;
    const slice  = lastN(src, 15);
    const rsiArr = rsi(slice, 14);
    if (rsiArr.length < 10) return null;

    const prices = slice.map(c => c.close);
    const midIdx = Math.floor(prices.length / 2);

    const priceOld  = prices.slice(0, midIdx);
    const priceNew  = prices.slice(midIdx);
    const rsiOld    = rsiArr.slice(0, midIdx);
    const rsiNew    = rsiArr.slice(midIdx);

    const priceHighOld = Math.max(...priceOld);
    const priceHighNew = Math.max(...priceNew);
    const priceLowOld  = Math.min(...priceOld);
    const priceLowNew  = Math.min(...priceNew);

    const rsiHighOld = Math.max(...rsiOld);
    const rsiHighNew = Math.max(...rsiNew);
    const rsiLowOld  = Math.min(...rsiOld);
    const rsiLowNew  = Math.min(...rsiNew);

    // Bearish divergence: price HH, RSI LH
    if (priceHighNew > priceHighOld && rsiHighNew < rsiHighOld - 3) {
      return { type: 'bearish', strength: rsiHighOld - rsiHighNew };
    }
    // Bullish divergence: price LL, RSI HL
    if (priceLowNew < priceLowOld && rsiLowNew > rsiLowOld + 3) {
      return { type: 'bullish', strength: rsiLowNew - rsiLowOld };
    }
    return null;
  }

  const h1Div  = checkDivergence(h1);
  const m15Div = checkDivergence(m15);

  if (!h1Div && !m15Div) return null;

  const div = h1Div || m15Div;
  const tfLabel = h1Div ? 'H1' : 'M15';
  const direction = div.type === 'bullish' ? 'BUY' : 'SELL';

  // M5 confirmation: momentum starting in direction
  const m5Cur  = m5 && m5.length > 1 ? m5[m5.length - 1] : null;
  const m5Confirms = m5Cur
    ? (direction === 'BUY' ? isGreenCandle(m5Cur) : isRedCandle(m5Cur))
    : false;

  const confirmations = [`RSI ${div.type} divergence pada ${tfLabel} (delta: ${div.strength.toFixed(1)})`];
  if (m5Confirms) confirmations.push('M5 momentum searah');
  if (h1Div && m15Div) confirmations.push('Divergence dikonfirmasi di 2 timeframe');

  const conf = 60 + (m5Confirms ? 8 : 0) + (h1Div && m15Div ? 10 : 0) + Math.min(div.strength, 15);

  return {
    direction,
    confidence: Math.min(conf, 85),
    strategyName: 'RSI Divergence',
    ebookRef: 'Teknik Divergence',
    reason: direction === 'BUY'
      ? `Bullish RSI divergence pada ${tfLabel}: harga membuat Lower Low tapi RSI membuat Higher Low — sinyal reversal bullish.`
      : `Bearish RSI divergence pada ${tfLabel}: harga membuat Higher High tapi RSI membuat Lower High — sinyal reversal bearish.`,
    confirmations,
    category: 'Divergence',
  };
}

// ─── 6. ROUND NUMBER REJECTION ────────────────────────────────────────────────
// Referensi: TEKNIK TRADING ROUND NUMBER.pdf
// Konsep: Psikologis level round number (tiap 50 atau 100 poin) sebagai S/R
// Gold sangat respek terhadap level $X000, $X050, $X100, dll
function strategyRoundNumber(candles) {
  const { h4, h1, m5 } = candles;
  if (!m5 || m5.length < 10 || !h1 || h1.length < 10) return null;

  const currentPrice = m5[m5.length - 1].close;

  // Round number levels: setiap $50 untuk XAUUSD
  const nearestRound50  = roundToNearest(currentPrice, 50);
  const nearestRound100 = roundToNearest(currentPrice, 100);

  // Proximity: dalam 0.3% dari level (sekitar $9-10 untuk gold $3300)
  const threshold = currentPrice * 0.003;
  const distTo50  = Math.abs(currentPrice - nearestRound50);
  const distTo100 = Math.abs(currentPrice - nearestRound100);

  const nearR50  = distTo50  < threshold;
  const nearR100 = distTo100 < threshold;

  if (!nearR50 && !nearR100) return null;

  const roundLevel = nearR100 ? nearestRound100 : nearestRound50;
  const isKeyLevel = nearR100;  // $X00 lebih kuat dari $X50

  // M5 rejection candle at round number
  const m5Cur  = m5[m5.length - 1];
  const m5Prev = m5[m5.length - 2];

  const upperWick  = m5Cur.high - Math.max(m5Cur.open, m5Cur.close);
  const lowerWick  = Math.min(m5Cur.open, m5Cur.close) - m5Cur.low;
  const body       = candleBody(m5Cur);

  // Approaching from below = support (BUY) | from above = resistance (SELL)
  const priceBelow = m5Prev.close < roundLevel && currentPrice >= roundLevel - threshold;
  const priceAbove = m5Prev.close > roundLevel && currentPrice <= roundLevel + threshold;

  if (!priceBelow && !priceAbove) return null;

  const direction = priceBelow ? 'BUY' : 'SELL';

  // Must have rejection wick
  const rejectionOk = direction === 'BUY'
    ? lowerWick > body * 0.5 && isGreenCandle(m5Cur)
    : upperWick > body * 0.5 && isRedCandle(m5Cur);

  if (!rejectionOk) return null;

  // H1 trend alignment
  const h1Ema = ema(h1, 20);
  const h1Last = h1[h1.length - 1];
  const h1Ok = direction === 'BUY'
    ? h1Last.close > h1Ema[h1Ema.length - 1]
    : h1Last.close < h1Ema[h1Ema.length - 1];

  const levelType = isKeyLevel ? 'Key Round Number ($X00)' : 'Round Number ($X50)';
  const confirmations = [`${levelType}: ${roundLevel.toFixed(0)}`, 'M5 rejection candle'];
  if (h1Ok) confirmations.push('H1 trend searah');

  const conf = 55 + (isKeyLevel ? 15 : 8) + (h1Ok ? 10 : 0);

  return {
    direction,
    confidence: Math.min(conf, 84),
    strategyName: 'Round Number Rejection',
    ebookRef: 'Teknik Trading Round Number',
    reason: direction === 'BUY'
      ? `Harga bounce dari level psikologis ${roundLevel} (support round number). Candle M5 bullish rejection mengkonfirmasi.`
      : `Harga rejected dari level psikologis ${roundLevel} (resistance round number). Candle M5 bearish rejection mengkonfirmasi.`,
    confirmations,
    category: 'Psychological Levels',
  };
}

// ─── 7. SIMPLE FOLLOW TREND (EMA MULTI-TF) ───────────────────────────────────
// Referensi: Teknik Simple Follow Trend.pdf
// Konsep: EMA 20, 50, 200 semua searah = strong trend, entry saat pullback ke EMA 20
function strategySimpleFollowTrend(candles) {
  const { h4, h1, m15, m5 } = candles;
  if (!h4 || h4.length < 50 || !h1 || h1.length < 50 || !m5 || m5.length < 20) return null;

  // H4 EMA alignment
  const h4Ema20  = ema(h4, 20);
  const h4Ema50  = ema(h4, 50);
  const h4Last   = h4[h4.length - 1];

  const h4Bull = h4Last.close > h4Ema20[h4Ema20.length - 1] &&
                 h4Ema20[h4Ema20.length - 1] > h4Ema50[h4Ema50.length - 1];
  const h4Bear = h4Last.close < h4Ema20[h4Ema20.length - 1] &&
                 h4Ema20[h4Ema20.length - 1] < h4Ema50[h4Ema50.length - 1];

  if (!h4Bull && !h4Bear) return null;

  // H1 same direction
  const h1Ema20 = ema(h1, 20);
  const h1Ema50 = ema(h1, 50);
  const h1Last  = h1[h1.length - 1];

  const h1Bull = h1Last.close > h1Ema20[h1Ema20.length - 1];
  const h1Bear = h1Last.close < h1Ema20[h1Ema20.length - 1];

  const bothBull = h4Bull && h1Bull;
  const bothBear = h4Bear && h1Bear;
  if (!bothBull && !bothBear) return null;

  const direction = bothBull ? 'BUY' : 'SELL';

  // M5 pullback to EMA 20 = entry opportunity
  const m5Ema20  = ema(m5, 20);
  const m5Last   = m5[m5.length - 1];
  const m5LastEma = m5Ema20[m5Ema20.length - 1];
  const m5PrevEma = m5Ema20[m5Ema20.length - 2];

  // Price touching/bouncing from M5 EMA20
  const touchEma = Math.abs(m5Last.low - m5LastEma) < m5LastEma * 0.002 ||
                   Math.abs(m5Last.high - m5LastEma) < m5LastEma * 0.002;

  // OR price just crossed EMA20 in direction
  const emaSlp = emaSlope(m5Ema20, 5);
  const slopeOk = direction === 'BUY' ? emaSlp > 0 : emaSlp < 0;

  if (!slopeOk) return null;

  const m5Confirms = direction === 'BUY'
    ? isGreenCandle(m5Last) && m5Last.close > m5LastEma
    : isRedCandle(m5Last)   && m5Last.close < m5LastEma;

  if (!m5Confirms) return null;

  const confirmations = ['H4 EMA 20/50 bull stack', 'H1 price above EMA 20', 'M5 EMA slope searah'];
  if (touchEma) confirmations.push('M5 bounce dari EMA 20');

  const conf = 62 + (touchEma ? 8 : 0) + (slopeOk ? 5 : 0);

  return {
    direction,
    confidence: Math.min(conf, 82),
    strategyName: 'Simple Follow Trend (EMA Stack)',
    ebookRef: 'Teknik Simple Follow Trend',
    reason: direction === 'BUY'
      ? `H4 dan H1 dalam bullish EMA stack (EMA20 > EMA50). M5 bounce dari EMA20 mengkonfirmasi momentum continuation.`
      : `H4 dan H1 dalam bearish EMA stack (EMA20 < EMA50). M5 drop dari EMA20 mengkonfirmasi momentum continuation.`,
    confirmations,
    category: 'Trend Following',
  };
}

// ─── 8. SNIPER ENTRY (HIGH CONFLUENCE) ───────────────────────────────────────
// Referensi: TEKNIK SNIPER.pdf & Teknik Sharp Entry.pdf
// Konsep: Entry hanya saat SEMUA faktor confluence terpenuhi sekaligus
// HTF + LTF + Structure + Momentum + Volume semua aligned
function strategySniperEntry(candles) {
  const { h4, h1, m15, m5, m1 } = candles;
  if (!h4 || h4.length < 20 || !h1 || h1.length < 20 || !m5 || m5.length < 20) return null;

  let score = 0;
  const hits = [];

  // Factor 1: H4 strong trend (EMA + BOS)
  const h4Ema20 = ema(h4, 20);
  const h4Ema50 = ema(h4, 50);
  const h4Last  = h4[h4.length - 1];
  const h4Bull  = h4Last.close > h4Ema20[h4Ema20.length - 1] &&
                  h4Ema20[h4Ema20.length - 1] > h4Ema50[h4Ema50.length - 1];
  const h4Bear  = h4Last.close < h4Ema20[h4Ema20.length - 1] &&
                  h4Ema20[h4Ema20.length - 1] < h4Ema50[h4Ema50.length - 1];
  if (h4Bull || h4Bear) { score += 2; hits.push('H4 strong trend'); }

  // Factor 2: H1 BOS/CHOCH
  const h1Bos = detectBOS(h1);
  if (h1Bos && h1Bos !== 'NONE') { score += 2; hits.push(`H1 ${h1Bos}`); }

  // Factor 3: H1 RSI in sweet zone
  const h1Rsi = rsi(h1, 14);
  const h1LastRsi = h1Rsi[h1Rsi.length - 1];
  const h4IsBull  = h4Bull;
  const rsiGood = h4IsBull ? (h1LastRsi > 45 && h1LastRsi < 65) : (h1LastRsi > 35 && h1LastRsi < 55);
  if (rsiGood) { score += 1; hits.push(`H1 RSI ${h1LastRsi.toFixed(0)} zona aman`); }

  // Factor 4: M15 structure aligned
  const m15Ema = ema(m15 || [], 20);
  if (m15 && m15.length > 0 && m15Ema.length > 0) {
    const m15Last = m15[m15.length - 1];
    const m15EmaLast = m15Ema[m15Ema.length - 1];
    const m15Ok = h4Bull ? m15Last.close > m15EmaLast : m15Last.close < m15EmaLast;
    if (m15Ok) { score += 1; hits.push('M15 aligned'); }
  }

  // Factor 5: M5 strong entry candle
  const m5Cur   = m5[m5.length - 1];
  const m5Prev  = m5[m5.length - 2];
  const m5Body  = candleBody(m5Cur);
  const m5Range = candleRange(m5Cur);
  const m5StrongBody = m5Range > 0 && m5Body / m5Range > 0.55;
  if (m5StrongBody && (h4Bull ? isGreenCandle(m5Cur) : isRedCandle(m5Cur))) {
    score += 2;
    hits.push('M5 strong body candle');
  }

  // Factor 6: M1 immediate momentum (if available)
  if (m1 && m1.length > 3) {
    const m1Last3 = lastN(m1, 3);
    const allBull = m1Last3.every(c => isGreenCandle(c));
    const allBear = m1Last3.every(c => isRedCandle(c));
    if ((h4Bull && allBull) || (h4Bear && allBear)) {
      score += 1;
      hits.push('M1 momentum burst');
    }
  }

  // Sniper requires high score (minimum 6 out of 9)
  if (score < 6) return null;

  // Must have clear H4 direction
  if (!h4Bull && !h4Bear) return null;
  const direction = h4Bull ? 'BUY' : 'SELL';
  
  // Alignment sanity check
  const m5DirectionOk = direction === 'BUY' ? isGreenCandle(m5Cur) : isRedCandle(m5Cur);
  if (!m5DirectionOk) return null;

  const conf = 65 + score * 3;

  return {
    direction,
    confidence: Math.min(conf, 92),
    strategyName: 'Sniper High Confluence Entry',
    ebookRef: 'Teknik Sniper & Teknik Sharp Entry',
    reason: `Setup Sniper dengan ${score} faktor confluence aktif sekaligus: ${hits.join(', ')}.`,
    confirmations: hits,
    category: 'High Confluence',
  };
}

// ─── 9. TRENDLINE BOUNCE ─────────────────────────────────────────────────────
// Referensi: Teknik Mudah Trendline.pdf
// Konsep: Hubungkan 2+ swing lows (uptrend) atau 2+ swing highs (downtrend)
// Entry saat harga menyentuh trendline dengan rejection candle
function strategyTrendlineBounce(candles) {
  const { h1, m5 } = candles;
  if (!h1 || h1.length < 30 || !m5 || m5.length < 10) return null;

  const h1Slice = lastN(h1, 30);
  const currentPrice = m5[m5.length - 1].close;

  // Find swing points to draw trendline
  // Simplified: use 3 most recent swing lows/highs
  const lows  = h1Slice.map((c, i) => ({ low: c.low, i }));
  const highs = h1Slice.map((c, i) => ({ high: c.high, i }));

  // Sort by price to find swing extremes
  const sortedLows  = [...lows].sort((a, b) => a.low - b.low);
  const sortedHighs = [...highs].sort((a, b) => b.high - a.high);

  const swLow1  = sortedLows[0];
  const swLow2  = sortedLows[1];
  const swHigh1 = sortedHighs[0];
  const swHigh2 = sortedHighs[1];

  // Uptrend trendline: connect swing lows → extrapolate to current
  let trendlineBuyLevel = null;
  if (swLow1 && swLow2 && swLow2.i > swLow1.i) {
    const slope = (swLow2.low - swLow1.low) / (swLow2.i - swLow1.i);
    const periods = (h1Slice.length - 1) - swLow2.i;
    trendlineBuyLevel = swLow2.low + slope * periods;
  }

  // Downtrend trendline: connect swing highs → extrapolate to current
  let trendlineSellLevel = null;
  if (swHigh1 && swHigh2 && swHigh2.i > swHigh1.i) {
    const slope = (swHigh2.high - swHigh1.high) / (swHigh2.i - swHigh1.i);
    const periods = (h1Slice.length - 1) - swHigh2.i;
    trendlineSellLevel = swHigh2.high + slope * periods;
  }

  // Check proximity to trendline
  const threshold = currentPrice * 0.004;
  const nearBuyTL  = trendlineBuyLevel  && Math.abs(currentPrice - trendlineBuyLevel)  < threshold;
  const nearSellTL = trendlineSellLevel && Math.abs(currentPrice - trendlineSellLevel) < threshold;

  if (!nearBuyTL && !nearSellTL) return null;

  const direction = nearBuyTL ? 'BUY' : 'SELL';
  const trendlineLevel = nearBuyTL ? trendlineBuyLevel : trendlineSellLevel;

  // M5 rejection at trendline
  const m5Cur = m5[m5.length - 1];
  const lowerWick = Math.min(m5Cur.open, m5Cur.close) - m5Cur.low;
  const upperWick = m5Cur.high - Math.max(m5Cur.open, m5Cur.close);
  const body      = candleBody(m5Cur);

  const rejectionOk = direction === 'BUY'
    ? lowerWick > body * 0.4 && isGreenCandle(m5Cur)
    : upperWick > body * 0.4 && isRedCandle(m5Cur);

  if (!rejectionOk) return null;

  const confirmations = [`Trendline level: ${trendlineLevel.toFixed(2)}`, 'M5 rejection di trendline'];

  return {
    direction,
    confidence: Math.min(65, 75),
    strategyName: 'Trendline Bounce',
    ebookRef: 'Teknik Mudah Trendline',
    reason: direction === 'BUY'
      ? `Harga menyentuh uptrend trendline (${trendlineLevel.toFixed(2)}) dengan candle bullish rejection M5.`
      : `Harga menyentuh downtrend trendline (${trendlineLevel.toFixed(2)}) dengan candle bearish rejection M5.`,
    confirmations,
    category: 'Price Action',
  };
}

// ─── 10. MACD MOMENTUM SCALP ─────────────────────────────────────────────────
// Referensi: Teknik Scalping series (5min, Red5, AO)
// Konsep: MACD histogram crossover pada M5 dengan H1 aligned
function strategyMacdScalp(candles) {
  const { h1, m5 } = candles;
  if (!h1 || h1.length < 30 || !m5 || m5.length < 30) return null;

  const { histogram: m5Hist } = macd(m5);
  const { histogram: h1Hist } = macd(h1);

  if (m5Hist.length < 5 || h1Hist.length < 5) return null;

  const m5HCur  = m5Hist[m5Hist.length - 1];
  const m5HPrev = m5Hist[m5Hist.length - 2];

  // MACD histogram crossover (zero line cross)
  const bullCross = m5HPrev < 0 && m5HCur >= 0;
  const bearCross = m5HPrev > 0 && m5HCur <= 0;

  if (!bullCross && !bearCross) return null;

  // H1 MACD histogram must agree (positive for bull, negative for bear)
  const h1HCur = h1Hist[h1Hist.length - 1];
  const h1Agrees = bullCross ? h1HCur > 0 : h1HCur < 0;
  if (!h1Agrees) return null;

  const direction = bullCross ? 'BUY' : 'SELL';

  // RSI confirmation
  const m5RsiArr = rsi(m5, 14);
  const m5Rsi    = m5RsiArr[m5RsiArr.length - 1];
  const rsiOk    = direction === 'BUY' ? m5Rsi > 40 && m5Rsi < 65 : m5Rsi < 60 && m5Rsi > 35;

  const confirmations = [`MACD histogram cross ${direction === 'BUY' ? '↑' : '↓'} pada M5`, 'H1 MACD histogram searah'];
  if (rsiOk) confirmations.push(`RSI M5 ${m5Rsi.toFixed(0)} zona valid`);

  const conf = 60 + (rsiOk ? 10 : 0) + (h1Agrees ? 8 : 0);

  return {
    direction,
    confidence: Math.min(conf, 80),
    strategyName: 'MACD Momentum Scalp',
    ebookRef: 'Teknik Scalping & Teknik Scalping Red5',
    reason: direction === 'BUY'
      ? `MACD histogram M5 cross ke atas zero line — momentum bullish. H1 MACD histogram positif mengkonfirmasi.`
      : `MACD histogram M5 cross ke bawah zero line — momentum bearish. H1 MACD histogram negatif mengkonfirmasi.`,
    confirmations,
    category: 'Momentum',
  };
}

// ─── RUN ALL STRATEGIES ───────────────────────────────────────────────────────
const ALL_STRATEGIES = [
  { name: 'hhll',           fn: strategyHHLL           },
  { name: 'supplyDemand',   fn: strategySupplyDemand   },
  { name: 'fibonacci',      fn: strategyFibonacci      },
  { name: 'engulfing',      fn: strategyEngulfing      },
  { name: 'divergence',     fn: strategyDivergence     },
  { name: 'roundNumber',    fn: strategyRoundNumber    },
  { name: 'followTrend',    fn: strategySimpleFollowTrend },
  { name: 'sniper',         fn: strategySniperEntry    },
  { name: 'trendline',      fn: strategyTrendlineBounce },
  { name: 'macdScalp',      fn: strategyMacdScalp      },
];

function runAllStrategies(candles) {
  const signals = [];
  for (const { name, fn } of ALL_STRATEGIES) {
    try {
      const result = fn(candles);
      if (result) signals.push({ key: name, ...result });
    } catch (e) {
      // Silent fail per strategy — don't crash scanner
    }
  }
  return signals;
}

// ─── PICK BEST SIGNAL ─────────────────────────────────────────────────────────
// Jika ada beberapa sinyal searah → gabungkan confidence-nya
// Jika ada sinyal berlawanan → ambil yang lebih kuat (atau skip jika hampir sama)
function pickBestEbookSignal(signals, minConf = 65) {
  if (!signals || signals.length === 0) return null;

  const buySignals  = signals.filter(s => s.direction === 'BUY');
  const sellSignals = signals.filter(s => s.direction === 'SELL');

  function mergeGroup(group) {
    if (group.length === 0) return null;
    // Sort by confidence
    group.sort((a, b) => b.confidence - a.confidence);
    const best = group[0];

    // Bonus confidence if multiple strategies agree
    const agreementBonus = Math.min((group.length - 1) * 4, 12);
    const merged = {
      ...best,
      confidence: Math.min(best.confidence + agreementBonus, 95),
      supportingStrategies: group.slice(1).map(s => s.strategyName),
    };
    return merged;
  }

  const bestBuy  = mergeGroup(buySignals);
  const bestSell = mergeGroup(sellSignals);

  // Both directions → pick stronger or abstain if too close
  if (bestBuy && bestSell) {
    const diff = Math.abs(bestBuy.confidence - bestSell.confidence);
    if (diff < 8) return null; // Conflicting → skip
    return bestBuy.confidence > bestSell.confidence ? bestBuy : bestSell;
  }

  const winner = bestBuy || bestSell;
  if (!winner || winner.confidence < minConf) return null;
  return winner;
}

module.exports = {
  runAllStrategies,
  pickBestEbookSignal,
  ALL_STRATEGIES,
};
