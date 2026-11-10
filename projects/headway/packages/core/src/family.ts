// Family groups: who in the group sees what, and which notifications each viewer is due. Pure (the
// Worker loads the group and calls these), so every rule is tested.
//
// Two sides, both opt-in:
//   the sharer  turns a share on and picks which members see it (`shares`: kind -> viewer ids).
//               Everything is off until then.
//   the viewer  sees what's shared with them, and picks what to be told about (`follows`: sharer id ->
//               { notify: kinds, live }). Nothing is sent until they do.
//
// Share kinds:
//   trip     the train they track (tracking it on any surface, or "I'm on this train")
//   ride     the train Headway is sure they're on (on-train detection with high confidence only)
//   commute  disruptions to their usual train (late, cancelled): never their stations or times
//   status   a status they set by hand ("Running late"), for as long as they choose
//
// Only the current state exists: nothing here keeps a history.
import { ALERT_LOOKAHEAD_MS, DELAY_STEP_MIN, trainName, type Notification } from "./alerts.ts";
import { onTrainCard } from "./ontrain.ts";
import { departures, progress } from "./schedule.ts";
import { atLocal, clock, hhmm, zoned } from "./time.ts";
import type { Direction, OnTrainMatch, RealtimeSnapshot, ServiceKind, Settings, Station, Tracked } from "./types.ts";

const MIN = 60_000;

/** People in a group, counting pending invites. */
export const FAMILY_MAX = 8;
export const FAMILY_INVITE_DAYS = 7;
/** A shared train is late enough to tell followers about. */
export const FAMILY_DELAY_MIN = 5;
/** "Arrived" is still news this long after the arrival. */
const ARRIVED_NEWS_MS = 15 * MIN;

export const SHARE_KINDS = ["trip", "ride", "commute", "status"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
const TRAIN_KINDS: ShareKind[] = ["trip", "ride"];

export const STATUS_CODES = ["on_my_way", "running_late", "missed_train", "made_it", "home"] as const;
export type StatusCode = (typeof STATUS_CODES)[number];
export const STATUS_TEXT: Record<StatusCode, string> = {
  on_my_way: "On my way",
  running_late: "Running late",
  missed_train: "Missed my train, taking the next",
  made_it: "Made it",
  home: "Home",
};
/** How long a status may last; the apps offer these, 30 minutes first. */
export const STATUS_MINUTES = [15, 30, 60, 120, 240] as const;
export const DEFAULT_STATUS_MINUTES = 30;

/** Kind -> the member ids who see it. A kind that's absent is off. */
export type FamilyShares = Partial<Record<ShareKind, string[]>>;
export interface FollowPrefs {
  /** Kinds to be notified about (only those shared with you count). */
  notify: ShareKind[];
  /** Put their train on your Lock Screen as a Live Activity whenever they ride (iPhone). */
  live: boolean;
}
/** Sharer id -> what you follow of theirs. */
export type FamilyFollows = Record<string, FollowPrefs>;

export interface ManualStatus {
  code: StatusCode;
  /** epoch ms */
  set_at: number;
  until: number;
}

export interface FamilyMember {
  user_id: string;
  role: "owner" | "member";
  display_name: string;
  shares: FamilyShares;
  follows: FamilyFollows;
  status: ManualStatus | null;
  joined_at?: string;
}

/** What the Worker knows about a sharer right now (nothing is stored for this). */
export interface SharerData {
  tracked: Tracked | null;
  /** The on-train session; only `high` confidence counts as a ride. */
  ride: OnTrainMatch | null;
  settings: Settings | null;
}

export interface FamilyTrain {
  /** Which share it comes from. */
  source: "trip" | "ride";
  trip_id: string;
  service_date: string;
  train: string;
  kind: ServiceKind;
  dir: Direction;
  to: Pick<Station, "id" | "name" | "short">;
  next: { id: string; name: string; short: string; pred: number } | null;
  pred_arr: number;
  arr: number;
  delay_min: number | null;
  stops_left: number;
  cancelled: boolean;
  arrived: boolean;
  live: boolean;
}

/** Their usual train is late or cancelled. Deliberately no stations or times. */
export interface CommuteDisruption {
  leg: "morning" | "evening";
  trip_id: string;
  service_date: string;
  cancelled: boolean;
  delay_min: number | null;
}

export interface StatusView extends ManualStatus {
  text: string;
}

/** One member as another member sees them. */
export interface MemberView {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  me: boolean;
  /** What they share with you (empty: you see their name only). */
  shared_with_me: ShareKind[];
  train: FamilyTrain | null;
  commute: Omit<CommuteDisruption, "trip_id" | "service_date"> | null;
  status: StatusView | null;
  /** What you follow of theirs, limited to what they share with you. */
  follow: FollowPrefs;
}

/** One of your shares as you see it: who sees it, and who of them asked to be told. */
export interface MyShare {
  kind: ShareKind;
  on: boolean;
  viewers: string[];
  notified: string[];
  live: string[];
}

// ---------------------------------------------------------------- reading stored rows

const isKind = (v: unknown): v is ShareKind => typeof v === "string" && (SHARE_KINDS as readonly string[]).includes(v);
const isStatus = (v: unknown): v is StatusCode => typeof v === "string" && (STATUS_CODES as readonly string[]).includes(v);
const uniq = <T>(xs: T[]) => [...new Set(xs)];

export function normalizeShares(raw: unknown): FamilyShares {
  const out: FamilyShares = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isKind(k) && Array.isArray(v)) out[k] = uniq(v.filter((x): x is string => typeof x === "string"));
  }
  return out;
}

