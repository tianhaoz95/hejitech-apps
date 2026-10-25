// The one render function (PRD §6): bundle JSON in, card frames out. The glasses plugin pushes
// these lines into a text container, the web preview draws them in a 576 × 288 frame, and the
// validator measures them. Pure and deterministic: no DOM, no clock, no brief lookups (section
// titles come from the bundle's own edition).
import type { Bundle, CardInput, Frame } from "./types.ts";

export const LINE_WIDTH = 25;
export const MAX_LINES = 7;
export const MAX_CHARS = 150;
export const DISPLAY = { width: 576, height: 288 } as const;

/** Code points, so "♪" or "·" count as one character like on the display. */
export const len = (s: string) => [...s].length;

/** Word-wraps at spaces. A word longer than `width` keeps its own (too long) line for the validator to flag. */
export function wrap(text: string, width = LINE_WIDTH): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if (len(line) + 1 + len(w) <= width) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** `LABEL ..... VALUE` padded to the line width (one space minimum between them). */
export function metricLine(label: string, value: string, width = LINE_WIDTH): string {
  const l = label.toUpperCase(), v = value;
  const gap = width - len(l) - len(v);
  return gap >= 3 ? `${l} ${".".repeat(gap - 2)} ${v}` : `${l} ${v}`;
}

export function audioFooter(card: Pick<CardInput, "glance" | "deep_dive">): string {
  if (card.deep_dive) return `♪ DEEP DIVE ${Math.max(1, Math.round(card.deep_dive.duration_sec / 60))} MIN`;
  if (card.glance) return `♪ ${Math.max(1, Math.round(card.glance.duration_sec))}S · NO DEEP DIVE`;
  return "NO AUDIO";
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** "THU OCT 22" for 2026-10-22 (calendar date, no time zone involved). */
export function dateKicker(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Card id: `<date>-<slug>` (deterministic, so a rebuilt edition upserts the same cards). */
export const cardId = (date: string, slug: string) => `${date}-${slug}`;

function kicker(bundle: Bundle, card: CardInput, index: number): string {
  switch (card.kind) {
    case "cover":
      return dateKicker(bundle.date);
    case "tldr":
      return "TL;DR";
    case "end":
      return "END";
    case "section": {
      const section = bundle.edition.sections.find((s) => s.section_id === card.section_id);
      const title = (section?.title ?? card.section_id ?? "").toUpperCase();
      if (card.alert) return `ALERT · ${title}`;
      const peers = bundle.cards.filter((c) => c.kind === "section" && !c.alert && c.section_id === card.section_id);
      const n = peers.indexOf(card) + 1;
      return peers.length > 1 ? `${title} ${n}/${peers.length}` : title;
    }
  }
  return String(index + 1);
}

function footer(bundle: Bundle, card: CardInput): string {
  if (card.kind === "cover") {
    const audio = bundle.cards.reduce((s, c) => s + (c.glance?.duration_sec ?? 0) + (c.deep_dive?.duration_sec ?? 0), 0);
    return audio ? `${bundle.cards.length} CARDS · ${Math.round(audio / 60)} MIN AUDIO` : `${bundle.cards.length} CARDS`;
  }
  if (card.kind === "end" && !card.glance && !card.deep_dive) return "DOUBLE-TAP TO EXIT";
  return audioFooter(card);
}

export function renderCard(bundle: Bundle, card: CardInput, index: number): Frame {
  const lines = [kicker(bundle, card, index), ...wrap(card.title)];
  if (card.template === "metric") for (const m of card.metrics ?? []) lines.push(metricLine(m.label, m.value));
  lines.push(...wrap(card.body));
  if (card.method_keyword) lines.push(card.method_keyword.toUpperCase());
  const f = footer(bundle, card);
  lines.push(f);
  return {
    id: cardId(bundle.date, card.slug),
    slug: card.slug,
    kind: card.kind,
    section_id: card.section_id,
    lines,
    footer: f,
    has_glance: Boolean(card.glance),
    has_deep_dive: Boolean(card.deep_dive),
  };
}

/** Every card of the bundle, in order. The plugin and the preview both show exactly these. */
export function render(bundle: Bundle): Frame[] {
  return bundle.cards.map((c, i) => renderCard(bundle, c, i));
}

/** The frame's text as one string, as pushed to the glasses' text container. */
export const frameText = (lines: string[]) => lines.join("\n");

/** ASCII picture of every frame (for run logs, the publish snapshot and tests). */
export function snapshot(frames: Frame[]): string {
  const w = LINE_WIDTH;
  const out: string[] = [];
  frames.forEach((f, i) => {
    out.push(`#${i + 1} ${f.id}`);
    out.push("┌" + "─".repeat(w + 2) + "┐");
    for (const l of f.lines) out.push("│ " + l + " ".repeat(Math.max(0, w - len(l))) + " │");
    for (let k = f.lines.length; k < MAX_LINES; k++) out.push("│ " + " ".repeat(w) + " │");
    out.push("└" + "─".repeat(w + 2) + "┘");
  });
  return out.join("\n");
}
