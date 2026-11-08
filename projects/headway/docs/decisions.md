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
- **Tracking is shared.** Tracking from the glasses' menu (hold the ring, then Track), swiping it in the app or asking an assistant
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
- **Live Activity on Lock Screen and Dynamic Island (v0.2.0).** Backed by ActivityKit and the
  HeadwayWidgets app-extension. When tracking starts (on the phone, glasses or assistant),
  ActivityKit tokens are registered in `headway.activity_tokens` (`start` tokens for push-to-start
  and `update` tokens for active sessions). The Worker cron pushes updates and arrival endings as
  `liveactivity` APNs pushes, so the activity stays live throughout the trip without waking the app.
- **Catch it: leave-by times (2026-10-27).** The board answers "when do I have to walk out the door?":
  `leave_by = pred_dep - walk_minutes * 60_000`. Trains are classified into catch states: `leave` (first
  catchable train), `later`, `run` (departure within walk/2 to walk), and `missed` (< walk/2). Custom pairs
  keep minute-until countdowns. On the Even G2 glasses, rows display `go 17m` or `RUN`, the footer hints
  which train to leave for, and the cursor starts on the best train. On iOS, a `CatchCard` counts down with a
  circular ring, and `TrainRow` shows leave-by times with `RUN` alerts.
- **Wait for the express: overtaking tips & better train alerts (2026-10-27).** When mixed service and
  live delays cause a later-departing express train to reach a destination earlier than a delayed train,
  Headway flags the train as overtaken (`t.overtaken_by`), tags the fastest arrival (`first_in`) and
  shortest ride (`shortest`), and highlights an overtaking tip (`board.tip`) saving ≥ 2 minutes. The Even
  G2 footer shows `Wait for 511: beats 113 by 2m`, the iPhone board displays an `InsightBanner` and
  supports Leaving vs Arriving sort, and the alert engine delivers a time-sensitive `better_train` push
  ("take 511 instead") inside the watched commute window.
- **Share my live ETA (2026-10-27).** Riders can share an ephemeral live tracking web link (`/eta/:token`)
  with friends or family directly from the tracked row on the iPhone app (`ShareLink` / share sheet) or MCP
  (`share_eta`). The link resolves without login, showing a mobile-first responsive status card with live
  prediction, delay badge, countdown, upcoming stops progress timeline, and 30-second live polling.
  Security & privacy: URL tokens are 9 base62 characters (~53 bits entropy) hashed with SHA-256 before storage
  in `headway.eta_shares`, with no GPS or location tracking. Links automatically expire 30 minutes after train
  arrival, are instantly revoked upon untracking or starting a new share, and can display an optional user-chosen
  name (customized in Commute settings). Expired rows are cleaned up daily by the Worker cron.
- **No FeedbackKit SDK yet.** It needs a FeedbackKit project and key for Headway; add it with the
  first round of TestFlight feedback.
- **Even Hub review (2026-10-26):** double-tap on the board (the root page) opens the system exit
  dialog and "Exit Headway" is in the menu; the menu moved to a hold of the ring, with "Track
  (the selected train)" first. Unpaired (or with no commute saved) the glasses open on a live San Francisco →
  San José board instead of an empty screen, and every gesture answers. Screens are laid out in
  pixels (`core/src/font.ts`: the firmware font's measured glyph widths, 9 lines in a bordered
  frame).

- **Trip estimate from the rider's location (2026-10-29).** Opt-in on the iPhone (Settings › Location)
  and through the glasses plugin's `location` permission (`bridge.getAppLocation`, low accuracy,
  reused for two minutes). The client sends `lat`/`lon` with the board request; core's
  `travelEstimate` takes the straight-line distance to the departure station × a detour factor ÷ an
  average speed (walk 80 m/min ×1.3 +1 min; drive 500 m/min ×1.4 +5 min for parking, capped at 180),
  per leg `travel_mode` walk | drive. Bike, e-bike and e-scooter added 2026-11-07, same formula with
  city averages including stops: bike 250 m/min (~15 km/h), e-bike 330 (~20 km/h, US pedal assist
  stops helping at 20 mph), e-scooter 270 (~16 km/h), each ×1.3 +2 min to lock up or fold. No routing or traffic API: a rough estimate is the point, and
  nothing about location is stored or logged. The board's `walk_minutes` becomes the estimate (so
  leave-by and catch states follow it) and each train gets `buffer_min`. Leave-now pushes still use the
  leg's `walk_minutes`: the cron has no location, by design.

## Issue #7 (2026-11-06): on the train, late trains, priority alerts

The owner's choices: all three on-train behaviours are options in Settings (`off`, `card` (default),
`auto`, `background`) on every app; the 5 minutes count from your boarding station; non-priority alerts
are quiet and Priority only is the default.

- **Detection is in core and matches trains, not just speed** (`ontrain.ts`). Fast along the line isn't
  enough: a road runs beside it. A fix must also fit a running train's position within 3 minutes (6
  without live data). Only `high` confidence (at a station first, or above road speed) may start
  tracking by itself; `low` says "Looks like".
- **Fixes aren't stored.** They come with a request and go. The match (a trip, no location) lives in KV
  for up to 30 minutes, not a table, so it needs no migration and can't grow into a location history.
- **Stopping auto-tracking sticks for the ride** (`auto_tracked`), and "Not on it" holds 20 minutes.
- **Background on iPhone wakes on significant moves**, then takes 45 seconds of fixes (speed needs a few
  in a row), rather than following continuously: battery, and App Review. Android can only follow from a
  foreground service, so a notification shows while it watches; its session is in memory, so it stops
  with the app process until a sign-in survives one.
- **Lingering is for boards only.** `lingerMs` is set by `board()`; the alert engine still ignores trains
  that left. A board also keeps trains you can't reach from where you are ("Missed"): you may be on the
  platform. They no longer win "First to" or a tip.
- **Priority reads what an alert says.** Feeds only say which stations: a named train, direction, clock
  time or active period that misses your leg makes it non-priority. An alert saying none of those counts,
  so nothing that may matter goes quiet because of its wording.
- **Quiet alerts have their own `q:` keys**, so a train that later becomes priority still gets its normal
  alert. They follow your commute days too: `days` already means "only on these days".

## Watch follows the commute direction (2026-11-07)

The Apple Watch app and its complication used to ask `/api/me/board` for the stations already on
screen, which the Worker treats as a picked pair (`leg: "custom"`): the morning/evening switch never
happened on the watch until the iPhone pushed a fresh board. Now, signed in, they send no stations
unless the rider picked a pair (a flip on the watch, or a custom board synced from the iPhone),
stored as `WatchStore`'s `ManualPick`. A pick lasts two hours (`ManualPick.lifetime`); the iPhone's
`customPair` expires the same way, so an evening flip never holds into the next morning. The iPhone's
commute board, when synced, clears the watch's pick. The watch refreshes whenever it becomes active.
