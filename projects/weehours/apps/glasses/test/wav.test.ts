import { describe, expect, it } from "vitest";
import { concat, durationMs, wav } from "../src/wav.ts";

describe("wav", () => {
  it("wraps 16 kHz PCM16 with a valid header", () => {
    const pcm = concat([new Uint8Array(3200), new Uint8Array(3200)]);
    const w = wav(pcm);
    const v = new DataView(w.buffer);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...w.slice(8, 12))).toBe("WAVE");
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(40, true)).toBe(6400);
    expect(w.length).toBe(44 + 6400);
    expect(durationMs(pcm)).toBe(200);
  });
});
