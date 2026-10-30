// The order ticket (PRD §6.2): the only part of a plan that can become an order. Free text is never
// parsed as an order; the executor places exactly this object or nothing.

export type Side = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop_limit" | "stop_market";

export interface OrderTicket {
  ticker: string;
  side: Side;
  order_type: OrderType;
  quantity_shares: number | null;
  quantity_dollars: number | null;
  limit_price: number | null;
  /** Only for stop orders (off in the default policy; enabling them is a policy change, §4.1). */
  stop_price?: number | null;
  time_in_force: "day";
  account_scope: "dedicated_mcp_account_only";
}

export interface Issue {
  field: string;
  code: string;
  message: string;
}

/** Exchange symbols: 1–5 letters, optionally a class suffix (BRK.B). Never a company name. */
export const TICKER_RE = /^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$/;

export const ORDER_TYPES: readonly OrderType[] = ["market", "limit", "stop_limit", "stop_market"];

const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

/** Normalises what a client sent into a ticket shape (numbers as numbers, missing as null). */
export function normalizeTicket(raw: unknown): OrderTicket {
  const t = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : typeof v === "string" ? Number(v) : (v as number));
  return {
    ticker: typeof t.ticker === "string" ? t.ticker.trim().toUpperCase() : "",
    side: t.side as Side,
    order_type: t.order_type as OrderType,
    quantity_shares: num(t.quantity_shares),
    quantity_dollars: num(t.quantity_dollars),
    limit_price: num(t.limit_price),
    stop_price: num(t.stop_price),
    time_in_force: t.time_in_force as "day",
    account_scope: t.account_scope as "dedicated_mcp_account_only",
  };
}

/** Every rule of §6.2. An empty list means the ticket is complete and consistent. */
export function checkTicket(t: OrderTicket, planTicker?: string): Issue[] {
  const issues: Issue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });
  if (!TICKER_RE.test(t.ticker)) add("order.ticker", "ticker_format", "ticker must be an uppercase exchange symbol like AAPL or BRK.B");
  if (planTicker !== undefined && t.ticker !== planTicker) add("order.ticker", "ticker_mismatch", `the ticket's ticker (${t.ticker || "none"}) must equal the plan's ticker (${planTicker || "none"})`);
  if (t.side !== "buy") add("order.side", "side", "side must be buy (sell/close is a later phase, §6.1)");
  if (!ORDER_TYPES.includes(t.order_type)) add("order.order_type", "order_type", "order_type must be market, limit, stop_limit or stop_market");
  const shares = t.quantity_shares !== null, dollars = t.quantity_dollars !== null;
  if (shares === dollars) add("order.quantity", "quantity_exactly_one", "set exactly one of quantity_shares or quantity_dollars");
  if (shares && !positive(t.quantity_shares)) add("order.quantity_shares", "quantity_positive", "quantity_shares must be a positive number");
  if (shares && positive(t.quantity_shares) && decimals(t.quantity_shares) > 6) add("order.quantity_shares", "quantity_precision", "quantity_shares has at most 6 decimal places");
  if (shares && positive(t.quantity_shares) && !Number.isInteger(t.quantity_shares) && t.order_type !== "market") add("order.quantity_shares", "fractional_market_only", "fractional shares only work with market orders");
  if (dollars && !positive(t.quantity_dollars)) add("order.quantity_dollars", "quantity_positive", "quantity_dollars must be a positive amount");
  if (dollars && positive(t.quantity_dollars) && decimals(t.quantity_dollars) > 2) add("order.quantity_dollars", "quantity_precision", "quantity_dollars has at most 2 decimal places");
  if (dollars && t.order_type !== "market") add("order.quantity_dollars", "dollars_market_only", "dollar amounts only work with market orders");
  const needsLimit = t.order_type === "limit" || t.order_type === "stop_limit";
  if (needsLimit && !positive(t.limit_price)) add("order.limit_price", "limit_required", `limit_price is required for ${t.order_type} orders`);
  if (!needsLimit && t.limit_price !== null) add("order.limit_price", "limit_forbidden", `limit_price is not allowed for ${t.order_type} orders`);
  const needsStop = t.order_type === "stop_limit" || t.order_type === "stop_market";
  if (needsStop && !positive(t.stop_price)) add("order.stop_price", "stop_required", `stop_price is required for ${t.order_type} orders`);
  if (!needsStop && t.stop_price !== null && t.stop_price !== undefined) add("order.stop_price", "stop_forbidden", `stop_price is not allowed for ${t.order_type} orders`);
  for (const k of ["limit_price", "stop_price"] as const) {
    const v = t[k];
    if (positive(v) && decimals(v) > 4) add(`order.${k}`, "price_precision", `${k} has at most 4 decimal places`);
  }
  if (t.time_in_force !== "day") add("order.time_in_force", "time_in_force", "time_in_force must be day in v1");
  if (t.account_scope !== "dedicated_mcp_account_only") add("order.account_scope", "account_scope", "account_scope must be dedicated_mcp_account_only");
  return issues;
}

/** The price a ticket is judged at: its limit (or stop) price, else the live quote. */
export function referencePrice(t: OrderTicket, quote: number): number {
  if (t.order_type === "limit" || t.order_type === "stop_limit") return t.limit_price ?? quote;
  if (t.order_type === "stop_market") return t.stop_price ?? quote;
  return quote;
}

/** Dollars the order commits: quantity × limit price (limit) or × current quote (market), §9.2. */
export function notionalUsd(t: OrderTicket, quote: number): number {
  if (t.quantity_dollars !== null) return t.quantity_dollars;
  return round2((t.quantity_shares ?? 0) * referencePrice(t, quote));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function sameTicket(a: OrderTicket, b: OrderTicket): boolean {
  const keys: (keyof OrderTicket)[] = ["ticker", "side", "order_type", "quantity_shares", "quantity_dollars", "limit_price", "stop_price", "time_in_force", "account_scope"];
  return keys.every((k) => (a[k] ?? null) === (b[k] ?? null));
}

/** "Buy 10 AAPL · limit $285.00 · day". */
export function describeTicket(t: OrderTicket): string {
  const qty = t.quantity_dollars !== null ? `$${t.quantity_dollars.toFixed(2)} of` : `${t.quantity_shares}`;
  const price = t.order_type === "limit" ? `limit $${t.limit_price?.toFixed(2)}`
    : t.order_type === "stop_limit" ? `stop $${t.stop_price?.toFixed(2)} limit $${t.limit_price?.toFixed(2)}`
    : t.order_type === "stop_market" ? `stop $${t.stop_price?.toFixed(2)}`
    : "market";
  return `${t.side === "buy" ? "Buy" : "Sell"} ${qty} ${t.ticker} · ${price} · ${t.time_in_force}`;
}
