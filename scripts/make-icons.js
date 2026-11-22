// Erzeugt einfache PNG-Icons (Judogi mit Gürtel) ohne Abhängigkeiten.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [30, 111, 217, 255], WHITE = [245, 245, 245, 255], BELT = [30, 30, 30, 255], SHADE = [200, 205, 215, 255];

function pixel(u, v) {
  // Gi-Jacke: Rumpf + Ärmel, V-Ausschnitt, schwarzer Gürtel mit Knoten
  const body = u > 0.3 && u < 0.7 && v > 0.2 && v < 0.82;
  const sleeveL = u > 0.12 && u <= 0.3 && v > 0.22 && v < 0.5 && v > 0.22 + (0.3 - u) * 0.0;
  const sleeveR = u >= 0.7 && u < 0.88 && v > 0.22 && v < 0.5;
  const belt = u > 0.3 && u < 0.7 && v > 0.55 && v < 0.64;
  const knot = u > 0.46 && u < 0.54 && v > 0.55 && v < 0.74;
  const vneck = Math.abs(u - 0.5) < (v - 0.2) * 0.45 && v < 0.55 && v > 0.2;
  if (belt || knot) return BELT;
  if (vneck) return SHADE;
  if (body || sleeveL || sleeveR) return WHITE;
  return BG;
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const s of [192, 512]) fs.writeFileSync(path.join(outDir, `icon-${s}.png`), png(s, pixel));
console.log('Icons geschrieben.');
