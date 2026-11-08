#!/usr/bin/env node
// Recordings for the FitLoop walkthrough (reports/2026-11-02-fitloop-demo-video, skill heji-demo-video), from
// the LOCAL stack only (never production): the seed athlete (athlete@example.com) with a demo profile, and a
// REAL agent: Claude Code, connected over OAuth to the local MCP server, builds and publishes the plan, then
// later reads the athlete's in-workout note, replies and changes the plan. The iPhone app is driven on the
// booted simulator by ios-uidriver (XCUITest), the plugin in the Even Hub simulator. Every clip gets an event
// log (rec-<name>.events.json). Run from the repo root, in this order:
//
//   supabase start; npm run dev:worker -w @fitloop/web                (Worker on 127.0.0.1:8794)
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs stage    back up the fitloop rows; demo profile, no plan,
//                                     no check-ins or notes; disconnect agents
//   node … connect     rec-1-connect: web Settings, the MCP URL, Copy URL
//   node … agent1      the live run: /mcp sign-in (+ rec-1-consent), "set up my plan" → agent-run-1.json
//   node … phone1      rec-1-today: the plan the agent just published, on the phone
//   node … workout     rec-2-workout: open the workout, the demo animation and cues, a set done, the rest timer
//   node … pair        rec-3-pair: Settings → Pair glasses → Get a pairing code
//   node … glasses     rec-3-glasses (+ -phone): paired, today, a set by tap, rest; hold → It hurts
//   node … meal        rec-4-meal: a meal checked off (Other → swapped) on Today
//   node … agent2      the second run: "I left a note…" → reply + new plan → agent-run-2.json
//   node … phone2      rec-4-reply (Feedback: the note and the reply) + rec-4-next (the changed workout)
//   node … term        rec-1-terminal, rec-1-connected, rec-1-agent, rec-4-agent (the runs replayed)
//   node … restore     every fitloop row back as it was before `stage`; the demo agent disconnected
//
// Weights, meals, heart rate and the agent's words are demo data, and the video says so.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glassesStill, launchEvenSim, moveTo, recordGlasses, recordWeb, REPO, replayTerm, runAgent, SCRATCH, scrollTo, sh, sleep, transcriptTools } from "./demo-record-lib.mjs";
import { booted, recordSim, statusBar, still } from "./sim-record.mjs";

const OUT = `${REPO}/branding/promo-videos/public/fitloop-demo`;
const WORK = `${SCRATCH}/fitloop-demo-work`;
const AGENT_DIR = `${SCRATCH}/fitloop-agent`;
mkdirSync(WORK, { recursive: true });
const site = "http://127.0.0.1:8794", supabase = "http://127.0.0.1:55421";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const ATHLETE = "00000000-0000-4000-8000-0000000f1700";
const DB = "supabase_db_waypack"; // the shared local stack's Postgres container
const APP = "com.hejitech.fitloop";
const STATUS_TIME = "7:02";
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const state = () => (existsSync(join(WORK, "state.json")) ? JSON.parse(readFileSync(join(WORK, "state.json"), "utf8")) : {});
const saveState = (s) => writeFileSync(join(WORK, "state.json"), JSON.stringify({ ...state(), ...s }, null, 1));

const signIn = async () =>
  (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "athlete@example.com", password: "fitloop-dev" }) })).json();
const api = async (tok, path, init = {}) => {
  for (let i = 0; ; i++) {
    const text = await (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).text();
    try { return JSON.parse(text); } catch { if (i >= 2) throw new Error(`${path}: ${text.slice(0, 120)}`); await sleep(500); }
  }
};

