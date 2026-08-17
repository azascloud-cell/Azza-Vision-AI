/**
 * sections.js — Isi konten per bab Developer Documentation Generator
 *
 * Setiap fungsi di sini menulis satu bab ke dokumen pdfkit yang sedang
 * berjalan. Semua data diambil otomatis dari filesystem project (package.json,
 * config/, data/, src/) — tidak ada teks yang dihardcode selain judul bab
 * dan kalimat penjelas umum.
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { addSectionHeading, h2, bodyText, bullet, ensureSpace, renderSourceFile, PALETTE } = require('./pdf');
const { redactJson, redactText } = require('./redact');
const { buildFolderTree, countLines } = require('./scan');

const DEP_DESCRIPTIONS = {
  '@google/generative-ai': 'SDK resmi Google Gemini — dipakai AI Engine untuk analisis sinyal & narasi.',
  '@napi-rs/canvas': 'Rendering canvas native (Node) — dipakai Banner System untuk membuat gambar PNG dinamis.',
  archiver: 'Membuat file ZIP terprogram — dipakai Backup Engine untuk mengompres source/data/config.',
  axios: 'HTTP client — dipakai untuk memanggil API market data, AI provider, dan Telegram.',
  dotenv: 'Memuat variabel environment dari file .env ke process.env.',
  exceljs: 'Membaca/menulis file Excel (.xlsx) — dipakai Export System untuk laporan trading.',
  'node-cron': 'Penjadwal tugas berbasis cron — dipakai Scheduler untuk backup harian & laporan otomatis.',
  pdfkit: 'Membuat file PDF terprogram — dipakai Export System dan Developer Documentation Generator ini sendiri.',
  telegraf: 'Framework Telegram Bot API — dasar dari seluruh Telegram System (command, keyboard, callback).',
  express: 'Web framework — melayani endpoint HTTP/health-check.',
};

function describeDependency(name) {
  return DEP_DESCRIPTIONS[name] || 'Package pendukung — lihat dokumentasi resmi npm untuk detail penggunaannya.';
}

// ─── 1. PROJECT OVERVIEW ─────────────────────────────────────────────────────

function sectionOverview(doc, ctx) {
  addSectionHeading(doc, 1, 'Project Overview');
  const { pkg } = ctx;
  bodyText(doc, `${pkg.name || 'Project ini'} adalah AI Trading Assistant untuk pasangan XAUUSD (emas/USD), dibangun sebagai bot Telegram berbasis Node.js.`);
  doc.moveDown(0.6);
  bodyText(doc, 'Fitur utama yang terdeteksi dari struktur project:');
  doc.moveDown(0.3);
  const features = [
    'Signal Engine — deteksi sinyal BUY/SELL otomatis dari multi-timeframe',
    'Market Scanner — pemindaian kondisi pasar berkelanjutan',
    'News Intelligence — analisis berita dengan skor & kategori',
    'Trading Journal — pencatatan riwayat trade & performa',
    'Performance Report — laporan harian/mingguan/bulanan otomatis',
    'Risk & Money Management — kalkulasi lot, balance, broker-aware',
    'AI Learning Engine — self-retrain dari histori hasil trade',
    'Backup System — backup otomatis source/config/data ke Telegram',
    'Export System — ekspor jurnal ke Excel/PDF/CSV',
    'Telegram Automation — dashboard, keyboard menu, dan command lengkap',
    'Developer Documentation Generator — bab ini sendiri, menghasilkan dokumentasi untuk AI lain',
  ];
  features.forEach((f) => bullet(doc, f));
  doc.moveDown(0.6);
  bodyText(doc, `Versi saat ini: ${pkg.version || '-'}. Lisensi: ${pkg.license || '-'}.`);
}

// ─── 2. ARCHITECTURE ─────────────────────────────────────────────────────────

function sectionArchitecture(doc, ctx) {
  addSectionHeading(doc, 2, 'Architecture');
  bodyText(doc, 'Project ini memakai arsitektur modular berbasis folder — setiap domain fungsional dipisah ke foldernya sendiri di bawah src/.');
  doc.moveDown(0.5);

  const moduleDocs = {
    bot: 'Lapisan Telegram: registrasi command, keyboard, callback query, dan dashboard.',
    analysis: 'Otak trading: strategi, indikator, scanner, ensemble scoring, AI engine, news engine, learning/retrain.',
    market: 'Pengambilan & caching data harga dari provider eksternal, termasuk rotasi multi-API-key.',
    database: 'Persistensi data berbasis file JSON — signal history, journal, statistik strategi, profil user.',
    utils: 'Utilitas lintas modul: backup engine, format pesan, validasi sinyal, jam WIB, dan lain-lain.',
    scheduler: 'Penjadwalan tugas periodik (cron) — laporan otomatis, backup harian.',
    chart: 'Pembuatan gambar chart untuk dilampirkan pada pesan Telegram.',
    banner: 'Sistem banner PNG dinamis (Premium Black + Gold) untuk semua command/event utama.',
    routes: 'Endpoint HTTP tambahan (health check) di luar jalur Telegram.',
    lib: 'Modul pustaka internal bersama (mis. logger).',
    docgen: 'Developer Documentation Generator — modul yang menghasilkan dokumen ini.',
  };

  h2(doc, 'Modul di src/');
  for (const mod of ctx.topLevelModules) {
    ensureSpace(doc, 30);
    bullet(doc, `src/${mod}/ — ${moduleDocs[mod] || 'Modul pendukung project.'}`);
  }

  doc.moveDown(0.8);
  h2(doc, 'Alur Data Level Tinggi');
  bodyText(doc, 'Market Data → Scanner/Strategy → Signal Engine → Bot Telegram (notifikasi) → Monitor (TP/SL/BE) → Trading Journal → Performance Report.');
  doc.moveDown(0.5);
  bodyText(doc, 'Backup Engine, News Engine, dan AI Learning Engine berjalan sebagai proses pendukung yang terhubung ke alur ini lewat scheduler dan database bersama.');
}

// ─── 3. FOLDER STRUCTURE ─────────────────────────────────────────────────────

function sectionFolderStructure(doc, ctx) {
  addSectionHeading(doc, 3, 'Folder Structure');
  bodyText(doc, 'Tree berikut dibaca langsung dari filesystem project (folder besar seperti node_modules, backup, dan output disembunyikan).');
  doc.moveDown(0.5);
  doc.font('Courier').fontSize(8).fillColor(PALETTE.text);
  const treeLines = buildFolderTree(ctx.root, { maxDepth: 5 });
  for (const line of treeLines) {
    ensureSpace(doc, 12);
    doc.text(line, { lineGap: 1 });
  }
}

// ─── 4. DEPENDENCIES ─────────────────────────────────────────────────────────

function sectionDependencies(doc, ctx) {
  addSectionHeading(doc, 4, 'Dependencies');
  bodyText(doc, `Dibaca langsung dari package.json. Total ${Object.keys(ctx.pkg.dependencies || {}).length} runtime dependency.`);
  doc.moveDown(0.5);
  h2(doc, 'Runtime Dependencies');
  for (const [name, version] of Object.entries(ctx.pkg.dependencies || {})) {
    ensureSpace(doc, 34);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PALETTE.ink).text(`${name}  `, { continued: true });
    doc.font('Helvetica').fillColor(PALETTE.muted).text(`v${version}`);
    doc.font('Helvetica').fontSize(9.5).fillColor(PALETTE.text).text(describeDependency(name), { indent: 8 });
    doc.moveDown(0.2);
  }
  if (Object.keys(ctx.pkg.devDependencies || {}).length) {
    doc.moveDown(0.5);
    h2(doc, 'Dev Dependencies');
    for (const [name, version] of Object.entries(ctx.pkg.devDependencies || {})) {
      ensureSpace(doc, 20);
      bullet(doc, `${name} — v${version}`);
    }
  }
}

// ─── 5. CONFIGURATION ────────────────────────────────────────────────────────

function sectionConfiguration(doc, ctx) {
  addSectionHeading(doc, 5, 'Configuration');
  bodyText(doc, 'Semua nilai kredensial (token, API key, password, secret) disensor otomatis di bawah ini.');
  doc.moveDown(0.5);

  h2(doc, '.env.example (struktur environment variable)');
  let envExample = '';
  try { envExample = fs.readFileSync(path.join(ctx.root, '.env.example'), 'utf8'); } catch { /* tidak ada */ }
  if (envExample) {
    const redactedEnv = envExample.split(/\r\n|\r|\n/).map((line) => {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) return redactText(line);
      const [, key, val] = m;
      if (/token|key|secret|password|cookie|session/i.test(key)) {
        return `${key}=***REDACTED***`;
      }
      return `${key}=${redactText(val)}`;
    }).join('\n');
    doc.font('Courier').fontSize(8).fillColor(PALETTE.text);
    ensureSpace(doc, 20);
    doc.text(redactedEnv, { lineGap: 1 });
  } else {
    bodyText(doc, 'Tidak ditemukan file .env.example di root project.');
  }

  doc.moveDown(0.8);
  h2(doc, 'File Konfigurasi (config/)');
  const configDir = path.join(ctx.root, 'config');
  let configFiles = [];
  try { configFiles = fs.readdirSync(configDir).filter((f) => f.endsWith('.json')); } catch { /* skip */ }
  if (configFiles.length === 0) {
    bodyText(doc, 'Tidak ada file konfigurasi JSON ditemukan.');
  }
  for (const file of configFiles) {
    ensureSpace(doc, 60);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PALETTE.ink).text(`config/${file}`);
    let json;
    try { json = JSON.parse(fs.readFileSync(path.join(configDir, file), 'utf8')); } catch { json = null; }
    const safe = json ? redactJson(json) : { error: 'gagal membaca file' };
    doc.font('Courier').fontSize(8).fillColor(PALETTE.text);
    doc.text(JSON.stringify(safe, null, 2), { lineGap: 1 });
    doc.moveDown(0.4);
  }
}

