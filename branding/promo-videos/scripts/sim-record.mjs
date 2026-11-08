// Records an iOS simulator screen while ios-uidriver runs a step script against an installed app, and
// writes rec-<name>.mp4 + rec-<name>.events.json ({ step, t, type, label, box } in the clip's pixels and
// seconds) for the edit's camera, spotlight and labels (skill heji-demo-video). Shared by the demo recorders.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = "/Volumes/proj/scratch/heji-video/uidriver-build";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], ...opts })?.toString() ?? "";

export const booted = () => {
  const j = JSON.parse(sh("xcrun", ["simctl", "list", "devices", "booted", "-j"]));
  const d = Object.values(j.devices).flat().find((x) => x.state === "Booted" && /iPhone/.test(x.name));
  if (!d) throw new Error("no booted iPhone simulator");
  return d.udid;
};

/** Builds the driver once (into the scratch disk) and returns its .xctestrun. */
export function driver() {
  const products = join(BUILD, "dd/Build/Products");
  const find = () => existsSync(products) && readdirSync(products).find((f) => f.endsWith(".xctestrun"));
  if (!find()) {
    mkdirSync(BUILD, { recursive: true });
    sh("rsync", ["-a", `${HERE}/ios-uidriver/`, `${BUILD}/`]);
    sh("xcodegen", ["generate", "-q"], { cwd: BUILD });
    sh("xcodebuild", ["build-for-testing", "-project", "UIDriver.xcodeproj", "-scheme", "Driver", "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", "dd", "-quiet"], { cwd: BUILD });
  }
  return join(products, find());
}

export function statusBar(udid, time, battery = 100) {
  sh("xcrun", ["simctl", "status_bar", udid, "override", "--time", time, "--batteryState", "charged", "--batteryLevel", String(battery), "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
}

/** Pts (s) of the first frame whose status bar differs from the first frame's: the sync flash. */
function syncPts(raw, h) {
  const out = sh("ffmpeg", ["-v", "error", "-i", raw, "-vf", `crop=iw:${Math.round(h * 0.045)}:0:0`, "-f", "framemd5", "-"]);
  const rows = out.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(",").map((x) => x.trim()));
  // rows: stream, dts, pts, duration, size, hash (time base 1/fps-ish: use ffprobe times instead)
  const times = sh("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", raw]).trim().split("\n").map(Number);
  const first = rows[0]?.[5];
  const i = rows.findIndex((r) => r[5] !== first);
  return i > 0 ? times[i] : null;
}

/**
 * Runs `steps` against `bundle` while recording. Returns the event log. The clip starts `lead` seconds
 * before the first step whose `step` id is set (or the first action) and ends `tail` seconds after the last.
 */
