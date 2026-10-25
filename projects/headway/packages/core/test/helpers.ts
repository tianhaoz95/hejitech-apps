import { atLocal, departures, type RealtimeSnapshot, type Settings, defaultSettings, newLeg } from "../src/index.ts";

/** A Tuesday with regular weekday service. */
export const WEEKDAY = "20261027";
export const SATURDAY = "20261031";
export const THANKSGIVING = "20261126";

export const at = (date: string, time: string) => atLocal(date, time);

export function snapshot(now: number, trips: RealtimeSnapshot["trips"] = {}, alerts: RealtimeSnapshot["alerts"] = []): RealtimeSnapshot {
  return { fetched_at: now - 30_000, feed_ts: Math.floor(now / 1000) - 40, trips, alerts };
}

/** Mountain View → San Francisco mornings, back in the evening. */
export function commuter(over: Partial<Settings> = {}): Settings {
  const s = defaultSettings();
  s.morning = { ...newLeg("mountain_view", "san_francisco", "morning"), usual: "08:00", walk_minutes: 10 };
  s.evening = newLeg("san_francisco", "mountain_view", "evening");
  return { ...s, ...over };
}

/** The first northbound train leaving Mountain View for SF at or after a time. */
export function firstTrain(date: string, time: string) {
  const now = at(date, time);
  const t = departures("mountain_view", "san_francisco", now, null, { lookbackMs: 0 })[0];
  if (!t) throw new Error(`no train after ${time}`);
  return t;
}
