#!/usr/bin/env node
// Screen recordings for the toddlercam-launch promo: ToddlerCam on a paired iPhone + Watch SIMULATOR
// only, never the real cameras (they would film real people). Run from the repo root with the Debug
// apps built for the simulator (TODDLERCAM_BUILD, default projects/toddlercam/build/Build/Products from
// `xcodebuild … -derivedDataPath projects/toddlercam/build`), an iPhone simulator booted with its paired,
// booted watch, and the UI-test driver built (TODDLERCAM_DRIVER: the xcodebuild -derivedDataPath of the
// small XCUITest project the driver step makes; see `driver` below):
//
//   node branding/promo-videos/scripts/toddlercam-launch-record.mjs feeds   the camera frames, from the Flow shots
//   node … shot <name>     one screenshot of the phone, for checking framing
//   node … dual | snap | lock | keepsake     the recordings (snap: rec-watch-snap + rec-phone-snap) (rec-<name>.mp4 in public/toddlercam-launch)
//   node … restore         the apps off both simulators, status bar cleared
//
// How the app sees Milo: on a simulator, ToddlerCam reads its two "cameras" as JPEGs from
// http://127.0.0.1:8089/front and /rear (projects/toddlercam/KidsCam/Camera/SimulatorCameraStreamer.swift)
// and runs its face tracking on the front one. This script serves frames cut from the owner's Flow shots
// there, so the real app shows the same AI-generated Milo and Nora as the story. Everything on screen is
// the app's own UI; taps come from XCUITest (the driver), the way a finger would.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, globSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/toddlercam-launch";
const WORK = join(tmpdir(), "toddlercam-launch-record");
mkdirSync(WORK, { recursive: true });
const APP = "com.hejitech.kidscam", WATCH_APP = "com.hejitech.kidscam.watchkitapp";
const BUILD = process.env.TODDLERCAM_BUILD ?? "projects/toddlercam/build/Build/Products";
const DRIVER = process.env.TODDLERCAM_DRIVER; // derivedData of the XCUITest driver project
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], ...opts }).toString();
const shot = (n) => globSync(`${OUT}/shot-${n}_*.mp4`)[0];

// ---------------------------------------------------------------- the camera feeds
// [scene]: [Flow shot, start s, length s, crop w:h:x:y in the 1920×1080 shot]. Milo's feeds have the
// iPhone screen's shape (0.46), so the app shows them uncropped and its face tracking lines up with the
// picture; the bubble shows their 3:4 middle.
const SCENES = {
  "milo-garden": [3, 4.4, 2.3, "497:1080:636:0"], // smiling at his own camera in the garden
  "milo-laugh": [7, 5.0, 1.3, "497:1080:400:0"], // laughing in the garden (rec-dual, rec-keepsake)
  "milo-surprise": [5, 2.1, 2.2, "497:1080:690:0"], // looks up surprised, then laughs: the quack (living room)
  "milo-giggle": [5, 4.2, 2.8, "497:1080:690:0"], // giggling while he taps (living room)
  "nora-garden": [7, 0.5, 1.7, "496:1080:1100:0"], // Nora kneeling in the garden
  "nora-room": [2, 6.0, 1.9, "496:1080:880:0"], // Nora in the living room
};
const FEED_FPS = 24;

function feeds() {
  for (const [name, [n, ss, t, crop]] of Object.entries(SCENES)) {
    const dir = join(WORK, "feeds", name);
    mkdirSync(dir, { recursive: true });
    sh("ffmpeg", ["-v", "error", "-y", "-ss", String(ss), "-t", String(t), "-i", shot(n), "-vf", `crop=${crop},fps=${FEED_FPS},scale=-2:1280`, "-q:v", "3", join(dir, "%04d.jpg")]);
    console.log(`${name}: ${readdirSync(dir).length} frames`);
  }
}

