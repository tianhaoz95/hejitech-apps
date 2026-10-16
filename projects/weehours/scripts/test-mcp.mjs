#!/usr/bin/env node
// Integration test for the site Worker's MCP server and its OAuth endpoints, against the shared local
// stack (`supabase start` from the repo root, with the Wee Hours seed) and `npm run dev:worker -w
// @weehours/web` (127.0.0.1:8788). Covers personal access tokens and the full OAuth flow an agent
// goes through: register, authorize, consent (approve and deny), token, MCP, revoke.
// Usage: node scripts/test-mcp.mjs [site-origin] [supabase-url]
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const site = (process.argv[2] ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const mcp = `${site}/mcp`;
const pat = "wh_dev_local_token";
let id = 0;

async function rpc(method, params = {}, auth = pat) {
  const res = await fetch(mcp, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON (e.g. a 401 body) */ }
  return { status: res.status, headers: res.headers, body };
}
async function tool(name, args = {}, auth = pat) {
  const r = await rpc("tools/call", { name, arguments: args }, auth);
  assert.equal(r.status, 200);
  const result = r.body.result;
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
}

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ✓ ${name}`); };

// ---------------------------------------------------------------- personal access token

await step("rejects a missing token with the OAuth discovery hint", async () => {
  const r = await rpc("tools/list", {}, null);
  assert.equal(r.status, 401);
  assert.match(r.headers.get("WWW-Authenticate") ?? "", /resource_metadata=/);
});
await step("serves OAuth metadata", async () => {
  const as = await (await fetch(`${site}/.well-known/oauth-authorization-server`)).json();
  assert.equal(as.authorization_endpoint, `${site}/authorize`);
  assert.equal(as.token_endpoint, `${site}/token`);
  assert.ok(as.registration_endpoint);
});
await step("initialize", async () => {
  const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(r.body.result.serverInfo.name, "wee-hours");
});
await step("tools/list", async () => {
  const r = await rpc("tools/list");
  const names = r.body.result.tools.map((t) => t.name);
  for (const n of ["get_status", "list_events", "log_event", "get_baby_profile", "resolve_duplicate"]) assert.ok(names.includes(n), n);
});
await step("baby profile has birth date and age", async () => {
  const p = await tool("get_baby_profile");
  assert.ok(p.birth_date);
  assert.ok(p.age_days >= 20);
});
let logged;
await step("log_event validates and appends", async () => {
  await assert.rejects(tool("log_event", { type: "diaper", fields: { kind: "purple" } }), /invalid kind/);
  logged = await tool("log_event", { type: "diaper", fields: { kind: "dirty" } });
  assert.ok(logged.logged);
});
await step("status reflects the new entry", async () => {
  const s = await tool("get_status");
  assert.match(s.line, /diaper just now/);
});
await step("list_events returns raw rows with ml", async () => {
  const rows = await tool("list_events", { types: ["feed.bottle"] });
  assert.ok(rows.length > 0);
  assert.ok(rows.some((r) => typeof r.ml === "number"));
});
await step("undo removes it from status", async () => {
  await tool("undo_event", { id: logged.logged });
  const s = await tool("get_status");
  assert.doesNotMatch(s.line, /diaper just now/);
});
await step("rejects an unknown access token", async () => {
  assert.equal((await rpc("tools/list", {}, "wh_not_a_real_token")).status, 401);
});

// ---------------------------------------------------------------- OAuth (the Worker is the authorization server)

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const redirectUri = "http://127.0.0.1:9999/callback";
const cookiesOf = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

/** Supabase session for a seeded parent, as the site's supabase-js would hold it. */
async function signIn(email) {
  const res = await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "newborn-dev" }),
  });
  assert.equal(res.status, 200, "seeded sign-in");
  return (await res.json()).access_token;
}

/** GET /authorize like a browser: returns the consent page URL and the binding cookie. */
async function startAuthorize(clientId, challenge, state) {
  const u = new URL(`${site}/authorize`);
  for (const [k, v] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "mcp", state, code_challenge: challenge, code_challenge_method: "S256", resource: mcp })) u.searchParams.set(k, v);
  const res = await fetch(u, { redirect: "manual" });
  assert.equal(res.status, 302, `authorize → ${res.status} ${await res.clone().text()}`);
  const page = new URL(res.headers.get("Location"));
  return { page, cookie: cookiesOf(res) };
}
async function decide(page, cookie, decision, session) {
  const res = await fetch(`${site}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(session ? { Authorization: `Bearer ${session}` } : {}) },
    body: JSON.stringify({ handle: page.searchParams.get("handle"), decision }),
  });
  return { status: res.status, body: await res.json() };
}

