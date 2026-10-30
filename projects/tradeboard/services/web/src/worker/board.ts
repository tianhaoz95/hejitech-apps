// Plan operations shared by the Board MCP (agents) and the portal (the owner): the same functions,
// the same rows, so the two can't diverge (§5.2.1). Each takes the caller's identity; what a caller
// may do at all is decided by the route (mcp.ts has no approve, policy or executor tool).
import {
  ANCHORS, checkPlanFields, diffSummary, labelQuoteSource, planFieldsFrom, validity, type AuthorType, type PlanFields, type Status,
} from "@tradeboard/core";
import { rpc, sweep, type Db, type Failed } from "./store.ts";

export interface Actor {
  type: Extract<AuthorType, "human" | "agent">;
  /** "owner" for the human, else the registered agent id. */
  id: string;
}

export interface PlanRow {
  plan_id: string;
  title: string;
  status: Status;
  ticker: string;
  side: string;
  order_ticket: PlanFields["order"];
  thesis: string;
  evidence: string;
  risks_and_dissent: string;
  invalidation: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  created_by_type: "human" | "agent";
  created_by_id: string;
  valid_from: string | null;
  valid_until: string;
  quote_at: string | null;
  quote_price: number | null;
  quote_source: string | null;
  current_version: number;
  approval_id: string | null;
  executor_claim_id: string | null;
  claim_executor_id: string | null;
  claim_expires_at: string | null;
  claim_idempotency_key: string | null;
  attempt_started_at: string | null;
  awaiting_manual: boolean;
  reason_code: string | null;
  reason_text: string | null;
  is_demo: boolean;
}

export interface CommentRow {
  comment_id: string;
  plan_id: string;
  version: number;
  author_type: AuthorType;
  author_id: string;
  body: string;
  anchor: string;
  parent_comment_id: string | null;
  mentioned_agent_id: string | null;
  is_question: boolean;
  question_status: "open" | "resolved" | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Failed };
const bad = (error_code: string, message: string, extra: Record<string, unknown> = {}): { ok: false; error: Failed } => ({ ok: false, error: { ok: false, error_code, message, ...extra } });

export function fieldsOf(p: PlanRow): PlanFields {
  return {
    title: p.title, ticker: p.ticker, order: p.order_ticket, thesis: p.thesis, evidence: p.evidence, risks_and_dissent: p.risks_and_dissent,
    invalidation: p.invalidation, valid_from: p.valid_from, valid_until: p.valid_until,
    quote_price: p.quote_price === null ? null : Number(p.quote_price), quote_at: p.quote_at, quote_source: p.quote_source,
  };
}

/** Timestamps come back from Postgres as "+00:00"; send them as Z so every reply looks the same. */
export const utc = (s: string | null) => (s ? new Date(s).toISOString() : null);

const PG_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2})$/;
/** The same for timestamps nested in audit details (jsonb_build_object keeps Postgres's format). */
export function utcDeep<T>(v: T): T {
  if (typeof v === "string") return (PG_TIME.test(v) ? new Date(v).toISOString() : v) as T;
  if (Array.isArray(v)) return v.map(utcDeep) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, utcDeep(x)])) as T;
  return v;
}

// ---------------------------------------------------------------- writes

