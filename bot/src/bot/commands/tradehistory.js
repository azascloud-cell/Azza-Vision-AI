/**
 * tradehistory.js — /tradehistory
 *
 * Menampilkan histori trade terbaru dengan inline buttons untuk AI Replay.
 */

'use strict';

const { getAllSignals } = require('../../database/db');
const { Markup }       = require('telegraf');
const { toWIB, isoToWIBShort } = require('../../utils/wib_time');

const PAGE_SIZE = 8;

function statusEmoji(status) {
  if (status === 'WIN')           return '✅';
  if (status === 'LOSS')          return '❌';
  if (status === 'BREAKEVEN')     return '🔒';
  if (status === 'TP1_BREAKEVEN') return '🔒';
  return '🟡';
}

function statusLabel(status) {
  if (status === 'WIN')           return 'WIN';
  if (status === 'LOSS')          return 'LOSS';
  if (status === 'TP1_BREAKEVEN') return 'TP1+BE';
  if (status === 'BREAKEVEN')     return 'BE';
  return 'OPEN';
}

function pipLabel(signal) {
  if (signal.status === 'OPEN') return '🟡 OPEN';
  if (signal.status === 'TP1_BREAKEVEN' || signal.status === 'BREAKEVEN') return '🔒 0 pips';
  const pips = signal.pips || 0;
  return `${pips >= 0 ? '+' : ''}${pips} pips`;
}

function buildHistoryText(signals, page, totalPages) {
  const wib   = toWIB();
  const lines = [
    `━━━━━━━━━━━━━━━━━━`,
    `📖 <b>TRADE HISTORY</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    wib.line,
    ``,
    `Halaman ${page}/${totalPages}  |  Klik ID untuk AI Replay`,
    ``,
  ];

  for (const s of signals) {
    const stratName = s.strategy || (s.h4_bias ? 'Multi-TF' : 'N/A');
    const shortStrat = stratName.length > 20 ? stratName.slice(0, 17) + '...' : stratName;
    const dateStr   = s.closed_at ? isoToWIBShort(s.closed_at) : (s.created_at ? isoToWIBShort(s.created_at) : '—');
    lines.push(
      `${statusEmoji(s.status)} <b>#${s.id}</b> — ${s.direction} — <b>${statusLabel(s.status)}</b> — ${pipLabel(s)}`
    );
    lines.push(`   <i>${shortStrat}</i>  |  <code>${dateStr}</code>`);
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`💡 <i>Ketik /tradejournal &lt;id&gt; untuk AI Replay lengkap</i>`);

  return lines.join('\n');
}

function buildButtons(signals, page, totalPages) {
  const rows = [];

  // Replay buttons — 2 per row
  for (let i = 0; i < signals.length; i += 2) {
    const row = [];
    const s1  = signals[i];
    row.push(Markup.button.callback(
      `${statusEmoji(s1.status)} #${s1.id} Replay`,
      `replay_${s1.id}`
    ));
    if (signals[i + 1]) {
      const s2 = signals[i + 1];
      row.push(Markup.button.callback(
        `${statusEmoji(s2.status)} #${s2.id} Replay`,
        `replay_${s2.id}`
      ));
    }
    rows.push(row);
  }

  // Pagination
  const nav = [];
  if (page > 1)          nav.push(Markup.button.callback('◀ Sebelumnya', `tradehistory_page_${page - 1}`));
  if (page < totalPages) nav.push(Markup.button.callback('Berikutnya ▶', `tradehistory_page_${page + 1}`));
  if (nav.length > 0)    rows.push(nav);

  return Markup.inlineKeyboard(rows);
}

function registerTradeHistory(bot) {
  bot.command('tradehistory', async (ctx) => {
    try {
      const args    = ctx.message?.text?.trim().split(/\s+/);
      const page    = Math.max(1, parseInt(args[1]) || 1);
      const all     = await getAllSignals();

      if (all.length === 0) {
        return ctx.replyWithHTML([
          `📖 <b>TRADE HISTORY</b>`,
          ``,
          `⏳ <i>Belum ada trade yang tercatat.</i>`,
        ].join('\n'));
      }

      const sorted     = [...all].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
      const safePage   = Math.min(page, totalPages);
      const slice      = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

      const text    = buildHistoryText(slice, safePage, totalPages);
      const buttons = buildButtons(slice, safePage, totalPages);

      await ctx.replyWithHTML(text, buttons);
    } catch (err) {
      console.error('[TRADEHISTORY] Error:', err.message);
      await ctx.replyWithHTML(`❌ <b>Gagal memuat trade history.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerTradeHistory, buildHistoryText, buildButtons, PAGE_SIZE };
