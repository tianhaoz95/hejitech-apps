// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-10-31-toddlercam-promo-video-v1", dir: "reports/2026-10-31-toddlercam-promo-video", repo: "tianhaoz95/hejitech-apps", port: 8827,
  title: "ToddlerCam promo video kit (Google Flow)",
  project: "projects/toddlercam",
  context: [
    "projects/toddlercam/CLAUDE.md", "projects/toddlercam/README.md", "projects/toddlercam/docs/index.md",
    "projects/toddlercam/AppStore/APP_STORE_METADATA.md", ".claude/skills/heji-promo-video/SKILL.md",
    "reports/2026-10-31-toddlercam-promo-video/site/index.html", "branding/README.md",
    "branding/promo-videos/src/toddlercam-launch (the animatic; media.md lists the files)",
    "branding/promo-videos/src/weehours-launch (the closest worked example: a family, a watch, iPhone + Watch simulator recordings, YouTube kit)",
    "projects/toddlercam/KidsCam/Camera/SimulatorCameraStreamer.swift (the simulator's camera feed: frames from 127.0.0.1:8089/front and /rear)",
  ],
  brief: "Make ToddlerCam's promo video (skill heji-promo-video). Planned 2026-10-31; the owner made the characters, the 7 Flow shots and the music (two 30 s takes, one 15 s) but not the two feed clips; then: 'proceed to make the promo video'. The edit, renders and YouTube kit are done; the owner reviews with sound.",
  nextSteps: ({ ticks }) => [
    `Read the kit at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and follow .claude/skills/heji-promo-video.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done.` : "",
    "Apply the reader's notes on the cuts in branding/promo-videos/src/toddlercam-launch/Composition.tsx (T = where things happen in each recording, music parts = whole-beat jumps), then re-render ONE composition at a time with --concurrency=2, redo the two-pass loudness pass, the SRTs (node scripts/toddlercam-launch-srt.mjs out/final), posters and thumbnails, and recopy media/edit and media/youtube.",
    "Re-recording (e.g. the keepsake beat) needs working simulators: if simctl hangs or logs 'CoreSimulator is out of date', the owner must run sudo xcodebuild -runFirstLaunch. Then follow src/toddlercam-launch/media.md (Debug build, the XCUITest driver, the OCR helper, the record script). Simulators only, never the real cameras.",
    "When the owner sends the 30 s YouTube link: embed it on projects/toddlercam/site/index.html (click-to-play poster, youtube-nocookie on click; the site is static on GitHub Pages) and projects/toddlercam/docs/index.md; mention the YouTube embed in site/privacy.html (Kids Category: nothing may load from YouTube before the click).",
    "Claims must stay true to projects/toddlercam: no account, no ads, no analytics, photos stay on the phone. No safety/COPPA claims.",
  ].filter(Boolean),

  blocks: {
    arc: {
      kind: "steps", title: "Story arc (30 s)", note: "Jokes in the characters' own Flow voices; Nora's narration (Kokoro) says what ToddlerCam does.",
      steps: [
        { actor: "The problem", text: "0:00 Nora holds her phone up: \"Milo! Look at Mommy!\" Milo stares out of the window. (shot 1)" },
        { actor: "Mine!", text: "0:03 He grabs the phone with both hands: \"Mine!\" (shot 2)" },
        { actor: "His own camera", text: "0:06 Milo toddles across the yard filming; the app shows what he sees and his face at once, a lion mask on him. (shot 3 → rec-dual)" },
        { actor: "The remote", text: "0:11 Nora taps her watch; the phone quacks; Milo looks up; she snaps it from her wrist. (shot 4 → watch, phone)" },
        { actor: "Little hands", text: "0:16 Milo slaps the screen with both palms: only bubbles. (shot 5 → rec-lock)" },
        { actor: "Trust", text: "0:20 Evening on the sofa, the day's photos: no account, no ads, it stays on the phone. (shot 6; the keepsake recording was cut, §1)" },
        { actor: "Payoff", text: "0:24 Milo points the phone at Nora: \"Mommy! Look!\" She pulls a duck face: \"Quack.\" He cracks up. End card at 0:27. (shot 7)" },
      ],
    },
    shots: {
      kind: "table", title: "30-second storyboard", note: "Flow = generated shot (1.5–3 s of it used). Recording = the real app on simulators (§7), made by me, fed with your two feed clips (§6).",
      head: ["Time", "Flow shot", "Then the recording", "Spoken"],
      rows: [
        ["0:00–0:03", "1 · \"Look at Mommy!\", he looks away", "—", "Nora: \"Milo! Look at Mommy!\" · Narration: Four hundred photos of the back of his head."],
        ["0:03–0:06", "2 · he grabs the phone", "—", "Milo: \"Mine!\" · Narration: So we gave him his own camera."],
        ["0:06–0:11", "3 · Milo films the yard (2 s)", "rec-dual: both cameras, his face in the bubble, then swapped; the lion circles him", "Narration: Both cameras at once: what he sees, and his face."],
        ["0:11–0:16", "4 · Nora taps her watch (1.5 s)", "rec-watch-snap (Quack) → rec-phone-snap (he looks, the shutter flash)", "Narration: My watch is the remote. One tap, [quack] he looks. Snap. · SFX: the app's own quack and shutter"],
        ["0:16–0:20", "5 · Milo slaps the screen (1.5 s)", "rec-lock: bubbles and stars, camera still running", "Narration: He can tap all he likes. It only makes bubbles."],
        ["0:20–0:24", "6 · the sofa, the day's photos (all of it)", "— (rec-keepsake cut, §1)", "Narration: No account, no ads. It all stays on the phone."],
        ["0:23.5–0:30", "7 · \"Mommy!\" \"Quack.\"", "end card from 0:26.7", "Milo: \"Mommy!\" · Nora: \"Quack.\" · Narration: ToddlerCam. A camera for little hands, and a remote on yours."],
      ],
    },
  },
};
