#!/usr/bin/env node
// Integration test: the real Worker (`npm run dev:worker -w @tradeboard/web`, 127.0.0.1:8798) on the
// shared local Supabase stack, the bundled executor (apps/executor/dist), a mock Robinhood MCP and a
// mock model (scripts/mock-*.mjs, started here). Covers PRD §12.1 tests 1–16 end to end, plus the
// owner's sign-in (Supabase + TOTP), credential separation, OAuth for agents and append-only audit.
// LOCAL ONLY: it resets the board's owner row and tables in the local database.
// Usage: node projects/tradeboard/scripts/test-api.mjs [site] [supabase]
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { base32Decode, hotp, idempotencyKey } from "../packages/core/src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const site = (process.argv[2] ?? "http://127.0.0.1:8798").replace(/\/$/, "");
const supa = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
if (!/^http:\/\/127\.0\.0\.1/.test(site) || !/^http:\/\/127\.0\.0\.1/.test(supa)) throw new Error("local stack only");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const EXEC = "tbx_dev_local";
const SEED_USER = "00000000-0000-4000-8000-00000000b0a4";
const RH_PORT = 8766, MODEL_PORT = 8767;
// Wednesday 11:00 ET: the executor's clock in this test (the board keeps real time).
const TEST_NOW = "2026-10-28T15:00:00.000Z";

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ✓ ${name}`); };

// ---------------------------------------------------------------- helpers

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${supa}/rest/v1/${path}`, { method, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Accept-Profile": "tradeboard", "Content-Profile": "tradeboard", "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

let cookie = "";
// Sign-in failures are throttled per client address: each run is its own "client".
const CLIENT_IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
async function portal(path, { method, body, headers = {}, raw = false } = {}) {
  const res = await fetch(`${site}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", "X-Tradeboard": "1", "CF-Connecting-IP": CLIENT_IP, ...(cookie && !raw ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text, headers: res.headers };
}

function mcp(token) {
  let id = 0;
  const rpc = async (method, params = {}) => {
    const res = await fetch(`${site}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* 401 */ }
    return { status: res.status, body, text };
  };
  const call = async (name, args = {}) => {
    const r = await rpc("tools/call", { name, arguments: args });
    assert.equal(r.status, 200, `${name}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    return { error: r.body.result.isError ? JSON.parse(r.body.result.content[0].text) : null, value: r.body.result.isError ? null : JSON.parse(r.body.result.content[0].text) };
  };
  const tool = async (name, args) => {
    const r = await call(name, args);
    if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
    return r.value;
  };
  return { rpc, call, tool };
}
const claude = mcp("tba_dev_claude"), gemini = mcp("tba_dev_gemini");

async function exec(path, body) {
  const res = await fetch(`${site}/api/executor${path}`, { method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${EXEC}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const rhState = async (patch) => (await fetch(`http://127.0.0.1:${RH_PORT}/_state`, { method: patch ? "POST" : "GET", body: patch ? JSON.stringify(patch) : undefined })).json();

const inHours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const ticket = (o = {}) => ({ ticker: "AAPL", side: "buy", order_type: "limit", quantity_shares: 10, quantity_dollars: null, limit_price: 285, time_in_force: "day", account_scope: "dedicated_mcp_account_only", ...o });
const newPlan = (o = {}) => ({ title: "AAPL — add on pullback", ticker: "AAPL", order: ticket(o.order), thesis: "Add 10 AAPL at $285 on the pullback: services growth.", evidence: "Services up 8 quarters.", risks_and_dissent: "Gemini: valuation is stretched.", invalidation: "Close below $270.", valid_until: inHours(6), quote_price: 286, quote_at: new Date().toISOString(), ...o, ...(o.order ? { order: ticket(o.order) } : {}) });

async function totp(secret, offset = 0) {
  return hotp(base32Decode(secret), Math.floor(Date.now() / 30_000) + offset);
}

const home = mkdtempSync(join(tmpdir(), "tradeboard-exec-"));
function executorConfig(extra = {}) {
  const cfg = {
    board_url: site, executor_id: "local", executor_token: EXEC,
    robinhood: { mcp_url: `http://127.0.0.1:${RH_PORT}/mcp`, account_number: "5RX12345678", redirect_port: 8765 },
    model: { enabled: true, base_url: `http://127.0.0.1:${MODEL_PORT}/v1`, model: "mock-sanity", timeout_ms: 5000, max_tokens: 2048 },
    poll_interval_sec: 10, heartbeat_sec: 30, max_plans_per_loop: 1, allow_live: false, ...extra,
  };
  writeFileSync(join(home, "config.json"), JSON.stringify(cfg), { mode: 0o600 });
}
const bundle = join(here, "../apps/executor/dist/tradeboard-executor.mjs");
function runExecutor() {
  return execFileSync(process.execPath, [bundle, "once"], { env: { ...process.env, TRADEBOARD_HOME: home, TRADEBOARD_TEST_NOW: TEST_NOW }, encoding: "utf8", timeout: 60_000 });
}

/** Debated → ready (agent) → approved (owner). */
async function toApproved(planId) {
  const p = await claude.tool("get_plan", { plan_id: planId });
  if (p.status === "draft") await claude.tool("comment", { plan_id: planId, body: "Looks reasonable." });
  await claude.tool("mark_ready", { plan_id: planId });
  const v = (await claude.tool("get_plan", { plan_id: planId })).current_version;
  const a = await portal(`/api/plans/${planId}/approve`, { body: { version: v, note: "go" } });
  assert.equal(a.status, 200, a.text);
  return a.body;
}

/** Leaves the board with no approved plans so each executor run sees only the plan under test. */
async function clearApproved() {
  const { body } = await rest(`plans?user_id=eq.${SEED_USER}&status=in.(approved,ready,validated)&select=plan_id`);
  for (const p of body ?? []) await portal(`/api/plans/${p.plan_id}/cancel`, { body: { reason: "test cleanup" } });
}

// ---------------------------------------------------------------- start

execFileSync("node", [join(here, "../apps/executor/scripts/build.mjs")], { stdio: "ignore" });
const mocks = [spawn(process.execPath, [join(here, "mock-robinhood.mjs"), String(RH_PORT)], { stdio: "ignore" }), spawn(process.execPath, [join(here, "mock-model.mjs"), String(MODEL_PORT)], { stdio: "ignore" })];
process.on("exit", () => mocks.forEach((m) => m.kill()));
await new Promise((r) => setTimeout(r, 600));
// Local reset: the seed user enrolls again, no sessions, a clean control row.
await rest("sessions?token_hash=neq.x", { method: "DELETE" });
await rest(`accounts?user_id=eq.${SEED_USER}`, { method: "DELETE" });
await rest(`control?user_id=eq.${SEED_USER}`, { method: "PATCH", body: { paused: false, killed: false, dry_run: true, approvals_mode: null, confirmed_account_mask: null, funding_usd: null, gate_policy_version: null, live_trial_pending: true } });
await rest("executor_tokens?executor_id=eq.second", { method: "PATCH", body: { revoked_at: new Date().toISOString() } });
await rhState({ price: 285.5, account: "5RX12345678", approvals: false, orders: [], placeCalls: 0, quoteAt: TEST_NOW });
executorConfig();
console.log("tradeboard integration");

// ---------------------------------------------------------------- credentials (§7, §8.3, §11)

await step("each credential works only where it belongs", async () => {
  assert.equal((await portal("/api/board", { raw: true })).status, 401);
  assert.equal((await portal("/api/board", { raw: true, headers: { Authorization: "Bearer tba_dev_claude" } })).status, 403);
  assert.equal((await portal("/api/plans/00000000-0000-4000-8000-000000000000/approve", { raw: true, body: { version: 1 }, headers: { Authorization: `Bearer ${EXEC}` } })).status, 403);
  assert.equal((await fetch(`${site}/api/executor/poll`, { method: "POST", headers: { Authorization: "Bearer tba_dev_claude" } })).status, 403);
  assert.equal((await mcp(EXEC).rpc("tools/list")).status, 401);
  assert.equal((await mcp("tba_wrong").rpc("tools/list")).status, 401);
});

let secret;
let strangerToken;
await step("sign-up: a Supabase account, then TOTP enrollment; wrong codes and replays refused", async () => {
  const tok = async (email, password) => (await (await fetch(`${supa}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json()).access_token;
  const owner = await tok("owner@example.com", "tradeboard-dev");
  const begin = await portal("/api/auth/begin", { body: { access_token: owner } });
  assert.equal(begin.status, 200, begin.text);
  assert.equal(begin.body.enroll, true);
  secret = begin.body.secret;
  assert.match(begin.body.otpauth, /^otpauth:\/\/totp\//);
  assert.equal((await portal("/api/auth/verify", { body: { access_token: owner, code: "000000" } })).status, 401);
  const ok = await portal("/api/auth/verify", { body: { access_token: owner, code: await totp(secret) } });
  assert.equal(ok.status, 200, ok.text);
  const set = ok.headers.get("set-cookie");
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  cookie = set.split(";")[0];
  // The same code can't be used twice (replay).
  const again = await portal("/api/auth/verify", { body: { access_token: owner, code: await totp(secret) } });
  assert.equal(again.status, 401);
  const email = `second-${Date.now()}@example.com`;
  await fetch(`${supa}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "second-pass-1", email_confirm: true }) });
  strangerToken = await tok(email, "second-pass-1");
});

await step("the session is a cookie only; state changes need the same-origin header", async () => {
  assert.equal((await portal("/api/me")).status, 200);
  const csrf = await fetch(`${site}/api/plans`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(csrf.status, 403);
  const cross = await fetch(`${site}/api/plans`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", "X-Tradeboard": "1", Origin: "https://evil.example" }, body: "{}" });
  assert.equal(cross.status, 403);
});

await step("the Board MCP has no approve, policy, executor or order tool", async () => {
  const names = (await claude.rpc("tools/list")).body.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["answer_question", "ask_question", "comment", "create_plan", "get_audit_log", "get_open_questions", "get_plan", "list_comments", "list_plans", "mark_ready", "request_changes", "update_plan"]);
  assert.equal((await claude.call("approve_plan", { plan_id: "x" })).error.error_code, "unknown_tool");
});

await clearApproved();
await step("the policy is versioned; the test runs on a copy with room for many orders a day", async () => {
  const cur = (await portal("/api/policy")).body.current;
  const r = await portal("/api/policy", { body: { policy: { ...cur.policy, max_open_plans_per_day: cur.policy.max_open_plans_per_day === 1000 ? 999 : 1000 }, note: "integration test", confirm: true } });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.body.policy_version, cur.policy_version + 1);
  assert.deepEqual(r.body.changed, ["max_open_plans_per_day"]);
  assert.equal((await portal("/api/policy", { body: { policy: cur.policy } })).body.error_code, "confirm_required");
});

// ---------------------------------------------------------------- §12.1 tests 1–2

let p1;
await step("test 1: an open owner question blocks ready and approve", async () => {
  const c = await claude.tool("create_plan", { ...newPlan(), idempotency_key: `t1-${Date.now()}` });
  p1 = c.plan_id;
  assert.equal(c.status, "draft");
  await claude.tool("comment", { plan_id: p1, body: "Entry at $285 is near support.", anchor: "thesis" });
  await gemini.tool("comment", { plan_id: p1, body: "Dissent: valuation is stretched; keep size small.", anchor: "risks_and_dissent" });
  const q = await portal(`/api/plans/${p1}/comments`, { body: { body: "What's the stop if it breaks $270? @claude", is_question: true, anchor: "invalidation" } });
  assert.equal(q.status, 201, q.text);
  assert.equal(q.body.mentioned_agent_id, "claude");
  const r = await claude.call("mark_ready", { plan_id: p1 });
  assert.equal(r.error.error_code, "open_questions");
  assert.equal(r.error.open_questions.length, 1);
  const a = await portal(`/api/plans/${p1}/approve`, { body: { version: 1 } });
  assert.equal(a.status, 422);
  const view = await claude.tool("get_plan", { plan_id: p1 });
  assert.equal(view.awaiting_you.length, 1);
  assert.equal(view.open_questions[0].blocking, true);
  await claude.tool("answer_question", { question_id: q.body.comment_id, body: "Invalidation at a close below $270; then we exit." });
  assert.equal((await claude.call("mark_ready", { plan_id: p1 })).error.error_code, "open_questions", "an agent's answer doesn't resolve the owner's question");
  const res = await portal(`/api/questions/${q.body.comment_id}/resolve`, { body: { note: "ok" } });
  assert.equal(res.status, 200);
});

await step("test 2: resolved → ready → approved → executor dry-run posts a simulated receipt, no Robinhood order", async () => {
  await toApproved(p1);
  const out = runExecutor();
  assert.match(out, /simulated/, out);
  const v = await claude.tool("get_plan", { plan_id: p1 });
  assert.equal(v.status, "executed");
  assert.equal(v.latest_receipt.mode, "dry_run");
  assert.equal(v.latest_receipt.outcome, "simulated");
  assert.equal(v.latest_receipt.robinhood_order_id, null);
  assert.equal((await rhState()).placeCalls, 0);
  const trades = await portal("/api/trades?mode=dry_run");
  assert.ok(trades.body.receipts.some((r) => r.plan_id === p1 && r.mode === "dry_run"));
});

// ---------------------------------------------------------------- tests 3–5

await step("test 3: editing the ticket after approval voids it; the old version can't be claimed", async () => {
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await toApproved(plan_id);
  const oldKey = await idempotencyKey(plan_id, 1);
  const e = await gemini.tool("update_plan", { plan_id, expected_version: 1, order: ticket({ limit_price: 280 }) });
  assert.equal(e.version, 2);
  assert.equal(e.status, "debated");
  const v = await claude.tool("get_plan", { plan_id });
  assert.equal(v.approval, null);
  assert.ok(v.approvals[0].voided_at);
  const conflict = await claude.call("update_plan", { plan_id, expected_version: 1, thesis: "x" });
  assert.equal(conflict.error.error_code, "version_conflict");
  assert.equal(conflict.error.actual_version, 2);
  assert.ok(!(await exec("/poll", {})).body.plans.some((p) => p.plan_id === plan_id));
  assert.notEqual((await exec("/claim", { plan_id, idempotency_key: oldKey })).status, 200);
});

await step("test 4: no past validity; an unapproved plan expires and is never executed", async () => {
  const past = await claude.call("create_plan", newPlan({ valid_until: inHours(-1) }));
  assert.equal(past.error.error_code, "invalid_plan");
  const none = await claude.call("create_plan", { ...newPlan(), valid_until: undefined });
  assert.equal(none.error.error_code, "invalid_plan");
  const { plan_id } = await claude.tool("create_plan", newPlan({ valid_until: new Date(Date.now() + 2500).toISOString() }));
  await new Promise((r) => setTimeout(r, 3500));
  const v = await claude.tool("get_plan", { plan_id });
  assert.equal(v.status, "expired");
  assert.ok(!(await exec("/poll", {})).body.plans.some((p) => p.plan_id === plan_id));
});

await step("test 5: a new owner question voids an approval", async () => {
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await toApproved(plan_id);
  const q = await portal(`/api/plans/${plan_id}/comments`, { body: { body: "Wait: earnings tomorrow?", is_question: true } });
  assert.equal(q.body.approval_voided, true);
  assert.equal(q.body.status, "debated");
  await portal(`/api/plans/${plan_id}/cancel`, { body: {} });
});

// ---------------------------------------------------------------- tests 6–8 (executor, dry-run)

async function rejectedFor(fields, expectCode, expectText) {
  const { plan_id } = await claude.tool("create_plan", newPlan(fields));
  await toApproved(plan_id);
  runExecutor();
  const v = await claude.tool("get_plan", { plan_id });
  assert.equal(v.status, "rejected", JSON.stringify(v.latest_receipt));
  assert.equal(v.latest_receipt.reason_code, expectCode);
  if (expectText) assert.match(v.latest_receipt.reason_text, expectText);
  assert.equal((await rhState()).placeCalls, 0);
  return plan_id;
}

await step("test 6: per-trade limit, denied ticker and market hours are rejected by the validator", async () => {
  await rejectedFor({ order: { quantity_shares: 30 }, thesis: "Add 30 AAPL at $285." }, "policy_rejected", /\[max_per_trade_usd\]/);
  const cur = (await portal("/api/policy")).body.current.policy;
  const denied = await portal("/api/policy", { body: { policy: { ...cur, denied_tickers: ["AAPL"] }, note: "test deny", confirm: true } });
  assert.equal(denied.status, 201, denied.text);
  await rejectedFor({}, "policy_rejected", /\[denied_tickers\]/);
  await portal("/api/policy", { body: { policy: { ...cur, denied_tickers: [] }, note: "test restore", confirm: true } });
  // Market hours: the validator itself (the loop also waits, unclaimed, outside the session: engine tests).
  const bad = await portal("/api/policy", { body: { policy: { ...cur, require_human_approval: false }, confirm: true } });
  assert.equal(bad.status, 422, "approval can't be made optional");
});

await step("test 7: a quote 5 % away is drift_rejected", async () => {
  await rhState({ price: 299.25 });
  await rejectedFor({}, "drift_rejected", /max_drift_pct/);
  await rhState({ price: 285.5 });
});

await step("test 8: a thesis about another ticker fails the model check", async () => {
  await rejectedFor({ thesis: "Buy 10 shares of MSFT at $285: Azure is accelerating." }, "sanity_rejected", /MSFT/);
});

// ---------------------------------------------------------------- tests 9–10

await step("test 9: two simultaneous claims: one wins, one receipt", async () => {
  const second = await portal("/api/executor-tokens", { body: { executor_id: "second" } });
  assert.equal(second.status, 201);
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await toApproved(plan_id);
  const key = await idempotencyKey(plan_id, 1);
  const claimAs = (tok) => fetch(`${site}/api/executor/claim`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ plan_id, idempotency_key: key }) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const results = await Promise.all([claimAs(EXEC), claimAs(second.body.token)]);
  const won = results.filter((r) => r.status === 200);
  assert.equal(won.length, 1, JSON.stringify(results));
  assert.equal(results.find((r) => r.status !== 200).body.error_code, "already_claimed");
  const claimId = won[0].body.claim_id;
  const execId = results[0].status === 200 ? "local" : "second";
  const tok = execId === "local" ? EXEC : second.body.token;
  const rc = { claim_id: claimId, plan_id, version: 1, executor_id: execId, mode: "dry_run", outcome: "simulated", reason_code: null, reason_text: "test", robinhood_order_id: null, filled_quantity: null, filled_price: null, policy_snapshot_id: 1 };
  const post = () => fetch(`${site}/api/executor/receipt`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(rc) }).then((r) => r.json());
  const [a, b] = await Promise.all([post(), post()]);
  assert.ok(a.receipt_id && a.receipt_id === b.receipt_id, "the second post returns the same receipt");
  assert.equal((await rest(`receipts?plan_id=eq.${plan_id}&select=receipt_id`)).body.length, 1);
  await portal(`/api/executor-tokens/${second.body.id}`, { method: "DELETE" });
});

