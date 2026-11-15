// What each role is told to do, written once for both ways HQ work gets done: the runner's launch
// prompts (apps/cli/src/prompts.ts) and a sweep, where any agent connected over MCP calls
// start_sweep and does every kind of queued work in its own session (no runner, no CLI). Same text,
// same rules.

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

/** What an executor does once it is in the card's worktree (the runner and a sweep say the same). */
export function executorSteps(o: { cardId: string; branch: string; worktree: string; base: string }): string {
  return `You're in a git worktree at ${o.worktree} on branch ${o.branch} (from ${o.base}). Only work there.
1. Read the project's CLAUDE.md/AGENTS.md for how to build and test.
2. Make the change the plan describes, as small as it can be. If the plan turns out wrong, do the right smaller thing and say so.
3. Run the project's tests. Show the failure before your fix when there is one. If you start a server, stop it by its PID; never pkill/killall by name (other people's servers run on this machine).
4. Commit on ${o.branch} with a clear message. Don't push, merge, release or deploy; don't touch .hq/ folders.
5. Attach evidence to card ${o.cardId} with the hq MCP tool attach_evidence (phase "build"): the tests you ran and their result (type test), measured before/after numbers with their source (type metric), anything else that proves it works.
If you can't finish, commit nothing broken, attach what you found (type log) and say why.`;
}

/** What a reviewer checks (the runner and a sweep say the same). */
export function reviewChecks(o: { cardId: string; branch: string; where: string; base: string }): string {
  return `The change is on branch ${o.branch} ${o.where}. Review \`git diff ${o.base}...${o.branch}\` and the evidence attached to card ${o.cardId}. You didn't write it, so be skeptical.
- Does it do what the card says, and only that? Any bugs, missing tests, risky edits, secrets, .hq/ changes?
- Does the evidence actually prove it works?
Don't edit anything. Attach ONE evidence item to card ${o.cardId} with attach_evidence: phase "review", type "review", text starting with "VERDICT: ship", "VERDICT: fix first" or "VERDICT: reject", then your reasons in a few bullets.`;
}

/** Answering the owner's comment on a card. */
export const replyTask = (cardId: string) =>
  `Read the latest owner comment on card ${cardId} (get_card). Investigate in the repo if needed (read only). Then answer with the hq MCP tool comment on card ${cardId}: direct, short, with evidence (comments are markdown). If they asked for a different approach, say how the plan changes. Don't edit files.`;

// ── sweeps ───────────────────────────────────────────────────────────────────────────────────

export type SweepKind = "request" | "reply" | "verb" | "health" | "scout" | "ceo" | "build" | "review";

export interface SweepRun {
  id: string;
  kind: SweepKind;
  scout: string | null;
  project: string | null;
  project_dir: string | null;
  card_limit: number;
  /** build, review, reply, and a verb run for a card. */
  card_id?: string | null;
  card_title?: string | null;
  /** build, review: the card's branch (hq/<card>). */
  branch?: string | null;
  /** build: the project's verify verb and the repo's setup verb, repo-relative, when they exist. */
  verify?: string | null;
  setup?: string | null;
  /** verb: which verb (repo-relative path) and whether it's a dry run. */
  verb?: string | null;
  verb_path?: string | null;
  dry_run?: boolean;
  /** health: every health verb to run. */
  health?: { project: string; path: string }[];
  /** request: the request this run answers. */
  request_id?: string | null;
}

export interface SweepPlan {
  runs: SweepRun[];
  /** Work left out, and why (not due, someone else has it, a limit). */
  skipped: { scout: string; project: string; reason: string }[];
  /** Requests waiting for an agent: id, project, words, and the queued run that goes with it. */
  requests: { id: string; project: string | null; body: string; run_id?: string | null }[];
  /** push in the root HQ.md: builds push their branch and open a PR. */
  push?: boolean;
}

/** The verb contract's environment, as a shell prefix (run from the repo root). */
export const verbCommand = (project: string, verb: string, path: string, dryRun = false, root = '"$PWD"') =>
  `HQ_PROJECT=${project} HQ_VERB=${verb} HQ_REPO_ROOT=${root} HQ_DRY_RUN=${dryRun ? "1" : ""} ./${path}${dryRun ? " --dry-run" : ""}`;

