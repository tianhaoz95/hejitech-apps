// Headway: five feature candidates + today's Trains tab. Every mock uses KIT's sample data (the real
// Mountain View → San Francisco timetable for Tue Oct 27 2026 at 7:57 AM, see js/kit.js).
(() => {
  const K = KIT, I = K.icon, T = K.trains;
  const modes = (name, render, extra = {}) => [{ name, render, dark: false, ...extra }, { name: `${name} · dark`, render, dark: true, ...extra }];
  const glassesView = (name, lines, caption) => ({ name, frame: "glasses", render: () => K.glasses(lines, caption) });
  const gFoot = "tap: flip  hold: menu  2x: exit";

  // ── 0 · today ──────────────────────────────────────────────────────────────
  const nowBoard = () => K.app(K.title,
    K.section(K.boardHeader(), T.map((t) => K.trainRow(t)).join(""), "Live predictions from Caltrain's feed. Swipe a train to track it: your iPhone alerts you before your stop.") + K.alertSection());
  const nowGlasses = [K.gHead(), ...T.map((t, i) => K.gRow(t, i === 0)), `! ${K.alert.header.slice(0, 26)}...`, gFoot];

  // ── 1 · Catch it ──────────────────────────────────────────────────────────
  const leave = { "409": null, "113": "8:14", "511": "8:26", "413": "8:51", "117": "9:06" };
  const catchRight = (t) => {
    if (t.status === "cancelled") return "";
    if (t.train === "409") return `<span class="run">RUN</span><small class="orange">8 min left</small>`;
    return `<span class="lv">Leave ${leave[t.train]}</span><small>in ${K.until(leave[t.train])}</small>`;
  };
  const catchBoard = () => K.app(K.title, `
    <div class="hgrp"><div class="cells"><div class="cell hero">
      <div class="h-top">${I("walk", 15)} ${K.leg.walk} min walk to ${K.leg.from}<span class="acc">Edit</span></div>
      <div class="h-big">Leave in <b>17 min</b></div>
      <div class="h-sub">for <b>113</b> at 8:24 (8 min late) · leave by 8:14</div>
      <div class="h-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5"/><circle class="arc" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="57 100"/></svg><b>17</b></div>
      <div class="h-warn orange">${I("bolt", 13)} 409 at 8:05 needs a run: 8 min left, your walk is 10</div>
    </div></div></div>` +
    K.section(K.boardHeader(), T.map((t) => K.trainRow(t, { right: catchRight(t), cls: t.train === "113" ? "best" : "" })).join(""),
      "Leave-by is each train's live departure minus your walk. It moves when a train runs late.") + K.alertSection());
  const catchGlasses = [K.gHead(), ...T.map((t, i) => K.gRow(t, i === 1, t.status === "cancelled" ? "" : t.train === "409" ? "RUN" : `go ${K.untilG(leave[t.train])}`)), "Leave in 17m for 113 (walk 10)", gFoot];

  // ── 2 · Wait for the express ──────────────────────────────────────────────
  const ride = (t) => K.min(t.parr) - K.min(t.pdep);
  const xTag = { "409": `<i class="tag">First to SF</i>`, "511": `<i class="tag good">Shortest ride</i>`, "113": `<i class="tag mute">Overtaken by 511</i>` };
  const expressBoard = () => K.app(K.title, `
    <div class="seg2"><span class="on">Leaving</span><span>Arriving</span></div>
    <div class="hgrp"><div class="cells"><div class="cell insight">
      <span class="ib">${I("bolt", 18)}</span>
      <div><b>Wait for 511 Express</b><small>113 is now 8 min late. 511 leaves 12 min after it and gets to San Francisco 2 min sooner: <b>9:22</b> instead of 9:24.</small></div>
    </div></div></div>` +
    K.section(K.boardHeader(), T.map((t) => K.trainRow(t, {
      cls: t.train === "113" ? "dim" : t.train === "511" ? "best" : "",
      extra: t.status === "cancelled" ? "" : `<div class="l3">${xTag[t.train] || ""}<span class="sec">${ride(t)} min ride</span></div>`,
    })).join(""), "Ride times use live predictions. A train is overtaken when a later one reaches your stop first.") + K.alertSection());
  const expressPush = () => K.lock(`
    <div class="notif"><span class="nicon">${I("tram", 20, 1.8)}</span><div><div class="nh"><b>Headway</b><small>now</small></div>
      <b>113 is 8 min late: take 511 instead</b><p>511 Express leaves Mountain View at 8:36 and reaches San Francisco at 9:22, 2 min before 113.</p></div></div>`, { time: "7:57" });
  const expressGlasses = [K.gHead(), ...T.map((t, i) => K.gRow(t, i === 2)), "Wait for 511: beats 113 by 2m", gFoot];

  // ── 3 · Lock Screen Live Activity ─────────────────────────────────────────
  const tr = K.track;
  const dots = () => `<div class="la-line">${tr.line.map(([n, , s]) => `<i class="${s}" title="${n}"></i>`).join("")}</div>`;
  const activity = () => `
    <div class="la">
      <div class="la-r1"><span class="la-app">${I("tram", 15, 2)}</span><b>409 Limited</b><span class="sec">to San Francisco</span><span class="orange la-d">+4 min</span></div>
      <div class="la-r2"><div><b class="la-big">8:57</b><small>arrives · in 27 min</small></div><div class="la-st"><b>4 stops</b><small>to go</small></div></div>
      ${dots()}
      <div class="la-r3"><span>Next: <b>San Mateo</b> 8:32</span><span class="sec">Live · 8:30</span></div>
    </div>`;
  const laLock = () => K.lock(activity());
  const island = (expanded) => expanded
    ? `<div class="di big"><div class="di-r1"><span class="la-app">${I("tram", 14, 2)}</span><b>409 LTD</b><span class="di-sp"></span><b class="accg">27 min</b></div>
        <div class="di-r2"><span>Next <b>San Mateo</b> 8:32</span><span>SF <b>8:57</b> <i class="orange">+4</i></span></div>${dots()}</div>`
    : `<div class="di small"><span class="accg">${I("tram", 13, 2.2)} 409</span><span class="di-cam"></span><b class="accg">27m</b></div>`;
  const tracking = (withToggle) => K.section("Tracking", `<div class="cell trk">
      <div class="trk-h"><b>Train 409 to San Francisco</b><span class="orange">+4 min</span></div>
      <div>Next stop San Mateo at 8:32</div>
      <div class="sec">Arrives 8:57 · in 27 min · 4 stops to go</div>
      ${withToggle ? `<div class="tgl-row"><span>${I("lock", 15)} On Lock Screen &amp; Dynamic Island</span><i class="tgl on"></i></div>` : ""}
      <div class="red">Stop tracking</div></div>`);
  const trackBoard = (withToggle, extra = "") => K.app(K.title, tracking(withToggle) + extra +
    K.section(K.boardHeader(), T.slice(2).map((t) => K.trainRow(t)).join("")), { time: "8:30" });
  const laIsland = () => `<div class="dim-app">${trackBoard(false)}</div>${island(true)}`;
  const laApp = () => `${trackBoard(true)}${island(false)}`;

  // ── 4 · Share my ETA ──────────────────────────────────────────────────────
  const URL = "headway.hejitech.workers.dev/eta/k7Qp2x";
  const shareSheet = () => `${trackBoard(false)}<div class="scrim"></div>
    <div class="sheet"><div class="grab"></div>
      <div class="sh-h"><span class="la-app big">${I("tram", 20, 2)}</span><div><b>Sam's train · live ETA</b><small>${URL}</small></div></div>
      <div class="bubble">On Caltrain 409, arriving San Francisco 8:57 (4 min late). Follow it live: ${URL}</div>
      <div class="sh-opts"><span>Name shown: <b>Sam</b></span><span class="acc">Edit</span></div>
      <div class="sh-opts"><span>Link stops working</span><span class="sec">30 min after arrival</span></div>
      <div class="apps">${[["msg", "Messages", "#34C759"], ["copy", "Copy link", "#8E8E93"], ["bell", "Mail", "#0A84FF"], ["more", "More", "#8E8E93"]]
        .map(([ic, l, c]) => `<span><i style="background:${c}">${I(ic, 24, 1.8)}</i><small>${l}</small></span>`).join("")}</div>
    </div>`;
  const etaPage = (arrived) => `${K.statusBar("8:30")}
    <div class="eta">
      <div class="eta-brand"><span class="la-app">${I("tram", 14, 2)}</span> Headway</div>
      ${arrived ? `<h2>Sam has arrived</h2><p class="sec">Train 409 reached San Francisco at 8:57. This link has stopped updating.</p>` : `
      <h2>Sam is on Caltrain 409</h2>
      <div class="eta-big"><b>8:57</b><div><span>arrives San Francisco</span><span class="orange">in 27 min · 4 min late</span></div></div>
      <div class="eta-stops">${tr.line.slice(3).map(([n, t, s]) => `<div class="es ${s}"><i></i><span>${n}</span><b>${t}</b></div>`).join("")}</div>
      <p class="sec eta-foot">Updated 8:30 AM from Caltrain's live feed. Refreshes every minute; stops 30 min after arrival.</p>`}
    </div>
    <div class="safari"><span>${I("lock", 11)} headway.hejitech.workers.dev</span></div>`;

  // ── 5 · How late is my train, really ──────────────────────────────────────
  const bars = (a, h = 46) => `<div class="bars" style="height:${h}px">${a.map((v) => `<i class="${v >= 10 ? "r" : v >= 5 ? "o" : "g"}" style="height:${Math.max(3, Math.min(100, (v / 18) * 100))}%"></i>`).join("")}</div>`;
  const st = Object.fromEntries(Object.entries(K.history).map(([k, a]) => [k, K.stats(a)]));
  const relCommute = () => K.app("Commute", `
    ${K.section("Your usual morning train", `<div class="cell rel">
      <div class="rel-h"><b>113 Local · 8:16</b><span class="sec">from Mountain View</span></div>
      <div class="rel-stats"><span><b class="${st["113"].onTime < 80 ? "orange" : "green"}">${st["113"].onTime}%</b><small>on time</small></span><span><b>+${st["113"].median}</b><small>median min</small></span><span><b class="red">+${st["113"].worst}</b><small>worst (Oct 14)</small></span></div>
      ${bars(K.history["113"])}
      <div class="rel-ax"><span>Sep 29</span><span>last 20 weekdays</span><span>Oct 26</span></div>
    </div>`, "On time = under 5 min late at Mountain View, from Caltrain's live feed as Headway saw it.")}
    <div class="hgrp"><div class="cells"><div class="cell insight">
      <span class="ib">${I("chart", 18)}</span>
      <div><b>409 is the steadier train</b><small>On time ${st["409"].onTime}% of days (113: ${st["113"].onTime}%) and in San Francisco 23 min sooner. It leaves 15 min earlier.</small><span class="acc lnk">Make 409 my usual train</span></div>
    </div></div></div>
    ${K.section("Other morning trains", [["409", "Limited · 8:01"], ["511", "Express · 8:36"]].map(([n, l]) => `<div class="cell relrow"><div><b>${n}</b><small>${l}</small></div>${bars(K.history[n], 26)}<div class="rr"><b class="green">${st[n].onTime}%</b><small>median +${st[n].median}</small></div></div>`).join(""))}
    ${K.section("Morning", `<div class="cell kv"><span>From</span><span class="sec">Mountain View</span></div><div class="cell kv"><span>To</span><span class="sec">San Francisco</span></div><div class="cell kv"><span>Usual train at or after</span><span class="sec">8:15</span></div>`)}
  `, { tab: "commute", trailing: `<span class="acc save">Save</span>` });
  const usually = { "409": "usually +1", "113": "usually +4", "511": "usually on time" };
  const relBoard = () => K.app(K.title, K.section(K.boardHeader(), T.map((t) => K.trainRow(t, {
    extra: usually[t.train] ? `<div class="l3"><i class="tag ${t.train === "113" ? "warn" : "mute"}">${I("chart", 10, 2.4)} ${usually[t.train]}</i></div>` : "",
  })).join(""), "\"Usually\" is the median delay at this station over the last 20 weekdays.") + K.alertSection());

  window.REVIEW = {
    key: "2026-10-26-headway-features-v1",
    dir: "reports/archive/2026-10-26-headway-features",
    repo: "tianhaoz95/hejitech-apps",
    port: 8812,
    project: "projects/headway",
    context: [
      "projects/headway/CLAUDE.md",
      "projects/headway/docs/decisions.md",
      "projects/headway/packages/core/src/types.ts",
      "projects/headway/packages/core/src/schedule.ts",
      "projects/headway/packages/core/src/alerts.ts",
      "projects/headway/packages/core/src/glasses.ts",
      "projects/headway/services/web/src/worker/cron.ts",
      "projects/headway/services/web/src/worker/push.ts",
      "projects/headway/services/web/src/worker/api.ts",
      "projects/headway/apps/ios/App/Sources/BoardView.swift",
      "projects/headway/apps/ios/App/Sources/CommuteView.swift",
      "supabase/migrations/20261025020632_headway_init.sql",
    ],
    brief: "\"Propose 5 useful features for Headway.\" Five features (not restyles), each shown on the surfaces it touches (iPhone Trains/Commute tab, Even G2 glasses board, Lock Screen, web), grounded in what the app already has: the compiled Caltrain timetable, the 511 live snapshot every 2 min, Settings legs (walk_minutes, usual train, watch window), tracked_trips and APNs push from the Worker. Each carries effort and a design section an engineer can build from.",
    title: "Headway: next features",
    subtitle: "5 feature candidates + today's Trains tab",
    heading: "Which features should Headway build next?",
    intro: "Each candidate is one feature, mocked as live HTML on the iPhone (light and dark) and, where it shows up there, the G2 glasses and Lock Screen. Open one for its design section (how it works, files, risks). Heart the ones worth building, rate them, note what you'd change, crown your first pick, then <b>Copy summary</b> and paste it to any agent.",
    legend: ["<b>Mountain View → SF</b>, Tue 7:57 AM", "real timetable, sample live delays", "<b>10 min</b> walk, usual 8:15"],
    round: 1,
    frame: "phone",
    size: [640, 340],   // the "glasses" views
    nextSteps: ({ winners }) => [
      winners.length ? `Build the crowned feature first (${winners.join(", ")}), then the other hearted ones in order of ★, each on its own branch.` : "No winner yet: build the hearted features in order of ★, or start another round with the notes.",
      "Change behaviour in packages/core with a test first (glasses text only in core/src/glasses.ts), mirror new JSON in HeadwayKit/Models.swift, then the iPhone UI.",
      "Schema changes go through supabase/README.md (headway schema only, RLS read-own, Worker writes).",
      "Add a What's New entry (WhatsNewView.swift) for the release; cut it with scripts/cut_release.sh headway.",
    ],
    candidates: [
      {
        id: "current", n: 0, name: "Today's Trains tab", baseline: true,
        tagline: "The board as BoardView.swift and glasses.ts draw it now",
        concept: "The commute board for the time of day with live delays, swipe to track, Caltrain alerts below. The glasses show the same six trains with a cursor.",
        render: nowBoard,
        views: [...modes("Trains tab", nowBoard), glassesView("Glasses board (G2)", nowGlasses, "Even G2 · 576×288 · 9 lines")],
      },
      {
        id: "catch", n: 1, name: "Catch it", round: 1,
        tagline: "Leave-by times that follow the live delay",
        concept: "The board answers \"when do I have to walk out the door?\", not just \"when does it leave?\": every train gets a leave-by time (live departure minus your walk), and the top card counts down to the next one you can still make, flagging one you'd have to run for. It reuses the walk_minutes Headway already stores; the trade-off is that a fixed walk can't know where you are (no location, by design).",
        moves: ["Countdown card: \"Leave in 17 min for 113\" with a ring", "Per-train leave-by replaces the minutes-until column; RUN when there's less time than your walk", "Glasses rows end in \"go 17m\" / \"RUN\", footer says which train to leave for", "Custom pairs (no saved leg) keep today's minutes-until"],
        facts: { Surfaces: "iPhone board, glasses board, MCP next_trains", Effort: "S", Needs: "Nothing new: Leg.walk_minutes exists; the Board gains walk_minutes and leave_by per train" },
        render: catchBoard,
        views: [...modes("Trains tab", catchBoard), glassesView("Glasses board (G2)", catchGlasses, "Rows end in the time to leave; the cursor starts on the best train")],
        spec: {
          today: ["Leg.walk_minutes (types.ts) is used only by alerts.ts to time the leave-now push; boards (schedule.ts board()/commuteBoard()) never see it", "BoardView.TrainRow and glasses.ts trainRow() end in minutes until departure (Clock.until / untilText)"],
          proposed: ["core: catchInfo(train, now, walk) → { leave_by, state: \"later\" | \"leave\" | \"run\" | \"missed\" } (run: 0 < time to departure < walk; missed: departed or < walk/2)", "commuteBoard() sets board.walk_minutes from the current leg and leave_by/catch on each BoardTrain; custom boards leave them null", "Board drops trains already \"missed\" only when a later catchable one exists (keeps 8 rows)", "glasses.ts: trainRow right column = go Xm / RUN when board.walk_minutes is set; footer line \"Leave in Xm for N (walk W)\"; Navigator starts the cursor on the first \"leave\" train", "iOS: CatchCard at the top of BoardView; TrainRow trailing column switches on catch state; HeadwayKit Board/BoardTrain gain optional fields"],
          files: ["projects/headway/packages/core/src/schedule.ts", "projects/headway/packages/core/src/types.ts", "projects/headway/packages/core/src/glasses.ts", "projects/headway/packages/core/test/schedule.test.ts", "projects/headway/apps/ios/HeadwayKit/Sources/HeadwayKit/Models.swift", "projects/headway/apps/ios/App/Sources/BoardView.swift", "projects/headway/services/web/src/worker/mcp.ts (next_trains/my_commute describe leave_by)"],
          risks: ["Glasses column width: \"go 1h09\" must fit the right edge (font.ts measures it; test the widest case)", "Morning vs evening walks differ (home vs office): each leg already has its own walk_minutes", "Clients older than the change ignore the new optional fields (Codable optionals)"],
          verify: ["core tests: leave_by = pred_dep − walk; states at the run/missed boundaries; a delay moves leave_by", "glasses-sim.sh: rows and footer fit in 9 lines at the widest times", "Device: board at 7:57 with a 10-min walk shows RUN on a train leaving in 8 min"],
        },
        design: [
          { kind: "code", title: "Board JSON (api /api/me/board, MCP my_commute)", lang: "json",
            before: '{ "leg": "morning", "live": true,\n  "trains": [{ "train": "113", "pred_dep": 1793116440000, "delay_min": 8, "status": "late" }] }',
            after: '{ "leg": "morning", "live": true, "walk_minutes": 10,\n  "trains": [{ "train": "113", "pred_dep": 1793116440000, "delay_min": 8, "status": "late",\n               "leave_by": 1793115840000, "catch": "leave" }] }' },
          { kind: "table", title: "Catch states (walk W, minutes to live departure d)", head: ["State", "Rule", "iPhone", "Glasses"],
            rows: [["later", "d ≥ W + 1", "Leave 8:14 · in 17 min", "go 17m"], ["leave", "the first \"later\" train", "Countdown card + green row", "cursor starts here"], ["run", "W/2 ≤ d < W", "RUN · 8 min left (orange)", "RUN"], ["missed", "d < W/2", "row dimmed, dropped if 8 rows are full", "dropped"]] },
        ],
      },
      {
        id: "express", n: 2, name: "Wait for the express", round: 1,
        tagline: "Spots when a later train gets you there first",
        concept: "Caltrain mixes locals, limiteds and expresses, and a late local is often overtaken: today 113 runs 8 late and 511, leaving 12 minutes after it, reaches San Francisco 2 minutes sooner. Headway already has every predicted arrival, so it can say so on the board, on the glasses and as a push (\"take 511 instead\"). Small to build; only useful on lines with mixed service, which is all of Caltrain.",
        moves: ["Banner on the board: \"Wait for 511 Express\" with the arrival comparison", "Row tags: First to SF, Shortest ride, Overtaken by 511 (dimmed) and ride minutes", "Leaving / Arriving sort", "New push (alerts.ts kind better_train) inside the watch window when your next train is overtaken", "Glasses footer: \"Wait for 511: beats 113 by 2m\""],
        facts: { Surfaces: "iPhone board, push, glasses, MCP", Effort: "S–M", Needs: "A new alert toggle (AlertSettings.better_train); no new data" },
        render: expressBoard,
        views: [...modes("Trains tab", expressBoard), ...modes("Push when your train is overtaken", expressPush), glassesView("Glasses board (G2)", expressGlasses, "The footer names the faster train; no arrows (ASCII only)")],
        spec: {
          today: ["BoardTrain has pred_dep/pred_arr and stops_between (schedule.ts departures()); nothing compares trains", "alerts.ts dueNotifications() knows delay, cancellation, service, leave_now, arrival"],
          proposed: ["core: boardInsights(trains) → per train ride_min, overtaken_by (trip id of a later-departing, not-cancelled train with pred_arr < this pred_arr), first_in, shortest; and board.tip { wait_for, instead_of, saves_min } when the next catchable train is overtaken", "alerts.ts: kind better_train for the next ALERT_TRAINS trains of a watched leg when overtaken_by appears (dedupe key per trip + overtaker), only if saves_min ≥ 2", "settings.ts: AlertSettings.better_train (default true), checkSettings + normalizeSettings", "glasses.ts footer prefers the tip over the gesture-free note line; iOS: InsightBanner, tags in TrainRow, a sort Picker"],
          files: ["projects/headway/packages/core/src/schedule.ts", "projects/headway/packages/core/src/alerts.ts", "projects/headway/packages/core/src/settings.ts", "projects/headway/packages/core/src/types.ts", "projects/headway/packages/core/src/glasses.ts", "projects/headway/apps/ios/App/Sources/BoardView.swift", "projects/headway/apps/ios/App/Sources/CommuteView.swift (AlertsSection toggle)", "projects/headway/apps/ios/HeadwayKit/Sources/HeadwayKit/Models.swift"],
          risks: ["Predictions are 2 min old at worst: a 1-min advantage is noise, hence the 2-min floor", "Without live data the timetable never overtakes (no tip, tags only)", "Push fatigue: one better_train per trip per morning"],
          verify: ["core tests with a snapshot where 113 is +8: 113.overtaken_by = 511, tip saves 2", "alerts test: fires once, not again on the next cron tick, not outside the window", "Device: board and push copy on a delayed morning"],
        },
        design: [
          { kind: "steps", title: "From a delay to the push", steps: [
            { actor: "cron.ts (2 min)", text: "511 trip updates: 113 +8 at Mountain View" },
            { actor: "core boardInsights", text: "113 pred_arr 9:24 > 511 pred_arr 9:22 and 511 departs later → 113.overtaken_by = 511, saves 2" },
            { actor: "alerts.ts", text: "rider's morning leg is in its window, 113 is among the next 3, better_train on → notification key better:113:511:20261027" },
            { actor: "push.ts", text: "APNs time-sensitive: \"113 is 8 min late: take 511 instead\"" },
            { actor: "iPhone / glasses", text: "board banner and glasses footer show the same tip on the next refresh" },
          ] },
          { kind: "code", title: "BoardTrain additions", lang: "ts", after: "ride_min: number;            // pred_arr - pred_dep\novertaken_by: string | null; // trip_id\nfirst_in?: boolean; shortest?: boolean;\n// Board\ntip?: { wait_for: string; instead_of: string; saves_min: number } | null;" },
        ],
      },
      {
        id: "live", n: 3, name: "Lock Screen Live Activity", round: 1,
        tagline: "Your tracked train on the Lock Screen and Dynamic Island",
        concept: "Tracking a train today puts a row on the Trains tab and sends one push before your stop. A Live Activity keeps the train on the Lock Screen and in the Dynamic Island the whole ride: arrival, delay, next stop and a stop-by-stop line, updated by the Worker from the same 2-minute snapshot. It reverses the \"no Live Activity in v1\" call in decisions.md, and it's the biggest build here: a widget extension, ActivityKit push tokens and a new push type.",
        moves: ["Live Activity starts when you track (app, glasses hold menu or an assistant) and ends on arrival", "Lock Screen: arrival time, minutes to go, delay, next stop, the line of stops", "Dynamic Island: compact \"409 · 27m\", expanded with next stop and arrival", "Toggle on the tracking row; the arrival push stays"],
        facts: { Surfaces: "Lock Screen, Dynamic Island, Trains tab", Effort: "L", Needs: "Widget extension target (own bundle id + profile in CI), ActivityKit push tokens stored by the Worker, liveactivity APNs pushes" },
        render: laLock,
        views: [...modes("Lock Screen", laLock), { name: "Dynamic Island, expanded", render: laIsland, dark: true }, ...modes("Trains tab while tracking", laApp)],
        spec: {
          today: ["tracked_trips row (one per user) written by api.ts / mcp.ts / the glasses; progress() in schedule.ts computes TrainProgress on read", "cron.ts → alerts.ts sends one arrival push (push.ts, apns-push-type alert); decisions.md: \"No Live Activity in v1\""],
          proposed: ["iOS: HeadwayWidgets extension with TrackActivityAttributes { trip_id, train, kind, to } and ContentState { pred_arr, delay_min, next, next_pred, stops_left, cancelled, arrived }; Text(timerInterval:) counts down locally between pushes", "App starts the activity when it tracks; registers the push-to-start token (iOS 17.2+) so tracking from the glasses or MCP starts it too; each activity's update token goes to POST /api/me/activity", "Worker: headway.activity_tokens; cron.ts after the snapshot computes progress() for each tracked row with a token and sends apns-push-type liveactivity (topic com.hejitech.headway.push-type.liveactivity) only when ContentState changed; event end with dismissal-date on arrival or untrack", "project.yml: new app-extension target; headway-testflight.yml signs it (bundle id com.hejitech.headway.widgets)"],
          files: ["projects/headway/apps/ios/project.yml", "projects/headway/apps/ios/Widgets/TrackActivity.swift (new)", "projects/headway/apps/ios/HeadwayKit/Sources/HeadwayKit/Models.swift", "projects/headway/apps/ios/App/Sources/AppModel.swift", "projects/headway/services/web/src/worker/push.ts", "projects/headway/services/web/src/worker/cron.ts", "projects/headway/services/web/src/worker/api.ts", "supabase/migrations/<ts>_headway_activity_tokens.sql (new)", ".github/workflows/headway-testflight.yml", "projects/headway/docs/decisions.md"],
          risks: ["APNs Live Activity budget: high-priority updates are throttled; send priority 5 except delay/cancel changes", "Push-to-start needs iOS 17.2; older devices only get it when tracking from the phone", "New extension target must sign in CI with the existing team key (no new certificate)", "Strings must not contain \"Apple\" if App Intents are added for buttons"],
          verify: ["Unit: ContentState equality decides whether cron sends", "Device (iPhone attached): track 409 → Lock Screen shows it; Worker cron moves next stop; untrack ends it; tracking from glasses-sim starts it via push-to-start", "TestFlight build processes (asc build status), widget visible"],
        },
        design: [
          { kind: "flow", title: "Tracked train → what the rider sees",
            today: { nodes: [{ id: "src", label: "App / glasses / MCP", sub: "track", col: 0, row: 0, type: "ui" }, { id: "tt", label: "tracked_trips", sub: "one row per user", col: 1, row: 0, type: "store" }, { id: "cron", label: "cron.ts", sub: "every minute", col: 2, row: 0 }, { id: "al", label: "alerts.ts", sub: "arrival due?", col: 3, row: 0 }, { id: "apns", label: "APNs alert", sub: "\"5 min to SF\"", col: 4, row: 0, type: "external" }],
              edges: [{ from: "src", to: "tt" }, { from: "tt", to: "cron" }, { from: "cron", to: "al" }, { from: "al", to: "apns" }] },
            proposed: { nodes: [{ id: "src", label: "App / glasses / MCP", sub: "track", col: 0, row: 0, type: "ui" }, { id: "tt", label: "tracked_trips", sub: "one row per user", col: 1, row: 0, type: "store" }, { id: "tok", label: "activity_tokens", sub: "start + update tokens", col: 1, row: 1, type: "store", state: "new" }, { id: "cron", label: "cron.ts", sub: "every minute", col: 2, row: 0, state: "changed" }, { id: "al", label: "alerts.ts", sub: "arrival due?", col: 3, row: 0 }, { id: "la", label: "liveactivity push", sub: "ContentState if changed", col: 3, row: 1, state: "new" }, { id: "apns", label: "APNs", sub: "alert + liveactivity", col: 4, row: 0, type: "external", state: "changed" }, { id: "w", label: "HeadwayWidgets", sub: "Lock Screen, Island", col: 4, row: 1, type: "ui", state: "new" }],
              edges: [{ from: "src", to: "tt" }, { from: "src", to: "tok", label: "app registers", state: "new" }, { from: "tt", to: "cron" }, { from: "tok", to: "cron", state: "new" }, { from: "cron", to: "al" }, { from: "cron", to: "la", state: "new" }, { from: "al", to: "apns" }, { from: "la", to: "w", label: "via APNs", state: "new" }] } },
          { kind: "table", title: "headway.activity_tokens (new)", head: ["Column", "Type", "Note"], rows: [["user_id", "uuid → auth.users", "RLS: read own; Worker writes"], ["kind", "text", "start | update"], ["token", "text", "ActivityKit push token"], ["trip_id", "text null", "update tokens only"], ["environment", "text", "production | sandbox, like push_devices"], ["updated_at", "timestamptz", "stale after 8 h"]] },
        ],
      },
      {
        id: "share", n: 4, name: "Share my ETA", round: 1,
        tagline: "A live link for whoever's picking you up",
        concept: "While you track a train, one tap shares a link that shows the person waiting for you where the train is and when it arrives, updating live, no app or sign-in on their side. It's the most social feature here and reuses the tracking and progress code; the cost is a public page and a token table, with care for privacy (a first name only, expires after arrival).",
        moves: ["\"Share live ETA\" on the tracking row → share sheet with a ready message", "Public page /eta/<token>: arrival, delay, the stops left, refreshing every minute", "Ends itself 30 min after arrival or when you stop tracking; shows \"arrived\"", "MCP tool share_eta so an assistant can text the link"],
        facts: { Surfaces: "iPhone share sheet, public web page, MCP", Effort: "M", Needs: "headway.eta_shares table, public route + JSON endpoint, optional display name in settings" },
        render: shareSheet,
        views: [...modes("Your iPhone: share sheet", shareSheet), ...modes("Their phone: the live page", () => etaPage(false)), { name: "Their phone: after arrival", render: () => etaPage(true), dark: false }],
        spec: {
          today: ["Tracking state lives in tracked_trips; progress() (schedule.ts) turns it into TrainProgress with next stop, stops_left, pred_arr", "Every route except /api/board and /api/stations needs a session or a token (api.ts)"],
          proposed: ["POST /api/me/share (session) → creates eta_shares row for the current tracked trip, returns https://headway.hejitech.workers.dev/eta/<token> (token 9 random base62 chars, stored as sha-256)", "GET /eta/:token (public HTML, no cookies) and GET /api/eta/:token (JSON: name, train, kind, to, pred_arr, delay_min, stops: [{name, pred}], arrived, updated_at); 404 once expired/revoked", "Expiry: arrival + 30 min (set when progress().arrived first seen) or untrack revokes; cron deletes rows older than a day", "Settings.share_name (optional, ≤ 20 chars) prefilled in the sheet; MCP share_eta returns the link", "iOS: ShareLink on TrackedRow with the message text"],
          files: ["projects/headway/services/web/src/worker/api.ts", "projects/headway/services/web/src/worker/index.ts (route /eta/:token)", "projects/headway/services/web/src/worker/store.ts", "projects/headway/services/web/src/worker/mcp.ts", "projects/headway/services/web/src/eta.html (new)", "projects/headway/packages/core/src/settings.ts", "projects/headway/apps/ios/App/Sources/BoardView.swift", "supabase/migrations/<ts>_headway_eta_shares.sql (new)"],
          risks: ["Privacy: the page shows a train and a destination station, not the rider's home; no name unless set", "Link guessing: 9 base62 chars ≈ 53 bits, plus rate limiting by IP on /api/eta", "Worker isolates cache the snapshot 20 s: the page's minute refresh is fine"],
          verify: ["test-api.mjs: create share → public JSON without auth → revoke on untrack → 404", "Page renders on a narrow phone and in dark mode", "Device: share from the tracking row into Messages, open the link on another phone"],
        },
        design: [
          { kind: "flow", title: "One share, two people",
            proposed: { nodes: [{ id: "app", label: "Rider's iPhone", sub: "Share live ETA", col: 0, row: 0, type: "ui" }, { id: "api", label: "POST /api/me/share", sub: "session", col: 1, row: 0, state: "new" }, { id: "db", label: "eta_shares", sub: "token hash, trip, expiry", col: 2, row: 0, type: "store", state: "new" }, { id: "tt", label: "tracked_trips + snapshot", sub: "progress()", col: 2, row: 1, type: "store" }, { id: "pub", label: "GET /api/eta/:token", sub: "public, no auth", col: 3, row: 1, state: "new" }, { id: "them", label: "Their browser", sub: "/eta/k7Qp2x, 60 s refresh", col: 4, row: 1, type: "ui", state: "new" }],
              edges: [{ from: "app", to: "api", state: "new" }, { from: "api", to: "db", state: "new" }, { from: "db", to: "pub", label: "token → user, trip", state: "new" }, { from: "tt", to: "pub" }, { from: "pub", to: "them", label: "JSON", state: "new" }] } },
          { kind: "table", title: "headway.eta_shares (new)", head: ["Column", "Type", "Note"], rows: [["token_hash", "text pk", "sha-256 of the link token"], ["user_id", "uuid", "RLS: read own (to list/revoke)"], ["trip_id / service_date", "text", "the tracked train when shared"], ["to_station", "text", "destination at share time"], ["name", "text null", "first name shown, from settings.share_name"], ["expires_at", "timestamptz", "arrival + 30 min; revoked_at on untrack"]] },
          { kind: "code", title: "GET /api/eta/:token", lang: "json", after: '{ "name": "Sam", "train": "409", "kind": "LTD", "to": "San Francisco",\n  "pred_arr": 1793117820000, "delay_min": 4, "arrived": false,\n  "stops": [{ "name": "San Mateo", "pred": 1793115120000 }, …],\n  "updated_at": 1793115000000 }' },
        ],
      },
      {
        id: "reliability", n: 5, name: "How late is my train, really", round: 1,
        tagline: "Each train's track record, from the feed Headway already reads",
        concept: "Headway sees every Caltrain delay every 2 minutes and throws it away. Keeping one number per train and stop a day turns that into a track record: how often your usual 8:16 is on time, its median and worst delay, and whether a nearby train is steadier. It's the only feature that gets better with time, and it needs weeks of collection before it says anything.",
        moves: ["Commute tab: your usual train's last 20 weekdays (on-time %, median, worst, a bar per day)", "\"409 is the steadier train\" suggestion with one tap to make it your usual", "Board rows: a quiet \"usually +4\" chip", "MCP tool train_reliability (\"is the 8:16 usually late?\")", "Until 10 weekdays are collected: \"Collecting, 6 of 10 days\""],
        facts: { Surfaces: "Commute tab, board, MCP", Effort: "L", Needs: "New table headway.trip_observations written by cron, ~2–4 weeks of data before it shows; nothing exists yet (mock numbers are illustrative)" },
        render: relCommute,
        views: [...modes("Commute tab", relCommute), ...modes("Trains tab", relBoard)],
        spec: {
          today: ["realtime.ts stores one headway.realtime snapshot (latest only); older predictions are overwritten", "No history anywhere; Settings.morning.usual picks the usual train"],
          proposed: ["cron.ts, after each trip-updates fetch: for each trip/stop whose predicted departure has just passed, upsert headway.trip_observations (service_date, trip_id, station_id) with the last delay_s and cancelled", "core: reliability(observations, trainId, stationId) → { days, on_time_pct (delay < 5 min), median_min, worst: { min, date } } and steadier(): a train within ±30 min with ≥ 15 points higher on-time %", "GET /api/reliability?station=&trains=113,409,511 (public; aggregated only)", "iOS: ReliabilityCard in CommuteView, tag in TrainRow; MCP train_reliability", "Retention: delete rows older than 120 days in the daily cron"],
          files: ["projects/headway/services/web/src/worker/cron.ts", "projects/headway/services/web/src/worker/realtime.ts", "projects/headway/services/web/src/worker/store.ts", "projects/headway/services/web/src/worker/api.ts", "projects/headway/services/web/src/worker/mcp.ts", "projects/headway/packages/core/src/reliability.ts (new)", "projects/headway/apps/ios/App/Sources/CommuteView.swift", "projects/headway/apps/ios/App/Sources/BoardView.swift", "supabase/migrations/<ts>_headway_trip_observations.sql (new)"],
          risks: ["Gaps: a missed 511 fetch or a stale snapshot (> 10 min) means no observation, not \"on time\"", "Timetable changes renumber trains: key on train + scheduled time, reset on a new feed_version", "Shared Supabase size: ~2,100 rows a weekday (estimate below) is small but must move with the project at graduation", "Stats on few days mislead: hide under 10 days"],
          verify: ["core tests: stats from fixtures, gaps excluded, threshold boundary at 5 min", "Local: run the cron against a recorded snapshot sequence, rows appear once per stop", "After 2 weeks in production: compare a train's numbers with Caltrain's published on-time report"],
        },
        design: [
          { kind: "flow", title: "Keeping what the cron already sees",
            today: { nodes: [{ id: "511", label: "511.org GTFS-RT", sub: "every 2 min", col: 0, row: 0, type: "external" }, { id: "cron", label: "cron.ts / realtime.ts", sub: "parse", col: 1, row: 0 }, { id: "snap", label: "headway.realtime", sub: "latest snapshot only", col: 2, row: 0, type: "store" }, { id: "b", label: "boards, alerts", sub: "now", col: 3, row: 0, type: "ui" }],
              edges: [{ from: "511", to: "cron" }, { from: "cron", to: "snap" }, { from: "snap", to: "b" }] },
            proposed: { nodes: [{ id: "511", label: "511.org GTFS-RT", sub: "every 2 min", col: 0, row: 0, type: "external" }, { id: "cron", label: "cron.ts / realtime.ts", sub: "parse + observe", col: 1, row: 0, state: "changed" }, { id: "snap", label: "headway.realtime", sub: "latest snapshot only", col: 2, row: 0, type: "store" }, { id: "obs", label: "trip_observations", sub: "1 row / trip / stop / day", col: 2, row: 1, type: "store", state: "new" }, { id: "b", label: "boards, alerts", sub: "now", col: 3, row: 0, type: "ui" }, { id: "rel", label: "core reliability()", sub: "/api/reliability, MCP", col: 3, row: 1, state: "new" }],
              edges: [{ from: "511", to: "cron" }, { from: "cron", to: "snap" }, { from: "cron", to: "obs", label: "departed stops", state: "new" }, { from: "snap", to: "b" }, { from: "obs", to: "rel", state: "new" }] } },
          { kind: "table", title: "headway.trip_observations (new)", note: "Row volume is an estimate: 112 weekday trips with 2,142 stop events in today's timetable (counted from timetable.gen.json for 2026-10-27), one row per stop event.", head: ["Column", "Type", "Note"], rows: [["service_date", "date", "pk part"], ["trip_id", "text", "pk part; train + scheduled time kept for renumbering"], ["station_id", "text", "pk part"], ["delay_s", "int", "last prediction before departure"], ["cancelled / skipped", "bool", ""], ["feed_version", "text", "timetable it was observed against"], ["Volume", "≈ 2,142 rows / weekday (estimate)", "≈ 260k rows at 120 days"]] },
        ],
      },
    ],
  };
})();
