// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
// Replace the example values; keep the keys new.sh filled in.
window.REPORT = {
  key: "2026-10-29-app-store-release-v1", dir: "reports/2026-10-29-app-store-release", repo: "tianhaoz95/hejitech-apps", port: 8820,   // new.sh fills these
  title: "App Store release: Wee Hours, Headway, FitLoop",
  project: "projects/weehours, projects/headway, projects/fitloop",
  context: [
    "projects/weehours/CLAUDE.md", "projects/headway/CLAUDE.md", "projects/fitloop/CLAUDE.md",
    "projects/headway/review.env", "projects/fitloop/review.env", "scripts/review_account.sh", "scripts/cut_release.sh",
  ],
  brief: "Scan Wee Hours, Headway and FitLoop for App Store release readiness, fill every gap that can be filled, and write the remaining work and release instructions with copy and download buttons for everything App Store Connect asks for.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh).`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done; pick up from the first open one.` : "",
    "App Store Connect: read-only checks and draft edits use the team API key (FA_ASC_* env); never submit for review, and leave price, agreements, the App Privacy form and the review contact to the owner.",
    "Act on the reader's notes (commit/push, porting Apple token revocation, the FitLoop agent default, the Wee Hours price), then update this report.",
  ].filter(Boolean),
  blocks: {},
};
