// The policy (§9.2) and the deterministic validator (§9.1 step 5). Code, not a model: the same
// inputs always give the same verdict, and every failure names the rule that failed.
import { inExtendedHours, inRegularHours, marketDate, nextSessionClosingAfter, calendarKnown } from "./time.ts";
import { checkTicket, notionalUsd, ORDER_TYPES, type OrderTicket, type OrderType } from "./ticket.ts";

export interface Policy {
  policy_version: number;
  require_human_approval: true;
  dry_run_default: boolean;
  allowed_sides: ("buy")[];
  allowed_order_types: OrderType[];
  /** null: any ticker except denied. A list restricts to it. denied_tickers always wins. */
  allowed_tickers: string[] | null;
  denied_tickers: string[];
  max_per_trade_usd: number;
  max_position_usd_per_ticker: number;
  max_daily_loss_usd: number;
  max_open_plans_per_day: number;
  max_drift_pct: number;
  max_plan_age_hours: number;
  /** "until_market_close_et", or a fixed number of hours ("4h"). */
  approval_ttl: string;
  market_hours_only: boolean;
  allowed_account_scope: "dedicated_mcp_account_only";
  kill_switch_enabled: true;
  /** §9.3: live mode with the model check off needs this, shown prominently on /executor. */
  allow_live_without_model_check: boolean;
  /** §12.2: the first live order must be a limit order of at most this many dollars. */
  first_live_order_max_usd: number;
}

export const DEFAULT_POLICY: Policy = {
  policy_version: 1,
  require_human_approval: true,
  dry_run_default: true,
  allowed_sides: ["buy"],
  allowed_order_types: ["limit", "market"],
  allowed_tickers: null,
  denied_tickers: [],
  max_per_trade_usd: 5000,
  max_position_usd_per_ticker: 20000,
  max_daily_loss_usd: 2000,
  max_open_plans_per_day: 5,
  max_drift_pct: 1.0,
  max_plan_age_hours: 24,
  approval_ttl: "until_market_close_et",
  market_hours_only: true,
  allowed_account_scope: "dedicated_mcp_account_only",
  kill_switch_enabled: true,
  allow_live_without_model_check: false,
  first_live_order_max_usd: 100,
};

/** One line per value, for the model's input and the portal's readable view. */
export const POLICY_HELP: Record<keyof Policy, string> = {
  policy_version: "Version number (set by the board on save)",
  require_human_approval: "Every order needs a human approval (always true)",
  dry_run_default: "Executor starts in dry-run",
  allowed_sides: "Sides the executor may place (v1: buy only)",
  allowed_order_types: "Order types the executor may place",
  allowed_tickers: "Only these tickers (null = any not denied)",
  denied_tickers: "Never these tickers (wins over allowed)",
  max_per_trade_usd: "Largest single order, USD",
  max_position_usd_per_ticker: "Largest position in one ticker after the order, USD",
  max_daily_loss_usd: "Pause the executor when today's live loss passes this, USD",
  max_open_plans_per_day: "Most orders the executor places per market day",
  max_drift_pct: "Abort when the live price moved more than this from the plan, %",
  max_plan_age_hours: "A plan unedited for longer is stale",
  approval_ttl: "How long an approval lasts",
  market_hours_only: "Execute only 9:30–16:00 ET on trading days",
  allowed_account_scope: "Trade only in the dedicated MCP account",
  kill_switch_enabled: "Kill switch available (always true)",
  allow_live_without_model_check: "Live mode allowed with the model check off",
  first_live_order_max_usd: "First live order: a limit order of at most this, USD",
};

export interface PolicyIssue {
  field: string;
  message: string;
}

const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const symbols = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === "string" && /^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$/.test(s));

