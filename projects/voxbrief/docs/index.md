---
layout: home
hero:
  name: "Voxbrief"
  text: "Speak an idea, get a clean note"
  tagline: "One tap on Apple Watch records a voice memo; the iPhone or Mac turns it into a structured Markdown note with Whisper and a Qwen3 model running on the device. No account, no server, nothing leaves your devices."
  image:
    src: /voxbrief/icon.png
    alt: Voxbrief
  actions:
    - theme: brand
      text: Visit Voxbrief
      link: https://tianhaoz95.github.io/hejitech-apps/voxbrief/site/
    - theme: alt
      text: Source
      link: https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/voxbrief

features:
  - title: Capture in one tap
    details: Watch complications, the Action Button, Control Center, a Live Activity or the keyboard extension start a recording instantly, even with no iPhone nearby.
  - title: On-device pipeline
    details: WhisperKit transcribes; Qwen3 through MLX Swift extracts the title, summary, requirements, conditions, action items and tags, rendered as Markdown. A rule-based transformer is the fallback.
  - title: No backend
    details: Notes live in the app's own storage. Export to Reminders, Calendar or files; feedback goes through FeedbackKit.
---

## How it fits together

```mermaid
flowchart LR
    W["Apple Watch\n(record .m4a)"] -- "WatchConnectivity" --> P
    K["iPhone: Action Button,\nControl Center, keyboard"] --> P
    subgraph P["iPhone / Mac"]
        A["WhisperKit ASR"] --> L["Qwen3 (MLX)\nstructured JSON"] --> M["Markdown note"]
    end
```

## Working on it

Everything is in [`projects/voxbrief`](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/voxbrief):
an XcodeGen project (`project.yml`) with the iOS app, watch app, widgets, keyboard extension and
the Mac app. Its `CLAUDE.md` has the commands, architecture and the rules that matter (MLX never
runs in the Simulator; every change goes into the in-app What's New).

Releases: `scripts/cut_release.sh voxbrief` from the repo root publishes `voxbrief-v<version>`,
which uploads the iPhone build to TestFlight and attaches a notarized Mac DMG to the release.
