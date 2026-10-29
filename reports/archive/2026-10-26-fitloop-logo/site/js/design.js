// Design blocks: the technical half of a candidate (structure, data flow, data model, ML/eval numbers),
// shown under the mocks on the detail page and written into the hand-off as text, so an agent that
// never saw the page still gets every diagram and number. A candidate lists them in `design: [...]`:
//
//   { kind: "flow",  title, note, today?: graph, proposed: graph }   // boxes + arrows; Today/Proposed toggle
//       graph = { nodes: [{ id, label, sub, col, row, state, type }], edges: [{ from, to, label, state }] }
//       state: "new" | "changed" | "removed" (default: unchanged); type: "store" | "model" | "external" | "ui"
//   { kind: "chart", title, note, type: "bar" | "line", x: [...], unit, max,
//       series: [{ name, values, basis: "measured" | "target" | "estimate", source }] }
//   { kind: "table", title, note, head: [...], rows: [[...]] }       // schema diffs, metrics, comparisons
//   { kind: "code",  title, note, lang, before?, after }              // prompt, config, schema, API shape
//   { kind: "steps", title, note, steps: [{ actor, text }] }         // a request's / a sample's journey
//   { kind: "html",  title, note, html, text }                        // escape hatch; `text` goes in the hand-off
//
// Plus an optional `spec: { today: [], proposed: [], files: [], risks: [], verify: [] }` per candidate.
// Diagrams use the page's colour tokens, so they follow light/dark.
window.DESIGN = window.DESIGN || {};

