// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
// Replace the example values; keep the keys new.sh filled in.
window.REPORT = {
  key: "2026-11-18-folio-overnight-v1", dir: "reports/2026-11-18-folio-overnight", repo: "tianhaoz95/hejitech-apps", port: 8841,   // new.sh fills these
  title: "Folio: the overnight build",
  project: "projects/folio",
  context: ["projects/folio/CLAUDE.md", "projects/folio/docs/decisions.md", "projects/folio/docs/DEPLOY.md", "projects/folio/services/web/src/worker/service.ts", "projects/folio/services/web/src/worker/mcp.ts"],
  brief: "Build, overnight and autonomously, a product (MCP service + web app) that lets Claude and other agents (Gemini, ChatGPT, Codex, …) collaborate on portable artifacts: create, edit, suggest edits for other agents to act on. Leave the brainstormed extensions out for now; the owner may pick some after reviewing.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and projects/folio/CLAUDE.md.`,
    ticks.total ? `${ticks.done} of ${ticks.total} owner steps are done; help with the first open one if asked.` : "",
    "Build the extensions the reader picked in the notes (each in projects/folio, tested with scripts/test-api.mjs), then deploy and update the docs and this report.",
  ].filter(Boolean),

  blocks: {
    tools: {
      kind: "table", title: "The MCP tools", note: "All take the artifact as a slug, id or Folio URL. Changes accept optional agent and model arguments for attribution.",
      head: ["Group", "Tools", "Who can"],
      rows: [
        ["Find & read", "list_artifacts, get_artifact, read_file, list_versions, diff_versions, get_activity", "anyone with access"],
        ["Create & change", "create_artifact, edit_artifact, restore_version, fork_artifact", "editors (fork: any reader)"],
        ["Propose & review", "suggest_edit, list_suggestions, get_suggestion, revise_suggestion, review_suggestion", "anyone suggests; editors accept/reject"],
        ["Discuss", "comment, list_comments, resolve_comment", "anyone with access"],
        ["Show", "show_artifact (MCP Apps inline view, else a link)", "anyone with access"],
        ["Manage", "update_artifact (title, visibility), share_artifact (invite link)", "owner; delete is web-only"],
      ],
    },
    loop: {
      kind: "steps", title: "Two agents on one artifact (what the integration test plays)",
      steps: [
        { actor: "Claude Code", text: "create_artifact → version 1, a link, a render URL" },
        { actor: "Gemini CLI", text: "get_artifact by URL (head_version 1) → edit_artifact base 1 with a replace op → version 2" },
        { actor: "Claude Code", text: "still on version 1: edits another file → replayed on v2 as v3 (rebased_from 1)" },
        { actor: "Claude Code", text: "overwrites index.html from v1 → 409 stale: Gemini changed it in v2; reads again, retries" },
        { actor: "Gemini CLI", text: "suggest_edit with a rationale → #1, live preview at /r/…/s1/" },
        { actor: "Claude Code", text: "comment on #1 → Gemini replies → review_suggestion accept → version 5" },
        { actor: "Person (web)", text: "sees each step in the activity feed within 5 s; can preview, accept, reject, restore" },
      ],
    },
    arch: {
      kind: "flow", title: "The pieces", note: "One Worker (projects/folio/services/web) on the shared Supabase project.",
      proposed: {
        nodes: [
          { id: "agents", label: "Any MCP client", sub: "Claude · Gemini · ChatGPT · Codex", col: 0, row: 0, type: "external" },
          { id: "web", label: "Web app", sub: "/app · /a/<slug>", col: 0, row: 1, type: "ui" },
          { id: "mcp", label: "MCP + OAuth", sub: "worker/mcp.ts · index.ts", col: 1, row: 0, state: "new" },
          { id: "api", label: "REST API", sub: "worker/api.ts", col: 1, row: 1, state: "new" },
          { id: "svc", label: "Artifact service", sub: "worker/service.ts", col: 2, row: 0, state: "new" },
          { id: "render", label: "Sandboxed render", sub: "/r/… · worker/render.ts", col: 2, row: 1, state: "new" },
          { id: "db", label: "Supabase", sub: "schema + bucket folio", col: 3, row: 0, type: "store", state: "new" },
        ],
        edges: [
          { from: "agents", to: "mcp", label: "tools/call" },
          { from: "web", to: "api", label: "session" },
          { from: "mcp", to: "svc" },
          { from: "api", to: "svc" },
          { from: "svc", to: "db", label: "service key" },
          { from: "render", to: "db" },
        ],
      },
    },
    merge: {
      kind: "table", title: "When an edit is based on an old version", note: "service.ts applyRebased(); suggestions accept with the same rules.",
      head: ["The edit…", "Result"],
      rows: [
        ["touches only files nobody changed since its base", "applied on the head, result says rebased_from"],
        ["uses replace ops on a changed file, and the old text still matches once", "applied on the head"],
        ["writes, deletes or renames a file someone changed since", "409 stale: newer versions, their agents, conflicting paths"],
        ["uses a replace whose text is gone or ambiguous on the head", "409 stale: read again, redo on head_version"],
      ],
    },
    checks: {
      kind: "table", title: "What ran", note: "Local runs on 2026-11-17/18 on this machine; CI ran the unit and integration tests again on main.",
      head: ["Check", "Result", "Where"],
      rows: [
        ["Unit tests: paths, ops (aliases, errors, binary), Myers diff incl. 50 random round-trips, zip CRC, roles, refs", "23 / 23 pass", "packages/core/test/core.test.ts"],
        ["Integration: two MCP agents + two people against Worker + local Supabase", "20 / 20 steps pass", "scripts/test-api.mjs"],
        ["Browser: sign in, workspace, tabs, suggestion preview, history, share, phone width, dark", "renders; sandbox origin null; no page errors", "scripts/browser-check.mjs"],
        ["Typecheck (web, Worker, core) and production build", "pass", "npm run typecheck:folio, build:folio"],
        ["Isolation, Supabase conventions, graduation (migrations replay alone)", "pass", "scripts/check_isolation.mjs, check_supabase.mjs, graduation_check.sh folio"],
        ["CI on main for 318fee1f: Folio CI (both jobs) and Supabase conventions (folio stands alone)", "green", "GitHub Actions runs 44335927989, 44335927677"],
        ["Production smoke: pages, /mcp 401, OAuth metadata, /api/status, a schema query through the Worker", "pass", "curl against folio.hejitech.workers.dev"],
      ],
    },
    ext: {
      kind: "table", title: "Extensions from the brainstorm (not built)",
      head: ["Option", "What it adds", "Rough size"],
      rows: [
        ["Bake-offs", "One brief, several agents each fork it; compare side by side and pick", "small: fork + a compare view"],
        ["File ownership roles", "\"Gemini owns copy.md\": edits outside your files turn into suggestions", "small–medium"],
        ["Live data", "A script refreshes data.json on a schedule (prices, stats); the page re-renders", "medium: cron + a data API"],
        ["Hand-off packets", "One call returns the artifact, open suggestions and recent activity as a brief for a fresh agent", "small"],
        ["HQ integration", "HQ cards link artifacts; sweeps review open suggestions", "medium"],
        ["Provenance badge", "Public \"written by Gemini, edited by Claude, approved by you\" panel", "small"],
      ],
    },
  },
};
