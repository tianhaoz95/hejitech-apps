#!/usr/bin/env node
// Integration test for the Headway Worker against the shared local stack (`supabase start` from the
// repo root, with the headway seed) and `npm run dev:worker -w @headway/web` (127.0.0.1:8792).
// Covers: sign-in sessions, settings (checked, per user), public boards, live predictions from a
// stored realtime snapshot, the cron endpoint, pairing with a 6-digit code (single use, throttled),
// glasses tokens (commute board, tracking, nothing else), push registration, the MCP tools, the
// OAuth flow and personal tokens, RLS isolation, deleting a user's data, the App Review demo
// account, and the pages.
// Family groups: invites, per-person shares and follows, leaving.
// Usage: node projects/headway/scripts/test-api.mjs [site-origin] [supabase-url]
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mcpClient } from "./mcp-client.mjs";

const site = (process.argv[2] ?? "http://127.0.0.1:8792").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const mcpUrl = `${site}/mcp`;
const AGENT = "hwa_dev_local_token";
const SEED_DEVICE = "hwd_dev_local_device";
const SEED_USER = "00000000-0000-4000-8000-00000000c47e";
const { rpc, tool } = mcpClient(mcpUrl, AGENT);

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ✓ ${name}`); };

async function signIn(email, password) {
  const res = await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `sign-in ${email}`);
  return (await res.json()).access_token;
}
async function call(path, { method = "GET", auth, body, headers = {} } = {}) {
  const res = await fetch(`${site}${path}`, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, text, headers: res.headers };
}
async function makeUser(email, password) {
  const res = await fetch(`${supabase}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true }) });
  assert.ok(res.status === 200 || res.status === 422, `create ${email}: ${res.status}`);
  return signIn(email, password);
}
/** Writes the realtime row directly (what the cron stores after fetching 511). */
async function storeSnapshot(snapshot) {
  const res = await fetch(`${supabase}/rest/v1/realtime?on_conflict=id`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Content-Profile": "headway", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: 1, fetched_at: new Date(snapshot.fetched_at).toISOString(), snapshot, error: null }),
  });
  assert.ok(res.ok, `store snapshot: ${res.status} ${await res.text()}`);
  // Isolates cache the snapshot for 20 s.
  await new Promise((r) => setTimeout(r, 21_000));
}

let session, other;
await step("signs in (seed rider) and a second user", async () => {
  session = await signIn("rider@example.com", "headway-dev");
  other = await makeUser(`other-${Date.now()}@example.com`, "other-pass-123");
});

// ---------------------------------------------------------------- public data
let firstTrain;
await step("public: stations, a board for any pair, status", async () => {
  const st = await call("/api/stations");
  assert.equal(st.status, 200);
  assert.equal(st.body[0].id, "san_francisco");
  assert.ok(st.body.some((s) => s.id === "mountain_view" && s.short === "MTN VIEW"));
  const b = await call("/api/board?from=mountain_view&to=san_francisco");
  assert.equal(b.status, 200, b.text);
  assert.equal(b.body.from.short, "MTN VIEW");
  assert.ok(b.body.trains.length > 0, "trains in the next 6 hours");
  for (const t of b.body.trains) assert.equal(t.dir, "N");
  firstTrain = b.body.trains[0];
  assert.equal((await call("/api/board?from=mountain_view&to=mountain_view")).status, 400);
  assert.equal((await call("/api/board?from=nowhere&to=san_francisco")).status, 400);
  const s = await call("/api/status");
  assert.equal(s.body.realtime.configured, false);
  assert.ok(s.body.timetable.days_left > 21);
});

await step("a stored realtime snapshot makes boards live: delays, alerts", async () => {
  const now = Date.now();
  await storeSnapshot({
    fetched_at: now, feed_ts: Math.floor(now / 1000),
    trips: { [firstTrain.trip_id]: { start_date: firstTrain.service_date, stops: { "70211": { delay: 420 } } } },
    alerts: [{ id: "test-alert", header: "Delays near Mountain View", description: "Police activity.", stations: ["mountain_view"], routes: [] }],
  });
  const b = await call("/api/board?from=mountain_view&to=san_francisco");
  assert.equal(b.body.live, true);
  const t = b.body.trains.find((x) => x.trip_id === firstTrain.trip_id);
  assert.equal(t.delay_min, 7);
  assert.equal(t.status, "late");
  assert.equal(b.body.alerts[0].header, "Delays near Mountain View");
  const p = await call(`/api/train?trip=${firstTrain.trip_id}&date=${firstTrain.service_date}&from=mountain_view&to=san_francisco`);
  assert.equal(p.status, 200, p.text);
  assert.equal(p.body.delay_min, 7);
});

