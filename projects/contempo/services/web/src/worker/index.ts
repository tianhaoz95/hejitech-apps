/**
 * Contempo's Cloudflare Worker: serves the web app (/), the admin site (/admin/) and the login-free
 * feedback form (/feedback/) from static assets, and the API that replaced the Firebase Cloud
 * Functions (projects/contempo/backend/ before 2026-10-16):
 *
 *   POST /api/flag-risk          contemporaneity/vagueness heuristics, no LLM (was flagRisk)
 *   POST /api/account/delete     wipe the user's Contempo files and rows (the shared login stays)
 *   POST /api/watch/pair         one-time code that signs a watch in as the phone's user (was mintWatchAuthToken)
 *   POST /api/billing/checkout   Stripe Checkout (was createCheckoutSession)
 *   POST /api/billing/portal     Stripe customer portal (was createPortalLink)
 *   POST /api/admin/coupons/*    coupon management for the admin site (was adminListCoupons, …)
 *   POST /api/stripe/webhook     subscription sync into contempo.subscriptions (was stripeWebhook)
 *   POST /api/feedback           the login-free feedback form, forwarded to FeedbackKit
 *   POST /api/review-sign-in     App Review's demo account: reset to demo data + a session (review.ts)
 *
 * Every /api call except the webhook, /api/feedback and /api/review-sign-in needs `Authorization: Bearer <Supabase access token>`.
 * Data lives in the shared Supabase project, schema `contempo` (projects/contempo/backend.env);
 * clients read and write their own rows directly (RLS), the Worker only does what needs the
 * service role or a secret.
 *
 * No AI runs here: Contempo's parsing and chat are on-device only (product decision 2026-10-16).
 */
import { createClient, type User } from "@supabase/supabase-js";
import { reviewSignIn } from "./review.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any, "contempo">>;

export interface Env {
  ASSETS: Fetcher;
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Secrets for the App Review demo account (review.ts): its email and SHA-256 of its password. */
  REVIEW_EMAIL?: string;
  REVIEW_PASSWORD_SHA256?: string;
}

const BUCKET = "contempo";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url.pathname.slice("/api/".length));
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        console.error("api error", url.pathname, err);
        return json({ error: "Something went wrong." }, 500);
      }
    }
    // The admin site is its own single-page app under /admin/: deep links get its index.html.
    if (url.pathname === "/admin") return Response.redirect(`${url.origin}/admin/`, 301);
    if (url.pathname.startsWith("/admin/") && !/\.[a-z0-9]+$/i.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(`${url.origin}/admin/`, request));
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function api(request: Request, env: Env, route: string): Promise<Response> {
  if (request.method !== "POST") throw new HttpError(405, "POST only.");
  if (route === "stripe/webhook") return stripeWebhook(request, env);
  if (route === "feedback") return publicFeedback(request);
  if (route === "review-sign-in") {
    const admin = serviceClient(env);
    const r = await reviewSignIn(env, request, (userId) => resetReviewAccount(admin, userId));
    return json(r.body, r.status);
  }

  const user = await authenticate(request, env);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = serviceClient(env);

  switch (route) {
    case "flag-risk":
      return json(flagRisk(body));
    case "account/delete":
      await deleteAccount(admin, user);
      return json({ success: true });
    case "watch/pair":
      return json(await watchPairingCode(admin, user));
    case "billing/checkout":
      return json(await checkout(env, admin, user, body));
    case "billing/portal":
      return json(await portal(env, admin, user, body));
    default:
      if (route.startsWith("admin/coupons/")) {
        await assertAdmin(admin, user);
        return json(await couponAdmin(env, route.slice("admin/coupons/".length), body));
      }
      throw new HttpError(404, `No such API: ${route}`);
  }
}

// ------------------------------------------------------------------------------------- auth

async function authenticate(request: Request, env: Env): Promise<User> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) throw new HttpError(401, "Sign in first.");
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session expired: sign in again.");
  return data.user;
}

function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "contempo" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(admin: SupabaseClient, user: User): Promise<void> {
  const { data } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new HttpError(403, "Admin access required.");
}

// --------------------------------------------------------------------------------- risk flags

const BACKFILL_THRESHOLD_DAYS = 14;
const VAGUE_TASK_MIN_LENGTH = 12;
const VAGUE_TASK_PATTERNS = [/^worked on (the )?(house|property|rental)$/i, /^general (maintenance|cleaning|upkeep)$/i, /^(misc|stuff|things)$/i];

