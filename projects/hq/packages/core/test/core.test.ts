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
      open_requests: [
        { id: "req-1", project: null, body: "Propose a new logo", status: "open" as const, requested_by: "ann@example.com", claimed_by: null, claimed_until: null, created_at: "2026-11-11T00:00:00Z" },
        { id: "req-2", project: "beta", body: "Speed up launch", status: "open" as const, requested_by: "ann@example.com", claimed_by: null, claimed_until: null, created_at: "2026-11-11T00:00:00Z" },
      ],
    };
    const c = buildContext(r.value, "alpha", state);
    // A request without a project reaches every project's agents; another project's doesn't.
    expect(c.state.open_requests.map((x) => x.id)).toEqual(["req-1"]);
    expect(contextMarkdown(c)).toContain("req-1 [any project] from ann@example.com: Propose a new logo");
    expect(c.state.open_cards.map((x) => x.id)).toEqual(["a1"]);
    expect(c.limits.budget_left_usd).toBe(15);
    expect(c.never).toEqual(["live-orders"]);
    const md = contextMarkdown(c);
    expect(md).toContain("Alpha guidance.");
    expect(md).toContain("hq.create_proposal");
    expect(buildContext(r.value, null, state).state.open_cards).toHaveLength(2);
  });
});

import { can, isMember } from "../src/index.ts";

describe("roles", () => {
  it("admins administer, approvers decide, viewers read and comment", () => {
    expect(can("admin", "members") && can("admin", "tokens") && can("admin", "pause")).toBe(true);
    expect(can("approver", "decide") && can("approver", "run_l3_verb") && can("approver", "connect_agent")).toBe(true);
    expect(can("approver", "members") || can("approver", "tokens") || can("approver", "pause")).toBe(false);
    expect(can("viewer", "read") && can("viewer", "comment")).toBe(true);
    expect(can("viewer", "decide") || can("viewer", "run_verb") || can("viewer", "propose")).toBe(false);
  });
  it("tokens never decide or run L3 verbs; only runners claim and sync; only agents rank", () => {
    for (const r of ["runner", "agent"] as const) {
      expect(can(r, "decide") || can(r, "run_l3_verb") || can(r, "members") || can(r, "pause")).toBe(false);
      expect(isMember(r)).toBe(false);
    }
    expect(can("runner", "claim") && can("runner", "sync")).toBe(true);
    expect(can("agent", "claim") || can("agent", "sync")).toBe(false);
    expect(can("agent", "rank") && !can("runner", "rank")).toBe(true);
  });
});

import { figureDocument, figureRefs, isClaimable, plainText, renderMarkdown, validateFigure, validateRequest } from "../src/index.ts";

