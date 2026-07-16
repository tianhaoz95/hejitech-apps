import { ai } from "../genkit";
import { FlagRiskInputSchema, FlagRiskOutputSchema } from "../schemas";

const BACKFILL_THRESHOLD_DAYS = 14;
const VAGUE_TASK_MIN_LENGTH = 12; // characters — deliberately crude at MVP
const VAGUE_TASK_PATTERNS = [
  /^worked on (the )?(house|property|rental)$/i,
  /^general (maintenance|cleaning|upkeep)$/i,
  /^(misc|stuff|things)$/i,
];

/**
 * Contemporaneity + vague-entry flags. No LLM call — these are the "simple
 * heuristics" the MVP scope report calls for (days-since-activity threshold,
 * description length/specificity check), not the fuller scoring model in
 * the PRD's readiness dashboard. Still a Genkit flow rather than a plain
 * function so it shows up in the Genkit dev UI trace alongside
 * parseEntryFlow — free observability, no LLM cost.
 */
export const flagRiskFlow = ai.defineFlow(
  {
    name: "flagRiskFlow",
    inputSchema: FlagRiskInputSchema,
    outputSchema: FlagRiskOutputSchema,
  },
  async ({ task, durationMinutes, activityDateIso, loggedAtIso }) => {
    const reasons: string[] = [];

    const activityDate = new Date(activityDateIso);
    const loggedAt = new Date(loggedAtIso);
    const daysLate = Math.max(
      0,
      Math.floor((loggedAt.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const isBackfilled = daysLate > BACKFILL_THRESHOLD_DAYS;
    if (isBackfilled) {
      reasons.push(`Logged ${daysLate} days after the activity date (contemporaneity risk).`);
    }

    const trimmedTask = task.trim();
    const isVague =
      trimmedTask.length < VAGUE_TASK_MIN_LENGTH ||
      VAGUE_TASK_PATTERNS.some((pattern) => pattern.test(trimmedTask));
    if (isVague) {
      reasons.push("Description is short or generic — add one concrete detail.");
    }

    if (durationMinutes > 8 * 60) {
      reasons.push("Unusually long single entry — double-check the duration.");
    }

    return { isVague, isBackfilled, daysLate, reasons };
  }
);
