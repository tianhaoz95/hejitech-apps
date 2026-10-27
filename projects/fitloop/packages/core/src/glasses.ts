// The Even G2 screens and the R1 ring's state machine. Pure: inputs plus the world (today's state,
// heart rate, the time) in, commands (check-ins, feedback, exit) and the screen's lines out. The
// plugin pushes the lines; the web preview and the tests drive the same class. Lines are laid out by
// the glasses' measured glyph widths (font.ts): proportional, so columns are padded in pixels.
//
//   today (root)  swipe moves through today's workouts and meals, tap opens one, hold opens the menu
//                 (progress, tell your agent, refresh, exit), double tap exits (the system dialog;
//                 Even Hub requires it on the root page)
//   workout       tap: set done (starts the rest timer) or, on a timed set, start/finish the work
//                 timer; swipe: previous/next exercise; hold: workout menu (how-to, skip exercise,
//                 tell your agent, end workout); double tap: back to today (the workout stays open)
//   meal          tap: eaten as planned; hold: ate less / more / something else / skipped + notes;
//                 double tap: back
//   cues, progress  any gesture: back
import { type Checkin, type CheckinStatus, type Exercise, type FEEDBACK_TAGS, type Portion } from "./types.ts";
import { fitPx, LINE_PX, MAX_LINES, padPx, spreadPx, wrapPx } from "./font.ts";
import { formatSeconds, nextSet, setTarget, type DayState, type MealState, type WorkoutState } from "./plan.ts";

export const FLASH_MS = 2500;

export type Input = "up" | "down" | "tap" | "double_tap" | "long_press";
export type Screen = "today" | "workout" | "cues" | "meal" | "progress" | "menu";

export interface World {
  date: string;
  now: number;
  day: DayState | null;
  planVersion: number | null;
  /** Live heart rate from the Watch (bpm), null when there's none or it's switched off. */
  hr: number | null;
  showHr: boolean;
  autoRest: boolean;
  /** One line when the data isn't fresh ("Offline: last synced 8:01"). */
  note?: string;
  /** The built-in demo day (not paired): check-ins stay on the glasses. */
  demo?: boolean;
}

export type NewCheckin = Pick<Checkin, "date" | "ref" | "kind" | "status"> & { data?: Checkin["data"]; note?: string };

export type Command =
  | { kind: "checkin"; checkin: NewCheckin }
  | { kind: "feedback"; date: string; ref: string | null; tags: string[] }
  | { kind: "workout"; active: boolean; ref: string }
  | { kind: "refresh" }
  /** Ask the system to close the plugin (its confirm dialog). */
  | { kind: "exit" };

/** Feedback tags as the glasses say them (≤ 13 characters, so "Tell agent: …" fits a line). */
export const GLASSES_TAG_LABELS: Record<(typeof FEEDBACK_TAGS)[number], string> = {
  too_easy: "Too easy", too_hard: "Too hard", pain: "It hurts", no_time: "No time", loved_it: "Loved it",
  hungry: "Still hungry", too_much_food: "Too much food", other: "Other",
};

interface MenuItem {
  label: string;
  run: () => Command[];
}

export const spread = (left: string, right: string) => spreadPx(left, right);
export const wrap = (text: string) => wrapPx(text);
/** Glasses text is plain ASCII: the G2 font's coverage of other characters is unverified. */
export const ascii = (s: string) => s.normalize("NFKD").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7e]/g, "");
/**
 * A countdown for the glasses: 5-second steps until the last 10 seconds, then every second. Each
 * change is a Bluetooth update; per-second updates for a 90 s rest queue up and delay everything
 * else on the display (seen in the simulator: the screen ran seconds behind).
 */
