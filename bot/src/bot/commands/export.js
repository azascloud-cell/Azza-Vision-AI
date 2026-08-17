'use strict';

const { getAllSignals } = require('../../database/db');
const path = require('path');
const os   = require('os');
const fs   = require('fs');
const { drawCoverPage, drawWatermark, drawPageNumber } = require('../../utils/pdf_cover');
const { renderBanner } = require('../../banner');

// ─── PERIOD FILTER ────────────────────────────────────────────────────────────
function filterByPeriod(signals, period) {
  const now = Date.now();
  if (period === 'today') {
    const { todayWIB } = require('../../utils/wib_time');
    const today = todayWIB();
    return signals.filter(s => s.created_at && s.created_at.startsWith(today));
  }
  if (period === '7d') {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    return signals.filter(s => new Date(s.created_at).getTime() >= cutoff);
  }
  if (period === '30d') {
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    return signals.filter(s => new Date(s.created_at).getTime() >= cutoff);
  }
  return signals; // 'all'
}

function periodLabel(period) {
  if (period === 'today') return 'Hari Ini';
  if (period === '7d')    return '7 Hari';
  if (period === '30d')   return '30 Hari';
  return 'Semua Data';
}

// ─── STATISTICS COMPUTATION ───────────────────────────────────────────────────
function computeStats(signals) {
  const closed    = signals.filter(s => s.status !== 'OPEN');
  const wins      = closed.filter(s => s.status === 'WIN');
  const losses    = closed.filter(s => s.status === 'LOSS');
  const bes       = closed.filter(s => s.status === 'BREAKEVEN');

  const totalPips = closed.reduce((a, s) => a + (s.pips || 0), 0);
  const winPips   = wins.reduce((a, s)   => a + (s.pips || 0), 0);
  const lossPips  = Math.abs(losses.reduce((a, s) => a + (s.pips || 0), 0));
  const avgPips   = closed.length > 0 ? (totalPips / closed.length).toFixed(2) : '0.00';

  const decided  = wins.length + losses.length;
  const winRate  = decided > 0 ? ((wins.length / decided) * 100).toFixed(2) : '0.00';
  const pf       = lossPips > 0 ? (winPips / lossPips).toFixed(2) : wins.length > 0 ? '∞' : '0.00';

  let maxConsecW = 0, maxConsecL = 0, curW = 0, curL = 0;
  for (const s of closed) {
    if (s.status === 'WIN') {
      curW++; curL = 0;
      if (curW > maxConsecW) maxConsecW = curW;
    } else if (s.status === 'LOSS') {
      curL++; curW = 0;
      if (curL > maxConsecL) maxConsecL = curL;
    } else {
      curW = 0; curL = 0;
    }
  }

  return {
    total:    signals.length,
    closed:   closed.length,
    wins:     wins.length,
    losses:   losses.length,
    bes:      bes.length,
    open:     signals.filter(s => s.status === 'OPEN').length,
    netPips:  totalPips.toFixed(2),
    avgPips,
    winRate,
    profitFactor: pf,
    maxConsecW,
    maxConsecL,
  };
}

// ─── PIP STRING HELPER ────────────────────────────────────────────────────────
function pipStr(s) {
  if (s.status === 'OPEN')       return 'OPEN';
  if (s.status === 'BREAKEVEN')  return 'BE';
  const v = s.pips || 0;
  return (v >= 0 ? '+' : '') + v + ' pips';
}

