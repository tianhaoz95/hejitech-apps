import { admin, json, supabaseUser, type Env } from "./store.ts";
import type { Course } from "@polymath/core";

const SAMPLE_COURSE: Course = {
  id: "pytorch-vllm-sglang",
  title: "PyTorch Deep Systems: Building vLLM, SGLang & TensorRT-LLM",
  description: "Master modern inference engine internals from scratch: memory paged allocation, radix tree prefix caching, continuous batching, and chunked prefill.",
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
      markdownContent: `# 1. The Naive Autoregressive Generation Loop\n\nAutoregressive LLM generation generates tokens one by one.\n\n<CodeExercise id="ex-01" title="Naive Generation Loop" targetFile="exercises/naive_generate.py" testFile="tests/test_naive_generate.py" instructions="Implement the forward pass token append loop." starterCode="def generate_next(model, input_ids):\\n    pass" />`,
      components: [],
      estimatedMinutes: 20,
    },
    {
      id: "ch-02",
      slug: "paged-attention-allocator",
      title: "2. PagedAttention & The Non-Contiguous Block Table",
      order: 2,
      summary: "Model GPU HBM pages to eliminate internal memory fragmentation.",
      markdownContent: `# 2. PagedAttention & Block Manager\n\nVirtual memory pagination eliminates contiguous memory pre-allocation.\n\n<MemoryBlockGrid totalBlocks="32" allocatedBlocks="18" sharedPrefixBlocks="8" title="GPU HBM3 Memory Map" />\n\n<CodeExercise id="ex-02" title="Implement FreeList Block Manager" targetFile="exercises/block_manager.py" testFile="tests/test_block_manager.py" instructions="Implement allocate() and free() using O(1) bitmask." starterCode="class BlockManager:\\n    def __init__(self, num_blocks):\\n        self.free_blocks = []" />`,
      components: [],
      estimatedMinutes: 35,
    },
    {
      id: "ch-03",
      slug: "radix-tree-prefix-cache",
      title: "3. SGLang Radix Tree Prefix Cache",
      order: 3,
      summary: "Traverse prefix trees to reuse prefill KV caches across multi-turn chats.",
      markdownContent: `# 3. Radix Tree Prefix Cache\n\nShare physical KV cache blocks across requests with matching system prompts.\n\n<SocraticQuiz question="What condition is required to evict a radix node?" options="Node ref_count is zero|Node has more than 2 children|Node token count exceeds 1024" correctAnswerIndex="0" explanation="Nodes can only be freed when ref count reaches 0." />`,
      components: [],
      estimatedMinutes: 30,
    },
  ],
};

export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/sample-course") {
    return json(SAMPLE_COURSE);
  }

  if (path === "/api/profile") {
    const user = await supabaseUser(env, req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const client = admin(env);

    if (req.method === "GET") {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        return json({ error: error.message }, 500);
      }

      if (!data) {
        // Return default profile
        return json({
          userId: user.id,
          displayName: user.email?.split("@")[0] || "Learner",
          preferences: { theme: "dark", fontSize: 14, autoRunTests: true },
          recentCourses: [],
        });
      }

      return json({
        userId: data.user_id,
        displayName: data.display_name,
        preferences: data.preferences,
        recentCourses: data.recent_courses,
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = (await req.json().catch(() => ({}))) as Record<string, any>;
      const { error } = await client.from("profiles").upsert({
        user_id: user.id,
        display_name: body.displayName,
        preferences: body.preferences,
        recent_courses: body.recentCourses,
        updated_at: new Date().toISOString(),
      });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
  }

  return json({ error: "Not found" }, 404);
}
