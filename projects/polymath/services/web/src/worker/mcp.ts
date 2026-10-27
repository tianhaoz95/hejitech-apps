import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCourse, type Course } from "@polymath/core";
import { json } from "./store.ts";

export interface Caller {
  userId: string;
  via: "oauth" | "token";
}

const TOOLS = [
  {
    name: "list_component_types",
    description: "Lists all interactive UI component types that can be embedded into Polymath course chapters.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "validate_course",
    description: "Validates a candidate course object against the normative Polymath schema.",
    inputSchema: {
      type: "object",
      properties: {
        course: { type: "object", description: "The complete Course JSON structure." },
      },
      required: ["course"],
    },
  },
  {
    name: "get_course_blueprint",
    description: "Generates recommended chapter and exercise scaffolding for a requested topic (e.g. 'vLLM PagedAttention', 'GRPO Post-Training').",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "The topic or technology to learn." },
        level: { type: "string", enum: ["intro", "intermediate", "advanced", "zero-to-hero"], default: "zero-to-hero" },
      },
      required: ["topic"],
    },
  },
];

export async function handleMcp(req: Request, caller: Caller, _client: SupabaseClient): Promise<Response> {
  if (req.method === "GET") {
    return json({
      name: "polymath",
      version: "0.1.0",
      description: "Polymath Course Authoring & Validation MCP Server",
      tools: TOOLS,
      caller: { userId: caller.userId, via: caller.via },
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = (await req.json().catch(() => ({}))) as { method?: string; params?: any; id?: any };
  const method = body.method;
  const id = body.id || 1;

  if (method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    const { name, arguments: args } = body.params || {};

    if (name === "list_component_types") {
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                [
                  {
                    tag: "<MemoryBlockGrid totalBlocks={n} allocatedBlocks={n} sharedPrefixBlocks={n} blockSizeTokens={16} title='...' />",
                    description: "Visualizes GPU HBM page tables and dynamic prefix block sharing.",
                  },
                  {
                    tag: "<CodeExercise id='...' title='...' targetFile='exercises/...' testFile='tests/...' instructions='...' starterCode='...' />",
                    description: "Embedded code editor wired to isolated pytest runner in sandbox.",
                  },
                  {
                    tag: "<RooflinePlot arithmeticIntensity={n} achievedTflops={n} memoryCeilingTbs={3.35} computeCeilingTflops={989} />",
                    description: "Plots arithmetic intensity vs memory bandwidth against hardware ceilings.",
                  },
                  {
                    tag: "<ClusterTopology nodeCount={1} gpusPerNode={8} interconnect='nvlink' />",
                    description: "Simulates multi-GPU distributed clusters and communication rings.",
                  },
                  {
                    tag: "<SocraticQuiz question='...' options=['...'] correctAnswerIndex={0} explanation='...' />",
                    description: "Multiple-choice concept verification quiz.",
                  },
                ],
                null,
                2
              ),
            },
          ],
        },
      });
    }

    if (name === "validate_course") {
      const course = args?.course as Course;
      const res = validateCourse(course);
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        },
      });
    }

    if (name === "get_course_blueprint") {
      const topic = String(args?.topic || "Systems Engineering");
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  recommendedTitle: `Deep Systems: Mastering ${topic}`,
                  chapters: [
                    { order: 1, title: "Foundations & Baseline Inefficiencies", focus: "Toy implementation & profiling" },
                    { order: 2, title: "Memory Layout & Hardware Alignment", focus: "Block manager and memory maps" },
                    { order: 3, title: "Core Kernel Optimization", focus: "Tiling, prefix caching, and fusion" },
                    { order: 4, title: "Distributed Scaling & Serving", focus: "Parallelism and continuous batching" },
                  ],
                },
                null,
                2
              ),
            },
          ],
        },
      });
    }

    return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } });
  }

  return json({ jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid request" } });
}
