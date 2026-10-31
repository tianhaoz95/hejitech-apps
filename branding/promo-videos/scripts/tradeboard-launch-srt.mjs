// Writes the 30 s cut's voiceover as an SRT caption file for YouTube (one cue per line, Whisper timings).
// Usage: node --experimental-strip-types scripts/tradeboard-launch-srt.mjs > out/tradeboard-launch-30.srt
import { VO_30 } from "../src/tradeboard-launch/voiceover.ts";

const AT = 0.35; // VO_30_AT in Composition.tsx
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
console.log(
  VO_30.map((line, i) => {
    const start = line[0][1] + AT;
    const end = line[line.length - 1][2] + AT + 0.4;
    return `${i + 1}\n${ts(start)} --> ${ts(end)}\n${line.map((w) => w[0]).join(" ")}\n`;
  }).join("\n"),
);
