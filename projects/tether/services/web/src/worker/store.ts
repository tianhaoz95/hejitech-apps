// Data access for the Tether Worker: service-role client on the `tether` schema, tokens (only SHA-256
// hashes are stored), workspace pane tree, non-secret SSH host metadata, and bookmarks.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createDefaultTree,
  normalizeSettings,
  normalizeSshHost,
  validatePaneTree,
  type Bookmark,
  type PaneTree,
  type SshHost,
  type TetherSettings,
  type WorkspaceSnapshot,
} from "@tether/core";

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
}

export const SCHEMA = "tether";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: SCHEMA },
  });
}

/** Token prefix for assistant MCP personal access tokens. */
export const PREFIX = { agent: "ttr_" } as const;

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
  const row = Array.isArray(data) ? (data[0] as { user_id: string } | undefined) : undefined;
  return row?.user_id ?? null;
}

export async function loadWorkspace(db: Db, userId: string): Promise<WorkspaceSnapshot & { saved: boolean }> {
  const [{ data: ws }, { data: hostRows }, { data: bmRows }] = await Promise.all([
    db.from("workspaces").select("tree, settings, updated_at").eq("user_id", userId).maybeSingle(),
    db.from("hosts").select("*").eq("user_id", userId).order("created_at"),
    db.from("bookmarks").select("*").eq("user_id", userId).order("created_at"),
  ]);

  const rawTree = ws?.tree as PaneTree | undefined;
  const tree = rawTree && validatePaneTree(rawTree).length === 0 ? rawTree : createDefaultTree();
  const settings = normalizeSettings(ws?.settings as Partial<TetherSettings> | undefined);

  const hosts: SshHost[] = (hostRows ?? []).map((r: Record<string, unknown>) =>
    normalizeSshHost({
      id: String(r.id),
      label: r.label ? String(r.label) : undefined,
      host: String(r.host),
      port: Number(r.port ?? 22),
      username: String(r.username),
      auth: r.auth as SshHost["auth"],
      keyId: r.key_id ? String(r.key_id) : undefined,
      rememberPassword: Boolean(r.remember_password),
      autoReconnectOnDisplayReconnect: Boolean(r.auto_reconnect_on_display_reconnect),
    })
  );

  const bookmarks: Bookmark[] = (bmRows ?? []).map((b: Record<string, unknown>) => ({
    id: String(b.id),
    title: String(b.title),
    url: String(b.url),
    createdAt: String(b.created_at),
  }));

  return {
    tree,
    settings,
    hosts,
    bookmarks,
    updatedAt: ws?.updated_at ? String(ws.updated_at) : new Date().toISOString(),
    saved: Boolean(ws),
  };
}

export async function saveWorkspaceTreeAndSettings(
  db: Db,
  userId: string,
  tree: PaneTree,
  settings: TetherSettings
): Promise<void> {
  const { error } = await db.from("workspaces").upsert({
    user_id: userId,
    tree,
    settings,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`couldn't save workspace: ${error.message}`);
}

export async function upsertHost(db: Db, userId: string, host: SshHost): Promise<void> {
  const { error } = await db.from("hosts").upsert({
    user_id: userId,
    id: host.id,
    label: host.label ?? null,
    host: host.host,
    port: host.port,
    username: host.username,
    auth: host.auth,
    key_id: host.keyId ?? null,
    remember_password: Boolean(host.rememberPassword),
    auto_reconnect_on_display_reconnect: Boolean(host.autoReconnectOnDisplayReconnect),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`couldn't save host: ${error.message}`);
}

export async function deleteHost(db: Db, userId: string, hostId: string): Promise<void> {
  const { error } = await db.from("hosts").delete().eq("user_id", userId).eq("id", hostId);
  if (error) throw new Error(`couldn't delete host: ${error.message}`);
}

export async function upsertBookmark(db: Db, userId: string, bm: { id: string; title: string; url: string }): Promise<void> {
  const { error } = await db.from("bookmarks").upsert({
    user_id: userId,
    id: bm.id,
    title: bm.title.trim().slice(0, 140),
    url: bm.url.trim(),
  });
  if (error) throw new Error(`couldn't save bookmark: ${error.message}`);
}

export async function deleteBookmark(db: Db, userId: string, bookmarkId: string): Promise<void> {
  const { error } = await db.from("bookmarks").delete().eq("user_id", userId).eq("id", bookmarkId);
  if (error) throw new Error(`couldn't delete bookmark: ${error.message}`);
}

export const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
};

export const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

export async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string } | null> {
  const jwt = bearer(req);
  if (!jwt || jwt.startsWith("ttr_")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}
