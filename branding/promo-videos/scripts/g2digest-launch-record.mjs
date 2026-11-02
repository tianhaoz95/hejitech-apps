#!/usr/bin/env node
// Screen recordings for the g2digest-launch promo, from the LOCAL stack only (never production): the
// seed reader (reader@example.com) with a demo brief and a demo edition written for the video
// (scripts/g2digest-launch-demo: made-up line, places, results and numbers; audio read by Kokoro).
// "The agent" is this script publishing through G2 Digest's MCP tools with the seed's local agent
// token, exactly as a build agent does (projects/g2digest/scripts/publish-bundle.mjs). Run from the repo root:
//
//   supabase start; npm run dev:worker -w @g2digest/web          (Worker on 127.0.0.1:8790)
//   <venv>/bin/python -I branding/promo-videos/scripts/g2digest-launch-demo/make-audio.py \
//     branding/promo-videos/scripts/g2digest-launch-demo <work> 2026-11-01      (Kokoro venv: see the -vo.py)
//   node branding/promo-videos/scripts/g2digest-launch-record.mjs stage <work>   back up the g2digest rows,
//                        save the demo brief, publish the demo edition for 2026-10-31 and 2026-11-01
//   node … glasses       rec-glasses-open, rec-glasses-swipe, rec-glasses-deepdive (Even Hub simulator)
//   node … web           rec-web-edition, rec-web-brief (Playwright, desktop)
//   node … restore       every g2digest row and the audio files back as they were before `stage`
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(".");
const OUT = "branding/promo-videos/public/g2digest-launch";
const WORK = join(tmpdir(), "g2digest-launch-record");
mkdirSync(WORK, { recursive: true });
const site = "http://127.0.0.1:8790", supabase = "http://127.0.0.1:55421", sim = "http://127.0.0.1:9902";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const AGENT = "g2a_dev_local_token"; // the seed's local agent token (projects/g2digest/CLAUDE.md)
const READER = "00000000-0000-4000-8000-0000000002d1";
const DATES = ["2026-10-31", "2026-11-01"];
const DB = "supabase_db_waypack"; // the shared local stack's Postgres container
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], ...opts })?.toString() ?? "";
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });

const signIn = async () =>
  (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "reader@example.com", password: "g2digest-dev" }) })).json();
const api = async (tok, path, init = {}) => {
  for (let i = 0; ; i++) {
    const text = await (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).text();
    try { return JSON.parse(text); } catch { if (i >= 2) throw new Error(`${path}: ${text.slice(0, 120)}`); await sleep(500); }
  }
};

