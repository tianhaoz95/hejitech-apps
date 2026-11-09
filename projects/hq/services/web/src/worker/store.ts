// HQ's domain operations on D1, shared by the REST API (portal, iOS, runner) and the MCP server.
// Every rule that matters is enforced here, whoever calls: the card gate, the tier ceiling, who may
// move a card, verb checks, the budget, the kill switch, WIP limits. Prose never guards anything.
import {
  buildContext,
  canTransition,
  checkCardAgainstPolicy,
  checkVerb,
  defaultPriority,
  isDue,
  OPEN_STATUSES,
  overBudget,
  validateCard,
  validateEvidence,
  type Actor,
  type Card,
  type Context,
  type Decision,
  type Evidence,
  type RepoPolicy,
  type Status,
} from "@hq/core";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  OAUTH_KV: KVNamespace;
  ASSETS: Fetcher;
  PUBLIC_URL: string;
  HQ_OWNER_TOKEN: string;
}

export type Role = "owner" | "runner" | "agent";
export interface Caller {
  role: Role;
  /** "owner", the token's name, or the OAuth client's name. */
  name: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message);
  }
}

export const now = () => new Date().toISOString();
const rand = (n: number) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
};
export const newCardId = () => `hq-${now().slice(0, 10).replace(/-/g, "")}-${rand(4)}`;
export const newRunId = () => `run-${rand(10)}`;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison for the owner token. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const actorOf = (c: Caller): Actor => (c.role === "owner" ? "owner" : c.role === "runner" ? "runner" : "agent");
const who = (c: Caller) => (c.role === "owner" ? "owner" : `${c.role}:${c.name}`);

// ── rows ───────────────────────────────────────────────────────────────────────────────────────

interface CardRow {
  id: string; repo: string; project: string; kind: string; title: string; why: string; evidence_json: string;
  plan: string; verify: string; tier: string; effort: string; risk: string; risk_reason: string | null;
  verbs_json: string; source_json: string; dedupe_key: string | null; status: string; priority: number;
  decided_by: string | null; branch: string | null; pr_url: string | null; created_at: string; updated_at: string;
}

const toCard = (r: CardRow): Card => ({
  id: r.id, repo: r.repo, project: r.project, kind: r.kind as Card["kind"], title: r.title, why: r.why,
  evidence: JSON.parse(r.evidence_json), plan: r.plan, verify: r.verify, tier: r.tier as Card["tier"],
  effort: r.effort as Card["effort"], risk: r.risk as Card["risk"], risk_reason: r.risk_reason,
  verbs: JSON.parse(r.verbs_json), source: JSON.parse(r.source_json), dedupe_key: r.dedupe_key,
  status: r.status as Status, priority: r.priority, decided_by: r.decided_by, branch: r.branch, pr_url: r.pr_url,
  created_at: r.created_at, updated_at: r.updated_at,
});

export interface Run {
  id: string; kind: string; project: string | null; scout: string | null; card_id: string | null; verb: string | null;
  args: Record<string, unknown>; runs_on: string; agent: string | null; status: string; requested_by: string;
  runner: string | null; created_at: string; started_at: string | null; finished_at: string | null;
  summary: string | null; output: string | null; cost_usd: number; session: string | null;
}
const toRun = (r: Record<string, unknown>): Run => ({ ...(r as unknown as Run), args: JSON.parse((r.args_json as string) || "{}") });

export async function audit(env: Env, caller: Caller | string, action: string, target: string | null, detail?: unknown) {
  await env.DB.prepare("INSERT INTO audit (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)")
    .bind(now(), typeof caller === "string" ? caller : who(caller), action, target, detail === undefined ? null : JSON.stringify(detail).slice(0, 4000))
    .run();
}

// ── config & settings ──────────────────────────────────────────────────────────────────────────

export async function getPolicy(env: Env): Promise<{ policy: RepoPolicy; commit_sha: string | null; synced_at: string } | null> {
  const row = await env.DB.prepare("SELECT policy_json, commit_sha, synced_at FROM config WHERE id = 1").first<{ policy_json: string; commit_sha: string | null; synced_at: string }>();
  return row ? { policy: JSON.parse(row.policy_json), commit_sha: row.commit_sha, synced_at: row.synced_at } : null;
}

