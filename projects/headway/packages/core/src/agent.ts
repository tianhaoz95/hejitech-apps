// What an assistant (MCP) may change in a rider's settings, when the rider allows it in the app:
// the commute only (legs, days, the morning/evening switch, express preference, which alerts and
// their minutes). Never the on-train/location mode, the share name, family, glasses or the account.
// The Worker stores the before/after of every change so the rider can see it and undo it.
import { normalizeSettings, checkSettings, newLeg, type Issue } from "./settings.ts";
import { findStation, station } from "./schedule.ts";
import type { AlertSettings, ExpressPreference, Leg, Settings, TravelMode } from "./types.ts";

export interface LegPatch {
  from?: string;
  to?: string;
  walk_minutes?: number;
  usual?: string | null;
  window?: { start?: string; end?: string };
  express_preference?: ExpressPreference;
  travel_mode?: TravelMode;
}

export type AlertPatch = Partial<Pick<AlertSettings,
  "delay" | "delay_threshold" | "cancellation" | "service" | "leave_now" | "arrival" | "arrival_minutes" | "better_train" | "scope" | "stop_when_done">>;

/** A partial change to the commute. A leg set to null is removed; fields left out stay as they are. */
export interface CommutePatch {
  morning?: LegPatch | null;
  evening?: LegPatch | null;
  switch_at?: string;
  days?: number[];
  express_preference?: ExpressPreference;
  alerts?: AlertPatch;
}

const PATCH_KEYS = ["morning", "evening", "switch_at", "days", "express_preference", "alerts"] as const;
const LEG_KEYS = ["from", "to", "walk_minutes", "usual", "window", "express_preference", "travel_mode"] as const;
const ALERT_KEYS = ["delay", "delay_threshold", "cancellation", "service", "leave_now", "arrival", "arrival_minutes", "better_train", "scope", "stop_when_done"] as const;

/** Settings an assistant can't change, with why (for the tool's error). */
const OFF_LIMITS: Record<string, string> = {
  on_train: "on-train mode uses the phone's location: change it in the Headway app",
  share_name: "the name on shared ETA links is changed in the Headway app",
};

function unknownKeys(obj: unknown, allowed: readonly string[], path: string, issues: Issue[]) {
  if (!obj || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) {
    if (allowed.includes(k)) continue;
    issues.push({ path: path ? `${path}.${k}` : k, message: OFF_LIMITS[k] ?? "can't be changed by an assistant" });
  }
}

/**
 * Applies a patch to the stored settings. A station may be given as its id, name or short name.
 * Returns the new settings, or the issues (nothing changes then).
 */
export function applyCommutePatch(current: Settings, patch: unknown): { settings: Settings } | { issues: Issue[] } {
  const issues: Issue[] = [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { issues: [{ path: "", message: "send an object with the fields to change" }] };
  unknownKeys(patch, PATCH_KEYS, "", issues);
  const p = patch as CommutePatch;
  if (!issues.length && !PATCH_KEYS.some((k) => k in p)) issues.push({ path: "", message: `nothing to change: send any of ${PATCH_KEYS.join(", ")}` });
  const next: Settings = structuredClone(current);

  for (const part of ["morning", "evening"] as const) {
    if (!(part in p)) continue;
    const lp = p[part];
    if (lp === null) { next[part] = null; continue; }
    if (!lp || typeof lp !== "object") { issues.push({ path: part, message: "must be an object with the leg's fields, or null to remove it" }); continue; }
    unknownKeys(lp, LEG_KEYS, part, issues);
    if (lp.window !== undefined) unknownKeys(lp.window, ["start", "end"], `${part}.window`, issues);
    const from = lp.from !== undefined ? stationId(lp.from) : undefined;
    const to = lp.to !== undefined ? stationId(lp.to) : undefined;
    if (lp.from !== undefined && !from) issues.push({ path: `${part}.from`, message: `unknown station ${JSON.stringify(lp.from)}` });
    if (lp.to !== undefined && !to) issues.push({ path: `${part}.to`, message: `unknown station ${JSON.stringify(lp.to)}` });
    const base: Leg | null = next[part] ?? (from && to ? newLeg(from, to, part) : null);
    if (!base) { issues.push({ path: part, message: `there's no ${part} leg yet: give both from and to to add one` }); continue; }
    const leg: Leg = { ...base, window: { ...base.window } };
    if (from) leg.from = from;
    if (to) leg.to = to;
    if (lp.walk_minutes !== undefined) leg.walk_minutes = lp.walk_minutes;
    if (lp.usual !== undefined) leg.usual = lp.usual;
    if (lp.window?.start !== undefined) leg.window.start = lp.window.start;
    if (lp.window?.end !== undefined) leg.window.end = lp.window.end;
    if (lp.express_preference !== undefined) leg.express_preference = lp.express_preference;
    if (lp.travel_mode !== undefined) leg.travel_mode = lp.travel_mode;
    next[part] = leg;
  }
  if (p.switch_at !== undefined) next.switch_at = p.switch_at;
  if (p.days !== undefined) next.days = Array.isArray(p.days) ? [...p.days].sort((a, b) => a - b) : (p.days as never);
  if (p.express_preference !== undefined) next.express_preference = p.express_preference;
  if (p.alerts !== undefined) {
    if (!p.alerts || typeof p.alerts !== "object") issues.push({ path: "alerts", message: "must be an object with the alert fields to change" });
    else {
      unknownKeys(p.alerts, ALERT_KEYS, "alerts", issues);
      next.alerts = { ...next.alerts, ...p.alerts };
    }
  }
  issues.push(...checkSettings(next));
  if (issues.length) return { issues: dedupe(issues) };
  return { settings: normalizeSettings(next) };
}

function stationId(v: string): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  return (station(v) ?? findStation(v))?.id;
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => !seen.has(i.path + i.message) && seen.add(i.path + i.message));
}

