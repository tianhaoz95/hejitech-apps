// The alert engine: which notifications one user is due right now. Pure (the Worker's cron runs it
// every minute with the latest snapshot and the keys it already sent), so every rule is tested.
//
//   delay         a train on a watched leg is ≥ threshold minutes late (again when 5 more minutes worse)
//   cancellation  a train on a watched leg is cancelled or skips one of the leg's stations
//   service       a Caltrain alert naming one of the leg's stations, or the whole system
//   leave_now     the first train at or after the leg's usual time: when it's walk_minutes away
//   arrival       the tracked train is arrival_minutes from its stop (any day, any time)
//
// Legs are watched only on the chosen days and inside their window; the arrival alert follows
// the tracked train whenever it runs.
//
// Priority: a notification is priority when it affects your commute, so your direction inside your
// watch window (and everything about the train you track). `alerts.scope = "all"` adds the rest for
// your stations, the other way or at other times, on your commute days: quiet, with their own
// `q:` keys so a train that later becomes priority still gets its normal alert.
import { departures, progress, relevantAlerts, station, TIMETABLE, TRAVEL_WORD } from "./schedule.ts";
import { atLocal, clock, hhmm, serviceDayStart, zoned } from "./time.ts";
import type { BoardTrain, Direction, Leg, RealtimeSnapshot, ServiceAlert, Settings, Tracked } from "./types.ts";

const MIN = 60_000;
/** Delay and cancellation alerts only for trains leaving within this long. */
export const ALERT_LOOKAHEAD_MS = 90 * MIN;
/** A worse delay is announced again once it grew by this many minutes. */
export const DELAY_STEP_MIN = 5;
/** Delay and cancellation alerts cover this many upcoming trains of a leg. */
export const ALERT_TRAINS = 3;

export type NotificationKind = "delay" | "cancellation" | "service" | "leave_now" | "arrival" | "better_train" | "on_train";

export interface Notification {
  /** Dedupe key: the same key is never sent twice to one user. */
  key: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Groups a train's notifications on the lock screen. */
  thread: string;
  /** Affects the commute. False: delivered quietly, only with `alerts.scope = "all"`. */
  priority: boolean;
}

type Draft = Omit<Notification, "priority">;

export interface AlertInput {
  now: number;
  settings: Settings;
  snapshot: RealtimeSnapshot | null;
  tracked: Tracked | null;
  /** Keys already sent (recent days). */
  sent: Set<string>;
}

export interface AlertResult {
  notifications: Notification[];
  /** The tracked train has arrived (or no longer exists): stop tracking it. */
  trackingDone: boolean;
}

const KIND_NAME = { LOC: "Local", LTD: "Limited", EXP: "Express", SCC: "South County" } as const;
const trainName = (t: { train: string; kind: keyof typeof KIND_NAME }) => `${KIND_NAME[t.kind]} ${t.train}`;

function inWindow(leg: Leg, minuteOfDay: number) {
  const s = hhmm(leg.window.start) ?? 0, e = hhmm(leg.window.end) ?? 0;
  return minuteOfDay >= s && minuteOfDay <= e;
}

/** The direction a leg travels (a pair no train serves in that order has none). */
export function legDirection(leg: Pick<Leg, "from" | "to">): Direction | null {
  const trip = trainsBetween(leg.from, leg.to)[0];
  return trip?.dir ?? null;
}

function trainsBetween(fromId: string, toId: string) {
  return TIMETABLE.trips.filter((t) => {
    const a = stopIndex(t.stops, fromId), b = stopIndex(t.stops, toId);
    return a >= 0 && b > a;
  });
}

function stopIndex(stops: number[], id: string): number {
  const i = TIMETABLE.stations.findIndex((s) => s.id === id);
  for (let p = 0; p * 3 < stops.length; p++) if (stops[p * 3] === i) return p;
  return -1;
}

