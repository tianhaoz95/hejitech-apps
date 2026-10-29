// heji-build-next, phase A: proposal review for Contempo
(() => {
  const idea = (kind, problem, plan) => () =>
    `<div class="keep" style="padding:40px;text-align:left;place-content:center start">` +
    `<small style="text-transform:uppercase;letter-spacing:.08em;color:#0F4C3A;font-weight:700">${kind}</small>` +
    `<b style="font-size:24px;color:#1A1C20;margin:12px 0 8px">${problem}</b>` +
    `<small style="font-size:15px;color:#4A4F56;line-height:1.4">${plan}</small></div>`;

  const skip = (project, name) => ({
    id: `${project}-skip`, n: 0, name: `${name}: skip`, group: project,
    tagline: "Build nothing for this project this round", concept: "Nothing is built; the proposals stay as notes in this report.",
    facts: { Project: `projects/${project}`, Action: "Nothing built" },
    render: () => `<div class="keep"><b>Skip</b><small>${name} gets no build this round</small></div>`,
  });

  window.REVIEW = {
    key: "2026-10-22-build-next-proposals-contempo-v1",
    dir: "reports/archive/2026-10-22-build-next-proposals-contempo",
    repo: "tianhaoz95/hejitech-apps",
    port: 8805,
    project: "projects/contempo",
    context: [
      "CLAUDE.md",
      ".claude/skills/heji-build-next/SKILL.md (phase B, §3–§7)",
      "projects/contempo/CLAUDE.md",
    ],
    brief: "heji-build-next proposals on 2026-10-22: 10 candidate improvements for Contempo across iOS, Android, Wear OS, and Web. Grounded in the current codebase and external platform standards (IRS IR-2025-128 mileage rates, IRC §469(c)(7), IRC §274(d), WidgetKit, Android Shortcuts). Crown 🏆 the one to build, ♥ any others to build too, or crown 'Skip'.",
    title: "Build proposals Contempo 2026-10-22",
    subtitle: "10 proposals for Contempo",
    heading: "Pick what to build for Contempo",
    intro: "Nothing is built yet. Crown 🏆 the proposal to build, ♥ any others you want built as well (each gets its own branch), or crown <b>Skip</b>. Notes under a proposal change the plan. Then <b>Copy summary</b> and paste it back: the agent builds exactly your picks on local branches, captures real evidence running on devices/simulators, and presents the build review to merge." +
      "<br><br><b>Earlier ledger ideas:</b> Contempo previously merged 4 proposals in v3.2.0 (PDF audit binder export, Dashboard property/category filter and search, Siri/Shortcuts, and Mileage arrival alert). 1 previous idea ('Interactive Entry Creation & Editing on Web Dashboard') was unpicked on 2026-10-21 and is reintroduced here expanded as #6.",
    legend: ["<b>1</b> project (Contempo)", "<b>10</b> proposals"],
    round: 1,
    frame: "card", size: [900, 620],
    modes: false,
    groups: [
      { id: "contempo", name: "Contempo", note: "projects/contempo" },
    ],
    nextSteps: ({ winners, groups }) => {
      const picked = winners.filter((c) => c.facts && c.facts.Kind);
      const skipped = groups.filter((g) => !picked.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next **proposal** review (phase A done). You may be a different agent in a new session or another checkout: this hand-off is the whole brief. Each picked proposal below carries its plan (today's gap with file:line, the proposed change, files, risks, how to verify, what to capture, sources); the review site is committed at the path above (pull main) if you want the full text of the unpicked ones. Follow `.claude/skills/heji-build-next/SKILL.md` phase B (§3–§7): record the decisions in the ledgers, re-check each pick against today's main (the code may have moved since its `Checked on` commit), build the picks on local-only branches, verify, capture, then present the build review. The user's notes on a proposal override its text.", "",
        "**Build, per project:** every 🏆 winner below, plus every proposal marked ♥ shortlisted in that project's section (each on its own branch).",
        ...picked.map((c) => `- ${c.facts.Project}: ${c.name} (\`${c.id}\`), ${c.facts.Kind}, release ${c.facts.Release || "patch"}`), "",
        skipped.length ? `**Build nothing for:** ${skipped.join(", ")} (unless a proposal there is ♥ shortlisted).` : "",
        "Never push a heji-build branch, and put no code on main until the build hand-off comes back (the build branches stay in the checkout that built them, so that hand-off must return there).",
      ];
    },
    candidates: [
      skip("contempo", "Contempo"),
      {
        id: "contempo-ios-widget-live-sync", n: 1, group: "contempo", name: "iOS Widget Live Sync & Home Screen Update",
        tagline: "Sync confirmed hours to HoursProgressStore and reload WidgetCenter on every entry change",
        concept: "projects/contempo/ios/ContempoWidgets/Sources/HoursLockScreenWidget.swift:16 reads HoursProgressStore(appGroupId: \"group.com.hejitech.contempoapp\"), but on iPhone the main app never writes to this store (only the watch app does in WatchCaptureViewModel.swift:109) and never reloads widget timelines. When users add a Contempo widget to their iOS Lock Screen or Home Screen, it displays 0 or stale data that never updates when entries are confirmed or logged.",
        moves: [
          "Write current confirmed hours to HoursProgressStore whenever DashboardViewModel or ConfirmViewModel confirms/loads entries",
          "Call WidgetCenter.shared.reloadTimelines(ofKind: \"HoursLockScreenWidget\") whenever confirmed hours change",
          "Ensure widget timeline updates immediately upon app backgrounding and entry confirmation"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Bug fix", Effort: "S",
          Evidence: "ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift:115 never writes to HoursProgressStore or calls WidgetCenter",
          Release: "patch (3.2.0 → 3.2.1)",
          Captures: "Simulator iPhone 17 (iOS 27) Home Screen and Lock Screen widgets showing confirmed hours updating live after confirming an entry",
          Sources: "https://developer.apple.com/documentation/widgetkit/widgetcenter/reloadtimelines(ofkind:)",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Bug fix", "iPhone widgets stay at 0 hours", "Write confirmed hours to App Group store and reload WidgetCenter on every confirm"),
        spec: {
          today: [
            "HoursLockScreenWidget reads HoursProgressStore(appGroupId: \"group.com.hejitech.contempoapp\").",
            "DashboardViewModel.swift:115 and ConfirmViewModel.swift:390 never write to HoursProgressStore nor call WidgetCenter.shared.reloadTimelines.",
            "Consequently, widgets on the iPhone home and lock screen show 0 hours or stale data."
          ],
          proposed: [
            "Inject HoursProgressStore into DashboardViewModel and ConfirmViewModel.",
            "Whenever confirmedHours changes (or when saving an entry in ConfirmViewModel), write confirmedHours to store and call WidgetCenter.shared.reloadTimelines(ofKind: \"HoursLockScreenWidget\")."
          ],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift",
            "projects/contempo/ios/Contempo/Sources/App/Confirm/ConfirmViewModel.swift",
            "projects/contempo/ios/ContempoWidgets/Sources/HoursLockScreenWidget.swift"
          ],
          risks: [
            "App Group permissions must be active on device; already guarded by optional defaults in HoursProgressStore."
          ],
          verify: [
            "./scripts/install-ios-prod.sh --simulator && xcodebuild test with XCTest in ContempoTests."
          ],
        },
      },
      {
        id: "contempo-android-pdf-audit-binder", n: 2, group: "contempo", name: "Android PDF Audit Binder Export & 2026 Mileage Rates",
        tagline: "Generate paginated IRS audit-defense PDF binder on Android matching iOS, with 2026 72.5¢ rate",
        concept: "android/app/src/main/java/com/hejitech/contempo/ui/export/ExportViewModel.kt:31 hardcodes IRS_STANDARD_MILEAGE_RATE = 0.67 (the 2024 rate; 2026 is 72.5¢ per IRS IR-2025-128 / Notice 2026-05) and only exports raw CSV. Android lacks the CPA-ready, paginated PDF audit binder with legal disclosures under Treas. Reg. §1.469-5T(f)(4) that iOS 3.2.0 introduced in PdfExportGenerator.swift.",
        moves: [
          "Implement PdfExportGenerator in Kotlin using android.graphics.pdf.PdfDocument, paginating summary, time log, mileage log, and flagged entries",
          "Update mileage rate dynamically by tax year (2024: 67¢, 2025: 70¢, 2026: 72.5¢) matching IRS guidelines",
          "Add PDF export button and share intent to ExportViewModel and SettingsScreen"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "android/app/src/main/java/com/hejitech/contempo/ui/export/ExportViewModel.kt:31 hardcodes 0.67 and lacks PDF generation",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Android emulator screenshot of generated PDF audit binder shared via system sheet and rendered in PDF viewer",
          Sources: "https://www.irs.gov/newsroom/irs-issues-standard-mileage-rates-for-2026",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Android has no PDF export and uses 2024 mileage rate", "Build native PdfDocument export matching iOS audit binder with 2026 72.5¢ rate"),
        spec: {
          today: [
            "ExportViewModel.kt only produces a CSV string and uses private const val IRS_STANDARD_MILEAGE_RATE = 0.67 (2024 rate).",
            "Android users cannot produce an IRS-styled PDF audit binder for their CPA."
          ],
          proposed: [
            "Create PdfExportGenerator.kt using android.graphics.pdf.PdfDocument.",
            "Paginate Summary, Time Log, Mileage Log, and Flagged entries with Treas. Reg. §1.469-5T(f)(4) legal notice.",
            "Implement dynamic mileage rates by year: <2024: 0.655, 2024: 0.67, 2025: 0.70, 2026+: 0.725.",
            "Wire into ExportViewModel and add 'Export PDF Audit Binder' button to SettingsScreen.kt."
          ],
          files: [
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/export/PdfExportGenerator.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/export/ExportViewModel.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/settings/SettingsScreen.kt"
          ],
          risks: [
            "Canvas text measurement and page breaks must handle long task descriptions without clipping."
          ],
          verify: [
            "./gradlew :app:testDebugUnitTest and export sample PDF on Android phone emulator."
          ],
        },
      },
      {
        id: "contempo-android-dashboard-filters", n: 3, group: "contempo", name: "Android Dashboard Property/Category Filter & Live Search",
        tagline: "Filter by property and category with text search and owner-only dynamic subtotal on Android",
        concept: "iOS 3.2.0 added property dropdown, category menu, and live search with owner-only dynamic subtotal hours to DashboardViewModel.swift:40-88. Android's DashboardViewModel.kt:27-120 and DashboardScreen.kt:98-250 only show a flat unfiltered list of entries, making it painful for hosts with multiple rental properties to review specific records.",
        moves: [
          "Add selectedProperty, selectedCategory, and searchQuery state to Android DashboardViewModel",
          "Compute filteredEntries and owner-only filteredHours subtotal matching iOS audit rules",
          "Add filter chips and search bar in DashboardScreen above entries list"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "android/app/src/main/java/com/hejitech/contempo/ui/dashboard/DashboardViewModel.kt:109 has no filter or search state",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Android emulator recording of filtering by property and category, searching task text, and dynamic subtotal updating",
          Sources: "–",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Android dashboard cannot filter or search entries", "Port iOS 3.2.0 property/category filter chips, search bar, and owner-only subtotal"),
        spec: {
          today: [
            "DashboardUiState only contains raw entries; DashboardScreen renders LazyColumn with no search or filter controls."
          ],
          proposed: [
            "Add selectedProperty, selectedCategory, and searchQuery to DashboardViewModel StateFlow.",
            "Derive propertyOptions and categoryOptions from current entries.",
            "Compute filteredEntries and filteredHours (owner-hours only, excluding trips/timers).",
            "Render horizontal filter chips and search OutlinedTextField in DashboardScreen."
          ],
          files: [
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/dashboard/DashboardViewModel.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/dashboard/DashboardScreen.kt"
          ],
          risks: [
            "Filter must never inflate confirmedHours toward the annual tax test; filtered subtotal must stay isolated to owner hours."
          ],
          verify: [
            "./gradlew :app:assembleDebug and run unit tests covering filter combinations."
          ],
        },
      },
      {
        id: "contempo-android-mileage-arrival-alert", n: 4, group: "contempo", name: "Android Mileage Stationary Arrival Alert",
        tagline: "Detect when the vehicle stops moving and notify driver to end trip before miles are lost",
        concept: "iOS 3.2.0 added ArrivalDetector.swift to alert drivers who remain stationary for 3 minutes after >0.2 miles of driving so they don't forget to stop their trip. Android's MileageTrackingService.kt:73 tracks continuous GPS fixes without arrival detection, meaning forgotten trips run in the background indefinitely and drain battery.",
        moves: [
          "Add ArrivalDetector to Android MileageTrackingService, monitoring velocity and displacement",
          "Trigger high-priority notification with sound/vibration after 3 minutes stationary following >0.2 mi drive",
          "Provide 1-tap 'Stop Trip' action in notification to finalize and save miles"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "android/app/src/main/java/com/hejitech/contempo/mileage/MileageTrackingService.kt:88 accumulates fixes without stationary detection",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Android emulator recording simulating GPS drive followed by stationary period, triggering the Arrival notification",
          Sources: "–",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Android mileage trips run indefinitely when user forgets", "Add stationary arrival detection and heads-up alert after 3 minutes stopped"),
        spec: {
          today: [
            "MileageTrackingService runs until manually stopped; no stationary detection exists."
          ],
          proposed: [
            "Implement ArrivalDetector.kt to track stationary intervals when speed < 1.0 m/s or displacement < 30m.",
            "Once accumulated distance exceeds 0.2 miles and vehicle is stationary for >= 180 seconds, fire an arrival alert notification with ACTION_STOP_TRIP."
          ],
          files: [
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/mileage/ArrivalDetector.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/mileage/MileageTrackingService.kt"
          ],
          risks: [
            "Traffic jams or long lights: 3-minute threshold and 0.2-mile minimum guard against premature triggers."
          ],
          verify: [
            "Unit tests in ArrivalDetectorTest feeding simulated GPS locations to verify timing and state transitions."
          ],
        },
      },
      {
        id: "contempo-wear-hours-accuracy", n: 5, group: "contempo", name: "Wear OS Hours Accuracy: Owner Role & Tax Year Filter",
        tagline: "Filter wrist complication and progress tile by owner role and current tax year",
        concept: "android/wear/src/main/java/com/hejitech/wear/data/ConfirmedHours.kt:12 calculates wrist hours by selecting all rows where status == 'confirmed'. It fails to filter by isOwnerHours (role_id IS NULL OR role_id = '') and fails to filter by the current tax year, causing HoursComplicationService.kt:37 and ProgressTileService.kt:59 to display inaccurate hours inflated by cleaners, contractors, and previous tax years.",
        moves: [
          "Update fetchConfirmedHours query to filter role_id is null/empty and activity_date in current calendar year",
          "Align Wear OS hours math with Android phone app's TestYearProgress.kt and iOS watch app",
          "Ensure wrist complication and progress tile show true IRS-qualified owner hours"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Bug fix", Effort: "S",
          Evidence: "android/wear/src/main/java/com/hejitech/wear/data/ConfirmedHours.kt:12 selects all confirmed rows without role or date filters",
          Release: "patch (3.2.0 → 3.2.1)",
          Captures: "Wear OS emulator showing complication and tile with test data before (inflated) and after (tax-year owner hours only)",
          Sources: "–",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Bug fix", "Wear OS watch shows inflated hours from cleaners & prior years", "Filter wrist complication and tile queries to owner-only hours in the active tax year"),
        spec: {
          today: [
            "fetchConfirmedHours() sums duration_minutes for all confirmed entries across all roles and all historical years."
          ],
          proposed: [
            "Filter Supabase query or decoded rows for role_id == null || role_id.isEmpty().",
            "Parse activity_date timestamp and require activityDate.year == currentYear, matching TestYearProgress."
          ],
          files: [
            "projects/contempo/android/wear/src/main/java/com/hejitech/wear/data/ConfirmedHours.kt",
            "projects/contempo/android/wear/src/main/java/com/hejitech/wear/tile/ProgressTileService.kt",
            "projects/contempo/android/wear/src/main/java/com/hejitech/wear/complication/HoursComplicationService.kt"
          ],
          risks: [
            "Supabase postgrest filter syntax on null/empty strings must handle both null and empty string representations."
          ],
          verify: [
            "Unit test in ConfirmedHoursTest with mock entry rows for other roles and prior years."
          ],
        },
      },
      {
        id: "contempo-web-entry-management", n: 6, group: "contempo", name: "Web Dashboard Entry Management (Details, Confirm, Delete)",
        tagline: "Interactive Entry detail modal, 1-click confirm, and deletion on the desktop web app",
        concept: "services/web/src/pages/EntriesPage.tsx:7 only renders a flat, read-only <table>. Hosts reviewing their logs on a laptop cannot inspect full entry details (task description, contemporaneity days-late, risk reasons, GPS coordinates, photos), cannot confirm pending reviews, and cannot delete erroneous entries without opening the mobile app.",
        moves: [
          "Add click-to-open Entry detail modal showing task narrative, risk flags, audit lag, and metadata",
          "Add 'Confirm Entry' action with instant RLS update to Supabase contempo.entries",
          "Add 'Delete Entry' action with confirmation dialog for mistaken records"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "projects/contempo/services/web/src/pages/EntriesPage.tsx:7 only reads entries; no view/update/delete actions",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Playwright screenshot of Entry detail modal on Web, confirming a pending entry and deleting an entry",
          Sources: "–",
          "Checked on": "main @ ae27f58a",
          "Proposed before": "2026-10-21, not picked",
        },
        render: idea("Feature", "Web entries table is strictly read-only", "Add click-to-inspect detail drawer, 1-click confirm, and deletion on web"),
        spec: {
          today: [
            "EntriesPage renders static rows; no mutation functions or detail drawers exist in services/web."
          ],
          proposed: [
            "Add EntryDetailModal component to display full metadata (contemporaneity, GPS, notes).",
            "Export confirmEntry and deleteEntry in useEntries.ts using Supabase client.",
            "Wire row click to open the modal and allow confirming pending entries or deleting them."
          ],
          files: [
            "projects/contempo/services/web/src/pages/EntriesPage.tsx",
            "projects/contempo/services/web/src/components/EntryDetailModal.tsx",
            "projects/contempo/services/web/src/hooks/useEntries.ts"
          ],
          risks: [
            "RLS ensures user can only mutate their own rows; optimistic UI should revert on error."
          ],
          verify: [
            "npm test -w @contempo/web and npm run typecheck -w @contempo/web."
          ],
        },
      },
      {
        id: "contempo-web-mileage-tracking", n: 7, group: "contempo", name: "Web Dashboard Mileage & Vehicle Deductions Tracking",
        tagline: "Track business vehicle miles, calculate IRC §274 deductions, and export mileage on web",
        concept: "projects/contempo/services/web/src/lib/entryModel.ts:42 and rows.ts:6 omit miles, isTrip, and mileageCaptureMethod. The web dashboard (DashboardPage.tsx) has zero mileage cards, no vehicle deduction calculations (IRC §274(d) at 72.5¢/mi), and csv.ts cannot export vehicle mileage logs.",
        moves: [
          "Map miles, is_trip, and mileage_capture_method in rows.ts and entryModel.ts",
          "Add Mileage & Vehicle Deductions card to DashboardPage showing total miles and tax deduction in USD",
          "Add Mileage Log section to web CSV export matching iOS and Android formats"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "projects/contempo/services/web/src/lib/entryModel.ts:42 lacks miles and trip fields entirely",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Playwright browser screenshot of Web Dashboard showing Vehicle Mileage card with total miles and deduction tally",
          Sources: "https://www.law.cornell.edu/uscode/text/26/274",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Web dashboard has zero vehicle mileage or tax deduction tracking", "Expose mileage in web models, add IRC §274 tax deduction card, and export mileage CSV"),
        spec: {
          today: [
            "Web ignores miles and is_trip; only durationMinutes is displayed."
          ],
          proposed: [
            "Expose miles, isTrip, and mileageCaptureMethod in Entry model.",
            "Compute total business miles and deduction at 72.5¢/mi in metrics.ts, display card on DashboardPage.",
            "Update csv.ts with a dedicated MILEAGE LOG section."
          ],
          files: [
            "projects/contempo/services/web/src/lib/entryModel.ts",
            "projects/contempo/services/web/src/lib/rows.ts",
            "projects/contempo/services/web/src/lib/metrics.ts",
            "projects/contempo/services/web/src/lib/csv.ts",
            "projects/contempo/services/web/src/pages/DashboardPage.tsx"
          ],
          risks: [
            "Trips with 0 durationMinutes must not distort hours calculations on Dashboard."
          ],
          verify: [
            "npm test -w @contempo/web && npm run typecheck -w @contempo/web."
          ],
        },
      },
      {
        id: "contempo-settings-property-management", n: 8, group: "contempo", name: "Dedicated Properties Management in Settings (iOS & Android)",
        tagline: "View, add, rename, and delete rental properties directly in Settings screen",
        concept: "HelpWalkthroughDialog.swift:29 explicitly tells users to 'Set up your properties: Add properties, pick a capture language, and manage your account here' in Settings. But SettingsScreen.swift:18-200 and SettingsScreen.kt have no Properties section; properties can only be created during entry confirmation in ConfirmScreen. Hosts have no way to configure their property portfolio upfront or rename sold properties.",
        moves: [
          "Add 'Properties' section to iOS SettingsScreen and Android SettingsScreen",
          "Display current saved properties with Add Property dialog and swipe/button to delete or rename",
          "Fulfill walkthrough tutorial promise and enable upfront portfolio setup"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Quality", Effort: "M",
          Evidence: "ios/Contempo/Sources/App/Settings/SettingsScreen.swift:18 has Roles section but no Properties section",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Simulator and emulator screenshots of Settings screen showing Properties section with Add Property dialog",
          Sources: "–",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Quality", "Walkthrough promises property setup in Settings, but screen has no properties section", "Add dedicated Properties section in Settings to add, rename, and delete properties"),
        spec: {
          today: [
            "Properties can only be created/deleted in ConfirmScreen.swift:377 during entry confirmation."
          ],
          proposed: [
            "Observe PropertyRepository in SettingsViewModel (iOS & Android).",
            "Render Properties section in SettingsScreen matching Roles section with Add, Rename, and Delete actions."
          ],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Settings/SettingsScreen.swift",
            "projects/contempo/ios/Contempo/Sources/App/Settings/SettingsViewModel.swift",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/settings/SettingsScreen.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/settings/SettingsViewModel.kt"
          ],
          risks: [
            "Deleting a property must not delete past entries; past entries retain property_name per schema."
          ],
          verify: [
            "Add property in Settings, verify it appears in Capture known properties and Confirm property picker."
          ],
        },
      },
      {
        id: "contempo-configurable-tax-test", n: 9, group: "contempo", name: "Configurable Material Participation Test Target (100h / 500h / 750h REPS)",
        tagline: "Select statutory target in Settings: 100h STR, 500h Material Participation, or 750h REPS",
        concept: "RiskFlags.swift:22 and MaterialParticipationTest.kt:9 hardcode thresholdHours = 100 (STR test 3). Real estate professionals who need 750 hours (IRC §469(c)(7)) or long-term rental hosts operating under the 500-hour test (Treas. Reg. §1.469-5T(a)(1)) cannot customize their goal; all progress rings, pace projections, and CPA audit reports are stuck on 100 hours.",
        moves: [
          "Add 'Target Test' picker in Settings (100h STR Test 3, 500h Material Participation Test 1, 750h REPS §469(c)(7))",
          "Persist target test preference in user settings store across app launches",
          "Dynamically scale Dashboard progress gauge, pace projections, lock screen widgets, and PDF exports"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "ios/ContempoCore/Sources/ContempoCore/Model/RiskFlags.swift:23 hardcodes thresholdHours = 100",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Simulator screenshot of Settings test selector and Dashboard progress gauge scaling to 500h and 750h targets",
          Sources: "https://www.law.cornell.edu/cfr/text/26/1.469-5T",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "All platforms hardcode 100h STR test; 500h and 750h REPS hosts have no target", "Add statutory test selector (100h / 500h / 750h) scaling all progress rings and CPA exports"),
        spec: {
          today: [
            "thresholdHours is a hardcoded constant (100) in MaterialParticipationTest."
          ],
          proposed: [
            "Define MaterialParticipationTest enum with cases str100 (100h), mp500 (500h), reps750 (750h).",
            "Store selected test in TargetTestStore, read dynamically in DashboardViewModel, CaptureViewModel, widgets, and PDF export."
          ],
          files: [
            "projects/contempo/ios/ContempoCore/Sources/ContempoCore/Model/RiskFlags.swift",
            "projects/contempo/ios/Contempo/Sources/App/Settings/SettingsScreen.swift",
            "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift",
            "projects/contempo/android/core/src/main/java/com/hejitech/core/model/MaterialParticipationTest.kt",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/settings/SettingsScreen.kt"
          ],
          risks: [
            "Pace projection math must handle 500h and 750h targets gracefully without dividing by zero on fresh year."
          ],
          verify: [
            "Unit tests in TestYearProgressTests with 100, 500, and 750 targets."
          ],
        },
      },
      {
        id: "contempo-android-launcher-shortcuts", n: 10, group: "contempo", name: "Android Launcher App Shortcuts (Quick Actions)",
        tagline: "Long-press app icon shortcuts for Start Timer, Start Trip, and Voice Capture on Android",
        concept: "iOS 3.2.0 added App Shortcuts for Siri and launcher actions (ContempoIntents.swift). Android has no app shortcuts configured in AndroidManifest.xml or xml/shortcuts.xml, missing standard Android launcher quick actions (long press app icon) for 'Start Timer', 'Start Trip', and 'Voice Capture' that Android users expect.",
        moves: [
          "Define shortcuts in res/xml/shortcuts.xml for Start Timer, Start Trip, and Voice Capture",
          "Configure deep link intent filters in AndroidManifest.xml",
          "Handle deep links in MainActivity to route directly to active timer, GPS trip, or microphone"
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "S",
          Evidence: "android/app/src/main/AndroidManifest.xml has no shortcuts metadata or capture deep links",
          Release: "minor (3.2.0 → 3.3.0)",
          Captures: "Android emulator recording of long-pressing app icon, selecting 'Start Timer', and launching straight into active timer",
          Sources: "https://developer.android.com/develop/ui/views/launch/shortcuts",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Android lacks launcher quick actions for timers and capture", "Add static shortcuts in shortcuts.xml and deep links for Start Timer, Start Trip, and Dictate"),
        spec: {
          today: [
            "Android only has MainActivity with standard launcher intent; no quick actions or capture deep links."
          ],
          proposed: [
            "Add res/xml/shortcuts.xml with static shortcuts and deep links (com.hejitech.contempoapp://start-timer, start-trip, capture).",
            "Handle deep links in MainActivity.kt to trigger timer start, trip start, or capture screen."
          ],
          files: [
            "projects/contempo/android/app/src/main/res/xml/shortcuts.xml",
            "projects/contempo/android/app/src/main/AndroidManifest.xml",
            "projects/contempo/android/app/src/main/java/com/hejitech/contempo/MainActivity.kt"
          ],
          risks: [
            "Must ensure AuthGate validates signed-in state before launching shortcut action."
          ],
          verify: [
            "Launch shortcuts via adb shell am start -d com.hejitech.contempoapp://start-timer."
          ],
        },
      },
    ],
  };
})();
