---
layout: home
hero:
  name: "Headway"
  text: "Your next Caltrain, at a glance"
  tagline: "Live Caltrain departures, delays and alerts on Even G2 glasses, steered with the R1 ring, and an iPhone that taps you when your train is late, cancelled, time to leave or a few minutes from your stop."
  image:
    src: /headway/icon.png
    alt: Headway
  actions:
    - theme: brand
      text: Open Headway
      link: https://headway.hejitech.workers.dev
    - theme: alt
      text: Decisions
      link: /decisions
    - theme: alt
      text: Deployment
      link: /DEPLOY

features:
  - title: Your commute by default
    details: Save a morning and an evening pair of stations. Before your switch time the glasses open on the morning trains, after it on the evening ones. No taps on the platform.
  - title: Made for the ring
    details: Swipe through the next trains, tap to flip direction, hold for the menu (track the train you're on, any two stations, alerts), double-tap to exit. One glance.
  - title: Alerts that matter
    details: Delays past your threshold, cancellations, Caltrain's service alerts for your stations, a leave-now reminder for your usual train, and a heads-up before your stop.
---

## How it fits together

```
511.org GTFS-Realtime (Caltrain) ──every 2 min──▶ Headway Worker (cron + snapshot)
Caltrain timetable (compiled into @headway/core) ─┘   ├─ /api/me/board ─▶ Even G2 plugin (R1 gestures)
                                                      ├─ /api/*        ─▶ iPhone app, web settings
                                                      ├─ alert engine  ─▶ APNs ─▶ iPhone (→ glasses via the Even app)
                                                      └─ /mcp          ─▶ your assistant ("when's my next train?")
```

- **One engine.** `@headway/core` holds the compiled timetable, the GTFS-Realtime reader, boards,
  the alert rules and the glasses' screens with the R1 state machine. The Worker, the plugin (offline
  too), the web preview and the tests all use it.
- **Live when it can be.** The Worker fetches Caltrain's trip updates from 511.org every two minutes
  (its token allows 60 requests an hour) and service alerts every ten; boards show `SCHED` when the
  snapshot is older than ten minutes, and the glasses fall back to the bundled timetable offline.
- **Sign in once on the phone.** Google or Apple on the shared HEJI account; the glasses pair with a
  six-digit code and never sign in themselves.
