const { toWIB } = require('./wib_time');
const { getProfile, formatMMLines } = require('../database/user_profiles');

function formatMarketStatus(analysis, overall, confidence) {
  const isWait = overall.label === 'NEUTRAL';

  const rows = [
    { tf: 'M1 ', bias: analysis.m1.bias },
    { tf: 'M5 ', bias: analysis.m5.bias },
    { tf: 'M15', bias: analysis.m15.bias },
    { tf: 'H1 ', bias: analysis.h1.bias },
    { tf: 'H4 ', bias: analysis.h4.bias },
  ];

  const tfLines = rows.map(r => {
    const dot = r.bias.includes('BUY') ? '🟢' : r.bias.includes('SELL') ? '🔴' : '🟡';
    return `${dot} <b>${r.tf}</b> : ${biasBadge(r.bias)}`;
  });

  const indicators = [
    `🟢 Trend`,
    `🟢 Momentum`,
    `${isWait ? '🟡' : '🟢'} Confirmation`,
    `🟢 Volume`,
    `🟢 Multi-Timeframe`,
    `🟢 AI Filter`,
  ];

  const statusLabel = isWait ? '🟡 WAITING CONFIRMATION' : overallBadge(overall.label);
  const wib = toWIB();

  return [
    `🟢 <b>AZZAVISION AI v5.0 • MARKET STATUS</b>`,
    ``,
    ...tfLines,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `📊 <b>Overall Status:</b> ${statusLabel}`,
    ``,
    `📡 <b>Confidence:</b> <code>${confidence}%</code>`,
    ``,
    `🛠 <b>System Check:</b>`,
    ...indicators,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `<i>⏱ ${wib.full}</i>`,
  ].join('\n');
}

function biasBadge(bias) {
  if (bias === 'STRONG_BUY')  return '🟢 Strong Buy 🔥';
  if (bias === 'BUY')         return '🟢 Bullish 📈';
  if (bias === 'STRONG_SELL') return '🔴 Strong Sell 📉';
  if (bias === 'SELL')        return '🔴 Bearish 🔻';
  return '🟡 Sideways ⏸️';
}

function overallBadge(label) {
  if (label === 'STRONG_BUY')  return '🟢 STRONG BUY 🔥';
  if (label === 'BUY')         return '🟢 BUY 📈';
  if (label === 'STRONG_SELL') return '🔴 STRONG SELL 📉';
  if (label === 'SELL')        return '🔴 SELL 🔻';
  return '🟡 NEUTRAL ⏸️';
}

