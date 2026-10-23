import { describe, expect, it } from "vitest";
import { audioPaths, numbersIn, previewHash, validate } from "../src/validate.ts";
import type { Brief, Bundle } from "../src/types.ts";
import { card, ctx, fixtureBundle, referenceBrief, words } from "./helpers.ts";

const codes = (b: unknown, brief: Brief = referenceBrief(), extra = {}) => validate(b, ctx(brief, extra)).errors.map((e) => e.code);

describe("the 2026-10-22 fixture", () => {
  it("passes with no errors and no warnings", () => {
    const r = validate(fixtureBundle(), ctx());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.frames).toHaveLength(7);
    expect(r.snapshot).toContain("RFD4-Proteina");
  });
  it("passes the upload check when every file is there", () => {
    const b = fixtureBundle();
    expect(validate(b, ctx(undefined, { uploaded: new Set(audioPaths(b)) })).errors).toEqual([]);
  });
});

/** One fixture per hard rule (PRD §13): a single mutation of the passing fixture, and the code it must raise. */
const cases: [code: string, what: string, mutate: (b: Bundle, brief: Brief) => unknown, extra?: object][] = [
  ["E_SHAPE", "cards missing", (b) => ({ ...b, cards: undefined })],
  ["E_SHAPE", "not an object", () => "bundle"],
  ["E_DATE", "impossible date", (b) => { b.date = "2026-02-30"; }],
  ["E_GUIDE_STALE", "old guide version", (b) => { b.guide_version = "0.1"; }],
  ["E_BRIEF_STALE", "old brief version", (b) => { b.brief_version = 0; }],
  ["E_EDITION_EMPTY", "no edition text", (b) => { for (const s of b.edition.sections) s.body = ""; }],
  ["E_EDITION_EMPTY", "section card without its edition section", (b) => { b.edition.sections = b.edition.sections.filter((s) => s.section_id !== "markets"); }],
  ["E_UNKNOWN_SECTION", "section not in the brief", (b) => { card(b, "markets-close").section_id = "sports"; }],
  ["E_COVER", "no cover", (b) => { b.cards.shift(); }],
  ["E_END", "no end", (b) => { b.cards.pop(); }],
  ["E_TLDR", "TL;DR missing while the brief asks for it", (b) => { b.cards = b.cards.filter((c) => c.kind !== "tldr"); }],
  ["E_TLDR", "TL;DR present while the brief turns it off", (_b, brief) => { brief.tldr = false; }],
  ["E_ORDER", "sections out of brief order", (b) => { const m = b.cards.splice(5, 1)[0]; b.cards.splice(2, 0, m); }],
  ["E_ORDER", "alert after the TL;DR", (b) => { Object.assign(card(b, "providers-quiet"), { quiet: false, alert: true, title: "Outage hits 40% of users", body: "Status page confirms it.", key_number: "40%" }); b.edition.sections[0].body += " 40%"; }],
  ["E_TEMPLATE", "wrong template for the section", (b) => { card(b, "proteina-binders").template = "note"; }],
  ["E_SLUG", "duplicate slug", (b) => { card(b, "open-coder-speed").slug = "proteina-binders"; }],
  ["E_SLUG", "not kebab-case", (b) => { card(b, "cover").slug = "Cover Card"; }],
  ["E_LINES", "too many lines", (b) => { card(b, "proteina-binders").body = "Far fewer lab tries per working design, which changes the arithmetic of every project."; }],
  ["E_LINE_WIDTH", "an unbreakable word", (b) => { card(b, "markets-close").body = "Supercalifragilisticexpialidocious."; }],
  ["E_CHARS", "too many characters", (b) => { Object.assign(card(b, "cover"), { title: "Afternoonish brieflings Afternoonish brieflings", body: "Quietnessful providership Quietnessful providership Quietnessful providership." }); }],
  ["E_URL", "a URL on a card", (b) => { card(b, "markets-close").body = "See example.com now."; }],
  ["E_MARKDOWN", "markdown on a card", (b) => { card(b, "markets-close").body = "**Bond** yields jumped."; }],
  ["E_EMOJI", "emoji on a card", (b) => { card(b, "markets-close").body = "Bond yields jumped 📈"; }],
  ["E_CITATION", "a citation on a card", (b) => { card(b, "markets-close").body = "Bond yields jumped [1]."; }],
  ["E_KEY_NUMBER", "no key number", (b) => { delete card(b, "open-coder-speed").key_number; }],
  ["E_KEY_NUMBER", "key number not on the card", (b) => { card(b, "open-coder-speed").key_number = "4x"; b.edition.sections[1].body += " 4x"; }],
  ["E_KEY_NUMBER_EDITION", "key number not in the edition (cross-check)", (b) => { Object.assign(card(b, "open-coder-speed"), { title: "Open coding model runs 5x faster", key_number: "5x" }); }],
  ["E_EXTRA_NUMBER", "a second number", (b) => { card(b, "open-coder-speed").body = "Same scores, 2 GPUs fewer."; }],
  ["E_EXTRA_NUMBER", "a year counts", (b) => { card(b, "open-coder-speed").body = "Fastest open coder of 2026."; }],
  ["E_METRICS", "four metric lines", (b) => { card(b, "markets-close").metrics!.push({ label: "Gold", value: "-1.2%" }); }],
  ["E_METRICS", "metric value not in the edition", (b) => { card(b, "markets-close").metrics![0].value = "-9.9%"; }],
  ["E_METHOD_KEYWORD", "discovery card without keyword", (b) => { delete card(b, "open-coder-speed").method_keyword; }],
  ["E_METHOD_KEYWORD", "keyword over four words", (b) => { card(b, "open-coder-speed").method_keyword = "draft and verify decoding trick"; }],
  ["E_CARD_BUDGET", "over the card budget", (_b, brief) => { brief.total_card_budget = 6; }],
  ["E_AUDIO_BUDGET", "over the audio budget", (_b, brief) => { brief.total_audio_budget_sec = 200; }],
  ["E_MAX_CARDS", "over a section's max_cards", (_b, brief) => { brief.sections[1].max_cards = 1; }],
  ["E_CUT", "later section kept while an earlier one was cut", (b) => { b.cut = [{ section_id: "breakthroughs", slug: "third-item", reason: "card budget" }]; }],
  ["E_CUT", "cut without a reason", (b) => { b.cut = [{ section_id: "markets", reason: "" }]; }],
  ["E_ALERT_CUT", "an alert was cut", (b) => { b.cut = [{ section_id: "markets", reason: "budget", alert: true }]; }],
  ["E_QUIET", "show_status section left empty", (b) => { b.cards = b.cards.filter((c) => c.section_id !== "providers"); }],
  ["E_QUIET", "show_last section left empty", (b) => { b.cards = b.cards.filter((c) => c.section_id !== "markets"); }],
  ["E_QUIET", "quiet card in an omit section", (b) => { Object.assign(card(b, "open-coder-speed"), { quiet: true }); }],
  ["E_QUIET", "carried card from a later date", (b) => { card(b, "markets-close").carried_from = "2026-10-23"; }],
  ["E_GLANCE_REQUIRED", "missing glance", (b) => { delete card(b, "markets-close").glance; }],
  ["E_DEEP_DIVE_REQUIRED", "missing deep dive (required)", (b) => { delete card(b, "proteina-binders").deep_dive; }],
  ["E_DEEP_DIVE_FORBIDDEN", "deep dive in a never section", (b) => { card(b, "markets-close").deep_dive = { ...card(b, "proteina-binders").deep_dive!, audio_path: "2026-10-22/markets-close-deep-dive.mp3" }; }],
  ["E_GLANCE_WORDS", "glance over 75 words", (b) => { card(b, "markets-close").glance!.script = words(76); card(b, "markets-close").glance!.duration_sec = 30; }],
  ["E_DEEP_DIVE_WORDS", "deep dive too short", (b) => { card(b, "proteina-binders").deep_dive!.script = words(300); }],
  ["E_DEEP_DIVE_WORDS", "deep dive too long", (b) => { card(b, "proteina-binders").deep_dive!.script = words(800); }],
  ["E_SCRIPT_NUMBER", "currency symbol in a script", (b) => { card(b, "markets-close").glance!.script += " Fund raised $26B."; }],
  ["E_SCRIPT_NUMBER", "magnitude suffix in a script", (b) => { card(b, "markets-close").glance!.script += " About 26B in trades."; }],
  ["E_SCRIPT_URL", "URL in a script", (b) => { card(b, "markets-close").glance!.script += " Read more at https://example.org."; }],
  ["E_SCRIPT_CITATION", "citation in a script", (b) => { card(b, "markets-close").glance!.script += " As shown in [2]."; }],
  ["E_AUDIO_SHAPE", "no duration", (b) => { (card(b, "markets-close").glance as { duration_sec?: number }).duration_sec = undefined; }],
  ["E_AUDIO_PATH", "path not named after the card", (b) => { card(b, "markets-close").glance!.audio_path = "2026-10-22/other-glance.mp3"; }],
  ["E_AUDIO_MISSING", "file not uploaded", () => undefined, { uploaded: new Set<string>() }],
];

