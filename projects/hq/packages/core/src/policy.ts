// HQ.md frontmatter (PRD §5): the part of a repo's .hq/ folder that HQ enforces in code. The prose
// below the frontmatter only guides agents; nothing here reads it.
//
// A repo has one root .hq/HQ.md (repo-wide settings and defaults) and any number of project
// .hq/HQ.md files (overrides for that project). The CLI parses the YAML and syncs this JSON shape to
// the Worker, which enforces it.

import { TIERS, type Tier, type CardInput, type Result } from "./card.ts";

export const RUNS_ON = ["cloud", "mac-runner", "any"] as const;
export type RunsOn = (typeof RUNS_ON)[number];

export const SCHEDULES = ["hourly", "daily", "weekly", "manual"] as const;
export type Schedule = (typeof SCHEDULES)[number];

export interface VerbPolicy {
  tier: Tier;
  runs_on: RunsOn;
  needs: string[];
}

export interface ScoutPolicy {
  /** A skill name (heji-fix-ci) or a built-in scout (health). */
  name: string;
  schedule: Schedule;
  /** Cards one run may create. */
  card_limit: number;
}

/** Frontmatter as written by people; every field optional except `hq`. */
export interface HqFrontmatter {
  hq: number;
  /** Root only. */
  repo?: string;
  project?: string;
  tier_ceiling?: Tier;
  scouts?: (string | { name: string; schedule?: Schedule; card_limit?: number })[];
  never?: string[];
  budget_share?: number;
  verbs?: Record<string, Partial<VerbPolicy>>;
  // Root-only settings:
  inbox_cap?: number;
  weekly_budget_usd?: number;
  max_open_prs?: number;
  wip_per_project?: number;
  push?: boolean;
  agents?: { ceo?: string; scout?: string; executor?: string; reviewer?: string };
  ceo_schedule?: Schedule;
}

/** One HQ.md after parsing: where it is, its frontmatter and its prose. */
export interface HqFile {
  /** Repo-relative folder holding .hq/ ("" for the root). */
  dir: string;
  frontmatter: HqFrontmatter;
  body: string;
  /** Verbs found in .hq/bin (executable files). */
  bin: string[];
}

export interface ProjectPolicy {
  name: string;
  dir: string;
  tier_ceiling: Tier;
  scouts: ScoutPolicy[];
  never: string[];
  budget_share: number;
  verbs: Record<string, VerbPolicy>;
  guidance: string;
}

export interface RepoPolicy {
  repo: string;
  inbox_cap: number;
  weekly_budget_usd: number;
  max_open_prs: number;
  wip_per_project: number;
  push: boolean;
  agents: { ceo: string; scout: string; executor: string; reviewer: string };
  ceo_schedule: Schedule;
  tier_ceiling: Tier;
  never: string[];
  scouts: ScoutPolicy[];
  verbs: Record<string, VerbPolicy>;
  guidance: string;
  projects: Record<string, ProjectPolicy>;
}

export const DEFAULTS = {
  inbox_cap: 5,
  weekly_budget_usd: 50,
  max_open_prs: 5,
  wip_per_project: 1,
  push: false,
  agent: "claude",
  ceo_schedule: "daily" as Schedule,
  tier_ceiling: "L2" as Tier,
  card_limit: 3,
  /** Built-in verb tiers when HQ.md doesn't say. Anything that publishes is L3 unless lowered. */
  verbTier: { health: "L0", verify: "L0", evidence: "L0", release: "L3", rollback: "L2" } as Record<string, Tier>,
};

export const tierRank = (t: Tier) => TIERS.indexOf(t);
/** The stricter (less autonomous) of two tiers: L0 is the most autonomous, L3 the least. */
export const stricterTier = (a: Tier, b: Tier): Tier => (tierRank(a) >= tierRank(b) ? a : b);

const errsFor = (where: string) => {
  const errs: string[] = [];
  return { errs, add: (m: string) => errs.push(`${where}: ${m}`) };
};

