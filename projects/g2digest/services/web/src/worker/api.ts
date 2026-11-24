// The web app's and the plugin's API (/api/*) and the private podcast feed (/feed/*).
//
// Who may call what:
//   Supabase session (web app)   brief read/edit, pairing codes, devices, feeds, agent tokens, editions
//   device token g2d_… (plugin)  editions only (read-only, one user's), and /api/device to check pairing
//   none                         POST /api/pair: trade a 6-digit code for a device token (throttled)
//   feed token g2f_… in the URL  /feed/<token>/podcast.xml and its audio (podcast apps can't send headers)
import { checkBrief, type Brief, type Bundle } from "@g2digest/core";
import {
  admin, Conflict, getEdition, json, listEditions, loadBrief, pairingCode, PAIRING_CODE_TTL_MS, PREFIX, randomToken,
  resolveDevice, saveBrief, sha256, signedAudio, supabaseUser, type Db, type Env,
} from "./store.ts";
import { checkout, fromBrowser, offers, portal, proRequired, proStatus, StripeError } from "./billing.ts";
import { recordTransactions } from "./appstore.ts";
import { notifyEdition } from "./push.ts";

/** What a signed-in account can still do without Pro on the web: delete its data. */
const OPEN_WITHOUT_PRO = new Set(["/api/account"]);

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