/** A policy the executor may load. Anything off-schema is refused (fail closed), never coerced. */
export function checkPolicy(p: unknown): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  if (!p || typeof p !== "object" || Array.isArray(p)) return [{ field: "", message: "policy must be a JSON object" }];
  const o = p as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!(k in DEFAULT_POLICY)) add(k, "unknown setting");
  for (const k of Object.keys(DEFAULT_POLICY)) if (!(k in o)) add(k, "missing");
  if (!Number.isInteger(o.policy_version) || (o.policy_version as number) < 1) add("policy_version", "a positive integer");
  if (o.require_human_approval !== true) add("require_human_approval", "must be true: approval is never optional");
  if (o.kill_switch_enabled !== true) add("kill_switch_enabled", "must be true");
  if (typeof o.dry_run_default !== "boolean") add("dry_run_default", "true or false");
  if (!Array.isArray(o.allowed_sides) || o.allowed_sides.length === 0 || o.allowed_sides.some((s) => s !== "buy")) add("allowed_sides", 'v1 allows only ["buy"]');
  if (!Array.isArray(o.allowed_order_types) || o.allowed_order_types.length === 0 || o.allowed_order_types.some((t) => !ORDER_TYPES.includes(t as OrderType))) add("allowed_order_types", "a non-empty list of market, limit, stop_limit, stop_market");
  if (o.allowed_tickers !== null && !symbols(o.allowed_tickers)) add("allowed_tickers", "null or a list of uppercase symbols");
  if (!symbols(o.denied_tickers)) add("denied_tickers", "a list of uppercase symbols");
  if (!num(o.max_per_trade_usd, 1, 10_000_000)) add("max_per_trade_usd", "a positive amount");
  if (!num(o.max_position_usd_per_ticker, 1, 100_000_000)) add("max_position_usd_per_ticker", "a positive amount");
  if (!num(o.max_daily_loss_usd, 0, 100_000_000)) add("max_daily_loss_usd", "zero or a positive amount");
  if (!Number.isInteger(o.max_open_plans_per_day) || !num(o.max_open_plans_per_day, 0, 1000)) add("max_open_plans_per_day", "a whole number, 0–1000");
  if (!num(o.max_drift_pct, 0, 50)) add("max_drift_pct", "a percentage, 0–50");
  if (!num(o.max_plan_age_hours, 0.25, 24 * 30)) add("max_plan_age_hours", "hours, 0.25–720");
  if (typeof o.approval_ttl !== "string" || !(o.approval_ttl === "until_market_close_et" || /^\d{1,3}h$/.test(o.approval_ttl))) add("approval_ttl", 'until_market_close_et or a number of hours like "4h"');
  if (typeof o.market_hours_only !== "boolean") add("market_hours_only", "true or false");
  if (o.allowed_account_scope !== "dedicated_mcp_account_only") add("allowed_account_scope", "must be dedicated_mcp_account_only");
  if (typeof o.allow_live_without_model_check !== "boolean") add("allow_live_without_model_check", "true or false");
  if (!num(o.first_live_order_max_usd, 1, 1_000_000)) add("first_live_order_max_usd", "a positive amount");
  if (num(o.first_live_order_max_usd, 1, 1e6) && num(o.max_per_trade_usd, 1, 1e7) && (o.first_live_order_max_usd as number) > (o.max_per_trade_usd as number)) add("first_live_order_max_usd", "can't exceed max_per_trade_usd");
  return issues;
}

/**
 * When an approval stops being valid: the earlier of valid_until and approved_at + approval_ttl.
 * "until_market_close_et" means the close of the session that ends next after the approval, so an
 * evening approval lasts through the next trading day (docs/decisions.md). Past the calendar the
 * approval lasts no longer than valid_until and the executor refuses to trade anyway.
 */
export function approvalExpiry(policy: Pick<Policy, "approval_ttl">, approvedAt: Date, validUntil: Date): Date {
  let ttlEnd: Date;
  const hours = /^(\d{1,3})h$/.exec(policy.approval_ttl);
  if (hours) ttlEnd = new Date(approvedAt.getTime() + Number(hours[1]) * 3_600_000);
  else ttlEnd = nextSessionClosingAfter(approvedAt)?.close ?? validUntil;
  return ttlEnd < validUntil ? ttlEnd : validUntil;
}

export interface Failure {
  rule: string;
  reason_code: "policy_rejected" | "market_closed" | "stale_plan" | "live_trial_failed";
  message: string;
}

export interface ExecutionContext {
  policy: Policy;
  ticket: OrderTicket;
  planTicker: string;
  planUpdatedAt: Date;
  now: Date;
  /** The fresh quote (§6.5.3); a market order's notional uses it. */
  livePrice: number;
  /** Market value already held in this ticker (Robinhood read). null = unknown: fails closed. */
  positionUsd: number | null;
  /** Orders this executor placed (or simulated, in dry-run) today, market date. */
  ordersToday: number;
  /** Today's live loss so far, USD (§9.2); null = unknown: fails closed in live mode. */
  dailyLossUsd: number | null;
  live: boolean;
  /** §12.2: the first live order is a small limit order. */
  liveTrialPending: boolean;
}

