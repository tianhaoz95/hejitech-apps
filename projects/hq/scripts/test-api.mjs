#!/usr/bin/env node
// Integration test against a running HQ Worker and the local Supabase stack (CI: `supabase start`,
// then `npm run dev:worker -w @hq/web`). Two teams sign up, each with its own workspace (one repo);
// it drives the whole loop in one and proves the other can't see or touch it: sign-in → workspace →
// invites and roles → tokens → sync → propose (and every refusal) → rank → figures → requests (ask,
// claim, propose, answer, follow up) → approve → claim → build →
// review → discuss → verbs (tier and role checks) → pause → schedule → isolation → audit.
//
//   node projects/hq/scripts/test-api.mjs     (HQ_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY default to local)
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const U = process.env.HQ_URL ?? "http://127.0.0.1:8799";
const SB = process.env.SUPABASE_URL ?? "http://127.0.0.1:55421";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }).match(/"SERVICE_ROLE_KEY":\s*"([^"]+)"/)[1];
const ANON = process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "../apps/cli/bin/hq.mjs");
const fixture = join(here, "../apps/cli/test/fixture");
const run = Date.now().toString(36);

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed++;
  console.log(`ok ${passed} - ${name}`);
};

async function call(token, method, path, body) {
  const res = await fetch(U + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

/** A person: created with the admin API, signed in with a password (email sign-in is local only). */
async function person(name) {
  const email = `hq-test-${name}-${run}@example.com`;
  const password = `pw-${run}-${name}-Aa1!`;
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  const c = await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: h, body: JSON.stringify({ email, password, email_confirm: true }) });
  assert.equal(c.status, 200, await c.text());
  const t = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SERVICE, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const s = await t.json();
  assert.ok(s.access_token, JSON.stringify(s));
  return { email, token: s.access_token, id: s.user.id };
}

