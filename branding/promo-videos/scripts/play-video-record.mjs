#!/usr/bin/env node
// Google Play promo videos for Headway and FitLoop: short takes of the CURRENT Android Debug apps on the
// LOCAL stack (never production), recorded with `adb shell screenrecord` on the Android emulator, into
// public/<app>-play/ (git-ignored; the edit is src/app-preview, compositions headway-play / fitloop-play).
// The same demo data as the App Store previews (app-preview-stage.mjs). Run from the repo root with the
// local Workers up (Headway 8792, FitLoop 8794), the emulator booted and both debug APKs installed:
//
//   ~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_37.0 -no-window -no-audio -no-snapshot-save
//   SERIAL=emulator-5554 node branding/promo-videos/scripts/play-video-record.mjs headway
//   SERIAL=emulator-5554 node branding/promo-videos/scripts/play-video-record.mjs fitloop
//   node branding/promo-videos/scripts/play-video-record.mjs restore     the real clock back on Headway's Worker
//
// Each take launches the app first (cold, `am start -S`), waits for its content, and only then records, so
// clips start on a finished screen. ONLY=<take,…> re-records just those. The status bar is SystemUI demo
// mode (7:29, full battery, Wi-Fi only); clear any notification icons on the emulator first.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { REPO, sleep } from "./demo-record-lib.mjs";
import { FITLOOP_DAY, headwayApi, restore, stageFitloop, stageHeadway, unstageFitloop } from "./app-preview-stage.mjs";

const SERIAL = process.env.SERIAL ?? "emulator-5554";
const take = (name) => !process.env.ONLY || process.env.ONLY.split(",").includes(name);
const adb = (...a) => execFileSync("adb", ["-s", SERIAL, ...a], { encoding: "utf8" });
const shell = (...a) => adb("shell", ...a);

function demoMode(hhmm) {
  shell("settings", "put", "global", "sysui_demo_allowed", "1");
  const d = (...a) => shell("am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", ...a);
  d("enter"); d("clock", "-e", "hhmm", hhmm); d("battery", "-e", "level", "100", "-e", "plugged", "false");
  d("network", "-e", "wifi", "show", "-e", "level", "4"); d("network", "-e", "mobile", "hide");
  d("notifications", "-e", "visible", "false");
}

// The accessibility tree: every node with text or a content description, and its centre.
function nodes() {
  shell("uiautomator", "dump", "/sdcard/.heji_ui.xml");
  const xml = shell("cat", "/sdcard/.heji_ui.xml");
  const out = [];
  for (const m of xml.matchAll(/<node[^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)) {
    const label = (m[1] || m[2]).replace(/&amp;/g, "&");
    if (label) out.push({ label, x: (+m[3] + +m[5]) >> 1, y: (+m[4] + +m[6]) >> 1 });
  }
  return out;
}
function find(label, nth = 0) {
  const all = nodes(), want = label.toLowerCase();
  const exact = all.filter((n) => n.label.toLowerCase() === want);
  return (exact.length ? exact : all.filter((n) => n.label.toLowerCase().includes(want)))[nth];
}
async function waitFor(label, timeout = 20) {
  for (const end = Date.now() + timeout * 1000; Date.now() < end; await sleep(400)) if (find(label)) return;
  throw new Error(`"${label}" never showed`);
}
const tap = (label, nth = 0) => { const n = find(label, nth); if (!n) throw new Error(`no "${label}"`); shell("input", "tap", `${n.x}`, `${n.y}`); };
const swipeUp = (dy, ms = 900) => shell("input", "swipe", "540", "1700", "540", `${1700 - dy}`, `${ms}`);

// Record one take: `steps` run while screenrecord is on; each step's start time (s from the recording's
// start) lands in <name>.events.json for the edit.
async function record(out, name, steps) {
  shell("rm", "-f", "/sdcard/heji-rec.mp4");
  const rec = spawn("adb", ["-s", SERIAL, "shell", "screenrecord", "--bit-rate", "20000000", "/sdcard/heji-rec.mp4"], { stdio: "ignore" });
  await sleep(700); // screenrecord's first frame
  const t0 = Date.now(), events = [];
  for (const [label, fn] of steps) { events.push({ label, t: (Date.now() - t0) / 1000 }); await fn(); }
  const total = (Date.now() - t0) / 1000;
  shell("pkill", "-INT", "screenrecord");
  await new Promise((r) => rec.on("exit", r));
  await sleep(800);
  adb("pull", "/sdcard/heji-rec.mp4", `${out}/raw-${name}.mp4`);
  // screenrecord only writes a frame when the screen changes, so a still screen ends the file early (or
  // leaves one frame): make it a constant 30 fps clip as long as the take, holding the last frame.
  const enc = ["-t", total.toFixed(2), "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", "-an", `${out}/rec-${name}.mp4`];
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${out}/raw-${name}.mp4`, "-vf", `fps=30,tpad=stop_mode=clone:stop_duration=${Math.ceil(total)}`, ...enc]);
  const frames = +execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", `${out}/raw-${name}.mp4`], { encoding: "utf8" }).trim();
  if (frames <= 1) { // a screen that never changed: one frame, which the fps filter drops
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${out}/raw-${name}.mp4`, "-frames:v", "1", `${out}/raw-${name}.png`]);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-loop", "1", "-framerate", "30", "-i", `${out}/raw-${name}.png`, ...enc]);
  }
  writeFileSync(`${out}/rec-${name}.events.json`, JSON.stringify({ total, events }, null, 1));
  console.log(`rec-${name}.mp4`, events.map((e) => `${e.label}@${e.t.toFixed(1)}`).join(" "));
}
const hold = (s) => ["hold", () => sleep(s * 1000)];

