'use strict';

// "Kenapa Belum Entry?" — automatic checklist banner. Any failed condition
// shows a red cross so the user immediately sees why the AI is waiting.

const { newCanvas, paintFrame, drawGlassPanel, drawPanelHeading, drawChecklistItem, CANVAS_W } = require('../engine');

/**
 * @param {{pair:string, checklist:{label:string, pass:boolean}[]}} d
 */
async function renderWhyNotEntry(d) {
  const { canvas, ctx } = newCanvas();
  const acc = await paintFrame(ctx, {
    accent: 'gold',
    title: 'Why Not Entry?',
    subtitle: d.pair,
    expression: 'why_not_entry',
    mascotAlign: 'left',
  });

  const panelX = 660;
  const panelW = CANVAS_W - panelX - 70;
  const y = 200;
  const rowH = 84;
  const panelH = 78 + d.checklist.length * rowH;

  drawGlassPanel(ctx, panelX, y, panelW, panelH, { accentColor: acc.color });
  drawPanelHeading(ctx, panelX + 36, y + 26, panelW - 72, 'Confirmation Checklist', acc.color);

  let ry = y + 96;
  for (const item of d.checklist) {
    drawChecklistItem(ctx, panelX + 36, ry, panelW - 72, item.label, item.pass);
    ry += rowH;
  }

  return canvas;
}

module.exports = { renderWhyNotEntry };
