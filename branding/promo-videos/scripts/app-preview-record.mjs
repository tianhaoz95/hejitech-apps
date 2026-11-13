#!/usr/bin/env node
// App Store app previews (15–30 s, iPhone screen only) for Headway and FitLoop: short takes of the CURRENT
// Debug apps on the LOCAL stack (never production), driven by ios-uidriver on one simulator, into
// public/<app>-preview/ (git-ignored; the edit is src/app-preview). Separate from the demo recordings so
// those stay intact. Run from the repo root with the local Workers up (Headway 8792, FitLoop 8794):
//
//   SIM="iPhone 18 Pro Max" node branding/promo-videos/scripts/app-preview-record.mjs headway
//   SIM="iPhone 18 Pro Max" node branding/promo-videos/scripts/app-preview-record.mjs fitloop
//   node branding/promo-videos/scripts/app-preview-record.mjs restore    the real clock back on Headway's Worker
//
// Headway: a Monday 7:29 demo clock, the seed rider's commute (Mountain View → San Francisco), a demo family
// group ("The Parks": Sam riding, Riley running late) and one staged delay. Pushes go in with `simctl push`
// using the alert engine's wording (the simulator can't get APNs). FitLoop: the seed athlete's plan on
// 2026-11-12 (a workout day). All of it is demo data.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, SCRATCH, sh, sleep } from "./demo-record-lib.mjs";
import { onSignal, recordSim, still } from "./sim-record.mjs";

const SIM = process.env.SIM ?? "iPhone 18 Pro Max";
// ONLY=<take,…> (e.g. 4-track,5-lock) re-records only those takes after the setup.
const take = (name) => !process.env.ONLY || process.env.ONLY.split(",").includes(name);
const udid = Object.values(JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "available", "-j"]).toString()).devices).flat().find((d) => d.name === SIM)?.udid;
if (!udid) throw new Error(`no simulator named ${SIM}`);
const supabase = "http://127.0.0.1:55421";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB = "supabase_db_waypack";
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });

async function signIn(email, password, create = true) {
  const r = await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (r.ok) return (await r.json()).access_token;
  if (!create) throw new Error(`sign-in ${email}`);
  await fetch(`${supabase}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true }) });
  return signIn(email, password, false);
}
const call = (site) => async (path, { method = "GET", auth, body } = {}) => {
  const r = await fetch(site + path, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) console.warn("!!", method, path, r.status, t.slice(0, 160));
  try { return JSON.parse(t); } catch { return null; }
};
const install = (app, path) => {
  // A fresh install: no notifications or Live Activities left from earlier takes.
  try { sh("xcrun", ["simctl", "uninstall", udid, app]); } catch { /* not installed */ }
  sh("xcrun", ["simctl", "install", udid, path]);
  sh("xcrun", ["simctl", "ui", udid, "appearance", "dark"]);
  for (const s of ["notifications", "location"]) { try { sh("xcrun", ["simctl", "privacy", udid, "grant", s, app]); } catch { /* not supported */ } }
};
const dismissNew = { do: "tap", q: { type: "button", label: "Done" }, timeout: 4, optional: true, ms: 600 };
const allow = { do: "tap", q: { app: "springboard", type: "button", contains: "Allow" }, timeout: 3, optional: true, ms: 400 };

// ---------- Headway ------------------------------------------------------------------------------------------
async function headway() {
  const APP = "com.hejitech.headway", api = call("http://127.0.0.1:8792");
  const OUT = `${REPO}/branding/promo-videos/public/headway-preview`, WORK = `${SCRATCH}/headway-preview-work`;
  mkdirSync(OUT, { recursive: true }); mkdirSync(WORK, { recursive: true });
  install(APP, "/Volumes/proj/scratch/heji-video/dd-headway/Build/Products/Debug-iphonesimulator/Headway.app");
  // Lock Screen date: simctl drops the year, so a 2023 Monday at the demo time (Nov 6, 2023 was a Monday).
  const AT = "2026-11-09T07:29:00-08:00", time = "7:29"; // this runtime only takes a plain time
  await api("/api/dev/clock", { method: "PUT", body: { at: AT } });
  const me = await signIn("rider@example.com", "headway-dev");
  const sam = await signIn("sam.store@example.com", "demo-pass-123");
  const riley = await signIn("riley.store@example.com", "demo-pass-123");
  const fam = (auth, p = "", o = {}) => api(`/api/family${p}`, { auth, ...o });
  for (const a of [sam, riley, me]) { await api("/api/track", { method: "DELETE", auth: a }); if ((await fam(a))?.group) await fam(a, "", { method: "DELETE" }); }
  await fam(me, "", { method: "POST", body: { name: "The Parks", display_name: "Jordan" } });
  for (const [a, mail, name] of [[sam, "sam.store@example.com", "Sam"], [riley, "riley.store@example.com", "Riley"]]) {
    await fam(me, "/invites", { method: "POST", body: { email: mail } });
    const inv = (await fam(a)).invites[0];
    await api(`/api/family/invites/${inv.id}/accept`, { method: "POST", auth: a, body: { display_name: name } });
    await fam(a, "/me", { method: "PUT", body: { display_name: name } });
  }
  const g = (await fam(me)).group;
  const id = (n) => g.members.find((m) => m.display_name === n)?.user_id, meId = g.members.find((m) => m.me).user_id;
  const pa = (await api("/api/board?from=palo_alto&to=san_francisco")).trains[0];
  await api("/api/track", { method: "POST", auth: sam, body: { trip_id: pa.trip_id, service_date: pa.service_date, from: "palo_alto", to: "san_francisco" } });
  await fam(sam, "/me", { method: "PUT", body: { shares: { trip: [meId], commute: [meId] } } });
  await fam(riley, "/status", { method: "PUT", body: { code: "running_late", minutes: 30 } });
  await fam(riley, "/me", { method: "PUT", body: { shares: { status: [meId] } } });
  await fam(me, "/me", { method: "PUT", body: { shares: { trip: [id("Sam"), id("Riley")] }, follows: { [id("Sam")]: { notify: ["trip"], live: true }, [id("Riley")]: { notify: ["status"], live: false } } } });
  // One live delay on the first train the rider can still make (the board's "late" state and the alert).
  const now = Date.parse(AT);
  const board = await api("/api/board?from=mountain_view&to=san_francisco");
  const t = board.trains.find((x) => x.dep - 10 * 60_000 > now + 60_000);
  const stations = (await import(`${REPO}/projects/headway/packages/core/src/timetable.gen.json`, { with: { type: "json" } })).default.stations;
  const stops = Object.fromEntries(stations.flatMap((s) => [[s.nb, { delay: 360 }], [s.sb, { delay: 360 }]]));
  const r = await fetch(`${supabase}/rest/v1/realtime?on_conflict=id`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Content-Profile": "headway", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: 1, fetched_at: new Date(now).toISOString(), snapshot: { fetched_at: now, feed_ts: Math.floor(now / 1000), alerts: [], trips: { [t.trip_id]: { start_date: t.service_date, stops } } }, error: null }) });
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  sql(`delete from headway.sent_notifications; delete from headway.eta_shares; delete from headway.activity_tokens;`);
  await sleep(21_000); // the Worker caches the snapshot for 20 s
  const kind = { LOC: "Local", LTD: "Limited", EXP: "Express", SCC: "South County" }[t.kind] ?? "Train";
  console.log(`staged: ${kind} ${t.train} 6 min late; Sam on ${pa.train}`);

  // Unrecorded: alerts allowed and the one-time Live Activity prompts answered, then untracked again.
  await recordSim({ name: "x-setup", out: WORK, work: WORK, bundle: APP, udid, time, steps: [
    { do: "launch", args: ["-autoSignIn", "-screen", "settings"] }, dismissNew, allow,
    { step: "x", do: "tap", q: { type: "button", label: "Turn on alerts" }, timeout: 8, optional: true, ms: 1500 },
    { do: "tap", q: { app: "springboard", type: "button", label: "Allow" }, timeout: 5, optional: true, ms: 800 },
    { do: "launch", args: ["-autoSignIn", "-screen", "trains"] },
    { do: "swipeLeft", q: { type: "text", contains: `${t.train}, ` }, timeout: 20, ms: 900 },
    { do: "tap", q: { type: "button", label: "Track" }, ms: 2000 },
    { do: "home", ms: 1200 }, { do: "lock", ms: 2000 },
    { do: "tap", q: { app: "springboard", type: "button", label: "Allow" }, timeout: 5, optional: true, ms: 800 },
    { do: "tap", q: { app: "springboard", type: "button", label: "Always Allow" }, timeout: 15, optional: true, ms: 800 },
  ] });
  await api("/api/track", { method: "DELETE", auth: me });
  const launch = (screen) => ({ do: "launch", args: ["-autoSignIn", "-screen", screen] });

  if (take("1-board")) await recordSim({ name: "1-board", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("trains"), allow, dismissNew,
    { do: "wait", q: { type: "text", contains: "leave by" }, timeout: 20, ms: 600 },
    { step: "board", do: "mark", q: { type: "text", contains: "leave by" }, label: "Leave in", ms: 3600 },
    { step: "scroll", do: "scroll", dy: -420, label: "Departures", ms: 2200 },
  ] });
  if (take("2-commute")) await recordSim({ name: "2-commute", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("commute"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "Commute" }, ms: 600 },
    { step: "commute", do: "mark", q: { type: "text", label: "Commute" }, label: "Commute", ms: 2600 },
    { step: "scroll", do: "scroll", dy: -500, label: "Alerts", ms: 2400 },
  ] });
  if (take("3-family")) await recordSim({ name: "3-family", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("family"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "The Parks" }, timeout: 15, ms: 600 },
    { step: "family", do: "mark", q: { type: "text", label: "The Parks" }, label: "Family", ms: 3800 },
  ] });
  // Track the delayed train, then its Live Activity on the Lock Screen and the delay alert as alerts.ts words it.
  const late = { "Simulator Target Bundle": APP, aps: { alert: { title: `${kind} ${t.train} is 6 min late`, body: `It now leaves Mountain View at ${new Date(t.dep + 360_000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(/\s?[AP]M$/, "")}.` }, sound: "default", "interruption-level": "time-sensitive" } };
  writeFileSync(join(WORK, "push-late.json"), JSON.stringify(late));
  onSignal("push-late", `xcrun simctl push ${udid} ${APP} ${join(WORK, "push-late.json")}`);
  const clear = [{ do: "swipeLeft", q: { app: "springboard", type: "button", id: "ListCell" }, timeout: 2, optional: true, ms: 500 }, { do: "tap", q: { app: "springboard", type: "button", label: "Clear" }, timeout: 2, optional: true, ms: 500 }];
  // Two takes: tracking in the app, then the Lock Screen (a take that starts locked loses its timing).
  const unlock = [{ do: "home", ms: 900 }, { do: "home", ms: 900 }];
  if (take("4-track")) await recordSim({ name: "4-track", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    ...unlock, launch("trains"), allow, dismissNew,
    { do: "wait", q: { type: "text", contains: `${t.train}, ` }, timeout: 20, ms: 1200 },
    { step: "board", do: "mark", q: { type: "text", contains: "leave by" }, label: "Leave in", ms: 1800 },
    { step: "swipe", do: "swipeLeft", q: { type: "text", contains: `${t.train}, ` }, label: "Swipe", ms: 900 },
    { step: "track", do: "tap", q: { type: "button", label: "Track" }, label: "Track", ms: 3000 },
  ] });
  if (take("5-lock")) await recordSim({ name: "5-lock", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    // Before the clip starts: iOS asks on the Lock Screen whether to keep allowing Live Activities.
    { do: "lock", ms: 1500 },
    { do: "tap", q: { app: "springboard", type: "any", label: "Always Allow" }, timeout: 15, optional: true, ms: 1000 },
    ...unlock,
    { step: "lock", do: "lock", label: "Lock Screen", ms: 1400 },
    { step: "live", do: "mark", q: { app: "springboard", type: "any", contains: t.train }, timeout: 6, optional: true, label: "Live Activity", ms: 2600 },
    { step: "pushs", do: "signal", text: "push-late", label: "", ms: 200 },
    { step: "push", do: "mark", q: { app: "springboard", type: "any", contains: "min late" }, timeout: 15, optional: true, label: "Delay alert", ms: 3400 },
  ] });
  still(udid, join(OUT, "still-4-lock.png"));
  await api("/api/track", { method: "DELETE", auth: me });
}

// ---------- FitLoop ------------------------------------------------------------------------------------------
async function fitloop() {
  const APP = "com.hejitech.fitloop", api = call("http://127.0.0.1:8794");
  const OUT = `${REPO}/branding/promo-videos/public/fitloop-preview`, WORK = `${SCRATCH}/fitloop-preview-work`;
  mkdirSync(OUT, { recursive: true }); mkdirSync(WORK, { recursive: true });
  install(APP, "/Volumes/proj/scratch/heji-video/dd-fitloop/Build/Products/Debug-iphonesimulator/FitLoop.app");
  const DAY = "2026-11-12", time = "7:02", ATHLETE = "00000000-0000-4000-8000-0000000f1700";
  sql(`delete from fitloop.checkins where user_id='${ATHLETE}' and date='${DAY}';`);
  // The agent's reply to the seeded knee note, as an agent would leave it over MCP (demo text).
  sql(`update fitloop.feedback set agent_reply='Thanks for flagging it. I swapped step-ups for glute bridges and kept the depth shallow on goblet squats. Tell me how the knee feels on Saturday.', addressed_at=now() where user_id='${ATHLETE}' and agent_reply is null;`);
  const launch = (screen, more = []) => ({ do: "launch", args: ["-autoSignIn", "-noHealth", "-date", DAY, "-screen", screen, ...more] });
  // Unrecorded: notification permission (reminders) answered once.
  await recordSim({ name: "x-setup", out: WORK, work: WORK, bundle: APP, udid, time, steps: [
    launch("today"), allow, dismissNew,
    { step: "x", do: "wait", q: { type: "button", label: "Ate it" }, timeout: 20, ms: 1500 },
    { do: "tap", q: { app: "springboard", type: "button", contains: "Allow" }, timeout: 3, optional: true, ms: 600 },
  ] });

  if (take("1-today")) await recordSim({ name: "1-today", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("today"), allow, dismissNew,
    { do: "wait", q: { type: "button", label: "Ate it" }, timeout: 20, ms: 600 },
    { step: "today", do: "mark", q: { type: "text", contains: " done" }, label: "Today", ms: 2400 },
    { step: "meal", do: "tap", q: { type: "button", label: "Ate it" }, label: "Ate it", ms: 2200 },
  ] });
  if (take("2-workout")) await recordSim({ name: "2-workout", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("today", ["-openWorkout"]), allow, dismissNew,
    { do: "wait", q: { type: "button", label: "Next exercise" }, timeout: 20, ms: 600 },
    { step: "player", do: "mark", q: { type: "button", label: "Next exercise" }, label: "Player", ms: 1600 },
    { step: "next", do: "tap", q: { type: "button", label: "Next exercise" }, label: "Next exercise", ms: 2200 },
    { step: "done", do: "tap", q: { type: "button", label: "Set done" }, label: "Set done", ms: 900 },
    { step: "rest", do: "mark", q: { type: "text", contains: "Rest" }, timeout: 4, optional: true, label: "Rest timer", ms: 2800 },
  ] });
  if (take("3-feedback")) await recordSim({ name: "3-feedback", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("feedback"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "Feedback" }, timeout: 20, ms: 600 },
    { step: "reply", do: "mark", q: { type: "text", contains: "Thanks for flagging" }, timeout: 10, label: "Agent's reply", ms: 3800 },
  ] });
  if (take("4-plan")) await recordSim({ name: "4-plan", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("plan"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "Goals" }, timeout: 20, ms: 600 },
    { step: "plan", do: "mark", q: { type: "text", label: "Goals" }, label: "Plan", ms: 2000 },
    { step: "scroll", do: "scroll", dy: -700, label: "The week", ms: 2400 },
  ] });
  if (take("5-progress")) await recordSim({ name: "5-progress", out: OUT, work: WORK, bundle: APP, udid, time, steps: [
    launch("progress"), allow, dismissNew,
    { do: "wait", q: { type: "text", label: "Progress" }, timeout: 20, ms: 600 },
    { step: "progress", do: "mark", q: { type: "text", label: "Progress" }, label: "Progress", ms: 3200 },
  ] });
  sql(`delete from fitloop.checkins where user_id='${ATHLETE}' and date='${DAY}';`);
}

async function restore() {
  await call("http://127.0.0.1:8792")("/api/dev/clock", { method: "PUT", body: { at: null } });
  console.log("Headway's demo clock is back to real time");
}

const run = { headway, fitloop, restore }[process.argv[2]];
if (!run) { console.error("usage: app-preview-record.mjs headway | fitloop | restore"); process.exit(1); }
await run();
