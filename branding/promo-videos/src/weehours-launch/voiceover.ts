// Word timings for the captions, in seconds. Narration lines (vo-am_fenrir-<key>.wav, Kokoro-82M) are
// timed from the start of their file; the characters' own lines (feed, fed, twoten, snoring, bottle,
// cookies) from the start of their Flow shot. Times come from a faster-whisper pass (the Flow lines
// checked against the shots' loudness, since whisper starts a first word early); redo them if a file
// changes.
export type Word = [text: string, start: number, end: number];

export const LINES: Record<string, Word[]> = {
  // Flow shot 1, Jun
  feed: [
    ["Huh?", 4.2, 4.6],
    ["Did", 5.5, 5.58],
    ["I", 5.58, 5.72],
    ["feed", 5.72, 5.96],
    ["her?", 5.96, 6.2],
  ],
  // Flow shot 2, Jun and Mei together
  fed: [
    ["I", 3.1, 3.36],
    ["fed", 3.36, 3.6],
    ["her.", 3.6, 3.9],
  ],
  // Flow shot 3, Doudou
  twoten: [
    ["Two-ten.", 0.1, 0.8],
    ["Left", 1.6, 1.8],
    ["side.", 1.8, 2.3],
  ],
  snoring: [
    ["You", 3.8, 4.04],
    ["were", 4.04, 4.16],
    ["snoring.", 4.16, 4.9],
  ],
  // Flow shot 4, Jun to his watch
  bottle: [
    ["Bottle,", 3.1, 3.4],
    ["ninety", 3.8, 4.1],
    ["mils.", 4.1, 4.6],
  ],
  // Flow shot 7, Doudou to her watch
  cookies: [
    ["Two", 1.9, 2.14],
    ["cookies.", 2.14, 2.7],
    ["Logged.", 2.9, 3.35],
  ],
  // narration, Jun (am_fenrir)
  nobody: [
    ["At", 0.0, 0.3],
    ["three", 0.3, 0.52],
    ["a.m.,", 0.52, 1.06],
    ["nobody", 1.06, 1.24],
    ["remembers", 1.24, 1.64],
    ["anything.", 1.64, 2.02],
  ],
  watch: [
    ["Now", 0.0, 0.4],
    ["I", 0.4, 0.6],
    ["just", 0.6, 0.8],
    ["whisper", 0.8, 1.14],
    ["to", 1.14, 1.3],
    ["my", 1.3, 1.46],
    ["watch.", 1.46, 1.78],
    ["My", 2.1, 2.2],
    ["phone", 2.2, 2.46],
    ["understands", 2.46, 2.92],
    ["it,", 2.92, 3.18],
    ["right", 3.18, 3.38],
    ["there.", 3.38, 3.7],
  ],
  mei: [
    ["My", 0.0, 0.3],
    ["wife", 0.3, 0.52],
    ["sees", 0.52, 0.78],
    ["it", 0.78, 0.9],
    ["on", 0.9, 1.04],
    ["hers,", 1.04, 1.26],
    ["and", 1.26, 1.54],
    ["goes", 1.54, 1.74],
    ["back", 1.74, 2.04],
    ["to", 2.04, 2.26],
    ["sleep.", 2.26, 2.52],
  ],
  tilt: [
    ["Baby", 0.0, 0.38],
    ["asleep?", 0.38, 0.7],
    ["Not", 0.7, 0.92],
    ["a", 0.92, 1.06],
    ["word.", 1.06, 1.24],
    ["I", 1.38, 1.48],
    ["just", 1.48, 1.62],
    ["tilt", 1.62, 1.84],
    ["my", 1.84, 2.02],
    ["wrist.", 2.02, 2.28],
  ],
  tag: [
    ["Wee", 0.0, 0.36],
    ["Hours.", 0.36, 0.64],
    ["A", 0.84, 0.9],
    ["newborn", 0.9, 1.14],
    ["log", 1.14, 1.44],
    ["built", 1.44, 1.66],
    ["for", 1.66, 1.86],
    ["three", 1.86, 2.12],
    ["a.m.", 2.12, 2.52],
  ],
  whisper: [
    ["Now", 0.0, 0.36],
    ["I", 0.36, 0.5],
    ["just", 0.5, 0.64],
    ["whisper", 0.64, 0.92],
    ["to", 0.92, 1.1],
    ["my", 1.1, 1.24],
    ["watch,", 1.24, 1.54],
    ["and", 1.54, 1.82],
    ["Wee", 1.82, 1.98],
    ["Hours", 1.98, 2.32],
    ["logs", 2.32, 2.64],
    ["it.", 2.64, 2.9],
  ],
  both: [
    ["We", 0.0, 0.3],
    ["both", 0.3, 0.5],
    ["see", 0.5, 0.74],
    ["it,", 0.74, 0.9],
    ["and", 0.9, 1.06],
    ["we", 1.06, 1.2],
    ["both", 1.2, 1.38],
    ["go", 1.38, 1.6],
    ["back", 1.6, 1.82],
    ["to", 1.82, 2.02],
    ["sleep.", 2.02, 2.32],
  ],
};

// The music's beats in each cut's own time (librosa on 30-sec-music-take-2.mp3 and
// 15-sec-music-take-2.mp3, mapped through the splices in Composition.tsx's MUSIC_30 / MUSIC_15).
export const BEATS_30 = [
  0.49, 1.09, 1.72, 2.35, 2.93, 3.48, 4.06, 4.62, 5.2, 5.78, 6.34, 6.9, 7.48,
  8.03, 8.62, 9.2, 9.78, 10.33, 10.89, 11.45, 12.03, 12.61, 13.17, 13.75, 14.33,
  14.91, 15.49, 16.05, 16.63, 17.21, 17.79, 18.34, 18.92, 19.48, 20.06, 20.64,
  21.2, 21.78, 22.34, 22.92, 23.5, 24.06, 24.57, 25.1, 25.77, 26.36, 26.91,
  27.49, 28.05, 28.61, 29.19, 29.75,
];
export const BEATS_15 = [
  0.02, 0.6, 1.18, 1.73, 2.31, 2.87, 3.45, 4.01, 4.59, 5.17, 5.75, 6.31, 6.89,
  7.45, 8.0, 8.58, 9.16, 10.44, 11.05, 11.6, 12.18, 12.74, 13.32, 13.88, 14.46,
];
