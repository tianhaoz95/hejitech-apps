import { chmodSync, cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findHqDirs, lint, loadPolicy, parseHqMd, runVerb } from "../src/repo.ts";
import { summaryOf } from "../src/adapters.ts";

const fixture = join(__dirname, "fixture");
const copy = () => {
  const d = mkdtempSync(join(tmpdir(), "hq-fixture-"));
  cpSync(fixture, d, { recursive: true });
  return d;
};

describe("a repo HQ has never seen (portability)", () => {
  it("finds .hq folders and builds the policy from the manifest alone", () => {
    expect(findHqDirs(fixture)).toEqual(["", "apps/alpha"]);
    const { policy, errors } = loadPolicy(fixture);
    expect(errors).toEqual([]);
    expect(policy?.repo).toBe("example/fixture");
    // alpha asks for L1, but the root allows at most L2 autonomy: a project can only be stricter.
    expect(policy?.projects.alpha.tier_ceiling).toBe("L2");
    expect(policy?.projects.alpha.verbs.release.tier).toBe("L3");
    expect(policy?.scouts.map((s) => s.name)).toEqual(["ci-watch"]);
  });

  it("lint runs read-only verbs and dry-runs the rest", () => {
    const r = lint(fixture, { runVerbs: true });
    expect(r.errors).toEqual([]);
  });

  it("runs verbs with JSON out and the contract's environment", () => {
    const { policy } = loadPolicy(fixture);
    const r = runVerb(fixture, policy!, "alpha", "health");
    expect(r.code).toBe(0);
    expect(r.json).toEqual({ ok: true, probe: "alpha" });
    expect(runVerb(fixture, policy!, "alpha", "release", { dryRun: true }).json).toEqual({ ok: true, dry_run: true });
  });

  it("reports broken manifests and verbs with the file named", () => {
    const d = copy();
    writeFileSync(join(d, "apps/alpha/.hq/HQ.md"), "---\nhq: 1\nverbs:\n  deploy: { tier: L9 }\n---\n");
    writeFileSync(join(d, ".hq/bin/notexec"), "#!/bin/sh\n");
    chmodSync(join(d, ".hq/bin/notexec"), 0o644);
    const r = lint(d, { runVerbs: false });
    const all = r.errors.join("\n");
    expect(all).toMatch(/\.hq\/bin\/notexec: not executable/);
    expect(all).toMatch(/apps\/alpha\/\.hq\/HQ\.md: verbs\.deploy\.tier/);
    expect(all).toMatch(/verbs\.deploy: declared but \.hq\/bin\/deploy is missing/);
  });

  it("refuses HQ.md without frontmatter", () => {
    expect(() => parseHqMd("# no frontmatter", "x/.hq/HQ.md")).toThrow(/must start with YAML frontmatter/);
  });

  it("warns when a project has no agent instructions", () => {
    const d = copy();
    cpSync(join(d, "apps/alpha"), join(d, "apps/beta"), { recursive: true });
    writeFileSync(join(d, "apps/beta/.hq/HQ.md"), "---\nhq: 1\nproject: beta\n---\n");
    rmSync(join(d, "apps/beta/CLAUDE.md"));
    expect(lint(d, { runVerbs: false }).warnings.join()).toMatch(/beta/);
  });
});

describe("agent output", () => {
  it("takes the SUMMARY line, or the CEO's memo", () => {
    expect(summaryOf("did things\nSUMMARY: filed 2 cards")).toBe("filed 2 cards");
    expect(summaryOf("MEMO: line one\nline two\nSUMMARY: ranked 4")).toBe("line one\nline two\n\nranked 4");
    expect(summaryOf("no marker\nlast line")).toBe("last line");
  });
});
