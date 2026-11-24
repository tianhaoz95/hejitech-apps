// Contemporaneity & vagueness risk heuristics (shared between POST /api/flag-risk, MCP, and cron).
export const BACKFILL_THRESHOLD_DAYS = 14;
export const VAGUE_TASK_MIN_LENGTH = 12;
const VAGUE_TASK_PATTERNS = [
  /^worked on (the )?(house|property|rental)$/i,
  /^general (maintenance|cleaning|upkeep)$/i,
  /^(misc|stuff|things)$/i,
];

export interface RiskResult {
  isVague: boolean;
  isBackfilled: boolean;
  daysLate: number;
  reasons: string[];
}

export function flagRisk(body: Record<string, unknown>): RiskResult {
  const task = String(body.task ?? "");
  const durationMinutes = Number(body.durationMinutes ?? 0);
  const activityDate = new Date(String(body.activityDateIso ?? ""));
  const loggedAt = new Date(String(body.loggedAtIso ?? ""));
  if (Number.isNaN(activityDate.getTime()) || Number.isNaN(loggedAt.getTime())) {
    throw new Error("activityDateIso and loggedAtIso must be ISO dates.");
  }
  const reasons: string[] = [];
  const daysLate = Math.max(0, Math.floor((loggedAt.getTime() - activityDate.getTime()) / 86400000));
  const isBackfilled = daysLate > BACKFILL_THRESHOLD_DAYS;
  if (isBackfilled) reasons.push(`Logged ${daysLate} days after the activity date (contemporaneity risk).`);
  const trimmed = task.trim();
  const isVague = trimmed.length < VAGUE_TASK_MIN_LENGTH || VAGUE_TASK_PATTERNS.some((p) => p.test(trimmed));
  if (isVague) reasons.push("Description is short or generic — add one concrete detail.");
  if (durationMinutes > 8 * 60) reasons.push("Unusually long single entry — double-check the duration.");
  return { isVague, isBackfilled, daysLate, reasons };
}