export async function requirePolicy(env: Env): Promise<RepoPolicy> {
  const p = await getPolicy(env);
  if (!p) throw new HttpError(409, "HQ has no policy yet: run `hq sync` in the repo to upload its .hq/ folders");
  return p.policy;
}

export async function syncPolicy(env: Env, caller: Caller, policy: RepoPolicy, commit: string | null) {
  if (caller.role === "agent") throw new HttpError(403, "agents can't change policy; .hq/ changes are L3 (owner)");
  if (!policy || typeof policy.repo !== "string" || typeof policy.projects !== "object") throw new HttpError(400, "policy: expected the output of buildPolicy()");
  const before = await getPolicy(env);
  await env.DB.prepare("INSERT INTO config (id, policy_json, commit_sha, synced_at) VALUES (1, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET policy_json = excluded.policy_json, commit_sha = excluded.commit_sha, synced_at = excluded.synced_at")
    .bind(JSON.stringify(policy), commit, now())
    .run();
  await audit(env, caller, "policy.sync", policy.repo, { commit, projects: Object.keys(policy.projects), changed: before ? JSON.stringify(before.policy) !== JSON.stringify(policy) : true });
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return r?.value ?? null;
}
export async function setSetting(env: Env, caller: Caller, key: string, value: string) {
  if (caller.role !== "owner") throw new HttpError(403, "only the owner changes settings");
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, value).run();
  await audit(env, caller, "settings.set", key, value);
}
export const isPaused = async (env: Env) => (await getSetting(env, "paused")) === "1";

/** Monday 00:00 UTC of the current week. */
export function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString();
}
export async function spentThisWeek(env: Env): Promise<number> {
  const r = await env.DB.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS s FROM runs WHERE created_at >= ?").bind(weekStart()).first<{ s: number }>();
  return +(r?.s ?? 0).toFixed(4);
}

// ── context ────────────────────────────────────────────────────────────────────────────────────

export async function getContext(env: Env, project: string | null): Promise<Context> {
  const policy = await requirePolicy(env);
  if (project && project !== "repo-wide" && !policy.projects[project]) throw new HttpError(404, `unknown project ${project}`);
  const open = await env.DB.prepare(`SELECT id, project, title, status, tier, kind, priority, dedupe_key FROM cards WHERE status IN (${OPEN_STATUSES.map(() => "?").join(",")}) ORDER BY priority DESC LIMIT 200`)
    .bind(...OPEN_STATUSES)
    .all<Context["state"]["open_cards"][number]>();
  const decisions = await env.DB.prepare("SELECT d.card_id, c.title, c.project, c.kind, d.decision, d.reason, d.at FROM decisions d JOIN cards c ON c.id = d.card_id ORDER BY d.at DESC LIMIT 60").all<Decision>();
  const prs = await env.DB.prepare("SELECT COUNT(*) AS n FROM cards WHERE pr_url IS NOT NULL AND status IN ('building', 'in_review')").first<{ n: number }>();
  return buildContext(policy, project, {
    paused: await isPaused(env),
    spent_this_week_usd: await spentThisWeek(env),
    open_cards: open.results,
    open_prs: prs?.n ?? 0,
    recent_decisions: decisions.results,
  });
}

// ── cards ──────────────────────────────────────────────────────────────────────────────────────

export async function getCard(env: Env, id: string): Promise<Card> {
  const r = await env.DB.prepare("SELECT * FROM cards WHERE id = ?").bind(id).first<CardRow>();
  if (!r) throw new HttpError(404, `no card ${id}`);
  return toCard(r);
}

export async function cardDetail(env: Env, id: string) {
  const card = await getCard(env, id);
  const [comments, decisions, attachments, runs] = await Promise.all([
    env.DB.prepare("SELECT id, author, body, created_at FROM comments WHERE card_id = ? ORDER BY id").bind(id).all(),
    env.DB.prepare("SELECT decision, reason, by, at FROM decisions WHERE card_id = ? ORDER BY id").bind(id).all(),
    env.DB.prepare("SELECT id, phase, evidence_json, file_key, by, at FROM attachments WHERE card_id = ? ORDER BY id").bind(id).all<{ id: number; phase: string; evidence_json: string; file_key: string | null; by: string; at: string }>(),
    env.DB.prepare("SELECT id, kind, status, agent, created_at, finished_at, summary, cost_usd FROM runs WHERE card_id = ? ORDER BY created_at").bind(id).all(),
  ]);
  return {
    card,
    comments: comments.results,
    decisions: decisions.results,
    attachments: attachments.results.map((a) => ({ id: a.id, phase: a.phase, evidence: JSON.parse(a.evidence_json), file_key: a.file_key, by: a.by, at: a.at })),
    runs: runs.results,
  };
}

