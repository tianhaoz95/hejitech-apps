#!/usr/bin/env node
// PRD §13: no topic, company or source name may appear in code, guide text or UI copy outside the
// seeded example brief. Topics live in each user's brief; the system never hardcodes them. This
// takes every entity, query term and section title from the example brief and greps the project
// for them, outside the files that are the example (fixtures, the seed) and this check.
//   node projects/g2digest/scripts/check-no-topics.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const project = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(project, "../..");
const brief = JSON.parse(readFileSync(join(project, "packages/core/fixtures/reference-brief.json"), "utf8"));

const terms = new Set();
for (const s of brief.sections) {
  for (const e of s.source.entities ?? []) terms.add(e);
  for (const w of (s.source.query ?? "").match(/"[^"]+"|[A-Z][\w-]{3,}/g) ?? []) terms.add(w.replace(/"/g, ""));
}
// Generic words a query happens to capitalize aren't topics.
for (const generic of ["OR", "AND", "News"]) terms.delete(generic);
// Words of the example's proper nouns ("Fireworks" of "Fireworks AI") count on their own too.
for (const t of [...terms]) for (const w of t.split(/\s+/)) if (w.length > 4 && /^[A-Z]/.test(w) && !["Composite", "Industrial", "Average"].includes(w)) terms.add(w);

const ALLOWED = [
  "packages/core/fixtures/",          // the example brief and the development fixture built from it
  "packages/core/test/__snapshots__/", // the fixture's rendered snapshot
  "scripts/check-no-topics.mjs",
  "scripts/test-api.mjs",             // asserts on the fixture's content
  "docs/decisions.md",                // records the PRD's example as the example
];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".wrangler"]);
const TEXT = /\.(?:ts|mjs|js|json|html|css|md|jsonc|sql|yml|env)$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (TEXT.test(name)) yield p;
  }
}
const files = [...walk(project), join(repo, "supabase/schemas/g2digest/schema.sql")];
const problems = [];
for (const f of files) {
  const rel = relative(project, f);
  if (ALLOWED.some((a) => rel.startsWith(a))) continue;
  const text = readFileSync(f, "utf8");
  for (const t of terms) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) problems.push(`${relative(repo, f)}: "${t}"`);
  }
}
if (problems.length) {
  console.error(`!! topic names from the example brief outside it (they belong in a user's brief):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`no example-brief topics in code, guide or UI (${terms.size} terms, ${files.length} files)`);
