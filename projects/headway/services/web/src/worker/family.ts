// Family groups (/api/family/*) and their part of the every-minute cron. The rules (who sees what,
// what's due) are @headway/core's family.ts; this file loads the group, checks who may change what,
// and pushes. Nothing about a ride is stored for this: a member's train is read from tracked_trips or
// the on-train KV session at the moment someone asks.
import {
  checkEmail, checkFamilyUpdate, checkGroupName, checkStatus, defaultDisplayName, effectiveFollow, FAMILY_INVITE_DAYS, FAMILY_MAX, familyNotifications,
  liveFollowTrains, memberFromRow, memberView, myShares, normalizeSettings, pruneFollows, STATUS_TEXT, withoutMember,
  type FamilyMember, type FamilyTrain, type Notification, type RealtimeSnapshot, type SharerData,
} from "@headway/core";
import { FOLLOW_ACTIVITY_PREFIX, PUSH_DEVICE_COLUMNS, pushConfigured, sendLiveActivityPush, sendPush, type LiveActivityContentState, type PushResult } from "./push.ts";
import { loadOnTrain, loadSettings, loadSnapshot, type Db, type Env } from "./store.ts";

/** A push that throws (a dropped connection) counts as one failure; it mustn't stop everyone else's. */
const settle = (p: Promise<PushResult>): Promise<PushResult> => p.catch((e: Error) => ({ ok: false, status: 0, reason: e.message, gone: false }));

const MEMBER_COLUMNS = "user_id, group_id, role, display_name, shares, follows, status, joined_at";

export interface FamilyCaller {
  userId: string;
  email?: string;
  name?: string;
}

interface Group {
  id: string;
  name: string;
  owner_id: string;
}

// ---------------------------------------------------------------- loading

/** The caller's group and its members (owner first, then by joining), or null. */
export async function loadGroupOf(db: Db, userId: string, now: number): Promise<{ group: Group; members: FamilyMember[] } | null> {
  const { data: mine } = await db.from("family_members").select("group_id").eq("user_id", userId).maybeSingle();
  if (!mine) return null;
  return loadGroup(db, mine.group_id as string, now);
}

async function loadGroup(db: Db, groupId: string, now: number): Promise<{ group: Group; members: FamilyMember[] } | null> {
  const [{ data: group }, { data: rows }] = await Promise.all([
    db.from("family_groups").select("id, name, owner_id").eq("id", groupId).maybeSingle(),
    db.from("family_members").select(MEMBER_COLUMNS).eq("group_id", groupId).order("joined_at"),
  ]);
  if (!group) return null;
  const members = (rows ?? []).map((r) => memberFromRow(r, now));
  members.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
  return { group: group as Group, members };
}

/** What each sharer is doing right now: their tracked train, a confident ride, their settings. */
async function sharerData(env: Env, db: Db, ids: string[], now: number): Promise<Record<string, SharerData>> {
  const out: Record<string, SharerData> = {};
  if (!ids.length) return out;
  const [{ data: tracked }, { data: profiles }] = await Promise.all([
    db.from("tracked_trips").select("user_id, trip_id, service_date, from_station, to_station").in("user_id", ids),
    db.from("profiles").select("user_id, settings").in("user_id", ids),
  ]);
  await Promise.all(ids.map(async (id) => {
    const t = tracked?.find((x) => x.user_id === id);
    const raw = profiles?.find((p) => p.user_id === id)?.settings;
    const settings = raw ? normalizeSettings(raw) : null;
    const session = settings?.on_train === "off" ? null : await loadOnTrain(env, id);
    const ride = session && !(session.dismissed_until && session.dismissed_until > now) && session.trip_id ? { trip_id: session.trip_id, service_date: session.service_date, confidence: session.confidence } : null;
    out[id] = { tracked: t ? { trip_id: t.trip_id, service_date: t.service_date, from: t.from_station, to: t.to_station } : null, ride, settings };
  }));
  return out;
}

/** Members that share something with `viewer` (only their data needs reading). */
const sharingWith = (members: FamilyMember[], viewerId: string) =>
  members.filter((m) => m.user_id !== viewerId && Object.values(m.shares).some((ids) => ids?.includes(viewerId)));

async function saveMember(db: Db, m: FamilyMember): Promise<void> {
  const { error } = await db.from("family_members").update({ display_name: m.display_name, shares: m.shares, follows: m.follows, status: m.status }).eq("user_id", m.user_id);
  if (error) throw new Error(`couldn't save ${m.user_id}: ${error.message}`);
}