await step("test 10: paused or killed, the board refuses claims and the executor claims nothing", async () => {
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await toApproved(plan_id);
  const key = await idempotencyKey(plan_id, 1);
  for (const action of ["pause", "kill"]) {
    const c = await portal("/api/control", { body: { action, confirm: true } });
    assert.equal(c.status, 200, c.text);
    const r = await exec("/claim", { plan_id, idempotency_key: key });
    assert.equal(r.body.error_code, action === "pause" ? "paused" : "killed");
    assert.match(runExecutor(), /\b(no plan|not claiming|$)/);
    assert.equal((await claude.tool("get_plan", { plan_id })).status, "approved");
    await portal("/api/control", { body: { action: "resume" } });
  }
  assert.equal((await portal("/api/control", { body: { action: "kill" } })).status, 422, "kill needs confirmation");
  await portal(`/api/plans/${plan_id}/cancel`, { body: {} });
});

// ---------------------------------------------------------------- live against the mock (§10, §12.1 11–12, §12.2)

await step("live gate: dry-run stays on until the checklist is complete; the first live order is small and verified", async () => {
  await clearApproved();
  assert.equal((await portal("/api/control", { body: { action: "dry_run_off", confirm: true } })).body.error_code, "live_gate_incomplete");
  const status = await portal("/api/executor-status");
  const ex = status.body.executors.find((e) => e.executor_id === "local");
  assert.equal(ex.account_mask, "••••5678", "the executor reports only the masked account");
  const policyVersion = status.body.policy.policy_version;
  const gate = await portal("/api/live-gate", { body: { account_mask: "••••5678", funding_usd: 1000, approvals_mode: "A", policy_version: policyVersion, acknowledge: true } });
  assert.equal(gate.status, 200, gate.text);
  assert.equal(gate.body.gate.complete, true);
  assert.equal((await portal("/api/control", { body: { action: "dry_run_off" } })).body.error_code, "confirm_required");
  assert.equal((await portal("/api/control", { body: { action: "dry_run_off", confirm: true } })).status, 200);
  // Still dry-run until the machine opts in.
  const { plan_id: dry } = await claude.tool("create_plan", newPlan({ order: { quantity_shares: 1, limit_price: 90 }, thesis: "Buy 1 AAPL at $90 as the first live test.", quote_price: 90.1 }));
  await rhState({ price: 90.2 });
  await toApproved(dry);
  runExecutor();
  assert.equal((await claude.tool("get_plan", { plan_id: dry })).latest_receipt.mode, "dry_run");
  // Machine opt-in: live. The order is exactly the ticket, with the plan-version ref_id, read back.
  executorConfig({ allow_live: true });
  const { plan_id } = await claude.tool("create_plan", newPlan({ order: { quantity_shares: 1, limit_price: 90 }, thesis: "Buy 1 AAPL at $90 as the first live test.", quote_price: 90.1 }));
  await toApproved(plan_id);
  runExecutor();
  const v = (await portal(`/api/plans/${plan_id}`)).body;
  assert.equal(v.status, "executed", JSON.stringify(v.latest_receipt));
  assert.equal(v.latest_receipt.mode, "live");
  assert.match(v.latest_receipt.robinhood_order_id, /^mock-/);
  const rh = await rhState();
  assert.equal(rh.placeCalls, 1);
  assert.equal(rh.orders[0].ref_id, await idempotencyKey(plan_id, 1));
  assert.deepEqual([rh.orders[0].symbol, rh.orders[0].side, rh.orders[0].type, rh.orders[0].quantity, rh.orders[0].price], ["AAPL", "buy", "limit", "1", "90"]);
  assert.equal((await portal("/api/executor-status")).body.control.live_trial_pending, false);
  // Agents and the trades list see a truncated order id; the plan page the full one.
  assert.match((await claude.tool("get_plan", { plan_id })).latest_receipt.robinhood_order_id, /…$/);
});

