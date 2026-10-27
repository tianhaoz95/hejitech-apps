#!/usr/bin/env node
// Integration test for the FitLoop Worker against the shared local stack (`supabase start` from the
// repo root, with the fitloop seed) and `npm run dev:worker -w @fitloop/web` (127.0.0.1:8794).
// Covers the whole loop: the agent reads the guide and profile, validates and publishes a plan over
// MCP; the user (session) and the glasses (token) see today and check in; feedback flows to the
// agent and its reply back; vitals and photos obey their switches; settings, pairing, OAuth,
// personal tokens, RLS isolation and deleting a user's data.
// Usage: node projects/fitloop/scripts/test-api.mjs [site-origin] [supabase-url]
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LINE_PX, textPx } from "../packages/core/src/font.ts"; // no imports of its own: Node runs it as is
import { mcpClient } from "./mcp-client.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const site = (process.argv[2] ?? "http://127.0.0.1:8794").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const mcpUrl = `${site}/mcp`;
const AGENT = "fla_dev_local_token";
const SEED_DEVICE = "fld_dev_local_device";
const SEED_USER = "00000000-0000-4000-8000-0000000f1700";
const example = () => JSON.parse(readFileSync(join(here, "../packages/core/fixtures/example-plan.json"), "utf8"));
const { rpc, tool } = mcpClient(mcpUrl, AGENT);

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ✓ ${name}`); };

async function signIn(email, password) {
  const res = await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(res.status, 200, `sign-in ${email}`);
  return (await res.json()).access_token;
}
async function call(path, { method = "GET", auth, body, headers = {}, raw } = {}) {
  const res = await fetch(`${site}${path}`, { method, headers: { ...(raw ? {} : { "Content-Type": "application/json" }), ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
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
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const weekday = (d) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${d}T12:00:00Z`).getUTCDay()];

let session, other;
const today = localToday();
await step("signs in (seed athlete) and a second user", async () => {
  session = await signIn("athlete@example.com", "fitloop-dev");
  other = await makeUser(`other-${Date.now()}@example.com`, "other-pass-123");
});

