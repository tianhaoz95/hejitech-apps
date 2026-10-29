// heji-build-next, phase A: proposal review site
(() => {
  const shot = (src, fit = "contain") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  const idea = (kind, problem, plan) => () =>
    `<div class="keep" style="padding:40px;text-align:left;place-content:center start">` +
    `<small style="text-transform:uppercase;letter-spacing:.08em">${kind}</small>` +
    `<b style="font-size:26px;color:#222">${problem}</b><small>${plan}</small></div>`;
  const skip = (project, name) => ({
    id: `${project}-skip`, n: 0, name: `${name}: skip`, group: project,
    tagline: "Build nothing for this project this round", concept: "Nothing is built; the proposals stay as notes in this report.",
    facts: { Project: `projects/${project}`, Action: "Nothing built" },
    render: () => `<div class="keep"><b>Skip</b><small>${name} gets no build this round</small></div>`,
  });

  window.REVIEW = {
    key: "2026-10-21-build-next-proposals-v1",
    dir: "reports/archive/2026-10-21-build-next-proposals",
    repo: "tianhaoz95/hejitech-apps",
    port: 8801,
    project: "",
    context: ["CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md (phase B, §3–§7)", "projects/<name>/CLAUDE.md of each project picked below"],
    brief: "heji-build-next proposals on 2026-10-21: 5 proposals per project across 6 active projects (excluding ToddlerCam and TinyTouch per prompt). Each proposal is grounded in today's code gaps on main @ b049258e and outside platform/library evolutions. Per project, crown 🏆 the one to build and ♥ any others to build too; crown \"Skip\" to build nothing there.",
    title: "Build proposals 2026-10-21",
    subtitle: "30 proposals across 6 projects (excluding ToddlerCam and TinyTouch)",
    heading: "Pick what to build",
    intro: "Nothing is built yet. Per project, crown 🏆 the proposal to build, ♥ any others you want built as well (each gets its own branch), or crown <b>Skip</b>. Notes under a proposal change the plan. Then <b>Copy summary</b> and paste it back: the agent builds exactly your picks on local branches, captures them running and comes back with a second review to choose what to merge." +
      "<br><br><b>Excluded per invocation:</b> <code>toddlercam</code>, <code>tinytouch</code> (skipped as requested). No prior ledgers existed in <code>projects/*/build-next.md</code>.",
    legend: ["<b>6</b> projects", "<b>30</b> proposals"],
    round: 1,
    frame: "card", size: [900, 620],
    modes: false,
    groups: [
      { id: "contempo", name: "Contempo", note: "projects/contempo" },
      { id: "feedbackkit", name: "FeedbackKit", note: "projects/feedbackkit" },
      { id: "meowtrix", name: "Meowtrix", note: "projects/meowtrix" },
      { id: "voxbrief", name: "Voxbrief", note: "projects/voxbrief" },
      { id: "waypack", name: "Waypack", note: "projects/waypack" },
      { id: "weehours", name: "Wee Hours", note: "projects/weehours" },
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
      // ═══════════════════════════════════════════════════════════════════════
      // CONTEMPO
      // ═══════════════════════════════════════════════════════════════════════
      skip("contempo", "Contempo"),
      {
        id: "contempo-app-shortcuts", n: 1, group: "contempo", name: "App Shortcuts & Siri Voice Logging via AppIntents",
        tagline: "Hands-free work timer & hour logging via Siri Shortcuts",
        concept: "Contempo only declares LiveActivityIntent pause/resume buttons in PauseResumeIntents.swift:42. It lacks AppShortcutsProvider and dedicated AppIntents for starting/stopping work timers and logging STR hours by voice. Hosts frequently arrive at rental properties with hands full or while driving, where Siri hands-free logging is critical for contemporaneous compliance.",
        moves: [
          "Define StartWorkTimerIntent, StopWorkTimerIntent, and LogSTRHoursIntent conforming to AppIntent",
          "Provide ContempoShortcutsProvider registering localized Siri phrases (e.g., 'Start work timer in Contempo', 'Log rental hours in Contempo')",
          "Hook into TimerEntryCoordinator and SupabaseEntryRepository in the shared extension container",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "projects/contempo/ios/Contempo/Sources/Shared/LiveActivityIntents/PauseResumeIntents.swift:42 only implements LiveActivityIntent",
          Release: "minor",
          Captures: "Shortcuts app action list, Siri intent invocation simulation, and updated active timer state",
          Sources: "https://developer.apple.com/documentation/appintents/appshortcutsprovider",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "No hands-free Siri or App Shortcuts for starting timers or logging hours", "Add AppIntents & AppShortcutsProvider for Siri work logging"),
        spec: {
          today: ["PauseResumeIntents.swift:42 only exposes pause/resume live activity buttons for an already-open entry; no top-level AppIntent or AppShortcutsProvider exists."],
          proposed: ["Create ContempoIntents.swift declaring StartWorkTimerIntent, StopWorkTimerIntent, LogHoursIntent, and ContempoShortcutsProvider."],
          files: [
            "projects/contempo/ios/Contempo/Sources/Shared/ContempoIntents.swift (new)",
            "projects/contempo/ios/project.yml",
          ],
          risks: ["Intent execution must safely access SupabaseEntryRepository without requiring UI launch."],
          verify: ["xcodegen generate, swift build / test, and verify intent resolution via xcrun simctl."],
        },
      },
      {
        id: "contempo-pdf-audit-binder", n: 2, group: "contempo", name: "IRS Audit-Ready PDF Binder Export",
        tagline: "Formatted PDF compliance report with Treas. Reg. §1.469-5T(f)(4) certificate",
        concept: "ExportGenerator.swift:23 only exports raw CSV strings. During an IRS material participation examination, tax courts and CPAs demand structured, contemporaneous log binders with summary breakdowns, contemporaneity rating (logged within 24h vs late), and IRC §274(d) mileage logs. Furthermore, the IRS standard mileage rate in ExportGenerator.swift:9 is hardcoded to the 2024 rate ($0.67/mi) instead of current rates.",
        moves: [
          "Create PdfExportGenerator using UIGraphicsPDFRenderer / PDFKit for multi-page formatted audit binder",
          "Include Annual Participation Test Certificate (100h / 500h comparison), category breakdowns, and contemporaneity timeliness badges",
          "Update IRS mileage rate table to support 2024 ($0.67), 2025 ($0.70), and 2026 ($0.705)",
          "Add 'Export PDF Audit Binder' button alongside CSV export in Export/Settings views",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "projects/contempo/ios/Contempo/Sources/App/Export/ExportGenerator.swift:23 only provides generateCsv; rate is hardcoded to 0.67",
          Release: "minor",
          Captures: "Before/after export UI, rendered PDF page previews in Light/Dark mode",
          Sources: "https://www.irs.gov/newsroom/irs-sets-standard-mileage-rates",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Only raw CSV export available; outdated 2024 mileage rate", "Add paginated PDF Audit Binder export and updated IRS mileage rates"),
        spec: {
          today: ["ExportGenerator.swift:9 has hardcoded mileageRatePerMile = 0.67 and only produces a plain CSV text file."],
          proposed: ["Implement PdfExportGenerator rendering multi-page audit report with Cover Certificate, Time Log, and IRC §274(d) Mileage Log."],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Export/PdfExportGenerator.swift (new)",
            "projects/contempo/ios/Contempo/Sources/App/Export/ExportGenerator.swift",
            "projects/contempo/ios/Contempo/Sources/App/EntryDetail/EntryDetailScreen.swift",
          ],
          risks: ["Pagination must cleanly break tables without truncating log rows."],
          verify: ["Generate sample PDF with 100+ entries, verify layout bounds and page numbering in test suite."],
        },
      },
      {
        id: "contempo-dashboard-filters", n: 3, group: "contempo", name: "Property & Category Filter with Instant Subtotals",
        tagline: "Filter dashboard timeline by property and category with dynamic hours calculation",
        concept: "DashboardScreen.swift:65 and DashboardViewModel.swift:11 present an all-or-nothing entry list. Multi-property STR owners cannot isolate progress or audit logs for a single property without exporting. Adding filter pill selectors directly on the Dashboard provides instant property-specific hour subtotals against test goals.",
        moves: [
          "Add property filter menu and category chip bar above the Dashboard entry list",
          "Compute filtered confirmed hours and test progress on selected property subset in DashboardViewModel",
          "Persist filter selection across app launches in user preferences",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Quality", Effort: "S",
          Evidence: "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift:11 lacks filtering state; DashboardScreen.swift:65 renders all entries",
          Release: "patch",
          Captures: "Dashboard with property filter active and re-calculated progress bar",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Dashboard displays all entries mixed with no property/category filter", "Add property filter picker and dynamic subtotal calculations"),
        spec: {
          today: ["DashboardViewModel.swift has no filter criteria; apply(entries:) always aggregates the entire household dataset."],
          proposed: ["Add selectedPropertyId and selectedCategory to DashboardViewModel; filter visible list and expose property-specific hours."],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift",
            "projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardScreen.swift",
          ],
          risks: ["Threshold progress bar must clearly indicate when it is showing all properties vs a single property."],
          verify: ["Unit tests for filtered progress computation and UI smoke tests in simulator."],
        },
      },
      {
        id: "contempo-web-manual-entry", n: 4, group: "contempo", name: "Interactive Entry Creation & Editing on Web Dashboard",
        tagline: "Create, edit, and review STR entries directly from the web portal",
        concept: "In projects/contempo/services/web/src/pages/EntriesPage.tsx:11, the web dashboard is strictly read-only (displaying a static table with CSV export and window.print). Users who do desktop administration cannot log hours or make corrections from their computer, forcing them back to the mobile app.",
        moves: [
          "Add 'Add Entry' modal with property dropdown, date/time pickers, duration input, category selector, and contemporaneous note",
          "Implement row edit/confirm actions in EntriesPage.tsx backed by Supabase mutations",
          "Add validation for material participation hours and risk factor warnings",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Feature", Effort: "M",
          Evidence: "projects/contempo/services/web/src/pages/EntriesPage.tsx:11 only reads entries; no insert/update functions exist",
          Release: "minor",
          Captures: "Web Entries page with 'Add Entry' modal dialog and updated table rows",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Web dashboard is completely read-only with no way to log hours", "Add entry creation modal and row editing to web portal"),
        spec: {
          today: ["EntriesPage.tsx only imports useEntries and useProperties; has zero write handlers or mutation state."],
          proposed: ["Add EntryModal component with form controls; call supabase.from('entries').insert()/update() with RLS user token."],
          files: [
            "projects/contempo/services/web/src/pages/EntriesPage.tsx",
            "projects/contempo/services/web/src/components/EntryModal.tsx (new)",
            "projects/contempo/services/web/src/lib/entryModel.ts",
          ],
          risks: ["Form validation must enforce that duration is positive and property is selected."],
          verify: ["npm run test:contempo and manual browser verification on local worker."],
        },
      },
      {
        id: "contempo-mileage-auto-stop", n: 5, group: "contempo", name: "Geofenced Arrival Alert & Auto-Stop for Mileage Tracking",
        tagline: "Stationary arrival detection & notification to prevent runaway GPS trips",
        concept: "MileageTracker.swift:33 runs GPS distance accumulation continuously until manually tapped. When hosts arrive at a rental property and start working, they frequently forget to end the trip, causing the tracker to keep running, accumulating stationary jitter or stranding an open trip entry.",
        moves: [
          "Detect sustained low speed (speed < 1 m/s for > 5 minutes) while tracking mileage",
          "Match current location coordinates against saved property geocodes from AddressCompleter",
          "Send local notification 'Arrived at [Property]? Tap to stop trip and log your arrival time'",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Quality", Effort: "M",
          Evidence: "projects/contempo/ios/Contempo/Sources/App/Mileage/MileageTracker.swift:33 runs indefinitely without idle timeout or arrival detection",
          Release: "patch",
          Captures: "Arrival alert notification and auto-stop prompt on locked and active screen",
          Sources: "https://developer.apple.com/documentation/corelocation/cllocationmanager",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Mileage tracker runs indefinitely if user forgets to tap stop upon arrival", "Add low-speed idle detection and property arrival notification"),
        spec: {
          today: ["MileageTracker.swift only listens to locationManager distance filter updates; has no stationary timer or property proximity check."],
          proposed: ["Track consecutive stationary fixes; if idle > 5 min near property, fire local notification with action to stop and save trip."],
          files: [
            "projects/contempo/ios/Contempo/Sources/App/Mileage/MileageTracker.swift",
            "projects/contempo/ios/Contempo/Sources/App/Mileage/MileageTripCoordinator.swift",
          ],
          risks: ["GPS accuracy flutter in urban canyons must not trigger false arrival stops while stopped at red lights."],
          verify: ["Simulate route arrival in Xcode location simulator and verify notification trigger."],
        },
      },

      // ═══════════════════════════════════════════════════════════════════════
      // FEEDBACKKIT
      // ═══════════════════════════════════════════════════════════════════════
      skip("feedbackkit", "FeedbackKit"),
      {
        id: "feedbackkit-offline-spooling", n: 6, group: "feedbackkit", name: "Offline Report Spooling & Automatic Retry Queue (Swift SDK)",
        tagline: "Persist failed submissions to disk and retry automatically when online",
        concept: "In Sources/FeedbackKit/Networking/FeedbackSubmitter.swift:42, feedback submissions directly call URLSession.shared.dataTask. If the device is offline or network fails, the submission immediately errors out, permanently discarding the user's annotated screenshot and bug description.",
        moves: [
          "Create OfflineReportStore writing pending reports as serialized JSON + image payloads to Caches/FeedbackKit/Pending",
          "Monitor network connectivity with NWPathMonitor in FeedbackKit initialization",
          "Automatically flush and re-upload queued reports in background when connection is restored",
        ],
        facts: {
          Project: "projects/feedbackkit", Kind: "Quality", Effort: "M",
          Evidence: "projects/feedbackkit/Sources/FeedbackKit/Networking/FeedbackSubmitter.swift:42 has no retry queue or disk persistence",
          Release: "patch",
          Captures: "Network offline banner, spooling indicator, and automatic flush log upon reconnect",
          Sources: "https://developer.apple.com/documentation/network/nwpathmonitor",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Submissions fail immediately when offline, losing annotated bug reports", "Persist reports to disk and auto-retry via NWPathMonitor"),
        spec: {
          today: ["FeedbackSubmitter.swift simply invokes completion(.failure(.network(error))) upon URLSession error; data is lost."],
          proposed: ["Introduce OfflineReportQueue using disk storage and NWPathMonitor to buffer and retry submissions seamlessly."],
          files: [
            "projects/feedbackkit/Sources/FeedbackKit/Networking/OfflineReportQueue.swift (new)",
            "projects/feedbackkit/Sources/FeedbackKit/Networking/FeedbackSubmitter.swift",
            "projects/feedbackkit/Sources/FeedbackKit/FeedbackKit.swift",
          ],
          risks: ["Disk cache size must be capped (e.g. max 10 pending reports, max 50MB) to prevent storage bloat."],
          verify: ["Unit test simulating network failure, verifying disk spooling and successful retry on simulated reconnect."],
        },
      },
      {
        id: "feedbackkit-interaction-breadcrumbs", n: 7, group: "feedbackkit", name: "User Interaction Breadcrumbs & Action Trail (Web SDK)",
        tagline: "Capture the last 20 clicks, route changes, and form submits with the report",
        concept: "projects/feedbackkit/web-sdk/src/logs.ts:25 only monitors console.warn/error and failed fetch requests. When users report web app bugs ('submit button broken'), coding agents and developers have no trail of user actions leading up to the issue, making reproduction difficult.",
        moves: [
          "Add a circular ring buffer recording DOM interactions (clicks, inputs, navigation, form submits)",
          "Anonymize element targets (e.g., 'button.primary[data-testid=checkout]', 'nav > a[href=/settings]')",
          "Attach the breadcrumb trail to the FeedbackReport payload under a new breadcrumbs property",
        ],
        facts: {
          Project: "projects/feedbackkit", Kind: "Feature", Effort: "M",
          Evidence: "projects/feedbackkit/web-sdk/src/logs.ts:25 only captures console messages and HTTP 4xx/5xx requests",
          Release: "minor",
          Captures: "Web bug report viewer displaying breadcrumb stepper alongside console logs",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Web reports lack interaction history, making bug reproduction guesswork", "Record sanitized UI click and navigation breadcrumbs in report"),
        spec: {
          today: ["logs.ts only patches console methods and window.fetch; user clicks and navigation are never recorded."],
          proposed: ["Implement BreadcrumbTracker listening to window click and history events, storing the last 25 actions."],
          files: [
            "projects/feedbackkit/web-sdk/src/breadcrumbs.ts (new)",
            "projects/feedbackkit/web-sdk/src/logs.ts",
            "projects/feedbackkit/web-sdk/src/types.ts",
            "projects/feedbackkit/web-sdk/src/submit.ts",
          ],
          risks: ["Input events must only record field names/types, never typed text values."],
          verify: ["Vitest unit test verifying click capture and PII field suppression."],
        },
      },
      {
        id: "feedbackkit-pii-masking", n: 8, group: "feedbackkit", name: "Comprehensive PII Masking in Logs & Breadcrumbs (Web SDK)",
        tagline: "Redact emails, phone numbers, credit cards, and SSNs from captured context",
        concept: "web-sdk/src/logs.ts:31 redactMessage only strips Bearer/Basic headers and explicitly named password/token fields. Error logs and query params often contain email addresses, credit card numbers, or phone numbers that risk exposing user PII in bug trackers.",
        moves: [
          "Extend redactMessage with standard regex patterns for email addresses, international phone numbers, and US SSNs",
          "Implement Luhn-algorithm check for 13-19 digit credit card number detection and masking",
          "Ensure URL query parameters with email or phone keys are sanitized in redactUrl",
        ],
        facts: {
          Project: "projects/feedbackkit", Kind: "Security", Effort: "S",
          Evidence: "projects/feedbackkit/web-sdk/src/logs.ts:31 only checks for auth headers and password keys",
          Release: "patch",
          Captures: "Console log preview showing masked emails, phone numbers, and credit cards",
          Sources: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html",
          "Checked on": "main @ b049258e",
        },
        render: idea("Security", "Logs leak user emails, credit cards, and phone numbers in error messages", "Expand redaction with Luhn credit card and email/phone pattern maskers"),
        spec: {
          today: ["logs.ts:31 regex only checks for Bearer, JWTs, and specific key-value pairs matching password|secret|token."],
          proposed: ["Add email, credit card (Luhn validated), and phone regex replacements to redactMessage."],
          files: [
            "projects/feedbackkit/web-sdk/src/logs.ts",
            "projects/feedbackkit/web-sdk/test/logs.test.ts",
          ],
          risks: ["Regex performance must remain fast on large stack traces (<2ms)."],
          verify: ["Unit tests with test card numbers, email strings, and phone numbers verifying complete redaction."],
        },
      },
      {
        id: "feedbackkit-mcp-search", n: 9, group: "feedbackkit", name: "Keyword & Time-Range Search Tool in CLI MCP Server",
        tagline: "search_feedback tool for coding agents to find related issues and fixes",
        concept: "cli/src/mcp/server.ts:76 provides list_feedback which only takes status and limit filters. When an agent is debugging an issue (e.g. 'map tile render failed'), it cannot search existing reports by query or keyword, forcing agents to pull dozens of irrelevant items.",
        moves: [
          "Register search_feedback tool in createMcpServer accepting query, optional status, and since timestamp",
          "Execute full-text ILIKE match across feedback title, description, and logs in Supabase",
          "Return structured match excerpts with relevance scoring",
        ],
        facts: {
          Project: "projects/feedbackkit", Kind: "Feature", Effort: "S",
          Evidence: "projects/feedbackkit/cli/src/mcp/server.ts:76 only exposes list_feedback with pagination/status",
          Release: "minor",
          Captures: "MCP tool execution log showing targeted search query and formatted JSON results",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Agents cannot search past feedback items by keywords in MCP server", "Add search_feedback MCP tool matching text across titles and logs"),
        spec: {
          today: ["server.ts:76 only lists items ordered by created_at desc with optional status filter."],
          proposed: ["Add search_feedback MCP tool calling Supabase .or(`title.ilike.%${query}%,description.ilike.%${query}%`)."],
          files: [
            "projects/feedbackkit/cli/src/mcp/server.ts",
            "projects/feedbackkit/cli/src/loop.ts",
          ],
          risks: ["Query inputs must be sanitized to prevent SQL injection in filter strings."],
          verify: ["CLI test executing search_feedback against test database."],
        },
      },
      {
        id: "feedbackkit-voice-memo-web", n: 10, group: "feedbackkit", name: "In-Widget Audio/Voice Memo Recording for Web SDK",
        tagline: "Record a 15-second voice note describing the bug via MediaRecorder",
        concept: "web-sdk/src/ui/widget.ts:629 only supports text input and image attachments. Web reporters on mobile or desktop often find explaining a bug verbally much faster and more expressive than typing in a small widget textarea.",
        moves: [
          "Add microphone button in the Web SDK widget toolbar using MediaRecorder API",
          "Record up to 30s of mono audio (audio/webm;codecs=opus) with live waveform indicator",
          "Attach the resulting audio blob as a FeedbackAttachment in the submission payload",
        ],
        facts: {
          Project: "projects/feedbackkit", Kind: "Feature", Effort: "M",
          Evidence: "projects/feedbackkit/web-sdk/src/ui/widget.ts:629 only allows file attachments and photos",
          Release: "minor",
          Captures: "Widget screenshot showing microphone recording state with animated waveform",
          Sources: "https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Web widget only allows typing; users cannot leave a quick voice note", "Add voice memo recording using HTML5 MediaRecorder API"),
        spec: {
          today: ["widget.ts has no audio capture controls; only file input and text inputs exist."],
          proposed: ["Add VoiceRecorder component in web-sdk/src/ui/voice.ts using MediaRecorder and attach blob to payload."],
          files: [
            "projects/feedbackkit/web-sdk/src/ui/voice.ts (new)",
            "projects/feedbackkit/web-sdk/src/ui/widget.ts",
            "projects/feedbackkit/web-sdk/src/types.ts",
          ],
          risks: ["Must gracefully handle browsers where microphone permission is denied or unsupported."],
          verify: ["Playwright browser test validating audio recording lifecycle and payload attachment."],
        },
      },

      // ═══════════════════════════════════════════════════════════════════════
      // MEOWTRIX
      // ═══════════════════════════════════════════════════════════════════════
      skip("meowtrix", "Meowtrix"),
      {
        id: "meowtrix-mtx-upload", n: 11, group: "meowtrix", name: "mtx upload CLI Command for Remote Workspace Asset Staging",
        tagline: "Command-line file upload from terminal sessions to Meowtrix host",
        concept: "bin/mtx:11 supports mtx download <file> to fetch files to browser, but has no mtx upload <file> command. Developers and autonomous coding agents working inside Meowtrix need a fast CLI method to push generated files or test artifacts into workspace directories without manually opening the browser UI.",
        moves: [
          "Add upload subcommand to bin/mtx accepting source file and optional target directory",
          "Stream binary data via POST /api/upload to the Meowtrix server instance",
          "Output the destination file path and file size confirmation upon completion",
        ],
        facts: {
          Project: "projects/meowtrix", Kind: "Feature", Effort: "S",
          Evidence: "projects/meowtrix/bin/mtx:11 only implements download, code, spec, review, open, edit, layout, notify",
          Release: "minor",
          Captures: "Terminal session running mtx upload test.png with success response",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "mtx CLI has download but no upload command for staging files", "Implement mtx upload <file> [dest] in bin/mtx and server API"),
        spec: {
          today: ["bin/mtx lacks upload command; server.js:363 has app.post('/api/upload') but it is only hooked to web drag-and-drop."],
          proposed: ["Add upload case in bin/mtx utilizing curl or node script to POST binary stream to /api/upload."],
          files: [
            "projects/meowtrix/bin/mtx",
            "projects/meowtrix/server.js",
          ],
          risks: ["Target paths must be sanitized against path traversal outside the authorized working root."],
          verify: ["Run mtx upload on local server and verify file integrity with sha256sum."],
        },
      },
      {
        id: "meowtrix-scrollback-export", n: 12, group: "meowtrix", name: "Terminal Scrollback Buffer Export & Log Download",
        tagline: "Export entire terminal history or selection to a downloadable .log file",
        concept: "In public/pane.js:2430, the terminal tab context menu offers Close, Duplicate, Split, and Rename, but has no option to export or download the terminal scrollback. When long build logs, compiler outputs, or training metrics run in Meowtrix, users have to manually select and copy text.",
        moves: [
          "Add 'Export Scrollback...' option to the terminal tab right-click context menu",
          "Extract full text buffer from xterm.js instance and server PTY buffer",
          "Trigger client-side browser download of terminal-<id>-<timestamp>.log",
        ],
        facts: {
          Project: "projects/meowtrix", Kind: "Quality", Effort: "S",
          Evidence: "projects/meowtrix/public/pane.js:2430 tab context menu lacks scrollback export action",
          Release: "patch",
          Captures: "Context menu showing 'Export Scrollback...' and downloaded text file preview",
          Sources: "https://xtermjs.org/docs/api/terminal/classes/terminal/#selectall",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "No way to export full terminal scrollback to file for debugging", "Add 'Export Scrollback...' context menu action downloading .log file"),
        spec: {
          today: ["pane.js:2430 menu items only cover pane management; no buffer extraction utility exists."],
          proposed: ["Add exportTerminalLog(tab) pulling term.buffer.active text or entry.buffer from server and triggering blob download."],
          files: [
            "projects/meowtrix/public/pane.js",
            "projects/meowtrix/public/style.css",
          ],
          risks: ["Very large buffers (10MB+) must not freeze the UI thread during string assembly."],
          verify: ["Test export on 10,000-line terminal session and verify downloaded file matches xterm content."],
        },
      },
      {
        id: "meowtrix-connection-status", n: 13, group: "meowtrix", name: "Disconnection Alert Banner with Exponential Backoff Auto-Reconnect",
        tagline: "Clear visual reconnection indicator and exponential backoff retry loop",
        concept: "public/ws.js:95 handles WebSocket closure with a silent, fixed 1-second setTimeout(connectWs, 1000) loop with no UI indicator. When a network hiccup or laptop sleep disconnects the session, the terminal appears frozen with zero visual feedback to the user.",
        moves: [
          "Render subtle top warning banner 'Connection lost. Reconnecting in Xs...' when WebSocket closes",
          "Implement exponential backoff (1s, 2s, 4s, 8s, max 16s) to avoid slamming restarted servers",
          "Provide a 'Reconnect Now' button on the banner for immediate retry",
        ],
        facts: {
          Project: "projects/meowtrix", Kind: "Quality", Effort: "S",
          Evidence: "projects/meowtrix/public/ws.js:95 uses unmonitored fixed setTimeout(connectWs, 1000) on close",
          Release: "patch",
          Captures: "Disconnected banner with countdown timer and Reconnect Now button",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "WebSocket disconnects silently with fixed 1s retry and no user banner", "Add reconnection banner with exponential backoff and manual retry button"),
        spec: {
          today: ["ws.js:95 simply calls setTimeout(connectWs, 1000) without updating UI or tracking retry attempts."],
          proposed: ["Add ReconnectionBanner UI component; increment backoff timer on close and dismiss banner upon open."],
          files: [
            "projects/meowtrix/public/ws.js",
            "projects/meowtrix/public/style.css",
          ],
          risks: ["Reconnecting must properly resume PTY resizes and clear pending queues without duplicated listeners."],
          verify: ["Simulate server restart and verify banner appearance, backoff timing, and automatic recovery."],
        },
      },
      {
        id: "meowtrix-visual-bell", n: 14, group: "meowtrix", name: "Terminal Bell (\\x07) Tab Header Pulse & Sound Notification",
        tagline: "Visual flash and subtle audio chime when background terminal tasks complete",
        concept: "In public/pane.js:650, xterm instances do not subscribe to term.onBell. When developers run long builds, test suites, or background commands that emit a terminal bell (`echo -e '\\a'`), there is no notification if the tab is not currently focused.",
        moves: [
          "Subscribe to term.onBell() on every xterm.js instance in pane.js",
          "Add pulsing badge animation on inactive tab headers when bell triggers",
          "Add optional toggle in Settings for subtle Web Audio synthesis chime",
        ],
        facts: {
          Project: "projects/meowtrix", Kind: "Feature", Effort: "S",
          Evidence: "projects/meowtrix/public/pane.js:650 does not attach onBell handler to terminal instances",
          Release: "patch",
          Captures: "Inactive terminal tab with pulsing bell indicator in tab bar",
          Sources: "https://xtermjs.org/docs/api/terminal/classes/terminal/#onbell",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Terminal bell escape sequences (\\x07) are ignored on background tabs", "Add tab header visual pulse and optional chime on terminal bell"),
        spec: {
          today: ["term.onBell is never hooked; bell characters are silently discarded by xterm."],
          proposed: ["Attach term.onBell(() => notifyTabBell(tab)) in createTerminalTab; style .tab.bell-alert in CSS."],
          files: [
            "projects/meowtrix/public/pane.js",
            "projects/meowtrix/public/style.css",
            "projects/meowtrix/public/settings.js",
          ],
          risks: ["Rapid repeated bells (e.g. accidental script loop) must be throttled to avoid UI flashing."],
          verify: ["Trigger echo -e '\\a' from terminal and verify tab indicator appears when viewing another tab."],
        },
      },
      {
        id: "meowtrix-shortcuts-cheatsheet", n: 15, group: "meowtrix", name: "Interactive Keyboard Shortcuts Cheat Sheet & Discovery Modal",
        tagline: "Quick-reference modal for pane splits, tab switching, and overlay hotkeys",
        concept: "public/palette.js:30 hardcodes numerous powerful hotkeys (Cmd+K, Alt+Space, Cmd+Shift+E, Cmd+Shift+B, etc.), but there is no centralized cheat sheet or help dialog in Meowtrix. New users and power users have no quick way to discover layout and pane navigation shortcuts.",
        moves: [
          "Add 'Keyboard Shortcuts' modal accessible via '?' key or Help menu",
          "Categorize shortcuts into Navigation, Tiling/Splits, Terminal, Editor, and Overlay",
          "Automatically adapt shortcut symbols between macOS (⌘/⌥/⇧) and Linux/Windows (Ctrl/Alt/Shift)",
        ],
        facts: {
          Project: "projects/meowtrix", Kind: "Quality", Effort: "S",
          Evidence: "projects/meowtrix/public/palette.js:30 has dozens of hotkeys with no in-app reference dialog",
          Release: "patch",
          Captures: "Keyboard shortcuts cheat sheet modal with clean grouped keys",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "No in-app reference for powerful tiling and navigation shortcuts", "Add keyboard shortcuts cheat sheet modal accessible via '?' or menu"),
        spec: {
          today: ["Shortcuts are scattered across palette.js, app.js, and pane.js with no reference UI."],
          proposed: ["Add showShortcutsModal() and hook '?' keypress to open a categorized shortcuts dialog."],
          files: [
            "projects/meowtrix/public/shortcuts.js (new)",
            "projects/meowtrix/public/palette.js",
            "projects/meowtrix/public/style.css",
          ],
          risks: ["Must not intercept '?' when typing inside terminal or Monaco editor."],
          verify: ["Press '?' in global scope, verify modal renders and closes on Escape."],
        },
      },

      // ═══════════════════════════════════════════════════════════════════════
      // VOXBRIEF
      // ═══════════════════════════════════════════════════════════════════════
      skip("voxbrief", "Voxbrief"),
      {
        id: "voxbrief-smart-date-calendar", n: 16, group: "voxbrief", name: "Smart Date & Time Extraction for Calendar Export via NSDataDetector",
        tagline: "Parse spoken dates and meeting times into Calendar events automatically",
        concept: "CalendarExportService.swift:30 hardcodes event start time to Date().addingTimeInterval(3600) (1 hour from now). When users speak voice memos like 'Dentist appointment next Tuesday at 2pm', exporting to Apple Calendar ignores the spoken date and schedules it 1 hour from today.",
        moves: [
          "Use NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) on note title and transcript",
          "Extract parsed DateComponents and set as calendar event start date",
          "Fall back to Date() + 1 hour only when no date or time expression is detected in the note",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/CalendarExportService.swift:30 hardcodes startDate: Date = Date().addingTimeInterval(3600)",
          Release: "patch",
          Captures: "Calendar event creation confirmation with detected date matching voice note text",
          Sources: "https://developer.apple.com/documentation/foundation/nsdatadetector",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Calendar export ignores spoken dates, hardcoding events to 1 hour from now", "Extract dates and times from voice notes via NSDataDetector"),
        spec: {
          today: ["CalendarExportService.swift:30 defaults startDate to Date().addingTimeInterval(3600); never inspects note text for dates."],
          proposed: ["Implement extractFirstDate(from:) using NSDataDetector and use detected date in exportEvent."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/CalendarExportService.swift",
          ],
          risks: ["Must handle past dates reasonably (e.g. scheduled for next occurrence if time-only mentioned)."],
          verify: ["Unit tests with phrases 'Meeting Friday at 3pm', 'Call tomorrow at 10am', verifying parsed event dates."],
        },
      },
      {
        id: "voxbrief-batch-zip-export", n: 17, group: "voxbrief", name: "Batch Markdown Archive & ZIP Export for Obsidian/Notion",
        tagline: "Export all notes or selected tag groups as a packaged ZIP archive",
        concept: "NoteExportService.swift:39 only exports a single voice note as a markdown file. In NoteListViewModel.swift:18, users with hundreds of captured voice notes have no bulk export capability to backup their library or migrate notes into Obsidian or Notion vaults.",
        moves: [
          "Add exportNotesAsZip(notes:) in NoteExportService creating an in-memory or temporary .zip archive",
          "Structure files with YAML frontmatter, audio links, and subdirectories by tag",
          "Add 'Export All Notes (.zip)' action in NoteListView toolbar menu with standard ShareLink",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/NoteExportService.swift:39 only exports a single temporary file",
          Release: "minor",
          Captures: "Note list toolbar with Export Archive action and system share sheet for .zip",
          Sources: "https://developer.apple.com/documentation/foundation/filecoordinator",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "No way to bulk export voice notes into an Obsidian/Notion markdown archive", "Add batch ZIP archive export with YAML frontmatter and tag folders"),
        spec: {
          today: ["NoteExportService.swift only has exportTemporaryMarkdownFile for individual notes; no batch/zip routine exists."],
          proposed: ["Implement exportNotesAsZip using FileManager and NSFileCoordinator to archive all notes into a single .zip file."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/NoteExportService.swift",
            "projects/voxbrief/VoxbriefApp/ViewModels/NoteListViewModel.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteListView.swift",
          ],
          risks: ["Large audio recordings should be omitted or made optional to keep the ZIP export under 50MB."],
          verify: ["Unit test creating batch archive from 20 sample notes and checking unzipped file structure."],
        },
      },
      {
        id: "voxbrief-silence-trim-playback", n: 18, group: "voxbrief", name: "Audio Dead-Air & Silence Trimming in Playback",
        tagline: "Optionally skip pauses and silence during audio note playback",
        concept: "AudioPlaybackService.swift:13 supports variable playback rates (0.8x to 2x), but lacks a 'Skip Silence' mode. Spoken voice memos often contain 3-5 second thinking pauses, phone interruptions, or dead air that waste listening time.",
        moves: [
          "Calculate audio amplitude envelope or silence threshold intervals during ASR alignment",
          "Add 'Skip Silence' toggle in playback speed menu in NoteDetailView",
          "Skip playback head automatically over silent intervals (>1.5s with RMS < -40dB)",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Performance", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/AudioPlaybackService.swift:13 only adjusts player.rate without silence skipping",
          Release: "minor",
          Captures: "Audio player scrubber highlighting trimmed silence gaps and active Skip Silence badge",
          Sources: "https://developer.apple.com/documentation/avfaudio/avaudioplayer/1388561-averagepower",
          "Checked on": "main @ b049258e",
        },
        render: idea("Performance", "Voice notes contain long pauses and dead air that slow down playback", "Add 'Skip Silence' toggle in AudioPlaybackService to jump over pauses"),
        spec: {
          today: ["AudioPlaybackService.swift only controls playbackRate; plays audio continuously without silence detection."],
          proposed: ["Add skipSilence enabled flag; during time observation, seek past intervals tagged as silent."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/AudioPlaybackService.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift",
          ],
          risks: ["Seeking too aggressively can clip natural word transitions; minimum pause duration should be 1.2 seconds."],
          verify: ["Playback test with audio containing deliberate 3-second pauses, verifying seamless jump."],
        },
      },
      {
        id: "voxbrief-custom-hotkey-mac", n: 19, group: "voxbrief", name: "Customizable System-Wide Capture Hotkey for macOS Overlay",
        tagline: "Allow users to configure their preferred global recording shortcut",
        concept: "GlobalHotkeyManager.swift:20 hardcodes the global capture shortcut to 'press both Command keys simultaneously' via CGEventTap. Users on compact external keyboards or those with existing keyboard layout mappings cannot trigger capture conveniently.",
        moves: [
          "Add shortcut recording field in Mac PreferencesView.swift supporting standard modifier + key combinations",
          "Store custom keycode and modifiers in AppStorage / UserDefaults",
          "Update GlobalHotkeyManager event tap to recognize the user-configured key combination",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefMac/Services/GlobalHotkeyManager.swift:20 hardcodes left/right command keycodes (0x37, 0x36)",
          Release: "minor",
          Captures: "Mac Preferences screen showing hotkey recorder and active custom key combo",
          Sources: "https://developer.apple.com/documentation/coregraphics/cgeventtapcreate",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Global hotkey on Mac is hardcoded to pressing both Command keys", "Add customizable global hotkey recorder in Mac Preferences"),
        spec: {
          today: ["GlobalHotkeyManager.swift only checks leftHeld && rightHeld with fixed key codes 0x37 and 0x36."],
          proposed: ["Introduce HotkeyConfiguration model and allow registering custom modifier + key code combinations."],
          files: [
            "projects/voxbrief/VoxbriefMac/Services/GlobalHotkeyManager.swift",
            "projects/voxbrief/VoxbriefMac/Views/PreferencesView.swift",
          ],
          risks: ["Accessibility permissions must remain active; invalid keycodes must be prevented."],
          verify: ["Test custom shortcut trigger (e.g. Option+Space) across different focused applications on macOS."],
        },
      },
      {
        id: "voxbrief-interactive-checklist", n: 20, group: "voxbrief", name: "Interactive Checklist Item Toggle in Note Markdown View",
        tagline: "Directly check off '- [ ]' action items inside note detail view",
        concept: "In NoteDetailView.swift and MarkdownLiteText.swift, markdown task list items (`- [ ]`) are rendered as static text glyphs. While items can be exported to Apple Reminders, users who review notes inside Voxbrief cannot check off completed tasks directly without editing the entire raw note string.",
        moves: [
          "Parse `- [ ]` and `- [x]` markdown checklist syntax into interactive checkbox buttons in MarkdownLiteText",
          "Tapping a checkbox toggles the task state in note.cleanedNote",
          "Persist the updated note markdown to NoteRepository with updated modifiedAt timestamp",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Evidence: "projects/voxbrief/VoxbriefApp/Views/MarkdownLiteText.swift renders markdown as attributed strings without interactive checkbox state",
          Release: "patch",
          Captures: "Note detail view showing tappable checkboxes with strike-through completion animation",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Checklist items in note detail view are static text that cannot be checked off", "Make markdown checkboxes interactive with in-place note updates"),
        spec: {
          today: ["MarkdownLiteText.swift renders markdown into static Text views; clicking a checklist item does nothing."],
          proposed: ["Add interactive checklist line parser in NoteDetailView with action callback updating markdown string in NoteRepository."],
          files: [
            "projects/voxbrief/VoxbriefApp/Views/MarkdownLiteText.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift",
            "projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift",
          ],
          risks: ["String replacements must match the exact line occurrence to avoid mutating identical lines elsewhere."],
          verify: ["Toggle checklist item in sample note, verify file persistence and strikethrough styling."],
        },
      },

      // ═══════════════════════════════════════════════════════════════════════
      // WAYPACK
      // ═══════════════════════════════════════════════════════════════════════
      skip("waypack", "Waypack"),
      {
        id: "waypack-trips-search", n: 21, group: "waypack", name: "Inline Search & Destination Filter on Scrapbook Home",
        tagline: "Search and filter trips by destination, title, or season on the home screen",
        concept: "TripsScreen.dart:20 renders upcoming and past trips in polaroid grids with zero search or filter controls. As travelers accumulate past trips or manage multiple active plans (Waypack Pro supports up to 10 active trips), finding a specific destination requires manual scrolling.",
        moves: [
          "Add an expandable search bar in the scrapbook header with handwritten filter styling",
          "Filter trip titles, destinations, and dates in real time",
          "Provide quick filter chips: 'Upcoming', 'Past', 'Offline Saved'",
        ],
        facts: {
          Project: "projects/waypack", Kind: "Quality", Effort: "S",
          Evidence: "projects/waypack/apps/mobile/lib/screens/trips_screen.dart:20 has no search field or filter state",
          Release: "patch",
          Captures: "Scrapbook home screen with active search field and filtered polaroids",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Scrapbook home has no search bar or filter for travelers with multiple trips", "Add inline search bar and quick filter chips on scrapbook home"),
        spec: {
          today: ["TripsScreen.dart directly maps s.upcoming and s.past to _PolaroidGrid without search filtering."],
          proposed: ["Add searchQuery state in TripsScreen; filter entries matching title or destination before grid layout."],
          files: [
            "projects/waypack/apps/mobile/lib/screens/trips_screen.dart",
          ],
          risks: ["Empty search state should provide a clear 'No matching trips' scrapbook note."],
          verify: ["Flutter unit test validating search query matching on title and destination fields."],
        },
      },
      {
        id: "waypack-morning-briefing-notifs", n: 22, group: "waypack", name: "Daily Morning Itinerary Briefing Notifications",
        tagline: "Scheduled morning itinerary reminder during active trip days",
        concept: "In lib/services/notifications.dart:58, Waypack only schedules a single local notification 72 hours before trip start ('Download before you go'). Once the trip begins, travelers receive zero notifications about the day's schedule, leaving the app out-of-sight.",
        moves: [
          "Parse manifest.days for each day of the trip",
          "Schedule an 8:00 AM local notification for each active day: 'Today in [Destination]: [N] stops planned, starting with [First Place]'",
          "Tapping the notification opens the native TodayScreen directly",
        ],
        facts: {
          Project: "projects/waypack", Kind: "Feature", Effort: "M",
          Evidence: "projects/waypack/apps/mobile/lib/services/notifications.dart:58 only schedules a single pre-trip download reminder",
          Release: "minor",
          Captures: "Morning briefing notification banner on lock screen and tap deep link to Today screen",
          Sources: "https://pub.dev/packages/flutter_local_notifications",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "No notifications during active trips; travelers miss daily itinerary schedule", "Schedule 8:00 AM daily itinerary morning briefings from trip manifest"),
        spec: {
          today: ["notifications.dart Reminders.sync only schedules one download prompt 72h prior to start date."],
          proposed: ["Add scheduleDailyBriefings(Manifest manifest) scheduling daily 8:00 AM alerts for each day in manifest.days."],
          files: [
            "projects/waypack/apps/mobile/lib/services/notifications.dart",
            "projects/waypack/apps/mobile/lib/state/app_state.dart",
          ],
          risks: ["Notifications must cancel cleanly if trip dates are edited or trip is deleted."],
          verify: ["Simulate active trip dates and verify zonedSchedule calls in test suite."],
        },
      },
      {
        id: "waypack-pdf-packing-checklist", n: 23, group: "waypack", name: "Packing & Gear Checklist Section in Trip PDF Export",
        tagline: "Include gear recommendations and printable packing checklists in exported PDFs",
        concept: "projects/waypack/apps/mobile/lib/services/pdf_export.dart:28 builds a clean multi-page travel plan PDF with itinerary days and places, but completely omits the trip's packing checklist and gear recommendations. Travelers frequently print PDFs specifically to pack luggage before leaving.",
        moves: [
          "Read packing and gear checklist items from manifest data in PdfExportService",
          "Render printable checkbox rows with categories (Clothing, Gear, Documents, Electronics)",
          "Format with clean grid borders and page-break preservation",
        ],
        facts: {
          Project: "projects/waypack", Kind: "Feature", Effort: "S",
          Evidence: "projects/waypack/apps/mobile/lib/services/pdf_export.dart:28 only builds cover, days, and places sections",
          Release: "minor",
          Captures: "Exported PDF preview showing formatted packing list with printable checkboxes",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "PDF export omits packing checklists and gear advice needed before departure", "Add printable packing & gear checklist page to generated trip PDF"),
        spec: {
          today: ["pdf_export.dart build function only generates cover, days loop, and places section."],
          proposed: ["Add _packingSection(manifest) to PDF MultiPage build list when manifest contains packing recommendations."],
          files: [
            "projects/waypack/apps/mobile/lib/services/pdf_export.dart",
          ],
          risks: ["Trips without explicit packing data in manifest should cleanly omit the section without empty pages."],
          verify: ["Generate PDF from Sequoia example bundle and verify packing section renders with checkboxes."],
        },
      },
      {
        id: "waypack-cli-export-html", n: 24, group: "waypack", name: "CLI Standalone HTML/PDF Export Command (waypack export)",
        tagline: "Generate static self-contained HTML/PDF trip summary from the command line",
        concept: "packages/cli/src/cli.ts:14 has commands for validate, zip, preview, screenshot, init, and skill install. Trip authors and agents cannot generate a static, shareable HTML/PDF summary from the terminal without launching the full web preview server.",
        moves: [
          "Add waypack export <dir> [-o output.html] command to CLI",
          "Compile manifest, route maps, and day itinerary into a single self-contained HTML file",
          "Allow offline viewing and printing from any desktop browser without dependencies",
        ],
        facts: {
          Project: "projects/waypack", Kind: "Feature", Effort: "M",
          Evidence: "projects/waypack/packages/cli/src/cli.ts:14 lacks an export command",
          Release: "minor",
          Captures: "Terminal output of waypack export command and rendered standalone HTML file",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "CLI cannot export a standalone printable HTML/PDF file without server", "Add waypack export <dir> command generating self-contained HTML trip summary"),
        spec: {
          today: ["cli.ts only supports preview (which binds a local HTTP server) and zip; no static export command exists."],
          proposed: ["Implement exportCommand in packages/cli/src/export.ts bundling manifest and assets into a single standalone HTML."],
          files: [
            "projects/waypack/packages/cli/src/export.ts (new)",
            "projects/waypack/packages/cli/src/cli.ts",
          ],
          risks: ["Embedded images must be base64-inlined or linked locally to stay self-contained."],
          verify: ["Run waypack export on examples/tahoe-winter and open output file in headless browser."],
        },
      },
      {
        id: "waypack-storage-manager", n: 25, group: "waypack", name: "Offline PMTiles Map & Bundle Cache Storage Manager",
        tagline: "Inspect disk usage per trip and clear offline map caches in Settings",
        concept: "Offline vector map extracts (PMTiles) and unpacked SDK bundles in TripStore (apps/mobile/lib/services/trip_store.dart:14) can consume hundreds of megabytes. SettingsScreen (lib/screens/settings_screen.dart:180) has no storage breakdown, preventing travelers from freeing disk space without deleting their saved trip records.",
        moves: [
          "Add Storage section in SettingsScreen calculating disk usage of pmtiles and unpacked bundles",
          "Show per-trip storage usage breakdown (e.g., 'Sequoia: 142 MB tiles, 12 MB bundle')",
          "Add 'Clear Map Cache' button allowing users to reclaim storage while keeping trip itinerary intact",
        ],
        facts: {
          Project: "projects/waypack", Kind: "Quality", Effort: "S",
          Evidence: "projects/waypack/apps/mobile/lib/screens/settings_screen.dart:180 has no storage inspection or cache cleanup",
          Release: "patch",
          Captures: "Settings screen showing per-trip storage bar and Clear Cache confirmation",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Offline map PMTiles consume significant storage with no manager in Settings", "Add storage manager showing per-trip disk usage with cache cleanup button"),
        spec: {
          today: ["SettingsScreen only displays account status, MCP setup, and updates; no cache or storage tools exist."],
          proposed: ["Add computeStorageUsage() in TripStore and render breakdown with clearOfflineCache(tripId) in SettingsScreen."],
          files: [
            "projects/waypack/apps/mobile/lib/services/trip_store.dart",
            "projects/waypack/apps/mobile/lib/screens/settings_screen.dart",
          ],
          risks: ["Clearing tiles must mark the trip as needing download before offline use without corrupting state."],
          verify: ["Unit test verifying directory size calculation and deletion of tile files."],
        },
      },

      // ═══════════════════════════════════════════════════════════════════════
      // WEE HOURS
      // ═══════════════════════════════════════════════════════════════════════
      skip("weehours", "Wee Hours"),
      {
        id: "weehours-who-growth-charts", n: 26, group: "weehours", name: "WHO Infant Growth Standards & Percentile Curve Charts",
        tagline: "Interactive SwiftCharts growth curves against WHO infant percentiles",
        concept: "GrowthView.swift:10 only captures weight/height/head numbers and displays the latest single entry. Parents and pediatricians track baby growth against World Health Organization (WHO) infant growth standards (3rd, 15th, 50th, 85th, 97th percentiles) to ensure healthy development.",
        moves: [
          "Embed WHO infant growth percentile tables (weight-for-age, length-for-age, head circumference 0–24 months by gender)",
          "Render interactive growth curves with SwiftCharts in GrowthView showing logged points against WHO curve bands",
          "Display calculated current percentile (e.g. '58th percentile') beside latest measurement",
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "M",
          Evidence: "projects/weehours/apps/ios/App/Sources/GrowthView.swift:10 only stores raw numbers with no percentile charts",
          Release: "minor",
          Captures: "Growth screen with WHO percentile curves and baby's plotted measurement trajectory",
          Sources: "https://www.who.int/tools/child-growth-standards/standards",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Growth tracking only shows raw numbers without WHO percentile growth curves", "Add interactive SwiftCharts growth curves against WHO infant percentiles"),
        spec: {
          today: ["GrowthView.swift only renders a simple list of tiles with the latest measurement text; no charts exist."],
          proposed: ["Add WhoGrowthPercentiles dataset and Chart view plotting baby's growth history against standard percentile bands."],
          files: [
            "projects/weehours/apps/ios/App/Sources/GrowthCharts.swift (new)",
            "projects/weehours/apps/ios/App/Sources/GrowthView.swift",
            "projects/weehours/apps/ios/LogCore/Sources/LogCore/Model.swift",
          ],
          risks: ["Must accurately calculate infant age in days/months based on baby.birthDate."],
          verify: ["Unit test calculating percentiles for known test values; verify chart rendering in simulator."],
        },
      },
      {
        id: "weehours-pediatrician-summary-pdf", n: 27, group: "weehours", name: "1-Page Pediatrician Visit Summary Report (PDF Export)",
        tagline: "Formatted clinical briefing for doctor visits with daily averages and stats",
        concept: "SettingsView.swift:20 only provides exportCSV(). At well-child checkups (2-week, 1-month, 2-month, 4-month), pediatricians ask for average daily feed volumes, diaper output counts, sleep durations, and weight gain rate. Parents cannot easily hand a raw CSV to a doctor.",
        moves: [
          "Create PediatricianReportGenerator producing a structured 1-page PDF using UIGraphicsPDFRenderer",
          "Summarize 7-day and 14-day averages: feeds per day, total volume (oz/ml), wet/dirty diaper frequency, longest sleep stretch",
          "Include current growth percentiles and recent medication/vaccine logs",
          "Add 'Pediatrician Visit Report' in Settings and Household export menus with standard ShareLink",
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "M",
          Evidence: "projects/weehours/apps/ios/App/Sources/SettingsView.swift:20 only exports raw CSV string",
          Release: "minor",
          Captures: "1-page PDF report preview with feeding, diaper, and sleep clinical summary tables",
          Sources: "https://www.aap.org/en/patient-care/well-child-care/",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Only raw CSV export available; parents lack a doctor-ready visit summary", "Generate formatted 1-page Pediatrician Visit Summary PDF with averages"),
        spec: {
          today: ["AppModel.swift:18 only exports CSV via CSVExport.csv; no PDF summary generator exists."],
          proposed: ["Implement PediatricianReportGenerator calculating 7/14-day rolling clinical metrics and rendering to PDF."],
          files: [
            "projects/weehours/apps/ios/App/Sources/PediatricianReport.swift (new)",
            "projects/weehours/apps/ios/App/Sources/SettingsView.swift",
            "projects/weehours/apps/ios/App/Sources/AppModel.swift",
          ],
          risks: ["Must format cleanly in both US customary (oz, lb) and Metric (ml, kg) based on locale."],
          verify: ["Generate report on mock household data and verify PDF layout and clinical calculations in test suite."],
        },
      },
      {
        id: "weehours-next-feed-reminder", n: 28, group: "weehours", name: "Smart Next-Feed Interval Calculator & Schedule Notification",
        tagline: "Surfaces next feed due time and optional alert based on feeding patterns",
        concept: "CareView.swift:34 and HomeView.swift record feed events passively. In the middle of the night, sleep-deprived parents constantly struggle to remember when the last feed started and calculate when the baby will need feeding next (typically 2.5–3 hours for newborns).",
        moves: [
          "Compute estimated next feed time on HomeView based on last feed start + caregiver interval preference (default 2.5h)",
          "Surface 'Next feed ~[Time]' chip on Now screen beside last feed status",
          "Schedule optional local reminder notification 'Baby feed due (~3h since last feed)'",
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "S",
          Evidence: "projects/weehours/apps/ios/App/Sources/HomeView.swift only displays elapsed time since last feed; no due estimate or reminder",
          Release: "minor",
          Captures: "Now screen displaying Next Feed Due badge and local notification banner",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Parents must calculate next feed time in head while sleep deprived", "Surface estimated next feed due time and schedule optional reminder alert"),
        spec: {
          today: ["HomeView.swift shows elapsed time since last feed ('2h 15m ago'); does not calculate next due time or schedule alerts."],
          proposed: ["Add nextFeedEstimate to HomeView and schedule local notification if feed reminder is toggled on in settings."],
          files: [
            "projects/weehours/apps/ios/App/Sources/HomeView.swift",
            "projects/weehours/apps/ios/App/Sources/SettingsView.swift",
            "projects/weehours/apps/ios/App/Sources/AppModel.swift",
          ],
          risks: ["Must automatically cancel or reschedule reminder whenever a new feed is logged."],
          verify: ["Unit test verifying reminder cancellation and rescheduling upon new feed event."],
        },
      },
      {
        id: "weehours-stale-sleep-recovery", n: 29, group: "weehours", name: "Overdue Sleep Session Alert & Quick Wake-Time Correction",
        tagline: "Detect runaway sleep timers and prompt with 1-tap wake-time adjustment",
        concept: "In CareView.swift:34 and AppModel.swift, starting a sleep session tracks duration until manually stopped. Caregivers frequently tend to a crying baby in the morning and forget to tap 'Stop sleep', causing accidental 12+ hour sleep records that distort weekly sleep averages.",
        moves: [
          "Send a local notification if a sleep session exceeds 5 hours during day or 12 hours at night: 'Baby still sleeping? Tap to record wake time'",
          "When stopping an overdue sleep session, present quick time chips: 'Just now', '15m ago', '30m ago', '1h ago'",
          "Update the session end timestamp accurately in the append-only event log",
        ],
        facts: {
          Project: "projects/weehours", Kind: "Quality", Effort: "S",
          Evidence: "projects/weehours/apps/ios/App/Sources/CareView.swift:34 stops timed sessions only with current timestamp",
          Release: "patch",
          Captures: "Overdue sleep alert sheet with quick wake-time chips (-15m, -30m, -1h)",
          Sources: "–",
          "Checked on": "main @ b049258e",
        },
        render: idea("Quality", "Forgotten sleep timers run for 12+ hours and corrupt baby sleep metrics", "Detect overdue sleep sessions and offer quick retroactive wake-time correction"),
        spec: {
          today: ["model.stopTimed only records Date() as end time; no prompt or overdue check exists."],
          proposed: ["Add overdue sleep detection and prompt with quick time offset buttons when stopping a session > 4h."],
          files: [
            "projects/weehours/apps/ios/App/Sources/CareView.swift",
            "projects/weehours/apps/ios/App/Sources/AppModel.swift",
          ],
          risks: ["Must preserve the append-only log structure by issuing a correction event."],
          verify: ["Test stopping sleep session with retroactive time adjustment, confirming valid duration in derived log."],
        },
      },
      {
        id: "weehours-caregiver-live-activity", n: 30, group: "weehours", name: "Multi-Caregiver Active Nursing/Sleep Live Activity (ActivityKit)",
        tagline: "Live Activity & Dynamic Island for active nursing, pumping, and sleep timers",
        concept: "Wee Hours tracks timed nursing, pumping, and sleep sessions, but caregivers have to keep the app open to monitor active duration. With ActivityKit, active sessions can display on the Lock Screen and Dynamic Island with interactive stop/switch buttons.",
        moves: [
          "Create WeeHoursActivityAttributes declaring active event type (nursing, pumping, sleep) and start timestamp",
          "Display live timer and side indicator (left vs right breast) in Dynamic Island and Lock Screen",
          "Provide interactive LiveActivityIntent buttons to stop timer or switch nursing sides directly from Lock Screen",
        ],
        facts: {
          Project: "projects/weehours", Kind: "Feature", Effort: "M",
          Evidence: "projects/weehours/apps/ios/project.yml has Widgets and WatchWidgets targets, but lacks ActivityKit LiveActivity extension",
          Release: "minor",
          Captures: "Lock Screen and Dynamic Island showing active nursing timer and quick controls",
          Sources: "https://developer.apple.com/documentation/activitykit",
          "Checked on": "main @ b049258e",
        },
        render: idea("Feature", "Active nursing and sleep timers require keeping the app open to monitor", "Add ActivityKit Live Activity and Dynamic Island for active timers"),
        spec: {
          today: ["Wee Hours only has standard WidgetKit widgets; no ActivityKit Live Activity is declared."],
          proposed: ["Implement WeeHoursLiveActivity in Widgets target; update activity state when timed events start or stop."],
          files: [
            "projects/weehours/apps/ios/Widgets/WeeHoursLiveActivity.swift (new)",
            "projects/weehours/apps/ios/App/Sources/AppModel.swift",
            "projects/weehours/apps/ios/project.yml",
          ],
          risks: ["ActivityKit is iOS-only; target configuration must guard against watchOS compilation."],
          verify: ["Start nursing timer in simulator, verify Dynamic Island presentation and lock screen widget."],
        },
      },
    ],
  };
})();
