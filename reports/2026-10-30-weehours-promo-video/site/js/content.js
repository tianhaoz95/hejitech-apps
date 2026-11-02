// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-10-30-weehours-promo-video-v2", dir: "reports/2026-10-30-weehours-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8825,
  title: "Wee Hours promo video kit (Google Flow)",
  project: "projects/weehours",
  context: [
    "projects/weehours/CLAUDE.md", "projects/weehours/README.md", "projects/weehours/docs/index.md", ".claude/skills/heji-promo-video/SKILL.md",
    "reports/2026-10-30-weehours-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/weehours-launch (the animatic; media.md lists the files)",
    "branding/promo-videos/src/headway-launch (the worked example: Flow lines on camera, glasses and iPhone recordings, YouTube kit)",
  ],
  brief: "Plan a promotional video for Wee Hours (skill heji-promo-video). The characters should be in a similar style to the owner's reference screenshot (a realistic family-sitcom frame: an earnest dad in a red plaid shirt explaining himself to a deadpan little daughter in a gingham dress), and the storyline should be funny. This is the second plan, regenerated to the current skill: the reference sets the look only (its kitchen-table scene is gone), four Flow fields per character, Jun's watch is part of his character, jokes spoken on camera. After the owner's note, voice capture on the Watch is the selling point: shot 4 is Jun whispering to his watch at 3am with the baby in both arms; tilt mode is the silent follow-up.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "The edit is built and rendered (branding/promo-videos/src/weehours-launch, renders in out/final and media/edit; the YouTube kit in §8, subtitles from scripts/weehours-launch-srt.mjs). Apply the reader's notes on the cuts in Composition.tsx, then re-render ONE composition at a time with --concurrency=2 (parallel renders ran a 16 GB Mac out of memory), redo the two-pass loudness pass and the SRTs, and refresh media/edit and media/youtube.",
    "Recordings: scripts/weehours-launch-record.mjs on the local stack only (seeded household, parents renamed Jun and Mei); run its restore step afterwards.",
    "When the owner sends the 30 s YouTube link: embed it on projects/weehours/services/web (click-to-play poster, youtube-nocookie on click) and projects/weehours/docs/index.md, as Headway's were; note the YouTube embed in the privacy page.",
    "Claims must stay true to projects/weehours (README, docs/index.md): it logs, it gives no advice; keep 'A log, not medical advice' on the end card.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "The jokes are the characters' own lines on camera; the narration (Jun, Kokoro) says what Wee Hours does.",
      steps: [
        { actor: "3am", text: "0:00 Jun sways with the baby, half-asleep, then panics: \"Did I feed her?\" (shot 1)" },
        { actor: "The fridge", text: "0:03 Jun and Mei open the fridge together, each holding an empty bottle: \"I fed her.\" Suspicious squints. (shot 2)" },
        { actor: "The witness", text: "0:06 Saturday morning, still arguing; Doudou walks past: \"Two-ten. Left side. You were snoring.\" (shot 3)" },
        { actor: "Tell the watch", text: "0:11 3am, lights off, baby in both arms: Jun whispers \"Bottle, ninety mils.\" to his watch; the phone understands it, the watch shows the status. (shot 4 → Watch voice recording)" },
        { actor: "Shared", text: "0:16 Mei reads it in bed, smiles, goes back to sleep. (shot 5 → partner's phone recording)" },
        { actor: "Not a word", text: "0:19 The baby finally asleep on his chest: he tilts his wrist and pinches, silently. (shot 6 → Watch tilt-mode recording)" },
        { actor: "Payoff", text: "0:23 Doudou copies shot 4, whispering into her bare wrist: \"Two cookies. Logged.\" Jun facepalms. End card at 0:26. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (1.5–3 s of it used, with its line). Recording = the real app (§6), made by the agent.",
      head: ["Time", "Flow shot", "Then the recording", "Spoken"],
      rows: [
        ["0:00–0:03", "1 · 3am, swaying, sudden panic", "—", "Jun: \"Did I feed her?\""],
        ["0:03–0:06", "2 · fridge, two empty bottles", "—", "Jun + Mei: \"I fed her.\""],
        ["0:06–0:11", "3 · the sofa, Doudou walks past", "—", "Narration: At three a.m., nobody remembers anything. Except our four-year-old. · Doudou: \"Two-ten. Left side. You were snoring.\""],
        ["0:11–0:16", "4 · whispers to his watch, baby in both arms (2 s)", "rec-watch-voice: the watch records, then the status; a beat of the iPhone log", "Jun: \"Bottle, ninety mils.\" · Narration: Now I just whisper to my watch. My phone understands it, right there."],
        ["0:16–0:19", "5 · Mei reads, sleeps (1 s)", "rec-partner, dark theme", "Narration: Mei sees it on hers, and goes back to sleep."],
        ["0:19–0:23", "6 · baby asleep, he tilts his wrist (1 s)", "rec-watch-tilt", "Narration: Baby asleep? Not a word. I just tilt my wrist."],
        ["0:23–0:30", "7 · Doudou logs her cookies, facepalm", "end card from 0:26", "Doudou: \"Two cookies. Logged.\" · Narration: Wee Hours. A newborn log built for three a.m."],
      ],
    },
  },
};
