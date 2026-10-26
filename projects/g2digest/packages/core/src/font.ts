// The glasses' text metrics: the firmware's one proportional font, measured in the Even Hub
// simulator (2026-10-26) by drawing each glyph 10 and 30 times and differencing the widths, and the
// line pitch of a text container. The renderer wraps by these pixel widths, so the line breaks the
// validator, the preview and the plugin compute are the ones the glasses draw. Characters not in the
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
  "é": 10, "–": 15, "—": 15, "‘": 5, "’": 5, "“": 8, "”": 8, "•": 9, "…": 10, "€": 15, "♪": 18,
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
