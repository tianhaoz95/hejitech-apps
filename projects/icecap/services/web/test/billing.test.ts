// Icecap Pro (billing.ts): Stripe purchases and grants by email combining into one answer, and
// Stripe's webhook on the shared HEJI account. Same cases as the other HEJI Workers' billing tests,
// minus the App Store and Google Play (Icecap sells on the web only).
import { describe, expect, it } from "vitest";
import { handleStripeWebhook, proStatus, purchaseFromEvent, verifyStripeSignature } from "../src/worker/billing.ts";
import { PRO } from "../src/worker/pro-config.ts";
import type { Db } from "../src/worker/store.ts";

// ---- an in-memory stand-in for the supabase-js calls billing.ts makes
type Row = Record<string, unknown>;
class Query {
  private filters: [string, unknown][] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row = {};
  constructor(private db: FakeDb, private table: string) {}
  select() { return this; }
  eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
  insert(row: Row) { this.op = "insert"; this.payload = row; return this; }
  update(patch: Row) { this.op = "update"; this.payload = patch; return this; }
  upsert(row: Row) { this.op = "upsert"; this.payload = row; return this; }
  private rows() { return (this.db.tables[this.table] ??= []); }
  private hits() { return this.rows().filter((r) => this.filters.every(([k, v]) => r[k] === v)); }
  async maybeSingle() { return { data: structuredClone(this.hits()[0] ?? null), error: null }; }
  then<T>(done: (v: { data: unknown; error: { code: string; message: string } | null }) => T) {
    const key = this.table === "billing_customers" ? "user_id" : "id";
    if (this.op === "select") return Promise.resolve(done({ data: structuredClone(this.hits()), error: null }));
    if (this.op === "update") { for (const r of this.hits()) Object.assign(r, this.payload); return Promise.resolve(done({ data: null, error: null })); }
    const have = this.rows().find((r) => r[key] === this.payload[key]);
    if (have && this.op === "insert") return Promise.resolve(done({ data: null, error: { code: "23505", message: "duplicate" } }));
    if (have) Object.assign(have, this.payload); else this.rows().push({ ...this.payload });
    return Promise.resolve(done({ data: null, error: null }));
  }
}
class FakeDb {
  tables: Record<string, Row[]> = {};
  emails: Record<string, string> = {};
  auth = { admin: { getUserById: async (id: string) => ({ data: { user: this.emails[id] ? { email: this.emails[id] } : null } }) } };
  from(t: string) { return new Query(this, t); }
}
const fake = () => {
  const f = new FakeDb();
  return { f, db: f as unknown as Db };
};

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = Date.UTC(2027, 0, 15, 12);
const DAY = 86_400_000;

describe("one answer", () => {
  it("prefers lifetime, then the later renewal, and falls back to a grant by email", async () => {
    const { f, db } = fake();
    f.tables.pro_grants = [{ email: "a@example.com", until: null }];
    expect(await proStatus(db, USER, "A@example.com ", NOW)).toMatchObject({ pro: true, source: "grant", plan: "lifetime", had_purchase: false });
    f.tables.purchases = [
      { id: "stripe:sub_1", user_id: USER, source: "stripe", tier: "annual", expires_at: new Date(NOW + 30 * DAY).toISOString(), revoked_at: null },
    ];
    expect(await proStatus(db, USER, undefined, NOW)).toMatchObject({ pro: true, source: "stripe", manage: "stripe", plan: "annual", had_purchase: true });
    f.tables.purchases.push({ id: "stripe:pi_1", user_id: USER, source: "stripe", tier: "lifetime", expires_at: null, revoked_at: null });
    expect(await proStatus(db, USER, undefined, NOW)).toMatchObject({ plan: "lifetime", until: null });
    expect((await proStatus(db, OTHER, undefined, NOW)).pro).toBe(false);
    // An expired grant gives nothing; a lapsed subscription still counts as a past purchase.
    const { f: g, db: db2 } = fake();
    g.tables.pro_grants = [{ email: "b@example.com", until: new Date(NOW - DAY).toISOString() }];
    g.tables.purchases = [{ id: "stripe:sub_2", user_id: OTHER, source: "stripe", tier: "annual", expires_at: new Date(NOW - DAY).toISOString(), revoked_at: null }];
    g.emails[OTHER] = "B@example.com";
    expect(await proStatus(db2, OTHER, undefined, NOW)).toMatchObject({ pro: false, had_purchase: true });
  });
});

