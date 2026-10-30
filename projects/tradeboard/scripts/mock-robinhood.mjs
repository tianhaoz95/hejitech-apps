#!/usr/bin/env node
// A stand-in for the official Robinhood MCP for tests (never a real brokerage): Streamable HTTP with
// JSON responses, the tools the executor uses, and a /_state endpoint for the test to set the price
// and read what was "placed". Usage: node mock-robinhood.mjs [port] (default 8766).
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8766);
const state = { price: 285.5, account: "5RX12345678", approvals: false, orders: [], placeCalls: 0, quoteAt: null };

const ok = (id, data) => ({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ data }) }] } });
const tools = ["get_accounts", "get_equity_quotes", "get_equity_positions", "get_trade_approval_setting", "review_equity_order", "place_equity_order", "get_equity_orders"].map((name) => ({ name, inputSchema: { type: "object" } }));

function call(name, a) {
  switch (name) {
    case "get_accounts": return { accounts: [{ account_number: state.account, agentic_allowed: true }, { account_number: "9MAIN000001", agentic_allowed: false }] };
    case "get_equity_quotes": {
      const at = state.quoteAt ?? new Date().toISOString();
      return { results: a.symbols.map((s) => ({ quote: { symbol: s, last_trade_price: String(state.price), venue_last_trade_time: at, bid_price: String(state.price - 0.01), ask_price: String(state.price + 0.01), has_traded: true, state: "active" } })) };
    }
    case "get_equity_positions": return { results: [] };
    case "get_trade_approval_setting": return { account_number: a.account_number, trade_approvals_enabled: state.approvals };
    case "review_equity_order": return { customer_approval_required: state.approvals, order_checks: [] };
    case "place_equity_order": {
      state.placeCalls++;
      const dup = state.orders.find((o) => o.ref_id === a.ref_id);
      if (dup) return { order: dup };
      const o = { id: `mock-${state.orders.length + 1}`, ref_id: a.ref_id, symbol: a.symbol, side: a.side, type: a.type, quantity: a.quantity, price: a.limit_price ?? null, state: state.approvals ? "pending_customer_approval" : "confirmed", cumulative_quantity: "0", average_price: null, created_at: new Date().toISOString() };
      state.orders.push(o);
      return { order: o, customer_approval_required: state.approvals };
    }
    case "get_equity_orders": return { orders: state.orders.filter((o) => (!a.order_id || o.id === a.order_id) && (!a.symbol || o.symbol === a.symbol)) };
  }
  throw new Error(`unknown tool ${name}`);
}

createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (req.url === "/_state") {
    if (req.method === "POST") Object.assign(state, JSON.parse(body || "{}"));
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(state));
    return;
  }
  if (req.method !== "POST") return res.writeHead(405).end();
  const msg = JSON.parse(body);
  const send = (x, status = 200) => res.writeHead(status, { "Content-Type": "application/json", "Mcp-Session-Id": "mock" }).end(JSON.stringify(x));
  if (msg.method === "initialize") return send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "mock-robinhood", version: "0" } } });
  if (msg.method?.startsWith("notifications/")) return res.writeHead(202).end();
  if (msg.method === "tools/list") return send({ jsonrpc: "2.0", id: msg.id, result: { tools } });
  if (msg.method === "tools/call") {
    try { return send(ok(msg.id, call(msg.params.name, msg.params.arguments ?? {}))); }
    catch (e) { return send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: e.message }], isError: true } }); }
  }
  send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "no" } });
}).listen(port, "127.0.0.1", () => console.log(`mock Robinhood MCP on http://127.0.0.1:${port}/mcp`));
