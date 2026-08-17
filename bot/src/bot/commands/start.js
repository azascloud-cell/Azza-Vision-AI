const { Markup } = require('telegraf');
const { getPriceInfo } = require('../../market/data');
const { getPriceCache, isCacheValid } = require('../../market/cache');
const { dashboardMessages } = require('../state');
const { getMarketStatus } = require('../../utils/market_hours');
const { toWIB } = require('../../utils/wib_time');
const fs   = require('fs');
const path = require('path');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── PERMANENT REPLY KEYBOARD ─────────────────────────────────────────────────
function buildReplyKeyboard(owner = false) {
  const rows = [
    ['📊 Market',               '📈 Statistik'],
    ['📅 Daily',                '📅 Weekly'],
    ['📖 Journal',              '🤖 Bot Status'],
    ['🧠 Learning',             '🔄 Retrain'],
    ['👀 Watchlist',            '❓ Kenapa Belum Entry?'],
    ['📚 Strategi Stats',       '📉 Backtest 7D'],
    ['📊 Backtest 30D',         '📄 Export Excel'],
    ['💼 Money Management',     '👤 Profile'],
  ];

  if (owner) {
    rows.push(['🟢 Force BUY', '🔴 Force SELL']);
    rows.push(['🔭 Trade Scanner', '📡 Scan Status']);
  }

  rows.push(['📑 Export PDF', '🔄 Refresh']);
  rows.push(['❓ Bantuan']);

  return Markup.keyboard(rows)
    .resize()
    .persistent();
}

// ─── DASHBOARD TEXT ───────────────────────────────────────────────────────────
async function buildDashboardText(name) {
  const wib = toWIB();
  let priceBlock;

  try {
    const cache = getPriceCache();

    if (isCacheValid() && cache && cache.lastPrice) {
      const price = cache.lastPrice;
      const tsWIB = cache.timestamp
        ? toWIB(new Date(cache.timestamp)).short
        : wib.short;

      priceBlock = [
        `━━━━━━━━━━━━━━━━━━`,
        `💰 <b>XAUUSD Live Price</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `🟢 <b>Harga  :</b> <code>$${price.toFixed(2)}</code>`,
        `📈 <b>Bid    :</b> <code>$${cache.bid ? cache.bid.toFixed(2) : '-'}</code>`,
        `📉 <b>Ask    :</b> <code>$${cache.ask ? cache.ask.toFixed(2) : '-'}</code>`,
        ``,
        `🕐 <i>${tsWIB}</i>`,
        ``,
      ].join('\n');
    } else {
      const info     = await getPriceInfo();
      const sign     = info.change >= 0 ? '+' : '';
      const arrow    = info.change >= 0 ? '📈' : '📉';
      const dotColor = info.change >= 0 ? '🟢' : '🔴';

      priceBlock = [
        `━━━━━━━━━━━━━━━━━━`,
        `💰 <b>XAUUSD Live Price</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `${dotColor} <b>Harga  :</b> <code>$${info.price.toFixed(2)}</code>`,
        `${arrow} <b>Change :</b> <code>${sign}${info.change.toFixed(2)} (${sign}${info.changePct.toFixed(2)}%)</code>`,
        `📊 <b>High   :</b> <code>$${info.high.toFixed(2)}</code>`,
        `📊 <b>Low    :</b> <code>$${info.low.toFixed(2)}</code>`,
        ``,
        `🕐 <i>${wib.short}</i>`,
        ``,
      ].join('\n');
    }
  } catch {
    priceBlock = [
      `━━━━━━━━━━━━━━━━━━`,
      `⚠️ <i>Harga tidak tersedia saat ini</i>`,
      ``,
    ].join('\n');
  }

  const interval    = parseInt(process.env.SCAN_INTERVAL || '6000') / 1000;
  const mkt         = getMarketStatus();

  const marketBlock = mkt.open
    ? [
        `${mkt.emoji} <b>XAUUSD Market</b> : OPEN`,
        `🕐 ${mkt.session}`,
      ].join('\n')
    : [
        `${mkt.emoji} <b>XAUUSD Market</b> : CLOSED`,
        `🕒 ${mkt.session}`,
        `⏳ Scanner paused until market opens`,
        mkt.timeUntilOpen ? `⏱ Buka dalam: <code>${mkt.timeUntilOpen}</code>` : '',
      ].filter(Boolean).join('\n');

  const scannerLine = mkt.open
    ? `🟢 Scanner  : AKTIF (setiap ${interval}s)`
    : `🟡 Scanner  : PAUSED (market tutup)`;

  return [
    `⚡ <b>AZZAVISION AI v5.0 — AI Trading Assistant</b>`,
    ``,
    `👋 Halo <b>${name}</b>! Selamat datang.`,
    `🤖 Platform AI Trading dengan <b>Dual AI Engine</b>:`,
    `   Signal Engine + Trade Scanner AI`,
    ``,
    priceBlock,
    `━━━━━━━━━━━━━━━━━━`,
    marketBlock,
    `━━━━━━━━━━━━━━━━━━`,
    `⚙️ <b>Status System</b>`,
    ``,
    scannerLine,
    `🔭 Scanner AI: AKTIF (SHORT/MEDIUM/LONG)`,
    `🎯 Min Conf : ${process.env.MIN_CONFIDENCE || '65'}%`,
    `🏆 Ensemble : ${process.env.ENSEMBLE_MIN_SCORE || '75'}/100 min`,
    `📡 Auto-Signal & Auto-Close : ON`,
    `🔒 TP1+BE Protection : ON`,
    `📚 E-Book Strategy Engine : ON`,
    `🤖 AI Router : Gemini → OpenRouter → Groq`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    wib.line,
    ``,
    `<i>Gunakan keyboard menu di bawah atau ketik /help</i>`,
  ].join('\n');
}

