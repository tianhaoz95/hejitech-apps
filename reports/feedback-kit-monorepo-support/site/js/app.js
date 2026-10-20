(() => {
  const D = window.D;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ── appearance (same control as the other reports; remembered per browser)
  const setMode = (m) => {
    if (m) document.documentElement.dataset.theme = m; else delete document.documentElement.dataset.theme;
    document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === (m || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"))));
    try { m ? localStorage.setItem("fkmono-theme", m) : localStorage.removeItem("fkmono-theme"); } catch {}
  };
  let saved = null; try { saved = localStorage.getItem("fkmono-theme"); } catch {}
  setMode(saved);
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

  // ── contents: highlight the section in view
  const links = [...document.querySelectorAll(".toc a")];
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll("main section").forEach((s) => io.observe(s));

  // ── tiny SVG helpers
  const box = (x, y, w, h, title, sub = "", cls = "") =>
    `<g class="node ${cls}" data-node="${cls.split(" ").pop()}"><rect class="box ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>` +
    `<text x="${x + 14}" y="${y + 24}" font-size="14" font-weight="700">${title}</text>` +
    (sub ? sub.split("\n").map((l, i) => `<text class="mut" x="${x + 14}" y="${y + 44 + i * 17}" font-size="12">${l}</text>`).join("") : "") + `</g>`;
  const tag = (x, y, text, kind) => {
    const w = text.length * 6.6 + 18;
    return `<g class="tag ${kind}"><rect x="${x}" y="${y}" width="${w}" height="22" rx="11"/><text x="${x + 9}" y="${y + 15}" font-size="11.5">${text}</text></g>`;
  };
  const line = (x1, y1, x2, y2, cls = "") => `<path class="edge ${cls}" d="M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" marker-end="url(#arr)"/>`;
  const defs = `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" style="color:var(--mut)"/></marker></defs>`;

  // ── 2 · architecture
  function arch(mode) {
    const P = mode === "proposed";
    let s = `<svg viewBox="0 0 1000 470" role="img" aria-label="Architecture ${mode}">${defs}`;
    // lanes
    s += `<rect class="lane" x="10" y="10" width="200" height="450" rx="14"/><text class="mut" x="24" y="34" font-size="12" font-weight="700">APPS (SDK)</text>`;
    s += `<rect class="lane" x="250" y="10" width="250" height="450" rx="14"/><text class="mut" x="264" y="34" font-size="12" font-weight="700">FEEDBACKKIT</text>`;
    s += `<rect class="lane" x="540" y="10" width="220" height="450" rx="14"/><text class="mut" x="554" y="34" font-size="12" font-weight="700">GITHUB · hejitech-apps</text>`;
    s += `<rect class="lane" x="800" y="10" width="190" height="450" rx="14"/><text class="mut" x="814" y="34" font-size="12" font-weight="700">AGENTS · CLI · CI</text>`;
    // apps
    s += box(26, 60, 168, 70, "Waypack app", "key pk_88dc…\niOS · Android · Mac", "waypack");
    s += box(26, 280, 168, 70, "Wee Hours app", "key pk_bdbb…\niPhone · Watch · glasses", "weehours");
    // projects
    s += box(266, 50, 218, P ? 120 : 92, "Project: Waypack", "repo tianhaoz95/hejitech-apps" + (P ? "\npath projects/waypack\nlabel fk:waypack" : "\npath —"), "waypack");
    s += box(266, 270, 218, P ? 120 : 92, "Project: Wee Hours", "repo tianhaoz95/hejitech-apps" + (P ? "\npath projects/weehours\nlabel fk:weehours" : "\npath —"), "weehours");
    // repo
    s += box(556, 50, 188, 62, "projects/waypack/", "Flutter app · Worker", "waypack");
    s += box(556, 128, 188, 62, "projects/weehours/", "iOS app · Worker · glasses", "weehours");
    s += box(556, 220, 188, 86, "Issues", P ? "[Waypack] … fk:waypack\n[Wee Hours] … fk:weehours" : "both apps' issues,\nunmarked");
    s += box(556, 330, 188, 62, "github-webhook", "repo → all its projects");
    // consumers
    s += box(816, 60, 158, 70, "Agent runner", P ? "per app: label filter\n+ working dir" : "one label, repo root");
    s += box(816, 170, 158, 62, "Prompt", P ? "names app + folder" : "no app / folder");
    s += box(816, 260, 158, 62, "CLI", P ? "feedbackkit.json" : "\"several projects\"");
    s += box(816, 350, 158, 62, "release (CI)", P ? "ancestry + path" : "ancestry only");
    // edges
    s += line(194, 95, 266, 95) + line(194, 315, 266, 315);
    s += line(484, 110, 556, 255, P ? "new" : "gap") + line(484, 330, 556, 270, P ? "new" : "gap");
    s += `<path class="edge" d="M556 361 C 520 361, 520 140, 484 120" marker-end="url(#arr)"/><path class="edge" d="M556 368 C 520 368, 520 340, 484 340" marker-end="url(#arr)"/>`;
    s += line(744, 250, 816, 95, P ? "new" : "gap");
    s += line(484, 160, 816, 200, P ? "new" : "gap");
    s += line(744, 158, 816, 290, P ? "new" : "gap");
    s += line(744, 82, 816, 380, P ? "new" : "gap");
    // tags
    if (P) {
      s += tag(266, 186, "+ github_path", "new") + tag(266, 406, "+ github_path", "new");
      s += tag(580, 194, "+ project label", "new") + tag(806, 134, "+ runner per app", "new") + tag(806, 236, "+ {{project_path}}", "new") + tag(806, 326, "+ walk-up config", "new") + tag(806, 420, "+ path check", "new");
    } else {
      s += tag(560, 410, "which app? which folder?", "gap") + tag(806, 134, "fires for both apps", "gap") + tag(806, 236, "app inferred", "gap") + tag(806, 326, "needs --project", "gap") + tag(806, 420, "no path check", "gap");
    }
    s += `</svg>`;
    $("#archFig").innerHTML = s;
    $("#archCaption").innerHTML = P
      ? "With a root directory, every consumer knows the app and its folder: issues carry the project label, each app has its own runner, prompts name the folder, the CLI reads <code>feedbackkit.json</code>, and releases check paths. The webhook path (grey) is unchanged; it already handles shared repos."
      : "Both projects point at the same repo with no folder. The webhook (grey) copes with that, but every consumer downstream has to guess which app an issue, prompt, folder or fix belongs to (red).";
  }
  document.querySelectorAll("[data-arch]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-arch]").forEach((x) => x.classList.toggle("on", x === b));
    arch(b.dataset.arch);
  }));
  arch("today");

  // ── 3 · prompt
  function prompt(mode) {
    $("#promptText").innerHTML = mode === "today" ? D.promptToday : D.promptProposed;
    $("#promptNote").innerHTML = D.promptNotes[mode];
  }
  document.querySelectorAll("[data-prompt]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-prompt]").forEach((x) => x.classList.toggle("on", x === b));
    prompt(b.dataset.prompt);
  }));
  prompt("today");

  // ── 4 · journey
  const J = [
    ["app", 30, 40, "Wee Hours app", "shake to report"],
    ["project", 230, 40, "FeedbackKit", "project Wee Hours"],
    ["issue", 430, 40, "GitHub issue", "[Wee Hours] fk:weehours"],
    ["runner", 630, 40, "Agent runner", "weehours workflow"],
    ["agent", 630, 190, "Agent", "in projects/weehours"],
    ["commit", 430, 190, "Fix commit", "FeedbackKit: 57827b45…"],
    ["webhook", 230, 190, "github-webhook", "links the fix"],
    ["release", 30, 190, "Release", "ancestry + path check"],
    ["app2", 30, 330, "Wee Hours app", "\"is it fixed?\""],
  ];
  let step = 0;
  function journey() {
    const at = D.journey[step];
    let s = `<svg viewBox="0 0 820 420" role="img" aria-label="Report journey">${defs}`;
    for (let i = 0; i < J.length - 1; i++) {
      const [, x1, y1] = J[i], [, x2, y2] = J[i + 1];
      const a = { x: x1 + 85, y: y1 + 36 }, b = { x: x2 + 85, y: y2 + 36 };
      s += `<path class="flow ${i < step ? "done" : ""}" d="M${a.x} ${a.y} L${b.x} ${b.y}"/>`;
    }
    J.forEach(([id, x, y, t, sub], i) => {
      const cls = i === step ? "active" : i > step ? "dim" : "";
      s += box(x, y, 170, 72, t, sub, `${cls} ${id}`);
    });
    const [, ax, ay] = J[step];
    s += `<circle class="dot" cx="${ax + 160}" cy="${ay + 10}" r="7"/>`;
    s += `</svg>`;
    $("#journeyFig").innerHTML = s;
    $("#stepNo").textContent = `STEP ${step + 1} / ${D.journey.length}`;
    $("#stepTitle").textContent = at.title;
    $("#stepBody").textContent = at.body;
    $("#stepChips").innerHTML = at.chips.map(([k, t]) => `<span class="${k}">${esc(t)}</span>`).join("");
    $("#prevStep").disabled = step === 0;
    $("#nextStep").textContent = step === D.journey.length - 1 ? "Restart ↺" : "Next →";
  }
  $("#prevStep").addEventListener("click", () => { step = Math.max(0, step - 1); journey(); });
  $("#nextStep").addEventListener("click", () => { step = step === D.journey.length - 1 ? 0 : step + 1; journey(); });
  journey();

  // ── 5 · CLI
  let cwd = "projects/weehours/apps/ios";
  function cli() {
    $("#tree").innerHTML = D.tree.map((t) =>
      `<button data-path="${t.path}" class="${t.path === cwd ? "on" : ""}">${"  ".repeat(t.depth)}${esc(t.label)}${t.cfg ? ` <span class="cfg">feedbackkit.json</span>` : ""}</button>`).join("");
    document.querySelectorAll("#tree button").forEach((b) => b.addEventListener("click", () => { cwd = b.dataset.path; cli(); }));
    // walk up
    const parts = cwd ? cwd.split("/") : [];
    const steps = [];
    let hit = null;
    for (let i = parts.length; i >= 0; i--) {
      const dir = parts.slice(0, i).join("/");
      const node = D.tree.find((t) => t.path === dir);
      const found = node && node.cfg;
      steps.push(`<li class="${found ? "hit" : ""}">${dir || "."}/feedbackkit.json ${found ? "✓ found" : "—"}</li>`);
      if (found) { hit = D.projects[node.cfg]; break; }
    }
    $("#cliOut").innerHTML = `<h3>$ cd ${esc(cwd || ".")} && feedbackkit list</h3>
      <ol class="walk">${steps.join("")}</ol>
      <div class="vs">
        <div><h4>Today</h4><span class="res-bad">Error:</span> You're in several projects. Pass --project &lt;id&gt; (or set FEEDBACKKIT_PROJECT_ID).</div>
        <div><h4>Proposed</h4>${hit ? `<span class="res-ok">${esc(hit.name)}</span> (${hit.id.slice(0, 8)}…), reports for <code>${hit.path}</code>` : `<span class="res-bad">No feedbackkit.json above this folder</span>: same error as today, plus "run feedbackkit init in an app's folder".`}</div>
      </div>`;
  }
  cli();

  // ── 6 · release
  function commits() {
    $("#commits").innerHTML = `<tr><th>In build</th><th>Commit</th><th>Fix for report</th><th>Touches</th></tr>` + D.commits.map((c, i) => `
      <tr><td><input type="checkbox" data-c="${i}" ${c.inBuild ? "checked" : ""} aria-label="in build"></td>
      <td><code>${c.sha}</code> ${esc(c.msg)}</td><td><code>${c.fix}…</code></td><td>${c.paths.map((p) => `<code>${esc(p)}</code>`).join("<br>")}</td></tr>`).join("");
    document.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("change", () => { D.commits[+b.dataset.c].inBuild = b.checked; $("#relOut").innerHTML = ""; }));
  }
  commits();
  $("#announce").addEventListener("click", () => {
    const path = D.projects.weehours.path + "/";
    const check = $("#pathCheck").checked;
    const rows = D.commits.map((c) => {
      if (!c.inBuild) return `<span class="skip">wait</span><span><code>${c.fix}…</code> fix ${c.sha} isn't in this build yet: ships with a later one.</span>`;
      const inPath = c.paths.some((p) => p.startsWith(path));
      if (!check || inPath) return `<span class="ship">ship</span><span><code>${c.fix}…</code> fix ${c.sha} is in this build${check ? " and touches projects/weehours" : ""}.${!inPath ? " <b>(No path check: this Waypack commit ships to Wee Hours reporters.)</b>" : ""}</span>`;
      return `<span class="warn">warn</span><span><code>${c.fix}…</code> fix ${c.sha} touches only <code>${esc(c.paths[0].split("/").slice(0, 2).join("/"))}</code>: probably a trailer on the wrong app's commit. Ships for now with a warning in the release output (projects can opt into skipping it); fix the link with <code>feedbackkit link</code>.</span>`;
    });
    $("#relOut").innerHTML = `<div class="verdict">${rows.join("")}</div><p class="note">The first two commits are real (today's Wee Hours fixes); the last two are illustrative.</p>`;
  });

  // ── 7 · data model
  (function model() {
    const col = (x, y, name, cols) => {
      let s = `<g><rect class="box" x="${x}" y="${y}" width="230" height="${34 + cols.length * 22}" rx="12"/><text x="${x + 14}" y="${y + 23}" font-size="14" font-weight="800">${name}</text>`;
      cols.forEach(([c, isNew], i) => {
        const yy = y + 48 + i * 22;
        s += isNew ? `<rect x="${x + 8}" y="${yy - 15}" width="214" height="20" rx="6" style="fill:var(--good-bg)"/>` : "";
        s += `<text x="${x + 14}" y="${yy}" font-size="12.5" style="${isNew ? "fill:var(--good);font-weight:700" : ""}" font-family="JetBrains Mono, monospace">${c}</text>`;
      });
      return s + `</g>`;
    };
    let s = `<svg viewBox="0 -6 1000 340" role="img" aria-label="Data model">${defs}`;
    s += col(20, 20, "projects", [["id, name, organization_id", 0], ["github_repo", 0], ["github_installation_id", 0], ["dispatch_labels[]", 0], ["github_path   ← new", 1], ["github_label  ← new", 1]]);
    s += col(330, 20, "products", [["project_id → projects", 0], ["key  (iphone, watch, web)", 0], ["name, is_default", 0]]);
    s += col(330, 160, "feedback_items", [["project_id → projects", 0], ["product_keys[]", 0], ["github_issue_number", 0], ["fix commit / PR", 0]]);
    s += col(660, 20, "releases", [["project_id → projects", 0], ["build, app_version, commit", 0], ["channel (beta | production)", 0]]);
    s += col(660, 160, "feedbackkit.json  (in the repo)", [["projectId", 1], ["path", 1]]);
    s += `<path class="edge" d="M250 70 L330 70" marker-end="url(#arr)"/><path class="edge" d="M250 120 C 290 120, 290 200, 330 200" marker-end="url(#arr)"/>`;
    s += `<path class="edge" d="M135 20 C 135 4, 760 4, 760 18" marker-end="url(#arr)"/><text class="mut" x="420" y="14" font-size="11">releases belong to a project</text>`;
    s += `<path class="edge new" d="M775 254 C 775 330, 135 330, 135 228" marker-end="url(#arr)"/><text x="400" y="322" font-size="11.5" style="fill:var(--good);font-weight:700">feedbackkit.json names the project (and its path)</text>`;
    s += `</svg>`;
    $("#modelFig").innerHTML = s;
  })();

  // ── 8 · rollout
  $("#phases").innerHTML = D.phases.map((p) => `<div class="phase"><div class="n">${p.n}</div><div>
    <h3>${esc(p.title)} <small>${esc(p.effort)}</small></h3><p style="margin:0">${esc(p.body)}</p>
    <div class="files">${p.files.map((f) => `<code>${esc(f)}</code>`).join("")}</div><div class="solves">${esc(p.solves)}</div></div></div>`).join("");

  // ── 9 · graduation sketch
  $("#gradFig").innerHTML = `<svg viewBox="0 0 520 120" role="img" aria-label="Graduation">${defs}
    ${box(10, 20, 210, 80, "Project: Wee Hours", "repo hejitech-apps\npath projects/weehours", "weehours")}
    ${box(300, 20, 210, 80, "Project: Wee Hours", "repo tianhaoz95/weehours\npath (empty)", "weehours")}
    <path class="edge new" d="M222 60 L298 60" marker-end="url(#arr)"/><text class="mut" x="232" y="50" font-size="11">edit 2 fields</text></svg>`;
})();
