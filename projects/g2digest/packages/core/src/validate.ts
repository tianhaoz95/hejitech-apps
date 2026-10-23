// validate_cards (guide §7): every hard rule of the card authoring guide. Errors block publishing;
// warnings don't. Card form is measured on the rendered frames, so what passes here is exactly
// what the glasses and the preview show.
import { canonical, SLUG } from "./brief.ts";
import { len, LINE_WIDTH, MAX_CHARS, MAX_LINES, render, snapshot } from "./render.ts";
import type { Audio, Brief, Bundle, CardInput, Frame, Issue, Section } from "./types.ts";

export interface ValidateContext {
  brief: Brief;
  brief_version: number;
  guide_version: string;
  /** Audio paths that exist in storage (publish checks them); omit to skip the check (validate). */
  uploaded?: Set<string>;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  frames: Frame[];
  snapshot: string;
}

export const GLANCE_MAX_WORDS = 75;
export const DEEP_DIVE_WORDS = { min: 450, max: 750 } as const;
export const METHOD_KEYWORD_MAX_WORDS = 4;
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "opus"] as const;

const KINDS = ["cover", "tldr", "section", "end"];
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Standalone numbers: digits not glued to a preceding letter ("G2", "v4" are names, "2026" and "3x" are numbers). */
const NUMBER = /(?<![\p{L}\d.,])[$€£¥]?\d+(?:[.,]\d+)*(?:\s?%|[xX](?![\p{L}])|(?:bn|[kKmMbBtT])(?![\p{L}]))?/gu;
export const numbersIn = (s: string) => [...s.matchAll(NUMBER)].map((m) => m[0]);

