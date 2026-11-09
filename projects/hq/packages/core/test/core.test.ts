import { describe, expect, it } from "vitest";
import {
  buildContext,
  buildPolicy,
  canTransition,
  checkCardAgainstPolicy,
  checkVerb,
  contextMarkdown,
  isDue,
  overBudget,
  validateCard,
  type CardInput,
  type HqFile,
} from "../src/index.ts";

const good: CardInput = {
  project: "alpha",
  kind: "reliability",
  title: "Mac release job fails on notarytool timeout",
  why: "Two of the last five releases failed at notarization.",
  evidence: [
    { type: "ci_run", ref: "https://github.com/o/r/actions/runs/1" },
    { type: "metric", name: "notarize p95", value: 14.2, unit: "min", source: "last 10 runs" },
  ],
  plan: "Poll status instead of --wait.",
  verify: "Next two releases notarize.",
  tier: "L1",
  verbs: ["verify"],
};

const root: HqFile = {
  dir: "",
  frontmatter: { hq: 1, repo: "acme/mono", tier_ceiling: "L0", scouts: ["ci"], inbox_cap: 4, weekly_budget_usd: 20 },
  body: "Repo guidance.",
  bin: ["health"],
};
const alpha: HqFile = {
  dir: "projects/alpha",
  frontmatter: { hq: 1, tier_ceiling: "L1", never: ["live-orders"], verbs: { release: { tier: "L3", runs_on: "mac-runner" } } },
  body: "Alpha guidance.",
  bin: ["health", "verify", "release"],
};

