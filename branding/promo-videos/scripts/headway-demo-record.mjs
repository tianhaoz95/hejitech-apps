#!/usr/bin/env node
// Recordings for the Headway walkthrough (reports/2026-11-02-headway-demo-video, skill heji-demo-video), from
// the LOCAL stack only (never production): the seed rider (rider@example.com, commute Mountain View → San
// Francisco), today's real Caltrain timetable, and a staged live snapshot (the delays are demo data). The
// iPhone app is driven on the booted simulator by ios-uidriver (XCUITest), the plugin in the Even Hub
// simulator. Every clip gets an event log (rec-<name>.events.json). Each scene sets the local Worker's demo
// clock (PUT /api/dev/clock) to a weekday-morning moment, so it records any time of day; the app (Debug) and
// the plugin follow that clock. Run from the repo root, in this order:
//
//   supabase start; npm run dev:worker -w @headway/web                (Worker on 127.0.0.1:8792)
//   node branding/promo-videos/scripts/headway-demo-record.mjs backup   save the headway rows (once)
//   node … phone1    Monday 7:30, stage "normal" (one train 2 min late); rec-1-commute (Commute tab) + rec-1-board (Trains, Catch card)
//   node … pair      rec-2-pair: Glasses tab → Get a pairing code
//   node … glasses   rec-2-glasses: paired with that code; swipe, tap to flip, hold for the menu
//   node … late      Monday 8:02, stage "late" (the next local late enough that the express after it gets in first);
//                    rec-3-board (the tip), rec-3-hud (the tip on
//                    the glasses), rec-3-push (the alert, as the alert engine words it, pushed to the simulator)
//   node … track     rec-4-track: swipe a train, Track, Share live ETA, then the Dynamic Island and Lock Screen
//                    (Live Activity) with the arrival alert
//   node … eta       rec-4-eta: the shared ETA page, as whoever you sent it to sees it
//   node … restore   every headway row back as it was before, and the real clock
//
// Pushes: the simulator can't receive APNs, so `simctl push` delivers the payload push.ts would send, with
// the title and body alerts.ts writes for that situation. Say so in the report.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glassesStill, launchEvenSim, recordGlasses, recordWeb, REPO, SCRATCH, sh, sleep } from "./demo-record-lib.mjs";
import { booted, onSignal, recordSim, still } from "./sim-record.mjs";

const OUT = `${REPO}/branding/promo-videos/public/headway-demo`;
const WORK = `${SCRATCH}/headway-demo-work`;
mkdirSync(WORK, { recursive: true });
const site = "http://127.0.0.1:8792", supabase = "http://127.0.0.1:55421";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB = "supabase_db_waypack";
const APP = "com.hejitech.headway";
const FROM = "mountain_view", TO = "san_francisco";
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });
const state = () => (existsSync(join(WORK, "state.json")) ? JSON.parse(readFileSync(join(WORK, "state.json"), "utf8")) : {});
const saveState = (s) => writeFileSync(join(WORK, "state.json"), JSON.stringify({ ...state(), ...s }, null, 1));
// The scenes: a Monday morning (Caltrain's weekday timetable, with expresses).
const SCENE = { normal: "2026-11-09T07:30:00-08:00", late: "2026-11-09T08:02:00-08:00" };
const setClock = async (at) => (await fetch(`${site}/api/dev/clock`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ at }) })).json();
const demoNow = async () => (await (await fetch(`${site}/api/dev/clock`)).json()).now;
const clock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(/\s?[AP]M$/, "");
// The simulator's status bar (and Lock Screen date) at the demo moment. simctl takes an ISO date but drops its
// year (the Lock Screen then shows a 2023 weekday), so a 2023 date with the demo's weekday and time is passed.
const nowClock = async () => {
  const d = new Date(await demoNow());
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  const day = 5 + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday); // Nov 5, 2023 was a Sunday
  return `2023-11-${String(day).padStart(2, "0")}T${p.hour}:${p.minute}:00-08:00`;
};

const signIn = async () =>
  (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "rider@example.com", password: "headway-dev" }) })).json();
const api = async (tok, path, init = {}) => {
  for (let i = 0; ; i++) {
    const text = await (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).text();
    try { return JSON.parse(text); } catch { if (i >= 2) throw new Error(`${path}: ${text.slice(0, 120)}`); await sleep(500); }
  }
};

