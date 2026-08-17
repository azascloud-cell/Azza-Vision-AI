/**
 * ai.js — /ai command
 * Menampilkan evaluasi AI terhadap kondisi market saat ini.
 * Mendukung /ai (ringkasan pasar) dan /ai <pertanyaan> (edukasi).
 *
 * Fail-safe: jika AI tidak tersedia / error, tampilkan analisis
 * teknikal internal AZZAVISION AI tanpa crash.
 *
 * v3.2: Semua AI melalui ai_engine (Groq → OpenRouter → Gemini).
 *       Konteks berita dari News Intelligence Engine disertakan.
 */

const { getAllTimeframes }  = require('../../market/data');
const { runStrategy }       = require('../../analysis/strategy');
const { getOverallBias }    = require('../../analysis/scanner');
const { toWIB }             = require('../../utils/wib_time');
const { renderBanner }      = require('../../banner');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function verdictLine(verdict) {
  const map = {
    'APPROVE':           '✅ APPROVE',
    'REJECT':            '❌ REJECT',
    'BULLISH_BIAS':      '🟢 BULLISH BIAS',
    'BEARISH_BIAS':      '🔴 BEARISH BIAS',
    'NEUTRAL':           '🟡 NEUTRAL',
    'WAIT_CONFIRMATION': '⏳ WAIT CONFIRMATION',
  };
  return map[verdict] || escapeHtml(verdict);
}

function biasBadge(bias) {
  if (!bias) return '—';
  if (bias.includes('STRONG_BUY'))  return '🟢 Strong Buy 🔥';
  if (bias.includes('BUY'))         return '🟢 Bullish 📈';
  if (bias.includes('STRONG_SELL')) return '🔴 Strong Sell 📉';
  if (bias.includes('SELL'))        return '🔴 Bearish 🔻';
  return '🟡 Sideways ⏸';
}

// ─── FALLBACK: tampilkan analisis teknikal internal ───────────────────────────
function buildFallbackMessage(result, overall, wib, newsResult) {
  const aligned = result.aligned;
  const conf = result.confidence || 0;
  const minConf = parseInt(process.env.MIN_CONFIDENCE || '65');

  const status = !aligned
    ? '⏳ Trend belum selaras — menunggu konfirmasi'
    : result.spikeRisk
      ? '⚠️ Volatilitas tinggi — hindari entry'
      : !result.m5Entry?.valid
        ? '👀 Trend aligned — menunggu rejection M5'
        : conf < minConf
          ? `📡 Setup mendekati valid — confidence ${conf}%`
          : '🎯 Semua kondisi terpenuhi — siap entry';

  const lines = [
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 <b>AZZAVISION AI — MARKET INSIGHT</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    wib.line,
    ``,
    `⚠️ <i>AI tidak tersedia saat ini — menampilkan analisis teknikal internal.</i>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `📊 <b>KONDISI MARKET</b>`,
    ``,
    `📡 Overall : <code>${escapeHtml(overall.label)}</code>`,
    `🔄 Trend   : ${biasBadge(result.analysis.h4.bias)} (H4) | ${biasBadge(result.analysis.h1.bias)} (H1)`,
    `📐 Aligned : ${aligned ? '✅ YA' : '❌ BELUM'}`,
    `⚡ Conf    : <code>${conf}%</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🔄 <b>STATUS</b>: ${status}`,
  ];

  // Tambah news summary jika ada
  if (newsResult && newsResult.analysis) {
    const na = newsResult.analysis;
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━`);
    lines.push(`📰 <b>NEWS SUMMARY</b>`);
    if (na.core_news) lines.push(na.core_news);
    const vEmoji = na.verdict === 'SKIP_TRADE' ? '🚫' : na.verdict === 'WAIT' ? '⏳' : '✅';
    lines.push(`${vEmoji} AI Verdict: <b>${na.verdict || 'ENTRY'}</b>`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`💡 <i>Tambahkan AI key via /apikey add untuk mengaktifkan AI Advisor.</i>`);
  lines.push(`⚡ <i>AZZAVISION AI v3.2 | Market Insight</i>`);

  return lines.join('\n');
}

