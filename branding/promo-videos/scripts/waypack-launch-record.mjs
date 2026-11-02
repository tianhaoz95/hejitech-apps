// Screen recordings for the waypack-launch promo: the real Flutter app in the iPhone simulator,
// on the local stack with the seeded example trip, plus the live preview filling in (Playwright).
//
//   (cd <repo> && supabase start)                                   # shared local stack
//   (cd projects/waypack/services/mcp && npx wrangler dev --var MAP_EXTRACTS:device)
//   node projects/waypack/services/mcp/scripts/seed-dev.mjs promo@waypack.test
//   node branding/promo-videos/scripts/waypack-launch-record.mjs <simulator-udid> [phone|web|all]
//
// Phone: copies waypack-launch-driver/promo_test.dart into apps/mobile/integration_test/, runs it
// with DEV_SIGN_IN and FAKE_NOW (Christmas morning, 10:05, so Today says "Sledding & snow play"),
// records the simulator with `simctl io recordVideo`, and cuts the beats the test marks
// (BEAT:<name>:start|end) into public/waypack-launch/rec-phone-<name>.mp4 (30 fps). HOST:<cmd>
// lines switch the status bar (Wi-Fi at home, zero bars in the mountains). The map's GPS dot is a
// simulated position moving along the trip's day-2 route, fed to the map page by the driver (the
// simulator's location prompt can't be answered from a test).
// Web: pushes the example trip one day at a time with push_preview (as an agent does) while a
// desktop browser shows the preview, and records it with CDP screencast → rec-web-preview.mp4.
import { spawn, execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const repo = join(here, "../../..");
const app = join(repo, "projects/waypack/apps/mobile");
const out = join(here, "../public/waypack-launch");
const BASE = process.env.WAYPACK_URL ?? "http://127.0.0.1:8787";
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) throw new Error("recordings run on the local stack only");
const [udid, what = "all"] = process.argv.slice(2);
if (!udid) throw new Error("usage: waypack-launch-record.mjs <simulator-udid> [phone|web|all]");
const tmp = join(out, ".rec");
mkdirSync(tmp, { recursive: true });
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = JSON.parse(readFileSync(join(repo, "projects/waypack/examples/sequoia-winter/manifest.json"), "utf8"));

async function phone() {
  try { sh("xcrun", ["simctl", "boot", udid]); } catch { /* already booted */ }
  sh("xcrun", ["simctl", "bootstatus", udid]);
  sh("xcrun", ["simctl", "ui", udid, "appearance", "light"]);
  const bar = (online) =>
    sh("xcrun", ["simctl", "status_bar", udid, "override", "--time", online ? "8:41" : "10:05", "--batteryState", "discharging", "--batteryLevel", online ? "100" : "78",
      ...(online
        ? ["--dataNetwork", "wifi", "--wifiMode", "active", "--wifiBars", "3", "--cellularMode", "active", "--cellularBars", "4"]
        : ["--dataNetwork", "hide", "--wifiMode", "failed", "--wifiBars", "0", "--cellularMode", "searching", "--cellularBars", "0"])]);
  bar(true);

  const test = join(app, "integration_test/promo_test.dart");
  copyFileSync(join(here, "waypack-launch-driver/promo_test.dart"), test);
  const raw = join(tmp, "phone.mov");
  rmSync(raw, { force: true });
  const rec = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec=h264", "--force", raw], { stdio: ["ignore", "pipe", "pipe"] });
  let t0 = 0;
  rec.stderr.on("data", (d) => { if (!t0 && /Recording started/.test(String(d))) t0 = Date.now(); });
  rec.stdout.on("data", (d) => { if (!t0 && /Recording started/.test(String(d))) t0 = Date.now(); });
  await sleep(1500);
  if (!t0) t0 = Date.now();
  const marks = {};
  const args = ["test", "integration_test/promo_test.dart", "-d", udid, "--dart-define=NO_PERMISSION_PROMPTS=true", "--dart-define=DEV_SIGN_IN=true",
    "--dart-define=TEST_EMAIL=promo@waypack.test", "--dart-define=FAKE_NOW=2026-12-25T10:05:00-08:00"];
  const p = spawn("flutter", args, { cwd: app });
  const log = [];
  let buf = "";
  p.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      log.push(line);
      const beat = line.match(/BEAT:(\w+):(start|end)/);
      const host = line.match(/HOST:(\w+)/);
      if (beat) {
        (marks[beat[1]] ??= {})[beat[2]] = (Date.now() - t0) / 1000;
        console.log(`${beat[1]} ${beat[2]} @ ${marks[beat[1]][beat[2]].toFixed(1)} s`);
      } else if (host) {
        const c = host[1];
        if (c === "online") bar(true);
        if (c === "offline") bar(false);
      } else if (/passed|failed|Error|EXCEPTION/.test(line)) console.log(line.trim());
    }
  });
  p.stderr.on("data", (d) => log.push(String(d)));
  const code = await new Promise((r) => p.on("exit", r));
  rec.kill("SIGINT");
  await new Promise((r) => rec.on("exit", r));
  rmSync(test, { force: true });
  writeFileSync(join(tmp, "phone.log"), log.join("\n"));
  writeFileSync(join(tmp, "phone-marks.json"), JSON.stringify(marks, null, 2));
  sh("xcrun", ["simctl", "status_bar", udid, "clear"]);
  if (code !== 0) throw new Error(`flutter test failed (${code}), see ${join(tmp, "phone.log")}`);
  for (const [name, m] of Object.entries(marks)) {
    if (m.start == null || m.end == null) continue;
    sh("ffmpeg", ["-v", "error", "-y", "-ss", String(m.start), "-to", String(m.end), "-i", raw, "-vf", "fps=30,scale=1206:-2", "-an", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, `rec-phone-${name}.mp4`)]);
    console.log(`rec-phone-${name}.mp4 (${(m.end - m.start).toFixed(1)} s)`);
  }
}

