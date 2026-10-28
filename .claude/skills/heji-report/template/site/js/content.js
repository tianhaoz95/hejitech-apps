// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
// Replace the example values; keep the keys new.sh filled in.
window.REPORT = {
  key: "__SLUG__-v1", dir: "reports/__SLUG__", repo: "__REPO__", port: __PORT__,   // new.sh fills these
  title: "__TITLE__",
  project: "projects/<name>",            // or "repo-wide"
  context: ["projects/<name>/CLAUDE.md", "<the files this report is about>"],  // what an agent reads first
  brief: "the user's ask in their words",  // why this report exists
  // Optional: replaces the hand-off's "What to do next". Gets { ticks: { done, total }, notes }.
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh).`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done; pick up from the first open one.` : "",
    "Act on the reader's notes below, then update the report so it stays the record.",
  ].filter(Boolean),

  // Design blocks, placed in index.html with <div data-block="<id>"></div>. Kinds and fields: js/design.js.
  blocks: {
    flow: {
      kind: "flow", title: "How the pieces connect", note: "Example: replace with the real components, from file paths in the repo.",
      today: {
        nodes: [
          { id: "app", label: "iPhone app", sub: "apps/ios", col: 0, row: 0, type: "ui" },
          { id: "db", label: "Supabase", sub: "schema <name>", col: 1, row: 0, type: "store" },
        ],
        edges: [{ from: "app", to: "db", label: "direct sync" }],
      },
      proposed: {
        nodes: [
          { id: "app", label: "iPhone app", sub: "apps/ios", col: 0, row: 0, type: "ui" },
          { id: "w", label: "Worker", sub: "services/web", col: 1, row: 0, state: "new" },
          { id: "db", label: "Supabase", sub: "schema <name>", col: 2, row: 0, type: "store" },
        ],
        edges: [{ from: "app", to: "w", label: "API", state: "new" }, { from: "w", to: "db", label: "service key", state: "new" }],
      },
    },
    numbers: {
      kind: "chart", type: "bar", title: "Example numbers", unit: "ms",
      note: "Measured numbers carry a source; estimates and targets are drawn dashed.",
      x: ["cold start", "sync"],
      series: [
        { name: "today", values: [820, 340], basis: "measured", source: "<how it was measured>" },
        { name: "target", values: [500, 200], basis: "target" },
      ],
    },
  },
};
