import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * ISO-8601 week id ("GGGG-Www", e.g. "2026-W33") for the given instant,
 * computed in UTC so every device + this backend agree on which week "now"
 * falls in regardless of local timezone — mirrored independently in
 * android/.../core/model (java.time WeekFields.ISO) and
 * ios/ContempoCore (Calendar(identifier: .iso8601)), since neither Kotlin
 * nor Swift's implementation is reachable from here. All three must compute
 * the same id for the same instant; verified against ISO week-1 boundary
 * dates (see the token-usage feature's verification notes) rather than
 * assumed.
 */
export function isoWeekId(date: Date = new Date()): string {
  const { year, week } = isoWeekYearAndNumber(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00 UTC of the ISO week containing `date` — stored alongside the counters so Settings can show "week of ...". */
export function isoWeekStart(date: Date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDayNum = d.getUTCDay() || 7; // Monday=1 ... Sunday=7
  d.setUTCDate(d.getUTCDate() - isoDayNum + 1);
  return d;
}

function isoWeekYearAndNumber(date: Date): { year: number; week: number } {
  // Standard ISO-8601 week algorithm: shift to this week's Thursday (the
  // ISO week-based year is the year that Thursday falls in), then count
  // whole weeks from that year's own first Thursday.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - isoDayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

/**
 * users/{uid}/cloudTokenUsage/{weekId} — server-authoritative counterpart to
 * the client-written users/{uid}/deviceTokenUsage/{weekId} (see
 * firestore.rules: this collection is client-read-only, only Admin-SDK
 * writes like this one are allowed). Called from askAgentFlow/parseEntryFlow
 * right after ai.generate() — failures are logged and swallowed so a
 * usage-tracking hiccup never breaks the actual user-facing response.
 */
export async function recordCloudTokenUsage(
  uid: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const now = new Date();
    await getFirestore()
      .collection("users")
      .doc(uid)
      .collection("cloudTokenUsage")
      .doc(isoWeekId(now))
      .set(
        {
          inputTokens: FieldValue.increment(inputTokens),
          outputTokens: FieldValue.increment(outputTokens),
          requestCount: FieldValue.increment(1),
          weekStart: Timestamp.fromDate(isoWeekStart(now)),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (error) {
    logger.warn("recordCloudTokenUsage failed", error);
  }
}
