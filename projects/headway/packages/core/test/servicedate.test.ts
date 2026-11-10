import { describe, expect, it } from "vitest";
import { addDays, detectOnTrain, progress, station, type OnTrainSample } from "../src/index.ts";
import { firstTrain, snapshot, WEEKDAY } from "./helpers.ts";

const MIN = 60_000;

// The feed's trip updates don't always carry a start date. Today's update must never apply to
// yesterday's run of the same train: that run then looked exactly a day (+1,440 min) late, and
// on-train detection picked it because it was checked first.
describe("live updates without a start date", () => {
  const t = firstTrain(WEEKDAY, "08:00");
  const mv = station("mountain_view")!;
  // Today's run leaves Mountain View 3 minutes late (an absolute predicted time, as the feed sends).
  const live = (now: number) => snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { dep: Math.round(t.dep / 1000) + 180 } } } });

  it("apply to today's run", () => {
    const now = t.dep - 5 * MIN;
    const p = progress({ trip_id: t.trip_id, service_date: WEEKDAY, from: "mountain_view", to: "san_francisco" }, now, live(now));
    expect(p?.delay_min).toBe(3);
  });

  it("don't make yesterday's run a day late", () => {
    const now = t.dep - 5 * MIN;
    const p = progress({ trip_id: t.trip_id, service_date: addDays(WEEKDAY, -1), from: "mountain_view", to: "san_francisco" }, now, live(now));
    expect(p?.delay_min).toBeNull();
    expect(p?.arrived).toBe(true);
  });

  it("on-train detection picks today's run", () => {
    const sf = station("san_antonio")!;
    const now = t.dep + 4 * MIN;
    const fixes: OnTrainSample[] = [0, 1, 2].map((i) => {
      const f = 0.2 + 0.1 * i;
      return { lat: mv.lat! + f * (sf.lat! - mv.lat!), lon: mv.lon! + f * (sf.lon! - mv.lon!), at: now - (2 - i) * 20_000, speed: 25 };
    });
    const m = detectOnTrain(fixes, now, live(now));
    expect(m?.trip_id).toBe(t.trip_id);
    expect(m?.service_date).toBe(WEEKDAY);
  });
});

describe("progress.departed", () => {
  const t = firstTrain(WEEKDAY, "08:00");
  const ride = { trip_id: t.trip_id, service_date: WEEKDAY, from: "mountain_view", to: "san_francisco" };

  it("is false until the train leaves their station, then true", () => {
    expect(progress(ride, t.dep - 5 * MIN, null)?.departed).toBe(false);
    expect(progress(ride, t.dep + 2 * MIN, null)?.departed).toBe(true);
  });

  it("waits for a late train", () => {
    const now = t.dep + 2 * MIN;
    const late = snapshot(now, { [t.trip_id]: { stops: { [station("mountain_view")!.nb!]: { delay: 300 } } } });
    expect(progress(ride, now, late)?.departed).toBe(false);
  });
});
