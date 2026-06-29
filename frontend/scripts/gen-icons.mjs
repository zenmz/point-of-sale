// Generator ikon PWA: PNG jade penuh (maskable) dengan motif garis "struk".
// Tanpa dependensi — encoder PNG mini pakai zlib bawaan Node.
// Jalankan: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const JADE = [31, 138, 91]; // #1f8a5b
const PAPER = [246, 245, 240]; // #f6f5f0
const SAFFRON = [233, 162, 59]; // #e9a23b

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  // Susun RGBA per piksel.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const r = size * 0.16; // radius "kartu"
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < size; x++) {
      let col = JADE;
      // Tiga garis kertas (motif struk) di bagian tengah.
      const band = size * 0.5;
      const stripe = size * 0.08;
      if (y > band - stripe * 2 && y < band - stripe) col = PAPER;
      else if (y > band && y < band + stripe) col = PAPER;
      else if (y > band + stripe * 2 && y < band + stripe * 3) col = SAFFRON;
      const o = rowStart + 1 + x * 4;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
      raw[o + 3] = 255;
    }
  }
  void r;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size));
  console.log(`public/icon-${size}.png`);
}
