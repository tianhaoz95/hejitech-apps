// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
const HEAD = ["Step", "Screen", "Action (target)", "Viewer notices", "Voiceover", "Hold"];
const steps = (title, rows) => ({ kind: "table", title, head: HEAD, rows });

window.REPORT = {
  key: "2026-11-02-fitloop-demo-video-v2",
  dir: "reports/2026-11-02-fitloop-demo-video",
  repo: "tianhaoz95/hejitech-apps",
  port: 8834,
  title: "FitLoop walkthrough video",
  project: "projects/fitloop",
  context: [
    ".claude/skills/heji-demo-video/SKILL.md",
    ".claude/skills/heji-promo-video/SKILL.md",
    "projects/fitloop/CLAUDE.md",
    "projects/fitloop/docs/index.md",
    "projects/fitloop/docs/decisions.md",
    "packages/core/src (validate.ts, plan.ts, settings.ts, guide.ts, glasses.ts)",
    "services/web/src/worker (api.ts, mcp.ts, store.ts, review.ts)",
    "apps/glasses/src (app.ts, main.ts)",
    "apps/ios (FitLoopKit, App, Watch, HealthSync)",
    "branding/promo-videos/src/fitloop-demo (animatic, edit) and src/fitloop-launch (promo: palette, voice af_sarah, character Maya)",
    "branding/promo-videos/scripts/fitloop-demo-record.mjs (recorder with event logs)",
    "Media folder: /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/fitloop-demo/ (main checkout only)",
  ],
  brief: "FitLoop's walkthrough video (skill heji-demo-video), finished 2026-11-08: 2:18 16:9 with six chapters plus a 29 s Short, every product frame a real recording (two live Claude Code runs over FitLoop MCP, the iPhone app driven by XCUITest on the simulator, the Even G2 plugin in the Even Hub simulator), Kokoro af_sarah narration, the owner's Flow art and Flow Music. Ready to upload.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-demo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: rendered. Edit in branding/promo-videos/src/fitloop-demo/Composition.tsx (fitloop-demo, -short, -thumb, -short-thumb); finals in branding/promo-videos/out/final/; media list in src/fitloop-demo/media.md.",
    "If the owner asks for changes: re-voice with scripts/fitloop-demo-vo.py --only <ids> + fitloop-demo-words.py; re-record with scripts/fitloop-demo-record.mjs <step> (local stack); render each composition with --concurrency=2 and Playwright's chrome-headless-shell (--browser-executable), then two-pass loudnorm to -14 LUFS.",
    "When the owner sends the YouTube link: embed it in projects/fitloop/docs/index.md (Watch the walkthrough, chapter links) and link it from the landing page's How it works.",
  ].filter(Boolean),

  blocks: {
    path: {
      kind: "flow",
      title: "The loop the video walks through",
      note: "Each box is a chapter; every one is a real recording.",
      proposed: {
        nodes: [
          { id: "agent", label: "1 · Your agent", sub: "MCP: guide, profile, validate, publish", col: 0, row: 0, type: "api" },
          { id: "phone", label: "2 · Phone", sub: "workout, set done, rest timer", col: 1, row: 0, type: "ui" },
          { id: "glasses", label: "3 · Even G2 + R1", sub: "tap, swipe, hold: It hurts", col: 2, row: 0, type: "ui" },
          { id: "adapt", label: "4 · Agent adapts", sub: "reads the note, replies, plan v2", col: 3, row: 0, type: "api" },
        ],
        edges: [
          { from: "agent", to: "phone", label: "plan v1" },
          { from: "phone", to: "glasses", label: "same day" },
          { from: "glasses", to: "adapt", label: "note" },
        ],
      },
    },
    ch0: steps("Steps · Intro", [
      ["c0-1", "Flow opener (A1)", "FitLoop title over the studio", "What it's about", "Your AI agent can write you a great training plan. Then you walk into the gym, and it is stuck in a chat window.", "7.6 s"],
      ["c0-2", "Phone + glasses stills", "The real workout screen and the real glasses", "Where the plan ends up", "FitLoop puts your agent's plan on your phone, your watch and your Even G2 glasses, and sends back how it went.", "7.8 s"],
    ]),
    ch1: steps("Steps · 1 Your agent writes the plan", [
      ["c1-1", "rec-1-connect (web Settings)", "Agents (MCP) → Copy URL", "The MCP address", "In FitLoop's settings, copy the MCP address, and add it to your agent. Claude Code is shown here; any MCP client works.", "9.1 s"],
      ["c1-2", "rec-1-terminal", "/mcp → fitloop → Authenticate", "A real sign-in from the agent", "Sign in from your agent, once.", "3.8 s"],
      ["c1-3", "rec-1-consent + -connected", "Consent page → Allow", "What it may and may not do", "FitLoop shows exactly what it may do. Allow it, and you are connected.", "7.4 s"],
      ["c1-4", "rec-1-agent (1×)", "Types the request", "The ask", "Then just ask: set up my training plan, starting today.", "4.4 s"],
      ["c1-5", "rec-1-agent (time-lapse)", "MCP calls pop in as chips; publish_plan ✓; the summary", "It checks before it publishes", "It reads FitLoop's plan guide and your profile, builds the week, and checks it against FitLoop's rules before it publishes.", "10.1 s"],
      ["c1-6", "rec-1-today", "The agent's note, today's workout", "It's on the phone", "Seconds later, today's workout and meals are on your phone, with a note on what it planned.", "6.6 s"],
    ]),
    ch2: steps("Steps · 2 Train with your phone", [
      ["c2-1", "rec-2-workout", "Tap the workout", "The workout opens", "At the gym, tap the workout to start it.", "3.7 s"],
      ["c2-2", "rec-2-workout", "Goblet squat; the cues", "Set, target, cues", "Each exercise shows the set, the target, and your agent's form cues.", "5.7 s"],
      ["c2-3", "rec-2-workout", "Set done → Rest 1:30", "The timer starts itself", "Finish a set and tap Set done. The rest timer starts by itself.", "6.0 s"],
    ]),
    ch3: steps("Steps · 3 Hands-free on your glasses", [
      ["c3-1", "rec-3-pair", "Settings → Pair glasses → Get a pairing code", "A six-digit code", "To go hands-free, get a pairing code in Settings, and type it into the Even app, once.", "6.2 s"],
      ["c3-2", "rec-3-glasses", "Today on G2; tap opens the workout", "Set 2 (set 1 was on the phone)", "Now your day is on your Even G2. Tap the R1 ring to open the workout.", "5.7 s"],
      ["c3-3", "rec-3-glasses", "Tap: set done → REST 1:30", "Rest timer, heart rate", "Tap again when a set is done. The rest timer runs right in front of you, next to your heart rate.", "6.4 s"],
      ["c3-4", "rec-3-glasses", "Swipe: next exercise; hold: menu → Tell agent: It hurts", "A note without stopping", "Something hurts? Hold the ring, and tell your agent, without stopping.", "5.9 s"],
    ]),
    ch4: steps("Steps · 4 Your agent adapts", [
      ["c4-1", "rec-4-meal", "Lunch → Ate it", "Meals check off", "Check off your meals as you eat them.", "3.4 s"],
      ["c4-2", "rec-4-agent (time-lapse)", "\"I left a note…\" → get_feedback … publish_plan ✓", "It reads the note", "Later, ask your agent to take a look. It reads your note over MCP, and plays it safe.", "7.4 s"],
      ["c4-3", "rec-4-reply", "Feedback: the note and the reply", "The answer, in FitLoop", "It answers you right in FitLoop,", "4.5 s"],
      ["c4-4", "rec-4-next", "Today, plan v2: Dumbbell glute bridge, Goblet pause squat", "What changed", "and publishes a new plan. Today's Romanian deadlift is now a glute bridge.", "6.8 s"],
    ]),
    recap: steps("Steps · Recap and end card", [
      ["c5-1", "Recap (4 stills)", "One frame per chapter", "The loop", "Your agent writes the plan. FitLoop keeps you on it, and tells your agent how it went.", "6.3 s"],
      ["c5-2", "End card", "Icon, URL, surfaces, disclaimer", "Where to get it", "FitLoop. Your agent's plan, wherever you train.", "5.0 s"],
    ]),
    short: steps("The Short (9:16, 29 s): one task, start to finish", [
      ["s-1", "rec-3-glasses", "Today on G2", "Hook", "My AI agent wrote this workout. Now it is on my glasses.", "4.9 s"],
      ["s-2", "rec-3-glasses", "Tap: set done → rest", "", "Tap the ring when a set is done, and the rest timer starts.", "4.4 s"],
      ["s-3", "rec-3-glasses", "Hold → It hurts", "", "Something hurts? Hold the ring, and tell your agent.", "4.6 s"],
      ["s-4", "rec-4-agent", "The agent's run, time-lapse", "", "It reads the note, answers, and changes the plan.", "4.5 s"],
      ["s-5", "rec-4-next", "Glute bridge in today's workout", "", "The deadlift is out. A glute bridge is in.", "4.6 s"],
      ["s-6", "End card", "", "", "FitLoop. Your agent's plan, wherever you train.", "5.2 s"],
    ]),
  },
};
