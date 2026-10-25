#!/usr/bin/env node
// Drives the Even Hub simulator through its automation API: the plugin pairs with a code, shows the
// day, opens the workout, does a timed set and a rep set (the rest timer starts), shows the how-to,
// sends feedback from the menu and checks off a meal; the Worker sees every check-in. Needs the
// local stack, `npm run dev:worker -w @fitloop/web` and the simulator started by
// scripts/glasses-sim.sh --e2e. Screenshots land in $SHOTS (default /tmp/fitloop-glasses).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sim = process.argv[2] ?? "http://127.0.0.1:9900";
const date = process.env.DATE ?? "2026-10-26";
const shots = process.env.SHOTS ?? "/tmp/fitloop-glasses";
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, ms = 30_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(500)) if (await fn().catch(() => false)) return;
  throw new Error(`timed out: ${label}`);
}
const input = async (action, wait = 1200) => {
  await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  await sleep(wait);
};
const shot = async (name) => writeFileSync(join(shots, `glasses-${name}.png`), Buffer.from(await (await fetch(`${sim}/api/screenshot/glasses`)).arrayBuffer()));
const today = async () => (await (await fetch(`http://127.0.0.1:8794/api/today?date=${date}`, { headers: { Authorization: "Bearer fld_dev_local_device" } })).json());

await waitFor(async () => (await fetch(`${sim}/api/ping`)).ok, "simulator up");
await sleep(9000);
await shot("1-today");
await input("down");                 // breakfast → the 12:00 workout
await input("click");                // open it
await shot("2-workout");
await input("click");                // start the timed warm-up
await sleep(2500);
await shot("3-work-timer");
await input("click");                // finish it → goblet squat, rest running
await shot("4-next-exercise");
await input("click");                // set 1 done → rest 1:30
await shot("5-rest");
await input("long_press");           // how-to
await shot("6-how-to");
await input("click");                // back
await input("double_click");         // workout menu
await shot("7-menu");
await input("down");                 // Tell agent: Too hard
await input("click");
await shot("8-feedback-sent");
if (process.env.DEBUG_CONSOLE) {
  const logs = await (await fetch(`${sim}/api/console`)).json();
  for (const l of (logs.logs ?? logs.entries ?? logs)) if (/\[fitloop\]/.test(l.message ?? JSON.stringify(l))) console.log(l.message ?? JSON.stringify(l));
}
await waitFor(async () => {
  const t = await today();
  const squat = t.state.workouts[0].exercises[1];
  return t.state.workouts[0].exercises[0].status === "done" && squat.setsDone >= 1;
}, "the Worker has the check-ins", 15_000);
console.log(`glasses e2e: ok, screenshots in ${shots}`);
