// HQ's domain operations, shared by the REST API (portal, iOS, runners) and the MCP server. Data
// lives in the `hq` schema of the Supabase project (service-role client: RLS is for reads by
// members; every write happens here after the checks). Every operation is scoped to the caller's
// workspace, and every rule that matters is enforced here, whoever calls: roles, the card gate,
// tier ceilings, who may move a card, verb checks, the budget, the kill switch, WIP limits.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildContext,
  can,
  canTransition,
  checkCardAgainstPolicy,
  checkVerb,
  defaultPriority,
  isDue,
  isMember,
  MEMBER_ROLES,
  OPEN_STATUSES,
  overBudget,
  validateCard,
  validateEvidence,
  type Action,
  type Actor,
  type Card,
  type Context,
  type Decision,
  type Evidence,
  type MemberRole,
  type RepoPolicy,
  type Role,
  type Status,
} from "@hq/core";

export interface Env {
  OAUTH_KV: KVNamespace;
  ASSETS: Fetcher;
  /** This site's origin; the OAuth MCP resource is `${PUBLIC_URL}/mcp`. */
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  /** Publishable key: validates people's Supabase sessions. */
  SUPABASE_ANON_KEY: string;
  /** Secret. Server-side only; bypasses RLS for every project in the shared Supabase project. */
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** With the two secrets below, account deletion revokes Sign in with Apple tokens (apple.ts). */
  APPLE_TEAM_ID?: string;
  APPLE_SIWA_KEY_ID?: string;
  APPLE_SIWA_PRIVATE_KEY?: string;
}

export const SCHEMA = "hq";
export const BUCKET = "hq";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

export function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

/** Who is calling, and in which workspace. People act with their member role; tokens as runner/agent. */
export interface Caller {
  role: Role;
  /** A person's email (or user id), a token's name, or an OAuth client's name. */
  name: string;
  workspaceId: string;
  userId?: string;
}

export interface Ctx {
  env: Env;
  db: Db;
}

export class HttpError extends Error {
  status: number;
  details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
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

/** Throws on a Supabase error; returns the data. */
function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) {
    console.error(what, r.error.message);
    throw new HttpError(500, `database error (${what})`);
  }
  return r.data;
}

export function need(c: Caller, action: Action) {
  if (!can(c.role, action)) throw new HttpError(403, `your role (${c.role}) can't ${action.replace(/_/g, " ")} in this workspace`);
}

/** The lifecycle's actor for a caller: people who may decide act as "owner". */
export const actorOf = (c: Caller): Actor => (isMember(c.role) ? (can(c.role, "decide") ? "owner" : "agent") : c.role === "runner" ? "runner" : "agent");
const who = (c: Caller) => (isMember(c.role) ? c.name : `${c.role}:${c.name}`);

// ── people and workspaces ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string | null;
}

/** Validates a Supabase access token with Supabase Auth. */
export async function supabaseUser(env: Env, token: string): Promise<User | null> {
  if (!token || token.startsWith("hq_")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; email?: string };
  return u.id ? { id: u.id, email: u.email ?? null } : null;
}

export async function memberRole(x: Ctx, workspaceId: string, userId: string): Promise<MemberRole | null> {
  if (!/^[0-9a-f-]{36}$/.test(workspaceId)) return null;
  const r = must(await x.db.from("members").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(), "member");
  return (r?.role as MemberRole) ?? null;
}