export function normalizeFollows(raw: unknown): FamilyFollows {
  const out: FamilyFollows = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const f = v as Partial<FollowPrefs>;
    const notify = Array.isArray(f.notify) ? uniq(f.notify.filter(isKind)) : [];
    const live = f.live === true;
    if (notify.length || live) out[id] = { notify, live };
  }
  return out;
}

export function normalizeStatus(raw: unknown, now: number): ManualStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<ManualStatus>;
  if (!isStatus(s.code) || typeof s.until !== "number" || typeof s.set_at !== "number") return null;
  return s.until > now ? { code: s.code, set_at: s.set_at, until: s.until } : null;
}

/** A member row from the database, its JSON columns checked. */
export function memberFromRow(row: { user_id: string; role: string; display_name: string; shares?: unknown; follows?: unknown; status?: unknown; joined_at?: string }, now: number): FamilyMember {
  return {
    user_id: row.user_id,
    role: row.role === "owner" ? "owner" : "member",
    display_name: row.display_name,
    shares: normalizeShares(row.shares),
    follows: normalizeFollows(row.follows),
    status: normalizeStatus(row.status, now),
    joined_at: row.joined_at,
  };
}

// ---------------------------------------------------------------- who sees what

/** The kinds `sharer` shares with `viewerId`. */
export function visibleKinds(sharer: Pick<FamilyMember, "shares" | "user_id">, viewerId: string): ShareKind[] {
  if (sharer.user_id === viewerId) return [];
  return SHARE_KINDS.filter((k) => sharer.shares[k]?.includes(viewerId));
}

/** What `viewer` follows of `sharer`, limited to what's shared with them right now. */
export function effectiveFollow(viewer: Pick<FamilyMember, "follows" | "user_id">, sharer: Pick<FamilyMember, "shares" | "user_id">): FollowPrefs {
  const visible = visibleKinds(sharer, viewer.user_id);
  const f = viewer.follows[sharer.user_id];
  if (!f) return { notify: [], live: false };
  return { notify: f.notify.filter((k) => visible.includes(k)), live: f.live && visible.some((k) => TRAIN_KINDS.includes(k)) };
}

/** The train a sharer is on, from the shares a viewer may see (a tracked train first). */
export function familyTrain(kinds: ShareKind[], data: SharerData, now: number, snapshot: RealtimeSnapshot | null): FamilyTrain | null {
  if (kinds.includes("trip") && data.tracked) {
    const p = progress(data.tracked, now, snapshot);
    if (p) {
      return {
        source: "trip", trip_id: p.trip_id, service_date: p.service_date, train: p.train, kind: p.kind, dir: p.dir, to: p.to, next: p.next,
        pred_arr: p.pred_arr, arr: p.arr, delay_min: p.delay_min, stops_left: p.stops_left, cancelled: p.cancelled, arrived: p.arrived, live: p.live,
      };
    }
  }
  if (kinds.includes("ride") && data.ride && data.ride.confidence === "high") {
    const c = onTrainCard(data.ride, data.settings, data.tracked, now, snapshot);
    if (c) {
      return {
        source: "ride", trip_id: c.trip_id, service_date: c.service_date, train: c.train, kind: c.kind, dir: c.dir, to: c.to, next: c.next,
        pred_arr: c.pred_arr, arr: c.arr, delay_min: c.delay_min, stops_left: c.stops_left, cancelled: false, arrived: false, live: c.live,
      };
    }
  }
  return null;
}

