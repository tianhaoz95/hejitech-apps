import type { Chapter, CourseComponentProps } from "./types.js";

/**
 * Parses embedded component tags out of course chapter markdown.
 * Example tag:
 * <MemoryBlockGrid totalBlocks="32" allocatedBlocks="18" sharedPrefixBlocks="8" title="GPU HBM" />
 */
export function extractComponentsFromMarkdown(markdown: string): {
  cleanMarkdown: string;
  components: CourseComponentProps[];
} {
  const components: CourseComponentProps[] = [];
  const tagRegex = /<([A-Z][a-zA-Z0-9]+)\s+([^>]*)\/>/g;

  const cleanMarkdown = markdown.replace(tagRegex, (_match, tagName, attrsString) => {
    const rawAttrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z0-9_-]+)=(?:["']([^"']*)["']|{([^}]*)})/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      const key = attrMatch[1];
      const val = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
      rawAttrs[key] = val;
    }

    try {
      if (tagName === "MemoryBlockGrid") {
        components.push({
          kind: "MemoryBlockGrid",
          props: {
            totalBlocks: Number(rawAttrs.totalBlocks || 32),
            allocatedBlocks: Number(rawAttrs.allocatedBlocks || 0),
            sharedPrefixBlocks: Number(rawAttrs.sharedPrefixBlocks || 0),
            blockSizeTokens: Number(rawAttrs.blockSizeTokens || 16),
            title: rawAttrs.title,
          },
        });
      } else if (tagName === "CodeExercise") {
        components.push({
          kind: "CodeExercise",
          props: {
            id: rawAttrs.id || `ex-${components.length + 1}`,
            title: rawAttrs.title || "Code Exercise",
            targetFile: rawAttrs.targetFile || "",
            testFile: rawAttrs.testFile || "",
            instructions: rawAttrs.instructions || "",
            starterCode: rawAttrs.starterCode || "",
            solutionHint: rawAttrs.solutionHint,
          },
        });
      } else if (tagName === "RooflinePlot") {
        components.push({
          kind: "RooflinePlot",
          props: {
            arithmeticIntensity: Number(rawAttrs.arithmeticIntensity || 1.0),
            achievedTflops: Number(rawAttrs.achievedTflops || 100),
            memoryCeilingTbs: Number(rawAttrs.memoryCeilingTbs || 3.35),
            computeCeilingTflops: Number(rawAttrs.computeCeilingTflops || 989),
            kernelLabel: rawAttrs.kernelLabel,
          },
        });
      } else if (tagName === "ClusterTopology") {
        components.push({
          kind: "ClusterTopology",
          props: {
            nodeCount: Number(rawAttrs.nodeCount || 1),
            gpusPerNode: Number(rawAttrs.gpusPerNode || 8),
            interconnect: (rawAttrs.interconnect as any) || "nvlink",
            tensorParallelSize: Number(rawAttrs.tensorParallelSize || 1),
          },
        });
      } else if (tagName === "SocraticQuiz") {
        let parsedOptions: string[] = [];
        try {
          parsedOptions = JSON.parse(rawAttrs.options || "[]");
        } catch {
          parsedOptions = rawAttrs.options ? rawAttrs.options.split("|").map((s) => s.trim()) : [];
        }
        components.push({
          kind: "SocraticQuiz",
          props: {
            question: rawAttrs.question || "",
            options: parsedOptions,
            correctAnswerIndex: Number(rawAttrs.correctAnswerIndex || 0),
            explanation: rawAttrs.explanation || "",
          },
        });
      }
    } catch {
      // Ignore malformed tag in parsing
    }

    return `\n\n<!-- component:${tagName}:${components.length - 1} -->\n\n`;
  });

  return { cleanMarkdown, components };
}

/**
 * Parses a raw chapter markdown text into a structured Chapter object.
 */
export function parseChapter(
  id: string,
  slug: string,
  title: string,
  order: number,
  rawMarkdown: string,
  estimatedMinutes = 15
): Chapter {
  const { cleanMarkdown, components } = extractComponentsFromMarkdown(rawMarkdown);
  const firstParagraph = cleanMarkdown.split("\n\n").find((p) => p.trim() && !p.startsWith("#")) || "";
  const summary = firstParagraph.replace(/[*_#`]/g, "").slice(0, 140).trim();

  return {
    id,
    slug,
    title,
    order,
    summary: summary || title,
    markdownContent: cleanMarkdown,
    components,
    estimatedMinutes,
  };
}
