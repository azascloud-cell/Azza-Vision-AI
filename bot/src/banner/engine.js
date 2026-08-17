'use strict';

// ─── AzzaVision AI — Dynamic Banner Rendering Engine ────────────────────────
// Every command-triggered banner is composed from the same reusable pieces:
//   background (theme) + Azza Chibi mascot + logo + HUD panels + live data
// No banner is ever hand-painted one-by-one — this file is the only place
// pixels get drawn. Individual banner "templates" (templates/*.js) just
// describe *what* data goes where; this engine decides *how* it looks.

const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { COLORS, ACCENTS, FONT, CANVAS_W, CANVAS_H, BRAND_NAME, BRAND_TAGLINE, FOOTER_QUOTE } = require('./theme');

const ASSETS_DIR = path.join(__dirname, 'assets');

// ─── Font registration (idempotent) ─────────────────────────────────────────
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const fontsDir = path.join(ASSETS_DIR, 'fonts');
  const register = (file, family) => {
    const p = path.join(fontsDir, file);
    if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family);
  };
  register('Rajdhani-Bold.ttf', 'AV Rajdhani');
  register('Rajdhani-SemiBold.ttf', 'AV Rajdhani SemiBold');
  register('Poppins-Bold.ttf', 'AV Poppins Bold');
  register('Poppins-SemiBold.ttf', 'AV Poppins SemiBold');
  register('Poppins-Medium.ttf', 'AV Poppins Medium');
  register('Poppins-Regular.ttf', 'AV Poppins');
  fontsRegistered = true;
}

// ─── Image cache ─────────────────────────────────────────────────────────────
const imageCache = new Map();
async function getImage(relPath) {
  if (imageCache.has(relPath)) return imageCache.get(relPath);
  const p = path.join(ASSETS_DIR, relPath);
  const img = await loadImage(p);
  imageCache.set(relPath, img);
  return img;
}

function getAccent(accentKey) {
  return ACCENTS[accentKey] || ACCENTS.gold;
}

// ─── Primitives ──────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawContainImage(ctx, img, x, y, w, h, align = 'center') {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  let dx = x + (w - dw) / 2;
  if (align === 'left') dx = x;
  if (align === 'right') dx = x + (w - dw);
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  return { dx, dy, dw, dh };
}

// ─── HUD corner brackets — reinforces the "HUD interface" theme everywhere ──
function drawCornerBrackets(ctx, x, y, w, h, len, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + len * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + len * dx, cy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlassPanel(ctx, x, y, w, h, { accentColor = COLORS.gold, radius = 18 } = {}) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = COLORS.panelFill;
  ctx.fill();
  roundRect(ctx, x, y, w, h, radius);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.panelBorderSoft;
  ctx.stroke();
  drawCornerBrackets(ctx, x, y, w, h, Math.min(26, w * 0.08), accentColor);
  ctx.restore();
}

function drawPanelHeading(ctx, x, y, w, text, accentColor) {
  ctx.save();
  ctx.font = '600 30px "AV Poppins SemiBold"';
  ctx.fillStyle = accentColor;
  ctx.textBaseline = 'top';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.fillStyle = COLORS.divider;
  ctx.fillRect(x, y + 42, w, 2);
  ctx.restore();
}

