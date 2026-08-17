const { getStats, getOpenSignals } = require('../../database/db');
const { formatStats } = require('../../utils/format');

function registerStats(bot) {
  bot.command('stats', async (ctx) => {
    try {
      const [stats, openSignals] = await Promise.all([getStats(), getOpenSignals()]);
      let message = formatStats(stats);
      // Tambahkan info open signals
      message += `\n\n📌 <b>Open Signals</b> : <code>${openSignals.length}</code>`;
      await ctx.replyWithHTML(message);
    } catch (err) {
      console.error('[STATS] Error:', err);
      await ctx.replyWithHTML(
        `❌ <b>Gagal mengambil statistik.</b>\n<code>${err.message}</code>`
      );
    }
  });
}

module.exports = { registerStats };
