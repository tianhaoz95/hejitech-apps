// heji-build-next review, 2026-10-20: one group per project, each with "keep main" and the build on
// its local branch. Media are real captures of the built branches in site/media/<project>/.
(() => {
  // A captured image in the surface it came from. `fit: "contain"` for media that isn't the frame's shape.
  const shot = (src, fit = "cover") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  // The card's hero: before and after side by side, each labelled.
  const pair = (before, after, a = "Before (main)", b = "After (this branch)") => () =>
    `<div class="pair"><figure><img src="media/${before}" alt=""><figcaption>${a}</figcaption></figure>` +
    `<figure><img src="media/${after}" alt=""><figcaption>${b}</figcaption></figure></div>`;
  const keepMain = (project, name, today) => ({
    id: `${project}-main`, n: 0, name: `${name}: keep main`, group: project,
    tagline: "Don't merge anything for this project", concept: today,
    facts: { Project: `projects/${project}`, Action: "Nothing merged, the branch is deleted" },
    render: () => `<div class="keep"><b>Keep main</b><small>${name} ships nothing this round</small></div>`,
  });
  const BASE = "origin/main @ 861320bd";

  window.REVIEW = {
    key: "2026-10-20-build-next-v1", dir: "reports/2026-10-20-build-next", repo: "tianhaoz95/hejitech-apps", port: 8798,
    project: "projects (one group per project below)",
    context: ["CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md"],
    brief: "heji-build-next run on 2026-10-20: for every project, the agent picked the next most valuable thing (feature, quality/performance work or bug fix), built it on a local-only branch heji-build/2026-10-20-<project>-<slug> (never pushed) and captured it running. Evidence came first from open FeedbackKit reports (read from the FeedbackKit database, read-only), then production checks, then code audits. Crown a build to merge it; crown \"Keep main\" or leave a project unpicked to drop it.",
    title: "Build round 2026-10-20",
    subtitle: "8 builds across 8 projects, all real captures",
    heading: "Pick what to merge",
    intro: "Every build is finished, tested code on a local branch; the screenshots are the real app running it (where each was captured is in its facts). Crown 🏆 a build to merge it (\"Keep main\" to skip a project), write notes for anything to change before merging, then <b>Copy summary</b> and paste it back to the agent in this checkout: it merges what you picked into main, deletes every build branch, pushes and releases the projects that changed." +
      "<br><br><b>Found along the way, not built:</b> the FeedbackKit reports 13b6844a and a37a1a83 (Voxbrief) were fixed in b7c4da9b but are still \"new\" in FeedbackKit; FeedbackKit's own 89df7b1c (Portal inbox on first open, 2026-09-23, build 4) no longer matches the rewritten inbox, so it can be closed; report 2cc4d6fc (keep your name off the sites) is about the shared docs site (<code>pages/.vitepress/config.mts</code>, not a project), and Voxbrief's own site pages also carry the name; Voxbrief's committed <code>project.pbxproj</code> still says 1.26.7 while <code>project.yml</code> says 1.27.0.",
    legend: ["<b>8</b> projects", "<b>8</b> builds", "<b>3</b> from user reports"],
    round: 1,
    frame: "card", size: [900, 620],
    modes: false,
    groups: [
      { id: "contempo", name: "Contempo", note: "projects/contempo" },
      { id: "feedbackkit", name: "FeedbackKit", note: "projects/feedbackkit" },
      { id: "meowtrix", name: "Meowtrix", note: "projects/meowtrix" },
      { id: "tinytouch", name: "TinyTouch", note: "projects/tinytouch" },
      { id: "toddlercam", name: "ToddlerCam", note: "projects/toddlercam" },
      { id: "voxbrief", name: "Voxbrief", note: "projects/voxbrief" },
      { id: "waypack", name: "Waypack", note: "projects/waypack" },
      { id: "weehours", name: "Wee Hours", note: "projects/weehours" },
    ],
    nextSteps: ({ winners, groups }) => {
      const merge = winners.filter((c) => c.facts && c.facts.Branch);
      const skip = groups.filter((g) => !merge.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next review: every candidate below is already built on a local-only branch in this checkout. Follow `.claude/skills/heji-build-next/SKILL.md` §6 (merge, clean up, push, release). The user's notes on a build are changes to make on its branch before merging it (§6 step 2).", "",
        merge.length ? "**Merge into main (in this order):**" : "**Nothing picked to merge.** Still clean up the build branches (§6 step 3).",
        ...merge.map((c) => `- ${c.facts.Project}: \`${c.facts.Branch}\` (head \`${c.facts.Commit}\`), ${c.name}; release: ${c.facts.Release || "patch"}`), "",
        skip.length ? `**Not merged (branch deleted, nothing released):** ${skip.join(", ")}.` : "",
        "Then: delete every `heji-build/*` branch and worktree (`.claude/skills/heji-build-next/worktree.sh cleanup`), push main, wait for each merged project's CI to go green, and cut one release per merged project with `scripts/cut_release.sh <project> <level> --notes \"…\" --watch` (dry run first). Meowtrix: bump package.json to 1.34.4 on main first. Never push a heji-build branch.",
        "Housekeeping after the round: stop the local Supabase stack started for the Contempo capture, delete the simulator created for this round, and reinstall TinyTouch and ToddlerCam from TestFlight on the test iPhone (debug builds were installed over them).",
      ];
    },
    candidates: [
      // ── Contempo ──────────────────────────────────────────────────────────────────────────────
      keepMain("contempo", "Contempo", "Main as it is today: the web app and /admin/ render a blank page in production, and the web dashboard counts everyone's hours toward the owner's test."),
      {
        id: "contempo-web", n: 1, group: "contempo", name: "Web app renders again, and counts only your hours",
        tagline: "Fixes a blank production site, then the dashboard's 100-hour math",
        concept: "Checking the web dashboard for the owner-hours bug turned up something worse: https://contempo.hejitech.workers.dev and its /admin/ are blank pages in production (\"Cannot read properties of null (reading 'useRef')\"), because the monorepo hoists react-router next to a React 18 another workspace pulls in, so the bundle carries two Reacts. That's fixed first. Then the bug I came for: the web dashboard summed every confirmed hour, including the cleaner's and co-host's, while the iOS and Android apps count only the owner's (the 100- and 500-hour tests need the owner's participation to exceed everyone else's). On the demo account the web said 139 / 100 (test met) where the phone says 51 / 100. For an audit-defense product a wrong \"met\" is the worst possible number. Runner-ups: the 100/500/750-hour test picker (large, three platforms), rewriting the Android instrumented tests.",
        moves: [
          "The site and /admin/ render again (one React via Vite resolve.dedupe)",
          "Test progress counts only your own hours, like the apps",
          "\"Hours by role\" under the progress bar compares you with each role, open when someone else logged as much as you",
          "Pending excludes running timers and trips (like the apps)",
          "Entries table and CSV export say who each entry was logged for",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Bug fix", Effort: "S",
          Branch: "heji-build/2026-10-20-contempo-web-owner-hours", Commit: "9bd2fa51", Base: BASE,
          Diff: "+211 −9 in 11 files", Tests: "npm test 5/5 (4 new), typecheck, web + admin build",
          Release: "patch (3.0.2 → 3.0.3; the fix ships with the Worker deploy on push)",
          Captured: "Playwright (Chromium) against vite dev + the local Supabase stack, seeded demo host (owner 51 h, cleaner 78 h, co-host 10 h); production blank page checked with Playwright",
        },
        render: pair("contempo/before.png", "contempo/after.png", "Before (crash fixed only)", "After"),
        views: [
          { name: "Main today: blank page", frame: "browser", render: shot("contempo/before-crash.png", "contain") },
          { name: "Before: 139 / 100, everyone's hours", frame: "browser", render: shot("contempo/before.png", "contain") },
          { name: "After: 51 / 100, your hours", frame: "browser", render: shot("contempo/after.png", "contain") },
          { name: "After, dark", frame: "browser", render: shot("contempo/after-dark.png", "contain") },
          { name: "Entries: who it was logged for", frame: "browser", render: shot("contempo/entries.png", "contain") },
        ],
        spec: {
          today: [
            "services/web and services/admin bundle react-router from the root node_modules, which resolves the root React 18 while the app uses its own React 19: every page crashes on its first hook (production, 2026-10-20).",
            "DashboardPage sums durationMinutes of every confirmed entry; entryFromRow drops role_id, role_name and in_progress.",
          ],
          proposed: [
            "vite.config.ts (web + admin): resolve.dedupe ['react', 'react-dom'].",
            "lib/metrics.ts dashboardMetrics(entries) mirrors DashboardMetrics.compute (iOS) / DashboardViewModel (Android): owner-only hours (roleId empty), Me-first role breakdown, pending excludes inProgress.",
            "ThresholdProgress shows the role comparison; entries table and CSV get a \"Logged for\" column.",
          ],
          files: ["projects/contempo/services/web/vite.config.ts", "projects/contempo/services/admin/vite.config.ts", "projects/contempo/services/web/src/lib/metrics.ts (new)", "projects/contempo/services/web/src/lib/entryModel.ts", "projects/contempo/services/web/src/lib/rows.ts", "projects/contempo/services/web/src/components/charts/ThresholdProgress.tsx", "projects/contempo/services/web/src/pages/DashboardPage.tsx", "projects/contempo/services/web/src/pages/EntriesPage.tsx", "projects/contempo/services/web/src/lib/csv.ts", "projects/contempo/services/web/test/metrics.test.ts (new)"],
          risks: [
            "Hours by property/category charts still include every role's hours (they describe the property, not the test).",
            "Not run: the Android/iOS production build scripts the project asks for after changes; no app code changed.",
            "Deploys with the Worker (Workers Builds on push, or npm run deploy -w @contempo/web).",
          ],
          verify: ["npm test -w @contempo/web: 5/5", "npm run typecheck + build (web and admin)", "Playwright on the branch: dashboard renders, no page errors; main: blank page, 2 page errors"],
        },
        design: [
          { kind: "table", title: "Same data, three readings", note: "Seeded demo host on the local stack: 51 h own, 78 h cleaner, 10 h co-host, 2 pending + 1 running timer.",
            head: ["", "Main (production)", "Main, crash fixed", "This branch", "iPhone/Android app"],
            rows: [["Test progress", "blank page", "139.0 / 100 (met)", "51.0 / 100", "51.0 / 100"], ["Pending review", "–", "3", "2", "2"], ["Role comparison", "–", "none", "Me 51 · Cleaner 78 · Co-host 10", "same"]] },
        ],
      },

      // ── FeedbackKit ───────────────────────────────────────────────────────────────────────────
      keepMain("feedbackkit", "FeedbackKit", "Main as it is today: the dashboard site ships as one 1.1 MB script, landing page included."),
      {
        id: "feedbackkit-split", n: 1, group: "feedbackkit", name: "Landing page loads 39% less JavaScript",
        tagline: "Routes load on demand; the hero shows 0.6 s sooner on a slow phone",
        concept: "FeedbackKit's only open user report (89df7b1c, Portal inbox on first open, September, build 4) describes an inbox that has since been rewritten (it now starts in a \"Loading feedback…\" state), so there was no live bug to fix. The next most valuable thing is the first impression: https://feedback-kit.hejitech.workers.dev serves the marketing landing page, the docs and the whole signed-in dashboard as one 1.1 MB script (301 KB compressed), so every prospective customer downloads the dashboard before seeing the hero. Splitting routes is safe, small and measurable. Runner-up: deferring supabase-js on the landing page (another ~210 KB, but it means reworking the auth provider).",
        moves: [
          "Every route except the landing page loads on demand (React.lazy)",
          "Dashboard and docs layouts keep their header while a page loads (Suspense inside the layout)",
          "A quiet spinner for the moment a page's code arrives",
          "No visual change otherwise",
        ],
        facts: {
          Project: "projects/feedbackkit", Kind: "Performance", Effort: "S",
          Branch: "heji-build/2026-10-20-feedbackkit-split-dashboard-bundle", Commit: "03fa84a3", Base: BASE,
          Diff: "+59 −33 in 4 files", Tests: "web: eslint, npm test 58/58, tsc -b + vite build",
          Release: "patch (1.0.63 → 1.0.64; the dashboard itself deploys through Cloudflare on push)",
          Captured: "vite preview of both builds with FeedbackKit's public Supabase URL/key, Playwright (Chromium)",
        },
        render: shot("feedbackkit/landing.png", "contain"),
        views: [
          { name: "Landing page (unchanged look)", frame: "browser", render: shot("feedbackkit/landing.png", "contain") },
          { name: "Docs page loaded on demand", frame: "browser", render: shot("feedbackkit/docs-cli.png", "contain") },
          { name: "Signed-out /projects → login, loaded on demand", frame: "browser", render: shot("feedbackkit/login.png", "contain") },
        ],
        spec: {
          today: ["web/src/App.tsx imports all 28 pages statically: one 1,102.59 kB chunk (306.17 kB gzip). Production serves index-BgHHu9pg.js, 1,102,786 B raw / 301,158 B compressed."],
          proposed: ["React.lazy for every page and both layouts; Suspense around <Routes> and inside DashboardLayout/DocsLayout around <Outlet>; components/RouteLoading.tsx.", "Main chunk 649.80 kB (186.83 kB gzip); remaining weight is react-dom (~177 kB), supabase-js (~210 kB), the dogfooded web SDK widget (~60 kB)."],
          files: ["projects/feedbackkit/web/src/App.tsx", "projects/feedbackkit/web/src/components/DashboardLayout.tsx", "projects/feedbackkit/web/src/components/docs/DocsLayout.tsx", "projects/feedbackkit/web/src/components/RouteLoading.tsx (new)"],
          risks: ["A deploy leaves old chunk names in already-open tabs: a lazy route opened after a deploy can fail to load until reload (standard SPA trade-off).", "Not measured on a real phone; numbers are emulated (below)."],
          verify: ["Landing → /docs → /docs/cli → /projects (redirects to /login) with no page errors, each chunk loaded on first visit", "eslint, 58 unit tests, build"],
        },
        design: [
          { kind: "chart", title: "Landing page, first visit (ms)", type: "bar", unit: "ms", x: ["Hero visible", "Load event"],
            series: [{ name: "main", values: [2253, 1936], basis: "measured", source: "Playwright, vite preview, slow-4G (1.6 Mbit/s, 150 ms) + 4x CPU throttle, cache off, median of 7, run twice" },
              { name: "this branch", values: [1668, 1351], basis: "measured", source: "same" }] },
          { kind: "table", title: "The numbers", head: ["", "main", "branch", "change"], rows: [["JS over the wire", "299.6 KB", "183.0 KB", "−39%"], ["JS decoded", "1,076.9 KB", "634.6 KB", "−41%"], ["Hero heading visible", "2,253 ms", "1,668 ms", "−26%"], ["Load event", "1,936 ms", "1,351 ms", "−30%"]] },
        ],
      },

      // ── Meowtrix ──────────────────────────────────────────────────────────────────────────────
      keepMain("meowtrix", "Meowtrix", "Main as it is today: every reload re-checks 14 vendor files with the server, and opening the editor re-checks Monaco."),
      {
        id: "meowtrix-cache", n: 1, group: "meowtrix", name: "Editor opens in 18 ms after a reload",
        tagline: "Monaco and bundled libraries are cached instead of re-checked every load",
        concept: "Meowtrix is used over tunnels, where each round trip costs. Its latency report's recommendations (compression, WebSocket deflate, local Monaco) are already in, but Monaco, marked, the WebGL addon and the FeedbackKit SDK are served with no max-age, so every reload revalidates 14 files and opening the code editor re-checks ~20 Monaco files. xterm already had a 1-day cache; this extends the same idea. Monaco gets a version-stamped URL cached as immutable, so an update can never mix two Monaco versions. No open reports or issues for Meowtrix (its last one is fixed). Runner-up: the CoDesign tab idea (large).",
        moves: [
          "Opening the code editor after a reload: 914 ms → 18 ms",
          "Requests per reload: 47 → 32 (no vendor file re-checked)",
          "Monaco served at /vendor/monaco-editor@<version>, immutable",
          "What's New 1.34.4 fix entry",
        ],
        facts: {
          Project: "projects/meowtrix", Kind: "Performance", Effort: "S",
          Branch: "heji-build/2026-10-20-meowtrix-cache-vendor-assets", Commit: "1b7f6a02", Base: BASE,
          Diff: "+28 −10 in 3 files", Tests: "Playwright tests/meowtrix.spec.js 54/54 (Chromium, Firefox, WebKit)",
          Release: "patch (1.34.3 → 1.34.4; bump package.json on main before cutting)",
          Captured: "Playwright against a local server (BASE_URL; the suite's Docker web server runs on the remote Docker context)",
        },
        render: shot("meowtrix/editor.png", "contain"),
        views: [{ name: "Editor tab on the branch (versioned Monaco, workers running)", frame: "browser", render: shot("meowtrix/editor.png", "contain") }],
        spec: {
          today: ["server.js: express.static for /vendor/monaco-editor, /vendor/marked, /vendor/xterm-addon-webgl, /vendor/feedbackkit-web without maxAge (ETag revalidation every load); public/editor.js loads Monaco from /vendor/monaco-editor/min."],
          proposed: ["MONACO_URL = /vendor/monaco-editor@<monaco version> with maxAge 365d + immutable; /meowtrix-version.js also sets window.MEOWTRIX_MONACO_BASE; editor.js uses it (falls back to the plain path for the static demo).", "marked, WebGL addon, FeedbackKit SDK: vendorCache (1 day), as xterm already had. The unversioned Monaco path stays for open pages."],
          files: ["projects/meowtrix/server.js", "projects/meowtrix/public/editor.js", "projects/meowtrix/public/whats-new.json"],
          risks: ["After a self-update, the 1-day cached single-file libraries can be a day old in an open browser (same trade-off already accepted for xterm)."],
          verify: ["Playwright suite 54/54", "Measured below (CDP, warm cache)"],
        },
        design: [
          { kind: "table", title: "Reload with a warm cache, then open the editor", note: "Playwright Chromium, CDP 10 Mbit/s with 60 ms latency, median of 9 reloads (load event: median of 7). Cold first visits are unchanged.",
            head: ["", "main", "branch"], rows: [["Requests reaching the server", "47", "32"], ["Vendor files re-checked (304)", "14", "0"], ["Open the code editor (ensureMonaco)", "914 ms", "18 ms"], ["Page load event", "478 ms", "476 ms"]] },
        ],
      },

      // ── TinyTouch ─────────────────────────────────────────────────────────────────────────────
      keepMain("tinytouch", "TinyTouch", "Main as it is today: VoiceOver reads the parent dashboard's switches without names."),
      {
        id: "tinytouch-a11y", n: 1, group: "tinytouch", name: "Parent dashboard works with VoiceOver and large text",
        tagline: "Named switches, announced selections, layouts that stack at accessibility sizes",
        concept: "TinyTouch had no accessibility labels at all. On the parent's iPhone dashboard every settings switch is Toggle(\"\") with a hidden label, so VoiceOver says \"switch, off\" with no name (including \"Shake to Send Feedback\"); the selected game and timer aren't announced; \"3m\" reads as \"3 m\". At the largest text sizes the watch card squeezes \"Apple Watch Remote\" into a column a few letters wide. A parent using VoiceOver or large text can't run the remote. No user reports or CI failures for TinyTouch. Runner-ups: the same pass for the safety guide and preview screens, and the watch app.",
        moves: [
          "Every switch is a labelled Toggle (subtitle as the hint)",
          "Games and timers announce \"selected\"; \"3 minutes\", \"3 seconds\"",
          "Live metrics read as one item each (\"Current game, Bubble Pop\")",
          "Watch card, metrics and hold-time rows stack at accessibility text sizes",
          "Fixed 10–12 pt labels became text styles",
        ],
        facts: {
          Project: "projects/tinytouch", Kind: "Quality (accessibility)", Effort: "S",
          Branch: "heji-build/2026-10-20-tinytouch-parent-voiceover", Commit: "47707593", Base: BASE,
          Diff: "+96 −72 in 1 file", Tests: "swift tools/run_tests.swift 87/87, generator drift none, simulator + device builds",
          Release: "patch (1.5.3 → 1.5.4)",
          Captured: "iPhone 13 (Debug build, default text size); largest text size in the iPhone 17 Pro simulator (text size can't be set on the device from the command line)",
        },
        render: pair("tinytouch/before-ax.png", "tinytouch/after-ax.png", "Before, largest text", "After, largest text"),
        views: [
          { name: "Before: largest text size", frame: "phone", render: shot("tinytouch/before-ax.png") },
          { name: "After: largest text size", frame: "phone", render: shot("tinytouch/after-ax.png") },
          { name: "After on the iPhone 13", frame: "phone", render: shot("tinytouch/after-device.png") },
          { name: "Before, default size (simulator)", frame: "phone", render: shot("tinytouch/before.png") },
          { name: "After, default size (simulator)", frame: "phone", render: shot("tinytouch/after.png") },
        ],
        spec: {
          today: ["TinyTouchiOS/Sources/Views/ParentDashboardView.swift: ToggleRow = Toggle(\"\", isOn:).labelsHidden(); HStacks with fixed widths; .font(.system(size: 10…12))."],
          proposed: ["ToggleRow: Toggle(isOn:) { icon + title + subtitle } with accessibilityLabel/Hint; MetricView (one element per metric); accessibility labels, hints and .isSelected traits on game and timer buttons; AnyLayout HStack ↔ VStack on dynamicTypeSize.isAccessibilitySize for the header, metrics and hold-time rows; decorative icons hidden."],
          files: ["projects/tinytouch/TinyTouchiOS/Sources/Views/ParentDashboardView.swift"],
          risks: ["No automated accessibility audit (the project has no UI test target); VoiceOver speech isn't recorded, only the code and layouts.", "Safety guide, game preview and the watch app not covered."],
          verify: ["87/87 tests", "Installed and launched on the iPhone 13", "Largest-size screenshots before/after"],
        },
      },

      // ── ToddlerCam ────────────────────────────────────────────────────────────────────────────
      keepMain("toddlercam", "ToddlerCam", "Main as it is today: random tapping opens Parent Settings one time in three."),
      {
        id: "toddlercam-gate", n: 1, group: "toddlercam", name: "A parental gate a toddler can't tap through",
        tagline: "Type 8 × 5 on a keypad; three misses pause it",
        concept: "ToddlerCam is in the Kids Category, where Apple requires a parental gate children can't pass. Its gate asked a single-digit sum with three big answer buttons and no limit on tries: a toddler tapping at random gets in one time in three, which opens Parent Settings (gallery, Guided Access, the feedback switch). In a simulated minute of random tapping the old gate let every one of 2,000 sessions in. No user reports for ToddlerCam. Runner-ups: VoiceOver labels on the parent hub and watch remote.",
        moves: [
          "A times-table product (4–9 × 4–9) typed on a keypad: a random guess is right ~1 time in 90",
          "Three wrong answers pause the gate 30 s, doubling to at most 5 min; survives reopening",
          "A stored pause is capped, so a clock change can't shut it for good",
          "VoiceOver reads \"What is 8 times 5?\" and each key",
          "Debug builds open the gate with -parentGate (captures, checks)",
        ],
        facts: {
          Project: "projects/toddlercam", Kind: "Quality (Kids Category safety)", Effort: "S",
          Branch: "heji-build/2026-10-20-toddlercam-parental-gate", Commit: "cd534324", Base: BASE,
          Diff: "+285 −66 in 3 files", Tests: "xcodebuild test 28/28 (5 new), incl. a random-tapping simulation",
          Release: "patch (1.2.6 → 1.2.7)",
          Captured: "iPhone 13, Debug builds launched with -parentGate (main's capture: main + only that 6-line debug argument, built in a temporary worktree)",
        },
        render: pair("toddlercam/before.png", "toddlercam/after.png"),
        views: [
          { name: "Before: tap one of three", frame: "phone", render: shot("toddlercam/before.png") },
          { name: "After: type the answer", frame: "phone", render: shot("toddlercam/after.png") },
          { name: "After three wrong answers", frame: "phone", render: shot("toddlercam/after-locked.png") },
        ],
        spec: {
          today: ["KidsCam/UI/Components/ParentGateView.swift: num1 2…5 + num2 2…4, three answer buttons (answer ± up to 3), new question after a miss, no limit."],
          proposed: ["ParentGateChallenge (factors 4…9, two-digit answers, isCorrect at the answer's length) and ParentGateAttempts (3 misses → 30 s, ×2 per lockout, max 300 s; restoring caps at 300 s) in the same file; keypad UI; lockout in @AppStorage(\"parentGateLockedUntil\")."],
          files: ["projects/toddlercam/KidsCam/UI/Components/ParentGateView.swift", "projects/toddlercam/KidsCam/UI/ToddlerCameraView.swift (DEBUG -parentGate)", "projects/toddlercam/KidsCamTests/KidsCamTests.swift"],
          risks: ["Parents who struggle with times tables: 4–9 tables only, and a miss just asks another question.", "The App Store screenshot tests rewrite AppStore/Screenshots on every run; those changes were reverted, not committed."],
          verify: ["28/28 tests", "On the iPhone: gate, keypad, lockout countdown"],
        },
        design: [
          { kind: "chart", title: "A minute of random tapping (2 taps/s, 2,000 simulated sessions)", type: "bar", unit: "%", max: 100, x: ["Sessions that got in"],
            series: [{ name: "old gate", values: [100], basis: "measured", source: "testRandomTappingRarelyPassesTheGate: 2000/2000" }, { name: "new gate", values: [5.2], basis: "measured", source: "same test: 104/2000" }] },
        ],
      },

      // ── Voxbrief ──────────────────────────────────────────────────────────────────────────────
      keepMain("voxbrief", "Voxbrief", "Main as it is today: [BLANK_AUDIO] and other sound tags show as raw text."),
      {
        id: "voxbrief-badges", n: 1, group: "voxbrief", name: "Sound tags become badges",
        tagline: "[BLANK_AUDIO] → Silence, [ Laughter ] → Laughter, with icons",
        concept: "Your FeedbackKit report 8c434578 (\"This blank audio is not converted to a badge\"), still open: the <|…|> control tokens already became badges, but Whisper's bracketed audio-event tags stayed raw text in a note's timings, and also leaked into the live transcript and search. The parser now reads them with the same rule Stage 2 already strips them by. The other two open Voxbrief reports were fixed in b7c4da9b. Runner-ups: Voxbrief's site pages carry your name (see intro).",
        moves: [
          "Silence, Laughter, Music, Applause and Inaudible badges, each with its own icon",
          "VoiceOver reads \"Sound: Silence\"",
          "Live transcript and search no longer show the tags",
          "What's New 1.27.1",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Bug fix (user report)", Effort: "S",
          Branch: "heji-build/2026-10-20-voxbrief-audio-event-badges", Commit: "5bf4a4c5", Base: BASE,
          Diff: "+117 −14 in 5 files", Tests: "run_unit_tests.sh: iOS 247 (3 new), macOS 10",
          Release: "patch (1.27.0 → 1.27.1)",
          Captured: "iPhone 17 Pro simulator with a seeded demo note: not on the iPhone, which holds your real memos",
        },
        render: pair("voxbrief/before.png", "voxbrief/after.png"),
        views: [
          { name: "Before", frame: "phone", render: shot("voxbrief/before.png") },
          { name: "After", frame: "phone", render: shot("voxbrief/after.png") },
          { name: "After, dark", frame: "phone", render: shot("voxbrief/after-dark.png") },
        ],
        spec: {
          today: ["Shared/Models/VoiceNote.swift TranscriptTimingSegment.parts splits only <|…|> tokens; NoteDetailView's TranscriptTokenBadge renders those."],
          proposed: ["SpecialToken.audioEvent(String) (normalized: \"blank audio\", \"laughter\"); parts finds the next <|…|> or [non-empty, no nested brackets] (the stripASRSpecialTokens rule); displayText drops both; badge title/icon/tint/accessibility for audio events."],
          files: ["projects/voxbrief/Shared/Models/VoiceNote.swift", "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift", "projects/voxbrief/VoxbriefApp/Views/WhatsNewView.swift", "projects/voxbrief/Tests/UnitTests/TranscriptSegmentTokenTests.swift", "projects/voxbrief/Tests/UnitTests/WhatsNewViewTests.swift"],
          risks: ["A user who says something in literal square brackets in a typed import would see it as a badge (dictated speech has none)."],
          verify: ["247 iOS + 10 macOS tests", "Simulator before/after on the demo note, light and dark"],
        },
      },

      // ── Waypack ───────────────────────────────────────────────────────────────────────────────
      keepMain("waypack", "Waypack", "Main as it is today: a gallery template's route is a sketch on blank paper in the app."),
      {
        id: "waypack-map", n: 1, group: "waypack", name: "A template's route on the online map",
        tagline: "Discover shows the real map, like the website; the sketch stays offline",
        concept: "Your FeedbackKit report dd4533e5 (\"The online map does not show up when I view a template from discovery\"), still open, on exactly the Sequoia Autumn Chill Weekend template in production. The website's template page puts the route on the online basemap; the app only drew a sketch, because templates aren't downloaded and its map page needs a trip. The fix serves the template as a virtual trip on the app's local server, so the existing map page and SDK draw it, with the Worker's public basemap as its online map. Runner-ups: the older in-progress reports about the site's screenshots (website, not the app).",
        moves: [
          "The route on the online map, pins named, routes per day",
          "Open it full screen with the day picker (now below the header, on trip maps too)",
          "Online map off, offline or a captive network: the sketch and its day legend stay",
          "Same map page and SDK as a downloaded trip's Map",
        ],
        facts: {
          Project: "projects/waypack", Kind: "Bug fix (user report)", Effort: "M",
          Branch: "heji-build/2026-10-20-waypack-template-online-map", Commit: "cb58a084", Base: BASE,
          Diff: "+341 −52 in 8 files", Tests: "flutter analyze clean, flutter test 96 (2 new)",
          Release: "patch (1.8.10 → 1.8.11)",
          Captured: "iPhone 17 Pro simulator against production (the real gallery template from the report): the iPhone build stalled twice in Flutter's AOT compiler (gen_snapshot idle, a system dialog appears to be waiting on the locked Mac), so no device capture",
        },
        render: pair("waypack/before-route.png", "waypack/after-route.png"),
        views: [
          { name: "Before: the sketch", frame: "phone", render: shot("waypack/before-route.png") },
          { name: "After: the online map", frame: "phone", render: shot("waypack/after-route.png") },
          { name: "After: full screen, with the day picker", frame: "phone", render: shot("waypack/after-full.png") },
        ],
        spec: {
          today: ["discover_screen.dart TemplateScreen paints RouteMapPainter (stops in a local projection) on paper; the native map page assets/app/map.html only exists for downloaded trips (/t/<id>/, manifest + tiles index); LocalServer's online map is a downloaded trip's planet URL, null with no downloads."],
          proposed: ["TripTemplate.mapManifest(): places (stops), one LineString route per day (mode from getting_around), days, map.bbox.", "LocalServer.virtualManifests + publicBasemap (Config.apiUrl + /api/public/basemap.pmtiles); /t/template-<slug>/manifest.json; the tiles index offers the online map as onlineMap ?? publicBasemap.", "widgets/template_route_map.dart: sketch underneath, BundleWebView of map.html#embed on top once a 16-byte range read of the basemap returns 206; expand → full-screen map with the day picker; day legend only with the sketch."],
          files: ["projects/waypack/apps/mobile/lib/models/template.dart", "projects/waypack/apps/mobile/lib/services/local_server.dart", "projects/waypack/apps/mobile/lib/state/app_state.dart", "projects/waypack/apps/mobile/lib/widgets/template_route_map.dart (new)", "projects/waypack/apps/mobile/lib/screens/discover_screen.dart", "projects/waypack/apps/mobile/assets/app/map.html", "projects/waypack/apps/mobile/test/discover_test.dart", "projects/waypack/apps/mobile/test/online_map_test.dart"],
          risks: ["Routes are straight lines between stops (as on the website), coloured by travel mode like trip maps, not by day like the sketch.", "A downloaded trip without an online_map now falls back to the public basemap too (more map, same proxy).", "The embedded map sits in a scrolling page: vertical drags scroll the page, taps and pinches go to the map."],
          verify: ["Tests: the manifest from the Sequoia fixture; the virtual trip's manifest, tiles index and range proxy to the public basemap", "Real run against production (below)"],
        },
      },

      // ── Wee Hours ─────────────────────────────────────────────────────────────────────────────
      keepMain("weehours", "Wee Hours", "Main as it is today: a voice entry waiting under \"tap to choose\" can only be logged or kept as a note."),
      {
        id: "weehours-discard", n: 1, group: "weehours", name: "Discard a voice entry waiting to be checked",
        tagline: "An ✕ on the waiting entry; nothing logged, Undo brings it back",
        concept: "Your FeedbackKit report 2b2507e4 (\"There is no way to delete this\", on the two waiting entries on Now), still open. A mistaken or test recording could only be logged or turned into a note, so it sat on Now (or became a stray note). Discard reuses the existing append-only events (keep as a note, then undo the note), so it needs no schema or sync change and converges on every phone. Multi-child is in flight (awaiting your picks) and the 63% question (30b08d19) is about the model's calibration, a model-training decision, so both were left alone. The 0.8.x reports marked shipped weren't revisited.",
        moves: [
          "An ✕ on each waiting entry on Now, and Discard in its long-press menu",
          "\"Discard this recording\" in Check this entry",
          "Toast \"Recording discarded\" with Undo (reopens it)",
          "\"None of these · keep as a note\" no longer looks destructive",
          "What's New 0.8.6",
        ],
        facts: {
          Project: "projects/weehours", Kind: "Bug fix (user report)", Effort: "S",
          Branch: "heji-build/2026-10-20-weehours-discard-voice-check", Commit: "97ebd2bd", Base: BASE,
          Diff: "+88 −11 in 5 files", Tests: "LogCore swift test 88 (1 new, 2 skipped), simulator app build",
          Release: "patch (0.8.5 → 0.8.6)",
          Captured: "iPhone 17 Pro simulator, local household (-localSetup Mia -demoText \"start feeding\" -skipPermissions), on-device Laya: not on the iPhone, which holds your real log (and -localSetup would replace it)",
        },
        render: pair("weehours/before-home.png", "weehours/after-home.png"),
        views: [
          { name: "Before: a waiting entry, no way to remove it", frame: "phone", render: shot("weehours/before-home.png") },
          { name: "After: ✕ to discard", frame: "phone", render: shot("weehours/after-home.png") },
          { name: "Check this entry (Discard is below the fold of this half-height sheet)", frame: "phone", render: shot("weehours/after-sheet.png") },
          { name: "What's New 0.8.6", frame: "phone", render: shot("weehours/whats-new.png") },
        ],
        spec: {
          today: ["HomeView.swift ReviewBanner: each capture is a button to the ReviewSheet; ReviewSheet offers the candidates or \"None of these · keep as a note\" (role .destructive) → AppModel.dismiss → LogService.dismissCapture (a note)."],
          proposed: ["LogService.discardCapture(id) = dismissCapture + undo(note). AppModel.discard(capture) shows \"Recording discarded\" with a reopen action labelled Undo (reopenCapture(id, undoing: [])). ReviewBanner rows get an ✕ button (44 pt, VoiceOver \"Discard …\") and a context menu; ReviewSheet gets \"Discard this recording\" with a footer; ToastView shows a trash icon for it."],
          files: ["projects/weehours/apps/ios/LogCore/Sources/LogCore/LogService.swift", "projects/weehours/apps/ios/App/Sources/AppModel.swift", "projects/weehours/apps/ios/App/Sources/HomeView.swift", "projects/weehours/apps/ios/App/Sources/WhatsNewView.swift", "projects/weehours/apps/ios/LogCore/Tests/LogCoreTests/LogCoreTests.swift"],
          risks: ["The undone note stays in the event log (visible with Timeline's show-undone), like any undo.", "The ✕ is one tap with no confirmation; Undo on the toast is the safety net."],
          verify: ["testDiscardLogsNothingAndCanBeReopened: capture dismissed, its note undone, reopen → needs review", "88 LogCore tests", "Simulator: chip with ✕ on the branch, none on main"],
        },
      },
    ],
  };
})();
