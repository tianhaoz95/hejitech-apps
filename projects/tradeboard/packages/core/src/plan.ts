// Plans: fields, the state machine's vocabulary (§6.3), input checks shared by MCP and the portal,
// and the version diff summary (§6.4). The transitions themselves run in Postgres functions
// (supabase/schemas/tradeboard) so races can't break them; this file says what is valid.
import { checkTicket, normalizeTicket, TICKER_RE, type Issue, type OrderTicket } from "./ticket.ts";

export const STATUSES = ["draft", "debated", "ready", "approved", "validated", "executing", "executed", "failed", "rejected", "cancelled", "stale", "expired"] as const;
export type Status = (typeof STATUSES)[number];

/** No way out of these (a new plan is needed). */
export const TERMINAL: readonly Status[] = ["executed", "failed", "cancelled"];
/** A new version (edit) brings these back to `debated`. */
export const REOPENABLE: readonly Status[] = ["rejected", "stale", "expired"];

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft", debated: "Debated", ready: "Ready", approved: "Approved", validated: "Validated", executing: "Executing",
  executed: "Executed", failed: "Failed", rejected: "Rejected", cancelled: "Cancelled", stale: "Stale", expired: "Expired",
};

export const ANCHORS = ["thesis", "evidence", "risks_and_dissent", "invalidation", "fit_with_strategy", "order", "general"] as const;
export type Anchor = (typeof ANCHORS)[number];

export type AuthorType = "human" | "agent" | "executor" | "system";

/** Registered agent names: lowercase, 2–32 chars. A few words are reserved so nobody can pose as the owner. */
export const AGENT_ID_RE = /^[a-z][a-z0-9_-]{1,31}$/;
export const RESERVED_AGENT_IDS = new Set(["human", "owner", "you", "me", "executor", "system", "admin", "root", "portal", "board"]);

export function checkAgentId(id: string): string | null {
  if (!AGENT_ID_RE.test(id)) return "agent ids are 2–32 lowercase letters, digits, - or _, starting with a letter";
  if (RESERVED_AGENT_IDS.has(id)) return `"${id}" is reserved`;
  return null;
}

/** The plan fields an author writes. Server-set fields (ids, timestamps, status, version) aren't here. */
export interface PlanFields {
  title: string;
  ticker: string;
  order: OrderTicket;
  thesis: string;
  evidence: string;
  risks_and_dissent: string;
  invalidation: string;
  /** How the plan fits the user's strategy document (or why it departs from it). */
  fit_with_strategy: string;
  valid_from: string | null;
  valid_until: string;
  quote_price: number | null;
  quote_at: string | null;
  quote_source: string | null;
}

/** Edits to any of these create a version, void approval and send the plan back to `debated` (§6.3). */
export const MATERIAL_FIELDS = ["title", "ticker", "order", "thesis", "evidence", "risks_and_dissent", "invalidation", "fit_with_strategy", "valid_from", "valid_until", "quote_price", "quote_at", "quote_source"] as const;
export type MaterialField = (typeof MATERIAL_FIELDS)[number];

export const LIMITS = { title: 120, text: 20_000, comment: 10_000, quoteSource: 80 };

const isIso = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s));
/** Times must carry a zone (Z or ±hh:mm): a bare local time could be read as PT or ET. */
const hasZone = (s: string) => /(Z|[+-]\d{2}:?\d{2})$/.test(s);

/**
 * Checks a full set of plan fields (create, or the merged result of an update). Quote prices the
 * agent supplies are labelled unverified: only the executor's Robinhood read is a verified quote.
 */