describe("Stripe", () => {
  const secret = "whsec_test";
  async function sign(payload: string, t = Math.floor(Date.now() / 1000)) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
    return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  const event = (type: string, object: Record<string, unknown>, id = "evt_1") => ({ id, type, created: Math.floor(NOW / 1000), data: { object } });

  it("checks the signature", async () => {
    const payload = '{"a":1}';
    expect(await verifyStripeSignature(secret, payload, await sign(payload))).toBe(true);
    expect(await verifyStripeSignature(secret, payload + " ", await sign(payload))).toBe(false);
    expect(await verifyStripeSignature(secret, payload, await sign(payload, 1))).toBe(false);
  });

  it("maps subscriptions (trial included) and lifetime payments to purchases", () => {
    const sub = event("customer.subscription.created", { id: "sub_1", status: "trialing", items: { data: [{ current_period_end: NOW / 1000 + 7 * 86400 }] }, livemode: true });
    expect(purchaseFromEvent(sub, USER, NOW)).toMatchObject({ id: "stripe:sub_1", tier: "annual", expires_at: new Date(NOW + 7 * DAY).toISOString(), environment: "production" });
    const gone = event("customer.subscription.deleted", { id: "sub_1", status: "canceled" });
    expect(purchaseFromEvent(gone, USER, NOW)?.expires_at).toBe(new Date(NOW).toISOString());
    const paid = event("checkout.session.completed", { mode: "payment", payment_status: "paid", payment_intent: "pi_1" });
    expect(purchaseFromEvent(paid, USER, NOW)).toMatchObject({ id: "stripe:pi_1", tier: "lifetime" });
    expect(purchaseFromEvent(event("checkout.session.completed", { mode: "subscription", payment_status: "paid" }), USER, NOW)).toBeNull();
    const refund = event("charge.refunded", { refunded: true, payment_intent: "pi_1", metadata: { plan: "lifetime" } });
    expect(purchaseFromEvent(refund, USER, NOW)?.revoked_at).toBe(new Date(NOW).toISOString());
  });

  it("records this app's events once and ignores other HEJI products on the shared account", async () => {
    const { f, db } = fake();
    const env = { PUBLIC_URL: "https://x.test", STRIPE_WEBHOOK_SECRET: secret };
    const post = async (e: object) => {
      const payload = JSON.stringify(e);
      return (await handleStripeWebhook(env, db, new Request("https://x.test/stripe/webhook", { method: "POST", body: payload, headers: { "Stripe-Signature": await sign(payload) } }))).json();
    };
    expect(await post(event("checkout.session.completed", { mode: "payment", payment_status: "paid", payment_intent: "pi_9", metadata: { app: "waypack", user_id: USER } }))).toMatchObject({ ignored: `not ${PRO.app}` });
    f.tables.billing_customers = [{ user_id: USER, stripe_customer_id: "cus_1" }];
    const sub = { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ current_period_end: Date.now() / 1000 + 365 * 86400 }] }, metadata: { app: PRO.app } };
    expect(await post(event("customer.subscription.created", sub, "evt_2"))).toMatchObject({ purchase: "stripe:sub_1" });
    expect(await post(event("customer.subscription.created", sub, "evt_2"))).toMatchObject({ duplicate: true });
    expect(f.tables.purchases).toHaveLength(1);
    expect((await proStatus(db, USER, undefined)).source).toBe("stripe");
    const bad = await handleStripeWebhook(env, db, new Request("https://x.test/stripe/webhook", { method: "POST", body: "{}", headers: { "Stripe-Signature": "t=1,v1=00" } }));
    expect(bad.status).toBe(400);
  });
});
