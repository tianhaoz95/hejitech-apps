// FitLoop's shapes: the plan an agent publishes (PLAN_FORMAT_VERSION), check-ins, feedback,
// vitals and the user's settings. The Worker, the web app, the glasses plugin and (as Codable
// mirrors) the iPhone app all read these.

export const PLAN_FORMAT_VERSION = 1;

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export interface Goal {
  id: string;
  text: string;
  /** Optional measurable target, e.g. { metric: "weight", target: 75, unit: "kg", by: "2027-01-31" }. */
  metric?: string;
  target?: number;
  unit?: string;
  by?: string;
}

export interface Macros {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface ExerciseAnimation {
  /** Direct HTTPS URL to the high-resolution animated instruction GIF. */
  gifUrl: string;
  /**
   * Paced step-by-step movement phases for Even G2 glasses and mobile breakdown
   * (e.g. ["1. Setup: feet shoulder-width", "2. Lower hips with control", "3. Drive up through heels"]).
   * Up to 8 steps, ≤ 28 characters each to fit Even G2 glasses display.
   */
  steps?: string[];
  /** Short description of the movement instruction (≤ 80 characters). */
  description?: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  /** Reps per set (number or a range like "8-10"); omit for timed work. */
  reps?: number | string;
  /** Seconds per set for timed work (plank, intervals). */
  duration_sec?: number;
  /** "60 kg", "bodyweight", "RPE 7", "zone 2". */
  load?: string;
  /** Rest after each set, seconds (the glasses start this timer when a set is done). */
  rest_sec: number;
  /** Short cues the glasses show on hold, ≤ 60 characters each. */
  cues?: string[];
  /** Longer how-to for the phone and web. */
  instructions?: string;
  /** What to do instead if it hurts or the equipment is taken. */
  alternative?: string;
  video_url?: string;
  /** High-resolution animated GIF instructions with paced step cues for Even G2 and phone. */
  animation?: ExerciseAnimation;
}

export interface Workout {
  id: string;
  title: string;
  /** "HH:MM" local time the user planned to start. */
  time?: string;
  duration_min: number;
  kind: "strength" | "cardio" | "mobility" | "hiit" | "sport" | "other";
  exercises: Exercise[];
  notes?: string;
}

export interface MealItem {
  name: string;
  amount: string;
}

export interface Meal {
  id: string;
  /** "Breakfast", "Lunch", "Post-workout shake". */
  name: string;
  time?: string;
  items: MealItem[];
  macros?: Macros;
  prep?: string[];
  notes?: string;
}

export interface DayPlan {
  /** "Upper body", "Rest day". */
  title: string;
  workouts: Workout[];
  meals: Meal[];
  notes?: string;
}

export interface Plan {
  format: typeof PLAN_FORMAT_VERSION;
  title: string;
  /** One paragraph: what this plan is for and why it looks like this. */
  summary: string;
  starts_on: string;
  ends_on?: string;
  goals: Goal[];
  /** The needs, limits and preferences the agent planned around (injuries, diet, equipment, time). */
  constraints: string[];
  /** Daily nutrition targets. */
  targets?: Macros & { water_l?: number };
  /** The repeating week. */
  week: Record<Weekday, DayPlan>;
  /** Specific dates that differ from the week (YYYY-MM-DD). */
  overrides?: Record<string, DayPlan>;
}

export interface PublishedPlan {
  version: number;
  plan: Plan;
  change_note: string;
  published_at: string;
}

// ---------------------------------------------------------------- check-ins

export type CheckinKind = "set" | "exercise" | "workout" | "meal";
export type CheckinStatus = "done" | "partial" | "skipped" | "swapped";
export type Portion = "less" | "as_planned" | "more";

/**
 * One thing the user did (or didn't) on a date. `ref` points into the day's plan:
 *   workout   "<workoutId>"
 *   exercise  "<workoutId>/<exerciseId>"
 *   set       "<workoutId>/<exerciseId>/<setNumber>" (1-based)
 *   meal      "<mealId>"
 */
export interface Checkin {
  date: string;
  ref: string;
  kind: CheckinKind;
  status: CheckinStatus;
  plan_version: number;
  /** What actually happened: reps, load, duration_sec, rpe, avg_hr/max_hr, portion, swapped_for. */
  data?: {
    reps?: number;
    load?: string;
    duration_sec?: number;
    rpe?: number;
    avg_hr?: number;
    max_hr?: number;
    portion?: Portion;
    swapped_for?: string;
    /** A one-day change the user made (moved to another time / day). */
    moved_to?: string;
  };
  note?: string;
  source?: "phone" | "web" | "glasses" | "watch" | "agent";
  at?: string;
}

// ---------------------------------------------------------------- feedback

export interface Feedback {
  id: string;
  /** Where it was left: a date and optional plan ref (null: about the plan in general). */
  date: string | null;
  ref: string | null;
  plan_version: number | null;
  text: string;
  /** Quick tags the glasses and app offer: too_easy, too_hard, pain, no_time, loved_it, hungry, too_much_food, other. */
  tags: string[];
  status: "open" | "addressed";
  agent_reply: string | null;
  created_at: string;
  addressed_at: string | null;
  source?: string;
}

export const FEEDBACK_TAGS = ["too_easy", "too_hard", "pain", "no_time", "loved_it", "hungry", "too_much_food", "other"] as const;
export const FEEDBACK_LABELS: Record<(typeof FEEDBACK_TAGS)[number], string> = {
  too_easy: "Too easy", too_hard: "Too hard", pain: "Pain or discomfort", no_time: "Not enough time",
  loved_it: "Loved it", hungry: "Still hungry", too_much_food: "Too much food", other: "Other",
};

// ---------------------------------------------------------------- vitals

/** Metrics the app records: from Apple Health (daily), the Watch (workouts) or typed in. */
export const METRICS = {
  weight: { unit: "kg", label: "Weight" },
  body_fat: { unit: "%", label: "Body fat" },
  waist: { unit: "cm", label: "Waist" },
  resting_hr: { unit: "bpm", label: "Resting heart rate" },
  hrv: { unit: "ms", label: "HRV" },
  sleep_hours: { unit: "h", label: "Sleep" },
  steps: { unit: "steps", label: "Steps" },
  active_energy: { unit: "kcal", label: "Active energy" },
  energy: { unit: "1-5", label: "Energy" },
  mood: { unit: "1-5", label: "Mood" },
  soreness: { unit: "1-5", label: "Soreness" },
} as const;
export type Metric = keyof typeof METRICS;

export interface VitalEntry {
  date: string;
  metric: Metric;
  value: number;
  source: "health" | "manual" | "watch";
}

// ---------------------------------------------------------------- settings

export interface Settings {
  units: "metric" | "imperial";
  /** IANA time zone the phone reports; the agent's notion of "today". */
  timezone: string;
  /** Each vitals option is the user's switch; the agent sees only what's on and shared. */
  vitals: { live_hr: boolean; health_daily: boolean; manual: boolean; photos: boolean };
  agent_access: { vitals: boolean; photos: boolean; feedback: boolean; checkins: boolean };
  reminders: {
    workout: { on: boolean; minutes_before: number };
    meals: { on: boolean };
    evening: { on: boolean; time: string };
    weekly: { on: boolean; weekday: Weekday; time: string };
  };
  glasses: { show_hr: boolean; auto_rest_timer: boolean };
  /** What the user tells every agent: goals, limits, equipment, schedule. The agent may read and update it. */
  about: { goals: string; restrictions: string; equipment: string; schedule: string; diet: string; notes: string };
}
