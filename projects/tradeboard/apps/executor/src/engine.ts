// The executor loop (§9.1), in the PRD's order: heartbeat, poll, claim, gates, deterministic policy
// validation, fresh re-quote and drift, local model sanity check, then (live only) account and
// approvals-mode checks, place, read back, receipt. Every failure ends in "no order" with a receipt
// or a released claim (§11.4). Dependencies are injected so the tests drive it end to end.
import { appendFileSync } from "node:fs";
import {
  checkDrift, checkPolicy, idempotencyKey, inExtendedHours, inRegularHours, calendarKnown, marketDate, maskAccount, validateForExecution,
  type BoardControl, type ExecPlan, type ExecutorHeartbeat, type OrderTicket, type Policy, type ReasonCode, type ReceiptInput,
} from "@tradeboard/core";
import { BoardError, type Board } from "./board.ts";
import { FAILED_STATES, UncertainError, type Brokerage, type OrderRead, type Quote, type RhOrderRequest } from "./brokerage.ts";
import type { SanityChecker } from "./model.ts";

/** Set by the release bundle (scripts/build.mjs); "dev" when run from source. */
export const EXECUTOR_VERSION = process.env.TRADEBOARD_EXECUTOR_VERSION ?? "dev";
/** A quote older than this during the session is too old to trade on (§6.5.3). */
const QUOTE_MAX_AGE_MS = 5 * 60_000;

export interface EngineDeps {
  executorId: string;
  accountNumber: string;
  allowLive: boolean;
  maxPlansPerLoop: number;
  board: Board;
  /** null when Robinhood isn't connected (signed out, unreachable). */
  broker: () => Brokerage | null;
  model: SanityChecker | null;
  now?: () => Date;
  killFile?: () => boolean;
  journalPath?: string | null;
  log?: (s: string) => void;
  savePolicy?: (p: { policy_version: number; policy: Policy }) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface Outcome {
  plan_id: string;
  result: "skipped" | "released" | "receipt" | "claim_failed";
  detail: string;
  receipt?: Partial<ReceiptInput>;
}

export class Engine {
  d: Required<Omit<EngineDeps, "model" | "journalPath" | "savePolicy">> & Pick<EngineDeps, "model" | "journalPath" | "savePolicy">;
  policy: { policy_version: number; policy: Policy } | null = null;
  control: BoardControl | null = null;
  lastError: string | null = null;
  tradeApprovals: "on" | "off" | "unknown" = "unknown";
  accountMask: string | null = null;
  accountMatches: boolean | null = null;
  private accountCheckedAt = 0;

  constructor(deps: EngineDeps) {
    this.d = {
      now: () => new Date(), killFile: () => false, log: () => {}, sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      ...deps,
    } as Engine["d"];
  }

  private stopped(): string | null {
    if (this.d.killFile()) return "local KILL file present";
    if (!this.control) return "no word from the board yet";
    if (this.control.killed) return "killed from the portal";
    if (this.control.paused) return "paused from the portal";
    return null;
  }

  /** Live needs every switch (§12.2): the owner's board switch and gate, the local opt-in, Robinhood, the matching account, the model (or the policy's explicit waiver). */
  liveBlockers(p?: ExecPlan): string[] {
    const why: string[] = [];
    const c = this.control;
    if (!c || c.dry_run) why.push("dry-run is on (portal)");
    if (c && !c.live_gate_complete) why.push("live-mode checklist incomplete");
    if (!this.d.allowLive) why.push("live isn't enabled on this machine (allow_live)");
    if (!this.d.broker()) why.push("Robinhood isn't connected");
    if (!this.d.model && !this.policy?.policy.allow_live_without_model_check) why.push("model check is off and the policy doesn't allow live without it");
    if (c && this.accountMask !== c.confirmed_account_mask) why.push("the account doesn't match the one confirmed in the portal");
    if (this.accountMatches === false) why.push("the configured account isn't Robinhood's agentic account");
    if (p?.is_demo) why.push("DEMO plans only run in dry-run");
    return why;
  }

