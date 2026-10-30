// Settings (every option is the user's switch, with defaults that save effort), and the checks for
// what clients send: settings, check-ins, feedback and vitals.
import { dayPlan, isDate } from "./plan.ts";
import { FEEDBACK_TAGS, METRICS, WEEKDAYS, type Checkin, type Plan, type Settings } from "./types.ts";

export function defaultSettings(): Settings {
  return {
    units: "metric",
    timezone: "America/Los_Angeles",
    vitals: { live_hr: true, health_daily: true, manual: true, photos: false },
    agent_access: { vitals: false, photos: false, feedback: true, checkins: true },
    reminders: {
      workout: { on: true, minutes_before: 10 },
      meals: { on: true },
      evening: { on: true, time: "21:00" },
      weekly: { on: true, weekday: "sun", time: "18:00" },
    },
    glasses: { show_hr: true, auto_rest_timer: true },
    about: { goals: "", restrictions: "", equipment: "", schedule: "", diet: "", notes: "" },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep-merges a stored or partial document over the defaults (older clients, first use). */
export function normalizeSettings(s: unknown): Settings {
  const merge = (base: Record<string, unknown>, over: unknown): Record<string, unknown> => {
    if (!isObj(over)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(base)) if (k in over) out[k] = isObj(v) ? merge(v, over[k]) : typeof over[k] === typeof v ? over[k] : v;
    return out;
  };
  return merge(defaultSettings() as unknown as Record<string, unknown>, s) as unknown as Settings;
}

export interface SettingsIssue {
  path: string;
  message: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function checkSettings(input: unknown): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  if (!isObj(input)) return [{ path: "", message: "settings must be an object" }];
  const s = normalizeSettings(input);
  // Anything of the wrong type was replaced by the default; report it instead of silently fixing.
  const walk = (given: unknown, base: unknown, path: string) => {
    if (!isObj(given) || !isObj(base)) return;
    for (const [k, v] of Object.entries(given)) {
      if (!(k in base)) { issues.push({ path: `${path}${k}`, message: "unknown setting" }); continue; }
      const b = (base as Record<string, unknown>)[k];
      if (isObj(b)) walk(v, b, `${path}${k}.`);
      else if (typeof v !== typeof b) issues.push({ path: `${path}${k}`, message: `must be a ${typeof b}` });
    }
  };
  walk(input, defaultSettings(), "");
  if (!["metric", "imperial"].includes(s.units)) issues.push({ path: "units", message: "metric or imperial" });
  try { new Intl.DateTimeFormat("en-US", { timeZone: s.timezone }); } catch { issues.push({ path: "timezone", message: "an IANA time zone like America/Los_Angeles" }); }
  if (!Number.isInteger(s.reminders.workout.minutes_before) || s.reminders.workout.minutes_before < 0 || s.reminders.workout.minutes_before > 180) issues.push({ path: "reminders.workout.minutes_before", message: "0–180" });
  if (!TIME.test(s.reminders.evening.time)) issues.push({ path: "reminders.evening.time", message: "HH:MM" });
  if (!TIME.test(s.reminders.weekly.time)) issues.push({ path: "reminders.weekly.time", message: "HH:MM" });
  if (!WEEKDAYS.includes(s.reminders.weekly.weekday)) issues.push({ path: "reminders.weekly.weekday", message: WEEKDAYS.join(", ") });
  for (const [k, v] of Object.entries(s.about)) if (v.length > 2000) issues.push({ path: `about.${k}`, message: "at most 2000 characters" });
  return issues;
}

const STATUSES = ["done", "partial", "skipped", "swapped"];

/** A check-in must point at something in that day's plan. Returns a problem or null. */
export function checkCheckin(c: Partial<Checkin>, plan: Plan | null): string | null {
  if (!isDate(c.date)) return "date must be YYYY-MM-DD";
  if (!STATUSES.includes(String(c.status))) return `status must be one of ${STATUSES.join(", ")}`;
  if (!plan) return "no plan has been published yet";
  const day = dayPlan(plan, c.date!);
  if (!day) return `the plan has nothing on ${c.date}`;
  const parts = String(c.ref ?? "").split("/");
  const w = day.workouts.find((x) => x.id === parts[0]);
  const m = day.meals.find((x) => x.id === parts[0]);
  if (c.kind === "meal") return m && parts.length === 1 ? null : `no meal ${c.ref} on ${c.date}`;
  if (!w) return `no workout ${parts[0]} on ${c.date}`;
  if (c.kind === "workout") return parts.length === 1 ? null : "a workout ref is just its id";
  const e = w.exercises.find((x) => x.id === parts[1]);
  if (!e) return `no exercise ${parts[1]} in ${w.id}`;
  if (c.kind === "exercise") return parts.length === 2 ? null : "an exercise ref is <workout>/<exercise>";
  if (c.kind === "set") {
    const n = Number(parts[2]);
    return parts.length === 3 && Number.isInteger(n) && n >= 1 && n <= e.sets ? null : `set must be 1–${e.sets}`;
  }
  return "kind must be set, exercise, workout or meal";
}

export function checkFeedback(f: { text?: unknown; tags?: unknown; date?: unknown; ref?: unknown }): string | null {
  const tags = Array.isArray(f.tags) ? f.tags : [];
  if (tags.some((t) => !(FEEDBACK_TAGS as readonly string[]).includes(String(t)))) return `tags must be from ${FEEDBACK_TAGS.join(", ")}`;
  if ((typeof f.text !== "string" || !f.text.trim()) && !tags.length) return "say something, or pick a tag";
  if (typeof f.text === "string" && f.text.length > 2000) return "at most 2000 characters";
  if (f.date !== undefined && f.date !== null && !isDate(f.date)) return "date must be YYYY-MM-DD";
  if (f.ref !== undefined && f.ref !== null && (typeof f.ref !== "string" || f.ref.length > 120)) return "ref must be a plan reference";
  return null;
}

export function checkVital(v: { date?: unknown; metric?: unknown; value?: unknown }): string | null {
  if (!isDate(v.date)) return "date must be YYYY-MM-DD";
  if (!(String(v.metric) in METRICS)) return `metric must be one of ${Object.keys(METRICS).join(", ")}`;
  if (typeof v.value !== "number" || !Number.isFinite(v.value) || v.value < 0 || v.value > 100_000) return "value must be a number";
  return null;
}
