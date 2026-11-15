// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
// Replace the example values; keep the keys new.sh filled in.
window.REPORT = {
  key: "2026-11-14-weehours-ios-release-v1", dir: "reports/2026-11-14-weehours-ios-release", repo: "tianhaoz95/hejitech-apps", port: 8838,   // new.sh fills these
  title: "Wee Hours iOS release: choices for your review",
  project: "projects/weehours",
  context: ["projects/weehours/CLAUDE.md", "projects/weehours/docs/decisions.md (Wee Hours Pro)", "projects/weehours/apps/ios/App/Sources/Pro.swift", "projects/weehours/services/web/src/worker/appstore.ts", "branch weehours-pro (local, not pushed)"],
  brief: "After done, get Wee Hours iOS ready for release as well, act autonomously and use your best judgement, but do not submit; the owner reviews the choices in 6 hours and then decides whether to submit.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh).`,
    "If the owner picks A (Wee Hours Pro): merge branch weehours-pro into main, push, apply the weehours migration to production with the owner's OK, cut Wee Hours 1.1.0, upload the Pro screen as each product's review screenshot, add the group, both subscriptions and the lifetime product for review on their App Store Connect pages, add version 1.1.0 with its build to that draft, and submit only if the owner says so.",
    "If the owner picks B (paid upfront): revert the App Store description and review notes to no in-app purchases, set the owner's price, attach build 202611112316 (1.0.0), and leave Pro unmerged.",
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "Act on the reader's notes below, then update the report.",
  ].filter(Boolean),

  // Design blocks, placed in index.html with <div data-block="<id>"></div>. Kinds and fields: js/design.js.
  blocks: {
    flow: {
      kind: "flow", title: "Who decides whether a household has Pro", note: "Today the app includes everything; with Pro, purchases are checked by the Worker and shared by the household.",
      today: {
        nodes: [
          { id: "app", label: "iPhone app", sub: "allows() is always true", col: 0, row: 0, type: "ui" },
          { id: "db", label: "weehours.entitlements", sub: "one row per household", col: 1, row: 0, type: "store" },
        ],
        edges: [{ from: "app", to: "db", label: "read (unused)" }],
      },
      proposed: {
        nodes: [
          { id: "sk", label: "App Store", sub: "StoreKit 2", col: 0, row: 0, state: "new" },
          { id: "app", label: "iPhone app", sub: "Pro.swift · requirePro", col: 1, row: 0, type: "ui" },
          { id: "w", label: "Worker", sub: "appstore.ts · checks Apple's signature", col: 2, row: 0, state: "new" },
          { id: "p", label: "app_store_purchases", sub: "one row per purchase", col: 3, row: 0, type: "store", state: "new" },
          { id: "e", label: "weehours.entitlements", sub: "best active purchase", col: 3, row: 1, type: "store" },
        ],
        edges: [
          { from: "sk", to: "app", label: "signed transaction", state: "new" },
          { from: "app", to: "w", label: "POST /api/appstore/transactions", state: "new" },
          { from: "sk", to: "w", label: "renewals · refunds", state: "new" },
          { from: "w", to: "p", label: "store", state: "new" },
          { from: "w", to: "e", label: "household plan", state: "new" },
          { from: "e", to: "app", label: "both parents read it" },
        ],
      },
    },
  },
};
