/**
 * telegram_safe.js — Global Telegram Parse Protection
 *
 * Mencegah 400 Bad Request: can't parse entities / Unsupported start tag
 * Semua output AI dan teks dinamis WAJIB diproses melalui helper ini.
 *
 * AZZAVISION AI v4.0
 */

const { debugLog } = require('./debug_mode');

// ─── HTML ESCAPE ──────────────────────────────────────────────────────────────
/**
 * Escape karakter HTML berbahaya untuk parse_mode: 'HTML'
 * Mencegah: &, <, >, " (urutan: & harus pertama)
 */
function escapeHTML(text) {
  if (typeof text !== 'string') text = String(text ?? '');
  return text
    .replace(/&/g, '&amp;')   // & harus PERTAMA sebelum yang lain
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;'); // single quote — extra safety
}

// ─── MARKDOWNV2 ESCAPE ────────────────────────────────────────────────────────
/**
 * Escape semua karakter reserved MarkdownV2
 */
function escapeMarkdownV2(text) {
  if (typeof text !== 'string') text = String(text ?? '');
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ─── SAFE TELEGRAM TEXT ───────────────────────────────────────────────────────
/**
 * safeTelegramText(text) — Proses teks agar aman dikirim ke Telegram
 *
 * Mode default: strip semua tag HTML lalu escape karakter berbahaya.
 * Gunakan ini untuk semua output AI (Groq, OpenRouter, Gemini).
 *
 * @param {string} text - Teks mentah dari AI atau sumber lain
 * @returns {string} - Teks aman untuk plain_text / HTML Telegram
 */
function safeTelegramText(text) {
  if (typeof text !== 'string') text = String(text ?? '');

  // Strip markdown bold/italic/code yang tidak diinginkan di plain text
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')       // *italic* → italic
    .replace(/`{3}[\s\S]*?`{3}/g, m => m.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .replace(/`(.+?)`/g, (_, c) => `<code>${escapeHTML(c)}</code>`);

  // Escape HTML tags yang tidak kita buat sendiri
  // Simpan tag HTML valid yang kita miliki
  const allowedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  const tagPattern  = new RegExp(`<(?!/?(?:${allowedTags.join('|')})(?:\\s|>))[^>]+>`, 'gi');
  text = text.replace(tagPattern, m => escapeHTML(m));

  return text;
}

/**
 * safeHTML(text) — Escape semua HTML, hasilkan plain text yang aman di parse_mode HTML
 * Gunakan ketika teks sudah di-wrap tag HTML kamu sendiri dan isinya harus aman.
 */
function safeHTML(text) {
  return escapeHTML(text);
}

// ─── SAFE SEND WRAPPERS ───────────────────────────────────────────────────────
/**
 * safeSend(ctx, text, extra?) — Kirim pesan HTML dengan fallback ke plain text
 *
 * Jika parse gagal (400 Bad Request), otomatis kirim ulang sebagai plain text
 * dan log error lengkap. Bot tidak pernah crash karena parse error.
 *
 * @param {object} ctx - Telegraf context
 * @param {string} text - Teks HTML
 * @param {object} extra - Extra options (keyboard, dll)
 */
async function safeSend(ctx, text, extra = {}) {
  try {
    return await ctx.replyWithHTML(text, extra);
  } catch (err) {
    if (err.description?.includes('parse') || err.description?.includes('Bad Request')) {
      debugLog('ERROR', `Parse error dalam safeSend: ${err.description}`);
      console.error('[TELEGRAM_SAFE] Parse error, fallback ke plain text:', err.description);
      try {
        // Fallback: strip semua HTML tags, kirim sebagai plain text
        const plainText = text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        return await ctx.reply(plainText, extra);
      } catch (err2) {
        console.error('[TELEGRAM_SAFE] Fallback plain text juga gagal:', err2.message);
      }
    } else {
      throw err;
    }
  }
}

/**
 * safeSendTo(telegram, chatId, text, extra?) — Kirim ke chat ID tertentu dengan fallback
 */
async function safeSendTo(telegram, chatId, text, extra = {}) {
  try {
    return await telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
  } catch (err) {
    if (err.description?.includes('parse') || err.description?.includes('Bad Request')) {
      debugLog('ERROR', `Parse error dalam safeSendTo (${chatId}): ${err.description}`);
      console.error('[TELEGRAM_SAFE] Parse error safeSendTo, fallback:', err.description);
      try {
        const plainText = text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        return await telegram.sendMessage(chatId, plainText, extra);
      } catch (err2) {
        console.error('[TELEGRAM_SAFE] safeSendTo fallback gagal:', err2.message);
      }
    } else {
      throw err;
    }
  }
}

/**
 * safeEditMessage(ctx, text, extra?) — Edit pesan dengan fallback
 */
async function safeEditMessage(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra });
  } catch (err) {
    if (err.description?.includes('parse') || err.description?.includes('Bad Request')) {
      debugLog('ERROR', `Parse error dalam safeEditMessage: ${err.description}`);
      console.error('[TELEGRAM_SAFE] Parse error safeEditMessage, fallback:', err.description);
      try {
        const plainText = text.replace(/<[^>]+>/g, '');
        return await ctx.editMessageText(plainText, extra);
      } catch (err2) {
        console.error('[TELEGRAM_SAFE] safeEditMessage fallback gagal:', err2.message);
      }
    } else {
      throw err;
    }
  }
}

/**
 * safeSendPhoto(telegram, chatId, photo, caption?, extra?) — Kirim foto dengan caption aman
 */
async function safeSendPhoto(telegram, chatId, photo, caption = '', extra = {}) {
  const safeCaption = safeTelegramText(caption).substring(0, 1024);
  try {
    return await telegram.sendPhoto(chatId, photo, { caption: safeCaption, parse_mode: 'HTML', ...extra });
  } catch (err) {
    if (err.description?.includes('parse') || err.description?.includes('Bad Request')) {
      debugLog('ERROR', `Parse error dalam safeSendPhoto: ${err.description}`);
      const plainCaption = safeCaption.replace(/<[^>]+>/g, '');
      try {
        return await telegram.sendPhoto(chatId, photo, { caption: plainCaption, ...extra });
      } catch (err2) {
        console.error('[TELEGRAM_SAFE] safeSendPhoto fallback gagal:', err2.message);
      }
    } else {
      throw err;
    }
  }
}

module.exports = {
  escapeHTML,
  escapeMarkdownV2,
  safeTelegramText,
  safeHTML,
  safeSend,
  safeSendTo,
  safeEditMessage,
  safeSendPhoto,
};
