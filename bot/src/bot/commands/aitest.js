/**
 * aitest.js — /aitest
 *
 * Admin command: test semua AI provider dan tampilkan status,
 * latency, model, dan SDK version yang digunakan.
 */

'use strict';

const { testAllKeys, getEngineStatus, getProviderOrder } = require('../../analysis/ai_engine');
const { toWIB } = require('../../utils/wib_time');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

// ─── SDK VERSIONS ─────────────────────────────────────────────────────────────
function getSdkVersions() {
  const versions = {};
  try {
    versions.axios = require('axios').VERSION || require('axios/package.json').version || '?';
  } catch { versions.axios = '?'; }
  try {
    versions['@google/generative-ai'] = require('@google/generative-ai/package.json').version || '?';
  } catch { versions['@google/generative-ai'] = '?'; }
  try {
    versions.telegraf = require('telegraf/package.json').version || '?';
  } catch { versions.telegraf = '?'; }
  return versions;
}

// ─── PROVIDER DISPLAY ─────────────────────────────────────────────────────────
function providerEmoji(provider) {
  if (provider === 'groq')       return '⚡';
  if (provider === 'openrouter') return '🌐';
  if (provider === 'gemini')     return '✨';
  return '🤖';
}

// ─── REGISTER COMMAND ─────────────────────────────────────────────────────────
function registerAiTest(bot) {
  bot.command('aitest', async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.replyWithHTML('🚫 <b>Perintah ini hanya untuk owner.</b>');
    }

    const loadMsg = await ctx.replyWithHTML([
      `⏳ <b>Menguji semua AI Provider...</b>`,
      ``,
      `• Groq`,
      `• Gemini`,
      `• OpenRouter`,
      ``,
      `<i>Mohon tunggu sebentar...</i>`,
    ].join('\n')).catch(() => null);

    try {
      const [results, engineStatus, sdkVersions] = await Promise.all([
        testAllKeys().catch(() => []),
        Promise.resolve(getEngineStatus()),
        Promise.resolve(getSdkVersions()),
      ]);

      const wib  = toWIB();
      const lines = [
        `━━━━━━━━━━━━━━━━━━`,
        `🤖 <b>AI PROVIDER TEST REPORT</b>`,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        wib.line,
        ``,
        `📦 <b>SDK Versions</b>`,
        `Axios              : <code>${sdkVersions.axios}</code>`,
        `@google/generative-ai: <code>${sdkVersions['@google/generative-ai']}</code>`,
        `Telegraf           : <code>${sdkVersions.telegraf}</code>`,
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `🔌 <b>Provider Priority</b>`,
        (engineStatus.providerOrder || ['groq', 'openrouter', 'gemini'])
          .map((p, i) => `${i + 1}. ${providerEmoji(p)} ${p.charAt(0).toUpperCase() + p.slice(1)}`)
          .join('\n'),
        ``,
        `━━━━━━━━━━━━━━━━━━`,
        ``,
        `📡 <b>Test Results</b>`,
        ``,
      ];

      // Group results by provider
      const byProvider = {};
      for (const r of results) {
        if (!byProvider[r.provider]) byProvider[r.provider] = [];
        byProvider[r.provider].push(r);
      }

      const providerOrder = ['groq', 'openrouter', 'gemini'];
      for (const provider of providerOrder) {
        const pResults = byProvider[provider] || [];
        const emoji    = providerEmoji(provider);
        const name     = provider.charAt(0).toUpperCase() + provider.slice(1);

        lines.push(`${emoji} <b>${name}</b>`);

        if (pResults.length === 0) {
          lines.push(`   ⬜ Tidak ada API Key terdaftar`);
        } else {
          for (const r of pResults) {
            const icon = r.status === 'OK' ? '✅' : r.status === 'TIMEOUT' ? '⏱' : '❌';
            const keyLabel = r.index === 'ENV' ? 'ENV Key' : `Key #${r.index}`;
            if (r.status === 'OK') {
              lines.push(`   ${icon} ${keyLabel}  |  <code>${r.latency}</code>`);
            } else {
              const errShort = r.error ? r.error.slice(0, 50) : r.status;
              lines.push(`   ${icon} ${keyLabel}  |  <code>${errShort}</code>`);
            }
          }
        }
        lines.push('');
      }

      // Models in use
      const models = {
        groq:       process.env.GROQ_MODEL       || 'llama-3.3-70b-versatile',
        openrouter: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
        gemini:     process.env.GEMINI_MODEL     || 'gemini-2.0-flash',
      };

      lines.push(`━━━━━━━━━━━━━━━━━━`);
      lines.push(``);
      lines.push(`🤖 <b>Models Aktif</b>`);
      lines.push(`Groq       : <code>${models.groq}</code>`);
      lines.push(`OpenRouter : <code>${models.openrouter}</code>`);
      lines.push(`Gemini     : <code>${models.gemini}</code>`);
      lines.push(``);
      lines.push(`━━━━━━━━━━━━━━━━━━`);
      lines.push(`⚡ <i>AZZAVISION AI v3.4 — AI Health Check</i>`);

      if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
      await ctx.replyWithHTML(lines.join('\n'));

    } catch (err) {
      console.error('[AITEST] Error:', err.message);
      if (loadMsg) await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => {});
      await ctx.replyWithHTML(`❌ <b>Gagal menjalankan AI test.</b>\n<code>${err.message}</code>`);
    }
  });
}

module.exports = { registerAiTest };