let rpcId = 0;
async function tool(token, name, args) {
  const r = await call(token, "POST", "/mcp", { jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const res = r.data.result;
  return { error: res.isError ? res.content[0].text : null, value: res.structuredContent };
}

const card = (over = {}) => ({
  project: "alpha", kind: "reliability", title: "Release job flakes", why: "Two of five runs failed.",
  evidence: [{ type: "ci_run", ref: "https://example.com/runs/1" }, { type: "metric", name: "failure rate", value: 0.4, source: "last 5 runs" }],
  plan: "Retry with backoff.", verify: "Next 3 runs pass.", tier: "L2", verbs: ["health"], ...over,
});

let ada, bo, cy, eve, ws, other, runner, agent, otherAgent, cardId;
const W = (p) => `/api/w/${ws}${p}`;

await step("people sign in through Supabase; nobody gets in without a session or token", async () => {
  [ada, bo, cy, eve] = await Promise.all([person("ada"), person("bo"), person("cy"), person("eve")]);
  assert.equal((await call(null, "GET", "/api/me")).status, 401);
  assert.equal((await call("not-a-session", "GET", "/api/me")).status, 401);
  const me = (await call(ada.token, "GET", "/api/me")).data;
  assert.equal(me.user.email, ada.email);
  assert.deepEqual(me.workspaces, []);
});

await step("creating a workspace for a repo makes you its admin", async () => {
  const r = await call(ada.token, "POST", "/api/workspaces", { name: "Fixture", repo: "https://github.com/example/fixture.git" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.repo, "example/fixture");
  assert.equal(r.data.role, "admin");
  ws = r.data.id;
  assert.equal((await call(ada.token, "POST", "/api/workspaces", { name: "x", repo: "not a repo" })).status, 400);
  other = (await call(eve.token, "POST", "/api/workspaces", { name: "Eve's", repo: "eve/mono" })).data.id;
});

await step("invites: an admin invites an approver and a viewer; links are single use", async () => {
  const inv = (await call(ada.token, "POST", W("/invites"), { role: "approver" })).data;
  assert.match(inv.code, /^hqi_/);
  assert.equal((await call(bo.token, "POST", "/api/invites/accept", { code: inv.code })).data.role, "approver");
  assert.equal((await call(cy.token, "POST", "/api/invites/accept", { code: inv.code })).status, 404, "used");
  const v = (await call(ada.token, "POST", W("/invites"), { role: "viewer" })).data;
  await call(cy.token, "POST", "/api/invites/accept", { code: v.code });
  assert.equal((await call(bo.token, "POST", W("/invites"), { role: "admin" })).status, 403, "approvers can't invite");
  const members = (await call(ada.token, "GET", W("/members"))).data;
  assert.deepEqual(members.map((m) => m.role).sort(), ["admin", "approver", "viewer"]);
  assert.equal((await call(ada.token, "DELETE", W(`/members/${ada.id}`))).status, 409, "the last admin can't leave");
});

await step("admins mint workspace tokens; others can't", async () => {
  assert.equal((await call(bo.token, "POST", W("/tokens"), { name: "x", role: "runner" })).status, 403);
  runner = (await call(ada.token, "POST", W("/tokens"), { name: "ci-runner", role: "runner" })).data.token;
  agent = (await call(ada.token, "POST", W("/tokens"), { name: "ci-agent", role: "agent" })).data.token;
  otherAgent = (await call(eve.token, "POST", `/api/w/${other}/tokens`, { name: "eve-agent", role: "agent" })).data.token;
  assert.match(runner, /^hq_run_/);
  assert.match(agent, /^hq_agt_/);
  const me = (await call(runner, "GET", "/api/me")).data;
  assert.equal(me.workspace.repo, "example/fixture");
});

await step("nothing works before a policy is synced", async () => {
  assert.match((await tool(agent, "create_proposal", card())).error, /no policy yet/);
});

await step("hq sync uploads the fixture repo's policy; only for the workspace's own repo", async () => {
  execFileSync("node", [cli, "sync", "--root", fixture], { env: { ...process.env, HQ_URL: U, HQ_TOKEN: runner }, stdio: "pipe" });
  const cfg = (await call(ada.token, "GET", W("/config"))).data;
  assert.equal(cfg.policy.repo, "example/fixture");
  assert.deepEqual(Object.keys(cfg.policy.projects), ["alpha"]);
  assert.equal((await call(agent, "PUT", "/api/config", { policy: cfg.policy })).status, 403, "agents can't change policy");
  const wrongRepo = await call(runner, "PUT", "/api/config", { policy: { ...cfg.policy, repo: "someone/else" } });
  assert.equal(wrongRepo.status, 409);
});

await step("hq login in the browser: an admin allows it, the CLI collects tokens once and saves them", async () => {
  // The Worker's side: only an admin, only for this repo, one claim per secret.
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const claim = (v) => call(null, "POST", "/api/cli-login/claim", { verifier: v });
  assert.equal((await claim(verifier)).status, 202, "nothing to collect before anyone allows it");
  assert.equal((await claim("nope")).status, 400);
  assert.equal((await call(bo.token, "POST", W("/cli-logins"), { challenge, host: "laptop" })).status, 403, "approvers can't");
  assert.equal((await call(runner, "POST", "/api/cli-logins", { challenge, host: "laptop" })).status, 403, "tokens can't");
  assert.equal((await call(ada.token, "POST", W("/cli-logins"), { challenge, host: "laptop", repo: "someone/else" })).status, 409);
  assert.equal((await call(ada.token, "POST", W("/cli-logins"), { challenge: "short", host: "laptop" })).status, 400);
  assert.equal((await claim(verifier)).status, 202, "refused approvals leave nothing behind");
  assert.equal((await call(ada.token, "POST", W("/cli-logins"), { challenge, host: "laptop", repo: "example/fixture" })).status, 201);
  assert.equal((await claim(randomBytes(32).toString("hex"))).status, 202, "another secret gets nothing");
  const got = await claim(verifier);
  assert.equal(got.status, 200, JSON.stringify(got.data));
  assert.match(got.data.runner_token, /^hq_run_/);
  assert.match(got.data.agent_token, /^hq_agt_/);
  assert.equal(got.data.workspace.repo, "example/fixture");
  assert.equal((await call(got.data.runner_token, "GET", "/api/me")).data.token.name, "hq login on laptop");
  assert.equal((await claim(verifier)).status, 202, "a secret works once");

  // The CLI's side, with no terminal and no variables: it prints the link, waits, saves, and sync then works.
  const config = mkdtempSync(join(tmpdir(), "hq-login-"));
  const env = { ...process.env, HQ_CONFIG_DIR: config, HQ_URL: "", HQ_TOKEN: "", HQ_AGENT_TOKEN: "" };
  const refused = spawn("node", [cli, "sync", "--root", fixture], { env, stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  refused.stderr.on("data", (d) => (err += d));
  assert.equal(await new Promise((r) => refused.on("close", r)), 1);
  assert.match(err, /hq login/, "without a terminal it says how to sign in instead of prompting");

  const child = spawn("node", [cli, "login", "--root", fixture, "--url", U, "--browser", "--no-open", "--timeout", "60"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const exited = new Promise((r) => child.on("close", r));
  for (let i = 0; i < 100 && !/challenge=[0-9a-f]{64}/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
  const link = new URL(out.match(/https?:\/\/\S+challenge=\S+/)?.[0] ?? assert.fail(out));
  assert.equal(link.pathname, "/cli/login/");
  const shown = link.searchParams.get("challenge");
  assert.ok(out.includes(`${shown.slice(0, 4)}-${shown.slice(4, 8)}`.toUpperCase()), "the terminal shows the code the page shows");
  assert.equal((await call(ada.token, "POST", W("/cli-logins"), { challenge: shown, host: link.searchParams.get("host"), repo: link.searchParams.get("repo") })).status, 201);
  assert.equal(await exited, 0, out);
  const file = join(config, "credentials.json");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const login = JSON.parse(readFileSync(file, "utf8")).logins["example/fixture"];
  assert.equal(login.url, U);
  assert.match(login.token, /^hq_run_/);
  assert.match(login.agent_token, /^hq_agt_/);
  assert.match(execFileSync("node", [cli, "sync", "--root", fixture], { env, encoding: "utf8" }), /synced example\/fixture/);
  assert.match(execFileSync("node", [cli, "logout", "--root", fixture], { env, encoding: "utf8" }), /forgot the login/);
});

await step("MCP: instructions, tools; agents can't approve", async () => {
  const init = await call(agent, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.match(init.data.result.instructions, /get_context/);
  const names = (await call(agent, "POST", "/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" })).data.result.tools.map((t) => t.name);
  for (const n of ["get_context", "create_proposal", "list_cards", "get_card", "comment", "attach_evidence", "run_verb", "rank_cards", "withdraw_card", "list_requests", "claim_request", "answer_request"]) assert.ok(names.includes(n), n);
  assert.equal((await fetch(U + "/mcp", { headers: { Authorization: `Bearer ${agent}` } })).status, 405, "no server stream");
});

await step("get_context merges policy, guidance and live state", async () => {
  const r = await tool(agent, "get_context", { project: "alpha", format: "json" });
  assert.equal(r.value.tier_ceiling, "L2");
  assert.match(r.value.guidance.project, /Alpha guidance/);
  assert.match((await tool(agent, "get_context", {})).value.markdown, /# HQ context: example\/fixture/);
});

await step("cards without evidence, above the ceiling, for unknown projects or verbs are refused", async () => {
  assert.match((await tool(agent, "create_proposal", card({ evidence: [] }))).error, /no evidence, no card/);
  assert.match((await tool(agent, "create_proposal", card({ evidence: [{ type: "metric", value: 3 }] }))).error, /needs a source/);
  assert.match((await tool(agent, "create_proposal", card({ tier: "L1" }))).error, /at most L2 autonomy/);
  assert.match((await tool(agent, "create_proposal", card({ project: "beta" }))).error, /has no \.hq\/HQ\.md/);
  assert.match((await tool(agent, "create_proposal", card({ verbs: ["deploy"] }))).error, /no verb "deploy"/);
  assert.match((await tool(agent, "create_proposal", card({ kind: "policy" }))).error, /always L3/);
});

await step("a good card lands in the inbox; its dedupe_key stops duplicates", async () => {
  const r = await tool(agent, "create_proposal", card({ dedupe_key: "ci:release:flake", source: { scout: "ci-watch" } }));
  assert.equal(r.error, null, r.error);
  cardId = r.value.id;
  const dup = await tool(agent, "create_proposal", card({ dedupe_key: "ci:release:flake" }));
  assert.equal(dup.value.duplicate, true);
  const ib = (await call(cy.token, "GET", W("/inbox"))).data;
  assert.equal(ib.decide[0].id, cardId, "viewers read the inbox");
  assert.equal(ib.decide[0].source.agent, "ci-agent");
});

await step("workspaces are isolated: other people and other tokens see nothing", async () => {
  assert.equal((await call(eve.token, "GET", W("/inbox"))).status, 403);
  assert.equal((await call(eve.token, "GET", W(`/cards/${cardId}`))).status, 403);
  assert.equal((await call(otherAgent, "GET", W("/inbox"))).status, 403, "token from another workspace");
  assert.match((await tool(otherAgent, "get_card", { id: cardId })).error, /no policy yet|no card/);
  assert.ok([404, 409].includes((await call(otherAgent, "GET", `/api/cards/${cardId}`)).status), "another workspace's token finds nothing");
  // Row-level security on direct reads with a person's own session (the publishable key):
  const direct = async (token, table) => (await fetch(`${SB}/rest/v1/${table}?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Accept-Profile": "hq" } })).json();
  assert.equal((await direct(eve.token, "cards")).length, 0, "RLS: eve reads no cards of ada's workspace");
  assert.ok((await direct(cy.token, "cards")).some((c) => c.id === cardId), "RLS: a member reads them");
});

await step("the inbox is capped; the CEO's ranking decides what shows", async () => {
  const ids = [];
  for (let i = 0; i < 6; i++) ids.push((await tool(agent, "create_proposal", card({ title: `Filler ${i}` }))).value.id);
  let ib = (await call(ada.token, "GET", W("/inbox"))).data;
  assert.equal(ib.decide.length, 5);
  assert.equal(ib.backlog.length, 2);
  await tool(agent, "rank_cards", { ranks: [{ id: ids[5], priority: 99 }] });
  ib = (await call(ada.token, "GET", W("/inbox"))).data;
  assert.equal(ib.decide[0].id, ids[5]);
  for (const id of ids) assert.equal((await tool(agent, "withdraw_card", { id, reason: "test filler" })).error, null);
});

await step("card text is markdown; figures are static drawings and anything else is refused", async () => {
  const svg = '<svg viewBox="0 0 320 80" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="20" width="120" height="40" rx="8" fill="var(--soft)" stroke="var(--line)"/><text x="64" y="45" text-anchor="middle">runner</text></svg>';
  const fig = { id: "flow", title: "Retry flow", html: svg, height: 160 };
  const r = await tool(agent, "create_proposal", card({ title: "Card with a drawing", plan: "## Steps\n\n1. Retry **twice**.\n\n![Retry flow](figure:flow)", figures: [fig] }));
  assert.equal(r.error, null, r.error);
  const d = (await tool(agent, "get_card", { id: r.value.id })).value;
  assert.equal(d.card.figures[0].html, svg);
  assert.equal(d.card.figures[0].height, 160);
  const row = (await call(cy.token, "GET", W("/inbox"))).data.decide.find((c) => c.id === r.value.id);
  assert.deepEqual(row.figures, [{ id: "flow", title: "Retry flow", html: "", height: 160 }], "lists carry no drawings");
  assert.match((await tool(agent, "create_proposal", card({ figures: [{ ...fig, html: "<script>fetch('/api/me')</script>" }] }))).error, /only static HTML/);
  assert.match((await tool(agent, "create_proposal", card({ figures: [{ ...fig, html: '<img src="https://example.com/p.gif">' }] }))).error, /no network/);
  assert.match((await tool(agent, "create_proposal", card({ figures: [{ ...fig, html: '<div onclick="x()">a</div>' }] }))).error, /event handler/);
  assert.match((await tool(agent, "create_proposal", card({ figures: Array.from({ length: 7 }, (_, i) => ({ ...fig, id: `f${i}` })) }))).error, /at most 6/);
  assert.match((await tool(agent, "create_proposal", card({ figures: [fig, fig] }))).error, /unique/);
  // The portal itself only runs its own scripts and frames nothing from elsewhere.
  const csp = (await fetch(U + "/")).headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-src 'none'/);
  await tool(agent, "withdraw_card", { id: r.value.id, reason: "test" });
});

await step("requests: people ask, one agent claims, proposes and answers; asking approves nothing", async () => {
  const claimNext = async () => (await call(runner, "POST", "/api/runs/claim", { runner: "ci", capabilities: ["any"] })).data;
  // Who may ask.
  assert.equal((await call(cy.token, "POST", W("/requests"), { body: "x" })).status, 403, "viewers can't ask");
  assert.equal((await call(agent, "POST", "/api/requests", { body: "x" })).status, 403, "agents can't ask");
  assert.equal((await call(bo.token, "POST", W("/requests"), { body: "  " })).status, 422);
  assert.equal((await call(bo.token, "POST", W("/requests"), { body: "x", project: "beta" })).status, 422, "unknown project");
  const asked = await call(bo.token, "POST", W("/requests"), { body: "Propose a redesign of the **logo**", project: "alpha" });
  assert.equal(asked.status, 201, JSON.stringify(asked.data));
  const id = asked.data.request.id;
  assert.equal(asked.data.request.status, "open");
  assert.equal(asked.data.request.requested_by, bo.email);

  // Agents find it where they already look.
  assert.match((await tool(agent, "get_context", {})).value.markdown, new RegExp(`Owner requests waiting \\(1\\)[\\s\\S]*${id} \\[alpha\\]`));
  assert.equal((await tool(agent, "get_context", { project: "alpha", format: "json" })).value.state.open_requests[0].id, id);
  assert.equal((await tool(agent, "list_requests", {})).value.requests[0].id, id);
  assert.deepEqual((await tool(otherAgent, "list_requests", {})).value.requests, [], "another workspace sees none");

  // One agent takes it; a second one is told to leave it.
  const agent2 = (await call(ada.token, "POST", W("/tokens"), { name: "second-agent", role: "agent" })).data.token;
  const claimed = await tool(agent, "claim_request", { id });
  assert.equal(claimed.value.request.status, "claimed");
  assert.equal(claimed.value.request.claimed_by, "agent:ci-agent");
  assert.match((await tool(agent2, "claim_request", { id })).error, /claimed by agent:ci-agent/);
  assert.match((await tool(agent2, "answer_request", { id, outcome: "note", body: "mine" })).error, /claimed by agent:ci-agent/);
  assert.equal((await tool(agent, "claim_request", { id })).error, null, "claiming again extends the lease");
  assert.match((await tool(otherAgent, "claim_request", { id })).error, /no request/);
  assert.equal((await call(bo.token, "POST", W(`/requests/${id}/claim`))).status, 403, "people don't claim");

  // "proposed" needs a card that carries the request.
  assert.match((await tool(agent, "answer_request", { id, outcome: "proposed", body: "done" })).error, /needs a card/);
  assert.match((await tool(agent, "create_proposal", card({ request_id: "req-20000101-nope" }))).error, /no request/);
  const made = await tool(agent, "create_proposal", card({ title: "New logo: three directions", tier: "L2", kind: "opportunity", request_id: id, evidence: [{ type: "request", ref: id, text: "Propose a redesign of the logo" }] }));
  assert.equal(made.error, null, made.error);
  assert.equal(made.value.status, "proposed", "asking is not approving");

  // What was asked for is never held back by the cap, however the rest ranks.
  const fillers = [];
  for (let i = 0; i < 6; i++) fillers.push((await tool(agent, "create_proposal", card({ title: `Cap filler ${i}` }))).value.id);
  await tool(agent, "rank_cards", { ranks: fillers.map((f) => ({ id: f, priority: 99 })) });
  let ib = (await call(ada.token, "GET", W("/inbox"))).data;
  assert.equal(ib.decide[0].id, made.value.id);
  assert.equal(ib.decide[0].request_id, id);
  assert.equal(ib.decide.length, 6, "the cap of 5, plus what was asked for");
  for (const f of fillers) await tool(agent, "withdraw_card", { id: f, reason: "test filler" });

  const answered = await tool(agent, "answer_request", { id, outcome: "proposed", body: `Filed ${made.value.id}.` });
  assert.equal(answered.value.request.status, "answered");
  assert.equal(answered.value.request.outcome, "proposed");
  assert.equal(answered.value.cards[0].id, made.value.id);
  assert.equal(answered.value.messages[0].kind, "answer");
  ib = (await call(cy.token, "GET", W("/inbox"))).data;
  assert.equal(ib.requests[0].id, id, "members see it in the inbox");
  assert.equal(ib.requests[0].cards.length, 1);

  // The run queued for the runner is dropped: an agent got there first.
  assert.equal((await claimNext()).run, null);
  assert.ok((await call(ada.token, "GET", W("/runs"))).data.some((r) => r.kind === "request" && r.request_id === id && r.status === "cancelled"));

  // A follow-up reopens it and the runner gets the whole thread. An agent that never answers
  // doesn't leave it hanging.
  const again = await call(bo.token, "POST", W(`/requests/${id}/messages`), { body: "Make one of them monochrome." });
  assert.equal(again.data.request.status, "open");
  assert.equal((await call(cy.token, "POST", W(`/requests/${id}/messages`), { body: "x" })).status, 403);
  let c = await claimNext();
  assert.equal(c.run.kind, "request");
  assert.equal(c.request.request.id, id);
  assert.deepEqual(c.request.messages.map((m) => m.kind), ["answer", "reply"]);
  assert.equal(c.request.cards.length, 1);
  await call(runner, "POST", `/api/runs/${c.run.id}/finish`, { status: "done", summary: "commented on the card" });
  let d = (await call(ada.token, "GET", W(`/requests/${id}`))).data;
  assert.equal(d.request.status, "answered");
  assert.match(d.messages.at(-1).body, /finished without answering.*commented on the card/);

  // A failed run leaves the request open, with a note; a person can ask again or close it.
  const second = (await call(ada.token, "POST", W("/requests"), { body: "Why did the Mac build get slower?" })).data.request.id;
  c = await claimNext();
  assert.equal(c.request.request.id, second);
  await call(runner, "POST", `/api/runs/${c.run.id}/finish`, { status: "failed", summary: "agent crashed" });
  d = (await call(ada.token, "GET", W(`/requests/${second}`))).data;
  assert.equal(d.request.status, "open");
  assert.match(d.messages.at(-1).body, /run failed.*agent crashed/);
  assert.equal((await call(cy.token, "POST", W(`/requests/${second}/retry`))).status, 403);
  assert.equal((await call(bo.token, "POST", W(`/requests/${second}/retry`))).status, 202);
  assert.equal((await call(ada.token, "POST", W(`/requests/${second}/close`))).data.request.status, "closed");
  assert.equal((await claimNext()).run, null, "closing cancels the queued run");
  assert.match((await tool(agent, "claim_request", { id: second })).error, /is closed/);

  // A question from the agent waits for the person, and counts in "need you".
  const before = (await call(ada.token, "GET", W("/digest"))).data.needs_you;
  const third = (await call(ada.token, "POST", W("/requests"), { body: "Make it faster" })).data.request.id;
  const q = await tool(agent2, "answer_request", { id: third, outcome: "question", body: "Which screen feels slow?" });
  assert.equal(q.value.request.outcome, "question");
  assert.equal((await call(ada.token, "GET", W("/digest"))).data.needs_you, before + 1);
  assert.equal((await claimNext()).run, null);
  await call(ada.token, "POST", W(`/requests/${third}/close`));

  // Isolation, as for cards.
  assert.equal((await call(eve.token, "GET", W("/requests"))).status, 403);
  assert.equal((await call(eve.token, "GET", W(`/requests/${id}`))).status, 403);
  const direct = async (token, table) => (await fetch(`${SB}/rest/v1/${table}?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Accept-Profile": "hq" } })).json();
  assert.equal((await direct(eve.token, "requests")).length, 0, "RLS: eve reads none of ada's requests");
  assert.ok((await direct(cy.token, "requests")).some((r) => r.id === id), "RLS: a member reads them");
  assert.equal((await direct(eve.token, "request_messages")).length, 0);
  await call(ada.token, "POST", W(`/requests/${id}/close`));
  await tool(agent, "withdraw_card", { id: made.value.id, reason: "test" });
});

await step("roles: viewers and agents can't approve; an approver can, and that queues a build", async () => {
  assert.equal((await call(cy.token, "POST", W(`/cards/${cardId}/decision`), { decision: "approved" })).status, 403);
  assert.equal((await call(agent, "POST", `/api/cards/${cardId}/decision`, { decision: "approved" })).status, 403);
  const r = await call(bo.token, "POST", W(`/cards/${cardId}/decision`), { decision: "approved" });
  assert.equal(r.data.card.status, "approved", JSON.stringify(r.data));
  assert.equal(r.data.runs.at(-1).kind, "build");
  assert.equal(r.data.card.decided_by, bo.email);
});

await step("verbs: L0 runs, L3 only for approvers, dry runs always", async () => {
  assert.equal((await tool(agent, "run_verb", { project: "alpha", verb: "health" })).error, null);
  assert.match((await tool(agent, "run_verb", { project: "alpha", verb: "release", card_id: cardId })).error, /only the owner|L3/);
  assert.equal((await tool(agent, "run_verb", { project: "alpha", verb: "release", dry_run: true })).error, null);
  assert.equal((await call(cy.token, "POST", W("/verbs"), { project: "alpha", verb: "release" })).status, 403, "viewers can't run verbs");
  assert.equal((await call(bo.token, "POST", W("/verbs"), { project: "alpha", verb: "release" })).status, 202);
});

await step("a runner claims work in order and the build moves the card", async () => {
  const kinds = [];
  for (;;) {
    const c = (await call(runner, "POST", "/api/runs/claim", { runner: "ci", capabilities: ["any"] })).data;
    if (!c.run) break;
    kinds.push(c.run.kind);
    assert.ok(c.context && c.policy);
    if (c.run.kind === "build") {
      assert.equal((await call(ada.token, "GET", W(`/cards/${cardId}`))).data.card.status, "building");
      assert.equal((await call(runner, "POST", `/api/cards/${cardId}/evidence`, { phase: "build", evidence: { type: "test", ref: "npm test", text: "12 passed" } })).status, 200);
      await call(runner, "POST", `/api/runs/${c.run.id}/finish`, { status: "done", summary: "built", cost_usd: 0.42, branch: `hq/${cardId}` });
    } else {
      await call(runner, "POST", `/api/runs/${c.run.id}/finish`, { status: "done", summary: c.run.kind });
    }
  }
  assert.deepEqual(kinds.slice(0, 3), ["verb", "verb", "verb"], kinds.join());
  assert.ok(kinds.includes("build") && kinds.includes("review"), kinds.join());
  const d = (await call(ada.token, "GET", W(`/cards/${cardId}`))).data;
  assert.equal(d.card.status, "in_review");
  assert.equal(d.card.branch, `hq/${cardId}`);
  assert.equal(d.attachments[0].evidence.text, "12 passed");
  assert.ok((await call(ada.token, "GET", W("/digest"))).data.spent_this_week_usd >= 0.42);
  assert.equal((await call(eve.token, "GET", `/api/w/${other}/digest`)).data.spent_this_week_usd, 0, "spend is per workspace");
});

await step("discussing: a viewer's comment queues a reply; the agent's answer returns the card", async () => {
  const c2 = (await tool(agent, "create_proposal", card({ title: "Second card" }))).value.id;
  const d = (await call(cy.token, "POST", W(`/cards/${c2}/comments`), { body: "Why not just pin the runner?" })).data;
  assert.equal(d.card.status, "discussing", JSON.stringify(d));
  assert.equal(d.runs.at(-1).kind, "reply");
  await tool(agent, "comment", { id: c2, body: "Pinning hides it; the retry fixes the cause." });
  assert.equal((await call(ada.token, "GET", W(`/cards/${c2}`))).data.card.status, "proposed");
});

await step("a rejected dedupe_key isn't re-proposed for 30 days; decisions become taste", async () => {
  const k = "ci:reject-me";
  const id = (await tool(agent, "create_proposal", card({ dedupe_key: k }))).value.id;
  await call(bo.token, "POST", W(`/cards/${id}/decision`), { decision: "rejected", reason: "don't propose this kind again" });
  const r = await tool(agent, "create_proposal", card({ dedupe_key: k }));
  assert.equal(r.value.duplicate, true);
  assert.match(r.value.note, /rejected/);
  const ctx = await tool(agent, "get_context", { format: "json" });
  assert.ok(ctx.value.state.recent_decisions.some((x) => x.reason === "don't propose this kind again"));
});

await step("approvers ship; agents and viewers can't", async () => {
  assert.equal((await call(agent, "POST", `/api/cards/${cardId}/status`, { status: "shipped" })).status, 403);
  assert.equal((await call(cy.token, "POST", W(`/cards/${cardId}/status`), { status: "shipped" })).status, 403);
  assert.equal((await call(bo.token, "POST", W(`/cards/${cardId}/status`), { status: "shipped" })).data.card.status, "shipped");
});

await step("only admins pause; pause stops scouts and builds; the scheduler enqueues due work", async () => {
  assert.equal((await call(bo.token, "POST", W("/settings"), { paused: true })).status, 403);
  await call(ada.token, "POST", W("/settings"), { paused: true });
  assert.deepEqual((await call(ada.token, "POST", W("/schedule"))).data.enqueued, []);
  await call(ada.token, "POST", W("/settings"), { paused: false });
  const s = (await call(ada.token, "POST", W("/schedule"))).data;
  assert.ok(s.enqueued.includes("scout ci-watch (repo-wide)"), JSON.stringify(s));
  assert.ok(s.enqueued.includes("ceo") && s.enqueued.includes("health"));
  assert.deepEqual((await call(ada.token, "POST", W("/schedule"))).data.enqueued, [], "not due again");
  await call(ada.token, "POST", W("/settings"), { paused: true });
  assert.equal((await call(runner, "POST", "/api/runs/claim", { runner: "ci" })).data.run, null);
  await call(ada.token, "POST", W("/settings"), { paused: false });
});

await step("health lands on the board; the audit log records who did what (admins only)", async () => {
  await call(runner, "PUT", "/api/health", { project: "alpha", data: { ok: false, ci: "failure" } });
  const h = (await call(cy.token, "GET", W("/health"))).data;
  assert.equal(h.projects.find((p) => p.project === "alpha").health.ok, false);
  const log = (await call(ada.token, "GET", W("/audit"))).data;
  for (const a of ["workspace.create", "member.join", "policy.sync", "card.create", "request.create", "request.claim", "request.answer", "request.close", "workspace.pause", "verb.refused", "run.finish"]) assert.ok(log.some((x) => x.action === a), a);
  assert.ok(log.some((x) => x.actor === bo.email && x.action === "card.status"), "decisions are attributed to the person");
  assert.equal((await call(bo.token, "GET", W("/audit"))).status, 403);
});

await step("roles change and members leave; revoked tokens stop working", async () => {
  assert.equal((await call(ada.token, "PATCH", W(`/members/${cy.id}`), { role: "approver" })).data.find((m) => m.user_id === cy.id).role, "approver");
  assert.equal((await call(cy.token, "DELETE", W(`/members/${cy.id}`))).status, 200, "anyone can leave");
  assert.equal((await call(cy.token, "GET", W("/inbox"))).status, 403);
  const toks = (await call(ada.token, "GET", W("/tokens"))).data;
  await call(ada.token, "DELETE", W(`/tokens/${toks.find((t) => t.name === "ci-agent").id}`));
  assert.equal((await call(agent, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 401);
});

await step("files: a runner attaches a screenshot; members fetch it; other workspaces can't", async () => {
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (ch) => ch.charCodeAt(0));
  const up = await fetch(`${U}/api/cards/${cardId}/files?name=after.png&caption=after`, { method: "POST", headers: { Authorization: `Bearer ${runner}`, "Content-Type": "image/png" }, body: png });
  const upBody = await up.text();
  assert.equal(up.status, 201, upBody);
  const { key } = JSON.parse(upBody);
  const got = await fetch(`${U}${W(`/files/${encodeURIComponent(key)}`)}`, { headers: { Authorization: `Bearer ${ada.token}` } });
  assert.equal(got.status, 200);
  assert.equal((await got.arrayBuffer()).byteLength, png.byteLength);
  assert.equal((await fetch(`${U}/api/w/${other}/files/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${eve.token}` } })).status, 404);
});

await step("account deletion: the sole member's workspace goes; a team keeps an admin; sign-in stays", async () => {
  const e = await call(eve.token, "DELETE", "/api/me");
  assert.equal(e.status, 200, JSON.stringify(e.data));
  assert.equal(e.data.deleted_workspaces, 1);
  assert.deepEqual((await call(eve.token, "GET", "/api/me")).data.workspaces, [], "eve's session still works; she just has no HQ data");
  const a = await call(ada.token, "DELETE", "/api/me");
  assert.equal(a.data.admin_handed_over, 1, JSON.stringify(a.data));
  const members = (await call(bo.token, "GET", W("/members"))).data;
  assert.deepEqual(members.map((m) => `${m.email === bo.email ? "bo" : "?"}:${m.role}`), ["bo:admin"]);
  assert.equal((await call(bo.token, "GET", W("/inbox"))).status, 200, "the workspace and its cards remain");
  assert.equal((await call(null, "DELETE", "/api/me")).status, 401);
});

await step("OAuth metadata for MCP clients is published", async () => {
  const r = await call(null, "GET", "/.well-known/oauth-authorization-server");
  assert.equal(r.status, 200);
  assert.ok(r.data.authorization_endpoint.endsWith("/authorize"));
  assert.equal((await call(null, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 401);
});

console.log(`\n${passed} passed`);
