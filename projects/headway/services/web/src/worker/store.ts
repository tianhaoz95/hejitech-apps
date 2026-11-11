// Data access for the Worker: the service-role client on the `headway` schema, tokens (only hashes
// are stored), settings, the realtime snapshot and the tracked train.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSettings, type CommuteDone, type OnTrainMatch, type RealtimeSnapshot, type Settings, type Tracked } from "@headway/core";

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
  /** Secret: a 511.org Open Data token. Without it boards show the timetable only. */
  TRANSIT_511_API_KEY?: string;
  /** Minutes between realtime fetches (511 allows 60 requests an hour per token by default). */
  REALTIME_EVERY_MIN?: string;
  /** APNs token auth: the team, the key's id and the .p8 key (secret). Without them no pushes are sent. */
  APNS_TEAM_ID?: string;
  APNS_KEY_ID?: string;
  APNS_PRIVATE_KEY?: string;
  APNS_TOPIC?: string;
  /** Apple developer team; with the two secrets below, account deletion revokes Sign in with Apple tokens (apple.ts). */
  APPLE_TEAM_ID?: string;
  /** Secret: a Sign in with Apple key's id (developer portal → Keys). */
  APPLE_SIWA_KEY_ID?: string;
  /** Secret: that key's .p8 contents. */
  APPLE_SIWA_PRIVATE_KEY?: string;
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

const B62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function randomBase62(len = 9): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let str = "";
  for (let i = 0; i < len; i++) {
    str += B62_CHARS[bytes[i] % 62];
  }
  return str;
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
    await Promise.all([
      db.from("tracked_trips").delete().eq("user_id", userId),
      revokeEtaShares(db, userId),
    ]);
    return;
  }
  const { error } = await db.from("tracked_trips").upsert({ user_id: userId, trip_id: t.trip_id, service_date: t.service_date, from_station: t.from, to_station: t.to, created_at: new Date().toISOString() });
  if (error) throw new Error(`couldn't track the train: ${error.message}`);
}

// ---------------------------------------------------------------- eta shares

export interface EtaShareRow {
  token_hash: string;
  user_id: string;
  trip_id: string;
  service_date: string;
  from_station: string;
  to_station: string;
  name: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export async function createEtaShare(
  db: Db,
  userId: string,
  trip: Tracked,
  name?: string | null,
  publicUrl = "https://headway.hejitech.workers.dev",
  expiresInMs = 4 * 3600_000
): Promise<{ token: string; url: string; expires_at: string }> {
  const token = randomBase62(9);
  const token_hash = await sha256(token);
  const expires_at = new Date(Date.now() + expiresInMs).toISOString();

  const { error } = await db.from("eta_shares").insert({
    token_hash,
    user_id: userId,
    trip_id: trip.trip_id,
    service_date: trip.service_date,
    from_station: trip.from,
    to_station: trip.to,
    name: name?.trim() ? name.trim().slice(0, 20) : null,
    expires_at,
  });
  if (error) throw new Error(`couldn't create eta share: ${error.message}`);
  const base = publicUrl.replace(/\/+$/, "");
  return { token, url: `${base}/eta/${token}`, expires_at };
}

export async function loadEtaShare(db: Db, token: string): Promise<EtaShareRow | null> {
  const token_hash = await sha256(token);
  const now = new Date().toISOString();
  const { data } = await db
    .from("eta_shares")
    .select("token_hash, user_id, trip_id, service_date, from_station, to_station, name, expires_at, revoked_at, created_at")
    .eq("token_hash", token_hash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  return data ?? null;
}

export async function updateEtaShareExpiry(db: Db, tokenHash: string, expiresAt: string): Promise<void> {
  await db.from("eta_shares").update({ expires_at: expiresAt }).eq("token_hash", tokenHash);
}

export async function revokeEtaShares(db: Db, userId: string): Promise<void> {
  await db.from("eta_shares").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
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
export async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string; name?: string } | null> {
  const jwt = bearer(req);
  if (!jwt || jwt.startsWith("hw")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string; user_metadata?: { full_name?: unknown; name?: unknown; given_name?: unknown } };
  const meta = u.user_metadata ?? {};
  const name = [meta.given_name, meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim().length > 0);
  return { id: u.id, email: u.email, name };
}

// ---------------------------------------------------------------- the train you're riding

/** KV, not a table: it lasts one ride, and only ever names the train, never where you are. */
export interface OnTrainSession extends OnTrainMatch {
  /** Headway has tracked this train for you once: stopping it mustn't start it again. */
  auto_tracked?: boolean;
  /** "Not on this train": no card for it (or any other) until then, epoch ms. */
  dismissed_until?: number;
  saved_at: number;
}

const onTrainKey = (userId: string) => `headway:on_train:${userId}`;
/** A session outlives the gap between refreshes, and a ride ends it sooner. */
const ON_TRAIN_TTL_SEC = 30 * 60;

export async function loadOnTrain(env: Env, userId: string): Promise<OnTrainSession | null> {
  const raw = await env.OAUTH_KV.get(onTrainKey(userId));
  try { return raw ? (JSON.parse(raw) as OnTrainSession) : null; } catch { return null; }
}

export async function saveOnTrain(env: Env, userId: string, s: OnTrainSession | null): Promise<void> {
  if (!s) return env.OAUTH_KV.delete(onTrainKey(userId));
  await env.OAUTH_KV.put(onTrainKey(userId), JSON.stringify(s), { expirationTtl: ON_TRAIN_TTL_SEC });
}

// ---------------------------------------------------------------- a commute finished for the day

// KV again: it lasts a day at most and says only which leg is over, never a location.
const commuteDoneKey = (userId: string) => `headway:commute_done:${userId}`;
const lastRideKey = (userId: string) => `headway:last_ride:${userId}`;

export async function loadCommuteDone(env: Env, userId: string): Promise<CommuteDone | null> {
  const raw = await env.OAUTH_KV.get(commuteDoneKey(userId));
  try { return raw ? (JSON.parse(raw) as CommuteDone) : null; } catch { return null; }
}

export async function saveCommuteDone(env: Env, userId: string, d: CommuteDone | null): Promise<void> {
  if (!d) return env.OAUTH_KV.delete(commuteDoneKey(userId));
  await env.OAUTH_KV.put(commuteDoneKey(userId), JSON.stringify(d), { expirationTtl: 24 * 3600 });
}

/** The tracked train that just arrived: tracking clears itself then, a minute before the rider is on the platform. */
export type LastRide = { trip_id: string; to: string };

export async function loadLastRide(env: Env, userId: string): Promise<LastRide | null> {
  const raw = await env.OAUTH_KV.get(lastRideKey(userId));
  try { return raw ? (JSON.parse(raw) as LastRide) : null; } catch { return null; }
}

export async function saveLastRide(env: Env, userId: string, r: LastRide | null): Promise<void> {
  if (!r) return env.OAUTH_KV.delete(lastRideKey(userId));
  await env.OAUTH_KV.put(lastRideKey(userId), JSON.stringify(r), { expirationTtl: 30 * 60 });
}
