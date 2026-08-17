function ema(candles, period) {
  const k = 2 / (period + 1);
  let emaVal = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  const result = [emaVal];
  for (let i = period; i < candles.length; i++) {
    emaVal = candles[i].close * k + emaVal * (1 - k);
    result.push(emaVal);
  }
  return result;
}

function sma(candles, period) {
  const result = [];
  for (let i = period - 1; i < candles.length; i++) {
    const avg = candles.slice(i - period + 1, i + 1).reduce((s, c) => s + c.close, 0) / period;
    result.push(avg);
  }
  return result;
}

function rsi(candles, period = 14) {
  const closes = candles.map(c => c.close);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const result = [];
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

function atr(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let atrVal = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const result = [atrVal];
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
    result.push(atrVal);
  }
  return result;
}

function macd(candles, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(candles, fast);
  const slowEma = ema(candles, slow);
  const offset = slow - fast;
  const macdLine = fastEma.slice(offset).map((v, i) => v - slowEma[i]);
  const signalLine = [];
  const k = 2 / (signal + 1);
  let sigVal = macdLine.slice(0, signal).reduce((s, v) => s + v, 0) / signal;
  for (let i = signal; i < macdLine.length; i++) {
    sigVal = macdLine[i] * k + sigVal * (1 - k);
    signalLine.push(sigVal);
  }
  const histogram = macdLine.slice(signal).map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

function bollingerBands(candles, period = 20, stdDev = 2) {
  const result = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1).map(c => c.close);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    result.push({ upper: mean + stdDev * std, middle: mean, lower: mean - stdDev * std });
  }
  return result;
}

function detectSwingPoints(candles, lookback = 3) {
  const highs = [], lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const isHigh = candles.slice(i - lookback, i + lookback + 1).every((c, idx) => idx === lookback || c.high <= candles[i].high);
    const isLow  = candles.slice(i - lookback, i + lookback + 1).every((c, idx) => idx === lookback || c.low  >= candles[i].low);
    if (isHigh) highs.push({ index: i, price: candles[i].high, time: candles[i].time });
    if (isLow)  lows.push({ index: i, price: candles[i].low,  time: candles[i].time });
  }
  return { highs, lows };
}

function detectBOS(candles) {
  const { highs, lows } = detectSwingPoints(candles, 5);
  const last = candles[candles.length - 1];
  const prev2ndHigh = highs.length >= 2 ? highs[highs.length - 2].price : null;
  const prev2ndLow  = lows.length  >= 2 ? lows[lows.length - 2].price   : null;

  if (prev2ndHigh && last.close > prev2ndHigh) return 'BULLISH_BOS';
  if (prev2ndLow  && last.close < prev2ndLow)  return 'BEARISH_BOS';
  return null;
}

function detectCHOCH(candles) {
  const { highs, lows } = detectSwingPoints(candles, 5);
  if (highs.length < 2 || lows.length < 2) return null;

  const recentHighs = highs.slice(-3);
  const recentLows  = lows.slice(-3);
  const bullTrend   = recentHighs.every((h, i) => i === 0 || h.price > recentHighs[i - 1].price);
  const bearTrend   = recentLows.every((l, i)  => i === 0 || l.price < recentLows[i - 1].price);

  const last = candles[candles.length - 1];
  if (bullTrend && recentLows.length >= 2  && last.close < recentLows[recentLows.length - 2].price)   return 'BEARISH_CHOCH';
  if (bearTrend && recentHighs.length >= 2 && last.close > recentHighs[recentHighs.length - 2].price) return 'BULLISH_CHOCH';
  return null;
}

function detectLiquiditySweep(candles) {
  const { highs, lows } = detectSwingPoints(candles, 5);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  if (lows.length >= 1) {
    const recentLow = lows[lows.length - 1].price;
    if (prev.low < recentLow && last.close > recentLow) return 'BULLISH_SWEEP';
  }
  if (highs.length >= 1) {
    const recentHigh = highs[highs.length - 1].price;
    if (prev.high > recentHigh && last.close < recentHigh) return 'BEARISH_SWEEP';
  }
  return null;
}

function isRejectionCandle(candle, direction) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range === 0) return false;
  const bodyRatio  = body / range;
  const upperWick  = candle.high - Math.max(candle.open, candle.close);
  const lowerWick  = Math.min(candle.open, candle.close) - candle.low;

  if (direction === 'BUY') {
    const isBullish       = candle.close > candle.open;
    const strongLowerWick = lowerWick > body * 1.5;
    const smallUpperWick  = upperWick < body * 0.5;
    return isBullish && strongLowerWick && smallUpperWick && bodyRatio > 0.2;
  } else {
    const isBearish       = candle.close < candle.open;
    const strongUpperWick = upperWick > body * 1.5;
    const smallLowerWick  = lowerWick < body * 0.5;
    return isBearish && strongUpperWick && smallLowerWick && bodyRatio > 0.2;
  }
}

function isSidewaysCandle(candle) {
  const body  = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range === 0) return true;
  return (body / range) < 0.25;
}

module.exports = {
  ema, sma, rsi, atr, macd, bollingerBands,
  detectSwingPoints, detectBOS, detectCHOCH, detectLiquiditySweep,
  isRejectionCandle, isSidewaysCandle,
};
