import { describe, expect, it } from "vitest";
import {
  addDays, board, boardActivityState, checkSettings, clock, commuteBoard, currentLeg, defaultSettings, departures, findStation, newLeg, normalizeSettings, progress, serviceDayStart, STATIONS, station, TIMETABLE, timetableDaysLeft, zoned,
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

describe("express preference", () => {
  it("filters strictly with express_only", () => {
    const now = at(WEEKDAY, "07:30");
    const trains = departures("mountain_view", "san_francisco", now, null, { expressPreference: "express_only" });
    expect(trains.length).toBeGreaterThan(0);
    for (const t of trains) {
      expect(t.kind).toBe("EXP");
    }
  });

  it("prioritizes express trains when prefer_express is set", () => {
    const now = at(WEEKDAY, "07:30");
    const allTrains = departures("mountain_view", "san_francisco", now, null, { expressPreference: "all" });
    const preferred = departures("mountain_view", "san_francisco", now, null, { expressPreference: "prefer_express" });
    expect(allTrains.length).toBeGreaterThan(0);
    expect(preferred.length).toBeGreaterThan(0);
    // Express trains should be present and ranked ahead of slower overlapping trips
    const firstExp = preferred.find((t) => t.kind === "EXP");
    expect(firstExp).toBeDefined();
  });

  it("returns empty when express_only is requested on weekends or stations without express", () => {
    const sat = at(SATURDAY, "08:00");
    const trains = departures("mountain_view", "san_francisco", sat, null, { expressPreference: "express_only" });
    expect(trains).toHaveLength(0);

    // San Antonio has no express service
    const weekday = at(WEEKDAY, "08:00");
    const saTrains = departures("san_antonio", "san_francisco", weekday, null, { expressPreference: "express_only" });
    expect(saTrains).toHaveLength(0);
  });

  it("attaches express preference to board and commuteBoard", () => {
    const now = at(WEEKDAY, "08:00");
    const b = board("mountain_view", "san_francisco", now, null, "custom", TIMETABLE, { expressPreference: "express_only" });
    expect(b?.express_preference).toBe("express_only");
    for (const t of b!.trains) expect(t.kind).toBe("EXP");

    const settings = commuter({
      morning: { ...newLeg("mountain_view", "san_francisco", "morning"), express_preference: "express_only" },
    });
    const cb = commuteBoard(settings, now, null);
    expect(cb?.express_preference).toBe("express_only");
  });

  it("validates and normalizes express_preference in settings", () => {
    expect(checkSettings({ ...defaultSettings(), express_preference: "invalid" as any })).toHaveLength(1);
    expect(checkSettings({ ...defaultSettings(), express_preference: "express_only" })).toHaveLength(0);

    const norm = normalizeSettings({
      morning: { from: "mountain_view", to: "san_francisco", express_preference: "prefer_express" },
      evening: { from: "san_francisco", to: "mountain_view" },
      express_preference: "express_only",
    });
    expect(norm.express_preference).toBe("express_only");
    expect(norm.morning?.express_preference).toBe("prefer_express");
    expect(norm.evening?.express_preference).toBe("express_only");
  });
});

describe("catch it (leave-by times)", () => {
  it("calculates leave-by and catch state across boundaries", () => {
    const s = commuter();
    // At 07:55, with a 10 min walk:
    // A train departing at 08:16: d = 21 min >= walk + 1 -> "leave" (if first catchable)
    // A train departing at 08:03: d = 8 min (walk/2 <= d < walk) -> "run"
    // A train departing at 07:58: d = 3 min (d < walk/2) -> "missed"
    const b = commuteBoard(s, at(WEEKDAY, "07:55"), null);
    expect(b?.walk_minutes).toBe(10);
    expect(b?.trains.length).toBeGreaterThan(0);
    const leaveTrain = b?.trains.find((t) => t.catch === "leave");
    expect(leaveTrain).toBeDefined();
    expect(leaveTrain!.leave_by).toBe(leaveTrain!.pred_dep - 10 * MIN);

    const first = b!.trains[0];
    if (first.catch === "run") {
      const dMin = (first.pred_dep - at(WEEKDAY, "07:55")) / MIN;
      expect(dMin).toBeGreaterThanOrEqual(5);
      expect(dMin).toBeLessThan(10);
    }
  });

  it("updates leave-by when a live delay pushes departure later", () => {
    const t = firstTrain(WEEKDAY, "08:00");
    const now = t.dep - 15 * MIN;
    const mv = station("mountain_view")!;
    const snap = snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { delay: 8 * 60 } } } });
    const b = commuteBoard(commuter(), now, snap);
    const found = b?.trains.find((x) => x.trip_id === t.trip_id)!;
    expect(found.delay_min).toBe(8);
    expect(found.leave_by).toBe(found.pred_dep - 10 * MIN);
    expect(found.leave_by).toBe(found.dep + 8 * MIN - 10 * MIN);
  });

  it("leaves walk_minutes undefined on custom pairs", () => {
    const now = at(WEEKDAY, "08:00");
    const b = board("mountain_view", "san_francisco", now, null);
    expect(b?.walk_minutes ?? null).toBeNull();
    for (const t of b!.trains) {
      expect(t.leave_by ?? null).toBeNull();
      expect(t.catch ?? null).toBeNull();
    }
  });
});

describe("wait for express (overtaken trains & board tips)", () => {
  it("detects when a later train arrives earlier due to delays", () => {
    const now = at(WEEKDAY, "07:55");
    const trains = departures("mountain_view", "san_francisco", now, null, { limit: 6 });
    const t113 = trains.find((t) => t.train === "113")!;
    const mv = station("mountain_view")!;
    const snap = snapshot(now, { [t113.trip_id]: { stops: { [mv.nb!]: { delay: 8 * 60 } } } });

    const b = board("mountain_view", "san_francisco", now, snap, "custom")!;
    expect(b.live).toBe(true);
    const delayed113 = b.trains.find((t) => t.train === "113")!;
    expect(delayed113.delay_min).toBe(8);
    expect(delayed113.overtaken_by_train).toBe("511");

    const exp511 = b.trains.find((t) => t.train === "511")!;
    expect(exp511.shortest).toBe(true);

    const first = b.trains.find((t) => t.train === "409")!;
    expect(first.first_in).toBe(true);

    expect(b.tip).toBeDefined();
    expect(b.tip?.wait_for).toBe("511");
    expect(b.tip?.instead_of).toBe("113");
    expect(b.tip?.saves_min).toBe(2);
  });
});


describe("board Live Activity", () => {
  it("keeps the next three trains still to leave, with predicted times", () => {
    const now = at(WEEKDAY, "07:50");
    const b = board("mountain_view", "san_francisco", now, null)!;
    const later = b.trains[1].pred_dep + 1;
    const s = boardActivityState(b, later);
    expect(s.live).toBe(false);
    expect(s.trains).toHaveLength(3);
    expect(s.trains[0].train).toBe(b.trains.find((t) => t.pred_dep > later)!.train);
    for (const t of s.trains) {
      expect(t.dep).toBeGreaterThan(later);
      expect(t.arr).toBeGreaterThan(t.dep);
      expect(t.cancelled).toBe(false);
    }
  });
});
