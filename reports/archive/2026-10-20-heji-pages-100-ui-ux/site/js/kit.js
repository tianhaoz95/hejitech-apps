// Shared building blocks, apps database, icons, and layout formatters for HEJI Pages Review
window.KIT = window.KIT || {};

(() => {
  const K = window.KIT;

  K.apps = [
    {
      id: "waypack",
      name: "Waypack",
      tagline: "Your trip, packed.",
      desc: "Your AI assistant plans it; Waypack turns the plan into a self-contained bundle with offline vector maps that works with no signal at all.",
      platforms: ["iPhone", "Android", "Mac", "MCP"],
      category: "Travel & Offline",
      ai: "MCP Server",
      backend: "Shared Supabase (waypack.*)",
      color: "#1D6FE0",
      version: "v1.4.2",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#1D6FE0"/><path d="M14 24l8-8 12 12-8 8z" fill="#fff" opacity=".9"/><circle cx="30" cy="18" r="4" fill="#ffd166"/></svg>`,
      appUrl: "https://waypack.hejitech.workers.dev",
      docsUrl: "./waypack/",
      hasSite: true,
      testflight: "Active (Build 84)",
      ghPath: "projects/waypack",
    },
    {
      id: "weehours",
      name: "Wee Hours",
      tagline: "A newborn log built for 3am.",
      desc: "Log a feed, diaper or nap in three seconds by voice, a tap, your watch or your glasses; the voice model runs on the phone.",
      platforms: ["iPhone", "Apple Watch", "Even G2 glasses", "MCP"],
      category: "Parenting & Kids",
      ai: "On-Device Whisper + CoreML",
      backend: "Shared Supabase (weehours.*)",
      color: "#6d5bd0",
      version: "v1.3.1",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#6d5bd0"/><path d="M16 28a8 8 0 1016 0 8 8 0 00-16 0z" fill="#fff" opacity=".85"/><path d="M24 16v6l4 2" stroke="#6d5bd0" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      appUrl: "https://weehours.hejitech.workers.dev",
      docsUrl: "./weehours/",
      hasSite: true,
      testflight: "Active (Build 92)",
      ghPath: "projects/weehours",
    },
    {
      id: "voxbrief",
      name: "Voxbrief",
      tagline: "Speak an idea, get a clean note.",
      desc: "One tap on Apple Watch records it; the iPhone or Mac turns it into structured Markdown with Whisper and Qwen3 running on the device. No account, no server.",
      platforms: ["iPhone", "Apple Watch", "Mac", "On-device AI"],
      category: "Audio & Voice",
      ai: "Whisper + Qwen3 (On-Device)",
      backend: "None (Zero Backend)",
      color: "#1D4ED8",
      version: "v1.2.0",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#1D4ED8"/><rect x="19" y="13" width="10" height="16" rx="5" fill="#fff"/><path d="M14 23a10 10 0 0020 0M24 33v5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      appUrl: "https://tianhaoz95.github.io/hejitech-apps/voxbrief/site/",
      docsUrl: "./voxbrief/",
      hasSite: true,
      testflight: "Active (Build 41)",
      ghPath: "projects/voxbrief",
    },
    {
      id: "meowtrix",
      name: "Meowtrix",
      tagline: "A remote workspace for vibe engineering.",
      desc: "Split panes of real terminals, browsers and a code editor, served from your own machine and reachable from any device. Shells survive refreshes and device switches.",
      platforms: ["Web", "macOS app", "Linux", "Agent tools · MCP"],
      category: "Developer Tools",
      ai: "MCP Server + Terminal Agent",
      backend: "None (Self-hosted Node / Tauri)",
      color: "#7c3aed",
      version: "v1.35.0",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#7c3aed"/><path d="M15 17l6 7-6 7M23 31h10" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      appUrl: "https://tianhaoz95.github.io/hejitech-apps/meowtrix/site/",
      docsUrl: "./meowtrix/",
      hasSite: true,
      testflight: "Mac Release Active",
      ghPath: "projects/meowtrix",
    },
    {
      id: "contempo",
      name: "Contempo",
      tagline: "Hours that survive an audit.",
      desc: "Short-term-rental hosts log work by voice on the phone or watch; Contempo turns it into contemporaneous, risk-checked records for IRS tests.",
      platforms: ["Android · Wear OS", "iPhone · Apple Watch", "Web", "On-device AI"],
      category: "Productivity & Tax",
      ai: "On-Device Whisper + Rule Check",
      backend: "Shared Supabase (contempo.*)",
      color: "#059669",
      version: "v1.1.0",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#059669"/><circle cx="24" cy="24" r="12" stroke="#fff" stroke-width="3"/><path d="M24 16v8l5 5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      appUrl: "https://contempo.hejitech.workers.dev",
      docsUrl: "./contempo/",
      hasSite: true,
      testflight: "Active (Build 30)",
      ghPath: "projects/contempo",
    },
    {
      id: "toddlercam",
      name: "ToddlerCam",
      tagline: "A dual camera made for little hands.",
      desc: "Front and rear cameras at once, a big bouncy shutter, face-tracking masks and a toddler lock, with parent's Apple Watch as the remote.",
      platforms: ["iPhone · iPad", "Apple Watch", "Kids Category"],
      category: "Parenting & Kids",
      ai: "CoreML Face Detection",
      backend: "None (Zero Backend)",
      color: "#f59e0b",
      version: "v1.0.4",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#f59e0b"/><circle cx="24" cy="25" r="9" fill="#fff"/><circle cx="24" cy="25" r="5" fill="#f59e0b"/><rect x="18" y="12" width="12" height="4" rx="2" fill="#fff"/></svg>`,
      appUrl: "https://tianhaoz95.github.io/hejitech-apps/toddlercam/site/",
      docsUrl: "./toddlercam/",
      hasSite: true,
      testflight: "Active (Build 18)",
      ghPath: "projects/toddlercam",
    },
    {
      id: "tinytouch",
      name: "TinyTouch",
      tagline: "Calm play for Apple Watch.",
      desc: "Hand your Apple Watch to a toddler without 911 calls or swiped-away apps. Every touch becomes calm, pentatonic play with 3-second parent exit hold.",
      platforms: ["Apple Watch", "iPhone", "Kids Category"],
      category: "Parenting & Kids",
      ai: "Zero AI / Pure Utility",
      backend: "None (Zero Backend)",
      color: "#ec4899",
      version: "v1.0.2",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#ec4899"/><circle cx="18" cy="20" r="5" fill="#fff"/><circle cx="30" cy="20" r="5" fill="#fff"/><circle cx="24" cy="31" r="5" fill="#fff"/></svg>`,
      appUrl: "https://tianhaoz95.github.io/hejitech-apps/tinytouch/site/",
      docsUrl: "./tinytouch/",
      hasSite: true,
      testflight: "Active (Build 12)",
      ghPath: "projects/tinytouch",
    },
    {
      id: "feedbackkit",
      name: "FeedbackKit",
      tagline: "In-app feedback that closes the loop.",
      desc: "Users report with a screenshot, a coding agent fixes it, and reporter is asked 'is it fixed?' in the next build. Ships in every HEJI app.",
      platforms: ["iOS · Mac · watchOS", "Android", "Web", "Flutter · RN", "MCP"],
      category: "Developer Tools",
      ai: "Antigravity & Claude Agent Loop",
      backend: "Independent Supabase (own backend)",
      color: "#2f5bea",
      version: "v1.0.62",
      iconSvg: `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#2f5bea"/><path d="M14 16h20v14H20l-6 6v-6h0z" fill="#fff"/><path d="M22 21l3 3 5-5" stroke="#2f5bea" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      appUrl: "https://tianhaoz95.github.io/hejitech-apps/feedbackkit/",
      docsUrl: "https://tianhaoz95.github.io/hejitech-apps/feedbackkit/",
      hasSite: true,
      testflight: "In All Builds",
      ghPath: "projects/feedbackkit",
    },
  ];

  K.svgIcons = {
    search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    github: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>',
    moon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
    sun: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    terminal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
    bolt: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    spark: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>',
    arrowRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    mcp: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    filter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    radar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 12 19 5"/><circle cx="12" cy="12" r="2"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  };

  K.nav = (active = "apps") => `
    <header class="h-nav">
      <div class="h-nav-left">
        <a class="h-brand" href="#/">
          <svg class="h-logo" viewBox="0 0 32 32" width="26" height="26"><rect width="32" height="32" rx="7" fill="#2f5bea"/><path d="M10 23V9h4v5h4V9h4v14h-4v-5h-4v5z" fill="#fff"/></svg>
          <span class="h-title">HEJI Apps</span>
        </a>
      </div>
      <div class="h-nav-mid">
        <span class="h-link ${active === "apps" ? "on" : ""}">Apps</span>
        <span class="h-link ${active === "monorepo" ? "on" : ""}">Monorepo</span>
        <span class="h-link status-pill ${active === "status" ? "on" : ""}">● Status</span>
      </div>
      <div class="h-nav-right">
        <span class="h-search-btn">${K.svgIcons.search} Search <kbd>⌘K</kbd></span>
        <span class="h-nav-icon">${K.svgIcons.github}</span>
        <span class="h-nav-icon">${K.svgIcons.moon}</span>
      </div>
    </header>
  `;

  K.feedbackTrigger = () => `
    <div class="h-feedback-fab" title="FeedbackKit In-App Reporter">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <span>Feedback</span>
    </div>
  `;

  K.defaultAppCard = (app) => `
    <div class="h-card" data-app="${app.id}">
      <div class="h-card-icon">${app.iconSvg}</div>
      <div class="h-card-main">
        <div class="h-card-top">
          <h4>${app.name}</h4>
          <span class="h-card-ver">${app.version}</span>
        </div>
        <p class="h-card-desc">${app.desc}</p>
        <div class="h-card-tags">
          ${app.platforms.map((p) => `<span class="h-tag">${p}</span>`).join("")}
        </div>
        <div class="h-card-actions">
          <a class="h-btn-pri" href="${app.appUrl}">Visit app</a>
          <a class="h-btn-sec" href="${app.docsUrl}">Docs →</a>
        </div>
      </div>
    </div>
  `;

  K.baselinePage = () => `
    <div class="h-site-baseline">
      ${K.nav("apps")}
      <div class="h-hero">
        <div class="h-hero-content">
          <h1 class="h-hero-title">HEJI Apps</h1>
          <p class="h-hero-tagline">Small apps, carefully made</p>
          <p class="h-hero-sub">Each one does one job well, works when the network doesn't, and lets your own AI assistant in through an open door: MCP.</p>
          <div class="h-hero-actions">
            <span class="h-btn-hero-pri">See the apps</span>
            <span class="h-btn-hero-sec">How they're built</span>
          </div>
        </div>
        <div class="h-hero-art">
          <svg width="130" height="130" viewBox="0 0 140 140"><rect width="140" height="140" rx="36" fill="#2f5bea"/><path d="M42 98V42h16v22h24V42h16v56H82V76H58v22z" fill="#fff"/></svg>
        </div>
      </div>

      <div class="h-apps-section">
        <div class="h-sec-hd">
          <h2>The apps</h2>
        </div>
        <div class="h-apps-grid">
          ${K.apps.map(K.defaultAppCard).join("")}
        </div>
      </div>

      <div class="h-principles-sec">
        <h2>How we build</h2>
        <div class="h-principles-grid">
          <div class="h-principle">
            <h3>Works offline first</h3>
            <p>Trips open without signal; baby log lives on phone and syncs when it can. Network is a bonus, not a dependency.</p>
          </div>
          <div class="h-principle">
            <h3>AI through an open door</h3>
            <p>Every app talks Model Context Protocol (MCP). Your AI assistant plans, logs and queries directly through tools.</p>
          </div>
          <div class="h-principle">
            <h3>Loop closes with agents</h3>
            <p>FeedbackKit lets users draw on a screenshot, an autonomous agent writes a fix, and next build verifies it.</p>
          </div>
        </div>
      </div>

      ${K.feedbackTrigger()}
    </div>
  `;
  // ── Round 2: helpers for the shortlisted hero / search / 404 combos (c101–c108)

  // Every route of the built site (pages/.vitepress/dist, cleanUrls), for 404 suggestions and the palette.
  K.routes = [
    ["/", "HEJI Apps"], ["/monorepo", "The monorepo"], ["/status", "Status"],
    ["/waypack/", "Waypack"], ["/waypack/design", "Waypack · Design"], ["/waypack/DECISIONS", "Waypack · Decisions"],
    ["/waypack/DEPLOY", "Waypack · Deploy"], ["/waypack/STATUS", "Waypack · Status"], ["/waypack/store-listing", "Waypack · Store listing"],
    ["/weehours/", "Wee Hours"], ["/weehours/decisions", "Wee Hours · Decisions"], ["/weehours/DEPLOY", "Wee Hours · Deploy"],
    ["/weehours/MCP-DIRECTORIES", "Wee Hours · MCP directories"], ["/voxbrief/", "Voxbrief"], ["/meowtrix/", "Meowtrix"],
    ["/contempo/", "Contempo"], ["/toddlercam/", "ToddlerCam"], ["/tinytouch/", "TinyTouch"],
  ];

  // Levenshtein distance, case-insensitive; the 404 candidates rank routes by it (computed live in the mock).
  K.lev = (a, b) => {
    a = a.toLowerCase(); b = b.toLowerCase();
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const t = d[j];
        d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = t;
      }
    }
    return d[b.length];
  };
  K.suggest = (path, n = 3) => K.routes
    .map(([r, t]) => ({ r, t, d: K.lev(path.replace(/\/$/, ""), r.replace(/\/$/, "")) }))
    .sort((x, y) => x.d - y.d).slice(0, n);

  // The hero dock: all 8 apps. persona "user" shows what a visitor gets, "eng" how it's built;
  // `hover` is the app whose tooltip is drawn open; `labels` puts names under icons (touch layout).
  K.dock = ({ persona = "user", hover = "weehours", labels = false, cls = "" } = {}) => `
    <div class="r2-dock ${labels ? "labels" : ""} ${cls}">
      ${K.apps.map((a, i) => `
        <div class="r2-dock-item ${a.id === hover ? "hover" : ""}" style="--c:${a.color}">
          <div class="r2-dock-icon">${a.iconSvg}</div>
          ${labels ? `<span class="r2-dock-name">${a.name}</span>` : `<kbd class="r2-dock-key">${i + 1}</kbd>`}
          ${a.id === hover && !labels ? `<div class="r2-tip">
            <b>${a.name}</b>
            ${persona === "eng"
              ? `<span class="r2-tip-row"><i>backend</i>${a.backend}</span><span class="r2-tip-row"><i>AI</i>${a.ai}</span><span class="r2-tip-row"><i>code</i><code>${a.ghPath}/</code></span>`
              : `<span class="r2-tip-line">${a.tagline}</span><span class="r2-tip-row"><i>on</i>${a.platforms.join(" · ")}</span>`}
            <span class="r2-tip-cta">${persona === "eng" ? "Docs & architecture →" : "Visit app →"}</span>
          </div>` : ""}
        </div>`).join("")}
    </div>`;

  K.personaSwitch = (persona = "user") => `
    <div class="r2-persona" role="tablist">
      <span class="${persona === "user" ? "on" : ""}">I want the apps</span>
      <span class="${persona === "eng" ? "on" : ""}">I build with agents</span>
    </div>`;

  // Palette entries. Apps from K.apps; docs from K.routes; actions and workflows are real
  // (scripts/cut_release.sh, .github/workflows/*.yml, FeedbackKit's ⌘⇧F shortcut).
  K.paletteData = {
    apps: (q) => K.apps.filter((a) => (a.name + a.desc + a.ai + a.tagline).toLowerCase().includes(q)),
    docs: {
      // Real headings whose text mentions the query (grep -il whisper projects/*/docs/*.md).
      whisper: [["/weehours/#how-it-fits-together", "Wee Hours › How it fits together"], ["/voxbrief/#how-it-fits-together", "Voxbrief › How it fits together"], ["/contempo/", "Contempo"]],
      testflight: [["/monorepo#releases", "The monorepo › Releases"], ["/status", "Status"], ["/waypack/DEPLOY#_4b-releases-github-actions", "Waypack › Deploy › 4b. Releases"]],
    },
    actions: {
      whisper: [["Open the Wee Hours MCP setup", "/weehours/MCP-DIRECTORIES"]],
      testflight: [["Copy  scripts/cut_release.sh weehours --dry-run", "copy"], ["Report a problem with this page", "⌘⇧F"]],
    },
    workflows: {
      whisper: [["weehours-ml.yml", "ML pipeline"], ["voxbrief-ml.yml", "ML pipeline"]],
      testflight: [["weehours-testflight.yml", "Wed 17:00 UTC + on release"], ["waypack-testflight.yml", "on release"], ["voxbrief-testflight.yml", "on release"]],
    },
  };

  // The palette panel. order: which sections come first (persona-ranked in c105).
  K.palette = ({ q = "whisper", order = ["apps", "docs", "actions", "workflows"], sel = 0, recent = false } = {}) => {
    const D = K.paletteData;
    const sec = {
      apps: ["Apps", D.apps(q).slice(0, 2).map((a) => [`<span class="r2-pal-ico">${a.iconSvg}</span><b>${a.name}</b> <span class="r2-pal-dim">${a.tagline}</span>`, "Jump to card"])],
      docs: ["Docs", (D.docs[q] || []).map(([r, t]) => [`<span class="r2-pal-glyph">#</span>${t}`, r])],
      actions: ["Actions", (D.actions[q] || []).map(([t, k]) => [`<span class="r2-pal-glyph">›</span>${t}`, k])],
      workflows: ["CI workflows", (D.workflows[q] || []).map(([f, n]) => [`<span class="r2-pal-glyph">◆</span><code>${f}</code> <span class="r2-pal-dim">${n}</span>`, "Open on GitHub"])],
    };
    let i = 0;
    return `
    <div class="r2-pal">
      <div class="r2-pal-in">${K.svgIcons.search}<span class="r2-pal-q">${q}<i class="r2-caret"></i></span><kbd>esc</kbd></div>
      ${recent ? `<div class="r2-pal-recent"><span>Recent</span><em>offline maps</em><em>cut_release</em><em>graduation</em></div>` : ""}
      <div class="r2-pal-body">
        ${order.filter((k) => sec[k][1].length).map((k) => `
          <div class="r2-pal-sec">${sec[k][0]}</div>
          ${sec[k][1].map(([l, r]) => `<div class="r2-pal-row ${i++ === sel ? "sel" : ""}"><span>${l}</span><small>${r}</small></div>`).join("")}`).join("")}
      </div>
      <div class="r2-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>/</kbd> or <kbd>⌘K</kbd> anywhere</span></div>
    </div>`;
  };

  // ── Round 2 screens
  const scr = (dark, body, cls = "") => `<div class="scr ${dark ? "dark" : ""} ${cls}">${body}</div>`;
  const cards = () => `<div class="h-apps-section"><div class="h-sec-hd"><h2>The apps</h2></div><div class="h-apps-grid">${K.apps.slice(0, 4).map(K.defaultAppCard).join("")}</div></div>`;
  const heroLine = { user: "Small apps, carefully made. Each works offline and lets your AI assistant in through MCP.", eng: "Eight apps, one monorepo: isolated Supabase schemas, on-device models, an MCP server per app, agents that fix reported bugs." };

  K.r2HeroCombo = ({ dark, persona = "user", hover = "weehours" }) => scr(dark, `
    ${K.nav("apps")}
    <div class="r2-hero">
      ${K.personaSwitch(persona)}
      <h1 class="h-hero-title">HEJI Apps</h1>
      <p class="r2-hero-line">${heroLine[persona]}</p>
      <div class="r2-search"><span class="r2-search-ico">${K.svgIcons.search}</span><span class="r2-search-ph">Search apps, docs, release commands…</span><kbd>/</kbd></div>
      ${K.dock({ persona, hover })}
    </div>
    ${cards()}
    ${K.feedbackTrigger()}`);

  K.r2DockHero = ({ dark, persona = "user" }) => scr(dark, `
    ${K.nav("apps")}
    <div class="h-hero">
      <div class="h-hero-content">
        <h1 class="h-hero-title">HEJI Apps</h1>
        <p class="h-hero-tagline">Small apps, carefully made</p>
        <p class="h-hero-sub">Each one does one job well, works when the network doesn't, and lets your own AI assistant in through an open door: MCP.</p>
        <div class="r2-dock-row">
          ${K.dock({ persona, hover: persona === "eng" ? "weehours" : "waypack", cls: "live" })}
          <div class="r2-lens"><span class="${persona === "user" ? "on" : ""}" title="What it does">👤</span><span class="${persona === "eng" ? "on" : ""}" title="How it's built">🛠</span></div>
        </div>
      </div>
      <div class="h-hero-art">
        <svg width="130" height="130" viewBox="0 0 140 140"><rect width="140" height="140" rx="36" fill="#2f5bea"/><path d="M42 98V42h16v22h24V42h16v56H82V76H58v22z" fill="#fff"/></svg>
      </div>
    </div>
    ${cards()}
    ${K.feedbackTrigger()}`);

  const phoneNav = () => `<div class="r2-pnav"><svg viewBox="0 0 32 32" width="24" height="24"><rect width="32" height="32" rx="7" fill="#2f5bea"/><path d="M10 23V9h4v5h4V9h4v14h-4v-5h-4v5z" fill="#fff"/></svg><b>HEJI Apps</b><span class="r2-pnav-r">${K.svgIcons.search}<span class="r2-burger"><i></i><i></i><i></i></span></span></div>`;

  K.r2PhoneHero = ({ dark, dock = true, search = true, persona = false }) => scr(dark, `
    ${phoneNav()}
    <div class="r2-phero">
      ${persona ? `<div class="r2-persona wide"><span class="on">I want the apps</span><span>I build with agents</span></div>` : ""}
      <h1 class="h-hero-title">HEJI Apps</h1>
      <p class="r2-hero-line">Small apps, carefully made. Each works offline and lets your AI assistant in through MCP.</p>
      ${search ? `<div class="r2-search"><span class="r2-search-ico">${K.svgIcons.search}</span><span class="r2-search-ph">Search apps and docs</span></div>` : ""}
      ${dock ? K.dock({ labels: true }) : ""}
    </div>
    <div class="r2-pcards">${K.apps.slice(0, 2).map(K.defaultAppCard).join("")}</div>`, "r2-phone");

  K.r2PhoneSheet = ({ dark }) => scr(dark, `
    ${phoneNav()}
    <div class="r2-phero dim">
      <h1 class="h-hero-title">HEJI Apps</h1>
      <p class="r2-hero-line">Small apps, carefully made.</p>
    </div>
    <div class="r2-sheet">
      <div class="r2-grab"></div>
      ${K.palette({ q: "whisper" })}
      <div class="r2-kbd">${"qwertyuiop".split("").map((k) => `<i>${k}</i>`).join("")}<br>${"asdfghjkl".split("").map((k) => `<i>${k}</i>`).join("")}</div>
    </div>`, "r2-phone");

  K.r2PaletteScreen = ({ dark, q, heroField = false, recent = false, persona = null, order }) => scr(dark, `
    ${K.nav(heroField ? "apps" : "monorepo")}
    ${heroField
      ? `<div class="r2-hero lifted"><h1 class="h-hero-title">HEJI Apps</h1><div class="r2-search on"><span class="r2-search-ico">${K.svgIcons.search}</span><span>${q}</span><kbd>/</kbd></div></div>`
      : `<div class="r2-doc under"><div class="r2-doc-side"><b>The monorepo</b><span>Shared backend</span><span class="on">Releases</span><span>Adding an app</span></div><div class="r2-doc-main"><h1>Releases</h1><p>Cut every release with <code>scripts/cut_release.sh &lt;project&gt;</code>. The script keeps every surface on the same version and refuses to ship from a dirty, unpushed or CI-red main.</p><p>Every iOS app's TestFlight workflow also runs weekly on Wednesday from main.</p></div></div>`}
    <div class="r2-scrim"></div>
    <div class="r2-pal-wrap ${heroField ? "anchored" : ""}">
      ${persona ? `<div class="r2-lens-chip ${persona}">${persona === "eng" ? "🛠 Builder lens: docs and workflows first" : "👤 App lens: apps and actions first"} <u>switch</u></div>` : ""}
      ${K.palette({ q, recent, order })}
    </div>`);

  K.r2BuiltinSearch = ({ dark }) => scr(dark, `
    ${K.nav("apps")}
    <div class="r2-hero">
      <h1 class="h-hero-title">HEJI Apps</h1>
      <p class="r2-hero-line">Small apps, carefully made. Each works offline and lets your AI assistant in through MCP.</p>
      <div class="r2-search big"><span class="r2-search-ico">${K.svgIcons.search}</span><span class="r2-search-ph">What do you need? Try “baby log” or “trip offline”</span><kbd>⌘K</kbd></div>
      <div class="r2-chips"><span>offline maps</span><span>whisper</span><span>cut_release</span><span>graduation</span></div>
    </div>
    <div class="r2-scrim"></div>
    <div class="r2-vp">
      <div class="r2-vp-in">${K.svgIcons.search}<span>baby log</span></div>
      <div class="r2-vp-res sel"><small>find</small><b>Wee Hours</b><span>A newborn log built for 3am · <mark>baby log</mark>, newborn, feeds, diapers</span></div>
      <div class="r2-vp-res"><small>weehours</small><b>Wee Hours › Decisions › Several children</b><span>…one <mark>log</mark> per child…</span></div>
      <div class="r2-vp-res"><small>weehours</small><b>Wee Hours › How it fits together</b><span>…the voice model runs on the phone…</span></div>
      <div class="r2-vp-foot">VitePress local search · detailedView · fuzzy 0.2</div>
    </div>`);

  const plane = (dark, best) => `
    <svg class="r2-plane" viewBox="0 0 520 150" width="520" height="150">
      <path d="M40 110 C 150 20, 260 140, 360 60 S 470 40, 480 70" fill="none" stroke="${dark ? "#5D82FF" : "#2F5BEA"}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>
      <g transform="translate(26 98)"><circle r="14" fill="#F59E0B"/><text y="5" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">?</text></g>
      <g transform="translate(250 70) rotate(-18)"><path d="M-18 0 L18 -8 L-6 4 Z" fill="${dark ? "#E2E6EF" : "#0F172A"}"/><path d="M-6 4 L18 -8 L-2 12 Z" fill="${dark ? "#94A3B8" : "#475569"}"/></g>
      <g transform="translate(460 46)"><foreignObject width="44" height="44">${(K.apps.find((a) => best.r.includes(a.id)) || K.apps[0]).iconSvg}</foreignObject></g>
      <text x="482" y="108" text-anchor="middle" font-size="12" font-weight="700" fill="${dark ? "#A9BCFF" : "#2F5BEA"}">${best.r}</text>
    </svg>`;

  K.r2NotFound = ({ dark, path, doodle }) => {
    const s = K.suggest(path);
    const best = s[0];
    return scr(dark, `
      ${K.nav("apps")}
      <div class="r2-404">
        ${doodle ? plane(dark, best) : `<div class="r2-404-code">404</div>`}
        <h1>${doodle ? "This page flew off the map" : "No page at this address"}</h1>
        <p class="r2-404-path"><code>/hejitech-apps${path}</code></p>
        ${best.d <= 2 ? `<a class="r2-404-go">Go to <b>${best.t}</b> <code>${best.r}</code> →</a>` : ""}
        <div class="r2-404-list">
          <div class="r2-404-h">Closest pages</div>
          ${s.map((x, i) => `<div class="r2-404-row ${i === 0 && best.d <= 2 ? "best" : ""}"><span>${x.t}</span><code>${x.r}</code><small>${x.d} edit${x.d === 1 ? "" : "s"}</small></div>`).join("")}
        </div>
        <div class="r2-search"><span class="r2-search-ico">${K.svgIcons.search}</span><span>${path.replace(/[\/_-]+/g, " ").trim()}</span><kbd>↵</kbd></div>
        <p class="r2-404-report">Followed a link here? <u>Tell us where you found it</u> · <u>Take me home</u></p>
      </div>
      ${K.feedbackTrigger()}`);
  };

  K.r2SuggestTable = (paths) => `<table class="r2-sg"><tr><th>Requested</th><th>1st</th><th>2nd</th><th>3rd</th></tr>${paths.map((p) => `<tr><td><code>${p}</code></td>${K.suggest(p).map((x) => `<td><code>${x.r}</code> <small>${x.d}</small></td>`).join("")}</tr>`).join("")}</table>`;
  K.r2SuggestText = (paths) => paths.map((p) => `${p} → ${K.suggest(p).map((x) => `${x.r} (${x.d})`).join(", ")}`).join("\n");
})();
