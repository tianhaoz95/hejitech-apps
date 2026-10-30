// The executor loop against a fake board, a fake Robinhood and a fake model (PRD §12.1 tests 2, 6–8,
// 10–12 on the executor's side; the board's side runs in scripts/test-api.mjs against the real Worker).
import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, idempotencyKey, type BoardControl, type ExecPlan, type OrderTicket, type Policy, type ReceiptInput } from "@tradeboard/core";
import { BoardError, type Board } from "../src/board.ts";
import { UncertainError, type Brokerage, type OrderRead, type RhOrderRequest } from "../src/brokerage.ts";
import { Engine, matchesTicket, toRobinhood } from "../src/engine.ts";
import type { SanityChecker } from "../src/model.ts";

const NOW = new Date("2026-10-28T15:00:00Z"); // Wednesday 11:00 ET
const ACCT = "5RX12345678";

const ticket = (o: Partial<OrderTicket> = {}): OrderTicket => ({
  ticker: "AAPL", side: "buy", order_type: "limit", quantity_shares: 10, quantity_dollars: null, limit_price: 285, stop_price: null, time_in_force: "day", account_scope: "dedicated_mcp_account_only", ...o,
});

function plan(o: Partial<ExecPlan> = {}): ExecPlan {
  return {
    plan_id: "11111111-1111-4111-8111-111111111111", title: "AAPL — add on pullback", status: "approved", ticker: "AAPL", order: ticket(),
    thesis: "Add 10 AAPL at $285 on the pullback.", evidence: "", risks_and_dissent: "", invalidation: "", valid_from: null, valid_until: "2026-10-28T20:00:00.000Z",
    quote_price: 286, quote_at: "2026-10-28T14:00:00.000Z", quote_source: "agent (agent-provided, unverified)", current_version: 2, updated_at: "2026-10-28T14:30:00.000Z", is_demo: false,
    open_human_questions: 0, approval: { approval_id: "a1", version: 2, approved_at: "2026-10-28T14:40:00.000Z", expires_at: "2026-10-28T20:00:00.000Z" }, claim: null, ...o,
  };
}

const control = (o: Partial<BoardControl> = {}): BoardControl => ({ paused: false, killed: false, dry_run: true, live_gate_complete: false, live_trial_pending: true, approvals_mode: null, confirmed_account_mask: null, ...o });

function fakeBoard(p: ExecPlan, ctl: BoardControl, policy: Policy = DEFAULT_POLICY) {
  const calls: string[] = [];
  const receipts: ReceiptInput[] = [];
  const notes: string[] = [];
  let claimed = false;
  const board: Board = {
    poll: async () => { calls.push("poll"); return { now: NOW.toISOString(), control: ctl, policy: { policy_version: 3, policy }, plans: [p], recovery: [] }; },
    claim: async (id, key) => {
      calls.push("claim");
      const expected = await idempotencyKey(id, p.current_version);
      // Check-and-set with no await in between, like the row lock in tradeboard.claim_plan.
      if (claimed) throw new BoardError(409, "already_claimed", "another claim holds this plan");
      if (key !== expected) throw new BoardError(409, "plan_changed", "stale key");
      claimed = true;
      return { claim_id: "c1", expires_at: "2026-10-28T15:10:00Z", plan: p };
    },
    step: async (_c, to) => { calls.push(`step:${to}`); if (ctl.killed) throw new BoardError(422, "killed", "killed"); if (ctl.paused) throw new BoardError(422, "paused", "paused"); },
    release: async () => { calls.push("release"); claimed = false; },
    receipt: async (r) => { calls.push(`receipt:${r.outcome}`); receipts.push(r); return { receipt_id: "r1", status: "x" }; },
    heartbeat: async () => ({ control: ctl }),
    today: async () => ({ market_date: "2026-10-28", orders: 0, live_fills: [] }),
    note: async (t) => { notes.push(t); },
  };
  return { board, calls, receipts, notes };
}

