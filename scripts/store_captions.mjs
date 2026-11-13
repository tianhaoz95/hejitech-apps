#!/usr/bin/env node
// Captioned App Store slides (1320 x 2868, the 6.9" iPhone size) from a project's raw screenshots:
// a headline and a line under it, over an iPhone screen, the watch or the Even G2 glasses view.
//
//   node scripts/store_captions.mjs projects/<name>/apps/ios/AppStore/captions.json
//
// captions.json: { "accent": "#3EE07A", "out": "screenshots/iphone-6.9-captioned", "slides": [
//   { "kind": "phone" | "watch" | "glasses", "images": ["screenshots/..."], "title": "…", "sub": "…",
//     "badge": "optional pill above the title" } ] }
// Paths are relative to captions.json. Writes NN-<kind>.png, ready for asc.mjs upload-screenshots.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const specPath = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !fs.existsSync(specPath)) { console.error("usage: store_captions.mjs <captions.json>"); process.exit(2); }
const base = path.dirname(specPath);
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const out = path.join(base, spec.out ?? "screenshots/iphone-6.9-captioned");
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith(".png")) fs.unlinkSync(path.join(out, f));

const W = 1320, H = 2868;
const img = (p) => `data:image/png;base64,${fs.readFileSync(path.join(base, p)).toString("base64")}`;
const esc = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function body(s) {
  if (s.kind === "phone") return `<div class="phone"><img src="${img(s.images[0])}"></div>`;
  if (s.kind === "watch") return `<div class="stage"><div class="watch"><img src="${img(s.images[0])}"></div></div>`;
  if (s.kind === "glasses") return `<div class="stage"><div class="lenses">${s.images.map((p) => `<div class="lens"><img src="${img(p)}"></div>`).join("")}</div></div>`;
  throw new Error(`unknown kind ${s.kind}`);
}

function page(s) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { background: radial-gradient(120% 60% at 50% 0%, ${spec.accent}33 0%, #0b0c0e 55%), #0b0c0e;
         font-family: -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif; color: #fff;
         display: flex; flex-direction: column; align-items: center; }
  header { padding: 150px 96px 0; text-align: center; min-height: 640px; flex: none; display: flex; flex-direction: column;
           align-items: center; justify-content: flex-start; gap: 34px; }
  .badge { font-size: 40px; font-weight: 600; color: #0b0c0e; background: ${spec.accent}; padding: 14px 34px;
           border-radius: 999px; letter-spacing: .2px; }
  h1 { font-size: 104px; line-height: 1.05; font-weight: 800; letter-spacing: -2px; }
  h1 em { font-style: normal; color: ${spec.accent}; }
  p { font-size: 50px; line-height: 1.3; color: #b9bdc6; font-weight: 500; max-width: 1080px; }
  .phone { width: 1040px; height: 2260px; border-radius: 96px; overflow: hidden; margin-top: 10px;
           border: 10px solid #2a2d33; box-shadow: 0 40px 120px #000c; }
  .phone img { width: 100%; display: block; }
  .stage { flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; padding-bottom: 200px; }
  .watch { width: 900px; padding: 70px 56px; border-radius: 230px; background: #000;
           border: 30px solid #1d1f23; box-shadow: 0 0 0 6px #3a3d44, 0 40px 120px #000c; }
  .watch img { width: 100%; display: block; }
  .lenses { display: flex; flex-direction: column; gap: 90px; align-items: center; }
  .lens { width: 1180px; padding: 34px; border-radius: 64px; background: linear-gradient(160deg, #13261a, #050806);
          box-shadow: 0 0 0 4px #24402c, 0 40px 120px #000c; }
  .lens img { width: 100%; display: block; mix-blend-mode: screen; image-rendering: auto; }
  </style></head><body>
  <header>${s.badge ? `<div class="badge">${esc(s.badge)}</div>` : ""}<h1>${s.title}</h1>${s.sub ? `<p>${esc(s.sub)}</p>` : ""}</header>
  ${body(s)}
  <script>
    // Long titles shrink until the header fits above the screen.
    const h = document.querySelector("header"), t = document.querySelector("h1"), sub = document.querySelector("p");
    let size = 104;
    while (h.scrollHeight > 640 && size > 64) { size -= 4; t.style.fontSize = size + "px"; if (sub) sub.style.fontSize = Math.max(40, size / 2) + "px"; }
  </script></body></html>`;
}

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let n = 0;
for (const s of spec.slides) {
  n += 1;
  await tab.setContent(page(s), { waitUntil: "load" });
  const f = path.join(out, `${String(n).padStart(2, "0")}-${s.kind}.png`);
  await tab.screenshot({ path: f, omitBackground: false });
  console.log(f);
}
await browser.close();
