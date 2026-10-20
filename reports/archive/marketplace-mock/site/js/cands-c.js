// Direction 11: the owner's combination. Discover home = Travel magazine (06); search = Postcard rack (01)
// with a toggle to Pinboard map (03); the template page combines the postcard with the route map.
// It has eight screens, so it declares its own `screens` list (app.js falls back to m1/m2/w1/w2).
(() => {
  const I = WP.icon, esc = WP.esc, T = WP.T, K = WP.byId;
  const S = K.sequoia, pc = WP.postcard;
  const byPlanned = [...T].sort((a, b) => b.remixes - a.remixes);
  const GRID = '<svg class="ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="1.2"/><rect x="13" y="4" width="8" height="7" rx="1.2"/><rect x="3" y="13" width="8" height="7" rx="1.2"/><rect x="13" y="13" width="8" height="7" rx="1.2"/></svg>';
  const seg = (on) => `<div class="cx-seg"><span class="${on === "pc" ? "on" : ""}">${GRID}Postcards</span><span class="${on === "map" ? "on" : ""}">${I("map", 15)}Map</span></div>`;
  const pcCap = (t, rot = 0, extra = "") => `<div>${pc(t, rot)}<div class="c1-cap"><b>${esc(t.title)}</b><small>${WP.facts(t)}${extra}</small></div></div>`;
  const back = (t) => `<div class="c1-back tilt-r"><i class="tape t1"></i>
      <div class="c1-msg"><span class="hand">Dear future traveler,</span>${WP.NOTE_KINDS.map(([k]) => t[k].map((n) => `<p class="hand">${esc(n)}</p>`).join("")).join("")}<span class="hand sig">— ${esc(t.author)}</span></div>
      <div class="c1-addr"><div class="c1-stamp2">${WP.postmark(t, 56)}</div><div class="ln"><small>Who</small>${WP.crewTxt(t)}</div><div class="ln"><small>When</small>${t.season}, ${t.days} days</div><div class="ln"><small>Pace</small>${t.pace} · ${t.move}</div><div class="ln"><small>From</small>${t.drive}</div></div></div>`;
  const legend = (t, cls = "c3-legend") => `<div class="${cls}">${t.plan.map((d, i) => `<span><i style="background:${WP.dayColor(i)}"></i>Day ${i + 1}</span>`).join("")}</div>`;
  const CHIPS = ["Any season", "Weekend", "With kids", "Dog OK", "No car"];

  // Map framing (same as direction 03): the US West in view on the phone, the whole US + Hawaii on the web.
  const inView = (t, c, span, W, H) => Math.abs(t.lon - c[0]) < span / 2 && Math.abs(t.lat - c[1]) < (span * H) / W / 2;
  const MC = [-118, 39], MS = 46, WC = [-112, 38], WS = 96;
  const nearM = T.filter((t) => inView(t, MC, MS, 390, 480)), nearW = T.filter((t) => inView(t, WC, WS, 760, 680));

  WP.cands.push({
    n: 11, id: "combo", name: "Magazine + postcards + map", mine: true,
    tagline: "Your combination: a magazine home for inspiration, then search as a postcard rack you can flip to a map.",
    concept: "Two moods, two views. The Discover home is the magazine (06): trip of the week, collections and the most-planned chart, for people who don't know where to go yet. The search bar at the top leads to a search view built as the postcard rack (01), with a Postcards / Map toggle that swaps the grid for the pinboard map (03) on the same results and filters. Postcards are used everywhere (collections, results, map carousel), so the three views read as one product. The template page is the postcard: front, the travelers' note on the back, then the route map coloured by day.",
    moves: [
      "Home: masthead, search bar, trip of the week, collections as postcard rows, most planned",
      "Search: one query + filters, shown as a postcard grid or a map. The toggle keeps the results, filters and scroll",
      "Map mode: pins + a postcard carousel synced to the viewport; tapping a pin scrolls the carousel to it",
      "Template: postcard front → back (notes) → route map by day → days → re-checks → Plan this trip",
      "Web: same three views; map mode is a list + map split",
    ],
    pros: ["Covers both \"inspire me\" and \"I know what I want\"", "The toggle means the map isn't empty or forced while the gallery is small", "One object (the postcard) ties home, search and template together", "The magazine can be curated by hand at first and automated later"],
    cons: ["The most screens to build: three browsing views plus the template", "The map needs tiles on the web (or the stylised map shown here)", "Collections still need someone to curate them"],
    effort: "L",
    screens: [["m1", "Phone · 1 · Discover home"], ["m3", "Phone · 2 · Search: postcards"], ["m4", "Phone · 3 · Search: map"], ["m2", "Phone · 4 · Template"],
      ["w1", "Web · 1 · Discover home"], ["w3", "Web · 2 · Search: postcards"], ["w4", "Web · 3 · Search: map"], ["w2", "Web · 4 · Template"]],

    // ── phone: home (magazine)
    m1: () => `<div class="c6-mast"><span class="hand">The Waypack Journal</span><small>Issue 14 · January · trips people actually took</small></div>
      <div class="cx-sbtn">${I("search", 17)}<span>Search places, seasons, who's going</span>${I("map", 17)}</div>
      <div class="c6-hero"><div class="ph">${WP.scene(K.iceland)}</div><div class="c6-ht"><small>TRIP OF THE WEEK</small><b class="hand">${esc(K.iceland.title)}</b><span>As traveled by ${esc(K.iceland.author)} · ${K.iceland.traveled}</span></div></div>
      ${WP.collections.slice(0, 2).map((c) => `<div class="h2">${esc(c.name)} <small>${c.ids.length} trips</small></div><div class="cx-row">${c.ids.map((id, i) => `<div class="cx-it">${pcCap(K[id], i % 2 ? 1 : -1)}</div>`).join("")}<div class="c6-more" style="--c:${c.c}">See all →</div></div>`).join("")}
      <div class="h2">Most planned this month</div><div class="card">${byPlanned.slice(0, 4).map((t, i) => `<div class="row"><b class="hand c6-n">${i + 1}</b><div class="tx">${esc(t.title)}<small>${WP.facts(t)}</small></div><span class="tr">${WP.k(t.remixes)}</span></div>`).join("")}</div>
      <div class="cx-all"><span class="lnk">Browse all ${T.length} trips →</span></div>`,

    // ── phone: search as postcards
    m3: () => `<div class="nav cx-nav"><span class="rb">${I("back", 18, 2.4)}</span><div class="cx-field">${I("search", 16)}<span>Search places, seasons, who's going</span></div></div>
      <div class="cx-tools">${seg("pc")}<span class="cx-flt">${I("layers", 15)}Filters</span></div>
      ${WP.chipsM(CHIPS)}
      <div class="cx-count"><b>${T.length} trips</b><span class="mut">Most planned ▾</span></div>
      <div class="c1-grid">${byPlanned.slice(0, 8).map((t, i) => pcCap(t, [-1.4, 1.2, 0.8, -0.9][i % 4])).join("")}</div>`,

    // ── phone: search as map
    m4: ({ dark }) => `<div class="c3-map" style="height:500px">${WP.worldMap({ W: 390, H: 500, center: MC, span: MS, sel: "sequoia", dark, labels: true })}</div>
      <div class="c3-top"><span class="rb">${I("back", 18, 2.4)}</span><div class="c3-search">${I("search", 16)}<span>Search places, seasons…</span></div></div>
      <div class="cx-floatseg">${seg("map")}</div>
      <div class="c3-sheet" style="top:470px"><div class="grab"></div><div class="c3-sh"><b class="hand">${nearM.length} trips in view</b><span class="mut">Search this area</span></div>${WP.chipsM(CHIPS)}
        <div class="cx-car">${nearM.map((t, i) => `<div class="cx-ci${i === 0 ? " on" : ""}">${pcCap(t)}</div>`).join("")}</div></div>`,

    // ── phone: template (postcard + route)
    m2: ({ dark }) => `${WP.navM("", "", I("share", 18))}
      <div style="padding:0 20px">${pc(S, -1.2, true)}</div>
      <div class="cx-meta">${WP.stampT(S)}<span class="mut">${WP.remixT(S)}</span></div>
      ${back(S)}
      <div class="h2">The route <small>${S.places} places · ${S.drive}</small></div>
      <div class="cx-route">${WP.routeMap(S, { W: 354, H: 190, dark })}${legend(S, "c3-legend fl")}</div>
      <div class="h2">Day by day</div>${WP.daysList(S)}
      <div class="h2">Your agent re-checks</div><div class="p">${WP.recheck(S)}</div>
      ${WP.mcta(S)}`,

    // ── web: home (magazine)
    w1: () => WP.web(`
      <div class="wpage c6w"><div class="cx-whead"><div class="c6-mast w"><span class="hand">The Waypack Journal</span><small>Issue 14 · January · trips people actually took</small></div>
        <div class="cx-wsearch"><div class="wsearch">${I("search", 16)}<span>Search places, seasons, who's going</span></div><span class="cx-hint">Browse all ${T.length} as ${GRID}postcards or ${I("map", 14)}a map</span></div></div>
        <div class="c6w-top"><div class="c6-hero w"><div class="ph">${WP.scene(K.iceland)}</div><div class="c6-ht"><small>TRIP OF THE WEEK</small><b class="hand">${esc(K.iceland.title)}</b><span>“${esc(K.iceland.kept[0])}” · ${esc(K.iceland.author)}</span></div></div>
          <div class="c6w-side">${[K.kyoto, K.sequoia].map((t) => `<div class="c6w-f"><div>${pc(t, -1)}</div><div><small class="c6-kick">${t.id === "kyoto" ? "NO CAR NEEDED" : "SNOW WITH LITTLE KIDS"}</small><b class="hand">${esc(t.title)}</b><span class="mut">${esc(t.tagline)}</span></div></div>`).join("")}<div class="card c6w-chart"><b class="hand" style="font-size:24px">Most planned this month</b>${byPlanned.slice(0, 5).map((t, i) => `<div><b class="hand">${i + 1}</b><span>${esc(t.title)}</span><small>${WP.k(t.remixes)}</small></div>`).join("")}</div></div></div>
        ${WP.collections.map((c) => `<div class="c6w-col"><h2 class="hand">${esc(c.name)}</h2><span class="mut">See all →</span></div><div class="c6w-row">${c.ids.map((id, i) => pcCap(K[id], i % 2 ? 1 : -1, ` · ${K[id].remixes} planned`)).join("")}<div class="c6-more w" style="--c:${c.c}">${c.ids.length + 6} more</div></div>`).join("")}</div>`),

    // ── web: search as postcards
    w3: () => WP.web(`
      <div class="wpage"><div class="cx-wbar"><div class="wsearch">${I("search", 16)}<span>Search places, seasons, who's going</span></div>${seg("pc")}<span class="mut cx-sort">${T.length} trips · Most planned ▾</span></div>
        <div class="wcols">${WP.filtersW(WP.FILTERS)}<div class="c1w-grid">${byPlanned.map((t, i) => pcCap(t, [-1, 0.8, 1.2, -0.6][i % 4], ` · ${t.remixes} planned`)).join("")}</div></div></div>`, { url: "waypack.app/trips/search" }),

    // ── web: search as map
    w4: ({ dark }) => WP.web(`
      <div class="cx-wbar pad"><div class="wsearch">${I("search", 16)}<span>Search places, seasons, who's going</span></div>${seg("map")}<div class="mchips">${CHIPS.slice(0, 4).map((x, i) => `<span class="wchip${i === 0 ? " on" : ""}">${x}</span>`).join("")}</div></div>
      <div class="c3w cx-split"><div class="c3w-list"><div class="mut" style="font-size:13px;margin:0 0 10px">${nearW.length} trips in this area · Most planned</div>
        ${nearW.map((t) => `<div class="c3w-row${t.id === "sequoia" ? " on" : ""}"><div style="width:150px;flex:none">${pc(t)}</div><div><b class="hand" style="font-size:24px">${esc(t.title)}</b><small>${t.region}</small><small>${WP.facts(t)} · ${WP.crewTxt(t)}</small><div class="wmeta">${WP.remixT(t)}</div></div></div>`).join("")}</div>
        <div class="c3w-map">${WP.worldMap({ W: 840, H: 680, center: WC, span: WS, sel: "sequoia", dark, labels: true })}<div class="c3w-pop cx-pop">${pc(S, -2)}<div class="c1-cap"><b>${esc(S.title)}</b><small>${WP.facts(S)}</small></div>${WP.planBtn("btn sm block", "Open")}</div><span class="cx-area">${I("search", 13)}Search this area</span></div></div>`, { url: "waypack.app/trips/search?view=map" }),

    // ── web: template
    w2: ({ dark }) => WP.web(`
      <div class="wpage c1w2"><div class="wcrumb">Discover › Search › ${esc(S.title)}</div>
        <div class="c1w2-row"><div class="c1w2-l">${pc(S, -1.5, true)}${back(S)}</div>
          <div class="c1w2-r"><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><div class="wmeta">${WP.stampT(S)}${WP.remixT(S)}<span class="mut">${WP.crewTxt(S)} · ${S.pace} · ${S.drive}</span></div>
            ${WP.ctaPanelW(S)}<h3 class="hand">The route</h3><div class="cx-route w">${WP.routeMap(S, { W: 600, H: 260, dark })}${legend(S, "c3-legend fl")}</div>
            <h3 class="hand">Day by day</h3>${WP.daysList(S)}<h3 class="hand">Your agent re-checks</h3>${WP.recheck(S)}</div></div></div>`, { url: "waypack.app/t/sequoia" }),
  });
})();
