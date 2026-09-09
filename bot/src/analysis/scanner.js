'use strict';
const fs = require('fs');
const path = require('path');
const partsDir = path.join(__dirname, 'scanner_parts');
const parts = [];
for (let i = 0; i < 50; i++) {
  const p = path.join(partsDir, 'part_' + i + '.txt');
  if (!fs.existsSync(p)) break;
  parts.push(fs.readFileSync(p, 'utf8').replace(/\s+/g, ''));
}
if (parts.length === 0) throw new Error('scanner_parts empty');
const code = Buffer.from(parts.join(''), 'base64').toString('utf8');
if (code.length < 5000) throw new Error('decoded scanner too small: ' + code.length);
const out = path.join(__dirname, '.scanner_decoded.js');
fs.writeFileSync(out, code, 'utf8');
console.log('[SCANNER-BOOT] decoded', code.length, 'bytes from', parts.length, 'parts');
module.exports = require(out);
