// The API (/api/*) for the web app, the iPhone app and the glasses plugin.
//
// Who may call what:
//   none                         POST /api/pair: trade a 6-digit code for a glasses token (throttled)
//   session or glasses token     today's plan and state, live heart rate, check-ins, feedback
//   Supabase session (web, iPhone) plans, history, settings, vitals, live HR upload, photos, pairing,
//                                devices, agent tokens, deleting FitLoop's data
import {
  adherence, checkCheckin, checkFeedback, demoPlan, demoSettings, checkSettings, checkVital, isDate, METRICS, normalizeSettings, type Checkin, type Settings, type VitalEntry,
} from "@fitloop/core";
import {
  admin, bearer, BUCKET, checkinsBetween, feedbackList, json, LIVE_MAX_AGE_MS, loadSettings, pairingCode, PAIRING_CODE_TTL_MS, PHOTO_URL_TTL_SEC, planOn, planSpans,
  planVersions, PREFIX, published, randomToken, resolveDevice, saveSettings, sha256, supabaseUser, today, type Db, type Env,
} from "./store.ts";
import { reviewSignIn } from "./review.ts";
import { getOrResolveExerciseGif, normalizeExerciseSlug, uploadExerciseGif, type UploadGifOptions } from "./exercise_media.ts";

/** Every table holding a user's FitLoop rows (DELETE /api/account, the review account's reset). */
const USER_TABLES = ["profiles", "plans", "checkins", "feedback", "vitals", "photos", "live", "pairing_codes", "device_tokens", "access_tokens"] as const;

/** Removes everything FitLoop keeps about a user: photos in storage, then their rows. */
async function deleteUserData(db: Db, userId: string): Promise<string | null> {
  const { data: files } = await db.storage.from(BUCKET).list(`${userId}/photos`, { limit: 1000 });
  if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => `${userId}/photos/${f.name}`));
  for (const t of USER_TABLES) {
    const { error } = await db.from(t).delete().eq("user_id", userId);
    if (error) return `couldn't delete ${t}: ${error.message}`;
  }
  return null;
}

/** Monday of the week before `now` (UTC date), so the demo plan already has a history. */
function demoStart(now: number): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7);
  return d.toISOString().slice(0, 10);
}

const PAIR_FAILURES_PER_WINDOW = 10;
const PAIR_WINDOW_SEC = 600;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const reply = (body: unknown, status = 200) => json(body, status, cors);

type Caller = { userId: string; via: "session" | "device"; email?: string };

async function caller(env: Env, db: Db, req: Request): Promise<Caller | null> {
  const token = bearer(req);
  if (token.startsWith(PREFIX.device)) {
    const userId = await resolveDevice(db, token);
    return userId ? { userId, via: "device" } : null;
  }
  const u = await supabaseUser(env, req);
  return u ? { userId: u.id, via: "session", email: u.email } : null;
}

