/**
 * api_health.js — API Health Check saat startup
 * Cek koneksi ke Gemini, OpenRouter, Groq.
 * Jika gagal, log alasan. Bot tetap berjalan normal.
 */
'use strict';

const axios = require('axios');

const TIMEOUT = 10000;

async function checkGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { provider: 'groq', ok: false, message: 'No API key configured' };
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Say OK in one word' }], max_tokens: 5 },
      { headers: { Authorization: `Bearer ${key}` }, timeout: TIMEOUT }
    );
    return { provider: 'groq', ok: true, message: `OK (${res.status})` };
  } catch (e) {
    return { provider: 'groq', ok: false, message: e.response?.status ? `HTTP ${e.response.status}` : e.message };
  }
}

async function checkOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { provider: 'openrouter', ok: false, message: 'No API key configured' };
  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: 'meta-llama/llama-3.3-70b-instruct:free', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 },
      { headers: { Authorization: `Bearer ${key}`, 'HTTP-Referer': 'https://azzavision.ai', 'X-Title': 'AZZAVISION AI' }, timeout: TIMEOUT }
    );
    return { provider: 'openrouter', ok: true, message: `OK (${res.status})` };
  } catch (e) {
    return { provider: 'openrouter', ok: false, message: e.response?.status ? `HTTP ${e.response.status}` : e.message };
  }
}

async function checkGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { provider: 'gemini', ok: false, message: 'No API key configured' };
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const gen = new GoogleGenerativeAI(key);
    const m = gen.getGenerativeModel({ model: 'gemini-2.0-flash' });
    await Promise.race([
      m.generateContent('Say OK'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), TIMEOUT))
    ]);
    return { provider: 'gemini', ok: true, message: 'OK' };
  } catch (e) {
    return { provider: 'gemini', ok: false, message: e.message?.slice(0, 80) };
  }
}

async function checkAPIHealth() {
  const results = await Promise.allSettled([checkGemini(), checkOpenRouter(), checkGroq()]);
  return results.map(r => r.status === 'fulfilled' ? r.value : { provider: '?', ok: false, message: String(r.reason) });
}

module.exports = { checkAPIHealth };
