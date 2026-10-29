// Shared building blocks for the Headway Even G2 glasses UI/UX candidates:
// Even G2 micro-OLED display metrics (576×288 px, 9 lines, 27px line pitch, green phosphor HUD),
// real Caltrain timetable data (Mountain View → San Francisco, Tue Oct 27 2026, 7:57 AM),
// simulated live GTFS-RT delays, and glasses screen renderers.

window.KIT = window.KIT || {};

(() => {
  const K = KIT;

  // ── Sample Caltrain Data (Mountain View → San Francisco) ─────────────────────
  K.now = "7:57";
  K.leg = { from: "Mountain View", to: "San Francisco", fromShort: "MTN VIEW", toShort: "SF", walk: 10 };

  K.trains = [
    { train: "409", kind: "LTD", kindName: "Limited", dep: "8:01", arr: "8:53", pdep: "8:05", parr: "8:57", delay: 4, status: "late", stops: 10, track: "Track 2", emu: true, crowding: [2, 2, 1, 1, 2, 3, 2], bikes: 8 },
    { train: "113", kind: "LOC", kindName: "Local", dep: "8:16", arr: "9:16", pdep: "8:24", parr: "9:24", delay: 8, status: "late", stops: 16, track: "Track 2", emu: false, crowding: [3, 3, 3, 2, 2, 3], bikes: 2 },
    { train: "511", kind: "EXP", kindName: "Express", dep: "8:36", arr: "9:22", pdep: "8:36", parr: "9:22", delay: 0, status: "on_time", stops: 7, track: "Track 2", emu: true, crowding: [1, 2, 1, 1, 2, 2, 1], bikes: 12 },
    { train: "115", kind: "LOC", kindName: "Local", dep: "8:46", arr: "9:46", pdep: "8:46", parr: "9:46", delay: null, status: "cancelled", stops: 16, track: "--", emu: false },
    { train: "413", kind: "LTD", kindName: "Limited", dep: "9:01", arr: "9:53", pdep: "9:01", parr: "9:53", delay: null, status: "scheduled", stops: 10, track: "Track 2", emu: true, crowding: [1, 1, 1, 1, 1, 1, 1], bikes: 14 },
    { train: "117", kind: "LOC", kindName: "Local", dep: "9:16", arr: "10:16", pdep: "9:16", parr: "10:16", delay: null, status: "scheduled", stops: 16, track: "Track 2", emu: true, crowding: [1, 1, 1, 1, 1, 1, 1], bikes: 15 },
  ];

  K.alert = {
    header: "Train 115 cancelled: mechanical inspection",
    description: "Northbound 115 will not operate. Take 511 Express or 413 Limited.",
  };

  K.track = {
    train: "409",
    kind: "LTD",
    from: "Mountain View",
    fromShort: "MTN VIEW",
    to: "San Francisco",
    toShort: "SF",
    delay: 4,
    next: "San Mateo",
    nextShort: "SAN MATEO",
    nextAt: "8:32",
    parr: "8:57",
    arr: "8:53",
    stopsLeft: 5,
    speed: 79,
    distNextMi: 3.2,
    stations: [
      { name: "Mountain View", short: "MTN VIEW", time: "8:05", done: true },
      { name: "Palo Alto", short: "PALO ALTO", time: "8:14", done: true },
      { name: "Redwood City", short: "REDWOOD CITY", time: "8:22", done: true },
      { name: "Hillsdale", short: "HILLSDALE", time: "8:29", done: true },
      { name: "San Mateo", short: "SAN MATEO", time: "8:32", next: true },
      { name: "Millbrae", short: "MILLBRAE", time: "8:37" },
      { name: "South SF", short: "SOUTH SF", time: "8:43" },
      { name: "22nd Street", short: "22ND ST", time: "8:51" },
      { name: "San Francisco", short: "SF", time: "8:57", dest: true },
    ],
  };

  // ── Helper formatters ──────────────────────────────────────────────────────
  const NOW_M = 7 * 60 + 57;
  const parseMin = (s) => { const [h, mi] = s.split(":").map(Number); return h * 60 + mi; };
  K.until = (t) => {
    const d = parseMin(t) - NOW_M;
    if (d <= 0) return "now";
    if (d < 100) return `${d}m`;
    return `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}`;
  };

  K.statusTag = (t) => {
    switch (t.status) {
      case "cancelled": return "CXL";
      case "late": return `+${t.delay}`;
      case "early": return `${t.delay}`;
      case "on_time": return "ok";
      default: return "";
    }
  };

  // ── Even G2 Screen Generator (576×288 px, 9 lines, green on black) ─────────
  // A screen consists of an array of up to 9 lines.
  // Each line can be:
  // - A string: renders left-aligned or pre-formatted
  // - A 2-element array [left, right]: spread across the line
  // - An object with specific HUD layout directives
  K.screen = (lines, { border = true, inverted = false, toast = null, peripheral = false, frameCls = "" } = {}) => {
    const safeLines = lines.slice(0, 9);
    while (safeLines.length < 9) safeLines.push("");

    return `
      <div class="even-hud ${inverted ? "inverted" : ""} ${peripheral ? "peripheral" : ""} ${frameCls}">
        <div class="even-bezel ${border ? "bordered" : "borderless"}">
          ${safeLines.map((l, idx) => {
            if (!l) return `<div class="hl hl-empty" data-line="${idx}">&nbsp;</div>`;
            if (Array.isArray(l)) {
              return `<div class="hl hl-spread" data-line="${idx}">
                <span class="hl-left">${l[0]}</span>
                <span class="hl-right">${l[1]}</span>
              </div>`;
            }
            if (typeof l === "object" && l.row) {
              return `<div class="hl hl-row ${l.cls || ""}" data-line="${idx}">
                <span class="c-cur">${l.row[0] || "&nbsp;"}</span>
                <span class="c-trn">${l.row[1] || ""}</span>
                <span class="c-knd">${l.row[2] || ""}</span>
                <span class="c-dep">${l.row[3] || ""}</span>
                <span class="c-sts">${l.row[4] || ""}</span>
                <span class="c-unt">${l.row[5] || ""}</span>
              </div>`;
            }
            return `<div class="hl hl-text" data-line="${idx}">${l}</div>`;
          }).join("")}
          ${toast ? `<div class="hud-toast-overlay"><div class="hud-toast">${toast}</div></div>` : ""}
        </div>
      </div>`;
  };

  // Standard train row formatted for baseline Even G2 proportional renderer
  K.stdRow = (t, isSelected = false, overrideRight = null) => ({
    row: [
      isSelected ? "&gt;" : "",
      t.train,
      t.kind,
      t.pdep,
      K.statusTag(t),
      overrideRight !== null ? overrideRight : (t.status === "cancelled" ? "" : K.until(t.pdep)),
    ],
  });

  K.footGesture = "tap: flip  hold: menu  2x: exit";
  K.headLine = [`${K.leg.fromShort} &gt; ${K.leg.toShort}`, `LIVE ${K.now} AM`];
})();
