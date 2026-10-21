import { MATERIAL_PARTICIPATION_TEST, isOwnerHours, type Entry } from "./entryModel.ts";

export interface RoleHours {
  /** "" is the owner ("Me"); otherwise the role id (or name, for rows without an id). */
  id: string;
  name: string;
  hours: number;
}

export type Pace =
  /** The year's hours already reach the threshold. */
  | { kind: "met" }
  /** At the pace so far, the threshold is reached on `finish` (before the year ends). */
  | { kind: "onPace"; finish: Date }
  /** The pace so far (or no hours yet) misses the year end; this many hours a week reach it by Dec 31. */
  | { kind: "behind"; weeklyHoursNeeded: number };

export interface TestYearProgress {
  year: number;
  /** The owner's confirmed hours with activity in `year`. */
  ownerHours: number;
  pace: Pace;
}

/** The pace is measured over at least this many days, so one long entry yesterday doesn't project the test done in weeks. */
export const MINIMUM_PACE_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Whole calendar days from `a` to `b` (both local midnights), robust to DST's 23/25-hour days. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export function isInYear(entry: Entry, year: number): boolean {
  return entry.activityDate.toDate().getFullYear() === year;
}

/**
 * The tests are annual: only hours whose activity falls in the tax year (the calendar year, in the
 * browser's time zone) count. Mirrors TestYearProgress in the apps (ios/ContempoCore/.../
 * TestYearProgress.swift, android/core/.../TestYearProgress.kt).
 */
export function testYearProgress(
  entries: Entry[],
  now: Date = new Date(),
  thresholdHours: number = MATERIAL_PARTICIPATION_TEST.thresholdHours,
): TestYearProgress {
  const year = now.getFullYear();
  const counted = entries.filter((e) => e.status === "confirmed" && isOwnerHours(e) && isInYear(e, year));
  const hours = counted.reduce((sum, e) => sum + e.durationMinutes, 0) / 60;
  if (hours >= thresholdHours) return { year, ownerHours: hours, pace: { kind: "met" } };

  const today = startOfDay(now);
  const remaining = thresholdHours - hours;
  const daysLeft = Math.max(1, daysBetween(today, new Date(year + 1, 0, 1)));
  if (hours > 0) {
    const first = new Date(Math.min(now.getTime(), ...counted.map((e) => e.activityDate.toDate().getTime())));
    const window = Math.max(MINIMUM_PACE_WINDOW_DAYS, daysBetween(first, today) + 1);
    const daysNeeded = Math.ceil(remaining / (hours / window));
    if (daysNeeded < daysLeft) {
      const finish = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysNeeded);
      return { year, ownerHours: hours, pace: { kind: "onPace", finish } };
    }
  }
  return { year, ownerHours: hours, pace: { kind: "behind", weeklyHoursNeeded: (remaining / daysLeft) * 7 } };
}

export interface DashboardMetrics {
  /**
   * The owner's confirmed hours this tax year only. Deliberately NOT every confirmed hour: the
   * 100-hour and 500-hour tests are annual and require the owner's participation to exceed
   * everyone else's, so other roles' hours (and earlier years') must never count toward it.
   */
  confirmedHours: number;
  /** The year `confirmedHours` counts and the pace toward the threshold. */
  testProgress: TestYearProgress;
  /** "Me" first, then each other role by this year's hours; empty when only the owner logged hours. */
  roleBreakdown: RoleHours[];
  /** Excludes open timers and trips: they're still running, not waiting for review. */
  pendingCount: number;
}

// Mirrors DashboardMetrics.compute (ios/ContempoCore/.../DashboardMetrics.swift) and the Android
// DashboardViewModel, so the web dashboard shows the same number as the phone.
export function dashboardMetrics(entries: Entry[], now: Date = new Date()): DashboardMetrics {
  const testProgress = testYearProgress(entries, now);
  const confirmed = entries.filter((e) => e.status === "confirmed" && isInYear(e, testProgress.year));
  const confirmedHours = testProgress.ownerHours;

  const byRole = new Map<string, { name: string; minutes: number }>();
  for (const e of confirmed) {
    if (isOwnerHours(e)) continue;
    const key = e.roleId || e.roleName || "unknown";
    const bucket = byRole.get(key) ?? { name: e.roleName || "Other", minutes: 0 };
    bucket.minutes += e.durationMinutes;
    byRole.set(key, bucket);
  }
  const others = [...byRole.entries()]
    .map(([id, b]) => ({ id, name: b.name, hours: b.minutes / 60 }))
    .sort((a, b) => b.hours - a.hours);

  return {
    confirmedHours,
    testProgress,
    roleBreakdown: others.length === 0 ? [] : [{ id: "", name: "Me", hours: confirmedHours }, ...others],
    pendingCount: entries.filter((e) => e.status === "pending_review" && !e.inProgress).length,
  };
}
