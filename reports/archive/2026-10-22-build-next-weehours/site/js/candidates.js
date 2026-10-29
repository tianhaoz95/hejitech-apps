// heji-build-next, phase B: review site for Wee Hours finished builds on 2026-10-22.
(() => {
  const shot = (src, fit = "cover") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  const none = (why) => () => `<div class="keep"><b>Evidence Available</b><small>${why}</small></div>`;
  const log = (src) => ({ name: "Evidence log", frame: "card", size: [900, 620], render: () => `<iframe class="log" src="media/${src}"></iframe>` });
  const keepMain = (project, name, today) => ({
    id: `${project}-main`, n: 0, name: `${name}: keep main`, group: project,
    tagline: "Don't merge anything for this project", concept: today,
    facts: { Project: `projects/${project}`, Action: "Nothing merged, the branches are deleted" },
    render: () => `<div class="keep"><b>Keep main</b><small>${name} ships nothing this round</small></div>`,
  });

  window.REVIEW = {
    key: "2026-10-22-build-next-weehours-v1",
    dir: "reports/archive/2026-10-22-build-next-weehours",
    repo: "tianhaoz95/hejitech-apps",
    port: 8807,
    project: "projects/weehours",
    context: ["projects/weehours/CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md"],
    brief: "heji-build-next run on 2026-10-22 for Wee Hours: 3 shortlisted proposals were built on local-only branches heji-build/2026-10-22-weehours-* (never pushed) with real test runs, compilation verification, and evidence logs. Crown 🏆 the one to merge (and ♥ any other builds to merge too), write notes for any changes, then Copy summary and paste it back to the agent.",
    title: "Build review 2026-10-22 (Wee Hours)",
    subtitle: "3 finished builds on local branches",
    heading: "Pick what to merge",
    intro: "Every build below is finished, verified code on an isolated local branch. Crown 🏆 a build to merge it, or crown \"Keep main\" to skip. To merge multiple builds, crown one and heart ♥ the others. Write notes for anything to change before merging, then click <b>Copy summary</b> and paste it back to the agent.",
    legend: ["<b>1</b> project", "<b>3</b> finished builds"],
    round: 1,
    frame: "card", size: [900, 620],
    modes: false,
    groups: [
      { id: "weehours", name: "Wee Hours", note: "projects/weehours" },
    ],
    nextSteps: ({ winners, groups }) => {
      const merge = winners.filter((c) => c.facts && c.facts.Branch);
      const skip = groups.filter((g) => !merge.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next **build** review (phase B done): every candidate below is already built on a local-only branch in this checkout. Follow `.claude/skills/heji-build-next/SKILL.md` phase C (§8: merge, clean up, push, release). Also merge any build marked ♥ shortlisted in the sections below (a second or third build in the same project). The user's notes on a build are changes to make on its branch before merging it (§8 step 2).", "",
        merge.length ? "**Merge into main (in this order):**" : "**Nothing picked to merge.** Still clean up the build branches (§8 step 3).",
        ...merge.map((c) => `- ${c.facts.Project}: \`${c.facts.Branch}\` (head \`${c.facts.Commit}\`), ${c.name}; release: ${c.facts.Release || "patch"}`), "",
        skip.length ? `**Not merged (branch deleted, nothing released):** ${skip.join(", ")}.` : "",
        "Then: delete every `heji-build/*` branch and worktree (`.claude/skills/heji-build-next/worktree.sh cleanup`), push main, wait for each merged project's CI to go green, and cut one release per merged project with `scripts/cut_release.sh <project> <level> --notes \"…\" --watch` (dry run first). Never push a heji-build branch.",
      ];
    },
    candidates: [
      keepMain("weehours", "Wee Hours", "Main as it is today: MCP provides raw event lists without precomputed daily pediatric totals, Control Center only exposes voice listening, and milk stash tracks inventory without CDC expiration tracking."),
      {
        id: "weehours-mcp-daily-summary", n: 1, group: "weehours", name: "MCP Daily Aggregates & Pediatric Stats Tool (get_daily_summary)",
        tagline: "Authoritative daily feed volume, diapers, sleep duration and wake windows for AI assistants",
        concept: "When AI agents connect to Wee Hours via MCP and parents ask 'How did baby do today?' or 'What was yesterday's feeding total?', the agent had to fetch up to 100 raw events via list_events and manually parse fluid ounces, calculate sleep stretches, and infer wake windows. This tool computes authoritative daily pediatric metrics directly on the server in a single read-only call.",
        moves: [
          "Exported `dailySummary(d, dateStr?, bottleMlFor?, now?)` and `DailySummary` interface in `@weehours/core`",
          "Registered `get_daily_summary` tool with `readOnlyHint: true` in the MCP Worker",
          "Computes bottle volume, nursing duration and count, wet/dirty/both diapers, sleep totals, longest stretch, and current wake window",
          "Added automated test suite in core.test.ts (25/25 vitest tests pass) and mcp.test.ts (11/11 tests pass)",
          "Added documentation to web agents index and iOS WhatsNewView (version 0.10.0)"
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "S",
          Branch: "heji-build/2026-10-22-weehours-mcp-daily-summary", Commit: "b0c629ea", Base: "main @ 6e75a867",
          Diff: "6 files changed, 276 insertions(+), 3 deletions(-)",
          Tests: "npm run test:weehours: 46 tests pass across @weehours/core, @weehours/glasses, @weehours/web; typecheck: 0 errors",
          Release: "minor (0.9.0 → 0.10.0)",
          Captured: "Real MCP JSON-RPC 2.0 tools/call execution log in media/weehours/mcp-daily-summary.log",
        },
        render: none("MCP JSON-RPC server tool execution logged with full request & response payloads"),
        views: [
          log("weehours/mcp-daily-summary.log"),
        ],
        spec: {
          today: ["mcp.ts only exposed get_status (single text line) and list_events (raw event rows)."],
          proposed: ["Export dailySummary in @weehours/core and expose get_daily_summary tool via Model Context Protocol."],
          files: [
            "projects/weehours/packages/core/src/core.ts",
            "projects/weehours/packages/core/test/core.test.ts",
            "projects/weehours/services/web/src/worker/mcp.ts",
            "projects/weehours/services/web/test/mcp.test.ts",
            "projects/weehours/services/web/agents/index.html",
            "projects/weehours/apps/ios/App/Sources/WhatsNewView.swift"
          ],
          risks: ["Date boundary formatting must use ISO calendar day; verified across UTC and local timezones."],
          verify: ["npm run test:weehours; npm run typecheck:weehours; live MCP tool simulation verified."],
        },
      },
      {
        id: "weehours-control-center-widgets", n: 2, group: "weehours", name: "iOS 18 Control Center Quick-Log Controls",
        tagline: "One-tap Control Center controls to log wet/dirty diapers or toggle sleep with one hand",
        concept: "Parents holding an infant in one arm need to record diaper changes or sleep starts instantly with one tap without waking the baby by speaking or opening the full app. Adding dedicated ControlWidgetButton controls to Control Center and the Lock Screen brings immediate one-handed capture.",
        moves: [
          "Implemented `WetDiaperControl: ControlWidget` using `ControlWidgetButton(action: LogDiaperIntent(kind: .wet))`",
          "Implemented `DirtyDiaperControl: ControlWidget` using `ControlWidgetButton(action: LogDiaperIntent(kind: .dirty))`",
          "Implemented `ToggleSleepControl: ControlWidget` using `ControlWidgetButton(action: ToggleSleepIntent())`",
          "Registered all three controls inside `WeeHoursWidgets: WidgetBundle`",
          "Updated WhatsNewView.swift with version 0.10.0 release notes complying with App Store guidelines"
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "S",
          Branch: "heji-build/2026-10-22-weehours-control-center-widgets", Commit: "25e058f6", Base: "main @ 6e75a867",
          Diff: "3 files changed, 61 insertions(+), 1 deletion(-)",
          Tests: "xcodebuild -scheme Widgets -destination 'generic/platform=iOS Simulator' build: BUILD SUCCEEDED",
          Release: "minor (0.9.0 → 0.10.0)",
          Captured: "xcodebuild Widgets target build log & bundle structure validation in media/weehours/control-center-widgets.log",
        },
        render: none("Control Center controls compiled into Widgets.appex for iOS 18 simulator/device"),
        views: [
          log("weehours/control-center-widgets.log"),
        ],
        spec: {
          today: ["Widgets.swift only registered SpeakControl() for voice logging with no action buttons."],
          proposed: ["Add WetDiaperControl, DirtyDiaperControl, and ToggleSleepControl using ControlWidgetButton in Widgets target."],
          files: [
            "projects/weehours/apps/ios/Widgets/ControlWidgets.swift",
            "projects/weehours/apps/ios/Widgets/Widgets.swift",
            "projects/weehours/apps/ios/App/Sources/WhatsNewView.swift"
          ],
          risks: ["App Store Connect disallows 'Apple' in App Intent / Control strings; checked and clean."],
          verify: ["xcodebuild -project WeeHours.xcodeproj -scheme Widgets build succeeded; embedded appex verified."],
        },
      },
      {
        id: "weehours-milk-stash-expiry", n: 3, group: "weehours", name: "Breast Milk Safe Storage Expiry Tracker",
        tagline: "CDC safe storage expiration tracking (fridge 4d, freezer 6mo) with FIFO batch queue & expiring-soon warnings",
        concept: "The CDC provides strict clinical safety duration limits for expressed breast milk: up to 4 days in the refrigerator and 6 months in the freezer. Wee Hours tracked inventory volume but lacked expiration tracking, risking spoiled milk or confusion over which bag to thaw first. This build computes batch ages, flags expiring-soon batches, and renders First-In, First-Out (FIFO) batch status.",
        moves: [
          "Extended `MilkStash` and `milkStash(...)` in `LogCore/Derive.swift` with CDC clinical duration calculation",
          "Created `MilkStash.Batch` struct with expiration timestamp, `isExpiringSoon`, and `isExpired` flags",
          "Added unit test `testMilkStashCDCExpiration` in `LogCoreTests.swift` (all 94 tests pass)",
          "Enhanced `MilkStashCard` in `HomeView.swift` with expiring-soon warnings and FIFO fridge batch list",
          "Updated `WhatsNewView.swift` for version 0.10.0"
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "M",
          Branch: "heji-build/2026-10-22-weehours-milk-stash-expiry", Commit: "a8dd98ce", Base: "main @ 6e75a867",
          Diff: "4 files changed, 154 insertions(+), 5 deletions(-)",
          Tests: "swift test in LogCore: 94 tests, 0 failures (1 new test testMilkStashCDCExpiration passed)",
          Release: "minor (0.9.0 → 0.10.0)",
          Captured: "LogCore unit test run and CDC clinical guidelines verification in media/weehours/milk-stash-expiry.log",
        },
        render: none("LogCore CDC expiry derivation and MilkStashCard FIFO view verified with test suite"),
        views: [
          log("weehours/milk-stash-expiry.log"),
        ],
        spec: {
          today: ["milkStash in Derive.swift computed total ml without batch expiration dates or expiring-soon warnings."],
          proposed: ["Add CDC expiration derivation to LogCore and display expiring batches + FIFO queue in MilkStashCard."],
          files: [
            "projects/weehours/apps/ios/LogCore/Sources/LogCore/Derive.swift",
            "projects/weehours/apps/ios/LogCore/Tests/LogCoreTests/LogCoreTests.swift",
            "projects/weehours/apps/ios/App/Sources/HomeView.swift",
            "projects/weehours/apps/ios/App/Sources/WhatsNewView.swift"
          ],
          risks: ["FIFO deduction when logging a bottle feed must decrement the oldest batch first; verified."],
          verify: ["swift test in LogCore executed 94 tests with 0 failures."],
        },
      },
    ],
  };
})();
