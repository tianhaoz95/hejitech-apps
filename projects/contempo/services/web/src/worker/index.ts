/**
 * Contempo's Cloudflare Worker:
 * - Serves the web app (/), admin site (/admin/), and login-free feedback form (/feedback/)
 * - MCP server at /mcp (Streamable HTTP) with OAuth 2.1 (/authorize, /token, /register, /.well-known/*)
 *   and personal access tokens (`cta_…`)
 * - Unified cross-platform Pro (GET /api/pro, POST /api/pro/checkout, POST /api/pro/portal,
 *   POST /api/appstore/transactions, POST /appstore/notifications, POST /api/play/purchases,
 *   POST /stripe/webhook) combining App Store, Google Play, Stripe, legacy subscriptions, and pro_grants
 * - Contemporaneity push nudges (POST/DELETE /api/push-devices + daily scheduled cron)
 * - Core API: /api/flag-risk, /api/account/delete, /api/watch/pair, /api/review-sign-in,
 *   /api/billing/* (legacy Stripe), /api/admin/coupons/*, /api/feedback
 *
 * No AI runs here: Contempo's parsing and chat are on-device only (product decision 2026-10-16).
 */
import { AuthorizationError, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import type { User } from "@supabase/supabase-js";
import { appleKey, revokeIfPossible } from "./apple.ts";
import { AppStoreError, handleNotification, recordTransactions } from "./appstore.ts";
import {
  checkout as unifiedCheckout,
  handleStripeWebhook,
  offers as proOffers,
  portal as unifiedPortal,
  proRequired,
  StripeError,
} from "./billing.ts";
import { runContemporaneityNudges } from "./cron.ts";
import { handleMcp, type Caller } from "./mcp.ts";
import { freshProStatus, PlayError, recordPlayPurchases } from "./play.ts";
import { reviewSignIn } from "./review.ts";
import { flagRisk } from "./risk.ts";
import {
  admin as serviceClient,
  BUCKET,
  json,
  PREFIX,
  randomToken,
  resolveAgent,
  sha256,
  supabaseUser,
  type Db,
  type Env,
} from "./store.ts";

export { flagRisk };
export type { Env };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface Props {
  userId: string;
  via: "oauth" | "token";
}

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const props = ctx.props;
    if (!props?.userId) return new Response("unauthorized", { status: 401 });
    const caller: Caller = { userId: props.userId, via: props.via };
    const db = serviceClient(env);
    const email = (await db.auth.admin.getUserById(props.userId).catch(() => null))?.data.user?.email;
    if (!(await freshProStatus(env, db, props.userId, email)).pro) return json(proRequired(env), 402);
    return handleMcp(req, caller, db);
  },
};

function withoutLocation(headers: Headers): Headers {
  const h = new Headers(headers);
  h.delete("Location");
  return h;
}

async function authorize(req: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  if (!oauth) return json({ error: "OAuth provider not configured." }, 503);
  try {
    if (req.method === "GET") {
      const authReq = await oauth.parseAuthRequest(req);
      const d = await oauth.describeConsent(authReq);
      const consent = await oauth.beginConsent(authReq);
      const page = new URL("/oauth/consent", req.url);
      page.searchParams.set("handle", consent.handle);
      page.searchParams.set("client", d.clientName);
      if (d.clientDomain) page.searchParams.set("domain", d.clientDomain);
      page.searchParams.set("redirect_host", d.redirectHost);
      if (d.redirectIsLoopback) page.searchParams.set("loopback", "1");
      consent.headers.set("Location", page.toString());
      consent.headers.set("Cache-Control", "no-store");
      return new Response(null, { status: 302, headers: consent.headers });
    }
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    const body = (await req.json().catch(() => ({}))) as { handle?: string; decision?: string };
    const handle = String(body.handle ?? "");
    if (body.decision === "deny") {
      const denied = await oauth.denyConsent(req, handle);
      return json({ redirectTo: denied.headers.get("Location") }, 200, withoutLocation(denied.headers));
    }
    if (body.decision !== "approve") return json({ error: "decision must be approve or deny" }, 400);

    const user = await supabaseUser(env, req);
    if (!user) return json({ error: "Your session expired. Sign in again." }, 401);
    const approved = await oauth.approveConsent(req, handle, { scope: ["mcp"] });
    const props: Props = { userId: user.id, via: "oauth" };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user.id,
      metadata: { email: user.email },
      scope: approved.request.scope,
      props,
    });
    return json({ redirectTo }, 200, approved.headers);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (req.method === "GET" && error.redirectTo) return Response.redirect(error.redirectTo, 302);
      const problem = new URL("/oauth/consent", req.url);
      problem.searchParams.set("error", error.description ?? "This request is invalid or expired.");
      return req.method === "GET"
        ? Response.redirect(problem.toString(), 302)
        : json({ error: problem.searchParams.get("error"), redirectTo: error.redirectTo ?? null }, 400);
    }
    throw error;
  }
}

