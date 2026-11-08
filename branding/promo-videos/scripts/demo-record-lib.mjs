// Shared recording pieces for the demo walkthroughs (skill heji-demo-video), lifted from
// g2digest-demo-record.mjs: a web page screencast with a fake cursor, a REAL agent run (Claude Code in a pty,
// its byte stream saved with times), that stream replayed into xterm.js and screencast at any speed, the
// agent's tool calls from its own transcript, and the Even Hub simulator's glasses (and phone page) captured
// while R1 gestures are sent. Every recording writes rec-<name>.mp4 + rec-<name>.events.json: each action's
// time in the clip and its target's box in the clip's pixels, which aim the edit's camera, spotlight and labels.
// Needs, outside the repo on the data disk: the pty rig (node-pty, @xterm/headless, @xterm/xterm) in TERM.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

export const REPO = resolve(".");
export const SCRATCH = "/Volumes/proj/scratch/heji-video";
export const TERM = `${SCRATCH}/term`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], maxBuffer: 1 << 28, ...opts })?.toString() ?? "";
const playwright = () => createRequire(`${REPO}/package.json`)("playwright");

const frameList = (frames, end) =>
  frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;

// ---------- web: CDP screencast → 30 fps MP4 + event log -----------------------------------------------------------
export const VW = 1280, VH = 720; // CSS viewport; recorded at 2×, encoded at 1920×1080 (1 CSS px = 1.5 clip px)
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

/**
 * Records one web clip. `script(page, start, mark)`: call start() when the clip begins; mark(step, locator|box,
 * type, label) logs an action. `session` is put in localStorage under `storageKey` before the page loads.
 */
export async function recordWeb({ name, out, work, script, url = null, session = null, storageKey = "sb-127-auth-token", origin = null, colorScheme = "dark", phone = false }) {
  const { chromium } = playwright();
  const browser = await chromium.launch();
  // phone: a 390×844 page at 3× (a phone's browser without its chrome), encoded 1170 px wide.
  const vw = phone ? 390 : VW, vh = phone ? 844 : VH, dpr = phone ? 3 : 2;
  const outW = phone ? 1170 : 1920, scale = outW / vw;
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, colorScheme, isMobile: phone, hasTouch: phone });
  if (origin) await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  if (session) await context.addInitScript(([k, s]) => localStorage.setItem(k, s), [storageKey, JSON.stringify(session)]);
  if (!phone) await context.addInitScript(pointerScript);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  mkdirSync(work, { recursive: true });
  const dir = mkdtempSync(join(work, `rec-${name}-`));
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
    // Force a first frame even on a still page.
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
  await page.screenshot({ path: join(out, `still-${name}.png`) });
  await browser.close();
  if (errors.length) console.warn(`${name}: page errors`, errors);
  // Frame times are the browser's; events are wall-clock from start(): align on the first frame.
  const shift = frames[0].t - t0;
  for (const e of events) e.t = +(e.t - shift).toFixed(2);
  writeFileSync(join(dir, "list.txt"), frameList(frames, end));
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", `scale=${outW}:-2:flags=lanczos,fps=30,format=yuv420p`, "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(out, `rec-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  const meta = { clip: `rec-${name}.mp4`, width: outW, height: Math.round((vh * scale) / 2) * 2, duration: +(end - frames[0].t).toFixed(2), events };
  writeFileSync(join(out, `rec-${name}.events.json`), JSON.stringify(meta, null, 1));
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${meta.duration} s, ${events.length} events`);
  return meta;
}
export async function moveTo(page, locator, steps = 26) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + Math.min(box.width / 2, 60), box.y + Math.min(box.height / 2, 18), { steps });
  await sleep(220);
}
export const scrollTo = (page, locator, offset = 140) => locator.evaluate((e, o) => window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - o, behavior: "smooth" }), offset);