async function removeAudio() {
  const storage = (path, init = {}) => fetch(`${supabase}/storage/v1${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" } });
  for (const d of DATES) {
    const files = await (await storage(`/object/list/g2digest`, { method: "POST", body: JSON.stringify({ prefix: `${READER}/${d}`, limit: 1000 }) })).json();
    const prefixes = files.map((f) => `${READER}/${d}/${f.name}`);
    if (prefixes.length) await storage(`/object/g2digest`, { method: "DELETE", body: JSON.stringify({ prefixes }) });
  }
}

async function stage() {
  const work = process.argv[3];
  if (!work || !existsSync(join(work, DATES[1], "bundle.json"))) throw new Error("usage: stage <work dir from make-audio.py>");
  const backup = join(WORK, "g2digest-backup.sql");
  if (!existsSync(backup)) {
    writeFileSync(backup, sh("docker", ["exec", DB, "pg_dump", "-U", "postgres", "--data-only", "--schema=g2digest"]));
    console.log(`backed up the g2digest rows to ${backup}`);
  }
  // The day before reuses today's audio (the list of editions just needs a second, older one).
  if (!existsSync(join(work, DATES[0]))) {
    cpSync(join(work, DATES[1]), join(work, DATES[0]), { recursive: true });
    const b = JSON.parse(readFileSync(join(work, DATES[0], "bundle.json"), "utf8"));
    b.date = DATES[0];
    writeFileSync(join(work, DATES[0], "bundle.json"), JSON.stringify(b, null, 2));
  }
  const tok = (await signIn()).access_token;
  const cur = await api(tok, "/api/brief");
  const brief = { ...JSON.parse(readFileSync("branding/promo-videos/scripts/g2digest-launch-demo/brief.json", "utf8")) };
  const saved = await api(tok, "/api/brief", { method: "PUT", body: JSON.stringify({ brief, expected_version: cur.brief_version }) });
  if (saved.error) throw new Error(`brief: ${JSON.stringify(saved)}`);
  console.log("demo brief saved, version", saved.brief_version);
  for (const d of DATES)
    sh("node", ["projects/g2digest/scripts/publish-bundle.mjs", "--site", site, "--token", AGENT, "--bundle", join(work, d, "bundle.json"), "--audio", join(work, d, "audio"), "--log", join(WORK, `publish-${d}.log`)], { stdio: "inherit" });
}

async function restore() {
  const backup = join(WORK, "g2digest-backup.sql");
  if (!existsSync(backup)) throw new Error("no backup: run stage first");
  await removeAudio();
  const tables = sql(`select string_agg('g2digest.'||quote_ident(table_name), ', ') from information_schema.tables where table_schema='g2digest' and table_type='BASE TABLE';`).trim();
  sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: `begin; set session_replication_role = replica; truncate ${tables};\n${readFileSync(backup, "utf8")}\ncommit;` });
  console.log("restored the g2digest rows from", backup, "and removed the demo audio");
}

// ---------- glasses: the Even Hub simulator's screenshot API while sending R1 gestures -----------
const input = async (action, wait = 1200) => {
  await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  await sleep(wait);
};
/** Polls the simulator (~12 fps; alpha = the lit pixels) and joins the frames into a G2-green-on-black 1728×864 MP4. */
async function recordGlasses(name, steps) {
  const dir = join(WORK, `frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  let on = true;
  const grab = (async () => {
    for (let i = 0; on; i++) {
      const t = Date.now();
      const f = join(dir, `${String(i).padStart(4, "0")}.png`);
      writeFileSync(f, Buffer.from(await (await fetch(`${sim}/api/screenshot/glasses`)).arrayBuffer()));
      frames.push([f, t]);
      await sleep(Math.max(0, 80 - (Date.now() - t)));
    }
  })();
  for (const [action, ms] of steps) {
    if (action !== "wait") await input(action, 0);
    await sleep(ms);
  }
  on = false;
  await grab;
  let list = "";
  frames.forEach(([f, t], i) => (list += `file '${f}'\nduration ${((frames[i + 1]?.[1] ?? t + 80) - t) / 1000}\n`));
  writeFileSync(join(dir, "list.txt"), list + `file '${frames.at(-1)[0]}'\n`);
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf",
    "format=rgba,alphaextract,scale=1728:864:flags=lanczos,format=rgb24,colorchannelmixer=rr=0.239:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bb=0.478,fps=30,format=yuv420p",
    "-c:v", "libx264", "-crf", "16", join(OUT, `rec-${name}.mp4`)]);
  console.log(`rec-${name}.mp4: ${frames.length} frames`);
}

async function glasses() {
  const tok = (await signIn()).access_token;
  const code = (await api(tok, "/api/pairing-code", { method: "POST" })).code;
  const simProc = spawn("npx", ["evenhub-simulator", `${site}/glasses/?pair=${code}`, "--automation-port", "9902", "--no-glow"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 30 && !(await fetch(`${sim}/api/ping`).then((r) => r.ok, () => false)); i++) await sleep(1000);
    await sleep(12_000); // pairing and the list of editions
    // The list (today's edition on top), then open it: the cover, the first card.
    await recordGlasses("glasses-open", [["wait", 1600], ["click", 3200]]);
    // Skim (a swipe up on the ring is "next"): TL;DR → my line → the reef card.
    await recordGlasses("glasses-swipe", [["wait", 700], ["up", 1300], ["up", 1300], ["up", 1800]]);
    // Hold on the reef card: its deep dive plays.
    await recordGlasses("glasses-deepdive", [["wait", 800], ["long_press", 200], ["long_press_release", 4500]]);
    await input("double_click", 500);
  } finally {
    simProc.kill();
    try { sh("pkill", ["-f", "evenhub-simulator.*9902"]); } catch { /* gone */ }
  }
}

