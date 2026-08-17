/**
 * documentation.js — Developer Documentation Generator (Telegram command)
 *
 * Commands:
 *   /documentation                — Generate PDF lengkap
 *   /documentation overview       — Generate PDF tanpa source code
 *   /documentation source         — Generate PDF khusus source code
 *   /documentation architecture   — Generate PDF khusus arsitektur project
 *
 * Fitur ini TIDAK mengubah/menghapus sistem backup yang sudah ada
 * (lihat src/utils/backup_engine.js) — murni fitur baru dan aditif.
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const path = require('path');
const { generateDocumentation, MODE_LABELS } = require('../../docgen/generate');
const { debugLog } = require('../../utils/debug_mode');

function isOwner(ctx) {
  return String(ctx.from?.id) === String(process.env.OWNER_ID);
}

async function handleDocumentation(ctx) {
  if (!isOwner(ctx)) return ctx.replyWithHTML('🚫 <b>Akses ditolak.</b>');

  const args = (ctx.message?.text || '').split(/\s+/).slice(1);
  const mode = (args[0] || 'full').toLowerCase();

  if (!MODE_LABELS[mode]) {
    return ctx.replyWithHTML(
      [
        '❓ <b>Mode tidak dikenal.</b>',
        '',
        'Gunakan:',
        '<code>/documentation</code> — PDF lengkap',
        '<code>/documentation overview</code> — tanpa source code',
        '<code>/documentation source</code> — khusus source code',
        '<code>/documentation architecture</code> — khusus arsitektur',
      ].join('\n')
    );
  }

  const loadingMsg = await ctx.replyWithHTML(
    `⏳ <b>Membuat Developer Documentation</b> (${MODE_LABELS[mode]})...\n<i>Bisa memakan waktu beberapa saat, terutama untuk mode lengkap/source.</i>`
  );

  try {
    const root = path.resolve(__dirname, '../../..');
    const outputPath = path.join(root, `AzzaVisionAI_Project_Documentation_${mode}.pdf`);
    const result = await generateDocumentation({ mode, outputPath, root });

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      [
        '✅ <b>DOKUMENTASI SELESAI</b>',
        '',
        `📄 Mode      : ${MODE_LABELS[mode]}`,
        `📑 Halaman   : ${result.totalPages}`,
        `📁 Total File: ${result.totalFiles}`,
        `💻 Source    : ${result.sourceFileCount} file`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    ).catch(() => {});

    await ctx.telegram.sendDocument(ctx.chat.id, {
      source: result.outputPath,
      filename: 'AzzaVisionAI_Project_Documentation.pdf',
    }, { caption: `📚 ${MODE_LABELS[mode]}` });

    debugLog('DOCGEN', `/documentation ${mode} oleh owner — ${result.totalPages} halaman.`);
  } catch (err) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `❌ <b>Gagal membuat dokumentasi:</b>\n<code>${err.message}</code>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
    console.error('[DOCGEN] Error:', err);
  }
}

function registerDocumentationCommands(bot) {
  bot.command('documentation', handleDocumentation);
  console.log('[DOCGEN] ✅ Documentation commands registered: /documentation [overview|source|architecture]');
}

module.exports = { registerDocumentationCommands };