/** Same heuristics as the old flagRiskFlow: no LLM call. */
export function flagRisk(body: Record<string, unknown>) {
  const task = String(body.task ?? "");
  const durationMinutes = Number(body.durationMinutes ?? 0);
  const activityDate = new Date(String(body.activityDateIso ?? ""));
  const loggedAt = new Date(String(body.loggedAtIso ?? ""));
  if (Number.isNaN(activityDate.getTime()) || Number.isNaN(loggedAt.getTime())) throw new HttpError(400, "activityDateIso and loggedAtIso must be ISO dates.");
  const reasons: string[] = [];
  const daysLate = Math.max(0, Math.floor((loggedAt.getTime() - activityDate.getTime()) / 86400000));
  const isBackfilled = daysLate > BACKFILL_THRESHOLD_DAYS;
  if (isBackfilled) reasons.push(`Logged ${daysLate} days after the activity date (contemporaneity risk).`);
  const trimmed = task.trim();
  const isVague = trimmed.length < VAGUE_TASK_MIN_LENGTH || VAGUE_TASK_PATTERNS.some((p) => p.test(trimmed));
  if (isVague) reasons.push("Description is short or generic — add one concrete detail.");
  if (durationMinutes > 8 * 60) reasons.push("Unusually long single entry — double-check the duration.");
  return { isVague, isBackfilled, daysLate, reasons };
}

// ------------------------------------------------------------------------- public feedback

// Contempo's FeedbackKit project, where the apps' shake-to-report goes too. The project key is a
// routing key, not a secret (it ships in the apps).
const FEEDBACKKIT_INGEST_URL = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback";
const FEEDBACKKIT_PROJECT_KEY = "pk_e34cf12ad7d2c103d4ce464337ecf0869f6b";

/**
 * The login-free form at /feedback/ (also the contact address in the legal pages). Forwarded to
 * FeedbackKit's public ingest API as a text-only report, with the email as the reporter.
 */
