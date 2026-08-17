/**
 * LOT CALCULATOR COMMANDS — v2.0 (Broker-Aware)
 * /balance  — set balance
 * /risk     — set risk %
 * /broker   — set broker
 * /lot      — toggle auto/manual lot mode
 * /profile  — tampilkan trading profile lengkap
 */

const {
  getProfile, saveProfile, calcLot, calcPnL,
  formatMMLines, getBrokerSpec, BROKER_SPECS, SUPPORTED_BROKERS, DEFAULT_PROFILE,
} = require('../../database/user_profiles');
const { renderBanner } = require('../../banner');

const SL_PIPS  = 40;
const TP1_PIPS = 60;
const TP2_PIPS = 125;

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── /balance ─────────────────────────────────────────────────────────────────
function registerBalance(bot) {
  bot.command('balance', async (ctx) => {
    const args = ctx.message?.text?.trim().split(/\s+/);
    const raw  = args?.[1];

    if (!raw) {
      const p = getProfile(String(ctx.from.id));
      return ctx.replyWithHTML([
        `💰 <b>Balance kamu saat ini:</b> <code>$${Number(p.balance).toLocaleString('en-US')}</code>`,
        ``,
        `Untuk mengubah:`,
        `<code>/balance 500</code>`,
        `<code>/balance 1000</code>`,
      ].join('\n'));
    }

    const amount = parseFloat(raw.replace(/[,$]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return ctx.replyWithHTML(`❌ <b>Format salah.</b>\nContoh: <code>/balance 500</code>`);
    }

    const p    = saveProfile(String(ctx.from.id), { balance: amount });
    const spec = getBrokerSpec(p.broker);
    const lot  = calcLot(p, SL_PIPS);
    const sl$  = calcPnL(p, lot, SL_PIPS);
    const tp1$ = calcPnL(p, lot, TP1_PIPS);

    await ctx.replyWithHTML([
      `✅ <b>Balance tersimpan!</b>`,
      ``,
      `💰 Balance   : <code>$${amount.toLocaleString('en-US')}</code>`,
      `🏦 Broker    : <code>${spec.name}</code>`,
      `🎯 Risk      : <code>${p.risk}%</code>  → <code>$${(amount * p.risk / 100).toFixed(2)}</code>`,
      `📌 Lot (est) : <code>${lot} lot</code>`,
      `🛑 SL est    : <code>-$${sl$.toFixed(2)}</code>`,
      `🎯 TP1 est   : <code>+$${tp1$.toFixed(2)}</code>`,
      ``,
      `Ketik /profile untuk detail lengkap.`,
    ].join('\n'));
  });
}

// ─── /risk ────────────────────────────────────────────────────────────────────
function registerRisk(bot) {
  bot.command('risk', async (ctx) => {
    const args = ctx.message?.text?.trim().split(/\s+/);
    const raw  = args?.[1];

    if (!raw) {
      const p = getProfile(String(ctx.from.id));
      return ctx.replyWithHTML([
        `🎯 <b>Risk kamu saat ini:</b> <code>${p.risk}%</code>`,
        ``,
        `Untuk mengubah:`,
        `<code>/risk 0.5</code>  — 0.5%`,
        `<code>/risk 1</code>    — 1%`,
        `<code>/risk 2</code>    — 2%`,
      ].join('\n'));
    }

    const pct = parseFloat(raw.replace('%', ''));
    if (isNaN(pct) || pct <= 0 || pct > 10) {
      return ctx.replyWithHTML(`❌ <b>Risk tidak valid.</b>\nMasukkan antara 0.1 – 10.\nContoh: <code>/risk 1</code>`);
    }

    const p    = saveProfile(String(ctx.from.id), { risk: pct });
    const spec = getBrokerSpec(p.broker);
    const lot  = calcLot(p, SL_PIPS);
    const sl$  = calcPnL(p, lot, SL_PIPS);
    const tp1$ = calcPnL(p, lot, TP1_PIPS);

    try {
      const buffer = await renderBanner('risk_management', {
        rows: [
          { label: 'Risk per Trade', value: `${pct}%` },
          { label: 'Broker', value: spec.name },
          { label: 'Balance', value: `${Number(p.balance).toLocaleString('en-US')}` },
          { label: 'Suggested Lot', value: `${lot} lot` },
          { label: 'SL Estimasi', value: `-${sl$.toFixed(2)}` },
          { label: 'TP1 Estimasi', value: `+${tp1$.toFixed(2)}` },
        ],
      });
      await ctx.replyWithPhoto({ source: buffer });
    } catch (bannerErr) {
      console.error('[RISK-BANNER] Gagal render banner:', bannerErr.message);
    }

    await ctx.replyWithHTML([
      `✅ <b>Risk tersimpan!</b>`,
      ``,
      `🎯 Risk      : <code>${pct}%</code>  → <code>$${(Number(p.balance) * pct / 100).toFixed(2)}</code>`,
      `🏦 Broker    : <code>${spec.name}</code>`,
      `💰 Balance   : <code>$${Number(p.balance).toLocaleString('en-US')}</code>`,
      `📌 Lot (est) : <code>${lot} lot</code>`,
      `🛑 SL est    : <code>-$${sl$.toFixed(2)}</code>`,
      `🎯 TP1 est   : <code>+$${tp1$.toFixed(2)}</code>`,
      ``,
      `Ketik /profile untuk detail lengkap.`,
    ].join('\n'));
  });
}

// ─── /broker ──────────────────────────────────────────────────────────────────
function registerBroker(bot) {
  bot.command('broker', async (ctx) => {
    const args = ctx.message?.text?.trim().split(/\s+/);
    const raw  = (args?.[1] || '').toLowerCase().replace(/\s+/g, '');

    if (!raw) {
      const p       = getProfile(String(ctx.from.id));
      const current = getBrokerSpec(p.broker);
      const list    = SUPPORTED_BROKERS.map(k => {
        const s   = BROKER_SPECS[k];
        const dot = k === p.broker ? '✅' : '⬜';
        return `${dot} <code>/broker ${k}</code>  — ${s.name}`;
      }).join('\n');

      return ctx.replyWithHTML([
        `━━━━━━━━━━━━━━━━━━`,
        `🏦 <b>BROKER SETTING</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `Broker aktif: <b>${current.name}</b>`,
        `Pip Value   : <code>$${current.pip_value}</code> /lot/pip`,
        ``,
        `<b>Ganti broker:</b>`,
        ``,
        list,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `<i>Semua broker menggunakan XAUUSD.</i>`,
      ].join('\n'));
    }

    // Normalize input: icmarkets / ic_markets / ic-markets → icmarkets
    const normalized = raw.replace(/[-_\s]/g, '');
    if (!BROKER_SPECS[normalized]) {
      const list = SUPPORTED_BROKERS.join(', ');
      return ctx.replyWithHTML([
        `❌ <b>Broker tidak dikenal.</b>`,
        ``,
        `Broker yang tersedia:`,
        `<code>${list}</code>`,
        ``,
        `Contoh: <code>/broker hfm</code>`,
      ].join('\n'));
    }

    const p    = saveProfile(String(ctx.from.id), { broker: normalized });
    const spec = getBrokerSpec(normalized);
    const lot  = calcLot(p, SL_PIPS);
    const sl$  = calcPnL(p, lot, SL_PIPS);
    const tp1$ = calcPnL(p, lot, TP1_PIPS);
    const tp2$ = calcPnL(p, lot, TP2_PIPS);

    await ctx.replyWithHTML([
      `✅ <b>Broker tersimpan!</b>`,
      ``,
      `🏦 Broker    : <b>${spec.name}</b>`,
      `📐 Pip Value : <code>$${spec.pip_value}</code> /lot/pip`,
      `💰 Balance   : <code>$${Number(p.balance).toLocaleString('en-US')}</code>`,
      `🎯 Risk      : <code>${p.risk}%</code>`,
      ``,
      `📌 <b>Estimasi (XAUUSD, SL 40 pip):</b>`,
      `   Lot : <code>${lot} lot</code>`,
      `   SL  : <code>-$${sl$.toFixed(2)}</code>`,
      `   TP1 : <code>+$${tp1$.toFixed(2)}</code>`,
      `   TP2 : <code>+$${tp2$.toFixed(2)}</code>`,
      ``,
      `Money Management akan otomatis diperbarui di setiap sinyal.`,
    ].join('\n'));
  });
}

// ─── /lot ─────────────────────────────────────────────────────────────────────
function registerLotMode(bot) {
  bot.command('lot', async (ctx) => {
    const args = ctx.message?.text?.trim().split(/\s+/);
    const mode = (args?.[1] || '').toLowerCase();

    if (mode !== 'auto' && mode !== 'manual') {
      const p = getProfile(String(ctx.from.id));
      return ctx.replyWithHTML([
        `⚙️ <b>Lot Mode kamu:</b> <code>${p.lot_mode.toUpperCase()}</code>`,
        ``,
        `<code>/lot auto</code>   — tampilkan MM block di setiap sinyal`,
        `<code>/lot manual</code> — sembunyikan MM block`,
      ].join('\n'));
    }

    saveProfile(String(ctx.from.id), { lot_mode: mode });
    const emoji = mode === 'auto' ? '🟢' : '🟡';
    await ctx.replyWithHTML([
      `✅ <b>Lot Mode diubah!</b>`,
      ``,
      `${emoji} Mode : <code>${mode.toUpperCase()}</code>`,
      ``,
      mode === 'auto'
        ? `💼 Money Management akan tampil di setiap sinyal.`
        : `📵 Money Management <b>tidak</b> akan tampil di sinyal.`,
    ].join('\n'));
  });
}

// ─── /profile ─────────────────────────────────────────────────────────────────
function registerProfile(bot) {
  bot.command('profile', async (ctx) => {
    try {
      const p    = getProfile(String(ctx.from.id));
      const spec = getBrokerSpec(p.broker);
      const lot  = calcLot(p, SL_PIPS);
      const buffer = await renderBanner('profile', {
        rows: [
          { label: 'Broker', value: spec.name },
          { label: 'Balance', value: `${Number(p.balance).toLocaleString('en-US')}` },
          { label: 'Risk', value: `${p.risk}%` },
          { label: 'Lot Mode', value: p.lot_mode.toUpperCase() },
          { label: 'Suggested Lot', value: `${lot} lot` },
        ],
      });
      await ctx.replyWithPhoto({ source: buffer });
    } catch (bannerErr) {
      console.error('[PROFILE-BANNER] Gagal render banner:', bannerErr.message);
    }

    await ctx.replyWithHTML(formatProfileMessage(String(ctx.from.id)));
  });
}

// ─── FORMAT PROFILE FOR INLINE / HEARS ────────────────────────────────────────
function formatProfileMessage(userId) {
  const p    = getProfile(userId);
  const spec = getBrokerSpec(p.broker);
  const lot  = calcLot(p, SL_PIPS);
  const sl$  = calcPnL(p, lot, SL_PIPS);
  const tp1$ = calcPnL(p, lot, TP1_PIPS);
  const tp2$ = calcPnL(p, lot, TP2_PIPS);
  const riskAmt = (Number(p.balance) * p.risk / 100).toFixed(2);
  const rrTp1   = (tp1$ / sl$).toFixed(2);
  const rrTp2   = (tp2$ / sl$).toFixed(2);
  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return [
    `━━━━━━━━━━━━━━━━━━`,
    `👤 <b>TRADING PROFILE</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🏦 <b>Broker</b>   : <code>${spec.name}</code>`,
    `🪙 <b>Pair</b>     : <code>XAUUSD</code>`,
    `💰 <b>Balance</b>  : <code>$${fmt(Number(p.balance))}</code>`,
    `🎯 <b>Risk</b>     : <code>${p.risk}%</code>  (<code>$${riskAmt}</code>)`,
    `⚙️ <b>Lot Mode</b> : <code>${p.lot_mode.toUpperCase()}</code>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `💼 <b>MONEY MANAGEMENT</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📌 <b>Suggested Lot</b> : <code>${lot} lot</code>`,
    ``,
    `🛑 Jika SL <code>(${SL_PIPS} pips)</code> terkena`,
    `   ≈ <b>-$${fmt(sl$)}</b>`,
    ``,
    `🎯 Jika TP1 <code>(${TP1_PIPS} pips)</code>`,
    `   ≈ <b>+$${fmt(tp1$)}</b>`,
    ``,
    `🚀 Jika TP2 <code>(${TP2_PIPS} pips)</code>`,
    `   ≈ <b>+$${fmt(tp2$)}</b>`,
    ``,
    `📐 <b>Risk : Reward</b>`,
    `   TP1 = 1 : ${rrTp1}`,
    `   TP2 = 1 : ${rrTp2}`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `📋 <b>Commands:</b>`,
    `<code>/balance</code>   <code>/risk</code>   <code>/broker</code>   <code>/lot</code>`,
  ].join('\n');
}

// ─── REGISTER ALL ─────────────────────────────────────────────────────────────
function registerLotCalc(bot) {
  registerBalance(bot);
  registerRisk(bot);
  registerBroker(bot);
  registerLotMode(bot);
  registerProfile(bot);
}

module.exports = { registerLotCalc, formatProfileMessage };
