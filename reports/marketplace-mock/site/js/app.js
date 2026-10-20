// Review UI: candidates → detail (phone + web) → compare one screen across all ten.
// Favourites, star ratings, notes and the final pick are kept in localStorage.
(() => {
  // The owner's own combination (direction 11) leads the list.
  const C = [...WP.cands.filter((c) => c.mine), ...WP.cands.filter((c) => !c.mine)];
  const byId = Object.fromEntries(C.map((c) => [c.id, c]));
  const $ = (s) => document.querySelector(s);
  const KEY = "waypack-marketplace-mock-v1";
  const esc = WP.esc;

  let st = { fav: {}, rating: {}, notes: {}, pick: "", mode: "light", screen: "m1" };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const dark = () => st.mode === "dark";

  const HEART = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg>';
  const SCREENS = [["m1", "Phone · browse"], ["m2", "Phone · template"], ["w1", "Web · gallery"], ["w2", "Web · template"]];
  const num = (c) => String(c.n).padStart(2, "0");
  const screensOf = (c) => c.screens || SCREENS;
  // Map-first and full-bleed screens draw under the status bar.
  const CLEAR = { pinboard: ["m1", "m2"], magazine: ["m2"], combo: ["m4"] };

  // Frames
  const phone = (c, key, scale) => {
    const d = dark(), sbClear = (CLEAR[c.id] || []).includes(key);
    return `<div class="pw" style="width:${414 * scale}px;height:${868 * scale}px"><div class="phone" style="transform:scale(${scale})"><div class="scr sk c-${c.id}${d ? " dark" : ""}${sbClear ? " clear" : ""}">${WP.statusBar()}<div class="body">${c[key]({ dark: d })}</div>${WP.homeBar()}</div></div></div>`;
  };
  const web = (c, key, scale) =>
    `<div class="bwrap" style="width:${1280 * scale}px;height:${836 * scale}px"><div class="bw c-${c.id}${dark() ? " dark" : ""}" style="transform:scale(${scale})">${c[key]({ dark: dark() })}</div></div>`;
  const frame = (c, key, ps, ws) => (key[0] === "m" ? phone(c, key, ps) : web(c, key, ws));

  const avail = () => Math.min(window.innerWidth, 1480) - 48;

  // ── views
  const gallery = () => {
    const w = avail(), cols = w > 1180 ? 2 : 1, cardW = (w - (cols - 1) * 22) / cols - 28;
    const ps = 0.44, ws = Math.min(0.42, (cardW - 414 * ps - 16) / 1280);
    return `
    <section class="intro"><div><h1>Trip gallery: ten directions + your combo</h1>
      <p>Someone has a great trip, their agent strips the dates and personal details and publishes it as a <b>template</b>. Others browse, then their own agent plans from it. Each direction below shows the phone app and the web portal. Open one to see all four screens (browse + template, phone + web), rate it and leave notes. <b>Your combo</b> (magazine home, postcard search that flips to a map) comes first, with all eight of its screens on its page. Use <a href="#/compare">Compare</a> to see one screen across all of them. Mark the ones you like with ♥ and choose a winner.</p></div>
      <div class="legend"><span><b>${C.length - 1}</b> directions + <b>1</b> combo</span><span><b>${WP.T.length}</b> sample templates</span><span>Detail screens show <b>Sequoia in the snow</b></span></div></section>
    <section class="rules">${[
      ["Same building blocks", "Built on today's shares (share_trip, get_shared_trip, the remix page) and listing media (#63)."],
      ["Template = no dates, no names", "Days are relative; season, length, crew shape and pace stay. The owner previews before it goes public."],
      ["Notes from the trip", "Kept / would cut / surprised us: the part no agent can research. Every direction shows it."],
      ["Traveled postmark", "Shown only after the trip's dates pass and the debrief is done. Plus a \"planned from it\" count."],
      ["One button", "\"Plan this trip\" hands the template to the viewer's agent (Open in Claude / Copy prompt), which re-checks for the new dates."],
    ].map(([h, p]) => `<div><b>${h}</b><span>${p}</span></div>`).join("")}</section>
    <div class="cgrid" style="grid-template-columns:repeat(${cols},1fr)">${C.map((c) => `
      <a class="cand2${st.pick === c.id ? " picked" : ""}${c.mine ? " mine" : ""}" href="#/c/${c.id}">
        <button class="fav${st.fav[c.id] ? " on" : ""}" data-fav="${c.id}" aria-label="Favourite ${esc(c.name)}">${HEART}</button>
        <div class="hd">${st.pick === c.id ? '<span class="win">Winner</span>' : ""}${c.mine ? '<span class="mine">Your combo</span>' : ""}<span class="no">${num(c)}</span><h3>${esc(c.name)}</h3>${st.rating[c.id] ? `<span class="r">${st.rating[c.id]}★</span>` : ""}<span class="eff">Effort ${c.effort}</span></div>
        <p>${esc(c.tagline)}</p>
        <div class="frames">${c.mine ? `${["m1", "m3", "m4"].map((k) => phone(c, k, ps)).join("")}${web(c, "w1", Math.min(0.62, (w - 28 - 3 * 414 * ps - 64) / 1280))}` : `${phone(c, "m1", ps)}${web(c, "w1", ws)}`}</div>
      </a>`).join("")}</div>`;
  };

  const detail = (id) => {
    const c = byId[id] || C[0], i = C.indexOf(c), prev = C[(i - 1 + C.length) % C.length], nxt = C[(i + 1) % C.length];
    const wide = window.innerWidth > 1100, left = avail() - (wide ? 412 : 0);
    const ps = Math.min(0.8, (left - 24) / 2 / 414), ws = Math.min(0.9, left / 1280);
    const r = st.rating[c.id] || 0;
    return `
    <div class="detail2">
      <div class="dleft">
        <div class="phones">${screensOf(c).filter(([k]) => k[0] === "m").map(([k, l]) => `<figure>${phone(c, k, ps)}<figcaption>${l}</figcaption></figure>`).join("")}</div>
        ${screensOf(c).filter(([k]) => k[0] === "w").map(([k, l]) => `<figure class="wfig">${web(c, k, ws)}<figcaption>${l}</figcaption></figure>`).join("")}
      </div>
      <aside class="info">
        <div class="nav"><a href="#/c/${prev.id}">← ${num(prev)} ${esc(prev.name)}</a><a href="#/">All</a><a href="#/c/${nxt.id}">${num(nxt)} ${esc(nxt.name)} →</a></div>
        <div><h2><small>DIRECTION ${num(c)}${c.mine ? " · YOUR COMBO" : ""}</small>${esc(c.name)}</h2><p class="tag">${esc(c.tagline)}</p></div>
        <p>${esc(c.concept)}</p>
        <div><h4>Key moves</h4><ul>${c.moves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>
        <div class="pc2"><div><h4>Good</h4><ul>${c.pros.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div><div><h4>Watch out</h4><ul>${c.cons.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div></div>
        <dl class="kv"><dt>Effort</dt><dd>${c.effort} · ${{ S: "a filtered list on top of shares", M: "new layouts + a few new metadata fields", L: "new layouts + new data or services" }[c.effort]}</dd></dl>
        <div><h4>Your rating</h4><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= r ? "on" : ""}" aria-label="${n} stars">${STAR}</button>`).join("")}</div></div>
        <div><h4>Notes</h4><textarea id="notes" placeholder="What do you like? What would you take from other directions?">${esc(st.notes[c.id] || "")}</textarea></div>
        <div class="btnrow">
          <button class="btn ${st.fav[c.id] ? "on-fav" : ""}" data-fav="${c.id}">${HEART}${st.fav[c.id] ? "Favourited" : "Favourite"}</button>
          <button class="btn ${st.pick === c.id ? "on-win" : "pri"}" data-pick="${c.id}">${st.pick === c.id ? "★ Winner" : "Pick as winner"}</button>
        </div>
        <p style="font-size:12.5px">Tip: ← / → to flip through directions, <b>F</b> to favourite. Scroll inside the phones and browser windows.</p>
      </aside>
    </div>`;
  };

  const compare = () => {
    const isM = st.screen[0] === "m", w = avail();
    const ps = 0.56, cols = isM ? Math.max(1, Math.floor((w + 20) / (414 * ps + 20))) : w > 1180 ? 2 : 1;
    const ws = (w - (cols - 1) * 24) / cols / 1280;
    return `
    <section class="intro"><div><h1>Compare one screen across all ten</h1><p>Same screen, same sample data, every direction. Click a caption to open that direction.</p></div></section>
    <div class="pick">${SCREENS.map(([k, l]) => `<button data-screen="${k}" class="${st.screen === k ? "on" : ""}">${l}</button>`).join("")}<span class="sp"></span><button data-only="1" class="${st.onlyFav ? "on" : ""}">♥ Favourites only</button></div>
    <div class="cmp2" style="grid-template-columns:repeat(${cols},1fr)">${C.filter((c) => !st.onlyFav || st.fav[c.id]).map((c) => `<figure>${frame(c, st.screen, ps, ws)}<figcaption><a href="#/c/${c.id}">${num(c)} · ${esc(c.name)}</a>${st.fav[c.id] ? '<span class="fv">♥</span>' : ""}${st.rating[c.id] ? `<small>${st.rating[c.id]}★</small>` : ""}${st.pick === c.id ? '<span class="win">Winner</span>' : ""}</figcaption></figure>`).join("") || '<div class="empty">No favourites yet. Tap ♥ on a direction.</div>'}</div>`;
  };

  const picksBar = () => {
    const favs = C.filter((c) => st.fav[c.id]);
    $("#picks").innerHTML = `<span class="lbl">${st.pick ? `Winner <b>${esc(byId[st.pick].name)}</b> · ` : ""}Favourites</span>
      <div class="chips">${favs.length ? favs.map((c) => `<a href="#/c/${c.id}" class="${st.pick === c.id ? "w" : ""}">${num(c)} ${esc(c.name)}${st.rating[c.id] ? " · " + st.rating[c.id] + "★" : ""}</a>`).join("") : '<span class="lbl">None yet. Tap ♥ on the directions you like.</span>'}</div>
      <button class="btn" id="reset" title="Clear favourites, ratings, notes and the winner">Reset</button>
      <button class="btn pri" id="copy">Copy summary</button>`;
  };

  const summary = () => {
    const out = ["# Waypack trip gallery: review of 10 directions", ""];
    if (st.pick) out.push(`**Winner:** ${num(byId[st.pick])} ${byId[st.pick].name}`, "");
    for (const c of C) {
      const bits = [st.fav[c.id] ? "♥" : "", st.rating[c.id] ? `${st.rating[c.id]}★` : ""].filter(Boolean).join(" ");
      if (!bits && !st.notes[c.id]) continue;
      out.push(`- **${num(c)} ${c.name}** ${bits}${st.notes[c.id] ? `: ${st.notes[c.id].trim().replace(/\n+/g, " / ")}` : ""}`);
    }
    if (out.length === 2) out.push("(no favourites, ratings or notes yet)");
    return out.join("\n");
  };

  // ── router
  let last = "";
  const route = () => {
    const h = location.hash.replace(/^#\/?/, ""), [r, id] = h.split("/");
    const kind = r === "c" ? "detail" : r === "compare" ? "compare" : "gallery";
    $("#view").innerHTML = kind === "detail" ? detail(id) : kind === "compare" ? compare() : gallery();
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.route === kind));
    document.querySelectorAll(".bar .seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === st.mode));
    if (h !== last) window.scrollTo(0, 0);
    last = h;
    picksBar();
  };
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800); };
  const toggleFav = (id) => { st.fav[id] = !st.fav[id]; toast(st.fav[id] ? `♥ ${byId[id].name}` : `Removed ${byId[id].name}`); };

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-fav],[data-pick],[data-star],[data-mode],[data-screen],[data-only],#copy,#reset");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (el.dataset.fav) toggleFav(el.dataset.fav);
    else if (el.dataset.pick) { st.pick = st.pick === el.dataset.pick ? "" : el.dataset.pick; if (st.pick) { st.fav[st.pick] = true; toast(`Winner: ${byId[st.pick].name}`); } }
    else if (el.dataset.star) { const id = location.hash.split("/")[2] || C[0].id, n = +el.dataset.star; st.rating[id] = st.rating[id] === n ? 0 : n; }
    else if (el.dataset.mode) st.mode = el.dataset.mode;
    else if (el.dataset.screen) st.screen = el.dataset.screen;
    else if (el.dataset.only) st.onlyFav = !st.onlyFav;
    else if (el.id === "reset") { if (!confirm("Clear all favourites, ratings, notes and the winner?")) return; st = { ...st, fav: {}, rating: {}, notes: {}, pick: "" }; }
    else if (el.id === "copy") {
      const text = summary();
      try { await navigator.clipboard.writeText(text); toast("Summary copied"); } catch { prompt("Copy the summary:", text); }
      return;
    }
    save(); rerender();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "notes") return;
    st.notes[location.hash.split("/")[2] || C[0].id] = e.target.value; save();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea, input")) return;
    const m = location.hash.match(/^#\/c\/(.+)$/);
    if (!m) return;
    const i = C.findIndex((c) => c.id === m[1]);
    if (e.key === "ArrowRight") location.hash = `#/c/${C[(i + 1) % C.length].id}`;
    else if (e.key === "ArrowLeft") location.hash = `#/c/${C[(i - 1 + C.length) % C.length].id}`;
    else if (e.key.toLowerCase() === "f") { toggleFav(C[i].id); save(); rerender(); }
  });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(rerender, 150); });
  window.addEventListener("hashchange", route);
  route();
})();
