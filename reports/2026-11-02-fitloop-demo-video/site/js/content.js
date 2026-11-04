// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
const HEAD = ["Step", "Screen", "Action (target)", "Viewer notices", "Voiceover", "Hold"];
const steps = (title, rows) => ({ kind: "table", title, head: HEAD, rows });

window.REPORT = {
  key: "2026-11-02-fitloop-demo-video-v1",
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
  brief: "Make FitLoop's product walkthrough video with skill heji-demo-video. Teaches an athlete how their AI agent connects via MCP to coach workouts and meals, follow routines on iPhone and Apple Watch with live HR, track sets hands-free on Even G2 glasses with R1 ring gestures, and close the loop when flagging mid-set pain or diet check-ins so the agent improves tomorrow's plan. Animatic and 25 voiceover lines generated with Kokoro-82M; awaiting owner review, Flow art and recordings.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-demo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: animatic in branding/promo-videos/src/fitloop-demo/Composition.tsx (ids fitloop-demo, fitloop-demo-short, fitloop-demo-thumb), voiceover audio generated with Kokoro-82M (af_sarah) and transcribed with faster-whisper into voiceover.ts. Media tracked in branding/promo-videos/src/fitloop-demo/media.md.",
    "Recordings: run scripts/fitloop-demo-record.mjs (stage, glasses, workout, loop) on the local stack (supabase start + worker on 127.0.0.1:8794). Always run restore afterwards.",
    "Flow art: download 7 prompts (A1 opener, B1-B4 chapter backdrops, A2 bridge, A3 end card) into /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/fitloop-demo/.",
    "Music: generate 115s warm tech-athletic track in Flow Music and place into public/fitloop-demo/.",
    "Render & upload: npx remotion render fitloop-demo out/fitloop-demo.mp4 --concurrency=2, two-pass loudnorm to -14 LUFS, node scripts/fitloop-demo-srt.mjs out/final, and upload to YouTube with §YouTube kit.",
    "When uploaded: embed on projects/fitloop/docs/index.md and link from landing page.",
  ].filter(Boolean),

  blocks: {
    path: {
      kind: "flow",
      title: "The core closed-loop journey in the walkthrough",
      note: "Each step connects real capabilities in @fitloop/core, the MCP Worker, native iOS, Watch, and Even G2 glasses.",
      proposed: {
        nodes: [
          { id: "agent", label: "1 · MCP AI Agent", sub: "Claude fetches guide & validates", col: 0, row: 1, type: "store" },
          { id: "plan", label: "Plan Published (v1)", sub: "Strict G2 character limits", col: 1, row: 0, type: "store" },
          { id: "phone", label: "2 · iPhone & Watch", sub: "Workout player + live HR", col: 1, row: 1, type: "ui" },
          { id: "glasses", label: "3 · Even G2 Glasses", sub: "9-line green HUD + R1 ring", col: 2, row: 1, type: "ui" },
          { id: "feedback", label: "4 · Mid-Set Feedback", sub: "'It hurts' on reverse lunges", col: 3, row: 0, type: "ui" },
          { id: "loop", label: "Closed Loop (v2)", sub: "Agent adapts to box step-ups", col: 3, row: 1, type: "store" },
        ],
        edges: [
          { from: "agent", to: "plan", label: "publish_plan" },
          { from: "plan", to: "phone", label: "syncs today" },
          { from: "phone", to: "glasses", label: "offline BLE" },
          { from: "glasses", to: "feedback", label: "R1 ring hold" },
          { from: "feedback", to: "loop", label: "MCP poll & replan" },
          { from: "loop", to: "phone", label: "tomorrow v2" },
        ],
      },
    },
    timeline: {
      kind: "table",
      title: "YouTube Chapters & Timeline (1:58 total runtime)",
      head: ["Time", "Chapter", "On screen", "Backdrop / Mood"],
      rows: [
        ["0:00–0:13", "Intro", "A1 opener → Stop gym guessing → FitLoop 4-surface overview", "A1 athletic studio morning sun"],
        ["0:13–0:38", "1 · Bring your agent & generate plan", "Claude MCP terminal → get_plan_guide → validate_plan limits → publish_plan (v1)", "B1 modern desk & tablet calendar"],
        ["0:38–1:03", "2 · Mid-workout on iPhone & Apple Watch", "iPhone Today tab → 2D procedural rigging exercise GIF → Apple Watch HR sync → set done & rest timer", "B2 workout bench & dumbbells"],
        ["1:03–1:27", "3 · Hands-free on Even G2 & R1 ring", "iPhone 6-digit pair code → Even G2 9-line green HUD → R1 single tap for set → R1 hold quick menu", "B3 athletic POV with emerald HUD"],
        ["1:27–1:52", "4 · The closed loop: instant feedback & plan adaptation", "Flag 'It hurts' mid-set on lunges → meal check-in → agent responds over MCP → Plan v2 swaps for step-ups", "B4 sunlit kitchen & healthy meal"],
        ["1:52–1:58", "Recap + end card", "4-beat montage (Agent MCP, Phone/Watch, G2 HUD, Replan v2) → End card with icon", "A3 dark fitness studio indigo glow"],
      ],
    },
    ch0: steps("Steps · Intro", [
      ["0.1", "Gym Floor", "Wide shot of gym floor", "Athletes wandering between machines, checking notes", "Everyone at the gym is guessing weights and counting sets.", "4.0 s"],
      ["0.2", "Surfaces", "FitLoop multi-device reveal", "iPhone Today tab, Apple Watch HR, and Even G2 glasses HUD floating together", "Here is how Fit Loop lets your own A I agent coach your workouts and meals across iPhone, Apple Watch, and Even G2 glasses.", "8.5 s"],
    ]),
    ch1: steps("Steps · 1 Bring your agent & generate plan", [
      ["1.1", "OAuth MCP", "Agent terminal connection", "Claude Code / Cursor connects to FitLoop Worker MCP via local token", "Connect Claude or any M C P agent to Fit Loop with a single tap.", "5.1 s"],
      ["1.2", "Plan Guide", "Agent fetches guide & profile", "get_plan_guide & get_profile return athlete's 40m morning constraints and equipment", "Your agent fetches the plan guide and your profile to craft a customized weekly routine.", "5.9 s"],
      ["1.3", "Validator", "Core validator terminal output", "Validates strict limits: names ≤28 chars, cues ≤60 chars, valid weekdays and rest timers", "Fit Loop validates every exercise, rest timer, and rep count against strict glasses-friendly limits.", "7.1 s"],
      ["1.4", "Publish", "publish_plan tool call succeeds", "Version 1 published: Lower Body (goblet squats, reverse lunges, rows, planks, meals)", "Once validated, your agent publishes the plan, instantly syncing to your devices.", "5.8 s"],
    ]),
    ch2: steps("Steps · 2 Mid-workout on iPhone & Apple Watch", [
      ["2.1", "Today tab", "iPhone Today view loads", "Lower Body workout (07:00, 40 min), 4 exercises, and scheduled meals around 2,000 kcal", "On your phone, the Today tab displays your full morning session, from goblet squats to meals.", "6.3 s"],
      ["2.2", "Exercise GIF", "Tap goblet squat for demo", "Procedural 2D rigging animation (/api/exercises/goblet-squat.gif) and key form cues", "Tap into any movement to preview procedural exercise animations and coaching cues.", "6.1 s"],
      ["2.3", "Watch workout", "Apple Watch workout session", "HKWorkoutSession begins; heart rate (132 bpm) streams to phone and worker", "When you start, your Apple Watch tracks your workout session and streams live heart rate.", "5.6 s"],
      ["2.4", "Workout player", "Check off set 1 (10 reps @ 16 kg)", "Set 1 marked done; 60s rest timer ring counts down automatically with haptic feedback", "Check off sets as you finish them, and the rest timer automatically counts down.", "5.4 s"],
    ]),
    ch3: steps("Steps · 3 Hands-free on Even G2 & R1 ring", [
      ["3.1", "Pairing code", "Settings → Glasses tab", "Generates 6-digit pairing code (842 195) to link Even Hub plugin", "Take your workout completely hands-free by pairing your Even G2 glasses.", "5.2 s"],
      ["3.2", "G2 HUD", "Even G2 glasses display", "Crisp 9-line green board: Goblet squat, Set 1/4 (10 @ 16 kg), live 132 bpm heart rate", "A crisp nine-line green display shows your active exercise, target reps, and live heart rate.", "6.6 s"],
      ["3.3", "R1 Tap", "R1 ring single-tap gesture", "Tap marks set complete; HUD immediately shifts to 60s rest countdown", "Single tap your R one smart ring to log your set and trigger the rest countdown.", "5.5 s"],
      ["3.4", "R1 Hold", "R1 ring hold gesture", "Hold opens menu: Form cues, skip exercise, or in-the-moment feedback", "Hold the ring to view form cues, or tap out instant feedback if something hurts.", "5.5 s"],
    ]),
    ch4: steps("Steps · 4 The closed loop: instant feedback & plan adaptation", [
      ["4.1", "Feedback", "Select 'It hurts' on lunges", "User notes knee discomfort on reverse lunges; feedback syncs to Worker", "If your knee twinges during lunges, select It hurts right from your glasses or phone.", "5.6 s"],
      ["4.2", "Diet check-in", "Check in lunch chicken bowl", "User marks lunch as eaten; notes good recovery and steady energy", "At lunch, check off your meal, adjusting whether you ate more, less, or swapped dishes.", "5.5 s"],
      ["4.3", "Agent MCP", "Agent calls get_feedback & replies", "Agent reads knee pain note, explains deloading knee flexion, and sends in-app response", "Your agent reads your check-ins and notes over M C P, and replies with helpful adjustments.", "6.4 s"],
      ["4.4", "Plan v2", "Plan v2 synced on Today tab", "Reverse lunges replaced with box step-ups; knee load reduced while maintaining training stimulus", "Tomorrows plan automatically swaps out squats for step-ups, keeping you safe and on track.", "6.3 s"],
    ]),
    recap: steps("Steps · Recap & End Card", [
      ["5.1", "Montage", "4-surface recap grid", "MCP Agent → iPhone & Watch → Even G2 Glasses → Closed-Loop Adaptation", "Your agent coaches. Fit Loop keeps you on the plan.", "3.8 s"],
      ["5.2", "End card", "FitLoop logo & links", "FitLoop icon, docs link (fitloop.hejitech.workers.dev), demo data disclaimer", "Fit Loop. Smarter training, right in your vision.", "3.5 s"],
    ]),
  },
};