export const clockText = (ms: number) => {
  let s = Math.max(0, Math.ceil(ms / 1000));
  if (s > 10) s = Math.ceil(s / 5) * 5;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Entry = { type: "workout"; w: WorkoutState } | { type: "meal"; m: MealState };

export function todayEntries(day: DayState | null): Entry[] {
  if (!day) return [];
  const all: Entry[] = [...day.workouts.map((w) => ({ type: "workout" as const, w })), ...day.meals.map((m) => ({ type: "meal" as const, m }))];
  const time = (e: Entry) => (e.type === "workout" ? e.w.workout.time : e.m.meal.time) ?? "99:99";
  return all.sort((a, b) => time(a).localeCompare(time(b)));
}

export class Navigator {
  screen: Screen = "today";
  cursor = 0;
  menuIndex = 0;
  flash: { text: string; until: number } | null = null;
  /** The open workout (its id), exercise index and set number (1-based). */
  workoutId: string | null = null;
  ex = 0;
  set = 1;
  rest: { until: number } | null = null;
  work: { started: number; until: number } | null = null;
  mealId: string | null = null;
  animFrame = 0;
  lastAnimTick = 0;
  hasAnimation = false;
  private menuItems: MenuItem[] = [];
  private menuTitle = "";
  private back: Screen = "today";

  private say(text: string, now: number) {
    this.flash = { text: ascii(text).toUpperCase(), until: now + FLASH_MS };
  }

  workout(world: World): WorkoutState | null {
    return world.day?.workouts.find((w) => w.workout.id === this.workoutId) ?? null;
  }

  currentExercise(world: World): Exercise | null {
    const w = this.workout(world);
    return w?.exercises[this.ex]?.exercise ?? null;
  }

  private meal(world: World): MealState | null {
    return world.day?.meals.find((m) => m.meal.id === this.mealId) ?? null;
  }

  private openMenu(title: string, items: MenuItem[], back: Screen) {
    this.menuTitle = title;
    this.menuItems = [...items, { label: "Back", run: () => [] }];
    this.menuIndex = 0;
    this.back = back;
    this.screen = "menu";
  }

  private feedbackItems(world: World, ref: string | null, tags: (keyof typeof GLASSES_TAG_LABELS)[], back: Screen): MenuItem[] {
    return tags.map((t) => ({
      label: `Tell agent: ${GLASSES_TAG_LABELS[t]}`,
      run: () => { this.say("Sent to your agent", world.now); this.screen = back; return [{ kind: "feedback", date: world.date, ref, tags: [t] }]; },
    }));
  }

  openWorkout(world: World, id: string): Command[] {
    const w = world.day?.workouts.find((x) => x.workout.id === id);
    if (!w) return [];
    this.workoutId = id;
    const n = nextSet(w);
    this.ex = n?.exercise ?? 0;
    this.set = n?.set ?? 1;
    this.rest = null;
    this.work = null;
    this.animFrame = 0;
    this.lastAnimTick = 0;
    this.hasAnimation = false;
    this.screen = "workout";
    return [{ kind: "workout", active: true, ref: id }];
  }

  private finishSet(world: World, w: WorkoutState, data: Checkin["data"] = {}): Command[] {
    const e = w.exercises[this.ex];
    const cmds: Command[] = [{ kind: "checkin", checkin: { date: world.date, ref: `${e.ref}/${this.set}`, kind: "set", status: "done", data: { ...data, ...(world.hr ? { avg_hr: world.hr } : {}) } } }];
    this.work = null;
    if (this.set < e.exercise.sets) {
      this.set++;
      if (world.autoRest && e.exercise.rest_sec > 0) this.rest = { until: world.now + e.exercise.rest_sec * 1000 };
      return cmds;
    }
    cmds.push({ kind: "checkin", checkin: { date: world.date, ref: e.ref, kind: "exercise", status: "done" } });
    return [...cmds, ...this.advanceExercise(world, w, e.exercise.rest_sec)];
  }

  private advanceExercise(world: World, w: WorkoutState, rest: number): Command[] {
    // The next exercise still to do after this one (wrapping to any left earlier).
    const order = [...w.exercises.keys()].map((k) => (this.ex + 1 + k) % w.exercises.length);
    const next = order.find((i) => i !== this.ex && (w.exercises[i].status === "todo" || w.exercises[i].status === "in_progress"));
    if (next === undefined) return this.endWorkout(world, w, "done");
    this.ex = next;
    this.set = w.exercises[next].setsDone + 1;
    if (world.autoRest && rest > 0) this.rest = { until: world.now + rest * 1000 };
    return [];
  }

  private endWorkout(world: World, w: WorkoutState, status: CheckinStatus): Command[] {
    this.screen = "today";
    this.rest = null;
    this.work = null;
    this.say(status === "done" ? `${w.workout.title} done` : "Workout ended", world.now);
    return [
      { kind: "checkin", checkin: { date: world.date, ref: w.ref, kind: "workout", status } },
      { kind: "workout", active: false, ref: w.ref },
    ];
  }

  private mealCheckin(world: World, m: MealState, status: CheckinStatus, portion?: Portion): Command[] {
    this.screen = "today";
    this.say(status === "skipped" ? `${m.meal.name} skipped` : `${m.meal.name} checked off`, world.now);
    return [{ kind: "checkin", checkin: { date: world.date, ref: m.ref, kind: "meal", status, data: portion ? { portion } : undefined } }];
  }

  input(input: Input, world: World): Command[] {
    const now = world.now;
    this.flash = null;
    switch (this.screen) {
      case "today": {
        const entries = todayEntries(world.day);
        if (input === "up" || input === "down") {
          const next = Math.max(0, Math.min(entries.length - 1, this.cursor + (input === "down" ? 1 : -1)));
          // Every gesture answers: at either end, say so.
          if (next === this.cursor) this.say(entries.length ? (input === "down" ? "That's the last one today" : "That's the first one today") : "Nothing planned today", now);
          this.cursor = Math.max(0, next);
          return [];
        }
        if (input === "double_tap") return [{ kind: "exit" }];
        if (input === "long_press") {
          this.openMenu("FITLOOP", [
            { label: "Progress", run: () => { this.screen = "progress"; return []; } },
            ...this.feedbackItems(world, null, ["too_hard", "too_easy", "no_time", "loved_it"], "today"),
            { label: "Refresh", run: () => [{ kind: "refresh" }] },
            { label: "Exit FitLoop", run: () => [{ kind: "exit" }] },
          ], "today");
          return [];
        }
        if (input === "tap") {
          const e = entries[this.cursor];
          if (!e) { this.say("Refreshing", now); return [{ kind: "refresh" }]; }
          if (e.type === "workout") return this.openWorkout(world, e.w.workout.id);
          this.mealId = e.m.meal.id;
          this.screen = "meal";
        }
        return [];
      }
      case "workout": {
        const w = this.workout(world);
        if (!w) { this.screen = "today"; return []; }
        const e = w.exercises[this.ex];
        if (input === "up" || input === "down") {
          this.ex = (this.ex + (input === "down" ? 1 : -1) + w.exercises.length) % w.exercises.length;
          this.set = Math.min(w.exercises[this.ex].setsDone + 1, w.exercises[this.ex].exercise.sets);
          this.rest = null;
          this.work = null;
          return [];
        }
        if (input === "double_tap") { this.screen = "today"; return []; }
        if (input === "long_press") {
          const anim = e.exercise.animation;
          const hasAnim = Boolean(anim?.gifUrl || (anim?.steps && anim.steps.length > 0));
          this.openMenu(e.exercise.name, [
            { label: hasAnim ? "How-to / Demo" : "How-to", run: () => {
              this.screen = "cues";
              this.hasAnimation = hasAnim;
              this.animFrame = 0;
              this.lastAnimTick = world.now;
              return [];
            } },
            { label: "Skip this exercise", run: () => {
              this.screen = "workout";
              const cmds: Command[] = [{ kind: "checkin", checkin: { date: world.date, ref: e.ref, kind: "exercise", status: "skipped" } }];
              return [...cmds, ...this.advanceExercise(world, { ...w, exercises: w.exercises.map((x, i) => (i === this.ex ? { ...x, status: "skipped" as const } : x)) }, 0)];
            } },
            ...this.feedbackItems(world, e.ref, ["too_hard", "too_easy", "pain"], "workout"),
            { label: "End workout", run: () => this.endWorkout(world, w, w.setsDone > 0 ? "partial" : "skipped") },
          ], "workout");
          return [];
        }
        if (input === "tap") {
          this.rest = null;
          if (e.status === "done" || e.status === "skipped" || e.status === "swapped") return this.advanceExercise(world, w, 0);
          if (e.exercise.duration_sec !== undefined) {
            if (!this.work) { this.work = { started: now, until: now + e.exercise.duration_sec * 1000 }; return []; }
            return this.finishSet(world, w, { duration_sec: Math.round((now - this.work.started) / 1000) });
          }
          return this.finishSet(world, w, typeof e.exercise.reps === "number" ? { reps: e.exercise.reps } : {});
        }
        return [];
      }
      case "cues": {
        const w = this.workout(world);
        const anim = w?.exercises[this.ex]?.exercise?.animation;
        const steps = anim?.steps ?? [];
        if (steps.length > 1) {
          if (input === "double_tap" || input === "long_press") {
            this.screen = "workout";
            return [];
          }
          if (input === "tap" || input === "down") {
            this.animFrame = (this.animFrame + 1) % steps.length;
            this.lastAnimTick = world.now;
            return [];
          }
          if (input === "up") {
            this.animFrame = (this.animFrame - 1 + steps.length) % steps.length;
            this.lastAnimTick = world.now;
            return [];
          }
          return [];
        }
        this.screen = "workout";
        return [];
      }
      case "meal": {
        const m = this.meal(world);
        if (!m) { this.screen = "today"; return []; }
        if (input === "tap") return this.mealCheckin(world, m, "done", "as_planned");
        if (input === "double_tap") { this.screen = "today"; return []; }
        if (input === "up" || input === "down") { this.say("Tap: ate it  hold: other", now); return []; }
        if (input === "long_press") {
          this.openMenu(m.meal.name, [
            { label: "Ate less", run: () => this.mealCheckin(world, m, "done", "less") },
            { label: "Ate more", run: () => this.mealCheckin(world, m, "done", "more") },
            { label: "Ate something else", run: () => this.mealCheckin(world, m, "swapped") },
            { label: "Skipped it", run: () => this.mealCheckin(world, m, "skipped") },
            ...this.feedbackItems(world, m.ref, ["hungry", "too_much_food", "loved_it"], "meal"),
          ], "meal");
        }
        return [];
      }
      case "progress":
        this.screen = "today";
        return [];
      case "menu": {
        const items = this.menuItems;
        if (input === "up" || input === "down") {
          this.menuIndex = (this.menuIndex + (input === "down" ? 1 : -1) + items.length) % items.length;
          return [];
        }
        if (input === "double_tap") { this.screen = this.back; return []; }
        if (input === "tap" || input === "long_press") {
          const item = items[Math.min(this.menuIndex, items.length - 1)];
          this.screen = this.back;
          return item.run();
        }
        return [];
      }
    }
  }

  // ------------------------------------------------------------------ screens

  lines(world: World): string[] {
    let lines: string[];
    switch (this.screen) {
      case "today": lines = todayLines(world, this.cursor); break;
      case "workout": lines = this.workoutLines(world); break;
      case "cues": lines = this.cuesLines(world); break;
      case "meal": lines = mealLines(this.meal(world)); break;
      case "progress": lines = progressLines(world); break;
      case "menu": {
        const items = this.menuItems;
        const sel = Math.min(this.menuIndex, items.length - 1);
        const first = Math.max(0, Math.min(sel - 2, items.length - (MAX_LINES - 1)));
        lines = [spreadPx(ascii(this.menuTitle).toUpperCase(), "2x: back"), ...items.slice(first, first + MAX_LINES - 1).map((m, i) => `${first + i === sel ? ">" : "  "} ${m.label}`)];
        break;
      }
    }
    if (this.flash && this.flash.until > world.now) lines = [...lines.slice(0, MAX_LINES - 1), `>> ${this.flash.text}`];
    // Plain ASCII, each line within the frame; no trailing empty lines (they'd scroll).
    const out = lines.slice(0, MAX_LINES).map((l) => fitPx(ascii(l), LINE_PX));
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out;
  }

  /** True while a timer is showing or animation is playing: the plugin re-renders every second. */
  ticking(now: number): boolean {
    const timer = (this.screen === "workout" || this.screen === "cues") && Boolean((this.rest && this.rest.until > now - 5000) || this.work);
    const anim = this.screen === "cues" && this.hasAnimation;
    return timer || anim;
  }

  private workoutLines(world: World): string[] {
    const w = this.workout(world);
    if (!w) return ["WORKOUT", "", "Not in today's plan."];
    const e = w.exercises[this.ex];
    const x = e.exercise;
    const head = spread(x.name.toUpperCase(), `${this.ex + 1}/${w.exercises.length}`);
    const settled = e.status === "done" || e.status === "skipped" || e.status === "swapped";
    const setLine = settled ? `${e.status === "done" ? "Done" : "Skipped"}: tap for next` : spread(`Set ${this.set} of ${x.sets}`, setTarget(x));
    let timer: string;
    if (this.work) {
      const left = this.work.until - world.now;
      timer = left > 0 ? `WORK ${clockText(left)}` : "TIME! tap: done";
    } else if (this.rest) {
      const left = this.rest.until - world.now;
      timer = left > 0 ? `REST ${clockText(left)}` : "GO - rest is over";
    } else timer = x.duration_sec !== undefined ? `tap: start ${formatSeconds(x.duration_sec)}` : "tap: set done";
    const hr = world.showHr && world.hr ? `HR ${world.hr}` : "";
    const sets = `${w.setsDone}/${w.setsTotal} sets`;
    return [head, "", setLine, spread(timer, hr), "", sets, world.demo ? "" : world.note ?? "", "hold: how-to, menu  2x: today"];
  }

  private cuesLines(world: World): string[] {
    const w = this.workout(world);
    const e = w?.exercises[this.ex]?.exercise;
    if (!e) return ["HOW-TO", "", "Nothing here."];
    const anim = e.animation;
    const steps = anim?.steps ?? [];
    const hasGif = Boolean(anim?.gifUrl);

    if (steps.length > 0) {
      // Relaxed auto-cycle at 3.5 seconds per step so instructions don't flash through too fast
      const intervalMs = 3500;
      if (steps.length > 1 && this.lastAnimTick > 0 && world.now - this.lastAnimTick >= intervalMs) {
        this.animFrame = (this.animFrame + 1) % steps.length;
        this.lastAnimTick = world.now;
      }
      const curStep = Math.min(this.animFrame, steps.length - 1);
      const header = spread(e.name.toUpperCase(), `${curStep + 1}/${steps.length}`);
      const stepText = ascii(steps[curStep]);
      const wrapped = wrap(stepText);
      const lines = [header, "", `STEP ${curStep + 1} OF ${steps.length}`, ...wrapped];
      while (lines.length < MAX_LINES - 1) lines.push("");
      lines.push(steps.length > 1 ? "tap: next  2x: back" : "any: back");
      return lines;
    }

    const body = (e.cues?.length ? e.cues : wrap(e.instructions ?? "No cues in the plan for this one.")).map((c) => `- ${ascii(c)}`);
    const lines = [spread(e.name.toUpperCase(), "any: back"), ...body.flatMap((l) => wrap(l))];
    if (e.alternative && lines.length < MAX_LINES) lines.push(`Instead: ${e.alternative}`);
    return lines;
  }
}

export function entryLine(e: Entry, selected: boolean): string {
  const c = selected ? ">" : " ";
  if (e.type === "workout") {
    const w = e.w;
    const right = w.status === "done" ? "done" : w.status === "skipped" ? "skip" : `${w.setsDone}/${w.setsTotal}`;
    return spreadPx(padPx(c, 16) + padPx(w.workout.time ?? "--:--", 62) + w.workout.title, right);
  }
  const m = e.m;
  const right = m.status === "done" ? "ate" : m.status === "swapped" ? "swap" : m.status === "skipped" ? "skip" : "";
  return spreadPx(padPx(c, 16) + padPx(m.meal.time ?? "--:--", 62) + m.meal.name, right);
}

export function todayLines(world: World, cursor: number): string[] {
  const d = world.day;
  const hint = world.note && !world.demo ? world.note : "tap: open  hold: menu  2x: exit";
  if (!d || !d.day) return ["FITLOOP", "", "No plan for today yet.", "Ask your agent to publish one", "with the FitLoop connector.", "", hint];
  const entries = todayEntries(d);
  const head = spreadPx(`${world.demo ? "DEMO: " : ""}${d.day.title.toUpperCase()}`, `${Math.round(d.completion * 100)}%`);
  if (!entries.length) return [head, "", "Nothing planned today.", "Rest well.", "", hint];
  const rows = MAX_LINES - 2;
  const first = Math.max(0, Math.min(cursor - 1, entries.length - rows));
  const lines = [head, ...entries.slice(first, first + rows).map((e, i) => entryLine(e, first + i === cursor))];
  while (lines.length < MAX_LINES - 1) lines.push("");
  // The demo says so above the gesture hint, which always shows.
  if (world.demo && !lines[MAX_LINES - 2].trim()) lines[MAX_LINES - 2] = "Demo day: pair in the FitLoop app";
  lines.push(hint);
  return lines;
}

export function mealLines(m: MealState | null): string[] {
  if (!m) return ["MEAL", "", "Not in today's plan."];
  const head = spread(`${m.meal.name.toUpperCase()}${m.meal.time ? " " + m.meal.time : ""}`, m.status === "todo" ? "" : m.status);
  const items = m.meal.items.map((i) => `${i.name} ${i.amount}`);
  const shown = items.length > 5 ? [...items.slice(0, 4), `+${items.length - 4} more`] : items;
  const mac = m.meal.macros;
  const macros = mac ? [mac.calories !== undefined ? `${mac.calories} kcal` : "", mac.protein_g !== undefined ? `${mac.protein_g}P` : "", mac.carbs_g !== undefined ? `${mac.carbs_g}C` : "", mac.fat_g !== undefined ? `${mac.fat_g}F` : ""].filter(Boolean).join(" ") : "";
  const body = [...shown, macros].filter(Boolean);
  const lines = [head, ...body];
  while (lines.length < MAX_LINES - 1) lines.push("");
  return [...lines.slice(0, MAX_LINES - 1), "tap: ate it  hold: other  2x: back"];
}

export function progressLines(world: World): string[] {
  const d = world.day;
  if (!d || !d.day) return ["PROGRESS", "", "No plan for today yet."];
  const n = d.nutrition;
  const wDone = d.workouts.filter((w) => w.status === "done").length;
  const mDone = d.meals.filter((m) => m.status === "done" || m.status === "swapped").length;
  const lines = [spread("TODAY", `${Math.round(d.completion * 100)}% done`), spread("Workouts", `${wDone}/${d.workouts.length}`), spread("Meals", `${mDone}/${d.meals.length}`)];
  if (n.targets.calories || n.planned.calories) lines.push(spread("Calories", `${n.eaten.calories ?? 0}/${n.targets.calories ?? n.planned.calories}`));
  if (n.targets.protein_g || n.planned.protein_g) lines.push(spread("Protein", `${n.eaten.protein_g ?? 0}/${n.targets.protein_g ?? n.planned.protein_g} g`));
  if (world.showHr && world.hr) lines.push(spread("Heart rate", `${world.hr} bpm`));
  return [...lines.slice(0, MAX_LINES - 2), "", "any gesture: back"];
}
