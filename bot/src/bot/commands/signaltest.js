const { calculateSignal } = require('../../analysis/strategy');
const { generateSignalChart } = require('../../chart/generator');
const { formatSignalMessage } = require('../../utils/format');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

const DUMMY_ANALYSIS = {
  h4:  { bias: 'STRONG_BUY' },
  h1:  { bias: 'BUY' },
  m15: { bias: 'BUY' },
  m5:  { bias: 'BUY' },
  m1:  { bias: 'NEUTRAL' },
};

function registerSignalTest(bot) {
  bot.command('signaltest', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b> Perintah ini hanya untuk owner.');
    }

    // Boleh tentukan direction: /signaltest buy atau /signaltest sell
    const args = ctx.message?.text?.split(' ');
    const dirArg = (args[1] || 'buy').toUpperCase();
    const direction = dirArg === 'SELL' ? 'SELL' : 'BUY';

    const loading = await ctx.replyWithHTML(
      `🧪 <b>Mengirim tes sinyal ${direction} ke channel...</b>`
    );

    try {
      const channelId = process.env.CHANNEL_ID;

      // ── Build dummy signal ─────────────────────────────────────────────────
      const dummyPrice = 3300.00;
      const levels = calculateSignal(dummyPrice, direction);

      const dummyAnalysis = {
        ...DUMMY_ANALYSIS,
        h4:  { bias: direction === 'BUY' ? 'STRONG_BUY'  : 'STRONG_SELL' },
        h1:  { bias: direction === 'BUY' ? 'BUY'         : 'SELL'        },
        m15: { bias: direction === 'BUY' ? 'BUY'         : 'SELL'        },
        m5:  { bias: direction === 'BUY' ? 'BUY'         : 'SELL'        },
        m1:  { bias: 'NEUTRAL' },
      };

      const signalData = {
        pair:       'XAUUSD',
        direction,
        entry:      levels.entry,
        tp1:        levels.tp1,
        tp2:        levels.tp2,
        sl:         levels.sl,
        confidence: 99,
        m5_signal:  '🧪 TEST SIGNAL — Tidak tersimpan di DB',
      };

      const rawMessage = formatSignalMessage(signalData, dummyAnalysis);
      // Tambah watermark TEST supaya jelas ini bukan sinyal real
      const message = `🧪 <b>[TEST MODE — BUKAN SINYAL REAL]</b>\n\n${rawMessage}\n\n🧪 <i>Ini hanya tes koneksi channel. Abaikan.</i>`;

      // ── Generate chart ─────────────────────────────────────────────────────
      let chartBuffer = null;
      try {
        chartBuffer = await generateSignalChart({
          direction,
          entry:      levels.entry,
          tp1:        levels.tp1,
          tp2:        levels.tp2,
          sl:         levels.sl,
          confidence: 99,
          analysis:   dummyAnalysis,
        });
      } catch (chartErr) {
        console.warn('[SIGNALTEST] Chart gagal:', chartErr.message);
      }

      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});

      // ── Kirim ke channel ───────────────────────────────────────────────────
      if (!channelId) {
        // Tidak ada channel — kirim ke chat owner sebagai preview
        if (chartBuffer) {
          await ctx.replyWithPhoto({ source: chartBuffer }, { caption: message, parse_mode: 'HTML' });
        } else {
          await ctx.replyWithHTML(message);
        }
        await ctx.replyWithHTML([
          `⚠️ <b>CHANNEL_ID tidak di-set di .env</b>`,
          `Sinyal tes ditampilkan di sini sebagai preview.`,
          ``,
          `Set <code>CHANNEL_ID=@namaChannel</code> di .env untuk tes kirim ke channel.`,
        ].join('\n'));
        return;
      }

      try {
        if (chartBuffer) {
          await bot.telegram.sendPhoto(channelId, { source: chartBuffer }, {
            caption:    message,
            parse_mode: 'HTML',
          });
        } else {
          await bot.telegram.sendMessage(channelId, message, { parse_mode: 'HTML' });
        }

        await ctx.replyWithHTML([
          `✅ <b>Tes sinyal ${direction} berhasil dikirim!</b>`,
          ``,
          `📡 Channel   : <code>${channelId}</code>`,
          `💰 Entry     : <code>${levels.entry}</code>`,
          `🎯 TP1 / TP2 : <code>${levels.tp1}</code> / <code>${levels.tp2}</code>`,
          `🛑 SL        : <code>${levels.sl}</code>`,
          `📊 Chart     : ${chartBuffer ? '✅ Berhasil' : '⚠️ Gagal (teks saja)'}`,
          ``,
          `⚠️ <i>Sinyal ini TIDAK disimpan di database.</i>`,
        ].join('\n'));

        console.log(`[SIGNALTEST] ✅ Tes sinyal ${direction} dikirim ke ${channelId}`);

      } catch (sendErr) {
        console.error('[SIGNALTEST] ❌ Gagal kirim ke channel:', sendErr.message);
        await ctx.replyWithHTML([
          `❌ <b>Gagal kirim ke channel!</b>`,
          ``,
          `<code>${sendErr.message}</code>`,
          ``,
          `Periksa:`,
          `• Bot sudah jadi <b>Admin</b> di channel dengan izin "Post Messages"`,
          `• <b>CHANNEL_ID</b> benar: <code>${channelId}</code>`,
          `  Format: <code>@namaChannel</code> atau <code>-100xxxxxxxxxx</code>`,
        ].join('\n'));
      }

    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      console.error('[SIGNALTEST] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Error saat membuat tes sinyal.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerSignalTest };
