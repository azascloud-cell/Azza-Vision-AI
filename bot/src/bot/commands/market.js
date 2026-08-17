const { getAllTimeframes } = require('../../market/data');
const { runStrategy } = require('../../analysis/strategy');
const { getOverallBias } = require('../../analysis/scanner');
const { formatMarketStatus } = require('../../utils/format');

function registerMarket(bot) {
  bot.command('market', async (ctx) => {
    const loading = await ctx.replyWithHTML('⏳ <b>Menganalisis market...</b> Mohon tunggu.');

    try {
      const tfData = await getAllTimeframes();
      const result = runStrategy(tfData);
      const overall = getOverallBias(result.analysis);
      const message = formatMarketStatus(result.analysis, overall, result.confidence);

      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(message);
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ <b>Gagal mengambil data market.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerMarket };
