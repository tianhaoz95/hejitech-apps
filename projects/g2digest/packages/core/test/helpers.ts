import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GUIDE_VERSION } from "../src/guide.gen.ts";
import type { Brief, Bundle } from "../src/types.ts";
import type { ValidateContext } from "../src/validate.ts";

const fx = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const brief: Brief = JSON.parse(readFileSync(join(fx, "reference-brief.json"), "utf8"));
const bundle: Bundle = JSON.parse(readFileSync(join(fx, "2026-10-22/bundle.json"), "utf8"));

/** Fresh copies, so each test can mutate its own. */
export const referenceBrief = (): Brief => structuredClone(brief);
export const fixtureBundle = (): Bundle => structuredClone(bundle);
export const ctx = (b: Brief = referenceBrief(), extra: Partial<ValidateContext> = {}): ValidateContext => ({
  brief: b,
  brief_version: 1,
  guide_version: GUIDE_VERSION,
  ...extra,
});
export const card = (b: Bundle, slug: string) => {
  const c = b.cards.find((x) => x.slug === slug);
  if (!c) throw new Error(`no card ${slug}`);
  return c;
};
export const words = (n: number, w = "word") => Array.from({ length: n }, () => w).join(" ");