let clientId, session, oauthToken;
await step("dynamic client registration", async () => {
  const res = await fetch(`${site}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Test agent", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  });
  assert.equal(res.status, 201);
  clientId = (await res.json()).client_id;
  assert.ok(clientId);
});
await step("authorize redirects to the consent page with the client's details", async () => {
  const { page } = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s0");
  assert.equal(page.pathname, "/oauth/consent/");
  assert.ok(page.searchParams.get("handle"));
  assert.equal(page.searchParams.get("client"), "Test agent");
  assert.equal(page.searchParams.get("loopback"), "1");
  assert.equal((await fetch(page)).status, 200, "consent page is served");
});
await step("approving needs the Supabase session", async () => {
  const { page, cookie } = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s1");
  const r = await decide(page, cookie, "approve", null);
  assert.equal(r.status, 401);
});
await step("deny returns access_denied to the client", async () => {
  const { page, cookie } = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s2");
  const r = await decide(page, cookie, "deny", null);
  const back = new URL(r.body.redirectTo);
  assert.equal(back.searchParams.get("error"), "access_denied");
  assert.equal(back.searchParams.get("state"), "s2");
});
await step("approve → code → token (PKCE)", async () => {
  session = await signIn("parent1@example.com");
  const verifier = b64url(randomBytes(32));
  const { page, cookie } = await startAuthorize(clientId, b64url(createHash("sha256").update(verifier).digest()), "s3");
  const r = await decide(page, cookie, "approve", session);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const back = new URL(r.body.redirectTo);
  assert.equal(back.origin + back.pathname, redirectUri);
  assert.equal(back.searchParams.get("state"), "s3");
  const res = await fetch(`${site}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource: mcp }),
  });
  const t = await res.json();
  assert.equal(res.status, 200, JSON.stringify(t));
  oauthToken = t.access_token;
  assert.ok(oauthToken && t.refresh_token);
});
await step("the OAuth token reads and writes the signed-in user's household", async () => {
  const names = (await rpc("tools/list", {}, oauthToken)).body.result.tools.map((t) => t.name);
  assert.ok(names.includes("log_event"));
  const p = await tool("get_baby_profile", {}, oauthToken);
  assert.equal(p.household, "Dev household");
});
let grantId;
await step("the account page lists the connected assistant", async () => {
  const res = await fetch(`${site}/api/grants`, { headers: { Authorization: `Bearer ${session}` } });
  assert.equal(res.status, 200);
  const grants = await res.json();
  const g = grants.find((x) => x.client_name === "Test agent");
  assert.ok(g, JSON.stringify(grants));
  grantId = g.id;
  assert.equal((await fetch(`${site}/api/grants`)).status, 401, "needs a session");
});
await step("another user can't revoke it; disconnecting does", async () => {
  const other = await signIn("parent2@example.com");
  await fetch(`${site}/api/grants/${grantId}`, { method: "DELETE", headers: { Authorization: `Bearer ${other}` } });
  assert.equal((await rpc("tools/list", {}, oauthToken)).status, 200, "still connected");
  const res = await fetch(`${site}/api/grants/${grantId}`, { method: "DELETE", headers: { Authorization: `Bearer ${session}` } });
  assert.equal(res.status, 200);
  assert.equal((await rpc("tools/list", {}, oauthToken)).status, 401);
});
console.log(`MCP integration: ${steps.length} checks passed`);
