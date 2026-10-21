// heji-build-next: copy over reports/<slug>/site/js/candidates.js and replace the example builds.
// One group per project; each group has a "keep main" baseline and the build(s) on its local branch.
// The user crowns one per group: a build = merge it, "Keep main" (or no pick) = don't.
// Media are real captures of the built branch in site/media/<project>/ (PNG screenshots, GIFs).
(() => {
  // A captured image in the surface it came from. `fit: "contain"` for media that isn't the frame's shape.
  const shot = (src, fit = "cover") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  const keepMain = (project, name, today) => ({
    id: `${project}-main`, n: 0, name: `${name}: keep main`, group: project,
    tagline: "Don't merge anything for this project", concept: today,
    facts: { Project: `projects/${project}`, Action: "Nothing merged, the branch is deleted" },
    render: () => `<div class="keep"><b>Keep main</b><small>${name} ships nothing this round</small></div>`,
  });

  window.REVIEW = {
    key: "__SLUG__-v1", dir: "reports/__SLUG__", repo: "__REPO__", port: __PORT__,   // new.sh fills these
    project: "projects (one group per project below)",
    context: ["CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md"],
    brief: "heji-build-next run on <date>: for every project, the agent picked the next most valuable thing (feature, quality/performance work or bug fix), built it on a local-only branch heji-build/<date>-<project>-<slug> (never pushed) and captured it running. Crown a build to merge it; crown \"Keep main\" or leave a project unpicked to drop it.",
    title: "__TITLE__",
    subtitle: "<n> builds across <m> projects, all real captures",
    heading: "Pick what to merge",
    intro: "Every build is finished code on a local branch; the screenshots and GIFs are the real app running it. Crown 🏆 a build to merge it (\"Keep main\" to skip a project), write notes for anything to change before merging, then <b>Copy summary</b> and paste it back to the agent: it merges what you picked into main, deletes every build branch, pushes and releases the projects that changed.",
    legend: ["<b><n></b> projects", "<b><n></b> builds"],
    round: 1,
    frame: "card", size: [900, 620],     // the card shows the hero capture; views show each capture in its own frame
    modes: false,                       // captures are what they are; capture dark mode as its own view
    groups: [
      { id: "weehours", name: "Wee Hours", note: "projects/weehours" },
      // … one per project that got a build (projects with nothing worth building are listed in intro)
    ],
    // The hand-off's "What to do next": the merge, cleanup and release (SKILL.md §6).
    nextSteps: ({ winners, groups }) => {
      const merge = winners.filter((c) => c.facts && c.facts.Branch);
      const skip = groups.filter((g) => !merge.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next review: every candidate below is already built on a local-only branch in this checkout. Follow `.claude/skills/heji-build-next/SKILL.md` §6 (merge, clean up, push, release). The user's notes on a build are changes to make on its branch before merging it (§6 step 2).", "",
        merge.length ? "**Merge into main (in this order):**" : "**Nothing picked to merge.** Still clean up the build branches (§6 step 3).",
        ...merge.map((c) => `- ${c.facts.Project}: \`${c.facts.Branch}\` (head \`${c.facts.Commit}\`), ${c.name}; release: ${c.facts.Release || "patch"}`), "",
        skip.length ? `**Not merged (branch deleted, nothing released):** ${skip.join(", ")}.` : "",
        "Then: delete every `heji-build/*` branch and worktree (`.claude/skills/heji-build-next/worktree.sh cleanup`), push main, wait for each merged project's CI to go green, and cut one release per merged project with `scripts/cut_release.sh <project> <level> --notes \"…\" --watch` (dry run first). Never push a heji-build branch.",
      ];
    },
    candidates: [
      keepMain("weehours", "Wee Hours", "Main as it is today."),
      {
        id: "weehours-example", n: 1, group: "weehours", name: "Example build",
        tagline: "What it is, in one line",
        concept: "Why this, why now: the evidence (an issue, a FeedbackKit report, a crash, a measured number, a past review's pick) and why it beat the other options. Value: who gets what.",
        moves: ["What changed for the user, 3–5 bullets"],
        facts: {
          Project: "projects/weehours", Kind: "Feature | Quality | Performance | Bug fix", Effort: "S | M | L",
          Branch: "heji-build/2026-10-20-weehours-example", Commit: "abc1234", Base: "main @ def5678",
          Diff: "+120 −30 in 6 files", Tests: "xcodebuild test: 48 passed (2 new)", Release: "minor (1.4.0 → 1.5.0)",
          Captured: "iPhone 17 simulator (device can't be screen-recorded headlessly); tested on the attached iPhone",
        },
        render: shot("weehours/hero.png", "contain"),
        views: [
          { name: "Before (main)", frame: "phone", render: shot("weehours/before.png") },
          { name: "After (this branch)", frame: "phone", render: shot("weehours/after.png") },
          { name: "The flow, recorded", frame: "phone", render: shot("weehours/flow.gif") },
        ],
        spec: {   // "how it's implemented": rendered under the captures and copied into the hand-off
          today: ["How it worked before, with file/type names"],
          proposed: ["What the branch does instead"],
          files: ["projects/weehours/apps/ios/App/Sources/… (the files the diff touches)"],
          risks: ["What could regress, anything not done, owner steps still needed"],
          verify: ["What was run and what it showed"],
        },
        // design: [{ kind: "flow" | "chart" | "table" | "code" | "steps", … }] when the change is structural or measured
      },
    ],
  };
})();
