/**
 * ai_engine.js — Multi AI Engine Manager v3.2
 *
 * Priority chain: Groq → OpenRouter → Gemini
 * Setiap provider mendukung multi-key dengan rotasi otomatis.
 * Jika semua provider gagal, fungsi return null — bot tetap berjalan normal.
 *
 * SEMUA pemanggilan AI harus melalui file ini.
 * Tidak boleh ada pemanggilan langsung ke provider AI di file lain.
 */

'use strict';

const axios = require('axios');
const km    = require('./ai_key_manager');

const TIMEOUT_MS = 20_000;

// ─── PROVIDER MODELS ──────────────────────────────────────────────────────────
const MODELS = {
  groq:       process.env.GROQ_MODEL       || 'llama-3.3-70b-versatile',
  openrouter: process.env.OPENROUTER_MODEL || 'poolside/laguna-s-2.1:free',
  gemini:     process.env.GEMINI_MODEL     || 'gemini-3.6-flash',
};

const DEFAULT_ORDER = ['groq', 'openrouter', 'gemini'];

// ─── PROVIDER ORDER (respects /provider set) ─────────────────────────────────
function getProviderOrder() {
  const cfg = km.getProviderConfig();
  if (cfg.mode === 'manual' && cfg.primary && DEFAULT_ORDER.includes(cfg.primary)) {
    const rest = DEFAULT_ORDER.filter(p => p !== cfg.primary);
    return [cfg.primary, ...rest];
  }
  return DEFAULT_ORDER;
}

// ─── JSON EXTRACTOR (fallback jika model tidak support JSON mode) ─────────────
function extractJSON(text) {
  try { return JSON.parse(text); } catch { /* */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  return null;
}

// ─── GROQ CALL ────────────────────────────────────────────────────────────────
async function _callGroq(prompt, key) {
  const t0  = Date.now();
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model:           MODELS.groq,
      messages:        [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature:     0.2,
      max_tokens:      2048,
    },
    {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
    }
  );
  const latency = ((Date.now() - t0) / 1000).toFixed(1);
  const content = res.data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty Groq response');
  return { parsed: extractJSON(content), latency };
}

// ─── OPENROUTER CALL ─────────────────────────────────────────────────────────
async function _callOpenRouter(prompt, key) {
  const t0  = Date.now();
  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model:           MODELS.openrouter,
      messages:        [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature:     0.2,
      max_tokens:      2048,
    },
    {
      headers: {
        Authorization:   `Bearer ${key}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://azzavision.ai',
        'X-Title':       'AZZAVISION AI',
      },
      timeout: TIMEOUT_MS,
    }
  );
  const latency = ((Date.now() - t0) / 1000).toFixed(1);
  const content = res.data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenRouter response');
  return { parsed: extractJSON(content), latency };
}

// ─── GEMINI CALL ─────────────────────────────────────────────────────────────
async function _callGemini(prompt, key) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const t0  = Date.now();
  const gen = new GoogleGenerativeAI(key);
  const m   = gen.getGenerativeModel({
    model:            MODELS.gemini,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.2,
      maxOutputTokens:  2048,
    },
  });
  const tPromise = m.generateContent(prompt);
  const tTimeout = new Promise((_, r) => setTimeout(() => r(new Error('Gemini timeout')), TIMEOUT_MS));
  const result   = await Promise.race([tPromise, tTimeout]);
  const latency  = ((Date.now() - t0) / 1000).toFixed(1);
  const text     = result.response.text();
  return { parsed: extractJSON(text), latency };
}

// ─── SINGLE PROVIDER CALL (with multi-key rotation) ──────────────────────────
async function _tryProvider(provider, prompt) {
  const readyKeys = km.getReadyKeys(provider);
  const envKey    = km.getEnvKey(provider);

  // Gabungkan: managed keys (prioritas) + env key (fallback terakhir)
  const candidates = [
    ...readyKeys,
    ...(envKey && !readyKeys.some(k => k.key === envKey)
      ? [{ key: envKey, index: 'ENV', status: 'ACTIVE' }]
      : []),
  ];

  if (candidates.length === 0) return null; // tidak ada key sama sekali

  for (const entry of candidates) {
    const { key, index } = entry;
    try {
      let result;
      if      (provider === 'groq')       result = await _callGroq(prompt, key);
      else if (provider === 'openrouter') result = await _callOpenRouter(prompt, key);
      else if (provider === 'gemini')     result = await _callGemini(prompt, key);
      else return null;

      if (!result.parsed) throw new Error('Tidak bisa parse JSON dari response');

      console.log(`[AI] Provider: ${provider.toUpperCase()} | Key: #${index} | Latency: ${result.latency}s | Status: SUCCESS`);
      if (entry.key !== envKey) km.markKeyUsed(provider, key);
      return result.parsed;

    } catch (err) {
      const status = err.response?.status;
      const msg    = err.message || '';

      if (status === 429 || /quota|rate.?limit|too.?many/i.test(msg)) {
        const retryAfter = err.response?.headers?.['retry-after'];
        const coolMs     = retryAfter ? parseInt(retryAfter) * 1000 : 60_000;
        if (entry.key !== envKey) km.markKeyLimit(provider, key, coolMs);
        console.log(`[AI] Provider: ${provider.toUpperCase()} | Key: #${index} | 429/LIMIT (cooldown ${coolMs / 1000}s) → Next key`);
        continue;
      }

      if (status === 401 || status === 403 || /invalid.?key|unauthorized|api.?key/i.test(msg)) {
        if (entry.key !== envKey) km.markKeyInvalid(provider, key);
        console.log(`[AI] Provider: ${provider.toUpperCase()} | Key: #${index} | INVALID KEY → Next key`);
        continue;
      }

      if (/timeout|ECONNRESET|ENOTFOUND|ECONNREFUSED/i.test(msg)) {
        console.log(`[AI] Provider: ${provider.toUpperCase()} | Key: #${index} | TIMEOUT/NETWORK → Next key`);
        continue;
      }

      // Error lain (parse error, empty response, dll)
      console.log(`[AI] Provider: ${provider.toUpperCase()} | Key: #${index} | ERROR: ${msg.slice(0, 80)} → Next key`);
      continue;
    }
  }

  console.log(`[AI] Provider: ${provider.toUpperCase()} | Semua key habis → Switch provider`);
  return null;
}

