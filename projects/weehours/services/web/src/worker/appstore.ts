/**
 * App Store purchases of Wee Hours Pro (docs/decisions.md "Wee Hours Pro"). The iPhone app buys with
 * StoreKit 2 (the signed-in user's id as appAccountToken) and posts each signed transaction (JWS) to
 * POST /api/appstore/transactions; App Store Server Notifications V2 (renewals, expiries, refunds)
 * arrive at POST /appstore/notifications. Both are verified here without an SDK: the x5c chain must
 * end in Apple Root CA - G3 (pinned below by its bytes), each certificate must be signed by the next
 * and carry Apple's marker extension, and the leaf must have signed the JWS. A purchase belongs to the
 * buyer's household, and the household's entitlement (weehours.entitlements) is the best active
 * purchase, so one purchase covers both parents. Same approach as the other HEJI apps, own copy.
 */
const text = (u: Uint8Array) => new TextDecoder().decode(u);
function b64urlDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export const BUNDLE_ID = "com.hejitech.weehours";
export type Plan = "monthly" | "yearly" | "lifetime";
export const PRODUCTS: Record<string, Plan> = {
  "com.hejitech.weehours.pro.monthly": "monthly",
  "com.hejitech.weehours.pro.yearly": "yearly",
  "com.hejitech.weehours.pro.lifetime": "lifetime",
};

/** Apple Root CA - G3 (DER), https://www.apple.com/certificateauthority/AppleRootCA-G3.cer, SHA-256 63343abf…3e9179. */
export const APPLE_ROOT_G3 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export class AppStoreError extends Error {}

// ---------- just enough DER to check a certificate chain ----------

interface Tlv { tag: number; start: number; end: number; headerStart: number }

function tlv(b: Uint8Array, at: number): Tlv {
  const tag = b[at];
  let len = b[at + 1];
  let p = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new AppStoreError("bad DER length");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p++];
  }
  if (p + len > b.length) throw new AppStoreError("truncated DER");
  return { tag, start: p, end: p + len, headerStart: at };
}

function children(b: Uint8Array, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = parent.start; p < parent.end; ) {
    const t = tlv(b, p);
    out.push(t);
    p = t.end;
  }
  return out;
}

const has = (hay: Uint8Array, needle: number[]) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

const OID_P256 = [0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07];
const OID_P384 = [0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x22];
const OID_ECDSA_SHA256 = [0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02];
const OID_ECDSA_SHA384 = [0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x03];
/** 1.2.840.113635.100.6.11.1: Apple's receipt-signing leaf. 1.2.840.113635.100.6.2.1: Apple WWDR intermediate. */
export const OID_APPLE_LEAF = [0x06, 0x0a, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x0b, 0x01];
export const OID_APPLE_INTERMEDIATE = [0x06, 0x0a, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x02, 0x01];

export interface Cert {
  der: Uint8Array;
  tbs: Uint8Array;
  sigHash: "SHA-256" | "SHA-384";
  signature: Uint8Array; // DER ECDSA-Sig-Value
  spki: Uint8Array;
  curve: "P-256" | "P-384";
  notBefore: number;
  notAfter: number;
}

function derTime(b: Uint8Array, t: Tlv): number {
  const s = text(b.subarray(t.start, t.end));
  const full = t.tag === 0x17 ? (Number(s.slice(0, 2)) >= 50 ? "19" : "20") + s : s; // UTCTime : GeneralizedTime
  return Date.UTC(+full.slice(0, 4), +full.slice(4, 6) - 1, +full.slice(6, 8), +full.slice(8, 10), +full.slice(10, 12), +full.slice(12, 14));
}

export function parseCert(der: Uint8Array): Cert {
  const top = tlv(der, 0);
  const [tbsT, algT, sigT] = children(der, top);
  if (!tbsT || !algT || !sigT || sigT.tag !== 0x03) throw new AppStoreError("not a certificate");
  const alg = der.subarray(algT.headerStart, algT.end);
  const sigHash = has(alg, OID_ECDSA_SHA256) ? "SHA-256" : has(alg, OID_ECDSA_SHA384) ? "SHA-384" : null;
  if (!sigHash) throw new AppStoreError("unsupported certificate signature");
  const f = children(der, tbsT);
  const i = f[0]?.tag === 0xa0 ? 1 : 0; // optional [0] version
  const validity = children(der, f[i + 3]);
  const spkiT = f[i + 5];
  const spki = der.subarray(spkiT.headerStart, spkiT.end);
  const curve = has(spki, OID_P256) ? "P-256" : has(spki, OID_P384) ? "P-384" : null;
  if (!curve) throw new AppStoreError("unsupported certificate key");
  return {
    der,
    tbs: der.subarray(tbsT.headerStart, tbsT.end),
    sigHash,
    signature: der.subarray(sigT.start + 1, sigT.end), // skip the unused-bits byte
    spki,
    curve,
    notBefore: derTime(der, validity[0]),
    notAfter: derTime(der, validity[1]),
  };
}