// The profile the agent reads (what FitLoop's Settings → About you holds): no injuries yet, so the knee
// note in chapter 4 is news to it.
const ABOUT = {
  goals: "Get stronger and leaner by spring; keep a routine I can stick to.",
  restrictions: "None.",
  equipment: "Gym with dumbbells, kettlebells, a bench and plyo boxes.",
  schedule: "Sunday, Monday, Wednesday and Friday mornings at 7:00, about 40 minutes.",
  diet: "Eats everything; about 2,000 kcal a day, high protein.",
  notes: "Two years of gym training; comfortable with dumbbell and kettlebell basics.",
};

async function stage() {
  const backup = join(WORK, "fitloop-backup.sql");
  if (!existsSync(backup)) {
    writeFileSync(backup, sh("docker", ["exec", DB, "pg_dump", "-U", "postgres", "--data-only", "--schema=fitloop"]));
    console.log(`backed up the fitloop rows to ${backup}`);
  }
  sql(`update fitloop.profiles set settings = jsonb_set(settings, '{about}', '${JSON.stringify(ABOUT).replace(/'/g, "''")}'::jsonb) where user_id='${ATHLETE}';
       delete from fitloop.feedback where user_id='${ATHLETE}'; delete from fitloop.checkins where user_id='${ATHLETE}';
       delete from fitloop.live where user_id='${ATHLETE}'; delete from fitloop.pairing_codes where user_id='${ATHLETE}';
       delete from fitloop.plans where user_id='${ATHLETE}';`);
  const tok = (await signIn()).access_token;
  for (const g of await api(tok, "/api/grants")) await api(tok, `/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE" });
  console.log("staged: demo profile, no plan, no check-ins or notes, no connected agents; today is", today());
}

async function restore() {
  const backup = join(WORK, "fitloop-backup.sql");
  if (!existsSync(backup)) throw new Error("no backup: run stage first");
  const tables = sql(`select string_agg('fitloop.'||quote_ident(table_name), ', ') from information_schema.tables where table_schema='fitloop' and table_type='BASE TABLE';`).trim();
  sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: `begin; set session_replication_role = replica; truncate ${tables};\n${readFileSync(backup, "utf8")}\ncommit;` });
  const tok = (await signIn()).access_token;
  for (const g of await api(tok, "/api/grants")) await api(tok, `/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE" });
  console.log("restored the fitloop rows from", backup, "and disconnected the demo agent");
}

// ---------- chapter 1: connect your agent, it builds the plan --------------------------------------------------------
async function connect() {
  const session = await signIn();
  await recordWeb({ name: "1-connect", out: OUT, work: WORK, session, origin: site, url: `${site}/settings/`, script: async (page, start, mark) => {
    const sec = page.getByRole("heading", { name: "Agents (MCP)" });
    await sec.waitFor();
    await scrollTo(page, sec, 230);
    await sleep(900);
    await start();
    await sleep(800);
    const url = page.locator("code.secret").filter({ hasText: "/mcp" }).first();
    await mark("1.1", url, "look", "Your MCP server");
    await sleep(1800);
    const copy = page.getByRole("button", { name: "Copy URL" });
    await moveTo(page, copy);
    await mark("1.1a", copy, "click", "Copy URL");
    await copy.click();
    await sleep(1800);
  } });
}

async function agent1() {
  await runAgent({ dir: AGENT_DIR, file: join(OUT, "agent-run-1.json"), steps: async ({ until, keys, typeOut, mark, screen, save }) => {
    mark("connect");
    await typeOut("/mcp", 120);
    await sleep(500); await keys("\r", 1500);
    await until(/fitloop/);
    for (let i = 0; i < 6 && !/❯ .*fitloop/.test(screen()); i++) await keys("\x1b[B", 400);
    await keys("\r", 1500);
    await until(/Authenticate/);
    mark("authenticate");
    await keys("\r", 1500);
    const t = Date.now();
    while (!existsSync(`${AGENT_DIR}/opened-urls.txt`) && Date.now() - t < 20_000) await sleep(250);
    const authUrl = readFileSync(`${AGENT_DIR}/opened-urls.txt`, "utf8").trim().split("\n").at(-1);
    mark("consent");
    const session = await signIn();
    await recordWeb({ name: "1-consent", out: OUT, work: WORK, session, script: async (page, start, mark2) => {
      await page.goto(authUrl, { waitUntil: "networkidle" });
      await sleep(600);
      await start();
      await sleep(1000);
      const allow = page.getByRole("button", { name: "Allow" });
      await mark2("1.2", page.locator("main").first(), "look", "What it may do");
      await sleep(2600);
      await scrollTo(page, allow, 420); await sleep(900);
      await moveTo(page, allow); await mark2("1.2a", allow, "click", "Allow"); await allow.click();
      await sleep(1600);
    } });
    await until(/Authentication successful|connected/i, 30_000);
    mark("connected");
    await sleep(2500);
    await keys("\x1b", 800);
    await sleep(800);
    mark("prompt");
    await typeOut("Set up my training plan in FitLoop, starting today.", 38);
    await sleep(700);
    await keys("\r", 1500);
    mark("run");
    let idle = 0, published = false;
    for (let i = 0; i < 60 * 40; i++) {
      await sleep(1000);
      if (!published && sql(`select count(*) from fitloop.plans where user_id='${ATHLETE}';`).trim() !== "0") { published = true; mark("published"); }
      const s = screen();
      if (/Do you want|❯ 1\. Yes/.test(s)) { await keys("\r", 800); mark("approved"); }
      const busy = /esc to interrupt/i.test(s);
      idle = !busy ? idle + 1 : 0;
      // Its questions (the interview) are answered by a person through <file>.keys (runAgent).
      if (published && idle >= 10) break;
      if (i % 30 === 0) { save(); console.log(`${i}s`, s.split("\n").filter((l) => l.trim()).slice(-3).join(" | ")); }
    }
    mark("done");
    await sleep(1500);
  } });
  const plan = JSON.parse(sql(`select plan::text from fitloop.plans where user_id='${ATHLETE}' order by version desc limit 1;`));
  writeFileSync(join(WORK, "plan-v1.json"), JSON.stringify(plan, null, 1));
  console.log("plan v1:", plan.title, Object.entries(plan.week).map(([d, v]) => `${d}:${v.workouts?.map((w) => w.title).join("+") || "-"}`).join(" "));
}

/** The first date from today whose day has a workout (YYYY-MM-DD). */
function workoutDay(plan, from = today()) {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  for (let i = 0; i < 8; i++) {
    const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + i);
    const key = days[d.getDay()];
    const iso = d.toLocaleDateString("en-CA");
    if (plan.week?.[key]?.workouts?.length && iso >= (plan.starts_on ?? from)) return iso;
  }
  throw new Error("no workout day in the next week");
}

