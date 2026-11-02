// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-10-30-headway-promo-video-v1", dir: "reports/2026-10-30-headway-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8824,
  title: "Headway promo video kit (Google Flow)",
  project: "projects/headway",
  context: [
    "projects/headway/CLAUDE.md", "projects/headway/docs/index.md", ".claude/skills/heji-promo-video/SKILL.md",
    "reports/2026-10-30-headway-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/headway-launch (the edit)", "branding/promo-videos/src/tradeboard-launch (the worked example)",
  ],
  brief: "Plan a promotional video for Headway (skill heji-promo-video). The characters should be in a similar style to the owner's reference screenshot, which sets only the character look and the movie style (a photoreal, expressive lead with a loose messy bun who plays to the camera, warm golden cinematic light), not the story. Draft 1 (an ancient cook time-slipping to a platform) was rejected as too weak; the owner asked for something modern and city-centric, and the storyline should be funny.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "Apply the reader's notes on the story, character and prompts, and update index.html so the kit stays the record.",
    "State: the edit is rendered (branding/promo-videos/src/headway-launch, renders in out/final and the report's media/edit). Media and every file's source: branding/promo-videos/src/headway-launch/media.md. Recordings: branding/promo-videos/scripts/headway-launch-record.mjs (local stack only). Narration: scripts/headway-launch-vo.py (af_heart).",
    "Apply the reader's notes on the cuts (music take, narration voice, timing), re-render with the loudness pass, copy the finals and posters into the report's site/media/edit and update §1.",
    "The YouTube section (§8) is ready: per-cut titles, descriptions, thumbnails (site/media/youtube) and SRTs from branding/promo-videos/scripts/headway-launch-srt.mjs; re-run it and recopy after any re-cut. The 30 s is on YouTube (d9hUqGc19XQ) and embedded on Headway's home page (services/web/src/promo.ts) and docs/index.md; the Short is up too (youtube.com/shorts/sNthvYTJfxs, not embedded anywhere); the 15 s is the owner's to upload.",
    "Claims must stay true to projects/headway (docs/index.md); no Caltrain logos or livery; keep 'Not affiliated with Caltrain' on the end card.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "One voiceover line per beat; the Flow shots carry the comedy, the recordings show the product.",
      steps: [
        { actor: "The city runs", text: "0:00 A Bay Area morning stampede for the train; Max sprints with toast in his mouth; Lin, in her glasses, strolls through it with her coffee. (shot 1)" },
        { actor: "Not her", text: "0:04 The doors close in Max's face. Lin, beside him, gives the camera a deadpan look: \"Me? I don't run.\" (shot 2)" },
        { actor: "Headway", text: "0:07 Everyone stares at phones; she just glances up, and through her glasses her next train and its live status glow green. (shot 3 → glasses recording)" },
        { actor: "The ring", text: "0:13 One swipe of the ring and every train after it. (shot 4 → glasses swipe recording)" },
        { actor: "The tap", text: "0:17 Croissant at a café counter; her phone taps her; she strolls out, no hurry. (shot 5 → iPhone time-to-leave recording)" },
        { actor: "Her stop", text: "0:21 On the train, a tap before her stop; she stands; Max sleeps across the aisle. (shot 6 → iPhone stop recording)" },
        { actor: "Payoff", text: "0:25 She steps off; Max wakes, pressed to the window as the train carries him past his stop. She waves her croissant and winks. End card. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (1.5–3 s of it used). Recording = the real app (§5), made by the agent.",
      head: ["Time", "Flow shot", "Then the recording", "Voiceover"],
      rows: [
        ["0:00–0:04", "1 · the city runs, Lin strolls", "—", "Every morning, this whole city runs for the train."],
        ["0:04–0:07", "2 · doors close on Max, her deadpan", "—", "Me? I don't run."],
        ["0:07–0:13", "3 · she glances, others scroll (1.5 s)", "rec-glasses-board, over her view", "I wear Headway. My next Caltrain, live, right before my eyes."],
        ["0:13–0:17", "4 · thumb on the ring (1.5 s)", "rec-glasses-swipe", "One swipe of my ring, and I see every train after it."],
        ["0:17–0:21", "5 · café, phone taps, strolls out (2 s)", "rec-phone-leave, phone frame", "Late? Cancelled? Time to go? My phone taps me first."],
        ["0:21–0:25", "6 · train, tap before her stop; Max asleep (2 s)", "rec-phone-stop, phone frame", "It even taps me before my stop. Bye, Max."],
        ["0:25–0:30", "7 · she steps off, Max carried away, wink", "end card over it", "Headway. Your next Caltrain, at a glance."],
      ],
    },
  },
};
