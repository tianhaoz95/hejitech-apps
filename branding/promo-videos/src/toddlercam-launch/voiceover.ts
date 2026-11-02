// Word timings for the captions, in seconds. Narration lines (vo-af_heart-<key>.wav, Kokoro-82M) are
// timed from the start of their file; the characters' own lines (milo, look, mine, mommy, quack) from
// the start of their Flow shot. Times come from a faster-whisper pass (medium.en), the Flow lines
// checked against the shots' loudness (whisper starts a first word early); redo them if a file changes.
export type Word = [text: string, start: number, end: number];

export const LINES: Record<string, Word[]> = {
  // Flow shot 1, Nora
  milo: [["Milo!", 1.75, 2.6]],
  look: [
    ["Look", 3.0, 3.18],
    ["at", 3.18, 3.4],
    ["Mommy!", 3.4, 3.95],
  ],
  // Flow shot 2, Milo
  mine: [["Mine!", 4.3, 5.0]],
  // Flow shot 7, Milo, then Nora
  mommy: [["Mommy!", 1.3, 2.2]],
  quack: [["Quack.", 3.65, 3.95]],
  // narration, Nora (af_heart)
  photos: [
    ["Four", 0.0, 0.3],
    ["hundred", 0.3, 0.64],
    ["photos", 0.64, 1.28],
    ["of", 1.28, 1.56],
    ["the", 1.56, 1.66],
    ["back", 1.66, 1.84],
    ["of", 1.84, 1.98],
    ["his", 1.98, 2.08],
    ["head.", 2.08, 2.34],
  ],
  camera: [
    ["So", 0.0, 0.4],
    ["we", 0.4, 0.52],
    ["gave", 0.52, 0.72],
    ["him", 0.72, 0.92],
    ["his", 0.92, 1.1],
    ["own", 1.1, 1.3],
    ["camera.", 1.3, 1.68],
  ],
  both: [
    ["Both", 0.0, 0.5],
    ["cameras", 0.5, 0.9],
    ["at", 0.9, 1.08],
    ["once:", 1.08, 1.34],
    ["what", 1.7, 1.78],
    ["he", 1.78, 1.88],
    ["sees,", 1.88, 2.22],
    ["and", 2.22, 2.4],
    ["his", 2.4, 2.54],
    ["face.", 2.54, 2.84],
  ],
  remote: [
    ["My", 0.0, 0.44],
    ["watch", 0.44, 0.7],
    ["is", 0.7, 0.84],
    ["the", 0.84, 0.96],
    ["remote.", 0.96, 1.28],
    ["One", 1.66, 1.78],
    ["tap,", 1.78, 2.08],
  ],
  snap: [
    ["he", 0.0, 0.46],
    ["looks.", 0.46, 0.68],
    ["Snap.", 0.68, 1.08],
  ],
  bubbles: [
    ["He", 0.0, 0.36],
    ["can", 0.36, 0.48],
    ["tap", 0.48, 0.72],
    ["all", 0.72, 0.86],
    ["he", 0.86, 1.0],
    ["likes.", 1.0, 1.28],
    ["It", 1.54, 1.64],
    ["only", 1.64, 1.86],
    ["makes", 1.86, 2.14],
    ["bubbles.", 2.14, 2.46],
  ],
  account: [
    ["No", 0.0, 0.5],
    ["account,", 0.5, 0.8],
    ["no", 0.96, 1.02],
    ["ads.", 1.02, 1.34],
    ["It", 1.66, 1.76],
    ["all", 1.76, 1.9],
    ["stays", 1.9, 2.18],
    ["on", 2.18, 2.34],
    ["the", 2.34, 2.46],
    ["phone.", 2.46, 2.72],
  ],
  tag: [
    ["ToddlerCam.", 0.0, 0.9],
    ["A", 1.36, 1.48],
    ["camera", 1.48, 1.78],
    ["for", 1.78, 1.98],
    ["little", 1.98, 2.14],
    ["hands,", 2.14, 2.56],
    ["and", 2.56, 2.72],
    ["a", 2.72, 2.82],
    ["remote", 2.82, 3.12],
    ["on", 3.12, 3.3],
    ["yours.", 3.3, 3.58],
  ],
  camera15: [
    ["So", 0.0, 0.4],
    ["we", 0.4, 0.5],
    ["gave", 0.5, 0.7],
    ["him", 0.7, 0.86],
    ["his", 0.86, 0.98],
    ["own", 0.98, 1.16],
    ["camera.", 1.16, 1.6],
    ["Both", 2.08, 2.2],
    ["sides", 2.2, 2.56],
    ["at", 2.56, 2.7],
    ["once.", 2.7, 3.02],
  ],
};

// The music's beats in each cut's own time (librosa beat tracking on the track, mapped through the
// cut's music parts in Composition.tsx). Cuts snap to these.
export const BEATS_30 = [0.11, 0.67, 1.2, 1.74, 2.27, 2.83, 3.36, 3.9, 4.45, 4.99, 5.5, 5.94, 6.36, 6.87, 7.43, 7.96, 8.49, 9.03, 9.58, 10.12, 10.67, 11.18, 11.74, 12.3, 12.83, 13.37, 13.91, 14.46, 15.0, 15.53, 16.07, 16.62, 17.16, 17.69, 18.22, 18.78, 19.32, 19.85, 20.4, 20.87, 21.31, 21.86, 22.4, 22.93, 23.47, 24.02, 24.56, 25.09, 25.63, 26.18, 26.72, 27.25, 27.79, 28.34, 28.88];
export const BEATS_15 = [0.09, 0.68, 1.26, 1.84, 2.44, 3.04, 3.62, 4.2, 4.79, 5.37, 5.95, 6.55, 6.95, 7.53, 8.13, 8.71, 9.32, 9.9, 10.5, 11.12, 11.7, 12.28, 12.89, 13.47, 14.07, 14.65];
