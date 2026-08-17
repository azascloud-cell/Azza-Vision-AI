/**
 * report_store.js — Report History Storage
 *
 * Menyimpan laporan harian dan mingguan selama 365 hari.
 * Format: data/report_history.json
 */

'use strict';

const fs   = require('fs').promises;
const path = require('path');

const REPORT_PATH = path.resolve('./data/report_history.json');
const MAX_DAYS    = 365;

// ─── SAFE READ ────────────────────────────────────────────────────────────────
async function readHistory() {
  try {
    const content = await fs.readFile(REPORT_PATH, 'utf8');
    const parsed  = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return { daily: {}, weekly: {} };
    if (!parsed.daily)  parsed.daily  = {};
    if (!parsed.weekly) parsed.weekly = {};
    return parsed;
  } catch {
    return { daily: {}, weekly: {} };
  }
}

// ─── WRITE ────────────────────────────────────────────────────────────────────
async function writeHistory(data) {
  const dir = path.dirname(REPORT_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── PRUNE OLD ENTRIES ────────────────────────────────────────────────────────
function pruneOld(obj) {
  const keys = Object.keys(obj).sort();
  while (keys.length > MAX_DAYS) {
    const oldest = keys.shift();
    delete obj[oldest];
  }
}

// ─── SAVE DAILY REPORT ────────────────────────────────────────────────────────
async function saveDailyReport(date, stats, aiInsight, reportText) {
  const history = await readHistory();
  history.daily[date] = {
    date,
    stats,
    aiInsight: aiInsight || null,
    reportText: reportText || '',
    savedAt:   new Date().toISOString(),
  };
  pruneOld(history.daily);
  await writeHistory(history);
}

// ─── SAVE WEEKLY REPORT ───────────────────────────────────────────────────────
async function saveWeeklyReport(weekKey, stats, aiReview, reportText) {
  const history = await readHistory();
  history.weekly[weekKey] = {
    weekKey,
    stats,
    aiReview: aiReview || null,
    reportText: reportText || '',
    savedAt:   new Date().toISOString(),
  };
  pruneOld(history.weekly);
  await writeHistory(history);
}

// ─── GET DAILY REPORT ─────────────────────────────────────────────────────────
async function getDailyReport(date) {
  const history = await readHistory();
  return history.daily[date] || null;
}

// ─── GET LATEST WEEKLY REPORT ─────────────────────────────────────────────────
async function getLatestWeeklyReport() {
  const history = await readHistory();
  const keys    = Object.keys(history.weekly).sort();
  if (keys.length === 0) return null;
  return history.weekly[keys[keys.length - 1]];
}

// ─── GET WEEKLY REPORT BY KEY ─────────────────────────────────────────────────
async function getWeeklyReport(weekKey) {
  const history = await readHistory();
  return history.weekly[weekKey] || null;
}

// ─── GET RECENT DAILY HISTORY ─────────────────────────────────────────────────
async function getRecentDailyHistory(days = 30) {
  const history = await readHistory();
  const keys    = Object.keys(history.daily).sort().slice(-days);
  return keys.map(k => history.daily[k]);
}

// ─── GET RECENT WEEKLY HISTORY ────────────────────────────────────────────────
async function getRecentWeeklyHistory(weeks = 8) {
  const history = await readHistory();
  const keys    = Object.keys(history.weekly).sort().slice(-weeks);
  return keys.map(k => history.weekly[k]);
}

// ─── REPORT SETTINGS ─────────────────────────────────────────────────────────
const SETTINGS_PATH = path.resolve('./data/report_settings.json');

async function getReportSettings() {
  try {
    const content = await fs.readFile(SETTINGS_PATH, 'utf8');
    return JSON.parse(content);
  } catch {
    return {
      enabled:         true,
      mode:            'both',       // 'daily' | 'weekly' | 'both' | 'off'
      reportChannelId: null,         // override channel for reports
    };
  }
}

async function saveReportSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

module.exports = {
  saveDailyReport,
  saveWeeklyReport,
  getDailyReport,
  getWeeklyReport,
  getLatestWeeklyReport,
  getRecentDailyHistory,
  getRecentWeeklyHistory,
  getReportSettings,
  saveReportSettings,
};