async function pushToUser(env: Env, db: Db, userId: string, n: Notification): Promise<void> {
  if (!pushConfigured(env)) return;
  const { data } = await db.from("push_devices").select(`id, ${PUSH_DEVICE_COLUMNS}`).eq("user_id", userId);
  await Promise.all((data ?? []).map(async (d) => {
    const r = await settle(sendPush(env, d, n));
    if (!r.ok && r.gone) await db.from("push_devices").delete().eq("id", d.id);
  }));
}

// ---------------------------------------------------------------- leaving

/**
 * Takes `userId` out of their group: what they shared disappears at once, others drop them from their
 * shares and follows. The owner leaving deletes the group, and every other member is told.
 */
export async function leaveFamily(env: Env, db: Db, userId: string, now: number): Promise<void> {
  const g = await loadGroupOf(db, userId, now);
  if (!g) return;
  if (g.group.owner_id === userId) {
    await db.from("family_groups").delete().eq("id", g.group.id);
    await Promise.all(g.members.filter((m) => m.user_id !== userId).map((m) => pushToUser(env, db, m.user_id, {
      key: `fam:deleted:${g.group.id}`, kind: "family", priority: true, thread: "family",
      title: "Family group deleted", body: `“${g.group.name}” was deleted by its owner. Nothing you shared there is kept.`,
    })));
    return;
  }
  await db.from("family_members").delete().eq("user_id", userId);
  for (const m of withoutMember(g.members, userId)) await saveMember(db, m);
}

// ---------------------------------------------------------------- the API

const MIN = 60_000;