export async function createPlan(db: Db, actor: Actor, raw: Record<string, unknown>, opts: { idempotencyKey?: string } = {}): Promise<Result<{ plan_id: string; version: number; status: Status; duplicate: boolean }>> {
  const f = planFieldsFrom(raw);
  if (!raw.order || typeof raw.order !== "object") return bad("invalid_plan", "order (the order ticket) is required", { issues: [{ field: "order", code: "required", message: "order is required" }] });
  const issues = checkPlanFields(f, new Date(), { creating: true });
  if (issues.length) return bad("invalid_plan", issues.map((i) => i.message).join("; "), { issues });
  f.quote_source = labelQuoteSource(f.quote_source ?? (f.quote_price !== null ? (actor.type === "agent" ? "agent" : "owner") : null), actor.type);
  const key = opts.idempotencyKey ? String(opts.idempotencyKey).slice(0, 120) : null;
  const r = await rpc<{ plan_id: string; version: number; status: Status; duplicate: boolean }>(db, "create_plan", {
    p_fields: f, p_actor_type: actor.type, p_actor_id: actor.id, p_idempotency_key: key, p_is_demo: false,
  });
  return r.ok ? { ok: true, value: { plan_id: r.plan_id, version: r.version, status: r.status, duplicate: r.duplicate } } : { ok: false, error: r };
}

export async function updatePlan(db: Db, actor: Actor, planId: string, expectedVersion: unknown, raw: Record<string, unknown>): Promise<Result<{ plan_id: string; version: number; status: Status }>> {
  if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion)) return bad("expected_version_required", "send expected_version: the version you edited against");
  const p = await loadPlan(db, planId);
  if (!p) return bad("not_found", "no such plan");
  const allowed = ["title", "ticker", "order", "thesis", "evidence", "risks_and_dissent", "invalidation", "valid_from", "valid_until", "quote_price", "quote_at", "quote_source"];
  const unknown = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (unknown.length) return bad("unknown_fields", `these fields can't be edited: ${unknown.join(", ")}`);
  const before = fieldsOf(p);
  const after = planFieldsFrom(raw, before);
  // The ticket always follows the plan's ticker; a ticker edit without a matching ticket fails the check below.
  const issues = checkPlanFields(after, new Date(), { creating: false });
  if (issues.length) return bad("invalid_plan", issues.map((i) => i.message).join("; "), { issues });
  if ("quote_price" in raw || "quote_source" in raw) after.quote_source = labelQuoteSource(after.quote_source ?? (actor.type === "agent" ? "agent" : "owner"), actor.type);
  const diff = diffSummary(before, after);
  if (diff === "no material change") return bad("no_change", "nothing changed");
  const r = await rpc<{ plan_id: string; version: number; status: Status }>(db, "update_plan", {
    p_plan_id: planId, p_expected_version: expectedVersion, p_fields: after, p_diff: diff, p_actor_type: actor.type, p_actor_id: actor.id,
  });
  return r.ok ? { ok: true, value: { plan_id: r.plan_id, version: r.version, status: r.status } } : { ok: false, error: r };
}

export async function addComment(db: Db, actor: Actor, planId: string, raw: { body?: unknown; anchor?: unknown; parent_comment_id?: unknown; mentioned_agent_id?: unknown }, isQuestion: boolean) {
  const body = String(raw.body ?? "").trim();
  if (!body) return bad("body_required", "body is required");
  if (body.length > 10_000) return bad("too_long", "body is at most 10,000 characters");
  const anchor = raw.anchor === undefined || raw.anchor === null ? "general" : String(raw.anchor);
  if (!(ANCHORS as readonly string[]).includes(anchor)) return bad("bad_anchor", `anchor must be one of ${ANCHORS.join(", ")}`);
  // @mentions in the text count too (§6.4); an explicit mentioned_agent_id wins.
  let mentioned = raw.mentioned_agent_id ? String(raw.mentioned_agent_id) : null;
  if (!mentioned) mentioned = /(?:^|\s)@([a-z][a-z0-9_-]{1,31})\b/.exec(body)?.[1] ?? null;
  if (mentioned) {
    const { data } = await db.from("agents").select("agent_id").eq("agent_id", mentioned).is("revoked_at", null).maybeSingle();
    if (!data) mentioned = raw.mentioned_agent_id ? mentioned : null; // an @word that isn't an agent is just text
  }
  const r = await rpc<{ comment_id: string; version: number; created_at: string; approval_voided: boolean; status: Status }>(db, "add_comment", {
    p_plan_id: planId, p_actor_type: actor.type, p_actor_id: actor.id, p_body: body, p_anchor: anchor,
    p_parent: raw.parent_comment_id ? String(raw.parent_comment_id) : null, p_is_question: isQuestion, p_mentioned: mentioned,
  });
  return r.ok ? { ok: true as const, value: { comment_id: r.comment_id, version: r.version, created_at: utc(r.created_at), approval_voided: r.approval_voided, status: r.status, mentioned_agent_id: mentioned } } : { ok: false as const, error: r };
}

