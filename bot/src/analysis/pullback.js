/**
 * pullback.js — Pullback Zone Detector untuk XAUUSD
 *
 * Mendeteksi apakah harga sedang berada di zona pullback yang ideal
 * berdasarkan EMA + Fibonacci + ATR.
 *
 * Export: detectPullback(candles, direction) → { inZone, zoneType, reason, distance }
 */

const { ema, atr } = require('./indicators');

/**
 * Hitung zona EMA pullback berdasarkan arah trade.
 *
 * BUY  → pullback ke EMA20 atau EMA50 dari atas (harga turun sementara)
 * SELL → pullback ke EMA20 atau EMA50 dari bawah (harga naik sementara)
 *
 * @param {Array}  candles   Candle array [{close, high, low, open}]
 * @param {string} direction 'BUY' | 'SELL'
 * @returns {{ inZone: boolean, zoneType: string, reason: string, distance: number }}
 */
function detectPullback(candles, direction = 'BUY') {
  const result = {
    inZone:   false,
    zoneType: 'NONE',
    reason:   '',
    distance: null,
    ema20:    null,
    ema50:    null,
  };

  if (!candles || candles.length < 52) {
    result.reason = 'Insufficient data';
    return result;
  }

  const ema20Arr = ema(candles, 20);
  const ema50Arr = ema(candles, 50);
  const atrArr   = atr(candles, 14);

  const lastClose = candles[candles.length - 1].close;
  const e20       = ema20Arr[ema20Arr.length - 1];
  const e50       = ema50Arr[ema50Arr.length - 1];
  const lastAtr   = atrArr[atrArr.length - 1];

  result.ema20 = e20;
  result.ema50 = e50;

  if (!e20 || !e50 || !lastAtr) {
    result.reason = 'Indicator not ready';
    return result;
  }

  // Zona pullback = ±0.5 ATR dari EMA20 atau ±1.0 ATR dari EMA50
  const buffer20 = lastAtr * 0.5;
  const buffer50 = lastAtr * 1.0;

  const nearEma20 = Math.abs(lastClose - e20) <= buffer20;
  const nearEma50 = Math.abs(lastClose - e50) <= buffer50;

  if (direction === 'BUY') {
    // Harga harus di ATAS EMA50 (uptrend) dan sedang pullback ke EMA20/EMA50
    const aboveEma50 = lastClose > e50 - buffer50;

    if (!aboveEma50) {
      result.reason = `Harga di bawah EMA50 (${e50.toFixed(2)}) — bukan area buy`;
      result.distance = ((e50 - lastClose) / 0.1).toFixed(1);
      return result;
    }

    if (nearEma20) {
      result.inZone   = true;
      result.zoneType = 'EMA20_PULLBACK';
      result.reason   = `Harga di zona EMA20 pullback (${e20.toFixed(2)})`;
      result.distance = 0;
    } else if (nearEma50) {
      result.inZone   = true;
      result.zoneType = 'EMA50_PULLBACK';
      result.reason   = `Harga di zona EMA50 pullback dalam (${e50.toFixed(2)})`;
      result.distance = 0;
    } else if (lastClose > e20) {
      // Belum pullback — harga masih di atas EMA20
      const distPips  = ((lastClose - e20) / 0.1).toFixed(1);
      result.reason   = `Harga ${distPips} pips di atas EMA20 — tunggu pullback ke ${e20.toFixed(2)}`;
      result.distance = distPips;
    } else {
      // Harga di antara EMA20 dan EMA50 tapi tidak dekat keduanya
      const distPips  = ((e50 - lastClose) / 0.1).toFixed(1);
      result.reason   = `Harga antara EMA20–EMA50 — idealnya tunggu di ${e20.toFixed(2)}–${e50.toFixed(2)}`;
      result.distance = distPips;
    }

  } else {
    // SELL: Harga harus di BAWAH EMA50 (downtrend) dan sedang pullback ke EMA20/EMA50
    const belowEma50 = lastClose < e50 + buffer50;

    if (!belowEma50) {
      result.reason = `Harga di atas EMA50 (${e50.toFixed(2)}) — bukan area sell`;
      result.distance = ((lastClose - e50) / 0.1).toFixed(1);
      return result;
    }

    if (nearEma20) {
      result.inZone   = true;
      result.zoneType = 'EMA20_PULLBACK';
      result.reason   = `Harga di zona EMA20 pullback (${e20.toFixed(2)})`;
      result.distance = 0;
    } else if (nearEma50) {
      result.inZone   = true;
      result.zoneType = 'EMA50_PULLBACK';
      result.reason   = `Harga di zona EMA50 pullback dalam (${e50.toFixed(2)})`;
      result.distance = 0;
    } else if (lastClose < e20) {
      const distPips  = ((e20 - lastClose) / 0.1).toFixed(1);
      result.reason   = `Harga ${distPips} pips di bawah EMA20 — tunggu pullback ke ${e20.toFixed(2)}`;
      result.distance = distPips;
    } else {
      const distPips  = ((lastClose - e50) / 0.1).toFixed(1);
      result.reason   = `Harga antara EMA20–EMA50 — idealnya tunggu di ${e20.toFixed(2)}–${e50.toFixed(2)}`;
      result.distance = distPips;
    }
  }

  return result;
}

module.exports = { detectPullback };
