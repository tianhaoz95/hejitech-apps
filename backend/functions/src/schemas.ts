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
  task: z.string().nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  category: EntrySchema.shape.category.nullable(),
});
export type EntryDraft = z.infer<typeof EntryDraftSchema>;

export const ParseEntryInputSchema = z.object({
  rawText: z.string().min(1).describe("Transcribed voice memo or typed text from the host"),
  knownProperties: z
    .array(z.string())
    .describe("The host's existing property names, so the model can match rather than invent new ones"),
  nowIso: z.string().describe("Current timestamp (ISO 8601), for resolving relative time references like 'this morning'"),
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
