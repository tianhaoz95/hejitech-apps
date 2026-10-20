// Wee Hours · multiple children: how the Now screen (and logging) works with two or more children.
// Sample household: twins Mia and Leo, 3 weeks old, two parents (Sam, Alex). kit.js has the data.
(() => {
  const K = KIT;
  const I = K.icon;
  const { mia, leo } = K;
  const ava = K.third;

  // A per-child status row (compact status card used by several candidates).
  const kidRow = (k, { tap = false, active = false } = {}) =>
    `<div class="krow${active ? " on" : ""}" style="--k:${k.color}">${K.dot(k, 12)}<div><b>${k.name}</b><small>${k.status}</small></div>${tap ? I("chevron", 16) : ""}</div>`;

  const timelineFilter = (on = "all") =>
    `<div class="seg2">${["All", "Mia", "Leo"].map((n) => `<span class="${n.toLowerCase() === on ? "on" : ""}">${n}</span>`).join("")}</div>`;

  // ── 1 · Switcher
  const switcherNow = (k = mia, other = leo, menu = false) => K.phone(
    `${K.nav(`<span class="tsw">${K.dot(k, 14)}${k.name}${I("down", 22, 2.6)}</span>`, K.pill(k.age))}
     ${K.statusCard(k.status)}
     <div class="peek" style="--k:${other.color}">${K.dot(other)}<span><b>${other.name}</b> · ${other.short}</span><em>Switch</em></div>
     ${K.grid(K.tilesFor(k))}`,
    { overlay: menu ? `<div class="scrim light"></div><div class="menu">
        <div class="mi on">${K.dot(mia, 12)}<b>Mia</b><small>Fed 1h20m ago</small>${I("check", 16, 2.6)}</div>
        <div class="mi">${K.dot(leo, 12)}<b>Leo</b><small>Sleeping 35m</small></div>
        <div class="mi add">${I("plus", 16)}<b>Add a child</b></div></div>` : "" });

  // ── 2 · Ask each time
  const askNow = (sheet = false) => K.phone(
    `${K.nav("Mia &amp; Leo", K.pill("3 weeks"))}
     <div class="card status two">${kidRow(mia)}${kidRow(leo)}${K.duty()}</div>
     ${K.grid([
       K.tile("Start bottle", "120 ml", "bottle", "feed"),
       K.tile("Start nursing", "Mia left · Leo right", "heart", "feed"),
       K.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
       K.tile("Sleep", "Leo asleep 35m", "moon", "sleep"),
       K.tile("Pumped", "both sides", "pump", "other"),
       K.tile("Weight", "Mia 4.10 · Leo 3.85 kg", "scale", "growth"),
     ])}`,
    { overlay: sheet ? K.sheet("Diaper for…", [`${K.dot(mia, 12)} Mia`, `${K.dot(leo, 12)} Leo`, "<b>Both</b>"]) : "" });

  // ── 3 · Log-for bar (recommended)
  const target = (on) => `<div class="for"><small>Log for</small><div class="seg3">${[mia, leo].map((k) =>
      `<span class="${on === k.id ? "on" : ""}" style="--k:${k.color}">${K.dot(k)}${k.name}</span>`).join("")}<span class="${on === "both" ? "on both" : ""}">Both</span></div></div>`;
  const forNow = (on = "mia", toast = "") => {
    const k = on === "leo" ? leo : mia;
    const tiles = on === "both" ? [
      K.tile("Start bottles", "Mia 90 · Leo 110 ml", "bottle", "feed"),
      K.tile("Start nursing", "tandem · Mia left", "heart", "feed"),
      K.tile("Diapers", "wet · dirty · both", "drop", "diaper"),
      K.tile("Fell asleep", "Mia · Leo already asleep", "moon", "sleep"),
    ] : K.tilesFor(k);
    return K.phone(
      `${K.nav("Mia &amp; Leo", K.pill("3 weeks"))}
       <div class="pair">${[mia, leo].map((x) => `<div class="mini${on === x.id || on === "both" ? " on" : ""}" style="--k:${x.color}"><div class="mh">${K.dot(x)}<b>${x.name}</b></div><p>${x.short}</p><small>${x.id === "mia" ? "left next · diaper 40m" : "right next · diaper 1h05m"}</small></div>`).join("")}</div>
       ${K.duty().replace('class="duty"', 'class="duty solo"')}
       ${target(on)}
       ${K.grid(tiles)}`,
      { hint: on === "both" ? "" : "", overlay: toast });
  };

  // ── 4 · Pages
  const pageNow = (k = mia) => {
    const i = k.id === "mia" ? 0 : 1;
    return K.phone(
      `<div class="pghead" style="--k:${k.color}">${K.nav(k.name, K.pill(k.age))}<div class="dots"><i class="${i ? "" : "on"}"></i><i class="${i ? "on" : ""}"></i><i class="add">+</i></div></div>
       <div class="pgbody" style="--k:${k.color}">${K.statusCard(k.status)}${K.grid(K.tilesFor(k))}</div>
       <div class="edge" style="--k:${(i ? mia : leo).color}">${i ? "‹ Mia" : "Leo ›"}</div>`);
  };

  // ── 5 · Split tiles
  const half = (k, text) => `<span class="h" style="--k:${k.color}"><b>${k.name}</b><small>${text}</small></span>`;
  const stile = (title, icon, cls, a, b, c) =>
    `<div class="stile ${cls}" data-tile><div class="st">${I(icon, 20)}<b>${title}</b></div><div class="halves">${half(mia, a)}${half(leo, b)}${c ? half(ava, c) : ""}</div></div>`;
  const splitNow = (three = false) => K.phone(
    `${K.nav(three ? "Mia, Leo &amp; Ava" : "Mia &amp; Leo")}
     <div class="card status two">${kidRow(mia)}${kidRow(leo)}${three ? kidRow(ava) : ""}${K.duty()}</div>
     <div class="slist">
       ${stile("Bottle", "bottle", "feed", "start · 120 ml", "start · 120 ml", three ? "—" : "")}
       ${stile("Nursing", "heart", "feed", "left next", "right next", three ? "—" : "")}
       ${stile("Diaper", "drop", "diaper", "40m ago", "1h05m ago", three ? "2h ago" : "")}
       ${stile("Sleep", "moon", "sleep", "fell asleep", "woke up", three ? "nap" : "")}
       ${stile("Growth", "scale", "growth", "4.10 kg", "3.85 kg", three ? "12.4 kg" : "")}
     </div>
     <p class="hintline">Tap a name to log for that child · long-press the tile to log for both</p>`);

  window.REVIEW = {
    key: "weehours-multi-child-v1",
    dir: "reports/weehours-multi-child",
    title: "Wee Hours · Multiple children",
    subtitle: "5 directions + today's screen · twins Mia & Leo",
    heading: "How should Now work with more than one child?",
    intro: `Five ways to show and log for several children, mocked with twins (the hardest case: same age, fed at the same time, two parents logging at once). Every direction sits on the same data change, described on the <a href="architecture.html"><b>Architecture</b></a> page, which also lists the decisions I need from you. I recommend <b>03 · Log-for bar</b>. Heart, rate and annotate, crown a winner, then <b>Copy summary</b> and paste it back.`,
    legend: ["<b>2</b> children (twins, 3 weeks)", "<b>2</b> parents", "<a href='architecture.html'>Architecture &amp; decisions →</a>"],
    round: 1,
    frame: "phone",
    candidates: [
      {
        id: "current", n: 0, name: "Today: one child", baseline: true,
        tagline: "Today's Now tab, for comparison",
        render: () => K.phone(`${K.nav("Mia", K.pill("3 weeks"))}${K.statusCard(mia.status)}${K.grid(K.tilesFor(mia))}`),
      },
      {
        id: "switcher", n: 1, name: "Switcher", round: 1,
        tagline: "One child at a time; the title is a menu",
        concept: "The screen stays exactly as today, for whichever child is selected. Tap the name to switch. A one-line peek shows the other child so they aren't out of sight. Smallest change and scales to any number of children, but with twins you switch constantly and it's easy to log for the wrong one.",
        moves: ["Title becomes a child menu (with “Add a child”)", "One-line peek of the other child under the status card", "Timeline gets an All / per-child filter", "Voice uses the name if said, otherwise the selected child"],
        facts: { Best: "Siblings of different ages", Risk: "Wrong-child logs for twins", Effort: "M", Needs: "Selected child (per phone)" },
        render: () => switcherNow(),
        views: [
          { name: "Now · Mia", render: () => switcherNow() },
          { name: "Tap the title", render: () => switcherNow(mia, leo, true) },
          { name: "Timeline", render: () => K.phone(K.timeline({ only: "mia", chips: false, filter: timelineFilter("mia") }), { tab: "timeline" }) },
        ],
      },
      {
        id: "ask", n: 2, name: "Ask each time", round: 1,
        tagline: "Both children on one screen; every tap asks who",
        concept: "The status card shows every child; tiles are shared and each tap asks “for Mia, Leo or both?”. Never logs for the wrong child, but every single entry costs an extra tap, at 3 a.m., which works against the app's one-tap promise.",
        moves: ["Status card lists each child", "Tiles summarise both (“Mia left · Leo right”)", "Every tap opens a who-sheet with Both", "Timeline shows a name chip on each row"],
        facts: { Best: "Twins, careful loggers", Risk: "+1 tap on every entry", Effort: "M", Needs: "Nothing beyond the shared data change" },
        render: () => askNow(),
        views: [
          { name: "Now", render: () => askNow() },
          { name: "Tap Diaper", render: () => askNow(true) },
          { name: "Timeline", render: () => K.phone(K.timeline({ filter: timelineFilter("all") }), { tab: "timeline" }) },
        ],
      },
      {
        id: "logfor", n: 3, name: "Log-for bar", round: 1,
        tagline: "See everyone; a sticky “Log for” picks the target",
        concept: "Both children's status sits side by side at the top. A “Log for Mia | Leo | Both” bar above the tiles picks who the tiles log for, and it stays where you left it, so a run of entries for one child is still one tap each. “Both” turns tiles into twin actions (two bottles, two diapers). Recommended: it keeps one-tap logging, never hides a child, and handles twins and siblings alike.",
        moves: ["Two compact status cards (highlighted = current target)", "Sticky Log-for bar: child, other child, Both", "Tiles follow the target (side, last weight, bottle size per child)", "“Both” logs one event per child, undone together", "Voice: names win; no name → the bar's target"],
        facts: { Best: "Twins and siblings", Risk: "Bar must stay obvious so it isn't forgotten", Effort: "M", Needs: "Selected target (per phone), per-child bottle size" },
        render: () => forNow("mia"),
        views: [
          { name: "Log for Mia", render: () => forNow("mia") },
          { name: "Log for Both", render: () => forNow("both", K.toast("Diaper · wet · Mia + Leo", "Undo both")) },
          { name: "Timeline", render: () => K.phone(K.timeline({ filter: timelineFilter("all") }), { tab: "timeline" }) },
        ],
      },
      {
        id: "pages", n: 4, name: "Pages", round: 1,
        tagline: "Swipe between children, each in their own colour",
        concept: "Each child gets a full page in their own colour; swipe sideways to switch, with page dots and the next child's name peeking at the edge. Colour makes it very clear whose page you're on, but the other child's status is a swipe away, and there's no “both”.",
        moves: ["Horizontal pages, one per child", "Child colour tints the header and status card", "Edge label for the next child", "Colour carries into Timeline, widgets and Live Activities"],
        facts: { Best: "Siblings; parents who like colour coding", Risk: "Other child hidden; no Both", Effort: "M", Needs: "Child colour" },
        render: () => pageNow(mia),
        views: [
          { name: "Mia's page", render: () => pageNow(mia) },
          { name: "Swipe → Leo", render: () => pageNow(leo) },
          { name: "Timeline", render: () => K.phone(K.timeline({ filter: timelineFilter("all") }), { tab: "timeline" }) },
        ],
      },
      {
        id: "split", n: 5, name: "Split tiles", round: 1,
        tagline: "Every tile has a half per child",
        concept: "Each action row is split into one target per child, with that child's latest value in it: tap Leo's half of Diaper to log Leo's diaper. Zero mode, one tap, and you see both children per category. It gets cramped with three children, and the tiles lose their big, sleepy-thumb-friendly size.",
        moves: ["Action rows split per child, latest value inside", "Long-press a row = both", "Status card lists each child", "Three children → three narrow targets"],
        facts: { Best: "Twins", Risk: "Small targets; 3+ children cramped", Effort: "M–L", Needs: "Child colour" },
        render: () => splitNow(),
        views: [
          { name: "Two children", render: () => splitNow() },
          { name: "Three children", render: () => splitNow(true) },
          { name: "Timeline", render: () => K.phone(K.timeline({ filter: timelineFilter("all") }), { tab: "timeline" }) },
        ],
      },
    ],
  };
})();