await step("the cron runs (no 511 key locally: keeps the snapshot)", async () => {
  const r = await fetch(`${site}/cdn-cgi/handler/scheduled?cron=*+*+*+*+*`);
  assert.equal(r.status, 200);
  assert.equal((await call("/api/board?from=mountain_view&to=san_francisco")).body.live, true);
});

// ---------------------------------------------------------------- settings
await step("settings: the seed commute; defaults for a new user; checked writes", async () => {
  const s = await call("/api/settings", { auth: session });
  assert.equal(s.status, 200);
  assert.equal(s.body.settings.morning.from, "mountain_view");
  assert.equal(s.body.saved, true);
  const o = await call("/api/settings", { auth: other });
  assert.equal(o.body.saved, false);
  assert.equal(o.body.settings.morning, null);
  const bad = await call("/api/settings", { method: "PUT", auth: other, body: { settings: { ...o.body.settings, switch_at: "25:00" } } });
  assert.equal(bad.status, 422);
  assert.equal(bad.body.issues[0].path, "switch_at");
  const mine = { ...o.body.settings, morning: { from: "palo_alto", to: "sj_diridon", walk_minutes: 5, usual: null, window: { start: "06:00", end: "10:00" } } };
  const ok = await call("/api/settings", { method: "PUT", auth: other, body: { settings: mine } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await call("/api/settings", { auth: other })).body.settings.morning.to, "sj_diridon");
  assert.equal((await call("/api/settings", { auth: session })).body.settings.morning.to, "san_francisco", "untouched");
  assert.equal((await call("/api/settings")).status, 401);
});

await step("my board: the commute leg for now, or a custom pair", async () => {
  const b = await call("/api/me/board", { auth: session });
  assert.equal(b.status, 200);
  assert.equal(b.body.has_commute, true);
  assert.ok(["morning", "evening"].includes(b.body.board.leg));
  const c = await call("/api/me/board?from=palo_alto&to=millbrae", { auth: session });
  assert.equal(c.body.board.leg, "custom");
});

// ---------------------------------------------------------------- glasses
let device;
await step("pairing: a 6-digit code, single use, for a glasses token", async () => {
  assert.equal((await call("/api/pairing-code", { method: "POST" })).status, 401);
  const c = await call("/api/pairing-code", { method: "POST", auth: session });
  assert.match(c.body.code, /^\d{6}$/);
  const headers = { "CF-Connecting-IP": `198.51.100.${Date.now() % 250}` };
  const p = await call("/api/pair", { method: "POST", body: { code: c.body.code, label: "Test G2" }, headers });
  assert.equal(p.status, 200, p.text);
  device = p.body.device_token;
  assert.match(device, /^hwd_/);
  assert.equal((await call("/api/pair", { method: "POST", body: { code: c.body.code }, headers })).status, 400, "single use");
});
await step("the glasses token reads the commute and tracks a train, and nothing else", async () => {
  const b = await call("/api/me/board", { auth: device });
  assert.equal(b.status, 200);
  assert.equal(b.body.has_commute, true);
  const t = await call("/api/track", { method: "POST", auth: device, body: { trip_id: firstTrain.trip_id, service_date: firstTrain.service_date, from: "mountain_view", to: "san_francisco" } });
  assert.equal(t.status, 200, t.text);
  assert.equal(t.body.progress.to.id, "san_francisco");
  const again = await call("/api/me/board", { auth: session });
  assert.equal(again.body.tracked.trip_id, firstTrain.trip_id, "the phone sees what the glasses track");
  // Share live ETA: the link opens the Worker's page (it once fell through to the static 404 page).
  const share = await call("/api/me/share", { method: "POST", auth: session, body: { name: "Test" } });
  assert.equal(share.status, 201, share.text);
  const page = await fetch(share.body.url.replace(/^https?:\/\/[^/]+/, site));
  assert.equal(page.status, 200, "the shared ETA page");
  assert.match(await page.text(), /is on Caltrain|has arrived/);
  assert.equal((await call("/api/track", { method: "POST", auth: device, body: { trip_id: "nope", service_date: "20261027", from: "a", to: "b" } })).status, 400);
  assert.equal((await call("/api/settings", { auth: device })).status, 403);
  assert.equal((await call("/api/pairing-code", { method: "POST", auth: device })).status, 403);
  assert.equal((await mcpClient(mcpUrl, device).rpc("tools/list")).status, 401);
  assert.equal((await call("/api/me/board", { auth: SEED_DEVICE })).status, 200, "seed glasses token");
});
await step("unpairing fails closed; others can't unpair", async () => {
  const list = await call("/api/devices", { auth: session });
  const row = list.body.find((d) => d.label === "Test G2");
  await call(`/api/devices/${row.id}`, { method: "DELETE", auth: other });
  assert.equal((await call("/api/me/board", { auth: device })).status, 200);
  await call(`/api/devices/${row.id}`, { method: "DELETE", auth: session });
  assert.equal((await call("/api/me/board", { auth: device })).status, 401);
});
await step("wrong codes are throttled", async () => {
  let last;
  const headers = { "CF-Connecting-IP": `203.0.113.${Date.now() % 250}` };
  for (let i = 0; i < 11; i++) last = await call("/api/pair", { method: "POST", body: { code: "000000" }, headers });
  assert.equal(last.status, 429);
});

