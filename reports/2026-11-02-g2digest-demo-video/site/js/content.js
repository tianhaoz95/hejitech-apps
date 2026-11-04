// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
const HEAD = ["Step", "Screen", "Action (target)", "Viewer notices", "Voiceover", "Hold"];
const steps = (title, rows) => ({ kind: "table", title, head: HEAD, rows });

window.REPORT = {
  key: "2026-11-02-g2digest-demo-video-v1", dir: "reports/2026-11-02-g2digest-demo-video", repo: "tianhaoz95/hejitech-apps", port: 8832,
  title: "G2 Digest walkthrough video",
  project: "projects/g2digest",
  context: [
    ".claude/skills/heji-demo-video/SKILL.md", ".claude/skills/heji-promo-video/SKILL.md",
    "projects/g2digest/CLAUDE.md", "projects/g2digest/docs/index.md", "projects/g2digest/pipeline/README.md",
    "projects/g2digest/services/web/src (brief.ts, agents.ts, consent.ts, edition.ts, pair.ts)", "projects/g2digest/packages/plugin/src/plugin.ts",
    "branding/promo-videos/src/g2digest-demo (animatic, then the edit) and src/g2digest-launch (the promo: palette, voice, shots 6 and 7)",
    "branding/promo-videos/scripts/g2digest-launch-record.mjs and g2digest-launch-demo/ (the recorder and demo brief to start from)",
    "Media folder: /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/g2digest-demo/ (main checkout only)",
  ],
  brief: "Make G2 Digest's product walkthrough video with skill heji-demo-video, including the full path from the agent to the clients. Plan agreed (owner: 'All the assets are prepared, proceed'; D1–D4 left at the recommendations). First cut rendered: g2digest-demo (2:22, 16:9, 7 chapters) and g2digest-demo-short (0:26, 9:16), from real recordings on the local stack including a real Claude Code run over OAuth/MCP; the YouTube kit is in the report. Awaiting the owner's review with sound and upload.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-demo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: edit in branding/promo-videos/src/g2digest-demo/Composition.tsx (ids g2digest-demo, g2digest-demo-short, -thumb, -short-thumb), shared pieces in src/shared/Walkthrough.tsx, media in /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/g2digest-demo/ (media.md lists it), finals in branding/promo-videos/out/final, copied into the report's media/edit and media/youtube. The local seed was restored.",
    "Re-cut: edit Composition.tsx (a narration change: scripts/g2digest-demo-vo.py --only <id>, then scripts/g2digest-demo-words.py), `npm run lint`, stills, render each id one at a time with --concurrency=2, two-pass loudnorm to -14 LUFS into out/final, `node scripts/g2digest-demo-srt.mjs out/final`, recopy into the report.",
    "Re-record: scripts/g2digest-demo-record.mjs (needs the Worker on 127.0.0.1:8790, the feeds on 8899 and the pty rig in /Volumes/DATA/Scratch/heji-video); always `restore` afterwards.",
    "When the owner sends the walkthrough's YouTube link: check oEmbed, add 'Watch the walkthrough' to projects/g2digest/docs/index.md with chapter timestamps linked from matching docs sections, and link it from the landing page under the promo (heji-promo-video §7).",
    "Open bug found during the run: projects/g2digest/packages/core/src/validate.ts:182 calls methodology.trim() on a non-string and crashes validate_cards; fix only if the owner says so.",
  ].filter(Boolean),

  blocks: {
    path: {
      kind: "flow", title: "The path the video follows", note: "Each box is a real screen or component in projects/g2digest; the five stops become the chapter bar.",
      proposed: {
        nodes: [
          { id: "brief", label: "1 · Your brief", sub: "web app /brief/", col: 0, row: 1, type: "ui" },
          { id: "agent", label: "2 · Your agent", sub: "any MCP agent + audio", col: 1, row: 1, type: "external" },
          { id: "worker", label: "3 · G2 Digest", sub: "validate → publish", col: 2, row: 1, type: "store" },
          { id: "web", label: "Web preview", sub: "/edition, /preview", col: 3, row: 0, type: "ui" },
          { id: "glasses", label: "4–5 · Glasses + R1", sub: "plugin, paired via the Even app", col: 3, row: 1, type: "ui" },
          { id: "feed", label: "Podcast feed", sub: "headphones, phone locked", col: 3, row: 2, type: "ui" },
        ],
        edges: [
          { from: "brief", to: "agent", label: "reads" },
          { from: "agent", to: "worker", label: "builds" },
          { from: "worker", to: "web", label: "" },
          { from: "worker", to: "glasses", label: "" },
          { from: "worker", to: "feed", label: "" },
        ],
      },
    },
    timeline: {
      kind: "table", title: "Timeline (2:00, YouTube chapters)",
      head: ["Time", "Chapter", "On screen", "Backdrop / bridge"],
      rows: [
        ["0:00–0:13", "Intro", "A1 opener → a real glasses card → the path drawn, shrinking into the chapter bar", "A1"],
        ["0:13–0:31", "1 · Write your brief", "rec-1-brief", "B1 evening desk"],
        ["0:31–0:49", "2 · Connect your agent", "rec-2-agents, rec-2-consent", "B2 threads"],
        ["0:49–1:13", "3 · Your agent builds the edition", "rec-3-agent (time-lapse), rec-3-edition", "promo shot 6 → B3 night city"],
        ["1:13–1:30", "4 · Pair your glasses", "rec-4-pair, rec-4-phone + rec-4-glasses side by side", "A2 night → morning → B4 table"],
        ["1:30–1:51", "5 · Read on the ride", "rec-5-ride with the edition's audio", "promo shot 7 → B5 carriage"],
        ["1:51–2:00", "Recap + end", "the five stops with their best frames; end card", "A3 platform"],
      ],
    },
    ch0: steps("Steps · intro", [
      ["0.1", "Opener", "—", "Dawn, glasses and ring on the sill", "Your brief, ready before the train.", "3 s"],
      ["0.2", "Glasses card", "fade in over A1", "What the edition looks like", "Here's the whole path, from your words to your glasses.", "3 s"],
      ["0.3", "Path diagram (drawn)", "stops light up in turn", "Brief → Agent → G2 Digest → glasses, web, podcast", "You write the brief. Your own agent builds the edition. G2 Digest checks it, and delivers it.", "6 s"],
    ] ),
    ch1: steps("Steps · 1 Write your brief", [
      ["1.1", "Your brief", "click Name field, type \"Morning brief\"", "The edition's name", "Start in the web app. Open Your brief, and give your edition a name.", "3 s"],
      ["1.2", "Delivery and language", "set Ready by 06:30", "When it must be ready", "Set Ready by to the time you leave home.", "3 s"],
      ["1.3", "Sections", "Add section: Title, Source (feed URLs), Instructions typed (2×)", "Sources + plain-language instructions", "Add section for each thing you follow, with a source and plain instructions: what counts, and what to skip.", "6 s"],
      ["1.4", "Header", "click Save brief", "\"Saved · version n. The next edition follows it.\"", "Then Save brief. Your agent reads it. It never edits it.", "3 s"],
    ] ),
    ch2: steps("Steps · 2 Connect your agent", [
      ["2.1", "Build agents", "open /agents/, zoom on \"1. Connect\"", "The MCP server URL", "Next, Build agents. Any agent that speaks MCP and can make audio will do.", "4 s"],
      ["2.2", "Agent (terminal)", "add the server; the agent opens the consent page", "The agent asking to connect", "Point it at the server, and it asks to connect.", "3 s"],
      ["2.3", "Consent", "zoom on the two bullet points, click Allow", "Read the brief; upload audio and publish. Can't change your brief.", "You see exactly what it may do. Click Allow.", "4 s"],
      ["2.4", "Build agents", "Copy on \"2. The prompt\"; zoom on \"3. Schedule it\"", "One prompt, any scheduler", "Copy the one prompt it runs, and schedule it an hour before your train.", "4 s"],
    ] ),
    ch3: steps("Steps · 3 Your agent builds the edition", [
      ["3.1", "Terminal", "the prompt runs; get_card_authoring_guide, get_user_brief", "The agent fetches the rules and the brief live", "Here's a real run. The agent fetches the card guide and your brief.", "4 s"],
      ["3.2", "Terminal (time-lapse, badge)", "reads the feeds, writes the edition and cards", "Research and writing, real speed shown", "It reads every source, then writes the full edition and the cards.", "4 s"],
      ["3.3", "Terminal (time-lapse)", "makes audio; create_audio_upload ×n", "Audio made by the agent", "It records the audio itself, and uploads it.", "3 s"],
      ["3.4", "Terminal", "validate_cards → errors, if any → 0 errors", "The validator gate", "Then the validator checks every card. Nothing publishes until there are no errors.", "5 s"],
      ["3.5", "Terminal → edition page", "publish_cards; open /edition/<date>, step the G2 preview (Swipe up)", "Every card with its sources; the glasses preview", "Published. Open the edition: every card with its sources, and a preview of the glasses.", "6 s"],
    ] ),
    ch4: steps("Steps · 4 Pair your glasses", [
      ["4.1", "Pair", "open /pair/, zoom on the code", "6 digits, a countdown, works once", "On Pair, get a six-digit code.", "3 s"],
      ["4.2", "Phone page (Even app)", "type the code, Pair", "Typed once on the phone", "Open G2 Digest in the Even app, and type it in. You pair once.", "4 s"],
      ["4.3", "Glasses", "tour → list of editions", "The glasses now have your editions", "The glasses leave the tour, and show your editions.", "4 s"],
      ["4.4", "Pair · Podcast feed", "click Make a feed link", "A private feed URL (blurred)", "No glasses today? Make a feed link for your podcast app.", "4 s"],
    ] ),
    ch5: steps("Steps · 5 Read on the ride", [
      ["5.1", "Glasses list", "select today, tap", "Opens at the first card", "On the train, pick today's edition. It opens at the first card.", "4 s"],
      ["5.2", "Card", "Swipe up ×2", "The dots move down", "Swipe up on the ring for the next card. The dots show where you are.", "5 s"],
      ["5.3", "Card", "Tap; then Tap, then hold", "Glance playing; DEEP DIVE playing (its audio under it)", "Tap to hear the glance. Tap, then hold, for the deep dive.", "6 s"],
      ["5.4", "Card → list", "Double tap", "Back to the list; offline badge", "Double tap to go back. It's already on your phone, so it plays offline.", "4 s"],
    ]),
    short: {
      kind: "table", title: "The short (9:16)",
      head: ["Time", "On screen", "Voiceover"],
      rows: [
        ["0:00–0:03", "A real glasses card, big, over B5; title \"Built overnight by your agent\"", "Your agent builds tomorrow's brief tonight."],
        ["0:03–0:16", "rec-3-agent, phone-height crop, time-lapse badge; zoom on each tool call", "It reads your sources, writes the cards, records the audio, and passes the validator."],
        ["0:16–0:19", "publish_cards → A2 night to morning", "Then it publishes."],
        ["0:19–0:36", "rec-5-ride, glasses full width: list, card, Swipe up, Tap then hold", "In the morning, it's on your glasses. Swipe the ring to skim. Tap, then hold, for the deep dive."],
        ["0:36–0:41", "End card (9:16)", "G2 Digest. Your brief, ready before the train."],
      ],
    },
  },
};
