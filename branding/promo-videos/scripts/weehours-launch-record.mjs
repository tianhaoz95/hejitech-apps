#!/usr/bin/env node
// Screen recordings for the weehours-launch promo, from the LOCAL stack only (never production): the
// seeded household (parent1 / parent2@example.com, baby Mia) with a demo night staged on top, its two
// parents renamed Jun and Mei for the film. Run from the repo root, with the local stack up
// (`supabase start`), the Debug app built for the simulator (projects/weehours CLAUDE.md) and an iPhone
// simulator booted with a paired, booted Apple Watch simulator:
//
//   node branding/promo-videos/scripts/weehours-launch-record.mjs stage     demo night + names
//   node … watch      rec-watch-home, rec-watch-listen, rec-phone-log, rec-watch-logged
//   node … tilt       rec-watch-tilt-aim, -confirm, -done (tilt mode's debug stages: the simulator has no wrist)
//   node … partner    rec-partner (the phone signed in as the second parent)
//   node … restore    deletes the staged and logged events, names back, the app off both simulators
//
// What's real and what's staged: every screen is the app's own UI on the local stack. The watch really
// opens already recording, as from its complication (simctl can't open the watch's links, so the Debug
// build's `-startRecording YES` does what the link does); the simulator can't
// whisper, so the phone gets the words as Whisper writes them, `-demoText "Bottle, 90 mils."`, which runs
// the same decision pipeline as a transcript (no transcription step). The phone logs it and the watch's status
// line comes back from the phone over WatchConnectivity, as on a real wrist.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/weehours-launch";
const WORK = join(tmpdir(), "weehours-launch-record");
mkdirSync(WORK, { recursive: true });
const supabase = "http://127.0.0.1:55421";
// The local stack's well-known demo service key (supabase-demo issuer).
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const HOUSEHOLD = "00000000-0000-4000-8000-0000000000aa", BABY = "00000000-0000-4000-8000-0000000000bb";
const JUN = "00000000-0000-4000-8000-00000000000a", MEI = "00000000-0000-4000-8000-00000000000b";
const APP = "com.hejitech.weehours", WATCH_APP = "com.hejitech.weehours.watchkitapp";
const BUILD = process.env.WEEHOURS_BUILD ?? "projects/weehours/apps/ios/build/Build/Products"; // xcodebuild -derivedDataPath …/build
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"] }).toString();

