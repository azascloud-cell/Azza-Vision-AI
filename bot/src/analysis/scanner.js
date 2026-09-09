'use strict';
/**
 * Bootstrap: fetch scanner source via GitHub Git Blob API
 * (auth with GH_PAT or GITHUB_TOKEN), inject journal_store, write, export.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT = path.join(__dirname, '.scanner_decoded.js');
const BLOB_SHA = 'f901572151ce8b973057649cc6d9829800a91d4d';
const REPO = process.env.GH_REPO || process.env.GITHUB_REPOSITORY || 'azascloud-cell/Azza-Vision-AI';
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN || '';

function fetchBlob() {
  const url = `https://api.github.com/repos/${REPO}/git/blobs/${BLOB_SHA}`;
  const auth = TOKEN ? `-H "Authorization: Bearer ${TOKEN}"` : '';
  const cmd = `curl -fsSL ${auth} -H "Accept: application/vnd.github+json" -H "User-Agent: azzavision-boot" "${url}"`;
  console.log('[SCANNER-BOOT] fetching blob', BLOB_SHA, 'token=', TOKEN ? 'yes' : 'no');
  const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 90000 });
  const data = JSON.parse(raw);
  if (!data.content) throw new Error('blob has no content');
  const text = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  if (text.length < 5000) throw new Error('decoded too small: ' + text.length);
  return text;
}

function injectJournal(text) {
  const needle =
    "const { recordStrategyWin, recordStrategyLoss, recordStrategyBreakeven } = require('../database/strategy_stats');";
  if (text.includes(needle) && !text.includes('journal_store')) {
    text = text.replace(
      needle,
      needle + "\nconst { appendJournalEntry } = require('../database/journal_store');"
    );
    console.log('[SCANNER-BOOT] journal_store require injected');
  }
  return text;
}

function load() {
  if (fs.existsSync(OUT) && fs.statSync(OUT).size > 5000) {
    try {
      return require(OUT);
    } catch (e) {
      console.warn('[SCANNER-BOOT] bad cache, re-fetch:', e.message);
      try { fs.unlinkSync(OUT); } catch (_) {}
    }
  }
  let text = fetchBlob();
  text = injectJournal(text);
  fs.writeFileSync(OUT, text, 'utf8');
  console.log('[SCANNER-BOOT] wrote', OUT, text.length, 'bytes');
  return require(OUT);
}

module.exports = load();
