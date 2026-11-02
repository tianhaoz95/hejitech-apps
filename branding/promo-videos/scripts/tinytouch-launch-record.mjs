#!/usr/bin/env node
// Screen recordings for the tinytouch-launch promo: the real watch and iPhone apps (Debug build) on a
// paired iPhone + Apple Watch simulator. TinyTouch has no backend and no account, so there is nothing
// to stage or restore: the only "data" is the live touch count the scripted taps make. Nothing here
// places a call or sends anything anywhere.
//
// Taps, swipes, the Digital Crown and the 3-second parent hold are driven by a throwaway XCUITest
// project (TTDrive: a watchOS and an iOS UI-test target that drive the installed apps by bundle id,
// `XCUIApplication(bundleIdentifier:)`), built once with `xcodebuild build-for-testing` into
// $TTDRIVE/dd. Each test writes the time to $MARK when its action starts; the clip is cut from there.
//
//   TINYTOUCH_BUILD=<derived data>/Build/Products TTDRIVE=<TTDrive dir> \
//   node branding/promo-videos/scripts/tinytouch-launch-record.mjs [beat …]
//
// Beats: bubbles animals swipe crown shield moon remote (remote records the phone and the watch at once).
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/tinytouch-launch";
const WORK = join(tmpdir(), "tinytouch-launch-record");
mkdirSync(WORK, { recursive: true });
const APP = "com.tianhaoz.tinytouch", WATCH_APP = "com.tianhaoz.tinytouch.watchkitapp";
const BUILD = process.env.TINYTOUCH_BUILD;
const DRIVE = process.env.TTDRIVE;
if (!BUILD || !DRIVE) throw new Error("set TINYTOUCH_BUILD and TTDRIVE (see the header)");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], ...opts }).toString();

/** The booted iPhone simulator and the watch paired to it. */
function devices() {
  const pairs = JSON.parse(sh("xcrun", ["simctl", "list", "pairs", "-j"])).pairs;
  const pair = Object.values(pairs).find((p) => p.phone.state === "Booted" && p.watch.state === "Booted");
  if (!pair) throw new Error("boot an iPhone simulator and its paired watch first (xcrun simctl pair / boot)");
  return { phone: pair.phone.udid, watch: pair.watch.udid };
}

function install({ phone, watch }) {
  for (const [d, a, p] of [[phone, APP, "Debug-iphonesimulator/TinyTouch.app"], [watch, WATCH_APP, "Debug-watchsimulator/ToddlerPlay.app"]]) {
    try { sh("xcrun", ["simctl", "uninstall", d, a]); } catch { /* not installed */ }
    sh("xcrun", ["simctl", "install", d, join(BUILD, p)]);
  }
  sh("xcrun", ["simctl", "ui", phone, "appearance", "light"]);
  sh("xcrun", ["simctl", "status_bar", phone, "override", "--time", "4:12", "--batteryState", "discharging", "--batteryLevel", "72", "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
  // watchOS has no status bar override: the edit covers the watch's clock
}

/** Starts recording a simulator's screen; resolves with { stop, t0 } once the first frame is written. */
async function startRecording(device, name) {
  const raw = join(WORK, `${name}-raw.mp4`);
  const rec = spawn("xcrun", ["simctl", "io", device, "recordVideo", "--codec=h264", "--force", raw], { stdio: ["ignore", "ignore", "pipe"] });
  const exited = new Promise((r) => rec.on("exit", r));
  const t0 = await new Promise((resolve) => {
    rec.stderr.on("data", (b) => { if (/Recording started/i.test(String(b))) resolve(Date.now() / 1000); });
    setTimeout(() => resolve(Date.now() / 1000), 4000);
  });
  return { raw, t0, stop: async () => { rec.kill("SIGINT"); await exited; } };
}

/** Cuts `secs` from the raw recording, starting `from` seconds in, as a 30 fps H.264 MP4 in public/. */
function cut(raw, name, from, secs) {
  // simctl writes frames only when the screen changes: hold frames, then resample to 30 fps
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", `tpad=stop_mode=clone:stop_duration=${secs + 2},fps=30,trim=start=${from.toFixed(3)}:duration=${secs},setpts=PTS-STARTPTS,format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-an", join(OUT, `rec-${name}.mp4`)]);
  console.log(`rec-${name}.mp4 (from ${from.toFixed(2)} s, ${secs} s)`);
}

const test = (scheme, dest, name, mark) => new Promise((resolve, reject) => {
  const p = spawn("xcodebuild", ["test-without-building", "-project", join(DRIVE, "TTDrive.xcodeproj"), "-scheme", scheme, "-destination", `id=${dest}`,
    "-derivedDataPath", join(DRIVE, "dd"), `-only-testing:${scheme}Tests/Drive/${name}`], { stdio: "ignore", env: { ...process.env, TEST_RUNNER_MARK: mark } });
  p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`${name} failed (${c})`))));
});
const markTime = (mark) => Number(readFileSync(mark, "utf8"));

/** One watch beat: record while a UI test acts, keep `secs` from its marker (minus `lead`). */
async function watchBeat(d, name, testName, secs, lead = 0.3) {
  const mark = join(WORK, `${name}.mark`);
  rmSync(mark, { force: true });
  const r = await startRecording(d.watch, name);
  await test("W", d.watch, testName, mark);
  await sleep(500);
  await r.stop();
  cut(r.raw, `watch-${name}`, markTime(mark) - r.t0 - lead, secs);
}

/** The lullaby needs no input: launch it and record. */
async function moon(d) {
  try { sh("xcrun", ["simctl", "terminate", d.watch, WATCH_APP]); } catch { /* not running */ }
  sh("xcrun", ["simctl", "launch", d.watch, WATCH_APP, "--mode-lullaby"]);
  await sleep(2500);
  const r = await startRecording(d.watch, "moon");
  await sleep(4500);
  await r.stop();
  cut(r.raw, "watch-moon", 0.5, 3.5);
}

/** The phone switches the watch to Sound Garden and starts the lullaby: both screens at once. */
async function remote(d) {
  try { sh("xcrun", ["simctl", "terminate", d.watch, WATCH_APP]); } catch { /* not running */ }
  sh("xcrun", ["simctl", "launch", d.watch, WATCH_APP, "--with-timer"]);
  await sleep(2500);
  const pm = join(WORK, "remote.mark");
  rmSync(pm, { force: true });
  const rw = await startRecording(d.watch, "garden");
  const rp = await startRecording(d.phone, "remote");
  await test("P", d.phone, "testRemote", pm);
  await sleep(500);
  await rp.stop();
  await rw.stop();
  const m = markTime(pm);
  cut(rp.raw, "phone-remote", m - rp.t0 + 0.2, 5.5);
  cut(rw.raw, "watch-garden", m - rw.t0 + 0.2, 5.5);
}

const BEATS = {
  bubbles: (d) => watchBeat(d, "bubbles", "testBubbles", 4.5),
  animals: (d) => watchBeat(d, "animals", "testAnimals", 4.5),
  swipe: (d) => watchBeat(d, "swipe", "testSwipe", 5.5),
  crown: (d) => watchBeat(d, "crown", "testCrown", 3),
  shield: (d) => watchBeat(d, "shield", "testShield", 9),
  moon,
  remote,
};

const d = devices();
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BEATS);
if (want.includes("install")) install(d);
for (const b of want.filter((w) => w !== "install")) {
  if (!BEATS[b]) throw new Error(`unknown beat ${b}: ${Object.keys(BEATS).join(" ")}`);
  await BEATS[b](d);
}
