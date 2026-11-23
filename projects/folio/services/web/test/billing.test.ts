// Pro on every platform (billing.ts, appstore.ts): App Store JWS checks with a throwaway chain in
// fixtures/appstore-chain.json (not Apple's), purchases from each store combining into one answer, and
// Stripe's webhook. The chain (DER base64, keys as PKCS#8) was made like this:
//   openssl ecparam -name secp384r1 -genkey -noout -out root.key
//   openssl req -x509 -new -key root.key -sha384 -days 36500 -subj "/CN=Test Root" -addext basicConstraints=critical,CA:true -out root.pem
//   intermediate: P-384, CA:true + extension 1.2.840.113635.100.6.2.1=ASN1:NULL, signed by root
//   leaf: P-256 + extension 1.2.840.113635.100.6.11.1=ASN1:NULL, signed by the intermediate
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/appstore-chain.json";
import { APPLE_ROOT_G3, appStoreRow, handleNotification, parseCert, recordTransactions, verifyAppStoreJws, type AppStoreTransaction } from "../src/worker/appstore.ts";
import { handleStripeWebhook, proStatus, purchaseFromEvent, verifyStripeSignature } from "../src/worker/billing.ts";
import { PRO } from "../src/worker/pro-config.ts";
import type { Db } from "../src/worker/store.ts";

// ---- an in-memory stand-in for the supabase-js calls billing.ts and appstore.ts make
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

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ROOT = b64(fixture.root);
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = Date.UTC(2027, 0, 15, 12); // after the fixture certificates were issued
const DAY = 86_400_000;
const [ANNUAL, LIFETIME] = Object.keys(PRO.appStoreProducts);

async function jws(payload: object) {
  const h = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", x5c: [fixture.leaf, fixture.mid, fixture.root] })));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const k = await crypto.subtle.importKey("pkcs8", b64(fixture.leafKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(s)}`;
}

const tx = (o: Partial<AppStoreTransaction> = {}): AppStoreTransaction => ({
  transactionId: "2000000001", originalTransactionId: "2000000001", bundleId: PRO.bundleId,
  productId: ANNUAL, purchaseDate: NOW, expiresDate: NOW + 7 * DAY, environment: "Sandbox", signedDate: NOW, ...o,
});

describe("App Store", () => {
  it("parses Apple's real root and verifies a JWS from the pinned (test) root only", async () => {
    expect(parseCert(b64(APPLE_ROOT_G3)).curve).toBe("P-384");
    const signed = await jws(tx());
    expect(await verifyAppStoreJws(signed, { root: ROOT })).toMatchObject({ productId: ANNUAL });
    await expect(verifyAppStoreJws(signed)).rejects.toThrow("not signed by Apple");
  });

  it("rejects another app's transaction and unknown products", () => {
    expect(() => appStoreRow(tx({ bundleId: "com.example.other" }), USER)).toThrow("another app");
    expect(() => appStoreRow(tx({ productId: "x" }), USER)).toThrow("unknown product");
  });

  it("records the app's transactions so every platform sees Pro", async () => {
    const { f, db } = fake();
    const r = await recordTransactions(db, USER, [await jws(tx()), "junk"], { root: ROOT }, NOW);
    expect(r).toEqual({ saved: 1, rejected: ["not a JWS"] });
    expect(f.tables.purchases[0]).toMatchObject({ id: "app_store:2000000001", source: "app_store", tier: "annual", environment: "sandbox" });
    expect(await proStatus(db, USER, undefined, NOW)).toMatchObject({ pro: true, source: "app_store", plan: "annual", manage: "app_store" });
    expect((await proStatus(db, USER, undefined, NOW + 8 * DAY)).pro).toBe(false);
  });

  it("applies a renewal notification once, and ignores older news", async () => {
    const { f, db } = fake();
    await recordTransactions(db, USER, [await jws(tx())], { root: ROOT }, NOW);
    const renewal = { notificationType: "DID_RENEW", notificationUUID: "u1", data: { bundleId: PRO.bundleId, signedTransactionInfo: await jws(tx({ expiresDate: NOW + 365 * DAY, signedDate: NOW + DAY })) } };
    const body = { signedPayload: await jws(renewal) };
    expect((await handleNotification(db, body, { root: ROOT }, NOW + DAY)).result).toBe("DID_RENEW");
    expect((await handleNotification(db, body, { root: ROOT }, NOW + DAY)).result).toBe("duplicate");
    const stale = { notificationType: "DID_RENEW", notificationUUID: "u2", data: { signedTransactionInfo: await jws(tx({ expiresDate: NOW + 3 * DAY, signedDate: NOW })) } };
    await handleNotification(db, { signedPayload: await jws(stale) }, { root: ROOT }, NOW + DAY);
    expect(Date.parse(String(f.tables.purchases[0].expires_at))).toBe(NOW + 365 * DAY);
  });
});

describe("one answer for every store", () => {
  it("prefers lifetime, then the later renewal, and falls back to a grant by email", async () => {
    const { f, db } = fake();
    f.tables.pro_grants = [{ email: "a@example.com", until: null }];
    expect(await proStatus(db, USER, "A@example.com ", NOW)).toMatchObject({ pro: true, source: "grant", plan: "lifetime", had_purchase: false });
    f.tables.purchases = [
      { id: "stripe:sub_1", user_id: USER, source: "stripe", tier: "annual", expires_at: new Date(NOW + 30 * DAY).toISOString(), revoked_at: null },
      { id: "app_store:t", user_id: USER, source: "app_store", tier: "annual", expires_at: new Date(NOW + 60 * DAY).toISOString(), revoked_at: null },
    ];
    expect(await proStatus(db, USER, undefined, NOW)).toMatchObject({ pro: true, source: "app_store", manage: "app_store", had_purchase: true });
    f.tables.purchases.push({ id: "app_store:9", user_id: USER, source: "app_store", tier: "lifetime", expires_at: null, revoked_at: null });
    expect(await proStatus(db, USER, undefined, NOW)).toMatchObject({ plan: "lifetime", until: null, source: "app_store" });
    expect((await proStatus(db, OTHER, undefined, NOW)).pro).toBe(false);
    // Agent tokens carry no email: the grant is found by the account's.
    const { f: g, db: db2 } = fake();
    g.tables.pro_grants = [{ email: "b@example.com", until: null }];
    g.emails[OTHER] = "B@example.com";
    expect(await proStatus(db2, OTHER, undefined, NOW)).toMatchObject({ pro: true, source: "grant" });
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