// ---------------------------------------------------------------- what changed, in words

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MODE: Record<TravelMode, string> = { walk: "walk", drive: "drive", bike: "bike", ebike: "e-bike", scooter: "scooter" };
const PREF: Record<ExpressPreference, string> = { all: "all trains", prefer_express: "prefer express", express_only: "express only" };
const ALERT_NAMES: Record<keyof AlertSettings, string> = {
  delay: "delay alerts", delay_threshold: "delay alert after", cancellation: "cancellation alerts", service: "service alerts",
  leave_now: "leave-now reminders", arrival: "arrival alerts", arrival_minutes: "arrival alert before", better_train: "faster-train alerts",
  scope: "alert scope", stop_when_done: "quiet once the commute is done",
};

function clock(hhmm: string | null | undefined): string {
  if (!hhmm) return "none";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function daysText(days: number[]): string {
  const d = [...days].sort((a, b) => a - b);
  if (!d.length) return "no days";
  const ranges: string[] = [];
  for (let i = 0; i < d.length; i++) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++;
    ranges.push(j - i >= 2 ? `${DAY[d[i]]}–${DAY[d[j]]}` : d.slice(i, j + 1).map((x) => DAY[x]).join(", "));
    i = j;
  }
  return ranges.join(", ");
}

const stationName = (id: string) => station(id)?.name ?? id;
const legText = (l: Leg) => `${stationName(l.from)} → ${stationName(l.to)}`;

/** The changes between two settings, one short line each ("Evening: usual train 5:30 PM → 4:00 PM"). */
export function settingsDiff(before: Settings, after: Settings): string[] {
  const out: string[] = [];
  for (const part of ["morning", "evening"] as const) {
    const label = part === "morning" ? "Morning" : "Evening";
    const a = before[part], b = after[part];
    if (!a && !b) continue;
    if (!a && b) { out.push(`${label}: added ${legText(b)}`); continue; }
    if (a && !b) { out.push(`${label}: removed ${legText(a)}`); continue; }
    if (!a || !b) continue;
    if (a.from !== b.from || a.to !== b.to) out.push(`${label}: ${legText(a)} → ${legText(b)}`);
    if (a.usual !== b.usual) out.push(`${label}: usual train ${clock(a.usual)} → ${clock(b.usual)}`);
    if (a.walk_minutes !== b.walk_minutes) out.push(`${label}: ${a.walk_minutes} → ${b.walk_minutes} min to the station`);
    if ((a.travel_mode ?? "walk") !== (b.travel_mode ?? "walk")) out.push(`${label}: getting there by ${MODE[a.travel_mode ?? "walk"]} → ${MODE[b.travel_mode ?? "walk"]}`);
    if (a.window.start !== b.window.start || a.window.end !== b.window.end) {
      out.push(`${label}: alert window ${clock(a.window.start)}–${clock(a.window.end)} → ${clock(b.window.start)}–${clock(b.window.end)}`);
    }
    if ((a.express_preference ?? "all") !== (b.express_preference ?? "all")) out.push(`${label}: ${PREF[a.express_preference ?? "all"]} → ${PREF[b.express_preference ?? "all"]}`);
  }
  if (before.switch_at !== after.switch_at) out.push(`Switch to the evening leg at ${clock(before.switch_at)} → ${clock(after.switch_at)}`);
  if (daysText(before.days) !== daysText(after.days)) out.push(`Commute days: ${daysText(before.days)} → ${daysText(after.days)}`);
  if ((before.express_preference ?? "all") !== (after.express_preference ?? "all")) out.push(`Trains: ${PREF[before.express_preference ?? "all"]} → ${PREF[after.express_preference ?? "all"]}`);
  for (const k of Object.keys(ALERT_NAMES) as (keyof AlertSettings)[]) {
    const x = before.alerts[k], y = after.alerts[k];
    if (x === y) continue;
    if (typeof x === "boolean" || typeof y === "boolean") out.push(`${cap(ALERT_NAMES[k])} ${y ? "on" : "off"}`);
    else if (k === "scope") out.push(`Alerts: ${x === "all" ? "priority and quiet" : "priority only"} → ${y === "all" ? "priority and quiet" : "priority only"}`);
    else out.push(`${cap(ALERT_NAMES[k])} ${x} → ${y} min`);
  }
  return out;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** One line for a notification: the first change, and how many more. */
export function diffHeadline(lines: string[]): string {
  if (!lines.length) return "No changes";
  return lines.length === 1 ? lines[0] : `${lines[0]} (+${lines.length - 1} more)`;
}
