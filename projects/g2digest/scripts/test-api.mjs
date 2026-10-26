#!/usr/bin/env node
// Integration test for the G2 Digest Worker against the shared local stack (`supabase start` from
// the repo root, with the g2digest seed) and `npm run dev:worker -w @g2digest/web` (127.0.0.1:8790).
// Covers the acceptance criteria that need a server (PRD §13): sign-in session, pairing with a
// 6-digit code, device-token reads, revocation failing closed, brief edits bumping brief_version,
// stale guide/brief rejection, publish refused without a validated preview, the reference pipeline
// end to end, the podcast feed, per-user isolation, and the MCP OAuth flow.
// Usage: node projects/g2digest/scripts/test-api.mjs [site-origin] [supabase-url]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mcpClient } from "./mcp-client.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const site = (process.argv[2] ?? "http://127.0.0.1:8790").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const mcpUrl = `${site}/mcp`;
const AGENT = "g2a_dev_local_token";
const fixtureDir = join(here, "../packages/core/fixtures/2026-10-22");
const fixture = () => JSON.parse(readFileSync(join(fixtureDir, "bundle.json"), "utf8"));
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
/** A second user, made with the admin API (users are shared by every app; this one only uses G2 Digest). */
async function makeUser(email, password) {
  const res = await fetch(`${supabase}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true }) });
  assert.ok(res.status === 200 || res.status === 422, `create ${email}: ${res.status}`);
  return signIn(email, password);
}

let session, other;
await step("signs in (seed reader) and a second user", async () => {
  session = await signIn("reader@example.com", "g2digest-dev");
  other = await makeUser(`other-${Date.now()}@example.com`, "other-pass-123");
});

// ---------------------------------------------------------------- brief
let briefVersion, brief;
await step("GET /api/brief returns the seeded example brief; a new user gets the starter", async () => {
  const r = await call("/api/brief", { auth: session });
  assert.equal(r.status, 200);
  brief = r.body.brief;
  briefVersion = r.body.brief_version;
  assert.equal(brief.sections.length, 3);
  assert.equal(brief.delivery.time, "13:40");
  const o = await call("/api/brief", { auth: other });
  assert.equal(o.body.brief_version, 1);
  assert.equal(o.body.brief.tldr, true);
  assert.equal(o.body.brief.total_card_budget, 12);
});
await step("brief edits are checked, versioned and conflict-safe", async () => {
  const bad = await call("/api/brief", { method: "PUT", auth: session, body: { brief: { ...brief, sections: [] }, expected_version: briefVersion } });
  assert.equal(bad.status, 422);
  const same = await call("/api/brief", { method: "PUT", auth: session, body: { brief, expected_version: briefVersion } });
  assert.equal(same.body.changed, false);
  const edited = structuredClone(brief);
  edited.units.temperature = "F";
  const ok = await call("/api/brief", { method: "PUT", auth: session, body: { brief: edited, expected_version: briefVersion } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.body.brief_version, briefVersion + 1);
  const stale = await call("/api/brief", { method: "PUT", auth: session, body: { brief, expected_version: briefVersion } });
  assert.equal(stale.status, 409);
  const mcpBrief = await tool("get_user_brief");
  assert.equal(mcpBrief.brief_version, briefVersion + 1);
  assert.equal(mcpBrief.brief.units.temperature, "F");
  briefVersion += 1;
});
await step("the agent's token can't edit the brief or read another user's", async () => {
  assert.equal((await call("/api/brief", { method: "PUT", auth: AGENT, body: { brief } })).status, 401);
  await assert.rejects(tool("get_user_brief", { user_id: "00000000-0000-4000-8000-000000000000" }), /only its own user/);
});

// ---------------------------------------------------------------- MCP + pipeline
await step("MCP: 401 with the OAuth hint, metadata, initialize, six tools", async () => {
  const r = await mcpClient(mcpUrl, null).rpc("tools/list");
  assert.equal(r.status, 401);
  assert.match(r.headers.get("WWW-Authenticate") ?? "", /resource_metadata=/);
  const as = await (await fetch(`${site}/.well-known/oauth-authorization-server`)).json();
  assert.equal(as.token_endpoint, `${site}/token`);
  assert.equal((await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } })).body.result.serverInfo.name, "g2digest");
  const names = (await rpc("tools/list")).body.result.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), ["create_audio_upload", "get_card_authoring_guide", "get_last_cards", "get_user_brief", "publish_cards", "validate_cards"]);
  const g = await tool("get_card_authoring_guide");
  assert.match(g.guide, /guide_version: 0\.4/);
});
await step("validate_cards rejects a stale guide and a stale brief", async () => {
  const b = fixture();
  b.brief_version = briefVersion;
  const v1 = await tool("validate_cards", { bundle: { ...b, guide_version: "0.1" } });
  assert.ok(v1.errors.some((e) => e.code === "E_GUIDE_STALE"));
  const v2 = await tool("validate_cards", { bundle: { ...b, brief_version: briefVersion - 1 } });
  assert.ok(v2.errors.some((e) => e.code === "E_BRIEF_STALE"));
  assert.equal(v2.preview_hash, null);
});
await step("publish without a validated preview is refused (E_NO_PREVIEW)", async () => {
  const p = await tool("publish_cards", { bundle: fixture(), preview_hash: "0".repeat(64) });
  assert.equal(p.published, false);
  assert.equal(p.errors[0].code, "E_NO_PREVIEW");
});
await step("inline audio upload stores the file", async () => {
  const bytes = readFileSync(join(fixtureDir, "audio/tldr-glance.mp3"));
  const up = await tool("create_audio_upload", { date: "2026-10-21", slug: "tldr", kind: "glance", content_type: "audio/mpeg", data_base64: bytes.toString("base64") });
  assert.equal(up.stored, true);
  assert.equal(up.audio_path, "2026-10-21/tldr-glance.mp3");
  await assert.rejects(tool("create_audio_upload", { date: "2026-10-21", slug: "Bad Slug", kind: "glance", content_type: "audio/mpeg" }), /kebab/);
});
let runLog = "";
await step("the reference pipeline publishes the fixture end to end, with the snapshot in its run log", async () => {
  const log = join(process.env.RUNNER_TEMP ?? "/tmp", `g2digest-run-${Date.now()}.log`);
  execFileSync("node", [join(here, "publish-bundle.mjs"), "--site", site, "--token", AGENT, "--bundle", join(fixtureDir, "bundle.json"), "--audio", join(fixtureDir, "audio"), "--log", log], { stdio: "pipe" });
  runLog = readFileSync(log, "utf8");
  assert.match(runLog, /preview snapshot:/);
  assert.match(runLog, /#4 2026-10-22-proteina-binders/);
  assert.match(runLog, /published 2026-10-22: 7 cards/);
});
await step("a changed brief makes the published bundle stale for the next publish", async () => {
  const b = fixture();
  b.brief_version = briefVersion;
  const restored = await call("/api/brief", { method: "PUT", auth: session, body: { brief, expected_version: briefVersion } });
  assert.equal(restored.body.brief_version, briefVersion + 1);
  const v = await tool("validate_cards", { bundle: b });
  assert.ok(v.errors.some((e) => e.code === "E_BRIEF_STALE"));
  briefVersion += 1;
});
await step("get_last_cards returns a section's last cards to carry", async () => {
  const r = await tool("get_last_cards", { section_id: "markets", before: "2026-10-23" });
  assert.equal(r.date, "2026-10-22");
  assert.equal(r.cards[0].carried_from, "2026-10-22");
});

// ---------------------------------------------------------------- pairing
let device, code;
await step("pairing: a 6-digit code, single use, for a device token", async () => {
  assert.equal((await call("/api/pairing-code", { method: "POST" })).status, 401, "needs a session");
  const c = await call("/api/pairing-code", { method: "POST", auth: session });
  code = c.body.code;
  assert.match(code, /^\d{6}$/);
  assert.ok(Date.parse(c.body.expires_at) - Date.now() <= 10 * 60_000 + 5000);
  const headers = { "CF-Connecting-IP": `198.51.100.${Date.now() % 250}` };
  const p = await call("/api/pair", { method: "POST", body: { code, label: "Test G2" }, headers });
  assert.equal(p.status, 200, p.text);
  device = p.body.device_token;
  assert.match(device, /^g2d_/);
  assert.equal((await call("/api/pair", { method: "POST", body: { code }, headers })).status, 400, "single use");
});
await step("the device token reads the latest edition with signed audio, and nothing else", async () => {
  const e = await call("/api/editions/latest", { auth: device });
  assert.equal(e.status, 200);
  assert.equal(e.body.date, "2026-10-22");
  assert.equal(e.body.bundle.cards.length, 7);
  const url = e.body.audio["2026-10-22/proteina-binders-deep-dive.mp3"];
  const audio = await fetch(url);
  assert.equal(audio.status, 200);
  assert.ok((await audio.arrayBuffer()).byteLength > 100_000);
  assert.equal((await call("/api/brief", { auth: device })).status, 403);
  assert.equal((await call("/api/pairing-code", { method: "POST", auth: device })).status, 403);
  assert.equal((await mcpClient(mcpUrl, device).rpc("tools/list")).status, 401);
});
await step("another user sees none of it", async () => {
  assert.equal((await call("/api/editions/latest", { auth: other })).status, 404);
  const devs = await call("/api/devices", { auth: other });
  assert.deepEqual(devs.body, []);
  // RLS: direct PostgREST reads with the other user's session return no rows of the reader's.
  const res = await fetch(`${supabase}/rest/v1/editions?select=date`, { headers: { apikey: ANON, Authorization: `Bearer ${other}`, "Accept-Profile": "g2digest" } });
  assert.deepEqual(await res.json(), []);
  const mine = await fetch(`${supabase}/rest/v1/editions?select=date`, { headers: { apikey: ANON, Authorization: `Bearer ${session}`, "Accept-Profile": "g2digest" } });
  assert.ok((await mine.json()).some((r) => r.date === "2026-10-22"));
  const codes = await fetch(`${supabase}/rest/v1/pairing_codes?select=code_hash`, { headers: { apikey: ANON, Authorization: `Bearer ${session}`, "Accept-Profile": "g2digest" } });
  assert.ok(codes.status >= 400, "pairing codes aren't readable by clients");
});
await step("revoking the device fails closed", async () => {
  const list = await call("/api/devices", { auth: session });
  const row = list.body.find((d) => d.label === "Test G2");
  assert.ok(row);
  assert.equal((await call(`/api/devices/${row.id}`, { method: "DELETE", auth: other })).status, 200);
  assert.equal((await call("/api/editions/latest", { auth: device })).status, 200, "someone else can't revoke it");
  await call(`/api/devices/${row.id}`, { method: "DELETE", auth: session });
  assert.equal((await call("/api/editions/latest", { auth: device })).status, 401);
});
await step("wrong codes are throttled", async () => {
  let last;
  // Its own client address (Cloudflare sets CF-Connecting-IP in production), so re-runs aren't throttled.
  const headers = { "CF-Connecting-IP": `203.0.113.${Date.now() % 250}` };
  for (let i = 0; i < 11; i++) last = await call("/api/pair", { method: "POST", body: { code: "000000" }, headers });
  assert.equal(last.status, 429);
  const fresh = await call("/api/pairing-code", { method: "POST", auth: session });
  assert.equal((await call("/api/pair", { method: "POST", body: { code: fresh.body.code }, headers })).status, 429, "even a right code waits out the window");
});

// ---------------------------------------------------------------- podcast feed fallback
await step("podcast feed: episodes in card order, audio redirects, revocable", async () => {
  const f = await call("/api/feeds", { method: "POST", auth: session });
  const url = f.body.url;
  assert.match(url, /\/feed\/g2f_[\w-]+\/podcast\.xml$/);
  const path = new URL(url).pathname;
  const xml = (await call(path)).text;
  const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].map((m) => m[1]).slice(1);
  assert.match(titles[0], /2026-10-22 · 1\. Protein binders hit 41% \(glance\)/);
  assert.ok(titles.some((t) => /RFD4-Proteina binder hit rate: 41% \(deep dive\)/.test(t)));
  const enclosure = xml.match(/enclosure url="([^"]+)"/)[1];
  const redirect = await fetch(enclosure, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal((await call("/api/editions/latest", { auth: path.split("/")[2] })).status, 401, "feed token can't use the API");
  const feedRow = (await call("/api/devices", { auth: session })).body.find((d) => d.id === f.body.id);
  await call(`/api/devices/${feedRow.id}`, { method: "DELETE", auth: session });
  assert.equal((await call(path)).status, 403);
});

// ---------------------------------------------------------------- agent tokens + OAuth
await step("agent tokens: made once, work, revoke", async () => {
  const t = await call("/api/tokens", { method: "POST", auth: session, body: { name: "Test agent token" } });
  assert.match(t.body.token, /^g2a_/);
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
  const reg = await fetch(`${site}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Test builder", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) });
  assert.equal(reg.status, 201);
  const clientId = (await reg.json()).client_id;
  const first = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s1");
  assert.equal(first.page.pathname, "/oauth/consent/");
  assert.equal((await fetch(first.page)).status, 200, "consent page is served");
  assert.equal((await decide(first.page, first.cookie, "approve", null)).status, 401, "approve needs a session");
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
  assert.equal((await viaOAuth.tool("get_user_brief")).user_id, "00000000-0000-4000-8000-0000000002d1");
  const grants = await call("/api/grants", { auth: session });
  const g = grants.body.find((x) => x.client_name === "Test builder");
  await call(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE", auth: session });
  assert.equal((await viaOAuth.rpc("tools/list")).status, 401);
});

// ---------------------------------------------------------------- deleting your data
await step("delete all my data: brief, devices, tokens and audio go; the next sign-in starts fresh", async () => {
  const userId = JSON.parse(Buffer.from(other.split(".")[1], "base64url").toString()).sub;
  const brief = (await call("/api/brief", { auth: other })).body;
  assert.equal((await call("/api/brief", { method: "PUT", auth: other, body: { brief: { ...brief.brief, title: "Doomed brief" }, expected_version: brief.brief_version } })).status, 200);
  const code = (await call("/api/pairing-code", { method: "POST", auth: other })).body.code;
  const device = (await call("/api/pair", { method: "POST", body: { code, label: "Doomed glasses" }, headers: { "CF-Connecting-IP": "10.9.9.9" } })).body.device_token;
  const agent = (await call("/api/tokens", { method: "POST", auth: other, body: { name: "Doomed agent" } })).body.token;
  const audio = `${supabase}/storage/v1/object/g2digest/${userId}/2026-10-22/doomed-glance.mp3`;
  const up = await fetch(audio, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "audio/mpeg" }, body: new Uint8Array([1, 2, 3]) });
  assert.equal(up.status, 200, `upload: ${await up.text()}`);

  assert.equal((await call("/api/account", { method: "DELETE" })).status, 401);
  assert.equal((await call("/api/account", { method: "DELETE", auth: other })).status, 200);
  assert.equal((await call("/api/editions/latest", { auth: device })).status, 401);
  assert.equal((await mcpClient(mcpUrl, agent).rpc("tools/list")).status, 401);
  assert.deepEqual((await call("/api/devices", { auth: other })).body, []);
  assert.equal((await fetch(audio, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).status, 400);
  const fresh = await call("/api/brief", { auth: other });
  assert.equal(fresh.status, 200);
  assert.notEqual(fresh.body.brief.title, "Doomed brief");
  // The reader's data is untouched.
  assert.equal((await call("/api/editions/latest", { auth: session })).status, 200);
});

// ---------------------------------------------------------------- pages
await step("pages: home, pretty edition/preview routes, plugin page, spike, fixture audio, privacy, support, terms", async () => {
  for (const p of ["/", "/login/", "/pair/", "/brief/", "/edition/2026-10-22", "/preview/latest", "/preview/fixture", "/agents/", "/glasses/", "/spike/", "/privacy/", "/support/", "/terms/"]) {
    const r = await fetch(`${site}${p}`);
    assert.equal(r.status, 200, p);
  }
  const a = await fetch(`${site}/fixture/2026-10-22/proteina-binders-deep-dive.mp3`);
  assert.equal(a.status, 200);
  assert.equal((await fetch(`${site}/nope`)).status, 404);
});

console.log(`G2 Digest integration: ${steps.length} checks passed`);
