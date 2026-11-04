// Writes one SRT per g2digest-demo cut for YouTube (one cue per narration line, timed as Composition.tsx
// places them) and the YouTube chapter list for the walkthrough's description, from the composition's own
// exports (SPEECH_BY_ID, CHAPTER_LIST), so a re-cut only needs this script run again.
// Usage (from branding/promo-videos): node scripts/g2digest-demo-srt.mjs out/final
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = process.argv[2] ?? "out/final";
const bundle = resolve("out/g2digest-demo-speech.mjs"); // inside the project, so node_modules resolve
await build({ entryPoints: ["src/g2digest-demo/Composition.tsx"], bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", outfile: bundle, logLevel: "error", loader: { ".json": "json" } });
const { SPEECH_BY_ID, CHAPTER_LIST } = await import(bundle);
rmSync(bundle);

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
mkdirSync(dir, { recursive: true });
for (const [id, { cues: lines, end }] of Object.entries(SPEECH_BY_ID)) {
  const cues = lines.map((l) => ({ start: l.at + l.words[0][1], end: l.at + l.words.at(-1)[2], text: l.words.map((w) => w[0]).join(" ") })).sort((a, b) => a.start - b.start);
  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.min(c.end + 0.4, cues[i + 1]?.start ?? end, end))}\n${c.text}\n`).join("\n");
  writeFileSync(join(dir, `${id}.srt`), srt);
  console.log(`${id}.srt: ${cues.length} cues`);
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const chapters = CHAPTER_LIST.map((c, i) => `${i ? mmss(c.start) : "0:00"} ${c.title}`).join("\n");
writeFileSync(join(dir, "g2digest-demo-chapters.txt"), chapters + "\n");
console.log(chapters);
