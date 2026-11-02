#!/usr/bin/env node
// Screen recordings for the fitloop-launch promo, from the LOCAL stack only (never production): the
// seed athlete (athlete@example.com), with "the agent" played by this script calling FitLoop's MCP on
// the local Worker with the seed's local agent token. Run from the repo root:
//
//   supabase start; npm run dev:worker -w @fitloop/web          (Worker on 127.0.0.1:8794)
//   node branding/promo-videos/scripts/fitloop-launch-record.mjs stage     back up the fitloop rows, clean the
//                                       athlete's notes and check-ins, the agent publishes the promo plan
//   node … glasses   rec-glasses-set, rec-glasses-rest, rec-glasses-hurts (plugin + Even Hub simulator;
//                    the last one sends "It hurts" on the reverse lunge for real, to the local Worker)
//   node … agent     the agent reads the note, replies and publishes tomorrow's plan with step-ups
//   node … phone     rec-phone-reply, rec-phone-today (booted iPhone simulator, FitLoop installed)
//   node … restore   every fitloop row back as it was before `stage`
//
// Weights, meals, heart rate and the agent's words are demo data, and the video says so.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/fitloop-launch";
const WORK = join(tmpdir(), "fitloop-launch-record");
mkdirSync(WORK, { recursive: true });
const site = "http://127.0.0.1:8794", supabase = "http://127.0.0.1:55421", sim = "http://127.0.0.1:9901";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const AGENT = "fla_dev_local_token"; // the seed's local agent token (projects/fitloop/CLAUDE.md)
const ATHLETE = "00000000-0000-4000-8000-0000000f1700";
const TODAY = "2026-11-02", TOMORROW = "2026-11-03"; // a Monday and a Tuesday
const DB = "supabase_db_waypack"; // the shared local stack's Postgres container
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], ...opts }).toString();
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });

const token = async () =>
  (await (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "athlete@example.com", password: "fitloop-dev" }) })).json()).access_token;
// wrangler dev sometimes drops a request ("Network connection lost"): retry a couple of times.
const api = async (tok, path, init = {}) => {
  for (let i = 0; ; i++) {
    const text = await (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).text();
    try { return JSON.parse(text); } catch (e) { if (i >= 2) throw new Error(`${path}: ${text.slice(0, 120)}`); await sleep(500); }
  }
};

