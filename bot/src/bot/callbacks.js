const { getAllTimeframes } = require('../market/data');
const { runStrategy } = require('../analysis/strategy');
const { getOverallBias } = require('../analysis/scanner');
const { getStats, getDailyStats, getWeeklyStats, getOpenSignals, getLastSignalTime, getAllSignals } = require('../database/db');
const { formatMarketStatus, formatStats } = require('../utils/format');
const { buildStartMessage } = require('./commands/start');
const { formatDailyReport, formatWeeklyReport } = require('./commands/daily');
const { handleForce } = require('./commands/owner');
const { logCallback } = require('./debug/callback_logger');
const { formatProfileMessage } = require('./commands/lot_calc');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

async function answerLoading(ctx, text = '⏳ Memuat...') {
  await ctx.answerCbQuery(text, { show_alert: false }).catch(() => {});
}

function withLogging(name, handler) {
  return async (ctx) => {
    const userId   = String(ctx.from?.id   || 'unknown');
    const username = ctx.from?.first_name || ctx.from?.username || userId;
    const startMs  = Date.now();
    try {
      await handler(ctx);
      logCallback(name, userId, username, startMs, 'SUCCESS');
    } catch (err) {
      logCallback(name, userId, username, startMs, 'ERROR', err.message);
      throw err;
    }
  };
}

const registeredActions = new Set();

function registerAction(bot, name, handler) {
  registeredActions.add(name);
  bot.action(name, withLogging(name, handler));
}

