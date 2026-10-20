// Review UI: gallery → detail → compare, with a shortlist, star ratings and notes kept in localStorage.
(() => {
  const D = WP.designs;
  const cands = D.filter((d) => !d.baseline);
  const byId = Object.fromEntries(D.map((d) => [d.id, d]));
  const $ = (s) => document.querySelector(s);
  const KEY = "waypack-home-redesign-v1";

  let st = { fav: {}, rating: {}, notes: {}, winner: null, compare: null, mode: "preferred" };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg>';
  const HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const dark = (d) => st.mode === "dark" || (st.mode === "preferred" && d.prefers === "dark");
  const phone = (d, scale, forceDark) => {
    const dk = forceDark ?? dark(d);
    return `<div class="pw" style="width:${414 * scale}px;height:${868 * scale}px"><div class="phone" style="transform:scale(${scale})"><div class="scr ${d.id}${dk ? " dark" : ""}">${WP.statusBar()}<div class="body">${d.render()}</div>${WP.homeBar()}</div></div></div>`;
  };

  // ── density metrics, measured from the real rendered screens
  WP.metrics = {};
  const measure = () => {
    const host = $("#measure");
    for (const d of D) {
      host.innerHTML = phone(d, 1, false);
      const scr = host.querySelector(".scr"), body = scr.querySelector(".body");
      const box = scr.getBoundingClientRect();
      const ids = new Set();
      scr.querySelectorAll("[data-trip]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top >= box.top && r.bottom <= box.bottom - 30 && r.left >= box.left - 1 && r.right <= box.right + 1) ids.add(el.dataset.trip);
      });
      const up = WP.upcoming.filter((t) => ids.has(t.id)).length;
      WP.metrics[d.id] = { visible: ids.size, upcoming: up, screens: body.scrollHeight / 844 };
    }
    host.innerHTML = "";
  };
  const metricChips = (d) => {
    const m = WP.metrics[d.id], base = WP.metrics.current;
    if (!m) return "";
    const good = !d.baseline && m.visible > base.visible;
    return `<span class="${good ? "good" : ""}">${m.visible}/${WP.trips.length} trips on first screen</span><span>${m.screens.toFixed(1)} screens long</span>${d.effort && d.effort !== "—" ? `<span>Effort ${d.effort}</span>` : ""}`;
  };

  // ── views
  const gallery = () => `
    <section class="intro">
      <div><h1>Pick a direction for the Trips home screen</h1>
      <p>Ten takes on “family warm trip”, all denser than today. Each phone is live HTML, so scroll inside it in the detail view. Heart the ones you like, rate them, leave notes, then crown a winner. Everything is saved in this browser.</p></div>
      <div class="legend"><span><b>${WP.trips.length}</b> sample trips</span><span>Today = <b>Oct 8, 2026</b></span></div>
    </section>
    <div class="grid">${D.map((d) => `
      <a class="cand${d.baseline ? " base" : ""}" href="#/d/${d.id}">
        ${d.baseline ? "" : `<button class="fav${st.fav[d.id] ? " on" : ""}" data-fav="${d.id}" aria-label="Shortlist ${esc(d.name)}">${HEART}</button>`}
        ${st.winner === d.id ? '<span class="win">Winner</span>' : ""}
        ${phone(d, 0.56)}
        <div class="hd"><span class="no">${d.baseline ? "NOW" : String(d.n).padStart(2, "0")}</span><h3>${esc(d.name)}</h3></div>
        <p>${esc(d.tagline)}</p>
        <div class="metric">${metricChips(d)}</div>
      </a>`).join("")}
    </div>`;

  const detail = (id) => {
    const d = byId[id] || cands[0];
    const i = D.indexOf(d), prev = D[(i - 1 + D.length) % D.length], nxt = D[(i + 1) % D.length];
    const r = st.rating[d.id] || 0;
    const prefDark = d.prefers === "dark";
    return `
    <div class="detail">
      <div class="phones">
        <figure>${phone(d, 0.86, prefDark)}<figcaption>${prefDark ? "Dark (designed for)" : "Light"}</figcaption></figure>
        <figure>${phone(d, 0.86, !prefDark)}<figcaption>${prefDark ? "Light" : "Dark"}</figcaption></figure>
      </div>
      <aside class="info">
        <div class="nav"><a href="#/d/${prev.id}">← ${esc(prev.name)}</a><a href="#/">All</a><a href="#/d/${nxt.id}">${esc(nxt.name)} →</a></div>
        <div><h2><small>${d.baseline ? "BASELINE" : "CANDIDATE " + String(d.n).padStart(2, "0")}</small>${esc(d.name)}</h2><p class="tag">${esc(d.tagline)}</p></div>
        <p>${esc(d.concept)}</p>
        <div class="metric">${metricChips(d)}</div>
        ${d.moves.length ? `<div><h4>Key moves</h4><ul>${d.moves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
        <div><h4>Palette</h4><div class="sw">${d.palette.map(([n, h]) => `<span><i style="background:${h}"></i>${esc(n)}</span>`).join("")}</div></div>
        <dl class="kv"><dt>Type</dt><dd>${esc(d.type)}</dd>${d.baseline ? "" : `<dt>Effort</dt><dd>${d.effort} · ${{ S: "restyle of today's widgets", M: "new card/row widgets + fonts" }[d.effort]}</dd><dt>Needs</dt><dd>${d.needs.length ? d.needs.map(esc).join("; ") : "Nothing new — uses fields the app already has"}</dd>`}</dl>
        ${d.baseline ? "" : `
        <div><h4>Your rating</h4><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= r ? "on" : ""}" aria-label="${n} stars">${STAR}</button>`).join("")}</div></div>
        <div><h4>Notes</h4><textarea id="notes" placeholder="What do you like, what would you change?">${esc(st.notes[d.id] || "")}</textarea></div>
        <div class="btnrow">
          <button class="btn${st.fav[d.id] ? " on-fav" : ""}" data-fav="${d.id}">${HEART}${st.fav[d.id] ? "Shortlisted" : "Shortlist"}</button>
          <button class="btn ${st.winner === d.id ? "on-win" : "pri"}" data-win="${d.id}">${TROPHY}${st.winner === d.id ? "Winner" : "Pick this one"}</button>
        </div>`}
        <p style="font-size:12.5px">Tip: ← / → to flip through, <b>F</b> to shortlist. Scroll inside the phones.</p>
      </aside>
    </div>`;
  };

  const compareIds = () => (st.compare && st.compare.length ? st.compare : (() => {
    const f = cands.filter((d) => st.fav[d.id]).map((d) => d.id);
    return f.length ? ["current", ...f].slice(0, 5) : ["current", "hearth", "sunday", "journal"];
  })());
  const compare = () => {
    const ids = compareIds();
    return `
    <section class="intro"><div><h1>Side by side</h1><p>Toggle candidates to line them up. The current app is included for scale.</p></div></section>
    <div class="pick">${D.map((d) => `<button data-cmp="${d.id}" class="${ids.includes(d.id) ? "on" : ""}">${d.baseline ? "Current" : d.n + " · " + esc(d.name)}</button>`).join("")}</div>
    ${ids.length ? `<div class="cmp">${ids.map((id) => byId[id]).filter(Boolean).map((d) => `
      <figure>${phone(d, 0.72)}<figcaption><a href="#/d/${d.id}">${d.baseline ? "Current" : d.n + " · " + esc(d.name)}</a>${st.fav[d.id] ? `<span style="color:var(--fav)">${HEART}</span>` : ""}<small>${WP.metrics[d.id] ? WP.metrics[d.id].visible + "/" + WP.trips.length + " visible" : ""}</small></figcaption></figure>`).join("")}</div>` : `<div class="empty">Pick at least one design above.</div>`}`;
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
      "# Waypack iOS home redesign — review",
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
    const v = $("#view");
    const kind = r === "d" ? "detail" : r === "compare" ? "compare" : "gallery";
    v.innerHTML = kind === "detail" ? detail(id) : kind === "compare" ? compare() : gallery();
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.route === kind));
    document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === st.mode));
    if (h !== lastRoute) window.scrollTo(0, 0);
    lastRoute = h;
    picksBar();
  };
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800); };

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-fav],[data-win],[data-star],[data-cmp],[data-mode],#copy,#reset");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (el.dataset.fav) { st.fav[el.dataset.fav] = !st.fav[el.dataset.fav]; }
    else if (el.dataset.win) { st.winner = st.winner === el.dataset.win ? null : el.dataset.win; if (st.winner) { st.fav[st.winner] = true; toast(`${byId[st.winner].name} picked as the winner`); } }
    else if (el.dataset.star) { const id = location.hash.split("/")[2]; const n = +el.dataset.star; st.rating[id] = st.rating[id] === n ? 0 : n; }
    else if (el.dataset.cmp) { const ids = compareIds().slice(); const k = ids.indexOf(el.dataset.cmp); k >= 0 ? ids.splice(k, 1) : ids.push(el.dataset.cmp); st.compare = ids; }
    else if (el.dataset.mode) { st.mode = el.dataset.mode; }
    else if (el.id === "copy") {
      const text = summary();
      try { await navigator.clipboard.writeText(text); toast("Summary copied — paste it back to Claude"); }
      catch { prompt("Copy this summary:", text); }
      return;
    } else if (el.id === "reset") {
      if (!confirm("Clear all picks, ratings and notes?")) return;
      st = { fav: {}, rating: {}, notes: {}, winner: null, compare: null, mode: st.mode };
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
    if (e.key.toLowerCase() === "f" && !byId[id].baseline) { st.fav[id] = !st.fav[id]; save(); rerender(); }
  });
  window.addEventListener("hashchange", route);

  route();
  // Re-measure once web fonts land so the density numbers reflect the real type.
  measure(); rerender();
  if (document.fonts) document.fonts.ready.then(() => { measure(); rerender(); });
})();