const URL_RE = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|org|net|io|ai|dev|app|co|gov|edu)\b/i;
const MARKDOWN_RE = /\*\*|__|`|\[[^\]]*\]\([^)]*\)|^\s*(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s)/m;
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const CITATION_RE = /\[\d+\]|\(\s*[\p{L}][\p{L}.\s&-]+,?\s\d{4}\s*\)|\bet al\b|\bsources?:|\bvia\s@/iu;
/** Written forms a voice reads ambiguously: currency symbols, magnitude suffixes, numeric ranges. */
const SCRIPT_NUMBER_RE = /[$€£¥]\s?\d|\d(?:[.,]\d+)?\s?(?:bn|[kKmMbBtT])\b|\b\d+\s?[-–]\s?\d+\b/;

export function validate(bundle: unknown, ctx: ValidateContext): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (code: string, message: string, card?: string) => errors.push({ code, message, card });
  const warn = (code: string, message: string, card?: string) => warnings.push({ code, message, card });
  const done = (frames: Frame[] = []): ValidationResult => ({ ok: errors.length === 0, errors, warnings, frames, snapshot: snapshot(frames) });

  // ------------------------------------------------------------------ shape
  const shape = shapeProblems(bundle);
  if (shape.length) {
    shape.forEach((m) => err("E_SHAPE", m));
    return done();
  }
  const b = bundle as Bundle;
  const { brief } = ctx;
  const m = b.date.match(DATE);
  const dateOk = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === b.date;
  if (!dateOk) err("E_DATE", `date "${b.date}" must be a real YYYY-MM-DD date`);

  // ------------------------------------------------------------------ versions (§6)
  if (b.guide_version !== ctx.guide_version)
    err("E_GUIDE_STALE", `built against guide ${b.guide_version}, current is ${ctx.guide_version}: fetch the guide again and rebuild`);
  if (b.brief_version !== ctx.brief_version)
    err("E_BRIEF_STALE", `built against brief version ${b.brief_version}, current is ${ctx.brief_version}: fetch the brief again and rebuild`);

  const sections = new Map(brief.sections.map((s, i) => [s.id, { s, i }]));
  const sectionOf = (c: CardInput): Section | undefined => (c.section_id ? sections.get(c.section_id)?.s : undefined);

  // ------------------------------------------------------------------ edition first (§4.1)
  const editionText = [b.edition.title, b.edition.intro ?? "", ...b.edition.sections.flatMap((s) => [s.title, s.body, s.methodology ?? ""])].join("\n");
  if (!b.edition.sections.some((s) => s.body.trim())) err("E_EDITION_EMPTY", "the full edition has no text: write it first, then derive the cards from it");
  for (const s of b.edition.sections) if (!sections.has(s.section_id)) err("E_UNKNOWN_SECTION", `edition section "${s.section_id}" isn't in the brief`);
  for (const c of b.cards) {
    if (c.kind !== "section") continue;
    if (!c.section_id || !sections.has(c.section_id)) {
      err("E_UNKNOWN_SECTION", `section "${c.section_id ?? ""}" isn't in the brief`, c.slug);
      continue;
    }
    const es = b.edition.sections.find((s) => s.section_id === c.section_id);
    if (!es || !es.body.trim()) err("E_EDITION_EMPTY", `section "${c.section_id}" has cards but no text in the full edition`, c.slug);
  }
  for (const x of b.cut ?? []) if (!sections.has(x.section_id)) err("E_UNKNOWN_SECTION", `cut entry names section "${x.section_id}", which isn't in the brief`);

  // ------------------------------------------------------------------ structure (§4.2)
  const cards = b.cards;
  const covers = cards.filter((c) => c.kind === "cover").length;
  const ends = cards.filter((c) => c.kind === "end").length;
  const tldrs = cards.filter((c) => c.kind === "tldr").length;
  if (cards[0]?.kind !== "cover" || covers !== 1) err("E_COVER", "exactly one Cover card, first");
  if (cards[cards.length - 1]?.kind !== "end" || ends !== 1) err("E_END", "exactly one End card, last");
  if (tldrs !== (brief.tldr ? 1 : 0)) err("E_TLDR", brief.tldr ? "the brief asks for one TL;DR card after the Cover" : "the brief has tldr off: no TL;DR card");
  // Cover → alerts → TL;DR → sections in brief order → End.
  const rank = (c: CardInput): number => {
    if (c.kind === "cover") return 0;
    if (c.kind === "section" && c.alert) return 1;
    if (c.kind === "tldr") return 2;
    if (c.kind === "section") return 3 + (sections.get(c.section_id ?? "")?.i ?? 0);
    return 1000;
  };
  for (let i = 1; i < cards.length; i++) {
    if (rank(cards[i]) < rank(cards[i - 1])) {
      err("E_ORDER", `"${cards[i].slug}" is out of order: Cover, alerts, TL;DR, sections in brief order, End`, cards[i].slug);
      break;
    }
  }

  // ------------------------------------------------------------------ ids (§2.5)
  const seen = new Set<string>();
  for (const c of cards) {
    if (!SLUG.test(c.slug)) err("E_SLUG", `slug "${c.slug}" must be lowercase-kebab-case`, c.slug);
    else if (seen.has(c.slug)) err("E_SLUG", `slug "${c.slug}" is used twice`, c.slug);
    seen.add(c.slug);
  }

  // ------------------------------------------------------------------ per card
  const frames = render(b);
  cards.forEach((c, i) => {
    const f = frames[i];
    const s = sectionOf(c);
    const exemptNumber = c.kind === "cover" || c.kind === "end" || c.template === "metric" || c.quiet || Boolean(c.carried_from);

    // template (§4.3)
    if (c.kind === "section" && s && c.template !== s.template) err("E_TEMPLATE", `section "${s.id}" uses the ${s.template} template, not ${c.template ?? "none"}`, c.slug);
    if (c.kind !== "section" && c.template) err("E_TEMPLATE", `${c.kind} cards have no template`, c.slug);
    if (c.alert && (c.kind !== "section" || c.template !== "status")) err("E_TEMPLATE", "only status cards can be alerts", c.slug);
    if (c.quiet && (c.kind !== "section" || c.template !== "status")) err("E_QUIET", "only status cards can be quiet cards", c.slug);

    // form (§2.1), measured on the rendered frame
    if (f.lines.length > MAX_LINES) err("E_LINES", `${f.lines.length} lines (max ${MAX_LINES}): shorten the title or body`, c.slug);
    for (const l of f.lines) if (len(l) > LINE_WIDTH) err("E_LINE_WIDTH", `"${l}" is ${len(l)} characters (max ${LINE_WIDTH})`, c.slug);
    const chars = f.lines.reduce((n, l) => n + len(l), 0);
    if (chars > MAX_CHARS) err("E_CHARS", `${chars} characters (max ${MAX_CHARS})`, c.slug);

    // never on a card (§2.4)
    const shown = [c.title, c.body, c.method_keyword ?? "", ...(c.metrics ?? []).flatMap((x) => [x.label, x.value])].join("\n");
    if (URL_RE.test(shown)) err("E_URL", "no URLs or domains on a card (sources go in the web edition)", c.slug);
    if (MARKDOWN_RE.test(shown)) err("E_MARKDOWN", "no markdown on a card", c.slug);
    if (EMOJI_RE.test(shown)) err("E_EMOJI", "no emoji on a card", c.slug);
    if (CITATION_RE.test(shown)) err("E_CITATION", "no citations on a card (they live in the web edition)", c.slug);

    // one key number (§2.3)
    const text = `${c.title}\n${c.body}`;
    if (!exemptNumber && (c.kind === "section" || c.kind === "tldr")) {
      const k = (c.key_number ?? "").trim();
      if (!k || !/\d/.test(k)) err("E_KEY_NUMBER", "needs exactly one key number (key_number)", c.slug);
      else {
        if (!text.includes(k)) err("E_KEY_NUMBER", `key number "${k}" must appear verbatim in the title or body`, c.slug);
        if (!editionText.includes(k)) err("E_KEY_NUMBER_EDITION", `key number "${k}" doesn't appear verbatim in the full edition`, c.slug);
        const extra = numbersIn(text.split(k).join(" "));
        if (extra.length) err("E_EXTRA_NUMBER", `only the key number may appear; also found ${extra.map((x) => `"${x}"`).join(", ")}`, c.slug);
      }
    }
    if (c.template === "metric") {
      const ms = c.metrics ?? [];
      if (ms.length < 1 || ms.length > 3) err("E_METRICS", "a metric card has 1–3 metric lines", c.slug);
      for (const x of ms) if (!x.value || !editionText.includes(x.value)) err("E_METRICS", `metric value "${x.value}" doesn't appear verbatim in the full edition`, c.slug);
    } else if (c.metrics?.length) err("E_METRICS", "only metric cards have metric lines", c.slug);

    // method keyword (§2.2)
    if (c.method_keyword !== undefined && (words(c.method_keyword) > METHOD_KEYWORD_MAX_WORDS || !c.method_keyword.trim()))
      err("E_METHOD_KEYWORD", `method keyword "${c.method_keyword}" must be 1–${METHOD_KEYWORD_MAX_WORDS} words`, c.slug);
    if (c.template === "discovery" && !c.carried_from && !c.method_keyword?.trim()) err("E_METHOD_KEYWORD", "every discovery card has a method/topic keyword", c.slug);

    // audio policy (§5)
    if (c.kind === "section" && s && !c.carried_from) {
      if (s.audio.glance && !c.glance) err("E_GLANCE_REQUIRED", `section "${s.id}" asks for glance audio on every card`, c.slug);
      const needsDeep = s.audio.deep_dive === "required" ? !c.quiet : s.audio.deep_dive === "on_alert" ? Boolean(c.alert) : false;
      if (needsDeep && !c.deep_dive) err("E_DEEP_DIVE_REQUIRED", `section "${s.id}" needs a deep dive on this card`, c.slug);
      if (!needsDeep && c.deep_dive && (s.audio.deep_dive === "never" || (s.audio.deep_dive === "on_alert" && !c.alert) || c.quiet))
        err("E_DEEP_DIVE_FORBIDDEN", `section "${s.id}" has no deep dive for this card (policy: ${s.audio.deep_dive})`, c.slug);
    }
    checkAudio(b, c, "glance", c.glance, ctx, err, warn);
    checkAudio(b, c, "deep_dive", c.deep_dive, ctx, err, warn);
    if (c.deep_dive && c.kind === "section") {
      const es = b.edition.sections.find((x) => x.section_id === c.section_id);
      if (!es?.methodology?.trim()) warn("W_METHODOLOGY", "deep dives are built from the edition's methodology, and this section has none", c.slug);
    }
    if (c.glance && readAloud(c.glance.script, c)) warn("W_READ_ALOUD", "the glance reads the card aloud: say what the card can't (context, who it affects, whether the deep dive is worth it)", c.slug);
    if (c.kind === "section" && !c.quiet && !c.carried_from && !c.source_url && !b.edition.sections.find((x) => x.section_id === c.section_id)?.sources.length)
      warn("W_SOURCE", "no source for this card in the card or its edition section", c.slug);
  });

  // ------------------------------------------------------------------ budgets, overflow, quiet days (§3.3, §3.4)
  if (cards.length > brief.total_card_budget) err("E_CARD_BUDGET", `${cards.length} cards, the brief's budget is ${brief.total_card_budget} (Cover, TL;DR and End count)`);
  const audioSec = cards.reduce((n, c) => n + (c.glance?.duration_sec ?? 0) + (c.deep_dive?.duration_sec ?? 0), 0);
  if (audioSec > brief.total_audio_budget_sec) err("E_AUDIO_BUDGET", `${Math.round(audioSec)} s of audio, the brief's budget is ${brief.total_audio_budget_sec} s`);
  const cut = b.cut ?? [];
  for (const x of cut) {
    if (typeof x.reason !== "string" || !x.reason.trim()) err("E_CUT", `cut entry for "${x.section_id}" needs a reason`);
    if ((x as { alert?: boolean }).alert) err("E_ALERT_CUT", `an alert in "${x.section_id}" was cut: alerts are never cut`);
  }
  let firstCut = Infinity;
  for (const x of cut) firstCut = Math.min(firstCut, sections.get(x.section_id)?.i ?? Infinity);
  brief.sections.forEach((s, i) => {
    const mine = cards.filter((c) => c.kind === "section" && c.section_id === s.id);
    if (mine.length > s.max_cards) err("E_MAX_CARDS", `section "${s.id}" has ${mine.length} cards, max_cards is ${s.max_cards} (a ceiling, never a quota)`);
    if (i > firstCut && mine.some((c) => !c.alert)) err("E_CUT", `section "${s.id}" keeps cards while the earlier section "${brief.sections[firstCut].id}" lost some: cut later sections first`);
    const wasCut = cut.some((x) => x.section_id === s.id);
    const quiet = mine.filter((c) => c.quiet);
    const carried = mine.filter((c) => c.carried_from);
    if (s.quiet_behavior === "show_status") {
      if (!mine.length && !wasCut) err("E_QUIET", `section "${s.id}" shows a quiet status card on a day without news (quiet_behavior: show_status)`);
      if (quiet.length && mine.length > 1) err("E_QUIET", `section "${s.id}": a quiet card is the section's only card`);
    } else if (quiet.length) err("E_QUIET", `section "${s.id}" has quiet_behavior ${s.quiet_behavior}: no quiet card`);
    if (s.quiet_behavior === "show_last") {
      if (!mine.length && !wasCut) err("E_QUIET", `section "${s.id}" repeats its last card on a quiet day (quiet_behavior: show_last, carried_from)`);
    } else if (carried.length) err("E_QUIET", `section "${s.id}" has quiet_behavior ${s.quiet_behavior}: no carried cards`);
    for (const c of carried) {
      if (!DATE.test(c.carried_from!) || c.carried_from! >= b.date) err("E_QUIET", `carried_from "${c.carried_from}" must be an earlier edition's date`, c.slug);
      if (mine.length > 1) err("E_QUIET", `section "${s.id}": a carried card is the section's only card`, c.slug);
    }
  });

  return done(frames);
}