describe("validate_cards blocks each hard rule", () => {
  it.each(cases)("%s: %s", (code, _what, mutate, extra = {}) => {
    const b = fixtureBundle();
    const brief = referenceBrief();
    const replaced = mutate(b, brief);
    expect(codes(replaced === undefined ? b : replaced, brief, extra)).toContain(code);
  });

  it("covers every error code the guide lists", async () => {
    const { GUIDE } = await import("../src/guide.gen.ts");
    const listed = new Set([...GUIDE.matchAll(/`(E_[A-Z_]+)`/g)].map((m) => m[1]));
    listed.delete("E_NO_PREVIEW"); // a publish rule: services/web tests it
    const tested = new Set(cases.map((c) => c[0]));
    expect([...listed].filter((c) => !tested.has(c))).toEqual([]);
  });
});

describe("warnings", () => {
  it("flags a glance that reads the card aloud", () => {
    const b = fixtureBundle();
    const c = card(b, "open-coder-speed");
    c.glance!.script = "Open coding model runs 3x faster. Same scores, a fraction of the compute.";
    const r = validate(b, ctx());
    expect(r.warnings.map((w) => w.code)).toContain("W_READ_ALOUD");
    expect(r.ok).toBe(true);
  });
  it("flags an implausible duration", () => {
    const b = fixtureBundle();
    card(b, "markets-close").glance!.duration_sec = 1;
    expect(validate(b, ctx()).warnings.map((w) => w.code)).toContain("W_DURATION");
  });
});

