import type { Entry, Property } from "./entryModel";
import { timestamp } from "./supabase";

/** contempo.entries row (snake_case) → the Entry shape the pages use (same as the Android model). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function entryFromRow(r: any): Entry {
  return {
    id: r.id,
    propertyId: r.property_id,
    propertyName: r.property_name,
    task: r.task,
    durationMinutes: r.duration_minutes,
    category: r.category,
    status: r.status,
    source: r.source,
    activityDate: timestamp(r.activity_date),
    loggedAt: timestamp(r.logged_at),
    confirmedAt: r.confirmed_at ? timestamp(r.confirmed_at) : null,
    isVague: r.is_vague,
    isBackfilled: r.is_backfilled,
    daysLate: r.days_late,
    riskReasons: r.risk_reasons ?? [],
    photoUrls: r.photo_urls ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function propertyFromRow(r: any): Property {
  return { id: r.id, name: r.name, createdAt: timestamp(r.created_at) };
}
