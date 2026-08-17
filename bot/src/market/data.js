const axios       = require('axios');
const keyManager  = require('./key_manager');
const { updatePriceCache } = require('./cache');

const SYMBOL   = 'XAU/USD';
const BASE_URL = 'https://api.twelvedata.com';

const dataCache = new Map();
const CACHE_TTL = 4 * 60 * 1000;

const INTERVAL_MAP = {
  '1m':  '1min',
  '5m':  '5min',
  '15m': '15min',
  '60m': '1h',
  '4h':  '4h',
  '1d':  '1day',
};

function getCacheKey(interval, outputsize) {
  return `${SYMBOL}_${interval}_${outputsize}`;
}

function getCached(key) {
  return dataCache.get(key)?.data || null;
}

// ─── FETCH CANDLES (dengan key rotation + retry) ──────────────────────────────
async function fetchCandles(interval, outputsize = 100) {
  const cacheKey = getCacheKey(interval, outputsize);
  const cached   = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const tdInterval = INTERVAL_MAP[interval] || interval;

  const candles = await keyManager.executeWithRetry(async (apiKey) => {
    const { data } = await axios.get(`${BASE_URL}/time_series`, {
      params: {
        symbol:     SYMBOL,
        interval:   tdInterval,
        outputsize: outputsize,
        apikey:     apiKey,
        format:     'JSON',
        timezone:   'UTC',
      },
      timeout: 25000,
    });

    if (data.status === 'error') {
      const msg = data.message || '';
      if (
        msg.toLowerCase().includes('rate limit')  ||
        msg.toLowerCase().includes('quota')       ||
        msg.toLowerCase().includes('credits')     ||
        msg.toLowerCase().includes('api calls limit')
      ) {
        const err = new Error(`Rate limit: ${msg}`);
        err.response = { status: 429 };
        throw err;
      }
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('unauthorized')) {
        const err = new Error(`Invalid key: ${msg}`);
        err.response = { status: 401 };
        throw err;
      }
      throw new Error(`Twelve Data error: ${msg}`);
    }

    const values = data.values || [];
    if (values.length === 0) throw new Error('Twelve Data mengembalikan data kosong');

    return values.reverse().map(v => ({
      time:   new Date(v.datetime.replace(' ', 'T') + '+00:00').getTime(),
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: parseFloat(v.volume || '0'),
    }));
  });

  dataCache.set(cacheKey, { ts: Date.now(), data: candles });
  return candles;
}

// ─── GET ALL TIMEFRAMES ───────────────────────────────────────────────────────
async function getAllTimeframes() {
  const [m1, m5, m15, h1, h4] = await Promise.all([
    fetchCandles('1m',   50).catch(e  => { console.error('[DATA] M1 fail:', e.message);  return getCached(getCacheKey('1m',  50))  || []; }),
    fetchCandles('5m',  100).catch(e  => { console.error('[DATA] M5 fail:', e.message);  return getCached(getCacheKey('5m', 100))  || []; }),
    fetchCandles('15m', 100).catch(e  => { console.error('[DATA] M15 fail:', e.message); return getCached(getCacheKey('15m',100)) || []; }),
    fetchCandles('60m', 100).catch(e  => { console.error('[DATA] H1 fail:', e.message);  return getCached(getCacheKey('60m',100)) || []; }),
    fetchCandles('4h',  100).catch(e  => { console.error('[DATA] H4 fail:', e.message);  return getCached(getCacheKey('4h', 100))  || []; }),
  ]);

  if (m5.length === 0 && h1.length === 0 && h4.length === 0) {
    throw new Error('Semua sumber data gagal — cek api_keys.json dan koneksi internet server');
  }
  return { m1, m5, m15, h1, h4 };
}

// ─── FETCH SPOT PRICE — digunakan oleh scanner 6 detik (1 request per siklus) ─
async function fetchSpotPrice() {
  const price = await keyManager.executeWithRetry(async (apiKey) => {
    const { data } = await axios.get(`${BASE_URL}/price`, {
      params: { symbol: SYMBOL, apikey: apiKey },
      timeout: 10000,
    });

    if (data.status === 'error') {
      const msg = data.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
        const err = new Error(`Rate limit: ${msg}`); err.response = { status: 429 }; throw err;
      }
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('unauthorized')) {
        const err = new Error(`Invalid key: ${msg}`); err.response = { status: 401 }; throw err;
      }
      throw new Error(msg);
    }
    if (!data.price) throw new Error('Tidak ada harga dalam respons');
    return parseFloat(data.price);
  });

  // Simpan ke central price cache
  updatePriceCache({
    lastPrice: price,
    bid:       parseFloat((price - 0.02).toFixed(2)),
    ask:       parseFloat((price + 0.02).toFixed(2)),
    timestamp: new Date().toISOString(),
  });

  return price;
}

// ─── GET CURRENT PRICE ────────────────────────────────────────────────────────
// Untuk modul lain. Prioritas: cache → API fallback
async function getCurrentPrice() {
  const { getCachedPrice } = require('./cache');
  const cached = getCachedPrice();
  if (cached) return cached;

  // Fallback: fetch jika cache belum terisi (bot baru start)
  try {
    return await fetchSpotPrice();
  } catch (e) {
    console.warn('[DATA] getCurrentPrice gagal, pakai candle cache:', e.message);
    const c = getCached(getCacheKey('1m', 50));
    return c?.length > 0 ? c[c.length - 1].close : null;
  }
}

// ─── GET PRICE INFO ───────────────────────────────────────────────────────────
// Digunakan /start dashboard — baca dari cache dulu, hemat API
async function getPriceInfo() {
  const { getPriceCache, isCacheValid } = require('./cache');
  const cache = getPriceCache();

  if (isCacheValid() && cache.lastPrice) {
    const price = cache.lastPrice;
    return {
      price,
      prevClose:  price,
      change:     0,
      changePct:  0,
      high:       cache.ask || price,
      low:        cache.bid || price,
      currency:   'USD',
      symbol:     'XAUUSD',
      fromCache:  true,
      cachedAt:   cache.timestamp,
    };
  }

  // Cache belum ada atau kedaluwarsa — fetch /quote (lebih lengkap)
  return keyManager.executeWithRetry(async (apiKey) => {
    const { data } = await axios.get(`${BASE_URL}/quote`, {
      params: { symbol: SYMBOL, apikey: apiKey },
      timeout: 15000,
    });

    if (data.status === 'error') {
      const msg = data.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
        const err = new Error(`Rate limit: ${msg}`); err.response = { status: 429 }; throw err;
      }
      throw new Error(`Twelve Data quote error: ${msg}`);
    }

    const price     = parseFloat(data.close);
    const prevClose = parseFloat(data.previous_close);
    const change    = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    // Isi cache dengan data ini
    updatePriceCache({
      lastPrice: price,
      bid:       parseFloat(data.low)  || parseFloat((price - 0.02).toFixed(2)),
      ask:       parseFloat(data.high) || parseFloat((price + 0.02).toFixed(2)),
      timestamp: new Date().toISOString(),
    });

    return {
      price, prevClose, change, changePct,
      high:     parseFloat(data.high),
      low:      parseFloat(data.low),
      currency: 'USD',
      symbol:   'XAUUSD',
    };
  });
}

module.exports = { getAllTimeframes, getCurrentPrice, getPriceInfo, fetchCandles, fetchSpotPrice };