// ─── EMOJI STRIPPER ───────────────────────────────────────────────────────────
function stripEmoji(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/\p{Emoji_Presentation}/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u200D\uFE0F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── FILE SIZE CHECK ──────────────────────────────────────────────────────────
function assertFileSize(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[EXPORT] File ${label} tidak ditemukan di: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw new Error(`[EXPORT] File ${label} berukuran 0 byte — kemungkinan gagal generate.`);
  }
  console.log(`[EXPORT] File check OK — ${label}: ${stat.size} bytes di ${filePath}`);
  return stat.size;
}

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────
async function generateExcel(period) {
  console.log(`[EXPORT] Start generate Excel — period: ${period}`);
  const ExcelJS = require('exceljs');
  const all     = await getAllSignals();
  console.log(`[EXPORT] Data loaded — ${all.length} total signals`);
  const signals = filterByPeriod(all, period);
  const stats   = computeStats(signals);
  const label   = periodLabel(period);
  console.log(`[EXPORT] Filtered to ${signals.length} signals for period '${period}'`);

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'AZZAVISION AI';
  wb.created  = new Date();

  // ── Sheet 1: Trade History ──────────────────────────────────────────────────
  const ws = wb.addWorksheet('Trade History');

  const headerFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
  const headerFont  = { color: { argb: 'FFFFD700' }, bold: true, name: 'Calibri', size: 11 };
  const headerAlign = { horizontal: 'center', vertical: 'middle' };
  const border      = { style: 'thin', color: { argb: 'FF888888' } };
  const borders     = { top: border, left: border, bottom: border, right: border };

  ws.columns = [
    { header: 'ID',      key: 'id',     width: 8  },
    { header: 'Date',    key: 'date',   width: 20 },
    { header: 'Pair',    key: 'pair',   width: 10 },
    { header: 'Side',    key: 'side',   width: 8  },
    { header: 'Entry',   key: 'entry',  width: 12 },
    { header: 'Exit',    key: 'exit',   width: 12 },
    { header: 'TP1',     key: 'tp1',    width: 12 },
    { header: 'SL',      key: 'sl',     width: 12 },
    { header: 'Result',  key: 'result', width: 12 },
    { header: 'Pips',    key: 'pips',   width: 14 },
    { header: 'Status',  key: 'status', width: 12 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill      = headerFill;
    cell.font      = headerFont;
    cell.alignment = headerAlign;
    cell.border    = borders;
  });
  headerRow.height = 22;

  const sorted = [...signals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  sorted.forEach((s, i) => {
    const isWin  = s.status === 'WIN';
    const isLoss = s.status === 'LOSS';
    const isBe   = s.status === 'BREAKEVEN';

    const row = ws.addRow({
      id:     s.id,
      date:   s.created_at ? require('../../utils/wib_time').isoToWIBShort(s.created_at) : '-',
      pair:   s.pair || 'XAUUSD',
      side:   s.direction || '-',
      entry:  s.entry   || '-',
      exit:   s.close_price != null ? s.close_price : (s.closed_at ? (s.entry || '-') : '-'),
      tp1:    s.tp1     || '-',
      sl:     s.sl      || '-',
      result: s.status  || '-',
      pips:   pipStr(s),
      status: s.status  || '-',
    });

    const bg = i % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF';
    row.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border    = borders;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const resultCell = row.getCell('result');
    const pipsCell   = row.getCell('pips');
    if (isWin) {
      resultCell.font = { color: { argb: 'FF27AE60' }, bold: true };
      pipsCell.font   = { color: { argb: 'FF27AE60' }, bold: true };
    } else if (isLoss) {
      resultCell.font = { color: { argb: 'FFE74C3C' }, bold: true };
      pipsCell.font   = { color: { argb: 'FFE74C3C' }, bold: true };
    } else if (isBe) {
      resultCell.font = { color: { argb: 'FFF39C12' }, bold: true };
    }

    const sideCell = row.getCell('side');
    if (s.direction === 'BUY') {
      sideCell.font = { color: { argb: 'FF27AE60' }, bold: true };
    } else if (s.direction === 'SELL') {
      sideCell.font = { color: { argb: 'FFE74C3C' }, bold: true };
    }

    row.height = 18;
  });

  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Sheet 2: Summary ────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Summary');

  const titleFont   = { bold: true, size: 14, color: { argb: 'FF1A1A2E' }, name: 'Calibri' };
  const labelFont   = { bold: true, size: 11, name: 'Calibri' };
  const valueFont   = { size: 11, name: 'Calibri' };
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
  const sectionFont = { color: { argb: 'FFFFD700' }, bold: true, size: 12, name: 'Calibri' };

  ws2.getColumn('A').width = 30;
  ws2.getColumn('B').width = 22;

  const addTitle = (text) => {
    const row = ws2.addRow([text]);
    row.getCell(1).font      = titleFont;
    row.getCell(1).alignment = { horizontal: 'center' };
    ws2.mergeCells(`A${row.number}:B${row.number}`);
    row.height = 28;
  };
  const addSection = (text) => {
    const row = ws2.addRow([text, '']);
    row.getCell(1).fill = sectionFill;
    row.getCell(1).font = sectionFont;
    row.getCell(2).fill = sectionFill;
    ws2.mergeCells(`A${row.number}:B${row.number}`);
    row.height = 20;
  };
  const addRow2 = (label, value, valColor) => {
    const row = ws2.addRow([label, value]);
    row.getCell(1).font = labelFont;
    const vc = row.getCell(2);
    vc.font      = valColor ? { ...valueFont, color: { argb: valColor }, bold: true } : valueFont;
    vc.alignment = { horizontal: 'right' };
    row.height   = 18;
  };
  const addBlank = () => ws2.addRow([]);

  addTitle('AZZAVISION AI — Performance Summary');
  addBlank();
  ws2.addRow(['Periode :', label]).height = 16;
  ws2.addRow(['Dicetak :', new Date().toLocaleString('id-ID')]).height = 16;
  addBlank();

  addSection('RINGKASAN TRADE');
  addRow2('Total Trade',    stats.total);
  addRow2('Trade Selesai',  stats.closed);
  addRow2('Trade Terbuka',  stats.open);
  addRow2('Win',            stats.wins,    'FF27AE60');
  addRow2('Loss',           stats.losses,  'FFE74C3C');
  addRow2('Breakeven',      stats.bes,     'FFF39C12');
  addBlank();

  addSection('PERFORMA');
  addRow2('Win Rate (%)',           stats.winRate + '%', parseFloat(stats.winRate) >= 60 ? 'FF27AE60' : 'FFE74C3C');
  addRow2('Net Pips',               (parseFloat(stats.netPips) >= 0 ? '+' : '') + stats.netPips, parseFloat(stats.netPips) >= 0 ? 'FF27AE60' : 'FFE74C3C');
  addRow2('Average Pips per Trade', stats.avgPips);
  addRow2('Profit Factor',          stats.profitFactor);
  addRow2('Max Consecutive Wins',   stats.maxConsecW);
  addRow2('Max Consecutive Losses', stats.maxConsecL);
  addBlank();

  ws2.addRow(['Powered by AZZAVISION AI v5.1']).getCell(1).font = { italic: true, color: { argb: 'FF888888' } };

  const tmpFile = path.join(os.tmpdir(), `AZZAVISION_Export_${period}_${Date.now()}.xlsx`);
  console.log(`[EXPORT] Writing Excel to: ${tmpFile}`);
  await wb.xlsx.writeFile(tmpFile);
  console.log(`[EXPORT] File created`);
  assertFileSize(tmpFile, 'Excel');
  return { filePath: tmpFile, filename: `AZZAVISION_TradeJournal_${label.replace(/ /g, '_')}.xlsx`, label };
}

// ─── PDF EXPORT (v5.1 — Professional Cover + bufferPages page numbering) ──────
async function generatePdf(period) {
  console.log(`[EXPORT] Start generate PDF v5.1 — period: ${period}`);
  const PDFDocument = require('pdfkit');
  const all         = await getAllSignals();
  console.log(`[EXPORT] Data loaded — ${all.length} total signals`);
  const signals     = filterByPeriod(all, period);
  const stats       = computeStats(signals);
  const label       = periodLabel(period);
  console.log(`[EXPORT] Filtered to ${signals.length} signals for period '${period}'`);

  const tmpFile = path.join(os.tmpdir(), `AZZAVISION_Export_${period}_${Date.now()}.pdf`);
  console.log(`[EXPORT] Writing PDF to: ${tmpFile}`);

  return new Promise((resolve, reject) => {
    // ── PDF: bufferPages=true enables post-render page number pass ─────────
    const doc = new PDFDocument({
      margin:      40,
      size:        'A4',
      bufferPages: true,   // ← lets us switchToPage() after all content is drawn
      info: {
        Title:    'AZZAVISION AI Trade Journal',
        Author:   'AZZAVISION AI',
        Subject:  `Professional Trading Journal — ${label}`,
        Keywords: 'Trading, Gold, XAUUSD, AI, Journal, AZZAVISION',
        Creator:  'AZZAVISION AI v5.1',
      },
    });
    const stream = fs.createWriteStream(tmpFile);
    doc.pipe(stream);

    const W          = doc.page.width;   // 595.28
    const H          = doc.page.height;  // 841.89
    const pageMargin = 40;
    const contentW   = W - pageMargin * 2;

    // ── COLOUR PALETTE ────────────────────────────────────────────────────
    const GOLD      = '#FFD700';
    const NAVY      = '#1A1A2E';
    const GREEN     = '#27AE60';
    const RED       = '#E74C3C';
    const ORANGE    = '#F39C12';
    const GRAY      = '#888888';
    const LIGHTGRAY = '#F5F5F5';
    const WHITE     = '#FFFFFF';

    // ── PHASE 1: COVER (physical page index 0 — no page number) ──────────
    drawCoverPage(doc, { period, label, version: 'v5.1' });

    // ── PHASE 2: CONTENT PAGES ────────────────────────────────────────────
    // coverPageIndex = 0 (pdfkit 0-based internal index)
    // content pages start at index 1
    doc.addPage();
    let contentPageCount = 1; // how many content pages added so far

    const startContentPage = () => {
      drawWatermark(doc);
      doc.save()
         .rect(0, 0, W, 6).fill(NAVY)
         .restore();
      doc.save()
         .fillColor(GOLD).font('Helvetica-Bold').fontSize(8).opacity(0.7)
         .text('AZZAVISION AI  •  TRADE JOURNAL', pageMargin, 12, { lineBreak: false });
      doc.fillColor(GRAY).font('Helvetica').fontSize(7).opacity(0.6)
         .text(label, W - pageMargin - 80, 12, { width: 80, align: 'right', lineBreak: false });
      doc.restore();
    };

    const addContentPage = () => {
      contentPageCount++;
      doc.addPage();
      startContentPage();
    };

    startContentPage();
    let y = 36;

    // ─── Helpers ────────────────────────────────────────────────────────
    const sectionHeader = (text, yp) => {
      doc.rect(pageMargin, yp, contentW, 22).fill(NAVY);
      doc.fontSize(11).fillColor(GOLD).font('Helvetica-Bold')
         .text(stripEmoji(text), pageMargin + 8, yp + 5, { width: contentW - 8 });
      return yp + 22;
    };

    const tableRow = (lbl, value, yp, shade, valColor) => {
      if (shade) doc.rect(pageMargin, yp, contentW, 18).fill(LIGHTGRAY);
      doc.fontSize(10).fillColor(NAVY).font('Helvetica-Bold')
         .text(lbl, pageMargin + 8, yp + 4, { width: contentW * 0.55 });
      doc.fontSize(10).fillColor(valColor || NAVY).font('Helvetica')
         .text(String(value), pageMargin + contentW * 0.55, yp + 4, { width: contentW * 0.4, align: 'right' });
      return yp + 18;
    };

    // ─── SUMMARY BOX ────────────────────────────────────────────────────
    const boxH = 80;
    doc.rect(pageMargin, y, contentW, boxH).fill(LIGHTGRAY).stroke(GRAY);
    const colW = contentW / 3;
    const np   = parseFloat(stats.netPips);
    [
      { label: 'Win Rate',    value: stats.winRate + '%',                  color: parseFloat(stats.winRate) >= 60 ? GREEN : RED },
      { label: 'Net Pips',    value: (np >= 0 ? '+' : '') + stats.netPips, color: np >= 0 ? GREEN : RED },
      { label: 'Total Trade', value: String(stats.closed),                  color: NAVY },
    ].forEach((m, i) => {
      const mx = pageMargin + i * colW;
      doc.fontSize(11).fillColor(GRAY).font('Helvetica')
         .text(m.label, mx, y + 12, { width: colW, align: 'center' });
      doc.fontSize(22).fillColor(m.color).font('Helvetica-Bold')
         .text(m.value, mx, y + 30, { width: colW, align: 'center' });
    });
    y += boxH + 14;

    // ─── RINGKASAN TRADE ────────────────────────────────────────────────
    y = sectionHeader('RINGKASAN TRADE', y);
    y = tableRow('Total Trade',   stats.total,   y, false);
    y = tableRow('Trade Selesai', stats.closed,  y, true);
    y = tableRow('Trade Terbuka', stats.open,    y, false);
    y = tableRow('Win',           stats.wins,    y, true,  GREEN);
    y = tableRow('Loss',          stats.losses,  y, false, RED);
    y = tableRow('Breakeven',     stats.bes,     y, true,  ORANGE);
    y += 10;

    // ─── PERFORMA ───────────────────────────────────────────────────────
    y = sectionHeader('PERFORMA', y);
    const wr = parseFloat(stats.winRate);
    y = tableRow('Win Rate',               stats.winRate + '%',                  y, false, wr >= 60 ? GREEN : RED);
    y = tableRow('Net Pips',               (np >= 0 ? '+' : '') + stats.netPips, y, true,  np >= 0 ? GREEN : RED);
    y = tableRow('Average Pips per Trade', stats.avgPips,                        y, false);
    y = tableRow('Profit Factor',          stats.profitFactor,                   y, true);
    y = tableRow('Max Consecutive Wins',   stats.maxConsecW,                     y, false, GREEN);
    y = tableRow('Max Consecutive Losses', stats.maxConsecL,                     y, true,  RED);
    y += 14;

    // ─── GRAFIK PERTUMBUHAN PIPS ─────────────────────────────────────────
    const closedSignals = [...signals].filter(s => s.status !== 'OPEN')
                                      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (closedSignals.length >= 2) {
      const curve = [];
      let running = 0;
      for (const s of closedSignals) { running += s.pips || 0; curve.push(running); }

      const chartH = 100;
      if (y > H - chartH - 60) { addContentPage(); y = 36; }

      y = sectionHeader('GRAFIK PERTUMBUHAN PIPS', y);
      const innerY = y;
      doc.rect(pageMargin, innerY, contentW, chartH).fill(LIGHTGRAY).stroke(GRAY);

      const minV  = Math.min(0, ...curve);
      const maxV  = Math.max(0, ...curve);
      const range = maxV - minV || 1;
      const px    = (i) => pageMargin + 8 + (i / (curve.length - 1)) * (contentW - 16);
      const py    = (v) => innerY + chartH - 8 - ((v - minV) / range) * (chartH - 16);

      doc.moveTo(pageMargin + 4, py(0)).lineTo(pageMargin + contentW - 4, py(0))
         .stroke(GRAY).opacity(0.4);
      doc.opacity(1);

      // Fill area
      doc.moveTo(px(0), innerY + chartH - 8);
      for (let i = 0; i < curve.length; i++) doc.lineTo(px(i), py(curve[i]));
      doc.lineTo(px(curve.length - 1), innerY + chartH - 8)
         .fillColor(np >= 0 ? '#27AE6033' : '#E74C3C33').fill().opacity(1);

      // Line
      doc.moveTo(px(0), py(curve[0]));
      for (let i = 1; i < curve.length; i++) doc.lineTo(px(i), py(curve[i]));
      doc.stroke(np >= 0 ? GREEN : RED).lineWidth(1.5);

      doc.fontSize(8).fillColor(GRAY).font('Helvetica')
         .text('Start: 0', pageMargin + 4, innerY + chartH - 7)
         .text(`End: ${np >= 0 ? '+' : ''}${stats.netPips} pips`, pageMargin + contentW - 80, innerY + chartH - 7, { width: 76, align: 'right' });

      y = innerY + chartH + 10;
    }

    // ─── 20 TRADE TERAKHIR ──────────────────────────────────────────────
    if (signals.length > 0) {
      if (y > H - 180) { addContentPage(); y = 36; }

      y = sectionHeader('20 TRADE TERAKHIR', y);

      const cols = [
        { label: '#',      w: 0.06 },
        { label: 'Date',   w: 0.22 },
        { label: 'Side',   w: 0.09 },
        { label: 'Entry',  w: 0.13 },
        { label: 'TP1',    w: 0.13 },
        { label: 'SL',     w: 0.13 },
        { label: 'Pips',   w: 0.13 },
        { label: 'Status', w: 0.11 },
      ];

      doc.rect(pageMargin, y, contentW, 18).fill('#2C2C54');
      let cx = pageMargin;
      cols.forEach(c => {
        doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
           .text(c.label, cx + 2, y + 4, { width: contentW * c.w - 4, align: 'center' });
        cx += contentW * c.w;
      });
      y += 18;

      const last20 = [...signals]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);

      last20.forEach((s, i) => {
        if (y > H - 60) { addContentPage(); y = 36; }
        if (i % 2 === 0) doc.rect(pageMargin, y, contentW, 16).fill(LIGHTGRAY);
        const statusC = s.status === 'WIN' ? GREEN : s.status === 'LOSS' ? RED : s.status === 'BREAKEVEN' ? ORANGE : GRAY;
        const sideC   = s.direction === 'BUY' ? GREEN : s.direction === 'SELL' ? RED : NAVY;
        const rowData = [
          { v: String(s.id),                                                                       c: NAVY    },
          { v: s.created_at ? require('../../utils/wib_time').isoToWIBShort(s.created_at) : '-',  c: NAVY    },
          { v: s.direction || '-',                                                                   c: sideC   },
          { v: String(s.entry   || '-'),                                                             c: NAVY    },
          { v: String(s.tp1     || '-'),                                                             c: NAVY    },
          { v: String(s.sl      || '-'),                                                             c: NAVY    },
          { v: pipStr(s),                                                                            c: statusC },
          { v: s.status || '-',                                                                      c: statusC },
        ];
        let rx = pageMargin;
        cols.forEach((c, ci) => {
          doc.fontSize(8).fillColor(rowData[ci].c).font('Helvetica')
             .text(rowData[ci].v, rx + 2, y + 3, { width: contentW * c.w - 4, align: 'center' });
          rx += contentW * c.w;
        });
        y += 16;
      });
    }

    // ─── CATATAN JOURNAL ────────────────────────────────────────────────
    const withNotes = signals.filter(s => s.note || s.strategy || s.reason);
    if (withNotes.length > 0) {
      if (y > H - 140) { addContentPage(); y = 36; }
      y = sectionHeader('CATATAN JOURNAL', y);
      for (const s of withNotes.slice(0, 8)) {
        if (y > H - 60) { addContentPage(); y = 36; }
        const statusC = s.status === 'WIN' ? GREEN : s.status === 'LOSS' ? RED : ORANGE;
        doc.save()
           .rect(pageMargin, y, contentW, 30).fill(LIGHTGRAY)
           .fillColor(statusC).font('Helvetica-Bold').fontSize(9)
           .text(`#${s.id} | ${s.direction || '?'} | ${s.status || '?'} | ${pipStr(s)}`, pageMargin + 8, y + 4, { width: contentW - 16 })
           .fillColor(NAVY).font('Helvetica').fontSize(8)
           .text(stripEmoji(s.note || s.strategy || s.reason || '—'), pageMargin + 8, y + 16, { width: contentW - 16, lineBreak: false })
           .restore();
        y += 34;
      }
    }

    // ── PHASE 3: POST-RENDER PAGE NUMBER PASS (bufferPages magic) ─────────
    // All content is rendered. Now we know the exact total page count.
    // We iterate over content pages (skip cover at index 0) and draw
    // "Page X of Y" with the real total. doc.switchToPage() is available
    // because bufferPages: true was set.
    const totalPhysicalPages = doc.bufferedPageRange().count; // includes cover
    const totalContentPages  = totalPhysicalPages - 1;        // cover has no number

    for (let pi = 1; pi < totalPhysicalPages; pi++) {
      const contentNum = pi; // content page 1-based number (cover is index 0)
      doc.switchToPage(pi);
      drawPageNumber(doc, contentNum, totalContentPages);
    }

    // Flush all buffered pages to the stream
    doc.flushPages();
    doc.end();

    stream.on('finish', () => {
      try {
        assertFileSize(tmpFile, 'PDF');
        console.log(`[EXPORT] PDF v5.1 created — ${totalContentPages} content pages + cover`);
        resolve({
          filePath: tmpFile,
          filename: `AZZAVISION_TradeJournal_${label.replace(/ /g, '_')}.pdf`,
          label,
        });
      } catch (sizeErr) {
        reject(sizeErr);
      }
    });
    stream.on('error', (err) => {
      console.error('[EXPORT] Stream write error:', err.stack || err.message);
      reject(err);
    });
  });
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
async function generateCsv(period) {
  console.log(`[EXPORT] Start generate CSV — period: ${period}`);
  const all     = await getAllSignals();
  console.log(`[EXPORT] Data loaded — ${all.length} total signals`);
  const signals = filterByPeriod(all, period);
  const label   = periodLabel(period);
  console.log(`[EXPORT] Filtered to ${signals.length} signals for period '${period}'`);

  const { isoToWIBShort } = require('../../utils/wib_time');

  const header = ['ID', 'Date (WIB)', 'Pair', 'Direction', 'Entry', 'TP1', 'TP2', 'SL', 'Close Price', 'Status', 'Pips', 'Confidence', 'Strategy'];
  const rows   = [...signals]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(s => [
      s.id,
      s.created_at ? isoToWIBShort(s.created_at) : '-',
      s.pair || 'XAUUSD',
      s.direction || '-',
      s.entry   ?? '-',
      s.tp1     ?? '-',
      s.tp2     ?? '-',
      s.sl      ?? '-',
      s.close_price ?? '-',
      s.status  || '-',
      s.pips    ?? 0,
      s.confidence ?? '-',
      s.strategy || '-',
    ]);

  const escape = (v) => {
    const str = String(v);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csv = [
    header.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(',')),
  ].join('\r\n');

  const tmpFile = path.join(os.tmpdir(), `AZZAVISION_Export_${period}_${Date.now()}.csv`);
  fs.writeFileSync(tmpFile, csv, 'utf8');
  console.log(`[EXPORT] File created`);
  assertFileSize(tmpFile, 'CSV');
  return { filePath: tmpFile, filename: `AZZAVISION_TradeJournal_${label.replace(/ /g, '_')}.csv`, label };
}

// ─── PERIOD PICKER KEYBOARD ───────────────────────────────────────────────────
function periodPickerKeyboard(type) {
  const { Markup } = require('telegraf');
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Hari Ini',   `exp_${type}_today`),
      Markup.button.callback('📅 7 Hari',     `exp_${type}_7d`),
    ],
    [
      Markup.button.callback('📅 30 Hari',    `exp_${type}_30d`),
      Markup.button.callback('📋 Semua Data', `exp_${type}_all`),
    ],
  ]);
}

