// What a scout or the CEO is told to do, written once for both ways HQ work starts: the runner's
// launch prompt (apps/cli/src/prompts.ts) and a sweep, where any agent connected over MCP calls
// start_sweep and does the due work in its own session (no runner needed). Same text, same rules.

/** Where a repo's skills live, in the order they are looked up. */
export const SKILL_DIRS = [".claude/skills", ".agents/skills", "skills"] as const;

/** How a card is written, for every role that writes one. */
export const CARD_FORMAT = `- why, plan and verify are markdown: short paragraphs, lists, tables, code. Raw HTML in them is shown as text.
- When words aren't enough (an architecture, a data flow, a screen layout, options to choose from), add figures to the card: static HTML/CSS/inline SVG with an id, a title and a height, placed in the text with ![title](figure:<id>) on its own line. No scripts, nothing from the network, no links. Use var(--fg), var(--muted), var(--panel), var(--soft), var(--line), var(--accent), var(--ok), var(--warn), var(--bad) for colours so it reads in light and dark, and draw for a phone's width (an SVG with a viewBox scales).`;

export interface ScoutTask {
  scout: string;
  project: string;
  projectDir: string | null;
  cardLimit: number;
  /** The skill's path when the caller already looked it up; undefined: the agent looks it up itself. */
  skillPath?: string | null;
}

/** One scout's task and rules (no context, no preamble). */
export function scoutTask(o: ScoutTask): string {
  const scope = o.project === "repo-wide" ? "the whole repository" : `project ${o.project}${o.projectDir ? ` (${o.projectDir})` : ""}`;
  const headless = "in HEADLESS MODE: do its investigation exactly as written, but instead of building a review site, asking questions or changing anything, turn each finding into a card with the hq MCP tool create_proposal.";
  const how =
    o.skillPath === undefined
      ? `Look for a skill named "${o.scout}" (${SKILL_DIRS.map((d) => `${d}/${o.scout}/SKILL.md`).join(", ")}). If there is one, follow it ${headless} If there isn't, investigate that area (${o.scout}) with read-only commands and turn real findings into cards with create_proposal.`
      : o.skillPath
        ? `Follow the skill at ${o.skillPath} ${headless}`
        : `There's no skill named "${o.scout}"; investigate that area (${o.scout}) with read-only commands and turn real findings into cards with create_proposal.`;
  return `Scout: ${o.scout}. Scope: ${scope}.
${how}

Rules for this scout:
- Read only. Don't edit files, commit, push, release or deploy. Don't open review sites or ask the user anything.
- At most ${o.cardLimit} cards. Fewer, stronger cards beat many weak ones. Zero cards is a fine result when nothing is wrong.
- Every card needs evidence: links to CI runs, log excerpts, measured numbers with their source, file paths with line numbers.
- Set dedupe_key to a stable id for the finding (e.g. "${o.scout}:<workflow>:<failure-signature>") so the next run doesn't duplicate it.
- Check the open cards and recent decisions in the context first: comment on an existing card instead of duplicating it, and don't re-propose what the owner rejected unless something changed.
- Pick the tier honestly: L0 only for trivial, reversible, tested changes; L1 for fixes you'd build then ask; L2 for features or anything needing a design choice; L3 for releases, secrets, data deletion.
- project is "${o.project}" and source.scout must be "${o.scout}".
${CARD_FORMAT}`;
}

/** The CEO's task (no context, no preamble). */
export const CEO_TASK = `1. list_cards with status ["proposed", "discussing"]. For each, get_card if you need detail.
2. Withdraw duplicates and cards that are no longer true (withdraw_card, say why). Check the repo when a card's claim is cheap to verify.
3. rank_cards: give every remaining proposed card a priority (0–100). Rank by value to the repo's users and its reliability, then cost. Reliability problems on main and release paths come first.
4. If the recent decisions show a pattern (the owner keeps rejecting a kind of card for the same reason), propose ONE "policy" card (tier L3, kind "policy", project "repo-wide") that adds that guidance to the right .hq/HQ.md, quoting the rejections as evidence.
5. Write a short memo (at most 12 lines): what moved, what's stuck, what you'd do next. Put it after "MEMO:" in your reply.

Don't edit files, commit or run verbs.`;

// ── sweeps ───────────────────────────────────────────────────────────────────────────────────

export interface SweepRun {
  id: string;
  kind: "scout" | "ceo";
  scout: string | null;
  project: string | null;
  project_dir: string | null;
  card_limit: number;
}

export interface SweepPlan {
  runs: SweepRun[];
  /** Scouts left out, and why (not due, already running elsewhere). */
  skipped: { scout: string; project: string; reason: string }[];
  /** Requests waiting for an agent: id, project, words. */
  requests: { id: string; project: string | null; body: string }[];
}

/** What start_sweep hands the agent: everything to do, in order, then how to close it. */
export function sweepMarkdown(plan: SweepPlan, context: string): string {
  const scouts = plan.runs.filter((r) => r.kind === "scout");
  const ceo = plan.runs.find((r) => r.kind === "ceo");
  const nothing = !plan.runs.length && !plan.requests.length;
  const parts: string[] = [
    `# HQ sweep`,
    nothing
      ? "Nothing is due and nobody is waiting on an answer: the sweep is done. Say so in one line; there is nothing to finish."
      : `You are doing HQ's sweep in this session: HQ is this repository's autopilot (agents propose, the owner approves, executors build). Do the steps below in order, in this repository's checkout. Work read only throughout: don't edit files, commit, push, release or deploy, and don't ask the user anything; questions go to the owner through cards and answer_request.`,
  ];
  if (nothing) return parts.join("\n\n") + (plan.skipped.length ? `\n\nNot due: ${plan.skipped.map((s) => `${s.scout} (${s.project}): ${s.reason}`).join("; ")}.` : "");
  let step = 1;
  if (plan.requests.length) {
    parts.push(`## ${step++}. Owner requests (first)
For each: claim_request (skip it if refused: another agent has it), look into the repo until you can say concretely what should change, file it with create_proposal and its request_id (usually one card), then answer_request (proposed / question / declined / note). A request approves nothing: pick the tier honestly.

${plan.requests.map((r) => `- ${r.id}${r.project ? ` (${r.project})` : ""}: ${r.body.replace(/\s+/g, " ").slice(0, 400)}`).join("\n")}`);
  }
  for (const s of scouts) {
    parts.push(`## ${step++}. Scout ${s.scout} (${s.project}), run ${s.id}
${s.project && s.project !== "repo-wide" ? `Call get_context with project "${s.project}" first for that project's ceiling, verbs and guidance.\n` : ""}${scoutTask({ scout: s.scout!, project: s.project ?? "repo-wide", projectDir: s.project_dir, cardLimit: s.card_limit })}`);
  }
  if (ceo) parts.push(`## ${step++}. CEO, run ${ceo.id} (after the scouts, so it ranks what they filed)\n${CEO_TASK}`);
  parts.push(`## ${step}. Close the sweep
Call finish_sweep with one entry per run (${plan.runs.map((r) => r.id).join(", ") || "none"}): status "done" (or "failed" if you couldn't do it) and a one-sentence summary of what it found (for the CEO, the memo). Add cost_usd if you know what this session cost. A run you don't close is marked failed after 6 hours, and its scout runs again at its next schedule.${plan.skipped.length ? `\n\nNot in this sweep: ${plan.skipped.map((s) => `${s.scout} (${s.project}): ${s.reason}`).join("; ")}.` : ""}`);
  parts.push(context);
  return parts.join("\n\n");
}
