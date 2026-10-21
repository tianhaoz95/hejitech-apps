// The review's content: config + 20 sensor, accelerometer & double-pinch one-hand logging candidates + baseline.
(() => {
  const { icon: I, watchHeader, data: D } = KIT;

  // Round 4 screens (tilt-lock mode), shared by candidates 21–25.
  const S = KIT.sectors;
  const tl = (tag = "TILT MODE") => watchHeader({ time: "3:12", child: "Mia", sensorTag: tag });
  const phone = (dark, body) => `<div class="ph${dark ? " dk" : ""}"><div class="ph-status"><b>9:41</b><span>●●● ▮</span></div>${body}</div>`;
  const R4 = {
    tilting: (dwell) => `<div class="r4">${tl()}
      ${KIT.compass({ at: "n", dwell })}
      <div class="r4-foot" style="color:${S.n.color}">${dwell < 0.3 ? "Feed · hold still to lock" : `Locking Feed… ${Math.round((1 - dwell) * 10) / 10} s`}</div></div>`,
    locked: ({ s = S.n, title = "Start feed?" } = {}) => `<div class="r4">${tl("LOCKED")}${KIT.lockCard({ s, title })}</div>`,
    logged: () => `<div class="r4">${tl()}
      <div class="done"><div class="done-ok">${I("check", 40, 3)}</div><div class="done-t">Feed started</div>
      <div class="done-s">Mia · 3:12 AM</div><div class="done-later">Bottle or breast? Answer later on iPhone</div>
      <div class="done-undo">${I("doublePinch", 14)} Double pinch again to undo · 4 s</div></div></div>`,
    sub: (dwell, which = "diaper") => {
      const set = which === "diaper"
        ? { n: { label: "Wet", icon: "drop", color: "#64D2FF" }, e: { label: "Dirty", icon: "poop", color: "#AC8E68" }, s: { label: "Both", icon: "diaper", color: "#0A84FF" }, w: { label: "Dry", icon: "sun", color: "#8E8E93" } }
        : { n: { label: "All", icon: "bottle", color: "#30D158" }, e: { label: "¾", icon: "bottle", color: "#64D2FF" }, s: { label: "¼", icon: "bottle", color: "#FF9F0A" }, w: { label: "½", icon: "bottle", color: "#BF5AF2" } };
      const at = which === "diaper" ? "e" : "n";
      return `<div class="r4">${tl(which === "diaper" ? "DIAPER ›" : "FINISH BOTTLE ›")}
        ${KIT.compass({ at, dwell, sectors: set, size: 196 })}
        <div class="r4-foot" style="color:${set[at].color}">${set[at].label} · centre 2 s = ask later</div></div>`;
    },
    nopinch: (fill) => `<div class="r4">${tl("LOCKED")}
      <div class="np"><div class="np-t" style="color:${S.n.color}">${I("drop", 18)} Start feed?</div>
      ${KIT.compass({ at: null, drift: fill ? [0, 0] : [0, -34], sectors: { n: S.n, e: { ...S.e, color: "#2C2C2E" }, s: { ...S.s, color: "#2C2C2E" }, w: { ...S.w, color: "#2C2C2E" } }, size: 180 })}
      <div class="np-ring${fill ? " on" : ""}" style="--p:${fill * 100}%"></div>
      <div class="r4-foot">${fill ? "Hold in the centre… logging" : "Roll back to the centre to log"}</div></div></div>`,
    custom: () => `<div class="r4">${tl()}
      ${KIT.compass({ at: "w", dwell: 0.4, sectors: { ...S, w: { label: "Pump", icon: "bottle", color: "#FF375F" } } })}
      <div class="r4-foot" style="color:#FF375F">Pump · from your iPhone layout</div></div>`,
    catchup: () => `${watchHeader({ time: "3:31", child: "Mia" })}
      <div class="cu">
        <div class="cu-q"><div class="cu-h">${I("diaper", 13)} Diaper · 3:12 · what kind?</div>
          <div class="cu-ch"><span>Wet</span><span>Dirty</span><span>Both</span><span>Dry</span></div></div>
        <div class="cu-q"><div class="cu-h">${I("drop", 13)} Feed · 3:05 · bottle or breast?</div>
          <div class="cu-ch"><span>Bottle</span><span>Left</span><span>Right</span></div></div>
        <div class="today-headline">Fed 26m ago · Left next</div>
        <button class="today-btn primary">${I("drop", 16)} Finish feed</button>
        <button class="today-btn primary">${I("diaper", 16)} Diaper</button>
      </div>`,
    settings: ({ dark, confirm = false }) => phone(dark, `
      <div class="ph-nav"><span>‹ Settings</span><b>Apple Watch</b><i></i></div>
      <div class="ph-grp">WATCH APP</div>
      <div class="ph-card">
        <div class="ph-row"><span>Watch opens in</span></div>
        <div class="ph-seg"><span>Buttons</span><span class="on">Tilt compass</span></div>
        ${confirm ? `<div class="ph-row"><span>Confirm with</span><em>Automatic ›</em></div>` : ""}
        <div class="ph-row"><span>Hold to lock</span><em>1.0 s ›</em></div>
        <div class="ph-row"><span>Tilt sensitivity</span><em>Normal ›</em></div>
      </div>
      <p class="ph-foot">Tilt compass: tilt your wrist toward Feed, Diaper, Sleep or ${KIT.sectors.w.label}, hold it there for a second, then double pinch to log. Details you skip wait on Home under Needs details. Either mode has a button to switch to the other.${confirm ? " Automatic uses double pinch on Series 9, Ultra 2 and later, and rolling back to the centre on older watches." : ""}</p>
      <div class="ph-grp">COMPASS</div>
      <div class="ph-card ph-mini">
        <div class="ph-dir n" style="--c:${S.n.color}">${I(S.n.icon, 14)} ${S.n.label}</div>
        <div class="ph-dir w" style="--c:${S.w.color}">${I(S.w.icon, 14)} ${S.w.label}</div>
        <div class="ph-dot"></div>
        <div class="ph-dir e" style="--c:${S.e.color}">${I(S.e.icon, 14)} ${S.e.label}</div>
        <div class="ph-dir s" style="--c:${S.s.color}">${I(S.s.icon, 14)} ${S.s.label}</div>
      </div>
      <p class="ph-foot">West is your first pinned care type.</p>`),
    needs: ({ dark }) => phone(dark, `
      <div class="ph-title">Mia</div>
      <div class="ph-line">Fed 26m ago · Left next · 120ml</div>
      <div class="ph-need">
        <div class="ph-need-h">${I("doublePinch", 15)} <b>Needs details</b><span>3 from your watch</span></div>
        <div class="ph-need-r"><div><b>Feed</b> · 3:12 AM<small>Bottle or breast?</small></div><div class="ph-chips"><span>Bottle</span><span>Left</span><span>Right</span></div></div>
        <div class="ph-need-r"><div><b>Diaper</b> · 2:40 AM<small>What kind?</small></div><div class="ph-chips"><span>Wet</span><span>Dirty</span><span>Both</span><span>Dry</span></div></div>
        <div class="ph-need-r"><div><b>Finish bottle</b> · 1:58 AM<small>How much did they drink?</small></div><div class="ph-chips"><span>¼</span><span>½</span><span>¾</span><span>All</span></div></div>
      </div>
      <div class="ph-grp">TODAY</div>
      <div class="ph-card">
        <div class="ph-row"><span>3:12 · Feed started</span><em>⌚ gesture</em></div>
        <div class="ph-row"><span>2:40 · Diaper</span><em>⌚ gesture</em></div>
        <div class="ph-row"><span>1:58 · Finished bottle</span><em>⌚ gesture</em></div>
        <div class="ph-row"><span>0:51 · Woke up</span><em>⌚ gesture</em></div>
      </div>`),
    sectorsEditor: ({ dark }) => phone(dark, `
      <div class="ph-nav"><span>‹ Apple Watch</span><b>Directions</b><i></i></div>
      <div class="ph-card ph-mini big">
        <div class="ph-dir n" style="--c:${S.n.color}">${I("drop", 14)} Feed ▾</div>
        <div class="ph-dir w" style="--c:#FF375F">${I("bottle", 14)} Pump ▾</div>
        <div class="ph-dot"></div>
        <div class="ph-dir e" style="--c:${S.e.color}">${I("diaper", 14)} Diaper ▾</div>
        <div class="ph-dir s" style="--c:${S.s.color}">${I("moon", 14)} Sleep ▾</div>
      </div>
      <div class="ph-grp">WATCH OPENS IN</div>
      <div class="ph-card">
        <div class="ph-row"><span>Buttons</span><em></em></div>
        <div class="ph-row"><span>Tilt compass</span><em></em></div>
        <div class="ph-row"><span>Tilt at night</span><em class="ck">✓</em></div>
      </div>
      <p class="ph-foot">Tilt at night follows your Night screen hours (10:00 PM – 7:00 AM). Care types that need typing, like a medicine name, can't take a direction.</p>`)
  };

  window.REVIEW = {
    key: "2026-10-20-weehours-watch-redesign-v1",
    dir: "reports/archive/2026-10-20-weehours-watch-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8797,
    project: "projects/weehours",
    context: [
      "projects/weehours/CLAUDE.md",
      "projects/weehours/apps/ios/Watch/WatchApp.swift",
      "projects/weehours/apps/ios/WatchWidgets/WatchWidgets.swift",
      "projects/weehours/apps/ios/Shared/SharedStore.swift",
      "projects/weehours/spec/event-types.json"
    ],
    brief: "Achieve true single-hand (and single-arm) logging using Apple Watch sensors: the accelerometer, gyroscope (CoreMotion), watchOS Double Tap (double pinch of thumb + index), hand clench, wrist tilts, and wrist flicks. Caregivers holding a baby or bottle in their other arm must be able to log 100% of baby events without touching the watch glass with their other hand.",
    title: "Wee Hours · Single-Hand Sensor & Gesture Logging",
    subtitle: "25 candidates using Double Pinch, Accelerometer tilt, Wrist flick & CoreMotion",
    heading: "Pick a sensor-driven one-hand logging UX",
    intro: "Traditional watch apps require two hands (one to wear, one to tap). When your other arm is cradling an infant, you need <b>single-arm control</b>. The candidates below use watchOS Double Pinch, wrist tilt gravity vectors, and clench gestures to log with zero touchscreen taps.",
    legend: ["<b>26</b> candidates (1 baseline + 25 sensor redesigns)", "<b>5</b> round-4 tilt-lock variants of 07", "<b>6</b> groups"],
    round: 4,
    frame: "watch",
    size: [360, 440],
    groups: [
      { id: "baseline", name: "Baseline", note: "Today's touch-only implementation" },
      { id: "tiltlock", name: "Tilt-lock mode (round 4)", note: "07's bubble compass grown into a second watch mode: dwell to lock, double pinch to log, details later" },
      { id: "doublepinch", name: "1 · Double Pinch & AssistiveTouch", note: "watchOS 10/11 Double Tap, single-pinch cycle, and clench triggers" },
      { id: "tilt", name: "2 · Accelerometer & Wrist Tilt", note: "CoreMotion gravity vectors: tilt to scrub volume, select breast side, or compass steer" },
      { id: "kinetics", name: "3 · Wrist Flick, Shake & Rocking", note: "Dynamic gestures: outward flick to undo, shake to sleep, rocking cadence detection" },
      { id: "elevation", name: "4 · Arm Elevation & Blind Haptics", note: "Arm height detection (lap/chest/face), blind audio-haptic clicks, clench duration" },
      { id: "sensorfamily", name: "5 · Multi-Child & Shift Sensors", note: "Twin flick switching, clench-hold tandem sync, and wrist-bump shift hand-off" }
    ],
    metrics: (c, scr) => [
      { text: scr.querySelector(".g-badge") ? "Sensor: Active" : "Sensor: Standard", good: true },
      { text: (c.facts && c.facts.Sensors) || "Touchscreen", good: true }
    ],
    candidates: [
      // ── Baseline (Candidate 00)
      {
        id: "current", n: 0, group: "baseline", baseline: true, prefers: "dark",
        name: "Current Watch App (Two-Handed)",
        tagline: "Today's touch-only scrolling list requiring your other hand to tap",
        concept: "Faithful recreation of WatchApp.swift today: requires hand A to hold the watch and hand B to scroll, tap buttons, and pick from modal action sheets. Fails when hand B is occupied holding a baby.",
        moves: [
          "Requires 2 hands to operate (wearing hand + tapping hand)",
          "Vertical ScrollView with multiple standard system buttons",
          "Modal confirmationDialog popover requiring precision taps",
          "Zero motion sensor or double-pinch hardware integration"
        ],
        facts: { Type: "Baseline", Effort: "Current", Sensors: "Touchscreen only (requires 2 hands)" },
        palette: [["Dark BG", "#000000"], ["System Gray", "#1C1C1E"], ["Accent Orange", "#FF9500"]],
        render: () => `
          ${watchHeader({ time: "9:41", child: "Mia" })}
          <div class="today-list">
            <div class="today-headline">${D.status.line}</div>
            <div class="today-confirm">✓ Bottle 120ml logged</div>
            <button class="today-btn orange">${I("mic", 16)} Speak</button>
            <button class="today-btn primary">${I("drop", 16)} Start feed</button>
            <button class="today-btn primary">${I("diaper", 16)} Diaper</button>
            <button class="today-btn primary">${I("moon", 16)} Asleep</button>
            <div class="today-twohand-warning">Requires other hand to tap</div>
          </div>
        `
      },

      // ── Round 4: Tilt-lock mode (07 Radial Gyro Bubble Compass + the user's note)
      {
        id: "tiltlock", n: 21, group: "tiltlock", round: 4, mine: true, prefers: "dark",
        name: "Tilt · Lock · Double Pinch",
        tagline: "Bubble rests 1 s in a direction to lock it, a confirm card pops up, double pinch logs; details later on the iPhone",
        concept: "07's bubble compass as a second watch mode next to today's buttons. Tilt until the bubble sits in a direction; holding it there for 1 s locks the choice and a confirmation card appears. A double pinch logs it and that's the end: no follow-up questions on the watch. Anything the log is missing (diaper kind, how much of the bottle) waits on the iPhone for when both hands are free. Which mode the watch opens in is a setting in the iPhone app.",
        moves: [
          "Second watch mode beside today's button list, not a replacement",
          "Dwell 1 s in a direction → lock haptic → confirmation card",
          "Double pinch on the card logs; tilting away or 4 s of nothing cancels",
          "No questions after the log: missing details go to a \"Needs details\" card on the iPhone",
          "iPhone Settings → Apple Watch → \"Watch opens in\": Buttons or Tilt compass"
        ],
        facts: { Type: "Tilt dwell + Double Tap confirm", Effort: "M", Sensors: "CoreMotion gravity (pitch/roll) + Double Tap", Needs: "A watch-mode setting in the phone's applicationContext; gesture provenance on watch messages; a \"needs details\" query on the phone" },
        palette: [["Feed", "#30D158"], ["Diaper", "#0A84FF"], ["Sleep", "#BF5AF2"], ["Pinned", "#FF9F0A"]],
        render: () => R4.tilting(0.6),
        views: [
          { name: "1 · Tilt: the bubble drifts into Feed", render: () => R4.tilting(0.15) },
          { name: "2 · Held still: the lock ring fills over 1 s", render: () => R4.tilting(0.75) },
          { name: "3 · Locked: confirm with a double pinch", render: () => R4.locked() },
          { name: "4 · Logged, no questions asked", render: () => R4.logged() },
          { name: "5 · iPhone Settings: which mode the watch opens in", frame: "phone", render: ({ dark }) => R4.settings({ dark }) },
          { name: "6 · iPhone: details, when your hands are free", frame: "phone", render: ({ dark }) => R4.needs({ dark }) }
        ],
        spec: {
          today: [
            "`WatchHome` (Watch/WatchApp.swift) is a ScrollView of buttons: Speak, Start/Finish feed, Switch side, Diaper, Asleep/Woke up, up to 2 pinned care types, Undo last. Every one is a tap with the other hand.",
            "Diaper opens a `confirmationDialog` (wet/dirty/both/dry); finishing a bottle opens another (¼ ½ ¾ All). Both need a second tap.",
            "`PhoneLink.send` sends `{action, baby, kind?, fraction?}` over `WCSession.sendMessage`; `AppModel.session(didReceiveMessage:)` logs it with `Provenance(surface: .watch, input: .tap)`.",
            "The phone pushes `line, openFeed, sleeping, children, target, pinned` in `updateApplicationContext`; nothing about how the watch should look.",
            "`InputKind` (LogCore/Model.swift) already has `.gesture`; nothing uses it from the watch."
          ],
          proposed: [
            "New `TiltCompassView` (Watch/TiltCompass.swift): `CMMotionManager.deviceMotion` at 30 Hz while visible; `gravity` x/y relative to a neutral captured over the first 0.3 s after the view appears (or after a wrist raise), so a cradling arm's posture is the centre.",
            "Classifier (pure function, unit-tested): dead zone < 12°; a direction counts when tilt > 18° toward it and rotation rate < 1 rad/s (ignores rocking and walking). Entering a direction: `.click` haptic. 1.0 s continuously in it: `.start` haptic and lock.",
            "Locked: a confirmation card with the action's real label from phone state (Start feed / Finish feed, Asleep / Woke up, Diaper, pinned[0]'s label). Its Log button carries `.handGestureShortcut(.primaryAction)`, so Double Tap presses it. Tilting out of the direction past the dead zone, or 4 s without a pinch, cancels (`.retry` haptic) and returns to the compass.",
            "Log sends the same messages as the buttons with `\"input\": \"gesture\"` and no follow-ups: `toggleFeed` without `fraction`, `diaper` without `kind`, `toggleSleep`, `care` for pinned[0]. `AppModel` reads `input` into `Provenance`.",
            "After the reply: `.success` haptic, \"✓ Feed started · details later on iPhone\", then back to the compass after 2 s. Undo: a second double pinch while the ✓ shows (5 s) sends `undo` with `lastId`.",
            "Phone: Settings gets an \"Apple Watch\" section, Picker \"Watch opens in\" (Buttons · Tilt compass), stored in `@AppStorage(\"watchStartMode\")` and sent as `startMode` in the applicationContext. `WeeHoursWatchApp` picks the root view from it; each mode has a small button to switch to the other for two-handed use.",
            "Phone Home: a \"Needs details\" card lists watch-gesture events missing a question's answer (diaper without `kind`, `feed.bottle.finish` without `consumed_fraction`, a feed not yet split bottle/breast), with the answers as chips. Answering edits the event (same edit path as tapping an entry)."
          ],
          files: [
            "projects/weehours/apps/ios/Watch/TiltCompass.swift (new)",
            "projects/weehours/apps/ios/Watch/WatchApp.swift",
            "projects/weehours/apps/ios/App/Sources/AppModel.swift",
            "projects/weehours/apps/ios/App/Sources/SettingsView.swift",
            "projects/weehours/apps/ios/App/Sources/HomeView.swift",
            "projects/weehours/apps/ios/App/Sources/WhatsNewView.swift",
            "projects/weehours/apps/ios/WeeHoursTests or LogCore tests: classifier traces (new)"
          ],
          risks: [
            "Double Tap in third-party apps needs Series 9 / Ultra 2 or later on watchOS 11. Older watches need another confirm (see 23).",
            "`diaper` today defaults `kind` to \"wet\" when missing; it must log without a kind instead, and LogCore validation must accept that (or use an explicit `unknown` the phone then asks about).",
            "`medication` requires a `medicine` text field, so West can't be a blind \"Meds\" log: it is pinned[0] (e.g. Vitamin D) instead, the only care type the phone already sends.",
            "A cradling arm tilts as the baby shifts: the 1 s dwell plus the rotation-rate gate and a pinch to confirm are what keep false logs out; tune on device with a baby-weight bag.",
            "Motion only runs while the compass is on screen; check battery over a night with the app as the wrist-raise app."
          ],
          verify: [
            "Unit tests feed recorded gravity traces (still, slow tilt, rocking at 0.8 Hz, walking) to the classifier and assert locks only on deliberate tilts.",
            "On the attached iPhone + paired watch: log all four directions one-handed; each event shows `input: gesture` and no kind/fraction.",
            "Flip \"Watch opens in\" on the phone; the watch opens in that mode on next launch.",
            "The Needs details card lists exactly the events missing answers; answering clears them and syncs."
          ]
        },
        design: [
          { kind: "flow", title: "Watch ↔ phone, today and proposed",
            today: { nodes: [
              { id: "home", label: "WatchHome", sub: "button list", col: 0, row: 0, type: "ui" },
              { id: "dlg", label: "confirmationDialog", sub: "kind / fraction", col: 0, row: 1, type: "ui" },
              { id: "link", label: "PhoneLink.send", sub: "WCSession message", col: 1, row: 0 },
              { id: "model", label: "AppModel", sub: "didReceiveMessage", col: 2, row: 0 },
              { id: "log", label: "LogService", sub: "input: .tap", col: 2, row: 1, type: "store" },
              { id: "ctx", label: "applicationContext", sub: "line · children · pinned", col: 1, row: 1 }
            ], edges: [
              { from: "home", to: "dlg", label: "2nd tap" }, { from: "home", to: "link" }, { from: "link", to: "model" },
              { from: "model", to: "log" }, { from: "model", to: "ctx" }
            ] },
            proposed: { nodes: [
              { id: "cm", label: "CMMotionManager", sub: "gravity 30 Hz", col: 0, row: 0, type: "external", state: "new" },
              { id: "tc", label: "TiltCompassView", sub: "dwell 1 s → lock", col: 0, row: 1, type: "ui", state: "new" },
              { id: "card", label: "Confirm card", sub: "Double Tap = Log", col: 0, row: 2, type: "ui", state: "new" },
              { id: "home", label: "WatchHome", sub: "buttons (other mode)", col: 1, row: 2, type: "ui" },
              { id: "link", label: "PhoneLink.send", sub: "+ input: gesture", col: 1, row: 1, state: "changed" },
              { id: "model", label: "AppModel", sub: "provenance from input", col: 2, row: 1, state: "changed" },
              { id: "log", label: "LogService", sub: "no kind / fraction yet", col: 2, row: 2, type: "store", state: "changed" },
              { id: "ctx", label: "applicationContext", sub: "+ startMode", col: 1, row: 0, state: "changed" },
              { id: "need", label: "Needs details card", sub: "iPhone Home", col: 3, row: 2, type: "ui", state: "new" },
              { id: "set", label: "Settings · Apple Watch", sub: "Watch opens in", col: 2, row: 0, type: "ui", state: "new" }
            ], edges: [
              { from: "cm", to: "tc" }, { from: "tc", to: "card", label: "lock" }, { from: "card", to: "link", label: "pinch", state: "new" },
              { from: "home", to: "link" }, { from: "link", to: "model" }, { from: "model", to: "log" },
              { from: "log", to: "need", state: "new" }, { from: "set", to: "ctx", state: "new" }, { from: "ctx", to: "tc", label: "root view", state: "new" }
            ] } },
          { kind: "steps", title: "One log, start to finish (baby in the other arm)", steps: [
            { actor: "Caregiver", text: "Raises the watch wrist. Wee Hours opens in Tilt compass (iPhone setting). The current posture becomes the centre." },
            { actor: "Caregiver", text: "Tilts the wrist forward. The bubble rolls into Feed: click haptic, Feed label lights up." },
            { actor: "Watch", text: "Bubble stays in Feed for 1 s with the wrist steady: the ring fills, lock haptic, the compass is replaced by \"Start feed? · Mia · 3:12 AM\"." },
            { actor: "Caregiver", text: "Double pinches (thumb + index). Tilting away or waiting 4 s would cancel instead." },
            { actor: "Watch → iPhone", text: "sendMessage {action: toggleFeed, baby, input: gesture}. The phone logs it with Provenance(.watch, .gesture) and replies with the label and the new status line." },
            { actor: "Watch", text: "Success haptic, \"✓ Feed started · details later on iPhone\". A second double pinch within 5 s undoes. Then back to the compass." },
            { actor: "Caregiver, later", text: "On the iPhone, the Needs details card asks only what the watch skipped (bottle or breast, how much) as chips." }
          ] },
          { kind: "table", title: "What each direction logs, and what waits for later", head: ["Direction", "Locks as", "Message sent", "Left for the iPhone"], rows: [
            ["North · Feed", "Start feed / Finish feed (from openFeed)", "toggleFeed (no fraction)", "Finish bottle: how much was drunk"],
            ["East · Diaper", "Diaper", "diaper (no kind)", "Wet / dirty / both / dry"],
            ["South · Sleep", "Asleep / Woke up (from sleeping)", "toggleSleep", "Nothing"],
            ["West · pinned[0]", "e.g. Vitamin D, Stop pump", "care {type, runningId?}", "Nothing (fields come from the pinned type)"]
          ] },
          { kind: "code", title: "applicationContext and watch message", lang: "json",
            before: `{ "line": "…", "openFeed": "", "sleeping": false, "children": [...], "target": "…", "pinned": [...] }\n{ "action": "diaper", "kind": "wet", "baby": "…" }`,
            after: `{ "line": "…", "openFeed": "", "sleeping": false, "children": [...], "target": "…", "pinned": [...],\n  "startMode": "tilt" }          // "buttons" (default) | "tilt"\n{ "action": "diaper", "baby": "…", "input": "gesture" }   // no kind: asked later on the iPhone` }
        ]
      },
      {
        id: "tiltlocksub", n: 22, group: "tiltlock", round: 4, prefers: "dark",
        name: "Lock + Sub-Compass for Details",
        tagline: "Same lock and pinch, but Diaper and Finish bottle open a second compass so the detail is caught now",
        concept: "A variant of 21 for people who'd rather not have a to-do list on the phone. Locking Diaper or Finish bottle swaps the compass for a second one (wet / dirty / both / dry, or ¼ ½ ¾ All), picked the same way: tilt, hold 1 s, double pinch. Costs about 2 s more per log; the Needs details card only gets what you skip.",
        moves: [
          "Second-level compass for the two actions that ask a question today",
          "Same dwell + double pinch, so there's still nothing to learn",
          "A fifth option in the centre: hold still 2 s = \"skip, ask later\"",
          "Feed start, sleep and pinned stay one level"
        ],
        facts: { Type: "Two-level tilt compass", Effort: "M", Sensors: "CoreMotion gravity + Double Tap", Needs: "Everything in 21; the sub-compass options from event-types.json questions (diaper_kind, amount)" },
        palette: [["Wet", "#64D2FF"], ["Dirty", "#AC8E68"], ["Both", "#0A84FF"], ["Dry", "#8E8E93"]],
        render: () => R4.sub(0.55),
        views: [
          { name: "1 · Diaper locked: the sub-compass", render: () => R4.sub(0.55) },
          { name: "2 · Dirty locked: confirm", render: () => R4.locked({ s: { color: "#AC8E68", icon: "poop" }, title: "Dirty diaper?" }) },
          { name: "3 · Finish bottle: how much", render: () => R4.sub(0.3, "bottle") }
        ],
        spec: {
          today: ["Diaper and Finish bottle each open a `confirmationDialog` in `WatchHome` (Watch/WatchApp.swift), answered with a tap."],
          proposed: [
            "`TiltCompassView` takes a list of sectors; locking Diaper or Finish bottle pushes a second sector set built from the `diaper_kind` / `amount` options in spec/event-types.json, then the confirm card.",
            "Centre held 2 s on the sub-compass = skip: logs without the detail, which then shows on the Needs details card as in 21.",
            "Message carries `kind` / `fraction` as today, plus `input: gesture`."
          ],
          files: ["projects/weehours/apps/ios/Watch/TiltCompass.swift (new)", "projects/weehours/apps/ios/Watch/WatchApp.swift", "projects/weehours/apps/ios/App/Sources/AppModel.swift"],
          risks: ["Goes against \"no more questions\" in the note; offered so the trade-off is visible.", "Four diaper kinds fit four directions; a fifth option would not."],
          verify: ["One-handed: log a dirty diaper and a ¾ bottle without touching the glass; both events carry the detail."]
        }
      },
      {
        id: "tiltlocknopinch", n: 23, group: "tiltlock", round: 4, prefers: "dark",
        name: "Lock Without Double Tap",
        tagline: "On watches without Double Tap, confirm by rolling the bubble back to the centre and holding it there",
        concept: "Double Tap only reaches apps on Series 9 / Ultra 2 and later. On an SE, Series 4–8 or Ultra 1 the confirm card instead asks you to roll the bubble back into the centre ring and hold it 1 s. It's slower and easier to trigger by accident than a pinch, so it's the fallback, not the default, and an iPhone setting can force either.",
        moves: [
          "Confirm = bubble back into the centre ring for 1 s",
          "Chosen automatically from the watch model, overridable in iPhone Settings",
          "Same lock, card and Needs details card as 21",
          "AssistiveTouch clench still works: it presses the focused Log button"
        ],
        facts: { Type: "Tilt-only confirm", Effort: "S", Sensors: "CoreMotion gravity", Needs: "21, plus a watch-model check and a \"Confirm with\" picker" },
        palette: [["Centre", "#FFFFFF"], ["Feed", "#30D158"], ["OLED Black", "#000000"]],
        render: () => R4.nopinch(0.5),
        views: [
          { name: "1 · Locked: roll back to the centre", render: () => R4.nopinch(0) },
          { name: "2 · In the centre: the confirm ring fills", render: () => R4.nopinch(0.6) },
          { name: "3 · iPhone Settings: confirm with", frame: "phone", render: ({ dark }) => R4.settings({ dark, confirm: true }) }
        ],
        spec: {
          today: ["No sensor input at all; `WatchHome` is tap-only."],
          proposed: [
            "On lock, if the watch can't receive Double Tap (model identifier below Watch7,1 / Ultra 2) or the phone setting says so, the card's hint becomes \"Roll back to centre to log\" and the classifier watches for the bubble inside the 12° dead zone for 1 s.",
            "Phone Settings › Apple Watch › \"Confirm with\": Automatic · Double pinch · Return to centre, sent as `confirmMode` in the applicationContext."
          ],
          files: ["projects/weehours/apps/ios/Watch/TiltCompass.swift (new)", "projects/weehours/apps/ios/App/Sources/SettingsView.swift", "projects/weehours/apps/ios/App/Sources/AppModel.swift"],
          risks: ["Returning to centre is what a tired arm does anyway: needs on-device testing for false confirms; the 4 s timeout still cancels."],
          verify: ["On a pre-Series 9 watch (or with the setting forced): log all four directions; cancel by tilting to another direction."]
        }
      },
      {
        id: "tiltlocksectors", n: 24, group: "tiltlock", round: 4, prefers: "dark",
        name: "Your Four Directions",
        tagline: "Choose on the iPhone what sits North, East, South and West, and when the watch opens in tilt mode",
        concept: "Every household logs different things at 3 AM: one pumps, one gives meds, one only feeds. On the iPhone you assign an action to each direction (feed, diaper, sleep or any care type) and pick when the watch opens in tilt mode: always, never, or only during the night-screen hours already set on the phone.",
        moves: [
          "A 4-way picker on the iPhone that mirrors the watch compass",
          "Any care type can take a direction, not only pinned[0]",
          "\"Watch opens in\": Buttons · Tilt compass · Tilt at night",
          "Night hours reuse the Night screen schedule"
        ],
        facts: { Type: "Configurable sectors", Effort: "M", Sensors: "CoreMotion gravity + Double Tap", Needs: "21, plus a `compass` list in the applicationContext and per-iPhone storage of the 4 assignments" },
        palette: [["Pump", "#FF375F"], ["Feed", "#30D158"], ["Diaper", "#0A84FF"], ["Sleep", "#BF5AF2"]],
        render: () => R4.custom(),
        views: [
          { name: "1 · Watch: Pump on West", render: () => R4.custom() },
          { name: "2 · iPhone: assign the directions", frame: "phone", render: ({ dark }) => R4.sectorsEditor({ dark }) }
        ],
        spec: {
          today: ["The phone sends at most 2 pinned care types (`pinned` in `AppModel`'s applicationContext); the watch has no layout settings."],
          proposed: [
            "Settings › Apple Watch › Directions: four pickers (Feed, Diaper, Sleep, or any enabled care type), stored per iPhone and sent as `compass: [{dir, id, label, icon, runningId}]`.",
            "`startMode` gains `night`: tilt during the Night screen's schedule (`nightMode`, `nightFrom`, `nightTo` in SettingsView), buttons otherwise. The phone resolves it and sends `tilt` or `buttons`, so the watch needs no clock logic."
          ],
          files: ["projects/weehours/apps/ios/App/Sources/SettingsView.swift", "projects/weehours/apps/ios/App/Sources/AppModel.swift", "projects/weehours/apps/ios/Watch/TiltCompass.swift (new)"],
          risks: ["Care types with required fields (medication's `medicine`) need a remembered value or must be left out of the picker.", "Two people sharing one watch app get the paired iPhone's layout."],
          verify: ["Assign Pump to West; the watch shows and logs it; switching to night mode flips the watch's start mode at the scheduled time."]
        }
      },
      {
        id: "tiltlockcatchup", n: 25, group: "tiltlock", round: 4, prefers: "dark",
        name: "Details Catch-Up on the Watch",
        tagline: "The missing details also wait at the top of the watch's button mode, answerable with one tap once a hand is free",
        concept: "An add-on to 21: the details the tilt log skipped show on the iPhone and also as a short queue at the top of the watch's button mode, so a caregiver who puts the baby down can answer \"Diaper at 3:12 · what kind?\" right there. Nothing pops up by itself; it's only there when you open buttons mode.",
        moves: [
          "Up to 2 open questions at the top of WatchHome, newest first",
          "One tap answers; the iPhone card clears too",
          "Never interrupts the tilt mode",
          "Sent from the phone in the applicationContext, so it works offline from the watch's view"
        ],
        facts: { Type: "Deferred detail queue", Effort: "S", Sensors: "None (tap, later)", Needs: "21, plus a `pending` list in the applicationContext and an `edit` watch action" },
        palette: [["Question", "#FFD60A"], ["Diaper", "#0A84FF"], ["OLED Black", "#000000"]],
        render: () => R4.catchup(),
        spec: {
          today: ["After a watch log, follow-ups only happen in the dialogs right away; there's no later queue anywhere."],
          proposed: [
            "The phone adds `pending: [{id, label, question, options}]` (from the Needs details query in 21, max 2) to the applicationContext.",
            "`WatchHome` shows them above the status line; a chip sends `{action: \"edit\", id, fields}`, which `AppModel` applies as an edit of that event."
          ],
          files: ["projects/weehours/apps/ios/Watch/WatchApp.swift", "projects/weehours/apps/ios/App/Sources/AppModel.swift"],
          risks: ["An edit path from the watch is new: it must go through the same LogService edit as the phone so it syncs and stays undoable."],
          verify: ["Tilt-log a diaper, open buttons mode: the question is there; answer it; the iPhone card is gone and the event has its kind."]
        }
      },

      // ── Group 1: Double Pinch & AssistiveTouch (Series 9/10/Ultra)
      {
        id: "doublepinchcommit", n: 1, group: "doublepinch", round: 3, prefers: "dark",
        name: "The Double-Pinch Commit",
        tagline: "Raise wrist: screen shows top prediction; pinch thumb + index twice to log",
        concept: "Uses Apple Watch Series 9/10/Ultra optical blood flow & motion sensors. When wrist is raised, screen displays the top predicted action (e.g. 'Feed 120ml Bottle'). Pinch index finger and thumb together twice. It executes instantly with a tactile haptic click. Zero screen touches.",
        moves: [
          "Native watchOS .handGestureShortcut(.primaryAction) binding",
          "Predicted next action automatically queued on wrist raise",
          "Double pinch (index + thumb) commits the log immediately",
          "Distinctive haptic confirmation; lower wrist to finish"
        ],
        facts: { Type: "Double Tap Gesture", Effort: "S", Sensors: "Optical Heart + Gyro + Accelerometer ML" },
        palette: [["Gesture Blue", "#0A84FF"], ["Action Green", "#30D158"], ["OLED Black", "#000000"]],
        render: () => `
          ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "DOUBLE PINCH" })}
          <div class="dp-commit-wrap">
            <div class="dpc-card">
              <div class="dpc-cue">
                <div class="dpc-anim-ring">${I("doublePinch", 32)}</div>
                <span class="dpc-cue-txt">PINCH TWICE TO LOG</span>
              </div>
              <div class="dpc-action-title">120ml Bottle Feed</div>
              <div class="dpc-sub">2h 40m since feed · Left breast next</div>
            </div>
            <div class="dpc-footer">
              <span class="dpc-pill">No touch needed</span>
              <span class="dpc-sec">Single pinch for Diaper</span>
            </div>
          </div>
        `
      },

      {
        id: "pinchcycle", n: 2, group: "doublepinch", round: 3, prefers: "dark",
        name: "Pinch-to-Cycle, Double-Pinch to Log",
        tagline: "Single pinch steps through Feed → Diaper → Sleep; Double pinch commits",
        concept: "Complete single-hand navigation without touching the display. Single pinch (thumb + index once) steps forward through 3 giant visual cards: Feed, Diaper, Sleep. Double pinch (twice quickly) commits whichever card is in focus.",
        moves: [
          "Single Pinch: advance selection carousel (Feed → Diaper → Sleep)",
          "Double Pinch: commit selected action",
          "Clench Fist: open options / adjust volume",
          "100% single-arm navigation enabled via AssistiveTouch APIs"
        ],
        facts: { Type: "AssistiveTouch State Machine", Effort: "M", Sensors: "Hand Gesture Classifier" },
        palette: [["Active Coral", "#FF6B4A"], ["Diaper Teal", "#30B0C7"], ["Sleep Indigo", "#5E5CE6"]],
        render: () => `
          ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "PINCH NAV" })}
          <div class="pinch-cycle-wrap">
            <div class="pc-carousel">
              <div class="pc-card feed active">
                <div class="pcc-top">
                  <span class="pcc-step">1 OF 3 · PINCH TO NEXT</span>
                  <span class="pcc-badge">SELECTED</span>
                </div>
                <div class="pcc-main">
                  ${I("drop", 28)}
                  <b>FEED BOTTLE</b>
                  <small>120ml · Right Now</small>
                </div>
              </div>
            </div>
            <div class="pc-gesture-guide">
              <div class="pgg-row">
                <span class="pgg-ico">${I("pinch", 14)}</span>
                <span>Pinch 1x: Next Card</span>
              </div>
              <div class="pgg-row active">
                <span class="pgg-ico">${I("doublePinch", 14)}</span>
                <b>Double Pinch: Log Feed</b>
              </div>
            </div>
          </div>
        `
      },

      {
        id: "nursingflip", n: 3, group: "doublepinch", round: 3, prefers: "dark",
        name: "Double-Pinch Nursing Flip-Flop",
        tagline: "Double pinch starts Left breast; double pinch flips to Right; clench fist saves",
        concept: "Nursing mothers holding a feeding infant cannot use their free hand. Raise wrist: double pinch starts Left breast timer. When baby finishes side 1, double pinch again to automatically switch active timer to Right breast. Clench fist into a ball to finish session.",
        moves: [
          "Double Pinch 1: Starts Left breast timer",
          "Double Pinch 2: Pauses Left, immediately starts Right breast",
          "Clench Fist: Finishes nursing session and records total duration",
          "Haptic beat every 5 minutes so mother knows timer is progressing without looking"
        ],
        facts: { Type: "Session State Machine", Effort: "M", Sensors: "Double Tap + Fist Clench" },
        palette: [["Left Coral", "#FF6B6B"], ["Right Cyan", "#4ECDC4"], ["Timer Glow", "#30D158"]],
        render: () => `
          <div class="nursingflip-screen">
            <div class="nf-header">
              <span>9:41 · NURSING</span>
              <span class="nf-gesture-tag">${I("doublePinch", 12)} PINCH TO FLIP</span>
            </div>
            <div class="nf-split">
              <!-- Left Active -->
              <div class="nf-side left active">
                <span class="nfs-lbl">LEFT BREAST</span>
                <span class="nfs-timer">08:42</span>
                <span class="nfs-status">● RUNNING</span>
              </div>
              <!-- Right Standby -->
              <div class="nf-side right">
                <span class="nfs-lbl">RIGHT BREAST</span>
                <span class="nfs-timer">00:00</span>
                <span class="nfs-status">DOUBLE PINCH FLIPS</span>
              </div>
            </div>
            <div class="nf-clench-bar">
              ${I("clench", 14)} Clench Fist to Finish & Save
            </div>
          </div>
        `
      },

      {
        id: "clenchtriggers", n: 4, group: "doublepinch", round: 3, prefers: "dark",
        name: "Clench & Double-Clench Muscle Triggers",
        tagline: "Clench fist once = Wet Diaper; Double clench = Dirty Diaper; Double pinch = Feed",
        concept: "Uses wrist tendon and blood flow changes detected by the optical heart rate sensor. Map discrete muscular actions: Clenching your fist once logs a Wet Diaper. Clenching your fist twice quickly logs a Dirty Diaper. Double-pinching logs a Feed. Log 3 distinct events with zero finger taps.",
        moves: [
          "Fist Clench 1x → Wet Diaper (immediate haptic click)",
          "Fist Clench 2x → Dirty Diaper (double haptic beat)",
          "Double Pinch 2x → Feed 120ml (triple haptic pulse)",
          "100% blind operation: executable with eyes closed in pitch-black nursery"
        ],
        facts: { Type: "Myoelectric Tendon Sensor", Effort: "M", Sensors: "Photoplethysmography (PPG) + Accelerometer" },
        palette: [["Clench Yellow", "#FFD166"], ["Pinch Green", "#30D158"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="clench-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "HAND GESTURES" })}
            <div class="clench-matrix">
              <div class="cm-row">
                <div class="cm-gesture">${I("clench", 18)} <b>1x Clench</b></div>
                <div class="cm-action wet">${I("drop", 14)} Wet Diaper</div>
              </div>
              <div class="cm-row">
                <div class="cm-gesture">${I("clench", 18)}${I("clench", 18)} <b>2x Clench</b></div>
                <div class="cm-action dirty">${I("poop", 14)} Dirty Diaper</div>
              </div>
              <div class="cm-row active">
                <div class="cm-gesture">${I("doublePinch", 18)} <b>Double Pinch</b></div>
                <div class="cm-action feed">${I("bottle", 14)} 120ml Feed</div>
              </div>
            </div>
            <div class="cm-cue">No screen taps needed · Fist muscles trigger actions</div>
          </div>
        `
      },

      // ── Group 2: Accelerometer & Wrist Tilt (Steer with your arm)
      {
        id: "tiltslider", n: 5, group: "tilt", round: 3, prefers: "dark",
        name: "Wrist Tilt Volume Stepper",
        tagline: "Tilt wrist forward or backward to scrub bottle volume; double pinch to lock in",
        concept: "Leverages the onboard 3-axis accelerometer (`CMMotionManager.deviceMotion.gravity`). Tilt your wrist upward/downward like pouring a bottle: the milk volume dial scrubs smoothly between 60, 90, 120, and 150ml with subtle tick haptics. Double pinch to lock in the volume.",
        moves: [
          "Pitch angle of wrist maps dynamically to milk volume",
          "Physical tick haptic at each 30ml threshold (60ml, 90ml, 120ml, 150ml)",
          "Double Pinch locks and logs the scrubbed amount",
          "Zero finger-to-screen touches required"
        ],
        facts: { Type: "CoreMotion Pitch Scrubber", Effort: "M", Sensors: "Accelerometer Gravity.y / Pitch" },
        palette: [["Milk Teal", "#00B4D8"], ["Sensor Orange", "#FF9500"], ["Dial Dark", "#18181A"]],
        render: () => `
          <div class="tiltslider-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "TILT TO SCRUB" })}
            <div class="ts-gauge-stage">
              <div class="ts-tilt-arrow up">${I("chevron", 14)} Tilt Up for More</div>
              <div class="ts-vol-display">
                <span class="tvd-val">120</span>
                <span class="tvd-unit">ml (4.0 oz)</span>
              </div>
              <div class="ts-tilt-arrow down">${I("chevronDown", 14)} Tilt Down for Less</div>
            </div>
            <div class="ts-confirm-bar">
              ${I("doublePinch", 16)} Double Pinch to Confirm 120ml
            </div>
          </div>
        `
      },

      {
        id: "tiltsides", n: 6, group: "tilt", round: 3, prefers: "dark",
        name: "Left/Right Wrist Tilt (Breast Selector)",
        tagline: "Tilt wrist slightly left for Left breast; tilt right for Right breast; double pinch starts",
        concept: "CoreMotion roll detection. While holding your baby with the other arm, roll your wrist 15 degrees to the left to select Left breast, or 15 degrees to the right to select Right breast. A tactile clunk haptic confirms selection. Double pinch to start the timer.",
        moves: [
          "Wrist Roll angle (`deviceMotion.attitude.roll`) switches active side",
          "Tilt Left (< -15°) highlights Left Breast",
          "Tilt Right (> +15°) highlights Right Breast",
          "Double pinch confirms and starts stopwatch"
        ],
        facts: { Type: "CoreMotion Roll Steerer", Effort: "S", Sensors: "Gyroscope & Accelerometer Roll" },
        palette: [["Left Coral", "#FF6B6B"], ["Right Cyan", "#4ECDC4"], ["Sensor Yellow", "#FFD166"]],
        render: () => `
          <div class="tiltsides-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "ROLL WRIST" })}
            <div class="ts-roll-visual">
              <div class="tr-side left selected">
                ${I("tiltLeft", 16)}
                <span class="trs-name">LEFT</span>
                <span class="trs-cue">Tilt Left</span>
              </div>
              <div class="tr-divider">
                <div class="tr-bubble left-active"></div>
              </div>
              <div class="tr-side right">
                <span class="trs-name">RIGHT</span>
                <span class="trs-cue">Tilt Right</span>
                ${I("tiltRight", 16)}
              </div>
            </div>
            <div class="ts-roll-footer">
              <div class="trf-card">
                <b>LEFT BREAST SELECTED</b>
                <small>${I("doublePinch", 14)} Double pinch to start timer</small>
              </div>
            </div>
          </div>
        `
      },

      {
        id: "tiltbubble", n: 7, group: "tilt", round: 3, prefers: "dark",
        name: "Radial Gyro Bubble Compass",
        tagline: "Tilt wrist toward 4 directions: North=Feed, East=Diaper, South=Sleep, West=Meds",
        concept: "The Apple Watch acts like a digital carpenter's bubble level. Tilting your arm slightly forward (North) highlights Feed; tilting right (East) highlights Diaper; tilting backward (South) highlights Sleep; tilting left (West) highlights Meds. Dwelling for 0.8s or double pinching logs it.",
        moves: [
          "Fluid digital bubble floating on 2D accelerometer plane",
          "4 directional quadrants (Feed, Diaper, Sleep, Vitamin D)",
          "Dwell-to-select (0.8s hold in quadrant) or Double Pinch to fire",
          "Zero screen touches required"
        ],
        facts: { Type: "2D Inclinometer Compass", Effort: "M", Sensors: "Accelerometer X/Y Pitch & Roll" },
        palette: [["North Green", "#30D158"], ["East Blue", "#0A84FF"], ["South Purple", "#BF5AF2"], ["West Orange", "#FF9F0A"]],
        render: () => `
          <div class="tiltbubble-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "TILT COMPASS" })}
            <div class="tb-compass-stage">
              <div class="tbc-label north">${I("drop", 12)} Feed</div>
              <div class="tbc-label east">${I("diaper", 12)} Diaper</div>
              <div class="tbc-label south">${I("moon", 12)} Sleep</div>
              <div class="tbc-label west">${I("pills", 12)} Meds</div>
              <div class="tbc-circle">
                <div class="tbc-crosshair"></div>
                <!-- Bubble tilted toward Feed (North) -->
                <div class="tbc-bubble north-tilted"></div>
              </div>
            </div>
            <div class="tb-footer">
              <span>Tilted to Feed · Hold 0.8s to log</span>
            </div>
          </div>
        `
      },

      {
        id: "gravitydrop", n: 8, group: "tilt", round: 3, prefers: "dark",
        name: "Gravity Snap & Drop",
        tagline: "Quick downward wrist snap logs instant diaper change; raise to view status",
        concept: "When changing a diaper, your hands are busy. After taping the fresh diaper, a quick sharp downward snap of the wrist (accelerometer z-axis spike > 2.2G) logs a clean diaper change immediately. Confirms with a heavy physical thud haptic.",
        moves: [
          "Accelerometer spike thresholding (> 2.0G downward impulse)",
          "Natural physical gesture performed after throwing away diaper",
          "Immediate heavy haptic acknowledgment (.impact(.heavy))",
          "5-second window to flick wrist if accidental"
        ],
        facts: { Type: "Impulse Gesture", Effort: "M", Sensors: "High-Frequency Accelerometer (>50Hz)" },
        palette: [["Snap Teal", "#30B0C7"], ["Impact Orange", "#FF9500"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="gravity-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "SNAP GESTURE" })}
            <div class="gs-hero">
              <div class="gs-snap-ico">
                ${I("accelerometer", 36)}
              </div>
              <div class="gs-title">SNAP WRIST DOWN</div>
              <div class="gs-sub">Instant Wet Diaper Log</div>
            </div>
            <div class="gs-indicator">
              <span class="gsi-bar active"></span>
              <span class="gsi-txt">Threshold: 2.0G downward flick</span>
            </div>
          </div>
        `
      },

      // ── Group 3: Wrist Flick, Shake & Dynamic Kinematics
      {
        id: "flickundo", n: 9, group: "kinetics", round: 3, prefers: "dark",
        name: "Wrist Flick Physical Undo",
        tagline: "Accidental log? Sharp outward flick of the wrist within 5s undoes with double haptic",
        concept: "Eliminates the fear of accidental gesture logging. If a feed or diaper was logged by mistake, a sharp outward flick of the wrist (quick supination rotation) immediately cancels the entry and undoes it in Supabase, accompanied by a double-tap error haptic.",
        moves: [
          "Rotational angular velocity detection (> 350 deg/sec outward flick)",
          "Active 5-second undo window following any logged action",
          "Reverses event instantly with outbox cancellation",
          "Double error haptic (.notification(.warning)) confirms reversal"
        ],
        facts: { Type: "Angular Velocity Reversal", Effort: "S", Sensors: "Gyroscope Z-Rotation" },
        palette: [["Undo Orange", "#FF9F0A"], ["Error Red", "#FF453A"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="flickundo-screen">
            <div class="fu-banner success">
              <span class="fub-check">✓</span>
              <span>120ml Bottle Logged</span>
            </div>
            <div class="fu-center">
              <div class="fu-anim-flick">
                ${I("flick", 40)}
              </div>
              <div class="fu-title">FLICK WRIST TO UNDO</div>
              <div class="fu-countdown">Undo window closes in: <b>4s</b></div>
            </div>
            <div class="fu-bar">
              <span>Sharp outward wrist flick cancels log</span>
            </div>
          </div>
        `,
        spec: {
          today: [
            "User must look at screen, scroll to bottom, and tap tiny 'Undo last' text button"
          ],
          proposed: [
            "CMMotionManager starts listening to rotationRate.z for 5 seconds post-log",
            "If angular velocity exceeds 5.5 rad/s outward, triggers link.send(['action': 'undo', 'id': lastId])",
            "Plays WKInterfaceDevice.current().play(.directionDown) and vibrates",
            "Screen flashes orange toast: 'Cancelled ✓'"
          ],
          files: ["projects/weehours/apps/ios/Watch/WatchApp.swift"],
          risks: ["Accidental flicks during aggressive baby rocking; filter out rhythmic frequencies < 1.5Hz"],
          verify: ["Test flick gesture on wrist with simulated infant doll in arm"]
        }
      },

      {
        id: "shaketoggle", n: 10, group: "kinetics", round: 3, prefers: "dark",
        name: "Shake-to-Toggle Sleep State",
        tagline: "Quick double-shake of wrist toggles baby Asleep / Awake with deep clunk haptic",
        concept: "When your hands are adjusting a swaddle or placing baby in the crib, you cannot look at or tap the watch. A quick double wrist-shake (shake-shake) flips the sleep state: marks baby asleep if awake, or marks baby awake if sleeping. Zero eye contact required.",
        moves: [
          "Double lateral shake gesture detected via accelerometer X-axis",
          "Toggles binary sleep state ('Baby is Asleep' ↔ 'Baby Woke Up')",
          "Deep distinctive mechanical clunk haptic (.click + .heavy)",
          "Logs exact timestamp of crib transfer without unlocking watch"
        ],
        facts: { Type: "Lateral Shake Detector", Effort: "S", Sensors: "Accelerometer Lateral X" },
        palette: [["Sleep Indigo", "#5E5CE6"], ["Wake Gold", "#FFD166"], ["Dark Slate", "#18181A"]],
        render: () => `
          <div class="shake-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "SHAKE TO TOGGLE" })}
            <div class="shake-stage">
              <div class="ss-shake-ico">
                ${I("waveMotion", 32)}
              </div>
              <div class="ss-state-text">
                <span class="sst-sub">CURRENT: AWAKE 1h 26m</span>
                <span class="sst-main">SHAKE 2x TO SLEEP</span>
              </div>
            </div>
            <div class="ss-card">
              <span class="ssc-pill">NO TAPS REQUIRED</span>
              <span class="ssc-desc">Shake wrist twice when placing baby in crib.</span>
            </div>
          </div>
        `
      },

      {
        id: "rockingdetector", n: 11, group: "kinetics", round: 3, prefers: "dark",
        name: "Cadence Rocking Nap Assistant",
        tagline: "Sensors detect rhythmic 0.8 Hz rocking motion; double pinch to confirm nap when still",
        concept: "Parents rock babies to sleep in a distinct, rhythmic back-and-forth motion (0.7 - 0.9 Hz). CoreMotion detects when rocking has been active for 10+ minutes and then detects complete stillness (baby asleep). The watch gives a gentle wrist tap: 'Double pinch to confirm 20m nap'.",
        moves: [
          "FFT (Fast Fourier Transform) frequency peak detection around 0.8 Hz",
          "Detects end of rocking cadence followed by still breathing period",
          "Gentle haptic nudge prompts: 'Baby asleep?'",
          "Single double-pinch confirms nap start with auto-backdated timestamp"
        ],
        facts: { Type: "Cadence Machine Learning", Effort: "L", Sensors: "Accelerometer FFT Frequency Analysis" },
        palette: [["Cadence Purple", "#AF52DE"], ["Still Blue", "#0A84FF"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="rocking-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "AUTO-DETECT" })}
            <div class="rs-cadence-box">
              <div class="rcb-header">
                <span class="rcb-pulse">●</span>
                <span>ROCKING DETECTED (18 MINS)</span>
              </div>
              <div class="rcb-chart">
                <div class="rcb-bar h1"></div><div class="rcb-bar h2"></div><div class="rcb-bar h3"></div>
                <div class="rcb-bar h4"></div><div class="rcb-bar h2"></div><div class="rcb-bar h1"></div>
              </div>
              <div class="rcb-question">Baby fell asleep?</div>
            </div>
            <div class="rs-confirm-prompt">
              ${I("doublePinch", 18)}
              <b>Double Pinch to Log Nap Start</b>
            </div>
          </div>
        `
      },

      {
        id: "raisetomouth", n: 12, group: "kinetics", round: 3, prefers: "dark",
        name: "Raise-to-Mouth Audio Trigger",
        tagline: "Gyro lift towards mouth opens mic automatically; whisper 'wet diaper' and lower wrist",
        concept: "Lifting the watch to within 10cm of your mouth (detected via vertical gyro lift + screen tilt facing mouth) instantly activates the microphone. Whisper what happened ('diaper wet', 'drank 90ml'). Lowering your wrist automatically cuts recording and commits via on-device Laya.",
        moves: [
          "Arm elevation + wrist pitch angle triggers mic listening immediately",
          "Whisper-optimized audio gain (no shouting in baby's ear)",
          "Lowering wrist triggers end-of-speech detection and dispatches",
          "Zero screen touches from start to finish"
        ],
        facts: { Type: "Proximity Audio Pipeline", Effort: "M", Sensors: "Gyro Attitude + Audio VAD + Laya Runtime" },
        palette: [["Voice Orange", "#FF9500"], ["Wave Green", "#30D158"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="raisemouth-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "RAISE TO SPEAK" })}
            <div class="rm-hero">
              <div class="rm-orb-listening">
                ${I("mic", 34)}
              </div>
              <div class="rm-text">
                <span class="rmt-status">LISTENING...</span>
                <span class="rmt-whisper">"Wet diaper just now"</span>
              </div>
            </div>
            <div class="rm-footer">
              <span>Lower wrist to save automatically</span>
            </div>
          </div>
        `
      },

      // ── Group 4: Arm Elevation & Blind Haptics
      {
        id: "fingerclenchhold", n: 13, group: "elevation", round: 3, prefers: "dark",
        name: "Hold Clench Duration Timer",
        tagline: "Close fist and hold to run nursing timer; release fist to stop and record minutes",
        concept: "Uses sustained hand clench pressure detected via tendon strain and PPG optical sensors. Clench and hold your fist: the watch vibrates with a heartbeat pulse every 60 seconds while baby nurses. Releasing your fist stops the timer and saves the exact minutes.",
        moves: [
          "Sustained fist clench initiates and maintains active timer",
          "Minute-by-minute gentle haptic tap (.click)",
          "Releasing fist automatically commits the nursing session",
          "Single-arm operation: requires no second hand"
        ],
        facts: { Type: "Sustained Pressure Timer", Effort: "M", Sensors: "Optical PPG Blood Volume + Tendon EMG" },
        palette: [["Tendon Coral", "#FF6B6B"], ["Running Green", "#30D158"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="clenchhold-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "HOLD CLENCH" })}
            <div class="ch-stage">
              <div class="ch-clench-ico active">
                ${I("clench", 36)}
              </div>
              <div class="ch-timer">08:42</div>
              <div class="ch-sub">LEFT BREAST ACTIVE</div>
            </div>
            <div class="ch-footer">
              <span>Hold fist to keep running · Open hand to finish</span>
            </div>
          </div>
        `
      },

      {
        id: "thumbalongbezel", n: 14, group: "elevation", round: 3, prefers: "dark",
        name: "Same-Hand Bezel Roll",
        tagline: "Use thumb on the same wearing hand to roll along crown; double pinch commits",
        concept: "Engineered for single-hand physical contact. You do not bring your other hand across. By bending your fingers on the hand wearing the watch, your thumb can touch the Digital Crown on the side. Rotate 1 click to pick category; double pinch commits.",
        moves: [
          "Optimized for same-hand thumb reach ergonomics",
          "Digital Crown scroll increments categories with heavy haptic",
          "Double pinch confirms without shifting grip",
          "100% executable with your other arm pinned under baby"
        ],
        facts: { Type: "Same-Hand Crown Reach", Effort: "S", Sensors: "Digital Crown + Double Tap" },
        palette: [["Crown Gold", "#FFD166"], ["Action Teal", "#00B4D8"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="bezelroll-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "SAME HAND" })}
            <div class="br-crown-guide">
              <div class="brg-item prev">${I("diaper", 14)} Diaper</div>
              <div class="brg-item active">
                ${I("bottle", 22)}
                <b>120ml Bottle</b>
              </div>
              <div class="brg-item next">${I("moon", 14)} Sleep</div>
            </div>
            <div class="br-confirm">
              ${I("doublePinch", 16)} Double Pinch to Log 120ml
            </div>
          </div>
        `
      },

      {
        id: "audiblehapticstep", n: 15, group: "elevation", round: 3, prefers: "dark",
        name: "Blind Audio & Haptic Stepper",
        tagline: "Hear & feel with closed eyes: 1 click = Feed, 2 clicks = Diaper, 3 clicks = Sleep",
        concept: "Designed for parents nursing or rocking in total pitch darkness. Tilting your wrist upward steps through options with distinct acoustic and tactile cues: 1 click = Feed, 2 clicks = Diaper, 3 clicks = Sleep. Double pinch confirms. You never open your eyes.",
        moves: [
          "Distinct haptic click signatures (1 tap, 2 taps, 3 taps)",
          "Optional quiet audio chime frequency per category",
          "Double pinch commits with a long confirmation hum",
          "Total sensory independence from screen and eyesight"
        ],
        facts: { Type: "Audio-Haptic Sensory UI", Effort: "M", Sensors: "Taptic Engine + CoreAudio Tones" },
        palette: [["Sensory White", "#FFFFFF"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="blindhaptic-screen">
            <div class="bhs-header">
              <span>EYES-CLOSED MODE</span>
              <span class="bhs-tag">${I("heart", 12)} HAPTIC ONLY</span>
            </div>
            <div class="bhs-center">
              <div class="bhs-pulse-ring">
                <span class="bhs-beeps">● ●</span>
              </div>
              <div class="bhs-text">2 CLICKS = DIAPER</div>
              <div class="bhs-sub">Tilt wrist to change · Double pinch to log</div>
            </div>
            <div class="bhs-footer">
              <span>Confirmed via gentle wrist vibration</span>
            </div>
          </div>
        `
      },

      {
        id: "elevationswitches", n: 16, group: "elevation", round: 3, prefers: "dark",
        name: "3-Stage Arm Elevation Elevator",
        tagline: "Arm at lap height = Sleep; arm at chest = Diaper; arm raised high = Feed",
        concept: "The accelerometer gravity vector (`gravity.z`) measures the spatial height and orientation of your arm. Resting arm in lap (holding sleeping baby) selects Sleep. Arm at mid chest selects Diaper. Arm raised to mouth selects Feed. Double pinch to log the highlighted height category.",
        moves: [
          "Vertical arm height detection via CoreMotion gravity vector",
          "Lap position (Low) → Sleep auto-selected",
          "Chest position (Mid) → Diaper auto-selected",
          "Raised position (High) → Feed auto-selected",
          "Double pinch commits instantly at that height"
        ],
        facts: { Type: "Spatial Elevation Sensor", Effort: "M", Sensors: "CoreMotion Gravity Vector Z" },
        palette: [["High Green", "#30D158"], ["Mid Teal", "#30B0C7"], ["Low Purple", "#5E5CE6"]],
        render: () => `
          <div class="elevation-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "ARM HEIGHT" })}
            <div class="el-bars">
              <div class="el-level high active">
                <span class="ell-tag">HIGH (RAISED)</span>
                <b>${I("drop", 14)} Feed (120ml)</b>
              </div>
              <div class="el-level mid">
                <span class="ell-tag">MID (CHEST)</span>
                <span>${I("diaper", 14)} Diaper (Wet)</span>
              </div>
              <div class="el-level low">
                <span class="ell-tag">LOW (LAP)</span>
                <span>${I("moon", 14)} Sleep</span>
              </div>
            </div>
            <div class="el-footer">
              ${I("doublePinch", 14)} Double pinch to log Feed
            </div>
          </div>
        `
      },

      // ── Group 5: Multi-Child & Team Sensor Actions
      {
        id: "twinflickswitch", n: 17, group: "sensorfamily", round: 3, prefers: "dark",
        name: "Double-Pinch Twin Switcher",
        tagline: "Double pinch logs for active twin; quick outward wrist flick swaps Mia ↔ Leo",
        concept: "Parents of twins need zero-touch switching between babies. Screen defaults to the twin due next (Mia). Double pinch logs for Mia. If you are handling Leo instead, a quick outward wrist flick swaps the target to Leo, then double pinch logs for Leo. Double clench logs for both.",
        moves: [
          "Wrist Flick: instant toggle between Mia and Leo",
          "Double Pinch: logs for currently focused baby",
          "Double Clench: logs simultaneous tandem action for Both",
          "Zero taps on screen needed for twins"
        ],
        facts: { Type: "Multi-Child Kinetic Router", Effort: "M", Sensors: "Gyroscope Flick + Double Tap" },
        palette: [["Mia Coral", "#FF6B6B"], ["Leo Teal", "#4ECDC4"], ["Both Gold", "#FFD166"]],
        render: () => `
          <div class="twinflick-screen">
            <div class="tf-header">
              <span class="tf-baby mia active">MIA (SELECTED)</span>
              <span class="tf-baby leo">LEO</span>
            </div>
            <div class="tf-card">
              <div class="tfc-name">MIA DUE: BOTTLE 120ml</div>
              <div class="tfc-sub">2h 40m since feed</div>
            </div>
            <div class="tf-controls">
              <div class="tfc-row">
                <span class="tfc-gesture">${I("flick", 14)}</span>
                <span>Flick wrist to switch to Leo</span>
              </div>
              <div class="tfc-row active">
                <span class="tfc-gesture">${I("doublePinch", 14)}</span>
                <b>Double pinch to log for Mia</b>
              </div>
            </div>
          </div>
        `
      },

      {
        id: "clenchsyncboth", n: 18, group: "sensorfamily", round: 3, prefers: "dark",
        name: "Clench-Hold Tandem Sync",
        tagline: "Clench fist and hold for 1.5s to log tandem feeding for both twins at once",
        concept: "When feeding twins simultaneously (tandem nursing or twin bottles), holding a clench of your fist for 1.5 seconds triggers a dual-log transaction. Logs 120ml for Mia AND 120ml for Leo with synchronized group event IDs in Supabase.",
        moves: [
          "Sustained 1.5s fist clench detected via optical PPG",
          "Circular progress ring fills as clench is held",
          "Creates paired synchronized events for Mia and Leo",
          "Eliminates 4 individual touch interactions"
        ],
        facts: { Type: "Tandem Hold Gesture", Effort: "M", Sensors: "Optical Heart PPG + Accelerometer" },
        palette: [["Tandem Gold", "#FFD166"], ["Both Coral", "#FF6B6B"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="clenchsync-screen">
            ${watchHeader({ time: "9:41", child: "TWINS", sensorTag: "TANDEM" })}
            <div class="cs-hero">
              <div class="cs-anim-clench">
                ${I("clench", 36)}
              </div>
              <div class="cs-title">CLENCH 1.5s FOR BOTH</div>
              <div class="cs-sub">Logs 120ml to Mia & Leo together</div>
            </div>
            <div class="cs-bar">
              <span>Hold fist closed until haptic buzz</span>
            </div>
          </div>
        `
      },

      {
        id: "chestproximity", n: 19, group: "sensorfamily", round: 3, prefers: "dark",
        name: "Chest Proximity Sleep Sensor",
        tagline: "Resting watch case against baby's chest reads soothing rhythm and logs sleep start",
        concept: "When putting a baby down on your chest, resting the Apple Watch sapphire sensor case against baby's torso reads subtle respiratory cadence (12-20 breaths/min). Once settled for 45 seconds, the watch records sleep onset hands-free with a quiet haptic tick.",
        moves: [
          "Optical PPG and accelerometer detects steady respiratory sinus rhythm",
          "Auto-records sleep start once baby enters steady resting state",
          "Zero buttons pressed; parents simply hold baby skin-to-skin",
          "Sends quiet notification to partner: 'Mia fell asleep on chest'"
        ],
        facts: { Type: "Biofeedback Sleep Detector", Effort: "L", Sensors: "Optical PPG + High-Gain Accelerometer" },
        palette: [["Heartbeat Rose", "#FF375F"], ["Sleep Indigo", "#5E5CE6"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="chestprox-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "SKIN-TO-SKIN" })}
            <div class="cp-pulse-box">
              <div class="cpp-ico">${I("heart", 36)}</div>
              <div class="cpp-status">RESTING ON CHEST</div>
              <div class="cpp-cadence">Respiration: 28 / min (Steady)</div>
            </div>
            <div class="cp-footer">
              <span>Auto-logs sleep when settled 45s</span>
            </div>
          </div>
        `
      },

      {
        id: "bumptransfer", n: 20, group: "sensorfamily", round: 3, prefers: "dark",
        name: "Shift Wrist-Bump Transfer",
        tagline: "Bump watches together with partner to transfer night shift duty and sync logs",
        concept: "When your partner comes into the nursery to take over the 3 AM shift, bump your Apple Watch wrists together. The simultaneous accelerometer impact spike and Bluetooth RSSI proximity hand off active caregiver duty, log the transfer, and sync offline events in 1 second.",
        moves: [
          "Simultaneous accelerometer spike (>1.8G) paired over Bluetooth RSSI",
          "Instant household shift hand-off without unlocking phone or watch",
          "Haptic high-five (.success) on both watches simultaneously",
          "Audits exact shift exchange time in Wee Hours household log"
        ],
        facts: { Type: "Kinetic Bump Protocol", Effort: "M", Sensors: "Accelerometer Spike + Bluetooth CoreBluetooth" },
        palette: [["Bump Violet", "#AF52DE"], ["Partner Teal", "#30B0C7"], ["OLED Black", "#000000"]],
        render: () => `
          <div class="bump-screen">
            ${watchHeader({ time: "9:41", child: "Mia", sensorTag: "BUMP SHIFT" })}
            <div class="bs-hero">
              <div class="bs-bump-ico">
                ${I("bump", 40)}
              </div>
              <div class="bs-title">BUMP WRISTS TO SWAP</div>
              <div class="bs-sub">Tianhao → Sarah</div>
            </div>
            <div class="bs-footer">
              <span>Bump Apple Watches to transfer shift</span>
            </div>
          </div>
        `
      }
    ]
  };
})();