// ─── MAIN DISPATCHER ─────────────────────────────────────────────────────────
async function callAI(prompt) {
  const order = getProviderOrder();
  for (const provider of order) {
    const result = await _tryProvider(provider, prompt);
    if (result) return result;
  }
  console.warn('[AI] ⚠️  Semua provider gagal — AI tidak tersedia, bot tetap berjalan normal.');
  return null;
}

// ─── PUBLIC AI FUNCTIONS ─────────────────────────────────────────────────────
// Semua fungsi ini menggantikan panggilan langsung ke gemini.js/groq/openrouter.

function _safe(v) {
  if (v === null || v === undefined) return 'N/A';
  return String(v).replace(/"/g, "'");
}

// 1. VALIDATE / REVIEW SIGNAL ─────────────────────────────────────────────────
async function reviewSignal(signalData, analysis) {
  const { direction, entry, tp1, tp2, sl, confidence } = signalData;
  const riskPips  = Math.abs(entry - sl).toFixed(1);
  const rwTp1     = Math.abs(tp1 - entry).toFixed(1);
  const rwTp2     = Math.abs(tp2 - entry).toFixed(1);
  const rrTp1     = (Math.abs(tp1 - entry) / Math.abs(entry - sl)).toFixed(2);
  const rrTp2     = (Math.abs(tp2 - entry) / Math.abs(entry - sl)).toFixed(2);

  const prompt = `
Kamu adalah AI Trading Advisor yang menganalisis sinyal XAUUSD (Gold) secara objektif.
Tugasmu hanya memberi SECOND OPINION — bukan mengeksekusi trade.
Semua nilai Entry, TP, SL sudah ditetapkan oleh mesin trading. Kamu TIDAK bisa mengubahnya.

=== SIGNAL KANDIDAT ===
Pair      : XAUUSD
Direction : ${_safe(direction)}
Entry     : ${entry.toFixed(2)}
TP1       : ${tp1.toFixed(2)} (+${rwTp1} pts | RR 1:${rrTp1})
TP2       : ${tp2.toFixed(2)} (+${rwTp2} pts | RR 1:${rrTp2})
SL        : ${sl.toFixed(2)} (-${riskPips} pts)
Confidence: ${confidence}%

=== ANALISIS MULTI-TIMEFRAME ===
H4 Bias   : ${_safe(analysis?.h4?.bias)}
H1 Bias   : ${_safe(analysis?.h1?.bias)}
M15 Bias  : ${_safe(analysis?.m15?.bias)}
M5 Bias   : ${_safe(analysis?.m5?.bias)}
M1 Bias   : ${_safe(analysis?.m1?.bias)}
H4 RSI    : ${analysis?.h4?.rsi ? analysis.h4.rsi.toFixed(1) : 'N/A'}
M5 RSI    : ${analysis?.m5?.rsi ? analysis.m5.rsi.toFixed(1) : 'N/A'}

=== TUGAS ===
Berikan verdict APPROVE atau REJECT, score 0-100, reasons (2-4 poin, bahasa Indonesia),
advice (1-3 poin, bahasa Indonesia), dan evaluasi TP/SL.
AI TIDAK boleh mengubah nilai TP maupun SL — hanya memberi opini.

Output HARUS valid JSON:
{
  "verdict": "APPROVE",
  "score": 85,
  "reasons": ["Trend H4 dan H1 searah", "Momentum M15 mendukung"],
  "advice": ["Tunggu candle M5 selesai sebelum entry agresif"],
  "tp_sl": {
    "sl_comment": "SL proporsional dengan volatilitas",
    "tp1_comment": "TP1 realistis",
    "tp2_comment": "TP2 agresif namun layak",
    "rr_comment": "Risk/Reward cukup baik",
    "trailing_suggestion": "Pertimbangkan trailing stop setelah TP1 tercapai"
  }
}`.trim();

  try {
    const parsed = await callAI(prompt);
    if (!parsed || !['APPROVE', 'REJECT'].includes(parsed.verdict)) return null;
    return {
      verdict: parsed.verdict,
      score:   typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 4) : [],
      advice:  Array.isArray(parsed.advice)  ? parsed.advice.slice(0, 3)  : [],
      tp_sl:   parsed.tp_sl || null,
    };
  } catch (e) {
    console.warn('[AI] reviewSignal error (fail-safe):', e.message);
    return null;
  }
}

