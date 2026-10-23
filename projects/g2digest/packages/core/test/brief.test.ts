import { describe, expect, it } from "vitest";
import { canonical, checkBrief, starterBrief } from "../src/brief.ts";
import { referenceBrief } from "./helpers.ts";

describe("brief config", () => {
  it("accepts the seeded example and the starter", () => {
    expect(checkBrief(referenceBrief())).toEqual([]);
    expect(checkBrief(starterBrief())).toEqual([]);
  });
  it("starts new users on the PRD defaults", () => {
    const s = starterBrief();
    expect(s.tldr).toBe(true);
    expect(s.total_card_budget).toBe(12);
  });
  it.each([
    ["B_TEMPLATE", (b: any) => { b.sections[0].template = "chart"; }],
    ["B_SOURCE", (b: any) => { b.sections[0].source.kind = "twitter"; }],
    ["B_SOURCE", (b: any) => { b.sections[0].source = { kind: "rss" }; }],
    ["B_SECTION_ID", (b: any) => { b.sections[1].id = b.sections[0].id; }],
    ["B_QUIET", (b: any) => { b.sections[0].quiet_behavior = "pad"; }],
    ["B_AUDIO", (b: any) => { b.sections[2].audio.deep_dive = "required"; }],
    ["B_DELIVERY", (b: any) => { b.delivery.time = "25:00"; }],
    ["B_DELIVERY", (b: any) => { b.delivery.timezone = "Mars/Olympus"; }],
    ["B_UNITS", (b: any) => { b.units.temperature = "K"; }],
    ["B_CARD_BUDGET", (b: any) => { b.total_card_budget = 1; }],
    ["B_MAX_CARDS", (b: any) => { b.sections[0].max_cards = 0; }],
    ["B_SECTIONS", (b: any) => { b.sections = []; }],
  ])("rejects %s", (code, mutate) => {
    const b = referenceBrief();
    mutate(b);
    expect(checkBrief(b).map((i) => i.code)).toContain(code);
  });
  it("canonical JSON ignores key order", () => {
    expect(canonical({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonical({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });
});
