// The glasses' API (Even G2 + R1 ring, apps/glasses). The glasses never hold a Supabase session or
// know which Supabase project Wee Hours runs on: a phone gets a pairing code, the glasses trade it
// for a `wh_…` access token named `glasses:<label>` (listed and revoked with the other tokens), and
// every read and write goes through here with the service key.
//
//   POST /api/glasses/pairing-code   Supabase session (the iPhone app): a 6-digit code, valid 10 minutes
//   POST /api/glasses/pair           no auth: trade the code for a device token (throttled per address)
//   GET  /api/glasses/state          device token: household, children, recent events, pending captures
//   POST /api/glasses/events         device token: typed gesture events from the offline outbox
//   POST /api/glasses/captures       device token: one hold-to-speak recording (audio/wav) for a phone
//
// Writes end with a Realtime broadcast `changed` on `weehours:<household>`, so open phones sync at
// once (best effort, as the phones' own pings).

import { SYSTEM_TYPES, validate, type LogEvent } from "@weehours/core";
import type { Db } from "./mcp.ts";

export interface GlassesDeps {
  db: Db;
  kv: KVNamespace;
  supabaseUrl: string;
  serviceKey: string;
  /** The Supabase user behind the request's session token (the phone), or null. */
  sessionUser: (req: Request) => Promise<{ id: string } | null>;
}

const BUCKET = "weehours";
export const PAIRING_CODE_TTL_SEC = 600;
const PAIR_FAILURES_PER_WINDOW = 10;
const PAIR_WINDOW_SEC = 600;
const MAX_EVENTS = 100;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // 16 kHz mono 16-bit: about two minutes
/** The gesture surfaces; anything else isn't the glasses. */
const SURFACES = new Set(["glasses", "ring"]);
/** The system entries a gesture makes; notes, settings, resolutions and photos come from the phone. */
const SYSTEM_FROM_GLASSES = new Set(["undo", "duty"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  // Token auth in a header, no cookies: the plugin's WebView origin varies by host.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Six digits, uniformly (rejection sampling keeps 000000–999999 even). */
export function pairingCode(): string {
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= 4_294_000_000);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

function deviceToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return "wh_" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface Device {
  userId: string;
  householdId: string;
  scope: "read" | "write";
}

async function device(req: Request, db: Db): Promise<Device | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("wh_")) return null;
  const { data } = await db.rpc("resolve_access_token", { p_token: token });
  const row = Array.isArray(data) ? (data[0] as { user_id: string; household_id: string; scope: "read" | "write" } | undefined) : undefined;
  if (!row) return null;
  // Someone who left the household keeps no access through old glasses.
  const { data: member } = await db.from("members").select("user_id").eq("household_id", row.household_id).eq("user_id", row.user_id).maybeSingle();
  return member ? { userId: row.user_id, householdId: row.household_id, scope: row.scope } : null;
}

/** After the response when the runtime allows it (production), else inline (tests). */
async function later(ctx: ExecutionContext | undefined, work: Promise<unknown>) {
  if (ctx) ctx.waitUntil(work);
  else await work;
}

async function broadcastChanged(deps: GlassesDeps, householdId: string) {
  await fetch(`${deps.supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ topic: `weehours:${householdId.toLowerCase()}`, event: "changed", payload: {}, private: false }] }),
  }).catch(() => undefined);
}

interface Child {
  id: string;
  name: string;
  birth_date: string | null;
  settings: Record<string, unknown> | null;
  archived_at: string | null;
}

async function children(db: Db, householdId: string): Promise<Child[]> {
  const { data } = await db.from("babies").select("id, name, birth_date, settings, archived_at").eq("household_id", householdId).order("position").order("created_at");
  return ((data ?? []) as Child[]).filter((c) => !c.archived_at);
}

export async function handleGlasses(req: Request, url: URL, deps: GlassesDeps, ctx?: ExecutionContext): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const { db, kv } = deps;
  const path = url.pathname;

  // ------------------------------------------------------------ the phone asks for a code
  if (path === "/api/glasses/pairing-code" && req.method === "POST") {
    const user = await deps.sessionUser(req);
    if (!user) return reply({ error: "sign in required" }, 401);
    const { data: member } = await db.from("members").select("household_id").eq("user_id", user.id).maybeSingle();
    if (!member) return reply({ error: "set up a household in the app first" }, 403);
    // One live code per person: asking again replaces it.
    const previous = await kv.get(`glasses-code-of:${user.id}`);
    if (previous) await kv.delete(`glasses-code:${previous}`);
    const code = pairingCode();
    const value = JSON.stringify({ user_id: user.id, household_id: member.household_id });
    await kv.put(`glasses-code:${await sha256(code)}`, value, { expirationTtl: PAIRING_CODE_TTL_SEC });
    await kv.put(`glasses-code-of:${user.id}`, await sha256(code), { expirationTtl: PAIRING_CODE_TTL_SEC });
    return reply({ code, expires_at: new Date(Date.now() + PAIRING_CODE_TTL_SEC * 1000).toISOString() });
  }

  // ------------------------------------------------------------ the glasses trade it for a token
  if (path === "/api/glasses/pair" && req.method === "POST") {
    const ip = req.headers.get("CF-Connecting-IP") ?? "local";
    const failKey = `glasses-pairfail:${ip}`;
    const failures = Number((await kv.get(failKey)) ?? 0);
    if (failures >= PAIR_FAILURES_PER_WINDOW) return reply({ error: "Too many wrong codes. Wait ten minutes, then get a new code on your phone." }, 429);
    const body = (await req.json().catch(() => ({}))) as { code?: unknown; label?: unknown };
    const code = String(body.code ?? "").replace(/\D/g, "");
    const key = `glasses-code:${await sha256(code)}`;
    const raw = code.length === 6 ? await kv.get(key) : null;
    if (!raw) {
      await kv.put(failKey, String(failures + 1), { expirationTtl: PAIR_WINDOW_SEC });
      return reply({ error: "That code didn't work. Codes last ten minutes: get a new one in Wee Hours → Settings → Even G2 glasses." }, 400);
    }
    await kv.delete(key);
    const { user_id, household_id } = JSON.parse(raw) as { user_id: string; household_id: string };
    const { data: member } = await db.from("members").select("user_id").eq("household_id", household_id).eq("user_id", user_id).maybeSingle();
    if (!member) return reply({ error: "This account isn't in that household any more." }, 403);
    const label = String(body.label ?? "").trim().slice(0, 40) || "Even G2";
    const token = deviceToken();
    const { error } = await db.from("access_tokens").insert({ user_id, household_id, name: `glasses:${label}`, scope: "write", token_hash: await sha256(token) });
    if (error) return reply({ error: "couldn't pair, try again" }, 500);
    const { data: h } = await db.from("households").select("name").eq("id", household_id).maybeSingle();
    return reply({ token, household: { id: household_id, name: (h?.name as string | undefined) ?? "" } });
  }

  if (!path.startsWith("/api/glasses/")) return reply({ error: "not found" }, 404);
  const who = await device(req, db);
  if (!who) return reply({ error: "These glasses aren't paired any more: pair them again from Wee Hours → Settings." }, 401);

  // ------------------------------------------------------------ what the HUD shows
  if (path === "/api/glasses/state" && req.method === "GET") {
    const [{ data: h }, kids, { data: me }] = await Promise.all([
      db.from("households").select("id, name, settings").eq("id", who.householdId).maybeSingle(),
      children(db, who.householdId),
      db.from("members").select("display_name").eq("household_id", who.householdId).eq("user_id", who.userId).maybeSingle(),
    ]);
    if (!h) return reply({ error: "household not found" }, 404);
    const days = Math.min(7, Math.max(1, Number(url.searchParams.get("days") ?? 3)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [{ data: events }, { count }] = await Promise.all([
      db.from("events").select("*").eq("household_id", who.householdId).or(`occurred_at.gte.${since},logged_at.gte.${since}`).order("seq").limit(2000),
      db.from("captures").select("id", { count: "exact", head: true }).eq("household_id", who.householdId).eq("status", "pending"),
    ]);
    const settings = (h.settings ?? {}) as Record<string, unknown>;
    return reply({
      me: { id: who.userId, name: (me?.display_name as string | undefined) ?? null },
      household: { id: h.id, name: h.name, default_feed: settings.default_feed ?? "bottle" },
      children: kids.map((c) => ({
        id: c.id,
        name: c.name,
        default_feed: c.settings?.default_feed ?? null,
        expected: !c.birth_date && Boolean(c.settings?.due_date),
      })),
      events: events ?? [],
      pending_captures: count ?? 0,
      write: who.scope === "write",
    });
  }

  if (who.scope !== "write") return reply({ error: "this token is read-only" }, 403);

  // ------------------------------------------------------------ gesture events
  if (path === "/api/glasses/events" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { events?: unknown } | null;
    const list = Array.isArray(body?.events) ? (body!.events as Record<string, unknown>[]) : null;
    if (!list || list.length > MAX_EVENTS) return reply({ error: `send {"events": [...]} with at most ${MAX_EVENTS}` }, 400);
    const kids = await children(db, who.householdId);
    const rows: LogEvent[] = [];
    const rejected: { id: unknown; error: string }[] = [];
    for (const e of list) {
      const problem = checkEvent(e, kids);
      if (problem) { rejected.push({ id: e?.id, error: problem }); continue; }
      const surface = String((e.provenance as Record<string, unknown> | undefined)?.surface ?? "glasses");
      rows.push({
        id: String(e.id), household_id: who.householdId, baby_id: String(e.baby_id ?? kids[0]?.id), type: String(e.type),
        fields: (e.fields ?? {}) as LogEvent["fields"], occurred_at: String(e.occurred_at), logged_at: String(e.logged_at ?? e.occurred_at),
        logged_by: who.userId, provenance: { surface: SURFACES.has(surface) ? surface : "glasses", input: "gesture" },
        supersedes: (e.supersedes as string | null | undefined) ?? null,
      } as LogEvent);
    }
    if (rows.length) {
      const { error } = await db.from("events").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) return reply({ error: error.message }, 500);
      await later(ctx, broadcastChanged(deps, who.householdId));
    }
    return reply({ accepted: rows.map((r) => r.id), rejected });
  }

  // ------------------------------------------------------------ hold-to-speak capture
  if (path === "/api/glasses/captures" && req.method === "POST") {
    const q = url.searchParams;
    const id = q.get("id") ?? "";
    const surface = q.get("surface") ?? "glasses";
    const capturedAt = q.get("captured_at") ?? new Date().toISOString();
    const attachTo = q.get("attach_to");
    const baby = q.get("baby_id");
    if (!UUID.test(id)) return reply({ error: "id must be a uuid" }, 400);
    if (!SURFACES.has(surface)) return reply({ error: "surface must be glasses or ring" }, 400);
    if (Number.isNaN(Date.parse(capturedAt))) return reply({ error: "captured_at must be a timestamp" }, 400);
    if (attachTo && !UUID.test(attachTo)) return reply({ error: "attach_to must be a uuid" }, 400);
    const audio = await req.arrayBuffer();
    if (audio.byteLength < 44 || audio.byteLength > MAX_AUDIO_BYTES) return reply({ error: "audio must be a WAV file up to 4 MB" }, 400);
    if (baby && !(await children(db, who.householdId)).some((c) => c.id === baby)) return reply({ error: "unknown child" }, 400);
    const audioPath = `${who.householdId}/${id}.wav`;
    const up = await db.storage.from(BUCKET).upload(audioPath, audio, { contentType: "audio/wav", upsert: true });
    if (up.error) return reply({ error: up.error.message }, 500);
    const row: Record<string, unknown> = {
      id, household_id: who.householdId, surface, captured_at: capturedAt, logged_by: who.userId,
      audio_path: audioPath, attach_to: attachTo, status: "pending",
    };
    if (baby) row.baby_id = baby;
    const { error } = await db.from("captures").upsert(row, { onConflict: "id", ignoreDuplicates: true });
    if (error) return reply({ error: error.message }, 500);
    await later(ctx, broadcastChanged(deps, who.householdId));
    return reply({ ok: true, id });
  }

  return reply({ error: "not found" }, 404);
}

/** Why one outbox event can't be stored, or null. A rejected event is dropped by the glasses, not retried. */
export function checkEvent(e: Record<string, unknown> | null | undefined, kids: { id: string }[]): string | null {
  if (!e || typeof e !== "object") return "not an object";
  if (typeof e.id !== "string" || !UUID.test(e.id)) return "id must be a uuid";
  if (typeof e.type !== "string") return "type missing";
  if (SYSTEM_TYPES.has(e.type) && !SYSTEM_FROM_GLASSES.has(e.type)) return `${e.type} entries come from the phone`;
  if (typeof e.occurred_at !== "string" || Number.isNaN(Date.parse(e.occurred_at))) return "occurred_at must be a timestamp";
  if (e.logged_at !== undefined && (typeof e.logged_at !== "string" || Number.isNaN(Date.parse(e.logged_at)))) return "logged_at must be a timestamp";
  if (e.supersedes != null && (typeof e.supersedes !== "string" || !UUID.test(e.supersedes))) return "supersedes must be a uuid";
  if (e.type === "undo" && !e.supersedes) return "undo needs supersedes";
  const fields = (e.fields ?? {}) as Record<string, string | number | boolean>;
  if (typeof fields !== "object" || Array.isArray(fields)) return "fields must be an object";
  if (!kids.length) return "this household has no children yet";
  if (e.baby_id != null && !kids.some((k) => k.id === e.baby_id)) return "unknown child";
  return validate(e.type, fields);
}
