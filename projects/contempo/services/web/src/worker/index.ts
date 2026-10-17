/**
 * Contempo's Cloudflare Worker: serves the web app (/), the admin site (/admin/) and the login-free
 * feedback form (/feedback/) from static assets, and the API that replaced the Firebase Cloud
 * Functions (projects/contempo/backend/ before 2026-10-16):
 *
 *   POST /api/parse-entry        cloud fallback for entry parsing (was parseEntry)
 *   POST /api/flag-risk          contemporaneity/vagueness heuristics, no LLM (was flagRisk)
 *   POST /api/ask-agent          the legal-grounding copilot chat (was askAgent)
 *   POST /api/account/delete     wipe the user's files and account (was deleteAccount)
 *   POST /api/watch/pair         one-time code that signs a watch in as the phone's user (was mintWatchAuthToken)
 *   POST /api/billing/checkout   Stripe Checkout (was createCheckoutSession)
 *   POST /api/billing/portal     Stripe customer portal (was createPortalLink)
 *   POST /api/admin/coupons/*    coupon management for the admin site (was adminListCoupons, …)
 *   POST /api/stripe/webhook     subscription sync into contempo.subscriptions (was stripeWebhook)
 *   POST /api/feedback           the login-free feedback form (was a direct Firestore write)
 *
 * Every /api call except the webhook and /api/feedback needs `Authorization: Bearer <Supabase access token>`.
 * Data lives in the shared Supabase project, schema `contempo` (projects/contempo/backend.env);
 * clients read and write their own rows directly (RLS), the Worker only does what needs the
 * service role or a secret.
 *
 * Cloud AI: Gemini (gemini-flash-latest, same model as before) when CONTEMPO_GOOGLE_GENAI_API_KEY
 * is set, otherwise Cloudflare Workers AI (the AI binding), so cloud parsing works with no key.
 */
import { createClient, type User } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any, "contempo">>;

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_GENAI_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const GEMINI_MODEL = "gemini-flash-latest";
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
  if (route === "feedback") return publicFeedback(request, env);

  const user = await authenticate(request, env);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = serviceClient(env);

  switch (route) {
    case "parse-entry":
      return json(await parseEntry(env, admin, user, body));
    case "flag-risk":
      return json(flagRisk(body));
    case "ask-agent":
      return json(await askAgent(env, admin, user, body));
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

// ---------------------------------------------------------------------------------- cloud AI

type ChatTurn = { role: "system" | "user" | "assistant"; content: string };
type Usage = { inputTokens: number; outputTokens: number };

async function generate(env: Env, turns: ChatTurn[], schema?: Record<string, unknown>): Promise<{ text: string; usage: Usage }> {
  if (env.GOOGLE_GENAI_API_KEY) {
    const system = turns.filter((t) => t.role === "system").map((t) => t.content).join("\n");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GOOGLE_GENAI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: turns
            .filter((t) => t.role !== "system")
            .map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
          ...(schema ? { generationConfig: { responseMimeType: "application/json", responseSchema: geminiSchema(schema) } } : {}),
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const out = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    return {
      text: out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
      usage: { inputTokens: out.usageMetadata?.promptTokenCount ?? 0, outputTokens: out.usageMetadata?.candidatesTokenCount ?? 0 },
    };
  }
  const out = (await env.AI.run(WORKERS_AI_MODEL as keyof AiModels, {
    messages: turns,
    ...(schema ? { response_format: { type: "json_schema", json_schema: schema } } : {}),
    max_tokens: 1024,
  } as never)) as { response?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const text = typeof out.response === "string" ? out.response : JSON.stringify(out.response ?? "");
  return { text, usage: { inputTokens: out.usage?.prompt_tokens ?? 0, outputTokens: out.usage?.completion_tokens ?? 0 } };
}

/** JSON Schema → Gemini's OpenAPI subset (nullable instead of ["x","null"] unions). */
function geminiSchema(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "type" && Array.isArray(v)) {
      out.type = v.find((t) => t !== "null");
      if (v.includes("null")) out.nullable = true;
    } else if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(Object.entries(v).map(([p, ps]) => [p, geminiSchema(ps as Record<string, unknown>)]));
    } else if (k !== "additionalProperties") {
      out[k] = v;
    }
  }
  return out;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new HttpError(502, "The model didn't return an entry.");
  return JSON.parse(text.slice(start, end + 1));
}

