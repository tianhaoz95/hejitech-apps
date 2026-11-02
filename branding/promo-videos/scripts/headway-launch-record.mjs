#!/usr/bin/env node
// Screen recordings for the headway-launch promo, from the LOCAL stack only (never production):
// the seed rider (rider@example.com) with a demo morning, SF → Palo Alto, the first train on time and
// the next one 4 min late. Run from the repo root:
//
//   supabase start; npm run dev:worker -w @headway/web           (Worker on 127.0.0.1:8792)
//   node branding/promo-videos/scripts/headway-launch-record.mjs stage    demo commute + live snapshot
//   node … glasses    rec-glasses-board.mp4, rec-glasses-swipe.mp4 (starts the plugin + Even Hub simulator)
//   node … phone      rec-phone-leave.mp4, rec-phone-stop.mp4 (booted iPhone simulator, Headway installed)
//   node … restore    the seed rider's settings back
//
// The phone part needs notifications allowed for Headway on the simulator, which only a tap can do:
// launch with `-autoSignIn -screen settings`, tap "Turn on alerts", then "Allow" (a throwaway
// XCUITest did it for the first run). It is a simulator because simctl can push and record; the
// banners are the app's real notification texts (packages/core/src/alerts.ts) sent by `simctl push`.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/headway-launch";
const WORK = join(tmpdir(), "headway-launch-record");
mkdirSync(WORK, { recursive: true });
const site = "http://127.0.0.1:8792", supabase = "http://127.0.0.1:55421", sim = "http://127.0.0.1:9899";
// The local stack's well-known demo keys (supabase-demo issuer), as in projects/headway/scripts/test-api.mjs.
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], ...opts }).toString();

const token = async () =>
  (await (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "rider@example.com", password: "headway-dev" }) })).json()).access_token;
const api = async (tok, path, init = {}) => (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).json();

/** The demo commute, and a realtime snapshot (what the cron stores) that makes the board live. Boards
 * show SCHED once the snapshot is 10 min old, so stage again before each recording. */
async function stage() {
  const tok = await token();
  const saved = join(WORK, "seed-settings.json");
  const cur = (await api(tok, "/api/settings")).settings;
  if (!existsSync(saved)) writeFileSync(saved, JSON.stringify({ settings: cur }));
  const leg = (from, to, window) => ({ ...cur.morning, from, to, walk_minutes: 6, usual: null, window });
  const settings = { ...cur, morning: leg("san_francisco", "palo_alto", { start: "06:00", end: "12:00" }), evening: leg("palo_alto", "san_francisco", { start: "15:30", end: "20:00" }), switch_at: "14:00", days: [0, 1, 2, 3, 4, 5, 6] };
  if (!(await api(tok, "/api/settings", { method: "PUT", body: JSON.stringify({ settings }) })).settings) throw new Error("settings rejected");
  const [a, b] = (await (await fetch(`${site}/api/board?from=san_francisco&to=palo_alto`)).json()).trains;
  const southbound = JSON.parse(readFileSync("projects/headway/packages/core/src/timetable.gen.json", "utf8")).stations.map((s) => s.sb);
  const delays = (sec) => Object.fromEntries(southbound.map((id) => [id, { delay: sec }]));
  const now = Date.now();
  const snapshot = { fetched_at: now, feed_ts: Math.floor(now / 1000), alerts: [], trips: { [a.trip_id]: { start_date: a.service_date, stops: delays(0) }, [b.trip_id]: { start_date: b.service_date, stops: delays(240) } } };
  const r = await fetch(`${supabase}/rest/v1/realtime?on_conflict=id`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Content-Profile": "headway", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: 1, fetched_at: new Date(now).toISOString(), snapshot, error: null }) });
  if (!r.ok) throw new Error(`snapshot: ${r.status}`);
  await sleep(21_000); // Worker isolates cache the snapshot for 20 s
  console.log(`staged: ${a.train} on time, ${b.train} 4 min late`);
}

async function restore() {
  const tok = await token();
  const r = await api(tok, "/api/settings", { method: "PUT", body: readFileSync(join(WORK, "seed-settings.json"), "utf8") });
  console.log("restored", r.settings?.morning?.from, "→", r.settings?.morning?.to);
}

/** Polls the simulator's screenshot API (~12 fps; alpha = the lit pixels) while sending R1 gestures,
 * then joins the frames into a HUD-green-on-black 1728×864 MP4. */
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
    if (action !== "wait") await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    await sleep(ms);
  }
  on = false;
  await grab;
  let list = "";
  frames.forEach(([f, t], i) => (list += `file '${f}'\nduration ${((frames[i + 1]?.[1] ?? t + 80) - t) / 1000}\n`));
  writeFileSync(join(dir, "list.txt"), list + `file '${frames.at(-1)[0]}'\n`);
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf",
    "format=rgba,alphaextract,scale=1728:864:flags=lanczos,format=rgb24,colorchannelmixer=rr=0.239:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bg=0:bb=0.478,fps=30,format=yuv420p",
    "-c:v", "libx264", "-crf", "16", join(OUT, `rec-${name}.mp4`)]);
  console.log(`rec-${name}.mp4: ${frames.length} frames`);
}

