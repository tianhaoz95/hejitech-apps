// Word timings for the captions, in seconds. Narration lines (vo-af_sarah-<key>.wav, Kokoro-82M) are
// timed from the start of their file; the characters' own lines (sets, mine, getting) from the start of
// their Flow shot (Shot_2, Shot_7). Times come from a faster-whisper pass (first words moved to the
// measured speech onset); redo them if a file changes.
export type Word = [text: string, start: number, end: number];

export const LINES: Record<string, Word[]> = {
  guess: [
    ["Everyone", 0.45, 0.76],
    ["at", 0.76, 0.98],
    ["my", 0.98, 1.14],
    ["gym", 1.14, 1.34],
    ["is", 1.34, 1.52],
    ["guessing.", 1.52, 1.82],
  ],
  plans: [
    ["My", 0.46, 0.56],
    ["own", 0.56, 0.74],
    ["AI", 0.74, 1.08],
    ["agent", 1.08, 1.46],
    ["plans", 1.46, 1.78],
    ["my", 1.78, 1.96],
    ["workouts", 1.96, 2.28],
    ["and", 2.28, 2.48],
    ["meals.", 2.48, 2.82],
    ["FitLoop", 3.5, 3.68],
    ["puts", 3.68, 3.92],
    ["them", 3.92, 4.1],
    ["in", 4.1, 4.2],
    ["my", 4.2, 4.34],
    ["glasses.", 4.34, 4.68],
  ],
  tap: [
    ["Set", 0.47, 0.6],
    ["done?", 0.6, 0.86],
    ["One", 1.12, 1.28],
    ["tap.", 1.28, 1.54],
    ["The", 1.9, 2.0],
    ["rest", 2.0, 2.18],
    ["timer", 2.18, 2.52],
    ["starts", 2.52, 2.82],
    ["itself.", 2.82, 3.2],
  ],
  hurts: [
    ["Something", 0.46, 0.66],
    ["hurts?", 0.66, 0.96],
    ["I", 1.4, 1.44],
    ["tell", 1.44, 1.58],
    ["my", 1.58, 1.72],
    ["agent,", 1.72, 2.02],
    ["mid-set.", 2.02, 2.54],
  ],
  reads: [
    ["It", 0.45, 0.52],
    ["reads", 0.52, 0.74],
    ["everything", 0.74, 1.12],
    ["back,", 1.12, 1.48],
    ["and", 1.48, 1.86],
    ["adjusts", 1.86, 2.18],
    ["tomorrow's", 2.18, 2.76],
    ["plan.", 2.76, 3.02],
  ],
  tag: [
    ["Your", 0.45, 0.52],
    ["agent", 0.52, 0.82],
    ["coaches.", 0.82, 1.26],
    ["FitLoop", 1.26, 1.96],
    ["keeps", 1.96, 2.24],
    ["you", 2.24, 2.4],
    ["on", 2.4, 2.5],
    ["the", 2.5, 2.6],
    ["plan.", 2.6, 2.88],
  ],
  puts: [
    ["FitLoop", 0.49, 0.78],
    ["puts", 0.78, 1.02],
    ["my", 1.02, 1.22],
    ["plan", 1.22, 1.46],
    ["in", 1.46, 1.58],
    ["my", 1.58, 1.7],
    ["glasses.", 1.7, 2.1],
  ],
  sets: [
    ["Wait,", 1.2, 1.6],
    ["how", 1.82, 1.94],
    ["many", 1.94, 2.1],
    ["sets", 2.1, 2.36],
    ["is", 2.36, 2.56],
    ["this?", 2.56, 2.78],
  ],
  mine: [
    ["My", 5.45, 5.66],
    ["agent", 5.66, 5.98],
    ["wrote", 5.98, 6.22],
    ["mine.", 6.22, 6.5],
  ],
  getting: [
    ["Okay.", 5.45, 5.78],
    ["I'm", 6.46, 6.66],
    ["getting", 6.66, 6.8],
    ["an", 6.8, 6.96],
    ["agent.", 6.96, 7.28],
  ],
};

// Beats (s) of the edited music files (music-30-edit.wav, music-15-edit.wav), librosa beat tracking.
export const BEATS_30 = [
  0.81, 1.39, 1.97, 2.55, 3.11, 3.69, 4.25, 4.83, 5.41, 5.97, 6.52, 7.11, 7.66,
  8.24, 8.8, 9.38, 9.96, 10.52, 11.1, 11.66, 12.24, 12.82, 13.37, 13.96, 14.54,
  15.09, 15.67, 16.25, 16.81, 17.37, 17.95, 18.53, 19.09, 19.67, 20.25, 20.81,
  21.39, 21.94, 22.52, 23.1, 23.68, 24.26, 24.8, 25.38, 25.96, 26.52, 27.1,
  27.65, 28.24, 28.82, 29.37, 29.95,
];
export const BEATS_15 = [
  0.58, 1.16, 1.76, 2.35, 2.9, 3.48, 4.06, 4.64, 5.22, 5.8, 6.39, 6.97, 7.55,
  8.15, 8.73, 9.31, 9.89, 10.47, 11.1, 11.75, 12.35, 12.98, 13.58, 14.16, 14.74,
];
