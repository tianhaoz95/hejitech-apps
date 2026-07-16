import { googleAI } from "@genkit-ai/google-genai";
import { genkit } from "genkit";

/**
 * NOTE on package/model naming: Genkit's Google AI plugin has been renamed
 * at least once (older docs reference "@genkit-ai/googleai" + a pinned model
 * like "gemini15Flash"; current docs as of this writing point to
 * "@genkit-ai/google-genai" + the "gemini-flash-latest" alias, which is what
 * this file uses since it matches "use the latest Flash model" and won't go
 * stale as new Flash versions ship). Verify against `npm view
 * @genkit-ai/google-genai` and the current genkit.dev docs before your first
 * `npm install` — this space has moved fast enough that it's worth a
 * five-minute check rather than trusting this comment blindly.
 */
export const ai = genkit({
  plugins: [googleAI()],
});

export const flashModel = googleAI.model("gemini-flash-latest");
