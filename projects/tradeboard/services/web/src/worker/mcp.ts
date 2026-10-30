// The Board MCP (§7.1): Streamable HTTP with JSON responses at /mcp, for discussion agents. The
// caller is always one registered agent (OAuth grant or `tba_…` token, resolved in index.ts). The
// tools read and write plans and discussion only: there is deliberately no tool to place an order,
// approve, edit policy, pause the executor or reach Robinhood (adding one violates the PRD).
import { ANCHORS, STATUSES } from "@tradeboard/core";
import {
  addComment, answerQuestion, auditFor, commentOut, createPlan, listPlans, loadComments, loadPlan, markReady, openQuestions, planView, requestChanges,
  updatePlan, type Actor,
} from "./board.ts";
import { currentPolicy, VERSION, type Db, type Failed } from "./store.ts";

const PROTOCOL_VERSION = "2025-06-18";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors } });

const TICKET = {
  type: "object",
  description: "The order ticket: the only executable part of a plan (exactly one of quantity_shares / quantity_dollars; limit_price for limit orders only; time_in_force day; account_scope dedicated_mcp_account_only).",
  required: ["ticker", "side", "order_type", "time_in_force", "account_scope"],
  properties: {
    ticker: { type: "string", description: "Uppercase symbol, equal to the plan's ticker." },
    side: { type: "string", enum: ["buy"] },
    order_type: { type: "string", enum: ["limit", "market", "stop_limit", "stop_market"], description: "The user's policy decides which types the executor accepts (default: limit, market)." },
    quantity_shares: { type: ["number", "null"] },
    quantity_dollars: { type: ["number", "null"], description: "Market orders only." },
    limit_price: { type: ["number", "null"] },
    stop_price: { type: ["number", "null"] },
    time_in_force: { type: "string", enum: ["day"] },
    account_scope: { type: "string", enum: ["dedicated_mcp_account_only"] },
  },
};
const TIME = { type: "string", description: "ISO-8601 UTC with a zone, e.g. 2026-10-30T20:00:00Z (20:00 UTC = 4 p.m. ET in EDT)." };
const PLAN_FIELDS = {
  title: { type: "string", description: "Short title, e.g. \"AAPL — add on pullback\"." },
  ticker: { type: "string" },
  order: TICKET,
  thesis: { type: "string", description: "Why this trade, in your words." },
  evidence: { type: "string" },
  risks_and_dissent: { type: "string", description: "Risks, counter-arguments and dissent. Never delete another agent's dissent." },
  invalidation: { type: "string", description: "What would prove the thesis wrong." },
  valid_from: TIME,
  valid_until: { ...TIME, description: "Required: the plan can only execute before this. Usually today's market close (20:00Z in EDT, 21:00Z in EST)." },
  quote_price: { type: "number", description: "The price you built the plan on. Shown as agent-provided, unverified; the executor re-quotes before any order." },
  quote_at: TIME,
  quote_source: { type: "string" },
};
const ro = (title: string) => ({ title, readOnlyHint: true, openWorldHint: false });
const rw = (title: string, idempotent = false) => ({ title, readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false });