/** DER ECDSA-Sig-Value → the raw r‖s WebCrypto wants. */
export function rawSignature(der: Uint8Array, size: number): Uint8Array {
  const seq = tlv(der, 0);
  const [r, s] = children(der, seq);
  const out = new Uint8Array(size * 2);
  for (const [k, part] of [r, s].entries()) {
    let v = der.subarray(part.start, part.end);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) throw new AppStoreError("bad ECDSA signature");
    out.set(v, k * size + (size - v.length));
  }
  return out;
}

const keyOf = (c: Cert) => crypto.subtle.importKey("spki", c.spki, { name: "ECDSA", namedCurve: c.curve }, false, ["verify"]);

async function signedBy(child: Cert, issuer: Cert): Promise<boolean> {
  const size = issuer.curve === "P-256" ? 32 : 48;
  return crypto.subtle.verify({ name: "ECDSA", hash: child.sigHash }, await keyOf(issuer), rawSignature(child.signature, size), child.tbs);
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

export interface VerifyOptions {
  /** DER of the trusted root; tests pass their own. */
  root?: Uint8Array;
  /** When to check certificate validity; defaults to the payload's signedDate (as Apple's library does offline). */
  at?: number;
}

/** Verifies an App Store JWS and returns its payload; throws AppStoreError when anything doesn't check out. */
export async function verifyAppStoreJws<T = Record<string, unknown>>(jws: string, opts: VerifyOptions = {}): Promise<T> {
  const parts = typeof jws === "string" ? jws.split(".") : [];
  if (parts.length !== 3) throw new AppStoreError("not a JWS");
  const [h, p, s] = parts;
  let header: { alg?: string; x5c?: string[] };
  let payload: T & { signedDate?: number };
  try {
    header = JSON.parse(text(b64urlDecode(h)));
    payload = JSON.parse(text(b64urlDecode(p)));
  } catch {
    throw new AppStoreError("unreadable JWS");
  }
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw new AppStoreError("unexpected JWS header");
  const [leaf, mid, root] = header.x5c.map((c) => parseCert(b64(c)));
  if (!sameBytes(root.der, opts.root ?? b64(APPLE_ROOT_G3))) throw new AppStoreError("not signed by Apple");
  if (!has(leaf.tbs, OID_APPLE_LEAF) || !has(mid.tbs, OID_APPLE_INTERMEDIATE)) throw new AppStoreError("not an App Store certificate");
  const at = opts.at ?? (typeof payload.signedDate === "number" ? payload.signedDate : Date.now());
  for (const c of [leaf, mid, root]) if (at < c.notBefore || at > c.notAfter) throw new AppStoreError("certificate not valid at signing time");
  if (!(await signedBy(mid, root)) || !(await signedBy(leaf, mid))) throw new AppStoreError("broken certificate chain");
  if (leaf.curve !== "P-256") throw new AppStoreError("unexpected leaf key");
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await keyOf(leaf), b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new AppStoreError("bad JWS signature");
  return payload;
}

// ---------- transactions → household entitlement ----------

/** The fields of Apple's JWSTransactionDecodedPayload that Wee Hours uses. */
export interface AppStoreTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment?: string;
  signedDate?: number;
}

export interface PurchaseRow {
  original_transaction_id: string;
  household_id: string;
  user_id: string;
  product_id: string;
  plan: Plan;
  environment: string;
  transaction_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  signed_at: string;
  updated_at: string;
}

const iso = (ms?: number) => (typeof ms === "number" && ms > 0 ? new Date(ms).toISOString() : null);

/** A verified transaction as a purchase row (pure; unit-tested). */
export function purchaseRow(t: AppStoreTransaction, householdId: string, userId: string, now = Date.now()): PurchaseRow {
  if (t.bundleId !== BUNDLE_ID) throw new AppStoreError("transaction is for another app");
  const plan = PRODUCTS[t.productId];
  if (!plan) throw new AppStoreError(`unknown product ${t.productId}`);
  return {
    original_transaction_id: String(t.originalTransactionId), household_id: householdId, user_id: userId,
    product_id: t.productId, plan, environment: t.environment ?? "Production", transaction_id: String(t.transactionId),
    expires_at: plan === "lifetime" ? null : iso(t.expiresDate), revoked_at: iso(t.revocationDate),
    signed_at: iso(t.signedDate) ?? new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
  };
}

export const purchaseActive = (r: Pick<PurchaseRow, "plan" | "expires_at" | "revoked_at">, now = Date.now()) =>
  !r.revoked_at && (r.plan === "lifetime" || (!!r.expires_at && Date.parse(r.expires_at) > now));

