/**
 * Pro on every platform. One account, one answer: purchases from any store (`purchases`: the App
 * Store via appstore.ts, Stripe on the web here, Google Play) and Pro given by email (`pro_grants`)
 * combine into `proStatus()`, which GET /api/pro returns and the gate below enforces. Buying on any
 * platform therefore unlocks every platform signed in to the same account.
 *
 * Where it's enforced: the web pages, the glasses (device tokens) and assistants (MCP) are refused
 * without Pro (402 pro_required). The native apps gate on the phone (StoreKit plus this answer), so
 * their requests aren't refused here: builds that predate this file keep working.
 *
 * Stripe is called over its REST API (form-encoded, no SDK). The Stripe account is shared by every
 * HEJI product and its webhooks see every event, so everything created here carries metadata
 * app=<PRO.app>, and the webhook ignores the rest.
 */
import { PRO, type Tier } from "./pro-config.ts";
import { proGrant, type Db } from "./store.ts";

export type { Tier };
export type Source = "app_store" | "stripe" | "play";

export interface BillingEnv {
  PUBLIC_URL: string;
  /** Secret: the HEJI Stripe account's secret key (sk_live_… in production). */
  STRIPE_SECRET_KEY?: string;
  /** Secret: this Worker's webhook endpoint signing secret (whsec_…). */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Price ids: the yearly subscription and the one-time lifetime unlock. */
  STRIPE_PRICE_ANNUAL?: string;
  STRIPE_PRICE_LIFETIME?: string;
}

// ---------------------------------------------------------------- purchases

export interface PurchaseRow {
  id: string;
  user_id: string;
  source: Source;
  product: string;
  tier: Tier;
  environment: string;
  expires_at: string | null;
  revoked_at: string | null;
  signed_at: string;
  updated_at: string;
}

/** Whether a purchase gives Pro right now. */
export const purchaseActive = (r: Pick<PurchaseRow, "tier" | "expires_at" | "revoked_at">, now = Date.now()) =>
  !r.revoked_at && (r.tier === "lifetime" || (!!r.expires_at && Date.parse(r.expires_at) > now));

/**
 * Stores a verified purchase, unless the stored one is newer (store notifications can arrive out of
 * order); a restore from another account still moves the purchase to that account.
 */
export async function savePurchase(db: Db, row: PurchaseRow): Promise<void> {
  const { data: cur } = await db.from("purchases").select("user_id, signed_at").eq("id", row.id).maybeSingle();
  if (cur && Date.parse(cur.signed_at) > Date.parse(row.signed_at)) {
    if (cur.user_id !== row.user_id) await db.from("purchases").update({ user_id: row.user_id, updated_at: row.updated_at }).eq("id", row.id);
    return;
  }
  const { error } = await db.from("purchases").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export interface ProStatus {
  pro: boolean;
  /** Where Pro comes from; null without it. */
  source: Source | "grant" | null;
  plan: Tier | null;
  /** When it renews or ends; null for lifetime (and without Pro). */
  until: string | null;
  /** Where the plan is managed: the App Store, Stripe's portal (the web page) or Google Play. */
  manage: Source | null;
  /** Whether the account ever bought or tried Pro anywhere (no second free week). */
  had_purchase: boolean;
}

const RANK: Record<Tier, number> = { annual: 1, lifetime: 2 };

/** The account's Pro: the best active purchase from any store, or a grant by email. */
export async function proStatus(db: Db, userId: string, email: string | undefined, now = Date.now()): Promise<ProStatus> {
  const { data } = await db.from("purchases").select("source, tier, expires_at, revoked_at").eq("user_id", userId);
  const rows = (data ?? []) as Pick<PurchaseRow, "source" | "tier" | "expires_at" | "revoked_at">[];
  const best = rows
    .filter((r) => purchaseActive(r, now))
    .sort((a, b) => RANK[b.tier] - RANK[a.tier] || Date.parse(b.expires_at ?? "") - Date.parse(a.expires_at ?? ""))[0];
  const had_purchase = rows.length > 0;
  if (best) return { pro: true, source: best.source, plan: best.tier, until: best.tier === "lifetime" ? null : best.expires_at, manage: best.source, had_purchase };
  // Legacy Contempo Stripe subscriptions (contempo.subscriptions before unified billing.ts).
  const { data: legacy } = await db
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (legacy && (legacy.status === "active" || legacy.status === "trialing")) {
    const until = (legacy.current_period_end as string | null) ?? null;
    if (!until || Date.parse(until) > now) {
      return { pro: true, source: "stripe", plan: "annual", until, manage: "stripe", had_purchase: true };
    }
  }
  // Grants are by email; assistant tokens don't carry it, so look it up.
  const grant = await proGrant(db, email ?? (await accountEmail(db, userId)), now);
  if (grant) return { pro: true, source: "grant", plan: grant.until ? "annual" : "lifetime", until: grant.until, manage: null, had_purchase };
  return { pro: false, source: null, plan: null, until: null, manage: null, had_purchase };
}

async function accountEmail(db: Db, userId: string): Promise<string | undefined> {
  const r = await db.auth.admin.getUserById(userId).catch(() => null);
  return r?.data?.user?.email ?? undefined;
}

/** The 402 every refused request gets. */
export const proRequired = (env: BillingEnv) => ({
  error: "pro_required",
  message: `This needs ${PRO.name}. Start a free week in the app, or at ${env.PUBLIC_URL}${PRO.accountPath}`,
  url: `${env.PUBLIC_URL}${PRO.accountPath}`,
});

/**
 * True for a request a web browser made: browsers send Sec-Fetch-Site (and Origin on POST) with every
 * fetch; the native apps send neither, and nor does Node's fetch (which sends only Sec-Fetch-Mode).
 */
export const fromBrowser = (req: Request) => req.headers.has("Sec-Fetch-Site") || req.headers.has("Origin");

// ---------------------------------------------------------------- Stripe

export class StripeError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Flattens nested params into Stripe's bracket form encoding. */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(formEncode(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out.filter(Boolean).join("&");
}