  /** Refreshes what the executor knows about the account (every 5 minutes, and before live orders). */
  async refreshAccount(force = false) {
    const b = this.d.broker();
    if (!b) return;
    if (!force && Date.now() - this.accountCheckedAt < 5 * 60_000) return;
    try {
      const accts = await b.accounts();
      const mine = accts.find((a) => a.account_number === this.d.accountNumber);
      this.accountMatches = !!mine && mine.agentic_allowed;
      this.accountMask = mine ? maskAccount(mine.account_number) : null;
      this.tradeApprovals = mine ? await b.tradeApprovals(mine.account_number).catch(() => "unknown" as const) : "unknown";
      this.accountCheckedAt = Date.now();
    } catch (e) {
      this.lastError = `Robinhood account read failed: ${(e as Error).message}`;
    }
  }

  heartbeatBody(): ExecutorHeartbeat {
    const live = this.liveBlockers().length === 0;
    return {
      executor_id: this.d.executorId, mode: live ? "live" : "dry_run", paused: this.stopped() !== null, dry_run: !live,
      policy_version: this.policy?.policy_version ?? null, local_model_id: this.d.model?.id ?? null, model_check_enabled: !!this.d.model,
      local_live_allowed: this.d.allowLive, robinhood_connected: !!this.d.broker(), trade_approvals: this.tradeApprovals,
      account_mask: this.accountMask, account_matches: this.accountMatches, last_error: this.lastError, version: EXECUTOR_VERSION,
    };
  }

  async heartbeat(): Promise<void> {
    await this.refreshAccount();
    try {
      const r = await this.d.board.heartbeat(this.heartbeatBody());
      this.control = r.control;
    } catch (e) {
      this.d.log(`heartbeat failed: ${(e as Error).message}`);
    }
  }

  /** Loads a newer policy between plans (never mid-plan). An invalid policy stops execution. */
  private adoptPolicy(p: { policy_version: number; policy: Policy }) {
    if (this.policy?.policy_version === p.policy_version) return;
    const issues = checkPolicy(p.policy);
    if (issues.length) {
      this.policy = null;
      this.lastError = `policy v${p.policy_version} refused: ${issues.map((i) => i.field).join(", ")}`;
      return;
    }
    this.policy = p;
    this.d.savePolicy?.(p);
    this.d.log(`policy v${p.policy_version} loaded`);
  }

  /** One loop iteration. Returns what happened to each plan it looked at. */
  async iterate(): Promise<Outcome[]> {
    const stop = this.stopped();
    if (stop && this.control) {
      this.d.log(`not claiming: ${stop}`);
      return [];
    }
    let poll;
    try {
      poll = await this.d.board.poll();
    } catch (e) {
      this.lastError = `board poll failed: ${(e as Error).message}`;
      return [];
    }
    this.control = poll.control;
    this.adoptPolicy(poll.policy);
    if (!this.policy) return [];
    const stopNow = this.stopped();
    if (stopNow) {
      this.d.log(`not claiming: ${stopNow}`);
      return [];
    }
    const out: Outcome[] = [];
    for (const r of poll.recovery) out.push(await this.recover(r));
    for (const p of poll.plans.slice(0, this.d.maxPlansPerLoop)) out.push(await this.process(p));
    if (out.some((o) => o.result === "receipt")) this.lastError = this.lastError?.startsWith("board poll") ? null : this.lastError;
    return out;
  }

  private marketOpenFor(t: OrderTicket, policy: Policy, now: Date): boolean {
    if (!calendarKnown(marketDate(now))) return false;
    if (inRegularHours(now)) return true;
    return !policy.market_hours_only && inExtendedHours(now) && t.order_type === "limit";
  }