export async function listCards(env: Env, opts: { status?: string[]; project?: string; limit?: number }): Promise<Card[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.status?.length) { where.push(`status IN (${opts.status.map(() => "?").join(",")})`); args.push(...opts.status); }
  if (opts.project) { where.push("project = ?"); args.push(opts.project); }
  const sql = `SELECT * FROM cards ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY priority DESC, created_at DESC LIMIT ?`;
  const r = await env.DB.prepare(sql).bind(...args, Math.min(opts.limit ?? 100, 500)).all<CardRow>();
  return r.results.map(toCard);
}

/** The owner's inbox: what needs a human, capped so it stays a few minutes a day (PRD §9). */
export async function inbox(env: Env) {
  const policy = await requirePolicy(env);
  const proposed = await listCards(env, { status: ["proposed"], limit: 500 });
  const discussing = await listCards(env, { status: ["discussing"] });
  const ready = await listCards(env, { status: ["in_review"] });
  const cap = policy.inbox_cap;
  return {
    cap,
    decide: proposed.slice(0, cap),
    backlog: proposed.slice(cap),
    discussing,
    ready,
    working: await listCards(env, { status: ["approved", "building"] }),
  };
}

export async function createProposal(env: Env, caller: Caller, input: unknown) {
  const v = validateCard(input);
  if (!v.ok) throw new HttpError(422, "card refused", v.errors);
  const policy = await requirePolicy(env);
  const problems = checkCardAgainstPolicy(v.value, policy);
  if (problems.length) throw new HttpError(422, "card refused by policy", problems);
  const c = v.value;
  if (c.dedupe_key) {
    const dup = await env.DB.prepare(`SELECT id, status FROM cards WHERE dedupe_key = ? AND status IN (${OPEN_STATUSES.map(() => "?").join(",")})`).bind(c.dedupe_key, ...OPEN_STATUSES).first<{ id: string; status: string }>();
    if (dup) return { id: dup.id, status: dup.status, duplicate: true, note: `an open card already has dedupe_key ${c.dedupe_key}; comment on it instead` };
    const rejected = await env.DB.prepare("SELECT c.id, d.reason, d.at FROM cards c JOIN decisions d ON d.card_id = c.id WHERE c.dedupe_key = ? AND c.status = 'rejected' AND d.decision = 'rejected' ORDER BY d.at DESC LIMIT 1").bind(c.dedupe_key).first<{ id: string; reason: string | null; at: string }>();
    if (rejected && Date.now() - Date.parse(rejected.at) < 30 * 86400_000) {
      return { id: rejected.id, status: "rejected", duplicate: true, note: `the owner rejected this ${rejected.at.slice(0, 10)}${rejected.reason ? ` ("${rejected.reason}")` : ""}; not re-proposed within 30 days` };
    }
  }
  const id = newCardId();
  const t = now();
  // L0 = just do it: approved by policy, reported in the digest afterwards.
  const status: Status = c.tier === "L0" ? "approved" : "proposed";
  const source = { ...c.source, agent: c.source?.agent ?? caller.name };
  await env.DB.prepare(
    `INSERT INTO cards (id, repo, project, kind, title, why, evidence_json, plan, verify, tier, effort, risk, risk_reason, verbs_json, source_json, dedupe_key, status, priority, decided_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, policy.repo, c.project, c.kind, c.title, c.why, JSON.stringify(c.evidence), c.plan, c.verify, c.tier, c.effort ?? "M", c.risk ?? "medium", c.risk_reason ?? null,
      JSON.stringify(c.verbs ?? []), JSON.stringify(source), c.dedupe_key ?? null, status, defaultPriority(c), status === "approved" ? "auto" : null, t, t)
    .run();
  if (status === "approved") {
    await env.DB.prepare("INSERT INTO decisions (card_id, decision, reason, by, at) VALUES (?, 'approved', 'L0: approved by policy', 'auto', ?)").bind(id, t).run();
    await enqueueBuild(env, id, c.project, "system");
  }
  await audit(env, caller, "card.create", id, { tier: c.tier, project: c.project, status });
  return { id, status, duplicate: false };
}

export async function setStatus(env: Env, caller: Caller | "system", id: string, to: Status, patch: { branch?: string; pr_url?: string } = {}) {
  const card = await getCard(env, id);
  const actor: Actor = caller === "system" ? "system" : actorOf(caller);
  if (!canTransition(card.status, to, actor)) throw new HttpError(409, `${actor} can't move ${id} from ${card.status} to ${to}`);
  await env.DB.prepare("UPDATE cards SET status = ?, branch = COALESCE(?, branch), pr_url = COALESCE(?, pr_url), updated_at = ? WHERE id = ?")
    .bind(to, patch.branch ?? null, patch.pr_url ?? null, now(), id)
    .run();
  await audit(env, caller === "system" ? "system" : caller, "card.status", id, { from: card.status, to, ...patch });
  return { ...card, status: to };
}

export async function decide(env: Env, caller: Caller, id: string, decision: "approved" | "rejected", reason: string | null) {
  if (caller.role !== "owner") throw new HttpError(403, "only the owner approves or rejects; agents can't approve cards");
  const card = await setStatus(env, caller, id, decision);
  await env.DB.prepare("INSERT INTO decisions (card_id, decision, reason, by, at) VALUES (?, ?, ?, 'owner', ?)").bind(id, decision, reason, now()).run();
  await env.DB.prepare("UPDATE cards SET decided_by = 'owner' WHERE id = ?").bind(id).run();
  if (decision === "approved") await enqueueBuild(env, id, card.project, "owner");
  else await env.DB.prepare("UPDATE runs SET status = 'cancelled', finished_at = ? WHERE card_id = ? AND status = 'queued'").bind(now(), id).run();
  return getCard(env, id);
}

export async function comment(env: Env, caller: Caller, id: string, body: string) {
  if (!body?.trim()) throw new HttpError(400, "body: required");
  const card = await getCard(env, id);
  await env.DB.prepare("INSERT INTO comments (card_id, author, body, created_at) VALUES (?, ?, ?, ?)").bind(id, who(caller), body.trim().slice(0, 8000), now()).run();
  if (caller.role === "owner") {
    // The owner asked something: the card waits, and the agent that wrote it is asked to answer.
    if (card.status === "proposed") await setStatus(env, caller, id, "discussing");
    await enqueueRun(env, { kind: "reply", card_id: id, project: card.project, requested_by: "owner", agent: card.source.agent ?? null, session: card.source.session ?? null });
  } else if (card.status === "discussing") {
    await setStatus(env, caller, id, "proposed");
  }
  await audit(env, caller, "card.comment", id);
  return cardDetail(env, id);
}

export async function rankCards(env: Env, caller: Caller, ranks: { id: string; priority: number; reason?: string }[]) {
  if (caller.role === "runner") throw new HttpError(403, "ranking is the CEO's job");
  if (!Array.isArray(ranks) || ranks.length > 200) throw new HttpError(400, "ranks: a list of { id, priority }");
  for (const r of ranks) {
    if (typeof r.id !== "string" || !Number.isFinite(r.priority)) throw new HttpError(400, "each rank needs id and a numeric priority");
    await env.DB.prepare("UPDATE cards SET priority = ?, updated_at = ? WHERE id = ? AND status IN ('proposed', 'discussing')").bind(Math.round(r.priority), now(), r.id).run();
  }
  await audit(env, caller, "card.rank", null, ranks.map((r) => `${r.id}=${r.priority}`));
  return { ranked: ranks.length };
}

export async function withdraw(env: Env, caller: Caller, id: string, reason: string) {
  await setStatus(env, caller, id, "withdrawn");
  await env.DB.prepare("INSERT INTO comments (card_id, author, body, created_at) VALUES (?, ?, ?, ?)").bind(id, who(caller), `Withdrawn: ${reason || "no reason given"}`, now()).run();
  return getCard(env, id);
}

export async function attachEvidence(env: Env, caller: Caller, id: string, phase: string, evidence: Evidence, fileKey: string | null = null) {
  await getCard(env, id);
  if (!["build", "review", "proposal", "verb"].includes(phase)) throw new HttpError(400, "phase: build, review, proposal or verb");
  const errs = validateEvidence(evidence);
  if (errs.length && !fileKey) throw new HttpError(422, "evidence refused", errs);
  await env.DB.prepare("INSERT INTO attachments (card_id, phase, evidence_json, file_key, by, at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, phase, JSON.stringify(evidence), fileKey, who(caller), now())
    .run();
  return { ok: true };
}

// ── runs ───────────────────────────────────────────────────────────────────────────────────────

export async function enqueueRun(env: Env, r: { kind: string; project?: string | null; scout?: string | null; card_id?: string | null; verb?: string | null; args?: Record<string, unknown>; runs_on?: string; agent?: string | null; requested_by: string; session?: string | null }) {
  // One queued run per (kind, scout, project, card): re-enqueueing is a no-op.
  // Verb runs also differ by their arguments: a real run must never merge into a queued dry run.
  const dup = await env.DB.prepare("SELECT id FROM runs WHERE status IN ('queued', 'running') AND kind = ? AND COALESCE(scout, '') = ? AND COALESCE(project, '') = ? AND COALESCE(card_id, '') = ? AND COALESCE(verb, '') = ? AND (kind != 'verb' OR args_json = ?)")
    .bind(r.kind, r.scout ?? "", r.project ?? "", r.card_id ?? "", r.verb ?? "", JSON.stringify(r.args ?? {}))
    .first<{ id: string }>();
  if (dup) return dup.id;
  const id = newRunId();
  await env.DB.prepare("INSERT INTO runs (id, kind, project, scout, card_id, verb, args_json, runs_on, agent, status, requested_by, created_at, session) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)")
    .bind(id, r.kind, r.project ?? null, r.scout ?? null, r.card_id ?? null, r.verb ?? null, JSON.stringify(r.args ?? {}), r.runs_on ?? "any", r.agent ?? null, r.requested_by, now(), r.session ?? null)
    .run();
  return id;
}

async function enqueueBuild(env: Env, cardId: string, project: string, by: string) {
  const policy = await requirePolicy(env);
  return enqueueRun(env, { kind: "build", card_id: cardId, project, agent: policy.agents.executor, requested_by: by });
}

export async function requestVerb(env: Env, caller: Caller, project: string, verb: string, dryRun: boolean, cardId: string | null) {
  const policy = await requirePolicy(env);
  const card = cardId ? await getCard(env, cardId) : null;
  const check = checkVerb({ project, verb, dryRun, card: card && { tier: card.tier, status: card.status, project: card.project } }, policy, actorOf(caller) === "system" ? "runner" : (actorOf(caller) as "owner" | "agent" | "runner"));
  await audit(env, caller, check.allowed ? "verb.request" : "verb.refused", `${project}/${verb}`, { dryRun, cardId, reason: check.reason });
  if (!check.allowed) throw new HttpError(403, `refused: ${check.reason}`);
  if (!dryRun && (await isPaused(env)) && caller.role !== "owner") throw new HttpError(423, "HQ is paused");
  const id = await enqueueRun(env, { kind: "verb", project, verb, card_id: cardId, args: { dry_run: dryRun }, runs_on: check.policy?.runs_on ?? "any", requested_by: who(caller) });
  return { run_id: id, reason: check.reason };
}

/** A runner asks for work. Respects the kill switch, the budget (scouts only) and WIP limits. */
export async function claimRun(env: Env, caller: Caller, runner: string, capabilities: string[]) {
  if (caller.role !== "runner" && caller.role !== "owner") throw new HttpError(403, "runner token required");
  const asRunner: Caller = { role: "runner", name: runner };
  const paused = await isPaused(env);
  const policy = await requirePolicy(env);
  const spent = await spentThisWeek(env);
  const queued = await env.DB.prepare("SELECT * FROM runs WHERE status = 'queued' ORDER BY CASE kind WHEN 'verb' THEN 0 WHEN 'reply' THEN 1 WHEN 'review' THEN 2 WHEN 'build' THEN 3 WHEN 'health' THEN 4 WHEN 'ceo' THEN 5 ELSE 6 END, created_at LIMIT 50").all<Record<string, unknown>>();
  const caps = new Set([...capabilities, "any"]);
  for (const row of queued.results) {
    const r = toRun(row);
    if (!caps.has(r.runs_on)) continue;
    // Paused: only the owner's own verb runs go ahead.
    if (paused && !(r.kind === "verb" && r.requested_by === "owner")) continue;
    if ((r.kind === "scout" || r.kind === "ceo") && overBudget(spent, policy)) continue;
    if (r.kind === "build" && r.project) {
      const busy = await env.DB.prepare("SELECT COUNT(*) AS n FROM cards WHERE project = ? AND status = 'building'").bind(r.project).first<{ n: number }>();
      if ((busy?.n ?? 0) >= policy.wip_per_project) continue;
      const prs = await env.DB.prepare("SELECT COUNT(*) AS n FROM cards WHERE status IN ('building', 'in_review')").first<{ n: number }>();
      if ((prs?.n ?? 0) >= policy.max_open_prs) continue;
    }
    const ok = await env.DB.prepare("UPDATE runs SET status = 'running', runner = ?, started_at = ? WHERE id = ? AND status = 'queued'").bind(runner, now(), r.id).run();
    if (!ok.meta.changes) continue;
    if (r.kind === "build" && r.card_id) {
      const card = await getCard(env, r.card_id);
      if (card.status !== "approved") {
        await finishRun(env, asRunner, r.id, { status: "cancelled", summary: `card is ${card.status}, not approved` });
        continue;
      }
      await setStatus(env, asRunner, r.card_id, "building");
    }
    await audit(env, caller, "run.claim", r.id, { kind: r.kind, runner });
    const context = await getContext(env, r.project);
    const card = r.card_id ? await cardDetail(env, r.card_id) : null;
    return { run: { ...r, status: "running", runner }, context, card, policy };
  }
  return { run: null, paused, over_budget: overBudget(spent, policy) };
}

export async function finishRun(env: Env, caller: Caller, id: string, r: { status: string; summary?: string; output?: string; cost_usd?: number; session?: string; branch?: string; pr_url?: string; card_status?: Status }) {
  if (caller.role === "agent") throw new HttpError(403, "runner token required");
  caller = { role: "runner", name: caller.name };
  if (!["done", "failed", "cancelled"].includes(r.status)) throw new HttpError(400, "status: done, failed or cancelled");
  const run = await env.DB.prepare("SELECT * FROM runs WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!run) throw new HttpError(404, `no run ${id}`);
  const cost = Math.max(0, Number(r.cost_usd ?? 0)) || 0;
  await env.DB.prepare("UPDATE runs SET status = ?, finished_at = ?, summary = ?, output = ?, cost_usd = ?, session = COALESCE(?, session) WHERE id = ?")
    .bind(r.status, now(), (r.summary ?? "").slice(0, 2000), (r.output ?? "").slice(-20000), cost, r.session ?? null, id)
    .run();
  const kind = run.kind as string;
  const cardId = run.card_id as string | null;
  if (cardId && kind === "build") {
    const card = await getCard(env, cardId);
    if (card.status === "building") {
      if (r.status === "done") {
        await setStatus(env, caller, cardId, "in_review", { branch: r.branch, pr_url: r.pr_url });
        const policy = await requirePolicy(env);
        await enqueueRun(env, { kind: "review", card_id: cardId, project: card.project, agent: policy.agents.reviewer, requested_by: "system" });
      } else {
        await setStatus(env, caller, cardId, "failed");
      }
    }
  }
  if (cardId && kind === "reply" && r.session) {
    const card = await getCard(env, cardId);
    await env.DB.prepare("UPDATE cards SET source_json = ? WHERE id = ?").bind(JSON.stringify({ ...card.source, session: r.session }), cardId).run();
  }
  await audit(env, caller, "run.finish", id, { kind, status: r.status, cost });
  return { ok: true };
}

export async function listRuns(env: Env, limit = 50) {
  const r = await env.DB.prepare("SELECT id, kind, project, scout, card_id, verb, runs_on, agent, status, requested_by, runner, created_at, started_at, finished_at, summary, cost_usd FROM runs ORDER BY created_at DESC LIMIT ?").bind(Math.min(limit, 200)).all();
  return r.results;
}

export async function getRun(env: Env, id: string) {
  const r = await env.DB.prepare("SELECT * FROM runs WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!r) throw new HttpError(404, `no run ${id}`);
  return toRun(r);
}

// ── scheduler (cron) ───────────────────────────────────────────────────────────────────────────

/** Enqueues every due scout, the CEO and the health check. Called hourly by the cron trigger. */
export async function schedule(env: Env, at = new Date()) {
  const p = await getPolicy(env);
  if (!p) return { enqueued: [], reason: "no policy" };
  if (await isPaused(env)) return { enqueued: [], reason: "paused" };
  const policy = p.policy;
  const over = overBudget(await spentThisWeek(env), policy);
  const enqueued: string[] = [];
  const last = async (kind: string, scout: string | null, project: string | null) => {
    const r = await env.DB.prepare("SELECT created_at FROM runs WHERE kind = ? AND COALESCE(scout, '') = ? AND COALESCE(project, '') = ? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1")
      .bind(kind, scout ?? "", project ?? "")
      .first<{ created_at: string }>();
    return r ? new Date(r.created_at) : null;
  };
  if (!over) {
    const scouts: { name: string; schedule: Parameters<typeof isDue>[0]; card_limit: number; project: string }[] = [
      ...policy.scouts.map((s) => ({ ...s, project: "repo-wide" })),
      ...Object.values(policy.projects).flatMap((pp) => pp.scouts.map((s) => ({ ...s, project: pp.name }))),
    ];
    for (const s of scouts) {
      if (isDue(s.schedule, await last("scout", s.name, s.project), at)) {
        await enqueueRun(env, { kind: "scout", scout: s.name, project: s.project, args: { card_limit: s.card_limit }, agent: policy.agents.scout, requested_by: "schedule" });
        enqueued.push(`scout ${s.name} (${s.project})`);
      }
    }
    if (isDue(policy.ceo_schedule, await last("ceo", null, null), at)) {
      await enqueueRun(env, { kind: "ceo", agent: policy.agents.ceo, requested_by: "schedule" });
      enqueued.push("ceo");
    }
  }
  if (isDue("hourly", await last("health", null, null), at)) {
    await enqueueRun(env, { kind: "health", requested_by: "schedule" });
    enqueued.push("health");
  }
  // Runs stuck "running" for 6 hours are failed so their card frees up.
  const stale = new Date(at.getTime() - 6 * 3600_000).toISOString();
  const stuck = await env.DB.prepare("SELECT id FROM runs WHERE status = 'running' AND started_at < ?").bind(stale).all<{ id: string }>();
  for (const s of stuck.results) await finishRun(env, { role: "runner", name: "scheduler" }, s.id, { status: "failed", summary: "timed out after 6 hours" });
  if (enqueued.length) await audit(env, "scheduler", "schedule", null, enqueued);
  return { enqueued, over_budget: over };
}

// ── health, digest ─────────────────────────────────────────────────────────────────────────────

export async function putHealth(env: Env, caller: Caller, project: string, data: Record<string, unknown>) {
  if (caller.role === "agent") throw new HttpError(403, "runner token required");
  const ok = data && typeof data === "object" && data.ok !== false ? 1 : 0;
  await env.DB.prepare("INSERT INTO health (project, data_json, ok, at) VALUES (?, ?, ?, ?) ON CONFLICT (project) DO UPDATE SET data_json = excluded.data_json, ok = excluded.ok, at = excluded.at")
    .bind(project, JSON.stringify(data).slice(0, 20000), ok, now())
    .run();
  return { ok: true };
}

export async function healthBoard(env: Env) {
  const policy = (await getPolicy(env))?.policy;
  const h = await env.DB.prepare("SELECT project, data_json, ok, at FROM health").all<{ project: string; data_json: string; ok: number; at: string }>();
  const by = Object.fromEntries(h.results.map((r) => [r.project, { data: JSON.parse(r.data_json), ok: !!r.ok, at: r.at }]));
  const counts = await env.DB.prepare(`SELECT project, COUNT(*) AS n FROM cards WHERE status IN (${OPEN_STATUSES.map(() => "?").join(",")}) GROUP BY project`).bind(...OPEN_STATUSES).all<{ project: string; n: number }>();
  const open = Object.fromEntries(counts.results.map((r) => [r.project, r.n]));
  const names = ["repo-wide", ...Object.keys(policy?.projects ?? {})];
  for (const k of Object.keys(by)) if (!names.includes(k)) names.push(k);
  return {
    projects: names.map((n) => ({
      project: n,
      tier_ceiling: n === "repo-wide" ? policy?.tier_ceiling ?? null : policy?.projects[n]?.tier_ceiling ?? null,
      health: by[n] ?? null,
      open_cards: open[n] ?? 0,
    })),
    spent_this_week_usd: await spentThisWeek(env),
    weekly_budget_usd: policy?.weekly_budget_usd ?? null,
    paused: await isPaused(env),
  };
}

export async function digest(env: Env, hours = 24) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const one = async (sql: string, ...a: unknown[]) => (await env.DB.prepare(sql).bind(...a).first<{ n: number }>())?.n ?? 0;
  const ib = await inbox(env).catch(() => null);
  return {
    since,
    shipped_auto: await one("SELECT COUNT(*) AS n FROM cards WHERE status = 'shipped' AND decided_by = 'auto' AND updated_at >= ?", since),
    shipped: await one("SELECT COUNT(*) AS n FROM cards WHERE status = 'shipped' AND updated_at >= ?", since),
    proposed: await one("SELECT COUNT(*) AS n FROM cards WHERE created_at >= ?", since),
    failed: await one("SELECT COUNT(*) AS n FROM cards WHERE status = 'failed' AND updated_at >= ?", since),
    runs_failed: await one("SELECT COUNT(*) AS n FROM runs WHERE status = 'failed' AND finished_at >= ?", since),
    needs_you: ib ? ib.decide.length + ib.discussing.length + ib.ready.length : 0,
    spent_this_week_usd: await spentThisWeek(env),
    paused: await isPaused(env),
  };
}

// ── tokens ─────────────────────────────────────────────────────────────────────────────────────

export const TOKEN_PREFIX = { runner: "hq_run_", agent: "hq_agt_" } as const;

export async function createToken(env: Env, caller: Caller, name: string, role: "runner" | "agent") {
  if (caller.role !== "owner") throw new HttpError(403, "only the owner creates tokens");
  if (!name?.trim()) throw new HttpError(400, "name: required");
  if (role !== "runner" && role !== "agent") throw new HttpError(400, "role: runner or agent");
  const token = TOKEN_PREFIX[role] + rand(32);
  const id = `tok-${rand(8)}`;
  await env.DB.prepare("INSERT INTO tokens (id, name, role, hash, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, name.trim().slice(0, 60), role, await sha256(token), now()).run();
  await audit(env, caller, "token.create", id, { name, role });
  return { id, token, name, role };
}

export async function resolveToken(env: Env, token: string): Promise<Caller | null> {
  if (!token.startsWith(TOKEN_PREFIX.runner) && !token.startsWith(TOKEN_PREFIX.agent)) return null;
  const r = await env.DB.prepare("SELECT id, name, role FROM tokens WHERE hash = ? AND revoked_at IS NULL").bind(await sha256(token)).first<{ id: string; name: string; role: Role }>();
  if (!r) return null;
  await env.DB.prepare("UPDATE tokens SET last_used_at = ? WHERE id = ?").bind(now(), r.id).run();
  return { role: r.role, name: r.name };
}

export async function listTokens(env: Env) {
  return (await env.DB.prepare("SELECT id, name, role, created_at, last_used_at, revoked_at FROM tokens ORDER BY created_at DESC").all()).results;
}
export async function revokeToken(env: Env, caller: Caller, id: string) {
  if (caller.role !== "owner") throw new HttpError(403, "only the owner revokes tokens");
  await env.DB.prepare("UPDATE tokens SET revoked_at = ? WHERE id = ?").bind(now(), id).run();
  await audit(env, caller, "token.revoke", id);
}

export async function auditLog(env: Env, limit = 100) {
  return (await env.DB.prepare("SELECT at, actor, action, target, detail FROM audit ORDER BY id DESC LIMIT ?").bind(Math.min(limit, 500)).all()).results;
}
