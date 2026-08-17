const { getAllSignals }               = require('../../database/db');
const { toWIB, isoToWIBShort }       = require('../../utils/wib_time');
const { renderBanner }                = require('../../banner');

const PAGE_SIZE = 10;

function statusEmoji(status) {
  if (status === 'WIN')            return '✅';
  if (status === 'LOSS')           return '❌';
  if (status === 'BREAKEVEN')      return '🔒';
  if (status === 'TP1_BREAKEVEN')  return '🔒';
  return '🟡';
}

function statusLabel(status) {
  if (status === 'WIN')            return 'WIN';
  if (status === 'LOSS')           return 'LOSS';
  if (status === 'TP1_BREAKEVEN')  return 'TP1+BE';
  if (status === 'BREAKEVEN')      return 'BREAKEVEN';
  return 'OPEN';
}

function dirEmoji(direction) {
  return direction === 'BUY' ? '🟢' : '🔴';
}

function formatSignalRow(s) {
  // Konversi waktu simpan (UTC ISO) ke tampilan WIB
  const openWIB   = s.created_at ? isoToWIBShort(s.created_at)  : '-';
  const closeWIB  = s.closed_at  ? isoToWIBShort(s.closed_at)   : null;
  const pipSign   = s.pips > 0 ? '+' : '';

  let pipStr;
  if (s.status === 'OPEN') {
    pipStr = '🟡 OPEN';
  } else if (s.status === 'TP1_BREAKEVEN') {
    pipStr = `🔒 <b>TP1 + BREAKEVEN</b>  <code>0 pips</code>`;
  } else if (s.status === 'BREAKEVEN') {
    pipStr = `🔒 <b>BREAKEVEN</b>  <code>0 pips</code>`;
  } else {
    pipStr = `${s.pips >= 0 ? '📈' : '📉'} <code>${pipSign}${s.pips} pts</code>`;
  }

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `${statusEmoji(s.status)} <b>#${s.id}</b> | ${dirEmoji(s.direction)} ${s.direction} | ${statusLabel(s.status)} | Conf: <code>${s.confidence}%</code>`,
    `📌 Entry   : <code>${s.entry}</code>`,
    `🎯 TP1/TP2 : <code>${s.tp1}</code> / <code>${s.tp2}</code>`,
    `🛑 SL      : <code>${s.sl}</code>`,
    `📅 Open    : <code>${openWIB}</code>`,
    closeWIB ? `🔒 Close   : <code>${closeWIB}</code>` : null,
    `💹 Result  : ${pipStr}`,
  ].filter(Boolean).join('\n');
}

function formatJournalPage(signals, page, totalPages, summary) {
  const wib = toWIB();

  const header = [
    `📓 <b>AZZAVISION AI — SIGNAL JOURNAL</b>`,
    `📄 Halaman ${page} / ${totalPages}`,
    ``,
    wib.line,
    ``,
    `📊 Total: <code>${summary.total}</code>  ✅ Win: <code>${summary.wins}</code>  ❌ Loss: <code>${summary.losses}</code>  🔒 BE: <code>${summary.breakevens}</code>  🟡 Open: <code>${summary.open}</code>`,
    `🎯 Win Rate: <code>${summary.winRate}%</code>  |  💹 Net Pips: <code>${summary.netSign}${summary.netPips} pts</code>`,
    ``,
  ].join('\n');

  const rows  = signals.map((s) => formatSignalRow(s)).join('\n\n');

  const footer = [
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    totalPages > 1
      ? `💡 Gunakan <code>/journal ${page + 1}</code> untuk halaman berikutnya.`
      : ``,
    `⚡ <i>AZZAVISION AI v3.0 | Signal History</i>`,
  ].filter(Boolean).join('\n');

  return header + rows + footer;
}

function computeSummary(allSignals) {
  const closed     = allSignals.filter(s => s.status !== 'OPEN');
  const wins       = closed.filter(s => s.status === 'WIN').length;
  const losses     = closed.filter(s => s.status === 'LOSS').length;
  const breakevens = closed.filter(s => s.status === 'BREAKEVEN' || s.status === 'TP1_BREAKEVEN').length;
  const openCnt    = allSignals.filter(s => s.status === 'OPEN').length;
  const netPips    = closed.reduce((acc, s) => acc + (s.pips || 0), 0);

  const decidedTrades = wins + losses;
  const winRate = decidedTrades > 0
    ? ((wins / decidedTrades) * 100).toFixed(1)
    : '0.0';

  return {
    total:      allSignals.length,
    wins,
    losses,
    breakevens,
    open:       openCnt,
    netPips:    Math.abs(netPips).toFixed(1),
    netSign:    netPips >= 0 ? '+' : '-',
    winRate,
  };
}

function registerJournal(bot) {
  bot.command('journal', async (ctx) => {
    try {
      const args = ctx.message?.text?.split(' ');
      const page = Math.max(1, parseInt(args[1]) || 1);

      const allSignals = await getAllSignals();

      if (allSignals.length === 0) {
        const wib = toWIB();
        return ctx.replyWithHTML([
          `📓 <b>AZZAVISION AI — SIGNAL JOURNAL</b>`,
          ``,
          wib.line,
          ``,
          `⏳ <i>Belum ada sinyal yang tercatat.</i>`,
          ``,
          `Sinyal akan muncul di sini setelah bot mengirim entry pertama.`,
        ].join('\n'));
      }

      const sorted     = [...allSignals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
      const safePage   = Math.min(page, totalPages);
      const slice      = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
      const summary    = computeSummary(allSignals);
      const message    = formatJournalPage(slice, safePage, totalPages, summary);

      try {
        const buffer = await renderBanner('trading_journal', {
          sections: [
            {
              heading: `Halaman ${safePage} / ${totalPages}`,
              rows: [
                { label: 'Total Trades', value: summary.total },
                { label: 'Win', value: summary.wins, color: '#2ECC71' },
                { label: 'Loss', value: summary.losses, color: '#F14158' },
                { label: 'Breakeven', value: summary.breakevens },
                { label: 'Open', value: summary.open },
                { label: 'Winrate', value: `${summary.winRate}%` },
                { label: 'Net Pips', value: `${summary.netSign}${summary.netPips}` },
              ],
            },
          ],
        });
        await ctx.replyWithPhoto({ source: buffer });
      } catch (bannerErr) {
        console.error('[JOURNAL-BANNER] Gagal render banner:', bannerErr.message);
      }

      await ctx.replyWithHTML(message);
    } catch (err) {
      console.error('[JOURNAL] Error:', err);
      await ctx.replyWithHTML(`❌ <b>Gagal mengambil data journal.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerJournal, formatJournalPage, computeSummary };
