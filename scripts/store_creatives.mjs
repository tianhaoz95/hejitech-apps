#!/usr/bin/env node
// App Store creative assets (iOS 27+ product page header and search results) for a HEJI iOS app,
// drawn from the app's brand and its real App Store screenshots, rendered with Playwright.
//
//   node scripts/store_creatives.mjs headway      # or fitloop
//
// Output: projects/<name>/apps/ios/AppStore/creative/{header.png,search-results.png}, opaque PNGs at
// Apple's sizes (header 21:9 3840x1646, search results 3:2 3840x2560). What matters stays inside
// Apple's art safe areas (header 1646x661, search 2168x1030, both centered); the rest is bleed that
// some devices crop. Upload: .claude/skills/heji-app-store-connect/asc.mjs upload-creative.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = process.argv[2];
const SAFE = process.argv.includes("--safe"); // outline the safe areas (for checking only)

// Per project: palette, the motif drawn behind (SVG in a 1024 box, like the icon), copy and shots.
const PROJECTS = {
  headway: {
    bg: ["#0d2416", "#03100a"], accent: "#3dff7a", ink: "#eafff0", muted: "#9fc9ad",
    headline: "Your next Caltrain,<br>at a glance.",
    sub: "Live departures, delay alerts<br>and leave-by times.",
    shots: ["01-trains", "02-commute", "03-family"],
    motif: (c) => `
      <g stroke="${c}" stroke-linecap="round" fill="none">
        <path d="M-200 1024 L470 380" stroke-width="22"/>
        <path d="M1224 1024 L554 380" stroke-width="22"/>
        ${[[960, 26, 0.5], [800, 22, 0.42], [672, 18, 0.36], [572, 15, 0.3], [494, 12, 0.24], [432, 9, 0.18]]
          .map(([y, w, o]) => { const t = (1024 - y) / 644, half = 700 - t * 640;
            return `<path d="M${512 - half} ${y} H${512 + half}" stroke-width="${w}" opacity="${o}"/>`; }).join("")}
      </g>`,
  },
  fitloop: {
    bg: ["#14112b", "#05040f"], accent: "#ff7a45", ink: "#fff1ea", muted: "#c9b8c9",
    headline: "Your agent's plan,<br>set by set.",
    sub: "Workouts and meals your AI writes,<br>ready to follow.",
    shots: ["01-today", "02-workout", "03-plan"],
    motif: (c) => `
      <g fill="none" stroke-linecap="round">
        <path d="M512 196 A316 316 0 1 1 238 354" stroke="${c}" stroke-width="40"/>
      </g>
      <path d="M290 262 L292 420 L154 344 Z" fill="${c}" stroke="${c}" stroke-width="12" stroke-linejoin="round"/>`,
  },
};
const P = PROJECTS[project];
if (!P) { console.error(`usage: store_creatives.mjs <${Object.keys(PROJECTS).join("|")}>`); process.exit(2); }

const ios = join(root, "projects", project, "apps/ios/AppStore");
const shot = (n) => {
  const f = join(ios, "screenshots/iphone-6.9", `${n}.png`);
  if (!existsSync(f)) throw new Error(`missing ${f}: run scripts/store_screenshots.sh ${project}`);
  return `data:image/png;base64,${readFileSync(f).toString("base64")}`;
};
const icon = `data:image/png;base64,${readFileSync(join(root, "projects", project, "branding/icon-1024.png")).toString("base64")}`;

// A phone: the real screenshot in a dark rounded frame. h = height in px.
const phone = (src, h, extra = "") => {
  const w = h * 1320 / 2868, r = h * 0.075, b = h * 0.012;
  return `<div class="phone" style="width:${w}px;height:${h}px;border-radius:${r}px;padding:${b}px;${extra}">
    <img src="${src}" style="border-radius:${r - b}px"></div>`;
};

