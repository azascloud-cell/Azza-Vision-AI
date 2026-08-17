const fs   = require('fs').promises;
const path = require('path');
const { backupBeforeWrite } = require('../utils/backup');

const learnPath = path.resolve(process.env.LEARN_PATH || './data/learning_dataset.json');
const learnDir  = path.dirname(learnPath);

// Lazy-load getAllSignals untuk hindari circular dep
let _getAllSignals = null;
function getDb() {
  if (!_getAllSignals) {
    _getAllSignals = require('../database/db').getAllSignals;
  }
  return _getAllSignals;
}

// ─── WRITE MUTEX ──────────────────────────────────────────────────────────────
let learnQueue = Promise.resolve();

function enqueueLearnWrite(fn) {
  learnQueue = learnQueue.then(fn).catch((err) => {
    console.error('[LEARN] Write queue error:', err.message);
  });
  return learnQueue;
}

// ─── DEFAULT STRUCTURE ────────────────────────────────────────────────────────
function defaultLearnData() {
  return { entries: [] };
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function initLearnDb() {
  try {
    await fs.mkdir(learnDir, { recursive: true });
    try {
      const content = await fs.readFile(learnPath, 'utf8');
      JSON.parse(content);
    } catch {
      console.log('[LEARN] Dataset tidak ada atau rusak — membuat baru.');
      await fs.writeFile(learnPath, JSON.stringify(defaultLearnData(), null, 2), 'utf8');
    }
    console.log(`[LEARN] Dataset siap: ${learnPath}`);
  } catch (err) {
    console.error('[LEARN] Init error:', err.message);
  }
}

initLearnDb();

// ─── ATOMIC WRITE (dengan backup) ────────────────────────────────────────────
async function atomicLearnWrite(data) {
  await backupBeforeWrite(learnPath);

  const tmpPath = learnPath + `.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  try {
    await fs.rename(tmpPath, learnPath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      await fs.copyFile(tmpPath, learnPath);
      await fs.unlink(tmpPath).catch(() => {});
    } else {
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }
}

// ─── READ ─────────────────────────────────────────────────────────────────────
async function readLearnData() {
  try {
    const content = await fs.readFile(learnPath, 'utf8');
    const parsed  = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return defaultLearnData();
    if (!Array.isArray(parsed.entries)) parsed.entries = [];
    return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[LEARN] Gagal baca dataset:', err.message);
    }
    return defaultLearnData();
  }
}

// ─── SESSION DETECTOR ─────────────────────────────────────────────────────────
function getTradingSession() {
  const utcHour = new Date().getUTCHours();
  if (utcHour >= 22 || utcHour < 7)  return 'Sydney';
  if (utcHour >= 0  && utcHour < 9)  return 'Tokyo';
  if (utcHour >= 7  && utcHour < 16) return 'London';
  if (utcHour >= 13 && utcHour < 22) return 'NewYork';
  return 'Overlap';
}

// ─── IS POSITIVE OUTCOME ──────────────────────────────────────────────────────
// WIN dan TP1_BREAKEVEN keduanya adalah outcome positif untuk learning
function isPositiveResult(result) {
  return result === 'WIN' || result === 'TP1_BREAKEVEN';
}

// ─── SAVE LEARNING ENTRY ──────────────────────────────────────────────────────
async function saveLearningEntry(signalId, direction, levels, analysis) {
  return new Promise((resolve, reject) => {
    enqueueLearnWrite(async () => {
      try {
        const data = await readLearnData();

        if (data.entries.some((e) => e.signal_id === signalId)) {
          console.log(`[LEARN] Entry untuk Signal #${signalId} sudah ada — skip duplikat`);
          resolve(null);
          return;
        }

        const newId = data.entries.length > 0
          ? Math.max(...data.entries.map((e) => e.id)) + 1
          : 1;

        const h4a  = analysis?.h4  || {};
        const h1a  = analysis?.h1  || {};
        const m15a = analysis?.m15 || {};
        const m5a  = analysis?.m5  || {};
        const m1a  = analysis?.m1  || {};

        const entry = {
          id:        newId,
          signal_id: signalId,
          timestamp: new Date().toISOString(),
          direction,
          entry:     levels.entry,
          sl:        levels.sl,
          tp1:       levels.tp1,
          tp2:       levels.tp2,

          h4_trend:  h4a.bias  || 'NEUTRAL',
          h1_trend:  h1a.bias  || 'NEUTRAL',
          m15_trend: m15a.bias || 'NEUTRAL',
          m5_trend:  m5a.bias  || 'NEUTRAL',
          m1_trend:  m1a.bias  || 'NEUTRAL',

          h4_rsi:   h4a.rsi  != null ? parseFloat(h4a.rsi.toFixed(1))  : null,
          h1_rsi:   h1a.rsi  != null ? parseFloat(h1a.rsi.toFixed(1))  : null,
          m15_rsi:  m15a.rsi != null ? parseFloat(m15a.rsi.toFixed(1)) : null,
          m5_rsi:   m5a.rsi  != null ? parseFloat(m5a.rsi.toFixed(1))  : null,
          m1_rsi:   m1a.rsi  != null ? parseFloat(m1a.rsi.toFixed(1))  : null,

          h4_atr:  h4a.atr  != null ? parseFloat(h4a.atr.toFixed(2))  : null,
          m5_atr:  m5a.atr  != null ? parseFloat(m5a.atr.toFixed(2))  : null,

          market_structure: h4a.marketStructure ||
            (h4a.factors || []).find(f => f.startsWith('BOS') || f.startsWith('CHOCH')) || 'NONE',
          h4_factors:    (h4a.factors  || []).join(','),
          has_rejection: (m5a.bias !== 'NEUTRAL'),
          session:       getTradingSession(),

          result: null,
          pips:   null,
        };

        data.entries.push(entry);
        await atomicLearnWrite(data);
        console.log(`[LEARN] ✅ Entry #${newId} disimpan untuk Signal #${signalId} (${direction})`);
        resolve(newId);
      } catch (err) {
        console.error('[LEARN] saveLearningEntry error:', err.message);
        reject(err);
      }
    });
  });
}