async function backup() {
  const file = join(WORK, "headway-backup.sql");
  if (existsSync(file)) return console.log("backup exists:", file);
  writeFileSync(file, sh("docker", ["exec", DB, "pg_dump", "-U", "postgres", "--data-only", "--schema=headway"]));
  console.log("backed up the headway rows to", file);
}
async function restore() {
  const file = join(WORK, "headway-backup.sql");
  if (!existsSync(file)) throw new Error("no backup");
  const tables = sql(`select string_agg('headway.'||quote_ident(table_name), ', ') from information_schema.tables where table_schema='headway' and table_type='BASE TABLE';`).trim();
  sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: `begin; set session_replication_role = replica; truncate ${tables};\n${readFileSync(file, "utf8")}\ncommit;` });
  await setClock(null);
  console.log("restored the headway rows and the real clock");
}

/** The demo commute and a live snapshot: "normal" (the first train 2 min late) or "late" (the next catchable train 38 min late, so the one after it gets in first). */
async function stage(mode) {
  await backup();
  await setClock(SCENE[mode]);
  const tok = (await signIn()).access_token;
  const cur = (await api(tok, "/api/settings")).settings;
  const settings = { ...cur, morning: { ...cur.morning, from: FROM, to: TO, walk_minutes: 8, travel_mode: "walk", express_preference: "all" }, evening: { ...cur.evening, from: TO, to: FROM }, switch_at: "13:00", days: [0, 1, 2, 3, 4, 5, 6] };
  if (!(await api(tok, "/api/settings", { method: "PUT", body: JSON.stringify({ settings }) })).settings) throw new Error("settings rejected");
  sql(`delete from headway.tracked_trips; delete from headway.sent_notifications; delete from headway.eta_shares; delete from headway.activity_tokens;`);
  // An empty snapshot first, so the board is the timetable while we pick trains.
  await putSnapshot({ trips: {}, alerts: [] });
  await sleep(21_000); // Worker isolates cache the snapshot for 20 s
  const board = await (await fetch(`${site}/api/board?from=${FROM}&to=${TO}`)).json();
  const stations = JSON.parse(readFileSync(`${REPO}/projects/headway/packages/core/src/timetable.gen.json`, "utf8")).stations;
  const stops = (sec) => Object.fromEntries(stations.flatMap((s) => [[s.nb, { delay: sec }], [s.sb, { delay: sec }]]));
  // The first train you can still make (leave-by in the future, with the 8-minute walk).
  const now = await demoNow();
  const trains = board.trains.filter((t) => t.dep - 8 * 60_000 > now + 60_000);
  if (trains.length < 2) throw new Error(`not enough trains: ${board.trains.length}`);
  const a = trains[0];
  let delayMin = 2, b = trains[1];
  if (mode === "late") {
    // Late enough that the first express after it gets in first, by a few minutes.
    b = trains.find((t) => t.kind === "EXP" && t.dep > a.dep);
    if (!b) throw new Error("no express after the first train");
    delayMin = Math.round((b.arr - a.arr) / 60_000) + 4;
  }
  await putSnapshot({ trips: { [a.trip_id]: { start_date: a.service_date, stops: stops(delayMin * 60) } }, alerts: [] });
  await sleep(21_000);
  const after = await (await fetch(`${site}/api/board?from=${FROM}&to=${TO}`)).json();
  saveState({ [mode]: { a: a.train, b: b.train, aTrip: a.trip_id, bTrip: b.trip_id, delayMin, tip: after.tip } });
  console.log(`staged ${mode} at ${clock(now)}: ${a.train} ${a.kind} ${clock(a.dep)} +${delayMin}, then ${b.train} ${b.kind} ${clock(b.dep)}; live ${after.live}; tip`, JSON.stringify(after.tip));
  return after;
}
async function putSnapshot({ trips, alerts }) {
  const now = await demoNow(); // fresh on the demo clock
  const r = await fetch(`${supabase}/rest/v1/realtime?on_conflict=id`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Content-Profile": "headway", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: 1, fetched_at: new Date(now).toISOString(), snapshot: { fetched_at: now, feed_ts: Math.floor(now / 1000), alerts, trips }, error: null }),
  });
  if (!r.ok) throw new Error(`snapshot: ${r.status} ${await r.text()}`);
}