// ─── buildStartMessage — dipanggil oleh callbacks.js ─────────────────────────
async function buildStartMessage(name, owner = false) {
  const text = await buildDashboardText(name);
  return { text, keyboard: {} };
}

// ─── BANNER PATH ──────────────────────────────────────────────────────────────
function getBannerPath() {
  const candidates = [
    path.resolve(process.cwd(), 'banner.png'),
    path.resolve(__dirname, '../../../../banner.png'),
    path.resolve(__dirname, '../../../banner.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ─── SEND OR EDIT DASHBOARD ───────────────────────────────────────────────────
async function sendOrEditDashboard(ctx, text) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const owner = isOwner(ctx);
  const existingMsgId = dashboardMessages.get(chatId);

  if (existingMsgId) {
    try {
      await ctx.telegram.editMessageText(chatId, existingMsgId, undefined, text, { parse_mode: 'HTML' });
      return;
    } catch {
      dashboardMessages.delete(chatId);
    }
  }

  const keyboard = buildReplyKeyboard(owner);
  const sent = await ctx.replyWithHTML(text, keyboard);
  dashboardMessages.set(chatId, sent.message_id);
}

// ─── /start COMMAND ───────────────────────────────────────────────────────────
function registerStart(bot) {
  bot.command('start', async (ctx) => {
    const name   = ctx.from?.first_name || 'Trader';
    const chatId = ctx.chat?.id;
    const owner  = isOwner(ctx);

    if (!chatId) return;

    if (!dashboardMessages.has(chatId)) {
      const bannerPath = getBannerPath();
      if (bannerPath) {
        try {
          await ctx.replyWithPhoto(
            { source: fs.createReadStream(bannerPath) },
            { caption: '⚡ <b>AZZAVISION AI v5.0 — AI Trading Assistant</b>', parse_mode: 'HTML' }
          );
        } catch (e) {
          console.warn('[START] Gagal kirim banner:', e.message);
        }
      }

      const text     = await buildDashboardText(name);
      const keyboard = buildReplyKeyboard(owner);
      const sent     = await ctx.replyWithHTML(text, keyboard);
      dashboardMessages.set(chatId, sent.message_id);
    } else {
      const text = await buildDashboardText(name);
      await sendOrEditDashboard(ctx, text);
    }
  });
}

module.exports = {
  registerStart,
  buildDashboardText,
  buildStartMessage,
  buildReplyKeyboard,
  sendOrEditDashboard,
};
