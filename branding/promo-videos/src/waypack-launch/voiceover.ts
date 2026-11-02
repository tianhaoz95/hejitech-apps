// Word timings for the captions, in seconds. Narration lines (vo-af_heart-<key>.wav, Kokoro-82M) are
// timed from the start of their file; the characters' own lines (bar, need, hill) from the start of
// their Flow shot (Shot_2, Shot_7). Times come from a faster-whisper pass; redo them if a file changes.
export type Word = [text: string, start: number, end: number];

export const LINES: Record<string, Word[]> = {
  signal: [
    ["Up", 0.0, 0.16],
    ["in", 0.16, 0.26],
    ["the", 0.26, 0.34],
    ["mountains,", 0.34, 0.76],
    ["there's", 1.0, 1.16],
    ["no", 1.16, 1.32],
    ["signal.", 1.32, 1.62],
  ],
  planned: [
    ["My", 0.0, 0.16],
    ["AI", 0.16, 0.48],
    ["agent", 0.48, 0.78],
    ["planned", 0.78, 1.06],
    ["this", 1.06, 1.26],
    ["trip.", 1.26, 1.6],
    ["Waypack", 2.02, 2.28],
    ["keeps", 2.28, 2.56],
    ["it", 2.56, 2.72],
    ["working", 2.72, 2.96],
    ["offline.", 2.96, 3.36],
  ],
  agent: [
    ["My", 0.0, 0.16],
    ["agent", 0.16, 0.44],
    ["planned", 0.44, 0.68],
    ["the", 0.68, 0.84],
    ["trip.", 0.84, 1.12],
    ["Waypack", 1.52, 1.78],
    ["keeps", 1.78, 2.06],
    ["it", 2.06, 2.24],
    ["working", 2.24, 2.48],
    ["offline.", 2.48, 2.86],
  ],
  next: [
    ["What's", 0.0, 0.24],
    ["next,", 0.24, 0.4],
    ["the", 0.56, 0.58],
    ["map,", 0.58, 0.76],
    ["my", 0.9, 0.96],
    ["GPS", 0.96, 1.36],
    ["dot.", 1.36, 1.7],
    ["Zero", 2.08, 2.42],
    ["bars.", 2.42, 2.72],
  ],
  lodging: [
    ["Lodging,", 0.0, 0.42],
    ["check-in", 0.58, 0.88],
    ["times,", 0.88, 1.16],
    ["and", 1.52, 1.66],
    ["a", 1.66, 1.74],
    ["backup", 1.74, 1.98],
    ["plan", 1.98, 2.36],
    ["if", 2.36, 2.54],
    ["the", 2.54, 2.66],
    ["road", 2.66, 2.86],
    ["closes.", 2.86, 3.28],
  ],
  home: [
    ["I", 0.0, 0.14],
    ["planned", 0.14, 0.36],
    ["it", 0.36, 0.48],
    ["at", 0.48, 0.6],
    ["home", 0.6, 0.76],
    ["with", 0.76, 0.94],
    ["my", 0.94, 1.1],
    ["agent,", 1.1, 1.44],
    ["and", 1.44, 1.92],
    ["hit", 1.92, 2.1],
    ["Download", 2.1, 2.52],
    ["on", 2.52, 2.74],
    ["the", 2.74, 2.82],
    ["Wi-Fi.", 2.82, 3.2],
  ],
  tag: [
    ["Waypack.", 0.0, 0.46],
    ["Your", 0.46, 0.7],
    ["trip,", 0.7, 0.92],
    ["packed.", 0.92, 1.24],
  ],
  bar: [
    ["Does", 1.02, 1.58],
    ["anyone", 1.58, 1.76],
    ["have", 1.76, 2.04],
    ["a", 2.04, 2.2],
    ["single", 2.2, 2.42],
    ["bar?", 2.42, 2.82],
  ],
  need: [
    ["Don't", 4.34, 4.76],
    ["need", 4.76, 4.9],
    ["one.", 4.9, 5.14],
  ],
  hill: [
    ["Okay.", 4.54, 5.22],
    ["Where's", 5.9, 6.64],
    ["the", 6.64, 6.74],
    ["sledding", 6.74, 7.08],
    ["hill?", 7.08, 7.28],
  ],
};

// Beats (s) of the edited music files (music-30-edit.wav, music-15-edit.wav), librosa beat tracking.
// 30 s: the searching intro, a stop at 6.2–8.8 s, the groove from 11.25 s, the final chord ending ≈29 s.
// 15 s: the searching intro to a stop at 3.0 s, the groove from 3.25 s, ending ≈15 s.
export const BEATS_30 = [
  0.21, 0.79, 1.39, 1.95, 2.53, 3.09, 3.69, 4.27, 4.83, 5.41, 5.99, 6.57, 7.15,
  7.73, 8.31, 8.87, 9.45, 10.03, 10.61, 11.19, 11.91, 12.61, 13.19, 13.77,
  14.35, 14.93, 15.51, 16.09, 16.65, 17.23, 17.81, 18.39, 18.97, 19.55, 20.11,
  20.69, 21.27, 21.85, 22.43, 23.01, 23.59, 24.17, 24.73, 25.31, 25.89, 26.47,
  27.03, 27.61, 28.19, 28.77,
];
export const BEATS_15 = [
  1.6, 2.18, 2.72, 3.25, 3.81, 4.39, 4.95, 5.53, 6.11, 6.71, 7.29, 7.89, 8.45,
  9.06, 9.64, 10.22, 10.77, 11.35, 11.94, 12.52, 13.1, 13.65, 14.21,
];