async function editionResponse(db: Db, userId: string, date: string, includeDrafts = false) {
  const e = await getEdition(db, userId, date === "latest" ? "latest" : date, includeDrafts);
  if (!e) return reply({ error: date === "latest" ? "no edition published yet" : `no edition for ${date}` }, 404);
  return reply({
    date: e.date, title: e.title, status: e.status, publish_at: e.publish_at, published_at: e.published_at,
    guide_version: e.guide_version, brief_version: e.brief_version,
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

  // ------------------------------------------------------------ public read-only share snapshot (no auth)
  const shared = path.match(/^\/api\/shared\/(g2s_[A-Za-z0-9_-]+)$/);
  if (shared && req.method === "GET") {
    const hash = await sha256(shared[1]);
    const { data: share } = await db
      .from("edition_shares")
      .select("user_id, edition_date, card_slug, label, expires_at, revoked_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!share || share.revoked_at || (share.expires_at && Date.parse(share.expires_at as string) <= Date.now())) {
      return reply({ error: "This share link is invalid, expired, or revoked." }, 404);
    }
    const e = await getEdition(db, share.user_id as string, share.edition_date as string, false);
    if (!e) return reply({ error: "Shared edition is no longer available." }, 404);
    const b = e.bundle;
    const cardSlug = share.card_slug as string | null;
    if (cardSlug) {
      const card = b.cards.find((c) => c.slug === cardSlug);
      if (!card) return reply({ error: "Shared card was not found." }, 404);
      const section = card.section_id ? b.edition.sections.find((s) => s.section_id === card.section_id) : null;
      const miniBundle: Bundle = {
        date: b.date,
        guide_version: b.guide_version,
        brief_version: b.brief_version,
        edition: { title: b.edition.title, sections: section ? [section] : [] },
        cards: [card],
      };
      return reply({
        kind: "card",
        date: e.date,
        title: e.title,
        label: share.label,
        card,
        section,
        audio: await signedAudio(db, share.user_id as string, miniBundle, 3600),
      });
    }
    return reply({
      kind: "edition",
      date: e.date,
      title: e.title,
      label: share.label,
      published_at: e.published_at,
      bundle: b,
      audio: await signedAudio(db, share.user_id as string, b, 3600),
    });
  }

  const who = await caller(env, db, req);
  if (!who) return reply({ error: "sign in, or pair this device again" }, 401);

  // ------------------------------------------------------------ Pro (billing.ts, appstore.ts)
  // One answer for every platform: App Store, Stripe and Google Play purchases and grants by email.
  if (path === "/api/pro" && req.method === "GET") {
    const status = await proStatus(db, who.userId, who.email);
    const onSale = who.via === "session" ? await offers(env).catch(() => []) : [];
    return reply({ ...status, email: who.email ?? null, offers: onSale });
  }
  if (path === "/api/appstore/transactions" && req.method === "POST") {
    if (who.via !== "session") return reply({ error: "sign in" }, 403);
    const body = (await req.json().catch(() => null)) as { transactions?: unknown } | null;
    const r = await recordTransactions(db, who.userId, body?.transactions);
    return reply({ ...r, ...(await proStatus(db, who.userId, who.email)) });
  }
  if ((path === "/api/billing/checkout" || path === "/api/billing/portal") && req.method === "POST") {
    if (who.via !== "session") return reply({ error: "sign in" }, 403);
    try {
      const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
      const user = { userId: who.userId, email: who.email };
      return reply({ url: path.endsWith("checkout") ? await checkout(env, db, user, body.plan) : await portal(env, db, user) });
    } catch (e) {
      if (e instanceof StripeError) return reply({ error: e.message }, e.status);
      throw e;
    }
  }
  // The web pages and the glasses need Pro; the native apps gate on the phone (billing.ts).
  if ((who.via === "device" || fromBrowser(req)) && !OPEN_WITHOUT_PRO.has(path) && !(await proStatus(db, who.userId, who.email)).pro) {
    return reply(proRequired(env), 402);
  }

  // ------------------------------------------------------------ editions, bookmarks, signals (session or device)
  if (path === "/api/device" && req.method === "GET") return reply({ paired: true, via: who.via });
  if (path === "/api/bookmarks" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const editionDate = String(body?.edition_date ?? "");
    const cardSlug = String(body?.card_slug ?? "");
    const cardTitle = String(body?.card_title ?? "");
    const cardBody = String(body?.body ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate) || !cardSlug || !cardTitle) {
      return reply({ error: "edition_date, card_slug and card_title are required" }, 400);
    }
    const { error } = await db.from("bookmarks").upsert({
      user_id: who.userId,
      edition_date: editionDate,
      card_slug: cardSlug,
      card_title: cardTitle.slice(0, 200),
      section_title: body?.section_title ? String(body.section_title).slice(0, 120) : null,
      body: cardBody.slice(0, 1000),
      source_url: body?.source_url ? String(body.source_url).slice(0, 500) : null,
    }, { onConflict: "user_id,edition_date,card_slug" });
    if (error) return reply({ error: error.message }, 500);
    await db.from("reader_signals").insert({
      user_id: who.userId,
      edition_date: editionDate,
      card_slug: cardSlug,
      signal: "bookmarked",
    }).then(() => undefined, () => undefined);
    return reply({ ok: true });
  }
  if (path === "/api/signals" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const editionDate = String(body?.edition_date ?? "");
    const cardSlug = String(body?.card_slug ?? "");
    const signal = String(body?.signal ?? "");
    const allowed = ["deep_dive_played", "glance_played", "bookmarked", "skipped_fast", "opened"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate) || !cardSlug || !allowed.includes(signal)) {
      return reply({ error: "invalid signal payload" }, 400);
    }
    await db.from("reader_signals").insert({
      user_id: who.userId,
      edition_date: editionDate,
      card_slug: cardSlug,
      section_id: body?.section_id ? String(body.section_id).slice(0, 80) : null,
      signal,
      duration_ms: typeof body?.duration_ms === "number" ? Math.max(0, Math.round(body.duration_ms)) : null,
    });
    return reply({ ok: true });
  }
  const ed = path.match(/^\/api\/editions\/(latest|\d{4}-\d{2}-\d{2})$/);
  if (ed && req.method === "GET") return editionResponse(db, who.userId, ed[1], who.via === "session");
  if (path === "/api/editions" && req.method === "GET") return reply(await listEditions(db, who.userId, 60, who.via === "session"));

  if (who.via !== "session") return reply({ error: "this needs the web app (a device token only reads editions)" }, 403);
  const userId = who.userId;

  // ------------------------------------------------------------ search across kept editions
  if (path === "/api/editions/search" && req.method === "GET") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    if (!q) return reply([]);
    const { data: rows } = await db
      .from("editions")
      .select("date, title, status, bundle")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(20);
    const hits: { date: string; edition_title: string; card_slug: string; card_title: string; section_title: string | null; snippet: string; source_url: string | null }[] = [];
    for (const row of (rows ?? []) as { date: string; title: string; bundle: Bundle }[]) {
      const b = row.bundle;
      for (const c of b.cards) {
        const sec = c.section_id ? b.edition.sections.find((s) => s.section_id === c.section_id) : null;
        const hay = [c.title, c.body, sec?.title ?? "", sec?.body ?? "", sec?.methodology ?? "", ...(sec?.sources ?? []).map((s) => s.title)].join("\n").toLowerCase();
        if (hay.includes(q)) {
          hits.push({
            date: row.date,
            edition_title: row.title,
            card_slug: c.slug,
            card_title: c.title,
            section_title: sec?.title ?? null,
            snippet: c.body.slice(0, 180),
            source_url: c.source_url ?? sec?.sources?.[0]?.url ?? null,
          });
        }
      }
    }
    return reply(hits.slice(0, 40));
  }

  // ------------------------------------------------------------ publish draft / scheduled edition immediately
  const pubNow = path.match(/^\/api\/editions\/(\d{4}-\d{2}-\d{2})\/publish$/);
  if (pubNow && req.method === "POST") {
    const { data: row, error } = await db
      .from("editions")
      .update({ status: "published", publish_at: null, published_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("date", pubNow[1])
      .select("date, title, total_cards, bundle")
      .maybeSingle();
    if (error || !row) return reply({ error: error?.message ?? "edition not found" }, 404);
    const b = row.bundle as Bundle;
    await notifyEdition(env, db, userId, {
      date: row.date as string,
      title: row.title as string,
      cards: row.total_cards as number,
      lead_title: b.cards.find((c) => c.kind === "section")?.title,
      alert_count: b.cards.filter((c) => c.alert).length,
    }).catch(() => undefined);
    return reply({ ok: true, date: row.date, status: "published" });
  }

  // ------------------------------------------------------------ bookmarks list & delete
  if (path === "/api/bookmarks" && req.method === "GET") {
    const { data } = await db.from("bookmarks").select("edition_date, card_slug, card_title, section_title, body, source_url, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    return reply(data ?? []);
  }
  const delBm = path.match(/^\/api\/bookmarks\/(\d{4}-\d{2}-\d{2})\/([a-z0-9-]+)$/);
  if (delBm && req.method === "DELETE") {
    await db.from("bookmarks").delete().eq("user_id", userId).eq("edition_date", delBm[1]).eq("card_slug", delBm[2]);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ build runs & reader signals
  if (path === "/api/build-runs" && req.method === "GET") {
    const { data } = await db.from("build_runs").select("id, action, edition_date, status, error_count, warning_count, errors, agent_name, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25);
    return reply(data ?? []);
  }
  if (path === "/api/signals" && req.method === "GET") {
    const { data } = await db.from("reader_signals").select("edition_date, card_slug, section_id, signal, duration_ms, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    return reply(data ?? []);
  }

  // ------------------------------------------------------------ revocable share links
  if (path === "/api/shares" && req.method === "GET") {
    const { data } = await db.from("edition_shares").select("id, edition_date, card_slug, label, created_at, expires_at").eq("user_id", userId).is("revoked_at", null).order("created_at", { ascending: false }).limit(50);
    return reply(data ?? []);
  }
  if (path === "/api/shares" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { edition_date?: string; card_slug?: string | null; label?: string; expires_in_days?: number } | null;
    const editionDate = String(body?.edition_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) return reply({ error: "edition_date (YYYY-MM-DD) is required" }, 400);
    const e = await getEdition(db, userId, editionDate, false);
    if (!e) return reply({ error: "Only published editions can be shared." }, 404);
    const cardSlug = body?.card_slug ? String(body.card_slug) : null;
    if (cardSlug && !e.bundle.cards.some((c) => c.slug === cardSlug)) return reply({ error: "Card not found in edition." }, 404);
    const token = randomToken(PREFIX.share);
    const days = typeof body?.expires_in_days === "number" && body.expires_in_days > 0 ? Math.min(90, body.expires_in_days) : 14;
    const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();
    const { data, error } = await db.from("edition_shares").insert({
      token_hash: await sha256(token),
      user_id: userId,
      edition_date: editionDate,
      card_slug: cardSlug,
      label: body?.label ? String(body.label).slice(0, 80) : null,
      expires_at: expiresAt,
    }).select("id").single();
    if (error || !data) return reply({ error: error?.message ?? "couldn't create share link" }, 500);
    return reply({ id: data.id, token, url: `${env.PUBLIC_URL}/share/?t=${token}`, expires_at: expiresAt });
  }
  const delShare = path.match(/^\/api\/shares\/([0-9a-f-]{36})$/);
  if (delShare && req.method === "DELETE") {
    await db.from("edition_shares").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("id", delShare[1]);
    return reply({ ok: true });
  }

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
    return reply({
      id: data.id,
      url: `${env.PUBLIC_URL}/feed/${token}/podcast.xml`,
      glance_url: `${env.PUBLIC_URL}/feed/${token}/glance.xml`,
      deep_dive_url: `${env.PUBLIC_URL}/feed/${token}/deep-dive.xml`,
    });
  }

  // ------------------------------------------------------------ Android FCM notifications
  if (path === "/api/push/fcm" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const token = String(body.token ?? "").trim();
    if (token.length < 20 || token.length > 512) return reply({ error: "invalid FCM token" }, 400);
    const { error } = await db.from("fcm_devices").upsert({ fcm_token: token, user_id: userId }, { onConflict: "fcm_token" });
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true });
  }
  const fcmDel = path.match(/^\/api\/push\/fcm\/(.+)$/);
  if (fcmDel && req.method === "DELETE") {
    await db.from("fcm_devices").delete().eq("user_id", userId).eq("fcm_token", decodeURIComponent(fcmDel[1]));
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ iPhone notifications (APNs device tokens)
  if (path === "/api/push" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown; sandbox?: unknown };
    const token = String(body.token ?? "");
    if (!/^[0-9a-f]{64,200}$/i.test(token)) return reply({ error: "token must be an APNs device token (hex)" }, 400);
    const { error } = await db.from("push_devices").upsert(
      { apns_token: token.toLowerCase(), user_id: userId, environment: body.sandbox === true ? "sandbox" : "production" },
      { onConflict: "apns_token" });
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true });
  }
  const pushTok = path.match(/^\/api\/push\/([0-9a-fA-F]{64,200})$/);
  if (pushTok && req.method === "DELETE") {
    await db.from("push_devices").delete().eq("user_id", userId).eq("apns_token", pushTok[1].toLowerCase());
    return reply({ ok: true });
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
