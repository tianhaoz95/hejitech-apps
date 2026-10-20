"""
Candidates Part 2: Group 4 (Status C31-C40), Group 5 (Docs C41-C50), Group 6 (MCP C51-C60)
"""

CANDIDATES_PART2 = [
    # ── Group 4: Monorepo CI/CD & Status Board Observability (C31 - C40)
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
        "palette": [["Live Pulse", "#10B981"], ["Amber Pending", "#F59E0B"], ["Console Slate", "#0F172A"]],
        "facts": {"Type": "CI/CD Observability", "Effort": "S", "Needs": "StatusBoard.vue CSS pulse update"},
        "spec": {
            "today": ["Status board in pages/status.md shows static badge chips without animation"],
            "proposed": ["Interactive pipeline pulse visualizer showing duration and animated health rings"],
            "files": ["pages/status.md", "pages/.vitepress/theme/StatusBoard.vue"],
            "risks": ["Animation must pause if prefers-reduced-motion is active"],
            "verify": ["Status board cards display live pulsing green indicators and run durations"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Fresh Green", "#10B981"], ["Warning Amber", "#F59E0B"], ["Radar Slate", "#1E293B"]],
        "facts": {"Type": "Release Lifecycle Radar", "Effort": "S", "Needs": "Calculate days from release timestamp"},
        "spec": {
            "today": ["No indication of TestFlight build ages or expiration warnings on status page"],
            "proposed": ["TestFlight expiration radar tracking 90-day limit and Wednesday bump schedules"],
            "files": ["pages/status.md", "pages/status.data.ts", "pages/.vitepress/theme/StatusBoard.vue"],
            "risks": ["Handle edge case where workflow fails to run on Wednesday"],
            "verify": ["Radar displays accurate age (e.g. 'Day 5 of 90') for all iOS app builds"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Download Blue", "#2F5BEA"], ["Notarized Green", "#059669"], ["Hash Slate", "#64748B"]],
        "facts": {"Type": "Binary Distribution", "Effort": "S", "Needs": "Parse releases API in pages_sync.mjs"},
        "spec": {
            "today": ["Mac DMGs are attached to GitHub releases but not surfaced in a unified download table"],
            "proposed": ["Centralized Mac DMG and Android APK download center with checksum hashes"],
            "files": ["pages/status.md", "pages/.vitepress/theme/components/DownloadCenter.vue"],
            "risks": ["Ensure download links point to stable rolling release URLs"],
            "verify": ["Clicking download link downloads notarized Waypack.dmg installer"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Cloudflare Orange", "#F38020"], ["Edge Green", "#10B981"], ["Map Dark", "#0F172A"]],
        "facts": {"Type": "Global Edge Telemetry", "Effort": "M", "Needs": "Worker ping endpoint"},
        "spec": {
            "today": ["No edge latency or Worker performance telemetry displayed on the site"],
            "proposed": ["Global edge latency visualizer showing real-time Worker response times"],
            "files": ["pages/status.md", "pages/.vitepress/theme/components/EdgeLatency.vue"],
            "risks": ["Avoid client-side CORS issues by pinging designated public health route"],
            "verify": ["Edge monitor reports active Cloudflare Worker latency <30ms"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Notice Amber", "#FFFBEB"], ["Notice Border", "#FCD34D"], ["Notice Text", "#92400E"]],
        "facts": {"Type": "Incident Communication", "Effort": "S", "Needs": "Banner component in theme Layout"},
        "spec": {
            "today": ["No mechanism to communicate planned maintenance across documentation pages"],
            "proposed": ["Top-level alert banner dynamically populated during scheduled maintenance"],
            "files": ["pages/.vitepress/theme/Layout.vue", "pages/.vitepress/theme/components/AlertBanner.vue"],
            "risks": ["Banner must be easily dismissible to prevent annoying repeated visitors"],
            "verify": ["Triggering maintenance flag displays notice banner above top navbar"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Migration Green", "#10B981"], ["Line Gray", "#CBD5E1"], ["Code Bg", "#0D1117"]],
        "facts": {"Type": "Database Architecture Timeline", "Effort": "S", "Needs": "Parse migrations dir at build"},
        "spec": {
            "today": ["Migrations only exist in supabase/migrations/ on the git filesystem"],
            "proposed": ["Visual migration timeline on status page showing recent schema changes"],
            "files": ["pages/status.md", "pages/status.data.ts", "scripts/pages_sync.mjs"],
            "risks": ["Do not expose sensitive seed data or secret variables in public SQL logs"],
            "verify": ["Timeline displays recent migrations (e.g. 20261019_weehours_multiple_children.sql)"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Heatmap 0", "#EBEDF0"], ["Heatmap 2", "#40C463"], ["Heatmap 4", "#216E39"]],
        "facts": {"Type": "Momentum Visualization", "Effort": "S", "Needs": "Git commit log extractor script"},
        "spec": {
            "today": ["No commit activity or shipping frequency visualization on the site"],
            "proposed": ["52-week SVG commit activity heatmap embedded on status page"],
            "files": ["pages/status.md", "pages/status.data.ts", "pages/.vitepress/theme/components/CommitHeatmap.vue"],
            "risks": ["Generate heatmap SVG at build time to avoid client-side git log parsing"],
            "verify": ["Heatmap displays daily commit squares matching git log history"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Fail Red", "#EF4444"], ["Terminal Dark", "#0D1117"], ["Hint Slate", "#94A3B8"]],
        "facts": {"Type": "Developer Diagnostics", "Effort": "S", "Needs": "GitHub Actions API run logs fetch"},
        "spec": {
            "today": ["Failing workflows only display a static red dot with no diagnostic context"],
            "proposed": ["Expandable failure diagnosis drawer highlighting error step and fix command"],
            "files": ["pages/status.md", "pages/.vitepress/theme/StatusBoard.vue"],
            "risks": ["Keep error logs concise to prevent visual overload on status page"],
            "verify": ["Clicking diagnosis drawer reveals exact step failure and recommended script"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["RSS Orange", "#F97316"], ["Feed Slate", "#0F172A"], ["Button Tint", "#EEF2FF"]],
        "facts": {"Type": "Syndication & Feeds", "Effort": "S", "Needs": "VitePress feed plugin / custom generator"},
        "spec": {
            "today": ["No RSS or Atom feed exists for releases or documentation updates"],
            "proposed": ["Build-time RSS/Atom feed generation at pages/feed.rss and pages/feed.json"],
            "files": ["pages/.vitepress/config.mts", "scripts/pages_sync.mjs"],
            "risks": ["Validate feed XML output with W3C feed validator"],
            "verify": ["Subscribing in NetNewsWire or Reeder parses releases correctly"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
            "Green match indicator: '✓ SHA-256 Hash Matches Official GitHub Release'",
            "Displays Apple Developer ID team certificate name: `HEJI Technology LLC`"
        ],
        "palette": [["Verify Green", "#10B981"], ["Drop Slate", "#F8FAFC"], ["Border Dash", "#94A3B8"]],
        "facts": {"Type": "Security & Cryptographic Verification", "Effort": "S", "Needs": "Web Crypto crypto.subtle.digest"},
        "spec": {
            "today": ["Users must manually run `shasum -a 256` in terminal to verify downloads"],
            "proposed": ["Browser-based drag-and-drop checksum verifier on the downloads page"],
            "files": ["pages/status.md", "pages/.vitepress/theme/components/ChecksumVerifier.vue"],
            "risks": ["File bytes stay 100% on device; no upload occurs"],
            "verify": ["Dropping downloaded DMG verifies SHA-256 hash in <1 second"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 5: Documentation Ergonomics & Deep Reading (C41 - C50)
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
        "palette": [["Progress Bar", "#2F5BEA"], ["Active TOC", "#2F5BEA"], ["Border Light", "#E2E8F0"]],
        "facts": {"Type": "Reading Ergonomics", "Effort": "S", "Needs": "Scroll listener in VitePress layout"},
        "spec": {
            "today": ["No reading progress bar; right aside TOC is static and lacks progress cues"],
            "proposed": ["Floating reading progress bar and active section highlight scroll spy"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/.vitepress/theme/Layout.vue"],
            "risks": ["Ensure smooth 60fps performance using passive scroll event listeners"],
            "verify": ["Scrolling document smoothly fills reading bar from 0% to 100%"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Code Slate", "#0D1117"], ["Tab Active", "#1F6FEB"], ["Copy Green", "#10B981"]],
        "facts": {"Type": "Developer Documentation Ergonomics", "Effort": "S", "Needs": "VitePress code-group enhancement"},
        "spec": {
            "today": ["Code snippets only display single fixed npm or bash commands"],
            "proposed": ["Synchronized multi-package manager code tabs across all docs"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/.vitepress/config.mts"],
            "risks": ["Persist selected package manager in localStorage cleanly"],
            "verify": ["Switching to 'bun' updates all terminal code blocks to bun install"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Modal Dark", "rgba(15,23,42,0.85)"], ["Icon Slate", "#94A3B8"], ["Diagram Bg", "#FFFFFF"]],
        "facts": {"Type": "Diagram UX", "Effort": "S", "Needs": "Lightbox modal on .mermaid elements"},
        "spec": {
            "today": ["Mermaid diagrams render inline at fixed width with horizontal scroll on small screens"],
            "proposed": ["Click-to-zoom modal with pan/pinch navigation for all Mermaid diagrams"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/.vitepress/theme/components/MermaidZoom.vue"],
            "risks": ["Ensure touch pinch gestures work naturally on mobile"],
            "verify": ["Clicking architecture diagram opens modal and enables mouse dragging"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Accent Border", "#3B82F6"], ["Block Bg", "#F8FAFC"], ["Text Slate", "#475569"]],
        "facts": {"Type": "Progressive Disclosure", "Effort": "S", "Needs": "CSS details styling in custom.css"},
        "spec": {
            "today": ["All technical details dumped in monolithic paragraphs without visual separation"],
            "proposed": ["Collapsible 'Under the Hood' blocks for deep code and architecture dives"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/waypack/design.md"],
            "risks": ["Ensure collapsed content remains accessible via browser Cmd+F search"],
            "verify": ["Clicking summary rotates chevron and reveals CoreML quantization spec"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Hover Icon", "#94A3B8"], ["Edit Blue", "#2F5BEA"], ["Feedback Purple", "#6D5BD0"]],
        "facts": {"Type": "Community Feedback Loop", "Effort": "S", "Needs": "Markdown heading anchor wrapper"},
        "spec": {
            "today": ["Single generic 'Edit this page on GitHub' link at very bottom of document"],
            "proposed": ["Inline hover triggers next to every heading for GitHub edits and FeedbackKit pins"],
            "files": ["pages/.vitepress/theme/Layout.vue", "pages/.vitepress/theme/index.ts"],
            "risks": ["Avoid interfering with copy-paste selection of heading text"],
            "verify": ["Hovering heading shows pencil icon linking to exact file line on GitHub"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c46",
        "n": 46,
        "name": "Document Metadata Header (Reading Time & Level)",
        "group": "docs",
        "tagline": "Top meta ribbon displaying reading time (4 min read), target audience, and updated date",
        "concept": "Sets reader expectations immediately. At the top of each guide or specification, a clean metadata strip indicates reading duration (e.g. `⏱️ 5 min read`), target skill level (`Intermediate / Mobile Dev`), and last verified commit date.",
        "moves": [
            "Horizontal metadata bar positioned immediately below document title",
            "Reading time calculated dynamically from markdown word count",
            "Skill badge tags: 'Architecture', 'Swift / Kotlin', 'Supabase SQL'",
            "Last verified date and commit SHA hash"
        ],
        "palette": [["Meta Slate", "#64748B"], ["Badge Tint", "#F1F5F9"], ["Clock Blue", "#2F5BEA"]],
        "facts": {"Type": "Metadata & Orientation", "Effort": "S", "Needs": "Frontmatter parser helper"},
        "spec": {
            "today": ["Documents jump straight from title to prose with zero duration or skill metadata"],
            "proposed": ["Document metadata header indicating estimated reading time and prerequisites"],
            "files": ["pages/.vitepress/theme/components/DocMeta.vue", "pages/.vitepress/theme/Layout.vue"],
            "risks": ["Keep calculation lightweight during VitePress build"],
            "verify": ["Opening pages/waypack/design.md displays '4 min read · Systems Architecture'"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Crumb Slate", "#64748B"], ["Crumb Active", "#0F172A"], ["Divider Slash", "#CBD5E1"]],
        "facts": {"Type": "Navigation & SEO Breadcrumbs", "Effort": "S", "Needs": "Breadcrumb component in theme"},
        "spec": {
            "today": ["No breadcrumb navigation exists on documentation pages"],
            "proposed": ["Hierarchical breadcrumbs with embedded app icons and sibling dropdown menus"],
            "files": ["pages/.vitepress/theme/components/Breadcrumbs.vue", "pages/.vitepress/theme/Layout.vue"],
            "risks": ["Ensure breadcrumbs wrap gracefully on narrow smartphone screens"],
            "verify": ["Breadcrumb trail reflects current URL path and provides working parent links"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Key Bg", "#F1F5F9"], ["Key Border", "#CBD5E1"], ["Shortcut Blue", "#2F5BEA"]],
        "facts": {"Type": "Keyboard Accessibility & Flow", "Effort": "S", "Needs": "Global keydown event listener"},
        "spec": {
            "today": ["Documentation only navigable via mouse scrolling or clicking sidebar links"],
            "proposed": ["Vim/reader keyboard shortcuts enabling rapid hands-on-keyboard reading"],
            "files": ["pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/components/KeyboardHelper.vue"],
            "risks": ["Disable shortcuts when user is focused inside an input or textarea"],
            "verify": ["Pressing 'j' smoothly scrolls view down to next section heading"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Warm Sepia", "#FBF7F1"], ["Walnut Ink", "#2B221C"], ["OLED Black", "#000000"]],
        "facts": {"Type": "Reading Accessibility", "Effort": "S", "Needs": "CSS data-reader-theme attributes"},
        "spec": {
            "today": ["Only two binary themes supported (default light and default dark)"],
            "proposed": ["Dedicated Warm Sepia and OLED True Black reader themes for long-form docs"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/.vitepress/theme/components/ReaderThemePicker.vue"],
            "risks": ["Ensure syntax highlighting contrast meets WCAG AA in sepia mode"],
            "verify": ["Selecting Warm Sepia sets background to #FBF7F1 with warm typography"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c50",
        "n": 50,
        "name": "i18n Multi-Language Ready Structure",
        "group": "docs",
        "tagline": "Language switcher dropdown structure prepared for international developer localization",
        "concept": "Prepares HEJI Apps for global reach. Adds a clean language selector in the navbar supporting English (default), Japanese, and Chinese, with locale-specific route fallbacks (`/ja/waypack/`, `/zh/waypack/`) supported natively by VitePress.",
        "moves": [
            "Globe language dropdown in top navbar: 🌐 English (US), 日本語, 简体中文",
            "Configures VitePress `locales` configuration cleanly in `config.mts`",
            "Automatic fallback to English for un-translated documentation pages",
            "Detects browser preferred language on first visit"
        ],
        "palette": [["Globe Slate", "#64748B"], ["Dropdown Bg", "#FFFFFF"], ["Active Lang", "#2F5BEA"]],
        "facts": {"Type": "Internationalization (i18n)", "Effort": "S", "Needs": "VitePress locales config structure"},
        "spec": {
            "today": ["Site hardcoded to English with no i18n locale routing"],
            "proposed": ["VitePress i18n structure with locale switcher dropdown in top navigation"],
            "files": ["pages/.vitepress/config.mts", "pages/.vitepress/theme/components/LanguagePicker.vue"],
            "risks": ["Maintain English as authoritative source of truth for all technical docs"],
            "verify": ["Clicking language dropdown shows supported locale links"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 6: MCP Server Catalog & AI Agent Playground (C51 - C60)
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
        "palette": [["Claude Orange", "#D97706"], ["Code Black", "#0D1117"], ["Copy Green", "#10B981"]],
        "facts": {"Type": "AI Tooling Onboarding", "Effort": "S", "Needs": "JSON config generator widget"},
        "spec": {
            "today": ["MCP configuration instructions scattered across individual project READMEs"],
            "proposed": ["Unified 1-click config generator for Claude Desktop, Cursor, and Antigravity"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/McpConfigGenerator.vue"],
            "risks": ["Ensure JSON syntax remains strictly valid without trailing commas"],
            "verify": ["Clicking 'Copy Config' copies valid JSON snippet ready for claude_desktop_config.json"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["MCP Violet", "#6366F1"], ["Response Green", "#10B981"], ["Sandbox Slate", "#0F172A"]],
        "facts": {"Type": "Developer Interactive Sandbox", "Effort": "M", "Needs": "Mock JSON-RPC tool dispatcher"},
        "spec": {
            "today": ["No way to test or inspect MCP tool schemas directly in the browser"],
            "proposed": ["In-browser MCP tool explorer with simulated JSON-RPC request/response runner"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/McpToolRunner.vue"],
            "risks": ["Simulate responses accurately based on the app's real TypeScript tool schemas"],
            "verify": ["Running waypack.list_trips returns sample trips in standard MCP tool response shape"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Check Green", "#10B981"], ["Agent Slate", "#0F172A"], ["Matrix Border", "#E2E8F0"]],
        "facts": {"Type": "Ecosystem Compatibility", "Effort": "S", "Needs": "Compatibility data table in kit"},
        "spec": {
            "today": ["No public compatibility matrix for supported AI agent runtimes"],
            "proposed": ["Matrix table showing verified compatibility across Claude, Antigravity, Cursor"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/AgentMatrix.vue"],
            "risks": ["Update matrix when new agent frameworks release major updates"],
            "verify": ["Matrix lists Claude Desktop, Antigravity, and Cursor with green verified badges"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Step Blue", "#2F5BEA"], ["Step Done", "#10B981"], ["Terminal Black", "#0D1117"]],
        "facts": {"Type": "Developer Onboarding", "Effort": "S", "Needs": "Stepper component in Vue"},
        "spec": {
            "today": ["Setup commands buried in markdown docs without interactive stepper guidance"],
            "proposed": ["3-step interactive setup wizard showing command progression and verification"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/CliWizard.vue"],
            "risks": ["Keep commands cross-platform (macOS and Linux zsh/bash)"],
            "verify": ["Stepping through wizard shows copyable commands for each installation phase"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Security Shield", "#10B981"], ["Warning Tag", "#F59E0B"], ["Card Surface", "#FFFFFF"]],
        "facts": {"Type": "Security & Transparency", "Effort": "S", "Needs": "Permissions audit table in kit"},
        "spec": {
            "today": ["No centralized security or permissions matrix for MCP tool servers"],
            "proposed": ["Privacy and permissions sheet documenting local file access and network egress"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/SecurityMatrix.vue"],
            "risks": ["Ensure security declarations accurately reflect codebase behavior"],
            "verify": ["Table proves Waypack MCP requires zero network access (100% local SQLite read)"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Tree Branch", "#94A3B8"], ["Type Blue", "#3B82F6"], ["Schema Slate", "#0D1117"]],
        "facts": {"Type": "Schema Documentation", "Effort": "S", "Needs": "JSON schema tree renderer component"},
        "spec": {
            "today": ["Schemas only viewable in raw JSON files in monorepo packages"],
            "proposed": ["Interactive tree schema viewer with type annotations and copy TypeScript button"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/SchemaExplorer.vue"],
            "risks": ["Tree must expand and collapse smoothly without layout jump"],
            "verify": ["Clicking trip_bundle schema expands itinerary array and waypoint properties"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Showcase Violet", "#8B5CF6"], ["Review Card", "#FFFFFF"], ["Star Gold", "#F59E0B"]],
        "facts": {"Type": "Process Transparency & Agent Showcase", "Effort": "S", "Needs": "Archive report index"},
        "spec": {
            "today": ["Candidate review sites remain local in reports/ and are not showcased on the public site"],
            "proposed": ["Gallery section showcasing candidate review sites and agent design decisions"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/ReviewShowcase.vue"],
            "risks": ["Only showcase polished, archived reviews with user permissions"],
            "verify": ["Gallery displays card for ios-home-redesign and weehours-watch-redesign"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Benchmark Blue", "#2F5BEA"], ["Speed Green", "#10B981"], ["Table Border", "#E2E8F0"]],
        "facts": {"Type": "ML Benchmarks & Evals", "Effort": "S", "Needs": "Benchmark data table in kit"},
        "spec": {
            "today": ["Evaluation results only stored in YAML/CSV files inside projects/voxbrief/evals/"],
            "proposed": ["Public ML evaluation benchmark table on the documentation site"],
            "files": ["pages/voxbrief/index.md", "pages/monorepo.md", "pages/.vitepress/theme/components/MlBenchmarks.vue"],
            "risks": ["Label estimates versus measured numbers accurately per monorepo rules"],
            "verify": ["Table displays Whisper base latency on M2 Mac: 240ms measured"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Prompt Amber", "#F59E0B"], ["Prompt Slate", "#0F172A"], ["Copy Blue", "#2F5BEA"]],
        "facts": {"Type": "Prompt Engineering Library", "Effort": "S", "Needs": "Prompt templates array in kit"},
        "spec": {
            "today": ["No system prompts or pairing guides available on the documentation site"],
            "proposed": ["System prompt catalog tailored for Claude Desktop and Antigravity pairings"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/PromptLibrary.vue"],
            "risks": ["Ensure prompts stay updated when tool schemas change"],
            "verify": ["Copying 'Trip Planner' prompt copies valid system prompt targeting Waypack tools"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Step Thought", "#6366F1"], ["Step Tool", "#10B981"], ["Trace Slate", "#0F172A"]],
        "facts": {"Type": "Agent Interaction Design", "Effort": "M", "Needs": "Trace stepper component in kit"},
        "spec": {
            "today": ["No visualization of how MCP tools are invoked during an AI agent session"],
            "proposed": ["Visual execution trace demonstrating end-to-end prompt-to-bundle journey"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/AgentTrace.vue"],
            "risks": ["Keep trace concise and easy to read without overwhelming technical clutter"],
            "verify": ["Stepping through trace demonstrates tool call parameters and resulting bundle"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    }
]
