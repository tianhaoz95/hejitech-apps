"""
Candidates Part 3: Group 7 (FeedbackKit C61-C70), Group 8 (Mobile C71-C80), Group 9 (Monorepo C81-C90), Group 10 (Polish C91-C100)
"""

CANDIDATES_PART3 = [
    # ── Group 7: Feedback Loop & Autonomous Agent Triage (C61 - C70)
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
        "palette": [["Kanban Slate", "#F1F5F9"], ["PR Purple", "#8B5CF6"], ["Verified Green", "#10B981"]],
        "facts": {"Type": "Autonomous Agent Pipeline UX", "Effort": "M", "Needs": "FeedbackKit MCP / GitHub API integration"},
        "spec": {
            "today": ["FeedbackKit feedback loop operates behind the scenes without public transparency"],
            "proposed": ["Public Kanban board on the website tracking bug reports through agent fixes to verified builds"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/FeedbackKanban.vue"],
            "risks": ["Redact personal reporter email addresses to preserve privacy"],
            "verify": ["Kanban displays recent agent PRs and reporter verification status"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Banner Green", "#ECFDF5"], ["Button Yes", "#059669"], ["Button No", "#EF4444"]],
        "facts": {"Type": "Reporter Feedback Verification", "Effort": "S", "Needs": "FeedbackKit.enableFixVerification()"},
        "spec": {
            "today": ["Fix verification works internally in feedbackkit-web but is not showcased visually"],
            "proposed": ["Visual banner demonstration showing the 'Is it fixed?' user verification interaction"],
            "files": ["pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/components/VerificationDemo.vue"],
            "risks": ["Ensure verification prompt only appears for users with active report cookies"],
            "verify": ["Clicking 'Yes, it works' confirms fix and displays verified status badge"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Annotation Red", "#EF4444"], ["Blur Gray", "rgba(0,0,0,0.5)"], ["Canvas Bg", "#F8FAFC"]],
        "facts": {"Type": "Interactive Feature Sandbox", "Effort": "M", "Needs": "Canvas annotation tool in Vue"},
        "spec": {
            "today": ["No interactive demonstration of screenshot drawing or redaction tools"],
            "proposed": ["Interactive canvas sandbox demonstrating FeedbackKit screenshot annotation"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/AnnotationDemo.vue"],
            "risks": ["Keep canvas implementation lightweight with touch drawing support"],
            "verify": ["Dragging across canvas applies red highlight arrow or blur rectangle"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Diff Add", "#ECFDF5"], ["Diff Del", "#FEF2F2"], ["Diff Border", "#CBD5E1"]],
        "facts": {"Type": "Code Diff Viewer", "Effort": "S", "Needs": "Pre-formatted diff viewer component"},
        "spec": {
            "today": ["No code diffs showcasing agent-authored PRs on the public site"],
            "proposed": ["Embedded split diff viewer showing before/after code changes for recent bug fixes"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/AgentDiffViewer.vue"],
            "risks": ["Select real, high-quality bug fixes from repository history"],
            "verify": ["Diff viewer highlights clean additions and passing unit test indicators"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Swift Orange", "#F05138"], ["Kotlin Purple", "#7F52FF"], ["Flutter Blue", "#02569B"]],
        "facts": {"Type": "Developer Onboarding & SDK Setup", "Effort": "S", "Needs": "SDK code templates array"},
        "spec": {
            "today": ["SDK setup instructions scattered across individual platform README files"],
            "proposed": ["Unified interactive SDK initialization snippet generator for all 5 platforms"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/SdkGenerator.vue"],
            "risks": ["Verify snippets match latest 1.0.62 release conventions"],
            "verify": ["Selecting Swift generates valid FeedbackKit.configure() Swift snippet"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Upvote Purple", "#8B5CF6"], ["Planned Blue", "#3B82F6"], ["Shipped Green", "#10B981"]],
        "facts": {"Type": "Product Roadmap & Voting", "Effort": "M", "Needs": "Roadmap item store with vote counters"},
        "spec": {
            "today": ["No public roadmap or user voting mechanism on the site"],
            "proposed": ["Interactive community roadmap with upvoting and shipping status chips"],
            "files": ["pages/status.md", "pages/.vitepress/theme/components/PublicRoadmap.vue"],
            "risks": ["Prevent voting spam by storing upvoted IDs in localStorage"],
            "verify": ["Clicking upvote increments counter and persists state"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },
    {
        "id": "c67",
        "n": 67,
        "name": "Feedback Resolution SLA & Velocity Ticker",
        "group": "feedbackkit",
        "tagline": "Metrics widget highlighting median turnaround time (Median Bug Fix Time: 42 minutes)",
        "concept": "Proves the unprecedented speed of pairing human developers with autonomous coding agents. A live metric widget displays real resolution stats: 'Median time from user report to automated PR: 42 minutes · 88% verification rate'.",
        "moves": [
            "Resolution velocity ribbon: Median Triage Time, Median PR Creation Time, Reporter Verification Rate",
            "Displays active autonomous agent runner health",
            "Cites real recent turnaround examples from git commit history",
            "Demonstrates the power of the FeedbackKit dogfooding loop"
        ],
        "palette": [["Velocity Blue", "#2F5BEA"], ["Speed Emerald", "#10B981"], ["Metric Card", "#FFFFFF"]],
        "facts": {"Type": "Velocity Telemetry", "Effort": "S", "Needs": "Turnaround time calculations in kit"},
        "spec": {
            "today": ["No resolution velocity metrics shown on the public site"],
            "proposed": ["Live velocity ticker showing median agent bug fix turnaround times"],
            "files": ["pages/status.md", "pages/feedbackkit.md", "pages/.vitepress/theme/components/SlaTicker.vue"],
            "risks": ["Base metrics on real GitHub issue closed timestamps"],
            "verify": ["Ticker calculates and displays real median resolution times"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Gold Star", "#F59E0B"], ["Card Surface", "#FFFFFF"], ["Text Slate", "#475569"]],
        "facts": {"Type": "Community Recognition", "Effort": "S", "Needs": "Hall of fame array in kit"},
        "spec": {
            "today": ["No public recognition of beta testers who report issues"],
            "proposed": ["Dogfooding Hall of Fame section celebrating reporters whose bugs were resolved"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/HallOfFame.vue"],
            "risks": ["Always respect reporter privacy by using handles or pseudonyms"],
            "verify": ["Hall of fame renders cards highlighting user reports and merged PR links"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Redact Red", "#EF4444"], ["Secure Green", "#10B981"], ["Shield Slate", "#0F172A"]],
        "facts": {"Type": "Privacy & Security Transparency", "Effort": "S", "Needs": "Redaction visualizer component"},
        "spec": {
            "today": ["Privacy sanitization occurs in SDK code but is not explained on the site"],
            "proposed": ["Visual simulation demonstrating client-side PII and secret redaction"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/RedactionDemo.vue"],
            "risks": ["Accurately demonstrate the real redaction regexes used in feedbackkit-web"],
            "verify": ["Slider demonstrates token being masked from Bearer eyJ... to [REDACTED]"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Console Bg", "#090D16"], ["Log Green", "#34D399"], ["Log Cyan", "#38BDF8"]],
        "facts": {"Type": "Live Agent Telemetry", "Effort": "M", "Needs": "Terminal log streamer simulator"},
        "spec": {
            "today": ["Agent execution logs only accessible to repository administrators in GitHub Actions"],
            "proposed": ["Public read-only streaming log viewer showcasing autonomous agent execution"],
            "files": ["pages/feedbackkit.md", "pages/.vitepress/theme/components/AgentLogStreamer.vue"],
            "risks": ["Strictly scrub all API keys and environment variables before streaming logs"],
            "verify": ["Terminal streams realistic test execution and PR generation output"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 8: Mobile Navigation, Responsive UX & PWA (C71 - C80)
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
        "palette": [["Bar Surface", "#FFFFFF"], ["Active Blue", "#2F5BEA"], ["Border Tint", "#E2E8F0"]],
        "facts": {"Type": "Mobile Ergonomics", "Effort": "S", "Needs": "CSS media query for mobile bar"},
        "spec": {
            "today": ["VitePress default mobile top hamburger menu is difficult to reach with one thumb"],
            "proposed": ["Ergonomic bottom navigation sheet positioned cleanly in mobile thumb zone"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/.vitepress/theme/components/MobileBottomBar.vue"],
            "risks": ["Avoid overlapping iOS Safari bottom URL bar and home indicator"],
            "verify": ["On viewports <640px, bottom navigation bar renders with instant thumb touch targets"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
            "Offline status chip: '⚡ Reading Offline (Full Cache Active)'",
            "'Add to Home Screen' prompt on iOS Safari and Android Chrome"
        ],
        "palette": [["Offline Green", "#10B981"], ["PWA Icon", "#2F5BEA"], ["Prompt Surface", "#FFFFFF"]],
        "facts": {"Type": "Offline Capabilities & PWA", "Effort": "S", "Needs": "Service worker script in pages/public"},
        "spec": {
            "today": ["GitHub Pages site fails to load if device is offline without internet connection"],
            "proposed": ["Full Service Worker offline caching enabling complete offline docs reading"],
            "files": ["pages/public/manifest.json", "pages/public/sw.js", "pages/.vitepress/config.mts"],
            "risks": ["Service worker must invalidate cache promptly on new deployment commit"],
            "verify": ["Disconnecting network in Chrome DevTools still allows smooth browsing of docs"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Snap Border", "#E2E8F0"], ["Pagination Dot", "#2F5BEA"], ["Surface Bg", "#FFFFFF"]],
        "facts": {"Type": "Touch Interaction Design", "Effort": "S", "Needs": "CSS scroll snap in custom.css"},
        "spec": {
            "today": ["All 8 apps stacked vertically in a long 2,400px high scroll list on mobile"],
            "proposed": ["Horizontal snap carousel on mobile reducing vertical scroll height by 70%"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/index.md"],
            "risks": ["Desktop screens must retain multi-column grid layout"],
            "verify": ["Swiping on mobile snaps cleanly between app cards with momentum"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Code Dark", "#0D1117"], ["Fade Gradient", "rgba(13,17,23,0)"], ["Copy Button", "#238636"]],
        "facts": {"Type": "Mobile Code UX", "Effort": "S", "Needs": "CSS mask-image in custom.css"},
        "spec": {
            "today": ["Mobile code blocks overflow awkwardly or force ugly mid-word wrapping"],
            "proposed": ["Smooth edge gradient fade and sticky copy button on mobile code blocks"],
            "files": ["pages/.vitepress/theme/custom.css"],
            "risks": ["Ensure sticky copy button doesn't obscure the end of long code lines"],
            "verify": ["Long terminal commands show right fade mask and allow smooth horizontal touch scroll"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Brand Blue", "#2F5BEA"], ["Safe Area", "#000000"], ["Surface", "#FFFFFF"]],
        "facts": {"Type": "iOS Hardware Polish", "Effort": "S", "Needs": "Viewport meta tag update in config.mts"},
        "spec": {
            "today": ["Site lacks viewport-fit=cover, causing white bars or clipping on notched iPhones"],
            "proposed": ["Full safe-area-inset support ensuring edge-to-edge styling on iPhone 15/16"],
            "files": ["pages/.vitepress/config.mts", "pages/.vitepress/theme/custom.css"],
            "risks": ["Test across both notched and notchless mobile viewports"],
            "verify": ["Top header clears Dynamic Island without content clipping"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Haptic Violet", "#8B5CF6"], ["Success Green", "#10B981"], ["Button Bg", "#EEF2FF"]],
        "facts": {"Type": "Tactile Sensory UX", "Effort": "S", "Needs": "navigator.vibrate API check"},
        "spec": {
            "today": ["Interactions provide visual feedback only with zero tactile haptics"],
            "proposed": ["Subtle 10ms haptic feedback triggers on copy buttons, tabs, and theme toggle"],
            "files": ["pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/utils/haptics.ts"],
            "risks": ["Keep vibration duration strictly under 15ms to avoid being intrusive"],
            "verify": ["Tapping 'Copy Command' triggers subtle 10ms physical vibration on mobile"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Ring Brand", "#2F5BEA"], ["Ring Track", "#CBD5E1"], ["Button Surface", "#FFFFFF"]],
        "facts": {"Type": "Scroll Ergonomics", "Effort": "S", "Needs": "Scroll progress component in Vue"},
        "spec": {
            "today": ["Users must manually swipe dozens of times to return to the top on mobile"],
            "proposed": ["Floating circular scroll progress ring button with 1-tap return to top"],
            "files": ["pages/.vitepress/theme/components/ScrollTopRing.vue", "pages/.vitepress/theme/Layout.vue"],
            "risks": ["Position button carefully so it doesn't block FeedbackKit FAB button"],
            "verify": ["Scrolling document updates circular stroke; clicking jumps smoothly to top"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Instant Green", "#10B981"], ["Button Tint", "#ECFDF5"], ["Card Surface", "#FFFFFF"]],
        "facts": {"Type": "Zero-Install Demo UX", "Effort": "S", "Needs": "Linkage to projects/*/site/"},
        "spec": {
            "today": ["Mobile web demo sites exist in projects/*/site/ but are hidden under generic Visit app links"],
            "proposed": ["Explicit 'Try Instant Web Demo' CTA button on mobile cards"],
            "files": ["pages/index.md", "pages/.vitepress/theme/components/AppCard.vue"],
            "risks": ["Ensure mobile demos are optimized for touch interaction"],
            "verify": ["Tapping 'Try Instant Demo' on ToddlerCam opens bouncy dual-camera web demo"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
            "Eliminates accidental mis-clicks between 'Visit app' and 'Docs →' buttons"
        ],
        "palette": [["Target Blue", "#2F5BEA"], ["Focus Ring", "#60A5FA"], ["Button Surface", "#F1F5F9"]],
        "facts": {"Type": "Accessibility & Touch Target Standards", "Effort": "S", "Needs": "CSS touch target audit"},
        "spec": {
            "today": ["Small tag pills and buttons have <32px touch targets, causing accidental mis-taps"],
            "proposed": ["Full 48px touch target enforcement across all buttons and clickable tags"],
            "files": ["pages/.vitepress/theme/custom.css"],
            "risks": ["Maintain tight visual spacing while expanding invisible hit area"],
            "verify": ["Lighthouse Accessibility score hits 100 on mobile audit"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Pull Brand", "#2F5BEA"], ["Spinner Gold", "#F59E0B"], ["Surface", "#F8FAFC"]],
        "facts": {"Type": "Mobile Gestural Delight", "Effort": "M", "Needs": "Touch gesture pull-to-refresh listener"},
        "spec": {
            "today": ["Refreshing status board requires hard browser page reload"],
            "proposed": ["Smooth pull-to-refresh gesture updating status board data in-place"],
            "files": ["pages/status.md", "pages/.vitepress/theme/components/PullToRefresh.vue"],
            "risks": ["Avoid conflicting with native browser pull-to-refresh in Chrome on Android"],
            "verify": ["Pulling down top of page spins HEJI logo and refreshes pipeline timestamps"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 9: Monorepo Architecture & Open Source Story (C81 - C90)
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
        "palette": [["Supabase Green", "#3ECF8E"], ["Schema Border", "#2F5BEA"], ["Diagram Dark", "#0F172A"]],
        "facts": {"Type": "Architectural Education", "Effort": "S", "Needs": "SVG schema isolation diagram in kit"},
        "spec": {
            "today": ["Isolation rules explained in markdown text in monorepo.md and supabase/GRADUATION.md"],
            "proposed": ["Interactive visual diagram illustrating database schema isolation boundaries"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/IsolationDiagram.vue"],
            "risks": ["Ensure diagram accurately reflects actual production schema namespaces"],
            "verify": ["Diagram shows isolated schemas for Waypack, Wee Hours, and Contempo"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Graduation Green", "#10B981"], ["Check Slate", "#334155"], ["Card Surface", "#FFFFFF"]],
        "facts": {"Type": "Monorepo Governance Tool", "Effort": "S", "Needs": "Graduation criteria checklist in kit"},
        "spec": {
            "today": ["Graduation rules described only in markdown in supabase/GRADUATION.md"],
            "proposed": ["Interactive graduation readiness widget on monorepo architecture page"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/GraduationCalculator.vue"],
            "risks": ["Keep checklist criteria strictly aligned with graduation_check.sh"],
            "verify": ["Widget displays passing check for Waypack schema isolation"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Tree Folder", "#3B82F6"], ["Tree File", "#64748B"], ["Explorer Dark", "#0D1117"]],
        "facts": {"Type": "Repository Exploration", "Effort": "S", "Needs": "File tree JSON map generated at build"},
        "spec": {
            "today": ["Repository layout only explained via plain text ASCII diagram in monorepo.md"],
            "proposed": ["Interactive file tree explorer allowing click-to-expand browsing of monorepo dirs"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/FileTree.vue"],
            "risks": ["Exclude bulky build artifacts like node_modules or derived build dirs"],
            "verify": ["Clicking projects/waypack expands packages, services, and apps subdirectories"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Script Slate", "#0F172A"], ["Code Green", "#10B981"], ["Brand Blue", "#2F5BEA"]],
        "facts": {"Type": "DevOps & Release Tooling", "Effort": "S", "Needs": "Script showcase cards in kit"},
        "spec": {
            "today": ["Script usage rules documented only in AGENTS.md / CLAUDE.md"],
            "proposed": ["Dedicated documentation showcase explaining shared monorepo scripts"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/ScriptShowcase.vue"],
            "risks": ["Keep CLI flags accurately synchronized with scripts/cut_release.sh"],
            "verify": ["Card accurately explains cut_release.sh --dry-run and CI-red safety guards"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["License Slate", "#1E293B"], ["Allowed Green", "#10B981"], ["Restricted Red", "#EF4444"]],
        "facts": {"Type": "Open Source Licensing Clarity", "Effort": "S", "Needs": "License explainer component"},
        "spec": {
            "today": ["License mentioned only as brief 1-line footer disclaimer"],
            "proposed": ["Interactive guide explaining PolyForm Perimeter License terms in plain English"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/LicenseGuide.vue"],
            "risks": ["Ensure legal precision while maintaining clear non-legalese explanations"],
            "verify": ["Guide clearly explains that non-commercial developer usage is 100% permitted"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Step Blue", "#2F5BEA"], ["Wizard Done", "#10B981"], ["Card Surface", "#FFFFFF"]],
        "facts": {"Type": "Developer Onboarding & Scaffolding", "Effort": "S", "Needs": "Wizard stepper in kit"},
        "spec": {
            "today": ["New project setup instructions located only in repository README and skills"],
            "proposed": ["Interactive wizard on documentation site guiding new product scaffolding"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/NewProjectWizard.vue"],
            "risks": ["Keep steps synchronized with AGENTS.md rules"],
            "verify": ["Wizard steps accurately outline projects/<name>/ layout and release.env setup"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Agent Violet", "#8B5CF6"], ["Human Amber", "#F59E0B"], ["Symlink Slate", "#0F172A"]],
        "facts": {"Type": "AI Pair Programming Architecture", "Effort": "S", "Needs": "Pair programming diagram in kit"},
        "spec": {
            "today": ["Agent pairing architecture documented only in AGENTS.md for agents to read"],
            "proposed": ["Public visual architectural guide explaining human-agent pair programming model"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/AgentPairingDiagram.vue"],
            "risks": ["Present agents as disciplined pair-programming partners, not uncontrollable bots"],
            "verify": ["Diagram illustrates shared symlinks between .claude/skills and .agents/skills"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Matrix Green", "#10B981"], ["Runner Slate", "#1E293B"], ["Apple Tint", "#000000"]],
        "facts": {"Type": "CI/CD Test Matrix", "Effort": "S", "Needs": "CI test matrix table in kit"},
        "spec": {
            "today": ["Workflows listed as raw YAML files in .github/workflows/"],
            "proposed": ["Visual cross-platform CI runner matrix on status page"],
            "files": ["pages/status.md", "pages/.vitepress/theme/components/CiMatrix.vue"],
            "risks": ["Keep runner platform versions updated when GitHub Actions updates images"],
            "verify": ["Matrix lists Ubuntu Linux and macOS Apple Silicon runner environments"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Zero Green", "#10B981"], ["Expense Slate", "#64748B"], ["Card Bg", "#FFFFFF"]],
        "facts": {"Type": "Financial & Operational Transparency", "Effort": "S", "Needs": "Cost table in kit"},
        "spec": {
            "today": ["No operational cost transparency on the website"],
            "proposed": ["Infrastructure cost breakdown table inspiring sustainable indie software architecture"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/CostBreakdown.vue"],
            "risks": ["Clearly explain the threshold at which individual projects graduate to own tiers"],
            "verify": ["Table demonstrates $0 GitHub Pages hosting and shared $25/mo Supabase database"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["GitHub Black", "#24292F"], ["Star Gold", "#E3B341"], ["Pill Border", "#D0D7DE"]],
        "facts": {"Type": "Open Source Social Proof", "Effort": "S", "Needs": "GitHub repository metadata API fetch"},
        "spec": {
            "today": ["Navbar has simple plain GitHub SVG icon without star counts or release tags"],
            "proposed": ["Interactive GitHub repository pill displaying stars, release tag, and commit count"],
            "files": ["pages/.vitepress/config.mts", "pages/.vitepress/theme/components/GitHubPill.vue"],
            "risks": ["Use build-time cached star counts to avoid GitHub API rate limiting"],
            "verify": ["Pill displays live repository star count and links to GitHub"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    },

    # ── Group 10: Micro-Interactions, Polish & Delight (C91 - C100)
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
        "palette": [["Modal Overlay", "rgba(15,23,42,0.6)"], ["Kbd Surface", "#F1F5F9"], ["Kbd Border", "#CBD5E1"]],
        "facts": {"Type": "Keyboard Accessibility & Discovery", "Effort": "S", "Needs": "Global keydown '?' listener"},
        "spec": {
            "today": ["No shortcut cheatsheet or discovery overlay on the site"],
            "proposed": ["Press '?' modal revealing comprehensive keyboard navigation cheatsheet"],
            "files": ["pages/.vitepress/theme/components/ShortcutModal.vue", "pages/.vitepress/theme/index.ts"],
            "risks": ["Ignore '?' when user is typing in a search bar or text input"],
            "verify": ["Pressing '?' pops up keyboard shortcut guide modal"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Pad Pink", "#EC4899"], ["Pad Blue", "#3B82F6"], ["Pad Amber", "#F59E0B"]],
        "facts": {"Type": "Sensory Easter Egg", "Effort": "S", "Needs": "Web Audio oscillator helper in kit"},
        "spec": {
            "today": ["No sound design demonstrated on the site"],
            "proposed": ["Interactive audio soundboard showcasing tactile app sounds"],
            "files": ["pages/monorepo.md", "pages/.vitepress/theme/components/Soundboard.vue"],
            "risks": ["Always respect browser user gesture requirements before playing audio"],
            "verify": ["Tapping pads plays synthetic pentatonic chimes in browser"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Transition Blue", "#2F5BEA"], ["Surface", "#FFFFFF"], ["Text Slate", "#0F172A"]],
        "facts": {"Type": "Next-Gen Web Motion", "Effort": "S", "Needs": "document.startViewTransition hook"},
        "spec": {
            "today": ["Page transitions cause standard static browser navigation flickers"],
            "proposed": ["Smooth morphing view transitions between catalog cards and doc pages"],
            "files": ["pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/custom.css"],
            "risks": ["Check browser support for document.startViewTransition before executing"],
            "verify": ["Clicking Waypack card smoothly expands card icon into document header"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Doodle Blue", "#2F5BEA"], ["Doodle Cloud", "#E0F2FE"], ["Text Dark", "#0F172A"]],
        "facts": {"Type": "404 Error Experience", "Effort": "S", "Needs": "pages/404.md template enhancement"},
        "spec": {
            "today": ["VitePress default 404 page is a plain text 'PAGE NOT FOUND' message"],
            "proposed": ["Playful 404 page with smart URL suggestions and animated monorepo doodle"],
            "files": ["pages/404.md", "pages/.vitepress/theme/NotFound.vue"],
            "risks": ["Ensure 404 page returns proper HTTP 404 status code in GitHub Pages"],
            "verify": ["Visiting /waypak suggests /waypack/ with 1-click jump"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Pure Black", "#000000"], ["Pure White", "#FFFFFF"], ["Focus Blue", "#1D4ED8"]],
        "facts": {"Type": "Accessibility (WCAG AAA)", "Effort": "S", "Needs": "CSS high contrast tokens"},
        "spec": {
            "today": ["Standard light/dark modes meet WCAG AA but not full AAA high-contrast standards"],
            "proposed": ["Dedicated WCAG AAA high-contrast mode with bold borders and zero motion"],
            "files": ["pages/.vitepress/theme/custom.css", "pages/.vitepress/theme/components/A11yToggle.vue"],
            "risks": ["Ensure high-contrast mode does not break visual hierarchy"],
            "verify": ["Lighthouse Accessibility audit confirms 100% WCAG AAA color compliance"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Particle Blue", "#2F5BEA"], ["Particle Purple", "#8B5CF6"], ["Particle Gold", "#F59E0B"]],
        "facts": {"Type": "Micro-Delight Animation", "Effort": "S", "Needs": "Micro-canvas confetti script"},
        "spec": {
            "today": ["Copy buttons display a simple static checkmark with no celebratory delight"],
            "proposed": ["Subtle micro confetti burst celebrating code copy and feedback actions"],
            "files": ["pages/.vitepress/theme/utils/confetti.ts", "pages/.vitepress/theme/index.ts"],
            "risks": ["Disables automatically if prefers-reduced-motion is active"],
            "verify": ["Clicking Copy emits 12 colorful particle specks that gently fall and dissolve"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Brand Blue", "#2F5BEA"], ["Button Hover", "#1D4ED8"], ["Glow Tint", "rgba(47,91,234,0.2)"]],
        "facts": {"Type": "Cursor Craft & Physics", "Effort": "S", "Needs": "Pointermove spring listener"},
        "spec": {
            "today": ["Buttons have standard static CSS hover state with no magnetic physics"],
            "proposed": ["Magnetic spring attraction on primary hero buttons for fine pointer devices"],
            "files": ["pages/.vitepress/theme/utils/magnetic.ts", "pages/.vitepress/theme/index.ts"],
            "risks": ["Must not activate on touchscreens or trackpads with coarse pointers"],
            "verify": ["Moving cursor near button causes gentle 4px pull toward pointer"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Dot Green", "#10B981"], ["Dot Amber", "#F59E0B"], ["Dot Red", "#EF4444"]],
        "facts": {"Type": "Ambient Browser Tab Telemetry", "Effort": "S", "Needs": "Canvas favicon generator script"},
        "spec": {
            "today": ["Favicon is a static SVG icon that never changes"],
            "proposed": ["Dynamic canvas-rendered favicon reflecting live monorepo CI status"],
            "files": ["pages/.vitepress/theme/utils/dynamicFavicon.ts", "pages/.vitepress/theme/index.ts"],
            "risks": ["Avoid updating favicon too frequently to prevent browser tab flickering"],
            "verify": ["Favicon displays tiny green indicator dot when CI workflows pass"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Sync Cyan", "#06B6D4"], ["Tab Blue", "#2F5BEA"], ["Surface", "#FFFFFF"]],
        "facts": {"Type": "Multi-Tab Cross-Window State", "Effort": "S", "Needs": "BroadcastChannel API in theme"},
        "spec": {
            "today": ["Changing theme in one tab leaves other open tabs out of sync until hard reload"],
            "proposed": ["BroadcastChannel synchronization updating all open tabs in real-time"],
            "files": ["pages/.vitepress/theme/index.ts", "pages/.vitepress/theme/utils/broadcast.ts"],
            "risks": ["Ensure BroadcastChannel falls back gracefully in older browser engines"],
            "verify": ["Toggling dark theme in Tab A instantly changes Tab B to dark theme without reload"]
        },
        "render_code": """({ dark }) => `
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
        `"""
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
        "palette": [["Print White", "#FFFFFF"], ["Print Black", "#000000"], ["Paper Gray", "#71717A"]],
        "facts": {"Type": "Print & PDF Export Quality", "Effort": "S", "Needs": "@media print block in custom.css"},
        "spec": {
            "today": ["Printing documentation results in dark background ink waste and clipped navigation bars"],
            "proposed": ["Clean print stylesheet producing elegant black-and-white archival PDFs"],
            "files": ["pages/.vitepress/theme/custom.css"],
            "risks": ["Avoid page-break inside code blocks or diagrams using page-break-inside: avoid"],
            "verify": ["Triggering browser Print dialog shows clean, distraction-free document layout"]
        },
        "render_code": """({ dark }) => `
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
        `"""
    }
]