// ---------------------------------------------------------------- on a train
await step("on a train: off asks nothing, a ride shows a card everywhere, auto tracks once, not-on-it holds", async () => {
  const { departures, distanceM, station, tripProgressStops } = await import("../packages/core/src/index.ts");
  const save = async (over) => {
    const cur = (await call("/api/settings", { auth: session })).body.settings;
    const r = await call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...cur, ...over } } });
    assert.equal(r.status, 200, r.text);
    return r.body.settings;
  };
  await call("/api/track", { method: "DELETE", auth: session });
  const before = (await call("/api/settings", { auth: session })).body.settings;
  assert.equal(before.on_train, "card", "the default");
  assert.equal(before.alerts.scope, "priority", "the default");
  const bad = await call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...before, on_train: "sometimes" } } });
  assert.equal(bad.status, 422);
  assert.equal((await call("/api/me/on-train", { method: "POST", body: { samples: [] } })).status, 401, "needs a session");

  // A train running now, and fixes along its current stretch.
  const now = Date.now();
  const running = departures("san_francisco", "sj_diridon", now, null, { lookbackMs: 90 * 60_000 }).concat(departures("sj_diridon", "san_francisco", now, null, { lookbackMs: 90 * 60_000 })).find((t) => t.dep < now - 60_000 && t.arr > now + 5 * 60_000);
  await save({ on_train: "off" });
  assert.equal((await call("/api/me/on-train", { method: "POST", auth: session, body: { samples: [] } })).body.on_train, null);
  await save({ on_train: "card" });
  if (!running) { console.log("    (no train running right now: skipped the ride itself)"); return; }

  const [from, to] = running.dir === "N" ? ["sj_diridon", "san_francisco"] : ["san_francisco", "sj_diridon"];
  const stops = tripProgressStops({ trip_id: running.trip_id, service_date: running.service_date, from, to }, now, null);
  const i = stops.findIndex((x) => x.status === "now");
  const a = station(stops[Math.max(0, i - 1)].id), b = station(stops[i].id);
  const sp = (distanceM(a, b) / 1000) < 1 ? 15 : 25;
  const samples = [0.35, 0.45, 0.55].map((f, n) => ({ lat: a.lat + f * (b.lat - a.lat), lon: a.lon + f * (b.lon - a.lon), at: now - (2 - n) * 15_000, speed: sp }));
  const r = await call("/api/me/on-train", { method: "POST", auth: session, body: { samples } });
  assert.equal(r.status, 200, r.text);
  // The nearest train wins, and that may be another one close by: what matters is the card.
  if (!r.body.on_train) { console.log("    (fixes didn't line up with a train: skipped the rest)"); return; }
  assert.equal(r.body.auto_tracked, false, "card mode doesn't track");
  assert.ok(r.body.on_train.stops.length > 0);
  const onBoard = (await call("/api/me/board", { auth: session })).body;
  assert.equal(onBoard.on_train?.trip_id, r.body.on_train.trip_id, "on the commute board");
  assert.equal((await call("/api/me/board", { auth: SEED_DEVICE })).body.on_train?.trip_id, r.body.on_train.trip_id, "on the glasses");
  assert.equal(onBoard.tracked, null);
  assert.ok(!JSON.stringify(r.body).includes(String(samples[0].lat)), "no location comes back");

  await call("/api/track", { method: "DELETE", auth: session });
  await save({ on_train: "auto" });
  const auto = await call("/api/me/on-train", { method: "POST", auth: session, body: { samples } });
  assert.equal(auto.body.auto_tracked, auto.body.on_train?.confidence === "high", "auto tracks when sure");
  if (auto.body.auto_tracked) {
    assert.ok((await call("/api/me/board", { auth: session })).body.tracked, "tracked");
    await call("/api/track", { method: "DELETE", auth: session });
    const again = await call("/api/me/on-train", { method: "POST", auth: session, body: { samples } });
    assert.equal(again.body.auto_tracked, false, "stopping it doesn't start it again");
  }

  // The second user: "Not on it" holds for 20 minutes, which would hide the seed rider's card in a dev session.
  assert.ok((await call("/api/me/on-train", { method: "POST", auth: other, body: { samples } })).body.on_train, "their own ride");
  assert.equal((await call("/api/me/on-train", { method: "DELETE", auth: other })).status, 200);
  assert.equal((await call("/api/me/board", { auth: other })).body.on_train, null, "not on it");
  assert.equal((await call("/api/me/on-train", { method: "POST", auth: other, body: { samples } })).body.on_train, null, "stays dismissed");
  await call("/api/me/on-train", { method: "POST", auth: session, body: { samples: [] } });
  await save({ on_train: "card" });
  await call("/api/track", { method: "DELETE", auth: session });
});

