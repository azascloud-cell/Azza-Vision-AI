/**
 * gemini.js — AI Adapter Layer (v3.2)
 *
 * Semua fungsi tetap tersedia dengan signature yang SAMA seperti sebelumnya,
 * sehingga scanner.js, why.js, ai.js, dan semua caller tidak perlu diubah.
 *
 * PERUBAHAN v3.2: Semua pemanggilan AI sekarang diarahkan ke ai_engine.js
 * (Multi AI Engine Manager: Groq → OpenRouter → Gemini) sebagai ganti
 * pemanggilan langsung ke Google Generative AI.
 *
 * Fail-safe tetap berlaku: setiap fungsi return null jika AI tidak tersedia.
 */

'use strict';

const engine = require('./ai_engine');

// ─── 1. VALIDATE SIGNAL ───────────────────────────────────────────────────────
/**
 * Validasi kandidat sinyal sebelum dikirim ke channel.
 * Dipanggil dari scanner.js SEBELUM insertSignal.
 *
 * @returns {Promise<{verdict, score, reasons, advice, tp_sl}|null>}
 */
async function validateSignalWithGemini(signalData, analysis) {
  try {
    return await engine.reviewSignal(signalData, analysis);
  } catch (e) {
    console.warn('[GEMINI-ADAPTER] validateSignalWithGemini fail-safe:', e.message);
    return null;
  }
}

// ─── 2. MARKET INSIGHT (untuk /ai command) ────────────────────────────────────
/**
 * @returns {Promise<{verdict, score, summary, reasons, advice, next_catalyst}|null>}
 */
async function getMarketInsight(result, overall) {
  try {
    return await engine.reviewMarket(result, overall);
  } catch (e) {
    console.warn('[GEMINI-ADAPTER] getMarketInsight fail-safe:', e.message);
    return null;
  }
}

// ─── 3. WHY EXPLANATION (untuk /why command) ──────────────────────────────────
/**
 * @returns {Promise<{explanation, suggestion}|null>}
 */
async function getWhyExplanation(result, reasons, overall) {
  try {
    return await engine.reviewWhy(result, reasons, overall);
  } catch (e) {
    console.warn('[GEMINI-ADAPTER] getWhyExplanation fail-safe:', e.message);
    return null;
  }
}

// ─── 4. ANSWER QUESTION (untuk /ai dengan pertanyaan) ─────────────────────────
/**
 * @returns {Promise<string|null>}
 */
async function answerQuestion(question, marketContext) {
  try {
    return await engine.chatAI(question, marketContext);
  } catch (e) {
    console.warn('[GEMINI-ADAPTER] answerQuestion fail-safe:', e.message);
    return null;
  }
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function getGeminiStatus() {
  const status = engine.getEngineStatus();
  const geminiKeys = status.keys?.gemini || {};
  // Kompatibel dengan caller lama yang membaca .enabled dan .model
  return {
    enabled:     Object.keys(status.keys || {}).some(p => (status.keys[p]?.active || 0) > 0),
    model:       process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    initialized: true,
    engine:      status,
  };
}

module.exports = {
  validateSignalWithGemini,
  getMarketInsight,
  getWhyExplanation,
  answerQuestion,
  getGeminiStatus,
};