/** The direction an alert's text names, when it names exactly one. */
export function alertDirection(alert: Pick<ServiceAlert, "header" | "description">): Direction | null {
  const text = `${alert.header} ${alert.description}`;
  const n = /\b(north\s?bound|nb)\b/i.test(text), s = /\b(south\s?bound|sb)\b/i.test(text);
  return n === s ? null : n ? "N" : "S";
}

const TRAIN_NUMBER = /\b(?:trains?|#)\s*#?\s*(\d{3})\b/gi;
const CLOCK_TIME = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/gi;

/**
 * Whether a service alert affects this leg, read from what it says: its active period, the trains,
 * direction and times it names. An alert that says none of those (an elevator at your station, a
 * system-wide notice) counts, so nothing that may matter goes quiet because of how it was worded.
 */
export function alertAffectsLeg(alert: ServiceAlert, leg: Leg, now: number): boolean {
  const z = zoned(now);
  const start = hhmm(leg.window.start) ?? 0, end = hhmm(leg.window.end) ?? 24 * 60;
  const dayStart = serviceDayStart(z.date);
  if (alert.start !== undefined && alert.start * 1000 > atLocal(z.date, leg.window.end)) return false;
  if (alert.end !== undefined && alert.end * 1000 < atLocal(z.date, leg.window.start)) return false;

  const text = `${alert.header} ${alert.description}`;
  const dir = legDirection(leg);
  const named = alertDirection(alert);
  if (dir && named && named !== dir) return false;

  const numbers = [...text.matchAll(TRAIN_NUMBER)].map((m) => m[1]);
  const known = numbers.filter((n) => TIMETABLE.trips.some((t) => t.train === n));
  if (known.length) {
    const fromIdx = TIMETABLE.stations.findIndex((s) => s.id === leg.from);
    return trainsBetween(leg.from, leg.to).some((t) => {
      if (!known.includes(t.train)) return false;
      for (let p = 0; p * 3 < t.stops.length; p++) {
        if (t.stops[p * 3] !== fromIdx) continue;
        const dep = zoned(dayStart + t.stops[p * 3 + 2] * MIN).minuteOfDay;
        return dep >= start && dep <= end;
      }
      return false;
    });
  }

  const times = [...text.matchAll(CLOCK_TIME)].map((m) => {
    const h = Number(m[1]) % 12 + (m[3].toLowerCase() === "p" ? 12 : 0);
    return h * 60 + Number(m[2] ?? 0);
  });
  if (times.length && times.every((t) => t < start || t > end)) return false;
  return true;
}

/** The notifications for one leg that affect it. */
function legNotifications(leg: Leg, part: "morning" | "evening", input: AlertInput): Draft[] {
  const { now, settings, snapshot } = input;
  const a = settings.alerts;
  const z = zoned(now);
  const out: Draft[] = [];
  const from = station(leg.from), to = station(leg.to);
  if (!from || !to) return out;
  const pref = leg.express_preference ?? settings.express_preference ?? "all";
  const windowEnd = atLocal(z.date, leg.window.end);
  const trains = departures(leg.from, leg.to, now, snapshot, { lookbackMs: 0, horizonMs: ALERT_LOOKAHEAD_MS, before: windowEnd, limit: 20, expressPreference: pref });
  const soon = (t: BoardTrain) => t.pred_dep >= now && t.dep - now <= ALERT_LOOKAHEAD_MS;
  const route = `${from.name} → ${to.name}`;

  // The next few trains only: a line-wide delay shouldn't become a notification per train.
  for (const t of trains.filter(soon).slice(0, ALERT_TRAINS)) {
    const thread = `train:${t.service_date}:${t.trip_id}`;
    if (t.status === "cancelled" && a.cancellation) {
      out.push({
        key: `cancel:${t.service_date}:${t.trip_id}`, kind: "cancellation", thread,
        title: `${trainName(t)} is cancelled`,
        body: `The ${clock(t.dep)} from ${from.name} won't run to ${to.name}.${nextAfter(trains, t)}`,
      });
    } else if (a.delay && t.delay_min !== null && t.delay_min >= a.delay_threshold) {
      const step = Math.floor((t.delay_min - a.delay_threshold) / DELAY_STEP_MIN);
      out.push({
        key: `delay:${t.service_date}:${t.trip_id}:${step}`, kind: "delay", thread,
        title: `${trainName(t)} is ${t.delay_min} min late`,
        body: `Leaves ${from.name} ${clock(t.pred_dep)} (scheduled ${clock(t.dep)}), arrives ${to.name} ${clock(t.pred_arr)}.`,
      });
    }
    if (a.better_train !== false && t.overtaken_by && t.status !== "cancelled") {
      const overtaker = trains.find((o) => o.trip_id === t.overtaken_by && o.status !== "cancelled");
      if (overtaker) {
        const savesMin = Math.round((t.pred_arr - overtaker.pred_arr) / MIN);
        if (savesMin >= 2) {
          out.push({
            key: `better:${t.service_date}:${t.trip_id}:${overtaker.trip_id}`, kind: "better_train", thread,
            title: `${t.train} is ${t.delay_min ? `${t.delay_min} min late` : "delayed"}: take ${overtaker.train} instead`,
            body: `${trainName(overtaker)} leaves ${from.name} at ${clock(overtaker.pred_dep)} and reaches ${to.name} at ${clock(overtaker.pred_arr)}, ${savesMin} min before ${t.train}.`,
          });
        }
      }
    }
  }

  if (a.leave_now && leg.usual) {
    const usual = atLocal(z.date, leg.usual);
    const pool = departures(leg.from, leg.to, now, snapshot, { lookbackMs: 0, after: usual, limit: 8, expressPreference: pref });
    let target: BoardTrain | undefined;
    if (pref === "prefer_express") {
      const exp = pool.find((t) => t.kind === "EXP" && t.status !== "cancelled" && t.service_date === z.date && t.dep - usual <= 30 * MIN);
      target = exp ?? pool.find((t) => t.status !== "cancelled" && t.service_date === z.date);
    } else {
      target = pool.find((t) => t.status !== "cancelled" && t.service_date === z.date);
    }
    if (target) {
      const leaveAt = target.pred_dep - leg.walk_minutes * MIN;
      if (now >= leaveAt - MIN / 2 && now < target.pred_dep) {
        const late = target.delay_min && target.delay_min >= 2 ? ` (${target.delay_min} min late)` : "";
        out.push({
          key: `leave:${target.service_date}:${target.trip_id}`, kind: "leave_now", thread: `train:${target.service_date}:${target.trip_id}`,
          title: `Leave now for the ${clock(target.pred_dep)}`,
          body: `${trainName(target)} leaves ${from.name} ${clock(target.pred_dep)}${late}; ${leg.walk_minutes} min ${TRAVEL_WORD[leg.travel_mode ?? "walk"] ?? "walk"}. ${route}.`,
        });
      }
    }
  }

  if (a.service && snapshot) {
    for (const al of relevantAlerts(snapshot.alerts, [leg.from, leg.to], now)) {
      if (alertAffectsLeg(al, leg, now)) out.push(serviceNotification(al, route));
    }
  }
  void part;
  return out;
}

function serviceNotification(al: ServiceAlert, route: string): Draft {
  return {
    key: `service:${al.id}`, kind: "service", thread: "caltrain-alerts",
    title: al.header || "Caltrain service alert",
    body: (al.description && al.description !== al.header ? al.description : route).slice(0, 300),
  };
}

/** Everything else on a leg's stations, either way, any time of day: delays, cancellations, service alerts. */
function quietNotifications(leg: Leg, input: AlertInput): Draft[] {
  const { now, settings, snapshot } = input;
  const a = settings.alerts;
  const out: Draft[] = [];
  for (const [fromId, toId] of [[leg.from, leg.to], [leg.to, leg.from]]) {
    const from = station(fromId), to = station(toId);
    if (!from || !to) continue;
    const trains = departures(fromId, toId, now, snapshot, { lookbackMs: 0, horizonMs: ALERT_LOOKAHEAD_MS, limit: ALERT_TRAINS });
    for (const t of trains) {
      if (t.pred_dep < now) continue;
      const thread = `train:${t.service_date}:${t.trip_id}`;
      if (t.status === "cancelled" && a.cancellation) {
        out.push({
          key: `cancel:${t.service_date}:${t.trip_id}`, kind: "cancellation", thread,
          title: `${trainName(t)} is cancelled`,
          body: `The ${clock(t.dep)} from ${from.name} won't run to ${to.name}.`,
        });
      } else if (a.delay && t.delay_min !== null && t.delay_min >= a.delay_threshold) {
        const step = Math.floor((t.delay_min - a.delay_threshold) / DELAY_STEP_MIN);
        out.push({
          key: `delay:${t.service_date}:${t.trip_id}:${step}`, kind: "delay", thread,
          title: `${trainName(t)} is ${t.delay_min} min late`,
          body: `Leaves ${from.name} ${clock(t.pred_dep)} (scheduled ${clock(t.dep)}), arrives ${to.name} ${clock(t.pred_arr)}.`,
        });
      }
    }
  }
  if (a.service && snapshot) {
    const route = `${station(leg.from)?.name} → ${station(leg.to)?.name}`;
    for (const al of relevantAlerts(snapshot.alerts, [leg.from, leg.to], now)) out.push(serviceNotification(al, route));
  }
  return out;
}

function nextAfter(trains: BoardTrain[], t: BoardTrain): string {
  const n = trains.find((x) => x.pred_dep > t.dep && x.status !== "cancelled");
  return n ? ` Next: ${trainName(n)} at ${clock(n.pred_dep)}.` : "";
}

export function dueNotifications(input: AlertInput): AlertResult {
  const { now, settings, tracked, snapshot, sent } = input;
  const z = zoned(now);
  const all: Notification[] = [];
  const quiet: Draft[] = [];
  if (settings.days.includes(z.weekday)) {
    for (const part of ["morning", "evening"] as const) {
      const leg = settings[part];
      if (!leg) continue;
      if (inWindow(leg, z.minuteOfDay)) all.push(...legNotifications(leg, part, input).map((n) => ({ ...n, priority: true })));
      if (settings.alerts.scope === "all") quiet.push(...quietNotifications(leg, input));
    }
  }

  let trackingDone = false;
  if (tracked) {
    const p = progress(tracked, now, snapshot);
    if (!p || p.arrived || p.cancelled) trackingDone = true;
    if (p && !p.arrived && !p.cancelled && settings.alerts.arrival) {
      const left = p.pred_arr - now;
      if (left <= settings.alerts.arrival_minutes * MIN) {
        const mins = Math.max(0, Math.round(left / MIN));
        all.push({
          key: `arrival:${p.service_date}:${p.trip_id}:${p.to.id}`, kind: "arrival", thread: `train:${p.service_date}:${p.trip_id}`,
          title: mins <= 0 ? `Arriving at ${p.to.name}` : `${p.to.name} in ${mins} min`,
          body: `${trainName(p)} arrives ${p.to.name} ${clock(p.pred_arr)}. Time to get ready.`,
          priority: true,
        });
      }
    }
    if (p?.cancelled && settings.alerts.cancellation) {
      all.push({ key: `cancel:${p.service_date}:${p.trip_id}`, kind: "cancellation", thread: `train:${p.service_date}:${p.trip_id}`, title: `${trainName(p)} is cancelled`, body: `The train you're tracking to ${p.to.name} was cancelled.`, priority: true });
    }
  }

  // What's priority right now wins; the same event isn't announced quietly as well.
  const loud = new Set(all.map((n) => n.key));
  for (const n of quiet) {
    if (!loud.has(n.key) && !sent.has(n.key)) all.push({ ...n, key: `q:${n.key}`, priority: false });
  }

  const seen = new Set<string>();
  const notifications = all.filter((n) => !sent.has(n.key) && !seen.has(n.key) && seen.add(n.key));
  return { notifications, trackingDone };
}