/** Checks one file's frontmatter. Root files may use root-only keys; project files may not. */
export function validateFrontmatter(f: HqFile): string[] {
  const where = `${f.dir ? f.dir + "/" : ""}.hq/HQ.md`;
  const { errs, add } = errsFor(where);
  const fm = f.frontmatter as unknown as Record<string, unknown>;
  if (!fm || typeof fm !== "object") return [`${where}: missing YAML frontmatter`];
  if (fm.hq !== 1) add("hq: must be 1 (the spec version)");
  const isRoot = f.dir === "";
  const rootOnly = ["repo", "inbox_cap", "weekly_budget_usd", "max_open_prs", "wip_per_project", "push", "agents", "ceo_schedule"];
  const known = new Set(["hq", "project", "tier_ceiling", "scouts", "never", "budget_share", "verbs", ...rootOnly]);
  for (const k of Object.keys(fm)) {
    if (!known.has(k)) add(`unknown key "${k}"`);
    else if (!isRoot && rootOnly.includes(k)) add(`"${k}" is only allowed in the root .hq/HQ.md`);
  }
  if (isRoot && (typeof fm.repo !== "string" || !fm.repo)) add("repo: required in the root HQ.md");
  if (fm.tier_ceiling !== undefined && !TIERS.includes(fm.tier_ceiling as Tier)) add(`tier_ceiling: one of ${TIERS.join(", ")}`);
  if (fm.project !== undefined && (typeof fm.project !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(fm.project))) add("project: a lowercase name");
  if (fm.never !== undefined && (!Array.isArray(fm.never) || !fm.never.every((x) => typeof x === "string"))) add("never: a list of strings");
  if (fm.budget_share !== undefined && (typeof fm.budget_share !== "number" || fm.budget_share < 0 || fm.budget_share > 1)) add("budget_share: a number from 0 to 1");
  for (const k of ["inbox_cap", "max_open_prs", "wip_per_project"]) {
    if (fm[k] !== undefined && (!Number.isInteger(fm[k]) || (fm[k] as number) < 0)) add(`${k}: a whole number ≥ 0`);
  }
  if (fm.weekly_budget_usd !== undefined && (typeof fm.weekly_budget_usd !== "number" || fm.weekly_budget_usd < 0)) add("weekly_budget_usd: a number ≥ 0");
  if (fm.push !== undefined && typeof fm.push !== "boolean") add("push: true or false");
  if (fm.ceo_schedule !== undefined && !SCHEDULES.includes(fm.ceo_schedule as Schedule)) add(`ceo_schedule: one of ${SCHEDULES.join(", ")}`);
  if (fm.agents !== undefined) {
    if (typeof fm.agents !== "object" || !fm.agents) add("agents: a map of role → agent name");
    else for (const [role, a] of Object.entries(fm.agents)) {
      if (!["ceo", "scout", "executor", "reviewer"].includes(role)) add(`agents.${role}: unknown role`);
      if (typeof a !== "string") add(`agents.${role}: an agent name`);
    }
  }
  if (fm.scouts !== undefined) {
    if (!Array.isArray(fm.scouts)) add("scouts: a list");
    else fm.scouts.forEach((s, i) => {
      if (typeof s === "string") return;
      if (!s || typeof s !== "object" || typeof (s as { name?: unknown }).name !== "string") return add(`scouts[${i}]: a name or { name, schedule, card_limit }`);
      const sc = s as { schedule?: unknown; card_limit?: unknown };
      if (sc.schedule !== undefined && !SCHEDULES.includes(sc.schedule as Schedule)) add(`scouts[${i}].schedule: one of ${SCHEDULES.join(", ")}`);
      if (sc.card_limit !== undefined && (!Number.isInteger(sc.card_limit) || (sc.card_limit as number) < 1)) add(`scouts[${i}].card_limit: a whole number ≥ 1`);
    });
  }
  if (fm.verbs !== undefined) {
    if (!fm.verbs || typeof fm.verbs !== "object") add("verbs: a map of verb → { tier, runs_on, needs }");
    else for (const [name, v] of Object.entries(fm.verbs as Record<string, Record<string, unknown>>)) {
      if (!/^[a-z][a-z0-9-]*$/.test(name)) add(`verbs.${name}: verb names are lowercase`);
      if (!v || typeof v !== "object") { add(`verbs.${name}: an object`); continue; }
      if (v.tier !== undefined && !TIERS.includes(v.tier as Tier)) add(`verbs.${name}.tier: one of ${TIERS.join(", ")}`);
      if (v.runs_on !== undefined && !RUNS_ON.includes(v.runs_on as RunsOn)) add(`verbs.${name}.runs_on: one of ${RUNS_ON.join(", ")}`);
      if (v.needs !== undefined && (!Array.isArray(v.needs) || !v.needs.every((x) => typeof x === "string"))) add(`verbs.${name}.needs: a list`);
      if (!f.bin.includes(name)) add(`verbs.${name}: declared but .hq/bin/${name} is missing or not executable`);
    }
  }
  return errs;
}