// ─── REGISTER EXPORT CALLBACKS ────────────────────────────────────────────────
function registerExportCallbacks(bot) {
  const types   = ['xls', 'pdf', 'csv'];
  const periods = ['today', '7d', '30d', 'all'];

  types.forEach(type => {
    periods.forEach(period => {
      const actionId = `exp_${type}_${period}`;

      bot.action(actionId, async (ctx) => {
        console.log(`[EXPORT] Callback received — action: ${actionId}`);

        await ctx.answerCbQuery('⏳ Memproses...', { show_alert: false }).catch((e) => {
          console.warn(`[EXPORT] answerCbQuery gagal: ${e.message}`);
        });

        try {
          const typeLabel = type === 'xls' ? 'Excel' : type === 'pdf' ? 'PDF' : 'CSV';
          await ctx.editMessageText(
            `⏳ <b>Membuat file ${typeLabel} — ${periodLabel(period)}...</b>\n<i>Mohon tunggu sebentar.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (editErr) {
          console.warn(`[EXPORT] editMessageText gagal (bisa diabaikan): ${editErr.message}`);
        }

        try {
          console.log(`[EXPORT] Start generate — type: ${type}, period: ${period}`);

          let result;
          if (type === 'xls') {
            result = await generateExcel(period);
          } else if (type === 'pdf') {
            result = await generatePdf(period);
          } else {
            result = await generateCsv(period);
          }

          console.log(`[EXPORT] File created — ${result.filePath}`);
          assertFileSize(result.filePath, type.toUpperCase());

          const fileBuffer = fs.readFileSync(result.filePath);
          console.log(`[EXPORT] File read into buffer — ${fileBuffer.length} bytes`);

          const caption = [
            `✅ <b>Export ${type === 'xls' ? 'Excel' : type === 'pdf' ? 'PDF' : 'CSV'} Selesai</b>`,
            ``,
            `📅 Periode : <b>${result.label}</b>`,
            `📁 File    : <code>${result.filename}</code>`,
            ``,
            type === 'pdf' ? `📄 <i>Cover halaman pertama — Trade Journal Edition v5.1</i>` : '',
            ``,
            `⚡ <i>AZZAVISION AI v5.1 | Professional Trade Journal</i>`,
          ].filter(l => l !== '').join('\n');

          try {
            const bannerType = type === 'pdf' ? 'export_pdf' : type === 'xls' ? 'export_excel' : null;
            if (bannerType) {
              const buffer = await renderBanner(bannerType, {
                subtitle: result.label,
                rows: [
                  { label: 'File', value: result.filename },
                  { label: 'Periode', value: result.label },
                ],
              });
              await ctx.replyWithPhoto({ source: buffer });
            }
          } catch (bannerErr) {
            console.error('[EXPORT-BANNER] Gagal render banner:', bannerErr.message);
          }

          console.log(`[EXPORT] Telegram send — ${result.filename}`);
          await ctx.replyWithDocument(
            { source: fileBuffer, filename: result.filename },
            { caption, parse_mode: 'HTML' }
          );
          console.log(`[EXPORT] Success — ${actionId}`);

          fs.unlink(result.filePath, (unlinkErr) => {
            if (unlinkErr) console.warn(`[EXPORT] Gagal hapus temp file: ${unlinkErr.message}`);
          });

          try {
            await ctx.deleteMessage();
          } catch (delErr) {
            console.warn(`[EXPORT] deleteMessage gagal (bisa diabaikan): ${delErr.message}`);
          }

        } catch (err) {
          console.error(`[EXPORT] FAILED — ${actionId}`);
          console.error(`[EXPORT] Error message : ${err.message}`);
          console.error(`[EXPORT] Stack trace   :\n${err.stack}`);

          const errMsg = `❌ <b>Export ${type.toUpperCase()} gagal.</b>\n\n<code>${err.message}</code>`;
          try {
            await ctx.editMessageText(errMsg, { parse_mode: 'HTML' });
          } catch {
            try {
              await ctx.replyWithHTML(errMsg);
            } catch (replyErr) {
              console.error(`[EXPORT] Gagal kirim pesan error ke Telegram: ${replyErr.message}`);
            }
          }
        }
      });
    });
  });
}

module.exports = { registerExportCallbacks, periodPickerKeyboard, generateExcel, generatePdf, generateCsv };