// ---------- the phone -----------------------------------------------------------------------------------------
const phoneEnv = () => {
  const udid = booted();
  sh("xcrun", ["simctl", "ui", udid, "appearance", "dark"]);
  for (const s of ["notifications", "location"]) { try { sh("xcrun", ["simctl", "privacy", udid, "grant", s, APP]); } catch { /* not supported */ } }
  return udid;
};
const launch = (screen) => ({ do: "launch", args: ["-autoSignIn", "-screen", screen] });
const dismissNew = { do: "tap", q: { type: "button", label: "Done" }, timeout: 4, optional: true, ms: 600 };
const allow = { do: "tap", q: { app: "springboard", type: "button", contains: "Allow" }, timeout: 3, optional: true, ms: 400 };

/** Once per simulator: a fresh install (no old notifications), notifications allowed (Settings → Turn on alerts →
 * Allow), and the one-time Live Activity prompts answered in an unrecorded run, so the takes show none of it. */
async function notifications() {
  const udid = phoneEnv();
  try { sh("xcrun", ["simctl", "uninstall", udid, APP]); } catch { /* not installed */ }
  sh("xcrun", ["simctl", "install", udid, "/Volumes/proj/scratch/heji-video/dd-headway/Build/Products/Debug-iphonesimulator/Headway.app"]);
  await stage("late");
  const { late: L } = state();
  await recordSim({ name: "x-setup", out: WORK, work: WORK, bundle: APP, udid, steps: [
    launch("settings"), dismissNew,
    { step: "x", do: "tap", q: { type: "button", label: "Turn on alerts" }, timeout: 8, optional: true, ms: 1500 },
    { do: "tap", q: { app: "springboard", type: "button", label: "Allow" }, timeout: 6, optional: true, ms: 1000 },
    launch("trains"),
    { do: "wait", q: { type: "text", contains: `Wait for ${L.b}` }, timeout: 20, ms: 800 },
    { do: "swipeLeft", q: { type: "text", contains: `${L.b}, EXPRESS` }, ms: 900 },
    { do: "tap", q: { type: "button", label: "Track" }, ms: 2400 },
    { do: "home", ms: 1500 }, { do: "lock", ms: 2500 },
    { do: "tap", q: { app: "springboard", type: "button", label: "Allow" }, timeout: 5, optional: true, ms: 1000 },
    { do: "tap", q: { app: "springboard", type: "button", label: "Always Allow" }, timeout: 5, optional: true, ms: 1000 },
  ] });
}

async function phone1() {
  await stage("normal");
  const udid = phoneEnv();
  const time = await nowClock();
  await recordSim({ name: "1-commute", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("commute"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "Commute" }, ms: 800 },
    { step: "1.1", do: "mark", q: { type: "button", contains: "From, " }, label: "From", ms: 1800 },
    { step: "1.1a", do: "mark", q: { type: "button", contains: "To, " }, label: "To", ms: 1800 },
    { step: "1.1b", do: "mark", q: { type: "text", contains: "Walk to the station" }, label: "Your walk", ms: 2200 },
    { step: "1.2", do: "tap", q: { type: "button", label: "Trains" }, label: "Trains", ms: 2600 },
  ] });
  await recordSim({ name: "1-board", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("trains"), allow, dismissNew,
    { do: "wait", q: { type: "text", contains: "leave by" }, timeout: 20, ms: 800 },
    { step: "1.2", do: "mark", q: { type: "cell", index: 3 }, label: "Live departures", ms: 2600 },
    { step: "1.3", do: "mark", q: { type: "text", contains: "leave by" }, label: "Catch card", ms: 3000 },
    { step: "1.4", do: "mark", q: { type: "text", contains: "late" }, label: "Live delay", ms: 2600, optional: true, timeout: 3 },
  ] });
  still(udid, join(OUT, "still-1-board.png"));
}

async function pair() {
  const udid = phoneEnv();
  await recordSim({ name: "2-pair", out: OUT, work: WORK, bundle: APP, udid, time: await nowClock(), steps: [
    launch("glasses"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "Glasses" }, ms: 800 },
    { step: "2.1", do: "tap", q: { type: "button", label: "Get a pairing code" }, label: "Get a pairing code", ms: 1600 },
    { step: "2.1a", do: "mark", q: { type: "text", contains: "Even app" }, label: "Type it in the Even app", ms: 2600 },
  ] });
  const hash = sql(`select code_hash from headway.pairing_codes where used_at is null order by created_at desc limit 1;`).trim();
  const { createHash } = await import("node:crypto");
  let code = "";
  for (let i = 0; i < 1_000_000 && !code; i++) { const c = String(i).padStart(6, "0"); if (createHash("sha256").update(c).digest("hex") === hash) code = c; }
  if (!code) throw new Error("pairing code not found");
  saveState({ code });
  console.log("pairing code on the phone:", code);
}

