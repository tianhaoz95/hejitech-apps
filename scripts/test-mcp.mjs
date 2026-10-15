#!/usr/bin/env node
// Integration test for the MCP edge function against a local `supabase start` stack with seed data.
// Usage: node scripts/test-mcp.mjs [base-url]
import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:54321/functions/v1/mcp";
const token = "wh_dev_local_token";
let id = 0;

async function rpc(method, params = {}, auth = token) {
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  return { status: res.status, body: await res.json() };
}
async function tool(name, args = {}) {
  const r = await rpc("tools/call", { name, arguments: args });
  assert.equal(r.status, 200);
  const result = r.body.result;
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
}

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`  ✓ ${name}`); };

await step("rejects missing token with OAuth discovery hint", async () => {
  const r = await rpc("tools/list", {}, null);
  assert.equal(r.status, 401);
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
console.log(`MCP integration: ${steps.length} checks passed`);