const dateParam = (url: URL, name: string, fallback?: string) => {
  const v = url.searchParams.get(name) ?? fallback;
  return isDate(v) ? v : null;
};

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin(env);
  const path = url.pathname;

  // ------------------------------------------------------------ pairing (no auth)
  if (path === "/api/review-sign-in" && req.method === "POST") {
    // App Review's demo account: a fresh demo plan every time it signs in (review.ts).
    const r = await reviewSignIn(env, req, async (userId) => {
      await deleteUserData(db, userId);
      await saveSettings(db, userId, demoSettings());
      const startsOn = demoStart(Date.now());
      await db.rpc("publish_plan", {
        p_user: userId, p_plan: demoPlan(startsOn), p_starts_on: startsOn, p_by: "agent",
        p_change_note: "Demo plan: three strength days around a sore knee, two short cardio days, vegetarian weekdays.",
      });
    });
    return reply(r.body, r.status);
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
      return reply({ error: "that code is wrong, used or expired: get a new one in the FitLoop app" }, 400);
    }
    return reply({ device_token: token, device_id: row.device_id });
  }

  // ------------------------------------------------------------ public exercise demonstration GIFs
  const exMatch = path.match(/^\/api\/exercises\/([a-zA-Z0-9_-]+)(?:\.gif)?$/);
  if (exMatch && (req.method === "GET" || req.method === "HEAD")) {
    const slug = normalizeExerciseSlug(exMatch[1]);
    const bytes = await getOrResolveExerciseGif(db, slug);
    if (!bytes) {
      return reply(
        {
          error:
            "exercise GIF not found. Choose from 1,300+ catalog exercises, procedural presets (cat-cow, bird-dog, childs-pose, kneeling-hip-flexor, basketball), or use upload_exercise_gif.",
        },
        404,
      );
    }
    return new Response(req.method === "HEAD" ? null : bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  }
  if (exMatch && req.method === "POST") {
    const who = await caller(env, db, req);
    if (!who) return reply({ error: "sign in or supply an agent token to upload exercise media" }, 401);
    const contentType = (req.headers.get("Content-Type") ?? "").toLowerCase();
    try {
      let opts: UploadGifOptions;
      if (contentType.includes("application/json")) {
        const body = (await req.json().catch(() => ({}))) as { source_url?: string; data_base64?: string };
        opts = { sourceUrl: body.source_url, dataBase64: body.data_base64 };
      } else {
        const rawBytes = new Uint8Array(await req.arrayBuffer());
        opts = { rawBytes };
      }
      const res = await uploadExerciseGif(db, env.PUBLIC_URL, exMatch[1], opts);
      return reply(res);
    } catch (err) {
      return reply({ error: (err as Error).message }, 400);
    }
  }

  const who = await caller(env, db, req);
  if (!who) return reply({ error: "sign in, or pair these glasses again" }, 401);
  const userId = who.userId;
  const source = who.via === "device" ? "glasses" : (req.headers.get("X-FitLoop-Client") ?? "web").slice(0, 10);

  // ------------------------------------------------------------ session or glasses
  if (path === "/api/today" && req.method === "GET") {
    const date = dateParam(url, "date");
    if (!date) return reply({ error: "send ?date=YYYY-MM-DD (your local date)" }, 400);
    return reply(await today(db, userId, date));
  }
  if (path === "/api/live" && req.method === "GET") {
    // Polled every few seconds by the glasses during a workout: the heart rate the iPhone relays from the Watch.
    const [{ data }, { settings }] = await Promise.all([db.from("live").select("hr, workout_ref, updated_at").eq("user_id", userId).maybeSingle(), loadSettings(db, userId)]);
    const fresh = data && settings.vitals.live_hr && Date.now() - Date.parse(data.updated_at) < LIVE_MAX_AGE_MS;
    return reply(fresh ? { hr: data.hr, workout_ref: data.workout_ref } : null);
  }
  if (path === "/api/checkins" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as Partial<Checkin> | Partial<Checkin>[] | null;
    const list = Array.isArray(body) ? body : body ? [body] : [];
    if (!list.length || list.length > 100) return reply({ error: "send a check-in or a list of up to 100" }, 400);
    const rows = await planVersions(db, userId);
    const out = [];
    for (const c of list) {
      const plan = isDate(c.date) ? planOn(rows, c.date) : null;
      const problem = checkCheckin(c, plan?.plan ?? null);
      if (problem) return reply({ error: problem, checkin: c }, 422);
      out.push({
        user_id: userId, date: c.date, ref: c.ref, kind: c.kind, status: c.status, plan_version: plan!.version,
        data: c.data ?? {}, note: typeof c.note === "string" ? c.note.slice(0, 1000) : null, source,
        at: typeof c.at === "string" && !Number.isNaN(Date.parse(c.at)) ? c.at : new Date().toISOString(),
      });
    }
    const { error } = await db.from("checkins").insert(out);
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true, saved: out.length });
  }
  if (path === "/api/feedback" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { text?: string; tags?: string[]; date?: string | null; ref?: string | null };
    const problem = checkFeedback(body);
    if (problem) return reply({ error: problem }, 422);
    const rows = await planVersions(db, userId, 5);
    const v = body.date ? planOn(rows, body.date)?.version ?? null : rows[0]?.version ?? null;
    const { data, error } = await db.from("feedback").insert({
      user_id: userId, date: body.date ?? null, ref: body.ref ?? null, plan_version: v, text: (body.text ?? "").trim(), tags: body.tags ?? [], source,
    }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    return reply({ id: data.id });
  }

  if (who.via !== "session") return reply({ error: "this needs the FitLoop app (glasses only show today and check in)" }, 403);

  // ------------------------------------------------------------ plan and history
  if (path === "/api/plan" && req.method === "GET") {
    const rows = await planVersions(db, userId);
    return reply({ current: rows[0] ? published(rows[0]) : null, versions: rows.map((r) => ({ version: r.version, title: r.plan.title, change_note: r.change_note, starts_on: r.starts_on, published_at: r.published_at })) });
  }
  const pv = path.match(/^\/api\/plan\/(\d+)$/);
  if (pv && req.method === "GET") {
    const r = (await planVersions(db, userId, 200)).find((x) => x.version === Number(pv[1]));
    return r ? reply(published(r)) : reply({ error: "no such version" }, 404);
  }
  if (path === "/api/progress" && req.method === "GET") {
    const to = dateParam(url, "to"), from = dateParam(url, "from");
    if (!from || !to || from > to) return reply({ error: "send ?from=YYYY-MM-DD&to=YYYY-MM-DD" }, 400);
    const [rows, checkins, vitals] = await Promise.all([
      planVersions(db, userId, 200), checkinsBetween(db, userId, from, to),
      db.from("vitals").select("date, metric, value, source").eq("user_id", userId).gte("date", from).lte("date", to).order("date"),
    ]);
    return reply({ adherence: adherence(planSpans(rows), checkins, from, to), vitals: vitals.data ?? [] });
  }
  if (path === "/api/checkins" && req.method === "GET") {
    const to = dateParam(url, "to"), from = dateParam(url, "from");
    if (!from || !to) return reply({ error: "send ?from=&to=" }, 400);
    return reply(await checkinsBetween(db, userId, from, to));
  }
  if (path === "/api/feedback" && req.method === "GET") return reply(await feedbackList(db, userId));
  const fb = path.match(/^\/api\/feedback\/([0-9a-f-]{36})$/);
  if (fb && req.method === "DELETE") {
    await db.from("feedback").delete().eq("user_id", userId).eq("id", fb[1]);
    return reply({ ok: true });
  }

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

  // ------------------------------------------------------------ vitals (each source is a switch)
  if (path === "/api/vitals" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as VitalEntry[] | VitalEntry | null;
    const list = Array.isArray(body) ? body : body ? [body] : [];
    if (!list.length || list.length > 500) return reply({ error: "send up to 500 entries" }, 400);
    const { settings } = await loadSettings(db, userId);
    const allowed = { health: settings.vitals.health_daily, manual: settings.vitals.manual, watch: settings.vitals.live_hr };
    const rows = [];
    for (const v of list) {
      const problem = checkVital(v);
      if (problem) return reply({ error: problem, entry: v }, 422);
      const src = v.source ?? "manual";
      if (!(src in allowed)) return reply({ error: "source must be health, manual or watch" }, 422);
      if (!allowed[src as keyof typeof allowed]) return reply({ error: `${src} vitals are switched off in Settings` }, 409);
      rows.push({ user_id: userId, date: v.date, metric: v.metric, value: v.value, source: src, updated_at: new Date().toISOString() });
    }
    const { error } = await db.from("vitals").upsert(rows, { onConflict: "user_id,date,metric,source" });
    if (error) return reply({ error: error.message }, 500);
    return reply({ ok: true, saved: rows.length });
  }
  if (path === "/api/vitals" && req.method === "GET") {
    const to = dateParam(url, "to"), from = dateParam(url, "from");
    if (!from || !to) return reply({ error: "send ?from=&to=" }, 400);
    const { data } = await db.from("vitals").select("date, metric, value, source").eq("user_id", userId).gte("date", from).lte("date", to).order("date");
    return reply({ metrics: METRICS, entries: data ?? [] });
  }
  if (path === "/api/live" && req.method === "PUT") {
    const body = (await req.json().catch(() => ({}))) as { hr?: unknown; workout_ref?: unknown };
    const { settings } = await loadSettings(db, userId);
    if (!settings.vitals.live_hr) return reply({ error: "live heart rate is switched off in Settings" }, 409);
    const hr = body.hr === null ? null : Number(body.hr);
    if (hr !== null && (!Number.isFinite(hr) || hr < 25 || hr > 250)) return reply({ error: "hr must be 25–250 bpm or null" }, 422);
    await db.from("live").upsert({ user_id: userId, hr, workout_ref: typeof body.workout_ref === "string" ? body.workout_ref.slice(0, 80) : null, updated_at: new Date().toISOString() });
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ progress photos (opt-in)
  if (path === "/api/photos" && req.method === "POST") {
    const { settings } = await loadSettings(db, userId);
    if (!settings.vitals.photos) return reply({ error: "progress photos are switched off in Settings" }, 409);
    const type = (req.headers.get("Content-Type") ?? "").split(";")[0];
    if (!["image/jpeg", "image/png", "image/heic"].includes(type)) return reply({ error: "send a JPEG, PNG or HEIC body" }, 415);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) return reply({ error: "a photo up to 10 MB" }, 413);
    const takenOn = dateParam(url, "taken_on", new Date().toISOString().slice(0, 10))!;
    const id = crypto.randomUUID();
    const key = `${userId}/photos/${id}.${type === "image/png" ? "png" : type === "image/heic" ? "heic" : "jpg"}`;
    const up = await db.storage.from(BUCKET).upload(key, bytes, { contentType: type });
    if (up.error) return reply({ error: `upload failed: ${up.error.message}` }, 500);
    const { error } = await db.from("photos").insert({ id, user_id: userId, taken_on: takenOn, path: key, note: url.searchParams.get("note")?.slice(0, 500) ?? null });
    if (error) return reply({ error: error.message }, 500);
    return reply({ id, taken_on: takenOn });
  }
  if (path === "/api/photos" && req.method === "GET") {
    const { data } = await db.from("photos").select("id, taken_on, path, note").eq("user_id", userId).order("taken_on", { ascending: false }).limit(200);
    const rows = data ?? [];
    const signed = rows.length ? (await db.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), PHOTO_URL_TTL_SEC)).data ?? [] : [];
    return reply(rows.map((r, i) => ({ id: r.id, taken_on: r.taken_on, note: r.note, url: signed[i]?.signedUrl ?? null })));
  }
  const ph = path.match(/^\/api\/photos\/([0-9a-f-]{36})$/);
  if (ph && req.method === "DELETE") {
    const { data } = await db.from("photos").select("path").eq("user_id", userId).eq("id", ph[1]).maybeSingle();
    if (data) {
      await db.storage.from(BUCKET).remove([data.path]);
      await db.from("photos").delete().eq("user_id", userId).eq("id", ph[1]);
    }
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ glasses pairing
  if (path === "/api/pairing-code" && req.method === "POST") {
    await db.from("pairing_codes").delete().eq("user_id", userId).is("used_at", null);
    const code = pairingCode();
    const expires = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();
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

  // ------------------------------------------------------------ agent tokens (MCP)
  if (path === "/api/tokens" && req.method === "GET") {
    const { data } = await db.from("access_tokens").select("id, name, created_at, last_used_at").eq("user_id", userId).order("created_at");
    return reply(data ?? []);
  }
  if (path === "/api/tokens" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const token = randomToken(PREFIX.agent);
    const { data, error } = await db.from("access_tokens").insert({ token_hash: await sha256(token), user_id: userId, name: String(body.name ?? "Agent").slice(0, 60) }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    return reply({ id: data.id, token });
  }
  const tok = path.match(/^\/api\/tokens\/([0-9a-f-]{36})$/);
  if (tok && req.method === "DELETE") {
    await db.from("access_tokens").delete().eq("user_id", userId).eq("id", tok[1]);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ delete everything FitLoop keeps
  if (path === "/api/account" && req.method === "DELETE") {
    const failed = await deleteUserData(db, userId);
    return failed ? reply({ error: failed }, 500) : reply({ ok: true });
  }

  return reply({ error: "not found" }, 404);
}
