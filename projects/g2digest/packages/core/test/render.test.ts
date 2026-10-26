import { describe, expect, it } from "vitest";
import { textPx } from "../src/font.ts";
import { dateKicker, LINE_PX, MAX_LINES, metricLine, render, screenText, snapshot, wrap } from "../src/render.ts";
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
    const metric = fixtureBundle().cards[5].metrics![0];
    expect(frames[5].lines[2]).toBe(metricLine(metric.label, metric.value));
    expect(frames[5].lines[2]).toMatch(/^[A-Z]+ \.{3,} -1\.2%$/);
    for (const f of frames) for (const l of f.lines) expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
  });
  it("matches the snapshot", () => {
    expect(snapshot(render(fixtureBundle()))).toMatchSnapshot();
  });
});

describe("helpers", () => {
  it("wraps at word boundaries by the glasses' pixel widths", () => {
    expect(wrap("one two three four five six seven", 90)).toEqual(["one two", "three four", "five six", "seven"]);
    const lines = wrap("A plain sentence that is long enough to need more than one line on the glasses, even at full width.");
    expect(lines.length).toBe(2);
    for (const [i, l] of lines.entries()) {
      expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
      if (i < lines.length - 1) expect(textPx(`${l} ${lines[i + 1].split(" ")[0]}`)).toBeGreaterThan(LINE_PX);
    }
  });
  it("pads metric lines out to the right edge", () => {
    const l = metricLine("Dow", "-0.5%");
    expect(l.startsWith("DOW ") && l.endsWith(" -0.5%")).toBe(true);
    expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
    expect(LINE_PX - textPx(l)).toBeLessThan(textPx("."));
  });
  it("pins the footer to the frame's last line", () => {
    const text = screenText(["KICKER", "Title", "Body", "FOOTER"]);
    expect(text.split("\n")).toHaveLength(MAX_LINES);
    expect(text.split("\n").at(-1)).toBe("FOOTER");
    expect(text.endsWith("\n")).toBe(false);
  });
  it("points the End card to the past editions (the tour's End to exit)", () => {
    expect(render(fixtureBundle()).at(-1)!.footer).toBe("SWIPE UP: PAST EDITIONS");
  });
  it("fits the frame: 536 px lines, 9 of them", () => {
    expect([LINE_PX, MAX_LINES]).toEqual([536, 9]);
  });
  it("names the day", () => {
    expect(dateKicker("2026-10-22")).toBe("THU OCT 22");
  });
});
