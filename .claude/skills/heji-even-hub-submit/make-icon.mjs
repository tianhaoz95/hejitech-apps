#!/usr/bin/env node
// Writes an Even Hub store icon from a 12 × 12 grid: 24 × 24 RGBA PNG, every `#` a 2 × 2 block of
// #F4F4F4 at full opacity, everything else fully transparent (what the portal's validator accepts).
// No dependencies (node:zlib only), so it works on a fresh machine.
//   node .claude/skills/heji-even-hub-submit/make-icon.mjs grid.txt out/icon-24.png
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const [gridFile, out] = process.argv.slice(2);
if (!gridFile || !out) {
  console.error("usage: make-icon.mjs <grid.txt: 12 lines of 12 '#' or '.'> <out.png>");
  process.exit(2);
}
const rows = readFileSync(gridFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
if (rows.length !== 12 || rows.some((r) => !/^[#.]{12}$/.test(r))) {
  console.error("the grid must be 12 lines of exactly 12 characters, each '#' (lit) or '.' (off)");
  process.exit(1);
}

const SIZE = 24, LIT = [0xf4, 0xf4, 0xf4, 0xff], OFF = [0, 0, 0, 0];
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const row = y * (1 + SIZE * 4);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) Buffer.from(rows[y >> 1][x >> 1] === "#" ? LIT : OFF).copy(raw, row + 1 + x * 4);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
writeFileSync(out, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]));
console.log(`wrote ${out} (24 × 24, #F4F4F4 on transparent)`);
