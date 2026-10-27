import { describe, it, expect } from "vitest";
import {
  extractComponentsFromMarkdown,
  parseChapter,
  validateChapter,
  validateCourse,
  type Course,
} from "../src/index.js";

describe("@polymath/core parsing & validation", () => {
  it("extracts embedded component tags from markdown text", () => {
    const raw = `
# Chapter 1: PagedAttention Internals

Here is an explanation of virtual page tables for KV Cache:

<MemoryBlockGrid totalBlocks="64" allocatedBlocks="28" sharedPrefixBlocks="12" title="HBM Block Allocator" />

Now write the allocator code:

<CodeExercise id="kv-alloc" title="Paged Allocator" targetFile="exercises/radix_cache.py" testFile="tests/test_radix.py" />

Test your understanding:

<SocraticQuiz question="Why do we use block tables?" options="Save memory|Increase latency" correctAnswerIndex="0" explanation="Eliminates fragmentation." />
    `;

    const { cleanMarkdown, components } = extractComponentsFromMarkdown(raw);
    expect(components).toHaveLength(3);
    expect(components[0].kind).toBe("MemoryBlockGrid");
    if (components[0].kind === "MemoryBlockGrid") {
      expect(components[0].props.totalBlocks).toBe(64);
      expect(components[0].props.allocatedBlocks).toBe(28);
    }
    expect(components[1].kind).toBe("CodeExercise");
    expect(components[2].kind).toBe("SocraticQuiz");
    expect(cleanMarkdown).toContain("<!-- component:MemoryBlockGrid:0 -->");
  });

  it("validates a healthy course schema", () => {
    const course: Course = {
      id: "vllm-deep-dive",
      title: "vLLM & SGLang Internals",
      description: "Building inference engines from scratch",
      domain: "ai-inference",
      author: "Heji Polymath",
      version: "1.0.0",
      tags: ["pytorch", "cuda", "vllm"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [
        parseChapter(
          "c1",
          "paged-attention",
          "1. PagedAttention",
          1,
          `# 1. PagedAttention\n\nIntroduction to paging.\n\n<MemoryBlockGrid totalBlocks="32" allocatedBlocks="16" sharedPrefixBlocks="4" />`
        ),
      ],
    };

    const res = validateCourse(course);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("flags missing files in code exercises", () => {
    const chapter = parseChapter(
      "c1",
      "bad-chapter",
      "Broken Chapter",
      1,
      `<CodeExercise id="bad" title="No test" targetFile="main.py" />`
    );

    const res = validateChapter(chapter);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("missing testFile");
  });
});
