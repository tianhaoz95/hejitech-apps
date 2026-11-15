// The report engine: light/dark toggle, table of contents from the <section>s, copy buttons on
// commands, checklists and the reader's notes saved per browser, design blocks from content.js, and
// "Copy summary": the whole page as Markdown (plus ticks, notes and next steps) for any agent.
// Don't fork it per report; improve the template's copy so the next report gets it too.
(() => {
  const R = window.REPORT || {};
  const KEY = R.key || "report";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(`${KEY}-${k}`)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(`${KEY}-${k}`, JSON.stringify(v)); } catch {} };
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); setTimeout(() => t.classList.remove("on"), 2200); };

  // ── theme
  const root = document.documentElement;
  const setMode = (m) => {
    if (m) root.dataset.theme = m; else delete root.dataset.theme;
    const cur = m || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    $$("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === cur));
    save("theme", m || null);
  };
  setMode(load("theme", null));
  $$("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

  // ── design blocks
  $$("[data-block]").forEach((el) => {
    const b = R.blocks?.[el.dataset.block];
    el.innerHTML = b && window.DESIGN?.block ? `<div class="design">${DESIGN.block(b)}</div>` : `<p class="note">Missing block: ${el.dataset.block}</p>`;
  });

  // ── numbered headings + table of contents
  const sections = $$("main > section[id]");
  let n = 0;
  sections.forEach((s) => { const h = $("h2", s); if (h && !$("span", h) && !s.hasAttribute("data-skip")) h.insertAdjacentHTML("afterbegin", `<span>${++n}</span>`); });
  $(".toc").innerHTML = sections.map((s) => {
    const h = $("h2", s) || $("h1", s);
    const num = $("h2 > span", s)?.textContent;
    const label = s.dataset.toc || (h ? [...h.childNodes].filter((c) => !(c.nodeType === 1 && c.tagName === "SPAN")).map((c) => c.textContent).join("").trim() : s.id);
    // Sub-entries: the section's own <h3>s (not those inside cards, design blocks or the hand-off);
    // data-toc on an <h3> shortens its label, data-notoc leaves it out.
    const subs = s.hasAttribute("data-skip") ? [] : $$("h3", s).filter((h3) => !h3.closest(".card, .design, .handoff, [data-notoc]"));
    return `<a href="#${s.id}">${num ? `${num} · ` : ""}${label}</a>` + subs.map((h3, i) => {
      if (!h3.id) h3.id = `${s.id}-${i + 1}`;
      return `<a class="sub" href="#${h3.id}">${h3.dataset.toc || h3.textContent.trim()}</a>`;
    }).join("");
  }).join("");
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) $$(".toc a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${e.target.id}`));
  }), { rootMargin: "-20% 0px -70% 0px" });
  sections.forEach((s) => spy.observe(s));

  // ── copy buttons on <pre class="cmd">: copies the text without trailing "# comments"
  $$("pre.cmd").forEach((pre) => pre.insertAdjacentHTML("afterbegin", "<button data-copy>Copy</button>"));
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const text = [...btn.parentElement.childNodes].filter((c) => c !== btn).map((c) => c.textContent).join("")
      .split("\n").map((l) => l.replace(/\s+#.*$/, "")).join("\n").trim();
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; } catch { btn.textContent = "Select and copy"; }
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });

  // ── copyable fields: <div class="fields"><div class="field" data-max="170"><b>Label</b><pre>value</pre></div></div>
  //    get a Copy button that copies the value exactly and, with data-max, a character count.
  $$(".field").forEach((f) => {
    const n = [...$("pre", f).textContent].length, max = Number(f.dataset.max || 0);
    f.classList.toggle("over", Boolean(max) && n > max);
    $("b", f).insertAdjacentHTML("afterend", `<span class="meta">${max ? `${n} / ${max}` : ""}<button data-copy-field>Copy</button></span>`);
  });
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy-field]");
    if (!btn) return;
    try { await navigator.clipboard.writeText($("pre", btn.closest(".field")).textContent); btn.textContent = "Copied"; } catch { btn.textContent = "Select and copy"; }
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });

  // ── checklists: <ul class="checks"><li><input type="checkbox" id="unique"><span><b>…</b><small>…</small></span></li>
  const ticks = load("ticks", {});
  const boxes = $$(".checks input[type=checkbox]");
  const tally = () => ({ done: boxes.filter((b) => b.checked).length, total: boxes.length });
  const progress = () => { const p = $("#progress"); if (p) { const t = tally(); p.textContent = `${t.done} of ${t.total} done`; } };
  boxes.forEach((b) => {
    b.checked = Boolean(ticks[b.id]);
    b.closest("li").classList.toggle("done", b.checked);
    b.addEventListener("change", () => { ticks[b.id] = b.checked; b.closest("li").classList.toggle("done", b.checked); save("ticks", ticks); progress(); });
  });
  progress();

  // ── notes + copy summary
  const notes = $("#notes");
  notes.value = load("notes", "");
  notes.addEventListener("input", () => save("notes", notes.value));

  const inline = (el) => [...el.childNodes].map((c) => {
    if (c.nodeType === 3) return c.textContent;
    if (c.nodeType !== 1 || c.matches("button, input, script, style")) return "";
    const t = inline(c);
    if (c.tagName === "CODE") return `\`${c.textContent}\``;
    if (c.tagName === "B" || c.tagName === "STRONG") return t.trim() ? `**${t.trim()}**` : "";
    if (c.tagName === "I" || c.tagName === "EM") return t.trim() ? `*${t.trim()}*` : "";
    if (c.tagName === "A" && c.getAttribute("href") && !c.getAttribute("href").startsWith("#")) return `[${t}](${c.getAttribute("href")})`;
    if (c.tagName === "BR") return " ";
    if (c.tagName === "SMALL") return t.trim() ? ` (${t.trim()})` : "";
    return t;
  }).join("").replace(/\s+/g, " ");
  const md = (el, out) => {
    for (const c of el.children) {
      const tag = c.tagName;
      if (c.matches("script, style, button, .toc, .progress, [data-skip]")) continue;
      if (c.dataset.block) { const b = R.blocks?.[c.dataset.block]; if (b) out.push(DESIGN.markdown({ design: [b] }, "###")); continue; }
      if (/^H[1-4]$/.test(tag)) {
        const num = $(":scope > span", c);
        const text = inline(c).trim();
        const plain = num && text.startsWith(num.textContent) ? text.slice(num.textContent.length).trim() : text;
        out.push(`${"#".repeat(Math.max(2, Number(tag[1])))} ${num ? `${num.textContent}. ` : ""}${plain}`, "");
      }
      else if (tag === "P") { const t = inline(c).trim(); if (t) out.push(c.matches(".kicker") ? `_${t}_` : t, ""); }
      else if (tag === "UL" || tag === "OL") {
        $$(":scope > li", c).forEach((li, i) => {
          const box = $("input[type=checkbox]", li);
          out.push(`${box ? `- [${box.checked ? "x" : " "}]` : tag === "OL" ? `${i + 1}.` : "-"} ${inline(li).trim()}`);
        });
        out.push("");
      }
      else if (c.matches("table.kv")) { $$("tr", c).forEach((tr) => out.push(`- **${inline($("th", tr) || tr).trim()}**: ${inline($("td", tr) || tr).trim()}`)); out.push(""); }
      else if (tag === "TABLE") {
        const rows = $$("tr", c).map((tr) => $$("th, td", tr).map((d) => inline(d).trim().replace(/\|/g, "\\|")));
        if (rows.length) {
          const head = $("thead", c) ? rows.shift() : rows[0].map(() => "");
          out.push(`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`), "");
        }
      }
      else if (tag === "PRE") out.push("```", [...c.childNodes].filter((x) => !(x.nodeType === 1 && x.matches("button"))).map((x) => x.textContent).join("").trim(), "```", "");
      else if (tag === "FIGURE") {
        if (c.querySelector("img")) $$("img", c).forEach((img) => out.push(`- Image \`site/${img.getAttribute("src")}\`: ${img.alt}`));
        const cap = $("figcaption", c); if (cap) out.push(`  ${inline(cap).trim()}`);
        if ($("svg", c) && !c.querySelector("img")) out.push(`(diagram: ${$("svg", c).getAttribute("aria-label") || "see the page"})`);
        out.push("");
      }
      else if (c.matches(".fields")) {
        $$(".field", c).forEach((f) => {
          const label = inline($("b", f)).trim(), v = $("pre", f).textContent.trim();
          out.push(v.includes("\n") ? `- **${label}**:\n\n\`\`\`\n${v}\n\`\`\`\n` : `- **${label}**: ${v}`);
        });
        out.push("");
      }
      else if (c.matches(".status")) { $$(":scope > div", c).forEach((d) => out.push(`- ${inline($("b", d)).trim()}: ${inline($("span", d) || d).trim()}`)); out.push(""); }
      else if (c.matches(".callout, .note, .unknown")) { const t = inline(c).trim(); if (t) out.push(`> ${t}`, ""); }
      else md(c, out);                          // containers: cards, grids, divs
    }
    return out;
  };
  const handoff = () => {
    const t = tally(), steps = R.nextSteps ? R.nextSteps({ ticks: t, notes: notes.value }) : [];
    const placeholder = (s) => !s || /<[^>]+>|^the user's ask/.test(s);
    return [
      `# Report hand-off: ${R.title || document.title}`, "",
      `- Report: \`${R.dir}\` (serve: \`${R.dir}/script/serve.sh\`, http://localhost:${R.port}/)`,
      R.repo && !placeholder(R.repo) ? `- Repo: ${R.repo}` : null,
      R.project && !placeholder(R.project) ? `- Project: \`${R.project}\`` : null,
      ...(R.context || []).filter((c) => !placeholder(c)).map((c, i) => `${i ? "  " : "- Read first: "}\`${c}\``),
      !placeholder(R.brief) ? `- Brief: ${R.brief}` : null,
      t.total ? `- Checklist: ${t.done} of ${t.total} done` : null,
      "", "## Reader's notes", "", notes.value.trim() || "(none)", "",
      "## The report", "", ...md($("main"), []),
      "## What to do next", "", ...(steps.length ? steps : ["Act on the reader's notes, then update the report."]).map((s) => `- ${s}`),
    ].filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
  };
  window.REPORT_HANDOFF = handoff;               // for headless checks
  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(handoff()); toast("Hand-off copied: paste it to any agent"); }
    catch { toast("Clipboard blocked: run REPORT_HANDOFF() in the console"); }
  });
})();
