// The plan validator: every rule the agent's plan must meet before it's published (errors) and the
// advice it gets (warnings). The MCP tools, the Worker's publish path and the tests share it. The
// limits keep plans readable on the Even G2 (names and cues fit a line).
import { isDate } from "./plan.ts";
import { PLAN_FORMAT_VERSION, WEEKDAYS, type DayPlan, type ExerciseAnimation, type Plan } from "./types.ts";

export interface Issue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export const LIMITS = {
  name: 28, // exercise / workout / meal names: one G2 line with the set counter
  cue: 60,
  cues: 5,
  item: 40,
  items: 12,
  exercises: 20,
  workoutsPerDay: 4,
  mealsPerDay: 8,
  sets: 20,
  restMax: 900,
  durationMax: 4 * 3600,
  animSteps: 8,
  animStepLength: 28,
} as const;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = ["strength", "cardio", "mobility", "hiit", "sport", "other"];

export function checkPlan(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ severity: "error", path, message });
  const warn = (path: string, message: string) => issues.push({ severity: "warning", path, message });
  if (typeof input !== "object" || !input) return [{ severity: "error", path: "", message: "the plan must be a JSON object" }];
  const p = input as Partial<Plan>;
  if (p.format !== PLAN_FORMAT_VERSION) err("format", `must be ${PLAN_FORMAT_VERSION} (get_plan_guide has the current format)`);
  if (!str(p.title) || p.title!.length > 60) err("title", "a title of 1–60 characters");
  if (!str(p.summary)) err("summary", "say in a paragraph what the plan is for and why it looks like this");
  if (!isDate(p.starts_on)) err("starts_on", "YYYY-MM-DD");
  if (p.ends_on !== undefined && (!isDate(p.ends_on) || (isDate(p.starts_on) && p.ends_on < p.starts_on!))) err("ends_on", "YYYY-MM-DD on or after starts_on");
  if (!Array.isArray(p.goals) || !p.goals.length) err("goals", "at least one goal");
  else {
    const ids = new Set<string>();
    p.goals.forEach((g, i) => {
      if (!ID.test(String(g?.id ?? ""))) err(`goals[${i}].id`, "lowercase-kebab-case id");
      if (ids.has(g.id)) err(`goals[${i}].id`, `duplicate id ${g.id}`);
      ids.add(g.id);
      if (!str(g?.text)) err(`goals[${i}].text`, "required");
      if (g?.by !== undefined && !isDate(g.by)) err(`goals[${i}].by`, "YYYY-MM-DD");
      if (g?.target !== undefined && typeof g.target !== "number") err(`goals[${i}].target`, "a number");
    });
  }
  if (!Array.isArray(p.constraints)) err("constraints", "a list (empty if there are none): injuries, diet, equipment, time limits you planned around");
  else if (p.constraints.some((c) => !str(c))) err("constraints", "each one a non-empty string");
  if (p.targets !== undefined) {
    for (const [k, v] of Object.entries(p.targets)) if (typeof v !== "number" || v < 0) err(`targets.${k}`, "a non-negative number");
  }
  if (!p.week || typeof p.week !== "object") err("week", "a day plan for each of mon … sun (use a rest day with no workouts)");
  else for (const d of WEEKDAYS) {
    if (!p.week[d]) err(`week.${d}`, "missing: every weekday needs a day plan");
    else checkDay(p.week[d], `week.${d}`, err, warn, p);
  }
  if (p.overrides !== undefined) {
    if (typeof p.overrides !== "object" || !p.overrides) err("overrides", "an object keyed by YYYY-MM-DD");
    else for (const [date, day] of Object.entries(p.overrides)) {
      if (!isDate(date)) err(`overrides.${date}`, "keys are YYYY-MM-DD");
      checkDay(day, `overrides.${date}`, err, warn, p);
    }
  }
  if (p.week && WEEKDAYS.every((d) => !p.week![d]?.workouts?.length)) warn("week", "no workouts in the week: intended?");
  return issues;
}