// 2. REVIEW MARKET ─────────────────────────────────────────────────────────────
async function reviewMarket(result, overall) {
  const a = result?.analysis || {};
  const prompt = `
Kamu adalah AI Trading Advisor untuk XAUUSD (Gold Spot).
Tugasmu menganalisis kondisi market saat ini dan memberi pandangan objektif.

=== KONDISI MARKET SAAT INI ===
Overall Bias : ${_safe(overall?.label)}
H4 Bias      : ${_safe(a?.h4?.bias)}
H1 Bias      : ${_safe(a?.h1?.bias)}
M15 Bias     : ${_safe(a?.m15?.bias)}
M5 Bias      : ${_safe(a?.m5?.bias)}
M1 Bias      : ${_safe(a?.m1?.bias)}
H4 RSI       : ${a?.h4?.rsi ? a.h4.rsi.toFixed(1) : 'N/A'}
M5 RSI       : ${a?.m5?.rsi ? a.m5.rsi.toFixed(1) : 'N/A'}
Aligned      : ${result?.aligned ? 'YA (H4+H1 searah)' : 'BELUM'}
Spike Risk   : ${result?.spikeRisk ? 'YA' : 'TIDAK'}
Volatilitas  : ${_safe(result?.volatility)}
Confidence   : ${result?.confidence || 0}%
M5 Entry     : ${result?.m5Entry?.valid ? 'VALID' : ('BELUM — ' + _safe(result?.m5Entry?.reason))}

=== TUGAS ===
Berikan ringkasan kondisi market, verdict (BULLISH_BIAS / BEARISH_BIAS / NEUTRAL / WAIT_CONFIRMATION),
score 0-100, reasons (3-5 poin, bahasa Indonesia), advice (2-3 poin, bahasa Indonesia),
dan katalis berikutnya yang perlu diperhatikan.

Output HARUS valid JSON:
{
  "verdict": "WAIT_CONFIRMATION",
  "score": 62,
  "summary": "Market XAUUSD saat ini dalam fase konsolidasi...",
  "reasons": ["H4 bullish namun H1 belum konfirmasi", "RSI M5 mendekati overbought"],
  "advice": ["Tunggu rejection candle M5 yang jelas", "Perhatikan level support terdekat"],
  "next_catalyst": "Konfirmasi H1 bullish dan rejection candle M5"
}`.trim();

  try {
    const parsed = await callAI(prompt);
    if (!parsed || !parsed.verdict) return null;
    return {
      verdict:       parsed.verdict,
      score:         typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50,
      summary:       parsed.summary || '',
      reasons:       Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
      advice:        Array.isArray(parsed.advice)  ? parsed.advice.slice(0, 3)  : [],
      next_catalyst: parsed.next_catalyst || '',
    };
  } catch (e) {
    console.warn('[AI] reviewMarket error (fail-safe):', e.message);
    return null;
  }
}