function registerAi(bot) {
  bot.command('ai', async (ctx) => {
    const userText = (ctx.message?.text || '').replace(/^\/ai\s*/i, '').trim();
    const isQuestion = userText.length > 5;

    const loading = await ctx.replyWithHTML(
      isQuestion
        ? `🤖 <i>AI sedang memikirkan jawaban...</i>`
        : `🤖 <i>Menganalisis kondisi market dengan AI Engine...</i>`
    );

    try {
      // Ambil data market dan berita secara paralel
      const [tfDataResult, newsResult] = await Promise.allSettled([
        getAllTimeframes(),
        (async () => {
          try {
            const { getNewsImpact } = require('../../analysis/news_engine');
            return await getNewsImpact();
          } catch { return null; }
        })(),
      ]);

      const tfData = tfDataResult.status === 'fulfilled' ? tfDataResult.value : null;
      const news   = newsResult.status === 'fulfilled' ? newsResult.value : null;

      if (!tfData) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
        return ctx.replyWithHTML(`❌ Gagal ambil data market.`);
      }

      const result  = runStrategy(tfData);
      const overall = getOverallBias(result.analysis);
      const wib     = toWIB();

      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});

      // ── Mode: jawab pertanyaan spesifik ─────────────────────────────────────
      if (isQuestion) {
        try {
          const { answerQuestion } = require('../../analysis/gemini');

          // Bangun konteks market + berita
          const ctxLines = [
            `Overall Bias: ${overall.label}`,
            `H4: ${result.analysis.h4.bias} | H1: ${result.analysis.h1.bias}`,
            `M15: ${result.analysis.m15.bias} | M5: ${result.analysis.m5.bias}`,
            `Confidence: ${result.confidence}% | Aligned: ${result.aligned ? 'YA' : 'BELUM'}`,
          ];

          if (news && news.analysis) {
            const na = news.analysis;
            ctxLines.push(`--- NEWS CONTEXT ---`);
            if (na.core_news)   ctxLines.push(`Berita: ${na.core_news}`);
            if (na.impact_gold) ctxLines.push(`Impact Gold: ${na.impact_gold}`);
            if (na.impact_usd)  ctxLines.push(`Impact USD: ${na.impact_usd}`);
            if (na.volatility)  ctxLines.push(`Volatility: ${na.volatility}`);
            if (na.verdict)     ctxLines.push(`News Verdict: ${na.verdict}`);
            if (na.reason)      ctxLines.push(`News Reason: ${na.reason}`);
          } else if (news && news.items && news.items.length > 0) {
            ctxLines.push(`--- NEWS CONTEXT ---`);
            ctxLines.push(`Berita terkini (${news.items.length} item): ${news.items.slice(0,2).map(i => i.title).join('; ')}`);
          }

          const answer = await answerQuestion(userText, ctxLines.join('\n'));

          if (answer) {
            const msg = [
              `━━━━━━━━━━━━━━━━━━`,
              `🤖 <b>AI ADVISOR — JAWABAN</b>`,
              `━━━━━━━━━━━━━━━━━━`,
              ``,
              `❓ <b>Pertanyaan:</b>`,
              escapeHtml(userText),
              ``,
              `━━━━━━━━━━━━━━━━━━`,
              `💬 <b>Jawaban:</b>`,
              ``,
              answer,
            ];

            if (news && news.analysis && news.analysis.verdict && news.analysis.verdict !== 'ENTRY') {
              const na = news.analysis;
              const vEmoji = na.verdict === 'SKIP_TRADE' ? '🚫' : '⏳';
              msg.push(``);
              msg.push(`━━━━━━━━━━━━━━━━━━`);
              msg.push(`📰 <b>Konteks Berita:</b>`);
              if (na.core_news) msg.push(escapeHtml(na.core_news));
              msg.push(`${vEmoji} News Verdict: <b>${na.verdict}</b>`);
            }

            msg.push(``);
            msg.push(`━━━━━━━━━━━━━━━━━━`);
            msg.push(`💡 <i>Ketik /news untuk detail berita terkini.</i>`);
            msg.push(`⚡ <i>AZZAVISION AI v3.2 | Multi AI Engine</i>`);

            return ctx.replyWithHTML(msg.join('\n'));
          }
        } catch (qErr) {
          console.warn('[AI CMD] answerQuestion error:', qErr.message);
        }

        return ctx.replyWithHTML([
          `🤖 <b>AI ADVISOR</b>`,
          ``,
          `⚠️ AI tidak dapat menjawab saat ini. Tambah API key via /apikey add atau coba lagi.`,
          ``,
          `❓ <i>${escapeHtml(userText)}</i>`,
        ].join('\n'));
      }

      // ── Mode: ringkasan market ───────────────────────────────────────────────
      let insight = null;
      try {
        const { getMarketInsight } = require('../../analysis/gemini');
        insight = await getMarketInsight(result, overall);
      } catch (insightErr) {
        console.warn('[AI CMD] getMarketInsight error (fail-safe):', insightErr.message);
      }

      if (!insight) {
        return ctx.replyWithHTML(buildFallbackMessage(result, overall, wib, news));
      }

      // ── Build full AI insight message ────────────────────────────────────────
      const scoreBar = (() => {
        const pct    = Math.max(0, Math.min(100, insight.score));
        const filled = Math.round(pct / 100 * 10);
        return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
      })();

      const reasonLines = (insight.reasons || []).map(r => `• ${escapeHtml(r)}`);
      const adviceLines = (insight.advice  || []).map(a => `• ${escapeHtml(a)}`);

      const lines = [
        `━━━━━━━━━━━━━━━━━━`,
        `🤖 <b>AZZAVISION AI — AI MARKET REVIEW</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        wib.line,
        ``,
        `🪙 <b>Pair</b>   : XAUUSD`,
        `📊 <b>Bias</b>   : <code>${escapeHtml(overall.label)}</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `🤖 <b>AI Review</b>`,
        ``,
        `📌 <b>Verdict</b>: ${verdictLine(insight.verdict)}`,
        `🧠 <b>AI Score</b>: <code>${scoreBar}</code>`,
        ``,
      ];

      if (insight.summary) {
        lines.push(`💬 <b>Ringkasan:</b>`);
        lines.push(escapeHtml(insight.summary));
        lines.push(``);
      }

      if (reasonLines.length > 0) {
        lines.push(`━━━━━━━━━━━━━━━━━━`);
        lines.push(`📋 <b>Reason:</b>`);
        reasonLines.forEach(r => lines.push(r));
        lines.push(``);
      }

      if (adviceLines.length > 0) {
        lines.push(`━━━━━━━━━━━━━━━━━━`);
        lines.push(`💡 <b>Advice:</b>`);
        adviceLines.forEach(a => lines.push(a));
        lines.push(``);
      }

      if (insight.next_catalyst) {
        lines.push(`━━━━━━━━━━━━━━━━━━`);
        lines.push(`🎯 <b>Catalyst Berikutnya:</b>`);
        lines.push(escapeHtml(insight.next_catalyst));
        lines.push(``);
      }

      lines.push(`━━━━━━━━━━━━━━━━━━`);
      lines.push(`📊 <b>Kondisi Teknikal:</b>`);
      lines.push(`H4 : ${biasBadge(result.analysis.h4.bias)}`);
      lines.push(`H1 : ${biasBadge(result.analysis.h1.bias)}`);
      lines.push(`M15: ${biasBadge(result.analysis.m15.bias)}`);
      lines.push(`M5 : ${biasBadge(result.analysis.m5.bias)}`);
      lines.push(`📡 Confidence : <code>${result.confidence}%</code>`);
      lines.push(`📐 Aligned    : ${result.aligned ? '✅ YA' : '❌ BELUM'}`);
      lines.push(``);

      if (news) {
        lines.push(`━━━━━━━━━━━━━━━━━━`);
        lines.push(`📰 <b>NEWS INTELLIGENCE</b>`);
        lines.push(``);
        if (news.analysis) {
          const na = news.analysis;
          const goldEmoji = na.impact_gold === 'BULLISH' ? '🟢' : na.impact_gold === 'BEARISH' ? '🔴' : '🟡';
          const usdEmoji  = na.impact_usd  === 'BULLISH' ? '🟢' : na.impact_usd  === 'BEARISH' ? '🔴' : '🟡';
          const vEmoji    = na.verdict === 'ENTRY' ? '✅' : na.verdict === 'SKIP_TRADE' ? '🚫' : '⏳';
          if (na.core_news) lines.push(escapeHtml(na.core_news));
          lines.push(``);
          lines.push(`${goldEmoji} Gold Impact   : ${na.impact_gold || '-'}`);
          lines.push(`${usdEmoji} USD Impact    : ${na.impact_usd || '-'}`);
          if (na.confidence_impact != null && na.confidence_impact !== 0) {
            const adj = na.confidence_impact;
            lines.push(`📡 Conf Impact : <code>${adj >= 0 ? '+' : ''}${adj}%</code>`);
          }
          lines.push(`${vEmoji} Verdict       : <b>${na.verdict || 'ENTRY'}</b>`);
          if (na.reason) lines.push(`💬 ${escapeHtml(na.reason)}`);
        } else if (news.items && news.items.length > 0) {
          lines.push(`📋 ${news.items.length} berita relevan terdeteksi.`);
          lines.push(news.filterText || '');
        } else {
          lines.push(`🟢 Tidak ada berita besar terdeteksi.`);
        }
        lines.push(``);
      }

      lines.push(`━━━━━━━━━━━━━━━━━━`);
      lines.push(`💡 <i>Ketik /ai &lt;pertanyaan&gt; untuk tanya AI tentang trading.</i>`);
      lines.push(`💡 <i>Ketik /news untuk detail berita terkini.</i>`);
      lines.push(`⚡ <i>AZZAVISION AI v3.2 | Multi AI Engine</i>`);

      try {
        const buffer = await renderBanner('ai_analysis', {
          headline: overall.label,
          rows: [
            { label: 'H4 Bias', value: result.analysis.h4.bias },
            { label: 'H1 Bias', value: result.analysis.h1.bias },
            { label: 'M15 Bias', value: result.analysis.m15.bias },
            { label: 'Confidence', value: `${result.confidence}%` },
            { label: 'Aligned', value: result.aligned ? 'YA' : 'BELUM' },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[AI-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(lines.join('\n'));
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ Gagal analisis.\n<code>${escapeHtml(err.message)}</code>`);
    }
  });
}

module.exports = { registerAi };
