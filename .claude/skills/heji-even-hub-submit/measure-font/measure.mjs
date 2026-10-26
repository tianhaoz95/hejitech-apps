#!/usr/bin/env node
// Measures the Even G2 firmware font in the Even Hub simulator: the line pitch of a text container
// and every glyph's advance width (each glyph drawn 10 and 20 times, widths differenced), printed as
// JSON. G2 Digest's table (projects/g2digest/packages/core/src/font.ts, 2026-10-26) came from this.
// Needs only Node and `npx evenhub-simulator`; run from the repo root (node_modules has the SDK):
//   node .claude/skills/heji-even-hub-submit/measure-font/measure.mjs [extra characters] > font.json
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const sdk = readFileSync(join(process.cwd(), "node_modules/@evenrealities/even_hub_sdk/dist/index.js"));
const chars = [...Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)), ..."·♪–—’‘“”…•×°€£¥é", ...(process.argv[2] ?? "")];
const batches = [];
for (let i = 0; i < chars.length; i += 4) batches.push(chars.slice(i, i + 4));
const screens = [Array.from({ length: 9 }, (_, i) => `H${i}`).join("\n"), ...batches.map((b) => b.flatMap((c) => [c.repeat(10), c.repeat(20)]).join("\n")), ["x" + " ".repeat(10) + "x", "x" + " ".repeat(20) + "x"].join("\n")];

const PORT = 8799, AUTO = 9898, PITCH_GUESS = 27;
const server = createServer((req, res) => {
  const files = { "/": [readFileSync(join(here, "page.html")), "text/html"], "/sdk.js": [sdk, "text/javascript"], "/screens.json": [JSON.stringify({ screens }), "application/json"] };
  const f = files[req.url.split("?")[0]];
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": f[1] }).end(f[0]);
}).listen(PORT, "127.0.0.1");
const sim = spawn("npx", ["evenhub-simulator", "--automation-port", String(AUTO), `http://127.0.0.1:${PORT}/`], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const auto = (path, init) => fetch(`http://127.0.0.1:${AUTO}${path}`, init);

/** Alpha channel of an RGBA PNG (the simulator's export), as rows. */
function alpha(png) {
  let pos = 8, width = 0, height = 0;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos), type = png.toString("ascii", pos + 4, pos + 8), data = png.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") [width, height] = [data.readUInt32BE(0), data.readUInt32BE(4)];
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (line[x] + pred) & 0xff;
    }
  }
  return { width, height, at: (x, y) => out[y * stride + x * bpp + 3] };
}
const extent = (img, top, bottom) => {
  let lo = Infinity, hi = -1;
  for (let y = top; y < Math.min(bottom, img.height); y++) for (let x = 0; x < img.width; x++) if (img.at(x, y) > 60) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return hi < 0 ? null : hi - lo;
};
const shot = async () => alpha(Buffer.from(await (await auto("/api/screenshot/glasses")).arrayBuffer()));

try {
  for (let i = 0; i < 60 && !(await auto("/api/ping").then((r) => r.ok, () => false)); i++) await sleep(1000);
  await sleep(6000);
  const probe = await shot();
  const tops = [];
  for (let y = 0, inLine = false; y < probe.height; y++) {
    let lit = false;
    for (let x = 0; x < probe.width && !lit; x++) lit = probe.at(x, y) > 60;
    if (lit && !inLine) tops.push(y);
    if (!lit && inLine && tops.length && y - tops.at(-1) > 4) inLine = false;
    if (lit) inLine = true;
  }
  const pitch = tops.length > 1 ? Math.round((tops.at(-1) - tops[0]) / (tops.length - 1)) : PITCH_GUESS;
  const glyphs = {}, missing = [];
  const click = () => auto("/api/input", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "click" }) });
  for (const batch of batches) {
    await click();
    await sleep(700);
    const img = await shot();
    batch.forEach((c, j) => {
      const w10 = extent(img, 2 * j * pitch, (2 * j + 1) * pitch), w30 = extent(img, (2 * j + 1) * pitch, (2 * j + 2) * pitch);
      // A glyph that isn't in the font draws nothing, or the same width however often it repeats.
      if (w10 === null || w30 === null || w30 === w10) missing.push(c);
      else glyphs[c] = Math.round((w30 - w10) / 10);
    });
  }
  await click();
  await sleep(700);
  const sp = await shot();
  glyphs[" "] = Math.round((extent(sp, pitch, 2 * pitch) - extent(sp, 0, pitch)) / 10);
  console.log(JSON.stringify({ measured: new Date().toISOString().slice(0, 10), line_pitch_px: pitch, missing, glyphs }, null, 1));
} finally {
  sim.kill();
  server.close();
}
