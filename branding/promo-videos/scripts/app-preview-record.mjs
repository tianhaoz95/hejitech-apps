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
import { call, FITLOOP_DAY, restore, stageFitloop, stageHeadway, unstageFitloop } from "./app-preview-stage.mjs";

const SIM = process.env.SIM ?? "iPhone 18 Pro Max";
// ONLY=<take,…> (e.g. 4-track,5-lock) re-records only those takes after the setup.
const take = (name) => !process.env.ONLY || process.env.ONLY.split(",").includes(name);
const udid = Object.values(JSON.parse(execFileSync("xcrun", ["simctl", "list", "devices", "available", "-j"]).toString()).devices).flat().find((d) => d.name === SIM)?.udid;
if (!udid) throw new Error(`no simulator named ${SIM}`);
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
  const time = "7:29"; // this runtime only takes a plain time
  const { t, kind, me, late: lateText } = await stageHeadway();

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
  const late = { "Simulator Target Bundle": APP, aps: { alert: lateText, sound: "default", "interruption-level": "time-sensitive" } };
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
  const DAY = FITLOOP_DAY, time = "7:02";
  stageFitloop();
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
  unstageFitloop();
}

const run = { headway, fitloop, restore }[process.argv[2]];
if (!run) { console.error("usage: app-preview-record.mjs headway | fitloop | restore"); process.exit(1); }
await run();