// ---------- the phone (ios-uidriver on the booted simulator) --------------------------------------------------------
const phoneEnv = () => {
  const udid = booted();
  sh("xcrun", ["simctl", "ui", udid, "appearance", "dark"]);
  statusBar(udid, STATUS_TIME);
  return udid;
};
const launch = (date, extra = []) => ({ do: "launch", args: ["-autoSignIn", "-noHealth", "-date", date, ...extra] });

async function phone1() {
  const plan = JSON.parse(readFileSync(join(WORK, "plan-v1.json"), "utf8"));
  const date = workoutDay(plan);
  const note = sql(`select change_note from fitloop.plans where user_id='${ATHLETE}' order by version desc limit 1;`).trim();
  saveState({ day: date });
  const udid = phoneEnv();
  await recordSim({ name: "1-today", out: OUT, work: WORK, bundle: APP, udid, time: STATUS_TIME, steps: [
    launch(date, ["-screen", "today"]),
    { do: "wait", q: { type: "text", contains: " done" }, ms: 1200 },
    { step: "1.4", do: "mark", q: { type: "text", contains: note.slice(0, 24) }, label: "From your agent", ms: 2400 },
    { step: "1.4a", do: "mark", q: { type: "button", contains: " min · " }, label: "Today's workout", ms: 2600 },
  ] });
  still(udid, join(OUT, "still-1-today.png"));
}

