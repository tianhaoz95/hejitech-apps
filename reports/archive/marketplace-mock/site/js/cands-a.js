// Candidates 1–5. Each has four renders: m1 phone browse, m2 phone template, w1 web gallery, w2 web template.
// Every render takes { dark } so drawn maps can switch palettes.
(() => {
  const I = WP.icon, esc = WP.esc, T = WP.T, K = WP.byId;
  const S = K.sequoia; // the template every detail screen shows
  WP.cands = WP.cands || [];

  // Shared phone pieces
  WP.navM = (title, sub = "", right = I("search", 18)) =>
    `<div class="nav"><span class="rb">${I("back", 18, 2.4)}</span><div class="tt">${title}${sub ? `<small>${sub}</small>` : ""}</div>${right ? `<span class="rb">${right}</span>` : ""}</div>`;
  WP.mcta = (t, label = "Plan this trip", sub = "Opens your agent with this plan") =>
    `<div class="mcta"><span class="rb">${I("bookmark", 18)}</span><div class="mcta-b">${WP.planBtn("btn block", label)}<small>${sub}</small></div></div>`;
  WP.chipsM = (arr) => `<div class="mchips">${arr.map((x, i) => `<span class="wchip${i === 0 ? " on" : ""}">${x}</span>`).join("")}</div>`;
  const nav = WP.navM, mcta = WP.mcta;
  const chipsM = WP.chipsM;
  const recheck = (t) => `<ul class="rc">${t.recheck.map((r) => `<li>${I("update", 13)}${esc(r)}</li>`).join("")}</ul>`;
  WP.recheck = recheck;
  const daysList = (t, cls = "dl") => `<div class="${cls}">${t.plan.map((d, i) => `<div class="dd"><b style="color:${WP.dayColor(i)}">Day ${i + 1}</b><div><b>${esc(d.t)}</b><small>${d.s.map(esc).join(" · ")}</small></div></div>`).join("")}</div>`;
  WP.daysList = daysList;
  const filtersW = (groups) => `<aside class="wf">${groups.map(([h, opts]) => `<div><h5>${h}</h5>${opts.map((o, i) => `<label><i class="${i === 0 ? "on" : ""}"></i>${o}</label>`).join("")}</div>`).join("")}</aside>`;
  WP.filtersW = filtersW;
  const FILTERS = [["Season", ["Any", "Winter", "Spring", "Summer", "Autumn"]], ["Length", ["Any", "Weekend (2–3 days)", "4–6 days", "A week+"]], ["Who's going", ["Anyone", "With kids", "Couple", "Friends", "With a dog"]], ["Getting around", ["Any", "Car", "No car"]]];
  WP.FILTERS = FILTERS;
  const ctaPanelW = (t, extra = "") => `<div class="wcta">${WP.planBtn("btn block")}<div class="wcta-alt"><span>${I("open", 13)}Open in Claude</span><span>${I("copy", 13)}Copy prompt</span></div>${extra}<p class="mut fine">Your agent asks only what's different (dates, who's coming, pace), then re-checks hours, roads and prices before publishing.</p></div>`;
  WP.ctaPanelW = ctaPanelW;

  // ───────────────────────── 1. Postcard rack
  const pc = (t, rot = 0, big = false) => `
    <div class="c1-pc${big ? " big" : ""}" style="transform:rotate(${rot}deg)">
      <div class="ph">${WP.scene(t)}<span class="c1-st"><i>${WP.MONTHS[t.month]}</i><b>${t.days}d</b></span><span class="pm">${WP.postmark(t, big ? 70 : 44)}</span>${big ? `<span class="c1-greet">Greetings from<b>${esc(t.title.split(" ").slice(0, 1)[0])}</b></span>` : ""}</div>
    </div>`;
  WP.postcard = pc;
  WP.cands.push({
    n: 1, id: "postcards", name: "Postcard rack",
    tagline: "Each template is a postcard: the scene on the front, the travelers' note on the back.",
    concept: "Sharing a good trip is like sending a postcard home, so the gallery is a rack of them. The front is the drawn scene with a stamp (month and length) and a TRAVELED postmark. Tap one and it flips to the back: the handwritten note says what to keep and what to skip, and the address lines become the facts (crew, pace, getting around).",
    moves: ["2-up postcard grid, stamp = month + length", "TRAVELED postmark on every card as the trust signal", "Detail flips to the back: handwritten notes + fact lines", "Web: filter rail + 4-up rack, postcard front/back side by side"],
    pros: ["Instantly reads as \"from a real trip\"", "Fits the scrapbook style the app already uses", "Notes get the spotlight, not just the itinerary"],
    cons: ["Postcards are landscape, so fewer fit per screen than list rows", "Handwritten notes are harder to skim when they get long"],
    effort: "M",
    m1: () => `${nav("Postcards", "Plans from real trips, ready for your agent")}
      ${chipsM(["Any season", "Weekend", "With kids", "Dog OK", "No car"])}
      <div class="c1-grid">${T.slice(0, 8).map((t, i) => `<div>${pc(t, [-1.4, 1.2, 0.8, -0.9][i % 4])}<div class="c1-cap"><b>${esc(t.title)}</b><small>${WP.facts(t)}</small></div></div>`).join("")}</div>`,
    m2: () => `${nav("", "", I("share", 18))}
      <div style="padding:0 20px">${pc(S, -1.2, true)}</div>
      <div class="c1-back tilt-r"><i class="tape t1"></i>
        <div class="c1-msg"><span class="hand">Dear future traveler,</span>${WP.NOTE_KINDS.map(([k]) => S[k].map((n) => `<p class="hand">${esc(n)}</p>`).join("")).join("")}<span class="hand sig">— ${esc(S.author)}</span></div>
        <div class="c1-addr"><div class="c1-stamp2">${WP.postmark(S, 56)}</div>
          <div class="ln"><small>Who</small>${WP.crewTxt(S)}</div><div class="ln"><small>When</small>${S.season}, ${S.days} days</div><div class="ln"><small>Pace</small>${S.pace} · ${S.move}</div><div class="ln"><small>From</small>${S.drive}</div></div>
      </div>
      <div class="h2">The plan <small>${S.places} places</small></div>${daysList(S)}
      <div class="h2">Your agent re-checks</div><div class="p">${recheck(S)}</div>
      ${mcta(S)}`,
    w1: () => WP.web(`
      <div class="wpage c1w">
        <div class="whero"><h1>Postcards from real trips</h1><p>Every plan here was traveled by someone. Pick one and your agent adapts it to you.</p><div class="wsearch">${I("search", 16)}<span>Where to? Try “snow with kids”</span></div></div>
        <div class="wcols">${filtersW(FILTERS)}
          <div class="c1w-grid">${T.map((t, i) => `<div>${pc(t, [-1, 0.8, 1.2, -0.6][i % 4])}<div class="c1-cap"><b>${esc(t.title)}</b><small>${WP.facts(t)} · ${t.remixes} planned from it</small></div></div>`).join("")}</div></div>
      </div>`),
    w2: () => WP.web(`
      <div class="wpage c1w2">
        <div class="wcrumb">Discover › ${esc(S.title)}</div>
        <div class="c1w2-row">
          <div class="c1w2-l">${pc(S, -1.5, true)}
            <div class="c1-back tilt-r" style="margin:26px 0 0"><i class="tape t1"></i><div class="c1-msg"><span class="hand">Dear future traveler,</span>${WP.NOTE_KINDS.map(([k]) => S[k].map((n) => `<p class="hand">${esc(n)}</p>`).join("")).join("")}<span class="hand sig">— ${esc(S.author)}</span></div>
            <div class="c1-addr"><div class="c1-stamp2">${WP.postmark(S, 60)}</div><div class="ln"><small>Who</small>${WP.crewTxt(S)}</div><div class="ln"><small>When</small>${S.season}, ${S.days} days</div><div class="ln"><small>Pace</small>${S.pace} · ${S.move}</div><div class="ln"><small>From</small>${S.drive}</div></div></div></div>
          <div class="c1w2-r"><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><div class="wmeta">${WP.stampT(S)}<span>${WP.remixT(S)}</span></div>
            ${ctaPanelW(S)}<h3 class="hand">The plan</h3>${daysList(S)}<h3 class="hand">Your agent re-checks</h3>${recheck(S)}</div>
        </div>
      </div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 2. Journal shelf
  const spine = (t, h = 150) => `<div class="c2-sp" style="--c:${t.accent};width:${18 + t.days * 5}px;height:${h - (t.id.length % 3) * 10}px"><span>${esc(t.title)}</span>${t.title ? `<i>${t.days}d</i>` : ""}</div>`;
  const SHELVES = [["Winter", ["sequoia", "tahoe"]], ["Spring", ["lisbon", "zion", "maui"]], ["Summer", ["olympic", "smokies"]], ["Autumn", ["kyoto", "iceland"]]];
  const page = (t, d, i) => `<div class="c2-day"><div class="hand c2-dh">Day ${i + 1} — ${esc(d.t)}</div>${d.s.map((s) => `<div class="c2-li">${I("check", 13, 2.6)}<span>${esc(s)}</span></div>`).join("")}</div>`;
  WP.cands.push({
    n: 2, id: "journals", name: "Journal shelf",
    tagline: "Templates are travel journals on shelves sorted by season. Thicker spine = longer trip.",
    concept: "A shelf of travel journals: spines are coloured by the trip's accent and as thick as the trip is long, so a weekend and a two-week trip look different at a glance. Shelves are seasons. Opening one gives a ruled journal page per day, with the travelers' notes stuck on as sticky notes where they happened.",
    moves: ["Shelf per season, spine width = number of days", "Opened journal: ruled paper, one page per day with tabs", "Notes as sticky notes stuck on the relevant day", "Web: bookshelf wall + a \"pulled from the shelf\" preview panel; detail as a two-page spread"],
    pros: ["Most \"keepsake\" feeling; good for inspiration browsing", "Season-first browsing matches how people dream about trips", "Day-by-day journal pages read naturally"],
    cons: ["Spines hide the scene art; you need a tap to see what a trip is", "Weak for searching or comparing many trips", "Rotated text on small spines is hard to read"],
    effort: "L",
    m1: () => `${nav("Trip library", "Journals from real trips")}
      <div class="c2-feat sticky tilt-s"><i class="tape t2"></i><div class="pol" style="width:96px;padding:5px 5px 6px"><div class="ph">${WP.scene(K.iceland)}</div></div><div><small class="mut">Most planned this month</small><b class="hand" style="font-size:26px;display:block">${esc(K.iceland.title)}</b><small>${WP.facts(K.iceland)} · ${K.iceland.remixes} planned from it</small></div></div>
      ${SHELVES.map(([n, ids]) => `<div class="c2-shelf"><div class="c2-row">${ids.map((id) => spine(K[id])).join("")}<div class="c2-bookend"></div></div><div class="c2-plank"></div><div class="c2-lbl hand">${n} <small>${ids.length} journals</small></div></div>`).join("")}`,
    m2: () => `${nav(esc(S.title), `${WP.facts(S)} · traveled ${S.traveled}`, I("share", 18))}
      <div class="c2-book ruled margin"><div class="c2-tabs">${S.plan.map((_, i) => `<span class="${i === 0 ? "on" : ""}" style="--c:${WP.dayColor(i)}">D${i + 1}</span>`).join("")}<span style="--c:#8C7D6E">✎</span></div>
        <div class="c2-cover"><div class="pol tilt-l" style="width:150px"><i class="tape"></i><div class="ph">${WP.scene(S)}</div></div><div class="c2-ov"><span>${WP.crewTxt(S)}</span><span>${S.pace} · ${S.move}</span><span>${S.drive}</span>${WP.stampT(S)}</div></div>
        ${page(S, S.plan[0], 0)}<div class="sticky c2-note tilt-r" style="background:#FFE2D8"><i class="tape t1"></i><b>We'd cut:</b> ${esc(S.cut[0])}</div>${page(S, S.plan[1], 1)}<div class="sticky c2-note tilt-l"><i class="tape t2"></i><b>Kept:</b> ${esc(S.kept[0])}</div>${page(S, S.plan[2], 2)}
      </div>${mcta(S)}`,
    w1: () => WP.web(`
      <div class="wpage c2w"><div class="whero"><h1>The trip library</h1><p>Journals from trips people actually took, shelved by season.</p><div class="wsearch">${I("search", 16)}<span>Search journals</span></div></div>
        <div class="c2w-row"><div class="c2w-wall">${SHELVES.map(([n, ids]) => `<div class="c2-shelf"><div class="c2-row">${ids.map((id) => spine(K[id], 190)).join("")}${ids.map((id) => spine({ ...K[id], id: id + "x", title: "", accent: "#D8C8B0" }, 170)).slice(0, 2).join("")}<div class="c2-bookend"></div></div><div class="c2-plank"></div><div class="c2-lbl hand">${n} <small>${ids.length} journals</small></div></div>`).join("")}</div>
          <aside class="c2w-prev"><small class="mut">Pulled from the shelf</small><div class="pol tilt-l"><i class="tape"></i><div class="ph">${WP.scene(K.kyoto)}</div><div class="cap">${esc(K.kyoto.title)}</div><div class="meta">${WP.facts(K.kyoto)}</div></div><p>${esc(K.kyoto.tagline)}</p><div class="wmeta">${WP.stampT(K.kyoto)}<span>${WP.remixT(K.kyoto)}</span></div>${WP.planBtn("btn block", "Open the journal")}</aside></div></div>`),
    w2: () => WP.web(`
      <div class="wpage c2w2"><div class="wcrumb">Library › Winter › ${esc(S.title)}</div>
        <div class="c2-spread"><div class="c2-pg ruled"><div class="pol tilt-l" style="width:240px;margin:6px auto 18px"><i class="tape"></i><div class="ph">${WP.scene(S)}</div><div class="cap">${esc(S.title)}</div><div class="meta">${S.region}</div></div>
          <div class="c2-ov">${WP.stampT(S)}<span>${WP.crewTxt(S)}</span><span>${S.pace} · ${S.move} · ${S.drive}</span></div>${WP.noteList(S)}${ctaPanelW(S)}</div>
          <div class="c2-pg ruled margin"><div class="c2-tabs v">${S.plan.map((_, i) => `<span class="${i === 0 ? "on" : ""}" style="--c:${WP.dayColor(i)}">D${i + 1}</span>`).join("")}</div>${S.plan.map((d, i) => page(S, d, i)).join("")}<div class="hand c2-dh">Re-check before you go</div>${recheck(S)}</div></div></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 3. Pinboard map
  const mini = (t) => `<div class="c3-card"><div class="pol" style="padding:5px 5px 7px"><div class="ph">${WP.scene(t)}</div><div class="cap" style="font-size:19px">${esc(t.title)}</div><div class="meta">${WP.facts(t)}</div></div></div>`;
  const inView = (t, c, span, W, H) => Math.abs(t.lon - c[0]) < span / 2 && Math.abs(t.lat - c[1]) < (span * H) / W / 2;
  const MC = [-118, 39], MS = 46, WC = [-112, 38], WS = 96;
  const near = T.filter((t) => inView(t, MC, MS, 390, 470));
  WP.cands.push({
    n: 3, id: "pinboard", name: "Pinboard map",
    tagline: "Map first: pins where trips happened, polaroids in a carousel underneath.",
    concept: "Most people start with a place, so the gallery opens on a map. Pins mark trips, and a carousel of polaroids underneath follows whatever the map shows. The template page leads with the route map coloured by day, the same map the trip bundle has offline, with the travelers' notes pinned to the stops they're about.",
    moves: ["Map + carousel of polaroids synced to the viewport", "Pins coloured by trip accent; selected pin turns coral", "Detail: route map coloured by day with notes pinned on it", "Web: Airbnb-style list on the left, map on the right"],
    pros: ["Matches \"where do I want to go\" thinking", "Reuses the offline map strengths the app is known for", "Good when trips cluster in one region"],
    cons: ["A map with few pins looks empty while the gallery is small", "Needs real map tiles on the web (cost) or a stylized map", "Weak for \"I don't know where, just snow with kids\""],
    effort: "L",
    m1: ({ dark }) => `<div class="c3-map">${WP.worldMap({ W: 390, H: 480, center: MC, span: MS, sel: "sequoia", dark, labels: true })}</div>
      <div class="c3-top"><span class="rb">${I("back", 18, 2.4)}</span><div class="c3-search">${I("search", 16)}<span>Search a place</span></div><span class="rb">${I("layers", 18)}</span></div>
      <div class="c3-pop">${WP.pol(S, { meta: WP.facts(S), rot: -2, tape: "t1" })}</div>
      <div class="c3-sheet"><div class="grab"></div><div class="c3-sh"><b class="hand">${near.length} trips in view</b><span class="mut">Most planned ▾</span></div>${WP.chipsM(["Any season", "With kids", "Weekend", "Dog OK"])}<div class="c3-car">${near.map(mini).join("")}</div></div>`,
    m2: ({ dark }) => `<div class="c3-rm">${WP.routeMap(S, { W: 390, H: 330, dark })}<div class="sticky c3-pin tilt-r" style="left:28px;top:150px"><b>Chains!</b> Rent in Three Rivers</div><div class="sticky c3-pin tilt-l" style="right:20px;top:228px;background:#FFE2D8"><b>Skip</b> Moro Rock in winter</div></div>
      <div class="c3-top"><span class="rb">${I("back", 18, 2.4)}</span><span style="flex:1"></span><span class="rb">${I("share", 18)}</span></div>
      <div class="c3-detail"><div class="grab"></div><div class="hand" style="font-size:34px">${esc(S.title)}</div><div class="mut" style="font-size:13px;margin-top:4px">${S.region} · ${WP.facts(S)} · ${WP.crewTxt(S)}</div><div class="wmeta" style="margin-top:10px">${WP.stampT(S)}<span class="mut">${WP.remixT(S)}</span></div>
        <div class="c3-legend">${S.plan.map((d, i) => `<span><i style="background:${WP.dayColor(i)}"></i>Day ${i + 1}</span>`).join("")}</div>
        ${S.plan.map((d, i) => `<div class="c3-day"><b style="color:${WP.dayColor(i)}">Day ${i + 1} · ${esc(d.t)}</b>${d.s.map((s, j) => `<div><span class="num" style="background:${WP.dayColor(i)}">${S.plan.slice(0, i).reduce((a, x) => a + x.s.length, 0) + j + 1}</span>${esc(s)}</div>`).join("")}</div>`).join("")}
        <div class="h2" style="padding-left:0">From the trip</div>${WP.noteList(S)}</div>${mcta(S)}`,
    w1: ({ dark }) => WP.web(`
      <div class="c3w"><div class="c3w-list"><div class="wsearch">${I("search", 16)}<span>Search a place</span></div><div class="mchips" style="padding:12px 0 4px">${["Any season", "With kids", "Weekend", "Dog OK", "No car"].map((x, i) => `<span class="wchip${i === 0 ? " on" : ""}">${x}</span>`).join("")}</div><div class="mut" style="font-size:13px;margin:6px 0 10px">${T.filter((t) => inView(t, WC, WS, 840, 740)).length} trips in this area · Most planned</div>
        ${T.filter((t) => inView(t, WC, WS, 840, 740)).map((t) => `<div class="c3w-row${t.id === "sequoia" ? " on" : ""}"><div class="pol" style="width:118px;padding:5px 5px 6px"><div class="ph">${WP.scene(t)}</div></div><div><b class="hand" style="font-size:24px">${esc(t.title)}</b><small>${t.region}</small><small>${WP.facts(t)} · ${WP.crewTxt(t)}</small><div class="wmeta">${WP.stampT(t)}<span class="mut">${WP.remixT(t)}</span></div></div></div>`).join("")}</div>
        <div class="c3w-map">${WP.worldMap({ W: 840, H: 740, center: WC, span: WS, sel: "sequoia", dark, labels: true })}<div class="c3w-pop">${WP.pol(S, { rot: -2, tape: "t1" })}${WP.planBtn("btn sm block")}</div></div></div>`),
    w2: ({ dark }) => WP.web(`
      <div class="c3w2"><div class="c3w2-map">${WP.routeMap(S, { W: 800, H: 760, dark })}<div class="sticky c3-pin tilt-r" style="left:70px;top:330px"><b>Chains!</b> Rent in Three Rivers, not at the gate</div><div class="sticky c3-pin tilt-l" style="left:420px;top:520px;background:#FFE2D8"><b>Skip</b> Moro Rock: iced over in Jan</div><div class="sticky c3-pin tilt-s" style="left:520px;top:200px;background:#E5F2EA"><b>Best part</b> Ranger snowshoe walk</div><div class="c3-legend fl">${S.plan.map((d, i) => `<span><i style="background:${WP.dayColor(i)}"></i>Day ${i + 1}</span>`).join("")}</div></div>
        <aside class="c3w2-side"><div class="wcrumb">Discover › California</div><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><div class="wmeta">${WP.stampT(S)}<span>${WP.remixT(S)}</span></div><div class="mut" style="font-size:13px;margin:8px 0">${WP.facts(S)} · ${WP.crewTxt(S)} · ${S.drive}</div>${ctaPanelW(S)}
          ${S.plan.map((d, i) => `<div class="c3-day"><b style="color:${WP.dayColor(i)}">Day ${i + 1} · ${esc(d.t)}</b>${d.s.map((s, j) => `<div><span class="num" style="background:${WP.dayColor(i)}">${S.plan.slice(0, i).reduce((a, x) => a + x.s.length, 0) + j + 1}</span>${esc(s)}</div>`).join("")}</div>`).join("")}</aside></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 4. Seasonal almanac
  const fitBar = (t, m) => { const ok = t.months.includes(m); return `<span class="c4-fit ${ok ? "ok" : "no"}">${ok ? (t.month === m ? "Traveled this month" : "Good this month") : "Out of season"}</span>`; };
  const NOW = 0; // January
  WP.cands.push({
    n: 4, id: "almanac", name: "Seasonal almanac",
    tagline: "Browse by month: \"What's good in January?\" The season is the main filter.",
    concept: "A template's season matters more than any other fact (chains, daylight, closures), so the gallery is an almanac. You flip to a month and see plans that suit it, with the month they were actually traveled. The template page has a 12-month strip showing when the plan works, plus notes on what changes in other seasons, which is exactly what the agent re-checks.",
    moves: ["Tear-off calendar header; month strip to flip months", "\"Good this month\" vs \"just out of season\" groups", "Detail: 12-month fit strip + what changes off-season", "Web: big calendar page on the left, plans for the month on the right"],
    pros: ["Makes the season problem visible instead of hiding it", "Great for \"where should we go over winter break?\"", "Gives the agent a clear signal of what to re-check"],
    cons: ["Needs good month data on every template (agents must fill it)", "Place-first users must still search", "Thin months look empty early on"],
    effort: "M",
    m1: () => `${nav("Almanac", "What's good, month by month")}
      <div class="c4-cal"><div class="c4-rings"><i></i><i></i><i></i><i></i></div><div class="c4-mo hand">January</div><small>${T.filter((t) => t.months.includes(NOW)).length} proven plans · winter break, chains, short days</small></div>
      <div class="c4-strip">${WP.MONTHS.map((m, i) => `<span class="${i === NOW ? "on" : ""}">${m}</span>`).join("")}</div>
      <div class="h2">Good in January</div>
      <div class="c4-list">${T.filter((t) => t.months.includes(NOW)).map((t) => `<div class="c4-row card"><div class="pol" style="width:104px;padding:5px 5px 6px;transform:rotate(-2deg)"><div class="ph">${WP.scene(t)}</div></div><div class="tx"><b class="hand" style="font-size:23px">${esc(t.title)}</b><small>${WP.len(t)} · ${t.pace} · ${WP.crewTxt(t)}</small>${WP.monthStrip(t)}${fitBar(t, NOW)}</div></div>`).join("")}</div>
      <div class="h2">Just out of season <small>next month</small></div>
      <div class="c4-list dim">${T.filter((t) => !t.months.includes(NOW)).slice(0, 3).map((t) => `<div class="c4-row card"><div class="pol" style="width:84px;padding:4px 4px 5px"><div class="ph">${WP.scene(t)}</div></div><div class="tx"><b class="hand" style="font-size:21px">${esc(t.title)}</b><small>Best ${t.months.map((m) => WP.MONTHS[m]).join(", ")}</small></div></div>`).join("")}</div>`,
    m2: () => `${nav("", "", I("share", 18))}
      <div style="padding:0 22px">${WP.pol(S, { meta: `${S.region} · ${WP.crewTxt(S)}`, tape: "t2", rot: -1 })}</div>
      <div class="h2">When this plan works</div>
      <div class="c4-year card">${WP.MONTHS.map((m, i) => `<div class="${S.months.includes(i) ? "on" : ""}${i === S.month ? " tr" : ""}"><b>${m}</b>${i === S.month ? `<small>traveled</small>` : ""}</div>`).join("")}</div>
      <div class="c4-key"><span><i class="on"></i>Good</span><span><i class="tr"></i>Traveled</span><span><i></i>Different trip</span></div>
      <div class="sticky tilt-s c4-off"><i class="tape t1"></i><b>Going Apr–Oct instead?</b><p>No chains, Moro Rock and Crystal Cave open, no snowshoe walk. Your agent swaps Day 2 for the Congress Trail and the cave tour.</p></div>
      <div class="h2">The plan</div>${daysList(S)}
      <div class="h2">From the trip</div><div class="p">${WP.noteList(S)}</div>${mcta(S)}`,
    w1: () => WP.web(`
      <div class="wpage c4w"><div class="c4w-row"><div class="c4w-cal"><div class="c4-cal"><div class="c4-rings"><i></i><i></i><i></i><i></i><i></i></div><div class="c4-mo hand">January</div><small>Winter break. Short days, chains in the Sierra, quiet parks.</small></div>
          <div class="c4w-months">${WP.MONTHS.map((m, i) => `<span class="${i === NOW ? "on" : ""}">${m}<small>${T.filter((t) => t.months.includes(i)).length}</small></span>`).join("")}</div>
          <div class="sticky tilt-l" style="margin-top:22px"><i class="tape t2"></i><b>Season matters most.</b> A plan traveled in January won't work the same in July. Your agent re-checks closures and hours for your dates.</div></div>
        <div class="c4w-main"><h2 class="hand">Good in January</h2><div class="c4w-grid">${T.filter((t) => t.months.includes(NOW)).map((t) => `<div class="card c4w-card">${WP.pol(t, { meta: `${WP.len(t)} · ${t.pace}`, rot: 0 })}${WP.monthStrip(t)}${fitBar(t, NOW)}<small class="mut">${WP.crewTxt(t)} · ${t.remixes} planned</small></div>`).join("")}</div>
          <h2 class="hand">Coming up in February</h2><div class="c4w-grid sm">${T.filter((t) => t.months.includes(1) || t.months.includes(2)).slice(0, 4).map((t) => `<div class="card c4w-card">${WP.pol(t, { meta: WP.len(t) })}</div>`).join("")}</div></div></div></div>`),
    w2: () => WP.web(`
      <div class="wpage c4w2"><div class="wcrumb">Almanac › January › ${esc(S.title)}</div><div class="c4w2-row"><div><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><div class="wmeta">${WP.stampT(S)}<span>${WP.remixT(S)}</span><span class="mut">${WP.crewTxt(S)} · ${S.pace} · ${S.drive}</span></div>
        <h3 class="hand">When this plan works</h3><div class="c4-year card wide">${WP.MONTHS.map((m, i) => `<div class="${S.months.includes(i) ? "on" : ""}${i === S.month ? " tr" : ""}"><b>${m}</b>${i === S.month ? `<small>traveled</small>` : S.months.includes(i) ? "<small>good</small>" : "<small>different trip</small>"}</div>`).join("")}</div>
        <div class="c4w2-two"><div class="sticky tilt-s c4-off"><i class="tape t1"></i><b>Going Apr–Oct instead?</b><p>No chains, Moro Rock and Crystal Cave open, no snowshoe walk. Your agent swaps Day 2 for the Congress Trail and the cave tour.</p></div><div class="sticky tilt-r c4-off" style="background:#E5F2EA"><i class="tape"></i><b>December?</b><p>Same plan works. Check the lodge's holiday dates and expect more snow on the Generals Highway.</p></div></div>
        <h3 class="hand">The plan</h3>${daysList(S)}</div>
        <aside>${WP.pol(S, { tape: "t2", rot: 1.5, meta: S.region })}${ctaPanelW(S)}<h3 class="hand">From the trip</h3>${WP.noteList(S)}</aside></div></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 5. Recipe cards
  const recipe = (t, sm = false) => `<div class="c5-rc${sm ? " sm" : ""}"><div class="c5-rh"><b class="hand">${esc(t.title)}</b><span class="c5-dots">${t.tags.slice(0, 3).map((_, i) => `<i style="background:${["#F2A28B", "#A9D3C0", "#F3D27A"][i]}"></i>`).join("")}</span></div>
    <div class="c5-yield"><span><small>Serves</small>${t.crew.adults}${t.crew.kids.length ? ` + ${t.crew.kids.length} kids` : ""}${t.crew.pets ? " + dog" : ""}</span><span><small>Cook</small>${t.days} days</span><span><small>Season</small>${t.season}</span><span><small>Effort</small>${t.pace}</span></div>
    ${sm ? `<p>${esc(t.tagline)}</p><div class="c5-ft"><span>${I("check", 12, 3)}Traveled ${t.traveled}</span><span>${I("sparkle", 12)}${t.remixes}</span></div>` : ""}</div>`;
  const ING = ["Snow chains (rent in Three Rivers)", "Wuksachi Lodge, 2 nights", "Park pass", "Warm layers, hats, gloves", "Offline map (Waypack downloads it)"];
  WP.cands.push({
    n: 5, id: "recipes", name: "Recipe cards",
    tagline: "A template is a recipe: serves, cook time, ingredients (bookings + gear), method (days), cook's notes.",
    concept: "\"Make this trip\" works like \"make this recipe\": the same shape people already know from cooking sites. The yield line shows who it serves and how long it takes. Ingredients are what you need to book or bring. The method is the days. The cook's notes are what the travelers learned. Substitutions are what your agent adapts (other season, no kids, no car).",
    moves: ["Index cards in a box with Weekend / Long weekend / Week+ dividers", "Yield line: serves · days · season · effort", "Ingredients = bookings + gear checklist", "\"Substitutions\" section shows what the agent will adapt"],
    pros: ["Familiar, skimmable structure", "Ingredients list is genuinely useful (bookings, gear)", "\"Substitutions\" explains remixing in a fun way"],
    cons: ["The metaphor can feel cute rather than serious", "Ingredients need new data the agent must produce", "Index cards are text-heavy; less visual inspiration"],
    effort: "M",
    m1: () => `${nav("Trip recipes", "Proven plans you can cook up again")}
      <div class="c5-box"><div class="c5-tabs">${["Weekend", "Long weekend", "Week+"].map((x, i) => `<span class="${i === 0 ? "on" : ""}">${x}</span>`).join("")}</div>
      <div class="c5-stack">${T.filter((t) => t.days <= 4).map((t) => recipe(t, true)).join("")}</div></div>`,
    m2: () => `${nav("", "", I("share", 18))}
      <div class="c5-full">${recipe(S)}<div class="c5-pol">${WP.pol(S, { cap: "", meta: "", tape: "t1", rot: 4 })}</div>
        <div class="c5-sec"><h4>Ingredients</h4>${ING.map((x) => `<div class="c5-ing"><i></i>${esc(x)}</div>`).join("")}</div>
        <div class="c5-sec"><h4>Method</h4>${S.plan.map((d, i) => `<div class="c5-step"><b>${i + 1}</b><div><b>Day ${i + 1}: ${esc(d.t)}</b><small>${d.s.map(esc).join(" → ")}</small></div></div>`).join("")}</div>
        <div class="c5-sec"><h4>Cook's notes</h4>${WP.noteList(S)}</div>
        <div class="c5-sec"><h4>Substitutions</h4><div class="c5-sub"><b>No kids?</b> Swap the sledding hill for the Tokopah Falls snowshoe.</div><div class="c5-sub"><b>April–October?</b> Drop chains, add Moro Rock and Crystal Cave.</div><div class="c5-sub"><b>From LA?</b> Enter from the south; same plan reversed.</div></div>
      </div>${mcta(S, "Cook this trip")}`,
    w1: () => WP.web(`
      <div class="wpage c5w"><div class="whero"><h1>Trip recipes</h1><p>Proven plans with the ingredients, the method and the cook's notes.</p><div class="wsearch">${I("search", 16)}<span>What are you in the mood for?</span></div></div>
        <div class="c5w-cats">${[["Weekend", "#F6C3B2"], ["With kids", "#C5E3D5"], ["No car", "#F7E2A6"], ["Dog friendly", "#C7D9EE"], ["Snow", "#DCCDEB"], ["Beach", "#F6C3B2"]].map(([x, c]) => `<span style="--c:${c}">${x}</span>`).join("")}</div>
        <div class="c5w-grid">${T.map((t) => `<div class="c5w-it">${WP.pol(t, { cap: "", meta: "", rot: [-2, 1.5, -1][t.id.length % 3] })}${recipe(t, true)}</div>`).join("")}</div></div>`),
    w2: () => WP.web(`
      <div class="wpage c5w2"><div class="wcrumb">Recipes › Weekend › ${esc(S.title)}</div><div class="c5w2-top"><div>${WP.pol(S, { cap: "", meta: "", tape: "t1", rot: -2 })}</div><div><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p>${recipe(S)}<div class="wmeta" style="margin-top:12px">${WP.stampT(S)}<span>${WP.remixT(S)}</span><span class="mut">★ ${S.rating} from people who cooked it</span></div>${ctaPanelW(S)}</div></div>
        <div class="c5w2-cols"><div class="c5-sec"><h4>Ingredients</h4>${ING.map((x) => `<div class="c5-ing"><i></i>${esc(x)}</div>`).join("")}<h4 style="margin-top:22px">Substitutions</h4><div class="c5-sub"><b>No kids?</b> Swap the sledding hill for the Tokopah Falls snowshoe.</div><div class="c5-sub"><b>April–October?</b> Drop chains, add Moro Rock and Crystal Cave.</div><div class="c5-sub"><b>From LA?</b> Enter from the south; same plan reversed.</div></div>
          <div class="c5-sec"><h4>Method</h4>${S.plan.map((d, i) => `<div class="c5-step"><b>${i + 1}</b><div><b>Day ${i + 1}: ${esc(d.t)}</b><small>${d.s.map(esc).join(" → ")}</small></div></div>`).join("")}<h4 style="margin-top:22px">Cook's notes</h4>${WP.noteList(S)}</div></div></div>`, { url: "waypack.app/t/sequoia" }),
  });
})();