describe("card schema", () => {
  it("accepts a complete card and fills defaults", () => {
    const r = validateCard(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ effort: "M", risk: "medium" });
  });

  it("refuses a card without evidence", () => {
    const r = validateCard({ ...good, evidence: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/no evidence, no card/);
  });

  it("refuses a metric without a source and reports every problem at once", () => {
    const r = validateCard({ ...good, title: "", tier: "L9", evidence: [{ type: "metric", value: 3 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("title: required");
      expect(r.errors.some((e) => e.startsWith("tier:"))).toBe(true);
      expect(r.errors.some((e) => e.includes("needs a source"))).toBe(true);
    }
  });

  it("only lets the right actor move a card", () => {
    expect(canTransition("proposed", "approved", "owner")).toBe(true);
    expect(canTransition("proposed", "approved", "agent")).toBe(false);
    expect(canTransition("approved", "building", "runner")).toBe(true);
    expect(canTransition("shipped", "proposed", "owner")).toBe(false);
  });
});

describe("policy", () => {
  it("merges root and project files; a project can only be stricter", () => {
    const r = buildPolicy([root, alpha]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.repo).toBe("acme/mono");
    expect(r.value.projects.alpha.tier_ceiling).toBe("L1");
    expect(r.value.projects.alpha.verbs.release).toEqual({ tier: "L3", runs_on: "mac-runner", needs: [] });
    expect(r.value.projects.alpha.verbs.verify.tier).toBe("L0");
    const loose = buildPolicy([{ ...root, frontmatter: { ...root.frontmatter, tier_ceiling: "L2" } }, { ...alpha, frontmatter: { hq: 1, tier_ceiling: "L0" } }]);
    if (loose.ok) expect(loose.value.projects.alpha.tier_ceiling).toBe("L2");
  });

  it("rejects bad frontmatter with the file named", () => {
    const r = buildPolicy([root, { ...alpha, frontmatter: { hq: 1, push: true, verbs: { deploy: { tier: "L1" } } } as never }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/projects\/alpha\/.hq\/HQ.md: "push" is only allowed in the root/);
      expect(r.errors.join("\n")).toMatch(/verbs.deploy: declared but .hq\/bin\/deploy is missing/);
    }
  });

  it("needs a root file", () => {
    const r = buildPolicy([alpha]);
    expect(r.ok).toBe(false);
  });

  it("enforces the tier ceiling, policy cards and verbs on cards", () => {
    const r = buildPolicy([root, alpha]);
    if (!r.ok) throw new Error(r.errors.join());
    const p = r.value;
    expect(checkCardAgainstPolicy(good, p)).toEqual([]);
    expect(checkCardAgainstPolicy({ ...good, tier: "L0" }, p).join()).toMatch(/at most L1 autonomy/);
    expect(checkCardAgainstPolicy({ ...good, kind: "policy", tier: "L2" }, p).join()).toMatch(/always L3/);
    expect(checkCardAgainstPolicy({ ...good, verbs: ["deploy"] }, p).join()).toMatch(/no verb "deploy"/);
    expect(checkCardAgainstPolicy({ ...good, project: "beta" }, p).join()).toMatch(/has no .hq\/HQ.md/);
    expect(checkCardAgainstPolicy({ ...good, project: "repo-wide", tier: "L0", verbs: [] }, p)).toEqual([]);
  });

  it("checks verbs: L0 runs, L1+ needs an approved card, L3 only for the owner", () => {
    const r = buildPolicy([root, alpha]);
    if (!r.ok) throw new Error();
    const p = r.value;
    expect(checkVerb({ project: "alpha", verb: "verify", dryRun: false }, p, "agent").allowed).toBe(true);
    expect(checkVerb({ project: "alpha", verb: "release", dryRun: true }, p, "agent").allowed).toBe(true);
    expect(checkVerb({ project: "alpha", verb: "release", dryRun: false, card: { tier: "L1", status: "approved", project: "alpha" } }, p, "runner").allowed).toBe(false);
    expect(checkVerb({ project: "alpha", verb: "release", dryRun: false }, p, "owner").allowed).toBe(true);
    expect(checkVerb({ project: "alpha", verb: "nope", dryRun: false }, p, "owner").allowed).toBe(false);
    const p2 = buildPolicy([root, { ...alpha, frontmatter: { ...alpha.frontmatter, verbs: { release: { tier: "L1" } } } }]);
    if (!p2.ok) throw new Error();
    expect(checkVerb({ project: "alpha", verb: "release", dryRun: false }, p2.value, "runner").allowed).toBe(false);
    expect(checkVerb({ project: "alpha", verb: "release", dryRun: false, card: { tier: "L1", status: "approved", project: "alpha" } }, p2.value, "runner").allowed).toBe(true);
    expect(checkVerb({ project: "alpha", verb: "release", dryRun: false, card: { tier: "L1", status: "proposed", project: "alpha" } }, p2.value, "runner").allowed).toBe(false);
  });

  it("budget and schedules", () => {
    expect(overBudget(20, { weekly_budget_usd: 20 })).toBe(true);
    expect(overBudget(19.9, { weekly_budget_usd: 20 })).toBe(false);
    expect(overBudget(1000, { weekly_budget_usd: 0 })).toBe(false);
    const now = new Date("2026-11-08T12:00:00Z");
    expect(isDue("daily", null, now)).toBe(true);
    expect(isDue("daily", new Date("2026-11-08T00:00:00Z"), now)).toBe(false);
    expect(isDue("daily", new Date("2026-11-07T12:02:00Z"), now)).toBe(true);
    expect(isDue("manual", null, now)).toBe(false);
  });
});

describe("context", () => {
  it("scopes state to the project and renders markdown with the rules", () => {
    const r = buildPolicy([root, alpha]);
    if (!r.ok) throw new Error();
    const state = {
      paused: false,
      spent_this_week_usd: 5,
      open_prs: 0,
      open_cards: [
        { id: "a1", project: "alpha", title: "A", status: "proposed" as const, tier: "L1" as const, kind: "reliability" as const, priority: 1, dedupe_key: null },
        { id: "b1", project: "beta", title: "B", status: "proposed" as const, tier: "L1" as const, kind: "reliability" as const, priority: 1, dedupe_key: null },
      ],
      recent_decisions: [],
    };
    const c = buildContext(r.value, "alpha", state);
    expect(c.state.open_cards.map((x) => x.id)).toEqual(["a1"]);
    expect(c.limits.budget_left_usd).toBe(15);
    expect(c.never).toEqual(["live-orders"]);
    const md = contextMarkdown(c);
    expect(md).toContain("Alpha guidance.");
    expect(md).toContain("hq.create_proposal");
    expect(buildContext(r.value, null, state).state.open_cards).toHaveLength(2);
  });
});
