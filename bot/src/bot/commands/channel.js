/**
 * channel.js — Channel Management Commands
 *
 * /setchannel <id> — Owner only. Simpan channel ID secara permanen.
 * /channel         — Owner only. Lihat konfigurasi channel aktif.
 * /channelstats    — Owner only. Performa sinyal yang dikirim ke channel.
 */

const { setChannelId, getChannelConfig } = require('../../utils/channel_store');
const { getStats }                        = require('../../database/db');
const { isOwner }                         = require('./owner');

function registerChannelCommands(bot) {

  // ─── /setchannel <channel_id> ───────────────────────────────────────────────
  bot.command('setchannel', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b> Perintah ini hanya untuk owner.');
    }

    const text  = ctx.message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 2) {
      return ctx.replyWithHTML(
        `⚙️ <b>Cara pakai:</b>\n` +
        `<code>/setchannel @namaChannel</code>\n` +
        `atau\n` +
        `<code>/setchannel -100xxxxxxxxxx</code>\n\n` +
        `📌 <b>Channel sekarang:</b> <code>${process.env.CHANNEL_ID || 'belum diset'}</code>`
      );
    }

    const newChannelId = parts[1].trim();

    // Basic validation
    const isAtChannel  = newChannelId.startsWith('@');
    const isNumericId  = newChannelId.startsWith('-') && !isNaN(newChannelId);
    if (!isAtChannel && !isNumericId) {
      return ctx.replyWithHTML(
        `❌ <b>Format tidak valid.</b>\n\n` +
        `Gunakan format:\n` +
        `• <code>@namaChannel</code>\n` +
        `• <code>-100xxxxxxxxxx</code> (numeric ID dengan prefix -100)`
      );
    }

    try {
      const sebelumnya = process.env.CHANNEL_ID || '(kosong)';
      await setChannelId(newChannelId);

      await ctx.replyWithHTML(
        `✅ <b>Channel berhasil diset!</b>\n\n` +
        `📌 <b>Sebelumnya</b> : <code>${sebelumnya}</code>\n` +
        `📌 <b>Sekarang</b>   : <code>${newChannelId}</code>\n\n` +
        `🔄 Perubahan aktif langsung — semua sinyal berikutnya dikirim ke channel baru.\n` +
        `💾 Tersimpan permanen (tidak berubah saat bot restart).`
      );
    } catch (err) {
      await ctx.replyWithHTML(`❌ Gagal menyimpan channel: <code>${err.message}</code>`);
    }
  });

  // ─── /channel ───────────────────────────────────────────────────────────────
  bot.command('channel', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b> Perintah ini hanya untuk owner.');
    }

    try {
      const config    = await getChannelConfig();
      const channelId = process.env.CHANNEL_ID || '(tidak diset)';

      const sourceLabel = config.source === 'config_file'
        ? '📁 config file (permanen)'
        : '📄 .env (default)';

      const updatedAt = config.updated_at
        ? new Date(config.updated_at).toLocaleString('id-ID', { timeZone: 'Asia/Kuala_Lumpur' })
        : '—';

      const lines = [
        `⚙️ <b>CHANNEL CONFIGURATION</b>`,
        ``,
        `📡 <b>Channel aktif</b>  : <code>${channelId}</code>`,
        `📌 <b>Sumber</b>        : ${sourceLabel}`,
        `🕐 <b>Terakhir diset</b>: ${updatedAt}`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `💡 <b>Cara ganti channel:</b>`,
        `<code>/setchannel @namaChannel</code>`,
        `<code>/setchannel -100xxxxxxxxxx</code>`,
      ];

      await ctx.replyWithHTML(lines.join('\n'));
    } catch (err) {
      await ctx.replyWithHTML(`❌ Gagal cek channel config: <code>${err.message}</code>`);
    }
  });

  // ─── /channelstats ──────────────────────────────────────────────────────────
  bot.command('channelstats', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b> Perintah ini hanya untuk owner.');
    }

    try {
      const stats     = await getStats();
      const channelId = process.env.CHANNEL_ID || '(tidak diset)';
      const be        = (stats.breakevens || 0) + (stats.tp1breakevens || 0);

      const lines = [
        `━━━━━━━━━━━━━━━━━━`,
        `📊 <b>CHANNEL STATS — AZZAVISION AI</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `📡 Channel: <code>${channelId}</code>`,
        ``,
        `📈 <b>Total Trade</b>    : <code>${stats.total}</code>`,
        `🏆 <b>Win</b>           : <code>${stats.wins}</code>`,
        `❌ <b>Loss</b>          : <code>${stats.losses}</code>`,
        `🔒 <b>Breakeven</b>    : <code>${be}</code>`,
        ``,
        `🎯 <b>Win Rate</b>     : <code>${stats.winRate}%</code>`,
        `💹 <b>Net Pips</b>     : <code>${parseFloat(stats.netPips) >= 0 ? '+' : ''}${stats.netPips}</code>`,
        `🔥 <b>Profit Factor</b>: <code>${stats.profitFactor}</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `⚡ <i>AZZAVISION AI | Channel Performance</i>`,
      ];

      await ctx.replyWithHTML(lines.join('\n'));
    } catch (err) {
      await ctx.replyWithHTML(`❌ Gagal ambil stats: <code>${err.message}</code>`);
    }
  });
}

module.exports = { registerChannelCommands };
