/**
 * stratstats_cmd.js — /stratstats command
 * Tampilkan performa per strategi
 */

const { formatStrategyStatsMessage, getAllStrategyStats } = require('../../database/strategy_stats');
const { renderBanner } = require('../../banner');

function registerStratStats(bot) {
  bot.command('stratstats', async (ctx) => {
    try {
      const msg = await formatStrategyStatsMessage();

      try {
        const all = (await getAllStrategyStats()).slice(0, 6);
        const rows = all.length > 0
          ? all.map((s) => ({ label: s.name, value: `${s.winRate}% (${s.wins}W/${s.losses}L)` }))
          : [{ label: 'Belum ada data', value: '-' }];
        const buffer = await renderBanner('strategy_stats', { rows });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[STRATSTATS-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(msg);
    } catch (err) {
      await ctx.replyWithHTML(`❌ Gagal ambil statistik strategi.\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerStratStats };
