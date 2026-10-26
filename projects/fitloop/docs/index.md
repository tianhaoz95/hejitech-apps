---
layout: home
hero:
  name: "FitLoop"
  text: "Your agent coaches. FitLoop keeps you on the plan."
  tagline: "Claude, Meta's assistant or any MCP agent writes your workouts and meals around your goals, time and limits. Follow them on iPhone, Apple Watch, the web and Even G2 glasses; check in and leave notes as you go; your agent reads it all back and improves the plan."
  image:
    src: /fitloop/icon.png
    alt: FitLoop
  actions:
    - theme: brand
      text: Open FitLoop
      link: https://fitloop.hejitech.workers.dev
    - theme: alt
      text: Decisions
      link: /decisions
    - theme: alt
      text: Deployment
      link: /DEPLOY

features:
  - title: Bring your own agent
    details: FitLoop has no coach of its own. Your agent connects over MCP with OAuth, reads the plan guide and your profile, validates and publishes plan versions, and replies to your notes.
  - title: Mid-set on the G2
    details: The exercise, the set and its target, a rest timer that starts itself, heart rate from your Watch, how-to cues from the ring's menu. Meals check off with a tap.
  - title: Every option a switch
    details: Live heart rate, Apple Health, manual entries and progress photos are each optional, and so is what your agent may see. The defaults save effort.
---

## How it fits together

```
your agent ──MCP (OAuth)──▶ FitLoop Worker ◀── /api ── iPhone (+ Apple Watch: heart rate, set done)
  get_plan_guide, get_profile,     │               ── web app (today, plan, progress, feedback, settings)
  validate/publish_plan,           │               ── Even G2 plugin (R1: check in, timers, notes)
  get_feedback/checkins/vitals,    ▼
  respond_to_feedback       Supabase `fitloop` schema: plans (versions), check-ins, feedback, vitals, photos
```

- **One engine.** `@fitloop/core` holds the plan format and its validator (the agent's rules), the
  day state and adherence, the settings and the glasses' screens with the R1 state machine. The
  Worker, the web app, the plugin and the tests all use it; the iPhone app mirrors its JSON.
- **The agent writes, you adjust.** Plans are versions only the agent publishes. You can skip, swap
  or eat less for a day; that's a check-in the agent reads, never an edit to its plan.
- **Feedback in the moment.** "Too hard", "it hurts", "still hungry" or words, from the glasses'
  menu, any item in the app or the web, tied to the exercise or meal. The agent replies in the app.
