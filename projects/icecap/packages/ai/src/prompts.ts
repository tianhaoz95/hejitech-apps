// The prompts every surface sends to the on-device model (ondevice.ts). They ship with the code:
// with no cloud model there's nothing to update remotely, and a prompt change is an extension
// release (or a deploy, for the web app).

/** Resolves {{name}} placeholders; unknown names become empty strings. */
export function fill(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] === undefined ? "" : String(vars[k])));
}

export const DEAL_SUMMARY = `Analyze this real estate listing description for an investor.

PROPERTY DATA:
Address: {{address}}
Price: \${{price}}
Estimated Rent: \${{estimatedRent}}/mo

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
RECOMMENDATION: [text]`;

export const CHAT_ASSISTANT = `You are an AI real estate assistant. Help the user analyze this property.

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

Provide a concise, professional answer based on the data provided.`;

/** "PREVIOUS CONVERSATION:" block for CHAT_ASSISTANT from the last few turns. */
export function historyBlock(turns: { role: "user" | "assistant"; content: string }[], last = 6): string {
  if (!turns.length) return "";
  const lines = turns.slice(-last).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
  return `\nPREVIOUS CONVERSATION:\n${lines.join("\n")}\n`;
}

export interface DealSummary {
  summary: string;
  redFlags: string[];
  recommendation: string;
}

/** Splits a DEAL_SUMMARY answer into its parts (null when the model ignored the format). */
export function parseDealSummary(text: string): DealSummary | null {
  const summary = /SUMMARY:\s*([\s\S]*?)(?=\n\s*RED FLAGS:|$)/i.exec(text)?.[1]?.trim();
  const flags = /RED FLAGS:\s*([\s\S]*?)(?=\n\s*RECOMMENDATION:|$)/i.exec(text)?.[1] ?? "";
  const recommendation = /RECOMMENDATION:\s*([\s\S]*)$/i.exec(text)?.[1]?.trim();
  if (!summary || !recommendation) return null;
  const redFlags = flags.split("\n").map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim()).filter(Boolean);
  return { summary, redFlags, recommendation };
}

/** The web app's portfolio copilot answers in this shape, so it can propose one change to confirm. */
export const COPILOT_FIELDS = ["price", "estimatedRent", "rehabCost", "arv", "holdingCosts", "interestRate", "downPaymentPercent", "vacancyRate", "maintenanceRate", "managementFeeRate"] as const;
export type CopilotField = (typeof COPILOT_FIELDS)[number];

export interface CopilotAnswer {
  answer: string;
  proposal: null | { propertyId: string; field: CopilotField; newValue: number; explanation: string };
}

export const COPILOT_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    proposal: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            propertyId: { type: "string" },
            field: { type: "string", enum: [...COPILOT_FIELDS] },
            newValue: { type: "number" },
            explanation: { type: "string" },
          },
          required: ["propertyId", "field", "newValue", "explanation"],
        },
      ],
    },
  },
  required: ["answer", "proposal"],
} as const;

export const COPILOT_SYSTEM = `You are Icecap's portfolio copilot for a residential real estate investor.
Answer from the deals listed in the context only, in a few short sentences, with numbers.
When the user asks you to change a deal (for example "lower the interest rate on my top deal"), answer and
set "proposal" to exactly one change: the deal's id, one of the allowed fields, the new number and why.
Otherwise set "proposal" to null. Never invent deals or ids. The user confirms every change; you never apply it.
Percent fields (interestRate, downPaymentPercent, vacancyRate, maintenanceRate, managementFeeRate) are numbers like 6.5 for 6.5%.`;