async function publicFeedback(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message?: unknown; email?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 200) : null;
  if (!message || message.length > 5000) throw new HttpError(400, "Feedback must be between 1 and 5000 characters.");
  const res = await fetch(FEEDBACKKIT_INGEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_key: FEEDBACKKIT_PROJECT_KEY,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      text: message,
      annotations: [],
      // Every field the Swift SDK requires, so the FeedbackKit Portal can decode it.
      environment: {
        osName: "Web",
        osVersion: "",
        deviceModel: "",
        appVersion: "",
        appBuild: "",
        bundleIdentifier: "contempo.hejitech.workers.dev",
        screenName: "Feedback form",
        locale: request.headers.get("accept-language")?.split(",")[0] ?? "",
        screenWidthPoints: 0,
        screenHeightPoints: 0,
        screenScale: 1,
        platform: "web",
        pageUrl: new URL("/feedback/", request.url).toString(),
        userAgent: request.headers.get("user-agent") ?? "",
      },
      notify_reporter: false,
      ...(email ? { reporter: { email } } : {}),
    }),
  });
  if (!res.ok) {
    console.error("feedbackkit ingest", res.status, await res.text().catch(() => ""));
    throw new HttpError(502, "Couldn't send your feedback. Please try again.");
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------------------------- account

async function deleteAccount(admin: SupabaseClient, user: User): Promise<void> {
  // Contempo's files and rows only. The sign-in is the shared HEJI login that other HEJI apps use
  // too, so the auth user stays.
  await deleteFiles(admin, user.id);
  for (const t of [...USER_TABLES, "subscriptions", "stripe_customers"]) {
    const { error } = await admin.from(t).delete().eq("user_id", user.id);
    if (error) throw error;
  }
}

/** Every file under the user's folder in the bucket. */
async function deleteFiles(admin: SupabaseClient, userId: string): Promise<void> {
  const storage = admin.storage.from(BUCKET);
  const stack = [userId];
  const files: string[] = [];
  while (stack.length) {
    const prefix = stack.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(prefix, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${prefix}/${item.name}`;
        if (item.id == null) stack.push(path); // a folder
        else files.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  for (let i = 0; i < files.length; i += 500) {
    const { error } = await storage.remove(files.slice(i, i + 500));
    if (error) throw error;
  }
}

/** The user's tables, children first (deleting the review account's data without deleting the account). */
const USER_TABLES = ["corrections", "attachments", "audio_captures", "text_captures", "token_usage", "entries", "categories", "roles", "properties"] as const;

/**
 * App Review's demo account: everything wiped, then two rental properties and a few confirmed
 * entries from the last days, so every screen (entries, reports, properties) has something to show.
 */
async function resetReviewAccount(admin: SupabaseClient, userId: string): Promise<void> {
  await deleteFiles(admin, userId);
  for (const t of USER_TABLES) {
    const { error } = await admin.from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }
  const { data: props, error } = await admin.from("properties")
    .insert([{ user_id: userId, name: "Lakeview Cabin" }, { user_id: userId, name: "Downtown Loft" }])
    .select("id, name");
  if (error) throw error;
  const [cabin, loft] = props as { id: string; name: string }[];
  const day = (n: number, h: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const entry = (p: { id: string; name: string }, task: string, minutes: number, category: string, n: number, h: number) => ({
    user_id: userId, property_id: p.id, property_name: p.name, task, duration_minutes: minutes, category,
    status: "confirmed", source: "manual", activity_date: day(n, h), logged_at: day(n, h + 1), confirmed_at: day(n, h + 1),
  });
  const { error: e2 } = await admin.from("entries").insert([
    entry(cabin, "Turnover after checkout: linens, bathrooms, restocked coffee", 150, "turnover", 0, 17),
    entry(cabin, "Fixed the leaking kitchen faucet, replaced the cartridge", 45, "maintenance", 1, 18),
    entry(loft, "Answered guest questions about parking and early check-in", 20, "guest_communication", 1, 21),
    entry(loft, "Supply run: paper towels, dish soap, light bulbs", 60, "supply_run", 2, 19),
    entry(cabin, "Reviewed bookings and updated the cleaning calendar", 30, "admin", 3, 16),
  ]);
  if (e2) throw e2;
}

/**
 * The phone asks for a pairing code and hands it to the watch over the companion link; the watch
 * exchanges it for its own session (supabase.auth.verifyOtp({ token_hash, type: "magiclink" })).
 * Replaces the Firebase custom token. One-time and short-lived; no email is sent.
 */
async function watchPairingCode(admin: SupabaseClient, user: User) {
  if (!user.email) throw new HttpError(400, "This account has no email to pair with.");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error || !data.properties?.hashed_token) throw new HttpError(500, "Couldn't create a pairing code.");
  return { tokenHash: data.properties.hashed_token, type: "magiclink" };
}

// ---------------------------------------------------------------------------------- billing

async function stripe(env: Env, method: string, path: string, params?: Record<string, unknown>) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, "Billing isn't set up yet.");
  const form = params ? toForm(params) : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && form ? `?${form}` : ""}`, {
    method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : form,
  });
  const out = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 400, out.error?.message ?? `Stripe ${res.status}`);
  return out;
}

/** Stripe's bracket form encoding: { a: { b: 1 }, c: [ {d: 2} ] } → a[b]=1&c[0][d]=2. */
function toForm(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()): string {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? toForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") toForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out.toString();
}

async function customerFor(env: Env, admin: SupabaseClient, user: User): Promise<string> {
  const { data } = await admin.from("stripe_customers").select("customer_id").eq("user_id", user.id).maybeSingle();
  if (data?.customer_id) return data.customer_id as string;
  const customer = await stripe(env, "POST", "customers", { email: user.email, metadata: { supabase_uid: user.id, app: "contempo" } });
  await admin.from("stripe_customers").insert({ customer_id: customer.id, user_id: user.id });
  await admin.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer.id });
  return customer.id as string;
}

async function checkout(env: Env, admin: SupabaseClient, user: User, body: Record<string, unknown>) {
  const { priceId, successUrl, cancelUrl } = body as Record<string, string | undefined>;
  if (!priceId || !successUrl || !cancelUrl) throw new HttpError(400, "priceId, successUrl, and cancelUrl are required.");
  const customer = await customerFor(env, admin, user);
  const session = await stripe(env, "POST", "checkout/sessions", {
    customer,
    client_reference_id: user.id,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: { metadata: { app: "contempo" } },
  });
  return { url: session.url };
}

async function portal(env: Env, admin: SupabaseClient, user: User, body: Record<string, unknown>) {
  if (!body.returnUrl) throw new HttpError(400, "returnUrl is required.");
  const { data } = await admin.from("stripe_customers").select("customer_id").eq("user_id", user.id).maybeSingle();
  if (!data?.customer_id) throw new HttpError(409, "No billing account yet — start checkout first.");
  const session = await stripe(env, "POST", "billing_portal/sessions", { customer: data.customer_id, return_url: body.returnUrl });
  return { url: session.url };
}

