#!/usr/bin/env node
// The App Review demo account against the local stack (`supabase start` at the repo root, then
// `npm run dev:worker -w @contempo/web` on 127.0.0.1:8789): wrong password refused, the right one
// gets a session that reads the demo properties and entries (RLS), and a second sign-in resets
// what was changed in between. Usage: node projects/contempo/services/web/scripts/test-review.mjs
import assert from "node:assert/strict";

const site = (process.argv[2] ?? "http://127.0.0.1:8789").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const sign = (password) => fetch(`${site}/api/review-sign-in`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "Review@Example.com", password }),
});
const rest = (token, path, init = {}) => fetch(`${supabase}/rest/v1/${path}`, {
  ...init, headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Accept-Profile": "contempo", "Content-Profile": "contempo", "Content-Type": "application/json", ...(init.headers ?? {}) },
});

assert.equal((await sign("nope")).status, 401);
const first = await (await sign("contempo-review-dev")).json();
assert.ok(first.access_token, JSON.stringify(first).slice(0, 300));
const props = await (await rest(first.access_token, "properties?select=name&order=name")).json();
assert.deepEqual(props.map((p) => p.name), ["Downtown Loft", "Lakeview Cabin"]);
const entries = await (await rest(first.access_token, "entries?select=id,task")).json();
assert.equal(entries.length, 5);
assert.equal((await rest(first.access_token, `entries?id=eq.${entries[0].id}`, { method: "DELETE" })).status, 204);
const again = await (await sign("contempo-review-dev")).json();
assert.equal(again.user.id, first.user.id);
assert.equal((await (await rest(again.access_token, "entries?select=id")).json()).length, 5);
console.log("Contempo review sign-in: 4 checks passed");
