---
layout: home
hero:
  name: "Contempo"
  text: "Hours that survive an audit"
  tagline: "An AI-native log for short-term-rental hosts tracking the IRS material-participation tests: say what you did on your phone or watch, and Contempo turns it into a contemporaneous, risk-checked record."
  image:
    src: /contempo/icon.png
    alt: Contempo
  actions:
    - theme: brand
      text: Open Contempo
      link: https://contempo.hejitech.workers.dev
    - theme: alt
      text: Source
      link: https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/contempo

features:
  - title: Capture hands-free
    details: Voice on the phone or the watch, typed quick capture, start/stop timers, GPS mileage trips and photos; on-device Whisper and an on-device LLM parse it, with a cloud fallback.
  - title: Audit-ready records
    details: Every entry carries when it happened and when it was logged; vague or backfilled entries are flagged before they become a problem.
  - title: A copilot that knows the rules
    details: Ask whether something counts, grounded in IRS Pub 925 and §1.469-5T and your own logged hours — with clear limits, not tax advice.
---

## How it fits together

```mermaid
flowchart LR
    A["Android + Wear OS"] --> S["Supabase\n(schema contempo, RLS)"]
    I["iOS + watchOS"] --> S
    W["Web app · admin · feedback"] --> S
    A --> K["Contempo Worker\n(cloud AI, account deletion,\nwatch pairing, Stripe)"]
    I --> K
    W --> K
    K --> S
```

Each user's entries, properties, attachments and captures are their own rows (row-level
security) and files (`<uid>/…` in a private bucket). Details: `projects/contempo/CLAUDE.md`.
