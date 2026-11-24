// Contempo MCP server (Streamable HTTP, JSON responses) at /mcp for the user's own AI assistant
// (Claude, ChatGPT, etc.). Authentication happens before this runs (index.ts): OAuth 2.1 grants
// issued by this Worker, or personal access tokens `cta_…`.
import { flagRisk } from "./risk.ts";
import type { Db } from "./store.ts";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "3.4.0";

export interface Caller {
  userId: string;
  via: "oauth" | "token";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const mcpJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const ro = (title: string) => ({ title, readOnlyHint: true, openWorldHint: false });
const rw = (title: string, idempotent = false) => ({
  title,
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: idempotent,
  openWorldHint: false,
});

export const TOOLS = [
  {
    name: "get_tax_test_progress",
    title: "Get IRS material participation progress",
    description:
      "Summarize confirmed and pending participation hours, owner-only hours, mileage, and progress toward the IRS 100-hour STR, 500-hour STR, and 750-hour REPS tests for a tax year, broken down by property and category.",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: "Tax year (YYYY). Defaults to the current UTC year." },
      },
    },
    annotations: ro("Get IRS material participation progress"),
  },
  {
    name: "list_properties",
    title: "List rental properties",
    description: "List the user's rental properties in Contempo.",
    inputSchema: { type: "object", properties: {} },
    annotations: ro("List rental properties"),
  },
  {
    name: "list_entries",
    title: "List participation entries",
    description:
      "List logged participation entries with optional filters for tax year, property name, status (confirmed, pending_review, all), and flagged_only (vague or backfilled entries).",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: "Tax year (YYYY). Defaults to the current UTC year." },
        property: { type: "string", description: "Optional case-insensitive substring match on property_name." },
        status: { type: "string", enum: ["confirmed", "pending_review", "all"], description: "Defaults to 'all'." },
        flagged_only: { type: "boolean", description: "If true, return only entries flagged as vague or backfilled." },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Max entries to return (default 50)." },
      },
    },
    annotations: ro("List participation entries"),
  },
  {
    name: "log_entry",
    title: "Log a participation entry",
    description:
      "Create a new contemporaneous participation entry in Contempo. Automatically evaluates IRS contemporaneity and vagueness risk heuristics and matches known property names.",
    inputSchema: {
      type: "object",
      required: ["property_name", "task", "duration_minutes"],
      properties: {
        property_name: { type: "string", description: "Rental property name (matched against user's roster if present)." },
        task: { type: "string", description: "Concrete description of the work performed (at least 12 characters)." },
        duration_minutes: { type: "integer", minimum: 1, maximum: 1440, description: "Duration in minutes." },
        category: {
          type: "string",
          description: "Category (e.g. maintenance, turnover, guest_communication, supply_run, admin, inspection, other).",
        },
        activity_date: { type: "string", description: "ISO-8601 timestamp of when the work happened. Defaults to now." },
        miles: { type: "number", minimum: 0, description: "Optional business miles driven for this entry." },
        status: {
          type: "string",
          enum: ["confirmed", "pending_review"],
          description: "Defaults to 'confirmed'.",
        },
      },
    },
    annotations: rw("Log a participation entry"),
  },
  {
    name: "audit_risk_check",
    title: "Check entries for IRS audit risks",
    description:
      "Scan a tax year's entries for audit-defense weaknesses: unconfirmed drafts, vague task descriptions, backfilled entries (>14 days late), unusually long single entries (>8 hours), and entries missing a property.",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: "Tax year (YYYY). Defaults to the current UTC year." },
      },
    },
    annotations: ro("Check entries for IRS audit risks"),
  },
  {
    name: "export_audit_summary",
    title: "Export CPA / audit-defense summary",
    description:
      "Produce a structured audit-defense summary for a tax year: totals by property, category, and month, contemporaneity score, mileage total, and any flagged items for CPA review.",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "integer", description: "Tax year (YYYY). Defaults to the current UTC year." },
      },
    },
    annotations: ro("Export CPA / audit-defense summary"),
  },
];

