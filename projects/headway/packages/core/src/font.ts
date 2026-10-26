// The glasses' text metrics: the firmware's one proportional font, measured in the Even Hub
// simulator (2026-10-26) by drawing each glyph 10 and 20 times and differencing the widths, and the
// line pitch of a text container (re-measure: .claude/skills/heji-even-hub-submit/measure-font).
// The screens wrap and align by these pixel widths, so what the tests check is what the glasses draw. Characters not in the
// table (the font has no backtick; accents beyond é weren't measured) count as UNKNOWN_GLYPH_PX.
export const GLYPH_PX: Record<string, number> = {
  " ": 5, "!": 4, "\"": 6, "#": 14, "$": 12, "%": 14, "&": 15, "'": 4, "(": 6, ")": 6, "*": 8,
  "+": 10, ",": 5, "-": 10, ".": 5, "/": 5, "0": 12, "1": 7, "2": 11, "3": 12, "4": 12, "5": 12,
  "6": 12, "7": 12, "8": 12, "9": 12, ":": 4, ";": 5, "<": 10, "=": 10, ">": 10, "?": 12, "@": 17,
  "A": 13, "B": 12, "C": 11, "D": 12, "E": 10, "F": 10, "G": 12, "H": 12, "I": 5, "J": 8, "K": 12,
  "L": 9, "M": 16, "N": 12, "O": 12, "P": 12, "Q": 12, "R": 12, "S": 11, "T": 10, "U": 12, "V": 13,
  "W": 16, "X": 13, "Y": 13, "Z": 12, "[": 7, "\\": 5, "]": 7, "^": 10, "_": 9, "a": 11, "b": 11,
  "c": 10, "d": 11, "e": 10, "f": 7, "g": 11, "h": 11, "i": 5, "j": 5, "k": 9, "l": 4, "m": 16,
  "n": 11, "o": 10, "p": 11, "q": 11, "r": 7, "s": 10, "t": 6, "u": 11, "v": 11, "w": 15, "x": 11,
  "y": 11, "z": 9, "{": 8, "|": 4, "}": 8, "~": 16, "£": 13, "¥": 12, "°": 7, "·": 5, "×": 10,
  "é": 10, "–": 15, "—": 15, "‘": 5, "’": 5, "“": 8, "”": 8, "•": 9, "…": 10, "€": 15, "♪": 20,
  "↑": 14, "↓": 14, "■": 20, "□": 20, "▲": 20, "▼": 20, "◆": 20, "◇": 20, "○": 20, "●": 20,
};

export const UNKNOWN_GLYPH_PX = 12;
/** Height of one text line on the glasses. */
export const LINE_PITCH_PX = 27;

/** Width in pixels of a string in the glasses' font. */
export function textPx(s: string): number {
  let w = 0;
  for (const ch of s) w += GLYPH_PX[ch] ?? UNKNOWN_GLYPH_PX;
  return w;
}

/** The bordered frame every screen is drawn in (the look other G2 apps share). */
export const FRAME = { border: 2, padding: 8, radius: 6, color: 13 } as const;
export const DISPLAY = { width: 576, height: 288 } as const;
const INSET = FRAME.border + FRAME.padding;
/** Usable line width, with ~24 px spare for real-glasses metrics. */
export const LINE_PX = DISPLAY.width - 2 * INSET - 24;
/** Lines that fit inside the frame. */
export const MAX_LINES = Math.floor((DISPLAY.height - 2 * INSET) / LINE_PITCH_PX);

/** `s` cut to fit `px` (whole characters). */
export function fitPx(s: string, px: number = LINE_PX): string {
  let w = 0, out = "";
  for (const ch of s) {
    w += GLYPH_PX[ch] ?? UNKNOWN_GLYPH_PX;
    if (w > px) break;
    out += ch;
  }
  return out;
}

/**
 * `s` padded with spaces to `px`: a column in a proportional font. Always ends in at least one space
 * (the text is cut first if it would run into the next column).
 */
export function padPx(s: string, px: number): string {
  if (!s) return " ".repeat(Math.floor(px / GLYPH_PX[" "]));
  let out = fitPx(s, px - GLYPH_PX[" "]) + " ";
  while (textPx(out) + GLYPH_PX[" "] <= px) out += " ";
  return out;
}

/** `left`, then spaces, then `right` ending at the line's right edge. */
export function spreadPx(left: string, right: string, width: number = LINE_PX): string {
  const room = width - textPx(right) - GLYPH_PX[" "];
  return right ? padPx(left, room) + " " + right : fitPx(left, width);
}

/** Words wrapped to lines of at most `px`. */
export function wrapPx(text: string, px: number = LINE_PX): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (textPx(next) <= px) line = next;
    else {
      if (line) out.push(line);
      line = fitPx(word, px);
    }
  }
  if (line) out.push(line);
  return out;
}