await step("commute done: reaching the leg's stop holds its alerts, shows the card, and can be turned back on for the day", async () => {
  const { departures, station } = await import("../packages/core/src/index.ts");
  const cur = (await call("/api/settings", { auth: session })).body.settings;
  assert.equal(cur.alerts.stop_when_done, true, "on by default");
  const put = (alerts, more = {}) => call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...cur, ...more, alerts: { ...cur.alerts, ...alerts } } } });
  assert.equal((await put({ stop_when_done: "yes" })).status, 422);
  const leg = { from: "mountain_view", to: "san_francisco", walk_minutes: 10, usual: null, window: { start: "06:00", end: "10:30" } };
  // Off, then on: forgets a leg finished by an earlier run.
  assert.equal((await put({ stop_when_done: false }, { morning: leg, days: [0, 1, 2, 3, 4, 5, 6] })).body.settings.alerts.stop_when_done, false);
  assert.equal((await put({ stop_when_done: true }, { morning: leg, days: [0, 1, 2, 3, 4, 5, 6] })).status, 200);

  // A weekday morning: track a train to San Francisco and be there as it pulls in.
  const day = new Date(Date.parse("2026-11-09T08:00:00-08:00"));
  const t = departures("mountain_view", "san_francisco", day.getTime(), null, { lookbackMs: 0 })[0];
  const sf = station("san_francisco"), mv = station("mountain_view");
  const here = (s) => `lat=${s.lat}&lon=${s.lon}`;
  try {
    await call("/api/dev/clock", { method: "PUT", body: { at: new Date(t.arr - 60_000).toISOString() } });
    assert.equal((await call("/api/track", { method: "POST", auth: session, body: { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" } })).status, 200);
    assert.equal((await call(`/api/me/board?${here(mv)}`, { auth: session })).body.commute_done, null, "not there yet");
    assert.equal((await call("/api/me/board", { auth: session })).body.commute_done, null, "no location, no guess");
    const done = (await call(`/api/me/board?${here(sf)}`, { auth: session })).body.commute_done;
    assert.equal(done?.part, "morning");
    assert.equal(done.to.id, "san_francisco");
    assert.ok(done.until > done.at);
    assert.equal((await call("/api/me/board", { auth: session })).body.commute_done?.part, "morning", "stays without a location");
    assert.equal((await call("/api/me/board", { auth: other })).body.commute_done, null, "theirs only");
    assert.equal((await call("/api/me/commute-done", { method: "DELETE", auth: SEED_DEVICE })).status, 403, "the app's button, not the glasses'");
    assert.equal((await call("/api/me/commute-done", { method: "DELETE", auth: session })).status, 200);
    assert.equal((await call(`/api/me/board?${here(sf)}`, { auth: session })).body.commute_done, null, "back on for today, and it sticks");
    // A one-off to another stop isn't the commute.
    await put({ stop_when_done: false }, { morning: leg });
    await put({ stop_when_done: true }, { morning: leg, days: [0, 1, 2, 3, 4, 5, 6] });
    await call("/api/track", { method: "POST", auth: session, body: { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "22nd_street" } });
    assert.equal((await call(`/api/me/board?${here(sf)}`, { auth: session })).body.commute_done, null, "tracked to another stop");
  } finally {
    await call("/api/track", { method: "DELETE", auth: session });
    await call("/api/dev/clock", { method: "PUT", body: { at: null } });
    await call("/api/settings", { method: "PUT", auth: session, body: { settings: cur } });
  }
});

await step("priority: the alert choice is saved", async () => {
  const cur = (await call("/api/settings", { auth: session })).body.settings;
  const r = await call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...cur, alerts: { ...cur.alerts, scope: "all" } } } });
  assert.equal(r.body.settings.alerts.scope, "all");
  const bad = await call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...cur, alerts: { ...cur.alerts, scope: "loud" } } } });
  assert.equal(bad.status, 422);
  await call("/api/settings", { method: "PUT", auth: session, body: { settings: cur } });
});

