import { describe, expect, it } from "vitest";
import { applyCommutePatch, daysText, diffHeadline, settingsDiff, type Settings } from "../src/index.ts";
import { commuter } from "./helpers.ts";

const ok = (r: ReturnType<typeof applyCommutePatch>): Settings => {
  if ("issues" in r) throw new Error(JSON.stringify(r.issues));
  return r.settings;
};
const issues = (r: ReturnType<typeof applyCommutePatch>) => ("issues" in r ? r.issues.map((i) => i.path) : []);

describe("applyCommutePatch", () => {
  it("changes only the fields given, keeping the rest of the leg", () => {
    const before = commuter();
    const after = ok(applyCommutePatch(before, { evening: { usual: "16:00", travel_mode: "bike", walk_minutes: 6 } }));
    expect(after.evening).toMatchObject({ from: "san_francisco", to: "mountain_view", usual: "16:00", travel_mode: "bike", walk_minutes: 6 });
    expect(after.evening!.window).toEqual(before.evening!.window);
    expect(after.morning).toEqual(before.morning);
    expect(after.alerts).toEqual(before.alerts);
  });

  it("takes stations by name or short name, and adds a leg that wasn't there", () => {
    const before = { ...commuter(), evening: null };
    const after = ok(applyCommutePatch(before, { evening: { from: "San Francisco", to: "MTN VIEW" }, morning: { to: "22nd street" } }));
    expect(after.evening).toMatchObject({ from: "san_francisco", to: "mountain_view", walk_minutes: 10 });
    expect(after.morning!.to).toBe("22nd_street");
  });

  it("removes a leg with null, and merges alerts and window halves", () => {
    const after = ok(applyCommutePatch(commuter(), { morning: null, alerts: { delay_threshold: 3, leave_now: false }, evening: { window: { end: "21:00" } }, days: [3, 0, 1] }));
    expect(after.morning).toBeNull();
    expect(after.alerts).toMatchObject({ delay_threshold: 3, leave_now: false, cancellation: true });
    expect(after.evening!.window).toEqual({ start: "15:30", end: "21:00" });
    expect(after.days).toEqual([0, 1, 3]);
  });

  it("refuses what an assistant may not change, and anything the app wouldn't save", () => {
    expect(issues(applyCommutePatch(commuter(), { on_train: "background" }))).toEqual(["on_train"]);
    expect(issues(applyCommutePatch(commuter(), { share_name: "Sam", days: [0] }))).toEqual(["share_name"]);
    expect(issues(applyCommutePatch(commuter(), { evening: { color: "red" } }))).toEqual(["evening.color"]);
    expect(issues(applyCommutePatch(commuter(), { morning: { from: "Atlantis" } }))).toContain("morning.from");
    expect(issues(applyCommutePatch(commuter(), { morning: { walk_minutes: 300 } }))).toContain("morning.walk_minutes");
    expect(issues(applyCommutePatch(commuter(), { evening: { window: { start: "22:00" } } }))).toContain("evening.window");
    expect(issues(applyCommutePatch({ ...commuter(), evening: null }, { evening: { usual: "17:00" } }))).toEqual(["evening"]);
    expect(issues(applyCommutePatch(commuter(), {}))).toEqual([""]);
    expect(issues(applyCommutePatch(commuter(), { alerts: { delay_threshold: 0 } }))).toContain("alerts.delay_threshold");
  });
});

describe("settingsDiff", () => {
  it("says each change in words", () => {
    const before = commuter();
    const after = ok(applyCommutePatch(before, {
      evening: { usual: "16:00", travel_mode: "ebike" }, days: [0, 1, 2, 3], alerts: { arrival_minutes: 8, better_train: false }, morning: { from: "Palo Alto" },
    }));
    const lines = settingsDiff(before, after);
    expect(lines).toEqual([
      "Morning: Mountain View → San Francisco → Palo Alto → San Francisco",
      "Evening: usual train none → 4:00 PM",
      "Evening: getting there by walk → e-bike",
      "Commute days: Mon–Fri → Mon–Thu",
      "Arrival alert before 5 → 8 min",
      "Faster-train alerts off",
    ]);
    expect(diffHeadline(lines)).toBe("Morning: Mountain View → San Francisco → Palo Alto → San Francisco (+5 more)");
    expect(settingsDiff(before, before)).toEqual([]);
  });

  it("writes days as ranges", () => {
    expect(daysText([0, 1, 2, 3, 4])).toBe("Mon–Fri");
    expect(daysText([0, 2, 4])).toBe("Mon, Wed, Fri");
    expect(daysText([5, 6])).toBe("Sat, Sun");
    expect(daysText([])).toBe("no days");
  });
});
