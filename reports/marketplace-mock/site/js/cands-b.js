// Candidates 6–10 (same four renders as cands-a.js).
(() => {
  const I = WP.icon, esc = WP.esc, T = WP.T, K = WP.byId;
  const S = K.sequoia;
  const nav = WP.navM, mcta = WP.mcta, chipsM = WP.chipsM, ctaPanelW = WP.ctaPanelW;
  const byPlanned = [...T].sort((a, b) => b.remixes - a.remixes);

  // ───────────────────────── 6. Magazine
  WP.cands.push({
    n: 6, id: "magazine", name: "Travel magazine",
    tagline: "Editorial: a trip of the week, themed collections, and templates read like short articles.",
    concept: "Curation over search: a masthead, a featured trip of the week, and collections like \"Snow with little kids\" or \"No car needed\". The template page reads like a magazine piece. The best lesson from the trip becomes the pull quote, the days are short sections, and a facts box plus the Plan button stay in the side rail.",
    moves: ["\"Trip of the week\" hero with byline \"as traveled by…\"", "Collections as horizontal rows", "Pull quote = the best lesson from the trip", "\"Most planned this month\" numbered chart"],
    pros: ["Most inspiring; best for people who don't know where to go", "Collections make even a few templates feel full", "Shareable and good for search engines"],
    cons: ["Needs ongoing curation (picking features, naming collections)", "Long-form detail is slower to scan before planning", "Less personal than the scrapbook objects"],
    effort: "M",
    m1: () => `<div class="c6-mast"><span class="hand">The Waypack Journal</span><small>Issue 14 · January · trips people actually took</small></div>
      <div class="c6-hero"><div class="ph">${WP.scene(K.iceland)}</div><div class="c6-ht"><small>TRIP OF THE WEEK</small><b class="hand">${esc(K.iceland.title)}</b><span>As traveled by ${esc(K.iceland.author)} · ${K.iceland.traveled}</span></div></div>
      ${WP.collections.slice(0, 2).map((c) => `<div class="h2">${esc(c.name)} <small>${c.ids.length} trips</small></div><div class="c6-row">${c.ids.map((id) => `<div class="c6-it">${WP.pol(K[id], { meta: WP.facts(K[id]), rot: 0 })}</div>`).join("")}<div class="c6-more" style="--c:${c.c}">See all →</div></div>`).join("")}
      <div class="h2">Most planned this month</div><div class="card">${byPlanned.slice(0, 4).map((t, i) => `<div class="row"><b class="hand c6-n">${i + 1}</b><div class="tx">${esc(t.title)}<small>${WP.facts(t)}</small></div><span class="tr">${WP.k(t.remixes)}</span></div>`).join("")}</div><div style="height:30px"></div>`,
    m2: () => `<div class="c6-full"><div class="ph">${WP.scene(S)}</div></div>
      <div class="c6-top"><span class="rb">${I("back", 18, 2.4)}</span><span style="flex:1"></span><span class="rb">${I("bookmark", 18)}</span><span class="rb">${I("share", 18)}</span></div>
      <article class="c6-art"><small class="c6-kick">SNOW WITH LITTLE KIDS</small><h1 class="hand">${esc(S.title)}</h1><p class="c6-dek">${esc(S.tagline)}</p><div class="c6-by">By ${esc(S.author)} · traveled ${S.traveled} · ${S.remixes} planned from it</div>
        <div class="c6-facts">${[["Days", S.days], ["Pace", S.pace], ["Who", `${S.crew.adults}+${S.crew.kids.length} kids`], ["From", "SF, 4h"]].map(([a, b]) => `<span><small>${a}</small>${b}</span>`).join("")}</div>
        <blockquote class="hand">“${esc(S.kept[0].split(".")[0])}.”</blockquote>
        ${S.plan.map((d, i) => `<h3>Day ${i + 1}. ${esc(d.t)}</h3><p>${d.s.map(esc).join(", ")}. ${i === 0 ? esc(S.surprise[0]) : i === 1 ? esc(S.kept[0]) : esc(S.cut[0])}</p>`).join("")}
        <h3>Before you go</h3><p>${esc(S.surprise[1])} Your agent re-checks: ${S.recheck.map(esc).join(", ").toLowerCase()}.</p></article>${mcta(S)}`,
    w1: () => WP.web(`
      <div class="wpage c6w"><div class="c6-mast w"><span class="hand">The Waypack Journal</span><small>Issue 14 · January · trips people actually took</small></div>
        <div class="c6w-top"><div class="c6-hero w"><div class="ph">${WP.scene(K.iceland)}</div><div class="c6-ht"><small>TRIP OF THE WEEK</small><b class="hand">${esc(K.iceland.title)}</b><span>“${esc(K.iceland.kept[0])}” · ${esc(K.iceland.author)}</span></div></div>
          <div class="c6w-side">${[K.kyoto, K.sequoia].map((t) => `<div class="c6w-f"><div class="ph">${WP.scene(t)}</div><div><small class="c6-kick">${t.id === "kyoto" ? "NO CAR NEEDED" : "SNOW WITH LITTLE KIDS"}</small><b class="hand">${esc(t.title)}</b><span class="mut">${esc(t.tagline)}</span></div></div>`).join("")}<div class="card c6w-chart"><b class="hand" style="font-size:24px">Most planned this month</b>${byPlanned.slice(0, 5).map((t, i) => `<div><b class="hand">${i + 1}</b><span>${esc(t.title)}</span><small>${WP.k(t.remixes)}</small></div>`).join("")}</div></div></div>
        ${WP.collections.map((c) => `<div class="c6w-col"><h2 class="hand">${esc(c.name)}</h2><span class="mut">See all →</span></div><div class="c6w-row">${c.ids.map((id) => `<div>${WP.pol(K[id], { meta: `${WP.facts(K[id])} · ${K[id].remixes} planned` })}</div>`).join("")}<div class="c6-more w" style="--c:${c.c}">${c.ids.length + 6} more</div></div>`).join("")}</div>`),
    w2: () => WP.web(`
      <div class="c6w2"><div class="c6w2-hero"><div class="ph">${WP.scene(S)}</div><div class="c6w2-ht"><small class="c6-kick">SNOW WITH LITTLE KIDS</small><h1 class="hand">${esc(S.title)}</h1><p>${esc(S.tagline)}</p></div></div>
        <div class="c6w2-body"><article class="c6-art w"><div class="c6-by">By ${esc(S.author)} · traveled ${S.traveled} · ${S.remixes} planned from it</div><blockquote class="hand">“${esc(S.kept[0].split(".")[0])}.”</blockquote>
          ${S.plan.map((d, i) => `<h3>Day ${i + 1}. ${esc(d.t)}</h3><p>${d.s.map(esc).join(", ")}. ${i === 0 ? esc(S.surprise[0]) : i === 1 ? esc(S.kept[0]) : esc(S.cut[0])}</p>`).join("")}<h3>What we'd do differently</h3><p>${esc(S.cut[1])} ${esc(S.surprise[1])}</p></article>
          <aside class="c6w2-rail"><div class="c6-facts v">${[["Days", S.days], ["Season", `${S.season} (${WP.MONTHS[S.month]})`], ["Pace", S.pace], ["Who", WP.crewTxt(S)], ["Getting around", `${S.move}, ${S.drive}`]].map(([a, b]) => `<span><small>${a}</small>${b}</span>`).join("")}</div>${ctaPanelW(S)}<h4>Your agent re-checks</h4>${WP.recheck(S)}</aside></div></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 7. Ticket finder (search-first)
  const tk = (t, wide = false) => `<div class="ticket c7-tk${wide ? " w" : ""}"><div class="stub"><b>${t.days}</b><small>DAYS</small><small class="c7-mo">${WP.MONTHS[t.month].toUpperCase()}</small></div>
    <div class="bd"><b>${esc(t.title)}</b><small>${t.region}</small><div class="c7-ln">${WP.crewIc(t, 12)}<span>${t.pace}</span><span>${t.move}</span></div>${wide ? `<div class="c7-tags">${t.tags.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}</div>
    <div class="c7-r"><b>${WP.k(t.remixes)}</b><small>planned</small>${wide ? `<span class="c7-tr">${I("check", 11, 3)}${t.traveled}</span>` : ""}</div></div>`;
  WP.cands.push({
    n: 7, id: "tickets", name: "Ticket finder",
    tagline: "Search first: structured filters and dense ticket-stub results, like booking a flight.",
    concept: "For people who know roughly what they want: a search box plus structured filters (season, days, crew, pace, car or no car) and compact results as ticket stubs you can scan quickly. The template page opens with a boarding-pass summary (to, days, season, crew, pace), then each day as a ticket. Utility first, with the scrapbook kept to the objects.",
    moves: ["Search + structured filter chips with counts", "Ticket stubs: days + month on the stub, crew icons, planned count", "Boarding-pass header on the template page", "Web: filter rail + wide tickets you can sort and compare"],
    pros: ["Fastest to find a match; scales to thousands of templates", "Filters map 1:1 to template metadata", "Easy to build and test"],
    cons: ["Least inspiring, so it gives no reason to browse", "Notes from the trip are pushed down", "Looks like every other travel search"],
    effort: "S",
    m1: () => `${nav("Find a trip", "", "")}
      <div class="c7-search"><div class="c7-in">${I("search", 17)}<span>Where to? Snow, beach, a city…</span></div><div class="c7-filters">${[["Season", ""], ["Days", ""], ["Kids", ""], ["Dog", ""], ["No car", ""]].map(([a, b]) => `<span class="${b ? "on" : ""}">${a}${b ? `: ${b}` : ""}</span>`).join("")}</div></div>
      <div class="c7-head"><b>${T.length} plans</b><span class="mut">Most planned ▾</span></div>
      <div class="c7-list">${byPlanned.map((t) => tk(t)).join("")}</div>`,
    m2: () => `${nav("", "", I("share", 18))}
      <div class="c7-bp"><div class="c7-bp-top"><div><small>TO</small><b>Sequoia NP</b><span>${S.region}</span></div>${I("nav", 22, 2)}<div class="r"><small>FROM</small><b>SF Bay</b><span>${S.drive}</span></div></div>
        <div class="c7-bp-g">${[["DAYS", S.days], ["SEASON", WP.MONTHS[S.month]], ["CREW", `${S.crew.adults}+${S.crew.kids.length}`], ["PACE", S.pace]].map(([a, b]) => `<span><small>${a}</small><b>${b}</b></span>`).join("")}</div>
        <div class="c7-bp-f"><div class="c7-bc"></div>${WP.stampT(S)}</div></div>
      <div class="h2">Itinerary</div><div class="trail">${S.plan.map((d, i) => `<div class="ticket"><div class="stub"><b>D${i + 1}</b><small>${d.s.length} stops</small></div><div class="bd"><b>${esc(d.t)}</b><small>${d.s.map(esc).join(" · ")}</small></div></div>`).join("")}</div>
      <div class="h2">Notes</div><div class="p">${WP.noteList(S)}</div>${mcta(S)}`,
    w1: () => WP.web(`
      <div class="wpage c7w"><div class="c7w-bar"><div class="c7-in w">${I("search", 18)}<span>Where to? Snow, beach, a city…</span></div><div class="c7-seg">${[["Season", "Any"], ["Days", "Any"], ["Who", "Anyone"], ["Getting around", "Any"]].map(([a, b]) => `<span><small>${a}</small><b>${b}</b></span>`).join("")}</div><span class="btn">Search</span></div>
        <div class="wcols">${WP.filtersW(WP.FILTERS)}<div><div class="c7-head w"><b>${T.length} plans</b><span class="mut">Sort: Most planned ▾</span></div><div class="c7w-list">${byPlanned.map((t) => tk(t, true)).join("")}</div></div></div></div>`),
    w2: () => WP.web(`
      <div class="wpage c7w2"><div class="wcrumb">Find a trip › ${esc(S.title)}</div>
        <div class="c7-bp w"><div class="c7-bp-top"><div><small>TO</small><b>Sequoia National Park</b><span>${S.region}</span></div>${I("nav", 26, 2)}<div class="r"><small>FROM</small><b>SF Bay Area</b><span>${S.drive}</span></div>${[["DAYS", S.days], ["SEASON", `${S.season} · ${WP.MONTHS[S.month]}`], ["CREW", WP.crewTxt(S)], ["PACE", S.pace]].map(([a, b]) => `<span class="g"><small>${a}</small><b>${b}</b></span>`).join("")}<div class="c7-bc v"></div></div></div>
        <div class="c7w2-cols"><div><h3>Itinerary</h3><div class="trail">${S.plan.map((d, i) => `<div class="ticket"><div class="stub"><b>D${i + 1}</b><small>${d.s.length} stops</small></div><div class="bd"><b>${esc(d.t)}</b><small>${d.s.map(esc).join(" · ")}</small></div></div>`).join("")}</div><h3>Notes from the trip</h3>${WP.noteList(S)}</div>
          <aside>${WP.stampT(S)}<div class="mut" style="margin:8px 0 4px">${WP.remixT(S)}</div>${ctaPanelW(S)}<h4>Your agent re-checks</h4>${WP.recheck(S)}</aside></div></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 8. Ask your agent
  const why = (t, reasons, pct) => `<div class="sticky c8-res tilt-${["l", "r", "s"][t.id.length % 3]}" style="background:${["#FFF6C9", "#E5F2EA", "#FFE2D8"][t.id.length % 3]}"><i class="tape t${t.id.length % 3}"></i><div class="c8-rh"><div class="pol" style="width:74px;padding:4px 4px 5px"><div class="ph">${WP.scene(t)}</div></div><div><b class="hand" style="font-size:23px;line-height:1">${esc(t.title)}</b><small>${WP.facts(t)} · ${t.remixes} planned</small></div><span class="c8-m">${pct}%</span></div><div class="c8-why">${reasons.map((r) => `<span>${I("check", 11, 3)}${r}</span>`).join("")}</div></div>`;
  const KCR = [["Keeps", "#4F8A62", ["Day order and pacing (tested with kids 9 & 6)", "Places + coordinates (14)", "The lessons: book the snowshoe walk, rent chains early"]], ["Changes", "#B87810", ["Your dates, crew and start city", "Lodging for your budget"]], ["Re-checks", "#3E7A8C", S.recheck]];
  WP.cands.push({
    n: 8, id: "agent", name: "Ask your agent",
    tagline: "No browsing needed: describe the trip, get proven templates ranked with \"why it fits\".",
    concept: "Since the agent does the planning anyway, lead with a prompt. Describe what you want and the gallery returns matching templates with the reasons each one fits (same thing the agent's search_templates tool would see). The template page says plainly what your agent will keep, change and re-check, and shows the hand-off prompt with Open in Claude / Copy.",
    moves: ["Prompt box on a sticky note, example prompts as chips", "Results with match % and \"why it fits\" ticks", "Keep / change / re-check breakdown on the template page", "Hand-off panel: prompt preview, Open in Claude, Copy"],
    pros: ["Matches the product's agent-first promise", "Same ranking powers the MCP search tool", "Explains the token and iteration savings honestly"],
    cons: ["Needs a server-side model or embeddings for ranking (cost)", "Less browsing and inspiration", "Match % can feel made up if it isn't explained"],
    effort: "L",
    m1: () => `${nav("Ask for a trip", "Proven plans that fit what you describe", "")}
      <div class="c8-ask sticky tilt-s"><i class="tape"></i><span class="hand">3 snowy days with our kids (9 &amp; 6), max 4 hours from SF, in January</span><span class="c8-go">${I("send", 16, 2.4)}</span></div>
      <div class="c8-ex">${["Week in Japan, no car", "Dog-friendly beaches", "Couple's long weekend in Europe"].map((x) => `<span>${x}</span>`).join("")}</div>
      <div class="h2">3 proven trips fit <small>sorted by fit</small></div>
      <div class="c8-list">${why(S, ["Snow in January", "Kids 9 & 6", "4 h from SF"], 96)}${why(K.tahoe, ["Snow", "Kids 9 & 6", "3.5 h from SF"], 88)}${why(K.smokies, ["Kids", "Weekend length"], 41)}</div>`,
    m2: () => `${nav(esc(S.title), `${WP.facts(S)} · traveled ${S.traveled}`, I("share", 18))}
      <div style="padding:0 22px 6px">${WP.pol(S, { cap: "", meta: "", tape: "t1", ratio: "1/.55" })}</div>
      <div class="h2">Your agent will</div>
      <div class="c8-kcr">${KCR.map(([h, c, items]) => `<div class="card"><b style="color:${c}">${h}</b>${items.map((x) => `<div>${esc(x)}</div>`).join("")}</div>`).join("")}</div>
      <div class="c8-save sticky tilt-r" style="background:#E5F2EA"><i class="tape t1"></i><b>About 3 questions instead of 15.</b> The places, order and pace are already decided, so it mostly checks facts for your dates.</div>
      <div class="h2">Hand-off</div><div class="p"><div class="code"><span>${esc(WP.prompt(S))}</span>${I("copy", 14)}</div></div>
      <div class="mcta"><div class="mcta-b" style="flex:1">${WP.planBtn("btn block", "Open in Claude")}<small>or copy the prompt into any agent</small></div></div>`,
    w1: () => WP.web(`
      <div class="wpage c8w"><div class="c8w-c"><h1 class="hand">What kind of trip?</h1><p class="mut">Describe it. We'll find plans people actually traveled that fit.</p>
        <div class="c8-ask sticky tilt-s w"><i class="tape"></i><span class="hand">3 snowy days with our kids (9 &amp; 6), max 4 hours from SF, in January</span><span class="c8-go">${I("send", 18, 2.4)}</span></div>
        <div class="c8-ex">${["Week in Japan, no car", "Dog-friendly beaches", "Couple's long weekend in Europe", "Big hikes, no permits"].map((x) => `<span>${x}</span>`).join("")}</div></div>
        <div class="c8w-res"><h2 class="hand">3 proven trips fit</h2><div class="c8w-grid">${why(S, ["Snow in January", "Kids 9 & 6", "4 h from SF"], 96)}${why(K.tahoe, ["Snow", "Kids 9 & 6", "3.5 h from SF"], 88)}${why(K.smokies, ["Kids", "Weekend length"], 41)}</div>
        <p class="mut" style="margin-top:22px">Your agent can run this same search for you: it calls <code>search_templates</code> while it interviews you.</p></div></div>`),
    w2: () => WP.web(`
      <div class="wpage c8w2"><div class="wcrumb">Ask › “3 snowy days with our kids…” › ${esc(S.title)}</div><div class="c8w2-cols">
        <div><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><div class="wmeta">${WP.stampT(S)}<span>${WP.remixT(S)}</span><span class="mut">${WP.facts(S)} · ${WP.crewTxt(S)}</span></div>
          <div class="c8w2-two">${WP.pol(S, { cap: "", meta: "", tape: "t1" })}<div>${WP.daysList(S)}</div></div><h3 class="hand">From the trip</h3>${WP.noteList(S)}</div>
        <aside class="c8w2-hand"><h3 class="hand">Hand it to your agent</h3><div class="c8-kcr">${KCR.map(([h, c, items]) => `<div class="card"><b style="color:${c}">${h}</b>${items.map((x) => `<div>${esc(x)}</div>`).join("")}</div>`).join("")}</div>
          <div class="code" style="margin:14px 0"><span style="white-space:normal">${esc(WP.prompt(S))}</span></div><div class="c8w2-btns">${WP.planBtn("btn", "Open in Claude")}<span class="btn sec">${I("copy", 15)}Copy prompt</span></div><p class="mut fine">Works in any agent with the Waypack MCP server. About 3 questions instead of 15.</p></aside></div></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 9. Proven (plan vs. what happened)
  const pvr = (t) => `<div class="c9-pvr ruled">${t.plan.map((d, i) => `<div class="c9-d"><b class="hand">Day ${i + 1} · ${esc(d.t)}</b>${d.s.map((s) => `<div class="c9-i">${I("check", 13, 2.8)}${esc(s)}</div>`).join("")}${i === 0 ? `<div class="c9-i cut">${I("x", 13, 2.8)}<s>Moro Rock</s><span class="hand c9-why">iced over, closed</span></div>` : ""}${i === 1 ? `<div class="c9-i add">${I("plus", 13, 2.8)}<span class="hand">Snow play at Lodgepole: kids' favourite</span></div><div class="c9-i cut">${I("x", 13, 2.8)}<s>Crystal Cave tour</s><span class="hand c9-why">closed all winter</span></div>` : ""}</div>`).join("")}</div>`;
  const score = (t) => `<div class="c9-score"><span><b>${t.places - 2}</b><small>of ${t.places} stops done</small></span><span><b>2</b><small>cut</small></span><span><b>1</b><small>added</small></span><span><b>${t.wouldAgain ? "Yes" : "No"}</b><small>would go again</small></span></div>`;
  WP.cands.push({
    n: 9, id: "proven", name: "Proven trips",
    tagline: "Trust first: every template shows the plan next to what actually happened.",
    concept: "A template's value is that it was tested, so this direction shows the test. Cards show stops done vs. planned, what was cut and added, and \"would go again\". The template page is the itinerary annotated after the trip: crossed-out stops with the reason, handwritten additions, margin notes. The agent plans from the corrected version.",
    moves: ["Trust row on every card: done/planned, cut, added, would go again", "Itinerary marked up: struck-through cuts, handwritten adds", "\"How we know\" note: postmark only after the trip's dates passed + a debrief", "Web: annotated itinerary + trust panel"],
    pros: ["Most honest and most useful for the agent", "Turns the post-trip debrief into the main feature", "Hard to fake, so it resists spam"],
    cons: ["Needs a debrief after every trip (more agent work, more friction)", "Annotated lists can look messy", "Fewer templates qualify"],
    effort: "M",
    m1: () => `${nav("Proven trips", "Every plan here was actually traveled")}
      <div class="sticky tilt-s c9-how"><i class="tape t1"></i><b>How we know:</b> the trip's dates have passed and the travelers told their agent what they kept, cut and added.</div>
      ${chipsM(["Most proven", "With kids", "Winter", "Weekend"])}
      <div class="c9-list">${byPlanned.slice(0, 5).map((t, i) => `<div class="card c9-card"><div class="pol" style="width:96px;padding:5px 5px 6px;transform:rotate(${i % 2 ? 2 : -2}deg)"><div class="ph">${WP.scene(t)}</div></div><div class="tx"><b class="hand" style="font-size:22px">${esc(t.title)}</b><small>${WP.facts(t)}</small><div class="c9-bar"><i style="width:${88 - i * 4}%"></i></div><small>${t.places - 2}/${t.places} stops done · 2 cut · 1 added</small><div class="c9-ft">${WP.stampT(t)}<span>${I("heart", 12)}again</span></div></div></div>`).join("")}</div>`,
    m2: () => `${nav(esc(S.title), `${WP.facts(S)} · ${WP.crewTxt(S)}`, I("share", 18))}
      <div class="c9-trust"><div class="c9-pm">${WP.postmark(S, 78)}</div>${score(S)}</div>
      <div class="h2">The plan, after the trip</div><div style="padding:0 18px">${pvr(S)}</div>
      <div class="h2">Surprised us</div><div class="p">${S.surprise.map((s) => `<div class="sticky tilt-${s.length % 2 ? "l" : "r"}" style="margin:6px 0 12px"><i class="tape t2"></i>${esc(s)}</div>`).join("")}</div>
      ${mcta(S, "Plan from the tested version", "Your agent starts from what actually worked")}`,
    w1: () => WP.web(`
      <div class="wpage c9w"><div class="whero"><h1>Proven trips</h1><p>Every plan here was actually traveled, with what worked and what didn't.</p></div>
        <div class="c9w-how">${[["1", "Trip happens", "Its dates have passed"], ["2", "Debrief", "The travelers tell their agent what they kept, cut and added"], ["3", "Owner reviews", "Personal details removed, preview approved"], ["4", "Proven", "Gets the TRAVELED postmark"]].map(([n, a, b]) => `<div><b class="hand">${n}</b><span><b>${a}</b><small>${b}</small></span></div>`).join("")}</div>
        <div class="c9w-grid">${byPlanned.map((t, i) => `<div class="card c9w-card">${WP.pol(t, { meta: WP.facts(t) })}<div class="c9-bar"><i style="width:${90 - (i % 5) * 4}%"></i></div><small>${t.places - 2}/${t.places} stops done · 2 cut · 1 added</small><div class="c9-ft">${WP.stampT(t)}<span>${I("heart", 12)}would go again</span></div></div>`).join("")}</div></div>`),
    w2: () => WP.web(`
      <div class="wpage c9w2"><div class="wcrumb">Proven trips › ${esc(S.title)}</div><div class="c9w2-cols"><div><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><h3 class="hand">The plan, after the trip</h3>${pvr(S)}</div>
        <aside><div class="c9-trust w"><div class="c9-pm">${WP.postmark(S, 92)}</div>${score(S)}</div><div class="mut" style="margin:10px 0">${WP.remixT(S)} · ${WP.crewTxt(S)} · ${S.pace}</div>${ctaPanelW(S)}<h4>Surprised us</h4>${S.surprise.map((s) => `<div class="sticky tilt-s" style="margin:8px 0 14px"><i class="tape t2"></i>${esc(s)}</div>`).join("")}</aside></div></div>`, { url: "waypack.app/t/sequoia" }),
  });

  // ───────────────────────── 10. Someday deck
  const shots = (t) => t.plan.map((d, i) => `<div class="pol c10-shot" style="transform:rotate(${[-2, 1.5, -1][i % 3]}deg)"><div class="ph">${WP.scene({ ...t, scene: { ...t.scene, sun: ["sun", "low-sun", "moon"][i % 3] } })}</div><div class="cap">Day ${i + 1}</div><div class="meta">${esc(d.t)}</div></div>`).join("");
  WP.cands.push({
    n: 10, id: "someday", name: "Someday deck",
    tagline: "Swipe polaroids into a \"Someday\" list on the phone; a mood board on the web.",
    concept: "For daydreaming. On the phone you flip through big polaroids one at a time: Skip, Someday or Plan now. Someday trips collect on a board and are a quick start the next time you talk to your agent (\"plan one of my Someday trips for spring break\"). The web shows the same polaroids as a masonry mood board with your Someday column alongside.",
    moves: ["One big polaroid at a time; Skip / Someday / Plan", "\"Someday\" list the agent can read later", "Detail: day polaroids carousel (listing screenshots) + facts", "Web: masonry board + Someday column"],
    pros: ["Fun, high engagement, very visual", "Someday list is a new hook for the agent", "Works well with listing media (#63)"],
    cons: ["One-at-a-time is slow for real search", "Swipe UIs can feel gimmicky for a travel tool", "Masonry needs good cover art from every template"],
    effort: "M",
    m1: () => `${nav("Someday", "Swipe through trips people loved", I("bookmark", 18))}
      <div class="c10-deck"><div class="pol c10-c b2">${`<div class="ph">${WP.scene(K.kyoto)}</div>`}</div><div class="pol c10-c b1"><div class="ph">${WP.scene(K.maui)}</div></div>
        <div class="pol c10-c top"><i class="tape t1"></i><div class="ph">${WP.scene(K.iceland)}<span class="pm">${WP.postmark(K.iceland, 56)}</span></div><div class="cap">${esc(K.iceland.title)}</div><div class="meta">${WP.facts(K.iceland)} · ${WP.crewTxt(K.iceland)}</div><p class="c10-q hand">“${esc(K.iceland.kept[0])}”</p></div></div>
      <div class="c10-acts"><span class="c10-b">${I("x", 24, 2.6)}</span><span class="c10-b acc">${I("heart", 26, 2.4)}</span><span class="c10-b">${I("sparkle", 22, 2.2)}</span></div>
      <div class="c10-lbls"><span>Skip</span><span>Someday</span><span>Plan now</span></div>
      <div class="c10-tray"><span class="hand">Someday · 4</span>${[K.kyoto, K.lisbon, K.olympic, K.zion].map((t) => `<div class="pol" style="width:46px;padding:3px 3px 4px"><div class="ph">${WP.scene(t)}</div></div>`).join("")}</div>`,
    m2: () => `${nav("", "", I("share", 18))}
      <div class="c10-car">${shots(S)}</div>
      <div style="padding:6px 22px 0"><div class="hand" style="font-size:36px;line-height:1">${esc(S.title)}</div><div class="mut" style="font-size:13px;margin-top:6px">${S.region} · ${WP.facts(S)} · ${WP.crewTxt(S)}</div><div class="wmeta" style="margin-top:10px">${WP.stampT(S)}<span class="mut">${WP.remixT(S)}</span></div></div>
      <div class="mchips" style="padding-top:14px">${WP.tagsH(S)}</div>
      <div class="h2">From the trip</div><div class="p">${WP.noteList(S)}</div>
      <div class="h2">Days</div>${WP.daysList(S)}
      <div class="mcta"><span class="rb acc">${I("heart", 18)}</span><div class="mcta-b">${WP.planBtn("btn block")}<small>Saved to Someday · plan it whenever</small></div></div>`,
    w1: () => WP.web(`
      <div class="c10w"><div class="c10w-main"><div class="c10w-h"><h1 class="hand">Trips people loved</h1><div class="mchips">${["Everything", "Snow", "Beach", "Cities", "With kids", "Dog OK"].map((x, i) => `<span class="wchip${i === 0 ? " on" : ""}">${x}</span>`).join("")}</div></div>
        <div class="c10w-mas">${T.map((t, i) => `<div class="c10w-it"><div class="pol" style="transform:rotate(${[-1.5, 1, 0.5, -0.8, 1.6][i % 5]}deg)">${i % 4 === 0 ? '<i class="tape"></i>' : ""}<div class="ph" style="aspect-ratio:${["1/1.2", "1/.8", "1/1", "1/.7", "1/1.1"][i % 5]}">${WP.scene(t)}</div><div class="cap">${esc(t.title)}</div><div class="meta">${WP.facts(t)}</div></div><span class="c10w-heart${[1, 4, 6].includes(i) ? " on" : ""}">${I("heart", 15, 2.4)}</span></div>`).join("")}</div></div>
        <aside class="c10w-side"><b class="hand" style="font-size:30px">Someday</b><small class="mut">4 trips · your agent can see this list</small>${[K.kyoto, K.lisbon, K.olympic, K.zion].map((t) => `<div class="c10w-s"><div class="pol" style="width:62px;padding:3px 3px 4px"><div class="ph">${WP.scene(t)}</div></div><span><b>${esc(t.title)}</b><small>${WP.facts(t)}</small></span></div>`).join("")}<div class="code" style="margin-top:14px"><span style="white-space:normal">“Plan one of my Someday trips for spring break”</span></div></aside></div>`),
    w2: () => WP.web(`
      <div class="wpage c10w2"><div class="wcrumb">Discover › ${esc(S.title)}</div><div class="c10w2-row"><div class="c10w2-car">${shots(S)}</div>
        <aside><h1 class="hand">${esc(S.title)}</h1><p class="lede">${esc(S.tagline)}</p><div class="wmeta">${WP.stampT(S)}<span>${WP.remixT(S)}</span></div><div class="mut" style="margin:8px 0">${WP.facts(S)} · ${WP.crewTxt(S)} · ${S.drive}</div><div class="mchips" style="padding:4px 0 10px">${WP.tagsH(S)}</div>
          <div class="c8w2-btns">${WP.planBtn("btn")}<span class="btn sec">${I("heart", 15)}Someday</span></div><h3 class="hand">From the trip</h3>${WP.noteList(S)}</aside></div>
        <h3 class="hand">Days</h3>${WP.daysList(S, "dl row")}</div>`, { url: "waypack.app/t/sequoia" }),
  });
})();