function checkAudio(b: Bundle, c: CardInput, kind: "glance" | "deep_dive", a: Audio | undefined, ctx: ValidateContext,
  err: (code: string, m: string, card?: string) => void, warn: (code: string, m: string, card?: string) => void) {
  if (!a) return;
  const label = kind === "glance" ? "glance" : "deep dive";
  if (typeof a !== "object" || typeof a.script !== "string" || !a.script.trim() || typeof a.audio_path !== "string" ||
      typeof a.duration_sec !== "number" || !(a.duration_sec > 0) || a.duration_sec > 1800) {
    err("E_AUDIO_SHAPE", `${label} needs script, audio_path and duration_sec (0–1800 s)`, c.slug);
    return;
  }
  const n = words(a.script);
  if (kind === "glance" && n > GLANCE_MAX_WORDS) err("E_GLANCE_WORDS", `glance script is ${n} words (max ${GLANCE_MAX_WORDS})`, c.slug);
  if (kind === "deep_dive" && (n < DEEP_DIVE_WORDS.min || n > DEEP_DIVE_WORDS.max))
    err("E_DEEP_DIVE_WORDS", `deep-dive script is ${n} words (${DEEP_DIVE_WORDS.min}–${DEEP_DIVE_WORDS.max})`, c.slug);
  const sn = a.script.match(SCRIPT_NUMBER_RE);
  if (sn) err("E_SCRIPT_NUMBER", `${label} script writes "${sn[0]}": write numbers as spoken ("twenty-six billion dollars")`, c.slug);
  if (URL_RE.test(a.script)) err("E_SCRIPT_URL", `no URLs in the ${label} script`, c.slug);
  if (CITATION_RE.test(a.script)) err("E_SCRIPT_CITATION", `no citations in the ${label} script`, c.slug);
  const wps = n / a.duration_sec;
  if (wps > 4.5 || wps < 1.2) warn("W_DURATION", `${label}: ${n} words in ${a.duration_sec} s looks wrong: give the real duration of the file`, c.slug);
  const date = c.carried_from ?? b.date;
  const suffix = kind === "glance" ? "glance" : "deep-dive";
  const ok = new RegExp(`^${date}/${c.slug}-${suffix}\\.(?:${AUDIO_EXTENSIONS.join("|")})$`).test(a.audio_path);
  if (!ok) err("E_AUDIO_PATH", `${label} audio_path must be "${date}/${c.slug}-${suffix}.mp3" (from create_audio_upload)`, c.slug);
  else if (ctx.uploaded && !ctx.uploaded.has(a.audio_path)) err("E_AUDIO_MISSING", `${a.audio_path} wasn't uploaded`, c.slug);
}

