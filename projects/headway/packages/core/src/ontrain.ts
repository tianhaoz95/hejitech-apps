// Is the rider on a train, and which one? Phones send their last few location fixes; this matches
// them against where each running train should be. Pure, tested, and it keeps nothing: the Worker
// stores only the resulting trip for a short while, never a location.
//
//   moving     the latest fixes are faster than TRAIN_MIN_MPS and along the Caltrain line
//   matched    a train running that way passes this point within a few minutes of now
//   high       they were at a station first, or moved faster than road traffic near the tracks:
//              only then may Headway start tracking on its own
//
// While someone is matched, stillOnTrain keeps them matched through station stops (speed 0) until
// the train gets away from them or arrives.
import { alertDirection, legDirection } from "./alerts.ts";
import { AT_STATION_M, delayAt, distanceM, isFresh, liveTrip, progress, relevantAlerts, serviceRuns, STATIONS, station, TIMETABLE, tripProgressStops } from "./schedule.ts";
import { addDays, atLocal, serviceDayStart, zoned } from "./time.ts";
import type { CommuteDone, OnTrainCard, OnTrainMatch, OnTrainSample, RealtimeSnapshot, Settings, Timetable, Tracked, Trip } from "./types.ts";

const MIN = 60_000;
/** About 30 km/h: faster than running, slower than a train between stops. */
export const TRAIN_MIN_MPS = 8.3;
/** About 80 km/h: above the speed of the roads alongside the line. */
export const TRAIN_FAST_MPS = 22;
/** How far from the line (straight between stations) a fix may be. */
export const CORRIDOR_M = 500;
/** How far off its timing a train may be and still match. Without live data trains may be later than we know. */
export const MATCH_LIVE_MIN = 3;
export const MATCH_TIMETABLE_MIN = 6;
/** Samples older than this say nothing about now. */
const SAMPLE_MAX_AGE_MS = 15 * MIN;
const LATEST_MAX_AGE_MS = 3 * MIN;
/** How close to the rider a train's position must come, within the timing limit. */
const MATCH_KM = 1.5;
/** Off the train: it's this far along the line from you. */
export const LEFT_TRAIN_KM = 4;
/** Within this of a leg's destination station, off a train that went there: the commute is done. */
export const ARRIVED_M = 400;
/** Faster than this they're still moving through, not getting off. */
const ARRIVED_MAX_MPS = 5;
/** The train must be due at that station about now (scheduled; this allows for it running late). */
const ARRIVED_EARLY_MS = 5 * MIN, ARRIVED_LATE_MS = 60 * MIN;

const KM: number[] = (() => {
  const out = [0];
  for (let i = 1; i < STATIONS.length; i++) out.push(out[i - 1] + distanceM(STATIONS[i - 1] as LatLon, STATIONS[i] as LatLon) / 1000);
  return out;
})();

type LatLon = { lat: number; lon: number };

/** A point's position along the line (km from the northern end) and its distance from it (m). */
export function onLine(p: LatLon): { km: number; off: number } {
  let best = { km: 0, off: Infinity };
  const cos = Math.cos((p.lat * Math.PI) / 180);
  for (let i = 0; i + 1 < STATIONS.length; i++) {
    const a = STATIONS[i] as LatLon, b = STATIONS[i + 1] as LatLon;
    const ax = (b.lon - a.lon) * cos, ay = b.lat - a.lat;
    const px = (p.lon - a.lon) * cos, py = p.lat - a.lat;
    const len = ax * ax + ay * ay;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, (px * ax + py * ay) / len));
    const off = distanceM(p, { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) });
    if (off < best.off) best = { km: KM[i] + t * (KM[i + 1] - KM[i]), off };
  }
  return best;
}

function cleanSamples(samples: OnTrainSample[], now: number): OnTrainSample[] {
  return samples
    .filter((s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lon) && Number.isFinite(s?.at) && s.at <= now + MIN && s.at >= now - SAMPLE_MAX_AGE_MS)
    .sort((a, b) => a.at - b.at)
    .slice(-20);
}

/** Each sample's speed: the phone's when it knows, else from the previous fix. */
function speeds(samples: OnTrainSample[]): number[] {
  return samples.map((s, i) => {
    if (typeof s.speed === "number" && s.speed >= 0) return s.speed;
    if (i === 0) return NaN;
    const dt = (s.at - samples[i - 1].at) / 1000;
    return dt > 0 ? distanceM(s, samples[i - 1]) / dt : NaN;
  });
}

