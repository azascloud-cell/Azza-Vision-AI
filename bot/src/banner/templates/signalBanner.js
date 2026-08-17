'use strict';

// BUY / SELL signal banner — the highest-stakes banner in the system.
// Big directional badge + entry/SL/TP ladder + confidence/RR readouts.

const {
  newCanvas,
  paintFrame,
  drawGlassPanel,
  drawPanelHeading,
  drawKeyValueRow,
  drawBadge,
  CANVAS_W,
} = require('../engine');
const { COLORS } = require('../theme');

/**
 * @param {object} d
 * @param {'BUY'|'SELL'} d.direction
 * @param {string} d.pair
 * @param {string|number} d.entry
 * @param {string|number} d.sl
 * @param {string|number} d.tp1
 * @param {string|number} d.tp2
 * @param {string|number} d.tp3
 * @param {string} d.riskReward
 * @param {number} d.confidence
 * @param {string} d.setupTime
 */
async function renderSignalBanner(d) {
  const isBuy = d.direction === 'BUY';
  const accent = isBuy ? 'green' : 'red';
  const { canvas, ctx } = newCanvas();
  const acc = await paintFrame(ctx, {
    accent,
    title: 'AI Signal',
    subtitle: d.pair,
    expression: 'signal_found',
    mascotAlign: 'left',
  });

  const panelX = 660;
  const panelW = CANVAS_W - panelX - 70;
  let y = 200;

  // Direction hero badge + pair
  ctx.font = '700 96px "AV Rajdhani"';
  ctx.fillStyle = acc.color;
  ctx.textBaseline = 'top';
  ctx.fillText(d.direction, panelX, y);
  const dirWidth = ctx.measureText(d.direction).width;
  ctx.font = '600 40px "AV Poppins SemiBold"';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(d.pair, panelX + dirWidth + 30, y + 28);
  y += 128;

  const levelsPanelH = 320;
  drawGlassPanel(ctx, panelX, y, panelW, levelsPanelH, { accentColor: acc.color });
  drawPanelHeading(ctx, panelX + 36, y + 26, panelW - 72, 'Trade Levels', acc.color);
  const col1 = panelX + 36;
  const col2 = panelX + panelW / 2 + 10;
  const colW = panelW / 2 - 60;
  drawKeyValueRow(ctx, col1, y + 92, colW, 'Entry', d.entry, { valueColor: COLORS.textPrimary });
  drawKeyValueRow(ctx, col1, y + 166, colW, 'Stop Loss', d.sl, { valueColor: COLORS.red });
  drawKeyValueRow(ctx, col1, y + 240, colW, 'Take Profit 3', d.tp3, { valueColor: COLORS.green });
  drawKeyValueRow(ctx, col2, y + 92, colW, 'Take Profit 1', d.tp1, { valueColor: COLORS.green });
  drawKeyValueRow(ctx, col2, y + 166, colW, 'Take Profit 2', d.tp2, { valueColor: COLORS.green });
  y += levelsPanelH + 28;

  drawGlassPanel(ctx, panelX, y, panelW, 160, { accentColor: acc.color });
  drawPanelHeading(ctx, panelX + 36, y + 26, panelW - 72, 'Risk & Confidence', acc.color);
  drawKeyValueRow(ctx, col1, y + 92, colW, 'Risk Reward', d.riskReward, { valueColor: COLORS.goldBright || COLORS.gold });
  drawKeyValueRow(ctx, col2, y + 92, colW, 'Confidence', `${d.confidence}%`, { valueColor: acc.color });
  y += 160 + 28;

  drawBadge(ctx, panelX, y, `SETUP TIME: ${d.setupTime}`, 'rgba(255,255,255,0.12)', { fontSize: 22, height: 46 });

  return canvas;
}

module.exports = { renderSignalBanner };