export async function stripe<T = Record<string, unknown>>(env: BillingEnv, method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw new StripeError("payments on the web aren't set up yet", 503);
  const body = params ? formEncode(params) : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2025-09-30.clover" },
    body: method === "POST" ? body : undefined,
  });
  const j = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(j.error?.message ?? `Stripe error ${res.status}`, res.status);
  return j;
}

export interface Offer { plan: Tier; price: string; interval: "year" | null; trial_days: number }

let offerCache: { at: number; key: string; offers: Offer[] } | null = null;

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);

/** The plans on sale on the web, with prices read from Stripe (cached ten minutes per isolate). */
export async function offers(env: BillingEnv): Promise<Offer[]> {
  const ids = [["annual", env.STRIPE_PRICE_ANNUAL], ["lifetime", env.STRIPE_PRICE_LIFETIME]].filter((x): x is [Tier, string] => !!x[1]);
  if (!env.STRIPE_SECRET_KEY || !ids.length) return [];
  const key = ids.map((x) => x[1]).join(",");
  if (offerCache && offerCache.key === key && Date.now() - offerCache.at < 600_000) return offerCache.offers;
  const list = await Promise.all(ids.map(async ([plan, id]) => {
    const p = await stripe<{ unit_amount: number; currency: string; recurring?: { interval: string } | null }>(env, "GET", `prices/${id}`);
    return { plan, price: money(p.unit_amount, p.currency), interval: p.recurring ? "year" as const : null, trial_days: plan === "annual" ? PRO.trialDays : 0 };
  }));
  offerCache = { at: Date.now(), key, offers: list };
  return list;
}