function fakeBroker(o: { price?: number; account?: string; approvals?: "on" | "off"; place?: (r: RhOrderRequest, ref: string) => Promise<{ order_id: string | null; proposal: boolean }>; orders?: OrderRead[] } = {}) {
  const placed: { r: RhOrderRequest; ref: string }[] = [];
  const orders: OrderRead[] = o.orders ?? [];
  const order = (r: RhOrderRequest, id: string): OrderRead => ({ id, symbol: r.symbol, side: r.side, type: r.type, quantity: Number(r.quantity), dollar_amount: null, limit_price: r.limit_price ? Number(r.limit_price) : null, stop_price: null, state: "confirmed", filled_quantity: 0, average_price: null, created_at: NOW.toISOString() });
  const b: Brokerage = {
    accounts: async () => [{ account_number: o.account ?? ACCT, agentic_allowed: true }, { account_number: "OTHER9999", agentic_allowed: false }],
    quote: async (s) => ({ symbol: s, price: o.price ?? 285.5, at: NOW.toISOString(), bid: null, ask: null, state: "active" }),
    positionUsd: async () => 0,
    tradeApprovals: async () => o.approvals ?? "off",
    review: async () => ({ customer_approval_required: false, alerts: [] }),
    place: async (r, ref) => {
      placed.push({ r, ref });
      if (o.place) return o.place(r, ref);
      const id = `ord-${placed.length}`;
      orders.push(order(r, id));
      return { order_id: id, proposal: false };
    },
    order: async (_a, id) => orders.find((x) => x.id === id) ?? null,
    recentOrders: async () => orders,
  };
  return { b, placed, orders, order };
}

const model = (verdict: "pass" | "fail" = "pass"): SanityChecker => ({ id: "fake-70b", check: async (i) => (verdict === "pass" && i.thesis.includes(i.order.ticker) ? { verdict: "pass", reasons: [] } : { verdict: "fail", reasons: ["thesis is about a different ticker"] }) });

function engine(board: Board, broker: Brokerage | null, o: { live?: boolean; m?: SanityChecker | null; kill?: () => boolean } = {}) {
  return new Engine({
    executorId: "spark", accountNumber: ACCT, allowLive: o.live ?? false, maxPlansPerLoop: 1, board, broker: () => broker, model: o.m === undefined ? model() : o.m,
    now: () => NOW, killFile: o.kill ?? (() => false), sleep: async () => {},
  });
}

const liveControl = () => control({ dry_run: false, live_gate_complete: true, approvals_mode: "A", confirmed_account_mask: "••••5678", live_trial_pending: false });
const live = async (e: Engine) => { await e.heartbeat(); await e.refreshAccount(true); return e; };

describe("dry-run (§12.1 test 2)", () => {
  it("posts a simulated receipt and never places", async () => {
    const f = fakeBoard(plan(), control());
    const rh = fakeBroker();
    const out = await engine(f.board, rh.b).iterate();
    expect(out[0].detail).toBe("simulated");
    expect(f.receipts[0]).toMatchObject({ mode: "dry_run", outcome: "simulated", policy_snapshot_id: 3, robinhood_order_id: null });
    expect(f.calls).toEqual(["poll", "claim", "step:validated", "receipt:simulated"]);
    expect(rh.placed).toEqual([]);
  });
  it("DEMO plans stay dry-run even with everything live", async () => {
    const f = fakeBoard(plan({ is_demo: true }), liveControl());
    const rh = fakeBroker();
    const e = await live(engine(f.board, rh.b, { live: true }));
    await e.iterate();
    expect(f.receipts[0].mode).toBe("dry_run");
    expect(rh.placed).toEqual([]);
  });
  it("waits, unclaimed, outside market hours (§6.5.5)", async () => {
    const f = fakeBoard(plan(), control());
    const e = new Engine({ executorId: "spark", accountNumber: ACCT, allowLive: false, maxPlansPerLoop: 1, board: f.board, broker: () => fakeBroker().b, model: model(), now: () => new Date("2026-10-28T22:00:00Z") });
    const out = await e.iterate();
    expect(out[0].result).toBe("skipped");
    expect(f.calls).toEqual(["poll"]);
  });
});

