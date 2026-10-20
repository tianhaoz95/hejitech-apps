// The ten candidates (+ the current screen as a baseline). Each render() returns the inner HTML of a
// 390×844 iPhone screen; styling lives in css/designs.css under `.scr.<id>`.
window.WP = window.WP || {};

(() => {
  const { icon: I, scene: S, range, when, daysUntil, crew, crewIcons, size, ring, statusLabel, origin, nights } = WP;
  const U = () => WP.upcoming, PAST = () => WP.past;
  const next = () => WP.upcoming[0];
  const rest = () => WP.upcoming.slice(1);
  const tr = (t, cls, body) => `<div class="${cls}" data-trip="${t.id}">${body}</div>`;

  // Status affordance in three flavours, reused with design-specific classes.
  const action = (t, { ringSize = 30, btn = "Get" } = {}) => {
    switch (t.status) {
      case "ready": return `<span class="st st-ready" title="Ready offline">${I("check", 14, 2.6)}</span>`;
      case "update": return `<span class="st st-update">${I("update", 13, 2.4)}<span>Update</span></span>`;
      case "downloading": return `<span class="st st-dl">${ring(t.progress, ringSize, 3)}</span>`;
      case "cloud": return `<span class="st st-get">${btn}</span>`;
    }
  };
  const badgeOrigin = (t) => (t.sharedBy ? `<span class="org">${I("users", 11, 2.2)}${origin(t)}</span>` : t.nearby ? `<span class="org">${I("phone", 11, 2.2)}Nearby</span>` : "");
  const bm = (t) => (t.bookmarked ? `<span class="bm">${I("bookmark", 13, 2.4)}</span>` : "");

  const designs = [];
  const add = (d) => designs.push(d);

  // ───────────────────────────────────────── 0 · current (baseline)
  add({
    id: "current", n: 0, name: "Current app", baseline: true,
    tagline: "Today's TripsScreen, for comparison",
    concept: "Material 3 with a blue seed colour. Every trip is a full card: 140pt cover, titleLarge heading, a status chip and a row of 48pt buttons. It reads clearly but is ~300pt per trip, so a phone shows about one and a half trips.",
    palette: [["Seed blue", "#1D6FE0"], ["Surface", "#F8F9FF"], ["Card", "#FFFFFF"], ["Ink", "#1A1C20"]],
    type: "Roboto-ish system default · titleLarge 22",
    moves: [], needs: [], effort: "—",
    render: () => `
      <div class="appbar"><span>Trips</span><span class="acts">${I("scan", 22)}${I("settings", 22)}</span></div>
      <div class="pad">
        <div class="h">Upcoming</div>
        ${U().map((t) => tr(t, "card", `
          ${t.status === "ready" || t.status === "update" ? `<div class="cov">${S(t)}</div>` : `<div class="band" style="background:${t.accent}"></div>`}
          <div class="in">
            <div class="ttl">${t.title}${t.bookmarked ? `<span class="bmk" style="color:${t.accent}">${I("bookmark", 22)}</span>` : ""}</div>
            <div class="sub">${range(t, true)} · ${size(t.bytes)}</div>
            ${t.sharedBy ? `<div class="sh">${I("users", 15)} Shared with you by ${t.sharedBy}</div>` : ""}
            <div class="chip k-${t.status}">${{ ready: I("checkCircle", 18), update: I("update", 18), downloading: "", cloud: I("cloud", 18) }[t.status]}${t.status === "downloading" ? `${t.stage} · ${Math.round(t.progress * 100)}%` : statusLabel(t).replace("Update ready", "Update available").replace("Ready offline", "Available offline")}</div>
            ${t.status === "downloading" ? `<div class="bar"><i style="width:${t.progress * 100}%"></i></div>` : ""}
            <div class="btns">
              ${t.status === "ready" || t.status === "update" ? `<span class="fb">${I("open", 18)} Open</span>` : ""}
              ${t.status === "update" ? `<span class="ob">${I("update", 18)} Update</span>` : ""}
              ${t.status === "cloud" ? `<span class="fb">${I("download", 18)} Download</span>` : ""}
              <span class="ib">${I("share", 22)}</span>
            </div>
          </div>`)).join("")}
        <div class="h">Past</div>
        ${PAST().map((t) => tr(t, "card", `<div class="cov">${S(t)}</div><div class="in"><div class="ttl">${t.title}</div><div class="sub">${range(t, true)} · ${size(t.bytes)}</div><div class="chip k-ready">${I("checkCircle", 18)}Available offline</div><div class="btns"><span class="fb">${I("open", 18)} Open</span><span class="ib">${I("share", 22)}</span></div></div>`)).join("")}
      </div>`,
  });

  // ───────────────────────────────────────── 1 · Hearth
  add({
    id: "hearth", n: 1, name: "Hearth",
    tagline: "Cream & terracotta, one warm hero, then tidy rows",
    concept: "A home-screen that feels like the family kitchen calendar. The next trip gets a single compact hero with a kid-friendly “sleeps to go” countdown; everything else collapses to 64pt rows with a scene thumbnail. Past trips become a horizontal strip of memories.",
    palette: [["Cream", "#FBF5EC"], ["Terracotta", "#C8603A"], ["Sunflower", "#F2B544"], ["Sage", "#6E8B5E"], ["Cocoa ink", "#3A2A22"]],
    type: "Nunito 800 titles · Nunito 600 body",
    moves: ["Hero 172pt for the next trip only", "64pt rows (was ~300pt cards)", "Status is an icon pill, actions move to swipe + long-press", "“Sleeps to go” countdown for kids"],
    needs: ["travelers from manifest (for the crew line)"], effort: "M",
    render: () => {
      const n = next();
      return `
      <div class="top"><div><div class="hi">Good morning, ${WP.family} family</div><div class="big">Our trips</div></div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      ${tr(n, "hero", `${S(n)}<div class="shade"></div>
        <div class="sleeps"><b>${daysUntil(n)}</b> sleeps to go</div>
        <div class="hero-txt"><div class="t">${n.title}</div><div class="s">${range(n)} · ${crew(n)}</div></div>
        <div class="hero-act"><span class="pill">${I("sun", 14)} Today plan</span><span class="pill solid">Open ${I("chevron", 14, 2.6)}</span></div>`)}
      <div class="sec">Coming up</div>
      <div class="list">${rest().map((t) => tr(t, "row", `<div class="th">${S(t)}</div><div class="mid"><div class="t">${t.title}</div><div class="s">${range(t)} · ${when(t)}</div>${badgeOrigin(t)}</div>${action(t)}`)).join("")}</div>
      <div class="sec">Memories <span class="cnt">${PAST().length}</span></div>
      <div class="strip">${PAST().map((t) => tr(t, "mem", `${S(t)}<div class="cap"><b>${t.title}</b><span>${WP.mon(t.start)} ${WP.year(t.start)}</span></div>`)).join("")}</div>
      <div class="foot">Synced ${WP.syncedAgo} · all trips work offline</div>`;
    },
  });

  // ───────────────────────────────────────── 2 · Scrapbook
  add({
    id: "scrap", n: 2, name: "Scrapbook",
    tagline: "Polaroids, washi tape and handwriting on kraft paper",
    concept: "The fridge-door photo wall. Trips are small polaroids in a two-column grid, taped on with washi strips, with handwritten captions. Playful enough for kids to love, and two-up polaroids are far denser than full-width cards.",
    palette: [["Kraft", "#F3EADB"], ["Paper", "#FFFDF8"], ["Washi coral", "#F2A28B"], ["Washi mint", "#A9D3C0"], ["Pencil", "#4A3F35"]],
    type: "Caveat (handwritten) for titles · Inter 500 meta",
    moves: ["2-up polaroid grid", "Status as a tiny stamp in the photo corner", "Past trips as a 3-up smaller grid", "Handwriting only for titles — meta stays legible"],
    needs: ["A bundled handwritten font (Caveat, OFL)"], effort: "M",
    render: () => `
      <div class="top"><div><div class="big">Family trips</div><div class="sub">${U().length} coming up · ${PAST().length} remembered</div></div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="grid2">${U().map((t, i) => tr(t, `pol r${i % 4}`, `<i class="tape t${i % 3}"></i><div class="ph">${S(t)}${action(t, { ringSize: 26 })}${bm(t)}</div><div class="cap">${t.title}</div><div class="meta">${range(t)}${t.sharedBy ? " · shared" : ""}</div>`)).join("")}</div>
      <div class="sec">Remember when…</div>
      <div class="grid3">${PAST().map((t, i) => tr(t, `pol sm r${(i + 1) % 4}`, `<div class="ph">${S(t)}</div><div class="cap">${t.title.split(" ").slice(0, 2).join(" ")}</div><div class="meta">${WP.mon(t.start)} ’${String(WP.year(t.start)).slice(2)}</div>`)).join("")}</div>
      <div class="foot">synced ${WP.syncedAgo}</div>`,
  });

  // ───────────────────────────────────────── 3 · Campfire
  add({
    id: "campfire", n: 3, name: "Campfire", prefers: "dark",
    tagline: "Ember glow on a cosy dusk palette (dark-first)",
    concept: "Evening-by-the-fire mood: deep cocoa background with ember-orange glows, made for the way families actually check trips — on the couch at night. A big countdown numeral anchors the next trip; the rest are hairline-separated rows. Light mode becomes a golden-hour sand.",
    palette: [["Dusk", "#1F1714"], ["Ember", "#F08A3C"], ["Glow", "#FFC56B"], ["Ash", "#A8968A"], ["Golden sand (light)", "#FBF1E4"]],
    type: "Nunito 800 numerals · Inter 500 body",
    moves: ["Countdown numeral as the focal point", "52pt hairline rows", "Dark-first palette, warm light variant", "Status as glowing dots"],
    needs: [], effort: "S",
    render: () => {
      const n = next();
      return `
      <div class="glow"></div>
      <div class="top"><div class="big">${I("flame", 22)} Trips</div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      ${tr(n, "hero", `<div class="num"><b>${daysUntil(n)}</b><span>days</span></div><div class="mid"><div class="k">Next adventure</div><div class="t">${n.title}</div><div class="s">${range(n)} · ${crewIcons(n)}</div></div><div class="th">${S(n)}</div>`)}
      <div class="chips"><span class="c on">${I("sun", 13)} Today plan</span><span class="c">${I("map", 13)} Map</span><span class="c">${I("sparkle", 13)} Ask</span><span class="c">${I("share", 13)} Share</span></div>
      <div class="sec">Upcoming</div>
      ${rest().map((t) => tr(t, "row", `<span class="dot" style="--a:${t.accent}"></span><div class="mid"><div class="t">${t.title}</div><div class="s">${range(t)}${t.sharedBy ? " · shared by Aunt May" : ""}</div></div>${action(t, { ringSize: 26 })}`)).join("")}
      <div class="sec">Around the fire before</div>
      ${PAST().map((t) => tr(t, "row past", `<span class="dot" style="--a:${t.accent}"></span><div class="mid"><div class="t">${t.title}</div><div class="s">${range(t, true)}${t.nearby ? " · from a nearby phone" : ""}</div></div><span class="chev">${I("chevron", 16)}</span>`)).join("")}
      <div class="foot">Synced ${WP.syncedAgo}</div>`;
    },
  });

  // ───────────────────────────────────────── 4 · Postcards
  add({
    id: "postcard", n: 4, name: "Postcards",
    tagline: "Each trip is a postcard with a stamp that counts down",
    concept: "Trips as postcards you'd send grandma: illustrated left half, handwritten-feel right half, and a perforated stamp in the corner that shows the countdown (or a tick once it's offline). Postcards are short (104pt) and past trips stack as a fanned pile.",
    palette: [["Linen", "#F4ECE1"], ["Card", "#FFFCF6"], ["Postal red", "#C8473A"], ["Airmail blue", "#3A6EA5"], ["Ink", "#2F2A26"]],
    type: "Fraunces italic titles · Inter 500 meta",
    moves: ["104pt postcard rows", "Stamp = countdown / offline state", "Airmail stripe marks shared trips", "Past trips collapse into a fanned stack"],
    needs: ["Fraunces font (OFL)"], effort: "M",
    render: () => `
      <div class="top"><div class="big">Trips</div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="sub">Wish you were here — ${U().length} trips on the way</div>
      ${U().map((t) => tr(t, `pc${t.sharedBy ? " air" : ""}`, `<div class="img">${S(t)}</div><div class="txt"><div class="t">${t.title}</div><div class="s">${range(t)}</div><div class="s2">${crewIcons(t, 12)}${t.sharedBy ? `<em>from Aunt May</em>` : ""}</div><div class="foot-act">${t.status === "cloud" ? `<span class="get">${I("download", 12, 2.4)} Download</span>` : t.status === "update" ? `<span class="get alt">${I("update", 12, 2.4)} Update</span>` : t.status === "downloading" ? `<span class="prog"><i style="width:${t.progress * 100}%"></i></span><span class="pct">${Math.round(t.progress * 100)}%</span>` : `<span class="ok">${I("check", 12, 2.6)} Offline</span>`}</div></div>
        <div class="stamp">${t.status === "ready" || daysUntil(t) < 60 ? `<b>${daysUntil(t)}</b><span>days</span>` : `<b>${WP.mon(t.start)}</b><span>${WP.year(t.start)}</span>`}</div>`)).join("")}
      <div class="sec">Postcards from before</div>
      <div class="stack">${PAST().map((t, i) => tr(t, `mini m${i}`, `<div class="img">${S(t)}</div><div class="t">${t.title}</div><div class="s">${WP.mon(t.start)} ${WP.year(t.start)}</div>`)).join("")}</div>
      <div class="foot">Synced ${WP.syncedAgo}</div>`,
  });

  // ───────────────────────────────────────── 5 · Timeline
  add({
    id: "timeline", n: 5, name: "Family Timeline",
    tagline: "One warm thread from today forward, memories below",
    concept: "Trips hang off a single timeline that starts at “Today”. Month labels give a sense of the family's year at a glance, and gaps between trips are visible. Past trips continue below a “Looking back” marker so the screen tells the family's story.",
    palette: [["Oat", "#FFF8EF"], ["Thread", "#E7CDB4"], ["Coral", "#E2725B"], ["Honey", "#E9A23B"], ["Bark", "#43352B"]],
    type: "Inter 700 titles · Inter 600 small-caps months",
    moves: ["Month-grouped timeline", "72pt entries with right-side thumbnail", "Today marker with the date", "Segmented control instead of two long sections"],
    needs: [], effort: "M",
    render: () => {
      let lastM = "";
      const entry = (t) => {
        const m = `${WP.mon(t.start)} ${WP.year(t.start)}`;
        const lab = m !== lastM ? `<div class="mon">${m}</div>` : ""; lastM = m;
        return `${lab}${tr(t, "ent", `<span class="node" style="--a:${t.accent}"></span><div class="card"><div class="mid"><div class="t">${t.title}${bm(t)}</div><div class="s">${range(t)} · ${nights(t)} nights · ${crewIcons(t, 12)}</div><div class="s3">${t.past ? (t.nearby ? "From a nearby phone" : "Ready offline") : t.sharedBy ? `Shared by Aunt May · ${statusLabel(t)}` : statusLabel(t)}</div></div><div class="th">${S(t)}${t.past ? "" : action(t, { ringSize: 24 })}</div></div>`)}`;
      };
      return `
      <div class="top"><div class="big">Trips</div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="seg"><span class="on">Ahead · ${U().length}</span><span>Memories · ${PAST().length}</span><span>Saved · 1</span></div>
      <div class="line">
        <div class="today"><span class="pin"></span><b>Today</b> · Thu, Oct 8 — ${daysUntil(next())} days until ${next().title.split(" ")[0]}</div>
        ${U().map(entry).join("")}
        <div class="back"><span class="pin"></span>Looking back</div>
        ${(lastM = "", PAST().map(entry).join(""))}
      </div>
      <div class="foot">Synced ${WP.syncedAgo}</div>`;
    },
  });

  // ───────────────────────────────────────── 6 · Sunday Morning
  add({
    id: "sunday", n: 6, name: "Sunday Morning",
    tagline: "Native iOS grouped list, warmed up — the densest option",
    concept: "Feels exactly like an Apple app (large title, inset grouped list, App Store-style “GET” capsule) but tinted with oat and apricot. 58pt rows fit every trip on one screen. Warmth comes from the scene icons, the family line under the title and gentle colour — not from size.",
    palette: [["Oat", "#F6F0E8"], ["Row", "#FFFFFF"], ["Apricot", "#E7804B"], ["Moss", "#5F8A5A"], ["Label", "#1F1A17"]],
    type: "SF Pro (system) · Large Title 34 · Body 16",
    moves: ["58pt inset-grouped rows", "App Store-style capsule for Download/Update", "Search field for big trip libraries", "Everything above the fold"],
    needs: [], effort: "S",
    render: () => `
      <div class="nav"><span class="acts">${I("scan", 21)}${I("settings", 21)}</span></div>
      <div class="big">Trips</div>
      <div class="fam">${I("heart", 13, 2.4)} The ${WP.family} family · ${WP.trips.length} trips together</div>
      <div class="search">${I("search", 15)} Search trips</div>
      <div class="gh">Upcoming</div>
      <div class="grp">${U().map((t) => tr(t, "row", `<div class="th">${S(t)}</div><div class="mid"><div class="t">${t.title}</div><div class="s">${range(t)} · ${when(t)}${t.sharedBy ? ` · ${I("users", 11, 2.4)}` : ""}</div></div>${action(t, { ringSize: 26, btn: "GET" })}`)).join("")}</div>
      <div class="gh">Past</div>
      <div class="grp">${PAST().map((t) => tr(t, "row", `<div class="th">${S(t)}</div><div class="mid"><div class="t">${t.title}</div><div class="s">${range(t, true)}${t.nearby ? ` · ${I("phone", 11, 2.4)} Nearby` : ""}</div></div><span class="chev">${I("chevron", 16, 2.4)}</span>`)).join("")}</div>
      <div class="foot">Updated ${WP.syncedAgo}</div>`,
  });

  // ───────────────────────────────────────── 7 · Shelf
  add({
    id: "shelf", n: 7, name: "Adventure Shelf",
    tagline: "Swipeable upcoming carousel + a memories photo wall",
    concept: "Upcoming trips sit on a horizontal shelf of compact cards (you see 1.6 at once, inviting a swipe), with a clear primary action on each. Below, past trips become a 3-column photo wall titled “Our memories”, the part of the app kids will want to scroll.",
    palette: [["Peach milk", "#FFF4EA"], ["Tangerine", "#F07B3F"], ["Plum", "#6B3E5E"], ["Butter", "#FFE3A3"], ["Ink", "#2A211C"]],
    type: "Nunito 800 headings · Nunito 600 body",
    moves: ["Carousel cards 230×196pt", "3-up memories wall", "Primary action pill on each card", "Shared-with-you surfaced on the card"],
    needs: [], effort: "M",
    render: () => `
      <div class="top"><div><div class="hi">Hi ${WP.family}s</div><div class="big">Where to next?</div></div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="sec">Coming up <span>${U().length}</span></div>
      <div class="car">${U().map((t) => tr(t, "cc", `<div class="img">${S(t)}<span class="when">${when(t)}</span>${bm(t)}</div><div class="t">${t.title}</div><div class="s">${range(t)} · ${crewIcons(t, 12)}</div>${badgeOrigin(t)}<div class="act">${t.status === "ready" ? `<span class="b">Open trip ${I("chevron", 13, 2.6)}</span>` : t.status === "update" ? `<span class="b alt">${I("update", 13, 2.4)} Update</span>` : t.status === "downloading" ? `<span class="b ghost">${ring(t.progress, 18, 2.4, false)} Saving ${Math.round(t.progress * 100)}%</span>` : `<span class="b alt">${I("download", 13, 2.4)} Download</span>`}</div>`)).join("")}</div>
      <div class="sec">Our memories <span>${PAST().length}</span></div>
      <div class="wall">${PAST().map((t) => tr(t, "w", `${S(t)}<div class="cap">${t.title.split(" ").slice(0, 2).join(" ")}<i>${WP.year(t.start)}</i></div>`)).join("")}</div>
      <div class="foot">Synced ${WP.syncedAgo}</div>`,
  });

  // ───────────────────────────────────────── 8 · Crew
  add({
    id: "family", n: 8, name: "The Crew",
    tagline: "Built around who's going — the family is the hero",
    concept: "Leans hardest into “family”: a crew card at the top shows who travels (from the manifest's travelers: adults, kids' ages, pets) and a few warm stats. Each trip shows a calendar-leaf date and the crew for that trip, so “Grandma's 80th” visibly has 4 grown-ups.",
    palette: [["Vanilla", "#FFF9F0"], ["Coral", "#EE6C4D"], ["Mustard", "#E8B04A"], ["Teal", "#3D8C8A"], ["Espresso", "#2E2420"]],
    type: "Nunito 800 · tabular numerals for dates",
    moves: ["Crew + stats header (88pt)", "Calendar-leaf date instead of a cover", "76pt cards", "Per-trip crew chips"],
    needs: ["travelers from manifest surfaced to LocalTrip"], effort: "M",
    render: () => {
      const days = WP.trips.reduce((a, t) => a + nights(t), 0);
      return `
      <div class="top"><div class="big">Trips</div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="crewcard">
        <div class="faces"><span class="f a1">${I("adult", 18)}</span><span class="f a2">${I("adult", 18)}</span><span class="f k1">${I("kid", 16)}<em>9</em></span><span class="f k2">${I("kid", 16)}<em>6</em></span><span class="f p">${I("paw", 16)}</span></div>
        <div class="who">The ${WP.family} crew</div>
        <div class="stats"><span><b>${WP.trips.length}</b> trips</span><span><b>${days}</b> nights together</span><span><b>${WP.trips.filter((t) => t.status === "ready").length}</b> offline</span></div>
      </div>
      <div class="sec">Next up</div>
      ${U().map((t) => tr(t, "tc", `<div class="leaf" style="--a:${t.accent}"><span>${WP.mon(t.start)}</span><b>${WP.day(t.start)}</b></div><div class="mid"><div class="t">${t.title}</div><div class="s">${nights(t)} nights · ${when(t)}</div><div class="ppl">${crewIcons(t, 12)}${t.sharedBy ? `<span class="org">${I("users", 11, 2.2)} Aunt May's trip</span>` : ""}</div></div>${action(t, { ringSize: 28 })}`)).join("")}
      <div class="sec">We've been to</div>
      <div class="past">${PAST().map((t) => tr(t, "pp", `<div class="th">${S(t)}</div><div><div class="t">${t.title}</div><div class="s">${WP.mon(t.start)} ${WP.year(t.start)}</div></div>`)).join("")}</div>
      <div class="foot">Synced ${WP.syncedAgo}</div>`;
    },
  });

  // ───────────────────────────────────────── 9 · Bento
  add({
    id: "bento", n: 9, name: "Pastel Bento",
    tagline: "Soft rounded tiles tinted by each trip's colour",
    concept: "A bento-box grid of soft, rounded tiles tinted from each trip's manifest accent. The next trip is the wide tile; others are half-width; memories are small squares. Very friendly and toy-like, while a 2-column grid shows a lot at once.",
    palette: [["Milk", "#FFF7F0"], ["Peach tile", "#FFE1CF"], ["Sky tile", "#DCEBF7"], ["Butter tile", "#FFF0C2"], ["Choc", "#3B2B24"]],
    type: "Nunito 900 headings · Nunito 700 body",
    moves: ["Bento grid: 1 wide + half tiles", "Tile tint = trip accent", "Scene peeks from the tile corner", "Status as a corner button"],
    needs: [], effort: "M",
    render: () => {
      const n = next();
      const tint = (t) => `--tint:${t.accent}`;
      return `
      <div class="top"><div class="big">Trips</div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="bento">
        ${tr(n, "tile wide", `<div class="art">${S(n)}</div><div class="cd"><b>${daysUntil(n)}</b> days to go</div><div class="t">${n.title}</div><div class="s">${range(n)} · ${crewIcons(n, 12)}</div><span class="corner">${I("chevron", 16, 2.6)}</span>`).replace('class="tile wide"', `class="tile wide" style="${tint(n)}"`)}
        ${rest().map((t) => tr(t, "tile", `<div class="art">${S(t)}</div><div class="t">${t.title}</div><div class="s">${range(t)}</div>${t.sharedBy ? `<div class="s2">${I("users", 11, 2.4)} Aunt May</div>` : ""}<span class="corner">${t.status === "cloud" ? I("download", 15, 2.4) : t.status === "update" ? I("update", 15, 2.4) : t.status === "downloading" ? ring(t.progress, 22, 2.6, false) : I("check", 15, 2.6)}</span>`).replace('class="tile"', `class="tile" style="${tint(t)}"`)).join("")}
        <div class="tile add"><span>${I("sparkle", 18)}</span><div class="t">Plan a new trip</div><div class="s">Ask your AI agent “with Waypack”</div></div>
      </div>
      <div class="sec">Memories</div>
      <div class="mems">${PAST().map((t) => tr(t, "m", `${S(t)}<span>${t.title.split(" ")[0]}</span>`).replace('class="m"', `class="m" style="${tint(t)}"`)).join("")}</div>
      <div class="foot">Synced ${WP.syncedAgo}</div>`;
    },
  });

  // ───────────────────────────────────────── 10 · Journal
  add({
    id: "journal", n: 10, name: "Travel Journal",
    tagline: "Editorial serif on warm paper — calm and grown-up",
    concept: "A family travel journal: numbered entries, serif titles, italic details and small-caps status, separated by thin rules. Warm without being cute — the one for parents who want calm. Text-led rows are the most compact after the native list.",
    palette: [["Paper", "#FAF5EC"], ["Ink", "#2B2420"], ["Rust", "#B4532A"], ["Olive", "#6F7A45"], ["Rule", "#E3D7C5"]],
    type: "Fraunces 600 titles · Fraunces italic meta · Inter caps status",
    moves: ["66pt text-led entries", "Small-caps status text, no chips", "Portrait thumbnail 44×56", "Volume header shows the year in travel"],
    needs: ["Fraunces font (OFL)"], effort: "S",
    render: () => {
      let k = WP.trips.length;
      const ent = (t) => tr(t, "en", `<div class="no">${String(k--).padStart(2, "0")}</div><div class="mid"><div class="t">${t.title}${bm(t)}</div><div class="s">${range(t, t.past)} — ${crew(t)}</div><div class="st2 k-${t.past ? "ready" : t.status}">${t.past ? (t.nearby ? "From a nearby phone" : "In your pocket") : t.status === "ready" ? `In your pocket · ${when(t)}` : t.status === "update" ? "New edition · update" : t.status === "downloading" ? `Saving · ${Math.round(t.progress * 100)}%` : "Download ↓"}</div></div><div class="th">${S(t)}</div>`);
      return `
      <div class="top"><span class="acts">${I("scan", 19)}${I("settings", 19)}</span></div>
      <div class="mast"><div class="vol">Vol. 2026 · The ${WP.family} family</div><div class="big">Travel Journal</div></div>
      <div class="sec"><span>Ahead</span><i></i></div>
      ${U().map(ent).join("")}
      <div class="sec"><span>Past chapters</span><i></i></div>
      ${PAST().map(ent).join("")}
      <div class="foot">— synced ${WP.syncedAgo} —</div>`;
    },
  });

  WP.designs = designs;
})();
