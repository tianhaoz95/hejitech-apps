#!/usr/bin/env node
// In a checkout this runs the TypeScript source directly (Node ≥ 23.6 strips types); installed from
// a registry there is no source, only the bundle `npm run build` makes (Node ≥ 20).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = new URL("../src/main.ts", import.meta.url);
await import(existsSync(fileURLToPath(source)) ? source.href : new URL("../dist/hq.mjs", import.meta.url).href);
