// Small plan changes and trends over weeks: what the MCP tools patch_plan and get_trends serve.
// Pure; dates are the user's local YYYY-MM-DD.
import { addDays, adherence, dayPlan, isDate } from "./plan.ts";
import type { Checkin, DayPlan, Exercise, Plan, Weekday } from "./types.ts";
import { WEEKDAYS } from "./types.ts";

// ---------------------------------------------------------------- patch_plan

/** A change to the plan without rewriting it: whole days of the week, dated overrides, top-level fields. */
export interface PlanPatch {
  /** Replace these days of the repeating week. */
  week?: Partial<Record<Weekday, DayPlan>>;
  /** Set a dated override (a DayPlan) or remove one (null). */
  overrides?: Record<string, DayPlan | null>;
  title?: string;
  summary?: string;
  /** YYYY-MM-DD, or null to make the plan open-ended. */
  ends_on?: string | null;
  goals?: Plan["goals"];
  constraints?: string[];
  targets?: Plan["targets"];
}

const TOP = ["title", "summary", "goals", "constraints", "targets"] as const;

/**
 * The next plan from `base` with `patch` applied, governing from `startsOn` (the later of the base's
 * starts_on and today, so past days stay with the version they were done against).
 * Throws on a malformed patch; the caller validates the result with checkPlan.
 */
export function applyPatch(base: Plan, patch: PlanPatch, startsOn: string): { plan: Plan; changed: string[] } {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("changes must be an object");
  const unknown = Object.keys(patch).filter((k) => !["week", "overrides", "ends_on", ...TOP].includes(k));
  if (unknown.length) throw new Error(`unknown change ${unknown.join(", ")} (week, overrides, title, summary, ends_on, goals, constraints, targets)`);
  if (!isDate(startsOn)) throw new Error("starts_on must be YYYY-MM-DD");
  const plan: Plan = structuredClone(base);
  const changed: string[] = [];
  plan.starts_on = startsOn;
  if (base.starts_on !== startsOn) changed.push("starts_on");
  if (patch.week !== undefined) {
    if (typeof patch.week !== "object" || patch.week === null) throw new Error("week must map mon…sun to days");
    for (const [d, day] of Object.entries(patch.week)) {
      if (!WEEKDAYS.includes(d as Weekday)) throw new Error(`week.${d}: not a weekday (mon…sun)`);
      if (!day || typeof day !== "object") throw new Error(`week.${d}: give the whole day (title, workouts, meals)`);
      plan.week[d as Weekday] = day;
      changed.push(`week.${d}`);
    }
  }
  if (patch.overrides !== undefined) {
    if (typeof patch.overrides !== "object" || patch.overrides === null) throw new Error("overrides must map dates to days (or null)");
    const overrides = { ...(plan.overrides ?? {}) };
    for (const [date, day] of Object.entries(patch.overrides)) {
      if (!isDate(date)) throw new Error(`overrides.${date}: not a YYYY-MM-DD date`);
      if (day === null) {
        if (!(date in overrides)) throw new Error(`overrides.${date}: there is no override on that date to remove`);
        delete overrides[date];
      } else {
        if (typeof day !== "object") throw new Error(`overrides.${date}: give the whole day (title, workouts, meals)`);
        overrides[date] = day;
      }
      changed.push(`overrides.${date}`);
    }
    // Overrides before the new start can never show; drop them so the plan stays small.
    for (const date of Object.keys(overrides)) if (date < startsOn) delete overrides[date];
    plan.overrides = overrides;
  }
  if (patch.ends_on !== undefined) {
    if (patch.ends_on === null) delete plan.ends_on;
    else plan.ends_on = patch.ends_on;
    changed.push("ends_on");
  }
  for (const k of TOP) {
    if (patch[k] === undefined) continue;
    (plan as unknown as Record<string, unknown>)[k] = patch[k];
    changed.push(k);
  }
  return { plan, changed };
}

// ---------------------------------------------------------------- get_trends

const LB_PER_KG = 2.20462;

/** Kilograms in a load ("60 kg", "135 lb", "2x20kg"); null for bodyweight, RPE, zones. */
export function loadKg(load: string | undefined): number | null {
  if (!load) return null;
  const m = /(\d+(?:\.\d+)?)\s*(?:x\s*(\d+(?:\.\d+)?)\s*)?(kg|kgs|kilos?|lb|lbs|pounds?)\b/i.exec(load);
  if (!m) return null;
  const [a, b] = [Number(m[1]), m[2] ? Number(m[2]) : null];
  const value = b !== null ? a * b : a; // "2x20kg": two dumbbells
  return /^(lb|lbs|pound)/i.test(m[3]) ? value / LB_PER_KG : value;
}

/** Reps as a number ("8-10" counts as 8, the floor of the range). */
export function repsOf(reps: number | string | undefined): number | null {
  if (typeof reps === "number") return reps;
  const m = typeof reps === "string" ? /\d+/.exec(reps) : null;
  return m ? Number(m[0]) : null;
}

export interface TrendWeek {
  from: string;
  to: string;
  /** Mean completion over days with something planned, 0–1. */
  completion: number;
  workouts: { done: number; planned: number };
  meals: { done: number; planned: number };
  sets_done: number;
  /** Sum of reps × load over sets with a load in kg or lb, in the user's unit. */
  volume: number;
  avg_rpe: number | null;
  avg_hr: number | null;
  /** Weekly mean of each shared vital. */
  vitals: Record<string, number>;
}

export interface ExerciseTrend {
  name: string;
  sets_done: number;
  /** Heaviest load per week (null: no loaded set that week), in the user's unit. */
  top_load: (number | null)[];
  /** Most reps in one set per week. */
  top_reps: (number | null)[];
}

