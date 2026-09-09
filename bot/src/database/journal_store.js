/**
 * journal_store.js — Persistent Trade Journal Storage
 *
 * Writes every closed trade journal entry to data/journal.json so history
 * survives keep-alive restarts and GHA runner cycles.
 * Dashboard + daily report can rebuild "profit hari ini" from this file
 * or from signals.json (WIB filter).
 */

'use strict';

const fs   = require('fs').promises;
const path = require('path');

const JOURNAL_PATH = path.resolve(process.env.JOURNAL_PATH || './data/journal.json');
const MAX_ENTRIES  = 2000;

let writeQueue = Promise.resolve();

function enqueue(fn) {
  writeQueue = writeQueue.then(fn).catch((err) => {
    console.error('[JOURNAL-STORE] write queue error:', err.message);
  });
  return writeQueue;
}

async function readJournal() {
  try {
    const content = await fs.readFile(JOURNAL_PATH, 'utf8');
    const parsed  = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return { entries: [] };
    if (!Array.isArray(parsed.entries)) parsed.entries = [];
    return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[JOURNAL-STORE] read failed:', err.message);
    }
    return { entries: [] };
  }
}

async function atomicWrite(filePath, data) {
  const dir     = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `${path.basename(filePath)}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      await fs.copyFile(tmpPath, filePath);
      await fs.unlink(tmpPath).catch(() => {});
    } else {
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }
}

/**
 * Append one closed-trade journal entry.
 * @param {object} payload
 * @param {number|string} payload.signalId
 * @param {string} payload.status - WIN | LOSS | BREAKEVEN | TP1_BREAKEVEN
 * @param {number} payload.pips
 * @param {string} payload.direction
 * @param {number} payload.entry
 * @param {number} [payload.tp1]
 * @param {number} [payload.tp2]
 * @param {number} [payload.sl]
 * @param {number} [payload.closePrice]
 * @param {string} [payload.closedAt]
 * @param {string} [payload.createdAt]
 * @param {string[]} [payload.strategies]
 * @param {number} [payload.confidence]
 * @param {string} [payload.journalText] - HTML/text sent to Telegram
 * @param {boolean} [payload.aiGenerated]
 */
async function appendJournalEntry(payload) {
  return enqueue(async () => {
    const data = await readJournal();
    const entry = {
      id:          data.entries.length > 0
        ? Math.max(...data.entries.map((e) => e.id || 0)) + 1
        : 1,
      signalId:    payload.signalId,
      status:      payload.status,
      pips:        Number(payload.pips) || 0,
      direction:   payload.direction || null,
      entry:       payload.entry != null ? Number(payload.entry) : null,
      tp1:         payload.tp1 != null ? Number(payload.tp1) : null,
      tp2:         payload.tp2 != null ? Number(payload.tp2) : null,
      sl:          payload.sl != null ? Number(payload.sl) : null,
      closePrice:  payload.closePrice != null ? Number(payload.closePrice) : null,
      confidence:  payload.confidence != null ? Number(payload.confidence) : null,
      strategies:  Array.isArray(payload.strategies) ? payload.strategies : [],
      journalText: payload.journalText || '',
      aiGenerated: !!payload.aiGenerated,
      created_at:  payload.createdAt || null,
      closed_at:   payload.closedAt || new Date().toISOString(),
      saved_at:    new Date().toISOString(),
    };

    // de-dupe same signalId + status + closed_at minute
    const exists = data.entries.some(
      (e) =>
        e.signalId === entry.signalId &&
        e.status === entry.status &&
        e.closed_at &&
        entry.closed_at &&
        e.closed_at.slice(0, 16) === entry.closed_at.slice(0, 16)
    );
    if (exists) {
      console.log(`[JOURNAL-STORE] skip duplicate signal #${entry.signalId} ${entry.status}`);
      return entry;
    }

    data.entries.push(entry);
    if (data.entries.length > MAX_ENTRIES) {
      data.entries = data.entries.slice(-MAX_ENTRIES);
    }
    await atomicWrite(JOURNAL_PATH, data);
    console.log(
      `[JOURNAL-STORE] ✅ entry #${entry.id} saved (signal #${entry.signalId} ${entry.status} ${entry.pips >= 0 ? '+' : ''}${entry.pips} pips)`
    );
    return entry;
  });
}

/** Rebuild daily summary from journal entries (WIB date YYYY-MM-DD). */
async function getDailyJournalStats(wibDate) {
  const data = await readJournal();
  const entries = data.entries.filter((e) => {
    const iso = e.closed_at || e.saved_at || '';
    try {
      const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return wib === wibDate;
    } catch {
      return iso.startsWith(wibDate);
    }
  });

  const wins = entries.filter((e) => e.status === 'WIN');
  const losses = entries.filter((e) => e.status === 'LOSS');
  const bes = entries.filter(
    (e) => e.status === 'BREAKEVEN' || e.status === 'TP1_BREAKEVEN'
  );
  const netPips = entries.reduce((a, e) => a + (e.pips || 0), 0);
  const decided = wins.length + losses.length;
  const winRate = decided > 0 ? ((wins.length / decided) * 100).toFixed(1) : '0.0';

  return {
    date: wibDate,
    total: entries.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: bes.length,
    netPips,
    winRate,
    entries,
  };
}

async function getAllJournalEntries() {
  const data = await readJournal();
  return data.entries;
}

module.exports = {
  appendJournalEntry,
  getDailyJournalStats,
  getAllJournalEntries,
  readJournal,
};
