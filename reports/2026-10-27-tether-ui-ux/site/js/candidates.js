// Tether UI & UX Design Candidates
// 10 distinctive design directions + today's baseline (0) for external monitor desktop & phone companion
(() => {
  const { icon: I, presetThumb, data, renderPhoneController } = KIT;

  // Helper to render candidate monitor chrome
  const renderTopBar = (cId, opts = {}) => {
    const { title = "TETHER", display = data.display.res, extra = "" } = opts;
    return `
      <div class="c-topbar">
        <div class="c-brand-cluster">
          <span class="c-logo-badge">⚡</span>
          <span class="c-brand-title">${title}</span>
          <span class="c-display-badge">${display}</span>
        </div>
        <div class="c-bar-center">${extra}</div>
        <div class="c-bar-actions">
          <button class="c-btn" title="Command Palette (⌘K)"><span class="kbd">⌘K</span></button>
          <div class="c-preset-group">
            <button class="c-btn-preset" title="Single Pane">${presetThumb(1)}</button>
            <button class="c-btn-preset" title="Two Columns">${presetThumb(2)}</button>
            <button class="c-btn-preset active" title="1 Left + 2 Right">${presetThumb(3, true)}</button>
            <button class="c-btn-preset" title="2x2 Grid">${presetThumb(4)}</button>
          </div>
          <button class="c-btn" title="Hosts & Keys">${I("key", 14)} <span>Hosts</span></button>
          <button class="c-btn icon-only" title="Settings">${I("settings", 15)}</button>
        </div>
      </div>
    `;
  };

  // Helper to render web pane content
  const renderWebPane = (isFocused = false) => `
    <div class="p-pane pane-web ${isFocused ? "focused" : ""}">
      <div class="p-header">
        <div class="p-tabs">
          <div class="p-tab active">${I("web", 13)} <span>PR #18 · Tether VT100</span> <span class="p-tab-close">×</span></div>
          <div class="p-tab">${I("web", 13)} <span>Docker Docs</span> <span class="p-tab-close">×</span></div>
          <button class="p-tab-new" title="New Tab">+</button>
        </div>
        <div class="p-controls">
          <span class="p-tag web">WEB</span>
          <button class="p-action" title="Split Horizontal">${I("splitH", 13)}</button>
          <button class="p-action" title="Split Vertical">${I("splitV", 13)}</button>
          <button class="p-action" title="Maximise">${I("max", 13)}</button>
        </div>
      </div>
      <div class="p-browser-nav">
        <button class="p-nav-btn">${I("chevron", 12)}</button>
        <button class="p-nav-btn rotate">${I("refresh", 12)}</button>
        <div class="p-url-bar">
          <span class="p-ssl">${I("lock", 12)}</span>
          <span class="p-url-text">https://github.com/hejitech-apps/hejitech-apps/pull/18</span>
        </div>
      </div>
      <div class="p-browser-body">
        <div class="mock-pr-header">
          <div class="pr-badge open">Open</div>
          <span class="pr-title">feat(tether): VT100 alternate buffer & 10k scrollback</span>
          <span class="pr-meta">#18 opened 2 hours ago by @tianhaoz · 3 commits · 4 files</span>
        </div>
        <div class="mock-pr-diff">
          <div class="diff-file-header"><span>projects/tether/apps/ios/TetherKit/SshTerminalEngine.swift</span></div>
          <div class="diff-line del">- let maxScrollback: Int = 1000</div>
          <div class="diff-line add">+ let maxScrollback: Int = 10_000 // PRD §2.4 requirement</div>
          <div class="diff-line add">+ func handleAlternateScreenBuffer(decset: Int) { ... }</div>
        </div>
      </div>
    </div>
  `;

  // Helper to render ssh pane content
  const renderSshPane = (isFocused = true) => `
    <div class="p-pane pane-ssh ${isFocused ? "focused" : ""}">
      <div class="p-header">
        <div class="p-tabs">
          <div class="p-tab active">${I("ssh", 13)} <span>root@prod-api-us-east</span> <span class="p-tab-close">×</span></div>
          <button class="p-tab-new" title="New SSH Tab">+</button>
        </div>
        <div class="p-controls">
          <span class="p-ping">● 22ms</span>
          <span class="p-tag ssh">SSH</span>
          <button class="p-action" title="Split Horizontal">${I("splitH", 13)}</button>
          <button class="p-action" title="Split Vertical">${I("splitV", 13)}</button>
          <button class="p-action" title="Maximise">${I("max", 13)}</button>
        </div>
      </div>
      <div class="p-terminal-body mono">
        ${data.terminalLog.map((l) => `<div class="term-line ${l.type}">${l.line}</div>`).join("")}
      </div>
    </div>
  `;

  // Helper to render files pane content
  const renderFilesPane = (isFocused = false) => `
    <div class="p-pane pane-files ${isFocused ? "focused" : ""}">
      <div class="p-header">
        <div class="p-tabs">
          <div class="p-tab active">${I("files", 13)} <span>sftp: /var/www/dist</span> <span class="p-tab-close">×</span></div>
          <button class="p-tab-new" title="New Files Tab">+</button>
        </div>
        <div class="p-controls">
          <span class="p-tag files">SFTP</span>
          <button class="p-action" title="Split Horizontal">${I("splitH", 13)}</button>
          <button class="p-action" title="Split Vertical">${I("splitV", 13)}</button>
          <button class="p-action" title="Maximise">${I("max", 13)}</button>
        </div>
      </div>
      <div class="p-files-bar">
        <span class="p-path">/var/www/tether-api/dist/</span>
        <button class="p-insert-path-btn" title="Insert path into focused terminal">${I("terminal", 12)} Insert Path</button>
      </div>
      <div class="p-files-table">
        <div class="f-row header"><span>Name</span><span>Size</span><span>Modified</span></div>
        ${data.fileList.map((f) => `
          <div class="f-row ${f.type}">
            <span class="f-name">${f.type === "dir" ? I("files", 12) : I("code", 12)} ${f.name}</span>
            <span class="f-size">${f.size}</span>
            <span class="f-date">${f.date}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  window.REVIEW = {
    key: "2026-10-27-tether-ui-ux-v1",
    dir: "reports/2026-10-27-tether-ui-ux",
    repo: "tianhaoz95/hejitech-apps",
    port: 8818,
    project: "projects/tether",
    context: [
      "projects/tether/CLAUDE.md",
      "projects/tether/apps/ios/App/Sources/TilingWorkspaceViewController.swift",
      "projects/tether/apps/ios/App/Sources/PhoneControllerViewController.swift",
      "projects/tether/apps/ios/App/Sources/CommandPaletteViewController.swift",
      "projects/tether/services/web/src/workspace.ts"
    ],
    brief: "Propose 10 UI/UX design improvements for Tether covering monitor desktop workspace and phone companion experience across visual craft, power-user efficiency, spatial tiling, and ergonomics.",
    title: "Tether UI & UX Improvements",
    subtitle: "10 design directions + today's baseline",
    heading: "Pick a direction for Tether's desktop and controller UX",
    intro: "Each candidate reimagines Tether's external monitor tiling desktop (1280×792) and companion phone controller. Click any card to inspect full details, toggle between Monitor and Phone Controller views, heart favorites, rate, write candidate notes, and click <b>Copy summary</b>.",
    legend: ["<b>4</b> split panes (Web, SSH, Files)", "<b>3</b> phone controller modes"],
    round: 1,
    frame: "browser",
    url: "tether://workspace/desktop-mirror",
    candidates: [
      // ─────────────────────────────────────────────────────────────
      // 00. BASELINE: TODAY'S CURRENT APP (v0.1.9)
      // ─────────────────────────────────────────────────────────────
      {
        id: "baseline",
        n: 0,
        name: "Current Tether (v0.1.9)",
        baseline: true,
        tagline: "Today's baseline: Utilitarian top chrome, flat titlebars, raw buttons",
        concept: "Today's working implementation from TilingWorkspaceViewController.swift. Dark navy top bar (#05080e) with raw monospaced buttons [1] [2] [1+2] [2×2] [Split ⫿] [Split ⊟] [Swap] [Max] [Hosts & Keys]. Each pane has an ID tag (p1, p2), uppercase tab labels [WEB], [SSH], and flat borders without depth.",
        moves: [
          "Raw monospaced top chrome with text-based buttons",
          "Explicit pane IDs (p1, p2) and status tags (FOCUSED / IDLE)",
          "Simple flat 1px dividers between split views",
          "Phone companion has 3 separate bottom click buttons (Left, Drag, Right)"
        ],
        palette: [["Deep Navy", "#05080e"], ["Cyan Accent", "#38bdf8"], ["Muted Gray", "#64748b"]],
        facts: { Focus: "Utilitarian Baseline", Effort: "None (Current)", Needs: "Nothing" },
        render: () => `
          <div class="ttr-desktop baseline">
            <div class="bl-topbar">
              <span class="bl-brand">TETHER</span>
              <span class="bl-disp">${data.display.name} · ${data.display.res}</span>
              <div class="bl-spacer"></div>
              <button class="bl-btn">⌘K</button>
              <button class="bl-btn">1</button>
              <button class="bl-btn">2</button>
              <button class="bl-btn active">1+2</button>
              <button class="bl-btn">2×2</button>
              <button class="bl-btn">Split ⫿</button>
              <button class="bl-btn">Split ⊟</button>
              <button class="bl-btn">Swap</button>
              <button class="bl-btn">Max</button>
              <button class="bl-btn">Hosts & Keys</button>
              <button class="bl-btn">⚙︎</button>
            </div>
            <div class="bl-workspace">
              <div class="bl-col left" style="flex: 1.1;">
                <div class="bl-pane">
                  <div class="bl-pane-bar">
                    <span>● [WEB] PR #18 · Tether VT100 (p1)</span>
                    <span class="bl-status">FOCUSED</span>
                  </div>
                  <div class="bl-pane-tabs">
                    <span class="bl-tab active">[WEB] PR #18 <span class="x">×</span></span>
                    <span class="bl-tab">[WEB] Docker Docs <span class="x">×</span></span>
                    <button class="bl-add">+ Web</button>
                    <button class="bl-add">+ SSH</button>
                    <button class="bl-add">+ Files</button>
                  </div>
                  <div class="bl-url-row">
                    <span class="lock">🔒</span>
                    <span class="url">https://github.com/hejitech-apps/hejitech-apps/pull/18</span>
                  </div>
                  <div class="bl-content web">
                    <div class="mock-pr-header">
                      <div class="pr-badge open">Open</div>
                      <span class="pr-title">feat(tether): VT100 alternate buffer & 10k scrollback</span>
                    </div>
                    <div class="diff-line del">- let maxScrollback: Int = 1000</div>
                    <div class="diff-line add">+ let maxScrollback: Int = 10_000</div>
                  </div>
                </div>
              </div>
              <div class="bl-divider-v"></div>
              <div class="bl-col right" style="flex: 0.9;">
                <div class="bl-pane top" style="flex: 1;">
                  <div class="bl-pane-bar">
                    <span>● [SSH] root@prod-api-us-east (p2)</span>
                    <span class="bl-status idle">IDLE</span>
                  </div>
                  <div class="bl-pane-tabs">
                    <span class="bl-tab active">[SSH] prod-api-us-east <span class="x">×</span></span>
                  </div>
                  <div class="bl-content ssh mono">
                    ${data.terminalLog.slice(0, 5).map((l) => `<div class="term-line ${l.type}">${l.line}</div>`).join("")}
                  </div>
                </div>
                <div class="bl-divider-h"></div>
                <div class="bl-pane bottom" style="flex: 1;">
                  <div class="bl-pane-bar">
                    <span>● [FILES] sftp: /var/www/dist (p3)</span>
                    <span class="bl-status idle">IDLE</span>
                  </div>
                  <div class="bl-files-list">
                    ${data.fileList.slice(0, 5).map((f) => `<div class="bl-file-row"><span>${f.name}</span><span>${f.size}</span></div>`).join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Current)",
            frame: "phone",
            render: () => renderPhoneController("touchpad", { title: "Trackpad Surface", sub: "1-finger tap click · 2-finger scroll" }),
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 01. NORDIC FROST DOCK
      // ─────────────────────────────────────────────────────────────
      {
        id: "nordic-frost",
        n: 1,
        name: "Nordic Frost Dock",
        tagline: "Official Tether brand: Serene Scandinavian glass stagecraft",
        concept: "Translates Tether's newly adopted Nord Frost logo into an elegant, distraction-free desktop environment. A floating frosted glass pill floats at the top, pane headers are rounded with icy hairline borders, and the active focused pane breathes with a subtle aurora glow.",
        moves: [
          "Floating frosted acrylic top pill with blurred desktop backdrop",
          "Pill-shaped segmented layout presets with illuminated icons",
          "Subtle Nordic cyan glow (#88C0D0) around the focused pane",
          "Clean integrated breadcrumb bar inside each pane header",
          "Phone controller acts as an edge-to-edge ceramic touch surface"
        ],
        palette: [["Polar Night", "#2E3440"], ["Nord Frost", "#88C0D0"], ["Snow Storm", "#ECEFF4"], ["Aurora Green", "#A3BE8C"]],
        facts: { Focus: "Brand Harmony & Elegance", Effort: "M", Needs: "Backdrop blur & CSS acrylic styling" },
        render: () => `
          <div class="ttr-desktop nordic-frost">
            <div class="nf-dock-container">
              <div class="nf-floating-dock">
                <div class="nf-brand">
                  <span class="nf-logo">❄</span>
                  <span class="nf-name">Tether</span>
                  <span class="nf-chip">Studio 4K</span>
                </div>
                <div class="nf-presets">
                  <button class="nf-preset-pill">${presetThumb(1)}</button>
                  <button class="nf-preset-pill">${presetThumb(2)}</button>
                  <button class="nf-preset-pill active">${presetThumb(3, true)} <span>1+2</span></button>
                  <button class="nf-preset-pill">${presetThumb(4)}</button>
                </div>
                <div class="nf-dock-right">
                  <button class="nf-dock-btn" title="Command Palette">${I("command", 13)} <span>⌘K</span></button>
                  <button class="nf-dock-btn" title="Hosts">${I("shield", 13)} <span>3 Hosts</span></button>
                  <button class="nf-dock-btn icon-only" title="Settings">${I("settings", 14)}</button>
                </div>
              </div>
            </div>
            <div class="nf-workspace">
              <div class="nf-col left" style="flex: 1.15;">
                ${renderWebPane(false)}
              </div>
              <div class="nf-divider-v"><div class="nf-handle"></div></div>
              <div class="nf-col right" style="flex: 0.85;">
                <div class="nf-subpane" style="flex: 1.1;">
                  ${renderSshPane(true)}
                </div>
                <div class="nf-divider-h"><div class="nf-handle"></div></div>
                <div class="nf-subpane" style="flex: 0.9;">
                  ${renderFilesPane(false)}
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Nordic Glass)",
            frame: "phone",
            render: () => renderPhoneController("touchpad", { title: "Ceramic Glass Trackpad", sub: "Edge gesture: slide right border for monitor brightness" }),
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 02. CYBERPUNK TELEMETRY HUD
      // ─────────────────────────────────────────────────────────────
      {
        id: "cyber-hud",
        n: 2,
        name: "Cyberpunk Telemetry HUD",
        prefers: "dark",
        tagline: "Hacker-grade HUD: Real-time SSH vitals, scanlines & hotkey chord ribbon",
        concept: "Transforms Tether into a high-density terminal command center for power users. Live host telemetry in the top ribbon (SSH latency, CPU load, RAM usage, active cipher), CRT scanline glow on focused terminal, and a persistent keyboard chord bar at the bottom so you never forget tiling hotkeys.",
        moves: [
          "Live telemetry ribbon: ping (22ms), remote CPU/RAM stats, cipher info",
          "Scanline border glow and amber/cyan terminal colorway",
          "Persistent keyboard chord ribbon at monitor bottom for split/swap shortcuts",
          "Bracketed status tokens and monospaced cryptographic verify badges",
          "Phone companion functions as a tactile macro stream deck"
        ],
        palette: [["Void Black", "#0A0D12"], ["Cyber Cyan", "#00F0FF"], ["Amber Alert", "#FFB800"], ["Matrix Green", "#00FF66"]],
        facts: { Focus: "Power-User Telemetry", Effort: "L", Needs: "Lightweight background SSH stat probe (`uptime / vmstat`)" },
        spec: {
          today: ["Tether only opens raw SSH terminal; zero telemetry or status about remote host."],
          proposed: ["Collect non-intrusive remote stats (ping, 1m load, RAM) on connection and display in top telemetry bar."],
          files: ["projects/tether/apps/ios/TetherKit/SshTerminalEngine.swift", "projects/tether/packages/core/src/types.ts"],
          risks: ["Running extra commands over SSH might interfere with terminal session; solution: separate multiplexed channel or query on connect."],
          verify: ["Connect to SSH host → telemetry bar shows latency (22ms) and CPU load."]
        },
        design: [
          {
            kind: "flow",
            title: "Remote Telemetry Stream",
            today: {
              nodes: [
                { id: "s", label: "SSH Tab", sub: "Terminal PTY only", col: 0, row: 0, type: "ui" },
                { id: "h", label: "Remote Host", sub: "SSH Server", col: 1, row: 0, type: "service" }
              ],
              edges: [{ from: "s", to: "h", label: "interactive PTY" }]
            },
            proposed: {
              nodes: [
                { id: "s", label: "SSH Tab", sub: "Terminal PTY", col: 0, row: 0, type: "ui", state: "changed" },
                { id: "t", label: "Telemetry Daemon", sub: "ping / load / mem", col: 0, row: 1, type: "store", state: "new" },
                { id: "b", label: "HUD Top Ribbon", sub: "22ms · CPU 34%", col: 1, row: 1, type: "ui", state: "new" },
                { id: "h", label: "Remote Host", sub: "SSH Server", col: 2, row: 0, type: "service" }
              ],
              edges: [
                { from: "s", to: "h", label: "PTY stream" },
                { from: "h", to: "t", label: "channel query", state: "new" },
                { from: "t", to: "b", label: "status stream", state: "new" }
              ]
            }
          }
        ],
        render: () => `
          <div class="ttr-desktop cyber-hud">
            <div class="hud-topbar">
              <div class="hud-node">
                <span class="hud-bracket">[</span>
                <span class="hud-glyph">SYS:READY</span>
                <span class="hud-bracket">]</span>
                <span class="hud-stat host">prod-api-us-east</span>
                <span class="hud-ping">22ms</span>
              </div>
              <div class="hud-telemetry">
                <span class="hud-chip">${I("cpu", 11)} CPU: 34%</span>
                <span class="hud-chip">${I("ram", 11)} RAM: 4.2 / 16 GB</span>
                <span class="hud-chip">${I("shield", 11)} chacha20-poly1305</span>
                <span class="hud-chip">${I("wifi", 11)} USB-C DP 4K</span>
              </div>
              <div class="hud-actions">
                <button class="hud-btn active">1+2 SPLIT</button>
                <button class="hud-btn">BROADCAST: OFF</button>
                <button class="hud-btn">[⌘K] CMDS</button>
              </div>
            </div>
            <div class="hud-workspace">
              <div class="hud-col left" style="flex: 1.1;">
                ${renderWebPane(false)}
              </div>
              <div class="hud-divider-v"><div class="hud-spark"></div></div>
              <div class="hud-col right" style="flex: 0.9;">
                <div class="hud-pane-box" style="flex: 1.1;">
                  ${renderSshPane(true)}
                </div>
                <div class="hud-divider-h"><div class="hud-spark"></div></div>
                <div class="hud-pane-box" style="flex: 0.9;">
                  ${renderFilesPane(false)}
                </div>
              </div>
            </div>
            <div class="hud-chord-ribbon">
              <span class="chord-item"><b>Ctrl+Alt+\\</b> Split H</span>
              <span class="chord-item"><b>Ctrl+Alt+-</b> Split V</span>
              <span class="chord-item"><b>Ctrl+Alt+Enter</b> Maximize</span>
              <span class="chord-item"><b>Ctrl+Alt+S</b> Swap</span>
              <span class="chord-item"><b>Ctrl+Tab</b> Next Tab</span>
              <span class="chord-item"><b>Ctrl+W</b> Close Tab</span>
              <span class="chord-spacer"></span>
              <span class="chord-item sec">Encrypted Session · SHA256: 7f3a...91b</span>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Macro Stream Deck)",
            frame: "phone",
            render: () => renderPhoneController("macros", { title: "Macro Stream Deck", sub: "1-tap commands sent directly to active terminal" }),
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 03. ZEN TILING (ZERO-CHROME HYPRLAND)
      // ─────────────────────────────────────────────────────────────
      {
        id: "zen-tiling",
        n: 3,
        name: "Zen Tiling (Zero-Chrome)",
        tagline: "Pure canvas: Zero wasted pixels, borderless i3/Hyprland minimalism",
        concept: "Strikes every redundant header, titlebar, and border to give 98% of the monitor to your terminal, code, and documentation. The top bar auto-hides into a 2px top status thread that smoothly glides open only on mouse hover, and active pane focus is marked by a crisp 1.5px laser border.",
        moves: [
          "Zero-overhead window headers: no titlebars wasting vertical lines",
          "Auto-collapsing top status thread that expands on cursor approach",
          "Crisp 1.5px laser border indicating the focused pane",
          "Minimal corner tab badges for switching tabs without clutter",
          "Full-screen expansive gesture surface on phone with radial command ring"
        ],
        palette: [["OLED Black", "#08090C"], ["Laser Cyan", "#38BDF8"], ["Muted Slate", "#334155"], ["Ghost Text", "#94A3B8"]],
        facts: { Focus: "Screen Real Estate", Effort: "S", Needs: "Auto-hiding header animation" },
        render: () => `
          <div class="ttr-desktop zen-tiling">
            <div class="zen-top-thread">
              <div class="zen-thread-pill">
                <span class="zen-dot"></span>
                <span class="zen-title">TETHER · 3 PANES</span>
                <span class="zen-sub">1+2 Preset · ⌘K Command</span>
              </div>
            </div>
            <div class="zen-workspace">
              <div class="zen-pane web" style="flex: 1.2;">
                <div class="zen-corner-tag">PR #18 · GitHub</div>
                <div class="mock-pr-header">
                  <div class="pr-badge open">Open</div>
                  <span class="pr-title">feat(tether): VT100 alternate buffer & 10k scrollback</span>
                </div>
                <div class="diff-line del">- let maxScrollback: Int = 1000</div>
                <div class="diff-line add">+ let maxScrollback: Int = 10_000 // PRD §2.4 requirement</div>
                <div class="diff-line add">+ func handleAlternateScreenBuffer(decset: Int) { ... }</div>
              </div>
              <div class="zen-divider-v"></div>
              <div class="zen-col right" style="flex: 0.8;">
                <div class="zen-pane ssh focused" style="flex: 1.1;">
                  <div class="zen-corner-tag focused">● root@prod-api (22ms)</div>
                  <div class="zen-term mono">
                    ${data.terminalLog.map((l) => `<div class="term-line ${l.type}">${l.line}</div>`).join("")}
                  </div>
                </div>
                <div class="zen-divider-h"></div>
                <div class="zen-pane files" style="flex: 0.9;">
                  <div class="zen-corner-tag">sftp:/var/www/dist</div>
                  <div class="p-files-table">
                    ${data.fileList.slice(0, 6).map((f) => `
                      <div class="f-row ${f.type}">
                        <span class="f-name">${f.name}</span>
                        <span class="f-size">${f.size}</span>
                        <span class="f-date">${f.date}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Zen Canvas)",
            frame: "phone",
            render: () => renderPhoneController("touchpad", { title: "Full-Bleed Gesture Canvas", sub: "Long-press anywhere to summon radial hotkey wheel" }),
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 04. ADAPTIVE SPLIT CANVAS
      // ─────────────────────────────────────────────────────────────
      {
        id: "adaptive-split",
        n: 4,
        name: "Adaptive Split Canvas",
        tagline: "Direct manipulation: Glowing drop snap-zones & spatial phone mini-map",
        concept: "Makes tiling feel as natural as physical building blocks. Dragging a tab or divider reveals glowing blue snap zones (drop on left edge to split 50/50, drop in center to merge, drop to header to tab). The phone controller renders an interactive spatial mini-map of your monitor for 1-tap pane switching.",
        moves: [
          "Interactive visual drop zones: Edge snap guides appear on drag",
          "Divider intersection split hub with instant rotate & swap toggles",
          "Floating quick-split chips on active pane perimeter",
          "Phone companion features a mini-map layout for spatial focus control",
          "Tab tear-out ghost animation when dragging between panes"
        ],
        palette: [["Dark Slate", "#0F172A"], ["Snap Blue", "#2563EB"], ["Electric Sky", "#60A5FA"], ["Active Glow", "#38BDF8"]],
        facts: { Focus: "Direct Spatial UX", Effort: "M", Needs: "Drag-and-drop gesture state machine" },
        render: () => `
          <div class="ttr-desktop adaptive-split">
            ${renderTopBar("adaptive-split", { extra: `<div class="snap-hint">${I("cursor", 12)} Drag tab to edge to split</div>` })}
            <div class="snap-workspace">
              <div class="snap-col left" style="flex: 1.15;">
                <div class="snap-pane web">
                  <div class="snap-drop-zone left-edge active"><span>Drop to Split Left</span></div>
                  ${renderWebPane(false)}
                </div>
              </div>
              <div class="snap-divider-v">
                <div class="snap-hub-chip" title="Click to rotate split orientation">⇄</div>
              </div>
              <div class="snap-col right" style="flex: 0.85;">
                <div class="snap-subpane top" style="flex: 1;">
                  <div class="snap-pane ssh focused">
                    ${renderSshPane(true)}
                  </div>
                </div>
                <div class="snap-divider-h">
                  <div class="snap-hub-chip" title="Click to rotate split orientation">⇅</div>
                </div>
                <div class="snap-subpane bottom" style="flex: 1;">
                  <div class="snap-pane files">
                    ${renderFilesPane(false)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Spatial Mini-Map)",
            frame: "phone",
            render: () => `
              <div class="ph-controller-screen">
                <div class="ph-topbar">
                  <div class="ph-status-pill"><span class="ph-dot live"></span> Spatial Mini-Map</div>
                  <span class="ph-hint">Tap any pane to focus</span>
                </div>
                <div class="ph-minimap-surface">
                  <div class="ph-minimap-grid">
                    <div class="ph-mini-pane web"><span class="mini-label">WEB · PR #18</span></div>
                    <div class="ph-mini-col">
                      <div class="ph-mini-pane ssh active"><span class="mini-label">SSH (Focused)</span></div>
                      <div class="ph-mini-pane files"><span class="mini-label">FILES</span></div>
                    </div>
                  </div>
                  <div class="ph-trackpad-strip">
                    <span>Virtual Pointer Canvas Below</span>
                  </div>
                </div>
              </div>
            `,
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 05. DEVOPS MISSION CONTROL
      // ─────────────────────────────────────────────────────────────
      {
        id: "devops-cluster",
        n: 5,
        name: "DevOps Mission Control",
        tagline: "Fleet management: Collapsible host drawer, heartbeat dots & broadcast typing",
        concept: "Crafted for cloud sysadmins and site reliability engineers. Features a collapsible left-hand host fleet drawer showing live heartbeat status (AWS us-east, Hetzner staging, Raspberry Pi homelab), 1-click terminal launching, and a 'Broadcast Input' toggle to execute a command across multiple SSH panes simultaneously.",
        moves: [
          "Collapsible left host fleet bar with real-time status pulse dots",
          "Broadcast keyboard input toggle (send typing to all SSH panes simultaneously)",
          "1-click SSH terminal spawner directly from server inventory list",
          "Encrypted SFTP drop drawer for instant remote deployment uploads",
          "Phone companion features biometric key unlock & server emergency kill switch"
        ],
        palette: [["Deep Bunker", "#0B0E14"], ["Emerald Live", "#10B981"], ["Warning Amber", "#F59E0B"], ["Terminal Green", "#34D399"]],
        facts: { Focus: "Multi-Server Sysadmin", Effort: "L", Needs: "Broadcast input dispatcher in TetherKit" },
        spec: {
          today: ["Tether keyboard events are strictly routed to the single focused responder pane."],
          proposed: ["Add optional 'Broadcast Input' mode routing keystrokes to all active SSH panes simultaneously."],
          files: ["projects/tether/apps/ios/App/Sources/TilingWorkspaceViewController.swift", "projects/tether/apps/ios/TetherKit/SshTerminalEngine.swift"],
          risks: ["Accidental broadcast can be destructive; requires distinct visual neon red banner and confirmation."],
          verify: ["Toggle Broadcast ON → typing 'uptime' appears in both SSH panes."]
        },
        design: [
          {
            kind: "flow",
            title: "Broadcast Keystroke Dispatcher",
            today: {
              nodes: [
                { id: "k", label: "Keyboard Event", sub: "UIKeyCommand", col: 0, row: 0, type: "ui" },
                { id: "f", label: "Focused Pane", sub: "Active SSH Tab only", col: 1, row: 0, type: "service" }
              ],
              edges: [{ from: "k", to: "f", label: "single route" }]
            },
            proposed: {
              nodes: [
                { id: "k", label: "Keyboard Event", sub: "UIKeyCommand", col: 0, row: 0, type: "ui" },
                { id: "r", label: "Broadcast Router", sub: "Broadcast Switch", col: 1, row: 0, type: "store", state: "new" },
                { id: "p1", label: "SSH Pane 1 (prod)", sub: "PTY dispatch", col: 2, row: 0, type: "service", state: "changed" },
                { id: "p2", label: "SSH Pane 2 (staging)", sub: "PTY dispatch", col: 2, row: 1, type: "service", state: "changed" }
              ],
              edges: [
                { from: "k", to: "r", label: "input" },
                { from: "r", to: "p1", label: "broadcast PTY", state: "new" },
                { from: "r", to: "p2", label: "broadcast PTY", state: "new" }
              ]
            }
          }
        ],
        render: () => `
          <div class="ttr-desktop devops-cluster">
            <div class="ops-header">
              <div class="ops-brand">
                <span class="ops-dot">●</span>
                <b>TETHER CLUSTER</b>
                <span class="ops-cluster-badge">FLEET: 3 NODES ONLINE</span>
              </div>
              <div class="ops-broadcast-pill active">
                <span class="b-dot"></span> <b>BROADCAST INPUT: ACTIVE</b> <small>(⌘B to toggle)</small>
              </div>
              <div class="ops-actions">
                <button class="ops-btn">${I("key", 13)} Keychain Vault</button>
                <button class="ops-btn">${I("refresh", 13)} Ping All</button>
                <button class="ops-btn icon-only">${I("settings", 14)}</button>
              </div>
            </div>
            <div class="ops-body">
              <div class="ops-fleet-sidebar">
                <div class="fleet-head"><span>SAVED HOSTS</span><button class="add-host-btn">+</button></div>
                <div class="fleet-item active">
                  <span class="h-dot live"></span>
                  <div class="h-info"><b>prod-api-us-east</b><small>10.0.4.12 · 22ms</small></div>
                  <span class="h-badge">Open</span>
                </div>
                <div class="fleet-item">
                  <span class="h-dot live"></span>
                  <div class="h-info"><b>hetzner-staging-eu</b><small>178.63.42.108 · 78ms</small></div>
                  <button class="h-connect-btn">Connect</button>
                </div>
                <div class="fleet-item">
                  <span class="h-dot live"></span>
                  <div class="h-info"><b>pi5-homelab-local</b><small>192.168.1.18 · 4ms</small></div>
                  <button class="h-connect-btn">Connect</button>
                </div>
              </div>
              <div class="ops-workspace">
                <div class="ops-pane-left" style="flex: 1.1;">
                  ${renderWebPane(false)}
                </div>
                <div class="ops-divider-v"></div>
                <div class="ops-pane-right" style="flex: 0.9;">
                  <div class="ops-subpane" style="flex: 1;">
                    ${renderSshPane(true)}
                  </div>
                  <div class="ops-divider-h"></div>
                  <div class="ops-subpane" style="flex: 1;">
                    ${renderFilesPane(false)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Fleet Biometric Vault)",
            frame: "phone",
            render: () => `
              <div class="ph-controller-screen">
                <div class="ph-topbar">
                  <div class="ph-status-pill"><span class="ph-dot live"></span> FaceID Key Vault</div>
                  <span class="ph-hint">Keys encrypted in Secure Enclave</span>
                </div>
                <div class="ph-vault-body">
                  <div class="vault-card">
                    <span class="vault-icon">🛡️</span>
                    <b>id_ed25519_prod</b>
                    <small>SHA256: d8:9a:14:... · Touch to unlock</small>
                    <button class="vault-unlock-btn" type="button">Authenticate with FaceID</button>
                  </div>
                  <div class="ph-emergency-bar">
                    <button class="danger-btn" type="button">⛔ Emergency Disconnect All</button>
                  </div>
                </div>
              </div>
            `,
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 06. ARC-INSPIRED RESEARCH STATION
      // ─────────────────────────────────────────────────────────────
      {
        id: "arc-research",
        n: 6,
        name: "Arc-Inspired Research Station",
        tagline: "Docs & Dev: Collapsible vertical tabs, markdown reader & terminal drawer",
        concept: "Optimized for developers reading documentation, testing endpoints, and tracking pull requests. Replaces standard top tabs with a sleek vertical sidebar tab dock (Arc/Zen style), complete with quick-copy cURL buttons that inject commands directly into the bottom terminal with 1 click.",
        moves: [
          "Vertical tab dock with spaces and pin bookmarks",
          "Dedicated split between browser reader and hot terminal",
          "1-click 'cURL / Copy into Terminal' badge next to code blocks",
          "Distraction-free web reading view for API specs",
          "Phone controller acts as an analog document scroll wheel"
        ],
        palette: [["Velvet Navy", "#131722"], ["Arc Lavender", "#A78BFA"], ["Soft Pink", "#F472B6"], ["Surface Dark", "#1E222D"]],
        facts: { Focus: "API Research & Reading", Effort: "M", Needs: "Vertical sidebar tab layout & cURL detector" },
        render: () => `
          <div class="ttr-desktop arc-research">
            <div class="arc-sidebar">
              <div class="arc-spaces">
                <span class="space-dot active"></span>
                <span class="space-dot"></span>
                <span class="space-title">Dev Space</span>
              </div>
              <div class="arc-tab-group">
                <div class="arc-tab-title">PINNED</div>
                <div class="arc-tab active">${I("web", 12)} PR #18 VT100</div>
                <div class="arc-tab">${I("web", 12)} Cloudflare Docs</div>
                <div class="arc-tab">${I("ssh", 12)} prod-api-us-east</div>
              </div>
              <div class="arc-tab-group">
                <div class="arc-tab-title">TODAY</div>
                <div class="arc-tab">${I("files", 12)} sftp:/var/www/dist</div>
              </div>
              <div class="arc-sidebar-footer">
                <button class="arc-btn-new">+ New Tab (⌘T)</button>
              </div>
            </div>
            <div class="arc-main-stage">
              <div class="arc-browser-stage" style="flex: 1.2;">
                <div class="arc-url-pill">
                  <span class="ssl">🔒</span>
                  <span>https://github.com/hejitech-apps/hejitech-apps/pull/18</span>
                  <span class="copy-hint">Copy cURL</span>
                </div>
                <div class="p-browser-body">
                  <div class="mock-pr-header">
                    <div class="pr-badge open">Open</div>
                    <span class="pr-title">feat(tether): VT100 alternate buffer & 10k scrollback</span>
                  </div>
                  <div class="mock-curl-callout">
                    <span class="callout-label">Test API Endpoint:</span>
                    <code>curl -H "Authorization: Bearer ttr_..." https://tether.hejitech.workers.dev/api/status</code>
                    <button class="callout-insert-btn">${I("terminal", 11)} Run in Terminal</button>
                  </div>
                </div>
              </div>
              <div class="arc-divider-h"></div>
              <div class="arc-terminal-stage mono" style="flex: 0.8;">
                <div class="arc-term-head">
                  <span>TERMINAL · root@prod-api-us-east</span>
                  <span class="ping">● 22ms</span>
                </div>
                ${data.terminalLog.slice(0, 5).map((l) => `<div class="term-line ${l.type}">${l.line}</div>`).join("")}
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Reading Scroll Wheel)",
            frame: "phone",
            render: () => `
              <div class="ph-controller-screen">
                <div class="ph-topbar">
                  <div class="ph-status-pill">Reading Navigation Wheel</div>
                </div>
                <div class="ph-scroll-wheel-body">
                  <div class="scroll-wheel-disc">
                    <span class="wheel-notch"></span>
                    <span class="wheel-notch"></span>
                    <span class="wheel-center">Tactile Scroll</span>
                  </div>
                  <div class="ph-quick-anchors">
                    <button class="anchor-btn">Jump to Diff</button>
                    <button class="anchor-btn">Copy Commit Hash</button>
                  </div>
                </div>
              </div>
            `,
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 07. STUDIO GLASS & LIQUID WORKSPACE
      // ─────────────────────────────────────────────────────────────
      {
        id: "studio-glass",
        n: 7,
        name: "Studio Glass & Liquid Workspace",
        tagline: "Apple VisionOS craft: Layered acrylic glass, specular highlights & fluid springs",
        concept: "Brings the ultra-refined spatial design language of Apple VisionOS and macOS Sequoia to Tether. Features translucent acrylic floating panels with 24px background blur, specular edge reflections, soft ambient drop shadows, and pill-shaped control capsules that make the monitor feel like a luxury desktop workstation.",
        moves: [
          "Translucent frosted acrylic materials with specular perimeter highlights",
          "Layered spatial depth with soft diffused drop shadows",
          "Pill capsules for URL bar, tabs, and layout preset indicators",
          "Smooth spring-based resizing animations",
          "Phone trackpad features haptic magnetic snap targeting when hovering monitor buttons"
        ],
        palette: [["Obsidian Base", "#0C0F17"], ["Frosted Glass", "rgba(255,255,255,0.08)"], ["Specular Highlight", "#E2E8F0"], ["Ice Blue", "#38BDF8"]],
        facts: { Focus: "High-Craft Aesthetics", Effort: "M", Needs: "Backdrop-filter acrylic CSS tokens" },
        render: () => `
          <div class="ttr-desktop studio-glass">
            <div class="sg-glass-header">
              <div class="sg-brand-capsule">
                <span class="sg-logo">⚡</span>
                <span class="sg-title">Tether</span>
                <span class="sg-sub">Pro Studio</span>
              </div>
              <div class="sg-preset-capsule">
                <button class="sg-pill-btn">${presetThumb(1)}</button>
                <button class="sg-pill-btn">${presetThumb(2)}</button>
                <button class="sg-pill-btn active">${presetThumb(3, true)}</button>
                <button class="sg-pill-btn">${presetThumb(4)}</button>
              </div>
              <div class="sg-action-capsule">
                <button class="sg-pill-btn">${I("command", 13)} ⌘K</button>
                <button class="sg-pill-btn">${I("key", 13)} Hosts</button>
                <button class="sg-pill-btn icon-only">${I("settings", 14)}</button>
              </div>
            </div>
            <div class="sg-workspace">
              <div class="sg-pane web" style="flex: 1.15;">
                ${renderWebPane(false)}
              </div>
              <div class="sg-divider-v"><div class="sg-drag-pill"></div></div>
              <div class="sg-col right" style="flex: 0.85;">
                <div class="sg-pane ssh focused" style="flex: 1.1;">
                  ${renderSshPane(true)}
                </div>
                <div class="sg-divider-h"><div class="sg-drag-pill"></div></div>
                <div class="sg-pane files" style="flex: 0.9;">
                  ${renderFilesPane(false)}
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Liquid Touchpad)",
            frame: "phone",
            render: () => renderPhoneController("touchpad", { title: "Liquid Haptic Touchpad", sub: "Magnetic snap feedback when pointer hovers monitor buttons" }),
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 08. SPOTLIGHT / RAYCAST-FIRST LAUNCHER
      // ─────────────────────────────────────────────────────────────
      {
        id: "spotlight-launcher",
        n: 8,
        name: "Spotlight / Raycast-First Launcher",
        tagline: "Keyboard-driven: Central omnibar with instant fuzzy search modal overlay",
        concept: "Transforms Tether into a lightning-fast keyboard-first workspace inspired by Raycast and Alfred. The top bar is simplified into a centered omnibar; pressing ⌘K (or tapping the search bar) brings up an instant fuzzy-search overlay with rich action previews for switching panes, launching SSH sessions, splitting layouts, or opening SFTP directories.",
        moves: [
          "Prominent central omnibar replacing cluttered top button rows",
          "Rich Raycast-style command palette modal with instant fuzzy search",
          "Action previews showing SSH host details, ping, and bookmarks",
          "Single-key shortcuts (e.g. '1..4' for presets, 's' for split, 't' for tab)",
          "Phone companion features instant autocomplete search input"
        ],
        palette: [["Charcoal Night", "#11141A"], ["Raycast Purple", "#8B5CF6"], ["Electric Violet", "#A78BFA"], ["Pure White", "#FFFFFF"]],
        facts: { Focus: "Keyboard Velocity", Effort: "M", Needs: "Command Palette fuzzy indexing engine" },
        spec: {
          today: ["Tether has basic CommandPaletteViewController with static table."],
          proposed: ["Full fuzzy spotlight palette with real-time scoring, action preview pane, and hotkey hints."],
          files: ["projects/tether/apps/ios/App/Sources/CommandPaletteViewController.swift"],
          risks: ["Keyboard focus capture between terminal and palette; requires clean UIKeyCommand resign."],
          verify: ["Press ⌘K → fuzzy search 'prod' immediately highlights 'root@prod-api-us-east' with Enter to switch."]
        },
        design: [
          {
            kind: "flow",
            title: "Fuzzy Command Dispatcher",
            today: {
              nodes: [
                { id: "k", label: "⌘K Trigger", sub: "Opens modal", col: 0, row: 0, type: "ui" },
                { id: "l", label: "Static List", sub: "Fixed rows", col: 1, row: 0, type: "ui" }
              ],
              edges: [{ from: "k", to: "l" }]
            },
            proposed: {
              nodes: [
                { id: "k", label: "⌘K Omnibar", sub: "Global listener", col: 0, row: 0, type: "ui" },
                { id: "f", label: "Fuzzy Indexer", sub: "Hosts + Tabs + Presets", col: 1, row: 0, type: "store", state: "new" },
                { id: "p", label: "Action Preview", sub: "Host stats & keys", col: 2, row: 0, type: "ui", state: "new" },
                { id: "x", label: "Execute Action", sub: "Split / Switch / Connect", col: 2, row: 1, type: "service", state: "changed" }
              ],
              edges: [
                { from: "k", to: "f", label: "query", state: "new" },
                { from: "f", to: "p", label: "match", state: "new" },
                { from: "p", to: "x", label: "Enter ↵", state: "new" }
              ]
            }
          }
        ],
        render: () => `
          <div class="ttr-desktop spotlight-launcher">
            <div class="spot-topbar">
              <span class="spot-brand">⚡ Tether</span>
              <div class="spot-omnibar">
                <span class="search-icon">${I("search", 13)}</span>
                <span class="search-placeholder">Type a command, host, or URL... (⌘K)</span>
                <span class="search-kbd">⌘K</span>
              </div>
              <div class="spot-right-stats">
                <span class="spot-stat">3 Panes · 1+2</span>
                <button class="spot-gear-btn">${I("settings", 13)}</button>
              </div>
            </div>
            <div class="spot-workspace-backdrop">
              <div class="spot-col left" style="flex: 1.1;">
                ${renderWebPane(false)}
              </div>
              <div class="spot-col right" style="flex: 0.9;">
                <div style="flex: 1;">${renderSshPane(false)}</div>
                <div style="flex: 1;">${renderFilesPane(false)}</div>
              </div>
              <!-- Raycast Modal Overlay -->
              <div class="raycast-modal">
                <div class="ray-input-row">
                  <span class="ray-search-icon">${I("search", 16)}</span>
                  <input type="text" class="ray-search-input" value="ssh prod" placeholder="Search commands, hosts, tabs..." />
                  <span class="ray-esc-tag">ESC</span>
                </div>
                <div class="ray-content-split">
                  <div class="ray-results-list">
                    <div class="ray-section">MATCHING HOSTS</div>
                    <div class="ray-item selected">
                      <span class="ray-icon ssh">${I("ssh", 13)}</span>
                      <div class="ray-item-text"><b>Connect to prod-api-us-east</b><small>10.0.4.12 · 22ms · Ubuntu 24.04</small></div>
                      <span class="ray-action-badge">Enter ↵</span>
                    </div>
                    <div class="ray-item">
                      <span class="ray-icon files">${I("files", 13)}</span>
                      <div class="ray-item-text"><b>SFTP /var/www/tether-api on prod</b><small>Browse remote files</small></div>
                    </div>
                    <div class="ray-section">LAYOUT COMMANDS</div>
                    <div class="ray-item">
                      <span class="ray-icon split">${I("splitH", 13)}</span>
                      <div class="ray-item-text"><b>Split Pane Horizontally</b><small>Ctrl+Alt+\\</small></div>
                    </div>
                  </div>
                  <div class="ray-preview-pane">
                    <div class="ray-preview-title">Host Details</div>
                    <div class="ray-preview-row"><span>Host:</span><b>prod-api-us-east</b></div>
                    <div class="ray-preview-row"><span>User:</span><b>root</b></div>
                    <div class="ray-preview-row"><span>Key:</span><b>id_ed25519_prod</b></div>
                    <div class="ray-preview-row"><span>Fingerprint:</span><code class="mono">SHA256:7f3a...91b</code></div>
                    <div class="ray-preview-row"><span>Latency:</span><b class="good">22ms (Fast)</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Spotlight Input)",
            frame: "phone",
            render: () => `
              <div class="ph-controller-screen">
                <div class="ph-topbar">
                  <div class="ph-status-pill">Spotlight Controller</div>
                </div>
                <div class="ph-spotlight-phone-body">
                  <div class="ph-search-bar">
                    <input type="text" placeholder="Search hosts & commands..." value="ssh prod" />
                  </div>
                  <div class="ph-quick-chips">
                    <button class="chip">ssh prod</button>
                    <button class="chip">split h</button>
                    <button class="chip">preset 2x2</button>
                    <button class="chip">swap</button>
                  </div>
                  <div class="ph-trackpad-area">
                    <span class="ph-hint-sub">Swipe down on trackpad to dismiss search</span>
                  </div>
                </div>
              </div>
            `,
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 09. DUAL-SCREEN CONTEXTUAL SYNERGY
      // ─────────────────────────────────────────────────────────────
      {
        id: "dual-synergy",
        n: 9,
        name: "Dual-Screen Contextual Synergy",
        tagline: "Dynamic companion: Phone screen morphs contextually with the focused pane",
        concept: "Rethinks the phone from a blank trackpad into a true secondary companion display. When the monitor focuses an SSH tab, the docked phone transforms into a developer macro keypad; when focusing Files, the phone displays a full interactive SFTP directory tree; when focusing Web, the phone shows tabs and bookmarks.",
        moves: [
          "Context-aware companion mode: Phone UI adapts to focused monitor pane",
          "SSH companion: Terminal function keys, Ctrl combos, and clipboard snippet drawer",
          "Files companion: Quick drag-and-drop file tree & search filter",
          "Web companion: Page reading outline & mobile tab switcher",
          "Persistent mini-trackpad zone retained on phone for effortless pointer control"
        ],
        palette: [["Deep Cosmic", "#0D1117"], ["Emerald Sync", "#10B981"], ["Vibrant Cyan", "#06B6D4"], ["Slate Text", "#94A3B8"]],
        facts: { Focus: "Multi-Screen Synergy", Effort: "L", Needs: "DisplayHost activePane state mirror" },
        render: () => `
          <div class="ttr-desktop dual-synergy">
            ${renderTopBar("dual-synergy", { extra: `<div class="synergy-status-badge"><span class="syn-dot live"></span> Phone Synced: Terminal Keypad Mode</div>` })}
            <div class="syn-workspace">
              <div class="syn-col left" style="flex: 1.15;">
                ${renderWebPane(false)}
              </div>
              <div class="syn-divider-v"><div class="syn-handle"></div></div>
              <div class="syn-col right" style="flex: 0.85;">
                <div class="syn-subpane" style="flex: 1.1;">
                  ${renderSshPane(true)}
                </div>
                <div class="syn-divider-h"><div class="syn-handle"></div></div>
                <div class="syn-subpane" style="flex: 0.9;">
                  ${renderFilesPane(false)}
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Companion (Terminal Keypad Mode)",
            frame: "phone",
            render: () => `
              <div class="ph-controller-screen synergy-mode">
                <div class="ph-topbar">
                  <div class="ph-status-pill"><span class="ph-dot live"></span> Linked: SSH (prod-api)</div>
                  <span class="ph-hint">Contextual Companion</span>
                </div>
                <div class="ph-synergy-body">
                  <div class="syn-macro-deck">
                    <div class="syn-key-strip">
                      <button class="syn-k">ESC</button>
                      <button class="syn-k">TAB</button>
                      <button class="syn-k">CTRL</button>
                      <button class="syn-k">ALT</button>
                      <button class="syn-k danger">^C</button>
                      <button class="syn-k danger">^D</button>
                      <button class="syn-k">|</button>
                      <button class="syn-k">~</button>
                    </div>
                    <div class="syn-command-chips">
                      <button class="syn-chip">git status</button>
                      <button class="syn-chip">docker compose ps</button>
                      <button class="syn-chip">tail -f access.log</button>
                      <button class="syn-chip">htop</button>
                    </div>
                  </div>
                  <div class="ph-bottom-trackpad">
                    <span class="track-label">Pointer Surface (Drag & Tap)</span>
                  </div>
                </div>
              </div>
            `,
          },
        ],
      },

      // ─────────────────────────────────────────────────────────────
      // 10. ACCESSIBILITY & HIGH-LEGIBILITY PRO
      // ─────────────────────────────────────────────────────────────
      {
        id: "access-pro",
        n: 10,
        name: "Accessibility & High-Legibility Pro",
        tagline: "Ergonomic comfort: AAA contrast, per-pane font zoom & 8px tactile dividers",
        concept: "Built for grueling hours of programming, tired eyes, and varied monitor distances. Meets WCAG AAA 7:1 contrast ratios on deep OLED blacks, offers instant per-pane font zoom steppers (⌘+ / ⌘-), features prominent 8px tactile divider rails with grab dots, and allows oversized phone tap targets for effortless control.",
        moves: [
          "WCAG AAA contrast: Deep true blacks with razor-sharp ice-white typography",
          "Per-pane font size steppers (A- / A+) for individual terminal and web zoom",
          "Prominent 8px divider grab handles with tactile grip textures",
          "High-visibility 2px focus bounding box around active pane",
          "Phone controller with oversized high-contrast buttons and haptic confirmation"
        ],
        palette: [["True OLED Black", "#000000"], ["High-Contrast White", "#FFFFFF"], ["Vivid Amber", "#F59E0B"], ["Cobalt Focus", "#3B82F6"]],
        facts: { Focus: "Ergonomics & Accessibility", Effort: "S", Needs: "Per-pane zoom CSS variable hook" },
        render: () => `
          <div class="ttr-desktop access-pro">
            <div class="pro-topbar">
              <div class="pro-brand">
                <b>TETHER PRO</b>
                <span class="pro-badge">HIGH-CONTRAST AAA</span>
              </div>
              <div class="pro-zoom-controls">
                <span class="pro-label">Global Text Zoom:</span>
                <button class="pro-zoom-btn">A−</button>
                <span class="pro-zoom-val">125%</span>
                <button class="pro-zoom-btn">A+</button>
              </div>
              <div class="pro-presets">
                <button class="pro-btn">1 Pane</button>
                <button class="pro-btn">2 Columns</button>
                <button class="pro-btn active">1+2 Split</button>
                <button class="pro-btn">2×2 Grid</button>
              </div>
              <div class="pro-actions">
                <button class="pro-btn large">⌘K Search</button>
                <button class="pro-btn large">⚙ Settings</button>
              </div>
            </div>
            <div class="pro-workspace">
              <div class="pro-pane web" style="flex: 1.15;">
                <div class="pro-pane-header">
                  <span class="pro-tab active">PR #18 · Tether VT100</span>
                  <div class="pro-pane-zoom">
                    <button class="zoom-btn" title="Zoom in">A+</button>
                    <button class="zoom-btn" title="Zoom out">A−</button>
                  </div>
                </div>
                <div class="p-browser-body" style="font-size: 15px;">
                  <div class="mock-pr-header">
                    <div class="pr-badge open">Open</div>
                    <span class="pr-title" style="font-size: 16px;">feat(tether): VT100 alternate buffer & 10k scrollback</span>
                  </div>
                  <div class="diff-line del" style="font-size: 14px;">- let maxScrollback: Int = 1000</div>
                  <div class="diff-line add" style="font-size: 14px;">+ let maxScrollback: Int = 10_000 // PRD §2.4 requirement</div>
                </div>
              </div>
              <div class="pro-divider-v"><div class="pro-grip">⋮⋮⋮</div></div>
              <div class="pro-col right" style="flex: 0.85;">
                <div class="pro-pane ssh focused" style="flex: 1.1;">
                  <div class="pro-pane-header">
                    <span class="pro-tab active">● root@prod-api-us-east (FOCUSED)</span>
                    <div class="pro-pane-zoom">
                      <button class="zoom-btn">A+</button>
                      <button class="zoom-btn">A−</button>
                    </div>
                  </div>
                  <div class="p-terminal-body mono" style="font-size: 14px; line-height: 1.6;">
                    ${data.terminalLog.slice(0, 6).map((l) => `<div class="term-line ${l.type}">${l.line}</div>`).join("")}
                  </div>
                </div>
                <div class="pro-divider-h"><div class="pro-grip">⋯⋯⋯</div></div>
                <div class="pro-pane files" style="flex: 0.9;">
                  <div class="pro-pane-header">
                    <span class="pro-tab active">SFTP: /var/www/dist</span>
                  </div>
                  <div class="p-files-table" style="font-size: 14px;">
                    ${data.fileList.slice(0, 5).map((f) => `
                      <div class="f-row ${f.type}">
                        <span class="f-name">${f.name}</span>
                        <span class="f-size">${f.size}</span>
                        <span class="f-date">${f.date}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        views: [
          {
            name: "Phone Controller (Ergonomic Large Targets)",
            frame: "phone",
            render: () => `
              <div class="ph-controller-screen access-mode">
                <div class="ph-topbar">
                  <div class="ph-status-pill">Accessibility Trackpad</div>
                </div>
                <div class="ph-large-trackpad-body">
                  <div class="ph-trackpad-area large">
                    <span class="ph-hint-title">Oversized Touchpad</span>
                    <span class="ph-hint-sub">High-damping cursor with haptic pulse</span>
                  </div>
                  <div class="ph-large-click-bar">
                    <button class="ph-large-btn" type="button">LEFT CLICK</button>
                    <button class="ph-large-btn secondary" type="button">RIGHT CLICK</button>
                  </div>
                </div>
              </div>
            `,
          },
        ],
      },
    ],
  };
})();