// ─── FORMAT SIGNAL MESSAGE (dengan Setup Explanation + Ensemble + AI + WIB) ────
// newsResult (opsional): object dari news_engine.getNewsImpact()
function formatSignalMessage(signal, analysis, similarityResult, ensembleResult, geminiResult, newsResult) {
  const { direction, entry, tp1, tp2, sl, confidence } = signal;
  const dir    = direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';
  const m5Label = analysis.m5.bias.includes('BUY') || analysis.m5.bias.includes('SELL')
    ? '✅ Rejection Confirmed'
    : '⚠️ Weak';

  const riskPips   = Math.abs(entry - sl);
  const rewardTp1  = Math.abs(tp1 - entry);
  const rewardTp2  = Math.abs(tp2 - entry);
  const rrTp1      = (rewardTp1 / riskPips).toFixed(2);
  const rrTp2      = (rewardTp2 / riskPips).toFixed(2);
  const pipsTp1    = Math.round(rewardTp1 / 0.1);
  const pipsTp2    = Math.round(rewardTp2 / 0.1);
  const pipsSl     = Math.round(riskPips / 0.1);

  const wib = toWIB();

  const simLines = [];
  if (similarityResult?.active && similarityResult.bestMatch > 0) {
    const recEmoji = {
      'VALID':    '✅',
      'CAUTION':  '⚠️',
      'AVOID':    '🚫',
      'NEUTRAL':  '🟡',
      'NO_MATCH': '❓',
    }[similarityResult.recommendation] || '🟡';

    simLines.push('');
    simLines.push(`━━━━━━━━━━━━━━━━━━`);
    simLines.push(`🧠 <b>LEARNING INSIGHT</b>`);
    simLines.push(`🔍 Similarity  : <code>${similarityResult.avgSimilarity}%</code>`);
    simLines.push(`📈 Hist WR     : <code>${similarityResult.winRate}%</code> (${similarityResult.wins}W / ${similarityResult.losses}L / ${similarityResult.breakevens}BE)`);
    simLines.push(`${recEmoji} Rekomendasi  : <b>${similarityResult.recommendation}</b>`);
  }

  // Setup Explanation Block
  const setupLines = [];
  if (ensembleResult && ensembleResult.activeComponents && ensembleResult.activeComponents.length > 0) {
    const techniques = ensembleResult.activeComponents.map(c => `• ${c.name}${c.reason ? ` — ${c.reason}` : ''}`);

    const parts = [];
    const has_sd  = ensembleResult.activeComponents.find(c => c.name === 'Supply & Demand');
    const has_eng = ensembleResult.activeComponents.find(c => c.name === 'Engulfing');
    const has_tl  = ensembleResult.activeComponents.find(c => c.name === 'Trendline');
    const has_div = ensembleResult.activeComponents.find(c => c.name === 'Divergence');
    const has_fib = ensembleResult.activeComponents.find(c => c.name === 'Fibonacci');

    if (has_sd)  parts.push(direction === 'BUY' ? 'Harga memantul dari demand zone' : 'Harga menyentuh supply zone');
    if (has_eng) parts.push(direction === 'BUY' ? 'muncul bullish engulfing' : 'muncul bearish engulfing');
    if (has_tl)  parts.push('tren trendline masih solid');
    if (has_div) parts.push('RSI divergence terkonfirmasi');
    if (has_fib) parts.push('harga di level Fibonacci kunci');

    const narrative = parts.length > 0 ? parts.join(', ') + '.' : '';

    setupLines.push('');
    setupLines.push(`━━━━━━━━━━━━━━━━━━`);
    setupLines.push(`📚 <b>SETUP TERDETEKSI</b>`);
    setupLines.push(``);
    setupLines.push(`<b>Strategy:</b>`);
    techniques.forEach(t => setupLines.push(t));
    if (narrative) {
      setupLines.push(``);
      setupLines.push(`<b>Alasan:</b>`);
      setupLines.push(narrative);
    }
  }

  // Setup Ranking Block
  const rankingLines = [];
  if (ensembleResult && ensembleResult.ranking && ensembleResult.ranking.length > 0) {
    const rankEmoji = ['🥇','🥈','🥉'];
    rankingLines.push('');
    rankingLines.push(`━━━━━━━━━━━━━━━━━━`);
    rankingLines.push(`🏆 <b>SETUP RANKING</b>`);
    ensembleResult.ranking.slice(0, 3).forEach((r, i) => {
      rankingLines.push(`${rankEmoji[i] || '•'} <b>${r.name}</b>`);
      rankingLines.push(`   Confidence: <code>${r.confidence}%</code>`);
    });
    rankingLines.push(``);
    rankingLines.push(`📊 Ensemble Score: <code>${ensembleResult.totalScore}/100</code>`);
  }

  // ── AI Validation Block (dari Gemini — opsional) ────────────────────────────
  const aiLines = [];
  if (geminiResult && geminiResult.verdict) {
    const verdictLabel = geminiResult.verdict === 'APPROVE' ? '✅ APPROVED' : '❌ REJECTED';
    const scoreBar = (() => {
      const pct    = Math.max(0, Math.min(100, geminiResult.score || 0));
      const filled = Math.round(pct / 100 * 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
    })();

    aiLines.push('');
    aiLines.push(`━━━━━━━━━━━━━━━━━━`);
    aiLines.push(`🤖 <b>AI VALIDATION</b>`);
    aiLines.push(``);
    aiLines.push(`📌 <b>Verdict</b>  : ${verdictLabel}`);
    aiLines.push(`🧠 <b>AI Score</b> : <code>${scoreBar}</code>`);

    if (geminiResult.reasons && geminiResult.reasons.length > 0) {
      aiLines.push(``);
      aiLines.push(`💬 <b>AI Reason:</b>`);
      geminiResult.reasons.forEach(r => aiLines.push(`• ${r}`));
    }

    if (geminiResult.advice && geminiResult.advice.length > 0) {
      aiLines.push(``);
      aiLines.push(`💡 <b>AI Advice:</b>`);
      geminiResult.advice.forEach(a => aiLines.push(`• ${a}`));
    }

    if (geminiResult.tp_sl) {
      const ts = geminiResult.tp_sl;
      const tpSlParts = [];
      if (ts.sl_comment)           tpSlParts.push(`SL: ${ts.sl_comment}`);
      if (ts.tp1_comment)          tpSlParts.push(`TP1: ${ts.tp1_comment}`);
      if (ts.tp2_comment)          tpSlParts.push(`TP2: ${ts.tp2_comment}`);
      if (ts.trailing_suggestion)  tpSlParts.push(ts.trailing_suggestion);

      if (tpSlParts.length > 0) {
        aiLines.push(``);
        aiLines.push(`📐 <b>AI Suggestion:</b>`);
        tpSlParts.forEach(p => aiLines.push(`• ${p}`));
      }
    }
  }

  // ── News Filter Block (dari news_engine — opsional) ─────────────────────────
  const newsLines = [];
  if (newsResult) {
    const techConf  = confidence - (newsResult.confidenceAdjustment || 0);
    const adj       = newsResult.confidenceAdjustment || 0;
    const adjSign   = adj >= 0 ? `+${adj}` : String(adj);

    newsLines.push('');
    newsLines.push(`━━━━━━━━━━━━━━━━━━`);
    newsLines.push(`📰 <b>NEWS FILTER</b>`);
    newsLines.push(``);
    newsLines.push(newsResult.filterText || '🟢 Tidak ada berita besar.');

    if (adj !== 0) {
      newsLines.push(``);
      newsLines.push(`📊 Technical : <code>${techConf}%</code>`);
      newsLines.push(`📰 News Impact: <code>${adjSign}%</code>`);
      newsLines.push(`📡 Final Conf : <code>${confidence}%</code>`);
    }
  }

  // ── Money Management Block v2.0 (Broker-Aware) ────────────────────────────
  const mmLines = [];
  try {
    const ownerId = process.env.OWNER_ID;
    if (ownerId) {
      const ownerProfile = getProfile(ownerId);
      if (ownerProfile.lot_mode !== 'manual') {
        const mmBlock = formatMMLines(ownerProfile, pipsSl, pipsTp1, pipsTp2);
        mmLines.push(...mmBlock);
      }
    }
  } catch { /* skip jika error */ }

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `🚨 <b>AZZAVISION AI SIGNAL</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    wib.line,
    ``,
    `🪙 <b>Pair</b>    : <code>XAUUSD</code>`,
    ``,
    `${dir}`,
    `<b>Direction : ${direction}</b>`,
    ``,
    `🎯 <b>Entry</b>   : <code>${entry.toFixed(2)}</code>`,
    ``,
    `💰 <b>TP1</b>     : <code>${tp1.toFixed(2)}</code>  (+${pipsTp1} pips | R:R 1:${rrTp1})`,
    `💰 <b>TP2</b>     : <code>${tp2.toFixed(2)}</code>  (+${pipsTp2} pips | R:R 1:${rrTp2})`,
    ``,
    `🛑 <b>SL</b>      : <code>${sl.toFixed(2)}</code>  (${pipsSl} pips)`,
    `🔒 <b>BE Trigger</b>: +28 pips dari entry`,
    ``,
    `📡 <b>Confidence</b> : <code>${confidence}%</code>`,
    ``,
    `📈 <b>Trend :</b>`,
    `  H4  ${analysis.h4.bias.includes('BUY') ? '✅' : analysis.h4.bias.includes('SELL') ? '❌' : '⚠️'} ${biasBadge(analysis.h4.bias)}`,
    `  H1  ${analysis.h1.bias.includes('BUY') ? '✅' : analysis.h1.bias.includes('SELL') ? '❌' : '⚠️'} ${biasBadge(analysis.h1.bias)}`,
    `  M15 ${analysis.m15.bias.includes('BUY') ? '✅' : analysis.m15.bias.includes('SELL') ? '❌' : '⚠️'} ${biasBadge(analysis.m15.bias)}`,
    `  M5  ✅ ${m5Label}`,
    ...simLines,
    ...setupLines,
    ...rankingLines,
    ...aiLines,
    ...newsLines,
    ...mmLines,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `⚡ <i>Powered by AZZAVISION AI Strategy v3.0</i>`,
    `⚠️ <i>Manage risk. Max 1-2% per trade.</i>`,
  ].join('\n');
}

function formatStats(stats) {
  const be = (stats.breakevens || 0) + (stats.tp1breakevens || 0);
  const tp1be = stats.tp1breakevens || 0;
  const wib = toWIB();
  return [
    `📈 <b>AZZAVISION AI PERFORMANCE</b>`,
    ``,
    `✅ <b>Total Trades</b>  : <code>${stats.total}</code>`,
    ``,
    `🏆 <b>Win</b>           : <code>${stats.wins}</code>`,
    `❌ <b>Loss</b>          : <code>${stats.losses}</code>`,
    `🔒 <b>Breakeven</b>    : <code>${be}</code>` + (tp1be > 0 ? ` (${tp1be} TP1+BE)` : ''),
    ``,
    `🎯 <b>Win Rate</b>     : <code>${stats.winRate}%</code>`,
    `ℹ️ <i>(WIN / (WIN+LOSS), BE dikecualikan)</i>`,
    ``,
    `💹 <b>Net Pips</b>     : <code>${parseFloat(stats.netPips) >= 0 ? '+' : ''}${stats.netPips}</code>`,
    ``,
    `🔥 <b>Profit Factor</b> : <code>${stats.profitFactor}</code>`,
    ``,
    `📐 <b>R:R Ratio</b>    : <code>SL:40 | TP1:60 (1:1.5) | TP2:125 (1:3.125)</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `<i>🕐 ${wib.short}</i>`,
    `<i>⚡ AZZAVISION AI | Real Performance Tracker</i>`,
  ].join('\n');
}

