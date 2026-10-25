# Decisions

Headway was brainstormed and built on 2026-10-24. This page records the owner's choices and the
calls made while building, with the reason for each.

## The owner's choices (2026-10-24)

| Question | Answer |
|---|---|
| What v1 does | Commute card, on-train tracking, service alerts and any-station browse. The morning and evening favorite pairs are the default view, so most days need no input. |
| How stations are set | On a phone (the iPhone app or the web settings page); the glasses pair with a code. |
| Alerts while the plugin is closed | Yes, through an iPhone app: train delayed, cancelled, Caltrain service alerts, leave-now reminder, and a custom "X minutes before arriving". |
| Identity | Google sign-in on the shared HEJI Supabase project (its own `headway` schema). |
| Name | Headway (`headway`, `com.hejitech.headway`, tags `headway-v`). The transit word for the gap between trains, and a nod to a head-up display; not tied to Caltrain's name, so other 511 operators stay possible. |

## Calls made while building

- **Data: Caltrain's timetable compiled in, 511.org for live data.** The static GTFS (Trillium, for
  Caltrain) becomes `packages/core/src/timetable.gen.json` (`scripts/build-timetable.mjs`, ~90 KB):
  boards, the glasses offline and the tests work without any key. Live trip updates and service
  alerts come from 511.org's GTFS-Realtime feeds (`agency=CT`), which need a free token. Without the
  token everything works on the timetable and says so (`SCHED`, "Timetable only").
- **511's limit decides the polling.** 60 requests an hour per token: the Worker's cron fetches trip
  updates every 2 minutes and alerts every 10 (36 an hour) and stores one snapshot for everyone
  (`headway.realtime`); no user request ever reaches 511. Ask 511 for a higher limit, then set
  `REALTIME_EVERY_MIN=1`.
- **A minimal protobuf reader instead of a dependency** (`core/src/gtfsrt.ts`): only the GTFS-RT
  fields Headway reads, tested with an encoder in the same file.
- **Delays propagate down the line** (GTFS-RT rule): a stop without its own update takes the nearest
  earlier stop's delay, then the trip's, then a later stop's. A snapshot older than 10 minutes is
  ignored rather than shown as live.
- **Commute alerts are scoped.** Only on the chosen days, inside each leg's watch window, for the
  next three trains of the leg (a line-wide delay is not one push per train); a worse delay is
  announced again every 5 more minutes. Leave-now targets the first train at or after the leg's
  usual time and fires `walk_minutes` before its predicted departure (no location access). The
  arrival alert follows the tracked train any day. Every notification has a dedupe key
  (`headway.sent_notifications`, recorded before sending).
- **Push straight from the Worker** (APNs token auth, ES256 JWT with WebCrypto). Delays,
  cancellations, leave-now and arrival are time-sensitive notifications; service alerts are ordinary.
  The Even app can mirror iPhone notifications to the glasses, so no glasses-side background work is
  needed.
- **Tracking is shared.** Holding the ring on a train, swiping it in the app or asking an assistant
  all write the same `headway.tracked_trips` row: the glasses show its progress and the iPhone gets
  the arrival alert. It clears itself after arrival.
- **Sign in with Apple too.** The owner chose Google; App Store guideline 4.8 requires an equivalent
  privacy-preserving option when an app offers a third-party login, so the iPhone app also offers
  Apple (the shared project's Apple provider; the bundle id must be in its client ids). The web
  page is Google only.
- **Glasses work unpaired.** Pick any two stations on the glasses and they show that board (public
  `/api/board`); pairing adds the commute and tracking for the phone's alert.
- **Glasses text is ASCII, ≤ 30 characters, ≤ 6 lines** (`core/src/glasses.ts`, tested): the G2
  font's glyph coverage is unverified, so no arrows or bullets. The simulator shows the board at
  about half the screen's width; layout is checked on real glasses before changing it.
- **Everything is written by the Worker.** Clients read only their own rows (RLS); pairing codes,
  the snapshot and the sent log aren't readable at all. Tokens: `hwd_` glasses, `hwa_` assistants
  (hashes only). "Delete my Headway data" removes every row and disconnects assistants; the shared
  sign-in stays (other HEJI apps use it).
- **No Live Activity in v1.** Its updates would need ActivityKit push tokens per activity; the
  tracked row on the Trains tab and the arrival push cover the need for now.
- **No FeedbackKit SDK yet.** It needs a FeedbackKit project and key for Headway; add it with the
  first round of TestFlight feedback.
