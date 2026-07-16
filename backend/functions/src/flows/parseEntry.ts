import { ai, flashModel } from "../genkit";
import {
  EntryDraftSchema,
  ParseEntryInputSchema,
  type EntryDraft,
} from "../schemas";

/**
 * Cloud fallback for entry parsing. This is the SERVER-SIDE half of the
 * hybrid design (see reports/mvp-scope-v0.html Section 8):
 *
 *   - The Android app tries the on-device model first (see OnDeviceLlm on
 *     the Android side) — cheap, no network call.
 *   - If on-device isn't available (unsupported/not-ready device,
 *     backgrounded app, generation error), the app calls this flow instead,
 *     via the onCallGenkit-wrapped Cloud Function in index.ts.
 *
 * Routing cloud parsing through here (rather than the client calling Gemini
 * directly) means the prompt can be iterated server-side without an app
 * release — the PRD's "ship agent behavior changes instantly" principle.
 */
export const parseEntryFlow = ai.defineFlow(
  {
    name: "parseEntryFlow",
    inputSchema: ParseEntryInputSchema,
    outputSchema: EntryDraftSchema,
  },
  async ({ rawText, knownProperties, nowIso }) => {
    const { output } = await ai.generate({
      model: flashModel,
      prompt: [
        "You extract short-term-rental work-log entries from a host's own words.",
        `Current time: ${nowIso}.`,
        knownProperties.length
          ? `The host's known properties: ${knownProperties.join(", ")}. Match to one of these if the text clearly refers to it; do not invent a new property name unless none of these plausibly match.`
          : "The host has no properties on file yet — use whatever property name (if any) is mentioned.",
        "Extract: property, task (short, specific — not vague like 'worked on house'), durationMinutes, and category.",
        "Capture is meant to be fast, not a conversation: fill in every field you can confidently determine, and leave any field you genuinely can't determine as null. Never withhold a field or ask a question — the host reviews and fills in gaps themselves afterward, so a partial entry is the correct output, not a failure.",
        `Host's message: "${rawText}"`,
      ].join("\n"),
      output: { schema: EntryDraftSchema },
    });

    if (output == null) {
      throw new Error("parseEntryFlow: model response didn't satisfy EntryDraftSchema");
    }
    return output as EntryDraft;
  }
);