async function ensureCustomer(env: BillingEnv, db: Db, userId: string, email: string | undefined): Promise<string> {
  const { data } = await db.from("billing_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const c = await stripe<{ id: string }>(env, "POST", "customers", { email, metadata: { user_id: userId, app: PRO.app } });
  const { error } = await db.from("billing_customers").insert({ user_id: userId, stripe_customer_id: c.id });
  if (error) throw new Error(error.message);
  return c.id;
}

/** POST /api/billing/checkout { plan }: a Stripe Checkout page for the yearly plan (free week on the first purchase) or lifetime. */
export async function checkout(env: BillingEnv, db: Db, user: { userId: string; email?: string }, plan: unknown): Promise<string> {
  if (plan !== "annual" && plan !== "lifetime") throw new StripeError("plan must be annual or lifetime", 400);
  const price = plan === "annual" ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_LIFETIME;
  if (!price) throw new StripeError(`the ${plan} plan isn't on sale on the web`, 400);
  const status = await proStatus(db, user.userId, user.email);
  if (status.plan === "lifetime") throw new StripeError(`you already have ${PRO.name} for life`, 409);
  if (status.pro && plan === "annual") throw new StripeError(`you already have ${PRO.name}`, 409);
  const customer = await ensureCustomer(env, db, user.userId, user.email);
  const back = `${env.PUBLIC_URL}${PRO.accountPath}`;
  const meta = { user_id: user.userId, plan, app: PRO.app };
  const session = await stripe<{ url: string }>(env, "POST", "checkout/sessions", {
    mode: plan === "annual" ? "subscription" : "payment",
    customer,
    client_reference_id: user.userId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${back}?pro=success`,
    cancel_url: `${back}?pro=cancelled`,
    allow_promotion_codes: true,
    metadata: meta,
    ...(plan === "annual"
      ? { subscription_data: { metadata: meta, ...(status.had_purchase ? {} : { trial_period_days: PRO.trialDays }) } }
      : { payment_intent_data: { metadata: meta } }),
  });
  return session.url;
}

/** POST /api/billing/portal: Stripe's page to change or cancel a web subscription. */
export async function portal(env: BillingEnv, db: Db, user: { userId: string; email?: string }): Promise<string> {
  const customer = await ensureCustomer(env, db, user.userId, user.email);
  const s = await stripe<{ url: string }>(env, "POST", "billing_portal/sessions", { customer, return_url: `${env.PUBLIC_URL}${PRO.accountPath}` });
  return s.url;
}

/** Verifies the `Stripe-Signature` header (v1 HMAC-SHA256 over `${t}.${payload}`, 5-minute tolerance). */
export async function verifyStripeSignature(secret: string, payload: string, header: string | null, now = Date.now(), toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const t = Number(header.split(",").map((p) => p.trim()).find((p) => p.startsWith("t="))?.slice(2));
  const sigs = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === expected.length && [...s].reduce((r, c, i) => r | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

interface StripeEvent { id: string; type: string; created?: number; data: { object: Record<string, unknown> } }

const meta = (o: Record<string, unknown>) => (o.metadata as Record<string, string> | undefined) ?? {};

/** What an event means for a purchase row (pure; unit-tested). Null to ignore. */
export function purchaseFromEvent(e: StripeEvent, userId: string, now = Date.now()): PurchaseRow | null {
  const o = e.data.object;
  const signed = new Date((e.created ?? Math.floor(now / 1000)) * 1000).toISOString();
  const base = { user_id: userId, source: "stripe" as const, environment: o.livemode === false ? "sandbox" : "production", signed_at: signed, updated_at: new Date(now).toISOString() };
  switch (e.type) {
    case "checkout.session.completed": {
      // no_payment_required: a 100%-off promotion code.
      if (o.mode !== "payment" || !(o.payment_status === "paid" || o.payment_status === "no_payment_required")) return null;
      return { ...base, id: `stripe:${String(o.payment_intent ?? o.id)}`, product: "lifetime", tier: "lifetime", expires_at: null, revoked_at: null };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const items = (o.items as { data?: { current_period_end?: number }[] } | undefined)?.data ?? [];
      const periodEnd = Number(o.current_period_end ?? items[0]?.current_period_end ?? 0);
      // past_due: Stripe is retrying the card; keep Pro meanwhile.
      const live = e.type !== "customer.subscription.deleted" && ["active", "trialing", "past_due"].includes(String(o.status));
      return { ...base, id: `stripe:${String(o.id)}`, product: "annual", tier: "annual", expires_at: live && periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date(now).toISOString(), revoked_at: null };
    }
    case "charge.refunded": {
      // A refunded lifetime purchase ends it.
      if (meta(o).plan !== "lifetime" || o.refunded !== true || typeof o.payment_intent !== "string") return null;
      return { ...base, id: `stripe:${o.payment_intent}`, product: "lifetime", tier: "lifetime", expires_at: null, revoked_at: new Date(now).toISOString() };
    }
    default:
      return null;
  }
}

/** POST /stripe/webhook */
export async function handleStripeWebhook(env: BillingEnv, db: Db, req: Request): Promise<Response> {
  const payload = await req.text();
  if (!(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET ?? "", payload, req.headers.get("Stripe-Signature")))) {
    return new Response("invalid signature", { status: 400 });
  }
  const e = JSON.parse(payload) as StripeEvent;
  const o = e.data.object;
  // A charge may not carry its PaymentIntent's metadata; refunds need it to know the plan.
  if (e.type === "charge.refunded" && meta(o).app !== PRO.app && typeof o.payment_intent === "string") {
    const pi = await stripe<{ metadata?: Record<string, string> }>(env, "GET", `payment_intents/${o.payment_intent}`).catch(() => null);
    if (pi?.metadata) e.data.object = { ...o, metadata: { ...pi.metadata, ...meta(o) } };
  }
  if (meta(e.data.object).app !== PRO.app) return Response.json({ ok: true, ignored: `not ${PRO.app}` });
  const { error: dup } = await db.from("billing_events").insert({ id: e.id, type: e.type });
  if (dup?.code === "23505") return Response.json({ ok: true, duplicate: true });
  if (dup) throw new Error(dup.message);
  const obj = e.data.object;
  const customer = typeof obj.customer === "string" ? obj.customer : undefined;
  let userId = meta(obj).user_id || (obj.client_reference_id as string | undefined) || undefined;
  if (!userId && customer) {
    const { data } = await db.from("billing_customers").select("user_id").eq("stripe_customer_id", customer).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) return Response.json({ ok: true, ignored: "no account" });
  const row = purchaseFromEvent(e, userId);
  if (!row) return Response.json({ ok: true, ignored: e.type });
  await db.from("billing_events").update({ user_id: userId }).eq("id", e.id);
  await savePurchase(db, row);
  return Response.json({ ok: true, purchase: row.id });
}
