/**
 * pdf_cover.js — AZZAVISION AI v5.1 Professional PDF Cover Generator
 *
 * Menghasilkan halaman cover premium (Trade Journal Edition) untuk semua
 * jenis export PDF. Dark theme, gold accent, minimalis, print-ready A4.
 *
 * Dipanggil dari export.js — jangan panggil langsung dari modul lain.
 */

'use strict';

// ─── COLOUR PALETTE ───────────────────────────────────────────────────────────
const C = {
  BG:       '#0B0C10',
  NAVY:     '#16213E',
  NAVY2:    '#1A1A2E',
  GOLD:     '#FFD700',
  GOLD2:    '#C9A84C',
  GOLD_MID: '#E8C040',
  WHITE:    '#FFFFFF',
  GRAY:     '#AAAAAA',
  GRAY2:    '#666666',
  CYAN:     '#00D4FF',
  DIM:      '#1E2030',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hexOpacity(hex, opacity) {
  // Returns a pdfkit-compatible fillOpacity workaround by using fillColor + opacity
  return hex; // colour stays the same, caller sets opacity separately
}

// Draw a rounded rectangle using pdfkit (pdfkit <0.14 has no roundedRect)
function roundedRect(doc, x, y, w, h, r) {
  const k = 0.5523; // cubic bezier approx for quarter-circle
  doc.moveTo(x + r, y)
     .lineTo(x + w - r, y)
     .bezierCurveTo(x + w - r + k * r, y, x + w, y + r - k * r, x + w, y + r)
     .lineTo(x + w, y + h - r)
     .bezierCurveTo(x + w, y + h - r + k * r, x + w - r + k * r, y + h, x + w - r, y + h)
     .lineTo(x + r, y + h)
     .bezierCurveTo(x + r - k * r, y + h, x, y + h - r + k * r, x, y + h - r)
     .lineTo(x, y + r)
     .bezierCurveTo(x, y + r - k * r, x + r - k * r, y, x + r, y)
     .closePath();
}

// Draw a thin horizontal gold rule
function goldRule(doc, x, y, w, thickness = 0.8) {
  doc.save()
     .fillColor(C.GOLD2)
     .opacity(0.7)
     .rect(x, y, w, thickness)
     .fill()
     .restore();
}

// Draw an "A" diamond logo shape in gold
function drawLogoA(doc, cx, cy, size) {
  const s = size;
  doc.save()
     .fillColor(C.GOLD)
     .opacity(1);

  // Outer diamond
  doc.moveTo(cx, cy - s)
     .lineTo(cx + s * 0.7, cy + s * 0.5)
     .lineTo(cx, cy + s * 0.2)
     .lineTo(cx - s * 0.7, cy + s * 0.5)
     .closePath()
     .fill();

  // Inner cutout (cross bar)
  doc.fillColor(C.BG)
     .opacity(1)
     .rect(cx - s * 0.35, cy + s * 0.05, s * 0.7, s * 0.18)
     .fill();

  // Inner triangle cutout
  doc.fillColor(C.BG)
     .moveTo(cx, cy - s * 0.3)
     .lineTo(cx + s * 0.35, cy + s * 0.05)
     .lineTo(cx - s * 0.35, cy + s * 0.05)
     .closePath()
     .fill();

  doc.restore();
}

// ─── BACKGROUND DECORATIONS (low opacity) ─────────────────────────────────────
function drawBackgroundDecorations(doc, W, H) {
  doc.save();

  // ── Grid lines ────────────────────────────────────────────────────────────
  doc.opacity(0.04).strokeColor(C.CYAN).lineWidth(0.5);
  const gridStep = 40;
  for (let x = 0; x < W; x += gridStep) {
    doc.moveTo(x, 0).lineTo(x, H).stroke();
  }
  for (let y = 0; y < H; y += gridStep) {
    doc.moveTo(0, y).lineTo(W, y).stroke();
  }

  // ── Chart line (background, top-right area) ────────────────────────────
  doc.opacity(0.06).strokeColor(C.GOLD).lineWidth(1.2);
  const chartPoints = [
    [W * 0.52, H * 0.12], [W * 0.58, H * 0.09], [W * 0.62, H * 0.14],
    [W * 0.67, H * 0.10], [W * 0.72, H * 0.06], [W * 0.76, H * 0.11],
    [W * 0.80, H * 0.08], [W * 0.84, H * 0.04], [W * 0.88, H * 0.10],
    [W * 0.93, H * 0.07], [W * 0.97, H * 0.13],
  ];
  doc.moveTo(...chartPoints[0]);
  for (let i = 1; i < chartPoints.length; i++) doc.lineTo(...chartPoints[i]);
  doc.stroke();

  // ── Candlestick shapes (right side, ghosted) ──────────────────────────
  doc.opacity(0.05);
  const candles = [
    { x: W * 0.75, o: H * 0.20, c: H * 0.14, h: H * 0.12, l: H * 0.22, bull: true },
    { x: W * 0.79, o: H * 0.15, c: H * 0.20, h: H * 0.13, l: H * 0.22, bull: false },
    { x: W * 0.83, o: H * 0.19, c: H * 0.13, h: H * 0.11, l: H * 0.21, bull: true },
    { x: W * 0.87, o: H * 0.14, c: H * 0.18, h: H * 0.12, l: H * 0.20, bull: false },
    { x: W * 0.91, o: H * 0.17, c: H * 0.12, h: H * 0.10, l: H * 0.19, bull: true },
  ];
  const cw = 10;
  for (const cd of candles) {
    doc.fillColor(cd.bull ? '#27AE60' : '#E74C3C').strokeColor(cd.bull ? '#27AE60' : '#E74C3C').lineWidth(1);
    // Wick
    doc.moveTo(cd.x + cw / 2, cd.h).lineTo(cd.x + cw / 2, cd.l).stroke();
    // Body
    const bodyTop = Math.min(cd.o, cd.c);
    const bodyH   = Math.abs(cd.c - cd.o);
    doc.rect(cd.x, bodyTop, cw, Math.max(1, bodyH)).fill();
  }

  // ── Neural network dots ────────────────────────────────────────────────
  doc.opacity(0.07).fillColor(C.CYAN);
  const nodes = [
    [W * 0.05, H * 0.72], [W * 0.12, H * 0.65], [W * 0.08, H * 0.80],
    [W * 0.18, H * 0.75], [W * 0.15, H * 0.60], [W * 0.25, H * 0.68],
    [W * 0.22, H * 0.82], [W * 0.30, H * 0.73],
  ];
  const edges = [
    [0,1],[0,2],[1,3],[2,3],[1,4],[3,5],[4,5],[2,6],[3,6],[5,7],[6,7],
  ];
  doc.strokeColor(C.CYAN).lineWidth(0.4);
  for (const [a, b] of edges) {
    doc.moveTo(nodes[a][0], nodes[a][1]).lineTo(nodes[b][0], nodes[b][1]).stroke();
  }
  for (const [nx, ny] of nodes) {
    doc.circle(nx, ny, 3).fill();
  }

  // ── Subtle radial glow behind hero text ───────────────────────────────
  // (simulated with semi-transparent navy ellipse)
  doc.opacity(0.15).fillColor(C.NAVY)
     .ellipse(W / 2, H * 0.61, W * 0.55, H * 0.14)
     .fill();

  doc.restore();
}

// ─── COVER GENERATOR ──────────────────────────────────────────────────────────
/**
 * drawCoverPage(doc, options)
 *
 * @param {PDFDocument} doc   - pdfkit doc instance (new page already added)
 * @param {Object} options
 *   @param {string} options.period   - 'today'|'7d'|'30d'|'all'
 *   @param {string} options.label    - human-readable period label
 *   @param {string} options.owner    - owner name (default from env)
 *   @param {string} options.version  - version string (default 'v5.1')
 */
function drawCoverPage(doc, { period, label, owner, version } = {}) {
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 40; // page margin

  const ownerName  = owner   || process.env.BOT_OWNER_NAME || 'Azza';
  const ver        = version || 'v5.1';
  const exportDate = new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const journalType = label ? `${label} Report` : 'Performance Report';

  // ── BACKGROUND ────────────────────────────────────────────────────────────
  doc.rect(0, 0, W, H).fill(C.BG);

  // ── BACKGROUND DECORATIONS ────────────────────────────────────────────────
  drawBackgroundDecorations(doc, W, H);

  // ── TOP ACCENT BAR ────────────────────────────────────────────────────────
  doc.save().fillColor(C.GOLD2).opacity(0.9)
     .rect(0, 0, W, 4).fill().restore();

  // ── HEADER: LOGO + BRAND ──────────────────────────────────────────────────
  const headerY = 36;
  drawLogoA(doc, M + 18, headerY + 14, 14);

  doc.save()
     .fillColor(C.WHITE).opacity(1)
     .font('Helvetica-Bold').fontSize(15)
     .text('AZZAVISION AI', M + 40, headerY + 4, { lineBreak: false });

  doc.fillColor(C.GRAY).font('Helvetica').fontSize(8)
     .text('PROFESSIONAL TRADING ASSISTANT', M + 40, headerY + 22, { lineBreak: false });

  // Right-side version badge
  roundedRect(doc, W - M - 54, headerY + 2, 54, 22, 4);
  doc.fillColor(C.NAVY2).opacity(0.85).fill();
  doc.fillColor(C.GOLD).opacity(1).font('Helvetica-Bold').fontSize(10)
     .text(ver, W - M - 54, headerY + 7, { width: 54, align: 'center', lineBreak: false });

  doc.restore();

  // ── TOP HORIZONTAL RULE ───────────────────────────────────────────────────
  goldRule(doc, M, headerY + 46, W - M * 2);

  // ── CENTER SECTION: HERO TEXT ─────────────────────────────────────────────
  const heroY = H * 0.38;

  // "TRADE" label — small grey eyebrow
  doc.save()
     .fillColor(C.GRAY).opacity(0.8)
     .font('Helvetica').fontSize(11)
     .text('— AZZAVISION AI PRESENTS —', 0, heroY - 28, { align: 'center', width: W });
  doc.restore();

  // Main title: TRADE JOURNAL
  doc.save()
     .fillColor(C.GOLD).opacity(1)
     .font('Helvetica-Bold').fontSize(64)
     .text('TRADE JOURNAL', 0, heroY, { align: 'center', width: W, lineBreak: false });
  doc.restore();

  // Subtitle: PERFORMANCE REPORT
  doc.save()
     .fillColor(C.WHITE).opacity(0.85)
     .font('Helvetica').fontSize(16)
     .text('P E R F O R M A N C E   R E P O R T', 0, heroY + 72, { align: 'center', width: W });
  doc.restore();

  // ── DOUBLE GOLD RULE ──────────────────────────────────────────────────────
  goldRule(doc, W * 0.15, heroY + 100, W * 0.70, 1.2);
  goldRule(doc, W * 0.25, heroY + 104, W * 0.50, 0.5);

  // ── INFO BOXES ────────────────────────────────────────────────────────────
  const boxAreaY = heroY + 125;
  const boxAreaW = W - M * 2;
  const boxGap   = 8;
  const boxItems = [
    { icon: '👤', label: 'OWNER',          value: ownerName },
    { icon: '💰', label: 'ASSET',          value: 'XAUUSD (GOLD)' },
    { icon: '🤖', label: 'TRADING SYSTEM', value: 'AZZAVISION AI\nAI + SNR / SMC' },
    { icon: '📖', label: 'JOURNAL TYPE',   value: 'Performance\nReport' },
    { icon: '⚙️',  label: 'VERSION',        value: ver },
  ];
  const boxW = (boxAreaW - boxGap * (boxItems.length - 1)) / boxItems.length;
  const boxH = 82;

  boxItems.forEach((item, i) => {
    const bx = M + i * (boxW + boxGap);
    const by = boxAreaY;

    // Box background
    doc.save();
    roundedRect(doc, bx, by, boxW, boxH, 6);
    doc.fillColor(C.NAVY2).opacity(0.75).fill();

    // Gold top accent
    roundedRect(doc, bx, by, boxW, 3, 2);
    doc.fillColor(C.GOLD2).opacity(0.9).fill();
    doc.restore();

    // Label
    doc.save()
       .fillColor(C.GRAY).opacity(0.8)
       .font('Helvetica').fontSize(6.5)
       .text(item.label, bx + 6, by + 10, { width: boxW - 12, align: 'center' });

    // Value
    doc.fillColor(C.WHITE).opacity(1)
       .font('Helvetica-Bold').fontSize(9.5)
       .text(item.value, bx + 4, by + 26, { width: boxW - 8, align: 'center', lineBreak: true });
    doc.restore();
  });

  // ── EXPORT DATE ROW ───────────────────────────────────────────────────────
  const dateY = boxAreaY + boxH + 18;
  goldRule(doc, W * 0.3, dateY - 4, W * 0.4, 0.6);
  doc.save()
     .fillColor(C.GRAY).opacity(0.7)
     .font('Helvetica').fontSize(8)
     .text('EXPORT DATE', 0, dateY, { align: 'center', width: W });
  doc.fillColor(C.WHITE).opacity(0.9)
     .font('Helvetica-Bold').fontSize(11)
     .text(exportDate, 0, dateY + 13, { align: 'center', width: W });
  doc.restore();

  // ── BOTTOM ACCENT BAR ─────────────────────────────────────────────────────
  doc.save().fillColor(C.NAVY2).opacity(0.95)
     .rect(0, H - 54, W, 54).fill();

  goldRule(doc, 0, H - 54, W, 1.5);

  // Footer text
  doc.fillColor(C.WHITE).opacity(0.9)
     .font('Helvetica-Bold').fontSize(11)
     .text('POWERED BY AZZAVISION AI', 0, H - 40, { align: 'center', width: W });
  doc.fillColor(C.GOLD2).opacity(0.8)
     .font('Helvetica-Oblique').fontSize(8.5)
     .text('"Discipline Builds Consistency."', 0, H - 24, { align: 'center', width: W });
  doc.restore();

  // ── BOTTOM ACCENT BAR LINE ────────────────────────────────────────────────
  doc.save().fillColor(C.GOLD2).opacity(0.9)
     .rect(0, H - 4, W, 4).fill().restore();
}

// ─── WATERMARK (every content page) ──────────────────────────────────────────
/**
 * drawWatermark(doc)
 * Tambahkan watermark diagonal "AZZAVISION AI" di halaman saat ini.
 */
function drawWatermark(doc) {
  const W = doc.page.width;
  const H = doc.page.height;
  doc.save();
  doc.opacity(0.04)
     .fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(52);

  // Diagonal centered
  doc.rotate(-45, { origin: [W / 2, H / 2] });
  doc.text('AZZAVISION AI', 0, H / 2 - 26, { align: 'center', width: W });

  doc.restore();
}

// ─── PAGE NUMBER (content pages only) ────────────────────────────────────────
/**
 * drawPageNumber(doc, pageNum, totalPages)
 */
function drawPageNumber(doc, pageNum, totalPages) {
  const W = doc.page.width;
  const H = doc.page.height;
  doc.save()
     .fillColor('#888888')
     .opacity(0.7)
     .font('Helvetica')
     .fontSize(8)
     .text(`Page ${pageNum} of ${totalPages}`, 0, H - 20, { align: 'center', width: W });
  doc.restore();
}

module.exports = { drawCoverPage, drawWatermark, drawPageNumber };
