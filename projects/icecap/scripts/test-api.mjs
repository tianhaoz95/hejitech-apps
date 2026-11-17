#!/usr/bin/env node
// Icecap against the local stack: RLS on saved deals and settings as two different users, and the
// Worker's API (Pro, waitlist, admin, account deletion, CORS) and page routing. Needs `supabase start`
// (seeds: supabase/seeds/icecap.sql) and the Worker: `npm run dev:worker -w @icecap/web` with
// SUPABASE_SERVICE_ROLE_KEY in services/web/.dev.vars. CI: icecap-ci.yml's backend job.
//
//   node projects/icecap/scripts/test-api.mjs
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const SUPABASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:55421";
const ANON = process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const WORKER = process.env.WORKER_URL ?? "http://127.0.0.1:8800";
const PASSWORD = "icecap-dev-123";

let passed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok  ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}\n${e.stack ?? e}`);
    process.exit(1);
  }
}

async function signIn(email) {
  const db = createClient(SUPABASE, ANON, { db: { schema: "icecap" }, auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { db, token: data.session.access_token, id: data.user.id };
}

async function api(path, { token, method, body, headers = {} } = {}) {
  const res = await fetch(`${WORKER}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    redirect: "manual",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* a page */ }
  return { status: res.status, json, text, headers: res.headers };
}

const pro = await signIn("pro@icecap.test");
const free = await signIn("free@icecap.test");
const deal = { mode: "rental", price: 250000, address: "9 Test Lane", url: "https://www.redfin.com/test", taxes: 3000, hoa: 0, estimatedRent: 1900, rehabCost: 0, arv: 250000, holdingCosts: 0, assumptions: { downPaymentPercent: 20, interestRate: 7, loanTermYears: 30, vacancyRate: 5, maintenanceRate: 5, managementFeeRate: 8, closingCostsPercent: 3, sellingCostsPercent: 6 } };

await step("RLS: each user sees only their own deals", async () => {
  const { data: mine, error } = await pro.db.from("properties").select("id, user_id");
  assert.ifError(error);
  assert.ok(mine.length >= 2, "the seeded deals");
  assert.ok(mine.every((r) => r.user_id === pro.id));
  const { data: theirs } = await free.db.from("properties").select("id");
  assert.ok(!theirs.some((r) => mine.some((m) => m.id === r.id)));
});

let freeDeal;
await step("RLS: insert defaults to the caller and can't claim someone else", async () => {
  const { data, error } = await free.db.from("properties").insert({ data: deal }).select("id, user_id").single();
  assert.ifError(error);
  assert.equal(data.user_id, free.id);
  freeDeal = data.id;
  const forged = await free.db.from("properties").insert({ user_id: pro.id, data: deal });
  assert.ok(forged.error, "inserting a row for another user must fail");
  const upd = await pro.db.from("properties").update({ data: { ...deal, price: 1 } }).eq("id", freeDeal).select("id");
  assert.equal(upd.data.length, 0, "another user's deal can't be updated");
});

await step("RLS: settings upsert and read back", async () => {
  const { error } = await free.db.from("settings").upsert({ user_id: free.id, default_assumptions: { ...deal.assumptions, interestRate: 6.25 } });
  assert.ifError(error);
  const { data } = await free.db.from("settings").select("default_assumptions").single();
  assert.equal(data.default_assumptions.interestRate, 6.25);
  const { data: other } = await pro.db.from("settings").select("user_id");
  assert.ok(!other.some((r) => r.user_id === free.id));
});

