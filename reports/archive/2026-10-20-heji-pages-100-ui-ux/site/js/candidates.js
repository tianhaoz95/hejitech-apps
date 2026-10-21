// HEJI Pages · 100 UI/UX Improvements Candidate Review
// Grounded in pages/ (index.md, status.md, monorepo.md, .vitepress/config.mts, theme/custom.css, theme/StatusBoard.vue)

(() => {
  const K = window.KIT;

  window.REVIEW = {
    key: "2026-10-20-heji-pages-100-ui-ux-v1",
    dir: "reports/archive/2026-10-20-heji-pages-100-ui-ux",
    repo: "tianhaoz95/hejitech-apps",
    port: 8799,
    project: "pages",
    context: [
      "pages/index.md",
      "pages/status.md",
      "pages/monorepo.md",
      "pages/.vitepress/config.mts",
      "pages/.vitepress/theme/custom.css",
      "pages/.vitepress/theme/StatusBoard.vue",
      "scripts/pages_sync.mjs",
      ".github/workflows/pages.yml"
],
    brief: "Brainstorm 100 UI/UX improvements for the project site on GitHub Pages (https://tianhaoz95.github.io/hejitech-apps/). Spanning hero engagement, app cards, discovery taxonomy, CI/CD observability, documentation reading ergonomics, MCP agent catalogs, autonomous feedback loops, mobile responsive UX, monorepo architecture, and tactile micro-delight.",
    title: "HEJI Pages · 100 UI/UX Improvements",
    subtitle: "Round 2: 8 combos of the shortlisted ideas, plus the 100 from round 1",
    heading: "100 UI/UX Improvements for HEJI Pages",
    intro: "<b>Round 2.</b> You shortlisted 01 dock, 03 persona switch, 08 hero search, 25 ⌘K palette and 94 playful 404. The <b>New</b> candidates combine them and settle the risks they left open: <b>101–102</b> hero combos (Hero), <b>103–105</b> one search instead of two, since VitePress already owns ⌘K and / (Search), <b>106</b> the hero at phone width (Mobile), <b>107–108</b> two 404s with suggestions computed from the site's real routes (Polish). Round 1 below is unchanged. Explore 100 grounded UI/UX directions across 10 clusters for the GitHub Pages site (https://tianhaoz95.github.io/hejitech-apps/). Browse, rate with stars, heart your favorites, leave notes under candidates, pick winners per cluster, then click <b>Copy summary</b> to hand off.",
    legend: ["<b>8</b> new in round 2 (101–108)", "<b>100</b> UI/UX improvements", "<b>10</b> thematic clusters", "<b>1</b> live baseline"],
    round: 2,
    frame: "browser",
    url: "tianhaoz95.github.io/hejitech-apps/",
    groups: [
    {
        "id": "hero",
        "name": "1 \u00b7 Hero, Above-the-Fold & First Impression",
        "note": "C01\u2013C10: Interactive app docks, live terminal sandboxes, audience toggles & ambient solar glow"
    },
    {
        "id": "cards",
        "name": "2 \u00b7 App Discovery, Cards & Interactive Demos",
        "note": "C11\u2013C20: Bento layouts, hover micro-videos, version pills, QR popovers & comparison drawers"
    },
    {
        "id": "taxonomy",
        "name": "3 \u00b7 Search, Filter & Ecosystem Taxonomy",
        "note": "C21\u2013C30: Faceted pills, platform switcher, AI filters, Cmd+K palette & URL search state sync"
    },
    {
        "id": "status",
        "name": "4 \u00b7 Monorepo CI/CD & Observability",
        "note": "C31\u2013C40: Real-time pipeline pulse, TestFlight radar, DMG download center & migration timeline"
    },
    {
        "id": "docs",
        "name": "5 \u00b7 Documentation Ergonomics & Deep Reading",
        "note": "C41\u2013C50: Floating scroll spy, multi-pkg tabs, pan/zoom Mermaid, GitHub edit buttons & reader themes"
    },
    {
        "id": "mcp",
        "name": "6 \u00b7 MCP Server Catalog & AI Agent Playground",
        "note": "C51\u2013C60: Claude Desktop 1-click config, in-browser MCP tool runner, privacy matrices & agent trace viewer"
    },
    {
        "id": "feedbackkit",
        "name": "7 \u00b7 Feedback Loop & Autonomous Agent Triage",
        "note": "C61\u2013C70: Public feedback-to-PR Kanban, 'Is It Fixed?' verification, annotation demo & SLA tickers"
    },
    {
        "id": "mobile",
        "name": "8 \u00b7 Mobile Navigation, Responsive UX & PWA",
        "note": "C71\u2013C80: Bottom sheets, offline PWA, swipe carousels, haptic triggers & Dynamic Island padding"
    },
    {
        "id": "monorepo",
        "name": "9 \u00b7 Monorepo Architecture & Open Source Story",
        "note": "C81\u2013C90: Supabase schema isolation map, graduation calculator, file tree explorer & license guide"
    },
    {
        "id": "polish",
        "name": "10 \u00b7 Micro-Interactions, Polish & Delight",
        "note": "C91\u2013C100: Keyboard shortcut '?' overlay, app soundboard, View Transitions, custom 404 & confetti burst"
    }
],
    candidates: [
{
      "id": "current",
      "n": 0,
      "name": "Current GitHub Pages Site",
      "group": "hero",
      "tagline": "Today's live documentation and portal site on GitHub Pages",
      "concept": "The current GitHub Pages site built with VitePress: hero with drifting colored light blobs, 8 app cards with simple pill badges and action buttons, monorepo principles, and static docs pages.",
      "moves": [
            "Floating colored blobs background (.heji-bg)",
            "8 uniform 2-column app cards with tags and visit/docs buttons",
            "3-column 'How we build' principles grid",
            "VitePress top navbar with Apps, Monorepo, and Status pill",
            "Floating FeedbackKit trigger button in bottom right corner"
      ],
      "palette": [
            [
                  "Brand Blue",
                  "#2F5BEA"
            ],
            [
                  "Surface",
                  "#FFFFFF"
            ],
            [
                  "Soft Slate",
                  "#64748B"
            ]
      ],
      "facts": {
            "Type": "VitePress 1.6 Default Theme",
            "Effort": "Current Baseline",
            "Needs": "Nothing (in production)"
      },
      "spec": {
            "today": [
                  "Standard VitePress home layout in pages/index.md with custom CSS in custom.css"
            ],
            "proposed": [
                  "Baseline reference for all 100 proposed UI/UX improvements"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/config.mts",
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Static card grid lacks interactivity and deep technical differentiation"
            ],
            "verify": [
                  "npm run pages:dev renders current production site"
            ]
      },
      "baseline": true,
      "render": () => KIT.baselinePage()
    },
// ── Round 2 (hero): combos of the shortlisted 01 dock, 03 persona switch and 08 hero search
{
      id: "c101",
      n: 101,
      round: 2,
      group: "hero",
      name: "Shortlist Hero: Persona · Search · Dock",
      tagline: "All three shortlisted hero ideas stacked into one above-the-fold, each doing one job",
      concept: "Combines 03, 08 and 01 in one hero: the persona switch decides what the page talks about, the search field is the main way in, and the dock is the one-tap way to an app. The trade-off is density: three controls above the fold, so each is kept small and the copy shrinks to one line.",
      moves: [
        "Persona switch (03) sits above the title as a quiet two-segment control: 'I want the apps' / 'I build with agents'",
        "Hero search (08) replaces the two hero buttons; focusing it opens the same ⌘K palette as the navbar (see 103), so there is one search, not two",
        "Dock (01) under the search, icons only with 1–8 key hints; the hovered icon's tooltip follows the persona (tagline + platforms, or backend + code path)",
        "Hero image (heji.svg) dropped to make room; the gradient title stays",
      ],
      palette: [["Brand", "#2F5BEA"], ["Glass", "rgba(255,255,255,0.72)"], ["Ink", "#0F172A"]],
      facts: { Type: "Hero combo (01 + 03 + 08)", Effort: "M", Needs: "HeroDock.vue, PersonaSwitch.vue, palette from 103; app data moved out of index.md HTML into a shared apps.ts" },
      spec: {
        today: [
          "pages/index.md frontmatter `hero:` (name, text, tagline, image /heji.svg, two actions: 'See the apps' → #apps, 'How they're built' → /monorepo)",
          "App cards are hand-written HTML in index.md (.heji-app blocks); nothing else on the page knows the app list",
          "Search: VitePress local search (`search: { provider: \"local\" }` in config.mts), a navbar button bound to ⌘K and /",
        ],
        proposed: [
          "Move the 8 apps into pages/.vitepress/theme/apps.ts (name, tagline, platforms, backend, ai, code path, links); the cards, dock, persona copy and palette all read it",
          "Hero uses the `home-hero-info-after` slot of the default theme: <PersonaSwitch/>, <HeroSearch/> (opens the palette from 103), <HeroDock/>",
          "Persona is a ref in theme/persona.ts, saved in localStorage ('heji-persona'), default 'user'; server-rendered HTML is the 'user' copy, so crawlers and no-JS see the full app list",
          "Hero actions removed from frontmatter; 'How they're built' moves into the 'I build with agents' persona copy",
        ],
        files: ["pages/index.md", "pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/apps.ts (new)", "pages/.vitepress/theme/persona.ts (new)", "pages/.vitepress/theme/HeroDock.vue (new)", "pages/.vitepress/theme/PersonaSwitch.vue (new)", "pages/.vitepress/theme/HeroSearch.vue (new)", "pages/.vitepress/theme/custom.css"],
        risks: [
          "Three controls above the fold may read as busy; 102 is the lighter alternative (no hero search)",
          "Persona default must not hide content: the engineer copy is additive, never the only place a link lives",
          "apps.ts and pages/<p>/ docs copied by scripts/pages_sync.mjs must stay in sync for links; a build check that every app's docsUrl resolves",
        ],
        verify: [
          "npm run pages:dev: hero shows switch, search, dock at 1280px and 390px without overlap",
          "Switching persona changes tooltip + subheadline, survives reload, and view-source still contains every app name and link",
          "Pressing 3 focuses Voxbrief's card; clicking the search field opens the ⌘K palette",
        ],
      },
      design: [
        {
          kind: "flow",
          title: "Where the hero's data comes from",
          note: "Today the app list exists only as HTML inside index.md; proposed, one apps.ts feeds every surface.",
          today: {
            nodes: [
              { id: "md", label: "index.md", sub: "hero frontmatter + card HTML", col: 0, row: 0, type: "store" },
              { id: "hero", label: "VPHero", sub: "2 buttons + image", col: 1, row: 0, type: "ui" },
              { id: "cards", label: ".heji-app cards", sub: "hand-written", col: 1, row: 1, type: "ui" },
              { id: "search", label: "Local search", sub: "navbar ⌘K", col: 1, row: 2, type: "ui" },
            ],
            edges: [{ from: "md", to: "hero" }, { from: "md", to: "cards" }, { from: "md", to: "search", label: "indexed text" }],
          },
          proposed: {
            nodes: [
              { id: "apps", label: "theme/apps.ts", sub: "8 apps, one record each", col: 0, row: 1, type: "store", state: "new" },
              { id: "persona", label: "persona.ts", sub: "ref + localStorage", col: 0, row: 3, type: "store", state: "new" },
              { id: "switch", label: "PersonaSwitch", col: 1, row: 0, type: "ui", state: "new" },
              { id: "hs", label: "HeroSearch", sub: "opens palette (103)", col: 1, row: 1, type: "ui", state: "new" },
              { id: "dock", label: "HeroDock", sub: "1–8 keys", col: 1, row: 2, type: "ui", state: "new" },
              { id: "cards", label: "App cards", sub: "rendered from apps.ts", col: 1, row: 3, type: "ui", state: "changed" },
            ],
            edges: [
              { from: "apps", to: "hs" }, { from: "apps", to: "dock" }, { from: "apps", to: "cards" },
              { from: "persona", to: "switch" }, { from: "persona", to: "dock", label: "tooltip" }, { from: "persona", to: "cards", label: "badges" },
            ],
          },
        },
        {
          kind: "code",
          title: "apps.ts record",
          lang: "ts",
          after: `export interface App {
  id: string;            // "weehours" — also the card anchor (#weehours) and docs folder
  name: string;          // "Wee Hours"
  tagline: string;       // "A newborn log built for 3am."
  platforms: string[];   // ["iPhone", "Apple Watch", "Even G2 glasses", "MCP"]
  backend: string;       // "Shared Supabase (weehours.*)"   — engineer persona
  ai: string;            // "On-device voice model"           — engineer persona
  code: string;          // "projects/weehours"
  icon: string;          // "/weehours/icon.png"
  appUrl: string; docs: string;
}`,
        },
      ],
      render: ({ dark }) => KIT.r2HeroCombo({ dark, persona: "user", hover: "weehours" }),
      views: [
        { name: "Light · 'I want the apps'", render: () => KIT.r2HeroCombo({ dark: false, persona: "user", hover: "weehours" }) },
        { name: "Dark · 'I build with agents' (tooltip shows backend and code path)", dark: true, render: () => KIT.r2HeroCombo({ dark: true, persona: "eng", hover: "voxbrief" }) },
      ],
    },
{
      id: "c102",
      n: 102,
      round: 2,
      group: "hero",
      name: "Persona-Aware Dock",
      tagline: "01 + 03 without the hero search: the dock is the hero, and the persona changes what each icon tells you",
      concept: "The lighter combo. Keeps today's two-line hero and puts the dock where the buttons were; the persona switch sits at the dock's end, so it reads as a lens on the apps rather than a page mode. Touch screens get a labelled 4×2 grid instead of hover magnification (the risk 01 left open).",
      moves: [
        "Dock replaces 'See the apps' / 'How they're built'; a persona toggle (two small icons: person / wrench) is the dock's last cell",
        "Hover (or keyboard focus) opens a card-sized tooltip: user lens = tagline, platforms, 'Visit app'; builder lens = backend schema, on-device model, projects/<name>/",
        "Green dot under an icon only when its TestFlight workflow's last run succeeded (status.data.ts already fetches lastRun at build time)",
        "Below 640px or on `(hover: none)`, the dock becomes a 4×2 grid with names under icons; tap jumps to the card",
      ],
      palette: [["Glass", "rgba(255,255,255,0.72)"], ["Lens", "#2F5BEA"], ["Live", "#10B981"]],
      facts: { Type: "Hero combo (01 + 03)", Effort: "S", Needs: "HeroDock.vue + apps.ts (as in 101); testflight lastRun from status.data.ts" },
      spec: {
        today: [
          "Hero actions in index.md frontmatter; no per-app element in the hero",
          "status.data.ts loads every workflow's lastRun at build time for /status only",
        ],
        proposed: [
          "HeroDock.vue in the `home-hero-actions-after` slot (actions removed from frontmatter)",
          "Dock reads apps.ts; the live dot reads `<id>-testflight.yml` lastRun.conclusion === 'success' from status.data.ts (import the loader's data on the home page too)",
          "Lens toggle writes the same persona ref as 101 (theme/persona.ts) so cards can follow later",
          "CSS: `@media (hover: none), (max-width: 640px)` swaps magnification for the labelled grid",
        ],
        files: ["pages/index.md", "pages/.vitepress/theme/HeroDock.vue (new)", "pages/.vitepress/theme/apps.ts (new)", "pages/.vitepress/theme/persona.ts (new)", "pages/status.data.ts", "pages/.vitepress/theme/custom.css"],
        risks: [
          "Build-time dot goes stale between site builds (pages.yml runs on push); label it 'as of build', or refresh in the browser like StatusBoard.vue does",
          "Number keys 1–8 must be ignored while typing in an input (search, FeedbackKit form)",
        ],
        verify: [
          "Hover and Tab both open tooltips; Esc closes",
          "390px screenshot shows the 4×2 labelled grid, no horizontal scroll",
          "Turning a TestFlight workflow red locally (fixture) removes its dot",
        ],
      },
      design: [
        {
          kind: "steps",
          title: "From the dock to the app",
          steps: [
            { actor: "Visitor", text: "Hovers the Wee Hours icon (or Tabs to it, or presses 2)" },
            { actor: "HeroDock", text: "Magnifies 1.0 → 1.3 with neighbours at 1.15; opens the tooltip for the current lens" },
            { actor: "Visitor", text: "Clicks the icon" },
            { actor: "HeroDock", text: "scrollIntoView({ behavior: 'smooth' }) on #weehours and adds .flash for 900 ms; reduced-motion: jump, no flash" },
          ],
        },
      ],
      render: ({ dark }) => KIT.r2DockHero({ dark, persona: "user" }),
      views: [
        { name: "Light · user lens (tagline, platforms)", render: () => KIT.r2DockHero({ dark: false, persona: "user" }) },
        { name: "Dark · builder lens (backend, model, code path)", dark: true, render: () => KIT.r2DockHero({ dark: true, persona: "eng" }) },
        { name: "Phone · labelled grid (no hover)", frame: "phone", render: () => KIT.r2PhoneHero({ dark: false, dock: true, search: false }) },
      ],
    },
{
      "id": "c01",
      "n": 1,
      "name": "Interactive App Switcher Dock",
      "group": "hero",
      "tagline": "macOS-style floating glass dock in the hero with live tooltips and instant anchor jump",
      "concept": "Replaces the static hero with an interactive floating dock featuring all 8 app icons. Hovering magnifies icons smoothly with parabolic scaling; clicking jumps directly to that app's card with a subtle highlight flash.",
      "moves": [
            "Floating glassmorphic dock positioned directly beneath the hero tagline",
            "Smooth icon magnification on cursor hover (scale 1.0 -> 1.3)",
            "Active indicator dots showing which apps have live TestFlight builds",
            "Keyboard shortcut 1-8 to instantly focus any app"
      ],
      "palette": [
            [
                  "Glass Dock",
                  "rgba(255,255,255,0.7)"
            ],
            [
                  "Brand Glow",
                  "#2F5BEA"
            ],
            [
                  "Active Dot",
                  "#10B981"
            ]
      ],
      "facts": {
            "Type": "Interactive Navigation",
            "Effort": "S",
            "Needs": "CSS backdrop-filter + pointer events"
      },
      "spec": {
            "today": [
                  "Hero has two generic buttons: 'See the apps' and 'How they're built'"
            ],
            "proposed": [
                  "Interactive dock beneath buttons showcasing all 8 app icons with live tooltips"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/HeroDock.vue"
            ],
            "risks": [
                  "Needs clean touch fallback on mobile where hover is absent"
            ],
            "verify": [
                  "Hovering expands dock items; clicking scrolls smoothly to #waypack or #weehours"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <h1 class="h-hero-title">HEJI Apps</h1>
                  <p class="h-hero-tagline">Small apps, carefully made</p>
                  <p class="h-hero-sub">Each one does one job well, works when the network doesn't, and lets your own AI assistant in through an open door: MCP.</p>
                  <div class="c01-dock">
                    ${KIT.apps.map(a => `<div class="c01-dock-item" title="${a.name} · ${a.tagline}" style="background:${a.color}15">${a.iconSvg}</div>`).join("")}
                  </div>
                </div>
                <div class="h-hero-art">
                  <svg width="130" height="130" viewBox="0 0 140 140"><rect width="140" height="140" rx="36" fill="#2f5bea"/><path d="M42 98V42h16v22h24V42h16v56H82V76H58v22z" fill="#fff"/></svg>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c02",
      "n": 2,
      "name": "Live WebAssembly Terminal Hero",
      "group": "hero",
      "tagline": "Embedded interactive shell in hero running simulated CLI commands and MCP checks",
      "concept": "Provides immediate proof of the developer-first ethos by embedding an interactive terminal right next to the hero title. Visitors can type or click suggested commands like `heji list`, `heji mcp test`, or `curl heji.dev` to inspect apps directly in browser.",
      "moves": [
            "Embedded interactive shell with realistic macOS window chrome and blinking cursor",
            "Pre-populated interactive prompt buttons: `heji list`, `waypack status`, `mcp tools`",
            "Zero network dependencies: mocked in-memory terminal with instant response",
            "Copy output button for developers trying CLI locally"
      ],
      "palette": [
            [
                  "Terminal Black",
                  "#0D1117"
            ],
            [
                  "Terminal Green",
                  "#7EE787"
            ],
            [
                  "Prompt Blue",
                  "#58A6FF"
            ]
      ],
      "facts": {
            "Type": "Developer Interactive Sandbox",
            "Effort": "M",
            "Needs": "Lightweight pseudo-shell script"
      },
      "spec": {
            "today": [
                  "Hero displays a static SVG logo with no interactive preview"
            ],
            "proposed": [
                  "Hero displays an interactive mock terminal allowing immediate command execution"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/HeroTerminal.vue"
            ],
            "risks": [
                  "Ensure mobile layout stacks terminal gracefully below hero text"
            ],
            "verify": [
                  "Clicking suggestion chip executes command and prints formatted monorepo table"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero" style="align-items:flex-start">
                <div class="h-hero-content">
                  <h1 class="h-hero-title">HEJI Apps</h1>
                  <p class="h-hero-tagline">Small apps, carefully made</p>
                  <p class="h-hero-sub">Local-first, offline-ready apps sharing a monorepo, MCP server catalog, and autonomous coding agents.</p>
                  <div class="h-hero-actions">
                    <span class="h-btn-hero-pri">Explore Documentation</span>
                    <span class="h-btn-hero-sec">GitHub Repository</span>
                  </div>
                </div>
                <div style="flex:1;max-width:480px">
                  <div class="c02-terminal">
                    <div class="c02-term-bar">
                      <span class="c02-term-dot" style="background:#ff5f56"></span>
                      <span class="c02-term-dot" style="background:#ffbd2e"></span>
                      <span class="c02-term-dot" style="background:#27c93f"></span>
                      <span class="c02-term-title">zsh — heji-cli</span>
                    </div>
                    <div class="c02-term-body">
                      <div><span class="c02-term-prompt">$</span> heji list --status</div>
                      <div class="c02-term-out">✓ waypack     v1.4.2  offline vector maps (MCP ready)</div>
                      <div class="c02-term-out">✓ weehours    v1.3.1  3am voice log (Whisper CoreML)</div>
                      <div class="c02-term-out">✓ voxbrief    v1.2.0  on-device structured audio</div>
                      <div class="c02-term-out">✓ meowtrix    v1.35.0 split remote workspace</div>
                      <div style="margin-top:6px"><span class="c02-term-prompt">$</span> heji mcp ping</div>
                      <div style="color:#8B949E">8 tools registered · latency 0.2ms · offline OK</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c03",
      "n": 3,
      "name": "Audience Persona Switcher",
      "group": "hero",
      "tagline": "Two-state hero toggle adapting the page for app consumers vs monorepo engineers",
      "concept": "The site serves two distinct audiences: end-users looking for beautiful offline apps, and engineers looking at monorepo architecture and MCP. This toggle switches copy, card metrics, and CTAs to speak directly to the chosen visitor.",
      "moves": [
            "Prominent segmented control in hero: '\ud83d\udc64 For App Users' vs '\ud83d\udee0\ufe0f For AI & Systems Engineers'",
            "When set to Engineer: app cards show schema isolation, CoreML models, and MCP tool counts",
            "When set to User: cards show screenshots, App Store / TestFlight download buttons, and user reviews",
            "Remembers visitor preference in localStorage"
      ],
      "palette": [
            [
                  "Consumer Lavender",
                  "#6366F1"
            ],
            [
                  "Engineer Emerald",
                  "#10B981"
            ],
            [
                  "Slate Neutral",
                  "#64748B"
            ]
      ],
      "facts": {
            "Type": "Contextual Personalization",
            "Effort": "S",
            "Needs": "Vue reactive ref in theme"
      },
      "spec": {
            "today": [
                  "Hero has single fixed description attempting to balance consumer appeal and tech details"
            ],
            "proposed": [
                  "Audience toggle reconfigures card badges, CTAs and hero subheadline instantly"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Ensure search engine crawlers index both versions' content"
            ],
            "verify": [
                  "Toggling switches between consumer download links and monorepo code links"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <div class="c03-persona-switch">
                    <span class="c03-persona-btn active">🛠️ For AI & Systems Engineers</span>
                    <span class="c03-persona-btn">👤 For App Users</span>
                  </div>
                  <h1 class="h-hero-title">HEJI Monorepo</h1>
                  <p class="h-hero-tagline">8 focused apps · 1 Supabase backend · Open MCP</p>
                  <p class="h-hero-sub">Explore production on-device Whisper, Flutter offline bundles, isolated Postgres schemas, and autonomous FeedbackKit coding agents.</p>
                  <div class="h-hero-actions">
                    <span class="h-btn-hero-pri">Read Architecture Guide</span>
                    <span class="h-btn-hero-sec">View MCP Tools</span>
                  </div>
                </div>
                <div class="h-hero-art">
                  <div style="padding:20px;border-radius:18px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;width:240px;box-shadow:0 8px 24px rgba(0,0,0,0.06)">
                    <div style="font-size:12px;font-weight:700;color:#2F5BEA;text-transform:uppercase;margin-bottom:8px">ENGINEER PERSPECTIVE</div>
                    <div style="font-size:13px;line-height:1.5">● Zero Cross-Schema Foreign Keys<br>● Strict graduation rules<br>● Automated release CI<br>● Claude/Antigravity pair tools</div>
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps (Engineer View)</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c04",
      "n": 4,
      "name": "Solar-Dynamic Ambient Hero Glow",
      "group": "hero",
      "tagline": "Ambient backdrop subtly attuned to visitor's local solar time (3am Wee Hours night glow)",
      "concept": "Replaces static random drifting light blobs with purposeful solar-synced lighting: dawn soft orange, midday crisp cyan, twilight violet, and at 3am, a warm soothing amber glow celebrating Wee Hours' nighttime nursery mission.",
      "moves": [
            "Detects visitor's local hour via `new Date().getHours()`",
            "Adjusts CSS radial mesh gradients and canvas particles based on solar cycle",
            "Features a small ambient time chip: 'Local 3:14 AM \u2014 Nursery Mode Active'",
            "Reduced motion and high contrast compliant"
      ],
      "palette": [
            [
                  "3am Amber",
                  "#F59E0B"
            ],
            [
                  "Midnight Indigo",
                  "#1E1B4B"
            ],
            [
                  "Dawn Rose",
                  "#FB7185"
            ]
      ],
      "facts": {
            "Type": "Atmospheric Craft",
            "Effort": "S",
            "Needs": "CSS variable bindings in custom.css"
      },
      "spec": {
            "today": [
                  "Generic fixed blue and yellow circles drifting via keyframe animations"
            ],
            "proposed": [
                  "Day/night reactive color palette that gives the portal a living, bespoke atmosphere"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/index.md"
            ],
            "risks": [
                  "Must not cause background CPU or battery drain"
            ],
            "verify": [
                  "Simulating 03:00 sets background to cozy amber/indigo palette"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="background:${dark ? "radial-gradient(circle at 80% 20%, #312E81 0%, #0F172A 70%)" : "radial-gradient(circle at 80% 20%, #FEF3C7 0%, #EFF6FF 60%)"}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;background:rgba(245,158,11,0.15);color:#D97706;font-size:12px;font-weight:700;margin-bottom:12px">
                    <span>🌙 3:18 AM Local Time</span> · Nursery Lighting Active
                  </div>
                  <h1 class="h-hero-title" style="background:linear-gradient(120deg, #F59E0B, #6366F1);-webkit-background-clip:text">HEJI Apps</h1>
                  <p class="h-hero-tagline">Small apps made for real moments</p>
                  <p class="h-hero-sub">From quiet 3am feeds to offline mountain passes, software crafted with care and zero cloud surveillance.</p>
                  <div class="h-hero-actions">
                    <span class="h-btn-hero-pri" style="background:#D97706">Explore Night-Safe Apps</span>
                  </div>
                </div>
                <div class="h-hero-art">
                  <div style="width:130px;height:130px;border-radius:36px;background:linear-gradient(135deg, #F59E0B, #4F46E5);display:grid;place-items:center;color:#fff;font-size:40px;box-shadow:0 12px 36px rgba(245,158,11,0.3)">
                    🌙
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c05",
      "n": 5,
      "name": "Ecosystem Constellation Node Graph",
      "group": "hero",
      "tagline": "Interactive SVG constellation illustrating how all 8 apps connect through monorepo hubs",
      "concept": "Replaces the static hero illustration with an interactive node graph. The central monorepo hub branches into Supabase, MCP, and FeedbackKit, connecting outward to all 8 apps. Hovering any app highlights its shared architecture links.",
      "moves": [
            "Interactive SVG force-directed topology diagram in the hero right column",
            "Nodes representing apps glow in their brand colors (Waypack blue, Wee Hours purple)",
            "Hovering an app illuminates connected shared dependencies (e.g. Shared Supabase vs Zero Backend)",
            "Clicking a node scrolls directly to its documentation section"
      ],
      "palette": [
            [
                  "Graph Edge",
                  "#94A3B8"
            ],
            [
                  "Node Supabase",
                  "#10B981"
            ],
            [
                  "Node MCP",
                  "#6366F1"
            ]
      ],
      "facts": {
            "Type": "Architectural Visualization",
            "Effort": "M",
            "Needs": "SVG graph component"
      },
      "spec": {
            "today": [
                  "Hero right column has a static 140x140 square SVG HEJI logo"
            ],
            "proposed": [
                  "Hero right column features an interactive ecosystem constellation graph"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/EcosystemGraph.vue"
            ],
            "risks": [
                  "Graph must scale down gracefully on tablets and mobile screens"
            ],
            "verify": [
                  "Hovering Waypack highlights Shared Supabase node and MCP node"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <h1 class="h-hero-title">HEJI Apps</h1>
                  <p class="h-hero-tagline">An ecosystem of craft tools</p>
                  <p class="h-hero-sub">Explore how 8 distinct products share monorepo release automation, local AI runtimes, and the Model Context Protocol.</p>
                  <div class="h-hero-actions">
                    <span class="h-btn-hero-pri">Explore The Graph</span>
                  </div>
                </div>
                <div class="h-hero-art" style="width:320px;height:240px;position:relative">
                  <svg width="320" height="240" viewBox="0 0 320 240" style="overflow:visible">
                    <circle cx="160" cy="120" r="28" fill="#2F5BEA" opacity="0.9"/>
                    <text x="160" y="124" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">MONOREPO</text>
                    <!-- Orbiting apps -->
                    <line x1="160" y1="120" x2="60" y2="60" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="3 3"/>
                    <circle cx="60" cy="60" r="18" fill="#1D6FE0"/><text x="60" y="64" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Waypack</text>
                    <line x1="160" y1="120" x2="260" y2="60" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="3 3"/>
                    <circle cx="260" cy="60" r="18" fill="#6D5BD0"/><text x="260" y="64" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">WeeHours</text>
                    <line x1="160" y1="120" x2="60" y2="180" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="3 3"/>
                    <circle cx="60" cy="180" r="18" fill="#1D4ED8"/><text x="60" y="184" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Voxbrief</text>
                    <line x1="160" y1="120" x2="260" y2="180" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="3 3"/>
                    <circle cx="260" cy="180" r="18" fill="#7C3AED"/><text x="260" y="184" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">Meowtrix</text>
                  </svg>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c06",
      "n": 6,
      "name": "Real-Time Monorepo Metric Ticker",
      "group": "hero",
      "tagline": "Live proof-of-work ticker banner showcasing verifiable numbers directly below hero",
      "concept": "Adds an unmissable live metric ribbon immediately below hero: '8 Products \u00b7 0 Trackers \u00b7 100% Offline-Capable \u00b7 4 On-Device Models \u00b7 99.98% CI Green'. Communicates transparent engineering standards at a glance.",
      "moves": [
            "Horizontal stat ticker with real counts parsed from repo at build time",
            "Interactive popovers on each stat explaining the calculation (e.g. 0 Trackers = App Privacy nutrition label)",
            "Refreshed automatically on every GitHub Pages deployment",
            "Crisp monospace numbers with subtle emerald pulse"
      ],
      "palette": [
            [
                  "Metric Emerald",
                  "#10B981"
            ],
            [
                  "Ticker Surface",
                  "#FFFFFF"
            ],
            [
                  "Border Line",
                  "#E2E8F0"
            ]
      ],
      "facts": {
            "Type": "Social Proof & Telemetry",
            "Effort": "S",
            "Needs": "Build-time count generation"
      },
      "spec": {
            "today": [
                  "No ecosystem-wide metrics shown on the home page"
            ],
            "proposed": [
                  "4-column metric ticker between hero and app grid with live stats"
            ],
            "files": [
                  "pages/index.md",
                  "scripts/pages_sync.mjs"
            ],
            "risks": [
                  "Keep numbers grounded in real repo data, not vanity metrics"
            ],
            "verify": [
                  "Stat values reflect actual count of apps, models, and workflows"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <h1 class="h-hero-title">HEJI Apps</h1>
                  <p class="h-hero-tagline">Small apps, carefully made</p>
                  <p class="h-hero-sub">Each one does one job well, works when the network doesn't, and lets your own AI assistant in through an open door: MCP.</p>
                </div>
                <div class="h-hero-art">
                  <svg width="120" height="120" viewBox="0 0 140 140"><rect width="140" height="140" rx="36" fill="#2f5bea"/><path d="M42 98V42h16v22h24V42h16v56H82V76H58v22z" fill="#fff"/></svg>
                </div>
              </div>
              <div style="max-width:1080px;margin:0 auto 28px;padding:0 36px">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:16px 24px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid ${dark ? "#232B3B" : "#E2E8F0"};box-shadow:0 2px 8px rgba(0,0,0,0.03)">
                  <div><div style="font-size:22px;font-weight:800;color:#2F5BEA">8</div><small style="color:#64748B;font-weight:600">Active Apps</small></div>
                  <div><div style="font-size:22px;font-weight:800;color:#10B981">0</div><small style="color:#64748B;font-weight:600">Cloud Trackers</small></div>
                  <div><div style="font-size:22px;font-weight:800;color:#6366F1">100%</div><small style="color:#64748B;font-weight:600">Offline-First</small></div>
                  <div><div style="font-size:22px;font-weight:800;color:#059669">99.9%</div><small style="color:#64748B;font-weight:600">CI Pass Rate</small></div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c07",
      "n": 7,
      "name": "30-Second Micro-Video Scrubber",
      "group": "hero",
      "tagline": "Interactive video reel hero demonstrating real app screen recordings with scrubber pins",
      "concept": "Shows, rather than tells, the quality of the apps. A sleek video reel in the hero shows 4-second looping high-fps captures of each app (e.g. Wee Hours 3am voice log, Waypack vector zoom). A scrubber bar lets visitors jump between apps instantly.",
      "moves": [
            "Embedded lightweight canvas/video player in hero right column",
            "Timeline scrubber pins: [Waypack] [Wee Hours] [Voxbrief] [Meowtrix]",
            "Autoplays quietly on loop; hover reveals 'Watch with sound' option",
            "Demonstrates real app interactions in 60fps clarity"
      ],
      "palette": [
            [
                  "Player Slate",
                  "#0F172A"
            ],
            [
                  "Scrubber Accent",
                  "#2F5BEA"
            ],
            [
                  "Pin Active",
                  "#38BDF8"
            ]
      ],
      "facts": {
            "Type": "High-Impact Media",
            "Effort": "M",
            "Needs": "Optimized webm screen recordings"
      },
      "spec": {
            "today": [
                  "No video or animated demonstration of any app on the homepage"
            ],
            "proposed": [
                  "Embedded video reel player with app scrubber pins in hero section"
            ],
            "files": [
                  "pages/index.md",
                  "pages/public/videos/",
                  "pages/.vitepress/theme/components/HeroVideo.vue"
            ],
            "risks": [
                  "Video assets must be heavily compressed (<500KB each) to prevent slow load"
            ],
            "verify": [
                  "Video autoplays smoothly; clicking scrubber pins switches video segment"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <h1 class="h-hero-title">HEJI Apps</h1>
                  <p class="h-hero-tagline">Watch them in action</p>
                  <p class="h-hero-sub">See how offline vector maps, 3am voice logging, and remote dev terminals feel on real devices.</p>
                  <div class="h-hero-actions">
                    <span class="h-btn-hero-pri">Download Free Previews</span>
                  </div>
                </div>
                <div style="flex:1;max-width:440px">
                  <div style="border-radius:18px;overflow:hidden;background:#0F172A;border:2px solid #334155;box-shadow:0 16px 40px rgba(0,0,0,0.3)">
                    <div style="height:190px;background:linear-gradient(135deg, #1E293B, #0F172A);display:flex;align-items:center;justify-content:center;color:#94A3B8;flex-direction:column;gap:8px">
                      <div style="width:48px;height:48px;border-radius:50%;background:#2F5BEA;display:grid;place-items:center;color:#fff">${KIT.svgIcons.play}</div>
                      <span style="font-size:12px;font-weight:600">Wee Hours · 3am Voice Log (0:04)</span>
                    </div>
                    <div style="display:flex;gap:4px;padding:8px 12px;background:#1E293B">
                      <span style="flex:1;height:4px;border-radius:2px;background:#2F5BEA"></span>
                      <span style="flex:1;height:4px;border-radius:2px;background:#475569"></span>
                      <span style="flex:1;height:4px;border-radius:2px;background:#475569"></span>
                      <span style="flex:1;height:4px;border-radius:2px;background:#475569"></span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c08",
      "n": 8,
      "name": "Omni-Search Hero Command Center",
      "group": "hero",
      "tagline": "Giant spotlight-style search bar embedded directly in the hero for instant discovery",
      "concept": "Makes search the centerpiece of the above-the-fold experience. Rather than hiding search behind a tiny navbar icon, a prominent search input with typeahead chips invites immediate queries for features, CLI commands, or documentation topics.",
      "moves": [
            "Prominent central search bar in hero with keyboard shortcut badge (`/` or `Cmd+K`)",
            "Trending search suggestion chips: `offline maps`, `whisper model`, `supabase schema`, `mcp tools`",
            "Instant results popover displaying app cards and matching documentation sections",
            "Automatic focus when pressing `/` anywhere on the page"
      ],
      "palette": [
            [
                  "Search Blue",
                  "#2F5BEA"
            ],
            [
                  "Input Background",
                  "#FFFFFF"
            ],
            [
                  "Pill Tint",
                  "#EEF2FF"
            ]
      ],
      "facts": {
            "Type": "Search & Retrieval",
            "Effort": "S",
            "Needs": "VitePress local search hook"
      },
      "spec": {
            "today": [
                  "Search is a small button in the top right navbar"
            ],
            "proposed": [
                  "Prominent search bar in the hero with quick suggestion pills"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/HeroSearch.vue"
            ],
            "risks": [
                  "Avoid visual conflict with existing top navbar search button"
            ],
            "verify": [
                  "Typing query in hero search reveals instant matching results"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero" style="flex-direction:column;align-items:center;text-align:center;padding:56px 20px 32px">
                <h1 class="h-hero-title">HEJI Apps &amp; Monorepo</h1>
                <p class="h-hero-sub" style="max-width:540px">Search 8 offline apps, MCP servers, architecture decisions, and release notes in one place.</p>
                <div style="width:100%;max-width:560px;margin:12px 0 16px">
                  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:2px solid #2F5BEA;box-shadow:0 8px 30px rgba(47,91,234,0.15)">
                    ${KIT.svgIcons.search}
                    <input type="text" placeholder="Search apps, MCP tools, offline architecture, or guides..." style="flex:1;border:0;outline:none;background:transparent;font-size:15px;color:inherit" readonly value="whisper on-device">
                    <kbd style="padding:3px 8px;border-radius:6px;background:${dark ? "#1E293B" : "#F1F5F9"};font-size:12px">ESC</kbd>
                  </div>
                  <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">
                    <span class="h-tag" style="cursor:pointer">📍 offline maps</span>
                    <span class="h-tag" style="cursor:pointer">🎙️ 3am voice log</span>
                    <span class="h-tag" style="cursor:pointer">🤖 mcp server</span>
                    <span class="h-tag" style="cursor:pointer">📦 supabase isolation</span>
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c09",
      "n": 9,
      "name": "Interactive 'Try Before You Install' Simulator",
      "group": "hero",
      "tagline": "Hero interactive canvas simulating on-device voice logging and Apple Watch taps",
      "concept": "Allows visitors to experience the core interaction of HEJI apps right in the browser. Tapping a microphone button simulates the Wee Hours 3-second voice log: speech transcript appears, AI extracts feed amount, and event logs instantly.",
      "moves": [
            "Interactive mini app simulator embedded directly in hero right column",
            "Simulated audio wave animation on tap",
            "Live JSON output panel displaying structured event payload created by on-device model",
            "Switch simulator tabs between Wee Hours (Baby Log) and Waypack (Offline Map)"
      ],
      "palette": [
            [
                  "Nursery Purple",
                  "#6D5BD0"
            ],
            [
                  "Live Wave",
                  "#A78BFA"
            ],
            [
                  "Card Bg",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Interactive Product Demo",
            "Effort": "M",
            "Needs": "CSS keyframe waveform animation"
      },
      "spec": {
            "today": [
                  "No interactive experience of app functionality before installing"
            ],
            "proposed": [
                  "Interactive demo simulator in hero letting visitors test app interaction"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppSimulator.vue"
            ],
            "risks": [
                  "Ensure simulator feels fast and snappy with zero lag"
            ],
            "verify": [
                  "Tapping 'Simulate 3am Voice' generates simulated voice transcription in 1s"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-hero">
                <div class="h-hero-content">
                  <h1 class="h-hero-title">HEJI Apps</h1>
                  <p class="h-hero-tagline">Try it live in browser</p>
                  <p class="h-hero-sub">Experience how on-device AI turns three seconds of spoken audio into structured records at 3am.</p>
                  <div class="h-hero-actions">
                    <span class="h-btn-hero-pri">Get On TestFlight</span>
                  </div>
                </div>
                <div style="flex:1;max-width:380px">
                  <div style="padding:20px;border-radius:20px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;box-shadow:0 12px 32px rgba(0,0,0,0.08)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                      <span style="font-size:12px;font-weight:700;color:#6D5BD0">WEE HOURS · VOICE LOG SIMULATOR</span>
                      <span style="font-size:11px;color:#10B981;font-weight:700">● ON-DEVICE</span>
                    </div>
                    <div style="padding:14px;border-radius:12px;background:${dark ? "#1E1B4B" : "#EEF2FF"};margin-bottom:12px">
                      <div style="font-size:13px;color:#4338CA;font-weight:600">Spoken audio input:</div>
                      <div style="font-size:15px;font-weight:700;margin-top:2px">"Left breast 15 minutes and wet diaper"</div>
                    </div>
                    <div style="font-size:12px;color:#64748B;margin-bottom:8px">Extracted JSON (Whisper + CoreML):</div>
                    <pre style="margin:0;padding:8px 12px;border-radius:8px;background:${dark ? "#0D1117" : "#F8FAFC"};font-size:11px;font-family:monospace;color:#10B981">{ "feed": { "side": "left", "min": 15 }, "diaper": "wet" }</pre>
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c10",
      "n": 10,
      "name": "Editorial Manifesto & Craft Typography",
      "group": "hero",
      "tagline": "High-craft editorial layout with Fraunces serif accent and founder statement of craft",
      "concept": "Elevates HEJI from a standard software directory into an artisanal software house. Features classic editorial proportions, refined serif headlines (Fraunces), an explicit manifesto of craftsmanship, and quote callouts on software longevity.",
      "moves": [
            "Introduces Fraunces or Newsreader display serif for hero headers",
            "Artisanal manifesto section: 'Why we craft small, offline software that lasts 20 years'",
            "Muted, warm paper background palette inspired by classic Swiss graphic design",
            "Founder signature and monorepo release ethos callout"
      ],
      "palette": [
            [
                  "Editorial Paper",
                  "#FDFBF7"
            ],
            [
                  "Warm Ink",
                  "#1C1917"
            ],
            [
                  "Craft Rust",
                  "#C2410C"
            ]
      ],
      "facts": {
            "Type": "Editorial Graphic Design",
            "Effort": "S",
            "Needs": "Google Font Fraunces import"
      },
      "spec": {
            "today": [
                  "Generic sans-serif (Inter) typography used everywhere across the page"
            ],
            "proposed": [
                  "Pairing Fraunces serif display titles with Inter body for editorial authority"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/config.mts"
            ],
            "risks": [
                  "Ensure font loads without layout shift (FOUT)"
            ],
            "verify": [
                  "Headlines render in Fraunces; paper background creates warm tactile feel"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="background:${dark ? "#121110" : "#FDFBF7"};color:${dark ? "#F5F5F4" : "#1C1917"}">
              ${KIT.nav("apps")}
              <div class="h-hero" style="border-bottom:1px solid ${dark ? "#292524" : "#E7E5E4"};padding-bottom:48px">
                <div class="h-hero-content" style="max-width:720px">
                  <div style="font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#C2410C;margin-bottom:8px">THE HEJI MANIFESTO</div>
                  <h1 style="font-family:Georgia,serif;font-size:48px;font-weight:400;line-height:1.15;margin:0 0 16px;letter-spacing:-0.02em">Software made to outlive the cloud.</h1>
                  <p style="font-size:18px;line-height:1.6;color:${dark ? "#A8A29E" : "#57534E"};margin:0 0 24px">We make small, focused apps that keep working when the Wi-Fi drops, keep your private voice notes on your hardware, and treat AI as a transparent collaborator.</p>
                  <div style="display:flex;gap:16px;align-items:center">
                    <span style="font-weight:700;font-size:14px;border-bottom:2px solid #C2410C;padding-bottom:2px">Explore The Collection →</span>
                    <span style="font-size:13px;color:#A8A29E">Est. 2026 · Tianhao Zhou</span>
                  </div>
                </div>
              </div>
              <div class="h-apps-section">
                <div class="h-sec-hd"><h2 style="font-family:Georgia,serif;font-weight:400">The Catalog</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c11",
      "n": 11,
      "name": "Bento Grid Layout with Asymmetric Spotlights",
      "group": "cards",
      "tagline": "Modern Apple-style bento box grid spotlighting flagship apps with expanded feature tiles",
      "concept": "Replaces the uniform 2-column card grid with an asymmetric Bento Box layout. Flagship apps (Waypack, Wee Hours, FeedbackKit) occupy 2x2 multi-cell hero slots featuring interactive feature badges, vector map previews, and live metrics.",
      "moves": [
            "Asymmetric CSS grid spanning 4 columns with variable tile sizes",
            "Waypack spotlight tile includes a live vector map graphic and offline package size",
            "Wee Hours spotlight includes a simulated watch face and voice waveform",
            "Smaller utility apps (TinyTouch, ToddlerCam) occupy compact 1x1 companion tiles"
      ],
      "palette": [
            [
                  "Bento Slate",
                  "#F8FAFC"
            ],
            [
                  "Hero Card Blue",
                  "#EEF2FF"
            ],
            [
                  "Border Slate",
                  "#E2E8F0"
            ]
      ],
      "facts": {
            "Type": "Card Grid Architecture",
            "Effort": "M",
            "Needs": "CSS grid-template-columns: repeat(4, 1fr)"
      },
      "spec": {
            "today": [
                  "All 8 apps rendered in identical sized 2-column cards"
            ],
            "proposed": [
                  "Asymmetric bento grid with 2x2 flagship feature spotlights"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Mobile responsiveness requires collapsing into single column smoothly"
            ],
            "verify": [
                  "Waypack and Wee Hours receive prominent 2x2 cards on desktop screens"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:36px">
                <div class="h-sec-hd"><h2>Featured Collection</h2></div>
                <div class="c11-bento">
                  <div class="c11-bento-card c11-bento-hero">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                      <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                      <span class="h-tag" style="background:#2F5BEA;color:#fff">FLAGSHIP · TRAVEL</span>
                    </div>
                    <h3 style="font-size:24px;margin:14px 0 6px">Waypack</h3>
                    <p style="font-size:14px;color:#475569;margin-bottom:16px">Your trip, packed into a single self-contained offline vector bundle. Works anywhere on earth with no cell signal.</p>
                    <div style="display:flex;gap:8px">
                      <a class="h-btn-pri" href="#">Download iOS App</a>
                      <a class="h-btn-sec" href="#">Read Specs</a>
                    </div>
                  </div>
                  <div class="c11-bento-card c11-bento-wide">
                    <div class="h-card-icon">${KIT.apps[1].iconSvg}</div>
                    <h4 style="margin:8px 0 4px">Wee Hours</h4>
                    <p style="font-size:13px;color:#64748B;margin:0 0 8px">Newborn logs built for 3am. 3-second voice log with local Whisper.</p>
                    <span class="h-tag">Watch &amp; Glasses</span>
                  </div>
                  <div class="c11-bento-card">
                    <div class="h-card-icon">${KIT.apps[2].iconSvg}</div>
                    <h4 style="margin:8px 0 4px">Voxbrief</h4>
                    <p style="font-size:12px;color:#64748B;margin:0">Structured audio notes.</p>
                  </div>
                  <div class="c11-bento-card">
                    <div class="h-card-icon">${KIT.apps[3].iconSvg}</div>
                    <h4 style="margin:8px 0 4px">Meowtrix</h4>
                    <p style="font-size:12px;color:#64748B;margin:0">Remote dev workspace.</p>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c12",
      "n": 12,
      "name": "Hover-to-Play Micro Video Previews",
      "group": "cards",
      "tagline": "App cards smoothly reveal a 4-second looping screen recording on cursor hover",
      "concept": "Brings static app cards to life. Hovering an app card fades out the static icon and smoothly plays a 4-second looping MP4/WebM screen capture showing the app's signature fluid interaction.",
      "moves": [
            "Lightweight video element lazily loaded on mouse enter",
            "Smooth 200ms crossfade between app icon and looping interaction preview",
            "Disables automatically if prefers-reduced-motion is detected",
            "Displays a play indicator badge in the card corner"
      ],
      "palette": [
            [
                  "Hover Accent",
                  "#2F5BEA"
            ],
            [
                  "Video Dark",
                  "#0F172A"
            ],
            [
                  "Text White",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Delight Micro-Interaction",
            "Effort": "M",
            "Needs": "Pre-rendered micro webm clips"
      },
      "spec": {
            "today": [
                  "Cards show a fixed 64x64 PNG or SVG icon that never changes"
            ],
            "proposed": [
                  "Hovering card reveals an animated 4-second interaction clip in place of the icon"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Lazy load clips only on hover to prevent unnecessary bandwidth consumption"
            ],
            "verify": [
                  "Moving mouse over Waypack card reveals map pan and zoom clip"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Hover-to-Play Demo)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="border:2px solid #2F5BEA;box-shadow:0 8px 24px rgba(47,91,234,0.12)">
                    <div style="width:72px;height:72px;border-radius:14px;background:#0F172A;display:grid;place-items:center;color:#fff;position:relative;overflow:hidden">
                      <div style="font-size:24px">🗺️</div>
                      <div style="position:absolute;bottom:4px;right:4px;background:#2F5BEA;border-radius:4px;padding:2px 4px;font-size:9px;font-weight:700">PREVIEW</div>
                    </div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>Waypack</h4><span class="h-card-ver">v1.4.2</span></div>
                      <p class="h-card-desc">Hovering reveals offline vector zoom and multi-day itinerary scrubber.</p>
                      <div class="h-card-actions"><a class="h-btn-pri" href="#">Try Interactive Map</a></div>
                    </div>
                  </div>
                  ${KIT.apps.slice(1, 4).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c13",
      "n": 13,
      "name": "Swipeable Feature Highlight Carousel",
      "group": "cards",
      "tagline": "Mini horizontal carousel inside each card cycling through 3 killer features with screenshots",
      "concept": "Enriches app cards with multi-dimensional depth. Instead of a single static paragraph, cards include an interactive 3-tab mini-carousel cycling through 'Offline Maps', 'Flight Sync', and 'AI Itinerary'.",
      "moves": [
            "3-dot indicator at the bottom of each app card",
            "Tab switcher chips: [Vector Maps] [Flight Import] [GPX Export]",
            "Smooth horizontal slide animation with touch swipe support",
            "Auto-advances every 6 seconds or freezes on hover"
      ],
      "palette": [
            [
                  "Carousel Dot",
                  "#CBD5E1"
            ],
            [
                  "Dot Active",
                  "#2F5BEA"
            ],
            [
                  "Card Slate",
                  "#F8FAFC"
            ]
      ],
      "facts": {
            "Type": "Dense Information Architecture",
            "Effort": "S",
            "Needs": "Vue carousel state per card"
      },
      "spec": {
            "today": [
                  "Card has single fixed text paragraph"
            ],
            "proposed": [
                  "Card features mini tab carousel cycling through top 3 distinct features"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Keep height fixed to prevent card jumpiness during transitions"
            ],
            "verify": [
                  "Clicking carousel dots switches feature text and screenshot"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="flex-direction:column">
                    <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
                      <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                      <div><h4 style="margin:0;font-size:18px">Waypack</h4><span style="font-size:12px;color:#64748B">Feature 1 of 3</span></div>
                    </div>
                    <div style="padding:10px 14px;border-radius:10px;background:${dark ? "#1E293B" : "#F1F5F9"};margin-bottom:12px">
                      <b style="font-size:13px;color:#2F5BEA">Offline Vector Bundles</b>
                      <p style="margin:4px 0 0;font-size:12.5px;color:#64748B">Self-contained vector maps pre-cached with zero network reliance.</p>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <div style="display:flex;gap:6px">
                        <span style="width:16px;height:6px;border-radius:3px;background:#2F5BEA"></span>
                        <span style="width:6px;height:6px;border-radius:3px;background:#CBD5E1"></span>
                        <span style="width:6px;height:6px;border-radius:3px;background:#CBD5E1"></span>
                      </div>
                      <a class="h-btn-pri" href="#">Next Feature →</a>
                    </div>
                  </div>
                  ${KIT.apps.slice(1, 4).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c14",
      "n": 14,
      "name": "Live Version & Release Health Pill",
      "group": "cards",
      "tagline": "Direct card integration showing real-time TestFlight build, release date, and changelog popover",
      "concept": "Connects GitHub Pages directly to CI/CD health. Each card displays an interactive release badge: `v1.4.2 \u00b7 Updated 2d ago \u00b7 TestFlight Active`. Clicking opens a popover detailing recent commits and download URLs.",
      "moves": [
            "Pill badge showing semantic version and release age (e.g. 'Updated yesterday')",
            "TestFlight status dot (Green = Active build available; Yellow = Weekly rebuild pending)",
            "Clicking version opens a quick changelog popover extracted from GitHub Releases",
            "Direct DMG/APK download link button inside the popover"
      ],
      "palette": [
            [
                  "Health Green",
                  "#10B981"
            ],
            [
                  "Version Slate",
                  "#64748B"
            ],
            [
                  "Popover Dark",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "CI/CD & Release Visibility",
            "Effort": "S",
            "Needs": "status.data.ts API injection"
      },
      "spec": {
            "today": [
                  "No version numbers or release dates shown on app cards"
            ],
            "proposed": [
                  "Release health pills on each card linking directly to TestFlight and changelogs"
            ],
            "files": [
                  "pages/index.md",
                  "pages/status.data.ts",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Requires build-time GitHub API tokens or fallback values"
            ],
            "verify": [
                  "Card version pill accurately displays v1.4.2 and links to release notes"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Live Version Badges)</h2></div>
                <div class="h-apps-grid">
                  ${KIT.apps.slice(0, 4).map(a => `
                    <div class="h-card">
                      <div class="h-card-icon">${a.iconSvg}</div>
                      <div class="h-card-main">
                        <div class="h-card-top">
                          <h4>${a.name}</h4>
                          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:99px;background:#ECFDF5;color:#059669;font-size:11px;font-weight:700">
                            <span style="width:6px;height:6px;border-radius:50%;background:#10B981"></span>
                            ${a.version} · Active
                          </span>
                        </div>
                        <p class="h-card-desc">${a.desc}</p>
                        <div class="h-card-actions">
                          <a class="h-btn-pri" href="${a.appUrl}">TestFlight Build</a>
                          <a class="h-btn-sec" href="#">What's New</a>
                        </div>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c15",
      "n": 15,
      "name": "Interactive Platform Availability Chips",
      "group": "cards",
      "tagline": "Platform badges on cards function as interactive filters with capability tooltips",
      "concept": "Transforms passive platform tags into interactive navigational power tools. Clicking 'Apple Watch' filters the entire catalog to watchOS-enabled apps; hovering reveals hardware requirements (e.g. Watch Series 7+, watchOS 10).",
      "moves": [
            "Platform pills with official OS icons (Apple Watch, iOS, Android, Mac, Glasses)",
            "Clicking any pill immediately activates that platform filter in the catalog",
            "Hover tooltip reveals OS minimum requirement (e.g. 'Requires iOS 17.0+')",
            "Counts matching apps next to the badge (e.g. 'Apple Watch (4)')"
      ],
      "palette": [
            [
                  "Badge Apple",
                  "#000000"
            ],
            [
                  "Badge Android",
                  "#3DDC84"
            ],
            [
                  "Badge Pill",
                  "#EEF2FF"
            ]
      ],
      "facts": {
            "Type": "Navigation & Taxonomy",
            "Effort": "S",
            "Needs": "Click handler on platform pills"
      },
      "spec": {
            "today": [
                  "Platform tags are static non-clickable span elements"
            ],
            "proposed": [
                  "Platform tags filter the page when clicked and show hardware tooltips on hover"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Ensure smooth scroll back to app list when filter is applied"
            ],
            "verify": [
                  "Clicking 'Apple Watch' tag shows Wee Hours, Voxbrief, ToddlerCam, TinyTouch"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Clickable Platform Pills)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card">
                    <div class="h-card-icon">${KIT.apps[1].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>Wee Hours</h4></div>
                      <p class="h-card-desc">${KIT.apps[1].desc}</p>
                      <div class="h-card-tags">
                        <span class="h-tag" style="background:#2F5BEA;color:#fff;cursor:pointer">⌚ Apple Watch (Click to filter)</span>
                        <span class="h-tag" style="cursor:pointer">📱 iPhone</span>
                        <span class="h-tag" style="cursor:pointer">👓 G2 Glasses</span>
                      </div>
                      <div class="h-card-actions"><a class="h-btn-pri" href="#">Visit app</a></div>
                    </div>
                  </div>
                  ${KIT.apps.slice(2, 5).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c16",
      "n": 16,
      "name": "One-Click Instant QR Code Popover",
      "group": "cards",
      "tagline": "'Send to iPhone' button popping up high-res QR codes for seamless desktop-to-mobile handoff",
      "concept": "Bridges the desktop browser to mobile device gap. Visitors exploring HEJI Apps on a laptop can click 'Scan on Phone' on any card to trigger an instant crisp QR code pointing directly to that app's TestFlight or App Store URL.",
      "moves": [
            "'Scan to Install' button with mobile phone icon on each card",
            "Instant modal popover with SVG vector QR code",
            "Deep-links directly into Apple TestFlight app or Safari",
            "Alternative 'Copy link' button for clipboard sharing"
      ],
      "palette": [
            [
                  "QR White",
                  "#FFFFFF"
            ],
            [
                  "QR Black",
                  "#0F172A"
            ],
            [
                  "Button Tint",
                  "#2F5BEA"
            ]
      ],
      "facts": {
            "Type": "Cross-Device Onboarding",
            "Effort": "S",
            "Needs": "Lightweight client-side QR renderer"
      },
      "spec": {
            "today": [
                  "Links open web URLs, requiring users on desktop to manually re-type URLs on their phones"
            ],
            "proposed": [
                  "One-click QR code modal allowing instant phone camera scanning for TestFlight installs"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/QRCodeModal.vue"
            ],
            "risks": [
                  "QR codes must remain legible in dark mode (white border required)"
            ],
            "verify": [
                  "Clicking QR button opens popover; scanning with iPhone camera opens TestFlight"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (QR Code Handoff)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="border:2px solid #2F5BEA">
                    <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>Waypack</h4><span class="h-card-ver">v1.4.2</span></div>
                      <p class="h-card-desc">Scan to install directly on your connected iPhone via TestFlight.</p>
                      <div style="display:flex;align-items:center;gap:14px;margin-top:10px;padding:10px;border-radius:10px;background:${dark ? "#1E293B" : "#F8FAFC"}">
                        <div style="width:54px;height:54px;background:#fff;border-radius:6px;padding:4px;display:grid;place-items:center">
                          <svg viewBox="0 0 24 24" width="46" height="46"><rect width="24" height="24" fill="#000"/><rect x="3" y="3" width="7" height="7" fill="#fff"/><rect x="14" y="3" width="7" height="7" fill="#fff"/><rect x="3" y="14" width="7" height="7" fill="#fff"/></svg>
                        </div>
                        <div>
                          <div style="font-size:12px;font-weight:700">Scan with iPhone Camera</div>
                          <div style="font-size:11px;color:#64748B">Direct TestFlight Beta link</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  ${KIT.apps.slice(1, 4).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c17",
      "n": 17,
      "name": "Architecture & Stack Drawer on Cards",
      "group": "cards",
      "tagline": "Expandable card drawer revealing Supabase schema namespace, auth model, and AI weights",
      "concept": "Unfolds technical depth on demand without cluttering the initial card view. Clicking 'Inspect Architecture' expands a tidy technical drawer showing repo path, database schema isolation (`waypack.*`), and local AI model footprint.",
      "moves": [
            "Subtle 'Inspect Architecture' disclosure triangle on card footer",
            "Expands to reveal: Repo Path, Backend Isolation status, Local ML models, and MCP tool names",
            "Links directly to that app's source code on GitHub (`projects/<name>`)",
            "Smooth height animation with zero layout jumping"
      ],
      "palette": [
            [
                  "Drawer Bg",
                  "#0F172A"
            ],
            [
                  "Code Green",
                  "#10B981"
            ],
            [
                  "Label Slate",
                  "#94A3B8"
            ]
      ],
      "facts": {
            "Type": "Technical Transparency",
            "Effort": "S",
            "Needs": "Accordion drawer CSS/JS"
      },
      "spec": {
            "today": [
                  "No technical architecture details visible on the home page app cards"
            ],
            "proposed": [
                  "Expandable bottom drawer revealing exact monorepo specs for every app"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Keep drawer collapsed by default to protect consumer readability"
            ],
            "verify": [
                  "Clicking disclosure expands backend env, repo path, and AI models"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Architecture Drawer)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="flex-direction:column">
                    <div style="display:flex;gap:16px">
                      <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                      <div class="h-card-main">
                        <h4>Waypack</h4>
                        <p class="h-card-desc">${KIT.apps[0].desc}</p>
                      </div>
                    </div>
                    <div style="margin-top:12px;padding:12px;border-radius:10px;background:${dark ? "#0D1117" : "#F1F5F9"};font-family:monospace;font-size:11.5px;color:#334155">
                      <div style="color:#2F5BEA;font-weight:700">▾ ARCHITECTURE SNAPSHOT</div>
                      <div>• Repo: projects/waypack/</div>
                      <div>• Backend: Shared Supabase (schema: waypack.*)</div>
                      <div>• AI/MCP: Trip bundle schema validator</div>
                    </div>
                  </div>
                  ${KIT.apps.slice(1, 4).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c18",
      "n": 18,
      "name": "Direct TestFlight Beta Invite Card",
      "group": "cards",
      "tagline": "Cards feature live beta invite counters and 1-click TestFlight registration",
      "concept": "Empowers early adopters to participate immediately in active beta tests. Cards integrate real-time beta availability counters (`142/200 slots filled`) and provide direct public TestFlight join buttons.",
      "moves": [
            "Live slot capacity bar on cards with active public TestFlight betas",
            "One-click 'Join TestFlight Beta' button opening TestFlight directly",
            "Displays current test build number and expiration days remaining",
            "Shows 'No account or credit card required' trust chip"
      ],
      "palette": [
            [
                  "TestFlight Blue",
                  "#0071E3"
            ],
            [
                  "Capacity Green",
                  "#10B981"
            ],
            [
                  "Card Slate",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Community Onboarding",
            "Effort": "S",
            "Needs": "TestFlight public URL linkage"
      },
      "spec": {
            "today": [
                  "Cards link to web apps or docs, requiring multi-step navigation to find TestFlight"
            ],
            "proposed": [
                  "Direct TestFlight button with live slot indicator on applicable cards"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Slot counts require periodic manual or webhook synchronization"
            ],
            "verify": [
                  "Clicking TestFlight button opens direct Apple TestFlight invite URL"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (TestFlight Beta Hub)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card">
                    <div class="h-card-icon">${KIT.apps[1].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>Wee Hours</h4><span style="color:#0071E3;font-weight:700;font-size:12px">TestFlight Active</span></div>
                      <p class="h-card-desc">Help test 3am voice logging with your baby before official App Store release.</p>
                      <div style="margin:10px 0;background:#E2E8F0;height:6px;border-radius:3px;overflow:hidden">
                        <div style="background:#0071E3;width:72%;height:100%"></div>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-size:11px;color:#64748B">144 / 200 Beta Slots</span>
                        <a class="h-btn-pri" style="background:#0071E3" href="#">Join Beta →</a>
                      </div>
                    </div>
                  </div>
                  ${KIT.apps.slice(2, 5).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c19",
      "n": 19,
      "name": "Side-by-Side App Comparison Drawer",
      "group": "cards",
      "tagline": "Select any two apps to compare architecture, offline sync, AI models, and MCP tools",
      "concept": "Enables engineering comparison across the monorepo. Visitors can check a 'Compare' box on any two apps to slide open a bottom comparison drawer showing side-by-side matrices of storage engines, AI runtimes, and license models.",
      "moves": [
            "Checkbox on top right of each app card: 'Compare'",
            "Floating bottom bar showing selected apps: 'Compare Waypack vs Wee Hours'",
            "Modal comparison matrix: Storage Engine, Local AI Models, Backend Isolation, MCP Tools",
            "Downloadable comparison summary as Markdown"
      ],
      "palette": [
            [
                  "Compare Bar",
                  "#0F172A"
            ],
            [
                  "Button Brand",
                  "#2F5BEA"
            ],
            [
                  "Highlight Cyan",
                  "#06B6D4"
            ]
      ],
      "facts": {
            "Type": "Comparative Analysis",
            "Effort": "M",
            "Needs": "Floating bottom tray + comparison modal"
      },
      "spec": {
            "today": [
                  "No way to compare multiple apps side-by-side on the site"
            ],
            "proposed": [
                  "Interactive comparison drawer comparing architecture and offline capabilities"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/CompareTray.vue"
            ],
            "risks": [
                  "Comparison matrix must stay updated as app features evolve"
            ],
            "verify": [
                  "Selecting 2 apps opens comparison matrix with accurate architecture rows"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Compare Mode Active)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="border:2px solid #2F5BEA">
                    <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>Waypack</h4><span style="color:#2F5BEA;font-weight:700;font-size:12px">✓ Selected</span></div>
                      <p class="h-card-desc">${KIT.apps[0].desc}</p>
                    </div>
                  </div>
                  <div class="h-card" style="border:2px solid #2F5BEA">
                    <div class="h-card-icon">${KIT.apps[1].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>Wee Hours</h4><span style="color:#2F5BEA;font-weight:700;font-size:12px">✓ Selected</span></div>
                      <p class="h-card-desc">${KIT.apps[1].desc}</p>
                    </div>
                  </div>
                  ${KIT.apps.slice(2, 4).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              <div style="position:sticky;bottom:0;background:#0F172A;color:#fff;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #334155;z-index:90">
                <div style="font-size:14px;font-weight:600">Comparing <b>Waypack</b> vs <b>Wee Hours</b> (Offline Bundles vs Voice AI)</div>
                <div style="display:flex;gap:10px">
                  <button class="h-btn-pri" style="border:0">View Side-by-Side Matrix</button>
                  <button class="h-btn-sec" style="background:#1E293B;color:#fff;border-color:#475569">Clear</button>
                </div>
              </div>
            </div>
        `
    },
{
      "id": "c20",
      "n": 20,
      "name": "Audio & Soundscape Soundcheck Player",
      "group": "cards",
      "tagline": "Audio preview triggers on cards playing signature soundscapes and shutter sounds",
      "concept": "Engages visitors through sound. HEJI apps feature bespoke sound design: TinyTouch pentatonic bell chimes, ToddlerCam bouncy shutter clicks, and Wee Hours calming night chimes. Cards feature a tiny audio button to hear signature sounds instantly.",
      "moves": [
            "Speaker / audio icon button on applicable app cards",
            "Synthesizes Web Audio API pentatonic chimes with zero external audio assets",
            "Subtle animated soundwave animation when audio plays",
            "Displays sound designer credits and frequency response"
      ],
      "palette": [
            [
                  "Audio Pink",
                  "#EC4899"
            ],
            [
                  "Wave Violet",
                  "#8B5CF6"
            ],
            [
                  "Card Slate",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Auditory Experience",
            "Effort": "S",
            "Needs": "Web Audio API oscillator helper"
      },
      "spec": {
            "today": [
                  "Portal is completely silent with no demonstration of audio design"
            ],
            "proposed": [
                  "Play audio preview button on TinyTouch, ToddlerCam, and Wee Hours cards"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AudioPreview.vue"
            ],
            "risks": [
                  "Must never autoplay audio; requires explicit user tap"
            ],
            "verify": [
                  "Clicking audio button plays calm 3-note pentatonic chime"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Audio Experience)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card">
                    <div class="h-card-icon">${KIT.apps[6].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>TinyTouch</h4><span class="h-card-ver">v1.0.2</span></div>
                      <p class="h-card-desc">Calm Apple Watch play for toddlers. Listen to the pentatonic chime design.</p>
                      <div style="margin:10px 0;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:99px;background:#FDF2F8;color:#DB2777;font-size:12px;font-weight:700;cursor:pointer">
                        <span>▶ Hear Chime Sound</span>
                        <span style="font-family:monospace;font-size:10px">♫ 528Hz Pentatonic</span>
                      </div>
                    </div>
                  </div>
                  ${KIT.apps.slice(0, 3).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
// ── Round 2 (search): 08 hero search + 25 command palette, three ways to build them as one thing
{
      id: "c103",
      n: 103,
      round: 2,
      group: "taxonomy",
      name: "One Palette, Two Doors",
      tagline: "08 + 25: the hero search field and ⌘K open the same palette, which replaces VitePress's search modal",
      concept: "08 and 25 are the same idea seen from two places, and both collide with VitePress local search, which already owns ⌘K and /. This merges them: one CommandPalette component, opened from the navbar button, the hero field, ⌘K or /, searching apps, doc sections, actions and CI workflows. The cost is owning search: the built-in modal goes away, so the palette must match its doc-search quality.",
      moves: [
        "Replace the local-search modal with CommandPalette.vue; keep VitePress's MiniSearch index for doc sections (same results as today)",
        "Add three sections the built-in search can't have: Apps (jump to card), Actions (copy a cut_release.sh dry-run, open /status, report a problem → FeedbackKit ⌘⇧F), CI workflows (open the .yml run page)",
        "Hero field (08) is a button styled as an input; focus or click opens the palette with the typed text carried over",
        "Recent queries row (25) from localStorage; ↑ ↓ ↵ esc; / and ⌘K / Ctrl+K anywhere except inside inputs",
      ],
      palette: [["Panel", "#FFFFFF"], ["Selection", "#EEF2FF"], ["Brand", "#2F5BEA"]],
      facts: { Type: "Search architecture (08 + 25)", Effort: "M", Needs: "Build-time palette index (apps.ts + .github/workflows list + actions); reuse VitePress's localSearchIndex for docs" },
      spec: {
        today: [
          "config.mts: `search: { provider: \"local\" }` → VPLocalSearchBox, a MiniSearch index of every page's h1–h3 sections, opened by the navbar button, ⌘K and /",
          "Results are doc sections only: no apps as entities, no actions, no workflows",
          "FeedbackKit's shortcut is ⌘⇧F (feedbackkit-web default), so ⌘K is free of conflicts today",
        ],
        proposed: [
          "Keep `provider: \"local\"` so VitePress still builds `@localSearchIndex` (the docs index); replace the navbar's VPNavBarSearch with our button (theme alias in config.mts `vite.resolve.alias`) so the built-in modal never mounts",
          "CommandPalette.vue loads the docs index via `import localSearchIndex from '@localSearchIndex'` and MiniSearch (already a VitePress dependency), plus palette.data.ts: apps from apps.ts, workflows from .github/workflows/*.yml (as status.data.ts does), and a static actions list",
          "Ranking: exact app name → Apps first; otherwise MiniSearch score, with sections capped at 3 rows and 'Show all docs' to expand",
          "Hero field (08) and navbar button both call `openPalette(initialQuery)` from theme/palette.ts",
        ],
        files: ["pages/.vitepress/config.mts", "pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/CommandPalette.vue (new)", "pages/.vitepress/theme/palette.ts (new)", "pages/palette.data.ts (new)", "pages/.vitepress/theme/HeroSearch.vue (new)", "pages/.vitepress/theme/custom.css"],
        risks: [
          "`@localSearchIndex` is a VitePress-internal virtual module; pin vitepress and add a build smoke test so an upgrade can't silently break docs search",
          "Doc-search parity: the built-in modal's excerpts and keyboard handling must not regress (compare top-5 results for 10 sample queries)",
          "⌘K inside the FeedbackKit form or a code block must not open the palette",
        ],
        verify: [
          "Same 10 queries (e.g. 'graduation', 'cut_release', 'whisper', 'offline maps') return the built-in's top doc result first",
          "'testflight' lists every *-testflight.yml workflow (8 today); ↵ on one opens its GitHub Actions page",
          "Typing in the hero field then pressing ↵ opens the palette with the text kept",
        ],
      },
      design: [
        {
          kind: "flow",
          title: "Search, today and proposed",
          note: "Docs results keep coming from the index VitePress already builds; the palette adds apps, actions and workflows from build-time data.",
          today: {
            nodes: [
              { id: "md", label: "pages/**/*.md", col: 0, row: 0, type: "store" },
              { id: "idx", label: "@localSearchIndex", sub: "MiniSearch, h1–h3", col: 1, row: 0, type: "store" },
              { id: "btn", label: "Navbar button", sub: "⌘K, /", col: 1, row: 1, type: "ui" },
              { id: "modal", label: "VPLocalSearchBox", sub: "doc sections only", col: 2, row: 0, type: "ui" },
            ],
            edges: [{ from: "md", to: "idx", label: "build" }, { from: "idx", to: "modal" }, { from: "btn", to: "modal" }],
          },
          proposed: {
            nodes: [
              { id: "md", label: "pages/**/*.md", col: 0, row: 0, type: "store" },
              { id: "idx", label: "@localSearchIndex", sub: "unchanged", col: 1, row: 0, type: "store" },
              { id: "apps", label: "apps.ts", sub: "8 apps", col: 0, row: 1, type: "store", state: "new" },
              { id: "wf", label: ".github/workflows", sub: "*.yml", col: 0, row: 2, type: "store" },
              { id: "pd", label: "palette.data.ts", sub: "apps, workflows, actions", col: 1, row: 2, type: "store", state: "new" },
              { id: "pal", label: "CommandPalette.vue", sub: "4 sections", col: 2, row: 1, type: "ui", state: "new" },
              { id: "modal", label: "VPLocalSearchBox", col: 2, row: 0, type: "ui", state: "removed" },
              { id: "hero", label: "Hero field (08)", col: 3, row: 0, type: "ui", state: "new" },
              { id: "btn", label: "Navbar button", sub: "⌘K, /", col: 3, row: 2, type: "ui", state: "changed" },
            ],
            edges: [
              { from: "md", to: "idx", label: "build" }, { from: "idx", to: "pal", label: "docs" },
              { from: "apps", to: "pd" }, { from: "wf", to: "pd" }, { from: "pd", to: "pal" },
              { from: "hero", to: "pal", label: "open(q)" }, { from: "btn", to: "pal", label: "open()" },
            ],
          },
        },
        {
          kind: "code",
          title: "palette entry shape",
          lang: "ts",
          after: `type Entry =
  | { kind: "app"; id: string; title: string; hint: string; href: \`#\${string}\` }
  | { kind: "doc"; title: string; titles: string[]; href: string }       // from @localSearchIndex
  | { kind: "action"; title: string; run: "copy" | "navigate" | "feedback"; value: string }
  | { kind: "workflow"; file: string; name: string; triggers: string[]; href: string };`,
        },
      ],
      render: ({ dark }) => KIT.r2PaletteScreen({ dark, q: "whisper", heroField: true }),
      views: [
        { name: "Hero field opened the palette (light)", render: () => KIT.r2PaletteScreen({ dark: false, q: "whisper", heroField: true }) },
        { name: "⌘K from a docs page, query 'testflight' (dark)", dark: true, render: () => KIT.r2PaletteScreen({ dark: true, q: "testflight", heroField: false, recent: true }) },
      ],
    },
{
      id: "c104",
      n: 104,
      round: 2,
      group: "taxonomy",
      name: "Upgrade the Built-in Search",
      tagline: "08 + 25 at effort S: keep VitePress's modal, teach it about apps, and put a big door to it in the hero",
      concept: "The cheapest honest version of the shortlisted search ideas. VitePress local search stays; the hero gets a large field (08) that just opens it, and the index learns app names, synonyms and the release commands by indexing a hidden /find page built from apps.ts. No actions or workflow rows: that's what 103 adds for the extra effort.",
      moves: [
        "Hero field (08) opens the existing VPLocalSearchBox (dispatches the same ⌘K it listens for), with suggestion chips for real queries: offline maps, whisper, cut_release, graduation",
        "`search.options.miniSearch.searchOptions`: boost titles ×3 and add fuzzy 0.2, so 'waypak' still finds Waypack",
        "A generated pages/find.md (noindex, not in nav) lists each app with synonyms (\"baby log\", \"newborn\", \"trip offline\"), so typing a need, not a name, finds the app",
        "detailedView on, so results show the matched paragraph",
      ],
      palette: [["Field", "#FFFFFF"], ["Chip", "#EEF2FF"], ["Brand", "#2F5BEA"]],
      facts: { Type: "Search tuning (08 + 25, minimal)", Effort: "S", Needs: "pages_sync.mjs writes find.md from apps.ts; config.mts search options" },
      spec: {
        today: ["`search: { provider: \"local\" }` with default options: exact-ish matching, no synonyms, no app entities"],
        proposed: [
          "config.mts: `search: { provider: \"local\", options: { detailedView: true, miniSearch: { searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 3 } } } } }`",
          "scripts/pages_sync.mjs writes pages/find.md (frontmatter `search: true`, `sidebar: false`, `outline: false`, robots noindex) with one heading per app plus its synonyms",
          "HeroSearch.vue: a large field-looking button that calls the local search's open (dispatch keydown ⌘K) and suggestion chips that prefill nothing (the built-in modal has no prefill API)",
        ],
        files: ["pages/.vitepress/config.mts", "scripts/pages_sync.mjs", "pages/find.md (generated)", "pages/.vitepress/theme/HeroSearch.vue (new)", "pages/index.md"],
        risks: [
          "Chips can't prefill the built-in modal's query without reaching into its internals; they'd navigate to the result instead",
          "find.md must not show up as a confusing result: give each heading a link to the real app card",
        ],
        verify: ["'baby log' → Wee Hours, 'waypak' → Waypack, 'cut_release' → The monorepo › Releases, in the built-in modal"],
      },
      design: [
        {
          kind: "table",
          title: "103 vs 104",
          head: ["", "103 One Palette, Two Doors", "104 Upgrade the Built-in"],
          rows: [
            ["Doc results", "Same index, own UI", "Built-in UI"],
            ["Apps as results", "Yes, jump to card", "Via find.md headings"],
            ["Actions / workflows", "Yes", "No"],
            ["Hero field prefill", "Yes", "No"],
            ["Depends on internals", "@localSearchIndex", "None"],
            ["Effort", "M", "S"],
          ],
        },
      ],
      render: ({ dark }) => KIT.r2BuiltinSearch({ dark }),
    },
{
      id: "c105",
      n: 105,
      round: 2,
      group: "taxonomy",
      name: "Persona-Ranked Palette",
      tagline: "03 + 25: the palette orders its sections by who you said you are",
      concept: "Builds on 103 and uses the persona from 03 for one thing only: ranking. Someone who picked 'I want the apps' sees Apps and TestFlight-style actions first; 'I build with agents' sees Docs, workflows and release commands first. Nothing is hidden, so a wrong guess costs a scroll, not a dead end.",
      moves: [
        "Section order comes from persona: user = Apps, Actions, Docs, Workflows; builder = Docs, Workflows, Actions, Apps",
        "A one-line chip in the palette header shows the lens and flips it in place (Tab-reachable)",
        "Empty query shows persona starters: user = the 8 apps; builder = Monorepo › Releases, Status, supabase/GRADUATION.md",
      ],
      palette: [["User lens", "#6366F1"], ["Builder lens", "#10B981"], ["Panel", "#FFFFFF"]],
      facts: { Type: "Ranking on top of 103", Effort: "S (after 103)", Needs: "103's palette + 101/102's persona ref" },
      spec: {
        today: ["No persona exists; search ranks by text match only"],
        proposed: ["palette.ts sorts sections with an order table keyed by persona.value; within a section MiniSearch score is untouched", "Empty-query starters are a static list per persona in palette.data.ts"],
        files: ["pages/.vitepress/theme/palette.ts", "pages/palette.data.ts", "pages/.vitepress/theme/persona.ts"],
        risks: ["Only worth it if 101 or 102 ships the persona; on its own it is a hidden setting"],
        verify: ["Same query, two lenses: the first row differs; every row is present in both"],
      },
      render: ({ dark }) => KIT.r2PaletteScreen({ dark, q: "testflight", persona: "eng", order: ["docs", "workflows", "actions", "apps"] }),
      views: [
        { name: "'testflight' · builder lens", render: () => KIT.r2PaletteScreen({ dark: false, q: "testflight", persona: "eng", order: ["docs", "workflows", "actions", "apps"] }) },
        { name: "'whisper' · user lens (dark)", dark: true, render: () => KIT.r2PaletteScreen({ dark: true, q: "whisper", persona: "user", order: ["apps", "actions", "docs", "workflows"] }) },
      ],
    },
{
      "id": "c21",
      "n": 21,
      "name": "Facet Category Filter Pill Bar",
      "group": "taxonomy",
      "tagline": "Sticky category pill bar filtering apps by use-case with live match counters",
      "concept": "Replaces unstructured card browsing with organized faceted category filters. A clean pill bar allows filtering by 'All (8)', 'Parenting & Kids (3)', 'Travel & Offline (1)', 'Developer Tools (2)', and 'Voice & Audio (1)'.",
      "moves": [
            "Sticky horizontal pill bar above the app card grid",
            "Pills display real-time match counters: 'Parenting (3)', 'Dev Tools (2)'",
            "Smooth CSS grid transition when filtering apps",
            "Clear all button appears when any non-default category is active"
      ],
      "palette": [
            [
                  "Active Pill",
                  "#2F5BEA"
            ],
            [
                  "Pill Slate",
                  "#F1F5F9"
            ],
            [
                  "Counter Text",
                  "#64748B"
            ]
      ],
      "facts": {
            "Type": "Catalog Filtering",
            "Effort": "S",
            "Needs": "Vue reactive category filter state"
      },
      "spec": {
            "today": [
                  "All apps displayed in single unfilterable list in pages/index.md"
            ],
            "proposed": [
                  "Sticky category pill bar above apps grid with live count chips"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/CategoryFilter.vue"
            ],
            "risks": [
                  "Must preserve anchor linking directly to app sections (#weehours)"
            ],
            "verify": [
                  "Clicking 'Parenting & Kids' displays Wee Hours, ToddlerCam, TinyTouch"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="c21-pill-bar">
                  <span class="c21-pill">All Apps (8)</span>
                  <span class="c21-pill active">👶 Parenting &amp; Kids (3)</span>
                  <span class="c21-pill">✈️ Travel &amp; Offline (1)</span>
                  <span class="c21-pill">🛠️ Developer Tools (2)</span>
                  <span class="c21-pill">🎙️ Voice &amp; Audio (1)</span>
                </div>
                <div class="h-sec-hd"><h2>Parenting &amp; Kids (3 apps)</h2></div>
                <div class="h-apps-grid">
                  ${KIT.apps.filter(a => a.category.includes("Kids")).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c22",
      "n": 22,
      "name": "Hardware Platform Segmented Switcher",
      "group": "taxonomy",
      "tagline": "Segmented tab control filtering apps by target Apple & Android hardware platforms",
      "concept": "Caters to hardware-focused visitors. Many users look specifically for Apple Watch companion apps or native macOS utilities. This control filters apps by device target: 'Apple Watch', 'iPhone/iPad', 'macOS', 'Android', and 'Web/CLI'.",
      "moves": [
            "iOS-style segmented control: [All Devices] [Apple Watch] [iPhone] [macOS] [Android]",
            "Apps matching the active platform remain visible; non-matching apps dim or fold",
            "Highlights platform-specific features (e.g. Complications, Dynamic Island, Menu Bar)",
            "Syncs selection with URL hash (#platform=watch)"
      ],
      "palette": [
            [
                  "Segment Active",
                  "#FFFFFF"
            ],
            [
                  "Segment Bg",
                  "#E2E8F0"
            ],
            [
                  "Active Text",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Hardware Taxonomy",
            "Effort": "S",
            "Needs": "Platform array search in Vue"
      },
      "spec": {
            "today": [
                  "No way to see which apps support Apple Watch or Android on the homepage"
            ],
            "proposed": [
                  "Platform switcher tabs filtering by Apple Watch, iOS, macOS, Android"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/PlatformSwitcher.vue"
            ],
            "risks": [
                  "Multi-platform apps must appear in multiple platform views"
            ],
            "verify": [
                  "Selecting Apple Watch shows 4 apps with watchOS support"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div style="display:flex;justify-content:center;margin-bottom:24px">
                  <div style="display:inline-flex;padding:4px;border-radius:12px;background:${dark ? "#1E293B" : "#E2E8F0"}">
                    <span style="padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">All</span>
                    <span style="padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600;background:${dark ? "#334155" : "#fff"};box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer">⌚ Apple Watch</span>
                    <span style="padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">📱 iPhone</span>
                    <span style="padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">💻 macOS</span>
                    <span style="padding:6px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">🤖 Android</span>
                  </div>
                </div>
                <div class="h-sec-hd"><h2>Apple Watch Ready Apps (4)</h2></div>
                <div class="h-apps-grid">
                  ${KIT.apps.filter(a => a.platforms.some(p => p.includes("Watch"))).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c23",
      "n": 23,
      "name": "AI Architecture Filter Tabs",
      "group": "taxonomy",
      "tagline": "Filter apps by on-device model type, MCP server readiness, or pure utility (zero AI)",
      "concept": "Provides immediate architectural transparency. In an era of AI hype, users want to know exactly what runs on their device versus in the cloud. Filters by 'On-Device Whisper', 'Local Qwen3', 'MCP Server', or 'Zero AI / Pure Utility'.",
      "moves": [
            "Filter pills: [On-Device Whisper] [Local Qwen3] [MCP Server] [Zero AI]",
            "Highlights offline verification for on-device models",
            "Displays model parameter count and download size on cards (e.g. Whisper base 74MB)",
            "Explicit 'Zero AI' badge for users who prefer deterministic classical software"
      ],
      "palette": [
            [
                  "Local AI Green",
                  "#10B981"
            ],
            [
                  "MCP Violet",
                  "#6366F1"
            ],
            [
                  "Pure Utility Blue",
                  "#0284C7"
            ]
      ],
      "facts": {
            "Type": "AI Transparency",
            "Effort": "S",
            "Needs": "AI metadata property per app"
      },
      "spec": {
            "today": [
                  "AI capabilities only mentioned in unstructured card body text"
            ],
            "proposed": [
                  "Filter bar sorting apps by local model type, MCP tool availability, or Zero AI"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AIFilter.vue"
            ],
            "risks": [
                  "Clearly distinguish on-device models from MCP server integrations"
            ],
            "verify": [
                  "Filtering by 'Zero AI' shows TinyTouch with 'Zero AI / Pure Utility' badge"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="c21-pill-bar">
                  <span class="c21-pill active">🟢 On-Device Models (3)</span>
                  <span class="c21-pill">🟣 MCP Tool Servers (4)</span>
                  <span class="c21-pill">⚪ Zero AI / Pure Utility (1)</span>
                </div>
                <div class="h-sec-hd"><h2>On-Device AI Apps (Runs local with 0 network)</h2></div>
                <div class="h-apps-grid">
                  ${KIT.apps.filter(a => a.ai.includes("On-Device")).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c24",
      "n": 24,
      "name": "Backend Isolation Architecture Filter",
      "group": "taxonomy",
      "tagline": "Filter by monorepo backend strategy: Shared Supabase vs Own Backend vs Zero Backend",
      "concept": "Grounded in the monorepo's graduation rules (`supabase/GRADUATION.md`). Allows engineers to filter products by backend architecture: 'Zero Backend' (Voxbrief, ToddlerCam, TinyTouch), 'Shared Supabase' (Waypack, Wee Hours), or 'Own Backend' (FeedbackKit).",
      "moves": [
            "Filters: [All] [Zero Backend / Local Only] [Shared Supabase] [Independent Backend]",
            "Cards display database schema namespace badge (`schema: weehours.*`)",
            "Links to `supabase/GRADUATION.md` explaining isolation requirements",
            "Demonstrates compliance with no cross-schema foreign keys rule"
      ],
      "palette": [
            [
                  "Supabase Green",
                  "#3ECF8E"
            ],
            [
                  "Zero Backend Blue",
                  "#0EA5E9"
            ],
            [
                  "Own Backend Indigo",
                  "#6366F1"
            ]
      ],
      "facts": {
            "Type": "System Architecture Taxonomy",
            "Effort": "S",
            "Needs": "Backend env metadata mapping"
      },
      "spec": {
            "today": [
                  "Backend architecture only documented in internal AGENTS.md / monorepo.md"
            ],
            "proposed": [
                  "Public filter on the site allowing engineers to inspect backend isolation levels"
            ],
            "files": [
                  "pages/index.md",
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/BackendFilter.vue"
            ],
            "risks": [
                  "Keep terminology clear for non-engineer visitors"
            ],
            "verify": [
                  "Filtering by 'Zero Backend' shows Voxbrief, Meowtrix, ToddlerCam, TinyTouch"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="c21-pill-bar">
                  <span class="c21-pill active">⚡ Zero Backend / Local Only (4)</span>
                  <span class="c21-pill">🗄️ Shared Supabase (3)</span>
                  <span class="c21-pill">🛡️ Independent Backend (1)</span>
                </div>
                <div class="h-sec-hd"><h2>Zero Backend Products (No server dependencies)</h2></div>
                <div class="h-apps-grid">
                  ${KIT.apps.filter(a => a.backend.includes("None")).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c25",
      "n": 25,
      "name": "Global Cmd+K Command Palette",
      "group": "taxonomy",
      "tagline": "Full-featured modal command palette indexing apps, docs sections, CLI tools, and releases",
      "concept": "Provides instant developer navigation across the monorepo. Pressing `Cmd+K` from any page brings up a unified spotlight palette to quickly open apps, jump to documentation anchors, copy CLI snippets, or check CI status.",
      "moves": [
            "Keyboard shortcut trigger `Cmd+K` / `Ctrl+K` with clean modal overlay",
            "Categorized search results: Apps, Documentation, MCP Tools, CI Workflows",
            "Action shortcuts: 'Copy Waypack CLI install command', 'Open TestFlight invite'",
            "Recent searches and keyboard arrow key navigation (`Up`/`Down`/`Enter`)"
      ],
      "palette": [
            [
                  "Modal Overlay",
                  "rgba(15,23,42,0.6)"
            ],
            [
                  "Palette Bg",
                  "#FFFFFF"
            ],
            [
                  "Active Row",
                  "#EEF2FF"
            ]
      ],
      "facts": {
            "Type": "Power-User Command Palette",
            "Effort": "M",
            "Needs": "Client-side search index"
      },
      "spec": {
            "today": [
                  "VitePress default search modal only indexes markdown document headings"
            ],
            "proposed": [
                  "Full command palette indexing apps, MCP tools, release lines, and CLI shortcuts"
            ],
            "files": [
                  "pages/.vitepress/theme/components/CommandPalette.vue",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Avoid conflicting with browser native shortcut keys"
            ],
            "verify": [
                  "Pressing Cmd+K opens palette; typing 'testflight' lists all active build lines"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="position:relative">
              ${KIT.nav("apps")}
              <!-- Command Palette Modal Overlay -->
              <div style="position:absolute;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;justify-content:center;padding-top:80px;z-index:99">
                <div style="width:100%;max-width:580px;background:${dark ? "#151922" : "#fff"};border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);border:1px solid #CBD5E1;overflow:hidden">
                  <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                    ${KIT.svgIcons.search}
                    <input type="text" value="waypack" style="flex:1;border:0;outline:none;background:transparent;font-size:16px;color:inherit" readonly>
                    <span style="font-size:11px;color:#94A3B8;padding:2px 6px;border-radius:4px;background:#F1F5F9">ESC to close</span>
                  </div>
                  <div style="padding:10px;font-size:13px">
                    <div style="padding:4px 8px;font-size:11px;font-weight:700;color:#94A3B8">APPS</div>
                    <div style="padding:10px;border-radius:8px;background:#EEF2FF;color:#2F5BEA;display:flex;justify-content:space-between;align-items:center">
                      <span><b>Waypack</b> — Your trip, packed (Offline vector maps)</span>
                      <span>↵ Jump to app</span>
                    </div>
                    <div style="padding:4px 8px;font-size:11px;font-weight:700;color:#94A3B8;margin-top:8px">DOCUMENTATION</div>
                    <div style="padding:8px 10px;border-radius:8px;color:#475569">Waypack: Offline Bundles Specification</div>
                    <div style="padding:8px 10px;border-radius:8px;color:#475569">Waypack: Supabase Schema &amp; Isolation Rules</div>
                  </div>
                </div>
              </div>
            </div>
        `
    },
{
      "id": "c26",
      "n": 26,
      "name": "Interactive Tag Cloud with Live Counts",
      "group": "taxonomy",
      "tagline": "Tag cloud showing capability keywords (#offline, #whisper, #watchos, #mcp) with counts",
      "concept": "Enables exploratory serendipity. Visitors can browse capabilities via an interactive tag cloud. Clicking `#whisper` immediately brings up Wee Hours and Voxbrief; clicking `#watchos` filters to all 4 Apple Watch products.",
      "moves": [
            "Tag cloud component positioned between hero and catalog",
            "Tags size dynamically based on matching app frequency",
            "Active state highlights selected tags with brand glow",
            "Supports multi-tag selection (e.g. `#offline` + `#watchos`)"
      ],
      "palette": [
            [
                  "Tag Tint",
                  "#EEF2FF"
            ],
            [
                  "Tag Active",
                  "#2F5BEA"
            ],
            [
                  "Tag Text",
                  "#3730A3"
            ]
      ],
      "facts": {
            "Type": "Exploratory Taxonomy",
            "Effort": "S",
            "Needs": "Tag aggregator script in kit"
      },
      "spec": {
            "today": [
                  "Tags are scattered inside individual cards with no holistic tag cloud"
            ],
            "proposed": [
                  "Consolidated tag cloud summarizing all capabilities with live match counts"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/TagCloud.vue"
            ],
            "risks": [
                  "Avoid visual clutter by limiting cloud to top 10 most relevant tags"
            ],
            "verify": [
                  "Clicking #whisper filters list to the 2 Whisper-powered apps"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div style="padding:16px 20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;margin-bottom:24px">
                  <div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:10px">EXPLORE BY CAPABILITY</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px">
                    <span class="h-tag" style="background:#2F5BEA;color:#fff;cursor:pointer">#offline-first (8)</span>
                    <span class="h-tag" style="cursor:pointer">#apple-watch (4)</span>
                    <span class="h-tag" style="cursor:pointer">#mcp-server (4)</span>
                    <span class="h-tag" style="cursor:pointer">#whisper-local (2)</span>
                    <span class="h-tag" style="cursor:pointer">#kids-safe (2)</span>
                    <span class="h-tag" style="cursor:pointer">#supabase (3)</span>
                  </div>
                </div>
                <div class="h-sec-hd"><h2>Showing 8 apps with #offline-first</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c27",
      "n": 27,
      "name": "Curated Persona Presets",
      "group": "taxonomy",
      "tagline": "One-click curated presets: '\ud83d\udc76 For New Parents', '\u2708\ufe0f For Nomads', '\ud83e\udd16 For AI Builders'",
      "concept": "Cuts straight to user value by organizing apps into curated lifestyle collections. A new parent doesn't care about Meowtrix; a developer doesn't need TinyTouch. One click instantly surfaces the tailored 3-app bundle for their life.",
      "moves": [
            "Persona cards: [\ud83d\udc76 The 3am Parent Bundle] [\u2708\ufe0f The Signal-Free Traveler] [\ud83e\udd16 The AI Agent Builder]",
            "Activating a persona highlights recommended apps and dims others",
            "Provides a 1-click 'Install all TestFlights' button for that persona",
            "Includes a brief narrative explaining why those apps pair perfectly together"
      ],
      "palette": [
            [
                  "Parent Pink",
                  "#F472B6"
            ],
            [
                  "Traveler Cyan",
                  "#06B6D4"
            ],
            [
                  "Builder Violet",
                  "#8B5CF6"
            ]
      ],
      "facts": {
            "Type": "Curated Collections",
            "Effort": "S",
            "Needs": "Persona configuration object in kit"
      },
      "spec": {
            "today": [
                  "Apps listed in arbitrary monorepo alphabetical order"
            ],
            "proposed": [
                  "Curated persona bundles highlighting complementary app pairings"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/PersonaBundles.vue"
            ],
            "risks": [
                  "Ensure visitors can easily return to the full uncurated list"
            ],
            "verify": [
                  "Clicking 'New Parents' surfaces Wee Hours, ToddlerCam, and TinyTouch"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">
                  <div style="padding:16px;border-radius:14px;background:#FDF2F8;border:2px solid #EC4899;cursor:pointer">
                    <div style="font-size:24px;margin-bottom:6px">👶</div>
                    <b style="font-size:15px;color:#BE185D">New Parents Pack</b>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748B">Wee Hours + ToddlerCam + TinyTouch</p>
                  </div>
                  <div style="padding:16px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;cursor:pointer">
                    <div style="font-size:24px;margin-bottom:6px">✈️</div>
                    <b style="font-size:15px">Offline Traveler</b>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748B">Waypack + Voxbrief</p>
                  </div>
                  <div style="padding:16px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;cursor:pointer">
                    <div style="font-size:24px;margin-bottom:6px">🤖</div>
                    <b style="font-size:15px">AI Agent Builder</b>
                    <p style="margin:4px 0 0;font-size:12px;color:#64748B">FeedbackKit + Meowtrix</p>
                  </div>
                </div>
                <div class="h-sec-hd"><h2>Selected: New Parents Pack (3 apps)</h2></div>
                <div class="h-apps-grid">${KIT.apps.filter(a => a.category.includes("Kids")).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c28",
      "n": 28,
      "name": "Boolean Multi-Filter Combinator",
      "group": "taxonomy",
      "tagline": "Advanced multi-attribute filtering supporting Match ALL vs Match ANY compound logic",
      "concept": "Enables complex queries for power users and monorepo engineers. Allows searching for apps that match both `Platform: Apple Watch` AND `Backend: Zero Backend`, instantly revealing the offline wearable apps.",
      "moves": [
            "Dropdown filters for Platform, AI Type, Backend Strategy, and Category",
            "Logic toggle switch: 'Match ALL filters' (AND) vs 'Match ANY filter' (OR)",
            "Active filter chips displayed with individual 'x' dismiss icons",
            "Instant results count: 'Showing 2 of 8 apps'"
      ],
      "palette": [
            [
                  "Combinator Slate",
                  "#334155"
            ],
            [
                  "Badge Active",
                  "#2F5BEA"
            ],
            [
                  "Chip Dismiss",
                  "#EF4444"
            ]
      ],
      "facts": {
            "Type": "Power-User Query Builder",
            "Effort": "M",
            "Needs": "Compound filtering function"
      },
      "spec": {
            "today": [
                  "No multi-attribute filtering capability exists on the site"
            ],
            "proposed": [
                  "Compound filter bar with AND/OR logic and dismissible filter chips"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/CompoundFilter.vue"
            ],
            "risks": [
                  "Avoid empty state if user creates overly restrictive filter combination"
            ],
            "verify": [
                  "Selecting Apple Watch + Zero Backend correctly displays ToddlerCam and TinyTouch"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div style="padding:14px 20px;border-radius:12px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:13px;font-weight:700">FILTERS:</span>
                    <span style="padding:4px 10px;border-radius:99px;background:#EEF2FF;color:#2F5BEA;font-size:12px;font-weight:600">Platform: Apple Watch ✕</span>
                    <span style="padding:4px 10px;border-radius:99px;background:#ECFDF5;color:#059669;font-size:12px;font-weight:600">Backend: Zero Backend ✕</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;font-size:12px">
                    <span>Logic:</span>
                    <span style="padding:2px 8px;border-radius:6px;background:#2F5BEA;color:#fff;font-weight:700">AND</span>
                    <span style="color:#64748B;cursor:pointer">Clear all</span>
                  </div>
                </div>
                <div class="h-sec-hd"><h2>2 apps match criteria</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(5, 7).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c29",
      "n": 29,
      "name": "Compact Data Table vs Visual Grid Toggle",
      "group": "taxonomy",
      "tagline": "Toggle button between dense developer spreadsheet table and marketing visual cards",
      "concept": "Solves information density for systems engineers. Visitors can switch between the friendly visual card grid and a dense, scannable data table showing columns: App, Category, Platform, Backend Schema, AI Engine, TestFlight Build, and Size.",
      "moves": [
            "View switcher icon toggle: [Card Grid] vs [Dense Table]",
            "Table view sorts by column: Name, Version, Platform count, or Last Updated",
            "Copy row data as JSON or CSV button",
            "Remembers visitor layout preference in localStorage"
      ],
      "palette": [
            [
                  "Table Border",
                  "#E2E8F0"
            ],
            [
                  "Row Hover",
                  "#F8FAFC"
            ],
            [
                  "Header Slate",
                  "#64748B"
            ]
      ],
      "facts": {
            "Type": "Layout Density Switcher",
            "Effort": "S",
            "Needs": "Vue table component"
      },
      "spec": {
            "today": [
                  "Only visual card grid layout is available"
            ],
            "proposed": [
                  "Toggle button providing dense table view with sortable columns for engineers"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppTableView.vue"
            ],
            "risks": [
                  "Ensure table scrolls horizontally on small smartphone viewports"
            ],
            "verify": [
                  "Toggling to Table renders compact 8-row table with all technical specifications"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                  <h2 style="margin:0;font-size:22px">Monorepo Products (Table View)</h2>
                  <div style="display:flex;gap:4px;padding:3px;border-radius:8px;background:#E2E8F0">
                    <span style="padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer">Cards</span>
                    <span style="padding:4px 8px;border-radius:6px;font-size:12px;background:#fff;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,0.1)">Table</span>
                  </div>
                </div>
                <div style="border-radius:12px;border:1px solid #CBD5E1;overflow:hidden;background:${dark ? "#151922" : "#fff"}">
                  <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                    <thead>
                      <tr style="background:${dark ? "#1E293B" : "#F8FAFC"};border-bottom:1px solid #CBD5E1;color:#64748B;font-size:11.5px">
                        <th style="padding:10px 14px">APP</th>
                        <th style="padding:10px 14px">VERSION</th>
                        <th style="padding:10px 14px">BACKEND</th>
                        <th style="padding:10px 14px">AI RUNTIME</th>
                        <th style="padding:10px 14px">PLATFORMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${KIT.apps.slice(0, 5).map(a => `
                        <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                          <td style="padding:10px 14px;font-weight:700;color:#2F5BEA">${a.name}</td>
                          <td style="padding:10px 14px;font-family:monospace">${a.version}</td>
                          <td style="padding:10px 14px">${a.backend}</td>
                          <td style="padding:10px 14px"><span class="h-tag">${a.ai}</span></td>
                          <td style="padding:10px 14px">${a.platforms.slice(0, 2).join(", ")}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c30",
      "n": 30,
      "name": "Deep-Linked URL State for Search & Filters",
      "group": "taxonomy",
      "tagline": "Filter states automatically serialize into URL parameters (?cat=travel&ai=local) for sharing",
      "concept": "Enables seamless link sharing and bookmarking. When a user filters for Apple Watch apps or types a search query, the browser address bar immediately updates to `?platform=watch&q=offline`. Pasting the link reproduces the exact filtered view.",
      "moves": [
            "Syncs filter and search state with `window.history.replaceState`",
            "Copy direct link button: 'Share this filtered view'",
            "Supports browser Back/Forward navigation across filter actions",
            "Clean human-readable query keys: `?cat=travel&ai=on-device`"
      ],
      "palette": [
            [
                  "URL Pill",
                  "#F1F5F9"
            ],
            [
                  "Share Blue",
                  "#2F5BEA"
            ],
            [
                  "Query Key",
                  "#059669"
            ]
      ],
      "facts": {
            "Type": "URL State Synchronization",
            "Effort": "S",
            "Needs": "URLSearchParams watcher in Vue"
      },
      "spec": {
            "today": [
                  "Filter states are ephemeral and lost on refresh or page sharing"
            ],
            "proposed": [
                  "Full bi-directional URL query sync enabling direct link sharing of filtered views"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Avoid polluting browser history stack on every keystroke (use replaceState)"
            ],
            "verify": [
                  "Opening URL with ?platform=watch automatically selects Apple Watch filter"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:#ECFDF5;border:1px solid #A7F3D0;margin-bottom:20px">
                  <div style="font-size:12.5px;color:#065F46">
                    🔗 <b>Sharable URL Active:</b> <code style="font-family:monospace">hejitech.dev/?platform=watch&amp;ai=on-device</code>
                  </div>
                  <button class="h-btn-pri" style="background:#059669;padding:4px 10px;font-size:11px">Copy Link</button>
                </div>
                <div class="h-sec-hd"><h2>Filtered: Apple Watch + On-Device AI (2 apps)</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(1, 3).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c31",
      "n": 31,
      "name": "Real-Time Pipeline Pulse Visualizer",
      "group": "status",
      "tagline": "Pulsing animated status dots showing live GitHub Actions pipeline runs and duration",
      "concept": "Upgrades the static status board (`pages/status.md`) into a real-time observability console. Shows active workflow runs with soft pulsing dots, commit SHA tags, run durations (e.g. `2m 14s`), and instant links to GitHub Actions logs.",
      "moves": [
            "Animated green/amber pulsing status rings for active builds",
            "Displays exact run duration (e.g. 'Waypack TestFlight: 4m 12s')",
            "Commit SHA chips linking directly to commit diffs on GitHub",
            "Subtle visual cue when a scheduled Wednesday TestFlight build is running"
      ],
      "palette": [
            [
                  "Live Pulse",
                  "#10B981"
            ],
            [
                  "Amber Pending",
                  "#F59E0B"
            ],
            [
                  "Console Slate",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "CI/CD Observability",
            "Effort": "S",
            "Needs": "StatusBoard.vue CSS pulse update"
      },
      "spec": {
            "today": [
                  "Status board in pages/status.md shows static badge chips without animation"
            ],
            "proposed": [
                  "Interactive pipeline pulse visualizer showing duration and animated health rings"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/StatusBoard.vue"
            ],
            "risks": [
                  "Animation must pause if prefers-reduced-motion is active"
            ],
            "verify": [
                  "Status board cards display live pulsing green indicators and run durations"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Monorepo Pipeline Pulse</h2></div>
                <div class="c31-pulse-grid">
                  <div class="c31-pulse-card">
                    <div style="display:flex;align-items:center;gap:12px">
                      <span class="c31-dot"></span>
                      <div><b>waypack-testflight.yml</b><div style="font-size:11px;color:#64748B">main @ 7c2a8f1 · 3m 42s</div></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#10B981">Passed 14m ago</span>
                  </div>
                  <div class="c31-pulse-card">
                    <div style="display:flex;align-items:center;gap:12px">
                      <span class="c31-dot"></span>
                      <div><b>weehours-ci.yml</b><div style="font-size:11px;color:#64748B">main @ 7c2a8f1 · 1m 18s</div></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#10B981">Passed 14m ago</span>
                  </div>
                  <div class="c31-pulse-card">
                    <div style="display:flex;align-items:center;gap:12px">
                      <span class="c31-dot"></span>
                      <div><b>supabase-ci.yml</b><div style="font-size:11px;color:#64748B">isolation check · 48s</div></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#10B981">Passed 14m ago</span>
                  </div>
                  <div class="c31-pulse-card">
                    <div style="display:flex;align-items:center;gap:12px">
                      <span class="c31-dot"></span>
                      <div><b>pages.yml</b><div style="font-size:11px;color:#64748B">VitePress build · 1m 02s</div></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#10B981">Deployed</span>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c32",
      "n": 32,
      "name": "TestFlight Expiration Countdown Radar",
      "group": "status",
      "tagline": "Radar tracking 90-day TestFlight window and automated Wednesday 17:00 UTC build triggers",
      "concept": "Grounded in the monorepo rule: 'Every iOS app TestFlight workflow runs weekly on Wednesday from main so builds never expire'. This radar shows the exact age of each build (e.g. `Day 4 of 90`), reassuring beta testers that builds are fresh.",
      "moves": [
            "Radial progress ring showing days elapsed out of Apple's 90-day TestFlight limit",
            "Next scheduled build countdown: 'Next auto-bump in 2 days (Wednesday 17:00 UTC)'",
            "Color-coded warning: Green (<30 days), Yellow (30-60 days), Amber (>60 days)",
            "Direct link to trigger workflow dispatch if manual bump is needed"
      ],
      "palette": [
            [
                  "Fresh Green",
                  "#10B981"
            ],
            [
                  "Warning Amber",
                  "#F59E0B"
            ],
            [
                  "Radar Slate",
                  "#1E293B"
            ]
      ],
      "facts": {
            "Type": "Release Lifecycle Radar",
            "Effort": "S",
            "Needs": "Calculate days from release timestamp"
      },
      "spec": {
            "today": [
                  "No indication of TestFlight build ages or expiration warnings on status page"
            ],
            "proposed": [
                  "TestFlight expiration radar tracking 90-day limit and Wednesday bump schedules"
            ],
            "files": [
                  "pages/status.md",
                  "pages/status.data.ts",
                  "pages/.vitepress/theme/StatusBoard.vue"
            ],
            "risks": [
                  "Handle edge case where workflow fails to run on Wednesday"
            ],
            "verify": [
                  "Radar displays accurate age (e.g. 'Day 5 of 90') for all iOS app builds"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>TestFlight Expiration Radar</h2></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                      <b>Waypack iOS</b>
                      <span style="color:#10B981;font-weight:700;font-size:12px">Day 4 / 90</span>
                    </div>
                    <div style="height:6px;border-radius:3px;background:#E2E8F0;margin-bottom:10px">
                      <div style="width:5%;height:100%;background:#10B981"></div>
                    </div>
                    <div style="font-size:11.5px;color:#64748B">Next automated bump: Wednesday 17:00 UTC</div>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                      <b>Wee Hours iOS</b>
                      <span style="color:#10B981;font-weight:700;font-size:12px">Day 4 / 90</span>
                    </div>
                    <div style="height:6px;border-radius:3px;background:#E2E8F0;margin-bottom:10px">
                      <div style="width:5%;height:100%;background:#10B981"></div>
                    </div>
                    <div style="font-size:11.5px;color:#64748B">Next automated bump: Wednesday 17:30 UTC</div>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                      <b>Voxbrief iOS</b>
                      <span style="color:#10B981;font-weight:700;font-size:12px">Day 4 / 90</span>
                    </div>
                    <div style="height:6px;border-radius:3px;background:#E2E8F0;margin-bottom:10px">
                      <div style="width:5%;height:100%;background:#10B981"></div>
                    </div>
                    <div style="font-size:11.5px;color:#64748B">Next automated bump: Wednesday 18:00 UTC</div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c33",
      "n": 33,
      "name": "Unified Binary Download Center",
      "group": "status",
      "tagline": "Centralized download table for notarized Mac DMGs, Android APKs, and checksum hashes",
      "concept": "Consolidates desktop and mobile release binaries in one clean table. Visitors can download notarized macOS `.dmg` installers for Waypack, Voxbrief, Meowtrix, and FeedbackKit without digging through raw GitHub Releases tabs.",
      "moves": [
            "Unified table of desktop and mobile installers: App, Version, Platform, File Size, SHA-256",
            "Apple Notarization verification badge: 'Notarized & Stapled by Apple'",
            "One-click copy button for SHA-256 verification hash",
            "Direct link to release notes and changelog"
      ],
      "palette": [
            [
                  "Download Blue",
                  "#2F5BEA"
            ],
            [
                  "Notarized Green",
                  "#059669"
            ],
            [
                  "Hash Slate",
                  "#64748B"
            ]
      ],
      "facts": {
            "Type": "Binary Distribution",
            "Effort": "S",
            "Needs": "Parse releases API in pages_sync.mjs"
      },
      "spec": {
            "today": [
                  "Mac DMGs are attached to GitHub releases but not surfaced in a unified download table"
            ],
            "proposed": [
                  "Centralized Mac DMG and Android APK download center with checksum hashes"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/components/DownloadCenter.vue"
            ],
            "risks": [
                  "Ensure download links point to stable rolling release URLs"
            ],
            "verify": [
                  "Clicking download link downloads notarized Waypack.dmg installer"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Desktop &amp; Mobile Binary Downloads</h2></div>
                <div style="border-radius:12px;border:1px solid #CBD5E1;overflow:hidden;background:${dark ? "#151922" : "#fff"}">
                  <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                    <thead>
                      <tr style="background:${dark ? "#1E293B" : "#F8FAFC"};border-bottom:1px solid #CBD5E1;color:#64748B">
                        <th style="padding:10px 14px">APPLICATION</th>
                        <th style="padding:10px 14px">PLATFORM</th>
                        <th style="padding:10px 14px">VERSION</th>
                        <th style="padding:10px 14px">SECURITY</th>
                        <th style="padding:10px 14px">DOWNLOAD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:12px 14px;font-weight:700">Waypack.dmg</td>
                        <td style="padding:12px 14px">macOS (Universal)</td>
                        <td style="padding:12px 14px;font-family:monospace">v1.4.2</td>
                        <td style="padding:12px 14px"><span style="color:#059669;font-weight:600">✓ Apple Notarized</span></td>
                        <td style="padding:12px 14px"><a class="h-btn-pri" href="#">Download (42MB)</a></td>
                      </tr>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:12px 14px;font-weight:700">Meowtrix.dmg</td>
                        <td style="padding:12px 14px">macOS (Apple Silicon)</td>
                        <td style="padding:12px 14px;font-family:monospace">v1.35.0</td>
                        <td style="padding:12px 14px"><span style="color:#059669;font-weight:600">✓ Apple Notarized</span></td>
                        <td style="padding:12px 14px"><a class="h-btn-pri" href="#">Download (18MB)</a></td>
                      </tr>
                      <tr>
                        <td style="padding:12px 14px;font-weight:700">Voxbrief.dmg</td>
                        <td style="padding:12px 14px">macOS (Universal)</td>
                        <td style="padding:12px 14px;font-family:monospace">v1.2.0</td>
                        <td style="padding:12px 14px"><span style="color:#059669;font-weight:600">✓ Apple Notarized</span></td>
                        <td style="padding:12px 14px"><a class="h-btn-pri" href="#">Download (34MB)</a></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c34",
      "n": 34,
      "name": "Cloudflare Edge Latency Monitor",
      "group": "status",
      "tagline": "World map latency monitor tracking Cloudflare Worker edge response times across continents",
      "concept": "Demonstrates the global speed of HEJI's serverless edge. Cloudflare Workers serve Waypack, Wee Hours, and Contempo APIs with sub-25ms latency. An interactive world map pinpoints edge colocation response times.",
      "moves": [
            "Interactive mini world map with edge points (SFO, LHR, HND, FRA, SYD)",
            "Real-time ping latency badge: 'Average Global Edge Latency: 18ms'",
            "Worker route health checks (`waypack.hejitech.workers.dev/health`)",
            "Zero server downtime guarantee indicator"
      ],
      "palette": [
            [
                  "Cloudflare Orange",
                  "#F38020"
            ],
            [
                  "Edge Green",
                  "#10B981"
            ],
            [
                  "Map Dark",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Global Edge Telemetry",
            "Effort": "M",
            "Needs": "Worker ping endpoint"
      },
      "spec": {
            "today": [
                  "No edge latency or Worker performance telemetry displayed on the site"
            ],
            "proposed": [
                  "Global edge latency visualizer showing real-time Worker response times"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/components/EdgeLatency.vue"
            ],
            "risks": [
                  "Avoid client-side CORS issues by pinging designated public health route"
            ],
            "verify": [
                  "Edge monitor reports active Cloudflare Worker latency <30ms"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Cloudflare Worker Edge Latency</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-size:12px;font-weight:700;color:#F38020;text-transform:uppercase">CLOUDFLARE WORKERS EDGE</div>
                    <div style="font-size:26px;font-weight:800;color:#10B981;margin:4px 0">18ms <span style="font-size:14px;font-weight:600;color:#64748B">avg worldwide</span></div>
                    <div style="font-size:12px;color:#64748B">300+ Edge Colocations · Zero Cold Starts · 100% Uptime</div>
                  </div>
                  <div style="display:flex;gap:12px;font-family:monospace;font-size:12px">
                    <span style="padding:6px 10px;border-radius:6px;background:${dark ? "#1E293B" : "#F1F5F9"}">SFO: 12ms</span>
                    <span style="padding:6px 10px;border-radius:6px;background:${dark ? "#1E293B" : "#F1F5F9"}">LHR: 19ms</span>
                    <span style="padding:6px 10px;border-radius:6px;background:${dark ? "#1E293B" : "#F1F5F9"}">HND: 24ms</span>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c35",
      "n": 35,
      "name": "Automated Incident & Maintenance Banner",
      "group": "status",
      "tagline": "Site-wide dismissible alert banner driven by GitHub issues or status file for maintenance",
      "concept": "Enables proactive transparent communication during maintenance windows. When scheduled database migrations or Apple Developer portal outages occur, an alert banner automatically renders at the top of every documentation page.",
      "moves": [
            "Dismissible notification ribbon anchored at the very top of all pages",
            "Automatic color coding: Blue (Info/Notice), Amber (Degraded Performance), Red (Outage)",
            "Reads incident state directly from GitHub issue labeled `maintenance` or status file",
            "Remembers dismissal per session in sessionStorage"
      ],
      "palette": [
            [
                  "Notice Amber",
                  "#FFFBEB"
            ],
            [
                  "Notice Border",
                  "#FCD34D"
            ],
            [
                  "Notice Text",
                  "#92400E"
            ]
      ],
      "facts": {
            "Type": "Incident Communication",
            "Effort": "S",
            "Needs": "Banner component in theme Layout"
      },
      "spec": {
            "today": [
                  "No mechanism to communicate planned maintenance across documentation pages"
            ],
            "proposed": [
                  "Top-level alert banner dynamically populated during scheduled maintenance"
            ],
            "files": [
                  "pages/.vitepress/theme/Layout.vue",
                  "pages/.vitepress/theme/components/AlertBanner.vue"
            ],
            "risks": [
                  "Banner must be easily dismissible to prevent annoying repeated visitors"
            ],
            "verify": [
                  "Triggering maintenance flag displays notice banner above top navbar"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <!-- Incident Maintenance Banner -->
              <div style="background:#FEF3C7;color:#92400E;padding:8px 24px;font-size:12.5px;font-weight:600;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #FCD34D">
                <span>⚠️ <b>Scheduled Maintenance:</b> Shared Supabase database migration scheduled for Wednesday 02:00 UTC. Offline app functions unaffected.</span>
                <span style="cursor:pointer;padding:2px 8px">✕ Dismiss</span>
              </div>
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>System Status</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c36",
      "n": 36,
      "name": "Supabase Migration & Schema Isolation Timeline",
      "group": "status",
      "tagline": "Visual timeline of monorepo database migrations, schema namespaces, and graduation checks",
      "concept": "Grounded in `supabase/migrations/` and `scripts/graduation_check.sh`. Renders an interactive historical timeline of applied database migrations, proving that every project's tables remain strictly isolated in their own schema namespace.",
      "moves": [
            "Vertical migration stepper showing migration timestamps and descriptions",
            "Tags showing target schema: `waypack.*`, `weehours.*`, `contempo.*`",
            "Verification badge: 'Isolation Verified by check_isolation.mjs'",
            "Clicking migration displays the raw SQL migration snippet"
      ],
      "palette": [
            [
                  "Migration Green",
                  "#10B981"
            ],
            [
                  "Line Gray",
                  "#CBD5E1"
            ],
            [
                  "Code Bg",
                  "#0D1117"
            ]
      ],
      "facts": {
            "Type": "Database Architecture Timeline",
            "Effort": "S",
            "Needs": "Parse migrations dir at build"
      },
      "spec": {
            "today": [
                  "Migrations only exist in supabase/migrations/ on the git filesystem"
            ],
            "proposed": [
                  "Visual migration timeline on status page showing recent schema changes"
            ],
            "files": [
                  "pages/status.md",
                  "pages/status.data.ts",
                  "scripts/pages_sync.mjs"
            ],
            "risks": [
                  "Do not expose sensitive seed data or secret variables in public SQL logs"
            ],
            "verify": [
                  "Timeline displays recent migrations (e.g. 20261019_weehours_multiple_children.sql)"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Database Schema Migrations &amp; Isolation</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;gap:16px;padding-bottom:16px;border-bottom:1px solid #E2E8F0">
                    <span style="width:10px;height:10px;border-radius:50%;background:#10B981;margin-top:4px"></span>
                    <div>
                      <div style="font-weight:700;font-size:13.5px">20261019_weehours_multiple_children.sql</div>
                      <div style="font-size:12px;color:#64748B">Applied 1d ago · Schema: weehours.* · Zero foreign keys to other schemas</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #E2E8F0">
                    <span style="width:10px;height:10px;border-radius:50%;background:#10B981;margin-top:4px"></span>
                    <div>
                      <div style="font-weight:700;font-size:13.5px">20261017_contempo_init.sql</div>
                      <div style="font-size:12px;color:#64748B">Applied 3d ago · Schema: contempo.* · Isolated tables created</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:16px;padding-top:16px">
                    <span style="width:10px;height:10px;border-radius:50%;background:#10B981;margin-top:4px"></span>
                    <div>
                      <div style="font-weight:700;font-size:13.5px">20261016_waypack_move_to_schema.sql</div>
                      <div style="font-size:12px;color:#64748B">Applied 4d ago · Schema: waypack.* · Graduated to dedicated schema namespace</div>
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c37",
      "n": 37,
      "name": "Monorepo Commit Activity Heatmap",
      "group": "status",
      "tagline": "GitHub-style weekly commit activity graph across all 8 monorepo project directories",
      "concept": "Visualizes shipping momentum. Displays a clean SVG contribution heatmap representing commit volume across `projects/*/` over the past 52 weeks, demonstrating active daily engineering and automated agent maintenance.",
      "moves": [
            "52-column contribution heatmap rendered with brand emerald greens",
            "Tooltip showing exact commit count and date on hover",
            "Project breakdown legend: Waypack (42%), Wee Hours (28%), Voxbrief (14%)",
            "Highlights autonomous agent commits vs human commits"
      ],
      "palette": [
            [
                  "Heatmap 0",
                  "#EBEDF0"
            ],
            [
                  "Heatmap 2",
                  "#40C463"
            ],
            [
                  "Heatmap 4",
                  "#216E39"
            ]
      ],
      "facts": {
            "Type": "Momentum Visualization",
            "Effort": "S",
            "Needs": "Git commit log extractor script"
      },
      "spec": {
            "today": [
                  "No commit activity or shipping frequency visualization on the site"
            ],
            "proposed": [
                  "52-week SVG commit activity heatmap embedded on status page"
            ],
            "files": [
                  "pages/status.md",
                  "pages/status.data.ts",
                  "pages/.vitepress/theme/components/CommitHeatmap.vue"
            ],
            "risks": [
                  "Generate heatmap SVG at build time to avoid client-side git log parsing"
            ],
            "verify": [
                  "Heatmap displays daily commit squares matching git log history"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Shipping Momentum (52-Week Commit Activity)</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="font-size:12px;color:#64748B;margin-bottom:12px">1,428 commits in the last year across 8 projects</div>
                  <div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:8px">
                    ${Array.from({ length: 40 }).map((_, i) => `
                      <div style="display:flex;flex-direction:column;gap:3px">
                        <span style="width:10px;height:10px;border-radius:2px;background:${i % 3 === 0 ? "#10B981" : i % 5 === 0 ? "#34D399" : dark ? "#232B3B" : "#E2E8F0"}"></span>
                        <span style="width:10px;height:10px;border-radius:2px;background:${i % 2 === 0 ? "#10B981" : dark ? "#232B3B" : "#E2E8F0"}"></span>
                        <span style="width:10px;height:10px;border-radius:2px;background:${i % 4 === 0 ? "#059669" : dark ? "#232B3B" : "#E2E8F0"}"></span>
                        <span style="width:10px;height:10px;border-radius:2px;background:${dark ? "#232B3B" : "#E2E8F0"}"></span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c38",
      "n": 38,
      "name": "Build Failure Diagnosis Drawer",
      "group": "status",
      "tagline": "One-click expandable drawer showing exact step failures and links to GitHub Actions logs",
      "concept": "Transforms a red status badge into an actionable debugging tool. If any CI workflow fails (e.g. `supabase-ci.yml`), clicking the red badge unfolds an inline drawer showing the failed step name, terminal error snippet, and recommended fix.",
      "moves": [
            "Failing workflow badges feature an expandable 'Diagnosis' trigger",
            "Inline terminal excerpt highlighting the exact exit code and error line",
            "Recommended resolution hint (e.g. 'Run scripts/check_isolation.mjs locally')",
            "Direct link to the specific failing step on GitHub Actions"
      ],
      "palette": [
            [
                  "Fail Red",
                  "#EF4444"
            ],
            [
                  "Terminal Dark",
                  "#0D1117"
            ],
            [
                  "Hint Slate",
                  "#94A3B8"
            ]
      ],
      "facts": {
            "Type": "Developer Diagnostics",
            "Effort": "S",
            "Needs": "GitHub Actions API run logs fetch"
      },
      "spec": {
            "today": [
                  "Failing workflows only display a static red dot with no diagnostic context"
            ],
            "proposed": [
                  "Expandable failure diagnosis drawer highlighting error step and fix command"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/StatusBoard.vue"
            ],
            "risks": [
                  "Keep error logs concise to prevent visual overload on status page"
            ],
            "verify": [
                  "Clicking diagnosis drawer reveals exact step failure and recommended script"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>CI Failure Diagnostics (Live Drawer Demo)</h2></div>
                <div style="border-radius:14px;border:1px solid #FCA5A5;background:#FEF2F2;overflow:hidden">
                  <div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
                    <div style="display:flex;align-items:center;gap:12px">
                      <span style="width:10px;height:10px;border-radius:50%;background:#EF4444"></span>
                      <div><b>supabase-ci.yml</b> — check_isolation.mjs failed on branch test-ref</div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#DC2626">▾ Failure Details</span>
                  </div>
                  <div style="padding:16px 20px;background:#0D1117;color:#F87171;font-family:monospace;font-size:12px;line-height:1.5">
                    <div>Error: Cross-schema reference detected in migration 20261020_test.sql</div>
                    <div>Foreign key references table in schema 'waypack' from schema 'weehours'</div>
                    <div style="color:#34D399;margin-top:6px">Fix: Products talk through public APIs, never the database. See supabase/GRADUATION.md.</div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c39",
      "n": 39,
      "name": "Subscriber RSS / Atom / JSON Feeds",
      "group": "status",
      "tagline": "Standard RSS, Atom, and JSON feeds for app releases, architectural decisions, and status",
      "concept": "Empowers developers who follow software via feed readers. Generates automated RSS, Atom, and JSON feeds for new app versions and architecture decision records (`docs/decisions.md`), keeping the community updated without social media.",
      "moves": [
            "Feed icon and links in top nav and status page footer: RSS, Atom, JSON Feed",
            "Auto-generated at build time from release lines and documentation commits",
            "Full changelog Markdown embedded in feed entries",
            "Copy feed URL button with one click"
      ],
      "palette": [
            [
                  "RSS Orange",
                  "#F97316"
            ],
            [
                  "Feed Slate",
                  "#0F172A"
            ],
            [
                  "Button Tint",
                  "#EEF2FF"
            ]
      ],
      "facts": {
            "Type": "Syndication & Feeds",
            "Effort": "S",
            "Needs": "VitePress feed plugin / custom generator"
      },
      "spec": {
            "today": [
                  "No RSS or Atom feed exists for releases or documentation updates"
            ],
            "proposed": [
                  "Build-time RSS/Atom feed generation at pages/feed.rss and pages/feed.json"
            ],
            "files": [
                  "pages/.vitepress/config.mts",
                  "scripts/pages_sync.mjs"
            ],
            "risks": [
                  "Validate feed XML output with W3C feed validator"
            ],
            "verify": [
                  "Subscribing in NetNewsWire or Reeder parses releases correctly"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Syndication &amp; RSS Feeds</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;display:flex;align-items:center;justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:16px">
                    <div style="width:48px;height:48px;border-radius:12px;background:#FFF7ED;color:#EA580C;display:grid;place-items:center;font-size:22px">📡</div>
                    <div>
                      <b style="font-size:16px">Subscribe to HEJI App Releases</b>
                      <div style="font-size:13px;color:#64748B">Receive changelogs in your favorite feed reader the moment releases ship.</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px">
                    <button class="h-btn-pri" style="background:#EA580C;border:0">Copy RSS Feed URL</button>
                    <button class="h-btn-sec">JSON Feed</button>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c40",
      "n": 40,
      "name": "Mac DMG Checksum & Notarization Verifier",
      "group": "status",
      "tagline": "Interactive in-browser tool to drop a downloaded .dmg and verify its SHA-256 and signature",
      "concept": "Gives security-conscious Mac users complete peace of mind. Visitors can drag and drop their downloaded `Waypack.dmg` or `Meowtrix.dmg` onto an in-browser dropzone; Web Crypto API calculates the SHA-256 hash client-side and validates it against the official release manifest.",
      "moves": [
            "Client-side drag-and-drop file verification box",
            "Instant SHA-256 computation using native browser Web Crypto API (0 bytes uploaded)",
            "Green match indicator: '\u2713 SHA-256 Hash Matches Official GitHub Release'",
            "Displays Apple Developer ID team certificate name: `HEJI Technology LLC`"
      ],
      "palette": [
            [
                  "Verify Green",
                  "#10B981"
            ],
            [
                  "Drop Slate",
                  "#F8FAFC"
            ],
            [
                  "Border Dash",
                  "#94A3B8"
            ]
      ],
      "facts": {
            "Type": "Security & Cryptographic Verification",
            "Effort": "S",
            "Needs": "Web Crypto crypto.subtle.digest"
      },
      "spec": {
            "today": [
                  "Users must manually run `shasum -a 256` in terminal to verify downloads"
            ],
            "proposed": [
                  "Browser-based drag-and-drop checksum verifier on the downloads page"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/components/ChecksumVerifier.vue"
            ],
            "risks": [
                  "File bytes stay 100% on device; no upload occurs"
            ],
            "verify": [
                  "Dropping downloaded DMG verifies SHA-256 hash in <1 second"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Mac Installer Checksum Verifier</h2></div>
                <div style="padding:28px;border-radius:16px;border:2px dashed #3B82F6;background:${dark ? "#151922" : "#EFF6FF"};text-align:center">
                  <div style="font-size:32px;margin-bottom:8px">🛡️</div>
                  <h4 style="margin:0 0 6px;font-size:16px">Verify Downloaded .dmg Integrity</h4>
                  <p style="margin:0 0 16px;font-size:13px;color:#64748B">Drop your installer file here. Calculated 100% client-side with Web Crypto API.</p>
                  <div style="display:inline-block;padding:8px 16px;border-radius:8px;background:#10B981;color:#fff;font-size:12.5px;font-weight:700">
                    ✓ Verified: Waypack.dmg matches release commit 7c2a8f1
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c41",
      "n": 41,
      "name": "Floating Reading Progress & Sticky Scroll Spy",
      "group": "docs",
      "tagline": "Dynamic reading progress bar with smooth sticky table of contents scroll spy",
      "concept": "Enhances reading ergonomics for long technical documents like `pages/waypack/design.md`. Adds a slim reading progress indicator line at the top of the browser and highlights the active heading smoothly in the right-hand outline as the user scrolls.",
      "moves": [
            "Thin 2px brand-colored reading progress bar pinned directly below top navigation",
            "Smooth scroll spy highlighting current heading in the right-hand TOC",
            "Displays remaining estimated reading time (e.g. '3 min left')",
            "Clean back-to-top button appears automatically after scrolling 500px"
      ],
      "palette": [
            [
                  "Progress Bar",
                  "#2F5BEA"
            ],
            [
                  "Active TOC",
                  "#2F5BEA"
            ],
            [
                  "Border Light",
                  "#E2E8F0"
            ]
      ],
      "facts": {
            "Type": "Reading Ergonomics",
            "Effort": "S",
            "Needs": "Scroll listener in VitePress layout"
      },
      "spec": {
            "today": [
                  "No reading progress bar; right aside TOC is static and lacks progress cues"
            ],
            "proposed": [
                  "Floating reading progress bar and active section highlight scroll spy"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/theme/Layout.vue"
            ],
            "risks": [
                  "Ensure smooth 60fps performance using passive scroll event listeners"
            ],
            "verify": [
                  "Scrolling document smoothly fills reading bar from 0% to 100%"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <!-- Reading progress bar -->
              <div style="height:3px;background:#2F5BEA;width:45%;position:sticky;top:0;z-index:90"></div>
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <div style="font-size:12px;font-weight:700;color:#2F5BEA;text-transform:uppercase">WAYPACK / ARCHITECTURE</div>
                  <h1 style="font-size:32px;margin:8px 0 16px">Offline Bundle Specification</h1>
                  <p style="font-size:15px;line-height:1.7;color:#475569">Waypack stores trip itineraries as self-contained bundles. A bundle is an archive containing vector tile extracts, GeoJSON itinerary layers, place metadata, and offline trip notes.</p>
                  <h2 style="font-size:22px;margin:28px 0 12px">Bundle Packaging Format</h2>
                  <p style="font-size:15px;line-height:1.7;color:#475569">Bundles utilize SQLite databases with MBTiles vector tile layers. When traveling through mountain passes without cell signal, the app reads directly from local storage with zero network requests.</p>
                </div>
                <div class="c41-toc">
                  <div style="font-weight:700;margin-bottom:8px">ON THIS PAGE</div>
                  <div class="c41-toc-link">Overview</div>
                  <div class="c41-toc-link active" style="margin:6px 0">• Bundle Packaging Format</div>
                  <div class="c41-toc-link">Offline Vector Tiles</div>
                  <div class="c41-toc-link" style="margin-top:6px">Verification &amp; Integrity</div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c42",
      "n": 42,
      "name": "Multi-Package Manager Code Tabs",
      "group": "docs",
      "tagline": "Code snippets with tabs for npm, pnpm, bun, brew, and git with 1-click copy",
      "concept": "Modernizes CLI and library documentation. Code blocks feature selectable tabs for `npm`, `pnpm`, `bun`, `brew`, and `curl`, remembering the developer's favorite package manager across the entire site.",
      "moves": [
            "Tab bar on code snippets: [npm] [pnpm] [bun] [brew] [curl]",
            "Selecting 'pnpm' once switches all code blocks across the site to pnpm",
            "Copy button provides instant checkmark feedback and toast notification",
            "Syntax highlighting tuned for both light and dark themes"
      ],
      "palette": [
            [
                  "Code Slate",
                  "#0D1117"
            ],
            [
                  "Tab Active",
                  "#1F6FEB"
            ],
            [
                  "Copy Green",
                  "#10B981"
            ]
      ],
      "facts": {
            "Type": "Developer Documentation Ergonomics",
            "Effort": "S",
            "Needs": "VitePress code-group enhancement"
      },
      "spec": {
            "today": [
                  "Code snippets only display single fixed npm or bash commands"
            ],
            "proposed": [
                  "Synchronized multi-package manager code tabs across all docs"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/config.mts"
            ],
            "risks": [
                  "Persist selected package manager in localStorage cleanly"
            ],
            "verify": [
                  "Switching to 'bun' updates all terminal code blocks to bun install"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div style="max-width:720px">
                  <h1 style="font-size:28px;margin:0 0 16px">FeedbackKit CLI Installation</h1>
                  <p style="font-size:14px;color:#64748B;margin-bottom:18px">Install the FeedbackKit developer CLI to triage bug reports and run coding agents locally.</p>
                  <div style="border-radius:12px;overflow:hidden;border:1px solid #30363D;background:#0D1117">
                    <div style="display:flex;align-items:center;justify-content:space-between;background:#161B22;padding:6px 14px;border-bottom:1px solid #30363D">
                      <div style="display:flex;gap:6px">
                        <span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:#1F6FEB;color:#fff">npm</span>
                        <span style="padding:4px 10px;border-radius:6px;font-size:12px;color:#8B949E;cursor:pointer">pnpm</span>
                        <span style="padding:4px 10px;border-radius:6px;font-size:12px;color:#8B949E;cursor:pointer">bun</span>
                        <span style="padding:4px 10px;border-radius:6px;font-size:12px;color:#8B949E;cursor:pointer">brew</span>
                      </div>
                      <span style="color:#8B949E;font-size:12px;cursor:pointer">Copy 📋</span>
                    </div>
                    <div style="padding:16px;color:#C9D1D9;font-family:monospace;font-size:13px">
                      <span style="color:#79C0FF">npm</span> install -g feedbackkit-cli
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c43",
      "n": 43,
      "name": "Mermaid Diagram Fullscreen Zoom & Pan Modal",
      "group": "docs",
      "tagline": "Clickable fullscreen zoom with SVG pan/pinch for complex architecture diagrams",
      "concept": "Solves clipped architecture diagrams. The monorepo uses Mermaid diagrams for database schemas and data flows. Complex charts can feel cramped; clicking any diagram pops open a clean fullscreen pan/zoom lightbox with SVG export.",
      "moves": [
            "Magnifying glass zoom icon on hover over any Mermaid diagram",
            "Smooth fullscreen lightbox modal with pan, drag, and mouse wheel zoom",
            "'Export as SVG' and 'Copy Mermaid Source' buttons in modal toolbar",
            "Crisp vector rendering at any scale"
      ],
      "palette": [
            [
                  "Modal Dark",
                  "rgba(15,23,42,0.85)"
            ],
            [
                  "Icon Slate",
                  "#94A3B8"
            ],
            [
                  "Diagram Bg",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Diagram UX",
            "Effort": "S",
            "Needs": "Lightbox modal on .mermaid elements"
      },
      "spec": {
            "today": [
                  "Mermaid diagrams render inline at fixed width with horizontal scroll on small screens"
            ],
            "proposed": [
                  "Click-to-zoom modal with pan/pinch navigation for all Mermaid diagrams"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/theme/components/MermaidZoom.vue"
            ],
            "risks": [
                  "Ensure touch pinch gestures work naturally on mobile"
            ],
            "verify": [
                  "Clicking architecture diagram opens modal and enables mouse dragging"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <h1 style="font-size:28px;margin:0 0 16px">Monorepo Isolation Architecture</h1>
                  <p style="font-size:14px;color:#64748B;margin-bottom:16px">How 8 applications share a single Supabase project without coupling database tables.</p>
                  <div style="border-radius:14px;padding:24px;background:${dark ? "#151922" : "#fff"};border:2px solid #2F5BEA;position:relative">
                    <div style="position:absolute;top:12px;right:12px;padding:4px 10px;border-radius:6px;background:#2F5BEA;color:#fff;font-size:11px;font-weight:700">🔍 Click to Zoom / Pan</div>
                    <div style="text-align:center;padding:20px;font-family:monospace;font-size:13px;color:#2F5BEA">
                      [Supabase Shared Project]<br>
                      ↓ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ↓<br>
                      [waypack.*] &nbsp; &nbsp; &nbsp; [weehours.*]
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c44",
      "n": 44,
      "name": "Collapsible 'Under the Hood' Deep-Dive Blocks",
      "group": "docs",
      "tagline": "Clean expandable accordion drawers for advanced technical implementation details",
      "concept": "Preserves clean reading flow while providing deep technical nuance. High-level architectural explanations remain scannable, while deep details (e.g. CoreML quantization flags, SQLite PRAGMAs) sit inside elegant expandable accordions.",
      "moves": [
            "Styled `<details>` / `<summary>` disclosure blocks with subtle left border accent",
            "Badge tag: 'UNDER THE HOOD: C++ / Swift Bridge Details'",
            "Smooth expand animation with chevron rotation",
            "Search indexes words inside collapsed blocks automatically"
      ],
      "palette": [
            [
                  "Accent Border",
                  "#3B82F6"
            ],
            [
                  "Block Bg",
                  "#F8FAFC"
            ],
            [
                  "Text Slate",
                  "#475569"
            ]
      ],
      "facts": {
            "Type": "Progressive Disclosure",
            "Effort": "S",
            "Needs": "CSS details styling in custom.css"
      },
      "spec": {
            "today": [
                  "All technical details dumped in monolithic paragraphs without visual separation"
            ],
            "proposed": [
                  "Collapsible 'Under the Hood' blocks for deep code and architecture dives"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/waypack/design.md"
            ],
            "risks": [
                  "Ensure collapsed content remains accessible via browser Cmd+F search"
            ],
            "verify": [
                  "Clicking summary rotates chevron and reveals CoreML quantization spec"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <h1 style="font-size:28px;margin:0 0 16px">Voxbrief: On-Device Audio Pipeline</h1>
                  <p style="font-size:14px;color:#475569;margin-bottom:18px">Whisper converts raw audio into text; Qwen3 formats the transcript into clean Markdown on the device.</p>
                  <div style="border-radius:12px;border:1px solid #CBD5E1;background:${dark ? "#151922" : "#F8FAFC"};padding:14px 18px">
                    <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#2F5BEA;font-size:13px;cursor:pointer">
                      <span>▾ UNDER THE HOOD: CoreML Quantization &amp; Memory Budget</span>
                    </div>
                    <div style="margin-top:10px;font-size:13px;line-height:1.6;color:#64748B">
                      Whisper base is quantized to 8-bit weights (int8), consuming 74MB of RAM. Peak memory footprint on Apple Watch Series 9 remains under 120MB, preventing watchOS jetsam terminations.
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c45",
      "n": 45,
      "name": "Paragraph-Level GitHub Edit & Feedback Trigger",
      "group": "docs",
      "tagline": "Hover icon next to every heading/paragraph to 'Edit on GitHub' or 'Report doc bug'",
      "concept": "Turns readers into active documentation contributors. Hovering any section reveals a subtle pencil icon to propose a direct pull request on GitHub, and a message bubble icon to file an instant FeedbackKit issue pinned to that exact heading.",
      "moves": [
            "Pencil icon next to headings linking directly to `github.com/.../edit/main/pages/...`",
            "FeedbackKit comment pin button on every paragraph",
            "Pre-fills FeedbackKit screen metadata with exact document heading path",
            "Zero clutter: icons only appear on paragraph hover"
      ],
      "palette": [
            [
                  "Hover Icon",
                  "#94A3B8"
            ],
            [
                  "Edit Blue",
                  "#2F5BEA"
            ],
            [
                  "Feedback Purple",
                  "#6D5BD0"
            ]
      ],
      "facts": {
            "Type": "Community Feedback Loop",
            "Effort": "S",
            "Needs": "Markdown heading anchor wrapper"
      },
      "spec": {
            "today": [
                  "Single generic 'Edit this page on GitHub' link at very bottom of document"
            ],
            "proposed": [
                  "Inline hover triggers next to every heading for GitHub edits and FeedbackKit pins"
            ],
            "files": [
                  "pages/.vitepress/theme/Layout.vue",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Avoid interfering with copy-paste selection of heading text"
            ],
            "verify": [
                  "Hovering heading shows pencil icon linking to exact file line on GitHub"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <h1 style="font-size:28px;margin:0">Database Schema Graduation</h1>
                    <span style="font-size:12px;color:#2F5BEA;background:#EEF2FF;padding:3px 8px;border-radius:6px;cursor:pointer">✏️ Edit on GitHub</span>
                    <span style="font-size:12px;color:#6D5BD0;background:#F5F3FF;padding:3px 8px;border-radius:6px;cursor:pointer">💬 Report Bug</span>
                  </div>
                  <p style="font-size:14px;color:#475569;margin-top:14px;line-height:1.6">When a project's revenue pays for its own infrastructure, it graduates from the shared Supabase project onto its own dedicated database.</p>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c46",
      "n": 46,
      "name": "Document Metadata Header (Reading Time & Level)",
      "group": "docs",
      "tagline": "Top meta ribbon displaying reading time (4 min read), target audience, and updated date",
      "concept": "Sets reader expectations immediately. At the top of each guide or specification, a clean metadata strip indicates reading duration (e.g. `\u23f1\ufe0f 5 min read`), target skill level (`Intermediate / Mobile Dev`), and last verified commit date.",
      "moves": [
            "Horizontal metadata bar positioned immediately below document title",
            "Reading time calculated dynamically from markdown word count",
            "Skill badge tags: 'Architecture', 'Swift / Kotlin', 'Supabase SQL'",
            "Last verified date and commit SHA hash"
      ],
      "palette": [
            [
                  "Meta Slate",
                  "#64748B"
            ],
            [
                  "Badge Tint",
                  "#F1F5F9"
            ],
            [
                  "Clock Blue",
                  "#2F5BEA"
            ]
      ],
      "facts": {
            "Type": "Metadata & Orientation",
            "Effort": "S",
            "Needs": "Frontmatter parser helper"
      },
      "spec": {
            "today": [
                  "Documents jump straight from title to prose with zero duration or skill metadata"
            ],
            "proposed": [
                  "Document metadata header indicating estimated reading time and prerequisites"
            ],
            "files": [
                  "pages/.vitepress/theme/components/DocMeta.vue",
                  "pages/.vitepress/theme/Layout.vue"
            ],
            "risks": [
                  "Keep calculation lightweight during VitePress build"
            ],
            "verify": [
                  "Opening pages/waypack/design.md displays '4 min read \u00b7 Systems Architecture'"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <h1 style="font-size:32px;margin:0 0 10px">Offline Vector Maps in Flutter</h1>
                  <div style="display:flex;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #CBD5E1;margin-bottom:18px;font-size:12.5px;color:#64748B">
                    <span>⏱️ <b>4 min read</b></span>
                    <span>🎯 <b>Level:</b> Mobile &amp; Systems</span>
                    <span>📅 <b>Updated:</b> Oct 19, 2026</span>
                    <span>🔖 <b>Commit:</b> <code style="font-family:monospace">7c2a8f1</code></span>
                  </div>
                  <p style="font-size:14.5px;line-height:1.7;color:#475569">Waypack embeds an offline vector map renderer using MapLibre GL Native on iOS and Android.</p>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c47",
      "n": 47,
      "name": "Hierarchical Breadcrumbs with App Icons",
      "group": "docs",
      "tagline": "Rich breadcrumbs (HEJI Apps > Waypack > Offline Bundles) with dropdown quick switcher",
      "concept": "Prevents reader disorientation in deep monorepo guides. A structured breadcrumb trail at the top of each page displays the app icon, parent project, and current chapter, with dropdown menus allowing quick switching to sibling chapters.",
      "moves": [
            "Hierarchical breadcrumb trail: `HEJI Apps > Waypack > Specifications > Offline Bundles`",
            "App icon embedded directly in the breadcrumb root",
            "Dropdown arrow on parent segment allowing instant jump to sibling docs",
            "Valid Schema.org BreadcrumbList JSON-LD for rich Google search results"
      ],
      "palette": [
            [
                  "Crumb Slate",
                  "#64748B"
            ],
            [
                  "Crumb Active",
                  "#0F172A"
            ],
            [
                  "Divider Slash",
                  "#CBD5E1"
            ]
      ],
      "facts": {
            "Type": "Navigation & SEO Breadcrumbs",
            "Effort": "S",
            "Needs": "Breadcrumb component in theme"
      },
      "spec": {
            "today": [
                  "No breadcrumb navigation exists on documentation pages"
            ],
            "proposed": [
                  "Hierarchical breadcrumbs with embedded app icons and sibling dropdown menus"
            ],
            "files": [
                  "pages/.vitepress/theme/components/Breadcrumbs.vue",
                  "pages/.vitepress/theme/Layout.vue"
            ],
            "risks": [
                  "Ensure breadcrumbs wrap gracefully on narrow smartphone screens"
            ],
            "verify": [
                  "Breadcrumb trail reflects current URL path and provides working parent links"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:#64748B;margin-bottom:14px">
                    <span style="color:#2F5BEA;font-weight:600">HEJI Apps</span>
                    <span>/</span>
                    <span style="display:inline-flex;align-items:center;gap:4px;color:#2F5BEA;font-weight:600">
                      <span style="width:14px;height:14px;border-radius:3px;background:#1D6FE0;display:inline-block"></span>
                      Waypack
                    </span>
                    <span>/</span>
                    <span style="color:#0F172A;font-weight:700">Offline Bundle Specification</span>
                  </div>
                  <h1 style="font-size:30px;margin:0 0 14px">Offline Bundle Specification</h1>
                  <p style="font-size:14.5px;line-height:1.7;color:#475569">The technical specification for the .waypackbundle archive format.</p>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c48",
      "n": 48,
      "name": "Vim & Reader Keyboard Navigation Shortcuts",
      "group": "docs",
      "tagline": "Vim-style j/k or [/] shortcuts to jump between doc sections, and 't' to toggle TOC",
      "concept": "Delights power users and developers. Readers can navigate long documents without leaving their home row: pressing `j` scrolls smoothly to the next heading, `k` scrolls up, `[`/`]` moves to previous/next chapters, and `t` toggles the outline drawer.",
      "moves": [
            "Keyboard shortcut listeners for `j` / `k` (next/prev heading)",
            "`[` / `]` shortcuts to navigate previous/next documentation page",
            "`t` shortcut to focus or toggle the table of contents sidebar",
            "Tooltip badge in footer: 'Keyboard Shortcuts: j / k for sections'"
      ],
      "palette": [
            [
                  "Key Bg",
                  "#F1F5F9"
            ],
            [
                  "Key Border",
                  "#CBD5E1"
            ],
            [
                  "Shortcut Blue",
                  "#2F5BEA"
            ]
      ],
      "facts": {
            "Type": "Keyboard Accessibility & Flow",
            "Effort": "S",
            "Needs": "Global keydown event listener"
      },
      "spec": {
            "today": [
                  "Documentation only navigable via mouse scrolling or clicking sidebar links"
            ],
            "proposed": [
                  "Vim/reader keyboard shortcuts enabling rapid hands-on-keyboard reading"
            ],
            "files": [
                  "pages/.vitepress/theme/index.ts",
                  "pages/.vitepress/theme/components/KeyboardHelper.vue"
            ],
            "risks": [
                  "Disable shortcuts when user is focused inside an input or textarea"
            ],
            "verify": [
                  "Pressing 'j' smoothly scrolls view down to next section heading"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <h1 style="font-size:30px;margin:0 0 14px">Keyboard Reader Mode Active</h1>
                  <p style="font-size:14.5px;line-height:1.7;color:#475569">Press <kbd style="padding:2px 6px;border-radius:4px;background:#E2E8F0;font-size:12px">j</kbd> and <kbd style="padding:2px 6px;border-radius:4px;background:#E2E8F0;font-size:12px">k</kbd> to jump between sections.</p>
                  <div style="margin-top:20px;padding:16px;border-radius:12px;background:${dark ? "#151922" : "#F8FAFC"};border:1px solid #CBD5E1">
                    <b style="color:#2F5BEA">Section 1: Data Structures</b>
                    <p style="font-size:13px;color:#64748B;margin:4px 0 0">Focused section highlighted automatically during keyboard navigation.</p>
                  </div>
                </div>
              </div>
              <div style="position:fixed;bottom:16px;left:24px;padding:6px 12px;border-radius:8px;background:#0F172A;color:#fff;font-size:11.5px;font-weight:600">
                ⌨️ j / k: Navigate headings · [ / ]: Change pages
              </div>
            </div>
        `
    },
{
      "id": "c49",
      "n": 49,
      "name": "Reader Contrast & Palette Switcher (Dark/Sepia/OLED)",
      "group": "docs",
      "tagline": "Reading palette picker: Default Clean, Warm Paper (Sepia), and OLED True Black",
      "concept": "Prioritizes long-form eye comfort. While the portal defaults to standard light/dark, long-form readers can choose 'Warm Paper' (soothing sepia) for daytime reading, or 'OLED True Black' (#000000) for bedtime reading without eye strain.",
      "moves": [
            "Palette selector button in doc header: [Clean Light] [Warm Sepia] [OLED Dark]",
            "Warm Sepia mode uses soothing #FBF7F1 background and dark walnut ink #2B221C",
            "OLED True Black mode turns background #000000 with muted slate text for battery savings",
            "Remembers reader theme choice independently of system dark mode"
      ],
      "palette": [
            [
                  "Warm Sepia",
                  "#FBF7F1"
            ],
            [
                  "Walnut Ink",
                  "#2B221C"
            ],
            [
                  "OLED Black",
                  "#000000"
            ]
      ],
      "facts": {
            "Type": "Reading Accessibility",
            "Effort": "S",
            "Needs": "CSS data-reader-theme attributes"
      },
      "spec": {
            "today": [
                  "Only two binary themes supported (default light and default dark)"
            ],
            "proposed": [
                  "Dedicated Warm Sepia and OLED True Black reader themes for long-form docs"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/theme/components/ReaderThemePicker.vue"
            ],
            "risks": [
                  "Ensure syntax highlighting contrast meets WCAG AA in sepia mode"
            ],
            "verify": [
                  "Selecting Warm Sepia sets background to #FBF7F1 with warm typography"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr" style="background:#FBF7F1;color:#2B221C">
              ${KIT.nav("monorepo")}
              <div class="c41-doc-layout">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-size:12px;font-weight:700;color:#C8603A">WARM SEPIA READER THEME</span>
                    <div style="display:flex;gap:4px;padding:2px;border-radius:6px;background:#E8DDCF">
                      <span style="padding:2px 8px;font-size:11px;cursor:pointer">Light</span>
                      <span style="padding:2px 8px;font-size:11px;background:#fff;font-weight:700;border-radius:4px">Sepia</span>
                      <span style="padding:2px 8px;font-size:11px;cursor:pointer">OLED</span>
                    </div>
                  </div>
                  <h1 style="font-family:Georgia,serif;font-size:32px;margin:0 0 16px">The Philosophy of Contemporaneous Records</h1>
                  <p style="font-size:16px;line-height:1.75;color:#524338">Contempo is designed around IRS material-participation rules. Tax law strongly disfavors post-hoc reconstructions of time spent on short-term rentals.</p>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c50",
      "n": 50,
      "name": "i18n Multi-Language Ready Structure",
      "group": "docs",
      "tagline": "Language switcher dropdown structure prepared for international developer localization",
      "concept": "Prepares HEJI Apps for global reach. Adds a clean language selector in the navbar supporting English (default), Japanese, and Chinese, with locale-specific route fallbacks (`/ja/waypack/`, `/zh/waypack/`) supported natively by VitePress.",
      "moves": [
            "Globe language dropdown in top navbar: \ud83c\udf10 English (US), \u65e5\u672c\u8a9e, \u7b80\u4f53\u4e2d\u6587",
            "Configures VitePress `locales` configuration cleanly in `config.mts`",
            "Automatic fallback to English for un-translated documentation pages",
            "Detects browser preferred language on first visit"
      ],
      "palette": [
            [
                  "Globe Slate",
                  "#64748B"
            ],
            [
                  "Dropdown Bg",
                  "#FFFFFF"
            ],
            [
                  "Active Lang",
                  "#2F5BEA"
            ]
      ],
      "facts": {
            "Type": "Internationalization (i18n)",
            "Effort": "S",
            "Needs": "VitePress locales config structure"
      },
      "spec": {
            "today": [
                  "Site hardcoded to English with no i18n locale routing"
            ],
            "proposed": [
                  "VitePress i18n structure with locale switcher dropdown in top navigation"
            ],
            "files": [
                  "pages/.vitepress/config.mts",
                  "pages/.vitepress/theme/components/LanguagePicker.vue"
            ],
            "risks": [
                  "Maintain English as authoritative source of truth for all technical docs"
            ],
            "verify": [
                  "Clicking language dropdown shows supported locale links"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <header class="h-nav">
                <div class="h-nav-left">
                  <span class="h-title">HEJI Apps</span>
                </div>
                <div class="h-nav-right">
                  <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;border:1px solid #CBD5E1;font-size:12.5px;cursor:pointer">
                    <span>🌐 English (US)</span>
                    <span style="font-size:10px">▾</span>
                  </div>
                </div>
              </header>
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Global Documentation Ready</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c51",
      "n": 51,
      "name": "One-Click 'Add to Claude Desktop' Config Generator",
      "group": "mcp",
      "tagline": "Interactive JSON config generator formatted specifically for Claude Desktop, Cursor, and Antigravity",
      "concept": "Removes all friction from connecting AI assistants to HEJI apps. An interactive config generator lets developers toggle which MCP servers they want (Waypack, Wee Hours, Meowtrix) and generates the exact JSON snippet to paste into `claude_desktop_config.json` with 1 click.",
      "moves": [
            "Checkboxes for each app's MCP server: [x] Waypack [x] Wee Hours [x] Meowtrix",
            "Auto-generates clean, copyable `claude_desktop_config.json` snippet",
            "Tabs for Claude Desktop, Cursor, Google Antigravity, and Gemini CLI",
            "Validates absolute binary paths automatically"
      ],
      "palette": [
            [
                  "Claude Orange",
                  "#D97706"
            ],
            [
                  "Code Black",
                  "#0D1117"
            ],
            [
                  "Copy Green",
                  "#10B981"
            ]
      ],
      "facts": {
            "Type": "AI Tooling Onboarding",
            "Effort": "S",
            "Needs": "JSON config generator widget"
      },
      "spec": {
            "today": [
                  "MCP configuration instructions scattered across individual project READMEs"
            ],
            "proposed": [
                  "Unified 1-click config generator for Claude Desktop, Cursor, and Antigravity"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/McpConfigGenerator.vue"
            ],
            "risks": [
                  "Ensure JSON syntax remains strictly valid without trailing commas"
            ],
            "verify": [
                  "Clicking 'Copy Config' copies valid JSON snippet ready for claude_desktop_config.json"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>MCP Configuration Generator for AI Assistants</h2></div>
                <div class="c51-mcp-panel">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                    <div style="display:flex;gap:8px">
                      <span class="c51-tool-badge">Claude Desktop</span>
                      <span style="font-size:12px;color:#64748B;padding:3px 8px;cursor:pointer">Cursor</span>
                      <span style="font-size:12px;color:#64748B;padding:3px 8px;cursor:pointer">Antigravity</span>
                    </div>
                    <button class="h-btn-pri" style="background:#D97706;border:0">Copy claude_desktop_config.json</button>
                  </div>
                  <pre style="margin:0;padding:14px;border-radius:10px;background:#0D1117;color:#38BDF8;font-family:monospace;font-size:12px;overflow-x:auto">{
  "mcpServers": {
    "waypack": { "command": "npx", "args": ["-y", "@waypack/mcp-server"] },
    "weehours": { "command": "npx", "args": ["-y", "@weehours/mcp-server"] }
  }
}</pre>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c52",
      "n": 52,
      "name": "In-Browser Interactive MCP Tool Runner",
      "group": "mcp",
      "tagline": "Interactive sandbox testing MCP tool invocations (list_trips, log_event) with mock JSON-RPC",
      "concept": "Lets developers test Model Context Protocol tools without installing anything. An interactive sandbox lets visitors select a tool like `waypack.list_trips()`, pass sample arguments, and inspect the formatted JSON-RPC response.",
      "moves": [
            "Dropdown of available MCP tools: `list_trips`, `log_event`, `transcribe_note`",
            "Interactive JSON input parameters editor with schema validation",
            "'Execute Tool' button simulating instant MCP server response",
            "Displays structured tool output and schema definition side-by-side"
      ],
      "palette": [
            [
                  "MCP Violet",
                  "#6366F1"
            ],
            [
                  "Response Green",
                  "#10B981"
            ],
            [
                  "Sandbox Slate",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Developer Interactive Sandbox",
            "Effort": "M",
            "Needs": "Mock JSON-RPC tool dispatcher"
      },
      "spec": {
            "today": [
                  "No way to test or inspect MCP tool schemas directly in the browser"
            ],
            "proposed": [
                  "In-browser MCP tool explorer with simulated JSON-RPC request/response runner"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/McpToolRunner.vue"
            ],
            "risks": [
                  "Simulate responses accurately based on the app's real TypeScript tool schemas"
            ],
            "verify": [
                  "Running waypack.list_trips returns sample trips in standard MCP tool response shape"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>MCP Interactive Tool Sandbox</h2></div>
                <div class="c51-mcp-panel">
                  <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
                    <span style="font-weight:700;font-size:13px">Tool:</span>
                    <span class="c51-tool-badge">waypack.list_trips({ activeOnly: true })</span>
                    <button class="h-btn-pri" style="margin-left:auto;border:0">▶ Run Tool</button>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div style="padding:10px;border-radius:8px;background:${dark ? "#0D1117" : "#F8FAFC"};border:1px solid #CBD5E1;font-family:monospace;font-size:11.5px">
                      <b style="color:#64748B">REQUEST PARAMS:</b>
                      <pre style="margin:4px 0 0;color:#6366F1">{ "activeOnly": true }</pre>
                    </div>
                    <div style="padding:10px;border-radius:8px;background:#0D1117;color:#10B981;font-family:monospace;font-size:11.5px">
                      <b style="color:#94A3B8">MOCK JSON-RPC RESPONSE:</b>
                      <pre style="margin:4px 0 0">{ "trips": [{ "id": "t1", "title": "Kyoto Fall Break", "offline": true }] }</pre>
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c53",
      "n": 53,
      "name": "AI Agent Compatibility Matrix",
      "group": "mcp",
      "tagline": "Badges showing verified compatibility with Claude 3.7, Google Antigravity, OpenAI Swarm, Cursor",
      "concept": "Reassures developers building agentic workflows. An explicit compatibility matrix verifies which AI coding agents and LLMs have been tested against HEJI MCP tools, including Claude 3.7 Sonnet, Google Antigravity, Cursor, and OpenAI Swarm.",
      "moves": [
            "Compatibility matrix table with green verification checkmarks",
            "Lists verified client applications: Claude Desktop, Cursor, Antigravity, VS Code Copilot",
            "Indicates support for streaming tools, image attachments, and local shell execution",
            "Links to sample system prompts for each agent"
      ],
      "palette": [
            [
                  "Check Green",
                  "#10B981"
            ],
            [
                  "Agent Slate",
                  "#0F172A"
            ],
            [
                  "Matrix Border",
                  "#E2E8F0"
            ]
      ],
      "facts": {
            "Type": "Ecosystem Compatibility",
            "Effort": "S",
            "Needs": "Compatibility data table in kit"
      },
      "spec": {
            "today": [
                  "No public compatibility matrix for supported AI agent runtimes"
            ],
            "proposed": [
                  "Matrix table showing verified compatibility across Claude, Antigravity, Cursor"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/AgentMatrix.vue"
            ],
            "risks": [
                  "Update matrix when new agent frameworks release major updates"
            ],
            "verify": [
                  "Matrix lists Claude Desktop, Antigravity, and Cursor with green verified badges"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Verified AI Agent Compatibility Matrix</h2></div>
                <div style="border-radius:12px;border:1px solid #CBD5E1;overflow:hidden;background:${dark ? "#151922" : "#fff"}">
                  <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                    <thead>
                      <tr style="background:${dark ? "#1E293B" : "#F8FAFC"};border-bottom:1px solid #CBD5E1;color:#64748B">
                        <th style="padding:10px 14px">AI AGENT / CLIENT</th>
                        <th style="padding:10px 14px">WAYPACK MCP</th>
                        <th style="padding:10px 14px">WEEHOURS MCP</th>
                        <th style="padding:10px 14px">FEEDBACKKIT MCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:10px 14px;font-weight:700">Anthropic Claude Desktop</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                      </tr>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:10px 14px;font-weight:700">Google Antigravity CLI</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;font-weight:700">Cursor / Windsurf IDE</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                        <td style="padding:10px 14px;color:#10B981">✓ Verified</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c54",
      "n": 54,
      "name": "Interactive CLI Setup Wizard",
      "group": "mcp",
      "tagline": "Step-by-step interactive terminal guide for connecting MCP servers to local dev tools",
      "concept": "Guides developers through zero-to-one setup. A 3-step interactive terminal wizard shows exact terminal commands to install the CLI, authenticate securely with local tokens, and verify that the tools appear inside their AI coding environment.",
      "moves": [
            "3-step progress wizard: 1. Install CLI -> 2. Connect Assistant -> 3. Run Test Prompt",
            "Copyable bash command per step with simulated terminal feedback",
            "Troubleshooting accordion addressing common path and permission hurdles",
            "Generates customized setup commands based on OS (macOS / Linux / Windows)"
      ],
      "palette": [
            [
                  "Step Blue",
                  "#2F5BEA"
            ],
            [
                  "Step Done",
                  "#10B981"
            ],
            [
                  "Terminal Black",
                  "#0D1117"
            ]
      ],
      "facts": {
            "Type": "Developer Onboarding",
            "Effort": "S",
            "Needs": "Stepper component in Vue"
      },
      "spec": {
            "today": [
                  "Setup commands buried in markdown docs without interactive stepper guidance"
            ],
            "proposed": [
                  "3-step interactive setup wizard showing command progression and verification"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/CliWizard.vue"
            ],
            "risks": [
                  "Keep commands cross-platform (macOS and Linux zsh/bash)"
            ],
            "verify": [
                  "Stepping through wizard shows copyable commands for each installation phase"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>MCP Server 3-Step Setup Wizard</h2></div>
                <div style="display:flex;gap:12px;margin-bottom:16px">
                  <span style="padding:6px 14px;border-radius:8px;background:#2F5BEA;color:#fff;font-weight:700;font-size:12px">1. Install Server</span>
                  <span style="padding:6px 14px;border-radius:8px;background:#E2E8F0;font-size:12px;font-weight:600">2. Configure Agent</span>
                  <span style="padding:6px 14px;border-radius:8px;background:#E2E8F0;font-size:12px;font-weight:600">3. Verify First Tool</span>
                </div>
                <div style="padding:16px;border-radius:12px;background:#0D1117;color:#C9D1D9;font-family:monospace;font-size:13px">
                  <div style="color:#8B949E"># Step 1: Install the unified monorepo MCP server suite</div>
                  <div style="margin-top:6px"><span style="color:#58A6FF">$</span> npm install -g @heji/mcp-suite</div>
                  <div style="color:#7EE787;margin-top:6px">✓ Installed 4 servers: waypack, weehours, meowtrix, feedbackkit</div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c55",
      "n": 55,
      "name": "Agent Security & Privacy Transparency Matrix",
      "group": "mcp",
      "tagline": "Explicit table showing which file systems, databases, and network ports each MCP tool touches",
      "concept": "Addresses enterprise and privacy-conscious developer concerns. An explicit transparency sheet details exactly what permissions each MCP server requires: read-only local storage, zero telemetry egress, and sandboxed file paths.",
      "moves": [
            "Security nutrition label for each MCP tool server",
            "Clear indicators for: Local FS Access, Network Egress, Auth Tokens Required, Sandboxing",
            "Affirms zero telemetry and zero secret leakage guarantees",
            "Links to security audit reports in `projects/*/SECURITY.md`"
      ],
      "palette": [
            [
                  "Security Shield",
                  "#10B981"
            ],
            [
                  "Warning Tag",
                  "#F59E0B"
            ],
            [
                  "Card Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Security & Transparency",
            "Effort": "S",
            "Needs": "Permissions audit table in kit"
      },
      "spec": {
            "today": [
                  "No centralized security or permissions matrix for MCP tool servers"
            ],
            "proposed": [
                  "Privacy and permissions sheet documenting local file access and network egress"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/SecurityMatrix.vue"
            ],
            "risks": [
                  "Ensure security declarations accurately reflect codebase behavior"
            ],
            "verify": [
                  "Table proves Waypack MCP requires zero network access (100% local SQLite read)"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>MCP Security &amp; Permissions Sheet</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <b>Waypack MCP Tool Server</b>
                    <span style="color:#10B981;font-weight:700;font-size:12px">🛡️ 100% Read-Only Sandboxed</span>
                  </div>
                  <div style="font-size:13px;line-height:1.6;color:#64748B">
                    • <b>Local File System:</b> Sandboxed to <code style="font-family:monospace">~/.waypack/bundles/</code> (Read-Only)<br>
                    • <b>Network Egress:</b> None. Operates completely offline without HTTP requests.<br>
                    • <b>Credentials:</b> Zero API keys or cloud tokens required.
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c56",
      "n": 56,
      "name": "JSON Schema Interactive Explorer",
      "group": "mcp",
      "tagline": "Collapsible tree viewer for MCP tool input schemas and tool call response objects",
      "concept": "Enables engineers to explore complex MCP tool interfaces visually. Provides an interactive JSON schema tree viewer where developers can expand schema nodes, inspect required properties, and copy TypeScript interfaces directly.",
      "moves": [
            "Collapsible schema tree viewer with type tags (`string`, `boolean`, `enum`)",
            "Highlights required fields vs optional parameters",
            "'Copy as TypeScript Interface' button for client developers",
            "Includes human-readable description strings for every property"
      ],
      "palette": [
            [
                  "Tree Branch",
                  "#94A3B8"
            ],
            [
                  "Type Blue",
                  "#3B82F6"
            ],
            [
                  "Schema Slate",
                  "#0D1117"
            ]
      ],
      "facts": {
            "Type": "Schema Documentation",
            "Effort": "S",
            "Needs": "JSON schema tree renderer component"
      },
      "spec": {
            "today": [
                  "Schemas only viewable in raw JSON files in monorepo packages"
            ],
            "proposed": [
                  "Interactive tree schema viewer with type annotations and copy TypeScript button"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/SchemaExplorer.vue"
            ],
            "risks": [
                  "Tree must expand and collapse smoothly without layout jump"
            ],
            "verify": [
                  "Clicking trip_bundle schema expands itinerary array and waypoint properties"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>MCP JSON Schema Tree Explorer</h2></div>
                <div style="padding:16px;border-radius:12px;background:#0D1117;color:#C9D1D9;font-family:monospace;font-size:12.5px">
                  <div style="color:#79C0FF">▾ TripBundleSchema (object)</div>
                  <div style="padding-left:18px">• id: <span style="color:#A5D6FF">string</span> <span style="color:#7EE787">(required)</span></div>
                  <div style="padding-left:18px">• title: <span style="color:#A5D6FF">string</span> <span style="color:#7EE787">(required)</span></div>
                  <div style="padding-left:18px;color:#79C0FF">▾ waypoints: <span style="color:#A5D6FF">Array&lt;Waypoint&gt;</span></div>
                  <div style="padding-left:36px">• lat: <span style="color:#FFA657">number</span> [-90, 90]</div>
                  <div style="padding-left:36px">• lng: <span style="color:#FFA657">number</span> [-180, 180]</div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c57",
      "n": 57,
      "name": "Monorepo Candidate Review Site Showcase",
      "group": "mcp",
      "tagline": "Embedded showcase of candidate review sites and design walkthroughs generated by agents",
      "concept": "Demonstrates the power of the `heji-candidate-review` skill. Highlights past candidate review sites (e.g. `ios-home-redesign`, `weehours-watch-redesign`) right in the portal, showing how human developers and AI pair on design choices.",
      "moves": [
            "Showcase carousel of past candidate review sites in `reports/archive/`",
            "Displays candidate cards with real rating stars and heart counts",
            "Explains the feedback loop: 'Brief -> Candidates -> Review -> Agent Hand-off'",
            "Direct link to live review site servers"
      ],
      "palette": [
            [
                  "Showcase Violet",
                  "#8B5CF6"
            ],
            [
                  "Review Card",
                  "#FFFFFF"
            ],
            [
                  "Star Gold",
                  "#F59E0B"
            ]
      ],
      "facts": {
            "Type": "Process Transparency & Agent Showcase",
            "Effort": "S",
            "Needs": "Archive report index"
      },
      "spec": {
            "today": [
                  "Candidate review sites remain local in reports/ and are not showcased on the public site"
            ],
            "proposed": [
                  "Gallery section showcasing candidate review sites and agent design decisions"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/ReviewShowcase.vue"
            ],
            "risks": [
                  "Only showcase polished, archived reviews with user permissions"
            ],
            "verify": [
                  "Gallery displays card for ios-home-redesign and weehours-watch-redesign"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Candidate Review Sites (Agent-Assisted Design)</h2></div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <span style="font-size:11px;font-weight:700;color:#8B5CF6;text-transform:uppercase">REVIEW SITE · ARCHIVED</span>
                    <h4 style="margin:6px 0">Wee Hours Watch Redesign</h4>
                    <p style="font-size:13px;color:#64748B;margin:0 0 10px">10 watchOS complication directions evaluated with side-by-side ratings.</p>
                    <span style="font-size:12px;color:#F59E0B">★★★★★ Winner Implemented in Build 92</span>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <span style="font-size:11px;font-weight:700;color:#8B5CF6;text-transform:uppercase">REVIEW SITE · ARCHIVED</span>
                    <h4 style="margin:6px 0">Waypack iOS Home Redesign</h4>
                    <p style="font-size:13px;color:#64748B;margin:0 0 10px">10 home screen directions comparing density vs visual storytelling.</p>
                    <span style="font-size:12px;color:#F59E0B">★★★★★ Winner Implemented in Build 84</span>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c58",
      "n": 58,
      "name": "Local LLM Model Benchmark Table",
      "group": "mcp",
      "tagline": "Benchmark matrix comparing on-device Whisper and Qwen inference speeds on Apple Silicon",
      "concept": "Grounded in real repo evaluations (`projects/voxbrief/evals/`, `projects/weehours/ml/`). Renders a benchmark comparison showing transcription accuracy, latency, and memory consumption across iPhone 15 Pro, iPhone 16, M2 Mac, and Apple Watch.",
      "moves": [
            "Benchmark table: Hardware Target, Model Weight, Latency, Memory Footprint, WER (Word Error Rate)",
            "Direct citation of evaluation scripts in `voxbrief/evals/`",
            "Clear indicator distinguishing CoreML Neural Engine acceleration from CPU fallback",
            "Downloadable CSV evaluation results"
      ],
      "palette": [
            [
                  "Benchmark Blue",
                  "#2F5BEA"
            ],
            [
                  "Speed Green",
                  "#10B981"
            ],
            [
                  "Table Border",
                  "#E2E8F0"
            ]
      ],
      "facts": {
            "Type": "ML Benchmarks & Evals",
            "Effort": "S",
            "Needs": "Benchmark data table in kit"
      },
      "spec": {
            "today": [
                  "Evaluation results only stored in YAML/CSV files inside projects/voxbrief/evals/"
            ],
            "proposed": [
                  "Public ML evaluation benchmark table on the documentation site"
            ],
            "files": [
                  "pages/voxbrief/index.md",
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/MlBenchmarks.vue"
            ],
            "risks": [
                  "Label estimates versus measured numbers accurately per monorepo rules"
            ],
            "verify": [
                  "Table displays Whisper base latency on M2 Mac: 240ms measured"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>On-Device ML Benchmarks (Measured Latency)</h2></div>
                <div style="border-radius:12px;border:1px solid #CBD5E1;overflow:hidden;background:${dark ? "#151922" : "#fff"}">
                  <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                    <thead>
                      <tr style="background:${dark ? "#1E293B" : "#F8FAFC"};border-bottom:1px solid #CBD5E1;color:#64748B">
                        <th style="padding:10px 14px">DEVICE TARGET</th>
                        <th style="padding:10px 14px">MODEL</th>
                        <th style="padding:10px 14px">LATENCY (AUDIO 3s)</th>
                        <th style="padding:10px 14px">RAM USAGE</th>
                        <th style="padding:10px 14px">ACCELERATOR</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:10px 14px;font-weight:700">Apple Silicon M2 / M3</td>
                        <td style="padding:10px 14px">Whisper Base CoreML</td>
                        <td style="padding:10px 14px;color:#10B981;font-weight:700">180ms</td>
                        <td style="padding:10px 14px">74MB</td>
                        <td style="padding:10px 14px">Apple Neural Engine</td>
                      </tr>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:10px 14px;font-weight:700">iPhone 16 / 15 Pro</td>
                        <td style="padding:10px 14px">Whisper Base CoreML</td>
                        <td style="padding:10px 14px;color:#10B981;font-weight:700">260ms</td>
                        <td style="padding:10px 14px">74MB</td>
                        <td style="padding:10px 14px">Apple Neural Engine</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;font-weight:700">Apple Watch Series 9</td>
                        <td style="padding:10px 14px">Whisper Tiny CoreML</td>
                        <td style="padding:10px 14px;color:#D97706;font-weight:700">680ms</td>
                        <td style="padding:10px 14px">38MB</td>
                        <td style="padding:10px 14px">Apple S9 SiP Neural</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c59",
      "n": 59,
      "name": "Pre-Configured System Prompt Library",
      "group": "mcp",
      "tagline": "Curated system prompts for pairing Claude or Gemini with Waypack and Wee Hours MCP",
      "concept": "Empowers users to get immediate magic from their AI assistant. Provides tested, production-grade system prompts for Claude, ChatGPT, and Antigravity: 'Trip Planner Concierge' (Waypack MCP) and '3am Sleep Consultant' (Wee Hours MCP).",
      "moves": [
            "Card library of specialized assistant prompts: Trip Planner, Pediatric Sleep Coach, Tax Audit Assistant",
            "One-click 'Copy System Prompt' button with copy toast",
            "Explains which MCP tools the prompt leverages",
            "Tips for setting up custom Claude Projects or Custom GPTs"
      ],
      "palette": [
            [
                  "Prompt Amber",
                  "#F59E0B"
            ],
            [
                  "Prompt Slate",
                  "#0F172A"
            ],
            [
                  "Copy Blue",
                  "#2F5BEA"
            ]
      ],
      "facts": {
            "Type": "Prompt Engineering Library",
            "Effort": "S",
            "Needs": "Prompt templates array in kit"
      },
      "spec": {
            "today": [
                  "No system prompts or pairing guides available on the documentation site"
            ],
            "proposed": [
                  "System prompt catalog tailored for Claude Desktop and Antigravity pairings"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/PromptLibrary.vue"
            ],
            "risks": [
                  "Ensure prompts stay updated when tool schemas change"
            ],
            "verify": [
                  "Copying 'Trip Planner' prompt copies valid system prompt targeting Waypack tools"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Curated System Prompts for AI Assistants</h2></div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                      <b>✈️ Waypack Itinerary Concierge</b>
                      <button class="h-btn-pri" style="padding:3px 8px;font-size:11px">Copy Prompt</button>
                    </div>
                    <p style="font-size:13px;color:#64748B;margin:8px 0 10px">Pairs with Waypack MCP to turn natural conversation into validated offline bundles.</p>
                    <div style="padding:8px 12px;border-radius:8px;background:${dark ? "#0D1117" : "#F8FAFC"};font-size:11.5px;font-family:monospace;color:#475569">
                      "You are a travel planning assistant with access to Waypack MCP tools..."
                    </div>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                      <b>👶 3am Pediatric Sleep Consultant</b>
                      <button class="h-btn-pri" style="padding:3px 8px;font-size:11px">Copy Prompt</button>
                    </div>
                    <p style="font-size:13px;color:#64748B;margin:8px 0 10px">Analyzes Wee Hours feeding and diaper logs to calculate wake windows.</p>
                    <div style="padding:8px 12px;border-radius:8px;background:${dark ? "#0D1117" : "#F8FAFC"};font-size:11.5px;font-family:monospace;color:#475569">
                      "You are a gentle pediatric sleep assistant reading Wee Hours event data..."
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c60",
      "n": 60,
      "name": "Autonomous Agent Trace Visualizer",
      "group": "mcp",
      "tagline": "Step-by-step timeline view showing how an AI agent receives prompt, calls tools, and replies",
      "concept": "Demystifies agentic reasoning. An interactive timeline shows the anatomy of an agent interaction: 1. User asks 'Plan a 4-day Tokyo trip' -> 2. Agent calls `waypack.search_places()` -> 3. Agent calls `waypack.create_bundle()` -> 4. Agent delivers validated bundle to phone.",
      "moves": [
            "Step-by-step visual trace diagram with expandable JSON payloads",
            "Timing benchmarks for each step (e.g. LLM planning: 1.2s, Tool execution: 40ms)",
            "Visual distinction between LLM thought, tool call, and user response",
            "Demonstrates real-world MCP utility in human-understandable format"
      ],
      "palette": [
            [
                  "Step Thought",
                  "#6366F1"
            ],
            [
                  "Step Tool",
                  "#10B981"
            ],
            [
                  "Trace Slate",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Agent Interaction Design",
            "Effort": "M",
            "Needs": "Trace stepper component in kit"
      },
      "spec": {
            "today": [
                  "No visualization of how MCP tools are invoked during an AI agent session"
            ],
            "proposed": [
                  "Visual execution trace demonstrating end-to-end prompt-to-bundle journey"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/AgentTrace.vue"
            ],
            "risks": [
                  "Keep trace concise and easy to read without overwhelming technical clutter"
            ],
            "verify": [
                  "Stepping through trace demonstrates tool call parameters and resulting bundle"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Autonomous Agent Trace Execution</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px">
                    <span style="padding:4px 8px;border-radius:6px;background:#EEF2FF;color:#2F5BEA;font-weight:700;font-size:11px">STEP 1</span>
                    <div><b>User Prompt:</b> "Create a 3-day Kyoto itinerary and bundle it for offline use."</div>
                  </div>
                  <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px">
                    <span style="padding:4px 8px;border-radius:6px;background:#ECFDF5;color:#059669;font-weight:700;font-size:11px">STEP 2</span>
                    <div><b>Agent MCP Tool Call:</b> <code style="font-family:monospace;font-size:12px">waypack.create_trip_bundle({ city: "Kyoto", days: 3 })</code></div>
                  </div>
                  <div style="display:flex;gap:14px;align-items:flex-start">
                    <span style="padding:4px 8px;border-radius:6px;background:#FEF3C7;color:#D97706;font-weight:700;font-size:11px">STEP 3</span>
                    <div><b>Result:</b> Offline bundle compiled (4.2MB) · Sent to device with zero signal needed.</div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c61",
      "n": 61,
      "name": "Public Feedback-to-Fix Kanban Board",
      "group": "feedbackkit",
      "tagline": "Public tracker showing: Submitted -> Agent Assigned -> PR Opened -> Fix Verified",
      "concept": "Showcases the autonomous feedback loop in public. Visitors can view a live 4-column Kanban board displaying user reports, Antigravity/Claude agent assignment, automated PR creation, and user fix verification in deployed builds.",
      "moves": [
            "4-column public Kanban: Submitted, Agent Triaging, PR Open, Verified Fixed",
            "Displays ticket badges with reporter avatar and app name (e.g. 'Waypack')",
            "Links directly to GitHub PRs authored by autonomous agents",
            "Filterable by app project (Waypack, Wee Hours, Voxbrief)"
      ],
      "palette": [
            [
                  "Kanban Slate",
                  "#F1F5F9"
            ],
            [
                  "PR Purple",
                  "#8B5CF6"
            ],
            [
                  "Verified Green",
                  "#10B981"
            ]
      ],
      "facts": {
            "Type": "Autonomous Agent Pipeline UX",
            "Effort": "M",
            "Needs": "FeedbackKit MCP / GitHub API integration"
      },
      "spec": {
            "today": [
                  "FeedbackKit feedback loop operates behind the scenes without public transparency"
            ],
            "proposed": [
                  "Public Kanban board on the website tracking bug reports through agent fixes to verified builds"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/FeedbackKanban.vue"
            ],
            "risks": [
                  "Redact personal reporter email addresses to preserve privacy"
            ],
            "verify": [
                  "Kanban displays recent agent PRs and reporter verification status"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Autonomous Bug Fix Kanban (FeedbackKit Loop)</h2></div>
                <div class="c61-kanban">
                  <div class="c61-col">
                    <div class="c61-col-title">📥 Submitted (2)</div>
                    <div class="c61-ticket"><b>#142: Map zoom stutter</b><div style="font-size:11px;color:#64748B;margin-top:4px">Waypack · Reported via in-app fab</div></div>
                    <div class="c61-ticket"><b>#143: Night voice prompt</b><div style="font-size:11px;color:#64748B;margin-top:4px">Wee Hours · 3am log report</div></div>
                  </div>
                  <div class="c61-col">
                    <div class="c61-col-title">🤖 Agent Fixing (1)</div>
                    <div class="c61-ticket" style="border-color:#8B5CF6">
                      <b>#140: Complication sync</b>
                      <div style="font-size:11px;color:#8B5CF6;margin-top:4px">Antigravity runner executing test suite</div>
                    </div>
                  </div>
                  <div class="c61-col">
                    <div class="c61-col-title">⚡ PR Opened (1)</div>
                    <div class="c61-ticket" style="border-color:#3B82F6">
                      <b>PR #88: Fix SQLite pragma</b>
                      <div style="font-size:11px;color:#3B82F6;margin-top:4px">Authored by agent · Passed CI</div>
                    </div>
                  </div>
                  <div class="c61-col">
                    <div class="c61-col-title">✅ Verified Fixed (12)</div>
                    <div class="c61-ticket" style="border-color:#10B981">
                      <b>#138: Vector tile clipping</b>
                      <div style="font-size:11px;color:#10B981;margin-top:4px">Reporter confirmed fixed in v1.4.2</div>
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c62",
      "n": 62,
      "name": "Reporter 'Is It Fixed?' Verification Banner",
      "group": "feedbackkit",
      "tagline": "Interactive banner showing how reporters verify bug fixes in deployed build (__PAGES_BUILD__)",
      "concept": "Demonstrates FeedbackKit's signature closing of the loop. When a reporter visits the deployed site after an agent fix, an interactive banner asks: 'We fixed issue #138 in this build. Does it work for you? [Yes, It's Fixed] [Still Broken]'.",
      "moves": [
            "Simulated verification banner anchored at top of page",
            "Reads deployed commit SHA (`__PAGES_BUILD__`) to verify matching fix",
            "Two distinct buttons: 'Yes, it works now!' vs 'Still having trouble'",
            "Tapping 'Yes' publishes celebratory confetti and marks issue verified on GitHub"
      ],
      "palette": [
            [
                  "Banner Green",
                  "#ECFDF5"
            ],
            [
                  "Button Yes",
                  "#059669"
            ],
            [
                  "Button No",
                  "#EF4444"
            ]
      ],
      "facts": {
            "Type": "Reporter Feedback Verification",
            "Effort": "S",
            "Needs": "FeedbackKit.enableFixVerification()"
      },
      "spec": {
            "today": [
                  "Fix verification works internally in feedbackkit-web but is not showcased visually"
            ],
            "proposed": [
                  "Visual banner demonstration showing the 'Is it fixed?' user verification interaction"
            ],
            "files": [
                  "pages/.vitepress/theme/index.ts",
                  "pages/.vitepress/theme/components/VerificationDemo.vue"
            ],
            "risks": [
                  "Ensure verification prompt only appears for users with active report cookies"
            ],
            "verify": [
                  "Clicking 'Yes, it works' confirms fix and displays verified status badge"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <!-- Reporter Verification Banner -->
              <div style="background:#ECFDF5;border-bottom:1px solid #A7F3D0;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;color:#065F46">
                <div style="font-size:13px">
                  🎉 <b>Build 7c2a8f1 deployed:</b> You reported <i>"Dark mode table contrast"</i>. Did our agent's fix solve it?
                </div>
                <div style="display:flex;gap:8px">
                  <button class="h-btn-pri" style="background:#059669;padding:4px 12px;font-size:12px;border:0">✓ Yes, It's Fixed!</button>
                  <button class="h-btn-sec" style="padding:4px 12px;font-size:12px">Still Broken</button>
                </div>
              </div>
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>The apps (Verified Feedback Loop)</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c63",
      "n": 63,
      "name": "Screenshot Annotation & Blur Tool Demo",
      "group": "feedbackkit",
      "tagline": "Interactive canvas widget demonstrating how users draw arrows and blur sensitive data",
      "concept": "Engages visitors with the FeedbackKit reporting experience. Visitors can test the in-browser annotation canvas: drawing red arrows, adding highlight boxes, and applying heavy blur filters to mask passwords or personal information before submitting.",
      "moves": [
            "Interactive HTML5 canvas mock showing a sample app screen",
            "Toolbar with tools: Pen, Arrow, Redact / Blur Box, and Text Note",
            "Demonstrates client-side PII privacy masking before any pixels leave browser",
            "Tapping 'Submit Report' simulates instant ticket generation"
      ],
      "palette": [
            [
                  "Annotation Red",
                  "#EF4444"
            ],
            [
                  "Blur Gray",
                  "rgba(0,0,0,0.5)"
            ],
            [
                  "Canvas Bg",
                  "#F8FAFC"
            ]
      ],
      "facts": {
            "Type": "Interactive Feature Sandbox",
            "Effort": "M",
            "Needs": "Canvas annotation tool in Vue"
      },
      "spec": {
            "today": [
                  "No interactive demonstration of screenshot drawing or redaction tools"
            ],
            "proposed": [
                  "Interactive canvas sandbox demonstrating FeedbackKit screenshot annotation"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/AnnotationDemo.vue"
            ],
            "risks": [
                  "Keep canvas implementation lightweight with touch drawing support"
            ],
            "verify": [
                  "Dragging across canvas applies red highlight arrow or blur rectangle"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>FeedbackKit Screenshot Redaction Sandbox</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;gap:8px;margin-bottom:14px">
                    <span style="padding:4px 10px;border-radius:6px;background:#EF4444;color:#fff;font-size:12px;font-weight:700">✏️ Red Pen</span>
                    <span style="padding:4px 10px;border-radius:6px;background:#334155;color:#fff;font-size:12px;font-weight:700">⬛ Blur / Redact PII</span>
                    <span style="margin-left:auto;font-size:12px;color:#64748B">Draw anywhere on screen</span>
                  </div>
                  <div style="height:200px;border-radius:10px;background:#0F172A;position:relative;display:flex;align-items:center;justify-content:center;color:#94A3B8">
                    <span>[Sample App Screen Rendered on Canvas]</span>
                    <div style="position:absolute;top:40px;left:80px;border:2px dashed #EF4444;padding:6px 12px;color:#EF4444;border-radius:6px;font-weight:700;font-size:12px">
                      ← User drawn arrow: "Button text truncated here"
                    </div>
                    <div style="position:absolute;bottom:40px;right:80px;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);padding:8px 16px;color:#fff;border-radius:6px;font-size:11px">
                      [REDACTED: User Email Address]
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c64",
      "n": 64,
      "name": "Before/After Agent PR Diff Viewer",
      "group": "feedbackkit",
      "tagline": "Split diff viewer showing clean before/after code changes autonomously authored by agents",
      "concept": "Demonstrates the technical competence of autonomous agent fixes. A split code diff viewer shows the actual code diff authored by Google Antigravity or Claude in response to a real FeedbackKit report, proving agent precision.",
      "moves": [
            "Split git diff viewer with green additions and red deletions",
            "Commit metadata header: `Authored by agent: Google Antigravity`",
            "Shows passing unit test and linter confirmation checks",
            "Copy diff as patch button"
      ],
      "palette": [
            [
                  "Diff Add",
                  "#ECFDF5"
            ],
            [
                  "Diff Del",
                  "#FEF2F2"
            ],
            [
                  "Diff Border",
                  "#CBD5E1"
            ]
      ],
      "facts": {
            "Type": "Code Diff Viewer",
            "Effort": "S",
            "Needs": "Pre-formatted diff viewer component"
      },
      "spec": {
            "today": [
                  "No code diffs showcasing agent-authored PRs on the public site"
            ],
            "proposed": [
                  "Embedded split diff viewer showing before/after code changes for recent bug fixes"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/AgentDiffViewer.vue"
            ],
            "risks": [
                  "Select real, high-quality bug fixes from repository history"
            ],
            "verify": [
                  "Diff viewer highlights clean additions and passing unit test indicators"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Autonomous Agent Code Diff (Issue #138 Fix)</h2></div>
                <div style="border-radius:12px;border:1px solid #30363D;overflow:hidden;background:#0D1117;font-family:monospace;font-size:12px">
                  <div style="padding:10px 16px;background:#161B22;border-bottom:1px solid #30363D;display:flex;justify-content:space-between">
                    <span>projects/waypack/lib/widgets/trip_card.dart</span>
                    <span style="color:#7EE787">✓ Passed 42 unit tests</span>
                  </div>
                  <div style="padding:14px;line-height:1.6">
                    <div style="color:#F85149">- final Color cardColor = hashTitle(title); // old hash collision</div>
                    <div style="color:#7EE787">+ final Color cardColor = trip.accentColor ?? hashTitle(title); // safe fallback</div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c65",
      "n": 65,
      "name": "Drop-in SDK Code Generator",
      "group": "feedbackkit",
      "tagline": "Interactive code generator for Swift, Kotlin, React Native, Flutter, and Web SDK init",
      "concept": "Makes integrating FeedbackKit effortless for third-party developers. An interactive tab generator outputs copyable initialization code for Swift (SPM/CocoaPods), Kotlin (JitPack), Flutter, React Native, and vanilla Web.",
      "moves": [
            "Language tabs: [Swift] [Kotlin] [Flutter] [React Native] [Web]",
            "Generates customized initialization code with project key and endpoint",
            "Shows one-line trigger button setup: `FeedbackKit.showFloatingTriggerButton()`",
            "Links to package registries (npm, CocoaPods, JitPack)"
      ],
      "palette": [
            [
                  "Swift Orange",
                  "#F05138"
            ],
            [
                  "Kotlin Purple",
                  "#7F52FF"
            ],
            [
                  "Flutter Blue",
                  "#02569B"
            ]
      ],
      "facts": {
            "Type": "Developer Onboarding & SDK Setup",
            "Effort": "S",
            "Needs": "SDK code templates array"
      },
      "spec": {
            "today": [
                  "SDK setup instructions scattered across individual platform README files"
            ],
            "proposed": [
                  "Unified interactive SDK initialization snippet generator for all 5 platforms"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/SdkGenerator.vue"
            ],
            "risks": [
                  "Verify snippets match latest 1.0.62 release conventions"
            ],
            "verify": [
                  "Selecting Swift generates valid FeedbackKit.configure() Swift snippet"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>FeedbackKit SDK Drop-in Setup</h2></div>
                <div style="border-radius:14px;border:1px solid #CBD5E1;background:${dark ? "#151922" : "#fff"};padding:20px">
                  <div style="display:flex;gap:8px;margin-bottom:14px">
                    <span style="padding:4px 12px;border-radius:6px;background:#F05138;color:#fff;font-size:12px;font-weight:700">Swift (iOS/macOS)</span>
                    <span style="padding:4px 12px;border-radius:6px;background:#E2E8F0;font-size:12px;font-weight:600">Kotlin (Android)</span>
                    <span style="padding:4px 12px;border-radius:6px;background:#E2E8F0;font-size:12px;font-weight:600">Flutter</span>
                    <span style="padding:4px 12px;border-radius:6px;background:#E2E8F0;font-size:12px;font-weight:600">Web</span>
                  </div>
                  <pre style="margin:0;padding:14px;border-radius:10px;background:#0D1117;color:#38BDF8;font-family:monospace;font-size:12px">// Swift / SwiftUI Setup in AppDelegate or App init
import FeedbackKit

FeedbackKit.configure(
  projectKey: "pk_live_your_key",
  appVersion: "1.0.0"
)
FeedbackKit.enableShakeToReport()</pre>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c66",
      "n": 66,
      "name": "Public Feature Upvoting & Community Roadmap",
      "group": "feedbackkit",
      "tagline": "Community upvoting board with filterable status badges (Planned, In Progress, Released)",
      "concept": "Empowers users to guide monorepo product roadmaps. A clean upvoting board lets users vote on requested capabilities (e.g. 'Waypack GPX Export', 'Wee Hours Apple Watch Complications') and track progress from planning to release.",
      "moves": [
            "Upvote counter button next to each roadmap item",
            "Status chips: [Planning] [In Progress] [Shipped in v1.4.2]",
            "Submit feature request button triggering FeedbackKit modal",
            "Sort by Most Upvoted or Recently Added"
      ],
      "palette": [
            [
                  "Upvote Purple",
                  "#8B5CF6"
            ],
            [
                  "Planned Blue",
                  "#3B82F6"
            ],
            [
                  "Shipped Green",
                  "#10B981"
            ]
      ],
      "facts": {
            "Type": "Product Roadmap & Voting",
            "Effort": "M",
            "Needs": "Roadmap item store with vote counters"
      },
      "spec": {
            "today": [
                  "No public roadmap or user voting mechanism on the site"
            ],
            "proposed": [
                  "Interactive community roadmap with upvoting and shipping status chips"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/components/PublicRoadmap.vue"
            ],
            "risks": [
                  "Prevent voting spam by storing upvoted IDs in localStorage"
            ],
            "verify": [
                  "Clicking upvote increments counter and persists state"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Public Feature Roadmap &amp; Community Votes</h2></div>
                <div style="display:flex;flex-direction:column;gap:10px">
                  <div style="padding:16px 20px;border-radius:12px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:16px">
                      <button style="padding:8px 12px;border-radius:8px;background:#EEF2FF;color:#2F5BEA;font-weight:800;border:0;cursor:pointer">▲ 142</button>
                      <div>
                        <b>Waypack: GPX Export for Garmin Watches</b>
                        <div style="font-size:12px;color:#64748B">Export offline trip waypoints to handheld GPS and Garmin devices.</div>
                      </div>
                    </div>
                    <span style="padding:4px 10px;border-radius:99px;background:#FEF3C7;color:#D97706;font-size:12px;font-weight:700">IN PROGRESS</span>
                  </div>
                  <div style="padding:16px 20px;border-radius:12px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:16px">
                      <button style="padding:8px 12px;border-radius:8px;background:#EEF2FF;color:#2F5BEA;font-weight:800;border:0;cursor:pointer">▲ 98</button>
                      <div>
                        <b>Wee Hours: Multiple Children Support</b>
                        <div style="font-size:12px;color:#64748B">Switch between twins or toddler + newborn logs effortlessly.</div>
                      </div>
                    </div>
                    <span style="padding:4px 10px;border-radius:99px;background:#ECFDF5;color:#059669;font-size:12px;font-weight:700">SHIPPED IN v1.3.1</span>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c67",
      "n": 67,
      "name": "Feedback Resolution SLA & Velocity Ticker",
      "group": "feedbackkit",
      "tagline": "Metrics widget highlighting median turnaround time (Median Bug Fix Time: 42 minutes)",
      "concept": "Proves the unprecedented speed of pairing human developers with autonomous coding agents. A live metric widget displays real resolution stats: 'Median time from user report to automated PR: 42 minutes \u00b7 88% verification rate'.",
      "moves": [
            "Resolution velocity ribbon: Median Triage Time, Median PR Creation Time, Reporter Verification Rate",
            "Displays active autonomous agent runner health",
            "Cites real recent turnaround examples from git commit history",
            "Demonstrates the power of the FeedbackKit dogfooding loop"
      ],
      "palette": [
            [
                  "Velocity Blue",
                  "#2F5BEA"
            ],
            [
                  "Speed Emerald",
                  "#10B981"
            ],
            [
                  "Metric Card",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Velocity Telemetry",
            "Effort": "S",
            "Needs": "Turnaround time calculations in kit"
      },
      "spec": {
            "today": [
                  "No resolution velocity metrics shown on the public site"
            ],
            "proposed": [
                  "Live velocity ticker showing median agent bug fix turnaround times"
            ],
            "files": [
                  "pages/status.md",
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/SlaTicker.vue"
            ],
            "risks": [
                  "Base metrics on real GitHub issue closed timestamps"
            ],
            "verify": [
                  "Ticker calculates and displays real median resolution times"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Autonomous Agent Resolution Velocity</h2></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="font-size:26px;font-weight:800;color:#2F5BEA">42 min</div>
                    <div style="font-weight:700;font-size:13px;margin:2px 0">Median Report-to-PR</div>
                    <div style="font-size:11.5px;color:#64748B">Automated agent triage, build and PR creation</div>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="font-size:26px;font-weight:800;color:#10B981">88.4%</div>
                    <div style="font-weight:700;font-size:13px;margin:2px 0">Verified First-Shot</div>
                    <div style="font-size:11.5px;color:#64748B">Reporters confirmed fixed in next build</div>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="font-size:26px;font-weight:800;color:#6366F1">142</div>
                    <div style="font-weight:700;font-size:13px;margin:2px 0">Agent PRs Merged</div>
                    <div style="font-size:11.5px;color:#64748B">Autonomous fixes verified by team review</div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c68",
      "n": 68,
      "name": "Dogfooding Hall of Fame",
      "group": "feedbackkit",
      "tagline": "Recognition showcase celebrating community reporters whose reports triggered fixes",
      "concept": "Celebrates user community contributions. A tasteful 'Hall of Fame' section highlights community members who reported bugs or suggested key features that were resolved by the team and autonomous agents, building immense goodwill.",
      "moves": [
            "Avatar mosaic of acknowledged community beta testers and reporters",
            "Displays quote excerpt from their original report and resulting commit SHA",
            "Opt-in attribution honoring reporter anonymity preferences",
            "Special 'Pioneer Contributor' digital badge awarded on verified fix"
      ],
      "palette": [
            [
                  "Gold Star",
                  "#F59E0B"
            ],
            [
                  "Card Surface",
                  "#FFFFFF"
            ],
            [
                  "Text Slate",
                  "#475569"
            ]
      ],
      "facts": {
            "Type": "Community Recognition",
            "Effort": "S",
            "Needs": "Hall of fame array in kit"
      },
      "spec": {
            "today": [
                  "No public recognition of beta testers who report issues"
            ],
            "proposed": [
                  "Dogfooding Hall of Fame section celebrating reporters whose bugs were resolved"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/HallOfFame.vue"
            ],
            "risks": [
                  "Always respect reporter privacy by using handles or pseudonyms"
            ],
            "verify": [
                  "Hall of fame renders cards highlighting user reports and merged PR links"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>FeedbackKit Dogfooding Hall of Fame</h2></div>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                      <div style="width:36px;height:36px;border-radius:50%;background:#F59E0B;display:grid;place-items:center;color:#fff;font-weight:800">★</div>
                      <div><b>@sarah_parent</b> · Verified Wee Hours 3am Voice Fix</div>
                    </div>
                    <p style="font-size:13px;color:#64748B;margin:0">"Reported background noise cancellation issue at 3am; fixed by agent in Build 92."</p>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                      <div style="width:36px;height:36px;border-radius:50%;background:#F59E0B;display:grid;place-items:center;color:#fff;font-weight:800">★</div>
                      <div><b>@hiker_dan</b> · Verified Waypack Offline Tile Fix</div>
                    </div>
                    <p style="font-size:13px;color:#64748B;margin:0">"Reported mountain contour zoom glitch; agent PR #82 merged within 1 hour."</p>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c69",
      "n": 69,
      "name": "Client-Side Redaction & Privacy Simulator",
      "group": "feedbackkit",
      "tagline": "Visual simulation showing how auth headers, passwords, and PII are redacted client-side",
      "concept": "Overcomes user hesitation to submit feedback screenshots. An interactive simulator visualizes the automatic client-side scrubbing pipeline: Bearer tokens, email addresses, and passwords are blacked out locally before bytes leave the browser.",
      "moves": [
            "Before-and-after interactive slider showing raw report vs redacted report",
            "Highlights automatic regex redaction of Bearer tokens, API keys, and email addresses",
            "Affirms zero screenshot uploading without explicit user consent",
            "Explains end-to-end encryption in transit to FeedbackKit Supabase backend"
      ],
      "palette": [
            [
                  "Redact Red",
                  "#EF4444"
            ],
            [
                  "Secure Green",
                  "#10B981"
            ],
            [
                  "Shield Slate",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Privacy & Security Transparency",
            "Effort": "S",
            "Needs": "Redaction visualizer component"
      },
      "spec": {
            "today": [
                  "Privacy sanitization occurs in SDK code but is not explained on the site"
            ],
            "proposed": [
                  "Visual simulation demonstrating client-side PII and secret redaction"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/RedactionDemo.vue"
            ],
            "risks": [
                  "Accurately demonstrate the real redaction regexes used in feedbackkit-web"
            ],
            "verify": [
                  "Slider demonstrates token being masked from Bearer eyJ... to [REDACTED]"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Zero Secret Leakage: Client-Side Redaction</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <span style="font-size:12px;font-weight:700;color:#10B981">✓ AUTOMATIC CLIENT-SIDE SCRUBBING</span>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-family:monospace;font-size:12px">
                    <div style="padding:12px;border-radius:8px;background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B">
                      <b>Raw Device Console (Before):</b><br>
                      Authorization: Bearer eyJhbGciOi...<br>
                      User Email: john.doe@example.com
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46">
                      <b>Scrubbed Payload (After):</b><br>
                      Authorization: [REDACTED_AUTH_TOKEN]<br>
                      User Email: [REDACTED_EMAIL]
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c70",
      "n": 70,
      "name": "Live Autonomous Agent Console Log Streamer",
      "group": "feedbackkit",
      "tagline": "Read-only streaming terminal displaying real-time agent verification and linting outputs",
      "concept": "Provides thrilling proof of autonomous engineering. A simulated streaming console in the documentation shows real-time terminal output as an agent runs tests: `running cargo test... passed`, `generating PR diff... done`, `posting verification request... ok`.",
      "moves": [
            "Streaming monospace terminal window with subtle cursor blink",
            "Displays real-time logs from GitHub Actions agent runner (`feedbackkit-agent.yml`)",
            "Color-coded log lines: Cyan (Tool invocation), Green (Test passing), Yellow (Lint warning)",
            "Toggle between live stream and historical run archives"
      ],
      "palette": [
            [
                  "Console Bg",
                  "#090D16"
            ],
            [
                  "Log Green",
                  "#34D399"
            ],
            [
                  "Log Cyan",
                  "#38BDF8"
            ]
      ],
      "facts": {
            "Type": "Live Agent Telemetry",
            "Effort": "M",
            "Needs": "Terminal log streamer simulator"
      },
      "spec": {
            "today": [
                  "Agent execution logs only accessible to repository administrators in GitHub Actions"
            ],
            "proposed": [
                  "Public read-only streaming log viewer showcasing autonomous agent execution"
            ],
            "files": [
                  "pages/feedbackkit.md",
                  "pages/.vitepress/theme/components/AgentLogStreamer.vue"
            ],
            "risks": [
                  "Strictly scrub all API keys and environment variables before streaming logs"
            ],
            "verify": [
                  "Terminal streams realistic test execution and PR generation output"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Autonomous Agent Runner (Live Stream)</h2></div>
                <div style="border-radius:12px;background:#090D16;color:#C9D1D9;border:1px solid #1E293B;overflow:hidden;font-family:monospace;font-size:12px">
                  <div style="padding:8px 14px;background:#131B2E;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1E293B">
                    <span style="color:#38BDF8">● Runner: Antigravity-SelfHosted-MacStudio</span>
                    <span style="font-size:11px;color:#94A3B8">Task: issue-138-triage</span>
                  </div>
                  <div style="padding:14px;line-height:1.6">
                    <div style="color:#94A3B8">[10:42:01] Ingested FeedbackKit ticket #138 (Waypack)</div>
                    <div style="color:#38BDF8">[10:42:04] Tool invoke: read_file(path: 'trip_card.dart')</div>
                    <div style="color:#38BDF8">[10:42:08] Tool invoke: edit_file(target: 'hashTitle', replacement: 'trip.accent')</div>
                    <div style="color:#34D399">[10:42:15] Executed: flutter test -- 42 passed, 0 failed</div>
                    <div style="color:#34D399">[10:42:21] Opened PR #88 on github.com/tianhaoz95/hejitech-apps</div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
// ── Round 2 (mobile): the shortlisted hero at phone width
{
      id: "c106",
      n: 106,
      round: 2,
      group: "mobile",
      name: "Shortlist Hero on a Phone",
      tagline: "How 101's persona · search · dock hero folds into 390px without hover",
      concept: "The shortlisted hero ideas all assume a desktop (hover magnification, ⌘K, number keys). This is their phone layout: the persona switch becomes a full-width segmented control, the search field stays full width and opens the palette as a bottom sheet, and the dock becomes a labelled 4×2 grid. It is the mobile half of 101/102, reviewable on its own.",
      moves: [
        "Persona: full-width two-segment control, 44px tall",
        "Search: full-width field; opens the palette as a bottom sheet with the keyboard up and results above it",
        "Dock → 4×2 grid of 56px icons with names; tap scrolls to the card",
        "No key hints (1–8, ⌘K) on touch: `@media (hover: none)` hides them",
      ],
      palette: [["Brand", "#2F5BEA"], ["Sheet", "#FFFFFF"], ["Ink", "#0F172A"]],
      facts: { Type: "Responsive layout for 101/102/103", Effort: "S (with 101)", Needs: "Nothing beyond 101–103" },
      spec: {
        today: ["VitePress default hero stacks: title, tagline, two buttons, image below; app cards one per row"],
        proposed: ["custom.css breakpoints at 640px: persona full width, dock grid(4), palette as bottom sheet (position fixed, bottom 0, max-height 80vh)"],
        files: ["pages/.vitepress/theme/custom.css", "pages/.vitepress/theme/HeroDock.vue", "pages/.vitepress/theme/CommandPalette.vue"],
        risks: ["Bottom sheet + iOS keyboard: use visualViewport to keep the input above the keyboard"],
        verify: ["On the attached iPhone (Safari): no horizontal scroll at 390px, every tap target ≥ 44px, sheet input visible with the keyboard up"],
      },
      render: ({ dark }) => KIT.r2PhoneHero({ dark, dock: true, search: true, persona: true }),
      views: [
        { name: "Hero (light)", frame: "phone", render: () => KIT.r2PhoneHero({ dark: false, dock: true, search: true, persona: true }) },
        { name: "Palette as a bottom sheet (dark)", frame: "phone", dark: true, render: () => KIT.r2PhoneSheet({ dark: true }) },
      ],
    },
{
      "id": "c71",
      "n": 71,
      "name": "Bottom Sheet Mobile Navigation",
      "group": "mobile",
      "tagline": "Modern thumb-friendly bottom navigation bar replacing the unreachable top hamburger menu",
      "concept": "Radically improves smartphone usability. On modern tall phones (390x844), top hamburger menus require awkward hand gymnastics. This replaces the top drawer with an ergonomic bottom navigation sheet with 1-thumb reach.",
      "moves": [
            "Fixed bottom navigation bar with icons: Apps, Monorepo, Status, Search",
            "Thumb-friendly bottom sheet drawer for documentation chapter outlines",
            "Hides top navbar clutter on small viewports",
            "Safe-area inset padding for home indicator bar"
      ],
      "palette": [
            [
                  "Bar Surface",
                  "#FFFFFF"
            ],
            [
                  "Active Blue",
                  "#2F5BEA"
            ],
            [
                  "Border Tint",
                  "#E2E8F0"
            ]
      ],
      "facts": {
            "Type": "Mobile Ergonomics",
            "Effort": "S",
            "Needs": "CSS media query for mobile bar"
      },
      "spec": {
            "today": [
                  "VitePress default mobile top hamburger menu is difficult to reach with one thumb"
            ],
            "proposed": [
                  "Ergonomic bottom navigation sheet positioned cleanly in mobile thumb zone"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/theme/components/MobileBottomBar.vue"
            ],
            "risks": [
                  "Avoid overlapping iOS Safari bottom URL bar and home indicator"
            ],
            "verify": [
                  "On viewports <640px, bottom navigation bar renders with instant thumb touch targets"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="position:relative;padding-bottom:70px">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:16px">
                <div class="h-sec-hd"><h2>The apps (Mobile View)</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 3).map(KIT.defaultAppCard).join("")}</div>
              </div>
              <!-- Bottom Sheet Navigation for Mobile -->
              <div style="position:fixed;bottom:0;left:0;right:0;height:60px;background:${dark ? "#151922" : "#fff"};border-top:1px solid #CBD5E1;display:flex;justify-content:space-around;align-items:center;z-index:90;box-shadow:0 -4px 16px rgba(0,0,0,0.06)">
                <div style="display:flex;flex-direction:column;align-items:center;color:#2F5BEA;font-size:11px;font-weight:700">
                  <span>📱</span><span>Apps</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;color:#64748B;font-size:11px">
                  <span>📦</span><span>Monorepo</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;color:#64748B;font-size:11px">
                  <span>●</span><span>Status</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;color:#64748B;font-size:11px">
                  <span>🔍</span><span>Search</span>
                </div>
              </div>
            </div>
        `
    },
{
      "id": "c72",
      "n": 72,
      "name": "Offline PWA with Service Worker Cache",
      "group": "mobile",
      "tagline": "Full Progressive Web App with offline docs caching, Web App Manifest, and install prompt",
      "concept": "Practices what HEJI preaches: the documentation site itself works offline! A lightweight Service Worker caches all documentation pages, assets, and diagrams, so developers can read guides on airplanes without Wi-Fi.",
      "moves": [
            "Valid Web App Manifest (`manifest.json`) and service worker (`sw.js`)",
            "Automatic pre-caching of all markdown documentation and CSS assets",
            "Offline status chip: '\u26a1 Reading Offline (Full Cache Active)'",
            "'Add to Home Screen' prompt on iOS Safari and Android Chrome"
      ],
      "palette": [
            [
                  "Offline Green",
                  "#10B981"
            ],
            [
                  "PWA Icon",
                  "#2F5BEA"
            ],
            [
                  "Prompt Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Offline Capabilities & PWA",
            "Effort": "S",
            "Needs": "Service worker script in pages/public"
      },
      "spec": {
            "today": [
                  "GitHub Pages site fails to load if device is offline without internet connection"
            ],
            "proposed": [
                  "Full Service Worker offline caching enabling complete offline docs reading"
            ],
            "files": [
                  "pages/public/manifest.json",
                  "pages/public/sw.js",
                  "pages/.vitepress/config.mts"
            ],
            "risks": [
                  "Service worker must invalidate cache promptly on new deployment commit"
            ],
            "verify": [
                  "Disconnecting network in Chrome DevTools still allows smooth browsing of docs"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <div style="background:#ECFDF5;color:#065F46;padding:6px 20px;font-size:12px;font-weight:700;display:flex;justify-content:space-between;align-items:center">
                <span>⚡ <b>PWA Offline Mode:</b> Documentation cached locally. Works with zero network signal.</span>
                <span style="padding:2px 8px;border-radius:4px;background:#10B981;color:#fff">Install PWA 📲</span>
              </div>
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:20px">
                <div class="h-sec-hd"><h2>Offline Documentation Available Anywhere</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c73",
      "n": 73,
      "name": "Native Touch Carousel for Mobile Cards",
      "group": "mobile",
      "tagline": "Fluid horizontal snap-carousel with pagination dots for browsing apps on small screens",
      "concept": "Prevents the infinite vertical scroll fatigue on mobile. On screens narrower than 640px, the 8 app cards transform into a smooth horizontal snap-carousel with pagination dots, letting users swipe smoothly between apps.",
      "moves": [
            "CSS scroll-snap-type: x mandatory for native momentum swipe",
            "Pagination indicator dots showing active card position",
            "Peek next card edge (24px) teasing additional products to swipe to",
            "Full height card consistency across swipe gestures"
      ],
      "palette": [
            [
                  "Snap Border",
                  "#E2E8F0"
            ],
            [
                  "Pagination Dot",
                  "#2F5BEA"
            ],
            [
                  "Surface Bg",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Touch Interaction Design",
            "Effort": "S",
            "Needs": "CSS scroll snap in custom.css"
      },
      "spec": {
            "today": [
                  "All 8 apps stacked vertically in a long 2,400px high scroll list on mobile"
            ],
            "proposed": [
                  "Horizontal snap carousel on mobile reducing vertical scroll height by 70%"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/index.md"
            ],
            "risks": [
                  "Desktop screens must retain multi-column grid layout"
            ],
            "verify": [
                  "Swiping on mobile snaps cleanly between app cards with momentum"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:20px">
                <div class="h-sec-hd"><h2>Swipe to Browse Apps</h2></div>
                <div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:14px;scroll-snap-type:x mandatory">
                  <div class="h-card" style="min-width:280px;scroll-snap-align:center">
                    <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                    <div class="h-card-main"><h4>Waypack</h4><p class="h-card-desc">${KIT.apps[0].desc}</p></div>
                  </div>
                  <div class="h-card" style="min-width:280px;scroll-snap-align:center">
                    <div class="h-card-icon">${KIT.apps[1].iconSvg}</div>
                    <div class="h-card-main"><h4>Wee Hours</h4><p class="h-card-desc">${KIT.apps[1].desc}</p></div>
                  </div>
                  <div class="h-card" style="min-width:280px;scroll-snap-align:center">
                    <div class="h-card-icon">${KIT.apps[2].iconSvg}</div>
                    <div class="h-card-main"><h4>Voxbrief</h4><p class="h-card-desc">${KIT.apps[2].desc}</p></div>
                  </div>
                </div>
                <div style="display:flex;justify-content:center;gap:6px;margin-top:10px">
                  <span style="width:16px;height:6px;border-radius:3px;background:#2F5BEA"></span>
                  <span style="width:6px;height:6px;border-radius:3px;background:#CBD5E1"></span>
                  <span style="width:6px;height:6px;border-radius:3px;background:#CBD5E1"></span>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c74",
      "n": 74,
      "name": "Mobile Code Block Scroll Gradient Snapping",
      "group": "mobile",
      "tagline": "Horizontal code block view with subtle fading edge indicators and sticky copy icon",
      "concept": "Fixes frustrating mobile code clipping. Long commands and code snippets feature subtle right-side gradient fades indicating more code is scrollable, and keep the copy icon floating stickily on top so it never scrolls out of view.",
      "moves": [
            "Soft fading shadow mask on right edge of horizontally overflowing code blocks",
            "Sticky copy button that stays visible while scrolling wide code snippets",
            "Horizontal touch scroll snapping for line clarity",
            "Monospace font size scaled to 12.5px for comfortable readability without line wrap"
      ],
      "palette": [
            [
                  "Code Dark",
                  "#0D1117"
            ],
            [
                  "Fade Gradient",
                  "rgba(13,17,23,0)"
            ],
            [
                  "Copy Button",
                  "#238636"
            ]
      ],
      "facts": {
            "Type": "Mobile Code UX",
            "Effort": "S",
            "Needs": "CSS mask-image in custom.css"
      },
      "spec": {
            "today": [
                  "Mobile code blocks overflow awkwardly or force ugly mid-word wrapping"
            ],
            "proposed": [
                  "Smooth edge gradient fade and sticky copy button on mobile code blocks"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Ensure sticky copy button doesn't obscure the end of long code lines"
            ],
            "verify": [
                  "Long terminal commands show right fade mask and allow smooth horizontal touch scroll"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:20px">
                <div class="h-sec-hd"><h2>Mobile Code Block Demonstration</h2></div>
                <div style="border-radius:12px;background:#0D1117;border:1px solid #30363D;position:relative;overflow:hidden">
                  <button style="position:absolute;top:10px;right:10px;padding:4px 8px;border-radius:6px;background:#238636;color:#fff;border:0;font-size:11px;font-weight:700;z-index:10">Copy</button>
                  <div style="padding:16px;color:#C9D1D9;font-family:monospace;font-size:12px;overflow-x:auto;white-space:nowrap;padding-right:60px">
                    curl -fsSL https://tianhaoz95.github.io/hejitech-apps/scripts/install.sh | bash --project=waypack --release=latest
                  </div>
                  <div style="position:absolute;top:0;right:0;bottom:0;width:30px;background:linear-gradient(to right, transparent, #0D1117);pointer-events:none"></div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c75",
      "n": 75,
      "name": "Dynamic Island & Safe Area Inset Support",
      "group": "mobile",
      "tagline": "Seamless CSS env(safe-area-inset-top) padding for iPhone Dynamic Island and home bar",
      "concept": "Provides native iOS polish. Adds proper `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` rules so fixed headers never clip behind the iPhone Dynamic Island or camera notch, and bottom actions clear the iOS swipe home indicator.",
      "moves": [
            "Configures viewport meta: `viewport-fit=cover` in `config.mts`",
            "CSS padding rules utilizing `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`",
            "Floating FeedbackKit button repositions automatically above the home bar",
            "Clean edge-to-edge color bleeds in Safari address bar"
      ],
      "palette": [
            [
                  "Brand Blue",
                  "#2F5BEA"
            ],
            [
                  "Safe Area",
                  "#000000"
            ],
            [
                  "Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "iOS Hardware Polish",
            "Effort": "S",
            "Needs": "Viewport meta tag update in config.mts"
      },
      "spec": {
            "today": [
                  "Site lacks viewport-fit=cover, causing white bars or clipping on notched iPhones"
            ],
            "proposed": [
                  "Full safe-area-inset support ensuring edge-to-edge styling on iPhone 15/16"
            ],
            "files": [
                  "pages/.vitepress/config.mts",
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Test across both notched and notchless mobile viewports"
            ],
            "verify": [
                  "Top header clears Dynamic Island without content clipping"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="padding-top:24px">
              <!-- Simulated Dynamic Island -->
              <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);width:110px;height:28px;border-radius:20px;background:#000;z-index:99;display:grid;place-items:center;color:#fff;font-size:10px">
                ● Dynamic Island
              </div>
              <header class="h-nav" style="padding-top:18px">
                <span class="h-title">HEJI Apps (Safe Area Cleared)</span>
              </header>
              <div class="h-apps-section" style="padding-top:20px">
                <div class="h-sec-hd"><h2>Pixel-Perfect Notch Adaptation</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 2).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c76",
      "n": 76,
      "name": "Subtle Web Haptic Feedback",
      "group": "mobile",
      "tagline": "Optional vibration triggers (navigator.vibrate) on tab clicks, copy actions, and theme switch",
      "concept": "Makes web buttons feel tangible. On supported Android and web devices, clicking the dark mode toggle, copying a code block, or shortlisting a candidate emits a crisp 10ms micro-vibration via the Web Vibration API.",
      "moves": [
            "Lightweight haptic helper: `navigator.vibrate?.(10)` on button clicks",
            "Instant tactile confirmation when copying commands or clicking tabs",
            "Respects system accessibility settings and reduced motion preferences",
            "Zero overhead when running on desktop or unsupported devices"
      ],
      "palette": [
            [
                  "Haptic Violet",
                  "#8B5CF6"
            ],
            [
                  "Success Green",
                  "#10B981"
            ],
            [
                  "Button Bg",
                  "#EEF2FF"
            ]
      ],
      "facts": {
            "Type": "Tactile Sensory UX",
            "Effort": "S",
            "Needs": "navigator.vibrate API check"
      },
      "spec": {
            "today": [
                  "Interactions provide visual feedback only with zero tactile haptics"
            ],
            "proposed": [
                  "Subtle 10ms haptic feedback triggers on copy buttons, tabs, and theme toggle"
            ],
            "files": [
                  "pages/.vitepress/theme/index.ts",
                  "pages/.vitepress/theme/utils/haptics.ts"
            ],
            "risks": [
                  "Keep vibration duration strictly under 15ms to avoid being intrusive"
            ],
            "verify": [
                  "Tapping 'Copy Command' triggers subtle 10ms physical vibration on mobile"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Web Haptics Demonstration</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;text-align:center">
                  <div style="font-size:28px;margin-bottom:8px">📳</div>
                  <h4 style="margin:0 0 6px">Physical Haptic Feedback on Tap</h4>
                  <p style="font-size:13px;color:#64748B;margin:0 0 14px">Tap button to test 10ms tactile confirmation via navigator.vibrate().</p>
                  <button class="h-btn-pri" style="padding:10px 20px">Simulate Haptic Tap</button>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c77",
      "n": 77,
      "name": "Floating 'Back to Top' Progress Ring",
      "group": "mobile",
      "tagline": "Floating circular button showing scroll percentage ring and smooth 1-tap jump to top",
      "concept": "Solves long mobile scroll fatigue. As users scroll through extensive monorepo docs, a compact circular button appears in the bottom right corner showing a circular SVG stroke indicating scroll progress (e.g. 75%). Tapping smoothly scrolls back to the top.",
      "moves": [
            "Circular floating action button with SVG progress ring",
            "Appears smoothly after user scrolls 300px down",
            "Shows exact scroll percentage (e.g. 64%) or upward chevron",
            "Smooth animated scroll behavior: `window.scrollTo({ top: 0, behavior: 'smooth' })`"
      ],
      "palette": [
            [
                  "Ring Brand",
                  "#2F5BEA"
            ],
            [
                  "Ring Track",
                  "#CBD5E1"
            ],
            [
                  "Button Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Scroll Ergonomics",
            "Effort": "S",
            "Needs": "Scroll progress component in Vue"
      },
      "spec": {
            "today": [
                  "Users must manually swipe dozens of times to return to the top on mobile"
            ],
            "proposed": [
                  "Floating circular scroll progress ring button with 1-tap return to top"
            ],
            "files": [
                  "pages/.vitepress/theme/components/ScrollTopRing.vue",
                  "pages/.vitepress/theme/Layout.vue"
            ],
            "risks": [
                  "Position button carefully so it doesn't block FeedbackKit FAB button"
            ],
            "verify": [
                  "Scrolling document updates circular stroke; clicking jumps smoothly to top"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="position:relative">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Long-Form Reading (Scroll Ring Active)</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              <!-- Floating Scroll Top Progress Ring -->
              <div style="position:fixed;bottom:80px;right:24px;width:44px;height:44px;border-radius:50%;background:${dark ? "#1E293B" : "#fff"};box-shadow:0 4px 14px rgba(0,0,0,0.15);display:grid;place-items:center;cursor:pointer;z-index:90">
                <svg width="44" height="44" viewBox="0 0 44 44" style="position:absolute;transform:rotate(-90deg)">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#E2E8F0" stroke-width="3"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#2F5BEA" stroke-width="3" stroke-dasharray="113" stroke-dashoffset="40"/>
                </svg>
                <span style="font-size:16px;color:#2F5BEA">↑</span>
              </div>
            </div>
        `
    },
{
      "id": "c78",
      "n": 78,
      "name": "Instant Web Demo Launcher on Mobile",
      "group": "mobile",
      "tagline": "Direct App Clip or mobile web launcher button on mobile app cards for zero-install preview",
      "concept": "Eliminates installation friction on smartphones. For apps with static web demos (`projects/voxbrief/site/`, `projects/toddlercam/site/`), mobile cards feature a prominent 'Try Instant Web Demo' button letting visitors test the app immediately in Mobile Safari.",
      "moves": [
            "'Try Instant Demo' action button on applicable app cards",
            "Opens lightweight static web demo with zero download or installation",
            "Displays 'Runs 100% on device in Safari' trust badge",
            "Smooth transition back to docs after demo session"
      ],
      "palette": [
            [
                  "Instant Green",
                  "#10B981"
            ],
            [
                  "Button Tint",
                  "#ECFDF5"
            ],
            [
                  "Card Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Zero-Install Demo UX",
            "Effort": "S",
            "Needs": "Linkage to projects/*/site/"
      },
      "spec": {
            "today": [
                  "Mobile web demo sites exist in projects/*/site/ but are hidden under generic Visit app links"
            ],
            "proposed": [
                  "Explicit 'Try Instant Web Demo' CTA button on mobile cards"
            ],
            "files": [
                  "pages/index.md",
                  "pages/.vitepress/theme/components/AppCard.vue"
            ],
            "risks": [
                  "Ensure mobile demos are optimized for touch interaction"
            ],
            "verify": [
                  "Tapping 'Try Instant Demo' on ToddlerCam opens bouncy dual-camera web demo"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Instant Zero-Install Mobile Demos</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card">
                    <div class="h-card-icon">${KIT.apps[5].iconSvg}</div>
                    <div class="h-card-main">
                      <div class="h-card-top"><h4>ToddlerCam</h4></div>
                      <p class="h-card-desc">Dual camera made for little hands. Try the live interactive web demo right now in Safari.</p>
                      <div class="h-card-actions">
                        <a class="h-btn-pri" style="background:#10B981" href="#">⚡ Launch Instant Demo</a>
                      </div>
                    </div>
                  </div>
                  ${KIT.apps.slice(6, 8).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c79",
      "n": 79,
      "name": "Accessibility & 48px Minimum Touch Target Polish",
      "group": "mobile",
      "tagline": "Rigorous WCAG 2.2 touch target compliance ensuring 48x48px minimum touch padding",
      "concept": "Polishes touch accessibility for real human fingers. Upgrades all buttons, links, tag chips, and close icons to guarantee minimum 48x48px hit areas (using invisible padding), preventing frustrating mis-taps on small smartphone screens.",
      "moves": [
            "48x48px minimum hit target enforcement on all interactive elements via CSS pseudo-elements",
            "Generous 12px gap between adjacent touch targets",
            "High contrast focus outlines for keyboard and switch device accessibility",
            "Eliminates accidental mis-clicks between 'Visit app' and 'Docs \u2192' buttons"
      ],
      "palette": [
            [
                  "Target Blue",
                  "#2F5BEA"
            ],
            [
                  "Focus Ring",
                  "#60A5FA"
            ],
            [
                  "Button Surface",
                  "#F1F5F9"
            ]
      ],
      "facts": {
            "Type": "Accessibility & Touch Target Standards",
            "Effort": "S",
            "Needs": "CSS touch target audit"
      },
      "spec": {
            "today": [
                  "Small tag pills and buttons have <32px touch targets, causing accidental mis-taps"
            ],
            "proposed": [
                  "Full 48px touch target enforcement across all buttons and clickable tags"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Maintain tight visual spacing while expanding invisible hit area"
            ],
            "verify": [
                  "Lighthouse Accessibility score hits 100 on mobile audit"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>48px Accessible Touch Targets</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card">
                    <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                    <div class="h-card-main">
                      <h4>Waypack</h4>
                      <p class="h-card-desc">${KIT.apps[0].desc}</p>
                      <div style="display:flex;gap:12px;margin-top:12px">
                        <button class="h-btn-pri" style="min-height:48px;padding:0 20px;display:flex;align-items:center">Visit app (48px)</button>
                        <button class="h-btn-sec" style="min-height:48px;padding:0 20px;display:flex;align-items:center">Docs (48px)</button>
                      </div>
                    </div>
                  </div>
                  ${KIT.apps.slice(1, 3).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c80",
      "n": 80,
      "name": "Pull-to-Refresh Gesture with Custom Logo Spinner",
      "group": "mobile",
      "tagline": "Native-feeling pull gesture that refreshes live status board data with an animated HEJI spinner",
      "concept": "Brings native mobile fluid gestures to the web portal. On mobile touchscreens, pulling down from the top reveals an animated SVG HEJI logo spinner that fetches fresh status board data from `status.data.ts` without reloading the page.",
      "moves": [
            "Native touchstart/touchmove gesture listener triggering at scroll top",
            "Animated rotating HEJI logo spinner that scales with pull distance",
            "Refreshes live workflow statuses asynchronously without full page reload",
            "Subtle haptic release trigger when pull threshold is reached"
      ],
      "palette": [
            [
                  "Pull Brand",
                  "#2F5BEA"
            ],
            [
                  "Spinner Gold",
                  "#F59E0B"
            ],
            [
                  "Surface",
                  "#F8FAFC"
            ]
      ],
      "facts": {
            "Type": "Mobile Gestural Delight",
            "Effort": "M",
            "Needs": "Touch gesture pull-to-refresh listener"
      },
      "spec": {
            "today": [
                  "Refreshing status board requires hard browser page reload"
            ],
            "proposed": [
                  "Smooth pull-to-refresh gesture updating status board data in-place"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/components/PullToRefresh.vue"
            ],
            "risks": [
                  "Avoid conflicting with native browser pull-to-refresh in Chrome on Android"
            ],
            "verify": [
                  "Pulling down top of page spins HEJI logo and refreshes pipeline timestamps"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <!-- Simulated Pull-to-Refresh Indicator -->
              <div style="display:flex;justify-content:center;padding:12px;background:#EEF2FF;color:#2F5BEA;font-size:12px;font-weight:700;align-items:center;gap:8px">
                <span style="font-size:16px">↻</span> Refreshing live CI workflows &amp; TestFlight builds...
              </div>
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:20px">
                <div class="h-sec-hd"><h2>Status Board (Pull to Refresh Demo)</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c81",
      "n": 81,
      "name": "Interactive Supabase Isolation Diagram",
      "group": "monorepo",
      "tagline": "Visual diagram explaining schema boundaries (waypack.*, weehours.*) and zero cross-schema FKs",
      "concept": "Brings the monorepo's shared backend architectural rules to life (`supabase/GRADUATION.md`). An interactive architecture diagram demonstrates how 8 apps safely share one Postgres instance with schema isolation and zero foreign-key entanglements.",
      "moves": [
            "Interactive schema boundary diagram: `waypack.*`, `weehours.*`, `contempo.*`",
            "Hovering a schema highlights isolation boundaries and graduation readiness checks",
            "Displays CI verification command: `node scripts/check_isolation.mjs`",
            "Explains the financial and maintenance rationale behind the shared monorepo backend"
      ],
      "palette": [
            [
                  "Supabase Green",
                  "#3ECF8E"
            ],
            [
                  "Schema Border",
                  "#2F5BEA"
            ],
            [
                  "Diagram Dark",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Architectural Education",
            "Effort": "S",
            "Needs": "SVG schema isolation diagram in kit"
      },
      "spec": {
            "today": [
                  "Isolation rules explained in markdown text in monorepo.md and supabase/GRADUATION.md"
            ],
            "proposed": [
                  "Interactive visual diagram illustrating database schema isolation boundaries"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/IsolationDiagram.vue"
            ],
            "risks": [
                  "Ensure diagram accurately reflects actual production schema namespaces"
            ],
            "verify": [
                  "Diagram shows isolated schemas for Waypack, Wee Hours, and Contempo"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Postgres Database Schema Isolation</h2></div>
                <div style="padding:24px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="font-size:12px;font-weight:700;color:#3ECF8E;margin-bottom:12px">SHARED SUPABASE PROJECT (ONE INSTANCE)</div>
                  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
                    <div style="padding:16px;border-radius:10px;background:#ECFDF5;border:2px solid #3ECF8E">
                      <b style="color:#065F46">schema waypack.*</b>
                      <div style="font-size:11.5px;color:#047857;margin-top:4px">• trips, bundles, members<br>• Zero external FKs<br>• Isolated backend.env</div>
                    </div>
                    <div style="padding:16px;border-radius:10px;background:#F5F3FF;border:2px solid #8B5CF6">
                      <b style="color:#5B21B6">schema weehours.*</b>
                      <div style="font-size:11.5px;color:#6D28D9;margin-top:4px">• events, children, tokens<br>• Zero external FKs<br>• Isolated backend.env</div>
                    </div>
                    <div style="padding:16px;border-radius:10px;background:#EFF6FF;border:2px solid #3B82F6">
                      <b style="color:#1E40AF">schema contempo.*</b>
                      <div style="font-size:11.5px;color:#1D4ED8;margin-top:4px">• audit_logs, entries<br>• Zero external FKs<br>• Isolated backend.env</div>
                    </div>
                  </div>
                  <div style="margin-top:16px;font-size:12px;color:#64748B">
                    ✓ Verified in CI by <code>scripts/check_isolation.mjs</code> on every commit to main.
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c82",
      "n": 82,
      "name": "Graduation Readiness Calculator",
      "group": "monorepo",
      "tagline": "Interactive widget showing metrics and checklist for an app graduating to its own backend",
      "concept": "Grounded in `supabase/GRADUATION.md`. An interactive calculator displays the graduation readiness checklist: revenue threshold met, zero cross-schema references, isolated Cloudflare Worker, and 1-command database dump verification.",
      "moves": [
            "Checklist of the 4 graduation criteria from `supabase/GRADUATION.md`",
            "Status indicator for each app: 'Waypack: 4/4 Ready' vs 'Wee Hours: 3/4 Ready'",
            "Simulated graduation command preview: `scripts/graduation_check.sh waypack`",
            "Clear explanation of why graduation preserves long-term project independence"
      ],
      "palette": [
            [
                  "Graduation Green",
                  "#10B981"
            ],
            [
                  "Check Slate",
                  "#334155"
            ],
            [
                  "Card Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Monorepo Governance Tool",
            "Effort": "S",
            "Needs": "Graduation criteria checklist in kit"
      },
      "spec": {
            "today": [
                  "Graduation rules described only in markdown in supabase/GRADUATION.md"
            ],
            "proposed": [
                  "Interactive graduation readiness widget on monorepo architecture page"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/GraduationCalculator.vue"
            ],
            "risks": [
                  "Keep checklist criteria strictly aligned with graduation_check.sh"
            ],
            "verify": [
                  "Widget displays passing check for Waypack schema isolation"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Backend Graduation Readiness (Waypack)</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <b>Graduation Checklist: Waypack → Dedicated Backend</b>
                    <span style="padding:4px 10px;border-radius:99px;background:#ECFDF5;color:#059669;font-weight:700;font-size:12px">4 / 4 PASSED</span>
                  </div>
                  <div style="font-size:13px;line-height:1.7;color:#475569">
                    ✓ All tables located strictly in schema <code>waypack.*</code><br>
                    ✓ Zero foreign keys or joins to other product schemas<br>
                    ✓ Dedicated Cloudflare Worker deployed with independent domain<br>
                    ✓ <code>scripts/graduation_check.sh waypack</code> passes with exit code 0
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c83",
      "n": 83,
      "name": "Interactive Monorepo File Tree Explorer",
      "group": "monorepo",
      "tagline": "In-browser interactive file explorer navigating projects/, supabase/, scripts/, and workflows/",
      "concept": "Makes monorepo structure instantly understandable without cloning. An interactive folder tree lets developers click through `projects/waypack/`, `projects/weehours/`, `supabase/migrations/`, and `.github/workflows/`, viewing real file summaries.",
      "moves": [
            "Collapsible folder tree component with custom folder and file icons",
            "Clicking any file reveals a clean 3-line summary of its architectural purpose",
            "Direct link: 'View this file on GitHub'",
            "Search filter input to quickly locate files across all 8 projects"
      ],
      "palette": [
            [
                  "Tree Folder",
                  "#3B82F6"
            ],
            [
                  "Tree File",
                  "#64748B"
            ],
            [
                  "Explorer Dark",
                  "#0D1117"
            ]
      ],
      "facts": {
            "Type": "Repository Exploration",
            "Effort": "S",
            "Needs": "File tree JSON map generated at build"
      },
      "spec": {
            "today": [
                  "Repository layout only explained via plain text ASCII diagram in monorepo.md"
            ],
            "proposed": [
                  "Interactive file tree explorer allowing click-to-expand browsing of monorepo dirs"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/FileTree.vue"
            ],
            "risks": [
                  "Exclude bulky build artifacts like node_modules or derived build dirs"
            ],
            "verify": [
                  "Clicking projects/waypack expands packages, services, and apps subdirectories"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Interactive Monorepo Tree Explorer</h2></div>
                <div style="padding:16px;border-radius:12px;background:#0D1117;color:#C9D1D9;font-family:monospace;font-size:12.5px">
                  <div style="color:#79C0FF">▾ hejitech-apps/</div>
                  <div style="padding-left:18px;color:#79C0FF">▾ projects/</div>
                  <div style="padding-left:36px;color:#A5D6FF">▸ waypack/ <span style="color:#6E7681">(Flutter app, offline SDK, MCP)</span></div>
                  <div style="padding-left:36px;color:#A5D6FF">▸ weehours/ <span style="color:#6E7681">(iOS, watchOS, glasses, Whisper)</span></div>
                  <div style="padding-left:36px;color:#A5D6FF">▸ feedbackkit/ <span style="color:#6E7681">(Multi-platform SDK &amp; agent CLI)</span></div>
                  <div style="padding-left:18px;color:#79C0FF">▾ supabase/migrations/</div>
                  <div style="padding-left:36px">• 20261019_weehours_multiple_children.sql</div>
                  <div style="padding-left:18px;color:#79C0FF">▾ scripts/</div>
                  <div style="padding-left:36px">• cut_release.sh <span style="color:#6E7681">(Standardized monorepo release automation)</span></div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c84",
      "n": 84,
      "name": "Shared Tooling & Release Scripts Showcase",
      "group": "monorepo",
      "tagline": "Deep-dive cards on cut_release.sh, check_isolation.mjs, and pages_sync.mjs",
      "concept": "Grounded in `scripts/cut_release.sh` and `scripts/check_isolation.mjs`. Showcases the core scripts that keep the monorepo healthy. Explains how `cut_release.sh` enforces identical versioning across surfaces and refuses dirty or CI-red releases.",
      "moves": [
            "Feature cards for the top 3 scripts: `cut_release.sh`, `check_isolation.mjs`, `pages_sync.mjs`",
            "Copyable CLI invocation examples with simulated terminal outputs",
            "Explains the safety rails preventing broken deployments",
            "Links to script source code on GitHub"
      ],
      "palette": [
            [
                  "Script Slate",
                  "#0F172A"
            ],
            [
                  "Code Green",
                  "#10B981"
            ],
            [
                  "Brand Blue",
                  "#2F5BEA"
            ]
      ],
      "facts": {
            "Type": "DevOps & Release Tooling",
            "Effort": "S",
            "Needs": "Script showcase cards in kit"
      },
      "spec": {
            "today": [
                  "Script usage rules documented only in AGENTS.md / CLAUDE.md"
            ],
            "proposed": [
                  "Dedicated documentation showcase explaining shared monorepo scripts"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/ScriptShowcase.vue"
            ],
            "risks": [
                  "Keep CLI flags accurately synchronized with scripts/cut_release.sh"
            ],
            "verify": [
                  "Card accurately explains cut_release.sh --dry-run and CI-red safety guards"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Monorepo Core Release &amp; CI Scripts</h2></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <b style="font-size:14px;color:#2F5BEA">scripts/cut_release.sh</b>
                    <p style="font-size:12.5px;color:#64748B;margin:6px 0 10px">Guarantees unified versioning across iOS, Mac, and web; refuses to release from dirty or CI-red main.</p>
                    <code style="font-size:11px;background:#F1F5F9;padding:2px 6px;border-radius:4px">cut_release.sh waypack minor</code>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <b style="font-size:14px;color:#2F5BEA">check_isolation.mjs</b>
                    <p style="font-size:12.5px;color:#64748B;margin:6px 0 10px">Validates zero cross-schema references across database migrations before any PR merges.</p>
                    <code style="font-size:11px;background:#F1F5F9;padding:2px 6px;border-radius:4px">npm test check_isolation</code>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <b style="font-size:14px;color:#2F5BEA">pages_sync.mjs</b>
                    <p style="font-size:12.5px;color:#64748B;margin:6px 0 10px">Synchronizes each project's docs and demo sites into the unified VitePress GitHub Pages build.</p>
                    <code style="font-size:11px;background:#F1F5F9;padding:2px 6px;border-radius:4px">npm run pages:build</code>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c85",
      "n": 85,
      "name": "PolyForm Perimeter License Interactive Guide",
      "group": "monorepo",
      "tagline": "Plain-English interactive explainer for PolyForm Perimeter non-commercial vs commercial usage",
      "concept": "Grounded in `LICENSE` (PolyForm Perimeter License 1.0.1). Provides transparent licensing clarity: source code is fully open for personal exploration, developer learning, and non-competitive usage, while protecting against commercial SaaS copying.",
      "moves": [
            "Interactive Q&A accordion: 'Can I read the code? (Yes)', 'Can I run it locally? (Yes)'",
            "Clear plain-English summary of the Perimeter non-compete clause",
            "Direct link to full PolyForm Perimeter 1.0.1 license text in repository",
            "Commercial licensing contact link for enterprise re-use inquiries"
      ],
      "palette": [
            [
                  "License Slate",
                  "#1E293B"
            ],
            [
                  "Allowed Green",
                  "#10B981"
            ],
            [
                  "Restricted Red",
                  "#EF4444"
            ]
      ],
      "facts": {
            "Type": "Open Source Licensing Clarity",
            "Effort": "S",
            "Needs": "License explainer component"
      },
      "spec": {
            "today": [
                  "License mentioned only as brief 1-line footer disclaimer"
            ],
            "proposed": [
                  "Interactive guide explaining PolyForm Perimeter License terms in plain English"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/LicenseGuide.vue"
            ],
            "risks": [
                  "Ensure legal precision while maintaining clear non-legalese explanations"
            ],
            "verify": [
                  "Guide clearly explains that non-commercial developer usage is 100% permitted"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Licensing: PolyForm Perimeter 1.0.1</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="font-weight:700;font-size:15px;margin-bottom:12px">Available Source Code with Perimeter Protection</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px">
                    <div style="padding:12px;border-radius:8px;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46">
                      <b>✓ YOU CAN:</b><br>
                      • Read, inspect, and fork all source code<br>
                      • Run and build apps locally on your devices<br>
                      • Study architecture, ML models, and MCP tools
                    </div>
                    <div style="padding:12px;border-radius:8px;background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B">
                      <b>✕ YOU CANNOT:</b><br>
                      • Host commercial SaaS products that compete directly with HEJI Apps
                    </div>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c86",
      "n": 86,
      "name": "'How to Add a Project' Interactive Wizard",
      "group": "monorepo",
      "tagline": "Visual step-by-step checklist based on the heji-new-project skill and monorepo standards",
      "concept": "Grounded in `.claude/skills/heji-new-project/`. An interactive wizard guides engineers through adding a new product: scaffold directory in `projects/<name>/`, create schema in `supabase/schemas/`, configure `release.env`, and register in `pages.json`.",
      "moves": [
            "4-step checklist stepper: Directory -> Database Schema -> Release Env -> Docs Sync",
            "Command snippets: `heji-new-project <name>`",
            "Automated validation checklist ensuring isolation check passes before first commit",
            "Explains symlink creation for Codex, Antigravity, and Claude Code"
      ],
      "palette": [
            [
                  "Step Blue",
                  "#2F5BEA"
            ],
            [
                  "Wizard Done",
                  "#10B981"
            ],
            [
                  "Card Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Developer Onboarding & Scaffolding",
            "Effort": "S",
            "Needs": "Wizard stepper in kit"
      },
      "spec": {
            "today": [
                  "New project setup instructions located only in repository README and skills"
            ],
            "proposed": [
                  "Interactive wizard on documentation site guiding new product scaffolding"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/NewProjectWizard.vue"
            ],
            "risks": [
                  "Keep steps synchronized with AGENTS.md rules"
            ],
            "verify": [
                  "Wizard steps accurately outline projects/<name>/ layout and release.env setup"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Adding a New App to the Monorepo</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                  <div style="display:flex;gap:12px;margin-bottom:16px">
                    <span style="padding:4px 10px;border-radius:6px;background:#2F5BEA;color:#fff;font-size:12px;font-weight:700">1. Scaffold</span>
                    <span style="padding:4px 10px;border-radius:6px;background:#E2E8F0;font-size:12px;font-weight:600">2. Supabase Schema</span>
                    <span style="padding:4px 10px;border-radius:6px;background:#E2E8F0;font-size:12px;font-weight:600">3. Release Env</span>
                    <span style="padding:4px 10px;border-radius:6px;background:#E2E8F0;font-size:12px;font-weight:600">4. CI &amp; Pages Sync</span>
                  </div>
                  <div style="font-size:13px;line-height:1.6;color:#475569">
                    Run the automated monorepo skill: <code>/heji-new-project &lt;name&gt;</code>.<br>
                    Scaffolds isolated directory at <code>projects/&lt;name&gt;/</code>, assigns free port, wires TestFlight secrets, and registers with GitHub Pages.
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c87",
      "n": 87,
      "name": "Coding Agent Pair-Programming Architecture",
      "group": "monorepo",
      "tagline": "Diagram showing how Google Antigravity, Claude Code, and Codex pair with the monorepo",
      "concept": "Grounded in `AGENTS.md` and repository skill symlinks. Renders an architectural breakdown showing how Google Antigravity, Claude Code, and Codex share `.agents/skills/` symlinks and pair autonomously with human developers on issues and releases.",
      "moves": [
            "Architecture diagram: Human Lead Developer <-> Agent Skills Symlinks <-> Autonomous CI Runners",
            "Explains the unified `.agents/skills/` symlink pattern",
            "Details how FeedbackKit issues wake up Antigravity runners automatically in CI",
            "Cites safety rules: No release from dirty main, no cross-schema database leakage"
      ],
      "palette": [
            [
                  "Agent Violet",
                  "#8B5CF6"
            ],
            [
                  "Human Amber",
                  "#F59E0B"
            ],
            [
                  "Symlink Slate",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "AI Pair Programming Architecture",
            "Effort": "S",
            "Needs": "Pair programming diagram in kit"
      },
      "spec": {
            "today": [
                  "Agent pairing architecture documented only in AGENTS.md for agents to read"
            ],
            "proposed": [
                  "Public visual architectural guide explaining human-agent pair programming model"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/AgentPairingDiagram.vue"
            ],
            "risks": [
                  "Present agents as disciplined pair-programming partners, not uncontrollable bots"
            ],
            "verify": [
                  "Diagram illustrates shared symlinks between .claude/skills and .agents/skills"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Human-Agent Pair Programming Workflow</h2></div>
                <div style="padding:24px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;text-align:center">
                  <div style="display:flex;justify-content:center;gap:24px;align-items:center;font-size:13px;font-weight:700">
                    <span style="padding:10px 16px;border-radius:10px;background:#FEF3C7;color:#D97706">👤 Human Engineer</span>
                    <span>⇄</span>
                    <span style="padding:10px 16px;border-radius:10px;background:#EEF2FF;color:#2F5BEA">📁 Shared .agents/skills/</span>
                    <span>⇄</span>
                    <span style="padding:10px 16px;border-radius:10px;background:#F5F3FF;color:#7C3AED">🤖 Antigravity / Claude Code</span>
                  </div>
                  <div style="margin-top:16px;font-size:12.5px;color:#64748B">
                    Every skill in <code>.claude/skills/heji-*</code> is symlinked into <code>.agents/skills/</code> so all coding assistants share identical tooling.
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c88",
      "n": 88,
      "name": "Cross-Platform Test & Build Matrix",
      "group": "monorepo",
      "tagline": "Graphic showing macOS, Ubuntu, iOS, watchOS, and Android CI pipelines in GitHub Actions",
      "concept": "Visualizes the comprehensive test matrix running across the monorepo. Displays real-time test matrix health covering Ubuntu Linux test runners, macOS native Apple Silicon signing runners, and connected physical device testing.",
      "moves": [
            "Test matrix graphic: Ubuntu 24.04 (Node/Rust/Web), macOS 14 (Xcode/iOS/watchOS), Android CI",
            "Indicates physical device test preference: `xcrun devicectl list devices`",
            "Passing test count badges across all 8 projects",
            "Average build duration breakdown"
      ],
      "palette": [
            [
                  "Matrix Green",
                  "#10B981"
            ],
            [
                  "Runner Slate",
                  "#1E293B"
            ],
            [
                  "Apple Tint",
                  "#000000"
            ]
      ],
      "facts": {
            "Type": "CI/CD Test Matrix",
            "Effort": "S",
            "Needs": "CI test matrix table in kit"
      },
      "spec": {
            "today": [
                  "Workflows listed as raw YAML files in .github/workflows/"
            ],
            "proposed": [
                  "Visual cross-platform CI runner matrix on status page"
            ],
            "files": [
                  "pages/status.md",
                  "pages/.vitepress/theme/components/CiMatrix.vue"
            ],
            "risks": [
                  "Keep runner platform versions updated when GitHub Actions updates images"
            ],
            "verify": [
                  "Matrix lists Ubuntu Linux and macOS Apple Silicon runner environments"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("status")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Cross-Platform GitHub Actions Matrix</h2></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <b style="color:#2F5BEA">macOS Apple Silicon</b>
                    <p style="font-size:12.5px;color:#64748B;margin:6px 0 10px">Builds iOS, watchOS, and notarized macOS DMGs with Team Apple certificates.</p>
                    <span style="color:#10B981;font-weight:700;font-size:12px">✓ All 6 Workflows Passing</span>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <b style="color:#2F5BEA">Ubuntu 24.04 Linux</b>
                    <p style="font-size:12.5px;color:#64748B;margin:6px 0 10px">Runs Supabase isolation checks, Node workspaces, VitePress build, and Flutter CI.</p>
                    <span style="color:#10B981;font-weight:700;font-size:12px">✓ All 8 Workflows Passing</span>
                  </div>
                  <div style="padding:18px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1">
                    <b style="color:#2F5BEA">Cloudflare Workers CI</b>
                    <p style="font-size:12.5px;color:#64748B;margin:6px 0 10px">Continuous deployment to global edge network with zero cold start latency.</p>
                    <span style="color:#10B981;font-weight:700;font-size:12px">✓ Deployed to 300+ Cities</span>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c89",
      "n": 89,
      "name": "Zero-Cost Infrastructure Transparency Breakdown",
      "group": "monorepo",
      "tagline": "Transparent table showing hosting costs ($0 GitHub Pages, $0 Cloudflare, $25 Supabase)",
      "concept": "Inspires indie software engineers with extreme infrastructure frugality. A transparent balance sheet demonstrates how HEJI serves 8 high-performance products globally for under $30/month through clever monorepo sharing and zero-cost serverless tiers.",
      "moves": [
            "Monthly infrastructure expense table: GitHub Pages ($0), Cloudflare Workers ($0 Free tier), Supabase ($25)",
            "Cost per active user metric: < $0.002 / month",
            "Explains the architectural choices making extreme frugality possible",
            "Inspires developers building sustainable bootstrapped software"
      ],
      "palette": [
            [
                  "Zero Green",
                  "#10B981"
            ],
            [
                  "Expense Slate",
                  "#64748B"
            ],
            [
                  "Card Bg",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Financial & Operational Transparency",
            "Effort": "S",
            "Needs": "Cost table in kit"
      },
      "spec": {
            "today": [
                  "No operational cost transparency on the website"
            ],
            "proposed": [
                  "Infrastructure cost breakdown table inspiring sustainable indie software architecture"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/CostBreakdown.vue"
            ],
            "risks": [
                  "Clearly explain the threshold at which individual projects graduate to own tiers"
            ],
            "verify": [
                  "Table demonstrates $0 GitHub Pages hosting and shared $25/mo Supabase database"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Infrastructure Cost Transparency (Monthly Run-Rate)</h2></div>
                <div style="border-radius:12px;border:1px solid #CBD5E1;overflow:hidden;background:${dark ? "#151922" : "#fff"}">
                  <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                    <thead>
                      <tr style="background:${dark ? "#1E293B" : "#F8FAFC"};border-bottom:1px solid #CBD5E1;color:#64748B">
                        <th style="padding:10px 14px">INFRASTRUCTURE LAYER</th>
                        <th style="padding:10px 14px">SERVICE PROVIDER</th>
                        <th style="padding:10px 14px">MONTHLY COST</th>
                        <th style="padding:10px 14px">EFFICIENCY STRATEGY</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:10px 14px;font-weight:700">Documentation &amp; Portal</td>
                        <td style="padding:10px 14px">GitHub Pages (VitePress)</td>
                        <td style="padding:10px 14px;color:#10B981;font-weight:700">$0.00</td>
                        <td style="padding:10px 14px">Static site generation via pages.yml</td>
                      </tr>
                      <tr style="border-bottom:1px solid ${dark ? "#232B3B" : "#E2E8F0"}">
                        <td style="padding:10px 14px;font-weight:700">Global Edge API &amp; Sites</td>
                        <td style="padding:10px 14px">Cloudflare Workers</td>
                        <td style="padding:10px 14px;color:#10B981;font-weight:700">$0.00 (Free Tier)</td>
                        <td style="padding:10px 14px">Sub-20ms edge serverless response</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 14px;font-weight:700">Postgres Database</td>
                        <td style="padding:10px 14px">Supabase (Pro)</td>
                        <td style="padding:10px 14px;font-weight:700">$25.00</td>
                        <td style="padding:10px 14px">Shared across all 8 apps with isolated schemas</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c90",
      "n": 90,
      "name": "GitHub Monorepo Star & Activity Pill",
      "group": "monorepo",
      "tagline": "Interactive GitHub badge displaying stars, forks, latest release tag, and commit frequency",
      "concept": "Celebrates open-source community traction. A prominent interactive GitHub pill in the top navbar and hero displays live GitHub stars, latest release tag (`v1.4.2`), and recent commit velocity with an instant star button.",
      "moves": [
            "GitHub repository pill in navbar: Stars count, Forks count, Latest tag",
            "Clicking opens repository in new tab with smooth redirect",
            "Tooltip showing recent contributors and commit author avatars",
            "Star repository micro-interaction with celebratory heart burst"
      ],
      "palette": [
            [
                  "GitHub Black",
                  "#24292F"
            ],
            [
                  "Star Gold",
                  "#E3B341"
            ],
            [
                  "Pill Border",
                  "#D0D7DE"
            ]
      ],
      "facts": {
            "Type": "Open Source Social Proof",
            "Effort": "S",
            "Needs": "GitHub repository metadata API fetch"
      },
      "spec": {
            "today": [
                  "Navbar has simple plain GitHub SVG icon without star counts or release tags"
            ],
            "proposed": [
                  "Interactive GitHub repository pill displaying stars, release tag, and commit count"
            ],
            "files": [
                  "pages/.vitepress/config.mts",
                  "pages/.vitepress/theme/components/GitHubPill.vue"
            ],
            "risks": [
                  "Use build-time cached star counts to avoid GitHub API rate limiting"
            ],
            "verify": [
                  "Pill displays live repository star count and links to GitHub"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <header class="h-nav">
                <div class="h-nav-left"><span class="h-title">HEJI Apps</span></div>
                <div class="h-nav-right">
                  <div style="display:flex;align-items:center;border:1px solid #CBD5E1;border-radius:8px;overflow:hidden;font-size:12px;font-weight:600">
                    <span style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:${dark ? "#1E293B" : "#F8FAFC"}">
                      ${KIT.svgIcons.github} Star Monorepo
                    </span>
                    <span style="padding:4px 8px;background:${dark ? "#151922" : "#fff"};border-left:1px solid #CBD5E1;color:#2F5BEA">★ 428</span>
                  </div>
                </div>
              </header>
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Open Source GitHub Community</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
// ── Round 2 (404): two takes on the shortlisted 94
{
      id: "c107",
      n: 107,
      round: 2,
      group: "polish",
      name: "Helpful 404: Suggest, Search, Report",
      tagline: "94 without the game: the three closest real pages, the search prefilled, and a one-tap broken-link report",
      concept: "The useful half of 94 at the smallest cost. The 404 page ranks the site's real routes by edit distance to the missing path and offers the top three, opens search with the missing words, and lets the visitor report the broken link through the FeedbackKit that is already on every page. The suggestions in this mock are computed live from the 18 routes in today's build.",
      moves: [
        "Top 3 routes by Levenshtein distance to the requested path (computed live in this mock for /waypak and /weehours/decision)",
        "If the best match is 1–2 edits away, it's the big button: 'Go to /waypack/'",
        "Search field prefilled with the path's words (waypak → 'waypak'), opening the site search",
        "'Tell us where you found this link' opens FeedbackKit (presentAndSubmit) with currentScreen = 'Docs - 404 /waypak (from <referrer>)'",
      ],
      palette: [["Brand", "#2F5BEA"], ["Hint", "#EEF2FF"], ["Muted", "#64748B"]],
      facts: { Type: "404 page", Effort: "S", Needs: "Route list at build time (VitePress `siteData` / a routes.data.ts)" },
      spec: {
        today: [
          "VitePress default NotFound ('PAGE NOT FOUND', a quote, 'Take me home'); built to pages/.vitepress/dist/404.html",
          "GitHub Pages already serves 404.html with HTTP 404, so the status-code risk in 94 is already handled",
          "FeedbackKit runs on every page (theme/index.ts), including the 404 route, with currentScreen = 'Docs - <path>'",
        ],
        proposed: [
          "theme/index.ts: `Layout` wraps DefaultTheme.Layout and fills the `not-found` slot with NotFound.vue",
          "routes.data.ts lists every built page (createContentLoader('**/*.md') → url, title); NotFound.vue ranks them by Levenshtein on the path without base",
          "Report button: set FeedbackKit.currentScreen = 'Docs - 404 <path> (from <document.referrer>)', then FeedbackKit.presentAndSubmit({ captureScreenshot: false }); the SDK has no prefilled-message option, so the path travels in currentScreen",
        ],
        files: ["pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/NotFound.vue (new)", "pages/routes.data.ts (new)", "pages/.vitepress/theme/custom.css"],
        risks: ["Paths into a project's static site (/voxbrief/site/…) are separate builds and won't be in the route list; treat a /<project>/site/ prefix as 'go to that site's home'"],
        verify: ["Open /hejitech-apps/waypak on the deployed site: status 404 (curl -I), suggestion /waypack/ first", "/weehours/decision suggests /weehours/decisions"],
      },
      design: [
        {
          kind: "html",
          title: "Suggestions computed from today's routes",
          note: "Levenshtein distance between the requested path and each of the 18 built routes (lower is closer); the mock runs this code.",
          html: KIT.r2SuggestTable(["/waypak", "/weehours/decision", "/monorepos", "/staus"]),
          text: KIT.r2SuggestText(["/waypak", "/weehours/decision", "/monorepos", "/staus"]),
        },
      ],
      render: ({ dark }) => KIT.r2NotFound({ dark, path: "/waypak", doodle: false }),
      views: [
        { name: "/waypak (light)", render: () => KIT.r2NotFound({ dark: false, path: "/waypak", doodle: false }) },
        { name: "/weehours/decision (dark)", dark: true, render: () => KIT.r2NotFound({ dark: true, path: "/weehours/decision", doodle: false }) },
      ],
    },
{
      id: "c108",
      n: 108,
      round: 2,
      group: "polish",
      name: "404 Off the Map, With the Doodle",
      tagline: "94 in full: 107's suggestions plus a small paper-plane doodle that flies to the suggested page",
      concept: "Keeps the delight 94 promised but makes it serve the job: the doodle is a paper plane over a dotted route, and the route ends at the suggested page. Clicking the plane (or the button) flies it there. No separate game, so it can't distract from finding the page.",
      moves: [
        "Inline SVG: dotted route from a '?' pin to the suggested page's app icon; the plane idles along it (CSS offset-path)",
        "Click plane or button → plane finishes the route (600 ms), then navigates; reduced-motion: static drawing, instant navigation",
        "Same ranked suggestions, prefilled search and report link as 107 under the drawing",
      ],
      palette: [["Sky", "#EEF2FF"], ["Route", "#2F5BEA"], ["Pin", "#F59E0B"]],
      facts: { Type: "404 page + illustration", Effort: "S–M", Needs: "Everything 107 needs + one inline SVG" },
      spec: {
        today: ["VitePress default NotFound"],
        proposed: ["107's NotFound.vue with a <PlaneRoute :to=\"best\"/> SVG above the suggestions; the end icon is the matched app's icon from apps.ts, or the HEJI mark for site pages"],
        files: ["pages/.vitepress/theme/NotFound.vue (new)", "pages/.vitepress/theme/PlaneRoute.vue (new)", "pages/routes.data.ts (new)"],
        risks: ["offset-path support is fine in current Safari/Chrome/Firefox; fallback is the static drawing"],
        verify: ["prefers-reduced-motion: no animation; click still navigates"],
      },
      render: ({ dark }) => KIT.r2NotFound({ dark, path: "/waypak", doodle: true }),
    },
{
      "id": "c91",
      "n": 91,
      "name": "Keyboard Shortcut Helper ('?' Overlay Modal)",
      "group": "polish",
      "tagline": "Pressing '?' anywhere reveals a clean modal listing all keyboard navigation shortcuts",
      "concept": "Brings desktop-grade power user discovery. Pressing `?` anywhere on the site pops up a clean modal sheet listing all shortcuts: `Cmd+K` (Search), `j`/`k` (Next/Prev section), `t` (Table of contents), `d` (Toggle dark mode), and `1-8` (Jump to app).",
      "moves": [
            "Global listener for `?` key triggering keyboard shortcut cheatsheet modal",
            "Categorized shortcut columns: Navigation, Search, Reading, and Views",
            "Styled `<kbd>` elements mimicking physical MacBook keys",
            "Dismissible with `ESC` key or backdrop tap"
      ],
      "palette": [
            [
                  "Modal Overlay",
                  "rgba(15,23,42,0.6)"
            ],
            [
                  "Kbd Surface",
                  "#F1F5F9"
            ],
            [
                  "Kbd Border",
                  "#CBD5E1"
            ]
      ],
      "facts": {
            "Type": "Keyboard Accessibility & Discovery",
            "Effort": "S",
            "Needs": "Global keydown '?' listener"
      },
      "spec": {
            "today": [
                  "No shortcut cheatsheet or discovery overlay on the site"
            ],
            "proposed": [
                  "Press '?' modal revealing comprehensive keyboard navigation cheatsheet"
            ],
            "files": [
                  "pages/.vitepress/theme/components/ShortcutModal.vue",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Ignore '?' when user is typing in a search bar or text input"
            ],
            "verify": [
                  "Pressing '?' pops up keyboard shortcut guide modal"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}" style="position:relative">
              ${KIT.nav("apps")}
              <!-- Shortcut Overlay Modal -->
              <div style="position:absolute;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;justify-content:center;padding-top:80px;z-index:99">
                <div style="width:100%;max-width:540px;background:${dark ? "#151922" : "#fff"};border-radius:16px;padding:24px;border:1px solid #CBD5E1;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
                    <h3 style="margin:0;font-size:18px">⌨️ Keyboard Navigation Shortcuts</h3>
                    <kbd style="padding:2px 8px;border-radius:4px;background:#E2E8F0;font-size:11px">ESC</kbd>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px">
                    <div>
                      <div style="font-weight:700;color:#64748B;font-size:11px;margin-bottom:6px">GENERAL</div>
                      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Search catalog</span><kbd>⌘K</kbd></div>
                      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Toggle dark theme</span><kbd>d</kbd></div>
                      <div style="display:flex;justify-content:space-between"><span>Show this cheatsheet</span><kbd>?</kbd></div>
                    </div>
                    <div>
                      <div style="font-weight:700;color:#64748B;font-size:11px;margin-bottom:6px">READING DOCS</div>
                      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Next section</span><kbd>j</kbd></div>
                      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Previous section</span><kbd>k</kbd></div>
                      <div style="display:flex;justify-content:space-between"><span>Toggle outline</span><kbd>t</kbd></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        `
    },
{
      "id": "c92",
      "n": 92,
      "name": "Playful Soundboard of HEJI App Sounds",
      "group": "polish",
      "tagline": "Interactive soundboard playing TinyTouch chimes, ToddlerCam clicks, and Wee Hours chirps",
      "concept": "Celebrates tactile software design. An easter egg soundboard lets visitors tap buttons to play signature soundscapes: TinyTouch pentatonic chords, ToddlerCam camera shutters, and Wee Hours calming voice beeps, synthesized via Web Audio API.",
      "moves": [
            "Grid of sound pads: [Chime C] [Chime E] [Chime G] [Camera Shutter] [Voice Beep]",
            "Web Audio API synthesized waveforms with zero external audio file dependencies",
            "Visual ripple pulse animation on button press",
            "Mute master switch in footer"
      ],
      "palette": [
            [
                  "Pad Pink",
                  "#EC4899"
            ],
            [
                  "Pad Blue",
                  "#3B82F6"
            ],
            [
                  "Pad Amber",
                  "#F59E0B"
            ]
      ],
      "facts": {
            "Type": "Sensory Easter Egg",
            "Effort": "S",
            "Needs": "Web Audio oscillator helper in kit"
      },
      "spec": {
            "today": [
                  "No sound design demonstrated on the site"
            ],
            "proposed": [
                  "Interactive audio soundboard showcasing tactile app sounds"
            ],
            "files": [
                  "pages/monorepo.md",
                  "pages/.vitepress/theme/components/Soundboard.vue"
            ],
            "risks": [
                  "Always respect browser user gesture requirements before playing audio"
            ],
            "verify": [
                  "Tapping pads plays synthetic pentatonic chimes in browser"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("monorepo")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>HEJI Soundboard (Audio Design Easter Egg)</h2></div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
                  <div style="padding:16px;border-radius:12px;background:#FDF2F8;border:2px solid #EC4899;text-align:center;cursor:pointer">
                    <div style="font-size:22px;margin-bottom:4px">🔔</div>
                    <b style="color:#BE185D;font-size:13px">TinyTouch 528Hz</b>
                  </div>
                  <div style="padding:16px;border-radius:12px;background:#EFF6FF;border:2px solid #3B82F6;text-align:center;cursor:pointer">
                    <div style="font-size:22px;margin-bottom:4px">📷</div>
                    <b style="color:#1D4ED8;font-size:13px">ToddlerCam Click</b>
                  </div>
                  <div style="padding:16px;border-radius:12px;background:#F5F3FF;border:2px solid #8B5CF6;text-align:center;cursor:pointer">
                    <div style="font-size:22px;margin-bottom:4px">🎙️</div>
                    <b style="color:#6D28D9;font-size:13px">Wee Hours Chirp</b>
                  </div>
                  <div style="padding:16px;border-radius:12px;background:#FEF3C7;border:2px solid #F59E0B;text-align:center;cursor:pointer">
                    <div style="font-size:22px;margin-bottom:4px">🗺️</div>
                    <b style="color:#B45309;font-size:13px">Waypack Pin Drop</b>
                  </div>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c93",
      "n": 93,
      "name": "View Transitions API Page Morphing",
      "group": "polish",
      "tagline": "CSS View Transitions API for seamless card-to-doc morphing and page navigation",
      "concept": "Eliminates jarring full page flickers. Uses the modern browser View Transitions API (`document.startViewTransition`) so that clicking an app card seamlessly morphs the app icon and title directly into the document header.",
      "moves": [
            "CSS `view-transition-name: app-icon` on app icons and doc headers",
            "Smooth 250ms morph animation between catalog view and documentation page",
            "Graceful fallback to standard instant navigation on unsupported browsers",
            "Automatic zero-motion fallback when prefers-reduced-motion is active"
      ],
      "palette": [
            [
                  "Transition Blue",
                  "#2F5BEA"
            ],
            [
                  "Surface",
                  "#FFFFFF"
            ],
            [
                  "Text Slate",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "Next-Gen Web Motion",
            "Effort": "S",
            "Needs": "document.startViewTransition hook"
      },
      "spec": {
            "today": [
                  "Page transitions cause standard static browser navigation flickers"
            ],
            "proposed": [
                  "Smooth morphing view transitions between catalog cards and doc pages"
            ],
            "files": [
                  "pages/.vitepress/theme/index.ts",
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Check browser support for document.startViewTransition before executing"
            ],
            "verify": [
                  "Clicking Waypack card smoothly expands card icon into document header"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>View Transitions API Active (Seamless Morphing)</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="border:2px solid #2F5BEA;box-shadow:0 8px 24px rgba(47,91,234,0.15)">
                    <div class="h-card-icon" style="view-transition-name:waypack-icon">${KIT.apps[0].iconSvg}</div>
                    <div class="h-card-main">
                      <h4>Waypack (Morph Ready)</h4>
                      <p class="h-card-desc">Clicking morphs icon and title seamlessly into the documentation header.</p>
                      <a class="h-btn-pri" href="#">Docs (View Transition) →</a>
                    </div>
                  </div>
                  ${KIT.apps.slice(1, 4).map(KIT.defaultAppCard).join("")}
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c94",
      "n": 94,
      "name": "Playful 404 Page with Monorepo Doodle & Search",
      "group": "polish",
      "tagline": "Helpful 404 page with smart fuzzy URL suggestion algorithm and interactive offline doodle",
      "concept": "Turns dead ends into delightful discovery. When a visitor lands on an invalid URL, a custom 404 page analyzes the requested path (e.g. `/waypak`), suggests the closest real page (`Did you mean /waypack/?`), and offers a mini offline game.",
      "moves": [
            "Fuzzy URL string distance matcher suggesting intended documentation page",
            "Interactive SVG doodle: animated Waypack paper airplane navigating mountains",
            "One-click search input pre-filled with the missing path segment",
            "FeedbackKit trigger: 'Let us know if a link is broken'"
      ],
      "palette": [
            [
                  "Doodle Blue",
                  "#2F5BEA"
            ],
            [
                  "Doodle Cloud",
                  "#E0F2FE"
            ],
            [
                  "Text Dark",
                  "#0F172A"
            ]
      ],
      "facts": {
            "Type": "404 Error Experience",
            "Effort": "S",
            "Needs": "pages/404.md template enhancement"
      },
      "spec": {
            "today": [
                  "VitePress default 404 page is a plain text 'PAGE NOT FOUND' message"
            ],
            "proposed": [
                  "Playful 404 page with smart URL suggestions and animated monorepo doodle"
            ],
            "files": [
                  "pages/404.md",
                  "pages/.vitepress/theme/NotFound.vue"
            ],
            "risks": [
                  "Ensure 404 page returns proper HTTP 404 status code in GitHub Pages"
            ],
            "verify": [
                  "Visiting /waypak suggests /waypack/ with 1-click jump"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div style="max-width:540px;margin:40px auto;text-align:center;padding:24px">
                <div style="font-size:64px;margin-bottom:12px">🧭</div>
                <h1 style="font-size:32px;margin:0 0 8px">Page Off The Map</h1>
                <p style="font-size:15px;color:#64748B;margin:0 0 20px">We couldn't find the path you requested, but your offline compass is working.</p>
                <div style="padding:14px;border-radius:12px;background:#EEF2FF;border:1px solid #C7D2FE;color:#1E40AF;margin-bottom:20px;font-size:13.5px">
                  💡 <b>Did you mean:</b> <a href="#" style="text-decoration:underline;font-weight:700">/waypack/offline-bundles</a>?
                </div>
                <a class="h-btn-pri" href="#">Return to Home Catalog</a>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c95",
      "n": 95,
      "name": "High-Contrast WCAG AAA Accessibility Mode",
      "group": "polish",
      "tagline": "Ultra-high-contrast mode with bold borders, enhanced focus rings, and zero motion",
      "concept": "Ensures accessibility for visually impaired visitors. An explicit high-contrast mode switch enforces 7:1 contrast ratios (WCAG AAA), high-visibility 3px blue focus rings, bold borders on all cards, and disables all background animations.",
      "moves": [
            "Accessibility toggle switch: 'High Contrast Mode (WCAG AAA)'",
            "Boosts all text contrast ratios to >7:1",
            "Adds distinct 2px solid black/white borders around all interactive buttons and cards",
            "High-visibility keyboard focus indicators (3px solid #2F5BEA with 2px offset)"
      ],
      "palette": [
            [
                  "Pure Black",
                  "#000000"
            ],
            [
                  "Pure White",
                  "#FFFFFF"
            ],
            [
                  "Focus Blue",
                  "#1D4ED8"
            ]
      ],
      "facts": {
            "Type": "Accessibility (WCAG AAA)",
            "Effort": "S",
            "Needs": "CSS high contrast tokens"
      },
      "spec": {
            "today": [
                  "Standard light/dark modes meet WCAG AA but not full AAA high-contrast standards"
            ],
            "proposed": [
                  "Dedicated WCAG AAA high-contrast mode with bold borders and zero motion"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css",
                  "pages/.vitepress/theme/components/A11yToggle.vue"
            ],
            "risks": [
                  "Ensure high-contrast mode does not break visual hierarchy"
            ],
            "verify": [
                  "Lighthouse Accessibility audit confirms 100% WCAG AAA color compliance"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr" style="background:#000;color:#fff">
              <header class="h-nav" style="background:#000;border-bottom:2px solid #fff">
                <span class="h-title" style="color:#fff">HEJI Apps (High Contrast AAA)</span>
              </header>
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2 style="color:#fff">High Contrast Mode Active</h2></div>
                <div class="h-apps-grid">
                  <div class="h-card" style="background:#000;border:2px solid #fff;color:#fff">
                    <div class="h-card-icon">${KIT.apps[0].iconSvg}</div>
                    <div class="h-card-main">
                      <h4 style="color:#fff;font-size:20px">Waypack</h4>
                      <p style="color:#E2E8F0;font-size:14px">${KIT.apps[0].desc}</p>
                      <button style="border:2px solid #fff;background:#fff;color:#000;padding:8px 16px;font-weight:800;cursor:pointer">Visit App</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        `
    },
{
      "id": "c96",
      "n": 96,
      "name": "Micro Confetti Burst on Copy & Feedback",
      "group": "polish",
      "tagline": "Delightful particle burst animation when copying code blocks or submitting feedback",
      "concept": "Injects playful micro-delight into routine tasks. Copying a CLI snippet or submitting an issue via FeedbackKit emits a tiny, physics-based canvas confetti burst (12 colorful paper specks), celebrating the action without annoying the user.",
      "moves": [
            "Lightweight 1KB canvas particle emitter with zero external dependencies",
            "Triggers on code block copy button click and feedback verification",
            "Colors match HEJI brand palette: Waypack blue, Wee Hours purple, amber gold",
            "Particles automatically dissolve after 800ms"
      ],
      "palette": [
            [
                  "Particle Blue",
                  "#2F5BEA"
            ],
            [
                  "Particle Purple",
                  "#8B5CF6"
            ],
            [
                  "Particle Gold",
                  "#F59E0B"
            ]
      ],
      "facts": {
            "Type": "Micro-Delight Animation",
            "Effort": "S",
            "Needs": "Micro-canvas confetti script"
      },
      "spec": {
            "today": [
                  "Copy buttons display a simple static checkmark with no celebratory delight"
            ],
            "proposed": [
                  "Subtle micro confetti burst celebrating code copy and feedback actions"
            ],
            "files": [
                  "pages/.vitepress/theme/utils/confetti.ts",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Disables automatically if prefers-reduced-motion is active"
            ],
            "verify": [
                  "Clicking Copy emits 12 colorful particle specks that gently fall and dissolve"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Micro Confetti Delight (Demo)</h2></div>
                <div style="padding:24px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;text-align:center">
                  <div style="font-size:32px;margin-bottom:8px">🎉</div>
                  <h4 style="margin:0 0 8px">Copy Snippet with Confetti</h4>
                  <button class="h-btn-pri" style="padding:10px 22px;font-size:14px;position:relative">
                    <span>Copied to Clipboard! ✓</span>
                    <span style="position:absolute;top:-10px;right:-10px;font-size:16px">✨</span>
                  </button>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c97",
      "n": 97,
      "name": "Magnetic Cursor Attraction on Primary CTAs",
      "group": "polish",
      "tagline": "Subtle desktop mouse magnetic snap effect on primary action buttons",
      "concept": "Brings high-end agency craft to desktop browsing. When the visitor's cursor approaches within 20px of a primary call-to-action ('See the apps', 'Download DMG'), the button subtly pulls toward the cursor using a gentle magnetic spring physics curve.",
      "moves": [
            "Gentle magnetic spring curve on cursor approach (`transform: translate(x, y)`)",
            "Max displacement clamped to 6px to avoid jarring movement",
            "Smoothly snaps back to center on cursor leave",
            "Enabled only on desktop pointer devices with fine cursor accuracy"
      ],
      "palette": [
            [
                  "Brand Blue",
                  "#2F5BEA"
            ],
            [
                  "Button Hover",
                  "#1D4ED8"
            ],
            [
                  "Glow Tint",
                  "rgba(47,91,234,0.2)"
            ]
      ],
      "facts": {
            "Type": "Cursor Craft & Physics",
            "Effort": "S",
            "Needs": "Pointermove spring listener"
      },
      "spec": {
            "today": [
                  "Buttons have standard static CSS hover state with no magnetic physics"
            ],
            "proposed": [
                  "Magnetic spring attraction on primary hero buttons for fine pointer devices"
            ],
            "files": [
                  "pages/.vitepress/theme/utils/magnetic.ts",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Must not activate on touchscreens or trackpads with coarse pointers"
            ],
            "verify": [
                  "Moving cursor near button causes gentle 4px pull toward pointer"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Magnetic Physics CTAs (Desktop Demo)</h2></div>
                <div style="padding:32px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;text-align:center">
                  <button class="h-btn-hero-pri" style="transform:translate(4px, -3px);box-shadow:0 8px 24px rgba(47,91,234,0.3)">
                    <span>🧲 Magnetic Button (Attracted to Cursor)</span>
                  </button>
                  <p style="font-size:12px;color:#64748B;margin-top:14px">Subtly follows cursor within 20px radius with spring physics.</p>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c98",
      "n": 98,
      "name": "Dynamic Favicon CI Health Indicator",
      "group": "polish",
      "tagline": "Favicon dynamically draws a tiny green or yellow indicator dot reflecting live CI health",
      "concept": "Turns the browser tab into an ambient monitoring device. The browser favicon (`heji.svg`) dynamically draws a tiny green status dot in the corner when all GitHub Actions workflows pass, or amber if builds are currently running in CI.",
      "moves": [
            "Draws favicon dynamically to `<canvas>` and updates `<link rel='icon'>`",
            "Green dot: All monorepo workflows passing",
            "Pulsing Amber dot: Scheduled Wednesday build currently running in CI",
            "Red dot: Isolation check or release workflow failure detected"
      ],
      "palette": [
            [
                  "Dot Green",
                  "#10B981"
            ],
            [
                  "Dot Amber",
                  "#F59E0B"
            ],
            [
                  "Dot Red",
                  "#EF4444"
            ]
      ],
      "facts": {
            "Type": "Ambient Browser Tab Telemetry",
            "Effort": "S",
            "Needs": "Canvas favicon generator script"
      },
      "spec": {
            "today": [
                  "Favicon is a static SVG icon that never changes"
            ],
            "proposed": [
                  "Dynamic canvas-rendered favicon reflecting live monorepo CI status"
            ],
            "files": [
                  "pages/.vitepress/theme/utils/dynamicFavicon.ts",
                  "pages/.vitepress/theme/index.ts"
            ],
            "risks": [
                  "Avoid updating favicon too frequently to prevent browser tab flickering"
            ],
            "verify": [
                  "Favicon displays tiny green indicator dot when CI workflows pass"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              <header class="h-nav">
                <div class="h-nav-left">
                  <div style="position:relative">
                    <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="7" fill="#2f5bea"/><path d="M10 23V9h4v5h4V9h4v14h-4v-5h-4v5z" fill="#fff"/></svg>
                    <span style="position:absolute;top:-2px;right:-2px;width:9px;height:9px;border-radius:50%;background:#10B981;border:2px solid #fff"></span>
                  </div>
                  <span class="h-title" style="margin-left:6px">HEJI Apps (Dynamic Favicon: 🟢 Green CI)</span>
                </div>
              </header>
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Ambient Browser Tab Status</h2></div>
                <div class="h-apps-grid">${KIT.apps.slice(0, 4).map(KIT.defaultAppCard).join("")}</div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c99",
      "n": 99,
      "name": "Multi-Tab State Synchronization via BroadcastChannel",
      "group": "polish",
      "tagline": "Theme, search query, and filter states synchronize instantly across all open browser tabs",
      "concept": "Creates a seamless desktop experience for developers with multiple tabs open. Using the browser's native `BroadcastChannel` API, toggling dark mode or switching to the 'Apple Watch' filter in one tab instantly updates all other open HEJI tabs in real-time.",
      "moves": [
            "Native `BroadcastChannel('heji-state')` listener in theme entry",
            "Synchronizes theme toggle (Light / Dark / Sepia) across all open tabs",
            "Synchronizes catalog category filters across tabs",
            "Zero server communication: 100% peer-to-peer browser synchronization"
      ],
      "palette": [
            [
                  "Sync Cyan",
                  "#06B6D4"
            ],
            [
                  "Tab Blue",
                  "#2F5BEA"
            ],
            [
                  "Surface",
                  "#FFFFFF"
            ]
      ],
      "facts": {
            "Type": "Multi-Tab Cross-Window State",
            "Effort": "S",
            "Needs": "BroadcastChannel API in theme"
      },
      "spec": {
            "today": [
                  "Changing theme in one tab leaves other open tabs out of sync until hard reload"
            ],
            "proposed": [
                  "BroadcastChannel synchronization updating all open tabs in real-time"
            ],
            "files": [
                  "pages/.vitepress/theme/index.ts",
                  "pages/.vitepress/theme/utils/broadcast.ts"
            ],
            "risks": [
                  "Ensure BroadcastChannel falls back gracefully in older browser engines"
            ],
            "verify": [
                  "Toggling dark theme in Tab A instantly changes Tab B to dark theme without reload"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr ${dark ? "dark" : ""}">
              ${KIT.nav("apps")}
              <div class="h-apps-section" style="padding-top:24px">
                <div class="h-sec-hd"><h2>Multi-Tab Real-Time Sync</h2></div>
                <div style="padding:20px;border-radius:14px;background:${dark ? "#151922" : "#fff"};border:1px solid #CBD5E1;display:flex;align-items:center;justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:14px">
                    <span style="font-size:24px">🔄</span>
                    <div>
                      <b>BroadcastChannel Synchronization Active</b>
                      <div style="font-size:12.5px;color:#64748B">Theme and filter changes synchronize instantly across all open browser windows.</div>
                    </div>
                  </div>
                  <span style="padding:4px 10px;border-radius:99px;background:#ECFEFF;color:#0891B2;font-size:11px;font-weight:700">● 2 Tabs Synced</span>
                </div>
              </div>
              ${KIT.feedbackTrigger()}
            </div>
        `
    },
{
      "id": "c100",
      "n": 100,
      "name": "Print & PDF Clean Reader Stylesheet",
      "group": "polish",
      "tagline": "Dedicated print stylesheet stripping nav, backgrounds, and ads for clean archival PDFs",
      "concept": "Respects developers who archive or print technical specifications. A `@media print` stylesheet strips out navigation headers, floating buttons, and dark backgrounds, formatting documentation into clean, high-contrast black-and-white pages perfect for filing or PDF export.",
      "moves": [
            "Dedicated `@media print` rules in `custom.css`",
            "Hides top navbar, search buttons, and FeedbackKit floating FAB",
            "Forces clean serif/sans black text on pure white paper with readable margins",
            "Expands markdown hyperlinks into printed URLs: `[Waypack](https://waypack.app)`"
      ],
      "palette": [
            [
                  "Print White",
                  "#FFFFFF"
            ],
            [
                  "Print Black",
                  "#000000"
            ],
            [
                  "Paper Gray",
                  "#71717A"
            ]
      ],
      "facts": {
            "Type": "Print & PDF Export Quality",
            "Effort": "S",
            "Needs": "@media print block in custom.css"
      },
      "spec": {
            "today": [
                  "Printing documentation results in dark background ink waste and clipped navigation bars"
            ],
            "proposed": [
                  "Clean print stylesheet producing elegant black-and-white archival PDFs"
            ],
            "files": [
                  "pages/.vitepress/theme/custom.css"
            ],
            "risks": [
                  "Avoid page-break inside code blocks or diagrams using page-break-inside: avoid"
            ],
            "verify": [
                  "Triggering browser Print dialog shows clean, distraction-free document layout"
            ]
      },
      "round": 1,
      "render": ({ dark }) => `
            <div class="scr" style="background:#fff;color:#000;padding:32px;font-family:Georgia,serif">
              <div style="border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end">
                <div>
                  <h1 style="font-size:26px;margin:0 0 4px">HEJI Apps Architecture Specification</h1>
                  <span style="font-size:12px;color:#71717A">Published: October 20, 2026 · https://tianhaoz95.github.io/hejitech-apps/</span>
                </div>
                <span style="font-size:11px;border:1px solid #000;padding:2px 8px;font-weight:700">PRINT ARCHIVE</span>
              </div>
              <p style="font-size:14px;line-height:1.7;color:#27272A">
                Waypack stores trip itineraries as self-contained bundles. A bundle is an archive containing vector tile extracts, GeoJSON itinerary layers, place metadata, and offline trip notes.
              </p>
              <div style="margin-top:20px;padding:12px;border:1px solid #71717A;font-family:monospace;font-size:11px">
                SQLite Bundle Specification (PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;)
              </div>
            </div>
        `
    }
    ]
  };
})();