// ---------------------------------------------------------------- push
await step("push registration: hex tokens, one owner per phone, no pushes without APNs keys", async () => {
  const token = randomBytes(32).toString("hex");
  assert.equal((await call("/api/push", { method: "POST", auth: session, body: { token: "not-hex" } })).status, 400);
  assert.equal((await call("/api/push", { method: "POST", auth: session, body: { token, environment: "sandbox", label: "Test iPhone" } })).status, 200);
  const l = await call("/api/push", { auth: session });
  assert.equal(l.body.configured, false);
  assert.ok(l.body.devices.some((d) => d.label === "Test iPhone" && d.environment === "sandbox"));
  // Signing in to another account on the same phone moves the token.
  await call("/api/push", { method: "POST", auth: other, body: { token, label: "Test iPhone" } });
  assert.ok(!(await call("/api/push", { auth: session })).body.devices.some((d) => d.label === "Test iPhone"));
  assert.equal((await call("/api/push/test", { method: "POST", auth: other })).status, 503);
  await call(`/api/push/${token}`, { method: "DELETE", auth: other });
  assert.equal((await call("/api/push", { auth: other })).body.devices.length, 0);
});
await step("push registration: an Android phone registers its FCM token, listed as android, moved and removed like an iPhone's", async () => {
  const token = `${randomBytes(11).toString("base64url")}:APA91b${randomBytes(100).toString("base64url")}`;
  assert.equal((await call("/api/push", { method: "POST", auth: session, body: { platform: "android", token: "short" } })).status, 400);
  // Plain hex is an APNs token, never an FCM one.
  assert.equal((await call("/api/push", { method: "POST", auth: session, body: { platform: "android", token: randomBytes(40).toString("hex") } })).status, 400);
  const r = await call("/api/push", { method: "POST", auth: session, body: { platform: "android", token, label: "Test Pixel" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.configured, false);
  await call("/api/push", { method: "POST", auth: session, body: { platform: "android", token, label: "Test Pixel" } });
  const mine = (await call("/api/push", { auth: session })).body.devices.filter((d) => d.label === "Test Pixel");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].platform, "android");
  assert.equal(mine[0].fcm_token, undefined);
  await call("/api/push", { method: "POST", auth: other, body: { platform: "android", token, label: "Test Pixel" } });
  assert.ok(!(await call("/api/push", { auth: session })).body.devices.some((d) => d.label === "Test Pixel"));
  assert.equal((await call(`/api/push/${encodeURIComponent(token)}`, { method: "DELETE", auth: other })).status, 200);
  assert.equal((await call("/api/push", { auth: other })).body.devices.length, 0);
  assert.equal((await call("/api/push/nope", { method: "DELETE", auth: other })).status, 400);
});

