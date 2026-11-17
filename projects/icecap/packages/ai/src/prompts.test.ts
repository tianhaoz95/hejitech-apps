import { describe, expect, it } from "vitest";
import { DEAL_SUMMARY, fill, historyBlock, parseDealSummary } from "./prompts.ts";

describe("prompts", () => {
  it("fills placeholders and blanks unknown ones", () => {
    expect(fill("A {{a}} B {{b}} C {{missing}}", { a: 1, b: "x" })).toBe("A 1 B x C ");
    const p = fill(DEAL_SUMMARY, { address: "1 Main St", price: 300000, estimatedRent: 2100, description: "Roof is new." });
    expect(p).toContain("Price: $300000");
    expect(p).toContain("Roof is new.");
    expect(p).not.toMatch(/\{\{/);
  });

  it("keeps the last turns of a chat", () => {
    expect(historyBlock([])).toBe("");
    const turns = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}` }));
    const h = historyBlock(turns);
    expect(h).toContain("PREVIOUS CONVERSATION:");
    expect(h).not.toContain("m1\n");
    expect(h).toContain("Assistant: m7");
  });

  it("splits a deal summary answer", () => {
    const text = "SUMMARY: Solid cash flow.\nRED FLAGS:\n- Old roof\n* Flood zone\n3. As-is sale\nRECOMMENDATION: Get an inspection.";
    expect(parseDealSummary(text)).toEqual({ summary: "Solid cash flow.", redFlags: ["Old roof", "Flood zone", "As-is sale"], recommendation: "Get an inspection." });
    expect(parseDealSummary("free-form answer")).toBeNull();
  });
});
