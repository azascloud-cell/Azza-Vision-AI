'use strict';

// Generic "data panel" layout used by every informational banner (scanner,
// news, journal, dashboard, reports, risk mgmt, strategy stats, ai analysis,
// retrain, backup, restore, profile, settings, export previews, notifications).
// A banner type only needs to describe its `sections` — this file lays them
// out on the shared frame consistently.

const {
  newCanvas,
  paintFrame,
  drawGlassPanel,
  drawPanelHeading,
  drawKeyValueRow,
  drawProgressBar,
  getAccent,
  CANVAS_W,
} = require('../engine');
const { COLORS } = require('../theme');

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} opts.accent  gold|green|red|blue
 * @param {string} opts.expression  mascot asset key
 * @param {{heading:string, rows:{label:string, value:string, color?:string}[], progress?:{percent:number,label?:string,color?:string}}[]} opts.sections
 * @param {string} [opts.badgeText]
 */
async function renderInfoBanner(opts) {
  const { canvas, ctx } = newCanvas();
  const acc = await paintFrame(ctx, {
    accent: opts.accent,
    title: opts.title,
    subtitle: opts.subtitle,
    expression: opts.expression,
    mascotAlign: 'left',
  });

  const panelX = 660;
  const panelW = CANVAS_W - panelX - 70;
  let y = 200;
  const gap = 28;

  for (const section of opts.sections) {
    const rows = section.rows || [];
    const hasProgress = !!section.progress;
    const rowHeight = 74;
    const panelH = 78 + rows.length * rowHeight + (hasProgress ? 70 : 0);

    drawGlassPanel(ctx, panelX, y, panelW, panelH, { accentColor: acc.color });
    drawPanelHeading(ctx, panelX + 36, y + 26, panelW - 72, section.heading, acc.color);

    let ry = y + 92;
    for (const row of rows) {
      drawKeyValueRow(ctx, panelX + 36, ry, panelW - 72, row.label, row.value, {
        valueColor: row.color || COLORS.textPrimary,
      });
      ry += rowHeight;
    }
    if (hasProgress) {
      drawProgressBar(
        ctx,
        panelX + 36,
        ry + 26,
        panelW - 72,
        18,
        section.progress.percent,
        section.progress.color || acc.color,
        section.progress.label || `${section.progress.percent}%`
      );
    }
    y += panelH + gap;
  }

  return canvas;
}

module.exports = { renderInfoBanner };