export async function myWorkspaces(x: Ctx, user: User) {
  const rows = must(await x.db.from("members").select("role, workspaces(id, name, repo, paused, synced_at)").eq("user_id", user.id), "my workspaces") as unknown as {
    role: MemberRole;
    workspaces: { id: string; name: string; repo: string; paused: boolean; synced_at: string | null };
  }[];
  return rows.map((r) => ({ ...r.workspaces, role: r.role })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createWorkspace(x: Ctx, user: User, name: string, repo: string) {
  name = String(name ?? "").trim();
  repo = String(repo ?? "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  if (!name || name.length > 80) throw new HttpError(400, "name: 1–80 characters");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new HttpError(400, "repo: owner/name of the GitHub repository");
  const ws = must(await x.db.from("workspaces").insert({ name, repo, created_by: user.id }).select("id, name, repo").single(), "create workspace") as { id: string; name: string; repo: string };
  must(await x.db.from("members").insert({ workspace_id: ws.id, user_id: user.id, role: "admin", email: user.email }), "add admin");
  await audit(x, { role: "admin", name: user.email ?? user.id, workspaceId: ws.id, userId: user.id }, "workspace.create", ws.repo);
  return { ...ws, role: "admin" as const };
}

export async function getWorkspace(x: Ctx, id: string) {
  const r = must(await x.db.from("workspaces").select("id, name, repo, paused, policy, commit_sha, synced_at").eq("id", id).maybeSingle(), "workspace");
  if (!r) throw new HttpError(404, "no such workspace");
  return r as { id: string; name: string; repo: string; paused: boolean; policy: RepoPolicy | null; commit_sha: string | null; synced_at: string | null };
}

export async function listMembers(x: Ctx, c: Caller) {
  need(c, "read");
  return must(await x.db.from("members").select("user_id, role, email, created_at").eq("workspace_id", c.workspaceId).order("created_at"), "members");
}

async function adminCount(x: Ctx, ws: string) {
  const r = await x.db.from("members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws).eq("role", "admin");
  return r.count ?? 0;
}

export async function setMemberRole(x: Ctx, c: Caller, userId: string, role: MemberRole) {
  need(c, "members");
  if (!MEMBER_ROLES.includes(role)) throw new HttpError(400, `role: one of ${MEMBER_ROLES.join(", ")}`);
  const cur = await memberRole(x, c.workspaceId, userId);
  if (!cur) throw new HttpError(404, "not a member");
  if (cur === "admin" && role !== "admin" && (await adminCount(x, c.workspaceId)) <= 1) throw new HttpError(409, "a workspace needs at least one admin");
  must(await x.db.from("members").update({ role }).eq("workspace_id", c.workspaceId).eq("user_id", userId), "set role");
  await audit(x, c, "member.role", userId, { from: cur, to: role });
}

export async function removeMember(x: Ctx, c: Caller, userId: string) {
  if (userId !== c.userId) need(c, "members");
  const cur = await memberRole(x, c.workspaceId, userId);
  if (!cur) throw new HttpError(404, "not a member");
  if (cur === "admin" && (await adminCount(x, c.workspaceId)) <= 1) throw new HttpError(409, "a workspace needs at least one admin");
  must(await x.db.from("members").delete().eq("workspace_id", c.workspaceId).eq("user_id", userId), "remove member");
  await audit(x, c, userId === c.userId ? "member.leave" : "member.remove", userId);
}

export async function createInvite(x: Ctx, c: Caller, role: MemberRole, days = 7) {
  need(c, "members");
  if (!MEMBER_ROLES.includes(role)) throw new HttpError(400, `role: one of ${MEMBER_ROLES.join(", ")}`);
  const code = `hqi_${rand(24)}`;
  const expires = new Date(Date.now() + Math.min(Math.max(days, 1), 30) * 86400_000).toISOString();
  must(await x.db.from("invites").insert({ workspace_id: c.workspaceId, code_hash: await sha256(code), role, created_by: c.userId ?? null, expires_at: expires }), "invite");
  await audit(x, c, "invite.create", role, { expires });
  return { code, role, expires_at: expires };
}

export async function acceptInvite(x: Ctx, user: User, code: string) {
  const inv = must(await x.db.from("invites").select("id, workspace_id, role, expires_at, used_at").eq("code_hash", await sha256(String(code ?? "").trim())).maybeSingle(), "invite") as
    | { id: string; workspace_id: string; role: MemberRole; expires_at: string; used_at: string | null }
    | null;
  if (!inv || inv.used_at || Date.parse(inv.expires_at) < Date.now()) throw new HttpError(404, "this invite link is invalid, used or expired: ask for a new one");
  const existing = await memberRole(x, inv.workspace_id, user.id);
  if (!existing) must(await x.db.from("members").insert({ workspace_id: inv.workspace_id, user_id: user.id, role: inv.role, email: user.email }), "join");
  must(await x.db.from("invites").update({ used_by: user.id, used_at: now() }).eq("id", inv.id), "use invite");
  await audit(x, { role: inv.role, name: user.email ?? user.id, workspaceId: inv.workspace_id, userId: user.id }, "member.join", user.email ?? user.id, { role: existing ?? inv.role });
  const ws = await getWorkspace(x, inv.workspace_id);
  return { id: ws.id, name: ws.name, repo: ws.repo, role: existing ?? inv.role };
}

// ── audit, policy, settings ──────────────────────────────────────────────────────────────────

export async function audit(x: Ctx, c: Caller | { workspaceId: string; name: string; role: "system" }, action: string, target: string | null, detail?: unknown) {
  const actor = c.role === "system" ? c.name : who(c as Caller);
  const d = detail === undefined ? null : JSON.parse(JSON.stringify(detail));
  await x.db.from("audit").insert({ workspace_id: c.workspaceId, actor, action, target, detail: d });
}

export async function getPolicy(x: Ctx, ws: string) {
  const w = await getWorkspace(x, ws);
  return w.policy ? { policy: w.policy, commit_sha: w.commit_sha, synced_at: w.synced_at, repo: w.repo } : null;
}

export async function requirePolicy(x: Ctx, ws: string): Promise<RepoPolicy> {
  const p = await getPolicy(x, ws);
  if (!p) throw new HttpError(409, "this workspace has no policy yet: run `hq sync` in the repo with a runner token");
  return p.policy;
}

export async function syncPolicy(x: Ctx, c: Caller, policy: RepoPolicy, commit: string | null) {
  need(c, "sync");
  if (!policy || typeof policy.repo !== "string" || typeof policy.projects !== "object") throw new HttpError(400, "policy: expected the output of buildPolicy()");
  const ws = await getWorkspace(x, c.workspaceId);
  if (policy.repo.toLowerCase() !== ws.repo.toLowerCase()) throw new HttpError(409, `this workspace is for ${ws.repo}, but .hq/HQ.md says repo: ${policy.repo}`);
  const changed = JSON.stringify(ws.policy) !== JSON.stringify(policy);
  must(await x.db.from("workspaces").update({ policy, commit_sha: commit, synced_at: now() }).eq("id", c.workspaceId), "sync");
  await audit(x, c, "policy.sync", policy.repo, { commit, projects: Object.keys(policy.projects), changed });
}

export async function setPaused(x: Ctx, c: Caller, paused: boolean) {
  need(c, "pause");
  must(await x.db.from("workspaces").update({ paused }).eq("id", c.workspaceId), "pause");
  await audit(x, c, paused ? "workspace.pause" : "workspace.resume", null);
}
const isPaused = async (x: Ctx, ws: string) => (await getWorkspace(x, ws)).paused;

/** Monday 00:00 UTC of the current week. */
export function weekStart(d = new Date()): string {
  const w = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
  return w.toISOString();
}
export async function spentThisWeek(x: Ctx, ws: string): Promise<number> {
  const rows = must(await x.db.from("runs").select("cost_usd").eq("workspace_id", ws).gte("created_at", weekStart()), "spend") as { cost_usd: number | string }[];
  return +rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0).toFixed(4);
}

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

// ── context ──────────────────────────────────────────────────────────────────────────────────

export async function getContext(x: Ctx, c: Caller, project: string | null): Promise<Context> {
  need(c, "read");
  const ws = c.workspaceId;
  const policy = await requirePolicy(x, ws);
  if (project && project !== "repo-wide" && !policy.projects[project]) throw new HttpError(404, `unknown project ${project}`);
  const open = must(
    await x.db.from("cards").select("id, project, title, status, tier, kind, priority, dedupe_key").eq("workspace_id", ws).in("status", [...OPEN_STATUSES]).order("priority", { ascending: false }).limit(200),
    "open cards"
  ) as Context["state"]["open_cards"];
  const dec = must(await x.db.from("decisions").select("card_id, decision, reason, at, cards(title, project, kind)").eq("workspace_id", ws).order("at", { ascending: false }).limit(60), "decisions") as unknown as {
    card_id: string; decision: "approved" | "rejected"; reason: string | null; at: string; cards: { title: string; project: string; kind: string } | null;
  }[];
  const decisions: Decision[] = dec.map((d) => ({ card_id: d.card_id, decision: d.decision, reason: d.reason, at: d.at, title: d.cards?.title ?? "", project: d.cards?.project ?? "", kind: d.cards?.kind ?? "" }));
  const prs = await count(x.db.from("cards").select("id", { count: "exact", head: true }).eq("workspace_id", ws).not("pr_url", "is", null).in("status", ["building", "in_review"]));
  return buildContext(policy, project, { paused: await isPaused(x, ws), spent_this_week_usd: await spentThisWeek(x, ws), open_cards: open, open_prs: prs, recent_decisions: decisions });
}

// ── cards ────────────────────────────────────────────────────────────────────────────────────

const toCard = (r: Record<string, unknown>): Card => ({ ...(r as unknown as Card), evidence: (r.evidence as Evidence[]) ?? [], verbs: (r.verbs as string[]) ?? [], source: (r.source as Card["source"]) ?? {} });

export async function getCard(x: Ctx, c: Caller, id: string): Promise<Card> {
  const r = must(await x.db.from("cards").select("*").eq("workspace_id", c.workspaceId).eq("id", id).maybeSingle(), "card");
  if (!r) throw new HttpError(404, `no card ${id}`);
  return toCard(r);
}

export async function cardDetail(x: Ctx, c: Caller, id: string) {
  need(c, "read");
  const card = await getCard(x, c, id);
  const [comments, decisions, attachments, runs] = await Promise.all([
    x.db.from("comments").select("id, author, body, created_at").eq("card_id", id).order("id"),
    x.db.from("decisions").select("decision, reason, by, at").eq("card_id", id).order("id"),
    x.db.from("attachments").select("id, phase, evidence, file_key, by, at").eq("card_id", id).order("id"),
    x.db.from("runs").select("id, kind, status, agent, created_at, finished_at, summary, cost_usd").eq("card_id", id).order("created_at"),
  ]);
  return {
    card,
    comments: must(comments, "comments"),
    decisions: must(decisions, "decisions"),
    attachments: must(attachments, "attachments"),
    runs: (must(runs, "runs") as { cost_usd: unknown }[]).map((r) => ({ ...r, cost_usd: Number(r.cost_usd) })),
  };
}

export async function listCards(x: Ctx, c: Caller, opts: { status?: string[]; project?: string; limit?: number }): Promise<Card[]> {
  need(c, "read");
  let q = x.db.from("cards").select("*").eq("workspace_id", c.workspaceId);
  if (opts.status?.length) q = q.in("status", opts.status);
  if (opts.project) q = q.eq("project", opts.project);
  const r = must(await q.order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 100, 500)), "cards");
  return (r as Record<string, unknown>[]).map(toCard);
}

/** The inbox: what needs a person, capped so it stays a few minutes a day (PRD §9). */
export async function inbox(x: Ctx, c: Caller) {
  const policy = await requirePolicy(x, c.workspaceId);
  const [proposed, discussing, ready, working] = await Promise.all([
    listCards(x, c, { status: ["proposed"], limit: 500 }),
    listCards(x, c, { status: ["discussing"] }),
    listCards(x, c, { status: ["in_review"] }),
    listCards(x, c, { status: ["approved", "building"] }),
  ]);
  return { cap: policy.inbox_cap, decide: proposed.slice(0, policy.inbox_cap), backlog: proposed.slice(policy.inbox_cap), discussing, ready, working };
}

export async function createProposal(x: Ctx, c: Caller, input: unknown) {
  need(c, "propose");
  const v = validateCard(input);
  if (!v.ok) throw new HttpError(422, "card refused", v.errors);
  const ws = c.workspaceId;
  const policy = await requirePolicy(x, ws);
  const problems = checkCardAgainstPolicy(v.value, policy);
  if (problems.length) throw new HttpError(422, "card refused by policy", problems);
  const card = v.value;
  if (card.dedupe_key) {
    const dup = must(await x.db.from("cards").select("id, status").eq("workspace_id", ws).eq("dedupe_key", card.dedupe_key).in("status", [...OPEN_STATUSES]).limit(1).maybeSingle(), "dedupe") as { id: string; status: string } | null;
    if (dup) return { id: dup.id, status: dup.status, duplicate: true, note: `an open card already has dedupe_key ${card.dedupe_key}; comment on it instead` };
    const rej = must(
      await x.db.from("decisions").select("card_id, reason, at, cards!inner(dedupe_key, status)").eq("workspace_id", ws).eq("decision", "rejected").eq("cards.dedupe_key", card.dedupe_key).eq("cards.status", "rejected").order("at", { ascending: false }).limit(1).maybeSingle(),
      "rejected dedupe"
    ) as { card_id: string; reason: string | null; at: string } | null;
    if (rej && Date.now() - Date.parse(rej.at) < 30 * 86400_000) {
      return { id: rej.card_id, status: "rejected", duplicate: true, note: `rejected ${rej.at.slice(0, 10)}${rej.reason ? ` ("${rej.reason}")` : ""}; not re-proposed within 30 days` };
    }
  }
  const id = newCardId();
  const t = now();
  const status: Status = card.tier === "L0" ? "approved" : "proposed";
  must(
    await x.db.from("cards").insert({
      id, workspace_id: ws, repo: policy.repo, project: card.project, kind: card.kind, title: card.title, why: card.why, evidence: card.evidence, plan: card.plan,
      verify: card.verify, tier: card.tier, effort: card.effort ?? "M", risk: card.risk ?? "medium", risk_reason: card.risk_reason ?? null, verbs: card.verbs ?? [],
      source: { ...card.source, agent: card.source?.agent ?? c.name }, dedupe_key: card.dedupe_key ?? null, status, priority: defaultPriority(card),
      decided_by: status === "approved" ? "auto" : null, created_at: t, updated_at: t,
    }),
    "create card"
  );
  if (status === "approved") {
    must(await x.db.from("decisions").insert({ workspace_id: ws, card_id: id, decision: "approved", reason: "L0: approved by policy", by: "auto" }), "auto decision");
    await enqueueRun(x, ws, { kind: "build", card_id: id, project: card.project, agent: policy.agents.executor, requested_by: "system" });
  }
  await audit(x, c, "card.create", id, { tier: card.tier, project: card.project, status });
  return { id, status, duplicate: false };
}

export async function setStatus(x: Ctx, c: Caller | "system", ws: string, id: string, to: Status, patch: { branch?: string; pr_url?: string } = {}) {
  const sys: Caller = { role: "runner", name: "system", workspaceId: ws };
  const card = await getCard(x, c === "system" ? sys : c, id);
  const actor: Actor = c === "system" ? "system" : actorOf(c);
  if (!canTransition(card.status, to, actor) && !(c === "system" && to === "discussing" && card.status === "proposed")) {
    throw new HttpError(409, `${c === "system" ? "system" : c.role} can't move ${id} from ${card.status} to ${to}`);
  }
  const upd: Record<string, unknown> = { status: to, updated_at: now() };
  if (patch.branch) upd.branch = patch.branch;
  if (patch.pr_url) upd.pr_url = patch.pr_url;
  must(await x.db.from("cards").update(upd).eq("workspace_id", ws).eq("id", id), "status");
  await audit(x, c === "system" ? { role: "system", name: "system", workspaceId: ws } : c, "card.status", id, { from: card.status, to, ...patch });
  return { ...card, status: to };
}

export async function decide(x: Ctx, c: Caller, id: string, decision: "approved" | "rejected", reason: string | null) {
  need(c, "decide");
  const card = await setStatus(x, c, c.workspaceId, id, decision);
  must(await x.db.from("decisions").insert({ workspace_id: c.workspaceId, card_id: id, decision, reason, by: c.name }), "decision");
  must(await x.db.from("cards").update({ decided_by: c.name }).eq("id", id), "decided_by");
  if (decision === "approved") {
    const policy = await requirePolicy(x, c.workspaceId);
    await enqueueRun(x, c.workspaceId, { kind: "build", card_id: id, project: card.project, agent: policy.agents.executor, requested_by: c.name });
  } else {
    must(await x.db.from("runs").update({ status: "cancelled", finished_at: now() }).eq("card_id", id).eq("status", "queued"), "cancel runs");
  }
  return getCard(x, c, id);
}

export async function changeStatus(x: Ctx, c: Caller, id: string, to: Status, patch: { branch?: string; pr_url?: string; reason?: string }) {
  if (to === "withdrawn") return withdraw(x, c, id, patch.reason ?? "");
  if (isMember(c.role)) need(c, "set_status");
  else if (c.role !== "runner") throw new HttpError(403, "agents can't change a card's status (withdraw_card is the exception)");
  const card = await setStatus(x, c, c.workspaceId, id, to, patch);
  if (isMember(c.role) && to === "approved") await enqueueRun(x, c.workspaceId, { kind: "build", card_id: id, project: card.project, requested_by: c.name });
  return card;
}

export async function comment(x: Ctx, c: Caller, id: string, body: string) {
  need(c, "comment");
  if (!body?.trim()) throw new HttpError(400, "body: required");
  const card = await getCard(x, c, id);
  must(await x.db.from("comments").insert({ workspace_id: c.workspaceId, card_id: id, author: who(c), body: body.trim().slice(0, 8000) }), "comment");
  if (isMember(c.role)) {
    // A person asked something: the card waits, and the agent that wrote it is asked to answer.
    if (card.status === "proposed") await setStatus(x, "system", c.workspaceId, id, "discussing");
    await enqueueRun(x, c.workspaceId, { kind: "reply", card_id: id, project: card.project, requested_by: c.name, agent: card.source.agent ?? null, session: card.source.session ?? null });
  } else if (card.status === "discussing") {
    await setStatus(x, c, c.workspaceId, id, "proposed");
  }
  await audit(x, c, "card.comment", id);
  return cardDetail(x, c, id);
}

export async function rankCards(x: Ctx, c: Caller, ranks: { id: string; priority: number }[]) {
  need(c, "rank");
  if (!Array.isArray(ranks) || ranks.length > 200) throw new HttpError(400, "ranks: a list of { id, priority }");
  for (const r of ranks) {
    if (typeof r.id !== "string" || !Number.isFinite(r.priority)) throw new HttpError(400, "each rank needs id and a numeric priority");
    must(await x.db.from("cards").update({ priority: Math.round(r.priority), updated_at: now() }).eq("workspace_id", c.workspaceId).eq("id", r.id).in("status", ["proposed", "discussing"]), "rank");
  }
  await audit(x, c, "card.rank", null, ranks.map((r) => `${r.id}=${r.priority}`));
  return { ranked: ranks.length };
}

export async function withdraw(x: Ctx, c: Caller, id: string, reason: string) {
  if (c.role === "viewer") throw new HttpError(403, "viewers can't withdraw cards");
  await setStatus(x, c, c.workspaceId, id, "withdrawn");
  must(await x.db.from("comments").insert({ workspace_id: c.workspaceId, card_id: id, author: who(c), body: `Withdrawn: ${reason || "no reason given"}` }), "withdraw note");
  return getCard(x, c, id);
}

export async function attachEvidence(x: Ctx, c: Caller, id: string, phase: string, evidence: Evidence, fileKey: string | null = null) {
  need(c, "attach");
  await getCard(x, c, id);
  if (!["build", "review", "proposal", "verb"].includes(phase)) throw new HttpError(400, "phase: build, review, proposal or verb");
  const errs = validateEvidence(evidence);
  if (errs.length && !fileKey) throw new HttpError(422, "evidence refused", errs);
  must(await x.db.from("attachments").insert({ workspace_id: c.workspaceId, card_id: id, phase, evidence, file_key: fileKey, by: who(c) }), "attach");
  return { ok: true };
}

export async function putFile(x: Ctx, c: Caller, cardId: string, name: string, type: string, data: ArrayBuffer, phase: string, caption: string | null) {
  need(c, "attach");
  await getCard(x, c, cardId);
  const key = `${c.workspaceId}/cards/${cardId}/${now().replace(/[:.]/g, "")}-${name}`;
  const up = await x.db.storage.from(BUCKET).upload(key, data, { contentType: type, upsert: false });
  if (up.error) throw new HttpError(500, `storage: ${up.error.message}`);
  await attachEvidence(x, c, cardId, phase, { type: type.startsWith("image/") ? "screenshot" : "file", ref: key, text: caption ?? name }, key);
  return { key };
}

export async function getFile(x: Ctx, c: Caller, key: string) {
  need(c, "read");
  if (!key.startsWith(`${c.workspaceId}/`)) throw new HttpError(404, "no such file");
  const r = await x.db.storage.from(BUCKET).download(key);
  if (r.error || !r.data) throw new HttpError(404, "no such file");
  return r.data;
}

// ── runs ─────────────────────────────────────────────────────────────────────────────────────

export interface Run {
  id: string; workspace_id: string; kind: string; project: string | null; scout: string | null; card_id: string | null; verb: string | null;
  args: Record<string, unknown>; runs_on: string; agent: string | null; status: string; requested_by: string; runner: string | null;
  created_at: string; started_at: string | null; finished_at: string | null; summary: string | null; output: string | null; cost_usd: number; session: string | null;
}
const toRun = (r: Record<string, unknown>): Run => ({ ...(r as unknown as Run), cost_usd: Number(r.cost_usd ?? 0), args: (r.args as Record<string, unknown>) ?? {} });

export async function enqueueRun(
  x: Ctx,
  ws: string,
  r: { kind: string; project?: string | null; scout?: string | null; card_id?: string | null; verb?: string | null; args?: Record<string, unknown>; runs_on?: string; agent?: string | null; requested_by: string; session?: string | null }
) {
  // One queued run per (kind, scout, project, card, verb, args): re-enqueueing is a no-op. Verb runs
  // differ by their arguments too: a real run must never merge into a queued dry run.
  const open = must(await x.db.from("runs").select("id, scout, project, card_id, verb, args").eq("workspace_id", ws).eq("kind", r.kind).in("status", ["queued", "running"]), "dedupe runs") as {
    id: string; scout: string | null; project: string | null; card_id: string | null; verb: string | null; args: Record<string, unknown>;
  }[];
  const args = r.args ?? {};
  const dup = open.find((o) => (o.scout ?? "") === (r.scout ?? "") && (o.project ?? "") === (r.project ?? "") && (o.card_id ?? "") === (r.card_id ?? "") && (o.verb ?? "") === (r.verb ?? "") && (r.kind !== "verb" || JSON.stringify(o.args) === JSON.stringify(args)));
  if (dup) return dup.id;
  const id = newRunId();
  must(
    await x.db.from("runs").insert({ id, workspace_id: ws, kind: r.kind, project: r.project ?? null, scout: r.scout ?? null, card_id: r.card_id ?? null, verb: r.verb ?? null, args, runs_on: r.runs_on ?? "any", agent: r.agent ?? null, status: "queued", requested_by: r.requested_by, session: r.session ?? null }),
    "enqueue"
  );
  return id;
}

export async function startRun(x: Ctx, c: Caller, kind: string, scout: string | null, project: string | null) {
  need(c, "start_run");
  if (!["scout", "ceo", "health"].includes(kind)) throw new HttpError(400, "kind: scout, ceo or health");
  if (kind === "scout" && !scout) throw new HttpError(400, "scout: required");
  const policy = (await getPolicy(x, c.workspaceId))?.policy;
  const agent = kind === "ceo" ? policy?.agents.ceo : kind === "scout" ? policy?.agents.scout : null;
  return enqueueRun(x, c.workspaceId, { kind, scout, project: project ?? (kind === "scout" ? "repo-wide" : null), agent, requested_by: c.name, args: { card_limit: 3 } });
}

export async function requestVerb(x: Ctx, c: Caller, project: string, verb: string, dryRun: boolean, cardId: string | null) {
  need(c, "run_verb");
  const ws = c.workspaceId;
  const policy = await requirePolicy(x, ws);
  const card = cardId ? await getCard(x, c, cardId) : null;
  const actor = can(c.role, "run_l3_verb") ? "owner" : c.role === "runner" ? "runner" : "agent";
  const check = checkVerb({ project, verb, dryRun, card: card && { tier: card.tier, status: card.status, project: card.project } }, policy, actor);
  await audit(x, c, check.allowed ? "verb.request" : "verb.refused", `${project}/${verb}`, { dryRun, cardId, reason: check.reason });
  if (!check.allowed) throw new HttpError(403, `refused: ${check.reason}`);
  if (!dryRun && (await isPaused(x, ws)) && actor !== "owner") throw new HttpError(423, "HQ is paused in this workspace");
  const id = await enqueueRun(x, ws, { kind: "verb", project, verb, card_id: cardId, args: { dry_run: dryRun }, runs_on: check.policy?.runs_on ?? "any", requested_by: who(c) });
  return { run_id: id, reason: check.reason };
}

const KIND_ORDER = ["verb", "reply", "review", "build", "health", "ceo", "scout"];

/** A runner asks for work in its workspace. Respects the kill switch, the budget (scouts and the CEO only) and WIP limits. */
export async function claimRun(x: Ctx, c: Caller, runner: string, capabilities: string[]) {
  need(c, "claim");
  const ws = c.workspaceId;
  const asRunner: Caller = { role: "runner", name: runner, workspaceId: ws };
  const w = await getWorkspace(x, ws);
  const policy = await requirePolicy(x, ws);
  const spent = await spentThisWeek(x, ws);
  const queued = (must(await x.db.from("runs").select("*").eq("workspace_id", ws).eq("status", "queued").order("created_at").limit(100), "queue") as Record<string, unknown>[])
    .map(toRun)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const caps = new Set([...capabilities, "any"]);
  for (const r of queued) {
    if (!caps.has(r.runs_on)) continue;
    // Paused: only verb runs a person started go ahead.
    if (w.paused && !(r.kind === "verb" && !r.requested_by.includes(":"))) continue;
    if ((r.kind === "scout" || r.kind === "ceo") && overBudget(spent, policy)) continue;
    if (r.kind === "build" && r.project) {
      const busy = await count(x.db.from("cards").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("project", r.project).eq("status", "building"));
      if (busy >= policy.wip_per_project) continue;
      const prs = await count(x.db.from("cards").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("status", ["building", "in_review"]));
      if (prs >= policy.max_open_prs) continue;
    }
    const got = must(await x.db.from("runs").update({ status: "running", runner, started_at: now() }).eq("id", r.id).eq("status", "queued").select("id"), "claim") as { id: string }[];
    if (!got.length) continue;
    if (r.kind === "build" && r.card_id) {
      const card = await getCard(x, asRunner, r.card_id);
      if (card.status !== "approved") {
        await finishRun(x, asRunner, r.id, { status: "cancelled", summary: `card is ${card.status}, not approved` });
        continue;
      }
      await setStatus(x, asRunner, ws, r.card_id, "building");
    }
    await audit(x, c, "run.claim", r.id, { kind: r.kind, runner });
    const context = await getContext(x, asRunner, r.project);
    const card = r.card_id ? await cardDetail(x, asRunner, r.card_id) : null;
    return { run: { ...r, status: "running", runner }, context, card, policy };
  }
  return { run: null, paused: w.paused, over_budget: overBudget(spent, policy) };
}

export async function finishRun(x: Ctx, c: Caller, id: string, r: { status: string; summary?: string; output?: string; cost_usd?: number; session?: string; branch?: string; pr_url?: string }) {
  need(c, "claim");
  const ws = c.workspaceId;
  const asRunner: Caller = { role: "runner", name: c.name, workspaceId: ws };
  if (!["done", "failed", "cancelled"].includes(r.status)) throw new HttpError(400, "status: done, failed or cancelled");
  const row = must(await x.db.from("runs").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle(), "run");
  if (!row) throw new HttpError(404, `no run ${id}`);
  const run = toRun(row);
  const cost = Math.max(0, Number(r.cost_usd ?? 0)) || 0;
  const upd: Record<string, unknown> = { status: r.status, finished_at: now(), summary: (r.summary ?? "").slice(0, 2000), output: (r.output ?? "").slice(-20000), cost_usd: cost };
  if (r.session) upd.session = r.session;
  must(await x.db.from("runs").update(upd).eq("id", id), "finish");
  if (run.card_id && run.kind === "build") {
    const card = await getCard(x, asRunner, run.card_id);
    if (card.status === "building") {
      if (r.status === "done") {
        await setStatus(x, asRunner, ws, run.card_id, "in_review", { branch: r.branch, pr_url: r.pr_url });
        const policy = await requirePolicy(x, ws);
        await enqueueRun(x, ws, { kind: "review", card_id: run.card_id, project: card.project, agent: policy.agents.reviewer, requested_by: "system" });
      } else {
        await setStatus(x, asRunner, ws, run.card_id, "failed");
      }
    }
  }
  if (run.card_id && run.kind === "reply" && r.session) {
    const card = await getCard(x, asRunner, run.card_id);
    must(await x.db.from("cards").update({ source: { ...card.source, session: r.session } }).eq("id", run.card_id), "session");
  }
  await audit(x, c, "run.finish", id, { kind: run.kind, status: r.status, cost });
  return { ok: true };
}

export async function listRuns(x: Ctx, c: Caller, limit = 50) {
  need(c, "read");
  const r = must(
    await x.db.from("runs").select("id, kind, project, scout, card_id, verb, runs_on, agent, status, requested_by, runner, created_at, started_at, finished_at, summary, cost_usd").eq("workspace_id", c.workspaceId).order("created_at", { ascending: false }).limit(Math.min(limit, 200)),
    "runs"
  ) as Record<string, unknown>[];
  return r.map((row) => ({ ...row, cost_usd: Number(row.cost_usd ?? 0) }));
}

export async function getRun(x: Ctx, c: Caller, id: string) {
  need(c, "read");
  const r = must(await x.db.from("runs").select("*").eq("workspace_id", c.workspaceId).eq("id", id).maybeSingle(), "run");
  if (!r) throw new HttpError(404, `no run ${id}`);
  return toRun(r);
}

// ── scheduler (cron) ─────────────────────────────────────────────────────────────────────────

/** Enqueues every due scout, the CEO and the health check in one workspace. */
export async function scheduleWorkspace(x: Ctx, ws: string, at = new Date()) {
  const w = await getWorkspace(x, ws);
  if (!w.policy) return { enqueued: [] as string[], reason: "no policy" };
  if (w.paused) return { enqueued: [] as string[], reason: "paused" };
  const policy = w.policy;
  const over = overBudget(await spentThisWeek(x, ws), policy);
  const enqueued: string[] = [];
  const last = async (kind: string, scout: string | null, project: string | null) => {
    let q = x.db.from("runs").select("created_at").eq("workspace_id", ws).eq("kind", kind).neq("status", "cancelled");
    q = scout === null ? q.is("scout", null) : q.eq("scout", scout);
    q = project === null ? q.is("project", null) : q.eq("project", project);
    const r = must(await q.order("created_at", { ascending: false }).limit(1).maybeSingle(), "last run") as { created_at: string } | null;
    return r ? new Date(r.created_at) : null;
  };
  if (!over) {
    const scouts = [...policy.scouts.map((s) => ({ ...s, project: "repo-wide" })), ...Object.values(policy.projects).flatMap((p) => p.scouts.map((s) => ({ ...s, project: p.name })))];
    for (const s of scouts) {
      if (isDue(s.schedule, await last("scout", s.name, s.project), at)) {
        await enqueueRun(x, ws, { kind: "scout", scout: s.name, project: s.project, args: { card_limit: s.card_limit }, agent: policy.agents.scout, requested_by: "schedule" });
        enqueued.push(`scout ${s.name} (${s.project})`);
      }
    }
    if (isDue(policy.ceo_schedule, await last("ceo", null, null), at)) {
      await enqueueRun(x, ws, { kind: "ceo", agent: policy.agents.ceo, requested_by: "schedule" });
      enqueued.push("ceo");
    }
  }
  if (isDue("hourly", await last("health", null, null), at)) {
    await enqueueRun(x, ws, { kind: "health", requested_by: "schedule" });
    enqueued.push("health");
  }
  // Runs stuck "running" for 6 hours are failed so their card frees up.
  const stuck = must(await x.db.from("runs").select("id").eq("workspace_id", ws).eq("status", "running").lt("started_at", new Date(at.getTime() - 6 * 3600_000).toISOString()), "stuck") as { id: string }[];
  for (const s of stuck) await finishRun(x, { role: "runner", name: "scheduler", workspaceId: ws }, s.id, { status: "failed", summary: "timed out after 6 hours" });
  if (enqueued.length) await audit(x, { role: "system", name: "scheduler", workspaceId: ws }, "schedule", null, enqueued);
  return { enqueued, over_budget: over };
}

/** The hourly cron: every workspace that has synced a policy. */
export async function scheduleAll(x: Ctx, at = new Date()) {
  const rows = must(await x.db.from("workspaces").select("id").not("policy", "is", null).eq("paused", false), "workspaces") as { id: string }[];
  const out: Record<string, string[]> = {};
  for (const r of rows) out[r.id] = (await scheduleWorkspace(x, r.id, at)).enqueued;
  return out;
}

// ── health, digest ───────────────────────────────────────────────────────────────────────────

export async function putHealth(x: Ctx, c: Caller, project: string, data: Record<string, unknown>) {
  need(c, "claim");
  const ok = !(data && typeof data === "object" && data.ok === false);
  must(await x.db.from("health").upsert({ workspace_id: c.workspaceId, project, data, ok, at: now() }), "health");
  return { ok: true };
}

export async function healthBoard(x: Ctx, c: Caller) {
  need(c, "read");
  const ws = c.workspaceId;
  const w = await getWorkspace(x, ws);
  const policy = w.policy;
  const h = must(await x.db.from("health").select("project, data, ok, at").eq("workspace_id", ws), "health") as { project: string; data: Record<string, unknown>; ok: boolean; at: string }[];
  const by = Object.fromEntries(h.map((r) => [r.project, { data: r.data, ok: r.ok, at: r.at }]));
  const open = must(await x.db.from("cards").select("project").eq("workspace_id", ws).in("status", [...OPEN_STATUSES]), "open") as { project: string }[];
  const openBy: Record<string, number> = {};
  for (const o of open) openBy[o.project] = (openBy[o.project] ?? 0) + 1;
  const names = ["repo-wide", ...Object.keys(policy?.projects ?? {})];
  for (const k of Object.keys(by)) if (!names.includes(k)) names.push(k);
  return {
    projects: names.map((n) => ({ project: n, tier_ceiling: n === "repo-wide" ? policy?.tier_ceiling ?? null : policy?.projects[n]?.tier_ceiling ?? null, health: by[n] ?? null, open_cards: openBy[n] ?? 0 })),
    spent_this_week_usd: await spentThisWeek(x, ws),
    weekly_budget_usd: policy?.weekly_budget_usd ?? null,
    paused: w.paused,
  };
}

export async function digest(x: Ctx, c: Caller, hours = 24) {
  need(c, "read");
  const ws = c.workspaceId;
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const cards = (s: string) => x.db.from("cards").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", s).gte("updated_at", since);
  const ib = await inbox(x, c).catch(() => null);
  return {
    since,
    shipped_auto: await count(cards("shipped").eq("decided_by", "auto")),
    shipped: await count(cards("shipped")),
    proposed: await count(x.db.from("cards").select("id", { count: "exact", head: true }).eq("workspace_id", ws).gte("created_at", since)),
    failed: await count(cards("failed")),
    runs_failed: await count(x.db.from("runs").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "failed").gte("finished_at", since)),
    needs_you: ib ? ib.decide.length + ib.discussing.length + ib.ready.length : 0,
    spent_this_week_usd: await spentThisWeek(x, ws),
    paused: (await getWorkspace(x, ws)).paused,
  };
}

