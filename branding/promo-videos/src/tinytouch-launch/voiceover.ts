// Word timings for the captions, in seconds. Narration lines (vo-am_echo-<key>.wav, Kokoro-82M) are
// timed from the start of their file, from a faster-whisper pass, with the script's words (Whisper
// splits "TinyTouch" and "three-second" and hears "Swipes in the crown"); the characters' own lines
// (please, hi, boss, twice, zero) from the start of their Flow shot, checked against the shots'
// loudness since Whisper starts a first word early. Redo them if a file changes.
export type Word = [text: string, start: number, end: number];

export const LINES: Record<string, Word[]> = {
  // Flow shot 1, Leo
  please: [
    ["Please", 5.35, 5.62],
    ["don't", 5.62, 5.85],
    ["call", 5.85, 6.05],
    ["anyone.", 6.05, 6.45],
  ],
  // Flow shot 2, Pip
  hi: [
    ["Hiii!", 4.32, 5.0],
  ],
  // Flow shot 3, Leo
  boss: [
    ["She's", 3.28, 3.55],
    ["called", 3.55, 3.72],
    ["my", 3.72, 3.9],
    ["boss.", 3.9, 4.35],
  ],
  // Flow shot 3, Leo
  twice: [
    ["Twice.", 5.22, 5.65],
  ],
  // Flow shot 6, Leo
  zero: [
    ["Zero", 3.42, 3.85],
    ["calls.", 3.85, 4.4],
  ],
  // Narration (Leo, am_echo)
  first: [
    ["So", 0.0, 0.38],
    ["now,", 0.38, 0.64],
    ["I", 0.64, 0.84],
    ["open", 0.84, 1.14],
    ["TinyTouch", 1.14, 1.86],
    ["first.", 1.86, 2.34],
  ],
  play: [
    ["Every", 0.0, 0.5],
    ["tap", 0.5, 0.82],
    ["is", 0.82, 0.98],
    ["a", 0.98, 1.14],
    ["bubble,", 1.14, 1.38],
    ["an", 1.62, 1.74],
    ["animal,", 1.74, 2.1],
    ["a", 2.28, 2.34],
    ["note.", 2.34, 2.62],
  ],
  nothing: [
    ["Swipes", 0.0, 0.6],
    ["and", 0.6, 0.74],
    ["the", 0.74, 0.82],
    ["crown", 0.82, 1.1],
    ["are", 1.1, 1.32],
    ["part", 1.32, 1.52],
    ["of", 1.52, 1.66],
    ["the", 1.66, 1.76],
    ["game.", 1.76, 2.04],
    ["Nothing", 2.34, 2.6],
    ["gets", 2.6, 2.86],
    ["out.", 2.86, 3.16],
  ],
  phone: [
    ["From", 0.0, 0.36],
    ["my", 0.36, 0.54],
    ["phone,", 0.54, 0.8],
    ["I", 0.8, 1.02],
    ["switch", 1.02, 1.3],
    ["the", 1.3, 1.52],
    ["game,", 1.52, 1.78],
    ["or", 1.78, 2.06],
    ["start", 2.06, 2.36],
    ["the", 2.36, 2.56],
    ["lullaby.", 2.56, 2.96],
  ],
  hold: [
    ["Getting", 0.0, 0.48],
    ["out", 0.48, 0.74],
    ["takes", 0.74, 1.02],
    ["a", 1.02, 1.22],
    ["three-second", 1.22, 1.7],
    ["hold.", 1.7, 2.12],
    ["Little", 2.4, 2.52],
    ["fingers", 2.52, 2.94],
    ["can't.", 2.94, 3.4],
  ],
  tag: [
    ["TinyTouch.", 0.0, 0.86],
    ["Gentle", 0.86, 1.22],
    ["play.", 1.22, 1.48],
    ["No", 1.76, 1.88],
    ["surprise", 1.88, 2.36],
    ["calls.", 2.36, 2.82],
  ],
  turns: [
    ["TinyTouch", 0.0, 0.72],
    ["turns", 0.72, 1.06],
    ["every", 1.06, 1.38],
    ["tap", 1.38, 1.74],
    ["and", 1.74, 2.0],
    ["swipe", 2.0, 2.34],
    ["into", 2.34, 2.58],
    ["gentle", 2.58, 2.94],
    ["play.", 2.94, 3.3],
  ],
  hold15: [
    ["Getting", 0.0, 0.48],
    ["out", 0.48, 0.74],
    ["takes", 0.74, 1.06],
    ["a", 1.06, 1.32],
    ["three-second", 1.32, 1.88],
    ["hold.", 1.88, 2.3],
  ],
};