// ---------- a real agent run in a pty ---------------------------------------------------------------------------------
/**
 * Runs Claude Code in `dir` (its .mcp.json names only the product's server) and drives it with keystrokes.
 * `steps(api)` gets { until, keys, mark, screen, paste }. The byte stream with times goes to `file` as
 * { cols, rows, marks: [[ms, name]], chunks: [[ms, data]] }. Clean env: no CLAUDE_CODE_* from this session;
 * BROWSER is dir/browser.sh, which appends the URL Claude Code wants to open to dir/opened-urls.txt.
 */
export async function runAgent({ dir, file, steps, model = "sonnet", cols = 100, rows = 30 }) {
  const pty = createRequire(`${TERM}/package.json`)("node-pty");
  const { Terminal } = createRequire(`${TERM}/package.json`)("@xterm/headless");
  const term = new Terminal({ cols, rows, allowProposedApi: true });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CLAUDE_CODE") && k !== "CLAUDECODE"));
  Object.assign(env, { BROWSER: `${dir}/browser.sh`, TERM: "xterm-256color", COLORTERM: "truecolor" });
  rmSync(`${dir}/opened-urls.txt`, { force: true });
  const t0 = Date.now();
  const chunks = [], marks = [];
  const p = pty.spawn("claude", ["--strict-mcp-config", "--mcp-config", ".mcp.json", "--model", model], { name: "xterm-256color", cols, rows, cwd: dir, env });
  let exited = false;
  p.onData((d) => { term.write(d); chunks.push([Date.now() - t0, d]); });
  p.onExit(() => (exited = true));
  const save = () => writeFileSync(file, JSON.stringify({ cols, rows, marks, chunks }));
  const screen = () => { const b = term.buffer.active; const o = []; for (let i = 0; i < rows; i++) o.push(b.getLine(b.viewportY + i)?.translateToString(true) ?? ""); return o.join("\n"); };
  const until = async (re, ms = 60_000) => { const end = Date.now() + ms; while (Date.now() < end) { if (re.test(screen())) return; await sleep(250); } throw new Error(`timed out waiting for ${re}\n${screen()}`); };
  const keys = async (k, wait = 600) => { p.write(k); await sleep(wait); };
  const typeOut = async (text, delay = 45) => { for (const ch of text) await keys(ch, delay + Math.random() * 30); };
  const paste = async (text, wait = 1200) => keys(`\x1b[200~${text}\x1b[201~`, wait);
  const mark = (name) => marks.push([Date.now() - t0, name]);
  // The live screen, for watching a run from outside (cat <file>.screen.txt).
  const peek = setInterval(() => writeFileSync(`${file}.screen.txt`, `${((Date.now() - t0) / 1000).toFixed(0)} s, marks ${marks.map(([, n]) => n).join(" ")}\n${screen()}\n`), 2000);
  // A person answering the agent mid-run (its questions differ each run): text appended to <file>.keys is
  // typed into the pty (\r = Enter, \x1b[B = down, \t = tab); "{type:…}" types it at a human pace.
  const keysFile = `${file}.keys`;
  writeFileSync(keysFile, "");
  let keysAt = 0, typing = false;
  const human = setInterval(async () => {
    if (typing) return;
    const all = readFileSync(keysFile, "utf8");
    if (all.length <= keysAt) return;
    const add = all.slice(keysAt); keysAt = all.length; typing = true;
    for (const part of add.split(/(\{type:[^}]*\})/)) {
      const m = part.match(/^\{type:([^}]*)\}$/);
      if (m) { for (const ch of m[1]) { p.write(ch); await sleep(45 + Math.random() * 30); } }
      else if (part) { p.write(part.replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\x1b/g, "\x1b")); await sleep(500); }
    }
    typing = false;
  }, 300);
  try {
    await until(/Try "|❯ |trust this folder/i, 40_000);
    await sleep(1500);
    // First run in a folder: Claude Code asks whether to trust it (the default is "No, exit").
    if (/trust this folder/i.test(screen())) {
      for (let i = 0; i < 3 && !/❯ Yes, I trust/.test(screen()); i++) await keys("\x1b[B", 500);
      await keys("\r", 2500);
    }
    await until(/Try "|\? for shortcuts|❯ $/m, 40_000);
    await sleep(2000);
    await steps({ until, keys, typeOut, paste, mark, screen, exited: () => exited, save });
  } finally {
    clearInterval(peek); clearInterval(human);
    save();
    p.kill();
    console.log(`${file}: ${chunks.length} chunks, marks ${JSON.stringify(marks)}`);
    console.log(screen());
  }
}

/** Tool calls from Claude Code's own transcript (exact names and times; the terminal collapses them), as [run ms, tool, input]. */
export function transcriptTools(agentDir, run, { needle, anchorMark = "run", prefix = /^mcp__\w+__/ }) {
  const dir = `${process.env.HOME}/.claude/projects/${agentDir.replace(/[/.]/g, "-")}`;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => [f, Number(sh("stat", ["-f", "%m", join(dir, f)]))]).sort((a, b) => b[1] - a[1]);
  for (const [f] of files) {
    const lines = readFileSync(join(dir, f), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const prompt = lines.find((d) => d.type === "user" && JSON.stringify(d.message?.content ?? "").includes(needle));
    if (!prompt) continue;
    const anchor = Date.parse(prompt.timestamp) - run.marks.find(([, n]) => n === anchorMark)[0];
    const out = [];
    for (const d of lines) for (const x of Array.isArray(d.message?.content) ? d.message.content : [])
      if (x.type === "tool_use" && Date.parse(d.timestamp) >= Date.parse(prompt.timestamp)) out.push([Date.parse(d.timestamp) - anchor, x.name.replace(prefix, ""), x.input]);
    // Tool results: whether a call failed (validate_plan's errors show up as text).
    const results = new Map();
    for (const d of lines) for (const x of Array.isArray(d.message?.content) ? d.message.content : [])
      if (x.type === "tool_result") results.set(x.tool_use_id, x);
    return out;
  }
  throw new Error(`no transcript with "${needle}" in ${dir}`);
}

// ---------- terminal replay: run.json → xterm.js page → screencast ------------------------------------------------------
/** Replays [from, to] (ms of the run) of the pty stream; `speed(t)` gives the playback speed at run time t. */
export async function replayTerm({ name, out, work, runFile, from, to, speed = () => 1, tools = [] }) {
  const run = JSON.parse(readFileSync(runFile, "utf8"));
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
  const before = run.chunks.filter(([t]) => t < from).map(([, d]) => d).join("");
  await page.evaluate((d) => new Promise((r) => window.term.write(d, r)), before);
  const items = run.chunks.filter(([t]) => t >= from && t <= to);
  let clip = 0, last = from;
  const sched = items.map(([t, d]) => { clip += (t - last) / speed(t); last = t; return [clip, d, t]; });
  clip += (to - last) / speed(to);
  const cdp = await context.newCDPSession(page);
  mkdirSync(work, { recursive: true });
  const dir = mkdtempSync(join(work, `rec-${name}-`));
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: VW * 2, maxHeight: VH * 2, everyNthFrame: 1 });
  await sleep(300);
  await page.evaluate(() => window.term.write(" \b"));
  const wall0 = Date.now();
  for (let i = 0; i < sched.length;) {
    const wait = sched[i][0] - (Date.now() - wall0);
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
  writeFileSync(join(dir, "list.txt"), frameList(frames, end));
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(out, `rec-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  // Run time → clip time, for the edit's speed badge, clock and the tool-call ticker.
  const map = (rt) => { let c = 0, l = from; for (const [, , t] of sched) { if (t > rt) break; c += (t - l) / speed(t); l = t; } return +((c + (rt - l) / speed(rt)) / 1000).toFixed(2); };
  const meta = {
    clip: `rec-${name}.mp4`, width: 1920, height: 1080, duration: +(clip / 1000).toFixed(2), from_s: from / 1000, to_s: to / 1000,
    marks: run.marks.filter(([t]) => t >= from && t <= to).map(([t, n]) => ({ t: map(t), run_s: +(t / 1000).toFixed(1), name: n })),
    tools: tools.filter(([t]) => t >= from && t <= to).map(([t, tool, extra]) => ({ t: map(t), run_s: +(t / 1000).toFixed(1), tool, ...(extra ?? {}) })),
    events: [],
  };
  writeFileSync(join(out, `rec-${name}.events.json`), JSON.stringify(meta, null, 1));
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${meta.duration} s, ${meta.tools.length} tool events`);
  return meta;
}

