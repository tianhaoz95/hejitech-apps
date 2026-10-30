# Decisions

FitLoop was specified and built on 2026-10-25. This page records the owner's choices and the calls
made while building, with the reason for each.

## The owner's choices (2026-10-25)

| Question | Answer |
|---|---|
| What it is | An extension for the user's own AI agent (Claude, Meta Muse, …) to instruct, track and improve their health and fitness: the agent generates the overall plan with daily workouts and diet routines tailored to needs, time, goals and restrictions, and uploads it through MCP (like Waypack and G2 Digest). |
| Surfaces | Web and mobile to view and check in; Even G2 + R1 for workouts and meals (check off, progress, instructions, timers, vitals). Mobile: **iPhone + Apple Watch** (Swift). |
| Feedback | Left right when using it, for the agent to pick up later over MCP. |
| Name | **FitLoop** (`fitloop`, `com.hejitech.fitloop`, tags `fitloop-v`). |
| Vitals | Live heart rate in workouts, a daily Apple Health summary, manual entries and progress photos, **all optional switches with defaults** ("we provide options the user turns on or off, and a default to save effort"). |
| Diet tracking | Check off + adjust: eaten / skipped / swapped, portion less / as planned / more, a note. |
| Plan edits | The agent writes versions; the user adjusts a day (skip, swap, portion), logged as feedback-like check-ins; the agent folds them into the next version. |
| Reminders | Before a workout, at each meal, an evening check-in nudge, a weekly review for the agent: all on by default, all switchable. |
| Sign-in | Google and Apple on the shared HEJI account (as for Headway). |

## Calls made while building

- **The plan is one JSON document per version** (`packages/core/src/types.ts`, format 1): goals,
  constraints the agent planned around, daily targets, a repeating week and dated overrides. A week
  plus overrides covers routines and one-off days without the agent writing every date.
- **A strict validator, glasses-first limits.** Names ≤ 28 characters and cues ≤ 60 so they fit the
  G2; every weekday present; ids kebab-case and unique per day (workouts and meals share one
  namespace so a check-in's `ref` is unambiguous). `publish_plan` refuses plans with errors;
  `validate_plan` also renders what the glasses will show.
- **The guide is served, not remembered** (`get_plan_guide`, `core/src/guide.ts`): the loop (profile
  → feedback and progress → plan → validate → publish → reply), the format and the safety note.
- **Check-ins are append-only; the latest per item wins.** Sets, exercises, workouts and meals,
  each stamped with the plan version in force on that date. A swap or skip is the user's one-day
  adjustment; the weekly review lists them for the agent.
- **Today is computed by the Worker** with core's `dayState` (the iPhone mirrors the JSON), and by
  the plugin locally so the glasses work offline: check-ins and notes queue in the bridge's storage
  and send when the connection is back (gyms have bad signal). A refused one (the plan changed) is
  dropped rather than retried forever.
- **Heart rate path: Watch → iPhone → Worker → glasses.** The Watch runs the HealthKit workout
  session (also saving the workout to Apple Health) and messages heart rate to the iPhone, which
  relays it to `/api/live` at most every 4 s; the glasses poll it every 4 s during a workout. The
  plugin can't talk to the Watch directly.
- **Timers on the glasses step by 5 s until the last 10 s.** Every change is a Bluetooth update; in
  the simulator, per-second updates of a 90 s rest queued up and held back everything else on the
  display (a "sent" confirmation appeared seconds late).
- **Reminders are local notifications** planned from the plan and the switches
  (`FitLoopKit/Reminders.swift`, tested), a week ahead and re-planned on every launch and plan
  change. No push server needed.
- **What the agent sees is the user's call.** `agent_access` switches for check-ins, feedback,
  vitals and photo images; photos are dates only unless allowed, and short-lived signed links when
  allowed. Vitals from a source that's switched off are refused on upload and hidden from the agent.
  Vitals and photo images are off for agents by default (2026-10-29, for App Review): Health data
  reaches an agent only after the user turns it on.
- **The agent may update the "about you" notes** (`update_profile_notes`) so what it learns in one
  chat carries to the next, and to other agents.
- **Glasses text is laid out in pixels** (`core/src/font.ts`: the firmware font's measured glyph
  widths, 9 lines in a bordered frame; core tests check every screen), "Tell agent: …" menu items
  with short tag labels.
- **Even Hub review (2026-10-26):** double-tap on Today (the root page) opens the system exit
  dialog and "Exit FitLoop" is in the menu; menus moved to a hold of the ring (the workout menu
  starts with How-to); double-tap in a workout or meal goes back to Today. Unpaired glasses play a
  demo day from the example plan (nothing sent), and every gesture answers on every screen.
- **No FeedbackKit SDK yet** (needs its own FeedbackKit project and key); in-app feedback here means
  notes for the agent.
- **No medical advice.** FitLoop shows the agent's plan and the user's records; the guide tells the
  agent to send pain, dizziness, chest symptoms or eating concerns to a professional.
