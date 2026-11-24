// Shared Worker data access for Contempo: service-role client on schema `contempo`,
// personal access tokens (`cta_…`), pro_grants, and Supabase session validation.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  ASSETS: Fetcher;
  OAUTH_KV?: KVNamespace;
  OAUTH_PROVIDER?: OAuthHelpers;
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Stripe (billing.ts): HEJI account key, webhook secret, and unified Pro price ids. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ANNUAL?: string;
  STRIPE_PRICE_LIFETIME?: string;
  /** Google Play (play.ts): service account credentials for Play Billing verification. */
  PLAY_SA_EMAIL?: string;
  PLAY_SA_KEY?: string;
  /** Push notifications (push.ts): APNs for iOS, FCM HTTP v1 for Android. */
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY?: string;
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  /** Secrets for the App Review demo account (review.ts). */
  REVIEW_EMAIL?: string;
  REVIEW_PASSWORD_SHA256?: string;
  /** Apple developer team + Sign in with Apple key (apple.ts). */
  APPLE_TEAM_ID?: string;
  APPLE_SIWA_KEY_ID?: string;
  APPLE_SIWA_PRIVATE_KEY?: string;
}

export const SCHEMA = "contempo";
export const BUCKET = "contempo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });
}

export const PREFIX = { agent: "cta_" } as const;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix: string): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return prefix + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function resolveAgent(db: Db, token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX.agent)) return null;
  const { data } = await db.rpc("resolve_access_token", { p_token_hash: await sha256(token) });
  return (Array.isArray(data) ? (data[0] as { user_id: string } | undefined) : undefined)?.user_id ?? null;
}

export async function supabaseUser(env: Env, req: Request): Promise<User | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export interface ProGrant {
  until: string | null;
}

export async function proGrant(db: Db, email: string | undefined, now = Date.now()): Promise<ProGrant | null> {
  if (!email) return null;
  const { data } = await db.from("pro_grants").select("until").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (!data) return null;
  if (data.until && Date.parse(data.until as string) <= now) return null;
  return { until: (data.until as string | null) ?? null };
}

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
}