  async process(p: ExecPlan): Promise<Outcome> {
    const policy = this.policy!.policy;
    const policyVersion = this.policy!.policy_version;
    const now = this.d.now();
    // Outside market hours an approved plan waits, unclaimed, for the next session in its window (§6.5.5).
    if (!this.marketOpenFor(p.order, policy, now)) return { plan_id: p.plan_id, result: "skipped", detail: "market closed: waiting for the next session" };
    const broker = this.d.broker();
    if (!broker) {
      this.lastError = "Robinhood isn't connected: plans wait (run `tradeboard-executor auth`)";
      return { plan_id: p.plan_id, result: "skipped", detail: "Robinhood not connected" };
    }

    const key = await idempotencyKey(p.plan_id, p.current_version);
    let claim;
    try {
      claim = await this.d.board.claim(p.plan_id, key);
    } catch (e) {
      return { plan_id: p.plan_id, result: "claim_failed", detail: (e as Error).message };
    }
    const plan = claim.plan;
    const live = this.liveBlockers(plan).length === 0;
    const mode = live ? "live" : "dry_run";
    const details: Record<string, unknown> = { idempotency_key: key, live_blockers: live ? [] : this.liveBlockers(plan) };
    const receipt = async (outcome: ReceiptInput["outcome"], reason_code: ReasonCode | null, reason_text: string, extra: Partial<ReceiptInput> = {}): Promise<Outcome> => {
      const r: ReceiptInput = {
        claim_id: claim.claim_id, plan_id: plan.plan_id, version: plan.current_version, executor_id: this.d.executorId, mode: extra.mode ?? mode, outcome, reason_code, reason_text,
        robinhood_order_id: null, filled_quantity: null, filled_price: null, policy_snapshot_id: policyVersion, details, ...extra,
      };
      for (let i = 0; i < 5; i++) {
        try {
          await this.d.board.receipt(r);
          break;
        } catch (e) {
          // A receipt for a real order must not be lost: retry, and keep it in the journal meanwhile.
          this.journal({ kind: "receipt_pending", receipt: r, error: (e as Error).message });
          if (i === 4) this.lastError = `couldn't post a receipt for plan ${plan.plan_id}: ${(e as Error).message}`;
          else await this.d.sleep(2000 * (i + 1));
        }
      }
      this.d.log(`plan ${plan.plan_id.slice(0, 8)} v${plan.current_version}: ${outcome}${reason_code ? ` (${reason_code})` : ""} ${reason_text}`);
      return { plan_id: plan.plan_id, result: "receipt", detail: `${outcome}${reason_code ? ` ${reason_code}` : ""}`, receipt: r };
    };
    const release = async (note: string): Promise<Outcome> => {
      await this.d.board.release(claim.claim_id, note).catch(() => {});
      return { plan_id: plan.plan_id, result: "released", detail: note };
    };

    // ---------------------------------------------------------- step 4: gates
    const stop = this.stopped();
    if (stop) return this.control?.killed || this.d.killFile() ? receipt("rejected", "killed", stop) : release(stop);
    if (plan.status !== "approved" || !plan.approval) return release(`plan is ${plan.status}, not approved`);
    if (new Date(plan.approval.expires_at) <= now) return release("approval expired");
    if ((plan.valid_from && new Date(plan.valid_from) > now) || new Date(plan.valid_until) <= now) return release("outside the validity window");
    if (plan.open_human_questions > 0) return release("the owner has open questions");
    if (plan.approval.version !== plan.current_version) return release("plan changed since approval");
    // The owner turned live on (portal + this machine) but something blocks it: refuse rather than
    // quietly simulate, so the owner sees why (§12.1 test 11).
    const wantsLive = !!this.control && !this.control.dry_run && this.d.allowLive && !plan.is_demo;
    if (wantsLive && !live) {
      const acct = this.accountMatches === false || this.accountMask !== this.control!.confirmed_account_mask;
      return receipt("rejected", acct ? "wrong_account_rejected" : "policy_rejected", `live mode is on but blocked: ${this.liveBlockers(plan).join("; ")}`, { mode: "live" });
    }

    // ---------------------------------------------------------- re-quote (needed by the policy's market-order sizing and the drift check)
    let quote: Quote;
    try {
      quote = await broker.quote(plan.ticker);
    } catch (e) {
      return receipt("rejected", "quote_unavailable", `couldn't get a fresh quote: ${(e as Error).message}`);
    }
    if (inRegularHours(now) && now.getTime() - Date.parse(quote.at) > QUOTE_MAX_AGE_MS) return receipt("rejected", "quote_unavailable", `the latest quote is from ${quote.at}: too old to trade on`);
    details.quote = { price: quote.price, at: quote.at, bid: quote.bid, ask: quote.ask };

    // ---------------------------------------------------------- step 5: deterministic policy validation
    const position = await broker.positionUsd(this.d.accountNumber, plan.ticker, quote.price).catch(() => null);
    const today = await this.d.board.today().catch(() => null);
    let dailyLoss: number | null = 0;
    if (live) {
      dailyLoss = today ? 0 : null;
      for (const f of today?.live_fills ?? []) {
        const q = f.ticker === plan.ticker ? quote : await broker.quote(f.ticker).catch(() => null);
        if (!q) { dailyLoss = null; break; }
        dailyLoss! += Math.max(0, (f.filled_price - q.price) * f.filled_quantity);
      }
    }
    const failures = validateForExecution({
      policy, ticket: plan.order, planTicker: plan.ticker, planUpdatedAt: new Date(plan.updated_at), now, livePrice: quote.price,
      positionUsd: position, ordersToday: today ? today.orders : Number.POSITIVE_INFINITY, dailyLossUsd: dailyLoss, live, liveTrialPending: !!this.control?.live_trial_pending,
    });
    if (!today) failures.push({ rule: "max_open_plans_per_day", reason_code: "policy_rejected", message: "today's receipts couldn't be read from the board" });
    if (failures.length) {
      details.failures = failures;
      if (failures.every((f) => f.reason_code === "market_closed")) return release(failures[0].message);
      if (failures.some((f) => f.rule === "max_daily_loss_usd") && live && dailyLoss !== null) {
        await this.d.board.note(`Daily loss $${dailyLoss.toFixed(2)} is over max_daily_loss_usd $${policy.max_daily_loss_usd}: executor paused itself.`, { action: "auto_pause", planId: plan.plan_id }).catch(() => {});
      }
      const code: ReasonCode = failures.some((f) => f.reason_code === "stale_plan") && failures.every((f) => f.reason_code === "stale_plan") ? "stale_plan" : "policy_rejected";
      return receipt("rejected", code, failures.map((f) => `[${f.rule}] ${f.message}`).join("; "));
    }

    // ---------------------------------------------------------- step 6: drift (never chase the price)
    const drift = checkDrift(plan.order, plan.quote_price, quote.price, policy.max_drift_pct);
    details.drift = { pct: Number.isFinite(drift.pct) ? Number(drift.pct.toFixed(3)) : null, basis: drift.basis, max_pct: policy.max_drift_pct };
    if (!drift.ok) return receipt("rejected", "drift_rejected", drift.message);

    // ---------------------------------------------------------- step 7: local model sanity check
    if (this.d.model) {
      const v = await this.d.model.check({
        title: plan.title, ticker: plan.ticker, thesis: plan.thesis, evidence: plan.evidence, risks_and_dissent: plan.risks_and_dissent, invalidation: plan.invalidation,
        order: plan.order, quote_price: plan.quote_price, live_price: quote.price, policy,
      });
      details.model = { id: this.d.model.id, verdict: v.verdict, reasons: v.reasons, error: v.error ?? null };
      if (v.verdict !== "pass") return receipt("rejected", v.error ? "model_unavailable" : "sanity_rejected", `sanity check failed: ${v.reasons.join("; ") || "no reason given"}`);
    } else {
      details.model = { id: null, verdict: "skipped", reasons: ["model check disabled on this executor"] };
    }

    // ---------------------------------------------------------- validated
    const stepped = await this.step(claim.claim_id, "validated");
    if (stepped !== true) return stepped === "paused" ? release("paused before validation") : stepped === "killed" ? receipt("rejected", "killed", "killed before validation") : { plan_id: plan.plan_id, result: "released", detail: `board refused validated: ${stepped}` };

    const rh = toRobinhood(plan.order, this.d.accountNumber, policy.market_hours_only || inRegularHours(now) ? "regular_hours" : "extended_hours");
    details.robinhood_request = { ...rh, account_number: maskAccount(rh.account_number) };

    // ---------------------------------------------------------- dry-run stops here (step 4f)
    if (!live) return receipt("simulated", null, `dry-run: would place ${describe(rh)} at a live price of $${quote.price.toFixed(2)} (${drift.message})`, { mode: "dry_run" });

    // ---------------------------------------------------------- step 8: live
    await this.refreshAccount(true);
    if (!this.accountMatches || this.accountMask !== this.control?.confirmed_account_mask) {
      return receipt("rejected", "wrong_account_rejected", "the configured account isn't Robinhood's agentic account, or isn't the one confirmed in the portal");
    }
    if (this.control?.approvals_mode === "A" && this.tradeApprovals === "on") {
      return receipt("rejected", "robinhood_error", "Robinhood trade approvals are ON but the portal is set to Mode A: turn approvals off in the Robinhood app, or choose Mode B");
    }
    let review;
    try {
      review = await broker.review(rh);
    } catch (e) {
      return receipt("rejected", "robinhood_error", `order review failed: ${(e as Error).message}`);
    }
    details.review = review;
    if (review.alerts.length) return receipt("rejected", "robinhood_error", `Robinhood pre-trade alerts: ${review.alerts.join("; ")}`);
    if (this.d.killFile()) return receipt("rejected", "killed", "local KILL file appeared before the order");
    const go = await this.step(claim.claim_id, "executing");
    if (go !== true) return go === "paused" ? release("paused before the order") : go === "killed" ? receipt("rejected", "killed", "killed before the order") : { plan_id: plan.plan_id, result: "released", detail: `board refused executing: ${go}` };

    const startedAt = this.d.now();
    this.journal({ kind: "placing", plan_id: plan.plan_id, version: plan.current_version, ref_id: key, claim_id: claim.claim_id });
    const placed = await this.placeSafely(broker, rh, key, plan.order, startedAt);
    if (placed.kind === "uncertain") {
      await this.d.board.note(`Order outcome for plan ${plan.plan_id} is unknown (${placed.message}). Executor paused itself: check Robinhood before resuming.`, { action: "auto_pause", planId: plan.plan_id }).catch(() => {});
      this.journal({ kind: "uncertain", ref_id: key, message: placed.message });
      return receipt("failed", "order_failed", `order outcome unknown after a retry with the same ref_id: ${placed.message}. Check Robinhood.`);
    }
    if (placed.kind === "error") return receipt("failed", "robinhood_error", `Robinhood refused the order: ${placed.message}`);
    if (placed.proposal || review.customer_approval_required) {
      this.journal({ kind: "proposed", ref_id: key, order_id: placed.order_id });
      return receipt("proposed", "proposal_only", "Robinhood trade approvals are on: the order is a proposal in your Robinhood app. Place it there, then mark the plan manually filled.", { robinhood_order_id: placed.order_id });
    }
    return this.readBack(broker, plan, placed.order_id, key, receipt);
  }