/** Serves the current scene of each camera; scenes play forward and back (no jump at the loop). */
function serve() {
  const frames = Object.fromEntries(Object.keys(SCENES).map((s) => {
    const dir = join(WORK, "feeds", s);
    return [s, readdirSync(dir).sort().map((f) => readFileSync(join(dir, f)))];
  }));
  const state = { front: { scene: "milo-garden", t0: Date.now(), once: false }, rear: { scene: "nora-garden", t0: Date.now(), once: false } };
  const server = createServer((req, res) => {
    if (req.url === "/gate") { // the driver's screenshot of the grown-ups gate
      const parts = [];
      req.on("data", (b) => parts.push(b));
      req.on("end", () => { writeFileSync(join(WORK, "gate.png"), Buffer.concat(parts)); res.end("ok"); });
      return;
    }
    if (req.url === "/answer") { res.end(state.answer ?? ""); return; } // the gate's answer, for the driver
    if (req.url.startsWith("/cue?")) { // from the driver's tests: what the cameras see next
      const q = new URLSearchParams(req.url.slice(5));
      for (const cam of ["front", "rear"]) if (q.get(cam)) set(cam, q.get(cam), q.get("once") === "1");
      res.end("ok");
      return;
    }
    const cam = req.url.startsWith("/front") ? "front" : "rear";
    const s = state[cam], list = frames[s.scene];
    const i = Math.floor(((Date.now() - s.t0) / 1000) * FEED_FPS);
    const n = list.length, k = s.once ? Math.min(i, n - 1) : i % (2 * n - 2);
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store" });
    res.end(list[k < n ? k : 2 * n - 2 - k]);
  }).listen(8089, "127.0.0.1");
  const set = (cam, scene, once = false) => { state[cam] = { scene, t0: Date.now(), once }; };
  const answer = (a) => { state.answer = a; };
  return { set, answer, close: () => { server.closeAllConnections(); server.close(); } };
}

// ---------------------------------------------------------------- simulators
function devices() {
  const pairs = JSON.parse(sh("xcrun", ["simctl", "list", "pairs", "-j"])).pairs;
  const pair = Object.values(pairs).find((p) => p.phone.state === "Booted" && p.watch.state === "Booted");
  if (!pair) throw new Error("boot an iPhone simulator and its paired watch first (xcrun simctl pair / boot)");
  return { phone: pair.phone.udid, watch: pair.watch.udid };
}

function install({ phone, watch }) {
  for (const [d, a] of [[phone, APP], [watch, WATCH_APP]]) try { sh("xcrun", ["simctl", "uninstall", d, a]); } catch { /* not installed */ }
  sh("xcrun", ["simctl", "install", phone, join(BUILD, "Debug-iphonesimulator/ToddlerCam.app")]);
  sh("xcrun", ["simctl", "install", watch, join(BUILD, "Debug-watchsimulator/ToddlerCamWatch.app")]);
  for (const p of ["camera", "photos", "photos-add"]) sh("xcrun", ["simctl", "privacy", phone, "grant", p, APP]);
  sh("xcrun", ["simctl", "status_bar", phone, "override", "--time", "9:41", "--batteryState", "discharging", "--batteryLevel", "82", "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
  sh("xcrun", ["simctl", "ui", phone, "appearance", "light"]);
}

const launch = (d, app, args = []) => {
  try { sh("xcrun", ["simctl", "terminate", d, app]); } catch { /* not running */ }
  sh("xcrun", ["simctl", "launch", d, app, ...args]);
};

/** Records a simulator's screen while `during` runs (at least `ms`), as a 30 fps H.264 MP4. */
async function record(device, name, ms, during = async () => {}) {
  const raw = join(WORK, `${name}-raw.mp4`);
  const rec = spawn("xcrun", ["simctl", "io", device, "recordVideo", "--codec=h264", "--force", raw], { stdio: "ignore" });
  const stopped = new Promise((r) => rec.on("exit", r));
  await sleep(1200);
  const t = Date.now();
  await during();
  await sleep(Math.max(0, ms - (Date.now() - t)));
  const total = (Date.now() - t + 1200) / 1000;
  rec.kill("SIGINT");
  await stopped;
  // simctl writes frames only when the screen changes: hold the last one to the full length
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", `tpad=stop_mode=clone:stop_duration=${total},fps=30,format=yuv420p`, "-t", String(total), "-c:v", "libx264", "-crf", "14", "-an", join(OUT, `rec-${name}.mp4`)]);
  console.log(`rec-${name}.mp4 (${total.toFixed(1)} s); the action starts 1.2 s in`);
}

/** Runs one XCUITest of the driver (scratch project: a test per gesture, driving the apps by bundle id).
 * Async, so the feed server keeps answering the app while a test runs. */
const tapAsync = (platform, test) => new Promise((resolve, reject) => {
  if (!DRIVER) throw new Error("set TODDLERCAM_DRIVER to the driver's derivedData path");
  const d = devices();
  const scheme = platform === "watch" ? "DriverWatch" : "DriverPhone";
  const xctestrun = globSync(`${DRIVER}/Build/Products/${scheme}_*.xctestrun`)[0];
  const p = spawn("xcodebuild", ["test-without-building", "-xctestrun", xctestrun, "-destination", `id=${platform === "watch" ? d.watch : d.phone}`, `-only-testing:${scheme}UITests/Driver/${test}`], { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  p.stdout.on("data", (b) => (log += b)); p.stderr.on("data", (b) => (log += b));
  p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`${test} failed (${c}):\n${log.split("\n").filter((l) => /error|fail/i.test(l)).slice(0, 8).join("\n")}`))));
});

