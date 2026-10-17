import type { Entry } from "../lib/entryModel";
import { entryFromRow } from "../lib/rows";
import { useLiveRows } from "./useLiveRows";

// The signed-in user's entries, newest activity first (same order as the Android app).
export function useEntries() {
  const { rows, loading } = useLiveRows<Entry>("entries", "activity_date", false, entryFromRow);
  return { entries: rows, loading };
}
