/**
 * strategy_stats.js — Per-Strategy Performance Tracker
 *
 * Menyimpan win/loss per strategi ke data/strategy_stats.json
 * AI Learning memberi bobot lebih pada strategi yang terbukti efektif.
 */

const fs   = require('fs').promises;
const path = require('path');

const statsPath = path.resolve(process.env.STRATEGY_STATS_PATH || './data/strategy_stats.json');

// ─── DEFAULT DATA ──────────────────────────────────────────────────────────────
function defaultStats() {
  return {
    strategies: {},
    lastUpdated: new Date().toISOString(),
  };
}

// ─── READ ─────────────────────────────────────────────────────────────────────
async function readStats() {
  try {
    const content = await fs.readFile(statsPath, 'utf8');
    const parsed  = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return defaultStats();
    if (!parsed.strategies) parsed.strategies = {};
    return parsed;
  } catch {
    return defaultStats();
  }
}

// ─── WRITE ────────────────────────────────────────────────────────────────────
async function writeStats(data) {
  try {
    await fs.mkdir(path.dirname(statsPath), { recursive: true });
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(statsPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[STRATEGY-STATS] Write error:', err.message);
  }
}

// ─── GET STRATEGY ENTRY ────────────────────────────────────────────────────────
function getEntry(data, strategyName) {
  if (!data.strategies[strategyName]) {
    data.strategies[strategyName] = { wins: 0, losses: 0, breakevens: 0 };
  }
  return data.strategies[strategyName];
}

// ─── RECORD WIN ───────────────────────────────────────────────────────────────
async function recordStrategyWin(strategyName) {
  if (!strategyName) return;
  const data  = await readStats();
  const entry = getEntry(data, strategyName);
  entry.wins++;
  await writeStats(data);
  console.log(`[STRATEGY-STATS] WIN recorded: ${strategyName} (${entry.wins}W/${entry.losses}L)`);
}

// ─── RECORD LOSS ──────────────────────────────────────────────────────────────
async function recordStrategyLoss(strategyName) {
  if (!strategyName) return;
  const data  = await readStats();
  const entry = getEntry(data, strategyName);
  entry.losses++;
  await writeStats(data);
  console.log(`[STRATEGY-STATS] LOSS recorded: ${strategyName} (${entry.wins}W/${entry.losses}L)`);
}

// ─── RECORD BREAKEVEN ─────────────────────────────────────────────────────────
async function recordStrategyBreakeven(strategyName) {
  if (!strategyName) return;
  const data  = await readStats();
  const entry = getEntry(data, strategyName);
  entry.breakevens = (entry.breakevens || 0) + 1;
  await writeStats(data);
}

// ─── GET ALL STATS ────────────────────────────────────────────────────────────
async function getAllStrategyStats() {
  const data = await readStats();
  return Object.entries(data.strategies).map(([name, s]) => {
    const decided = s.wins + s.losses;
    const winRate = decided > 0 ? ((s.wins / decided) * 100).toFixed(1) : '0.0';
    return {
      name,
      wins:       s.wins,
      losses:     s.losses,
      breakevens: s.breakevens || 0,
      winRate,
      decided,
    };
  }).sort((a, b) => b.decided - a.decided); // urutkan berdasarkan total trade
}

// ─── GET STRATEGY WEIGHT (untuk AI bobot) ─────────────────────────────────────
// Strategi dengan win rate tinggi mendapat bobot lebih
async function getStrategyWeights() {
  const stats   = await getAllStrategyStats();
  const weights = {};
  for (const s of stats) {
    const wr = parseFloat(s.winRate) / 100;
    if (s.decided >= 5) {
      // Normalized weight: 0.5 (bad) sampai 1.5 (excellent)
      weights[s.name] = 0.5 + wr;
    } else {
      weights[s.name] = 1.0; // default neutral
    }
  }
  return weights;
}

// ─── FORMAT PESAN STRATEGI STATS ──────────────────────────────────────────────
async function formatStrategyStatsMessage() {
  const stats = await getAllStrategyStats();

  if (stats.length === 0) {
    return [
      `📊 <b>AZZAVISION AI — STATISTIK PER STRATEGI</b>`,
      ``,
      `⏳ <i>Belum ada data strategi. Perlu beberapa trade terlebih dahulu.</i>`,
      ``,
      `ℹ️ <i>Data akan muncul setelah sinyal pertama terclose.</i>`,
    ].join('\n');
  }

  const lines = [
    `📊 <b>AZZAVISION AI — STATISTIK PER STRATEGI</b>`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  stats.forEach((s, i) => {
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '📌';
    const bar = buildMiniBar(parseFloat(s.winRate) / 100);
    lines.push(``);
    lines.push(`${emoji} <b>${s.name}</b>`);
    lines.push(`   Win: <code>${s.wins}</code> | Loss: <code>${s.losses}</code> | BE: <code>${s.breakevens}</code>`);
    lines.push(`   Win Rate: <code>${s.winRate}%</code> ${bar}`);
  });

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`🧠 <i>AI memberi bobot lebih pada strategi win rate tinggi</i>`);
  lines.push(`⚡ <i>AZZAVISION AI v3.0 | Strategy Analytics</i>`);

  return lines.join('\n');
}

function buildMiniBar(ratio) {
  const filled = Math.round(ratio * 5);
  return '█'.repeat(filled) + '░'.repeat(5 - filled);
}

module.exports = {
  recordStrategyWin,
  recordStrategyLoss,
  recordStrategyBreakeven,
  getAllStrategyStats,
  getStrategyWeights,
  formatStrategyStatsMessage,
};