async function recordCloudUsage(admin: SupabaseClient, user: User, usage: Usage): Promise<void> {
  const now = new Date();
  const { error } = await admin.rpc("add_token_usage", {
    p_user: user.id,
    p_kind: "cloud",
    p_week_id: isoWeekId(now),
    p_week_start: isoWeekStart(now).toISOString(),
    p_input: usage.inputTokens,
    p_output: usage.outputTokens,
  });
  if (error) console.warn("recordCloudUsage failed", error.message); // best effort, never blocks the answer
}

export function isoWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function isoWeekStart(date: Date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1);
  return d;
}

const CATEGORIES = ["maintenance", "turnover", "guest_communication", "supply_run", "admin", "other"];

const ENTRY_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    property: { type: ["string", "null"] },
    task: { type: ["string", "null"] },
    durationMinutes: { type: ["integer", "null"] },
    category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
    eventType: { type: ["string", "null"], enum: ["start", "stop", null] },
    miles: { type: ["number", "null"] },
    resolvedActivityDateIso: { type: ["string", "null"] },
  },
  required: ["property", "task", "durationMinutes", "category", "eventType", "miles", "resolvedActivityDateIso"],
};

async function parseEntry(env: Env, admin: SupabaseClient, user: User, body: Record<string, unknown>) {
  const rawText = String(body.rawText ?? "").trim();
  if (!rawText) throw new HttpError(400, "rawText is required.");
  const knownProperties = Array.isArray(body.knownProperties) ? body.knownProperties.map(String) : [];
  const nowIso = String(body.nowIso ?? new Date().toISOString());
  // Same prompt as the Genkit flow it replaces (backend/functions/src/flows/parseEntry.ts).
  const prompt = [
    "You extract short-term-rental work-log entries from a host's own words.",
    `Current time: ${nowIso}.`,
    knownProperties.length
      ? `The host's known properties: ${knownProperties.join(", ")}. Match to one of these if the text clearly refers to it; do not invent a new property name unless none of these plausibly match.`
      : "The host has no properties on file yet — use whatever property name (if any) is mentioned.",
    `Extract: property, task (short, specific — not vague like 'worked on house'), durationMinutes, and category (one of ${CATEGORIES.join(", ")}).`,
    'The host\'s message is dictated speech, not typed text — clean it up before extracting "task": remove filler words and disfluencies ("uh", "um", false starts, mid-sentence restarts) that carry no information, and fix likely transcription errors, punctuation, and capitalization. Never change the meaning or drop a real detail.',
    'Format "task" as plain prose by default. Only use a markdown bullet list (lines starting with "- ") when the host clearly describes multiple distinct sub-tasks in one capture — a single task never needs a bullet. Never use headers, tables, or bold.',
    "Also set eventType if the host is opening or closing a start/stop timer rather than describing a complete task: \"start\" for phrasing like 'I'm starting to work on X' / 'beginning work now' / 'clocking in', \"stop\" for phrasing like 'I just finished' / 'wrapping up' / 'clocking out'. Leave eventType null for a normal complete description of work already done. When eventType is \"start\", durationMinutes should be null.",
    "Also set miles if the host states a distance driven (e.g. 'drove 12 miles to pick up supplies') — a separate business-mileage deduction; extract it whenever a distance is mentioned. Leave miles null if no distance is mentioned.",
    `Also set resolvedActivityDateIso if the host mentions when the work happened relative to now (${nowIso}) or at a specific clock time — resolve it to a single absolute ISO-8601 timestamp. Leave it null if the host mentions no time reference at all.`,
    "Fill in every field you can confidently determine and leave the rest null. Never ask a question — a partial entry is the correct output.",
    "Reply with only a JSON object with keys property, task, durationMinutes, category, eventType, miles, resolvedActivityDateIso.",
    `Host's message: "${rawText}"`,
  ].join("\n");
  const { text, usage } = await generate(env, [{ role: "user", content: prompt }], ENTRY_DRAFT_SCHEMA);
  const raw = parseJsonObject(text);
  await recordCloudUsage(admin, user, usage);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const duration = num(raw.durationMinutes);
  return {
    property: str(raw.property),
    task: str(raw.task),
    durationMinutes: duration != null && duration > 0 ? Math.round(duration) : null,
    category: CATEGORIES.includes(String(raw.category)) ? String(raw.category) : null,
    eventType: raw.eventType === "start" || raw.eventType === "stop" ? raw.eventType : null,
    miles: num(raw.miles) != null && (raw.miles as number) >= 0 ? (raw.miles as number) : null,
    resolvedActivityDateIso: str(raw.resolvedActivityDateIso),
  };
}

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

