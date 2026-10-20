(() => {
  const R = window.REPORT;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (v) => (v == null ? "–" : (Number.isInteger(v) ? v : v.toFixed(1)));
  const stock = R.evals[0];
  const best = R.evals.find((e) => e.name === R.best) || R.evals[R.evals.length - 1];

  // headline
  $("headline").innerHTML = [
    ["Type accuracy", stock.type, best.type, "%"],
    ["Category accuracy", stock.category, best.category, "%"],
    ["Logged without asking", stock.auto, best.auto, "%"],
    ["Wrong auto-commits", stock.wrong, best.wrong, ` of ${R.evalRows}`],
  ].map(([label, a, b, unit]) => `<div><b><s>${fmt(a)}</s>${fmt(b)}<small style="font-size:13px;color:var(--mut)">${unit}</small></b><span>${label} · stock → ${esc(best.name)}</span></div>`).join("");

  if (R.verdict) $("verdict").innerHTML = R.verdict;
  if (R.shipVerdict) $("shipverdict").innerHTML = R.shipVerdict;
  if (R.topupOutcome) $("topup-outcome").innerHTML = R.topupOutcome;

  // timeline
  const mins = (t) => { const [h, m, s] = t.split(":").map(Number); return h * 60 + m + s / 60; };
  const t0 = mins(R.timeline[0][1]), t1 = mins(R.timeline[R.timeline.length - 1][2]);
  const colors = ["#8C6F5A", "#C8603A", "#D69A1F", "#5E8C4E", "#4A7FA8", "#8A5FA8", "#A85F7A"];
  $("timeline").innerHTML = R.timeline.map(([name, a, b], i) => {
    const w = ((mins(b) - mins(a)) / (t1 - t0)) * 100;
    const d = Math.round(mins(b) - mins(a));
    return `<div style="flex:0 0 ${w}%;background:${colors[i % colors.length]}" title="${name} ${a}–${b} (${d} min)">${esc(name)}<small>${d} min</small></div>`;
  }).join("");

  // funnel
  const max = Math.max(...R.funnel.map((r) => r[2]));
  $("funnel").innerHTML = R.funnel.map(([t, , w, k, tr]) => {
    const pct = (x) => (x / max) * 100;
    const weak = k / w < 0.3;
    return `<span class="t${weak ? " weak" : ""}" title="${t}">${t}</span>
      <span class="bars"><i class="k1" style="width:${pct(w)}%"></i><i class="k2" style="width:${pct(k)}%"></i><i class="k3" style="width:${pct(tr)}%"></i></span>
      <span class="v">${Math.round((k / w) * 100)}% kept</span>`;
  }).join("");

  // loss chart
  const series = Object.entries(R.loss).filter(([, v]) => v);
  const lc = { pilot: "#A8998B", v1: "#D69A1F", v2: "#C8603A", topup: "#5E8C4E" };
  const W = 640, H = 220, P = { l: 36, r: 16, t: 12, b: 26 };
  const ymax = 1;
  const x = (i) => P.l + (i / 3) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - v / ymax) * (H - P.t - P.b);
  let svg = "";
  for (let g = 0; g <= 1.0001; g += 0.25) svg += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(g)}" y2="${y(g)}" stroke="currentColor" stroke-opacity=".12"/><text x="${P.l - 6}" y="${y(g) + 4}" text-anchor="end">${g.toFixed(2)}</text>`;
  for (let i = 0; i < 4; i++) svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === 3 ? "end" : "middle"}">epoch ${i + 1}</text>`;
  for (const [name, v] of series) {
    svg += `<polyline fill="none" stroke="${lc[name]}" stroke-width="2.5" points="${v.map((p, i) => `${x(i)},${y(p)}`).join(" ")}"/>`;
    svg += v.map((p, i) => `<circle cx="${x(i)}" cy="${y(p)}" r="3.5" fill="${lc[name]}"><title>${name} epoch ${i + 1}: ${p}</title></circle>`).join("");
  }
  $("loss").innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" style="color:var(--ink)">${svg}</svg>
    <div class="legend">${series.map(([n]) => `<span><i style="background:${lc[n]}"></i>${n}</span>`).join("")}</div></div>
    <p class="mut">${esc(R.lossNote)}</p>`;

  // eval table
  const cols = [["type", "Type"], ["full", "Full"], ["category", "Category"], ["phase", "Phase"], ["auto", "Auto-commit"], ["wrong", "Wrong auto"]];
  $("evaltable").innerHTML = `<table><tr><th>Model</th>${cols.map(([, l]) => `<th class="n">${l}</th>`).join("")}</tr>${R.evals.map((e) =>
    `<tr class="${e === best ? "best" : ""}"><td><b>${esc(e.name)}</b>${e.oldEval ? " *" : ""}<br><small class="mut">${esc(e.note)}</small></td>${cols.map(([k]) => `<td class="n">${fmt(e[k])}${k === "wrong" || e[k] == null ? "" : "%"}</td>`).join("")}</tr>`).join("")}</table>
    <p class="mut">Percentages of ${R.evalRows} sentences; “wrong auto” is a count. * scored on the eval before the relabel (its stock baseline was 81.5 / 66.3).</p>`;

  // misses
  $("misses").innerHTML = Object.entries(R.misses).map(([run, list]) =>
    `<h3 class="sub">${esc(run)}</h3>` + list.map(([tier, text, want, got]) =>
      `<div class="miss"><span class="tier ${tier}">${tier}</span><span>“${esc(text)}”</span><small>expected ${esc(want)} · got ${esc(got)}</small></div>`).join("")).join("");

  // highlight the section in view
  const links = [...document.querySelectorAll(".toc a")];
  const obs = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${e.target.id}`));
  }), { rootMargin: "-20% 0px -70% 0px" });
  document.querySelectorAll("article h2[id]").forEach((h) => obs.observe(h));
})();
