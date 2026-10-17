// The review's content: config + candidates. Replace everything below for a new review.
// render({ dark }) returns the inner HTML of one surface (a 390×844 phone screen for frame "phone");
// style it in css/candidates.css under `.scr.<id>` (and `.scr.<id>.dark`).
(() => {
  const { icon: I, statusBar, homeBar, items } = KIT;
  const phone = (body) => `${statusBar()}<div class="body">${body}</div>${homeBar()}`;

  window.REVIEW = {
    key: "__SLUG__-v1",                 // localStorage key; keep it across rounds so ratings survive
    dir: "reports/__SLUG__",
    title: "__TITLE__",
    subtitle: "3 candidates + today's screen",
    heading: "Pick a direction",
    intro: "Each mock is live HTML: open one to scroll inside it. Heart the ones you like, rate them, write what you'd change, crown a winner, then <b>Copy summary</b> and paste it back to Claude.",
    legend: ["<b>3</b> sample items"],
    round: 1,                            // bump when adding candidates in response to feedback
    frame: "phone",                      // "phone" | "browser" (with url) | "card" / "icon" (with size: [w, h])
    // groups: [{ id: "home", name: "Home" }, { id: "detail", name: "Trip detail" }],  // one winner per group
    // metrics: (c, scr) => [{ text: `${scr.querySelectorAll("[data-item]").length} items`, good: false }],
    candidates: [
      {
        id: "current", n: 0, name: "Current app", baseline: true,
        tagline: "Today's screen, for comparison",
        render: () => phone(`<h1>Trips</h1>${items.map((t) => `<div class="row" data-item><b>${t.title}</b><small>${t.sub}</small></div>`).join("")}`),
      },
      {
        id: "calm", n: 1, name: "Calm list", round: 1,
        tagline: "Quiet rows, one accent colour",
        concept: "Why this direction exists, in two or three sentences: the idea, who it serves, the trade-off.",
        moves: ["Rows instead of cards", "Accent only on the next item"],
        palette: [["Paper", "#FBF7F1"], ["Ink", "#2B221C"], ["Accent", "#C8603A"]],
        facts: { Type: "Inter 15/600 titles", Effort: "S", Needs: "Nothing new" },
        render: () => phone(`<h1>Trips</h1>${items.map((t, i) => `<div class="row${i ? "" : " next"}" data-item><b>${t.title}</b><small>${t.sub}</small>${I("chevron", 16)}</div>`).join("")}`),
      },
      {
        id: "bold", n: 2, name: "Bold cards", round: 1, prefers: "dark",
        tagline: "Big type, designed for dark",
        concept: "A darker, more graphic take.",
        moves: ["Display-size titles", "Full-bleed colour per item"],
        palette: [["Night", "#17120F"], ["Ember", "#E98A5F"]],
        facts: { Effort: "M", Needs: "A colour per item" },
        render: () => phone(`<h1>Trips</h1>${items.map((t) => `<div class="tile" data-item><b>${t.title}</b><small>${t.sub}</small></div>`).join("")}`),
      },
      {
        id: "dense", n: 3, name: "Dense table", round: 1,
        tagline: "Everything on one screen",
        concept: "Maximum density for people with many items.",
        moves: ["Two-line rows", "Inline status"],
        palette: [["White", "#FFFFFF"], ["Slate", "#3A4250"]],
        facts: { Effort: "S", Needs: "Nothing new" },
        render: () => phone(`<h1>Trips</h1>${items.map((t) => `<div class="tight" data-item><b>${t.title}</b><small>${t.sub}</small></div>`).join("")}`),
      },
    ],
  };
})();
