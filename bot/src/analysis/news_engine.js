/**
 * news_engine.js — News Intelligence Engine
 *
 * Mengambil berita ekonomi relevan dengan XAUUSD (Gold, USD, Fed, FOMC, CPI, dll.)
 * dan menganalisis dampaknya terhadap pasar menggunakan AI Engine Manager.
 *
 * Integrasi: lapisan FILTER tambahan di atas confidence teknikal.
 * Tidak mengganti logika trading utama, ebook engine, atau AI learning.
 *
 * News hanya boleh:
 *   - Menambah confidence (berita mendukung arah)
 *   - Mengurangi confidence (berita berlawanan / netral)
 *   - Memblokir entry (risiko berita sangat tinggi, e.g. NFP rilis dalam 30 menit)
 *
 * v3.2: AI analysis diarahkan ke ai_engine.js (Groq → OpenRouter → Gemini).
 */

const axios  = require('axios');
const engine = require('./ai_engine');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS  = 15 * 60 * 1000; // 15 menit
const FETCH_TIMEOUT = 8_000;           // 8 detik per source
const MAX_NEWS_ITEMS = 8;

const HIGH_IMPACT_KEYWORDS = [
  'nfp', 'non-farm', 'fomc', 'federal reserve', 'powell', 'fed decision',
  'interest rate decision', 'rate hike', 'rate cut', 'emergency meeting',
  'cpi', 'inflation', 'ppi', 'gdp', 'unemployment',
];

const GOLD_KEYWORDS = [
  'gold', 'xauusd', 'xau', 'bullion', 'precious metal',
  'federal reserve', 'fomc', 'powell', 'fed', 'interest rate',
  'cpi', 'ppi', 'nfp', 'non-farm', 'inflation', 'treasury', 'treasury yield',
  'usd', 'dollar', 'dxy', 'geopolit', 'war', 'crisis', 'sanction',
  'risk', 'refuge', 'safe haven',
];

// RSS Sources — gunakan sumber bebas tanpa API key
const NEWS_SOURCES = [
  {
    name: 'Yahoo Finance Gold',
    url:  'https://finance.yahoo.com/rss/headline?s=GC%3DF',
  },
  {
    name: 'MarketWatch FX',
    url:  'https://feeds.marketwatch.com/marketwatch/marketpulse/',
  },
  {
    name: 'Investing.com Commodities',
    url:  'https://www.investing.com/rss/news_301.rss',
  },
];

// ─── CACHE ────────────────────────────────────────────────────────────────────
let _cache       = null;
let _cacheTime   = 0;
let _aiCache     = null;
let _aiCacheTime = 0;
const AI_CACHE_TTL = 30 * 60 * 1000; // 30 menit (sesuai spesifikasi v3.2)

// ─── RSS PARSER ───────────────────────────────────────────────────────────────
function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return '';
  return match[1]
    .replace(/<[^>]+>/g, '')   // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseRssXml(xml, maxItems = MAX_NEWS_ITEMS) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block   = match[1];
    const title   = extractTag(block, 'title');
    const desc    = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    const link    = extractTag(block, 'link');
    if (title) {
      items.push({ title, description: desc.slice(0, 200), pubDate, link });
    }
  }
  return items;
}

function isRelevant(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return GOLD_KEYWORDS.some(kw => text.includes(kw));
}

function isHighImpact(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return HIGH_IMPACT_KEYWORDS.some(kw => text.includes(kw));
}

// ─── FETCH NEWS FROM ONE SOURCE ───────────────────────────────────────────────
async function fetchFromSource(source) {
  try {
    const response = await axios.get(source.url, {
      timeout: FETCH_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept':     'application/rss+xml, application/xml, text/xml',
      },
    });
    const items = parseRssXml(response.data || '');
    const relevant = items.filter(isRelevant);
    console.log(`[NEWS] ${source.name}: ${items.length} items, ${relevant.length} relevant`);
    return relevant;
  } catch (err) {
    console.warn(`[NEWS] ${source.name} gagal: ${err.message}`);
    return [];
  }
}

// ─── FETCH ALL NEWS ───────────────────────────────────────────────────────────
async function fetchNews() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) {
    return _cache;
  }

  const results = await Promise.allSettled(NEWS_SOURCES.map(fetchFromSource));
  const allItems = [];
  const seen = new Set();

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        const key = item.title.slice(0, 60).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allItems.push(item);
        }
      }
    }
  }

  // Sort by pubDate desc (newest first), fallback to order received
  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const top = allItems.slice(0, MAX_NEWS_ITEMS);
  _cache     = top;
  _cacheTime = now;
  return top;
}