// ---------------------------------------------------------------- the agent's side
await step("MCP: 401 with the OAuth hint, initialize, fourteen tools with annotations", async () => {
  const r = await mcpClient(mcpUrl, null).rpc("tools/list");
  assert.equal(r.status, 401);
  assert.match(r.headers.get("WWW-Authenticate") ?? "", /resource_metadata=/);
  assert.equal((await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } })).body.result.serverInfo.name, "fitloop");
  const tools = (await rpc("tools/list")).body.result.tools;
  assert.equal(tools.length, 14);
  for (const t of tools) assert.equal(typeof t.annotations.readOnlyHint, "boolean", t.name);
});
await step("the agent uploads an exercise GIF, and the backend hosts it publicly", async () => {
  // 1x1 transparent GIF base64
  const gifBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const up = await tool("upload_exercise_gif", { exercise: "goblet-squat", data_base64: gifBase64 });
  assert.equal(up.ok, true);
  assert.equal(up.exercise, "goblet-squat");
  assert.match(up.gifUrl, /\/api\/exercises\/goblet-squat\.gif$/);

  const res = await call("/api/exercises/goblet-squat.gif");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/gif");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});
await step("the agent reads the guide, the profile and open feedback", async () => {
  const g = await tool("get_plan_guide");
  assert.match(g.guide, /## The loop/);
  const p = await tool("get_profile");
  assert.match(p.about.restrictions, /knee/);
  assert.equal(p.today, today);
  assert.deepEqual(p.shared_with_you.vitals.sort(), ["health_daily", "live_hr", "manual"]);
  assert.equal(p.shared_with_you.photos, "off");
  const f = await tool("get_feedback");
  assert.ok(f.feedback.some((x) => x.tags.includes("pain") && /knee/.test(x.text)), "the seed's note");
});
await step("validate_plan: errors block, the glasses preview fits", async () => {
  const bad = example();
  bad.week.mon.workouts[0].exercises[1].name = "An exercise name far too long for the glasses";
  const v = await tool("validate_plan", { plan: bad });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.path === "week.mon.workouts[0].exercises[1].name"));
  const ok = await tool("validate_plan", { plan: example() });
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  assert.ok(ok.glasses_preview.lines.length > 6);
  for (const l of ok.glasses_preview.lines) assert.ok(textPx(l) <= LINE_PX, `wider than the glasses: ${l}`);
  const refused = await tool("publish_plan", { plan: bad, change_note: "x" });
  assert.equal(refused.published, false);
});
let version;
await step("publish_plan: version 2 from today, the user sees it with the change note", async () => {
  const plan = example();
  plan.starts_on = today;
  delete plan.ends_on;
  plan.week.thu.workouts[0].exercises[3] = { id: "glute-bridge", name: "Glute bridge", sets: 3, reps: 12, load: "bodyweight", rest_sec: 45, cues: ["Ribs down", "Squeeze at the top"] };
  const before = (await tool("get_current_plan")).current.version;
  const p = await tool("publish_plan", { plan, change_note: "Swapped step-ups for glute bridges because of your knee." });
  assert.equal(p.published, true);
  assert.equal(p.version, before + 1);
  assert.equal(p.in_force_today, true);
  version = p.version;
  const cur = await tool("get_current_plan");
  assert.equal(cur.current.version, p.version);
  const web = await call("/api/plan", { auth: session });
  assert.equal(web.body.current.change_note, "Swapped step-ups for glute bridges because of your knee.");
  assert.deepEqual(web.body.versions.slice(0, 2).map((v) => v.version), [p.version, p.version - 1]);
});

// ---------------------------------------------------------------- the user's side
let firstWorkout, firstMeal;
await step("today: the session and the glasses token see the same day", async () => {
  const t = await call(`/api/today?date=${today}`, { auth: session });
  assert.equal(t.status, 200, t.text);
  assert.equal(t.body.plan.version, version);
  const day = example().week[weekday(today)];
  assert.equal(t.body.state.day.title, day.title);
  firstWorkout = t.body.state.workouts[0];
  firstMeal = t.body.state.meals[0];
  const g = await call(`/api/today?date=${today}`, { auth: SEED_DEVICE });
  assert.equal(g.status, 200);
  assert.equal(g.body.state.day.title, day.title);
  assert.equal((await call("/api/today", { auth: session })).status, 400);
});
await step("check-ins: validated against the plan, from glasses and web, reflected in today", async () => {
  assert.ok(firstMeal, "the plan has a meal today");
  const meal = await call("/api/checkins", { method: "POST", auth: SEED_DEVICE, body: { date: today, ref: firstMeal.ref, kind: "meal", status: "done", data: { portion: "less" } } });
  assert.equal(meal.status, 200, meal.text);
  const bad = await call("/api/checkins", { method: "POST", auth: session, body: { date: today, ref: "nope", kind: "meal", status: "done" } });
  assert.equal(bad.status, 422);
  if (firstWorkout) {
    const e = firstWorkout.exercises[0];
    const sets = Array.from({ length: e.exercise.sets }, (_, i) => ({ date: today, ref: `${e.ref}/${i + 1}`, kind: "set", status: "done", data: { avg_hr: 131 } }));
    assert.equal((await call("/api/checkins", { method: "POST", auth: session, body: sets })).status, 200);
  }
  const t = await call(`/api/today?date=${today}`, { auth: session });
  assert.equal(t.body.state.meals[0].status, "done");
  assert.equal(t.body.state.meals[0].portion, "less");
  if (firstWorkout) assert.equal(t.body.state.workouts[0].exercises[0].status, "done");
  const ci = await tool("get_checkins", { from: today, to: today });
  assert.ok(ci.checkins.some((c) => c.source === "glasses" && c.ref === firstMeal.ref));
});
let fbId;
await step("feedback in the moment → the agent reads it, replies, the user sees the reply", async () => {
  const f = await call("/api/feedback", { method: "POST", auth: SEED_DEVICE, body: { date: today, ref: firstMeal.ref, tags: ["hungry"] } });
  assert.equal(f.status, 200, f.text);
  fbId = f.body.id;
  assert.equal((await call("/api/feedback", { method: "POST", auth: session, body: { tags: ["nope"] } })).status, 422);
  const open = await tool("get_feedback", { status: "open" });
  const mine = open.feedback.find((x) => x.id === fbId);
  assert.deepEqual(mine.tags, ["hungry"]);
  assert.equal(mine.source, "glasses");
  await tool("respond_to_feedback", { id: fbId, reply: "Added 30 g of oats to breakfast from next week." });
  const list = await call("/api/feedback", { auth: session });
  const back = list.body.find((x) => x.id === fbId);
  assert.equal(back.status, "addressed");
  assert.match(back.agent_reply, /oats/);
  await assert.rejects(tool("respond_to_feedback", { id: "00000000-0000-4000-8000-000000000000", reply: "x" }), /no such feedback/);
});
await step("progress and the weekly review", async () => {
  const from = new Date(Date.parse(`${today}T12:00:00Z`) - 13 * 86400_000).toISOString().slice(0, 10);
  const p = await call(`/api/progress?from=${from}&to=${today}`, { auth: session });
  assert.equal(p.status, 200);
  assert.equal(p.body.adherence.days.length, 14);
  assert.ok(p.body.adherence.meals.done >= 2);
  const w = await tool("get_weekly_review");
  assert.ok(w.adherence.days.length === 7);
  assert.ok(Array.isArray(w.changes_made_by_user));
});

// ---------------------------------------------------------------- data switches
await step("vitals: sources obey their switches, and so does agent access", async () => {
  assert.equal((await call("/api/vitals", { method: "POST", auth: session, body: [{ date: today, metric: "weight", value: 81.2, source: "health" }, { date: today, metric: "energy", value: 4, source: "manual" }] })).status, 200);
  assert.equal((await call("/api/vitals", { method: "POST", auth: session, body: [{ date: today, metric: "bmi", value: 1 }] })).status, 422);
  const v = await tool("get_vitals", { from: today, to: today });
  assert.ok(v.entries.some((e) => e.metric === "weight" && Number(e.value) === 81.2));
  const s = (await call("/api/settings", { auth: session })).body.settings;
  await call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...s, vitals: { ...s.vitals, manual: false }, agent_access: { ...s.agent_access, vitals: false } } } });
  assert.equal((await call("/api/vitals", { method: "POST", auth: session, body: [{ date: today, metric: "mood", value: 3, source: "manual" }] })).status, 409);
  await assert.rejects(tool("get_vitals"), /hasn't shared vitals/);
  await call("/api/settings", { method: "PUT", auth: session, body: { settings: s } });
});
await step("live heart rate: the phone relays, the glasses read", async () => {
  assert.equal((await call("/api/live", { method: "PUT", auth: session, body: { hr: 142, workout_ref: firstWorkout?.ref ?? "x" } })).status, 200);
  const l = await call("/api/live", { auth: SEED_DEVICE });
  assert.equal(l.body.hr, 142);
  assert.equal((await call("/api/live", { method: "PUT", auth: session, body: { hr: 900 } })).status, 422);
  assert.equal((await call("/api/live", { method: "PUT", auth: SEED_DEVICE, body: { hr: 100 } })).status, 403, "glasses can't write vitals");
});
await step("progress photos: off by default, private, agent sees dates unless allowed", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  assert.equal((await call(`/api/photos?taken_on=${today}`, { method: "POST", auth: session, raw: png, headers: { "Content-Type": "image/png" } })).status, 409);
  const s = (await call("/api/settings", { auth: session })).body.settings;
  await call("/api/settings", { method: "PUT", auth: session, body: { settings: { ...s, vitals: { ...s.vitals, photos: true } } } });
  const up = await call(`/api/photos?taken_on=${today}`, { method: "POST", auth: session, raw: png, headers: { "Content-Type": "image/png" } });
  assert.equal(up.status, 200, up.text);
  const list = await call("/api/photos", { auth: session });
  assert.equal((await fetch(list.body[0].url)).status, 200);
  const agentView = await tool("list_photos", { from: today, to: today });
  assert.equal(agentView.photos.length, 1);
  assert.equal(agentView.photos[0].url, undefined, "dates only without agent_access.photos");
  await call(`/api/photos/${up.body.id}`, { method: "DELETE", auth: session });
  assert.equal((await call("/api/photos", { auth: session })).body.length, 0);
  await call("/api/settings", { method: "PUT", auth: session, body: { settings: s } });
});
await step("settings: defaults for a new user, checked writes, the agent's profile notes", async () => {
  const o = await call("/api/settings", { auth: other });
  assert.equal(o.body.saved, false);
  assert.equal(o.body.settings.reminders.evening.on, true);
  assert.equal(o.body.settings.vitals.photos, false);
  const bad = await call("/api/settings", { method: "PUT", auth: other, body: { settings: { ...o.body.settings, timezone: "Mars/Olympus" } } });
  assert.equal(bad.status, 422);
  const notes = await tool("update_profile_notes", { equipment: "Office gym plus a kettlebell at home" });
  assert.equal(notes.about.equipment, "Office gym plus a kettlebell at home");
  assert.match((await call("/api/settings", { auth: session })).body.settings.about.restrictions, /knee/, "other fields untouched");
});