async function workout() {
  const { day } = state();
  const udid = phoneEnv();
  const plan = JSON.parse(readFileSync(join(WORK, "plan-v1.json"), "utf8"));
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const w = plan.week[days[new Date(`${day}T12:00:00`).getDay()]].workouts[0];
  const first = w.exercises[0];
  saveState({ workout: w.title, ex1: first.name, ex2: w.exercises[1]?.name });
  sql(`delete from fitloop.checkins where user_id='${ATHLETE}';`);
  await recordSim({ name: "2-workout", out: OUT, work: WORK, bundle: APP, udid, time: STATUS_TIME, steps: [
    launch(day, ["-screen", "today"]),
    { do: "wait", q: { type: "button", contains: " min · " }, ms: 1500 },
    { step: "2.1", do: "tap", q: { type: "button", contains: " min · " }, label: w.title, ms: 2200 },
    { step: "2.2", do: "mark", q: { type: "text", label: first.name }, label: first.name, ms: 2600 },
    { step: "2.2a", do: "mark", q: { type: "text", label: first.cues?.[0] ?? "" }, label: "Your agent's cues", ms: 2600 },
    { step: "2.3", do: "tap", q: { type: "button", label: "Set done" }, label: "Set done", ms: 1200 },
    { step: "2.4", do: "mark", q: { type: "text", contains: "Rest " }, label: "Rest timer", ms: 3600 },
  ] });
  still(udid, join(OUT, "still-2-workout.png"));
}

async function pair() {
  const udid = phoneEnv();
  const { day } = state();
  await recordSim({ name: "3-pair", out: OUT, work: WORK, bundle: APP, udid, time: STATUS_TIME, steps: [
    launch(day, ["-screen", "settings"]),
    { do: "wait", q: { type: "text", label: "Settings" }, ms: 800 },
    { do: "scroll", dy: -520, ms: 500 },
    { do: "scroll", dy: -520, ms: 700 },
    { step: "3.1", do: "tap", q: { type: "button", label: "Pair glasses" }, label: "Pair glasses", ms: 1600 },
    { step: "3.1a", do: "tap", q: { type: "button", contains: "pairing code" }, label: "Get a pairing code", ms: 1800 },
    { step: "3.1b", do: "mark", q: { type: "text", contains: " " , index: 0 }, label: "", ms: 2600 },
  ] });
  // Codes are stored hashed (sha256 hex): find the 6 digits the phone shows.
  const hash = sql(`select code_hash from fitloop.pairing_codes where user_id='${ATHLETE}' and used_at is null order by created_at desc limit 1;`).trim();
  const { createHash } = await import("node:crypto");
  let code = "";
  for (let i = 0; i < 1_000_000 && !code; i++) { const c = String(i).padStart(6, "0"); if (createHash("sha256").update(c).digest("hex") === hash) code = c; }
  if (!code) throw new Error(`no pairing code for hash ${hash}`);
  saveState({ code });
  console.log("pairing code on the phone:", code);
}

