// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-11-01-g2digest-promo-video-v1", dir: "reports/2026-11-01-g2digest-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8830,
  title: "G2 Digest promo video kit (Google Flow)",
  project: "projects/g2digest",
  context: [
    "projects/g2digest/CLAUDE.md", "projects/g2digest/docs/index.md", "projects/g2digest/docs/decisions.md", ".claude/skills/heji-promo-video/SKILL.md",
    "reports/2026-11-01-g2digest-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/g2digest-launch (animatic, then the edit)",
    "branding/promo-videos/src/headway-launch (the closest worked example: glasses recordings from the Even Hub simulator, two Flow characters)",
  ],
  brief: "First cut rendered for review. Make G2 Digest's promo video (skill heji-promo-video): a 30 s main cut plus 15 s cuts in 16:9 and 9:16. Draft 1 of the plan: a metro comedy in the style of the Headway and FitLoop promos (photoreal, expressive lead who plays to the camera, a comic foil), set underground where nothing loads, which is the product's own promise. The owner makes the characters, shots and music in Google Flow; the agent makes the recordings, voiceover and edit.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: the first cut is rendered (g2digest-launch-30 / -15 / -15-vertical in branding/promo-videos, normalised into out/final and copied to the report's media/edit), with the YouTube kit (media/youtube: SRTs, thumbnails). Music: music-15s-take1 re-cut on its bars (bed() in Composition.tsx). Voice: am_echo. Recordings were made on the local stack with the demo edition (scripts/g2digest-launch-demo) and the seed was restored.",
    "Apply the reader's notes: re-cut in src/g2digest-launch/Composition.tsx, `npm run lint`, render each id one at a time with --concurrency=2, two-pass loudnorm to -14 LUFS into out/final, `node scripts/g2digest-launch-srt.mjs out/final`, recopy the MP4s, posters, SRTs and thumbnails into the report.",
    "When the owner sends the 30 s YouTube link: check oEmbed, then add the click-to-play embed to G2 Digest's landing page and a 'See it in 30 seconds' section in projects/g2digest/docs/index.md (heji-promo-video §7); record the id in src/g2digest-launch/media.md.",
    "Claims must stay true to projects/g2digest (docs/index.md): the user's own agent builds the edition ahead of time; the plugin only plays it, offline if it has to; no assistant brand, no real topics on screen; 'Demo data' on the recordings and end card.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "One voiceover line per beat; the Flow shots carry the comedy, the recordings show the product.",
      steps: [
        { actor: "Nothing loads", text: "0:00 The train dives into the tunnel; every phone in the carriage stalls; Sam, in his glasses and earbuds, keeps reading. (shot 1)" },
        { actor: "Not his", text: "0:04 Bea, phone to the ceiling: \"Is anyone's news loading?\" Sam, deadpan to camera: \"Mine was ready last night.\" (shot 2)" },
        { actor: "G2 Digest", text: "0:07 He glances up; today's edition opens at its first card. (shot 3 → glasses: list → first card)" },
        { actor: "Skim", text: "0:12 His thumb swipes the ring: card to card, the dots move. (shot 4 → glasses: swipe)" },
        { actor: "Listen", text: "0:16 A hold on the ring: the deep dive plays in his earbuds; Bea presses her phone to the window. (shot 5 → glasses: deep dive)" },
        { actor: "Overnight", text: "0:20 The night before: he writes his brief, closes the laptop; his agent does the rest. (shot 6 → loop graphic → web: the edition)" },
        { actor: "Payoff", text: "0:25 Out into daylight, every phone buzzes; Bea: \"It loaded! Oh, this is my stop.\" Sam nods, steps off. End card. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (1.5–3 s of it used). Recording = the real app, made by the agent.",
      head: ["Time", "Flow shot", "Then", "Voiceover"],
      rows: [
        ["0:00–0:04", "1 · into the tunnel, every phone stalls", "—", "Underground, nothing loads."],
        ["0:04–0:07", "2 · Bea asks, Sam deadpan", "—", "Bea: Is anyone's news loading? · Sam: Mine was ready last night."],
        ["0:07–0:12", "3 · the glance (1.5 s)", "rec-glasses-open, over his view", "Overnight, my own AI agent turns my brief into cards for my glasses."],
        ["0:12–0:16", "4 · thumb swipes the ring (1.5 s)", "rec-glasses-swipe", "Swipe the ring to skim. One card, one glance."],
        ["0:16–0:20", "5 · hold, earbud, listening; Bea at the window (2 s)", "rec-glasses-deepdive", "Want more? Hold the ring, and the deep dive plays in my headphones."],
        ["0:20–0:25", "6 · the night before, laptop lid to camera (2 s)", "loop graphic → rec-web-edition", "I write the brief. My agent researches, writes, and checks every card."],
        ["0:25–0:30", "7 · out into daylight; Bea's stop", "end card over it", "Bea: It loaded! Oh, this is my stop. · G2 Digest. Your brief, ready before the train."],
      ],
    },
  },
};
