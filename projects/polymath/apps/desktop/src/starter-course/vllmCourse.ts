import type { Course } from "@polymath/core";

export const STARTER_VLLM_COURSE: Course = {
  id: "pytorch-vllm-sglang",
  title: "PyTorch Deep Systems: Building vLLM, SGLang & TensorRT-LLM",
  description: "Master modern inference engine internals from scratch: non-contiguous KV-cache paging, Radix tree prefix caching, continuous batching, and arithmetic intensity rooflines.",
  domain: "ai-inference",
  author: "Polymath Systems",
  version: "1.0.0",
  tags: ["pytorch", "cuda", "vllm", "sglang", "trt-llm"],
  createdAt: "2026-10-27T00:00:00.000Z",
  updatedAt: "2026-10-27T00:00:00.000Z",
  chapters: [
    {
      id: "ch-01",
      slug: "autoregressive-baseline",
      title: "1. The Naive Autoregressive Generation Loop",
      order: 1,
      summary: "Understand standard generation loops and where memory inefficiencies emerge.",
      markdownContent: `# 1. The Naive Autoregressive Generation Loop

In standard autoregressive language model serving, tokens are generated one by one. In a naive implementation, key and value tensor projections for every token are appended contiguously.

As sequences grow, the pre-allocated contiguous memory leads to severe internal fragmentation.

### Hands-on Exercise: Baseline Generator
Inspect the starter code below and write the autoregressive decode step loop:`,
      components: [
        {
          kind: "CodeExercise",
          props: {
            id: "ex-01-naive",
            title: "1.1 Implement Autoregressive Forward Step",
            targetFile: "exercises/naive_generate.py",
            testFile: "tests/test_naive_generate.py",
            instructions: "Implement `step_generate(model, input_ids)` by appending the argmax logits token.",
            starterCode: `import torch\n\ndef step_generate(logits: torch.Tensor, current_tokens: torch.Tensor) -> torch.Tensor:\n    # Exercise: Extract next token ID and append to current sequence\n    next_token = torch.argmax(logits[:, -1, :], dim=-1, keepdim=True)\n    return torch.cat([current_tokens, next_token], dim=-1)\n`,
          },
        },
      ],
      estimatedMinutes: 20,
    },
    {
      id: "ch-02",
      slug: "paged-attention-allocator",
      title: "2. PagedAttention & Block Manager",
      order: 2,
      summary: "Model GPU HBM pages to eliminate internal memory fragmentation.",
      markdownContent: `# 2. PagedAttention & Block Manager

Inspired by operating system virtual memory, **PagedAttention** partitions the KV cache into fixed-size physical blocks (typically 16 or 32 tokens).

Instead of reserving contiguous GPU memory for each request up to \`max_context_len\`, blocks are allocated dynamically as tokens are generated.

### Interactive Memory Map
Observe how logical blocks map to physical HBM pages below:`,
      components: [
        {
          kind: "MemoryBlockGrid",
          props: {
            totalBlocks: 32,
            allocatedBlocks: 18,
            sharedPrefixBlocks: 8,
            blockSizeTokens: 16,
            title: "Simulated GPU HBM3 Allocation (PagedAttention)",
          },
        },
        {
          kind: "CodeExercise",
          props: {
            id: "ex-02-block-manager",
            title: "2.1 Build an O(1) Free-List Block Manager",
            targetFile: "exercises/block_manager.py",
            testFile: "tests/test_block_manager.py",
            instructions: "Implement `allocate()` and `free()` for managing physical block IDs without memory leaks.",
            starterCode: `class BlockManager:\n    def __init__(self, num_blocks: int):\n        self.free_list = list(range(num_blocks))\n        self.allocated = set()\n\n    def allocate(self) -> int:\n        if not self.free_list:\n            raise MemoryError("Out of KV blocks!")\n        block_id = self.free_list.pop()\n        self.allocated.add(block_id)\n        return block_id\n\n    def free(self, block_id: int):\n        self.allocated.remove(block_id)\n        self.free_list.append(block_id)\n`,
          },
        },
      ],
      estimatedMinutes: 35,
    },
    {
      id: "ch-03",
      slug: "radix-tree-prefix-cache",
      title: "3. SGLang Radix Tree Prefix Cache",
      order: 3,
      summary: "Traverse prefix trees to reuse prefill KV caches across multi-turn chats.",
      markdownContent: `# 3. SGLang Radix Tree Prefix Cache

While PagedAttention solves memory fragmentation, **SGLang RadixAttention** solves redundant computation.

In multi-turn chat and few-shot workflows, requests frequently share identical system prompts. By retaining finished KV cache blocks in a Radix Tree, incoming requests can reuse pre-computed attention blocks with zero re-computation.

### Concept Verification`,
      components: [
        {
          kind: "SocraticQuiz",
          props: {
            question: "Why does RadixAttention use a radix tree rather than a simple hash map?",
            options: [
              "A radix tree enables longest-prefix matching on arbitrary token sequences",
              "A hash map cannot store integer keys",
              "Radix trees run natively on CUDA cores without CPU memory",
              "Hash maps do not support string hashing",
            ],
            correctAnswerIndex: 0,
            explanation: "Radix trees naturally match the longest shared token prefix, enabling partial cache re-use even when prompts diverge near the end.",
          },
        },
      ],
      estimatedMinutes: 25,
    },
    {
      id: "ch-04",
      slug: "roofline-intensity-model",
      title: "4. Arithmetic Intensity & The Attention Roofline",
      order: 4,
      summary: "Analyze memory-bound decode vs compute-bound prefill on the H100 GPU.",
      markdownContent: `# 4. Arithmetic Intensity & The Roofline Model

Attention computation fundamentally changes characteristics between **Prefill Phase** and **Decode Phase**:

- **Prefill (Prompt Processing)**: Large matrix multiplications ($Q \\times K^T$), high arithmetic intensity ($>100$ FLOPs/byte), **Compute-Bound**.
- **Decode (Token Generation)**: Vector-matrix lookups across cached keys/values, low arithmetic intensity ($<5$ FLOPs/byte), **Memory-Bound**.

### Roofline Curve (NVIDIA H100 SXM5)`,
      components: [
        {
          kind: "RooflinePlot",
          props: {
            arithmeticIntensity: 1.8,
            achievedTflops: 620,
            memoryCeilingTbs: 3.35,
            computeCeilingTflops: 989,
            kernelLabel: "PagedAttention Decode (Memory Bound)",
          },
        },
      ],
      estimatedMinutes: 30,
    },
    {
      id: "ch-05",
      slug: "distributed-cluster-topologies",
      title: "5. Distributed Tensor Parallelism & Cluster Topologies",
      order: 5,
      summary: "Scale across 8xH100 GPUs using Megatron-LM style Tensor Parallelism.",
      markdownContent: `# 5. Multi-GPU Tensor Parallelism & Topologies

When serving a 70B parameter model, a single GPU's 80GB HBM cannot fit both the model weights (140GB in FP16) and active KV caches.

We shard linear projection layers across multiple GPUs using **Tensor Parallelism (TP)**, synchronizing activations across high-speed NVLink switches via Ring All-Reduce.

### 8xH100 NVLink Interconnect Topology`,
      components: [
        {
          kind: "ClusterTopology",
          props: {
            nodeCount: 1,
            gpusPerNode: 8,
            interconnect: "nvlink",
            tensorParallelSize: 8,
          },
        },
      ],
      estimatedMinutes: 35,
    },
  ],
};
