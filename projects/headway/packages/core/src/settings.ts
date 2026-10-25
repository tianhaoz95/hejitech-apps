// A user's settings: defaults and the one validator the Worker, the web page and the iPhone app's
// requests all go through.
import { station } from "./schedule.ts";
import { hhmm } from "./time.ts";
import type { AlertSettings, Leg, Settings } from "./types.ts";

export const DEFAULT_ALERTS: AlertSettings = {
  delay: true, delay_threshold: 5, cancellation: true, service: true, leave_now: true, arrival: true, arrival_minutes: 5,
};

export const DEFAULT_WINDOWS = {
  morning: { start: "06:00", end: "10:30" },
  evening: { start: "15:30", end: "20:00" },
} as const;

export function defaultSettings(): Settings {
  return { morning: null, evening: null, switch_at: "12:00", days: [0, 1, 2, 3, 4], alerts: { ...DEFAULT_ALERTS } };
}

/** A leg with defaults filled in: `newLeg("mountain_view", "san_francisco", "morning")`. */
export function newLeg(from: string, to: string, part: "morning" | "evening"): Leg {
  return { from, to, walk_minutes: 10, usual: null, window: { ...DEFAULT_WINDOWS[part] } };
}

export interface Issue {
  path: string;
  message: string;
}

const bool = (v: unknown) => typeof v === "boolean";
const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

function checkLeg(leg: unknown, path: string, issues: Issue[]) {
  if (leg === null) return;
  if (typeof leg !== "object" || !leg) return void issues.push({ path, message: "must be an object or null" });
  const l = leg as Partial<Leg>;
  if (!station(String(l.from ?? ""))) issues.push({ path: `${path}.from`, message: `unknown station ${JSON.stringify(l.from)}` });
  if (!station(String(l.to ?? ""))) issues.push({ path: `${path}.to`, message: `unknown station ${JSON.stringify(l.to)}` });
  if (l.from && l.from === l.to) issues.push({ path: `${path}.to`, message: "must differ from `from`" });
  if (!int(l.walk_minutes, 0, 90)) issues.push({ path: `${path}.walk_minutes`, message: "must be a whole number of minutes, 0–90" });
  if (l.usual !== null && hhmm(l.usual) === null) issues.push({ path: `${path}.usual`, message: "must be HH:MM or null" });
  const w = l.window;
  if (!w || hhmm(w.start) === null || hhmm(w.end) === null) issues.push({ path: `${path}.window`, message: "must be { start: HH:MM, end: HH:MM }" });
  else if (hhmm(w.start)! >= hhmm(w.end)!) issues.push({ path: `${path}.window`, message: "start must be before end" });
}

export function checkSettings(s: unknown): Issue[] {
  const issues: Issue[] = [];
  if (typeof s !== "object" || !s) return [{ path: "", message: "settings must be an object" }];
  const v = s as Partial<Settings>;
  checkLeg(v.morning ?? null, "morning", issues);
  checkLeg(v.evening ?? null, "evening", issues);
  if (hhmm(v.switch_at) === null) issues.push({ path: "switch_at", message: "must be HH:MM" });
  if (!Array.isArray(v.days) || v.days.some((d) => !int(d, 0, 6)) || new Set(v.days).size !== v.days.length) issues.push({ path: "days", message: "must be distinct weekdays 0 (Monday) – 6 (Sunday)" });
  const a = v.alerts as Partial<AlertSettings> | undefined;
  if (!a || typeof a !== "object") issues.push({ path: "alerts", message: "must be an object" });
  else {
    for (const k of ["delay", "cancellation", "service", "leave_now", "arrival"] as const) if (!bool(a[k])) issues.push({ path: `alerts.${k}`, message: "must be true or false" });
    if (!int(a.delay_threshold, 1, 60)) issues.push({ path: "alerts.delay_threshold", message: "must be 1–60 minutes" });
    if (!int(a.arrival_minutes, 1, 60)) issues.push({ path: "alerts.arrival_minutes", message: "must be 1–60 minutes" });
  }
  return issues;
}

/** Fills in anything missing from a stored or partial document (older clients, first use). */
export function normalizeSettings(s: unknown): Settings {
  const d = defaultSettings();
  if (typeof s !== "object" || !s) return d;
  const v = s as Partial<Settings>;
  const leg = (l: unknown, part: "morning" | "evening"): Leg | null => {
    if (!l || typeof l !== "object") return null;
    const x = l as Partial<Leg>;
    if (!x.from || !x.to) return null;
    const base = newLeg(x.from, x.to, part);
    return { ...base, ...x, window: { ...base.window, ...(x.window ?? {}) } } as Leg;
  };
  return {
    morning: leg(v.morning, "morning"),
    evening: leg(v.evening, "evening"),
    switch_at: typeof v.switch_at === "string" ? v.switch_at : d.switch_at,
    days: Array.isArray(v.days) ? v.days : d.days,
    alerts: { ...d.alerts, ...(typeof v.alerts === "object" && v.alerts ? v.alerts : {}) },
  };
}