async function withGlasses(code, fn) {
  const dir = `${REPO}/projects/headway/apps/glasses`;
  const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5176"], { cwd: dir, stdio: "ignore" });
  await sleep(4000);
  const { sim, stop } = await launchEvenSim({ url: `http://127.0.0.1:5176/?api=${site}&pair=${code}`, port: 9899, cwd: dir });
  try { await sleep(9000); await fn(sim); } finally { stop(); vite.kill(); }
}

async function glasses() {
  const { code } = state();
  await withGlasses(code, async (sim) => {
    await glassesStill(sim, join(OUT, "still-2-board.png"));
    await recordGlasses({ sim, name: "2-glasses", out: OUT, work: WORK, steps: [
      ["wait", 3200],
      ["down", 1700, "Next trains"], ["down", 1900],
      ["up", 1400], ["up", 1200],
      ["click", 3000, "Flip direction"],
      ["click", 2200, "Flip back"],
      ["long_press", 3200, "Menu"],
      ["double_click", 1600, "Back"],
    ] });
  });
}

async function late() {
  const board = await stage("late");
  if (!board.tip) throw new Error("no tip on the board: pick another moment");
  const udid = phoneEnv();
  const time = await nowClock();
  const { tip } = board;
  await recordSim({ name: "3-board", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("trains"), allow, dismissNew,
    { do: "wait", q: { type: "text", contains: "is delayed" }, timeout: 20, ms: 800 },
    { step: "3.1", do: "mark", q: { type: "text", contains: `Overtaken by ${tip.wait_for}` }, label: `${tip.instead_of} is ${state().late.delayMin} min late`, ms: 3000 },
    { step: "3.2", do: "mark", q: { type: "text", contains: "is delayed" }, label: `Wait for ${tip.wait_for}`, ms: 3600 },
  ] });
  still(udid, join(OUT, "still-3-board.png"));
  // The alert as the alert engine words it (alerts.ts "better_train"), delivered as push.ts would send it.
  const trainName = (t) => `${{ LOC: "Local", LTD: "Limited", EXP: "Express", SCC: "South County" }[t.kind] ?? "Train"} ${t.train}`;
  const slow = board.trains.find((t) => t.train === tip.instead_of), fast = board.trains.find((t) => t.train === tip.wait_for);
  const payload = { "Simulator Target Bundle": APP, aps: { alert: { title: `${slow.train} is ${slow.delay_min} min late: take ${fast.train} instead`, body: `${trainName(fast)} leaves Mountain View at ${clock(fast.pred_dep)} and reaches San Francisco at ${clock(fast.pred_arr)}, ${tip.saves_min} min before ${slow.train}.` }, sound: "default", "thread-id": "commute", "interruption-level": "time-sensitive" }, kind: "better_train", priority: true };
  writeFileSync(join(WORK, "push-better.json"), JSON.stringify(payload));
  saveState({ pushBetter: payload.aps.alert });
  onSignal("push-better", `xcrun simctl push ${udid} ${APP} ${join(WORK, "push-better.json")}`);
  await recordSim({ name: "3-push", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("commute"), allow, dismissNew,
    { step: "3.4h", do: "home", label: "", ms: 1800 },
    { step: "3.4s", do: "signal", text: "push-better", label: "", ms: 200 },
    { step: "3.4", do: "mark", q: { app: "springboard", type: "any", contains: "take " }, timeout: 20, label: "Time-sensitive alert", ms: 4200 },
  ] });
  const tok = (await signIn()).access_token;
  const code = (await api(tok, "/api/pairing-code", { method: "POST" })).code;
  await withGlasses(code, async (sim) => {
    await recordGlasses({ sim, name: "3-hud", out: OUT, work: WORK, steps: [["wait", 6500, "The tip"]] });
    await glassesStill(sim, join(OUT, "still-3-hud.png"));
  });
}

