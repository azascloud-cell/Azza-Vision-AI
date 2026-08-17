const { toWIB } = require('../../utils/wib_time');

function formatBacktestResult(result) {
  const beCount = result.breakevens || 0;
  const sign    = parseFloat(result.netPips) >= 0 ? '+' : '';
  const wib     = toWIB();

  return [
    `━━━━━━━━━━━━━━━━━━━━`,
    `📉 <b>AZZAVISION AI — BACKTEST ${result.days}D</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    wib.line,
    ``,
    `📆 <b>Periode</b>      : <code>${result.days} hari terakhir</code>`,
    `🔢 <b>Total Signal</b> : <code>${result.total}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🏆 <b>WIN</b>          : <code>${result.wins}</code>`,
    `   ├ TP1 Close    : <code>${result.tp1Hits}</code>`,
    `   └ TP2 Close    : <code>${result.tp2Hits}</code>`,
    `❌ <b>LOSS</b>         : <code>${result.losses}</code>`,
    `🔒 <b>BREAKEVEN</b>   : <code>${beCount}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🎯 <b>Win Rate</b>     : <code>${result.winRate}%</code>`,
    `   <i>(WIN / (WIN+LOSS), BE dikecualikan)</i>`,
    ``,
    `💹 <b>Net Pips</b>     : <code>${sign}${result.netPips}</code>`,
    `🔥 <b>Profit Factor</b> : <code>${result.profitFactor}</code>`,
    `📉 <b>Max Drawdown</b> : <code>${result.maxDD} pips</code>`,
    ``,
    `📡 <b>Avg Confidence</b>: <code>${result.avgConf}%</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📐 <b>Risk:Reward</b>`,
    `   TP1: R:R 1:${result.rrTp1 || '1.50'}  (+60 pips)`,
    `   TP2: R:R 1:${result.rrTp2 || '3.13'}  (+125 pips)`,
    `   SL : -40 pips`,
    `   BE : Trigger +28 pips → SL ke entry`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `ℹ️ <i>Simulasi berdasarkan data historis Twelve Data.</i>`,
    `ℹ️ <i>BE logic dimasukkan dalam simulasi.</i>`,
    `⚡ <i>AZZAVISION AI v3.0 | Backtest Engine</i>`,
  ].join('\n');
}

function registerBacktest(bot) {
  bot.command('backtest', async (ctx) => {
    const args = ctx.message?.text?.split(' ') || [];
    const days = parseInt(args[1]) || 7;

    if (days < 1 || days > 90) {
      return ctx.replyWithHTML(`❌ <b>Periode tidak valid.</b> Gunakan antara 1–90 hari.\nContoh: <code>/backtest 30</code>`);
    }

    const loading = await ctx.replyWithHTML(
      `⏳ <b>Menjalankan backtest ${days} hari...</b>\n<i>Mengambil data historis & mensimulasikan sinyal (termasuk BE logic). Mohon tunggu.</i>`
    );

    try {
      const { runBacktest } = require('../../analysis/backtest');
      const result  = await runBacktest(days);
      const message = formatBacktestResult(result);
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(message);
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ Backtest gagal.\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerBacktest, formatBacktestResult };
