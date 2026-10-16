---
layout: home
hero:
  name: "Wee Hours"
  text: "A newborn log built for 3am"
  tagline: "Log a feed, diaper or nap in under three seconds, by voice, one tap, a widget, Siri, your watch or your glasses. Voice is understood on the iPhone; nothing is sent off to be interpreted."
  image:
    src: /weehours/icon.png
    alt: Wee Hours
  actions:
    - theme: brand
      text: Visit Wee Hours
      link: https://weehours.hejitech.workers.dev
    - theme: alt
      text: Decisions
      link: /decisions
    - theme: alt
      text: Deployment
      link: /DEPLOY

features:
  - title: Every input, one log
    details: Voice, buttons, widgets, Siri, Apple Watch and the Even Realities G2 + R1 ring all write the same typed, append-only event log, shared by both parents.
  - title: On-device voice
    details: WhisperKit transcribes and Laya, a 0.4B decision model running through llama.cpp on the iPhone, scores predefined options. When it isn't sure, it asks you to pick with one tap.
  - title: Your agent, your answers
    details: The app records facts; an MCP server lets your own AI assistant read and log them. No in-app advice, and no aggregation beyond the one-line status.
---

## What's next, in one line

Every surface shows the same status, derived from the log by the same fixture-locked code in Swift
and TypeScript:

```
Fed 2h40m ago · left next · diaper 1h10m ago
```

## How it fits together

```mermaid
flowchart LR
    subgraph Phone["iPhone (+ widgets, Siri, Watch)"]
        V["Voice: WhisperKit → Laya"] --> L["Event log (SQLite)"]
        T["Tap · widget · Siri"] --> L
    end
    G["G2 glasses + R1 ring"] -- "gestures: events\nvoice: captures" --> S
    L <-- "outbox + seq cursor" --> S["Supabase\n(schema weehours, RLS)"]
    S -- "captures to process" --> V
    A["Your AI assistant"] -- "MCP + OAuth" --> W["Site Worker\n(/mcp)"] --> S
```

- **Local first.** "Use without an account" keeps the household on the phone; signing in later
  uploads it, as a new household or into your partner's.
- **The glasses never run a model.** Gestures write events directly; hold-to-speak uploads a
  capture that a household phone processes later, and two phones converge on the same result.
- **One spec.** `spec/` holds the event types, decision questions, calibration and fixtures that
  the Swift and TypeScript implementations both must pass.

The full design, eval numbers and screenshots are in the
[v0 design walkthrough](https://tianhaoz95.github.io/hejitech-apps/weehours/report/index.html).
Code: [`projects/weehours`](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/weehours).
