// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
const HEAD = ["Line", "Recording", "On screen", "Voiceover", "Length"];
const steps = (title, rows) => ({ kind: "table", title, head: HEAD, rows });

window.REPORT = {
  key: "2026-11-02-headway-demo-video-v2",
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
  brief: "Headway walkthrough video (skill heji-demo-video), finished 2026-11-08: 1:58 16:9 + 22 s Short, real recordings on the local stack at a Monday-morning demo clock (PUT /api/dev/clock), iPhone app driven by XCUITest, Even G2 plugin in the simulator. Three fixes found while recording (ETA links 404 in production; Share live ETA stopped tracking; Live Activity reuse) are in the working tree, unreleased.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-demo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: rendered. Edit in branding/promo-videos/src/headway-demo/Composition.tsx; finals in branding/promo-videos/out/final/; media list in src/headway-demo/media.md.",
    "Re-record with scripts/headway-demo-record.mjs <scene> on the local stack: each scene sets the Worker's demo clock (PUT /api/dev/clock) itself; run notifications once per simulator; restore afterwards.",
    "Fixes from recording, uncommitted: wrangler.jsonc run_worker_first + /eta/* (production ETA links 404), BoardView borderless buttons, LiveActivityManager (active-only reuse, push-less fallback), the demo clock (worker/clock.ts, app Clock.offset, plugin).",
    "When the owner sends the YouTube link: embed it in projects/headway/docs/index.md and link it from the landing page's How it works.",
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
    ch0: steps("Steps", [
      ["c0-1", "Flow opener", "Headway title over the platform", "Every Caltrain rider knows the question: is my train on time, and when do I really have to leave?", "6.1 s"],
      ["c0-2", "Phone + glasses stills", "The real board and the real HUD", "Headway answers it on your phone, your watch and your Even G2 glasses, from Caltrain's live feed.", "6.3 s"],
    ]),
    ch1: steps("Steps", [
      ["c1-1", "rec-1-commute", "Commute tab: stations, walk", "Set your commute once: where you get on, where you get off, and how long your walk to the station takes.", "5.7 s"],
      ["c1-2", "rec-1-board", "Trains: the live board", "The Trains tab shows your next trains, with live delays.", "3.7 s"],
      ["c1-3", "rec-1-board", "Catch card: Leave in 8m", "The Catch card counts down to when you have to leave, walk included.", "4.0 s"],
    ]),
    ch2: steps("Steps", [
      ["c2-1", "rec-2-pair", "Glasses tab → Get a pairing code", "To see it on your glasses, get a pairing code in the Glasses tab, and type it into the Even app, once.", "6.3 s"],
      ["c2-2", "rec-2-glasses", "The board on G2", "Now your commute is right in front of you: the next trains, delays, and when to leave.", "5.0 s"],
      ["c2-3", "rec-2-glasses", "Swipe: next trains", "Swipe on the R1 ring to move through the trains.", "3.1 s"],
      ["c2-4", "rec-2-glasses", "Tap: flip direction", "Tap to flip the direction, for the ride home.", "2.9 s"],
      ["c2-5", "rec-2-glasses", "Hold: the menu", "Hold for the menu: track a train, pick stations, or read alerts.", "4.3 s"],
    ]),
    ch3: steps("Steps", [
      ["c3-1", "rec-3-board", "113 is 10 min late", "When delays stack up, the next train out is not always the first one home.", "4.5 s"],
      ["c3-2", "rec-3-board", "Wait for 511 Express", "Headway spots it, and tells you to wait for the 511 Express.", "4.2 s"],
      ["c3-3", "rec-3-hud", "Footer: Wait for 511 (EXP)", "Your glasses show the same advice,", "2.4 s"],
      ["c3-4", "rec-3-push", "Time-sensitive alert", "and a time-sensitive alert reaches you, before you board the slow one.", "4.2 s"],
    ]),
    ch4: steps("Steps", [
      ["c4-1", "rec-4-track", "Swipe 511 → Track", "Swipe a train and tap Track.", "2.0 s"],
      ["c4-2", "rec-4-track", "Tracking; Share live ETA", "Share live ETA sends a private link, so whoever is waiting knows when you will arrive.", "5.5 s"],
      ["c4-3", "rec-4-eta", "The shared page", "They see your train and its arrival time, with no app and no sign in.", "4.6 s"],
      ["c4-4", "rec-4-track", "Dynamic Island, Lock Screen", "Your ride follows you to the Dynamic Island and the Lock Screen.", "4.1 s"],
      ["c4-5", "rec-4-arrival", "San Francisco in 5 min", "And five minutes out, a tap tells you it is time to get ready.", "3.8 s"],
    ]),
    ch5: steps("Steps", [
      ["c5-1", "Recap", "One still per chapter", "Know when to leave, see it at a glance, and skip the slow train.", "3.8 s"],
      ["c5-2", "End card", "Icon, URL, disclaimer", "Headway. Your next Caltrain, at a glance.", "2.8 s"],
    ]),
    short: steps("The Short (9:16, 22 s)", [
      ["s-1", "rec-3-board", "113 late", "My Caltrain is ten minutes late. Should I still take it?", "3.8 s"],
      ["s-2", "rec-3-board", "Wait for the Express", "Headway says no: wait for the Express. It gets me there first.", "4.2 s"],
      ["s-3", "rec-3-hud", "On the glasses", "It is right on my glasses, too.", "2.3 s"],
      ["s-4", "rec-3-push", "The alert", "And it pings me, before I board the slow one.", "3.0 s"],
      ["s-5", "End card", "", "Headway. Your next Caltrain, at a glance.", "2.8 s"],
    ]),
  },
};
