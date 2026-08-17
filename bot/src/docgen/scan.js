/**
 * scan.js — Project scanner untuk Developer Documentation Generator
 *
 * Membaca struktur project langsung dari filesystem: folder tree,
 * daftar file source, isi package.json, config, dan data — semuanya
 * dibaca otomatis (tidak ada data hardcode).
 *
 * AZZAVISION AI — Developer Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'output', 'logs', 'tmp', 'cache',
  'backups_v4', 'ebooks', '.replit-artifact',
]);

const SOURCE_EXT = new Set(['.js', '.ts', '.mjs', '.cjs']);

function shouldSkipDir(name) {
  return EXCLUDE_DIRS.has(name) || name.startsWith('.');
}

/** Jalan rekursif di sebuah root, mengembalikan daftar file absolut + relatif. */
function walk(root, { extensions = null } = {}) {
  const results = [];
  (function recurse(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        recurse(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        if (extensions && !extensions.has(path.extname(entry.name))) continue;
        const abs = path.join(dir, entry.name);
        results.push({ abs, rel: path.relative(root, abs) });
      }
    }
  })(root);
  return results;
}

/** Bangun representasi tree folder (teks, ala `tree`). */
function buildFolderTree(root, { maxDepth = 6 } = {}) {
  const lines = [];
  function recurse(dir, prefix, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => !shouldSkipDir(e.name));
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    entries.forEach((entry, idx) => {
      const isLast = idx === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);
      if (entry.isDirectory()) {
        recurse(path.join(dir, entry.name), prefix + (isLast ? '    ' : '│   '), depth + 1);
      }
    });
  }
  lines.push(`${path.basename(root)}/`);
  recurse(root, '', 1);
  return lines;
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length === 0) return 0;
    return content.split(/\r\n|\r|\n/).length;
  } catch {
    return 0;
  }
}

function countAllDirs(root) {
  let count = 0;
  (function recurse(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !shouldSkipDir(entry.name)) {
        count += 1;
        recurse(path.join(dir, entry.name));
      }
    }
  })(root);
  return count;
}

/** Ambil daftar sub-folder langsung dari `root/src` untuk gambaran arsitektur. */
function listTopLevelModules(srcDir) {
  try {
    return fs.readdirSync(srcDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !shouldSkipDir(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** Cari komentar TODO/FIXME di source untuk dijadikan bahan roadmap otomatis. */
function findTodos(sourceFiles) {
  const todos = [];
  const re = /\/\/\s*(TODO|FIXME)[:\s]+(.+)/i;
  for (const f of sourceFiles) {
    let content;
    try {
      content = fs.readFileSync(f.abs, 'utf8');
    } catch {
      continue;
    }
    content.split(/\r\n|\r|\n/).forEach((line, idx) => {
      const m = line.match(re);
      if (m) todos.push({ file: f.rel, line: idx + 1, kind: m[1].toUpperCase(), text: m[2].trim() });
    });
  }
  return todos;
}

module.exports = {
  walk,
  buildFolderTree,
  countLines,
  countAllDirs,
  listTopLevelModules,
  findTodos,
  EXCLUDE_DIRS,
  SOURCE_EXT,
};
