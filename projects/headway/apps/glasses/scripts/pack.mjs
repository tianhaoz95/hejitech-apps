#!/usr/bin/env node
// Packs dist/ into build/headway.ehpk. The plugin ships with the iPhone app, so its version is the
// app's MARKETING_VERSION (apps/ios/project.yml, which scripts/cut_release.sh bumps), stamped into
// build/app.json: app.json's own "version" is a placeholder.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const yml = readFileSync(join(here, "../ios/project.yml"), "utf8");
const version = yml.match(/MARKETING_VERSION:\s*"?(\d+\.\d+\.\d+)"?/)?.[1];
if (!version) throw new Error("MARKETING_VERSION not found in apps/ios/project.yml");
const app = { ...JSON.parse(readFileSync(join(here, "app.json"), "utf8")), version };
const dev = app.permissions.flatMap((p) => p.whitelist ?? []).filter((u) => /127\.0\.0\.1|localhost/.test(u));
if (dev.length) throw new Error(`app.json whitelists local addresses: ${dev.join(", ")}`);
mkdirSync(join(here, "build"), { recursive: true });
writeFileSync(join(here, "build/app.json"), JSON.stringify(app, null, 2) + "\n");
execFileSync("npx", ["evenhub", "pack", "build/app.json", "dist", "-o", "build/headway.ehpk"], { cwd: here, stdio: "inherit" });
console.log(`packed Headway glasses ${version} → build/headway.ehpk`);
