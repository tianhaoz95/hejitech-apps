import { describe, expect, it } from "vitest";
import { alertAffectsLeg, commuteDoneCard, departures, dueNotifications, normalizeSettings, station, type CommuteDone, type RealtimeSnapshot, type ServiceAlert, type Settings, type Tracked } from "../src/index.ts";
import { at, commuter, firstTrain, SATURDAY, snapshot, WEEKDAY } from "./helpers.ts";

const MIN = 60_000;
const mv = station("mountain_view")!;
const t = firstTrain(WEEKDAY, "08:00");
const late = (min: number, now: number) => snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { delay: min * 60 } } } });
const run = (now: number, snap: ReturnType<typeof late> | null = late(0, now), over = {}, sent = new Set<string>(), tracked: Tracked | null = null) =>
  dueNotifications({ now, settings: commuter(over), snapshot: snap, tracked, sent });

describe("delay alerts", () => {
  const now = t.dep - 20 * MIN;
  it("fires at the threshold, once", () => {
    expect(run(now, late(4, now)).notifications.filter((n) => n.kind === "delay")).toHaveLength(0);
    const r = run(now, late(7, now)).notifications.filter((n) => n.kind === "delay");
    expect(r).toHaveLength(1);
    expect(r[0].title).toContain("7 min late");
    expect(run(now, late(8, now), {}, new Set([r[0].key])).notifications.filter((n) => n.kind === "delay")).toHaveLength(0);
  });
  it("fires again when it gets 5 minutes worse", () => {
    const first = run(now, late(6, now)).notifications.find((n) => n.kind === "delay")!;
    const worse = run(now, late(11, now), {}, new Set([first.key])).notifications.find((n) => n.kind === "delay");
    expect(worse?.title).toContain("11 min late");
  });
  it("respects the switch, the window and the days", () => {
    expect(run(now, late(10, now), { alerts: { ...commuter().alerts, delay: false } }).notifications.filter((n) => n.kind === "delay")).toHaveLength(0);
    const sat = at(SATURDAY, "08:00");
    expect(run(sat, late(10, sat)).notifications).toHaveLength(0);
    const night = at(WEEKDAY, "23:00");
    expect(run(night, late(10, night)).notifications).toHaveLength(0);
  });
});

describe("cancellations", () => {
  it("names the next train", () => {
    const now = t.dep - 30 * MIN;
    const n = run(now, snapshot(now, { [t.trip_id]: { cancelled: true, stops: {} } })).notifications.find((x) => x.kind === "cancellation")!;
    expect(n.title).toContain("cancelled");
    expect(n.body).toContain("Next:");
  });
});

describe("leave now", () => {
  it("fires walk_minutes before the usual train", () => {
    const leave = t.pred_dep - 10 * MIN;
    expect(run(leave - 3 * MIN).notifications.filter((n) => n.kind === "leave_now")).toHaveLength(0);
    const n = run(leave).notifications.find((x) => x.kind === "leave_now")!;
    expect(n.title).toContain("Leave now");
    expect(n.key).toBe(`leave:${t.service_date}:${t.trip_id}`);
  });
  it("waits for a late train", () => {
    const leave = t.dep - 10 * MIN;
    expect(run(leave, late(8, leave)).notifications.filter((n) => n.kind === "leave_now")).toHaveLength(0);
    const n = run(leave + 8 * MIN, late(8, leave + 8 * MIN)).notifications.find((x) => x.kind === "leave_now")!;
    expect(n.body).toContain("8 min late");
  });
  it("needs a usual time", () => {
    const leave = t.pred_dep - 10 * MIN;
    const s = commuter();
    expect(run(leave, undefined, { morning: { ...s.morning!, usual: null } }).notifications.filter((n) => n.kind === "leave_now")).toHaveLength(0);
  });
  it("targets express train when express_only is set", () => {
    const s = commuter();
    // 08:36 train is express; leave time is 08:26 (10 min walk)
    const leave = at(WEEKDAY, "08:26");
    const res = run(leave, undefined, {
      morning: { ...s.morning!, usual: "08:00", walk_minutes: 10, express_preference: "express_only" },
    });
    const n = res.notifications.find((x) => x.kind === "leave_now");
    expect(n).toBeDefined();
    expect(n?.title).toContain("8:36");
    expect(n?.body).toContain("Express");
  });
});

