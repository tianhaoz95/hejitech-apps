#!/usr/bin/env node
// Drives the Even Hub simulator through its automation API: the plugin pairs with a code, shows the
// commute board, and the R1 gestures move, open the menu, track and stop tracking; the backend sees
// the tracked train. (Double tap on the board exits; the simulator doesn't draw the system dialog.)
// Needs the local stack, `npm run dev:worker -w @headway/web` and the simulator started by
// scripts/glasses-sim.sh --e2e. Screenshots land in $SHOTS (default /tmp/headway-glasses).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sim = process.argv[2] ?? "http://127.0.0.1:9899";
const shots = process.env.SHOTS ?? "/tmp/headway-glasses";
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, ms = 30_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(500)) if (await fn().catch(() => false)) return;
  throw new Error(`timed out: ${label}`);
}
const input = async (action) => {
  await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  await sleep(1200);
};
const shot = async (name) => writeFileSync(join(shots, `glasses-${name}.png`), Buffer.from(await (await fetch(`${sim}/api/screenshot/glasses`)).arrayBuffer()));
const tracked = async () => (await (await fetch("http://127.0.0.1:8792/api/me/board", { headers: { Authorization: "Bearer hwd_dev_local_device" } })).json()).tracked;

await waitFor(async () => (await fetch(`${sim}/api/ping`)).ok, "simulator up");
await sleep(9000);
await shot("1-board");
await input("down");
await shot("2-cursor");
await input("long_press");          // menu: "Track <train>" first
await shot("3-menu");
await input("click");               // track it
await shot("4-tracking");
await waitFor(async () => Boolean(await tracked()), "the Worker sees the tracked train", 10_000);
await input("double_click");        // back to the board
await shot("5-board-again");
await input("long_press");          // menu → the tracked train
await input("down");
await input("click");
await input("long_press");          // stop tracking
await shot("6-untracked");
await waitFor(async () => !(await tracked()), "the Worker sees tracking stopped", 10_000);
console.log(`glasses e2e: ok, screenshots in ${shots}`);
