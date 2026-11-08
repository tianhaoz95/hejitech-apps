#!/usr/bin/env node
// Recordings for the G2 Digest walkthrough (reports/2026-11-02-g2digest-demo-video, skill heji-demo-video),
// from the LOCAL stack only (never production): the seed reader (reader@example.com), a demo brief whose
// sources are made-up feeds (scripts/g2digest-demo-sources, served on 127.0.0.1:8899), and a REAL agent run:
// Claude Code, connected over OAuth to the local MCP server, runs projects/g2digest/pipeline/build-prompt.md.
// Every recording gets an event log (rec-<name>.events.json: each action's time in the clip and its target's
// box in the clip's pixels) that aims the edit's camera, spotlight and labels. Run from the repo root:
//
//   supabase start; npm run dev:worker -w @g2digest/web                 (Worker on 127.0.0.1:8790)
//   (cd branding/promo-videos/scripts/g2digest-demo-sources && python3 -m http.server 8899 --bind 127.0.0.1)
//   node branding/promo-videos/scripts/g2digest-demo-record.mjs stage     back up the g2digest rows, save the
//                                     "before" brief (no Ocean science section yet, Name "My brief", 07:00)
//   node … brief       rec-1-brief: Name, Ready by, Add section (Ocean science), Save brief
//   node … agents      rec-2-agents: Build agents page
//   node … agent       the live agent run (pty) + rec-2-consent; saves agent-run.json (the terminal byte stream)
//   node … term        rec-2-terminal and rec-3-agent: agent-run.json replayed into xterm.js and screencast
//   node … edition     rec-3-edition: the edition and the G2 preview
//   node … pair        rec-4-pair: the code, Make a feed link
//   node … glasses     rec-4-phone + rec-4-glasses (simulator: phone webview and glasses), rec-5-ride
//   node … restore     every g2digest row and the audio back as they were before `stage`
//
// Needs (outside the repo, on the data disk): WORK below; the pty rig (node-pty, @xterm/xterm) in TERM;
// the agent's folder AGENT_DIR with its .mcp.json, CLAUDE.md, speak (Kokoro) and browser.sh (writes the
// OAuth URL Claude Code wants to open to opened-urls.txt, so the recorder opens it instead).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const REPO = resolve(".");
const OUT = `${REPO}/branding/promo-videos/public/g2digest-demo`;
const SCRATCH = "/Volumes/proj/scratch/heji-video";
const WORK = `${SCRATCH}/g2digest-demo-work`;
const TERM = `${SCRATCH}/term`;
const AGENT_DIR = `${SCRATCH}/g2digest-agent`;
mkdirSync(WORK, { recursive: true });
const site = "http://127.0.0.1:8790", supabase = "http://127.0.0.1:55421", sim = "http://127.0.0.1:9903";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const READER = "00000000-0000-4000-8000-0000000002d1";
const DB = "supabase_db_waypack"; // the shared local stack's Postgres container
const DEMO = `${REPO}/branding/promo-videos/scripts/g2digest-demo-sources`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], ...opts })?.toString() ?? "";
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });
const playwright = () => createRequire(`${REPO}/package.json`)("playwright");

const signIn = async () =>
  (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "reader@example.com", password: "g2digest-dev" }) })).json();
const api = async (tok, path, init = {}) => {
  for (let i = 0; ; i++) {
    const text = await (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).text();
    try { return JSON.parse(text); } catch { if (i >= 2) throw new Error(`${path}: ${text.slice(0, 120)}`); await sleep(500); }
  }
};

// ---------- stage / restore ---------------------------------------------------------------------------
async function stage() {
  const backup = join(WORK, "g2digest-backup.sql");
  if (!existsSync(backup)) writeFileSync(backup, sh("docker", ["exec", DB, "pg_dump", "-U", "postgres", "--data-only", "--schema=g2digest"]));
  const full = JSON.parse(readFileSync(join(DEMO, "brief.json"), "utf8"));
  // The "before" brief: the recording adds Ocean science, names the edition and moves Ready by.
  const before = { ...full, title: "My brief", delivery: { ...full.delivery, time: "07:00" }, sections: full.sections.filter((s) => s.id !== "ocean-science") };
  const tok = (await signIn()).access_token;
  const cur = await api(tok, "/api/brief");
  const saved = await api(tok, "/api/brief", { method: "PUT", body: JSON.stringify({ brief: before, expected_version: cur.brief_version }) });
  if (saved.error) throw new Error(`brief: ${JSON.stringify(saved)}`);
  console.log("before-brief saved, version", saved.brief_version);
}