export async function answerQuestion(db: Db, actor: Actor, questionId: string, body: unknown) {
  const { data: q } = await db.from("comments").select("comment_id, plan_id, is_question").eq("comment_id", questionId).maybeSingle();
  if (!q || !q.is_question) return bad("not_found", "no such question");
  return addComment(db, actor, q.plan_id as string, { body, parent_comment_id: questionId }, false);
}

export async function markReady(db: Db, actor: Actor, planId: string, maxAgeHours: number) {
  const r = await rpc<{ plan_id: string; version: number; status: Status }>(db, "mark_ready", { p_plan_id: planId, p_actor_type: actor.type, p_actor_id: actor.id, p_max_age_hours: maxAgeHours });
  return r.ok ? { ok: true as const, value: r } : { ok: false as const, error: r };
}

export async function requestChanges(db: Db, actor: Actor, planId: string, body: unknown) {
  const text = String(body ?? "").trim();
  if (!text) return bad("body_required", "say what must change");
  const r = await rpc<{ plan_id: string; status: Status }>(db, "request_changes", { p_plan_id: planId, p_actor_type: actor.type, p_actor_id: actor.id, p_body: text });
  return r.ok ? { ok: true as const, value: r } : { ok: false as const, error: r };
}

// ---------------------------------------------------------------- reads

export async function loadPlan(db: Db, planId: string): Promise<PlanRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return null;
  const { data } = await db.from("plans").select("*").eq("plan_id", planId).maybeSingle();
  return (data as PlanRow | null) ?? null;
}

export async function loadComments(db: Db, planId: string, opts: { anchor?: string; since?: string } = {}): Promise<CommentRow[]> {
  let q = db.from("comments").select("*").eq("plan_id", planId).order("created_at", { ascending: true }).limit(2000);
  if (opts.anchor) q = q.eq("anchor", opts.anchor);
  if (opts.since) q = q.gt("created_at", opts.since);
  const { data } = await q;
  return (data ?? []) as CommentRow[];
}

/** Open questions, the owner's first, each with whether its @mentioned agent has answered (§6.4). */
export function openQuestions(comments: CommentRow[]) {
  return comments
    .filter((c) => c.is_question && c.question_status === "open")
    .map((c) => {
      const replies = comments.filter((r) => r.parent_comment_id === c.comment_id);
      return {
        question_id: c.comment_id, body: c.body, anchor: c.anchor, asked_by: c.author_id, asked_by_type: c.author_type, asked_at: utc(c.created_at),
        blocking: c.author_type === "human", mentioned_agent_id: c.mentioned_agent_id,
        awaiting: c.mentioned_agent_id && !replies.some((r) => r.author_id === c.mentioned_agent_id) ? c.mentioned_agent_id : null,
        answers: replies.length,
      };
    })
    .sort((a, b) => Number(b.blocking) - Number(a.blocking) || a.asked_at!.localeCompare(b.asked_at!));
}

export function commentOut(c: CommentRow) {
  return {
    comment_id: c.comment_id, version: c.version, author_type: c.author_type, author_id: c.author_id, body: c.body, anchor: c.anchor,
    parent_comment_id: c.parent_comment_id, mentioned_agent_id: c.mentioned_agent_id, created_at: utc(c.created_at),
    ...(c.is_question ? { is_question: true, status: c.question_status, asked_by: c.author_id, asked_at: utc(c.created_at), resolved_by: c.resolved_by, resolved_at: utc(c.resolved_at), resolution_note: c.resolution_note } : { is_question: false }),
  };
}

