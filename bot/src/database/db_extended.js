/**
 * db_extended.js — Extended Statistics for v4.0
 *
 * Statistik lanjutan yang dibutuhkan oleh Report Engine v4.0.
 * Tidak memodifikasi db.js agar backward compatible.
 */

'use strict';

const { getAllSignals } = require('./db');
const { todayWIB }     = require('../utils/wib_time');

// ─── HELPER ───────────────────────────────────────────────────────────────────
function isClosed(s)  { return s.status !== 'OPEN'; }
function isWin(s)     { return s.status === 'WIN'; }
function isLoss(s)    { return s.status === 'LOSS'; }
function isBE(s)      { return s.status === 'BREAKEVEN' || s.status === 'TP1_BREAKEVEN'; }

// Hitung durasi dalam menit (dari created_at ke closed_at)
function tradeDurationMin(s) {
  if (!s.created_at || !s.closed_at) return null;
  return Math.round((new Date(s.closed_at) - new Date(s.created_at)) / 60000);
}

// Compute consecutive streaks
function computeStreaks(signals) {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
  for (const s of signals) {
    if (isWin(s)) {
      curWin++; curLoss = 0;
      if (curWin > maxWin) maxWin = curWin;
    } else if (isLoss(s)) {
      curLoss++; curWin = 0;
      if (curLoss > maxLoss) maxLoss = curLoss;
    } else {
      // BE tidak putus streak
    }
  }
  return { maxWin, maxLoss };
}

// Compute strategy breakdown
function computeStrategyBreakdown(signals) {
  const stratMap = {};
  for (const s of signals) {
    if (!isClosed(s)) continue;
    const name = s.strategy || s.strategies?.[0] || 'Unknown';
    if (!stratMap[name]) stratMap[name] = { name, total: 0, wins: 0, losses: 0, bes: 0, pips: 0 };
    stratMap[name].total++;
    if (isWin(s))  stratMap[name].wins++;
    if (isLoss(s)) { stratMap[name].losses++; }
    if (isBE(s))   stratMap[name].bes++;
    stratMap[name].pips += s.pips || 0;
  }

  const strats = Object.values(stratMap).sort((a, b) => b.total - a.total);

  const bestStrat = strats.slice().sort((a, b) => {
    const wra = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
    const wrb = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
    return wrb - wra || b.pips - a.pips;
  })[0] || null;

  const worstStrat = strats.slice().sort((a, b) => {
    const wra = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 1;
    const wrb = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 1;
    return wra - wrb || a.pips - b.pips;
  })[0] || null;

  return { strats, bestStrat, worstStrat };
}

// ─── EXTENDED DAILY STATS ─────────────────────────────────────────────────────
async function getExtendedDailyStats(date) {
  const all     = await getAllSignals();
  const signals = all.filter(s => s.created_at?.slice(0, 10) === date && isClosed(s));

  const wins      = signals.filter(isWin);
  const losses    = signals.filter(isLoss);
  const bes       = signals.filter(isBE);
  const netPips   = signals.reduce((a, s) => a + (s.pips || 0), 0);

  const winPips  = wins.reduce((a, s) => a + (s.pips || 0), 0);
  const lossPips = Math.abs(losses.reduce((a, s) => a + (s.pips || 0), 0));
  const pf       = lossPips > 0 ? (winPips / lossPips).toFixed(2) : wins.length > 0 ? '∞' : '0.00';

  const decided  = wins.length + losses.length;
  const winRate  = decided > 0 ? ((wins.length / decided) * 100).toFixed(1) : '0.0';

  const buyCount  = signals.filter(s => s.direction === 'BUY').length;
  const sellCount = signals.filter(s => s.direction === 'SELL').length;

  const avgConf  = signals.length > 0
    ? (signals.reduce((a, s) => a + (s.confidence || 0), 0) / signals.length).toFixed(1)
    : '0.0';

  // Duration
  const durations = signals.map(tradeDurationMin).filter(d => d !== null);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, v) => a + v, 0) / durations.length)
    : null;

  // Best & worst trade
  const sorted    = [...signals].sort((a, b) => (b.pips || 0) - (a.pips || 0));
  const bestTrade  = sorted[0] || null;
  const worstTrade = sorted[sorted.length - 1] || null;

  // Confidence extremes
  const confSorted   = [...signals].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const highestConf  = confSorted[0] || null;
  const lowestConf   = confSorted[confSorted.length - 1] || null;

  // Streaks
  const { maxWin: longestWinStreak, maxLoss: longestLossStreak } = computeStreaks(signals);

  // Strategy
  const { bestStrat, worstStrat } = computeStrategyBreakdown(signals);

  return {
    date,
    total:              signals.length,
    wins:               wins.length,
    losses:             losses.length,
    breakevens:         bes.length,
    netPips:            Number(netPips).toFixed(1),
    winRate,
    profitFactor:       pf,
    buyCount,
    sellCount,
    avgConf,
    avgDurationMin:     avgDuration,
    longestWinStreak,
    longestLossStreak,
    bestTrade,
    worstTrade,
    highestConf,
    lowestConf,
    bestStrategy:       bestStrat,
    worstStrategy:      worstStrat,
  };
}