// ─── UPDATE RESULT ────────────────────────────────────────────────────────────
// Dipanggil saat trade ditutup
// result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'TP1_BREAKEVEN' | 'MANUAL'
// TP1_BREAKEVEN = data positif (tidak dianggap LOSS)
async function updateLearningResult(signalId, result, pips) {
  return new Promise((resolve) => {
    enqueueLearnWrite(async () => {
      try {
        const data  = await readLearnData();
        const entry = data.entries.find((e) => e.signal_id === signalId);
        if (entry) {
          entry.result = result;
          entry.pips   = pips;
          await atomicLearnWrite(data);
          const outcomeLabel = isPositiveResult(result) ? `✅ POSITIF` : result === 'LOSS' ? `❌ NEGATIF` : `🔒 NEUTRAL`;
          console.log(`[LEARN] ✅ Result diperbarui: Signal #${signalId} → ${result} (${pips >= 0 ? '+' : ''}${pips} pips) [${outcomeLabel}]`);
        } else {
          console.warn(`[LEARN] updateLearningResult: Entry untuk Signal #${signalId} tidak ditemukan`);
        }
        resolve();
      } catch (err) {
        console.error('[LEARN] updateLearningResult error:', err.message);
        resolve();
      }
    });
  });
}

// ─── RETRAIN (sync dari signals.json) ─────────────────────────────────────────
async function retrain(getAllSignalsFn) {
  const getAllSignals = getAllSignalsFn || getDb();
  const data    = await readLearnData();
  const signals = await getAllSignals();

  let updated = 0;
  for (const entry of data.entries) {
    if (entry.result !== null) continue;
    const sig = signals.find((s) => s.id === entry.signal_id);
    if (sig && sig.status !== 'OPEN') {
      entry.result = sig.status;
      entry.pips   = sig.pips || 0;
      updated++;
    }
  }

  if (updated > 0) {
    await atomicLearnWrite(data);
    console.log(`[RETRAIN] ✅ Dataset diperbarui: ${updated} entries — Total: ${data.entries.length}`);
  } else {
    console.log(`[RETRAIN] Tidak ada perubahan — ${data.entries.length} entries sudah up-to-date`);
  }

  return { updated, total: data.entries.length };
}

// ─── AUTO RETRAIN ─────────────────────────────────────────────────────────────
async function autoRetrain() {
  try {
    console.log('[RETRAIN-AUTO] Dimulai...');
    const result = await retrain();
    if (result.updated > 0) {
      console.log(`[RETRAIN-AUTO] ✅ Selesai — ${result.updated} entries diperbarui | Total dataset: ${result.total}`);
    } else {
      console.log(`[RETRAIN-AUTO] Selesai — tidak ada perubahan (${result.total} entries)`);
    }
    return result;
  } catch (err) {
    console.error('[RETRAIN-AUTO] Error:', err.message);
    return { updated: 0, total: 0 };
  }
}

