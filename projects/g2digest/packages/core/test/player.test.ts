import { describe, expect, it } from "vitest";
import { render } from "../src/render.ts";
import { ended, initialState, NO_DEEP_DIVE, step, view, type Gesture, type PlayerState } from "../src/player.ts";
import { fixtureBundle } from "./helpers.ts";

const frames = render(fixtureBundle());
const run = (gestures: Gesture[], from: PlayerState = initialState()) => {
  let s = from;
  const all = [];
  for (const g of gestures) {
    const r = step(s, g, frames, 1000);
    s = r.state;
    all.push(...r.commands);
  }
  return { s, all };
};

describe("gesture map (PRD §7.1)", () => {
  it("swipes move between cards and persist the position", () => {
    const { s, all } = run(["next", "next", "prev"]);
    expect(s.index).toBe(1);
    expect(all.filter((c) => c.kind === "persist").map((c) => (c as { index: number }).index)).toEqual([1, 2, 1]);
  });
  it("stops at both ends", () => {
    expect(run(["prev"]).s.index).toBe(0);
    expect(run(Array(20).fill("next")).s.index).toBe(frames.length - 1);
  });
  it("tap plays and pauses the glance", () => {
    const { s, all } = run(["next", "tap", "tap", "tap"]);
    expect(all.filter((c) => c.kind !== "persist")).toEqual([{ kind: "play", slug: "tldr", audio: "glance" }, { kind: "pause" }, { kind: "resume" }]);
    expect(s.audio).toEqual({ slug: "tldr", kind: "glance", playing: true });
  });
  it("long press plays the deep dive", () => {
    const { s, all } = run(["next", "next", "next", "long_press"]);
    expect(all.at(-1)).toEqual({ kind: "play", slug: "proteina-binders", audio: "deep_dive" });
    expect(view(s, frames, 1000).at(-1)).toBe("> DEEP DIVE PLAYING");
  });
  it("long press without a deep dive flashes NO DEEP DIVE, never silently", () => {
    const { s, all } = run(["next", "long_press"]);
    expect(all.filter((c) => c.kind === "play")).toEqual([]);
    expect(view(s, frames, 1000).at(-1)).toBe(`[ ${NO_DEEP_DIVE} ]`);
    expect(view(s, frames, 5000).at(-1)).toBe(frames[1].footer);
  });
  it("double tap stops audio and returns to skimming", () => {
    const { s, all } = run(["next", "tap", "double_tap"]);
    expect(all.at(-1)).toEqual({ kind: "stop" });
    expect(s.audio).toBeNull();
    expect(view(s, frames, 1000)).toEqual(frames[1].lines);
  });
  it("double tap with nothing playing asks to exit (Even Hub: system exit dialog on the root page)", () => {
    expect(run(["next", "double_tap"]).all.at(-1)).toEqual({ kind: "exit" });
    expect(run(["next", "tap", "double_tap", "double_tap"]).all.slice(-2)).toEqual([{ kind: "stop" }, { kind: "exit" }]);
  });
  it("stop only ever stops audio, never exits", () => {
    expect(run(["next", "tap", "stop"]).all.at(-1)).toEqual({ kind: "stop" });
    expect(run(["next", "stop"]).all.filter((c) => c.kind !== "persist")).toEqual([]);
  });
  it("swiping stops the playing card's audio", () => {
    const { s, all } = run(["next", "tap", "next"]);
    expect(all.filter((c) => c.kind === "stop")).toHaveLength(1);
    expect(s.audio).toBeNull();
  });
  it("tap during a deep dive pauses it", () => {
    const { s, all } = run(["next", "next", "next", "long_press", "tap"]);
    expect(all.at(-1)).toEqual({ kind: "pause" });
    expect(s.audio?.kind).toBe("deep_dive");
  });
  it("audio ending returns to skimming", () => {
    const { s } = run(["next", "tap"]);
    expect(ended(s).audio).toBeNull();
  });
  it("every player footer fits the line width", () => {
    for (const g of [["next", "tap"], ["next", "tap", "tap"], ["next", "next", "next", "long_press"], ["next", "next", "next", "long_press", "tap"], ["long_press"]] as Gesture[][]) {
      for (const l of view(run(g).s, frames, 1000)) expect([...l].length).toBeLessThanOrEqual(25);
    }
  });
});
