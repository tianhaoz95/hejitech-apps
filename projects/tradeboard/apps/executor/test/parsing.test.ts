import { describe, expect, it } from "vitest";
import { findArray, parseOrder, parseQuote, unwrap } from "../src/brokerage.ts";
import { openAiChecker } from "../src/model.ts";
import { DEFAULT_POLICY } from "@tradeboard/core";
import { redact } from "../src/config.ts";

// The shape get_equity_quotes returned on 2026-10-29 (values from that read; no account data).
const QUOTE = {
  data: { results: [{ quote: { symbol: "AAPL", last_trade_price: "348.940000", venue_last_trade_time: "2026-10-29T19:59:59.940856284Z", last_non_reg_trade_price: "350.400000", venue_last_non_reg_trade_time: "2026-10-30T02:38:48.192Z", bid_price: "350.390000", ask_price: "350.450000", has_traded: true, state: "active" }, close: { symbol: "AAPL", price: "348.91" } }] },
  guide: "…",
};

describe("Robinhood replies", () => {
  it("takes the newer of regular and extended-hours prices, as Robinhood's guide says", () => {
    const q = parseQuote(QUOTE, "AAPL");
    expect(q.price).toBe(350.4);
    expect(q.at).toBe("2026-10-30T02:38:48.192Z");
    expect(q.bid).toBe(350.39);
  });
  it("refuses quotes for another symbol, halted or untraded", () => {
    expect(() => parseQuote(QUOTE, "MSFT")).toThrow();
    const halted = structuredClone(QUOTE);
    halted.data.results[0].quote.state = "halted";
    expect(() => parseQuote(halted, "AAPL")).toThrow(/halted/);
  });
  it("reads orders", () => {
    const rows = findArray(unwrap({ data: { orders: [{ id: "o1", side: "buy", type: "limit", quantity: "10.00000000", price: "285.00", state: "filled", cumulative_quantity: "10", average_price: "284.90", symbol: "AAPL" }] } }), (o) => "id" in o);
    expect(parseOrder(rows[0])).toMatchObject({ id: "o1", quantity: 10, limit_price: 285, filled_quantity: 10, average_price: 284.9, symbol: "AAPL" });
  });
});

describe("model client (OpenAI-compatible)", () => {
  const input = { title: "t", ticker: "AAPL", thesis: "AAPL", evidence: "", risks_and_dissent: "", invalidation: "", order: { ticker: "AAPL", side: "buy" as const, order_type: "limit" as const, quantity_shares: 1, quantity_dollars: null, limit_price: 1, stop_price: null, time_in_force: "day" as const, account_scope: "dedicated_mcp_account_only" as const }, quote_price: null, live_price: 1, policy: DEFAULT_POLICY };
  const cfg = { enabled: true, base_url: "http://model.test/v1", model: "m", timeout_ms: 50, max_tokens: 2048 };
  it("sends temperature 0 and a JSON schema; parses the verdict", async () => {
    let sent: Record<string, unknown> = {};
    const f = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ choices: [{ message: { content: '{"verdict":"pass","reasons":[]}' } }] })); }) as unknown as typeof fetch;
    expect((await openAiChecker(cfg, f).check(input)).verdict).toBe("pass");
    expect(sent.temperature).toBe(0);
    expect((sent.response_format as { type: string }).type).toBe("json_schema");
  });
  it("prose, HTTP errors and timeouts all fail", async () => {
    const prose = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "Looks fine to me!" } }] }))) as unknown as typeof fetch;
    expect(await openAiChecker(cfg, prose).check(input)).toMatchObject({ verdict: "fail", error: "unparseable" });
    const down = (async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    expect((await openAiChecker(cfg, down).check(input)).verdict).toBe("fail");
    const hang = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("t"), { name: "TimeoutError" }))))) as unknown as typeof fetch;
    expect(await openAiChecker(cfg, hang).check(input)).toMatchObject({ verdict: "fail", error: "timeout" });
  });
});

describe("logs never carry secrets", () => {
  it("redacts tokens and the account number", () => {
    const s = redact("Bearer abc.def tba_ABCDEFGH12345 tbx_ZZZZZZZZ9999 acct 5RX12345678", { executor_token: "", robinhood: { account_number: "5RX12345678", mcp_url: "", redirect_port: 1 } });
    expect(s).not.toMatch(/abc\.def|ABCDEFGH|ZZZZZZZZ|5RX12345678/);
    expect(s).toContain("••••5678");
  });
});
