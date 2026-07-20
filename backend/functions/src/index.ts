import { onCallGenkit } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";

import { parseEntryFlow } from "./flows/parseEntry";
import { flagRiskFlow } from "./flows/flagRisk";
import { askAgentFlow } from "./flows/askAgent";

initializeApp();

export { deleteAccount, cleanupDeletedUserData } from "./account";
export { mintWatchAuthToken } from "./watchAuth";

// Set via: firebase functions:secrets:set GOOGLE_GENAI_API_KEY
// Not needed for local emulator use against the Genkit dev UI with a
// personal API key exported as an env var instead — see backend/README.md.
const googleGenAiKey = defineSecret("GOOGLE_GENAI_API_KEY");

/**
 * Callable from the Android app via the Firebase Functions client SDK.
 * enforceAppCheck stays on even against the emulator (App Check has an
 * emulator/debug-token mode) — don't disable it "temporarily," per the PRD's
 * own trust-first design principle; it's cheap to configure once up front.
 */
export const parseEntry = onCallGenkit(
  {
    secrets: [googleGenAiKey],
    enforceAppCheck: true,
  },
  parseEntryFlow
);

export const flagRisk = onCallGenkit(
  {
    // No secret needed — flagRiskFlow makes no LLM call.
    enforceAppCheck: true,
  },
  flagRiskFlow
);

export const askAgent = onCallGenkit(
  {
    secrets: [googleGenAiKey],
    enforceAppCheck: true,
  },
  askAgentFlow
);
