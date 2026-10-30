// Data access for the Worker: the service-role client on the `tradeboard` schema, token hashing,
// TOTP secret encryption, the board's first-use setup (policy v1, control row, the DEMO plan) and
// JSON helpers. The service key lives only here; no client ever reads the database directly.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_POLICY, checkPolicy, suggestedValidUntil, type Policy } from "@tradeboard/core";

export interface Env {
  OAUTH_KV: KVNamespace;
  ASSETS: Fetcher;
  /** This site's origin; the MCP resource is `${PUBLIC_URL}/mcp`. */
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  /** Publishable (anon) key: validates the owner's Supabase session once, at sign-in. */
  SUPABASE_ANON_KEY: string;
  /** Secret. Bypasses RLS for every project in the shared Supabase project. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Secret in production: base64 of 32 random bytes, encrypts the TOTP secret at rest. */
  TOTP_ENC_KEY: string;
  /** Days a portal session lasts (default 7, §8.3). */
  SESSION_DAYS?: string;
  /** Tool calls per agent per minute (default 60, §7.1). */
  AGENT_RATE_PER_MIN?: string;
}

export const SCHEMA = "tradeboard";
/** Claim locks expire after 10 minutes (§9.1 step 9). */
export const CLAIM_TTL_SEC = 600;
/** No heartbeat for over 2 minutes = offline (§7.2). */
export const OFFLINE_AFTER_MS = 120_000;
export const VERSION = "0.1.0";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

// ---------------------------------------------------------------- tokens

/** Prefixes: agent bearer token, executor credential. The portal session is a cookie, never a bearer. */
export const PREFIX = { agent: "tba_", executor: "tbx_" } as const;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix = ""): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return prefix + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

// ---------------------------------------------------------------- secret at rest (AES-GCM)

async function aesKey(env: Env): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(env.TOTP_ENC_KEY ?? ""), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("TOTP_ENC_KEY must be base64 of 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(env: Env, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), new TextEncoder().encode(plain)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

export async function unseal(env: Env, sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !ct) throw new Error("bad sealed value");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------- board setup and policy

export interface PolicyRow {
  policy_version: number;
  policy: Policy;
  created_at: string;
  created_by: string;
  note: string;
}

/**
 * A user's first use of their board: policy v1 (§9.2 defaults), the control row (dry-run on) and one
 * DEMO plan, clearly labelled and dry-run only, so they can click through (§14.7).
 */
export async function ensureBoard(db: Db, userId: string): Promise<void> {
  const { data } = await db.from("policy_versions").select("policy_version").eq("user_id", userId).limit(1);
  if (data?.length) return;
  const { error } = await db.from("policy_versions").insert({ user_id: userId, policy_version: 1, policy: DEFAULT_POLICY, created_by: "system", note: "PRD §9.2 defaults: review every value before live mode" });
  if (error) return; // another request got there first
  await db.from("control").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  await db.rpc("audit", { p_user_id: userId, p_actor_type: "system", p_actor_id: "board", p_action: "board.created", p_plan_id: null, p_details: { policy_version: 1 } });
  const { count } = await db.from("plans").select("plan_id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count) await createDemoPlan(db, userId);
}

export async function createDemoPlan(db: Db, userId: string): Promise<void> {
  const now = new Date();
  const until = suggestedValidUntil(now) ?? new Date(now.getTime() + 24 * 3_600_000);
  const fields = {
    title: "DEMO — dry-run only: buy 1 share on a pullback",
    ticker: "SPY",
    order: { ticker: "SPY", side: "buy", order_type: "limit", quantity_shares: 1, quantity_dollars: null, limit_price: 1, stop_price: null, time_in_force: "day", account_scope: "dedicated_mcp_account_only" },
    thesis: "DEMO plan to click through the board. It can only ever run in dry-run (the board refuses to hand it to a live executor), and its $1 limit price is far from any real quote, so the drift check rejects it even there.",
    evidence: "None: this is a walkthrough. Try commenting, asking a question (it blocks approval), resolving it, marking it ready, approving and rejecting.",
    risks_and_dissent: "Not a real idea. Nothing here is advice.",
    invalidation: "Always invalid outside the demo.",
    valid_until: (until > new Date(now.getTime() + 3_600_000) ? until : new Date(now.getTime() + 24 * 3_600_000)).toISOString(),
    valid_from: null, quote_price: null, quote_at: null, quote_source: null,
  };
  await db.rpc("create_plan", { p_user_id: userId, p_fields: fields, p_actor_type: "human", p_actor_id: "owner", p_idempotency_key: "demo-plan", p_is_demo: true });
}

export async function currentPolicy(db: Db, userId: string): Promise<PolicyRow> {
  await ensureBoard(db, userId);
  const { data } = await db.from("policy_versions").select("*").eq("user_id", userId).order("policy_version", { ascending: false }).limit(1).single();
  const row = data as PolicyRow;
  // Fail closed: a stored policy that doesn't validate is treated as absent by every caller.
  if (checkPolicy(row.policy).length) throw new Error(`policy v${row.policy_version} is invalid`);
  return row;
}

export interface StrategyRow {
  version: number;
  body: string;
  note: string;
  from_proposal: string | null;
  created_at: string;
}

/** The user's adopted strategy (newest version), or null if they haven't written one. */
export async function currentStrategy(db: Db, userId: string): Promise<StrategyRow | null> {
  const { data } = await db.from("strategy_versions").select("version, body, note, from_proposal, created_at").eq("user_id", userId).order("version", { ascending: false }).limit(1);
  return ((data ?? [])[0] as StrategyRow | undefined) ?? null;
}

/** The time rules (§6.5) for every user: expire, stale, approval and claim expiry. Cheap; run on reads and every minute. */
export async function sweep(db: Db): Promise<unknown> {
  const { data } = await db.rpc("sweep", {});
  return data;
}

/** An audit event in the user's log. */
export async function audit(db: Db, userId: string, actorType: string, actorId: string, action: string, planId: string | null, details: Record<string, unknown> = {}) {
  await db.rpc("audit", { p_user_id: userId, p_actor_type: actorType, p_actor_id: actorId, p_action: action, p_plan_id: planId, p_details: details });
}

/** A function's {ok:false,…} result, or a database error, as one shape. */
export interface Failed {
  ok: false;
  error_code: string;
  message: string;
  [k: string]: unknown;
}

export async function rpc<T extends Record<string, unknown>>(db: Db, fn: string, args: Record<string, unknown>): Promise<(T & { ok: true }) | Failed> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    console.error(`rpc ${fn}`, error.message);
    return { ok: false, error_code: "internal", message: "the board couldn't do that: try again" };
  }
  return data as (T & { ok: true }) | Failed;
}

// ---------------------------------------------------------------- responses

export const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
};

/** Structured error (§7.1): error_code + message (+ details), never a stack or internals. */
export const problem = (status: number, error_code: string, message: string, extra: Record<string, unknown> = {}) =>
  json({ error_code, message, ...extra }, status);

export function statusFor(code: string): number {
  if (code === "not_found") return 404;
  if (code === "version_conflict" || code === "already_claimed" || code === "claim_lost") return 409;
  if (code === "internal") return 500;
  return 422;
}

/** Fixed-window rate limit in KV. Returns true when the call is allowed. */
export async function rateLimit(kv: KVNamespace, key: string, limit: number, windowSec: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const k = `rl:${key}:${bucket}`;
  const n = Number((await kv.get(k)) ?? 0);
  if (n >= limit) return false;
  await kv.put(k, String(n + 1), { expirationTtl: Math.max(60, windowSec * 2) });
  return true;
}
