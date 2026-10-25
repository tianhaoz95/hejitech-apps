import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adherence, checkCheckin, checkFeedback, checkPlan, checkSettings, checkVital, dayPlan, dayState, defaultSettings, errorsOf, GUIDE,
  LINE_WIDTH, MAX_LINES, Navigator, normalizeSettings, setTarget, weekdayOf, type Checkin, type Command, type Plan, type World,
} from "../src/index.ts";

const plan = (): Plan => JSON.parse(readFileSync(new URL("../fixtures/example-plan.json", import.meta.url), "utf8"));
const MON = "2026-10-26";
const at = (h: number, m = 0) => Date.UTC(2026, 9, 26, h + 7, m); // Pacific daylight time

describe("plan", () => {
  it("the example plan validates without errors", () => {
    expect(errorsOf(checkPlan(plan()))).toEqual([]);
  });
  it("catches the rules the guide states", () => {
    const p = plan();
    p.week.mon.workouts[0].exercises[1].name = "A very long exercise name that won't fit";
    p.week.mon.workouts[0].exercises[1].cues = ["x".repeat(61)];
    p.week.mon.meals[1].id = "full-body-a"; // clashes with the workout's id
    p.week.tue.workouts[0].exercises[0].rest_sec = 2000;
    delete (p.week as Partial<Plan["week"]>).sun;
    const paths = errorsOf(checkPlan(p)).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining([
      "week.mon.workouts[0].exercises[1].name", "week.mon.workouts[0].exercises[1].cues[0]", "week.mon.meals[1].id",
      "week.tue.workouts[0].exercises[0].rest_sec", "week.sun",
    ]));
    expect(checkPlan({ format: 2 })[0].path).toBe("format");
  });
  it("warns about calories far from the target", () => {
    const p = plan();
    p.week.wed.meals = p.week.wed.meals.slice(0, 1);
    expect(checkPlan(p).some((i) => i.severity === "warning" && i.path === "week.wed.meals")).toBe(true);
  });
  it("finds the day: week, override, outside the plan", () => {
    expect(weekdayOf(MON)).toBe("mon");
    expect(dayPlan(plan(), MON)?.title).toBe("Full body A");
    expect(dayPlan(plan(), "2026-11-26")?.title).toBe("Thanksgiving");
    expect(dayPlan(plan(), "2026-10-01")).toBeNull();
    expect(dayPlan(plan(), "2027-01-01")).toBeNull();
  });
  it("describes a set target", () => {
    const ex = plan().week.mon.workouts[0].exercises;
    expect(setTarget(ex[1])).toBe("8-10 reps @ 24 kg");
    expect(setTarget(ex[4])).toBe("40 s");
    expect(setTarget(ex[0])).toBe("5 min @ easy");
  });
  it("the guide states the format and the limits", () => {
    expect(GUIDE).toContain('"format": 1');
    expect(GUIDE).toContain("rest_sec");
  });
});

const ci = (ref: string, kind: Checkin["kind"], status: Checkin["status"] = "done", data?: Checkin["data"]): Checkin =>
  ({ date: MON, ref, kind, status, plan_version: 1, data, at: new Date().toISOString() });

describe("day state and adherence", () => {
  it("counts sets, workouts and meals, with portions", () => {
    const checkins = [
      ci("full-body-a/bike/1", "set"), ci("full-body-a/goblet-squat/1", "set"), ci("full-body-a/goblet-squat/2", "set"),
      ci("breakfast", "meal", "done", { portion: "as_planned" }), ci("lunch", "meal", "done", { portion: "less" }), ci("snack", "meal", "skipped"),
    ];
    const s = dayState(plan(), MON, checkins);
    const w = s.workouts[0];
    expect([w.setsDone, w.setsTotal, w.status]).toEqual([3, 13, "in_progress"]);
    expect(w.exercises[0].status).toBe("done");
    expect(w.exercises[1].status).toBe("in_progress");
    expect(s.meals.map((m) => m.status)).toEqual(["done", "done", "skipped", "todo"]);
    expect(s.nutrition.eaten.calories).toBe(520 + Math.round(680 * 0.6));
    expect(s.nutrition.targets.calories).toBe(2200);
    expect(s.completion).toBeCloseTo((3 + 2) / (13 + 4));
  });
  it("later check-ins win; a workout marked done is done", () => {
    const s = dayState(plan(), MON, [ci("lunch", "meal", "done"), { ...ci("lunch", "meal", "skipped"), at: "9999" }, ci("full-body-a", "workout")]);
    expect(s.meals[1].status).toBe("skipped");
    expect(s.workouts[0].status).toBe("done");
  });
  it("adherence over a week with a streak", () => {
    const checkins: Checkin[] = [
      { ...ci("full-body-a", "workout"), date: "2026-10-19" },
      { ...ci("zone-2", "workout"), date: "2026-10-20" },
      { ...ci("full-body-b", "workout"), date: "2026-10-22" },
    ];
    const a = adherence([{ plan: plan(), from: "2026-10-19" }], checkins, "2026-10-19", "2026-10-22");
    expect(a.workouts).toEqual({ done: 3, planned: 3 });
    expect(a.streak).toBe(4); // Wednesday is a rest day
    expect(a.meals.planned).toBe(4 + 3 + 3 + 3);
  });
});

