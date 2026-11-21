// Folio logo redesign · round 1: today's icon + 10 modern, simple directions.
// Every mark is drawn in a 1024×1024 space by draw({ mode, uid }); KIT clips it to the iOS squircle,
// Android circle, Mac tile or favicon tile. mode "dark" = the iOS dark-mode icon variant.
(() => {
  const C = [];
  const add = (c) => C.push(KIT.attachViews(c));
  const pick = (mode, light, dark) => (mode === "dark" ? dark : light);
  const common = { Effort: "S", Needs: "Nothing new: replace AppIcon.png (+ a dark variant), services/web/public/icon.svg and docs/public/icon.png" };

  // A page with a folded top-right corner (rounded other corners). x,y,w,h, fold size f, radius r.
  const page = (x, y, w, h, f, r) =>
    `M${x + r} ${y} H${x + w - f} L${x + w} ${y + f} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
  const flap = (x, y, w, f, r = 32) => `M${x + w - f} ${y} V${y + f - r} Q${x + w - f} ${y + f} ${x + w - f + r} ${y + f} H${x + w} Z`;

  // ── 00 · Today (projects/folio/apps/ios/.../AppIcon.png, services/web/public/icon.svg ×16)
  add({
    id: "current", n: 0, baseline: true,
    name: "Current icon",
    tagline: "Two stacked documents with text lines on a cobalt gradient",
    concept: "Today's Folio icon: a white document with a folded corner and two text lines, a translucent second document behind it, on a cobalt (#2f5bea) gradient. Clear, but it reads as a generic 'files/docs' icon and the fold outline and lines get busy below 32px.",
    palette: [["Cobalt", "#2f5bea"], ["White", "#ffffff"]],
    moves: ["Recreated from icon.svg (64-unit grid ×16) and the 1024px AppIcon.png gradient"],
    facts: { Type: "Document glyph", ...common, Effort: "—" },
    draw: ({ mode, uid }) => `
      <defs><linearGradient id="${uid}_g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${pick(mode, "#3e6cf2", "#1b2550")}"/><stop offset="1" stop-color="${pick(mode, "#2548d3", "#0d1330")}"/></linearGradient></defs>
      <rect width="1024" height="1024" fill="url(#${uid}_g)"/>
      <path d="${page(352, 192, 464, 576, 128, 32)}" fill="#fff" opacity=".35"/>
      <path d="${page(240, 288, 464, 544, 128, 32)}" fill="#fff"/>
      <path d="M576 288v96a32 32 0 0 0 32 32h96" fill="none" stroke="#2f5bea" stroke-width="40" stroke-linejoin="round"/>
      <path d="M352 544h240M352 640h176" stroke="#2f5bea" stroke-width="48" stroke-linecap="round"/>`,
  });

  // ── 01 · Sheet
  add({
    id: "sheet", n: 1,
    name: "Sheet",
    tagline: "One page, one fold, nothing else",
    concept: "Today's icon reduced to its essence: a single white page whose folded corner is the only detail. No text lines, no second sheet. Keeps the brand cobalt so it's still recognisably Folio, but it's crisp down to 16px. The trade-off: a lone page is a common shape, so it leans on the colour to be distinctive.",
    palette: [["Cobalt", "#1f4fe0"], ["Flap", "#9db4f8"], ["Night", "#0e1222"]],
    moves: ["Drop the back sheet and the text lines", "Fold drawn as a filled flap, not an outline", "Flat cobalt instead of a gradient", "Larger page, optically centred"],
    facts: { Type: "Evolution", ...common },
    draw: ({ mode }) => `
      <rect width="1024" height="1024" fill="${pick(mode, "#1f4fe0", "#0e1222")}"/>
      <path d="${page(300, 196, 424, 632, 136, 44)}" fill="#fff"/>
      <path d="${flap(300, 196, 424, 136)}" fill="${pick(mode, "#9db4f8", "#5b7cf2")}"/>`,
  });

  // ── 02 · Layers
  add({
    id: "layers", n: 2,
    name: "Layers",
    tagline: "Three cards stacked: every version kept",
    concept: "Folio keeps an artifact's full history; three offset cards fading back read as versions stacked over time. Pure geometry on a pale ground, the most 'modern product' of the set. It says history more than sharing, and on a light ground it needs the colour to hold on busy wallpapers.",
    palette: [["Mist", "#f3f5fb"], ["Cobalt", "#2b59f0"], ["Night", "#0d1020"], ["Periwinkle", "#6c8bff"]],
    moves: ["Three identical rounded cards, offset diagonally", "One colour at 25 / 55 / 100% opacity", "Light ground: different from the blue neighbours on a home screen"],
    facts: { Type: "Abstract", ...common },
    draw: ({ mode }) => {
      const f = pick(mode, "#2b59f0", "#6c8bff");
      return `<rect width="1024" height="1024" fill="${pick(mode, "#f3f5fb", "#0d1020")}"/>
      <rect x="352" y="192" width="440" height="520" rx="72" fill="${f}" opacity=".22"/>
      <rect x="292" y="252" width="440" height="520" rx="72" fill="${f}" opacity=".5"/>
      <rect x="232" y="312" width="440" height="520" rx="72" fill="${f}"/>`;
    },
  });

  // ── 03 · Fold F
  add({
    id: "foldf", n: 3,
    name: "Fold F",
    tagline: "A letter F whose top arm is a folded page",
    concept: "A monogram: a heavy geometric F where the top arm ends in a folded corner, so the letter is also a page. Monograms age well and scale perfectly; a warm vermilion makes it stand apart from the blue/indigo crowd of dev tools. The page reading is subtle, so the name carries more of the meaning.",
    palette: [["Vermilion", "#ff5a36"], ["White", "#ffffff"], ["Ember", "#1a1210"]],
    moves: ["F built from three bold blocks", "Top arm cut on the diagonal with a folded flap", "New warm brand colour"],
    facts: { Type: "Monogram", ...common, Needs: common.Needs + "; the site's accent colour would follow (style.css)" },
    draw: ({ mode }) => {
      const ink = pick(mode, "#ffffff", "#ff7a5c");
      return `<rect width="1024" height="1024" fill="${pick(mode, "#ff5a36", "#1a1210")}"/>
      <rect x="330" y="220" width="150" height="600" rx="30" fill="${ink}"/>
      <path d="M360 220 H600 L710 330 V340 Q710 370 680 370 H330 V250 Q330 220 360 220Z" fill="${ink}"/>
      <path d="M600 220 V300 Q600 330 630 330 H710Z" fill="${pick(mode, "#ffb3a1", "#7a3324")}"/>
      <rect x="330" y="480" width="290" height="140" rx="30" fill="${ink}"/>`;
    },
  });

  // ── 04 · Spread
  add({
    id: "spread", n: 4,
    name: "Spread",
    tagline: "An open folio: one sheet folded at the spine",
    concept: "A folio is literally a sheet folded once into two leaves. Two leaves meeting at a spine make an open book seen head-on, which also reads as a check/V. Fresh teal moves it away from 'file manager' toward 'publishing'. It suggests reading more than editing by agents.",
    palette: [["Teal", "#12a87e"], ["White", "#ffffff"], ["Deep", "#08221b"], ["Mint", "#3fe0b0"]],
    moves: ["Two mirrored leaves with rounded corners", "Right leaf at 70% for depth without gradients", "Name-driven: folio = folded sheet"],
    facts: { Type: "Symbol", ...common },
    draw: ({ mode }) => {
      const ink = pick(mode, "#ffffff", "#3fe0b0");
      return `<rect width="1024" height="1024" fill="${pick(mode, "#12a87e", "#08221b")}"/>
      <g stroke-linejoin="round" stroke-width="56">
        <path d="M512 312 L512 792 L260 712 L260 232 Z" fill="${ink}" stroke="${ink}"/>
        <path d="M512 312 L764 232 L764 712 L512 792 Z" fill="${ink}" stroke="${ink}" opacity=".62"/>
      </g>`;
    },
  });

  // ── 05 · Window Page
  add({
    id: "window", n: 5,
    name: "Window Page",
    tagline: "A browser window with a folded corner: an artifact is a small website",
    concept: "Folio's artifacts are small websites, so the mark is a window outline with a title bar, whose bottom corner folds like paper: web page and document in one stroke. Black line on white is quiet and very current (developer-tool minimalism). Thin lines need care at 16px, so the favicon uses the same heavy stroke.",
    palette: [["Paper", "#f5f5f7"], ["Ink", "#1d1d1f"], ["Cobalt dot", "#2f5bea"]],
    moves: ["Monoline window at one heavy stroke weight", "Title bar + one cobalt dot as the only colour", "Bottom-right corner folded"],
    facts: { Type: "Line glyph", ...common },
    draw: ({ mode }) => {
      const ink = pick(mode, "#1d1d1f", "#f5f5f7");
      return `<rect width="1024" height="1024" fill="${pick(mode, "#f5f5f7", "#111214")}"/>
      <g fill="none" stroke="${ink}" stroke-width="56" stroke-linejoin="round" stroke-linecap="round">
        <path d="M320 232 H704 Q792 232 792 320 V600 L600 792 H320 Q232 792 232 704 V320 Q232 232 320 232 Z"/>
        <path d="M792 600 H660 Q600 600 600 660 V792"/>
        <path d="M232 380 H792"/>
      </g>
      <circle cx="318" cy="306" r="26" fill="${pick(mode, "#2f5bea", "#6c8bff")}"/>`;
    },
  });

  // ── 06 · Page + Dot
  add({
    id: "dot", n: 6,
    name: "Page + Dot",
    tagline: "A dark page with a coral dot: someone's working on it",
    concept: "A plain ink page with a coral dot sitting on its corner, like a presence or notification dot: an agent is here, there's a comment, something changed. Two shapes, two colours, very legible tiny. It's the most 'collaboration' of the set; the dot could even animate in the app.",
    palette: [["White", "#ffffff"], ["Ink", "#16181d"], ["Coral", "#ff6b4a"]],
    moves: ["Solid ink page, no fold, no lines", "Coral dot overlapping the top-right corner, cut out with a ring", "White ground"],
    facts: { Type: "Symbol", ...common },
    draw: ({ mode }) => {
      const bg = pick(mode, "#ffffff", "#16181d");
      return `<rect width="1024" height="1024" fill="${bg}"/>
      <rect x="280" y="236" width="408" height="584" rx="68" fill="${pick(mode, "#16181d", "#f2f3f5")}"/>
      <circle cx="684" cy="262" r="104" fill="#ff6b4a" stroke="${bg}" stroke-width="44"/>`;
    },
  });

  // ── 07 · Monoline
  add({
    id: "mono", n: 7,
    name: "Monoline",
    tagline: "The page in a single stroke, with a blinking cursor",
    concept: "The folded page drawn as one continuous line, with a short cobalt bar inside like a text cursor: writing in progress, by you or an agent. Black/white with one accent is timeless and matches Folio's plain web UI. A line icon can feel lightweight on a home screen next to filled icons.",
    palette: [["White", "#ffffff"], ["Ink", "#0e0e10"], ["Cobalt", "#2f5bea"]],
    moves: ["Outline page with fold, one stroke weight", "A cobalt cursor bar as the only fill", "Works as a stamp/favicon without the background"],
    facts: { Type: "Line glyph", ...common },
    draw: ({ mode }) => {
      const ink = pick(mode, "#0e0e10", "#ffffff");
      return `<rect width="1024" height="1024" fill="${pick(mode, "#ffffff", "#0e0e10")}"/>
      <g fill="none" stroke="${ink}" stroke-width="48" stroke-linejoin="round" stroke-linecap="round">
        <path d="M352 208 H600 L744 352 V760 Q744 816 688 816 H352 Q296 816 296 760 V264 Q296 208 352 208 Z"/>
        <path d="M600 208 V312 Q600 352 640 352 H744"/>
      </g>
      <rect x="404" y="520" width="56" height="176" rx="28" fill="${pick(mode, "#2f5bea", "#6c8bff")}"/>`;
    },
  });

  // ── 08 · Bauhaus
  add({
    id: "bauhaus", n: 8,
    name: "Bauhaus",
    tagline: "An F built from a bar, a quarter circle and a dot",
    concept: "A geometric F assembled from primary shapes (a navy bar, a coral quarter circle, a mustard dot) on warm paper. Playful and confident, closer to a design studio than a dev tool, and instantly unlike anything else on a home screen. The F is abstract: some will see shapes before the letter.",
    palette: [["Paper", "#f2ede4"], ["Navy", "#1e2a78"], ["Coral", "#f25c3b"], ["Mustard", "#f2b630"]],
    moves: ["Three primitive shapes form the F", "Three flat colours on cream", "No outlines, no gradients"],
    facts: { Type: "Geometric monogram", ...common },
    draw: ({ mode }) => `
      <rect width="1024" height="1024" fill="${pick(mode, "#f2ede4", "#15161c")}"/>
      <rect x="300" y="232" width="160" height="560" rx="16" fill="${pick(mode, "#1e2a78", "#7d8cff")}"/>
      <path d="M460 472 V232 A240 240 0 0 1 700 472 Z" fill="#f25c3b"/>
      <circle cx="560" cy="612" r="84" fill="#f2b630"/>`,
  });

  // ── 09 · Aurora Fold
  add({
    id: "aurora", n: 9,
    name: "Aurora Fold",
    tagline: "A white page lifting off a violet-to-cyan gradient",
    concept: "The single page from 01 on a vivid violet→cyan gradient, with a soft shadow under the page and the flap picking up the gradient. The most 'AI product' of the set: vibrant, current, at home next to other agent apps. Gradients date faster than flat colour, and it's the closest in shape to the current icon.",
    palette: [["Violet", "#6d5dfc"], ["Cyan", "#22c1ee"], ["White", "#ffffff"]],
    moves: ["Diagonal violet→cyan gradient", "One page with a soft drop shadow", "Gradient-filled flap ties page and ground together"],
    facts: { Type: "Evolution", ...common },
    draw: ({ mode, uid }) => `
      <defs>
        <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${pick(mode, "#6d5dfc", "#2b2470")}"/><stop offset="1" stop-color="${pick(mode, "#22c1ee", "#0b4e6a")}"/></linearGradient>
        <linearGradient id="${uid}_fl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#b9b0ff"/><stop offset="1" stop-color="#8fe3f7"/></linearGradient>
        <filter id="${uid}_sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>
      </defs>
      <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
      <path d="${page(312, 236, 400, 600, 140, 48)}" fill="#0b0640" opacity=".28" filter="url(#${uid}_sh)" transform="translate(0 28)"/>
      <path d="${page(312, 212, 400, 600, 140, 48)}" fill="#fff"/>
      <path d="${flap(312, 212, 400, 140, 36)}" fill="url(#${uid}_fl)"/>`,
  });

  // ── 10 · Overlap
  add({
    id: "overlap", n: 10,
    name: "Overlap",
    tagline: "Two pages overlap; the shared part is where agents meet",
    concept: "Two rounded pages, cobalt and amber, overlap and the shared region turns ink: different agents (and people) working on the same artifact. A simple Venn-like mark that tells Folio's actual story, multi-agent collaboration, in three flat shapes. Two brand colours to manage instead of one.",
    palette: [["White", "#ffffff"], ["Cobalt", "#3b5bff"], ["Amber", "#ffb224"], ["Ink", "#111827"]],
    moves: ["Two equal rounded rectangles, offset", "Intersection filled ink (white in dark mode) by clipping", "White ground, flat colour"],
    facts: { Type: "Abstract", ...common },
    draw: ({ mode, uid }) => `
      <defs><clipPath id="${uid}_a"><rect x="232" y="232" width="380" height="500" rx="72"/></clipPath></defs>
      <rect width="1024" height="1024" fill="${pick(mode, "#ffffff", "#0f1117")}"/>
      <rect x="232" y="232" width="380" height="500" rx="72" fill="#3b5bff"/>
      <rect x="412" y="292" width="380" height="500" rx="72" fill="#ffb224"/>
      <rect x="412" y="292" width="380" height="500" rx="72" fill="${pick(mode, "#111827", "#ffffff")}" clip-path="url(#${uid}_a)"/>`,
  });

  window.REVIEW = {
    key: "2026-11-21-folio-logo-redesign-v1",
    dir: "reports/2026-11-21-folio-logo-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8843,
    project: "projects/folio",
    context: [
      "projects/folio/CLAUDE.md",
      "projects/folio/services/web/public/icon.svg",
      "projects/folio/docs/public/icon.png",
      "projects/folio/apps/ios/App/Resources/Assets.xcassets/AppIcon.appiconset/",
      "projects/folio/services/web/src/style.css",
    ],
    brief: "Redesign the Folio logo (app icon, web favicon/header mark): 10 candidates focused on modern and simple. Folio = artifacts (small websites) every AI agent can share, with full version history, comments and suggestions. Shown at iOS light/dark/tinted, Android, a size ladder to 16px, a home screen and the web header.",
    title: "Folio · Logo Redesign",
    subtitle: "Round 1 · 10 modern, simple directions + today's icon",
    heading: "Pick a direction for Folio's logo",
    intro: "Every mark is live SVG. Open one to see it as an iOS icon (light, dark, tinted), on Android, down to a 16px favicon, on a home screen and in the web header. The Light/Dark toggle switches to each icon's dark-mode variant. Heart, rate, write notes under each candidate, crown a winner, then <b>Copy summary</b>.",
    legend: ["<b>10</b> candidates", "<b>1</b> baseline", "<b>5</b> views each"],
    round: 1,
    frame: "icon",
    size: [400, 400],
    candidates: C,
  };
})();
