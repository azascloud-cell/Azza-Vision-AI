/**
 * news.js — /news command v4.0
 *
 * /news         — News Intelligence v4.0 dengan kategori, bobot, dan AI verdict
 * /news detail  — Tampilkan lebih banyak berita
 */

'use strict';

const { getNewsImpact, formatNewsMessageV4 } = require('../../analysis/news_engine_v4');
const { renderBanner } = require('../../banner');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function registerNews(bot) {
  bot.command('news', async (ctx) => {
    const loading = await ctx.replyWithHTML(`📰 <i>Menganalisis berita fundamental XAUUSD...</i>`);

    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});

      const newsResult = await getNewsImpact();

      if (!newsResult) {
        return ctx.replyWithHTML([
          `📰 <b>NEWS INTELLIGENCE v4.0</b>`,
          ``,
          `⚠️ <i>Tidak dapat mengambil berita saat ini. Coba beberapa saat lagi.</i>`,
        ].join('\n'));
      }

      const message = formatNewsMessageV4(newsResult);

      try {
        const v4 = newsResult.v4;
        const buffer = await renderBanner('news_intelligence', {
          headline: v4?.ai_verdict?.action || 'NEUTRAL',
          subtitle: newsResult.filterText ? newsResult.filterText.replace(/^[^\s]+\s/, '') : '-',
          rows: [
            { label: 'Confidence Impact', value: `${newsResult.confidenceAdjustment >= 0 ? '+' : ''}${newsResult.confidenceAdjustment}%` },
            { label: 'Block Entry', value: newsResult.blockEntry ? 'YA' : 'TIDAK' },
            { label: 'Berita Dianalisis', value: newsResult.items?.length || 0 },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[NEWS-BANNER] Gagal render banner:', bannerErr.message);
      }

      // Telegram max 4096 chars per message
      if (message.length <= 4096) {
        await ctx.replyWithHTML(message);
      } else {
        const half = Math.floor(message.length / 2);
        const split = message.lastIndexOf('\n', half);
        await ctx.replyWithHTML(message.slice(0, split));
        await ctx.replyWithHTML(message.slice(split + 1));
      }
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ <b>Gagal mengambil berita.</b>\n<code>${escapeHtml(err.message)}</code>`);
    }
  });
}

module.exports = { registerNews };
