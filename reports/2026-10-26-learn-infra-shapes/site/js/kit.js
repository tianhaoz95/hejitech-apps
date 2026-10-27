// Shared building blocks for candidate review mocks: sample data, icons, UI components.
window.KIT = window.KIT || {};

(() => {
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    diagram: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6M9 6h6a3 3 0 0 1 3 3v6"/>',
    agent: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    git: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M18 9a9 9 0 0 0-9 9"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  };

  KIT.icon = (name, size = 16, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

  // ── Realistic mock data for the user's explicit domains
  KIT.modules = {
    vllm: {
      name: "vLLM & SGLang Inference Internals",
      activeTopic: "PagedAttention & Radix Tree Prefix Cache",
      progress: 68,
      stats: { tests: "14/16 passed", memorySaved: "4.2x", latency: "14.2ms/token" },
      activeFile: "radix_cache.py",
      codeSnippet: `class RadixPrefixCache:
    def __init__(self, page_size: int = 16):
        self.root = RadixNode(token_ids=[])
        self.page_size = page_size
        self.block_table = BlockAllocator(num_blocks=2048)

    def match_prefix(self, prompt_tokens: torch.Tensor) -> Tuple[List[int], int]:
        """Traverse radix tree to find longest reusable KV cache block prefix."""
        curr = self.root
        matched_blocks = []
        offset = 0
        while curr and offset < len(prompt_tokens):
            match = curr.find_child(prompt_tokens[offset:])
            if not match:
                break
            matched_blocks.extend(match.allocated_block_ids)
            offset += len(match.token_ids)
            curr = match
        return matched_blocks, offset`,
      testsOutput: `[PASS] test_radix_insert_single_prompt (1.2ms)
[PASS] test_paged_attention_kernel_forward (3.8ms)
[PASS] test_prefix_sharing_divergent_prompts (2.4ms)
[FAIL] test_lru_block_eviction_under_oom: Block ID #42 evicted before pinned ref count dropped to 0!`,
    },
    postTraining: {
      name: "LLM Post-Training Infra: Zero-to-Hero",
      activeTopic: "GRPO Distributed Rollout & Advantage Calculation",
      progress: 45,
      stats: { gpus: "8x H100 (80GB)", throughput: "48.2k tok/s", kl: "0.038" },
      activeFile: "grpo_trainer.py",
      codeSnippet: `@ray.remote(num_gpus=1)
class GRPORolloutWorker:
    def sample_group(self, prompts: List[str], group_size: int = 8):
        # Sample G answers per prompt for group relative reward normalisation
        with torch.no_grad():
            outputs = self.engine.generate(prompts, n=group_size, temperature=0.7)
        rewards = self.reward_evaluator(outputs)
        advantages = (rewards - rewards.mean(dim=-1, keepdim=True)) / (rewards.std(dim=-1, keepdim=True) + 1e-6)
        return outputs, advantages`,
    },
    crossDomain: {
      name: "Autonomous Spatial Navigation",
      activeTopic: "Sparse Voxel Octree GPU Raymarching",
      progress: 20,
      analogy: "Identical to PagedAttention: 3D spatial chunks dynamically paged into VRAM on camera frustum demand.",
    }
  };

  // ── Render Top Window Bar
  KIT.winBar = (title, mode = "editor", extra = "") => `
    <div class="top-bar">
      <div class="win-controls">
        <span class="btn red"></span>
        <span class="btn yellow"></span>
        <span class="btn green"></span>
      </div>
      <div class="win-title">
        <span class="app-icon">${KIT.icon("cpu", 14)}</span>
        <b>${title}</b>
        <span class="badge mode">${mode}</span>
      </div>
      <div class="win-extra">${extra}</div>
    </div>
  `;

  // ── Memory Visualizer Component (used across several candidates)
  KIT.renderMemoryGrid = (allocated = 18, shared = 8, free = 6) => {
    let cells = "";
    for (let i = 0; i < allocated; i++) {
      cells += `<div class="mem-block alloc" title="Allocated Block #${i}"><span>B${i}</span></div>`;
    }
    for (let i = 0; i < shared; i++) {
      cells += `<div class="mem-block shared" title="Radix Shared Prefix #${i}"><span>P${i}</span></div>`;
    }
    for (let i = 0; i < free; i++) {
      cells += `<div class="mem-block free" title="Free Physical Block #${i}"><span>${i}</span></div>`;
    }
    return `
      <div class="mem-visualizer">
        <div class="mem-header">
          <span><b>GPU HBM3 Memory Map</b> (PagedAttention Block Size = 16 tokens)</span>
          <div class="mem-legend">
            <span class="leg-item"><i class="sq alloc"></i> In-Use</span>
            <span class="leg-item"><i class="sq shared"></i> Prefix Shared</span>
            <span class="leg-item"><i class="sq free"></i> Free</span>
          </div>
        </div>
        <div class="mem-grid">${cells}</div>
      </div>
    `;
  };

  // ── Terminal / Agent Output Runner
  KIT.renderTerminal = (command, lines, status = "active") => `
    <div class="term-box">
      <div class="term-bar">
        <span class="term-dot"></span>
        <span>Local Execution Agent & Sandbox · python3.11</span>
        <span class="term-status ${status}">${status.toUpperCase()}</span>
      </div>
      <div class="term-body">
        <div class="term-prompt"><span class="user">heji@local-h100</span>:<span class="dir">~/infra-lab</span>$ ${command}</div>
        <div class="term-logs">${lines.map(l => `<div class="log-line ${l.type || ""}">${l.text}</div>`).join("")}</div>
      </div>
    </div>
  `;
})();
