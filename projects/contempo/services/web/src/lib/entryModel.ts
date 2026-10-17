import type { Timestamp } from "./supabase";

// Mirrors android/core/src/main/java/com/hejitech/core/model/Entry.kt and
// Property.kt exactly — same Firestore document shape, same field names, so
// this app reads the real data the Android app writes. Do not derive this
// from backend/functions/src/schemas.ts's EntrySchema: that's the narrower
// AI-parsing shape: this is what's actually stored, after the app layers on
// bookkeeping fields (status/source/risk flags/timestamps).

export type EntryCategory =
  | "maintenance"
  | "turnover"
  | "guest_communication"
  | "supply_run"
  | "admin"
  | "other";

// Fixed display order — matches the Kotlin enum's declaration order. Never
// reorder this; chart color slots are assigned positionally against it.
export const ENTRY_CATEGORIES: EntryCategory[] = [
  "maintenance",
  "turnover",
  "guest_communication",
  "supply_run",
  "admin",
  "other",
];

export const ENTRY_CATEGORY_LABELS: Record<EntryCategory, string> = {
  maintenance: "Maintenance",
  turnover: "Turnover",
  guest_communication: "Guest communication",
  supply_run: "Supply run",
  admin: "Admin",
  other: "Other",
};

export type EntryStatus = "pending_review" | "confirmed";

export type EntrySource = "manual" | "voice" | "text" | "photo";

export interface Entry {
  id: string;
  propertyId: string;
  propertyName: string;
  task: string;
  durationMinutes: number;
  category: EntryCategory;
  status: EntryStatus;
  source: EntrySource;
  activityDate: Timestamp;
  loggedAt: Timestamp;
  confirmedAt: Timestamp | null;
  isVague: boolean;
  isBackfilled: boolean;
  daysLate: number;
  riskReasons: string[];
  photoUrls: string[];
}

export interface Property {
  id: string;
  name: string;
  createdAt: Timestamp;
}

// MVP hardcodes the 100-hour STR test only — no 500hr/REPS-750hr variant
// exists in the app yet (android/.../MaterialParticipationTest.kt), despite
// both being mentioned in planning docs. Don't build a test-picker UI here
// until the app itself supports more than one test.
export const MATERIAL_PARTICIPATION_TEST = {
  name: "STR",
  thresholdHours: 100,
} as const;

export function isFlagged(entry: Entry): boolean {
  return entry.isVague || entry.isBackfilled || entry.riskReasons.length > 0;
}
