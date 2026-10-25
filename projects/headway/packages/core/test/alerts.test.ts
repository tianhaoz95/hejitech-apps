import { describe, expect, it } from "vitest";
import { dueNotifications, station, type Tracked } from "../src/index.ts";
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
