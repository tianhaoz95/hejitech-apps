// The portal API (§7.3, §8), under /api/*, for a signed-in user's session cookie only, always on
// that user's own board. Human-only actions (approve, reject, resolve, manual fill, pause/kill,
// dry-run, policy, tokens, account deletion) exist only here; an agent token or executor credential
// sent here is refused with 403 by index.ts.
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import {
  approvalExpiry, checkAgentId, checkPolicy, marketDate, ptEt, suggestedValidUntil, type Policy,
} from "@tradeboard/core";
import {
  addComment, createPlan, listPlans, loadPlan, markReady, planView, requestChanges, shortOrderId, updatePlan, utc, utcDeep, type Actor,
} from "./board.ts";
import { boardControl } from "./executor.ts";
import { clearCookie } from "./auth.ts";
import { currentPolicy, json, OFFLINE_AFTER_MS, PREFIX, problem, randomToken, rpc, sha256, statusFor, sweep, type Db, type Env } from "./store.ts";

const fromFail = (e: { error_code: string; message: string }, extra: Record<string, unknown> = {}) => problem(statusFor(e.error_code), e.error_code, e.message, { ...e, ...extra, ok: undefined });

export async function executorsView(db: Db, userId: string) {
  const { data } = await db.from("executor_status").select("*").eq("user_id", userId).order("last_heartbeat_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map((e) => ({ ...e, last_heartbeat_at: utc(e.last_heartbeat_at), online: now - new Date(e.last_heartbeat_at).getTime() <= OFFLINE_AFTER_MS }));
}

export async function handlePortal(req: Request, env: Env, db: Db, url: URL, oauth: OAuthHelpers, userId: string): Promise<Response> {
  const OWNER: Actor = { type: "human", id: "owner", userId };
  const audit = (action: string, planId: string | null, details: Record<string, unknown> = {}) =>
    db.rpc("audit", { p_user_id: userId, p_actor_type: "human", p_actor_id: "owner", p_action: action, p_plan_id: planId, p_details: details });
  const path = url.pathname;
  const m = req.method;
  const body = m === "POST" || m === "PUT" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};

  if (path === "/api/me" && m === "GET") {
    const { data: o } = await db.from("accounts").select("email, totp_enrolled_at").eq("user_id", userId).maybeSingle();
    return json({ signed_in: true, email: o?.email ?? null, now: new Date().toISOString(), suggested_valid_until: suggestedValidUntil(new Date())?.toISOString() ?? null });
  }

  // ---------------------------------------------------------------- board list
  if (path === "/api/board" && m === "GET") {
    const plans = await listPlans(db, userId, { status: url.searchParams.get("status") ?? undefined, ticker: url.searchParams.get("ticker") ?? undefined, limit: 100 });
    const [control, execs] = await Promise.all([boardControl(db, userId), executorsView(db, userId)]);
    return json({ now: new Date().toISOString(), plans, control, executors: execs });
  }

  // ---------------------------------------------------------------- plans
  if (path === "/api/plans" && m === "POST") {
    const r = await createPlan(db, OWNER, body, { idempotencyKey: typeof body.idempotency_key === "string" ? body.idempotency_key : undefined });
    return r.ok ? json(r.value, 201) : fromFail(r.error);
  }
  const vm = path.match(/^\/api\/plans\/([0-9a-f-]{36})\/versions\/(\d+)$/);
  if (vm && m === "GET") {
    if (!(await loadPlan(db, userId, vm[1]))) return problem(404, "not_found", "no such version");
    const { data } = await db.from("plan_versions").select("*").eq("plan_id", vm[1]).eq("version", Number(vm[2])).maybeSingle();
    return data ? json({ ...data, edited_at: utc(data.edited_at) }) : problem(404, "not_found", "no such version");
  }
  const pm = path.match(/^\/api\/plans\/([0-9a-f-]{36})(?:\/([a-z-]+))?$/);
  if (pm) {
    const [, id, action] = pm;
    if (!action && m === "GET") {
      const v = await planView(db, userId, id, { fullOrderIds: true });
      if (!v) return problem(404, "not_found", "no such plan");
      const policy = await currentPolicy(db, userId);
      return json({ ...v, policy: { policy_version: policy.policy_version, max_drift_pct: policy.policy.max_drift_pct, approval_ttl: policy.policy.approval_ttl, max_plan_age_hours: policy.policy.max_plan_age_hours } });
    }
    if (!action && m === "PUT") {
      const { expected_version, ...fields } = body;
      const r = await updatePlan(db, OWNER, id, expected_version, (fields.fields as Record<string, unknown>) ?? fields);
      return r.ok ? json(r.value) : fromFail(r.error);
    }
    if (m !== "POST") return problem(405, "method_not_allowed", "use POST");
    switch (action) {
      case "comments": {
        const r = await addComment(db, OWNER, id, body, body.is_question === true);
        return r.ok ? json(r.value, 201) : fromFail(r.error);
      }
      case "ready": {
        const policy = await currentPolicy(db, userId);
        const r = await markReady(db, OWNER, id, policy.policy.max_plan_age_hours);
        return r.ok ? json(r.value) : fromFail(r.error);
      }
      case "request-changes": {
        const r = await requestChanges(db, OWNER, id, body.body);
        return r.ok ? json(r.value) : fromFail(r.error);
      }
      case "approve": {
        const p = await loadPlan(db, userId, id);
        if (!p) return problem(404, "not_found", "no such plan");
        const policy = await currentPolicy(db, userId);
        const expires = approvalExpiry(policy.policy, new Date(), new Date(p.valid_until));
        const r = await rpc<Record<string, unknown>>(db, "approve_plan", {
          p_user_id: userId, p_plan_id: id, p_version: Number(body.version), p_note: String(body.note ?? "").slice(0, 2000), p_expires_at: expires.toISOString(), p_max_age_hours: policy.policy.max_plan_age_hours,
        });
        return r.ok ? json({ ...r, approved_at: utc(r.approved_at as string), expires_at: utc(r.expires_at as string), expires_at_display: ptEt(expires) }) : fromFail(r);
      }
      case "reject":
      case "cancel": {
        const reason = String(body.reason ?? "").trim();
        if (action === "reject" && !reason) return problem(422, "reason_required", "say why you're rejecting it");
        const r = await rpc<Record<string, unknown>>(db, "close_plan", { p_user_id: userId, p_plan_id: id, p_to: action === "reject" ? "rejected" : "cancelled", p_reason: reason.slice(0, 2000) });
        return r.ok ? json(r) : fromFail(r);
      }
      case "manual-fill": {
        // The owner placed it themselves in Robinhood from the portal's ticket (§7.3): a manual receipt.
        const p = await loadPlan(db, userId, id);
        if (!p) return problem(404, "not_found", "no such plan");
        if (["executed", "failed", "cancelled"].includes(p.status)) return problem(422, "bad_status", `this plan is already ${p.status}`);
        if ((p.status === "validated" || p.status === "executing") && !p.awaiting_manual) return problem(422, "bad_status", "the executor is working on this plan: pause or kill it first");
        const qty = body.filled_quantity === undefined || body.filled_quantity === "" ? null : Number(body.filled_quantity);
        const price = body.filled_price === undefined || body.filled_price === "" ? null : Number(body.filled_price);
        if ((qty !== null && !(qty > 0)) || (price !== null && !(price > 0))) return problem(422, "bad_fill", "filled quantity and price must be positive numbers");
        const r = await rpc<Record<string, unknown>>(db, "post_receipt", {
          p_user_id: userId,
          p: { claim_id: null, plan_id: id, version: p.current_version, executor_id: "owner", mode: "manual", outcome: "executed", reason_code: null,
               reason_text: String(body.note ?? "Placed by the owner in Robinhood").slice(0, 2000), robinhood_order_id: null, filled_quantity: qty, filled_price: price, policy_snapshot_id: null, details: {} },
        });
        // No claim: post_receipt moves the plan to executed and clears any executor claim.
        return r.ok ? json({ ok: true, status: r.status, receipt_id: r.receipt_id }) : fromFail(r);
      }
    }
    return problem(404, "not_found", "no such plan action");
  }

  const qm = path.match(/^\/api\/questions\/([0-9a-f-]{36})\/(resolve|reopen)$/);
  if (qm && m === "POST") {
    const r = await rpc<Record<string, unknown>>(db, "set_question", { p_user_id: userId, p_comment_id: qm[1], p_resolve: qm[2] === "resolve", p_note: String(body.note ?? "").slice(0, 2000) });
    return r.ok ? json(r) : fromFail(r);
  }

  // ---------------------------------------------------------------- trades
  if (path === "/api/trades" && m === "GET") {
    let q = db.from("receipts").select("*, plans!inner(title, ticker, is_demo)").eq("user_id", userId).order("attempted_at", { ascending: false }).limit(500);
    for (const k of ["outcome", "mode"] as const) if (url.searchParams.get(k)) q = q.eq(k, url.searchParams.get(k)!);
    if (url.searchParams.get("ticker")) q = q.eq("plans.ticker", url.searchParams.get("ticker")!.toUpperCase());
    const { data } = await q;
    return json({
      receipts: (data ?? []).map((r) => ({
        receipt_id: r.receipt_id, plan_id: r.plan_id, version: r.version, title: r.plans.title, ticker: r.plans.ticker, is_demo: r.plans.is_demo, executor_id: r.executor_id,
        attempted_at: utc(r.attempted_at), mode: r.mode, outcome: r.outcome, reason_code: r.reason_code, reason_text: r.reason_text,
        robinhood_order_id: shortOrderId(r.robinhood_order_id), filled_quantity: r.filled_quantity === null ? null : Number(r.filled_quantity),
        filled_price: r.filled_price === null ? null : Number(r.filled_price), policy_snapshot_id: r.policy_snapshot_id,
      })),
    });
  }

  // ---------------------------------------------------------------- executor and live gate
  if (path === "/api/executor-status" && m === "GET") {
    const [control, execs, policy, { data: tokens }, { data: last }, { data: events }] = await Promise.all([
      boardControl(db, userId), executorsView(db, userId), currentPolicy(db, userId),
      db.from("executor_tokens").select("id, executor_id, label, created_at, last_used_at").eq("user_id", userId).is("revoked_at", null).order("created_at"),
      db.from("receipts").select("receipt_id, plan_id, attempted_at, mode, outcome, reason_code, reason_text").eq("user_id", userId).order("attempted_at", { ascending: false }).limit(1),
      db.from("audit_log").select("event_id, actor_type, actor_id, action, details_json, created_at").eq("user_id", userId).or("action.like.executor.%,action.like.live.%,action.like.control.%").order("event_id", { ascending: false }).limit(30),
    ]);
    return json({
      control, executors: execs, policy: { policy_version: policy.policy_version, allow_live_without_model_check: policy.policy.allow_live_without_model_check, first_live_order_max_usd: policy.policy.first_live_order_max_usd },
      tokens: tokens ?? [], last_receipt: last?.[0] ? { ...last[0], attempted_at: utc(last[0].attempted_at) } : null,
      events: (events ?? []).map((e) => ({ ...e, details_json: utcDeep(e.details_json), at: utc(e.created_at) })), market_date: marketDate(new Date()),
    });
  }

  if (path === "/api/control" && m === "POST") {
    const action = String(body.action ?? "");
    const now = new Date().toISOString();
    if (["kill", "dry_run_off"].includes(action) && body.confirm !== true) return problem(422, "confirm_required", "confirm this in the dialog");
    let patch: Record<string, unknown>;
    switch (action) {
      case "pause": patch = { paused: true }; break;
      case "resume": patch = { paused: false, killed: false }; break;
      case "kill": patch = { killed: true, paused: true }; break;
      case "dry_run_on": patch = { dry_run: true }; break;
      case "dry_run_off": {
        const c = await boardControl(db, userId);
        if (!c.gate.complete) return problem(422, "live_gate_incomplete", "finish the live-mode checklist first", { gate: c.gate });
        if (c.killed) return problem(422, "killed", "the executor is killed: resume it first");
        patch = { dry_run: false };
        break;
      }
      default: return problem(400, "bad_request", "action must be pause, resume, kill, dry_run_on or dry_run_off");
    }
    await db.from("control").update({ ...patch, updated_at: now }).eq("user_id", userId);
    await audit(`control.${action}`, null, patch);
    const { gate: _g, ...ctl } = await boardControl(db, userId);
    return json({ ok: true, control: ctl });
  }

  if (path === "/api/live-gate" && m === "POST") {
    // §12.2: the owner confirms the account (as the executor reports it, masked), funding, policy and approvals mode.
    const policy = await currentPolicy(db, userId);
    const mask = String(body.account_mask ?? "");
    const funding = Number(body.funding_usd);
    const mode = String(body.approvals_mode ?? "");
    if (!/^••••[0-9A-Za-z]{1,4}$/.test(mask)) return problem(422, "bad_account", "confirm the masked account the executor reports (••••1234)");
    if (!(funding > 0)) return problem(422, "bad_funding", "funding cap must be a positive amount");
    if (mode !== "A" && mode !== "B") return problem(422, "bad_mode", "approvals mode is A or B");
    if (Number(body.policy_version) !== policy.policy_version) return problem(409, "policy_changed", `the policy is now v${policy.policy_version}: review it again`);
    if (body.acknowledge !== true) return problem(422, "confirm_required", "confirm you remain responsible for every trade");
    await db.from("control").update({ confirmed_account_mask: mask, funding_usd: funding, approvals_mode: mode, gate_policy_version: policy.policy_version, gate_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId);
    await audit("control.live_gate_confirmed", null, { account_mask: mask, funding_usd: funding, approvals_mode: mode, policy_version: policy.policy_version });
    const c = await boardControl(db, userId);
    return json({ ok: true, gate: c.gate });
  }

  if (path === "/api/executor-tokens" && m === "POST") {
    const executorId = String(body.executor_id ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,47}$/.test(executorId)) return problem(422, "bad_executor_id", "executor id: lowercase letters, digits, . _ -");
    const token = randomToken(PREFIX.executor);
    const { data, error } = await db.from("executor_tokens").insert({ token_hash: await sha256(token), user_id: userId, executor_id: executorId, label: String(body.label ?? executorId).slice(0, 60) }).select("id").single();
    if (error) return problem(500, "internal", "couldn't make a credential");
    await audit("token.executor_issued", null, { executor_id: executorId, token_id: data.id });
    return json({ id: data.id, executor_id: executorId, token }, 201);
  }
  const et = path.match(/^\/api\/executor-tokens\/([0-9a-f-]{36})$/);
  if (et && m === "DELETE") {
    await db.from("executor_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", et[1]).eq("user_id", userId);
    await audit("token.executor_revoked", null, { token_id: et[1] });
    return json({ ok: true });
  }

  // ---------------------------------------------------------------- policy
  if (path === "/api/policy" && m === "GET") {
    const { data } = await db.from("policy_versions").select("*").eq("user_id", userId).order("policy_version", { ascending: false }).limit(100);
    return json({ current: (await currentPolicy(db, userId)), history: (data ?? []).map((v) => ({ ...v, created_at: utc(v.created_at) })) });
  }
  if (path === "/api/policy" && m === "POST") {
    if (body.confirm !== true) return problem(422, "confirm_required", "confirm the new policy in the dialog");
    const current = await currentPolicy(db, userId);
    const next = { ...(body.policy as Policy), policy_version: current.policy_version + 1 };
    const issues = checkPolicy(next);
    if (issues.length) return problem(422, "invalid_policy", issues.map((i) => `${i.field}: ${i.message}`).join("; "), { issues });
    const { error } = await db.from("policy_versions").insert({ user_id: userId, policy_version: next.policy_version, policy: next, note: String(body.note ?? "").slice(0, 500) });
    if (error) return problem(409, "version_conflict", "the policy changed meanwhile: reload");
    const changed = Object.keys(next).filter((k) => JSON.stringify((next as unknown as Record<string, unknown>)[k]) !== JSON.stringify((current.policy as unknown as Record<string, unknown>)[k]) && k !== "policy_version");
    await audit("policy.changed", null, { policy_version: next.policy_version, changed });
    await sweep(db);
    return json({ ok: true, policy_version: next.policy_version, changed }, 201);
  }

  // ---------------------------------------------------------------- agents and their access
  if (path === "/api/agents" && m === "GET") {
    const [{ data: agents }, { data: tokens }, grants] = await Promise.all([
      db.from("agents").select("*").eq("user_id", userId).order("created_at"),
      db.from("agent_tokens").select("id, agent_id, label, created_at, last_used_at").eq("user_id", userId).is("revoked_at", null).order("created_at"),
      oauth.listUserGrants(userId),
    ]);
    const rows = await Promise.all(grants.items.map(async (g) => {
      const client = await oauth.lookupClient(g.clientId).catch(() => null);
      return { id: g.id, agent_id: (g.metadata as { agent_id?: string } | undefined)?.agent_id ?? null, client_name: client?.clientName ?? null, created_at: new Date(g.createdAt * 1000).toISOString() };
    }));
    return json({ agents: agents ?? [], tokens: tokens ?? [], grants: rows });
  }
  if (path === "/api/agents" && m === "POST") {
    const agentId = String(body.agent_id ?? "").trim();
    const err = checkAgentId(agentId);
    if (err) return problem(422, "bad_agent_id", err);
    const { error } = await db.from("agents").upsert({ user_id: userId, agent_id: agentId, display_name: String(body.display_name ?? agentId).slice(0, 40), revoked_at: null });
    if (error) return problem(500, "internal", "couldn't save the agent");
    await audit("agent.registered", null, { agent_id: agentId });
    return json({ ok: true, agent_id: agentId }, 201);
  }
  const am = path.match(/^\/api\/agents\/([a-z][a-z0-9_-]{1,31})\/(tokens|revoke)$/);
  if (am && m === "POST") {
    const [, agentId, what] = am;
    const { data: a } = await db.from("agents").select("agent_id, revoked_at").eq("user_id", userId).eq("agent_id", agentId).maybeSingle();
    if (!a) return problem(404, "not_found", "no such agent");
    if (what === "tokens") {
      if (a.revoked_at) return problem(422, "revoked", "this agent is revoked: register it again first");
      const token = randomToken(PREFIX.agent);
      const { data, error } = await db.from("agent_tokens").insert({ token_hash: await sha256(token), user_id: userId, agent_id: agentId, label: String(body.label ?? "token").slice(0, 60) }).select("id").single();
      if (error) return problem(500, "internal", "couldn't make a token");
      await audit("token.agent_issued", null, { agent_id: agentId, token_id: data.id });
      return json({ id: data.id, agent_id: agentId, token }, 201);
    }
    await db.from("agents").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("agent_id", agentId);
    await db.from("agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("agent_id", agentId).is("revoked_at", null);
    const grants = await oauth.listUserGrants(userId);
    for (const g of grants.items) if ((g.metadata as { agent_id?: string } | undefined)?.agent_id === agentId) await oauth.revokeGrant(g.id, userId);
    await audit("agent.revoked", null, { agent_id: agentId });
    return json({ ok: true });
  }
  const at = path.match(/^\/api\/agent-tokens\/([0-9a-f-]{36})$/);
  if (at && m === "DELETE") {
    await db.from("agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", at[1]).eq("user_id", userId);
    await audit("token.agent_revoked", null, { token_id: at[1] });
    return json({ ok: true });
  }
  const gm = path.match(/^\/api\/grants\/([^/]+)$/);
  if (gm && m === "DELETE") {
    await oauth.revokeGrant(decodeURIComponent(gm[1]), userId);
    await audit("grant.revoked", null, { grant_id: gm[1] });
    return json({ ok: true });
  }

  if (path === "/api/audit" && m === "GET") {
    let q = db.from("audit_log").select("event_id, actor_type, actor_id, action, plan_id, details_json, created_at").eq("user_id", userId).order("event_id", { ascending: false }).limit(Math.min(Number(url.searchParams.get("limit") ?? 200), 1000));
    if (url.searchParams.get("plan_id")) q = q.eq("plan_id", url.searchParams.get("plan_id")!);
    const { data } = await q;
    return json({ events: (data ?? []).map((e) => ({ ...e, details_json: utcDeep(e.details_json), at: utc(e.created_at) })) });
  }

  if (path === "/api/account" && m === "DELETE") {
    // Everything the board holds for this user, history included, plus their agents' OAuth grants.
    // The sign-in itself is a HEJI account shared with other apps, so it stays.
    if (body.confirm !== true && url.searchParams.get("confirm") !== "1") return problem(422, "confirm_required", "confirm deleting your board");
    const grants = await oauth.listUserGrants(userId);
    for (const g of grants.items) await oauth.revokeGrant(g.id, userId);
    const r = await rpc<{ plans_deleted: number }>(db, "delete_account", { p_user_id: userId });
    return r.ok ? json({ ok: true, plans_deleted: r.plans_deleted }, 200, { "Set-Cookie": clearCookie(env) }) : problem(500, "internal", "couldn't delete everything: try again");
  }

  return problem(404, "not_found", "no such endpoint");
}
