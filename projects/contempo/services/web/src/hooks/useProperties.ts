import type { Property } from "../lib/entryModel";
import { propertyFromRow } from "../lib/rows";
import { useLiveRows } from "./useLiveRows";

// The signed-in user's properties, oldest-created first (same order as the Android app).
export function useProperties() {
  const { rows, loading } = useLiveRows<Property>("properties", "created_at", true, propertyFromRow);
  return { properties: rows, loading };
}
