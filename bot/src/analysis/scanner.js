'use strict';
/**
 * Temporary bootstrap: download known-good scanner from historical commit,
 * apply journal_store patch in-memory, write, and export.
 * Remove once full scanner.js is restored in repo.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '.scanner_decoded.js');
const URL = 'https://raw.githubusercontent.com/azascloud-cell/Azza-Vision-AI/f901572151ce8b973057649cc6d9829800a91d4d/bot/src/analysis/scanner.js';

function patch(text) {
  const oldReq = "const { recordStrategyWin, recordStrategyLoss, recordStrategyBreakeven } = require('../database/strategy_stats');";
  const newReq = oldReq + "\nconst { appendJournalEntry } = require('../database/journal_store');";
  if (text.includes(oldReq) && !text.includes('journal_store')) {
    text = text.replace(oldReq, newReq);
  }
  const oldBlock = `        try {
          const strategies    = getSignalStrategies(sig);
          const journalMsg    = await generateAITradeJournal(sig, status, price, strategies);
          await botInstance.telegram
            .sendMessage(channelId, journalMsg, { parse_mode: 'HTML' });
          console.log(\`[JOURNAL] 📝 Jurnal AI terkirim untuk trade #\${id}\`);
        } catch (journalErr) {
          console.warn('[JOURNAL] Gagal kirim jurnal:', journalErr.message);
          try {
            const strategies = getSignalStrategies(sig);
            const fallbackMsg = formatTradeJournal(sig, status, price, strategies);
            await botInstance.telegram
              .sendMessage(channelId, fallbackMsg, { parse_mode: 'HTML' });
          } catch { /* silent */ }
        }`;
  const newBlock = `        try {
          const strategies    = getSignalStrategies(sig);
          let journalMsg = null;
          let aiGenerated = true;
          try {
            journalMsg = await generateAITradeJournal(sig, status, price, strategies);
          } catch (aiErr) {
            console.warn('[JOURNAL] AI journal gagal, pakai fallback:', aiErr.message);
            journalMsg = formatTradeJournal(sig, status, price, strategies);
            aiGenerated = false;
          }
          if (!journalMsg) {
            journalMsg = formatTradeJournal(sig, status, price, strategies);
            aiGenerated = false;
          }

          await appendJournalEntry({
            signalId:   id,
            status,
            pips,
            direction:  sig.direction,
            entry:      sig.entry,
            tp1:        sig.tp1,
            tp2:        sig.tp2,
            sl:         sig.sl,
            closePrice: price,
            closedAt:   new Date().toISOString(),
            createdAt:  sig.created_at || null,
            strategies,
            confidence: sig.confidence,
            journalText: journalMsg,
            aiGenerated,
          }).catch((e) => console.warn('[JOURNAL-STORE] persist gagal:', e.message));

          await botInstance.telegram
            .sendMessage(channelId, journalMsg, { parse_mode: 'HTML' })
            .catch((e) => console.error('[JOURNAL] Gagal kirim telegram:', e.message));
          console.log(\`[JOURNAL] 📝 Jurnal tersimpan + terkirim untuk trade #\${id}\`);
        } catch (journalErr) {
          console.warn('[JOURNAL] Gagal proses jurnal:', journalErr.message);
          try {
            const strategies = getSignalStrategies(sig);
            const fallbackMsg = formatTradeJournal(sig, status, price, strategies);
            await appendJournalEntry({
              signalId: id, status, pips,
              direction: sig.direction, entry: sig.entry,
              tp1: sig.tp1, tp2: sig.tp2, sl: sig.sl,
              closePrice: price, closedAt: new Date().toISOString(),
              createdAt: sig.created_at || null, strategies,
              confidence: sig.confidence, journalText: fallbackMsg, aiGenerated: false,
            }).catch(() => {});
            await botInstance.telegram
              .sendMessage(channelId, fallbackMsg, { parse_mode: 'HTML' });
          } catch { /* silent */ }
        }`;
  if (text.includes(oldBlock)) text = text.replace(oldBlock, newBlock);
  return text;
}

let cached = null;
function loadSync() {
  if (cached) return cached;
  if (fs.existsSync(OUT)) {
    try {
      cached = require(OUT);
      return cached;
    } catch { /* rewrite */ }
  }
  const { execSync } = require('child_process');
  let text;
  try {
    text = execSync(`curl -fsSL '${URL}'`, { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  } catch (e) {
    throw new Error('Failed to restore scanner.js from historical commit: ' + e.message);
  }
  text = patch(text);
  fs.writeFileSync(OUT, text, 'utf8');
  delete require.cache[require.resolve(OUT)];
  cached = require(OUT);
  return cached;
}

module.exports = loadSync();