function registerCallbacks(bot) {

  registerAction(bot, 'menu_market', async (ctx) => {
    await answerLoading(ctx, '⏳ Menganalisis market...');
    try {
      const tfData  = await getAllTimeframes();
      const result  = runStrategy(tfData);
      const overall = getOverallBias(result.analysis);
      const message = formatMarketStatus(result.analysis, overall, result.confidence);
      await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal ambil data market.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  registerAction(bot, 'menu_stats', async (ctx) => {
    await answerLoading(ctx, '📈 Mengambil statistik...');
    try {
      const stats   = await getStats();
      const message = formatStats(stats);
      await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal ambil statistik.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  registerAction(bot, 'menu_daily', async (ctx) => {
    await answerLoading(ctx, '📅 Memuat laporan harian...');
    try {
      const { todayWIB } = require('../utils/wib_time');
      const today   = todayWIB();
      const stats   = await getDailyStats(today);
      const message = formatDailyReport(stats, today);
      await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal ambil data harian.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  registerAction(bot, 'menu_daily7', async (ctx) => {
    await answerLoading(ctx, '📆 Memuat ringkasan 7 hari...');
    try {
      const rows    = await getWeeklyStats();
      const message = formatWeeklyReport(rows);
      await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  registerAction(bot, 'menu_status', async (ctx) => {
    await answerLoading(ctx, '🔍 Memuat status...');
    try {
      const openSignals = await getOpenSignals();
      const lastSignal  = await getLastSignalTime();
      const interval    = parseInt(process.env.SCAN_INTERVAL || '60000') / 1000;
      const openLines   = openSignals.length > 0
        ? openSignals.slice(0, 3).map((s) => `  • ${s.direction} @ ${s.entry} (${s.confidence}%)`).join('\n')
        : '  Tidak ada sinyal terbuka.';
      const msg = [
        `🔍 <b>AZZAVISION AI — BOT STATUS</b>`, ``,
        `━━━━━━━━━━━━━━━━━━`,
        `🟢 <b>Status</b>    : ONLINE & AKTIF`,
        `📡 <b>Interval</b>  : <code>${interval}s</code>`,
        `🎯 <b>Min Conf</b>  : <code>${process.env.MIN_CONFIDENCE || '65'}%</code>`, ``,
        `━━━━━━━━━━━━━━━━━━`,
        `📌 <b>OPEN SIGNALS (${openSignals.length})</b>`,
        openLines, ``,
        `━━━━━━━━━━━━━━━━━━`,
        `🕐 <b>Sinyal Terakhir</b>:`,
        `  ${lastSignal ? require('../utils/wib_time').isoToWIBShort(lastSignal) : 'Belum ada sinyal'}`, ``,
        `🪙 Pair: XAUUSD  |  💾 DB: JSON Storage`,
        `⚡ <i>AZZAVISION AI v3.2.1 — Auto Gold Signals</i>`,
      ].join('\n');
      await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  registerAction(bot, 'menu_journal', async (ctx) => {
    await answerLoading(ctx, '📓 Memuat journal...');
    try {
      const { formatJournalPage, computeSummary } = require('./commands/journal');
      const allSignals = await getAllSignals();
      if (allSignals.length === 0) {
        return ctx.editMessageText(
          `📓 <b>SIGNAL JOURNAL</b>\n\n⏳ <i>Belum ada sinyal tercatat.</i>`,
          { parse_mode: 'HTML', reply_markup: backButton() }
        );
      }
      const sorted    = [...allSignals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const PAGE_SIZE = 10;
      const total     = Math.ceil(sorted.length / PAGE_SIZE);
      const summary   = computeSummary(allSignals);
      const message   = formatJournalPage(sorted.slice(0, PAGE_SIZE), 1, total, summary);
      await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal memuat journal.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  registerAction(bot, 'menu_help', async (ctx) => {
    await answerLoading(ctx);
    const msg = [
      `❓ <b>AZZAVISION AI — PANDUAN</b>`, ``,
      `━━━━━━━━━━━━━━━━━━`,
      `📊 <b>STRATEGI</b>`, ``,
      `• H4 + H1 harus searah`,
      `• Entry saat rejection candle M5 kuat`,
      `• Konfirmasi via BOS, CHOCH, Liquidity Sweep`,
      `• Hindari spike & volatilitas ekstrem`, ``,
      `━━━━━━━━━━━━━━━━━━`,
      `⚙️ <b>RISK MANAGEMENT</b>`, ``,
      `🛑 SL      : 40 pips`,
      `💰 TP1     : 60 pips`,
      `💰 TP2     : 125 pips`,
      `🔒 BE Trigger: ≥ 28 pips dari entry`, ``,
      `━━━━━━━━━━━━━━━━━━`,
      `💼 <b>MONEY MANAGEMENT</b>`, ``,
      `/balance     — set balance trading`,
      `/risk        — set risk %`,
      `/broker      — set broker (HFM, Exness, XM...)`,
      `/lot         — toggle auto/manual MM`,
      `/profile     — lihat trading profile`, ``,
      `━━━━━━━━━━━━━━━━━━`,
      `⚡ <i>AZZAVISION AI | XAUUSD Premium Bot v3.2.1</i>`,
    ].join('\n');
    await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: backButton() });
  });

  registerAction(bot, 'menu_bt7',  (ctx) => runBacktestCb(ctx, 7));
  registerAction(bot, 'menu_bt30', (ctx) => runBacktestCb(ctx, 30));

  registerAction(bot, 'menu_forcebuy', async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery('🚫 Owner only!', { show_alert: true });
    await ctx.answerCbQuery('🟢 Membuat sinyal BUY...', { show_alert: false });
    await handleForce(ctx, bot, 'BUY');
  });

  registerAction(bot, 'menu_forcesell', async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery('🚫 Owner only!', { show_alert: true });
    await ctx.answerCbQuery('🔴 Membuat sinyal SELL...', { show_alert: false });
    await handleForce(ctx, bot, 'SELL');
  });

  registerAction(bot, 'menu_refresh', async (ctx) => {
    await ctx.answerCbQuery('🔄 Memperbarui harga...', { show_alert: false });
    try {
      const name  = ctx.from?.first_name || 'Trader';
      const owner = isOwner(ctx);
      const { text, keyboard } = await buildStartMessage(name, owner);
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch {
      await ctx.answerCbQuery('❌ Gagal refresh harga', { show_alert: true });
    }
  });

  registerAction(bot, 'menu_back', async (ctx) => {
    await ctx.answerCbQuery('🏠 Kembali ke menu...', { show_alert: false });
    try {
      const name  = ctx.from?.first_name || 'Trader';
      const owner = isOwner(ctx);
      const { text, keyboard } = await buildStartMessage(name, owner);
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch {
      await ctx.answerCbQuery('❌ Gagal', { show_alert: true });
    }
  });

  // ── 💼 Money Management inline button ─────────────────────────────────────
  registerAction(bot, 'menu_mm', async (ctx) => {
    await answerLoading(ctx, '💼 Memuat money management...');
    try {
      const userId  = String(ctx.from?.id || '');
      const message = formatProfileMessage(userId);
      await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
    } catch (err) {
      await ctx.editMessageText(`❌ Gagal memuat profile.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
    }
  });

  // ── v3.4 Trade History + AI Replay callbacks ──────────────────────────────

  // Dynamic pattern: replay_<id>
  bot.action(/^replay_(\d+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    registeredActions.add(`replay_${id}`);
    await ctx.answerCbQuery('📖 Generating AI Replay...', { show_alert: false }).catch(() => {});
    try {
      const { getSignalById } = require('../database/db');
      const { generateTradeReplay } = require('./commands/tradejournal');
      const signal = await getSignalById(id);
      if (!signal) return ctx.reply(`❌ Trade #${id} tidak ditemukan.`);
      if (signal.status === 'OPEN') return ctx.reply(`⏳ Trade #${id} masih OPEN.`);
      const loadMsg = await ctx.reply(`⏳ <b>Generating AI Replay untuk Trade #${id}...</b>`, { parse_mode: 'HTML' }).catch(() => null);
      const replayMsg = await generateTradeReplay(signal);
      if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
      const { Markup } = require('telegraf');
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❓ Tanya AI', `tradeask_start_${id}`), Markup.button.callback('📊 Detail', `tradedetail_${id}`)],
      ]);
      await ctx.replyWithHTML(replayMsg, keyboard);
    } catch (err) {
      await ctx.reply(`❌ Gagal AI Replay.\n${err.message}`);
    }
  });

  // Dynamic pattern: tradedetail_<id>
  bot.action(/^tradedetail_(\d+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    registeredActions.add(`tradedetail_${id}`);
    await ctx.answerCbQuery('📊 Memuat detail...', { show_alert: false }).catch(() => {});
    try {
      const { getSignalById } = require('../database/db');
      const { isoToWIBShort } = require('../utils/wib_time');
      const signal = await getSignalById(id);
      if (!signal) return ctx.reply(`❌ Trade #${id} tidak ditemukan.`);
      const snapshot = signal.snapshot || {};
      const pips     = signal.pips || 0;
      const pipSign  = pips >= 0 ? '+' : '';
      const h4  = snapshot.h4  || signal.h4_bias  || 'N/A';
      const h1  = snapshot.h1  || signal.h1_bias  || 'N/A';
      const m15 = snapshot.m15 || signal.m15_bias || 'N/A';
      const m5  = snapshot.m5  || signal.m5_signal || 'N/A';
      const m1  = snapshot.m1  || signal.m1_bias  || 'N/A';
      const session    = snapshot.session    || signal.session    || 'N/A';
      const volatility = snapshot.volatility || signal.volatility || 'N/A';
      const stratName  = signal.strategy || 'Multi-Strategy';
      const newsSum    = snapshot.news_summary || signal.news_summary || 'N/A';
      const entryR     = snapshot.entry_reasons || signal.entry_reasons || 'N/A';
      const openDate   = signal.created_at ? isoToWIBShort(signal.created_at) : '—';
      const closeDate  = signal.closed_at  ? isoToWIBShort(signal.closed_at)  : '—';
      const statusEmoji = signal.status === 'WIN' ? '✅' : signal.status === 'LOSS' ? '❌' : '🔒';
      const { Markup } = require('telegraf');
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📖 AI Replay', `replay_${id}`), Markup.button.callback('❓ Tanya AI', `tradeask_start_${id}`)],
        [Markup.button.callback('📈 Strategy Stats', `stratstat_trade_${id}`)],
      ]);
      await ctx.replyWithHTML([
        `━━━━━━━━━━━━━━━━━━`,
        `📊 <b>TRADE DETAIL #${id}</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `${statusEmoji} <b>${signal.status}</b>  |  ${signal.direction}  |  ${pipSign}${pips} pips`,
        ``,
        `📌 Entry     : <code>${signal.entry}</code>`,
        `🎯 TP1       : <code>${signal.tp1}</code>`,
        `🎯 TP2       : <code>${signal.tp2}</code>`,
        `🛑 SL        : <code>${signal.sl}</code>`,
        `💹 Close     : <code>${signal.close_price || 'N/A'}</code>`,
        ``,
        `📊 <b>Snapshot Saat Entry</b>`,
        `H4       : <code>${h4}</code>`,
        `H1       : <code>${h1}</code>`,
        `M15      : <code>${m15}</code>`,
        `M5       : <code>${m5}</code>`,
        `M1       : <code>${m1}</code>`,
        `Conf     : <code>${signal.confidence}%</code>`,
        `Strategy : <code>${stratName}</code>`,
        `Session  : <code>${session}</code>`,
        `Vol      : <code>${volatility}</code>`,
        ``,
        `📅 Open  : <code>${openDate}</code>`,
        `📅 Close : <code>${closeDate}</code>`,
        ``,
        `📰 News  : ${newsSum}`,
        ``,
        `🎯 Alasan Entry:`,
        entryR,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `⚡ <i>AZZAVISION AI — Trade Database</i>`,
      ].join('\n'), keyboard);
    } catch (err) {
      await ctx.reply(`❌ Gagal memuat detail.\n${err.message}`);
    }
  });

  // Dynamic pattern: tradeask_start_<id>  (prompt owner to type question)
  bot.action(/^tradeask_start_(\d+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    registeredActions.add(`tradeask_start_${id}`);
    await ctx.answerCbQuery('❓ Tanya AI siap!', { show_alert: false }).catch(() => {});
    try {
      const { setPendingQuestion } = require('./commands/tradeask');
      const { getSignalById } = require('../database/db');
      const signal = await getSignalById(id);
      if (!signal) return ctx.reply(`❌ Trade #${id} tidak ditemukan.`);
      setPendingQuestion(ctx.from.id, id);
      await ctx.replyWithHTML([
        `❓ <b>TANYA AI — Trade #${id}</b>`,
        ``,
        `<b>Hasil   :</b> <code>${signal.status} (${signal.pips >= 0 ? '+' : ''}${signal.pips} pips)</code>`,
        `<b>Direction:</b> <code>${signal.direction}</code>`,
        `<b>Entry  :</b> <code>${signal.entry}</code>`,
        ``,
        `Ketik pertanyaanmu sekarang. Contoh:`,
        `• <i>Kenapa AI memilih ${signal.direction}?</i>`,
        `• <i>Apakah entry bisa lebih bagus?</i>`,
        `• <i>Apa kelemahan trade ini?</i>`,
        `• <i>Kalau SL lebih ketat bagaimana?</i>`,
        ``,
        `⏰ <i>Pertanyaan kedaluwarsa dalam 5 menit.</i>`,
      ].join('\n'));
    } catch (err) {
      await ctx.reply(`❌ Gagal.\n${err.message}`);
    }
  });

  // Dynamic pattern: stratstat_trade_<id>
  bot.action(/^stratstat_trade_(\d+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    registeredActions.add(`stratstat_trade_${id}`);
    await ctx.answerCbQuery('📈 Memuat strategy stats...', { show_alert: false }).catch(() => {});
    try {
      const { getSignalById } = require('../database/db');
      const { getAllStrategyStats } = require('../database/strategy_stats');
      const { toWIB } = require('../utils/wib_time');
      const signal = await getSignalById(id);
      const stratName = signal?.strategy || 'Multi-Strategy';
      const allStats  = await getAllStrategyStats().catch(() => []);
      const wib = toWIB();
      const stratLines = allStats.length > 0
        ? allStats.slice(0, 10).map((s, i) =>
            `${i + 1}. <b>${s.name}</b>\n   ✅ ${s.wins}W | ❌ ${s.losses}L | 🔒 ${s.breakevens}BE | WR: <code>${s.winRate}%</code>`
          ).join('\n\n')
        : 'Belum ada data strategi.';
      const { Markup } = require('telegraf');
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📖 AI Replay', `replay_${id}`), Markup.button.callback('❓ Tanya AI', `tradeask_start_${id}`)],
      ]);
      await ctx.replyWithHTML([
        `━━━━━━━━━━━━━━━━━━`,
        `📈 <b>STRATEGY STATS</b>`,
        `(konteks Trade #${id} — ${stratName})`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        stratLines,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        wib.line,
        `⚡ <i>AZZAVISION AI — Strategy Analytics</i>`,
      ].join('\n'), keyboard);
    } catch (err) {
      await ctx.reply(`❌ Gagal memuat strategy stats.\n${err.message}`);
    }
  });

  // Dynamic pattern: tradehistory_page_<n>
  bot.action(/^tradehistory_page_(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    registeredActions.add(`tradehistory_page_${page}`);
    await ctx.answerCbQuery('📖 Memuat...', { show_alert: false }).catch(() => {});
    try {
      const { getAllSignals } = require('../database/db');
      const { buildHistoryText, buildButtons, PAGE_SIZE } = require('./commands/tradehistory');
      const all = await getAllSignals();
      const sorted = [...all].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
      const safePage   = Math.min(Math.max(1, page), totalPages);
      const slice      = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
      const text    = buildHistoryText(slice, safePage, totalPages);
      const buttons = buildButtons(slice, safePage, totalPages);
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...buttons });
    } catch (err) {
      await ctx.reply(`❌ Gagal memuat halaman.\n${err.message}`);
    }
  });

  // ── Fallback: callback tanpa handler ──────────────────────────────────────
  // PENTING: gunakan `next` agar middleware chain tidak terputus untuk callback
  // yang sudah punya handler terdaftar (exp_*, scan_*, dll).
  bot.on('callback_query', async (ctx, next) => {
    const data = ctx.callbackQuery?.data || '';
    // Jika sudah terdaftar di set atau cocok pattern yang dikenal → teruskan ke handler berikutnya
    if (registeredActions.has(data)) return next();
    if (/^exp_(xls|pdf|csv)_(today|7d|30d|all)$/.test(data)) return next();
    if (['scan_refresh', 'force_buy', 'force_sell', 'scan_market', 'scan_stats', 'scan_status'].includes(data)) return next();
    if (/^(replay|tradedetail|tradeask_start|stratstat_trade|tradehistory_page)_\d+$/.test(data)) return next();

    const { logCallback } = require('./debug/callback_logger');
    const userId   = String(ctx.from?.id || 'unknown');
    const username = ctx.from?.first_name || ctx.from?.username || userId;
    logCallback(data || 'UNKNOWN', userId, username, Date.now(), 'FAILED', 'Handler not found');

    if (isOwner(ctx)) {
      await ctx.answerCbQuery('⚠️ Handler belum ada', { show_alert: true }).catch(() => {});
      await ctx.reply([
        `⚠️ <b>CALLBACK TANPA HANDLER</b>`,
        ``,
        `Callback: <code>${data}</code>`,
        `Cek via: /callbackcheck`,
      ].join('\n'), { parse_mode: 'HTML' }).catch(() => {});
    } else {
      await ctx.answerCbQuery('Fitur sedang diperbaiki.', { show_alert: true }).catch(() => {});
    }
  });
}

async function runBacktestCb(ctx, days) {
  await ctx.answerCbQuery(`⏳ Backtest ${days}hr sedang diproses...`, { show_alert: false });
  try {
    await ctx.editMessageText(
      `⏳ <b>Menjalankan backtest ${days} hari...</b>\n<i>Mohon tunggu.</i>`,
      { parse_mode: 'HTML' }
    );
    const { runBacktest }          = require('../analysis/backtest');
    const result                   = await runBacktest(days);
    const { formatBacktestResult } = require('./commands/backtest');
    const message                  = formatBacktestResult(result);
    await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: backButton() });
  } catch (err) {
    await ctx.editMessageText(`❌ Backtest gagal.\n<code>${err.message}</code>`, { parse_mode: 'HTML', reply_markup: backButton() });
  }
}

function backButton() {
  const { Markup } = require('telegraf');
  return Markup.inlineKeyboard([[Markup.button.callback('🏠 Menu Utama', 'menu_back')]]).reply_markup;
}

module.exports = { registerCallbacks, registeredActions };