export async function handleFamily(req: Request, env: Env, db: Db, path: string, who: FamilyCaller, now: number, reply: (body: unknown, status?: number) => Response): Promise<Response | null> {
  const userId = who.userId;
  const email = who.email?.toLowerCase() ?? null;
  const body = async () => (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (path === "/api/family" && req.method === "GET") return reply(await familyState(env, db, who, now));

  if (path === "/api/family" && req.method === "POST") {
    const b = await body();
    const name = checkGroupName(b?.name);
    if (!name) return reply({ error: "a group name is 1–40 characters" }, 400);
    if (await loadGroupOf(db, userId, now)) return reply({ error: "you're already in a family group: leave it first" }, 409);
    const { data: group, error } = await db.from("family_groups").insert({ name, owner_id: userId }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    const { settings } = await loadSettings(db, userId);
    const { error: e2 } = await db.from("family_members").insert({ user_id: userId, group_id: group.id, role: "owner", display_name: defaultDisplayName(b?.display_name as string, settings.share_name, who.name, who.email) });
    if (e2) {
      await db.from("family_groups").delete().eq("id", group.id);
      return reply({ error: e2.code === "23505" ? "you're already in a family group: leave it first" : e2.message }, e2.code === "23505" ? 409 : 500);
    }
    return reply(await familyState(env, db, who, now), 201);
  }

  // Invites to me (accept or decline) need no group.
  const inv = path.match(/^\/api\/family\/invites\/([0-9a-f-]{36})\/(accept|decline)$/);
  if (inv && req.method === "POST") {
    const { data: invite } = await db.from("family_invites").select("id, group_id, email, expires_at").eq("id", inv[1]).maybeSingle();
    if (!invite || !email || invite.email !== email || new Date(invite.expires_at).getTime() < now) return reply({ error: "that invite isn't for you, or it expired" }, 404);
    if (inv[2] === "decline") {
      await db.from("family_invites").delete().eq("id", invite.id);
      return reply(await familyState(env, db, who, now));
    }
    if (await loadGroupOf(db, userId, now)) return reply({ error: "leave your current family group before joining another" }, 409);
    const { count } = await db.from("family_members").select("user_id", { count: "exact", head: true }).eq("group_id", invite.group_id);
    if ((count ?? 0) >= FAMILY_MAX) return reply({ error: `that group is full (${FAMILY_MAX} people)` }, 409);
    const { settings } = await loadSettings(db, userId);
    const { error } = await db.from("family_members").insert({ user_id: userId, group_id: invite.group_id, role: "member", display_name: defaultDisplayName(settings.share_name, who.name, who.email) });
    if (error) return reply({ error: error.code === "23505" ? "leave your current family group before joining another" : error.message }, error.code === "23505" ? 409 : 500);
    await db.from("family_invites").delete().eq("id", invite.id);
    return reply(await familyState(env, db, who, now));
  }

  const g = await loadGroupOf(db, userId, now);
  if (!g) return path.startsWith("/api/family") ? reply({ error: "you're not in a family group" }, 404) : null;
  const isOwner = g.group.owner_id === userId;
  const me = g.members.find((m) => m.user_id === userId)!;

  if (path === "/api/family" && req.method === "PUT") {
    if (!isOwner) return reply({ error: "only the group's owner can rename it" }, 403);
    const name = checkGroupName((await body())?.name);
    if (!name) return reply({ error: "a group name is 1–40 characters" }, 400);
    await db.from("family_groups").update({ name }).eq("id", g.group.id);
    return reply(await familyState(env, db, who, now));
  }
  if (path === "/api/family" && req.method === "DELETE") {
    await leaveFamily(env, db, userId, now);
    return reply(await familyState(env, db, who, now));
  }

  if (path === "/api/family/invites" && req.method === "POST") {
    if (!isOwner) return reply({ error: "only the group's owner can invite people" }, 403);
    const address = checkEmail((await body())?.email);
    if (!address) return reply({ error: "that doesn't look like an email address" }, 400);
    if (address === email) return reply({ error: "that's your own address" }, 400);
    const { data: pending } = await db.from("family_invites").select("id, email").eq("group_id", g.group.id).gt("expires_at", new Date(now).toISOString());
    const again = pending?.some((p) => p.email === address);
    if (!again && g.members.length + (pending?.length ?? 0) >= FAMILY_MAX) return reply({ error: `a family group has at most ${FAMILY_MAX} people, counting pending invites` }, 409);
    const expires_at = new Date(now + FAMILY_INVITE_DAYS * 24 * 60 * MIN).toISOString();
    const { data: row, error } = await db.from("family_invites").upsert({ group_id: g.group.id, email: address, invited_by: userId, expires_at, created_at: new Date().toISOString() }, { onConflict: "group_id,email" }).select("id").single();
    if (error) return reply({ error: error.message }, 500);
    // The same answer whether or not that address uses Headway: nobody can find out who does.
    const { data: users } = await db.rpc("push_users_by_email", { p_email: address });
    for (const u of (users ?? []) as { user_id: string }[]) {
      await pushToUser(env, db, u.user_id, {
        key: `fam:invite:${row.id}`, kind: "family", priority: true, thread: "family",
        title: "Family group invite", body: `${me.display_name} invited you to “${g.group.name}”. Open Headway to accept.`,
      });
    }
    return reply(await familyState(env, db, who, now), 201);
  }
  const cancel = path.match(/^\/api\/family\/invites\/([0-9a-f-]{36})$/);
  if (cancel && req.method === "DELETE") {
    if (!isOwner) return reply({ error: "only the group's owner can cancel invites" }, 403);
    await db.from("family_invites").delete().eq("id", cancel[1]).eq("group_id", g.group.id);
    return reply(await familyState(env, db, who, now));
  }

  const rm = path.match(/^\/api\/family\/members\/([0-9a-f-]{36})$/);
  if (rm && req.method === "DELETE") {
    if (!isOwner) return reply({ error: "only the group's owner can remove people" }, 403);
    if (rm[1] === userId) return reply({ error: "to leave, delete the group" }, 400);
    if (!g.members.some((m) => m.user_id === rm[1])) return reply({ error: "not in your group" }, 404);
    await db.from("family_members").delete().eq("user_id", rm[1]).eq("group_id", g.group.id);
    for (const m of withoutMember(g.members, rm[1])) await saveMember(db, m);
    return reply(await familyState(env, db, who, now));
  }

  if (path === "/api/family/me" && req.method === "PUT") {
    const { issues, update } = checkFamilyUpdate(await body(), userId, g.members.map((m) => m.user_id));
    if (issues.length) return reply({ error: "those family settings have problems", issues }, 422);
    const next: FamilyMember = { ...me, ...update };
    await saveMember(db, next);
    if (update.shares) {
      // Someone taken off a share stops following it at once.
      for (const m of pruneFollows(g.members.map((x) => (x.user_id === userId ? next : x)))) {
        if (m.user_id !== userId) await saveMember(db, m);
      }
    }
    return reply(await familyState(env, db, who, now));
  }

  if (path === "/api/family/status" && req.method === "PUT") {
    const b = await body();
    const s = checkStatus(b?.code, b?.minutes, now);
    if (typeof s === "string") return reply({ error: s }, 400);
    await saveMember(db, { ...me, status: s });
    return reply(await familyState(env, db, who, now));
  }
  if (path === "/api/family/status" && req.method === "DELETE") {
    await saveMember(db, { ...me, status: null });
    return reply(await familyState(env, db, who, now));
  }

  return null;
}

/** Everything the Family screen shows the caller. */
export async function familyState(env: Env, db: Db, who: FamilyCaller, now: number) {
  const email = who.email?.toLowerCase() ?? null;
  const [g, { data: toMe }] = await Promise.all([
    loadGroupOf(db, who.userId, now),
    email ? db.from("family_invites").select("id, group_id, invited_by, expires_at").eq("email", email).gt("expires_at", new Date(now).toISOString()) : Promise.resolve({ data: [] as { id: string; group_id: string; invited_by: string; expires_at: string }[] }),
  ]);
  // Invites name the group and who sent them.
  const invites = [];
  for (const i of toMe ?? []) {
    const [{ data: grp }, { data: from }] = await Promise.all([
      db.from("family_groups").select("name").eq("id", i.group_id).maybeSingle(),
      db.from("family_members").select("display_name").eq("user_id", i.invited_by).maybeSingle(),
    ]);
    if (grp && g?.group.id !== i.group_id) invites.push({ id: i.id, group_name: grp.name, from_name: from?.display_name ?? "Someone", expires_at: i.expires_at });
  }
  const { settings } = await loadSettings(db, who.userId);
  const base = { email: who.email ?? null, suggested_name: defaultDisplayName(settings.share_name, who.name, who.email), max: FAMILY_MAX, invites };
  if (!g) return { ...base, group: null, me: null };

  const me = g.members.find((m) => m.user_id === who.userId)!;
  const snapshot = await loadSnapshot(db);
  const data = await sharerData(env, db, sharingWith(g.members, me.user_id).map((m) => m.user_id), now);
  const owner = g.group.owner_id === who.userId;
  const { data: pending } = owner
    ? await db.from("family_invites").select("id, email, expires_at").eq("group_id", g.group.id).gt("expires_at", new Date(now).toISOString()).order("created_at")
    : { data: [] };
  return {
    ...base,
    group: {
      id: g.group.id, name: g.group.name, owner,
      members: g.members.map((m) => memberView(me, m, data[m.user_id] ?? null, now, snapshot)),
      pending_invites: pending ?? [],
    },
    me: { display_name: me.display_name, role: me.role, shares: myShares(me, g.members), status: me.status ? { ...me.status, text: STATUS_TEXT[me.status.code] } : null },
  };
}

// ---------------------------------------------------------------- the cron

export interface FamilyCronReport {
  sent: number;
  failed: number;
}

const followKey = (sharerId: string, train: Pick<FamilyTrain, "trip_id">) => `${FOLLOW_ACTIVITY_PREFIX}${sharerId}:${train.trip_id}`;

function contentState(train: FamilyTrain): LiveActivityContentState {
  return { pred_arr: train.pred_arr, delay_min: train.delay_min, next: train.next?.name ?? null, next_pred: train.next?.pred ?? null, stops_left: train.stops_left, cancelled: train.cancelled, arrived: train.arrived };
}

/**
 * Every minute, before the per-user alerts (so a train that just arrived is still tracked): what each
 * viewer follows of the others, pushed; and the Lock Screen activities of followed trains, started,
 * updated and ended.
 */
export async function runFamilyCron(env: Env, db: Db, snapshot: RealtimeSnapshot | null, now: Date, report: FamilyCronReport): Promise<void> {
  const t = now.getTime();
  const { data: rows } = await db.from("family_members").select(MEMBER_COLUMNS);
  const { data: followTokens } = await db.from("activity_tokens").select("user_id, token, trip_id, environment").eq("kind", "update").like("trip_id", `${FOLLOW_ACTIVITY_PREFIX}%`);
  const groups = new Map<string, FamilyMember[]>();
  for (const r of rows ?? []) {
    const list = groups.get(r.group_id as string) ?? [];
    list.push(memberFromRow(r, t));
    groups.set(r.group_id as string, list);
  }

  // Who follows whom: only those sharers' data is read.
  const viewers: { viewer: FamilyMember; members: FamilyMember[] }[] = [];
  const sharerIds = new Set<string>();
  for (const members of groups.values()) {
    for (const viewer of members) {
      const followed = members.filter((s) => s.user_id !== viewer.user_id && (() => { const f = effectiveFollow(viewer, s); return f.notify.length > 0 || f.live; })());
      if (!followed.length) continue;
      viewers.push({ viewer, members });
      followed.forEach((s) => sharerIds.add(s.user_id));
    }
  }
  const live = new Set<string>();
  if (viewers.length) {
    const data = await sharerData(env, db, [...sharerIds], t);
    const ids = viewers.map((v) => v.viewer.user_id);
    const since = new Date(t - 2 * 86400_000).toISOString();
    const [{ data: devices }, { data: sent }, { data: startTokens }] = await Promise.all([
      db.from("push_devices").select(`id, user_id, ${PUSH_DEVICE_COLUMNS}`).in("user_id", ids),
      db.from("sent_notifications").select("user_id, key").in("user_id", ids).like("key", "fam:%").gte("sent_at", since),
      db.from("activity_tokens").select("user_id, token, environment").eq("kind", "start").in("user_id", ids),
    ]);

    for (const { viewer, members } of viewers) {
      const vid = viewer.user_id;
      const keys = new Set((sent ?? []).filter((s) => s.user_id === vid).map((s) => s.key as string));
      const { notifications, folded } = familyNotifications({ now: t, viewer, members, data, snapshot, sent: keys });
      const record = [...notifications.map((n) => n.key), ...folded];
      if (record.length) await db.from("sent_notifications").upsert(record.map((key) => ({ user_id: vid, key, sent_at: now.toISOString() })), { ignoreDuplicates: true });
      for (const d of (devices ?? []).filter((x) => x.user_id === vid)) {
        for (const n of notifications) {
          const r = await settle(sendPush(env, d, n));
          if (r.ok) report.sent++;
          else {
            report.failed++;
            if (r.gone) { await db.from("push_devices").delete().eq("id", d.id); break; }
          }
        }
      }

      // Lock Screen: one activity per followed train, started by push the first time.
      for (const { sharer, train } of liveFollowTrains(viewer, members, data, t, snapshot)) {
        const key = followKey(sharer.user_id, train);
        live.add(`${vid}|${key}`);
        const mine = (followTokens ?? []).filter((x) => x.user_id === vid && x.trip_id === key);
        const isEnd = train.arrived || train.cancelled;
        for (const tok of mine) {
          const r = await settle(sendLiveActivityPush(env, { token: tok.token, environment: tok.environment }, {
            event: isEnd ? "end" : "update", dismissalDate: isEnd ? Math.floor(t / 1000) + 900 : undefined, contentState: contentState(train),
          }));
          if (r.ok) report.sent++; else report.failed++;
          if (isEnd || (!r.ok && r.gone)) await db.from("activity_tokens").delete().eq("token", tok.token);
        }
        const startKey = `fam:la:${sharer.user_id}:${train.service_date}:${train.trip_id}`;
        const start = (startTokens ?? []).find((x) => x.user_id === vid);
        if (!mine.length && start && !isEnd && !keys.has(startKey)) {
          await db.from("sent_notifications").upsert({ user_id: vid, key: startKey, sent_at: now.toISOString() }, { ignoreDuplicates: true });
          const r = await settle(sendLiveActivityPush(env, { token: start.token, environment: start.environment }, {
            event: "start", attributes: { trip_id: key, train: train.train, kind: train.kind, to: train.to.name, who: sharer.display_name }, contentState: contentState(train),
          }));
          if (r.ok) report.sent++;
          else if (r.gone) await db.from("activity_tokens").delete().eq("token", start.token);
        }
      }
    }
  }

  // Followed-train activities nobody may follow any more (unshared, unfollowed, left, the ride ended): end them.
  for (const tok of followTokens ?? []) {
    if (live.has(`${tok.user_id}|${tok.trip_id}`)) continue;
    await settle(sendLiveActivityPush(env, { token: tok.token, environment: tok.environment }, {
      event: "end", dismissalDate: Math.floor(t / 1000), contentState: { pred_arr: t, delay_min: null, next: null, next_pred: null, stops_left: 0, cancelled: false, arrived: true },
    }));
    await db.from("activity_tokens").delete().eq("token", tok.token);
  }
}
