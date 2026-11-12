// The proposal card: the one format every scout, the CEO, executors, the Worker, the portal and the
// iOS app speak (PRD §4). validateCard() is the server's gate in hq.create_proposal: a card without
// evidence, a plan or a way to verify it is refused.
//
// `why`, `plan` and `verify` (and comments) are markdown (markdown.ts renders them, raw HTML never
// passes). Drawings travel apart from the text as `figures`: static HTML/SVG that the portal and
// the app show in a sandboxed frame with no scripts and no network, placed by `![title](figure:id)`.

export const TIERS = ["L0", "L1", "L2", "L3"] as const;
export type Tier = (typeof TIERS)[number];

export const KINDS = ["maintenance", "reliability", "performance", "opportunity", "portfolio", "policy"] as const;
export type Kind = (typeof KINDS)[number];

export const EFFORTS = ["S", "M", "L"] as const;
export type Effort = (typeof EFFORTS)[number];

export const RISKS = ["low", "medium", "high"] as const;
export type Risk = (typeof RISKS)[number];

export const EVIDENCE_TYPES = ["ci_run", "metric", "link", "log", "test", "screenshot", "commit", "file", "review", "request"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** Lifecycle (PRD §4). L0 cards skip `proposed` and start at `approved`. */
export const STATUSES = [
  "proposed", // waiting for the owner (or the CEO's ranking)
  "discussing", // the owner asked a question; the writing agent answers
  "approved", // waiting for an executor
  "building", // an executor claimed it
  "in_review", // built; evidence attached; waiting for the owner to merge/ship
  "shipped",
  "rejected",
  "failed",
  "withdrawn", // superseded or duplicate (set by the CEO or the scout)
] as const;
export type Status = (typeof STATUSES)[number];

export const OPEN_STATUSES: readonly Status[] = ["proposed", "discussing", "approved", "building", "in_review"];

export interface Evidence {
  type: EvidenceType;
  /** A URL, commit sha, file path or run id. */
  ref?: string;
  /** Free text: a log excerpt, a test name, the reviewer's verdict. */
  text?: string;
  name?: string;
  value?: number;
  unit?: string;
  /** Where a number came from ("last 10 runs", "bench/launch.mjs on iPhone 16"). Required for metrics. */
  source?: string;
}

/** A static drawing (HTML, CSS, inline SVG) shown in a sandboxed frame. */
export interface Figure {
  /** Referenced from markdown as `![title](figure:<id>)`. */
  id: string;
  title: string;
  /** Empty in card lists: only a card's detail carries the drawing. */
  html: string;
  /** Height of the frame in CSS pixels; content taller than this scrolls inside it. */
  height: number;
}

export const FIGURE_LIMITS = { count: 6, html: 60_000, title: 120, minHeight: 80, maxHeight: 1200, defaultHeight: 360 } as const;

export interface CardSource {
  scout?: string;
  agent?: string;
  session?: string;
}

/** What an agent submits. The server adds id, repo, status, priority and timestamps. */
export interface CardInput {
  project: string;
  kind: Kind;
  title: string;
  why: string;
  evidence: Evidence[];
  plan: string;
  verify: string;
  tier: Tier;
  effort?: Effort;
  risk?: Risk;
  risk_reason?: string;
  verbs?: string[];
  source?: CardSource;
  /** A stable key for "the same finding" so a scout re-running daily doesn't duplicate its card. */
  dedupe_key?: string;
  /** Drawings the markdown fields place with `![title](figure:<id>)`. */
  figures?: Figure[];
  /** The owner's request (request.ts) this card answers. */
  request_id?: string;
}

export interface Card extends Required<Pick<CardInput, "project" | "kind" | "title" | "why" | "evidence" | "plan" | "verify" | "tier">> {
  id: string;
  repo: string;
  effort: Effort;
  risk: Risk;
  risk_reason: string | null;
  verbs: string[];
  source: CardSource;
  dedupe_key: string | null;
  figures: Figure[];
  request_id: string | null;
  status: Status;
  /** Higher is more important; set by the CEO (rank_cards) or defaulted from tier/risk. */
  priority: number;
  /** "auto" for L0 cards approved by policy, else the decision's author. */
  decided_by: string | null;
  branch: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

export const LIMITS = { title: 120, why: 4000, plan: 6000, verify: 2000, evidence: 30, text: 8000 } as const;

export function validateEvidence(e: unknown, i = 0): string[] {
  const at = `evidence[${i}]`;
  if (!e || typeof e !== "object") return [`${at}: must be an object`];
  const x = e as Record<string, unknown>;
  const errs: string[] = [];
  if (!oneOf(EVIDENCE_TYPES, x.type)) errs.push(`${at}.type: one of ${EVIDENCE_TYPES.join(", ")}`);
  if (!isStr(x.ref) && !isStr(x.text) && typeof x.value !== "number") errs.push(`${at}: needs ref, text or value`);
  if (x.type === "metric") {
    if (typeof x.value !== "number" || !Number.isFinite(x.value)) errs.push(`${at}: a metric needs a numeric value`);
    if (!isStr(x.source)) errs.push(`${at}: a metric needs a source (how and where it was measured)`);
  }
  if (typeof x.text === "string" && x.text.length > LIMITS.text) errs.push(`${at}.text: at most ${LIMITS.text} characters`);
  return errs;
}

/** What a frame without scripts or network can't use, refused so the agent hears about it. */
const FIGURE_BANNED: [RegExp, string][] = [
  [/<\s*(script|iframe|frame|object|embed|link|meta|base|form)\b/i, "only static HTML, CSS and inline SVG (no script, frame, object, embed, link, meta, base or form elements)"],
  [/\son[a-z]+\s*=\s*["'{]/i, "no event handler attributes (scripts never run in a figure)"],
  [/javascript\s*:/i, "no javascript: URLs"],
  [/@import\b|url\(\s*["']?\s*(https?:)?\/\//i, "no network: inline every style and image (data: URLs are fine)"],
  [/\b(src|href|xlink:href)\s*=\s*["']?\s*(https?:)?\/\//i, "no network or links: inline images as data: URLs and put links in the card's text"],
];

export function validateFigure(f: unknown, i = 0): string[] {
  const at = `figures[${i}]`;
  if (!f || typeof f !== "object") return [`${at}: must be an object`];
  const x = f as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof x.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(x.id)) errs.push(`${at}.id: lowercase letters, digits and dashes (up to 40)`);
  if (!isStr(x.title)) errs.push(`${at}.title: required (shown where the drawing can't be)`);
  else if (x.title.length > FIGURE_LIMITS.title) errs.push(`${at}.title: at most ${FIGURE_LIMITS.title} characters`);
  if (!isStr(x.html)) errs.push(`${at}.html: required`);
  else {
    if (x.html.length > FIGURE_LIMITS.html) errs.push(`${at}.html: at most ${FIGURE_LIMITS.html} characters`);
    for (const [re, why] of FIGURE_BANNED) if (re.test(x.html)) errs.push(`${at}.html: ${why}`);
  }
  if (x.height !== undefined && (typeof x.height !== "number" || !Number.isFinite(x.height) || x.height < FIGURE_LIMITS.minHeight || x.height > FIGURE_LIMITS.maxHeight)) {
    errs.push(`${at}.height: ${FIGURE_LIMITS.minHeight}–${FIGURE_LIMITS.maxHeight} pixels`);
  }
  return errs;
}

/** The server-side gate. Returns a normalised input or every problem at once. */
export function validateCard(input: unknown): Result<CardInput> {
  if (!input || typeof input !== "object") return { ok: false, errors: ["card must be an object"] };
  const c = input as Record<string, unknown>;
  const errs: string[] = [];
  const need = (k: string, max: number) => {
    if (!isStr(c[k])) errs.push(`${k}: required`);
    else if ((c[k] as string).length > max) errs.push(`${k}: at most ${max} characters`);
  };
  if (!isStr(c.project) || !/^[a-z0-9][a-z0-9._-]*$/.test(c.project as string)) errs.push("project: required, a lowercase project name or \"repo-wide\"");
  if (!oneOf(KINDS, c.kind)) errs.push(`kind: one of ${KINDS.join(", ")}`);
  need("title", LIMITS.title);
  need("why", LIMITS.why);
  need("plan", LIMITS.plan);
  need("verify", LIMITS.verify);
  if (!oneOf(TIERS, c.tier)) errs.push(`tier: one of ${TIERS.join(", ")}`);
  if (c.effort !== undefined && !oneOf(EFFORTS, c.effort)) errs.push(`effort: one of ${EFFORTS.join(", ")}`);
  if (c.risk !== undefined && !oneOf(RISKS, c.risk)) errs.push(`risk: one of ${RISKS.join(", ")}`);
  if (!Array.isArray(c.evidence) || c.evidence.length === 0) errs.push("evidence: at least one item (no evidence, no card)");
  else if (c.evidence.length > LIMITS.evidence) errs.push(`evidence: at most ${LIMITS.evidence} items`);
  else c.evidence.forEach((e, i) => errs.push(...validateEvidence(e, i)));
  if (c.verbs !== undefined && (!Array.isArray(c.verbs) || !c.verbs.every((v) => typeof v === "string" && /^[a-z][a-z0-9-]*$/.test(v)))) errs.push("verbs: a list of verb names");
  if (c.dedupe_key !== undefined && (typeof c.dedupe_key !== "string" || c.dedupe_key.length > 200)) errs.push("dedupe_key: a string up to 200 characters");
  if (c.figures !== undefined) {
    if (!Array.isArray(c.figures)) errs.push("figures: a list of { id, title, html, height }");
    else if (c.figures.length > FIGURE_LIMITS.count) errs.push(`figures: at most ${FIGURE_LIMITS.count}`);
    else {
      c.figures.forEach((f, i) => errs.push(...validateFigure(f, i)));
      const ids = c.figures.map((f) => (f as Figure)?.id);
      if (new Set(ids).size !== ids.length) errs.push("figures: ids must be unique");
    }
  }
  if (c.request_id !== undefined && (typeof c.request_id !== "string" || !/^req-[\w-]{1,40}$/.test(c.request_id))) errs.push("request_id: the id of an owner request (req-…)");
  if (errs.length) return { ok: false, errors: errs };
  const src = (c.source ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    value: {
      project: c.project as string,
      kind: c.kind as Kind,
      title: (c.title as string).trim(),
      why: (c.why as string).trim(),
      evidence: (c.evidence as Evidence[]).map((e) => ({ ...e })),
      plan: (c.plan as string).trim(),
      verify: (c.verify as string).trim(),
      tier: c.tier as Tier,
      effort: (c.effort as Effort) ?? "M",
      risk: (c.risk as Risk) ?? "medium",
      risk_reason: typeof c.risk_reason === "string" ? c.risk_reason : undefined,
      verbs: (c.verbs as string[]) ?? [],
      source: {
        scout: typeof src.scout === "string" ? src.scout : undefined,
        agent: typeof src.agent === "string" ? src.agent : undefined,
        session: typeof src.session === "string" ? src.session : undefined,
      },
      dedupe_key: typeof c.dedupe_key === "string" ? c.dedupe_key : undefined,
      figures: ((c.figures as Figure[]) ?? []).map((f) => ({ id: f.id, title: f.title.trim(), html: f.html, height: Math.round(f.height ?? FIGURE_LIMITS.defaultHeight) })),
      request_id: typeof c.request_id === "string" ? c.request_id : undefined,
    },
  };
}

/** Default priority before the CEO ranks: reliability first, cheap and safe before expensive. */
export function defaultPriority(c: Pick<CardInput, "kind" | "effort" | "risk">): number {
  const kind: Record<Kind, number> = { reliability: 50, maintenance: 35, performance: 30, opportunity: 25, portfolio: 15, policy: 40 };
  const effort = { S: 10, M: 5, L: 0 }[c.effort ?? "M"];
  const risk = { low: 5, medium: 0, high: -5 }[c.risk ?? "medium"];
  return kind[c.kind] + effort + risk;
}

/** Which status changes are allowed, and who may make them. */
export type Actor = "owner" | "agent" | "runner" | "system";
const TRANSITIONS: Record<Status, Partial<Record<Status, Actor[]>>> = {
  proposed: { approved: ["owner", "system"], rejected: ["owner"], discussing: ["owner"], withdrawn: ["agent", "owner", "runner"] },
  discussing: { proposed: ["agent", "owner", "runner"], approved: ["owner"], rejected: ["owner"], withdrawn: ["agent", "owner", "runner"] },
  approved: { building: ["runner"], rejected: ["owner"], withdrawn: ["owner"] },
  building: { in_review: ["runner"], failed: ["runner", "owner"], approved: ["runner", "owner"] },
  in_review: { shipped: ["owner", "runner"], rejected: ["owner"], approved: ["owner"], failed: ["owner", "runner"] },
  shipped: {},
  rejected: { proposed: ["owner"] },
  failed: { approved: ["owner"], withdrawn: ["owner"] },
  withdrawn: {},
};

export function canTransition(from: Status, to: Status, actor: Actor): boolean {
  return (TRANSITIONS[from][to] ?? []).includes(actor);
}

export const REJECT_REASONS = [
  "not worth it",
  "wrong priority now",
  "evidence is weak",
  "already handled",
  "too risky",
  "do it differently",
  "don't propose this kind again",
] as const;
