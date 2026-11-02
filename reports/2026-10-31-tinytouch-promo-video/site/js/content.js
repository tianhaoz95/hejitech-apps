// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-10-31-tinytouch-promo-video-v1", dir: "reports/2026-10-31-tinytouch-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8826,
  title: "TinyTouch promo video kit (Google Flow)",
  project: "projects/tinytouch",
  context: [
    "projects/tinytouch/CLAUDE.md", "projects/tinytouch/docs/index.md", "projects/tinytouch/metadata/app_store_listing.md",
    ".claude/skills/heji-promo-video/SKILL.md", "reports/2026-10-31-tinytouch-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/tinytouch-launch (the animatic; media.md lists the files)",
    "branding/promo-videos/src/weehours-launch (closest worked example: paired iPhone + Watch simulator recordings, Flow lines on camera)",
  ],
  brief: "Make TinyTouch's promotional video (skill heji-promo-video). A 30 s home comedy: Leo holds two-year-old Pip, who mashes his watch and calls his boss ('Please don't call anyone.' / 'Hiii!' / 'She's called my boss. Twice.'); TinyTouch turns every tap, swipe and the crown into gentle play, the iPhone is the remote, leaving takes a 3-second hold; Pip falls asleep ('Zero calls.'). Tagline: 'Gentle play. No surprise calls.' The script must never claim to block emergency calls: the side button is outside any app. The owner made the Flow shots and music; the first cut (30 s, 15 s, 15 s 9:16) and the YouTube kit are done and await the owner's review with sound.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "The edit is built and rendered (branding/promo-videos/src/tinytouch-launch; renders in out/final and media/edit; YouTube kit in §9, subtitles from scripts/tinytouch-launch-srt.mjs). Apply the reader's notes in Composition.tsx (cut times are on a 0.5763 s beat grid: b30(k) / b15(k)), re-render ONE composition at a time with --concurrency=2, redo the two-pass loudnorm into out/final, rerun the SRT script, and refresh media/edit, media/youtube and the thumbnails.",
    "A different narration voice: its files are public/tinytouch-launch/vo-<voice>-<key>.wav; redo word timings (faster-whisper) in voiceover.ts and the line placements in Composition.tsx.",
    "Recordings: scripts/tinytouch-launch-record.mjs on paired iPhone + Watch simulators, driven by a throwaway XCUITest project (TTDrive; see the script's header). Nothing places a call.",
    "When the owner sends the 30 s YouTube link: check oEmbed, then embed it on projects/tinytouch/site/index.html (click-to-play poster, youtube-nocookie iframe on click; say so in site/privacy.html, a Kids Category app) and projects/tinytouch/docs/index.md ('See it in 30 seconds').",
    "Claims stay true to projects/tinytouch/docs/index.md: no 'blocks 911/SOS', no development or learning claims.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s, as cut)", note: "The jokes are Leo's and Pip's own lines on camera; the narration (Leo, Kokoro am_echo) says what TinyTouch does.",
      steps: [
        { actor: "The grab", text: "0:00 Pip mashes the watch on Leo's wrist. Leo: \"Please don't call anyone.\" (shot 1)" },
        { actor: "The call", text: "0:03 She holds it to her ear: \"Hiii!\" (shot 2)" },
        { actor: "The joke", text: "0:05 Leo, deadpan to camera: \"She's called my boss. Twice.\" (shot 3)" },
        { actor: "Her turn", text: "0:08 The groove comes in; he opens TinyTouch and offers his wrist. Bubbles, the puppy, stardust swipes from every edge. (shot 4 → Watch recordings)" },
        { actor: "The remote", text: "0:17 From his phone he switches to Sound Garden, then starts the lullaby; the watch follows. (shot 5 → iPhone, Watch)" },
        { actor: "The lock", text: "0:21 A quick tap does nothing; the 3-second hold opens the parent menu." },
        { actor: "Payoff", text: "0:24 Pip asleep on his shoulder. Leo whispers: \"Zero calls.\" End card at 0:26.6 on the track's final hit. (shot 6)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second cut, as built", note: "Times are cut points on the music's beat grid. Recordings are the real apps (§6).",
      head: ["Time", "Flow shot", "Then the recording", "Spoken"],
      rows: [
        ["0:00–0:03.1", "1 · Pip mashes the watch (from 3.9 s)", "—", "Leo: \"Please don't call anyone.\""],
        ["0:03.1–0:05.4", "2 · watch to her ear (from 3.2 s, zoomed)", "—", "Pip: \"Hiii!\""],
        ["0:05.4–0:08.3", "3 · Leo to camera (from 3.05 s)", "—", "Leo: \"She's called my boss. Twice.\""],
        ["0:08.3–0:17.5", "4 · he offers his wrist (2.3 s)", "rec-watch-bubbles, -animals, -swipe", "So now, I open TinyTouch first. Every tap is a bubble, an animal, a note. Swipes and the crown are part of the game. Nothing gets out."],
        ["0:17.5–0:21.0", "5 · phone in his free hand (1.2 s)", "rec-phone-remote, rec-watch-garden", "From my phone, I switch the game, or start the lullaby."],
        ["0:21.0–0:24.4", "—", "rec-watch-shield", "Getting out takes a three-second hold. Little fingers can't."],
        ["0:24.4–0:30", "6 · Pip asleep (from 2.85 s, zoomed)", "end card from 0:26.6", "Leo: \"Zero calls.\" · TinyTouch. Gentle play. No surprise calls."],
      ],
    },
  },
};