async function web() {
  const { chromium } = await import(join(repo, "node_modules/playwright/index.mjs"));
  const signin = await fetch(`${BASE}/api/auth/dev`, { method: "POST", headers: { "Content-Type": "application/json", "X-Waypack": "1" }, body: JSON.stringify({ email: "promo-preview@waypack.test" }) });
  const sess = await signin.json();
  const pat = (await (await fetch(`${BASE}/api/tokens`, { method: "POST", headers: { Authorization: `Bearer ${sess.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ label: "promo" }) })).json()).token;
  let id = 0;
  const call = async (name, args) => (await (await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
  })).json()).result;
  const dir = join(repo, "projects/waypack/examples/sequoia-winter");
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  const files = walk(dir).map((p) => ({ path: relative(dir, p), content: readFileSync(p, "utf8") }));
  const withDays = (n) => JSON.stringify({ ...manifest, days: manifest.days.slice(0, n) }, null, 2);
  const first = await call("push_preview", { files: files.map((f) => (f.path === "manifest.json" ? { ...f, content: withDays(1) } : f)) });
  const { preview_id, preview_url } = first.structuredContent;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await page.goto(`${preview_url}#plan`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(4000);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: Date.now(), data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await page.evaluate(() => { document.body.style.outline = "0 solid transparent"; requestAnimationFrame(() => (document.body.style.outline = "")); });
  await page.waitForTimeout(1800);
  for (const n of [2, 3]) {
    const nav = page.waitForNavigation({ timeout: 20000 });
    await call("push_preview", { preview_id, files: [{ path: "manifest.json", content: withDays(n) }], note: `Added day ${n}` });
    await nav;
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    await page.waitForTimeout(1200); // the page restores the reader's place first
    // Bring the day that just arrived into view, the way a reader would scroll to it.
    await page.evaluate((n) => new Promise((done) => {
      const day = document.querySelectorAll("#tab-plan section.day")[n - 1];
      const from = scrollY, to = scrollY + day.getBoundingClientRect().top - 60, t0 = performance.now(), ms = 1100;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        scrollTo(0, from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    }), n);
    await page.waitForTimeout(2400);
  }
  await cdp.send("Page.stopScreencast");
  await browser.close();
  const fdir = join(tmp, "web");
  rmSync(fdir, { recursive: true, force: true });
  mkdirSync(fdir);
  const lines = [];
  frames.forEach((f, i) => {
    const file = join(fdir, `${String(i).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.t ?? f.t + 400;
    lines.push(`file '${file}'`, `duration ${((next - f.t) / 1000).toFixed(3)}`);
  });
  lines.push(`file '${join(fdir, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
  writeFileSync(join(fdir, "list.txt"), lines.join("\n"));
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(fdir, "list.txt"), "-vf", "fps=30,scale=1920:-2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, "rec-web-preview.mp4")]);
  console.log(`preview ${preview_url}`);
  console.log(`rec-web-preview.mp4 (${frames.length} frames)`);
}

if (what === "phone" || what === "all") await phone();
if (what === "web" || what === "all") await web();
