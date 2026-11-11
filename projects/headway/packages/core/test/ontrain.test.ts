import { describe, expect, it } from "vitest";
import { commuteArrival, detectOnTrain, departures, onLine, onTrainCard, stillOnTrain, station, type OnTrainSample } from "../src/index.ts";
import { at, commuter, snapshot, WEEKDAY } from "./helpers.ts";

const MIN = 60_000;

/** Fixes along the line between two stations, ending at `end`, `fraction` of the way. */
function ride(fromId: string, toId: string, end: number, opts: { speed?: number; startFraction?: number; fraction?: number; stepMs?: number; count?: number; leadingStation?: boolean } = {}): OnTrainSample[] {
  const a = station(fromId)!, b = station(toId)!;
  const count = opts.count ?? 3, step = opts.stepMs ?? 20_000;
  const start = opts.startFraction ?? 0.35, finish = opts.fraction ?? 0.5;
  const pts: OnTrainSample[] = [];
  if (opts.leadingStation) pts.push({ lat: a.lat!, lon: a.lon!, at: end - (count + 1) * step, speed: 0 });
  for (let i = 0; i < count; i++) {
    const f = start + ((finish - start) * i) / Math.max(1, count - 1);
    pts.push({ lat: a.lat! + f * (b.lat! - a.lat!), lon: a.lon! + f * (b.lon! - a.lon!), at: end - (count - 1 - i) * step, speed: opts.speed ?? 25 });
  }
  return pts;
}

/** A northbound train leaving Mountain View, and when it's about halfway to San Antonio. */
function northbound() {
  const leave = at(WEEKDAY, "08:00");
  const t = departures("mountain_view", "san_francisco", leave, null, { lookbackMs: 0 })[0];
  const toNext = departures("mountain_view", "san_antonio", leave, null, { lookbackMs: 0 }).find((x) => x.trip_id === t.trip_id);
  return { t, toNext };
}

describe("detectOnTrain", () => {
  it("matches a local between stations and says high when they were at a station first", () => {
    const { t, toNext } = northbound();
    if (!toNext) throw new Error("first train from MV doesn't stop at San Antonio");
    const now = Math.round((toNext.dep + toNext.arr) / 2);
    const m = detectOnTrain(ride("mountain_view", "san_antonio", now, { leadingStation: true }), now, null);
    expect(m).toMatchObject({ trip_id: t.trip_id, service_date: WEEKDAY, confidence: "high" });
  });

  it("says low when it can't tell from the speed or a station", () => {
    const { t, toNext } = northbound();
    if (!toNext) throw new Error("no train");
    const now = Math.round((toNext.dep + toNext.arr) / 2);
    const m = detectOnTrain(ride("mountain_view", "san_antonio", now, { speed: 15, startFraction: 0.4, fraction: 0.5 }), now, null);
    expect(m).toMatchObject({ trip_id: t.trip_id, confidence: "low" });
  });

  it("ignores walking speed, however close to the tracks", () => {
    const { toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    expect(detectOnTrain(ride("mountain_view", "san_antonio", now, { speed: 1.4 }), now, null)).toBeNull();
  });

  it("ignores driving away from the line", () => {
    const { toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const away = ride("mountain_view", "san_antonio", now).map((s) => ({ ...s, lon: s.lon + 0.03 }));
    expect(detectOnTrain(away, now, null)).toBeNull();
  });

  it("ignores movement along the line when no train is near", () => {
    const now = at(WEEKDAY, "03:30");
    expect(detectOnTrain(ride("mountain_view", "san_antonio", now), now, null)).toBeNull();
  });

  it("doesn't match a train running the other way", () => {
    const { t, toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const m = detectOnTrain(ride("san_antonio", "mountain_view", now, { startFraction: 0.5, fraction: 0.65 }), now, null);
    expect(m?.trip_id).not.toBe(t.trip_id);
  });

  it("needs recent fixes", () => {
    const { toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    expect(detectOnTrain(ride("mountain_view", "san_antonio", now - 10 * MIN), now, null)).toBeNull();
    expect(detectOnTrain(ride("mountain_view", "san_antonio", now, { count: 1 }), now, null)).toBeNull();
  });

  it("follows a late train with live data", () => {
    const { t, toNext } = northbound();
    const late = 8 * 60;
    const now = Math.round((toNext!.dep + toNext!.arr) / 2) + late * 1000;
    const snap = snapshot(now, { [t.trip_id]: { delay: late, stops: {} } });
    expect(detectOnTrain(ride("mountain_view", "san_antonio", now, { leadingStation: true }), now, snap)?.trip_id).toBe(t.trip_id);
  });

  it("skips a cancelled train", () => {
    const { t, toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const snap = snapshot(now, { [t.trip_id]: { cancelled: true, stops: {} } });
    expect(detectOnTrain(ride("mountain_view", "san_antonio", now, { leadingStation: true }), now, snap)?.trip_id).not.toBe(t.trip_id);
  });
});

describe("stillOnTrain", () => {
  it("holds through a station stop and lets go once the train is away", () => {
    const { t, toNext } = northbound();
    const now = toNext!.arr;
    const match = { trip_id: t.trip_id, service_date: t.service_date, confidence: "high" as const };
    const sa = station("san_antonio")!;
    const stopped: OnTrainSample[] = [{ lat: sa.lat!, lon: sa.lon!, at: now, speed: 0 }];
    expect(stillOnTrain(match, stopped, now, null)).toBe(true);
    const later = now + 12 * MIN;
    expect(stillOnTrain(match, [{ lat: sa.lat!, lon: sa.lon!, at: later, speed: 0 }], later, null)).toBe(false);
  });
});

describe("onTrainCard", () => {
  it("heads for the commute's stop when the train goes there", () => {
    const { t, toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const card = onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, commuter(), null, now, null)!;
    expect(card).toMatchObject({ train: t.train, to_source: "commute", tracked: false });
    expect(card.to.id).toBe("san_francisco");
    expect(card.from.id).toBe("mountain_view");
    expect(card.next?.id).toBe("san_antonio");
    expect(card.stops.at(-1)?.id).toBe("san_francisco");
  });

  it("heads for the commute's stop when the train skips their usual station", () => {
    const trains = departures("mountain_view", "san_francisco", at(WEEKDAY, "07:00"), null, { lookbackMs: 0, limit: 20 });
    const skips = (id: string, tripId: string) => !departures(id, "san_francisco", at(WEEKDAY, "05:00"), null, { lookbackMs: 0, limit: 200, horizonMs: 8 * 60 * MIN }).some((x) => x.trip_id === tripId);
    const t = trains.find((x) => skips("san_antonio", x.trip_id));
    if (!t) throw new Error("every morning train stops at San Antonio");
    const settings = commuter();
    settings.morning = { ...settings.morning!, from: "san_antonio" };
    const card = onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, settings, null, t.dep + MIN, null)!;
    expect(card.to_source).toBe("commute");
    expect(card.to.id).toBe("san_francisco");
    // The evening leg runs the other way: it never names this train's stop.
    expect(onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, commuter({ morning: null }), null, t.dep + MIN, null)!.to_source).toBe("terminal");
  });

  it("falls back to the end of the line without a commute", () => {
    const { t, toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const card = onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "low" }, null, null, now, null)!;
    expect(card.to_source).toBe("terminal");
    expect(card.to.id).toBe("san_francisco");
  });

  it("uses the tracked stop and says it's tracked", () => {
    const { t, toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const card = onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, commuter(), { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "palo_alto" }, now, null)!;
    expect(card).toMatchObject({ to_source: "tracked", tracked: true });
    expect(card.to.id).toBe("palo_alto");
  });

  it("leaves out alerts for the other direction", () => {
    const { t, toNext } = northbound();
    const now = Math.round((toNext!.dep + toNext!.arr) / 2);
    const alert = (id: string, header: string) => ({ id, header, description: "", stations: [] as string[], routes: [] as string[] });
    const snap = snapshot(now, {}, [alert("n", "Northbound delays at Millbrae"), alert("s", "Southbound delays at Millbrae"), alert("both", "Elevator out at Millbrae")]);
    const card = onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, commuter(), null, now, snap)!;
    expect(card.alerts.map((a) => a.id).sort()).toEqual(["both", "n"]);
  });

  it("ends when the train arrives", () => {
    const { t } = northbound();
    const card = onTrainCard({ trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, commuter(), { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" }, t.arr + 5 * MIN, null);
    expect(card).toBeNull();
  });
});

describe("commuteArrival", () => {
  const { t } = northbound();
  const sf = station("san_francisco")!, mv = station("mountain_view")!;
  const atSF = { lat: sf.lat!, lon: sf.lon!, speed: 0 };
  const ride = { trip_id: t.trip_id };

  it("says the morning leg is done at its destination station", () => {
    expect(commuteArrival(commuter(), ride, atSF, t.arr)).toEqual({ date: WEEKDAY, part: "morning", at: t.arr });
    expect(commuteArrival(commuter(), { ...ride, to: "san_francisco" }, { lat: sf.lat! + 0.002, lon: sf.lon! }, t.arr)?.part).toBe("morning");
  });
  it("needs them to be there, and not passing through", () => {
    expect(commuteArrival(commuter(), ride, { lat: mv.lat!, lon: mv.lon!, speed: 0 }, t.arr)).toBeNull();
    expect(commuteArrival(commuter(), ride, { lat: sf.lat! + 0.01, lon: sf.lon! }, t.arr)).toBeNull();
    expect(commuteArrival(commuter(), ride, { ...atSF, speed: 20 }, t.arr)).toBeNull();
  });
  it("leaves a one-off alone: tracked to another stop, another direction, a day off, after the window", () => {
    expect(commuteArrival(commuter(), { ...ride, to: "palo_alto" }, atSF, t.arr)).toBeNull();
    const south = departures("san_francisco", "mountain_view", at(WEEKDAY, "08:00"), null, { lookbackMs: 0 })[0];
    expect(commuteArrival(commuter({ evening: null }), { trip_id: south.trip_id }, atSF, t.arr)).toBeNull();
    expect(commuteArrival(commuter({ days: [5, 6] }), ride, atSF, t.arr)).toBeNull();
    expect(commuteArrival(commuter(), ride, atSF, at(WEEKDAY, "10:45"))).toBeNull();
  });
  it("ignores a train that isn't due there now", () => {
    expect(commuteArrival(commuter(), ride, atSF, t.arr - 20 * MIN)).toBeNull();
    expect(commuteArrival(commuter(), ride, atSF, t.arr + 61 * MIN)).toBeNull();
    expect(commuteArrival(commuter(), ride, atSF, t.arr + 10 * MIN)?.part).toBe("morning");
  });
  it("finishes the evening leg at home", () => {
    const south = departures("san_francisco", "mountain_view", at(WEEKDAY, "17:00"), null, { lookbackMs: 0 })[0];
    expect(commuteArrival(commuter(), { trip_id: south.trip_id }, { lat: mv.lat!, lon: mv.lon! }, south.arr)?.part).toBe("evening");
  });
});

describe("onLine", () => {
  it("measures distance from the line", () => {
    const s = station("palo_alto")!;
    expect(onLine({ lat: s.lat!, lon: s.lon! }).off).toBeLessThan(5);
    expect(onLine({ lat: s.lat!, lon: s.lon! + 0.1 }).off).toBeGreaterThan(5000);
  });
});