const RANK: Record<Plan, number> = { monthly: 1, yearly: 2, lifetime: 3 };

/** The household's entitlement from its purchases: the best active one (lifetime > yearly > monthly, later expiry). */
export function bestPlan(rows: Pick<PurchaseRow, "plan" | "expires_at" | "revoked_at">[], now = Date.now()): { plan: Plan | null; expires_at: string | null } {
  const live = rows.filter((r) => purchaseActive(r, now)).sort((a, b) => RANK[b.plan] - RANK[a.plan] || Date.parse(b.expires_at ?? "") - Date.parse(a.expires_at ?? ""));
  return live[0] ? { plan: live[0].plan, expires_at: live[0].plan === "lifetime" ? null : live[0].expires_at } : { plan: null, expires_at: null };
}

/** What the Worker needs from the database (supabase-js in production, a fake in tests). */
export interface Store {
  householdOf(userId: string): Promise<string | null>;
  purchase(otid: string): Promise<PurchaseRow | null>;
  savePurchase(row: PurchaseRow): Promise<void>;
  householdPurchases(householdId: string): Promise<PurchaseRow[]>;
  setEntitlement(householdId: string, e: { plan: Plan | null; expires_at: string | null }): Promise<void>;
  recordNotification(uuid: string, type: string): Promise<boolean>;
}

async function store(s: Store, row: PurchaseRow, now: number) {
  const cur = await s.purchase(row.original_transaction_id);
  // Notifications can arrive out of order: keep the newer state, but a restore can move the purchase.
  const keep = cur && Date.parse(cur.signed_at) > Date.parse(row.signed_at) ? { ...cur, household_id: row.household_id, user_id: row.user_id } : row;
  await s.savePurchase(keep);
  for (const h of new Set([row.household_id, cur?.household_id].filter(Boolean) as string[])) {
    await s.setEntitlement(h, bestPlan(await s.householdPurchases(h), now));
  }
  return keep;
}

/** POST /api/appstore/transactions: { transactions: [jws, …] } from the signed-in app. */
export async function recordTransactions(s: Store, userId: string, list: unknown, opts: VerifyOptions = {}, now = Date.now()) {
  const household = await s.householdOf(userId);
  if (!household) throw new AppStoreError("no household for this account");
  const saved: PurchaseRow[] = [], rejected: string[] = [];
  for (const jws of Array.isArray(list) ? list.slice(0, 50) : []) {
    try {
      const t = await verifyAppStoreJws<AppStoreTransaction>(String(jws), opts);
      saved.push(await store(s, purchaseRow(t, household, userId, now), now));
    } catch (e) {
      if (!(e instanceof AppStoreError)) throw e;
      rejected.push(e.message);
    }
  }
  return { saved, rejected, entitlement: bestPlan(await s.householdPurchases(household), now) };
}

interface NotificationPayload { notificationType: string; subtype?: string; notificationUUID: string; data?: { bundleId?: string; signedTransactionInfo?: string } }

/** POST /appstore/notifications: { signedPayload }. */
export async function handleNotification(s: Store, body: unknown, opts: VerifyOptions = {}, now = Date.now()): Promise<{ status: number; result: string }> {
  let n: NotificationPayload;
  try {
    n = await verifyAppStoreJws<NotificationPayload>(String((body as { signedPayload?: unknown } | null)?.signedPayload ?? ""), opts);
  } catch (e) {
    if (e instanceof AppStoreError) return { status: 400, result: e.message };
    throw e;
  }
  if (n.data?.bundleId && n.data.bundleId !== BUNDLE_ID) return { status: 200, result: "another app" };
  if (!(await s.recordNotification(n.notificationUUID, n.notificationType))) return { status: 200, result: "duplicate" };
  if (!n.data?.signedTransactionInfo) return { status: 200, result: `no transaction (${n.notificationType})` };
  let t: AppStoreTransaction;
  try {
    t = await verifyAppStoreJws<AppStoreTransaction>(n.data.signedTransactionInfo, opts);
  } catch (e) {
    if (e instanceof AppStoreError) return { status: 400, result: e.message };
    throw e;
  }
  const known = await s.purchase(String(t.originalTransactionId));
  const userId = known?.user_id ?? (t.appAccountToken && /^[0-9a-f-]{36}$/i.test(t.appAccountToken) ? t.appAccountToken.toLowerCase() : undefined);
  const household = known?.household_id ?? (userId ? await s.householdOf(userId) : null);
  if (!userId || !household) return { status: 200, result: "no Wee Hours household for this purchase yet" };
  try {
    await store(s, purchaseRow(t, household, userId, now), now);
  } catch (e) {
    if (e instanceof AppStoreError) return { status: 200, result: e.message };
    throw e;
  }
  return { status: 200, result: n.notificationType };
}