/** Where a running trip is at `at`, as a position on the line, delays applied (null when it isn't running). */
function tripKmAt(trip: Trip, date: string, at: number, snapshot: RealtimeSnapshot | null): number | null {
  const dayStart = serviceDayStart(date);
  const rt = liveTrip(snapshot, trip, date);
  const n = trip.stops.length / 3;
  const time = (p: number, kind: "arr" | "dep") => dayStart + trip.stops[p * 3 + (kind === "arr" ? 1 : 2)] * MIN + (delayAt(trip, p, rt, dayStart, kind) ?? 0) * 1000;
  if (at < time(0, "dep") || at > time(n - 1, "arr")) return null;
  for (let p = 0; p + 1 < n; p++) {
    const leave = time(p, "dep"), reach = time(p + 1, "arr");
    const here = KM[trip.stops[p * 3]], there = KM[trip.stops[(p + 1) * 3]];
    if (at <= leave) return here;
    if (at <= reach) return here + ((at - leave) / Math.max(1, reach - leave)) * (there - here);
  }
  return KM[trip.stops[(n - 1) * 3]];
}

/** Minutes between now and when a trip passes a position on the line (null if it doesn't, or isn't running near now). */
function minutesOff(trip: Trip, date: string, km: number, now: number, snapshot: RealtimeSnapshot | null, limit: number): number | null {
  // Scan the minutes around now, a one-minute grid is fine for a train's position; the closest minute wins.
  let closest: number | null = null;
  for (let d = 0; d <= limit; d++) {
    for (const t of d === 0 ? [0] : [-d, d]) {
      const at = tripKmAt(trip, date, now + t * MIN, snapshot);
      if (at !== null && Math.abs(at - km) <= MATCH_KM) closest ??= d;
    }
    if (closest !== null) break;
  }
  return closest;
}

const isCancelled = (trip: Trip, date: string, snapshot: RealtimeSnapshot | null) => Boolean(liveTrip(snapshot, trip, date)?.cancelled);

/** The train these fixes are riding, or null. */
export function detectOnTrain(samples: OnTrainSample[], now: number, snapshot: RealtimeSnapshot | null, tt: Timetable = TIMETABLE): OnTrainMatch | null {
  const fixes = cleanSamples(samples, now);
  if (fixes.length < 2) return null;
  const last = fixes[fixes.length - 1];
  if (now - last.at > LATEST_MAX_AGE_MS) return null;

  const v = speeds(fixes);
  const tail = v.slice(-3).filter(Number.isFinite);
  if (!tail.length) return null;
  const sorted = [...tail].sort((a, b) => a - b);
  if (sorted[Math.floor(sorted.length / 2)] < TRAIN_MIN_MPS) return null;

  const tailFixes = fixes.slice(-3).map(onLine);
  if (tailFixes.some((p) => p.off > CORRIDOR_M)) return null;
  const moved = tailFixes[tailFixes.length - 1].km - tailFixes[0].km;
  if (Math.abs(moved) < 0.1) return null;

  const live = isFresh(snapshot, now) ? snapshot : null;
  const here = tailFixes[tailFixes.length - 1].km;
  const today = zoned(now).date;
  let best: { trip: Trip; date: string; off: number } | null = null;
  for (const date of [addDays(today, -1), today]) {
    for (const trip of tt.trips) {
      if (!serviceRuns(tt, trip.svc, date) || isCancelled(trip, date, live)) continue;
      // The train's direction along the line must match the rider's.
      const first = KM[trip.stops[0]], end = KM[trip.stops[trip.stops.length - 3]];
      if (Math.sign(end - first) !== Math.sign(moved)) continue;
      const hasUpdate = Boolean(liveTrip(live, trip, date));
      const limit = hasUpdate ? MATCH_LIVE_MIN : MATCH_TIMETABLE_MIN;
      const off = minutesOff(trip, date, here, now, live, limit);
      if (off === null) continue;
      if (!best || off < best.off) best = { trip, date, off };
    }
  }
  if (!best) return null;

  const atStation = fixes.some((s, i) => {
    if (i === fixes.length - 1) return false;
    return STATIONS.some((st) => st.lat != null && distanceM(s, st as LatLon) <= AT_STATION_M);
  });
  const fast = Math.max(...v.filter(Number.isFinite)) >= TRAIN_FAST_MPS;
  return { trip_id: best.trip.id, service_date: best.date, confidence: atStation || fast ? "high" : "low" };
}

/** Still riding `match`: the train hasn't arrived or been cancelled and isn't far along the line from them. */
export function stillOnTrain(match: OnTrainMatch, samples: OnTrainSample[], now: number, snapshot: RealtimeSnapshot | null, tt: Timetable = TIMETABLE): boolean {
  const trip = tt.trips.find((t) => t.id === match.trip_id);
  if (!trip) return false;
  const live = isFresh(snapshot, now) ? snapshot : null;
  if (isCancelled(trip, match.service_date, live)) return false;
  const km = tripKmAt(trip, match.service_date, now, live);
  if (km === null) return false;
  const fixes = cleanSamples(samples, now);
  const last = fixes[fixes.length - 1];
  if (!last) return true;
  const p = onLine(last);
  return p.off <= 3 * CORRIDOR_M && Math.abs(p.km - km) <= LEFT_TRAIN_KM;
}

/** Where someone on this train is going: their tracked stop, else their commute's, else the end of the line. */
function destination(trip: Trip, settings: Settings | null, tracked: Tracked | null, nowPos: number): { to: string; source: OnTrainCard["to_source"] } {
  const stopIds = Array.from({ length: trip.stops.length / 3 }, (_, p) => STATIONS[trip.stops[p * 3]].id);
  const ahead = (id: string) => stopIds.indexOf(id) >= nowPos;
  if (tracked?.trip_id === trip.id && ahead(tracked.to)) return { to: tracked.to, source: "tracked" };
  // The commute's stop whenever this train goes there the leg's way, wherever they boarded.
  for (const leg of [settings?.morning, settings?.evening]) {
    if (leg && ahead(leg.to) && legDirection(leg) === trip.dir) return { to: leg.to, source: "commute" };
  }
  return { to: stopIds[stopIds.length - 1], source: "terminal" };
}

/**
 * The leg this ride just finished: the rider is at its destination station, off (or stepping off) a
 * train that runs the leg's way and is due there about now. Not when they're tracking that train to
 * another stop (a one-off), on a day off, or after the leg's window. Pure; the fix isn't kept.
 */
export function commuteArrival(settings: Settings, ride: { trip_id: string; to?: string }, here: { lat: number; lon: number; speed?: number }, now: number, tt: Timetable = TIMETABLE): CommuteDone | null {
  const trip = tt.trips.find((t) => t.id === ride.trip_id);
  const z = zoned(now);
  if (!trip || !settings.days.includes(z.weekday)) return null;
  if (typeof here.speed === "number" && here.speed > ARRIVED_MAX_MPS) return null;
  const stopIds = Array.from({ length: trip.stops.length / 3 }, (_, p) => STATIONS[trip.stops[p * 3]].id);
  for (const part of ["morning", "evening"] as const) {
    const leg = settings[part];
    const to = leg ? station(leg.to) : null;
    if (!leg || !to || to.lat == null || to.lon == null) continue;
    if (!stopIds.includes(leg.to) || legDirection(leg) !== trip.dir) continue;
    if (ride.to && ride.to !== leg.to) continue;
    if (now > atLocal(z.date, leg.window.end)) continue;
    if (distanceM(here, to as LatLon) > ARRIVED_M) continue;
    // An old match for a train that was here hours ago, or isn't here yet, says nothing about now.
    const arrMin = trip.stops[stopIds.indexOf(leg.to) * 3 + 1];
    const due = [addDays(z.date, -1), z.date].some((d) => {
      const arr = serviceDayStart(d) + arrMin * MIN;
      return now >= arr - ARRIVED_EARLY_MS && now <= arr + ARRIVED_LATE_MS;
    });
    if (due) return { date: z.date, part, at: now };
  }
  return null;
}

/** What the in-train card shows, or null when that ride is over. */
export function onTrainCard(match: OnTrainMatch, settings: Settings | null, tracked: Tracked | null, now: number, snapshot: RealtimeSnapshot | null, tt: Timetable = TIMETABLE): OnTrainCard | null {
  const trip = tt.trips.find((t) => t.id === match.trip_id);
  if (!trip) return null;
  const live = isFresh(snapshot, now) ? snapshot : null;
  const dayStart = serviceDayStart(match.service_date);
  const n = trip.stops.length / 3;
  const rt = liveTrip(live, trip, match.service_date);
  let pos = 0;
  for (let p = 0; p < n; p++) {
    const leave = dayStart + trip.stops[p * 3 + 2] * MIN + (delayAt(trip, p, rt, dayStart, "dep") ?? 0) * 1000;
    if (leave < now) pos = p + 1;
  }
  const { to, source } = destination(trip, settings, tracked, pos);
  const fromPos = Math.max(0, Math.min(pos - 1, n - 2));
  const fromId = STATIONS[trip.stops[fromPos * 3]].id;
  const ride: Tracked = { trip_id: trip.id, service_date: match.service_date, from: tracked?.trip_id === trip.id ? tracked.from : fromId, to };
  const p = progress(ride, now, snapshot, tt);
  const from = station(fromId);
  if (!p || p.arrived || p.cancelled || !from) return null;
  const ahead = Array.from({ length: n - pos }, (_, i) => STATIONS[trip.stops[(pos + i) * 3]].id);
  const alerts = live ? relevantAlerts(live.alerts, ahead, now).filter((a) => {
    const d = alertDirection(a);
    return !d || d === trip.dir;
  }) : [];
  return {
    ...match, train: p.train, kind: p.kind, dir: p.dir,
    from: { id: from.id, name: from.name, short: from.short }, to: p.to, to_source: source,
    next: p.next, pred_arr: p.pred_arr, arr: p.arr, delay_min: p.delay_min, stops_left: p.stops_left,
    stops: tripProgressStops(ride, now, snapshot, tt), alerts, tracked: tracked?.trip_id === trip.id, live: p.live,
  };
}
