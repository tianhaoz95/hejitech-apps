// The review's content: config + candidates. Replace everything below for a new review.
// render({ dark }) returns the inner HTML of one surface (a 390×844 phone screen for frame "phone");
// style it in css/candidates.css under `.scr.<id>` (and `.scr.<id>.dark`).
(() => {
  const { icon: I, statusBar, homeBar, items } = KIT;
  const phone = (body) => `${statusBar()}<div class="body">${body}</div>${homeBar()}`;

  window.REVIEW = {
    key: "2026-10-20-voxbrief-perf-quality-v1",                 // localStorage key; keep it across rounds so ratings survive
    dir: "reports/2026-10-20-voxbrief-perf-quality",             // repo-relative; heji-archive-reports rewrites it when archiving
    repo: "tianhaoz95/hejitech-apps",
    port: 8798,
    // The hand-off ("Copy summary") is read by an agent that never saw this conversation: fill these in.
    project: "projects/<name>",          // the project the work lands in
    context: ["projects/<name>/CLAUDE.md"],  // files to read first: the screens/services the candidates change
    brief: "What the user asked for, in their words, plus the constraints you settled in the brief.",
    title: "Voxbrief · 20 Performance & Quality Strategies",
    subtitle: "3 candidates + today's screen",
    heading: "Pick a direction",
    intro: "Each mock is live HTML: open one to scroll inside it. Heart the ones you like, rate them, write what you'd change in the box under each candidate, crown a winner, then <b>Copy summary</b> and paste it to any agent.",
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
        // Anything beyond looks (data, sync, services, ML/eval, performance) gets a spec and design blocks
        // (js/design.js): they show under the mocks and go into the hand-off as text.
        spec: {
          today: ["Trip colour is derived from the title hash at render time (TripCard)"],
          proposed: ["Store `accent` on the trip; pick it from the cover photo once, on import"],
          files: ["lib/models/trip.dart", "lib/services/import_service.dart", "lib/widgets/trip_card.dart"],
          risks: ["Old trips have no accent: fall back to the title hash"],
          verify: ["Import a trip with a photo → card uses its colour in light and dark"],
        },
        design: [
          { kind: "flow", title: "Where the colour comes from", note: "Illustrative example of a Today/Proposed diagram.",
            today: { nodes: [{ id: "t", label: "Trip", sub: "title", col: 0, row: 0, type: "store" }, { id: "c", label: "TripCard", sub: "hash(title)", col: 1, row: 0, type: "ui" }],
              edges: [{ from: "t", to: "c", label: "title" }] },
            proposed: { nodes: [{ id: "i", label: "Import", sub: "cover photo", col: 0, row: 0 }, { id: "p", label: "Palette", sub: "dominant colour", col: 1, row: 0, state: "new" },
              { id: "t", label: "Trip", sub: "+ accent", col: 2, row: 0, type: "store", state: "changed" }, { id: "c", label: "TripCard", sub: "trip.accent", col: 3, row: 0, type: "ui", state: "changed" }],
              edges: [{ from: "i", to: "p", label: "image", state: "new" }, { from: "p", to: "t", label: "accent", state: "new" }, { from: "t", to: "c" }] } },
          { kind: "chart", title: "Readable contrast (example numbers)", type: "bar", unit: "%", max: 100, x: ["Light", "Dark"],
            series: [{ name: "Cards passing 4.5:1 today", values: [72, 64], basis: "measured", source: "contrast script on 40 sample trips" },
              { name: "Goal", values: [100, 100], basis: "target" }] },
        ],
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