// ─── 6. DATABASE ─────────────────────────────────────────────────────────────

function summarizeSchema(value, depth = 0) {
  if (depth > 2) return typeof value;
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array (kosong)';
    return [summarizeSchema(value[0], depth + 1)];
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = summarizeSchema(v, depth + 1);
    return out;
  }
  return typeof value;
}

function sectionDatabase(doc, ctx) {
  addSectionHeading(doc, 6, 'Database');
  bodyText(doc, 'Project ini memakai penyimpanan berbasis file JSON (tanpa server database terpisah). Berikut struktur (schema) setiap file data, BUKAN isi datanya — nilai sensitif tetap disensor jika ditampilkan.');
  doc.moveDown(0.5);
  const dataDir = path.join(ctx.root, 'data');
  let files = [];
  try { files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')); } catch { /* skip */ }
  for (const file of files) {
    ensureSpace(doc, 60);
    const full = path.join(dataDir, file);
    let stat;
    try { stat = fs.statSync(full); } catch { stat = null; }
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PALETTE.ink).text(`data/${file}  `, { continued: true });
    doc.font('Helvetica').fillColor(PALETTE.muted).text(stat ? `(${(stat.size / 1024).toFixed(1)} KB)` : '');
    let json;
    try { json = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { json = null; }
    if (json === null) {
      bodyText(doc, '  (gagal parse / bukan JSON)');
    } else {
      const schema = redactJson(summarizeSchema(json));
      doc.font('Courier').fontSize(8).fillColor(PALETTE.text);
      doc.text(JSON.stringify(schema, null, 2).slice(0, 2500), { lineGap: 1 });
    }
    doc.moveDown(0.4);
  }
}

// ─── ENGINE SECTIONS (7–15) — deskripsi berbasis file yang benar-benar ada ──

function fileList(root, dir) {
  try {
    return fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
  } catch {
    return [];
  }
}

function engineSection(doc, num, title, intro, root, dirs) {
  addSectionHeading(doc, num, title);
  bodyText(doc, intro);
  doc.moveDown(0.5);
  for (const dir of dirs) {
    const files = fileList(root, dir);
    if (files.length === 0) continue;
    h2(doc, `${dir}/`);
    files.forEach((f) => {
      ensureSpace(doc, 16);
      bullet(doc, f);
    });
  }
}

function sectionTradingEngine(doc, ctx) {
  addSectionHeading(doc, 7, 'Trading Engine');
  bodyText(doc, 'Alur inti trading engine, dibangun dari file di src/analysis/ dan src/database/:');
  doc.moveDown(0.4);
  ['Scan', 'Filter', 'Signal', 'Monitor', 'Move BE', 'TP', 'SL', 'Journal', 'Report'].forEach((step, i, arr) => {
    bullet(doc, `${i + 1}. ${step}`);
  });
  doc.moveDown(0.6);
  h2(doc, 'File terkait');
  ['src/analysis', 'src/database'].forEach((dir) => {
    fileList(ctx.root, dir).forEach((f) => { ensureSpace(doc, 16); bullet(doc, `${dir}/${f}`); });
  });
}

function sectionSignalEngine(doc, ctx) {
  engineSection(doc, 8, 'Signal Engine', 'Modul yang menghasilkan keputusan BUY/SELL dari multi-timeframe, ensemble scoring, dan validasi sinyal.', ctx.root, ['src/analysis']);
}

function sectionNewsEngine(doc, ctx) {
  addSectionHeading(doc, 9, 'News Engine');
  bodyText(doc, 'Menganalisis berita ekonomi dengan kategori dan weighted scoring untuk menentukan dampaknya ke market.');
  doc.moveDown(0.4);
  ['src/analysis/news_engine.js', 'src/analysis/news_engine_v4.js', 'src/bot/commands/news.js']
    .filter((rel) => fs.existsSync(path.join(ctx.root, rel)))
    .forEach((rel) => { ensureSpace(doc, 16); bullet(doc, rel); });
}

function sectionAiEngine(doc, ctx) {
  addSectionHeading(doc, 10, 'AI Engine');
  bodyText(doc, 'Lapisan kecerdasan buatan dengan urutan prioritas provider (fallback chain) dan rotasi multi API-key.');
  doc.moveDown(0.4);
  ['src/analysis/ai_engine.js', 'src/analysis/ai_key_manager.js', 'src/analysis/gemini.js', 'src/analysis/learning.js']
    .filter((rel) => fs.existsSync(path.join(ctx.root, rel)))
    .forEach((rel) => { ensureSpace(doc, 16); bullet(doc, rel); });
}

function sectionJournalEngine(doc, ctx) {
  addSectionHeading(doc, 11, 'Journal Engine');
  bodyText(doc, 'Mencatat setiap sinyal/trade beserta hasilnya (WIN/LOSS/BE) untuk dianalisis dan dijadikan bahan retrain AI.');
  doc.moveDown(0.4);
  ['src/analysis/ai_trade_journal.js', 'src/database/db.js', 'src/database/db_extended.js', 'src/bot/commands/tradejournal.js', 'src/bot/commands/journal.js']
    .filter((rel) => fs.existsSync(path.join(ctx.root, rel)))
    .forEach((rel) => { ensureSpace(doc, 16); bullet(doc, rel); });
}

function sectionScheduler(doc, ctx) {
  engineSection(doc, 12, 'Scheduler', 'Tugas periodik (cron) untuk laporan otomatis dan backup harian.', ctx.root, ['src/scheduler']);
  doc.moveDown(0.4);
  bullet(doc, 'src/utils/backup_engine.js — dijadwalkan lewat node-cron untuk backup harian.');
}

function sectionTelegramSystem(doc, ctx) {
  addSectionHeading(doc, 13, 'Telegram System');
  bodyText(doc, `Dibangun di atas Telegraf. Total ${ctx.commandCount} command terdaftar (lihat bab Commands untuk daftar lengkap).`);
  doc.moveDown(0.4);
  h2(doc, 'File Inti');
  ['src/bot/index.js', 'src/bot/state.js', 'src/bot/callbacks.js']
    .filter((rel) => fs.existsSync(path.join(ctx.root, rel)))
    .forEach((rel) => { ensureSpace(doc, 16); bullet(doc, rel); });
}

function sectionExportSystem(doc, ctx) {
  addSectionHeading(doc, 14, 'Export System');
  bodyText(doc, 'Mengekspor data trading ke Excel, PDF, dan CSV lewat command Telegram.');
  doc.moveDown(0.4);
  ['src/bot/commands/export.js', 'src/utils/pdf_cover.js'].filter((rel) => fs.existsSync(path.join(ctx.root, rel)))
    .forEach((rel) => { ensureSpace(doc, 16); bullet(doc, rel); });
}

function sectionBackupSystem(doc, ctx) {
  addSectionHeading(doc, 15, 'Backup System');
  bodyText(doc, 'Sistem backup otomatis yang sudah ada TIDAK diubah oleh Developer Documentation Generator ini. Bab ini hanya mendeskripsikannya.');
  doc.moveDown(0.4);
  const desc = [
    'Backup Source Code (ZIP, exclude node_modules/.git/logs/cache/tmp)',
    'Backup Database (seluruh folder data)',
    'Backup Config (.env, configs)',
    'Kirim ke Telegram Admin',
    'Retensi 14 backup terakhir',
    'Smart Backup (skip source jika tidak ada perubahan)',
    'Backup Validation (ukuran > 0, ZIP tidak corrupt)',
  ];
  desc.forEach((d) => bullet(doc, d));
  doc.moveDown(0.4);
  h2(doc, 'File terkait');
  ['src/utils/backup_engine.js', 'src/utils/backup.js', 'src/bot/commands/backup_cmd.js']
    .filter((rel) => fs.existsSync(path.join(ctx.root, rel)))
    .forEach((rel) => { ensureSpace(doc, 16); bullet(doc, rel); });
}

// ─── 16. COMMANDS ─────────────────────────────────────────────────────────────

function extractCommandsFromFile(content) {
  const found = [];
  const re = /bot\.command\(\s*(\[[^\]]*\]|'[^']+'|"[^"]+")/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let raw = m[1];
    if (raw.startsWith('[')) {
      const names = [...raw.matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2]);
      found.push(...names);
    } else {
      found.push(raw.replace(/['"]/g, ''));
    }
  }
  return found;
}

function extractHeaderDoc(content) {
  const m = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return null;
  return m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter((l) => l.length > 0);
}

function sectionCommands(doc, ctx) {
  addSectionHeading(doc, 16, 'Commands');
  bodyText(doc, 'Daftar command Telegram yang ditemukan otomatis dari src/bot/commands/ (dan alias catch-all di src/bot/index.js).');
  doc.moveDown(0.5);
  const cmdDir = path.join(ctx.root, 'src/bot/commands');
  let files = [];
  try { files = fs.readdirSync(cmdDir).filter((f) => f.endsWith('.js')); } catch { /* skip */ }
  let total = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(cmdDir, file), 'utf8');
    const cmds = extractCommandsFromFile(content);
    if (cmds.length === 0) continue;
    total += cmds.length;
    ensureSpace(doc, 40);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PALETTE.ink)
      .text(cmds.map((c) => `/${c}`).join('  '));
    const headerDoc = extractHeaderDoc(content);
    const desc = headerDoc ? headerDoc.find((l) => l && !l.startsWith('*') && l.length > 3 && !/^AZZAVISION/i.test(l)) : null;
    doc.font('Helvetica').fontSize(9.5).fillColor(PALETTE.muted)
      .text(desc || `Didefinisikan di src/bot/commands/${file}`, { indent: 8 });
    doc.moveDown(0.3);
  }
  ctx.commandCount = total;
}

