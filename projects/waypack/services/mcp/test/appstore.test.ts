// App Store JWS verification, purchases and Server Notifications, with a throwaway chain in
// fixtures/appstore-chain.json (not Apple's) made like this (DER base64, keys as PKCS#8):
//   openssl ecparam -name secp384r1 -genkey -noout -out root.key
//   openssl req -x509 -new -key root.key -sha384 -days 36500 -subj "/CN=Test Root" -addext basicConstraints=critical,CA:true -out root.pem
//   intermediate: P-384, CA:true + extension 1.2.840.113635.100.6.2.1=ASN1:NULL, signed by root
//   leaf: P-256 + extension 1.2.840.113635.100.6.11.1=ASN1:NULL, signed by the intermediate; rogue: P-256 without it
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/appstore-chain.json";
import {
  AppStoreError, APPLE_ROOT_G3, handleNotification, parseCert, purchaseActive, purchaseRow, rawSignature, recordTransactions, verifyAppStoreJws,
  type AppStoreTransaction,
} from "../src/lib/appstore.js";
import { planDetails } from "../src/lib/entitlements.js";
import { b64url } from "../src/lib/crypto.js";
import type { Db } from "../src/lib/db.js";

// ---- in-memory PostgREST: just enough for purchases, entitlements and billing_events
type Row = Record<string, unknown>;
const match = (row: Row, q: string) =>
  q.split("&").every((part) => {
    const [k, v] = part.split(/=(.*)/s);
    if (["select", "order", "limit"].includes(k)) return true;
    const val = decodeURIComponent(v ?? "");
    if (val.startsWith("eq.")) return String(row[k]) === val.slice(3);
    if (val === "is.null") return row[k] == null;
    return true;
  });