// ── tokens ───────────────────────────────────────────────────────────────────────────────────

export const TOKEN_PREFIX = { runner: "hq_run_", agent: "hq_agt_" } as const;

export async function createToken(x: Ctx, c: Caller, name: string, role: "runner" | "agent") {
  need(c, "tokens");
  if (!name?.trim()) throw new HttpError(400, "name: required");
  if (role !== "runner" && role !== "agent") throw new HttpError(400, "role: runner or agent");
  const token = TOKEN_PREFIX[role] + rand(32);
  const id = `tok-${rand(8)}`;
  must(await x.db.from("tokens").insert({ id, workspace_id: c.workspaceId, name: name.trim().slice(0, 60), role, hash: await sha256(token), created_by: c.userId ?? null }), "token");
  await audit(x, c, "token.create", id, { name, role });
  return { id, token, name, role };
}

/** A runner or agent token → its workspace and role. */
export async function resolveToken(x: Ctx, token: string): Promise<Caller | null> {
  if (!token.startsWith(TOKEN_PREFIX.runner) && !token.startsWith(TOKEN_PREFIX.agent)) return null;
  const r = must(await x.db.from("tokens").select("id, name, role, workspace_id").eq("hash", await sha256(token)).is("revoked_at", null).maybeSingle(), "token") as { id: string; name: string; role: "runner" | "agent"; workspace_id: string } | null;
  if (!r) return null;
  await x.db.from("tokens").update({ last_used_at: now() }).eq("id", r.id);
  return { role: r.role, name: r.name, workspaceId: r.workspace_id };
}