// ─── SIMILARITY ENGINE ────────────────────────────────────────────────────────

function trendScore(t1, t2) {
  if (!t1 || !t2) return 0;
  if (t1 === t2) return 1;
  const family = (t) => {
    if (t.includes('BUY'))  return 'BUY';
    if (t.includes('SELL')) return 'SELL';
    return 'NEUTRAL';
  };
  if (family(t1) === family(t2)) return 0.7;
  if (family(t1) === 'NEUTRAL' || family(t2) === 'NEUTRAL') return 0.3;
  return 0;
}

function rsiScore(r1, r2) {
  if (r1 == null || r2 == null) return 0.5;
  const diff = Math.abs(r1 - r2);
  if (diff <= 3)  return 1;
  if (diff <= 8)  return 0.8;
  if (diff <= 15) return 0.5;
  if (diff <= 25) return 0.2;
  return 0;
}

function sessionScore(s1, s2) {
  if (!s1 || !s2) return 0.5;
  return s1 === s2 ? 1 : 0;
}

function structureScore(ms1, ms2) {
  if (!ms1 || !ms2) return 0.5;
  if (ms1 === ms2) return 1;
  const bear = ['BEARISH_BOS', 'BEARISH_CHOCH', 'BEARISH_SWEEP'];
  const bull = ['BULLISH_BOS', 'BULLISH_CHOCH', 'BULLISH_SWEEP'];
  const fam  = (m) => bull.includes(m) ? 'BULL' : bear.includes(m) ? 'BEAR' : 'NONE';
  return fam(ms1) === fam(ms2) ? 0.6 : 0.1;
}

function calcSimilarity(current, historical) {
  const weights = {
    has_rejection:    0.15,
    market_structure: 0.20,
    h4_trend:         0.13,
    h1_trend:         0.10,
    m15_trend:        0.08,
    m5_trend:         0.07,
    m1_trend:         0.05,
    h4_rsi:           0.04,
    m5_rsi:           0.04,
    session:          0.07,
    direction:        0.07,
  };

  let score = 0;
  score += weights.has_rejection    * (current.has_rejection === historical.has_rejection ? 1 : 0.3);
  score += weights.market_structure * structureScore(current.market_structure, historical.market_structure);
  score += weights.h4_trend         * trendScore(current.h4_trend,  historical.h4_trend);
  score += weights.h1_trend         * trendScore(current.h1_trend,  historical.h1_trend);
  score += weights.m15_trend        * trendScore(current.m15_trend, historical.m15_trend);
  score += weights.m5_trend         * trendScore(current.m5_trend,  historical.m5_trend);
  score += weights.m1_trend         * trendScore(current.m1_trend,  historical.m1_trend);
  score += weights.h4_rsi           * rsiScore(current.h4_rsi, historical.h4_rsi);
  score += weights.m5_rsi           * rsiScore(current.m5_rsi, historical.m5_rsi);
  score += weights.session          * sessionScore(current.session, historical.session);
  score += weights.direction        * (current.direction === historical.direction ? 1 : 0);

  return Math.round(score * 100);
}