const scoutList = (s: HqFrontmatter["scouts"]): ScoutPolicy[] =>
  (s ?? []).map((x) =>
    typeof x === "string"
      ? { name: x, schedule: "daily", card_limit: DEFAULTS.card_limit }
      : { name: x.name, schedule: x.schedule ?? "daily", card_limit: x.card_limit ?? DEFAULTS.card_limit }
  );

const verbMap = (fm: HqFrontmatter, bin: string[]): Record<string, VerbPolicy> => {
  const out: Record<string, VerbPolicy> = {};
  for (const name of new Set([...bin, ...Object.keys(fm.verbs ?? {})])) {
    const v = fm.verbs?.[name] ?? {};
    out[name] = { tier: v.tier ?? DEFAULTS.verbTier[name] ?? "L2", runs_on: v.runs_on ?? "any", needs: v.needs ?? [] };
  }
  return out;
};

const projectName = (f: HqFile) => f.frontmatter.project ?? f.dir.split("/").filter(Boolean).pop() ?? "repo-wide";

/**
 * Merges the root and project files into the policy the Worker enforces. A project can only be
 * stricter than the root: its ceiling is the lower of the two, and `never` lists add up.
 */
export function buildPolicy(files: HqFile[]): Result<RepoPolicy> {
  const errors = files.flatMap(validateFrontmatter);
  const root = files.find((f) => f.dir === "");
  if (!root) errors.push(".hq/HQ.md: the repo has no root .hq/HQ.md");
  const names = new Map<string, string>();
  for (const f of files.filter((x) => x.dir !== "")) {
    const n = projectName(f);
    if (n === "repo-wide") errors.push(`${f.dir}/.hq/HQ.md: "repo-wide" is reserved for the root`);
    if (names.has(n)) errors.push(`${f.dir}/.hq/HQ.md: project "${n}" is also declared in ${names.get(n)}`);
    names.set(n, f.dir);
  }
  if (errors.length || !root) return { ok: false, errors };
  const r = root.frontmatter;
  const rootCeiling = r.tier_ceiling ?? DEFAULTS.tier_ceiling;
  const policy: RepoPolicy = {
    repo: r.repo!,
    inbox_cap: r.inbox_cap ?? DEFAULTS.inbox_cap,
    weekly_budget_usd: r.weekly_budget_usd ?? DEFAULTS.weekly_budget_usd,
    max_open_prs: r.max_open_prs ?? DEFAULTS.max_open_prs,
    wip_per_project: r.wip_per_project ?? DEFAULTS.wip_per_project,
    push: r.push ?? DEFAULTS.push,
    agents: {
      ceo: r.agents?.ceo ?? DEFAULTS.agent,
      scout: r.agents?.scout ?? DEFAULTS.agent,
      executor: r.agents?.executor ?? DEFAULTS.agent,
      reviewer: r.agents?.reviewer ?? r.agents?.ceo ?? DEFAULTS.agent,
    },
    ceo_schedule: r.ceo_schedule ?? DEFAULTS.ceo_schedule,
    tier_ceiling: rootCeiling,
    never: r.never ?? [],
    scouts: scoutList(r.scouts),
    verbs: verbMap(r, root.bin),
    guidance: root.body.trim(),
    projects: {},
  };
  for (const f of files.filter((x) => x.dir !== "")) {
    const fm = f.frontmatter;
    const name = projectName(f);
    policy.projects[name] = {
      name,
      dir: f.dir,
      tier_ceiling: stricterTier(fm.tier_ceiling ?? rootCeiling, rootCeiling),
      scouts: scoutList(fm.scouts),
      never: [...new Set([...(r.never ?? []), ...(fm.never ?? [])])],
      budget_share: fm.budget_share ?? 0,
      verbs: verbMap(fm, f.bin),
      guidance: f.body.trim(),
    };
  }
  return { ok: true, value: policy };
}