function drawKeyValueRow(ctx, x, y, w, label, value, { valueColor = COLORS.textPrimary, labelSize = 22, valueSize = 30 } = {}) {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = `400 ${labelSize}px "AV Poppins"`;
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.font = `700 ${valueSize}px "AV Rajdhani"`;
  ctx.fillStyle = valueColor;
  ctx.textAlign = 'right';
  ctx.fillText(String(value), x + w, y - 4);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawBadge(ctx, x, y, text, color, { fontSize = 30, paddingX = 26, height = 56 } = {}) {
  ctx.save();
  ctx.font = `700 ${fontSize}px "AV Rajdhani"`;
  const textWidth = ctx.measureText(text.toUpperCase()).width;
  const w = textWidth + paddingX * 2;
  roundRect(ctx, x, y, w, height, height / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#05070D';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text.toUpperCase(), x + w / 2, y + height / 2 + 2);
  ctx.textAlign = 'left';
  ctx.restore();
  return w;
}

function drawProgressBar(ctx, x, y, w, h, percent, color, label) {
  ctx.save();
  const pct = Math.max(0, Math.min(100, percent));
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  const fillW = Math.max(h, (w * pct) / 100);
  roundRect(ctx, x, y, fillW, h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (label) {
    ctx.font = `600 20px "AV Poppins SemiBold"`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(label, x + w, y - 14);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawChecklistItem(ctx, x, y, w, label, pass) {
  ctx.save();
  const color = pass ? COLORS.green : COLORS.red;
  const r = 16;
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.fillStyle = pass ? COLORS.greenSoft : COLORS.redSoft;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  if (pass) {
    ctx.beginPath();
    ctx.moveTo(x + r - 7, y + r);
    ctx.lineTo(x + r - 2, y + r + 5);
    ctx.lineTo(x + r + 8, y + r - 7);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r - 6, y + r - 6);
    ctx.lineTo(x + r + 6, y + r + 6);
    ctx.moveTo(x + r + 6, y + r - 6);
    ctx.lineTo(x + r - 6, y + r + 6);
    ctx.stroke();
  }
  ctx.font = '600 26px "AV Poppins SemiBold"';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + r * 2 + 20, y + r + 1);
  ctx.restore();
}

// ─── Shared frame: background, HUD grid overlay, logo header, mascot, footer
async function paintFrame(ctx, { accent, title, subtitle, expression, mascotAlign = 'left' }) {
  const acc = getAccent(accent);
  const bg = await getImage(`backgrounds/${acc.bg}.png`);
  drawCoverImage(ctx, bg, 0, 0, CANVAS_W, CANVAS_H);

  // subtle top-to-bottom darken so text stays legible everywhere
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Header: logo + wordmark (top-left), title block (top-right)
  try {
    const logo = await getImage('logo.png');
    ctx.drawImage(logo, 60, 54, 84, 84);
  } catch (e) {
    // logo optional — never crash a banner over a missing asset
  }
  ctx.font = '700 40px "AV Rajdhani"';
  ctx.fillStyle = COLORS.goldBright;
  ctx.textBaseline = 'top';
  ctx.fillText(BRAND_NAME, 158, 60);
  ctx.font = '500 20px "AV Poppins Medium"';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(BRAND_TAGLINE, 160, 106);

  if (title) {
    ctx.textAlign = 'right';
    ctx.font = '700 46px "AV Rajdhani"';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(title.toUpperCase(), CANVAS_W - 70, 56);
    if (subtitle) {
      ctx.font = '500 22px "AV Poppins Medium"';
      ctx.fillStyle = acc.color;
      ctx.fillText(subtitle.toUpperCase(), CANVAS_W - 70, 108);
    }
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = COLORS.divider;
  ctx.fillRect(60, 152, CANVAS_W - 120, 2);

  // ── Mascot
  if (expression) {
    try {
      const mascot = await getImage(`mascot/${expression}.png`);
      const mw = 560;
      const mh = 560;
      const mx = mascotAlign === 'left' ? 20 : CANVAS_W - mw - 20;
      const my = CANVAS_H - mh - 40;
      drawContainImage(ctx, mascot, mx, my, mw, mh, mascotAlign);
    } catch (e) {
      // mascot optional
    }
  }

  // ── Footer
  ctx.fillStyle = COLORS.divider;
  ctx.fillRect(60, CANVAS_H - 76, CANVAS_W - 120, 2);
  ctx.font = '600 22px "AV Poppins SemiBold"';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textBaseline = 'middle';
  // Start past the mascot column so the quote never overlaps her artwork.
  ctx.fillText(`“ ${FOOTER_QUOTE} ”`, 620, CANVAS_H - 40);
  ctx.textAlign = 'right';
  ctx.fillStyle = acc.color;
  ctx.fillText(new Date().toLocaleString('id-ID', { hour12: false }), CANVAS_W - 60, CANVAS_H - 40);
  ctx.textAlign = 'left';

  return acc;
}

function newCanvas() {
  ensureFonts();
  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.bgBlack;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  return { canvas, ctx };
}

module.exports = {
  newCanvas,
  paintFrame,
  getAccent,
  getImage,
  roundRect,
  drawCoverImage,
  drawContainImage,
  drawCornerBrackets,
  drawGlassPanel,
  drawPanelHeading,
  drawKeyValueRow,
  drawBadge,
  drawProgressBar,
  drawChecklistItem,
  CANVAS_W,
  CANVAS_H,
};