export interface Trends {
  from: string;
  to: string;
  unit: "kg" | "lb";
  weeks: TrendWeek[];
  /** The most-trained exercises (by sets done), at most 10. */
  exercises: ExerciseTrend[];
  /** Plain observations from the numbers above, for the agent to check (not advice). */
  notes: string[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: number | null, d = 1) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

function exerciseAt(plan: Plan | null, date: string, ref: string): Exercise | null {
  const [w, e] = ref.split("/");
  const day = plan ? dayPlan(plan, date) : null;
  return day?.workouts.find((x) => x.id === w)?.exercises.find((x) => x.id === e) ?? null;
}

/**
 * Week-by-week trends over the `weeks` weeks ending on `to`: adherence, training volume, effort,
 * heart rate and vitals, plus the top exercises' loads. `vitals` are only what the user shares.
 */
export function trends(
  plans: { plan: Plan; from: string; to?: string }[],
  checkins: Checkin[],
  vitals: { date: string; metric: string; value: number | string }[],
  to: string,
  weeks: number,
  units: "metric" | "imperial" = "metric",
): Trends {
  const n = Math.max(1, Math.min(26, Math.floor(weeks)));
  const from = addDays(to, -7 * n + 1);
  const unit = units === "imperial" ? "lb" : "kg";
  const toUnit = (kg: number) => (unit === "lb" ? kg * LB_PER_KG : kg);
  const planFor = (date: string) => {
    for (const p of [...plans].sort((a, b) => b.from.localeCompare(a.from))) if (date >= p.from && (!p.to || date <= p.to)) return p.plan;
    return null;
  };
  // The latest check-in per date+ref (append-only; later ones win), sets only, done or partial.
  const latest = new Map<string, Checkin>();
  for (const c of [...checkins].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))) latest.set(`${c.date}|${c.ref}`, c);
  const sets = [...latest.values()].filter((c) => c.kind === "set" && (c.status === "done" || c.status === "partial"));

  const perExercise = new Map<string, ExerciseTrend>();
  const out: TrendWeek[] = [];
  for (let i = 0; i < n; i++) {
    const wFrom = addDays(from, 7 * i), wTo = addDays(wFrom, 6);
    const a = adherence(plans, checkins, wFrom, wTo);
    const wSets = sets.filter((c) => c.date >= wFrom && c.date <= wTo);
    let volume = 0;
    for (const c of wSets) {
      const ex = exerciseAt(planFor(c.date), c.date, c.ref);
      const kg = loadKg(c.data?.load ?? ex?.load);
      const reps = c.data?.reps ?? repsOf(ex?.reps);
      if (kg !== null && reps) volume += kg * reps;
      if (!ex) continue;
      const t = perExercise.get(ex.name) ?? { name: ex.name, sets_done: 0, top_load: Array(n).fill(null), top_reps: Array(n).fill(null) };
      t.sets_done++;
      if (kg !== null) t.top_load[i] = Math.max(t.top_load[i] ?? 0, round(toUnit(kg))!);
      if (reps) t.top_reps[i] = Math.max(t.top_reps[i] ?? 0, reps);
      perExercise.set(ex.name, t);
    }
    const byMetric = new Map<string, number[]>();
    for (const v of vitals) {
      if (v.date < wFrom || v.date > wTo || !Number.isFinite(Number(v.value))) continue;
      byMetric.set(v.metric, [...(byMetric.get(v.metric) ?? []), Number(v.value)]);
    }
    out.push({
      from: wFrom, to: wTo, completion: round(a.average, 2)!,
      workouts: a.workouts, meals: a.meals, sets_done: wSets.length,
      volume: Math.round(toUnit(volume)),
      avg_rpe: round(mean(wSets.map((c) => c.data?.rpe).filter((x): x is number => typeof x === "number"))),
      avg_hr: round(mean(wSets.map((c) => c.data?.avg_hr).filter((x): x is number => typeof x === "number")), 0),
      vitals: Object.fromEntries([...byMetric].map(([k, xs]) => [k, round(mean(xs))!])),
    });
  }
  const exercises = [...perExercise.values()].sort((a, b) => b.sets_done - a.sets_done).slice(0, 10);
  return { from, to, unit, weeks: out, exercises, notes: observations(out, exercises, unit) };
}

function observations(weeks: TrendWeek[], exercises: ExerciseTrend[], unit: string): string[] {
  const notes: string[] = [];
  const active = weeks.filter((w) => w.workouts.planned + w.meals.planned > 0);
  if (active.length >= 2) {
    const [first, last] = [active[0], active.at(-1)!];
    const d = Math.round((last.completion - first.completion) * 100);
    if (Math.abs(d) >= 10) notes.push(`Completion went ${d > 0 ? "up" : "down"} ${Math.abs(d)} points (${Math.round(first.completion * 100)}% → ${Math.round(last.completion * 100)}%).`);
    if (first.volume > 0 && last.volume > 0) {
      const p = Math.round((last.volume / first.volume - 1) * 100);
      if (Math.abs(p) >= 10) notes.push(`Weekly volume went ${p > 0 ? "up" : "down"} ${Math.abs(p)}% (${first.volume} → ${last.volume} ${unit}).`);
    }
  }
  const missed = weeks.filter((w) => w.workouts.planned > 0 && w.workouts.done === 0).length;
  if (missed) notes.push(`${missed} week${missed > 1 ? "s" : ""} with no planned workout done.`);
  for (const e of exercises) {
    const loads = e.top_load.filter((x): x is number => x !== null);
    if (loads.length >= 3 && loads.slice(-3).every((x) => x === loads.at(-1))) notes.push(`${e.name}: same top load (${loads.at(-1)} ${unit}) for the last 3 weeks it was done.`);
  }
  return notes;
}
