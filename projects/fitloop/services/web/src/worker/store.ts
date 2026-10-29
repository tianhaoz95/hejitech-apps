// Data access for the Worker: the service-role client on the `fitloop` schema, tokens (only hashes
// are stored), settings, plan versions, check-ins and the shapes the API and MCP return.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dayState, normalizeSettings, type Checkin, type Feedback, type Plan, type PublishedPlan, type Settings } from "@fitloop/core";

export interface Env {
  OAUTH_KV: KVNamespace;
  ASSETS: Fetcher;
  /** This site's origin; the MCP resource is `${PUBLIC_URL}/mcp`. */
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  /** Publishable (anon) key: validates users' Supabase sessions. */
  SUPABASE_ANON_KEY: string;
  /** Secret. Server-side only; bypasses RLS for every project in the shared Supabase project. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Secrets for the App Review demo account (review.ts): its email and SHA-256 of its password. */
  REVIEW_EMAIL?: string;
  REVIEW_PASSWORD_SHA256?: string;
}

export const SCHEMA = "fitloop";
export const BUCKET = "fitloop";
export const PAIRING_CODE_TTL_MS = 10 * 60_000;
/** Live heart rate older than this isn't shown. */
export const LIVE_MAX_AGE_MS = 20_000;
export const PHOTO_URL_TTL_SEC = 3600;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

// ---------------------------------------------------------------- tokens

/** Token prefixes: agent (MCP personal access token) and paired glasses. */
export const PREFIX = { agent: "fla_", device: "fld_" } as const;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix: string): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return prefix + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Six digits, uniformly random (rejection sampling). */
export function pairingCode(): string {
  const max = 4_294_000_000;
  for (;;) {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    if (n < max) return String(n % 1_000_000).padStart(6, "0");
  }
}

export async function resolveDevice(db: Db, token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX.device)) return null;
  const { data } = await db.rpc("resolve_device_token", { p_token_hash: await sha256(token) });
  return (Array.isArray(data) ? (data[0] as { user_id: string } | undefined) : undefined)?.user_id ?? null;
}

export async function resolveAgent(db: Db, token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX.agent)) return null;
  const { data } = await db.rpc("resolve_access_token", { p_token_hash: await sha256(token) });
  return (Array.isArray(data) ? (data[0] as { user_id: string } | undefined) : undefined)?.user_id ?? null;
}

// ---------------------------------------------------------------- settings

export async function loadSettings(db: Db, userId: string): Promise<{ settings: Settings; saved: boolean }> {
  const { data } = await db.from("profiles").select("settings").eq("user_id", userId).maybeSingle();
  return { settings: normalizeSettings(data?.settings), saved: Boolean(data) };
}

export async function saveSettings(db: Db, userId: string, settings: Settings): Promise<void> {
  const { error } = await db.from("profiles").upsert({ user_id: userId, settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(`couldn't save settings: ${error.message}`);
}

// ---------------------------------------------------------------- plans

interface PlanRow {
  version: number;
  plan: Plan;
  change_note: string;
  starts_on: string;
  published_at: string;
}

/** Recent plan versions, newest first (enough to cover any date a client asks about). */
export async function planVersions(db: Db, userId: string, limit = 30): Promise<PlanRow[]> {
  const { data } = await db.from("plans").select("version, plan, change_note, starts_on, published_at").eq("user_id", userId).order("version", { ascending: false }).limit(limit);
  return (data ?? []) as PlanRow[];
}

/** The version in force on a date: the newest one that had started by then. */
export function planOn(rows: PlanRow[], date: string): PlanRow | null {
  return rows.find((r) => r.starts_on <= date) ?? null;
}

export const published = (r: PlanRow): PublishedPlan => ({ version: r.version, plan: r.plan, change_note: r.change_note, published_at: r.published_at });

/** Each version with the dates it governed (for adherence across versions). */
export function planSpans(rows: PlanRow[]): { plan: Plan; from: string; to?: string }[] {
  const asc = [...rows].sort((a, b) => a.version - b.version);
  return asc.map((r, i) => {
    const later = asc.slice(i + 1).map((x) => x.starts_on).filter((d) => d > r.starts_on).sort()[0];
    return { plan: r.plan, from: r.starts_on, to: later ? prevDay(later) : undefined };
  });
}

const prevDay = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 86400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- check-ins, feedback

export async function checkinsBetween(db: Db, userId: string, from: string, to: string): Promise<Checkin[]> {
  const { data } = await db.from("checkins").select("date, ref, kind, status, plan_version, data, note, source, at").eq("user_id", userId).gte("date", from).lte("date", to).order("at").limit(5000);
  return (data ?? []) as Checkin[];
}

export async function feedbackList(db: Db, userId: string, status: "open" | "addressed" | "all" = "all", limit = 200): Promise<Feedback[]> {
  let q = db.from("feedback").select("id, date, ref, plan_version, text, tags, status, agent_reply, created_at, addressed_at, source").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as Feedback[];
}

// ---------------------------------------------------------------- http

export const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
};

export const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

/** The Supabase user behind a session access token (the site's supabase-js or the iPhone app), or null. */
export async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string } | null> {
  const jwt = bearer(req);
  if (!jwt || jwt.startsWith("fl")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}

/** Everything a check-in surface needs for one date (the glasses, the phone, the web Today page). */
export async function today(db: Db, userId: string, date: string) {
  const [rows, checkins, live, { settings }] = await Promise.all([
    planVersions(db, userId),
    checkinsBetween(db, userId, date, date),
    db.from("live").select("hr, workout_ref, updated_at").eq("user_id", userId).maybeSingle(),
    loadSettings(db, userId),
  ]);
  const row = planOn(rows, date);
  const fresh = live.data && Date.now() - Date.parse(live.data.updated_at) < LIVE_MAX_AGE_MS;
  return {
    date,
    plan: row ? { version: row.version, title: row.plan.title, change_note: row.change_note, published_at: row.published_at, targets: row.plan.targets ?? null } : null,
    /** The day's plan with each item's state (sets done, meal status) and nutrition so far. */
    state: dayState(row?.plan ?? null, date, checkins),
    checkins,
    live: fresh && settings.vitals.live_hr ? { hr: live.data!.hr, workout_ref: live.data!.workout_ref } : null,
    glasses: settings.glasses,
  };
}