// ─── RUN SIMILARITY ANALYSIS ──────────────────────────────────────────────────
async function runSimilarity(currentCondition) {
  const data   = await readLearnData();
  const closed = data.entries.filter((e) => e.result !== null);

  const MINIMUM_DATASET = 30;
  const FULL_ADAPTIVE   = 100;

  if (closed.length < MINIMUM_DATASET) {
    return {
      active: false,
      reason: `Not enough data (${closed.length}/${MINIMUM_DATASET})`,
      count:  closed.length,
      needed: MINIMUM_DATASET - closed.length,
    };
  }

  const scored = closed.map((h) => ({
    entry:      h,
    similarity: calcSimilarity(currentCondition, h),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);

  const topMatches = scored.filter((s) => s.similarity >= 50).slice(0, 10);

  if (topMatches.length === 0) {
    return {
      active: true, count: closed.length, bestMatch: 0,
      recommendation: 'NO_MATCH', avgSimilarity: 0,
      wins: 0, losses: 0, breakevens: 0, winRate: 0, confidenceAdjust: 0,
    };
  }

  const bestMatch     = topMatches[0].similarity;
  const avgSimilarity = Math.round(topMatches.reduce((s, m) => s + m.similarity, 0) / topMatches.length);

  // WIN dan TP1_BREAKEVEN sama-sama dihitung sebagai positif untuk similarity
  const wins          = topMatches.filter((m) => isPositiveResult(m.entry.result)).length;
  const losses        = topMatches.filter((m) => m.entry.result === 'LOSS').length;
  const breakevens    = topMatches.filter((m) => m.entry.result === 'BREAKEVEN').length;
  const decidedTrades = wins + losses;
  const winRate       = decidedTrades > 0 ? Math.round((wins / decidedTrades) * 100) : 50;

  let confidenceAdjust = 0;
  if (closed.length >= FULL_ADAPTIVE) {
    if (winRate >= 75)      confidenceAdjust = +15;
    else if (winRate >= 60) confidenceAdjust = +8;
    else if (winRate >= 50) confidenceAdjust = +3;
    else if (winRate >= 40) confidenceAdjust = -5;
    else if (winRate >= 30) confidenceAdjust = -10;
    else                    confidenceAdjust = -18;
  } else {
    if (winRate >= 70)      confidenceAdjust = +8;
    else if (winRate >= 55) confidenceAdjust = +3;
    else if (winRate >= 45) confidenceAdjust = 0;
    else if (winRate >= 35) confidenceAdjust = -5;
    else                    confidenceAdjust = -10;
  }
  confidenceAdjust = Math.round(confidenceAdjust * (avgSimilarity / 100));

  let recommendation;
  if (winRate >= 65 && bestMatch >= 80)            recommendation = 'VALID';
  else if (winRate >= 55)                           recommendation = 'CAUTION';
  else if (winRate < 40 && topMatches.length >= 3) recommendation = 'AVOID';
  else                                              recommendation = 'NEUTRAL';

  return {
    active:           true,
    count:            closed.length,
    fullAdaptive:     closed.length >= FULL_ADAPTIVE,
    bestMatch,
    avgSimilarity,
    topMatches: topMatches.slice(0, 3).map((m) => ({
      similarity: m.similarity,
      direction:  m.entry.direction,
      result:     m.entry.result,
      pips:       m.entry.pips,
      date:       m.entry.timestamp?.slice(0, 10),
    })),
    wins,
    losses,
    breakevens,
    winRate,
    recommendation,
    confidenceAdjust,
  };
}

// ─── APPLY ADAPTIVE CONFIDENCE ────────────────────────────────────────────────
function applyAdaptiveConfidence(baseConfidence, similarityResult) {
  if (!similarityResult?.active) return baseConfidence;
  return Math.min(97, Math.max(10, baseConfidence + similarityResult.confidenceAdjust));
}

// ─── GET LEARN STATS ──────────────────────────────────────────────────────────
async function getLearnStats() {
  const data   = await readLearnData();
  const all    = data.entries;
  const closed = all.filter((e) => e.result !== null);

  const wins          = closed.filter((e) => e.result === 'WIN').length;
  const losses        = closed.filter((e) => e.result === 'LOSS').length;
  const breakevens    = closed.filter((e) => e.result === 'BREAKEVEN').length;
  const tp1breakevens = closed.filter((e) => e.result === 'TP1_BREAKEVEN').length;

  const MINIMUM_DATASET = 30;
  const FULL_ADAPTIVE   = 100;

  let learningStatus;
  if (closed.length < MINIMUM_DATASET)    learningStatus = 'Not enough data';
  else if (closed.length < FULL_ADAPTIVE) learningStatus = 'PARTIAL';
  else                                    learningStatus = 'ACTIVE';

  let avgSimilarity = null;
  if (closed.length >= 5) {
    const recent = closed.slice(-20);
    const sims   = [];
    for (let i = 1; i < recent.length; i++) {
      sims.push(calcSimilarity(recent[i], recent[i - 1]));
    }
    avgSimilarity = sims.length > 0
      ? Math.round(sims.reduce((a, b) => a + b, 0) / sims.length)
      : null;
  }

  return {
    total: all.length, closed: closed.length,
    wins, losses, breakevens, tp1breakevens,
    learningStatus, avgSimilarity,
    needed:     Math.max(0, MINIMUM_DATASET - closed.length),
    neededFull: Math.max(0, FULL_ADAPTIVE - closed.length),
  };
}

module.exports = {
  saveLearningEntry,
  updateLearningResult,
  retrain,
  autoRetrain,
  runSimilarity,
  applyAdaptiveConfidence,
  getLearnStats,
  getTradingSession,
  calcSimilarity,
  isPositiveResult,
};