/** Truncated order id for anyone but the plan's receipt detail (§11.6). */
export const shortOrderId = (id: string | null) => (id ? `${id.slice(0, 8)}…` : null);

export interface PlanViewOptions {
  /** The portal's plan page shows full order ids on receipts; agents and lists get truncated ones. */
  fullOrderIds?: boolean;
  forAgent?: string;
}

/** The plan document as every caller sees it: fields, ticket, validity, status, questions, log, receipt. */
export async function planView(db: Db, planId: string, opts: PlanViewOptions = {}) {
  await sweep(db);
  const p = await loadPlan(db, planId);
  if (!p) return null;
  const [comments, { data: approvals }, { data: receipts }, { data: versions }, { data: audit }] = await Promise.all([
    loadComments(db, planId),
    db.from("approvals").select("*").eq("plan_id", planId).order("approved_at"),
    db.from("receipts").select("*").eq("plan_id", planId).order("attempted_at"),
    db.from("plan_versions").select("version, edited_by_type, edited_by_id, edited_at, diff_summary").eq("plan_id", planId).order("version"),
    db.from("audit_log").select("event_id, actor_type, actor_id, action, details_json, created_at").eq("plan_id", planId).order("event_id").limit(500),
  ]);
  const now = new Date();
  const approval = (approvals ?? []).find((a) => a.approval_id === p.approval_id && !a.voided_at) ?? null;
  const receiptOut = (r: Record<string, unknown>) => ({
    receipt_id: r.receipt_id, version: r.version, executor_id: r.executor_id, attempted_at: utc(r.attempted_at as string), mode: r.mode, outcome: r.outcome,
    reason_code: r.reason_code, reason_text: r.reason_text,
    robinhood_order_id: opts.fullOrderIds ? r.robinhood_order_id : shortOrderId(r.robinhood_order_id as string | null),
    filled_quantity: r.filled_quantity === null ? null : Number(r.filled_quantity), filled_price: r.filled_price === null ? null : Number(r.filled_price),
    policy_snapshot_id: r.policy_snapshot_id,
  });
  const rs = (receipts ?? []).map(receiptOut);
  return {
    plan_id: p.plan_id, title: p.title, status: p.status, is_demo: p.is_demo, ticker: p.ticker, side: p.side, order: p.order_ticket,
    thesis: p.thesis, evidence: p.evidence, risks_and_dissent: p.risks_and_dissent, invalidation: p.invalidation,
    created_at: utc(p.created_at), updated_at: utc(p.updated_at), last_activity_at: utc(p.last_activity_at), created_by: { type: p.created_by_type, id: p.created_by_id },
    valid_from: utc(p.valid_from), valid_until: utc(p.valid_until), validity: validity(p.valid_from, p.valid_until, now),
    quote_at: utc(p.quote_at), quote_price: p.quote_price === null ? null : Number(p.quote_price), quote_source: p.quote_source,
    current_version: p.current_version,
    reason_code: p.reason_code, reason_text: p.reason_text, awaiting_manual: p.awaiting_manual,
    approval: approval ? { approval_id: approval.approval_id, version: approval.version, approved_at: utc(approval.approved_at), expires_at: utc(approval.expires_at), note: approval.note } : null,
    executor_claim: p.executor_claim_id ? { executor_id: p.claim_executor_id, expires_at: utc(p.claim_expires_at) } : null,
    open_questions: openQuestions(comments),
    comments: comments.map(commentOut),
    approvals: (approvals ?? []).map((a) => ({ approval_id: a.approval_id, version: a.version, approved_at: utc(a.approved_at), expires_at: utc(a.expires_at), note: a.note, voided_at: utc(a.voided_at), void_reason: a.void_reason })),
    versions: (versions ?? []).map((v) => ({ ...v, edited_at: utc(v.edited_at as string), current: v.version === p.current_version })),
    decision_log: (audit ?? []).map((e) => ({ event_id: e.event_id, actor_type: e.actor_type, actor_id: e.actor_id, action: e.action, details: utcDeep(e.details_json), at: utc(e.created_at) })),
    receipts: rs,
    latest_receipt: rs.at(-1) ?? null,
    ...(opts.forAgent ? { awaiting_you: openQuestions(comments).filter((q) => q.awaiting === opts.forAgent).map((q) => q.question_id) } : {}),
  };
}