async function restore() {
  const backup = join(WORK, "g2digest-backup.sql");
  if (!existsSync(backup)) throw new Error("no backup: run stage first");
  const storage = (path, init = {}) => fetch(`${supabase}/storage/v1${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" } });
  const dates = sql("select distinct date from g2digest.editions;").trim().split("\n").filter(Boolean);
  for (const d of dates) {
    const files = await (await storage(`/object/list/g2digest`, { method: "POST", body: JSON.stringify({ prefix: `${READER}/${d}`, limit: 1000 }) })).json();
    const prefixes = files.map((f) => `${READER}/${d}/${f.name}`);
    if (prefixes.length) await storage(`/object/g2digest`, { method: "DELETE", body: JSON.stringify({ prefixes }) });
  }
  const tables = sql(`select string_agg('g2digest.'||quote_ident(table_name), ', ') from information_schema.tables where table_schema='g2digest' and table_type='BASE TABLE';`).trim();
  sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: `begin; set session_replication_role = replica; truncate ${tables};\n${readFileSync(backup, "utf8")}\ncommit;` });
  console.log("restored the g2digest rows and removed the demo audio for", dates.join(", ") || "no editions");
}

// ---------- web recordings: CDP screencast → 30 fps MP4 + event log ---------------------------------------
const VW = 1280, VH = 720; // CSS viewport; recorded at 2×, encoded at 1920×1080, so 1 CSS px = 1.5 clip px
const pointerScript = `
  addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "#demo-cursor{position:fixed;z-index:99999;width:26px;height:26px;margin:-4px 0 0 -6px;pointer-events:none;transition:transform .12s}" +
      "#demo-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}";
    document.head.append(s);
    const c = document.createElement("div");
    c.id = "demo-cursor";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    c.style.left = (innerWidth * 0.6) + "px"; c.style.top = (innerHeight * 0.55) + "px";
    document.body.append(c);
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; });
    addEventListener("mousedown", () => { c.style.transform = "scale(.85)"; });
    addEventListener("mouseup", () => { c.style.transform = ""; });
  });`;

/** Records one clip. `script(page, start, mark)`: call start() when the clip begins; mark(step, locator|box, type, label) logs an action. */
async function record(name, script, { phone = false, session = null, url = null } = {}) {
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const vw = phone ? 390 : VW, vh = phone ? 844 : VH, dpr = phone ? 3 : 2;
  const outW = phone ? 1080 : 1920, scale = outW / vw;
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, colorScheme: "dark", isMobile: phone, hasTouch: phone });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site });
  if (session) await context.addInitScript((s) => localStorage.setItem("sb-127-auth-token", s), JSON.stringify(session));
  if (!phone) await context.addInitScript(pointerScript);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const dir = mkdtempSync(join(WORK, `rec-${name}-`));
  const frames = [], events = [];
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
  let t0 = 0;
  const start = async () => {
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: vw * dpr, maxHeight: vh * dpr, everyNthFrame: 1 });
    await sleep(300);
    recording = true;
    t0 = Date.now() / 1000;
    await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;background:rgba(0,0,0,.01)"; document.body.append(d); requestAnimationFrame(() => requestAnimationFrame(() => d.remove())); });
  };
  const mark = async (step, target, type, label) => {
    const b = target && typeof target.boundingBox === "function" ? await target.boundingBox() : target;
    const box = b ? { x: Math.round(b.x * scale), y: Math.round(b.y * scale), w: Math.round(b.width * scale), h: Math.round(b.height * scale) } : null;
    events.push({ step, t: +(Date.now() / 1000 - t0).toFixed(2), type, label, box, x: box ? box.x + box.w / 2 : null, y: box ? box.y + box.h / 2 : null });
  };
  if (url) await page.goto(url, { waitUntil: "networkidle" });
  await script(page, start, mark);
  await sleep(400);
  recording = false;
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await page.screenshot({ path: join(OUT, `still-${name}.png`) });
  await browser.close();
  if (errors.length) console.warn(`${name}: page errors`, errors);
  // Frame times are the browser's; events are wall-clock from start(): align on the first frame.
  const shift = frames[0].t - t0;
  for (const e of events) e.t = +(e.t - shift).toFixed(2);
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(join(dir, "list.txt"), list);
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", `scale=${outW}:-2:flags=lanczos,fps=30,format=yuv420p`, "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(OUT, `rec-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  const meta = { clip: `rec-${name}.mp4`, width: outW, height: Math.round((vh * scale) / 2) * 2, duration: +(end - frames[0].t).toFixed(2), events };
  writeFileSync(join(OUT, `rec-${name}.events.json`), JSON.stringify(meta, null, 1));
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${meta.duration} s, ${events.length} events`);
}
async function moveTo(page, locator, steps = 26) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 18), { steps });
  await sleep(220);
}
const scrollTo = (page, locator, offset = 140) => locator.evaluate((e, o) => window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - o, behavior: "smooth" }), offset);
const fieldIn = (scope, label, tag = "input") => scope.locator(`label.field:has(b:text-is("${label}")) ${tag}`).first();
const type = (page, text, delay = 34) => page.keyboard.type(text, { delay });

async function brief() {
  const session = await signIn();
  await record("1-brief", async (page, start, mark) => {
    await page.goto(`${site}/brief/`, { waitUntil: "networkidle" });
    await sleep(800);
    await start();
    await sleep(900);
    const name = fieldIn(page, "Name");
    await moveTo(page, name); await mark("1.1", name, "click", "Name"); await name.click({ clickCount: 3 });
    await type(page, "Morning brief"); await sleep(700);
    const ready = fieldIn(page, "Ready by");
    await scrollTo(page, ready, 200); await sleep(700);
    await moveTo(page, ready); await mark("1.2", ready, "click", "Ready by"); await ready.click();
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
    await type(page, "0630", 120); await sleep(800);
    const add = page.getByRole("button", { name: "Add section" });
    await scrollTo(page, add, 420); await sleep(900);
    await moveTo(page, add); await mark("1.3", add, "click", "Add section"); await add.click();
    await sleep(600);
    const card = page.locator(".section-card").last();
    await scrollTo(page, card, 90); await sleep(900);
    const title = fieldIn(card, "Title");
    await moveTo(page, title); await mark("1.3a", title, "type", "Title"); await title.click({ clickCount: 3 });
    await type(page, "Ocean science"); await sleep(300);
    const id = fieldIn(card, "Id");
    await id.click({ clickCount: 3 }); await type(page, "ocean-science", 18);
    const max = fieldIn(card, "Max cards");
    await max.click({ clickCount: 3 }); await type(page, "2", 40);
    const src = fieldIn(card, "Source", "select");
    await moveTo(page, src); await mark("1.3b", src, "select", "Source: rss"); await src.selectOption("rss");
    await sleep(500);
    const urls = fieldIn(card, "Feed URLs", "textarea");
    await moveTo(page, urls); await mark("1.3c", urls, "type", "Feed URLs"); await urls.click();
    await type(page, "http://127.0.0.1:8899/ocean.xml", 22); await sleep(400);
    const instr = fieldIn(card, "Instructions", "textarea");
    await moveTo(page, instr); await instr.click({ clickCount: 3 }); await page.keyboard.press("Meta+A"); await mark("1.3d", instr, "type", "Instructions");
    await type(page, "New results about the ocean with numbers behind them. Rank by how much they change what is possible, not by hype. Skip anything without data.", 16);
    await sleep(700);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(900);
    const save = page.getByRole("button", { name: "Save brief" });
    await moveTo(page, save); await mark("1.4", save, "click", "Save brief"); await save.click();
    await sleep(900);
    await mark("1.4a", page.getByText(/Saved · version/), "result", "Saved");
    await sleep(1800);
  }, { session });
}

async function agents() {
  const session = await signIn();
  await record("2-agents", async (page, start, mark) => {
    await page.goto(`${site}/agents/`, { waitUntil: "networkidle" });
    await sleep(700);
    await start();
    await sleep(800);
    await mark("2.1", page.locator("section.panel").nth(0), "look", "1. Connect");
    await sleep(2200);
    await mark("2.1a", page.locator("section.panel").nth(0).locator("code"), "look", "MCP server");
    await sleep(1800);
    const prompt = page.locator("section.panel").nth(1);
    await scrollTo(page, prompt, 80); await sleep(1000);
    const copy = prompt.getByRole("button", { name: "Copy" });
    await moveTo(page, copy); await mark("2.4", copy, "click", "Copy"); await copy.click();
    await sleep(1400);
    const sched = page.locator("section.panel").nth(2);
    await scrollTo(page, sched, 160); await sleep(900);
    await mark("2.4a", sched, "look", "3. Schedule it");
    await sleep(2400);
  }, { session });
}

// ---------- the live agent run (pty) ------------------------------------------------------------------------
async function agent() {
  const pty = createRequire(`${TERM}/package.json`)("node-pty");
  const { Terminal } = createRequire(`${TERM}/package.json`)("@xterm/headless");
  const COLS = 100, ROWS = 30;
  const term = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDE_CODE") && k !== "CLAUDECODE"));
  Object.assign(env, { BROWSER: `${AGENT_DIR}/browser.sh`, TERM: "xterm-256color", COLORTERM: "truecolor" });
  rmSync(`${AGENT_DIR}/opened-urls.txt`, { force: true });
  const t0 = Date.now();
  const chunks = [], marks = [];
  const p = pty.spawn("claude", ["--strict-mcp-config", "--mcp-config", ".mcp.json", "--model", "sonnet"], { name: "xterm-256color", cols: COLS, rows: ROWS, cwd: AGENT_DIR, env });
  let exited = false;
  p.onData((d) => { term.write(d); chunks.push([Date.now() - t0, d]); });
  p.onExit(() => (exited = true));
  const save = () => writeFileSync(join(OUT, "agent-run.json"), JSON.stringify({ cols: COLS, rows: ROWS, marks, chunks }));
  const screen = () => { const b = term.buffer.active; const out = []; for (let i = 0; i < ROWS; i++) out.push(b.getLine(b.viewportY + i)?.translateToString(true) ?? ""); return out.join("\n"); };
  const until = async (re, ms = 60_000) => { const end = Date.now() + ms; while (Date.now() < end) { if (re.test(screen())) return; await sleep(250); } throw new Error(`timed out waiting for ${re}\n${screen()}`); };
  const keys = async (k, wait = 600) => { p.write(k); await sleep(wait); };
  const mark = (name) => marks.push([Date.now() - t0, name]);
  try {
    await until(/Try "|❯ /, 30_000);
    await sleep(2500);
    mark("connect");
    for (const ch of "/mcp") await keys(ch, 140);
    await sleep(500); await keys("\r", 1500);
    await until(/g2digest.*needs authentication|needs authentication/);
    // Move to g2digest (the list puts it under the built-ins, order varies): down until it's selected.
    for (let i = 0; i < 6 && !/❯ ⚠ g2digest|❯ ✘ g2digest|❯ .*g2digest/.test(screen()); i++) await keys("\x1b[B", 400);
    await keys("\r", 1500);
    await until(/Authenticate/);
    mark("authenticate");
    await keys("\r", 1500);
    const t = Date.now();
    while (!existsSync(`${AGENT_DIR}/opened-urls.txt`) && Date.now() - t < 20_000) await sleep(250);
    const authUrl = readFileSync(`${AGENT_DIR}/opened-urls.txt`, "utf8").trim().split("\n").at(-1);
    mark("consent");
    const session = await signIn();
    await record("2-consent", async (page, start, mark2) => {
      await page.goto(authUrl, { waitUntil: "networkidle" });
      await sleep(600);
      await start();
      await sleep(900);
      await mark2("2.3", page.locator("ul").first(), "look", "What it may do");
      await sleep(2600);
      const allow = page.getByRole("button", { name: "Allow" });
      await scrollTo(page, allow, 420); await sleep(900);
      await moveTo(page, allow); await mark2("2.3a", allow, "click", "Allow"); await allow.click();
      await sleep(1500);
    }, { session });
    await until(/Authentication successful/, 30_000);
    mark("connected");
    await sleep(2500);
    await keys("\x1b", 800); // close the /mcp dialog if it's still open
    // The one prompt from the Build agents page, pasted (bracketed paste, as a real paste arrives).
    const prompt = readFileSync(`${REPO}/projects/g2digest/pipeline/build-prompt.md`, "utf8").trim();
    mark("prompt");
    await keys(`\x1b[200~${prompt}\x1b[201~`, 1200);
    await keys("\r", 2000);
    mark("run");
    // Done when an edition for today exists and the input box is idle for a while.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    let idle = 0, published = false;
    for (let i = 0; i < 60 * 60 * 2 && !exited; i++) {
      await sleep(1000);
      if (!published && sql(`select count(*) from g2digest.editions where date='${today}';`).trim() !== "0") { published = true; mark("published"); }
      const s = screen();
      if (/Do you want|❯ 1\. Yes/.test(s)) { console.log("permission prompt:\n" + s); await keys("\r", 800); mark("approved"); }
      idle = published && !/esc to interrupt/i.test(s) ? idle + 1 : 0;
      if (idle >= 15) break;
      if (i % 60 === 0) { save(); console.log(`${i}s`, s.split("\n").filter((l) => l.trim()).slice(-4).join(" | ")); }
    }
    mark("done");
    await sleep(1500);
  } finally {
    save();
    p.kill();
    console.log("agent-run.json:", chunks.length, "chunks, marks", JSON.stringify(marks));
    console.log(screen());
  }
}

// ---------- terminal replay: agent-run.json → xterm.js page → screencast ----------------------------------------
/** Replays [from, to] (ms of the run) of the pty stream; `speed(t)` gives the playback speed at run time t. */
async function replay(name, from, to, speed, extraTools = null) {
  const run = JSON.parse(readFileSync(join(OUT, "agent-run.json"), "utf8"));
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const css = readFileSync(`${TERM}/node_modules/@xterm/xterm/css/xterm.css`, "utf8");
  const js = readFileSync(`${TERM}/node_modules/@xterm/xterm/lib/xterm.js`, "utf8");
  await page.setContent(`<!doctype html><html><head><style>${css}
    html,body{margin:0;height:100%;background:#0b0f0c}#t{position:absolute;inset:18px 24px}</style></head>
    <body><div id="t"></div><script>${js}</script></body></html>`);
  await page.evaluate(({ cols, rows }) => {
    const t = new window.Terminal({ cols, rows, fontFamily: "JetBrains Mono, Menlo, monospace", fontSize: 20, lineHeight: 1.12, theme: { background: "#0b0f0c", foreground: "#e3f2e6" }, allowProposedApi: true });
    t.open(document.getElementById("t"));
    window.term = t;
  }, run);
  // Bring the screen to its state at `from` instantly.
  const before = run.chunks.filter(([t]) => t < from).map(([, d]) => d).join("");
  await page.evaluate((d) => new Promise((r) => window.term.write(d, r)), before);
  const items = run.chunks.filter(([t]) => t >= from && t <= to);
  // Playback schedule: clip time for each chunk.
  let clip = 0, last = from;
  const sched = items.map(([t, d]) => { clip += (t - last) / speed(t); last = t; return [clip, d, t]; });
  clip += (to - last) / speed(to);
  const cdp = await context.newCDPSession(page);
  const dir = mkdtempSync(join(WORK, `rec-${name}-`));
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: VW * 2, maxHeight: VH * 2, everyNthFrame: 1 });
  await sleep(300);
  const wall0 = Date.now();
  // Writes are batched per 33 ms of clip time so a time-lapse doesn't flood the page.
  for (let i = 0; i < sched.length;) {
    const due = sched[i][0];
    const wait = due - (Date.now() - wall0);
    if (wait > 0) await sleep(wait);
    let batch = "";
    while (i < sched.length && sched[i][0] <= Date.now() - wall0 + 33) batch += sched[i++][1];
    await page.evaluate((d) => new Promise((r) => window.term.write(d, r)), batch);
  }
  const remain = clip - (Date.now() - wall0);
  if (remain > 0) await sleep(remain);
  await sleep(200);
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await browser.close();
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(join(dir, "list.txt"), list);
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(OUT, `rec-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  // Map run time → clip time, for the edit's speed badge, clock and the tool-call events.
  const map = (rt) => { let c = 0, l = from; for (const [, , t] of sched) { if (t > rt) break; c += (t - l) / speed(t); l = t; } return +((c + (rt - l) / speed(rt)) / 1000).toFixed(2); };
  const tools = extraTools ? extraTools.filter(([t]) => t >= from && t <= to).map(([t, tool]) => ({ t: map(t), run_s: +(t / 1000).toFixed(1), tool })) : [];
  const toolRe = /g2digest - (\w+)|(get_card_authoring_guide|get_user_brief|create_audio_upload|validate_cards|publish_cards|get_last_cards)/;
  let acc = "";
  for (const [t, d] of run.chunks.filter(([t]) => t >= from && t <= to)) {
    acc = (acc + d).slice(-4000);
    const m = d.match(toolRe);
    if (m && !extraTools) tools.push({ t: map(t), run_s: +(t / 1000).toFixed(1), tool: m[1] || m[2] });
  }
  const meta = { clip: `rec-${name}.mp4`, width: 1920, height: 1080, duration: +(clip / 1000).toFixed(2), from_s: from / 1000, to_s: to / 1000,
    speed: [...new Set(items.map(([t]) => speed(t)))], marks: run.marks.filter(([t]) => t >= from && t <= to).map(([t, n]) => ({ t: map(t), run_s: +(t / 1000).toFixed(1), name: n })), tools };
  writeFileSync(join(OUT, `rec-${name}.events.json`), JSON.stringify(meta, null, 1));
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${meta.duration} s, ${tools.length} tool events`);
}

/** Tool calls from Claude Code's own transcript (exact names and times; the terminal collapses them), as [run ms, tool]. */
function transcriptTools(run) {
  const dir = `${process.env.HOME}/.claude/projects/${AGENT_DIR.replace(/[/.]/g, "-")}`;
  const files = sh("ls", ["-t", dir]).trim().split("\n").filter((f) => f.endsWith(".jsonl"));
  const lines = readFileSync(join(dir, files[0]), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const prompt = lines.find((d) => d.type === "user" && JSON.stringify(d.message?.content ?? "").includes("You build today"));
  const anchor = Date.parse(prompt.timestamp) - run.marks.find(([, n]) => n === "run")[0];
  const out = [];
  for (const d of lines) for (const x of Array.isArray(d.message?.content) ? d.message.content : [])
    if (x.type === "tool_use") out.push([Date.parse(d.timestamp) - anchor, x.name.replace(/^mcp__g2digest__/, "")]);
  return out;
}

async function termCmd() {
  const run = JSON.parse(readFileSync(join(OUT, "agent-run.json"), "utf8"));
  const at = (n) => run.marks.find(([, m]) => m === n)?.[0];
  const endT = run.chunks.at(-1)[0];
  const which = process.argv.slice(3);
  // Chapter 2: from the "needs authentication" screen through /mcp to Authenticate (the consent page is its own clip),
  // then "Authentication successful".
  if (!which.length || which.includes("connect")) await replay("2-terminal", Math.max(0, at("connect") - 1500), at("consent") + 1200, () => 1);
  if (!which.length || which.includes("connected")) await replay("2-connected", at("connected") - 300, at("connected") + 2200, () => 1);
  // Chapter 3: the paste and the first tool calls at 1×, the long middle as a time-lapse, the publish at 1×.
  const run0 = at("prompt") - 500, pub = at("published") ?? endT;
  const tx = transcriptTools(run);
  const val0 = tx.find(([, n]) => n === "validate_cards")?.[0] ?? pub - 9_000;
  // 1× for the paste and the first calls, a time-lapse for research and audio, 4× through the validator's
  // refusals, 1× from just before the publish.
  const fast = (t) => (t < run0 + 25_000 ? 1 : t < val0 - 2_000 ? Number(process.env.LAPSE || 24) : t < pub - 6_000 ? 4 : 1);
  if (!which.length || which.includes("run")) await replay("3-agent", run0, Math.min(endT, (at("done") ?? endT)), fast, tx);
}

// ---------- edition + pair (web) -----------------------------------------------------------------------------
async function edition() {
  const session = await signIn();
  const date = sql("select max(date) from g2digest.editions;").trim();
  await record("3-edition", async (page, start, mark) => {
    await page.goto(`${site}/preview/${date}`, { waitUntil: "networkidle" });
    await sleep(900);
    await page.mouse.move(900, 520);
    await start();
    await sleep(900);
    await mark("3.5", page.locator("section.panel").first(), "look", "On the glasses");
    const next = page.getByRole("button", { name: /Swipe up/ });
    for (let i = 0; i < 3; i++) { await moveTo(page, next, i ? 8 : 24); await mark(`3.5${"abc"[i]}`, next, "click", "Swipe up"); await next.click(); await sleep(1300); }
    await sleep(500);
  }, { session });
  await record("3-full", async (page, start, mark) => {
    await page.goto(`${site}/edition/${date}`, { waitUntil: "networkidle" });
    await sleep(900);
    await page.mouse.move(700, 420);
    await start();
    await sleep(1000);
    await mark("3.5d", page.locator("h2").first(), "look", "Sections + sources");
    await page.evaluate(() => window.scrollTo({ top: 420, behavior: "smooth" }));
    await sleep(2400);
  }, { session });
}

async function pair() {
  const session = await signIn();
  await record("4-pair", async (page, start, mark) => {
    await page.goto(`${site}/pair/`, { waitUntil: "networkidle" });
    await sleep(900);
    await page.mouse.move(800, 500);
    await start();
    await sleep(900);
    await mark("4.1", page.locator(".code"), "look", "Pairing code");
    writeFileSync(join(WORK, "pair-code.txt"), (await page.locator(".code").textContent()).trim());
    await sleep(2600);
    const feed = page.getByRole("button", { name: "Make a feed link" });
    await scrollTo(page, feed, 380); await sleep(1000);
    await moveTo(page, feed); await mark("4.4", feed, "click", "Make a feed link"); await feed.click();
    await sleep(1200);
    await mark("4.4a", page.locator(".secret").first(), "result", "Private feed URL");
    await sleep(2200);
  }, { session });
  console.log("pair code in the clip:", readFileSync(join(WORK, "pair-code.txt"), "utf8"));
}

// ---------- glasses + phone (Even Hub simulator) --------------------------------------------------------------------
const input = (action) => fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
/** Polls the simulator's glasses (alpha → HUD green, 1728×864) and optionally its phone webview, ~12 fps. */
async function recordSim(name, steps, { webview = false } = {}) {
  const dir = join(WORK, `frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const g = [], w = [], events = [];
  let on = true;
  const t0 = Date.now();
  const grab = (async () => {
    for (let i = 0; on; i++) {
      const t = Date.now();
      const f = join(dir, `g${String(i).padStart(4, "0")}.png`);
      writeFileSync(f, Buffer.from(await (await fetch(`${sim}/api/screenshot/glasses`)).arrayBuffer()));
      g.push([f, t]);
      if (webview && i % 2 === 0) {
        const fw = join(dir, `w${String(i).padStart(4, "0")}.png`);
        writeFileSync(fw, Buffer.from(await (await fetch(`${sim}/api/screenshot/webview`)).arrayBuffer()));
        w.push([fw, Date.now()]);
      }
      await sleep(Math.max(0, 80 - (Date.now() - t)));
    }
  })();
  for (const [action, ms, label] of steps) {
    if (typeof action === "function") { events.push({ step: label, t: +((Date.now() - t0) / 1000).toFixed(2), type: "phone", label }); await action(); }
    else if (action !== "wait") { events.push({ step: label ?? action, t: +((Date.now() - t0) / 1000).toFixed(2), type: action, label: label ?? action }); await input(action); }
    await sleep(ms);
  }
  on = false;
  await grab;
  const join30 = (frames, list, vf, out) => {
    let s = "";
    frames.forEach(([f, t], i) => (s += `file '${f}'\nduration ${((frames[i + 1]?.[1] ?? t + 80) - t) / 1000}\n`));
    writeFileSync(join(dir, list), s + `file '${frames.at(-1)[0]}'\n`);
    sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, list), "-vf", vf, "-c:v", "libx264", "-crf", "16", out]);
  };
  const shift = (g[0][1] - t0) / 1000;
  for (const e of events) e.t = +(e.t - shift).toFixed(2);
  join30(g, "g.txt", "format=rgba,alphaextract,scale=1728:864:flags=lanczos,format=rgb24,colorchannelmixer=rr=0.239:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bb=0.478,fps=30,format=yuv420p", join(OUT, `rec-${name}.mp4`));
  writeFileSync(join(OUT, `rec-${name}.events.json`), JSON.stringify({ clip: `rec-${name}.mp4`, width: 1728, height: 864, events }, null, 1));
  if (webview && w.length) join30(w, "w.txt", "scale=1080:-2:flags=lanczos,fps=30,format=yuv420p", join(OUT, `rec-${name}-phone.mp4`));
  console.log(`rec-${name}.mp4: ${g.length} glasses frames${webview ? `, ${w.length} phone frames` : ""}`);
}