// ---------- Even Hub simulator: glasses (+ its phone page) while R1 gestures are sent ------------------------------------
export const simInput = async (sim, action) => fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
export async function launchEvenSim({ url, port, cwd }) {
  const sim = `http://127.0.0.1:${port}`;
  const proc = spawn("npx", ["evenhub-simulator", url, "--automation-port", String(port), "--no-glow"], { cwd, stdio: "ignore" });
  for (let i = 0; i < 60 && !(await fetch(`${sim}/api/ping`).then((r) => r.ok, () => false)); i++) await sleep(500);
  return { sim, stop: () => { proc.kill(); try { sh("pkill", ["-f", `evenhub-simulator.*${port}`]); } catch { /* gone */ } } };
}
/**
 * steps: [action | fn | "wait", ms after, label?]. Actions: up, down, click, double_click, long_press. Glasses
 * frames are RGBA with the light in alpha: composited G2-green on black at 1728×864.
 */
export async function recordGlasses({ sim, name, out, work, steps, webview = false }) {
  const dir = join(work, `frames-${name}`);
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
      g.push({ file: f, t: t / 1000 });
      if (webview && i % 2 === 0) {
        const fw = join(dir, `w${String(i).padStart(4, "0")}.png`);
        writeFileSync(fw, Buffer.from(await (await fetch(`${sim}/api/screenshot/webview`)).arrayBuffer()));
        w.push({ file: fw, t: Date.now() / 1000 });
      }
      await sleep(Math.max(0, 80 - (Date.now() - t)));
    }
  })();
  for (const [action, ms, label] of steps) {
    const t = +((Date.now() - t0) / 1000).toFixed(2);
    if (typeof action === "function") { events.push({ step: label, t, type: "phone", label }); await action(); }
    else if (action !== "wait") { events.push({ step: label ?? action, t, type: action, label: label ?? action }); await simInput(sim, action); }
    await sleep(ms);
  }
  on = false;
  await grab;
  const end = Date.now() / 1000;
  const shift = g[0].t - t0 / 1000;
  for (const e of events) e.t = +(e.t - shift).toFixed(2);
  const join30 = (frames, list, vf, file) => {
    writeFileSync(join(dir, list), frameList(frames, end));
    sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, list), "-vf", vf, "-c:v", "libx264", "-crf", "16", file]);
  };
  join30(g, "g.txt", "format=rgba,alphaextract,scale=1728:864:flags=lanczos,format=rgb24,colorchannelmixer=rr=0.239:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bb=0.478,fps=30,format=yuv420p", join(out, `rec-${name}.mp4`));
  const meta = { clip: `rec-${name}.mp4`, width: 1728, height: 864, duration: +(end - g[0].t).toFixed(2), events };
  writeFileSync(join(out, `rec-${name}.events.json`), JSON.stringify(meta, null, 1));
  if (webview && w.length) join30(w, "w.txt", "scale=1080:-2:flags=lanczos,fps=30,format=yuv420p", join(out, `rec-${name}-phone.mp4`));
  rmSync(dir, { recursive: true, force: true });
  console.log(`rec-${name}.mp4: ${g.length} glasses frames${webview ? `, ${w.length} phone frames` : ""}, ${meta.duration} s`);
  return meta;
}
/** One glasses frame as a G2-green PNG (for stills and thumbnails). */
export async function glassesStill(sim, file) {
  const tmp = `${file}.rgba.png`;
  writeFileSync(tmp, Buffer.from(await (await fetch(`${sim}/api/screenshot/glasses`)).arrayBuffer()));
  sh("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-vf", "format=rgba,alphaextract,scale=1728:864:flags=lanczos,format=rgb24,colorchannelmixer=rr=0.239:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bb=0.478", file]);
  rmSync(tmp);
}