/** Every rule of §9.2 against one ticket. Empty = pass. */
export function validateForExecution(c: ExecutionContext): Failure[] {
  const f: Failure[] = [];
  const add = (rule: string, message: string, reason_code: Failure["reason_code"] = "policy_rejected") => f.push({ rule, reason_code, message });
  const p = c.policy, t = c.ticket;
  for (const i of checkPolicy(p)) add(`policy.${i.field}`, `policy is invalid: ${i.field} ${i.message}`);
  if (f.length) return f;
  for (const i of checkTicket(t, c.planTicker)) add(`ticket.${i.code}`, i.message);
  if (!p.allowed_sides.includes(t.side as "buy")) add("allowed_sides", `side ${t.side} is not in allowed_sides ${JSON.stringify(p.allowed_sides)}`);
  if (!p.allowed_order_types.includes(t.order_type)) add("allowed_order_types", `order type ${t.order_type} is not in allowed_order_types ${JSON.stringify(p.allowed_order_types)}`);
  if (p.denied_tickers.includes(t.ticker)) add("denied_tickers", `${t.ticker} is in denied_tickers`);
  else if (p.allowed_tickers !== null && !p.allowed_tickers.includes(t.ticker)) add("allowed_tickers", `${t.ticker} is not in allowed_tickers`);
  if (t.account_scope !== p.allowed_account_scope) add("allowed_account_scope", "the ticket's account_scope isn't the dedicated MCP account");
  const notional = notionalUsd(t, c.livePrice);
  if (notional > p.max_per_trade_usd) add("max_per_trade_usd", `order is $${notional.toFixed(2)}, over max_per_trade_usd $${p.max_per_trade_usd}`);
  if (c.positionUsd === null) add("max_position_usd_per_ticker", "the current position couldn't be read, so the position limit can't be checked");
  else if (c.positionUsd + notional > p.max_position_usd_per_ticker) add("max_position_usd_per_ticker", `position would be $${(c.positionUsd + notional).toFixed(2)}, over max_position_usd_per_ticker $${p.max_position_usd_per_ticker}`);
  if (c.ordersToday >= p.max_open_plans_per_day) add("max_open_plans_per_day", `${c.ordersToday} orders already today, max_open_plans_per_day is ${p.max_open_plans_per_day}`);
  if (c.live && c.dailyLossUsd === null) add("max_daily_loss_usd", "today's loss couldn't be computed");
  else if (c.live && (c.dailyLossUsd ?? 0) > p.max_daily_loss_usd) add("max_daily_loss_usd", `today's loss $${(c.dailyLossUsd ?? 0).toFixed(2)} is over max_daily_loss_usd $${p.max_daily_loss_usd}`);
  const ageH = (c.now.getTime() - c.planUpdatedAt.getTime()) / 3_600_000;
  if (ageH > p.max_plan_age_hours) add("max_plan_age_hours", `plan last edited ${ageH.toFixed(1)} h ago, over max_plan_age_hours ${p.max_plan_age_hours}`, "stale_plan");
  const day = marketDate(c.now);
  if (!calendarKnown(day)) add("market_calendar", `the market calendar doesn't cover ${day}: no trading until it's extended`, "market_closed");
  else if (p.market_hours_only ? !inRegularHours(c.now) : !(inRegularHours(c.now) || (inExtendedHours(c.now) && t.order_type === "limit"))) {
    add(p.market_hours_only ? "market_hours_only" : "extended_hours", p.market_hours_only ? "outside regular market hours (9:30–16:00 ET on trading days)" : "outside market hours (extended hours take limit orders only)", "market_closed");
  }
  if (c.live && c.liveTrialPending) {
    if (t.order_type !== "limit") add("first_live_order", "the first live order must be a limit order (§12.2)", "live_trial_failed");
    if (notional > p.first_live_order_max_usd) add("first_live_order", `the first live order must be at most $${p.first_live_order_max_usd} (this one is $${notional.toFixed(2)})`, "live_trial_failed");
  }
  return f;
}

/** §6.5.3: how far the live price moved from the plan's price, and whether it's over the limit. */
export function checkDrift(t: OrderTicket, quotePrice: number | null, livePrice: number, maxPct: number): { pct: number; basis: number | null; ok: boolean; message: string } {
  const basis = t.order_type === "limit" || t.order_type === "stop_limit" ? t.limit_price : t.order_type === "stop_market" ? t.stop_price ?? null : quotePrice;
  if (basis === null || !(basis > 0) || !(livePrice > 0)) return { pct: Infinity, basis, ok: false, message: "no price to compare against: drift can't be checked" };
  const pct = (Math.abs(livePrice - basis) / basis) * 100;
  const ok = pct <= maxPct;
  return { pct, basis, ok, message: `live $${livePrice.toFixed(2)} vs plan $${basis.toFixed(2)}: ${pct.toFixed(2)}% ${ok ? "≤" : ">"} max_drift_pct ${maxPct}%` };
}
