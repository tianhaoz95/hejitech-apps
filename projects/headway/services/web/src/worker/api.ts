// The API (/api/*) for the web page, the iPhone app and the glasses plugin.
//
// Who may call what:
//   none                          stations, any board, a train's progress, status; POST /api/pair (throttled)
//   session or glasses token      the user's commute board, the tracked train
//   Supabase session (web, iPhone) settings, pairing codes, devices, push registration, agent tokens, delete data
import { board, checkSettings, commuteBoard, normalizeSettings, progress, station, STATIONS, timetableDaysLeft, TIMETABLE, tripProgressStops, type ExpressPreference, type Notification, type Settings, type Tracked } from "@headway/core";
import { pushConfigured, sendPush } from "./push.ts";
import {
  admin, bearer, createEtaShare, json, loadEtaShare, loadSettings, loadSnapshot, loadTracked, pairingCode, PAIRING_CODE_TTL_MS, PREFIX, randomToken, resolveDevice,
  revokeEtaShares, saveSettings, saveTracked, sha256, supabaseUser, updateEtaShareExpiry, type Db, type Env,
} from "./store.ts";

const PAIR_FAILURES_PER_WINDOW = 10;
const PAIR_WINDOW_SEC = 600;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) => json(body, status, { ...cors, ...extra });

type Caller = { userId: string; via: "session" | "device"; email?: string };

async function caller(env: Env, db: Db, req: Request): Promise<Caller | null> {
  const token = bearer(req);
  if (token.startsWith(PREFIX.device)) {
    const d = await resolveDevice(db, token);
    return d ? { userId: d.userId, via: "device" } : null;
  }
  const u = await supabaseUser(env, req);
  return u ? { userId: u.id, via: "session", email: u.email } : null;
}

const pairOf = (url: URL) => {
  const from = url.searchParams.get("from"), to = url.searchParams.get("to");
  return from && to ? { from, to } : undefined;
};