// 3. REVIEW WHY ───────────────────────────────────────────────────────────────
async function reviewWhy(result, reasons, overall) {
  const a = result?.analysis || {};
  const reasonsText = Array.isArray(reasons) && reasons.length > 0
    ? reasons.join('\n- ')
    : 'Belum ada sinyal valid terdeteksi.';

  const prompt = `
Kamu adalah AI Trading Advisor yang membantu trader memahami kondisi market XAUUSD.
Jelaskan dengan bahasa yang mudah dipahami trader retail mengapa bot trading belum entry.

=== KONDISI TEKNIKAL ===
Overall Bias : ${_safe(overall?.label)}
H4 Bias      : ${_safe(a?.h4?.bias)}
H1 Bias      : ${_safe(a?.h1?.bias)}
M15 Bias     : ${_safe(a?.m15?.bias)}
M5 Bias      : ${_safe(a?.m5?.bias)}
Aligned      : ${result?.aligned ? 'YA' : 'BELUM'}
Spike Risk   : ${result?.spikeRisk ? 'YA' : 'TIDAK'}
Confidence   : ${result?.confidence || 0}%
M5 Entry     : ${result?.m5Entry?.valid ? 'VALID' : _safe(result?.m5Entry?.reason)}

=== PENYEBAB TEKNIKAL ===
- ${reasonsText}

=== TUGAS ===
Buat penjelasan natural (3-5 kalimat, bahasa Indonesia yang ramah trader) mengapa bot belum entry,
dan saran singkat apa yang harus trader perhatikan.

Output HARUS valid JSON:
{
  "explanation": "Saat ini bot belum entry karena...",
  "suggestion": "Trader bisa memantau..."
}`.trim();

  try {
    const parsed = await callAI(prompt);
    if (!parsed || !parsed.explanation) return null;
    return { explanation: parsed.explanation, suggestion: parsed.suggestion || '' };
  } catch (e) {
    console.warn('[AI] reviewWhy error (fail-safe):', e.message);
    return null;
  }
}

// 4. CHAT AI ──────────────────────────────────────────────────────────────────
async function chatAI(question, marketContext) {
  const ctxBlock = marketContext
    ? `\n=== KONTEKS MARKET SAAT INI ===\n${marketContext}`
    : '';

  const prompt = `
Kamu adalah AI Trading Advisor untuk trader XAUUSD (Gold).
Jawab pertanyaan berikut dengan jelas, singkat, dan dalam bahasa Indonesia.
Fokus pada trading gold dan analisis teknikal.
${ctxBlock}

=== PERTANYAAN ===
${_safe(question)}

Output HARUS valid JSON:
{
  "answer": "Jawaban lengkap di sini dalam bahasa Indonesia...",
  "key_points": ["Poin 1", "Poin 2", "Poin 3"]
}`.trim();

  try {
    const parsed = await callAI(prompt);
    if (!parsed || !parsed.answer) return null;
    let text = parsed.answer;
    if (Array.isArray(parsed.key_points) && parsed.key_points.length > 0) {
      text += '\n\n<b>Poin Kunci:</b>\n' + parsed.key_points.map(p => `• ${p}`).join('\n');
    }
    return text;
  } catch (e) {
    console.warn('[AI] chatAI error (fail-safe):', e.message);
    return null;
  }
}