describe("policy, drift, model (§12.1 tests 6–8)", () => {
  it("per-trade limit: rejected with the rule, no order", async () => {
    const f = fakeBoard(plan({ order: ticket({ quantity_shares: 30 }) }), liveControl());
    const rh = fakeBroker();
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "policy_rejected" });
    expect(f.receipts[0].reason_text).toContain("[max_per_trade_usd]");
    expect(rh.placed).toEqual([]);
  });
  it("denied ticker", async () => {
    const f = fakeBoard(plan(), control(), { ...DEFAULT_POLICY, denied_tickers: ["AAPL"] });
    await engine(f.board, fakeBroker().b).iterate();
    expect(f.receipts[0].reason_text).toContain("[denied_tickers]");
  });
  it("drift 5 %: drift_rejected, no order", async () => {
    const f = fakeBoard(plan(), liveControl());
    const rh = fakeBroker({ price: 299.25 });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "drift_rejected" });
    expect(rh.placed).toEqual([]);
  });
  it("model mismatch: sanity_rejected, no order", async () => {
    const f = fakeBoard(plan({ thesis: "Buy 10 MSFT: Azure is accelerating." }), liveControl());
    const rh = fakeBroker();
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "sanity_rejected" });
    expect(rh.placed).toEqual([]);
  });
  it("a model timeout is a rejection, not a bypass", async () => {
    const f = fakeBoard(plan(), control());
    const slow: SanityChecker = { id: "slow", check: async () => ({ verdict: "fail", reasons: ["model didn't answer within 180 s"], error: "timeout" }) };
    await engine(f.board, fakeBroker().b, { m: slow }).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "model_unavailable" });
  });
  it("no model and no policy waiver: never live", async () => {
    const f = fakeBoard(plan(), liveControl());
    const rh = fakeBroker();
    const e = await live(engine(f.board, rh.b, { live: true, m: null }));
    expect(e.liveBlockers()).toContain("model check is off and the policy doesn't allow live without it");
    await e.iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "policy_rejected" });
    expect(f.receipts[0].reason_text).toContain("model check is off");
    expect(rh.placed).toEqual([]);
  });
  it("live on but the account differs: wrong_account_rejected without simulating", async () => {
    const f = fakeBoard(plan(), liveControl());
    const rh = fakeBroker({ account: "9ZZ00000000" });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "wrong_account_rejected", mode: "live" });
    expect(rh.placed).toEqual([]);
  });
});

describe("live (§10, §12.1 tests 11–12)", () => {
  it("places exactly the ticket with the plan-version ref_id, reads it back, posts executed", async () => {
    const p = plan();
    const f = fakeBoard(p, liveControl());
    const rh = fakeBroker();
    const e = await live(engine(f.board, rh.b, { live: true }));
    expect(e.liveBlockers()).toEqual([]);
    await e.iterate();
    expect(rh.placed).toHaveLength(1);
    expect(rh.placed[0].r).toEqual({ account_number: ACCT, symbol: "AAPL", side: "buy", type: "limit", quantity: "10", limit_price: "285", time_in_force: "gfd", market_hours: "regular_hours" });
    expect(rh.placed[0].ref).toBe(await idempotencyKey(p.plan_id, p.current_version));
    expect(f.calls).toEqual(["poll", "claim", "step:validated", "step:executing", "receipt:executed"]);
    expect(f.receipts[0]).toMatchObject({ mode: "live", outcome: "executed", robinhood_order_id: "ord-1" });
  });
  it("wrong account: wrong_account_rejected, no order", async () => {
    const f = fakeBoard(plan(), liveControl());
    const rh = fakeBroker({ account: "9ZZ00000000" });
    const e = engine(f.board, rh.b, { live: true });
    e.accountMask = "••••5678"; // as if it matched earlier
    e.accountMatches = true;
    await e.iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "wrong_account_rejected" });
    expect(rh.placed).toEqual([]);
  });
  it("Mode A with Robinhood approvals on: refused", async () => {
    const f = fakeBoard(plan(), liveControl());
    const rh = fakeBroker({ approvals: "on" });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0].reason_text).toMatch(/approvals are ON/);
    expect(rh.placed).toEqual([]);
  });
  it("Mode B: a proposal is never claimed as a fill", async () => {
    const f = fakeBoard(plan(), { ...liveControl(), approvals_mode: "B" });
    const rh = fakeBroker({ approvals: "on", place: async () => ({ order_id: "prop-1", proposal: true }) });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "proposed", reason_code: "proposal_only" });
  });
  it("timeout after place with an order created: no second order, receipt for the existing one", async () => {
    const f = fakeBoard(plan(), liveControl());
    let calls = 0;
    const rh = fakeBroker({
      place: async (r) => {
        calls++;
        rh.orders.push(rh.order(r, "ord-real"));
        throw new UncertainError("timeout");
      },
    });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(calls).toBe(1);
    expect(f.receipts).toHaveLength(1);
    expect(f.receipts[0]).toMatchObject({ outcome: "executed", robinhood_order_id: "ord-real" });
  });
  it("timeout with nothing created: one retry with the same ref_id", async () => {
    const f = fakeBoard(plan(), liveControl());
    const refs: string[] = [];
    const rh = fakeBroker({
      place: async (r, ref) => {
        refs.push(ref);
        if (refs.length === 1) throw new UncertainError("timeout");
        rh.orders.push(rh.order(r, "ord-2"));
        return { order_id: "ord-2", proposal: false };
      },
    });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(refs).toHaveLength(2);
    expect(refs[0]).toBe(refs[1]);
    expect(f.receipts[0]).toMatchObject({ outcome: "executed", robinhood_order_id: "ord-2" });
  });
  it("read-back mismatch: failed, not executed", async () => {
    const f = fakeBoard(plan(), liveControl());
    const rh = fakeBroker({ place: async (r) => { rh.orders.push({ ...rh.order(r, "ord-x"), quantity: 100 }); return { order_id: "ord-x", proposal: false }; } });
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0]).toMatchObject({ outcome: "failed", reason_code: "readback_mismatch" });
  });
  it("first live order must be a small limit order", async () => {
    const f = fakeBoard(plan(), { ...liveControl(), live_trial_pending: true });
    const rh = fakeBroker();
    await (await live(engine(f.board, rh.b, { live: true }))).iterate();
    expect(f.receipts[0].reason_text).toContain("[first_live_order]");
    expect(rh.placed).toEqual([]);
  });
});

