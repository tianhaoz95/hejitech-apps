// Data access for the Worker: the service-role client on the `g2digest` schema, tokens (only
// hashes are stored), the brief as one §3.2 document (profile + brief rows), editions and audio.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canonical, checkBrief, starterBrief, type Brief, type Bundle, type Issue } from "@g2digest/core";

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

export const SCHEMA = "g2digest";
export const BUCKET = "g2digest";
/** Signed audio links last long enough for an offline commute after the last fetch. */
export const AUDIO_URL_TTL_SEC = 3 * 86400;
export const PAIRING_CODE_TTL_MS = 10 * 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

// ---------------------------------------------------------------- tokens

/** Token prefixes: agent (MCP personal access token), glasses device, podcast feed. */
export const PREFIX = { agent: "g2a_", device: "g2d_", feed: "g2f_" } as const;

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

export async function resolveDevice(db: Db, token: string): Promise<{ deviceId: string; userId: string; kind: "glasses" | "feed" } | null> {
  if (!token.startsWith(PREFIX.device) && !token.startsWith(PREFIX.feed)) return null;
  const { data } = await db.rpc("resolve_device_token", { p_token_hash: await sha256(token) });
  const row = Array.isArray(data) ? (data[0] as { device_id: string; user_id: string; kind: "glasses" | "feed" } | undefined) : undefined;
  if (!row) return null;
  if ((row.kind === "feed") !== token.startsWith(PREFIX.feed)) return null;
  return { deviceId: row.device_id, userId: row.user_id, kind: row.kind };
}

// ---------------------------------------------------------------- brief

const PROFILE_KEYS = ["language", "units", "glossary", "no_gloss", "delivery"] as const;

/** The user's brief as one §3.2 document. A user's first visit stores the starter brief. */
export async function loadBrief(db: Db, userId: string): Promise<{ brief: Brief; brief_version: number }> {
  const [{ data: p }, { data: b }] = await Promise.all([
    db.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("briefs").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!p || !b) {
    const starter = starterBrief();
    await saveBrief(db, userId, starter, null);
    return { brief: starter, brief_version: 1 };
  }
  const brief = { ...(b.config as Omit<Brief, (typeof PROFILE_KEYS)[number]>) } as Brief;
  for (const k of PROFILE_KEYS) (brief as unknown as Record<string, unknown>)[k] = p[k];
  return { brief, brief_version: b.brief_version as number };
}

export class Conflict extends Error {}

/**
 * Saves a checked brief. `expected` is the version the editor loaded (null: first save); a
 * different stored version means someone else saved in between. Any change bumps the version.
 */
export async function saveBrief(db: Db, userId: string, brief: Brief, expected: number | null): Promise<{ brief_version: number; changed: boolean; issues: Issue[] }> {
  const issues = checkBrief(brief);
  if (issues.length) return { brief_version: expected ?? 0, changed: false, issues };
  const profile = Object.fromEntries(PROFILE_KEYS.map((k) => [k, brief[k]]));
  const config = Object.fromEntries(Object.entries(brief).filter(([k]) => !(PROFILE_KEYS as readonly string[]).includes(k)));
  const { data: current } = await db.from("briefs").select("brief_version, config").eq("user_id", userId).maybeSingle();
  if (!current) {
    await db.from("profiles").upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() });
    const { error } = await db.from("briefs").insert({ user_id: userId, brief_version: 1, config });
    if (error) throw new Conflict("the brief was created elsewhere: reload");
    return { brief_version: 1, changed: true, issues: [] };
  }
  if (expected !== null && current.brief_version !== expected) throw new Conflict(`the brief changed elsewhere (now version ${current.brief_version}): reload`);
  const before = (await loadBrief(db, userId)).brief;
  if (canonical(before) === canonical(brief)) return { brief_version: current.brief_version, changed: false, issues: [] };
  const next = current.brief_version + 1;
  // Optimistic: only bump from the version we read.
  const { data: bumped } = await db.from("briefs").update({ brief_version: next, config, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("brief_version", current.brief_version).select("brief_version");
  if (!bumped?.length) throw new Conflict("the brief changed elsewhere: reload");
  await db.from("profiles").upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() });
  return { brief_version: next, changed: true, issues: [] };
}

// ---------------------------------------------------------------- editions and audio

export interface EditionRow {
  id: string;
  date: string;
  title: string;
  guide_version: string;
  brief_version: number;
  total_cards: number;
  total_audio_sec: number;
  bundle: Bundle;
  preview_snapshot: string;
  published_at: string;
}

export async function getEdition(db: Db, userId: string, date: string | "latest"): Promise<EditionRow | null> {
  let q = db.from("editions").select("id, date, title, guide_version, brief_version, total_cards, total_audio_sec, bundle, preview_snapshot, published_at").eq("user_id", userId);
  q = date === "latest" ? q.order("date", { ascending: false }).limit(1) : q.eq("date", date).limit(1);
  const { data } = await q;
  return ((data ?? [])[0] as EditionRow | undefined) ?? null;
}

export async function listEditions(db: Db, userId: string, limit = 60) {
  const { data } = await db.from("editions").select("date, title, total_cards, total_audio_sec, published_at").eq("user_id", userId).order("date", { ascending: false }).limit(limit);
  return data ?? [];
}

/** How many editions a user keeps; publishing an 11th deletes the oldest (by date) to save space. */
export const KEEP_EDITIONS = 10;

/**
 * Deletes every edition past the newest `keep` (cards cascade) and the audio only those editions
 * used. Audio a kept edition still points at (a carried card plays an earlier date's file) stays.
 */
export async function pruneEditions(db: Db, userId: string, keep = KEEP_EDITIONS): Promise<string[]> {
  const { data } = await db.from("editions").select("id, date, bundle").eq("user_id", userId).order("date", { ascending: false });
  const rows = (data ?? []) as { id: string; date: string; bundle: Bundle }[];
  const old = rows.slice(keep);
  if (!old.length) return [];
  const inUse = new Set(rows.slice(0, keep).flatMap((r) => r.bundle.cards.flatMap((c) => [c.glance?.audio_path, c.deep_dive?.audio_path])).filter(Boolean));
  const bucket = db.storage.from(BUCKET);
  for (const r of old) {
    const { data: files } = await bucket.list(`${userId}/${r.date}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${r.date}/${f.name}`).filter((p) => !inUse.has(p)).map((p) => `${userId}/${p}`);
    if (paths.length) await bucket.remove(paths);
  }
  const { error } = await db.from("editions").delete().eq("user_id", userId).in("id", old.map((r) => r.id));
  if (error) throw new Error(`prune editions: ${error.message}`);
  return old.map((r) => r.date);
}

/** Signed URLs for every audio file of a bundle, keyed by its audio_path. */
export async function signedAudio(db: Db, userId: string, bundle: Bundle, ttl = AUDIO_URL_TTL_SEC): Promise<Record<string, string>> {
  const paths = [...new Set(bundle.cards.flatMap((c) => [c.glance?.audio_path, c.deep_dive?.audio_path]).filter((p): p is string => Boolean(p)))];
  if (!paths.length) return {};
  const { data } = await db.storage.from(BUCKET).createSignedUrls(paths.map((p) => `${userId}/${p}`), ttl);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.signedUrl && row.path) out[row.path.slice(userId.length + 1)] = row.signedUrl;
  return out;
}

/** The audio files present for some dates (relative paths `<date>/<file>`). */
export async function uploadedAudio(db: Db, userId: string, dates: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (const d of [...new Set(dates)]) {
    const { data } = await db.storage.from(BUCKET).list(`${userId}/${d}`, { limit: 1000 });
    for (const f of data ?? []) out.add(`${d}/${f.name}`);
  }
  return out;
}

export const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
};

/** The Supabase user behind a session access token (from the site's supabase-js), or null. */
export async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string } | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt.startsWith("g2")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}

/**
 * Deletes everything G2 Digest holds for a user: audio files, editions and cards, brief, profile,
 * devices, feeds, agent tokens and pairing codes. The sign-in itself is a HEJI account shared with
 * the other apps, so it stays (the privacy policy says to email for that).
 */
export async function deleteUserData(db: Db, userId: string): Promise<void> {
  const bucket = db.storage.from(BUCKET);
  const { data: dates } = await bucket.list(userId, { limit: 1000 });
  for (const d of dates ?? []) {
    const { data: files } = await bucket.list(`${userId}/${d.name}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${d.name}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  for (const table of ["cards", "editions", "pairing_codes", "device_tokens", "access_tokens", "briefs", "profiles"]) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  }
}
