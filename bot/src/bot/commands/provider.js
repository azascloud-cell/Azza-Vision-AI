/**
 * provider.js — AI Provider Management Command
 *
 * /provider            → Tampilkan provider aktif & fallback chain
 * /provider set groq   → Set provider utama ke Groq
 * /provider set openrouter → Set OpenRouter
 * /provider set gemini → Set Gemini
 * /provider auto       → Kembali ke mode otomatis (Groq → OR → Gemini)
 *
 * OWNER ONLY.
 */

'use strict';

const km     = require('../../analysis/ai_key_manager');
const engine = require('../../analysis/ai_engine');

const PROVIDER_MEDALS = ['🥇', '🥈', '🥉'];
const PROVIDER_EMOJI  = { groq: '⚡', openrouter: '🌐', gemini: '💎' };

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

function buildProviderStatus() {
  const cfg   = km.getProviderConfig();
  const order = engine.getProviderOrder();
  const dash  = km.getDashboard();
  const lines = [];

  lines.push(`🔄 <b>AI PROVIDER STATUS</b>`, ``);

  order.forEach((p, i) => {
    const medal  = PROVIDER_MEDALS[i] || `${i + 1}.`;
    const emoji  = PROVIDER_EMOJI[p] || '•';
    const d      = dash[p];
    const active = d?.active || 0;
    const total  = d?.total  || 0;
    const label  = i === 0 ? ' ← <b>AKTIF</b>' : (i === 1 ? ' ← fallback 1' : ' ← fallback 2');
    lines.push(`${medal} ${emoji} <code>${p.toUpperCase()}</code>${label}`);
    lines.push(`   Keys: <code>${active} active / ${total} total</code>`);
  });

  lines.push(``);
  lines.push(`📋 Mode: <code>${cfg.mode === 'manual' ? 'Manual (/provider set)' : 'Auto (priority chain)'}</code>`);

  if (cfg.mode === 'auto') {
    lines.push(`💡 Gunakan <code>/provider set &lt;provider&gt;</code> untuk override.`);
  } else {
    lines.push(`💡 Gunakan <code>/provider auto</code> untuk kembali ke mode otomatis.`);
  }

  return lines.join('\n');
}

function registerProvider(bot) {
  bot.command('provider', async (ctx) => {
    if (String(ctx.from?.id) !== String(process.env.OWNER_ID)) {
      return ctx.replyWithHTML('⛔ <b>Akses ditolak.</b> Command ini hanya untuk OWNER.');
    }

    const text  = ctx.message?.text || '';
    const parts = text.trim().split(/\s+/);
    const sub   = (parts[1] || '').toLowerCase();
    const arg   = (parts[2] || '').toLowerCase();

    try {
      // /provider (no args)
      if (!sub) {
        return ctx.replyWithHTML(buildProviderStatus());
      }

      // /provider set <provider>
      if (sub === 'set') {
        const VALID = ['groq', 'openrouter', 'gemini'];
        if (!VALID.includes(arg)) {
          return ctx.replyWithHTML([
            `❌ Provider tidak valid.`,
            ``,
            `Gunakan:`,
            `• <code>/provider set groq</code>`,
            `• <code>/provider set openrouter</code>`,
            `• <code>/provider set gemini</code>`,
          ].join('\n'));
        }

        km.setProviderConfig(arg, 'manual');
        return ctx.replyWithHTML([
          `✅ <b>Provider utama diubah!</b>`,
          ``,
          `Provider : <code>${arg.toUpperCase()}</code>`,
          `Mode     : <code>Manual</code>`,
          `Fallback : <code>${['groq','openrouter','gemini'].filter(p=>p!==arg).join(' → ').toUpperCase()}</code>`,
          ``,
          `Gunakan <code>/provider auto</code> untuk kembali ke mode otomatis.`,
        ].join('\n'));
      }

      // /provider auto
      if (sub === 'auto') {
        km.setProviderConfig(null, 'auto');
        return ctx.replyWithHTML([
          `✅ <b>Mode Auto diaktifkan!</b>`,
          ``,
          `Priority chain:`,
          `🥇 Groq → 🥈 OpenRouter → 🥉 Gemini`,
          ``,
          `Bot akan otomatis pindah provider jika ada kegagalan.`,
        ].join('\n'));
      }

      return ctx.replyWithHTML([
        `❓ Subcommand tidak dikenal.`,
        ``,
        `• <code>/provider</code>            — lihat status`,
        `• <code>/provider set groq</code>   — set provider utama`,
        `• <code>/provider auto</code>       — mode otomatis`,
      ].join('\n'));

    } catch (err) {
      console.error('[PROVIDER CMD] Error:', err.message);
      return ctx.replyWithHTML(`❌ <b>Error:</b> <code>${err.message}</code>`);
    }
  });
}

module.exports = { registerProvider };
