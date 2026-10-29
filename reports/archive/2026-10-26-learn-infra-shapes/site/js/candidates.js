// 20 Product Shapes: AI Systems & Cross-Domain Learning Platform
// Review candidates definition
(() => {
  const K = KIT;
  const I = K.icon;

  window.REVIEW = {
    key: "2026-10-26-learn-infra-shapes-v1",
    dir: "reports/archive/2026-10-26-learn-infra-shapes",
    repo: "tianhaoz95/hejitech-apps",
    port: 8815,
    project: "projects/learn-infra",
    context: ["reports/archive/2026-10-26-learn-infra-shapes/README.md"],
    brief: "Brainstorm and design 20 distinct product shapes for a new project to learn and practice deep systems (PyTorch, TRT-LLM, SGLang, vLLM, post-training infra zero-to-hero) with local AI agent execution, diagrams/drawing, and long-term multi-domain extensibility.",
    title: "20 Product Shapes: AI Systems & Cross-Domain Learning Platform",
    subtitle: "20 candidate directions + 1 unified master combo & baseline",
    heading: "Choose a product shape or review the unified master platform",
    intro: "Review 20 diverse product shapes spanning IDE Workbenches, Hardware Simulation Labs, Kata Dojos, and Cross-Domain Knowledge Graphs—plus <b>Candidate 21 (The Unified Synthesis)</b> which fuses all 20 into a single modular learning operating system with 4 workspace modes and ambient companions. Star, heart, annotate, and crown your winner.",
    legend: ["<b>21</b> product shapes", "<b>5</b> design groups", "<b>1</b> status-quo baseline"],
    round: 2,
    frame: "browser",
    url: "learn.heji.dev",
    modes: true,
    groups: [
      { id: "combo", name: "🏆 The Unified Synthesis (Your Combo)", note: "The full fusion of all 20 directions into one modular platform" },
      { id: "workbenches", name: "1. Studio & Spatial Canvas Workbenches", note: "Deep visual mental models + code execution + canvas interfaces" },
      { id: "simulators", name: "2. Simulation, Emulation & Profiling Labs", note: "Grounded in deep infra, hardware realism, cluster & memory topologies" },
      { id: "dojos", name: "3. Progressive Scaffolding & Kata Dojos", note: "Build-your-own engine milestones, TUI drills, and incident simulations" },
      { id: "cross-domain", name: "4. Cross-Domain Synthesis & Knowledge Graphs", note: "Extensible skill graphs, paper-to-practice compilers, and analogy cartography" }
    ],
    candidates: [
      // ───────────────────────────────────────────────────────────────────────
      // 00: BASELINE (Today's Fragmented Status Quo)
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "baseline",
        n: 0,
        name: "Today's Fragmented Status Quo",
        baseline: true,
        tagline: "5 Disconnected Apps: Web Chat, Colab, Local VS Code, Raw Terminal, Excalidraw",
        concept: "The painful reality of modern deep infra learning: you bounce between ChatGPT/Claude tabs for explanations, local VS Code for typing code, terminal for running failed pytest runs, an Excalidraw tab to sketch memory layouts, and scattered ArXiv PDF bookmarks. Zero state sync, zero simulated hardware feedback.",
        moves: [
          "Manual copy-pasting code back and forth to web LLMs",
          "No persistent connection between diagram sketches and tensor shapes",
          "No GPU hardware simulator: code runs or fails with cryptic CUDA OOMs",
          "Learning path is ad-hoc with no structured roadmap or verified retention"
        ],
        palette: [["Dark Charcoal", "#181A1F"], ["Dim Border", "#2C313C"], ["Muted Gray", "#5C6370"]],
        facts: { Archetype: "Fragmented Windows", AgentIntegration: "Manual Web Copy-Paste", Diagramming: "Separate Browser Tab", Effort: "Current Baseline" },
        render: () => `
          <div class="scr baseline">
            ${K.winBar("macOS Desktop — 5 Disconnected Windows", "status-quo")}
            <div class="baseline-split-grid">
              <div class="app-window-stub">
                <div class="app-header-stub"><span>Browser: ChatGPT / Claude Web</span><small>Tab 14/42</small></div>
                <div class="app-content-stub">
                  <p><b>User:</b> How does vLLM PagedAttention map logical tokens to physical blocks?</p>
                  <p style="color:var(--text-dim);"><b>AI:</b> In vLLM, logical blocks are mapped via a block table... [pasted 120 lines of explanation with no code sandbox]</p>
                </div>
              </div>
              <div class="app-window-stub">
                <div class="app-header-stub"><span>Excalidraw Whiteboard Tab</span><small>Untitled-2026.png</small></div>
                <div class="app-content-stub" style="display:flex;align-items:center;justify-content:center;background:#1E1E1E;">
                  <div style="border:2px dashed #888;padding:12px;border-radius:6px;color:#aaa;text-align:center;">
                    [Hand-drawn boxes: Block #0 -> Block #7]<br><small>Static drawing. Cannot execute or inspect memory.</small>
                  </div>
                </div>
              </div>
              <div class="app-window-stub">
                <div class="app-header-stub"><span>VS Code / Cursor</span><small>radix_cache.py</small></div>
                <div class="app-content-stub" style="font-family:var(--font-mono);font-size:10px;">
                  def allocate_block(self, req_id):<br>
                  &nbsp;&nbsp;# Missing hardware insight<br>
                  &nbsp;&nbsp;return torch.empty(...)
                </div>
              </div>
              <div class="app-window-stub">
                <div class="app-header-stub"><span>Terminal (iTerm2)</span><small>pytest</small></div>
                <div class="app-content-stub" style="font-family:var(--font-mono);font-size:10px;color:#EF4444;">
                  RuntimeError: CUDA out of memory. Tried to allocate 2.40 GiB (GPU 0; 23.69 GiB total capacity; 21.80 GiB already allocated by PyTorch)
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 21: THE UNIFIED SYNTHESIS (YOUR COMBO)
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "polymath-os",
        n: 21,
        mine: true,
        round: 2,
        group: "combo",
        name: "HEJI Polymath OS (The Unified Platform)",
        tagline: "The Full Fusion: 4 Workspace Modes (Map, Studio, Whiteboard, Dojo) + Ambient LSP & Menubar Companion",
        concept: "Fuses all 20 directions into a coherent, modular learning operating system. Rather than forcing a compromise between an IDE, whiteboard, TUI, or simulator, you switch fluidly between 4 dedicated Workspace Modes: (1) Tech-Tree & Paper Ingestion Hub, (2) Systems Studio & Hardware Simulator, (3) Spatial Architecture Whiteboard, and (4) Kata Dojo & SRE Crisis Room. Supported by an ambient LSP sidecar that attaches to your native Cursor/VS Code and a daily menubar micro-drill.",
        moves: [
          "4 Unified Workspace Modes on top bar: Map (Curriculum/Papers) -> Studio (IDE/Sim) -> Whiteboard (Architecture) -> Dojo (Katas/PR Review)",
          "Unified Hardware & Memory Simulation Engine (PagedAttention blocks, 8xH100 NVLink topology, Roofline curves)",
          "Local Autonomous AI Agent daemon with multi-role personas (Socratic Tutor, Staff PR Reviewer, Whiteboard-to-Code compiler)",
          "Dual Ambient Peripheral Layer: LSP Sidecar for native Cursor/VS Code users + macOS Menubar daily streak widget",
          "Cross-Domain Concept Weaver: seamlessly connects PyTorch/Inference to Robotics, Compilers, and Finance"
        ],
        palette: [["Deep Cosmic", "#090B10"], ["Neon Cyan", "#06B6D4"], ["Neural Violet", "#8B5CF6"], ["Hardware Emerald", "#10B981"], ["Amber Gold", "#F59E0B"]],
        facts: {
          Archetype: "Unified Multi-Modal Learning OS",
          WorkspaceModes: "4 Modes: Map, Studio, Whiteboard, Dojo",
          SimulationEngine: "Local PyTorch + Mock NCCL + HBM Allocator",
          AgentSubsystem: "Multi-Persona Local Daemon (LSP / Socket)",
          AmbientCompanions: "macOS Menubar Widget + VS Code Extension",
          Effort: "L (Phased Modular Architecture)"
        },
        spec: {
          today: [
            "Learners bounce across 5 disconnected apps: web chats, raw Colab/Jupyter, native VS Code, terminal, and static diagramming tabs",
            "Zero hardware simulation or telemetry feedback during coding",
            "No automated bridges between high-level paper equations, visual architecture diagrams, and low-level PyTorch code"
          ],
          proposed: [
            "Unified local desktop application (Tauri / Web) with 4 synchronized modes: (1) Roadmap/Paper Hub, (2) Systems Studio, (3) Spatial Whiteboard, (4) Kata Dojo",
            "Shared core execution daemon: runs local PyTorch sandboxes, simulates 8-GPU NVLink topologies and PagedAttention block tables",
            "Ambient peripheral daemons: native Cursor/VS Code LSP companion + macOS menubar 5-minute drill popover",
            "Multi-persona AI agent orchestrator: provides Socratic quizzing, whiteboard-to-code compilation, and synthetic staff PR reviews"
          ],
          files: [
            "projects/learn-infra/apps/desktop/ (Tauri / React multi-mode workspace)",
            "projects/learn-infra/packages/core/src/curriculum.ts (Tech-tree DAG & paper ingestion)",
            "projects/learn-infra/packages/simulator/src/memory.ts (PagedAttention & block manager simulator)",
            "projects/learn-infra/packages/simulator/src/cluster.ts (Virtual 8xH100 NVLink / NCCL topology)",
            "projects/learn-infra/services/agent/daemon.py (Local Python AI agent daemon with LSP server)",
            "projects/learn-infra/apps/menubar/ (Lightweight macOS menubar daily drill companion)"
          ],
          risks: [
            "Feature sprawl risk: mitigate by building the shared core daemon first, then unlocking modes progressively",
            "Heavy local resource consumption: use mock CUDA memory emulation so the app runs smoothly on Apple Silicon Macs without requiring physical H100s"
          ],
          verify: [
            "1. Mode Switch: Toggle between Studio, Whiteboard, Map, and Dojo while preserving active session state and variable bindings",
            "2. Memory Simulation: Code edit in radix_cache.py updates both the visual HBM block map and whiteboard dataflow wires",
            "3. Ambient Bridge: External edit in native Cursor/VS Code triggers instant feedback in the floating sidecar and test runner"
          ]
        },
        design: [
          {
            kind: "flow",
            title: "HEJI Polymath OS: Unified Architecture & Data Flow",
            note: "How the 4 workspace modes, core simulation engine, local agent, and ambient companions interlock.",
            proposed: {
              nodes: [
                { id: "map", label: "Mode 1: Tech-Tree Map", sub: "Curriculum & Paper Ingestion", col: 0, row: 0, type: "ui" },
                { id: "wb", label: "Mode 3: Whiteboard", sub: "Spatial Architecture Canvas", col: 0, row: 1, type: "ui" },
                { id: "studio", label: "Mode 2: Systems Studio", sub: "IDE + Memory Simulator", col: 1, row: 0, type: "ui" },
                { id: "dojo", label: "Mode 4: Kata Dojo", sub: "Crisis Lab & Staff Reviews", col: 1, row: 1, type: "ui" },
                { id: "engine", label: "Core Simulation Engine", sub: "PyTorch + Mock HBM/NCCL", col: 2, row: 0, type: "model" },
                { id: "agent", label: "Local Multi-Agent Daemon", sub: "Socratic, Staff & Compiler", col: 2, row: 1, type: "external" },
                { id: "ambient", label: "Ambient Peripherals", sub: "Menubar Widget + VSCode LSP", col: 3, row: 0, type: "store" }
              ],
              edges: [
                { from: "map", to: "studio", label: "Loads Quest" },
                { from: "wb", to: "studio", label: "Compiles to Code" },
                { from: "studio", to: "engine", label: "Executes Sandbox" },
                { from: "engine", to: "studio", label: "Telemetry & Blocks" },
                { from: "studio", to: "dojo", label: "Submits PR / Kata" },
                { from: "dojo", to: "agent", label: "Staff Review / Incidents" },
                { from: "agent", to: "studio", label: "Inline Fixes" },
                { from: "agent", to: "ambient", label: "Syncs Daily Drills" },
                { from: "ambient", to: "engine", label: "LSP Hooks" }
              ]
            }
          },
          {
            kind: "table",
            title: "How the 20 Candidate Shapes Map into the Unified Platform",
            note: "Every single candidate direction finds a natural home across the 4 Modes and Ambient Layer.",
            head: ["Platform Layer / Surface", "Core Purpose", "Candidate Shapes Absorbed", "Key Interaction"],
            rows: [
              [
                "Mode 1: Tech-Tree & Curriculum Hub",
                "Knowledge mapping, paper ingestion, and cross-domain synthesis",
                "16 (Tech-Tree RPG), 18 (Paper Compiler), 17 (Concept Weaver), 13 (Git Archeology)",
                "Drop ArXiv PDF -> generates 7-day lab; view dependency tree with prerequisite edges & cross-domain analogies"
              ],
              [
                "Mode 2: Systems Studio & Simulator",
                "Daily deep-dive IDE, hardware simulation, and tensor inspection",
                "01 (Systems CAD), 05 (Omniverse Cockpit), 08 (Memory Arena), 07 (Roofline Lab), 06 (Cluster Deck), 09 (Post-Training Director), 03 (Reactive Knobs)",
                "Code editor with tensor shape inlay hints, live HBM page table visualizer, roofline curves, and simulated 8xH100 NVLink topology"
              ],
              [
                "Mode 3: Spatial Architecture Whiteboard",
                "Visual system design, tensor wire checking, and media walkthroughs",
                "02 (Spatial Canvas), 19 (Architecture Exam Parser), 20 (Interactive Code-Cast)",
                "Infinite canvas with live computable nodes, hand-drawn architecture compilation to PyTorch, and synchronized audio-video timeline"
              ],
              [
                "Mode 4: Kata Dojo & Review Room",
                "Fast-twitch practice, PR reviews, and crisis debugging",
                "11 (BYO Engine Scaffolder), 12 (Terminal Kata Dojo), 14 (Staff Review Board), 10 (Incident Commander SRE)",
                "Solve 5-min katas (TUI or GUI), submit PRs to 3 synthetic Staff Reviewers, and diagnose simulated SEV-1 cluster loss spikes"
              ],
              [
                "Ambient Companion Layer",
                "Zero-friction daily habit and in-situ external editor support",
                "04 (Ambient Socratic Sidecar), 15 (Menubar Micro-Drills)",
                "Lightweight macOS menubar popover for daily memory math + LSP background daemon that attaches quietly to Cursor / VS Code"
              ]
            ]
          }
        ],
        views: [
          {
            name: "Master View: Mode 2 — Systems Studio & Hardware Simulator",
            render: () => `
              <div class="scr systems-studio">
                ${K.winBar("HEJI Polymath OS — Systems Studio Mode", "Active Mode: Studio", "CUDA 12.4 · 80GB HBM3 Active")}
                <div class="poly-nav-tabs">
                  <div class="poly-nav-tab">${I("network", 13)} 1. Tech-Tree Map</div>
                  <div class="poly-nav-tab active">${I("cpu", 13)} 2. Systems Studio</div>
                  <div class="poly-nav-tab">${I("diagram", 13)} 3. Architecture Whiteboard</div>
                  <div class="poly-nav-tab">${I("terminal", 13)} 4. Kata Dojo & Crisis Room</div>
                  <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
                    <span class="domain-pill">${I("sparkles", 11)} Domain: vLLM & SGLang</span>
                    <span class="peripheral-status"><span class="status-pip"></span> LSP Sidecar: Attached</span>
                  </div>
                </div>
                <div class="app-body">
                  <aside class="sidebar">
                    <div class="sb-section-title">Milestones: nano-vLLM</div>
                    <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M1: Autoregressive Loop</div>
                    <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M2: Static KV Cache</div>
                    <div class="sb-item active"><span class="app-icon" style="color:var(--accent-cyan);">${I("flame", 12)}</span> M3: PagedAttention Allocator <span class="sb-badge">Active</span></div>
                    <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M4: Radix Tree Prefix Cache</div>
                    <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M5: Continuous Batching</div>
                    <div class="sb-section-title" style="margin-top:12px;">Local Agent Persona</div>
                    <div style="padding:10px 14px;font-size:11px;color:var(--text-muted);">
                      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span class="term-dot"></span> <b>Staff Performance Mentor</b>
                      </div>
                      <span>Watching <code>radix_cache.py</code> · Inlay hints enabled</span>
                    </div>
                  </aside>
                  <div class="code-editor">
                    <div class="editor-tabs">
                      <div class="editor-tab active">${I("fileCode", 12)} radix_cache.py</div>
                      <div class="editor-tab">${I("fileCode", 12)} test_radix.py</div>
                      <div class="editor-tab" style="color:var(--accent-amber);">${I("activity", 12)} Roofline Curve</div>
                    </div>
                    <div class="code-scroll">
                      <div class="code-line"><span class="ln">1</span><span class="txt"><span class="kw">class</span> <span class="type">RadixPrefixCache</span>:</span></div>
                      <div class="code-line"><span class="ln">2</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">__init__</span>(<span class="type">self</span>, page_size: <span class="type">int</span> = <span class="num">16</span>):</span></div>
                      <div class="code-line"><span class="ln">3</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.root = RadixNode(token_ids=[])</span></div>
                      <div class="code-line"><span class="ln">4</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.block_table = BlockAllocator(num_blocks=<span class="num">2048</span>)</span></div>
                      <div class="code-line"><span class="ln">5</span><span class="txt"></span></div>
                      <div class="code-line"><span class="ln">6</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">match_prefix</span>(<span class="type">self</span>, prompt_tokens: torch.Tensor):</span></div>
                      <div class="code-line"><span class="ln">7</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Inlay Hint: prompt_tokens.shape = [1, 2048], dtype=torch.int32</span></span></div>
                      <div class="code-line"><span class="ln">8</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;curr = <span class="type">self</span>.root; matched_blocks = []</span></div>
                      <div class="code-line"><span class="ln">9</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Traverses tree branches and locks shared physical blocks</span></span></div>
                    </div>
                    ${K.renderTerminal("pytest tests/test_radix.py --tb=short", [
                      { text: "[PASS] test_paged_attention_kernel_forward (2.8ms)", type: "pass" },
                      { text: "[FAIL] test_lru_block_eviction: Block ID #42 evicted before ref count hit 0!", type: "fail" },
                      { text: "Agent Suggestion: Add `self.pinned_refs.remove(block_id)` before calling free().", type: "agent" }
                    ])}
                  </div>
                  <div style="width:340px;background:var(--bg-secondary);border-left:1px solid var(--border-color);padding:14px;display:flex;flex-direction:column;overflow-y:auto;">
                    <div style="font-weight:700;font-size:12px;margin-bottom:8px;display:flex;justify-content:space-between;">
                      <span>Simulated GPU HBM3 Allocation</span>
                      <span style="color:var(--accent-cyan);font-family:var(--font-mono);">76.4% Eff</span>
                    </div>
                    ${K.renderMemoryGrid(20, 8, 4)}
                    <div class="metrics-row" style="margin-top:10px;">
                      <div class="metric-chip"><small>Prefix Hit Rate</small><b>84.2%</b></div>
                      <div class="metric-chip"><small>Memory Saved</small><b>4.2x</b></div>
                    </div>
                    <div style="font-weight:700;font-size:12px;margin:12px 0 6px;">Logical -> Physical Page Table</div>
                    <div style="background:var(--bg-surface);padding:8px;border-radius:6px;font-family:var(--font-mono);font-size:10px;line-height:1.6;">
                      Req #1 [Prompt A]: Logical [0..1] -> Phys [B0, B1] (Shared)<br>
                      Req #2 [Prompt B]: Logical [0..1] -> Phys [B0, B1] (Shared)<br>
                      Req #2 [Unique]:&nbsp;&nbsp;&nbsp;Logical [2..3] -> Phys [B14, B15]
                    </div>
                  </div>
                </div>
              </div>
            `
          },
          {
            name: "Mode 3 — Spatial Architecture Whiteboard",
            render: () => `
              <div class="scr infinite-canvas">
                ${K.winBar("HEJI Polymath OS — Architecture Whiteboard Mode", "Active Mode: Whiteboard", "Diagram Auto-Syncs to PyTorch")}
                <div class="poly-nav-tabs">
                  <div class="poly-nav-tab">${I("network", 13)} 1. Tech-Tree Map</div>
                  <div class="poly-nav-tab">${I("cpu", 13)} 2. Systems Studio</div>
                  <div class="poly-nav-tab active">${I("diagram", 13)} 3. Architecture Whiteboard</div>
                  <div class="poly-nav-tab">${I("terminal", 13)} 4. Kata Dojo & Crisis Room</div>
                  <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
                    <span class="domain-pill">${I("sparkles", 11)} Domain: vLLM & SGLang</span>
                  </div>
                </div>
                <div class="app-body">
                  <div class="canvas-wrap">
                    <div style="position:absolute;top:14px;left:14px;background:var(--bg-secondary);border:1px solid var(--border-strong);border-radius:8px;padding:6px;display:flex;gap:8px;z-index:10;">
                      <button style="background:transparent;border:0;color:var(--text-main);padding:4px 8px;cursor:pointer;">${I("plus", 14)} Add Node</button>
                      <button style="background:transparent;border:0;color:var(--text-main);padding:4px 8px;cursor:pointer;">${I("diagram", 14)} Draw Wire</button>
                      <button style="background:var(--accent-purple);border:0;color:#fff;border-radius:4px;padding:4px 10px;cursor:pointer;font-weight:600;">Compile to PyTorch</button>
                    </div>
                    <div class="canvas-node" style="top:70px;left:60px;">
                      <div class="node-header"><span>1. Tokenized Request</span><span class="badge mode">Input</span></div>
                      <div class="node-body">
                        <p>Batch of 4 prompts with shared system header</p>
                        <div style="font-family:var(--font-mono);font-size:10px;color:var(--accent-cyan);">Shape: [4, 512] int32</div>
                        <div class="node-ports"><span class="port-dot"></span><span>Output: tokens</span></div>
                      </div>
                    </div>
                    <div class="canvas-node" style="top:70px;left:380px;border-color:var(--accent-purple);">
                      <div class="node-header" style="background:rgba(168,85,247,0.15);color:var(--accent-purple);">
                        <span>2. Radix Cache Match</span><span class="badge mode">Algorithm</span>
                      </div>
                      <div class="node-body">
                        <p>Traverses prefix tree to reuse existing KV blocks</p>
                        <div style="background:var(--bg-primary);padding:6px;border-radius:4px;font-family:var(--font-mono);font-size:9px;">
                          def match(prompt):<br>&nbsp;&nbsp;return prefix_blocks
                        </div>
                        <div class="node-ports"><span>Input: tokens</span><span class="port-dot"></span></div>
                      </div>
                    </div>
                    <div class="canvas-node" style="top:70px;left:700px;border-color:var(--accent-cyan);">
                      <div class="node-header" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">
                        <span>3. PagedAttention Kernel</span><span class="badge mode">CUDA</span>
                      </div>
                      <div class="node-body">
                        <p>Non-contiguous memory gather & attention</p>
                        <div style="font-family:var(--font-mono);font-size:10px;color:var(--accent-green);">Latency: 4.12ms</div>
                        <div class="node-ports"><span>Block Table</span><span class="port-dot"></span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `
          },
          {
            name: "Mode 1 — Tech-Tree & Cross-Domain Map",
            render: () => `
              <div class="scr mastery-rpg">
                ${K.winBar("HEJI Polymath OS — Tech-Tree & Roadmap Mode", "Active Mode: Map", "Level 14 Systems Architect")}
                <div class="poly-nav-tabs">
                  <div class="poly-nav-tab active">${I("network", 13)} 1. Tech-Tree Map</div>
                  <div class="poly-nav-tab">${I("cpu", 13)} 2. Systems Studio</div>
                  <div class="poly-nav-tab">${I("diagram", 13)} 3. Architecture Whiteboard</div>
                  <div class="poly-nav-tab">${I("terminal", 13)} 4. Kata Dojo & Crisis Room</div>
                  <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
                    <span class="domain-pill">${I("plus", 11)} Ingest ArXiv PDF</span>
                  </div>
                </div>
                <div class="app-body">
                  <div class="canvas-wrap" style="background:#090B10;">
                    <div class="canvas-node" style="top:70px;left:40px;width:180px;border-color:#10B981;">
                      <div class="node-header" style="background:rgba(168,85,247,0.15);color:#10B981;"><span>CUDA Hierarchy</span><span>[DONE]</span></div>
                      <div class="node-body"><p>Warps, Shared SRAM, Global HBM</p></div>
                    </div>
                    <div class="canvas-node" style="top:70px;left:280px;width:180px;border-color:#10B981;">
                      <div class="node-header" style="background:rgba(168,85,247,0.15);color:#10B981;"><span>Triton Tiling</span><span>[DONE]</span></div>
                      <div class="node-body"><p>Block pointers & fused ops</p></div>
                    </div>
                    <div class="canvas-node" style="top:70px;left:520px;width:220px;border-color:var(--accent-amber);">
                      <div class="node-header" style="background:rgba(234,179,8,0.2);color:var(--accent-amber);"><span>PagedAttention</span><span>ACTIVE</span></div>
                      <div class="node-body"><p>Quest: Implement Block Table allocation</p><small style="color:var(--accent-amber);">70% Progress</small></div>
                    </div>
                    <div class="canvas-node" style="top:220px;left:520px;width:220px;border-color:var(--accent-purple);">
                      <div class="node-header" style="background:rgba(168,85,247,0.2);color:var(--accent-purple);"><span>Robotics: 3D Voxel Octree</span><span>CROSS-DOMAIN</span></div>
                      <div class="node-body"><p>Reuses memory paging concepts in autonomous drone 3D maps</p></div>
                    </div>
                  </div>
                </div>
              </div>
            `
          },
          {
            name: "Mode 4 — SRE Incident Crisis & Staff PR Review",
            render: () => `
              <div class="scr incident-commander">
                ${K.winBar("HEJI Polymath OS — Crisis & PR Review Room", "Active Mode: Dojo", "Incident Simulator & Staff Review")}
                <div class="poly-nav-tabs">
                  <div class="poly-nav-tab">${I("network", 13)} 1. Tech-Tree Map</div>
                  <div class="poly-nav-tab">${I("cpu", 13)} 2. Systems Studio</div>
                  <div class="poly-nav-tab">${I("diagram", 13)} 3. Architecture Whiteboard</div>
                  <div class="poly-nav-tab active">${I("terminal", 13)} 4. Kata Dojo & Crisis Room</div>
                </div>
                <div class="app-body" style="background:var(--bg-primary);display:flex;flex-direction:column;">
                  <div class="sre-alert-bar">
                    <span style="color:#EF4444;display:flex;">${I("alert", 18)}</span>
                    <span>SEV-1 ALERT: 1,024-GPU Post-Training Cluster Halted at Step #4,210. Reason: <code>Gradient Norm NaN Spike</code></span>
                    <span class="badge mode" style="background:#EF4444;color:#fff;margin-left:auto;">MTTR Clock: 04:12</span>
                  </div>
                  <div class="telemetry-row">
                    <div class="gpu-card err">
                      <div style="font-weight:700;font-size:11px;color:#EF4444;margin-bottom:4px;">Node #14 - GPU 3 (Rank 115)</div>
                      <div style="font-size:10px;color:var(--text-muted);">NVLink CRC Error Count: <b>14,892</b></div>
                    </div>
                    <div class="gpu-card">
                      <div style="font-weight:700;font-size:11px;margin-bottom:4px;">PR #18 Review Status</div>
                      <div style="font-size:10px;color:var(--accent-amber);">Staff Architect: Changes Requested on GIL lock</div>
                    </div>
                  </div>
                </div>
              </div>
            `
          },
          {
            name: "Ambient Layer — Menubar Popover & Terminal TUI",
            render: () => `
              <div class="scr ambient-micro-drills">
                ${K.winBar("macOS Desktop — Ambient Menubar Companion & Terminal TUI", "Ambient Layer", "Zero Friction · Streak: 18 Days")}
                <div class="app-body" style="background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;gap:30px;">
                  <!-- Menubar Drill Card -->
                  <div style="width:380px;background:var(--bg-secondary);border:1px solid var(--border-strong);border-radius:12px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                      <b>Daily Menubar Systems Drill</b><span class="sb-badge">+50 XP</span>
                    </div>
                    <p style="font-size:11px;color:var(--text-muted);">Calculate KV cache size for Llama-3-70B with 16k context at FP16.</p>
                    <button style="width:100%;background:rgba(16,185,129,0.2);border:1px solid #10B981;color:#10B981;padding:6px;border-radius:4px;font-size:11px;font-weight:700;">5.37 GB (Solved)</button>
                  </div>
                  <!-- Terminal TUI Card -->
                  <div style="width:440px;background:#090B0F;border:1px solid #1E293B;border-radius:8px;padding:14px;font-family:var(--font-mono);font-size:10px;color:#38BDF8;">
                    <div style="color:#F59E0B;font-weight:700;margin-bottom:6px;">$ heji dojo --kata=04_radix_prefix</div>
                    <div>[PASS] test_radix_match (0.8ms)</div>
                    <div>[PASS] test_paged_alloc (1.2ms)</div>
                    <div style="color:#10B981;margin-top:4px;">All katas passed! Synced to Polymath OS cloud.</div>
                  </div>
                </div>
              </div>
            `
          }
        ],
        render: () => `
          <div class="scr polymath-os">
            ${K.winBar("HEJI Polymath OS — Unified Systems & Cross-Domain Platform", "Polymath OS", "4 Modes Ready · 80GB HBM3 Virtualized")}
            <!-- Top Workspace Mode Switcher -->
            <div class="poly-nav-tabs">
              <div class="poly-nav-tab">${I("network", 13)} 1. Tech-Tree Map</div>
              <div class="poly-nav-tab active">${I("cpu", 13)} 2. Systems Studio</div>
              <div class="poly-nav-tab">${I("diagram", 13)} 3. Architecture Whiteboard</div>
              <div class="poly-nav-tab">${I("terminal", 13)} 4. Kata Dojo & Crisis Room</div>
              <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
                <span class="domain-pill">${I("sparkles", 11)} Domain: vLLM & SGLang</span>
                <span class="peripheral-status"><span class="status-pip"></span> LSP Sidecar: Active</span>
              </div>
            </div>

            <div class="app-body">
              <!-- Left Sidebar: Domain & Syllabus -->
              <aside class="sidebar">
                <div class="sb-section-title">Active Domain</div>
                <div class="sb-item active"><span class="app-icon">${I("flame", 12)}</span> vLLM & SGLang Engine</div>
                <div class="sb-item"><span class="app-icon">${I("network", 12)}</span> Post-Training: GRPO Zero-to-Hero</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-purple);">${I("compass", 12)}</span> Robotics 3D Octree Raymarching</div>
                <div class="sb-item" style="color:var(--accent-cyan);"><span class="app-icon">${I("plus", 12)}</span> Ingest ArXiv Paper / Repo...</div>

                <div class="sb-section-title" style="margin-top:10px;">Milestones: nano-vLLM</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M1: Autoregressive Loop</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M2: Static KV Cache Matrix</div>
                <div class="sb-item active"><span class="app-icon" style="color:var(--accent-cyan);">${I("flame", 12)}</span> M3: PagedAttention Allocator <span class="sb-badge">Active</span></div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M4: Radix Tree Prefix Cache</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M5: Continuous Batching</div>

                <div class="sb-section-title" style="margin-top:10px;">Multi-Agent Subsystem</div>
                <div style="padding:8px 14px;font-size:11px;color:var(--text-muted);">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                    <span class="term-dot"></span> <b>Socratic Agent + Staff Lead</b>
                  </div>
                  <span style="font-size:10px;">IPC Connected · Inlay hints on</span>
                </div>
              </aside>

              <!-- Center: Code Editor & Terminal -->
              <div class="code-editor">
                <div class="editor-tabs">
                  <div class="editor-tab active">${I("fileCode", 12)} radix_cache.py</div>
                  <div class="editor-tab">${I("fileCode", 12)} test_radix.py</div>
                  <div class="editor-tab">${I("activity", 12)} Roofline Model</div>
                </div>
                <div class="code-scroll">
                  <div class="code-line"><span class="ln">1</span><span class="txt"><span class="kw">class</span> <span class="type">RadixPrefixCache</span>:</span></div>
                  <div class="code-line"><span class="ln">2</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">__init__</span>(<span class="type">self</span>, page_size: <span class="type">int</span> = <span class="num">16</span>):</span></div>
                  <div class="code-line"><span class="ln">3</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.root = RadixNode(token_ids=[])</span></div>
                  <div class="code-line"><span class="ln">4</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.block_table = BlockAllocator(num_blocks=<span class="num">2048</span>)</span></div>
                  <div class="code-line"><span class="ln">5</span><span class="txt"></span></div>
                  <div class="code-line"><span class="ln">6</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">match_prefix</span>(<span class="type">self</span>, prompt_tokens: torch.Tensor):</span></div>
                  <div class="code-line"><span class="ln">7</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Inlay Hint: prompt_tokens.shape = [1, 2048], dtype=torch.int32</span></span></div>
                  <div class="code-line"><span class="ln">8</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;curr = <span class="type">self</span>.root; matched_blocks = []</span></div>
                  <div class="code-line"><span class="ln">9</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Traverses tree branches and locks shared physical blocks</span></span></div>
                </div>
                ${K.renderTerminal("pytest tests/test_radix.py --tb=short", [
                  { text: "[PASS] test_paged_attention_kernel_forward (2.8ms)", type: "pass" },
                  { text: "[FAIL] test_lru_block_eviction: Block ID #42 evicted before ref count hit 0!", type: "fail" },
                  { text: "Agent Suggestion: Add `self.pinned_refs.remove(block_id)` before calling free().", type: "agent" }
                ])}
              </div>

              <!-- Right: Real-Time Hardware & Memory Simulator -->
              <div style="width:340px;background:var(--bg-secondary);border-left:1px solid var(--border-color);padding:14px;display:flex;flex-direction:column;overflow-y:auto;">
                <div style="font-weight:700;font-size:12px;margin-bottom:8px;display:flex;justify-content:space-between;">
                  <span>GPU Memory Map (HBM3)</span>
                  <span style="color:var(--accent-cyan);font-family:var(--font-mono);">76.4% Eff</span>
                </div>
                ${K.renderMemoryGrid(20, 8, 4)}
                <div class="metrics-row" style="margin-top:10px;">
                  <div class="metric-chip"><small>Prefix Hit Rate</small><b>84.2%</b></div>
                  <div class="metric-chip"><small>Memory Saved</small><b>4.2x</b></div>
                </div>
                <div style="font-weight:700;font-size:12px;margin:12px 0 6px;">Logical -> Physical Page Table</div>
                <div style="background:var(--bg-surface);padding:8px;border-radius:6px;font-family:var(--font-mono);font-size:10px;line-height:1.6;">
                  Req #1 [Prompt A]: Logical [0..1] -> Phys [B0, B1] (Shared)<br>
                  Req #2 [Prompt B]: Logical [0..1] -> Phys [B0, B1] (Shared)<br>
                  Req #2 [Unique]:&nbsp;&nbsp;&nbsp;Logical [2..3] -> Phys [B14, B15]
                </div>
                <div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;font-size:11px;">
                  <span style="color:var(--accent-green);">${I("check", 12)} Whiteboard in Sync</span>
                  <a href="#" style="color:var(--accent-cyan);text-decoration:none;">Switch to Mode 3 -></a>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // GROUP 1: Studio & Spatial Canvas Workbenches
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "systems-studio",
        n: 1,
        group: "workbenches",
        name: "Systems CAD Studio",
        tagline: "VS Code + NSight + Live GPU Tensor Inspector in one desktop IDE",
        concept: "A desktop engineering workbench tailored specifically for low-level PyTorch & inference systems. Left panel hosts the structured learning syllabus; center houses an IDE editor with tensor shape inlay hints; right panel displays live animated KV cache memory blocks and physical page tables while local AI agent streams verified unit test fixes.",
        moves: [
          "Real-time PyTorch tensor shape & stride inlay hints in editor gutter",
          "Animated GPU HBM3 page table simulator linked directly to code variables",
          "Local autonomous AI agent (Unix socket daemon) executing test runs in bottom drawer",
          "Interactive slider to simulate varying batch sizes and context lengths"
        ],
        palette: [["Obsidian", "#0B0E14"], ["Electric Cyan", "#06B6D4"], ["Memory Blue", "#3B82F6"], ["Syntax Emerald", "#10B981"]],
        facts: { Archetype: "Integrated Desktop IDE", ExecutionModel: "Local PyTorch Daemon", AgentRole: "Embedded Test Runner & Co-pilot", Effort: "L", Needs: "Tree-sitter parser + GPU IPC" },
        spec: {
          today: ["Fragmented VS Code + terminal + mental model tracking"],
          proposed: ["Desktop app with unified tensor debugger, memory allocator inspector, and syllabus runner"],
          files: ["src/ide/editor.ts", "src/simulator/paged_memory.ts", "src/agent/local_runner.py", "curriculum/vllm/radix.json"],
          risks: ["High memory usage if running full PyTorch models locally; solve via mock CUDA backend"],
          verify: ["Execute RadixPrefixCache unit test -> live visual memory blocks highlight allocated vs shared pages"]
        },
        design: [
          {
            kind: "flow",
            title: "Systems CAD Data Flow",
            note: "Bidirectional sync between PyTorch runtime hooks, visual allocator, and local agent.",
            proposed: {
              nodes: [
                { id: "ed", label: "Code Editor", sub: "User writes PyTorch", col: 0, row: 0, type: "ui" },
                { id: "hk", label: "PyTorch Hooks", sub: "Inspects tensor dims", col: 1, row: 0, type: "model" },
                { id: "mem", label: "Memory Inspector", sub: "Visualizes Page Table", col: 2, row: 0, type: "ui" },
                { id: "ag", label: "Local Agent", sub: "Validates against vLLM", col: 1, row: 1, type: "external" }
              ],
              edges: [
                { from: "ed", to: "hk", label: "Executes" },
                { from: "hk", to: "mem", label: "Broadcasts memory map" },
                { from: "hk", to: "ag", label: "Sends trace" },
                { from: "ag", to: "ed", label: "Suggests patch" }
              ]
            }
          }
        ],
        render: () => `
          <div class="scr systems-studio">
            ${K.winBar("Systems CAD Studio — vLLM & SGLang Lab", "IDE", "CUDA 12.4 · 80GB HBM3 Active")}
            <div class="app-body">
              <aside class="sidebar">
                <div class="sb-section-title">Module 03: Inference Engines</div>
                <div class="sb-item"><span class="app-icon">${I("check", 12)}</span> 3.1 Naive Autoregressive Loop</div>
                <div class="sb-item"><span class="app-icon">${I("check", 12)}</span> 3.2 Static KV Cache Allocation</div>
                <div class="sb-item active"><span class="app-icon">${I("flame", 12)}</span> 3.3 PagedAttention & Block Manager <span class="sb-badge">Active</span></div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> 3.4 SGLang Radix Tree Cache</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> 3.5 Chunked Prefill & Scheduling</div>
                <div class="sb-section-title" style="margin-top:12px;">Local Agent Status</div>
                <div style="padding:10px 14px;font-size:11px;color:var(--text-muted);">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span class="term-dot"></span> <b>DeepSeek-Coder Agent</b>
                  </div>
                  <span>Watching file changes in <code>radix_cache.py</code></span>
                </div>
              </aside>
              <div class="code-editor">
                <div class="editor-tabs">
                  <div class="editor-tab active">${I("fileCode", 12)} radix_cache.py</div>
                  <div class="editor-tab">${I("fileCode", 12)} test_radix.py</div>
                  <div class="editor-tab">${I("fileCode", 12)} block_allocator.cu</div>
                </div>
                <div class="code-scroll">
                  <div class="code-line"><span class="ln">1</span><span class="txt"><span class="kw">class</span> <span class="type">RadixPrefixCache</span>:</span></div>
                  <div class="code-line"><span class="ln">2</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">__init__</span>(<span class="type">self</span>, page_size: <span class="type">int</span> = <span class="num">16</span>):</span></div>
                  <div class="code-line"><span class="ln">3</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.root = RadixNode(token_ids=[])</span></div>
                  <div class="code-line"><span class="ln">4</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.block_table = BlockAllocator(num_blocks=<span class="num">2048</span>)</span></div>
                  <div class="code-line"><span class="ln">5</span><span class="txt"></span></div>
                  <div class="code-line"><span class="ln">6</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">match_prefix</span>(<span class="type">self</span>, prompt_tokens: torch.Tensor):</span></div>
                  <div class="code-line"><span class="ln">7</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Live Hook: prompt_tokens.shape = [1, 2048], dtype=torch.int32</span></span></div>
                  <div class="code-line"><span class="ln">8</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;curr = <span class="type">self</span>.root; matched_blocks = []</span></div>
                  <div class="code-line"><span class="ln">9</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Traverses tree branches and locks shared physical blocks</span></span></div>
                </div>
                ${K.renderTerminal("pytest tests/test_radix.py --tb=short", [
                  { text: "[PASS] test_paged_attention_kernel_forward (2.8ms)", type: "pass" },
                  { text: "[FAIL] test_lru_block_eviction: Block ID #42 evicted before ref count hit 0!", type: "fail" },
                  { text: "Agent Suggestion: Add `self.pinned_refs.remove(block_id)` before calling free().", type: "agent" }
                ])}
              </div>
              <div style="width:340px;background:var(--bg-secondary);border-left:1px solid var(--border-color);padding:14px;display:flex;flex-direction:column;overflow-y:auto;">
                <div style="font-weight:700;font-size:12px;margin-bottom:8px;display:flex;justify-content:space-between;">
                  <span>Physical Memory Allocation</span>
                  <span style="color:var(--accent-cyan);font-family:var(--font-mono);">76.4% Eff</span>
                </div>
                ${K.renderMemoryGrid(20, 8, 4)}
                <div class="metrics-row" style="margin-top:10px;">
                  <div class="metric-chip"><small>Prefix Hit Rate</small><b>84.2%</b></div>
                  <div class="metric-chip"><small>Tokens Cached</small><b>14.3k</b></div>
                </div>
                <div style="font-weight:700;font-size:12px;margin:12px 0 6px;">Logical -> Physical Page Table</div>
                <div style="background:var(--bg-surface);padding:8px;border-radius:6px;font-family:var(--font-mono);font-size:10px;line-height:1.6;">
                  Req #1 [Prompt A]: Logical [0..1] -> Phys [B0, B1] (Shared)<br>
                  Req #2 [Prompt B]: Logical [0..1] -> Phys [B0, B1] (Shared)<br>
                  Req #2 [Unique]:&nbsp;&nbsp;&nbsp;Logical [2..3] -> Phys [B14, B15]
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 02: Spatial Dataflow Whiteboard
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "infinite-canvas",
        n: 2,
        group: "workbenches",
        name: "Spatial Dataflow Whiteboard",
        tagline: "Infinite diagram canvas with live computable PyTorch nodes and wire validation",
        concept: "An infinite whiteboard (Tldraw/Obsidian Canvas style) where you draw system architecture diagrams with shapes and wires. Double-clicking any block opens its embedded Python implementation. A local AI agent checks whether your drawn dataflow wires match the PyTorch tensor dimensions and data dependencies.",
        moves: [
          "Endless zoomable canvas linking architecture diagrams directly to code",
          "Visual wire inspection: validates tensor shapes `[B, S, H, D]` across arrows",
          "Draw freehand memory layouts or use prebuilt infra nodes (KV Cache, Ray Worker)",
          "Dual AI agent: can generate code from diagrams or update diagrams from code changes"
        ],
        palette: [["Canvas Dark", "#12141A"], ["Wire Violet", "#8B5CF6"], ["Amber Node", "#F59E0B"], ["Grid Muted", "#232733"]],
        facts: { Archetype: "Visual Node Canvas", ExecutionModel: "WebAssembly + Local Python", AgentRole: "Diagram-to-Code Synthesizer", Effort: "L", Needs: "Canvas rendering engine" },
        render: () => `
          <div class="scr infinite-canvas">
            ${K.winBar("Spatial Dataflow Whiteboard — LLM Architecture Canvas", "Canvas", "Zoom: 85% · 14 Nodes Connected")}
            <div class="app-body">
              <div class="canvas-wrap">
                <!-- Floating Toolbar -->
                <div style="position:absolute;top:14px;left:14px;background:var(--bg-secondary);border:1px solid var(--border-strong);border-radius:8px;padding:6px;display:flex;gap:8px;z-index:10;">
                  <button style="background:transparent;border:0;color:var(--text-main);padding:4px 8px;cursor:pointer;">${I("plus", 14)} Add Node</button>
                  <button style="background:transparent;border:0;color:var(--text-main);padding:4px 8px;cursor:pointer;">${I("diagram", 14)} Draw Wire</button>
                  <button style="background:transparent;border:0;color:var(--text-main);padding:4px 8px;cursor:pointer;">${I("play", 14)} Execute Flow</button>
                  <button style="background:var(--accent-purple);border:0;color:#fff;border-radius:4px;padding:4px 10px;cursor:pointer;font-weight:600;">${I("sparkles", 14)} Agent Verify</button>
                </div>

                <!-- Node 1: Input Prompts -->
                <div class="canvas-node" style="top:70px;left:60px;">
                  <div class="node-header"><span>1. Tokenized Request</span><span class="badge mode">Input</span></div>
                  <div class="node-body">
                    <p>Batch of 4 prompts with shared system header</p>
                    <div style="font-family:var(--font-mono);font-size:10px;color:var(--accent-cyan);">Shape: [4, 512] int32</div>
                    <div class="node-ports"><span class="port-dot"></span><span>Output: tokens</span></div>
                  </div>
                </div>

                <!-- Node 2: Radix Tree Prefix Cache -->
                <div class="canvas-node" style="top:70px;left:380px;border-color:var(--accent-purple);">
                  <div class="node-header" style="background:rgba(168,85,247,0.15);color:var(--accent-purple);">
                    <span>2. Radix Cache Match</span><span class="badge mode">Algorithm</span>
                  </div>
                  <div class="node-body">
                    <p>Traverses prefix tree to reuse existing KV blocks</p>
                    <div style="background:var(--bg-primary);padding:6px;border-radius:4px;font-family:var(--font-mono);font-size:9px;">
                      def match(prompt):<br>&nbsp;&nbsp;return prefix_blocks
                    </div>
                    <div class="node-ports"><span>Input: tokens</span><span class="port-dot"></span></div>
                  </div>
                </div>

                <!-- Node 3: PagedAttention Kernel -->
                <div class="canvas-node" style="top:70px;left:700px;border-color:var(--accent-cyan);">
                  <div class="node-header" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">
                    <span>3. PagedAttention Kernel</span><span class="badge mode">CUDA</span>
                  </div>
                  <div class="node-body">
                    <p>Non-contiguous memory gather & attention computation</p>
                    <div style="font-family:var(--font-mono);font-size:10px;color:var(--accent-green);">Latency: 4.12ms</div>
                    <div class="node-ports"><span>Block Table</span><span class="port-dot"></span></div>
                  </div>
                </div>

                <!-- Agent Inspection Bubble -->
                <div style="position:absolute;bottom:20px;right:20px;background:var(--bg-secondary);border:1px solid var(--accent-purple);border-radius:10px;padding:12px;width:320px;box-shadow:0 12px 30px rgba(0,0,0,0.5);">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:700;color:var(--accent-purple);">
                    ${I("sparkles", 14)} Whiteboard Copilot
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);line-height:1.4;">
                    Your dataflow wire between <b>Radix Cache</b> and <b>PagedAttention</b> correctly passes <code>block_tables: [B, Max_Blocks]</code>. Ready to run the Triton benchmark?
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 03: Reactive Observable Hyper-Doc
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "reactive-notebook",
        n: 3,
        group: "workbenches",
        name: "Reactive Systems Notebook",
        tagline: "Observable/Marimo-style computable documents with reactive hardware sliders",
        concept: "A reactive, narrative-driven document where prose, executable PyTorch cells, and interactive hardware charts are bound together. Dragging a slider for 'Context Length' or 'Batch Size' instantly updates GPU memory consumption diagrams and re-evaluates the continuous batching scheduler.",
        moves: [
          "Interactive hardware knobs: Batch Size, KV Cache Quantization (FP8 vs FP16)",
          "Reactive recalculation: no out-of-order Jupyter notebook execution bugs",
          "Rich interactive SVG charts rendered directly between code blocks",
          "Inline agent that explains anomalies when memory curves spike"
        ],
        palette: [["Clean Slate", "#0F172A"], ["Indigo", "#6366F1"], ["Sky Blue", "#0EA5E9"], ["Card Gray", "#1E293B"]],
        facts: { Archetype: "Reactive Document", ExecutionModel: "Reactive Python Kernel", AgentRole: "Prose & Math Explainer", Effort: "M", Needs: "Reactive state graph" },
        render: () => `
          <div class="scr reactive-notebook">
            ${K.winBar("Reactive Systems Notebook — Understanding PagedAttention", "Notebook", "All 6 Cells Evaluated in 140ms")}
            <div class="app-body" style="background:var(--bg-primary);overflow-y:auto;padding:24px 60px;">
              <div style="max-width:880px;margin:0 auto;">
                <h1 style="font-size:24px;margin-bottom:8px;font-weight:800;">Deep Dive: KV Cache Memory Fragmentation</h1>
                <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px;">
                  In traditional autoregressive generation, memory is pre-allocated contiguously for the maximum sequence length, causing up to <b>60–80% memory waste</b>. Adjust the knobs below to see how PagedAttention solves this.
                </p>

                <!-- Interactive Hardware Sliders -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:16px;margin-bottom:20px;">
                  <div style="font-weight:700;font-size:12px;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                    ${I("sliders", 14)} Reactive Parameters
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
                        <span>Batch Size</span><b>32</b>
                      </div>
                      <input type="range" value="32" min="1" max="128" style="width:100%;">
                    </div>
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
                        <span>Max Context Length</span><b>8,192 tokens</b>
                      </div>
                      <input type="range" value="64" min="16" max="128" style="width:100%;">
                    </div>
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
                        <span>KV Cache Precision</span><b>FP8 (1 byte)</b>
                      </div>
                      <select style="width:100%;padding:4px;background:var(--bg-surface);color:var(--text-main);border:1px solid var(--border-color);border-radius:4px;"><option>FP8 (1 byte)</option><option>FP16 (2 bytes)</option></select>
                    </div>
                  </div>
                </div>

                <!-- Reactive Memory Comparison Chart -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:10px;padding:16px;margin-bottom:20px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;font-weight:700;">
                    <span>Calculated Memory Footprint</span>
                    <span style="color:var(--accent-green);">Paged Savings: 3.8x</span>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
                        <span>Naive Pre-allocation</span><b>64.0 GB (80% HBM OOM Risk)</b>
                      </div>
                      <div style="height:14px;background:rgba(239,68,68,0.25);border:1px solid #EF4444;border-radius:3px;width:100%;"></div>
                    </div>
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
                        <span>PagedAttention Dynamic Allocation</span><b>16.8 GB (Safe headroom)</b>
                      </div>
                      <div style="height:14px;background:rgba(16,185,129,0.3);border:1px solid #10B981;border-radius:3px;width:26%;"></div>
                    </div>
                  </div>
                </div>

                <!-- Executable Python Cell -->
                <div style="border:1px solid var(--border-strong);border-radius:8px;overflow:hidden;">
                  <div style="background:var(--bg-surface);padding:6px 12px;font-size:11px;font-family:var(--font-mono);display:flex;justify-content:space-between;">
                    <span>[Cell 4] Python 3.11</span><span style="color:var(--accent-green);">${I("check", 12)} Ran in 12ms</span>
                  </div>
                  <div style="background:var(--bg-secondary);padding:12px;font-family:var(--font-mono);font-size:11px;">
                    block_size = <span class="num">16</span><br>
                    num_blocks = math.ceil(actual_tokens / block_size)<br>
                    print(f<span class="str">"Allocated {num_blocks} blocks without memory gaps"</span>)
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 04: Ambient Socratic Sidecar
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "dockable-sidecar",
        n: 4,
        group: "workbenches",
        name: "Ambient Socratic Sidecar",
        tagline: "Floating desktop dock that attaches to Cursor/VSCode with pop-up architecture challenges",
        concept: "A zero-friction companion app that doesn't try to replace your existing editor. It floats alongside your native VS Code or Cursor window via Language Server Protocol (LSP). As you write code, it quietly watches your functions and pops subtle Socratic challenges, architecture quizzes, and instant micro-benchmarks.",
        moves: [
          "Zero migration friction: keep coding in your preferred native VS Code / Cursor",
          "Passive codebase watcher via LSP: detects when you implement custom attention or caches",
          "Socratic tutor: asks questions rather than giving immediate answers ('Why did you choose LRU?')",
          "Quick mini-scratchpad pops up for instant diagramming without leaving your flow"
        ],
        palette: [["Deep Slate", "#0A0D12"], ["Electric Violet", "#A855F7"], ["Teal", "#14B8A6"], ["Soft Border", "#1E2638"]],
        facts: { Archetype: "Floating Sidecar Dock", ExecutionModel: "Editor LSP Bridge", AgentRole: "Socratic Inquisitor", Effort: "S", Needs: "LSP extension" },
        render: () => `
          <div class="scr dockable-sidecar">
            ${K.winBar("Desktop View — Native VS Code + Heji Socratic Sidecar", "Sidecar Dock", "Attached to PID: 48921 (Cursor)")}
            <div class="app-body">
              <!-- Left 70%: Native Editor Representation -->
              <div style="flex:1;background:#181A1F;padding:16px;font-family:var(--font-mono);font-size:11px;color:#ABB2BF;border-right:2px solid var(--border-strong);">
                <div style="color:var(--text-dim);margin-bottom:12px;"># Your real Cursor editor workspace — project/vllm-toy/model.py</div>
                <span class="kw">class</span> <span class="type">AttentionKernel</span>(torch.nn.Module):<br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">forward</span>(<span class="type">self</span>, q, k, v, block_table):<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Sidecar detected: Non-contiguous KV cache lookup implementation</span><br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;scores = torch.matmul(q, k.transpose(-<span class="num">1</span>, -<span class="num">2</span>))<br>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> scores
              </div>

              <!-- Right 30%: Floating Socratic Sidecar -->
              <div style="width:380px;background:var(--bg-secondary);padding:16px;display:flex;flex-direction:column;gap:14px;">
                <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:var(--accent-purple);">
                  ${I("sparkles", 16)} Heji Systems Sidecar
                  <span class="badge mode" style="margin-left:auto;">Observing</span>
                </div>

                <div style="background:var(--bg-surface);border:1px solid rgba(168,85,247,0.3);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:11px;color:var(--accent-purple);margin-bottom:4px;">
                    Socratic Inquiry #14
                  </div>
                  <div style="font-size:11px;line-height:1.4;color:var(--text-main);margin-bottom:10px;">
                    "You are performing a standard <code>matmul</code> across full sequences. If block tables are used, where does the memory gather occur?"
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button style="flex:1;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-main);border-radius:4px;padding:6px;font-size:10px;cursor:pointer;">
                      ${I("diagram", 12)} Draw Memory Gather
                    </button>
                    <button style="flex:1;background:var(--accent-purple);border:0;color:#fff;border-radius:4px;padding:6px;font-size:10px;cursor:pointer;font-weight:600;">
                      Inject Benchmark
                    </button>
                  </div>
                </div>

                <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:11px;margin-bottom:6px;">Mini Architecture Scratchpad</div>
                  <div style="height:120px;border:1px dashed var(--border-strong);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:11px;">
                    [Quick SVG Whiteboard: Tap to sketch attention masks]
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 05: Unified Omniverse Shell
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "unified-omniverse",
        n: 5,
        group: "workbenches",
        name: "Unified Omniverse Cockpit",
        tagline: "4-quadrant power workspace: Architecture Canvas + Code Editor + Profiler + Agent Shell",
        concept: "The ultimate power-user cockpit uniting all tools into one synchronized 4-quadrant layout: Architecture Canvas (top-left), PyTorch Editor (top-right), Hardware Profiler & Memory Map (bottom-left), and Autonomous Local Agent CLI (bottom-right). Editing anywhere immediately updates the other three.",
        moves: [
          "Complete synchronization: modifying code updates the canvas diagram in real-time",
          "Dedicated hardware profiling quadrant with live memory bandwidth meters",
          "Autonomous local agent terminal with full shell execution privileges",
          "Preset layouts for different tasks (e.g. 'Kernel Optimization', 'Cluster Debugging')"
        ],
        palette: [["Space Black", "#0B0D12"], ["Cyan", "#00F0FF"], ["Magenta", "#FF007A"], ["Zinc", "#27272A"]],
        facts: { Archetype: "4-Quadrant Cockpit", ExecutionModel: "Multi-Process IPC", AgentRole: "Full Autonomous Co-Pilot", Effort: "L", Needs: "Grid docking manager" },
        render: () => `
          <div class="scr unified-omniverse">
            ${K.winBar("Unified Omniverse Cockpit — Complete Systems Environment", "Omni", "All 4 Engines Synchronized")}
            <div class="app-body" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;background:var(--border-strong);">
              <!-- Quadrant 1: Canvas (Top Left) -->
              <div style="background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
                <div style="background:var(--bg-secondary);padding:6px 10px;font-size:11px;font-weight:700;display:flex;justify-content:space-between;">
                  <span>Q1: Architecture & Dataflow Canvas</span><span class="badge mode">Live Sync</span>
                </div>
                <div style="flex:1;background-image:radial-gradient(var(--border-color) 1px, transparent 1px);background-size:14px 14px;padding:12px;position:relative;">
                  <div class="canvas-node" style="top:12px;left:12px;width:180px;">
                    <div class="node-header"><span>vLLM Engine</span></div>
                    <div class="node-body"><p>Scheduler -> BlockManager</p></div>
                  </div>
                  <div class="canvas-node" style="top:12px;left:240px;width:180px;border-color:var(--accent-cyan);">
                    <div class="node-header"><span>PagedAttn</span></div>
                    <div class="node-body"><p>CUDA Kernel Launcher</p></div>
                  </div>
                </div>
              </div>

              <!-- Quadrant 2: Code Editor (Top Right) -->
              <div style="background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
                <div style="background:var(--bg-secondary);padding:6px 10px;font-size:11px;font-weight:700;display:flex;justify-content:space-between;">
                  <span>Q2: PyTorch Kernel Implementation</span><span style="color:var(--accent-cyan);font-family:var(--font-mono);">radix.py</span>
                </div>
                <div style="flex:1;padding:10px;font-family:var(--font-mono);font-size:10px;line-height:1.5;overflow-y:auto;">
                  <span class="kw">def</span> <span class="fn">allocate_paged_kv</span>(seq_len: <span class="type">int</span>, block_size: <span class="type">int</span> = <span class="num">16</span>):<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;blocks = (seq_len + block_size - <span class="num">1</span>) // block_size<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> [allocator.get_free_block() <span class="kw">for</span> _ <span class="kw">in</span> range(blocks)]
                </div>
              </div>

              <!-- Quadrant 3: Hardware Profiler (Bottom Left) -->
              <div style="background:var(--bg-secondary);display:flex;flex-direction:column;overflow:hidden;padding:10px;">
                <div style="font-size:11px;font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;">
                  <span>Q3: GPU HBM3 Memory & Roofline</span><span style="color:var(--accent-green);">2.8 TB/s (84% Peak)</span>
                </div>
                ${K.renderMemoryGrid(16, 10, 6)}
              </div>

              <!-- Quadrant 4: Agent Terminal (Bottom Right) -->
              <div style="background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
                ${K.renderTerminal("heji-agent run-suite --target=sglang-radix", [
                  { text: "[AGENT] Executing test suite against mock CUDA runtime...", type: "agent" },
                  { text: "[VERIFIED] 18 unit tests passed with 0 memory leaks.", type: "pass" },
                  { text: "[READY] Syncing updated graph topology back to Q1 canvas.", type: "info" }
                ])}
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // GROUP 2: Simulation, Emulation & Profiling Labs
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "cluster-emulator",
        n: 6,
        group: "simulators",
        name: "Virtual 8xH100 Cluster Deck",
        tagline: "Distributed training & inference simulator with simulated NVLink & InfiniBand topologies",
        concept: "You don't need a $300,000 8xH100 server rack to master distributed infrastructure. This deck simulates an 8-GPU cluster inside your local machine. Visualizes 3D parallelism (Tensor Parallelism TP=2, Pipeline Parallelism PP=2, Data Parallelism DP=2), simulated all-reduce collective communications, and bandwidth bottlenecks.",
        moves: [
          "Interactive 8-GPU topology rack with animated inter-GPU tensor packets",
          "Simulated NCCL collectives: Ring All-Reduce, All-Gather, Reduce-Scatter",
          "Inject artificial network latency to observe pipeline bubble stalls",
          "Step-by-step distributed PyTorch `torch.distributed` code execution"
        ],
        palette: [["Infra Dark", "#080B10"], ["NVIDIA Green", "#76B900"], ["Comm Blue", "#38BDF8"], ["Rack Gray", "#1F2937"]],
        facts: { Archetype: "Distributed Cluster Simulator", ExecutionModel: "Mock NCCL / Multiprocessing", AgentRole: "Cluster SRE Tutor", Effort: "L", Needs: "Distributed comms emulator" },
        render: () => `
          <div class="scr cluster-emulator">
            ${K.winBar("Virtual 8xH100 Cluster Deck — Megatron-LM 3D Parallelism", "Simulator", "8 Virtual GPUs Online · NVLink 900 GB/s")}
            <div class="app-body">
              <div style="flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--bg-primary);overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <h2 style="font-size:16px;font-weight:800;margin:0 0 2px;">Simulated Node: 8x NVIDIA H100 80GB SXM5</h2>
                    <small style="color:var(--text-muted);">Topology: Hybrid NVSwitch Mesh + 400Gb/s InfiniBand Interconnect</small>
                  </div>
                  <div style="display:flex;gap:8px;">
                    <span class="badge mode" style="background:rgba(118,185,0,0.15);color:#76B900;">TP=2</span>
                    <span class="badge mode" style="background:rgba(59,130,246,0.15);color:#3B82F6;">PP=2</span>
                    <span class="badge mode" style="background:rgba(168,85,247,0.15);color:#A855F7;">DP=2</span>
                  </div>
                </div>

                <!-- 8-GPU Grid Visualization -->
                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;">
                  ${[0, 1, 2, 3, 4, 5, 6, 7].map(gpu => `
                    <div style="background:var(--bg-secondary);border:1px solid ${gpu < 2 ? "#76B900" : "var(--border-color)"};border-radius:8px;padding:10px;">
                      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:11px;margin-bottom:6px;">
                        <span>GPU #${gpu}</span><span style="color:${gpu < 2 ? "#76B900" : "var(--text-dim)"};">Rank ${gpu}</span>
                      </div>
                      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Layer: ${Math.floor(gpu / 2) * 16}..${(Math.floor(gpu / 2) + 1) * 16}</div>
                      <div style="height:6px;background:var(--bg-surface);border-radius:3px;overflow:hidden;margin-bottom:6px;">
                        <div style="width:${45 + gpu * 5}%;height:100%;background:#76B900;"></div>
                      </div>
                      <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-dim);display:flex;justify-content:space-between;">
                        <span>AllReduce: Active</span><span>${(58.4 + gpu * 1.2).toFixed(1)} GB/s</span>
                      </div>
                    </div>
                  `).join("")}
                </div>

                <!-- Code & Collectives Monitor -->
                <div style="display:flex;gap:12px;flex:1;">
                  <div style="flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;font-family:var(--font-mono);font-size:11px;">
                    <div style="font-weight:700;color:var(--accent-cyan);margin-bottom:6px;"># PyTorch Tensor Parallel Forward Pass</div>
                    <span class="kw">def</span> <span class="fn">tensor_parallel_forward</span>(x):<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;x_local = torch.chunk(x, chunks=<span class="num">2</span>, dim=-<span class="num">1</span>)[rank % <span class="num">2</span>]<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;y_local = torch.matmul(x_local, weights[rank % <span class="num">2</span>])<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Collective Ring All-Reduce across TP group</span><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;dist.all_reduce(y_local, op=dist.ReduceOp.SUM, group=tp_group)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> y_local
                  </div>
                  <div style="width:320px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;">
                    <div>
                      <div style="font-weight:700;font-size:11px;margin-bottom:4px;">Pipeline Bubble Analysis</div>
                      <div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">1F1B (One-Forward-One-Backward) schedule</div>
                      <div style="height:24px;background:var(--bg-surface);border-radius:4px;display:flex;overflow:hidden;font-family:var(--font-mono);font-size:9px;line-height:24px;text-align:center;">
                        <span style="width:25%;background:#3B82F6;">F0</span>
                        <span style="width:25%;background:#60A5FA;">F1</span>
                        <span style="width:15%;background:#EF4444;" title="Bubble Stall">Idle</span>
                        <span style="width:35%;background:#10B981;">B0</span>
                      </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-dim);">Bubble Efficiency: <b>82.4%</b> (Target: >85%)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 07: Roofline & Kernel Profiler Lab
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "roofline-lab",
        n: 7,
        group: "simulators",
        name: "Roofline & Kernel Lab",
        tagline: "Performance-first profiler targeting memory bandwidth and compute saturation",
        concept: "An infrastructure engineer lives and dies by hardware saturation. This lab centers around the classic Roofline Model (Arithmetic Intensity vs GFLOP/s). Every exercise gives you an unoptimized PyTorch kernel and challenges you to push its performance closer to the H100 theoretical hardware ceiling (3.35 TB/s HBM bandwidth).",
        moves: [
          "Interactive Roofline Model visualization: Memory-Bound vs Compute-Bound zones",
          "Automated Triton/CUDA kernel compilation and benchmark harness",
          "Calculates exact operational arithmetic intensity (FLOPs / byte transferred)",
          "Actionable suggestions: operator fusion, shared memory tiling, FP8 conversion"
        ],
        palette: [["Dark Lab", "#0F1115"], ["Roofline Coral", "#FF5C5C"], ["Target Gold", "#EAB308"], ["Navy", "#1E293B"]],
        facts: { Archetype: "Hardware Profiling Lab", ExecutionModel: "Torch Benchmark + Triton", AgentRole: "Performance Optimization Specialist", Effort: "M", Needs: "Roofline math engine" },
        render: () => `
          <div class="scr roofline-lab">
            ${K.winBar("Roofline & Kernel Lab — FlashAttention vs Naive Attention", "Profiler", "H100 SXM: 3.35 TB/s Bandwidth Ceiling")}
            <div class="app-body">
              <div style="flex:1;padding:16px;display:flex;gap:16px;background:var(--bg-primary);">
                <!-- Left: Roofline Visualizer -->
                <div style="flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:16px;display:flex;flex-direction:column;">
                  <div style="font-weight:700;font-size:13px;margin-bottom:4px;display:flex;justify-content:space-between;">
                    <span>Arithmetic Intensity Roofline Curve</span>
                    <span style="color:var(--accent-amber);font-size:11px;">H100 80GB SXM5</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">Log-log plot of operational intensity (FLOPs/byte) vs achievable performance.</div>

                  <!-- Mock Roofline SVG Curve -->
                  <div style="flex:1;border-bottom:2px solid var(--border-strong);border-left:2px solid var(--border-strong);position:relative;margin:10px 10px 30px 30px;">
                    <!-- Sloped Bandwidth Bound Line -->
                    <div style="position:absolute;bottom:0;left:0;width:55%;height:85%;border-top:3px solid #38BDF8;transform:skewY(35deg);transform-origin:bottom left;"></div>
                    <!-- Flat Compute Ceiling Line -->
                    <div style="position:absolute;top:15%;left:48%;right:0;border-top:3px dashed #FF5C5C;"></div>
                    <span style="position:absolute;top:8%;right:10px;font-size:10px;color:#FF5C5C;font-family:var(--font-mono);">Peak Compute: 989 TFLOP/s (FP16)</span>

                    <!-- Point 1: Naive Attention (Memory Bound) -->
                    <div style="position:absolute;bottom:30%;left:25%;display:flex;flex-direction:column;align-items:center;">
                      <div style="width:12px;height:12px;border-radius:50%;background:#EF4444;box-shadow:0 0 10px #EF4444;"></div>
                      <span style="font-size:9px;color:#EF4444;margin-top:4px;white-space:nowrap;font-weight:700;">Naive Attn (14% BW)</span>
                    </div>

                    <!-- Point 2: Your Flash Kernel (Target) -->
                    <div style="position:absolute;bottom:65%;left:52%;display:flex;flex-direction:column;align-items:center;">
                      <div style="width:14px;height:14px;border-radius:50%;background:#10B981;box-shadow:0 0 12px #10B981;"></div>
                      <span style="font-size:9px;color:#10B981;margin-top:4px;white-space:nowrap;font-weight:700;">FlashAttn-2 (82% Peak)</span>
                    </div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);font-family:var(--font-mono);">
                    <span>0.1 (Strictly Memory Bound)</span>
                    <span>10.0 (Transition Knee)</span>
                    <span>100.0 (Compute Bound)</span>
                  </div>
                </div>

                <!-- Right: Kernel Code & Stats -->
                <div style="width:420px;display:flex;flex-direction:column;gap:12px;">
                  <div class="metrics-row">
                    <div class="metric-chip"><small>Memory BW</small><b>2.74 TB/s</b></div>
                    <div class="metric-chip"><small>Speedup</small><b style="color:var(--accent-green);">5.8x</b></div>
                    <div class="metric-chip"><small>SRAM Spills</small><b>0 KB</b></div>
                  </div>
                  <div style="flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;font-family:var(--font-mono);font-size:10px;overflow-y:auto;">
                    <div style="color:var(--text-dim);margin-bottom:6px;"># Triton Shared Memory Tiling</div>
                    @triton.jit<br>
                    <span class="kw">def</span> <span class="fn">_fused_attention_kernel</span>(Q, K, V, sm_scale):<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;offs_m = tl.arange(<span class="num">0</span>, BLOCK_M)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># Keep tiles in fast 228 KB SRAM</span><br>
                    &nbsp;&nbsp;&nbsp;&nbsp;q = tl.load(q_ptrs + offs_m)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;k = tl.load(k_ptrs + offs_n)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;acc = tl.dot(q, k) * sm_scale
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 08: PagedAttention & Memory Arena
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "memory-arena",
        n: 8,
        group: "simulators",
        name: "PagedAttention Memory Arena",
        tagline: "Live memory allocation playground with interactive token stream simulation",
        concept: "A dedicated memory management arena replicating the heart of vLLM and SGLang. Watch simulated token sequences arrive in real-time, see logical blocks dynamically allocated into physical HBM pages, track prefix tree deduplication across multi-turn user conversations, and write custom eviction algorithms.",
        moves: [
          "Dynamic token generator: stream prompts and watch blocks fill token by token",
          "Radix prefix tree visualizer showing shared system prompts across 100 requests",
          "Write and test eviction policies: LRU, LFU, and Attention-Weight priority",
          "Simulate out-of-memory preemption: token swapping between GPU HBM and Host CPU RAM"
        ],
        palette: [["Arena Slate", "#0D1117"], ["Page Cyan", "#38BDF8"], ["Prefix Purple", "#C084FC"], ["Warning Coral", "#FB7185"]],
        facts: { Archetype: "Memory Simulator Arena", ExecutionModel: "Step-by-Step State Machine", AgentRole: "Allocator Tester", Effort: "M", Needs: "Memory state renderer" },
        render: () => `
          <div class="scr memory-arena">
            ${K.winBar("PagedAttention Memory Arena — vLLM Cache Subsystem", "Arena", "Tokens Streaming · 24 Active Streams")}
            <div class="app-body" style="padding:16px;background:var(--bg-primary);display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <h2 style="font-size:16px;font-weight:800;margin:0 0 2px;">GPU Memory Allocator & Prefix Cache Inspector</h2>
                  <small style="color:var(--text-muted);">Real-time block table mapping for concurrent LLM requests</small>
                </div>
                <div style="display:flex;gap:8px;">
                  <button style="background:var(--accent-blue);color:#fff;border:0;border-radius:4px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;">
                    ${I("play", 12)} Stream Next 10 Tokens
                  </button>
                  <button style="background:var(--bg-surface);color:var(--text-main);border:1px solid var(--border-color);border-radius:4px;padding:6px 12px;font-size:11px;cursor:pointer;">
                    ${I("refresh", 12)} Trigger GC
                  </button>
                </div>
              </div>

              ${K.renderMemoryGrid(24, 12, 8)}

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;">
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:12px;margin-bottom:8px;">Active Streams & Logical Block Tables</div>
                  <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
                    <div style="background:var(--bg-surface);padding:8px;border-radius:4px;">
                      <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:2px;">
                        <span>Req #104: "Translate Python to Rust..."</span>
                        <span style="color:var(--accent-cyan);">Generating (Tok 142)</span>
                      </div>
                      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">
                        Logical Blocks [0..8] -> Physical [B0(P), B1(P), B4, B7, B12, B13, B18, B19, B21]
                      </div>
                    </div>
                    <div style="background:var(--bg-surface);padding:8px;border-radius:4px;">
                      <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:2px;">
                        <span>Req #105: "Translate Python to C++..."</span>
                        <span style="color:var(--accent-purple);">Shared Prefix (Hit!)</span>
                      </div>
                      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">
                        Logical Blocks [0..2] -> Reused Physical [B0(P), B1(P)] (Zero Alloc)
                      </div>
                    </div>
                  </div>
                </div>

                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;font-family:var(--font-mono);font-size:10px;">
                  <div style="font-weight:700;font-size:11px;margin-bottom:6px;color:var(--accent-amber);">
                    LRU Block Eviction Algorithm
                  </div>
                  <span class="kw">def</span> <span class="fn">evict_if_needed</span>(required_blocks: <span class="type">int</span>):<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">while</span> allocator.free_count < required_blocks:<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;candidate = radix_tree.find_lru_leaf()<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> candidate.ref_count == <span class="num">0</span>:<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allocator.free(candidate.block_id)<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;radix_tree.evict_node(candidate)
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 09: Post-Training Orchestration Lab
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "rl-topology-lab",
        n: 9,
        group: "simulators",
        name: "Post-Training Infra Director",
        tagline: "Actor-Critic-Rollout pipeline coordinator for GRPO, PPO, and DPO training loops",
        concept: "Master modern post-training infrastructure from zero to hero (DeepSeek-R1 / GRPO, PPO, DPO). Visualizes the distributed interplay between the high-throughput rollout generation pool (vLLM engines), the reward model scoring actors, and the Megatron-LM actor model policy updates over Ray.",
        moves: [
          "Interactive topology wiring: connect vLLM generation workers to Ray Actor pools",
          "Tune rollout-to-train ratios: find optimal generation vs gradient update balance",
          "Simulated reward curves, KL divergence monitors, and advantage normalization math",
          "Write checkpoint serialization and zero-bubble parameter weight broadcast routines"
        ],
        palette: [["Deep Indigo", "#0C0E1A"], ["Actor Violet", "#8B5CF6"], ["Reward Amber", "#F59E0B"], ["Policy Teal", "#14B8A6"]],
        facts: { Archetype: "Post-Training Orchestrator", ExecutionModel: "Ray Task Graph Simulator", AgentRole: "RL Training SRE", Effort: "L", Needs: "Actor pipeline graph" },
        render: () => `
          <div class="scr rl-topology-lab">
            ${K.winBar("Post-Training Infra Director — GRPO Distributed Pipeline", "RL Infra", "Ray Cluster 32 Workers Active")}
            <div class="app-body" style="padding:16px;background:var(--bg-primary);display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <h2 style="font-size:16px;font-weight:800;margin:0 0 2px;">GRPO Training Topology (DeepSeek-R1 Style)</h2>
                  <small style="color:var(--text-muted);">Group Relative Policy Optimization · No Critic Model Needed</small>
                </div>
                <div class="badge mode" style="background:rgba(139,92,246,0.15);color:var(--accent-purple);">Step: 1,420 / 10,000</div>
              </div>

              <!-- 4-Stage Distributed Pipeline -->
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
                <div style="background:var(--bg-secondary);border:1px solid var(--accent-cyan);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:11px;color:var(--accent-cyan);margin-bottom:4px;">1. Rollout Engine</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">vLLM Worker Pool (16 GPUs)</div>
                  <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;">48.2k tokens/s</div>
                  <small style="color:var(--accent-green);">G=8 samples per prompt</small>
                </div>

                <div style="background:var(--bg-secondary);border:1px solid var(--accent-amber);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:11px;color:var(--accent-amber);margin-bottom:4px;">2. Reward Scoring</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Rule & Math Verifier</div>
                  <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;">+0.84 Mean R</div>
                  <small style="color:var(--text-dim);">Accuracy + Format Reward</small>
                </div>

                <div style="background:var(--bg-secondary);border:1px solid var(--accent-purple);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:11px;color:var(--accent-purple);margin-bottom:4px;">3. Advantage Normalization</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Group-Relative Stats</div>
                  <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;">A = (R - μ) / σ</div>
                  <small style="color:var(--text-dim);">Zero Critic Memory Overhead</small>
                </div>

                <div style="background:var(--bg-secondary);border:1px solid var(--accent-green);border-radius:8px;padding:12px;">
                  <div style="font-weight:700;font-size:11px;color:var(--accent-green);margin-bottom:4px;">4. Policy Gradient</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">Megatron FSDP (16 GPUs)</div>
                  <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;">Loss: 0.041</div>
                  <small style="color:var(--accent-green);">KL Divergence: 0.032</small>
                </div>
              </div>

              <!-- Ray Task Scheduling Code & Timeline -->
              <div style="flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;gap:12px;">
                <div style="flex:1;font-family:var(--font-mono);font-size:10px;overflow-y:auto;">
                  <div style="color:var(--text-dim);margin-bottom:6px;"># Ray Distributed Orchestration Loop</div>
                  @ray.remote<br>
                  <span class="kw">def</span> <span class="fn">grpo_step</span>(prompts):<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;rollouts_ref = vllm_pool.generate.remote(prompts, group_size=<span class="num">8</span>)<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;rewards_ref = reward_actors.score.remote(rollouts_ref)<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;advantages = normalize_group_rewards(ray.get(rewards_ref))<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;policy_update = trainer.backward_step.remote(rollouts_ref, advantages)<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> ray.get(policy_update)
                </div>
                <div style="width:300px;background:var(--bg-surface);padding:10px;border-radius:6px;font-size:11px;">
                  <div style="font-weight:700;margin-bottom:6px;">Infrastructure Bottlenecks</div>
                  <div style="color:var(--text-muted);font-size:10px;line-height:1.5;">
                    Rollout engine is waiting on Megatron weights sync (takes 1.2s per step).<br><br>
                    <b>Recommendation:</b> Implement asynchronous double-buffering for weight broadcast via Ray object store.
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 10: Post-Training SRE Incident Commander
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "incident-commander",
        n: 10,
        group: "simulators",
        name: "Cluster SRE Incident Game",
        tagline: "High-stakes crisis simulator: diagnose training loss spikes, OOMs, and GPU silent data corruption",
        concept: "The ultimate trial by fire for systems engineers. Gamified crisis scenarios: 'Your 1,024-GPU Llama 3 training run just crashed at Step 8,420 with NaN loss and GPU 7 NVLink failure.' You inspect simulated Grafana metrics, analyze error stack traces, diagnose the bug, write the fix script, and resume without losing state.",
        moves: [
          "Real-world infra scenarios: NaN loss spikes, silent data corruption, InfiniBand packet drops",
          "Grafana-style telemetry dashboard with GPU temperatures, memory utilization, and loss charts",
          "Interactive terminal to run diagnostics: `nvidia-smi nvlink -s`, `ray status`",
          "Scores your Mean Time to Recovery (MTTR) and resource cost saved"
        ],
        palette: [["Dark Alert", "#0F0B0C"], ["Emergency Red", "#EF4444"], ["Warning Amber", "#F59E0B"], ["Console Gray", "#1F232B"]],
        facts: { Archetype: "Incident Simulation Game", ExecutionModel: "Scenario Engine & Logs", AgentRole: "Incident Commander & Reviewer", Effort: "M", Needs: "Log generator" },
        render: () => `
          <div class="scr incident-commander">
            ${K.winBar("Mission Control SRE Simulator — Training Incident #409", "CRISIS", "Cluster Halted · $4,200/hr Burn Rate")}
            <div class="app-body" style="background:var(--bg-primary);display:flex;flex-direction:column;">
              <div class="sre-alert-bar">
                <span style="color:#EF4444;display:flex;">${I("alert", 18)}</span>
                <span>SEV-1 ALERT: 1,024-GPU Post-Training Cluster Halted at Step #4,210. Reason: <code>Gradient Norm NaN Spike</code></span>
                <span class="badge mode" style="background:#EF4444;color:#fff;margin-left:auto;">MTTR Clock: 04:12</span>
              </div>

              <div class="telemetry-row">
                <div class="gpu-card err">
                  <div style="font-weight:700;font-size:11px;color:#EF4444;margin-bottom:4px;">Node #14 - GPU 3 (Rank 115)</div>
                  <div style="font-size:10px;color:var(--text-muted);">NVLink CRC Error Count: <b>14,892</b></div>
                  <div style="font-size:10px;color:#EF4444;">Hardware Alert: Silent Data Corruption</div>
                </div>
                <div class="gpu-card">
                  <div style="font-weight:700;font-size:11px;margin-bottom:4px;">Node #14 - GPU 0..2, 4..7</div>
                  <div style="font-size:10px;color:var(--text-muted);">Waiting on collective sync barrier</div>
                  <div style="font-size:10px;color:var(--accent-amber);">State: Stalled in NCCL AllReduce</div>
                </div>
                <div class="gpu-card">
                  <div style="font-weight:700;font-size:11px;margin-bottom:4px;">Active Checkpoint State</div>
                  <div style="font-size:10px;color:var(--text-muted);">Last clean snapshot: Step #4,200 (10 mins ago)</div>
                  <div style="font-size:10px;color:var(--accent-green);">Async Checkpoint Ready on S3</div>
                </div>
              </div>

              <div style="flex:1;padding:0 14px 14px;display:flex;gap:12px;">
                <div style="flex:1;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;display:flex;flex-direction:column;">
                  <div style="padding:8px 12px;background:var(--bg-surface);border-bottom:1px solid var(--border-color);font-weight:700;font-size:11px;">
                    SRE Diagnostic Terminal
                  </div>
                  <div style="flex:1;padding:10px;font-family:var(--font-mono);font-size:10px;color:var(--text-main);line-height:1.6;overflow-y:auto;">
                    $ heji-cluster isolate-node --node=worker-14<br>
                    <span style="color:var(--accent-green);">[OK] Node worker-14 cordoned. Healthy spare spare-02 promoted.</span><br>
                    $ cat /var/log/torch_gradient_norm.log | tail -n 3<br>
                    <span style="color:#EF4444;">Step 4208: grad_norm = 1.42<br>Step 4209: grad_norm = 14.89 (Warning)<br>Step 4210: grad_norm = NaN (Aborted)</span><br>
                    $ # Ready to apply gradient clip fix and resume from step 4200
                  </div>
                </div>
                <div style="width:300px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;flex-direction:column;">
                  <div style="font-weight:700;font-size:11px;margin-bottom:6px;">Resolution Playbook</div>
                  <div style="display:flex;flex-direction:column;gap:6px;font-size:10px;">
                    <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" checked> Cordon bad node</label>
                    <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" checked> Verify checkpoint integrity</label>
                    <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox"> Add FP32 gradient clipping hook</label>
                    <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox"> Resume training cluster</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // GROUP 3: Progressive Scaffolding & Kata Dojos
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "byo-engine",
        n: 11,
        group: "dojos",
        name: "'Build Your Own' Engine Scaffolder",
        tagline: "Test-driven zero-to-hero milestone synthesizer: nano-vllm, nano-sglang, nano-grpo",
        concept: "The most durable way to master infrastructure is to build it from scratch piece by piece. This candidate structures your journey like Andrej Karpathy's `nanoGPT`, but for high-performance engines (`nano-vllm`, `nano-sglang`, `nano-grpo`). Each milestone includes passing tests, architectural constraints, and side-by-side diffs against production repos.",
        moves: [
          "Milestone 1 to 10 progression: from 50-line toy model to full continuous batching",
          "Automated test suites verify your code against production invariants",
          "Side-by-side source code diff comparator against real vLLM and SGLang PRs",
          "Synthesizes custom benchmarks to prove throughput improvements"
        ],
        palette: [["Blueprint Dark", "#0B1015"], ["Architect Blue", "#2563EB"], ["Milestone Green", "#059669"], ["Border Subtle", "#1E2A38"]],
        facts: { Archetype: "Milestone-Driven Scaffolder", ExecutionModel: "Local Test Suite Runner", AgentRole: "Milestone Assessor", Effort: "M", Needs: "Milestone test harnesses" },
        render: () => `
          <div class="scr byo-engine">
            ${K.winBar("Build Your Own: nano-vLLM — Milestone 04 / 10", "Scaffolder", "4 / 10 Milestones Completed")}
            <div class="app-body">
              <aside class="sidebar" style="width:280px;">
                <div class="sb-section-title">Milestones: nano-vLLM</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M1: Naive Autoregressive Loop</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M2: Static KV Cache Allocation</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> M3: Dynamic Request Queue</div>
                <div class="sb-item active"><span class="app-icon" style="color:var(--accent-cyan);">${I("play", 12)}</span> M4: PagedAttention Block Allocator</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M5: Continuous Batching Scheduler</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M6: Chunked Prefill Tiling</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> M7: Speculative Decoding Drafter</div>
              </aside>
              <div class="code-editor">
                <div class="editor-tabs">
                  <div class="editor-tab active">nano_vllm/block_manager.py</div>
                  <div class="editor-tab">tests/test_m4_paged_memory.py</div>
                  <div class="editor-tab" style="color:var(--accent-amber);">vLLM Reference Diff</div>
                </div>
                <div class="code-scroll">
                  <div style="background:rgba(59,130,246,0.1);padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:11px;color:var(--text-main);">
                    <b>Milestone 4 Objective:</b> Implement <code>allocate_block()</code> and <code>free_block()</code> using a free-list bitmask. Maintain constant O(1) allocation time without memory leaks.
                  </div>
                  <div class="code-line"><span class="ln">1</span><span class="txt"><span class="kw">class</span> <span class="type">BlockManager</span>:</span></div>
                  <div class="code-line"><span class="ln">2</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">__init__</span>(<span class="type">self</span>, total_blocks: <span class="type">int</span>):</span></div>
                  <div class="code-line"><span class="ln">3</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.free_blocks = collections.deque(range(total_blocks))</span></div>
                  <div class="code-line"><span class="ln">4</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.ref_counts = collections.defaultdict(<span class="type">int</span>)</span></div>
                  <div class="code-line"><span class="ln">5</span><span class="txt"></span></div>
                  <div class="code-line"><span class="ln">6</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">allocate</span>(<span class="type">self</span>) -> <span class="type">int</span>:</span></div>
                  <div class="code-line"><span class="ln">7</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> <span class="kw">not</span> <span class="type">self</span>.free_blocks:</span></div>
                  <div class="code-line"><span class="ln">8</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">raise</span> MemoryError(<span class="str">"Out of physical KV blocks!"</span>)</span></div>
                  <div class="code-line"><span class="ln">9</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;block_id = <span class="type">self</span>.free_blocks.popleft()</span></div>
                  <div class="code-line"><span class="ln">10</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.ref_counts[block_id] = <span class="num">1</span></span></div>
                  <div class="code-line"><span class="ln">11</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> block_id</span></div>
                </div>
                ${K.renderTerminal("pytest tests/test_m4_paged_memory.py", [
                  { text: "[PASS] test_o1_allocation_time (0.4ms)", type: "pass" },
                  { text: "[PASS] test_memory_exhaustion_exception (0.2ms)", type: "pass" },
                  { text: "[CONGRATS] Milestone 4 complete! Ready for M5: Continuous Batching.", type: "agent" }
                ])}
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 12: Terminal Kata Dojo
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "tui-dojo",
        n: 12,
        group: "dojos",
        name: "Terminal Kata Dojo",
        tagline: "Ultra-fast keyboard-first TUI for high-frequency PyTorch and systems drills",
        concept: "For engineers who love the speed and elegance of the terminal (Lazygit, Neovim, Tmux). Zero mouse reliance. Keyboard shortcuts (`j`/`k`/`Enter`) navigate 100+ bite-sized coding katas. Type code directly into the terminal pane, press `Ctrl+R` to execute, and see instant ASCII memory and tensor visualizations.",
        moves: [
          "Pure TUI interface: instant load times, zero electron/browser overhead",
          "Bite-sized katas: 5-minute timed challenges for muscle memory",
          "ASCII diagram renderer: draws memory tables and tensor shapes in plain text",
          "Vim navigation keys and local CLI agent hotkey integration"
        ],
        palette: [["Terminal Dark", "#090B0F"], ["Prompt Cyan", "#38BDF8"], ["Vim Amber", "#F59E0B"], ["Border Slate", "#1E293B"]],
        facts: { Archetype: "Keyboard-First TUI", ExecutionModel: "Native Terminal REPL", AgentRole: "Terminal Subprocess Agent", Effort: "S", Needs: "Bubbletea / Textual TUI" },
        render: () => `
          <div class="scr tui-dojo">
            <div class="tui-container">
              <div class="tui-header">
                <div><b>HEJI DOJO</b> :: PyTorch & Infra Katas [v0.8.2]</div>
                <div>Streak: <span style="color:#10B981;">14 Days</span> | Katas Solved: <b>42 / 100</b></div>
                <div>Keys: [j/k] Navigate [Enter] Select [Ctrl+R] Run [Ctrl+A] Agent</div>
              </div>
              <div class="tui-panes">
                <!-- Left Box: Kata List -->
                <div class="tui-box">
                  <div class="tui-title">-- KATA SELECTION --</div>
                  <div style="font-size:11px;line-height:1.7;">
                    <div>[x] 01_tensor_strides.py</div>
                    <div>[x] 02_custom_autograd.py</div>
                    <div>[x] 03_paged_attention_kernel.py</div>
                    <div style="background:#1E293B;color:#F59E0B;padding:0 4px;">> 04_radix_prefix_sharing.py</div>
                    <div>[ ] 05_chunked_prefill_mask.py</div>
                    <div>[ ] 06_speculative_drafter.py</div>
                    <div>[ ] 07_continuous_batching.py</div>
                    <div>[ ] 08_megatron_tp_linear.py</div>
                    <div>[ ] 09_fsdp_zero3_sharding.py</div>
                    <div>[ ] 10_ring_allreduce_nccl.py</div>
                  </div>
                </div>

                <!-- Center Box: Editor -->
                <div class="tui-box" style="grid-column:2;">
                  <div class="tui-title">-- EDITOR: 04_radix_prefix_sharing.py --</div>
                  <div style="font-size:11px;line-height:1.6;color:#E2E8F0;flex:1;">
                    <span style="color:#64748B;">1</span> <span style="color:#F43F5E;">def</span> <span style="color:#38BDF8;">find_prefix_match</span>(tree_root, tokens):<br>
                    <span style="color:#64748B;">2</span> &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#64748B;"># Exercise: Return length of shared token prefix</span><br>
                    <span style="color:#64748B;">3</span> &nbsp;&nbsp;&nbsp;&nbsp;node = tree_root<br>
                    <span style="color:#64748B;">4</span> &nbsp;&nbsp;&nbsp;&nbsp;matched = <span style="color:#FBBF24;">0</span><br>
                    <span style="color:#64748B;">5</span> &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#F43F5E;">for</span> t <span style="color:#F43F5E;">in</span> tokens:<br>
                    <span style="color:#64748B;">6</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#F43F5E;">if</span> t <span style="color:#F43F5E;">in</span> node.children:<br>
                    <span style="color:#64748B;">7</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;node = node.children[t]; matched += <span style="color:#FBBF24;">1</span><br>
                    <span style="color:#64748B;">8</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#F43F5E;">else</span>:<br>
                    <span style="color:#64748B;">9</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#F43F5E;">break</span><br>
                    <span style="color:#64748B;">10</span>&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#F43F5E;">return</span> matched
                  </div>
                  <div style="border-top:1px dashed #1E293B;padding-top:4px;font-size:10px;color:#10B981;">
                    [STATUS: Code executes cleanly in 0.8ms]
                  </div>
                </div>

                <!-- Right Box: ASCII Visualizer & Output -->
                <div class="tui-box">
                  <div class="tui-title">-- ASCII MEMORY INSPECTOR --</div>
                  <div style="font-size:10px;line-height:1.4;color:#94A3B8;">
                    +---------------------------+<br>
                    | RADIX TREE PREFIX CACHE&nbsp;&nbsp;&nbsp;|<br>
                    +---------------------------+<br>
                    &nbsp;&nbsp;ROOT<br>
                    &nbsp;&nbsp;&nbsp;|<br>
                    &nbsp;&nbsp;&nbsp;+-- [You are a...] (B0, B1)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- Prompt 1 -> (B2)<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- Prompt 2 -> (B3)<br><br>
                    Hit Rate:&nbsp;&nbsp;&nbsp;&nbsp;[||||||||||..] 80%<br>
                    Saved Mem:&nbsp;&nbsp;&nbsp;32 MB / 40 MB<br><br>
                    Agent Advice: Tree traversal matches SGLang radix structure. Press [Ctrl+N] for next kata.
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 13: Git Commit-by-Commit Decompiler
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "git-archeology",
        n: 13,
        group: "dojos",
        name: "Git Archeology Decompiler",
        tagline: "Reverse-engineer real open-source repos (vllm, sglang, megatron) commit-by-commit",
        concept: "Production repos like vLLM have 50,000 lines of complex enterprise boilerplate that obscures the original genius. This tool strips away the cruft and takes you on a chronological time-machine tour of the key historical commits (e.g. vLLM v0.1.0 commit #3b4a where PagedAttention was first introduced). You re-implement each critical PR.",
        moves: [
          "Interactive Git commit timeline filtering for pure algorithmic breakthrough commits",
          "Strips enterprise boilerplate (CI configs, CLI flags, multi-cloud adapters)",
          "Re-implement the exact PR commit diff and run historical test fixtures",
          "Curated historical repos: vLLM, SGLang, TensorRT-LLM, Megatron-LM, OpenRLHF"
        ],
        palette: [["Git Dark", "#0D1117"], ["Commit Orange", "#F97316"], ["Diff Green", "#22C55E"], ["Diff Red", "#EF4444"]],
        facts: { Archetype: "Git History Decompiler", ExecutionModel: "Git Bare Repo + Test Suite", AgentRole: "Codebase Archeologist", Effort: "M", Needs: "Curated commit indexes" },
        render: () => `
          <div class="scr git-archeology">
            ${K.winBar("Git Archeology — Repository: vllm-project/vllm", "Time-Machine", "Commit 3 of 12: 'Initial PagedAttention implementation'")}
            <div class="app-body">
              <aside class="sidebar" style="width:300px;">
                <div class="sb-section-title">vLLM Historic Milestone Commits</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> <b>c1</b>: Baseline Autoregressive (v0.0.1)</div>
                <div class="sb-item"><span class="app-icon" style="color:var(--accent-green);">${I("check", 12)}</span> <b>c2</b>: Static KV Cache Matrix</div>
                <div class="sb-item active"><span class="app-icon" style="color:var(--accent-amber);">${I("git", 12)}</span> <b>c3</b>: feat: Add PagedAttention (v0.1.0)</div>
                <div class="sb-item"><span class="app-icon">${I("git", 12)}</span> <b>c4</b>: feat: Continuous batching engine</div>
                <div class="sb-item"><span class="app-icon">${I("git", 12)}</span> <b>c5</b>: perf: Custom CUDA kernel binding</div>
                <div class="sb-item"><span class="app-icon">${I("git", 12)}</span> <b>c6</b>: feat: Ray distributed executor</div>
                <div class="sb-item"><span class="app-icon">${I("git", 12)}</span> <b>c7</b>: feat: Speculative decoding draft</div>
              </aside>
              <div style="flex:1;background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
                <div style="background:var(--bg-secondary);padding:10px 14px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <b>Commit PR #14: Initial PagedAttention Core</b>
                    <small style="color:var(--text-muted);display:block;">Author: Woosuk Kwon · 4 files changed, +142 -18 lines</small>
                  </div>
                  <button style="background:var(--accent-green);color:#fff;border:0;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;">
                    Run Historic Tests
                  </button>
                </div>
                <div style="flex:1;padding:14px;font-family:var(--font-mono);font-size:11px;overflow-y:auto;line-height:1.6;">
                  <div style="color:var(--text-dim);margin-bottom:8px;">--- a/vllm/core/block_manager.py<br>+++ b/vllm/core/block_manager.py</div>
                  <div style="background:rgba(239,68,68,0.1);color:#FCA5A5;padding:2px 6px;">- def allocate_kv(self, seq_len): return torch.zeros(seq_len, num_heads, head_dim)</div>
                  <div style="background:rgba(34,197,94,0.1);color:#86EFAC;padding:2px 6px;">+ def allocate_paged_kv(self, seq_len):</div>
                  <div style="background:rgba(34,197,94,0.1);color:#86EFAC;padding:2px 6px;">+ &nbsp;&nbsp;&nbsp;&nbsp;num_blocks = (seq_len + self.block_size - 1) // self.block_size</div>
                  <div style="background:rgba(34,197,94,0.1);color:#86EFAC;padding:2px 6px;">+ &nbsp;&nbsp;&nbsp;&nbsp;return [self.free_list.pop() for _ in range(num_blocks)]</div>
                  <div style="padding:2px 6px;color:var(--text-muted);">&nbsp;&nbsp;def free_sequence(self, seq_id):</div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 14: Synthetic Staff Review Board
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "staff-agent-board",
        n: 14,
        group: "dojos",
        name: "Synthetic Staff Review Board",
        tagline: "Virtual engineering org: Staff Infra Architect, Perf Reviewer, and SRE Lead review your PRs",
        concept: "Learning systems engineering requires rigorous design critiques. When you submit your PyTorch architecture code, you don't just get a green checkmark—three specialized AI personas review your PR: the Staff Infra Architect (critiques scaling & memory leaks), the Senior CUDA Engineer (spots unnecessary CPU-GPU copies), and the SRE Lead (checks failovers).",
        moves: [
          "Multi-agent code review: 3 distinct technical personas evaluate your PR",
          "Line-by-line GitHub-style inline review comments with actionable alternatives",
          "Interactive defense: explain your architectural trade-offs to the Staff Architect",
          "RFC proposal mode: write design specs before writing code"
        ],
        palette: [["PR Slate", "#0E121A"], ["Staff Purple", "#8B5CF6"], ["Perf Blue", "#0284C7"], ["SRE Amber", "#D97706"]],
        facts: { Archetype: "Multi-Agent Review Board", ExecutionModel: "Multi-Persona LLM Pipeline", AgentRole: "Staff Engineering Reviewers", Effort: "M", Needs: "Review prompt personas" },
        render: () => `
          <div class="scr staff-agent-board">
            ${K.winBar("Synthetic Staff Review Board — PR #18: Radix Prefix Cache", "Code Review", "2 Changes Requested · 1 Approval")}
            <div class="app-body">
              <div style="flex:1;background:var(--bg-primary);padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;">
                <div style="border-bottom:1px solid var(--border-color);padding-bottom:10px;">
                  <h2 style="font-size:16px;font-weight:800;margin:0 0 4px;">PR #18: Implement Radix Prefix Cache with LRU Eviction</h2>
                  <small style="color:var(--text-muted);">Branch: <code>feature/radix-cache</code> -> <code>main</code> · 3 Reviewers Assigned</small>
                </div>

                <!-- Reviewer 1: Staff Architect -->
                <div style="background:var(--bg-secondary);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:12px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="width:20px;height:20px;border-radius:50%;background:#8B5CF6;display:inline-block;"></span>
                    <b>Staff Infra Architect (Alex Chen)</b>
                    <span class="badge mode" style="background:rgba(239,68,68,0.2);color:#EF4444;">Changes Requested</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-main);line-height:1.5;">
                    "You are using Python's native <code>dict</code> inside the tree traversal loop. In high-concurrency serving (1,000+ RPS), Python GIL contention will become your primary latency bottleneck. How do you plan to push this lookup into C++ or a lock-free trie?"
                  </div>
                </div>

                <!-- Reviewer 2: CUDA Performance Engineer -->
                <div style="background:var(--bg-secondary);border:1px solid rgba(2,132,199,0.3);border-radius:8px;padding:12px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="width:20px;height:20px;border-radius:50%;background:#0284C7;display:inline-block;"></span>
                    <b>Senior CUDA Engineer (Elena Rostova)</b>
                    <span class="badge mode" style="background:rgba(239,68,68,0.2);color:#EF4444;">Inline Comment</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-main);line-height:1.5;">
                    <b>Line 42:</b> <code>block_table = torch.tensor(matched_blocks)</code><br>
                    "Warning: This creates a host-to-device memory copy on every token step! Allocate a pinned buffer upfront and copy via asynchronous stream."
                  </div>
                </div>

                <!-- Reviewer 3: SRE Lead -->
                <div style="background:var(--bg-secondary);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <span style="width:20px;height:20px;border-radius:50%;background:#10B981;display:inline-block;"></span>
                    <b>Production SRE Lead (Marcus Vance)</b>
                    <span class="badge mode" style="background:rgba(16,185,129,0.2);color:#10B981;">Approved</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-main);line-height:1.5;">
                    "LRU eviction logic gracefully falls back to empty cache during memory pressure without throwing unhandled exceptions. Approved from an availability standpoint."
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 15: Ambient Menubar & Lockscreen Drills
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "ambient-micro-drills",
        n: 15,
        group: "dojos",
        name: "Ambient Menubar Micro-Drills",
        tagline: "Low-friction daily habit: 10-minute deep systems puzzles in your macOS menubar",
        concept: "Deep systems learning doesn't always require 4-hour uninterrupted blocks. This candidate lives in your macOS menubar or lockscreen. Every morning it presents 1 bite-sized, high-yield systems puzzle: calculate KV cache size for a 70B model with 32k context, spot the memory leak in a PyTorch loop, or trace a distributed ring all-reduce.",
        moves: [
          "Zero cognitive friction: accessible directly from macOS menubar item",
          "5 to 10 minute daily exercises built for retention and spaced repetition",
          "Mental model sketches: quick tap-to-solve diagramming widgets",
          "Progressive streak tracker that unlocks harder systems topics over time"
        ],
        palette: [["Menubar Dark", "#14161C"], ["Accent Orange", "#FB923C"], ["Pill Gray", "#262B36"]],
        facts: { Archetype: "Menubar Companion", ExecutionModel: "Lightweight Native Widget", AgentRole: "Daily Drill Generator", Effort: "S", Needs: "Tauri / Electron menubar wrapper" },
        render: () => `
          <div class="scr ambient-micro-drills">
            ${K.winBar("macOS Menubar — Heji Daily Systems Drill", "Menubar Widget", "Today: Day 18 Streak · 5 mins")}
            <div class="app-body" style="background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
              <!-- Floating Menubar Popover Card -->
              <div style="width:440px;background:var(--bg-secondary);border:1px solid var(--border-strong);border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.6);padding:18px;display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-weight:800;font-size:14px;display:flex;align-items:center;gap:6px;">
                    <span style="color:#FB923C;">${I("flame", 16)}</span> Daily Drill #18: Memory Math
                  </div>
                  <span class="sb-badge" style="background:rgba(251,146,60,0.15);color:#FB923C;">+50 XP</span>
                </div>

                <div style="font-size:12px;color:var(--text-main);line-height:1.5;">
                  <b>Question:</b> You are serving a Llama-3-70B model with GQA (Grouped Query Attention: 64 Q heads, 8 KV heads, head dim 128). What is the exact uncompressed KV cache size for a single request with <b>16,384 tokens</b> at FP16 precision?
                </div>

                <div style="background:var(--bg-surface);padding:10px;border-radius:6px;font-family:var(--font-mono);font-size:11px;">
                  Formula: 2 * num_layers * kv_heads * head_dim * seq_len * 2 bytes<br>
                  Layers = 80 | KV Heads = 8 | Dim = 128 | Len = 16,384
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <button style="background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-main);border-radius:6px;padding:8px;font-size:11px;cursor:pointer;">
                    A. 2.68 GB
                  </button>
                  <button style="background:rgba(16,185,129,0.15);border:1px solid #10B981;color:#10B981;border-radius:6px;padding:8px;font-size:11px;font-weight:700;cursor:pointer;">
                    B. 5.37 GB (Correct!)
                  </button>
                  <button style="background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-main);border-radius:6px;padding:8px;font-size:11px;cursor:pointer;">
                    C. 10.74 GB
                  </button>
                  <button style="background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-main);border-radius:6px;padding:8px;font-size:11px;cursor:pointer;">
                    D. 42.95 GB
                  </button>
                </div>

                <div style="font-size:10px;color:var(--text-dim);display:flex;justify-content:space-between;border-top:1px solid var(--border-color);padding-top:8px;">
                  <span>Tomorrow: CUDA Warp Divergence</span>
                  <a href="#" style="color:var(--accent-cyan);text-decoration:none;">Open Full Studio -></a>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // GROUP 4: Cross-Domain Synthesis & Knowledge Graphs
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "mastery-rpg",
        n: 16,
        group: "cross-domain",
        name: "Systems Mastery Tech-Tree RPG",
        tagline: "Civilization-style dependency skill graph with coding quests and cross-domain branches",
        concept: "Transform your learning journey into an expansive, non-linear RPG tech tree. Concepts have explicit prerequisites (e.g. 'CUDA Memory Hierarchy' -> 'Triton Tiling' -> 'PagedAttention' -> 'Chunked Prefill'). As your interests expand into drastically different domains (Robotics, High-Frequency Trading, Compilers), new branches seamlessly unlock from the same core foundation.",
        moves: [
          "Interactive tech tree with fog-of-war for undiscovered advanced topics",
          "Explicit prerequisite edges prevent jumping into topics without foundational mastery",
          "Modular domain packs: plug in 'Autonomous Drone Control' or 'Compiler Optimization'",
          "Quests require code submissions, architecture drawings, and verifiable tests"
        ],
        palette: [["RPG Night", "#090B10"], ["Tree Gold", "#EAB308"], ["Branch Violet", "#8B5CF6"], ["Node Dark", "#161B26"]],
        facts: { Archetype: "Tech-Tree Skill Graph", ExecutionModel: "Dependency Engine", AgentRole: "Quest Master & Grader", Effort: "M", Needs: "DAG graph renderer" },
        render: () => `
          <div class="scr mastery-rpg">
            ${K.winBar("Systems Mastery RPG — Skill Tree & Quest Log", "Tech-Tree", "Level 14 Systems Architect · 4,250 XP")}
            <div class="app-body">
              <div class="canvas-wrap" style="background:#090B10;">
                <div style="position:absolute;top:14px;left:14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:8px 14px;display:flex;gap:12px;font-size:11px;">
                  <span>Domain: <b>High-Performance LLM Systems</b></span>
                  <span style="color:var(--accent-amber);">3 Branches Unlocked</span>
                  <span style="color:var(--text-dim);">+ Add New Domain (e.g. Robotics)</span>
                </div>

                <!-- Skill Node 1: CUDA Foundations (Unlocked & Mastered) -->
                <div class="canvas-node" style="top:90px;left:40px;width:180px;border-color:#10B981;">
                  <div class="node-header" style="background:rgba(16,185,129,0.15);color:#10B981;">
                    <span>CUDA Hierarchy</span><span>[DONE]</span>
                  </div>
                  <div class="node-body">
                    <p>Warps, Shared SRAM, Global HBM</p>
                    <small style="color:var(--accent-green);">Mastered 100%</small>
                  </div>
                </div>

                <!-- Skill Node 2: Triton Kernel Tiling -->
                <div class="canvas-node" style="top:90px;left:300px;width:180px;border-color:#10B981;">
                  <div class="node-header" style="background:rgba(16,185,129,0.15);color:#10B981;">
                    <span>Triton Tiling</span><span>[DONE]</span>
                  </div>
                  <div class="node-body">
                    <p>Block pointers & fused ops</p>
                    <small style="color:var(--accent-green);">Mastered 100%</small>
                  </div>
                </div>

                <!-- Skill Node 3: PagedAttention (Active Quest) -->
                <div class="canvas-node" style="top:90px;left:560px;width:220px;border-color:var(--accent-amber);box-shadow:0 0 15px rgba(234,179,8,0.2);">
                  <div class="node-header" style="background:rgba(234,179,8,0.2);color:var(--accent-amber);">
                    <span>PagedAttention</span><span>ACTIVE</span>
                  </div>
                  <div class="node-body">
                    <p><b>Quest:</b> Implement Block Table allocation without fragmentation</p>
                    <div style="height:6px;background:var(--bg-surface);border-radius:3px;overflow:hidden;margin:6px 0;">
                      <div style="width:70%;height:100%;background:var(--accent-amber);"></div>
                    </div>
                    <small style="color:var(--accent-amber);">70% Progress · 1 test left</small>
                  </div>
                </div>

                <!-- Skill Node 4: SGLang Radix Cache (Locked Branch) -->
                <div class="canvas-node" style="top:90px;left:860px;width:180px;opacity:0.6;border-style:dashed;">
                  <div class="node-header"><span>Radix Tree Cache</span><span>LOCKED</span></div>
                  <div class="node-body">
                    <p>Requires PagedAttention</p>
                    <small style="color:var(--text-dim);">Unlocks at Level 15</small>
                  </div>
                </div>

                <!-- Branch Downwards to Cross Domain: Robotics Spatial Octree -->
                <div class="canvas-node" style="top:260px;left:560px;width:220px;border-color:var(--accent-purple);">
                  <div class="node-header" style="background:rgba(168,85,247,0.2);color:var(--accent-purple);">
                    <span>Robotics: 3D Voxel Octree</span><span>CROSS-DOMAIN</span>
                  </div>
                  <div class="node-body">
                    <p>Reuses memory paging concepts in autonomous drone 3D maps</p>
                    <small style="color:var(--accent-purple);">Isomorphic to PagedAttention</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 17: Cross-Domain Concept Weaver
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "domain-cartographer",
        n: 17,
        group: "cross-domain",
        name: "Cross-Domain Concept Weaver",
        tagline: "Cognitive bridge builder mapping isomorphic mental models across divergent disciplines",
        concept: "The fastest way to learn any new domain is recognizing what you already know in disguise. This tool bridges concepts: Operating System Virtual Memory Paging <-> LLM PagedAttention; Database Query Optimizers <-> SGLang Radix Execution Planner; Game Networking Lag Compensation <-> Speculative Decoding. Compares architectures side-by-side.",
        moves: [
          "Side-by-side isomorphic concept comparison (OS, Databases, Gaming, AI)",
          "Highlights shared mathematical invariants across disparate fields",
          "Cross-domain project generator: build a database optimizer using LLM execution principles",
          "AI analogy explainer grounded in deep systems mechanics"
        ],
        palette: [["Cartography Slate", "#0E131F"], ["Bridge Violet", "#8B5CF6"], ["Analogy Amber", "#F59E0B"], ["Border Gray", "#26324B"]],
        facts: { Archetype: "Cross-Domain Cartographer", ExecutionModel: "Analogy Engine", AgentRole: "Interdisciplinary Polymath", Effort: "M", Needs: "Concept relationship DB" },
        render: () => `
          <div class="scr domain-cartographer">
            ${K.winBar("Cross-Domain Concept Weaver — Isomorphic Systems Explorer", "Weaver", "Domain Mapping: OS Virtual Memory <-> LLM PagedAttention")}
            <div class="app-body" style="background:var(--bg-primary);padding:16px;display:flex;flex-direction:column;gap:12px;">
              <div style="border-bottom:1px solid var(--border-color);padding-bottom:8px;">
                <h2 style="font-size:16px;font-weight:800;margin:0 0 2px;">Isomorphic Systems Principle: Virtual Memory & Page Tables</h2>
                <small style="color:var(--text-muted);">How a 1960s operating systems concept revolutionised 2023 LLM inference serving</small>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:1;">
                <!-- Column 1: Classic Operating Systems -->
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:14px;display:flex;flex-direction:column;">
                  <div style="font-weight:700;font-size:13px;color:var(--accent-amber);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                    ${I("cpu", 14)} Domain A: Operating Systems (Virtual Memory)
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:12px;">
                    <b>Problem:</b> Programs demand large contiguous virtual address spaces, but physical DRAM is fragmented and finite.<br><br>
                    <b>Solution:</b> MMU maps 4KB virtual pages to arbitrary physical page frames via a multi-level Page Table. Non-contiguous in RAM, contiguous to the program.
                  </div>
                  <div style="background:var(--bg-surface);padding:8px;border-radius:6px;font-family:var(--font-mono);font-size:10px;">
                    Virtual Address [Page # | Offset]<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;↓ (MMU Translation)<br>
                    Physical RAM [Frame # | Offset]
                  </div>
                </div>

                <!-- Column 2: LLM Inference Engines -->
                <div style="background:var(--bg-secondary);border:1px solid var(--accent-purple);border-radius:8px;padding:14px;display:flex;flex-direction:column;">
                  <div style="font-weight:700;font-size:13px;color:var(--accent-purple);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                    ${I("sparkles", 14)} Domain B: vLLM & SGLang (PagedAttention)
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:12px;">
                    <b>Problem:</b> LLM requests need dynamic KV caches up to 32k tokens, but reserving contiguous HBM wastes 60-80% memory.<br><br>
                    <b>Solution:</b> Block Manager maps logical token indices to 16-token physical HBM blocks. Gathered non-contiguously by custom CUDA attention kernel.
                  </div>
                  <div style="background:var(--bg-surface);padding:8px;border-radius:6px;font-family:var(--font-mono);font-size:10px;">
                    Logical Token Index [Block # | Offset]<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;↓ (vLLM Block Table Translation)<br>
                    Physical HBM [Block ID # | Offset]
                  </div>
                </div>
              </div>

              <div style="background:rgba(139,92,246,0.1);border:1px solid var(--accent-purple);border-radius:8px;padding:10px;font-size:11px;display:flex;align-items:center;justify-content:space-between;">
                <span><b>Synthesized Practice Project:</b> Build a unified allocator that implements both OS 4KB paging and LLM 16-token block paging with a shared interface.</span>
                <button style="background:var(--accent-purple);color:#fff;border:0;border-radius:4px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;">Start Project</button>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 18: Research-Paper-to-Code Compiler
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "paper-to-practice",
        n: 18,
        group: "cross-domain",
        name: "Paper-to-Practice Compiler",
        tagline: "Drop an ArXiv PDF (DeepSeek-R1, FlashAttention-3) -> auto-synthesizes a 7-day executable PyTorch lab",
        concept: "The latest breakthrough in any domain starts with an ArXiv paper. Drop any PDF or URL (e.g. DeepSeek-V3 post-training paper, SGLang, or FlashAttention-3). The local agent parses the paper, extracts core mathematical equations and algorithm boxes, synthesizes executable PyTorch skeleton files, generates unit tests, and builds an interactive 7-day practice plan.",
        moves: [
          "PDF ingestion: extracts Algorithm 1 & 2 pseudo-code and tensor math directly",
          "Synthesizes executable PyTorch boilerplate with `TODO` exercise blocks",
          "Generates verified test assertions to guarantee your code implements the paper",
          "Extensible to any discipline: quantum computing, quant finance, robotics"
        ],
        palette: [["Paper Dark", "#0B0E14"], ["ArXiv Coral", "#E11D48"], ["Latex White", "#F1F5F9"], ["Math Blue", "#38BDF8"]],
        facts: { Archetype: "Paper Ingestion Compiler", ExecutionModel: "LLM PDF Parser & Synthesizer", AgentRole: "Curriculum Compiler", Effort: "L", Needs: "ArXiv ingestion parser" },
        render: () => `
          <div class="scr paper-to-practice">
            ${K.winBar("Paper-to-Practice Compiler — ArXiv:2501.12948", "Compiler", "Paper Parsed: DeepSeek-R1 Post-Training")}
            <div class="app-body">
              <aside class="sidebar" style="width:320px;">
                <div class="sb-section-title">Synthesized 7-Day Lab</div>
                <div class="sb-item active"><span class="app-icon" style="color:#E11D48;">${I("book", 12)}</span> Day 1: GRPO Objective & Advantage Math</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> Day 2: Rule-Based Reward Verification</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> Day 3: Multi-turn Rollout Buffer</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> Day 4: KL Penalty & Reference Policy</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> Day 5: Cold-Start SFT Distillation</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> Day 6: Ray Distributed Rollout Pool</div>
                <div class="sb-item"><span class="app-icon">${I("code", 12)}</span> Day 7: End-to-End AIME Benchmark</div>
              </aside>
              <div style="flex:1;background:var(--bg-primary);display:flex;flex-direction:column;overflow:hidden;">
                <div style="background:var(--bg-secondary);padding:10px 14px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <b>Extracted: Equation (3) — Group Relative Advantage</b>
                    <small style="color:var(--text-muted);display:block;">DeepSeekMath / R1 Section 2.2: Group Normalization</small>
                  </div>
                  <span class="badge mode" style="background:rgba(225,29,72,0.15);color:#E11D48;">Auto-Generated Stubs</span>
                </div>
                <div class="code-editor">
                  <div class="code-scroll">
                    <div style="background:var(--bg-surface);padding:8px 12px;border-radius:6px;margin-bottom:12px;font-family:var(--font-mono);font-size:11px;color:var(--accent-cyan);">
                      LaTeX: A_i = (r_i - mean(r_1..r_G)) / (std(r_1..r_G) + eps)
                    </div>
                    <div class="code-line"><span class="ln">1</span><span class="txt"><span class="kw">def</span> <span class="fn">compute_group_advantages</span>(rewards: torch.Tensor, eps: <span class="type">float</span> = <span class="num">1e-6</span>):</span></div>
                    <div class="code-line"><span class="ln">2</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="str">"""Synthesized from DeepSeek-R1 Equation 3."""</span></span></div>
                    <div class="code-line"><span class="ln">3</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># TODO (User Exercise): Implement group-wise normalization across dim=-1</span></span></div>
                    <div class="code-line"><span class="ln">4</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;mean = rewards.mean(dim=-<span class="num">1</span>, keepdim=<span class="type">True</span>)</span></div>
                    <div class="code-line"><span class="ln">5</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;std = rewards.std(dim=-<span class="num">1</span>, keepdim=<span class="type">True</span>)</span></div>
                    <div class="code-line"><span class="ln">6</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> (rewards - mean) / (std + eps)</span></div>
                  </div>
                  ${K.renderTerminal("pytest tests/test_deepseek_grpo_math.py", [
                    { text: "[PASS] test_group_normalization_zero_std (1.1ms)", type: "pass" },
                    { text: "[PASS] test_advantage_gradient_flow (2.4ms)", type: "pass" },
                    { text: "[READY] Unit tests match paper equations with 1e-5 tolerance.", type: "agent" }
                  ])}
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 19: Architecture Whiteboard Exam Studio
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "system-design-whiteboard",
        n: 19,
        group: "cross-domain",
        name: "Architecture Whiteboard Exam Studio",
        tagline: "Hand-drawn shape diagram parser that compiles directly into a PyTorch communications simulator",
        concept: "The missing link between high-level system design and low-level code. You draw your distributed system architecture on a digital canvas using boxes, arrows, and labels (e.g. 'GPU Rack', 'Token Queue', 'Ray Worker'). An integrated computer vision / shape parser parses your sketch, compiles it into executable PyTorch code, and runs a network latency simulation.",
        moves: [
          "Hand-drawn shape recognition: turns rough sketch rectangles into compute actors",
          "Compiles architecture diagrams into distributed PyTorch execution scripts",
          "Calculates end-to-end latency: predicts network hops and serialization costs",
          "Ideal for mock system design interviews and validating real production specs"
        ],
        palette: [["Whiteboard Dark", "#11141C"], ["Chalk Cyan", "#06B6D4"], ["Pen Orange", "#F97316"], ["Grid Slate", "#1E2433"]],
        facts: { Archetype: "Whiteboard-to-Code Studio", ExecutionModel: "CV Parser + PyTorch Comms Sim", AgentRole: "Architecture Interviewer", Effort: "L", Needs: "Diagram parser" },
        render: () => `
          <div class="scr system-design-whiteboard">
            ${K.winBar("Architecture Whiteboard Exam Studio — Distributed System Design", "Whiteboard", "Diagram Parsed -> Compiled to PyTorch Comms Engine")}
            <div class="app-body">
              <div class="canvas-wrap" style="flex:1;">
                <div style="position:absolute;top:14px;left:14px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:8px 12px;font-size:11px;display:flex;gap:12px;">
                  <span>Mode: <b>Hand-Drawn System Design</b></span>
                  <span style="color:var(--accent-green);">${I("check", 12)} Architecture Validated</span>
                  <span style="color:var(--accent-cyan);cursor:pointer;">Compile to PyTorch</span>
                </div>

                <!-- Drawn Box 1: API Gateway -->
                <div style="position:absolute;top:90px;left:50px;width:160px;height:90px;border:2px dashed #06B6D4;border-radius:8px;padding:8px;background:rgba(6,182,212,0.05);">
                  <b style="color:#06B6D4;font-size:11px;">[Client Gateway]</b>
                  <p style="font-size:10px;color:var(--text-muted);margin:4px 0;">Tokenizes & batches incoming requests</p>
                </div>

                <!-- Arrow -->
                <div style="position:absolute;top:130px;left:215px;width:80px;border-top:2px solid #F97316;display:flex;align-items:center;justify-content:center;color:#F97316;font-size:10px;">
                  gRPC
                </div>

                <!-- Drawn Box 2: vLLM Scheduler -->
                <div style="position:absolute;top:90px;left:300px;width:180px;height:90px;border:2px dashed #06B6D4;border-radius:8px;padding:8px;background:rgba(6,182,212,0.05);">
                  <b style="color:#06B6D4;font-size:11px;">[Continuous Scheduler]</b>
                  <p style="font-size:10px;color:var(--text-muted);margin:4px 0;">Radix Cache & Page Allocator</p>
                </div>

                <!-- Arrow -->
                <div style="position:absolute;top:130px;left:485px;width:80px;border-top:2px solid #F97316;display:flex;align-items:center;justify-content:center;color:#F97316;font-size:10px;">
                  Shared Mem
                </div>

                <!-- Drawn Box 3: 8x GPU TP Group -->
                <div style="position:absolute;top:80px;left:570px;width:240px;height:120px;border:2px solid #10B981;border-radius:8px;padding:10px;background:rgba(16,185,129,0.05);">
                  <b style="color:#10B981;font-size:12px;">[TP=8 Engine Workers]</b>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
                    NVLink Ring AllReduce<br>
                    Latency: <b>8.4ms/token</b><br>
                    Peak Memory: <b>42.1 GB / GPU</b>
                  </div>
                </div>

                <!-- Compiled Code Drawer Bottom -->
                <div style="position:absolute;bottom:0;left:0;right:0;height:180px;background:var(--bg-secondary);border-top:1px solid var(--border-color);padding:12px;font-family:var(--font-mono);font-size:10px;overflow-y:auto;">
                  <div style="color:var(--accent-cyan);font-weight:700;margin-bottom:4px;">
                    // Auto-Compiled from Whiteboard Sketch (Verified Tensor Dimensions):
                  </div>
                  <span class="kw">class</span> <span class="type">CompiledDistributedCluster</span>:<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">__init__</span>(<span class="type">self</span>):<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.gateway = ClientGateway(batch_size=<span class="num">64</span>)<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.scheduler = RadixBlockScheduler(total_hbm=<span class="num">80_000_000_000</span>)<br>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="type">self</span>.tp_workers = [Worker(rank=i, tp_world=<span class="num">8</span>) <span class="kw">for</span> i <span class="kw">in</span> range(<span class="num">8</span>)]
                </div>
              </div>
            </div>
          </div>
        `
      },

      // ───────────────────────────────────────────────────────────────────────
      // 20: Interactive Code-Cast Studio
      // ───────────────────────────────────────────────────────────────────────
      {
        id: "interactive-codecast",
        n: 20,
        group: "cross-domain",
        name: "Interactive Code-Cast Studio",
        tagline: "Dynamic AI video/audio narration that drives live code execution and canvas overlays",
        concept: "A media-rich, immersive studio where expert AI narration guides you through complex topics. As the audio/visual narrator explains vLLM's memory management or GRPO advantage normalization, it programmatically highlights code lines in your editor, draws diagrams on an overlay whiteboard in sync with the speech, and pauses for you to code the missing kernel.",
        moves: [
          "Synchronized interactive walkthrough: audio/video timeline directly drives the code editor",
          "Whiteboard vector overlay: diagrams animate and draw themselves in sync with narration",
          "Interactive pauses: the narrator pauses and waits for your test to pass before continuing",
          "Jump to any concept: scrubbing the video scrubs code diffs and memory states"
        ],
        palette: [["Studio Obsidian", "#0A0C10"], ["Play Amber", "#F59E0B"], ["Sync Cyan", "#06B6D4"], ["Player Dark", "#161922"]],
        facts: { Archetype: "Interactive Media Studio", ExecutionModel: "Timeline Sync Engine", AgentRole: "Interactive Narrator & Guide", Effort: "L", Needs: "Media timeline sync" },
        render: () => `
          <div class="scr interactive-codecast">
            ${K.winBar("Interactive Code-Cast Studio — Episode 04: PagedAttention Internals", "Code-Cast", "Playing · Timestamp 04:22 / 18:30")}
            <div class="app-body">
              <div style="flex:1;background:var(--bg-primary);display:flex;flex-direction:column;">
                <!-- Video / Whiteboard Animation Header -->
                <div style="height:260px;background:#05070A;border-bottom:1px solid var(--border-color);position:relative;display:flex;align-items:center;justify-content:center;">
                  <div style="position:absolute;top:10px;left:14px;display:flex;align-items:center;gap:8px;font-size:11px;">
                    <span style="width:8px;height:8px;border-radius:50%;background:#EF4444;"></span>
                    <b>AI Narrator:</b> "Notice how Block #3 is shared across both prompt branches..."
                  </div>
                  <!-- Animated Visual Diagram synced to voice -->
                  <div style="border:1px solid var(--accent-cyan);border-radius:8px;padding:16px;background:rgba(6,182,212,0.05);text-align:center;">
                    <div style="font-size:13px;font-weight:700;color:var(--accent-cyan);margin-bottom:8px;">
                      [Live Vector Overlay: Pointer Mapping]
                    </div>
                    ${K.renderMemoryGrid(14, 8, 4)}
                  </div>
                  <!-- Timeline Scrub Bar -->
                  <div style="position:absolute;bottom:0;left:0;right:0;height:30px;background:var(--bg-secondary);display:flex;align-items:center;padding:0 14px;gap:12px;font-size:11px;">
                    <button style="background:var(--accent-amber);border:0;color:#000;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;">${I("play", 10)}</button>
                    <span style="font-family:var(--font-mono);font-size:10px;">04:22 / 18:30</span>
                    <div style="flex:1;height:4px;background:var(--bg-surface);border-radius:2px;overflow:hidden;">
                      <div style="width:25%;height:100%;background:var(--accent-amber);"></div>
                    </div>
                    <span style="color:var(--accent-cyan);">Marker: Your Practice Turn (Paused)</span>
                  </div>
                </div>

                <!-- Code Editor Synchronized with Narrator -->
                <div class="code-editor" style="flex:1;">
                  <div class="editor-tabs">
                    <div class="editor-tab active">radix_tree.py</div>
                    <div class="editor-tab">tests/test_radix.py</div>
                  </div>
                  <div class="code-scroll">
                    <div style="background:rgba(245,158,11,0.1);padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:11px;color:var(--accent-amber);">
                      <b>Narrator Challenge:</b> Complete line 5 below to calculate the shared prefix length.
                    </div>
                    <div class="code-line"><span class="ln">1</span><span class="txt"><span class="kw">def</span> <span class="fn">traverse_prefix</span>(node, token_stream):</span></div>
                    <div class="code-line"><span class="ln">2</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;matched_blocks = []</span></div>
                    <div class="code-line"><span class="ln">3</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">for</span> token <span class="kw">in</span> token_stream:</span></div>
                    <div class="code-line"><span class="ln">4</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="com"># [Narrator highlighted this block in sync with speech]</span></span></div>
                    <div class="code-line"><span class="ln">5</span><span class="txt">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> token <span class="kw">in</span> node.children: matched_blocks.append(node.children[token].block_id)</span></div>
                  </div>
                  ${K.renderTerminal("pytest tests/test_radix.py", [
                    { text: "[PASS] 12 unit tests passed. Audio resuming in 3s...", type: "pass" }
                  ])}
                </div>
              </div>
            </div>
          </div>
        `
      }
    ]
  };
})();
