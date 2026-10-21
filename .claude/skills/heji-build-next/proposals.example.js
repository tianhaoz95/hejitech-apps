// heji-build-next, phase A: copy over reports/<date>-build-next-proposals/site/js/candidates.js and
// replace the example proposals. One group per project; each group has a "skip" baseline and the
// N proposals for that project. Per project the user crowns 🏆 one to build and may ♥ others to
// build too; "Skip" (or no pick) = build nothing there. Nothing is built before the hand-off.
(() => {
  // A real capture of today's problem, when there is one.
  const shot = (src, fit = "contain") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  // Otherwise a text card: the problem and the plan in a few words.
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
    key: "__SLUG__-v1", dir: "reports/__SLUG__", repo: "__REPO__", port: __PORT__,   // new.sh fills these
    project: "projects (one group per project below)",
    context: ["CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md"],
    brief: "heji-build-next proposals on <date>: for every project the agent read the current code and searched what's new outside (platform APIs, library and model releases, what users ask for), and proposes up to <n> things to build (features, quality/performance work, bug fixes). Per project, crown 🏆 the one to build and ♥ any others to build too; crown \"Skip\" to build nothing there.",
    title: "__TITLE__",
    subtitle: "<n> proposals across <m> projects",
    heading: "Pick what to build",
    intro: "Nothing is built yet. Per project, crown 🏆 the proposal to build, ♥ any others you want built as well (each gets its own branch), or crown <b>Skip</b>. Notes under a proposal change the plan. Then <b>Copy summary</b> and paste it back: the agent builds exactly your picks on local branches, captures them running and comes back with a second review to choose what to merge." +
      "<br><br><b>Not proposed:</b> <project>: <why>, one line each.",
    legend: ["<b><m></b> projects", "<b><n></b> proposals"],
    round: 1,
    frame: "card", size: [900, 620],
    modes: false,
    groups: [
      { id: "weehours", name: "Wee Hours", note: "projects/weehours" },
      // … one per project with proposals
    ],
    // The hand-off's "What to do next": phase B of the skill.
    nextSteps: ({ winners, groups }) => {
      const picked = winners.filter((c) => c.facts && c.facts.Kind);
      const skipped = groups.filter((g) => !picked.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next **proposal** review (phase A done). Follow `.claude/skills/heji-build-next/SKILL.md` phase B (§3–§7): build the picks on local-only branches, verify, capture, then present the build review. The user's notes on a proposal override its text.", "",
        "**Build, per project:** every 🏆 winner below, plus every proposal marked ♥ shortlisted in that project's section (each on its own branch).",
        ...picked.map((c) => `- ${c.facts.Project}: ${c.name} (\`${c.id}\`), ${c.facts.Kind}, release ${c.facts.Release || "patch"}`), "",
        skipped.length ? `**Build nothing for:** ${skipped.join(", ")} (unless a proposal there is ♥ shortlisted).` : "",
        "Never push a heji-build branch; main stays untouched until the build hand-off comes back.",
      ];
    },
    candidates: [
      skip("weehours", "Wee Hours"),
      {
        id: "weehours-example", n: 1, group: "weehours", name: "Example proposal",
        tagline: "What it is, in one line",
        concept: "The source: the gap in today's code (file:line on main), a measured number or reproduction, or what's new outside (a platform API, a library release, a better model, what users of such apps ask for; with the URL). Who benefits and how much.",
        moves: ["What would change for the user, 2–4 bullets"],
        facts: {
          Project: "projects/weehours", Kind: "Bug fix | Quality | Performance | Feature | Security", Effort: "S | M | L",
          Evidence: "One line: TimelineView.swift:120 rebuilds every row on each tick; or https://… (iOS 27 adds …)",
          Release: "patch (0.8.6 → 0.8.7)",
          Captures: "What the build review would show: simulator before/after, light and dark",
          // "Proposed before": "2026-10-21, not picked",   // only when projects/<name>/build-next.md has it
        },
        render: idea("Bug fix", "The problem in a few words", "The plan in one sentence"),
        // or: render: shot("weehours/report.png"), with the capture in site/media/weehours/
        spec: {
          today: ["How it works now, with file/type names"],
          proposed: ["What the build would do"],
          files: ["projects/weehours/… (the files it would touch)"],
          risks: ["What could regress, owner steps, what's uncertain"],
          verify: ["How it would be checked: tests, device, measurements"],
        },
      },
    ],
  };
})();