async function glasses() {
  const { code, day } = state();
  const dir = `${REPO}/projects/fitloop/apps/glasses`;
  const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5179"], { cwd: dir, stdio: "ignore" });
  await sleep(4000);
  const { sim, stop } = await launchEvenSim({ url: `http://127.0.0.1:5179/?api=${site}&pair=${code}&date=${day}`, port: 9901, cwd: dir });
  const tok = (await signIn()).access_token;
  // While a workout runs, the Watch sends heart rate through the phone; here the recorder plays the phone.
  let on = true;
  (async () => { const bpm = [118, 122, 127, 131, 134, 132, 129, 126]; for (let i = 0; on; i++) { await api(tok, "/api/live", { method: "PUT", body: JSON.stringify({ hr: bpm[i % bpm.length], workout_ref: "x" }) }).catch(() => {}); await sleep(3000); } })();
  try {
    await sleep(9000); // pairing and the first day
    await glassesStill(sim, join(OUT, "still-3-today.png"));
    await recordGlasses({ sim, name: "3-glasses", out: OUT, work: WORK, steps: [
      ["wait", 2600],
      ["click", 3200, "Open the workout"],
      ["click", 4200, "Set done"],
      ["down", 2600, "Next exercise"],
      ["long_press", 2000, "Menu"],
      ["down", 650], ["down", 650], ["down", 650], ["down", 1300, "It hurts"],
      ["click", 3000, "Tell agent: It hurts"],
    ] });
  } finally {
    on = false;
    stop();
    vite.kill();
  }
}

async function meal() {
  const { day } = state();
  const udid = phoneEnv();
  sql(`delete from fitloop.checkins where user_id='${ATHLETE}' and kind='meal';`);
  await recordSim({ name: "4-meal", out: OUT, work: WORK, bundle: APP, udid, time: STATUS_TIME, steps: [
    launch(day, ["-screen", "today"]),
    { do: "wait", q: { type: "button", label: "Ate it" }, ms: 800 },
    { step: "4.1", do: "scroll", dy: -260, ms: 900 },
    { step: "4.2", do: "tap", q: { type: "button", label: "Ate it", index: 1 }, label: "Ate it", ms: 2600 },
  ] });
}

async function agent2() {
  await runAgent({ dir: AGENT_DIR, file: join(OUT, "agent-run-2.json"), steps: async ({ keys, typeOut, mark, screen, save }) => {
    const before = sql(`select count(*) from fitloop.plans where user_id='${ATHLETE}';`).trim();
    mark("prompt");
    await typeOut("I left a note in FitLoop during today's workout. Read it, answer me there, and adjust my plan.", 34);
    await sleep(700);
    await keys("\r", 1500);
    mark("run");
    let idle = 0, published = false, replied = false;
    for (let i = 0; i < 60 * 20; i++) {
      await sleep(1000);
      if (!replied && sql(`select count(*) from fitloop.feedback where user_id='${ATHLETE}' and agent_reply is not null;`).trim() !== "0") { replied = true; mark("replied"); }
      if (!published && sql(`select count(*) from fitloop.plans where user_id='${ATHLETE}';`).trim() !== before) { published = true; mark("published"); }
      const s = screen();
      if (/Do you want|❯ 1\. Yes/.test(s)) { await keys("\r", 800); mark("approved"); }
      idle = !/esc to interrupt/i.test(s) ? idle + 1 : 0;
      if (published && replied && idle >= 10) break;
      if (i % 30 === 0) { save(); console.log(`${i}s`, s.split("\n").filter((l) => l.trim()).slice(-3).join(" | ")); }
    }
    mark("done");
    await sleep(1500);
  } });
  const plan = JSON.parse(sql(`select plan::text from fitloop.plans where user_id='${ATHLETE}' order by version desc limit 1;`));
  writeFileSync(join(WORK, "plan-v2.json"), JSON.stringify(plan, null, 1));
}