  /** place → (if the reply is lost) read back → (only if nothing was created) one retry with the same ref_id. */
  private async placeSafely(broker: Brokerage, rh: RhOrderRequest, refId: string, t: OrderTicket, startedAt: Date): Promise<{ kind: "ok"; order_id: string | null; proposal: boolean } | { kind: "uncertain"; message: string } | { kind: "error"; message: string }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const p = await broker.place(rh, refId);
        return { kind: "ok", order_id: p.order_id, proposal: p.proposal };
      } catch (e) {
        if (!(e instanceof UncertainError)) return { kind: "error", message: (e as Error).message };
        this.d.log(`place uncertain (${(e as Error).message}): reading back before anything else`);
        const since = new Date(startedAt.getTime() - 60_000).toISOString();
        const existing = await broker.recentOrders(rh.account_number, rh.symbol, since).catch(() => null);
        if (existing === null) return { kind: "uncertain", message: "the read-back failed too" };
        const match = existing.find((o) => matchesTicket(o, t));
        if (match) return { kind: "ok", order_id: match.id, proposal: false };
        // The read-back proves no order exists: one retry, with the same ref_id so Robinhood dedupes.
        if (attempt === 1) return { kind: "uncertain", message: (e as Error).message };
      }
    }
    return { kind: "uncertain", message: "unreachable" };
  }

  private async readBack(broker: Brokerage, plan: ExecPlan, orderId: string | null, refId: string, receipt: (o: ReceiptInput["outcome"], c: ReasonCode | null, t: string, x?: Partial<ReceiptInput>) => Promise<Outcome>): Promise<Outcome> {
    let order: OrderRead | null = null;
    if (orderId) {
      for (let i = 0; i < 4 && !order; i++) {
        order = await broker.order(this.d.accountNumber, orderId).catch(() => null);
        if (!order) await this.d.sleep(1500);
      }
    }
    if (!order) {
      await this.d.board.note(`Placed plan ${plan.plan_id} but couldn't read the order back (${orderId ?? "no id returned"}). Executor paused itself: check Robinhood.`, { action: "auto_pause", planId: plan.plan_id }).catch(() => {});
      return receipt("failed", "readback_mismatch", `no read-back for order ${orderId ?? "(no id returned)"}: check Robinhood`, { robinhood_order_id: orderId });
    }
    this.journal({ kind: "done", ref_id: refId, order_id: order.id, state: order.state });
    const fill = { robinhood_order_id: order.id, filled_quantity: order.filled_quantity, filled_price: order.average_price };
    if (FAILED_STATES.has(order.state.toLowerCase())) return receipt("failed", "order_failed", `Robinhood shows the order as ${order.state}`, fill);
    if (!matchesTicket(order, plan.order)) return receipt("failed", "readback_mismatch", `the order Robinhood shows (${order.side} ${order.quantity ?? `$${order.dollar_amount}`} ${order.symbol ?? ""} ${order.type} ${order.limit_price ?? ""}) doesn't match the ticket`, fill);
    return receipt("executed", null, `Robinhood order ${order.state}${order.filled_quantity ? `: ${order.filled_quantity} filled at $${order.average_price}` : ""}`, fill);
  }

  /** §9.1 step 8 after a crash: read back only; never place on recovery. */
  async recover(p: ExecPlan): Promise<Outcome> {
    const broker = this.d.broker();
    if (!broker) return { plan_id: p.plan_id, result: "skipped", detail: "recovery waits for Robinhood" };
    let claim;
    try {
      claim = await this.d.board.claim(p.plan_id, null, true);
    } catch (e) {
      return { plan_id: p.plan_id, result: "claim_failed", detail: (e as Error).message };
    }
    const since = new Date(new Date(p.attempt_started_at ?? p.updated_at).getTime() - 60_000).toISOString();
    const post = async (outcome: ReceiptInput["outcome"], reason_code: ReasonCode | null, text: string, x: Partial<ReceiptInput> = {}): Promise<Outcome> => {
      const r: ReceiptInput = { claim_id: claim.claim_id, plan_id: p.plan_id, version: p.current_version, executor_id: this.d.executorId, mode: "live", outcome, reason_code, reason_text: text, robinhood_order_id: null, filled_quantity: null, filled_price: null, policy_snapshot_id: this.policy?.policy_version ?? null, details: { recovery: true }, ...x };
      await this.d.board.receipt(r);
      return { plan_id: p.plan_id, result: "receipt", detail: `recovery ${outcome}`, receipt: r };
    };
    const orders = await broker.recentOrders(this.d.accountNumber, p.ticker, since).catch(() => null);
    if (orders === null) return { plan_id: p.plan_id, result: "skipped", detail: "recovery read-back failed; will retry" };
    const match = orders.find((o) => matchesTicket(o, p.order));
    if (!match) return post("failed", "claim_expired", "an attempt was interrupted; Robinhood shows no order for it, so nothing was placed and nothing is retried");
    return this.readBack(broker, p, match.id, p.claim?.idempotency_key ?? "", post);
  }

  private async step(claimId: string, to: "validated" | "executing"): Promise<true | string> {
    try {
      await this.d.board.step(claimId, to);
      return true;
    } catch (e) {
      return e instanceof BoardError ? e.code : (e as Error).message;
    }
  }

  private journal(entry: Record<string, unknown>) {
    if (!this.d.journalPath) return;
    try {
      appendFileSync(this.d.journalPath, `${JSON.stringify({ at: this.d.now().toISOString(), ...entry })}\n`, { mode: 0o600 });
    } catch { /* the board's receipts are the record; the journal only helps a human after a crash */ }
  }
}

