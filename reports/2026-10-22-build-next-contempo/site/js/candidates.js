// heji-build-next, phase B: 6 verified builds for Contempo (2026-10-22).
// Every build is finished code on a local branch (heji-build/2026-10-22-contempo-*);
// each build's evidence log (media/contempo/<slug>.log) records real tests and build commands.
(() => {
  const shot = (src, fit = "contain") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  const log = (src) => ({
    name: "Evidence log",
    frame: "card",
    size: [900, 640],
    render: () => `<iframe class="log" src="media/${src}"></iframe>`
  });

  const keepMain = (project, name, today) => ({
    id: `${project}-main`, n: 0, name: `${name}: keep main`, group: project,
    tagline: "Don't merge anything for this project", concept: today,
    facts: { Project: `projects/${project}`, Action: "Nothing merged, the build branches are deleted" },
    render: () => `<div class="keep"><b>Keep main</b><small>${name} ships nothing this round</small></div>`,
  });

  const base = "main @ 6e75a867";

  window.REVIEW = {
    key: "2026-10-22-build-next-contempo-v1",
    dir: "reports/2026-10-22-build-next-contempo",
    repo: "tianhaoz95/hejitech-apps",
    port: 8806,
    project: "projects/contempo",
    context: ["CLAUDE.md", "projects/contempo/CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md (phase C, §8)"],
    brief: "heji-build-next: 6 builds for Contempo on 2026-10-22. Every build is finished code on a local branch heji-build/2026-10-22-contempo-<slug> (never pushed). Re-verified with real evidence: passing unit tests and simulator/device captures. Crown 🏆 the build to merge; ♥ any others to merge as well; crown \"Keep main\" to merge nothing.",
    title: "Build review: 2026-10-22 — Contempo",
    subtitle: "6 verified builds for Contempo",
    heading: "Pick what to merge",
    intro: "Every build below is finished code on a local branch in this checkout, verified with real builds and passing test suites. Each candidate's <b>Evidence log</b> tab displays the exact command outputs. Crown 🏆 the winner to merge into <code>main</code>, and ♥ any others you also want merged this round. Then <b>Copy summary</b> and paste it back to proceed with Phase C merge, cleanup, and release.",
    legend: ["<b>1</b> project (Contempo)", "<b>6</b> verified builds"],
    round: 1,
    frame: "card",
    size: [900, 620],
    modes: false,
    groups: [
      { id: "contempo", name: "Contempo", note: "projects/contempo · iOS 3.2.0 + Android 3.2.0" },
    ],
    nextSteps: ({ winners, groups }) => {
      const merge = winners.filter((c) => c.facts && c.facts.Branch);
      const skip = groups.filter((g) => !merge.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next **build** review (phase B done): every candidate below is already built and verified on a local-only branch in this checkout. Follow `.claude/skills/heji-build-next/SKILL.md` phase C (§8: merge, clean up, push, release). Also merge any build marked ♥ shortlisted in the sections below.", "",
        merge.length ? "**Merge into main (in this order):**" : "**Nothing picked to merge.** Still clean up the build branches (§8 step 3).",
        ...merge.map((c) => `- ${c.facts.Project}: \`${c.facts.Branch}\` (head \`${c.facts.Commit}\`), ${c.name}; release: ${c.facts.Release || "minor"}`), "",
        skip.length ? `**Not merged (branch deleted, nothing released):** ${skip.join(", ")}.` : "",
        "Then: delete every `heji-build/*` branch and worktree (`.claude/skills/heji-build-next/worktree.sh cleanup`), push main, wait for CI to go green, and cut release with `scripts/cut_release.sh contempo <level> --notes \"…\" --watch` (dry run first). Never push a heji-build branch.",
      ];
    },
    candidates: [
      keepMain("contempo", "Contempo", "Contempo on main @ 6e75a867: local SQLite STR / REPS tax-year audit tracker with whisper transcription, Live Activities, and Apple Watch / Wear OS sync."),

      // ── BUILD 1: iOS Widget Live Sync & Home Screen Update ──────────────────
      {
        id: "contempo-ios-widget-live-sync", n: 1, group: "contempo",
        name: "iOS Widget Live Sync & Home Screen Update",
        tagline: "Sync confirmed hours to HoursProgressStore and reload WidgetCenter on every entry change",
        concept: "HoursLockScreenWidget reads HoursProgressStore(appGroupId: \"group.com.hejitech.contempoapp\"), but on iPhone the main app never wrote to this store and never reloaded widget timelines. This build injects HoursProgressStore into DashboardViewModel and ConfirmViewModel, writes confirmed hours upon entry confirmation, saving, or deletion, and triggers WidgetCenter.shared.reloadTimelines(ofKind: \"HoursLockScreenWidget\").",
        moves: [
          "Inject HoursProgressStore into DashboardViewModel and ConfirmViewModel",
          "Sync confirmed hours on entry confirmation, saving, and deletion",
          "Call WidgetCenter.shared.reloadTimelines(ofKind: \"HoursLockScreenWidget\")"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Bug fix", Effort: "S",
          Branch: "heji-build/2026-10-22-contempo-ios-widget-live-sync", Commit: "9f3bc293", Base: base,
          Diff: "5 files changed, 58 insertions(+), 4 deletions(-)",
          Tests: "xcodebuild test in ContempoTests: 22 tests passed (0 failures)",
          Release: "patch (3.2.0 → 3.2.1)",
          Captured: "Simulator iPhone 17 (iOS 27.0) screenshot in media/contempo/ios-widget-live-sync.png; test log in media/contempo/ios-widget-live-sync.log",
        },
        render: shot("contempo/ios-widget-live-sync.png"),
        views: [
          log("contempo/ios-widget-live-sync.log")
        ],
        spec: {
          today: ["DashboardViewModel and ConfirmViewModel never wrote to HoursProgressStore nor reloaded widget timelines; lock screen widget showed stale 0h."],
          proposed: ["Write confirmedHours to HoursProgressStore and reload WidgetCenter timelines on entry confirmation, saving, and app backgrounding."],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift",
            "projects/contempo/ios/Contempo/Sources/App/Confirm/ConfirmViewModel.swift",
            "projects/contempo/ios/ContempoWidgets/Sources/HoursLockScreenWidget.swift"
          ],
          risks: ["App Group permissions guarded by optional defaults in HoursProgressStore."],
          verify: ["xcodebuild test in ContempoTests passed all 22 tests."]
        }
      },

      // ── BUILD 2: Android PDF Audit Binder Export & 2026 Mileage Rates ───────
      {
        id: "contempo-android-pdf-audit-binder", n: 2, group: "contempo",
        name: "Android PDF Audit Binder Export & 2026 Mileage Rates",
        tagline: "Generate paginated IRS audit-defense PDF binder on Android matching iOS, with 2026 72.5¢ rate",
        concept: "Android previously only exported raw CSV with hardcoded 2024 mileage rate (0.67). This build implements PdfExportGenerator using android.graphics.pdf.PdfDocument, creating paginated audit binders with summary, time logs, mileage logs, and Treas. Reg. §1.469-5T(f)(4) legal disclosures, with IRS mileage rates by tax year (2024: 67¢, 2025: 70¢, 2026+: 72.5¢).",
        moves: [
          "Create PdfExportGenerator with multi-page US Letter layout and custom column formatting",
          "Implement dynamic IRS mileage rates by tax year (2024: 67¢, 2025: 70¢, 2026+: 72.5¢)",
          "Add PDF Export button and FileProvider share intent in SettingsScreen and ExportViewModel",
          "Add unit test PdfExportGeneratorTest covering rate tables and text pagination"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Branch: "heji-build/2026-10-22-contempo-android-pdf-audit-binder", Commit: "32d4c085", Base: base,
          Diff: "6 files changed, 355 insertions(+), 2 deletions(-)",
          Tests: "gradlew test in PdfExportGeneratorTest: 3 tests passed (0 failures)",
          Release: "minor (3.2.0 → 3.3.0)",
          Captured: "OnePlus Open screenshot in media/contempo/android-pdf-audit-binder.png; test log in media/contempo/android-pdf-audit-binder.log",
        },
        render: shot("contempo/android-pdf-audit-binder.png"),
        views: [
          log("contempo/android-pdf-audit-binder.log")
        ],
        spec: {
          today: ["Android ExportViewModel only exported CSV with 0.67 hardcoded mileage rate."],
          proposed: ["Implement PdfExportGenerator using PdfDocument with US Letter layout, dynamic mileage rate by year, and CPA audit binder formatting."],
          files: [
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/export/PdfExportGenerator.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/export/ExportViewModel.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/settings/SettingsScreen.kt",
            "projects/contempo/android/app/src/test/java/com/hejitech/contempo/ui/export/PdfExportGeneratorTest.kt"
          ],
          risks: ["Canvas text measurement handles wrapping and multi-page breaks cleanly."],
          verify: ["gradlew test in PdfExportGeneratorTest: 3 tests passed."]
        }
      },

      // ── BUILD 3: Android Dashboard Property/Category Filter & Live Search ───
      {
        id: "contempo-android-dashboard-filters", n: 3, group: "contempo",
        name: "Android Dashboard Property/Category Filter & Live Search",
        tagline: "Filter by property and category with text search and owner-only dynamic subtotal on Android",
        concept: "Brings Android to parity with iOS 3.2.0: multi-property hosts can filter entry logs by property dropdown, category menu, and live task/notes search text. Computes an owner-only dynamic hours subtotal adhering to IRS material participation rules (excluding trips and contractor hours).",
        moves: [
          "Add selectedProperty, selectedCategory, and searchQuery state to DashboardViewModel",
          "Derive propertyOptions and categoryOptions dynamically from active entries",
          "Calculate owner-only filteredHours subtotal matching statutory tax rules",
          "Render OutlinedTextField search bar and dropdown filter menus in DashboardScreen",
          "Add unit test DashboardFilterTest verifying filters and subtotal calculations"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Branch: "heji-build/2026-10-22-contempo-android-dashboard-filters", Commit: "02f81df7", Base: base,
          Diff: "4 files changed, 308 insertions(+), 3 deletions(-)",
          Tests: "gradlew test in DashboardFilterTest: 3 tests passed (0 failures)",
          Release: "minor (3.2.0 → 3.3.0)",
          Captured: "OnePlus Open screenshot in media/contempo/android-dashboard-filters.png; test log in media/contempo/android-dashboard-filters.log",
        },
        render: shot("contempo/android-dashboard-filters.png"),
        views: [
          log("contempo/android-dashboard-filters.log")
        ],
        spec: {
          today: ["Android DashboardScreen rendered an unfiltered list with no search or category filters."],
          proposed: ["Add property and category filter dropdowns, live search query, and owner-only subtotal calculation."],
          files: [
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/dashboard/DashboardViewModel.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/dashboard/DashboardScreen.kt",
            "projects/contempo/android/app/src/test/java/com/hejitech/contempo/ui/dashboard/DashboardFilterTest.kt"
          ],
          risks: ["Filtered subtotal must count only owner hours (isOwnerHours), excluding trips and contractors."],
          verify: ["gradlew test in DashboardFilterTest: 3 tests passed."]
        }
      },

      // ── BUILD 4: Settings Rental Property Roster Management ─────────────────
      {
        id: "contempo-settings-property-management", n: 4, group: "contempo",
        name: "Settings Rental Property Roster Management",
        tagline: "Dedicated UI in Settings to add, rename, and manage rental properties with default property selection",
        concept: "Properties previously only appeared implicitly from logged entries or GPS geofences. This build adds dedicated Property Management to Settings, allowing hosts to manage their property roster (name, address, default flag), persisted to UserDefaults and wired to EntryRepository.",
        moves: [
          "Create Property struct with id, name, address, and isDefault",
          "Add PropertyListSection and PropertyEditSheet in SettingsScreen",
          "Persist custom property list to UserDefaults via SettingsViewModel",
          "Add unit test PropertyManagementTests for model and repository persistence"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "S",
          Branch: "heji-build/2026-10-22-contempo-settings-property-management", Commit: "b3fec86e", Base: base,
          Diff: "5 files changed, 143 insertions(+)",
          Tests: "xcodebuild test in PropertyManagementTests: 2 tests passed (0 failures)",
          Release: "minor (3.2.0 → 3.3.0)",
          Captured: "Simulator iPhone 17 (iOS 27.0) screenshot in media/contempo/settings-property-management.png; test log in media/contempo/settings-property-management.log",
        },
        render: shot("contempo/settings-property-management.png"),
        views: [
          log("contempo/settings-property-management.log")
        ],
        spec: {
          today: ["Properties were implicit strings gathered from past entries; no way to predefine or manage properties."],
          proposed: ["Add Property roster management in Settings with name, address, and default property selection."],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Settings/SettingsScreen.swift",
            "projects/contempo/ios/Contempo/Sources/App/Settings/SettingsViewModel.swift",
            "projects/contempo/ios/ContempoCore/Sources/ContempoData/Model/Property.swift",
            "projects/contempo/ios/ContempoTests/PropertyManagementTests.swift"
          ],
          risks: ["Default property must stay singular and fallback gracefully."],
          verify: ["xcodebuild test in PropertyManagementTests passed 2 tests."]
        }
      },

      // ── BUILD 5: Configurable Statutory Tax Test Target in Settings ─────────
      {
        id: "contempo-configurable-tax-test", n: 5, group: "contempo",
        name: "Configurable Statutory Tax Test Target in Settings",
        tagline: "Select 100h (STR), 500h (Material Participation), or 750h (REPS) target in Settings with progress bar update",
        concept: "Contempo hardcoded the 500-hour material participation test. Many real estate investors utilize the 100-hour short-term rental (STR) rule under Treas. Reg. §1.469-5T(a)(3) or the 750-hour real estate professional status (REPS) requirement under IRC §469(c)(7). This build introduces StatutoryTaxTest enum and TaxTestStore, letting users pick their target with instant dashboard progress recalculation.",
        moves: [
          "Define StatutoryTaxTest enum (str100, standard500, reps750) with target hours and statutory citations",
          "Create TaxTestStore for persistent App Group / standard storage",
          "Add Tax Test picker in SettingsScreen with threshold and regulatory explanation",
          "Bind DashboardViewModel targetHours to TaxTestStore",
          "Add unit test ConfigurableTaxTestTests"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "S",
          Branch: "heji-build/2026-10-22-contempo-configurable-tax-test", Commit: "da85e8d9", Base: base,
          Diff: "7 files changed, 158 insertions(+), 2 deletions(-)",
          Tests: "xcodebuild test in ConfigurableTaxTestTests: 2 tests passed (0 failures)",
          Release: "minor (3.2.0 → 3.3.0)",
          Captured: "Simulator iPhone 17 (iOS 27.0) screenshot in media/contempo/configurable-tax-test.png; test log in media/contempo/configurable-tax-test.log",
        },
        render: shot("contempo/configurable-tax-test.png"),
        views: [
          log("contempo/configurable-tax-test.log")
        ],
        spec: {
          today: ["Target hours were fixed at 500 hours; STR (100h) and REPS (750h) investors had inaccurate progress bars."],
          proposed: ["Add StatutoryTaxTest enum and TaxTestStore to configure target hours (100h, 500h, 750h) from Settings."],
          files: [
            "projects/contempo/ios/ContempoCore/Sources/ContempoData/Model/StatutoryTaxTest.swift",
            "projects/contempo/ios/ContempoCore/Sources/ContempoData/Store/TaxTestStore.swift",
            "projects/contempo/ios/Contempo/Sources/App/Settings/SettingsScreen.swift",
            "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift",
            "projects/contempo/ios/ContempoTests/ConfigurableTaxTestTests.swift"
          ],
          risks: ["Ensure target hours update recalculates the ring percentage and status label immediately."],
          verify: ["xcodebuild test in ConfigurableTaxTestTests passed 2 tests."]
        }
      },

      // ── BUILD 6: Android App Shortcuts for Fast Entry & Timer ───────────────
      {
        id: "contempo-android-launcher-shortcuts", n: 6, group: "contempo",
        name: "Android App Shortcuts for Fast Entry & Timer",
        tagline: "Static launcher shortcuts: Record Voice Note, Start Mileage Trip, and Log Hours",
        concept: "Implements Android 7.1+ launcher shortcuts (shortcuts.xml) allowing hosts to long-press the Contempo app icon on their home screen or app drawer to immediately trigger voice capture, start mileage tracking, or open the manual entry sheet via deep links.",
        moves: [
          "Define shortcuts.xml with shortcuts for audio note, mileage trip, and manual log",
          "Add launcher icons in res/drawable/ for shortcut items",
          "Register shortcuts metadata and contempo:// deep link schema in AndroidManifest.xml",
          "Add unit test AppShortcutTest verifying URI parsing and intent targets"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "S",
          Branch: "heji-build/2026-10-22-contempo-android-launcher-shortcuts", Commit: "feedffa1", Base: base,
          Diff: "8 files changed, 113 insertions(+)",
          Tests: "gradlew test in AppShortcutTest: 1 test passed (0 failures)",
          Release: "minor (3.2.0 → 3.3.0)",
          Captured: "OnePlus Open screenshot in media/contempo/android-launcher-shortcuts.png; test log in media/contempo/android-launcher-shortcuts.log",
        },
        render: shot("contempo/android-launcher-shortcuts.png"),
        views: [
          log("contempo/android-launcher-shortcuts.log")
        ],
        spec: {
          today: ["Android lacked launcher quick actions; users had to open the app and tap FAB or navigate to tabs."],
          proposed: ["Add shortcuts.xml with static launcher shortcuts for audio memo, mileage tracker, and manual hours log."],
          files: [
            "projects/contempo/android/app/src/main/res/xml/shortcuts.xml",
            "projects/contempo/android/app/src/main/AndroidManifest.xml",
            "projects/contempo/android/app/src/test/java/com/hejitech/contempo/shortcuts/AppShortcutTest.kt"
          ],
          risks: ["Launcher shortcut deep links must route through MainActivity without crashing on cold start."],
          verify: ["gradlew test in AppShortcutTest passed 1 test."]
        }
      },
    ],
  };
})();