/**
 * Their usual train (the first at or after a leg's usual time, today, on their days, inside that leg's
 * window) when it's cancelled or at least FAMILY_DELAY_MIN late, from 90 minutes before it leaves
 * until it arrives. A leg without a usual time has no usual train.
 */
export function commuteDisruption(settings: Settings | null, now: number, snapshot: RealtimeSnapshot | null): CommuteDisruption | null {
  if (!settings) return null;
  const z = zoned(now);
  if (!settings.days.includes(z.weekday)) return null;
  for (const name of ["morning", "evening"] as const) {
    const leg = settings[name];
    if (!leg?.usual) continue;
    const start = hhmm(leg.window.start) ?? 0, end = hhmm(leg.window.end) ?? 0;
    if (z.minuteOfDay < start || z.minuteOfDay > end) continue;
    const usual = atLocal(z.date, leg.usual);
    const pref = leg.express_preference ?? settings.express_preference ?? "all";
    const t = departures(leg.from, leg.to, now, snapshot, { lookbackMs: 4 * 60 * MIN, after: usual, limit: 4, expressPreference: pref })
      .find((x) => x.service_date === z.date);
    if (!t || t.dep - now > ALERT_LOOKAHEAD_MS || t.pred_arr < now) continue;
    const cancelled = t.status === "cancelled";
    if (cancelled || (t.delay_min !== null && t.delay_min >= FAMILY_DELAY_MIN)) {
      return { leg: name, trip_id: t.trip_id, service_date: t.service_date, cancelled, delay_min: t.delay_min };
    }
  }
  return null;
}

/** `sharer` as `viewer` sees them. */
export function memberView(viewer: FamilyMember, sharer: FamilyMember, data: SharerData | null, now: number, snapshot: RealtimeSnapshot | null): MemberView {
  const me = viewer.user_id === sharer.user_id;
  const kinds = visibleKinds(sharer, viewer.user_id);
  const d = data ?? { tracked: null, ride: null, settings: null };
  const commute = kinds.includes("commute") ? commuteDisruption(d.settings, now, snapshot) : null;
  const status = kinds.includes("status") && sharer.status && sharer.status.until > now ? { ...sharer.status, text: STATUS_TEXT[sharer.status.code] } : null;
  return {
    user_id: sharer.user_id, display_name: sharer.display_name, role: sharer.role, me,
    shared_with_me: kinds,
    train: familyTrain(kinds, d, now, snapshot),
    commute: commute ? { leg: commute.leg, cancelled: commute.cancelled, delay_min: commute.delay_min } : null,
    status,
    follow: me ? { notify: [], live: false } : effectiveFollow(viewer, sharer),
  };
}

/** Your shares: who sees each, and who of them is notified or follows it live. */
export function myShares(me: FamilyMember, members: FamilyMember[]): MyShare[] {
  return SHARE_KINDS.map((kind) => {
    const viewers = me.shares[kind] ?? [];
    const others = members.filter((m) => viewers.includes(m.user_id));
    return {
      kind, on: me.shares[kind] !== undefined, viewers,
      notified: others.filter((m) => effectiveFollow(m, me).notify.includes(kind)).map((m) => m.user_id),
      live: TRAIN_KINDS.includes(kind) ? others.filter((m) => effectiveFollow(m, me).live).map((m) => m.user_id) : [],
    };
  });
}

// ---------------------------------------------------------------- changes

export interface FamilyIssue {
  path: string;
  message: string;
}

export interface FamilyUpdate {
  display_name?: string;
  shares?: FamilyShares;
  follows?: FamilyFollows;
}

export function checkDisplayName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s.length >= 1 && s.length <= 20 ? s : null;
}

export function checkGroupName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s.length >= 1 && s.length <= 40 ? s : null;
}

/** A plausible email address, lowercased (invites match the address someone signs in with). */
export function checkEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

/** The name a new member starts with: the ETA share name, the sign-in name, the email's first part. */
export function defaultDisplayName(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const n = checkDisplayName(c?.includes("@") ? c.split("@")[0] : c);
    if (n) return n.slice(0, 20);
  }
  return "Member";
}

