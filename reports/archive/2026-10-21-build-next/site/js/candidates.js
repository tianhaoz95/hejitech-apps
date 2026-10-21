// heji-build-next review, 2026-10-21: one group per project, each with "keep main" and the build on
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
  const BASE = "origin/main @ 55326a6b";

  window.REVIEW = {
    key: "2026-10-21-build-next-v1", dir: "reports/archive/2026-10-21-build-next", repo: "tianhaoz95/hejitech-apps", port: 8800,
    project: "projects (one group per project below)",
    context: ["CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md"],
    brief: "heji-build-next run on 2026-10-21: for every project, the agent picked the next most valuable thing (feature, quality/performance work or bug fix), built it on a local-only branch heji-build/2026-10-21-<project>-<slug> (never pushed) and captured it running. Evidence came from open FeedbackKit reports (read-only), production checks, reproductions on the attached iPhone, and code audits. Crown a build to merge it; crown \"Keep main\" or leave a project unpicked to drop it.",
    title: "Build round 2026-10-21",
    subtitle: "8 builds across 8 projects, all real captures",
    heading: "Pick what to merge",
    intro: "Every build is finished, tested code on a local branch; the captures are the real app running it (where each was captured is in its facts). Crown 🏆 a build to merge it (\"Keep main\" to skip a project), write notes for anything to change before merging, then <b>Copy summary</b> and paste it back to the agent in this checkout: it merges what you picked into main, deletes every build branch, pushes and releases the projects that changed." +
      "<br><br><b>Outcome:</b> merged Contempo, FeedbackKit, TinyTouch, ToddlerCam, Waypack and Wee Hours; Meowtrix and Voxbrief kept main (branches deleted)." +
      "<br><br><b>Found along the way, not built:</b> " +
      "<b>Waypack, owner steps:</b> production Supabase Auth was set up with site URL and redirect <code>https://waypack.app/auth/callback</code> (check Authentication → URL Configuration and remove waypack.app), and any App Store Connect URLs that say waypack.app; a domain of your own is your call. " +
            "<b>Shared docs site:</b> the footer still reads \"Copyright © 2026 Tianhao Zhou · HEJI Technology LLC\" (<code>pages/.vitepress/config.mts</code>, your report 2cc4d6fc); it's outside every project, so no branch touched it. " +
      "<b>FeedbackKit bookkeeping:</b> yesterday's merged fixes for 8c434578, dd4533e5 and 2b2507e4 (and a37a1a83, 13b6844a from 1.26.7) are still \"new\" there (the CLI isn't logged in on this Mac). " +
      "<b>ToddlerCam:</b> the committed <code>KidsCam.xcodeproj</code> says 1.2.5 while project.yml says 1.2.7 (CI regenerates it).",
    legend: ["<b>8</b> projects", "<b>8</b> builds", "<b>6</b> merged"],
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
        "Then: delete every `heji-build/*` branch and worktree (`.claude/skills/heji-build-next/worktree.sh cleanup`), push main, wait for each merged project's CI to go green, and cut one release per merged project with `scripts/cut_release.sh <project> <level> --notes \"…\" --watch` (dry run first). Meowtrix: bump package.json to the What's New version first. Contempo and FeedbackKit web changes: check the live site after pushing and deploy by hand if Workers Builds didn't (see the release-deploy-gotchas memory). Never push a heji-build branch.",
      ];
    },
    candidates: [
      // ── Contempo ──────────────────────────────────────────────────────────────────────────────
      keepMain("contempo", "Contempo", "Main as it is today: every dashboard sums every confirmed owner hour ever logged toward the 100-hour test."),
      {
        id: "contempo-year", n: 1, group: "contempo", name: "The hours test counts this tax year, and shows your pace",
        tagline: "On Jan 1 the test starts over; a line says when you'll reach 100 hours",
        concept: "The 100-hour (and 500-hour) material participation tests are annual, but the iOS, Android, Wear and web dashboards (and the watch complication, and the Chat agent's context) summed every confirmed hour ever logged. A host with 100 hours in 2026 would see \"test met\" for 2027 on New Year's Day, which is exactly the wrong number for an audit-defense product, and it lands in 10 weeks. On the seeded demo host (72 h in 2025, 51 h in 2026) main shows 123.0 / 100. The fix pairs with the MVP-scope item never built, \"projected finish date at current pace\", since it's the same computation. No open reports for Contempo. Runner-ups: the 100/500/750-hour test picker (three platforms, needs your call on onboarding), print/PDF export.",
        moves: [
          "Progress counts only the owner's confirmed hours whose activity is in the current calendar year (device time zone)",
          "Card title says the year: \"STR Test Progress · 2026\"",
          "One pace line: \"Test met for 2026\", \"On pace to reach 100 hrs by Nov 19\", or \"4.8 hrs a week reaches 100 by Dec 31\"",
          "Same figure on the Capture wordmark, watch app + complication, Wear OS and the Chat agent (which also counted other roles' hours)",
        ],
        facts: {
          Project: "projects/contempo", Kind: "Bug fix + feature", Effort: "M",
          Branch: "heji-build/2026-10-21-contempo-tax-year-pace", Commit: "340bb649", Base: BASE,
          Diff: "+653 −59 in 21 files", Tests: "ContempoCore 17 (9 new), Android core JVM 8 (new), web 13 (8 new, run in 3 time zones); install-ios-prod.sh Release build OK; install-android-prod.sh Release build OK (install refused: Play-signed copy on the phone)",
          Release: "minor (3.0.3 → 3.1.0)",
          Captured: "Playwright (Chromium) against vite dev + the local Supabase stack, seeded demo host (72 h in 2025, 51 h owner + 30 h cleaner in 2026). The apps talk to production only, so they weren't screenshotted; they share the tested logic.",
        },
        render: pair("contempo/before.png", "contempo/after.png"),
        views: [
          { name: "Before: 123.0 / 100, last year's hours included", frame: "browser", render: shot("contempo/before.png", "contain") },
          { name: "After: 51.0 / 100 · 2026, with the pace", frame: "browser", render: shot("contempo/after.png", "contain") },
          { name: "After, dark", frame: "browser", render: shot("contempo/after-dark.png", "contain") },
        ],
        spec: {
          today: ["DashboardMetrics.compute (iOS), DashboardViewModel (Android), dashboardMetrics (web) filter confirmed + owner only, no date filter", "Capture wordmark, Wear app, watch stats reader (server query) and Chat stats each re-sum the same way; Chat counted every role"],
          proposed: ["TestYearProgress (ContempoData Swift, core Kotlin, metrics.ts): year = the calendar year of `now`; hours = owner confirmed with activityDate in that year; pace measured from the first counted day (at least 14 days) to today", "Pace: met; onPace(finish) when the projected day is before Jan 1; behind(weekly hours needed to reach the threshold by Dec 31)", "Dashboards' role comparison uses the same year; every call site reads the helper"],
          files: ["ios/ContempoCore/Sources/ContempoData/Model/TestYearProgress.swift (new), DashboardMetrics.swift, WatchEntryStatsReader.swift", "ios/Contempo/Sources/App/Dashboard/*, Chat/ChatViewModel.swift", "android/core/.../TestYearProgress.kt (new) + test, app Dashboard/Capture/Chat, wear WearCaptureViewModel", "services/web/src/lib/metrics.ts, ThresholdProgress.tsx, DashboardPage.tsx"],
          risks: ["Export's CSV summary still totals everything it's given (it lists entries by date; scoping it is a separate choice)", "Hours-by-property/category charts on web stay all-time", "Calendar year = tax year (true for individual filers, the app's audience)"],
          verify: ["swift test (ContempoCore): 17 passed", "gradle :core:testDebugUnitTest: 8 passed", "npm test -w @contempo/web: 13 passed in LA, Tokyo and local time zones; typecheck + build", "install-ios-prod.sh --no-launch: Release iOS + watch + widgets built and installed", "install-android-prod.sh: Release phone + Wear built"],
        },
        design: [
          { kind: "table", title: "Same demo host, two readings", note: "Local Supabase stack, web dashboard on 2026-10-21.",
            head: ["", "main", "this branch"],
            rows: [["Test progress", "123.0 / 100 (met)", "51.0 / 100 · 2026"], ["Pace line", "–", "4.8 hrs a week reaches 100 by Dec 31"], ["Hours by role", "all years", "2026 only"]] },
        ],
      },

      // ── FeedbackKit ───────────────────────────────────────────────────────────────────────────
      keepMain("feedbackkit", "FeedbackKit", "Main as it is today: the landing page's entry script carries supabase-js (650 KB)."),
      {
        id: "feedbackkit-supabase", n: 1, group: "feedbackkit", name: "Landing page paints before supabase-js loads",
        tagline: "Entry script −32%, hero visible ~21% sooner on slow 4G",
        concept: "FeedbackKit has no open reports (its only \"new\" one, 89df7b1c, describes an inbox that was since rewritten). Its first impression is the landing page at feedback-kit.hejitech.workers.dev, and yesterday's route split left supabase-js in the entry script because the auth provider, analytics and the dashboard's organization/notification providers import it. This was yesterday's runner-up, measured. Runner-up today: shipping newer iOS SDKs from the monorepo (an open owner decision, so not built).",
        moves: ["The landing page's entry script drops from 649.9 KB to 421.2 KB (186.9 → 126.8 KB gzip)", "supabase-js loads right after the first paint; sign-in state arrives a moment later, as before", "Nothing looks different"],
        facts: {
          Project: "projects/feedbackkit", Kind: "Performance", Effort: "S",
          Branch: "heji-build/2026-10-21-feedbackkit-defer-supabase-landing", Commit: "114acba8", Base: BASE,
          Diff: "+54 −20 in 5 files", Tests: "eslint clean, 58 unit tests, tsc + vite build", Release: "patch (1.0.64 → 1.0.65)",
          Captured: "vite preview of both builds with FeedbackKit's public Supabase URL/key, Playwright (Chromium); signed-in check with a fake session and every Supabase request stubbed (nothing reached production)",
        },
        render: shot("feedbackkit/landing.png", "contain"),
        views: [
          { name: "Landing page (unchanged look)", frame: "browser", render: shot("feedbackkit/landing.png", "contain") },
          { name: "Signed-out /projects → login", frame: "browser", render: shot("feedbackkit/login.png", "contain") },
          { name: "Signed in: lazy dashboard shell with its providers", frame: "browser", render: shot("feedbackkit/signed-in.png", "contain") },
        ],
        spec: {
          today: ["lib/auth.tsx, lib/analytics.ts import lib/supabase statically; App.tsx imports OrganizationProvider and NotificationsProvider statically", "So supabase-js (auth-js, postgrest, realtime, storage) sits in index-*.js next to React"],
          proposed: ["lib/supabaseLoader.ts: loadSupabase() memoizes import(\"@/lib/supabase\")", "AuthProvider subscribes once the client loads (loading stays true until then); analytics awaits it per event", "components/DashboardShell.tsx: the providers + DashboardLayout as one lazy chunk"],
          files: ["projects/feedbackkit/web/src/App.tsx", "web/src/lib/auth.tsx, analytics.ts, supabaseLoader.ts (new)", "web/src/components/DashboardShell.tsx (new)"],
          risks: ["Bytes over the wire after 1.5 s are unchanged (supabase-js still loads for auth); the win is what blocks the first paint", "Deploys with the Worker: check feedback-kit.hejitech.workers.dev after pushing (manual deploy noted in memory)"],
          verify: ["Landing analytics page_view still sent (stubbed endpoint)", "Signed-out /projects → /login; signed-in /login → /projects with the dashboard shell; /docs/cli renders; no page errors on main or branch"],
        },
        design: [
          { kind: "chart", title: "Landing page, first visit (ms)", type: "bar", unit: "ms", x: ["Hero visible", "Load event"],
            series: [{ name: "main", values: [1720, 1364], basis: "measured", source: "Playwright, vite preview, slow-4G (1.6 Mbit/s, 150 ms) + 4x CPU, cache off, median of 7, two runs averaged (1758/1682, 1369/1358)" },
              { name: "this branch", values: [1360, 1052], basis: "measured", source: "same (1361/1359, 1050/1054)" }] },
          { kind: "table", title: "Entry script", head: ["", "main", "branch", "change"], rows: [["index-*.js", "649.9 KB", "421.2 KB", "−35%"], ["gzip", "186.9 KB", "126.8 KB", "−32%"], ["supabase chunk (gzip, loaded after paint)", "–", "58.7 KB", ""]] },
        ],
      },

      // ── Meowtrix ──────────────────────────────────────────────────────────────────────────────
      keepMain("meowtrix", "Meowtrix", "Main as it is today."),
      {
        id: "meowtrix-origin", n: 1, group: "meowtrix", name: "Local server hardening (not merged)",
        tagline: "Not merged; details kept out of this public report",
        concept: "A security hardening of Meowtrix's local server was built and verified on a local branch. It wasn't picked this round, so the branch was deleted and the details stay out of this public report.",
        facts: { Project: "projects/meowtrix", Kind: "Security", Outcome: "Not merged (branch deleted)" },
        render: () => `<div class="keep"><b>Not merged</b><small>Branch deleted; nothing released</small></div>`,
        views: [],
      },

      // ── TinyTouch ─────────────────────────────────────────────────────────────────────────────
      keepMain("tinytouch", "TinyTouch", "Main as it is today: settings changed on the watch revert at the next launch."),
      {
        id: "tinytouch-sync", n: 1, group: "tinytouch", name: "Settings changed on the watch stick",
        tagline: "And \"Bedtime lullaby now\" stops replaying at every launch",
        concept: "The watch's Parent Menu changes (game, sound, voice, haptics, calm mode) were never saved on the watch, and every launch re-applied the iPhone's last WatchConnectivity application context, so the watch went back to the phone's settings. That replay also re-fired one-shot actions: after \"Bedtime lullaby now\", every later launch opened in the lullaby, and a timer set from the phone restarted. The iPhone ignored watch-side changes, so its next toggle pushed the old game back, and its settings load broadcast seven payloads at launch. No user reports; found by reading the sync code (yesterday's round covered the parent dashboard's accessibility).",
        moves: ["Watch changes are saved and survive relaunch", "Phone payloads apply only when newer than the watch's last change: no more replayed lullaby or restarted timer", "The iPhone adopts newer watch settings, so the two agree", "Older iPhone apps (no stamp) behave as before"],
        facts: {
          Project: "projects/tinytouch", Kind: "Bug fix", Effort: "M",
          Branch: "heji-build/2026-10-21-tinytouch-watch-settings-stick", Commit: "03406c8d", Base: BASE,
          Diff: "+333 −149 in 7 files (pbxproj regenerated: +1 file)", Tests: "swift tools/run_tests.swift: 95/95 (8 new); xcodebuild TinyTouch (iOS + embedded watch) OK; generator output deterministic", Release: "patch (1.5.4 → 1.5.5)",
          Captured: "Apple Watch SE 3 simulator (watchOS 26.5): calm mode flipped through the real code path by a temporary, uncommitted launch argument, then the app's preferences read back. No iPhone + watch pair here, so the phone side is covered by the tests only.",
        },
        render: shot("tinytouch/evidence.png", "contain"),
        views: [
          { name: "What each build saves on the watch, and the sync tests", frame: "card", size: [900, 600], render: shot("tinytouch/evidence.png", "contain") },
          { name: "Watch Parent Menu (branch, relaunched)", frame: "card", size: [324, 394], render: shot("tinytouch/watch-parent-menu.png", "contain") },
        ],
        spec: {
          today: ["WatchConnectivityManager.applySettings persisted only phone payloads; attachAppState re-applied receivedApplicationContext at every launch (and activation applied it again)", "IOSSettingsSyncManager stamped payloads with the send time; loadLocalSettings ran property observers → 7 broadcasts + 7 queued transferUserInfo"],
          proposed: ["SettingsSync.isNewer(changedAt, than:) (watch Models): payloads carry settingsChangedAt = when a parent last changed them", "Watch: AppState.rememberParentChange saves + stamps on parent changes (not on the timer's switch to the lullaby); applySettings drops payloads not newer than the stamp", "iPhone: settingsChangedAt persisted; observers silenced while loading/adopting; adopts watch telemetry with a newer stamp; triggerLullabyNow sends one payload"],
          files: ["ToddlerPlay/Sources/Models/SettingsSync.swift (new), ViewModels/AppState.swift, Services/WatchConnectivityManager.swift, Views/ParentLock/ParentDashboardView.swift", "TinyTouchiOS/Sources/Services/IOSSettingsSyncManager.swift", "tools/run_tests.swift, ToddlerPlay.xcodeproj/project.pbxproj (generated)"],
          risks: ["Not run on a real iPhone + watch pair (none paired here): worth a quick try from TestFlight", "Phone and watch clocks are assumed in sync (they are, paired)"],
          verify: ["Watch simulator, main: no preferences file after the change; branch: calm mode and the stamp saved", "Model test of replays, one-shot actions, later phone changes and stamp-less payloads"],
        },
      },

      // ── ToddlerCam ────────────────────────────────────────────────────────────────────────────
      keepMain("toddlercam", "ToddlerCam", "Main as it is today: videos recorded on an iPhone contain the bundled demo footage, upside down."),
      {
        id: "toddlercam-video", n: 1, group: "toddlercam", name: "Videos record the cameras, right side up",
        tagline: "Reproduced on the iPhone 13: main records cartoon demo frames, upside down",
        concept: "Video mode composes each frame from DualCameraManager.getCurrentFrames(), which only had live frames in the simulator (the localhost streamer). On a device it fell back to frames from the bundled rear_video.mp4/front_video.mp4, so every video a parent recorded was demo footage, and the pixel-buffer drawing wasn't flipped, so it came out upside down. A 3-second recording on the attached iPhone 13 confirmed both. Devices that can't run both cameras at once also saved a demo frame as the photo. No user reports (the simulator hides it). Runner-up: VoiceOver labels on the parent hub.",
        moves: ["Recordings use each camera's live frames (video data outputs; the front one still feeds face masks)", "Frames are upright", "Single-camera devices save the real photo", "New test: recorded frames are upright"],
        facts: {
          Project: "projects/toddlercam", Kind: "Bug fix", Effort: "S",
          Branch: "heji-build/2026-10-21-toddlercam-real-camera-video", Commit: "c0568f63", Base: BASE,
          Diff: "+111 −1 in 3 files", Tests: "xcodebuild test (iPhone 18 Pro sim): 29 passed (1 new); Debug build on the iPhone 13", Release: "patch (1.2.7 → 1.2.8)",
          Captured: "iPhone 13, Debug builds of main and the branch with a temporary, uncommitted launch argument that records 3 s by itself and skips Photos; clips pulled from the app container with devicectl. The phone lay on the desk: the back camera is dark, the front one sees the ceiling.",
        },
        render: pair("toddlercam/before.png", "toddlercam/after.png", "main: demo footage, upside down", "branch: the cameras"),
        views: [
          { name: "Before: the recorded clip (iPhone 13)", frame: "card", size: [420, 560], render: shot("toddlercam/before.gif", "contain") },
          { name: "After: the recorded clip (iPhone 13)", frame: "card", size: [420, 560], render: shot("toddlercam/after.gif", "contain") },
        ],
        spec: {
          today: ["DualVideoRecorder.appendCompositeFrame → getCurrentFrames(): simulatedRearFrame ?? captureCurrentVideoFrame(\"rear_video\") (random time in the demo clip)", "pixelBuffer(from:) drew a UIImage into a bottom-left-origin CGContext", "capturePhoto() without multi-cam → captureFromVideoFootage()"],
          proposed: ["Back camera gets an AVCaptureVideoDataOutput (portrait); single-cam sessions too; captureOutput keeps the newest CVPixelBuffer per camera under a lock", "getCurrentFrames() on real cameras converts those via CIContext (≤1600 px)", "pixelBuffer(from:) flips the context; single-cam capturePhoto uses the camera's photo output for both places"],
          files: ["projects/toddlercam/KidsCam/Camera/DualCameraManager.swift, DualPhotoRenderer.swift", "KidsCamTests/KidsCamTests.swift"],
          risks: ["An extra video output on the back camera in a multi-cam session: committed fine on the iPhone 13; worth a check on an older multi-cam device", "Recording still composes at the timer's 30 fps on the CPU, as before"],
          verify: ["devicectl clips: main 91 frames of demo art upside down; branch 91 frames of the cameras upright", "Unit tests incl. testPixelBufferIsUpright"],
        },
      },

      // ── Voxbrief ──────────────────────────────────────────────────────────────────────────────
      keepMain("voxbrief", "Voxbrief", "Main as it is today: a dictionary term only fixes the mishearings typed in as its aliases; the rest is left to the model."),
      {
        id: "voxbrief-soundalike", n: 1, group: "voxbrief", name: "Dictionary terms catch words that sound like them (not merged)",
        tagline: "Lite gets your terms right in 57 of 69 eval samples, up from 11",
        concept: "Your report 13b6844a (\"personal vocabulary is not working as intended\") got a prompt change in 1.26.7, but the eval baseline taken after it still shows the bundled Lite model fixing dictionary terms in only 14 of 69 samples (11 of 69 on this Mac). DictionaryCorrector only replaced aliases typed in by hand, so \"Wotsbrief\", \"Superbase\" or \"Tail scale\" reached Stage 2 as-is. A deterministic sound-alike pass before Stage 2 fixes them for every model, with guards against false positives. Runner-ups: iCloud sync (needs the Apple portal), the eval's light category (6/12).",
        moves: ["A term replaces 1–3 word runs that sound like it, no aliases needed", "Leaves alone words spelled like the term (\"notion\"), real English words (\"nation\", \"graphene\"), the term plus a suffix, and neighbouring short words", "Runs before Stage 2, so titles get it too", "What's New 1.27.2"],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality (your report)", Effort: "M",
          Branch: "heji-build/2026-10-21-voxbrief-sound-alike-terms", Commit: "86693435", Base: BASE,
          Diff: "+371 −15 in 6 files", Tests: "iOS VoxbriefTests 254 passed (7 new); macOS VoxbriefMacTests 11 passed (1 new: the eval's cases as a floor)", Release: "patch (1.27.1 → 1.27.2)",
          Captured: "evals/llm/run_eval.py with mlx on this Mac's GPU: the app's own exported prompts (LLMPromptExportTests) from main and from the branch, the bundled Qwen3-0.6B-4bit, 3 samples per case. No app screenshots: the change is in what the model receives.",
        },
        render: () => `<div class="keep"><b>Not merged</b><small>Branch deleted; nothing released</small></div>`,
        views: [],
        spec: {
          today: ["DictionaryCorrector.apply: alias regex replacement only; plain terms rely on the Stage 2 prompt"],
          proposed: ["SoundAlike: phonetic skeleton (ph/f, v·w/f, soft c/s, x/ks, qu/kw, silent gh; vowels and repeats dropped; leading vowel anchored)", "Match = equal skeleton (or one edit for a single misspelled word) + spelling distance ≤ 0.5 (≤ 0.35 for one edit); terms with skeletons under 4 letters skipped", "Guards: run already contains the term spelled as-is; single correctly spelled English word (UITextChecker / NSSpellChecker, main actor); term + suffix; split words need ≥ 3 letters each", "Closest match per position (exact before one-edit), one pass over the text for all terms, byte-level helpers"],
          files: ["projects/voxbrief/VoxbriefApp/Services/DictionaryCorrector.swift", "Tests/UnitTests/DictionaryCorrectorTests.swift, Tests/MacUnitTests/DictionaryEvalCasesTests.swift (new)", "VoxbriefApp/Views/WhatsNewView.swift (1.27.2), Tests/UnitTests/WhatsNewViewTests.swift, Voxbrief.xcodeproj (regenerated)"],
          risks: ["Still missed: Sigma→Figma and Shivawn→Siobhan (too short/too different), Weigh pack→Waypack (3-letter skeleton), Box brief (one edit across words is off on purpose)", "Hyphenated identifiers like feedback-kit would become the term (spoken transcripts don't contain them)", "The CI eval baseline will move: refresh baseline.json from the next CI run"],
          verify: ["Transcript level on the eval's cases: dictionary 1/23 → 19/23, false positives 9/9 kept", "171k words of repo prose with 21 terms: no false replacements beyond hyphenated feedback-kit; 7.3 s → 1.5 s after optimizing", "Full eval on Metal: overall 68/138 → 114/138; classification 30/30 and light 6/12 unchanged"],
        },
        design: [
          { kind: "chart", title: "Stage 2 eval on Lite, passing samples", type: "bar", unit: "samples", x: ["Dictionary (of 69)", "False positive (of 27)", "Overall (of 138)"],
            series: [{ name: "main", values: [11, 21, 68], basis: "measured", source: "run_eval.py, Metal, 3 samples/case, temperature 0.3, prompts exported from main" },
              { name: "this branch", values: [57, 21, 114], basis: "measured", source: "same, prompts exported from the branch" }] },
        ],
      },

      // ── Waypack ───────────────────────────────────────────────────────────────────────────────
      keepMain("waypack", "Waypack", "Main as it is today: the site, terms, privacy policy, CLI and agent skill send people to waypack.app, which isn't ours."),
      {
        id: "waypack-domain", n: 1, group: "waypack", name: "Send people to addresses we own, not waypack.app",
        tagline: "waypack.app is a parcel-delivery company's site",
        concept: "Crawling the production site for broken pages showed waypack.app serving someone else's app (\"Find someone already going there… send parcels\"), on its own Cloudflare account with its own mail servers; our Worker's custom-domain routes were never enabled. Yet the privacy policy tells people to email privacy@waypack.app for access and export, the terms send support to support@waypack.app, beta sign-ups go to beta@waypack.app, the CLI links waypack.app/docs, and the published agent skill names https://waypack.app/mcp as the MCP server. Every other HEJI site uses info@hejitech.com. The app itself had no such links. Runner-ups: the 3 icon buttons without labels, a contrast nit on the legal line.",
        moves: ["Contact addresses → info@hejitech.com (beta, support, privacy)", "Terms and privacy say \"this website\"", "Agent skill names the live Worker; the MCP tool still rewrites it to the serving deployment", "CLI help links the Waypack docs page; App Store listing draft uses the Worker address"],
        facts: {
          Project: "projects/waypack", Kind: "Bug fix (privacy)", Effort: "S",
          Branch: "heji-build/2026-10-21-waypack-own-domain-links", Commit: "90340c7a", Base: BASE,
          Diff: "+17 −17 in 9 files", Tests: "@waypack/mcp: 65 passed + typecheck; @waypack/cli: 8 passed + typecheck (after building the workspace packages, as CI does)", Release: "patch (1.8.11 → 1.8.12)",
          Captured: "waypack.app as it is today (public page); the site's privacy page served locally from main and the branch, Playwright",
        },
        render: pair("waypack/privacy-before.png", "waypack/privacy-after.png"),
        views: [
          { name: "What waypack.app is", frame: "browser", render: shot("waypack/waypack-app.png", "contain") },
          { name: "Privacy policy contact, main", frame: "browser", render: shot("waypack/privacy-before.png", "contain") },
          { name: "Privacy policy contact, branch", frame: "browser", render: shot("waypack/privacy-after.png", "contain") },
        ],
        spec: {
          today: ["site/*.html mailto: beta@/support@/privacy@waypack.app; skill/reference/upload.md: https://waypack.app/mcp and /account", "tools.ts rewrote https://waypack.app to PUBLIC_URL only inside get_authoring_guide"],
          proposed: ["site: info@hejitech.com and \"this website\"", "skill: https://waypack.hejitech.workers.dev (tools.ts now rewrites that origin); guide.ts regenerated", "CLI help → https://tianhaoz95.github.io/hejitech-apps/waypack/"],
          files: ["projects/waypack/site/index.html, privacy.html, terms.html", "skill/SKILL.md, skill/reference/upload.md, services/mcp/src/mcp/tools.ts, services/mcp/src/generated/guide.ts", "packages/cli/src/cli.ts, docs/store-listing.md"],
          risks: ["Owner steps: remove waypack.app from production Supabase Auth's site URL and redirects; App Store Connect URLs; a domain of your own if you want one", "Calendar UIDs and the bundle schema's $id still say waypack.app: identifiers, not links"],
          verify: ["Production crawl: 21 waypack.app pages are the other company's; /discover, /account, /api/public/templates 404 there and 200 on the Worker", "Worker + CLI tests and typecheck"],
        },
      },

      // ── Wee Hours ─────────────────────────────────────────────────────────────────────────────
      keepMain("weehours", "Wee Hours", "Main as it is today: the Timeline's filter rows float apart with big gaps."),
      {
        id: "weehours-timeline", n: 1, group: "weehours", name: "Timeline filters sit together",
        tagline: "Your report 4ec04025 from this morning",
        concept: "Your FeedbackKit report 4ec04025 (0.8.5, today: \"Why there are so many white spaces in between rows? Fix it\") on the Timeline with two children. The child picker, the category chips and the Day grid / Cards / Audit picker were three list sections, so the inset-grouped list put a section gap and a full row height around each; the rhythm card and the empty state were pushed down under the dock. They now share one row. 2b2507e4 was fixed yesterday; 30b08d19 (63% confidence) is a model-calibration decision, left alone.",
        moves: ["Child, category and detail controls stack with even 12 pt spacing", "Entries and the rhythm card start much higher", "What's New 0.8.7"],
        facts: {
          Project: "projects/weehours", Kind: "Bug fix (your report)", Effort: "S",
          Branch: "heji-build/2026-10-21-weehours-timeline-header-spacing", Commit: "0644c895", Base: BASE,
          Diff: "+46 −33 in 2 files", Tests: "LogCore swift test: 88 passed; App builds (iPhone 17 Pro simulator)", Release: "patch (0.8.6 → 0.8.7)",
          Captured: "iPhone 17 Pro simulator (iOS 26.5), -localSetup \"Mia,Leo\" -screen timeline, light and dark. The first-run notification prompt can't be dismissed headlessly here, so the captures are the top of the screen (the part that changed).",
        },
        render: pair("weehours/before.png", "weehours/after.png"),
        views: [
          { name: "Before", frame: "card", size: [603, 530], render: shot("weehours/before.png", "contain") },
          { name: "After", frame: "card", size: [603, 530], render: shot("weehours/after.png", "contain") },
          { name: "Before, dark", frame: "card", size: [603, 530], render: shot("weehours/before-dark.png", "contain") },
          { name: "After, dark", frame: "card", size: [603, 530], render: shot("weehours/after-dark.png", "contain") },
        ],
        spec: {
          today: ["TimelineView: child Picker (implicit section), Section { chips ScrollView }, Section { density Picker }, each with zero insets"],
          proposed: ["One Section with one row: VStack(spacing: 12) { child picker (when several), chips, density picker }, 4 pt vertical insets"],
          files: ["projects/weehours/apps/ios/App/Sources/TimelineView.swift", "apps/ios/App/Sources/WhatsNewView.swift (0.8.7)"],
          risks: ["Look checked in the simulator only; quick look on the phone after TestFlight", "Link the report after release: npx feedbackkit-cli link 4ec04025 --commit <sha>"],
          verify: ["Simulator before/after, light and dark, twins household", "LogCore tests, app build"],
        },
      },
    ],
  };
})();