// ─── FORMAT AUTO-JOURNAL (setelah trade selesai) ───────────────────────────────
function formatTradeJournal(signal, status, price, strategies) {
  const wib       = toWIB();
  const isWin     = status === 'WIN';
  const isBE      = status === 'BREAKEVEN' || status === 'TP1_BREAKEVEN';
  const isLoss    = status === 'LOSS';
  const emoji     = isWin ? '✅' : isBE ? '🔒' : '❌';
  const outcome   = isWin ? 'WIN' : isBE ? 'BREAKEVEN' : 'LOSS';
  const pips      = signal.pips || 0;

  const stratLines = (strategies && strategies.length > 0)
    ? strategies.map(s => `• ${s}`).join('\n')
    : '• Multi-Strategy Analysis';

  let catatanLine = '';
  if (isWin && pips >= 100) {
    catatanLine = `Momentum kuat, TP2 tercapai tanpa retracement besar.`;
  } else if (isWin) {
    catatanLine = `Momentum searah tren, target tercapai.`;
  } else if (isBE) {
    catatanLine = `TP1 sempat tercapai, modal terlindungi via breakeven.`;
  } else {
    catatanLine = `Momentum tidak berlanjut, harga menyentuh SL.`;
  }

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `📝 <b>AZZAVISION AI — JURNAL AI OTOMATIS</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🎯 <b>Trade #${signal.id}</b>`,
    ``,
    `${emoji} <b>Hasil</b>  : ${outcome}${pips !== 0 ? ` (${pips >= 0 ? '+' : ''}${pips} pips)` : ''}`,
    ``,
    `🪙 Pair      : <code>XAUUSD</code>`,
    `📌 Direction  : ${signal.direction}`,
    `📌 Entry      : <code>${signal.entry}</code>`,
    `💹 Close      : <code>${price.toFixed(2)}</code>`,
    ``,
    `📚 <b>Teknik yang digunakan:</b>`,
    stratLines,
    ``,
    `📋 <b>Catatan AI:</b>`,
    catatanLine,
    ``,
    wib.line,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 <i>Jurnal otomatis dari AZZAVISION AI</i>`,
    `⚡ <i>AZZAVISION AI v3.0</i>`,
  ].join('\n');
}

// ─── FORMAT MULTI-STRATEGY SCANNER STATUS ─────────────────────────────────────
function formatScannerStatus(strategies, direction, confidence) {
  const waiting   = strategies.filter(s => s.confidence < 65).sort((a, b) => b.confidence - a.confidence);
  const valid     = strategies.filter(s => s.confidence >= 65);
  const wib       = toWIB();

  const lines = [
    `━━━━━━━━━━━━━━━━━━`,
    `🔍 <b>AZZAVISION AI — MULTI-STRATEGY SCANNER</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    wib.line,
    ``,
  ];

  if (valid.length > 0) {
    lines.push(`✅ <b>STRATEGI VALID (${valid.length})</b>`);
    valid.slice(0, 5).forEach(s => {
      lines.push(`• ${s.strategyName}: <code>${s.confidence}%</code>`);
    });
    lines.push(``);
  }

  if (waiting.length > 0) {
    lines.push(`⏳ <b>MENDEKATI VALID:</b>`);
    waiting.slice(0, 5).forEach(s => {
      lines.push(`• ${s.strategyName}: <code>${s.confidence}%</code>`);
    });
    lines.push(``);
    lines.push(`Belum ada entry valid.`);
  } else if (valid.length === 0) {
    lines.push(`💤 Tidak ada strategi aktif saat ini.`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚡ <i>AZZAVISION AI v5.0 | Multi-Strategy Scanner</i>`);

  return lines.join('\n');
}

module.exports = {
  formatSignalMessage,
  formatMarketStatus,
  formatStats,
  formatTradeJournal,
  formatScannerStatus,
  biasBadge,
  overallBadge,
};
