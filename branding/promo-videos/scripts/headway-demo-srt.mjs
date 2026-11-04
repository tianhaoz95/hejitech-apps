// Writes one SRT per headway-demo cut for YouTube (one cue per narration line, timed as Composition.tsx
// places them) and the YouTube chapter list for the walkthrough's description, from the composition's own
// exports (SPEECH_BY_ID, CHAPTER_LIST), so a re-cut only needs this script run again.
// Usage: node branding/promo-videos/scripts/headway-demo-srt.mjs [out/final]
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROMO_ROOT = resolve(SCRIPT_DIR, "..");
const outArg = process.argv[2] ?? "out/final";
const outDir = resolve(process.cwd(), outArg);

const entryPoint = resolve(PROMO_ROOT, "src/headway-demo/Composition.tsx");
const bundle = resolve(PROMO_ROOT, "out/headway-demo-speech.mjs");

mkdirSync(resolve(PROMO_ROOT, "out"), { recursive: true });
await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
  outfile: bundle,
  logLevel: "error",
  loader: { ".json": "json" }
});

const { SPEECH_BY_ID, CHAPTER_LIST } = await import(bundle);
rmSync(bundle, { force: true });

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

mkdirSync(outDir, { recursive: true });
for (const [id, { cues: lines, end }] of Object.entries(SPEECH_BY_ID)) {
  const cues = lines.map((l) => ({
    start: l.at + l.words[0][1],
    end: l.at + l.words.at(-1)[2],
    text: l.words.map((w) => w[0]).join(" ")
  })).sort((a, b) => a.start - b.start);

  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.min(c.end + 0.4, cues[i + 1]?.start ?? end, end))}\n${c.text}\n`).join("\n");
  writeFileSync(join(outDir, `${id}.srt`), srt);
  console.log(`${id}.srt: ${cues.length} cues`);
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const chapters = CHAPTER_LIST.map((c, i) => `${i ? mmss(c.start) : "0:00"} ${c.title}`).join("\n");
writeFileSync(join(outDir, "headway-demo-chapters.txt"), chapters + "\n");
console.log("\nYouTube Chapters:\n" + chapters);
