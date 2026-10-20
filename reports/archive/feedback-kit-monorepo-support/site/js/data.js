// Content for the walkthrough. Report, ids and paths are real (Wee Hours report 57827b45…,
// FeedbackKit project ids from `feedbackkit projects`, files in tianhaoz95/feedback-kit).
window.D = {
  projects: {
    waypack: { name: "Waypack", id: "b979182a-3e9d-45f5-b200-0cd1c08dfa03", path: "projects/waypack", label: "fk:waypack" },
    weehours: { name: "Wee Hours", id: "71d85688-ffc5-481c-8636-2b94dc5c1c90", path: "projects/weehours", label: "fk:weehours" },
  },

  // The default template (DeveloperApp/Sources/Services/PromptGenerator.swift) rendered for a real report.
  promptToday: `You are fixing an issue reported by a real user of this app. If it reads as a feature request rather than a bug, implement the requested behavior instead.

## User's report
Make the floating action button Liquid Glass

## Screen
home

## Environment
- OS: iOS 26.6.2
- Device: iPhone18,3
- App version: 0.1.2 (202610152230)
- Locale: en_US

## Screenshot
An annotated screenshot highlighting the issue is at: https://gpucoladcyvijefdjudf.supabase.co/storage/v1/object/sign/feedback-screenshots/<span class="ph">71d85688-ffc5-481c-8636-2b94dc5c1c90</span>/57827B45…/annotated.png?token=…

## Task
Investigate the code for the "home" screen, identify the root cause, and implement a minimal, style-consistent fix.`,

  promptProposed: `<mark>## App
Wee Hours — code in \`projects/weehours\` of tianhaoz95/hejitech-apps.
Work inside that folder; change shared code outside it only when the fix needs it.</mark>

You are fixing an issue reported by a real user of this app. If it reads as a feature request rather than a bug, implement the requested behavior instead.

## User's report
Make the floating action button Liquid Glass

## Screen
home

## Environment
- OS: iOS 26.6.2
- Device: iPhone18,3
- App version: 0.1.2 (202610152230)
- Locale: en_US

## Screenshot
An annotated screenshot highlighting the issue is at: https://gpucoladcyvijefdjudf.supabase.co/storage/v1/object/sign/feedback-screenshots/71d85688…/57827B45…/annotated.png?token=…

## Task
Investigate the code for the "home" screen <mark>in \`projects/weehours\`</mark>, identify the root cause, and implement a minimal, style-consistent fix.`,

  promptTemplateHeader: "## App\n{{project_name}} — code in `{{project_path}}` of {{repo}}.",

  promptNotes: {
    today: `<h3>How an agent finds the app today</h3><p>Only by inference: the project id in the screenshot URL (highlighted), mapped with <code>feedbackkit projects</code>, or hints such as the build-number format and screen names. In this monorepo a "home" screen exists in both apps.</p>`,
    proposed: `<h3>What changed</h3><ul><li>A header names the app, the repo and the folder, from <code>{{project_name}}</code>, <code>{{repo}}</code> and <code>{{project_path}}</code>.</li><li>The task line scopes the search to the folder.</li><li>Single-repo projects (empty path) get <i>"code in tianhaoz95/myapp"</i> and nothing else changes.</li></ul>`,
  },

  journey: [
    { title: "A parent reports from the app", node: "app",
      body: "Shake to report in Wee Hours. The SDK sends the text, screenshot and environment with the Wee Hours project key, so the report lands in the right FeedbackKit project.", chips: [["old", "unchanged"]] },
    { title: "It lands in the Wee Hours project", node: "project",
      body: "Products keep their role: this report is tagged iphone. Projects are apps; products are platforms within one.", chips: [["old", "unchanged"]] },
    { title: "An issue is filed in the shared repo", node: "issue",
      body: "create-github-issue files into tianhaoz95/hejitech-apps, as today, but titles it \"[Wee Hours] …\" and adds the project label fk:weehours next to any dispatch labels. Waypack's issues get fk:waypack.", chips: [["new", "project label"], ["new", "title prefix"]] },
    { title: "Only Wee Hours' agent workflow picks it up", node: "runner",
      body: "The setup-agent-runner template, generated per project, triggers on fk:weehours and runs with working-directory projects/weehours. Two apps' runners can live in one repo without both firing.", chips: [["new", "per-project runner template"]] },
    { title: "The agent reads a prompt that names the folder", node: "agent",
      body: "The rendered prompt starts with the app, repo and folder (section 3). The agent fixes the issue inside projects/weehours.", chips: [["new", "{{project_path}}"]] },
    { title: "The fix commit carries the trailer", node: "commit",
      body: "\"FeedbackKit: 57827b45-…\" in the message, as today. The commit touches projects/weehours/apps/ios/App/Sources/HomeView.swift.", chips: [["old", "unchanged"]] },
    { title: "The webhook links it", node: "webhook",
      body: "On push to main, github-webhook finds every project whose github_repo is hejitech-apps (Waypack and Wee Hours), then looks the trailer's id up across both. Only the Wee Hours report matches. This already works.", chips: [["old", "already works"]] },
    { title: "The release ships it, with a path check", node: "release",
      body: "weehours-testflight.yml runs feedbackkit release with Wee Hours' token. The fix is an ancestor of the build, and its commit touches projects/weehours, so it ships. A Waypack-only commit carrying this id would be flagged.", chips: [["new", "path check"]] },
    { title: "The parent is asked \"is it fixed?\"", node: "app2",
      body: "On build 202610201000 or newer, the app shows the card, and the parent confirms or reopens on their device.", chips: [["old", "unchanged"]] },
  ],

  // Folder tree for the CLI explorer. cfg = a feedbackkit.json lives here.
  tree: [
    { path: "", label: "hejitech-apps/", depth: 0 },
    { path: ".github/workflows", label: ".github/workflows/", depth: 1 },
    { path: "projects", label: "projects/", depth: 1 },
    { path: "projects/waypack", label: "waypack/", depth: 2, cfg: "waypack" },
    { path: "projects/waypack/apps/mobile", label: "apps/mobile/", depth: 3 },
    { path: "projects/waypack/services/mcp", label: "services/mcp/", depth: 3 },
    { path: "projects/weehours", label: "weehours/", depth: 2, cfg: "weehours" },
    { path: "projects/weehours/apps/ios", label: "apps/ios/", depth: 3 },
    { path: "projects/weehours/services/web", label: "services/web/", depth: 3 },
    { path: "supabase", label: "supabase/", depth: 1 },
  ],

  commits: [
    { sha: "7cacb90", msg: "Wee Hours: growth tracking, Liquid Glass mic, empty timeline", paths: ["projects/weehours/apps/ios/App/Sources/HomeView.swift", "projects/weehours/spec/event-types.json"], fix: "57827b45", inBuild: true },
    { sha: "fad34fa", msg: "Wee Hours: a fresh install starts at sign-in", paths: ["projects/weehours/apps/ios/App/Sources/AppModel.swift"], fix: "b07cc8cc", inBuild: true },
    { sha: "3e91a0d", msg: "Waypack: fix trip card spacing (wrong trailer pasted)", paths: ["projects/waypack/apps/mobile/lib/screens/trips_screen.dart"], fix: "0a9a92e8", inBuild: true },
    { sha: "d41c2b7", msg: "Wee Hours: timeline grouping (merged after the build)", paths: ["projects/weehours/apps/ios/App/Sources/TimelineView.swift"], fix: "7ffdd8dc", inBuild: false },
  ],

  phases: [
    { n: 1, title: "Root directory + prompt placeholders", effort: "~1–2 days",
      body: "Add projects.github_path (and github_label) with a dashboard field next to the repo picker. Add {{project_name}}, {{repo}}, {{project_path}} to all four renderers and lead the default template with them; group the merged prompt by project.",
      files: ["supabase/migrations/0030_project_path.sql", "supabase/functions/_shared/promptTemplate.ts", "web/src/lib/prompt-template.ts", "cli/src/promptTemplate.ts", "DeveloperApp/Sources/Services/PromptGenerator.swift", "web/src (project settings)"],
      solves: "Gap 1: prompts identify their app and folder." },
    { n: 2, title: "feedbackkit.json discovery in the CLI", effort: "~1 day",
      body: "Walk up from the working directory to the nearest feedbackkit.json; `feedbackkit init` writes it from a project picker. Precedence: --project, env, nearest file, only project. Warn when a --token's project disagrees with the folder.",
      files: ["cli/src/config.ts", "cli/src/loop.ts", "cli/src/index.ts", "cli/src/commands/init.ts (new)", "cli/src/docs.ts"],
      solves: "Gap 2: list, prompt, release and watch work in each app's folder without flags." },
    { n: 3, title: "Project labels + per-project runner templates", effort: "~1–2 days",
      body: "create-github-issue adds the project label (default fk:<slug>) and a \"[Project]\" title prefix when the repo has several projects. The agent-runner and release-loop templates take the project's label and path: label filter in `on: issues`, working-directory everywhere, and `feedbackkit release` run from the folder.",
      files: ["supabase/functions/create-github-issue/index.ts", "supabase/functions/_shared/github.ts", "skills/setup/setup-agent-runner/templates/*", "skills/setup/setup-release-loop/templates/*"],
      solves: "Gap 3: one repo, one runner per app, each in its own folder." },
    { n: 4, title: "Path check on release", effort: "~½ day",
      body: "feedbackkit release reads each linked fix commit's changed files (git diff-tree) and warns when none is under the project's path; later, a project setting turns the warning into a skip.",
      files: ["cli/src/commands/release.ts", "supabase/functions (release recording, optional server-side check)"],
      solves: "Gap 4: a mistyped trailer can't silently ship." },
    { n: 5, title: "Optional: repo view in the dashboard", effort: "later",
      body: "Group projects that share a repo, with one inbox filterable by project; show the folder next to each report.",
      files: ["web/src (inbox, project list)", "DeveloperApp/Sources/Views/Inbox"],
      solves: "Nice to have: triage a monorepo in one place." },
  ],
};