async function askAgent(env: Env, admin: SupabaseClient, user: User, body: Record<string, unknown>) {
  const question = String(body.question ?? "").trim();
  if (!question) throw new HttpError(400, "question is required.");
  const history = (Array.isArray(body.history) ? body.history : []) as { role?: string; text?: string }[];
  const attached = (Array.isArray(body.attachedEntries) ? body.attachedEntries : []) as Record<string, unknown>[];
  const entriesContext = attached.length
    ? "The host attached these specific logged entries to ask about — ground your answer in them, don't ask which entry they mean:\n" +
      attached
        .map((e, i) => `${i + 1}. ${e.propertyName || "(no property)"} — ${e.task || "(no task)"} (${e.durationMinutes} min, ${e.category}, ${e.activityDate})`)
        .join("\n")
    : "";
  const system = [
    "You are the in-app copilot for an app that helps short-term-rental hosts",
    "log hours toward IRS material-participation tests (e.g. the 100-hour or",
    "500-hour STR tests, or the 750-hour real-estate-professional test), grounded",
    "in IRS Pub 925 and Treas. Reg. §1.469-5T.",
    `This host is tracking toward the ${body.testName ?? "STR"} test: ${body.confirmedHours ?? 0} of ${body.thresholdHours ?? 100} hours confirmed so far.`,
    entriesContext,
    "Answer the host's question directly and concisely using that context.",
    "You are not a lawyer or CPA and this is not tax or legal advice — say so",
    "plainly whenever a question turns on a genuinely unsettled or fact-specific",
    "legal judgment call, and suggest they confirm with their tax professional.",
    "Do not fabricate case law, IRS rulings, or numbers you weren't given.",
  ].join(" ");
  const turns: ChatTurn[] = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: (m.role === "agent" ? "assistant" : "user") as ChatTurn["role"], content: String(m.text ?? "") })),
    { role: "user", content: question },
  ];
  const { text, usage } = await generate(env, turns);
  if (!text.trim()) throw new HttpError(502, "The model returned no answer.");
  await recordCloudUsage(admin, user, usage);
  return { answer: text.trim() };
}

// ------------------------------------------------------------------------- public feedback

/** The login-free form at /feedback/: anyone may send, only admins read (contempo.feedback). */
async function publicFeedback(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { message?: unknown; email?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 200) : null;
  if (!message || message.length > 5000) throw new HttpError(400, "Feedback must be between 1 and 5000 characters.");
  const { error } = await serviceClient(env).from("feedback").insert({ message, email });
  if (error) throw error;
  return json({ ok: true });
}

// ---------------------------------------------------------------------------------- account

async function deleteAccount(admin: SupabaseClient, user: User): Promise<void> {
  // Storage first (rows go with the user via on delete cascade; files don't).
  const storage = admin.storage.from(BUCKET);
  const stack = [user.id];
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
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
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
