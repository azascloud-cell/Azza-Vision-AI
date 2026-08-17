'use strict';

// Shared "big hero number" layout for the three outcome banners: Almost TP,
// TP Hit and Stop Loss. Each is the same shape (headline stat + a couple of
// supporting rows) with different color language and copy.

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

async function renderHeroStat({ accent, title, subtitle, expression, heroLabel, heroValue, heroColor, rows, badgeText }) {
  const { canvas, ctx } = newCanvas();
  const acc = await paintFrame(ctx, { accent, title, subtitle, expression, mascotAlign: 'left' });

  const panelX = 660;
  const panelW = CANVAS_W - panelX - 70;
  let y = 200;

  drawGlassPanel(ctx, panelX, y, panelW, 240, { accentColor: acc.color });
  ctx.font = '600 26px "AV Poppins SemiBold"';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textBaseline = 'top';
  ctx.fillText(heroLabel.toUpperCase(), panelX + 36, y + 30);
  ctx.font = '700 108px "AV Rajdhani"';
  ctx.fillStyle = heroColor || acc.color;
  ctx.fillText(String(heroValue), panelX + 36, y + 70);
  y += 240 + 28;

  if (rows && rows.length) {
    const rowHeight = 74;
    const panelH = 78 + rows.length * rowHeight;
    drawGlassPanel(ctx, panelX, y, panelW, panelH, { accentColor: acc.color });
    drawPanelHeading(ctx, panelX + 36, y + 26, panelW - 72, 'Details', acc.color);
    let ry = y + 92;
    for (const row of rows) {
      drawKeyValueRow(ctx, panelX + 36, ry, panelW - 72, row.label, row.value, {
        valueColor: row.color || COLORS.textPrimary,
      });
      ry += rowHeight;
    }
    y += panelH + 28;
  }

  if (badgeText) {
    drawBadge(ctx, panelX, y, badgeText, acc.color, { fontSize: 26, height: 54 });
  }

  return canvas;
}

module.exports = { renderHeroStat };
