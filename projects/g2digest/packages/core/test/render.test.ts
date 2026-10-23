import { describe, expect, it } from "vitest";
import { dateKicker, len, metricLine, render, snapshot, wrap } from "../src/render.ts";
import { fixtureBundle } from "./helpers.ts";

describe("render", () => {
  it("is a pure function of the bundle", () => {
    expect(render(fixtureBundle())).toEqual(render(fixtureBundle()));
  });
  it("renders the fixture in the fixed anatomy", () => {
    const frames = render(fixtureBundle());
    expect(frames.map((f) => f.id)).toEqual([
      "2026-10-22-cover", "2026-10-22-tldr", "2026-10-22-providers-quiet", "2026-10-22-proteina-binders",
      "2026-10-22-open-coder-speed", "2026-10-22-markets-close", "2026-10-22-end",
    ]);
    const proteina = frames[3];
    expect(proteina.lines[0]).toBe("AI/ML 1/2");
    expect(proteina.lines.at(-2)).toBe("FLOW MATCHING");
    expect(proteina.footer).toBe("♪ DEEP DIVE 3 MIN");
    expect(frames[0].lines[0]).toBe("THU OCT 22");
    expect(frames[2].footer).toMatch(/^♪ \d+S · NO DEEP DIVE$/);
    expect(frames[5].lines).toContain("NASDAQ ............ -1.2%");
    for (const f of frames) for (const l of f.lines) expect(len(l)).toBeLessThanOrEqual(25);
  });
  it("matches the snapshot", () => {
    expect(snapshot(render(fixtureBundle()))).toMatchSnapshot();
  });
});

describe("helpers", () => {
  it("wraps at word boundaries", () => {
    expect(wrap("one two three four five six seven", 10)).toEqual(["one two", "three four", "five six", "seven"]);
  });
  it("pads metric lines to the width", () => {
    expect(len(metricLine("Dow", "-0.5%"))).toBe(25);
  });
  it("names the day", () => {
    expect(dateKicker("2026-10-22")).toBe("THU OCT 22");
  });
});
