// Shared building blocks for the Headway feature candidates: sample data, icons, iOS chrome, the
// Trains-tab rows (faithful to apps/ios/App/Sources/BoardView.swift) and the Even G2 screen
// (faithful to packages/core/src/glasses.ts: 9 lines in a bordered frame, ASCII only).
//
// Sample data comes from the real compiled timetable (packages/core/src/timetable.gen.json),
// computed with core's departures(): Mountain View → San Francisco, Tuesday Oct 27 2026, 7:57 AM.
// Live delays are invented but shaped like core's BoardTrain (types.ts).
window.KIT = window.KIT || {};

(() => {
  const P = {
    tram: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4M8 7h8"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/>',
    house: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    glasses: '<circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 14h4M3 14l1.5-6M21 14l-1.5-6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    flip: '<path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5"/>',
    more: '<circle cx="12" cy="12" r="9.5"/><circle cx="8" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="16" cy="12" r=".8" fill="currentColor"/>',
    warn: '<path d="M12 3 2 20h20z" fill="currentColor" stroke="none"/><path d="M12 10v4M12 17v.5" stroke="#fff"/>',
    loc: '<path d="M3 11 21 3l-8 18-2-8z" fill="currentColor"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 3-7 3 3v5M12 14l-1-5 4 2 3 1M11 9l-4 2-1 4"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5v10h14V11h-1"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    msg: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5A8 8 0 1 1 21 12z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  };
  const icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
  KIT.icon = icon;

  // ── sample data ────────────────────────────────────────────────────────────
  // Settings.morning (types.ts Leg): Mountain View → San Francisco, walk_minutes 10, usual "08:15".
  KIT.leg = { from: "Mountain View", to: "San Francisco", fromShort: "MTN VIEW", toShort: "SF", walk: 10, usual: "8:15" };
  KIT.now = "7:57";
  const NOW = 7 * 60 + 57;
  const m = (s) => { const [h, mi] = s.split(":").map(Number); return h * 60 + mi; };
  const until = (t) => { const d = m(t) - NOW; return d <= 0 ? "now" : d < 60 ? `${d} min` : `${Math.floor(d / 60)} hr ${d % 60} min`; };
  const untilG = (t) => { const d = m(t) - NOW; return d <= 0 ? "now" : d < 100 ? `${d}m` : `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}`; };
  KIT.until = until; KIT.untilG = untilG; KIT.min = m; KIT.NOW = NOW;

  // BoardTrain: train, kind, dep/arr (timetable), pred_dep/pred_arr, delay_min (null = no live data),
  // status, stops_between. Timetable times are real (core departures(), feed 2026-10).
  KIT.trains = [
    { train: "409", kind: "LTD", kindName: "Limited", dep: "8:01", arr: "8:53", pdep: "8:05", parr: "8:57", delay: 4, status: "late", stops: 10 },
    { train: "113", kind: "LOC", kindName: "Local", dep: "8:16", arr: "9:16", pdep: "8:24", parr: "9:24", delay: 8, status: "late", stops: 16 },
    { train: "511", kind: "EXP", kindName: "Express", dep: "8:36", arr: "9:22", pdep: "8:36", parr: "9:22", delay: 0, status: "on_time", stops: 7 },
    { train: "115", kind: "LOC", kindName: "Local", dep: "8:46", arr: "9:46", pdep: "8:46", parr: "9:46", delay: null, status: "cancelled", stops: 16 },
    { train: "413", kind: "LTD", kindName: "Limited", dep: "9:01", arr: "9:53", pdep: "9:01", parr: "9:53", delay: null, status: "scheduled", stops: 10 },
    { train: "117", kind: "LOC", kindName: "Local", dep: "9:16", arr: "10:16", pdep: "9:16", parr: "10:16", delay: null, status: "scheduled", stops: 16 },
  ];
  // ServiceAlert from 511's feed (header + description), naming Mountain View.
  KIT.alert = { header: "Train 115 cancelled: equipment problem", description: "Southbound 115 and northbound 115 will not run this morning. Riders can take 511 or 413." };

  // TrainProgress for a tracked 409 at 8:30 (stop times real; +4 live).
  KIT.trackNow = "8:30";
  KIT.track = { train: "409", kind: "LTD", to: "San Francisco", toShort: "SF", delay: 4, next: "San Mateo", nextShort: "SAN MATEO", nextAt: "8:32", parr: "8:57", arr: "8:53", stopsLeft: 5, inMin: 27,
    line: [["Mountain View", "8:05", "past"], ["Palo Alto", "8:14", "past"], ["Redwood City", "8:22", "past"], ["Hillsdale", "8:29", "past"], ["San Mateo", "8:32", "next"], ["Millbrae", "8:37", ""], ["South SF", "8:43", ""], ["22nd Street", "8:51", ""], ["San Francisco", "8:57", "dest"]] };

  // Reliability sample (candidate 5): minutes late at Mountain View for train 113, last 20 weekdays.
  // Illustrative only: Headway keeps no delay history today.
  KIT.history = {
    "113": [0, 2, 4, 6, 1, 0, 8, 3, 5, 18, 2, 0, 4, 7, 1, 4, 0, 9, 4, 6],
    "409": [0, 1, 0, 3, 0, 2, 4, 0, 1, 0, 6, 0, 2, 1, 0, 0, 3, 1, 4, 0],
    "511": [0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 3, 0, 0, 0, 1, 0, 0, 2, 0],
  };
  KIT.stats = (a) => {
    const s = [...a].sort((x, y) => x - y), n = a.length;
    return { onTime: Math.round((100 * a.filter((v) => v < 5).length) / n), median: s[Math.floor((n - 1) / 2)], worst: s[n - 1], n };
  };

  // ── iOS chrome (390×844) ──────────────────────────────────────────────────
  KIT.statusBar = (t = KIT.now) => `<div class="sb"><b>${t}</b><span class="sbr"><i></i><i></i><i></i><i></i><em></em></span></div>`;
  KIT.nav = (title, trailing = "") => `<div class="nav"><span></span><b>${title}</b><span class="tr">${trailing}</span></div>`;
  KIT.toolbar = () => `<span class="tb">${icon("flip", 20)}</span><span class="tb">${icon("more", 21, 1.8)}</span>`;
  KIT.tabbar = (on = "trains") => `<div class="tabbar">${[["trains", "tram", "Trains"], ["commute", "house", "Commute"], ["glasses", "glasses", "Glasses"], ["settings", "gear", "Settings"]]
    .map(([id, ic, label]) => `<span class="${id === on ? "on" : ""}">${icon(ic, 23, 1.8)}<small>${label}</small></span>`).join("")}</div>`;
  KIT.app = (title, body, { tab = "trains", trailing = KIT.toolbar(), time } = {}) =>
    `${KIT.statusBar(time)}${KIT.nav(title, trailing)}<div class="list">${body}</div>${KIT.tabbar(tab)}`;
  KIT.section = (header, rows, footer = "") =>
    `<div class="hgrp">${header ? `<div class="sh">${header}</div>` : ""}<div class="cells">${rows}</div>${footer ? `<div class="sf">${footer}</div>` : ""}</div>`;

  // TrainRow, as BoardView.swift draws it.
  KIT.statusText = (t) => ({ cancelled: "Cancelled", late: `${t.delay} min late`, early: `${-t.delay} min early`, on_time: "On time", scheduled: "Scheduled" })[t.status];
  KIT.statusCls = (t) => ({ cancelled: "red", late: "orange", on_time: "green" })[t.status] || "sec";
  KIT.stopsText = (n) => (n === 0 ? "nonstop" : `${n} stop${n === 1 ? "" : "s"}`);
  KIT.trainRow = (t, { tracked = false, right, extra = "", cls = "" } = {}) => `
    <div class="cell trow ${cls}">
      <div class="tn"><b>${t.train}</b><small>${t.kindName}</small></div>
      <div class="tm">
        <div class="l1"><b class="${t.status === "cancelled" ? "strike" : ""}">${t.pdep}</b>${t.pdep !== t.dep ? `<s>${t.dep}</s>` : ""}<span>→ ${t.parr}</span></div>
        <div class="l2"><span class="${KIT.statusCls(t)}">${KIT.statusText(t)}</span><span class="sec">· ${KIT.stopsText(t.stops)}</span>${tracked ? `<span class="acc">${icon("loc", 11)}</span>` : ""}</div>
        ${extra}
      </div>
      <div class="tu">${right ?? (t.status === "cancelled" ? "" : until(t.pdep))}</div>
    </div>`;
  KIT.boardHeader = (label = "Morning commute", live = true) => `<span>${label}</span><span class="pill ${live ? "live" : ""}">${live ? "LIVE" : "TIMETABLE"}</span>`;
  KIT.alertSection = () => KIT.section("Caltrain alerts", `<div class="cell alert"><b>${icon("warn", 16)} ${KIT.alert.header}</b><small>${KIT.alert.description}</small></div>`);
  KIT.title = `${KIT.leg.from} → ${KIT.leg.to}`;

  // ── Even G2 screen (glasses.ts): 9 lines, bordered frame, ASCII, proportional font ──
  // A line is a string, ["left", "right"] (spreadPx) or { row: [cursor, train, kind, time, status], right }.
  KIT.glasses = (lines, caption = "") => `
    <div class="g-wrap"><div class="g-screen">${lines.slice(0, 9).map((l) => {
      if (l && l.row) return `<div class="gl"><span class="gcols">${l.row.map((c, i) => `<i class="c${i}">${c}</i>`).join("")}</span><span>${l.right || ""}</span></div>`;
      if (Array.isArray(l)) return `<div class="gl"><span>${l[0]}</span><span>${l[1]}</span></div>`;
      return `<div class="gl"><span>${l || "&nbsp;"}</span></div>`;
    }).join("")}</div>${caption ? `<div class="g-cap">${caption}</div>` : ""}</div>`;
  KIT.gStatus = (t) => ({ cancelled: "CXL", late: `+${t.delay}`, on_time: "ok" })[t.status] || "";
  KIT.gRow = (t, sel, right) => ({ row: [sel ? "&gt;" : "", t.train, t.kind, t.pdep, KIT.gStatus(t)], right: right ?? (t.status === "cancelled" ? "" : untilG(t.pdep)) });
  KIT.gHead = () => [`${KIT.leg.fromShort} &gt; ${KIT.leg.toShort}`, `${KIT.now} AM`];

  // ── Lock Screen ───────────────────────────────────────────────────────────
  KIT.lock = (body, { time = "8:30", date = "Tuesday, October 27" } = {}) =>
    `<div class="lock"><div class="sb lsb"><b></b><span class="sbr"><i></i><i></i><i></i><i></i><em></em></span></div>
      <div class="ldate">${date}</div><div class="ltime">${time}</div><div class="lspace"></div>${body}
      <div class="lbtns"><span>${icon("bolt", 20)}</span><span>${icon("lock", 20)}</span></div><div class="hbar"></div></div>`;
})();
