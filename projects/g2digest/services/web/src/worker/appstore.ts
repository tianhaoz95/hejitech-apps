/**
 * App Store purchases of Pro on iPhone, verified on the Worker without an SDK (the same checks as
 * Waypack's DECISIONS #72): the JWS's x5c chain must end in Apple Root CA - G3 (pinned below by its
 * bytes), each certificate must be signed by the next and carry Apple's marker extension, and the
 * leaf must have signed the JWS. The signed-in app posts its transactions (POST
 * /api/appstore/transactions); App Store Server Notifications V2 (POST /appstore/notifications)
 * report renewals, expiries and refunds. Rows go to `purchases` (billing.ts) as `app_store:<original
 * transaction id>`.
 */
import { PRO } from "./pro-config.ts";
import { savePurchase, type PurchaseRow, type Tier } from "./billing.ts";
import type { Db } from "./store.ts";

/** Apple Root CA - G3 (DER), https://www.apple.com/certificateauthority/AppleRootCA-G3.cer, SHA-256 63343abf…3e9179. */
export const APPLE_ROOT_G3 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64urlDecode = (s: string) => b64(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
const text = (u: Uint8Array) => new TextDecoder().decode(u);

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

// ---------- transactions → purchases ----------

/** The fields of Apple's JWSTransactionDecodedPayload used here. */
export interface AppStoreTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment?: string;
  signedDate?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (ms?: number) => (typeof ms === "number" && ms > 0 ? new Date(ms).toISOString() : null);

/** A verified transaction as a purchase row for [userId] (pure; unit-tested). */
export function appStoreRow(t: AppStoreTransaction, userId: string, now = Date.now()): PurchaseRow {
  if (t.bundleId !== PRO.bundleId) throw new AppStoreError("transaction is for another app");
  const tier: Tier | undefined = PRO.appStoreProducts[t.productId];
  if (!tier) throw new AppStoreError(`unknown product ${t.productId}`);
  return {
    id: `app_store:${t.originalTransactionId}`,
    user_id: userId,
    source: "app_store",
    product: t.productId,
    tier,
    environment: (t.environment ?? "Production").toLowerCase(),
    expires_at: tier === "lifetime" ? null : iso(t.expiresDate),
    revoked_at: iso(t.revocationDate),
    signed_at: iso(t.signedDate) ?? new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

/** POST /api/appstore/transactions from the signed-in app: { transactions: [jws, …] }. */
export async function recordTransactions(db: Db, userId: string, jwsList: unknown, opts: VerifyOptions = {}, now = Date.now()) {
  const list = Array.isArray(jwsList) ? jwsList.slice(0, 50) : [];
  let saved = 0;
  const rejected: string[] = [];
  for (const jws of list) {
    try {
      const t = await verifyAppStoreJws<AppStoreTransaction>(String(jws), opts);
      await savePurchase(db, appStoreRow(t, userId, now));
      saved++;
    } catch (e) {
      if (!(e instanceof AppStoreError)) throw e;
      rejected.push(e.message);
    }
  }
  return { saved, rejected };
}

// ---------- App Store Server Notifications V2 ----------

interface NotificationPayload {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data?: { bundleId?: string; environment?: string; signedTransactionInfo?: string };
  signedDate?: number;
}

/** POST /appstore/notifications: { signedPayload }. Returns the status to answer Apple with and what happened. */
export async function handleNotification(db: Db, body: unknown, opts: VerifyOptions = {}, now = Date.now()): Promise<{ status: number; result: string }> {
  const signed = (body as { signedPayload?: unknown } | null)?.signedPayload;
  let n: NotificationPayload;
  try {
    n = await verifyAppStoreJws<NotificationPayload>(String(signed ?? ""), opts);
  } catch (e) {
    if (e instanceof AppStoreError) return { status: 400, result: e.message };
    throw e;
  }
  if (n.data?.bundleId && n.data.bundleId !== PRO.bundleId) return { status: 200, result: "another app" };
  const eventId = `asn_${n.notificationUUID}`;
  const { error: dup } = await db.from("billing_events").insert({ id: eventId, type: `appstore.${n.notificationType}${n.subtype ? `.${n.subtype}` : ""}` });
  if (dup?.code === "23505") return { status: 200, result: "duplicate" };
  if (dup) throw new Error(dup.message);
  if (!n.data?.signedTransactionInfo) return { status: 200, result: `no transaction (${n.notificationType})` };
  let t: AppStoreTransaction;
  try {
    t = await verifyAppStoreJws<AppStoreTransaction>(n.data.signedTransactionInfo, opts);
  } catch (e) {
    if (e instanceof AppStoreError) return { status: 400, result: e.message };
    throw e;
  }
  const { data: known } = await db.from("purchases").select("user_id").eq("id", `app_store:${t.originalTransactionId}`).maybeSingle();
  const userId = known?.user_id ?? (t.appAccountToken && UUID_RE.test(t.appAccountToken) ? t.appAccountToken.toLowerCase() : undefined);
  if (!userId) return { status: 200, result: "no account for this purchase yet (the app sends it after sign-in)" };
  let row: PurchaseRow;
  try {
    row = appStoreRow(t, userId, now);
  } catch (e) {
    if (e instanceof AppStoreError) return { status: 200, result: e.message };
    throw e;
  }
  await db.from("billing_events").update({ user_id: userId }).eq("id", eventId);
  await savePurchase(db, row);
  return { status: 200, result: n.notificationType };
}
