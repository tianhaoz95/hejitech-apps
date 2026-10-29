#!/usr/bin/env node
// Integration test for the Headway Worker against the shared local stack (`supabase start` from the
// repo root, with the headway seed) and `npm run dev:worker -w @headway/web` (127.0.0.1:8792).
// Covers: sign-in sessions, settings (checked, per user), public boards, live predictions from a
// stored realtime snapshot, the cron endpoint, pairing with a 6-digit code (single use, throttled),
// glasses tokens (commute board, tracking, nothing else), push registration, the MCP tools, the
// OAuth flow and personal tokens, RLS isolation, deleting a user's data, the App Review demo
// account, and the pages.
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
await step("pages", async () => {
  for (const p of ["/", "/login/", "/settings/", "/support/", "/privacy/", "/oauth/consent/", "/icon.svg"]) assert.equal((await fetch(`${site}${p}`)).status, 200, p);
  assert.equal((await fetch(`${site}/nope`)).status, 404);
});

console.log(`Headway integration: ${steps.length} checks passed`);
