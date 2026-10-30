// The executor's endpoints (§7.2), under /api/executor/*, for `tbx_…` credentials only. Agent tokens
// and the owner's cookie are refused here (index.ts routes by credential kind before this runs).
import { idempotencyKey, marketDate, type BoardControl, type ExecPlan, type ExecutorHeartbeat, type ReceiptInput } from "@tradeboard/core";
import { fieldsOf, utc, type PlanRow } from "./board.ts";
import { audit, CLAIM_TTL_SEC, currentPolicy, json, problem, rpc, statusFor, sweep, type Db } from "./store.ts";

export async function boardControl(db: Db, userId: string): Promise<BoardControl & { gate: GateState }> {
  await currentPolicy(db, userId); // ensures the control row exists
  const { data: c } = await db.from("control").select("*").eq("user_id", userId).single();
  const gate = await gateState(db, userId, c);
  return {
    paused: c.paused, killed: c.killed, dry_run: c.dry_run, live_gate_complete: gate.complete, live_trial_pending: c.live_trial_pending,
    approvals_mode: c.approvals_mode, confirmed_account_mask: c.confirmed_account_mask, gate,
  };
}

export interface GateState {
  complete: boolean;
  items: { id: string; label: string; done: boolean; detail: string }[];
}

/** §12.2 and §15: what the owner must confirm before live mode, each shown as pending until done. */
export async function gateState(db: Db, userId: string, c: Record<string, unknown>): Promise<GateState> {
  const policy = await currentPolicy(db, userId);
  const { data: execs } = await db.from("executor_status").select("*").eq("user_id", userId).order("last_heartbeat_at", { ascending: false }).limit(1);
  const ex = execs?.[0] as Record<string, unknown> | undefined;
  const items = [
    { id: "account", label: "Dedicated account confirmed", done: !!c.confirmed_account_mask && ex?.account_mask === c.confirmed_account_mask, detail: c.confirmed_account_mask ? `account ${c.confirmed_account_mask}${ex?.account_mask && ex.account_mask !== c.confirmed_account_mask ? ` (executor reports ${ex.account_mask})` : ""}` : "not confirmed" },
    { id: "funding", label: "Funding cap confirmed", done: c.funding_usd !== null && c.funding_usd !== undefined, detail: c.funding_usd !== null && c.funding_usd !== undefined ? `$${Number(c.funding_usd).toLocaleString("en-US")}` : "not confirmed" },
    { id: "policy", label: "Policy values confirmed", done: c.gate_policy_version === policy.policy_version, detail: c.gate_policy_version ? `confirmed v${c.gate_policy_version}, current v${policy.policy_version}` : "not confirmed" },
    { id: "approvals", label: "Robinhood trade-approvals mode chosen", done: c.approvals_mode === "A" || c.approvals_mode === "B", detail: c.approvals_mode ? `Mode ${c.approvals_mode}${ex?.trade_approvals && ex.trade_approvals !== "unknown" ? ` (Robinhood reports approvals ${ex.trade_approvals})` : ""}` : "not chosen" },
  ];
  return { complete: items.every((i) => i.done), items };
}

function execPlan(p: PlanRow, openHuman: number, approval: Record<string, unknown> | null): ExecPlan {
  const f = fieldsOf(p);
  return {
    plan_id: p.plan_id, title: p.title, status: p.status, ticker: p.ticker, order: f.order, thesis: p.thesis, evidence: p.evidence,
    risks_and_dissent: p.risks_and_dissent, invalidation: p.invalidation, valid_from: utc(p.valid_from), valid_until: utc(p.valid_until)!,
    quote_price: f.quote_price, quote_at: utc(p.quote_at), quote_source: p.quote_source, current_version: p.current_version, updated_at: utc(p.updated_at)!,
    is_demo: p.is_demo, open_human_questions: openHuman,
    approval: approval ? { approval_id: approval.approval_id as string, version: approval.version as number, approved_at: utc(approval.approved_at as string)!, expires_at: utc(approval.expires_at as string)! } : null,
    claim: p.executor_claim_id ? { claim_id: p.executor_claim_id, executor_id: p.claim_executor_id!, expires_at: utc(p.claim_expires_at)!, idempotency_key: p.claim_idempotency_key! } : null,
    attempt_started_at: utc(p.attempt_started_at),
  };
}

async function withDetails(db: Db, plans: PlanRow[]): Promise<ExecPlan[]> {
  if (!plans.length) return [];
  const ids = plans.map((p) => p.plan_id);
  const [{ data: qs }, { data: approvals }] = await Promise.all([
    db.from("comments").select("plan_id").in("plan_id", ids).eq("is_question", true).eq("question_status", "open").eq("author_type", "human"),
    db.from("approvals").select("*").in("plan_id", ids).is("voided_at", null),
  ]);
  return plans.map((p) => execPlan(p, (qs ?? []).filter((q) => q.plan_id === p.plan_id).length, (approvals ?? []).find((a) => a.approval_id === p.approval_id) ?? null));
}