async function glasses() {
  await stage();
  const tok = await token();
  const code = (await api(tok, "/api/pairing-code", { method: "POST" })).code;
  const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5176"], { cwd: "projects/headway/apps/glasses", stdio: "ignore" });
  await sleep(4000);
  const simProc = spawn("npx", ["evenhub-simulator", `http://127.0.0.1:5176/?api=${site}&pair=${code}`, "--automation-port", "9899", "--no-glow"], { cwd: "projects/headway/apps/glasses", stdio: "ignore" });
  try {
    for (let i = 0; i < 30 && !(await fetch(`${sim}/api/ping`).then((r) => r.ok, () => false)); i++) await sleep(1000);
    await sleep(10_000); // pairing and the first board
    await recordGlasses("glasses-board", [["wait", 4500]]);
    await recordGlasses("glasses-swipe", [["wait", 900], ["down", 1100], ["down", 1100], ["down", 1100], ["up", 1200]]);
  } finally {
    simProc.kill();
    vite.kill();
  }
}

/** The app on the booted simulator, a notification pushed while recording. */
async function phone() {
  const dev = "booted", app = "com.hejitech.headway";
  const push = (title, body, kind) => {
    const f = join(WORK, `push-${kind}.json`);
    writeFileSync(f, JSON.stringify({ "Simulator Target Bundle": app, aps: { alert: { title, body }, sound: "default", "thread-id": `promo:${kind}`, "interruption-level": "time-sensitive" }, kind }));
    return f;
  };
  const shots = [
    // Texts as alerts.ts writes them for the staged trains (618: 11:55 from SF, 12:46 at Palo Alto).
    { name: "phone-leave", screen: "trains", time: null, push: push("Leave now for the 11:55", "Local 618 leaves San Francisco 11:55; 6 min walk. San Francisco → Palo Alto.", "leave_now") },
    { name: "phone-stop", screen: "commute", time: "12:41", push: push("Palo Alto in 5 min", "Local 618 arrives Palo Alto 12:46. Time to get ready.", "arrival") },
  ];
  sh("xcrun", ["simctl", "ui", dev, "appearance", "dark"]);
  for (const s of shots) {
    await stage();
    const clock = s.time ?? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/ [AP]M$/, "");
    sh("xcrun", ["simctl", "status_bar", dev, "override", "--time", clock, "--batteryState", "charged", "--batteryLevel", "100", "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
    try { sh("xcrun", ["simctl", "terminate", dev, app]); } catch { /* not running */ }
    sh("xcrun", ["simctl", "launch", dev, app, "-autoSignIn", "-screen", s.screen]);
    await sleep(9000);
    const raw = join(WORK, `${s.name}-raw.mp4`);
    const rec = spawn("xcrun", ["simctl", "io", dev, "recordVideo", "--codec=h264", "--force", raw], { stdio: "ignore" });
    await sleep(2500);
    sh("xcrun", ["simctl", "push", dev, app, s.push]);
    await sleep(4500);
    rec.kill("SIGINT");
    await new Promise((r) => rec.on("exit", r));
    sh("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-an", join(OUT, `rec-${s.name}.mp4`)]);
    console.log(`rec-${s.name}.mp4`);
  }
  sh("xcrun", ["simctl", "status_bar", dev, "clear"]);
}

const cmd = process.argv[2];
const run = { stage, restore, glasses, phone }[cmd];
if (!run) {
  console.error("usage: headway-launch-record.mjs stage | glasses | phone | restore");
  process.exit(1);
}
await run();