// ---------------------------------------------------------------- MCP
await step("MCP: 401 with the OAuth hint, initialize, tools", async () => {
  const r = await mcpClient(mcpUrl, null).rpc("tools/list");
  assert.equal(r.status, 401);
  assert.match(r.headers.get("WWW-Authenticate") ?? "", /resource_metadata=/);
  assert.equal((await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } })).body.result.serverInfo.name, "headway");
  const names = (await rpc("tools/list")).body.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["list_stations", "my_commute", "next_trains", "service_alerts", "share_eta", "stop_tracking", "track_train", "tracked_train"]);
});
await step("MCP: commute, next trains by name, alerts, tracking", async () => {
  const c = await tool("my_commute");
  assert.ok(c.trains.length > 0);
  const m = await tool("my_commute", { leg: "evening" });
  assert.equal(m.from, "San Francisco");
  const n = await tool("next_trains", { from: "Mountain View", to: "SF", limit: 3 });
  assert.ok(n.trains.length > 0 && n.trains.length <= 3);
  assert.equal(n.live, true);
  await assert.rejects(tool("next_trains", { from: "Atlantis", to: "SF" }), /unknown station/);
  const a = await tool("service_alerts", { station: "mountain_view" });
  assert.equal(a.alerts[0].header, "Delays near Mountain View");
  const t = await tool("track_train", { trip_id: firstTrain.trip_id, service_date: firstTrain.service_date, from: "mountain_view", to: "san_francisco" });
  assert.equal(t.tracking, true);
  assert.equal((await tool("tracked_train")).tracked.to, "San Francisco");
  await tool("stop_tracking");
  assert.equal((await tool("tracked_train")).tracked, null);
});
await step("agent tokens: made once, work, revoke", async () => {
  const t = await call("/api/tokens", { method: "POST", auth: session, body: { name: "Test token" } });
  assert.match(t.body.token, /^hwa_/);
  assert.equal((await mcpClient(mcpUrl, t.body.token).rpc("tools/list")).status, 200);
  await call(`/api/tokens/${t.body.id}`, { method: "DELETE", auth: session });
  assert.equal((await mcpClient(mcpUrl, t.body.token).rpc("tools/list")).status, 401);
});

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const redirectUri = "http://127.0.0.1:9999/callback";
const cookiesOf = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
async function startAuthorize(clientId, challenge, state) {
  const u = new URL(`${site}/authorize`);
  for (const [k, v] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "mcp", state, code_challenge: challenge, code_challenge_method: "S256", resource: mcpUrl })) u.searchParams.set(k, v);
  const res = await fetch(u, { redirect: "manual" });
  assert.equal(res.status, 302, `authorize → ${res.status}`);
  return { page: new URL(res.headers.get("Location")), cookie: cookiesOf(res) };
}
async function decide(page, cookie, decision, auth) {
  const res = await fetch(`${site}/authorize`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify({ handle: page.searchParams.get("handle"), decision }) });
  return { status: res.status, body: await res.json() };
}
await step("OAuth: register → consent (deny, approve) → token → MCP → disconnect", async () => {
  const reg = await fetch(`${site}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Test assistant", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
  assert.equal(reg.status, 201);
  const clientId = (await reg.json()).client_id;
  const first = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s1");
  assert.equal(first.page.pathname, "/oauth/consent/");
  assert.equal((await fetch(first.page)).status, 200);
  assert.equal((await decide(first.page, first.cookie, "approve", null)).status, 401);
  const denied = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s2");
  assert.equal(new URL((await decide(denied.page, denied.cookie, "deny", null)).body.redirectTo).searchParams.get("error"), "access_denied");
  const verifier = b64url(randomBytes(32));
  const ok = await startAuthorize(clientId, b64url(createHash("sha256").update(verifier).digest()), "s3");
  const r = await decide(ok.page, ok.cookie, "approve", session);
  const back = new URL(r.body.redirectTo);
  const tok = await fetch(`${site}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource: mcpUrl }) });
  const access = (await tok.json()).access_token;
  assert.ok(access);
  const viaOAuth = mcpClient(mcpUrl, access);
  assert.equal((await viaOAuth.tool("my_commute", { leg: "morning" })).from, "Mountain View");
  const grants = await call("/api/grants", { auth: session });
  const g = grants.body.find((x) => x.client_name === "Test assistant");
  await call(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE", auth: session });
  assert.equal((await viaOAuth.rpc("tools/list")).status, 401);
});

