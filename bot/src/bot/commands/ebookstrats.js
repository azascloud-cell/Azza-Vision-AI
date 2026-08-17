/**
 * ebookstrats.js — Command /ebookstrats
 * Tampilkan semua strategi e-book yang tersedia di Strategy Library
 * dan jalankan analisis real-time untuk lihat strategi mana yang aktif saat ini
 */
const { ALL_STRATEGIES, runAllStrategies } = require('../../analysis/strategy_library');
const { getAllTimeframes }  = require('../../market/data');

function registerEbookStrats(bot) {
  bot.command('ebookstrats', async (ctx) => {
    const loading = await ctx.replyWithHTML(
      `⏳ <b>Menganalisis market dengan E-Book Strategy Library...</b>`
    );

    try {
      // Ambil data market
      const tfData = await getAllTimeframes();
      const signals = runAllStrategies(tfData);

      const activeSignals = signals.filter(s => s.confidence >= 60);
      const minConf       = parseInt(process.env.MIN_CONFIDENCE || '65');

      // Build strategy catalog lines
      const catalogLines = ALL_STRATEGIES.map((s, i) => {
        const hit = signals.find(sig => sig.key === s.name);
        const emoji = !hit ? '⚪' : hit.confidence >= minConf ? '🟢' : '🟡';
        const confStr = hit ? ` — ${hit.direction} ${hit.confidence}%` : '';
        return `${emoji} ${String(i+1).padStart(2,'0')}. ${s.fn.name.replace('strategy','')}${confStr}`;
      });

      // Active signals detail
      const activeLines = activeSignals.length > 0
        ? activeSignals
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5)
            .map(s => [
              ``,
              `📚 <b>${s.strategyName}</b>`,
              `   📖 Ref: <i>${s.ebookRef}</i>`,
              `   ${s.direction === 'BUY' ? '🟢' : '🔴'} ${s.direction} | Confidence: <code>${s.confidence}%</code>`,
              `   📝 ${s.reason.slice(0, 120)}${s.reason.length > 120 ? '...' : ''}`,
              `   ✅ ${s.confirmations.slice(0, 3).join(' | ')}`,
            ].join('\n'))
            .join('\n')
        : '\n⚪ <i>Tidak ada strategi aktif saat ini.</i>';

      const triggerCount = signals.filter(s => s.confidence >= minConf).length;

      const msg = [
        `━━━━━━━━━━━━━━━━━━━━`,
        `📚 <b>AZZAVISION AI — E-BOOK STRATEGY LIBRARY</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<b>📊 Library (${ALL_STRATEGIES.length} strategi):</b>`,
        `<code>${catalogLines.join('\n')}</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🎯 <b>Sinyal Aktif Saat Ini</b> (min ${minConf}%):`,
        `   ${triggerCount > 0 ? triggerCount + ' strategi trigger' : 'Tidak ada trigger'}`,
        activeLines,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `🟢 = Confidence ≥ ${minConf}% (siap sinyal)`,
        `🟡 = Confidence ≥ 60% (lemah)`,
        `⚪ = Tidak ada setup`,
        ``,
        `⚡ <i>AZZAVISION AI v2.5.0 | E-Book Strategy Engine</i>`,
      ].join('\n');

      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(msg);
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ Gagal analisis strategi e-book.\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerEbookStrats };
