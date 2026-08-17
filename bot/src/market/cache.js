/**
 * cache.js — Central Price Cache untuk AZZAVISION AI
 *
 * Semua modul membaca dari sini.
 * Scanner mengisi cache setiap 6 detik dengan 1 request spot price.
 * Tidak ada modul lain yang boleh call API langsung untuk harga saat ini.
 */

let priceCache = {
  lastPrice:     null,
  bid:           null,
  ask:           null,
  timestamp:     null,
  trendSummary:  null,  // { m1, m5, m15, h1, h4, overall }
  confidence:    null,
  activeSignals: [],
  updatedAt:     null,
};

const CACHE_VALID_MS = 30 * 1000; // 30 detik — cache dianggap stale setelah ini

function updatePriceCache(data) {
  priceCache = {
    ...priceCache,
    ...data,
    updatedAt: Date.now(),
  };
}

function getPriceCache() {
  return priceCache;
}

function isCacheValid() {
  return priceCache.updatedAt && (Date.now() - priceCache.updatedAt) < CACHE_VALID_MS;
}

function getCachedPrice() {
  return priceCache.lastPrice;
}

function updateTrendCache(trendSummary, confidence) {
  priceCache.trendSummary = trendSummary;
  priceCache.confidence   = confidence;
}

function updateActiveSignals(signals) {
  priceCache.activeSignals = signals || [];
}

module.exports = {
  updatePriceCache,
  getPriceCache,
  isCacheValid,
  getCachedPrice,
  updateTrendCache,
  updateActiveSignals,
};
