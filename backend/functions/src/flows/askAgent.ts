import { ai, flashModel } from "../genkit";
import { AskAgentInputSchema, AskAgentOutputSchema } from "../schemas";

/**
 * Cloud fallback for the free-form agent chat ("will this count?", "how many
 * hours do I need?") — same two-tier shape as parseEntryFlow: the Android
 * app tries on-device Gemini Nano first (per the user's InferencePreference,
 * see AgentClient.kt), and falls back to this callable otherwise.
 *
 * Deliberately answers only from the host's own logged-hours context plus
 * general STR material-participation rules (IRS Pub 925 / §1.469-5T tests) —
 * this is the PRD's "legal-grounding copilot" wedge, not a tax/legal advice
 * product, so the prompt is explicit about that boundary rather than letting
 * the model imply certainty it doesn't have.
 */
export const askAgentFlow = ai.defineFlow(
  {
    name: "askAgentFlow",
    inputSchema: AskAgentInputSchema,
    outputSchema: AskAgentOutputSchema,
  },
  async ({ history, question, confirmedHours, thresholdHours, testName }) => {
    const { text } = await ai.generate({
      model: flashModel,
      messages: [
        {
          role: "system",
          content: [
            {
              text: [
                "You are the in-app copilot for an app that helps short-term-rental hosts",
                "log hours toward IRS material-participation tests (e.g. the 100-hour or",
                "500-hour STR tests, or the 750-hour real-estate-professional test), grounded",
                "in IRS Pub 925 and Treas. Reg. §1.469-5T.",
                `This host is tracking toward the ${testName} test: ${confirmedHours} of ${thresholdHours} hours confirmed so far.`,
                "Answer the host's question directly and concisely using that context.",
                "You are not a lawyer or CPA and this is not tax or legal advice — say so",
                "plainly whenever a question turns on a genuinely unsettled or fact-specific",
                "legal judgment call, and suggest they confirm with their tax professional.",
                "Do not fabricate case law, IRS rulings, or numbers you weren't given.",
              ].join(" "),
            },
          ],
        },
        ...history.map((message) => ({
          role: (message.role === "agent" ? "model" : "user") as "model" | "user",
          content: [{ text: message.text }],
        })),
        { role: "user" as const, content: [{ text: question }] },
      ],
    });

    if (!text) {
      throw new Error("askAgentFlow: model returned no text");
    }
    return { answer: text };
  }
);