describe("markdown", () => {
  it("renders the usual blocks and inline styles", () => {
    const html = renderMarkdown("# Title\n\nSome **bold**, *soft*, `code` and a [link](https://example.com/a?b=1&c=2).\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\n> quoted\n\n```ts\nconst a = \"<b>\";\n```\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n---");
    expect(html).toContain("<h4>Title</h4>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>soft</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">link</a>');
    expect(html).toContain("<ul><li>one</li><li>");
    expect(html).toContain("<ul><li>nested</li></ul>");
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain("<blockquote><p>quoted</p></blockquote>");
    expect(html).toContain("<pre><code>const a = &quot;&lt;b&gt;&quot;;</code></pre>");
    expect(html).toContain('<td style="text-align:right">2</td>');
    expect(html).toContain("<hr>");
  });
  it("keeps plain text plain: single newlines break lines, snake_case stays", () => {
    expect(renderMarkdown("line one\nline two")).toBe("<p>line one<br>line two</p>");
    expect(renderMarkdown("run check_isolation_now.mjs")).toBe("<p>run check_isolation_now.mjs</p>");
  });
  it("never lets HTML, scripts or unsafe links through", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) [y](data:text/html,hi) ![z](https://evil.example/t.gif)\n\n<a href="https://a.example" onclick="x()">a</a>');
    // What isn't allowed stays visible as text; none of it becomes a tag or an address.
    expect(html).not.toMatch(/<script|<img|<a [^>]*on\w+=|href="(javascript|data):/);
    expect(html).toContain("&lt;script&gt;");
    // An image is never loaded: it becomes a link to it.
    expect(html).toContain('<a href="https://evil.example/t.gif" target="_blank" rel="noopener noreferrer nofollow">z</a>');
    // Every tag in the output is one the renderer writes.
    const tags = new Set([...html.matchAll(/<\/?([a-z0-9]+)/g)].map((m) => m[1]));
    for (const t of tags) expect(["p", "a", "br"]).toContain(t);
  });
  it("places figures by reference and reads as one plain line", () => {
    const md = "The flow today:\n\n![Request flow](figure:flow)\n\nSee `store.ts`.";
    expect(renderMarkdown(md)).toContain('<div class="md-figure" data-figure="flow" data-title="Request flow"></div>');
    expect(figureRefs(md)).toEqual(["flow"]);
    expect(plainText("## Why\n\nThe **build** fails in `ci.yml`, see [run](https://x.example/1).\n- twice")).toBe("Why The build fails in ci.yml, see run. twice");
    expect(plainText("a".repeat(300), 20)).toHaveLength(20);
  });
});

describe("figures", () => {
  const fig = { id: "flow", title: "Request flow", html: '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="var(--soft)"/></svg>', height: 200 };
  it("accepts static HTML and SVG, with limits", () => {
    expect(validateFigure(fig)).toEqual([]);
    expect(validateFigure({ ...fig, html: "<div style=\"display:flex\"><button>Approve</button><input value=\"x\"></div>" })).toEqual([]);
    const r = validateCard({ ...good, figures: [fig] });
    expect(r.ok && r.value.figures?.[0].height).toBe(200);
    expect(validateCard({ ...good, figures: [fig, fig] }).ok).toBe(false);
    expect(validateCard({ ...good, figures: Array.from({ length: 7 }, (_, i) => ({ ...fig, id: `f${i}` })) }).ok).toBe(false);
    expect(validateFigure({ ...fig, height: 5000 })).toHaveLength(1);
    expect(validateFigure({ ...fig, title: "" })).toHaveLength(1);
    expect(validateFigure({ ...fig, id: "Bad Id" })).toHaveLength(1);
  });
  it("refuses scripts, frames, handlers and anything from the network", () => {
    for (const html of [
      "<script>alert(1)</script>", "<SCRIPT src=x></SCRIPT>", '<iframe src="https://a.example"></iframe>', '<img src="https://a.example/x.png">', "<img src=//a.example/x.png>",
      '<div onclick="x()">a</div>', '<a href="javascript:alert(1)">a</a>', '<a href="https://a.example">a</a>', "<style>@import 'x.css';</style>",
      '<div style="background:url(https://a.example/x.png)"></div>', '<meta http-equiv="refresh" content="0;url=https://a.example">', '<form action="/x"></form>', '<base href="/">',
    ]) expect(validateFigure({ ...fig, html }), html).not.toEqual([]);
  });
  it("is shown in a document with no scripts and no network", () => {
    const doc = figureDocument(fig.html);
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toContain("script-src");
    expect(doc).toContain(fig.html);
  });
});

describe("requests", () => {
  it("need words; the project is optional", () => {
    expect(validateRequest({ body: "  " }).ok).toBe(false);
    expect(validateRequest({ body: "x".repeat(4001) }).ok).toBe(false);
    const r = validateRequest({ body: " Propose a new logo ", project: "repo-wide" });
    expect(r.ok && r.value).toEqual({ body: "Propose a new logo", project: null });
    expect(validateRequest({ body: "x", project: "Bad Name" }).ok).toBe(false);
    expect(validateCard({ ...good, request_id: "req-20261111-abcd" }).ok).toBe(true);
    expect(validateCard({ ...good, request_id: "nope" }).ok).toBe(false);
  });
  it("can be claimed when open or when the lease ran out", () => {
    const at = new Date("2026-11-11T12:00:00Z");
    expect(isClaimable({ status: "open", claimed_until: null }, at)).toBe(true);
    expect(isClaimable({ status: "claimed", claimed_until: "2026-11-11T12:10:00Z" }, at)).toBe(false);
    expect(isClaimable({ status: "claimed", claimed_until: "2026-11-11T11:59:00Z" }, at)).toBe(true);
    expect(isClaimable({ status: "answered", claimed_until: null }, at)).toBe(false);
  });
  it("only admins and approvers ask; only agents and runners answer", () => {
    expect(can("admin", "request") && can("approver", "request")).toBe(true);
    expect(can("viewer", "request") || can("agent", "request") || can("runner", "request")).toBe(false);
    expect(can("agent", "answer_request") && can("runner", "answer_request")).toBe(true);
    expect(can("admin", "answer_request") || can("viewer", "answer_request")).toBe(false);
  });
});
