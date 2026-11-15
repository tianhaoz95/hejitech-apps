// Finding and reading a repo's .hq/ files, for both places that do it: the CLI walks a checkout
// (apps/cli/src/repo.ts), and the Worker reads them from GitHub when an agent connected over MCP
// calls sync_policy with `git ls-tree` output (no CLI needed). The YAML parser is passed in, so this
// package stays dependency-free.

import type { HqFile } from "./policy.ts";

/** Folders never searched for .hq/ (dependencies, build output, tool caches). */
export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".wrangler", ".derived", "Pods", "DerivedData", ".build", ".dart_tool", "target", ".next", ".venv", "venv"]);
/** How deep below the repo root a project's .hq/ may be. */
export const MAX_HQ_DEPTH = 4;

export type YamlLoad = (text: string) => unknown;

export function parseHqMd(text: string, where: string, load: YamlLoad): { frontmatter: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${where}: HQ.md must start with YAML frontmatter between --- lines`);
  let fm: unknown;
  try {
    fm = load(m[1]);
  } catch (e) {
    throw new Error(`${where}: invalid YAML frontmatter: ${(e as Error).message.split("\n")[0]}`);
  }
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) throw new Error(`${where}: frontmatter must be a YAML mapping`);
  return { frontmatter: fm as Record<string, unknown>, body: m[2] };
}

/** Is this folder (repo-relative, "" for the root) one HQ looks for a .hq/ in? */
export function searchedDir(dir: string): boolean {
  if (!dir) return true;
  const parts = dir.split("/");
  return parts.length <= MAX_HQ_DEPTH && parts.every((p) => p && !SKIP_DIRS.has(p) && !p.startsWith("."));
}

export interface PolicyTree {
  /** One per .hq/HQ.md: its folder, path and git blob id. */
  files: { dir: string; path: string; sha: string }[];
  /** Verbs per folder: executable files in .hq/bin. */
  bin: Record<string, string[]>;
  /** Files in .hq/bin that aren't executable (mode 100644), for the error message. */
  notExecutable: string[];
}

/**
 * Reads `git ls-tree -r <ref>` output (`<mode> blob <sha>\t<path>`), keeping .hq/HQ.md files and
 * .hq/bin entries in folders HQ searches. Other lines are ignored, so a filtered or unfiltered
 * listing both work.
 */
export function parsePolicyTree(text: string): PolicyTree {
  const out: PolicyTree = { files: [], bin: {}, notExecutable: [] };
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = line.match(/^(\d{6}) blob ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/);
    if (!m) continue;
    const [, mode, sha, path] = m;
    const hq = path.match(/^(?:(.+)\/)?\.hq\/HQ\.md$/);
    if (hq) {
      const dir = hq[1] ?? "";
      if (searchedDir(dir)) out.files.push({ dir, path, sha });
      continue;
    }
    const bin = path.match(/^(?:(.+)\/)?\.hq\/bin\/([^/]+)$/);
    if (bin && !bin[2].startsWith(".")) {
      const dir = bin[1] ?? "";
      if (!searchedDir(dir)) continue;
      if (mode === "100755") (out.bin[dir] ??= []).push(bin[2]);
      else out.notExecutable.push(path);
    }
  }
  out.files.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  for (const k of Object.keys(out.bin)) out.bin[k].sort();
  return out;
}

/** Git's id for a blob (SHA-1 of "blob <size>\0<bytes>"), to check a fetched file is the one listed. */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const head = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const all = new Uint8Array(head.byteLength + bytes.byteLength);
  all.set(head);
  all.set(bytes, head.byteLength);
  const d = await crypto.subtle.digest("SHA-1", all);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One HQ.md plus its folder's verbs as the policy builder takes it. */
export function hqFile(dir: string, text: string, bin: string[], load: YamlLoad): HqFile {
  const where = `${dir ? dir + "/" : ""}.hq/HQ.md`;
  const { frontmatter, body } = parseHqMd(text, where, load);
  return { dir, frontmatter: frontmatter as unknown as HqFile["frontmatter"], body, bin };
}
