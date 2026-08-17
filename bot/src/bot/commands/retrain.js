const { retrain, getLearnStats } = require('../../analysis/learning');
const { getAllSignals } = require('../../database/db');
const { renderBanner } = require('../../banner');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

function registerRetrain(bot) {
  bot.command('retrain', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b> Perintah ini hanya untuk owner.');
    }

    let loadingMsg;
    try {
      loadingMsg = await ctx.replyWithHTML(
        `⏳ <b>Menjalankan manual retrain...</b>\n<i>Menyinkronisasi dataset dengan signals.json</i>`
      );
    } catch { /* ignore */ }

    try {
      const before = await getLearnStats();
      const result = await retrain(getAllSignals);
      const after  = await getLearnStats();

      if (loadingMsg) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
      }

      const decidedBefore = before.wins + before.losses;
      const decidedAfter  = after.wins  + after.losses;
      const wrBefore = decidedBefore > 0 ? ((before.wins / decidedBefore) * 100).toFixed(1) : '0.0';
      const wrAfter  = decidedAfter  > 0 ? ((after.wins  / decidedAfter)  * 100).toFixed(1) : '0.0';

      const msg = [
        `━━━━━━━━━━━━━━━━━━━━`,
        `🔄 <b>MANUAL RETRAIN SELESAI</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📚 <b>Total Entries</b>  : <code>${result.total}</code>`,
        `✅ <b>Updated</b>        : <code>${result.updated}</code> entries`,
        ``,
        result.updated > 0
          ? `🟢 Dataset berhasil disinkronisasi dari signals.json`
          : `🟡 Tidak ada perubahan — semua entries sudah up-to-date`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📊 <b>SEBELUM → SESUDAH</b>`,
        ``,
        `📚 Dataset  : <code>${before.closed}</code> → <code>${after.closed}</code>`,
        `✅ WIN      : <code>${before.wins}</code> → <code>${after.wins}</code>`,
        `❌ LOSS     : <code>${before.losses}</code> → <code>${after.losses}</code>`,
        `🔒 BE       : <code>${before.breakevens}</code> → <code>${after.breakevens}</code>`,
        `🎯 Win Rate : <code>${wrBefore}%</code> → <code>${wrAfter}%</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `ℹ️ <i>Bot auto-retrain setiap trade selesai. /retrain hanya untuk override manual.</i>`,
        `<i>Gunakan /learnstats untuk status terbaru.</i>`,
        `⚡ <i>AZZAVISION AI v2.1 | Manual Retrain</i>`,
      ].join('\n');

      try {
        const buffer = await renderBanner('retrain_ai', {
          rows: [
            { label: 'Total Entries', value: result.total },
            { label: 'Updated', value: result.updated },
            { label: 'Win Rate Sebelum', value: `${wrBefore}%` },
            { label: 'Win Rate Sesudah', value: `${wrAfter}%` },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[RETRAIN-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(msg);
    } catch (err) {
      if (loadingMsg) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
      }
      console.error('[RETRAIN] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Retrain gagal.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerRetrain };
