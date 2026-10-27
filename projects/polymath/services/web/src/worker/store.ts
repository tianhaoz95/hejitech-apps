import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OAUTH_KV: KVNamespace;
  ASSETS?: Fetcher;
}

export const PREFIX = "plt_";
export const SCHEMA = "polymath";

export type Db = SupabaseClient<any, any, any>;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function admin(env: Env): Db {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  });
}

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function resolveAgent(
  env: Env,
  token: string
): Promise<{ tokenId: string; userId: string } | null> {
  if (!token.startsWith(PREFIX)) return null;
  const hash = await hashToken(token);
  const client = admin(env);
  const { data, error } = await client.rpc("resolve_access_token", { p_token_hash: hash });
  if (error || !data || !data.length) return null;
  return { tokenId: data[0].token_id, userId: data[0].user_id };
}

export async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email };
}
