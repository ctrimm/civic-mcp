#!/usr/bin/env node
/**
 * scripts/generate-icons.js
 *
 * Generates placeholder Civic-MCP extension icons as solid-color PNGs.
 * Uses only Node.js built-ins (no external dependencies).
 *
 * Run: node scripts/generate-icons.js
 *
 * Output: packages/extension/src/assets/icon-{16,32,48,128}.png
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../packages/extension/src/assets');
mkdirSync(outDir, { recursive: true });

// Civic blue — matches Tailwind blue-700 (#1a56db)
const FILL_COLOR = [0x1a, 0x56, 0xdb];

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const forCrc = Buffer.concat([t, d]);
  return Buffer.concat([uint32BE(d.length), t, d, uint32BE(crc32(forCrc))]);
}

function makePNG(size) {
  const [r, g, b] = FILL_COLOR;

  // Build raw (uncompressed) image rows — PNG filter type 0 (None) per row
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0; // filter byte: None
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth, color type 2 (RGB), compression, filter, interlace
  const ihdrData = Buffer.concat([
    uint32BE(size),
    uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0]),
  ]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const outPath = path.join(outDir, `icon-${size}.png`);
  writeFileSync(outPath, makePNG(size));
  console.log(`✓ Generated ${outPath} (${size}x${size})`);
}
