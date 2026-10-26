// The one render function (PRD §6): bundle JSON in, card frames out. The glasses plugin pushes
// these lines into a text container, the web preview draws them in a 576 × 288 frame, and the
// validator measures them. Pure and deterministic: no DOM, no clock, no brief lookups (section
// titles come from the bundle's own edition). Lines wrap by the glasses' own glyph widths
// (font.ts), so they use the whole width of the display.
import { LINE_PITCH_PX, textPx } from "./font.ts";
import type { Bundle, CardInput, Frame } from "./types.ts";

export const DISPLAY = { width: 576, height: 288 } as const;
/** The card's frame: border (greyscale level `color`) and padding of the one full-screen text container. */
export const FRAME = { border: 2, padding: 8, radius: 6, color: 13 } as const;
const INSET = FRAME.border + FRAME.padding;
/** The position dots' column at the frame's right edge (one ● or ○ per card, 20 px wide). */
export const DOTS_PX = 22;
/**
 * Usable line width: the frame's inner width less the dots' column and a 24 px gap, which also
 * absorbs the glasses measuring a little wider than the simulator.
 */
export const LINE_PX = DISPLAY.width - 2 * INSET - DOTS_PX - 24;
/** Lines that fit inside the frame (kicker and footer included). */
export const MAX_LINES = Math.floor((DISPLAY.height - 2 * INSET) / LINE_PITCH_PX);
export const MAX_CHARS = 150;
/** `guide_version` of the built-in tour (tour.ts), which isn't an edition. */
export const TOUR_GUIDE_VERSION = "tour";

/** Code points, so "♪" or "·" count as one character like on the display. */
export const len = (s: string) => [...s].length;

/** Word-wraps at spaces by pixel width. A word wider than `widthPx` keeps its own (too wide) line for the validator to flag. */
export function wrap(text: string, widthPx = LINE_PX): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if (textPx(`${line} ${w}`) <= widthPx) line += " " + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** `LABEL ..... VALUE` with the value at the right edge of the line (one space minimum between them). */
export function metricLine(label: string, value: string, widthPx = LINE_PX): string {
  const l = label.toUpperCase(), v = value;
  const dots = Math.floor((widthPx - textPx(`${l}  ${v}`)) / textPx("."));
  return dots >= 3 ? `${l} ${".".repeat(dots)} ${v}` : `${l} ${v}`;
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
  if (card.kind === "end" && !card.glance && !card.deep_dive) return bundle.guide_version === TOUR_GUIDE_VERSION ? "DOUBLE-TAP TO EXIT" : "SWIPE UP: ALL EDITIONS";
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

/**
 * The screen's text, as pushed to the glasses' text container: the card's lines with the footer
 * moved down to the frame's last line, so every card is laid out the same (kicker top, footer
 * bottom). No trailing newline: the firmware would show a scrollbar.
 */
export function screenText(lines: string[]): string {
  if (lines.length < 2 || lines.length >= MAX_LINES) return lines.join("\n");
  return [...lines.slice(0, -1), ...Array<string>(MAX_LINES - lines.length).fill(""), lines[lines.length - 1]].join("\n");
}

/**
 * The position dots down the frame's right edge: one row per card, ● for the card on screen and ○
 * for the others, top to bottom in reading order (swipe up moves the ● down). With more cards than
 * rows, a window that keeps the ● in view, with ↑ / ↓ standing for the cards beyond it.
 */
export function positionDots(index: number, total: number, rows = MAX_LINES): string[] {
  if (total <= 1) return [];
  const shown = Math.min(total, rows);
  const start = Math.max(0, Math.min(index - Math.floor(shown / 2), total - shown));
  return Array.from({ length: shown }, (_, k) => {
    const card = start + k;
    if (k === 0 && start > 0) return "↑";
    if (k === shown - 1 && start + shown < total) return "↓";
    return card === index ? "●" : "○";
  });
}

/** ASCII picture of every frame (for run logs, the publish snapshot and tests). Characters, not pixels: a sketch. */
export function snapshot(frames: Frame[]): string {
  const w = Math.max(25, ...frames.flatMap((f) => f.lines.map(len)));
  const out: string[] = [];
  frames.forEach((f, i) => {
    out.push(`#${i + 1} ${f.id}`);
    out.push("┌" + "─".repeat(w + 2) + "┐");
    const shown = screenText(f.lines).split("\n");
    for (const l of shown) out.push("│ " + l + " ".repeat(Math.max(0, w - len(l))) + " │");
    for (let k = shown.length; k < MAX_LINES; k++) out.push("│ " + " ".repeat(w) + " │");
    out.push("└" + "─".repeat(w + 2) + "┘");
  });
  return out.join("\n");
}