export const TOOLS = [
  {
    name: "create_plan", title: "Create a trade plan",
    description: "Creates a dated plan in `draft`. Needs title, ticker, the order ticket, thesis and valid_until (in the future). Pass an idempotency_key to make retries safe. Agents can't approve plans: only the user can, in the portal.",
    inputSchema: { type: "object", required: ["title", "ticker", "order", "thesis", "valid_until"], properties: { ...PLAN_FIELDS, idempotency_key: { type: "string" } } },
    annotations: rw("Create a trade plan", true),
  },
  {
    name: "get_plan", title: "Get a plan",
    description: "The full plan: fields, ticket, validity (UTC), status, version, open questions (the user's block approval), decision log and the latest receipt. `awaiting_you` lists questions @mentioning you that you haven't answered.",
    inputSchema: { type: "object", required: ["plan_id"], properties: { plan_id: { type: "string" } } },
    annotations: ro("Get a plan"),
  },
  {
    name: "list_plans", title: "List plans",
    description: "Plans, last edited first, with status, ticker, title, validity countdown and open-question counts (and `awaiting_you`).",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: [...STATUSES] }, ticker: { type: "string" }, author_id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } } },
    annotations: ro("List plans"),
  },
  {
    name: "update_plan", title: "Edit a plan",
    description: "Edits plan fields as a new version: any approval is voided and the plan goes back to `debated`. Send expected_version (the version you read); a mismatch is a version_conflict, never a silent overwrite.",
    inputSchema: { type: "object", required: ["plan_id", "expected_version"], properties: { plan_id: { type: "string" }, expected_version: { type: "integer" }, ...PLAN_FIELDS } },
    annotations: rw("Edit a plan"),
  },
  {
    name: "comment", title: "Comment on a plan",
    description: "Adds a comment to the plan's thread as you. @agent_id in the text mentions another agent.",
    inputSchema: { type: "object", required: ["plan_id", "body"], properties: { plan_id: { type: "string" }, body: { type: "string" }, anchor: { type: "string", enum: [...ANCHORS] }, parent_comment_id: { type: "string" } } },
    annotations: rw("Comment on a plan"),
  },
  {
    name: "ask_question", title: "Ask a question",
    description: "Opens a question on the plan (optionally directed at one agent). Agents' questions are listed but don't block approval; the user's do.",
    inputSchema: { type: "object", required: ["plan_id", "body"], properties: { plan_id: { type: "string" }, body: { type: "string" }, anchor: { type: "string", enum: [...ANCHORS] }, mentioned_agent_id: { type: "string" } } },
    annotations: rw("Ask a question"),
  },
  {
    name: "answer_question", title: "Answer a question",
    description: "Replies to a question in its thread. Only the user can mark their questions resolved; an answer alone doesn't.",
    inputSchema: { type: "object", required: ["question_id", "body"], properties: { question_id: { type: "string" }, body: { type: "string" } } },
    annotations: rw("Answer a question"),
  },
  {
    name: "mark_ready", title: "Mark a plan ready",
    description: "Moves a `debated` plan to `ready` for the user's review. Refused while the user has open questions (they're listed in the error).",
    inputSchema: { type: "object", required: ["plan_id"], properties: { plan_id: { type: "string" } } },
    annotations: rw("Mark a plan ready", true),
  },
  {
    name: "request_changes", title: "Request changes",
    description: "Sends a `ready` (or approved) plan back to `debated` with a comment saying what must change. Voids an approval.",
    inputSchema: { type: "object", required: ["plan_id", "body"], properties: { plan_id: { type: "string" }, body: { type: "string" } } },
    annotations: rw("Request changes"),
  },
  {
    name: "list_comments", title: "List comments",
    description: "The plan's thread in order: author (human or agent id), UTC time, anchor, and each question's open/resolved state.",
    inputSchema: { type: "object", required: ["plan_id"], properties: { plan_id: { type: "string" }, anchor: { type: "string", enum: [...ANCHORS] }, since: TIME } },
    annotations: ro("List comments"),
  },
  {
    name: "get_open_questions", title: "Get open questions",
    description: "The plan's open questions, the user's (blocking) first.",
    inputSchema: { type: "object", required: ["plan_id"], properties: { plan_id: { type: "string" } } },
    annotations: ro("Get open questions"),
  },
  {
    name: "get_audit_log", title: "Get the decision log",
    description: "The plan's decision log and audit events in order (approvals, rejections, versions, receipts).",
    inputSchema: { type: "object", required: ["plan_id"], properties: { plan_id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 1000 } } },
    annotations: ro("Get the decision log"),
  },
];

class ToolError extends Error {
  constructor(public body: Failed) {
    super(body.message);
  }
}
const need = <T>(r: { ok: true; value: T } | { ok: false; error: Failed }): T => {
  if (!r.ok) throw new ToolError(r.error);
  return r.value;
};
const fail = (error_code: string, message: string): never => {
  throw new ToolError({ ok: false, error_code, message });
};
const str = (v: unknown, name: string) => (typeof v === "string" && v.trim() ? v.trim() : fail("bad_request", `${name} is required`));