export interface ListFilter {
  status?: string;
  ticker?: string;
  author_id?: string;
  limit?: number;
}

/** Plans newest-edited first, with status, validity countdown and open-question counts. */
export async function listPlans(db: Db, f: ListFilter, forAgent?: string) {
  await sweep(db);
  const limit = Math.min(Math.max(Number(f.limit ?? 20) || 20, 1), 100);
  let q = db.from("plans").select("plan_id, title, status, ticker, created_by_type, created_by_id, created_at, updated_at, last_activity_at, valid_from, valid_until, current_version, is_demo, reason_code, awaiting_manual, approval_id").order("updated_at", { ascending: false }).limit(limit);
  if (f.status) q = q.eq("status", f.status);
  if (f.ticker) q = q.eq("ticker", String(f.ticker).toUpperCase());
  if (f.author_id) q = q.eq("created_by_id", f.author_id);
  const { data } = await q;
  const plans = (data ?? []) as PlanRow[];
  const ids = plans.map((p) => p.plan_id);
  const { data: qs } = ids.length
    ? await db.from("comments").select("comment_id, plan_id, author_type, mentioned_agent_id, parent_comment_id, author_id, is_question, question_status").in("plan_id", ids).or("is_question.eq.true,parent_comment_id.not.is.null")
    : { data: [] };
  const rows = (qs ?? []) as CommentRow[];
  const now = new Date();
  return plans.map((p) => {
    const mine = rows.filter((c) => c.plan_id === p.plan_id);
    const open = mine.filter((c) => c.is_question && c.question_status === "open");
    const awaiting = open.filter((c) => c.mentioned_agent_id && !mine.some((r) => r.parent_comment_id === c.comment_id && r.author_id === c.mentioned_agent_id));
    return {
      plan_id: p.plan_id, title: p.title, status: p.status, ticker: p.ticker, is_demo: p.is_demo, author: { type: p.created_by_type, id: p.created_by_id },
      current_version: p.current_version, created_at: utc(p.created_at), updated_at: utc(p.updated_at), last_activity_at: utc(p.last_activity_at),
      valid_from: utc(p.valid_from), valid_until: utc(p.valid_until), validity: validity(p.valid_from, p.valid_until, now),
      expires_in_ms: new Date(p.valid_until).getTime() - now.getTime(),
      open_questions: open.length, open_human_questions: open.filter((c) => c.author_type === "human").length,
      awaiting_agents: [...new Set(awaiting.map((c) => c.mentioned_agent_id!))],
      reason_code: p.reason_code, awaiting_manual: p.awaiting_manual,
      ...(forAgent ? { awaiting_you: awaiting.filter((c) => c.mentioned_agent_id === forAgent).length } : {}),
    };
  });
}

export async function auditFor(db: Db, planId: string, limit = 200) {
  const { data } = await db.from("audit_log").select("event_id, actor_type, actor_id, action, details_json, created_at").eq("plan_id", planId).order("event_id").limit(Math.min(Math.max(limit, 1), 1000));
  return (data ?? []).map((e) => ({ event_id: e.event_id, actor_type: e.actor_type, actor_id: e.actor_id, action: e.action, details: utcDeep(e.details_json), at: utc(e.created_at) }));
}
