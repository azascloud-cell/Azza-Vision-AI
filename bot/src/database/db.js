const fs   = require('fs').promises;
const path = require('path');
const { backupBeforeWrite } = require('../utils/backup');

const dbPath = path.resolve(process.env.DB_PATH || './data/signals.json');
const dbDir  = path.dirname(dbPath);

// ─── SIMPLE WRITE MUTEX ───────────────────────────────────────────────────────
let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn).catch((err) => {
    console.error('[DB] Write queue error:', err.message);
  });
  return writeQueue;
}

// ─── DEFAULT STRUCTURE ────────────────────────────────────────────────────────
function defaultData() {
  return { signals: [], snapshots: [] };
}

// ─── SAFE READ ────────────────────────────────────────────────────────────────
async function readData() {
  try {
    const content = await fs.readFile(dbPath, 'utf8');
    const parsed  = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return defaultData();
    if (!Array.isArray(parsed.signals))   parsed.signals   = [];
    if (!Array.isArray(parsed.snapshots)) parsed.snapshots = [];
    return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[DB] Gagal baca signals.json:', err.message);
    }
    return defaultData();
  }
}

// ─── ATOMIC WRITE (dengan backup) ────────────────────────────────────────────
async function atomicWrite(filePath, data) {
  await backupBeforeWrite(filePath);

  const dir     = path.dirname(filePath);
  const tmpPath = path.join(dir, `${path.basename(filePath)}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);

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

// ─── INIT DB ─────────────────────────────────────────────────────────────────
async function initDb() {
  try {
    await fs.mkdir(dbDir, { recursive: true });
    try {
      const content = await fs.readFile(dbPath, 'utf8');
      JSON.parse(content);
    } catch {
      console.log('[DB] File tidak ada atau rusak — membuat baru dengan struktur default.');
      await fs.writeFile(dbPath, JSON.stringify(defaultData(), null, 2), 'utf8');
    }
    console.log(`[DB] JSON storage siap: ${dbPath}`);
  } catch (err) {
    console.error('[DB] Init error:', err.message);
  }
}

initDb();

// ─── INSERT SIGNAL ────────────────────────────────────────────────────────────
async function insertSignal(signal) {
  return new Promise((resolve, reject) => {
    enqueueWrite(async () => {
      try {
        const data  = await readData();
        const newId = data.signals.length > 0
          ? Math.max(...data.signals.map((s) => s.id)) + 1
          : 1;

        const newSignal = {
          id: newId,
          ...signal,
          status:              'OPEN',
          breakeven_triggered: false,
          tp1_hit:             false,   // ← TP1 tracking
          pips:                0,
          created_at:          new Date().toISOString(),
          closed_at:           null,
        };

        data.signals.push(newSignal);
        await atomicWrite(dbPath, data);
        console.log(`[DB] Signal #${newId} disimpan (${signal.direction} @ ${signal.entry})`);
        resolve(newId);
      } catch (err) {
        console.error('[DB] insertSignal error:', err.message);
        reject(err);
      }
    });
  });
}

// ─── MARK BREAKEVEN TRIGGERED ─────────────────────────────────────────────────
async function markBreakevenTriggered(id) {
  return new Promise((resolve, reject) => {
    enqueueWrite(async () => {
      try {
        const data   = await readData();
        const signal = data.signals.find((s) => s.id === id);
        if (signal) {
          signal.breakeven_triggered = true;
          await atomicWrite(dbPath, data);
          console.log(`[DB] Breakeven triggered — Signal #${id}`);
        }
        resolve();
      } catch (err) {
        console.error('[DB] markBreakevenTriggered error:', err.message);
        reject(err);
      }
    });
  });
}