// ---------------------------------------------------------------- isolation + deletion
await step("family: a group, email invites, nothing shared until chosen, per-person shares and follows, leaving", async () => {
  const stamp = Date.now();
  const mails = { a: `fam-a-${stamp}@example.com`, b: `fam-b-${stamp}@example.com`, c: `fam-c-${stamp}@example.com` };
  const [a, b, c] = [await makeUser(mails.a, "fam-pass-123"), await makeUser(mails.b, "fam-pass-123"), await makeUser(mails.c, "fam-pass-123")];
  const fam = (auth, path = "", opts = {}) => call(`/api/family${path}`, { auth, ...opts });

  const none = await fam(a);
  assert.equal(none.status, 200, none.text);
  assert.equal(none.body.group, null);
  assert.equal(none.body.email, mails.a);
  const made = await fam(a, "", { method: "POST", body: { name: "The Testers", display_name: "Alex" } });
  assert.equal(made.status, 201, made.text);
  assert.equal(made.body.group.owner, true);
  assert.deepEqual(made.body.group.members.map((m) => m.display_name), ["Alex"]);
  assert.ok(made.body.me.shares.every((sh) => !sh.on), "everything starts off");
  assert.equal((await fam(a, "", { method: "POST", body: { name: "Again" } })).status, 409, "one group per account");

  // Invites: the same answer for an address nobody uses.
  assert.equal((await fam(a, "/invites", { method: "POST", body: { email: mails.b.toUpperCase() } })).status, 201);
  const ghost = await fam(a, "/invites", { method: "POST", body: { email: `nobody-${stamp}@example.com` } });
  assert.equal(ghost.status, 201);
  assert.equal(ghost.body.group.pending_invites.length, 2);
  assert.equal((await fam(a, "/invites", { method: "POST", body: { email: "not-an-email" } })).status, 400);
  const forB = (await fam(b)).body.invites;
  assert.equal(forB.length, 1);
  assert.deepEqual([forB[0].group_name, forB[0].from_name], ["The Testers", "Alex"]);
  assert.equal((await fam(c, `/invites/${forB[0].id}/accept`, { method: "POST" })).status, 404, "an invite is for its address only");
  const joined = await fam(b, `/invites/${forB[0].id}/accept`, { method: "POST" });
  assert.equal(joined.status, 200, joined.text);
  const ida = joined.body.group.members.find((m) => m.role === "owner").user_id;
  const idb = joined.body.group.members.find((m) => m.me).user_id;
  assert.equal((await fam(b, "/invites", { method: "POST", body: { email: mails.c } })).status, 403, "only the owner invites");

  // Alex rides; Sam (b) sees a name only until Alex shares it with them.
  const train = (await call("/api/board?from=mountain_view&to=san_francisco")).body.trains[0];
  assert.equal((await call("/api/track", { method: "POST", auth: a, body: { trip_id: train.trip_id, service_date: train.service_date, from: "mountain_view", to: "san_francisco" } })).status, 200);
  const alexFor = async () => (await fam(b)).body.group.members.find((m) => m.user_id === ida);
  assert.deepEqual(await alexFor(), { ...(await alexFor()), shared_with_me: [], train: null, status: null });
  assert.equal((await fam(a, "/me", { method: "PUT", body: { shares: { trip: [idb] } } })).status, 200);
  assert.equal((await alexFor()).train.trip_id, train.trip_id);
  assert.equal((await fam(b, "/me", { method: "PUT", body: { follows: { [ida]: { notify: ["trip", "status"], live: true } } } })).status, 200);
  assert.deepEqual((await alexFor()).follow, { notify: ["trip"], live: true }, "only what's shared counts");
  const tripShare = (await fam(a)).body.me.shares.find((sh) => sh.kind === "trip");
  assert.deepEqual([tripShare.viewers, tripShare.notified, tripShare.live], [[idb], [idb], [idb]], "the sharer sees who follows");
  await fam(a, "/me", { method: "PUT", body: { shares: { trip: [] } } });
  assert.deepEqual((await alexFor()).follow, { notify: [], live: false }, "taken off a share: the subscription ends");

  // A status, shared or not.
  assert.equal((await fam(a, "/status", { method: "PUT", body: { code: "running_late", minutes: 45 } })).status, 400);
  assert.equal((await fam(a, "/status", { method: "PUT", body: { code: "running_late", minutes: 15 } })).status, 200);
  assert.equal((await alexFor()).status, null);
  await fam(a, "/me", { method: "PUT", body: { shares: { status: [idb] } } });
  assert.equal((await alexFor()).status.text, "Running late");
  assert.equal((await fam(b, "/me", { method: "PUT", body: { shares: { trip: ["00000000-0000-4000-8000-000000000000"] } } })).status, 422);

  // Clients read only their own membership row.
  const rows = await fetch(`${supabase}/rest/v1/family_members?select=user_id`, { headers: { apikey: ANON, Authorization: `Bearer ${b}`, "Accept-Profile": "headway" } }).then((r) => r.json());
  assert.deepEqual(rows.map((r) => r.user_id), [idb]);

  // Someone in another group can't join until they leave it.
  assert.equal((await fam(c, "", { method: "POST", body: { name: "Kim's" } })).status, 201);
  await fam(a, "/invites", { method: "POST", body: { email: mails.c } });
  const forC = (await fam(c)).body.invites[0];
  assert.equal((await fam(c, `/invites/${forC.id}/accept`, { method: "POST" })).status, 409);
  assert.equal((await fam(c, "", { method: "DELETE" })).body.group, null, "the owner leaving deletes the group");
  const three = await fam(c, `/invites/${forC.id}/accept`, { method: "POST" });
  assert.equal(three.body.group.members.length, 3, three.text);
  const idc = three.body.group.members.find((m) => m.me).user_id;
  assert.equal((await fam(b, `/members/${idc}`, { method: "DELETE" })).status, 403);
  assert.equal((await fam(a, `/members/${idc}`, { method: "DELETE" })).body.group.members.length, 2);
  assert.equal((await fam(c)).body.group, null);

  // Leaving: gone from every share at once.
  assert.equal((await fam(b, "", { method: "DELETE" })).body.group, null);
  const after = (await fam(a)).body;
  assert.equal(after.group.members.length, 1);
  assert.deepEqual(after.me.shares.find((sh) => sh.kind === "status").viewers, []);

  // At most 8 people, counting pending invites (1 member + 1 pending now).
  for (let i = 0; i < 6; i++) assert.equal((await fam(a, "/invites", { method: "POST", body: { email: `fill-${i}-${stamp}@example.com` } })).status, 201);
  assert.equal((await fam(a, "/invites", { method: "POST", body: { email: `one-too-many-${stamp}@example.com` } })).status, 409);
  assert.equal((await fam(a, "", { method: "DELETE" })).body.group, null);
  await call("/api/track", { method: "DELETE", auth: a });
  await call("/cdn-cgi/handler/scheduled?cron=*+*+*+*+*");
});

