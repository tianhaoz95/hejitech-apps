// Review engine: gallery → detail → compare, with hearts, star ratings, per-candidate notes, a winner
// (one per group when candidates are grouped), overall notes and a "Copy summary" that the user pastes
// to whichever agent implements it. Everything is configured by window.REVIEW (js/candidates.js); nothing here should
// need editing for a new review.
(() => {
  const R = window.REVIEW;
  const D = R.candidates;
  const cands = D.filter((c) => !c.baseline);
  const byId = Object.fromEntries(D.map((c) => [c.id, c]));
  const groups = R.groups && R.groups.length ? R.groups : [{ id: "_", name: "" }];
  const grouped = groups.length > 1 || groups[0].id !== "_";
  const gid = (c) => c.group || "_";
  const $ = (s) => document.querySelector(s);
  const KEY = R.key;

  let st = { fav: {}, rating: {}, notes: {}, win: {}, overall: "", compare: null, mode: R.modes === false ? "light" : "preferred" };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const STAR = '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/></svg>';
  const HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const no = (c) => (c.baseline ? "NOW" : String(c.n).padStart(2, "0"));
  const isNew = (c) => R.round > 1 && c.round === R.round;
  const isWin = (c) => st.win[gid(c)] === c.id;

  // ── frames: every candidate renders into a fixed-size surface that is scaled, never reflowed
  const KIND = R.frame || "phone";
  const SIZE = { phone: [414, 868], browser: [1280, 832] };
  const dims = (kind) => SIZE[kind] || R.size || [480, 360];
  const THUMB = { phone: 232, browser: 300 }[KIND] || 240;
  const DETAIL = { phone: 356, browser: 880 }[KIND] || Math.min(560, dims(KIND)[0]);
  const COMPARE = { phone: 298, browser: 560 }[KIND] || Math.min(420, dims(KIND)[0]);

  const dark = (c) => st.mode === "dark" || (st.mode === "preferred" && c.prefers === "dark");
  const frame = (c, width, dk = dark(c), render = c.render, kind = KIND) => {
    const [w, h] = dims(kind), s = width / w;
    const scr = `<div class="scr ${c.id}${dk ? " dark" : ""}">${render({ dark: dk, c })}</div>`;
    const inner = kind === "phone" ? `<div class="phone">${scr}</div>`
      : kind === "browser" ? `<div class="frame browser"><div class="chrome"><i></i><i></i><i></i><span>${esc(R.url || "example.com")}</span></div>${scr}</div>`
      : `<div class="frame ${kind}" style="width:${w}px;height:${h}px">${scr}</div>`;
    return `<div class="pw" style="width:${w * s}px;height:${h * s}px"><div class="fx" style="position:absolute;top:0;left:0;transform-origin:top left;transform:scale(${s})">${inner}</div></div>`;
  };

  // ── optional metrics, measured from the real rendered surface (R.metrics(c, scrEl) → [{text, good}])
  const M = {};
  const measure = () => {
    if (!R.metrics) return;
    const host = $("#measure");
    for (const c of D) {
      host.innerHTML = frame(c, dims(KIND)[0], false);
      M[c.id] = R.metrics(c, host.querySelector(".scr")) || [];
    }
    host.innerHTML = "";
  };
  const chips = (c) => {
    const m = (M[c.id] || []).map((x) => `<span class="${x.good ? "good" : ""}">${esc(x.text)}</span>`);
    if (c.facts && c.facts.Effort) m.push(`<span>Effort ${esc(c.facts.Effort)}</span>`);
    return m.length ? `<div class="metric">${m.join("")}</div>` : "";
  };

  // ── views
  const card = (c) => `
    <a class="cand${c.baseline ? " base" : ""}" href="#/d/${c.id}">
      ${c.baseline ? "" : `<button class="fav${st.fav[c.id] ? " on" : ""}" data-fav="${c.id}" aria-label="Shortlist ${esc(c.name)}">${HEART}</button>`}
      ${isWin(c) ? '<span class="win">Winner</span>' : ""}${c.mine ? '<span class="mine">Your combo</span>' : isNew(c) ? '<span class="new">New</span>' : ""}
      ${frame(c, THUMB)}
      <div class="hd"><span class="no">${no(c)}</span><h3>${esc(c.name)}</h3>${st.rating[c.id] ? `<span class="r">${st.rating[c.id]}★</span>` : ""}</div>
      <p>${esc(c.tagline || "")}</p>
      ${chips(c)}
    </a>`;

  const gallery = () => `
    <section class="intro">
      <div><h1>${esc(R.heading || R.title)}</h1><p>${R.intro || ""}</p></div>
      ${R.legend ? `<div class="legend">${R.legend.map((l) => `<span>${l}</span>`).join("")}</div>` : ""}
    </section>
    ${groups.map((g) => {
      const list = D.filter((c) => gid(c) === g.id);
      const w = st.win[g.id] && byId[st.win[g.id]];
      return `${grouped ? `<div class="grp"><h2>${esc(g.name)}</h2>${g.note ? `<small>${esc(g.note)}</small>` : ""}${w ? `<a class="chosen" href="#/d/${w.id}">🏆 ${esc(w.name)}</a>` : ""}</div>` : ""}
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(${THUMB + 28}px,1fr))">${list.map(card).join("")}</div>`;
    }).join("")}
    <section class="overall">
      <h3>Overall direction</h3>
      <p>Anything that cuts across candidates: "combine 03's header with 07's rows", "all too busy", "try a darker take". It goes into the summary.</p>
      <textarea id="overall" placeholder="What should the next round do?">${esc(st.overall || "")}</textarea>
    </section>`;

  const detail = (id) => {
    const c = byId[id] || cands[0];
    const i = D.indexOf(c), prev = D[(i - 1 + D.length) % D.length], nxt = D[(i + 1) % D.length];
    const r = st.rating[c.id] || 0;
    const prefDark = c.prefers === "dark";
    const views = c.views && c.views.length
      ? c.views.map((v) => `<figure>${frame(c, v.frame && v.frame !== KIND ? Math.min(Math.max(DETAIL, 560), dims(v.frame)[0]) : DETAIL, v.dark ?? dark(c), v.render, v.frame || KIND)}<figcaption>${esc(v.name)}</figcaption></figure>`)
      : R.modes === false ? [`<figure>${frame(c, DETAIL, false)}</figure>`]
      : [`<figure>${frame(c, DETAIL, prefDark)}<figcaption>${prefDark ? "Dark (designed for)" : "Light"}</figcaption></figure>`,
         `<figure>${frame(c, DETAIL, !prefDark)}<figcaption>${prefDark ? "Light" : "Dark"}</figcaption></figure>`];
    const facts = Object.entries(c.facts || {});
    return `
    <div class="detail">
      <div class="views"><div class="row">${views.join("")}</div>${window.DESIGN ? DESIGN.section(c) : ""}</div>
      <aside class="info">
        <div class="nav"><a href="#/d/${prev.id}">← ${esc(prev.name)}</a><a href="#/">All</a><a href="#/d/${nxt.id}">${esc(nxt.name)} →</a></div>
        <div><h2><small>${c.baseline ? "BASELINE" : (grouped ? esc(groups.find((g) => g.id === gid(c))?.name || "") + " · " : "") + "CANDIDATE " + no(c)}</small>${esc(c.name)}</h2><p class="tag">${esc(c.tagline || "")}</p></div>
        ${c.concept ? `<p>${esc(c.concept)}</p>` : ""}
        ${chips(c)}
        ${c.moves && c.moves.length ? `<div><h4>Key moves</h4><ul>${c.moves.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
        ${c.palette && c.palette.length ? `<div><h4>Palette</h4><div class="sw">${c.palette.map(([n, h]) => `<span><i style="background:${h}"></i>${esc(n)}</span>`).join("")}</div></div>` : ""}
        ${facts.length ? `<dl class="kv">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
        ${c.baseline ? "" : `
        <div><h4>Your rating</h4><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= r ? "on" : ""}" aria-label="${n} stars">${STAR}</button>`).join("")}</div></div>
        <div><h4>Notes &amp; changes</h4><textarea id="notes" placeholder="What do you like, what would you change?">${esc(st.notes[c.id] || "")}</textarea></div>
        <div class="btnrow">
          <button class="btn${st.fav[c.id] ? " on-fav" : ""}" data-fav="${c.id}">${HEART}${st.fav[c.id] ? "Shortlisted" : "Shortlist"}</button>
          <button class="btn ${isWin(c) ? "on-win" : "pri"}" data-win="${c.id}">${TROPHY}${isWin(c) ? "Winner" : "Pick this one"}</button>
        </div>`}
        <p style="font-size:12.5px">Tip: ← / → to flip through, <b>F</b> to shortlist. Scroll inside the mocks.</p>
      </aside>
    </div>`;
  };

  const compareIds = () => (st.compare && st.compare.length ? st.compare : (() => {
    const base = D.filter((c) => c.baseline).map((c) => c.id);
    const f = cands.filter((c) => st.fav[c.id]).map((c) => c.id);
    return [...base, ...(f.length ? f : cands.slice(0, 3).map((c) => c.id))].slice(0, 5);
  })());
  const compare = () => {
    const ids = compareIds();
    return `
    <section class="intro"><div><h1>Side by side</h1><p>Toggle candidates to line them up. Defaults to your shortlist.</p></div></section>
    <div class="pick">${D.map((c) => `<button data-cmp="${c.id}" class="${ids.includes(c.id) ? "on" : ""}">${c.baseline ? "Current" : c.n + " · " + esc(c.name)}</button>`).join("")}</div>
    ${ids.length ? `<div class="cmp">${ids.map((id) => byId[id]).filter(Boolean).map((c) => `
      <figure>${frame(c, COMPARE)}<figcaption><a href="#/d/${c.id}">${c.baseline ? "Current" : c.n + " · " + esc(c.name)}</a>${st.fav[c.id] ? `<span style="color:var(--fav)">${HEART}</span>` : ""}${st.rating[c.id] ? `<small>${st.rating[c.id]}★</small>` : ""}</figcaption></figure>`).join("")}</div>` : `<div class="empty">Pick at least one candidate above.</div>`}`;
  };

  const picksBar = () => {
    const winners = Object.values(st.win).filter((id) => byId[id]);
    const ids = [...new Set([...winners, ...cands.filter((c) => st.fav[c.id]).map((c) => c.id)])];
    $("#picks").innerHTML = `<span class="lbl">${grouped ? `Decided <b>${winners.length}/${groups.length}</b>` : "Your picks"}</span>
      <div class="chips">${ids.length ? ids.map((id) => `<a href="#/d/${id}" class="${winners.includes(id) ? "w" : ""}">${winners.includes(id) ? "🏆 " : "♥ "}${esc(byId[id].name)}${st.rating[id] ? " · " + st.rating[id] + "★" : ""}</a>`).join("") : '<span class="lbl">Nothing shortlisted yet — tap ♥ on a candidate.</span>'}</div>
      <button class="btn" id="reset" title="Clear all picks, ratings and notes">Reset</button>
      <button class="btn pri" id="copy">Copy summary</button>`;
  };

  // "Copy summary" writes a hand-off for whichever agent picks this up next, possibly in a new session
  // that never saw this review: where everything is, the brief, each candidate the user reacted to in
  // full (concept, moves, needs, design as text), the user's feedback and what to do next.
  const summary = () => {
    const dir = R.dir || "reports/<slug>";
    const filled = (v) => v && !/<name>|^What the user asked for/.test(String(v));   // skip the template's placeholders
    const decided = groups.filter((g) => st.win[g.id] && byId[st.win[g.id]]);
    const allDecided = decided.length === groups.length;
    const touched = (list) => list.filter((c) => st.fav[c.id] || st.rating[c.id] || (st.notes[c.id] || "").trim() || isWin(c))
      .sort((a, b) => (isWin(b) - isWin(a)) || ((st.rating[b.id] || 0) - (st.rating[a.id] || 0)));
    const full = (c) => {
      const bits = [isWin(c) ? "🏆 winner" : "", st.rating[c.id] ? `${st.rating[c.id]}★` : "", st.fav[c.id] ? "♥ shortlisted" : ""].filter(Boolean).join(" · ");
      const notes = (st.notes[c.id] || "").trim();
      const facts = Object.entries(c.facts || {});
      const o = [`### ${no(c)} ${c.name} (\`${c.id}\`)${bits ? ` — ${bits}` : ""}`, ""];
      if (notes) o.push("**User's notes (these win over the text below):**", "", ...notes.split(/\n+/).map((l) => `> ${l}`), "");
      if (c.tagline) o.push(`*${c.tagline}*`, "");
      if (c.concept) o.push(c.concept, "");
      if (c.moves && c.moves.length) o.push("Key moves:", ...c.moves.map((m) => `- ${m}`), "");
      if (facts.length) o.push(...facts.map(([k, v]) => `- **${k}:** ${v}`), "");
      if (c.views && c.views.length) o.push(`Mock views: ${c.views.map((v) => v.name).join(", ")}.`, "");
      if (window.DESIGN && (c.spec || (c.design && c.design.length))) o.push(DESIGN.markdown(c, "####"));
      return o.join("\n");
    };

    const out = [
      `# ${R.title} — design review hand-off${R.round > 1 ? ` (round ${R.round})` : ""}`, "",
      "This is the result of a design review the user did in a candidate-review site. You may be a different agent in a new session: everything you need is below or in the files it names. Don't assume earlier conversation context.", "",
      "## Where things are", "",
      `- **Repository:** ${R.repo ? `\`${R.repo}\` ` : ""}(paths below are relative to its root)`,
      `- **Review site:** \`${dir}/\` (if it's gone, look in \`reports/archive/\`). Run \`${dir}/script/serve.sh\`${R.port ? ` → http://localhost:${R.port}/` : ""} to see every mock live.`,
      `- **Candidates in code:** \`${dir}/site/js/candidates.js\` (each candidate by the \`id\` below: markup, design blocks), styles in \`${dir}/site/css/candidates.css\` under \`.scr.<id>\`, shared sample data in \`${dir}/site/js/kit.js\`. The mocks are a visual spec, not production code.`,
    ];
    if (filled(R.project)) out.push(`- **Project:** \`${R.project}/\`. Read the root \`CLAUDE.md\` and \`${R.project}/CLAUDE.md\` before changing anything.`);
    if (R.context && R.context.filter(filled).length) out.push(`- **Read for context:** ${R.context.filter(filled).map((f) => `\`${f}\``).join(", ")}`);
    out.push("");
    if (filled(R.brief)) out.push("## The brief", "", R.brief.trim(), "");

    out.push("## Decision", "");
    if (grouped) out.push(...groups.map((g) => { const w = st.win[g.id] && byId[st.win[g.id]]; return `- **${g.name}:** ${w ? `${no(w)} ${w.name} (\`${w.id}\`)` : "not picked yet"}`; }), "");
    else { const w = decided.length ? byId[st.win[groups[0].id]] : null; out.push(w ? `**Winner:** ${no(w)} ${w.name} (\`${w.id}\`)` : "**Winner:** not picked yet", ""); }
    if ((st.overall || "").trim()) out.push("**The user's overall direction:**", "", ...st.overall.trim().split(/\n+/).map((l) => `> ${l}`), "");

    out.push("## What to do next", "");
    if (allDecided) out.push(
      `${grouped ? "Every group has a winner" : "A winner is picked"}. Unless the overall direction above asks for another round, implement ${decided.length > 1 ? "the winners" : "the winner"} in the real project:`, "",
      "1. Read the project docs above, then the code the winner changes (the design section lists the files).",
      "2. Open the review site and the winner's mock; build it with the app's real components, data and states. The user's notes override the candidate's text.",
      "3. Treat the design section as the technical spec: build what *Proposed* describes, everything under *Needs*, and settle the open questions under *Risks* with the user if they change scope.",
      "4. Verify as *How to verify* says and as the project's `CLAUDE.md` requires (tests, What's New, device checks).", "");
    else out.push(
      `${decided.length ? `${decided.length} of ${groups.length} groups are decided.` : "No winner yet."} Run round ${(R.round || 1) + 1} of the review (skill \`heji-candidate-review\`, §5): edit \`${dir}\` in place with the same \`key\`, bump \`round\`, turn the notes into new candidates (\`round: ${(R.round || 1) + 1}\`), keep the rated ones, then hand the site back to the user. Implement only what is already decided, and only if the user asks.`, "");

    for (const g of groups) {
      const list = touched(cands.filter((c) => gid(c) === g.id));
      if (!list.length) continue;
      out.push(grouped ? `## ${g.name} — candidates the user reacted to` : "## Candidates the user reacted to", "");
      for (const c of list) out.push(full(c));
    }
    const skipped = cands.filter((c) => !touched([c]).length);
    if (skipped.length) out.push("## Not reacted to", "", ...skipped.map((c) => `- ${no(c)} ${c.name} (\`${c.id}\`)${c.tagline ? `: ${c.tagline}` : ""}`), "");
    const base = D.filter((c) => c.baseline);
    if (base.length) out.push(`Baseline (today's design, for comparison): ${base.map((c) => `\`${c.id}\``).join(", ")}.`, "");
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  };

  // ── router
  let lastRoute = "";
  const route = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [r, id] = h.split("/");
    const kind = r === "d" ? "detail" : r === "compare" ? "compare" : "gallery";
    $("#view").innerHTML = kind === "detail" ? detail(id) : kind === "compare" ? compare() : gallery();
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.route === kind));
    document.querySelectorAll("#modes button").forEach((b) => b.classList.toggle("on", b.dataset.mode === st.mode));
    if (h !== lastRoute) window.scrollTo(0, 0);
    lastRoute = h;
    picksBar();
  };
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800); };
  const curId = () => location.hash.split("/")[2];

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-fav],[data-win],[data-star],[data-cmp],[data-mode],#copy,#reset");
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (el.dataset.fav) { st.fav[el.dataset.fav] = !st.fav[el.dataset.fav]; }
    else if (el.dataset.win) {
      const c = byId[el.dataset.win], g = gid(c);
      st.win[g] = st.win[g] === c.id ? undefined : c.id;
      if (st.win[g]) { st.fav[c.id] = true; toast(`${c.name} picked${grouped ? " for " + (groups.find((x) => x.id === g)?.name || "") : " as the winner"}`); }
    }
    else if (el.dataset.star) { const id = curId(), n = +el.dataset.star; st.rating[id] = st.rating[id] === n ? 0 : n; }
    else if (el.dataset.cmp) { const ids = compareIds().slice(); const k = ids.indexOf(el.dataset.cmp); k >= 0 ? ids.splice(k, 1) : ids.push(el.dataset.cmp); st.compare = ids; }
    else if (el.dataset.mode) { st.mode = el.dataset.mode; }
    else if (el.id === "copy") {
      const text = summary();
      try { await navigator.clipboard.writeText(text); toast("Hand-off copied: paste it to any agent"); }
      catch { prompt("Copy this summary:", text); }
      return;
    } else if (el.id === "reset") {
      if (!confirm("Clear all picks, ratings and notes?")) return;
      st = { fav: {}, rating: {}, notes: {}, win: {}, overall: "", compare: null, mode: st.mode };
    }
    save(); rerender();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "notes") st.notes[curId()] = e.target.value;
    else if (e.target.id === "overall") st.overall = e.target.value;
    else return;
    save();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("textarea,input") || !location.hash.startsWith("#/d/")) return;
    const id = curId(), i = D.findIndex((c) => c.id === id);
    if (e.key === "ArrowRight") location.hash = `#/d/${D[(i + 1) % D.length].id}`;
    if (e.key === "ArrowLeft") location.hash = `#/d/${D[(i - 1 + D.length) % D.length].id}`;
    if (e.key.toLowerCase() === "f" && byId[id] && !byId[id].baseline) { st.fav[id] = !st.fav[id]; save(); rerender(); }
  });
  window.addEventListener("hashchange", route);

  // ── chrome
  document.title = R.title;
  $("#title").textContent = R.title;
  $("#subtitle").textContent = R.subtitle || `${cands.length} candidates`;
  if (R.modes === false) $("#modes").remove();
  else $("#modes").innerHTML = (D.some((c) => c.prefers) ? [["preferred", "Preferred"]] : []).concat([["light", "Light"], ["dark", "Dark"]])
    .map(([m, l]) => `<button data-mode="${m}">${l}</button>`).join("");
  if (st.mode === "preferred" && !D.some((c) => c.prefers)) st.mode = "light";

  route();
  measure(); rerender();
  // Re-measure once web fonts land so metrics reflect the real type.
  if (document.fonts) document.fonts.ready.then(() => { measure(); rerender(); });
})();
