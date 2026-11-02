// Writes one SRT subtitle file per weehours-launch cut for YouTube: one cue per spoken line (the
// narration and the characters' Flow lines), timed from voiceover.ts as Composition.tsx places them.
// The tagline is in the subtitles although the video shows it on the end card instead of a caption.
// Usage (from branding/promo-videos): node scripts/weehours-launch-srt.mjs out/final
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = process.argv[2] ?? "out/final";
// Composition.tsx is JSX: bundle it for node (packages stay external) to read its SPEECH table.
const bundle = resolve("out/weehours-launch-speech.mjs"); // inside the project, so node_modules resolve
await build({ entryPoints: ["src/weehours-launch/Composition.tsx"], bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", outfile: bundle, logLevel: "error" });
const { SPEECH } = await import(bundle);
rmSync(bundle);

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

mkdirSync(dir, { recursive: true });
for (const [id, { lines, end, words }] of Object.entries(SPEECH)) {
  const cues = lines
    .map((l) => {
      const w = words[l.key];
      const o = l.at - (l.from ?? 0);
      return { start: o + w[0][1], end: o + w[w.length - 1][2], text: w.map((x) => x[0]).join(" ") };
    })
    .sort((a, b) => a.start - b.start);
  const srt = cues
    .map((c, i) => {
      // Hold each cue 0.4 s past its last word, but never into the next cue or past the end.
      const stop = Math.min(c.end + 0.4, cues[i + 1]?.start ?? end, end);
      return `${i + 1}\n${ts(c.start)} --> ${ts(stop)}\n${c.text}\n`;
    })
    .join("\n");
  writeFileSync(join(dir, `${id}.srt`), srt);
  console.log(`${id}.srt: ${cues.length} cues`);
}
