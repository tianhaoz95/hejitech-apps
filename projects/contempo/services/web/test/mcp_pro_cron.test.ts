// Unit tests for Contempo's MCP server, unified Pro status, and contemporaneity nudge cron.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcp, TOOLS } from "../src/worker/mcp.ts";
import { evaluateNudge, isoWeekKey } from "../src/worker/cron.ts";
import { purchaseActive } from "../src/worker/billing.ts";

test("MCP tools list includes core tax/audit tools", async () => {
  const req = new Request("https://contempo.hejitech.workers.dev/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const res = await handleMcp(req, { userId: "u1", via: "token" }, {} as never);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { result: { tools: { name: string }[] } };
  const names = body.result.tools.map((t) => t.name);
  assert.deepEqual(
    names,
    TOOLS.map((t) => t.name)
  );
  assert.ok(names.includes("get_tax_test_progress"));
  assert.ok(names.includes("log_entry"));
  assert.ok(names.includes("audit_risk_check"));
  assert.ok(names.includes("export_audit_summary"));
});

test("MCP initialize returns protocol version and serverInfo", async () => {
  const req = new Request("https://contempo.hejitech.workers.dev/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 42, method: "initialize" }),
  });
  const res = await handleMcp(req, { userId: "u1", via: "oauth" }, {} as never);
  const body = (await res.json()) as { id: number; result: { serverInfo: { name: string } } };
  assert.equal(body.id, 42);
  assert.equal(body.result.serverInfo.name, "contempo");
});

test("evaluateNudge flags pending drafts approaching the 14-day IRS cliff", () => {
  const now = new Date("2026-11-23T16:00:00Z");
  const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString();
  const nudge = evaluateNudge(
    [{ user_id: "u1", status: "pending_review", is_vague: false, activity_date: tenDaysAgo }],
    now
  );
  assert.ok(nudge);
  assert.equal(nudge.alert.kind, "draft_cliff");
  assert.equal(nudge.key, `contempo:draft_cliff:${isoWeekKey(now)}`);
});

test("evaluateNudge flags vague confirmed entries when no drafts are near cliff", () => {
  const now = new Date("2026-11-23T16:00:00Z");
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
  const nudge = evaluateNudge(
    [{ user_id: "u1", status: "confirmed", is_vague: true, activity_date: twoDaysAgo }],
    now
  );
  assert.ok(nudge);
  assert.equal(nudge.alert.kind, "vague_detail");
});

test("evaluateNudge returns null when all recent entries are clean and confirmed", () => {
  const now = new Date("2026-11-23T16:00:00Z");
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
  const nudge = evaluateNudge(
    [{ user_id: "u1", status: "confirmed", is_vague: false, activity_date: twoDaysAgo }],
    now
  );
  assert.equal(nudge, null);
});

test("purchaseActive handles lifetime, active annual, expired, and revoked", () => {
  const now = Date.parse("2026-11-23T00:00:00Z");
  assert.equal(purchaseActive({ tier: "lifetime", expires_at: null, revoked_at: null }, now), true);
  assert.equal(purchaseActive({ tier: "lifetime", expires_at: null, revoked_at: "2026-11-01T00:00:00Z" }, now), false);
  assert.equal(purchaseActive({ tier: "annual", expires_at: "2027-01-01T00:00:00Z", revoked_at: null }, now), true);
  assert.equal(purchaseActive({ tier: "annual", expires_at: "2026-01-01T00:00:00Z", revoked_at: null }, now), false);
});
