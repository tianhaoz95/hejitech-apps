// Review UI: screens → detail → flow, with a pick per screen, star ratings and notes kept in localStorage.
(() => {
  const S = WP.screens, V = WP.variants;
  const cands = V.filter((v) => !v.baseline);
  const byId = Object.fromEntries(V.map((v) => [v.id, v]));
  const $ = (s) => document.querySelector(s);
  const KEY = "waypack-all-redesign-v1";

  let st = { pick: {}, rating: {}, notes: {}, mode: "light", flowDark: false };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg>';
  const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const label = (v) => (v.baseline ? "Current" : `Option ${v.kind.toUpperCase()}`);
  const opts = (s) => s.variants.filter((v) => !v.baseline);
  // Default for undecided screens is option A, so the flow always shows a complete redesign.
  const chosen = (s) => byId[st.pick[s.id]] || opts(s)[0];

  const phone = (v, scale, dark) =>
    `<div class="pw" style="width:${414 * scale}px;height:${868 * scale}px"><div class="phone" style="transform:scale(${scale})"><div class="scr ${v.cls}${v.sbClear ? " clear" : ""}${dark ? " dark" : ""}">${WP.statusBar()}<div class="body">${v.render()}</div>${WP.homeBar()}</div></div></div>`;
  const isDark = () => st.mode === "dark";

  const RULES = [
    ["Kraft page", "Dotted kraft background everywhere (#F3EADB / dark #231D18), not white or blue-grey."],
    ["Caveat for titles only", "Screen titles, section headers and captions are handwritten; body, numbers and buttons stay in Inter."],
    ["Objects vs. surfaces", "Polaroids, sticky notes, tickets and the QR are light paper even in dark mode; cards, sheets and buttons follow the theme."],
    ["One accent", "Coral #D9694F for primary actions, green for ‘ready/on’, amber for ‘update’, brick red only for destructive."],
    ["Round paper buttons", "Back, settings, scan, map controls: 40pt paper circles, same as the home top bar."],
  ];

  // ── views
  const gallery = () => `
    <section class="intro">
      <div><h1>Bring every screen into the scrapbook</h1>
      <p>The home screen shipped as a polaroid scrapbook in v1.1.0; the other ${S.length} screens are still stock Material blue. Each row is one screen: today's version, then one or two scrapbook takes. Open one to see it in light and dark, rate it, leave notes and <b>pick an option per screen</b>. Then check the <a href="#/flow">Flow</a> to see your picks side by side.</p></div>
      <div class="legend"><span><b>${S.length}</b> screens</span><span><b>${cands.length}</b> options</span><span>Sample: Kyoto, Day 3</span></div>
    </section>
    <section class="rules">${RULES.map(([h, p]) => `<div><b>${h}</b><span>${p}</span></div>`).join("")}</section>
    ${S.map((s) => `
      <section class="srow" id="s-${s.id}">
        <div class="shd"><span class="no">${String(s.n).padStart(2, "0")}</span><h2>${esc(s.name)}</h2><code>${esc(s.file)}</code>${st.pick[s.id] ? `<span class="done">${CHECK}${label(byId[st.pick[s.id]])} picked</span>` : `<span class="todo">${opts(s).length > 1 ? `${opts(s).length} options` : "1 option"}</span>`}</div>
        <div class="strip">${s.variants.map((v) => `
          <a class="cand${v.baseline ? " base" : ""}${st.pick[s.id] === v.id ? " picked" : ""}" href="#/v/${v.id}">
            ${v.baseline ? "" : `<button class="fav${st.pick[s.id] === v.id ? " on" : ""}" data-pick="${v.id}" aria-label="Pick ${esc(v.name)}" title="Pick for this screen">${CHECK}</button>`}
            ${phone(v, 0.5, isDark())}
            <div class="hd"><span class="no">${v.baseline ? "NOW" : v.kind.toUpperCase()}</span><h3>${esc(v.name)}</h3>${st.rating[v.id] ? `<span class="r">${st.rating[v.id]}★</span>` : ""}</div>
            <p>${esc(v.tagline)}</p>
          </a>`).join("")}
        </div>
      </section>`).join("")}`;

  const detail = (id) => {
    const v = byId[id] || cands[0], s = v.screen;
    const i = V.indexOf(v), prev = V[(i - 1 + V.length) % V.length], nxt = V[(i + 1) % V.length];
    const r = st.rating[v.id] || 0;
    return `
    <div class="detail">
      <div class="phones">
        <figure>${phone(v, 0.86, false)}<figcaption>Light</figcaption></figure>
        <figure>${phone(v, 0.86, true)}<figcaption>Dark</figcaption></figure>
      </div>
      <aside class="info">
        <div class="nav"><a href="#/v/${prev.id}">← ${esc(prev.screen.name)} · ${label(prev)}</a><a href="#/">All</a><a href="#/v/${nxt.id}">${label(nxt)} →</a></div>
        <div><h2><small>${String(s.n).padStart(2, "0")} · ${esc(s.name).toUpperCase()} · ${label(v).toUpperCase()}</small>${esc(v.name)}</h2><p class="tag">${esc(v.tagline)}</p></div>
        <div class="vtabs">${s.variants.map((o) => `<a href="#/v/${o.id}" class="${o.id === v.id ? "on" : ""}">${label(o)}${st.pick[s.id] === o.id ? " ✓" : ""}</a>`).join("")}</div>
        <p>${esc(v.concept)}</p>
        ${v.moves.length ? `<div><h4>Key moves</h4><ul>${v.moves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
        <dl class="kv"><dt>Code</dt><dd><code>${esc(s.file)}</code></dd>${v.baseline ? "" : `<dt>Effort</dt><dd>${v.effort} · ${{ S: "restyle with shared scrapbook widgets", M: "new layout + a few new widgets" }[v.effort]}</dd><dt>Needs</dt><dd>${v.needs.length ? v.needs.map(esc).join("; ") : "Nothing new — same data and actions as today"}</dd>`}</dl>
        ${v.baseline ? "" : `
        <div><h4>Your rating</h4><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= r ? "on" : ""}" aria-label="${n} stars">${STAR}</button>`).join("")}</div></div>
        <div><h4>Notes</h4><textarea id="notes" placeholder="What do you like, what would you change?">${esc(st.notes[v.id] || "")}</textarea></div>
        <div class="btnrow">
          <button class="btn ${st.pick[s.id] === v.id ? "on-win" : "pri"}" data-pick="${v.id}">${CHECK}${st.pick[s.id] === v.id ? `Picked for ${esc(s.name)}` : `Pick for ${esc(s.name)}`}</button>
        </div>`}
        <p style="font-size:12.5px">Tip: ← / → to flip through, <b>P</b> to pick. Scroll inside the phones.</p>
      </aside>
    </div>`;
  };

  const flow = () => {
    const decided = S.filter((s) => st.pick[s.id]).length;
    return `
    <section class="intro"><div><h1>The whole app, your picks</h1>
      <p>Use Light / Dark at the top right to flip the whole set. Every screen in flow order, starting from the shipped home. Undecided screens show option A (marked <i>default</i>). This is the “does it feel like one app?” check.</p></div>
    </section>
    <div class="flow">
      <figure>${phone(WP.home, 0.6, isDark())}<figcaption><span>Our trips</span><small>shipped</small></figcaption></figure>
      ${S.map((s) => { const v = chosen(s); return `<figure>${phone(v, 0.6, isDark())}<figcaption><a href="#/v/${v.id}">${String(s.n).padStart(2, "0")} · ${esc(s.name)}</a><small>${label(v)} · ${esc(v.name)}${st.pick[s.id] ? "" : " · <i>default</i>"}</small></figcaption></figure>`; }).join("")}
    </div>
    <p class="mut-c">${decided}/${S.length} screens decided.</p>`;
  };

  const picksBar = () => {
    const decided = S.filter((s) => st.pick[s.id]);
    $("#picks").innerHTML = `<span class="lbl">Decided <b>${decided.length}/${S.length}</b></span>
      <div class="chips">${decided.length ? decided.map((s) => `<a href="#/v/${st.pick[s.id]}" class="w">${esc(s.name)} · ${byId[st.pick[s.id]].kind.toUpperCase()}${st.rating[st.pick[s.id]] ? " · " + st.rating[st.pick[s.id]] + "★" : ""}</a>`).join("") : '<span class="lbl">Nothing picked yet — tap ✓ on an option.</span>'}</div>
      <button class="btn" id="reset" title="Clear all picks, ratings and notes">Reset</button>
      <button class="btn pri" id="copy">Copy summary</button>`;
  };

  const summary = () => {
    const out = ["# Waypack iOS all-screens scrapbook redesign — review", ""];
    for (const s of S) {
      const p = st.pick[s.id] ? byId[st.pick[s.id]] : null;
      out.push(`- **${s.n}. ${s.name}** — ${p ? `${label(p)}: ${p.name}` : "(not decided)"}`);
      for (const v of s.variants) {
        if (!st.rating[v.id] && !st.notes[v.id]) continue;
        out.push(`  - ${label(v)} ${v.name}${st.rating[v.id] ? ` — ${st.rating[v.id]}★` : ""}${st.notes[v.id] ? `: ${st.notes[v.id].trim().replace(/\n+/g, " / ")}` : ""}`);
      }
    }
    return out.join("\n");
  };

  // ── router
  let lastRoute = "";
  const route = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [r, id] = h.split("/");
    const kind = r === "v" ? "detail" : r === "flow" ? "flow" : "gallery";
    $("#view").innerHTML = kind === "detail" ? detail(id) : kind === "flow" ? flow() : gallery();
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.route === kind));
    document.querySelectorAll(".bar .seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === st.mode));
    if (h !== lastRoute) window.scrollTo(0, 0);
    lastRoute = h;
    picksBar();
  };
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800); };
  const togglePick = (id) => { const s = byId[id].screen; st.pick[s.id] = st.pick[s.id] === id ? undefined : id; if (st.pick[s.id]) toast(`${s.name}: ${label(byId[id])} picked`); };

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-pick],[data-star],[data-mode],[data-flow],#copy,#reset");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (el.dataset.pick) togglePick(el.dataset.pick);
    else if (el.dataset.star) { const id = location.hash.split("/")[2]; const n = +el.dataset.star; st.rating[id] = st.rating[id] === n ? 0 : n; }
    else if (el.dataset.mode) st.mode = el.dataset.mode;
    else if (el.dataset.flow) st.flowDark = el.dataset.flow === "dark";
    else if (el.id === "copy") {
      const text = summary();
      try { await navigator.clipboard.writeText(text); toast("Summary copied — paste it back to Claude"); }
      catch { prompt("Copy this summary:", text); }
      return;
    } else if (el.id === "reset") {
      if (!confirm("Clear all picks, ratings and notes?")) return;
      st = { pick: {}, rating: {}, notes: {}, mode: st.mode, flowDark: st.flowDark };
    }
    save(); rerender();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "notes") return;
    st.notes[location.hash.split("/")[2]] = e.target.value; save();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("textarea,input") || !location.hash.startsWith("#/v/")) return;
    const id = location.hash.split("/")[2], i = V.findIndex((v) => v.id === id);
    if (e.key === "ArrowRight") location.hash = `#/v/${V[(i + 1) % V.length].id}`;
    if (e.key === "ArrowLeft") location.hash = `#/v/${V[(i - 1 + V.length) % V.length].id}`;
    if (e.key.toLowerCase() === "p" && byId[id] && !byId[id].baseline) { togglePick(id); save(); rerender(); }
  });
  window.addEventListener("hashchange", route);

  route();
  if (document.fonts) document.fonts.ready.then(rerender);
})();
