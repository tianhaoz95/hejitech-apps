// Polymath Desktop App UI Polish: 5 High-Craft Design Candidates + Baseline
(() => {
  const { icon: I, course, codeSnippet } = KIT;

  // Helper to render memory blocks
  const renderMemoryBlocks = (activeCount = 18, sharedCount = 8, total = 32, cellClass = "grid-cell") => {
    let cells = [];
    for (let i = 0; i < total; i++) {
      let status = "";
      if (i < sharedCount) status = " shared";
      else if (i < activeCount) status = " active";
      cells.push(`<div class="${cellClass}${status}">${i}</div>`);
    }
    return cells.join("");
  };

  window.REVIEW = {
    key: "2026-10-27-polymath-desktop-ui-v1",
    dir: "reports/2026-10-27-polymath-desktop-ui",
    repo: "tianhaoz95/hejitech-apps",
    port: 8816,
    project: "projects/polymath",
    context: [
      "projects/polymath/CLAUDE.md",
      "projects/polymath/apps/desktop/src/App.tsx",
      "projects/polymath/apps/desktop/src/components/EmbeddedTerminal.tsx",
      "projects/polymath/apps/desktop/src/components/CodeExercise.tsx",
      "projects/polymath/apps/desktop/src/components/MemoryBlockGrid.tsx"
    ],
    brief: "The user reported that the current Polymath desktop app UI looks primitive. Proposed 5 distinctive candidates for visual polish, editorial hierarchy, hardware telemetry, and seamless agent terminal integration.",
    title: "Polymath Desktop UI Polish & Redesign",
    subtitle: "5 design directions + today's baseline",
    heading: "Pick a direction for the desktop app",
    intro: "Each candidate redesigns the full desktop window (1280×832) with real course data, interactive memory visualizations, code exercise sandboxes, and agent terminal drawers. Click any card to inspect full layout details, heart your favorites, rate, and click <b>Copy summary</b>.",
    legend: ["<b>6</b> chapters indexed", "<b>32</b> HBM3 blocks simulated"],
    round: 1,
    frame: "browser",
    url: "polymath://desktop/course/vllm-paged-attention",
    candidates: [
      // ─────────────────────────────────────────────────────────────
      // 00. BASELINE: TODAY'S CURRENT APP
      // ─────────────────────────────────────────────────────────────
      {
        id: "current",
        n: 0,
        name: "Current App",
        baseline: true,
        tagline: "Today's baseline: flat dark blocks, basic sidebar list, raw terminal drawer",
        concept: "The current implementation built during initial scaffolding. Plain flat dark surfaces (#0D0F14, #12151D) with 1px border lines, an unadorned vertical chapter list, disconnected bottom terminal drawer, and generic sans-serif typography without editorial hierarchy.",
        moves: [
          "Flat top navbar with simple button triggers",
          "Plain 300px sidebar listing 6 chapters with minimal blue highlight",
          "Standard markdown body with separate exercise box",
          "Bottom-docked 140px terminal drawer"
        ],
        palette: [["Dark Base", "#0D0F14"], ["Surface", "#12151D"], ["Cyan Accent", "#06B6D4"]],
        facts: { Style: "Flat generic dark", Effort: "Baseline", Typography: "System Inter / JetBrains Mono" },
        render: () => `
          <div class="topbar">
            <div class="brand">
              <span>▲ Polymath</span>
              <span class="title">${course.title}</span>
            </div>
            <div class="actions">
              <button class="btn-term">&gt;_ Open Agent Terminal</button>
              <button class="btn-new">+ Create New Course</button>
            </div>
          </div>
          <div class="workspace">
            <div class="sidebar">
              <span class="domain">${course.domain}</span>
              <div style="font-size:11px;color:#9CA3AF;margin-bottom:8px">${course.subtitle}</div>
              <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-bottom:4px">Course Chapters (6)</div>
              ${course.chapters.map(c => `
                <div class="ch-item ${c.status === 'active' ? 'active' : ''}">
                  <div>${c.title}</div>
                  <small style="color:#6B7280;font-size:10px">${c.duration} · ${c.interactiveCount} elements</small>
                </div>
              `).join("")}
            </div>
            <div class="main-pane">
              <h1>2. PagedAttention & Block Manager</h1>
              <p>Inspired by operating system virtual memory, <b>PagedAttention</b> partitions the KV cache into fixed-size physical blocks (typically 16 or 32 tokens).</p>
              <div class="block-grid-card">
                <div class="block-grid-header">
                  <span>Simulated GPU HBM3 Allocation (PagedAttention)</span>
                  <span style="color:#06B6D4">81% Utilized · 8 Shared Blocks</span>
                </div>
                <div class="grid-cells">${renderMemoryBlocks()}</div>
              </div>
              <div class="code-card">
                <div class="code-header">
                  <span style="color:#38BDF8;font-weight:700">2.1 Build an O(1) Free-List Block Manager</span>
                  <button style="background:#10B981;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600">▶ Run Pytest</button>
                </div>
                <div class="code-body">${codeSnippet}</div>
              </div>
            </div>
          </div>
          <div class="term-drawer">
            <div class="term-header">
              <span style="color:#10B981">●</span>
              <b>Terminal (xterm.js + PTY)</b>
              <span style="background:#1E293B;color:#38BDF8;padding:1px 6px;border-radius:3px">~/heji-courses/vllm</span>
            </div>
            <div class="term-body">
              <div>user@polymath:~/heji-courses/vllm$ pytest</div>
              <div>tests/test_block_manager.py::test_allocation <span style="color:#10B981">PASSED [100%]</span></div>
            </div>
          </div>
        `,
      },

      // ─────────────────────────────────────────────────────────────
      // 01. LINEAR IDE / ENGINEERED WORKBENCH
      // ─────────────────────────────────────────────────────────────
      {
        id: "linear",
        n: 1,
        name: "Linear IDE",
        round: 1,
        tagline: "Precision-engineered dark aesthetic with glass micro-borders, segmented progress, and tabbed terminal dock",
        concept: "Inspired by Linear, Raycast, and Zed. Focuses on high information density, micro-interactions, subtle glass reflections, and crisp engineered status badges. Replaces raw buttons with an elevated command bar and tabbed dock.",
        moves: [
          "Top breadcrumb strip with live PTY status pill and split layout toggles",
          "Progress ring and checklist sidebar showing course completion telemetry",
          "Polished component cards with subtle gradient borders (linear-gradient dark slate)",
          "Integrated tabbed terminal dock: [ Terminal ] [ Test Sandbox (Passed) ] [ Agent Log ]"
        ],
        palette: [["Obsidian", "#0A0C10"], ["Panel", "#0D1117"], ["Accent Blue", "#58A6FF"], ["Emerald", "#10B981"]],
        facts: { Style: "Precision Engineered IDE", Effort: "M", Typography: "Plus Jakarta Sans + JetBrains Mono" },
        render: () => `
          <div class="l-header">
            <div class="l-breadcrumbs">
              <span style="color:#58A6FF;font-weight:800;font-size:14px">▲</span>
              <span>Polymath</span>
              <span>/</span>
              <b>${course.title}</b>
              <span class="l-pill"><span class="l-pill-dot"></span> PTY Active · zsh</span>
            </div>
            <div class="l-actions">
              <button class="l-btn">${I("split", 13)} Split View</button>
              <button class="l-btn l-btn-primary">+ Create Course</button>
            </div>
          </div>
          <div class="l-layout">
            <div class="l-sidebar">
              <div class="l-side-header">
                <div style="font-size:11px;font-weight:700;color:#F0F6FC;margin-bottom:2px">Course Progress</div>
                <div class="l-progress-box">
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:#8B949E">
                    <span>2 of 6 Completed</span>
                    <b style="color:#58A6FF">33%</b>
                  </div>
                  <div class="l-progress-bar"><div class="l-progress-fill"></div></div>
                </div>
              </div>
              <div class="l-chapter-list">
                ${course.chapters.map(c => `
                  <div class="l-ch-item ${c.status === 'active' ? 'active' : c.status === 'completed' ? 'completed' : ''}">
                    <span style="font-family:'JetBrains Mono';font-size:10px;opacity:0.7">${c.num}</span>
                    <div style="flex:1;line-height:1.3">${c.title}</div>
                    ${c.status === 'completed' ? `<span style="color:#10B981">${I("check", 13)}</span>` : `<span style="font-size:10px;color:#6E7681">${c.duration}</span>`}
                  </div>
                `).join("")}
              </div>
            </div>
            <div class="l-center">
              <div class="l-content">
                <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#8B949E;margin-bottom:8px">
                  <span style="background:rgba(59,130,246,0.15);color:#58A6FF;padding:2px 7px;border-radius:4px;font-weight:700;font-size:10px">MODULE 02</span>
                  <span>Estimated read: 35 mins</span>
                </div>
                <h1>PagedAttention & KV Cache Allocation</h1>
                <p style="font-size:14px;color:#8B949E;line-height:1.6;margin:0 0 16px">
                  Inspired by operating system virtual memory, PagedAttention partitions the dynamic KV cache into fixed-size physical blocks (16 or 32 tokens), eliminating contiguous memory pre-allocation.
                </p>
                <div class="l-card">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <b style="font-size:13px;color:#F0F6FC">Simulated GPU HBM3 Memory Map</b>
                    <span style="font-size:11px;color:#58A6FF;font-family:'JetBrains Mono'">81% Allocated · 8 Radix Blocks Reused</span>
                  </div>
                  <div class="grid-cells">${renderMemoryBlocks(18, 8, 32, "grid-cell")}</div>
                </div>
                <div class="l-card" style="padding:0;overflow:hidden">
                  <div style="background:#161B22;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <div style="display:flex;align-items:center;gap:8px">
                      <b style="font-size:12px;color:#F0F6FC">2.1 O(1) Free-List Block Manager</b>
                      <span style="font-size:11px;color:#8B949E;font-family:'JetBrains Mono'">exercises/block_manager.py</span>
                    </div>
                    <button class="l-btn" style="background:#10B981;color:#fff;border-color:#059669;padding:4px 12px;font-weight:700">▶ Run Pytest</button>
                  </div>
                  <div style="padding:14px;background:#090C10;font-family:'JetBrains Mono';font-size:11px;color:#E6EDF3;line-height:1.6;white-space:pre">${codeSnippet}</div>
                </div>
              </div>
              <div class="l-terminal-dock">
                <div class="l-tabs-strip">
                  <div style="display:flex;gap:4px">
                    <div class="l-tab-btn active">${I("terminal", 13)} Terminal (zsh)</div>
                    <div class="l-tab-btn">${I("flask", 13)} Pytest Sandbox <span style="background:rgba(16,185,129,0.2);color:#10B981;font-size:9px;padding:1px 5px;border-radius:3px">PASS</span></div>
                    <div class="l-tab-btn">${I("sparkles", 13)} Agent Log (agy)</div>
                  </div>
                  <span style="font-size:11px;color:#6E7681;font-family:'JetBrains Mono'">~/heji-courses/vllm-inference</span>
                </div>
                <div style="flex:1;padding:10px 14px;background:#080A0E;font-family:'JetBrains Mono';font-size:11px;color:#58A6FF">
                  <div>user@polymath:~/heji-courses/vllm$ agy --status</div>
                  <div style="color:#8B949E">[agy] ⚡ Agent runner active. Watching course manifest and pytest outputs.</div>
                  <div style="color:#10B981">✓ All 2 unit tests passing in managed venv (42ms).</div>
                </div>
              </div>
            </div>
          </div>
        `,
        spec: {
          today: ["Single flat dark layout with basic flexbox column and detached raw terminal drawer"],
          proposed: [
            "Precision-engineered workbench with glass micro-borders and breadcrumb telemetry",
            "Progress donut & checklist chapter navigation with module badges",
            "Multi-tabbed terminal dock [Terminal / Pytest Output / Agent Activity Log]"
          ],
          files: [
            "projects/polymath/apps/desktop/src/App.tsx",
            "projects/polymath/apps/desktop/src/components/EmbeddedTerminal.tsx"
          ],
          risks: ["Needs responsive collapse when terminal drawer is dragged very tall"],
          verify: ["Test tab switching between live PTY shell, pytest results, and agent session log"]
        }
      },

      // ─────────────────────────────────────────────────────────────
      // 02. TURING LAB / STRIPE PRESS EDITORIAL MONOGRAPH
      // ─────────────────────────────────────────────────────────────
      {
        id: "turing",
        n: 2,
        name: "Turing Lab",
        round: 1,
        tagline: "Editorial technical publication meets live hardware rack (Stripe Press + Bret Victor)",
        concept: "Combines the typographic dignity of a luxury technical book (Newsreader serif headers, warm charcoal background) with a permanently docked right-hand 'Hardware Instrument & Simulator Rack' so theory and live silicon never separate.",
        moves: [
          "Split canvas: 60% high-readability editorial text column, 40% live hardware simulator rack",
          "Editorial serif typography (Newsreader) paired with high-contrast JetBrains Mono code",
          "Sidenotes in the margin explaining hardware trade-offs and memory boundaries",
          "Warm brass / amber (#E5A968) and deep slate (#14171B) palette with tactile debossed buttons"
        ],
        palette: [["Charcoal", "#14171B"], ["Warm Amber", "#E5A968"], ["Parchment Slate", "#ECEFF4"], ["Forest Teal", "#0D9488"]],
        facts: { Style: "Editorial Monograph", Effort: "M", Typography: "Newsreader Serif + JetBrains Mono" },
        render: () => `
          <div class="t-header">
            <div class="t-brand">Polymath Systems Monograph</div>
            <div style="display:flex;align-items:center;gap:16px;font-family:'Newsreader';font-size:13px;color:#94A3B8">
              <span>Chapter II of VI</span>
              <span style="color:#E5A968">● Reading & Simulating</span>
              <button style="background:transparent;border:1px solid #334155;color:#ECEFF4;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer">Contents</button>
            </div>
          </div>
          <div class="t-layout">
            <div class="t-prose-col">
              <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:1px;color:#E5A968;text-transform:uppercase;margin-bottom:8px">§ 2.0 PagedAttention Architecture</div>
              <h1>Partitioned KV Caches in Virtual GPU Memory</h1>
              <p>
                In high-throughput LLM serving, the autoregressive key-value (KV) cache represents the dominant consumer of high-bandwidth memory (HBM). Conventional serving runtimes pre-allocate contiguous memory buffers matching <em>max_sequence_length</em> for every incoming prompt.
              </p>
              <div class="t-sidenote">
                <b>Historical Note:</b> Prior to PagedAttention (Kwon et al., 2023), internal and external memory fragmentation waste accounted for 60% to 80% of total GPU memory in multi-tenant inference.
              </div>
              <p>
                By mapping dynamic logical KV blocks to non-contiguous physical pages in GPU VRAM, physical blocks are allocated strictly on demand as new token tensors materialize.
              </p>
              <div style="margin-top:24px;border-top:1px solid #2B303A;padding-top:16px;font-size:13px;color:#94A3B8">
                ← Previous: <em>01. Hardware Anatomy</em> &nbsp;|&nbsp; Next: <em>03. Radix Prefix Cache</em> →
              </div>
            </div>
            <div class="t-rack-col">
              <div class="t-module-frame">
                <div class="t-module-title">
                  <span>Instrument 01: HBM3 Memory Map</span>
                  <span style="color:#10B981">Live Sim</span>
                </div>
                <div class="grid-cells">${renderMemoryBlocks(18, 8, 32, "grid-cell")}</div>
              </div>
              <div class="t-module-frame">
                <div class="t-module-title">
                  <span>Instrument 02: Block Allocator Stub</span>
                  <button style="background:#E5A968;color:#0F172A;border:none;padding:3px 9px;border-radius:4px;font-size:10px;font-weight:700">▶ Verify</button>
                </div>
                <div style="background:#0C0E12;padding:10px;border-radius:5px;font-family:'JetBrains Mono';font-size:11px;color:#E2E8F0;line-height:1.5;white-space:pre">${codeSnippet}</div>
              </div>
              <div class="t-module-frame" style="flex:1">
                <div class="t-module-title">
                  <span>Interactive Terminal Rack</span>
                  <span style="color:#64748B">~/heji-courses/vllm</span>
                </div>
                <div style="font-family:'JetBrains Mono';font-size:11px;color:#34D399;line-height:1.5">
                  <div>user@polymath:~$ pytest tests/test_block_manager.py</div>
                  <div>=== 2 passed in 0.04s ===</div>
                </div>
              </div>
            </div>
          </div>
        `,
        spec: {
          today: ["Single vertical reading column with widgets interleaved in the text"],
          proposed: [
            "Permanent two-column split: 60% editorial prose column, 40% live simulator instrument rack",
            "Editorial Newsreader serif headers paired with technical JetBrains Mono code",
            "Interactive margin sidenotes for historical context and memory math"
          ],
          files: ["projects/polymath/apps/desktop/src/App.tsx"],
          risks: ["On narrow screens (<1100px), split columns need to collapse into a vertical stack"],
          verify: ["Verify text readability remains optimal at 65-75 characters per line"]
        }
      },

      // ─────────────────────────────────────────────────────────────
      // 03. KERNEL HUD / GPU ACCELERATOR STUDIO
      // ─────────────────────────────────────────────────────────────
      {
        id: "hud",
        n: 3,
        name: "Kernel HUD",
        round: 1,
        tagline: "Cybernetic systems telemetry interface inspired by NVIDIA Nsight Systems and Bloomberg Terminal",
        concept: "Transforms the course player into an authentic GPU systems profiler. Deep OLED blacks with phosphor cyan (#00F2FE) and neon violet highlights. Displays live simulated HBM3 bandwidth, SM occupancy, and token throughput gauges in an overarching HUD strip.",
        moves: [
          "Top real-time Telemetry Strip: live bandwidth, SM occupancy, and token throughput gauges",
          "Silicon die memory visualization with glowing active heatmaps and bus interconnect lines",
          "Monospace terminal styling with authentic phosphor glow and prompt status chips",
          "Kernel register and cache hierarchy callouts"
        ],
        palette: [["Pitch Black", "#050608"], ["Phosphor Cyan", "#00F2FE"], ["Matrix Green", "#00FF87"], ["Electric Violet", "#A855F7"]],
        facts: { Style: "Systems HUD / Telemetry", Effort: "L", Typography: "Space Grotesk + JetBrains Mono" },
        render: () => `
          <div class="h-telemetry-bar">
            <div style="display:flex;align-items:center;gap:16px">
              <span style="color:#00F2FE;font-weight:800;letter-spacing:1px">▲ KERNEL_HUD v2.4</span>
              <span class="h-gauge">HBM3 BW: <span class="h-gauge-val">3.35 TB/s</span></span>
              <span class="h-gauge">SM OCCUPANCY: <span class="h-gauge-val" style="color:#00FF87">92%</span></span>
              <span class="h-gauge">KV BLOCKS: <span class="h-gauge-val">18/32 (56%)</span></span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="color:#A855F7">CUDA ARCH: Hopper SM90a</span>
              <span style="background:#1E293B;padding:2px 6px;border-radius:3px;color:#00F2FE">AGY_AGENT: ONLINE</span>
            </div>
          </div>
          <div class="h-workspace">
            <div style="width:240px;background:#080A0F;border-right:1px solid #1E293B;padding:12px;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#64748B;margin-bottom:6px">TOPOLOGY MANIFEST</div>
              ${course.chapters.map(c => `
                <div style="padding:8px;border-radius:4px;background:${c.status === 'active' ? '#00F2FE15' : 'transparent'};border:1px solid ${c.status === 'active' ? '#00F2FE66' : 'transparent'};font-size:11px;color:${c.status === 'active' ? '#00F2FE' : '#94A3B8'}">
                  <div>[${c.num}] ${c.title}</div>
                  <div style="font-size:9px;color:#64748B;margin-top:2px">${c.duration} · ${c.interactiveCount} HUD widgets</div>
                </div>
              `).join("")}
            </div>
            <div style="flex:1;padding:24px 32px;overflow-y:auto;display:flex;flex-direction:column;gap:16px">
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <h1 style="font-size:22px;letter-spacing:0.5px;color:#00F2FE;margin:0">02 // PAGED_ATTENTION // BLOCK_ALLOCATOR</h1>
                <span style="font-family:'JetBrains Mono';font-size:11px;color:#64748B">SRAM_CACHE_LINE: 128B</span>
              </div>
              <div class="h-die-card">
                <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono';font-size:11px;margin-bottom:10px">
                  <span style="color:#00F2FE;font-weight:700">HBM3 PHYSICAL DIE MAPPING (32 BLOCKS)</span>
                  <span style="color:#00FF87">RADIX REUSE: 8 BLOCKS [0x OVERHEAD]</span>
                </div>
                <div class="h-die-grid">${renderMemoryBlocks(18, 8, 32, "h-die-cell neon-cyan")}</div>
              </div>
              <div class="h-die-card" style="border-color:#A855F744">
                <div style="display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono';font-size:11px;margin-bottom:10px">
                  <span style="color:#C084FC;font-weight:700">EXERCISE // O(1)_FREE_LIST_ALLOCATOR.PY</span>
                  <button style="background:#00F2FE;color:#050608;border:none;padding:4px 10px;border-radius:3px;font-family:'JetBrains Mono';font-size:10px;font-weight:800">EXEC_PYTEST</button>
                </div>
                <div style="font-family:'JetBrains Mono';font-size:11px;color:#E0E7FF;line-height:1.5;white-space:pre">${codeSnippet}</div>
              </div>
            </div>
          </div>
        `,
        spec: {
          today: ["Generic dark cards without real-time hardware telemetry cues"],
          proposed: [
            "Top hardware telemetry strip displaying real-time bandwidth and occupancy numbers",
            "Silicon die layout styling for HBM memory grid with neon glow shaders",
            "High-contrast cybernetic palette tuned for low-latency visual scanning"
          ],
          files: ["projects/polymath/apps/desktop/src/components/RooflinePlot.tsx", "projects/polymath/apps/desktop/src/App.tsx"],
          risks: ["Aggressive neon accents can feel intense for casual reading if overused"],
          verify: ["Ensure text contrast ratios meet WCAG AAA standards on pitch black backgrounds"]
        }
      },

      // ─────────────────────────────────────────────────────────────
      // 04. ADAPTIVE CANVAS / ZEN STUDIO
      // ─────────────────────────────────────────────────────────────
      {
        id: "zen",
        n: 4,
        name: "Zen Studio",
        round: 1,
        tagline: "Distraction-free learning canvas with slim icon rail, floating glass cards, and auto-hiding dock",
        concept: "Inspired by Craft, Notion 3.0, and Obsidian Canvas. Cleans away visual clutter so the user can achieve total flow state. Sidebar collapses into a 54px icon rail; interactive elements float as soft frosted glass tiles; terminal is an auto-hiding floating pill.",
        moves: [
          "Slim 54px navigation rail maximizing horizontal canvas space for code and architecture diagrams",
          "Frosted glass cards (backdrop-filter: blur(24px)) with soft rounded corners (14px)",
          "Floating bottom control pill for Agent Terminal and Pytest triggers",
          "Calm basalt palette (#131418) with subtle slate typography"
        ],
        palette: [["Deep Basalt", "#131418"], ["Frosted Card", "rgba(255,255,255,0.05)"], ["Pure White", "#FFFFFF"], ["Soft Mint", "#6EE7B7"]],
        facts: { Style: "Minimalist Zen Canvas", Effort: "M", Typography: "Inter + JetBrains Mono" },
        render: () => `
          <div style="display:flex;flex:1;overflow:hidden;position:relative">
            <div class="z-nav-rail">
              <div class="z-rail-icon" style="color:#38BDF8;font-weight:800">▲</div>
              <div class="z-rail-icon active" title="Active Chapter">${I("book", 16)}</div>
              <div class="z-rail-icon" title="Hardware Widgets">${I("cpu", 16)}</div>
              <div class="z-rail-icon" title="Pytest Sandboxes">${I("flask", 16)}</div>
              <div class="z-rail-icon" style="margin-top:auto" title="Settings">${I("settings", 16)}</div>
            </div>
            <div class="z-stage">
              <div class="z-doc-container">
                <div style="font-size:12px;color:#94A3B8;margin-bottom:8px">Hardware-Accelerated LLM Inference · Chapter 2</div>
                <h1 style="font-size:30px;font-weight:800;letter-spacing:-0.5px;margin:0 0 16px;color:#FFFFFF">PagedAttention & Block Manager</h1>
                <p style="font-size:15px;line-height:1.7;color:#94A3B8;margin-bottom:24px">
                  Inspired by operating system virtual memory, PagedAttention partitions the dynamic KV cache into fixed-size physical blocks. Observe how logical blocks map to physical HBM pages below.
                </p>
                <div style="background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;margin-bottom:24px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:13px;font-weight:600">
                    <span>HBM3 Block Allocation Map</span>
                    <span style="color:#6EE7B7">81% Allocated · 8 Shared Blocks</span>
                  </div>
                  <div class="grid-cells">${renderMemoryBlocks()}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span style="font-size:13px;font-weight:600">Free-List Block Manager Implementation</span>
                    <span style="font-family:'JetBrains Mono';font-size:11px;color:#94A3B8">exercises/block_manager.py</span>
                  </div>
                  <div style="font-family:'JetBrains Mono';font-size:12px;color:#E2E8F0;line-height:1.6;white-space:pre">${codeSnippet}</div>
                </div>
              </div>
            </div>
            <div class="z-floating-dock">
              <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#E2E8F0;font-weight:600">
                <span style="width:8px;height:8px;border-radius:50%;background:#10B981"></span>
                Agent Ready
              </span>
              <span style="height:14px;width:1px;background:rgba(255,255,255,0.15)"></span>
              <button style="background:#10B981;color:#090B10;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">▶ Run Pytest</button>
              <button style="background:rgba(255,255,255,0.08);color:#E2E8F0;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer">&gt;_ Terminal</button>
            </div>
          </div>
        `,
        spec: {
          today: ["Fixed wide sidebar and permanently visible bottom terminal drawer occupying screen height"],
          proposed: [
            "Collapsible 54px icon rail with expansive reading canvas",
            "Floating glass pill toolbar that hovers above content without taking layout space",
            "Frosted backdrop blur cards with 14px rounded corners"
          ],
          files: ["projects/polymath/apps/desktop/src/App.tsx"],
          risks: ["User must click dock to see terminal output if hidden"],
          verify: ["Test smooth animation when expanding full chapter sidebar on hover"]
        }
      },

      // ─────────────────────────────────────────────────────────────
      // 05. PLAYGROUND NOTEBOOK (JUPYTER + XCODE PLAYGROUND)
      // ─────────────────────────────────────────────────────────────
      {
        id: "notebook",
        n: 5,
        name: "Playground Notebook",
        round: 1,
        tagline: "Interactive cell-based computational notebook with left execution gutters and live Agent Sidecar",
        concept: "Treats the course as an interactive computational workbook (inspired by Xcode Swift Playgrounds and modern Jupyter/Colab). Every chapter is composed of runnable cells with line numbers, execution timers ([42ms]), and a dedicated Agent Sidecar pane on the right.",
        moves: [
          "Cell-based document structure: Narrative Cell, Hardware Simulation Cell, Executable Code Cell",
          "Left execution gutter with cell run triggers (▶ [1]), status badges, and elapsed timers",
          "Dedicated Agent Sidecar panel on the right displaying live agent suggestions, diffs, and context",
          "Inline output cells rendering test results directly beneath the corresponding exercise"
        ],
        palette: [["GitHub Dark", "#0E1117"], ["Gutter Dark", "#0D1117"], ["Blue Cell", "#58A6FF"], ["Cell Border", "#30363D"]],
        facts: { Style: "Computational Notebook", Effort: "L", Typography: "Inter + JetBrains Mono" },
        render: () => `
          <div class="nb-header">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="color:#58A6FF;font-weight:800">▲ Polymath Notebook</span>
              <span style="font-size:12px;color:#8B949E;border-left:1px solid #30363D;padding-left:10px">ch02_paged_attention.ipynb</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <button style="background:#238636;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700">▶ Run All Cells</button>
              <button style="background:#21262D;color:#C9D1D9;border:1px solid #30363D;padding:4px 10px;border-radius:4px;font-size:11px">Restart Kernel</button>
            </div>
          </div>
          <div class="nb-body">
            <div class="nb-cells">
              <!-- Cell 1: Markdown -->
              <div class="nb-cell">
                <div class="nb-cell-gutter"><span>[md]</span></div>
                <div class="nb-cell-content">
                  <h1 style="font-size:22px;margin:0 0 10px">2. PagedAttention & Block Manager</h1>
                  <p style="font-size:13px;line-height:1.6;color:#8B949E;margin:0">
                    Inspired by operating system virtual memory, PagedAttention partitions the dynamic KV cache into fixed-size physical blocks.
                  </p>
                </div>
              </div>
              <!-- Cell 2: Hardware Visualizer -->
              <div class="nb-cell">
                <div class="nb-cell-gutter">
                  <span style="color:#58A6FF">▶ [1]</span>
                  <span style="color:#34D399;font-size:9px">✓ 1ms</span>
                </div>
                <div class="nb-cell-content">
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px">
                    <b>&lt;MemoryBlockGrid totalBlocks="32" /&gt;</b>
                    <span style="color:#58A6FF;font-size:11px">Interactive Output</span>
                  </div>
                  <div class="grid-cells">${renderMemoryBlocks()}</div>
                </div>
              </div>
              <!-- Cell 3: Code Exercise -->
              <div class="nb-cell">
                <div class="nb-cell-gutter">
                  <span style="color:#58A6FF">▶ [2]</span>
                  <span style="color:#34D399;font-size:9px">✓ 42ms</span>
                </div>
                <div class="nb-cell-content">
                  <div style="font-family:'JetBrains Mono';font-size:11px;color:#E6EDF3;line-height:1.5;white-space:pre">${codeSnippet}</div>
                  <div style="margin-top:12px;background:#0D1117;border-top:1px solid #30363D;padding:10px;border-radius:4px;font-family:'JetBrains Mono';font-size:11px;color:#34D399">
                    <div>Out [2]: 2 passed, 0 failed in 0.04s</div>
                    <div style="color:#8B949E">✓ test_allocation PASSED</div>
                    <div style="color:#8B949E">✓ test_free_and_reuse PASSED</div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Right Agent Sidecar -->
            <div class="nb-sidecar">
              <div class="nb-sidecar-header">
                <span>🤖 Agent Assistant</span>
                <span style="margin-left:auto;font-size:10px;background:#1F6FEB22;color:#58A6FF;padding:2px 6px;border-radius:4px">Online</span>
              </div>
              <div style="flex:1;padding:14px;font-size:12px;color:#C9D1D9;display:flex;flex-direction:column;gap:12px">
                <div style="background:#161B22;padding:10px;border-radius:6px;border:1px solid #30363D">
                  <b style="color:#58A6FF">Tutor Insight</b>
                  <p style="margin:6px 0 0;font-size:11px;color:#8B949E;line-height:1.4">
                    In Cell [2], consider testing what happens when all 32 blocks are depleted to verify MemoryError handling.
                  </p>
                </div>
                <div style="margin-top:auto">
                  <div style="font-size:11px;color:#8B949E;margin-bottom:6px">Ask Agent to edit or explain:</div>
                  <input type="text" placeholder="e.g. Add test for out of memory" style="width:100%;background:#0D1117;border:1px solid #30363D;border-radius:4px;padding:6px 10px;color:#fff;font-size:11px;box-sizing:border-box">
                </div>
              </div>
            </div>
          </div>
        `,
        spec: {
          today: ["Traditional monolithic page with disconnected terminal at bottom"],
          proposed: [
            "Cell-based computational notebook structure with execution gutter and timers",
            "Inline output cells rendering test results directly underneath code",
            "Dedicated right-side Agent Assistant panel for live course authoring and tutoring"
          ],
          files: [
            "projects/polymath/apps/desktop/src/App.tsx",
            "projects/polymath/apps/desktop/src/components/CodeExercise.tsx"
          ],
          risks: ["Requires mapping chapter markdown AST into sequential notebook cell nodes"],
          verify: ["Verify clicking individual cell run buttons only re-evaluates that specific cell"]
        }
      }
    ]
  };
})();
