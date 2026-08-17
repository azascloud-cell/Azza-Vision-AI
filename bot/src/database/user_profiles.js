/**
 * USER PROFILES — Money Management Engine v2.0 (Broker-Aware)
 * Storage: data/user_profiles.json
 *
 * Broker Specs (XAUUSD):
 *   Contract size  = 100 oz per standard lot
 *   1 pip          = $0.01 price movement for XAUUSD
 *   Pip Value      = contract_size × pip_size = 100 × $0.01 = $1.00 per lot per pip
 *
 *   Formula:
 *     risk_amount  = balance × (risk_pct / 100)
 *     suggested_lot = floor((risk_amount / (sl_pips × pip_value)) × 100) / 100
 *     dollar_sl    = lot × sl_pips × pip_value
 *     dollar_tp1   = lot × tp1_pips × pip_value
 *     dollar_tp2   = lot × tp2_pips × pip_value
 */

const fs   = require('fs');
const path = require('path');

// ─── BROKER SPECIFICATIONS ─────────────────────────────────────────────────────
const BROKER_SPECS = {
  hfm: {
    name:        'HFM',
    full_name:   'HFM (HotForex)',
    pair:        'XAUUSD',
    pip_value:   1.0,    // USD per lot per pip
    min_lot:     0.01,
    lot_step:    0.01,
    max_lot:     500,
  },
  exness: {
    name:        'Exness',
    full_name:   'Exness',
    pair:        'XAUUSD',
    pip_value:   1.0,
    min_lot:     0.01,
    lot_step:    0.01,
    max_lot:     500,
  },
  xm: {
    name:        'XM',
    full_name:   'XM Group',
    pair:        'XAUUSD',
    pip_value:   1.0,
    min_lot:     0.01,
    lot_step:    0.01,
    max_lot:     50,
  },
  icmarkets: {
    name:        'IC Markets',
    full_name:   'IC Markets',
    pair:        'XAUUSD',
    pip_value:   1.0,
    min_lot:     0.01,
    lot_step:    0.01,
    max_lot:     500,
  },
  fbs: {
    name:        'FBS',
    full_name:   'FBS',
    pair:        'XAUUSD',
    pip_value:   1.0,
    min_lot:     0.01,
    lot_step:    0.01,
    max_lot:     500,
  },
};

const SUPPORTED_BROKERS = Object.keys(BROKER_SPECS);

function getBrokerSpec(brokerKey) {
  return BROKER_SPECS[(brokerKey || 'hfm').toLowerCase()] || BROKER_SPECS.hfm;
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const DATA_DIR  = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'user_profiles.json');

function loadAll() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { return {}; }
}

function saveAll(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[PROFILES] Save error:', err.message);
  }
}

// ─── DEFAULT PROFILE ──────────────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  balance:  100,
  risk:     1,
  broker:   'hfm',
  lot_mode: 'auto',
};

function getProfile(userId) {
  const all = loadAll();
  return { ...DEFAULT_PROFILE, ...(all[String(userId)] || {}) };
}

function saveProfile(userId, updates) {
  const all     = loadAll();
  const current = all[String(userId)] || {};
  all[String(userId)] = { ...DEFAULT_PROFILE, ...current, ...updates };
  saveAll(all);
  return all[String(userId)];
}

// ─── LOT CALCULATOR ───────────────────────────────────────────────────────────
function calcLot(profile, slPips) {
  const spec       = getBrokerSpec(profile.broker);
  const balance    = Number(profile.balance) || DEFAULT_PROFILE.balance;
  const riskPct    = Number(profile.risk)    || DEFAULT_PROFILE.risk;
  const riskAmount = balance * (riskPct / 100);
  const rawLot     = riskAmount / (slPips * spec.pip_value);

  // Floor to lot_step
  const step    = spec.lot_step || 0.01;
  const floored = Math.floor(rawLot / step) * step;
  const lot     = Math.max(spec.min_lot, parseFloat(floored.toFixed(2)));
  return lot;
}

// ─── P&L CALCULATION ──────────────────────────────────────────────────────────
function calcPnL(profile, lot, pips) {
  const spec = getBrokerSpec(profile.broker);
  return parseFloat((lot * pips * spec.pip_value).toFixed(2));
}

// ─── FORMAT MM BLOCK (for signal messages & inline display) ───────────────────
function formatMMLines(profile, slPips, tp1Pips, tp2Pips) {
  const spec    = getBrokerSpec(profile.broker);
  const balance = Number(profile.balance) || DEFAULT_PROFILE.balance;
  const risk    = Number(profile.risk)    || DEFAULT_PROFILE.risk;

  if (profile.lot_mode === 'manual') return [];

  const riskAmt = balance * (risk / 100);
  const lot     = calcLot(profile, slPips);

  const dollarSl  = calcPnL(profile, lot, slPips);
  const dollarTp1 = calcPnL(profile, lot, tp1Pips);
  const dollarTp2 = calcPnL(profile, lot, tp2Pips);

  const rrTp1 = (dollarTp1 / dollarSl).toFixed(2);
  const rrTp2 = (dollarTp2 / dollarSl).toFixed(2);

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return [
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `💼 <b>MONEY MANAGEMENT</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `🏦 <b>Broker</b>  : <code>${spec.name}</code>`,
    `💰 <b>Balance</b> : <code>$${fmt(balance)}</code>`,
    `🎯 <b>Risk</b>    : <code>${risk}%</code>  (<code>$${fmt(riskAmt)}</code>)`,
    `📌 <b>Suggested Lot</b> : <code>${lot} lot</code>`,
    ``,
    `🛑 Jika SL <code>(${slPips} pips)</code> terkena`,
    `   ≈ <b>-$${fmt(dollarSl)}</b>`,
    ``,
    `🎯 Jika TP1 <code>(${tp1Pips} pips)</code>`,
    `   ≈ <b>+$${fmt(dollarTp1)}</b>`,
    ``,
    `🚀 Jika TP2 <code>(${tp2Pips} pips)</code>`,
    `   ≈ <b>+$${fmt(dollarTp2)}</b>`,
    ``,
    `📐 <b>Risk : Reward</b>`,
    `   TP1 = 1 : ${rrTp1}`,
    `   TP2 = 1 : ${rrTp2}`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
  ];
}

module.exports = {
  getProfile,
  saveProfile,
  calcLot,
  calcPnL,
  formatMMLines,
  getBrokerSpec,
  BROKER_SPECS,
  SUPPORTED_BROKERS,
  DEFAULT_PROFILE,
};
