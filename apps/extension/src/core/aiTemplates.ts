// Remote Config parameter names — these keys store the prompt body text in Firebase.
// Run `node scripts/upload-prompts.mjs` to sync firebase/prompts/*.prompt → Remote Config.
export const PROMPT_RC_KEYS = {
  dealSummary: "prompt_deal_summary",
  chatAssistant: "prompt_chat_assistant",
} as const

// Local copies of firebase/prompts/*.prompt bodies for emulator/dev use.
// Keep these in sync with the .prompt files by running the upload script.
// Note: \$ escapes prevent TypeScript from parsing ${{...}} as template expressions.
export const LOCAL_TEMPLATES = {
  dealSummary: `Analyze this real estate listing description for an investor.

PROPERTY DATA:
Address: {{address}}
Price: \${{price}}
Estimated Rent: \${{estimatedRent}}

DESCRIPTION:
{{description}}

Provide:
1. A one-paragraph investment summary.
2. A list of 3 specific red flags (if any).
3. A final recommendation.

Format as:
SUMMARY: [text]
RED FLAGS:
- [flag 1]
- [flag 2]
- [flag 3]
RECOMMENDATION: [text]`,

  chatAssistant: `You are an AI real estate assistant. Help the user analyze this property.

PROPERTY CONTEXT:
Address: {{address}}
Purchase Price: \${{price}}
Estimated Rent: \${{estimatedRent}}/mo
Taxes: \${{taxes}}/yr
HOA: \${{hoa}}/mo
Strategy: {{strategy}}

FINANCIAL METRICS:
Monthly Cash Flow: \${{monthlyCashFlow}}
Cap Rate: {{capRate}}%
Cash-on-Cash Return: {{cocReturn}}%
{{history}}
USER QUESTION:
{{question}}

Provide a concise, professional answer based on the data provided.`,
}

// Resolves {{varName}} placeholders. Unmatched keys become empty strings.
export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}
