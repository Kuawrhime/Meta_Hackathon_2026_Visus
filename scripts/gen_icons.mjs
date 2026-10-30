// Regenerate VISUS extension icons (public/icons/icon{16,32,48,128}.png).
// Pure Node (zlib PNG encoder) — charcoal rounded square, terracotta "V"
// (an open eye / book), petrol-blue iris dot on warm ivory highlight.
// Run: node scripts/gen_icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CHARCOAL = [28, 25, 23], TERRA = [194, 65, 12], PETROL = [15, 76, 92], IVORY = [250, 247, 241];
function crc32(buf) { let c, t = crc32.t; if (!t) { t = crc32.t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } } let r = 0xffffffff; for (const b of buf) r = t[(r ^ b) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function png(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const distSeg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); };
function render(size) {
  const px = Buffer.alloc(size * size * 4), s = size / 64, r = 14 * s;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, cx = Math.max(r - x, x - (size - 1 - r), 0), cy = Math.max(r - y, y - (size - 1 - r), 0);
    if (Math.hypot(cx, cy) > r) continue; // transparent outside rounded square
    let col = CHARCOAL;
    const u = x / s, v = y / s;
    if (Math.min(distSeg(u, v, 14, 16, 32, 48), distSeg(u, v, 50, 16, 32, 48)) < 3.5) col = TERRA;
    if (Math.hypot(u - 32, v - 18) < 2.2) col = IVORY; else if (Math.hypot(u - 32, v - 18) < 5.5) col = PETROL;
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
  }
  return png(size, px);
}
mkdirSync('public/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) { writeFileSync(`public/icons/icon${size}.png`, render(size)); console.log(`icon${size}.png`); }