const css = (W, H) => `
  *{margin:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:linear-gradient(170deg, ${P.bg[0]} 0%, ${P.bg[1]} 75%);font-family:-apple-system,"SF Pro Display",system-ui,sans-serif;color:${P.ink};position:relative}
  .glow{position:absolute;border-radius:50%;background:radial-gradient(closest-side, ${P.accent}55, ${P.accent}00);filter:blur(40px)}
  .motif{position:absolute;filter:drop-shadow(0 0 18px ${P.accent}88)}
  .phone{position:absolute;background:#1b1d1f;box-shadow:0 0 0 3px #3a3d40 inset, 0 60px 160px #000c, 0 0 120px ${P.accent}22}
  .phone img{width:100%;height:100%;display:block;object-fit:cover}
  h1{font-weight:800;letter-spacing:-0.02em;line-height:1.02}
  p{color:${P.muted};font-weight:500;line-height:1.25}
  .safe{position:absolute;outline:6px dashed #f0f;z-index:99}
`;

function header() {
  const W = 3840, H = 1646, sx = 1097, sy = 493, sw = 1646, sh = 661;
  // One clear idea: the motif opening up behind the app's own screen, centered; more screens recede
  // into the bleed on both sides.
  const big = 1500;
  return `<style>${css(W, H)}</style>
    <div class="glow" style="left:${W / 2 - 1100}px;top:${H / 2 - 900}px;width:2200px;height:1800px"></div>
    <svg class="motif" viewBox="0 0 1024 1024" style="left:${W / 2 - 1250}px;top:${H / 2 - 1250}px;width:2500px;height:2500px;opacity:.32">${P.motif(P.accent)}</svg>
    ${phone(shot(P.shots[1]), big * 0.86, `left:${W / 2 - 1500}px;top:${H / 2 - big * 0.43 + 120}px;transform:rotate(-7deg);opacity:.9`)}
    ${phone(shot(P.shots[2]), big * 0.86, `left:${W / 2 + 1500 - big * 0.86 * 1320 / 2868}px;top:${H / 2 - big * 0.43 + 120}px;transform:rotate(7deg);opacity:.9`)}
    ${phone(shot(P.shots[0]), big, `left:${W / 2 - big * 1320 / 2868 / 2}px;top:${sy - 330}px`)}
    ${SAFE ? `<div class="safe" style="left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px"></div>` : ""}`;
}

function search() {
  const W = 3840, H = 2560, sx = 836, sy = 765, sw = 2168, sh = 1030;
  // States the purpose at a glance: headline + one line on the left of the safe area, the app's own
  // screen on the right, two more fanned behind it into the bleed.
  const ph = 1750, pw = ph * 1320 / 2868, px = sx + sw - pw - 120, py = sy - 130;
  return `<style>${css(W, H)}</style>
    <div class="glow" style="left:${px - 600}px;top:${py - 400}px;width:${pw + 1500}px;height:${ph + 600}px"></div>
    <svg class="motif" viewBox="0 0 1024 1024" style="left:${px + pw / 2 - 1300}px;top:${H / 2 - 1100}px;width:2600px;height:2600px;opacity:.28">${P.motif(P.accent)}</svg>
    ${phone(shot(P.shots[2]), ph * 0.8, `left:${px + 820}px;top:${py + 260}px;transform:rotate(12deg);opacity:.6`)}
    ${phone(shot(P.shots[1]), ph * 0.88, `left:${px + 470}px;top:${py + 150}px;transform:rotate(7deg);opacity:.85`)}
    ${phone(shot(P.shots[0]), ph, `left:${px}px;top:${py}px`)}
    <div style="position:absolute;left:${sx}px;top:${sy}px;width:${sw - pw - 260}px;height:${sh}px;display:flex;flex-direction:column;justify-content:center;gap:56px">
      <img src="${icon}" style="width:190px;height:190px;border-radius:44px;box-shadow:0 20px 60px #0009">
      <h1 style="font-size:138px">${P.headline}</h1>
      <p style="font-size:62px">${P.sub}</p>
    </div>
    ${SAFE ? `<div class="safe" style="left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px"></div>` : ""}`;
}

const out = join(ios, "creative");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, W, H, html] of [["header", 3840, 1646, header()], ["search-results", 3840, 2560, search()]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body>${html}</body></html>`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const f = join(out, `${name}${SAFE ? "-safe" : ""}.png`);
  await page.screenshot({ path: f, omitBackground: false });
  console.log(f);
  await page.close();
}
await browser.close();
