// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-11-01-fitloop-promo-video-v1", dir: "reports/2026-11-01-fitloop-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8829,
  title: "FitLoop promo video kit (Google Flow)",
  project: "projects/fitloop",
  context: [
    "projects/fitloop/CLAUDE.md", "projects/fitloop/docs/index.md", ".claude/skills/heji-promo-video/SKILL.md",
    "reports/2026-11-01-fitloop-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/fitloop-launch (animatic, then the edit)",
    "branding/promo-videos/src/headway-launch (the closest worked example: glasses + iPhone, two Flow characters)",
  ],
  brief: "Make FitLoop's promo video (skill heji-promo-video): a 30 s main cut plus 15 s cuts in 16:9 and 9:16. Draft 1 of the plan: a gym comedy in the style of Headway's promo (photoreal, expressive lead who plays to the camera, a comic foil), set in FitLoop's own world (a dawn gym in its indigo and orange). The owner makes the characters, shots and music in Google Flow; the agent makes the recordings, voiceover and edit.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "State: the edit is rendered (branding/promo-videos/src/fitloop-launch; finals in out/final and the report's media/edit, not in git). Every file and how it was made: branding/promo-videos/src/fitloop-launch/media.md. Renders need Playwright's headless shell (--browser-executable), see media.md.",
    "Apply the reader's notes on the cuts (music take, narration voice, timing), re-render one at a time with --concurrency=2, run the two-pass loudness step, copy finals and posters into site/media/edit and update §1.",
    "After any re-cut: node scripts/fitloop-launch-srt.mjs out/final and recopy the SRTs and thumbnails into site/media/youtube.",
    "When the owner sends the 30 s YouTube link: check oEmbed, then embed it on FitLoop's home page (projects/fitloop/services/web, click-to-play poster, youtube-nocookie, CSP frame-src) and projects/fitloop/docs/index.md ('See it in 30 seconds'); record the id in media.md.",
    "Recordings were made on the local stack only (scripts/fitloop-launch-record.mjs stage/glasses/agent/phone, then restore); never production.",
    "Claims must stay true to projects/fitloop (docs/index.md): the agent coaches, FitLoop gives no advice; no assistant brand on screen; 'Demo data' and 'Not medical advice' stay.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "One voiceover line per beat; the Flow shots carry the comedy, the recordings show the product.",
      steps: [
        { actor: "The gym guesses", text: "0:00 Dawn gym; everyone's lost; Theo sits backwards on a machine; Maya, in her glasses, walks past knowing exactly where she's going. (shot 1)" },
        { actor: "Not her", text: "0:04 Theo: \"Wait, how many sets is this?\" Maya, mid-squat, deadpan to camera: \"My agent wrote mine.\" (shot 2)" },
        { actor: "FitLoop", text: "0:07 She glances up; her glasses show the exercise, the set and its target. (shot 3 → glasses: the set)" },
        { actor: "One tap", text: "0:12 Last rep, a tap on the ring: set done, the rest timer starts itself. (shot 4 → glasses: rest timer)" },
        { actor: "It hurts", text: "0:16 A lunge twinges; she holds the ring and tells her agent; Theo copies and topples. (shot 5 → glasses: It hurts)" },
        { actor: "The loop", text: "0:20 Evening: her phone has the agent's reply and tomorrow's plan, lunges swapped for step-ups. (shot 6 → loop graphic → iPhone: the reply)" },
        { actor: "Payoff", text: "0:25 Next morning, step-ups; Theo a beat late beside her: \"Okay. I'm getting an agent.\" She winks. End card. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (1.5–3 s of it used). Recording = the real app, made by the agent.",
      head: ["Time", "Flow shot", "Then", "Voiceover"],
      rows: [
        ["0:00–0:04", "1 · the gym guesses, Maya walks through", "—", "Everyone at my gym is guessing."],
        ["0:04–0:07", "2 · Theo asks, Maya deadpan", "—", "Theo: Wait, how many sets is this? · Maya: My agent wrote mine."],
        ["0:07–0:12", "3 · the glance (1.5 s)", "rec-glasses-set, over her view", "My own AI agent plans my workouts and meals. FitLoop puts them in my glasses."],
        ["0:12–0:16", "4 · last rep, ring tap (1.5 s)", "rec-glasses-rest", "Set done? One tap. The rest timer starts itself."],
        ["0:16–0:20", "5 · lunge, wince, hold; Theo topples (2 s)", "rec-glasses-hurts", "Something hurts? I tell my agent, mid-set."],
        ["0:20–0:25", "6 · kitchen, phone back to camera (2 s)", "loop graphic → rec-phone-reply, phone frame", "It reads everything back, and adjusts tomorrow's plan."],
        ["0:25–0:30", "7 · step-ups; Theo gives up", "end card over it", "Theo: Okay. I'm getting an agent. · Your agent coaches. FitLoop keeps you on the plan."],
      ],
    },
  },
};
