// The timetable and the live snapshot merged into boards: the next trains between two stations,
// one train's progress, and which leg of a commute applies now. Pure functions of (timetable,
// snapshot, now), so the Worker, the glasses (offline: timetable only) and the tests agree.
import data from "./timetable.gen.json" with { type: "json" };
import { addDays, hhmm, serviceDayStart, weekdayOf, zoned } from "./time.ts";
import type {
  Board, BoardTrain, Direction, LegName, RealtimeSnapshot, RealtimeTrip, ServiceAlert, Settings, Station, Timetable, Tracked, TrainProgress, Trip, TrainStatus,
} from "./types.ts";

export const TIMETABLE = data as Timetable;
export const STATIONS: Station[] = TIMETABLE.stations;
const MIN = 60_000;
/** A snapshot older than this is ignored (the board says "scheduled" instead of showing stale delays). */
export const LIVE_MAX_AGE_MS = 10 * MIN;
/** Trains shown on a board. */
export const BOARD_TRAINS = 8;

const index = new Map(STATIONS.map((s, i) => [s.id, i]));
export const station = (id: string): Station | undefined => STATIONS[index.get(id) ?? -1];
export const stationIndex = (id: string): number => index.get(id) ?? -1;
const lite = (s: Station) => ({ id: s.id, name: s.name, short: s.short });

/** Looks a station up by id, name or short name (case-insensitive; "mtn view", "Mountain View", "mountain_view"). */
export function findStation(q: string): Station | undefined {
  const k = q.trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/ (caltrain|station)$/g, "");
  return STATIONS.find((s) => s.id.replace(/_/g, " ") === k || s.name.toLowerCase() === k || s.short.toLowerCase() === k)
    ?? STATIONS.find((s) => s.name.toLowerCase().startsWith(k));
}

/** Does this service run on a date (YYYYMMDD)? */
export function serviceRuns(tt: Timetable, svc: string, date: string): boolean {
  const c = tt.services[svc];
  if (!c) return false;
  if (c.remove.includes(date)) return false;
  if (c.add.includes(date)) return true;
  if (!c.start || !c.end || date < c.start || date > c.end) return false;
  return c.days[weekdayOf(date)] === 1;
}

/** Position of a station in a trip's stop list (index into the flat array / 3), or −1. */
function stopPos(trip: Trip, stationIdx: number): number {
  for (let i = 0; i < trip.stops.length; i += 3) if (trip.stops[i] === stationIdx) return i / 3;
  return -1;
}

const platformOf = (s: Station, dir: Direction) => (dir === "N" ? s.nb : s.sb);

export function isFresh(snapshot: RealtimeSnapshot | null | undefined, now: number): snapshot is RealtimeSnapshot {
  return Boolean(snapshot && now - snapshot.fetched_at <= LIVE_MAX_AGE_MS);
}

/** The live entry for a trip on a service day (a snapshot entry for another day doesn't apply). */
function liveTrip(snapshot: RealtimeSnapshot | null, trip: Trip, date: string): RealtimeTrip | null {
  const rt = snapshot?.trips[trip.id];
  if (!rt) return null;
  if (rt.start_date && rt.start_date !== date) return null;
  return rt;
}

/**
 * Seconds late at stop `pos` of a trip: the stop's own update, else the nearest earlier stop's
 * (GTFS-RT propagation), else the trip's delay. Null when the feed says nothing about this trip.
 */
function delayAt(trip: Trip, pos: number, rt: RealtimeTrip | null, dayStart: number, kind: "arr" | "dep"): number | null {
  if (!rt) return null;
  const at = (p: number): number | null => {
    const s = STATIONS[trip.stops[p * 3]];
    const u = rt.stops[platformOf(s, trip.dir) ?? ""];
    if (!u || u.skipped) return null;
    const own = p === pos ? kind : "dep";
    const sched = dayStart + trip.stops[p * 3 + (own === "arr" ? 1 : 2)] * MIN;
    const t = own === "dep" ? u.dep ?? u.arr : u.arr ?? u.dep;
    if (typeof t === "number") return Math.round(t - sched / 1000);
    return typeof u.delay === "number" ? u.delay : null;
  };
  // This stop, then earlier ones (delays propagate down the line), then the trip's own delay, then
  // the nearest later stop (the feed sometimes lists only a few stops ahead).
  for (let p = pos; p >= 0; p--) {
    const d = at(p);
    if (d !== null) return d;
  }
  if (typeof rt.delay === "number") return rt.delay;
  for (let p = pos + 1; p < trip.stops.length / 3; p++) {
    const d = at(p);
    if (d !== null) return d;
  }
  return null;
}