/** Checks a member's change to their own row against the group. Ids must be other members. */
export function checkFamilyUpdate(body: unknown, meId: string, memberIds: string[]): { issues: FamilyIssue[]; update: FamilyUpdate } {
  const issues: FamilyIssue[] = [];
  const update: FamilyUpdate = {};
  if (!body || typeof body !== "object") return { issues: [{ path: "", message: "send { display_name?, shares?, follows? }" }], update };
  const b = body as Record<string, unknown>;
  const others = memberIds.filter((id) => id !== meId);
  if (b.display_name !== undefined) {
    const n = checkDisplayName(b.display_name);
    if (n) update.display_name = n;
    else issues.push({ path: "display_name", message: "must be 1–20 characters" });
  }
  if (b.shares !== undefined) {
    if (!b.shares || typeof b.shares !== "object" || Array.isArray(b.shares)) issues.push({ path: "shares", message: "must be an object of kind -> member ids" });
    else {
      const shares: FamilyShares = {};
      for (const [k, v] of Object.entries(b.shares as Record<string, unknown>)) {
        if (!isKind(k)) { issues.push({ path: `shares.${k}`, message: `unknown kind (${SHARE_KINDS.join(", ")})` }); continue; }
        if (v === null) continue;
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !others.includes(x))) { issues.push({ path: `shares.${k}`, message: "must list other members of your group" }); continue; }
        shares[k] = uniq(v as string[]);
      }
      update.shares = shares;
    }
  }
  if (b.follows !== undefined) {
    if (!b.follows || typeof b.follows !== "object" || Array.isArray(b.follows)) issues.push({ path: "follows", message: "must be an object of member id -> { notify, live }" });
    else {
      const follows: FamilyFollows = {};
      for (const [id, v] of Object.entries(b.follows as Record<string, unknown>)) {
        if (!others.includes(id)) { issues.push({ path: `follows.${id}`, message: "not another member of your group" }); continue; }
        const f = v as Partial<FollowPrefs> | null;
        if (!f || typeof f !== "object" || !Array.isArray(f.notify) || f.notify.some((k) => !isKind(k)) || (f.live !== undefined && typeof f.live !== "boolean")) {
          issues.push({ path: `follows.${id}`, message: "must be { notify: kinds, live: true|false }" });
          continue;
        }
        if (f.notify.length || f.live) follows[id] = { notify: uniq(f.notify), live: f.live === true };
      }
      update.follows = follows;
    }
  }
  return { issues, update };
}

export function checkStatus(code: unknown, minutes: unknown, now: number): ManualStatus | string {
  if (!isStatus(code)) return `code must be one of ${STATUS_CODES.join(", ")}`;
  const m = minutes === undefined || minutes === null ? DEFAULT_STATUS_MINUTES : minutes;
  if (typeof m !== "number" || !(STATUS_MINUTES as readonly number[]).includes(m)) return `minutes must be one of ${STATUS_MINUTES.join(", ")}`;
  return { code, set_at: now, until: now + m * MIN };
}

/**
 * Following only counts what's shared with you, and taking someone off a share ends their
 * subscription to it at once: the members whose `follows` change once nothing stale is kept.
 */
export function pruneFollows(members: FamilyMember[]): FamilyMember[] {
  const changed: FamilyMember[] = [];
  for (const viewer of members) {
    const next: FamilyFollows = {};
    for (const [id, f] of Object.entries(viewer.follows)) {
      const sharer = members.find((m) => m.user_id === id);
      if (!sharer) continue;
      const e = effectiveFollow(viewer, sharer);
      if (e.notify.length || e.live) next[id] = e;
    }
    if (JSON.stringify(next) !== JSON.stringify(viewer.follows)) changed.push({ ...viewer, follows: next });
  }
  return changed;
}

/** The others once `userId` has left: they're dropped from every share and follow. Returns the rows that change. */
export function withoutMember(members: FamilyMember[], userId: string): FamilyMember[] {
  const changed: FamilyMember[] = [];
  for (const m of members) {
    if (m.user_id === userId) continue;
    const shares: FamilyShares = {};
    for (const k of SHARE_KINDS) if (m.shares[k]) shares[k] = m.shares[k]!.filter((id) => id !== userId);
    const follows = { ...m.follows };
    delete follows[userId];
    if (JSON.stringify(shares) !== JSON.stringify(m.shares) || JSON.stringify(follows) !== JSON.stringify(m.follows)) changed.push({ ...m, shares, follows });
  }
  return changed;
}

// ---------------------------------------------------------------- notifications

export interface FamilyAlertInput {
  now: number;
  viewer: FamilyMember;
  members: FamilyMember[];
  /** By user id; members without data have nothing to share right now. */
  data: Record<string, SharerData>;
  snapshot: RealtimeSnapshot | null;
  /** Keys already sent to the viewer. */
  sent: Set<string>;
}

