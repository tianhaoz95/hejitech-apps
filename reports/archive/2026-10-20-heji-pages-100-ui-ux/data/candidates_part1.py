"""
Candidates Part 1: Baseline, Group 1 (Hero C01-C10), Group 2 (Cards C11-C20), Group 3 (Taxonomy C21-C30)
"""

CANDIDATES_PART1 = [
    # ── Baseline Candidate 00
    {
        "id": "current",
        "n": 0,
        "name": "Current GitHub Pages Site",
        "group": "hero",
        "baseline": True,
        "tagline": "Today's live documentation and portal site on GitHub Pages",
        "concept": "The current GitHub Pages site built with VitePress: hero with drifting colored light blobs, 8 app cards with simple pill badges and action buttons, monorepo principles, and static docs pages.",
        "moves": [
            "Floating colored blobs background (.heji-bg)",
            "8 uniform 2-column app cards with tags and visit/docs buttons",
            "3-column 'How we build' principles grid",
            "VitePress top navbar with Apps, Monorepo, and Status pill",
            "Floating FeedbackKit trigger button in bottom right corner"
        ],
        "palette": [["Brand Blue", "#2F5BEA"], ["Surface", "#FFFFFF"], ["Soft Slate", "#64748B"]],
        "facts": {"Type": "VitePress 1.6 Default Theme", "Effort": "Current Baseline", "Needs": "Nothing (in production)"},
        "spec": {
            "today": ["Standard VitePress home layout in pages/index.md with custom CSS in custom.css"],
            "proposed": ["Baseline reference for all 100 proposed UI/UX improvements"],
            "files": ["pages/index.md", "pages/.vitepress/config.mts", "pages/.vitepress/theme/custom.css"],
            "risks": ["Static card grid lacks interactivity and deep technical differentiation"],
            "verify": ["npm run pages:dev renders current production site"]
        },
        "render_code": """() => KIT.baselinePage()"""
    },

    # ── Group 1: Hero, Above-the-Fold & First Impression (C01 - C10)
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
        "palette": [["Glass Dock", "rgba(255,255,255,0.7)"], ["Brand Glow", "#2F5BEA"], ["Active Dot", "#10B981"]],
        "facts": {"Type": "Interactive Navigation", "Effort": "S", "Needs": "CSS backdrop-filter + pointer events"},
        "spec": {
            "today": ["Hero has two generic buttons: 'See the apps' and 'How they're built'"],
            "proposed": ["Interactive dock beneath buttons showcasing all 8 app icons with live tooltips"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/HeroDock.vue"],
            "risks": ["Needs clean touch fallback on mobile where hover is absent"],
            "verify": ["Hovering expands dock items; clicking scrolls smoothly to #waypack or #weehours"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Terminal Black", "#0D1117"], ["Terminal Green", "#7EE787"], ["Prompt Blue", "#58A6FF"]],
        "facts": {"Type": "Developer Interactive Sandbox", "Effort": "M", "Needs": "Lightweight pseudo-shell script"},
        "spec": {
            "today": ["Hero displays a static SVG logo with no interactive preview"],
            "proposed": ["Hero displays an interactive mock terminal allowing immediate command execution"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/HeroTerminal.vue"],
            "risks": ["Ensure mobile layout stacks terminal gracefully below hero text"],
            "verify": ["Clicking suggestion chip executes command and prints formatted monorepo table"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c03",
        "n": 3,
        "name": "Audience Persona Switcher",
        "group": "hero",
        "tagline": "Two-state hero toggle adapting the page for app consumers vs monorepo engineers",
        "concept": "The site serves two distinct audiences: end-users looking for beautiful offline apps, and engineers looking at monorepo architecture and MCP. This toggle switches copy, card metrics, and CTAs to speak directly to the chosen visitor.",
        "moves": [
            "Prominent segmented control in hero: '👤 For App Users' vs '🛠️ For AI & Systems Engineers'",
            "When set to Engineer: app cards show schema isolation, CoreML models, and MCP tool counts",
            "When set to User: cards show screenshots, App Store / TestFlight download buttons, and user reviews",
            "Remembers visitor preference in localStorage"
        ],
        "palette": [["Consumer Lavender", "#6366F1"], ["Engineer Emerald", "#10B981"], ["Slate Neutral", "#64748B"]],
        "facts": {"Type": "Contextual Personalization", "Effort": "S", "Needs": "Vue reactive ref in theme"},
        "spec": {
            "today": ["Hero has single fixed description attempting to balance consumer appeal and tech details"],
            "proposed": ["Audience toggle reconfigures card badges, CTAs and hero subheadline instantly"],
            "files": ["pages/index.md", "pages/.vitepress/theme/index.ts"],
            "risks": ["Ensure search engine crawlers index both versions' content"],
            "verify": ["Toggling switches between consumer download links and monorepo code links"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
            "Features a small ambient time chip: 'Local 3:14 AM — Nursery Mode Active'",
            "Reduced motion and high contrast compliant"
        ],
        "palette": [["3am Amber", "#F59E0B"], ["Midnight Indigo", "#1E1B4B"], ["Dawn Rose", "#FB7185"]],
        "facts": {"Type": "Atmospheric Craft", "Effort": "S", "Needs": "CSS variable bindings in custom.css"},
        "spec": {
            "today": ["Generic fixed blue and yellow circles drifting via keyframe animations"],
            "proposed": ["Day/night reactive color palette that gives the portal a living, bespoke atmosphere"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/index.md"],
            "risks": ["Must not cause background CPU or battery drain"],
            "verify": ["Simulating 03:00 sets background to cozy amber/indigo palette"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Graph Edge", "#94A3B8"], ["Node Supabase", "#10B981"], ["Node MCP", "#6366F1"]],
        "facts": {"Type": "Architectural Visualization", "Effort": "M", "Needs": "SVG graph component"},
        "spec": {
            "today": ["Hero right column has a static 140x140 square SVG HEJI logo"],
            "proposed": ["Hero right column features an interactive ecosystem constellation graph"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/EcosystemGraph.vue"],
            "risks": ["Graph must scale down gracefully on tablets and mobile screens"],
            "verify": ["Hovering Waypack highlights Shared Supabase node and MCP node"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c06",
        "n": 6,
        "name": "Real-Time Monorepo Metric Ticker",
        "group": "hero",
        "tagline": "Live proof-of-work ticker banner showcasing verifiable numbers directly below hero",
        "concept": "Adds an unmissable live metric ribbon immediately below hero: '8 Products · 0 Trackers · 100% Offline-Capable · 4 On-Device Models · 99.98% CI Green'. Communicates transparent engineering standards at a glance.",
        "moves": [
            "Horizontal stat ticker with real counts parsed from repo at build time",
            "Interactive popovers on each stat explaining the calculation (e.g. 0 Trackers = App Privacy nutrition label)",
            "Refreshed automatically on every GitHub Pages deployment",
            "Crisp monospace numbers with subtle emerald pulse"
        ],
        "palette": [["Metric Emerald", "#10B981"], ["Ticker Surface", "#FFFFFF"], ["Border Line", "#E2E8F0"]],
        "facts": {"Type": "Social Proof & Telemetry", "Effort": "S", "Needs": "Build-time count generation"},
        "spec": {
            "today": ["No ecosystem-wide metrics shown on the home page"],
            "proposed": ["4-column metric ticker between hero and app grid with live stats"],
            "files": ["pages/index.md", "scripts/pages_sync.mjs"],
            "risks": ["Keep numbers grounded in real repo data, not vanity metrics"],
            "verify": ["Stat values reflect actual count of apps, models, and workflows"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Player Slate", "#0F172A"], ["Scrubber Accent", "#2F5BEA"], ["Pin Active", "#38BDF8"]],
        "facts": {"Type": "High-Impact Media", "Effort": "M", "Needs": "Optimized webm screen recordings"},
        "spec": {
            "today": ["No video or animated demonstration of any app on the homepage"],
            "proposed": ["Embedded video reel player with app scrubber pins in hero section"],
            "files": ["pages/index.md", "pages/public/videos/", "pages/.vitepress/theme/components/HeroVideo.vue"],
            "risks": ["Video assets must be heavily compressed (<500KB each) to prevent slow load"],
            "verify": ["Video autoplays smoothly; clicking scrubber pins switches video segment"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Search Blue", "#2F5BEA"], ["Input Background", "#FFFFFF"], ["Pill Tint", "#EEF2FF"]],
        "facts": {"Type": "Search & Retrieval", "Effort": "S", "Needs": "VitePress local search hook"},
        "spec": {
            "today": ["Search is a small button in the top right navbar"],
            "proposed": ["Prominent search bar in the hero with quick suggestion pills"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/HeroSearch.vue"],
            "risks": ["Avoid visual conflict with existing top navbar search button"],
            "verify": ["Typing query in hero search reveals instant matching results"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Nursery Purple", "#6D5BD0"], ["Live Wave", "#A78BFA"], ["Card Bg", "#FFFFFF"]],
        "facts": {"Type": "Interactive Product Demo", "Effort": "M", "Needs": "CSS keyframe waveform animation"},
        "spec": {
            "today": ["No interactive experience of app functionality before installing"],
            "proposed": ["Interactive demo simulator in hero letting visitors test app interaction"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppSimulator.vue"],
            "risks": ["Ensure simulator feels fast and snappy with zero lag"],
            "verify": ["Tapping 'Simulate 3am Voice' generates simulated voice transcription in 1s"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Editorial Paper", "#FDFBF7"], ["Warm Ink", "#1C1917"], ["Craft Rust", "#C2410C"]],
        "facts": {"Type": "Editorial Graphic Design", "Effort": "S", "Needs": "Google Font Fraunces import"},
        "spec": {
            "today": ["Generic sans-serif (Inter) typography used everywhere across the page"],
            "proposed": ["Pairing Fraunces serif display titles with Inter body for editorial authority"],
            "files": ["pages/index.md", "pages/.vitepress/theme/custom.css", "pages/.vitepress/config.mts"],
            "risks": ["Ensure font loads without layout shift (FOUT)"],
            "verify": ["Headlines render in Fraunces; paper background creates warm tactile feel"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 2: App Discovery, Cards & Interactive Demos (C11 - C20)
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
        "palette": [["Bento Slate", "#F8FAFC"], ["Hero Card Blue", "#EEF2FF"], ["Border Slate", "#E2E8F0"]],
        "facts": {"Type": "Card Grid Architecture", "Effort": "M", "Needs": "CSS grid-template-columns: repeat(4, 1fr)"},
        "spec": {
            "today": ["All 8 apps rendered in identical sized 2-column cards"],
            "proposed": ["Asymmetric bento grid with 2x2 flagship feature spotlights"],
            "files": ["pages/index.md", "pages/.vitepress/theme/custom.css"],
            "risks": ["Mobile responsiveness requires collapsing into single column smoothly"],
            "verify": ["Waypack and Wee Hours receive prominent 2x2 cards on desktop screens"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Hover Accent", "#2F5BEA"], ["Video Dark", "#0F172A"], ["Text White", "#FFFFFF"]],
        "facts": {"Type": "Delight Micro-Interaction", "Effort": "M", "Needs": "Pre-rendered micro webm clips"},
        "spec": {
            "today": ["Cards show a fixed 64x64 PNG or SVG icon that never changes"],
            "proposed": ["Hovering card reveals an animated 4-second interaction clip in place of the icon"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Lazy load clips only on hover to prevent unnecessary bandwidth consumption"],
            "verify": ["Moving mouse over Waypack card reveals map pan and zoom clip"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Carousel Dot", "#CBD5E1"], ["Dot Active", "#2F5BEA"], ["Card Slate", "#F8FAFC"]],
        "facts": {"Type": "Dense Information Architecture", "Effort": "S", "Needs": "Vue carousel state per card"},
        "spec": {
            "today": ["Card has single fixed text paragraph"],
            "proposed": ["Card features mini tab carousel cycling through top 3 distinct features"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Keep height fixed to prevent card jumpiness during transitions"],
            "verify": ["Clicking carousel dots switches feature text and screenshot"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c14",
        "n": 14,
        "name": "Live Version & Release Health Pill",
        "group": "cards",
        "tagline": "Direct card integration showing real-time TestFlight build, release date, and changelog popover",
        "concept": "Connects GitHub Pages directly to CI/CD health. Each card displays an interactive release badge: `v1.4.2 · Updated 2d ago · TestFlight Active`. Clicking opens a popover detailing recent commits and download URLs.",
        "moves": [
            "Pill badge showing semantic version and release age (e.g. 'Updated yesterday')",
            "TestFlight status dot (Green = Active build available; Yellow = Weekly rebuild pending)",
            "Clicking version opens a quick changelog popover extracted from GitHub Releases",
            "Direct DMG/APK download link button inside the popover"
        ],
        "palette": [["Health Green", "#10B981"], ["Version Slate", "#64748B"], ["Popover Dark", "#0F172A"]],
        "facts": {"Type": "CI/CD & Release Visibility", "Effort": "S", "Needs": "status.data.ts API injection"},
        "spec": {
            "today": ["No version numbers or release dates shown on app cards"],
            "proposed": ["Release health pills on each card linking directly to TestFlight and changelogs"],
            "files": ["pages/index.md", "pages/status.data.ts", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Requires build-time GitHub API tokens or fallback values"],
            "verify": ["Card version pill accurately displays v1.4.2 and links to release notes"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Badge Apple", "#000000"], ["Badge Android", "#3DDC84"], ["Badge Pill", "#EEF2FF"]],
        "facts": {"Type": "Navigation & Taxonomy", "Effort": "S", "Needs": "Click handler on platform pills"},
        "spec": {
            "today": ["Platform tags are static non-clickable span elements"],
            "proposed": ["Platform tags filter the page when clicked and show hardware tooltips on hover"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Ensure smooth scroll back to app list when filter is applied"],
            "verify": ["Clicking 'Apple Watch' tag shows Wee Hours, Voxbrief, ToddlerCam, TinyTouch"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["QR White", "#FFFFFF"], ["QR Black", "#0F172A"], ["Button Tint", "#2F5BEA"]],
        "facts": {"Type": "Cross-Device Onboarding", "Effort": "S", "Needs": "Lightweight client-side QR renderer"},
        "spec": {
            "today": ["Links open web URLs, requiring users on desktop to manually re-type URLs on their phones"],
            "proposed": ["One-click QR code modal allowing instant phone camera scanning for TestFlight installs"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/QRCodeModal.vue"],
            "risks": ["QR codes must remain legible in dark mode (white border required)"],
            "verify": ["Clicking QR button opens popover; scanning with iPhone camera opens TestFlight"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Drawer Bg", "#0F172A"], ["Code Green", "#10B981"], ["Label Slate", "#94A3B8"]],
        "facts": {"Type": "Technical Transparency", "Effort": "S", "Needs": "Accordion drawer CSS/JS"},
        "spec": {
            "today": ["No technical architecture details visible on the home page app cards"],
            "proposed": ["Expandable bottom drawer revealing exact monorepo specs for every app"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Keep drawer collapsed by default to protect consumer readability"],
            "verify": ["Clicking disclosure expands backend env, repo path, and AI models"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["TestFlight Blue", "#0071E3"], ["Capacity Green", "#10B981"], ["Card Slate", "#FFFFFF"]],
        "facts": {"Type": "Community Onboarding", "Effort": "S", "Needs": "TestFlight public URL linkage"},
        "spec": {
            "today": ["Cards link to web apps or docs, requiring multi-step navigation to find TestFlight"],
            "proposed": ["Direct TestFlight button with live slot indicator on applicable cards"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Slot counts require periodic manual or webhook synchronization"],
            "verify": ["Clicking TestFlight button opens direct Apple TestFlight invite URL"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Compare Bar", "#0F172A"], ["Button Brand", "#2F5BEA"], ["Highlight Cyan", "#06B6D4"]],
        "facts": {"Type": "Comparative Analysis", "Effort": "M", "Needs": "Floating bottom tray + comparison modal"},
        "spec": {
            "today": ["No way to compare multiple apps side-by-side on the site"],
            "proposed": ["Interactive comparison drawer comparing architecture and offline capabilities"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/CompareTray.vue"],
            "risks": ["Comparison matrix must stay updated as app features evolve"],
            "verify": ["Selecting 2 apps opens comparison matrix with accurate architecture rows"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Audio Pink", "#EC4899"], ["Wave Violet", "#8B5CF6"], ["Card Slate", "#FFFFFF"]],
        "facts": {"Type": "Auditory Experience", "Effort": "S", "Needs": "Web Audio API oscillator helper"},
        "spec": {
            "today": ["Portal is completely silent with no demonstration of audio design"],
            "proposed": ["Play audio preview button on TinyTouch, ToddlerCam, and Wee Hours cards"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AudioPreview.vue"],
            "risks": ["Must never autoplay audio; requires explicit user tap"],
            "verify": ["Clicking audio button plays calm 3-note pentatonic chime"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 3: Search, Filter & Ecosystem Taxonomy (C21 - C30)
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
        "palette": [["Active Pill", "#2F5BEA"], ["Pill Slate", "#F1F5F9"], ["Counter Text", "#64748B"]],
        "facts": {"Type": "Catalog Filtering", "Effort": "S", "Needs": "Vue reactive category filter state"},
        "spec": {
            "today": ["All apps displayed in single unfilterable list in pages/index.md"],
            "proposed": ["Sticky category pill bar above apps grid with live count chips"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/CategoryFilter.vue"],
            "risks": ["Must preserve anchor linking directly to app sections (#weehours)"],
            "verify": ["Clicking 'Parenting & Kids' displays Wee Hours, ToddlerCam, TinyTouch"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Segment Active", "#FFFFFF"], ["Segment Bg", "#E2E8F0"], ["Active Text", "#0F172A"]],
        "facts": {"Type": "Hardware Taxonomy", "Effort": "S", "Needs": "Platform array search in Vue"},
        "spec": {
            "today": ["No way to see which apps support Apple Watch or Android on the homepage"],
            "proposed": ["Platform switcher tabs filtering by Apple Watch, iOS, macOS, Android"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/PlatformSwitcher.vue"],
            "risks": ["Multi-platform apps must appear in multiple platform views"],
            "verify": ["Selecting Apple Watch shows 4 apps with watchOS support"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Local AI Green", "#10B981"], ["MCP Violet", "#6366F1"], ["Pure Utility Blue", "#0284C7"]],
        "facts": {"Type": "AI Transparency", "Effort": "S", "Needs": "AI metadata property per app"},
        "spec": {
            "today": ["AI capabilities only mentioned in unstructured card body text"],
            "proposed": ["Filter bar sorting apps by local model type, MCP tool availability, or Zero AI"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AIFilter.vue"],
            "risks": ["Clearly distinguish on-device models from MCP server integrations"],
            "verify": ["Filtering by 'Zero AI' shows TinyTouch with 'Zero AI / Pure Utility' badge"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Supabase Green", "#3ECF8E"], ["Zero Backend Blue", "#0EA5E9"], ["Own Backend Indigo", "#6366F1"]],
        "facts": {"Type": "System Architecture Taxonomy", "Effort": "S", "Needs": "Backend env metadata mapping"},
        "spec": {
            "today": ["Backend architecture only documented in internal AGENTS.md / monorepo.md"],
            "proposed": ["Public filter on the site allowing engineers to inspect backend isolation levels"],
            "files": ["pages/index.md", "pages/monorepo.md", "pages/.vitepress/theme/components/BackendFilter.vue"],
            "risks": ["Keep terminology clear for non-engineer visitors"],
            "verify": ["Filtering by 'Zero Backend' shows Voxbrief, Meowtrix, ToddlerCam, TinyTouch"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Modal Overlay", "rgba(15,23,42,0.6)"], ["Palette Bg", "#FFFFFF"], ["Active Row", "#EEF2FF"]],
        "facts": {"Type": "Power-User Command Palette", "Effort": "M", "Needs": "Client-side search index"},
        "spec": {
            "today": ["VitePress default search modal only indexes markdown document headings"],
            "proposed": ["Full command palette indexing apps, MCP tools, release lines, and CLI shortcuts"],
            "files": ["pages/.vitepress/theme/components/CommandPalette.vue", "pages/.vitepress/theme/index.ts"],
            "risks": ["Avoid conflicting with browser native shortcut keys"],
            "verify": ["Pressing Cmd+K opens palette; typing 'testflight' lists all active build lines"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Tag Tint", "#EEF2FF"], ["Tag Active", "#2F5BEA"], ["Tag Text", "#3730A3"]],
        "facts": {"Type": "Exploratory Taxonomy", "Effort": "S", "Needs": "Tag aggregator script in kit"},
        "spec": {
            "today": ["Tags are scattered inside individual cards with no holistic tag cloud"],
            "proposed": ["Consolidated tag cloud summarizing all capabilities with live match counts"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/TagCloud.vue"],
            "risks": ["Avoid visual clutter by limiting cloud to top 10 most relevant tags"],
            "verify": ["Clicking #whisper filters list to the 2 Whisper-powered apps"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c27",
        "n": 27,
        "name": "Curated Persona Presets",
        "group": "taxonomy",
        "tagline": "One-click curated presets: '👶 For New Parents', '✈️ For Nomads', '🤖 For AI Builders'",
        "concept": "Cuts straight to user value by organizing apps into curated lifestyle collections. A new parent doesn't care about Meowtrix; a developer doesn't need TinyTouch. One click instantly surfaces the tailored 3-app bundle for their life.",
        "moves": [
            "Persona cards: [👶 The 3am Parent Bundle] [✈️ The Signal-Free Traveler] [🤖 The AI Agent Builder]",
            "Activating a persona highlights recommended apps and dims others",
            "Provides a 1-click 'Install all TestFlights' button for that persona",
            "Includes a brief narrative explaining why those apps pair perfectly together"
        ],
        "palette": [["Parent Pink", "#F472B6"], ["Traveler Cyan", "#06B6D4"], ["Builder Violet", "#8B5CF6"]],
        "facts": {"Type": "Curated Collections", "Effort": "S", "Needs": "Persona configuration object in kit"},
        "spec": {
            "today": ["Apps listed in arbitrary monorepo alphabetical order"],
            "proposed": ["Curated persona bundles highlighting complementary app pairings"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/PersonaBundles.vue"],
            "risks": ["Ensure visitors can easily return to the full uncurated list"],
            "verify": ["Clicking 'New Parents' surfaces Wee Hours, ToddlerCam, and TinyTouch"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Combinator Slate", "#334155"], ["Badge Active", "#2F5BEA"], ["Chip Dismiss", "#EF4444"]],
        "facts": {"Type": "Power-User Query Builder", "Effort": "M", "Needs": "Compound filtering function"},
        "spec": {
            "today": ["No multi-attribute filtering capability exists on the site"],
            "proposed": ["Compound filter bar with AND/OR logic and dismissible filter chips"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/CompoundFilter.vue"],
            "risks": ["Avoid empty state if user creates overly restrictive filter combination"],
            "verify": ["Selecting Apple Watch + Zero Backend correctly displays ToddlerCam and TinyTouch"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Table Border", "#E2E8F0"], ["Row Hover", "#F8FAFC"], ["Header Slate", "#64748B"]],
        "facts": {"Type": "Layout Density Switcher", "Effort": "S", "Needs": "Vue table component"},
        "spec": {
            "today": ["Only visual card grid layout is available"],
            "proposed": ["Toggle button providing dense table view with sortable columns for engineers"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppTableView.vue"],
            "risks": ["Ensure table scrolls horizontally on small smartphone viewports"],
            "verify": ["Toggling to Table renders compact 8-row table with all technical specifications"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["URL Pill", "#F1F5F9"], ["Share Blue", "#2F5BEA"], ["Query Key", "#059669"]],
        "facts": {"Type": "URL State Synchronization", "Effort": "S", "Needs": "URLSearchParams watcher in Vue"},
        "spec": {
            "today": ["Filter states are ephemeral and lost on refresh or page sharing"],
            "proposed": ["Full bi-directional URL query sync enabling direct link sharing of filtered views"],
            "files": ["pages/index.md", "pages/.vitepress/theme/index.ts"],
            "risks": ["Avoid polluting browser history stack on every keystroke (use replaceState)"],
            "verify": ["Opening URL with ?platform=watch automatically selects Apple Watch filter"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    }
]