export async function listTokens(x: Ctx, c: Caller) {
  need(c, "tokens");
  return must(await x.db.from("tokens").select("id, name, role, created_at, last_used_at, revoked_at").eq("workspace_id", c.workspaceId).order("created_at", { ascending: false }), "tokens");
}

export async function revokeToken(x: Ctx, c: Caller, id: string) {
  need(c, "tokens");
  must(await x.db.from("tokens").update({ revoked_at: now() }).eq("workspace_id", c.workspaceId).eq("id", id), "revoke");
  await audit(x, c, "token.revoke", id);
}

export async function auditLog(x: Ctx, c: Caller, limit = 100) {
  need(c, "audit");
  return must(await x.db.from("audit").select("at, actor, action, target, detail").eq("workspace_id", c.workspaceId).order("id", { ascending: false }).limit(Math.min(limit, 500)), "audit");
}

// ── account deletion (App Store guideline 5.1.1(v)) ─────────────────────────────────────────

/** Removes every file under a Storage folder (Storage lists one level at a time; folders have no id). */
async function removeFolder(x: Ctx, prefix: string, depth = 0): Promise<void> {
  if (depth > 6) return;
  const r = await x.db.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const items = r.data ?? [];
  const files = items.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
  if (files.length) await x.db.storage.from(BUCKET).remove(files);
  for (const d of items.filter((f) => !f.id)) await removeFolder(x, `${prefix}/${d.name}`, depth + 1);
}