async function track() {
  await stage("late"); // its own fresh moment: Monday 8:02, 113 late, 511 the express to take
  const { late: L } = state();
  const udid = phoneEnv();
  const time = await nowClock();
  const arrive = { "Simulator Target Bundle": APP, aps: { alert: { title: "San Francisco in 5 min", body: `Express ${L.b} arrives San Francisco soon. Time to get ready.` }, sound: "default", "interruption-level": "time-sensitive" }, kind: "arrival", priority: true };
  writeFileSync(join(WORK, "push-arrival.json"), JSON.stringify(arrive));
  // Clear earlier takes' notifications from the Lock Screen first (before the first step: trimmed from the clip).
  const clear = [{ do: "swipeLeft", q: { app: "springboard", type: "button", id: "ListCell" }, timeout: 3, optional: true, ms: 600 }, { do: "tap", q: { app: "springboard", type: "button", label: "Clear" }, timeout: 2, optional: true, ms: 600 }];
  await recordSim({ name: "4-track", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    { do: "lock", ms: 1500 }, ...clear, ...clear, ...clear,
    launch("trains"), allow, dismissNew,
    { do: "wait", q: { type: "text", contains: `Wait for ${L.b}` }, timeout: 20, ms: 800 },
    { step: "4.1", do: "swipeLeft", q: { type: "text", contains: `${L.b}, EXPRESS` }, label: `Swipe ${L.b}`, ms: 900 },
    { step: "4.1a", do: "tap", q: { type: "button", label: "Track" }, label: "Track", ms: 2400 },
    { step: "4.2", do: "mark", q: { type: "text", label: "Tracking" }, label: "Tracking", ms: 2000 },
    { step: "4.4", do: "tap", q: { type: "button", label: "Share live ETA" }, label: "Share live ETA", ms: 2600 },
    { step: "4.4a", do: "mark", q: { app: "springboard", type: "any", contains: "127.0.0.1" }, timeout: 3, optional: true, label: "A private link", ms: 1600 },
    { do: "tap", q: { type: "button", label: "Close" }, timeout: 4, optional: true, ms: 800 },
    { step: "4.3", do: "home", label: "Dynamic Island", ms: 3200 },
    { do: "lock", ms: 1600 },
    { step: "4.3a", do: "mark", q: { app: "springboard", type: "any", contains: `${L.b} EXP` }, timeout: 6, label: "Live Activity", ms: 3600 },
  ] });
  // The arrival alert on the Lock Screen (as the alert engine words it), its own short clip.
  onSignal("push-arrival", `xcrun simctl push ${udid} ${APP} ${join(WORK, "push-arrival.json")}`);
  await recordSim({ name: "4-arrival", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    { step: "4.5s", do: "signal", text: "push-arrival", label: "", ms: 200 },
    { step: "4.5", do: "mark", q: { app: "springboard", type: "any", contains: "in 5 min" }, timeout: 20, label: "Arrival alert", ms: 3800 },
  ] });
  still(udid, join(OUT, "still-4-lock.png"));
}

async function eta() {
  await stage("late");
  const tok = (await signIn()).access_token;
  const { late: L } = state();
  const b = (await (await fetch(`${site}/api/board?from=${FROM}&to=${TO}`)).json()).trains.find((t) => t.train === L.b);
  await api(tok, "/api/track", { method: "POST", body: JSON.stringify({ trip_id: L.bTrip, service_date: b.service_date, from: FROM, to: TO }) });
  const share = await api(tok, "/api/me/share", { method: "POST", body: JSON.stringify({ name: "Sam" }) });
  if (!share.url) throw new Error(`no share: ${JSON.stringify(share)}`);
  const url = share.url.replace(/^https?:\/\/[^/]+/, site);
  await recordWeb({ name: "4-eta", out: OUT, work: WORK, phone: true, url, script: async (page, start, mark) => {
    await sleep(800);
    await start();
    await sleep(700);
    await mark("4.4b", page.locator("body").first(), "look", "What they see");
    await sleep(4200);
  } });
}

const cmd = process.argv[2];
const run = { backup, restore, notifications, phone1, pair, glasses, late, track, eta, stage: () => stage(process.argv[3] ?? "normal") }[cmd];
if (!run) {
  console.error("usage: headway-demo-record.mjs backup | phone1 | pair | glasses | late | track | eta | stage <normal|late> | restore");
  process.exit(1);
}
await run();