class FakeDb {
  tables: Record<string, Row[]> = {};
  async select<T>(t: string, q = "") { return (this.tables[t] ?? []).filter((r) => match(r, q)).map((r) => structuredClone(r)) as T[]; }
  async one<T>(t: string, q: string) { return ((await this.select<T>(t, q))[0] ?? null) as T | null; }
  async insert<T>(t: string, row: Row, opts: { upsert?: boolean; onConflict?: string } = {}) {
    const rows = (this.tables[t] ??= []);
    const key = opts.onConflict ?? "id";
    const have = rows.find((r) => r[key] !== undefined && r[key] === row[key]);
    if (have && !opts.upsert) throw Object.assign(new Error("duplicate"), { status: 409 });
    if (have) return [structuredClone(Object.assign(have, row))] as T[];
    rows.push({ ...row });
    return [structuredClone(row)] as T[];
  }
  async update<T>(t: string, q: string, patch: Row) {
    const rows = (this.tables[t] ?? []).filter((r) => match(r, q));
    for (const r of rows) Object.assign(r, structuredClone(patch));
    return rows as T[];
  }
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ROOT = b64(fixture.root);
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = Date.UTC(2027, 0, 15, 12); // after the fixture certificates were issued
const DAY = 86_400_000;

async function jws(payload: object, { chain = [fixture.leaf, fixture.mid, fixture.root], key = fixture.leafKey } = {}) {
  const h = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", x5c: chain })));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const k = await crypto.subtle.importKey("pkcs8", b64(key), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(s)}`;
}

const annual = (o: Partial<AppStoreTransaction> = {}): AppStoreTransaction => ({
  transactionId: "2000000001", originalTransactionId: "2000000001", bundleId: "com.hejitech.waypack",
  productId: "com.hejitech.waypack.pro.annual", purchaseDate: NOW, expiresDate: NOW + 7 * DAY,
  appAccountToken: USER, environment: "Sandbox", signedDate: NOW, ...o,
});

describe("App Store JWS", () => {
  it("parses Apple's real root certificate", () => {
    const c = parseCert(b64(APPLE_ROOT_G3));
    expect(c.curve).toBe("P-384");
    expect(new Date(c.notAfter).getUTCFullYear()).toBe(2039);
  });

  it("verifies a JWS whose chain ends in the pinned root", async () => {
    expect(await verifyAppStoreJws(await jws(annual()), { root: ROOT })).toMatchObject({ productId: "com.hejitech.waypack.pro.annual" });
  });

  it("rejects the same JWS against Apple's root, a tampered payload, a rogue leaf and a bad header", async () => {
    const good = await jws(annual());
    await expect(verifyAppStoreJws(good)).rejects.toThrow("not signed by Apple");
    const [h, , s] = good.split(".");
    const forged = `${h}.${b64url(new TextEncoder().encode(JSON.stringify(annual({ expiresDate: NOW + 3650 * DAY }))))}.${s}`;
    await expect(verifyAppStoreJws(forged, { root: ROOT })).rejects.toThrow("bad JWS signature");
    const rogue = await jws(annual(), { chain: [fixture.rogue, fixture.mid, fixture.root], key: fixture.rogueKey });
    await expect(verifyAppStoreJws(rogue, { root: ROOT })).rejects.toThrow("not an App Store certificate");
    // leaf signed by itself instead of the intermediate: swap the order
    const swapped = await jws(annual(), { chain: [fixture.leaf, fixture.leaf, fixture.root] });
    await expect(verifyAppStoreJws(swapped, { root: ROOT })).rejects.toThrow(AppStoreError);
    await expect(verifyAppStoreJws("a.b", { root: ROOT })).rejects.toThrow("not a JWS");
  });

  it("checks certificate validity at the signing date", async () => {
    await expect(verifyAppStoreJws(await jws(annual({ signedDate: Date.UTC(1990, 0, 1) })), { root: ROOT })).rejects.toThrow("not valid");
  });

  it("converts DER ECDSA signatures to raw r‖s, keeping leading zeros", () => {
    // SEQUENCE { INTEGER 0x00ff (padded), INTEGER 0x01 }
    const der = new Uint8Array([0x30, 0x07, 0x02, 0x02, 0x00, 0xff, 0x02, 0x01, 0x01]);
    const raw = rawSignature(der, 4);
    expect([...raw]).toEqual([0, 0, 0, 0xff, 0, 0, 0, 1]);
  });
});

describe("purchases", () => {
  it("maps products to tiers and refuses other apps and unknown products", () => {
    expect(purchaseRow(annual(), USER, NOW)).toMatchObject({ tier: "annual", user_id: USER, environment: "Sandbox", revoked_at: null });
    expect(purchaseRow(annual({ productId: "com.hejitech.waypack.pro.lifetime", expiresDate: undefined }), USER, NOW).tier).toBe("lifetime");
    expect(() => purchaseRow(annual({ bundleId: "com.hejitech.headway" }), USER)).toThrow("another app");
    expect(() => purchaseRow(annual({ productId: "x" }), USER)).toThrow("unknown product");
  });

  it("is active until it expires or is refunded; lifetime never expires", () => {
    const r = purchaseRow(annual(), USER, NOW);
    expect(purchaseActive(r, NOW)).toBe(true);
    expect(purchaseActive(r, NOW + 8 * DAY)).toBe(false);
    expect(purchaseActive({ ...r, revoked_at: new Date(NOW).toISOString() }, NOW)).toBe(false);
    expect(purchaseActive({ tier: "lifetime", expires_at: null, revoked_at: null }, NOW + 9999 * DAY)).toBe(true);
  });

  it("an app-posted transaction makes the user Pro, and a restore moves it to the new account", async () => {
    const db = new FakeDb();
    const dbx = db as unknown as Db;
    const r = await recordTransactions(dbx, USER, [await jws(annual()), "garbage"], { root: ROOT }, NOW);
    expect(r.saved).toHaveLength(1);
    expect(r.rejected).toEqual(["not a JWS"]);
    expect(await planDetails(dbx, USER, new Date(NOW))).toMatchObject({ plan: { tier: "annual", offlineMaps: true }, source: "app_store" });
    await recordTransactions(dbx, OTHER, [await jws(annual())], { root: ROOT }, NOW + 1000);
    expect((await planDetails(dbx, USER, new Date(NOW))).plan.tier).toBe("free");
    expect((await planDetails(dbx, OTHER, new Date(NOW))).plan.tier).toBe("annual");
  });

  it("keeps the newer state when transactions arrive out of order", async () => {
    const db = new FakeDb();
    const dbx = db as unknown as Db;
    await recordTransactions(dbx, USER, [await jws(annual({ transactionId: "2", expiresDate: NOW + 372 * DAY, signedDate: NOW + DAY }))], { root: ROOT }, NOW);
    await recordTransactions(dbx, USER, [await jws(annual())], { root: ROOT }, NOW);
    expect(db.tables.app_store_purchases[0]).toMatchObject({ transaction_id: "2" });
  });

  it("lifetime from either source beats annual; Stripe annual still counts alongside", async () => {
    const db = new FakeDb();
    const dbx = db as unknown as Db;
    db.tables.entitlements = [{ user_id: USER, tier: "annual", active: true, expires_at: new Date(NOW + 30 * DAY).toISOString(), source: "stripe" }];
    expect(await planDetails(dbx, USER, new Date(NOW))).toMatchObject({ source: "stripe" });
    await recordTransactions(dbx, USER, [await jws(annual({ productId: "com.hejitech.waypack.pro.lifetime", expiresDate: undefined }))], { root: ROOT }, NOW);
    expect(await planDetails(dbx, USER, new Date(NOW))).toMatchObject({ plan: { tier: "lifetime" }, source: "app_store", expires_at: null });
  });
});

describe("App Store Server Notifications", () => {
  const note = async (type: string, t: AppStoreTransaction, uuid = crypto.randomUUID()) => ({
    signedPayload: await jws({ notificationType: type, notificationUUID: uuid, data: { bundleId: "com.hejitech.waypack", environment: "Sandbox", signedTransactionInfo: await jws(t) }, signedDate: t.signedDate }),
  });

  it("a renewal extends the plan, a refund ends it, and duplicates are ignored", async () => {
    const db = new FakeDb();
    const dbx = db as unknown as Db;
    const first = await handleNotification(dbx, await note("SUBSCRIBED", annual()), { root: ROOT }, NOW);
    expect(first).toMatchObject({ status: 200, userId: USER, becamePro: true });
    const renew = annual({ transactionId: "3", expiresDate: NOW + 372 * DAY, signedDate: NOW + 7 * DAY });
    const body = await note("DID_RENEW", renew, "fixed-uuid");
    await handleNotification(dbx, body, { root: ROOT }, NOW + 7 * DAY);
    expect(await handleNotification(dbx, body, { root: ROOT }, NOW + 7 * DAY)).toMatchObject({ result: "duplicate" });
    expect((await planDetails(dbx, USER, new Date(NOW + 30 * DAY))).plan.tier).toBe("annual");
    await handleNotification(dbx, await note("REFUND", { ...renew, revocationDate: NOW + 8 * DAY, signedDate: NOW + 8 * DAY }), { root: ROOT }, NOW + 8 * DAY);
    expect((await planDetails(dbx, USER, new Date(NOW + 9 * DAY))).plan.tier).toBe("free");
  });

  it("rejects unsigned payloads and ignores purchases it can't tie to a user", async () => {
    const db = new FakeDb();
    const dbx = db as unknown as Db;
    expect((await handleNotification(dbx, { signedPayload: "x.y.z" }, { root: ROOT })).status).toBe(400);
    expect(await handleNotification(dbx, await note("SUBSCRIBED", annual({ appAccountToken: undefined })), { root: ROOT }, NOW)).toMatchObject({ status: 200, result: "no Waypack user for this purchase yet" });
  });
});

describe("Pro given by email (pro_grants)", () => {
  it("a grant without an end date is lifetime; with one, Pro until then; matched case-insensitively", async () => {
    const db = new FakeDb() as FakeDb & { authEmail: (id: string) => Promise<string> };
    db.authEmail = async () => "Tester@Example.com";
    const dbx = db as unknown as Db;
    expect((await planDetails(dbx, USER, new Date(NOW))).plan.tier).toBe("free");
    db.tables.pro_grants = [{ email: "tester@example.com", until: null }];
    expect(await planDetails(dbx, USER, new Date(NOW))).toMatchObject({ plan: { tier: "lifetime" }, source: "grant", expires_at: null });
    db.tables.pro_grants = [{ email: "tester@example.com", until: new Date(NOW + 30 * DAY).toISOString() }];
    expect(await planDetails(dbx, USER, new Date(NOW))).toMatchObject({ plan: { tier: "annual", offlineMaps: true }, source: "grant" });
    expect((await planDetails(dbx, USER, new Date(NOW + 31 * DAY))).plan.tier).toBe("free");
    // the caller's email, when known, saves the lookup
    expect((await planDetails(dbx, OTHER, new Date(NOW), { email: "nobody@example.com" })).plan.tier).toBe("free");
  });
});
