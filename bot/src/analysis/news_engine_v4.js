/**
 * news_engine_v4.js — News Intelligence v4.0
 *
 * Upgrade total dari news_engine.js:
 * 1. Ambil judul + ringkasan artikel (full description)
 * 2. AI membaca ringkasan tiap artikel
 * 3. AI mengelompokkan ke 5 kategori
 * 4. AI memberi bobot 1-10
 * 5. AI menghitung skor pasar (Bullish/Bearish/Neutral)
 * 6. AI memberikan verdict dengan alasan dari isi artikel (BUKAN karangan)
 *
 * Backward compatible — masih export getNewsImpact() seperti v3.x.
 * Command /news menggunakan formatNewsMessageV4() dari sini.
 */

'use strict';

const axios  = require('axios');
const engine = require('./ai_engine');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS   = 20 * 60 * 1000;  // 20 menit
const AI_CACHE_TTL   = 30 * 60 * 1000;  // 30 menit
const FETCH_TIMEOUT  = 10_000;
const MAX_ITEMS      = 12;

// ─── NEWS SOURCES (lebih banyak dari v3) ──────────────────────────────────────
const NEWS_SOURCES = [
  {
    name: 'Yahoo Finance Gold',
    url:  'https://finance.yahoo.com/rss/headline?s=GC%3DF',
  },
  {
    name: 'MarketWatch Market Pulse',
    url:  'https://feeds.marketwatch.com/marketwatch/marketpulse/',
  },
  {
    name: 'Investing.com Commodities',
    url:  'https://www.investing.com/rss/news_301.rss',
  },
  {
    name: 'FXStreet Gold',
    url:  'https://www.fxstreet.com/rss/news',
  },
  {
    name: 'Kitco News',
    url:  'https://www.kitco.com/rss/kitco-metals-news.rss',
  },
];

const GOLD_KEYWORDS = [
  'gold', 'xauusd', 'xau', 'bullion', 'precious metal',
  'federal reserve', 'fomc', 'powell', 'fed', 'interest rate',
  'cpi', 'ppi', 'nfp', 'non-farm', 'inflation', 'treasury', 'treasury yield',
  'usd', 'dollar', 'dxy', 'geopolit', 'war', 'crisis', 'sanction',
  'risk', 'refuge', 'safe haven', 'gdp', 'central bank', 'monetary',
  'etf', 'hedge fund', 'mining', 'reserve', 'rate decision',
];

// ─── CACHE ────────────────────────────────────────────────────────────────────
let _cache       = null;
let _cacheTime   = 0;
let _aiCache     = null;
let _aiCacheTime = 0;

// ─── RSS PARSER ───────────────────────────────────────────────────────────────
function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return '';
  return match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function parseRssXml(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < MAX_ITEMS) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const desc  = extractTag(block, 'description') || extractTag(block, 'summary') || '';
    const link  = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'updated') || '';
    if (title) {
      items.push({
        title,
        summary: desc.slice(0, 400),
        link,
        pubDate,
      });
    }
  }
  return items;
}

function isRelevant(item) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return GOLD_KEYWORDS.some(kw => text.includes(kw));
}

// ─── FETCH ONE SOURCE ─────────────────────────────────────────────────────────
async function fetchFromSource(source) {
  try {
    const res = await axios.get(source.url, {
      timeout: FETCH_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/4.0)',
        'Accept':     'application/rss+xml, application/xml, text/xml',
      },
    });
    const items    = parseRssXml(res.data || '');
    const relevant = items.filter(isRelevant);
    console.log(`[NEWS-V4] ${source.name}: ${items.length} items, ${relevant.length} relevant`);
    return relevant;
  } catch (err) {
    console.warn(`[NEWS-V4] ${source.name} gagal: ${err.message}`);
    return [];
  }
}

// ─── FETCH ALL NEWS ───────────────────────────────────────────────────────────
async function fetchNewsV4() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  const results = await Promise.allSettled(NEWS_SOURCES.map(fetchFromSource));
  const allItems = [];
  const seen = new Set();

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      const key = item.title.slice(0, 60).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allItems.push(item);
      }
    }
  }

  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const top     = allItems.slice(0, MAX_ITEMS);
  _cache        = top;
  _cacheTime    = now;
  return top;
}