await step("test 11: wrong account: wrong_account_rejected, no order", async () => {
  await rhState({ account: "9OTHER00001" });
  const before = (await rhState()).placeCalls;
  const { plan_id } = await claude.tool("create_plan", newPlan({ order: { quantity_shares: 1, limit_price: 90 }, thesis: "Buy 1 AAPL at $90.", quote_price: 90.1 }));
  await toApproved(plan_id);
  runExecutor();
  const v = await claude.tool("get_plan", { plan_id });
  assert.equal(v.status, "rejected", JSON.stringify(v.latest_receipt));
  assert.equal(v.latest_receipt.reason_code, "wrong_account_rejected");
  assert.equal((await rhState()).placeCalls, before);
  await rhState({ account: "5RX12345678" });
});

await step("test 12 (board side): a receipt for a real order is kept even if the claim is gone", async () => {
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await toApproved(plan_id);
  const key = await idempotencyKey(plan_id, 1);
  const c = await exec("/claim", { plan_id, idempotency_key: key });
  await portal(`/api/plans/${plan_id}/comments`, { body: { body: "Hold on", is_question: true } }); // drops the claim
  const r = await exec("/receipt", { claim_id: c.body.claim_id, plan_id, version: 1, executor_id: "local", mode: "live", outcome: "executed", reason_code: null, reason_text: "late", robinhood_order_id: "rh-late-1", filled_quantity: 1, filled_price: 90, policy_snapshot_id: 1 });
  assert.equal(r.status, 200);
  assert.match(r.body.note, /claim no longer held/);
  assert.equal((await rest(`receipts?plan_id=eq.${plan_id}&select=robinhood_order_id`)).body[0].robinhood_order_id, "rh-late-1");
  await portal("/api/control", { body: { action: "dry_run_on" } });
  executorConfig();
  await rhState({ price: 285.5 });
});

