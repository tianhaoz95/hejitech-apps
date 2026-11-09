// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-11-08-hq-prd-v1", dir: "reports/2026-11-08-hq-prd", repo: "tianhaoz95/hejitech-apps", port: 8835,
  title: "HQ — product requirements (draft)",
  project: "repo-wide (proposed new project: HQ)",
  context: ["CLAUDE.md", "README.md", "supabase/GRADUATION.md", "scripts/cut_release.sh", ".claude/skills/heji-build-next/SKILL.md", ".claude/skills/heji-fix-ci/SKILL.md", ".claude/skills/heji-update-toolchain/SKILL.md"],
  brief: "A new self-contained, portable product (HQ) that acts as the repo's CEO on autopilot: scheduled agents find maintenance, reliability, performance and opportunity work and propose it; the owner approves, rejects or discusses in a web and iOS portal with minimal time. Brand-new ideas stay with the owner. This PRD collects what was decided in discussion for the owner to review.",
  nextSteps: ({ ticks }) => [
    `Read the PRD at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh).`,
    ticks.total ? `${ticks.done} of ${ticks.total} review items are ticked.` : "",
    "Apply the owner's notes and answers to Q1–Q7 to the PRD so it stays the record, and bump REPORT.key.",
    "Once the three contracts are approved, scaffold the project with heji-new-project and start phase 1. Don't build before the owner approves.",
  ].filter(Boolean),

  blocks: {
    arch: {
      kind: "flow", title: "How the pieces connect",
      note: "Today the owner starts every skill and collects results from many places. Proposed: HQ schedules agents, holds one queue, and runs verbs through a policy check.",
      today: {
        nodes: [
          { id: "you", label: "Owner", sub: "starts every run", col: 0, row: 1, type: "ui" },
          { id: "skills", label: "Repo skills", sub: ".claude/skills", col: 1, row: 0 },
          { id: "ci", label: "CI / crons", sub: ".github/workflows", col: 1, row: 2 },
          { id: "reports", label: "Review sites", sub: "reports/, one port each", col: 2, row: 0, type: "store" },
          { id: "mem", label: "Owner steps", sub: "memory notes", col: 2, row: 1, type: "store" },
          { id: "rel", label: "cut_release.sh", sub: "scripts/", col: 2, row: 2 },
        ],
        edges: [
          { from: "you", to: "skills", label: "asks" },
          { from: "you", to: "ci", label: "checks" },
          { from: "skills", to: "reports", label: "hand-off" },
          { from: "skills", to: "mem" },
          { from: "you", to: "rel", label: "runs" },
        ],
      },
      proposed: {
        nodes: [
          { id: "sched", label: "HQ scheduler", sub: "Worker cron", col: 0, row: 0, state: "new" },
          { id: "ceo", label: "CEO + scouts", sub: "any agent, via adapter", col: 0, row: 1, type: "model", state: "new" },
          { id: "repo", label: ".hq/ + skills", sub: "in the repo", col: 0, row: 2, state: "new" },
          { id: "mcp", label: "HQ MCP + API", sub: "policy checks", col: 1, row: 1, state: "new" },
          { id: "store", label: "HQ store", sub: "cards, decisions, audit", col: 1, row: 0, type: "store", state: "new" },
          { id: "exec", label: "Executor", sub: "cloud or Mac runner, holds keys", col: 1, row: 2, state: "new" },
          { id: "portal", label: "Inbox", sub: "web + iOS", col: 2, row: 0, type: "ui", state: "new" },
          { id: "you", label: "Owner", sub: "~10 min/day", col: 2, row: 1, type: "ui" },
          { id: "ship", label: "PRs, CI, cut_release.sh", sub: "unchanged", col: 2, row: 2 },
        ],
        edges: [
          { from: "sched", to: "ceo", label: "launches", state: "new" },
          { from: "ceo", to: "repo", label: "reads", state: "new" },
          { from: "ceo", to: "mcp", label: "cards", state: "new" },
          { from: "mcp", to: "store", state: "new" },
          { from: "store", to: "portal", state: "new" },
          { from: "portal", to: "you", label: "approve", state: "new" },
          { from: "mcp", to: "exec", label: "run_verb", state: "new" },
          { from: "exec", to: "ship", label: "verbs", state: "new" },
        ],
      },
    },

    loop: {
      kind: "steps", title: "The core loop",
      steps: [
        { actor: "Scouts", text: "Run on a schedule, each owning one signal: CI health, build verdicts, toolchain and dependency age, CVEs, performance, user feedback, new platform APIs, stagnating projects." },
        { actor: "Scouts", text: "Emit proposal cards through hq.create_proposal. No evidence, no card." },
        { actor: "CEO", text: "Deduplicates, ranks and keeps the inbox at its daily cap; writes the weekly memo." },
        { actor: "Owner", text: "Approves, rejects with a reason, or discusses. L0 cards skip this and show in the digest." },
        { actor: "Executor", text: "Builds on a branch and attaches evidence: screenshots, before/after numbers, failing-then-passing tests." },
        { actor: "Reviewer", text: "A separate agent checks the build before the owner sees it." },
        { actor: "Executor", text: "Ships through the project's verbs (bin/release wraps cut_release.sh)." },
        { actor: "HQ", text: "Records the outcome; repeated rejection patterns become proposed HQ.md edits; scouts are scored by acceptance rate." },
      ],
    },

    cardSchema: {
      kind: "code", title: "Proposal card (draft schema)", lang: "yaml",
      note: "Validated by hq.create_proposal. Fields marked required are rejected if missing.",
      after: `id: hq-2026-11-08-014            # assigned by HQ
repo: hejitech-apps
project: waypack                   # or "repo-wide"
kind: reliability                  # maintenance | reliability | performance | opportunity | portfolio
title: "Mac release job fails on notarytool timeout"     # required
why: |                             # required: the problem, in plain words
  Two of the last five Mac releases failed at notarization ...
evidence:                          # required: at least one
  - { type: ci_run,  ref: "<run URL>" }
  - { type: metric,  name: "notarize p95", value: 14.2, unit: min, source: "last 10 runs" }
plan: |                            # required: what will change
  Retry with backoff; poll status instead of --wait ...
verify: |                          # required: how we'll know it worked
  Next two releases notarize; dry-run job passes.
tier: L1                           # required; capped by HQ.md tier_ceiling
effort: S                          # S | M | L
risk: low                          # low | medium | high, with a reason
verbs: [verify, release]           # verbs the execution will need
source: { scout: heji-fix-ci, agent: claude, session: "<id>" }
status: proposed                   # set by HQ`,
    },

    layout: {
      kind: "code", title: ".hq/ layout in this monorepo", lang: "text",
      after: `.hq/                            # repo-wide
  HQ.md                         # policy (frontmatter) + guidance (prose)
  bin/health                    # JSON: CI, deploys across the repo
projects/<name>/.hq/            # one per project; moves with it on graduation
  HQ.md
  bin/health                    # JSON health for this project
  bin/verify                    # runs the tests CLAUDE.md names; exit code + JSON
  bin/release                   # exec scripts/cut_release.sh <name> "$@"
  bin/evidence                  # optional: screenshots/numbers for a change`,
    },

    hqmd: {
      kind: "code", title: "projects/tradeboard/.hq/HQ.md (example, the strictest case)", lang: "markdown",
      after: `---
hq: 1
tier_ceiling: L1                 # enforced by HQ code
scouts: [heji-fix-ci, heji-update-toolchain, deps]
never: [live-orders, secrets, delete-data]
budget_share: 0.10
verbs:
  verify:  { tier: L0, runs_on: cloud }
  release: { tier: L3, runs_on: cloud, needs: [deploy] }
---

# Tradeboard: HQ guidance

Real-money trading. Reliability and correctness beat features.
Any change near order placement is L2 at minimum, even a refactor.
The owner trades from the portal daily; don't break the minute cron.
How to build and test: see CLAUDE.md (don't duplicate it here).`,
    },

    verbs: {
      kind: "table", title: "Verb contracts",
      note: "All verbs: no prompts, JSON on stdout, meaningful exit code. Side-effecting verbs must support --dry-run. A missing verb just means HQ won't offer the actions that need it.",
      head: ["Verb", "Does", "Side effects", "Typical tier"],
      rows: [
        ["health", "Reports CI, latest build verdict, deploy freshness, dependency age", "none", "L0"],
        ["verify", "Runs the project's tests and checks", "none", "L0"],
        ["evidence", "Captures screenshots, GIFs or numbers for a change", "none", "L0"],
        ["release", "Wraps scripts/cut_release.sh", "publishes; --dry-run required", "L3 (Q3)"],
        ["rollback", "Optional: reverts a deploy", "yes; --dry-run required", "L2"],
      ],
    },

    headless: {
      kind: "code", title: "Headless skill contract (draft)", lang: "text",
      note: "Same skill, two modes. Interactive mode is unchanged; headless mode replaces the review site or chat answer with cards.",
      after: `Invocation   HQ's launch prompt says: mode=headless, card_limit=N, context=<hq.get_context result>
Must         investigate as usual; call hq.create_proposal for each finding (schema: card)
Must not     open review sites, ask questions, push, release, or write outside a scratch dir
Ends with    a one-line summary: cards created, findings skipped and why
Skill side   a "Headless mode" section in SKILL.md saying how findings map to cards`,
    },

    mcp: {
      kind: "table", title: "HQ MCP tools",
      head: ["Tool", "Who calls it", "What it does"],
      rows: [
        ["get_context(repo, project?)", "every agent", "Merged HQ.md policy + live state: inbox, budget left, open PRs, recent decisions, taste"],
        ["create_proposal(card)", "scouts, CEO", "Validates the schema, evidence and tier ceiling; stores the card"],
        ["list_inbox / get_card", "CEO, owner's agents", "Read the queue and a card's thread"],
        ["comment(card, text)", "agents, portal", "Adds to a card's discussion; resumes the writing session"],
        ["record_decision(card, decision, reason)", "portal only", "Approve or reject; agents can't approve their own cards"],
        ["claim_work(card)", "executors", "Takes an approved card; enforces one executor per project"],
        ["run_verb(project, verb, args)", "executors", "Checks tier, budget and approval, then runs the verb where runs_on says"],
        ["attach_evidence(card, item)", "executors, reviewer", "Screenshots, numbers, test runs, review verdict"],
      ],
    },

    tiersTable: {
      kind: "table", title: "Autonomy tiers",
      head: ["Tier", "What happens", "Examples"],
      rows: [
        ["L0: just do it", "Builds and auto-merges on green CI; reported in the digest", "Archive finished reports, patch bumps, doc and lint fixes, re-run a flaky job"],
        ["L1: build, then ask", "A finished PR with evidence waits for one tap", "Bug fixes, performance work, minor upgrades, CI fixes"],
        ["L2: ask, then build", "A short pitch waits for approval before any work", "Features, schema migrations, UX changes, new project ideas (Q2)"],
        ["L3: never autonomous", "HQ at most prepares a checklist", "App Store review submissions, secrets and certificates, deleting data, anything placing trades, any .hq/ or HQ change, releases (Q3)"],
      ],
    },

    migration: {
      kind: "table", title: "Migration order",
      note: "Exit test = when the old way can retire.",
      head: ["Step", "What moves to HQ", "Exit test"],
      rows: [
        ["1. heji-fix-ci", "Scheduling + output as cards", "2–3 weeks without running it by hand; its cards were good"],
        ["2. heji-update-toolchain", "Scheduling + cards; first L0 auto-merges", "Patch bumps merge on their own with no reverts"],
        ["3. Owner steps", "Open steps from reports and memory notes become cards", "No new owner steps written to memory notes"],
        ["4. heji-build-next", "Proposal site → inbox; build review → L1 PRs", "A full round runs through HQ; needs Q1 answered"],
        ["5. Review-site hand-offs", "\"Copy summary\" becomes \"Send to HQ\"; candidate-review stays for visual choices", "Hand-offs tracked as cards"],
      ],
    },

    phases: {
      kind: "table", title: "Phases",
      note: "Durations are estimates, not commitments.",
      head: ["Phase", "Delivers", "Estimate"],
      rows: [
        ["0. Contracts", "Card schema, .hq/ spec, headless contract approved (this PRD)", "this review"],
        ["1. Cards flowing", "Worker + store + MCP (get_context, create_proposal), scheduler, heji-fix-ci as scout, basic web inbox, root .hq/", "~1 week"],
        ["2. Portal", "Discuss threads, digest, health board, kill switch, budget", "~1 week, alongside calibration"],
        ["3. Executors", "run_verb, Mac runner, reviewer agent, L1 PRs, then L0 auto-merge", "~1–2 weeks"],
        ["4. iOS app", "Inbox, swipe triage, daily push", "~1 week + TestFlight"],
        ["5. Learning", "Taste → HQ.md proposals, scout scores, tier promotion, CEO comparison", "ongoing"],
      ],
    },

    metrics: {
      kind: "table", title: "Success measures (targets)",
      note: "All targets, to be measured from HQ's audit log once phase 1 runs.",
      head: ["Measure", "Target"],
      rows: [
        ["Owner time in the portal", "≤ 10 min/day median"],
        ["Card approval rate", "≥ 50% (lower means scouts make busywork)"],
        ["Cards with evidence", "100% (enforced)"],
        ["Shipped changes reverted", "≤ 5%"],
        ["Time main stays CI-red", "trending down month over month"],
        ["Spend", "within the weekly cap (Q4)"],
      ],
    },
  },
};