export async function recordSim({ name, out, work, bundle, steps, time = "9:41", udid = booted(), lead = 0.6, tail = 1.2 }) {
  mkdirSync(work, { recursive: true });
  const xctestrun = driver();
  // The driver runs inside the simulator, which may not read the external data disk (macOS asks for
  // removable-volume access and the test hangs): hand it its script and log through /tmp.
  const io = "/tmp/heji-uidriver";
  mkdirSync(io, { recursive: true });
  const script = join(io, `${name}.script.json`), log = join(io, `${name}.log.json`), raw = join(work, `${name}-raw.mp4`);
  rmSync(log, { force: true });
  writeFileSync(script, JSON.stringify({ bundle, steps }));
  const rec = spawn("xcrun", ["simctl", "io", udid, "recordVideo", "--codec=h264", "--force", raw], { stdio: ["ignore", "pipe", "pipe"] });
  const t0 = await new Promise((res, rej) => {
    let err = "";
    const timer = setTimeout(() => rej(new Error(`recordVideo didn't start: ${err.trim()} (a stuck recording? reboot the simulator)`)), 20_000);
    rec.stderr.on("data", (d) => { err += d; if (/Recording started/.test(d)) { clearTimeout(timer); res(Date.now() / 1000); } });
  });
  // Sync flash: the status bar's battery goes 99 → 100 at a known wall time; that frame anchors the clock
  // (recordVideo's first frame comes a variable moment after "Recording started").
  await sleep(800);
  const a = Date.now() / 1000;
  statusBar(udid, time, 99);
  const tSync = (a + Date.now() / 1000) / 2; // the first status-bar change in the clip
  await sleep(800);
  statusBar(udid, time, 100);
  await sleep(400);
  try {
    sh("xcodebuild", ["test-without-building", "-xctestrun", xctestrun, "-destination", `id=${udid}`, "-quiet"], {
      env: { ...process.env, TEST_RUNNER_DRIVER_SCRIPT: script, TEST_RUNNER_DRIVER_LOG: log },
    });
  } catch (e) {
    console.error(`${name}: driver failed`, existsSync(log) ? readFileSync(log, "utf8").slice(-800) : "");
    rec.kill("SIGINT");
    throw e;
  }
  await sleep(tail * 1000 + 200);
  const t1 = Date.now() / 1000;
  rec.kill("SIGINT");
  await new Promise((r) => rec.on("exit", r));
  const doc = JSON.parse(readFileSync(log, "utf8"));
  const [W, H] = sh("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", raw]).trim().split(",").map(Number);
  const k = W / doc.screen.w;
  // Wall time → raw pts: pts = wall - t0 + off, from the sync flash.
  const sp = syncPts(raw, H);
  const off = sp === null ? 0 : sp - (tSync - t0) - 0.05;
  if (sp === null) console.warn(`${name}: no sync flash found; times may be off`);
  // A touch lands just before its call returns (XCUITest first waits for the app to idle, then synthesizes it).
  for (const e of doc.events) { if (e.t2) e.t = Math.max(e.t, e.t2 - 0.25); e.t += off; }
  const tEnd = t1 + off;
  const first = doc.events.find((e) => e.step) ?? doc.events[0];
  const start = Math.max(0, first.t - t0 - lead), dur = tEnd - t0 - start;
  const events = doc.events.filter((e) => e.step).map((e) => {
    const box = e.box ? { x: Math.round(e.box.x * k), y: Math.round(e.box.y * k), w: Math.round(e.box.w * k), h: Math.round(e.box.h * k) } : null;
    return { step: e.step, t: +(e.t - t0 - start).toFixed(2), type: e.type, label: e.label, box, x: box ? box.x + box.w / 2 : null, y: box ? box.y + box.h / 2 : null };
  });
  // recordVideo writes frames only when the screen changes: resample at 30 fps from the timestamps,
  // hold the last frame to the wall-clock end, then trim to [start, end].
  sh("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", `tpad=stop_mode=clone:stop_duration=${Math.ceil(tEnd - t0) + 2},fps=30,trim=start=${start.toFixed(3)}:duration=${dur.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p`,
    "-an", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(out, `rec-${name}.mp4`)]);
  const meta = { clip: `rec-${name}.mp4`, width: W, height: H, duration: +dur.toFixed(2), scale: k, events };
  writeFileSync(join(out, `rec-${name}.events.json`), JSON.stringify(meta, null, 1));
  console.log(`rec-${name}.mp4: ${meta.duration} s, ${events.length} events`);
  return meta;
}

/** Runs `cmd` (a shell command) when the driver reaches a `{ do: "signal", text: name }` step. */
export function onSignal(name, cmd) {
  const f = `/tmp/heji-uidriver/${name}.signal`;
  rmSync(f, { force: true });
  spawn("sh", ["-c", `while [ ! -f ${f} ]; do sleep 0.1; done; rm -f ${f}; ${cmd}`], { stdio: "ignore", detached: true }).unref();
}

/** A still of the current screen (device pixels). */
export function still(udid, file) { sh("xcrun", ["simctl", "io", udid, "screenshot", "--type=png", file]); }