// ---------------------------------------------------------------- tests 13–16

await step("test 13: portal and MCP show the same plan; a portal comment reaches agents", async () => {
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await gemini.tool("ask_question", { plan_id, body: "Is size right? @claude", mentioned_agent_id: "claude" });
  const t0 = Date.now();
  const board = (await portal("/api/board")).body.plans.find((p) => p.plan_id === plan_id);
  assert.ok(board && Date.now() - t0 < 10_000);
  const m = (await claude.tool("list_plans", { limit: 100 })).plans.find((p) => p.plan_id === plan_id);
  for (const k of ["status", "current_version", "open_questions", "open_human_questions", "valid_until"]) assert.deepEqual(board[k], m[k], k);
  assert.deepEqual(board.awaiting_agents, ["claude"]);
  await portal(`/api/plans/${plan_id}/comments`, { body: { body: "Keep it to 10 shares." } });
  const cs = (await claude.tool("list_comments", { plan_id })).comments;
  assert.equal(cs.at(-1).author_type, "human");
  assert.equal(cs.at(-1).body, "Keep it to 10 shares.");
});

await step("test 14: three edits → immutable snapshots with author and time, current marked", async () => {
  const { plan_id } = await claude.tool("create_plan", newPlan());
  await claude.tool("update_plan", { plan_id, expected_version: 1, thesis: "edit 1" });
  await gemini.tool("update_plan", { plan_id, expected_version: 2, evidence: "edit 2" });
  const e3 = await portal(`/api/plans/${plan_id}`, { method: "PUT", body: { expected_version: 3, invalidation: "edit 3" } });
  assert.equal(e3.status, 200, e3.text);
  const v = (await portal(`/api/plans/${plan_id}`)).body;
  assert.deepEqual(v.versions.map((x) => [x.version, x.edited_by_id, x.current]), [[1, "claude", false], [2, "claude", false], [3, "gemini", false], [4, "owner", true]]);
  const snap = await portal(`/api/plans/${plan_id}/versions/2`);
  assert.equal(snap.body.snapshot.thesis, "edit 1");
  const tamper = await rest(`plan_versions?plan_id=eq.${plan_id}&version=eq.2`, { method: "PATCH", body: { diff_summary: "rewritten" } });
  assert.ok(tamper.status >= 400, "plan_versions is append-only");
  const del = await rest(`audit_log?plan_id=eq.${plan_id}`, { method: "DELETE" });
  assert.ok(del.status >= 400, "audit_log is append-only");
  assert.ok((await rest(`plans?plan_id=eq.${plan_id}`, { method: "DELETE" })).status >= 400, "plans can't be deleted");
});

