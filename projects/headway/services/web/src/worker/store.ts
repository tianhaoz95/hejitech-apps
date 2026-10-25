// Data access for the Worker: the service-role client on the `headway` schema, tokens (only hashes
// are stored), settings, the realtime snapshot and the tracked train.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSettings, type RealtimeSnapshot, type Settings, type Tracked } from "@headway/core";

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
  /** Secret: a 511.org Open Data token. Without it boards show the timetable only. */
  TRANSIT_511_API_KEY?: string;
  /** Minutes between realtime fetches (511 allows 60 requests an hour per token by default). */
  REALTIME_EVERY_MIN?: string;
  /** APNs token auth: the team, the key's id and the .p8 key (secret). Without them no pushes are sent. */
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY?: string;
  APNS_TOPIC?: string;
}

export const SCHEMA = "headway";
export const PAIRING_CODE_TTL_MS = 10 * 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

// ---------------------------------------------------------------- tokens

/** Token prefixes: assistant (MCP personal access token) and paired glasses. */
export const PREFIX = { agent: "hwa_", device: "hwd_" } as const;

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
  const max = 4_294_000_000; // largest multiple of 1e6 below 2^32
  for (;;) {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    if (n < max) return String(n % 1_000_000).padStart(6, "0");
  }
}

export async function resolveDevice(db: Db, token: string): Promise<{ deviceId: string; userId: string } | null> {
  if (!token.startsWith(PREFIX.device)) return null;
  const { data } = await db.rpc("resolve_device_token", { p_token_hash: await sha256(token) });
  const row = Array.isArray(data) ? (data[0] as { device_id: string; user_id: string } | undefined) : undefined;
  return row ? { deviceId: row.device_id, userId: row.user_id } : null;
}

export async function resolveAgent(db: Db, token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX.agent)) return null;
  const { data } = await db.rpc("resolve_access_token", { p_token_hash: await sha256(token) });
  const row = Array.isArray(data) ? (data[0] as { user_id: string } | undefined) : undefined;
  return row?.user_id ?? null;
}

// ---------------------------------------------------------------- settings

/** The user's settings (defaults until they save some; nothing is stored until then). */
export async function loadSettings(db: Db, userId: string): Promise<{ settings: Settings; saved: boolean }> {
  const { data } = await db.from("profiles").select("settings").eq("user_id", userId).maybeSingle();
  return { settings: normalizeSettings(data?.settings), saved: Boolean(data) };
}

export async function saveSettings(db: Db, userId: string, settings: Settings): Promise<void> {
  const { error } = await db.from("profiles").upsert({ user_id: userId, settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(`couldn't save settings: ${error.message}`);
}

// ---------------------------------------------------------------- realtime

let memo: { at: number; snapshot: RealtimeSnapshot | null } | null = null;
/** Isolates keep the snapshot this long before reading the row again. */
const MEMO_MS = 20_000;

export async function loadSnapshot(db: Db): Promise<RealtimeSnapshot | null> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.snapshot;
  const { data } = await db.from("realtime").select("snapshot").eq("id", 1).maybeSingle();
  const snapshot = (data?.snapshot as RealtimeSnapshot | undefined) ?? null;
  memo = { at: Date.now(), snapshot };
  return snapshot;
}

export async function storeSnapshot(db: Db, snapshot: RealtimeSnapshot, error: string | null): Promise<void> {
  memo = { at: Date.now(), snapshot };
  const { error: e } = await db.from("realtime").upsert({ id: 1, fetched_at: new Date(snapshot.fetched_at).toISOString(), snapshot, error });
  if (e) throw new Error(`couldn't store the snapshot: ${e.message}`);
}

// ---------------------------------------------------------------- tracked train

export async function loadTracked(db: Db, userId: string): Promise<Tracked | null> {
  const { data } = await db.from("tracked_trips").select("trip_id, service_date, from_station, to_station").eq("user_id", userId).maybeSingle();
  return data ? { trip_id: data.trip_id, service_date: data.service_date, from: data.from_station, to: data.to_station } : null;
}

export async function saveTracked(db: Db, userId: string, t: Tracked | null): Promise<void> {
  if (!t) {
    await db.from("tracked_trips").delete().eq("user_id", userId);
    return;
  }
  const { error } = await db.from("tracked_trips").upsert({ user_id: userId, trip_id: t.trip_id, service_date: t.service_date, from_station: t.from, to_station: t.to, created_at: new Date().toISOString() });
  if (error) throw new Error(`couldn't track the train: ${error.message}`);
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
  if (!jwt || jwt.startsWith("hw")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}
