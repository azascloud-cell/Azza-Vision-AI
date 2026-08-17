'use strict';

// ─── AzzaVision AI — Dynamic Banner Generator (public entrypoint) ──────────
//
//   background + Azza Chibi + Data Trading + Logo + HUD + Text
//                              ↓
//                     Render PNG automatically
//
// Usage from any bot command:
//
//   const { renderBanner, saveBanner } = require('../../banner');
//   const buffer = await renderBanner('signal_buy', { pair: 'XAUUSD', ... });
//   await ctx.replyWithPhoto({ source: buffer });

const path = require('path');
const fs = require('fs/promises');
const { REGISTRY } = require('./registry');
const { renderInfoBanner } = require('./templates/infoBanner');
const { renderSignalBanner } = require('./templates/signalBanner');
const { renderHeroStat } = require('./templates/tradeOutcome');
const { renderWhyNotEntry } = require('./templates/whyNotEntry');

/**
 * Render a banner type to a PNG Buffer.
 * @param {string} type one of the keys in registry.js
 * @param {object} data live data merged on top of the type's defaults
 * @returns {Promise<Buffer>}
 */
async function renderBanner(type, data = {}) {
  const def = REGISTRY[type];
  if (!def) {
    throw new Error(`[banner] Unknown banner type "${type}". Known types: ${Object.keys(REGISTRY).join(', ')}`);
  }

  const merged = { ...def, ...data };
  let canvas;

  switch (def.layout) {
    case 'signal':
      canvas = await renderSignalBanner({ direction: def.subtitle, ...data });
      break;
    case 'hero':
      canvas = await renderHeroStat({
        accent: merged.accent,
        title: merged.title,
        subtitle: merged.subtitle,
        expression: merged.expression,
        heroLabel: data.heroLabel,
        heroValue: data.heroValue,
        heroColor: data.heroColor,
        rows: data.rows,
        badgeText: data.badgeText,
      });
      break;
    case 'whyNotEntry':
      canvas = await renderWhyNotEntry({ pair: data.pair, checklist: data.checklist || [] });
      break;
    case 'info':
    default:
      canvas = await renderInfoBanner({
        accent: merged.accent,
        title: merged.title,
        subtitle: merged.subtitle,
        expression: merged.expression,
        sections: data.sections || [],
      });
      break;
  }

  return canvas.encode ? canvas.encode('png') : canvas.toBuffer('image/png');
}

/**
 * Render and write a banner PNG to disk. Returns the absolute file path.
 * @param {string} type
 * @param {object} data
 * @param {string} outPath workspace/absolute path to write the PNG to
 */
async function saveBanner(type, data, outPath) {
  const buffer = await renderBanner(type, data);
  const abs = path.isAbsolute(outPath) ? outPath : path.resolve(outPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return abs;
}

module.exports = { renderBanner, saveBanner, REGISTRY };
