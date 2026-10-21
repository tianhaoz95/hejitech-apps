// Shared building blocks for the Wee Hours roadmap review (5 features + 10 improvements).
// Recreates the real iOS screens (HomeView, TimelineView, SettingsView, ListeningView, EditEventView)
// from projects/weehours/apps/ios/App/Sources/ with real sample data from spec/event-types.json.
window.KIT = window.KIT || {};

(() => {
  const P = {
    bottle: '<path d="M9 2h6M10 2v3M14 2v3"/><path d="M8 8a2 2 0 0 1 2-3h4a2 2 0 0 1 2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M12 12.5c-1 1.3-1.5 2-1.5 2.7a1.5 1.5 0 0 0 3 0c0-.7-.5-1.4-1.5-2.7z" fill="currentColor"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" fill="currentColor"/>',
    drop: '<path d="M3 8c2-2 4-2 6 0s4 2 6 0M3 12c2-2 4-2 6 0M3 16c2-2 4-2 6 0"/><path d="M17 9c-2 2.6-3 4.1-3 5.5a3 3 0 0 0 6 0c0-1.4-1-2.9-3-5.5z" fill="currentColor"/>',
    moon: '<path d="M20 15A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 11z" fill="currentColor"/><path d="M15 3h4l-4 4h4"/>',
    sun: '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    pump: '<path d="M12 3 21 19H3z" fill="currentColor"/><path d="M12 10c-1 1.3-1.5 2-1.5 2.7a1.5 1.5 0 0 0 3 0c0-.7-.5-1.4-1.5-2.7z" fill="#fff" stroke="none"/>',
    scale: '<circle cx="12" cy="5" r="2"/><path d="M6 9h12l2 11H4z" fill="currentColor"/>',
    ruler: '<rect x="2" y="8" width="20" height="8" rx="2" fill="currentColor"/><path d="M6 8v3M9 8v2M12 8v3M15 8v2M18 8v3" stroke="#fff"/>',
    head: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
    list: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 12h10M7 15h10"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    stars: '<path d="M18 14A7 7 0 1 1 9 5a5.5 5.5 0 0 0 9 9z" fill="currentColor"/><path d="M18 3v4M16 5h4"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 20a4.5 4.5 0 0 1 7-3.7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    therm: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/>',
    bath: '<path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h1"/><path d="M7 20v2M17 20v2"/>',
    walk: '<circle cx="12" cy="4" r="2" fill="currentColor"/><path d="m9 20 2-6 3 2v4M10 14l1-5 3 2 2-1M8 12l3-3"/>',
    tummy: '<circle cx="17" cy="9" r="2.5" fill="currentColor"/><path d="M3 16c3 0 5-3 9-3s5 3 9 3"/><path d="M7 15v4M15 14v5"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor"/>',
    fork: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    watch: '<rect x="6" y="5" width="12" height="14" rx="3"/><path d="M9 2h6M9 22h6M18 10h1v4h-1"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 19h4"/>',
    glasses: '<circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 14h4M3 13 4.5 7M21 13 19.5 7"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2v2h-2zM19 14h2v2h-2z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    snow: '<path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    island: '<rect x="4" y="5" width="16" height="8" rx="4" fill="currentColor"/>',
    touch: '<circle cx="12" cy="12" r="8"/><path d="M12 9v6M9 12h6"/>',
    gauge: '<path d="M12 14v-4M3.34 19a10 10 0 1 1 17.32 0"/>',
    chart: '<path d="M3 3v18h18M19 9l-5 5-4-4-3 3"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
    play: '<polygon points="7 4 19 12 7 20 7 4" fill="currentColor"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
    checkSq: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m9 12 2 2 4-4"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  };

  const I = (KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`);

  KIT.statusBar = (time = "3:12") => `<div class="sb"><b>${time}</b><span>●●● ▮</span></div>`;

  // Sample household (from Household.swift / Baby / StatusSnapshot):
  // Twins Mia & Leo (3 weeks old), caregivers Sam (Dad) and Alex (Mom).
  KIT.mia = {
    id: "mia", name: "Mia", age: "3 weeks", color: "#E07FA6", bottleMl: 90, side: "left",
    status: "Fed 1h20m ago · left next · diaper 40m ago",
    short: "Fed 1h20m ago", sub: "left next · diaper 40m ago", sleeping: false,
  };
  KIT.leo = {
    id: "leo", name: "Leo", age: "3 weeks", color: "#3FA58F", bottleMl: 110, side: "right",
    status: "Sleeping 35m · right next · diaper 1h05m ago",
    short: "Sleeping 35m", sub: "right next · diaper 1h05m ago", sleeping: true,
  };

  KIT.dot = (color, size = 9) => `<i class="kdot" style="--k:${color};width:${size}px;height:${size}px"></i>`;
  KIT.chip = (name, color) => `<span class="kchip" style="--k:${color}">${name}</span>`;

  KIT.nav = (title, right = "") => `<div class="nav"><div class="navr">${right}</div><h1>${title}</h1></div>`;
  KIT.navInline = (left, title, right = "") => `<div class="navi"><span>${left}</span><b>${title}</b><span class="r">${right}</span></div>`;
  KIT.pill = (t) => `<span class="pillr">${t}</span>`;

  KIT.duty = (who = "Alex (Mom) is on duty", btn = "I've got it") =>
    `<div class="duty">${I("people", 14)}<span>${who}</span><b>${btn}</b></div>`;

  KIT.statusCard = (line = KIT.mia.status, duty = true) =>
    `<div class="card status"><p class="line">${line}</p>${duty ? KIT.duty() : ""}</div>`;

  // Multi-child header from HomeView.swift (ChildrenPanel + LogForBar)
  KIT.childrenPanel = (selected = "mia") => {
    const cards = [KIT.mia, KIT.leo].map((k) => {
      const on = selected === k.id || selected === "both";
      return `<div class="ccard${on ? " on" : ""}" style="--k:${k.color}">
        <div class="ch">${KIT.dot(k.color)}<b>${k.name}</b></div>
        <p>${k.short}</p>
        <small>${k.sub}</small>
      </div>`;
    }).join("");
    return `<div class="cgrid">${cards}</div>
      <div class="duty solo">${I("people", 14)}<span>Alex · Mom is on duty</span><b>I've got it</b></div>
      <div class="logfor">
        <small>Log for</small>
        <div class="lfchips">
          <span class="${selected === "mia" ? "on" : ""}" style="--k:${KIT.mia.color}">${KIT.dot(selected === "mia" ? "#fff" : KIT.mia.color, 7)}Mia</span>
          <span class="${selected === "leo" ? "on" : ""}" style="--k:${KIT.leo.color}">${KIT.dot(selected === "leo" ? "#fff" : KIT.leo.color, 7)}Leo</span>
          <span class="${selected === "both" ? "on" : ""}" style="--k:var(--acc)">Both</span>
        </div>
        <i class="fold">${I("up", 14)}</i>
      </div>`;
  };

  KIT.tile = (title, sub, icon, cls, extra = "") =>
    `<div class="tile ${cls}" data-tile><div class="th"><span class="ti">${I(icon, 24)}</span>${extra}</div><b>${title}</b><small>${sub}</small></div>`;

  KIT.defaultTiles = (k = KIT.mia) => [
    KIT.tile("Start bottle", `${k.bottleMl || 120} ml`, "bottle", "feed"),
    KIT.tile("Start nursing", `${k.side} side`, "heart", "feed"),
    KIT.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
    k.sleeping ? KIT.tile("Woke up", "end sleep", "sun", "sleep") : KIT.tile("Fell asleep", "start sleep", "moon", "sleep"),
    KIT.tile("Pumped", "both sides", "pump", "other"),
    KIT.tile("Weight", "4.10 kg", "scale", "growth"),
    KIT.tile("Medication", "2h 10m ago", "pill", "health"),
    KIT.tile("Tummy time", "1h 45m ago", "tummy", "activity"),
  ];

  KIT.grid = (tiles) => `<div class="grid">${tiles.join("")}</div>`;

  KIT.tabBar = (on = "now") => `<div class="tabs">
    <span class="${on === "now" ? "on" : ""}">${I("stars", 20)}<small>Now</small></span>
    <span class="${on === "timeline" ? "on" : ""}">${I("list", 20)}<small>Timeline</small></span>
    <span class="${on === "settings" ? "on" : ""}">${I("gear", 20)}<small>Settings</small></span></div>`;

  KIT.fab = (extra = "") => `<div class="fab">${extra}<i>${I("mic", 25, 2.2)}</i></div>`;

  KIT.phone = (body, { tab = "now", fab = true, fabExtra = "", overlay = "", time = "3:12" } = {}) =>
    `${KIT.statusBar(time)}<div class="body">${body}</div>${overlay}<div class="dock">${fab ? KIT.fab(fabExtra) : ""}${KIT.tabBar(tab)}</div>`;

  KIT.toast = (text, action = "Undo", icon = "check") =>
    `<div class="toastm"><span class="ok ${icon}">${I(icon, 13, 2.8)}</span><span class="tx">${text}</span><b>${action}</b></div>`;

  // Real sample events (matching EventRow in TimelineView.swift)
  KIT.sampleEvents = [
    { id: "e1", t: "3:05 AM", kid: KIT.mia, icon: "drop", cls: "diaper", label: "Diaper · wet", by: "Sam", surf: "phone" },
    { id: "e2", t: "2:37 AM", kid: KIT.leo, icon: "moon", cls: "sleep", label: "Fell asleep", by: "Alex", surf: "watch", quote: "Leo fell asleep" },
    { id: "e3", t: "1:55 AM", kid: KIT.mia, icon: "bottle", cls: "feed", label: "Finish bottle · drank ¾", ml: "90 ml", by: "Sam", surf: "phone", quote: "finished bottle drank three quarters" },
    { id: "e4", t: "1:40 AM", kid: KIT.mia, icon: "bottle", cls: "feed", label: "Start bottle · formula", by: "Sam", surf: "phone" },
    { id: "e5", t: "12:50 AM", kid: KIT.mia, icon: "pill", cls: "health", label: "Medication · Infant Tylenol, 1.25 ml", by: "Alex", surf: "phone" },
    { id: "e6", t: "11:20 PM", kid: KIT.mia, icon: "pump", cls: "other", label: "Pump · 110 ml, both", by: "Alex", surf: "phone", quote: "pumped 110 ml both sides" },
  ];

  KIT.evRow = (e, { multi = false, extraRight = "", subExtra = "" } = {}) => `
    <div class="ev">
      <span class="evi ${e.cls}">${I(e.icon, 15)}</span>
      <div class="evb">
        <div class="evt">
          <b>${e.label}</b>${e.ml ? `<span class="evml">${e.ml}</span>` : ""}
          ${multi && e.kid ? KIT.chip(e.kid.name, e.kid.color) : ""}
          ${extraRight}
        </div>
        ${e.quote ? `<div class="evq">“${e.quote}”</div>` : ""}
        <div class="evm">${e.t} · ${e.by} · ${I(e.surf === "watch" ? "watch" : "phone", 11)} ${subExtra}</div>
      </div>
    </div>`;

  // Circular gauge for wake window / circadian rhythm
  KIT.radialGauge = ({ val = 75, max = 100, label = "75m", sub = "Sweet spot", color = "var(--acc)", size = 120 } = {}) => {
    const r = (size - 16) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(val, max) / max) * c;
    return `<div class="rad-gauge" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--sep)" stroke-width="8" fill="none" opacity="0.4"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="8" fill="none"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
          transform="rotate(-90 ${size/2} ${size/2})"/>
      </svg>
      <div class="rg-center"><b>${label}</b><small>${sub}</small></div>
    </div>`;
  };

  // Lock Screen wrapper
  KIT.lockScreen = (content, { time = "3:12", date = "Tuesday, October 20" } = {}) => `
    <div class="lockscr">
      <div class="ltime"><b>${time}</b><small>${date}</small></div>
      ${content}
    </div>`;
})();