async function couponAdmin(env: Env, action: string, body: Record<string, unknown>) {
  switch (action) {
    case "list": {
      const [promotionCodes, coupons] = await Promise.all([
        stripe(env, "GET", "promotion_codes", { limit: 100, expand: ["data.promotion.coupon"] }),
        stripe(env, "GET", "coupons", { limit: 100 }),
      ]);
      return { promotionCodes: promotionCodes.data, coupons: coupons.data };
    }
    case "create": {
      const b = body as Record<string, string | number | undefined>;
      const duration = b.duration as string | undefined;
      if (!duration || !["once", "repeating", "forever"].includes(duration)) throw new HttpError(400, "duration must be one of once/repeating/forever.");
      if (!b.percentOff && !b.amountOff) throw new HttpError(400, "Set either percentOff or amountOff.");
      if (b.percentOff && (Number(b.percentOff) <= 0 || Number(b.percentOff) > 100)) throw new HttpError(400, "percentOff must be between 1 and 100.");
      if (b.amountOff && !b.currency) throw new HttpError(400, "currency is required when amountOff is set.");
      if (duration === "repeating" && !b.durationInMonths) throw new HttpError(400, "durationInMonths is required when duration is repeating.");
      const metadata = { app: "contempo", ...(b.purpose ? { purpose: b.purpose } : {}) };
      const coupon = await stripe(env, "POST", "coupons", {
        name: b.name,
        percent_off: b.percentOff,
        amount_off: b.amountOff,
        currency: b.amountOff ? b.currency : undefined,
        duration,
        duration_in_months: duration === "repeating" ? b.durationInMonths : undefined,
        max_redemptions: b.maxRedemptions,
        redeem_by: b.redeemBy,
        metadata,
      });
      const promotionCode = await stripe(env, "POST", "promotion_codes", {
        promotion: { type: "coupon", coupon: coupon.id },
        code: b.code,
        max_redemptions: b.maxRedemptions,
        expires_at: b.redeemBy,
        metadata,
      });
      return { coupon, promotionCode };
    }
    case "deactivate":
      if (!body.promotionCodeId) throw new HttpError(400, "promotionCodeId is required.");
      return { promotionCode: await stripe(env, "POST", `promotion_codes/${body.promotionCodeId}`, { active: false }) };
    case "delete":
      if (!body.couponId) throw new HttpError(400, "couponId is required.");
      return { deleted: await stripe(env, "DELETE", `coupons/${body.couponId}`) };
    default:
      throw new HttpError(404, `No such coupon action: ${action}`);
  }
}

async function stripeWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Billing isn't set up.", { status: 503 });
  const payload = await request.text();
  if (!(await validStripeSignature(payload, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("Invalid signature.", { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const admin = serviceClient(env);
  const obj = event.data.object;
  // The HEJI Stripe account is shared by several apps: only Contempo's objects are ours.
  if (event.type === "checkout.session.completed") {
    const uid = obj.client_reference_id as string | undefined;
    if (uid && obj.subscription) {
      const sub = await stripe(env, "GET", `subscriptions/${obj.subscription}`);
      if (isContempoSubscription(sub)) await syncSubscription(admin, uid, sub);
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    if (isContempoSubscription(obj)) {
      const { data } = await admin.from("stripe_customers").select("user_id").eq("customer_id", obj.customer as string).maybeSingle();
      if (data?.user_id) await syncSubscription(admin, data.user_id as string, obj);
      else console.warn("stripe webhook: no user for customer", obj.customer);
    }
  }
  return new Response(null, { status: 200 });
}

/** Contempo Pro in the shared HEJI Stripe account (products are tagged metadata.app). */
const CONTEMPO_PRODUCT = "prod_V0smC72BLmnFUb";

/** Ours if tagged app=contempo, or if any of its items is a Contempo Pro price. */
function isContempoSubscription(sub: Record<string, unknown>): boolean {
  if ((sub.metadata as Record<string, string> | undefined)?.app === "contempo") return true;
  const items = ((sub.items as { data?: Record<string, unknown>[] })?.data ?? []);
  return items.some((item) => {
    const product = (item.price as Record<string, unknown> | undefined)?.product;
    return product === CONTEMPO_PRODUCT || (product as Record<string, unknown> | undefined)?.id === CONTEMPO_PRODUCT;
  });
}

async function syncSubscription(admin: SupabaseClient, uid: string, sub: Record<string, unknown>): Promise<void> {
  const item = ((sub.items as { data?: Record<string, unknown>[] })?.data ?? [])[0];
  const periodEnd = item?.current_period_end as number | undefined;
  const { error } = await admin.from("subscriptions").upsert({
    user_id: uid,
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id as string,
    status: sub.status as string,
    price_id: ((item?.price as Record<string, unknown>)?.id as string) ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Stripe-Signature: t=<ts>,v1=<hex hmac-sha256 of "<ts>.<payload>">; 5-minute tolerance. */
async function validStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .some((kv) => kv.slice(3).length === expected.length && timingSafeEqual(kv.slice(3), expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