async function start(d) {
  install(d);
  launch(d.phone, APP);
  await sleep(5000);
  launch(d.watch, WATCH_APP);
  await sleep(4000);
  await tapAsync("watch", "testLion"); // the lion mask, picked on the watch as a parent would
  await sleep(1000);
}

// ---------------------------------------------------------------- the beats
const cmd = process.argv[2];
if (cmd === "feeds") { feeds(); process.exit(0); }
if (cmd === "restore") {
  const d = devices();
  for (const [dev, a] of [[d.phone, APP], [d.watch, WATCH_APP]]) try { sh("xcrun", ["simctl", "uninstall", dev, a]); } catch { /* gone */ }
  sh("xcrun", ["simctl", "status_bar", d.phone, "clear"]);
  console.log("restored: ToddlerCam off both simulators");
  process.exit(0);
}

const feed = serve();
const d = devices();
try {
  if (cmd === "shot") {
    await start(d);
    sh("xcrun", ["simctl", "io", d.phone, "screenshot", join(WORK, `${process.argv[3] ?? "check"}-phone.png`)]);
    sh("xcrun", ["simctl", "io", d.watch, "screenshot", join(WORK, `${process.argv[3] ?? "check"}-watch.png`)]);
    console.log(`screenshots in ${WORK}`);
  } else if (cmd === "dual") {
    // the garden: Nora full screen (rear), Milo in the bubble (front); a tap on the bubble swaps them.
    // (shot 3's Milo holds his phone up to the lens, which a selfie camera wouldn't see: shot 7's laugh)
    feed.set("rear", "nora-garden"); feed.set("front", "milo-laugh");
    await start(d);
    await record(d.phone, "dual", 4000, async () => { await sleep(2500); await tapAsync("phone", "testTapBubble"); await sleep(4000); });
  } else if (cmd === "snap") {
    // the watch: Quack (the phone quacks, Milo looks up laughing), the shutter from the wrist, the
    // last photo on the watch; the phone recorded at the same time
    feed.set("rear", "nora-garden"); feed.set("front", "milo-garden");
    await start(d);
    await tapAsync("phone", "testTapBubble"); // Milo full screen
    const both = tapAsync("watch", "testSnap");
    await Promise.all([record(d.watch, "watch-snap", 3000, () => both), record(d.phone, "phone-snap", 3000, () => both)]);
  } else if (cmd === "lock") {
    feed.set("rear", "nora-room"); feed.set("front", "milo-giggle");
    await start(d);
    await tapAsync("phone", "testTapBubble");
    await record(d.phone, "lock", 2000, async () => { await tapAsync("phone", "testLockAndTap"); });
  } else if (cmd === "keepsake") {
    feed.set("rear", "nora-garden"); feed.set("front", "milo-laugh", true);
    await start(d);
    await tapAsync("phone", "testTapBubble");
    await sleep(2500);
    await tapAsync("phone", "testShutter");
    // the gallery is behind the grown-ups gate: read its multiplication off the screen (macOS Vision,
    // OCR binary from TODDLERCAM_OCR = swiftc toddlercam-launch-driver/ocr.swift) and type the answer
    await record(d.phone, "keepsake", 2000, async () => {
      await tapAsync("phone", "testOpenGate");
      const png = join(WORK, "gate.png"); // posted by the test
      const m = sh(process.env.TODDLERCAM_OCR, [png]).match(/(\d)\s*[x×X]\s*(\d)/);
      if (!m) throw new Error("couldn't read the gate's question");
      feed.answer(String(+m[1] * +m[2]));
      await tapAsync("phone", "testTypeAnswer");
    });
  } else {
    console.error("usage: toddlercam-launch-record.mjs feeds | shot [name] | dual | snap | lock | keepsake | restore");
    process.exitCode = 1;
  }
} finally {
  feed.close();
  process.exit(); // the app keeps polling the feed
}