function checkTracked(body: Partial<Tracked> | null): Tracked | string {
  if (!body) return "send { trip_id, service_date, from, to }";
  const trip = TIMETABLE.trips.find((t) => t.id === body.trip_id);
  if (!trip) return "unknown train";
  if (!/^\d{8}$/.test(String(body.service_date ?? ""))) return "service_date must be YYYYMMDD";
  if (!station(String(body.from ?? "")) || !station(String(body.to ?? ""))) return "unknown station";
  return { trip_id: trip.id, service_date: String(body.service_date), from: String(body.from), to: String(body.to) };
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin(env);
  const path = url.pathname;
  const now = Date.now();

  const expressParam = (url.searchParams.get("express") ?? url.searchParams.get("express_preference")) as ExpressPreference | null;
  const validExpress = expressParam === "all" || expressParam === "prefer_express" || expressParam === "express_only" ? expressParam : undefined;

  // ------------------------------------------------------------ public
  if (path === "/api/stations" && req.method === "GET") {
    return reply(STATIONS.map(({ id, name, short, lat, lon }) => ({ id, name, short, lat, lon })), 200, { "Cache-Control": "public, max-age=86400" });
  }
  if (path === "/api/board" && req.method === "GET") {
    const p = pairOf(url);
    if (!p) return reply({ error: "send ?from=<station>&to=<station> (ids from /api/stations)" }, 400);
    const b = board(p.from, p.to, now, await loadSnapshot(db), "custom", TIMETABLE, validExpress ? { expressPreference: validExpress } : {});
    return b ? reply(b, 200, { "Cache-Control": "public, max-age=20" }) : reply({ error: "unknown stations, or the same station twice" }, 400);
  }
  if (path === "/api/train" && req.method === "GET") {
    const t = checkTracked({ trip_id: url.searchParams.get("trip") ?? "", service_date: url.searchParams.get("date") ?? "", from: url.searchParams.get("from") ?? url.searchParams.get("to") ?? "", to: url.searchParams.get("to") ?? "" });
    if (typeof t === "string") return reply({ error: t }, 400);
    const p = progress(t, now, await loadSnapshot(db));
    return p ? reply(p, 200, { "Cache-Control": "public, max-age=20" }) : reply({ error: "that train doesn't stop there" }, 404);
  }
  if (path === "/api/status" && req.method === "GET") {
    const s = await loadSnapshot(db);
    return reply({
      realtime: { configured: Boolean(env.TRANSIT_511_API_KEY), fetched_at: s?.fetched_at ?? null, feed_ts: s?.feed_ts ?? null, live: Boolean(s && now - s.fetched_at < 10 * 60_000), trips: s ? Object.keys(s.trips).length : 0, alerts: s?.alerts.length ?? 0 },
      timetable: { version: TIMETABLE.feed_version, valid_until: TIMETABLE.feed_end, days_left: timetableDaysLeft(now) },
      push: { configured: pushConfigured(env) },
    });
  }
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
      return reply({ error: "that code is wrong, used or expired: get a new one in the Headway app" }, 400);
    }
    return reply({ device_token: token, device_id: row.device_id });
  }
  const etaMatch = path.match(/^\/api\/eta\/([^/]+)$/);
  if (etaMatch && req.method === "GET") {
    const token = etaMatch[1];
    const row = await loadEtaShare(db, token);
    if (!row) return reply({ error: "share not found or expired" }, 404);
    const tracked: Tracked = { trip_id: row.trip_id, service_date: row.service_date, from: row.from_station, to: row.to_station };
    const snapshot = await loadSnapshot(db);
    const p = progress(tracked, now, snapshot);
    if (!p) return reply({ error: "train progress unavailable" }, 404);
    const stops = tripProgressStops(tracked, now, snapshot);
    if (p.arrived) {
      const exp = new Date(now + 30 * 60_000).toISOString();
      if (row.expires_at > exp) await updateEtaShareExpiry(db, row.token_hash, exp);
    }
    return reply({
      name: row.name,
      train: p.train,
      kind: p.kind,
      to: p.to.id,
      to_name: p.to.name,
      to_short: p.to.short,
      pred_arr: p.pred_arr,
      arr: p.arr,
      delay_min: p.delay_min,
      cancelled: p.cancelled,
      arrived: p.arrived,
      stops,
      updated_at: now,
      expires_at: row.expires_at,
    }, 200, { "Cache-Control": "public, max-age=15" });
  }

  const who = await caller(env, db, req);
  if (!who) return reply({ error: "sign in, or pair these glasses again" }, 401);
  const userId = who.userId;

  // ------------------------------------------------------------ session or glasses
  if (path === "/api/device" && req.method === "GET") return reply({ paired: true, via: who.via });
  if (path === "/api/me/board" && req.method === "GET") {
    const [{ settings, saved }, snapshot, tracked] = await Promise.all([loadSettings(db, userId), loadSnapshot(db), loadTracked(db, userId)]);
    const b = commuteBoard(settings, now, snapshot, pairOf(url), validExpress ? { expressPreference: validExpress } : {});
    const p = tracked ? progress(tracked, now, snapshot) : null;
    return reply({ board: b, has_commute: Boolean(settings.morning || settings.evening), saved, tracked: tracked && p && !p.arrived ? { ...tracked, progress: p } : null });
  }
  if (path === "/api/track" && req.method === "POST") {
    const t = checkTracked((await req.json().catch(() => null)) as Partial<Tracked> | null);
    if (typeof t === "string") return reply({ error: t }, 400);
    await saveTracked(db, userId, t);
    return reply({ tracked: t, progress: progress(t, now, await loadSnapshot(db)) });
  }
  if (path === "/api/track" && req.method === "DELETE") {
    await saveTracked(db, userId, null);
    await db.from("activity_tokens").delete().eq("user_id", userId).eq("kind", "update");
    return reply({ ok: true });
  }
  if (path === "/api/me/share" && req.method === "POST") {
    const tracked = await loadTracked(db, userId);
    if (!tracked) return reply({ error: "no train currently tracked" }, 400);
    const { settings } = await loadSettings(db, userId);
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = typeof body?.name === "string" ? body.name : settings.share_name;
    const share = await createEtaShare(db, userId, tracked, name, env.PUBLIC_URL);
    return reply(share, 201);
  }
  if (path === "/api/me/share" && req.method === "DELETE") {
    await revokeEtaShares(db, userId);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ live activity tokens
  if (path === "/api/me/activity" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { token?: string; kind?: string; trip_id?: string; environment?: string };
    const token = String(body.token ?? "").trim();
    if (!token || token.length < 16) return reply({ error: "valid push token required" }, 400);
    const kind = body.kind === "start" ? "start" : body.kind === "update" ? "update" : null;
    if (!kind) return reply({ error: "kind must be start or update" }, 400);
    const environment = body.environment === "sandbox" ? "sandbox" : "production";
    const tripId = body.trip_id ? String(body.trip_id) : null;
    const { error } = await db.from("activity_tokens").upsert({
      user_id: userId,
      kind,
      token,
      trip_id: tripId,
      environment,
      updated_at: new Date().toISOString(),
    });
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true });
  }
  if (path === "/api/me/activity" && req.method === "DELETE") {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    let q = db.from("activity_tokens").delete().eq("user_id", userId);
    if (body.token) q = q.eq("token", String(body.token).trim());
    else q = q.eq("kind", "update");
    const { error } = await q;
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true });
  }

  if (who.via !== "session") return reply({ error: "this needs the Headway app (glasses only read boards and track trains)" }, 403);

  // ------------------------------------------------------------ settings
  if (path === "/api/settings" && req.method === "GET") return reply({ ...(await loadSettings(db, userId)), email: who.email ?? null });
  if (path === "/api/settings" && req.method === "PUT") {
    const body = (await req.json().catch(() => null)) as { settings?: Settings } | null;
    const issues = checkSettings(body?.settings);
    if (issues.length) return reply({ error: "the settings have problems", issues }, 422);
    const settings = normalizeSettings(body!.settings);
    await saveSettings(db, userId, settings);
    return reply({ settings, saved: true });
  }

  // ------------------------------------------------------------ glasses pairing
  if (path === "/api/pairing-code" && req.method === "POST") {
    await db.from("pairing_codes").delete().eq("user_id", userId).is("used_at", null);
    const code = pairingCode();
    const expires = new Date(now + PAIRING_CODE_TTL_MS).toISOString();
    const { error } = await db.from("pairing_codes").insert({ code_hash: await sha256(code), user_id: userId, expires_at: expires });
    if (error) return reply({ error: "couldn't make a code, try again" }, 500);
    return reply({ code, expires_at: expires });
  }
  if (path === "/api/devices" && req.method === "GET") {
    const { data } = await db.from("device_tokens").select("id, label, created_at, last_used_at").eq("user_id", userId).order("created_at");
    return reply(data ?? []);
  }
  const dev = path.match(/^\/api\/devices\/([0-9a-f-]{36})$/);
  if (dev && req.method === "DELETE") {
    await db.from("device_tokens").delete().eq("user_id", userId).eq("id", dev[1]);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ push (iPhone)
  if (path === "/api/push" && req.method === "GET") {
    const { data } = await db.from("push_devices").select("id, label, environment, created_at, last_seen_at").eq("user_id", userId).order("created_at");
    return reply({ configured: pushConfigured(env), devices: data ?? [] });
  }
  if (path === "/api/push" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { token?: string; environment?: string; label?: string };
    const token = String(body.token ?? "").toLowerCase();
    if (!/^[0-9a-f]{32,200}$/.test(token)) return reply({ error: "token must be the APNs device token in hex" }, 400);
    const environment = body.environment === "sandbox" ? "sandbox" : "production";
    // A token belongs to one phone: re-registering under another account moves it.
    const { error } = await db.from("push_devices").upsert({ user_id: userId, apns_token: token, environment, label: String(body.label ?? "iPhone").slice(0, 60), last_seen_at: new Date().toISOString() }, { onConflict: "apns_token" });
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true, configured: pushConfigured(env) });
  }
  const pushDel = path.match(/^\/api\/push\/([0-9a-f]{32,200})$/i);
  if (pushDel && req.method === "DELETE") {
    await db.from("push_devices").delete().eq("user_id", userId).eq("apns_token", pushDel[1].toLowerCase());
    return reply({ ok: true });
  }
  if (path === "/api/push/test" && req.method === "POST") {
    if (!pushConfigured(env)) return reply({ error: "push isn't set up on the server yet" }, 503);
    const { data } = await db.from("push_devices").select("id, apns_token, environment").eq("user_id", userId);
    if (!data?.length) return reply({ error: "no iPhone registered for alerts" }, 404);
    const n: Notification = { key: `test:${now}`, kind: "service", thread: "headway-test", title: "Headway alerts work", body: "You'll hear from Headway like this when your train is late, cancelled or almost at your stop." };
    const results = await Promise.all(data.map((d) => sendPush(env, d, n)));
    return reply({ results: results.map((r) => (r.ok ? "sent" : r.reason)) });
  }

  // ------------------------------------------------------------ agent tokens (MCP)
  if (path === "/api/tokens" && req.method === "GET") {
    const { data } = await db.from("access_tokens").select("id, name, created_at, last_used_at").eq("user_id", userId).order("created_at");
    return reply(data ?? []);
  }
  if (path === "/api/tokens" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const token = randomToken(PREFIX.agent);
    const { data, error } = await db.from("access_tokens").insert({ token_hash: await sha256(token), user_id: userId, name: String(body.name ?? "Assistant").slice(0, 60) }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    return reply({ id: data.id, token });
  }
  const tok = path.match(/^\/api\/tokens\/([0-9a-f-]{36})$/);
  if (tok && req.method === "DELETE") {
    await db.from("access_tokens").delete().eq("user_id", userId).eq("id", tok[1]);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ delete everything Headway keeps
  if (path === "/api/account" && req.method === "DELETE") {
    for (const t of ["profiles", "pairing_codes", "device_tokens", "access_tokens", "push_devices", "activity_tokens", "tracked_trips", "sent_notifications"]) {
      const { error } = await db.from(t).delete().eq("user_id", userId);
      if (error) return reply({ error: `couldn't delete ${t}: ${error.message}` }, 500);
    }
    return reply({ ok: true });
  }

  return reply({ error: "not found" }, 404);
}
