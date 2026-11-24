/**
 * Google Play purchases of Pro (the Android app sells it with Play Billing). The signed-in app posts
 * each purchase token (POST /api/play/purchases { product, token }); the Worker asks Google about it
 * with a service account (Play Developer API: purchases.subscriptionsv2 for the yearly plan,
 * purchases.products for lifetime), stores it in `purchases` as `play:<token>` and acknowledges it
 * (Play refunds purchases left unacknowledged for three days). Renewals and cancellations: an expired
 * Play row is asked about again when the account's Pro is next checked (`freshProStatus`), and the
 * app sends its tokens again at every launch, so no Pub/Sub push is needed.
 */
import { PRO } from "./pro-config.ts";
import { proStatus, savePurchase, type ProStatus, type PurchaseRow } from "./billing.ts";
import type { Db } from "./store.ts";

export interface PlayEnv {
  /** A Google service account with this app's "View financial data" and "Manage orders and subscriptions" in Play Console. */
  PLAY_SA_EMAIL?: string;
  /** Secret: that service account's private key (PEM, `\n` for newlines). */
  PLAY_SA_KEY?: string;
}

export class PlayError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const pkcs8 = (pem: string) => Uint8Array.from(atob(pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));

let cached: { token: string; until: number } | null = null;

async function accessToken(env: PlayEnv): Promise<string> {
  if (!env.PLAY_SA_EMAIL || !env.PLAY_SA_KEY) throw new PlayError("Google Play purchases aren't set up yet", 503);
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: env.PLAY_SA_EMAIL, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.PLAY_SA_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!j.access_token) throw new PlayError(`Google sign-in failed: ${j.error_description ?? res.status}`, 503);
  cached = { token: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function google<T>(env: PlayEnv, method: "GET" | "POST", path: string): Promise<T | null> {
  const res = await fetch(`${API}/${PRO.packageName}/${path}`, { method, headers: { Authorization: `Bearer ${await accessToken(env)}` } });
  if (res.status === 404 || res.status === 410) return null;
  const text = await res.text();
  if (!res.ok) throw new PlayError(`Google Play: ${res.status} ${text.slice(0, 200)}`, res.status === 400 ? 400 : 502);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

interface SubscriptionV2 {
  subscriptionState?: string;
  acknowledgementState?: string;
  testPurchase?: object;
  lineItems?: { productId?: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
}
interface ProductPurchase { purchaseState?: number; acknowledgementState?: number; purchaseType?: number; purchaseTimeMillis?: string; obfuscatedExternalAccountId?: string }

/** What Google says about a purchase, as a purchase row for [userId] (null: Google doesn't know the token). */
export async function verifyPlayPurchase(env: PlayEnv, userId: string, product: unknown, token: unknown, now = Date.now()): Promise<PurchaseRow | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) throw new PlayError("send { product, token } from Play Billing");
  const base = { id: `play:${token}`, user_id: userId, source: "play" as const, signed_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() };
  if (product === PRO.playProducts.annual) {
    const s = await google<SubscriptionV2>(env, "GET", `purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
    if (!s) return null;
    const owner = s.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (owner && owner !== userId) throw new PlayError("this purchase belongs to another account", 409);
    const expiry = s.lineItems?.map((l) => Date.parse(l.expiryTime ?? "")).filter((x) => x > 0).sort((a, b) => b - a)[0];
    // Active, in grace, or cancelled but paid up: Pro until the expiry. On hold, paused, expired: not.
    const live = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(s.subscriptionState ?? "");
    if (s.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" && live) {
      await google(env, "POST", `purchases/subscriptions/${PRO.playProducts.annual}/tokens/${encodeURIComponent(token)}:acknowledge`).catch(() => null);
    }
    return { ...base, product: PRO.playProducts.annual, tier: "annual", environment: s.testPurchase ? "sandbox" : "production", expires_at: new Date(live && expiry ? expiry : now).toISOString(), revoked_at: null };
  }
  if (product === PRO.playProducts.lifetime) {
    const p = await google<ProductPurchase>(env, "GET", `purchases/products/${PRO.playProducts.lifetime}/tokens/${encodeURIComponent(token)}`);
    if (!p) return null;
    if (p.obfuscatedExternalAccountId && p.obfuscatedExternalAccountId !== userId) throw new PlayError("this purchase belongs to another account", 409);
    if (p.purchaseState === 2) throw new PlayError("the purchase is still pending", 409);
    if (p.purchaseState === 0 && p.acknowledgementState === 0) {
      await google(env, "POST", `purchases/products/${PRO.playProducts.lifetime}/tokens/${encodeURIComponent(token)}:acknowledge`).catch(() => null);
    }
    return { ...base, product: PRO.playProducts.lifetime, tier: "lifetime", environment: p.purchaseType === 0 ? "sandbox" : "production", expires_at: null, revoked_at: p.purchaseState === 0 ? null : new Date(now).toISOString() };
  }
  throw new PlayError(`unknown product ${String(product)}`);
}

/** POST /api/play/purchases from the signed-in Android app: { purchases: [{ product, token }] } (or one). */
export async function recordPlayPurchases(env: PlayEnv, db: Db, userId: string, body: unknown) {
  const b = body as { purchases?: unknown; product?: unknown; token?: unknown } | null;
  const list = (Array.isArray(b?.purchases) ? b.purchases : [b]).slice(0, 20) as { product?: unknown; token?: unknown }[];
  let saved = 0;
  const rejected: string[] = [];
  for (const p of list) {
    try {
      const row = await verifyPlayPurchase(env, userId, p?.product, p?.token);
      if (!row) { rejected.push("Google Play doesn't know this purchase"); continue; }
      await savePurchase(db, row);
      saved++;
    } catch (e) {
      if (!(e instanceof PlayError) || e.status >= 500) throw e;
      rejected.push(e.message);
    }
  }
  return { saved, rejected };
}

/**
 * The account's Pro, after asking Google again about Play subscriptions that look expired (renewals
 * arrive here instead of through a push). Asks at most every ten minutes per purchase.
 */
export async function freshProStatus(env: PlayEnv, db: Db, userId: string, email: string | undefined, now = Date.now()): Promise<ProStatus> {
  const status = await proStatus(db, userId, email, now);
  if (status.pro || !env.PLAY_SA_KEY) return status;
  const { data } = await db.from("purchases").select("id, product, tier, expires_at, revoked_at, updated_at").eq("user_id", userId).eq("source", "play");
  const stale = ((data ?? []) as { id: string; product: string; tier: string; revoked_at: string | null; updated_at: string }[])
    .filter((r) => r.tier === "annual" && !r.revoked_at && now - Date.parse(r.updated_at) > 600_000);
  if (!stale.length) return status;
  for (const r of stale) {
    const row = await verifyPlayPurchase(env, userId, r.product, r.id.slice("play:".length), now).catch(() => null);
    if (row) await savePurchase(db, row);
    else await db.from("purchases").update({ updated_at: new Date(now).toISOString() }).eq("id", r.id);
  }
  return proStatus(db, userId, email, now);
}