/** The executor's endpoints. `userId` is the credential's owner: an executor only ever sees that user's board. */
export async function handleExecutor(req: Request, db: Db, executorId: string, userId: string, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/executor/, "");
  const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};

  if (path === "/poll" && req.method === "POST") {
    await sweep(db);
    const now = new Date();
    const [control, policy, { data: approved }, { data: executing }] = await Promise.all([
      boardControl(db, userId), currentPolicy(db, userId),
      db.from("plans").select("*").eq("user_id", userId).eq("status", "approved").gt("valid_until", now.toISOString()),
      db.from("plans").select("*").eq("user_id", userId).eq("status", "executing").eq("awaiting_manual", false).lt("claim_expires_at", now.toISOString()),
    ]);
    // Only plans whose window has started (valid_from is optional).
    const ready = ((approved ?? []) as PlanRow[]).filter((p) => !p.valid_from || new Date(p.valid_from) <= now);
    const plans = (await withDetails(db, ready)).filter((p) => p.approval && new Date(p.approval.expires_at) > now).sort((a, b) => a.approval!.approved_at.localeCompare(b.approval!.approved_at));
    const { gate: _g, ...ctl } = control;
    return json({ now: now.toISOString(), control: ctl, policy: { policy_version: policy.policy_version, policy: policy.policy }, plans, recovery: await withDetails(db, (executing ?? []) as PlanRow[]) });
  }

  if (path === "/claim" && req.method === "POST") {
    const planId = String(body.plan_id ?? "");
    const recovery = body.recovery === true;
    const { data: p } = /^[0-9a-f-]{36}$/i.test(planId) ? await db.from("plans").select("*").eq("plan_id", planId).eq("user_id", userId).maybeSingle() : { data: null };
    if (!p) return problem(404, "not_found", "no such plan");
    if (!recovery) {
      // The key is derived from plan id + version (§9.1 step 3): a claim for an old version can't succeed.
      const expected = await idempotencyKey(planId, (p as PlanRow).current_version);
      if (body.idempotency_key !== expected) return problem(409, "plan_changed", "the idempotency key isn't this plan's current version: poll again");
    }
    const r = await rpc<{ claim_id: string; expires_at: string; idempotency_key: string }>(db, "claim_plan", {
      p_user_id: userId, p_plan_id: planId, p_executor_id: executorId, p_idempotency_key: body.idempotency_key ?? null, p_ttl_seconds: CLAIM_TTL_SEC, p_recovery: recovery,
    });
    if (!r.ok) return problem(statusFor(r.error_code), r.error_code, r.message);
    const { data: fresh } = await db.from("plans").select("*").eq("plan_id", planId).eq("user_id", userId).single();
    const [plan] = await withDetails(db, [fresh as PlanRow]);
    return json({ claim_id: r.claim_id, expires_at: utc(r.expires_at), plan });
  }

  if (path === "/step" && req.method === "POST") {
    const to = String(body.to ?? "");
    if (to !== "validated" && to !== "executing") return problem(400, "bad_request", "to must be validated or executing");
    const r = await rpc<{ status: string }>(db, "executor_step", { p_user_id: userId, p_claim_id: String(body.claim_id ?? ""), p_to: to, p_ttl_seconds: CLAIM_TTL_SEC });
    return r.ok ? json(r) : problem(statusFor(r.error_code), r.error_code, r.message);
  }

  if (path === "/release" && req.method === "POST") {
    const r = await rpc<{ status: string }>(db, "release_claim", { p_user_id: userId, p_claim_id: String(body.claim_id ?? ""), p_note: String(body.note ?? "").slice(0, 500) });
    return r.ok ? json(r) : problem(statusFor(r.error_code), r.error_code, r.message);
  }

  if (path === "/receipt" && req.method === "POST") {
    const rc = body as unknown as ReceiptInput;
    if (rc.executor_id !== executorId) return problem(403, "wrong_executor", "executor_id must be this credential's executor");
    if (!["dry_run", "live"].includes(rc.mode)) return problem(400, "bad_request", "mode must be dry_run or live (manual receipts come from the owner)");
    if (!["executed", "simulated", "rejected", "failed", "proposed"].includes(rc.outcome)) return problem(400, "bad_request", "unknown outcome");
    if (rc.mode === "dry_run" && (rc.outcome === "executed" || rc.robinhood_order_id)) return problem(400, "bad_request", "a dry-run receipt is simulated and has no order id");
    if (rc.mode === "live" && rc.outcome === "simulated") return problem(400, "bad_request", "a live receipt can't be simulated");
    if (rc.outcome === "executed" && !rc.robinhood_order_id) return problem(400, "bad_request", "an executed live receipt needs the Robinhood order id from the read-back");
    const r = await rpc<{ receipt_id: string; status: string; duplicate?: boolean }>(db, "post_receipt", {
      p_user_id: userId,
      p: {
        claim_id: rc.claim_id, plan_id: rc.plan_id, version: rc.version, executor_id: executorId, mode: rc.mode, outcome: rc.outcome, reason_code: rc.reason_code,
        reason_text: String(rc.reason_text ?? "").slice(0, 2000), robinhood_order_id: rc.robinhood_order_id, filled_quantity: rc.filled_quantity,
        filled_price: rc.filled_price, policy_snapshot_id: rc.policy_snapshot_id, details: rc.details ?? {},
      },
    });
    return r.ok ? json(r) : problem(statusFor(r.error_code), r.error_code, r.message);
  }

  if (path === "/heartbeat" && req.method === "POST") {
    const hb = body as unknown as ExecutorHeartbeat;
    if (hb.executor_id !== executorId) return problem(403, "wrong_executor", "executor_id must be this credential's executor");
    const mask = typeof hb.account_mask === "string" && /^••••[0-9A-Za-z]{1,4}$/.test(hb.account_mask) ? hb.account_mask : null;
    const row = {
      user_id: userId, executor_id: executorId, last_heartbeat_at: new Date().toISOString(), mode: hb.mode === "live" ? "live" : "dry_run", paused: !!hb.paused, dry_run: hb.dry_run !== false,
      policy_version: Number.isInteger(hb.policy_version) ? hb.policy_version : null, local_model_id: hb.local_model_id ? String(hb.local_model_id).slice(0, 120) : null,
      model_check_enabled: hb.model_check_enabled !== false, local_live_allowed: !!hb.local_live_allowed, robinhood_connected: !!hb.robinhood_connected,
      trade_approvals: ["on", "off"].includes(hb.trade_approvals) ? hb.trade_approvals : "unknown", account_mask: mask,
      account_matches: typeof hb.account_matches === "boolean" ? hb.account_matches : null, last_error: hb.last_error ? String(hb.last_error).slice(0, 500) : null,
      version: hb.version ? String(hb.version).slice(0, 40) : null,
    };
    const { data: before } = await db.from("executor_status").select("mode, last_error").eq("user_id", userId).eq("executor_id", executorId).maybeSingle();
    await db.from("executor_status").upsert(row);
    if (!before || before.mode !== row.mode) await audit(db, userId, "executor", executorId, "executor.mode", null, { mode: row.mode });
    if (row.last_error && before?.last_error !== row.last_error) await audit(db, userId, "executor", executorId, "executor.error", null, { error: row.last_error });
    const { gate: _g, ...ctl } = await boardControl(db, userId);
    return json({ control: ctl });
  }

  if (path === "/today" && req.method === "GET") {
    const day = marketDate(new Date());
    const since = new Date(Date.now() - 36 * 3_600_000).toISOString();
    const { data } = await db.from("receipts").select("attempted_at, mode, outcome, filled_quantity, filled_price, plan_id").eq("user_id", userId).gte("attempted_at", since);
    const today = (data ?? []).filter((r) => marketDate(new Date(r.attempted_at as string)) === day);
    const counted = today.filter((r) => ["executed", "simulated", "proposed"].includes(r.outcome as string) && r.mode !== "manual");
    const live = today.filter((r) => r.mode === "live" && r.outcome === "executed" && r.filled_quantity !== null && r.filled_price !== null);
    const tickers = live.length ? (await db.from("plans").select("plan_id, ticker").eq("user_id", userId).in("plan_id", live.map((r) => r.plan_id))).data ?? [] : [];
    return json({
      market_date: day, orders: counted.length,
      live_fills: live.map((r) => ({ ticker: tickers.find((t) => t.plan_id === r.plan_id)?.ticker ?? "", filled_quantity: Number(r.filled_quantity), filled_price: Number(r.filled_price) })),
    });
  }

  if (path === "/note" && req.method === "POST") {
    // The executor's own stop (§9.2 daily loss): it may pause, never resume or unkill.
    const text = String(body.text ?? "").slice(0, 2000);
    const planId = typeof body.plan_id === "string" && /^[0-9a-f-]{36}$/i.test(body.plan_id) ? body.plan_id : null;
    if (body.action === "auto_pause") {
      await db.from("control").update({ paused: true, updated_at: new Date().toISOString() }).eq("user_id", userId);
      await audit(db, userId, "executor", executorId, "executor.auto_paused", null, { reason: text });
    } else {
      await audit(db, userId, "executor", executorId, "executor.note", null, { text, plan_id: planId });
    }
    if (planId) {
      await db.rpc("add_comment", { p_user_id: userId, p_plan_id: planId, p_actor_type: "executor", p_actor_id: executorId, p_body: text || "executor note", p_anchor: "general", p_parent: null, p_is_question: false, p_mentioned: null });
    }
    return json({ ok: true });
  }

  return problem(404, "not_found", "no such executor endpoint");
}
