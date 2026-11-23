// Shared plumbing for the Folio Worker: environment, the service-role client on the `folio`
// schema, JSON replies, Supabase sessions and agent tokens (only SHA-256 hashes are stored).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  /** Optional secret for signing render links; derived from the service key when unset. */
  RENDER_SECRET?: string;
  /** iPhone notifications (secrets; the team's APNs key). Unset: nothing is sent. */
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY?: string;
  /** Bundle id the pushes are for (default com.hejitech.folio). */
  APNS_TOPIC?: string;
  /** Local tests only: send pushes to this receiver instead of Apple. */
  APNS_HOST?: string;
  /** App Review's demo account (secrets; scripts/review_account.sh folio). */
  REVIEW_EMAIL?: string;
  REVIEW_PASSWORD_SHA256?: string;
  /** Folio Pro on the web (secrets; scripts/stripe_pro.mjs folio). Unset: the web sells nothing. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ANNUAL?: string;
  STRIPE_PRICE_LIFETIME?: string;
  /** Cloudflare Browser Rendering: screenshots for link previews (og.ts). Unset: a plain card. */
  BROWSER?: Fetcher;
}

export const SCHEMA = "folio";
export const BUCKET = "folio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });
}

/** Token prefixes: agent personal access tokens and share-link invites. */
export const PREFIX = { agent: "fol_", invite: "fiv_" } as const;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix: string, bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return prefix + b64url(b);
}

export function b64url(b: Uint8Array | ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function resolveAgentToken(db: Db, token: string): Promise<{ userId: string; name: string } | null> {
  if (!token.startsWith(PREFIX.agent)) return null;
  const { data } = await db.rpc("resolve_access_token", { p_token_hash: await sha256(token) });
  const row = Array.isArray(data) ? (data[0] as { user_id: string; name: string } | undefined) : undefined;
  return row ? { userId: row.user_id, name: row.name } : null;
}

export const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
};

export const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

export interface SessionUser {
  id: string;
  email?: string;
}

/** The signed-in person behind a Supabase session token (the web app), or null. */
export async function supabaseUser(env: Env, req: Request): Promise<SessionUser | null> {
  const jwt = bearer(req);
  if (!jwt || jwt.startsWith(PREFIX.agent)) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}

/** Looks up people's emails (members lists, "shared by"). Service role only. */
export async function emailsFor(db: Db, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    [...new Set(ids.filter(Boolean))].map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      if (data?.user?.email) out[id] = data.user.email;
    })
  );
  return out;
}

/** Pro given by email (scripts/grant_pro.sh folio), or null. */
export async function proGrant(db: Db, email: string | undefined, now = Date.now()): Promise<{ until: string | null } | null> {
  if (!email) return null;
  const { data } = await db.from("pro_grants").select("until").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (!data || (data.until && Date.parse(data.until) <= now)) return null;
  return { until: data.until ?? null };
}
