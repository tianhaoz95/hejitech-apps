// Wee Hours Pro purchases (src/worker/appstore.ts): JWS verification against a throwaway chain in
// fixtures/appstore-chain.json (openssl, not Apple's: root P-384 → intermediate with
// 1.2.840.113635.100.6.2.1 → leaf P-256 with 1.2.840.113635.100.6.11.1; rogue lacks the marker),
// household entitlements and App Store Server Notifications.
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/appstore-chain.json";
import { bestPlan, handleNotification, recordTransactions, verifyAppStoreJws, type AppStoreTransaction, type PurchaseRow, type Store } from "../src/worker/appstore.ts";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ROOT = b64(fixture.root);
const NOW = Date.UTC(2027, 0, 15, 12); // after the fixture certificates were issued
const DAY = 86_400_000;
const MOM = "11111111-1111-4111-8111-111111111111", DAD = "22222222-2222-4222-8222-222222222222", OTHER = "33333333-3333-4333-8333-333333333333";

async function jws(payload: object, { chain = [fixture.leaf, fixture.mid, fixture.root], key = fixture.leafKey } = {}) {
  const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const h = enc({ alg: "ES256", x5c: chain }), p = enc(payload);
  const k = await crypto.subtle.importKey("pkcs8", b64(key), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return `${h}.${p}.${b64url(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, new TextEncoder().encode(`${h}.${p}`))))}`;
}
const tx = (o: Partial<AppStoreTransaction> = {}): AppStoreTransaction => ({
  transactionId: "1", originalTransactionId: "1", bundleId: "com.hejitech.weehours", productId: "com.hejitech.weehours.pro.yearly",
  expiresDate: NOW + 365 * DAY, appAccountToken: MOM, environment: "Sandbox", signedDate: NOW, ...o,
});

function fakeStore() {
  const members: Record<string, string> = { [MOM]: "home", [DAD]: "home", [OTHER]: "other" };
  const purchases = new Map<string, PurchaseRow>();
  const entitlements: Record<string, { plan: string | null; expires_at: string | null }> = {};
  const notes = new Set<string>();
  const s: Store = {
    householdOf: async (u) => members[u] ?? null,
    purchase: async (id) => purchases.get(id) ?? null,
    savePurchase: async (r) => { purchases.set(r.original_transaction_id, { ...r }); },
    householdPurchases: async (h) => [...purchases.values()].filter((p) => p.household_id === h),
    setEntitlement: async (h, e) => { entitlements[h] = e; },
    recordNotification: async (id) => (notes.has(id) ? false : (notes.add(id), true)),
  };
  return { s, entitlements, purchases };
}

describe("Wee Hours App Store purchases", () => {
  it("accepts only a JWS whose chain ends in the pinned root", async () => {
    expect(await verifyAppStoreJws(await jws(tx()), { root: ROOT })).toMatchObject({ productId: "com.hejitech.weehours.pro.yearly" });
    await expect(verifyAppStoreJws(await jws(tx()))).rejects.toThrow("not signed by Apple");
    await expect(verifyAppStoreJws(await jws(tx(), { chain: [fixture.rogue, fixture.mid, fixture.root], key: fixture.rogueKey }), { root: ROOT })).rejects.toThrow("not an App Store certificate");
  });

  it("one parent's purchase gives the whole household Pro", async () => {
    const { s, entitlements } = fakeStore();
    const r = await recordTransactions(s, MOM, [await jws(tx())], { root: ROOT }, NOW);
    expect(r.rejected).toEqual([]);
    expect(entitlements.home).toEqual({ plan: "yearly", expires_at: new Date(NOW + 365 * DAY).toISOString() });
    // Dad is in the same household: the same row covers him.
    expect((await recordTransactions(s, DAD, [], { root: ROOT }, NOW)).entitlement.plan).toBe("yearly");
  });

  it("lifetime beats yearly; a refund ends it; a restore into another household moves it", async () => {
    const { s, entitlements } = fakeStore();
    await recordTransactions(s, MOM, [await jws(tx()), await jws(tx({ originalTransactionId: "2", transactionId: "2", productId: "com.hejitech.weehours.pro.lifetime", expiresDate: undefined }))], { root: ROOT }, NOW);
    expect(entitlements.home.plan).toBe("lifetime");
    const note = (t: AppStoreTransaction, uuid: string) => jws({ notificationType: "REFUND", notificationUUID: uuid, data: { bundleId: "com.hejitech.weehours", signedTransactionInfo: "" } }).then(async () => ({ signedPayload: await jws({ notificationType: "REFUND", notificationUUID: uuid, data: { bundleId: "com.hejitech.weehours", signedTransactionInfo: await jws(t) } }) }));
    const refund = tx({ originalTransactionId: "2", transactionId: "2", productId: "com.hejitech.weehours.pro.lifetime", expiresDate: undefined, revocationDate: NOW + DAY, signedDate: NOW + DAY });
    expect((await handleNotification(s, await note(refund, "n1"), { root: ROOT }, NOW + DAY)).status).toBe(200);
    expect(entitlements.home.plan).toBe("yearly");
    expect((await handleNotification(s, await note(refund, "n1"), { root: ROOT }, NOW + DAY)).result).toBe("duplicate");
    await recordTransactions(s, OTHER, [await jws(tx({ signedDate: NOW + 2 * DAY }))], { root: ROOT }, NOW + 2 * DAY);
    expect(entitlements.other.plan).toBe("yearly");
    expect(entitlements.home).toEqual({ plan: null, expires_at: null });
  });

  it("bestPlan prefers lifetime, then the later expiry, and ignores expired and revoked", () => {
    const y = (d: number) => ({ plan: "yearly" as const, expires_at: new Date(NOW + d * DAY).toISOString(), revoked_at: null });
    expect(bestPlan([y(-1)], NOW).plan).toBeNull();
    expect(bestPlan([y(10), y(300)], NOW).expires_at).toBe(new Date(NOW + 300 * DAY).toISOString());
    expect(bestPlan([y(10), { plan: "monthly", expires_at: new Date(NOW + 400 * DAY).toISOString(), revoked_at: null }], NOW).plan).toBe("yearly");
    expect(bestPlan([{ plan: "lifetime", expires_at: null, revoked_at: new Date(NOW).toISOString() }], NOW).plan).toBeNull();
  });

  it("refuses a household-less account and other apps' transactions", async () => {
    const { s } = fakeStore();
    await expect(recordTransactions(s, "44444444-4444-4444-8444-444444444444", [], { root: ROOT }, NOW)).rejects.toThrow("no household");
    const r = await recordTransactions(s, MOM, [await jws(tx({ bundleId: "com.hejitech.headway" }))], { root: ROOT }, NOW);
    expect(r.rejected).toEqual(["transaction is for another app"]);
  });
});