/** Lists what HQ reads from the repo (the .hq/ policy files and verbs) on the default branch. */
export const POLICY_FILES_COMMAND = `git fetch -q origin && git ls-tree -r origin/HEAD | grep -E '\\.hq/(HQ\\.md|bin/[^/]+)$'`;

const worktreeCommands = (cardId: string, branch: string) => `\`\`\`sh
root=$(git rev-parse --show-toplevel); wt="$(dirname "$root")/.hq-worktrees/$(basename "$root")-${cardId}"
git -C "$root" fetch -q origin
[ -d "$wt" ] || git -C "$root" worktree add -b ${branch} "$wt" origin/HEAD 2>/dev/null || git -C "$root" worktree add "$wt" ${branch}
\`\`\``;

function step(r: SweepRun, push: boolean): string {
  switch (r.kind) {
    case "reply":
      return `### Reply on card ${r.card_id}${r.card_title ? ` (${r.card_title})` : ""}, run ${r.id}\n${replyTask(r.card_id!)}`;
    case "verb": {
      const env = verbCommand(r.project ?? "repo-wide", r.verb!, r.verb_path!, r.dry_run);
      return `### Verb ${r.verb}${r.dry_run ? " (dry run)" : ""} for ${r.project}, run ${r.id}${r.card_id ? ` (card ${r.card_id})` : ""}
HQ checked the tier${r.card_id ? " and the card's approval" : ""}. From the repo root, run:
\`\`\`sh
${env}
\`\`\`
Close the run with its exit_code and the last part of its output (output). If this machine can't run it (a tool, a key or a signing identity it needs is missing), don't work around that: close it with status "released" and say what's missing, so a machine that can picks it up.`;
    }
    case "health":
      return `### Health check, run ${r.id}
From the repo root, run each and keep the JSON it prints (a non-zero exit means {"ok": false} with the error):
${(r.health ?? []).map((h) => `- ${h.project}: \`${verbCommand(h.project, "health", h.path)}\``).join("\n") || "- (no health verbs)"}
Close the run with health: one { project, data } per project, data being the JSON.`;
    case "scout":
      return `### Scout ${r.scout} (${r.project}), run ${r.id}
${r.project && r.project !== "repo-wide" ? `Call get_context with project "${r.project}" first for that project's ceiling, verbs and guidance.\n` : ""}${scoutTask({ scout: r.scout!, project: r.project ?? "repo-wide", projectDir: r.project_dir, cardLimit: r.card_limit })}`;
    case "ceo":
      return `### CEO, run ${r.id} (after the scouts, so it ranks what they filed)\n${CEO_TASK}`;
    case "build": {
      const branch = r.branch ?? `hq/${r.card_id}`;
      return `### Build card ${r.card_id}${r.card_title ? ` (${r.card_title})` : ""} for ${r.project}, run ${r.id}
The owner approved it. Call get_card ${r.card_id} for the plan, the evidence, the discussion and how it will be verified. Then make its worktree (outside your checkout, so nothing of yours is touched):
${worktreeCommands(r.card_id!, branch)}
${r.setup ? `A fresh worktree has no dependencies: run \`cd "$wt" && ${verbCommand("repo-wide", "setup", r.setup, false, '"$wt"')}\` first.\n` : ""}
${executorSteps({ cardId: r.card_id!, branch, worktree: '"$wt"', base: "origin/HEAD" })}
Also attach the commits (type commit, ref ${branch}, text: the output of \`git -C "$wt" log --oneline origin/HEAD..HEAD\` and \`git -C "$wt" diff --stat origin/HEAD..HEAD\`).
${r.verify ? `Then run the project's own check in the worktree, even if your tests passed: \`cd "$wt" && ${verbCommand(r.project ?? "repo-wide", "verify", r.verify, false, '"$wt"')}\`. Close the run with verify: { exit_code, output } (the last part). A failing verify fails the build.\n` : ""}${push ? `When it's committed${r.verify ? " and verify passed" : ""}, push the branch (\`git push -u origin ${branch}\`) and open a PR for it (\`gh pr create --head ${branch} --title <the card's title>\`, the card's why and verify in the body); pass its URL as pr_url. That's the only push allowed, and nothing gets merged.\n` : "The branch stays local (push is off): don't push it.\n"}Close the run with branch "${branch}", status "done" when it's committed and checked, "failed" when you couldn't (say why), or "released" if this machine can't build this project.`;
    }
    case "review": {
      const branch = r.branch ?? `hq/${r.card_id}`;
      return `### Review card ${r.card_id}${r.card_title ? ` (${r.card_title})` : ""}, run ${r.id}
Another agent built it. If \`git rev-parse --verify ${branch}\` fails here and \`git fetch origin ${branch}\` doesn't bring it (it was built on another machine and never pushed), close this run with status "released" so a session that has the branch reviews it. Otherwise call get_card ${r.card_id}, then:
${reviewChecks({ cardId: r.card_id!, branch, where: "in this repository (use its worktree if it has one)", base: "origin/HEAD" })}`;
    }
    default:
      return "";
  }
}