async function grants(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await supabaseUser(env, req);
  if (!user) return json({ error: "sign in required" }, 401);
  const oauth = env.OAUTH_PROVIDER;
  if (!oauth) return json([]);
  if (req.method === "GET" && url.pathname === "/api/grants") {
    const { items } = await oauth.listUserGrants(user.id);
    const rows = await Promise.all(
      items.map(async (g) => {
        const client = await oauth.lookupClient(g.clientId).catch(() => null);
        return { id: g.id, client_name: client?.clientName ?? null, created_at: new Date(g.createdAt * 1000).toISOString() };
      })
    );
    return json(rows);
  }
  const m = url.pathname.match(/^\/api\/grants\/([^/]+)$/);
  if (req.method === "DELETE" && m) {
    await oauth.revokeGrant(decodeURIComponent(m[1]), user.id);
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

const app = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/authorize") return authorize(request, env);
    if (url.pathname === "/api/grants" || url.pathname.startsWith("/api/grants/")) return grants(request, env, url);
    if (url.pathname === "/stripe/webhook" && request.method === "POST") {
      return handleStripeWebhook(env, serviceClient(env), request);
    }
    if (url.pathname === "/appstore/notifications" && request.method === "POST") {
      const r = await handleNotification(serviceClient(env), await request.json().catch(() => null));
      return json({ ok: r.status < 300, result: r.result }, r.status);
    }
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url.pathname.slice("/api/".length));
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        if (err instanceof StripeError) return json({ error: err.message }, err.status);
        if (err instanceof PlayError) return json({ error: err.message }, err.status);
        if (err instanceof AppStoreError) return json({ error: err.message }, 400);
        console.error("api error", url.pathname, err);
        return json({ error: "Something went wrong." }, 500);
      }
    }
    if (url.pathname === "/admin") return Response.redirect(`${url.origin}/admin/`, 301);
    if (url.pathname.startsWith("/admin/") && !/\.[a-z0-9]+$/i.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(`${url.origin}/admin/`, request));
    }
    return env.ASSETS.fetch(request);
  },
};