async function callTool(name: string, args: Record<string, unknown>, actor: Actor, db: Db): Promise<unknown> {
  switch (name) {
    case "create_plan": {
      const { idempotency_key, ...fields } = args;
      return need(await createPlan(db, actor, fields, { idempotencyKey: typeof idempotency_key === "string" ? idempotency_key : undefined }));
    }
    case "get_plan": {
      const v = await planView(db, actor.userId, str(args.plan_id, "plan_id"), { forAgent: actor.id });
      return v ?? fail("not_found", "no such plan");
    }
    case "list_plans":
      return { plans: await listPlans(db, actor.userId, { status: args.status as string, ticker: args.ticker as string, author_id: args.author_id as string, limit: args.limit as number }, actor.id) };
    case "update_plan": {
      const { plan_id, expected_version, ...fields } = args;
      return need(await updatePlan(db, actor, str(plan_id, "plan_id"), expected_version, fields));
    }
    case "comment":
      return need(await addComment(db, actor, str(args.plan_id, "plan_id"), args, false));
    case "ask_question":
      return need(await addComment(db, actor, str(args.plan_id, "plan_id"), args, true));
    case "answer_question":
      return need(await answerQuestion(db, actor, str(args.question_id, "question_id"), args.body));
    case "mark_ready": {
      const policy = await currentPolicy(db, actor.userId);
      return need(await markReady(db, actor, str(args.plan_id, "plan_id"), policy.policy.max_plan_age_hours));
    }
    case "request_changes":
      return need(await requestChanges(db, actor, str(args.plan_id, "plan_id"), args.body));
    case "list_comments": {
      const id = str(args.plan_id, "plan_id");
      if (!(await loadPlan(db, actor.userId, id))) fail("not_found", "no such plan");
      return { comments: (await loadComments(db, id, { anchor: args.anchor as string, since: args.since as string })).map(commentOut) };
    }
    case "get_open_questions": {
      const id = str(args.plan_id, "plan_id");
      if (!(await loadPlan(db, actor.userId, id))) fail("not_found", "no such plan");
      return { open_questions: openQuestions(await loadComments(db, id)) };
    }
    case "get_audit_log": {
      const id = str(args.plan_id, "plan_id");
      if (!(await loadPlan(db, actor.userId, id))) fail("not_found", "no such plan");
      return { events: await auditFor(db, id, Number(args.limit ?? 200)) };
    }
  }
  return fail("unknown_tool", `no tool named ${name}`);
}

export async function handleMcp(req: Request, actor: Actor, db: Db): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return out({ name: "tradeboard-mcp", transport: "streamable-http" });
  if (req.method !== "POST") return out({ error: "method not allowed" }, 405);
  let msg: { id?: string | number; method: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return out({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const reply = (result: unknown) => out({ jsonrpc: "2.0", id: msg.id ?? null, result });
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "tradeboard", title: "Trading Plan Board", version: VERSION },
        instructions:
          `You are "${actor.id}" on your user's Trading Plan Board: dated, collaborative trade plans. You draft, discuss and mark plans ready; ` +
          "only the user approves, in the portal, and a separate local executor places approved orders after its own checks. You can't place orders here. " +
          "Every time is UTC; valid_until is required. Edits make a new version and void approval; send expected_version. The user's open questions block a plan: answer them. Nothing here is financial advice.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = (await callTool(name, args, actor, db)) as Record<string, unknown>;
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        const body: Failed = e instanceof ToolError ? e.body : { ok: false, error_code: "internal", message: "the board couldn't do that: try again" };
        if (!(e instanceof ToolError)) console.error("mcp tool", name, (e as Error).message);
        const { ok: _ok, ...err } = body;
        return reply({ content: [{ type: "text", text: JSON.stringify(err) }], structuredContent: err, isError: true });
      }
    }
    default:
      return out({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
}

