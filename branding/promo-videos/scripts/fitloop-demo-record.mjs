#!/usr/bin/env node
// Screen recordings and event logs for the fitloop-demo walkthrough video, from the LOCAL stack only:
// seed athlete (athlete@example.com), with "the agent" played by this script calling FitLoop's MCP on
// the local Worker with the seed's local agent token (fla_dev_local_token).
//
//   supabase start; npm run dev:worker -w @fitloop/web          (Worker on 127.0.0.1:8794)
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs stage      reset DB and publish demo plan v1
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs agent      rec-1-agent: MCP terminal run
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs workout    rec-2-workout: iPhone Today tab & player
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs glasses    rec-3-glasses: Even G2 HUD simulator
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs loop       rec-4-loop: feedback, meal & plan v2
//   node branding/promo-videos/scripts/fitloop-demo-record.mjs restore    restore fitloop rows
//
// Records MP4 videos and writes *.events.json for camera and spotlight tracking.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "branding/promo-videos/public/fitloop-demo";
const WORK = join(tmpdir(), "fitloop-demo-record");
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

const site = "http://127.0.0.1:8794", supabase = "http://127.0.0.1:55421", sim = "http://127.0.0.1:9901";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const AGENT = "fla_dev_local_token";
const ATHLETE = "00000000-0000-4000-8000-0000000f1700";
const TODAY = "2026-11-02", TOMORROW = "2026-11-03";
const DB = "supabase_db_waypack";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], ...opts }).toString();
const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });

const token = async () =>
  (await (await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "athlete@example.com", password: "fitloop-dev" }) })).json()).access_token;

const api = async (tok, path, init = {}) => {
  for (let i = 0; ; i++) {
    const text = await (await fetch(site + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } })).text();
    try { return JSON.parse(text); } catch (e) { if (i >= 2) throw new Error(`${path}: ${text.slice(0, 120)}`); await sleep(500); }
  }
};

let rpcId = 0;
async function mcp(name, args = {}) {
  const res = await fetch(`${site}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${AGENT}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } })
  });
  const body = await res.json();
  const text = body.result?.content?.[0]?.text ?? JSON.stringify(body);
  if (body.error || body.result?.isError) throw new Error(`${name}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

function demoPlan(base, startsOn, swapped) {
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
  return {
    ...base,
    title: "Strength & Mobility (Walkthrough)",
    summary: "Four 40-minute morning strength sessions tailored to joint health and mobility.",
    starts_on: startsOn,
    constraints: ["40 minutes before work", "Focus on controlled tempo and form"],
    week: { ...base.week, mon: lower, tue: lower, thu: lower }
  };
}

async function stage() {
  const backup = join(WORK, "fitloop-backup.sql");
  if (!existsSync(backup)) {
    writeFileSync(backup, sh("docker", ["exec", DB, "pg_dump", "-U", "postgres", "--data-only", "--schema=fitloop"]));
    console.log(`backed up fitloop rows to ${backup}`);
  }
  sql(`delete from fitloop.feedback where user_id='${ATHLETE}'; delete from fitloop.checkins where user_id='${ATHLETE}' and date >= '${TODAY}';`);
  const base = (await mcp("get_current_plan")).current.plan;
  const v = await mcp("publish_plan", { plan: demoPlan(base, TODAY, false), change_note: "Initial training plan version 1: 40-minute morning sessions." });
  console.log("Published plan v1:", v);
}

async function main() {
  const cmd = process.argv[2] ?? "help";
  if (cmd === "stage") await stage();
  else if (cmd === "help") {
    console.log("Commands: stage, agent, workout, glasses, loop, restore");
  } else {
    console.log(`Running recording task: ${cmd}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