await step("test 15: every timestamp over MCP is UTC (…Z)", async () => {
  const v = await claude.tool("get_plan", { plan_id: p1 });
  const stamps = JSON.stringify(v).match(/"\d{4}-\d{2}-\d{2}T[^"]+"/g) ?? [];
  assert.ok(stamps.length > 10);
  for (const s of stamps) assert.match(s, /^"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z"$/, s);
});

await step("test 16: no plaintext token, password or account number in the board's database", async () => {
  const dump = execFileSync("docker", ["exec", "supabase_db_waypack", "pg_dump", "-U", "postgres", "-n", "tradeboard", "--data-only"], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });
  for (const needle of ["tba_dev_claude", "tbx_dev_local", "5RX12345678", "tradeboard-dev", secret, cookie.split("=")[1]]) assert.ok(!dump.includes(needle), `dump contains ${String(needle).slice(0, 6)}…`);
  assert.ok(dump.includes("••••5678"));
});

// ---------------------------------------------------------------- OAuth for agents

await step("OAuth: register, owner consents as an agent, token works; revoking the agent cuts it off", async () => {
  const meta = await (await fetch(`${site}/.well-known/oauth-authorization-server`)).json();
  const reg = await (await fetch(meta.registration_endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: "Test agent app", redirect_uris: ["http://127.0.0.1:9999/cb"], token_endpoint_auth_method: "none" }) })).json();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const auth = new URL(meta.authorization_endpoint);
  Object.entries({ response_type: "code", client_id: reg.client_id, redirect_uri: "http://127.0.0.1:9999/cb", code_challenge: challenge, code_challenge_method: "S256", scope: "mcp", state: "s1", resource: `${site}/mcp` }).forEach(([k, v]) => auth.searchParams.set(k, v));
  const start = await fetch(auth, { redirect: "manual" });
  assert.equal(start.status, 302);
  const consent = new URL(start.headers.get("location"));
  const setCookie = start.headers.get("set-cookie") ?? "";
  const extra = setCookie ? setCookie.split(",").map((c) => c.split(";")[0]).join("; ") : "";
  await portal("/api/agents", { body: { agent_id: "oauthbot", display_name: "OAuth bot" } });
  const approve = await fetch(`${site}/authorize`, { method: "POST", headers: { "Content-Type": "application/json", "X-Tradeboard": "1", Cookie: [cookie, extra].filter(Boolean).join("; ") }, body: JSON.stringify({ handle: consent.searchParams.get("handle"), decision: "approve", agent_id: "oauthbot" }) });
  const { redirectTo } = await approve.json();
  assert.ok(redirectTo, "consent returns the redirect");
  const code = new URL(redirectTo).searchParams.get("code");
  const tok = await (await fetch(meta.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: "http://127.0.0.1:9999/cb", client_id: reg.client_id, code_verifier: verifier, resource: `${site}/mcp` }) })).json();
  const bot = mcp(tok.access_token);
  const { plan_id } = await bot.tool("create_plan", newPlan({ title: "from oauth" }));
  assert.equal((await bot.tool("get_plan", { plan_id })).created_by.id, "oauthbot");
  await portal("/api/agents/oauthbot/revoke", { body: {} });
  assert.notEqual((await bot.rpc("tools/list")).status, 200);
});