const SECTIONS: { kinds: SweepKind[]; title: string }[] = [
  { kinds: ["reply"], title: "The owner's comments on cards" },
  { kinds: ["verb", "health"], title: "Verbs and the health check" },
  { kinds: ["scout"], title: "Scouts" },
  { kinds: ["ceo"], title: "The CEO's ranking" },
  { kinds: ["build"], title: "Builds (approved cards)" },
  { kinds: ["review"], title: "Reviews (built by another agent)" },
];

/** What start_sweep hands the agent: everything to do, in order, then how to close it. */
export function sweepMarkdown(plan: SweepPlan, context: string): string {
  const nothing = !plan.runs.length && !plan.requests.length;
  const builds = plan.runs.some((r) => r.kind === "build");
  const parts: string[] = [
    `# HQ sweep`,
    nothing
      ? "Nothing is due and nobody is waiting on an answer: the sweep is done. Say so in one line; there is nothing to finish."
      : `You are doing HQ's sweep in this session: HQ is this repository's autopilot (agents propose, the owner approves, executors build, a second agent reviews). Do the steps below in order, in this repository's checkout. ${builds ? "Builds change code, but only in their own worktree on their hq/ branch; everything else is read only: don't edit or commit anything else" : "Work read only throughout: don't edit files or commit"}, don't merge, release or deploy, don't touch .hq/ folders, and don't ask the user anything; questions go to the owner through cards, comments and answer_request.`,
  ];
  const skippedLine = plan.skipped.length ? `Not in this sweep: ${plan.skipped.map((s) => `${s.scout} (${s.project}): ${s.reason}`).join("; ")}.` : "";
  if (nothing) return parts.join("\n\n") + (skippedLine ? `\n\n${skippedLine.replace("Not in this sweep", "Not due")}` : "");
  let n = 1;
  if (plan.requests.length) {
    parts.push(`## ${n++}. Owner requests (first)
For each: claim_request (skip it if refused: another agent has it), look into the repo until you can say concretely what should change, file it with create_proposal and its request_id (usually one card), then answer_request (proposed / question / declined / note). A request approves nothing: pick the tier honestly.

${plan.requests.map((r) => `- ${r.id}${r.project ? ` (${r.project})` : ""}${r.run_id ? `, run ${r.run_id}` : ""}: ${r.body.replace(/\s+/g, " ").slice(0, 400)}`).join("\n")}`);
  }
  for (const s of SECTIONS) {
    const runs = plan.runs.filter((r) => s.kinds.includes(r.kind));
    if (runs.length) parts.push(`## ${n++}. ${s.title}\n${runs.map((r) => step(r, plan.push === true)).join("\n\n")}`);
  }
  const ids = [...plan.requests.map((r) => r.run_id).filter(Boolean), ...plan.runs.map((r) => r.id)];
  parts.push(`## ${n++}. Refresh HQ's copy of the policy
Run \`${POLICY_FILES_COMMAND}\` and pass its output to sync_policy (as tree, with \`git rev-parse origin/HEAD\` as commit). HQ reads the files themselves from GitHub, so this only tells it where they are; it changes nothing when the policy is unchanged.`);
  parts.push(`## ${n}. Close the sweep
Call finish_sweep with one entry per run (${ids.join(", ") || "none"}): status "done" (or "failed" if you couldn't do it, or "released" to hand it back for another session or machine), a one-sentence summary of what it found or did (for the CEO, the memo), and what each kind asks for above (branch and verify for a build, exit_code and output for a verb, health for the health check). Add cost_usd if you know what this session cost. A run you don't close is marked failed after 6 hours.${skippedLine ? `\n\n${skippedLine}` : ""}`);
  parts.push(context);
  return parts.join("\n\n");
}