// ─── MARK TP1 HIT ─────────────────────────────────────────────────────────────
// Dipanggil saat TP1 tercapai. Trade TIDAK ditutup — monitoring dilanjutkan.
async function markTp1Hit(id) {
  return new Promise((resolve, reject) => {
    enqueueWrite(async () => {
      try {
        const data   = await readData();
        const signal = data.signals.find((s) => s.id === id);
        if (signal) {
          signal.tp1_hit = true;
          await atomicWrite(dbPath, data);
          console.log(`[DB] TP1 hit — Signal #${id} (trade tetap terbuka, monitoring dilanjutkan)`);
        }
        resolve();
      } catch (err) {
        console.error('[DB] markTp1Hit error:', err.message);
        reject(err);
      }
    });
  });
}

// ─── CLOSE SIGNAL ────────────────────────────────────────────────────────────
// Status: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'TP1_BREAKEVEN' | 'MANUAL'
// closePrice: actual market price at the moment of close (for AI Replay)
async function closeSignal(id, status, pips, closePrice) {
  return new Promise((resolve, reject) => {
    enqueueWrite(async () => {
      try {
        const data   = await readData();
        const signal = data.signals.find((s) => s.id === id);
        if (signal) {
          signal.status      = status;
          signal.pips        = pips;
          signal.closed_at   = new Date().toISOString();
          if (closePrice !== undefined && closePrice !== null) {
            signal.close_price = Number(closePrice);
          }
          await atomicWrite(dbPath, data);
          console.log(`[DB] Signal #${id} ditutup → ${status} (${pips >= 0 ? '+' : ''}${pips} pips @ ${closePrice || '?'})`);
        } else {
          console.warn(`[DB] closeSignal: Signal #${id} tidak ditemukan`);
        }
        resolve();
      } catch (err) {
        console.error('[DB] closeSignal error:', err.message);
        reject(err);
      }
    });
  });
}

// ─── GET OPEN SIGNALS ────────────────────────────────────────────────────────
async function getOpenSignals() {
  const data = await readData();
  return data.signals.filter((s) => s.status === 'OPEN');
}

// ─── GET SIGNAL BY ID ────────────────────────────────────────────────────────
async function getSignalById(id) {
  const data = await readData();
  return data.signals.find((s) => s.id === id) || null;
}

// ─── GET STATS ────────────────────────────────────────────────────────────────
// Win Rate = WIN / (WIN + LOSS) — BREAKEVEN & TP1_BREAKEVEN dikecualikan dari denominator
async function getStats() {
  const data   = await readData();
  const closed = data.signals.filter((s) => s.status !== 'OPEN');

  const total         = closed.length;
  const wins          = closed.filter((s) => s.status === 'WIN').length;
  const losses        = closed.filter((s) => s.status === 'LOSS').length;
  const breakevens    = closed.filter((s) => s.status === 'BREAKEVEN').length;
  const tp1breakevens = closed.filter((s) => s.status === 'TP1_BREAKEVEN').length;
  const netPips       = closed.reduce((acc, s) => acc + (s.pips || 0), 0);

  const winPips  = closed.filter((s) => s.status === 'WIN').reduce((acc, s)  => acc + (s.pips || 0), 0);
  const lossPips = Math.abs(closed.filter((s) => s.status === 'LOSS').reduce((acc, s) => acc + (s.pips || 0), 0));

  const decidedTrades = wins + losses;
  const winRate       = decidedTrades > 0 ? ((wins / decidedTrades) * 100).toFixed(2) : '0.00';
  const profitFactor  = lossPips > 0 ? (winPips / lossPips).toFixed(2) : wins > 0 ? '∞' : '0.00';

  return { total, wins, losses, breakevens, tp1breakevens, netPips: Number(netPips).toFixed(1), winRate, profitFactor };
}


    // ─── WIB DATE HELPER ─────────────────────────────────────────────────────────
    function toWIBDate(utcIso) {
    try {
      return new Date(new Date(utcIso).getTime() + 7 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);
    } catch { return utcIso ? String(utcIso).slice(0, 10) : ''; }
    }

    // ─── GET DAILY STATS ─────────────────────────────────────────────────────────