// ---------------------------------------------------------------- glasses pairing, tokens, OAuth
let device;
await step("pairing: a 6-digit code, single use, a glasses token that can't do more", async () => {
  const c = await call("/api/pairing-code", { method: "POST", auth: session });
  assert.match(c.body.code, /^\d{6}$/);
  const headers = { "CF-Connecting-IP": `198.51.100.${Date.now() % 250}` };
  const p = await call("/api/pair", { method: "POST", body: { code: c.body.code, label: "Test G2" }, headers });
  assert.equal(p.status, 200, p.text);
  device = p.body.device_token;
  assert.match(device, /^fld_/);
  assert.equal((await call("/api/pair", { method: "POST", body: { code: c.body.code }, headers })).status, 400);
  assert.equal((await call(`/api/today?date=${today}`, { auth: device })).status, 200);
  assert.equal((await call("/api/settings", { auth: device })).status, 403);
  assert.equal((await mcpClient(mcpUrl, device).rpc("tools/list")).status, 401);
  const row = (await call("/api/devices", { auth: session })).body.find((d) => d.label === "Test G2");
  await call(`/api/devices/${row.id}`, { method: "DELETE", auth: session });
  assert.equal((await call(`/api/today?date=${today}`, { auth: device })).status, 401);
});
await step("agent tokens: made once, work, revoke", async () => {
  const t = await call("/api/tokens", { method: "POST", auth: session, body: { name: "Test token" } });
  assert.match(t.body.token, /^fla_/);
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
  assert.equal(res.status, 302);
  return { page: new URL(res.headers.get("Location")), cookie: cookiesOf(res) };
}
async function decide(page, cookie, decision, auth) {
  const res = await fetch(`${site}/authorize`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify({ handle: page.searchParams.get("handle"), decision }) });
  return { status: res.status, body: await res.json() };
}
await step("OAuth: register → consent (deny, approve) → token → MCP → disconnect", async () => {
  const reg = await fetch(`${site}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Test coach", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
  assert.equal(reg.status, 201);
  const clientId = (await reg.json()).client_id;
  const first = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s1");
  assert.equal(first.page.pathname, "/oauth/consent/");
  assert.equal((await decide(first.page, first.cookie, "approve", null)).status, 401);
  const denied = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s2");
  assert.equal(new URL((await decide(denied.page, denied.cookie, "deny", null)).body.redirectTo).searchParams.get("error"), "access_denied");
  const verifier = b64url(randomBytes(32));
  const ok = await startAuthorize(clientId, b64url(createHash("sha256").update(verifier).digest()), "s3");
  const back = new URL((await decide(ok.page, ok.cookie, "approve", session)).body.redirectTo);
  const tok = await fetch(`${site}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource: mcpUrl }) });
  const access = (await tok.json()).access_token;
  const viaOAuth = mcpClient(mcpUrl, access);
  assert.equal((await viaOAuth.tool("get_current_plan")).current.version, version);
  const g = (await call("/api/grants", { auth: session })).body.find((x) => x.client_name === "Test coach");
  await call(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE", auth: session });
  assert.equal((await viaOAuth.rpc("tools/list")).status, 401);
});

