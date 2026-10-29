# 20 Product Shapes: AI Systems & Cross-Domain Learning Platform

Review site for brainstorming and evaluating 20 distinct product shapes for a new learning and practice platform.

## Context & Objectives
- **Target Domains**:
  1. Deep inference engines: PyTorch, TensorRT-LLM, SGLang, and vLLM (PagedAttention, Radix tree caching, continuous batching, chunked prefill).
  2. Post-training infra from zero to hero: GRPO (DeepSeek-R1 style), PPO, DPO, 3D parallelism (Megatron-LM / FSDP), Ray distributed workers.
  3. Extensibility to drastically divergent disciplines: Autonomous robotics, quant finance, compilers.
  4. Active practice: Local AI agent execution (CLI / desktop daemon), diagramming & architecture whiteboard, hardware profiling.

## Review Site
- **Path**: `reports/archive/2026-10-26-learn-infra-shapes`
- **Serve script**: `reports/archive/2026-10-26-learn-infra-shapes/script/serve.sh` (port 8815)
- **URL**: `http://localhost:8815/`

## Candidate Summary by Group

### 0. The Unified Synthesis (Your Combo)
- **21 · [HEJI Polymath OS (The Unified Platform)](site/js/candidates.js#L88)** (`polymath-os`): Fuses all 20 directions into a coherent learning OS with 4 workspace modes (Map, Studio, Whiteboard, Dojo) plus ambient companions (macOS Menubar + VS Code LSP).

### 1. Studio & Spatial Canvas Workbenches
- **01 · Systems CAD Studio (`systems-studio`)**: Professional IDE workbench with live tensor shape inlay hints, animated GPU HBM3 page tables, and local AI agent test runner.
- **02 · Spatial Dataflow Whiteboard (`infinite-canvas`)**: Infinite zoomable whiteboard linking visual architecture nodes directly to computable PyTorch code with wire dimension checking.
- **03 · Reactive Systems Notebook (`reactive-notebook`)**: Observable/Marimo-style computable documents with reactive hardware sliders (batch size, context length).
- **04 · Ambient Socratic Sidecar (`dockable-sidecar`)**: Floating desktop dock that attaches to native Cursor/VS Code via LSP and pops Socratic architecture challenges.
- **05 · Unified Omniverse Cockpit (`unified-omniverse`)**: 4-quadrant cockpit uniting Architecture Canvas, Code Editor, GPU Profiler, and Agent Shell.

### 2. Simulation, Emulation & Profiling Labs
- **06 · Virtual 8xH100 Cluster Deck (`cluster-emulator`)**: 8-GPU distributed cluster simulator with simulated NVLink/InfiniBand topologies and NCCL all-reduce visuals.
- **07 · Roofline & Kernel Lab (`roofline-lab`)**: Performance-first profiler plotting arithmetic intensity vs bandwidth against the H100 3.35 TB/s ceiling.
- **08 · PagedAttention Memory Arena (`memory-arena`)**: Real-time token streaming playground showing dynamic block allocation, radix prefix sharing, and LRU eviction.
- **09 · Post-Training Infra Director (`rl-topology-lab`)**: Distributed GRPO / PPO / DPO pipeline coordinator orchestrating vLLM rollouts, rewards, and Megatron training.
- **10 · Cluster SRE Incident Game (`incident-commander`)**: High-stakes crisis simulation: diagnose NaN loss spikes, silent data corruption, and InfiniBand dropouts.

### 3. Progressive Scaffolding & Kata Dojos
- **11 · 'Build Your Own' Engine Scaffolder (`byo-engine`)**: Test-driven milestone synthesizer: build `nano-vllm`, `nano-sglang`, and `nano-grpo` from scratch.
- **12 · Terminal Kata Dojo (`tui-dojo`)**: Ultra-fast keyboard-first TUI for high-frequency PyTorch and systems drills with ASCII memory rendering.
- **13 · Git Archeology Decompiler (`git-archeology`)**: Reverse-engineer open-source repos (vLLM, SGLang, Megatron) through curated chronological commit diffs.
- **14 · Synthetic Staff Review Board (`staff-agent-board`)**: Multi-agent corporate simulation: Staff Infra Architect, Senior CUDA Engineer, and SRE Lead review PRs.
- **15 · Ambient Menubar Micro-Drills (`ambient-micro-drills`)**: Low-friction daily habit: 10-minute deep systems puzzles directly in your macOS menubar.

### 4. Cross-Domain Synthesis & Knowledge Graphs
- **16 · Systems Mastery Tech-Tree RPG (`mastery-rpg`)**: Civilization-style dependency skill graph with coding quests and cross-domain branches.
- **17 · Cross-Domain Concept Weaver (`domain-cartographer`)**: Cognitive bridge builder mapping isomorphic mental models (OS Virtual Memory <-> PagedAttention).
- **18 · Paper-to-Practice Compiler (`paper-to-practice`)**: Drop an ArXiv PDF (DeepSeek-R1, FlashAttention-3) -> auto-synthesizes a 7-day executable PyTorch lab.
- **19 · Architecture Whiteboard Exam Studio (`system-design-whiteboard`)**: Hand-drawn shape diagram parser that compiles directly into a PyTorch communications simulator.
- **20 · Interactive Code-Cast Studio (`interactive-codecast`)**: Dynamic AI video/audio narration that drives live code execution and whiteboard overlays.
