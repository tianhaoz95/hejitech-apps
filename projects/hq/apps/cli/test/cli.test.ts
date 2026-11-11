import { chmodSync, cpSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findHqDirs, lint, loadPolicy, parseHqMd, runVerb } from "../src/repo.ts";
import { summaryOf } from "../src/adapters.ts";
import { credentialsFile, normalizeUrl, removeLogin, resolveCredentials, saveLogin } from "../src/credentials.ts";
import { displayCode } from "../src/login.ts";
import { repoName } from "../src/repo.ts";

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

describe("where hq finds its address and tokens", () => {
  const dir = () => ({ HQ_CONFIG_DIR: mkdtempSync(join(tmpdir(), "hq-config-")) });
  const saved = { url: "https://hq.example", token: "hq_run_saved", agent_token: "hq_agt_saved" };

  it("uses the environment first, then the login saved for the repo, else nothing", () => {
    const env = dir();
    expect(resolveCredentials("example/fixture", env)).toBeNull();
    saveLogin("example/fixture", saved, env);
    expect(resolveCredentials("example/fixture", env)).toMatchObject({ ...saved, source: "saved" });
    expect(resolveCredentials("someone/else", env)).toBeNull();
    // A headless runner's variables win over whatever a person saved.
    expect(resolveCredentials("example/fixture", { ...env, HQ_URL: "http://127.0.0.1:1", HQ_TOKEN: "hq_run_env" })).toEqual({ url: "http://127.0.0.1:1", token: "hq_run_env", agent_token: undefined, source: "environment" });
    // Half of the pair isn't a login; an agent token alone overrides the saved one.
    expect(resolveCredentials("example/fixture", { ...env, HQ_URL: "http://127.0.0.1:1" })?.url).toBe(saved.url);
    expect(resolveCredentials("example/fixture", { ...env, HQ_AGENT_TOKEN: "hq_agt_env" })?.agent_token).toBe("hq_agt_env");
    rmSync(env.HQ_CONFIG_DIR, { recursive: true, force: true });
  });

  it("keeps the saved login private and forgets it on logout", () => {
    const env = dir();
    saveLogin("example/fixture", saved, env);
    saveLogin("someone/else", saved, env);
    expect(statSync(credentialsFile(env)).mode & 0o777).toBe(0o600);
    expect(removeLogin("example/fixture", env)).toBe(true);
    expect(removeLogin("example/fixture", env)).toBe(false);
    expect(resolveCredentials("example/fixture", env)).toBeNull();
    expect(resolveCredentials("someone/else", env)?.token).toBe(saved.token);
    rmSync(env.HQ_CONFIG_DIR, { recursive: true, force: true });
  });

  it("accepts an address typed loosely, the MCP address included", () => {
    expect(normalizeUrl("hq.example/mcp/")).toBe("https://hq.example");
    expect(normalizeUrl(" https://hq.example// ")).toBe("https://hq.example");
    expect(normalizeUrl("127.0.0.1:8799")).toBe("http://127.0.0.1:8799");
    expect(normalizeUrl("")).toBe("");
  });

  it("names the login after the repo in .hq/HQ.md and shows a short code for the browser", () => {
    expect(repoName(fixture)).toBe("example/fixture");
    expect(repoName(tmpdir())).toBeNull();
    expect(displayCode("0a1b2c3d" + "0".repeat(56))).toBe("0A1B-2C3D");
  });
});
