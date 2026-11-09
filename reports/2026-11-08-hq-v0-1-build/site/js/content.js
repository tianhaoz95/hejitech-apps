// The report's config and its design blocks.
window.REPORT = {
  key: "2026-11-08-hq-v0-1-build-v1", dir: "reports/2026-11-08-hq-v0-1-build", repo: "tianhaoz95/hejitech-apps", port: 8836,
  title: "HQ v0.1: what's built and how to try it",
  project: "projects/hq",
  context: ["projects/hq/CLAUDE.md", "projects/hq/docs/decisions.md", "projects/hq/docs/DEPLOY.md", ".hq/HQ.md", "reports/2026-11-08-hq-prd"],
  brief: "The owner approved the HQ PRD as a first version and asked for the full product to be built autonomously while they were away for four hours, using best judgement for open questions. This report shows what was built, the real runs, what was verified, the decisions made, and what's left for the owner.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh). The work is on the local branch hq/initial (worktree next to the main checkout); nothing is pushed or deployed.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done; pick up from the first open one.` : "",
    "Act on the owner's notes. Don't push, merge to main, deploy or release without the owner saying so.",
  ].filter(Boolean),

  blocks: {
    runsTable: {
      kind: "table", title: "Agent runs on 2026-11-08 (local Worker, Claude Code headless)",
      note: "Costs are what Claude Code reported for each run (total_cost_usd).",
      head: ["Run", "What happened", "Cost"],
      rows: [
        ["Scout: heji-fix-ci (repo-wide)", "Surveyed CI, filed 1 L1 card with 8 evidence items (3 run links, log excerpts, file:line refs) and a dedupe key", "$0.60"],
        ["Build: card hq-20261109-rqhh", "Worktree + npm ci, failing test first, fix, 18/18, commit c330b869, evidence via MCP; runner's own verify: exit 0", "$0.67"],
        ["Review: same card", "Read the diff and evidence, checked every call site, attached \"VERDICT: ship\"", "$0.48"],
        ["Health (no agent)", "Ran 15 health verbs; TinyTouch CI failing on main", "$0"],
        ["Verb: tradeboard release --dry-run", "cut_release.sh refused: not on main (correct)", "$0"],
      ],
    },
    reviewVerdict: {
      kind: "code", title: "The reviewer's verdict (as attached to the card)", lang: "text",
      after: `VERDICT: ship
- Does what the card says and nothing more: 2 files (api.ts need() + test-api.mjs), +16/−3.
  No .hq/ changes, no secrets, and nothing touching tiers, tokens or policy checks (only the
  refusal message text changes; the role check is the same code as before), so L1 is right.
- Logic is correct for every need() call in api.ts: owner-only → "needs the owner token";
  [runner, owner] → "needs a runner or owner token"; [owner, runner] → "needs an owner or runner
  token" …
(It couldn't run the integration test itself: reviewers may not start servers.)`,
    },
    arch: {
      kind: "flow", title: "How the pieces connect (as built)",
      note: "Toggle Today/Proposed: today you start every skill; with HQ the scheduler and runner do, and you decide in the inbox.",
      today: {
        nodes: [
          { id: "you", label: "Owner", sub: "starts every run", col: 0, row: 1, type: "ui" },
          { id: "skills", label: "Repo skills", sub: ".claude/skills", col: 1, row: 0 },
          { id: "ci", label: "CI / crons", sub: ".github/workflows", col: 1, row: 2 },
          { id: "reports", label: "Review sites", sub: "reports/", col: 2, row: 0, type: "store" },
          { id: "rel", label: "cut_release.sh", sub: "scripts/", col: 2, row: 2 },
        ],
        edges: [
          { from: "you", to: "skills", label: "asks" }, { from: "you", to: "ci", label: "checks" },
          { from: "skills", to: "reports", label: "hand-off" }, { from: "you", to: "rel", label: "runs" },
        ],
      },
      proposed: {
        nodes: [
          { id: "cron", label: "Hourly cron", sub: "Worker scheduled()", col: 0, row: 0, state: "new" },
          { id: "runner", label: "Runner (this Mac)", sub: "hq runner · holds keys", col: 0, row: 1, state: "new" },
          { id: "agents", label: "Agents", sub: "claude -p via adapter", col: 0, row: 2, type: "model", state: "new" },
          { id: "worker", label: "HQ Worker", sub: "API · MCP · policy checks", col: 1, row: 1, state: "new" },
          { id: "d1", label: "D1 + R2", sub: "cards, runs, audit, files", col: 1, row: 0, type: "store", state: "new" },
          { id: "repo", label: ".hq/ folders", sub: "HQ.md + bin/ verbs", col: 1, row: 2, state: "new" },
          { id: "portal", label: "Portal + iPhone app", sub: "inbox", col: 2, row: 0, type: "ui", state: "new" },
          { id: "you", label: "Owner", sub: "approve · reject · discuss", col: 2, row: 1, type: "ui" },
          { id: "branch", label: "hq/<card> branches", sub: "worktrees; PRs if push", col: 2, row: 2, state: "new" },
        ],
        edges: [
          { from: "cron", to: "d1", label: "enqueue runs", state: "new" },
          { from: "runner", to: "worker", label: "claim / finish", state: "new" },
          { from: "runner", to: "agents", label: "launch prompt", state: "new" },
          { from: "agents", to: "worker", label: "MCP: cards, evidence", state: "new" },
          { from: "runner", to: "repo", label: "sync · verbs", state: "new" },
          { from: "worker", to: "d1", state: "new" },
          { from: "d1", to: "portal", state: "new" },
          { from: "portal", to: "you", state: "new" },
          { from: "runner", to: "branch", label: "builds", state: "new" },
        ],
      },
    },
    checks: {
      kind: "table", title: "What ran, and where",
      head: ["Check", "Result", "Where"],
      rows: [
        ["@hq/core unit tests", "11 passed", "projects/hq/packages/core/test/core.test.ts"],
        ["@hq/cli tests (fixture repo HQ has never seen)", "7 passed", "projects/hq/apps/cli/test/cli.test.ts"],
        ["Worker integration: the whole loop on a fresh D1", "18 steps passed", "projects/hq/scripts/test-api.mjs"],
        ["Typecheck (core, CLI, portal, Worker)", "clean", "npm run typecheck:hq"],
        ["Portal production build", "ok", "npm run build:hq"],
        ["Coupling: HQ names no project, path or repo tool", "ok (14 other projects)", "projects/hq/scripts/check_coupling.mjs"],
        ["hq lint with dry runs (16 .hq/ folders)", "ok", "npm run -s hq -- lint"],
        ["Isolation (repo rule)", "ok, HQ is BACKEND=none", "scripts/check_isolation.mjs"],
        ["iOS simulator build + screenshots", "ok", "iPhone 18 Pro simulator"],
        ["iOS device build", "codesign errSecInternalComponent (needs a person)", "iPhone 13"],
        ["Portal at 1280 px and 390 px, light + dark", "no console errors, no overflow", "Playwright"],
        ["hq-ci.yml on GitHub", "not run (not pushed)", ".github/workflows/hq-ci.yml"],
      ],
    },
  },
};