async function phone2() {
  const udid = phoneEnv();
  const { day } = state();
  const v1 = JSON.parse(readFileSync(join(WORK, "plan-v1.json"), "utf8"));
  const v2 = JSON.parse(readFileSync(join(WORK, "plan-v2.json"), "utf8"));
  const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${day}T12:00:00`).getDay()];
  const names = (p) => p.week[key].workouts[0].exercises.map((e) => e.name);
  const swapped = names(v2).filter((n) => !names(v1).includes(n));
  saveState({ swapped });
  const reply = sql(`select agent_reply from fitloop.feedback where user_id='${ATHLETE}' order by created_at desc limit 1;`).trim();
  await recordSim({ name: "4-reply", out: OUT, work: WORK, bundle: APP, udid, time: STATUS_TIME, steps: [
    launch(day, ["-screen", "feedback"]),
    { do: "wait", q: { type: "text", label: "Feedback" }, ms: 1200 },
    { step: "4.3", do: "mark", q: { type: "text", label: "Pain or discomfort" }, label: "Your note", ms: 2600 },
    { step: "4.3a", do: "mark", q: { type: "text", contains: reply.slice(0, 24) }, label: "Your agent's reply", ms: 5200 },
  ] });
  still(udid, join(OUT, "still-4-reply.png"));
  await recordSim({ name: "4-next", out: OUT, work: WORK, bundle: APP, udid, time: STATUS_TIME, steps: [
    launch(day, ["-screen", "today"]),
    { do: "wait", q: { type: "button", contains: " min · " }, ms: 1000 },
    { step: "4.4", do: "mark", q: { type: "text", contains: "You flagged pain" }, label: "What changed", ms: 1800 },
    { step: "4.4a", do: "tap", q: { type: "button", contains: " min · " }, label: "Today's workout", ms: 1800 },
    ...swapped.map((n, i) => ({ step: `4.4${"bc"[i] ?? "d"}`, do: "mark", q: { type: "text", label: n }, label: "Swapped in", ms: 2200 })),
  ] });
  still(udid, join(OUT, "still-4-next.png"));
}

async function term() {
  const which = process.argv.slice(3);
  const r1 = join(OUT, "agent-run-1.json"), r2 = join(OUT, "agent-run-2.json");
  if (existsSync(r1) && (!which.length || which.includes("1"))) {
    const run = JSON.parse(readFileSync(r1, "utf8"));
    const at = (n) => run.marks.find(([, m]) => m === n)?.[0];
    const endT = run.chunks.at(-1)[0];
    await replayTerm({ name: "1-terminal", out: OUT, work: WORK, runFile: r1, from: Math.max(0, at("connect") - 1200), to: at("consent") + 1200 });
    await replayTerm({ name: "1-connected", out: OUT, work: WORK, runFile: r1, from: at("connected") - 300, to: at("connected") + 2200 });
    const tx = transcriptTools(AGENT_DIR, run, { needle: "Set up my training plan" });
    const pub = at("published") ?? endT;
    const run0 = at("prompt") - 400;
    const fast = (t) => (t < run0 + 9_000 ? 1 : t < pub - 5_000 ? Number(process.env.LAPSE || 12) : 1);
    await replayTerm({ name: "1-agent", out: OUT, work: WORK, runFile: r1, from: run0, to: Math.min(endT, at("done") ?? endT), speed: fast, tools: tx.map(([t, n]) => [t, n]) });
  }
  if (existsSync(r2) && (!which.length || which.includes("2"))) {
    const run = JSON.parse(readFileSync(r2, "utf8"));
    const at = (n) => run.marks.find(([, m]) => m === n)?.[0];
    const endT = run.chunks.at(-1)[0];
    const tx = transcriptTools(AGENT_DIR, run, { needle: "I left a note in FitLoop" });
    const run0 = at("prompt") - 400, pub = at("published") ?? endT;
    const fast = (t) => (t < run0 + 8_000 ? 1 : t < pub - 4_000 ? Number(process.env.LAPSE || 10) : 1);
    await replayTerm({ name: "4-agent", out: OUT, work: WORK, runFile: r2, from: run0, to: Math.min(endT, at("done") ?? endT), speed: fast, tools: tx.map(([t, n]) => [t, n]) });
  }
}

const cmd = process.argv[2];
const run = { stage, restore, connect, agent1, phone1, workout, pair, glasses, meal, agent2, phone2, term }[cmd];
if (!run) {
  console.error("usage: fitloop-demo-record.mjs stage | connect | agent1 | phone1 | workout | pair | glasses | meal | agent2 | phone2 | term | restore");
  process.exit(1);
}
await run();
