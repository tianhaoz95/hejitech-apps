#!/usr/bin/env node
// A stand-in for the local model in tests: an OpenAI-compatible /v1/chat/completions that fails a plan
// whose thesis names a different well-known ticker than the ticket. Usage: node mock-model.mjs [port].
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8767);
const KNOWN = ["AAPL", "MSFT", "NVDA", "SPY", "TSLA", "GOOGL", "AMZN", "META", "QQQ"];
createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const msg = JSON.parse(body || "{}").messages?.at(-1)?.content ?? "";
  const ticket = /"ticker":"([A-Z.]+)"/.exec(msg)?.[1];
  const thesis = /^thesis: (.*)$/m.exec(msg)?.[1] ?? "";
  const others = KNOWN.filter((t) => t !== ticket && new RegExp(`\\b${t}\\b`).test(thesis));
  const verdict = others.length ? { verdict: "fail", reasons: [`thesis is about ${others.join(", ")}, the ticket is ${ticket}`] } : { verdict: "pass", reasons: [] };
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ model: "mock", choices: [{ message: { role: "assistant", content: JSON.stringify(verdict) } }] }));
}).listen(port, "127.0.0.1", () => console.log(`mock model on http://127.0.0.1:${port}/v1`));