// ─── AI ANALYSIS (v3.2: via ai_engine — Groq → OpenRouter → Gemini) ──────────
async function analyzeNewsWithGemini(newsItems) {
  const now = Date.now();
  if (_aiCache && now - _aiCacheTime < AI_CACHE_TTL) {
    return _aiCache;
  }

  if (!newsItems || newsItems.length === 0) return null;

  const newsSummary = newsItems
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title}${n.description ? ': ' + n.description.slice(0, 120) : ''}`)
    .join('\n');

  const prompt = `Kamu adalah analis ekonomi dan trading Gold (XAUUSD) profesional.

Berikut adalah berita ekonomi terbaru yang relevan dengan Gold dan USD:

${newsSummary}

Analisis dampak berita ini dan jawab dalam JSON dengan format persis seperti ini (tidak ada teks di luar JSON):
{
  "core_news": "Inti berita dalam 1 kalimat",
  "impact_gold": "BULLISH",
  "impact_usd": "NETRAL",
  "volatility": "MEDIUM",
  "direction_support": "BUY",
  "confidence_impact": 5,
  "estimated_duration": "2-4 jam",
  "verdict": "ENTRY",
  "reason": "Penjelasan singkat 1-2 kalimat dalam Bahasa Indonesia"
}

Rules:
- impact_gold dan impact_usd harus salah satu: "BULLISH", "BEARISH", "NETRAL"
- volatility harus salah satu: "VERY_HIGH", "HIGH", "MEDIUM", "LOW"
- direction_support harus salah satu: "BUY", "SELL", "NETRAL"
- confidence_impact adalah angka antara -30 sampai +15
- verdict harus salah satu: "ENTRY", "WAIT", "SKIP_TRADE"
- Jika ada berita high-impact dalam waktu dekat (NFP, CPI, FOMC, Rate Decision): verdict = WAIT atau SKIP_TRADE, volatility = HIGH atau VERY_HIGH
- Jika berita mendukung BUY Gold (USD melemah, inflasi tinggi, geopolitik meningkat): impact_gold = BULLISH, confidence_impact positif max +10
- Jika berita mendukung SELL Gold (USD menguat, risk-off mereda): impact_gold = BEARISH, confidence_impact negatif
- Jika tidak ada berita signifikan: verdict = ENTRY, confidence_impact = 0`;

  try {
    const parsed = await engine.callAI(prompt);
    if (!parsed) return null;

    // Sanitize
    const impact = parsed.confidence_impact;
    parsed.confidence_impact = typeof impact === 'number'
      ? Math.max(-30, Math.min(15, impact))
      : 0;
    parsed.verdict = ['ENTRY', 'WAIT', 'SKIP_TRADE'].includes(parsed.verdict)
      ? parsed.verdict
      : 'ENTRY';

    _aiCache     = parsed;
    _aiCacheTime = now;
    return parsed;
  } catch (err) {
    console.warn('[NEWS-ENGINE] AI analisis gagal:', err.message);
    return null;
  }
}

// ─── MAIN: GET NEWS IMPACT ────────────────────────────────────────────────────
/**
 * Ambil berita terbaru dan analisis dampaknya.
 * Fail-safe: jika gagal, return null (scanner tetap berjalan normal).
 *
 * @returns {Promise<{
 *   items: Array,
 *   analysis: object|null,
 *   confidenceAdjustment: number,
 *   blockEntry: boolean,
 *   filterText: string,
 * }|null>}
 */
async function getNewsImpact() {
  try {
    const items = await fetchNews();

    // Jika tidak ada berita relevan
    if (!items || items.length === 0) {
      return {
        items: [],
        analysis: null,
        confidenceAdjustment: 0,
        blockEntry: false,
        filterText: '🟢 Tidak ada berita besar terdeteksi.',
      };
    }

    const analysis = await analyzeNewsWithGemini(items);

    // Hitung apakah ada high-impact news
    const hasHighImpact = items.some(isHighImpact);
    const blockEntry = analysis?.verdict === 'SKIP_TRADE' ||
      (analysis?.volatility === 'VERY_HIGH' && hasHighImpact);

    const confidenceAdjustment = analysis?.confidence_impact ?? 0;

    // Build filter text untuk signal message
    let filterText;
    if (!analysis) {
      filterText = hasHighImpact
        ? '⚠️ Berita high-impact terdeteksi. Pantau dengan cermat.'
        : '🟢 Tidak ada berita besar terdeteksi.';
    } else if (analysis.verdict === 'SKIP_TRADE') {
      filterText = `🔴 Risiko berita sangat tinggi.\nConfidence dikurangi ${Math.abs(confidenceAdjustment)}%.\nAI menyarankan SKIP.`;
    } else if (analysis.verdict === 'WAIT') {
      filterText = `🟡 Berita berisiko terdeteksi.\nConfidence dikurangi ${Math.abs(confidenceAdjustment)}%.\nAI menyarankan WAIT.`;
    } else if (confidenceAdjustment > 0) {
      filterText = `🟢 Berita mendukung arah sinyal (+${confidenceAdjustment}%).`;
    } else if (confidenceAdjustment < 0) {
      filterText = `🟡 Berita berlawanan arah (${confidenceAdjustment}% dari confidence).`;
    } else {
      filterText = '🟢 Tidak ada berita besar dalam waktu dekat.';
    }

    return { items, analysis, confidenceAdjustment, blockEntry, filterText };
  } catch (err) {
    console.warn('[NEWS-ENGINE] getNewsImpact error:', err.message);
    return null;
  }
}

// ─── FORMAT FOR /news COMMAND ─────────────────────────────────────────────────
function formatNewsMessage(newsResult, detail = false) {
  const { items, analysis } = newsResult;
  const lines = [
    `━━━━━━━━━━━━━━━━━━`,
    `📰 <b>AZZAVISION AI — NEWS INTELLIGENCE</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  if (!items || items.length === 0) {
    lines.push(`📭 <i>Tidak ada berita relevan saat ini.</i>`);
  } else {
    lines.push(`📋 <b>${items.length} Berita Relevan (XAUUSD/Gold):</b>`);
    lines.push(``);
    const display = detail ? items : items.slice(0, 5);
    display.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`);
      if (detail && item.description) {
        lines.push(`   <i>${item.description.slice(0, 150)}${item.description.length > 150 ? '...' : ''}</i>`);
      }
    });
  }

  if (analysis) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`🤖 <b>AI ANALYSIS</b>`);
    lines.push(``);

    if (analysis.core_news) {
      lines.push(`📌 <b>Inti Berita:</b>`);
      lines.push(analysis.core_news);
      lines.push(``);
    }

    const goldEmoji = analysis.impact_gold === 'BULLISH' ? '🟢' : analysis.impact_gold === 'BEARISH' ? '🔴' : '🟡';
    const usdEmoji  = analysis.impact_usd === 'BULLISH' ? '🟢' : analysis.impact_usd === 'BEARISH' ? '🔴' : '🟡';
    const volEmoji  = analysis.volatility === 'VERY_HIGH' ? '🔴' : analysis.volatility === 'HIGH' ? '🟠' : analysis.volatility === 'MEDIUM' ? '🟡' : '🟢';

    lines.push(`${goldEmoji} <b>Impact Gold</b>    : ${analysis.impact_gold || '-'}`);
    lines.push(`${usdEmoji} <b>Impact USD</b>     : ${analysis.impact_usd || '-'}`);
    lines.push(`${volEmoji} <b>Volatility</b>     : ${analysis.volatility || '-'}`);
    lines.push(``);

    const adj = analysis.confidence_impact ?? 0;
    const adjSign = adj >= 0 ? '+' : '';
    lines.push(`📡 <b>Confidence Impact</b>: <code>${adjSign}${adj}%</code>`);
    lines.push(`⏱ <b>Estimasi Durasi</b>  : ${analysis.estimated_duration || '-'}`);
    lines.push(``);

    const verdictEmoji = analysis.verdict === 'ENTRY' ? '✅' : analysis.verdict === 'SKIP_TRADE' ? '🚫' : '⏳';
    lines.push(`${verdictEmoji} <b>AI Verdict</b>     : <b>${analysis.verdict || 'ENTRY'}</b>`);

    if (analysis.reason) {
      lines.push(``);
      lines.push(`💬 <b>Alasan:</b>`);
      lines.push(analysis.reason);
    }
  } else if (items && items.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`🤖 <i>Analisis AI tidak tersedia saat ini.</i>`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`💡 <i>Ketik /news detail untuk analisis lengkap tiap berita.</i>`);
  lines.push(`⚡ <i>AZZAVISION AI | News Intelligence Engine v3.2</i>`);

  return lines.join('\n');
}

module.exports = {
  getNewsImpact,
  fetchNews,
  analyzeNewsWithGemini,
  formatNewsMessage,
};
