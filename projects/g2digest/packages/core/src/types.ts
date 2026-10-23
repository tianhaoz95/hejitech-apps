// The contracts: brief config (the user's content), bundle (one compiled edition) and the rendered
// frames. The card authoring guide (guide/card-authoring-guide.md) is the prose version of these.

export const TEMPLATES = ["status", "discovery", "metric", "agenda", "note"] as const;
export type Template = (typeof TEMPLATES)[number];

export const SOURCE_KINDS = ["web_news", "rss", "finance", "calendar", "feed"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const QUIET_BEHAVIORS = ["show_status", "omit", "show_last"] as const;
export type QuietBehavior = (typeof QUIET_BEHAVIORS)[number];

export const DEEP_DIVE_POLICIES = ["required", "on_alert", "never"] as const;
export type DeepDivePolicy = (typeof DEEP_DIVE_POLICIES)[number];

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Section {
  id: string;
  title: string;
  template: Template;
  source: { kind: SourceKind; entities?: string[]; query?: string; urls?: string[] };
  instructions: string;
  max_cards: number;
  quiet_behavior: QuietBehavior;
  audio: { glance: boolean; deep_dive: DeepDivePolicy };
}

/** A user's brief config (guide §3.2), as stored and as `get_user_brief` returns it. */
export interface Brief {
  title: string;
  tldr: boolean;
  total_card_budget: number;
  total_audio_budget_sec: number;
  language: string;
  units: { temperature: "C" | "F"; distance: "km" | "mi" };
  glossary: { term: string; gloss: string }[];
  no_gloss: string[];
  delivery: { time: string; timezone: string; days: Weekday[] };
  sections: Section[];
}

export type CardKind = "cover" | "tldr" | "section" | "end";

export interface Audio {
  script: string;
  /** Path in the app's storage bucket, relative to the user's folder: `<date>/<slug>-glance.mp3`. */
  audio_path: string;
  duration_sec: number;
}

export interface CardInput {
  slug: string;
  kind: CardKind;
  section_id?: string;
  template?: Template;
  title: string;
  body: string;
  key_number?: string;
  method_keyword?: string;
  metrics?: { label: string; value: string }[];
  alert?: boolean;
  quiet?: boolean;
  carried_from?: string;
  /** Stored for the web edition; never shown on the glasses. */
  source_url?: string;
  glance?: Audio;
  deep_dive?: Audio;
}

export interface EditionSection {
  section_id: string;
  title: string;
  body: string;
  methodology?: string;
  sources: { title: string; url: string }[];
}

/** The full web edition: everything the cards were derived from, with sources. */
export interface Edition {
  title: string;
  intro?: string;
  sections: EditionSection[];
}

export interface Bundle {
  date: string;
  guide_version: string;
  brief_version: number;
  edition: Edition;
  cards: CardInput[];
  /** Items left out for budget (logged, never silent). An alert is never cut. */
  cut?: { section_id: string; slug?: string; reason: string; alert?: boolean }[];
}

/** One screen on the glasses. `footer` is the last line, replaced by the player state while audio plays. */
export interface Frame {
  id: string;
  slug: string;
  kind: CardKind;
  section_id?: string;
  lines: string[];
  footer: string;
  has_glance: boolean;
  has_deep_dive: boolean;
}

export interface Issue {
  code: string;
  message: string;
  /** Card slug (or index) the issue is about. */
  card?: string;
}
