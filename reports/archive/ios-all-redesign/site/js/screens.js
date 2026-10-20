// Every non-home screen, as "current" (Material 3 today) + one or two scrapbook takes.
// render() returns the inner HTML of a 390×844 iPhone screen; styles live in css/screens.css
// under `.scr.cur` (today) and `.scr.sk` (scrapbook, matching the shipped home).
window.WP = window.WP || {};

(() => {
  const { icon: I, scene: S, range, size } = WP;
  const K = () => WP.kyoto;
  const D = () => WP.dayPlan;

  // ───────────── shared bits
  const curBar = (title, { back = true, acts = [] } = {}) =>
    `<div class="appbar">${back ? I("back", 24) : ""}<span class="t"${back ? "" : ' style="padding-left:12px"'}>${title}</span>${acts.map((a) => I(a, 22)).join("")}</div>`;
  const lt = (icon, title, sub = "", tr = "", cls = "") =>
    `<div class="lt ${cls}">${icon ? I(icon, 22) : ""}<div class="tx">${title}${sub ? `<small>${sub}</small>` : ""}</div>${tr}</div>`;
  const nav = (title, { sub = "", back = true, right = [] } = {}) =>
    `<div class="nav">${back ? `<span class="rb">${I("back", 20, 2.4)}</span>` : ""}<div class="tt">${title}${sub ? `<small>${sub}</small>` : ""}</div>${right.map((r) => `<span class="rb${r.acc ? " acc" : ""}">${I(r.i || r, 19)}</span>`).join("")}</div>`;
  const row = (icon, chip, title, sub = "", tr = "", cls = "") =>
    `<div class="row ${cls}">${icon ? `<span class="chip-ic c-${chip}">${I(icon, 16, 2.2)}</span>` : ""}<div class="tx">${title}${sub ? `<small>${sub}</small>` : ""}</div>${tr}</div>`;
  const chev = `<span class="chev">${I("chevron", 16)}</span>`;
  const pol = (t, { cap = t.title, meta = range(t), tape = "", cls = "", style = "" } = {}) =>
    `<div class="pol ${cls}"${style ? ` style="${style}"` : ""}>${tape ? `<i class="tape ${tape}"></i>` : ""}<div class="ph">${S(t)}</div><div class="cap">${cap}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div>`;

  // Simplified shipped home, used as the backdrop under sheets and dialogs.
  const homeUnder = () => `<div class="bg-under">
      <div class="nav" style="padding-top:8px"><div class="tt" style="font-size:44px">Our trips<small>4 coming up · 3 remembered</small></div><span class="rb">${I("scan", 19)}</span><span class="rb">${I("settings", 19)}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 14px;padding:6px 18px">${WP.upcoming.map((t, i) => pol(t, { tape: "t" + (i % 3), style: `transform:rotate(${[-1.6, 1.3, 0.6, -0.9][i % 4]}deg)` })).join("")}</div></div>`;
  const curHomeUnder = () => `<div class="bg-under">${curBar("Trips", { back: false, acts: ["scan", "settings"] })}<div style="padding:4px 12px"><div style="font-weight:700;padding:16px 4px 8px">Upcoming</div><div class="card" style="margin:6px 0"><div style="height:140px">${S(K())}</div><div style="padding:16px;font-size:22px">${K().title}</div></div><div class="card" style="margin:6px 0"><div style="height:140px">${S(WP.trips[1])}</div><div style="padding:16px;font-size:22px">${WP.trips[1].title}</div></div></div></div>`;

  const bundle = () => `<div class="bundle"><div class="bh">${S(K())}<div class="t"><span>Oct 20–27 · 2 adults, kids 9 & 6</span><b>Kyoto fall break</b></div></div>
    <div class="bdays"><span>Day 1</span><span>Day 2</span><span class="on">Day 3</span><span>Day 4</span><span>Day 5</span></div>
    ${D().items.slice(0, 5).map((it) => `<div class="bi"><b>${it.time}</b><div>${it.title}${it.place ? `<small>${it.place}</small>` : ""}</div></div>`).join("")}
    <div class="btab"><span class="on">${I("calendar", 20)}Plan</span><span>${I("map", 20)}Map</span><span>${I("bed", 20)}Stay</span><span>${I("info", 20)}Info</span></div></div>`;

  const mapSvg = () => `<div class="mapbg"><svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <path d="M-20 520 C80 470 140 560 230 500 S360 420 420 460 V560 C340 520 300 600 220 590 S60 560 -20 610Z" fill="#9CC7DE" opacity=".8"/>
      <path d="M40 120 h120 v150 h-120z M250 640 h110 v120 h-110z" fill="#B9D3A5" opacity=".7"/>
      <g stroke="#FFFDF8" stroke-width="9" fill="none" stroke-linecap="round"><path d="M-10 330 L410 300"/><path d="M200 -10 L170 860"/><path d="M-10 720 L400 690"/><path d="M60 -10 L110 860"/></g>
      <g stroke="#F3D27A" stroke-width="6" fill="none"><path d="M-10 420 C120 380 250 420 410 360"/></g>
      <path d="M150 640 C170 560 120 470 170 390 S250 240 300 200" stroke="#D9694F" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" fill="none"/>
      <g font-family="Inter" font-size="11" font-weight="700" fill="#6E6052"><text x="230" y="545">Katsura River</text><text x="62" y="200">Bamboo grove</text></g>
      <circle cx="150" cy="640" r="9" fill="#4A8BD6" stroke="#fff" stroke-width="3"/>
      <g transform="translate(300 200)"><path d="M0 0 c-12 -16 -18 -24 -18 -32 a18 18 0 0 1 36 0 c0 8 -6 16 -18 32z" fill="#D9694F" stroke="#fff" stroke-width="2"/><circle cy="-32" r="6" fill="#fff"/></g>
    </svg></div>`;

  // Deterministic fake QR code.
  const qr = (px = 216) => {
    const n = 29, c = px / n; let s = 7, out = "";
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const finder = (x, y) => (x >= 0 && x < 7 && y >= 0 && y < 7) && (x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
    const inF = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const on = inF(x, y) ? finder(x, y) || finder(x - (n - 7), y) || finder(x, y - (n - 7)) : rnd() > 0.52;
      if (on) out += `<rect x="${x * c}" y="${y * c}" width="${c + .3}" height="${c + .3}"/>`;
    }
    return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" fill="#2B231D" style="display:block;margin:auto">${out}</svg>`;
  };

  const screens = [];
  const screen = (s) => screens.push(s);

  // ═════════════════════════════════════ 1 · Sign in
  screen({
    id: "signin", name: "Sign in", file: "sign_in_screen.dart",
    variants: [
      { kind: "cur", render: () => `<div style="padding:200px 0 0"><div class="center"><div style="width:64px;height:64px;border-radius:16px;margin:0 auto;background:radial-gradient(circle at 68% 32%,#F2B544 0 7px,transparent 8px),linear-gradient(160deg,#F7C59F,#C8603A)"></div><div style="font-size:28px;font-weight:700;margin-top:12px">Waypack</div><p class="mut" style="font-size:16px;margin:8px 0 40px">Trips planned by your AI agent, ready when the signal isn't.</p></div>
          <div class="abtn">${I("apple", 20)}Continue with Apple</div><div class="gbtn"><b style="color:#4285F4">G</b>Continue with Google</div>
          <p class="center mut" style="font-size:12px;margin-top:28px">Use the same account as your AI agent's Waypack connection.</p></div>` },
      {
        kind: "a", name: "Photo pile", tagline: "Three taped polaroids, a handwritten welcome, then the two buttons",
        concept: "First impression of the scrapbook: a small pile of trip polaroids taped to kraft paper sets the mood before anyone has a trip. The wordmark is in Caveat; the promise and fine print stay in Inter so they read as product, not decoration.",
        moves: ["Collage of 3 sample polaroids (drawn scenes, no photos needed)", "Caveat wordmark 48pt", "Pill buttons: ink Apple, paper Google", "Fine print on a tiny sticky note"],
        needs: ["Apple's button must stay Apple-styled: keep SignInWithAppleButton, just pill radius"], effort: "S",
        render: () => `<div style="position:relative;height:330px;margin-top:6px">
            <div style="position:absolute;left:34px;top:44px;width:150px;transform:rotate(-8deg)">${pol(WP.trips[4], { cap: "Maui", meta: "", tape: "l" })}</div>
            <div style="position:absolute;right:30px;top:24px;width:150px;transform:rotate(6deg)">${pol(WP.trips[2], { cap: "Tahoe", meta: "", tape: "r t1" })}</div>
            <div style="position:absolute;left:108px;top:132px;width:170px;transform:rotate(-1.5deg)">${pol(K(), { cap: "Kyoto", meta: "", tape: "t2" })}</div></div>
          <div class="center" style="padding:6px 30px 0"><div class="hand" style="font-size:52px">Waypack</div><p class="mut" style="font-size:15px;margin:8px 0 28px;line-height:1.45">Trips planned by your AI agent,<br>ready when the signal isn't.</p>
          <div class="abtn">${I("apple", 20)}Continue with Apple</div><div class="gbtn" style="margin-top:12px"><b style="color:#4285F4;font-size:18px">G</b>Continue with Google</div>
          <div class="sticky tilt-r" style="margin:26px 24px 0;font-size:12.5px;padding:10px 12px">Use the same account as your AI agent's Waypack connection.</div></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 2 · Long-press trip actions
  screen({
    id: "actions", name: "Trip actions sheet", file: "trips_screen.dart · _showActions",
    variants: [
      { kind: "cur", sbClear: true, render: () => `${curHomeUnder()}<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="st">Kyoto fall break</div><div class="p mut" style="font-size:14px;padding-bottom:8px">Available offline</div>
          ${lt("open", "Open")}${lt("update", "Update")}${lt("share", "Share travel plan", "PDF or link")}${lt("bookmark", "Remove bookmark")}${lt("trash", "Delete offline copy", "", "", "err")}</div>` },
      {
        kind: "a", name: "Polaroid peel-off", sbClear: true, tagline: "The pressed polaroid lifts into the sheet header; actions as icon-chip rows",
        concept: "The long-pressed polaroid appears in the sheet header (tilted, same scene), so you always see which trip you're acting on. Rows use small pastel icon chips in the washi colours and dashed dividers like the rest of the scrapbook. Delete sits alone at the bottom in brick red.",
        moves: ["Sheet = kraft paper with dots, 26pt top radius", "Header: mini polaroid + Caveat title + status stamp", "Pastel icon chips (washi colours)", "Destructive row split off in its own card"],
        needs: [], effort: "S",
        render: () => `${homeUnder()}<div class="scrim"></div><div class="sheet"><div class="grab"></div>
          <div class="sheet-hd"><div class="pol"><div class="ph">${S(K())}</div></div><div><div class="tt">Kyoto fall break</div><small>Oct 20–27 · 182 MB</small><div class="stamp st-ok" style="margin-top:8px">${I("check", 11, 3)} offline</div></div></div>
          <div class="card">${row("open", "mint", "Open")}${row("update", "yel", "Update", "Version 4 is ready")}${row("share", "pink", "Share travel plan", "PDF or web link")}${row("bookmark", "blue", "Remove bookmark")}</div>
          <div class="card" style="margin-top:12px">${row("trash", "red", "Delete offline copy", "", "", "err")}</div></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 3 · Trip (bundle + menu button)
  screen({
    id: "trip", name: "Trip view", file: "trip_screen.dart",
    variants: [
      { kind: "cur", sbClear: true, render: () => `<div class="ov">${bundle()}<span class="fab">${I("more", 22, 2.6)}</span></div>` },
      {
        kind: "a", name: "Taped paper button", sbClear: true, tagline: "The trip's own page stays untouched; only the ⋯ button joins the scrapbook",
        concept: "The bundle is the trip's own web UI, so we shouldn't restyle it. The only native piece is the floating menu button: today a small square in the trip accent. It becomes a round light-paper button with a strip of washi tape, the same object vocabulary as the polaroids, and it reads on any bundle colour.",
        moves: ["50pt round paper button, washi tape on top", "Same position (clear of the bundle's tab bar)", "Always light paper, so it never clashes with the trip accent"],
        needs: [], effort: "S",
        render: () => `<div class="ov">${bundle()}<span class="fabp">${I("more", 22, 2.6)}</span></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 4 · Trip menu
  const menuUnder = () => `<div class="bg-under" style="padding:0">${bundle()}</div>`;
  screen({
    id: "menu", name: "Trip menu", file: "trip_screen.dart · _menu",
    variants: [
      { kind: "cur", sbClear: true, render: () => `${menuUnder()}<div class="scrim"></div><div class="sheet"><div class="grab"></div>
          ${lt("calendar", "Today", "What's next, from the trip data")}${lt("map", "Map", "Offline map with your location")}${lt("sparkle", "Ask about this trip", "On-device AI, works without signal")}${lt("share", "Share travel plan", "Send as PDF or public web link (no app needed)")}${lt("phone", "Hand off to a nearby phone", "Copy this trip to a companion, no signal needed")}${lt("userplus", "Invite travel companions", "They get this trip in their own app (needs a connection)")}${lt("info", "Info", "Version 4 · 182 MB · saved 3 days ago · synced 2 min ago")}${lt("update", "Re-download")}${lt("trash", "Delete from this device", "", "", "err")}</div>` },
      {
        kind: "a", name: "Sticker tiles", sbClear: true, tagline: "The four everyday tools as paper tiles, the rest as a short list",
        concept: "Nine equal rows bury what people use on the road. Today, Map, Ask and Share become four paper tiles in a 2×2 grid with handwritten labels; hand-off, invite, re-download and delete sit below in a compact card. Info folds into the header line.",
        moves: ["2×2 paper tiles with Caveat labels", "Info line moves under the title (version · size · synced)", "Secondary actions in one card, delete last in red", "Fits without scrolling on an iPhone mini"],
        needs: [], effort: "M",
        render: () => `${menuUnder()}<div class="scrim"></div><div class="sheet"><div class="grab"></div>
          <div style="padding:0 22px 14px"><div class="hand" style="font-size:32px">Kyoto fall break</div><div class="mut" style="font-size:12px;margin-top:4px">v4 · 182 MB · saved 3 days ago · synced 2 min ago</div></div>
          <div class="grid2t">
            <div class="tile tilt-l"><span class="chip-ic c-yel">${I("calendar", 16, 2.2)}</span><b>Today</b><small>What's next</small></div>
            <div class="tile tilt-r"><span class="chip-ic c-mint">${I("map", 16, 2.2)}</span><b>Map</b><small>Offline, with you on it</small></div>
            <div class="tile tilt-r"><span class="chip-ic c-lilac">${I("sparkle", 16, 2.2)}</span><b>Ask</b><small>On-device, no signal</small></div>
            <div class="tile tilt-l"><span class="chip-ic c-pink">${I("share", 16, 2.2)}</span><b>Share</b><small>PDF or web link</small></div>
          </div>
          <div class="card" style="margin-top:16px">${row("phone", "blue", "Hand off to a nearby phone", "", chev)}${row("userplus", "mint", "Invite companions", "", chev)}${row("update", "yel", "Re-download")}${row("trash", "red", "Delete from this device", "", "", "err")}</div></div>`,
      },
      {
        kind: "b", name: "Paper list", sbClear: true, tagline: "Same nine items and order as today, restyled",
        concept: "Lowest-risk option: keep the list and its order, swap the look. Pastel icon chips, dashed dividers, kraft sheet. Grouped into Use / Share / This copy so the long list has some rhythm.",
        moves: ["Three small groups with Caveat labels", "Pastel icon chips", "Same order, same copy"],
        needs: [], effort: "S",
        render: () => `${menuUnder()}<div class="scrim"></div><div class="sheet" style="max-height:760px;overflow:hidden"><div class="grab"></div>
          <div class="card">${row("calendar", "yel", "Today", "What's next, from the trip data")}${row("map", "mint", "Map", "Offline map with your location")}${row("sparkle", "lilac", "Ask about this trip", "On-device AI, works without signal")}</div>
          <div class="hand" style="font-size:22px;padding:14px 22px 8px">Share</div>
          <div class="card">${row("share", "pink", "Share travel plan", "PDF or public web link")}${row("phone", "blue", "Hand off to a nearby phone", "No signal needed")}${row("userplus", "mint", "Invite travel companions", "Needs a connection")}</div>
          <div class="hand" style="font-size:22px;padding:14px 22px 8px">This copy</div>
          <div class="card">${row("info", "blue", "Version 4 · 182 MB", "Saved 3 days ago · synced 2 min ago")}${row("update", "yel", "Re-download")}${row("trash", "red", "Delete from this device", "", "", "err")}</div></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 5 · Today
  const curItem = (it) => `<div class="card ${it.now ? "now" : ""} ${it.done ? "done" : ""}"><div class="item"><span class="tm">${it.time}</span><div class="tx">${it.title}${it.notes ? `<small>${it.notes}</small>` : ""}</div>${I("event", 22)}${it.place ? I("nav", 22) : ""}</div></div>`;
  const ticket = (it) => `<div class="ticket ${it.now ? "now" : ""} ${it.done ? "done" : ""}"><div class="stub"><b>${it.time}</b>${it.end ? `<small>to ${it.end}</small>` : ""}</div><div class="bd"><b>${it.title}</b>${it.notes && !it.done ? `<small>${it.notes}</small>` : ""}${it.place && !it.done ? `<span class="pl">${I("pin", 12, 2.4)}${it.place}</span>` : ""}</div>${it.done ? "" : `<div class="acts">${it.place ? `<span>${I("nav", 15, 2.2)}</span>` : ""}<span>${I("event", 15, 2)}</span></div>`}</div>`;
  const now = () => D().items.find((x) => x.now);
  screen({
    id: "today", name: "Today", file: "today_screen.dart",
    variants: [
      { kind: "cur", render: () => `${curBar("Today", { acts: ["sparkle"] })}
          <div class="hero"><div class="lb">NOW · DAY 3</div><div class="tt">${now().title}</div><div class="sb2">11:00 – 12:30 · ${now().place}</div><div class="nt">${now().notes}</div><div class="bt"><span class="tb">${I("nav", 18)}Navigate</span><span class="tb">${I("event", 18)}Calendar</span></div></div>
          <div class="dh">${D().title}<span>Oct 22</span></div>${D().items.map(curItem).join("")}
          <div class="dh">Where you're staying</div><div class="card"><div class="item"><div class="tx">${WP.lodging.name}<small>${WP.lodging.address}<br>${WP.lodging.notes}</small></div>${I("nav", 22)}</div></div>
          <div class="dh">Emergency</div><div class="card">${WP.emergency.map(([l, v]) => lt("phone", l, "", `<b style="font-size:15px">${v}</b>`)).join("")}</div>` },
      {
        kind: "a", name: "Ticket trail", tagline: "Now as a big taped polaroid, the day as tickets along a dashed trail",
        concept: "What's happening now is a polaroid of the trip scene with the activity handwritten as its caption and Navigate as the main button. The rest of the day is a string of ticket stubs on a dashed walking-trail line: the time on the stub, done ones crossed out and faded. The hotel is a luggage-tag card, emergency numbers are a red-taped sticky note.",
        moves: ["Hero = polaroid + handwritten caption + ‘NOW’ stamp", "Itinerary as ticket stubs on a dashed trail", "Done items: struck-through time, 55% opacity", "Emergency on a sticky note, numbers tappable"],
        needs: ["Uses manifest fields already parsed (items, places, emergency_numbers)"], effort: "M",
        render: () => `${nav("Day 3", { sub: "Thu Oct 22 · Kyoto fall break", right: ["sparkle"] })}
          <div style="padding:6px 22px 4px"><div class="pol tilt-l"><i class="tape"></i><div class="ph" style="aspect-ratio:1/.5">${S(K())}<span class="stamp st-acc" style="position:absolute;right:10px;top:10px;background:#FFFDF8">Now · till 12:30</span></div>
            <div class="cap" style="font-size:30px">${now().title}</div><div class="meta" style="font-size:12.5px">${now().place} · ${now().notes}</div>
            <div style="display:flex;gap:8px;margin-top:12px"><span class="btn sm">${I("nav", 15, 2.4)}Navigate</span><span class="btn sm sec" style="background:#F3EADB;color:#3D332B">${I("event", 15)}Calendar</span></div></div></div>
          <div class="h2">${D().title}</div>
          <div class="trail">${D().items.map(ticket).join("")}</div>
          <div class="h2">Where we're sleeping</div>
          <div class="card" style="display:flex;gap:12px;align-items:center;padding:14px">${`<span class="chip-ic c-lilac">${I("bed", 16, 2.2)}</span>`}<div style="flex:1"><b style="font-size:15px">${WP.lodging.name}</b><div class="mut" style="font-size:12.5px;margin-top:2px">${WP.lodging.address}<br>${WP.lodging.notes}</div></div><span class="rb acc">${I("nav", 18, 2.2)}</span></div>
          <div class="h2">If something goes wrong</div>
          <div style="padding:4px 22px 20px"><div class="sticky tilt-r" style="background:#FFE2D8"><i class="tape t2"></i>${WP.emergency.map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14.5px"><span>${I("phone", 15)}</span><span style="flex:1;margin-left:10px">${l}</span><b>${v}</b></div>`).join("")}</div></div>`,
      },
      {
        kind: "b", name: "Journal page", tagline: "The day written out on a ruled notebook page, times in the margin",
        concept: "The whole day reads like a page in the family travel journal: blue-ruled paper with a red margin, handwritten times in the margin, activities in Inter on the lines. ‘Now’ is circled in coral; done items are ticked. Most compact option and the most ‘journal’, but less room for notes and two buttons per row.",
        moves: ["Ruled paper page with red margin line", "Handwritten times; coral circle around now", "Actions collapse into one ⋯ per row (Navigate / Calendar)", "Hotel and emergency as stickies at the bottom"],
        needs: [], effort: "M",
        render: () => `${nav("Day 3", { sub: "Thu Oct 22 · Kyoto fall break", right: ["sparkle"] })}
          <div style="padding:2px 18px 4px"><div class="sticky tilt-s" style="background:#FFFDF8;display:flex;gap:12px;align-items:center"><i class="tape t1"></i><span class="stamp st-acc">Now</span><div style="flex:1"><b style="font-size:16px">${now().title}</b><div style="font-size:12px;color:#8C7D6E;margin-top:2px">till 12:30 · 20-min uphill walk</div></div><span class="rb acc">${I("nav", 18, 2.2)}</span></div></div>
          <div style="padding:18px 18px 0"><div class="ruled margin" style="border-radius:3px;padding:8px 0 16px">
            <div class="hand" style="font-size:28px;padding:0 0 4px 68px;line-height:32px">${D().title}</div>
            ${D().items.map((it) => `<div style="display:flex;min-height:64px;${it.done ? "opacity:.5" : ""}"><span class="hand" style="width:62px;flex:none;text-align:center;margin-right:6px;font-size:21px;line-height:32px;${it.now ? "color:#D9694F" : ""}">${it.now ? `<span style="border:2px solid #D9694F;border-radius:50%;padding:2px 5px">${it.time}</span>` : it.time}</span><div style="flex:1;min-width:0;padding-right:10px;font-size:14.5px;line-height:32px">${it.done ? "✓ " : ""}<b style="font-weight:${it.now ? 800 : 600}">${it.title}</b><div style="font-size:12.5px;line-height:32px;color:#8C7D6E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.place || ""}</div></div><span style="padding:6px 10px 0 0;color:#8C7D6E">${it.done ? "" : I("more", 18, 2.6)}</span></div>`).join("")}
          </div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:22px 18px 24px">
            <div class="sticky tilt-l"><div class="hand" style="font-size:22px">Sleeping at</div><div style="font-size:13px;margin-top:6px;font-weight:700">${WP.lodging.name}</div><div style="font-size:11.5px;color:#8C7D6E;margin-top:2px">${WP.lodging.notes}</div></div>
            <div class="sticky tilt-r" style="background:#FFE2D8"><div class="hand" style="font-size:22px">SOS</div>${WP.emergency.slice(0, 2).map(([l, v]) => `<div style="font-size:12px;margin-top:5px">${l} <b>${v}</b></div>`).join("")}</div></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 6 · Map
  screen({
    id: "map", name: "Map", file: "trip_screen.dart · _MapScreen",
    variants: [
      { kind: "cur", render: () => `<div style="position:absolute;inset:0">${mapSvg()}</div><div style="position:relative;background:var(--bg)">${curBar("Kyoto fall break")}</div>` },
      {
        kind: "a", name: "Floating paper pill", sbClear: true, tagline: "Full-bleed map with the title on a floating paper pill",
        concept: "The map gets the whole screen. The app bar becomes a floating back button plus a paper pill with the trip name in Caveat and ‘Offline map’ underneath, so you know at a glance whether you're on downloaded tiles. Map controls (locate, layers) are round paper buttons like the home's top bar.",
        moves: ["No app bar: map edge to edge", "Paper pill title + offline/online note", "Round paper locate / layers buttons", "Route line and pins in the trip's coral"],
        needs: ["Map controls live inside the bundle's map page today; this only moves the native header"], effort: "S",
        render: () => `<div style="position:absolute;inset:0">${mapSvg()}</div><div class="pillbar"><span class="rb">${I("back", 20, 2.4)}</span><div class="lbl"><b>Kyoto fall break</b><small>Offline map · downloaded Oct 5</small></div></div>
          <div class="mapside"><span class="rb">${I("layers", 19)}</span><span class="rb">${I("locate", 19)}</span></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 7 · Assistant
  screen({
    id: "ask", name: "Ask about this trip", file: "assistant_screen.dart",
    variants: [
      { kind: "cur", render: () => `${curBar("Ask about this trip")}${WP.chat.map((m) => `<div class="bubble-q">${m.q}</div><div class="bubble-a">${m.a}</div>`).join("")}
          <div style="padding:12px 12px 0">${WP.suggestions.slice(0, 3).map((s) => `<span class="chip">${s}</span>`).join("")}</div>
          <div class="composer"><div class="in">Ask about your trip</div>${I("send", 24)}</div>` },
      {
        kind: "a", name: "Sticky-note chat", tagline: "Your questions on yellow sticky notes, answers on paper cards",
        concept: "Questions are yellow sticky notes stuck on the right, slightly tilted; answers are paper cards on the left with a small ‘From your plan’ label so it's clear they come from the downloaded trip, not the internet. Suggested questions are washi-tape strips you tap. The composer is a pill with a coral send button.",
        moves: ["Q = sticky note (tilted), A = paper card", "‘From your plan · offline’ provenance label", "Suggestions as washi-tape chips", "Pill composer, coral send"],
        needs: [], effort: "S",
        render: () => `${nav("Ask", { sub: "Kyoto fall break · works with no signal" })}
          ${WP.chat.map((m) => `<div class="sticky q">${m.q}</div><div class="a"><div class="from">${I("sparkle", 12, 2.4)}From your plan · offline</div>${m.a}</div>`).join("")}
          <div style="padding:14px 18px 120px">${WP.suggestions.slice(0, 4).map((s) => `<span class="wchip">${s}</span>`).join("")}</div>
          <div class="composer"><div class="in">Ask about your trip…</div><span class="rb acc" style="width:48px;height:48px">${I("send", 20, 2.6)}</span></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 8 · Assistant setup
  screen({
    id: "asksetup", name: "Get the offline assistant", file: "assistant_screen.dart · setup",
    variants: [
      { kind: "cur", render: () => `${curBar("Ask about this trip")}<div style="padding:120px 24px 0;text-align:center">${I("sparkle", 48)}<div style="font-size:22px;margin:16px 0 8px">Get the offline assistant</div><p class="mut" style="font-size:15px;line-height:1.45">Your phone can answer questions about your trip with no signal, using Apple Intelligence. It needs a one-time model download of about 1.2 GB (do it on Wi-Fi, before you go).</p><div style="margin-top:20px"><span class="fb">${I("download", 18)}Download model</span></div></div>`.replace(/<svg class="ic" width="48"/, '<svg class="ic" style="margin:auto" width="48"') },
      {
        kind: "a", name: "Packing note", tagline: "A taped note that reads like a to-do before the trip",
        concept: "Setting up the on-device model is a pre-trip chore, so it's framed like one: a taped note with a checkbox list (Wi-Fi, ~1.2 GB, once) and a big Download button. While downloading, the button becomes a striped progress bar.",
        moves: ["Paper note with tape and a checklist", "Handwritten headline", "Striped progress bar while downloading"],
        needs: [], effort: "S",
        render: () => `${nav("Ask", { sub: "Kyoto fall break" })}
          <div style="padding:60px 26px 0"><div class="pol tilt-l" style="padding:24px 20px 22px"><i class="tape t1"></i>
            <span class="chip-ic c-lilac" style="width:44px;height:44px">${I("sparkle", 22, 2)}</span>
            <div class="hand" style="font-size:34px;margin-top:12px">Before you go…</div>
            <p style="font-size:14px;line-height:1.5;margin:8px 0 12px">Your phone can answer questions about this trip with no signal, using Apple Intelligence.</p>
            ${["One-time download, about 1.2 GB", "Best on Wi-Fi and power", "Then it works anywhere, offline"].map((x, i) => `<div style="display:flex;gap:10px;align-items:center;font-size:13.5px;padding:5px 0"><span style="width:18px;height:18px;border:2px solid #8C7D6E;border-radius:4px;display:grid;place-items:center;color:#4F8A62">${i === 2 ? "" : I("check", 13, 3.2)}</span>${x}</div>`).join("")}
            <div style="margin-top:16px"><div class="prog"><i style="width:38%"></i></div><div style="display:flex;justify-content:space-between;font-size:12px;color:#8C7D6E;margin-top:6px"><span>Downloading…</span><b>38%</b></div></div></div></div>
          <p class="center mut" style="font-size:12.5px;padding:24px 40px 0">Everything else works offline as usual: the plan, the map and Today.</p>`,
      },
    ],
  });

  // ═════════════════════════════════════ 9 · Share sheet
  screen({
    id: "share", name: "Share sheet", file: "share_trip_sheet.dart",
    variants: [
      { kind: "cur", sbClear: true, render: () => `${curHomeUnder()}<div class="scrim"></div><div class="sheet"><div class="grab"></div><div class="st" style="padding-bottom:12px">Share "Kyoto fall break"</div>
          ${lt("file", "Send as PDF", "Shareable PDF document — opens on any device, printable, no app needed")}${lt("link", "Send public web link", "Opens in any web browser without installing an app")}${lt("userplus", "Invite travel companions", "They get this trip in their Waypack app with offline maps")}${lt("phone", "Hand off to a nearby phone", "Copy offline to a companion's phone, no signal needed")}</div>` },
      {
        kind: "a", name: "Postcards", sbClear: true, tagline: "Four ways to share as four little postcards with stamps",
        concept: "Sharing is sending, so each option is a postcard: icon in a perforated stamp corner, short handwritten title, one line of plain explanation. The ‘who gets what’ is clearer: the first two are for anyone (no app), the last two put the trip in someone's Waypack.",
        moves: ["2×2 postcards with perforated stamp icons", "Two labelled groups: ‘Anyone’ / ‘Fellow Waypackers’", "Copy shortened to one line each"],
        needs: [], effort: "S",
        render: () => {
          const card = (ic, c, t, s, tilt) => `<div class="tile ${tilt}" style="padding:12px"><span style="position:absolute;right:10px;top:10px;width:38px;height:44px;display:grid;place-items:center;background:var(--c);outline:2px dotted #FFFDF8;outline-offset:-3px" class="c-${c}">${I(ic, 18, 2.2)}</span><b style="margin-top:44px">${t}</b><small>${s}</small></div>`;
          return `${homeUnder()}<div class="scrim"></div><div class="sheet"><div class="grab"></div>
          <div style="padding:0 22px 6px"><div class="hand" style="font-size:32px">Share Kyoto</div></div>
          <div class="hand mut" style="font-size:20px;padding:4px 22px 10px">For anyone, no app</div>
          <div class="grid2t">${card("file", "pink", "PDF", "Printable, opens anywhere", "tilt-l")}${card("link", "yel", "Web link", "Opens in any browser", "tilt-r")}</div>
          <div class="hand mut" style="font-size:20px;padding:18px 22px 10px">For fellow Waypackers</div>
          <div class="grid2t">${card("userplus", "mint", "Invite", "Trip + offline maps in their app", "tilt-r")}${card("phone", "blue", "Hand off", "Phone to phone, no signal", "tilt-l")}</div></div>`;
        },
      },
    ],
  });

  // ═════════════════════════════════════ 10 · Hand off (send)
  screen({
    id: "handoff", name: "Hand off to a nearby phone", file: "nearby_screens.dart · HandoffSendScreen",
    variants: [
      { kind: "cur", render: () => `${curBar("Hand off to a nearby phone")}<div class="center" style="padding-top:12px"><div style="font-size:22px">Kyoto fall break</div><div class="mut" style="font-size:14px">182 MB · plan + offline map</div></div>
          <div class="qr">${qr(216)}</div><p class="p center">On the other phone: Waypack → Trips → Receive from a nearby phone, then scan this code.</p>
          <div style="margin-top:8px">${lt("", "No camera? Type this instead", "192.168.1.5:51234 · KQ7M-2XHD")}</div><p class="p mut center" style="font-size:12px;margin-top:8px">Sharing stops when you leave this screen (or after 15 minutes).</p>` },
      {
        kind: "a", name: "QR polaroid", tagline: "The QR code is a taped polaroid; the typed fallback is its handwritten caption",
        concept: "The code is the object you hold up to the other phone, so it becomes a polaroid with the trip name as its caption. The manual address and code are written underneath like a note on the photo. Instructions become three short numbered steps.",
        moves: ["QR inside a polaroid with washi tape", "Fallback code in large mono under the QR", "Numbered 1-2-3 steps instead of a sentence", "‘Sent to 1 phone’ appears as a green stamp"],
        needs: [], effort: "S",
        render: () => `${nav("Hand off", { sub: "Kyoto fall break · 182 MB · plan + map" })}
          <div class="pol qrpol tilt-l"><i class="tape"></i><div class="qr">${qr(220)}</div><div class="cap">Kyoto fall break</div><div class="meta center" style="font:13px ui-monospace,Menlo,monospace;margin-top:6px;color:#3D332B">192.168.1.5:51234 · KQ7M-2XHD</div>
            <span class="stamp st-ok" style="position:absolute;right:-10px;top:-12px;background:#FFFDF8;transform:rotate(8deg)">${I("check", 11, 3)} sent to 1 phone</span></div>
          <div class="card" style="margin-top:24px">${row("", "", "<b>1</b>&nbsp; On the other phone, open Waypack")}${row("", "", "<b>2</b>&nbsp; Tap the scan button on Our trips")}${row("", "", "<b>3</b>&nbsp; Point it at this code")}</div>
          <p class="center mut" style="font-size:12px;padding:14px 30px">Same Wi-Fi, or join this phone's hotspot. Stops when you leave (or after 15 min).</p>`,
      },
    ],
  });

  // ═════════════════════════════════════ 11 · Receive
  screen({
    id: "receive", name: "Receive from a nearby phone", file: "nearby_screens.dart · ReceiveNearbyScreen",
    variants: [
      { kind: "cur", render: () => `${curBar("Receive from a nearby phone")}<p class="p" style="font-size:16px">On the phone that has the trip: open it, tap ⋯, then Hand off to a nearby phone.</p><p class="p mut" style="font-size:12px;margin-top:8px">Both devices on the same Wi-Fi, or the other phone joins this phone's Personal Hotspot.</p>
          <div class="cam"></div><p class="p" style="margin-bottom:12px">Or type what the other phone shows</p><div class="field"><small>Address</small><span>192.168.1.5:51234</span></div><div class="field"><small>Code</small><span>ABCD-EFGH</span></div><div style="padding:0 16px"><span class="fb">Connect</span></div>` },
      {
        kind: "a", name: "Camera polaroid", tagline: "The viewfinder is a blank polaroid waiting for a picture",
        concept: "Scanning is ‘taking the photo’ of the other phone's polaroid: the live camera sits inside a polaroid frame with corner guides, caption ‘Point at the code’. The manual fallback folds into a paper card below with two fields and one button.",
        moves: ["Live camera inside a polaroid frame", "Handwritten caption as the instruction", "Manual entry in a single paper card", "Hotspot tip on a sticky note"],
        needs: [], effort: "S",
        render: () => `${nav("Receive a trip", { sub: "From a nearby phone, no signal needed" })}
          <div style="padding:6px 34px 0"><div class="pol tilt-r"><i class="tape t2"></i><div class="cam"><div class="vf"></div></div><div class="cap center" style="font-size:26px">Point at the code</div><div class="meta center">On their phone: open the trip → ⋯ → Hand off</div></div></div>
          <div class="hand" style="font-size:22px;padding:22px 22px 10px">…or type it in</div>
          <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="field"><small>Address</small><span>192.168.1.5:51234</span></div><div class="field"><small>Code</small><span>ABCD-EFGH</span></div><span class="btn block">Connect</span></div>
          <div style="padding:18px 22px 24px"><div class="sticky tilt-l" style="font-size:12.5px">No shared Wi-Fi? One phone turns on Personal Hotspot (works without signal), the other joins it.</div></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 12 · Received
  screen({
    id: "received", name: "Trip received", file: "nearby_screens.dart · done state",
    variants: [
      { kind: "cur", render: () => `${curBar("Receive from a nearby phone")}<div class="center" style="padding-top:160px"><svg width="56" height="56" viewBox="0 0 24 24" style="margin:auto;display:block"><circle cx="12" cy="12" r="11" fill="#2E7D32"/><path d="m7 12 3.5 3.5L17 9" stroke="#fff" stroke-width="2.4" fill="none"/></svg><div style="font-size:22px;margin:8px 0 4px">Kyoto fall break is on this phone</div><p class="mut" style="font-size:14px;line-height:1.45">Everything works offline. When you have signal, it updates like your other trips if you're a companion on it.</p><span class="fb" style="margin-top:16px">Open trip</span></div>` },
      {
        kind: "a", name: "New polaroid on the wall", tagline: "The received trip lands as a fresh taped polaroid with a ‘received’ stamp",
        concept: "The payoff moment: the trip appears as a new polaroid (with its drawn scene) being taped onto the page, a green RECEIVED stamp across the corner, and one big Open button. Before receiving, the same polaroid shows size and a Receive button with the striped progress bar.",
        moves: ["Polaroid of the incoming trip with stamp", "Handwritten ‘It's here!’", "One primary action: Open trip"],
        needs: [], effort: "S",
        render: () => `${nav("Receive a trip")}
          <div style="padding:70px 70px 0;position:relative"><div class="pol tilt-l" style="padding:10px 10px 14px"><i class="tape"></i><div class="ph">${S(K())}</div><div class="cap" style="font-size:28px">Kyoto fall break</div><div class="meta">Oct 20–27 · 182 MB · with offline map</div></div>
            <span class="stamp st-ok" style="position:absolute;right:52px;top:96px;font-size:15px;background:#FFFDF8;transform:rotate(12deg)">${I("check", 14, 3)} Received</span></div>
          <div class="center" style="padding:30px 30px 0"><div class="hand" style="font-size:40px">It's here!</div><p class="mut" style="font-size:14px;line-height:1.5;margin:8px 0 20px">Everything works offline. When you have signal, it updates like your other trips if you're a companion on it.</p><span class="btn" style="width:220px">${I("open", 16, 2.4)}Open trip</span></div>`,
      },
    ],
  });

  // ═════════════════════════════════════ 13 · Settings
  const tokRow = (sk) => WP.tokens.map((t) => sk ? row("key", "yel", `${t.prefix}…`, `${t.label} · last used ${t.used}`, `<span class="mut">${I("trash", 17)}</span>`) : lt("key", `${t.prefix}…`, `${t.label} · last used ${t.used}`, `<span class="tr">${I("trash", 22)}</span>`)).join("");
  screen({
    id: "settings", name: "Settings", file: "settings_screen.dart",
    variants: [
      { kind: "cur", render: () => `${curBar("Settings")}<div class="sec">Account</div>${lt("person", WP.me.email)}${lt("star", WP.me.plan, WP.me.planSub)}${lt("disk", "Storage used", "", `<span class="tr">${WP.me.storage}</span>`)}
          <div class="sec">Maps</div>${lt("globe", "Use online map", "When connected, show the full map, including outside your downloaded areas. Turn off to use only downloaded maps, e.g. to save data abroad.", '<span class="sw"></span>')}
          <div class="sec">Connect your AI agent</div><p class="p" style="margin-bottom:8px">1. Add the Waypack MCP server to your agent:</p><div class="code"><span>${WP.mcp}</span>${I("copy", 18)}</div><div class="code"><span>claude mcp add --transport http waypack ${WP.mcp}</span>${I("copy", 18)}</div>
          <p class="p">2. Optional: install the Waypack skill for best results (Claude Code / Claude apps).</p><div class="p"><span class="txb">Skill install instructions</span></div><p class="p">3. Ask: "Plan a 3-day trip to … with Waypack." Sign in with this same email when the agent asks.</p>
          <div class="sec">API tokens</div><p class="p mut" style="font-size:12px">For headless MCP clients that can't do OAuth.</p>${tokRow(false)}${lt("plus", "Create token")}
          <div class="sec">Feedback</div>${lt("shake", "Shake to report feedback", "Shake your device to capture a screenshot and report an issue.", '<span class="sw"></span>')}
          <div class="sec">About</div>${lt("shield", "Privacy policy")}${lt("info", "Map data & licenses", "© OpenStreetMap contributors (ODbL), Protomaps, MapLibre")}
          <div style="height:1px;background:var(--line);margin:16px 0"></div>${lt("logout", "Sign out")}${lt("trash", "Delete account", "", "", "err")}` },
      {
        kind: "a", name: "Index cards", tagline: "Grouped paper cards with pastel icon chips and Caveat section labels",
        concept: "The iOS ‘inset grouped’ list, in scrapbook clothes: each section is a paper card (theme surface, so dark mode stays dark), rows have pastel icon chips and dashed dividers, section names are handwritten. The agent setup is a numbered card with copyable code strips; the plan shows a little ‘Pro’ stamp.",
        moves: ["Inset paper cards per section", "Pastel icon chips, dashed row dividers", "Toggles in the home's green", "Agent setup as a numbered card; copy buttons on the code strips", "Sign out + delete in their own card at the end"],
        needs: [], effort: "M",
        render: () => `${nav("Settings")}
          <div class="card" style="display:flex;gap:12px;align-items:center;padding:14px"><span class="chip-ic c-pink" style="width:44px;height:44px">${I("person", 20, 2)}</span><div style="flex:1;min-width:0"><b style="font-size:15px">${WP.me.email}</b><div class="mut" style="font-size:12.5px;margin-top:2px">${WP.me.planSub}</div></div><span class="stamp st-acc">Pro</span></div>
          <div class="card" style="margin-top:12px">${row("disk", "blue", "Storage used", "", `<span class="tr">${WP.me.storage}</span>`)}${row("globe", "mint", "Use online map", "When connected, show the full map. Off = only downloaded maps (saves data abroad).", '<span class="tog"></span>')}</div>
          <div class="h2">Connect your AI agent</div>
          <div class="card" style="padding:14px;font-size:13.5px;line-height:1.5">
            <div><b>1</b>&nbsp; Add the Waypack MCP server:</div><div class="code" style="margin:8px 0 6px"><span>${WP.mcp}</span>${I("copy", 16)}</div><div class="code" style="margin-bottom:12px"><span>claude mcp add --transport http waypack ${WP.mcp}</span>${I("copy", 16)}</div>
            <div><b>2</b>&nbsp; Optional: install the Waypack skill. <span class="lnk">How →</span></div>
            <div style="margin-top:10px"><b>3</b>&nbsp; Ask: <span class="hand" style="font-size:19px">“Plan a 3-day trip to … with Waypack.”</span></div></div>
          <div class="h2">API tokens<small>for headless MCP clients</small></div>
          <div class="card">${tokRow(true)}${row("plus", "mint", "Create token", "", chev)}</div>
          <div class="h2">More</div>
          <div class="card">${row("shake", "yel", "Shake to report feedback", "", '<span class="tog"></span>')}${row("shield", "lilac", "Privacy policy", "", chev)}${row("info", "blue", "Map data & licenses", "OpenStreetMap (ODbL), Protomaps, MapLibre", chev)}</div>
          <div class="card" style="margin:16px 18px 30px">${row("logout", "blue", "Sign out")}${row("trash", "red", "Delete account", "", "", "err")}</div>`,
      },
      {
        kind: "b", name: "Notebook", tagline: "One long ruled page, no cards; settings read like notes in the margin",
        concept: "Instead of cards, Settings is a single paper page clipped to the kraft board: handwritten section headings, rows as plain lines on the ruling. Calmer and more ‘journal’, but the paper page stays light in dark mode (it's an object), and long code strings fit less comfortably.",
        moves: ["One light paper page, ruled", "Caveat headings with an underline swash", "Rows sit on the ruling, no dividers", "Paper clip instead of tape"],
        needs: ["Breaks the dark-mode rule a little: a big light page at night"], effort: "M",
        render: () => {
          const ln = (ic, t, tr = "", cls = "") => `<div style="display:flex;gap:10px;align-items:center;height:40px;font-size:14.5px;${cls}">${I(ic, 17)}<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span>${tr}</div>`;
          const hd = (t) => `<div class="hand" style="font-size:26px;line-height:40px;margin-top:8px;color:#B4523A">${t}</div>`;
          return `${nav("Settings")}<div style="padding:4px 16px 30px"><div class="ruled" style="position:relative;padding:12px 18px 18px;border-radius:3px;background-size:100% 40px;background-image:linear-gradient(transparent 39px, rgba(80,120,170,.2) 39px, rgba(80,120,170,.2) 40px);box-shadow:0 1px 2px rgba(60,40,20,.18),0 10px 18px -12px rgba(60,40,20,.5)">
            <span style="position:absolute;top:-10px;right:40px;width:14px;height:44px;border:3px solid #9A9089;border-radius:8px"></span>
            ${hd("Me")}${ln("person", WP.me.email)}${ln("star", "Pro · annual · up to 10 trips")}${ln("disk", "Storage used", `<b>${WP.me.storage}</b>`)}
            ${hd("Maps")}${ln("globe", "Use online map when connected", '<span class="tog"></span>')}
            ${hd("My AI agent")}${ln("link", `<span style="font:12.5px ui-monospace,Menlo,monospace">${WP.mcp}</span>`, I("copy", 16))}${ln("copy", "Copy the Claude Code command", I("chevron", 16))}${ln("sparkle", "Install the Waypack skill", I("chevron", 16))}
            ${hd("Tokens")}${ln("key", `${WP.tokens[0].prefix}… · used ${WP.tokens[0].used}`, I("trash", 16))}${ln("plus", "New token")}
            ${hd("Also")}${ln("shake", "Shake to report feedback", '<span class="tog"></span>')}${ln("shield", "Privacy policy")}${ln("info", "Map data & licenses")}${ln("logout", "Sign out")}${ln("trash", "Delete account", "", "color:#C0432B")}
          </div></div>`;
        },
      },
    ],
  });

  // ═════════════════════════════════════ 14 · Dialogs & toasts
  screen({
    id: "dialog", name: "Confirm & toast", file: "AlertDialog / SnackBar (several screens)",
    variants: [
      { kind: "cur", sbClear: true, render: () => `${curHomeUnder()}<div class="scrim"></div><div class="dlg"><h3>Delete offline copy?</h3><p>Delete the offline copy of "Kyoto fall break"? The trip stays in your account.</p><div class="acts"><span class="txb" style="padding:10px 12px">Cancel</span><span class="fb" style="height:40px">Delete</span></div></div>
          <div class="snack"><span>Deleted offline copy of "Kyoto fall break"</span></div>` },
      {
        kind: "a", name: "Taped note + sticky toast", sbClear: true, tagline: "Confirmations are taped notes; snackbars are small sticky notes",
        concept: "Alerts become a paper note taped over the page, with a handwritten question and two equal pill buttons (destructive in brick red, never the coral primary). Snackbars turn into a yellow sticky note that slides up from the bottom with an inline Undo.",
        moves: ["Dialog = paper note with tape, Caveat title", "Destructive = brick red pill, Cancel = paper pill", "Toast = sticky note, slight tilt, inline action", "Same component for every confirm in the app"],
        needs: ["One shared showPaperDialog / showStickyToast helper"], effort: "S",
        render: () => `${homeUnder()}<div class="scrim"></div><div class="pol dlg tilt-l"><i class="tape t1"></i><h3>Delete offline copy?</h3><p>“Kyoto fall break” stays in your account. You can download it again when you're online.</p><div class="acts"><span class="btn sec">Cancel</span><span class="btn danger">Delete</span></div></div>
          <div class="sticky toast">${I("check", 16, 2.6)}<span class="tx">Deleted offline copy of Kyoto</span><b>Undo</b></div>`,
      },
    ],
  });

  // Flatten into variants with ids and back-links.
  WP.screens = screens;
  WP.variants = [];
  screens.forEach((s, si) => {
    s.n = si + 1;
    s.variants.forEach((v) => {
      v.id = `${s.id}-${v.kind}`;
      v.screen = s;
      v.cls = v.kind === "cur" ? "cur" : "sk";
      if (v.kind === "cur") Object.assign(v, { name: "Current", tagline: "Today's screen (Material 3, blue seed), for comparison", baseline: true, moves: [], needs: [], effort: "—", concept: `What ships today in ${s.file}. Stock Material 3 widgets: app bar, list tiles, cards and bottom sheets in the default blue theme, which no longer matches the scrapbook home.` });
      WP.variants.push(v);
    });
  });
})();

// The shipped home (candidate 02 from the home review), as the anchor of the flow view.
(() => {
  const { icon: I, scene: S, range, ring } = WP;
  const st = (t) => ({
    ready: `<span class="st st-ready">${I("check", 14, 2.6)}</span>`,
    update: `<span class="st st-update">${I("update", 13, 2.4)}<span>Update</span></span>`,
    downloading: `<span class="st st-dl">${ring(t.progress, 26, 3)}</span>`,
    cloud: `<span class="st st-get">Get</span>`,
  })[t.status];
  WP.home = {
    id: "home", name: "Our trips (shipped)", cls: "sk scrap", baseline: true,
    render: () => `
      <div class="top"><div><div class="big">Our trips</div><div class="sub">${WP.upcoming.length} coming up · ${WP.past.length} remembered</div></div><div class="acts"><span>${I("scan", 19)}</span><span>${I("settings", 19)}</span></div></div>
      <div class="grid2">${WP.upcoming.map((t, i) => `<div class="pol r${i % 4}"><i class="tape t${i % 3}"></i><div class="ph">${S(t)}${st(t)}${t.bookmarked ? `<span class="bm">${I("bookmark", 13, 2.4)}</span>` : ""}</div><div class="cap">${t.title}</div><div class="meta">${range(t)}${t.sharedBy ? " · shared" : ""}</div></div>`).join("")}</div>
      <div class="sec">Remember when…</div>
      <div class="grid3">${WP.past.map((t, i) => `<div class="pol sm r${(i + 1) % 4}"><div class="ph">${S(t)}</div><div class="cap">${t.title.split(" ").slice(0, 2).join(" ")}</div><div class="meta">${WP.mon(t.start)} ’${String(WP.year(t.start)).slice(2)}</div></div>`).join("")}</div>
      <div class="foot">synced ${WP.syncedAgo}</div>`,
  };
})();