function readAloud(script: string, c: CardInput): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const sc = norm(script);
  if (c.title.length > 12 && sc.includes(norm(c.title))) return true;
  const bodyWords = norm(c.body).split(" ").filter((w) => w.length > 3);
  if (bodyWords.length < 4) return false;
  const have = new Set(sc.split(" "));
  return bodyWords.filter((w) => have.has(w)).length / bodyWords.length > 0.8 && words(script) < bodyWords.length * 2.5;
}

function shapeProblems(v: unknown): string[] {
  const p: string[] = [];
  const o = v as Record<string, unknown>;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return ["the bundle must be an object"];
  if (typeof o.date !== "string") p.push("date must be a string (YYYY-MM-DD)");
  if (typeof o.guide_version !== "string") p.push("guide_version must be a string");
  if (typeof o.brief_version !== "number") p.push("brief_version must be a number");
  const e = o.edition as Record<string, unknown> | undefined;
  if (typeof e !== "object" || e === null || typeof e.title !== "string" || !Array.isArray(e.sections)) p.push("edition must be { title, intro?, sections: [...] }");
  else (e.sections as unknown[]).forEach((s, i) => {
    const x = s as Record<string, unknown>;
    if (typeof x !== "object" || x === null || typeof x.section_id !== "string" || typeof x.title !== "string" || typeof x.body !== "string" || !Array.isArray(x.sources))
      p.push(`edition.sections[${i}] must be { section_id, title, body, methodology?, sources: [{ title, url }] }`);
  });
  if (!Array.isArray(o.cards) || !o.cards.length) p.push("cards must be a non-empty list");
  else (o.cards as unknown[]).forEach((c, i) => {
    const x = c as Record<string, unknown>;
    if (typeof x !== "object" || x === null || typeof x.slug !== "string" || !KINDS.includes(x.kind as string) || typeof x.title !== "string" || typeof x.body !== "string")
      p.push(`cards[${i}] must have slug, kind (${KINDS.join("|")}), title and body`);
    else if (x.metrics !== undefined && !(Array.isArray(x.metrics) && x.metrics.every((m) => typeof m?.label === "string" && typeof m?.value === "string")))
      p.push(`cards[${i}].metrics must be [{ label, value }]`);
  });
  if (o.cut !== undefined && !(Array.isArray(o.cut) && o.cut.every((x) => typeof x?.section_id === "string"))) p.push("cut must be [{ section_id, slug?, reason }]");
  return p;
}

/** sha-256 of the canonical bundle: ties a publish to the validation (and preview) of that exact bundle. */
export async function previewHash(bundle: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(bundle));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Every audio path a bundle references (publish checks they were uploaded). */
export function audioPaths(b: Bundle): string[] {
  return b.cards.flatMap((c) => [c.glance?.audio_path, c.deep_dive?.audio_path]).filter((p): p is string => typeof p === "string");
}