/**
 * Deletes a person's HQ data: their memberships, and every workspace where they're the only member
 * (with its cards, runs and files). Where they're the only admin of a team, the longest-standing
 * other member becomes admin first, so no workspace is left without one. The shared sign-in account
 * (auth.users) stays: other HEJI apps use it too (supabase/README.md).
 */
export async function deleteAccount(x: Ctx, user: User) {
  const mine = must(await x.db.from("members").select("workspace_id, role").eq("user_id", user.id), "memberships") as { workspace_id: string; role: MemberRole }[];
  const deleted: string[] = [];
  const handedOver: string[] = [];
  for (const m of mine) {
    const others = must(await x.db.from("members").select("user_id, role, created_at").eq("workspace_id", m.workspace_id).neq("user_id", user.id).order("created_at"), "others") as { user_id: string; role: MemberRole }[];
    if (!others.length) {
      await removeFolder(x, m.workspace_id);
      must(await x.db.from("workspaces").delete().eq("id", m.workspace_id), "delete workspace");
      deleted.push(m.workspace_id);
      continue;
    }
    if (m.role === "admin" && !others.some((o) => o.role === "admin")) {
      must(await x.db.from("members").update({ role: "admin" }).eq("workspace_id", m.workspace_id).eq("user_id", others[0].user_id), "hand over admin");
      await audit(x, { role: "system", name: "system", workspaceId: m.workspace_id }, "member.role", others[0].user_id, { to: "admin", reason: "the only admin deleted their account" });
      handedOver.push(m.workspace_id);
    }
    must(await x.db.from("members").delete().eq("workspace_id", m.workspace_id).eq("user_id", user.id), "leave");
    await audit(x, { role: "system", name: "system", workspaceId: m.workspace_id }, "member.delete_account", user.email ?? user.id);
  }
  must(await x.db.from("invites").update({ created_by: null }).eq("created_by", user.id), "invites");
  return { deleted_workspaces: deleted.length, admin_handed_over: handedOver.length, left: mine.length - deleted.length };
}
