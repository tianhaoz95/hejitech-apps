# Polymath

Agent-native interactive course player and extensible learning runtime.

## Overview
Polymath solves deep systems learning by pairing a native desktop course player with coding agents. When you want to master a complex topic (such as PyTorch inference engine internals for vLLM and SGLang, or zero-to-hero LLM post-training infrastructure), Polymath provisions an isolated workspace on disk, pre-seeds it with authoring skills and MCP tools, and lets an agent construct a progressive hands-on curriculum complete with interactive hardware widgets and automated pytest suites.

## Features
- **Managed Workspace Creator**: Generates isolated course repositories on your local disk (`~/heji-courses/<name>`).
- **Pre-Seeded Skills & MCP Server**: Equips coding agents with exact schema guidelines, component documentation, and hot-reload preview tools.
- **Composable Component Library**:
  - `<MemoryBlockGrid />`: Live GPU HBM and KV-cache allocation visualizer.
  - `<CodeExercise />`: Interactive code editor with sandbox runner and automated tests.
  - `<RooflinePlot />`: Arithmetic intensity vs memory bandwidth curves.
  - `<ClusterTopology />`: Simulated multi-GPU NVLink / InfiniBand topologies.
  - `<InteractiveWhiteboard />`: Architecture diagram and dataflow canvas.
  - `<SocraticQuiz />`: Self-assessment quizzes.
- **Bundled Starter Course**: *PyTorch Deep Systems: Building vLLM, SGLang & TensorRT-LLM* covering PagedAttention, Radix tree prefix caching, and continuous batching.
