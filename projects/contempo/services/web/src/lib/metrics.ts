import { isOwnerHours, type Entry } from "./entryModel.ts";

export interface RoleHours {
  /** "" is the owner ("Me"); otherwise the role id (or name, for rows without an id). */
  id: string;
  name: string;
  hours: number;
}

export interface DashboardMetrics {
  /**
   * The owner's confirmed hours only. Deliberately NOT every confirmed hour: the 100-hour and
   * 500-hour tests require the owner's participation to exceed everyone else's, so other roles'
   * hours must never count toward the owner's progress.
   */
  confirmedHours: number;
  /** "Me" first, then each other role by hours; empty when only the owner logged hours. */
  roleBreakdown: RoleHours[];
  /** Excludes open timers and trips: they're still running, not waiting for review. */
  pendingCount: number;
}

// Mirrors DashboardMetrics.compute (ios/ContempoCore/.../DashboardMetrics.swift) and the Android
// DashboardViewModel, so the web dashboard shows the same number as the phone.
export function dashboardMetrics(entries: Entry[]): DashboardMetrics {
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const confirmedHours =
    confirmed.filter(isOwnerHours).reduce((sum, e) => sum + e.durationMinutes, 0) / 60;

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
    roleBreakdown: others.length === 0 ? [] : [{ id: "", name: "Me", hours: confirmedHours }, ...others],
    pendingCount: entries.filter((e) => e.status === "pending_review" && !e.inProgress).length,
  };
}
