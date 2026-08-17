/**
 * cover.js — Halaman cover + Daftar Isi Developer Documentation Generator
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PALETTE, PAGE_MARGIN } = require('./pdf');

function drawCover(doc, ctx) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill(PALETTE.bg);

  // decorative grid
  doc.save();
  doc.opacity(0.06).strokeColor(PALETTE.gold).lineWidth(0.5);
  for (let x = 0; x < width; x += 40) doc.moveTo(x, 0).lineTo(x, height).stroke();
  for (let y = 0; y < height; y += 40) doc.moveTo(0, y).lineTo(width, y).stroke();
  doc.restore();

  // logo
  const logoPath = path.join(ctx.root, 'src/banner/assets/logo.png');
  let logoDrawn = false;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, width / 2 - 60, 90, { width: 120, height: 120, fit: [120, 120] });
      logoDrawn = true;
    } catch { /* fallback below */ }
  }
  if (!logoDrawn) {
    doc.save();
    doc.circle(width / 2, 150, 55).fillOpacity(1).fillColor(PALETTE.gold).fill();
    doc.fillColor(PALETTE.bg).fontSize(40).font('Helvetica-Bold')
      .text('A', width / 2 - 55, 122, { width: 110, align: 'center' });
    doc.restore();
  }

  doc.fillColor(PALETTE.gold).fontSize(10).font('Helvetica-Bold')
    .text('DEVELOPER DOCUMENTATION', 0, 240, { width, align: 'center', characterSpacing: 2 });

  doc.fillColor('#FFFFFF').fontSize(30).font('Helvetica-Bold')
    .text(ctx.pkg.name || 'AzzaVision AI', 0, 262, { width, align: 'center' });

  doc.fillColor('#B9BEC9').fontSize(12).font('Helvetica')
    .text(ctx.pkg.description || 'AI Trading Assistant', 0, 302, { width, align: 'center' });

  doc.moveTo(width / 2 - 90, 340).lineTo(width / 2 + 90, 340).lineWidth(1).strokeColor(PALETTE.gold).stroke();

  const rows = [
    ['Nama Project', ctx.pkg.name || '-'],
    ['Versi Project', ctx.pkg.version || '-'],
    ['Tanggal Generate', ctx.generatedAt],
    ['Total File', String(ctx.totalFiles)],
    ['Total Source Code', `${ctx.sourceFileCount} file`],
    ['Mode Dokumen', ctx.modeLabel],
  ];

  let y = 370;
  doc.fontSize(11);
  for (const [label, value] of rows) {
    doc.font('Helvetica').fillColor('#8A8F9C').text(label, width / 2 - 160, y, { width: 150, align: 'left' });
    doc.font('Helvetica-Bold').fillColor('#FFFFFF').text(value, width / 2 - 5, y, { width: 170, align: 'left' });
    y += 24;
  }

  doc.fontSize(9).fillColor('#5C6070').font('Helvetica')
    .text('Dokumen ini dihasilkan otomatis untuk dibaca oleh AI assistant (Kimi, Claude, Gemini, GPT, dsb).', 0, height - 92, { width, align: 'center', lineBreak: false });
  doc.text('Semua kredensial (token, API key, password, secret) telah disensor otomatis.', 0, height - 78, { width, align: 'center', lineBreak: false });
}

/**
 * Menggambar Daftar Isi. `entries` = [{ number, title, pageIndex }]
 * `pageIndex` adalah index halaman buffer (0-based) — dikonversi ke nomor
 * halaman final oleh caller setelah tahu berapa halaman TOC sendiri.
 */
function drawToc(doc, entries, resolvePageNumber) {
  const { width } = doc.page;
  doc.fillColor(PALETTE.ink).fontSize(22).font('Helvetica-Bold').text('Daftar Isi', PAGE_MARGIN, 70);
  doc.moveTo(PAGE_MARGIN, 100).lineTo(width - PAGE_MARGIN, 100).lineWidth(1.5).strokeColor(PALETTE.gold).stroke();
  let y = 118;
  const rowH = 22;
  for (const entry of entries) {
    if (y + rowH > doc.page.height - 70) {
      doc.addPage();
      y = 60;
    }
    const pageNum = resolvePageNumber(entry.pageIndex);
    doc.font('Helvetica').fontSize(11).fillColor(PALETTE.text)
      .text(`${entry.number}.`, PAGE_MARGIN, y, { width: 26 });
    doc.text(entry.title, PAGE_MARGIN + 26, y, { width: width - PAGE_MARGIN * 2 - 70 });
    doc.font('Helvetica-Bold').fillColor(PALETTE.gold)
      .text(String(pageNum), width - PAGE_MARGIN - 40, y, { width: 40, align: 'right' });
    y += rowH;
  }
}

module.exports = { drawCover, drawToc };