// ─── CATEGORY DEFINITIONS ──────────────────────────────────────────────────────
const CATEGORIES = {
  MACRO:        { label: 'Macro Economy',  emoji: '🏦' },
  GEOPOLITICS:  { label: 'Geopolitics',    emoji: '🌍' },
  CENTRAL_BANK: { label: 'Central Bank',   emoji: '🏛️' },
  INSTITUTIONAL:{ label: 'Institutional',  emoji: '📊' },
  MINING:       { label: 'Mining Company', emoji: '⛏️' },
  OTHER:        { label: 'Other',          emoji: '📰' },
};

// ─── WEIGHT TABLE ─────────────────────────────────────────────────────────────
const WEIGHT_EMOJI = {
  10: '🟥', 9: '🟥', 8: '🟧', 7: '🟧',
  6: '🟨', 5: '🟨', 4: '🟨', 3: '🟩', 2: '🟩', 1: '🟩',
};

// ─── FULL AI ANALYSIS (v4) ────────────────────────────────────────────────────
async function analyzeNewsV4(newsItems) {
  const now = Date.now();
  if (_aiCache && now - _aiCacheTime < AI_CACHE_TTL) return _aiCache;
  if (!newsItems || newsItems.length === 0) return null;

  const newsSummary = newsItems.slice(0, 10).map((n, i) => {
    const summary = n.summary ? `: ${n.summary.slice(0, 250)}` : '';
    return `${i + 1}. "${n.title}"${summary}`;
  }).join('\n');

  const prompt = `Kamu adalah analis fundamental senior untuk XAUUSD (Gold/USD).

Berikut adalah berita/ringkasan artikel terbaru yang relevan dengan Gold, USD, dan ekonomi global:

${newsSummary}

TUGAS: Analisis setiap berita di atas lalu return JSON dengan format persis berikut (TIDAK ada teks di luar JSON):

{
  "items": [
    {
      "index": 1,
      "title": "judul berita",
      "category": "MACRO",
      "weight": 9,
      "direction": "BEARISH_GOLD",
      "key_fact": "1 kalimat fakta dari artikel ini saja"
    }
  ],
  "market_score": {
    "bullish_pct": 30,
    "bearish_pct": 55,
    "neutral_pct": 15
  },
  "ai_verdict": {
    "action": "SELL",
    "fundamental_summary": "Ringkasan fundamental berdasarkan artikel di atas (2-3 kalimat)",
    "sentiment_summary": "Ringkasan sentimen pasar berdasarkan artikel di atas (1-2 kalimat)",
    "usd_impact": "BULLISH/BEARISH/NEUTRAL",
    "gold_impact": "BULLISH/BEARISH/NEUTRAL",
    "volatility_impact": "HIGH/MEDIUM/LOW",
    "duration_estimate": "contoh: 4-8 jam",
    "reason": "Alasan 2-3 kalimat menggunakan HANYA fakta dari artikel di atas"
  },
  "confidence_impact": 5
}

RULES:
- category harus salah satu: MACRO, GEOPOLITICS, CENTRAL_BANK, INSTITUTIONAL, MINING, OTHER
- weight adalah angka 1-10
- direction harus salah satu: BULLISH_GOLD, BEARISH_GOLD, NEUTRAL
- action harus salah satu: BUY, SELL, WAIT, HIGH_RISK, NO_TRADE
- bullish_pct + bearish_pct + neutral_pct = 100
- confidence_impact adalah angka -15 sampai +10
- reason HANYA menggunakan fakta dari artikel yang diberikan — JANGAN mengarang
- Jika artikel tidak menyebut Fed, JANGAN sebut Fed di reason
- Jika artikel tidak menyebut perang, JANGAN sebut perang di reason`;

  try {
    const parsed = await engine.callAI(prompt);
    if (!parsed || !parsed.ai_verdict) return null;

    // Sanitize
    const ci = parsed.confidence_impact;
    parsed.confidence_impact = typeof ci === 'number' ? Math.max(-20, Math.min(15, ci)) : 0;

    if (!['BUY', 'SELL', 'WAIT', 'HIGH_RISK', 'NO_TRADE'].includes(parsed.ai_verdict?.action)) {
      parsed.ai_verdict.action = 'WAIT';
    }

    _aiCache     = parsed;
    _aiCacheTime = now;
    return parsed;
  } catch (err) {
    console.warn('[NEWS-V4] AI analisis gagal:', err.message);
    return null;
  }
}

