// Headway Web Home Redesign: Baseline + 10 Candidates
(() => {
  const { icon: I, stations, sampleTrains, alerts, commutePresets, g2Lines, renderEvenG2Frame, renderR1Ring } = KIT;

  window.REVIEW = {
    key: "2026-10-26-headway-web-home-v1",
    dir: "reports/archive/2026-10-26-headway-web-home",
    repo: "tianhaoz95/hejitech-apps",
    port: 8811,
    project: "projects/headway",
    context: [
      "projects/headway/services/web/index.html",
      "projects/headway/services/web/src/board.ts",
      "projects/headway/services/web/src/style.css",
      "projects/headway/packages/core/src/schedule.ts",
      "projects/headway/packages/core/src/types.ts",
    ],
    brief: "UI/UX redesign for the Headway web home page. Address hero balance, commute presets, live train density, Even G2 glasses simulation fidelity, corridor map awareness, and multi-device alerts.",
    title: "Headway Web Home Redesign",
    subtitle: "10 candidate directions + today's baseline",
    heading: "Choose a direction for Headway's web experience",
    intro: "Explore 10 distinct, fully rendered candidate directions for the Headway web home page. Each candidate redesigns the commuter departure board, station selector, and Even G2 glasses simulator with different priorities (commuter speed, spatial hardware immersion, interactive corridor maps, Swiss transit minimalism, smart commute assistants, multi-device sync, and operator terminals). Heart your favorites, rate each direction, leave inline feedback, and copy the summary hand-off.",
    legend: ["<b>10</b> candidate directions", "<b>1</b> baseline", "Interactive Glasses & Ring"],
    round: 1,
    frame: "browser",
    url: "headway.hejitech.workers.dev",
    modes: true,
    candidates: [
      // 0: Current Baseline
      {
        id: "baseline",
        n: 0,
        name: "Current Web Home",
        baseline: true,
        tagline: "Today's live page: hero lede + 2-column board and ASCII glasses preview",
        concept: "The current production layout with top navigation, prominent hero headline, station dropdown pair selector, vertical departure cards with status badges, and an ASCII preview of the Even G2 display with ring buttons.",
        moves: [
          "Large hero section with product description and sign-in buttons",
          "2-column layout (.grid2): departures on left, G2 preview on right",
          "Basic select dropdowns for station selection with swap button",
          "Standard train cards with departure time, stops count, and delay pills",
          "ASCII terminal preview for Even G2 waveguide display",
        ],
        palette: [["Deep Forest", "#090E0A"], ["Card Obsidian", "#121B14"], ["Phosphor Green", "#3DFF7A"], ["Caltrain Red", "#FF7B7B"]],
        facts: { Layout: "2-Column Hero + Board", GlassesSim: "ASCII Pre Tag", StationPicker: "Dual Select Dropdowns", Effort: "Current Baseline" },
        render: () => `
          <div class="hwy-page baseline-page">
            <header class="hwy-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway</div>
              <nav class="hwy-links">
                <a class="active" href="#">Trains</a>
                <a href="#">Settings</a>
                <a href="#">Help</a>
                <a class="hwy-btn-sub" href="#">Sign in with Google</a>
              </nav>
            </header>
            <div class="hwy-hero">
              <div class="hwy-eyebrow"><span class="hwy-dot"></span> Even G2 Glasses · R1 Ring · iPhone Alerts</div>
              <h1>Your next Caltrain, at a glance.</h1>
              <p class="hwy-lede">Headway puts your commute on Even G2 glasses: the next trains from your station, live 511.org delays and Caltrain's service alerts. Swipe the R1 ring to look further, tap to flip direction, hold to follow the train you're on.</p>
              <div class="hwy-actions">
                <button class="hwy-btn-primary">Your commute</button>
                <button class="hwy-btn-secondary">How it works</button>
              </div>
            </div>
            <div class="hwy-grid">
              <section class="hwy-panel">
                <div class="hwy-panel-head">
                  <h2>Next trains</h2>
                  <span class="hwy-badge-live">Live · 511.org</span>
                </div>
                <div class="hwy-pair-selector">
                  <div class="hwy-field"><label>From</label><div class="hwy-fake-select">San Francisco</div></div>
                  <button class="hwy-swap-btn" title="Swap stations">⇄</button>
                  <div class="hwy-field"><label>To</label><div class="hwy-fake-select">Sunnyvale</div></div>
                </div>
                <div class="hwy-train-list">
                  ${sampleTrains.map((t) => `
                    <div class="hwy-train-card">
                      <div class="hwy-train-id">
                        <b>#${t.train}</b>
                        <span class="hwy-kind-pill ${t.kind}">${t.kind === "LOC" ? "Local" : t.kind === "EXP" ? "Express" : "Limited"}</span>
                      </div>
                      <div class="hwy-train-times">
                        <div class="hwy-time-line"><b>${t.dep.replace(" AM", "")}</b> → <span class="hwy-arr">${t.arr.replace(" AM", "")}</span></div>
                        <div class="hwy-train-meta">
                          <span class="${t.status === "late" ? "warn" : t.status === "cancelled" ? "bad" : "ok"}">${t.status === "late" ? `+${t.delayMin}m late` : t.status === "cancelled" ? "Cancelled" : "On time"}</span> · ${t.stops} stops between
                        </div>
                      </div>
                      <div class="hwy-train-in ${t.status === "late" ? "warn" : t.status === "cancelled" ? "bad" : "ok"}">${t.inText}</div>
                    </div>
                  `).join("")}
                </div>
                <div class="hwy-alert-banner">
                  <b>Accessibility: Northbound Elevator out of service at San Mateo Station until 10/29/2026 5:00 AM</b>
                  <p>Elevator at San Mateo Caltrain Northbound is out of service. For assistance call Customer Service at 800-660-4287.</p>
                </div>
              </section>
              <section class="hwy-panel">
                <div class="hwy-panel-head">
                  <h2>On the glasses</h2>
                  <span class="hwy-badge-accent">BOARD</span>
                </div>
                <p class="hwy-muted-sub">The exact pixel-measured layout shown on Even G2 glasses. Try the R1 ring gestures:</p>
                <div class="hwy-g2-ascii-box">
                  <div class="hwy-g2-ascii-top"><span>EVEN G2 WAVEGUIDE</span><span>CALTRAIN HUD</span></div>
                  <pre class="hwy-g2-ascii-text">${g2Lines().join("\n")}</pre>
                </div>
                <div class="hwy-ring-btns">
                  <button>↑ Swipe up</button>
                  <button>↓ Swipe down</button>
                  <button>● Tap · Flip</button>
                  <button>●● Double-tap</button>
                  <button>◉ Hold · Menu</button>
                </div>
              </section>
            </div>
          </div>
        `,
      },

      // 1: Commuter Cockpit
      {
        id: "commuter-cockpit",
        n: 1,
        name: "Commuter Cockpit",
        tagline: "Airport-grade departure board with 1-click commute presets and line corridor health",
        concept: "Commuters don't read marketing ledes during their morning rush. This direction removes the hero block entirely on repeat visits, placing the live departure board in the spotlight alongside 1-click commute preset chips ('Work', 'Home', 'Campus') and a Peninsula-wide corridor health meter.",
        moves: [
          "Quick commute preset chips ('Work: SF → Sunnyvale', 'Home: Sunnyvale → SF') for instant switching",
          "Airport-style dense tabular departure rows with platform track numbers and EMU electric train indicators",
          "Peninsula Corridor Health Bar at the top showing OCS power status, active train count, and 98% on-time rate",
          "Synchronized Even G2 HUD preview with live cursor line linking web row to glasses line",
        ],
        palette: [["Obsidian Slate", "#0B1015"], ["Cockpit Card", "#141D26"], ["Emerald Green", "#30E070"], ["Radar Cyan", "#38BDF8"]],
        facts: { Layout: "Corridor Health + Commuter Tabs", Presets: "1-Click Chips", Density: "High (10 trains on screen)", Effort: "M" },
        spec: {
          today: ["User selects stations via two HTML select dropdowns on every session", "No persistent commute preset chips on web"],
          proposed: ["Add CommutePreset bar with user's saved legs + auto-morning/evening flip", "Expose corridor health & track platform numbers in API"],
          files: ["projects/headway/services/web/src/board.ts", "projects/headway/packages/core/src/schedule.ts"],
          risks: ["Platform tracks from 511.org GTFS-RT are sometimes delayed or reassigned last-minute"],
          verify: ["Clicking preset chips updates board and glasses HUD in under 100ms"],
        },
        design: [
          {
            kind: "flow",
            title: "Commute Preset & State Flow",
            today: {
              nodes: [
                { id: "usr", label: "User", sub: "Web Visit", col: 0, row: 0, type: "actor" },
                { id: "sel", label: "Select From/To", sub: "Manual dropdowns", col: 1, row: 0, type: "ui" },
                { id: "api", label: "Board API", sub: "GET /api/board", col: 2, row: 0, type: "service" },
                { id: "rnd", label: "Render Board", sub: "Train Cards", col: 3, row: 0, type: "ui" },
              ],
              edges: [{ from: "usr", to: "sel" }, { from: "sel", to: "api" }, { from: "api", to: "rnd" }],
            },
            proposed: {
              nodes: [
                { id: "usr", label: "User", sub: "Web Visit", col: 0, row: 0, type: "actor" },
                { id: "prs", label: "Commute Presets", sub: "Auto-detect Leg", col: 1, row: 0, type: "store", state: "new" },
                { id: "api", label: "Board + Corridor", sub: "GET /api/corridor-board", col: 2, row: 0, type: "service", state: "changed" },
                { id: "rnd", label: "Cockpit Board", sub: "Synced with G2 HUD", col: 3, row: 0, type: "ui", state: "changed" },
              ],
              edges: [
                { from: "usr", to: "prs", label: "1-click" },
                { from: "prs", to: "api", label: "cached" },
                { from: "api", to: "rnd", label: "synced" },
              ],
            },
          },
        ],
        render: () => `
          <div class="hwy-page cockpit-page">
            <header class="hwy-cockpit-bar">
              <div class="hwy-brand-group">
                <span class="hwy-logo">▲</span>
                <span class="hwy-title">Headway Cockpit</span>
                <span class="hwy-corridor-status"><span class="dot-live"></span> Peninsula Corridor Normal · 98% On-Time</span>
              </div>
              <div class="hwy-cockpit-meta">
                <span class="hwy-tag"><span class="hwy-bolt">⚡</span> 100% Electric EMU</span>
                <span class="hwy-tag">GTFS-RT: 12s ago</span>
                <button class="hwy-pill-btn">Sign in</button>
              </div>
            </header>

            <div class="hwy-presets-strip">
              <div class="hwy-presets-label">${I("train", 14)} COMMUTE PRESETS:</div>
              <div class="hwy-presets-list">
                ${commutePresets.map((p) => `
                  <button class="hwy-preset-chip ${p.active ? "active" : ""}">
                    <b>${p.label}</b>
                    <span>${p.from} → ${p.to}</span>
                    <span class="hwy-chip-dep">${p.dep}</span>
                  </button>
                `).join("")}
                <button class="hwy-preset-chip add">+ Custom Leg</button>
              </div>
            </div>

            <div class="hwy-cockpit-main">
              <div class="hwy-cockpit-board">
                <div class="hwy-board-banner">
                  <div class="hwy-route-title">
                    <h2>San Francisco <span class="hwy-arrow">⇄</span> Sunnyvale</h2>
                    <span class="hwy-sub-route">Zone 1 → Zone 3 · 38.6 miles · 8 upcoming departures</span>
                  </div>
                  <div class="hwy-board-actions">
                    <button class="hwy-btn-icon" title="Swap direction">${I("swap", 16)} Swap</button>
                    <button class="hwy-btn-icon" title="Refresh times">${I("refresh", 16)} 30s</button>
                  </div>
                </div>

                <div class="hwy-table-head">
                  <span class="col-train">TRAIN</span>
                  <span class="col-type">TYPE</span>
                  <span class="col-dep">DEPART</span>
                  <span class="col-arr">ARRIVE</span>
                  <span class="col-track">TRACK</span>
                  <span class="col-status">STATUS</span>
                  <span class="col-countdown">IN</span>
                </div>
                <div class="hwy-table-body">
                  ${sampleTrains.map((t, idx) => `
                    <div class="hwy-table-row ${idx === 0 ? "highlight" : ""} ${t.status}">
                      <div class="col-train"><b>#${t.train}</b></div>
                      <div class="col-type"><span class="hwy-kind-badge ${t.kind}">${t.kind}</span></div>
                      <div class="col-dep"><span class="time">${t.dep}</span></div>
                      <div class="col-arr"><span class="time arr">${t.arr}</span></div>
                      <div class="col-track"><span class="track-tag">${t.track}</span></div>
                      <div class="col-status">
                        <span class="status-pill ${t.status}">
                          ${t.status === "on_time" ? `${I("check", 12)} On time` : t.status === "late" ? `+${t.delayMin}m late` : "Cancelled"}
                        </span>
                        <span class="sub-stops">${t.stops} stops</span>
                      </div>
                      <div class="col-countdown"><b class="countdown ${t.status}">${t.inText}</b></div>
                    </div>
                  `).join("")}
                </div>
              </div>

              <div class="hwy-cockpit-sidebar">
                <div class="hwy-cockpit-card glasses-card">
                  <div class="hwy-card-title">
                    <span>${I("glasses", 16)} Even G2 Waveguide Sync</span>
                    <span class="badge-live">LIVE</span>
                  </div>
                  <div class="hwy-glasses-compact">
                    ${renderEvenG2Frame()}
                  </div>
                  <div class="hwy-glasses-legend">
                    <span><b>R1 Ring gestures:</b></span>
                    <div class="hwy-gestures-mini">
                      <span><kbd>Swipe</kbd> scroll</span>
                      <span><kbd>Tap</kbd> flip</span>
                      <span><kbd>Hold</kbd> track</span>
                    </div>
                  </div>
                </div>

                <div class="hwy-cockpit-card alert-card">
                  <div class="hwy-card-title">
                    <span>${I("alert", 16)} Active Corridor Alerts</span>
                    <span class="hwy-alert-count">1 Active</span>
                  </div>
                  <div class="hwy-alert-item">
                    <b>San Mateo Station Elevator</b>
                    <p>Northbound elevator out of service until 10/29. Plan additional transfer time.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
      },

      // 2: Waveguide First
      {
        id: "waveguide-first",
        n: 2,
        name: "Waveguide First (AR Glasses Stage)",
        tagline: "Immersive Even G2 smart glasses stage with an interactive tactile R1 ring dial",
        concept: "Headway's core differentiator is that it runs on your Even G2 glasses and R1 ring. This candidate places an ultra-high-fidelity optical glasses simulator in the center of the web page, allowing prospective and current users to experience looking through the transparent lenses and driving the interface with a virtual R1 Ring.",
        moves: [
          "Photorealistic Even G2 smart glasses frames with dual-lens waveguide glow and commute scenery backdrop",
          "Tactile virtual R1 ring controller with interactive swipe/tap touch zones and audio-visual feedback",
          "Companion departure board docked underneath, synchronizing selection with the glasses viewport",
          "Interactive simulator modes: Board, Tracking Train, Menu, and Accessibility Alert screens",
        ],
        palette: [["Deep Waveguide Obsidian", "#050C07"], ["G2 Phosphor Green", "#3DFF7A"], ["Glass Tint", "rgba(61, 255, 122, 0.12)"], ["Frame Matte", "#1C241E"]],
        facts: { Focus: "Wearable Hardware Simulation", RingControl: "Interactive Rotary Dial", Fidelity: "Photorealistic Glasses Frame", Effort: "M" },
        render: () => `
          <div class="hwy-page waveguide-page">
            <header class="hwy-waveguide-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway <span class="hwy-tag">AR Waveguide Studio</span></div>
              <div class="hwy-stage-tabs">
                <button class="stage-tab active">Even G2 Glasses</button>
                <button class="stage-tab">R1 Ring</button>
                <button class="stage-tab">Departure Feed</button>
              </div>
              <div class="hwy-user-nav"><button class="hwy-pill-btn">Pair Glasses</button></div>
            </header>

            <div class="hwy-stage-hero">
              <div class="hwy-stage-glasses-wrap">
                <div class="hwy-glasses-viewport-frame">
                  <div class="hwy-scenery-backdrop">
                    <div class="hwy-blur-station"></div>
                  </div>
                  <div class="hwy-glasses-assembly">
                    <div class="hwy-glasses-temple left"></div>
                    <div class="hwy-glasses-rim left">
                      <div class="hwy-lens-hud">
                        <div class="hwy-waveguide-matrix">
                          <div class="hwy-hud-screen">
                            <div class="hwy-hud-header">
                              <span>SF &gt; SUNNYVALE</span>
                              <span class="hud-live-dot">● LIVE</span>
                            </div>
                            <div class="hwy-hud-row current">&gt; 162 LOC  8:25  ok</div>
                            <div class="hwy-hud-row">  504 EXP  8:42  ok</div>
                            <div class="hwy-hud-row">  164 LOC  8:55  ok</div>
                            <div class="hwy-hud-row warn">  408 LTD  9:12 +4m</div>
                            <div class="hwy-hud-row">  166 LOC  9:25  ok</div>
                            <div class="hwy-hud-row">  168 LOC  9:55</div>
                            <div class="hwy-hud-alert">! San Mateo Elevator out</div>
                            <div class="hwy-hud-footer">tap: flip  hold: menu  2x: exit</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="hwy-glasses-bridge"><span>EVEN</span></div>
                    <div class="hwy-glasses-rim right">
                      <div class="hwy-lens-clear">
                        <div class="hwy-lens-glare"></div>
                      </div>
                    </div>
                    <div class="hwy-glasses-temple right"></div>
                  </div>
                </div>

                <div class="hwy-stage-controls">
                  <div class="hwy-r1-interactive-card">
                    <div class="r1-header">
                      <span>R1 Smart Ring</span>
                      <span class="r1-status">CONNECTED</span>
                    </div>
                    ${renderR1Ring()}
                    <div class="r1-hint">Rotate ring track or click notches to simulate gestures in real-time</div>
                  </div>
                </div>
              </div>

              <div class="hwy-docked-feed">
                <div class="hwy-feed-head">
                  <h3>Live Departure Stream · San Francisco to Sunnyvale</h3>
                  <div class="hwy-feed-station-pill">Swap: <button class="link-btn">Sunnyvale → SF</button></div>
                </div>
                <div class="hwy-mini-cards-grid">
                  ${sampleTrains.slice(0, 4).map((t) => `
                    <div class="hwy-mini-train-card ${t.recommended ? "recommended" : ""}">
                      <div class="mini-top">
                        <b>#${t.train} ${t.kind}</b>
                        <span class="mini-in ${t.status}">${t.inText}</span>
                      </div>
                      <div class="mini-times">${t.dep} → ${t.arr}</div>
                      <div class="mini-footer">
                        <span>${t.track}</span>
                        <span class="${t.status === "late" ? "warn" : "ok"}">${t.status === "late" ? `+${t.delayMin}m late` : "On time"}</span>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>
        `,
      },

      // 3: Peninsula Trackline
      {
        id: "peninsula-trackline",
        n: 3,
        name: "Peninsula Trackline (Live Corridor Map)",
        tagline: "Interactive schematic 77-mile Caltrain corridor with moving trains and live station stops",
        concept: "Transit commuters love maps. This candidate presents an interactive schematic trackline representing the 77-mile Peninsula rail line from San Francisco to San Jose, with pulsing train beacons indicating live positions, speeds, and delays alongside the departure board.",
        moves: [
          "Schematic vertical transit line diagram featuring all 24 Caltrain stations with zone boundaries",
          "Moving train beacons (#162, #504, #164) placed in real-time according to GTFS-RT coordinates",
          "Click any station on the line to instantly select it as departure or destination",
          "Hovering any train highlights its stops, speed, delay, and projected arrival at each station",
        ],
        palette: [["Subway Dark", "#0D1117"], ["Track Silver", "#30363D"], ["Caltrain Electric Red", "#E63946"], ["Phosphor Wave", "#2EA043"]],
        facts: { Layout: "Split Corridor Track Map + Board", Interactivity: "Clickable Station Nodes", Geospatial: "Schematic 24 Stations", Effort: "L" },
        render: () => `
          <div class="hwy-page trackline-page">
            <header class="hwy-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway <span class="hwy-tag">Live Corridor Map</span></div>
              <div class="hwy-route-summary">
                <span class="active-pair"><b>San Francisco</b> ${I("arrowRight", 14)} <b>Sunnyvale</b></span>
                <span class="corridor-active">14 Active Trains on Peninsula</span>
              </div>
              <button class="hwy-pill-btn">Sign in</button>
            </header>

            <div class="hwy-trackline-layout">
              <div class="hwy-corridor-map-col">
                <div class="hwy-map-card">
                  <div class="map-card-head">
                    <h3>Peninsula Rail Line</h3>
                    <div class="map-legend">
                      <span><span class="leg-dot loc"></span> Local</span>
                      <span><span class="leg-dot exp"></span> Express</span>
                      <span><span class="leg-dot ltd"></span> Limited</span>
                    </div>
                  </div>

                  <div class="hwy-schematic-track">
                    <div class="track-rail"></div>
                    <div class="station-node active" style="top: 5%;">
                      <span class="node-circle"></span>
                      <span class="node-label">San Francisco (4th & King)</span>
                      <span class="zone-tag">Z1</span>
                      <div class="train-badge exp" style="left: 45px; top: -8px;">
                        ${I("train", 12)} #504 EXP 8:42
                      </div>
                    </div>
                    <div class="station-node" style="top: 18%;">
                      <span class="node-circle"></span>
                      <span class="node-label">Millbrae (BART Transfer)</span>
                      <span class="zone-tag">Z2</span>
                      <div class="train-badge loc" style="left: 45px; top: -8px;">
                        ${I("train", 12)} #162 LOC 8:25
                      </div>
                    </div>
                    <div class="station-node alert-node" style="top: 32%;">
                      <span class="node-circle alert"></span>
                      <span class="node-label">San Mateo</span>
                      <span class="alert-icon">${I("alert", 12)}</span>
                    </div>
                    <div class="station-node" style="top: 48%;">
                      <span class="node-circle"></span>
                      <span class="node-label">Redwood City</span>
                      <span class="zone-tag">Z2</span>
                    </div>
                    <div class="station-node" style="top: 64%;">
                      <span class="node-circle"></span>
                      <span class="node-label">Palo Alto (Stanford)</span>
                      <span class="zone-tag">Z3</span>
                      <div class="train-badge ltd late" style="left: 45px; top: -8px;">
                        ${I("train", 12)} #408 LTD (+4m)
                      </div>
                    </div>
                    <div class="station-node" style="top: 78%;">
                      <span class="node-circle"></span>
                      <span class="node-label">Mountain View</span>
                      <span class="zone-tag">Z3</span>
                    </div>
                    <div class="station-node active dest" style="top: 92%;">
                      <span class="node-circle dest"></span>
                      <span class="node-label">Sunnyvale</span>
                      <span class="zone-tag">Z3</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="hwy-corridor-details-col">
                <div class="hwy-departures-panel">
                  <div class="hwy-dep-header">
                    <h2>Departures from San Francisco</h2>
                    <span class="hwy-badge-live">Live Feed</span>
                  </div>
                  <div class="hwy-station-quick-swap">
                    <span>From <b>San Francisco</b> to <b>Sunnyvale</b></span>
                    <button class="hwy-swap-link">⇄ Reverse Route</button>
                  </div>

                  <div class="hwy-train-cards-stack">
                    ${sampleTrains.map((t) => `
                      <div class="hwy-map-train-card ${t.recommended ? "best-choice" : ""}">
                        ${t.recommended ? `<div class="best-choice-ribbon">${I("spark", 12)} Recommended: ${t.reason}</div>` : ""}
                        <div class="card-row-main">
                          <div class="train-col">
                            <b>#${t.train}</b>
                            <span class="kind-tag ${t.kind}">${t.kind}</span>
                          </div>
                          <div class="times-col">
                            <span class="dep-time">${t.dep}</span>
                            <span class="arrow">→</span>
                            <span class="arr-time">${t.arr}</span>
                          </div>
                          <div class="stops-col">
                            <span class="stops-count">${t.stops} stops</span>
                            <span class="track-info">${t.track}</span>
                          </div>
                          <div class="status-col">
                            <span class="status-badge ${t.status}">
                              ${t.status === "on_time" ? "On time" : t.status === "late" ? `+${t.delayMin}m` : "Cancelled"}
                            </span>
                            <b class="in-badge">${t.inText}</b>
                          </div>
                        </div>
                        <div class="card-stops-summary">
                          <span>${I("mapPin", 12)} Stops: ${t.stopsSummary}</span>
                        </div>
                      </div>
                    `).join("")}
                  </div>
                </div>

                <div class="hwy-glasses-strip-card">
                  <div class="strip-header">
                    <span>${I("glasses", 14)} On Even G2 Glasses Display</span>
                    <span class="mono-badge">640×200 MICRO-LED</span>
                  </div>
                  <div class="hwy-glasses-single-line">
                    <pre class="g2-mini-screen">> 162 LOC 8:25 ok  |  504 EXP 8:42 ok  |  164 LOC 8:55 ok  |  408 LTD 9:12 +4m</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
      },

      // 4: Swiss Minimalist
      {
        id: "swiss-minimal",
        n: 4,
        name: "Swiss Transit Minimalist",
        tagline: "SBB-inspired typographic rigor, tabular precision, and clear express time-savings",
        concept: "Inspired by Swiss Federal Railways (SBB) and Japanese transit signage. Replaces decorative cards and hero graphics with a razor-sharp tabular grid, stark high-contrast typography, platform track assignments, and prominent express time-saving callouts.",
        moves: [
          "Pure typographic hierarchy with zero visual fluff or marketing distraction",
          "Clear service differentiation: Red for Express, Amber for Limited, Slate for Local",
          "Explicit time-savings calculations ('Express saves 22 min over Local #162')",
          "Direct platform track numbers and zone pricing information",
        ],
        palette: [["Swiss White", "#FFFFFF"], ["SBB Red", "#EB0000"], ["Deep Charcoal", "#191919"], ["Light Slate", "#F2F4F7"]],
        facts: { Style: "Swiss Modernist / SBB", Layout: "Dense Tabular Grid", Contrast: "Maximum (WCAG AAA)", Effort: "S" },
        render: () => `
          <div class="hwy-page swiss-page">
            <header class="swiss-nav">
              <div class="swiss-brand">
                <span class="swiss-cross">+</span>
                <span class="swiss-title">CALTRAIN TIMETABLE &middot; HEADWAY</span>
              </div>
              <div class="swiss-route-picker">
                <span>DEP: <b>San Francisco</b></span>
                <button class="swiss-swap-btn">⇄</button>
                <span>ARR: <b>Sunnyvale</b></span>
              </div>
              <div class="swiss-meta">
                <span class="time-now">08:13:40 PST</span>
                <span class="status-live">LIVE 511.ORG</span>
              </div>
            </header>

            <main class="swiss-main">
              <div class="swiss-board-container">
                <table class="swiss-table">
                  <thead>
                    <tr>
                      <th class="th-time">Time</th>
                      <th class="th-train">Train</th>
                      <th class="th-type">Service</th>
                      <th class="th-dest">Destination & Stops</th>
                      <th class="th-track">Track</th>
                      <th class="th-late">Deviation</th>
                      <th class="th-eta">Departure in</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sampleTrains.map((t) => `
                      <tr class="swiss-row ${t.kind.toLowerCase()} ${t.status}">
                        <td class="td-time"><b>${t.dep.replace(" AM", "")}</b></td>
                        <td class="td-train"><span class="train-num">#${t.train}</span></td>
                        <td class="td-type"><span class="service-pill ${t.kind}">${t.kind}</span></td>
                        <td class="td-dest">
                          <div class="dest-line">Sunnyvale <span class="dest-arr">arr. ${t.arr.replace(" AM", "")}</span></div>
                          <div class="dest-meta">${t.stopsSummary}</div>
                          ${t.timeSaved ? `<span class="time-saved-pill">${I("zap", 10)} ${t.timeSaved}</span>` : ""}
                        </td>
                        <td class="td-track"><span class="track-box">${t.track.replace("Track ", "")}</span></td>
                        <td class="td-late">
                          <span class="dev-badge ${t.status}">
                            ${t.status === "on_time" ? "On time" : t.status === "late" ? `+${t.delayMin} min` : "Cancelled"}
                          </span>
                        </td>
                        <td class="td-eta"><b class="countdown-val">${t.inText}</b></td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>

              <div class="swiss-bottom-bar">
                <div class="swiss-hud-preview">
                  <div class="hud-label">Even G2 Glasses HUD</div>
                  <pre class="swiss-hud-text">${g2Lines().slice(0, 5).join("\n")}</pre>
                </div>
                <div class="swiss-alert-banner">
                  <div class="alert-title">${I("alert", 14)} SERVICE NOTICE: SAN MATEO ELEVATOR OUT OF SERVICE</div>
                  <div class="alert-text">Elevator between platform and street level at San Mateo Station is out of service for scheduled maintenance until 10/29. Contact station agent for accessible van boarding.</div>
                </div>
              </div>
            </main>
          </div>
        `,
      },

      // 5: Smart Assistant
      {
        id: "smart-assistant",
        n: 5,
        name: "Smart Commute Assistant",
        tagline: "Contextual 'Next Best Train' hero card with walking buffer and countdown clock",
        concept: "Rather than forcing commuters to manually parse departure times and mental math for travel duration, this direction highlights the single optimal train to catch right now. Displays a door-to-platform walking countdown ('Leave in 7 minutes'), followed by upcoming backup options.",
        moves: [
          "Large hero card highlighting the '#504 Express: Fastest option to Sunnyvale'",
          "Walk buffer countdown bar ('12 min walk to 4th & King · Leave home by 8:30 AM')",
          "Automatic Morning/Evening commute direction flip based on local clock",
          "One-click 'Add to iPhone Lock Screen' and 'Push to Glasses' actions",
        ],
        palette: [["Warm Sand", "#F8F6F0"], ["Deep Navy", "#0F1A24"], ["Electric Coral", "#FF6B4A"], ["Forest Emerald", "#10B981"]],
        facts: { UXFocus: "Recommendation First", TimeContext: "Walk Time + Train Duration", Automation: "Auto Morning/Evening Flip", Effort: "M" },
        render: () => `
          <div class="hwy-page assistant-page">
            <header class="hwy-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway <span class="hwy-tag">Personal Commute</span></div>
              <div class="hwy-greeting">Good morning, Commuter · 8:13 AM</div>
              <button class="hwy-pill-btn">Settings</button>
            </header>

            <div class="assistant-content">
              <!-- Smart Hero Highlight -->
              <div class="smart-hero-card">
                <div class="smart-hero-top">
                  <div class="smart-badge-row">
                    <span class="smart-pill recommended">${I("spark", 14)} BEST CHOICE RIGHT NOW</span>
                    <span class="smart-pill electric">⚡ 100% Electric Caltrain EMU</span>
                  </div>
                  <span class="smart-countdown-chip">Leave home in <b>17 min</b></span>
                </div>

                <div class="smart-hero-body">
                  <div class="smart-train-hero">
                    <div class="hero-train-title">
                      <h1>Caltrain Express #504</h1>
                      <span class="hero-train-route">San Francisco (Track 1) → Sunnyvale</span>
                    </div>
                    <div class="hero-big-times">
                      <div class="time-block">
                        <span class="lbl">DEPARTS</span>
                        <span class="val">8:42 <small>AM</small></span>
                        <span class="status ok">On time · in 29m</span>
                      </div>
                      <div class="duration-divider">
                        <span class="dur-line"></span>
                        <span class="dur-text">40 min trip</span>
                        <span class="dur-line"></span>
                      </div>
                      <div class="time-block">
                        <span class="lbl">ARRIVES</span>
                        <span class="val">9:22 <small>AM</small></span>
                        <span class="status save">22m faster than #162</span>
                      </div>
                    </div>
                  </div>

                  <div class="smart-journey-stepper">
                    <div class="step-point done">
                      <span class="step-dot"></span>
                      <span class="step-label">Now (8:13 AM)</span>
                    </div>
                    <div class="step-bar walk">
                      <span class="step-duration">12 min walk to station</span>
                    </div>
                    <div class="step-point board">
                      <span class="step-dot active"></span>
                      <span class="step-label">Board at 8:40 AM</span>
                    </div>
                    <div class="step-bar ride">
                      <span class="step-duration">40 min train ride · 5 stops</span>
                    </div>
                    <div class="step-point arrive">
                      <span class="step-dot"></span>
                      <span class="step-label">Arrive Sunnyvale 9:22 AM</span>
                    </div>
                  </div>
                </div>

                <div class="smart-hero-actions">
                  <button class="action-btn primary">${I("glasses", 16)} Push to Even G2 Glasses</button>
                  <button class="action-btn secondary">${I("bell", 16)} Tap iPhone when boarding</button>
                  <button class="action-btn text">See later trains ↓</button>
                </div>
              </div>

              <!-- Backup / Later Options -->
              <div class="assistant-alternatives">
                <div class="alt-header">
                  <h3>Other upcoming departures (SF → Sunnyvale)</h3>
                  <button class="swap-btn">⇄ Switch to Evening Commute</button>
                </div>
                <div class="alt-cards-grid">
                  ${sampleTrains.filter((t) => t.train !== "504").slice(0, 3).map((t) => `
                    <div class="alt-card">
                      <div class="alt-top">
                        <span class="train-id">#${t.train} ${t.kind}</span>
                        <span class="train-in ${t.status}">${t.inText}</span>
                      </div>
                      <div class="alt-times">${t.dep} → ${t.arr}</div>
                      <div class="alt-footer">
                        <span>${t.stops} stops</span>
                        <span class="${t.status === "late" ? "warn" : "ok"}">${t.status === "late" ? `+${t.delayMin}m late` : "On time"}</span>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>
        `,
      },

      // 6: Split-Flap Matrix
      {
        id: "split-flap",
        n: 6,
        name: "Split-Flap Matrix Board",
        tagline: "Retro-modern Grand Central departure wall with mechanical split-flap aesthetics",
        concept: "Captures the visceral magic of classic train station split-flap solari boards. Each departure is rendered with authentic split-flap character tiles, amber backlighting, and distinct service color-coding, creating an unforgettable transit aesthetic.",
        moves: [
          "Authentic split-flap departure board tiles with subtle 3D mechanical divider seams",
          "Amber and phosphor green luminescent indicators for departure statuses and track numbers",
          "Clear visual tiers: Express in bold crimson, Limited in industrial yellow, Local in cool slate",
          "Even G2 preview presented as an optical mirror HUD beside the main board",
        ],
        palette: [["Flap Obsidian", "#0A0D0E"], ["Flap Tile", "#161B1E"], ["Amber Glow", "#F59E0B"], ["Phosphor Jade", "#10B981"]],
        facts: { Aesthetic: "Solari Split-Flap Mechanical", Typography: "Monospace Flap Tiles", Ambiance: "Grand Central / Airport", Effort: "M" },
        render: () => `
          <div class="hwy-page flap-page">
            <header class="flap-nav">
              <div class="flap-brand">
                <span class="flap-char">H</span><span class="flap-char">E</span><span class="flap-char">A</span><span class="flap-char">D</span><span class="flap-char">W</span><span class="flap-char">A</span><span class="flap-char">Y</span>
                <span class="flap-subtitle">SAN FRANCISCO STATION DEPARTURES</span>
              </div>
              <div class="flap-clock">
                <span class="flap-char">0</span><span class="flap-char">8</span>:<span class="flap-char">1</span><span class="flap-char">3</span>
              </div>
            </header>

            <div class="flap-board-frame">
              <div class="flap-board-header">
                <span class="f-col-train">TRAIN</span>
                <span class="f-col-dep">DEP</span>
                <span class="f-col-dest">DESTINATION</span>
                <span class="f-col-service">SERVICE</span>
                <span class="f-col-track">TRK</span>
                <span class="f-col-status">STATUS</span>
                <span class="f-col-eta">REMARKS</span>
              </div>

              <div class="flap-rows">
                ${sampleTrains.map((t) => `
                  <div class="flap-row ${t.kind.toLowerCase()}">
                    <div class="f-col-train">
                      <span class="flap-text">#${t.train}</span>
                    </div>
                    <div class="f-col-dep">
                      <span class="flap-text amber">${t.dep.replace(" AM", "")}</span>
                    </div>
                    <div class="f-col-dest">
                      <span class="flap-text">SUNNYVALE</span>
                    </div>
                    <div class="f-col-service">
                      <span class="flap-service-tag ${t.kind}">${t.kind === "LOC" ? "LOCAL" : t.kind === "EXP" ? "EXPRESS" : "LIMITED"}</span>
                    </div>
                    <div class="f-col-track">
                      <span class="flap-text green">${t.track.replace("Track ", "")}</span>
                    </div>
                    <div class="f-col-status">
                      <span class="flap-status-text ${t.status}">${t.status === "on_time" ? "ON TIME" : t.status === "late" ? `+${t.delayMin}M LATE` : "CANCELED"}</span>
                    </div>
                    <div class="f-col-eta">
                      <span class="flap-text amber">${t.inText}</span>
                    </div>
                  </div>
                `).join("")}
              </div>

              <div class="flap-ticker-bottom">
                <span class="ticker-label">NOTICE:</span>
                <span class="ticker-text">SAN MATEO ELEVATOR OUT OF SERVICE UNTIL 10/29 · ALL TRAINS EQUIPPED WITH BIKE CARS AND POWER RECEPTACLES · SWIPE R1 TO CYCLE DEPARTURES</span>
              </div>
            </div>

            <div class="flap-side-dock">
              <div class="flap-glasses-card">
                <div class="f-g2-title">${I("glasses", 14)} EVEN G2 HUD STREAM</div>
                <pre class="f-g2-hud">${g2Lines().join("\n")}</pre>
              </div>
            </div>
          </div>
        `,
      },

      // 7: Bento Dashboard
      {
        id: "bento-dashboard",
        n: 7,
        name: "Modular Bento Dashboard",
        tagline: "Apple-style modular bento grid organizing departures, HUD preview, fleet stats, and ring controls",
        concept: "Organizes the Headway experience into clean, balanced Bento grid cards. One card for the live departure list, one for the Even G2 waveguide preview, one for Caltrain electric fleet telemetry (bike spots & Wi-Fi), and one for R1 ring gestures.",
        moves: [
          "Modern Bento grid layout with subtle border highlights and 16px corner radii",
          "Dedicated Caltrain Electric EMU Fleet card highlighting onboard Wi-Fi and 12-bike capacity per train",
          "Interactive R1 gesture card demonstrating ring controls with visual ripple feedback",
          "Compact departure board with quick route station switcher dropdowns",
        ],
        palette: [["Bento Slate", "#0D1117"], ["Card Surface", "#161B22"], ["G2 Accent", "#238636"], ["Linear Blue", "#58A6FF"]],
        facts: { Layout: "Bento Grid", Modularity: "Dedicated Feature Cards", FleetInfo: "Electric Train Telemetry", Effort: "M" },
        render: () => `
          <div class="hwy-page bento-page">
            <header class="bento-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway <span class="bento-badge">BENTO DASHBOARD</span></div>
              <div class="bento-route-chip">
                <span>San Francisco ⇄ Sunnyvale</span>
                <button class="chip-swap">⇄</button>
              </div>
              <button class="hwy-pill-btn">Sign in</button>
            </header>

            <div class="bento-grid-container">
              <!-- Card 1: Live Departures (Large) -->
              <div class="bento-card bento-board">
                <div class="bento-card-head">
                  <div class="bento-title-group">
                    <span class="bento-icon">${I("train", 16)}</span>
                    <h3>Upcoming Trains</h3>
                  </div>
                  <span class="bento-badge-live">Live 511.org</span>
                </div>
                <div class="bento-train-list">
                  ${sampleTrains.slice(0, 5).map((t) => `
                    <div class="bento-train-row ${t.recommended ? "best" : ""}">
                      <div class="b-col-id">
                        <b>#${t.train}</b>
                        <span class="b-kind ${t.kind}">${t.kind}</span>
                      </div>
                      <div class="b-col-times">
                        <span class="b-dep">${t.dep}</span> → <span class="b-arr">${t.arr}</span>
                      </div>
                      <div class="b-col-track">${t.track}</div>
                      <div class="b-col-status">
                        <span class="b-status-pill ${t.status}">${t.status === "on_time" ? "On time" : t.status === "late" ? `+${t.delayMin}m` : "Cancelled"}</span>
                      </div>
                      <div class="b-col-in"><b class="b-in-val">${t.inText}</b></div>
                    </div>
                  `).join("")}
                </div>
              </div>

              <!-- Card 2: Even G2 Waveguide Preview -->
              <div class="bento-card bento-g2">
                <div class="bento-card-head">
                  <div class="bento-title-group">
                    <span class="bento-icon">${I("glasses", 16)}</span>
                    <h3>Even G2 HUD</h3>
                  </div>
                  <span class="bento-g2-tag">MICRO-LED</span>
                </div>
                <div class="bento-g2-view">
                  <pre class="bento-g2-pre">${g2Lines().slice(0, 7).join("\n")}</pre>
                </div>
              </div>

              <!-- Card 3: R1 Ring Gestures -->
              <div class="bento-card bento-ring">
                <div class="bento-card-head">
                  <div class="bento-title-group">
                    <span class="bento-icon">${I("ring", 16)}</span>
                    <h3>R1 Ring Navigation</h3>
                  </div>
                  <span class="bento-conn">BLUETOOTH 5.3</span>
                </div>
                <div class="bento-ring-gestures">
                  <div class="gesture-row"><kbd>Swipe</kbd> <span>Browse next & prev trains</span></div>
                  <div class="gesture-row"><kbd>Tap</kbd> <span>Flip commute direction</span></div>
                  <div class="gesture-row"><kbd>Hold</kbd> <span>Follow train you are on</span></div>
                  <div class="gesture-row"><kbd>2× Tap</kbd> <span>Dismiss to watchface</span></div>
                </div>
              </div>

              <!-- Card 4: Caltrain Electric Fleet Stats -->
              <div class="bento-card bento-fleet">
                <div class="bento-card-head">
                  <div class="bento-title-group">
                    <span class="bento-icon">${I("zap", 16)}</span>
                    <h3>100% Electric Fleet</h3>
                  </div>
                  <span class="bento-eco-tag">EMU 25kV</span>
                </div>
                <div class="bento-fleet-stats">
                  <div class="fleet-stat">
                    <span class="stat-num">12</span>
                    <span class="stat-lbl">Bike slots per car</span>
                  </div>
                  <div class="fleet-stat">
                    <span class="stat-num">110<small>mph</small></span>
                    <span class="stat-lbl">Max operating speed</span>
                  </div>
                  <div class="fleet-stat">
                    <span class="stat-num">100%</span>
                    <span class="stat-lbl">Outlets & Wi-Fi equipped</span>
                  </div>
                </div>
              </div>

              <!-- Card 5: Service Alert Ticker -->
              <div class="bento-card bento-alert">
                <div class="bento-card-head">
                  <div class="bento-title-group">
                    <span class="bento-icon warn">${I("alert", 16)}</span>
                    <h3>Active Service Notice</h3>
                  </div>
                </div>
                <p class="bento-alert-text">San Mateo Elevator out of service until 10/29. Northbound platform stairs only. Call (800) 660-4287 for transit assist.</p>
              </div>
            </div>
          </div>
        `,
      },

      // 8: Ecosystem Triumvirate
      {
        id: "ecosystem-triumvirate",
        n: 8,
        name: "Ecosystem Triumvirate (Glasses + Ring + iPhone)",
        tagline: "Showcases how Even G2 glasses, R1 ring, and iPhone Live Activities work as one",
        concept: "Headway is an integrated multi-device ecosystem: Even G2 on your eyes, R1 ring on your finger, and iPhone in your pocket for haptic push alerts. This candidate visualizes all three devices running in real-time alongside the web board, demonstrating how alerts trigger simultaneously on phone and glasses.",
        moves: [
          "Side-by-side device staging: iPhone Dynamic Island / Live Activity lock screen + Even G2 glasses HUD + R1 ring",
          "Visual alert propagation: show how a train delay triggers an iPhone tap and simultaneously illuminates the G2 HUD",
          "Comprehensive commute board below with 1-click station switching",
          "Builds instant user comprehension for how the hardware parts fit together",
        ],
        palette: [["Ecosystem Black", "#050709"], ["Titanium Border", "#2D3748"], ["Phosphor Wave", "#10B981"], ["Dynamic Island Dark", "#000000"]],
        facts: { Devices: "Glasses + Ring + iPhone Lock Screen", Focus: "Multi-Device Alert Flow", Ecosystem: "APNs Haptic Tap", Effort: "L" },
        render: () => `
          <div class="hwy-page eco-page">
            <header class="eco-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway <span class="eco-tag">Multi-Device Ecosystem</span></div>
              <div class="eco-tagline">Even G2 on your eyes &middot; R1 on your finger &middot; iPhone in your pocket</div>
              <button class="hwy-pill-btn">Get Started</button>
            </header>

            <div class="eco-device-stage">
              <!-- Device 1: Even G2 Glasses -->
              <div class="eco-device-col glasses-col">
                <div class="device-label">${I("glasses", 14)} ON YOUR EYES · EVEN G2</div>
                <div class="g2-stage-box">
                  <div class="g2-bezel">
                    <pre class="g2-code">> 162 LOC  8:25  ok
  504 EXP  8:42  ok
  164 LOC  8:55  ok
  408 LTD  9:12 +4m
! San Mateo Elevator
tap: flip  hold: track</pre>
                  </div>
                </div>
                <span class="device-caption">Optical Waveguide Micro-LED HUD</span>
              </div>

              <!-- Device 2: R1 Ring -->
              <div class="eco-device-col ring-col">
                <div class="device-label">${I("ring", 14)} ON YOUR FINGER · R1 RING</div>
                <div class="r1-stage-box">
                  <div class="r1-disc">
                    <div class="r1-inner">R1</div>
                    <span class="r1-arrow up">↑</span>
                    <span class="r1-arrow down">↓</span>
                    <span class="r1-arrow tap">●</span>
                  </div>
                </div>
                <span class="device-caption">Touch sensor for instant scrolling</span>
              </div>

              <!-- Device 3: iPhone Live Activity -->
              <div class="eco-device-col phone-col">
                <div class="device-label">${I("phone", 14)} IN YOUR POCKET · IPHONE</div>
                <div class="phone-lockscreen-mock">
                  <div class="dynamic-island-pill">
                    <span class="di-train">🚂 #162</span>
                    <span class="di-in">12m</span>
                  </div>
                  <div class="live-activity-card">
                    <div class="la-header">
                      <span>Caltrain Local #162</span>
                      <span class="la-status ok">On time</span>
                    </div>
                    <div class="la-route">
                      <b>San Francisco</b> → <b>Sunnyvale</b>
                    </div>
                    <div class="la-progress">
                      <div class="la-bar" style="width: 28%;"></div>
                    </div>
                    <div class="la-meta">Departs 8:25 AM · Track 2</div>
                  </div>
                </div>
                <span class="device-caption">Haptic push alerts when late or arriving</span>
              </div>
            </div>

            <div class="eco-board-section">
              <div class="eco-board-head">
                <h2>Caltrain Peninsula Departures</h2>
                <div class="route-pills">
                  <button class="route-pill active">San Francisco → Sunnyvale</button>
                  <button class="route-pill">Sunnyvale → San Francisco</button>
                </div>
              </div>
              <div class="eco-cards-grid">
                ${sampleTrains.slice(0, 4).map((t) => `
                  <div class="eco-train-card">
                    <div class="c-top">
                      <b>#${t.train} ${t.kind}</b>
                      <span class="c-in ${t.status}">${t.inText}</span>
                    </div>
                    <div class="c-times">${t.dep} → ${t.arr}</div>
                    <div class="c-meta">${t.stops} stops · ${t.track}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        `,
      },

      // 9: Journey Ribbon
      {
        id: "journey-ribbon",
        n: 9,
        name: "Journey Ribbon (Step-by-Step Commute)",
        tagline: "End-to-end continuous journey ribbon: walk to station, board, ride, and arrive",
        concept: "Caltrain commuting is not an isolated station list; it is a connected journey from your front door to your desk. This candidate visualizes your commute as a continuous flowing ribbon with milestone segments: Walk buffer, Boarding window, Intermediate station progress, and Final arrival.",
        moves: [
          "Continuous visual journey ribbon connecting door-to-door transit legs",
          "Expandable stop milestone nodes along the ride showing exact arrival time per station",
          "Caltrain EMU car breakdown diagram showing quiet car and bike car placement",
          "Live G2 glasses display displaying the active leg's tracking waypoint",
        ],
        palette: [["Ribbon Charcoal", "#111418"], ["Surface Deep", "#1A2027"], ["Journey Cyan", "#0284C7"], ["Emerald Way", "#059669"]],
        facts: { Concept: "Journey-First Mental Model", Layout: "Continuous Stepper Ribbon", Details: "Intermediate Milestones", Effort: "M" },
        render: () => `
          <div class="hwy-page ribbon-page">
            <header class="hwy-nav">
              <div class="hwy-brand"><span class="hwy-logo">▲</span> Headway <span class="hwy-tag">Journey Mode</span></div>
              <div class="hwy-commute-name">Morning Commute · Mission Bay to Sunnyvale HQ</div>
              <button class="hwy-pill-btn">Sign in</button>
            </header>

            <div class="ribbon-container">
              <div class="ribbon-hero-card">
                <div class="ribbon-card-head">
                  <div class="ribbon-title">
                    <h2>Your Journey on #504 Express</h2>
                    <span class="sub">Total travel time: 54 min (door to desk)</span>
                  </div>
                  <span class="status-live">LIVE TRACKING</span>
                </div>

                <!-- Continuous Journey Ribbon -->
                <div class="ribbon-stepper-track">
                  <!-- Leg 1: Walk -->
                  <div class="ribbon-leg walk">
                    <div class="leg-marker">${I("mapPin", 14)}</div>
                    <div class="leg-details">
                      <b>Walk to 4th & King</b>
                      <span>8:13 AM · 12 min walk (0.6 mi)</span>
                    </div>
                  </div>

                  <div class="ribbon-connector walk-train"></div>

                  <!-- Leg 2: Board Train -->
                  <div class="ribbon-leg board active">
                    <div class="leg-marker train-mark">${I("train", 14)}</div>
                    <div class="leg-details">
                      <b>Board #504 Express</b>
                      <span>8:42 AM · Platform Track 1</span>
                    </div>
                  </div>

                  <div class="ribbon-connector train-ride">
                    <span class="connector-label">40 min transit · 5 stops</span>
                  </div>

                  <!-- Leg 3: Intermediate Stops Pill -->
                  <div class="ribbon-leg stops-leg">
                    <div class="leg-marker dot">●</div>
                    <div class="leg-details">
                      <span class="stops-rollout">Millbrae (8:58) &middot; Hillsdale (9:06) &middot; Redwood City (9:12) &middot; Palo Alto (9:18)</span>
                    </div>
                  </div>

                  <div class="ribbon-connector train-dest"></div>

                  <!-- Leg 4: Arrive -->
                  <div class="ribbon-leg arrive">
                    <div class="leg-marker dest-mark">${I("check", 14)}</div>
                    <div class="leg-details">
                      <b>Arrive Sunnyvale</b>
                      <span>9:22 AM · On Time</span>
                    </div>
                  </div>
                </div>

                <!-- EMU Car Composition -->
                <div class="ribbon-car-diagram">
                  <span class="car-diagram-title">Electric EMU 6-Car Trainset Composition:</span>
                  <div class="cars-strip">
                    <div class="car-box cab">Cab 1</div>
                    <div class="car-box bike">${I("bike", 12)} Bike Car (12/12 open)</div>
                    <div class="car-box passenger">Coach A</div>
                    <div class="car-box quiet">${I("spark", 12)} Quiet Car</div>
                    <div class="car-box bike">${I("bike", 12)} Bike Car (8/12 open)</div>
                    <div class="car-box cab">Cab 2</div>
                  </div>
                </div>
              </div>

              <div class="ribbon-side-grid">
                <div class="ribbon-glasses-card">
                  <h3>${I("glasses", 14)} Even G2 Waypoint Screen</h3>
                  <div class="ribbon-g2-mock">
                    <pre class="g2-tracking-code">> TRACKING #504 EXP
  NEXT: 4TH & KING
  DEP: 8:42 AM (in 29m)
  ARR SUNNYVALE: 9:22
  STATUS: ON TIME
  BIKE CARS: 20 OPEN
tap: unpin  hold: menu</pre>
                  </div>
                </div>

                <div class="ribbon-other-trains">
                  <h3>Later Departures</h3>
                  <div class="ribbon-mini-list">
                    ${sampleTrains.slice(2, 5).map((t) => `
                      <div class="ribbon-mini-item">
                        <span>#${t.train} ${t.kind}</span>
                        <span>${t.dep} → ${t.arr}</span>
                        <span class="${t.status === "late" ? "warn" : "ok"}">${t.inText}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
      },

      // 10: Operator HUD (Cyberpunk / Terminal)
      {
        id: "operator-hud",
        n: 10,
        name: "Terminal Operator HUD",
        tagline: "Cyberpunk monospace green phosphor terminal with GTFS-RT telemetry and keyboard shortcuts",
        concept: "Leans entirely into the Even G2's authentic green phosphor CRT aesthetic. Features full monospace typography, live GTFS-RT telemetry statistics (feed latency: 84ms, APNs queue health), CRT scanlines, and instant keyboard shortcuts ([F] flip, [J/K] navigate, [T] track).",
        moves: [
          "Pure phosphor green on deep obsidian styling with optional CRT scanline toggle",
          "Live GTFS-RT / 511.org protocol telemetry header with latency and trip-descriptor counters",
          "Full keyboard navigation shortcuts ([F] Flip Route, [J/K] Select Train, [T] Track)",
          "ASCII art line diagrams and raw feed JSON inspector modal",
        ],
        palette: [["Phosphor Black", "#050A06"], ["Scanline Green", "#1AFF5A"], ["CRT Amber", "#FFB703"], ["Matrix Green", "#0D3319"]],
        facts: { Aesthetic: "Cyberpunk / CLI", Typography: "JetBrains / Fira Mono", Telemetry: "GTFS-RT Latency 84ms", Effort: "S" },
        render: () => `
          <div class="hwy-page operator-page">
            <header class="operator-nav">
              <div class="op-brand">
                <span class="op-prompt">&gt;_</span> HEADWAY.TERMINAL v2.4 // CALTRAIN.GTFS-RT
              </div>
              <div class="op-telemetry">
                <span>FEED: 511.ORG [OK]</span>
                <span>LATENCY: 84ms</span>
                <span>APNS QUEUE: 0 DLY</span>
                <span>CORRIDOR: 100% 25kV</span>
              </div>
              <div class="op-keys-hint">
                <kbd>[F]</kbd> FLIP <kbd>[J/K]</kbd> NAV <kbd>[T]</kbd> TRACK <kbd>[?]</kbd> HELP
              </div>
            </header>

            <main class="operator-body">
              <div class="op-grid">
                <div class="op-main-terminal">
                  <div class="op-term-head">
                    <span>ACTIVE ROUTE: [SF_4TH_KING] ==&gt; [SUNNYVALE]</span>
                    <span>SERVICE DAY: 20261026</span>
                  </div>

                  <div class="op-board-table">
                    <div class="op-row-th">
                      <span>TRN#</span>
                      <span>KIND</span>
                      <span>DEP</span>
                      <span>ARR</span>
                      <span>TRK</span>
                      <span>STOPS</span>
                      <span>STATUS</span>
                      <span>COUNTDOWN</span>
                    </div>
                    ${sampleTrains.map((t, idx) => `
                      <div class="op-row ${idx === 0 ? "cursor" : ""} ${t.status}">
                        <span>${idx === 0 ? "&gt;" : " "} #${t.train}</span>
                        <span class="op-kind ${t.kind}">[${t.kind}]</span>
                        <span>${t.dep.replace(" AM", "")}</span>
                        <span>${t.arr.replace(" AM", "")}</span>
                        <span>${t.track}</span>
                        <span>${t.stops} STOPS</span>
                        <span class="op-status ${t.status}">${t.status.toUpperCase()}</span>
                        <span class="op-in">${t.inText}</span>
                      </div>
                    `).join("")}
                  </div>

                  <div class="op-ascii-alert">
                    <pre>
+-- [SERVICE NOTICE] ---------------------------------------------------------+
| ID: SAN-MATEO-ELEVATOR-01                                                    |
| DESC: NORTHBOUND ELEVATOR OUT OF SERVICE UNTIL 10/29 05:00 PST               |
| ACTION: BOARD AT HILLSDALE OR CALL TRANSIT DISPATCH: 800-660-4287            |
+------------------------------------------------------------------------------+</pre>
                  </div>
                </div>

                <div class="op-glasses-terminal">
                  <div class="op-term-head">
                    <span>EVEN G2 WAVEGUIDE SIMULATOR</span>
                    <span class="blink">● REC</span>
                  </div>
                  <div class="op-crt-screen">
                    <div class="op-crt-scanlines"></div>
                    <pre class="op-crt-text">${g2Lines().join("\n")}</pre>
                  </div>
                  <div class="op-r1-terminal">
                    <div class="op-r1-title">R1 RING INTERRUPT HANDLER:</div>
                    <div class="op-r1-log">
                      <div>08:13:02 &gt; RING_SWIPE_UP   =&gt; NAV_DOWN (next train)</div>
                      <div>08:13:14 &gt; RING_TAP        =&gt; ROUTE_FLIP (SF &lt;=&gt; SUN)</div>
                      <div>08:13:28 &gt; RING_HOLD       =&gt; TRACK_TRIP #504</div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        `,
      },
    ],
  };
})();