async function getDailyStats(date) {
  try {
    const data    = await readData();
    const signals = data.signals.filter(
      (s) => toWIBDate(s.created_at) === date && s.status !== 'OPEN'
    );

    const wins          = signals.filter((s) => s.status === 'WIN');
    const losses        = signals.filter((s) => s.status === 'LOSS');
    const breakevens    = signals.filter((s) => s.status === 'BREAKEVEN' || s.status === 'TP1_BREAKEVEN');
    const netPips       = signals.reduce((s, t) => s + (t.pips || 0), 0);

    const decidedTrades = wins.length + losses.length;
    const winRate = decidedTrades > 0 ? ((wins.length / decidedTrades) * 100).toFixed(1) : '0.0';

    const buyCount  = signals.filter((s) => s.direction === 'BUY').length;
    const sellCount = signals.filter((s) => s.direction === 'SELL').length;
    const avgConf   = signals.length > 0
      ? (signals.reduce((s, t) => s + (t.confidence || 0), 0) / signals.length).toFixed(1)
      : '0.0';

    return { date, total: signals.length, wins: wins.length, losses: losses.length,
             breakevens: breakevens.length, netPips, winRate, buyCount, sellCount, avgConf };
  } catch {
    return { date, total: 0, wins: 0, losses: 0, breakevens: 0, netPips: 0, winRate: '0.0', buyCount: 0, sellCount: 0, avgConf: '0.0' };
  }
}

// ─── GET WEEKLY STATS (7 hari terakhir) ───────────────────────────────────────
async function getWeeklyStats() {
  try {
    const data        = await readData();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const signals     = data.signals.filter(
      (s) => s.status !== 'OPEN' && new Date(s.created_at).getTime() >= sevenDaysAgo
    );

    const daysMap = {};
    signals.forEach((s) => {
      const day = toWIBDate(s.created_at);
      if (!daysMap[day]) daysMap[day] = { day, total: 0, wins: 0, losses: 0, breakevens: 0, net_pips: 0 };
      daysMap[day].total++;
      if (s.status === 'WIN')                                       daysMap[day].wins++;
      if (s.status === 'LOSS')                                      daysMap[day].losses++;
      if (s.status === 'BREAKEVEN' || s.status === 'TP1_BREAKEVEN') daysMap[day].breakevens++;
      daysMap[day].net_pips += s.pips || 0;
    });

    return Object.values(daysMap).sort((a, b) => b.day.localeCompare(a.day));
  } catch {
    return [];
  }
}

// ─── SAVE MARKET SNAPSHOT ────────────────────────────────────────────────────
async function saveMarketSnapshot(snapshot) {
  return new Promise((resolve, reject) => {
    enqueueWrite(async () => {
      try {
        const data        = await readData();
        const newSnapshot = {
          id:         data.snapshots.length + 1,
          ...snapshot,
          created_at: new Date().toISOString(),
        };
        data.snapshots.push(newSnapshot);
        if (data.snapshots.length > 200) data.snapshots = data.snapshots.slice(-200);
        await atomicWrite(dbPath, data);
        resolve();
      } catch (err) {
        console.warn('[DB] saveMarketSnapshot error:', err.message);
        resolve();
      }
    });
  });
}

// ─── GET LAST SIGNAL TIME ────────────────────────────────────────────────────
async function getLastSignalTime() {
  const data = await readData();
  if (data.signals.length === 0) return null;
  return data.signals[data.signals.length - 1].created_at;
}

// ─── GET ALL SIGNALS ─────────────────────────────────────────────────────────
async function getAllSignals() {
  const data = await readData();
  return data.signals;
}

module.exports = {
  insertSignal,
  closeSignal,
  markBreakevenTriggered,
  markTp1Hit,
  getOpenSignals,
  getSignalById,
  getStats,
  getDailyStats,
  getWeeklyStats,
  saveMarketSnapshot,
  getLastSignalTime,
  getAllSignals,
};