// ─── MAIN: GET NEWS IMPACT (backward compatible) ──────────────────────────────
async function getNewsImpact() {
  try {
    const items    = await fetchNewsV4();
    if (!items || items.length === 0) {
      return {
        items: [], analysis: null,
        confidenceAdjustment: 0, blockEntry: false,
        filterText: '🟢 Tidak ada berita besar terdeteksi.',
        v4: null,
      };
    }

    const v4       = await analyzeNewsV4(items);
    const ci       = v4?.confidence_impact ?? 0;
    const action   = v4?.ai_verdict?.action;
    const blockEntry = action === 'NO_TRADE' || action === 'HIGH_RISK';

    let filterText;
    if (!v4) {
      filterText = '⚠️ Analisis AI tidak tersedia saat ini.';
    } else if (blockEntry) {
      filterText = `🔴 Risiko berita tinggi (${action}). Confidence dikurangi ${Math.abs(ci)}%.`;
    } else if (action === 'WAIT') {
      filterText = `🟡 AI menyarankan WAIT. Confidence ${ci >= 0 ? '+' : ''}${ci}%.`;
    } else if (ci > 0) {
      filterText = `🟢 Berita mendukung arah sinyal (+${ci}%).`;
    } else if (ci < 0) {
      filterText = `🟡 Berita berlawanan arah (${ci}% dari confidence).`;
    } else {
      filterText = '🟢 Tidak ada berita besar dalam waktu dekat.';
    }

    // Backward compat — map v4 to old analysis shape for scanner usage
    const analysisCompat = v4 ? {
      core_news:         v4.ai_verdict?.fundamental_summary || '',
      impact_gold:       v4.ai_verdict?.gold_impact || 'NETRAL',
      impact_usd:        v4.ai_verdict?.usd_impact  || 'NETRAL',
      volatility:        v4.ai_verdict?.volatility_impact === 'HIGH' ? 'HIGH' : 'MEDIUM',
      direction_support: action === 'BUY' ? 'BUY' : action === 'SELL' ? 'SELL' : 'NETRAL',
      confidence_impact: ci,
      estimated_duration: v4.ai_verdict?.duration_estimate || '2-4 jam',
      verdict:           blockEntry ? 'SKIP_TRADE' : action === 'WAIT' ? 'WAIT' : 'ENTRY',
      reason:            v4.ai_verdict?.reason || '',
    } : null;

    return {
      items,
      analysis:             analysisCompat,
      confidenceAdjustment: ci,
      blockEntry,
      filterText,
      v4,
    };
  } catch (err) {
    console.warn('[NEWS-V4] getNewsImpact error:', err.message);
    return null;
  }
}

