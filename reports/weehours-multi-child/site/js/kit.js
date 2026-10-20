// Shared building blocks for the Wee Hours multi-child mocks: sample data, icons and the app's real
// components (status card, tiles, tab bar, voice button), recreated from projects/weehours/apps/ios/App.
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
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
  };
  const I = (KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`);

  KIT.statusBar = () => `<div class="sb"><b>3:12</b><span>●●● ▮</span></div>`;
  KIT.homeBar = () => `<div class="hb"></div>`;

  // Sample household: twins at 3 weeks (the hardest case: same age, simultaneous feeds, two parents
  // logging at once). Fields are the app's own: babies.name / birth_date, the status line from
  // StatusSnapshot.line(now:), duty from the household. Per-child colour is new (facts.Needs).
  KIT.kids = [
    { id: "mia", name: "Mia", age: "3 weeks", color: "#E07FA6", side: "left",
      status: "Fed 1h20m ago · left next · diaper 40m ago", short: "Fed 1h20m ago", diaper: "40m ago", sleeping: false },
    { id: "leo", name: "Leo", age: "3 weeks", color: "#3FA58F", side: "right",
      status: "Sleeping 35m · right next · diaper 1h05m ago", short: "Sleeping 35m", diaper: "1h05m ago", sleeping: true },
  ];
  KIT.third = { id: "ava", name: "Ava", age: "2 years", color: "#6C8BE0", status: "diaper 2h ago", short: "Diaper 2h ago", diaper: "2h ago" };
  const [mia, leo] = KIT.kids;
  KIT.kid = (id) => [...KIT.kids, KIT.third].find((k) => k.id === id);

  KIT.dot = (k, size = 10) => `<i class="kdot" style="--k:${k.color};width:${size}px;height:${size}px"></i>`;
  KIT.chip = (k) => `<span class="kchip" style="--k:${k.color}">${k.name}</span>`;

  // Large-title navigation bar (HomeView: .navigationTitle(babyName) + age on the trailing side).
  KIT.nav = (title, right = "") => `<div class="nav"><div class="navr">${right}</div><h1>${title}</h1></div>`;
  KIT.pill = (t) => `<span class="pillr">${t}</span>`;

  // StatusCard: the one-line status + duty row.
  KIT.duty = () => `<div class="duty">${I("people", 15)}<span>Nobody on duty · reminders go to everyone</span><b>I've got it</b></div>`;
  KIT.statusCard = (line, duty = true) => `<div class="card status"><p class="line">${line}</p>${duty ? KIT.duty() : ""}</div>`;

  // Tile (Tile / ActionTile in HomeView.swift): icon, title, subtitle on a 14% tint of the category colour.
  KIT.tile = (title, sub, icon, cls, extra = "") =>
    `<div class="tile ${cls}" data-tile><span class="ti">${I(icon, 26)}</span><b>${title}</b><small>${sub}</small>${extra}</div>`;

  // Today's quick actions for one child (bottle + breast + diaper + sleep + pumping + growth enabled).
  KIT.tilesFor = (k) => [
    KIT.tile("Start bottle", "120 ml", "bottle", "feed"),
    KIT.tile("Start nursing", `${k.side} side`, "heart", "feed"),
    KIT.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
    k.sleeping ? KIT.tile("Woke up", "end sleep", "sun", "sleep") : KIT.tile("Fell asleep", "start sleep", "moon", "sleep"),
    KIT.tile("Pumped", "both sides", "pump", "other"),
    KIT.tile("Weight", "4.10 kg", "scale", "growth"),
    KIT.tile("Height", "52.0 cm", "ruler", "growth"),
    KIT.tile("Head size", "tap to log", "head", "growth"),
  ];
  KIT.grid = (tiles) => `<div class="grid">${tiles.join("")}</div>`;

  KIT.tabBar = (on = "now") => `<div class="tabs">
    <span class="${on === "now" ? "on" : ""}">${I("stars", 22)}<small>Now</small></span>
    <span class="${on === "timeline" ? "on" : ""}">${I("list", 22)}<small>Timeline</small></span>
    <span class="${on === "settings" ? "on" : ""}">${I("gear", 22)}<small>Settings</small></span></div>`;
  KIT.fab = (hint = "") => `<div class="fab">${hint ? `<span class="fabhint">${hint}</span>` : ""}<i>${I("mic", 26, 2.2)}</i></div>`;

  // A phone screen: status bar, scrolling body, floating mic + tab bar pinned at the bottom.
  KIT.phone = (body, { tab = "now", fab = true, hint = "", overlay = "" } = {}) =>
    `${KIT.statusBar()}<div class="body">${body}</div>${overlay}<div class="dock">${fab ? KIT.fab(hint) : ""}${KIT.tabBar(tab)}</div>`;

  // Timeline rows (TimelineView): time, icon, label, who logged it; `chips` adds the child.
  KIT.events = [
    { t: "3:05 PM", kid: "mia", icon: "drop", cls: "diaper", label: "Diaper · wet", by: "Sam · phone" },
    { t: "2:37 PM", kid: "leo", icon: "moon", cls: "sleep", label: "Fell asleep", by: "Alex · voice" },
    { t: "2:10 PM", kid: "leo", icon: "drop", cls: "diaper", label: "Diaper · dirty", by: "Alex · ring" },
    { t: "1:52 PM", kid: "mia", icon: "bottle", cls: "feed", label: "Bottle · 90 ml", by: "Sam · phone", both: "b1" },
    { t: "1:52 PM", kid: "leo", icon: "bottle", cls: "feed", label: "Bottle · 110 ml", by: "Alex · watch", both: "b1" },
    { t: "12:40 PM", kid: "mia", icon: "scale", cls: "growth", label: "Weight · 4.10 kg", by: "Sam · phone" },
  ];
  KIT.timeline = ({ only = null, chips = true, filter = "" } = {}) => {
    const rows = KIT.events.filter((e) => !only || e.kid === only).map((e) => {
      const k = KIT.kid(e.kid);
      return `<div class="ev"><span class="evi ${e.cls}">${I(e.icon, 16)}</span><div><b>${e.label}</b><small>${e.t} · ${e.by}</small></div>${chips ? KIT.chip(k) : ""}</div>`;
    }).join("");
    return `${KIT.nav("Timeline")}${filter}<div class="day">Today</div><div class="card evs">${rows}</div>`;
  };

  // iOS action sheet / confirmation dialog.
  KIT.sheet = (title, buttons, cancel = "Cancel") => `<div class="scrim"></div><div class="asheet"><div class="ag"><p>${title}</p>${buttons.map((b) => `<div class="ab">${b}</div>`).join("")}</div><div class="ag cancel"><div class="ab"><b>${cancel}</b></div></div></div>`;

  // Undo toast (the bar above the tab bar after logging).
  KIT.toast = (text, undo = "Undo") => `<div class="toastm"><span class="ok">${I("check", 14, 3)}</span><span>${text}</span><b>${undo}</b></div>`;

  KIT.mia = mia;
  KIT.leo = leo;
})();