const rest = async (path, init = {}) => {
  const r = await fetch(`${supabase}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Accept-Profile": "weehours", "Content-Profile": "weehours", Prefer: "return=representation", ...init.headers } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

/** The two booted simulators: the iPhone and the watch paired to it. */
function devices() {
  const pairs = JSON.parse(sh("xcrun", ["simctl", "list", "pairs", "-j"])).pairs;
  const pair = Object.values(pairs).find((p) => p.phone.state === "Booted" && p.watch.state === "Booted");
  if (!pair) throw new Error("boot an iPhone simulator and its paired watch first (xcrun simctl pair / boot)");
  return { phone: pair.phone.udid, watch: pair.watch.udid };
}

/** A believable night, relative to now: Mei's bottle almost four hours ago, Jun's diaper change, a nap
 * that just ended. Every row is tagged so restore can take it out again. */
async function stage() {
  const saved = join(WORK, "seed.json");
  const members = await rest(`members?household_id=eq.${HOUSEHOLD}&select=user_id,display_name`);
  if (!existsSync(saved)) writeFileSync(saved, JSON.stringify({ members, since: new Date().toISOString() }));
  await rest(`members?user_id=eq.${JUN}&household_id=eq.${HOUSEHOLD}`, { method: "PATCH", body: JSON.stringify({ display_name: "Jun" }) });
  await rest(`members?user_id=eq.${MEI}&household_id=eq.${HOUSEHOLD}`, { method: "PATCH", body: JSON.stringify({ display_name: "Mei" }) });
  const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
  const row = (min, type, fields, who, surface, input) => ({ id: randomUUID(), household_id: HOUSEHOLD, baby_id: BABY, type, fields, occurred_at: ago(min), logged_at: ago(min), logged_by: who, provenance: { surface, input, promo: "weehours-launch" } });
  await rest("events", { method: "POST", body: JSON.stringify([
    row(232, "feed.bottle.single", { consumed_fraction: 1, contents: "formula" }, MEI, "phone", "tap"),
    row(141, "diaper", { kind: "wet" }, JUN, "watch", "tap"),
    row(136, "sleep.start", {}, JUN, "watch", "tap"),
    row(9, "sleep.end", {}, MEI, "phone", "tap"),
  ]) });
  // The seed has entries of one type minutes apart, which the app flags as possible duplicates
  // ("1 to review"): keep both, so the status line reads clean.
  const all = await rest(`events?household_id=eq.${HOUSEHOLD}&order=occurred_at.asc&select=id,type,occurred_at`);
  const resolves = all.flatMap((e, i) => {
    const prev = all.slice(0, i).reverse().find((p) => p.type === e.type);
    const close = prev && Date.parse(e.occurred_at) - Date.parse(prev.occurred_at) <= 10 * 60_000;
    return close && !["resolve", "undo", "duty"].includes(e.type) ? [row(0, "resolve", { original: prev.id, duplicate: e.id, resolution: "keep_both" }, JUN, "phone", "tap")] : [];
  });
  if (resolves.length) await rest("events", { method: "POST", body: JSON.stringify(resolves) });
  console.log("staged: Jun and Mei, a bottle 3h52m ago, a nap that just ended");
}

async function restore() {
  const { members, since } = JSON.parse(readFileSync(join(WORK, "seed.json"), "utf8"));
  const tagged = await rest(`events?provenance->>promo=eq.weehours-launch`, { method: "DELETE" });
  const logged = await rest(`events?household_id=eq.${HOUSEHOLD}&logged_at=gte.${since}`, { method: "DELETE" });
  for (const m of members) await rest(`members?user_id=eq.${m.user_id}&household_id=eq.${HOUSEHOLD}`, { method: "PATCH", body: JSON.stringify({ display_name: m.display_name }) });
  try {
    const { phone, watch } = devices();
    for (const [d, a] of [[phone, APP], [watch, WATCH_APP]]) try { sh("xcrun", ["simctl", "uninstall", d, a]); } catch { /* not installed */ }
    sh("xcrun", ["simctl", "status_bar", phone, "clear"]);
  } catch { /* simulators gone */ }
  console.log(`restored: ${tagged.length + logged.length} events deleted, names ${members.map((m) => m.display_name).join(" and ")}`);
}

const PHONE_ARGS = ["-screen", "home", "-skipPermissions", "YES", "-last_seen_whats_new_version", "1.0.0",
  // tilt mode's layout: diaper up, so the silent log in the film is a diaper change
  "-watchCompass.north", "diaper", "-watchCompass.east", "feed", "-watchCompass.south", "sleep"];

/** A clean install on both (the phone's own SQLite starts empty and syncs the household). */
function install({ phone, watch }) {
  for (const [d, a] of [[phone, APP], [watch, WATCH_APP]]) try { sh("xcrun", ["simctl", "uninstall", d, a]); } catch { /* not installed */ }
  sh("xcrun", ["simctl", "install", phone, join(BUILD, "Debug-iphonesimulator/WeeHours.app")]);
  sh("xcrun", ["simctl", "install", watch, join(BUILD, "Debug-watchsimulator/WeeHoursWatch.app")]);
  sh("xcrun", ["simctl", "privacy", watch, "grant", "microphone", WATCH_APP]);
}

function night({ phone, watch }) {
  sh("xcrun", ["simctl", "ui", phone, "appearance", "dark"]);
  sh("xcrun", ["simctl", "status_bar", phone, "override", "--time", clock(), "--batteryState", "discharging", "--batteryLevel", "64", "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
  // watchOS has no status bar override: the edit crops the watch's clock out
}

// The film is at 3am: the apps run in the time zone where it's 3am now (Etc/GMT signs are inverted).
const offset = ((3 - new Date().getUTCHours() + 36) % 24) - 12;
const TZ = offset === 0 ? "Etc/UTC" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
const clock = () => new Date(Date.now() + offset * 3_600_000).toISOString().slice(11, 16).replace(/^0/, "");

const launch = (d, app, args = []) => {
  try { sh("xcrun", ["simctl", "terminate", d, app]); } catch { /* not running */ }
  execFileSync("xcrun", ["simctl", "launch", d, app, ...args], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, SIMCTL_CHILD_TZ: TZ } });
};

/** Records a simulator's screen for `ms` while `during` runs, as a 30 fps H.264 MP4 in public/. */
async function record(device, name, ms, during = async () => {}) {
  const raw = join(WORK, `${name}-raw.mp4`);
  const rec = spawn("xcrun", ["simctl", "io", device, "recordVideo", "--codec=h264", "--force", raw], { stdio: "ignore" });
  const stopped = new Promise((r) => rec.on("exit", r));
  await sleep(1200);
  const t = Date.now();
  await during();
  await sleep(Math.max(0, ms - (Date.now() - t)));
  rec.kill("SIGINT");
  await stopped;
  // simctl writes frames only when the screen changes: hold the last one to the full length
  const total = (ms + 1200) / 1000;
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", `tpad=stop_mode=clone:stop_duration=${total},fps=30,format=yuv420p`, "-t", String(total), "-c:v", "libx264", "-crf", "14", "-an", join(OUT, `rec-${name}.mp4`)]);
  console.log(`rec-${name}.mp4`);
}

async function watchVoice() {
  const d = devices();
  install(d);
  night(d);
  launch(d.phone, APP, ["-autoSignIn", "parent1@example.com", ...PHONE_ARGS]);
  await sleep(14_000); // sign-in, sync, the first application context to the watch
  launch(d.watch, WATCH_APP);
  await sleep(6000);
  await record(d.watch, "watch-home", 2500);
  // what the complication does: opens the watch app already recording
  await record(d.watch, "watch-listen", 6000, async () => { launch(d.watch, WATCH_APP, ["-startRecording", "YES"]); });
  // the words reach the phone (here as a transcript), which decides and logs them
  await record(d.phone, "phone-log", 22_000, async () => {
    launch(d.phone, APP, ["-demoText", "Bottle, 90 mils.", ...PHONE_ARGS, "-screen", "timeline"]);
  });
  launch(d.watch, WATCH_APP); // out of recording, back to the status line the phone sent
  await sleep(1500);
  await record(d.watch, "watch-logged", 4000);
}

async function tilt() {
  const d = devices();
  night(d);
  // the phone's Settings → Apple Watch choice, which the watch follows: open in tilt mode
  install(d); // a phone app taken off for `partner` takes the watch app with it
  launch(d.phone, APP, ["-autoSignIn", "parent1@example.com", ...PHONE_ARGS, "-watchStartMode", "tilt"]);
  await sleep(14_000);
  for (const stage of ["aim", "confirm", "done"]) {
    await record(d.watch, `watch-tilt-${stage}`, 3500, async () => { launch(d.watch, WATCH_APP, ["-startMode", "tilt", "-tiltStage", stage]); });
  }
}

/** Mei's phone: the same household, signed in as the second parent (a fresh install forgets Jun). */
async function partner() {
  const d = devices();
  sh("xcrun", ["simctl", "uninstall", d.phone, APP]);
  sh("xcrun", ["simctl", "install", d.phone, join(BUILD, "Debug-iphonesimulator/WeeHours.app")]);
  night(d);
  launch(d.phone, APP, ["-autoSignIn", "parent2@example.com", ...PHONE_ARGS]);
  await sleep(14_000);
  await record(d.phone, "partner", 4000);
}

const cmd = process.argv[2];
const run = { stage, restore, watch: watchVoice, tilt, partner }[cmd];
if (!run) {
  console.error("usage: weehours-launch-record.mjs stage | watch | tilt | partner | restore");
  process.exit(1);
}
await run();