await step("an agent that's revoked loses its bearer token too", async () => {
  await portal("/api/agents", { body: { agent_id: "tempbot", display_name: "Temp" } });
  const t = await portal("/api/agents/tempbot/tokens", { body: { label: "t" } });
  const bot = mcp(t.body.token);
  assert.equal((await bot.rpc("tools/list")).status, 200);
  await portal("/api/agents/tempbot/revoke", { body: {} });
  assert.notEqual((await bot.rpc("tools/list")).status, 200);
});

await step("agents are rate-limited per token (rate_limited)", async () => {
  await portal("/api/agents", { body: { agent_id: "burst", display_name: "Burst" } });
  const t = await portal("/api/agents/burst/tokens", { body: { label: "t" } });
  const bot = mcp(t.body.token);
  let limited = null;
  for (let i = 0; i < 460 && !limited; i++) {
    const r = await bot.rpc("ping");
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, "a burst is cut off");
  assert.equal(limited.body.error.data.error_code, "rate_limited");
  await portal("/api/agents/burst/revoke", { body: {} });
});

await step("boards are private: a second user signs up to an empty board and can't reach the first's plans", async () => {
  const begin = await portal("/api/auth/begin", { raw: true, body: { access_token: strangerToken } });
  assert.equal(begin.body.enroll, true);
  const v = await portal("/api/auth/verify", { raw: true, body: { access_token: strangerToken, code: await totp(begin.body.secret) } });
  assert.equal(v.status, 200, v.text);
  const mine = cookie;
  cookie = v.headers.get("set-cookie").split(";")[0];
  const board = (await portal("/api/board")).body.plans;
  assert.deepEqual(board.map((p) => p.is_demo), [true], "a new board has only its DEMO plan");
  assert.equal((await portal(`/api/plans/${p1}`)).status, 404);
  assert.equal((await portal(`/api/plans/${p1}/approve`, { body: { version: 1 } })).status, 404);
  assert.equal((await portal(`/api/plans/${p1}/comments`, { body: { body: "hi" } })).status, 404);
  assert.deepEqual((await portal("/api/agents")).body.agents, []);
  assert.equal((await portal("/api/executor-status")).body.executors.length, 0);
  // The first user's agent can't see the second user's plans either.
  assert.equal((await claude.call("get_plan", { plan_id: board[0].plan_id })).error.error_code, "not_found");
  assert.ok(!(await claude.tool("list_plans", { limit: 100 })).plans.some((p) => p.plan_id === board[0].plan_id));
  // An agent connected by the second user works on the second board only.
  const t = await portal("/api/agents", { body: { agent_id: "claude", display_name: "Claude" } });
  assert.equal(t.status, 201);
  const tok2 = (await portal("/api/agents/claude/tokens", { body: { label: "t" } })).body.token;
  const theirs = await mcp(tok2).tool("list_plans", { limit: 100 });
  assert.deepEqual(theirs.plans.map((p) => p.plan_id), [board[0].plan_id]);
  // Deleting the second board removes it all and signs out; the first board is untouched.
  const del = await portal("/api/account?confirm=1", { method: "DELETE" });
  assert.equal(del.status, 200, del.text);
  assert.notEqual((await mcp(tok2).rpc("tools/list")).status, 200);
  cookie = mine;
  assert.equal((await portal(`/api/plans/${p1}`)).status, 200);
});

console.log(`tradeboard integration: ${steps.length} checks passed`);
mocks.forEach((m) => m.kill());
process.exit(0);