describe("service alerts", () => {
  it("sends alerts for the leg's stations once", () => {
    const now = at(WEEKDAY, "07:30");
    const snap = snapshot(now, {}, [{ id: "x1", header: "Single tracking at Mountain View", description: "Expect 10 min delays.", stations: ["mountain_view"], routes: [] }]);
    const n = run(now, snap).notifications.find((x) => x.kind === "service")!;
    expect(n.body).toBe("Expect 10 min delays.");
    expect(run(now, snap, {}, new Set([n.key])).notifications.filter((x) => x.kind === "service")).toHaveLength(0);
  });
});

describe("arrival", () => {
  const tracked: Tracked = { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" };
  it("fires arrival_minutes before the stop, any time of day", () => {
    expect(run(t.arr - 10 * MIN, null, { days: [] }, new Set(), tracked).notifications).toHaveLength(0);
    const r = run(t.arr - 4 * MIN, null, { days: [] }, new Set(), tracked);
    expect(r.notifications[0].kind).toBe("arrival");
    expect(r.notifications[0].title).toBe("San Francisco in 4 min");
    expect(r.trackingDone).toBe(false);
  });
  it("ends tracking after arrival", () => {
    expect(run(t.arr + 5 * MIN, null, {}, new Set(), tracked).trackingDone).toBe(true);
  });
});

describe("better train alerts", () => {
  it("fires when a train inside the window is overtaken by a later train that arrives sooner", () => {
    const now = at(WEEKDAY, "07:55");
    const t113 = firstTrain(WEEKDAY, "08:15");
    const snap = snapshot(now, { [t113.trip_id]: { stops: { [mv.nb!]: { delay: 8 * 60 } } } });
    const res = run(now, snap);
    const n = res.notifications.find((x) => x.kind === "better_train");
    expect(n).toBeDefined();
    expect(n?.title).toContain("take 511 instead");
    expect(n?.body).toContain("2 min before");

    // Dedupe prevents sending again
    const again = run(now, snap, {}, new Set([n!.key]));
    expect(again.notifications.filter((x) => x.kind === "better_train")).toHaveLength(0);

    // Disabled setting prevents sending
    const disabled = run(now, snap, { alerts: { ...commuter().alerts, better_train: false } });
    expect(disabled.notifications.filter((x) => x.kind === "better_train")).toHaveLength(0);
  });
});

describe("priority and quiet notifications", () => {
  const alert = (id: string, header: string, over: Partial<ServiceAlert> = {}): ServiceAlert => ({ id, header, description: "", stations: [], routes: [], ...over });
  const leg = commuter().morning!;

  describe("alertAffectsLeg", () => {
    const now = at(WEEKDAY, "08:00");
    it("counts one that says nothing about direction or time", () => {
      expect(alertAffectsLeg(alert("a", "Elevator out of service at Mountain View"), leg, now)).toBe(true);
    });
    it("drops the other direction but keeps yours", () => {
      expect(alertAffectsLeg(alert("a", "Southbound delays near Millbrae"), leg, now)).toBe(false);
      expect(alertAffectsLeg(alert("a", "Northbound delays near Millbrae"), leg, now)).toBe(true);
      expect(alertAffectsLeg(alert("a", "SB trains single tracking"), leg, now)).toBe(false);
    });
    it("counts one naming both directions", () => {
      expect(alertAffectsLeg(alert("a", "Northbound and southbound delays"), leg, now)).toBe(true);
    });
    it("drops times outside the window", () => {
      expect(alertAffectsLeg(alert("a", "Delays expected around 2 pm"), leg, now)).toBe(false);
      expect(alertAffectsLeg(alert("a", "Delays expected around 8:30 am"), leg, now)).toBe(true);
    });
    it("drops one whose period misses the window", () => {
      const afternoon = Math.floor(at(WEEKDAY, "14:00") / 1000);
      expect(alertAffectsLeg(alert("a", "Track work", { start: afternoon }), leg, now)).toBe(false);
    });
    it("checks a named train against the leg", () => {
      const t = firstTrain(WEEKDAY, "08:00");
      const after = firstTrain(WEEKDAY, "14:00");
      expect(alertAffectsLeg(alert("a", `Train ${t.train} is delayed`), leg, now)).toBe(true);
      expect(alertAffectsLeg(alert("a", `Train ${after.train} is delayed`), leg, now)).toBe(false);
    });
  });

  const due = (now: number, over: Partial<Settings["alerts"]>, snap: RealtimeSnapshot, sent = new Set<string>()) => {
    const s = commuter();
    return dueNotifications({ now, settings: { ...s, alerts: { ...s.alerts, ...over } }, snapshot: snap, tracked: null, sent }).notifications;
  };

  it("sends only priority by default: a 2 pm delay on your line says nothing", () => {
    const now = at(WEEKDAY, "14:00");
    const t = firstTrain(WEEKDAY, "14:10");
    expect(due(now, {}, snapshot(now, { [t.trip_id]: { delay: 15 * 60, stops: {} } }))).toEqual([]);
  });

  it("makes that delay quiet when asked for everything", () => {
    const now = at(WEEKDAY, "14:00");
    const t = firstTrain(WEEKDAY, "14:10");
    const n = due(now, { scope: "all" }, snapshot(now, { [t.trip_id]: { delay: 15 * 60, stops: {} } }));
    const hit = n.find((x) => x.key.includes(t.trip_id))!;
    expect(hit.priority).toBe(false);
    expect(hit.key.startsWith("q:delay:")).toBe(true);
  });

  it("makes a reverse-direction delay in the commute window quiet, and your own priority", () => {
    const now = at(WEEKDAY, "08:00");
    const mine = firstTrain(WEEKDAY, "08:10");
    const back = departures("san_francisco", "mountain_view", now, null, { lookbackMs: 0 })[0];
    const snap = snapshot(now, { [mine.trip_id]: { delay: 15 * 60, stops: {} }, [back.trip_id]: { delay: 15 * 60, stops: {} } });
    expect(due(now, {}, snap).map((x) => x.key)).toEqual(expect.arrayContaining([expect.stringContaining(mine.trip_id)]));
    expect(due(now, {}, snap).some((x) => x.key.includes(back.trip_id))).toBe(false);
    const all = due(now, { scope: "all" }, snap);
    expect(all.find((x) => x.key.includes(mine.trip_id))?.priority).toBe(true);
    expect(all.find((x) => x.key.includes(back.trip_id))?.priority).toBe(false);
  });

  it("keeps a reverse service alert out of priority", () => {
    const now = at(WEEKDAY, "08:00");
    const snap = snapshot(now, {}, [alert("sb", "Southbound delays at Mountain View", { stations: ["mountain_view"] })]);
    expect(due(now, {}, snap).filter((x) => x.kind === "service")).toEqual([]);
    const all = due(now, { scope: "all" }, snap).filter((x) => x.kind === "service");
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ key: "q:service:sb", priority: false });
  });

  it("still sends a train's priority alert after its quiet one", () => {
    const now = at(WEEKDAY, "08:00");
    const t = firstTrain(WEEKDAY, "08:10");
    const snap = snapshot(now, { [t.trip_id]: { delay: 15 * 60, stops: {} } });
    const sent = new Set([`q:delay:${t.service_date}:${t.trip_id}:2`]);
    expect(due(now, { scope: "all" }, snap, sent).find((x) => x.key.includes(t.trip_id))?.priority).toBe(true);
  });

  it("doesn't repeat quietly what already went out as priority", () => {
    const now = at(WEEKDAY, "14:00");
    const snap = snapshot(now, {}, [alert("a", "Elevator out at Mountain View", { stations: ["mountain_view"] })]);
    expect(due(now, { scope: "all" }, snap, new Set(["service:a"]))).toEqual([]);
  });

  it("stays silent on days off, whatever the scope", () => {
    const now = at(SATURDAY, "09:00");
    const snap = snapshot(now, {}, [alert("a", "Elevator out at Mountain View", { stations: ["mountain_view"] })]);
    expect(due(now, { scope: "all" }, snap)).toEqual([]);
  });

  it("keeps the tracked train's alerts priority", () => {
    const t = firstTrain(WEEKDAY, "08:00");
    const s = commuter();
    const r = dueNotifications({ now: t.arr - 60_000, settings: s, snapshot: null, tracked: { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" }, sent: new Set() });
    expect(r.notifications.find((n) => n.kind === "arrival")?.priority).toBe(true);
  });
});

describe("commute done", () => {
  const now = t.dep - 20 * MIN;
  const done: CommuteDone = { date: WEEKDAY, part: "morning", at: now - 5 * MIN };
  const due = (d: CommuteDone | null, over: Partial<Settings> = {}, when = now, tracked: Tracked | null = null, lateMin = 12) =>
    dueNotifications({ now: when, settings: commuter(over), snapshot: late(lateMin, when), tracked, sent: new Set(), done: d }).notifications;

  it("stops the finished leg's alerts for the rest of its window", () => {
    expect(due(null).some((n) => n.kind === "delay")).toBe(true);
    expect(due(done)).toHaveLength(0);
    const leaveAt = t.dep - 10 * MIN;
    expect(due(null, {}, leaveAt, null, 0).some((n) => n.kind === "leave_now")).toBe(true);
    expect(due(done, {}, leaveAt, null, 0)).toHaveLength(0);
    expect(due(done, { alerts: { ...commuter().alerts, scope: "all" } }).filter((n) => n.priority)).toHaveLength(0);
  });
  it("is on unless switched off, and old settings get it", () => {
    expect(commuter().alerts.stop_when_done).toBe(true);
    const old = { ...commuter(), alerts: { ...commuter().alerts } } as Settings;
    delete old.alerts.stop_when_done;
    expect(normalizeSettings(old).alerts.stop_when_done).toBe(true);
    expect(due(done, { alerts: { ...commuter().alerts, stop_when_done: false } }).some((n) => n.kind === "delay")).toBe(true);
  });
  it("comes back when turned on for today, the next day, and for the other leg", () => {
    expect(due({ ...done, resumed: true }).some((n) => n.kind === "delay")).toBe(true);
    expect(due({ ...done, date: "20261026" }).some((n) => n.kind === "delay")).toBe(true);
    expect(due({ ...done, part: "evening" }).some((n) => n.kind === "delay")).toBe(true);
  });
  it("keeps the tracked train's arrival alert", () => {
    const tracked: Tracked = { trip_id: t.trip_id, service_date: WEEKDAY, from: "mountain_view", to: "san_francisco" };
    expect(due(done, {}, t.arr - 3 * MIN, tracked, 0).map((n) => n.kind)).toEqual(["arrival"]);
  });
  it("shows the card until the window ends", () => {
    expect(commuteDoneCard(commuter(), done, now)).toMatchObject({ part: "morning", to: { id: "san_francisco" }, at: done.at, until: at(WEEKDAY, "10:30") });
    expect(commuteDoneCard(commuter(), done, at(WEEKDAY, "10:31"))).toBeNull();
    expect(commuteDoneCard(commuter(), { ...done, resumed: true }, now)).toBeNull();
    expect(commuteDoneCard(commuter({ alerts: { ...commuter().alerts, stop_when_done: false } }), done, now)).toBeNull();
    expect(commuteDoneCard(commuter(), null, now)).toBeNull();
  });
});
