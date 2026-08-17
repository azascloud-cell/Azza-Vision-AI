const { getStatusSummary, STATUS } = require('../../market/key_manager');

const PAGE_SIZE = 20;

function statusEmoji(s) {
  if (s === STATUS.ACTIVE)   return '✅';
  if (s === STATUS.COOLING)  return '⏳';
  if (s === STATUS.INVALID)  return '❌';
  return '❓';
}

function statusLabel(s) {
  if (s === STATUS.ACTIVE)   return 'Active';
  if (s === STATUS.COOLING)  return 'Cooling Down';
  if (s === STATUS.INVALID)  return 'Invalid';
  return 'Unknown';
}

function registerApiKeys(bot) {
  bot.command('apikeys', async (ctx) => {
    try {
      const args = ctx.message?.text?.split(' ');
      const page = Math.max(1, parseInt(args[1]) || 1);

      const summary = getStatusSummary();

      if (summary.total === 0) {
        return ctx.replyWithHTML([
          `🔑 <b>API KEY STATUS</b>`,
          ``,
          `❌ <b>Tidak ada API key tersedia!</b>`,
          ``,
          `Tambahkan key ke:`,
          `• <code>data/api_keys.json</code>`,
          `• atau env <code>TWELVE_DATA_KEYS=key1,key2,...</code>`,
        ].join('\n'));
      }

      const now          = Date.now();
      const totalPages   = Math.ceil(summary.total / PAGE_SIZE);
      const safePage     = Math.min(page, totalPages);
      const slice        = summary.list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

      const keyLines = slice.map((k) => {
        const curr = k.isCurrent ? ' ◀ CURRENT' : '';
        let extra  = '';
        if (k.status === STATUS.COOLING) {
          const secsLeft = Math.max(0, Math.ceil((k.cooldownUntil - now) / 1000));
          extra = ` (${secsLeft}s)`;
        }
        return `${statusEmoji(k.status)} Key ${String(k.index).padStart(2, '0')} | ${statusLabel(k.status)}${extra}${curr}`;
      });

      const msg = [
        `━━━━━━━━━━━━━━━━━━━━`,
        `🔑 <b>AZZAVISION AI — API KEY STATUS</b>`,
        totalPages > 1 ? `📄 Halaman ${safePage}/${totalPages}` : '',
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<code>${keyLines.join('\n')}</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📊 <b>Total</b>    : <code>${summary.total}</code>`,
        `✅ <b>Ready</b>    : <code>${summary.totalActive}</code>`,
        `⏳ <b>Cooling</b>  : <code>${summary.totalCooling}</code>`,
        `❌ <b>Invalid</b>  : <code>${summary.totalInvalid}</code>`,
        ``,
        `🔄 <b>Current</b>  : <code>${summary.currentKey}</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        totalPages > 1
          ? `💡 <code>/apikeys ${safePage + 1}</code> untuk halaman berikutnya`
          : '',
        `⚡ <i>AZZAVISION AI | Round-Robin Key Rotation</i>`,
      ].filter(l => l !== '').join('\n');

      await ctx.replyWithHTML(msg);
    } catch (err) {
      console.error('[APIKEYS] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Gagal ambil status API key.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerApiKeys };
