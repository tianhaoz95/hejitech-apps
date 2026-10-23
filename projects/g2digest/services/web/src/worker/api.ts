// The web app's and the plugin's API (/api/*) and the private podcast feed (/feed/*).
//
// Who may call what:
//   Supabase session (web app)   brief read/edit, pairing codes, devices, feeds, agent tokens, editions
//   device token g2d_… (plugin)  editions only (read-only, one user's), and /api/device to check pairing
//   none                         POST /api/pair: trade a 6-digit code for a device token (throttled)
//   feed token g2f_… in the URL  /feed/<token>/podcast.xml and its audio (podcast apps can't send headers)
import { checkBrief, type Brief } from "@g2digest/core";
import {
  admin, Conflict, getEdition, json, listEditions, loadBrief, pairingCode, PAIRING_CODE_TTL_MS, PREFIX, randomToken,
  resolveDevice, saveBrief, sha256, signedAudio, supabaseUser, type Db, type Env,
} from "./store.ts";
import { podcastFeed } from "./feed.ts";

const PAIR_FAILURES_PER_WINDOW = 10;
const PAIR_WINDOW_SEC = 600;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const reply = (body: unknown, status = 200) => json(body, status, cors);

type Caller = { userId: string; via: "session" | "device"; email?: string };

async function caller(env: Env, db: Db, req: Request): Promise<Caller | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token.startsWith(PREFIX.device)) {
    const d = await resolveDevice(db, token);
    return d && d.kind === "glasses" ? { userId: d.userId, via: "device" } : null;
  }
  const u = await supabaseUser(env, req);
  return u ? { userId: u.id, via: "session", email: u.email } : null;
}

async function editionResponse(db: Db, userId: string, date: string) {
  const e = await getEdition(db, userId, date === "latest" ? "latest" : date);
  if (!e) return reply({ error: date === "latest" ? "no edition published yet" : `no edition for ${date}` }, 404);
  return reply({
    date: e.date, title: e.title, published_at: e.published_at, guide_version: e.guide_version, brief_version: e.brief_version,
    bundle: e.bundle, audio: await signedAudio(db, userId, e.bundle), preview_snapshot: e.preview_snapshot,
  });
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin(env);
  const path = url.pathname;

  // ------------------------------------------------------------ pairing (no auth)
  if (path === "/api/pair" && req.method === "POST") {
    const ip = req.headers.get("CF-Connecting-IP") ?? "local";
    const key = `pairfail:${ip}`;
    const failures = Number((await env.OAUTH_KV.get(key)) ?? 0);
    if (failures >= PAIR_FAILURES_PER_WINDOW) return reply({ error: "too many wrong codes: wait ten minutes and get a new code" }, 429);
    const body = (await req.json().catch(() => ({}))) as { code?: unknown; label?: unknown };
    const code = String(body.code ?? "").replace(/\D/g, "");
    const token = randomToken(PREFIX.device);
    const { data } = code.length === 6
      ? await db.rpc("redeem_pairing_code", { p_code_hash: await sha256(code), p_token_hash: await sha256(token), p_label: String(body.label ?? "Even G2") })
      : { data: null };
    const row = Array.isArray(data) ? (data[0] as { device_id: string } | undefined) : undefined;
    if (!row) {
      await env.OAUTH_KV.put(key, String(failures + 1), { expirationTtl: PAIR_WINDOW_SEC });
      return reply({ error: "that code is wrong, used or expired: get a new one on the web app" }, 400);
    }
    return reply({ device_token: token, device_id: row.device_id });
  }

  // ------------------------------------------------------------ feed fallback
  // (served under /feed, routed here by index.ts)
  if (path.startsWith("/feed/")) return podcastFeed(req, env, db, url);

  const who = await caller(env, db, req);
  if (!who) return reply({ error: "sign in, or pair this device again" }, 401);

  // ------------------------------------------------------------ editions (session or device)
  if (path === "/api/device" && req.method === "GET") return reply({ paired: true, via: who.via });
  const ed = path.match(/^\/api\/editions\/(latest|\d{4}-\d{2}-\d{2})$/);
  if (ed && req.method === "GET") return editionResponse(db, who.userId, ed[1]);
  if (path === "/api/editions" && req.method === "GET") return reply(await listEditions(db, who.userId));

  if (who.via !== "session") return reply({ error: "this needs the web app (a device token only reads editions)" }, 403);
  const userId = who.userId;

  // ------------------------------------------------------------ brief (session only, never the agent)
  if (path === "/api/brief" && req.method === "GET") return reply(await loadBrief(db, userId));
  if (path === "/api/brief" && req.method === "PUT") {
    const body = (await req.json().catch(() => null)) as { brief?: Brief; expected_version?: number } | null;
    if (!body?.brief) return reply({ error: "send { brief, expected_version }" }, 400);
    const issues = checkBrief(body.brief);
    if (issues.length) return reply({ error: "the brief has problems", issues }, 422);
    try {
      const r = await saveBrief(db, userId, body.brief, typeof body.expected_version === "number" ? body.expected_version : null);
      return reply(r);
    } catch (e) {
      if (e instanceof Conflict) return reply({ error: e.message }, 409);
      throw e;
    }
  }

  // ------------------------------------------------------------ pairing codes
  if (path === "/api/pairing-code" && req.method === "POST") {
    await db.from("pairing_codes").delete().eq("user_id", userId).is("used_at", null);
    const code = pairingCode();
    const expires = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();
    const { error } = await db.from("pairing_codes").insert({ code_hash: await sha256(code), user_id: userId, expires_at: expires });
    if (error) return reply({ error: "couldn't make a code, try again" }, 500);
    return reply({ code, expires_at: expires });
  }

  // ------------------------------------------------------------ devices and feeds
  if (path === "/api/devices" && req.method === "GET") {
    const { data } = await db.from("device_tokens").select("id, kind, label, created_at, last_used_at").eq("user_id", userId).order("created_at");
    return reply(data ?? []);
  }
  const dev = path.match(/^\/api\/devices\/([0-9a-f-]{36})$/);
  if (dev && req.method === "DELETE") {
    // Revoking deletes the row: the next fetch with that token fails closed ("pair again").
    await db.from("device_tokens").delete().eq("user_id", userId).eq("id", dev[1]);
    return reply({ ok: true });
  }
  if (path === "/api/feeds" && req.method === "POST") {
    const token = randomToken(PREFIX.feed);
    const { data, error } = await db.from("device_tokens").insert({ token_hash: await sha256(token), user_id: userId, kind: "feed", label: "Podcast feed" }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    return reply({ id: data.id, url: `${env.PUBLIC_URL}/feed/${token}/podcast.xml` });
  }

  // ------------------------------------------------------------ agent tokens (MCP)
  if (path === "/api/tokens" && req.method === "GET") {
    const { data } = await db.from("access_tokens").select("id, name, created_at, last_used_at").eq("user_id", userId).is("revoked_at", null).order("created_at");
    return reply(data ?? []);
  }
  if (path === "/api/tokens" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const token = randomToken(PREFIX.agent);
    const { data, error } = await db.from("access_tokens").insert({ token_hash: await sha256(token), user_id: userId, name: String(body.name ?? "Build agent").slice(0, 60) }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    return reply({ id: data.id, token });
  }
  const tok = path.match(/^\/api\/tokens\/([0-9a-f-]{36})$/);
  if (tok && req.method === "DELETE") {
    await db.from("access_tokens").delete().eq("user_id", userId).eq("id", tok[1]);
    return reply({ ok: true });
  }

  return reply({ error: "not found" }, 404);
}