// ---------- web: CDP screencast frames → constant 30 fps MP4 ---------------------------------------
const pointerScript = `
  addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "#promo-cursor{position:fixed;z-index:99999;width:26px;height:26px;margin:-4px 0 0 -6px;pointer-events:none;transition:transform .12s}" +
      "#promo-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}";
    document.head.append(s);
    const c = document.createElement("div");
    c.id = "promo-cursor";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    c.style.left = (innerWidth * 0.6) + "px"; c.style.top = (innerHeight * 0.55) + "px";
    document.body.append(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; });
    addEventListener("mousedown", () => { c.style.transform = "scale(.85)"; });
    addEventListener("mouseup", () => { c.style.transform = ""; });
  });`;

async function record(chromium, session, name, script) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1120, height: 630 }, deviceScaleFactor: 2, colorScheme: "dark" });
  // supabase-js keeps the session in localStorage under sb-<host>-auth-token.
  await context.addInitScript((s) => localStorage.setItem("sb-127-auth-token", s), JSON.stringify(session));
  await context.addInitScript(pointerScript);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const dir = mkdtempSync(join(tmpdir(), `g2-rec-${name}-`));
  const frames = [];
  let recording = false;
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    if (recording) {
      const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      frames.push({ file, t: metadata.timestamp });
    }
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const start = async () => {
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2240, maxHeight: 1260, everyNthFrame: 1 });
    await sleep(300);
    recording = true;
    await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;background:rgba(0,0,0,.01)"; document.body.append(d); requestAnimationFrame(() => requestAnimationFrame(() => d.remove())); });
  };
  await script(page, start);
  await sleep(400);
  recording = false;
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await page.screenshot({ path: join(OUT, `still-${name}.png`) });
  await browser.close();
  if (errors.length) console.warn(`${name}: page errors`, errors);
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(join(dir, "list.txt"), list);
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(OUT, `rec-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${(end - frames[0].t).toFixed(1)} s`);
}
async function moveTo(page, locator, steps = 28) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await sleep(250);
}
const smoothScroll = (page, y) => page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);

async function web() {
  const { chromium } = createRequire(`${REPO}/package.json`)("playwright");
  const session = await signIn();
  const which = process.argv.slice(3);
  const want = (n) => !which.length || which.includes(n);
  if (want("web-edition")) await record(chromium, session, "web-edition", async (page, start) => {
    // The preview: the cards as the glasses show them, stepped through; then the full edition with its sources.
    await page.goto(`${site}/preview/${DATES[1]}`, { waitUntil: "networkidle" });
    await sleep(800);
    const next = page.getByRole("button", { name: /Swipe up/ });
    await page.mouse.move(900, 520);
    await start();
    await sleep(600);
    for (let i = 0; i < 3; i++) { await moveTo(page, next, i ? 6 : 24); await next.click(); await sleep(800); }
    await sleep(300);
  });
  if (want("web-full")) await record(chromium, session, "web-full", async (page, start) => {
    await page.goto(`${site}/edition/${DATES[1]}`, { waitUntil: "networkidle" });
    await sleep(800);
    await page.mouse.move(700, 420);
    await start();
    await sleep(900);
    await smoothScroll(page, 360);
    await sleep(2200);
  });
  if (want("web-brief")) await record(chromium, session, "web-brief", async (page, start) => {
    // "I write the brief": the Ocean science instructions, typed (never saved).
    await page.goto(`${site}/brief/`, { waitUntil: "networkidle" });
    await sleep(1000);
    const head = page.getByText("2. Ocean science");
    const box = page.locator("textarea").nth(3);
    await box.fill("");
    await page.evaluate((y) => window.scrollTo(0, y), (await head.evaluate((e) => e.getBoundingClientRect().top + scrollY)) - 90);
    await page.mouse.move(900, 300);
    await start();
    await sleep(500);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), (await box.evaluate((e) => e.getBoundingClientRect().top + scrollY)) - 260);
    await sleep(700);
    await moveTo(page, box, 18);
    await box.click();
    await page.keyboard.type("New results about the ocean, with numbers behind them. Rank by how much they change what is possible, not by hype.", { delay: 26 });
    await sleep(900);
  });
}

const cmd = process.argv[2];
const run = { stage, restore, glasses, web }[cmd];
if (!run) {
  console.error("usage: g2digest-launch-record.mjs stage <work> | glasses | web [beat …] | restore");
  process.exit(1);
}
await run();
