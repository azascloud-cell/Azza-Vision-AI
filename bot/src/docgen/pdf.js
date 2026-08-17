/**
 * pdf.js — Low-level PDF drawing helpers untuk Developer Documentation Generator
 *
 * Berisi: header/footer + nomor halaman, penomoran Daftar Isi (dua-pass
 * lewat bufferPages), bookmark/outline, dan renderer source code dengan
 * syntax highlight sederhana + nomor baris.
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const PALETTE = {
  bg: '#0B0C10',
  gold: '#C9A84C',
  goldBright: '#FFD700',
  ink: '#1A1A2E',
  text: '#222222',
  muted: '#6B6B6B',
  rule: '#D9D2BE',
  codeBg: '#101218',
  codeText: '#E6E6E6',
  codeGutter: '#5A5F6E',
  codeKeyword: '#7FB2FF',
  codeString: '#8FD08F',
  codeComment: '#7A7F8C',
  codeNumber: '#D8A657',
};

const PAGE_MARGIN = 56;

function drawPageChrome(doc, { title, pageLabel, pageNum, totalPages }) {
  const { width, height } = doc.page;

  // Header
  doc.save();
  doc.fontSize(8).font('Helvetica').fillColor(PALETTE.muted);
  doc.text('AZZAVISION AI — Developer Documentation', PAGE_MARGIN, 24, { width: width - PAGE_MARGIN * 2, continued: false, lineBreak: false });
  doc.text(title || '', PAGE_MARGIN, 24, { width: width - PAGE_MARGIN * 2, align: 'right', lineBreak: false });
  doc.moveTo(PAGE_MARGIN, 38).lineTo(width - PAGE_MARGIN, 38).lineWidth(0.5).strokeColor(PALETTE.rule).stroke();
  doc.restore();

  // Footer (posisi ini sengaja di luar margin bawah normal. pdfkit
  // menghitung batas overflow dari page.margins.bottom TERLEPAS dari
  // lineBreak:false, jadi margin bawah dinolkan sementara supaya tidak
  // memicu doc.addPage() otomatis di tengah proses stamping halaman).
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.fontSize(8).font('Helvetica').fillColor(PALETTE.muted);
  doc.moveTo(PAGE_MARGIN, height - 34).lineTo(width - PAGE_MARGIN, height - 34).lineWidth(0.5).strokeColor(PALETTE.rule).stroke();
  doc.text(pageLabel || 'AzzaVision AI', PAGE_MARGIN, height - 26, { width: width - PAGE_MARGIN * 2, lineBreak: false });
  if (pageNum != null) {
    const label = totalPages ? `Halaman ${pageNum} / ${totalPages}` : `Halaman ${pageNum}`;
    doc.text(label, PAGE_MARGIN, height - 26, { width: width - PAGE_MARGIN * 2, align: 'right', lineBreak: false });
  }
  doc.restore();
  doc.page.margins.bottom = originalBottomMargin;
}

/** Setelah semua konten selesai, tempel header/footer + nomor halaman ke setiap halaman isi. */
function stampAllPages(doc, { title, pageLabel, skipPages = new Set() }) {
  const range = doc.bufferedPageRange();
  const totalContentPages = range.count - skipPages.size;
  let n = 0;
  for (let i = range.start; i < range.start + range.count; i++) {
    if (skipPages.has(i)) continue;
    n += 1;
    doc.switchToPage(i);
    drawPageChrome(doc, { title, pageLabel, pageNum: n, totalPages: totalContentPages });
  }
}

function addSectionHeading(doc, number, title) {
  doc.addPage();
  const pageIndex = doc.bufferedPageRange().count - 1;
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(PALETTE.gold).text(`BAB ${number}`, { characterSpacing: 1 });
  doc.moveDown(0.3);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(PALETTE.ink).text(title);
  doc.moveDown(0.4);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(1.5).strokeColor(PALETTE.gold).stroke();
  doc.moveDown(1);
  doc.fontSize(10.5).font('Helvetica').fillColor(PALETTE.text);

  // Rekam untuk Daftar Isi + bookmark PDF (dibaca oleh generate.js)
  doc.__toc = doc.__toc || [];
  doc.__toc.push({ number, title, pageIndex });
  try {
    if (doc.outline) doc.outline.addItem(title);
  } catch { /* outline opsional, jangan gagalkan generate */ }

  return pageIndex;
}

function h2(doc, title) {
  doc.moveDown(0.8);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(PALETTE.ink).text(title);
  doc.moveDown(0.3);
  doc.fontSize(10.5).font('Helvetica').fillColor(PALETTE.text);
}

