'use strict';
/**
 * Emergency bootstrap — restore full scanner.js from known-good commit SHA.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT = path.join(__dirname, '.scanner_decoded.js');
const URL =
  'https://raw.githubusercontent.com/azascloud-cell/Azza-Vision-AI/f901572151ce8b973057649cc6d9829800a91d4d/bot/src/analysis/scanner.js';

function download() {
  console.log('[SCANNER-BOOT] restoring scanner from commit f901572...');
  const text = execSync(`curl -fsSL "${URL}"`, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 90000,
  });
  if (!text || text.length < 5000) {
    throw new Error('[SCANNER-BOOT] download too small: ' + (text ? text.length : 0));
  }
  let out = text;
  const needle =
    "const { recordStrategyWin, recordStrategyLoss, recordStrategyBreakeven } = require('../database/strategy_stats');";
  if (out.includes(needle) && !out.includes('journal_store')) {
    out = out.replace(
      needle,
      needle + "\nconst { appendJournalEntry } = require('../database/journal_store');"
    );
    console.log('[SCANNER-BOOT] injected journal_store require');
  }
  fs.writeFileSync(OUT, out, 'utf8');
  console.log('[SCANNER-BOOT] saved', OUT, out.length, 'bytes');
  return out;
}

if (!fs.existsSync(OUT) || fs.statSync(OUT).size < 5000) {
  download();
}

module.exports = require(OUT);
