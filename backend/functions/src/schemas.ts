import { z } from "genkit";

/**
 * A confirmed, saved log entry — the shape stored in Firestore under
 * `properties/{propertyId}/entries/{entryId}`. See core/model/Entry.kt on the
 * Android side for the Kotlin mirror of this shape; keep the two in sync by
 * hand for now (no shared-schema codegen at MVP scale).
 */
export const EntrySchema = z.object({
  property: z.string().describe("The property name/nickname this entry belongs to"),
  task: z.string().describe("Short description of the work performed"),
  durationMinutes: z.number().int().positive(),
  category: z.enum([
    "maintenance",
    "turnover",
    "guest_communication",
    "supply_run",
    "admin",
    "other",
  ]),
});
export type Entry = z.infer<typeof EntrySchema>;

/**
 * Output of parseEntryFlow. No "needs clarification" concept: capture is
 * meant to be fast, not a back-and-forth, so the model always returns its
 * best-effort partial extraction (nulling out only what it genuinely can't
 * determine) and the app always proceeds straight to the Confirm screen —
 * the human reviews and fills any gaps there, on their own time.
 */
export const EntryDraftSchema = z.object({
  property: z.string().nullable(),
  /**
   * Cleaned-up description of the work performed — filler words ("uh",
   * "um") and dictation errors already stripped by the parse prompt (see
   * parseEntry.ts). Plain prose for a single task; may be a markdown
   * bullet list ("- " lines) when the host described multiple distinct
   * sub-tasks in one capture, never headers/tables/bold.
   */
  task: z.string().nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  category: EntrySchema.shape.category.nullable(),
  /**
   * Set only when the host is opening or closing a start/stop timer rather
   * than describing a complete, already-finished task (e.g. "I'm starting
   * to work on unit 4" vs "I just finished cleaning unit 4"). This is a
   * fallback signal only — the app's own deterministic keyword classifier
   * (TimerIntentClassifier, Android-side) runs first and is authoritative
   * when it fires; this field only matters for phrasing that classifier
   * doesn't cover.
   */
  eventType: z.enum(["start", "stop"]).nullable(),
  /**
   * Business miles driven, only when the host actually states a distance
   * (e.g. "drove 12 miles to pick up supplies") — a separate tax deduction
   * from the material-participation hours this app otherwise tracks, so it
   * rides along on the same parse rather than needing its own capture flow.
   * Nullable/optional on every entry, not just driving-related ones.
   */
  miles: z.number().nonnegative().nullable(),
  /**
   * Absolute ISO-8601 timestamp for when the described work actually
   * happened, resolved by the model from any time reference in the host's
   * own words (relative — "4 hours ago", "this morning", "yesterday" — or
   * absolute — "at 3pm") using the `nowIso` current-time context supplied
   * in the prompt. Null when the host mentions no time reference at all,
   * meaning "now" — the app's pre-existing default behavior.
   */
  resolvedActivityDateIso: z.string().nullable(),
});
export type EntryDraft = z.infer<typeof EntryDraftSchema>;

export const ParseEntryInputSchema = z.object({
  rawText: z.string().min(1).describe("Transcribed voice memo or typed text from the host"),
  knownProperties: z
    .array(z.string())
    .describe("The host's existing property names, so the model can match rather than invent new ones"),
  nowIso: z
    .string()
    .describe("Current timestamp (ISO 8601) — the model resolves any time reference in rawText (relative or absolute) into resolvedActivityDateIso relative to this"),
});
export type ParseEntryInput = z.infer<typeof ParseEntryInputSchema>;

/**
 * flagRiskFlow output. Deliberately deterministic heuristics (Section 8 of
 * the MVP report calls these out as "simple heuristics ... not the fuller
 * scoring model") — no LLM call happens inside this flow. It's still a
 * Genkit flow (not a plain function) purely to get free tracing in the
 * Genkit dev UI, per "a flow just wraps a function."
 */
export const FlagRiskInputSchema = z.object({
  task: z.string(),
  durationMinutes: z.number(),
  activityDateIso: z.string(),
  loggedAtIso: z.string(),
});
export type FlagRiskInput = z.infer<typeof FlagRiskInputSchema>;

export const FlagRiskOutputSchema = z.object({
  isVague: z.boolean(),
  isBackfilled: z.boolean(),
  daysLate: z.number(),
  reasons: z.array(z.string()),
});
export type FlagRiskOutput = z.infer<typeof FlagRiskOutputSchema>;

/**
 * askAgentFlow — the free-form "will this count?" / "how many hours do I
 * need?" copilot (see reports/prd-v0.html's legal-grounding-copilot wedge).
 * History is client-held only for MVP (no Firestore persistence), so it's
 * just replayed on every call rather than looked up server-side.
 */
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AskAgentInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe("Prior turns in this conversation, oldest first"),
  question: z.string().min(1),
  confirmedHours: z.number().describe("Hours the host has confirmed so far, for grounding answers in their actual progress"),
  thresholdHours: z.number().describe("Hours required for the test they're tracking toward"),
  testName: z.string().describe("Name of the material-participation test, e.g. 'STR'"),
});
export type AskAgentInput = z.infer<typeof AskAgentInputSchema>;

export const AskAgentOutputSchema = z.object({
  answer: z.string(),
});
export type AskAgentOutput = z.infer<typeof AskAgentOutputSchema>;