export function ceilingFor(policy: RepoPolicy, project: string): Tier {
  return policy.projects[project]?.tier_ceiling ?? policy.tier_ceiling;
}

/**
 * Checks a card against the repo's policy. Refuses cards above the project's ceiling, for unknown
 * projects, or needing verbs the project doesn't have. A `policy` card (an HQ.md edit) is always L3.
 */
export function checkCardAgainstPolicy(card: CardInput, policy: RepoPolicy): string[] {
  const errs: string[] = [];
  if (card.project !== "repo-wide" && !policy.projects[card.project]) {
    errs.push(`project: "${card.project}" has no .hq/HQ.md (known: repo-wide, ${Object.keys(policy.projects).join(", ") || "none"})`);
    return errs;
  }
  if (card.kind === "policy" && card.tier !== "L3") errs.push("tier: policy cards (HQ.md or HQ changes) are always L3");
  const ceiling = ceilingFor(policy, card.project);
  if (tierRank(card.tier) < tierRank(ceiling) && card.kind !== "policy") {
    // A lower tier means more autonomy (L0 = just do it). It may not be more autonomous than the ceiling.
    errs.push(`tier: ${card.project} allows at most ${ceiling} autonomy; resubmit as ${ceiling} or higher`);
  }
  const verbs = card.project === "repo-wide" ? policy.verbs : policy.projects[card.project].verbs;
  for (const v of card.verbs ?? []) if (!verbs[v]) errs.push(`verbs: ${card.project} has no verb "${v}" (has: ${Object.keys(verbs).join(", ") || "none"})`);
  return errs;
}

export interface VerbRequest {
  project: string;
  verb: string;
  dryRun: boolean;
  /** The card this verb runs for, if any; its status decides whether L1+ verbs may run. */
  card?: { tier: Tier; status: string; project: string } | null;
}

/**
 * May this verb run now? L0 verbs and dry runs always may. L1/L2 verbs need an approved card for
 * the same project. L3 verbs never run on HQ's own initiative: only a direct owner action may.
 */
export function checkVerb(req: VerbRequest, policy: RepoPolicy, actor: "owner" | "agent" | "runner"): { allowed: boolean; reason: string; policy?: VerbPolicy } {
  const verbs = req.project === "repo-wide" ? policy.verbs : policy.projects[req.project]?.verbs;
  if (!verbs) return { allowed: false, reason: `unknown project ${req.project}` };
  const v = verbs[req.verb];
  if (!v) return { allowed: false, reason: `${req.project} has no verb ${req.verb}` };
  if (req.dryRun) return { allowed: true, reason: "dry run", policy: v };
  if (v.tier === "L0") return { allowed: true, reason: "L0 verb", policy: v };
  if (v.tier === "L3") {
    return actor === "owner"
      ? { allowed: true, reason: "L3 verb started by the owner", policy: v }
      : { allowed: false, reason: `${req.verb} is L3: only the owner can run it (portal → card → Run)`, policy: v };
  }
  const c = req.card;
  if (!c) return { allowed: false, reason: `${req.verb} is ${v.tier}: it needs an approved card`, policy: v };
  if (c.project !== req.project) return { allowed: false, reason: "the card is for another project", policy: v };
  if (!["approved", "building"].includes(c.status)) return { allowed: false, reason: `the card is ${c.status}, not approved`, policy: v };
  return { allowed: true, reason: `approved ${c.tier} card`, policy: v };
}

/** True when the week's spend has reached the cap: scouts pause, in-flight work continues. */
export const overBudget = (spentUsd: number, policy: Pick<RepoPolicy, "weekly_budget_usd">) => policy.weekly_budget_usd > 0 && spentUsd >= policy.weekly_budget_usd;

/** Is a schedule due, given the last run time? */
export function isDue(schedule: Schedule, lastRun: Date | null, now: Date): boolean {
  if (schedule === "manual") return false;
  if (!lastRun) return true;
  const hours = { hourly: 1, daily: 24, weekly: 24 * 7 }[schedule];
  // 5 minutes of slack so an hourly cron doesn't skip a beat.
  return now.getTime() - lastRun.getTime() >= hours * 3600_000 - 5 * 60_000;
}