(() => {
  const DESIGN = window.DESIGN;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let uid = 0;

  // ── flow diagram: nodes on a col/row grid, edges as curves between box edges
  const NW = 168, NH = 58, GX = 64, GY = 30, PAD = 16;
  const flowSvg = (g) => {
    const id = `dg${++uid}`;
    const pos = (n) => ({ x: PAD + n.col * (NW + GX), y: PAD + n.row * (NH + GY) });
    const W = PAD * 2 + (Math.max(...g.nodes.map((n) => n.col)) + 1) * (NW + GX) - GX;
    const H = PAD * 2 + (Math.max(...g.nodes.map((n) => n.row)) + 1) * (NH + GY) - GY + 14;
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const edge = (e) => {
      const a = by[e.from], b = by[e.to];
      if (!a || !b) return "";
      const p = pos(a), q = pos(b);
      let d, lx, ly;
      if (a.col === b.col) {                       // same column: vertical
        const down = b.row > a.row;
        const x = p.x + NW / 2, y1 = down ? p.y + NH : p.y, y2 = down ? q.y : q.y + NH;
        d = `M${x} ${y1} L${x} ${y2}`; lx = x + 8; ly = (y1 + y2) / 2 + 4;
      } else {                                     // across columns: right edge → left edge (or back)
        const fwd = b.col > a.col;
        const x1 = fwd ? p.x + NW : p.x, x2 = fwd ? q.x : q.x + NW, y1 = p.y + NH / 2, y2 = q.y + NH / 2, k = (x2 - x1) / 2;
        d = `M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`; lx = (x1 + x2) / 2; ly = (y1 + y2) / 2 - 6;
      }
      const cls = e.state || "same";
      return `<path class="e ${cls}" d="${d}" marker-end="url(#${id}-${cls})"/>` +
        (e.label ? `<text class="el" x="${lx}" y="${ly}" text-anchor="${a.col === b.col ? "start" : "middle"}">${esc(e.label)}</text>` : "");
    };
    const node = (n) => {
      const { x, y } = pos(n), cls = `n ${n.state || "same"} ${n.type || ""}`;
      const shape = n.type === "store"
        ? `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="6"/><path class="cap" d="M${x} ${y + 9} H${x + NW}"/>`
        : `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="${n.type === "model" ? NH / 2 : 12}"/>`;
      const tag = n.state && n.state !== "same" ? `<text class="tag" x="${x + NW - 8}" y="${y - 5}" text-anchor="end">${n.state.toUpperCase()}</text>` : "";
      return `<g class="${cls}">${shape}${tag}<text class="nl" x="${x + NW / 2}" y="${y + (n.sub ? 25 : 34)}" text-anchor="middle">${esc(n.label)}</text>` +
        (n.sub ? `<text class="ns" x="${x + NW / 2}" y="${y + 43}" text-anchor="middle">${esc(n.sub)}</text>` : "") + "</g>";
    };
    return `<svg class="dg" viewBox="0 0 ${W} ${H}" width="${W}" role="img"><defs>
${["same", "new", "changed", "removed"].map((k) => `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="mk ${k}" d="M0 0 10 5 0 10z"/></marker>`).join("")}
    </defs>${g.edges.map(edge).join("")}${g.nodes.map(node).join("")}</svg>`;
  };
  const flowText = (g) => {
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    const st = (s) => (s && s !== "same" ? ` [${s}]` : "");
    const name = (n) => `${n.label}${n.sub ? ` (${n.sub})` : ""}`;
    return [
      ...g.nodes.map((n) => `- ${name(n)}${n.type ? ` · ${n.type}` : ""}${st(n.state)}`),
      ...g.edges.map((e) => `- ${by[e.from]?.label} → ${by[e.to]?.label}${e.label ? `: ${e.label}` : ""}${st(e.state)}`),
    ].join("\n");
  };

  // ── charts: grouped bars or lines; target/estimate series are drawn hatched/dashed, never as measured
  const niceMax = (v) => { const p = 10 ** Math.floor(Math.log10(v || 1)); return Math.ceil(v / p) * p; };
  const chartSvg = (b) => {
    const id = `ch${++uid}`;
    const L = 44, R = 12, T = 14, B = 34, H = 260, W = Math.min(720, Math.max(360, L + R + b.x.length * (b.type === "line" ? 70 : b.series.length * 38 + 56)));
    const all = b.series.flatMap((s) => s.values).filter((v) => v != null);
    const max = b.max ?? niceMax(Math.max(...all));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const fmt = (v) => `${+(+v).toFixed(2)}${b.unit === "%" ? "%" : ""}`;
    const ticks = [0, .25, .5, .75, 1].map((f) => max * f);
    const grid = ticks.map((t) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("");
    const cw = (W - L - R) / b.x.length;
    const xl = b.x.map((c, i) => `<text class="ax" x="${L + cw * (i + .5)}" y="${H - 12}" text-anchor="middle">${esc(c)}</text>`).join("");
    let marks = "";
    if (b.type === "line") {
      b.series.forEach((s, k) => {
        const pts = s.values.map((v, i) => (v == null ? null : [L + cw * (i + .5), y(v)])).filter(Boolean);
        marks += `<polyline class="ln s${k} ${s.basis || "measured"}" points="${pts.map((p) => p.join(",")).join(" ")}"/>` +
          pts.map(([px, py], i) => `<circle class="dt s${k}" cx="${px}" cy="${py}" r="3.5"><title>${esc(s.name)}: ${fmt(s.values[i])}</title></circle>`).join("");
      });
    } else {
      const n = b.series.length, bw = Math.min(34, (cw - 16) / n);
      b.x.forEach((_, i) => b.series.forEach((s, k) => {
        const v = s.values[i];
        if (v == null) return;
        const bx = L + cw * i + (cw - bw * n) / 2 + bw * k;
        const basis = s.basis || "measured";
        marks += `<rect class="br s${k} ${basis}" x="${bx + 1}" y="${y(v)}" width="${bw - 2}" height="${y(0) - y(v)}" rx="3"${basis === "measured" ? "" : ` fill="url(#${id}-h${k})"`}><title>${esc(s.name)}: ${fmt(v)}</title></rect>` +
          `<text class="vl" x="${bx + bw / 2}" y="${y(v) - 4}" text-anchor="middle">${fmt(v)}</text>`;
      }));
    }
    const hatch = b.series.map((_, k) => `<pattern id="${id}-h${k}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hb s${k}" width="6" height="6"/><line class="hl s${k}" x1="0" y1="0" x2="0" y2="6"/></pattern>`).join("");
    const legend = `<div class="lg">${b.series.map((s, k) => `<span><i class="s${k} ${s.basis || "measured"}"></i>${esc(s.name)}${s.basis && s.basis !== "measured" ? ` <em>${esc(s.basis)}</em>` : ""}</span>`).join("")}</div>`;
    return `${legend}<svg class="ch" viewBox="0 0 ${W} ${H}" width="${W}" role="img"><defs>${hatch}</defs>${grid}${marks}${xl}</svg>`;
  };
  const mdTable = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => " --- ").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => String(c ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`)].join("\n");
  const chartText = (b) => {
    const head = [b.type === "line" ? "x" : "", ...b.series.map((s) => `${s.name} (${s.basis || "measured"}${s.source ? `; ${s.source}` : ""})`)];
    return mdTable(head, b.x.map((c, i) => [c, ...b.series.map((s) => (s.values[i] == null ? "–" : `${s.values[i]}${b.unit === "%" ? "%" : b.unit ? " " + b.unit : ""}`))]));
  };

  // ── block rendering
  const flowBlock = (b) => {
    if (!b.today) return flowSvg(b.proposed);
    return `<div class="seg dtog" role="group"><button data-dg="today">Today</button><button class="on" data-dg="proposed">Proposed</button></div>
      <div class="dgv" data-v="today" hidden>${flowSvg(b.today)}</div><div class="dgv" data-v="proposed">${flowSvg(b.proposed)}</div>
      <div class="dkey"><span class="k new">New</span><span class="k changed">Changed</span><span class="k removed">Removed</span></div>`;
  };
  const body = {
    flow: flowBlock,
    chart: chartSvg,
    table: (b) => `<table class="dt"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
    code: (b) => (b.before != null
      ? `<div class="ba"><div><h5>Today</h5><pre><code>${esc(b.before)}</code></pre></div><div><h5>Proposed</h5><pre><code>${esc(b.after)}</code></pre></div></div>`
      : `<pre><code>${esc(b.after)}</code></pre>`),
    steps: (b) => `<ol class="st">${b.steps.map((s) => `<li>${s.actor ? `<b>${esc(s.actor)}</b>` : ""}${esc(s.text)}</li>`).join("")}</ol>`,
    html: (b) => b.html,
  };
  DESIGN.block = (b) => `<section class="db ${b.kind}">${b.title ? `<h4>${esc(b.title)}</h4>` : ""}${b.note ? `<p class="dn">${esc(b.note)}</p>` : ""}<div class="dbb">${(body[b.kind] || (() => ""))(b)}</div></section>`;

  const SPEC = [["today", "Today"], ["proposed", "Proposed"], ["files", "Files"], ["risks", "Risks & open questions"], ["verify", "How to verify"]];
  DESIGN.spec = (s) => `<div class="spec">${SPEC.filter(([k]) => s[k] && s[k].length).map(([k, l]) =>
    `<div class="${k}"><h5>${l}</h5><ul>${s[k].map((x) => `<li>${k === "files" ? `<code>${esc(x)}</code>` : esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`;

  DESIGN.section = (c) => (c.spec || (c.design && c.design.length)
    ? `<section class="design"><h3>Design</h3>${c.spec ? DESIGN.spec(c.spec) : ""}${(c.design || []).map(DESIGN.block).join("")}</section>` : "");

  // ── the same content as Markdown, for the hand-off
  const text = {
    flow: (b) => (b.today ? `Today:\n${flowText(b.today)}\n\nProposed:\n${flowText(b.proposed)}` : flowText(b.proposed)),
    chart: chartText,
    table: (b) => mdTable(b.head, b.rows),
    code: (b) => (b.before != null ? `Today:\n\`\`\`${b.lang || ""}\n${b.before}\n\`\`\`\nProposed:\n\`\`\`${b.lang || ""}\n${b.after}\n\`\`\`` : `\`\`\`${b.lang || ""}\n${b.after}\n\`\`\``),
    steps: (b) => b.steps.map((s, i) => `${i + 1}. ${s.actor ? `${s.actor}: ` : ""}${s.text}`).join("\n"),
    html: (b) => b.text || "(see the review page)",
  };
  DESIGN.markdown = (c, h = "####") => {
    const out = [];
    if (c.spec) for (const [k, l] of SPEC) if (c.spec[k] && c.spec[k].length) out.push(`${h} ${l}`, "", ...c.spec[k].map((x) => `- ${k === "files" ? `\`${x}\`` : x}`), "");
    for (const b of c.design || []) {
      out.push(`${h} ${b.title || b.kind}${b.kind === "flow" ? " (diagram)" : b.kind === "chart" ? ` (${b.type || "bar"} chart)` : ""}`, "");
      if (b.note) out.push(b.note, "");
      out.push((text[b.kind] || (() => ""))(b), "");
    }
    return out.join("\n");
  };

  // Today/Proposed toggles (delegated, so they work after every re-render).
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dg]");
    if (!btn) return;
    const box = btn.closest(".dbb");
    box.querySelectorAll("[data-dg]").forEach((b) => b.classList.toggle("on", b === btn));
    box.querySelectorAll(".dgv").forEach((v) => { v.hidden = v.dataset.v !== btn.dataset.dg; });
  });
})();
