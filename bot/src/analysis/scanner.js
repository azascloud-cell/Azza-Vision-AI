'use strict';
const fs = require('fs');
const path = require('path');
const partsDir = path.join(__dirname, 'scanner_parts');
const parts = [];
for (let i = 0; i < 20; i++) {
  const p = path.join(partsDir, `part_${i}.txt`);
  if (!fs.existsSync(p)) break;
  parts.push(fs.readFileSync(p, 'utf8'));
}
if (parts.length === 0) {
  throw new Error('scanner parts missing — restore failed');
}
const code = Buffer.from(parts.join(''), 'base64').toString('utf8');
const out = path.join(__dirname, '.scanner_decoded.js');
fs.writeFileSync(out, code, 'utf8');
module.exports = require(out);
