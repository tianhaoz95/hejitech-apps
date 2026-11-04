#!/usr/bin/env node
// Screen recordings for the headway-demo walkthrough (skill heji-demo-video), from the LOCAL stack only:
// seed rider (rider@example.com / headway-dev) on http://127.0.0.1:8792. Run from the repo root:
//
//   supabase start; npm run dev:worker -w @headway/web           (Worker on 127.0.0.1:8792)
//   node branding/promo-videos/scripts/headway-demo-record.mjs stage    demo commute + live snapshot
//   node … glasses    rec-2-glasses.mp4 + .events.json (starts Even Hub simulator + plugin)
//   node … phone      rec-1-commute.mp4, rec-3-overtake.mp4, rec-4-track.mp4 + .events.json
//   node … restore    the seed rider's settings back
//
// Generates MP4s and companion .events.json files into branding/promo-videos/public/headway-demo/.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/headway-demo";
const WORK = join(tmpdir(), "headway-demo-record");
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

const site = "http://127.0.0.1:8792", supabase = "http://127.0.0.1:55421", sim = "http://127.0.0.1:9899";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], ...opts }).toString();

const token = async () =>
  (await (await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rider@example.com", password: "headway-dev" })
  })).json()).access_token;

const api = async (tok, path, init = {}) =>
  (await fetch(site + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }
  })).json();

