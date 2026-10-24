#!/usr/bin/env node
// Integration test for the glasses' API on the site Worker (services/web/src/worker/glasses.ts),
// against the shared local stack (`supabase start`, Wee Hours seed) and `npm run dev:worker -w
// @weehours/web` (127.0.0.1:8788): a phone session gets a pairing code, the glasses trade it for a
// device token, read state, send events and a capture, and lose access when the token is revoked.
// Usage: node scripts/test-glasses-api.mjs [site-origin] [supabase-url]
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const site = (process.argv[2] ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
// Each run throttles under its own address (the Worker counts wrong codes per CF-Connecting-IP).
const IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ✓ ${name}`); };

async function call(method, path, { auth, body, type = "application/json", ip = IP } = {}) {
  const res = await fetch(`${site}${path}`, {
    method,
    headers: { "Content-Type": type, "CF-Connecting-IP": ip, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : type === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, headers: res.headers };
}

async function signIn(email, password) {
  const res = await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, "seed sign-in");
  return (await res.json()).access_token;
}
const rest = async (jwt, path, init = {}) => {
  const res = await fetch(`${supabase}/rest/v1/${path}`, {
    ...init, headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Accept-Profile": "weehours", "Content-Profile": "weehours", "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;   // void RPCs answer with an empty body
};

const LABEL = `Test G2 ${randomUUID().slice(0, 8)}`;
const NAME = encodeURIComponent(`glasses:${LABEL}`);
const phone = await signIn("parent1@example.com", "newborn-dev");
let code, token, state;

await step("CORS preflight is allowed (the plugin's WebView origin varies)", async () => {
  const res = await fetch(`${site}/api/glasses/state`, { method: "OPTIONS" });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(res.headers.get("Access-Control-Allow-Headers") ?? "", /Authorization/);
});
await step("a pairing code needs the phone's session", async () => {
  assert.equal((await call("POST", "/api/glasses/pairing-code")).status, 401);
});
await step("the phone gets a 6-digit code", async () => {
  const r = await call("POST", "/api/glasses/pairing-code", { auth: phone });
  assert.equal(r.status, 200);
  assert.match(r.json.code, /^\d{6}$/);
  assert.ok(Date.parse(r.json.expires_at) > Date.now() + 9 * 60_000);
  code = r.json.code;
});
await step("asking again replaces the old code", async () => {
  const r = await call("POST", "/api/glasses/pairing-code", { auth: phone });
  assert.notEqual(r.json.code, code);
  const old = await call("POST", "/api/glasses/pair", { body: { code } });
  assert.equal(old.status, 400);
  code = r.json.code;
});
await step("a wrong code is refused", async () => {
  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  const r = await call("POST", "/api/glasses/pair", { body: { code: wrong } });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /didn't work/);
});
await step("the glasses trade the code for a device token", async () => {
  const r = await call("POST", "/api/glasses/pair", { body: { code: `${code.slice(0, 3)} ${code.slice(3)}`, label: LABEL } });
  assert.equal(r.status, 200);
  assert.match(r.json.token, /^wh_[0-9a-f]{48}$/);
  assert.ok(r.json.household.id);
  token = r.json.token;
});
await step("a code works once", async () => {
  assert.equal((await call("POST", "/api/glasses/pair", { body: { code } })).status, 400);
});
await step("the token shows up on the phone as glasses", async () => {
  const rows = await rest(phone, `access_tokens?select=name,scope,revoked_at&name=eq.${NAME}`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scope, "write");
});
await step("state: household, children, recent events, pending captures", async () => {
  assert.equal((await call("GET", "/api/glasses/state")).status, 401);
  const r = await call("GET", "/api/glasses/state", { auth: token });
  assert.equal(r.status, 200);
  state = r.json;
  assert.ok(state.me.id);
  assert.ok(state.household.id);
  assert.ok(["bottle", "breast"].includes(state.household.default_feed));
  assert.ok(state.children.length >= 1 && state.children[0].name);
  assert.ok(Array.isArray(state.events));
  assert.equal(typeof state.pending_captures, "number");
});

const baby = () => state.children.find((c) => !c.expected).id;
const ev = (type, fields = {}, extra = {}) => {
  const now = new Date().toISOString();
  return { id: randomUUID(), household_id: "ignored", baby_id: baby(), type, fields, occurred_at: now, logged_at: now, logged_by: "ignored", provenance: { surface: "ring", input: "gesture" }, supersedes: null, ...extra };
};
let start;

await step("gesture events are stored with the device's identity, not the client's", async () => {
  start = ev("feed.bottle.start");
  const diaper = ev("diaper", { kind: "dirty" }, { provenance: { surface: "glasses", input: "voice" } });
  const r = await call("POST", "/api/glasses/events", { auth: token, body: { events: [start, diaper] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.accepted, [start.id, diaper.id]);
  assert.deepEqual(r.json.rejected, []);
  const rows = await rest(phone, `events?id=in.(${start.id},${diaper.id})&select=id,household_id,logged_by,provenance,type&order=seq`);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.household_id, state.household.id);
    assert.equal(row.logged_by, state.me.id);
    assert.equal(row.provenance.input, "gesture");
  }
  assert.equal(rows[1].provenance.surface, "glasses");
});
await step("re-sending the same outbox is harmless", async () => {
  const r = await call("POST", "/api/glasses/events", { auth: token, body: { events: [start] } });
  assert.equal(r.status, 200);
  assert.equal((await rest(phone, `events?id=eq.${start.id}&select=id`)).length, 1);
});
await step("undo and duty are allowed; invalid entries are rejected one by one", async () => {
  const undo = ev("undo", {}, { supersedes: start.id });
  const bad = [
    ev("diaper", { kind: "sparkly" }),
    ev("photo", { path: "photos/x.jpg" }),
    ev("note", { transcript: "hi" }),
    ev("feed.bottle.start", {}, { baby_id: randomUUID() }),
    ev("undo"),
    { ...ev("sleep.start"), id: "not-a-uuid" },
  ];
  const r = await call("POST", "/api/glasses/events", { auth: token, body: { events: [undo, ev("duty", { caregiver: state.me.id }), ...bad] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.accepted.length, 2);
  assert.equal(r.json.rejected.length, bad.length);
  assert.ok(r.json.rejected.every((x) => x.error));
});
await step("a capture uploads its WAV and waits for a phone", async () => {
  const id = randomUUID();
  const wav = Buffer.alloc(3244);
  wav.write("RIFF", 0);
  const q = new URLSearchParams({ id, surface: "ring", captured_at: new Date().toISOString(), attach_to: start.id });
  const r = await call("POST", `/api/glasses/captures?${q}`, { auth: token, body: wav, type: "audio/wav" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [cap] = await rest(phone, `captures?id=eq.${id}&select=status,attach_to,audio_path,logged_by,surface`);
  assert.equal(cap.status, "pending");
  assert.equal(cap.attach_to, start.id);
  assert.equal(cap.audio_path, `${state.household.id}/${id}.wav`);
  assert.equal(cap.logged_by, state.me.id);
  const file = await fetch(`${supabase}/storage/v1/object/authenticated/weehours/${cap.audio_path}`, { headers: { apikey: ANON, Authorization: `Bearer ${phone}` } });
  assert.equal(file.status, 200, "the phone can download the audio");
  assert.equal((await file.arrayBuffer()).byteLength, wav.length);
  const s = await call("GET", "/api/glasses/state", { auth: token });
  assert.ok(s.json.pending_captures >= 1);
});
await step("bad capture requests are refused", async () => {
  const q = new URLSearchParams({ id: "nope", surface: "ring" });
  assert.equal((await call("POST", `/api/glasses/captures?${q}`, { auth: token, body: Buffer.alloc(100), type: "audio/wav" })).status, 400);
  const q2 = new URLSearchParams({ id: randomUUID(), surface: "phone" });
  assert.equal((await call("POST", `/api/glasses/captures?${q2}`, { auth: token, body: Buffer.alloc(100), type: "audio/wav" })).status, 400);
});
await step("too many wrong codes are throttled", async () => {
  const ip = "10.250.250.250-" + randomUUID();
  let last;
  for (let i = 0; i < 11; i++) last = await call("POST", "/api/glasses/pair", { body: { code: "000000" }, ip });
  assert.equal(last.status, 429);
});
await step("revoking the token on the phone unpairs the glasses", async () => {
  const [row] = await rest(phone, `access_tokens?select=id&name=eq.${NAME}&revoked_at=is.null`);
  await rest(phone, "rpc/revoke_access_token", { method: "POST", body: JSON.stringify({ p_id: row.id }) });
  const r = await call("GET", "/api/glasses/state", { auth: token });
  assert.equal(r.status, 401);
  assert.match(r.json.error, /pair them again/);
  await rest(phone, "rpc/delete_access_token", { method: "POST", body: JSON.stringify({ p_id: row.id }) });
});

console.log(`glasses API: ${steps.length} checks passed`);