await step("RLS: clients read only their own rows; codes and snapshot aren't readable", async () => {
  const get = async (table, auth) => fetch(`${supabase}/rest/v1/${table}?select=*`, { headers: { apikey: ANON, Authorization: `Bearer ${auth}`, "Accept-Profile": "headway" } });
  const mine = await (await get("profiles", session)).json();
  assert.equal(mine.length, 1);
  assert.equal(mine[0].user_id, SEED_USER);
  const theirs = await (await get("profiles", other)).json();
  assert.ok(theirs.every((p) => p.user_id !== SEED_USER));
  assert.ok((await get("pairing_codes", session)).status >= 400);
  assert.ok((await get("realtime", session)).status >= 400);
});
await step("registers and removes activity tokens", async () => {
  const reg = await call("/api/me/activity", { method: "POST", auth: session, body: { token: "activity-token-test-123", kind: "update", trip_id: "409" } });
  assert.equal(reg.status, 200);
  const del = await call("/api/me/activity", { method: "DELETE", auth: session, body: { token: "activity-token-test-123" } });
  assert.equal(del.status, 200);
});
await step("deleting Headway data removes the user's rows only", async () => {
  assert.equal((await call("/api/account", { method: "DELETE", auth: other })).status, 200);
  const o = await call("/api/settings", { auth: other });
  assert.equal(o.body.saved, false);
  assert.equal((await call("/api/settings", { auth: session })).body.saved, true);
});

// ---------------------------------------------------------------- App Review demo account
await step("review sign-in: wrong password refused, right one gets a session on a fresh demo commute", async () => {
  // review@example.com / headway-review-dev: the local values in wrangler.jsonc.
  const sign = (password) => call("/api/review-sign-in", { method: "POST", body: { email: "Review@Example.com", password } });
  assert.equal((await sign("nope")).status, 401);
  const first = await sign("headway-review-dev");
  assert.equal(first.status, 200, first.text);
  const token = first.body.access_token;
  assert.ok(token && first.body.refresh_token && first.body.user?.id);
  const s = await call("/api/settings", { auth: token });
  assert.equal(s.body.saved, true);
  assert.equal(s.body.settings.morning.from, "mountain_view");
  // Changes during review are wiped by the next review sign-in.
  assert.equal((await call("/api/settings", { method: "PUT", auth: token, body: { settings: { ...s.body.settings, morning: null } } })).status, 200);
  const again = await sign("headway-review-dev");
  assert.equal(again.body.user.id, first.body.user.id);
  assert.equal((await call("/api/settings", { auth: again.body.access_token })).body.settings.morning.from, "mountain_view");
});

// ---------------------------------------------------------------- pages
await step("the demo clock (local only) moves boards to another moment, and resets", async () => {
  const set = await call("/api/dev/clock", { method: "PUT", body: { at: "2026-11-09T07:40:00-08:00" } });
  assert.equal(set.status, 200, set.text);
  assert.ok(Math.abs(set.body.now - Date.parse("2026-11-09T07:40:00-08:00")) < 5_000);
  const b = (await call("/api/board?from=mountain_view&to=san_francisco")).body;
  assert.ok(b.trains.some((t) => t.kind === "EXP"), "a Monday morning has expresses");
  assert.ok(b.trains.every((t) => t.service_date === "20261109"));
  assert.equal((await call("/api/dev/clock", { method: "PUT", body: { at: null } })).body.offset_ms, 0);
});
await step("pages", async () => {
  for (const p of ["/", "/login/", "/settings/", "/support/", "/privacy/", "/oauth/consent/", "/icon.svg"]) assert.equal((await fetch(`${site}${p}`)).status, 200, p);
  assert.equal((await fetch(`${site}/nope`)).status, 404);
});

console.log(`Headway integration: ${steps.length} checks passed`);
