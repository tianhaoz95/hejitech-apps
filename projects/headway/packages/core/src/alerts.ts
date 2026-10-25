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
import { departures, progress, relevantAlerts, station } from "./schedule.ts";
import { atLocal, clock, hhmm, zoned } from "./time.ts";
import type { BoardTrain, Leg, RealtimeSnapshot, Settings, Tracked } from "./types.ts";

const MIN = 60_000;
/** Delay and cancellation alerts only for trains leaving within this long. */
export const ALERT_LOOKAHEAD_MS = 90 * MIN;
/** A worse delay is announced again once it grew by this many minutes. */
export const DELAY_STEP_MIN = 5;
/** Delay and cancellation alerts cover this many upcoming trains of a leg. */
export const ALERT_TRAINS = 3;

export type NotificationKind = "delay" | "cancellation" | "service" | "leave_now" | "arrival";

export interface Notification {
  /** Dedupe key: the same key is never sent twice to one user. */
  key: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Groups a train's notifications on the lock screen. */
  thread: string;
}

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

function legNotifications(leg: Leg, part: "morning" | "evening", input: AlertInput): Notification[] {
  const { now, settings, snapshot } = input;
  const a = settings.alerts;
  const z = zoned(now);
  const out: Notification[] = [];
  const from = station(leg.from), to = station(leg.to);
  if (!from || !to) return out;
  const windowEnd = atLocal(z.date, leg.window.end);
  const trains = departures(leg.from, leg.to, now, snapshot, { lookbackMs: 0, horizonMs: ALERT_LOOKAHEAD_MS, before: windowEnd, limit: 20 });
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
  }

  if (a.leave_now && leg.usual) {
    const usual = atLocal(z.date, leg.usual);
    const target = departures(leg.from, leg.to, now, snapshot, { lookbackMs: 0, after: usual, limit: 6 }).find((t) => t.status !== "cancelled" && t.service_date === z.date);
    if (target) {
      const leaveAt = target.pred_dep - leg.walk_minutes * MIN;
      if (now >= leaveAt - MIN / 2 && now < target.pred_dep) {
        const late = target.delay_min && target.delay_min >= 2 ? ` (${target.delay_min} min late)` : "";
        out.push({
          key: `leave:${target.service_date}:${target.trip_id}`, kind: "leave_now", thread: `train:${target.service_date}:${target.trip_id}`,
          title: `Leave now for the ${clock(target.pred_dep)}`,
          body: `${trainName(target)} leaves ${from.name} ${clock(target.pred_dep)}${late}; ${leg.walk_minutes} min walk. ${route}.`,
        });
      }
    }
  }

  if (a.service && snapshot) {
    for (const al of relevantAlerts(snapshot.alerts, [leg.from, leg.to], now)) {
      out.push({
        key: `service:${al.id}`, kind: "service", thread: "caltrain-alerts",
        title: al.header || "Caltrain service alert",
        body: (al.description && al.description !== al.header ? al.description : route).slice(0, 300),
      });
    }
  }
  void part;
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
  if (settings.days.includes(z.weekday)) {
    for (const part of ["morning", "evening"] as const) {
      const leg = settings[part];
      if (leg && inWindow(leg, z.minuteOfDay)) all.push(...legNotifications(leg, part, input));
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
        });
      }
    }
    if (p?.cancelled && settings.alerts.cancellation) {
      all.push({ key: `cancel:${p.service_date}:${p.trip_id}`, kind: "cancellation", thread: `train:${p.service_date}:${p.trip_id}`, title: `${trainName(p)} is cancelled`, body: `The train you're tracking to ${p.to.name} was cancelled.` });
    }
  }

  const seen = new Set<string>();
  const notifications = all.filter((n) => !sent.has(n.key) && !seen.has(n.key) && seen.add(n.key));
  return { notifications, trackingDone };
}