describe("checks", () => {
  it("check-ins must point into the day's plan", () => {
    const p = plan();
    expect(checkCheckin(ci("full-body-a/goblet-squat/3", "set"), p)).toBeNull();
    expect(checkCheckin(ci("full-body-a/goblet-squat/4", "set"), p)).toMatch(/set must be/);
    expect(checkCheckin(ci("dinner", "meal"), p)).toBeNull();
    expect(checkCheckin({ ...ci("zone-2", "workout") }, p)).toMatch(/no workout/);
    expect(checkCheckin(ci("lunch", "meal"), null)).toMatch(/no plan/);
  });
  it("feedback, vitals and settings", () => {
    expect(checkFeedback({ text: "", tags: ["pain"] })).toBeNull();
    expect(checkFeedback({ text: "", tags: [] })).toMatch(/say something/);
    expect(checkFeedback({ tags: ["nope"] })).toMatch(/tags/);
    expect(checkVital({ date: MON, metric: "weight", value: 80.2 })).toBeNull();
    expect(checkVital({ date: MON, metric: "bmi", value: 1 })).toMatch(/metric/);
    expect(checkSettings(defaultSettings())).toEqual([]);
    expect(checkSettings({ vitals: { photos: "yes" } })[0].path).toBe("vitals.photos");
    expect(checkSettings({ reminders: { evening: { time: "25:00" } } })[0].path).toBe("reminders.evening.time");
    expect(normalizeSettings({ vitals: { photos: true } }).vitals).toEqual({ live_hr: true, health_daily: true, manual: true, photos: true });
  });
});

