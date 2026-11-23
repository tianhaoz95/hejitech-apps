// Search excerpts (service.ts): readable text around the first match, from pages and from code.
import { describe, expect, it } from "vitest";
import { excerpt, searchTerms } from "../src/worker/service.ts";

describe("search", () => {
  it("splits words and keeps quoted phrases", () => {
    expect(searchTerms('Pricing "launch plan" pricing')).toEqual(["pricing", "launch plan"]);
    expect(searchTerms("  ")).toEqual([]);
    expect(searchTerms("a b c d e f g h")).toHaveLength(6);
  });
  it("strips tags, scripts and a style the window starts inside", () => {
    const raw = `color: #5803d; } h1 { x: 1 }</style></head><body><h1>Desks</h1><p>Desk A wins on range &amp; stability.</p><script>var range = 1;</script>`;
    expect(excerpt(raw, "range")).toBe("Desks Desk A wins on range & stability.");
  });
  it("leaves code alone", () => {
    expect(excerpt("const a = `<div>${buy}</div>`;", "buy", 160, false)).toBe("const a = `<div>${buy}</div>`;");
  });
  it("trims long text around the match", () => {
    const raw = `${"lorem ".repeat(100)}needle ${"ipsum ".repeat(100)}`;
    const e = excerpt(raw, "needle", 60, false);
    expect(e.startsWith("…") && e.endsWith("…") && e.includes("needle")).toBe(true);
  });
});
