// Data access for the Worker: the service-role client on the `icecap` schema and the signed-in user.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  ASSETS: Fetcher;
  /** This site's origin (Stripe's return URLs). */
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  /** Publishable (anon) key: validates users' Supabase sessions. */
  SUPABASE_ANON_KEY: string;
  /** Secret. Server-side only; bypasses RLS for every project in the shared Supabase project. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Stripe (billing.ts): the HEJI account's secret key and this Worker's webhook secret (secrets), the two price ids (vars). */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ANNUAL?: string;
  STRIPE_PRICE_LIFETIME?: string;
}

export const SCHEMA = "icecap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

/** The user behind `Authorization: Bearer <Supabase access token>`, or null. */
export async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string } | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}

/** Pro given by email (scripts/grant_pro.sh, the admin page). */
export async function proGrant(db: Db, email: string | undefined, now = Date.now()): Promise<{ until: string | null } | null> {
  if (!email) return null;
  const { data } = await db.from("pro_grants").select("until").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (!data || (data.until && Date.parse(data.until) <= now)) return null;
  return { until: data.until ?? null };
}

export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

/**
 * Deletes everything Icecap holds for a user: saved deals and settings. The sign-in is a HEJI account
 * shared with the other apps, so it stays (the privacy policy says to email for that); purchase records
 * stay as the account's billing history.
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  for (const table of ["properties", "settings"]) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validEmail = (e: unknown): e is string => typeof e === "string" && e.length >= 6 && e.length <= 255 && EMAIL.test(e);
