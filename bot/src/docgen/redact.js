/**
 * redact.js — Credential Sensor untuk Developer Documentation Generator
 *
 * SEMUA data yang lewat dokumentasi WAJIB melalui modul ini sebelum
 * ditulis ke PDF. Tidak ada pengecualian.
 *
 * Disensor otomatis:
 *  - Object key yang mengandung: token, key, secret, password, cookie,
 *    session, auth, credential
 *  - String value yang match pola token dikenal (gsk_, sk-, AIza,
 *    Telegram bot token, hex/base64 panjang, dst.)
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const SENSITIVE_KEY_RE = /(token|api[_-]?key|secret|password|passwd|cookie|session|auth|credential|^key$|^keys$)/i;

// Pola token yang dikenal umum di dunia nyata.
const TOKEN_PATTERNS = [
  /\bgsk_[A-Za-z0-9]{10,}\b/g,                 // Groq
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,                // OpenAI-style
  /\bAIza[A-Za-z0-9_-]{10,}\b/g,               // Google API key
  /\b\d{6,10}:[A-Za-z0-9_-]{30,}\b/g,          // Telegram bot token
  /\bor-[A-Za-z0-9-]{10,}\b/g,                 // OpenRouter
  /\b[a-f0-9]{32,}\b/gi,                       // long hex secrets/hashes
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,             // long base64 blobs
];

function maskToken(match) {
  if (match.length <= 8) return '***REDACTED***';
  return `${match.slice(0, 3)}***REDACTED***${match.slice(-2)}`;
}

/** Sensor token yang menempel di dalam sebuah string bebas (mis. baris source code). */
function maskString(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  for (const re of TOKEN_PATTERNS) {
    out = out.replace(re, maskToken);
  }
  return out;
}

/**
 * Sensor rekursif untuk struktur JSON (object/array/primitive).
 * Jika `key` yang membawa `value` cocok pola sensitif, seluruh value
 * disensor tanpa peduli tipenya (string/array/object).
 */
function redactJson(value, key = '') {
  if (key && SENSITIVE_KEY_RE.test(key)) {
    return summarizeRedacted(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactJson(v, key));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactJson(v, k);
    }
    return out;
  }
  if (typeof value === 'string') {
    return maskString(value);
  }
  return value;
}

function summarizeRedacted(value) {
  if (Array.isArray(value)) return `[REDACTED — ${value.length} item(s)]`;
  if (value && typeof value === 'object') return `[REDACTED — object]`;
  return '[REDACTED]';
}

/** Sensor teks bebas (dipakai untuk source code / .env.example). */
function redactText(text) {
  return maskString(text);
}

module.exports = { redactJson, redactText, maskString, SENSITIVE_KEY_RE };