async function api(request: Request, env: Env, route: string): Promise<Response> {
  // Public / webhook endpoints
  if (route === "stripe/webhook" && request.method === "POST") return legacyAndUnifiedStripeWebhook(request, env);
  if (route === "feedback" && request.method === "POST") return publicFeedback(request);
  if (route === "review-sign-in" && request.method === "POST") {
    const db = serviceClient(env);
    const r = await reviewSignIn(env, request, (userId) => resetReviewAccount(db, userId));
    return json(r.body, r.status);
  }
  if (route === "pro/offers" && request.method === "GET") {
    return json({ offers: await proOffers(env) });
  }

  // Authenticated endpoints
  const user = await supabaseUser(env, request);
  if (!user) throw new HttpError(401, "Sign in first.");
  const db = serviceClient(env);

  // GET /api/pro
  if (route === "pro" && request.method === "GET") {
    return json(await freshProStatus(env, db, user.id, user.email));
  }

  // Personal access tokens (MCP)
  if (route === "tokens" && request.method === "GET") {
    const { data, error } = await db
      .from("access_tokens")
      .select("id, name, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return json({ tokens: data ?? [] });
  }
  if (route === "tokens" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : "Assistant";
    const token = randomToken(PREFIX.agent);
    const tokenHash = await sha256(token);
    const { data, error } = await db
      .from("access_tokens")
      .insert({ user_id: user.id, name, token_hash: tokenHash })
      .select("id, name, created_at")
      .single();
    if (error) throw new HttpError(500, error.message);
    return json({ token, ...data }, 201);
  }
  if (route.startsWith("tokens/") && request.method === "DELETE") {
    const tokenId = decodeURIComponent(route.slice("tokens/".length));
    const { error } = await db.from("access_tokens").delete().eq("id", tokenId).eq("user_id", user.id);
    if (error) throw new HttpError(500, error.message);
    return json({ ok: true });
  }

  // Push device registration (APNs / FCM)
  if (route === "push-devices" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      apns_token?: unknown;
      fcm_token?: unknown;
      environment?: unknown;
      label?: unknown;
    };
    const apnsToken = typeof body.apns_token === "string" && body.apns_token.trim() ? body.apns_token.trim() : null;
    const fcmToken = typeof body.fcm_token === "string" && body.fcm_token.trim() ? body.fcm_token.trim() : null;
    if ((apnsToken === null) === (fcmToken === null)) {
      throw new HttpError(400, "Provide exactly one of apns_token or fcm_token.");
    }
    const environment = body.environment === "sandbox" ? "sandbox" : "production";
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : apnsToken ? "iPhone" : "Android";
    const conflictCol = apnsToken ? "apns_token" : "fcm_token";
    const { error } = await db.from("push_devices").upsert(
      {
        user_id: user.id,
        apns_token: apnsToken,
        fcm_token: fcmToken,
        environment,
        label,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: conflictCol }
    );
    if (error) throw new HttpError(500, error.message);
    return json({ ok: true });
  }
  if (route === "push-devices" && request.method === "DELETE") {
    const body = (await request.json().catch(() => ({}))) as { apns_token?: unknown; fcm_token?: unknown };
    if (typeof body.apns_token === "string" && body.apns_token.trim()) {
      await db.from("push_devices").delete().eq("user_id", user.id).eq("apns_token", body.apns_token.trim());
    } else if (typeof body.fcm_token === "string" && body.fcm_token.trim()) {
      await db.from("push_devices").delete().eq("user_id", user.id).eq("fcm_token", body.fcm_token.trim());
    }
    return json({ ok: true });
  }

  if (request.method !== "POST") throw new HttpError(405, "POST only.");
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  switch (route) {
    case "pro/checkout": {
      const url = await unifiedCheckout(env, db, { userId: user.id, email: user.email }, body.plan);
      return json({ url });
    }
    case "pro/portal": {
      const url = await unifiedPortal(env, db, { userId: user.id, email: user.email });
      return json({ url });
    }
    case "appstore/transactions": {
      const res = await recordTransactions(db, user.id, body.transactions ?? body.jws ?? []);
      const status = await freshProStatus(env, db, user.id, user.email);
      return json({ ...res, status });
    }
    case "play/purchases": {
      const res = await recordPlayPurchases(env, db, user.id, body);
      const status = await freshProStatus(env, db, user.id, user.email);
      return json({ ...res, status });
    }
    case "flag-risk":
      try {
        return json(flagRisk(body));
      } catch (e) {
        throw new HttpError(400, e instanceof Error ? e.message : "Invalid input.");
      }
    case "account/delete": {
      const appleRevoked = await revokeIfPossible(appleKey(env), body.apple_authorization_code);
      if (env.OAUTH_PROVIDER) {
        const { items } = await env.OAUTH_PROVIDER.listUserGrants(user.id).catch(() => ({ items: [] }));
        await Promise.all(items.map((g) => env.OAUTH_PROVIDER!.revokeGrant(g.id, user.id).catch(() => null)));
      }
      await deleteAccount(db, user);
      return json({ success: true, apple_revoked: appleRevoked });
    }
    case "watch/pair":
      return json(await watchPairingCode(db, user));
    case "billing/checkout":
      return json(await legacyCheckout(env, db, user, body));
    case "billing/portal":
      return json(await legacyPortal(env, db, user, body));
    default:
      if (route.startsWith("admin/coupons/")) {
        await assertAdmin(db, user);
        return json(await couponAdmin(env, route.slice("admin/coupons/".length), body));
      }
      throw new HttpError(404, `No such API: ${route}`);
  }
}