interface EntryRow {
  id: string;
  property_id: string;
  property_name: string;
  task: string;
  duration_minutes: number;
  category: string;
  status: string;
  source: string;
  activity_date: string;
  logged_at: string;
  confirmed_at: string | null;
  is_vague: boolean;
  is_backfilled: boolean;
  days_late: number;
  risk_reasons: string[];
  miles: number;
  role_name: string | null;
}

function yearBounds(yearArg: unknown): { year: number; start: string; end: string } {
  const nowYear = new Date().getUTCFullYear();
  const year = typeof yearArg === "number" && Number.isInteger(yearArg) && yearArg >= 2020 && yearArg <= 2100 ? yearArg : nowYear;
  return { year, start: `${year}-01-01T00:00:00.000Z`, end: `${year + 1}-01-01T00:00:00.000Z` };
}

async function fetchYearEntries(db: Db, userId: string, year: number): Promise<EntryRow[]> {
  const { start, end } = yearBounds(year);
  const { data, error } = await db
    .from("entries")
    .select(
      "id, property_id, property_name, task, duration_minutes, category, status, source, activity_date, logged_at, confirmed_at, is_vague, is_backfilled, days_late, risk_reasons, miles, role_name"
    )
    .eq("user_id", userId)
    .gte("activity_date", start)
    .lt("activity_date", end)
    .order("activity_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EntryRow[];
}

function summarize(entries: EntryRow[], year: number) {
  let confirmedMin = 0;
  let ownerConfirmedMin = 0;
  let pendingMin = 0;
  let totalMiles = 0;
  let flaggedCount = 0;
  const byProperty: Record<string, { minutes: number; entries: number }> = {};
  const byCategory: Record<string, { minutes: number; entries: number }> = {};
  const byMonth: Record<string, { minutes: number; entries: number }> = {};

  for (const e of entries) {
    if (e.is_vague || e.is_backfilled) flaggedCount++;
    if (e.status === "confirmed") {
      confirmedMin += e.duration_minutes;
      if (!e.role_name) ownerConfirmedMin += e.duration_minutes;
      totalMiles += Number(e.miles ?? 0);
      const prop = e.property_name || "(Unassigned)";
      byProperty[prop] = {
        minutes: (byProperty[prop]?.minutes ?? 0) + e.duration_minutes,
        entries: (byProperty[prop]?.entries ?? 0) + 1,
      };
      const cat = e.category || "other";
      byCategory[cat] = {
        minutes: (byCategory[cat]?.minutes ?? 0) + e.duration_minutes,
        entries: (byCategory[cat]?.entries ?? 0) + 1,
      };
      const month = e.activity_date.slice(0, 7);
      byMonth[month] = {
        minutes: (byMonth[month]?.minutes ?? 0) + e.duration_minutes,
        entries: (byMonth[month]?.entries ?? 0) + 1,
      };
    } else {
      pendingMin += e.duration_minutes;
    }
  }

  const confirmedHours = Math.round((confirmedMin / 60) * 100) / 100;
  const ownerConfirmedHours = Math.round((ownerConfirmedMin / 60) * 100) / 100;
  const pendingHours = Math.round((pendingMin / 60) * 100) / 100;
  const contemporaneityScore =
    entries.length === 0 ? 100 : Math.round(((entries.length - flaggedCount) / entries.length) * 100);

  return {
    year,
    total_entries: entries.length,
    confirmed_hours: confirmedHours,
    owner_only_confirmed_hours: ownerConfirmedHours,
    pending_review_hours: pendingHours,
    total_miles: Math.round(totalMiles * 10) / 10,
    contemporaneity_score_pct: contemporaneityScore,
    flagged_entries_count: flaggedCount,
    tests: {
      str_100h: { target_hours: 100, remaining_hours: Math.max(0, Math.round((100 - ownerConfirmedHours) * 100) / 100), met: ownerConfirmedHours >= 100 },
      str_500h: { target_hours: 500, remaining_hours: Math.max(0, Math.round((500 - ownerConfirmedHours) * 100) / 100), met: ownerConfirmedHours >= 500 },
      reps_750h: { target_hours: 750, remaining_hours: Math.max(0, Math.round((750 - ownerConfirmedHours) * 100) / 100), met: ownerConfirmedHours >= 750 },
    },
    by_property: Object.fromEntries(
      Object.entries(byProperty).map(([k, v]) => [k, { hours: Math.round((v.minutes / 60) * 100) / 100, entries: v.entries }])
    ),
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, { hours: Math.round((v.minutes / 60) * 100) / 100, entries: v.entries }])
    ),
    by_month: Object.fromEntries(
      Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, { hours: Math.round((v.minutes / 60) * 100) / 100, entries: v.entries }])
    ),
  };
}