// ---------------------------------------------------------------- isolation + deletion
await step("RLS: clients read only their own rows; codes aren't readable", async () => {
  const get = async (table, auth) => fetch(`${supabase}/rest/v1/${table}?select=*`, { headers: { apikey: ANON, Authorization: `Bearer ${auth}`, "Accept-Profile": "fitloop" } });
  const mine = await (await get("plans", session)).json();
  assert.ok(mine.length >= 2 && mine.every((p) => p.user_id === SEED_USER));
  assert.deepEqual(await (await get("plans", other)).json(), []);
  assert.deepEqual(await (await get("checkins", other)).json(), []);
  assert.ok((await get("pairing_codes", session)).status >= 400);
});
await step("another user sees none of it; deleting removes only their rows", async () => {
  assert.equal((await call(`/api/today?date=${today}`, { auth: other })).body.plan, null);
  assert.deepEqual((await call("/api/feedback", { auth: other })).body, []);
  await call("/api/feedback", { method: "POST", auth: other, body: { text: "hello" } });
  assert.equal((await call("/api/account", { method: "DELETE", auth: other })).status, 200);
  assert.deepEqual((await call("/api/feedback", { auth: other })).body, []);
  assert.ok((await call("/api/feedback", { auth: session })).body.length >= 2);
});
await step("pages", async () => {
  for (const p of ["/", "/login/", "/today/", "/plan/", "/progress/", "/feedback/", "/settings/", "/support/", "/privacy/", "/oauth/consent/", "/icon.svg"]) assert.equal((await fetch(`${site}${p}`)).status, 200, p);
  assert.equal((await fetch(`${site}/nope`)).status, 404);
});

console.log(`FitLoop integration: ${steps.length} checks passed`);