/** Stage the demo commute and a realtime snapshot with delays and express overtakes. */
async function stage() {
  const tok = await token();
  const saved = join(WORK, "seed-settings.json");
  const cur = (await api(tok, "/api/settings")).settings;
  if (!existsSync(saved)) writeFileSync(saved, JSON.stringify({ settings: cur }));

  const leg = (from, to, window) => ({ ...cur.morning, from, to, walk_minutes: 6, usual: null, window });
  const settings = {
    ...cur,
    morning: leg("san_francisco", "palo_alto", { start: "06:00", end: "12:00" }),
    evening: leg("palo_alto", "san_francisco", { start: "15:30", end: "20:00" }),
    switch_at: "14:00",
    days: [0, 1, 2, 3, 4, 5, 6]
  };
  if (!(await api(tok, "/api/settings", { method: "PUT", body: JSON.stringify({ settings }) })).settings) {
    throw new Error("settings rejected");
  }

  const trains = (await (await fetch(`${site}/api/board?from=san_francisco&to=palo_alto`)).json()).trains;
  const a = trains[0]; // first train (on time)
  const b = trains[1]; // second train (4 min late)
  const c = trains[2] ?? b; // third train (overtake scenario: local delayed by 14m, express on time)

  const southbound = JSON.parse(readFileSync("projects/headway/packages/core/src/timetable.gen.json", "utf8")).stations.map((s) => s.sb);
  const delays = (sec) => Object.fromEntries(southbound.map((id) => [id, { delay: sec }]));
  const now = Date.now();

  const snapshot = {
    fetched_at: now,
    feed_ts: Math.floor(now / 1000),
    alerts: [
      {
        id: "alert-demo-1",
        summary: "Single-tracking between San Mateo and Hayward Park",
        description: "Minor delays of 5 to 10 minutes expected southbound.",
        stations: ["san_mateo", "hayward_park"],
        created_at: now
      }
    ],
    trips: {
      [a.trip_id]: { start_date: a.service_date, stops: delays(0) },
      [b.trip_id]: { start_date: b.service_date, stops: delays(240) },
      [c.trip_id]: { start_date: c.service_date, stops: delays(840) } // 14 min late
    }
  };

  const r = await fetch(`${supabase}/rest/v1/realtime?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      "Content-Profile": "headway",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ id: 1, fetched_at: new Date(now).toISOString(), snapshot, error: null })
  });
  if (!r.ok) throw new Error(`snapshot: ${r.status}`);
  await sleep(21_000); // Worker isolates cache the snapshot for 20 s
  console.log(`staged: ${a.train} on time, ${b.train} 4 min late, ${c.train} 14 min late`);
}

async function restore() {
  const tok = await token();
  const r = await api(tok, "/api/settings", { method: "PUT", body: readFileSync(join(WORK, "seed-settings.json"), "utf8") });
  console.log("restored", r.settings?.morning?.from, "→", r.settings?.morning?.to);
}

/** Record Even G2 glasses display via simulator */
async function recordGlasses(name, steps, events) {
  const dir = join(WORK, `frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  let on = true;
  const startT = Date.now();

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
    if (action !== "wait") {
      await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    }
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

  const dur = (Date.now() - startT) / 1000;
  const eventLog = {
    clip: `rec-${name}.mp4`,
    width: 1728,
    height: 864,
    duration: Math.round(dur * 100) / 100,
    events
  };
  writeFileSync(join(OUT, `rec-${name}.events.json`), JSON.stringify(eventLog, null, 1));
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${dur.toFixed(1)}s`);
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
    await sleep(10_000); // initial pairing & sync

    // Record Chapter 2: Even G2 glasses & R1 ring interactions
    await recordGlasses("2-glasses", [
      ["wait", 4500],
      ["down", 2000],
      ["flip", 2500],
      ["hold", 3500]
    ], [
      { step: "2.2", t: 1.0, type: "display", label: "HUD Board", box: { x: 200, y: 150, w: 1328, h: 564 }, x: 864, y: 432 },
      { step: "2.3", t: 5.0, type: "swipe", label: "Swipe Down", box: { x: 240, y: 320, w: 1200, h: 90 }, x: 840, y: 365 },
      { step: "2.4", t: 7.2, type: "tap", label: "Tap Flip", box: { x: 240, y: 180, w: 1200, h: 70 }, x: 840, y: 215 },
      { step: "2.5", t: 10.0, type: "hold", label: "Hold Menu", box: { x: 400, y: 200, w: 928, h: 450 }, x: 864, y: 425 }
    ]);
  } finally {
    simProc.kill();
    vite.kill();
  }
}

/** Record iPhone simulator screen */
async function phone() {
  const dev = "booted", app = "com.hejitech.headway";
  const push = (title, body, kind) => {
    const f = join(WORK, `push-${kind}.json`);
    writeFileSync(f, JSON.stringify({ "Simulator Target Bundle": app, aps: { alert: { title, body }, sound: "default", "thread-id": `demo:${kind}`, "interruption-level": "time-sensitive" }, kind }));
    return f;
  };

  sh("xcrun", ["simctl", "ui", dev, "appearance", "dark"]);

  // Chapter 1: Commute & Leave-by times
  await stage();
  sh("xcrun", ["simctl", "status_bar", dev, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100", "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
  try { sh("xcrun", ["simctl", "terminate", dev, app]); } catch {}
  sh("xcrun", ["simctl", "launch", dev, app, "-autoSignIn", "-screen", "trains"]);
  await sleep(7000);

  const raw1 = join(WORK, "rec-1-commute-raw.mp4");
  const rec1 = spawn("xcrun", ["simctl", "io", dev, "recordVideo", "--codec=h264", "--force", raw1], { stdio: "ignore" });
  await sleep(18_000);
  rec1.kill("SIGINT");
  await new Promise((r) => rec1.on("exit", r));
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw1, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-an", join(OUT, "rec-1-commute.mp4")]);

  const ev1 = {
    clip: "rec-1-commute.mp4",
    width: 1179,
    height: 2556,
    duration: 18.0,
    events: [
      { step: "1.1", t: 1.5, type: "focus", label: "Commute Stations", box: { x: 40, y: 180, w: 1099, h: 220 }, x: 589, y: 290 },
      { step: "1.2", t: 5.5, type: "focus", label: "Live Departures", box: { x: 40, y: 440, w: 1099, h: 360 }, x: 589, y: 620 },
      { step: "1.3", t: 9.8, type: "focus", label: "CatchCard", box: { x: 60, y: 840, w: 1059, h: 320 }, x: 589, y: 1000 },
      { step: "1.4", t: 14.0, type: "focus", label: "Catch State", box: { x: 100, y: 880, w: 979, h: 180 }, x: 589, y: 970 }
    ]
  };
  writeFileSync(join(OUT, "rec-1-commute.events.json"), JSON.stringify(ev1, null, 1));
  console.log("rec-1-commute.mp4 written");

  // Chapter 3: Overtake Express Alert
  const pushOvertake = push("Take 511 instead", "Express 511 arrives Palo Alto 4m earlier than Local 113.", "better_train");
  const raw3 = join(WORK, "rec-3-overtake-raw.mp4");
  const rec3 = spawn("xcrun", ["simctl", "io", dev, "recordVideo", "--codec=h264", "--force", raw3], { stdio: "ignore" });
  await sleep(3000);
  sh("xcrun", ["simctl", "push", dev, app, pushOvertake]);
  await sleep(15_000);
  rec3.kill("SIGINT");
  await new Promise((r) => rec3.on("exit", r));
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw3, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-an", join(OUT, "rec-3-overtake.mp4")]);

  const ev3 = {
    clip: "rec-3-overtake.mp4",
    width: 1179,
    height: 2556,
    duration: 18.0,
    events: [
      { step: "3.1", t: 1.0, type: "focus", label: "Local 113 Delayed", box: { x: 40, y: 440, w: 1099, h: 180 }, x: 589, y: 530 },
      { step: "3.2", t: 4.5, type: "focus", label: "InsightBanner", box: { x: 40, y: 240, w: 1099, h: 160 }, x: 589, y: 320 },
      { step: "3.4", t: 8.5, type: "alert", label: "Time-Sensitive Push", box: { x: 30, y: 80, w: 1119, h: 220 }, x: 589, y: 190 }
    ]
  };
  writeFileSync(join(OUT, "rec-3-overtake.events.json"), JSON.stringify(ev3, null, 1));
  console.log("rec-3-overtake.mp4 written");

  // Chapter 4: Track train & Live Activities
  const pushArrival = push("Palo Alto in 5 min", "Local 618 arrives Palo Alto 12:46. Time to get ready.", "arrival");
  const raw4 = join(WORK, "rec-4-track-raw.mp4");
  const rec4 = spawn("xcrun", ["simctl", "io", dev, "recordVideo", "--codec=h264", "--force", raw4], { stdio: "ignore" });
  await sleep(4000);
  sh("xcrun", ["simctl", "push", dev, app, pushArrival]);
  await sleep(16_000);
  rec4.kill("SIGINT");
  await new Promise((r) => rec4.on("exit", r));
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw4, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-an", join(OUT, "rec-4-track.mp4")]);

  const ev4 = {
    clip: "rec-4-track.mp4",
    width: 1179,
    height: 2556,
    duration: 20.0,
    events: [
      { step: "4.1", t: 1.2, type: "swipe", label: "Swipe to Track", box: { x: 40, y: 440, w: 1099, h: 180 }, x: 589, y: 530 },
      { step: "4.2", t: 5.0, type: "focus", label: "Live Activity", box: { x: 40, y: 220, w: 1099, h: 280 }, x: 589, y: 360 },
      { step: "4.4", t: 9.5, type: "tap", label: "Share ETA", box: { x: 780, y: 260, w: 320, h: 80 }, x: 940, y: 300 },
      { step: "4.5", t: 14.5, type: "alert", label: "5-min Arrival Tap", box: { x: 30, y: 80, w: 1119, h: 220 }, x: 589, y: 190 }
    ]
  };
  writeFileSync(join(OUT, "rec-4-track.events.json"), JSON.stringify(ev4, null, 1));
  console.log("rec-4-track.mp4 written");

  sh("xcrun", ["simctl", "status_bar", dev, "clear"]);
}

const cmd = process.argv[2];
const run = { stage, restore, glasses, phone }[cmd];
if (!run) {
  console.error("usage: headway-demo-record.mjs stage | glasses | phone | restore");
  process.exit(1);
}
await run();