function skippedAt(trip: Trip, pos: number, rt: RealtimeTrip | null): boolean {
  if (!rt) return false;
  const s = STATIONS[trip.stops[pos * 3]];
  return Boolean(rt.stops[platformOf(s, trip.dir) ?? ""]?.skipped);
}

function status(delayMin: number | null, cancelled: boolean): TrainStatus {
  if (cancelled) return "cancelled";
  if (delayMin === null) return "scheduled";
  if (delayMin >= 2) return "late";
  if (delayMin <= -2) return "early";
  return "on_time";
}

export interface DepartureOptions {
  /** Keep trains that left up to this long ago (by prediction). */
  lookbackMs?: number;
  /** Don't look further ahead than this. */
  horizonMs?: number;
  limit?: number;
  /** Only trains departing at or after / before these instants (by schedule). */
  after?: number;
  before?: number;
}

/** Trains from one station to another, soonest first, with live predictions where the snapshot has them. */
export function departures(fromId: string, toId: string, now: number, snapshot: RealtimeSnapshot | null = null, opts: DepartureOptions = {}, tt: Timetable = TIMETABLE): BoardTrain[] {
  const fi = stationIndex(fromId), ti = stationIndex(toId);
  if (fi < 0 || ti < 0 || fi === ti) return [];
  const live = isFresh(snapshot, now) ? snapshot : null;
  const lookback = opts.lookbackMs ?? MIN;
  const horizon = opts.horizonMs ?? 6 * 60 * MIN;
  const today = zoned(now).date;
  const out: BoardTrain[] = [];
  for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
    const dayStart = serviceDayStart(date);
    for (const trip of tt.trips) {
      if (!serviceRuns(tt, trip.svc, date)) continue;
      const a = stopPos(trip, fi), b = stopPos(trip, ti);
      if (a < 0 || b < 0 || a >= b) continue;
      const dep = dayStart + trip.stops[a * 3 + 2] * MIN;
      const arr = dayStart + trip.stops[b * 3 + 1] * MIN;
      if (opts.after !== undefined && dep < opts.after) continue;
      if (opts.before !== undefined && dep > opts.before) continue;
      if (dep > now + horizon || dep < now - horizon) continue;
      const rt = liveTrip(live, trip, date);
      const dd = delayAt(trip, a, rt, dayStart, "dep");
      const da = delayAt(trip, b, rt, dayStart, "arr");
      const cancelled = Boolean(rt?.cancelled) || skippedAt(trip, a, rt) || skippedAt(trip, b, rt);
      const pred_dep = dep + (dd ?? 0) * 1000;
      const pred_arr = arr + (da ?? dd ?? 0) * 1000;
      if (pred_dep < now - lookback && !(cancelled && dep >= now - lookback)) continue;
      const delay_min = dd === null ? null : Math.round(dd / 60);
      out.push({
        trip_id: trip.id, train: trip.train, kind: trip.kind, dir: trip.dir, service_date: date,
        dep, arr, pred_dep, pred_arr, delay_min, status: status(delay_min, cancelled), stops_between: b - a - 1,
      });
    }
  }
  out.sort((x, y) => x.pred_dep - y.pred_dep || x.dep - y.dep);
  return out.slice(0, opts.limit ?? BOARD_TRAINS);
}

