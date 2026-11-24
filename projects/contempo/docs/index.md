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
  - title: 100% On-Device AI & Voice
    details: Voice on the phone or watch, typed quick capture, start/stop timers, GPS mileage trips and photos; transcribed on-device with Whisper or Apple Speech (iOS 26+) and parsed locally with Qwen3 / Gemma — nothing is sent to a cloud LLM.
  - title: Audit-Ready & Proactive
    details: Every entry carries when it happened and when it was logged; vague or backfilled entries are flagged immediately, and daily push nudges warn you before unconfirmed drafts cross the 14-day IRS contemporaneity cliff.
  - title: Connect Your Own AI Assistant (MCP)
    details: Connect Claude or ChatGPT via OAuth 2.1 at /mcp to query 100h / 500h / 750h progress, run audit-risk checks, log entries, and export CPA-ready summaries.
---

## How it fits together

```mermaid
flowchart LR
    A["Android + Wear OS"] --> S["Supabase\n(schema contempo, RLS)"]
    I["iOS + watchOS"] --> S
    W["Web app · admin · feedback"] --> S
    M["AI Assistants (MCP / OAuth 2.1)"] --> K["Contempo Worker\n(MCP, unified Pro, push cron,\nwatch pairing, account deletion)"]
    A --> K
    I --> K
    W --> K
    K --> S
```

Each user's entries, properties, attachments and captures are their own rows (row-level
security) and files (`<uid>/…` in a private bucket). Pro unlocks across iPhone, Android, Web, and
MCP from a single account (App Store, Google Play, Stripe, or an email grant). Details: `projects/contempo/CLAUDE.md`.