describe("glasses", () => {
  const world = (now: number, checkins: Checkin[] = [], hr: number | null = 128): World =>
    ({ date: MON, now, day: dayState(plan(), MON, checkins), planVersion: 1, hr, showHr: true, autoRest: true });
  const fits = (lines: string[]) => {
    expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
    for (const l of lines) {
      expect(l.length).toBeLessThanOrEqual(LINE_WIDTH);
      expect(l).toMatch(/^[\x20-\x7e]*$/);
    }
  };
  /** Applies check-in commands to a list, as the plugin does before re-rendering. */
  const apply = (cmds: Command[], into: Checkin[], t: number) => {
    for (const c of cmds) if (c.kind === "checkin") into.push({ ...c.checkin, plan_version: 1, at: new Date(t).toISOString() });
  };

  it("today lists workouts and meals by time", () => {
    const lines = new Navigator().lines(world(at(11)));
    fits(lines);
    expect(lines[0]).toMatch(/^FULL BODY A +0%$/);
    expect(lines[1]).toMatch(/^>07:30 Breakfast *$/);
    expect(lines[2].startsWith(" 12:00 Full body A")).toBe(true);
  });
  it("runs a workout: sets, rest timer, timed sets, next exercise, finish", () => {
    const nav = new Navigator();
    const done: Checkin[] = [];
    let t = at(12);
    nav.cursor = 1;
    const open = nav.input("tap", world(t));
    expect(open).toEqual([{ kind: "workout", active: true, ref: "full-body-a" }]);
    let lines = nav.lines(world(t));
    fits(lines);
    expect(lines[0]).toMatch(/^BIKE WARM-UP +1\/5$/);
    expect(lines[2]).toMatch(/^tap: start 5 min +HR 128$/);
    // Timed set: tap starts the work timer, tap again finishes it.
    expect(nav.input("tap", world(t))).toEqual([]);
    t += 10_000;
    expect(nav.lines(world(t))[2]).toMatch(/^WORK 4:50/);
    expect(nav.lines(world(t + 4000))[2]).toMatch(/^WORK 4:50/); // 5-second steps: fewer Bluetooth updates
    expect(nav.lines(world(t + 6000))[2]).toMatch(/^WORK 4:45/);
    apply(nav.input("tap", world(t, done)), done, t);
    expect(done.map((c) => c.ref)).toEqual(["full-body-a/bike/1", "full-body-a/bike"]);
    expect(done[0].data).toMatchObject({ duration_sec: 10, avg_hr: 128 });
    // On to the squats, with the bike's rest running.
    lines = nav.lines(world(t, done));
    expect(lines[0]).toMatch(/^GOBLET SQUAT +2\/5$/);
    expect(lines[1]).toMatch(/^Set 1 of 3 +8-10 reps @ 24 kg$/);
    expect(lines[2]).toMatch(/^REST 1:00/);
    apply(nav.input("tap", world(t, done)), done, t);
    expect(nav.lines(world(t + 30_000, done))[2]).toMatch(/^REST 1:00/); // squat rest is 90 s
    expect(nav.lines(world(t, done))[1]).toMatch(/^Set 2 of 3/);
    // Hold shows the cues.
    nav.input("long_press", world(t, done));
    const cues = nav.lines(world(t, done));
    fits(cues);
    expect(cues[1]).toBe("- Bell at chest, elbows in");
    nav.input("tap", world(t, done));
    expect(nav.screen).toBe("workout");
    // Skip the rest through the menu and end the workout.
    nav.input("double_tap", world(t, done));
    expect(nav.screen).toBe("menu");
    fits(nav.lines(world(t, done)));
    nav.menuIndex = nav.lines(world(t, done)).findIndex((l) => l.includes("End workout")) - 1;
    const end = nav.input("tap", world(t, done));
    expect(end).toEqual([
      { kind: "checkin", checkin: { date: MON, ref: "full-body-a", kind: "workout", status: "partial" } },
      { kind: "workout", active: false, ref: "full-body-a" },
    ]);
    expect(nav.screen).toBe("today");
  });
  it("feedback from the workout menu is tied to the exercise", () => {
    const nav = new Navigator();
    nav.openWorkout(world(at(12)), "full-body-a");
    nav.input("down", world(at(12)));
    nav.input("double_tap", world(at(12)));
    const labels = nav.lines(world(at(12)));
    nav.menuIndex = labels.findIndex((l) => l.includes("It hurts")) - 1;
    expect(nav.input("tap", world(at(12)))).toEqual([{ kind: "feedback", date: MON, ref: "full-body-a/goblet-squat", tags: ["pain"] }]);
    expect(nav.lines(world(at(12))).at(-1)).toBe(">> SENT TO YOUR AGENT");
  });
  it("meals: tap checks off, hold offers portions", () => {
    const nav = new Navigator();
    nav.cursor = 2; // lunch
    nav.input("tap", world(at(13)));
    const lines = nav.lines(world(at(13)));
    fits(lines);
    expect(lines[0]).toMatch(/^LUNCH 13:00 *$/);
    expect(lines).toContain("680 kcal 48P 75C 20F");
    nav.input("long_press", world(at(13)));
    nav.menuIndex = 0;
    expect(nav.input("tap", world(at(13)))).toEqual([{ kind: "checkin", checkin: { date: MON, ref: "lunch", kind: "meal", status: "done", data: { portion: "less" } } }]);
  });
  it("progress and the empty state fit", () => {
    const nav = new Navigator();
    nav.input("long_press", world(at(20), [ci("breakfast", "meal")]));
    const p = nav.lines(world(at(20), [ci("breakfast", "meal")]));
    fits(p);
    expect(p.some((l) => /^Calories +520\/2200$/.test(l))).toBe(true);
    const empty = new Navigator().lines({ ...world(at(9)), day: null });
    fits(empty);
    expect(empty.join(" ")).toContain("No plan for today");
  });
});
