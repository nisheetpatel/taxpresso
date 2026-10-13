#!/usr/bin/env node
// Draws extension/icon.png (512 px): the Taxpresso cup from ui/src/shared/logo.ts (ICON_SVG), seen
// from above on an espresso tile, with the check drawn in the crema. Run by hand when the mark
// changes; the PNG is committed.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 512;
const U = (SIZE / 96) * 0.74; // pixels per logo unit (the cup is drawn on a 96-unit grid, scaled 0.74)
const C = SIZE / 2;
const CORNER = (24 / 96) * SIZE;
const TILE = [0x1e, 0x16, 0x12];
const RIM = [0xf6, 0xf0, 0xe8];
const COFFEE = [0x4a, 0x2c, 0x1d];
const CHECK_COLOR = [0xd7, 0xa8, 0x6e];

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function roundedSquareDistance(x, y) {
  const h = SIZE / 2;
  const qx = Math.abs(x - h) - (h - CORNER);
  const qy = Math.abs(y - h) - (h - CORNER);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - CORNER;
}

function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// The check: M-12 1 l8 8 17-18, in pixels.
const toPx = ([x, y]) => [C + x * U, C + y * U];
const CHECK = [toPx([-12, 1]), toPx([-4, 9]), toPx([13, -9])];

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    const r = Math.hypot(px - C, py - C);
    let color = [...TILE];
    const over = (c, a) => {
      for (let k = 0; k < 3; k++) color[k] = color[k] + (c[k] - color[k]) * a;
    };
    over(RIM, clamp01(0.5 - (Math.abs(r - 40 * U) - 7 * U)));
    over(COFFEE, clamp01(0.5 - (r - 24 * U)));
    let d = Infinity;
    for (let i = 0; i < CHECK.length - 1; i++) {
      d = Math.min(d, segmentDistance(px, py, CHECK[i], CHECK[i + 1]));
    }
    over(CHECK_COLOR, clamp01(0.5 - (d - 3.5 * U)));
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    for (let k = 0; k < 3; k++) raw[o + k] = Math.round(color[k]);
    raw[o + 3] = Math.round(255 * clamp01(0.5 - roundedSquareDistance(px, py)));
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icon.png');
writeFileSync(out, png);
console.log(`wrote ${path.relative(process.cwd(), out)} (${png.length} bytes)`);