// ─── EXTENDED WEEKLY STATS ────────────────────────────────────────────────────
async function getExtendedWeeklyStats(daysBack = 7) {
  const all        = await getAllSignals();
  const cutoff     = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const signals    = all.filter(s => isClosed(s) && new Date(s.created_at).getTime() >= cutoff);

  const wins      = signals.filter(isWin);
  const losses    = signals.filter(isLoss);
  const bes       = signals.filter(isBE);
  const netPips   = signals.reduce((a, s) => a + (s.pips || 0), 0);

  const winPips  = wins.reduce((a, s) => a + (s.pips || 0), 0);
  const lossPips = Math.abs(losses.reduce((a, s) => a + (s.pips || 0), 0));
  const pf       = lossPips > 0 ? (winPips / lossPips).toFixed(2) : wins.length > 0 ? '∞' : '0.00';

  const decided  = wins.length + losses.length;
  const winRate  = decided > 0 ? ((wins.length / decided) * 100).toFixed(1) : '0.0';

  const buyCount  = signals.filter(s => s.direction === 'BUY').length;
  const sellCount = signals.filter(s => s.direction === 'SELL').length;

  const avgConf   = signals.length > 0
    ? (signals.reduce((a, s) => a + (s.confidence || 0), 0) / signals.length).toFixed(1)
    : '0.0';

  const durations    = signals.map(tradeDurationMin).filter(d => d !== null);
  const avgDuration  = durations.length > 0
    ? Math.round(durations.reduce((a, v) => a + v, 0) / durations.length)
    : null;

  // Best & worst trade
  const sorted     = [...signals].sort((a, b) => (b.pips || 0) - (a.pips || 0));
  const bestTrade  = sorted[0] || null;
  const worstTrade = sorted[sorted.length - 1] || null;

  // Confidence extremes
  const confSorted  = [...signals].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const highestConf = confSorted[0] || null;
  const lowestConf  = confSorted[confSorted.length - 1] || null;

  // Fastest TP2 (shortest duration among WIN trades)
  const winsSorted  = wins.slice()
    .filter(s => tradeDurationMin(s) !== null)
    .sort((a, b) => tradeDurationMin(a) - tradeDurationMin(b));
  const fastestTp2  = winsSorted[0] || null;

  // Streaks
  const { maxWin: longestWinStreak, maxLoss: longestLossStreak } = computeStreaks(signals);

  // Strategy breakdown
  const { strats, bestStrat, worstStrat } = computeStrategyBreakdown(signals);

  // Per-day rows
  const daysMap = {};
  signals.forEach(s => {
    const day = s.created_at.slice(0, 10);
    if (!daysMap[day]) daysMap[day] = { day, total: 0, wins: 0, losses: 0, breakevens: 0, net_pips: 0 };
    daysMap[day].total++;
    if (isWin(s))  daysMap[day].wins++;
    if (isLoss(s)) daysMap[day].losses++;
    if (isBE(s))   daysMap[day].breakevens++;
    daysMap[day].net_pips += s.pips || 0;
  });
  const dayRows = Object.values(daysMap).sort((a, b) => a.day.localeCompare(b.day));

  return {
    daysBack,
    total:              signals.length,
    wins:               wins.length,
    losses:             losses.length,
    breakevens:         bes.length,
    netPips:            Number(netPips).toFixed(1),
    winRate,
    profitFactor:       pf,
    buyCount,
    sellCount,
    avgConf,
    avgDurationMin:     avgDuration,
    longestWinStreak,
    longestLossStreak,
    bestTrade,
    worstTrade,
    highestConf,
    lowestConf,
    fastestTp2,
    bestStrategy:       bestStrat,
    worstStrategy:      worstStrat,
    strategies:         strats,
    dayRows,
  };
}

module.exports = {
  getExtendedDailyStats,
  getExtendedWeeklyStats,
  computeStreaks,
  computeStrategyBreakdown,
};