/** Alerts that matter for a pair of stations: ones naming either station, plus system-wide ones. Active now. */
export function relevantAlerts(alerts: ServiceAlert[], stationIds: string[], now: number): ServiceAlert[] {
  const t = now / 1000;
  return alerts.filter((a) => (a.start === undefined || a.start <= t) && (a.end === undefined || a.end >= t))
    .filter((a) => (a.stations.length === 0 && a.routes.length === 0) || a.stations.some((s) => stationIds.includes(s)) || (a.stations.length === 0 && a.routes.length > 0));
}

export function board(fromId: string, toId: string, now: number, snapshot: RealtimeSnapshot | null, leg: LegName = "custom", tt: Timetable = TIMETABLE): Board | null {
  const f = station(fromId), t = station(toId);
  if (!f || !t || f.id === t.id) return null;
  const live = isFresh(snapshot, now);
  return {
    from: lite(f), to: lite(t), leg, generated_at: now, live,
    trains: departures(f.id, t.id, now, snapshot, {}, tt),
    alerts: live ? relevantAlerts(snapshot!.alerts, [f.id, t.id], now) : [],
  };
}

/** Which leg applies at `now`: morning before `switch_at`, evening after (falling back to whichever is set). */
export function currentLeg(settings: Settings, now: number): { name: "morning" | "evening"; from: string; to: string } | null {
  const before = zoned(now).minuteOfDay < (hhmm(settings.switch_at) ?? 12 * 60);
  const order = before ? (["morning", "evening"] as const) : (["evening", "morning"] as const);
  for (const name of order) {
    const leg = settings[name];
    if (leg) return { name, from: leg.from, to: leg.to };
  }
  return null;
}

/** The commute board for now, or a custom pair when `from`/`to` are given. */
export function commuteBoard(settings: Settings | null, now: number, snapshot: RealtimeSnapshot | null, pair?: { from: string; to: string }): Board | null {
  if (pair) return board(pair.from, pair.to, now, snapshot, "custom");
  const leg = settings ? currentLeg(settings, now) : null;
  return leg ? board(leg.from, leg.to, now, snapshot, leg.name) : null;
}

/** Where a train is relative to someone riding it to `to`. */
export function progress(tracked: Tracked, now: number, snapshot: RealtimeSnapshot | null, tt: Timetable = TIMETABLE): TrainProgress | null {
  const trip = tt.trips.find((t) => t.id === tracked.trip_id);
  const to = station(tracked.to);
  if (!trip || !to) return null;
  const b = stopPos(trip, stationIndex(to.id));
  if (b < 0) return null;
  const live = isFresh(snapshot, now) ? snapshot : null;
  const rt = liveTrip(live, trip, tracked.service_date);
  const dayStart = serviceDayStart(tracked.service_date);
  const arr = dayStart + trip.stops[b * 3 + 1] * MIN;
  const da = delayAt(trip, b, rt, dayStart, "arr");
  const pred_arr = arr + (da ?? 0) * 1000;
  let next: TrainProgress["next"] = null;
  let stopsLeft = 0;
  for (let p = 0; p <= b; p++) {
    const dp = delayAt(trip, p, rt, dayStart, "dep") ?? 0;
    const leave = dayStart + trip.stops[p * 3 + (p === b ? 1 : 2)] * MIN + dp * 1000;
    if (leave >= now - 30_000) {
      if (!next) {
        const s = STATIONS[trip.stops[p * 3]];
        next = { id: s.id, name: s.name, short: s.short, pred: leave };
      }
      stopsLeft++;
    }
  }
  const arrived = pred_arr < now - 30_000;
  const delay_min = da === null ? null : Math.round(da / 60);
  return {
    trip_id: trip.id, train: trip.train, kind: trip.kind, dir: trip.dir, service_date: tracked.service_date, to: lite(to),
    next: arrived ? null : next, pred_arr, arr, delay_min, stops_left: arrived ? 0 : stopsLeft, cancelled: Boolean(rt?.cancelled),
    arrived, live: Boolean(live),
  };
}

/** Days until the compiled timetable runs out (rebuild it with scripts/build-timetable.mjs before then). */
export function timetableDaysLeft(now: number, tt: Timetable = TIMETABLE): number {
  const end = serviceDayStart(tt.feed_end);
  return Math.floor((end - now) / (24 * 60 * MIN));
}