// ─── 17. SOURCE CODE ──────────────────────────────────────────────────────────

function sectionSourceCode(doc, ctx, sourceFiles) {
  addSectionHeading(doc, 17, 'Source Code');
  bodyText(doc, `Total ${sourceFiles.length} file source code, diurutkan berdasarkan folder. Setiap file dimulai di halaman baru, dengan nomor baris dan syntax highlight sederhana (font monospace).`);
  const counter = { count: 0 };
  for (const f of sourceFiles) {
    let content = '';
    try { content = fs.readFileSync(f.abs, 'utf8'); } catch { content = '/* gagal membaca file */'; }
    content = redactText(content);
    renderSourceFile(doc, f.rel, content, counter);
  }
  ctx.totalSourceLines = counter.count;
}

// ─── 18. DATA STRUCTURE ───────────────────────────────────────────────────────

function sectionDataStructure(doc, ctx) {
  addSectionHeading(doc, 18, 'Data Structure');
  bodyText(doc, 'Deskripsi seluruh file JSON di data/ — nama file, ukuran, dan bentuk (shape) data-nya.');
  doc.moveDown(0.5);
  const dataDir = path.join(ctx.root, 'data');
  let files = [];
  try { files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')); } catch { /* skip */ }
  files.forEach((file) => {
    ensureSpace(doc, 20);
    let stat;
    try { stat = fs.statSync(path.join(dataDir, file)); } catch { stat = null; }
    bullet(doc, `data/${file} — ${stat ? (stat.size / 1024).toFixed(1) + ' KB' : 'ukuran tidak diketahui'} (lihat bab Database untuk schema lengkap)`);
  });
}

// ─── UML (disisipkan ke bab Architecture secara tekstual) ────────────────────

// ─── 19. FUTURE ROADMAP ───────────────────────────────────────────────────────

function sectionRoadmap(doc, ctx, todos) {
  addSectionHeading(doc, 19, 'Future Roadmap');
  bodyText(doc, 'Roadmap berikut dihasilkan otomatis dari struktur project dan komentar TODO/FIXME yang ditemukan di source code.');
  doc.moveDown(0.5);

  if (todos.length > 0) {
    h2(doc, 'Dari komentar TODO/FIXME di source');
    todos.slice(0, 40).forEach((t) => {
      ensureSpace(doc, 16);
      bullet(doc, `[${t.kind}] ${t.file}:${t.line} — ${t.text}`);
    });
    doc.moveDown(0.5);
  }

  h2(doc, 'Saran umum berdasarkan struktur project saat ini');
  const generic = [
    'Migrasi penyimpanan data dari file JSON ke database terstruktur (SQLite/Postgres) seiring bertambahnya volume histori sinyal.',
    'Tambahkan test otomatis (unit/integration) untuk modul analysis/ dan database/ agar perubahan strategi lebih aman.',
    'Pertimbangkan rotasi/rate-limit terpusat untuk seluruh API key eksternal (market data, AI provider).',
    'Perkuat validasi & sensor credential di seluruh file backup, tidak hanya di Developer Documentation Generator ini.',
    'Tambahkan mode dry-run/staging untuk trade scanner sebelum sinyal dikirim ke channel produksi.',
  ];
  generic.forEach((g) => bullet(doc, g));
}

module.exports = {
  sectionOverview,
  sectionArchitecture,
  sectionFolderStructure,
  sectionDependencies,
  sectionConfiguration,
  sectionDatabase,
  sectionTradingEngine,
  sectionSignalEngine,
  sectionNewsEngine,
  sectionAiEngine,
  sectionJournalEngine,
  sectionScheduler,
  sectionTelegramSystem,
  sectionExportSystem,
  sectionBackupSystem,
  sectionCommands,
  sectionSourceCode,
  sectionDataStructure,
  sectionRoadmap,
};
