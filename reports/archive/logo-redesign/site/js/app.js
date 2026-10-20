// Review UI: gallery → detail → compare, with a shortlist, star ratings, notes and a winner in localStorage.
(() => {
  const D = LG.designs;
  const cands = D.filter((d) => !d.baseline);
  const byId = Object.fromEntries(D.map((d) => [d.id, d]));
  const $ = (s) => document.querySelector(s);
  const KEY = "waypack-logo-redesign-v1";
  const I = LG.icon;

  let st = { fav: {}, rating: {}, notes: {}, winner: null, compare: null, wall: "light" };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg>';
  const HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const no = (d) => (d.baseline ? "NOW" : String(d.n).padStart(2, "0"));

  // Generic neighbour apps on the home-screen mock (plain shapes, no real brands).
  const NEIGHBOURS = [
    ["Camera", "#4B4F57", "circle"], ["Notes", "#F2C94C", "lines"], ["Weather", "#3E8EDE", "sun"], ["Music", "#E5484D", "note"],
    ["Clock", "#1C1C1E", "clock"], [null], ["Calendar", "#FFFFFF", "cal"], ["Files", "#2F80ED", "folder"],
    ["Health", "#FFFFFF", "heart"], ["Books", "#F2994A", "book"], ["Wallet", "#111111", "cards"], ["Settings", "#8E8E93", "gear"],
  ];
  const glyphs = {
    circle: '<circle cx="30" cy="30" r="12" fill="none" stroke="#fff" stroke-width="5"/>',
    lines: '<path d="M16 22h28M16 30h28M16 38h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
    sun: '<circle cx="30" cy="30" r="10" fill="#FFE27A"/>',
    note: '<path d="M26 40V18l14-3v20" stroke="#fff" stroke-width="4" fill="none"/><circle cx="22" cy="40" r="5" fill="#fff"/>',
    clock: '<circle cx="30" cy="30" r="15" fill="#fff"/><path d="M30 20v10l7 4" stroke="#111" stroke-width="3"/>',
    cal: '<text x="30" y="40" text-anchor="middle" font-size="24" font-weight="300" fill="#111" font-family="Inter">8</text>',
    folder: '<path d="M16 22h11l3 4h14v16H16z" fill="#fff"/>',
    heart: '<path d="M30 42s-12-7-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 15-12 15z" fill="#FF375F"/>',
    book: '<path d="M18 18h12v24H18zM32 18h10v24H32z" fill="#fff"/>',
    cards: '<rect x="16" y="20" width="28" height="8" rx="2" fill="#F2C94C"/><rect x="16" y="30" width="28" height="8" rx="2" fill="#56CCF2"/>',
    gear: '<circle cx="30" cy="30" r="10" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 3"/>',
  };
  const neighbour = ([label, col, g], size) => `<svg width="${size}" height="${size}" viewBox="0 0 60 60"><defs><clipPath id="nb${label}${size}"><path d="${LG.squircle}" transform="scale(${60 / 1024})"/></clipPath></defs><g clip-path="url(#nb${label}${size})"><rect width="60" height="60" fill="${col}"/>${glyphs[g]}</g></svg>`;

  const homeScreen = (d, { dark = false, mode = "light", width = 300 } = {}) => {
    const s = Math.round(width * 0.2);
    return `<div class="home ${dark ? "hd" : "hl"}" style="width:${width}px">
      <div class="hs-time">9:41</div>
      <div class="hs-grid">${NEIGHBOURS.map((n) => n[0] === null
        ? `<div class="app me">${I(d, { size: s, mode })}<span>Waypack</span></div>`
        : `<div class="app">${neighbour(n, s)}<span>${n[0]}</span></div>`).join("")}</div>
      <div class="hs-dock">${[NEIGHBOURS[0], NEIGHBOURS[2], NEIGHBOURS[3]].map((n) => neighbour(n, s)).join("")}${I(d, { size: s, mode })}</div>
    </div>`;
  };

  const ladder = (d, mode = "light") => `<div class="ladder ${mode === "light" ? "" : "dk"}">${[180, 120, 87, 60, 40, 29].map((px) => `<figure>${I(d, { size: px, mode })}<figcaption>${px}</figcaption></figure>`).join("")}${[32, 16].map((px) => `<figure>${I(d, { size: px, shape: "tile", mode })}<figcaption>${px} fav</figcaption></figure>`).join("")}</div>`;

  const platforms = (d) => `
    <div class="plat">
      <figure><div class="stage s-l">${I(d, { size: 140, mode: "light" })}</div><figcaption>iOS · default</figcaption></figure>
      <figure><div class="stage s-d">${I(d, { size: 140, mode: "dark" })}</div><figcaption>iOS · dark</figcaption></figure>
      <figure><div class="stage s-d">${I(d, { size: 140, mode: "tinted" })}</div><figcaption>iOS · tinted</figcaption></figure>
      <figure><div class="stage s-a">${I(d, { size: 140, shape: "android" })}</div><figcaption>Android · adaptive</figcaption></figure>
    </div>
    <div class="plat">
      <figure class="wide"><div class="dock">${["#4B4F57", "#3E8EDE", "#F2994A"].map((c) => `<span style="background:${c}"></span>`).join("")}${I(d, { size: 76, shape: "mac" })}<span style="background:#8E8E93"></span></div><figcaption>macOS Dock</figcaption></figure>
      <figure class="wide"><div class="browser"><div class="tab">${I(d, { size: 16, shape: "tile" })}<b>Waypack — trips that work offline</b><i>×</i></div><div class="tab off"><span class="dot"></span><b>Inbox</b></div></div>
        <div class="site"><span class="lock">${I(d, { size: 34, shape: "tile" })}<b style="font-family:${d.word === "Caveat" ? "Caveat, cursive;font-size:30px" : "Inter, sans-serif;font-size:19px;letter-spacing:-.01em"}">Waypack</b></span><span class="nav">How it works · Download</span></div><figcaption>Favicon & site header</figcaption></figure>
    </div>`;

  // ── views
  const gallery = () => `
    <section class="intro">
      <div><h1>A new logo & app icon for the scrapbook Waypack</h1>
      <p>The app is now kraft paper, coral and washi tape, but the icon is still the bright blue folded map. Here are twenty scrapbook takes. Each is drawn live, so open one to see it on a home screen, at every size from 180pt down to a 16px favicon, in iOS dark and tinted modes, on Android, in the Mac Dock and on the website. Heart the ones you like, rate them, leave notes, then crown a winner.</p></div>
      <div class="seg" role="group" aria-label="Wallpaper"><button data-wall="light" class="${st.wall === "light" ? "on" : ""}">Light wallpaper</button><button data-wall="dark" class="${st.wall === "dark" ? "on" : ""}">Dark wallpaper</button></div>
    </section>
    <div class="grid">${D.map((d) => `
      <a class="cand${d.baseline ? " base" : ""}" href="#/d/${d.id}">
        ${d.baseline ? "" : `<button class="fav${st.fav[d.id] ? " on" : ""}" data-fav="${d.id}" aria-label="Shortlist ${esc(d.name)}">${HEART}</button>`}
        ${st.winner === d.id ? '<span class="win">Winner</span>' : ""}
        <div class="stage ${st.wall === "dark" ? "s-d" : "s-l"}">${I(d, { size: 132, mode: st.wall === "dark" ? "dark" : "light" })}</div>
        <div class="mini">${I(d, { size: 60 })}${I(d, { size: 40 })}${I(d, { size: 29 })}${I(d, { size: 32, shape: "tile" })}${I(d, { size: 16, shape: "tile" })}</div>
        <div class="hd"><span class="no">${no(d)}</span><h3>${esc(d.name)}</h3>${st.rating[d.id] ? `<span class="r">${st.rating[d.id]}★</span>` : ""}</div>
        <p>${esc(d.tagline)}</p>
      </a>`).join("")}
    </div>`;

  const detail = (id) => {
    const d = byId[id] || cands[0];
    const i = D.indexOf(d), prev = D[(i - 1 + D.length) % D.length], nxt = D[(i + 1) % D.length];
    const r = st.rating[d.id] || 0;
    return `
    <div class="detail">
      <div class="views">
        <div class="homes">
          <figure>${homeScreen(d, { mode: "light" })}<figcaption>Home screen · light</figcaption></figure>
          <figure>${homeScreen(d, { dark: true, mode: "dark" })}<figcaption>Home screen · dark icons</figcaption></figure>
        </div>
        <h4 class="vh">Sizes (iOS pt, then favicon px)</h4>${ladder(d)}${ladder(d, "dark")}
        <h4 class="vh">Platforms</h4>${platforms(d)}
      </div>
      <aside class="info">
        <div class="nav"><a href="#/d/${prev.id}">← ${esc(prev.name)}</a><a href="#/">All</a><a href="#/d/${nxt.id}">${esc(nxt.name)} →</a></div>
        <div class="big">${I(d, { size: 220 })}</div>
        <div><h2><small>${d.baseline ? "BASELINE" : "CANDIDATE " + no(d)}</small>${esc(d.name)}</h2><p class="tag">${esc(d.tagline)}</p></div>
        <p>${esc(d.concept)}</p>
        ${d.moves.length ? `<div><h4>Key moves</h4><ul>${d.moves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
        <div><h4>Palette</h4><div class="sw">${d.palette.map(([n, h]) => `<span><i style="background:${h}"></i>${esc(n)}</span>`).join("")}</div></div>
        <dl class="kv"><dt>Wordmark</dt><dd>${d.word === "Caveat" ? "Caveat (handwritten), as in the app titles" : "Inter, set tight"}</dd>${d.prefers ? `<dt>Best in</dt><dd>Dark mode</dd>` : ""}</dl>
        ${d.baseline ? "" : `
        <div><h4>Your rating</h4><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= r ? "on" : ""}" aria-label="${n} stars">${STAR}</button>`).join("")}</div></div>
        <div><h4>Notes</h4><textarea id="notes" placeholder="What do you like, what would you change?">${esc(st.notes[d.id] || "")}</textarea></div>
        <div class="btnrow">
          <button class="btn${st.fav[d.id] ? " on-fav" : ""}" data-fav="${d.id}">${HEART}${st.fav[d.id] ? "Shortlisted" : "Shortlist"}</button>
          <button class="btn ${st.winner === d.id ? "on-win" : "pri"}" data-win="${d.id}">${TROPHY}${st.winner === d.id ? "Winner" : "Pick this one"}</button>
        </div>`}
        <p style="font-size:12.5px">Tip: ← / → to flip through, <b>F</b> to shortlist.</p>
      </aside>
    </div>`;
  };

  const compareIds = () => (st.compare && st.compare.length ? st.compare : (() => {
    const f = cands.filter((d) => st.fav[d.id]).map((d) => d.id);
    return f.length ? ["current", ...f].slice(0, 6) : ["current", "polaroid", "washi", "paperpin", "kraftfold"];
  })());
  const compare = () => {
    const ids = compareIds();
    return `
    <section class="intro"><div><h1>Side by side</h1><p>Toggle candidates to line them up on the same home screen and at the same sizes. The current logo is included for reference.</p></div></section>
    <div class="pick">${D.map((d) => `<button data-cmp="${d.id}" class="${ids.includes(d.id) ? "on" : ""}">${d.baseline ? "Current" : d.n + " · " + esc(d.name)}</button>`).join("")}</div>
    ${ids.length ? `<div class="cmp">${ids.map((id) => byId[id]).filter(Boolean).map((d) => `
      <figure>
        ${homeScreen(d, { dark: st.wall === "dark", mode: st.wall === "dark" ? "dark" : "light", width: 240 })}
        <div class="cmp-sizes">${[60, 40, 29].map((px) => I(d, { size: px })).join("")}${I(d, { size: 32, shape: "tile" })}${I(d, { size: 16, shape: "tile" })}</div>
        <figcaption><a href="#/d/${d.id}">${d.baseline ? "Current" : d.n + " · " + esc(d.name)}</a>${st.fav[d.id] ? `<span style="color:var(--fav)">${HEART}</span>` : ""}${st.rating[d.id] ? `<small>${st.rating[d.id]}★</small>` : ""}</figcaption>
      </figure>`).join("")}</div>` : `<div class="empty">Pick at least one design above.</div>`}`;
  };

  const picksBar = () => {
    const favs = cands.filter((d) => st.fav[d.id]);
    $("#picks").innerHTML = `<span class="lbl">Your picks</span>
      <div class="chips">${favs.length || st.winner ? [...new Set([st.winner, ...favs.map((d) => d.id)].filter(Boolean))].map((id) => `<a href="#/d/${id}" class="${id === st.winner ? "w" : ""}">${id === st.winner ? "🏆 " : "♥ "}${esc(byId[id].name)}${st.rating[id] ? " · " + st.rating[id] + "★" : ""}</a>`).join("") : '<span class="lbl">Nothing shortlisted yet — tap ♥ on a design.</span>'}</div>
      <button class="btn" id="reset" title="Clear all picks, ratings and notes">Reset</button>
      <button class="btn pri" id="copy">Copy summary</button>`;
  };

  const summary = () => {
    const line = (d) => `- **${d.n}. ${d.name}**${st.rating[d.id] ? ` — ${st.rating[d.id]}★` : ""}${st.fav[d.id] ? " ♥" : ""}${st.notes[d.id] ? `\n  - ${st.notes[d.id].trim().replace(/\n+/g, "\n  - ")}` : ""}`;
    const touched = cands.filter((d) => st.fav[d.id] || st.rating[d.id] || st.notes[d.id] || st.winner === d.id);
    return [
      "# Waypack logo & app icon redesign — review",
      "",
      st.winner ? `**Winner:** ${byId[st.winner].n}. ${byId[st.winner].name} — ${byId[st.winner].tagline}` : "**Winner:** (not picked yet)",
      "",
      touched.length ? "## Feedback" : "",
      ...touched.sort((a, b) => (st.rating[b.id] || 0) - (st.rating[a.id] || 0)).map(line),
    ].join("\n");
  };

  // ── router
  let lastRoute = "";
  const route = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [r, id] = h.split("/");
    const kind = r === "d" ? "detail" : r === "compare" ? "compare" : "gallery";
    $("#view").innerHTML = kind === "detail" ? detail(id) : kind === "compare" ? compare() : gallery();
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.route === kind));
    if (h !== lastRoute) window.scrollTo(0, 0);
    lastRoute = h;
    picksBar();
  };
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800); };

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-fav],[data-win],[data-star],[data-cmp],[data-wall],#copy,#reset");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (el.dataset.fav) st.fav[el.dataset.fav] = !st.fav[el.dataset.fav];
    else if (el.dataset.win) { st.winner = st.winner === el.dataset.win ? null : el.dataset.win; if (st.winner) { st.fav[st.winner] = true; toast(`${byId[st.winner].name} picked as the winner`); } }
    else if (el.dataset.star) { const id = location.hash.split("/")[2]; const n = +el.dataset.star; st.rating[id] = st.rating[id] === n ? 0 : n; }
    else if (el.dataset.cmp) { const ids = compareIds().slice(); const k = ids.indexOf(el.dataset.cmp); k >= 0 ? ids.splice(k, 1) : ids.push(el.dataset.cmp); st.compare = ids; }
    else if (el.dataset.wall) st.wall = el.dataset.wall;
    else if (el.id === "copy") {
      const text = summary();
      try { await navigator.clipboard.writeText(text); toast("Summary copied — paste it back to Claude"); }
      catch { prompt("Copy this summary:", text); }
      return;
    } else if (el.id === "reset") {
      if (!confirm("Clear all picks, ratings and notes?")) return;
      st = { fav: {}, rating: {}, notes: {}, winner: null, compare: null, wall: st.wall };
    }
    save(); rerender();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "notes") return;
    st.notes[location.hash.split("/")[2]] = e.target.value; save();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("textarea,input") || !location.hash.startsWith("#/d/")) return;
    const id = location.hash.split("/")[2], i = D.findIndex((d) => d.id === id);
    if (e.key === "ArrowRight") location.hash = `#/d/${D[(i + 1) % D.length].id}`;
    if (e.key === "ArrowLeft") location.hash = `#/d/${D[(i - 1 + D.length) % D.length].id}`;
    if (e.key.toLowerCase() === "f" && byId[id] && !byId[id].baseline) { st.fav[id] = !st.fav[id]; save(); rerender(); }
  });
  window.addEventListener("hashchange", route);

  route();
  // Re-render once Caveat has loaded so handwritten marks use the real font.
  if (document.fonts) document.fonts.ready.then(rerender);
})();
