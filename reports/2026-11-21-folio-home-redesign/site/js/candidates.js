// Folio iPhone home redesign: today's screen + 8 directions. Styles: css/candidates.css (.scr.<id>).
(() => {
  const { icon: I, starFill, statusBar, homeBar, mark, items, review, favorites, rest, others, suggTotal, roleLabel, esc, thumb, agentDot } = KIT;
  const phone = (body) => `${statusBar()}<div class="body">${body}</div>${homeBar()}`;
  const linkIcon = (a) => (a.vis === "link" ? `<span class="lk" title="Anyone with the link">${I("link", 11, 2.4)}</span>` : "");
  const star = (a) => (a.fav ? `<span class="st">${starFill(11)}</span>` : "");
  const sugg = (a, cls = "bd") => (a.sugg ? `<span class="${cls}">${a.sugg}</span>` : "");
  const desc = (a) => (a.desc ? `<span class="ds">${esc(a.desc)}</span>` : "");

  // ── 0. Today (HomeView.swift + ArtifactRow): inset grouped list on paper, 38pt tile, title (2 lines),
  // description (2 lines), "v14 · 12 minutes ago · Editor · link", coral count of open suggestions.
  const currentRow = (a) => `<div class="row" data-item>
      <span class="tile">${I("doc", 20, 1.8)}</span>
      <span class="tx"><b>${star(a)}${esc(a.title)}</b>${desc(a)}
        <small>v${a.v} · ${esc(a.agoLong)}${roleLabel(a) ? ` · ${roleLabel(a)}` : ""}${a.vis === "link" ? ` ${I("link", 11, 2.4)}` : ""}</small></span>
      ${sugg(a)}</div>`;
  const currentGroup = (title, list) => `${title ? `<h6>${title}</h6>` : ""}<div class="igrp">${list.map(currentRow).join("")}</div>`;
  const current = () => phone(`
    <div class="nav"><span class="ib">${I("personCircle", 22, 1.7)}</span><span class="ib dot">${I("bell", 21, 1.8)}</span></div>
    <h1>Folio</h1>
    <div class="search">${I("search", 16, 2.2)}Search artifacts</div>
    ${currentGroup("Needs your review", review)}${currentGroup("Favorites", favorites)}${currentGroup("Artifacts", rest)}`);

  // ── 1. Tight list: same sections, one-line titles, no tile.
  const tightRow = (a) => `<div class="row" data-item>
      <span class="pip${a.sugg ? " on" : ""}"></span>
      <span class="tx"><span class="l1"><b>${esc(a.title)}</b><time>${esc(a.ago)}</time></span>
        <span class="l2">${star(a)}${a.desc ? esc(a.desc) : `v${a.v}`}${linkIcon(a)}</span></span>
      ${sugg(a)}</div>`;
  const tight = () => phone(`
    <div class="top"><h1>Folio</h1><span class="ib">${I("bell", 20, 1.9)}<i></i></span><span class="ib">${I("personCircle", 21, 1.8)}</span></div>
    <div class="search">${I("search", 15, 2.2)}Search</div>
    <h6>Needs your review <em>${suggTotal}</em></h6>${review.map(tightRow).join("")}
    <h6>Favorites</h6>${favorites.map(tightRow).join("")}
    <h6>All artifacts</h6>${rest.map(tightRow).join("")}`);

  // ── 2. Inbox: one list, filter chips instead of sections, mail-style rows.
  const inboxRow = (a) => `<div class="row" data-item>
      <span class="dot${a.sugg ? " on" : ""}"></span>
      <span class="tx"><span class="l1"><b>${esc(a.title)}</b><time>${esc(a.ago)}</time></span>
        <span class="l2"><span class="ds">${a.desc ? esc(a.desc) : "No description"}</span>${star(a)}${linkIcon(a)}</span>
        ${a.sugg ? `<span class="tag">${a.sugg} suggestion${a.sugg > 1 ? "s" : ""} to review</span>` : ""}</span></div>`;
  const inbox = () => phone(`
    <div class="top"><span class="ib">${I("personCircle", 22, 1.7)}</span><h2>Folio</h2><span class="ib">${I("bell", 20, 1.9)}<i></i></span></div>
    <div class="search">${I("search", 15, 2.2)}Search artifacts</div>
    <div class="chips"><span class="on">All <em>${items.length}</em></span><span>To review <em class="c">${review.length}</em></span><span>Favorites</span><span>Shared with me</span></div>
    ${[...review, ...others].map(inboxRow).join("")}`);

  // ── 3. Today strip: a summary row of counts, favorites as chips, then a compact list by day.
  const briefRow = (a) => `<div class="row" data-item>${thumb(a, 34, 34)}
      <span class="tx"><b>${esc(a.title)}</b><small>v${a.v}${roleLabel(a) ? ` · ${roleLabel(a)}` : ""}${a.vis === "link" ? " · Link" : ""}</small></span>
      <time>${esc(a.ago)}</time></div>`;
  const today = others.filter((a) => /m$|h$/.test(a.ago));
  const week = others.filter((a) => /Yesterday|Thu|Wed|Tue/.test(a.ago));
  const earlier = others.filter((a) => !today.includes(a) && !week.includes(a));
  const brief = () => phone(`
    <div class="top">${mark(24)}<h2>Folio</h2><span class="ib">${I("search", 19, 2)}</span><span class="ib">${I("bell", 19, 1.9)}<i></i></span><span class="ib">${I("personCircle", 21, 1.8)}</span></div>
    <div class="stats">
      <div class="s c"><b>${suggTotal}</b><span>suggestions<br>to review</span></div>
      <div class="s n"><b>4</b><span>changed<br>today</span></div>
      <div class="s m"><b>10</b><span>open<br>comments</span></div>
    </div>
    <h6>To review</h6>
    ${review.map((a) => `<div class="rv" data-item><span class="n">${a.sugg}</span><span class="tx"><b>${esc(a.title)}</b><small>from ${esc(a.agent)} · ${esc(a.ago)}</small></span>${I("chevron", 14, 2.4)}</div>`).join("")}
    <h6>Favorites</h6>
    <div class="favs">${favorites.map((a) => `<span class="fv" data-item>${thumb(a, 26, 20)}${esc(a.title)}</span>`).join("")}</div>
    <h6>Today</h6>${today.map(briefRow).join("")}
    <h6>This week</h6>${week.map(briefRow).join("")}
    <h6>Earlier</h6>${earlier.map(briefRow).join("")}`);

  // ── 4. Glance grid: two columns of small cards with a page preview.
  const gridCard = (a) => `<div class="card" data-item>
      <div class="pv k-${a.kind}">${thumb(a, 164, 84, "meet")}${a.sugg ? `<span class="bd">${a.sugg}</span>` : ""}${a.fav ? `<span class="st">${starFill(12)}</span>` : ""}</div>
      <b>${esc(a.title)}</b><small>${esc(a.ago)} · v${a.v}${a.vis === "link" ? " · Link" : ""}</small></div>`;
  const grid = () => phone(`
    <div class="top"><h1>Folio</h1><span class="ib">${I("list", 19, 2)}</span><span class="ib">${I("bell", 19, 1.9)}<i></i></span><span class="ib">${I("personCircle", 21, 1.8)}</span></div>
    <div class="search">${I("search", 15, 2.2)}Search artifacts</div>
    <div class="cards">${[...review, ...favorites, ...rest].map(gridCard).join("")}</div>`);

  // ── 5. Bauhaus: the mark's three shapes become the section markers; type does the work.
  const bauRow = (a) => `<div class="row" data-item>
      <span class="tx"><b>${esc(a.title)}</b>${a.desc ? `<span class="ds">${esc(a.desc)}</span>` : ""}</span>
      <span class="mt">${a.sugg ? `<span class="bd">${a.sugg}</span>` : `<time>${esc(a.ago)}</time>`}${a.vis === "link" ? I("link", 11, 2.4) : ""}</span></div>`;
  const bauhaus = () => phone(`
    <div class="top">${mark(26)}<span class="wm">folio</span><span class="ib">${I("search", 19, 2.1)}</span><span class="ib">${I("bell", 19, 2)}<i></i></span><span class="ib av">TZ</span></div>
    <h6><span class="g q"></span>Review <em>${suggTotal}</em></h6>${review.map(bauRow).join("")}
    <h6><span class="g d"></span>Favorites</h6>${favorites.map(bauRow).join("")}
    <h6><span class="g b"></span>Everything</h6>${rest.map(bauRow).join("")}`);

  // ── 6. Agent feed: each row says who changed it last; review rows carry the agent's ask.
  const feedRow = (a) => `<div class="row${a.sugg ? " hot" : ""}" data-item>
      ${agentDot(a.agent, 30)}
      <span class="tx"><span class="l0"><b>${esc(a.agent)}</b> ${a.sugg ? `suggested ${a.sugg} change${a.sugg > 1 ? "s" : ""}` : `saved v${a.v}`}<time>${esc(a.ago)}</time></span>
        <span class="l1">${star(a)}${esc(a.title)}</span>
        ${a.sugg ? `<span class="acts"><span class="ok">Review</span><span>Open</span></span>` : ""}</span></div>`;
  const feed = () => phone(`
    <div class="top"><h1>Folio</h1><span class="ib">${I("search", 19, 2)}</span><span class="ib">${I("personCircle", 21, 1.8)}</span></div>
    <div class="sgm"><span class="on">Latest</span><span>Review <em>${review.length}</em></span><span>Favorites</span></div>
    ${[...review, ...others].map(feedRow).join("")}`);

  // ── 7. Ledger: a table: title, version, when. The most rows per screen.
  const ledgerRow = (a) => `<div class="row" data-item>
      <span class="c0">${a.sugg ? `<span class="bd">${a.sugg}</span>` : a.fav ? `<span class="st">${starFill(10)}</span>` : ""}</span>
      <span class="c1">${esc(a.title)}${a.vis === "link" ? ` ${I("link", 10, 2.6)}` : ""}${a.role !== "owner" ? ` <i>${roleLabel(a)}</i>` : ""}</span>
      <span class="c2">v${a.v}</span><span class="c3">${esc(a.ago)}</span></div>`;
  const ledger = () => phone(`
    <div class="top"><h2>Folio</h2><span class="ib">${I("search", 18, 2.1)}</span><span class="ib">${I("bell", 18, 2)}<i></i></span><span class="ib">${I("personCircle", 20, 1.8)}</span></div>
    <div class="sgm"><span class="on">All ${items.length}</span><span>Review ${review.length}</span><span>Starred ${items.filter((a) => a.fav).length}</span><span>Shared</span></div>
    <div class="hd"><span class="c0"></span><span class="c1">Title</span><span class="c2">Ver</span><span class="c3">Updated</span></div>
    ${[...review, ...others].map(ledgerRow).join("")}`);

  // ── 8. Floating glass: iOS 26 Liquid Glass: content to the edges, the controls float at the bottom.
  const glassRow = (a) => `<div class="row" data-item>${thumb(a, 40, 40)}
      <span class="tx"><span class="l1"><b>${esc(a.title)}</b>${sugg(a)}</span>
        <small>${star(a)}${esc(a.ago)} · v${a.v}${roleLabel(a) ? ` · ${roleLabel(a)}` : ""}${linkIcon(a)}</small></span></div>`;
  const glass = () => phone(`
    <div class="top"><span class="gb">${I("personCircle", 20, 1.8)}</span><span class="gb">${I("bell", 19, 1.9)}<i></i></span></div>
    <h1>Folio</h1>
    <div class="pin"><span class="lbl">Needs review</span>${review.map((a) => `<div class="rv" data-item>${thumb(a, 30, 30)}<b>${esc(a.title)}</b><span class="bd">${a.sugg}</span></div>`).join("")}</div>
    <div class="lst">${[...favorites, ...rest].map(glassRow).join("")}</div>
    <div class="dock"><div class="gtabs"><span class="on">${I("home", 18, 2)}Home</span><span>${I("inbox", 18, 2)}Review<em>${suggTotal}</em></span><span>${I("pulse", 18, 2)}Activity</span></div><span class="sbtn">${I("search", 19, 2.2)}</span></div>`);

  window.REVIEW = {
    key: "2026-11-21-folio-home-redesign-v1",
    dir: "reports/2026-11-21-folio-home-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8844,
    project: "projects/folio",
    context: [
      "projects/folio/CLAUDE.md",
      "projects/folio/apps/ios/App/Sources/Views/HomeView.swift",
      "projects/folio/apps/ios/App/Sources/Theme.swift",
      "projects/folio/apps/ios/FolioKit/Sources/FolioKit/Models.swift",
      "projects/folio/brand/README.md",
    ],
    brief: "Owner: a Folio UI redesign that looks simpler and more modern, with a more compact home screen: today you don't see much information while some elements are fairly large. This round is the iPhone app's home (the artifact list in HomeView.swift); the winner's look then carries to the other screens and the web dashboard. Keep Folio's Bauhaus palette (paper, navy, coral, mustard) and what the home does today: needs-review first, favorites, search, settings, activity with an unread dot, swipe to favorite/delete, long-press to copy for an agent.",
    title: "Folio home redesign",
    subtitle: "8 directions + today's screen · iPhone home",
    heading: "A simpler, more compact Folio home",
    intro: "Every mock is live HTML with the same 13 sample artifacts (three with suggestions to review, three favorites, one with no description, a long title, editor/viewer roles, link-shared ones). The chip under each card counts how many artifacts are on the first screen. Open one to scroll inside it, use Light/Dark at the top, heart and rate, write what you'd change in the box under each candidate, crown a winner, then <b>Copy summary</b> and paste it to any agent.",
    legend: ["<b>13</b> sample artifacts", "<b>3</b> to review · <b>4</b> suggestions", "Saturday evening, Nov 21"],
    round: 1,
    frame: "phone",
    metrics: (c, scr) => {
      const box = scr.getBoundingClientRect();
      const top = box.top, h = box.height;
      const seen = new Set();
      scr.querySelectorAll("[data-item]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom - top <= h - 4 && r.height > 0) seen.add(el);
      });
      const n = seen.size;
      return [{ text: `${n} artifact${n === 1 ? "" : "s"} on the first screen`, good: n >= 9 }];
    },
    candidates: [
      {
        id: "current", n: 0, name: "Today", baseline: true,
        tagline: "HomeView as it ships in 0.2.6",
        concept: "Inset grouped List on paper: Needs your review, Favorites, Artifacts. Each row has a 38pt document tile, a semibold title up to two lines, a two-line description and a version/time/role line.",
        render: current,
      },
      {
        id: "tight", n: 1, name: "Tight list", round: 1,
        tagline: "Today's screen, half the height per row",
        concept: "Keeps everything people already know (the same three sections, search, swipes) and only takes the air out: no tile, a one-line title with the time on the right, one line of description. The smallest change that roughly doubles what fits.",
        moves: ["Plain list on paper instead of inset grouped cards", "Drop the 38pt document tile; a coral pip marks suggestions", "Title one line, time right-aligned; description one line", "Title row with the icons beside a 28pt title instead of a 34pt large title"],
        palette: [["Paper", "#f4f0e8"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"], ["Mustard", "#f2b630"]],
        facts: { Type: "SF Pro 16/600 titles, 13 meta", Effort: "S", Needs: "Nothing new" },
        render: tight,
      },
      {
        id: "inbox", n: 2, name: "Inbox", round: 1,
        tagline: "One list, filters as chips, mail-style rows",
        concept: "Treats Folio like a mailbox: sections give way to a single list (things to review sorted first) and filter chips for To review / Favorites / Shared with me. Rows read like Mail: title and time, one line of description, a coral line when something waits for you.",
        moves: ["Filter chips replace section headers", "Mail-style two-line rows with an unread-style coral dot", "Compact inline title between the toolbar icons", "\"2 suggestions to review\" spelled out on the row"],
        palette: [["Paper", "#f4f0e8"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"]],
        facts: { Type: "SF Pro 16/600, 14 description", Effort: "S", Needs: "A client-side \"Shared with me\" filter (role != owner); nothing on the server" },
        render: inbox,
      },
      {
        id: "brief", n: 3, name: "Today strip", round: 1,
        tagline: "What changed at a glance, then everything by day",
        concept: "Opens with three counts (suggestions to review, changed today, open comments), the items waiting for review with which agent asked, favorites as small chips, then the rest grouped Today / This week / Earlier. More to look at, but each part is compact.",
        moves: ["Three-count summary strip at the top", "Review rows name the agent that suggested", "Favorites as a wrapping row of chips", "Rest of the list grouped by day with small previews"],
        palette: [["Paper", "#f4f0e8"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"], ["Mustard", "#f2b630"]],
        facts: { Type: "SF Pro, 28 bold numbers", Effort: "M", Needs: "unresolved_comments and the suggesting agent in the list API (GET /api/artifacts); a small preview per artifact (or a kind icon)" },
        render: brief,
      },
      {
        id: "grid", n: 4, name: "Glance grid", round: 1,
        tagline: "Two columns of cards with a page preview",
        concept: "Artifacts are pages, so show them: a two-column grid of small cards with a preview of the page, title and age. The most modern-looking, and you recognise a page by its look, but it fits fewer items than a list; a toggle in the toolbar switches to a list.",
        moves: ["Two-column cards with a preview of the page", "Badges for suggestions and favorites on the preview", "Grid/list toggle in the toolbar"],
        palette: [["Paper", "#f4f0e8"], ["Card", "#ffffff"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"]],
        facts: { Type: "SF Pro 14/600 two-line titles", Effort: "L", Needs: "A thumbnail of each artifact's page from the server (rendered at save time); the mock's abstract shapes stand in for it" },
        render: grid,
      },
      {
        id: "bauhaus", n: 5, name: "Bauhaus", round: 1,
        tagline: "The logo's shapes as the only decoration",
        concept: "Pure type on paper, with the mark's quarter circle, dot and bar as the section markers for Review, Favorites and Everything. No tiles, no cards, no large title; a lowercase wordmark next to the mark. Simple and very Folio, with descriptions kept to one quiet line.",
        moves: ["Wordmark + mark replace the 34pt large title", "Coral quarter circle, mustard dot and navy bar mark the three sections", "Rows: title, one light line of description, time or suggestion count on the right", "Hairline rules only, no grouped backgrounds"],
        palette: [["Paper", "#f2ede4"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"], ["Mustard", "#f2b630"], ["Ink", "#1b1d24"]],
        facts: { Type: "Space Grotesk wordmark and headers, SF Pro rows", Effort: "M", Needs: "A bundled display font (or SF Pro Rounded as a no-font fallback)" },
        render: bauhaus,
      },
      {
        id: "feed", n: 6, name: "Agent feed", round: 1,
        tagline: "Each row says which agent did what",
        concept: "Folio's point is agents working on your pages, so the home reads like a feed: the agent's badge, what it did (saved v14, suggested 2 changes) and the artifact. Suggestions get Review / Open right on the row. Very clear about activity, less of a library.",
        moves: ["Agent badge and action line on every row", "Review and Open buttons on rows with suggestions", "Latest / Review / Favorites segmented control", "Activity bell folds into the feed (the Activity sheet stays for comments and history)"],
        palette: [["Paper", "#f4f0e8"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"]],
        facts: { Type: "SF Pro 15 rows", Effort: "M", Needs: "The head version's agent (and the latest open suggestion's agent) in GET /api/artifacts" },
        render: feed,
      },
      {
        id: "ledger", n: 7, name: "Ledger", round: 1,
        tagline: "A table: the most rows on one screen",
        concept: "For a big library: a compact table with Title, Ver and Updated columns, 36pt rows and a segmented filter. Suggestions are a coral number in the first column, favorites a mustard star. Fits the most by far; loses the descriptions.",
        moves: ["Column header and 36pt one-line rows", "Segmented All / Review / Starred / Shared", "Suggestion count and star in a narrow first column", "Monospaced version and date columns"],
        palette: [["Paper", "#f4f0e8"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"], ["Mustard", "#f2b630"]],
        facts: { Type: "SF Pro 15, SF Mono 12 columns", Effort: "S", Needs: "Nothing new" },
        render: ledger,
      },
      {
        id: "glass", n: 8, name: "Floating glass", round: 1,
        tagline: "iOS 26 Liquid Glass, controls at the bottom",
        concept: "The newest iOS look: content runs to the edges, the toolbar buttons are glass circles and a floating glass bar at the bottom holds Home / Review / Activity and search, within thumb reach. Review sits in a compact pinned card; rows are two lines with a small preview.",
        moves: ["Floating glass tab bar + search button at the bottom", "Glass circle buttons for settings and activity", "Needs-review pinned as one compact card", "Two-line rows with a 40pt preview"],
        palette: [["Paper", "#f4f0e8"], ["Glass", "rgba(255,255,255,.6)"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"]],
        facts: { Type: "SF Pro 16/600", Effort: "M", Needs: "iOS 26 glass effects (glassEffect / tab bar minimise); a Review tab and an Activity tab instead of sheets" },
        render: glass,
      },
    ],
  };
})();
