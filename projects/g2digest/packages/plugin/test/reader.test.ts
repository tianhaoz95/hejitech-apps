import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Bundle } from "@g2digest/core";
import { Reader, type AudioOut } from "../src/reader.ts";

const bundle: Bundle = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../core/fixtures/2026-10-22/bundle.json"), "utf8"));

function setup(urls: Record<string, string | null> = {}) {
  const calls: string[] = [];
  let exits = 0;
  let ended = () => {};
  const audio: AudioOut = {
    play: async (u) => void calls.push(`play ${u}`),
    pause: () => void calls.push("pause"),
    resume: () => void calls.push("resume"),
    stop: () => void calls.push("stop"),
    onEnded: (cb) => void (ended = cb),
  };
  const shown: string[][] = [];
  const persisted: number[] = [];
  const reader = new Reader({
    audio,
    audioUrl: async (p) => (p in urls ? urls[p] : `https://audio/${p}`),
    onChange: (lines) => void shown.push(lines),
    persist: (_d, i) => void persisted.push(i),
    onExit: () => void exits++,
    now: () => 1000,
  });
  reader.load(bundle);
  return { reader, calls, shown, persisted, end: () => ended(), exits: () => exits };
}

describe("Reader", () => {
  it("plays the card's own files and returns to skimming when they end", async () => {
    const { reader, calls, shown, end } = setup();
    await reader.gesture("next");
    await reader.gesture("tap");
    expect(calls).toContain("play https://audio/2026-10-22/tldr-glance.mp3");
    expect(shown.at(-1)!.at(-1)).toBe("> GLANCE PLAYING");
    end();
    expect(shown.at(-1)!.at(-1)).toBe(reader.frames[1].footer);
  });
  it("resumes at a position", () => {
    const { reader } = setup();
    reader.load(bundle, 4);
    expect(reader.state.index).toBe(4);
  });
  it("persists swipes", async () => {
    const { reader, persisted } = setup();
    await reader.gesture("next");
    await reader.gesture("next");
    expect(persisted).toEqual([1, 2]);
  });
  it("flashes AUDIO OFFLINE when a file can't be reached", async () => {
    const { reader, shown } = setup({ "2026-10-22/tldr-glance.mp3": null });
    await reader.gesture("next");
    await reader.gesture("tap");
    expect(shown.at(-1)!.at(-1)).toBe("[ AUDIO OFFLINE ]");
    expect(reader.state.audio).toBeNull();
  });
  it("in podcast mode, names the episode instead of playing", async () => {
    const { reader, calls, shown } = setup();
    reader.mode = "podcast";
    for (let i = 0; i < 3; i++) await reader.gesture("next");
    await reader.gesture("long_press");
    expect(calls.filter((c) => c.startsWith("play"))).toEqual([]);
    // Episodes: tldr glance 1, providers glance 2, proteina glance 3, proteina deep dive 4.
    expect(shown.at(-1)!.at(-1)).toBe("[ PODCAST EPISODE 4 ]");
  });
  it("double tap stops audio first, then asks to exit", async () => {
    const { reader, calls, exits } = setup();
    await reader.gesture("next");
    await reader.gesture("tap");
    await reader.gesture("double_tap");
    expect(calls.at(-1)).toBe("stop");
    expect(exits()).toBe(0);
    await reader.gesture("double_tap");
    expect(exits()).toBe(1);
  });
});
