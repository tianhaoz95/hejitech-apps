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
        "The host's message is dictated speech, not typed text — clean it up before extracting \"task\": remove filler words and disfluencies (\"uh\", \"um\", false starts, mid-sentence restarts) that carry no information, and fix likely transcription errors, punctuation, and capitalization. Never change the meaning or drop a real detail.",
        "Format \"task\" as plain prose by default. Only use a markdown bullet list (lines starting with \"- \") when the host clearly describes multiple distinct sub-tasks in one capture — a single task never needs a bullet. Never use headers, tables, or bold; a bullet list is the only formatting ever appropriate here, and only when it actually makes several items easier to scan than a sentence would.",
        "Also set eventType if the host is opening or closing a start/stop timer rather than describing a complete task: \"start\" for phrasing like 'I'm starting to work on X' / 'beginning work now' / 'clocking in', \"stop\" for phrasing like 'I just finished' / 'wrapping up' / 'clocking out'. Leave eventType null for a normal complete description of work already done (e.g. 'spent an hour cleaning unit 4') — most messages are this case, not a timer event. When eventType is \"start\", durationMinutes should be null (it isn't known yet).",
        "Also set miles if the host states a distance driven (e.g. 'drove 12 miles to pick up supplies', '8 mile round trip') — this is a separate business-mileage tax deduction, not the hours tracked above, so extract it whenever a distance is mentioned even alongside a normal task/duration. Leave miles null if no distance is mentioned.",
        `Also set resolvedActivityDateIso if the host mentions when the work happened relative to now (${nowIso}) or at a specific clock time — resolve it to a single absolute ISO-8601 timestamp. For example "4 hours ago" or "this morning"/"last night"/"yesterday" all resolve relative to current time; "at 3pm" resolves to that clock time on the most recent applicable day. Leave resolvedActivityDateIso null if the host mentions no time reference at all — most messages are this case, and null correctly means "now."`,
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