describe("rules that must not fire", () => {
  it("allows a quiet day for an omit section", () => {
    const b = fixtureBundle();
    b.cards = b.cards.filter((c) => c.section_id !== "breakthroughs");
    b.cards.find((c) => c.kind === "tldr")!.title = "Protein binders hit 41%";
    expect(codes(b)).toEqual([]);
  });
  it("accepts an alert ahead of the TL;DR with its deep dive (on_alert)", () => {
    const b = fixtureBundle();
    const q = card(b, "providers-quiet");
    Object.assign(q, { slug: "providers-outage", quiet: false, alert: true, title: "Report: outage hits 40% of jobs", body: "The company hasn't confirmed it.", key_number: "40%" });
    q.glance!.audio_path = "2026-10-22/providers-outage-glance.mp3";
    q.deep_dive = { ...card(b, "proteina-binders").deep_dive!, audio_path: "2026-10-22/providers-outage-deep-dive.mp3" };
    b.edition.sections[0].body = "An outage report says 40% of jobs failed.";
    b.edition.sections[0].methodology = "What failed and why.";
    b.edition.sections[0].sources = [{ title: "Report", url: "https://example.org/r" }];
    b.cards.splice(b.cards.indexOf(q), 1);
    b.cards.splice(1, 0, q);
    expect(codes(b)).toEqual([]);
  });
  it("accepts a carried card for show_last", () => {
    const b = fixtureBundle();
    const m = card(b, "markets-close");
    m.carried_from = "2026-10-21";
    m.glance!.audio_path = "2026-10-21/markets-close-glance.mp3";
    expect(codes(b)).toEqual([]);
  });
});

describe("numbers", () => {
  it("treats digits inside names as names", () => {
    expect(numbersIn("RFD4-Proteina on G2 v4")).toEqual([]);
    expect(numbersIn("up 41% to $2.1B in 2026, 3x")).toEqual(["41%", "$2.1B", "2026", "3x"]);
  });
});

describe("previewHash", () => {
  it("is stable across key order and changes with content", async () => {
    const a = fixtureBundle();
    const reordered = JSON.parse(JSON.stringify(a, Object.keys(a).reverse()));
    expect(await previewHash(a)).toBe(await previewHash({ ...reordered, ...a }));
    const b = fixtureBundle();
    b.cards[0].title = "Other";
    expect(await previewHash(a)).not.toBe(await previewHash(b));
  });
});