async function runTool(db: Db, caller: Caller, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_tax_test_progress": {
      const { year } = yearBounds(args.year);
      const entries = await fetchYearEntries(db, caller.userId, year);
      return summarize(entries, year);
    }

    case "list_properties": {
      const { data, error } = await db
        .from("properties")
        .select("id, name, created_at")
        .eq("user_id", caller.userId)
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return { properties: data ?? [] };
    }

    case "list_entries": {
      const { year } = yearBounds(args.year);
      const entries = await fetchYearEntries(db, caller.userId, year);
      const propFilter = typeof args.property === "string" ? args.property.trim().toLowerCase() : "";
      const statusFilter = typeof args.status === "string" ? args.status : "all";
      const flaggedOnly = Boolean(args.flagged_only);
      const limit = typeof args.limit === "number" ? Math.min(200, Math.max(1, Math.floor(args.limit))) : 50;

      const filtered = entries.filter((e) => {
        if (statusFilter !== "all" && e.status !== statusFilter) return false;
        if (propFilter && !e.property_name.toLowerCase().includes(propFilter)) return false;
        if (flaggedOnly && !e.is_vague && !e.is_backfilled) return false;
        return true;
      });

      return {
        year,
        total_matching: filtered.length,
        entries: filtered.slice(0, limit).map((e) => ({
          id: e.id,
          property_name: e.property_name,
          task: e.task,
          duration_minutes: e.duration_minutes,
          category: e.category,
          status: e.status,
          activity_date: e.activity_date,
          logged_at: e.logged_at,
          miles: e.miles,
          is_vague: e.is_vague,
          is_backfilled: e.is_backfilled,
          days_late: e.days_late,
          risk_reasons: e.risk_reasons,
          role_name: e.role_name,
        })),
      };
    }

    case "log_entry": {
      const propertyNameInput = String(args.property_name ?? "").trim();
      const task = String(args.task ?? "").trim();
      const durationMinutes = Number(args.duration_minutes ?? 0);
      if (!propertyNameInput) throw new Error("property_name is required.");
      if (!task) throw new Error("task is required.");
      if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
        throw new Error("duration_minutes must be between 1 and 1440.");
      }
      const nowIso = new Date().toISOString();
      const activityDateIso = typeof args.activity_date === "string" && args.activity_date.trim() ? args.activity_date.trim() : nowIso;
      const risk = flagRisk({ task, durationMinutes, activityDateIso, loggedAtIso: nowIso });
      const category = typeof args.category === "string" && args.category.trim() ? args.category.trim().slice(0, 100) : "other";
      const status = args.status === "pending_review" ? "pending_review" : "confirmed";
      const miles = typeof args.miles === "number" && Number.isFinite(args.miles) && args.miles >= 0 ? args.miles : 0;

      // Match existing property if present (case-insensitive).
      const { data: props } = await db.from("properties").select("id, name").eq("user_id", caller.userId);
      const matched = ((props ?? []) as { id: string; name: string }[]).find(
        (p) => p.name.toLowerCase() === propertyNameInput.toLowerCase()
      );

      const id = crypto.randomUUID();
      const { data, error } = await db
        .from("entries")
        .insert({
          id,
          user_id: caller.userId,
          property_id: matched?.id ?? "",
          property_name: matched?.name ?? propertyNameInput.slice(0, 200),
          task: task.slice(0, 5000),
          duration_minutes: Math.round(durationMinutes),
          category,
          status,
          source: "text",
          activity_date: activityDateIso,
          logged_at: nowIso,
          confirmed_at: status === "confirmed" ? nowIso : null,
          is_vague: risk.isVague,
          is_backfilled: risk.isBackfilled,
          days_late: risk.daysLate,
          risk_reasons: risk.reasons,
          miles,
          is_trip: miles > 0,
        })
        .select("id, property_name, task, duration_minutes, category, status, activity_date, is_vague, is_backfilled, risk_reasons")
        .single();
      if (error) throw new Error(error.message);
      return { created: data, risk };
    }

    case "audit_risk_check": {
      const { year } = yearBounds(args.year);
      const entries = await fetchYearEntries(db, caller.userId, year);
      const issues: { entry_id: string; activity_date: string; property_name: string; task: string; flags: string[] }[] = [];
      for (const e of entries) {
        const flags: string[] = [];
        if (e.status === "pending_review") flags.push("unconfirmed_draft");
        if (e.is_vague) flags.push("vague_description");
        if (e.is_backfilled) flags.push(`backfilled_${e.days_late}_days_late`);
        if (e.duration_minutes > 480) flags.push("over_8_hours");
        if (!e.property_name.trim()) flags.push("missing_property");
        if (flags.length > 0) {
          issues.push({
            entry_id: e.id,
            activity_date: e.activity_date,
            property_name: e.property_name,
            task: e.task,
            flags,
          });
        }
      }
      return {
        year,
        total_entries: entries.length,
        entries_with_risks: issues.length,
        issues: issues.slice(0, 100),
      };
    }

    case "export_audit_summary": {
      const { year } = yearBounds(args.year);
      const entries = await fetchYearEntries(db, caller.userId, year);
      const summary = summarize(entries, year);
      const flagged = entries
        .filter((e) => e.is_vague || e.is_backfilled || e.status === "pending_review")
        .slice(0, 50)
        .map((e) => ({
          id: e.id,
          activity_date: e.activity_date,
          property_name: e.property_name,
          task: e.task,
          duration_minutes: e.duration_minutes,
          status: e.status,
          risk_reasons: e.risk_reasons,
        }));
      return { ...summary, flagged_for_review: flagged, disclaimer: "Informational summary based on user-logged records; not tax or legal advice." };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function handleMcp(req: Request, caller: Caller, db: Db): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return mcpJson({ error: "POST only" }, 405);

  const body = (await req.json().catch(() => null)) as
    | { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
    | null;
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return mcpJson({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request" } }, 400);
  }
  const id = body.id ?? null;

  if (body.method === "notifications/initialized" || body.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: cors });
  }

  try {
    if (body.method === "initialize") {
      return mcpJson({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "contempo", version: SERVER_VERSION },
        },
      });
    }
    if (body.method === "ping") {
      return mcpJson({ jsonrpc: "2.0", id, result: {} });
    }
    if (body.method === "tools/list") {
      return mcpJson({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    }
    if (body.method === "tools/call") {
      const params = body.params ?? {};
      const toolName = String(params.name ?? "");
      const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
      const result = await runTool(db, caller, toolName, toolArgs);
      return mcpJson({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      });
    }
    return mcpJson({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${body.method}` } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return mcpJson({
      jsonrpc: "2.0",
      id,
      result: { isError: true, content: [{ type: "text", text: message }] },
    });
  }
}