export interface FamilyAlertResult {
  notifications: Notification[];
  /** Keys folded into another notification: record them so they aren't sent on their own later. */
  folded: string[];
}

const family = (sharerId: string, key: string, title: string, body: string): Notification => ({
  key: `fam:${sharerId}:${key}`, kind: "family", priority: true, thread: `family:${sharerId}`, title, body,
});

/** What a viewer is due about everyone they follow. */
export function familyNotifications(input: FamilyAlertInput): FamilyAlertResult {
  const { now, viewer, members, data, snapshot, sent } = input;
  const out: Notification[] = [];
  const folded: string[] = [];
  for (const sharer of members) {
    if (sharer.user_id === viewer.user_id) continue;
    const follow = effectiveFollow(viewer, sharer);
    if (!follow.notify.length) continue;
    const name = sharer.display_name;
    const d = data[sharer.user_id] ?? { tracked: null, ride: null, settings: null };
    const sid = sharer.user_id;

    const train = familyTrain(follow.notify.filter((k) => TRAIN_KINDS.includes(k)), d, now, snapshot);
    if (train) {
      const id = `${train.service_date}:${train.trip_id}`;
      const tn = trainName(train);
      const late = train.delay_min !== null && train.delay_min >= FAMILY_DELAY_MIN ? train.delay_min : null;
      const lateKey = late !== null ? `fam:${sid}:late:${id}:${Math.floor((late - FAMILY_DELAY_MIN) / DELAY_STEP_MIN)}` : null;
      if (train.cancelled) {
        out.push(family(sid, `cancel:${id}`, `${name}'s train is cancelled`, `${tn} to ${train.to.name} was cancelled.`));
      } else if (train.arrived) {
        if (now - train.pred_arr <= ARRIVED_NEWS_MS) out.push(family(sid, `arr:${id}`, `${name} arrived at ${train.to.name}`, `${tn} arrived ${clock(train.pred_arr)}.`));
      } else {
        const onKey = `fam:${sid}:on:${id}`;
        if (!sent.has(onKey)) {
          out.push(family(sid, `on:${id}`, `${name} is on ${tn}`, `To ${train.to.name}, arriving ${clock(train.pred_arr)}${late !== null ? ` (${late} min late)` : ""}.`));
          if (lateKey) folded.push(lateKey);
        } else if (lateKey) {
          out.push({ ...family(sid, "", `${name}'s train is ${late} min late`, `${tn} now arrives ${train.to.name} ${clock(train.pred_arr)}.`), key: lateKey });
        }
      }
    }

    if (follow.notify.includes("commute")) {
      const c = commuteDisruption(d.settings, now, snapshot);
      // Riding it already shows as their train.
      if (c && !(train && train.trip_id === c.trip_id)) {
        const id = `${c.service_date}:${c.trip_id}`;
        if (c.cancelled) out.push(family(sid, `commute:${id}:cancel`, `${name}'s usual ${c.leg} train is cancelled`, "It won't run today."));
        else out.push(family(sid, `commute:${id}:late:${Math.floor((c.delay_min! - FAMILY_DELAY_MIN) / DELAY_STEP_MIN)}`, `${name}'s usual ${c.leg} train is ${c.delay_min} min late`, "Running late today."));
      }
    }

    if (follow.notify.includes("status") && sharer.status && sharer.status.until > now) {
      const s = sharer.status;
      out.push(family(sid, `status:${s.set_at}`, `${name}: ${STATUS_TEXT[s.code]}`, `Until ${clock(s.until)}.`));
    }
  }
  const seen = new Set<string>();
  return { notifications: out.filter((n) => !sent.has(n.key) && !seen.has(n.key) && seen.add(n.key)), folded };
}

/** The trains a viewer follows live (Lock Screen): one per sharer riding. */
export function liveFollowTrains(viewer: FamilyMember, members: FamilyMember[], data: Record<string, SharerData>, now: number, snapshot: RealtimeSnapshot | null): { sharer: FamilyMember; train: FamilyTrain }[] {
  const out: { sharer: FamilyMember; train: FamilyTrain }[] = [];
  for (const sharer of members) {
    if (sharer.user_id === viewer.user_id) continue;
    const f = effectiveFollow(viewer, sharer);
    if (!f.live) continue;
    const train = familyTrain(visibleKinds(sharer, viewer.user_id).filter((k) => TRAIN_KINDS.includes(k)), data[sharer.user_id] ?? { tracked: null, ride: null, settings: null }, now, snapshot);
    if (train) out.push({ sharer, train });
  }
  return out;
}
