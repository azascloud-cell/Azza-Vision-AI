/**
 * generate.js — Orkestrator Developer Documentation Generator
 *
 * Fungsi utama: generateDocumentation({ mode, outputPath, root }).
 * Modes:
 *   full          — dokumentasi lengkap (semua bab + source code)
 *   overview      — semua bab KECUALI Source Code
 *   source        — HANYA bab Source Code
 *   architecture  — HANYA bab Architecture
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const { walk, countLines, countAllDirs, listTopLevelModules, findTodos, SOURCE_EXT } = require('./scan');
const { stampAllPages, PALETTE, bodyText, bullet } = require('./pdf');
const { drawCover, drawToc } = require('./cover');
const sections = require('./sections');

const MODE_LABELS = {
  full: 'Full Documentation',
  overview: 'Overview (tanpa source code)',
  source: 'Source Code Only',
  architecture: 'Architecture Only',
};

function loadPackageJson(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

function sectionStatistics(doc, ctx) {
  doc.addPage();
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(PALETTE.gold).text('LAMPIRAN', { characterSpacing: 1 });
  doc.moveDown(0.3);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(PALETTE.ink).text('Statistics');
  doc.moveDown(0.4);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 56, doc.y).lineWidth(1.5).strokeColor(PALETTE.gold).stroke();
  doc.moveDown(1);
  const rows = [
    ['Total File (project)', ctx.totalFiles],
    ['Total Folder', ctx.totalFolders],
    ['Total Source Code File', ctx.sourceFileCount],
    ['Total Line of Code', ctx.totalSourceLines || ctx.totalLoc],
    ['Total Commands', ctx.commandCount || 0],
    ['Total Services (modul src/)', ctx.topLevelModules.length],
    ['Total Scheduler', ctx.schedulerCount],
    ['Total Database File (data/*.json)', ctx.databaseFileCount],
  ];
  doc.font('Helvetica').fontSize(11).fillColor(PALETTE.text);
  rows.forEach(([label, value]) => {
    doc.font('Helvetica').fillColor(PALETTE.muted).text(`${label}:  `, { continued: true });
    doc.font('Helvetica-Bold').fillColor(PALETTE.ink).text(String(value));
    doc.moveDown(0.2);
  });
}

async function generateDocumentation({ mode = 'full', outputPath, root }) {
  if (!MODE_LABELS[mode]) throw new Error(`Mode tidak dikenal: ${mode}`);
  root = root || path.resolve(__dirname, '../..');
  outputPath = outputPath || path.join(root, 'AzzaVisionAI_Project_Documentation.pdf');

  const pkg = loadPackageJson(root);
  const allFiles = walk(root);
  const sourceFiles = walk(root, { extensions: SOURCE_EXT }).filter((f) => f.rel.startsWith('src') || f.rel.startsWith('scripts'));
  const totalLoc = sourceFiles.reduce((sum, f) => sum + countLines(f.abs), 0);

  let databaseFileCount = 0;
  try { databaseFileCount = fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.json')).length; } catch { /* 0 */ }
  let schedulerCount = 0;
  try { schedulerCount = fs.readdirSync(path.join(root, 'src/scheduler')).filter((f) => f.endsWith('.js')).length; } catch { /* 0 */ }

  const ctx = {
    root,
    pkg,
    generatedAt: new Date().toISOString().slice(0, 10),
    modeLabel: MODE_LABELS[mode],
    totalFiles: allFiles.length,
    totalFolders: countAllDirs(root),
    sourceFileCount: sourceFiles.length,
    totalLoc,
    topLevelModules: listTopLevelModules(path.join(root, 'src')),
    databaseFileCount,
    schedulerCount,
    commandCount: 0,
  };

  const doc = new PDFDocument({
    size: 'A4',
    margin: 56,
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: `${pkg.name || 'AzzaVision AI'} — Developer Documentation`,
      Author: 'AZZAVISION AI — Developer Documentation Generator',
      Subject: MODE_LABELS[mode],
    },
  });

  const writeStream = fs.createWriteStream(outputPath);
  const finished = new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  doc.pipe(writeStream);

  // ── COVER (page 0) ──────────────────────────────────────────────────────
  drawCover(doc, ctx);

  // ── RESERVE TOC PAGE ─────────────────────────────────────────────────────
  doc.addPage();
  const tocPageIndex = doc.bufferedPageRange().count - 1;

  // ── CONTENT ──────────────────────────────────────────────────────────────
  if (mode === 'architecture') {
    sections.sectionArchitecture(doc, ctx);
  } else if (mode === 'source') {
    sections.sectionSourceCode(doc, ctx, sourceFiles);
  } else {
    sections.sectionOverview(doc, ctx);
    sections.sectionArchitecture(doc, ctx);
    sections.sectionFolderStructure(doc, ctx);
    sections.sectionDependencies(doc, ctx);
    sections.sectionConfiguration(doc, ctx);
    sections.sectionDatabase(doc, ctx);
    sections.sectionTradingEngine(doc, ctx);
    sections.sectionSignalEngine(doc, ctx);
    sections.sectionNewsEngine(doc, ctx);
    sections.sectionAiEngine(doc, ctx);
    sections.sectionJournalEngine(doc, ctx);
    sections.sectionScheduler(doc, ctx);
    sections.sectionTelegramSystem(doc, ctx);
    sections.sectionExportSystem(doc, ctx);
    sections.sectionBackupSystem(doc, ctx);
    sections.sectionCommands(doc, ctx);
    if (mode === 'full') {
      sections.sectionSourceCode(doc, ctx, sourceFiles);
    }
    sections.sectionDataStructure(doc, ctx);
    sections.sectionRoadmap(doc, ctx, findTodos(sourceFiles));
    sectionStatistics(doc, ctx);
  }

  // ── DRAW TOC (halaman yang sudah direservasi di atas) ───────────────────
  const tocEntries = doc.__toc || [];
  doc.switchToPage(tocPageIndex);
  // Fungsi resolve: pageIndex buffer -> nomor halaman tampilan (halaman isi
  // dimulai dari 1, TOC & cover tidak diberi nomor tampilan).
  const contentStartIndex = tocPageIndex + 1;
  drawToc(doc, tocEntries, (pageIndex) => pageIndex - contentStartIndex + 1);

  // ── HEADER/FOOTER + NOMOR HALAMAN (skip cover & TOC) ────────────────────
  const skipPages = new Set([0, tocPageIndex]);
  stampAllPages(doc, {
    title: `${pkg.name || 'AzzaVision AI'} — ${MODE_LABELS[mode]}`,
    pageLabel: 'AzzaVision AI — Developer Documentation',
    skipPages,
  });

  const totalPages = doc.bufferedPageRange().count;
  doc.flushPages();
  doc.end();
  await finished;

  return {
    outputPath,
    totalPages,
    totalFiles: ctx.totalFiles,
    sourceFileCount: ctx.sourceFileCount,
    totalLoc: ctx.totalLoc,
    mode,
  };
}

module.exports = { generateDocumentation, MODE_LABELS };
