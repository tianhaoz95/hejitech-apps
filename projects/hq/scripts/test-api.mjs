#!/usr/bin/env node
// Integration test against a running HQ Worker (CI starts `wrangler dev` with a fresh local D1).
// It drives the whole loop with the fixture repo's policy, so it also proves HQ works for a repo it
// has never seen: sync → propose (and every refusal) → rank → approve → claim → build → review →
// discuss → reply → verbs (tier checks) → pause → schedule → audit.
//
//   HQ_URL=http://127.0.0.1:8799 HQ_OWNER_TOKEN=… node projects/hq/scripts/test-api.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const U = process.env.HQ_URL ?? "http://127.0.0.1:8799";
const OWNER = process.env.HQ_OWNER_TOKEN ?? "test-owner-token";
const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "../apps/cli/bin/hq.mjs");
const fixture = join(here, "../apps/cli/test/fixture");

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
const owner = (m, p, b) => call(OWNER, m, p, b);

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
  plan: "Retry with backoff.", verify: "Next 3 runs pass.", tier: "L1", verbs: ["health"], ...over,
});

let runner, agent, cardId;

await step("unauthenticated and wrong tokens are refused", async () => {
  assert.equal((await call(null, "GET", "/api/inbox")).status, 401);
  assert.equal((await call("nope", "GET", "/api/inbox")).status, 401);
  assert.equal((await call("hq_agt_forged", "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 401);
  assert.equal((await owner("GET", "/api/me")).data.role, "owner");
});

await step("owner creates runner and agent tokens", async () => {
  runner = (await owner("POST", "/api/tokens", { name: "ci-runner", role: "runner" })).data.token;
  agent = (await owner("POST", "/api/tokens", { name: "ci-agent", role: "agent" })).data.token;
  assert.match(runner, /^hq_run_/);
  assert.match(agent, /^hq_agt_/);
  assert.equal((await call(agent, "POST", "/api/tokens", { name: "x", role: "runner" })).status, 403);
});

await step("nothing works before a policy is synced", async () => {
  const r = await tool(agent, "create_proposal", card());
  assert.match(r.error, /no policy yet/);
});

await step("hq sync uploads the fixture repo's policy (a repo HQ has never seen)", async () => {
  execFileSync("node", [cli, "sync", "--root", fixture], { env: { ...process.env, HQ_URL: U, HQ_TOKEN: runner }, stdio: "pipe" });
  const cfg = (await owner("GET", "/api/config")).data;
  assert.equal(cfg.policy.repo, "example/fixture");
  assert.deepEqual(Object.keys(cfg.policy.projects), ["alpha"]);
  const r = await call(agent, "PUT", "/api/config", { policy: cfg.policy });
  assert.equal(r.status, 403, "agents can't change policy");
});

await step("MCP: initialize carries the instructions; tools are listed", async () => {
  const init = await call(agent, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.match(init.data.result.instructions, /get_context/);
  const list = await call(agent, "POST", "/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const names = list.data.result.tools.map((t) => t.name);
  for (const n of ["get_context", "create_proposal", "list_cards", "get_card", "comment", "attach_evidence", "run_verb", "rank_cards", "withdraw_card"]) assert.ok(names.includes(n), n);
  assert.ok(!names.includes("record_decision"), "agents can't approve");
});

await step("get_context merges policy, guidance and live state", async () => {
  const r = await tool(agent, "get_context", { project: "alpha", format: "json" });
  assert.equal(r.value.tier_ceiling, "L2");
  assert.match(r.value.guidance.project, /Alpha guidance/);
  assert.ok(r.value.rules.length >= 5);
  const md = await tool(agent, "get_context", {});
  assert.match(md.value.markdown, /# HQ context: example\/fixture/);
});

await step("cards without evidence, above the ceiling, for unknown projects or verbs are refused", async () => {
  assert.match((await tool(agent, "create_proposal", card({ evidence: [] }))).error, /no evidence, no card/);
  assert.match((await tool(agent, "create_proposal", card({ evidence: [{ type: "metric", value: 3 }] }))).error, /needs a source/);
  assert.match((await tool(agent, "create_proposal", card({ tier: "L1" }))).error, /at most L2 autonomy/);
  assert.match((await tool(agent, "create_proposal", card({ tier: "L2", project: "beta" }))).error, /has no \.hq\/HQ\.md/);
  assert.match((await tool(agent, "create_proposal", card({ tier: "L2", verbs: ["deploy"] }))).error, /no verb "deploy"/);
  assert.match((await tool(agent, "create_proposal", card({ tier: "L2", kind: "policy" }))).error, /always L3/);
});

await step("a good card lands in the inbox; its dedupe_key stops duplicates", async () => {
  const r = await tool(agent, "create_proposal", card({ tier: "L2", dedupe_key: "ci:release:flake", source: { scout: "ci-watch" } }));
  assert.equal(r.error, null, r.error);
  cardId = r.value.id;
  assert.equal(r.value.status, "proposed");
  const dup = await tool(agent, "create_proposal", card({ tier: "L2", dedupe_key: "ci:release:flake" }));
  assert.equal(dup.value.duplicate, true);
  assert.equal(dup.value.id, cardId);
  const ib = (await owner("GET", "/api/inbox")).data;
  assert.equal(ib.decide[0].id, cardId);
  assert.equal(ib.decide[0].source.agent, "ci-agent");
});

await step("the inbox is capped; the CEO's ranking decides what shows", async () => {
  const ids = [];
  for (let i = 0; i < 6; i++) ids.push((await tool(agent, "create_proposal", card({ tier: "L2", title: `Filler ${i}` }))).value.id);
  let ib = (await owner("GET", "/api/inbox")).data;
  assert.equal(ib.decide.length, 5, "inbox_cap defaults to 5");
  assert.equal(ib.backlog.length, 2);
  await tool(agent, "rank_cards", { ranks: [{ id: ids[5], priority: 99 }] });
  ib = (await owner("GET", "/api/inbox")).data;
  assert.equal(ib.decide[0].id, ids[5]);
  for (const id of ids) assert.equal((await tool(agent, "withdraw_card", { id, reason: "test filler" })).error, null);
});

await step("only the owner approves; approval queues a build", async () => {
  assert.equal((await call(agent, "POST", `/api/cards/${cardId}/decision`, { decision: "approved" })).status, 403);
  assert.equal((await call(runner, "POST", `/api/cards/${cardId}/decision`, { decision: "approved" })).status, 403);
  const r = await owner("POST", `/api/cards/${cardId}/decision`, { decision: "approved" });
  assert.equal(r.data.card.status, "approved");
  assert.equal(r.data.runs.at(-1).kind, "build");
});

await step("verbs: L0 runs, L3 only for the owner, dry runs always", async () => {
  assert.equal((await tool(agent, "run_verb", { project: "alpha", verb: "health" })).error, null);
  assert.match((await tool(agent, "run_verb", { project: "alpha", verb: "release", card_id: cardId })).error, /L3: only the owner/);
  assert.equal((await tool(agent, "run_verb", { project: "alpha", verb: "release", dry_run: true })).error, null);
  assert.equal((await owner("POST", "/api/verbs", { project: "alpha", verb: "release", dry_run: false })).status, 202);
});

await step("a runner claims work in order and the build moves the card", async () => {
  const kinds = [];
  for (;;) {
    const c = (await call(runner, "POST", "/api/runs/claim", { runner: "ci", capabilities: ["any"] })).data;
    if (!c.run) break;
    kinds.push(c.run.kind);
    assert.ok(c.context && c.policy, "claims carry context and policy");
    if (c.run.kind === "build") {
      assert.equal(c.card.card.id, cardId);
      assert.equal((await owner("GET", `/api/cards/${cardId}`)).data.card.status, "building");
      assert.equal((await call(runner, "POST", `/api/cards/${cardId}/evidence`, { phase: "build", evidence: { type: "test", ref: "npm test", text: "12 passed" } })).status, 200);
      await call(runner, "POST", `/api/runs/${c.run.id}/finish`, { status: "done", summary: "built", cost_usd: 0.42, branch: `hq/${cardId}` });
    } else {
      await call(runner, "POST", `/api/runs/${c.run.id}/finish`, { status: "done", summary: c.run.kind });
    }
  }
  assert.deepEqual(kinds.slice(0, 3), ["verb", "verb", "verb"], "verbs first");
  assert.ok(kinds.includes("build") && kinds.includes("review"), kinds.join());
  const d = (await owner("GET", `/api/cards/${cardId}`)).data;
  assert.equal(d.card.status, "in_review");
  assert.equal(d.card.branch, `hq/${cardId}`);
  assert.equal(d.attachments[0].evidence.text, "12 passed");
  assert.ok((await owner("GET", "/api/digest")).data.spent_this_week_usd >= 0.42);
});

await step("discussing: an owner comment queues a reply; the agent's answer returns the card", async () => {
  const c2 = (await tool(agent, "create_proposal", card({ tier: "L2", title: "Second card" }))).value.id;
  const d = (await owner("POST", `/api/cards/${c2}/comments`, { body: "Why not just pin the runner?" })).data;
  assert.equal(d.card.status, "discussing");
  assert.equal(d.runs.at(-1).kind, "reply");
  await tool(agent, "comment", { id: c2, body: "Pinning hides it; the retry fixes the cause." });
  assert.equal((await owner("GET", `/api/cards/${c2}`)).data.card.status, "proposed");
  await owner("POST", `/api/cards/${c2}/decision`, { decision: "rejected", reason: "not worth it" });
  const again = await tool(agent, "create_proposal", card({ tier: "L2", title: "Second card", dedupe_key: "x" }));
  assert.equal(again.value.duplicate, false);
});

await step("a rejected dedupe_key isn't re-proposed for 30 days", async () => {
  const k = "ci:reject-me";
  const id = (await tool(agent, "create_proposal", card({ tier: "L2", dedupe_key: k }))).value.id;
  await owner("POST", `/api/cards/${id}/decision`, { decision: "rejected", reason: "don't propose this kind again" });
  const r = await tool(agent, "create_proposal", card({ tier: "L2", dedupe_key: k }));
  assert.equal(r.value.duplicate, true);
  assert.match(r.value.note, /rejected/);
  const ctx = await tool(agent, "get_context", { format: "json" });
  assert.ok(ctx.value.state.recent_decisions.some((x) => x.reason === "don't propose this kind again"));
});

await step("the owner ships; agents can't", async () => {
  assert.equal((await call(agent, "POST", `/api/cards/${cardId}/status`, { status: "shipped" })).status, 409);
  assert.equal((await owner("POST", `/api/cards/${cardId}/status`, { status: "shipped" })).data.card.status, "shipped");
});

await step("pause stops scouts and builds; the scheduler enqueues due scouts, the CEO and health", async () => {
  await owner("POST", "/api/settings", { paused: true });
  assert.deepEqual((await owner("POST", "/api/schedule")).data.enqueued, []);
  await owner("POST", "/api/settings", { paused: false });
  const s = (await owner("POST", "/api/schedule")).data;
  assert.ok(s.enqueued.includes("scout ci-watch (repo-wide)"), JSON.stringify(s));
  assert.ok(s.enqueued.includes("ceo") && s.enqueued.includes("health"));
  assert.deepEqual((await owner("POST", "/api/schedule")).data.enqueued, [], "not due again");
  await owner("POST", "/api/settings", { paused: true });
  assert.equal((await call(runner, "POST", "/api/runs/claim", { runner: "ci" })).data.run, null);
  await owner("POST", "/api/settings", { paused: false });
});

await step("health reports land on the board; the audit log records who did what", async () => {
  await call(runner, "PUT", "/api/health", { project: "alpha", data: { ok: false, ci: "failure" } });
  const h = (await owner("GET", "/api/health")).data;
  assert.equal(h.projects.find((p) => p.project === "alpha").health.ok, false);
  const log = (await owner("GET", "/api/audit")).data;
  for (const a of ["policy.sync", "card.create", "settings.set", "verb.refused", "run.finish"]) assert.ok(log.some((x) => x.action === a), a);
  assert.equal((await call(agent, "GET", "/api/audit")).status, 403);
});

await step("OAuth metadata for MCP clients is published", async () => {
  const r = await call(null, "GET", "/.well-known/oauth-authorization-server");
  assert.equal(r.status, 200);
  assert.ok(r.data.authorization_endpoint.endsWith("/authorize"));
  assert.equal((await call(null, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 401);
});

console.log(`\n${passed} passed`);