const fixed = (n: number, d: number) => String(Number(n.toFixed(d)));

/** The ticket as Robinhood's place_equity_order arguments: day → gfd; exactly the ticket, nothing chosen here. */
export function toRobinhood(t: OrderTicket, account: string, session: "regular_hours" | "extended_hours"): RhOrderRequest {
  const r: RhOrderRequest = { account_number: account, symbol: t.ticker, side: "buy", type: t.order_type, time_in_force: "gfd", market_hours: session };
  if (t.quantity_shares !== null) r.quantity = fixed(t.quantity_shares, 6);
  if (t.quantity_dollars !== null) r.dollar_amount = t.quantity_dollars.toFixed(2);
  if (t.limit_price !== null) r.limit_price = fixed(t.limit_price, 4);
  if (t.stop_price !== null && t.stop_price !== undefined) r.stop_price = fixed(t.stop_price, 4);
  return r;
}

const describe = (r: RhOrderRequest) => `${r.side} ${r.quantity ?? `$${r.dollar_amount}`} ${r.symbol} ${r.type}${r.limit_price ? ` @ ${r.limit_price}` : ""}${r.stop_price ? ` stop ${r.stop_price}` : ""} ${r.time_in_force}`;

const close = (a: number | null, b: number | null | undefined) => a !== null && b !== null && b !== undefined && Math.abs(a - b) < 1e-6;

/** Does Robinhood's order say exactly what the ticket says (§10 order verification)? */
export function matchesTicket(o: OrderRead, t: OrderTicket): boolean {
  if (o.symbol !== null && o.symbol.toUpperCase() !== t.ticker) return false;
  if (o.side !== null && o.side.toLowerCase() !== t.side) return false;
  if (o.type !== null && !o.type.toLowerCase().startsWith(t.order_type.split("_")[0])) return false;
  if (t.quantity_shares !== null && !close(o.quantity, t.quantity_shares)) return false;
  if (t.quantity_dollars !== null && !close(o.dollar_amount, t.quantity_dollars) && o.dollar_amount !== null) return false;
  if ((t.order_type === "limit" || t.order_type === "stop_limit") && !close(o.limit_price, t.limit_price)) return false;
  return true;
}