function checkDay(day: DayPlan, path: string, err: (p: string, m: string) => void, warn: (p: string, m: string) => void, plan: Partial<Plan>) {
  if (!day || typeof day !== "object") return err(path, "a day plan { title, workouts, meals }");
  if (!str(day.title) || day.title.length > LIMITS.name) err(`${path}.title`, `1–${LIMITS.name} characters`);
  if (!Array.isArray(day.workouts)) err(`${path}.workouts`, "a list (empty on rest days)");
  if (!Array.isArray(day.meals)) err(`${path}.meals`, "a list (empty if the plan has no meals that day)");
  const ids = new Set<string>();
  const unique = (id: string, p: string) => {
    if (!ID.test(id)) err(p, "lowercase-kebab-case id");
    else if (ids.has(id)) err(p, `duplicate id ${id} in this day (workout and meal ids share one namespace)`);
    ids.add(id);
  };
  (day.workouts ?? []).forEach((w, i) => {
    const wp = `${path}.workouts[${i}]`;
    unique(String(w?.id ?? ""), `${wp}.id`);
    if (!str(w?.title) || w.title.length > LIMITS.name) err(`${wp}.title`, `1–${LIMITS.name} characters (it has to fit the glasses)`);
    if (w?.time !== undefined && !TIME.test(w.time)) err(`${wp}.time`, "HH:MM");
    if (!KINDS.includes(w?.kind)) err(`${wp}.kind`, `one of ${KINDS.join(", ")}`);
    if (typeof w?.duration_min !== "number" || w.duration_min <= 0 || w.duration_min > 300) err(`${wp}.duration_min`, "1–300 minutes");
    if (!Array.isArray(w?.exercises) || !w.exercises.length) err(`${wp}.exercises`, "at least one exercise");
    else if (w.exercises.length > LIMITS.exercises) err(`${wp}.exercises`, `at most ${LIMITS.exercises}`);
    const eids = new Set<string>();
    (w?.exercises ?? []).forEach((e, j) => {
      const ep = `${wp}.exercises[${j}]`;
      if (!ID.test(String(e?.id ?? ""))) err(`${ep}.id`, "lowercase-kebab-case id");
      else if (eids.has(e.id)) err(`${ep}.id`, `duplicate exercise id ${e.id}`);
      eids.add(e?.id);
      if (!str(e?.name) || e.name.length > LIMITS.name) err(`${ep}.name`, `1–${LIMITS.name} characters (it has to fit the glasses)`);
      if (!Number.isInteger(e?.sets) || e.sets < 1 || e.sets > LIMITS.sets) err(`${ep}.sets`, `a whole number 1–${LIMITS.sets}`);
      if (e?.reps === undefined && e?.duration_sec === undefined) err(`${ep}`, "give reps or duration_sec");
      if (e?.reps !== undefined && !(typeof e.reps === "number" ? e.reps > 0 : /^\d+(-\d+)?$/.test(String(e.reps)))) err(`${ep}.reps`, 'a number or a range like "8-10"');
      if (e?.duration_sec !== undefined && (typeof e.duration_sec !== "number" || e.duration_sec <= 0 || e.duration_sec > LIMITS.durationMax)) err(`${ep}.duration_sec`, "positive seconds");
      if (typeof e?.rest_sec !== "number" || e.rest_sec < 0 || e.rest_sec > LIMITS.restMax) err(`${ep}.rest_sec`, `0–${LIMITS.restMax} seconds`);
      if (e?.load !== undefined && (!str(e.load) || e.load.length > 20)) err(`${ep}.load`, "1–20 characters");
      if (e?.cues !== undefined) {
        if (!Array.isArray(e.cues) || e.cues.length > LIMITS.cues) err(`${ep}.cues`, `at most ${LIMITS.cues}`);
        else e.cues.forEach((c, k) => { if (!str(c) || c.length > LIMITS.cue) err(`${ep}.cues[${k}]`, `1–${LIMITS.cue} characters`); });
      } else warn(`${ep}.cues`, "no cues: the glasses' hold-for-instructions screen will be empty");
      if (e?.video_url !== undefined && !/^https:\/\//.test(e.video_url)) err(`${ep}.video_url`, "an https URL");
      if (e?.animation !== undefined) {
        if (typeof e.animation !== "object" || !e.animation) {
          err(`${ep}.animation`, "must be an object { gifUrl?: string, steps?: string[], description?: string }");
        } else {
          const a = e.animation as Partial<ExerciseAnimation>;
          if (!a.gifUrl && (!a.steps || a.steps.length === 0) && !a.description) {
            err(`${ep}.animation`, "must provide at least gifUrl, steps, or description");
          }
          if (a.gifUrl !== undefined && (typeof a.gifUrl !== "string" || !/^https?:\/\//i.test(a.gifUrl))) {
            err(`${ep}.animation.gifUrl`, "must be an HTTPS URL pointing to the animated GIF");
          }
          if (a.steps !== undefined) {
            if (!Array.isArray(a.steps) || a.steps.length === 0) {
              err(`${ep}.animation.steps`, "must provide at least 1 step");
            } else if (a.steps.length > LIMITS.animSteps) {
              err(`${ep}.animation.steps`, `at most ${LIMITS.animSteps} steps`);
            } else {
              a.steps.forEach((step, si) => {
                if (typeof step !== "string" || step.trim().length === 0) {
                  err(`${ep}.animation.steps[${si}]`, "must be a non-empty string");
                } else if (step.length > LIMITS.animStepLength) {
                  err(`${ep}.animation.steps[${si}]`, `step exceeds ${LIMITS.animStepLength} characters (to fit Even G2 glasses display)`);
                } else if (/[^\x20-\x7e]/.test(step)) {
                  err(`${ep}.animation.steps[${si}]`, "plain ASCII characters only (Even G2 font limit)");
                }
              });
            }
          }
          if (a.description !== undefined && (typeof a.description !== "string" || a.description.length > 80)) {
            err(`${ep}.animation.description`, "description up to 80 characters");
          }
        }
      } else {
        warn(`${ep}.animation`, "no animated instructions: provide animation { gifUrl?, steps? } so users see how to do it on phone and glasses");
      }
    });
    if (w?.exercises?.length && typeof w.duration_min === "number") {
      const est = w.exercises.reduce((n, e) => n + (e.sets ?? 0) * ((e.duration_sec ?? 40) + (e.rest_sec ?? 0)), 0) / 60;
      if (est > w.duration_min * 1.5) warn(`${wp}.duration_min`, `the sets and rests add up to about ${Math.round(est)} min, more than the ${w.duration_min} planned`);
    }
  });
  if ((day.workouts ?? []).length > LIMITS.workoutsPerDay) err(`${path}.workouts`, `at most ${LIMITS.workoutsPerDay} a day`);
  if ((day.meals ?? []).length > LIMITS.mealsPerDay) err(`${path}.meals`, `at most ${LIMITS.mealsPerDay} a day`);
  (day.meals ?? []).forEach((m, i) => {
    const mp = `${path}.meals[${i}]`;
    unique(String(m?.id ?? ""), `${mp}.id`);
    if (!str(m?.name) || m.name.length > LIMITS.name) err(`${mp}.name`, `1–${LIMITS.name} characters`);
    if (m?.time !== undefined && !TIME.test(m.time)) err(`${mp}.time`, "HH:MM");
    if (!Array.isArray(m?.items) || !m.items.length) err(`${mp}.items`, "at least one item");
    else if (m.items.length > LIMITS.items) err(`${mp}.items`, `at most ${LIMITS.items}`);
    (m?.items ?? []).forEach((it, k) => {
      if (!str(it?.name) || `${it.name} ${it.amount ?? ""}`.length > LIMITS.item) err(`${mp}.items[${k}]`, `name + amount within ${LIMITS.item} characters`);
      if (!str(it?.amount)) err(`${mp}.items[${k}].amount`, 'how much, e.g. "150 g", "1 cup"');
    });
    if (m?.macros) for (const [k, v] of Object.entries(m.macros)) if (typeof v !== "number" || v < 0) err(`${mp}.macros.${k}`, "a non-negative number");
    if (plan.targets?.calories && !m?.macros?.calories) warn(`${mp}.macros`, "no calories: the day's totals against your targets will be incomplete");
  });
  const kcal = (day.meals ?? []).reduce((n, m) => n + (m?.macros?.calories ?? 0), 0);
  if (plan.targets?.calories && kcal && Math.abs(kcal - plan.targets.calories) / plan.targets.calories > 0.15)
    warn(`${path}.meals`, `meals add up to ${kcal} kcal, ${kcal > plan.targets.calories ? "over" : "under"} the ${plan.targets.calories} kcal target by more than 15%`);
}

const str = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;

export const errorsOf = (issues: Issue[]) => issues.filter((i) => i.severity === "error");
