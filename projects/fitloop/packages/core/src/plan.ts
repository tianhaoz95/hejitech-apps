// Reading a plan: the day plan for a date, the state of each item from check-ins, the day's
// progress (what's done, nutrition eaten against targets) and adherence over a range. Pure; dates
// are the user's local YYYY-MM-DD (clients send their own "today").
import type { Checkin, DayPlan, Exercise, Macros, Meal, Plan, Weekday, Workout } from "./types.ts";
import { WEEKDAYS } from "./types.ts";

export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function weekdayOf(date: string): Weekday {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(d + 6) % 7];
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Days from a to b inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The local date of an instant in a time zone ("2026-10-25"). */
export function localDate(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(epochMs));
}

/** The plan for a date: an override, else the week's day; null outside the plan's dates. */
export function dayPlan(plan: Plan, date: string): DayPlan | null {
  if (date < plan.starts_on || (plan.ends_on && date > plan.ends_on)) return null;
  return plan.overrides?.[date] ?? plan.week[weekdayOf(date)] ?? null;
}

export function mealMacros(m: Meal): Macros {
  return m.macros ?? {};
}

const PORTION: Record<string, number> = { less: 0.6, as_planned: 1, more: 1.3 };

// ---------------------------------------------------------------- state from check-ins

/** The latest check-in per ref (check-ins are append-only; later ones win). */
export function latestByRef(checkins: Checkin[], date: string): Map<string, Checkin> {
  const out = new Map<string, Checkin>();
  for (const c of checkins.filter((c) => c.date === date).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))) out.set(c.ref, c);
  return out;
}

export interface ExerciseState {
  exercise: Exercise;
  ref: string;
  setsDone: number;
  status: "todo" | "in_progress" | "done" | "skipped" | "swapped";
}

export interface WorkoutState {
  workout: Workout;
  ref: string;
  exercises: ExerciseState[];
  status: "todo" | "in_progress" | "done" | "skipped";
  setsDone: number;
  setsTotal: number;
}

export interface MealState {
  meal: Meal;
  ref: string;
  status: "todo" | "done" | "skipped" | "swapped";
  portion: string | null;
}

export interface DayState {
  date: string;
  day: DayPlan | null;
  workouts: WorkoutState[];
  meals: MealState[];
  /** Done items / all items (workouts count by sets, meals one each), 0–1. */
  completion: number;
  /** Planned for the day, and eaten so far (portion-weighted; swapped meals count as planned). */
  nutrition: { planned: Macros; eaten: Macros; targets: Macros };
}

export function workoutState(w: Workout, latest: Map<string, Checkin>): WorkoutState {
  const exercises = w.exercises.map((e): ExerciseState => {
    const ref = `${w.id}/${e.id}`;
    let setsDone = 0;
    for (let s = 1; s <= e.sets; s++) {
      const c = latest.get(`${ref}/${s}`);
      if (c && (c.status === "done" || c.status === "partial")) setsDone++;
    }
    const own = latest.get(ref);
    const status = own?.status === "skipped" ? "skipped" : own?.status === "swapped" ? "swapped"
      : own?.status === "done" || setsDone >= e.sets ? "done" : setsDone > 0 ? "in_progress" : "todo";
    return { exercise: e, ref, setsDone: status === "done" ? e.sets : setsDone, status };
  });
  const own = latest.get(w.id);
  const setsTotal = exercises.reduce((n, e) => n + e.exercise.sets, 0);
  const setsDone = exercises.reduce((n, e) => n + (e.status === "skipped" ? 0 : e.status === "swapped" ? e.exercise.sets : e.setsDone), 0);
  const allSettled = exercises.every((e) => e.status === "done" || e.status === "skipped" || e.status === "swapped");
  const status = own?.status === "skipped" ? "skipped" : own?.status === "done" || own?.status === "partial" || allSettled ? "done" : setsDone > 0 ? "in_progress" : "todo";
  return { workout: w, ref: w.id, exercises, status, setsDone, setsTotal };
}

export function dayState(plan: Plan | null, date: string, checkins: Checkin[]): DayState {
  return dayStateOf(plan ? dayPlan(plan, date) : null, date, checkins, plan?.targets ?? {});
}

