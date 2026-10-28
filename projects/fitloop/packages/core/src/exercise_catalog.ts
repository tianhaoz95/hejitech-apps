import { EXERCISE_DATASET_MAP } from "./exercise_catalog_data.ts";

export interface DatasetExercise {
  type: "dataset";
  slug: string;
  id: string;
  mediaId: string;
  primaryUrl: string;
  fallbackUrl: string;
}

export interface ProceduralExercise {
  type: "procedural";
  slug: string;
  preset: string;
}

export type ResolvedExercise = DatasetExercise | ProceduralExercise;

/**
 * Common colloquially-used aliases and variations mapped to standardized dataset slugs or procedural presets.
 */
export const EXERCISE_ALIASES: Record<string, string> = {
  // Procedural presets for mobility & yoga missing from standard weightlifting datasets
  "cat-cow": "cat-cow",
  "cat-cow-stretch": "cat-cow",
  "cat-and-cow": "cat-cow",
  "cat-pose": "cat-cow",
  "cow-pose": "cat-cow",
  "marjaryasana": "cat-cow",
  "bitilasana": "cat-cow",

  "bird-dog": "bird-dog",
  "bird-dog-exercise": "bird-dog",
  "birddog": "bird-dog",
  "pointer": "bird-dog",
  "quadruped-arm-leg-raise": "bird-dog",

  "childs-pose": "childs-pose",
  "child-pose": "childs-pose",
  "child-s-pose": "childs-pose",
  "balasana": "childs-pose",

  "hip-flexor-stretch": "kneeling-hip-flexor",
  "kneeling-hip-flexor": "kneeling-hip-flexor",
  "kneeling-hip-flexor-stretch": "kneeling-hip-flexor",
  "half-kneeling-hip-flexor": "kneeling-hip-flexor",
  "lunge-hip-flexor-stretch": "kneeling-hip-flexor",

  "basketball": "basketball",
  "basketball-drills": "basketball",
  "basketball-session": "basketball",

  // Popular gym exercises & colloquial shorthand
  "goblet-squat": "dumbbell-goblet-squat",
  "goblet-squats": "dumbbell-goblet-squat",
  "kettlebell-goblet-squat": "kettlebell-goblet-squat",
  "plank": "front-plank-with-twist",
  "planks": "front-plank-with-twist",
  "front-plank": "front-plank-with-twist",
  "side-plank": "bodyweight-incline-side-plank",
  "dead-bug": "dead-bug",
  "deadbug": "dead-bug",
  "squat": "band-squat",
  "squats": "band-squat",
  "air-squat": "bodyweight-squat",
  "bodyweight-squat": "bodyweight-squat",
  "bench-press": "barbell-bench-press",
  "flat-bench-press": "barbell-bench-press",
  "incline-bench-press": "barbell-incline-bench-press",
  "overhead-press": "barbell-standing-overhead-press",
  "shoulder-press": "dumbbell-standing-overhead-press",
  "military-press": "barbell-standing-overhead-press",
  "deadlift": "barbell-deadlift",
  "conventional-deadlift": "barbell-deadlift",
  "rdl": "barbell-romanian-deadlift",
  "romanian-deadlift": "barbell-romanian-deadlift",
  "barbell-row": "barbell-bent-over-row",
  "bent-over-row": "barbell-bent-over-row",
  "lat-pulldown": "cable-bar-lateral-pulldown",
  "bicep-curl": "barbell-curl",
  "biceps-curl": "barbell-curl",
  "hammer-curl": "dumbbell-hammer-curl",
  "tricep-pushdown": "cable-triceps-pushdown",
  "triceps-pushdown": "cable-triceps-pushdown",
  "skull-crusher": "barbell-lying-triceps-extension",
  "lateral-raise": "dumbbell-lateral-raise",
  "side-lateral-raise": "dumbbell-lateral-raise",
  "lunge": "dumbbell-lunge",
  "lunges": "dumbbell-lunge",
  "walking-lunge": "dumbbell-lunge",
  "push-up": "push-up",
  "pushup": "push-up",
  "push-ups": "push-up",
  "pull-up": "pull-up",
  "pullup": "pull-up",
  "pull-ups": "pull-up",
  "chin-up": "chin-up",
  "chinup": "chin-up",
  "chin-ups": "chin-up",
  "dips": "chest-dip",
  "chest-dip": "chest-dip",
  "tricep-dip": "triceps-dip",
  "glute-bridge": "bodyweight-glute-bridge",
  "hamstring-stretch": "hamstring-stretch",
  "quad-stretch": "lying-side-quads-stretch",
  "calf-stretch": "calf-stretch-with-hands-against-wall",
  "upper-back-stretch": "upper-back-stretch",
  "chest-stretch": "behind-head-chest-stretch",
  "spine-stretch": "spine-stretch",
  "upward-dog": "upward-facing-dog",
  "upward-facing-dog": "upward-facing-dog",
  "all-fours-stretch": "all-fours-squad-stretch",
};

export const PROCEDURAL_PRESETS = new Set([
  "cat-cow",
  "bird-dog",
  "childs-pose",
  "kneeling-hip-flexor",
  "basketball",
]);

export function normalizeCatalogSlug(exercise: string): string {
  return exercise
    .toLowerCase()
    .trim()
    .replace(/\.gif$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getPrimaryDatasetUrl(id: string, mediaId: string): string {
  return `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/${id}-${mediaId}.gif`;
}

export function getFallbackDatasetUrl(id: string): string {
  return `https://raw.githubusercontent.com/omercotkd/exercises-gifs/main/assets/${id}.gif`;
}

export function isProceduralPreset(slugOrName: string): boolean {
  const norm = normalizeCatalogSlug(slugOrName);
  const target = EXERCISE_ALIASES[norm] ?? norm;
  return PROCEDURAL_PRESETS.has(target);
}

/**
 * Resolve an exercise name or slug to either a procedural animation preset
 * or an upstream dataset item from hasaneyldrm/exercises-dataset or omercotkd/exercises-gifs.
 */
export function findCatalogExercise(nameOrSlug: string): ResolvedExercise | null {
  const norm = normalizeCatalogSlug(nameOrSlug);
  if (!norm) return null;

  // 1. Direct procedural preset
  if (PROCEDURAL_PRESETS.has(norm)) {
    return { type: "procedural", slug: norm, preset: norm };
  }

  // 2. Direct dataset match
  const direct = EXERCISE_DATASET_MAP[norm];
  if (direct) {
    const [id, mediaId] = direct;
    return {
      type: "dataset",
      slug: norm,
      id,
      mediaId,
      primaryUrl: getPrimaryDatasetUrl(id, mediaId),
      fallbackUrl: getFallbackDatasetUrl(id),
    };
  }

  // 3. Aliases
  const alias = EXERCISE_ALIASES[norm];
  if (alias) {
    if (PROCEDURAL_PRESETS.has(alias)) {
      return { type: "procedural", slug: norm, preset: alias };
    }
    const target = EXERCISE_DATASET_MAP[alias];
    if (target) {
      const [id, mediaId] = target;
      return {
        type: "dataset",
        slug: norm,
        id,
        mediaId,
        primaryUrl: getPrimaryDatasetUrl(id, mediaId),
        fallbackUrl: getFallbackDatasetUrl(id),
      };
    }
  }

  return null;
}
