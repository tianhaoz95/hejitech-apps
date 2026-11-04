// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
const HEAD = ["Step", "Screen", "Action (target)", "Viewer notices", "Voiceover", "Hold"];
const steps = (title, rows) => ({ kind: "table", title, head: HEAD, rows });

window.REPORT = {
  key: "2026-11-02-headway-demo-video-v1",
  dir: "reports/2026-11-02-headway-demo-video",
  repo: "tianhaoz95/hejitech-apps",
  port: 8833,
  title: "Headway walkthrough video",
  project: "projects/headway",
  context: [
    ".claude/skills/heji-demo-video/SKILL.md",
    ".claude/skills/heji-promo-video/SKILL.md",
    "projects/headway/CLAUDE.md",
    "projects/headway/docs/index.md",
    "projects/headway/docs/decisions.md",
    "projects/headway/packages/core/src (schedule.ts, alerts.ts, glasses.ts, time.ts)",
    "projects/headway/apps/glasses/src (app.ts, main.ts)",
    "projects/headway/apps/ios (HeadwayKit, App, Watch, Live Activities)",
    "branding/promo-videos/src/headway-demo (animatic, edit) and src/headway-launch (promo: palette, voice af_heart, character Lin)",
    "branding/promo-videos/scripts/headway-demo-record.mjs (recorder with event logs)",
    "Media folder: /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/headway-demo/ (main checkout only)",
  ],
  brief: "Make Headway's product walkthrough video with skill heji-demo-video. Covers Caltrain live departures, exact leave-by countdowns, Even G2 glasses HUD with R1 ring gestures, express overtaking intelligence, and active trip tracking with Lock Screen Live Activities, Apple Watch glance, and private ETA sharing. Animatic and voiceover lines generated with Kokoro-82M; awaiting owner review, Flow art and screen recordings.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-demo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: animatic in branding/promo-videos/src/headway-demo/Composition.tsx (ids headway-demo, headway-demo-short, headway-demo-thumb), voiceover audio generated with Kokoro-82M (af_heart) and transcribed with faster-whisper into voiceover.ts. Media tracked in branding/promo-videos/src/headway-demo/media.md.",
    "Recordings: run scripts/headway-demo-record.mjs (stage, glasses, phone) on the local stack (supabase start + worker on 127.0.0.1:8792). Always run restore afterwards.",
    "Flow art: download 7 prompts (A1 opener, B1-B4 chapter backdrops, A2 bridge, A3 end card) into /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/headway-demo/.",
    "Music: generate 115s warm tech-acoustic track in Flow Music and place into public/headway-demo/.",
    "Render & upload: npx remotion render headway-demo out/headway-demo.mp4 --concurrency=2, two-pass loudnorm to -14 LUFS, node scripts/headway-demo-srt.mjs out/final, and upload to YouTube with §YouTube kit.",
    "When uploaded: embed on projects/headway/docs/index.md and link from landing page.",
  ].filter(Boolean),

  blocks: {
    path: {
      kind: "flow",
      title: "The core journey in the walkthrough",
      note: "Each box corresponds to real capabilities in @headway/core and the native client apps.",
      proposed: {
        nodes: [
          { id: "commute", label: "1 · Commute Setup", sub: "SF ↔ Palo Alto + walk buffer", col: 0, row: 1, type: "ui" },
          { id: "leaveby", label: "Leave-by Countdowns", sub: "CatchCard exact walk timer", col: 1, row: 0, type: "ui" },
          { id: "glasses", label: "2 · Even G2 Glasses", sub: "9-line green HUD + R1 ring", col: 1, row: 1, type: "ui" },
          { id: "overtake", label: "3 · Express Overtake", sub: "InsightBanner: take 511 instead", col: 2, row: 1, type: "store" },
          { id: "track", label: "4 · Live Tracking", sub: "Dynamic Island + ActivityKit", col: 3, row: 0, type: "ui" },
          { id: "watch", label: "Apple Watch & Share", sub: "Wrist glance + /eta/:token", col: 3, row: 1, type: "ui" },
        ],
        edges: [
          { from: "commute", to: "leaveby", label: "calculates" },
          { from: "commute", to: "glasses", label: "syncs" },
          { from: "glasses", to: "overtake", label: "advises" },
          { from: "overtake", to: "track", label: "one swipe" },
          { from: "track", to: "watch", label: "realtime" },
        ],
      },
    },
    timeline: {
      kind: "table",
      title: "YouTube Chapters & Timeline (1:57 total runtime)",
      head: ["Time", "Chapter", "On screen", "Backdrop / Mood"],
      rows: [
        ["0:00–0:10", "Intro", "A1 opener → Platform rush vs calm glance → Headway overview", "A1 platform at dusk"],
        ["0:10–0:33", "1 · Commute & leave-by times", "iPhone Commute tab setup → Trains live board → CatchCard leave-by countdown ring", "B1 morning oak desk & coffee"],
        ["0:33–0:58", "2 · Even G2 glasses & R1 ring", "iPhone 6-digit pair code → Even G2 HUD board → R1 swipe down → tap flip → hold menu", "B2 slate & emerald HUD neon"],
        ["0:58–1:21", "3 · Wait for the Express", "Local 113 delayed (+14m) → Express 511 overtake advice banner → HUD footer tip → push alert", "B3 rail tracks night timelapse"],
        ["1:21–1:46", "4 · Track ride & Share ETA", "Swipe to track 511 → Live Activity & Dynamic Island → Apple Watch glance → Share ETA link → arrival tap", "B4 train window reflections"],
        ["1:46–1:57", "Recap + end card", "4-beat montage (CatchCard, Glasses HUD, Overtake advice, Live Activity) → End card with icon", "A3 terminal morning light"],
      ],
    },
    ch0: steps("Steps · Intro", [
      ["0.1", "Platform", "Wide platform shot", "Crowd rushing for evening Caltrain train", "Every commuter knows the sprint for Caltrain.", "3.2 s"],
      ["0.2", "Overview", "Headway title reveal", "Features summary: departures, leave-by times, glasses HUD, live alerts", "Here is how Headway puts your exact departures, leave-by times, and live alerts on your wrist and your glasses.", "7.0 s"],
    ]),
    ch1: steps("Steps · 1 Commute & leave-by times", [
      ["1.1", "Commute tab", "Open Commute tab on phone", "Morning: San Francisco → Palo Alto; Evening: Palo Alto → San Francisco; walk buffer: 6m", "Open Headway on your phone, and save your morning and evening commute stations.", "4.8 s"],
      ["1.2", "Trains tab", "Tap Trains tab", "Live departures list with real-time delays (+4m, on time)", "The Trains tab instantly loads live departures with real-time delays.", "4.7 s"],
      ["1.3", "CatchCard", "Zoom on CatchCard countdown ring", "Leave in 12m ring counting down; factoring in walk buffer", "Instead of doing platform mental math, the Catch card counts down to the exact minute you must walk out your door.", "6.8 s"],
      ["1.4", "Catch state", "Status badge highlight", "Green on-time indicator, or pulsing orange RUN alert when close", "Green means you are on time; if you need to hustle, it warns you to run.", "4.5 s"],
    ]),
    ch2: steps("Steps · 2 Even G2 glasses & R1 ring", [
      ["2.1", "Glasses tab", "Tap Generate pairing code", "Displays six-digit pairing code (e.g. 842 195)", "To take it hands-free, generate a six-digit pairing code in the Glasses tab.", "4.8 s"],
      ["2.2", "Glasses HUD", "Even G2 display lights up", "Crisp 9-line green board: 618 ok, 620 +4m, leave countdown", "Type it into your Even app once. Now your commute board floats right before your eyes.", "5.0 s"],
      ["2.3", "R1 Swipe", "Swipe down gesture indicator", "Selection moves to next train on the HUD", "Swipe down on your R1 smart ring to browse the next trains.", "3.8 s"],
      ["2.4", "R1 Tap", "Tap gesture indicator", "Direction flips instantly: Palo Alto → San Francisco", "Tap the ring to flip directions instantly when you are ready to head back.", "4.5 s"],
      ["2.5", "R1 Hold", "Hold gesture indicator", "Action menu pops up: Track, Any Station, Alerts", "Hold the ring to open the quick menu and track your train without reaching into your pocket.", "5.3 s"],
    ]),
    ch3: steps("Steps · 3 Wait for the Express", [
      ["3.1", "Trains board", "Local 113 delayed by 14m", "Departs 8:15 (+14m); Express 511 departs 8:22", "When delays stack up, the next train out is not always the first one home.", "4.6 s"],
      ["3.2", "InsightBanner", "Banner lights up above board", "Insight: Wait for 511: beats 113 by 4 min", "Headway compares transit times across all trains and flags the overtake: wait for the 511 Express.", "6.9 s"],
      ["3.3", "Glasses HUD", "Footer tip updates on HUD", "HUD footer displays 'Wait for 511: beats 113 by 4m'", "The advice appears right on your glasses HUD, saving you four minutes.", "4.8 s"],
      ["3.4", "Push alert", "Time-sensitive APNs banner", "'Take 511 instead: arrives 4m earlier than 113'", "And a time-sensitive alert notifies you before you step onto the slower train.", "5.2 s"],
    ]),
    ch4: steps("Steps · 4 Track ride & Share ETA", [
      ["4.1", "Trains tab", "Swipe right on Train 511", "Track action activates; tracking badge turns active", "Swipe right on your train to track your ride.", "2.8 s"],
      ["4.2", "Lock Screen", "Dynamic Island & Live Activity", "Live progress bar through stations, current speed, countdown to Palo Alto", "Your Lock Screen and Dynamic Island update in real time with every passing station.", "5.6 s"],
      ["4.3", "Apple Watch", "Watch face complication & app", "Wrist glance showing departure countdown and ride progress", "Glance at your Apple Watch for a quick countdown on the platform.", "3.8 s"],
      ["4.4", "Share ETA", "Tap Share ETA button", "Share sheet opens; mobile web preview of /eta/:token link with 30s live polling", "Tap Share ETA to send friends a private live map link that requires no login.", "5.7 s"],
      ["4.5", "Arrival notification", "Lock Screen haptic banner", "'Palo Alto in 5 min — time to gather your things'", "As you roll in, a gentle five-minute arrival tap reminds you to gather your things.", "5.6 s"],
    ]),
    ch5: steps("Steps · Recap + end", [
      ["5.1", "Montage", "4-panel quick recap", "CatchCard countdown • Glasses HUD • Overtake advice • Live Activity", "Never guess. Never sprint. Caltrain on your schedule.", "3.8 s"],
      ["5.2", "End card", "App icon & links", "Headway icon, 'Your next Caltrain, at a glance', TestFlight & Even Hub links", "Headway. Your next Caltrain, at a glance.", "2.9 s"],
    ]),
    short: {
      kind: "table",
      title: "The Short (9:16, 26 seconds)",
      head: ["Beat", "Visual focus", "Voiceover line", "Duration"],
      rows: [
        ["1", "Crowd sprinting on platform", "Still sprinting for Caltrain? Here is how to commute smarter.", "3.9 s"],
        ["2", "Leave-by countdown ring", "Headway gives you an exact leave-by countdown with your walking buffer.", "4.4 s"],
        ["3", "InsightBanner overtake advice", "When a local train is delayed, it tells you to wait for the Express that beats it.", "4.8 s"],
        ["4", "Live Activity & Watch arrival tap", "Swipe to track for live Lock Screen progress, and a five-minute arrival tap.", "4.8 s"],
        ["5", "End card with logo & badges", "Headway. Your next Caltrain, at a glance.", "2.9 s"],
      ],
    },
  },
};
