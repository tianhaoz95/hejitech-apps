// Headway Even G2 Smart Glasses UI/UX Candidates Review
// Grounded in projects/headway/ (CLAUDE.md, docs/decisions.md, packages/core/src/glasses.ts,
// packages/core/src/font.ts, packages/core/src/schedule.ts, apps/glasses/src/app.ts & main.ts).

(() => {
  const K = KIT;
  const T = K.trains;
  const gHead = (sub = "LIVE 7:57 AM") => [`${K.leg.fromShort} &gt; ${K.leg.toShort}`, sub];
  const gFoot = K.footGesture;

  // ── Baseline Screen (Candidate 00) ──────────────────────────────────────────
  const baselineLines = [
    gHead(),
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[3], false),
    K.stdRow(T[4], false),
    K.stdRow(T[5], false),
    `! ${K.alert.header.slice(0, 26)}...`,
    gFoot,
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 1: 20 POTENTIAL NEW FEATURES (F01 – F20)
  // ══════════════════════════════════════════════════════════════════════════

  // F01 · Express Overtake Detector
  const f01Lines = [
    gHead(),
    K.stdRow(T[0], false),
    K.stdRow(T[1], true),
    K.stdRow(T[2], false),
    K.stdRow(T[4], false),
    "",
    "&gt;&gt; WAIT FOR 511 EXP: BEATS 113 BY 2M",
    "511 dep 8:36 (12m later) arr SF 9:22",
    gFoot,
  ];

  // F02 · "Leave Now" Walk Countdown HUD
  const f02Lines = [
    ["MTN VIEW &gt; SF", "WALK: 10 MIN"],
    ["LEAVE IN 8 MIN", "for 409 (8:05)"],
    "",
    K.stdRow(T[0], true, "RUN!"),
    K.stdRow(T[1], false, "lv 8:14"),
    K.stdRow(T[2], false, "lv 8:26"),
    K.stdRow(T[4], false, "lv 8:51"),
    "Walk 10m to platform · leave now for 409",
    gFoot,
  ];

  // F03 · Platform & Track Assignment HUD
  const f03Lines = [
    ["MTN VIEW &gt; SF", "PLATFORM TRACKS"],
    { row: ["&gt;", "409", "LTD", "TK 2", "ok", "8m"] },
    { row: [" ", "113", "LOC", "TK 2", "+8", "27m"] },
    { row: [" ", "511", "EXP", "TK 2", "ok", "39m"] },
    { row: [" ", "115", "LOC", " -- ", "CXL", ""] },
    { row: [" ", "413", "LTD", "TK 2", "ok", "1h04"] },
    "",
    "All northbound trains depart Track 2",
    gFoot,
  ];

  // F04 · Car Crowding & Bike Space Telemetry
  const f04Lines = [
    ["409 LTD · 7-CAR EMU", "BIKE CAR: #4"],
    "CROWDING BY CAR (Northbound &gt;):",
    "[■■] [■■] [■□] [BIKE ●●] [■□] [■■] [■■]",
    "Car 1-2: 80% full · Car 3-5: 45% full",
    "Bike car #4: 8/24 rack spaces open",
    "",
    ["NEXT: 113 LOC", "BIKE CAR #3 (FULL)"],
    "Board Cars 3-5 for open seating",
    gFoot,
  ];

  // F05 · Sleep-Safe Wake-Up Alarm Screen
  const f05Lines = [
    ["*** WAKE UP ALERT ***", "R1 VIBRATING"],
    "",
    "&gt;&gt; NEXT STOP IS SAN FRANCISCO &lt;&lt;",
    "Train 409 arriving Track 4 in 4 min",
    "",
    "Gather your belongings &amp; bike",
    "Tap R1 ring to silence alarm",
    "",
    "2x tap: dismiss and exit",
  ];

  // F06 · Cross-Platform Connecting Transit (BART & Muni)
  const f06Lines = [
    ["MILLBRAE TRANSFER", "ARR CALTRAIN 8:37"],
    "CONNECTING BART DEPARTURES (Plat 3):",
    ["&gt; YELLOW to SFO Airport", "8:42 (in 5m)"],
    ["  RED to Richmond / SF", "8:48 (in 11m)"],
    ["  YELLOW to Antioch", "8:57 (in 20m)"],
    "",
    "Cross-platform transfer: Track 2 to 3",
    "Swipe: toggle Muni @ 4th &amp; King",
    "tap: select  hold: menu  2x: exit",
  ];

  // F07 · 4-Way Compass Station Quick-Switcher
  const f07Lines = [
    ["QUICK STATIONS", "RING 4-WAY DIAL"],
    "             [UP] SF (4th &amp; King)",
    "              ▲",
    "[LEFT]        │        [RIGHT]",
    "Mountain View ┼──────── Palo Alto",
    "              ▼",
    "           [DOWN] San Jose Diridon",
    "",
    "Tilt R1 ring in direction to jump",
  ];

  // F08 · Realtime Speedometer & Next Stop Distance
  const f08Lines = [
    ["TRN 409 LTD", "SPEED: 79 MPH"],
    ["NEXT: SAN MATEO", "in 3m (8:32)"],
    "DISTANCE TO STOP: 3.2 MI",
    "────────────────────────────────────────",
    "Route pace: ON SCHEDULE (0.0s drift)",
    "Max speed on line: 79 / 79 mph",
    "Next stop arrival: 8:32:15 AM",
    "",
    "tap: station list  hold: stop tracking",
  ];

  // F09 · Geo-Fenced Clipper Tag-On/Off Reminder
  const f09Lines = [
    ["STATION ARRIVAL", "ZONE 3 &gt; ZONE 1"],
    "",
    "&gt;&gt; REMINDER: TAG OFF CLIPPER &lt;&lt;",
    "Arrived at San Francisco 4th &amp; King",
    "Standard Fare: $6.00 deducted",
    "Tagged on at: Mountain View (Zone 3)",
    "",
    "Card readers located at platform gates",
    "tap: dismiss  2x tap: exit",
  ];

  // F10 · Destination Micro-Climate Weather Glance
  const f10Lines = [
    ["SF ARRIVAL WEATHER", "8:57 AM FORECAST"],
    ["SAN FRANCISCO 4TH", "56°F FOGGY"],
    "Wind: 16 mph WNW · Humidity: 88%",
    "Temp vs Mtn View: -14°F cooler (70°F &gt; 56°F)",
    "Light drizzle expected at King &amp; 4th",
    "",
    "Recommendation: Wear jacket / windbreaker",
    "",
    "tap: return to board  2x: exit",
  ];

  // F11 · Offline Tunnel Timetable Mode
  const f11Lines = [
    ["409 TO SF", "[CACHED TIMETABLE]"],
    "BAYSHORE TUNNEL · NO CELL SIGNAL",
    ["Est Arrival 22nd St:", "8:51 (in 3m)"],
    ["Est Arrival SF 4th:", "8:57 (in 9m)"],
    "Stops left: 2 stops",
    "",
    "Signal lost 42s ago · Using offline clock",
    "Auto-syncing when emerging at 22nd St",
    "hold: menu  2x tap: exit",
  ];

  // F12 · Multi-Leg Door-to-Door Journey Stepper
  const f12Lines = [
    ["COMMUTE ROUTE", "ETA 9:18 AM (SF)"],
    "[1] Walk 10m to Mtn View      7:55 - 8:05",
    "&gt; [2] Caltrain 409 LTD        8:05 - 8:57",
    "[3] Transfer Muni T-Third     9:03 - 9:14",
    "[4] Walk 4m to Office        9:14 - 9:18",
    "",
    "Current leg: [2] On Caltrain (+4m late)",
    "Muni connection safely made (9m buffer)",
    "hold: leg detail  2x: exit",
  ];

  // F13 · Giants & Warriors Game-Day Special Trains
  const f13Lines = [
    ["ORACLE PARK SPECIALS", "SF GIANTS vs LAD"],
    "EXTRA POST-GAME SERVICE TO SAN JOSE:",
    ["&gt; 922 EXP Special", "Departs +15m post-game"],
    ["  924 LOC Special", "Departs +30m post-game"],
    ["  926 EXP Special", "Departs +45m post-game"],
    "",
    "Departs SF 4th &amp; King directly to Diridon",
    "Ballpark special express stops: Millbrae,",
    "San Mateo, Redwood City, Palo Alto, MTV",
  ];

  // F14 · EMU Electric vs Diesel & Power Outlet Status
  const f14Lines = [
    ["EQUIPMENT STATUS", "ELECTRIC FLEET"],
    { row: ["&gt;", "409", "⚡EMU", "8:05", "ok", "Power: YES"] },
    { row: [" ", "113", "🚂DSL", "8:24", "+8", "Power: NO"] },
    { row: [" ", "511", "⚡EMU", "8:36", "ok", "Power: YES"] },
    { row: [" ", "413", "⚡EMU", "9:01", "ok", "Power: YES"] },
    "",
    "⚡EMU = 110V AC + USB-C outlets at every seat",
    "Quiet electric acceleration · Onboard Wi-Fi",
    gFoot,
  ];

  // F15 · Voice Station Input via Glasses Mic
  const f15Lines = [
    ["VOICE STATION PICKER", "EVEN G2 MIC"],
    "",
    "     [🎙️ LISTENING...] Speak station:",
    "",
    "&gt;&gt; HEARD: \"SAN CARLOS\" &lt;&lt;",
    "Found: San Carlos (Zone 2, Stop 14)",
    "",
    "Tap ring to confirm · Swipe to retry",
    "2x tap: cancel and return to board",
  ];

  // F16 · Minimalist Peripheral Quiet-Glance Mode
  const f16Lines = [
    "",
    "",
    "",
    "",
    ["", "409 LTD: 8m · OK &gt;"],
    "",
    "",
    "",
    "",
  ];

  // F17 · Historical On-Time Reliability Badge
  const f17Lines = [
    ["RELIABILITY (30-DAY)", "MTN VIEW &gt; SF"],
    { row: ["&gt;", "409", "LTD", "94% ON-TIME", "avg +1m"] },
    { row: [" ", "113", "LOC", "71% ON-TIME", "avg +7m"] },
    { row: [" ", "511", "EXP", "98% ON-TIME", "avg 0m"] },
    { row: [" ", "413", "LTD", "91% ON-TIME", "avg +2m"] },
    "",
    "Tip: 113 frequently delayed by freight",
    "511 Express has highest reliability score",
    gFoot,
  ];

  // F18 · 1-Gesture ETA Dispatch to Contact
  const f18Lines = [
    ["DISPATCH LIVE ETA", "VIA IPHONE APNs"],
    "",
    "&gt;&gt; SMS SENT TO SARAH: &lt;&lt;",
    "\"On Caltrain 409 to SF. Arriving 8:57 AM",
    "(running 4m late). See you at King St!\"",
    "",
    "Trigger: 3x tap on R1 ring while tracking",
    "Contact set in Headway iOS Settings",
    "tap: dismiss  2x tap: return",
  ];

  // F19 · Station Outage & Facility Status (Elevators)
  const f19Lines = [
    ["STATION ACCESSIBILITY", "SF 4TH &amp; KING"],
    "FACILITY ALERTS (Live Caltrain Feed):",
    "⚠️ ELEVATOR #2 (King St Entrance) OUT",
    "Alternative: 4th St Ramp fully accessible",
    "Restrooms: Open (Track 1 concourse)",
    "Bike Parking: Electronic Lockers 14 avail",
    "",
    "Updated 6m ago from Caltrain Operations",
    "tap: back  2x tap: exit",
  ];

  // F20 · Head-Tilt / Glance Gesture Wake & Sleep
  const f20Lines = [
    ["POWER SAVER HUD", "BATTERY: 84%"],
    "",
    "DISPLAY SLEEP: Active (Waveguide OFF)",
    "Auto-wake: Tilt head up +12° or tap R1",
    "Screen active time: 4s per glance",
    "",
    "Estimated glasses runtime: 18.5 hours",
    "(Standard continuous mode: 3.5 hours)",
    "tap: wake  hold: disable power saver",
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 2: 20 POTENTIAL IMPROVEMENTS (I01 – I20)
  // ══════════════════════════════════════════════════════════════════════════

  // I01 · Proportional Font Pixel-Grid Aligner
  const i01Lines = [
    ["MTN VIEW &gt; SF", "CALIBRATED COLS"],
    "TRN │ KIND │ DEPART │ STATUS │ COUNTDOWN",
    "────┼──────┼────────┼────────┼──────────",
    "&gt;409│ LTD  │  8:05  │  +4m   │    8m",
    " 113│ LOC  │  8:24  │  +8m   │   27m",
    " 511│ EXP  │  8:36  │   ok   │   39m",
    " 115│ LOC  │  8:46  │  CXL   │   ---",
    " 413│ LTD  │  9:01  │  sched │  1h04",
    gFoot,
  ];

  // I02 · High-Glanceability 1-Train Hero Layout
  const i02Lines = [
    ["NEXT DEPARTURE", "MTN VIEW &gt; SF"],
    ["409 LIMITED", "IN 8 MIN"],
    ["Departs 8:05 AM (+4m)", "Arrives SF 8:57"],
    "────────────────────────────────────────",
    ["Following: 113 LOC", "8:24 (+8m) in 27m"],
    ["Following: 511 EXP", "8:36 (ok)  in 39m"],
    "",
    "Single-glance view for walking to platform",
    gFoot,
  ];

  // I03 · R1 Double-Tap Accidental Exit Safeguard
  const i03Lines = [
    gHead(),
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    "",
    "⚠️ EXIT HEADWAY? Tap to stay (3s)",
    "Double tap again to confirm exit",
    "",
    "Prevents accidental closes while running",
  ];

  // I04 · Scheduled vs Live Delay Diff Notation
  const i04Lines = [
    gHead(),
    { row: ["&gt;", "409", "LTD", "8:01 ➔ 8:05", "+4m", "8m"] },
    { row: [" ", "113", "LOC", "8:16 ➔ 8:24", "+8m", "27m"] },
    { row: [" ", "511", "EXP", "8:36 (on time)", "ok", "39m"] },
    { row: [" ", "115", "LOC", "8:46 CANCELLED", "CXL", "---"] },
    { row: [" ", "413", "LTD", "9:01 (sched)", "ok", "1h04"] },
    "",
    "Explicit timetable ➔ live prediction diff",
    gFoot,
  ];

  // I05 · Visual ASCII Linear Route Tracker
  const i05Lines = [
    ["TRN 409 TO SF", "+4m LATE · 8:30 AM"],
    "ROUTE PROGRESS (5 stops left):",
    "MTV──PA──RC──HL──●SM──MB──SSF──22──SF",
    " [Past]          ▲Now    [Remaining] ",
    ["Next: San Mateo (8:32)", "Arrive SF: 8:57"],
    "",
    "● = Current location between HL &amp; SM",
    "hold: stop tracking  2x: back to board",
    gFoot,
  ];

  // I06 · Geographic (North-to-South) Station Picker
  const i06Lines = [
    ["PICK STATION", "ZONE 3 (MID-PENINSULA)"],
    "  [Zone 2] Belmont · San Carlos · RWC",
    "&gt; [Zone 3] Redwood City (RWC)",
    "  [Zone 3] Menlo Park",
    "  [Zone 3] Palo Alto (University Ave)",
    "  [Zone 3] California Ave",
    "  [Zone 3] San Antonio",
    "  [Zone 3] Mountain View",
    "swipe: scroll along track  tap: select",
  ];

  // I07 · Smart Time-of-Day Direction Auto-Default
  const i07Lines = [
    ["MTN VIEW &gt; SF", "[AUTO: MORNING COMMUTE]"],
    "Auto-selected Northbound (7:57 AM)",
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[3], false),
    K.stdRow(T[4], false),
    "Tap to flip Southbound  hold: disable auto",
    gFoot,
  ];

  // I08 · Centered HUD Action Toasts with Micro-Icons
  const i08Lines = [
    gHead(),
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[3], false),
    K.stdRow(T[4], false),
    K.stdRow(T[5], false),
    `! ${K.alert.header.slice(0, 26)}...`,
    gFoot,
  ];

  // I09 · 3-Item Contextual Ring Radial Menu
  const i09Lines = [
    ["QUICK MENU", "TAP TO RUN · 2x: BACK"],
    "",
    "&gt; [1] TRACK 409 LTD (Departs 8:05)",
    "  [2] FLIP DIRECTION (SF &gt; MTN VIEW)",
    "  [3] PICK STATIONS",
    "",
    "Streamlined from 7 items down to 3",
    "Fast 1-swipe selection with R1 ring",
    "2x tap: return to departure board",
  ];

  // I10 · Live Data Age & Stale Feed Heartbeat
  const i10Lines = [
    ["MTN VIEW &gt; SF", "● LIVE (sync 12s ago)"],
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[3], false),
    K.stdRow(T[4], false),
    "",
    "Feed heartbeat: 511.org GTFS-RT healthy",
    "Pulsing dot shows real-time connection",
    gFoot,
  ];

  // I11 · Cancelled Train Inline Replacement Recommendation
  const i11Lines = [
    gHead(),
    K.stdRow(T[0], false),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    { row: ["&gt;", "115", "LOC", "CXL", "➔ TAKE 511", "at 8:36"] },
    K.stdRow(T[4], false),
    "",
    "Train 115 is cancelled: 511 Express is",
    "recommended replacement (departs +12m)",
    gFoot,
  ];

  // I12 · Waveguide Edge Inset Padding Calibration
  const i12Lines = [
    ["  MTN VIEW &gt; SF", "LIVE 7:57 AM  "],
    { row: ["  &gt;", "409", "LTD", "8:05", "ok", "8m  "] },
    { row: ["   ", "113", "LOC", "8:24", "+8", "27m  "] },
    { row: ["   ", "511", "EXP", "8:36", "ok", "39m  "] },
    { row: ["   ", "115", "LOC", "8:46", "CXL", "--  "] },
    { row: ["   ", "413", "LTD", "9:01", "ok", "1h04 "] },
    "",
    "  36px optical inset: prevents chromatic",
    "  fringing at waveguide prism corners",
  ];

  // I13 · 2-Line Smart-Wrapped Alert Banner
  const i13Lines = [
    gHead(),
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[4], false),
    "────────────────────────────────────────",
    "⚠️ ALERT: Train 115 cancelled this AM.",
    "Mechanical issue. Riders take 511 or 413.",
    "hold: full alert details  2x: exit",
  ];

  // I14 · Dual-Station Board for Border Commuters
  const i14Lines = [
    ["MTN VIEW &amp; SUNNYVALE", "COMBINED BOARD"],
    { row: ["&gt;", "409", "MTV", "8:05", "+4m", "8m"] },
    { row: [" ", "409", "SNY", "8:10", "+4m", "13m"] },
    { row: [" ", "113", "MTV", "8:24", "+8m", "27m"] },
    { row: [" ", "113", "SNY", "8:30", "+8m", "33m"] },
    { row: [" ", "511", "MTV", "8:36", "ok", "39m"] },
    "",
    "Shows next departures from both stations",
    gFoot,
  ];

  // I15 · High-Contrast Train Kind Glyphs (EXP vs LOC)
  const i15Lines = [
    gHead(),
    { row: ["&gt;", "409", "&lt;LTD&gt;", "8:05", "+4", "8m"] },
    { row: [" ", "113", " LOC ", "8:24", "+8", "27m"] },
    { row: [" ", "511", "[EXP]", "8:36", "ok", "39m"] },
    { row: [" ", "115", " LOC ", "8:46", "CXL", "---"] },
    { row: [" ", "413", "&lt;LTD&gt;", "9:01", "ok", "1h04"] },
    "",
    "[EXP] Express · &lt;LTD&gt; Limited · LOC Local",
    gFoot,
  ];

  // I16 · Large Countdown-to-Stop in Tracking View
  const i16Lines = [
    ["TRN 409 TO SF", "ARRIVE 8:57 AM"],
    "",
    "&gt;&gt;&gt; 2 STOPS REMAINING &lt;&lt;&lt;",
    "Next: 22nd Street (8:51 AM)",
    "Destination: San Francisco 4th &amp; King",
    "",
    "Arriving in 14 minutes (+4m delay)",
    "Get ready if exiting at 22nd St",
    "hold: stop tracking  2x: back to board",
  ];

  // I17 · Twilight / Night HUD Brightness Preset
  const i17Lines = [
    ["MTN VIEW &gt; SF", "NIGHT PROFILE (30%)"],
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[4], false),
    "",
    "Low-lumens phosphor profile active",
    "Prevents night glare in dark train cars",
    "hold: toggle daytime brightness",
  ];

  // I18 · Auto-Hiding Gesture Hints (+1 Train Row)
  const i18Lines = [
    gHead(),
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[3], false),
    K.stdRow(T[4], false),
    K.stdRow(T[5], false),
    { row: [" ", "119", "LOC", "9:46", "ok", "1h49"] },
    "[Gesture hints hidden after 10 sessions]",
  ];

  // I19 · Adaptive Time Units (Minutes vs Clock)
  const i19Lines = [
    gHead(),
    { row: ["&gt;", "409", "LTD", "in 8 min", "ok", "URGENT"] },
    { row: [" ", "113", "LOC", "in 27 min", "+8", "LEAVE"] },
    { row: [" ", "511", "EXP", "at 8:36 AM", "ok", "39m"] },
    { row: [" ", "413", "LTD", "at 9:01 AM", "ok", "1h04"] },
    { row: [" ", "117", "LOC", "at 9:16 AM", "ok", "1h19"] },
    "",
    "&lt;30m shows relative countdown (in 8 min)",
    "&gt;30m shows departure clock time (9:01 AM)",
    gFoot,
  ];

  // I20 · Optimistic Offline-to-Online Recovery
  const i20Lines = [
    ["MTN VIEW &gt; SF", "RECONNECTING... ⚡"],
    K.stdRow(T[0], true),
    K.stdRow(T[1], false),
    K.stdRow(T[2], false),
    K.stdRow(T[4], false),
    "",
    "Cached state held seamlessly during reconnect",
    "No screen flicker or loading spinners",
    "Syncing new predictions in background",
    gFoot,
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // CANDIDATES CATALOG CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════

  window.REVIEW = {
    key: "2026-10-26-headway-glasses-review-v1",
    dir: "reports/2026-10-26-headway-glasses-review",
    repo: "tianhaoz95/hejitech-apps",
    port: 8814,
    project: "projects/headway",
    context: [
      "projects/headway/CLAUDE.md",
      "projects/headway/packages/core/src/glasses.ts",
      "projects/headway/packages/core/src/font.ts",
      "projects/headway/apps/glasses/src/app.ts",
      "projects/headway/services/web/src/worker/cron.ts",
    ],
    brief: "Headway Even G2 glasses UI/UX: propose 20 potential new features and 20 potential improvements for Caltrain commuters using Even G2 smart glasses and R1 ring.",
    title: "Headway Even G2 Glasses UI/UX Candidates",
    subtitle: "40 proposals (20 new features + 20 improvements) + baseline HUD",
    heading: "Even G2 Smart Glasses HUD Directions",
    intro: "Proposals for Caltrain commuters wearing Even G2 glasses and R1 ring. Each mock renders directly in the Even G2's native 576×288 micro-OLED heads-up display. Heart favorites, rate candidates, leave review notes on cards, and click <b>Copy summary</b> to export the hand-off.",
    legend: ["<b>576×288</b> HUD Micro-OLED", "<b>9 lines</b> display grid", "<b>R1 ring</b> gesture navigation"],
    round: 1,
    frame: "card",
    size: [576, 288],
    modes: false,
    groups: [
      {
        id: "features",
        name: "20 Potential New Features",
        note: "Novel smart-glasses capabilities, live trip tools, and heads-up contextual workflows",
      },
      {
        id: "improvements",
        name: "20 Potential Improvements",
        note: "Readability, typography, ring ergonomics, glanceability, and layout polish for existing screens",
      },
    ],
    candidates: [
      // ── Baseline (Candidate 00) ───────────────────────────────────────────
      {
        id: "c00-baseline",
        n: 0,
        group: "features",
        name: "Today's Glasses HUD",
        baseline: true,
        tagline: "Current 9-line Caltrain board with cursor and gesture footer",
        concept: "The existing Headway Even G2 screen from packages/core/src/glasses.ts. Displays 6 departure rows with cursor indicator, delayed status (+4, ok, CXL), line alert, and ring gesture hints.",
        moves: ["9-line proportional text frame", "Up/Down ring scrolls cursor", "Tap flips direction", "Hold opens menu", "Double-tap exits plugin"],
        facts: { Type: "Proportional ASCII", Effort: "Baseline", Needs: "Already in production" },
        render: () => K.screen(baselineLines),
        spec: {
          today: ["packages/core/src/glasses.ts boardLines() generates 9 lines", "apps/glasses/src/main.ts renders text container via Even SDK"],
          proposed: ["Serves as reference baseline for all 40 proposed directions"],
          files: ["projects/headway/packages/core/src/glasses.ts", "projects/headway/apps/glasses/src/main.ts"],
          risks: ["None (current production code)"],
          verify: ["npm run test:headway verifies 9-line fitting in tests"],
        },
      },

      // ── GROUP 1: 20 POTENTIAL NEW FEATURES ────────────────────────────────
      {
        id: "f01-overtake",
        n: 1,
        group: "features",
        name: "Express Overtake Detector",
        tagline: "Smart HUD banner: 'Wait for 511 Express: beats 113 by 2m'",
        concept: "When a local train is delayed, an express train leaving 12 minutes later will often overtake it and reach San Francisco sooner. The HUD compares arrival predictions and alerts the commuter to wait for the faster train.",
        moves: ["Compares destination arrival times across all upcoming trains", "Detects when later train arrives earlier", "Displays prominent overtake recommendation", "Prevents boarding slower delayed trains"],
        facts: { Type: "Smart Trip Advisory", Effort: "M", Needs: "Core overtake calculation helper" },
        render: () => K.screen(f01Lines),
        spec: {
          today: ["Schedule engine calculates departures independently without cross-comparing arrival predictions"],
          proposed: ["Add findOvertake(board: Board) in core/src/schedule.ts that checks if train[i].pred_arr > train[j].pred_arr where j > i", "Render overtake callout on lines 6-7"],
          files: ["projects/headway/packages/core/src/schedule.ts", "projects/headway/packages/core/src/glasses.ts"],
          risks: ["Rider might wait for an express that also gets delayed; requires live feed stability"],
          verify: ["Unit test in schedule.test.ts comparing 113 (arr 9:24) with 511 (arr 9:22)"],
        },
      },
      {
        id: "f02-leave-timer",
        n: 2,
        group: "features",
        name: "\"Leave Now\" Walk Countdown HUD",
        tagline: "Walking countdown right on glasses: 'Leave in 8 min for 409'",
        concept: "Syncs rider's saved walking distance from iOS settings (e.g. 10m walk to Mountain View station). Dynamically subtracts walking time from live departure time and displays countdown banner so riders never miss their train.",
        moves: ["Live departure minus walk duration", "Shows 'RUN!' when departure is within walk time", "Replaces static header with dynamic leave time", "Updates automatically when train delays change"],
        facts: { Type: "Time-to-Walk HUD", Effort: "S", Needs: "Settings walk_minutes in World object" },
        render: () => K.screen(f02Lines),
      },
      {
        id: "f03-platform-track",
        n: 3,
        group: "features",
        name: "Platform & Track Assignment HUD",
        tagline: "Live track numbers: 'TK 2' so commuters skip physical monitors",
        concept: "At multi-track stations (Diridon, Millbrae, 4th & King), commuters waste time searching for platform overhead monitors. Displays live track assignments directly in a dedicated column on the glasses.",
        moves: ["Adds dedicated track column [TK 1 / TK 2]", "Highlights platform changes with inverted badge", "Shows station track summary line in footer", "Extracts track from 511.org GTFS-RT stop_headsign or platform_id"],
        facts: { Type: "Station Wayfinding", Effort: "M", Needs: "511 GTFS-RT stop assignment ingestion" },
        render: () => K.screen(f03Lines),
      },
      {
        id: "f04-crowding-bike",
        n: 4,
        group: "features",
        name: "Car Crowding & Bike Space Telemetry",
        tagline: "Visual 7-car EMU consist with bike car rack availability",
        concept: "Stadler KISS electric EMUs broadcast onboard weight sensors per car and bike car occupancy. Shows a 7-car ASCII diagram indicating which cars have open seats and bike spaces before the train pulls into the station.",
        moves: ["7-car train consist diagram [■■][■□][BIKE ●]", "Occupancy percentage per car", "Available bike rack counter (8/24 open)", "Advises which boarding position to stand at on platform"],
        facts: { Type: "Vehicle Telemetry", Effort: "L", Needs: "Caltrain vehicle occupancy GTFS-RT feed" },
        render: () => K.screen(f04Lines),
        spec: {
          today: ["Headway only parses GTFS-RT TripUpdates, not VehiclePositions or OccupancyStatus"],
          proposed: ["Parse OccupancyStatus enum in gtfsrt.ts and expose car-level array in BoardTrain", "Render ASCII consist block diagram on line 3"],
          files: ["projects/headway/packages/core/src/gtfsrt.ts", "projects/headway/packages/core/src/types.ts", "projects/headway/packages/core/src/glasses.ts"],
          risks: ["Not all Caltrain consists report car-level occupancy; fallback to train-level estimate"],
          verify: ["Mock GTFS-RT protobuf feed containing OccupancyStatus values in test suite"],
        },
      },
      {
        id: "f05-sleep-alarm",
        n: 5,
        group: "features",
        name: "Sleep-Safe Wake-Up Alarm Screen",
        tagline: "Vibration and inverted HUD flash 1 stop before your destination",
        concept: "Commuters frequently nap during the 50-minute Peninsula ride. When the tracked train departs the penultimate station (e.g. 22nd Street before SF), the glasses invert to bright green and pulse the R1 ring to wake the rider.",
        moves: ["Automatic trigger when stops_left === 1", "Inverted high-visibility contrast flash", "Continuous R1 ring haptic pulse", "Single ring tap silences and returns to normal board"],
        facts: { Type: "In-Transit Wake Up", Effort: "S", Needs: "R1 ring haptic API in Even SDK" },
        render: () => K.screen(f05Lines, { inverted: true }),
      },
      {
        id: "f06-transit-connect",
        n: 6,
        group: "features",
        name: "Connecting Transit HUD (BART & Muni)",
        tagline: "Cross-platform connection countdowns at Millbrae & SF 4th",
        concept: "When arriving at Millbrae (BART connection to SFO) or 4th & King (Muni Metro T-Third/N-Judah), displays next 3 connecting departures so commuters know whether to sprint across the platform.",
        moves: ["Cross-platform transfer board for Millbrae / 4th & King", "Synchronized BART / Muni departure countdowns", "Platform transfer directions", "Swipe gesture switches between transit agencies"],
        facts: { Type: "Multi-Agency Transit", Effort: "L", Needs: "511.org BART / SFMTA API integration" },
        render: () => K.screen(f06Lines),
      },
      {
        id: "f07-radial-quick-stations",
        n: 7,
        group: "features",
        name: "4-Way Compass Station Quick-Switcher",
        tagline: "Jump to 4 favorite stations via R1 ring cardinal directions",
        concept: "Scrolling through 31 Caltrain stations with ring swipes is tedious. Maps 4 primary anchor stations (SF, Palo Alto, Mountain View, San Jose) to Up/Right/Left/Down ring tilts for instantaneous 1-gesture switching.",
        moves: ["Visual 4-way compass dial overlay", "Up: SF, Right: Palo Alto, Left: MTV, Down: Diridon", "Selects station pair in under 1 second", "Double tap returns to standard board"],
        facts: { Type: "Ring Ergonomics", Effort: "M", Needs: "2-axis gesture support or flick classifier" },
        render: () => K.screen(f07Lines),
      },
      {
        id: "f08-speedometer-hud",
        n: 8,
        group: "features",
        name: "Realtime Speedometer & Distance HUD",
        tagline: "Live train velocity (79 mph) and miles to next station",
        concept: "For transit enthusiasts and riders tracking trip velocity on the newly electrified 79-mph line. Computes speed from sequential GTFS-RT GPS vehicle positions and displays miles remaining to the next stop.",
        moves: ["79 mph live speedometer readout", "Distance to next station in miles", "Schedule variance (on schedule / seconds drift)", "Max line speed gauge"],
        facts: { Type: "Telemetry HUD", Effort: "M", Needs: "VehiclePositions latitude/longitude delta" },
        render: () => K.screen(f08Lines),
      },
      {
        id: "f09-fare-clipper-tag",
        n: 9,
        group: "features",
        name: "Geo-Fenced Clipper Tag-Off Reminder",
        tagline: "Automatic heads-up reminder to tag off Clipper on arrival",
        concept: "Caltrain charges maximum fare if riders forget to tag off their Clipper card at their destination. Detects arrival via geofence and presents a heads-up reminder with exact zone fare calculated.",
        moves: ["Geofence trigger upon arriving at destination", "Shows calculated zone fare ($6.00 for Zone 3 ➔ 1)", "Platform card reader location guide", "Dismisses on ring tap or walking 100m away"],
        facts: { Type: "Smart Commute Alert", Effort: "S", Needs: "iOS app sends arrival notification bridge event" },
        render: () => K.screen(f09Lines),
      },
      {
        id: "f10-destination-weather",
        n: 10,
        group: "features",
        name: "Destination Micro-Climate Weather Glance",
        tagline: "SF 4th & King arrival weather: 56°F foggy wind vs 70°F MTV",
        concept: "Bay Area microclimates vary wildly (sunny in Mountain View, foggy and freezing at 4th & King). Shows destination weather forecast for the exact train arrival minute so commuters prepare their jackets before getting off.",
        moves: ["Arrival station temperature and conditions", "Temperature difference comparison (-14°F cooler)", "Wind speed and drizzle alert", "Jacket / umbrella recommendation"],
        facts: { Type: "Ambient Context", Effort: "S", Needs: "NOAA / Open-Meteo worker integration" },
        render: () => K.screen(f10Lines),
      },
      {
        id: "f11-offline-tunnel",
        n: 11,
        group: "features",
        name: "Offline Tunnel Timetable Mode",
        tagline: "Automatic transition to offline clock during Bayshore tunnels",
        concept: "Cellular connection drops entering the Bayshore and South SF rail tunnels. Instead of showing an error or stale spinner, the glasses seamlessly switch to offline dead-reckoning timetable estimates.",
        moves: ["Detects cellular drop in tunnel", "Switches badge to [CACHED TIMETABLE]", "Counts down based on local device clock", "Smoothly reconciles live data once exiting tunnel"],
        facts: { Type: "Offline Resilience", Effort: "S", Needs: "Local timer in glasses app.ts" },
        render: () => K.screen(f11Lines),
      },
      {
        id: "f12-multi-leg-chain",
        n: 12,
        group: "features",
        name: "Multi-Leg Door-to-Door Journey Stepper",
        tagline: "Full commute chain: Walk ➔ Caltrain ➔ Muni ➔ Office",
        concept: "Commuters don't just ride the train; they navigate a 4-leg trip. Displays a unified stepper showing walk to station, train leg, connecting transit, and final walk with overall door-to-door arrival ETA.",
        moves: ["4-leg commute chain overview", "Highlights active leg with cursor", "Displays overall 9:18 AM office ETA", "Calculates buffer time for connections"],
        facts: { Type: "Trip Chain Engine", Effort: "M", Needs: "Commute settings extended with transfer leg" },
        render: () => K.screen(f12Lines),
      },
      {
        id: "f13-special-events",
        n: 13,
        group: "features",
        name: "Giants & Warriors Game-Day Special Trains",
        tagline: "Oracle Park & Chase Center post-game express service board",
        concept: "Caltrain runs special non-timetable post-game express trains after Giants games at Oracle Park. Shows dedicated post-game departure board with departure windows (e.g. 15m post-game) and express stop list.",
        moves: ["Game-day special express banner", "Post-game rolling departure schedule", "Oracle Park express stop list", "Direct shortcut to post-game trains"],
        facts: { Type: "Special Event Service", Effort: "S", Needs: "Caltrain special event feed annotation" },
        render: () => K.screen(f13Lines),
      },
      {
        id: "f14-train-consist",
        n: 14,
        group: "features",
        name: "EMU Electric vs Diesel Equipment Badge",
        tagline: "Identify new electric EMUs (⚡EMU) with 110V/USB-C seat power",
        concept: "Riders prefer the new Stadler electric trains over legacy diesel gallery cars for quieter rides and in-seat power outlets. Tags each train with equipment type and power outlet availability.",
        moves: ["⚡EMU vs 🚂DSL equipment indicator", "Power outlet availability tag (110V + USB-C)", "Quiet car and Wi-Fi readiness indicators", "Equipment details fetched from Caltrain GTFS vehicle feed"],
        facts: { Type: "Fleet Equipment", Effort: "S", Needs: "Block ID or consist mapping" },
        render: () => K.screen(f14Lines),
      },
      {
        id: "f15-voice-station-mic",
        n: 15,
        group: "features",
        name: "Voice Station Input via Glasses Mic",
        tagline: "Hold ring and speak: 'San Carlos' to pick destination",
        concept: "Uses the Even G2's built-in dual microphones. Holding the R1 ring opens a listening overlay; speaking any Caltrain station name transcribes audio on the iPhone companion app and immediately switches the board.",
        moves: ["Built-in glasses mic audio capture", "Speech-to-text fuzzy station matcher", "Visual listening state HUD", "Replaces 31-item manual scroll with 2-second speech"],
        facts: { Type: "Voice Modality", Effort: "L", Needs: "Even SDK audio streaming to iPhone" },
        render: () => K.screen(f15Lines),
      },
      {
        id: "f16-quiet-glance",
        n: 16,
        group: "features",
        name: "Minimalist Peripheral Quiet-Glance Mode",
        tagline: "1-line peripheral green pill: zero distraction while walking",
        concept: "Full 9-line screens can be obtrusive while walking down crowded streets. Collapses the display into a single peripheral line in the upper-right corner showing only train number, countdown, and status.",
        moves: ["Ultra-minimalist 1-line peripheral layout", "Leaves central field of view completely transparent", "Displays train, countdown, and status", "Swipe ring down to expand full 9-line board"],
        facts: { Type: "Minimalist HUD", Effort: "S", Needs: "Peripheral display mode CSS layout" },
        render: () => K.screen(f16Lines, { peripheral: true }),
      },
      {
        id: "f17-reliability-stats",
        n: 17,
        group: "features",
        name: "Historical On-Time Reliability Badge",
        tagline: "30-day on-time percentage: '511 EXP: 98% on-time'",
        concept: "Certain trains (like 113) suffer persistent freight dispatching delays, while 511 Express has a 98% on-time record. Displays 30-day reliability metrics so commuters pick the most dependable train.",
        moves: ["30-day on-time percentage per train", "Average delay minutes calculation", "Highlights freight-delay prone trains", "Helps riders make informed departure choices"],
        facts: { Type: "Reliability Analytics", Effort: "M", Needs: "Worker historical delay table snapshot" },
        render: () => K.screen(f17Lines),
      },
      {
        id: "f18-share-eta-gesture",
        n: 18,
        group: "features",
        name: "1-Gesture ETA Dispatch to Contact",
        tagline: "Triple-tap ring sends live ETA SMS to spouse or colleague",
        concept: "While riding the train, triple-tapping the R1 ring triggers an automated iMessage/SMS to a configured contact with current live arrival ETA and delay status, without pulling out the phone.",
        moves: ["Triple-tap gesture trigger on R1 ring", "Composes dynamic SMS with live ETA and train number", "Sends via iPhone Background Notification Service", "Displays confirmation toast on glasses HUD"],
        facts: { Type: "Social Commute", Effort: "M", Needs: "iOS MessageUI / Shortcuts integration" },
        render: () => K.screen(f18Lines),
      },
      {
        id: "f19-station-facility",
        n: 19,
        group: "features",
        name: "Station Outage & Facility Status HUD",
        tagline: "Live elevator outage and bike electronic locker status",
        concept: "Elevator outages at stations pose major accessibility barriers for wheelchair riders and cyclists. Ingests Caltrain facility alerts and shows active elevator outages and available bike lockers at arrival station.",
        moves: ["Elevator outage warnings (e.g. King St Elevator OUT)", "Accessible ramp alternative wayfinding", "Available electronic bike locker counter", "Auto-filters alerts relevant to arrival destination"],
        facts: { Type: "Accessibility & Facilities", Effort: "S", Needs: "Caltrain elevator advisory feed" },
        render: () => K.screen(f19Lines),
      },
      {
        id: "f20-tilt-battery-saver",
        n: 20,
        group: "features",
        name: "Head-Tilt / Glance Gesture Wake & Sleep",
        tagline: "Waveguide powers off until +12° head tilt: 18h battery life",
        concept: "Even G2 battery drains rapidly if the micro-OLED runs continuously. Automatically blanks the display until the rider tilts their head up slightly (+12°) or taps the ring, extending battery life from 3.5h to over 18 hours.",
        moves: ["Accelerometer head-tilt wake trigger", "Automatic sleep after 4 seconds of inactivity", "Shows battery percentage and power saver status", "Triples smart glasses operational lifespan"],
        facts: { Type: "Power Optimization", Effort: "M", Needs: "Even SDK accelerometer orientation events" },
        render: () => K.screen(f20Lines),
      },

      // ── GROUP 2: 20 POTENTIAL IMPROVEMENTS ────────────────────────────────
      {
        id: "i01-proportional-grid",
        n: 21,
        group: "improvements",
        name: "Proportional Font Pixel-Grid Aligner",
        tagline: "Vertical grid dividers and calibrated proportional padding",
        concept: "The firmware's proportional font causes numbers and columns to wobble horizontally as digits change width (e.g. '1' is 7px, '0' is 12px). Uses explicit vertical separator dividers and monospace tabular alignment to ensure razor-sharp columns.",
        moves: ["Calibrated vertical column dividers (│)", "Fixed pixel-width column reservations", "Eliminates wavy jagged column edges", "Significantly improves at-a-glance readability"],
        facts: { Type: "Typography / Alignment", Effort: "S", Needs: "Refined padPx() in packages/core/src/font.ts" },
        render: () => K.screen(i01Lines, { frameCls: "mono-table" }),
        spec: {
          today: ["packages/core/src/font.ts padPx pads spaces, but proportional font space is only 5px wide, causing rounding drift"],
          proposed: ["Introduce monospace tabular number formatting or explicit separator ticks", "Lock column boundaries in font.ts"],
          files: ["projects/headway/packages/core/src/font.ts", "projects/headway/packages/core/src/glasses.ts"],
          risks: ["Divider characters consume 4px width; must balance within 528px line width"],
          verify: ["Run test-glasses layout assertions to ensure 0 clipped lines"],
        },
      },
      {
        id: "i02-hero-glance",
        n: 22,
        group: "improvements",
        name: "High-Glanceability 1-Train Hero Layout",
        tagline: "Dominant double-height 'Next Train' card with secondary queue",
        concept: "Commuters walking briskly through a crowded station cannot read a 6-row dense table. Promotes the immediate next departure into a dominant double-height hero card with big countdown, placing upcoming trains below.",
        moves: ["Double-height hero typography for immediate next train", "Massive 'IN 8 MIN' countdown", "Arrival time and delay prominently displayed", "Secondary trains displayed as condensed 2-line queue"],
        facts: { Type: "Information Hierarchy", Effort: "S", Needs: "Alternative board layout in glasses.ts" },
        render: () => K.screen(i02Lines),
      },
      {
        id: "i03-gesture-safety",
        n: 23,
        group: "improvements",
        name: "R1 Double-Tap Accidental Exit Safeguard",
        tagline: "3-second undoable countdown to prevent accidental exits",
        concept: "Even Hub requires double-tap on root to exit. Riders tapping the ring quickly frequently trigger accidental plugin closes. Adds a 3-second grace period with an undoable confirmation prompt before shutting down.",
        moves: ["Intercepts double_tap with 3-second countdown", "Single tap cancels exit and keeps plugin open", "Second double-tap immediately confirms exit", "Eliminates frustrating accidental quits on the move"],
        facts: { Type: "Ergonomics & Safety", Effort: "S", Needs: "Exit countdown state in Navigator class" },
        render: () => K.screen(i03Lines),
      },
      {
        id: "i04-strikethrough-delays",
        n: 24,
        group: "improvements",
        name: "Scheduled vs Live Delay Diff Notation",
        tagline: "Explicit before/after time diff: '8:16 ➔ 8:24 (+8m)'",
        concept: "Currently, delayed trains only show their live time and a '+8' badge, forcing commuters to remember the original timetable time. Replaces this with an explicit '8:16 ➔ 8:24' transformation arrow.",
        moves: ["Shows original timetable time and live predicted time", "Arrow notation (➔) illustrates schedule shift", "Clearly identifies on-time vs delayed departures", "Cancelled trains marked with bold CANCELLED label"],
        facts: { Type: "Delay Clarity", Effort: "S", Needs: "Minor format string change in glasses.ts" },
        render: () => K.screen(i04Lines),
      },
      {
        id: "i05-ascii-progress-bar",
        n: 25,
        group: "improvements",
        name: "Visual ASCII Linear Route Tracker",
        tagline: "Linear route map: 'MTV──PA──RC──●SM──SF' on tracking screen",
        concept: "The tracking view currently shows vertical text rows. Replaces this with an intuitive horizontal ASCII route track diagram showing past stations, current position, and remaining stops along the line.",
        moves: ["Horizontal line diagram with station abbreviation nodes", "Filled circles (●) indicate current train location", "Clear visual distinction between past and upcoming stops", "Countdown to next stop displayed immediately beneath"],
        facts: { Type: "Visual Tracking", Effort: "S", Needs: "ASCII generator based on TrainProgress.stations" },
        render: () => K.screen(i05Lines),
      },
      {
        id: "i06-geo-station-order",
        n: 26,
        group: "improvements",
        name: "Geographic Zone Station Picker",
        tagline: "Order stations geographically by Caltrain Zones 1–4",
        concept: "Station picker currently orders stations alphabetically or by timetable index. Groups stations by geographic Caltrain Fare Zones (Zone 1: SF, Zone 2: Peninsula, Zone 3: Silicon Valley, Zone 4: San Jose).",
        moves: ["Groups stations into 4 geographic Caltrain zones", "Displays adjacent stations along the physical line", "Swipe scrolls along the rail corridor rather than arbitrary alphabet", "Faster recognition for daily commuters"],
        facts: { Type: "Picker IA", Effort: "S", Needs: "Station zone lookup table in schedule.ts" },
        render: () => K.screen(i06Lines),
      },
      {
        id: "i07-auto-flip-commute",
        n: 27,
        group: "improvements",
        name: "Smart Time-of-Day Direction Auto-Default",
        tagline: "Auto-select Northbound in morning and Southbound in evening",
        concept: "Commuters traveling to work at 8 AM always travel Northbound, and at 5 PM Southbound. Automatically flips the default board direction based on time of day, saving a manual ring tap on launch.",
        moves: ["Morning commute hours (6 AM–12 PM) defaults Northbound", "Evening commute hours (3 PM–9 PM) defaults Southbound", "Displays [AUTO: MORNING COMMUTE] indicator", "1-tap manual override remains available"],
        facts: { Type: "Contextual Defaults", Effort: "S", Needs: "Check now hour against commute leg preferences" },
        render: () => K.screen(i07Lines),
      },
      {
        id: "i08-toast-feedback",
        n: 28,
        group: "improvements",
        name: "Centered HUD Action Toasts with Micro-Icons",
        tagline: "High-contrast centered confirmation overlay for ring gestures",
        concept: "Flash messages currently append to the bottom footer line where they easily get lost or conflict with alerts. Replaces them with a centered, bordered HUD toast box that auto-dismisses after 1.5s.",
        moves: ["Centered overlay toast with pulsing HUD border", "Displays clear confirmations: 'TRACKING 409', 'REFRESHED'", "Does not overwrite bottom line or gesture hints", "Subtle blur backdrop for readability against background text"],
        facts: { Type: "Action Feedback", Effort: "S", Needs: "Toast overlay renderer in glasses.ts" },
        render: () => K.screen(i08Lines, { toast: "&gt;&gt; TRACKING 409 TO SF &lt;&lt;" }),
      },
      {
        id: "i09-fast-action-menu",
        n: 29,
        group: "improvements",
        name: "3-Item Contextual Ring Radial Menu",
        tagline: "Streamline 7-item menu down to 3 high-frequency actions",
        concept: "The current menu contains 7 items that require excessive ring scrolling. Simplifies into a compact 3-item contextual menu containing only Track, Flip Direction, and Pick Stations.",
        moves: ["Reduces menu from 7 items to 3 primary actions", "Eliminates deep scrolling while standing on platform", "Number keys mapped to quick ring taps", "Immediate double-tap return to main board"],
        facts: { Type: "Menu Ergonomics", Effort: "S", Needs: "Streamlined menu() in Navigator class" },
        render: () => K.screen(i09Lines),
      },
      {
        id: "i10-data-freshness",
        n: 10,
        group: "improvements",
        name: "Live Data Age & Stale Feed Heartbeat",
        tagline: "Sync heartbeat indicator: '● LIVE (sync 12s ago)'",
        concept: "When trains are delayed, commuters need to know whether the data is 10 seconds fresh or 5 minutes old. Shows a live heartbeat indicator with seconds since last GTFS-RT feed update.",
        moves: ["Pulsing connection dot in header", "Displays seconds elapsed since last GTFS-RT poll", "Warns with 'STALE (4m ago)' if feed connection stalls", "Tap triggers instant manual refresh"],
        facts: { Type: "Transparency & Trust", Effort: "S", Needs: "Snapshot timestamp in Board object" },
        render: () => K.screen(i10Lines),
      },
      {
        id: "i11-cxl-alternative",
        n: 31,
        group: "improvements",
        name: "Cancelled Train Inline Replacement",
        tagline: "Cancelled rows show swap advice: '115 CXL ➔ TAKE 511 at 8:36'",
        concept: "When a train is cancelled, today's app simply shows 'CXL' with no immediate next step. Replaces the empty right-hand space with the recommended alternative train number and departure time.",
        moves: ["Replaces empty countdown with replacement train number", "Recommends 'TAKE 511 at 8:36' inline", "Cursor auto-skips cancelled train to replacement", "One ring tap switches tracking to the recommended train"],
        facts: { Type: "Disruption Recovery", Effort: "S", Needs: "Inline fallback selector in glasses.ts" },
        render: () => K.screen(i11Lines),
      },
      {
        id: "i12-waveguide-insets",
        n: 32,
        group: "improvements",
        name: "Waveguide Edge Inset Calibration",
        tagline: "Increase horizontal padding to 36px to prevent optical blur",
        concept: "Even G2 waveguide lenses experience slight optical distortion and chromatic fringing at the extreme horizontal edges. Increases safe horizontal text insets from 24px to 36px for razor-sharp visual clarity.",
        moves: ["Increases LINE_PX safe inset margin from 24px to 36px", "Eliminates chromatic color-splitting at lens boundaries", "Centers content in user's sharpest foveal field of view", "Improves reading comfort for prescription lens wearers"],
        facts: { Type: "Optical Ergonomics", Effort: "S", Needs: "Update LINE_PX in packages/core/src/font.ts" },
        render: () => K.screen(i12Lines),
      },
      {
        id: "i13-marquee-alerts",
        n: 33,
        group: "improvements",
        name: "2-Line Smart-Wrapped Alert Banner",
        tagline: "Dedicated 2-line wrapped alert card instead of 28-char cutoff",
        concept: "Currently, service alerts are clipped with ellipses at 28 characters (e.g. '! Train 115 cancelled: equi...'), hiding critical context. Dedicates 2 lines with smart word wrapping for readable full alert summaries.",
        moves: ["Dedicated 2-line alert banner at bottom of board", "Word-wrapped using wrapPx() with zero clipping", "High-visibility warning glyph (⚠️)", "Hold gesture opens dedicated full-screen alert details"],
        facts: { Type: "Alert Readability", Effort: "S", Needs: "2-line footer allocation in boardLines()" },
        render: () => K.screen(i13Lines),
      },
      {
        id: "i14-dual-nearby-stations",
        n: 34,
        group: "improvements",
        name: "Dual-Station Board for Border Commuters",
        tagline: "Interleaved board showing Mountain View & Sunnyvale together",
        concept: "Commuters living between two stations (e.g. Mountain View and Sunnyvale) often decide which station to bike to based on departure times. Interleaves departures from both stations into one unified board.",
        moves: ["Interleaves departures from two neighboring stations", "Station abbreviation pill (MTV vs SNY) on each row", "Sorts strictly by chronological departure time", "Allows riders to pick the earliest train between two stations"],
        facts: { Type: "Multi-Station Board", Effort: "M", Needs: "Fetch two station boards and merge departures" },
        render: () => K.screen(i14Lines),
      },
      {
        id: "i15-kind-badges",
        n: 35,
        group: "improvements",
        name: "High-Contrast Train Kind Glyphs",
        tagline: "Distinct brackets: [EXP] Express vs <LTD> vs LOC Local",
        concept: "Commuters scanning departures quickly often mistake a slow Local train for a fast Express. Styles train types with distinct high-contrast brackets: [EXP] for Express, <LTD> for Limited, and plain LOC for Local.",
        moves: ["[EXP] square brackets for Express trains", "<LTD> angled brackets for Limited stop trains", "Plain LOC for all-stop Local trains", "Instant visual shape recognition without reading text"],
        facts: { Type: "Visual Scanning", Effort: "S", Needs: "Format string update in trainRow()" },
        render: () => K.screen(i15Lines),
      },
      {
        id: "i16-bold-stop-counter",
        n: 36,
        group: "improvements",
        name: "Large Countdown-to-Stop in Tracking HUD",
        tagline: "Prominent '>>> 2 STOPS REMAINING <<<' hero counter",
        concept: "In tracking mode, commuters don't want to calculate stops left from a list. Emphasizes remaining stops in large, eye-catching text with an explicit get-ready advisory when 1 stop remains.",
        moves: ["Hero stop counter: '>>> 2 STOPS REMAINING <<<'", "Explicit 'Get ready to exit' warning at penultimate stop", "Clear destination arrival time in header", "Stands out immediately during brief glances"],
        facts: { Type: "Glanceable Tracking", Effort: "S", Needs: "trackLines() formatting update" },
        render: () => K.screen(i16Lines),
      },
      {
        id: "i17-night-phosphor-dim",
        n: 37,
        group: "improvements",
        name: "Twilight / Night HUD Brightness Preset",
        tagline: "30% reduced phosphor luminance for dark evening trains",
        concept: "Even G2's maximum green phosphor brightness can cause pupil contraction and glare in dark commuter train cars at night. Adds a low-lumens profile with thinner strokes and reduced emission for comfortable night viewing.",
        moves: ["30% lower luminance profile", "Thinner stroke rendering for crisp night contrast", "Auto-activates between sunset and sunrise", "Hold gesture toggles back to daylight mode"],
        facts: { Type: "Display Ergonomics", Effort: "S", Needs: "Firmware brightness parameter in Even SDK" },
        render: () => K.screen(i17Lines, { frameCls: "night-dim" }),
      },
      {
        id: "i18-auto-hide-hints",
        n: 38,
        group: "improvements",
        name: "Auto-Hiding Gesture Hints (+1 Train Row)",
        tagline: "Hide bottom gesture hints after 10 sessions to unlock 7th row",
        concept: "The bottom 2 lines of gesture hints ('tap: flip hold: menu') are vital for new users but waste 22% of screen space for seasoned riders. Auto-hides hints after 10 launches, unlocking room for a 7th departure row.",
        moves: ["Tracks session count in local storage", "Auto-hides hints after 10 successful sessions", "Expands visible departures from 6 to 7 trains", "Restores hints anytime via menu settings"],
        facts: { Type: "Screen Density", Effort: "S", Needs: "Check session count in Navigator.boardLines()" },
        render: () => K.screen(i18Lines),
      },
      {
        id: "i19-smart-time-unit",
        n: 39,
        group: "improvements",
        name: "Adaptive Time Units (Countdown vs Clock)",
        tagline: "Trains <30m show 'in 8 min'; trains >30m show 'at 9:01 AM'",
        concept: "Countdown minutes are urgent and critical when catching a train in under 30 minutes, but confusing for trains hours away. Intelligently switches from relative countdowns ('in 8 min') to absolute clock times ('at 9:01 AM').",
        moves: ["Under 30m shows relative countdown (e.g. 'in 8 min')", "Over 30m shows absolute departure time (e.g. 'at 9:01 AM')", "Adds 'URGENT' indicator for trains departing under 10m", "Reduces cognitive load for commuter trip planning"],
        facts: { Type: "Time Representation", Effort: "S", Needs: "Dynamic time formatter in glasses.ts" },
        render: () => K.screen(i19Lines),
      },
      {
        id: "i20-instant-reconnect",
        n: 40,
        group: "improvements",
        name: "Optimistic Offline-to-Online Recovery",
        tagline: "Retain cached departures during sync: zero screen flicker",
        concept: "When network connection briefly drops and reconnects, current apps flash a loading screen. Retains existing departure rows optimistically and displays a subtle 'RECONNECTING... ⚡' status tag with zero flicker.",
        moves: ["Retains cached departures during network reconnection", "Displays subtle sync status tag in header", "Smoothly updates timestamps without visual flash", "Zero disruptive loading spinners or blank screens"],
        facts: { Type: "State Transition", Effort: "S", Needs: "Optimistic cache state in apps/glasses/src/app.ts" },
        render: () => K.screen(i20Lines),
      },
    ],
  };
})();
