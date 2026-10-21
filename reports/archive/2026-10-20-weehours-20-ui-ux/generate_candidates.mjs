// Generator script for Wee Hours 20 UI/UX Improvements
// Generates reports/archive/2026-10-20-weehours-20-ui-ux/site/js/candidates.js
import fs from "fs";
import path from "path";

const candidatesJsPath = "reports/archive/2026-10-20-weehours-20-ui-ux/site/js/candidates.js";

// Let's create the file content
const content = `// Wee Hours · 20 Potential UI/UX Improvements
// Grounded in projects/weehours/ (CLAUDE.md, docs/decisions.md, spec/event-types.json, HomeView.swift, TimelineView.swift, CareView.swift, GrowthView.swift, ListeningView.swift, SettingsView.swift)

(() => {
  const K = KIT;
  const I = K.icon;
  const { mia, leo } = K;

  // ── Baseline Screens
  const baselineNow = () => K.phone(
    \`\${K.nav("Mia", K.pill("3 weeks"))}
     \${K.statusCard(mia.status)}
     \${K.grid(K.defaultTiles(mia))}\`
  );
  const baselineMulti = () => K.phone(
    \`\${K.nav("Mia &amp; Leo", K.pill("3 weeks"))}
     \${K.childrenPanel("mia")}
     \${K.grid(K.defaultTiles(mia))}\`
  );
  const baselineTimeline = () => K.phone(
    \`\${K.nav("Timeline", \`<span class="tbtn">\${I("undo", 16)}</span>\`)}
     <div class="seg2"><span class="on">All</span><span>Mia</span><span>Leo</span></div>
     <div class="day">Monday, October 19, 2026</div>
     <div class="card evs">\${K.sampleEvents.map((e) => K.evRow(e, { multi: true })).join("")}</div>\`,
    { tab: "timeline" }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER 1: NIGHT NURSERY & FAST THUMB ERGONOMICS (C01 - C04)
  // ══════════════════════════════════════════════════════════════════════════

  // ── C01 · Night Nursery HUD
  const renderC01 = (mode = "amber") => \`
    <div class="scr c01-night-\${mode} \${mode === "amber" ? "dark" : "dark"}">
      <div class="sb"><b>3:12</b><span>●●● ▮</span></div>
      <div class="body" style="padding:10px 18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <span style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--acc)">NIGHT NURSERY HUD</span>
            <h1 style="margin:2px 0 0;font-size:26px;font-weight:800;color:var(--ink)">Mia · 3:12 AM</h1>
          </div>
          <span style="padding:4px 10px;border-radius:99px;border:1px solid var(--sep);font-size:12px;font-weight:700;color:var(--ink)">0.5 LUX</span>
        </div>
        <div style="padding:10px 14px;border-radius:16px;background:var(--card);border:1px solid var(--sep);margin-bottom:14px;font-size:13.5px;font-weight:600;color:var(--ink)">
          Fed 1h20m ago · left next · diaper 40m ago
        </div>
        <div class="night-hud-grid">
          <div class="nh-tile">\${I("bottle", 36)}<span>Bottle</span><small style="font-size:12px;color:var(--mut)">90 ml</small></div>
          <div class="nh-tile">\${I("heart", 36)}<span>Nursing</span><small style="font-size:12px;color:var(--mut)">Left side</small></div>
          <div class="nh-tile">\${I("drop", 36)}<span>Diaper</span><small style="font-size:12px;color:var(--mut)">Wet · Dirty</small></div>
          <div class="nh-tile">\${I("moon", 36)}<span>Sleep</span><small style="font-size:12px;color:var(--mut)">Start nap</small></div>
        </div>
        <div style="margin-top:20px;text-align:center;font-size:12px;color:var(--mut)">
          Auto-switched during Quiet Hours (10 PM – 6 AM)
        </div>
      </div>
    </div>\`;

  // ── C02 · Dynamic Island & Lock Screen Live Activity
  const renderC02Lock = () => K.phone(
    K.lockScreen(\`
      <div class="dyn-island">
        \${I("heart", 16)}<span>Nursing · Left</span><span style="color:var(--acc)">14:22</span>
      </div>
      <div class="live-act">
        <div class="la-top">
          <b>WEE HOURS · ACTIVE SESSION</b>
          <span>Mia (3 weeks)</span>
        </div>
        <div class="la-mid">
          <div>
            <div class="la-timer">14:22</div>
            <small style="color:#8E8E93">Started at 2:58 AM</small>
          </div>
          <div class="la-side">\${I("check", 13)} Left Breast</div>
        </div>
        <div class="la-bar"><div class="la-fill"></div></div>
        <div class="la-btns">
          <div class="la-btn">\${I("swap", 15)} Switch to Right</div>
          <div class="la-btn pri">\${I("check", 15)} Finish Feed</div>
        </div>
      </div>
      <div style="padding:12px 14px;border-radius:18px;background:#111113;border:1px solid #222226;color:#8E8E93;font-size:12px;display:flex;justify-content:space-between">
        <span>Last bottle: 1:40 AM (90 ml)</span>
        <span style="color:#fff">Diaper: 40m ago</span>
      </div>
    \`),
    { fab: false }
  );

  const renderC02Island = () => K.phone(
    \`\${K.nav("Mia", K.pill("3 weeks"))}
     <div class="dyn-island" style="width:240px;height:44px;margin-bottom:16px;padding:0 14px">
       <span style="display:flex;align-items:center;gap:6px">\${I("heart", 18)}<b>Nursing</b></span>
       <span style="color:var(--acc);font-weight:800">14:22</span>
       <span style="font-size:11px;background:#34C759;color:#000;padding:2px 7px;border-radius:99px;font-weight:800">L</span>
     </div>
     \${K.statusCard("Active nursing session on Left side · 14m")}
     \${K.grid(K.defaultTiles(mia))}\`
  );

  // ── C03 · One-Handed Thumb Sweep Radial Dock
  const renderC03 = (hand = "right") => K.phone(
    \`\${K.nav("Mia", K.pill("Thumb Arc"))}
     \${K.statusCard(mia.status)}
     <div style="padding:12px;border-radius:16px;background:var(--card);font-size:12.5px;color:var(--mut);line-height:1.35;margin-bottom:12px">
       Hold baby in your \${hand === "right" ? "left" : "right"} arm. All primary logging actions sweep under your natural \${hand} thumb reach without stretching.
     </div>
     <div class="thumb-arc-container">
       <div class="arc-sweep \${hand}"></div>
       <div class="arc-button pri" style="\${hand === "right" ? "bottom:130px;right:22px" : "bottom:130px;left:22px"}">
         \${I("bottle", 22)}<span>Bottle</span>
       </div>
       <div class="arc-button" style="\${hand === "right" ? "bottom:100px;right:105px" : "bottom:100px;left:105px"}">
         \${I("heart", 22)}<span>Nurse</span>
       </div>
       <div class="arc-button" style="\${hand === "right" ? "bottom:32px;right:145px" : "bottom:32px;left:145px"}">
         \${I("drop", 22)}<span>Diaper</span>
       </div>
       <div class="arc-button" style="\${hand === "right" ? "bottom:-20px;right:130px" : "bottom:-20px;left:130px"}">
         \${I("moon", 22)}<span>Sleep</span>
       </div>
       <div class="arc-center \${hand}">
         \${I("mic", 32)}
       </div>
     </div>\`,
    { fab: false }
  );

  // ── C04 · 1-Tap Diaper Matrix & Stool Color Scale
  const renderC04 = (expanded = false) => K.phone(
    \`\${K.nav("Mia", K.pill("3 weeks"))}
     \${K.statusCard("Diaper logged 40m ago (wet)")}
     <div class="card" style="padding:14px">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
         <b>Quick Diaper Matrix</b>
         <span style="font-size:11.5px;color:var(--acc);font-weight:700">1-TAP LOG</span>
       </div>
       <div class="diaper-matrix-grid">
         <div class="dm-cell on">\${I("drop", 24)}<span>Wet Only</span><small style="color:var(--mut);font-size:10.5px">Pee</small></div>
         <div class="dm-cell">\${I("spark", 24)}<span>Dirty Only</span><small style="color:var(--mut);font-size:10.5px">Poop</small></div>
         <div class="dm-cell">\${I("stars", 24)}<span>Both</span><small style="color:var(--mut);font-size:10.5px">Wet + Dirty</small></div>
         <div class="dm-cell">\${I("sun", 24)}<span>Dry Check</span><small style="color:var(--mut);font-size:10.5px">Clean</small></div>
       </div>
       <div style="font-size:11.5px;font-weight:700;color:var(--mut);margin-bottom:6px">STOOL COLOR &amp; TEXTURE (NEWBORN SCALE)</div>
       <div class="stools-row">
         <div class="stool-dot on" style="background:#D4A017">Must</div>
         <div class="stool-dot" style="background:#6B4423">Brwn</div>
         <div class="stool-dot" style="background:#4A6B34">Grn</div>
         <div class="stool-dot" style="background:#1C1C1E">Mec</div>
         <div class="stool-dot" style="background:#E53935">Warn</div>
       </div>
       <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--mut)">
         <span>Normal breastmilk mustard yellow</span>
         <span style="color:#34C759;font-weight:700">Healthy</span>
       </div>
     </div>
     \${K.grid(K.defaultTiles(mia).slice(0, 4))}\`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER 2: CIRCADIAN RHYTHM, WAKE WINDOWS & TIMELINE (C05 - C08)
  // ══════════════════════════════════════════════════════════════════════════

  // ── C05 · Wake Window & Sleep Pressure Gauge
  const renderC05 = () => K.phone(
    \`\${K.nav("Mia", K.pill("3 weeks old"))}
     <div class="card" style="padding:16px 14px;text-align:center">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
         <span style="font-size:11px;font-weight:800;color:var(--sleep);letter-spacing:.06em">WAKE WINDOW · AGE 3 WEEKS</span>
         <span style="font-size:11.5px;font-weight:700;color:var(--mut)">Target 60–90m</span>
       </div>
       \${K.radialGauge({ val: 75, max: 90, label: "75m", sub: "Awake", color: "var(--sleep)", size: 130 })}
       <div style="margin-top:14px;padding:8px 12px;border-radius:12px;background:color-mix(in srgb, var(--sleep) 15%, var(--bg));font-size:13px;font-weight:600;color:var(--sleep)">
         ✨ Optimal soothing sweet spot in <b>15 minutes</b> (before overtired)
       </div>
       <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);margin-top:10px">
         <span>Woke up: 1:57 AM</span>
         <span>Last nap: 2h 10m</span>
       </div>
     </div>
     \${K.grid(K.defaultTiles(mia).slice(0, 6))}\`
  );

  // ── C06 · 24-Hour Circular Circadian Rhythm Dial
  const renderC06 = () => K.phone(
    \`\${K.nav("Circadian Clock", K.pill("24h Dial"))}
     <div class="circadian-wrap card" style="padding:14px 10px">
       <svg class="dial-svg" viewBox="0 0 200 200">
         <circle cx="100" cy="100" r="90" fill="none" stroke="var(--sep)" stroke-width="14" opacity="0.4"/>
         <!-- Night zone (8pm to 7am) -->
         <path d="M 100 10 A 90 90 0 0 1 185 135" fill="none" stroke="var(--sleep)" stroke-width="14" stroke-linecap="round" opacity="0.85"/>
         <path d="M 40 160 A 90 90 0 0 1 95 10" fill="none" stroke="var(--sleep)" stroke-width="14" stroke-linecap="round" opacity="0.85"/>
         <!-- Feed markers (dots) -->
         <circle cx="100" cy="20" r="4.5" fill="var(--feed)"/>
         <circle cx="160" cy="55" r="4.5" fill="var(--feed)"/>
         <circle cx="175" cy="120" r="4.5" fill="var(--feed)"/>
         <circle cx="130" cy="175" r="4.5" fill="var(--feed)"/>
         <circle cx="50" cy="160" r="4.5" fill="var(--feed)"/>
         <circle cx="25" cy="100" r="4.5" fill="var(--feed)"/>
         <!-- Center text -->
         <text x="100" y="94" text-anchor="middle" font-size="20" font-weight="800" fill="currentColor">14h 20m</text>
         <text x="100" y="112" text-anchor="middle" font-size="11" font-weight="600" fill="var(--mut)">Total Sleep (6 naps)</text>
         <text x="100" y="128" text-anchor="middle" font-size="10" font-weight="700" fill="var(--feed)">6 feeds · 640 ml</text>
       </svg>
       <div style="display:flex;justify-content:space-around;font-size:11.5px;font-weight:700;margin-top:8px">
         <span style="color:var(--sleep)">● Sleep 14h 20m</span>
         <span style="color:var(--feed)">● Feeds (6)</span>
         <span style="color:var(--diaper)">● Diapers (8)</span>
       </div>
     </div>
     <div class="card evs">\${K.sampleEvents.slice(0, 3).map((e) => K.evRow(e)).join("")}</div>\`,
    { tab: "timeline" }
  );

  // ── C07 · Stacked "Today vs Yesterday" Rhythm Compare
  const renderC07 = () => K.phone(
    \`\${K.nav("Rhythm Compare", K.pill("Today vs Yest"))}
     <div class="stacked-compare">
       <div class="day-bar-wrap">
         <div class="db-head">
           <span>TODAY (TUE, OCT 20)</span>
           <span style="color:var(--feed);font-weight:800">4 feeds · 410 ml</span>
         </div>
         <div class="db-track">
           <div class="db-seg sleep" style="left:0%;width:35%"></div>
           <div class="db-seg feed" style="left:38%;width:4%"></div>
           <div class="db-seg sleep" style="left:44%;width:26%"></div>
           <div class="db-seg feed" style="left:72%;width:4%"></div>
           <div class="db-seg sleep" style="left:78%;width:18%"></div>
         </div>
         <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mut)">
           <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>Now (3 AM)</span>
         </div>
       </div>

       <div class="day-bar-wrap" style="opacity:0.85">
         <div class="db-head">
           <span>YESTERDAY (MON, OCT 19)</span>
           <span style="color:var(--feed);font-weight:800">6 feeds · 620 ml</span>
         </div>
         <div class="db-track">
           <div class="db-seg sleep" style="left:0%;width:28%"></div>
           <div class="db-seg feed" style="left:30%;width:4%"></div>
           <div class="db-seg sleep" style="left:36%;width:30%"></div>
           <div class="db-seg cluster" style="left:68%;width:12%"></div>
           <div class="db-seg sleep" style="left:82%;width:16%"></div>
         </div>
         <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mut)">
           <span>12 AM</span><span>6 AM</span><span>12 PM</span><span style="color:#FF3B30">Cluster feed</span><span>12 AM</span>
         </div>
       </div>

       <div class="card" style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center">
         <div><b style="font-size:16px;color:#34C759">+45 min</b><small style="display:block;font-size:11px;color:var(--mut)">Night sleep stretch</small></div>
         <div><b style="font-size:16px;color:var(--feed)">-30 ml</b><small style="display:block;font-size:11px;color:var(--mut)">Volume pace</small></div>
       </div>
     </div>\`,
    { tab: "timeline" }
  );

  // ── C08 · Pinch-to-Zoom Semantic Timeline
  const renderC08 = (mode = "compact") => K.phone(
    \`\${K.nav("Timeline", K.pill("Density: " + mode))}
     <div class="zoom-switch">
       <span class="pillr \${mode === "compact" ? "on" : ""}" style="\${mode === "compact" ? "background:var(--ink);color:var(--bg)" : ""}">Compact</span>
       <span class="pillr \${mode === "cards" ? "on" : ""}" style="\${mode === "cards" ? "background:var(--ink);color:var(--bg)" : ""}">Standard</span>
       <span class="pillr \${mode === "audit" ? "on" : ""}" style="\${mode === "audit" ? "background:var(--ink);color:var(--bg)" : ""}">Audit Log</span>
     </div>
     \${mode === "compact" ? \`
       <div style="font-size:11px;font-weight:700;color:var(--mut);margin:6px 4px">24-HOUR PULSE MATRIX (1 HOUR PER SLOT)</div>
       <div class="compact-matrix">
         \${Array.from({length: 24}).map((_, i) => \`
           <div class="cm-slot \${i >= 1 && i <= 3 ? "sl" : ""}">
             <span>\${i}h</span>
             <small style="color:\${i % 4 === 0 ? "var(--feed)" : i % 3 === 0 ? "var(--sleep)" : "var(--mut)"}">●</small>
           </div>
         \`).join("")}
       </div>
       <div class="card evs" style="margin-top:10px">\${K.sampleEvents.slice(0, 3).map((e) => K.evRow(e)).join("")}</div>
     \` : \`
       <div class="card evs">\${K.sampleEvents.map((e) => K.evRow(e, { multi: true, extraRight: mode === "audit" ? "<span class='pillr' style='font-size:10px'>#seq:142</span>" : "" })).join("")}</div>
     \`}\`,
    { tab: "timeline" }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER 3: HOUSEHOLD, TWINS & MULTI-CAREGIVER SYNC (C09 - C12)
  // ══════════════════════════════════════════════════════════════════════════

  // ── C09 · Dual-Child Twin Cockpit
  const renderC09 = () => K.phone(
    \`\${K.nav("Twin Cockpit", K.pill("Tandem Ready"))}
     <div class="tandem-bar">
       <span>\${I("swap", 15)} Tandem Feed Session</span>
       <span class="pillr" style="background:var(--acc);color:#fff">Start Both</span>
     </div>
     <div class="cockpit-split">
       <div class="twin-col" style="--k:\${mia.color}">
         <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
           <b style="color:\${mia.color};font-size:15px">Mia</b>
           <span class="pillr" style="font-size:10.5px">Awake</span>
         </div>
         <p style="font-size:12px;font-weight:700;margin:0 0 6px">Fed 1h20m ago</p>
         <div class="tile feed" style="min-height:70px;padding:8px;margin-bottom:6px">
           <b style="font-size:13px">Bottle</b><small>90 ml</small>
         </div>
         <div class="tile diaper" style="min-height:70px;padding:8px">
           <b style="font-size:13px">Diaper</b><small>40m ago</small>
         </div>
       </div>

       <div class="twin-col" style="--k:\${leo.color}">
         <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
           <b style="color:\${leo.color};font-size:15px">Leo</b>
           <span class="pillr" style="font-size:10.5px;background:var(--sleep);color:#fff">Sleeping</span>
         </div>
         <p style="font-size:12px;font-weight:700;margin:0 0 6px">Asleep 35m</p>
         <div class="tile sleep" style="min-height:70px;padding:8px;margin-bottom:6px">
           <b style="font-size:13px">Wake Up</b><small>In crib</small>
         </div>
         <div class="tile feed" style="min-height:70px;padding:8px">
           <b style="font-size:13px">Bottle</b><small>110 ml due</small>
         </div>
       </div>
     </div>
     \${K.duty("Alex is on duty with Mia · Sam with Leo", "Sync")}\`
  );

  // ── C10 · Live Co-Parent Presence & Active Timer Pulse
  const renderC10 = () => K.phone(
    \`\${K.nav("Mia", K.pill("3 weeks"))}
     <div class="live-pulse-card">
       <div class="pulse-dot"></div>
       <div style="flex:1">
         <b style="font-size:13.5px;color:#28A745;display:block">Alex is prepping a bottle in the kitchen</b>
         <small style="color:var(--mut);font-size:11.5px">Warming 90ml formula · Avoid double-feeding!</small>
       </div>
       <span class="pillr" style="background:#28A745;color:#fff;font-size:11px">LIVE</span>
     </div>
     \${K.statusCard("Fed 1h20m ago · next bottle in progress")}
     \${K.grid(K.defaultTiles(mia))}\`
  );

  // ── C11 · Caregiver Shift Sticky Note & Voice Memo
  const renderC11 = () => K.phone(
    \`\${K.nav("Mia", K.pill("Shift Active"))}
     <div class="sticky-memo">
       <div class="sm-head">
         <span>SHIFT MEMO FROM ALEX (10 PM – 3 AM)</span>
         <span>JUST NOW</span>
       </div>
       <p style="margin:4px 0 6px;font-size:13px;line-height:1.35;font-weight:600">
         “Fussy around 1 AM, gave 1.25ml Tylenol. Extra sterile bottles are drying on the rack.”
       </p>
       <div class="sm-audio">
         \${I("play", 18)}
         <div style="flex:1;height:4px;border-radius:2px;background:rgba(0,0,0,.15)"><div style="width:45%;height:100%;background:#4A3E10;border-radius:2px"></div></div>
         <span style="font-size:11px;font-weight:700">0:08 / 0:14</span>
       </div>
     </div>
     \${K.statusCard(mia.status)}
     \${K.grid(K.defaultTiles(mia).slice(0, 4))}\`
  );

  // ── C12 · Offline Sync Badge & Local Conflict Inspector
  const renderC12 = () => K.phone(
    \`<div class="nav" style="display:flex;justify-content:space-between;align-items:center">
       <h1>Mia</h1>
       <div class="sync-badge-pill">\${I("wifi", 12)}<span>3 Offline Queue</span></div>
     </div>
     <div class="card" style="border:1.5px solid #FF9500;padding:12px 14px">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <b style="color:#D97706;font-size:13px">Nursery Offline Safe-Store</b>
         <span style="font-size:11px;color:var(--mut)">SQLite AppGroup</span>
       </div>
       <p style="margin:0 0 10px;font-size:12.5px;color:var(--mut);line-height:1.35">
         No Wi-Fi signal in basement nursery. All events are safely committed locally and will auto-sync to Supabase once back in range.
       </p>
       <div class="outbox-list">
         <div class="outbox-row"><span>Bottle · 90 ml (3:05 AM)</span><b style="color:#FF9500">Pending</b></div>
         <div class="outbox-row"><span>Diaper · Wet (2:40 AM)</span><b style="color:#FF9500">Pending</b></div>
         <div class="outbox-row"><span>Medication · Tylenol (12:50 AM)</span><b style="color:#FF9500">Pending</b></div>
       </div>
     </div>
     \${K.grid(K.defaultTiles(mia).slice(0, 4))}\`
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER 4: FEEDING, SOLIDS & NUTRITION DEPTH (C13 - C16)
  // ══════════════════════════════════════════════════════════════════════════

  // ── C13 · No-Look Nursing Switcher & Fullscreen Haptic Pad
  const renderC13 = () => K.phone(
    \`<div style="padding:10px 14px 4px;text-align:center">
       <span style="font-size:11px;font-weight:800;color:var(--feed);letter-spacing:.08em">NO-LOOK NURSING HUD</span>
       <h2 style="margin:4px 0 0;font-size:22px;font-weight:800">Double-tap side to switch</h2>
     </div>
     <div class="nursing-pad">
       <div class="pad-side active">
         \${I("heart", 36)}
         <b>LEFT</b>
         <span>14:20</span>
         <small style="color:var(--feed);font-weight:700">● Active side</small>
       </div>
       <div class="pad-side" style="opacity:0.6">
         \${I("heart", 36)}
         <b>RIGHT</b>
         <span>0:00</span>
         <small style="color:var(--mut)">Double-tap to switch</small>
       </div>
     </div>
     <div style="padding:10px 14px;border-radius:14px;background:var(--card);text-align:center;font-size:12px;color:var(--mut)">
       📳 Haptic stereo feedback: Double heavy pulse for Left · Triple crisp tap for Right
     </div>\`,
    { fab: false }
  );

  // ── C14 · Formula Scoop & Water Ratio Calculator
  const renderC14 = () => K.phone(
    \`\${K.navInline("Cancel", "Log Bottle", "<b class='pri'>Save</b>")}
     <div class="ratio-calc-box">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
         <b>Formula Ratio Assistant</b>
         <span class="pillr">1 scoop = 30 ml (1 oz)</span>
       </div>
       <div class="rc-row">
         <span>Water Volume</span>
         <div class="stepper-ctrl">
           <button>-</button><b style="font-size:16px;min-width:60px;text-align:center">90 ml</b><button>+</button>
         </div>
       </div>
       <div class="rc-row">
         <span>Required Powder</span>
         <div class="stepper-ctrl">
           <button>-</button><b style="font-size:16px;color:var(--acc);min-width:60px;text-align:center">3 scoops</b><button>+</button>
         </div>
       </div>
       <div class="rc-row">
         <span>Formula Brand Preset</span>
         <span style="font-weight:700;color:var(--ink)">Enfamil NeuroPro \${I("chevron", 14)}</span>
       </div>
       <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb, #34C759 15%, var(--bg));font-size:12px;color:#28A745;font-weight:600">
         ✓ Perfect ratio: 3 level unpacked scoops for 90 ml boiled lukewarm water
       </div>
     </div>
     \${K.grid(K.defaultTiles(mia).slice(0, 4))}\`
  );

  // ── C15 · Solids Allergen Introduction Matrix & Streak
  const renderC15 = () => K.phone(
    \`\${K.nav("Solids & Allergens", K.pill("Top 9"))}
     <div class="card" style="padding:12px 14px">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <b>Allergen Exposure Ladder</b>
         <span style="font-size:11.5px;color:var(--acc);font-weight:700">4/9 INTRODUCED</span>
       </div>
       <div class="allergen-grid">
         <div class="ag-card pass"><span>🥜 Peanut</span><small>Day 3/3 ✓</small></div>
         <div class="ag-card pass"><span>🥚 Egg</span><small>Day 3/3 ✓</small></div>
         <div class="ag-card pending"><span>🥛 Cow Milk</span><small>Day 2/3 (Today)</small></div>
         <div class="ag-card pending"><span>🌾 Wheat</span><small>Day 1/3</small></div>
         <div class="ag-card"><span>🐟 Fish</span><small style="color:var(--mut)">Untried</small></div>
         <div class="ag-card"><span>🦐 Shellfish</span><small style="color:var(--mut)">Untried</small></div>
         <div class="ag-card"><span>🌰 Tree Nut</span><small style="color:var(--mut)">Untried</small></div>
         <div class="ag-card"><span>🌱 Soy</span><small style="color:var(--mut)">Untried</small></div>
         <div class="ag-card"><span>🌿 Sesame</span><small style="color:var(--mut)">Untried</small></div>
       </div>
       <div style="margin-top:8px;font-size:12px;color:var(--mut)">
         Rule of thumb: 3 consecutive days of single exposure with 0 reaction before clearing.
       </div>
     </div>\`,
    { tab: "now" }
  );

  // ── C16 · Visual Milk Stash "Freezer Shelf" Organizer
  const renderC16 = () => K.phone(
    \`\${K.nav("Milk Stash", K.pill("1,240 ml total"))}
     <div class="card" style="padding:12px 14px">
       <div style="display:flex;justify-content:space-between;margin-bottom:8px">
         <b>FIFO Storage Rack (Oldest First)</b>
         <span style="color:var(--acc);font-weight:700;font-size:12px">+ Add Bag</span>
       </div>
       <div class="shelf-rack">
         <div class="shelf-tier oldest">
           <div class="st-head">
             <span style="color:#FF3B30">🚨 USE FIRST · DEEP FREEZER</span>
             <b>150 ml · Frozen Oct 2</b>
           </div>
           <small style="color:var(--mut)">Bag #08 · Pumped by Alex · 18 days old</small>
         </div>
         <div class="shelf-tier">
           <div class="st-head">
             <span>FRIDGE DOOR</span>
             <b>120 ml · Pumped Yesterday</b>
           </div>
           <small style="color:var(--mut)">Bag #14 · Fresh unpasteurized · Use within 4 days</small>
         </div>
         <div class="shelf-tier">
           <div class="st-head">
             <span>FREEZER BIN 2</span>
             <b>180 ml · Frozen Oct 15</b>
           </div>
           <small style="color:var(--mut)">Bag #12 · Safe until April 2027 (6 months)</small>
         </div>
       </div>
     </div>\`,
    { tab: "now" }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER 5: HEALTH, GROWTH & VOICE ERGONOMICS (C17 - C20)
  // ══════════════════════════════════════════════════════════════════════════

  // ── C17 · Interactive WHO/CDC Growth Percentile Curves
  const renderC17 = () => K.phone(
    \`\${K.nav("Growth Curves", K.pill("WHO Standard"))}
     <div class="growth-chart-box">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <b>Weight-for-Age (Girls 0–6 Mo)</b>
         <span style="font-size:12px;color:var(--growth);font-weight:800">Mia · 62nd %ile</span>
       </div>
       <svg class="gc-svg" viewBox="0 0 300 140">
         <!-- Grid lines -->
         <line x1="30" y1="20" x2="290" y2="20" stroke="var(--sep)" stroke-dasharray="2 2"/>
         <line x1="30" y1="60" x2="290" y2="60" stroke="var(--sep)" stroke-dasharray="2 2"/>
         <line x1="30" y1="100" x2="290" y2="100" stroke="var(--sep)" stroke-dasharray="2 2"/>
         <!-- WHO 97th percentile -->
         <path d="M 30 90 Q 150 50 290 20" fill="none" stroke="var(--mut)" stroke-width="1.2" opacity="0.4"/>
         <!-- WHO 50th percentile -->
         <path d="M 30 110 Q 150 75 290 45" fill="none" stroke="var(--mut)" stroke-width="1.8" opacity="0.7"/>
         <!-- WHO 3rd percentile -->
         <path d="M 30 128 Q 150 105 290 80" fill="none" stroke="var(--mut)" stroke-width="1.2" opacity="0.4"/>
         <!-- Mia's measured trajectory -->
         <path d="M 30 115 Q 50 108 75 98" fill="none" stroke="var(--growth)" stroke-width="3"/>
         <circle cx="30" cy="115" r="4" fill="var(--growth)"/>
         <circle cx="50" cy="108" r="4" fill="var(--growth)"/>
         <circle cx="75" cy="98" r="5" fill="var(--growth)" stroke="#fff" stroke-width="1.5"/>
         <!-- Labels -->
         <text x="25" y="102" font-size="9" text-anchor="end" fill="var(--mut)">3.2kg</text>
         <text x="25" y="62" font-size="9" text-anchor="end" fill="var(--mut)">4.5kg</text>
         <text x="25" y="22" font-size="9" text-anchor="end" fill="var(--mut)">6.0kg</text>
         <text x="30" y="136" font-size="9" fill="var(--mut)">Birth</text>
         <text x="75" y="136" font-size="9" fill="var(--growth)" font-weight="700">3 Wks (4.1kg)</text>
         <text x="180" y="136" font-size="9" fill="var(--mut)">2 Mo</text>
         <text x="280" y="136" font-size="9" fill="var(--mut)">4 Mo</text>
       </svg>
       <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);margin-top:6px">
         <span>Gain: <b>+190 g / week</b> (Healthy)</span>
         <span>Pediatrician checkup: Nov 12</span>
       </div>
     </div>\`,
    { tab: "now" }
  );

  // ── C18 · Fever Curve with Antipyretic Medication Overlay
  const renderC18 = () => K.phone(
    \`\${K.nav("Fever & Meds", K.pill("24h Curve"))}
     <div class="fever-chart-box">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <b>Temperature &amp; Antipyretic Doses</b>
         <span style="color:#FF3B30;font-weight:800;font-size:13px">Current 99.4°F</span>
       </div>
       <svg class="fc-svg" viewBox="0 0 300 130">
         <!-- Fever line threshold (100.4 F) -->
         <line x1="30" y1="40" x2="290" y2="40" stroke="#FF3B30" stroke-dasharray="3 3"/>
         <text x="288" y="36" font-size="8" fill="#FF3B30" text-anchor="end" font-weight="700">100.4°F (Fever)</text>
         <!-- Temp Curve -->
         <path d="M 30 85 Q 90 20 150 35 T 270 70" fill="none" stroke="#FF4757" stroke-width="2.5"/>
         <!-- Dose Pin at 12:50 AM -->
         <line x1="120" y1="20" x2="120" y2="105" stroke="var(--health)" stroke-width="1.5" stroke-dasharray="2 2"/>
         <rect x="95" y="12" width="50" height="18" rx="5" fill="var(--health)"/>
         <text x="120" y="24" font-size="8" fill="#fff" text-anchor="middle" font-weight="700">Tylenol 1.25ml</text>
         <!-- Data dots -->
         <circle cx="30" cy="85" r="3.5" fill="#FF4757"/>
         <circle cx="90" cy="30" r="3.5" fill="#FF4757"/>
         <circle cx="150" cy="35" r="3.5" fill="#FF4757"/>
         <circle cx="210" cy="55" r="3.5" fill="#FF4757"/>
         <circle cx="270" cy="70" r="4.5" fill="#FF4757" stroke="#fff" stroke-width="1.5"/>
         <!-- Time axis -->
         <text x="30" y="122" font-size="9" fill="var(--mut)">8 PM</text>
         <text x="120" y="122" font-size="9" fill="var(--health)" font-weight="700">12:50 AM</text>
         <text x="210" y="122" font-size="9" fill="var(--mut)">2 AM</text>
         <text x="270" y="122" font-size="9" fill="var(--mut)">3:12 AM</text>
       </svg>
       <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb, var(--health) 15%, var(--bg));font-size:12px">
         ⏱ <b>Next Tylenol dose safe in:</b> <span style="color:var(--health);font-weight:800">1 hour 38 minutes</span> (4h cooldown)
       </div>
     </div>\`,
    { tab: "now" }
  );

  // ── C19 · WhisperKit Confidence Tray & Fast-Correction Picker
  const renderC19 = () => K.phone(
    \`<div class="listen-scr">
       <div class="ltop">
         <span class="ltpill">\${I("mic", 14)} Listening (WhisperKit)</span>
         <span class="lauto">Tap chip to adjust</span>
       </div>
       <div class="live-tx">
         <p>“Mia drank <span class="token-under">90 ml</span> of formula on the couch”</p>
       </div>
       <div class="card transcript-tray" style="width:100%;text-align:left">
         <div style="font-size:11.5px;font-weight:800;color:var(--acc);margin-bottom:6px">DETECTED VOLUME (TAP ALTERNATIVE)</div>
         <div class="tray-choices">
           <div class="tc-chip">60 ml</div>
           <div class="tc-chip" style="background:var(--acc);color:#fff">90 ml ✓</div>
           <div class="tc-chip">120 ml</div>
           <div class="tc-chip">Custom...</div>
         </div>
       </div>
       <div class="ldone">\${I("check", 36, 2.5)}</div>
       <div class="lcancel">Auto-committing in 2s...</div>
     </div>\`,
    { fab: false }
  );

  // ── C20 · Timeline Multi-Select & Batch Timestamp Shift
  const renderC20 = () => K.phone(
    \`\${K.navInline("Cancel", "3 Selected", "<b class='pri'>Done</b>")}
     <div class="batch-bar">
       <span>3 late logs selected</span>
       <span style="color:var(--acc)">Shift +15m \${I("clock", 14)}</span>
     </div>
     <div class="card evs">
       <div class="ev" style="align-items:center">
         <div class="batch-check on">\${I("check", 12)}</div>
         \${K.evRow(K.sampleEvents[0]).replace(/<div class="ev">.*?<div class="evb">/, '<div class="evb">')}
       </div>
       <div class="ev" style="align-items:center">
         <div class="batch-check on">\${I("check", 12)}</div>
         \${K.evRow(K.sampleEvents[1]).replace(/<div class="ev">.*?<div class="evb">/, '<div class="evb">')}
       </div>
       <div class="ev" style="align-items:center">
         <div class="batch-check on">\${I("check", 12)}</div>
         \${K.evRow(K.sampleEvents[2]).replace(/<div class="ev">.*?<div class="evb">/, '<div class="evb">')}
       </div>
     </div>
     <div style="display:flex;gap:8px;padding:0 4px;margin-top:10px">
       <div class="pillr" style="flex:1;text-align:center;padding:8px">\${I("clock", 13)} Shift Time</div>
       <div class="pillr" style="flex:1;text-align:center;padding:8px">\${I("swap", 13)} Assign to Leo</div>
       <div class="pillr" style="flex:1;text-align:center;padding:8px;color:#FF3B30">\${I("trash", 13)} Delete</div>
     </div>\`,
    { tab: "timeline" }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // WINDOW.REVIEW CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════

  window.REVIEW = {
    key: "2026-10-20-weehours-20-ui-ux-v1",
    dir: "reports/archive/2026-10-20-weehours-20-ui-ux",
    repo: "tianhaoz95/hejitech-apps",
    port: 8796,
    project: "projects/weehours",
    context: [
      "projects/weehours/CLAUDE.md",
      "projects/weehours/docs/decisions.md",
      "projects/weehours/spec/event-types.json",
      "projects/weehours/apps/ios/App/Sources/HomeView.swift",
      "projects/weehours/apps/ios/App/Sources/TimelineView.swift",
      "projects/weehours/apps/ios/App/Sources/CareView.swift",
      "projects/weehours/apps/ios/App/Sources/GrowthView.swift",
      "projects/weehours/apps/ios/App/Sources/ListeningView.swift",
      "projects/weehours/apps/ios/App/Sources/SettingsView.swift"
    ],
    brief: "Brainstorm 20 high-leverage UI/UX improvements for Wee Hours (newborn log). Focus on sleep-deprived parent ergonomics, fast thumb-reach night logging, lock-screen/dynamic island controls, circular circadian rhythms, wake window pressure, twin cockpits, medication safety curves, and offline transparency.",
    title: "Wee Hours",
    subtitle: "20 Potential UI/UX Improvements",
    heading: "20 Ergonomic Directions for Sleep-Deprived Parents",
    intro: \`<p>Wee Hours is an append-only, local-first newborn log for iOS, Apple Watch, and MCP agents. In v0.5.0, shift handoffs, milk stash, solids, and doctor visits shipped. These 20 UI/UX directions explore the next generation of parent ergonomics: night-nursery HUDs, Lock Screen Live Activities, 1-handed thumb arcs, wake window countdowns, twin split cockpits, and fever-medication curve overlays.</p>\`,
    legend: ["<b>20</b> directions", "<b>5</b> ergonomic clusters", "<b>1</b> baseline"],
    round: 1,
    frame: "phone",
    modes: true,
    groups: [
      { id: "night", name: "Cluster 1 · Night Nursery & Fast Thumb Ergonomics", note: "Pitch-black 3 AM nursery UX, Live Activity, thumb arcs, and fast diaper matrix" },
      { id: "rhythm", name: "Cluster 2 · Circadian Rhythm, Wake Windows & Timeline", note: "Visualizing sleep pressure, 24h polar rhythm dials, and semantic timeline density" },
      { id: "household", name: "Cluster 3 · Household, Twins & Multi-Caregiver Sync", note: "Twin dual cockpits, partner presence pulse, shift audio notes, and offline safety" },
      { id: "nutrition", name: "Cluster 4 · Feeding, Solids & Nutrition Depth", note: "No-look nursing gestures, formula ratio math, allergen streaks, and freezer shelf" },
      { id: "health", name: "Cluster 5 · Health, Growth & Voice Corrections", note: "WHO percentile curves, fever-med overlay, voice disambiguation tray, and batch timeline edits" }
    ],
    candidates: [
      // Baseline Candidate 00
      {
        id: "baseline-v050", n: 0, group: "night", baseline: true,
        name: "Today (v0.5.0)",
        tagline: "Current Now & Timeline screens for reference",
        concept: "The shipped baseline of Wee Hours v0.5.0: standard iOS navigation, 2x4 action grid, single-child and twin panels, and linear vertical timeline.",
        moves: ["Standard 2x4 action grid", "Status line card with duty handoff", "Linear scrollable timeline"],
        palette: [["Accent", "#F29E66"], ["Card", "#F2F2F7"]],
        facts: { Area: "Baseline", Effort: "Shipped", Status: "v0.5.0 Live" },
        render: () => baselineNow(),
        views: [
          { name: "Now (1 child)", render: () => baselineNow() },
          { name: "Now (twins)", render: () => baselineMulti() },
          { name: "Timeline", render: () => baselineTimeline() }
        ]
      },

      // ── CLUSTER 1: NIGHT & THUMB (01 - 04)
      {
        id: "c01-night-glow", n: 1, group: "night", round: 1, prefers: "dark",
        name: "Night Nursery HUD (OLED Amber/Red Shift)",
        tagline: "Ultra-low luminance 2x2 grid with deep black and warm glowing OLED text",
        concept: "At 3:15 AM in a pitch-black nursery, standard screens blind sleep-deprived parents and wake the baby. This dedicated HUD auto-activates below 1 lux or during quiet hours, dropping brightness to minimum and rendering giant 2x2 touch targets in amber or rhodopsin-safe crimson.",
        moves: [
          "OLED true-black (#050505) background with warm amber (#FF9E2C) or deep red text",
          "Giant 2x2 primary button grid (Bottle, Nursing, Diaper, Sleep) for zero-aim thumb taps",
          "Suppresses secondary clutter, headers, and tabs until dismissed",
          "Auto-activates during configured quiet hours or via ambient light sensor"
        ],
        palette: [["Amber Glow", "#FF9E2C"], ["OLED Black", "#050505"]],
        facts: { Area: "Night Nursery", Effort: "S", Impact: "High Night Comfort" },
        render: () => renderC01("amber"),
        views: [
          { name: "Amber Glow Mode", render: () => renderC01("amber"), dark: true },
          { name: "Crimson Red-Shift Mode", render: () => renderC01("crimson"), dark: true }
        ],
        spec: {
          today: ["App follows system light/dark mode without specialized low-light color palettes."],
          proposed: ["Detect ambient lux / quiet hours and provide optional OLED Night HUD with giant 2x2 grid."],
          files: ["apps/ios/App/Sources/HomeView.swift", "apps/ios/App/Sources/SettingsView.swift"],
          risks: ["Users might get confused if app automatically shifts palette without clear manual toggle."],
          verify: ["Verify contrast ratios and instant toggle back to standard UI with swipe-down."]
        }
      },

      {
        id: "c02-live-activity", n: 2, group: "night", round: 1,
        name: "Dynamic Island & Lock Screen Live Activity",
        tagline: "Interactive timers, side switcher, and bottle stepper right on the Lock Screen",
        concept: "Parents frequently have to unlock their iPhone with FaceID while holding a feeding baby. An interactive iOS Live Activity and Dynamic Island widget exposes live timers, side switching, and bottle finish buttons directly on the Lock Screen without unlocking.",
        moves: [
          "Dynamic Island compact and expanded views showing active nursing or bottle timer",
          "Lock Screen ActivityKit widget with elapsed minutes, side indicator, and 1-tap actions",
          "Interactive buttons: 'Switch to Right' and 'Finish Bottle' directly from Lock Screen",
          "Automatic dismissal when session completes or after inactivity timeout"
        ],
        palette: [["Island Tint", "#34C759"], ["Accent", "#F29E66"]],
        facts: { Area: "Lock Screen & Widgets", Effort: "M", Impact: "Huge Hands-Free Convenience" },
        render: () => renderC02Lock(),
        views: [
          { name: "Lock Screen Live Activity", render: () => renderC02Lock() },
          { name: "Dynamic Island Expanded", render: () => renderC02Island() }
        ],
        spec: {
          today: ["Ongoing sessions exist in SharedStore and AppModel, but ActivityKit Live Activities are not registered."],
          proposed: ["Add ActivityKit extension with Live Activity and Dynamic Island presentation."],
          files: ["apps/ios/WeeHoursWidgets/LiveActivity.swift (new)", "apps/ios/App/Sources/AppModel.swift"],
          risks: ["iOS limits background update frequency; must rely on ActivityKit timer text."],
          verify: ["Test starting nursing on phone, verify Lock Screen widget appears and responds to taps."]
        }
      },

      {
        id: "c03-one-hand-reach", n: 3, group: "night", round: 1,
        name: "One-Handed Thumb Sweep Radial Dock",
        tagline: "Ergonomic thumb sweep arc anchoring primary actions in reach while holding baby",
        concept: "When carrying a newborn in one arm, standard grids require dangerous overstretching to reach the top corners. This mode clusters all critical logging buttons along an ergonomic natural thumb sweep arc at the bottom right or left corner.",
        moves: [
          "Curved radial dock positioned along the natural arc of the thumb",
          "One-tap toggle in settings or quick gesture for Left-Hand vs Right-Hand mode",
          "Giant center microphone button for voice capture without shifting hand grip",
          "Subtle haptic tick as the thumb glides across action buttons"
        ],
        palette: [["Thumb Arc", "#F29E66"], ["Card", "#E5E5EA"]],
        facts: { Area: "Ergonomics", Effort: "S", Impact: "Prevents Dropped Phones" },
        render: () => renderC03("right"),
        views: [
          { name: "Right-Hand Arc", render: () => renderC03("right") },
          { name: "Left-Hand Arc", render: () => renderC03("left") }
        ],
        spec: {
          today: ["Buttons are laid out in a fixed 2-column rectangular grid."],
          proposed: ["Introduce an optional ergonomic thumb sweep dock layout in HomeView."],
          files: ["apps/ios/App/Sources/HomeView.swift"],
          risks: ["Takes up vertical space on smaller screen sizes (iPhone SE)."],
          verify: ["Verify thumb reachability across iPhone 15/16 Pro Max screens."]
        }
      },

      {
        id: "c04-diaper-matrix", n: 4, group: "night", round: 1,
        name: "1-Tap Diaper Matrix & Stool Color Scale",
        tagline: "2x2 Wet/Dirty/Both/Dry selector with 1-tap Bristol stool color swatches",
        concept: "Diaper logging currently requires tapping the diaper tile and picking from sheets. This candidate puts a direct 2x2 matrix (Wet, Dirty, Both, Dry) with instant newborn stool color swatches (Mustard, Brown, Green, Meconium) directly accessible in a single motion.",
        moves: [
          "2x2 matrix on Now: Wet, Dirty, Both, Dry Check logged in 1 tap",
          "Horizontal swatch bar for newborn stool color verification (Mustard, Brown, Green, Meconium)",
          "Instant pediatric warning indicator if red/white stool is logged",
          "No sheet popups required for standard changes"
        ],
        palette: [["Diaper Blue", "#73BFF2"], ["Mustard", "#D4A017"]],
        facts: { Area: "Quick Logging", Effort: "S", Impact: "Halves Diaper Taps" },
        render: () => renderC04(false),
        views: [
          { name: "Direct Diaper Matrix", render: () => renderC04(false) }
        ],
        spec: {
          today: ["Diaper tile opens a bottom sheet with picker tabs."],
          proposed: ["Provide inline 2x2 matrix and stool color chips on Now card."],
          files: ["apps/ios/App/Sources/CareView.swift", "apps/ios/App/Sources/HomeView.swift"],
          risks: ["Increases card density on Now screen."],
          verify: ["Confirm single tap creates proper append-only diaper event in LogService."]
        }
      },

      // ── CLUSTER 2: RHYTHM & TIMELINE (05 - 08)
      {
        id: "c05-wake-window-gauge", n: 5, group: "rhythm", round: 1,
        name: "Wake Window & Sleep Pressure Gauge",
        tagline: "Factual radial countdown to baby's optimal soothing sweet spot based on age",
        concept: "Newborns become overtired if kept awake too long, leading to intense crying fits. A clean circular radial gauge calculates elapsed wake time against standard pediatric wake windows for the baby's exact age (e.g. 60–90 min for a 3-week-old), highlighting the sweet spot window.",
        moves: [
          "Circular radial progress gauge showing elapsed minutes since last wake-up",
          "Age-calibrated target window bracket (e.g. 60–90m at 3 weeks, 90–120m at 2 months)",
          "Highlighting the 'Optimal Soothing Sweet Spot' before overtired cortisol spikes",
          "Purely factual calculation derived from baby birthday and last sleep.end event"
        ],
        palette: [["Sleep Purple", "#9E94F2"], ["Sweet Spot", "#34C759"]],
        facts: { Area: "Circadian Rhythm", Effort: "M", Impact: "Prevents Meltdowns" },
        render: () => renderC05(),
        views: [
          { name: "Wake Window Gauge", render: () => renderC05() }
        ],
        spec: {
          today: ["Status line states 'Fed Xm ago · asleep Ym ago' without wake window context."],
          proposed: ["Calculate wake duration and display pediatric age-appropriate soothing window."],
          files: ["apps/ios/LogCore/Sources/Derive.swift", "apps/ios/App/Sources/HomeView.swift"],
          risks: ["Must remain non-prescriptive and strictly factual per decisions.md."],
          verify: ["Verify calculations across newborn ages (0-12 months)."]
        }
      },

      {
        id: "c06-circadian-clock", n: 6, group: "rhythm", round: 1,
        name: "24-Hour Circular Circadian Rhythm Dial",
        tagline: "Polar clock mapping day/night cycles, sleep segments, and feeds on a clock ring",
        concept: "Linear lists fail to convey 24-hour day/night rhythm consolidation. A polar 24-hour clock dial visualizes sleep arcs, feeding dots, and diaper changes around a circular clock face, making day/night confusion immediately apparent to sleep-deprived parents.",
        moves: [
          "24-hour polar coordinate clock dial with day (sun) and night (moon) sectors",
          "Color-coded sleep duration arcs and discrete feed/diaper dots on the circumference",
          "Center HUD displaying 24h total sleep, nap count, and total milk volume",
          "Spin or swipe to scrub through past days"
        ],
        palette: [["Polar Ring", "#9E94F2"], ["Feed Dot", "#FAB373"]],
        facts: { Area: "Visualization", Effort: "M", Impact: "Instant Circadian Overview" },
        render: () => renderC06(),
        views: [
          { name: "24h Polar Dial", render: () => renderC06() }
        ],
        spec: {
          today: ["Timeline is a vertical linear list grouped by day."],
          proposed: ["Add polar circular 24h visualization toggle in TimelineView."],
          files: ["apps/ios/App/Sources/TimelineView.swift"],
          risks: ["Requires careful SVG/Canvas drawing for crisp rendering."],
          verify: ["Verify all 24 hours map correctly from local midnight to midnight."]
        }
      },

      {
        id: "c07-split-day-compare", n: 7, group: "rhythm", round: 1,
        name: "Stacked “Today vs Yesterday” Rhythm Compare",
        tagline: "Two synchronized horizontal strips comparing feeding intervals and sleep shifts",
        concept: "When a baby is fussy or cluster-feeding, parents ask: 'Is this normal? What did we do yesterday?' This view stacks Today and Yesterday as synchronized 24-hour timeline ribbons, highlighting schedule shifts, growth spurts, and cluster feeding in red.",
        moves: [
          "Stacked horizontal ribbons representing Today vs Yesterday aligned by hour",
          "Color-coded segments for sleep and bottle feeds with cluster-feeding callout tags",
          "Delta summary chips: '+45 min night sleep', '-30 ml volume pace'",
          "Tap any ribbon segment to jump directly to that event in the timeline"
        ],
        palette: [["Feed Orange", "#FAB373"], ["Cluster Red", "#FF3B30"]],
        facts: { Area: "Trends", Effort: "M", Impact: "Answers 'Is This Normal?'" },
        render: () => renderC07(),
        views: [
          { name: "Today vs Yesterday Strip", render: () => renderC07() }
        ],
        spec: {
          today: ["Timeline shows individual days separated by date headers."],
          proposed: ["Render synchronized comparison ribbon between current day and previous day."],
          files: ["apps/ios/App/Sources/TimelineView.swift"],
          risks: ["Complex edge cases during daylight saving shifts."],
          verify: ["Verify time alignment matches exactly between both 24-hour tracks."]
        }
      },

      {
        id: "c08-timeline-density-zoom", n: 8, group: "rhythm", round: 1,
        name: "Pinch-to-Zoom Semantic Timeline",
        tagline: "Pinch between compact 24h dot matrix, standard cards, and detailed audit view",
        concept: "Busy newborn days can produce 20+ events, making scrolling tedious. Pinch-to-zoom gestures seamlessly transition between a 1-screen 'Compact 24h Dot Matrix', standard readable cards, and an expanded 'Audit Mode' with sequence numbers and raw voice transcripts.",
        moves: [
          "3 semantic zoom levels: Compact Matrix (24 slots), Standard Cards, Audit Mode",
          "Compact mode shows the entire 24 hours on one screen without scrolling",
          "Audit mode displays sequence IDs, device provenance (Watch vs Phone), and sync status",
          "Pinch gesture or segment chips for quick switching"
        ],
        palette: [["Dark Ink", "#1C1C1E"], ["Accent", "#F29E66"]],
        facts: { Area: "Timeline Navigation", Effort: "M", Impact: "Scales to High-Volume Days" },
        render: () => renderC08("compact"),
        views: [
          { name: "Compact Matrix Mode", render: () => renderC08("compact") },
          { name: "Full Audit Mode", render: () => renderC08("audit") }
        ],
        spec: {
          today: ["TimelineView renders fixed EventRow items with uniform padding."],
          proposed: ["Introduce semantic zoom state controlling density and detail."],
          files: ["apps/ios/App/Sources/TimelineView.swift"],
          risks: ["Pinch gesture recognizers must not conflict with vertical scroll."],
          verify: ["Smooth transition between zoom levels without re-fetching events."]
        }
      },

      // ── CLUSTER 3: HOUSEHOLD & TWINS (09 - 12)
      {
        id: "c09-twin-cockpit", n: 9, group: "household", round: 1,
        name: "Dual-Child Twin Cockpit (Side-by-Side HUD)",
        tagline: "Simultaneous twin columns on Now with synchronized tandem feed sessions",
        concept: "Parents of twins currently have to toggle between Mia and Leo's cards, losing track of who ate last. The Twin Cockpit places both babies side-by-side with synchronized tandem feeding timers and 1-tap logging for both or individual twins.",
        moves: [
          "Side-by-side split columns on Now: Mia (Rose) and Leo (Teal)",
          "1-tap 'Tandem Feed Session' starting nursing or bottle timer for both twins simultaneously",
          "Independent status lines ('Fed 1h20m ago' vs 'Sleeping 35m')",
          "Quick tile actions tailored to each twin's current state"
        ],
        palette: [["Mia Rose", "#E07FA6"], ["Leo Teal", "#3FA58F"]],
        facts: { Area: "Twins / Multiples", Effort: "L", Impact: "Life-Saver for Twin Parents" },
        render: () => renderC09(),
        views: [
          { name: "Twin Cockpit HUD", render: () => renderC09() }
        ],
        spec: {
          today: ["HomeView shows ChildrenPanel with horizontal cards; only one child's tiles are active."],
          proposed: ["Create 2-column cockpit view rendering both children's tiles simultaneously."],
          files: ["apps/ios/App/Sources/HomeView.swift", "apps/ios/App/Sources/AppModel.swift"],
          risks: ["Compact UI requires tight spacing on smaller iPhone screens."],
          verify: ["Ensure tapping tile in Mia's column logs with baby_id=mia, and Leo's with baby_id=leo."]
        }
      },

      {
        id: "c10-caregiver-pulse", n: 10, group: "household", round: 1,
        name: "Live Co-Parent Presence & Active Timer Pulse",
        tagline: "Subtle pulse badge showing when partner is prepping a bottle or nursing to prevent duplicates",
        concept: "In the middle of the night, both sleep-deprived parents often get up or start preparing a bottle simultaneously, resulting in double-feeding or wasted milk. A subtle live presence pulse alerts you when your partner has started an action.",
        moves: [
          "Subtle live pulse banner: 'Alex is prepping a bottle in the kitchen'",
          "Real-time indicator showing active nursing timers started by other household members",
          "Duplicate prevention banner if you tap Bottle while partner is already logging one",
          "Powered by Supabase realtime broadcast channel without persisting unnecessary events"
        ],
        palette: [["Live Green", "#34C759"], ["Card Tint", "#F2F2F7"]],
        facts: { Area: "Household Sync", Effort: "M", Impact: "Prevents Duplicate Feeds" },
        render: () => renderC10(),
        views: [
          { name: "Live Partner Pulse Banner", render: () => renderC10() }
        ],
        spec: {
          today: ["Events sync via Postgres outbox and RLS; active in-progress preparation is not broadcast."],
          proposed: ["Add lightweight ephemeral presence via Supabase Realtime Channel."],
          files: ["apps/ios/App/Sources/Services.swift", "apps/ios/App/Sources/HomeView.swift"],
          risks: ["Requires network connectivity; must degrade gracefully when offline."],
          verify: ["Verify presence badge appears within 1s on second device and auto-clears."]
        }
      },

      {
        id: "c11-shift-sticky-memo", n: 11, group: "household", round: 1,
        name: "Caregiver Shift Sticky Note & Voice Memo",
        tagline: "Pinned 5-second audio snippet or quick bullet note greeting the incoming caregiver",
        concept: "Verbal hand-offs at 3 AM are groggy and forgotten. A pinned 'Shift Sticky Note' at the top of Now lets the outgoing caregiver leave a quick 5-second audio memo or short text snippet ('Fussy at 1am, extra wipes in top drawer') that greets the incoming parent.",
        moves: [
          "Prominent warm yellow sticky card pinned to the top of Now screen",
          "Embedded 5-to-15 second voice memo player for quick bedside whispers",
          "Auto-archives when the next shift begins or after 12 hours",
          "One-tap dismiss once listened to or read"
        ],
        palette: [["Sticky Yellow", "#FFE699"], ["Dark Ink", "#4A3E10"]],
        facts: { Area: "Duty Handoff", Effort: "S", Impact: "Zero-Friction Communication" },
        render: () => renderC11(),
        views: [
          { name: "Pinned Sticky Memo", render: () => renderC11() }
        ],
        spec: {
          today: ["Duty hand-off exists with factual statistics in v0.5.0, but no pinned voice/text memo."],
          proposed: ["Support optional audio/text memo pinned to the active shift card."],
          files: ["apps/ios/App/Sources/HomeView.swift", "apps/ios/LogCore/Sources/Model.swift"],
          risks: ["Audio files must be stored efficiently and cleaned up after shift expiration."],
          verify: ["Record audio memo, verify sync to partner device, test audio playback."]
        }
      },

      {
        id: "c12-offline-sync-badge", n: 12, group: "household", round: 1,
        name: "Offline Sync Badge & Local Conflict Inspector",
        tagline: "Reassuring outbox counter pill in header with drawer showing pending Supabase queue",
        concept: "Basement nurseries and flight travel often have zero cellular or Wi-Fi coverage. Parents worry their entries are lost. A prominent 'Saved Offline (3 pending)' badge reassures parents that local SQLite is safe, with a drawer showing pending outbox items.",
        moves: [
          "Prominent orange pill in top navigation: '3 Offline Queue'",
          "Drawer card detailing pending outbox mutations (Bottle, Diaper, Medication)",
          "Explanation that local SQLite in App Group is 100% durable and private",
          "Manual 'Sync Now' retry button when network reconnects"
        ],
        palette: [["Warning Orange", "#FF9500"], ["Durable Gray", "#1C1C1E"]],
        facts: { Area: "Reliability & Sync", Effort: "S", Impact: "Builds Trust in Zero-Connectivity" },
        render: () => renderC12(),
        views: [
          { name: "Offline Sync Drawer", render: () => renderC12() }
        ],
        spec: {
          today: ["Sync.swift uses an outbox queue silently without prominent visual indicators on Now."],
          proposed: ["Surface pending outbox count in top navigation with inspector card."],
          files: ["apps/ios/App/Sources/HomeView.swift", "apps/ios/App/Sources/Services.swift"],
          risks: ["Must not cause panic when brief transient network dropouts occur."],
          verify: ["Toggle airplane mode, log 3 events, verify badge shows 3 and clears upon reconnect."]
        }
      },

      // ── CLUSTER 4: FEEDING & NUTRITION (13 - 16)
      {
        id: "c13-nursing-gesture", n: 13, group: "nutrition", round: 1,
        name: "No-Look Nursing Switcher & Fullscreen Haptic Pad",
        tagline: "Double-tap anywhere on screen or swipe to switch nursing sides with distinct stereo haptics",
        concept: "When nursing in the dark, locating a small 'Switch Side' button requires squinting at the screen. This full-screen gesture pad lets you double-tap anywhere on the left or right half of the screen to switch sides, accompanied by unmistakable stereo haptic patterns.",
        moves: [
          "Full-screen high-contrast Left/Right split pad",
          "Double-tap left half to select Left breast; double-tap right half for Right breast",
          "Stereo haptic signature: 2 heavy thumps for Left, 3 crisp taps for Right",
          "No visual attention required—keep eyes on baby in the dark"
        ],
        palette: [["Nursing Feed", "#FAB373"], ["Active Side", "#E07FA6"]],
        facts: { Area: "Nursing UX", Effort: "S", Impact: "100% No-Look Usability" },
        render: () => renderC13(),
        views: [
          { name: "Fullscreen Gesture Pad", render: () => renderC13() }
        ],
        spec: {
          today: ["Nursing session runs in standard CareView with small toggle buttons."],
          proposed: ["Provide full-screen gestural HUD with distinct haptic feedback."],
          files: ["apps/ios/App/Sources/CareView.swift"],
          risks: ["Accidental touch rejection required while holding phone."],
          verify: ["Test double-tap gesture recognizer and UIImpactFeedbackGenerator patterns."]
        }
      },

      {
        id: "c14-formula-ratio-helper", n: 14, group: "nutrition", round: 1,
        name: "Formula Scoop & Water Ratio Calculator",
        tagline: "Automated scoop stepper linked to ml volume with formula brand ratio presets",
        concept: "Sleep-deprived math at 2:30 AM ('How many scoops for 110 ml?') leads to incorrect formula concentration. The bottle logging sheet integrates an automatic scoop-to-water proportion calculator with presets for major formula brands (Enfamil, Similac, Kendamil).",
        moves: [
          "Interactive volume-to-scoop linked stepper (adjusting water automatically updates scoops)",
          "Brand ratio presets: 1 scoop per 30ml (US) vs 1 scoop per 60ml (UK/Kendamil)",
          "Visual safety warning if powder/water proportions deviate from manufacturer guidelines",
          "Remembers household formula preference in Settings"
        ],
        palette: [["Formula Blue", "#73BFF2"], ["Safe Green", "#34C759"]],
        facts: { Area: "Formula Feeding", Effort: "S", Impact: "Prevents 3 AM Mixing Mistakes" },
        render: () => renderC14(),
        views: [
          { name: "Formula Ratio Assistant", render: () => renderC14() }
        ],
        spec: {
          today: ["Bottle logging accepts total ml without scoop ratio tracking."],
          proposed: ["Add formula scoop calculator in bottle sheet with customizable ratio."],
          files: ["apps/ios/App/Sources/CareView.swift", "spec/event-types.json"],
          risks: ["Must clearly display that user should follow their specific formula canister instructions."],
          verify: ["Verify scoop calculations for 60, 90, 120, 150 ml across ratio presets."]
        }
      },

      {
        id: "c15-solids-allergen-matrix", n: 15, group: "nutrition", round: 1,
        name: "Top-9 Allergen Introduction Matrix & Streak",
        tagline: "Visual 3x3 exposure matrix tracking days since last exposure and reaction streaks",
        concept: "Introducing solid foods requires safely testing the Top 9 allergens over multiple consecutive days. This visual 3x3 dashboard tracks exposure streaks (Day 1/3, Day 2/3, Day 3/3 Safe) and flags days elapsed since last exposure to maintain oral tolerance.",
        moves: [
          "3x3 badge matrix for Top 9 allergens (Peanut, Egg, Cow Milk, Wheat, Fish, Shellfish, Tree Nut, Soy, Sesame)",
          "Exposure streak indicator (3 consecutive days of single introduction recommended by pediatricians)",
          "Maintenance cadence reminder if an introduced allergen hasn't been fed in >7 days",
          "1-tap 'Log Reaction' with photo attachment option"
        ],
        palette: [["Allergen Orange", "#FF9500"], ["Cleared Green", "#34C759"]],
        facts: { Area: "Solids & Weaning", Effort: "M", Impact: "Evidence-Based Allergy Intro" },
        render: () => renderC15(),
        views: [
          { name: "Top-9 Allergen Grid", render: () => renderC15() }
        ],
        spec: {
          today: ["v0.5.0 introduced solids fields, but without a dedicated multi-day streak dashboard."],
          proposed: ["Provide 3x3 allergen status card on Now and in Solids sheet."],
          files: ["apps/ios/App/Sources/CareView.swift", "apps/ios/LogCore/Sources/Derive.swift"],
          risks: ["Must clearly state this is an exposure tracker, not clinical medical diagnosis."],
          verify: ["Verify exposure counts derive accurately from feed.solids events."]
        }
      },

      {
        id: "c16-pump-stash-shelf", n: 16, group: "nutrition", round: 1,
        name: "Visual Milk Stash “Freezer Shelf” Organizer",
        tagline: "FIFO freezer bag organizer highlighting oldest bag date with thaw actions",
        concept: "The milk stash in v0.5.0 tracks total ml, but parents need to know where bags are located (Fridge door vs Deep freezer) and which bag must be consumed next to avoid expiration. This shelf organizer highlights the oldest bag with a 1-tap thaw action.",
        moves: [
          "Visual shelf racks: Fridge Door, Kitchen Freezer, Deep Chest Freezer",
          "Prominent 'Use First' red highlight on the oldest bag with expiration countdown",
          "1-tap 'Thaw & Prep Bottle' action that deducts the bag and creates a bottle event",
          "Warns if milk exceeds standard CDC storage guidelines (4 days fridge / 6 months freezer)"
        ],
        palette: [["Freezer Ice", "#73BFF2"], ["Oldest Warning", "#FF3B30"]],
        facts: { Area: "Pumping & Stash", Effort: "M", Impact: "Zero Wasted Breast Milk" },
        render: () => renderC16(),
        views: [
          { name: "Freezer Shelf Organizer", render: () => renderC16() }
        ],
        spec: {
          today: ["v0.5.0 milk stash stores total ml and single oldest bag date."],
          proposed: ["Group milk bags into visual freezer locations with FIFO rotation."],
          files: ["apps/ios/App/Sources/CareView.swift", "apps/ios/App/Sources/HomeView.swift"],
          risks: ["Requires bag-level metadata if user wants granular tracking."],
          verify: ["Verify deducting oldest bag recalculates remaining volume and shelf position."]
        }
      },

      // ── CLUSTER 5: HEALTH, GROWTH & VOICE (17 - 20)
      {
        id: "c17-growth-percentiles", n: 17, group: "health", round: 1,
        name: "Interactive WHO/CDC Growth Percentile Curves",
        tagline: "Zoomable SVG growth chart plotting weight, height, and head size against WHO percentiles",
        concept: "GrowthView currently shows raw tables of measurements. Pediatricians and parents rely on percentile curves (3rd, 50th, 97th percentiles) to assess steady growth trajectory. This interactive chart plots measurements against official WHO child growth standards.",
        moves: [
          "Interactive SVG chart plotting Weight, Length, and Head Circumference against WHO standard curves",
          "Calculates exact child percentile (e.g. 'Mia is at 62nd percentile · +190g/week')",
          "Pediatric checkup milestone pins (2-week, 2-month, 4-month checkup markers)",
          "Pinch-to-zoom age axis (0 to 12 months) with Metric/Imperial toggle"
        ],
        palette: [["Growth Gold", "#F5CC6B"], ["Curve Gray", "#8A8A8E"]],
        facts: { Area: "Pediatric Health", Effort: "M", Impact: "Reassures Weight Gain Pacing" },
        render: () => renderC17(),
        views: [
          { name: "WHO Weight Percentile Chart", render: () => renderC17() }
        ],
        spec: {
          today: ["GrowthView displays raw historical rows and deltas in kilograms/centimeters."],
          proposed: ["Embed WHO growth percentile lookup tables and render vector percentile curves."],
          files: ["apps/ios/App/Sources/GrowthView.swift", "spec/growth-standards.json (new)"],
          risks: ["Data curves differ between WHO (0-2y) and CDC; use WHO as international standard."],
          verify: ["Verify accurate percentile calculation against WHO LMS parameters."]
        }
      },

      {
        id: "c18-fever-med-overlay", n: 18, group: "health", round: 1,
        name: "Fever Curve with Antipyretic Medication Overlay",
        tagline: "Continuous temperature curve overlaying fever spikes with Tylenol/Motrin dose pins",
        concept: "When a baby has a fever, doctors immediately ask: 'When did the temperature spike, did it respond to Tylenol, and when is Motrin safe to give?' This continuous curve plots temperature readings against medication doses with active safety cooldown timers.",
        moves: [
          "Continuous fever chart with horizontal 100.4°F threshold line",
          "Vertical dosage pins marking exact timestamps and amounts of Tylenol / Motrin",
          "Active safety countdown timer: 'Next Tylenol safe in 1h 38m' (4-hour safety cooldown)",
          "1-tap pediatrician summary export sheet for urgent clinic or ER visits"
        ],
        palette: [["Fever Red", "#FF4757"], ["Med Pink", "#F08585"]],
        facts: { Area: "Pediatric Safety", Effort: "M", Impact: "Critical Sickness Clarity" },
        render: () => renderC18(),
        views: [
          { name: "Fever Curve & Med Pins", render: () => renderC18() }
        ],
        spec: {
          today: ["Temperature and medication events are logged as separate timeline rows."],
          proposed: ["Render dual-axis chart overlaying temperatures with medication dose markers."],
          files: ["apps/ios/App/Sources/CareView.swift", "apps/ios/App/Sources/TimelineView.swift"],
          risks: ["Must never prescribe medication; only calculate elapsed time since last logged dose."],
          verify: ["Verify cooldown timers reflect manufacturer dosage intervals (4h for acetaminophen)."]
        }
      },

      {
        id: "c19-voice-confidence-tray", n: 19, group: "health", round: 1,
        name: "WhisperKit Confidence Tray & Token Correction",
        tagline: "Underlined recognized tokens with 1-tap alternative chips before auto-committing",
        concept: "When voice logging mishears a number ('90 ml' instead of '60 ml') or side, canceling and speaking again is frustrating. This interactive tray underlines parsed tokens in real time, letting you tap to pick the correct alternative with 1 tap before auto-commit.",
        moves: [
          "Live transcription text with parsed quantities and entities highlighted as chips",
          "Tap any highlighted token to expose an inline quick-picker tray (e.g. 60 / 90 / 120 ml)",
          "Auto-commit countdown progress bar pauses when user touches a token",
          "Reinforces confidence in on-device WhisperKit and Laya interpretation"
        ],
        palette: [["Voice Accent", "#F29E66"], ["Confidence Chip", "#34C759"]],
        facts: { Area: "Voice Capture", Effort: "M", Impact: "Zero-Frustration Voice Edits" },
        render: () => renderC19(),
        views: [
          { name: "Token Correction Tray", render: () => renderC19() }
        ],
        spec: {
          today: ["ListeningView shows live transcript and auto-logs or opens interpretation sheet."],
          proposed: ["Make recognized tokens interactive chips with instant alternative pickers."],
          files: ["apps/ios/App/Sources/ListeningView.swift"],
          risks: ["Requires tight coordination between WhisperKit live tokens and deterministic parsers."],
          verify: ["Tap token chip, verify alternatives populate without restarting speech recognizer."]
        }
      },

      {
        id: "c20-timeline-batch-actions", n: 20, group: "health", round: 1,
        name: "Timeline Multi-Select & Batch Timestamp Shift",
        tagline: "Long-press to select multiple events for bulk +15m shift, reassign to twin, or delete",
        concept: "Parents frequently fall behind during cluster feeds and enter 3 or 4 events at once after the baby sleeps, resulting in clustered timestamps or logs assigned to the wrong twin. Multi-select enables bulk timestamp adjustments and reassignments in seconds.",
        moves: [
          "Long-press any event in Timeline to enter multi-select mode with checkboxes",
          "Floating bottom action bar: 'Shift Timestamp (+15m, +30m, -15m)'",
          "Bulk 'Reassign to Leo' for twin logs recorded under the wrong child",
          "Bulk delete for accidental duplicate imports or spam test entries"
        ],
        palette: [["Dark Bar", "#1C1C1E"], ["Accent", "#F29E66"]],
        facts: { Area: "Timeline Management", Effort: "S", Impact: "Fast Backdating & Cleanup" },
        render: () => renderC20(),
        views: [
          { name: "Multi-Select Action Bar", render: () => renderC20() }
        ],
        spec: {
          today: ["Events can only be edited or deleted one by one via EditEventView."],
          proposed: ["Introduce EditMode in TimelineView with batch timestamp shift and reassign."],
          files: ["apps/ios/App/Sources/TimelineView.swift", "apps/ios/App/Sources/AppModel.swift"],
          risks: ["Batch edits must append correction events preserving append-only audit trail."],
          verify: ["Select 3 events, shift +15m, verify each event receives a clean updated timestamp."]
        }
      }
    ]
  };
})();
`;

fs.writeFileSync(candidatesJsPath, content);
console.log("Wrote " + content.split("\\n").length + " lines to " + candidatesJsPath);
