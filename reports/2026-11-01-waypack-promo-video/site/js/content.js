// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-11-01-waypack-promo-video-v1", dir: "reports/2026-11-01-waypack-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8831,
  title: "Waypack promo video kit (Google Flow)",
  project: "projects/waypack",
  context: [
    "projects/waypack/CLAUDE.md", "projects/waypack/site/index.html (the consumer pitch)", "projects/waypack/docs/store-listing.md",
    "projects/waypack/docs/DECISIONS.md (#25 no purchase UI in apps, #54/#55 offline maps are Pro)", ".claude/skills/heji-promo-video/SKILL.md",
    "reports/2026-11-01-waypack-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/waypack-launch (the edit) and its media.md",
    "branding/promo-videos/src/headway-launch and tradeboard-launch (worked examples: iPhone recordings, web recordings, two Flow characters)",
  ],
  brief: "Make Waypack's promo video (skill heji-promo-video): a 30 s main cut plus 15 s cuts in 16:9 and 9:16, now rendered for review. The plan: a winter mountain road-trip comedy in the style of the Headway, FitLoop and G2 Digest promos (photoreal, expressive lead who plays to the camera, a comic foil), set where there's no signal, which is the product's own world (its example trip is a snowy Sequoia weekend with a toddler). The owner makes the characters, shots and music in Google Flow; the agent makes the recordings, voiceover and edit.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: the edit is rendered (branding/promo-videos/src/waypack-launch; finals in out/final and the report's media/edit, not in git). Every file and how it was made: branding/promo-videos/src/waypack-launch/media.md. Renders need Playwright's headless shell (--browser-executable), see media.md.",
    "Apply the reader's notes on the cuts (music take, narration voice: af_heart now, af_sarah is closest in pitch; timing), re-render one at a time with --concurrency=2, run the two-pass loudness step, copy finals and posters into site/media/edit and update §1.",
    "After any re-cut: node scripts/waypack-launch-srt.mjs out/final and recopy the SRTs and thumbnails into site/media/youtube.",
    "When the owner sends the 30 s YouTube link: check oEmbed, then embed it on Waypack's home page (projects/waypack/site, click-to-play poster, youtube-nocookie, CSP frame-src) and projects/waypack/docs/index.md ('See it in 30 seconds'); record the id in media.md.",
    "Recordings were made on the local stack only (scripts/waypack-launch-record.mjs <sim-udid> phone|web, seed-dev.mjs promo@waypack.test); never production.",
    "Claims must stay true to projects/waypack: any MCP agent plans and publishes; the app downloads while there's signal and works offline; offline maps are Pro (say so, but show no price or purchase: the apps are free viewers, #25); no assistant brand on screen; 'Example trip' tag on recordings; end card says to check road and park conditions.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "One voiceover line per beat; the Flow shots carry the comedy, the recordings show the product.",
      steps: [
        { actor: "No signal", text: "0:00 A snowy mountain pullout; Gus wades in circles holding his phone to the sky; Rosa, toddler on her hip, watches. (shot 1)" },
        { actor: "Not her", text: "0:04 Gus, on a snowbank: \"Does anyone have a single bar?\" Rosa, deadpan to camera: \"Don't need one.\" (shot 2)" },
        { actor: "Waypack", text: "0:07 A glance at her phone: Today, now and next. (shot 3 → iPhone: Today)" },
        { actor: "The map", text: "0:12 On the snowy road, phone in the mount: the offline map, the route, their GPS dot. (shot 4 → iPhone: map)" },
        { actor: "The details", text: "0:16 The cabin at dusk: she opens the lockbox from the check-in details; Gus tries the porch light, falls in a drift. (shot 5 → iPhone: plan, lodging, backup)" },
        { actor: "Weeks before", text: "0:20 At home: she asked her agent, watched the trip fill in, tapped Download on the Wi-Fi. (shot 6 → web: live preview → map graphic → iPhone: Download)" },
        { actor: "Payoff", text: "0:25 The sledding hill: Rosa and Pip fly past; Gus, phone away: \"Okay. Where's the sledding hill?\" End card. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (1.5–3 s of it used). Recording = the real app, made by the agent.",
      head: ["Time", "Flow shot", "Then", "Voiceover"],
      rows: [
        ["0:00–0:04", "1 · snowy pullout, Gus hunting for a bar", "—", "Up in the mountains, there's no signal."],
        ["0:04–0:07", "2 · Gus asks, Rosa deadpan", "—", "Gus: Does anyone have a single bar? · Rosa: Don't need one."],
        ["0:07–0:12", "3 · the glance at her phone (1.5 s)", "rec-phone-today, phone frame", "My AI agent planned this trip. Waypack keeps it working offline."],
        ["0:12–0:16", "4 · snowy road, phone in the mount (1.5 s)", "rec-phone-map", "What's next, the map, my GPS dot. Zero bars."],
        ["0:16–0:20", "5 · cabin lockbox; Gus in the drift (2 s)", "rec-phone-plan", "Lodging, check-in times, and a backup plan if the road closes."],
        ["0:20–0:25", "6 · at home weeks before, laptop lid to camera (2 s)", "rec-web-preview → map graphic → rec-phone-download", "I planned it with my agent at home, and tapped Download on the Wi-Fi."],
        ["0:25–0:30", "7 · sledding hill; Gus gives up", "end card over it", "Gus: Okay. Where's the sledding hill? · Waypack. Your trip, packed."],
      ],
    },
  },
};
