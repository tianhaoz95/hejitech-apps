// Reading a repo's .hq/ folders: find them, parse HQ.md (YAML frontmatter + prose), list the verbs
// in .hq/bin, build the policy, and lint everything (`hq lint`). Nothing here knows any project's
// name or layout: a repo is just a tree with .hq/ folders in it.
import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import yaml from "js-yaml";
import { buildPolicy, type HqFile, type RepoPolicy } from "@hq/core";

const SKIP = new Set(["node_modules", ".git", "dist", "build", ".wrangler", ".derived", "Pods", "DerivedData", ".build", ".dart_tool", "target", ".next", ".venv", "venv"]);
/** Verbs that only read; every other verb must support --dry-run. */
export const READ_ONLY_VERBS = new Set(["health", "verify", "evidence", "setup"]);

export function repoRoot(from = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: from, encoding: "utf8" }).trim();
  } catch {
    return from;
  }
}

export function headCommit(root: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/** Every folder that contains .hq/HQ.md, repo-relative ("" for the root). Depth-limited. */
export function findHqDirs(root: string, maxDepth = 4): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (existsSync(join(dir, ".hq", "HQ.md"))) out.push(relative(root, dir));
    if (depth >= maxDepth) return;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP.has(e) || (e.startsWith(".") && e !== ".hq")) continue;
      if (e === ".hq") continue;
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory()) walk(p, depth + 1);
      } catch {
        /* unreadable: skip */
      }
    }
  };
  walk(root, 0);
  return out.sort();
}

export function parseHqMd(text: string, where: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${where}: HQ.md must start with YAML frontmatter between --- lines`);
  let fm: unknown;
  try {
    fm = yaml.load(m[1]);
  } catch (e) {
    throw new Error(`${where}: invalid YAML frontmatter: ${(e as Error).message.split("\n")[0]}`);
  }
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) throw new Error(`${where}: frontmatter must be a YAML mapping`);
  return { frontmatter: fm as Record<string, unknown>, body: m[2] };
}

export function listVerbs(hqDir: string): { executable: string[]; notExecutable: string[] } {
  const bin = join(hqDir, "bin");
  const executable: string[] = [];
  const notExecutable: string[] = [];
  if (!existsSync(bin)) return { executable, notExecutable };
  for (const f of readdirSync(bin)) {
    if (f.startsWith(".")) continue;
    const p = join(bin, f);
    if (!statSync(p).isFile()) continue;
    try {
      accessSync(p, constants.X_OK);
      executable.push(f);
    } catch {
      notExecutable.push(f);
    }
  }
  return { executable: executable.sort(), notExecutable };
}

export function readHqFiles(root: string): { files: HqFile[]; errors: string[] } {
  const files: HqFile[] = [];
  const errors: string[] = [];
  for (const dir of findHqDirs(root)) {
    const hq = join(root, dir, ".hq");
    const where = `${dir ? dir + "/" : ""}.hq/HQ.md`;
    try {
      const { frontmatter, body } = parseHqMd(readFileSync(join(hq, "HQ.md"), "utf8"), where);
      const verbs = listVerbs(hq);
      for (const f of verbs.notExecutable) errors.push(`${dir ? dir + "/" : ""}.hq/bin/${f}: not executable (chmod +x)`);
      files.push({ dir, frontmatter: frontmatter as unknown as HqFile["frontmatter"], body, bin: verbs.executable });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { files, errors };
}

export function loadPolicy(root: string): { policy: RepoPolicy | null; errors: string[] } {
  const { files, errors } = readHqFiles(root);
  const r = buildPolicy(files);
  if (!r.ok) return { policy: null, errors: [...errors, ...r.errors] };
  return { policy: r.value, errors };
}

export function verbPath(root: string, policy: RepoPolicy, project: string, verb: string): string {
  const dir = project === "repo-wide" ? "" : policy.projects[project]?.dir;
  if (dir === undefined) throw new Error(`unknown project ${project}`);
  return join(root, dir, ".hq", "bin", verb);
}

export interface VerbResult {
  code: number;
  stdout: string;
  stderr: string;
  json: unknown;
  ms: number;
}

/** Runs a verb with the contract's environment: cwd = repo root, no stdin, JSON on stdout. */
export function runVerb(root: string, policy: RepoPolicy, project: string, verb: string, opts: { dryRun?: boolean; args?: string[]; timeoutMs?: number } = {}): VerbResult {
  const path = verbPath(root, policy, project, verb);
  if (!existsSync(path)) throw new Error(`${relative(root, path)} doesn't exist`);
  const args = [...(opts.dryRun ? ["--dry-run"] : []), ...(opts.args ?? [])];
  const t0 = Date.now();
  const r = spawnSync(path, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: opts.timeoutMs ?? 30 * 60_000,
    env: { ...process.env, HQ_PROJECT: project, HQ_VERB: verb, HQ_REPO_ROOT: root, HQ_DRY_RUN: opts.dryRun ? "1" : "" },
    maxBuffer: 20 * 1024 * 1024,
  });
  let json: unknown = null;
  const out = (r.stdout ?? "").trim();
  const last = out.slice(out.lastIndexOf("\n{") + 1);
  for (const candidate of [out, last]) {
    try {
      json = JSON.parse(candidate);
      break;
    } catch {
      /* not JSON */
    }
  }
  return { code: r.status ?? (r.signal ? 124 : 1), stdout: r.stdout ?? "", stderr: (r.stderr ?? "") + (r.error ? String(r.error) : ""), json, ms: Date.now() - t0 };
}

/**
 * `hq lint`: the frontmatter schema, every declared verb exists and is executable, read-only verbs
 * print JSON, and every side-effecting verb passes --dry-run (exit 0, JSON out).
 */
export function lint(root: string, opts: { runVerbs: boolean }): { errors: string[]; warnings: string[]; policy: RepoPolicy | null } {
  const { policy, errors } = loadPolicy(root);
  const warnings: string[] = [];
  if (!policy) return { errors, warnings, policy };
  const all = [["repo-wide", policy.verbs] as const, ...Object.values(policy.projects).map((p) => [p.name, p.verbs] as const)];
  for (const [project, verbs] of all) {
    const dir = project === "repo-wide" ? "" : policy.projects[project].dir;
    const where = `${dir ? dir + "/" : ""}.hq`;
    if (project !== "repo-wide" && !existsSync(join(root, dir, "CLAUDE.md")) && !existsSync(join(root, dir, "AGENTS.md"))) {
      warnings.push(`${where}: no CLAUDE.md/AGENTS.md next to it; agents won't know how to build and test ${project}`);
    }
    if (!opts.runVerbs) continue;
    for (const name of Object.keys(verbs)) {
      const dry = !READ_ONLY_VERBS.has(name);
      if (name === "verify" || name === "evidence" || name === "setup") continue; // slow or needs a change; checked by CI per project
      const r = runVerb(root, policy, project, name, { dryRun: dry, timeoutMs: 5 * 60_000 });
      if (r.code !== 0) errors.push(`${where}/bin/${name}${dry ? " --dry-run" : ""}: exit ${r.code}${r.stderr ? `: ${r.stderr.trim().split("\n").slice(-2).join(" ")}` : ""}`);
      else if (r.json === null) errors.push(`${where}/bin/${name}${dry ? " --dry-run" : ""}: stdout isn't JSON`);
    }
  }
  return { errors, warnings, policy };
}