function bodyText(doc, text, opts = {}) {
  doc.font('Helvetica').fontSize(10.5).fillColor(PALETTE.text).text(text, opts);
}

function bullet(doc, text) {
  doc.font('Helvetica').fontSize(10.5).fillColor(PALETTE.text).text(`•  ${text}`, { indent: 8 });
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - PAGE_MARGIN - 30;
  if (doc.y + needed > bottom) {
    doc.addPage();
    return true;
  }
  return false;
}

// ─── SOURCE CODE SYNTAX HIGHLIGHT (sederhana) ────────────────────────────────

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'require', 'module', 'exports', 'async', 'await', 'class', 'new', 'typeof',
  'instanceof', 'try', 'catch', 'finally', 'switch', 'case', 'break',
  'continue', 'default', 'extends', 'static', 'get', 'set', 'this', 'super',
  'export', 'import', 'from', 'of', 'in', 'do', 'throw', 'yield', 'null',
  'undefined', 'true', 'false', 'delete', 'void',
]);

const TOKEN_RE = /(\/\/.*$)|(`(?:[^`\\]|\\.)*`)|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|(\s+)|([^\sA-Za-z0-9_$]+)/g;

function tokenizeLine(line) {
  const tokens = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const [full, comment, tmpl, sq, dq, num, word, ws, sym] = m;
    if (comment) tokens.push({ text: comment, color: PALETTE.codeComment });
    else if (tmpl || sq || dq) tokens.push({ text: full, color: PALETTE.codeString });
    else if (num) tokens.push({ text: full, color: PALETTE.codeNumber });
    else if (word) tokens.push({ text: full, color: KEYWORDS.has(word) ? PALETTE.codeKeyword : PALETTE.codeText });
    else tokens.push({ text: full, color: PALETTE.codeText });
    if (m.index === TOKEN_RE.lastIndex) TOKEN_RE.lastIndex++; // safety
  }
  return tokens;
}

const CODE_FONT = 'Courier';
const CODE_SIZE = 7.6;
const GUTTER_W = 34;

function drawCodeBackgroundForPage(doc) {
  doc.save();
  doc.rect(PAGE_MARGIN - 8, 48, doc.page.width - (PAGE_MARGIN - 8) * 2, doc.page.height - 48 - 44)
    .fill(PALETTE.codeBg);
  doc.restore();
  doc.fillColor(PALETTE.codeText);
}

/**
 * Render satu file source code lengkap, dimulai di halaman baru,
 * dengan nomor baris + syntax highlight sederhana. Otomatis pindah
 * halaman jika file panjang.
 */
function renderSourceFile(doc, relPath, content, lineCounterRef) {
  doc.addPage();
  drawCodeBackgroundForPage(doc);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(PALETTE.goldBright)
    .text(`File: ${relPath}`, PAGE_MARGIN, 56, { width: doc.page.width - PAGE_MARGIN * 2 });
  doc.moveDown(0.4);
  let y = doc.y + 4;

  const lines = content.split(/\r\n|\r|\n/);
  const lineHeight = CODE_SIZE + 3.2;
  const bottom = doc.page.height - 48;

  lines.forEach((line, idx) => {
    if (y + lineHeight > bottom) {
      doc.addPage();
      drawCodeBackgroundForPage(doc);
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(PALETTE.muted === PALETTE.text ? PALETTE.codeComment : '#9AA0AE')
        .text(`File: ${relPath} (lanjutan)`, PAGE_MARGIN, 56);
      y = doc.y + 8;
    }
    const lineNo = idx + 1;
    doc.font(CODE_FONT).fontSize(CODE_SIZE).fillColor(PALETTE.codeGutter)
      .text(String(lineNo).padStart(5, ' '), PAGE_MARGIN, y, { continued: false, lineBreak: false });

    const tokens = tokenizeLine(line.replace(/\t/g, '    '));
    let x = PAGE_MARGIN + GUTTER_W;
    doc.font(CODE_FONT).fontSize(CODE_SIZE);
    for (const tok of tokens) {
      if (tok.text === '') continue;
      doc.fillColor(tok.color).text(tok.text, x, y, { continued: false, lineBreak: false });
      x += doc.widthOfString(tok.text, { font: CODE_FONT, size: CODE_SIZE });
    }
    y += lineHeight;
    if (lineCounterRef) lineCounterRef.count += 1;
  });
}

module.exports = {
  PALETTE,
  PAGE_MARGIN,
  drawPageChrome,
  stampAllPages,
  addSectionHeading,
  h2,
  bodyText,
  bullet,
  ensureSpace,
  renderSourceFile,
  tokenizeLine,
};