let rpcId = 0;
async function mcp(name, args = {}) {
  const res = await fetch(`${site}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${AGENT}` }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }) });
  const body = await res.json();
  const text = body.result?.content?.[0]?.text ?? JSON.stringify(body);
  if (body.error || body.result?.isError) throw new Error(`${name}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// The promo plan: today's lower-body session (goblet squat, then reverse lunges); `swapped` puts
// step-ups where the lunges were, as the agent does after her note.
function promoPlan(base, startsOn, swapped) {
  const ex = (o) => ({ rest_sec: 60, ...o });
  const lunge = ex({ id: "reverse-lunge", name: "Reverse lunge", sets: 3, reps: 8, load: "2 x 10 kg", cues: ["Long step back", "Front knee over the foot", "Drive up through the front heel"] });
  const stepUp = ex({ id: "step-up", name: "Step-up", sets: 3, reps: 8, load: "2 x 8 kg", cues: ["Whole foot on the box", "Drive through the top heel", "Lower slowly"] });
  const lower = {
    title: "Lower body",
    workouts: [{
      id: "lower-body", title: "Lower body", time: "07:00", duration_min: 40, kind: "strength",
      exercises: [
        ex({ id: "goblet-squat", name: "Goblet squat", sets: 4, reps: 10, load: "16 kg", rest_sec: 60, cues: ["Bell at chest, elbows in", "Sit between the hips", "Knees track over toes"] }),
        swapped ? stepUp : lunge,
        ex({ id: "db-row", name: "One-arm dumbbell row", sets: 3, reps: 10, load: "14 kg", cues: ["Flat back, hand on bench", "Pull elbow to hip"] }),
        ex({ id: "plank", name: "Plank", sets: 3, duration_sec: 40, rest_sec: 45, cues: ["Ribs down, squeeze glutes"] }),
      ],
    }],
    meals: base.week.mon.meals,
  };
  return { ...base, title: "Strength, mornings (demo)", summary: "Four 40-minute morning strength sessions a week at the gym, meals around 2,000 kcal.", starts_on: startsOn, constraints: ["40 minutes before work", "Gym with dumbbells and boxes"], overrides: undefined, week: { ...base.week, mon: lower, tue: lower, thu: lower } };
}

async function stage() {
  const backup = join(WORK, "fitloop-backup.sql");
  if (!existsSync(backup)) {
    writeFileSync(backup, sh("docker", ["exec", DB, "pg_dump", "-U", "postgres", "--data-only", "--schema=fitloop"]));
    console.log(`backed up the fitloop rows to ${backup}`);
  }
  sql(`delete from fitloop.feedback where user_id='${ATHLETE}'; delete from fitloop.checkins where user_id='${ATHLETE}' and date >= '${TODAY}';`);
  const base = (await mcp("get_current_plan")).current.plan;
  const v = await mcp("publish_plan", { plan: promoPlan(base, TODAY, false), change_note: "Mornings now: four 40-minute strength sessions before work." });
  console.log("published", JSON.stringify(v).slice(0, 160));
}

async function restore() {
  const backup = join(WORK, "fitloop-backup.sql");
  if (!existsSync(backup)) throw new Error("no backup: run stage first");
  const tables = sql(`select string_agg('fitloop.'||quote_ident(table_name), ', ') from information_schema.tables where table_schema='fitloop' and table_type='BASE TABLE';`).trim();
  sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: `begin; set session_replication_role = replica; truncate ${tables};\n${(await import("node:fs")).readFileSync(backup, "utf8")}\ncommit;` });
  console.log("restored the fitloop rows from", backup);
}

/** Keeps a live heart rate fresh, as the iPhone does while the Watch runs a workout. */
function heartRate(tok) {
  let on = true, i = 0;
  const bpm = [118, 122, 127, 131, 134, 132, 129, 126];
  (async () => { while (on) { await api(tok, "/api/live", { method: "PUT", body: JSON.stringify({ hr: bpm[i++ % bpm.length], workout_ref: "lower-body" }) }); await sleep(3000); } })();
  return () => { on = false; };
}

/** Polls the simulator's screenshot API (~12 fps; alpha = the lit pixels) while sending R1 gestures,
 * then joins the frames into a G2-green-on-black 1728×864 MP4. */
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
    if (action !== "wait") await input(action, 0);
    await sleep(ms);
  }
  on = false;
  await grab;
  let list = "";
  frames.forEach(([f, t], i) => (list += `file '${f}'\nduration ${((frames[i + 1]?.[1] ?? t + 80) - t) / 1000}\n`));
  writeFileSync(join(dir, "list.txt"), list + `file '${frames.at(-1)[0]}'\n`);
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf",
    "format=rgba,alphaextract,scale=1728:864:flags=lanczos,format=rgb24,colorchannelmixer=rr=0.239:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bb=0.478,fps=30,format=yuv420p",
    "-c:v", "libx264", "-crf", "16", join(OUT, `rec-${name}.mp4`)]);
  console.log(`rec-${name}.mp4: ${frames.length} frames`);
}
const input = async (action, wait = 1200) => {
  await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  await sleep(wait);
};

async function glasses() {
  const tok = await token();
  const code = (await api(tok, "/api/pairing-code", { method: "POST" })).code;
  const dir = "projects/fitloop/apps/glasses";
  const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5179"], { cwd: dir, stdio: "ignore" });
  await sleep(4000);
  const simProc = spawn("npx", ["evenhub-simulator", `http://127.0.0.1:5179/?api=${site}&pair=${code}&date=${TODAY}`, "--automation-port", "9901", "--no-glow"], { cwd: dir, stdio: "ignore" });
  const stopHr = heartRate(tok);
  try {
    for (let i = 0; i < 30 && !(await fetch(`${sim}/api/ping`).then((r) => r.ok, () => false)); i++) await sleep(1000);
    await sleep(10_000); // pairing and the first day
    await recordGlasses("glasses-today", [["wait", 2000]]); // spare: today's list, the 07:00 workout first
    await input("click", 2500); // open the workout: goblet squat, set 1 of 4
    await recordGlasses("glasses-set", [["wait", 3500]]);
    await recordGlasses("glasses-rest", [["wait", 600], ["click", 4200]]); // set done: the rest timer starts itself
    await input("down", 1500); // next exercise: reverse lunge
    await recordGlasses("glasses-hurts", [["wait", 900], ["long_press", 1100], ["down", 700], ["down", 700], ["down", 700], ["down", 900], ["click", 2600]]);
  } finally {
    stopHr();
    simProc.kill();
    vite.kill();
    try { sh("pkill", ["-f", "evenhub-simulator.*9901"]); } catch { /* gone */ }
  }
}