// 5. ANALYZE NEWS ─────────────────────────────────────────────────────────────
async function analyzeNews(newsItems, direction) {
  if (!newsItems || newsItems.length === 0) return null;

  const newsList = newsItems.slice(0, 6).map((n, i) =>
    `${i + 1}. [${n.source || 'News'}] ${n.title}`
  ).join('\n');

  const prompt = `
Kamu adalah AI Analis Berita Trading untuk XAUUSD (Gold).
Analisis berita-berita berikut dan tentukan dampaknya terhadap arah harga Gold.
${direction ? `\nKonteks: Bot saat ini mempertimbangkan sinyal ${direction}.` : ''}

=== BERITA TERKINI ===
${newsList}

=== TUGAS ===
Tentukan dampak berita terhadap XAUUSD:
- impact: "bullish", "bearish", "neutral", atau "high_risk"
- confidence_adjustment: angka antara -30 hingga +20 (berapa % mengubah confidence sinyal)
- reason: penjelasan singkat dalam bahasa Indonesia (1-2 kalimat)
- block_entry: true jika ada berita risiko sangat tinggi (NFP/FOMC dalam 30 menit), false jika tidak

Output HARUS valid JSON:
{
  "impact": "bullish",
  "confidence_adjustment": 10,
  "reason": "Sentimen risk-off mendorong permintaan gold sebagai safe haven.",
  "block_entry": false,
  "high_impact_events": []
}`.trim();

  try {
    const parsed = await callAI(prompt);
    if (!parsed || !parsed.impact) return null;
    return {
      impact:                parsed.impact || 'neutral',
      confidence_adjustment: typeof parsed.confidence_adjustment === 'number'
        ? Math.max(-30, Math.min(20, parsed.confidence_adjustment))
        : 0,
      reason:            parsed.reason || '',
      block_entry:       !!parsed.block_entry,
      high_impact_events: Array.isArray(parsed.high_impact_events) ? parsed.high_impact_events : [],
    };
  } catch (e) {
    console.warn('[AI] analyzeNews error (fail-safe):', e.message);
    return null;
  }
}

// 6. GENERATE AI REVIEW (generic — untuk fitur review lainnya) ─────────────────
async function generateAIReview(prompt) {
  try {
    return await callAI(prompt);
  } catch (e) {
    console.warn('[AI] generateAIReview error (fail-safe):', e.message);
    return null;
  }
}

// ─── TEST ALL KEYS ────────────────────────────────────────────────────────────
const TEST_PROMPT = '{"test":true}\nRespond with valid JSON: {"status":"ok","message":"AI Engine test successful"}';

async function testAllKeys() {
  const results = [];

  for (const provider of DEFAULT_ORDER) {
    const data    = require('./ai_key_manager').getDashboard
      ? require('./ai_key_manager').getDashboard()
      : null;
    const keys    = km.getReadyKeys(provider);
    const envKey  = km.getEnvKey(provider);

    const allKeys = [
      ...keys,
      ...(envKey && !keys.some(k => k.key === envKey)
        ? [{ key: envKey, index: 'ENV', status: 'ACTIVE' }]
        : []),
    ];

    for (const entry of allKeys) {
      const t0 = Date.now();
      try {
        let res;
        if      (provider === 'groq')       res = await _callGroq(TEST_PROMPT, entry.key);
        else if (provider === 'openrouter') res = await _callOpenRouter(TEST_PROMPT, entry.key);
        else if (provider === 'gemini')     res = await _callGemini(TEST_PROMPT, entry.key);

        const latency = ((Date.now() - t0) / 1000).toFixed(1);
        results.push({ provider, index: entry.index, status: 'OK', latency: `${latency}s` });
      } catch (err) {
        const latency = ((Date.now() - t0) / 1000).toFixed(1);
        const errCode = err.response?.status || (err.message?.includes('timeout') ? 'TIMEOUT' : 'ERROR');
        results.push({ provider, index: entry.index, status: String(errCode), latency: `${latency}s`, error: err.message?.slice(0, 60) });
      }
    }
  }

  return results;
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function getEngineStatus() {
  const cfg   = km.getProviderConfig();
  const order = getProviderOrder();
  const dash  = km.getDashboard();

  return {
    mode:          cfg.mode,
    primaryProvider: cfg.primary || order[0],
    providerOrder: order,
    keys:          dash,
  };
}

module.exports = {
  // Core
  callAI,
  // Named functions for each use-case
  reviewSignal,
  reviewMarket,
  reviewWhy,
  chatAI,
  analyzeNews,
  generateAIReview,
  // Testing & status
  testAllKeys,
  getEngineStatus,
  getProviderOrder,
};