async function assertAdmin(db: Db, user: User): Promise<void> {
  const { data } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new HttpError(403, "Admin access required.");
}

// ------------------------------------------------------------------------- public feedback

const FEEDBACKKIT_INGEST_URL = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback";
const FEEDBACKKIT_PROJECT_KEY = "pk_e34cf12ad7d2c103d4ce464337ecf0869f6b";

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

const USER_TABLES = [
  "corrections",
  "attachments",
  "audio_captures",
  "text_captures",
  "token_usage",
  "entries",
  "categories",
  "roles",
  "properties",
  "access_tokens",
  "push_devices",
  "sent_notifications",
] as const;

async function deleteAccount(db: Db, user: User): Promise<void> {
  await deleteFiles(db, user.id);
  for (const t of [...USER_TABLES, "subscriptions", "stripe_customers"]) {
    const { error } = await db.from(t).delete().eq("user_id", user.id);
    if (error) throw error;
  }
}

async function deleteFiles(db: Db, userId: string): Promise<void> {
  const storage = db.storage.from(BUCKET);
  const stack = [userId];
  const files: string[] = [];
  while (stack.length) {
    const prefix = stack.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(prefix, { limit: 1000, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${prefix}/${item.name}`;
        if (item.id == null) stack.push(path);
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

async function resetReviewAccount(db: Db, userId: string): Promise<void> {
  await deleteFiles(db, userId);
  for (const t of USER_TABLES) {
    const { error } = await db.from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }
  const { data: props, error } = await db
    .from("properties")
    .insert([
      { user_id: userId, name: "Lakeview Cabin" },
      { user_id: userId, name: "Downtown Loft" },
    ])
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
    user_id: userId,
    property_id: p.id,
    property_name: p.name,
    task,
    duration_minutes: minutes,
    category,
    status: "confirmed",
    source: "manual",
    activity_date: day(n, h),
    logged_at: day(n, h + 1),
    confirmed_at: day(n, h + 1),
  });
  const { error: e2 } = await db.from("entries").insert([
    entry(cabin, "Turnover after checkout: linens, bathrooms, restocked coffee", 150, "turnover", 0, 17),
    entry(cabin, "Fixed the leaking kitchen faucet, replaced the cartridge", 45, "maintenance", 1, 18),
    entry(loft, "Answered guest questions about parking and early check-in", 20, "guest_communication", 1, 21),
    entry(loft, "Supply run: paper towels, dish soap, light bulbs", 60, "supply_run", 2, 19),
    entry(cabin, "Reviewed bookings and updated the cleaning calendar", 30, "admin", 3, 16),
  ]);
  if (e2) throw e2;
}

async function watchPairingCode(db: Db, user: User) {
  if (!user.email) throw new HttpError(400, "This account has no email to pair with.");
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error || !data.properties?.hashed_token) throw new HttpError(500, "Couldn't create a pairing code.");
  return { tokenHash: data.properties.hashed_token, type: "magiclink" };
}

// ---------------------------------------------------------------------------------- legacy billing + coupons

async function stripeRest(env: Env, method: string, path: string, params?: Record<string, unknown>) {
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

function toForm(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()): string {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v))
      v.forEach((item, i) =>
        typeof item === "object" ? toForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))
      );
    else if (typeof v === "object") toForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out.toString();
}

async function legacyCustomerFor(env: Env, db: Db, user: User): Promise<string> {
  const { data } = await db.from("stripe_customers").select("customer_id").eq("user_id", user.id).maybeSingle();
  if (data?.customer_id) return data.customer_id as string;
  const customer = await stripeRest(env, "POST", "customers", { email: user.email, metadata: { supabase_uid: user.id, app: "contempo" } });
  await db.from("stripe_customers").insert({ customer_id: customer.id, user_id: user.id });
  await db.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer.id });
  return customer.id as string;
}

async function legacyCheckout(env: Env, db: Db, user: User, body: Record<string, unknown>) {
  const { priceId, successUrl, cancelUrl } = body as Record<string, string | undefined>;
  if (!priceId || !successUrl || !cancelUrl) throw new HttpError(400, "priceId, successUrl, and cancelUrl are required.");
  const customer = await legacyCustomerFor(env, db, user);
  const session = await stripeRest(env, "POST", "checkout/sessions", {
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

async function legacyPortal(env: Env, db: Db, user: User, body: Record<string, unknown>) {
  if (!body.returnUrl) throw new HttpError(400, "returnUrl is required.");
  const { data } = await db.from("stripe_customers").select("customer_id").eq("user_id", user.id).maybeSingle();
  if (!data?.customer_id) throw new HttpError(409, "No billing account yet — start checkout first.");
  const session = await stripeRest(env, "POST", "billing_portal/sessions", { customer: data.customer_id, return_url: body.returnUrl });
  return { url: session.url };
}

async function couponAdmin(env: Env, action: string, body: Record<string, unknown>) {
  switch (action) {
    case "list": {
      const [promotionCodes, coupons] = await Promise.all([
        stripeRest(env, "GET", "promotion_codes", { limit: 100, expand: ["data.promotion.coupon"] }),
        stripeRest(env, "GET", "coupons", { limit: 100 }),
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
      const coupon = await stripeRest(env, "POST", "coupons", {
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
      const promotionCode = await stripeRest(env, "POST", "promotion_codes", {
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
      return { promotionCode: await stripeRest(env, "POST", `promotion_codes/${body.promotionCodeId}`, { active: false }) };
    case "delete":
      if (!body.couponId) throw new HttpError(400, "couponId is required.");
      return { deleted: await stripeRest(env, "DELETE", `coupons/${body.couponId}`) };
    default:
      throw new HttpError(404, `No such coupon action: ${action}`);
  }
}

async function legacyAndUnifiedStripeWebhook(request: Request, env: Env): Promise<Response> {
  return handleStripeWebhook(env, serviceClient(env), request);
}

// ---------------------------------------------------------------------------------- OAuthProvider + Export

let provider: OAuthProvider<Env> | null = null;
let providerFor = "";

function getProvider(env: Env): OAuthProvider<Env> {
  if (provider && providerFor === env.PUBLIC_URL) return provider;
  const resource = `${env.PUBLIC_URL}/mcp`;
  providerFor = env.PUBLIC_URL;
  provider = new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: mcpHandler as never,
    defaultHandler: app as never,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    scopesSupported: ["mcp", "offline_access"],
    requiredScopes: ["mcp"],
    resourceMetadata: { resource, authorization_servers: [env.PUBLIC_URL], resource_name: "Contempo" },
    accessTokenTTL: 3600,
    refreshTokenTTL: 90 * 86400,
    resolveExternalToken: async ({ token, env: e }) => {
      if (!token.startsWith(PREFIX.agent)) return null;
      const userId = await resolveAgent(serviceClient(e as Env), token);
      if (!userId) return null;
      const props: Props = { userId, via: "token" };
      return { props, audience: resource };
    },
  });
  return provider;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => getProvider(env).fetch(req, env, ctx),
  scheduled: async (_controller: ScheduledController, env: Env) => {
    const summary = await runContemporaneityNudges(env);
    console.log("contempo cron nudges", JSON.stringify(summary));
  },
} satisfies ExportedHandler<Env>;
