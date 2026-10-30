// The brokerage the executor talks to: the official Robinhood MCP only (§10), no private APIs. The
// engine sees this interface; robinhood.ts implements it over MCP and the tests use a fake.
// Robinhood's replies are parsed defensively: anything that doesn't read clearly is an error, which
// the engine turns into "no order" (fail closed).

export interface Quote {
  symbol: string;
  /** The current price per Robinhood's guide: the newer of the regular and extended-hours last trade. */
  price: number;
  at: string;
  bid: number | null;
  ask: number | null;
  state: string;
}

export interface Account {
  account_number: string;
  agentic_allowed: boolean;
}

export interface RhOrderRequest {
  account_number: string;
  symbol: string;
  side: "buy";
  type: "market" | "limit" | "stop_limit" | "stop_market";
  quantity?: string;
  dollar_amount?: string;
  limit_price?: string;
  stop_price?: string;
  time_in_force: "gfd";
  market_hours: "regular_hours" | "extended_hours";
}

export interface OrderRead {
  id: string;
  symbol: string | null;
  side: string | null;
  type: string | null;
  quantity: number | null;
  dollar_amount: number | null;
  limit_price: number | null;
  stop_price: number | null;
  state: string;
  filled_quantity: number | null;
  average_price: number | null;
  created_at: string | null;
}

export interface Review {
  customer_approval_required: boolean;
  alerts: string[];
}

export interface Placed {
  order_id: string | null;
  /** Trade approvals are on: the order went to the owner's Robinhood app as a proposal (Mode B). */
  proposal: boolean;
}

export interface Brokerage {
  accounts(): Promise<Account[]>;
  quote(symbol: string): Promise<Quote>;
  /** Market value already held in `symbol`, USD. Throws when it can't be read. */
  positionUsd(account: string, symbol: string, price: number): Promise<number>;
  tradeApprovals(account: string): Promise<"on" | "off" | "unknown">;
  review(order: RhOrderRequest): Promise<Review>;
  place(order: RhOrderRequest, refId: string): Promise<Placed>;
  order(account: string, id: string): Promise<OrderRead | null>;
  recentOrders(account: string, symbol: string, sinceIso: string): Promise<OrderRead[]>;
}

/** The call's outcome is unknown (timeout, dropped connection): the engine must read back before anything else. */
export class UncertainError extends Error {}

// ---------------------------------------------------------------- parsing helpers (shared with tests)

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Robinhood wraps results as { data: …, guide: "…" }. */
export const unwrap = (v: unknown): unknown => (v && typeof v === "object" && "data" in (v as Record<string, unknown>) ? (v as Record<string, unknown>).data : v);

/** The first array of objects found breadth-first whose items satisfy `pick`. */
export function findArray(v: unknown, pick: (o: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  const queue: unknown[] = [v];
  while (queue.length) {
    const cur = queue.shift();
    if (Array.isArray(cur)) {
      const objs = cur.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
      if (objs.length && objs.some(pick)) return objs;
      queue.push(...cur);
    } else if (cur && typeof cur === "object") {
      queue.push(...Object.values(cur as Record<string, unknown>));
    }
  }
  return [];
}

/** First value under any of `keys`, searched breadth-first. */
export function findKey(v: unknown, keys: string[]): unknown {
  const queue: unknown[] = [v];
  while (queue.length) {
    const cur = queue.shift();
    if (cur && typeof cur === "object") {
      for (const k of keys) if (!Array.isArray(cur) && k in (cur as Record<string, unknown>)) return (cur as Record<string, unknown>)[k];
      queue.push(...Object.values(cur as Record<string, unknown>));
    }
  }
  return undefined;
}

export function parseQuote(raw: unknown, symbol: string): Quote {
  const results = findArray(unwrap(raw), (o) => "quote" in o || "last_trade_price" in o);
  const entry = results.find((r) => ((r.quote as Record<string, unknown> | undefined)?.symbol ?? r.symbol) === symbol) ?? results[0];
  const q = (entry?.quote ?? entry) as Record<string, unknown> | undefined;
  if (!q || q.symbol !== symbol) throw new Error(`no quote for ${symbol}`);
  if (q.has_traded === false) throw new Error(`${symbol} hasn't traded`);
  if (q.state && q.state !== "active") throw new Error(`${symbol} is ${q.state}`);
  const reg = { p: num(q.last_trade_price), t: String(q.venue_last_trade_time ?? q.updated_at ?? "") };
  const ext = { p: num(q.last_non_reg_trade_price), t: String(q.venue_last_non_reg_trade_time ?? "") };
  const pick = ext.p !== null && ext.t && (!reg.t || Date.parse(ext.t) > Date.parse(reg.t)) ? ext : reg;
  if (pick.p === null || !(pick.p > 0)) throw new Error(`no price for ${symbol}`);
  const bid = num(q.bid_price), ask = num(q.ask_price);
  return { symbol, price: pick.p, at: pick.t || new Date().toISOString(), bid: bid && bid > 0 ? bid : null, ask: ask && ask > 0 ? ask : null, state: String(q.state ?? "active") };
}

export function parseOrder(o: Record<string, unknown>): OrderRead {
  const id = String(o.id ?? o.order_id ?? "");
  return {
    id,
    symbol: (o.symbol as string | undefined) ?? ((o.instrument as Record<string, unknown> | undefined)?.symbol as string | undefined) ?? null,
    side: (o.side as string | undefined) ?? null,
    type: (o.type as string | undefined) ?? (o.order_type as string | undefined) ?? null,
    quantity: num(o.quantity),
    dollar_amount: num((o.dollar_based_amount as Record<string, unknown> | undefined)?.amount ?? o.dollar_amount),
    limit_price: num(o.price ?? o.limit_price),
    stop_price: num(o.stop_price),
    state: String(o.state ?? o.status ?? "unknown"),
    filled_quantity: num(o.cumulative_quantity ?? o.filled_quantity),
    average_price: num(o.average_price ?? o.average_fill_price),
    created_at: (o.created_at as string | undefined) ?? null,
  };
}

export const FAILED_STATES = new Set(["rejected", "failed", "cancelled", "canceled", "voided"]);