const launchSim = async (url) => {
  const proc = spawn("npx", ["evenhub-simulator", url, "--automation-port", "9903", "--no-glow"], { stdio: "ignore" });
  for (let i = 0; i < 40 && !(await fetch(`${sim}/api/ping`).then((r) => r.ok, () => false)); i++) await sleep(500);
  return proc;
};
const stopSim = (proc) => { proc.kill(); try { sh("pkill", ["-f", "evenhub-simulator.*9903"]); } catch { /* gone */ } };

async function glasses() {
  const which = process.argv.slice(3);
  if (!which.length || which.includes("pair")) {
    // Before: unpaired, the phone page shows the code form and the glasses the tour. (Typing into the
    // simulator's webview needs macOS Accessibility for System Events, which this machine doesn't grant,
    // so the code isn't typed on camera: the edit cuts from the form to the paired state.)
    let p = await launchSim(`${site}/glasses/`);
    await sleep(7000);
    await recordSim("4-glasses-before", [["wait", 1200, "4.2"], ["up", 2200, "tour"], ["wait", 1200, "end"]], { webview: true });
    stopSim(p);
    await sleep(1500);
    // After: launched with the code the Pair clip shows (record `pair` right before this): it pairs and
    // the glasses leave the tour for the list of editions.
    const code = readFileSync(join(WORK, "pair-code.txt"), "utf8").trim();
    p = await launchSim(`${site}/glasses/?pair=${code}`);
    await recordSim("4-glasses", [["wait", 9000, "4.3"], ["wait", 2500, "end"]], { webview: true });
    if (!which.length || which.includes("ride")) await ride();
    stopSim(p);
    return;
  }
  if (which.includes("ride")) {
    // Needs a paired simulator: pair with a fresh code.
    const tok = (await signIn()).access_token;
    const code = (await api(tok, "/api/pairing-code", { method: "POST" })).code;
    const p = await launchSim(`${site}/glasses/?pair=${code}`);
    await sleep(10_000);
    await ride();
    stopSim(p);
  }
}
async function ride() {
  await recordSim("5-ride", [["wait", 1500, "5.1"], ["click", 3000, "5.1a"], ["up", 1300, "5.2"], ["up", 1300, "5.2a"], ["up", 1300, "5.2b"], ["up", 2200, "5.2c"], ["click", 3500, "5.3"],
    ["long_press", 250, "5.3a"], ["long_press_release", 5000, "5.3b"], ["double_click", 1800, "5.4"], ["double_click", 2500, "5.4a"]]);
}

const cmd = process.argv[2];
const run = { stage, restore, brief, agents, agent, term: termCmd, edition, pair, glasses }[cmd];
if (!run) {
  console.error("usage: g2digest-demo-record.mjs stage | brief | agents | agent | term [connect|connected|run] | edition | pair | glasses [pair|ride] | restore");
  process.exit(1);
}
await run();