/** The same from a day's plan alone (the glasses hold one day, not the whole plan). */
export function dayStateOf(day: DayPlan | null, date: string, checkins: Checkin[], targetsIn: Macros = {}): DayState {
  const latest = latestByRef(checkins, date);
  const workouts = (day?.workouts ?? []).map((w) => workoutState(w, latest));
  const meals = (day?.meals ?? []).map((m): MealState => {
    const c = latest.get(m.id);
    const status = c?.status === "partial" ? "done" : (c?.status as MealState["status"] | undefined) ?? "todo";
    return { meal: m, ref: m.id, status, portion: c?.data?.portion ?? null };
  });
  const units = workouts.reduce((n, w) => n + w.setsTotal, 0) + meals.length;
  const done = workouts.reduce((n, w) => n + (w.status === "done" ? w.setsTotal : w.status === "skipped" ? 0 : w.setsDone), 0)
    + meals.filter((m) => m.status === "done" || m.status === "swapped").length;
  const planned: Macros = {}, eaten: Macros = {};
  const add = (into: Macros, m: Macros, f = 1) => {
    for (const k of ["calories", "protein_g", "carbs_g", "fat_g"] as const) if (m[k] !== undefined) into[k] = Math.round((into[k] ?? 0) + m[k]! * f);
  };
  for (const m of meals) {
    add(planned, mealMacros(m.meal));
    if (m.status === "done" || m.status === "swapped") add(eaten, mealMacros(m.meal), PORTION[m.portion ?? "as_planned"] ?? 1);
  }
  const t = targetsIn;
  const targets: Macros = { calories: t.calories, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g };
  return { date, day, workouts, meals, completion: units ? done / units : 0, nutrition: { planned, eaten, targets } };
}

export interface Adherence {
  from: string;
  to: string;
  days: { date: string; completion: number; workouts_done: number; workouts_planned: number; meals_done: number; meals_planned: number }[];
  /** Mean completion over days that had something planned, 0–1. */
  average: number;
  workouts: { done: number; planned: number };
  meals: { done: number; planned: number };
  /** Consecutive days up to `to` with every planned workout done (rest days count). */
  streak: number;
}

export function adherence(plans: { plan: Plan; from: string; to?: string }[], checkins: Checkin[], from: string, to: string): Adherence {
  const planFor = (date: string) => {
    for (const p of [...plans].sort((a, b) => b.from.localeCompare(a.from))) if (date >= p.from && (!p.to || date <= p.to)) return p.plan;
    return null;
  };
  const days = dateRange(from, to).map((date) => {
    const s = dayState(planFor(date), date, checkins);
    return {
      date, completion: s.completion,
      workouts_done: s.workouts.filter((w) => w.status === "done").length, workouts_planned: s.workouts.length,
      meals_done: s.meals.filter((m) => m.status === "done" || m.status === "swapped").length, meals_planned: s.meals.length,
    };
  });
  const active = days.filter((d) => d.workouts_planned + d.meals_planned > 0);
  let streak = 0;
  for (const d of [...days].reverse()) {
    if (d.workouts_done < d.workouts_planned) break;
    streak++;
  }
  return {
    from, to, days,
    average: active.length ? active.reduce((n, d) => n + d.completion, 0) / active.length : 0,
    workouts: { done: days.reduce((n, d) => n + d.workouts_done, 0), planned: days.reduce((n, d) => n + d.workouts_planned, 0) },
    meals: { done: days.reduce((n, d) => n + d.meals_done, 0), planned: days.reduce((n, d) => n + d.meals_planned, 0) },
    streak,
  };
}

/** What a set asks for, in words: "8-10 reps @ 60 kg", "45 s", "3 km". */
export function setTarget(e: Exercise): string {
  const amount = e.reps !== undefined ? `${e.reps} reps` : e.duration_sec !== undefined ? formatSeconds(e.duration_sec) : "";
  return [amount, e.load].filter(Boolean).join(" @ ");
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")}` : `${m} min`;
}

/** The first set not yet done in a workout: where the glasses resume. */
export function nextSet(w: WorkoutState): { exercise: number; set: number } | null {
  for (let i = 0; i < w.exercises.length; i++) {
    const e = w.exercises[i];
    if (e.status === "todo" || e.status === "in_progress") return { exercise: i, set: e.setsDone + 1 };
  }
  return null;
}
