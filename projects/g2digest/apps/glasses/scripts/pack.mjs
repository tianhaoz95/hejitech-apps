#!/usr/bin/env node
// Packs dist/ into build/g2digest.ehpk with app.json's version taken from package.json (the
// version scripts/cut_release.sh bumps), so the plugin and the release always agree.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;
const app = { ...JSON.parse(readFileSync(join(here, "app.json"), "utf8")), version };
mkdirSync(join(here, "build"), { recursive: true });
writeFileSync(join(here, "build/app.json"), JSON.stringify(app, null, 2) + "\n");
execFileSync("npx", ["evenhub", "pack", "build/app.json", "dist", "-o", "build/g2digest.ehpk"], { cwd: here, stdio: "inherit" });
console.log(`packed G2 Digest ${version} → build/g2digest.ehpk`);