await step("RLS: anon can read nothing", async () => {
  const anon = createClient(SUPABASE, ANON, { db: { schema: "icecap" }, auth: { persistSession: false } });
  for (const t of ["properties", "settings", "waitlist", "pro_grants", "purchases", "admins"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    assert.ok(error || data.length === 0, `anon read ${t}`);
  }
});

await step("GET /api/pro: a grant gives Pro, no grant gives none", async () => {
  const a = await api("/api/pro", { token: pro.token });
  assert.equal(a.status, 200);
  assert.equal(a.json.pro, true);
  assert.equal(a.json.source, "grant");
  assert.equal(a.json.email, "pro@icecap.test");
  assert.ok(Array.isArray(a.json.offers));
  const b = await api("/api/pro", { token: free.token });
  assert.equal(b.json.pro, false);
  assert.equal((await api("/api/pro")).status, 401);
  assert.equal((await api("/api/pro", { token: "nope" })).status, 401);
});

await step("checkout without Stripe configured answers 503, not a crash", async () => {
  const r = await api("/api/billing/checkout", { token: free.token, body: { plan: "annual" } });
  assert.ok([400, 503].includes(r.status), `status ${r.status}`);
  assert.equal(r.json.error, "billing");
  assert.equal((await api("/api/billing/checkout", { token: free.token, body: { plan: "monthly" } })).status, 400);
});

const email = `waitlist-${Date.now()}@example.com`;
await step("waitlist: join once, count, reject bad emails", async () => {
  const before = (await api("/api/waitlist")).json.count;
  const j = await api("/api/waitlist", { body: { email: email.toUpperCase(), name: "Test", source: "test" } });
  assert.equal(j.status, 200);
  assert.equal(j.json.already, false);
  assert.equal(j.json.count, before + 1);
  const again = await api("/api/waitlist", { body: { email } });
  assert.equal(again.json.already, true);
  assert.equal(again.json.count, before + 1);
  assert.equal((await api("/api/waitlist", { body: { email: "nope" } })).status, 400);
});

await step("admin: admins only; stats, waitlist, grants", async () => {
  assert.equal((await api("/api/admin/stats", { token: free.token })).status, 403);
  const s = await api("/api/admin/stats", { token: pro.token });
  assert.equal(s.status, 200);
  assert.ok(s.json.properties >= 3 && s.json.waitlist >= 1 && s.json.pro.grants >= 1);
  const w = await api("/api/admin/waitlist", { token: pro.token });
  assert.ok(w.json.entries.some((e) => e.email === email && e.name === "Test"));
  assert.equal((await api("/api/admin/grants", { token: pro.token, body: { email: "free@icecap.test", until: "2099-01-01", note: "test" } })).status, 200);
  assert.equal((await api("/api/pro", { token: free.token })).json.pro, true);
  const list = await api("/api/admin/pro", { token: pro.token });
  assert.ok(list.json.accounts.some((a) => a.email === "free@icecap.test" && a.source === "grant"));
  assert.equal((await api("/api/admin/grants", { token: pro.token, method: "DELETE", body: { email: "free@icecap.test" } })).status, 200);
  assert.equal((await api("/api/pro", { token: free.token })).json.pro, false);
});

await step("DELETE /api/account removes only the caller's Icecap data", async () => {
  const r = await api("/api/account", { token: free.token, method: "DELETE" });
  assert.equal(r.status, 200);
  const { data } = await free.db.from("properties").select("id");
  assert.equal(data.length, 0);
  const { data: proDeals } = await pro.db.from("properties").select("id");
  assert.ok(proDeals.length >= 2);
  // The HEJI sign-in itself stays.
  assert.equal((await api("/api/pro", { token: free.token })).status, 200);
});

await step("CORS for the extension", async () => {
  const r = await fetch(`${WORKER}/api/pro`, { method: "OPTIONS", headers: { Origin: "chrome-extension://gbjiibgccfkpodffchmnokflclbnbfpl", "Access-Control-Request-Method": "GET" } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.match(r.headers.get("access-control-allow-headers"), /Authorization/);
});

await step("pages: home, deep links into the apps, legal, unknown paths", async () => {
  const home = await api("/");
  assert.equal(home.status, 200);
  assert.match(home.text, /Early Access Waitlist/);
  for (const [path, title] of [["/app/portfolio", /Icecap Hub/], ["/app/property/abc", /Icecap Hub/], ["/admin/pro", /Icecap Admin/], ["/joined", /Early Access Waitlist/], ["/privacy/", /Privacy Policy/], ["/terms/", /Terms of Service/], ["/promo/", /Promo Studio/]]) {
    const r = await api(path);
    assert.equal(r.status, 200, path);
    assert.match(r.text, title, path);
  }
  const lost = await api("/no-such-page");
  assert.equal(lost.status, 302);
  assert.equal(new URL(lost.headers.get("location")).pathname, "/");
  assert.equal((await api("/stripe/webhook", { body: {}, headers: { "Stripe-Signature": "t=1,v1=00" } })).status, 400);
});

console.log(`\n${passed} checks passed`);
