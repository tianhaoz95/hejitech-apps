#!/usr/bin/env node
// HQ is opinionated but not coupled (PRD §11): its code may not know any project's name, path or
// tools. A repo reaches HQ only through its .hq/ folders. This fails if HQ's code mentions another
// project, a `projects/` path, or this repo's release script.
//
//   node projects/hq/scripts/check_coupling.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const hq = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(hq, "..", "..");
const others = readdirSync(join(root, "projects")).filter((p) => p !== "hq" && statSync(join(root, "projects", p)).isDirectory());
// HQ's own code. Not its docs, its tests' fixture, or the .hq/ folder describing HQ as a project.
const dirs = ["packages/core/src", "services/web/src", "services/web/index.html", "apps/cli/src", "apps/ios/App/Sources"];
const banned = [
  ...others.map((p) => ({ re: new RegExp(`\\b${p}\\b`, "i"), why: `names the ${p} project` })),
  { re: /projects\//, why: "uses a projects/ path (a repo layout HQ mustn't assume)" },
  { re: /cut_release/, why: "calls this repo's release script (use the release verb)" },
  { re: /hejitech-apps/, why: "names this repo" },
];
const problems = [];
const walk = (p) => {
  const s = statSync(p);
  if (s.isDirectory()) return readdirSync(p).forEach((e) => walk(join(p, e)));
  if (!/\.(ts|swift|html|css|mjs|js)$/.test(p)) return;
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    // Comments may point at where code lives in this repo; code may not depend on it.
    const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
    for (const b of banned) if (b.re.test(code)) problems.push(`${relative(root, p)}:${i + 1}: ${b.why}: ${line.trim().slice(0, 120)}`);
  });
};
for (const d of dirs) walk(join(hq, d));
if (problems.length) {
  console.error(`HQ is coupled to this repo (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`HQ's code names no project, path or repo tool (checked against ${others.length} other projects)`);