// ---------- Headway ------------------------------------------------------------------------------------------
async function headway() {
  const PKG = "com.hejitech.headway", OUT = `${REPO}/branding/promo-videos/public/headway-play`;
  mkdirSync(OUT, { recursive: true });
  const { t, me } = await stageHeadway();
  demoMode("0729");
  const open = async (screen, ready) => {
    shell("am", "start", "-S", "-n", `${PKG}/.app.MainActivity`, "--ez", "autoSignIn", "true", "--es", "screen", screen);
    await waitFor(ready); await sleep(1500);
  };
  if (take("1-board")) { await open("trains", "Leave in"); await record(OUT, "1-board", [hold(3.2), ["scroll", () => swipeUp(700, 1100)], hold(2.4)]); }
  if (take("2-track")) {
    await headwayApi("/api/track", { method: "DELETE", auth: me });
    await open("trains", "Leave in");
    // The delayed train's row is the second "Track this train" (the first is the express that needs a run).
    const nth = nodes().filter((n) => n.label === "Track this train").length > 1 ? 1 : 0;
    await record(OUT, "2-track", [hold(1.6), [`track ${t.train}`, () => tap("Track this train", nth)], hold(3.8)]);
    await headwayApi("/api/track", { method: "DELETE", auth: me });
  }
  if (take("3-commute")) { await open("commute", "Morning"); await record(OUT, "3-commute", [hold(2.6), ["scroll", () => swipeUp(800, 1100)], hold(2.4)]); }
  if (take("4-family")) { await open("family", "The Parks"); await record(OUT, "4-family", [hold(4.2), ["scroll", () => swipeUp(500, 1000)], hold(1.8)]); }
  if (take("5-settings")) { await open("settings", "Which alerts"); await record(OUT, "5-settings", [hold(4.0)]); }
}

// ---------- FitLoop ------------------------------------------------------------------------------------------
async function fitloop() {
  const PKG = "com.hejitech.fitloop", OUT = `${REPO}/branding/promo-videos/public/fitloop-play`;
  mkdirSync(OUT, { recursive: true });
  stageFitloop();
  demoMode("0702");
  const open = async (screen, ready, more = []) => {
    shell("am", "start", "-S", "-n", `${PKG}/.MainActivity`, "--ez", "autoSignIn", "true", "--es", "date", FITLOOP_DAY, "--es", "screen", screen, ...more);
    await waitFor(ready); await sleep(1500);
  };
  if (take("1-today")) { await open("today", "Ate it"); await record(OUT, "1-today", [hold(2.6), ["ate it", () => tap("Ate it")], hold(2.6)]); }
  if (take("2-workout")) {
    await open("today", "Next exercise", ["--ez", "openWorkout", "true"]);
    await record(OUT, "2-workout", [hold(1.8), ["next", () => tap("Next exercise")], hold(2.6), ["set done", () => tap("Set done")], hold(3.6)]);
  }
  if (take("3-feedback")) { await open("feedback", "Thanks for flagging"); await record(OUT, "3-feedback", [hold(4.2)]); }
  if (take("4-plan")) { await open("plan", "Goals"); await record(OUT, "4-plan", [hold(2.4), ["scroll", () => swipeUp(900, 1200)], hold(2.4)]); }
  if (take("5-progress")) { await open("progress", "Plan done"); await record(OUT, "5-progress", [hold(3.6)]); }
  unstageFitloop();
}

const run = { headway, fitloop, restore }[process.argv[2]];
if (!run) { console.error("usage: play-video-record.mjs headway | fitloop | restore"); process.exit(1); }
await run();
