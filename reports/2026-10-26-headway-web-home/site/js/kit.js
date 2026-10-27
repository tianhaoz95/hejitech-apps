// Shared building blocks for Headway Web Home review candidates
const KIT = window.KIT = window.KIT || {};

(() => {
  const ICONS = {
    train: '<path d="M4 15V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="m6 19-2 2"/><path d="m18 19 2 2"/>',
    glasses: '<path d="M3 13a4 4 0 0 0 8 0V9H3v4Z"/><path d="M13 13a4 4 0 0 0 8 0V9h-8v4Z"/><path d="M11 11h2"/><path d="M3 9 1 6"/><path d="M21 9l2-3"/>',
    ring: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" stroke-dasharray="2 2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    spark: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 17.5V14l-3-3 4-3 2 3h2"/><path d="M12 17.5V14H6.5l2.5-4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  };

  KIT.icon = (name, size = 18, sw = 2, cls = "") =>
    `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  KIT.stations = [
    { id: "san_francisco", name: "San Francisco", short: "SF", zone: 1 },
    { id: "22nd_street", name: "22nd Street", short: "22ND ST", zone: 1 },
    { id: "bayshore", name: "Bayshore", short: "BAYSHORE", zone: 1 },
    { id: "south_san_francisco", name: "South San Francisco", short: "SO SF", zone: 1 },
    { id: "san_bruno", name: "San Bruno", short: "SAN BRUNO", zone: 1 },
    { id: "millbrae", name: "Millbrae", short: "MILLBRAE", zone: 2 },
    { id: "burlingame", name: "Burlingame", short: "BURLINGAME", zone: 2 },
    { id: "san_mateo", name: "San Mateo", short: "SAN MATEO", zone: 2 },
    { id: "hayward_park", name: "Hayward Park", short: "HAYWARD PK", zone: 2 },
    { id: "hillsdale", name: "Hillsdale", short: "HILLSDALE", zone: 2 },
    { id: "belmont", name: "Belmont", short: "BELMONT", zone: 2 },
    { id: "san_carlos", name: "San Carlos", short: "SAN CARLOS", zone: 2 },
    { id: "redwood_city", name: "Redwood City", short: "REDWOOD CTY", zone: 2 },
    { id: "menlo_park", name: "Menlo Park", short: "MENLO PARK", zone: 3 },
    { id: "palo_alto", name: "Palo Alto", short: "PALO ALTO", zone: 3 },
    { id: "california_ave", name: "California Ave", short: "CAL AVE", zone: 3 },
    { id: "san_antonio", name: "San Antonio", short: "SAN ANTONIO", zone: 3 },
    { id: "mountain_view", name: "Mountain View", short: "MTN VIEW", zone: 3 },
    { id: "sunnyvale", name: "Sunnyvale", short: "SUNNYVALE", zone: 3 },
    { id: "lawrence", name: "Lawrence", short: "LAWRENCE", zone: 4 },
    { id: "santa_clara", name: "Santa Clara", short: "SNTA CLARA", zone: 4 },
    { id: "college_park", name: "College Park", short: "COLLEGE PK", zone: 4 },
    { id: "san_jose_diridon", name: "San Jose Diridon", short: "SJ DIRIDON", zone: 4 },
    { id: "tamien", name: "Tamien", short: "TAMIEN", zone: 4 },
  ];

  KIT.sampleTrains = [
    {
      train: "162",
      kind: "LOC",
      dep: "8:25 AM",
      arr: "9:27 AM",
      status: "on_time",
      delayMin: 0,
      inMin: 12,
      inText: "12m",
      stops: 17,
      track: "Track 2",
      fleet: "EMU Electric",
      bikeCars: "8/12 available",
      stopsSummary: "22nd, Millbrae, San Mateo, Hillsdale, Redwood City, Palo Alto, Sunnyvale",
      recommended: false,
    },
    {
      train: "504",
      kind: "EXP",
      dep: "8:42 AM",
      arr: "9:22 AM",
      status: "on_time",
      delayMin: 0,
      inMin: 29,
      inText: "29m",
      stops: 5,
      track: "Track 1",
      fleet: "EMU Electric",
      bikeCars: "11/12 available",
      timeSaved: "22 min faster",
      stopsSummary: "Millbrae, Hillsdale, Redwood City, Palo Alto, Sunnyvale",
      recommended: true,
      reason: "Fastest option · Beats #162 by 5 min",
    },
    {
      train: "164",
      kind: "LOC",
      dep: "8:55 AM",
      arr: "9:58 AM",
      status: "on_time",
      delayMin: 0,
      inMin: 42,
      inText: "42m",
      stops: 17,
      track: "Track 3",
      fleet: "EMU Electric",
      bikeCars: "9/12 available",
      stopsSummary: "All stations between SF and Sunnyvale",
      recommended: false,
    },
    {
      train: "408",
      kind: "LTD",
      dep: "9:12 AM",
      arr: "10:04 AM",
      status: "late",
      delayMin: 4,
      inMin: 59,
      inText: "59m (+4m)",
      stops: 9,
      track: "Track 2",
      fleet: "EMU Electric",
      bikeCars: "6/12 available",
      timeSaved: "10 min faster",
      stopsSummary: "22nd, Millbrae, San Mateo, San Carlos, Palo Alto, Mountain View",
      recommended: false,
    },
    {
      train: "166",
      kind: "LOC",
      dep: "9:25 AM",
      arr: "10:28 AM",
      status: "on_time",
      delayMin: 0,
      inMin: 72,
      inText: "1h 12m",
      stops: 17,
      track: "Track 4",
      fleet: "EMU Electric",
      bikeCars: "12/12 available",
      stopsSummary: "All stations between SF and Sunnyvale",
      recommended: false,
    },
    {
      train: "168",
      kind: "LOC",
      dep: "9:55 AM",
      arr: "10:58 AM",
      status: "scheduled",
      delayMin: null,
      inMin: 102,
      inText: "1h 42m",
      stops: 17,
      track: "Track 2",
      fleet: "EMU Electric",
      bikeCars: "12/12 available",
      stopsSummary: "All stations between SF and Sunnyvale",
      recommended: false,
    },
    {
      train: "170",
      kind: "LOC",
      dep: "10:25 AM",
      arr: "11:28 AM",
      status: "scheduled",
      delayMin: null,
      inMin: 132,
      inText: "2h 12m",
      stops: 17,
      track: "Track 3",
      fleet: "EMU Electric",
      bikeCars: "12/12 available",
      stopsSummary: "All stations between SF and Sunnyvale",
      recommended: false,
    },
    {
      train: "172",
      kind: "LOC",
      dep: "10:55 AM",
      arr: "11:58 AM",
      status: "cancelled",
      delayMin: null,
      inMin: null,
      inText: "CXL",
      stops: 17,
      track: "-",
      fleet: "EMU Electric",
      bikeCars: "-",
      cancelReason: "Mechanical equipment hold at 4th & King yard",
      stopsSummary: "Cancelled between SF and San Jose",
      recommended: false,
    },
  ];

  KIT.alerts = [
    {
      id: "san-mateo-elevator",
      title: "San Mateo Station Northbound Elevator Out of Service",
      body: "Elevator out of service until 10/29 5:00 AM. For accessibility assistance call (800) 660-4287.",
      type: "warning",
    },
    {
      id: "chase-center-shuttle",
      title: "Chase Center Event Service",
      body: "Extra post-event northbound trains departing 22nd St 15m after end of regulation.",
      type: "info",
    },
  ];

  KIT.commutePresets = [
    { id: "sf-sunnyvale", label: "Work", from: "San Francisco", to: "Sunnyvale", dep: "8:25 AM", active: true },
    { id: "sunnyvale-sf", label: "Home", from: "Sunnyvale", to: "San Francisco", dep: "5:38 PM", active: false },
    { id: "sf-paloalto", label: "Campus", from: "San Francisco", to: "Palo Alto", dep: "8:42 AM", active: false },
    { id: "mtnview-sf", label: "Weekend", from: "Mountain View", to: "San Francisco", dep: "10:14 AM", active: false },
  ];

  // Simulated Glasses G2 Text HUD lines
  KIT.g2Lines = (from = "SF", to = "SUNNYVALE") => [
    `${from} > ${to}`,
    `> 162 LOC  8:25  ok`,
    `  504 EXP  8:42  ok`,
    `  164 LOC  8:55  ok`,
    `  408 LTD  9:12 +4m`,
    `  166 LOC  9:25  ok`,
    `  168 LOC  9:55`,
    `! Elevator out at San Mateo`,
    `tap: flip  hold: menu  2x: exit`,
  ];

  // Helper for glasses HUD inside a realistic Even G2 frame
  KIT.renderEvenG2Frame = (lines = KIT.g2Lines()) => `
    <div class="hw-g2-mockup">
      <div class="hw-g2-chassis">
        <div class="hw-g2-bridge"></div>
        <div class="hw-g2-rim left">
          <div class="hw-g2-lens">
            <div class="hw-g2-waveguide">
              <div class="hw-g2-hud">
                ${lines.map((l) => `<div class="hw-g2-line ${l.startsWith(">") ? "active" : l.startsWith("!") ? "alert" : l.startsWith("tap:") ? "foot" : ""}">${l}</div>`).join("")}
              </div>
            </div>
          </div>
        </div>
        <div class="hw-g2-rim right">
          <div class="hw-g2-lens clear">
            <div class="hw-g2-pass-through"></div>
          </div>
        </div>
      </div>
      <div class="hw-g2-caption">
        <span class="dot live"></span> Even G2 Green MicroLED Optical Waveguide (640×200 green phosphor)
      </div>
    </div>
  `;

  // Helper for R1 Ring interactive control dial
  KIT.renderR1Ring = () => `
    <div class="hw-r1-widget">
      <div class="hw-r1-device">
        <div class="hw-r1-core">
          <div class="hw-r1-touchpad">
            <span class="hw-r1-gesture">R1</span>
          </div>
        </div>
        <div class="hw-r1-ring-track">
          <span class="hw-r1-notch top" title="Swipe Up">↑</span>
          <span class="hw-r1-notch right" title="Tap / Flip">●</span>
          <span class="hw-r1-notch bottom" title="Swipe Down">↓</span>
          <span class="hw-r1-notch left" title="Hold / Menu">◉</span>
        </div>
      </div>
      <div class="hw-r1-actions">
        <button class="hw-r1-btn" type="button" data-key="up"><kbd>↑</kbd> Next</button>
        <button class="hw-r1-btn" type="button" data-key="down"><kbd>↓</kbd> Prev</button>
        <button class="hw-r1-btn" type="button" data-key="tap"><kbd>●</kbd> Flip</button>
        <button class="hw-r1-btn" type="button" data-key="hold"><kbd>◉</kbd> Track</button>
      </div>
    </div>
  `;
})();
