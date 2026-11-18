// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
// Replace the example values; keep the keys new.sh filled in.
window.REPORT = {
  key: "2026-11-17-roarly-first-build-v1", dir: "reports/2026-11-17-roarly-first-build", repo: "tianhaoz95/hejitech-apps", port: 8840,   // new.sh fills these
  title: "Roarly: first build",
  project: "projects/roarly",
  context: ["projects/roarly/CLAUDE.md", "projects/roarly/docs/decisions.md", "projects/roarly/apps/ios/RoarlyKit/Sources/RoarlyKit/StoryEngine.swift", "projects/roarly/apps/ios/App/Sources/AppModel.swift"],
  brief: "Build the story sound-effects app (iPhone + Apple Watch) autonomously: listen while a parent tells a story, play sounds from context with tap-to-play suggestions, purely local, free with a yearly subscription (free trial) and lifetime unlock, bundled Qwen 0.6B; create the App Store Connect app, automate TestFlight releases, add the owner as a tester, and test thoroughly on the connected iPhone.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh) and projects/roarly/CLAUDE.md.`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done; pick up from the first open one.` : "",
    "Act on the owner's notes (sounds to replace, prices, name, what to build next), then update the report.",
  ].filter(Boolean),

  blocks: {
    flow: {
      kind: "flow", title: "From a spoken word to a sound", note: "All on the iPhone. Files under projects/roarly/apps/ios.",
      proposed: {
        nodes: [
          { id: "mic", label: "Microphone", sub: "AudioHub (voice processing)", col: 0, row: 0, type: "ui" },
          { id: "asr", label: "SpeechAnalyzer", sub: "SpeechTranscriber, on device", col: 1, row: 0, type: "model" },
          { id: "eng", label: "StoryEngine", sub: "RoarlyKit: matcher + context rules", col: 2, row: 0 },
          { id: "llm", label: "Apple model / classifier", sub: "unsure sentences", col: 2, row: 1, type: "model" },
          { id: "out", label: "Sounds", sub: "AudioHub players / watch", col: 3, row: 0, type: "ui" },
          { id: "tap", label: "Tap cards", sub: "phone + watch", col: 3, row: 1, type: "ui" },
        ],
        edges: [
          { from: "mic", to: "asr", label: "16 kHz" },
          { from: "asr", to: "eng", label: "partial + final text" },
          { from: "eng", to: "out", label: "sure" },
          { from: "eng", to: "tap", label: "unsure" },
          { from: "eng", to: "llm", label: "review" },
          { from: "llm", to: "out", label: "yes" },
        ],
      },
    },
    director: {
      kind: "chart", type: "bar", title: "Who settles the unsure sentences: right answers out of 22", unit: "/22", max: 22,
      note: "projects/roarly/evals/director_cases.json. Built-in = Qwen3-0.6B-4bit via mlx-lm (same weights as the app). Apple = FoundationModels on this Mac. Classifier = Create ML on 2,560 sentences written by Apple's model, 96.9% on held-out animals.",
      x: ["Built-in 0.6B LLM", "Apple on-device model", "Story-sense classifier (new)"],
      series: [{ name: "correct", values: [11, 18, 20], basis: "measured", source: "evals/director_eval.py, evals/apple_director_eval.swift, ml/train.swift" }],
    },
    latency: {
      kind: "chart", type: "bar", title: "How long a decision takes", unit: "ms",
      note: "Built-in on the iPhone 13 (-selfTest, median of 10); Apple's model on the Mac (median of 22); a sound from partial text plays about 1 s before the sentence's final text (device log, recorded story).",
      x: ["Built-in 0.6B LLM (iPhone 13)", "Apple model (Mac)", "Classifier (iPhone 13)"],
      series: [{ name: "median", values: [427, 247, 10], basis: "measured", source: "device console -selfTest / apple_director_eval.swift" }],
    },
  },
};