describe("pause, kill, claims (§12.1 tests 9–10)", () => {
  it("paused or killed: doesn't claim", async () => {
    for (const ctl of [control({ paused: true }), control({ killed: true })]) {
      const f = fakeBoard(plan(), ctl);
      const e = engine(f.board, fakeBroker().b);
      await e.heartbeat();
      expect(await e.iterate()).toEqual([]);
      expect(f.calls).not.toContain("claim");
    }
  });
  it("local KILL file: doesn't even poll", async () => {
    const f = fakeBoard(plan(), control());
    const e = engine(f.board, fakeBroker().b, { kill: () => true });
    await e.heartbeat();
    expect(await e.iterate()).toEqual([]);
    expect(f.calls).toEqual([]);
  });
  it("killed mid-flight: stops before the order", async () => {
    const ctl = liveControl();
    const f = fakeBoard(plan(), ctl);
    const rh = fakeBroker();
    const e = await live(engine(f.board, rh.b, { live: true }));
    const orig = f.board.step;
    f.board.step = async (c, to) => { if (to === "executing") ctl.killed = true; return orig(c, to); };
    await e.iterate();
    expect(rh.placed).toEqual([]);
    expect(f.receipts[0]).toMatchObject({ outcome: "rejected", reason_code: "killed" });
  });
  it("a second loop can't claim the same plan", async () => {
    const f = fakeBoard(plan(), control());
    const rh = fakeBroker();
    const [a, b] = await Promise.all([engine(f.board, rh.b).iterate(), engine(f.board, rh.b).iterate()]);
    const results = [...a, ...b].map((o) => o.result).sort();
    expect(results).toEqual(["claim_failed", "receipt"]);
    expect(f.receipts).toHaveLength(1);
  });
  it("a plan edited after approval (old version) isn't executed", async () => {
    const f = fakeBoard(plan({ approval: { approval_id: "a1", version: 1, approved_at: NOW.toISOString(), expires_at: "2026-10-28T20:00:00Z" } }), control());
    const out = await engine(f.board, fakeBroker().b).iterate();
    expect(out[0]).toMatchObject({ result: "released", detail: "plan changed since approval" });
    expect(f.receipts).toEqual([]);
  });
});

describe("ticket → Robinhood", () => {
  it("translates day to gfd and dollars to dollar_amount", () => {
    expect(toRobinhood(ticket({ order_type: "market", limit_price: null, quantity_shares: null, quantity_dollars: 250 }), ACCT, "regular_hours")).toEqual({ account_number: ACCT, symbol: "AAPL", side: "buy", type: "market", dollar_amount: "250.00", time_in_force: "gfd", market_hours: "regular_hours" });
  });
  it("matches read-backs strictly", () => {
    const o: OrderRead = { id: "x", symbol: "AAPL", side: "buy", type: "limit", quantity: 10, dollar_amount: null, limit_price: 285, stop_price: null, state: "filled", filled_quantity: 10, average_price: 284.9, created_at: null };
    expect(matchesTicket(o, ticket())).toBe(true);
    expect(matchesTicket({ ...o, limit_price: 290 }, ticket())).toBe(false);
    expect(matchesTicket({ ...o, symbol: "MSFT" }, ticket())).toBe(false);
  });
});