export function checkPlanFields(f: PlanFields, now: Date, opts: { creating: boolean }): Issue[] {
  const issues: Issue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });
  if (!f.title?.trim()) add("title", "required", "title is required");
  else if (f.title.length > LIMITS.title) add("title", "too_long", `title is at most ${LIMITS.title} characters`);
  if (!TICKER_RE.test(f.ticker ?? "")) add("ticker", "ticker_format", "ticker must be an uppercase exchange symbol like AAPL or BRK.B");
  if (!f.thesis?.trim()) add("thesis", "required", "thesis is required");
  for (const k of ["thesis", "evidence", "risks_and_dissent", "invalidation", "fit_with_strategy"] as const) {
    if ((f[k] ?? "").length > LIMITS.text) add(k, "too_long", `${k} is at most ${LIMITS.text} characters`);
  }
  issues.push(...checkTicket(f.order, f.ticker));
  if (!f.valid_until) add("valid_until", "required", "valid_until is required: plans never default to no expiry");
  else if (!isIso(f.valid_until) || !hasZone(f.valid_until)) add("valid_until", "format", "valid_until must be ISO-8601 with a zone, e.g. 2026-10-30T20:00:00Z");
  else if (Date.parse(f.valid_until) <= now.getTime()) add("valid_until", opts.creating ? "in_past" : "in_past", "valid_until must be in the future");
  if (f.valid_from !== null && f.valid_from !== undefined) {
    if (!isIso(f.valid_from) || !hasZone(f.valid_from)) add("valid_from", "format", "valid_from must be ISO-8601 with a zone");
    else if (isIso(f.valid_until) && Date.parse(f.valid_from) >= Date.parse(f.valid_until)) add("valid_from", "order", "valid_from must be before valid_until");
  }
  if (f.quote_price !== null && f.quote_price !== undefined && !(typeof f.quote_price === "number" && f.quote_price > 0)) add("quote_price", "positive", "quote_price must be a positive number");
  if (f.quote_at !== null && f.quote_at !== undefined && (!isIso(f.quote_at) || !hasZone(f.quote_at))) add("quote_at", "format", "quote_at must be ISO-8601 with a zone");
  if (f.quote_price !== null && f.quote_price !== undefined && !f.quote_at) add("quote_at", "required", "quote_at is required with quote_price");
  if ((f.quote_source ?? "").length > LIMITS.quoteSource) add("quote_source", "too_long", `quote_source is at most ${LIMITS.quoteSource} characters`);
  if (f.order?.order_type === "market" && f.quote_price === null) add("quote_price", "market_needs_quote", "market orders need quote_price (the price the plan was built on) for the drift check");
  return issues;
}

/** Turns raw tool/portal input into plan fields, filling optional text with "". */
export function planFieldsFrom(raw: Record<string, unknown>, base?: PlanFields): PlanFields {
  const text = (k: string, fallback: string) => (raw[k] === undefined ? fallback : String(raw[k] ?? ""));
  const opt = <T>(k: string, fallback: T | null, conv: (v: unknown) => T): T | null => (raw[k] === undefined ? fallback : raw[k] === null || raw[k] === "" ? null : conv(raw[k]));
  const ticker = raw.ticker === undefined ? base?.ticker ?? "" : String(raw.ticker ?? "").trim().toUpperCase();
  return {
    title: text("title", base?.title ?? "").trim(),
    ticker,
    order: raw.order === undefined ? (base?.order as OrderTicket) : normalizeTicket(raw.order),
    thesis: text("thesis", base?.thesis ?? ""),
    evidence: text("evidence", base?.evidence ?? ""),
    risks_and_dissent: text("risks_and_dissent", base?.risks_and_dissent ?? ""),
    invalidation: text("invalidation", base?.invalidation ?? ""),
    fit_with_strategy: text("fit_with_strategy", base?.fit_with_strategy ?? ""),
    valid_from: opt("valid_from", base?.valid_from ?? null, String),
    valid_until: text("valid_until", base?.valid_until ?? ""),
    quote_price: opt("quote_price", base?.quote_price ?? null, Number),
    quote_at: opt("quote_at", base?.quote_at ?? null, String),
    quote_source: opt("quote_source", base?.quote_source ?? null, String),
  };
}

/** Quotes an agent typed in are never presented as verified. */
export function labelQuoteSource(source: string | null, authorType: AuthorType): string | null {
  if (source === null) return null;
  if (authorType === "agent" && !/unverified/i.test(source)) return `${source} (agent-provided, unverified)`;
  return source;
}

/** "order.limit_price 285 → 280; thesis edited". */
export function diffSummary(before: PlanFields, after: PlanFields): string {
  const out: string[] = [];
  for (const k of MATERIAL_FIELDS) {
    if (k === "order") {
      const a = before.order as unknown as Record<string, unknown>, b = after.order as unknown as Record<string, unknown>;
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if ((a[key] ?? null) !== (b[key] ?? null)) out.push(`order.${key} ${fmt(a[key])} → ${fmt(b[key])}`);
      }
      continue;
    }
    const a = before[k], b = after[k];
    if ((a ?? null) === (b ?? null)) continue;
    out.push(["thesis", "evidence", "risks_and_dissent", "invalidation", "fit_with_strategy"].includes(k) ? `${k} edited` : `${k} ${fmt(a)} → ${fmt(b)}`);
  }
  return out.length ? out.join("; ") : "no material change";
}

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : typeof v === "string" && v.length > 40 ? `${v.slice(0, 37)}…` : String(v));

/** Machine-readable reasons a plan is rejected or stopped (§6.3), shown in the portal and over MCP. */
export const REASON_CODES = [
  "human_rejected", "policy_rejected", "drift_rejected", "sanity_rejected", "wrong_account_rejected", "quote_unavailable",
  "market_closed", "paused", "killed", "approval_expired", "plan_changed", "open_questions", "stale_plan", "order_failed",
  "readback_mismatch", "proposal_only", "claim_expired", "live_trial_failed", "robinhood_error", "model_unavailable", "demo_plan",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