async function agent() {
  const open = await mcp("get_feedback", { status: "open" });
  const list = Array.isArray(open) ? open : open.feedback ?? open.items ?? [];
  const note = list.find((f) => (f.ref ?? "").includes("reverse-lunge")) ?? list[0];
  if (!note) throw new Error(`no open note: ${JSON.stringify(open).slice(0, 300)}`);
  await mcp("respond_to_feedback", { id: note.id, reply: "Thanks for telling me. From tomorrow, step-ups replace the reverse lunges: same work, easier on the knee. Stop if it still hurts." });
  const base = (await mcp("get_current_plan")).current.plan;
  await mcp("publish_plan", { plan: promoPlan(base, TOMORROW, true), change_note: "Step-ups instead of reverse lunges, after your knee note." });
  console.log("replied to", note.id, "and published tomorrow's plan");
}

/** The app on the booted simulator: the reply to her note, and tomorrow's day. */
async function phone() {
  const dev = "booted", app = "com.hejitech.fitloop";
  sh("xcrun", ["simctl", "ui", dev, "appearance", "dark"]);
  sh("xcrun", ["simctl", "status_bar", dev, "override", "--time", "7:42", "--batteryState", "charged", "--batteryLevel", "100", "--cellularBars", "4", "--wifiBars", "3", "--dataNetwork", "wifi"]);
  for (const s of [{ name: "phone-reply", args: ["-screen", "feedback", "-date", TODAY], ms: 4000 }, { name: "phone-today", args: ["-screen", "today", "-date", TOMORROW], ms: 4000 }]) {
    try { sh("xcrun", ["simctl", "terminate", dev, app]); } catch { /* not running */ }
    sh("xcrun", ["simctl", "launch", dev, app, "-autoSignIn", "-noHealth", ...s.args]);
    await sleep(9000);
    const raw = join(WORK, `${s.name}-raw.mp4`);
    const rec = spawn("xcrun", ["simctl", "io", dev, "recordVideo", "--codec=h264", "--force", raw], { stdio: "ignore" });
    await sleep(s.ms);
    rec.kill("SIGINT");
    await new Promise((r) => rec.on("exit", r));
    // recordVideo only writes frames when the screen changes, so a still screen gives a fraction of a
    // second: keep its last frame (a still for posts) and make a steady 4 s clip of it for the edit.
    const still = join(OUT, `still-${s.name}.png`);
    sh("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.1", "-i", raw, "-frames:v", "1", "-update", "1", still]);
    sh("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", still, "-t", "4", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-an", join(OUT, `rec-${s.name}.mp4`)]);
    console.log(`rec-${s.name}.mp4, still-${s.name}.png`);
  }
  sh("xcrun", ["simctl", "status_bar", dev, "clear"]);
}

const cmd = process.argv[2];
const run = { stage, restore, glasses, agent, phone }[cmd];
if (!run) {
  console.error("usage: fitloop-launch-record.mjs stage | glasses | agent | phone | restore");
  process.exit(1);
}
await run();
