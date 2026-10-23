// Brief config checks (guide §3.2). The web editor, the Worker (before saving) and the validator
// share them. Topics never come from here: the starter brief is a neutral example the user replaces.
import { DEEP_DIVE_POLICIES, QUIET_BEHAVIORS, SOURCE_KINDS, TEMPLATES, WEEKDAYS, type Brief, type Issue, type Section } from "./types.ts";

/** PRD §15 defaults for a new user: TL;DR on, 12 cards. */
export const DEFAULTS = { tldr: true, total_card_budget: 12, total_audio_budget_sec: 1200 } as const;

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function starterSection(n = 1): Section {
  return {
    id: `section-${n}`,
    title: `Section ${n}`,
    template: "discovery",
    source: { kind: "web_news", entities: [], query: "" },
    instructions: "Describe what counts for this section, how to rank it, and what a quiet day looks like.",
    max_cards: 3,
    quiet_behavior: "omit",
    audio: { glance: true, deep_dive: "required" },
  };
}

/** What a new user starts with: one empty section to fill in. */
export function starterBrief(timezone = "America/Los_Angeles"): Brief {
  return {
    title: "My brief",
    ...DEFAULTS,
    language: "en",
    units: { temperature: "C", distance: "km" },
    glossary: [],
    no_gloss: [],
    delivery: { time: "07:00", timezone, days: ["mon", "tue", "wed", "thu", "fri"] },
    sections: [starterSection(1)],
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const intIn = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** Every problem with a brief config; empty means it can be saved. */
export function checkBrief(b: unknown): Issue[] {
  const out: Issue[] = [];
  const bad = (code: string, message: string) => out.push({ code, message });
  if (!isObj(b)) return [{ code: "B_SHAPE", message: "brief must be an object" }];
  if (typeof b.title !== "string" || !b.title.trim()) bad("B_TITLE", "title is required");
  if (typeof b.tldr !== "boolean") bad("B_TLDR", "tldr must be true or false");
  if (!intIn(b.total_card_budget, 3, 40)) bad("B_CARD_BUDGET", "total_card_budget must be a whole number from 3 to 40 (Cover, TL;DR and End count)");
  if (!intIn(b.total_audio_budget_sec, 0, 7200)) bad("B_AUDIO_BUDGET", "total_audio_budget_sec must be 0–7200 seconds");
  if (typeof b.language !== "string" || !/^[a-z]{2}(-[A-Z]{2})?$/.test(b.language)) bad("B_LANGUAGE", "language must be a code like en or en-GB");
  const units = b.units as Record<string, unknown> | undefined;
  if (!isObj(units) || !["C", "F"].includes(units.temperature as string) || !["km", "mi"].includes(units.distance as string))
    bad("B_UNITS", "units must be { temperature: C|F, distance: km|mi }");
  if (!Array.isArray(b.glossary) || !b.glossary.every((g) => isObj(g) && typeof g.term === "string" && g.term.trim() && typeof g.gloss === "string" && g.gloss.trim()))
    bad("B_GLOSSARY", "glossary entries need a term and a gloss");
  if (!isStrArr(b.no_gloss)) bad("B_NO_GLOSS", "no_gloss must be a list of terms");
  const d = b.delivery as Record<string, unknown> | undefined;
  if (!isObj(d) || typeof d.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)) bad("B_DELIVERY", "delivery.time must be HH:MM (24h)");
  else {
    if (typeof d.timezone !== "string" || !validZone(d.timezone)) bad("B_DELIVERY", "delivery.timezone must be an IANA zone like America/Los_Angeles");
    if (!isStrArr(d.days) || !d.days.length || !d.days.every((x) => (WEEKDAYS as readonly string[]).includes(x)))
      bad("B_DELIVERY", "delivery.days must list at least one of mon…sun");
  }
  if (!Array.isArray(b.sections) || !b.sections.length) {
    bad("B_SECTIONS", "a brief needs at least one section");
    return out;
  }
  const ids = new Set<string>();
  b.sections.forEach((s: unknown, i: number) => {
    const at = (m: string) => `sections[${i}]: ${m}`;
    if (!isObj(s)) return bad("B_SECTION", at("must be an object"));
    if (typeof s.id !== "string" || !SLUG.test(s.id)) bad("B_SECTION_ID", at("id must be lowercase-kebab-case"));
    else if (ids.has(s.id)) bad("B_SECTION_ID", at(`id "${s.id}" is used twice`));
    else ids.add(s.id);
    if (typeof s.title !== "string" || !s.title.trim() || s.title.length > 18) bad("B_SECTION_TITLE", at("title is required, at most 18 characters (it's the card kicker)"));
    if (!(TEMPLATES as readonly string[]).includes(s.template as string)) bad("B_TEMPLATE", at(`template must be one of ${TEMPLATES.join(", ")}`));
    const src = s.source as Record<string, unknown> | undefined;
    if (!isObj(src) || !(SOURCE_KINDS as readonly string[]).includes(src.kind as string)) bad("B_SOURCE", at(`source.kind must be one of ${SOURCE_KINDS.join(", ")}`));
    else {
      if (src.entities !== undefined && !isStrArr(src.entities)) bad("B_SOURCE", at("source.entities must be a list"));
      if (src.query !== undefined && typeof src.query !== "string") bad("B_SOURCE", at("source.query must be text"));
      if (src.urls !== undefined && (!isStrArr(src.urls) || !src.urls.every((u) => /^https?:\/\//.test(u)))) bad("B_SOURCE", at("source.urls must be http(s) URLs"));
      if ((src.kind === "rss" || src.kind === "feed") && !(isStrArr(src.urls) && src.urls.length)) bad("B_SOURCE", at(`a ${src.kind} source needs at least one URL`));
    }
    if (typeof s.instructions !== "string") bad("B_INSTRUCTIONS", at("instructions must be text"));
    if (!intIn(s.max_cards, 1, 10)) bad("B_MAX_CARDS", at("max_cards must be 1–10"));
    if (!(QUIET_BEHAVIORS as readonly string[]).includes(s.quiet_behavior as string)) bad("B_QUIET", at(`quiet_behavior must be one of ${QUIET_BEHAVIORS.join(", ")}`));
    const a = s.audio as Record<string, unknown> | undefined;
    if (!isObj(a) || typeof a.glance !== "boolean" || !(DEEP_DIVE_POLICIES as readonly string[]).includes(a.deep_dive as string))
      bad("B_AUDIO", at(`audio must be { glance: true|false, deep_dive: ${DEEP_DIVE_POLICIES.join("|")} }`));
    if (s.template === "metric" && isObj(a) && a.deep_dive === "required") bad("B_AUDIO", at("a metric section can't require deep dives (there's no methodology to tell)"));
  });
  return out;
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** True when two configs differ (saving a different config bumps `brief_version`). */
export const briefChanged = (a: Brief, b: Brief) => canonical(a) !== canonical(b);

/** Stable JSON (sorted keys) for hashing and comparisons. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
