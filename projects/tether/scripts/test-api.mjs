#!/usr/bin/env node
// Integration test for the Tether Worker against the shared local stack (`supabase start` from the
// repo root, with the tether seed) and `npm run dev:worker -w @tether/web` (127.0.0.1:8796).
// Covers: sign-in sessions, workspace pane tree sync, PRD §14 secret rejection, SSH host metadata,
// bookmarks, MCP tools, OAuth 2.1 flow & personal access tokens, RLS isolation, account deletion,
// and static pages.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mcpClient } from "./mcp-client.mjs";

const site = (process.argv[2] ?? "http://127.0.0.1:8796").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const mcpUrl = `${site}/mcp`;
const AGENT = "ttr_dev_local_token";
const SEED_USER = "00000000-0000-4000-8000-000000007e74";
const { rpc, tool } = mcpClient(mcpUrl, AGENT);

const steps = [];
const step = async (name, fn) => {
  await fn();
  steps.push(name);
  console.log(`  ✓ ${name}`);
};

async function signIn(email, password) {
  const res = await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `sign-in ${email}`);
  return (await res.json()).access_token;
}

async function call(path, { method = "GET", auth, body, headers = {} } = {}) {
  const res = await fetch(`${site}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

async function makeUser(email, password) {
  const res = await fetch(`${supabase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.ok(res.status === 200 || res.status === 422, `create ${email}: ${res.status}`);
  return signIn(email, password);
}

let session, other;
await step("signs in (seed developer) and a second user", async () => {
  session = await signIn("dev@example.com", "tether-dev");
  other = await makeUser(`other-${Date.now()}@example.com`, "other-pass-123");
});

await step("public status endpoint returns tools and shortcuts", async () => {
  const s = await call("/api/status");
  assert.equal(s.status, 200);
  assert.equal(s.body.service, "tether");
  assert.deepEqual(s.body.tools, ["web", "ssh", "files"]);
  assert.equal(s.body.max_panes, 4);
  assert.ok(Array.isArray(s.body.shortcuts) && s.body.shortcuts.length >= 10);
});

await step("workspace API: reads seed workspace, rejects secrets (PRD §14), saves valid tree", async () => {
  assert.equal((await call("/api/workspace")).status, 401);
  const w = await call("/api/workspace", { auth: session });
  assert.equal(w.status, 200);
  assert.equal(w.body.saved, true);
  assert.equal(w.body.tree.focusedPaneId, "pane-1");

  const leaked = await call("/api/workspace", {
    method: "PUT",
    auth: session,
    body: { tree: { ...w.body.tree, password: "secret" } },
  });
  assert.equal(leaked.status, 422);

  const o = await call("/api/workspace", { auth: other });
  assert.equal(o.body.saved, false);
  const ok = await call("/api/workspace", {
    method: "PUT",
    auth: other,
    body: { tree: o.body.tree, settings: { terminalFontSize: 16 } },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.settings.terminalFontSize, 16);
});

await step("SSH hosts & bookmarks API: enforces non-secret rule and CRUD", async () => {
  const badHost = await call("/api/hosts", {
    method: "POST",
    auth: session,
    body: { id: "h-bad", host: "example.invalid", port: 22, username: "dev", auth: "password", password: "leaked" },
  });
  assert.equal(badHost.status, 422);

  const goodHost = await call("/api/hosts", {
    method: "POST",
    auth: session,
    body: { id: "h-2", host: "build.example.invalid", port: 2222, username: "builder", auth: "key" },
  });
  assert.equal(goodHost.status, 201);
  assert.equal(goodHost.body.port, 2222);

  const hosts = await call("/api/hosts", { auth: session });
  assert.ok(hosts.body.some((h) => h.id === "h-2"));

  const bm = await call("/api/bookmarks", {
    method: "POST",
    auth: session,
    body: { id: "bm-2", title: "MDN Docs", url: "https://developer.mozilla.org" },
  });
  assert.equal(bm.status, 201);
});

await step("MCP: 401 with OAuth hint, initialize, tools/list, tools/call", async () => {
  const r = await mcpClient(mcpUrl, null).rpc("tools/list");
  assert.equal(r.status, 401);
  assert.match(r.headers.get("WWW-Authenticate") ?? "", /resource_metadata=/);
  assert.equal(
    (await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }))
      .body.result.serverInfo.name,
    "tether"
  );
  const ws = await tool("get_workspace");
  assert.equal(ws.pane_count, 2);
  const preset = await tool("apply_layout_preset", { preset: "three_columns" });
  assert.equal(preset.pane_count, 3);
  const tab = await tool("open_tab", { type: "web", url: "https://example.org" });
  assert.equal(tab.tab.type, "web");
});

await step("agent tokens: create, use, revoke", async () => {
  const t = await call("/api/tokens", { method: "POST", auth: session, body: { name: "Test token" } });
  assert.match(t.body.token, /^ttr_/);
  assert.equal((await mcpClient(mcpUrl, t.body.token).rpc("tools/list")).status, 200);
  await call(`/api/tokens/${t.body.id}`, { method: "DELETE", auth: session });
  assert.equal((await mcpClient(mcpUrl, t.body.token).rpc("tools/list")).status, 401);
});

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const redirectUri = "http://127.0.0.1:9999/callback";
const cookiesOf = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
async function startAuthorize(clientId, challenge, state) {
  const u = new URL(`${site}/authorize`);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "mcp",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: mcpUrl,
  }))
    u.searchParams.set(k, v);
  const res = await fetch(u, { redirect: "manual" });
  assert.equal(res.status, 302, `authorize → ${res.status}`);
  return { page: new URL(res.headers.get("Location")), cookie: cookiesOf(res) };
}
async function decide(page, cookie, decision, auth) {
  const res = await fetch(`${site}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ handle: page.searchParams.get("handle"), decision }),
  });
  return { status: res.status, body: await res.json() };
}

await step("OAuth 2.1: register → consent (deny, approve) → token → MCP → disconnect", async () => {
  const reg = await fetch(`${site}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Test assistant",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
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
  const tok = await fetch(`${site}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: back.searchParams.get("code"),
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
      resource: mcpUrl,
    }),
  });
  const access = (await tok.json()).access_token;
  assert.ok(access);
  const viaOAuth = mcpClient(mcpUrl, access);
  assert.ok((await viaOAuth.tool("get_workspace")).pane_count >= 1);
  const grants = await call("/api/grants", { auth: session });
  const g = grants.body.find((x) => x.client_name === "Test assistant");
  await call(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE", auth: session });
  assert.equal((await viaOAuth.rpc("tools/list")).status, 401);
});

await step("RLS isolation and account deletion", async () => {
  const get = async (table, auth) =>
    fetch(`${supabase}/rest/v1/${table}?select=*`, {
      headers: { apikey: ANON, Authorization: `Bearer ${auth}`, "Accept-Profile": "tether" },
    });
  const mine = await (await get("workspaces", session)).json();
  assert.equal(mine.length, 1);
  assert.equal(mine[0].user_id, SEED_USER);
  const theirs = await (await get("workspaces", other)).json();
  assert.ok(theirs.every((p) => p.user_id !== SEED_USER));

  assert.equal((await call("/api/account", { method: "DELETE", auth: other })).status, 200);
  assert.equal((await call("/api/workspace", { auth: other })).body.saved, false);
  assert.equal((await call("/api/workspace", { auth: session })).body.saved, true);
});

await step("static pages", async () => {
  for (const p of ["/", "/login/", "/settings/", "/support/", "/privacy/", "/terms/", "/oauth/consent/", "/icon.svg"]) {
    assert.equal((await fetch(`${site}${p}`)).status, 200, p);
  }
  assert.equal((await fetch(`${site}/nope`)).status, 404);
});

console.log(`Tether integration: ${steps.length} checks passed`);
