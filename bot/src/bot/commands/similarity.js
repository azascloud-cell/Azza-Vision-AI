const { getAllTimeframes } = require('../../market/data');
const { runStrategy } = require('../../analysis/strategy');
const { runSimilarity, getTradingSession } = require('../../analysis/learning');

function registerSimilarity(bot) {
  bot.command('similarity', async (ctx) => {
    let loadingMsg;
    try {
      loadingMsg = await ctx.replyWithHTML(`⏳ <b>Menganalisis similarity...</b>`);
    } catch { /* ignore */ }

    try {
      // Ambil kondisi market saat ini
      let tfData   = null;
      let analysis = null;
      let direction = 'BUY';

      try {
        tfData = await getAllTimeframes();
        const res = runStrategy(tfData);
        analysis  = res.analysis;
        direction = res.direction;
      } catch { /* fallback */ }

      const currentCondition = {
        direction,
        h4_trend:         analysis?.h4?.bias  || 'NEUTRAL',
        h1_trend:         analysis?.h1?.bias  || 'NEUTRAL',
        m15_trend:        analysis?.m15?.bias || 'NEUTRAL',
        m5_trend:         analysis?.m5?.bias  || 'NEUTRAL',
        m1_trend:         analysis?.m1?.bias  || 'NEUTRAL',
        h4_rsi:           analysis?.h4?.rsi   || null,
        m5_rsi:           analysis?.m5?.rsi   || null,
        market_structure: (analysis?.h4?.factors || []).find(f => f.includes('BOS') || f.includes('CHOCH')) || 'NONE',
        has_rejection:    analysis?.m5?.bias !== 'NEUTRAL',
        session:          getTradingSession(),
      };

      const sim = await runSimilarity(currentCondition);

      if (loadingMsg) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
      }

      if (!sim.active) {
        await ctx.replyWithHTML([
          `━━━━━━━━━━━━━━━━━━━━`,
          `🔍 <b>AZZAVISION AI — SIMILARITY</b>`,
          `━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `🔴 <b>Learning Mode: Not enough data</b>`,
          ``,
          `📚 Dataset  : <code>${sim.count}</code> trades`,
          `⏳ Butuh    : <code>${sim.needed}</code> trades lagi`,
          ``,
          `<i>Gunakan /forcebuy atau /forcesell untuk membangun dataset lebih cepat.</i>`,
          `━━━━━━━━━━━━━━━━━━━━`,
        ].join('\n'));
        return;
      }

      const dirEmoji = direction === 'BUY' ? '🟢' : '🔴';
      const recEmoji = {
        'VALID':   '✅',
        'CAUTION': '⚠️',
        'AVOID':   '🚫',
        'NEUTRAL': '🟡',
        'NO_MATCH': '❓',
      }[sim.recommendation] || '🟡';

      const topMatchLines = sim.topMatches?.length > 0
        ? sim.topMatches.map((m, i) => {
            const resEmoji = m.result === 'WIN' ? '✅' : m.result === 'BREAKEVEN' ? '🔒' : '❌';
            return `  ${i+1}. <code>${m.similarity}%</code> | ${m.direction} | ${resEmoji} ${m.result} | ${m.pips >= 0 ? '+' : ''}${m.pips} pips | ${m.date}`;
          }).join('\n')
        : '  Tidak ada match signifikan';

      const msg = [
        `━━━━━━━━━━━━━━━━━━━━`,
        `🔍 <b>AZZAVISION AI — SIMILARITY</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${dirEmoji} <b>Current Setup</b> : ${direction}`,
        `🕐 <b>Session</b>       : ${currentCondition.session}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🏆 <b>Best Match</b>    : <code>${sim.bestMatch}%</code>`,
        `📊 <b>Avg Similarity</b>: <code>${sim.avgSimilarity}%</code>`,
        ``,
        `✅ WIN   : <code>${sim.wins}</code>`,
        `❌ LOSS  : <code>${sim.losses}</code>`,
        `🔒 BE    : <code>${sim.breakevens}</code>`,
        ``,
        `🎯 <b>Historical WR</b>  : <code>${sim.winRate}%</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<b>Top Matches:</b>`,
        topMatchLines,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `${recEmoji} <b>Recommendation</b> : <b>${sim.recommendation}</b>`,
        sim.confidenceAdjust !== 0
          ? `📈 <b>Conf Adjust</b>    : <code>${sim.confidenceAdjust > 0 ? '+' : ''}${sim.confidenceAdjust}%</code>`
          : '',
        ``,
        `📚 Dataset: <code>${sim.count}</code> trades${sim.fullAdaptive ? ' (Full Adaptive)' : ''}`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `⚡ <i>AZZAVISION AI | Similarity Engine</i>`,
      ].filter(l => l !== null && l !== undefined).join('\n');

      await ctx.replyWithHTML(msg);
    } catch (err) {
      if (loadingMsg) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
      }
      console.error('[SIMILARITY] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Gagal cek similarity.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerSimilarity };
