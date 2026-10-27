#!/usr/bin/env node
// Drives the Even Hub simulator through its automation API and checks the backend: gestures
// become typed events, a held press becomes a capture for the phone. Saves HUD screenshots for
// the report. Run via `scripts/glasses-sim.sh --e2e` (which pairs the app with a fresh code).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sim = process.argv[2] ?? "http://127.0.0.1:9898";
const shots = join(dirname(fileURLToPath(import.meta.url)), "..", "report", "v0", "site", "screenshots");
mkdirSync(shots, { recursive: true });
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, label, timeout = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await fn()) return; } catch { /* retry */ }
    await sleep(500);
  }
  const logs = await console_().catch(() => []);
  for (const l of (logs.logs ?? logs.entries ?? logs).filter?.((l) => !/Flutter Bridge intercepted/.test(l.message)) ?? []) console.error(l.message);
  throw new Error(`timed out: ${label}`);
}
const input = async (action) => {
  await fetch(`${sim}/api/input`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  await sleep(900);
};
const shot = async (name) => {
  const res = await fetch(`${sim}/api/screenshot/glasses`);
  writeFileSync(join(shots, `glasses-${name}.png`), Buffer.from(await res.arrayBuffer()));
};
const console_ = async () => (await (await fetch(`${sim}/api/console`)).json());
const rest = async (path) => (await fetch(`http://127.0.0.1:55421/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Accept-Profile": "weehours" } })).json();

const before = new Date().toISOString();
await waitFor(async () => (await fetch(`${sim}/api/ping`)).ok, "simulator up");
await waitFor(async () => JSON.stringify(await console_()).includes("paired with"), "app paired", 45_000);
await sleep(1500);
await shot("1-status");

await input("click");                          // start feed (household default: bottle)
await shot("2-feed-started");
await input("click");                          // finish feed
await input("long_press");                     // hold to speak: "drank half"
await shot("3-listening");
await sleep(600);
await input("long_press_release");
await shot("4-captured");
await input("down");                           // open menu ("Log diaper")
await input("click");                          // enter diaper picker ("wet")
await input("down");                           // dirty
await shot("5-diaper-picker");
await input("click");                          // log diaper
await sleep(2500);
await shot("6-after");

await waitFor(async () => (await rest(`events?logged_at=gte.${before}&provenance->>surface=in.(glasses,ring)&select=type`)).length >= 3, "events synced");
const events = await rest(`events?logged_at=gte.${before}&provenance->>surface=in.(glasses,ring)&select=type,fields&order=seq`);
const types = events.map((e) => e.type);
assert.deepEqual(types.slice(0, 3), ["feed.bottle.start", "feed.bottle.finish", "diaper"]);
assert.equal(events[2].fields.kind, "dirty");
await waitFor(async () => (await rest(`captures?created_at=gte.${before}&select=id`)).length >= 1, "capture uploaded");
const caps = await rest(`captures?created_at=gte.${before}&select=status,attach_to,audio_path`);
assert.equal(caps[0].status, "pending");
assert.ok(caps[0].attach_to, "capture is attached to the finish entry");
console.log(`glasses e2e: ${types.join(", ")} + ${caps.length} pending capture(s); screenshots in report/v0/site/screenshots`);
process.exit(0);
