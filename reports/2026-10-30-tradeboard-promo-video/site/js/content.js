// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-10-30-tradeboard-promo-video-v1", dir: "reports/2026-10-30-tradeboard-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8823,
  title: "Trading Plan Board promo video kit (Google Flow)",
  project: "projects/tradeboard",
  context: ["projects/tradeboard/CLAUDE.md", "projects/tradeboard/README.md", "projects/tradeboard/docs/index.md", "reports/2026-10-30-tradeboard-promo-video/site/index.html", "branding/README.md", "branding/promo-videos/src/tradeboard-launch", "branding/promo-videos/scripts/tradeboard-launch-record.mjs"],
  brief: "Give me sufficient information (reference images, screenshots, story text, prompts, etc.) with copy and download buttons to help me create a promotional video for the Trading Plan Board using Google Flow. v2, after the first cut: faster (30 s + 15 s), no green screens (Flow shots hide the screen; the product is shown in real screen recordings made by the agent), and voiceover (AI Studio) and music (Flow Music) prompts the owner runs; clearly mark what to regenerate and what can still be used.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and branding/README.md.`,
    ticks.total ? `${ticks.done} of ${ticks.total} steps are done.` : "",
    "Build or revise the edit in branding/promo-videos/src/tradeboard-launch (skill heji-remotion): 30 s 16:9, 15 s 16:9 and 9:16, cut to the voiceover and the music's beats, following the 30 s storyboard in §4. Media is in branding/promo-videos/public/tradeboard-launch (git-ignored); list new files in media.md.",
    "Act on the reader's notes: rewrite prompts for takes that didn't work and update index.html so the kit stays the record.",
    "Claims in the voiceover and descriptions must stay true to projects/tradeboard (README, docs/index.md); never promise returns, keep the disclaimer.",
    "New recordings: start the local stack (supabase start + npm run dev:worker -w @tradeboard/web) and run node branding/promo-videos/scripts/tradeboard-launch-record.mjs; never against production, never a live order.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "One line of voiceover per beat; each beat is a Flow shot handing over to a real recording.",
      steps: [
        { actor: "Problem", text: "0:00 A rushed trade late at night: a hunch, a tap. (Flow, shot 1)" },
        { actor: "Board", text: "0:03 The idea becomes a dated plan. (shot 2 → board recording)" },
        { actor: "Agents", text: "0:07 Claude, Gemini and other agents argue it out; dissent stays on the record. (shot 3 → debate recording)" },
        { actor: "You", text: "0:12 Only you approve, from your phone. (shot 4 → phone approve recording)" },
        { actor: "Executor", text: "0:17 Your machine checks your limits and the live price; a dry-run receipt. (shot 5 → receipt recording)" },
        { actor: "Fail closed", text: "0:22 Any doubt, no order: refused, with the reason. (shot 6 → fail-closed recording)" },
        { actor: "End card", text: "0:25 Agents debate the trade. You approve it. Your machine places it. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (first 1.5–3 s used). Recording = the real portal (§5). Status: keep the existing take, or regenerate it with the v2 prompt.",
      head: ["Time", "Flow shot", "Status", "Then the recording", "Caption"],
      rows: [
        ["0:00–0:03", "1 · kitchen, hesitating thumb", "Keep", "—", "Most bad trades happen in a hurry."],
        ["0:03–0:07", "2 · laptop, lid to camera (1.5 s)", "Regenerate", "rec-board (2.5 s)", "Every idea becomes a dated plan."],
        ["0:07–0:12", "3 · spheres debate (1.5 s)", "Keep", "rec-debate (3.5 s)", "Your AI agents argue it out."],
        ["0:12–0:17", "4 · back of the phone, tap (1.5 s)", "Regenerate", "rec-approve, phone (3.5 s)", "Only you approve."],
        ["0:17–0:22", "5 · machine on a shelf (1.5 s)", "Keep", "rec-receipt (3.5 s)", "Your machine checks every order."],
        ["0:22–0:25", "6 · lights, the last stays amber (1.5 s)", "Keep", "rec-failclosed (1.5 s)", "Any doubt, no order."],
        ["0:25–0:30", "7 · animated end card", "Keep", "—", "Tagline + disclaimer"],
      ],
    },
  },
};
