import { describe, expect, it } from "vitest";
import { textPx } from "../src/font.ts";
import { len, LINE_PX, MAX_CHARS, MAX_LINES, render, snapshot } from "../src/render.ts";
import { initialState, step } from "../src/player.ts";
import { isTour, tour, type TourReason } from "../src/tour.ts";
import { fixtureBundle } from "./helpers.ts";

const REASONS: TourReason[] = ["pair", "waiting", "offline"];

describe("tour (the bundle shown when there's no edition)", () => {
  it.each(REASONS)("every card fits the glasses (%s)", (reason) => {
    for (const f of render(tour(reason, "2026-10-24"))) {
      expect(f.lines.length, f.slug).toBeLessThanOrEqual(MAX_LINES);
      for (const l of f.lines) expect(textPx(l), `${f.slug}: ${l}`).toBeLessThanOrEqual(LINE_PX);
      expect(f.lines.reduce((n, l) => n + len(l), 0), f.slug).toBeLessThanOrEqual(MAX_CHARS);
    }
  });
  it("ends with the next step for the reason", () => {
    expect(render(tour("pair", "2026-10-24")).at(-2)!.lines.join(" ")).toContain("Pair your glasses");
    expect(render(tour("waiting", "2026-10-24")).at(-2)!.lines.join(" ")).toContain("Connect an agent");
  });
  it("answers every gesture on every card (Even Hub review)", () => {
    const frames = render(tour("pair", "2026-10-24"));
    frames.forEach((_, index) => {
      for (const g of ["tap", "long_press"] as const) expect(step(initialState(index), g, frames, 0).state.flash, `${g} on ${index}`).not.toBeNull();
      expect(step(initialState(index), "double_tap", frames, 0).commands).toEqual([{ kind: "exit" }]);
    });
  });
  it("is told apart from a real edition", () => {
    expect(isTour(tour("offline", "2026-10-24"))).toBe(true);
    expect(isTour(fixtureBundle())).toBe(false);
  });
  it("matches the snapshot", () => {
    expect(snapshot(render(tour("pair", "2026-10-24")))).toMatchSnapshot();
  });
});
