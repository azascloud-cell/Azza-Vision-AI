/**
 * watchlist_cmd.js — /watchlist command
 * Tampilkan setup yang sedang mendekati valid (early warning).
 * Menampilkan status zona pullback sebagai pengganti "M5 rejection".
 */

const { getAllTimeframes }   = require('../../market/data');
const { runStrategy }        = require('../../analysis/strategy');
const { getOverallBias }     = require('../../analysis/scanner');
const { calculateEnsemble }  = require('../../analysis/ensemble');
const { checkBlacklist }     = require('../../analysis/blacklist');
const { runAllStrategies }   = require('../../analysis/strategy_library');
const { detectPullback }     = require('../../analysis/pullback');
const { toWIB }              = require('../../utils/wib_time');

function registerWatchlist(bot) {
  bot.command('watchlist', async (ctx) => {
    const loading = await ctx.replyWithHTML('👀 <i>Memeriksa setup yang mendekati valid...</i>');
    try {
      const tfData   = await getAllTimeframes();
      const result   = runStrategy(tfData);
      const overall  = getOverallBias(result.analysis);
      const minConf  = parseInt(process.env.MIN_CONFIDENCE || '65');
      const wib      = toWIB();

      const h4Bull   = result.analysis.h4.bias.includes('BUY');
      const h1Bull   = result.analysis.h1.bias.includes('BUY');
      const h4Bear   = result.analysis.h4.bias.includes('SELL');
      const h1Bear   = result.analysis.h1.bias.includes('SELL');
      const aligned  = (h4Bull && h1Bull) || (h4Bear && h1Bear);
      const direction = (h4Bull && h1Bull) ? 'BUY' : 'SELL';

      // ── Pullback zone detection ────────────────────────────────────────────
      let pullback = null;
      try {
        const pbDir  = (h4Bull || h1Bull) ? 'BUY' : 'SELL';
        const m5Data = tfData.m5 || [];
        if (m5Data.length >= 52) {
          pullback = detectPullback(m5Data, pbDir);
        }
      } catch { /* skip pullback if error */ }

      // ── Cek kondisi yang belum/sudah terpenuhi ────────────────────────────
      const pendingConditions    = [];
      const fulfilledConditions  = [];

      if (!aligned) {
        pendingConditions.push('❌ Trend H4 + H1 belum searah');
      } else {
        fulfilledConditions.push('✅ Trend H4 + H1 searah');
      }

      if (result.spikeRisk) {
        pendingConditions.push('❌ Volatilitas terlalu tinggi (spike)');
      } else {
        fulfilledConditions.push('✅ Volatilitas normal');
      }

      // Pullback zone condition (menggantikan M5 rejection)
      if (pullback) {
        if (pullback.inZone) {
          const zoneLabel = pullback.zoneType === 'EMA20_PULLBACK'
            ? 'Zona EMA20 pullback'
            : 'Zona EMA50 pullback dalam';
          fulfilledConditions.push(`✅ ${zoneLabel} aktif`);
        } else {
          const distInfo = pullback.distance && pullback.distance > 0
            ? ` (~${pullback.distance} pips)`
            : '';
          pendingConditions.push(`❌ Harga belum di zona pullback${distInfo}`);
          if (pullback.reason) {
            pendingConditions.push(`   → ${pullback.reason}`);
          }
        }
      } else if (!result.m5Entry?.valid) {
        pendingConditions.push(`❌ Belum ada konfirmasi entry M5`);
      } else {
        fulfilledConditions.push('✅ Konfirmasi entry terpenuhi');
      }

      if (result.confidence < minConf) {
        pendingConditions.push(`❌ Confidence ${result.confidence}% (butuh ${minConf}%)`);
      } else {
        fulfilledConditions.push(`✅ Confidence ${result.confidence}%`);
      }

      // Blacklist check
      const bl = checkBlacklist(tfData);
      if (bl.blocked) {
        pendingConditions.push(...bl.reasons.map(r => `❌ ${r}`));
      } else {
        fulfilledConditions.push('✅ Kondisi market bersih');
      }

      // ── Ensemble score ─────────────────────────────────────────────────────
      let ensembleScore   = 0;
      let ensembleRanking = [];
      if (aligned && !result.spikeRisk) {
        try {
          const ensemble  = calculateEnsemble(tfData, direction);
          ensembleScore   = ensemble.totalScore;
          ensembleRanking = ensemble.ranking;
          if (ensembleScore < 75) {
            pendingConditions.push(`❌ Ensemble score ${ensembleScore}/100 (butuh 75+)`);
          } else {
            fulfilledConditions.push(`✅ Ensemble score ${ensembleScore}/100`);
          }
        } catch { /* skip */ }
      }

      // ── Strategi mendekati valid ───────────────────────────────────────────
      let approachingStrategies = [];
      try {
        const ebookSignals = runAllStrategies(tfData);
        approachingStrategies = ebookSignals
          .filter(s => s && s.confidence >= 40 && s.confidence < 65)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);
      } catch { /* skip */ }

      const readyPct     = Math.round((fulfilledConditions.length / (fulfilledConditions.length + pendingConditions.length)) * 100);
      const isAlmostReady = readyPct >= 60;

      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});

      const lines = [
        `━━━━━━━━━━━━━━━━━━`,
        `👀 <b>AZZAVISION AI — WATCHLIST</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        wib.line,
        ``,
        `📊 <b>Pair</b>: XAUUSD | <b>Bias</b>: ${overall.label}`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        `<b>STATUS: ${isAlmostReady ? '⏳ Mendekati Valid' : '🔎 Masih Menunggu'}</b>`,
        `Readiness: <code>${readyPct}%</code>`,
        ``,
      ];

      // Pullback zone summary
      if (pullback) {
        const pbEmoji = pullback.inZone ? '🎯' : '⏳';
        lines.push(`${pbEmoji} <b>Pullback Zone</b>: ${pullback.inZone ? '<b>AKTIF</b>' : 'Belum'}`);
        if (pullback.ema20) lines.push(`   EMA20: <code>${pullback.ema20.toFixed(2)}</code> | EMA50: <code>${pullback.ema50.toFixed(2)}</code>`);
        lines.push(``);
      }

      if (fulfilledConditions.length > 0) {
        lines.push(`<b>Sudah terpenuhi:</b>`);
        fulfilledConditions.forEach(c => lines.push(c));
        lines.push(``);
      }

      if (pendingConditions.length > 0) {
        lines.push(`<b>Syarat yang belum:</b>`);
        pendingConditions.forEach(c => lines.push(c));
        lines.push(``);
      }

      if (ensembleRanking.length > 0) {
        lines.push(`━━━━━━━━━━━━━━━━━━`);
        lines.push(`<b>Setup aktif saat ini:</b>`);
        const rankEmoji = ['🥇','🥈','🥉'];
        ensembleRanking.slice(0, 3).forEach((r, i) => {
          lines.push(`${rankEmoji[i] || '•'} ${r.name}: <code>${r.confidence}%</code>`);
        });
        lines.push(``);
      }

      if (approachingStrategies.length > 0) {
        lines.push(`━━━━━━━━━━━━━━━━━━`);
        lines.push(`<b>Strategi mendekati valid:</b>`);
        approachingStrategies.forEach(s => {
          lines.push(`⏳ ${s.strategyName}: <code>${s.confidence}%</code>`);
        });
        lines.push(``);
      }

      lines.push(`━━━━━━━━━━━━━━━━━━`);
      lines.push(`<b>Status:</b> ${pendingConditions.length === 0 ? '✅ Semua syarat terpenuhi!' : `Tunggu ${pendingConditions.length} kondisi lagi`}`);
      lines.push(``);
      lines.push(`💡 <i>Bot akan otomatis kirim sinyal saat semua kondisi valid.</i>`);
      lines.push(`⚡ <i>AZZAVISION AI v3.1 | Watchlist Engine</i>`);

      await ctx.replyWithHTML(lines.join('\n'));
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ Gagal cek watchlist.\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerWatchlist };
