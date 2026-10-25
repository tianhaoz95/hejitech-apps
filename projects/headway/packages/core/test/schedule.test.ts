import { describe, expect, it } from "vitest";
import {
  addDays, board, clock, commuteBoard, currentLeg, departures, findStation, progress, serviceDayStart, STATIONS, station, TIMETABLE, timetableDaysLeft, zoned,
} from "../src/index.ts";
import { at, commuter, firstTrain, SATURDAY, snapshot, THANKSGIVING, WEEKDAY } from "./helpers.ts";

const MIN = 60_000;

describe("time", () => {
  it("counts GTFS times from noon minus 12 hours, across DST", () => {
    // 2026-11-01: clocks fall back; the service day starts at 01:00 PDT = 23:00 PST the day before.
    expect(zoned(serviceDayStart("20261027")).h).toBe(0);
    const fallBack = serviceDayStart("20261101");
    expect(at("20261101", "12:00") - fallBack).toBe(12 * 60 * MIN);
  });
  it("formats 12-hour clocks", () => {
    expect(clock(at(WEEKDAY, "08:05"))).toBe("8:05");
    expect(clock(at(WEEKDAY, "00:30"))).toBe("12:30");
    expect(clock(at(WEEKDAY, "17:45"))).toBe("5:45");
  });
  it("adds days across months", () => expect(addDays("20261031", 1)).toBe("20261101"));
});

describe("timetable", () => {
  it("lists every station north to south with a short name for the glasses", () => {
    expect(STATIONS[0].id).toBe("san_francisco");
    expect(STATIONS.at(-1)!.id).toBe("gilroy");
    for (const s of STATIONS) expect(s.short.length).toBeLessThanOrEqual(11);
  });
  it("finds stations by name, short name or id", () => {
    expect(findStation("Mountain View")?.id).toBe("mountain_view");
    expect(findStation("mtn view")?.id).toBe("mountain_view");
    expect(findStation("sj diridon")?.id).toBe("sj_diridon");
    expect(findStation("Millbrae")?.id).toBe("millbrae");
  });
  it("is valid for at least three more weeks (rebuild with scripts/build-timetable.mjs)", () => {
    expect(timetableDaysLeft(Date.now())).toBeGreaterThan(21);
    expect(TIMETABLE.trips.length).toBeGreaterThan(100);
  });
});

describe("departures", () => {
  it("lists northbound trains from Mountain View to SF in order, soonest first", () => {
    const now = at(WEEKDAY, "07:50");
    const trains = departures("mountain_view", "san_francisco", now);
    expect(trains.length).toBeGreaterThan(3);
    for (const t of trains) {
      expect(t.dir).toBe("N");
      expect(t.dep).toBeGreaterThanOrEqual(now - MIN);
      expect(t.arr).toBeGreaterThan(t.dep);
      expect(t.status).toBe("scheduled");
    }
    expect(trains.map((t) => t.dep)).toEqual([...trains.map((t) => t.dep)].sort((a, b) => a - b));
  });
  it("goes the other way for the reverse pair", () => {
    for (const t of departures("san_francisco", "mountain_view", at(WEEKDAY, "17:00"))) expect(t.dir).toBe("S");
  });
  it("runs fewer trains on weekends and holidays", () => {
    const span = (d: string) => departures("mountain_view", "san_francisco", at(d, "05:00"), null, { horizonMs: 18 * 60 * MIN, limit: 200 }).filter((t) => t.service_date === d).length;
    expect(span(SATURDAY)).toBeLessThan(span(WEEKDAY));
    expect(span(THANKSGIVING)).toBe(span(SATURDAY));
  });
  it("keeps trains after midnight on the service day before", () => {
    const late = departures("san_francisco", "sj_diridon", at(WEEKDAY, "23:30"), null, { limit: 3 });
    for (const t of late) expect([WEEKDAY, addDays(WEEKDAY, 1)]).toContain(t.service_date);
  });
});

describe("live predictions", () => {
  const t = firstTrain(WEEKDAY, "08:00");
  const mv = station("mountain_view")!, sf = station("san_francisco")!;
  const now = t.dep - 15 * MIN;

  it("applies a stop's delay to departure and arrival", () => {
    const snap = snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { delay: 6 * 60 } } } });
    const got = departures("mountain_view", "san_francisco", now, snap).find((x) => x.trip_id === t.trip_id)!;
    expect(got.delay_min).toBe(6);
    expect(got.status).toBe("late");
    expect(got.pred_dep - got.dep).toBe(6 * MIN);
    expect(got.pred_arr - got.arr).toBe(6 * MIN); // propagated down the line
  });
  it("reads absolute predicted times", () => {
    const snap = snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { dep: t.dep / 1000 + 120 }, [sf.nb!]: { arr: t.arr / 1000 + 300 } } } });
    const got = departures("mountain_view", "san_francisco", now, snap).find((x) => x.trip_id === t.trip_id)!;
    expect(got.delay_min).toBe(2);
    expect(got.pred_arr - got.arr).toBe(5 * MIN);
  });
  it("marks cancelled trips and skipped stops", () => {
    const c = departures("mountain_view", "san_francisco", now, snapshot(now, { [t.trip_id]: { cancelled: true, stops: {} } })).find((x) => x.trip_id === t.trip_id)!;
    expect(c.status).toBe("cancelled");
    const s = departures("mountain_view", "san_francisco", now, snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { skipped: true } } } })).find((x) => x.trip_id === t.trip_id)!;
    expect(s.status).toBe("cancelled");
  });
  it("calls a train with an update but no delay on time", () => {
    const got = departures("mountain_view", "san_francisco", now, snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { delay: 30 } } } })).find((x) => x.trip_id === t.trip_id)!;
    expect(got.status).toBe("on_time");
  });
  it("ignores a stale snapshot", () => {
    const stale = { ...snapshot(now, { [t.trip_id]: { cancelled: true, stops: {} } }), fetched_at: now - 30 * MIN };
    const b = board("mountain_view", "san_francisco", now, stale)!;
    expect(b.live).toBe(false);
    expect(b.trains.find((x) => x.trip_id === t.trip_id)!.status).toBe("scheduled");
  });
  it("ignores an entry for another service day", () => {
    const snap = snapshot(now, { [t.trip_id]: { start_date: addDays(WEEKDAY, -1), cancelled: true, stops: {} } });
    expect(departures("mountain_view", "san_francisco", now, snap).find((x) => x.trip_id === t.trip_id)!.status).toBe("scheduled");
  });
});

describe("commute", () => {
  it("shows the morning leg before switch_at and the evening leg after", () => {
    const s = commuter();
    expect(currentLeg(s, at(WEEKDAY, "07:00"))?.name).toBe("morning");
    expect(currentLeg(s, at(WEEKDAY, "13:00"))?.name).toBe("evening");
    const b = commuteBoard(s, at(WEEKDAY, "17:00"), null)!;
    expect([b.from.id, b.to.id, b.leg]).toEqual(["san_francisco", "mountain_view", "evening"]);
  });
  it("falls back to the only leg that is set", () => {
    expect(currentLeg(commuter({ evening: null }), at(WEEKDAY, "18:00"))?.name).toBe("morning");
    expect(currentLeg(commuter({ evening: null, morning: null }), at(WEEKDAY, "18:00"))).toBeNull();
  });
  it("shows alerts for the pair's stations and system-wide ones", () => {
    const now = at(WEEKDAY, "08:00");
    const snap = snapshot(now, {}, [
      { id: "a", header: "Delays at San Mateo", description: "", stations: ["san_mateo"], routes: [] },
      { id: "b", header: "Elevator out at Mountain View", description: "", stations: ["mountain_view"], routes: [] },
      { id: "c", header: "Weekend shutdown", description: "", stations: [], routes: [], start: now / 1000 + 86400 },
      { id: "d", header: "Systemwide delays", description: "", stations: [], routes: [] },
    ]);
    expect(board("mountain_view", "san_francisco", now, snap)!.alerts.map((a) => a.id)).toEqual(["b", "d"]);
  });
});

describe("progress", () => {
  const t = firstTrain(WEEKDAY, "08:00");
  const tracked = { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" };
  it("counts down to the stop", () => {
    const p = progress(tracked, t.dep + 5 * MIN, null)!;
    expect(p.arrived).toBe(false);
    expect(p.next).not.toBeNull();
    expect(p.stops_left).toBeGreaterThan(0);
    expect(p.pred_arr).toBe(t.arr);
  });
  it("knows when it has arrived", () => {
    const p = progress(tracked, t.arr + 2 * MIN, null)!;
    expect(p.arrived).toBe(true);
    expect(p.next).toBeNull();
  });
});