// ─── FORMAT FOR /news COMMAND (v4 detailed) ───────────────────────────────────
function formatNewsMessageV4(newsResult) {
  const { items, v4 } = newsResult;
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📰 <b>AZZAVISION AI — NEWS INTELLIGENCE v4.0</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
  ];

  if (!items || items.length === 0) {
    lines.push(`📭 <i>Tidak ada berita relevan saat ini.</i>`);
    lines.push(``, `━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⚡ <i>AZZAVISION AI | News Intelligence v4.0</i>`);
    return lines.join('\n');
  }

  // ── News Items with weight ───────────────────────────────────────────────────
  if (v4?.items && v4.items.length > 0) {
    lines.push(`📋 <b>${items.length} Berita Relevan (XAUUSD/Gold):</b>`);
    lines.push(``);

    const aiItems = v4.items.slice(0, 8);
    aiItems.forEach(item => {
      const wEmoji = WEIGHT_EMOJI[item.weight] || '🟩';
      const cat    = CATEGORIES[item.category] || CATEGORIES.OTHER;
      const dirEmoji = item.direction === 'BULLISH_GOLD' ? '🟢' :
                       item.direction === 'BEARISH_GOLD' ? '🔴' : '🟡';
      lines.push(`${wEmoji} <b>${item.index}. ${item.title?.slice(0, 60) || '-'}</b>`);
      lines.push(`   ${cat.emoji} ${cat.label} | Weight: <b>${item.weight}/10</b> | ${dirEmoji} ${item.direction}`);
      if (item.key_fact) lines.push(`   <i>${item.key_fact}</i>`);
      lines.push(``);
    });
  } else {
    // Fallback — just list titles
    items.slice(0, 6).forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`);
      if (item.summary) lines.push(`   <i>${item.summary.slice(0, 100)}...</i>`);
    });
    lines.push(``);
  }

  // ── Market Score ─────────────────────────────────────────────────────────────
  if (v4?.market_score) {
    const ms = v4.market_score;
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📊 <b>TOTAL MARKET SCORE</b>`);
    lines.push(``);
    lines.push(`🟢 Bullish  : <b>${ms.bullish_pct || 0}%</b>`);
    lines.push(`🔴 Bearish  : <b>${ms.bearish_pct || 0}%</b>`);
    lines.push(`🟡 Neutral  : <b>${ms.neutral_pct || 0}%</b>`);
    lines.push(``);
  }

  // ── AI Verdict ───────────────────────────────────────────────────────────────
  if (v4?.ai_verdict) {
    const v = v4.ai_verdict;
    const actionEmoji = {
      BUY:       '✅ BUY',
      SELL:      '🔻 SELL',
      WAIT:      '⏳ WAIT',
      HIGH_RISK: '⚠️ HIGH RISK',
      NO_TRADE:  '🚫 NO TRADE',
    }[v.action] || v.action;

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🤖 <b>AI MARKET VERDICT</b>`);
    lines.push(``);
    lines.push(`🎯 <b>Action</b>         : ${actionEmoji}`);
    lines.push(``);

    if (v.fundamental_summary) {
      lines.push(`📌 <b>Fundamental:</b>`);
      lines.push(v.fundamental_summary);
      lines.push(``);
    }
    if (v.sentiment_summary) {
      lines.push(`💭 <b>Sentimen:</b>`);
      lines.push(v.sentiment_summary);
      lines.push(``);
    }

    const goldEmoji = v.gold_impact === 'BULLISH' ? '🟢' : v.gold_impact === 'BEARISH' ? '🔴' : '🟡';
    const usdEmoji  = v.usd_impact  === 'BULLISH' ? '🟢' : v.usd_impact  === 'BEARISH' ? '🔴' : '🟡';
    const volEmoji  = v.volatility_impact === 'HIGH' ? '🔴' : v.volatility_impact === 'MEDIUM' ? '🟡' : '🟢';

    lines.push(`${goldEmoji} <b>Dampak Gold</b>     : ${v.gold_impact || '-'}`);
    lines.push(`${usdEmoji} <b>Dampak USD</b>      : ${v.usd_impact  || '-'}`);
    lines.push(`${volEmoji} <b>Volatilitas</b>     : ${v.volatility_impact || '-'}`);
    lines.push(`⏱ <b>Estimasi Durasi</b>  : ${v.duration_estimate || '-'}`);
    lines.push(``);

    const ci     = v4.confidence_impact ?? 0;
    const ciSign = ci >= 0 ? '+' : '';
    lines.push(`📡 <b>Confidence Impact</b>: <code>${ciSign}${ci}%</code>`);
    lines.push(``);

    if (v.reason) {
      lines.push(`💬 <b>Alasan AI (berdasarkan artikel):</b>`);
      lines.push(v.reason);
    }
  } else {
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🤖 <i>Analisis AI tidak tersedia saat ini.</i>`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚡ <i>AZZAVISION AI | News Intelligence v4.0</i>`);

  return lines.join('\n');
}

// ─── FORMAT SHORT (for signal messages, backward compat) ─────────────────────
function formatNewsMessage(newsResult) {
  return formatNewsMessageV4(newsResult);
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
module.exports = {
  getNewsImpact,
  fetchNews:            fetchNewsV4,
  fetchNewsV4,
  analyzeNewsWithGemini: analyzeNewsV4,
  analyzeNewsV4,
  formatNewsMessageV4,
  formatNewsMessage,
  CATEGORIES,
  WEIGHT_EMOJI,
};
