// MCP server (Streamable HTTP, JSON responses) over the household log.
//
// Auth: `Authorization: Bearer <token>` where the token is either a Supabase session JWT (the
// same Google / Apple sign-in the app uses; OAuth-capable agents discover the auth server via
// /.well-known/oauth-protected-resource) or a personal access token `nbl_…` created in the app
// for agents that cannot do OAuth.
//
// The tools return facts (events, profile, the status line). They never aggregate or advise:
// interpretation is the job of the user's own agent.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { derive, eventTypes, status, statusLine, typeSpec, validate, type LogEvent } from "../_shared/core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROTOCOL_VERSION = "2025-06-18";

interface Caller {
  userId: string;
  householdId: string;
  scope: "read" | "write";
  via: "oauth" | "token";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors, ...extra } });
}

async function authenticate(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (token.startsWith("nbl_")) {
    const { data } = await admin.rpc("resolve_access_token", { p_token: token });
    const row = Array.isArray(data) ? data[0] : null;
    return row ? { userId: row.user_id, householdId: row.household_id, scope: row.scope, via: "token" } : null;
  }
  const { data: user } = await admin.auth.getUser(token);
  if (!user?.user) return null;
  const { data: member } = await admin.from("members").select("household_id").eq("user_id", user.user.id).maybeSingle();
  return member ? { userId: user.user.id, householdId: member.household_id, scope: "write", via: "oauth" } : null;
}

const TOOLS = [
  {
    name: "get_status",
    description:
      "The household's one-line status (time since last feed, next breast side, last diaper, sleep state) plus the raw status fields, the on-duty caregiver and unresolved duplicate flags.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_baby_profile",
    description:
      "Baby name, birth date and age in days, bottle size preset, enabled tracking categories and caregivers. Use the birth date to reason about age-specific questions.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_event_types",
    description: "The closed set of entry types and their fields. Use before log_event.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_events",
    description:
      "Raw log entries (active ones only, edits applied, undone and merged entries removed), oldest first. Bottle entries include ml computed from the fraction and the household bottle size. No totals or summaries: compute what you need from these rows.",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: "ISO time, inclusive. Default: 24 hours ago." },
        until: { type: "string", description: "ISO time, exclusive. Default: now." },
        types: { type: "array", items: { type: "string" }, description: "Filter by type id or prefix, e.g. ['feed', 'diaper']." },
        limit: { type: "number", description: "Max rows (default 500, max 5000)." },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "log_event",
    description: "Append a typed entry. Validated exactly like the app. Requires a write-scoped token.",
    inputSchema: {
      type: "object",
      required: ["type"],
      properties: {
        type: { type: "string", description: "An entry type id from list_event_types." },
        fields: { type: "object", description: "Typed fields, e.g. {\"kind\":\"wet\"} or {\"consumed_fraction\":0.5}." },
        occurred_at: { type: "string", description: "ISO time it happened. Default: now." },
      },
    },
  },
  {
    name: "undo_event",
    description: "Undo an entry by id (it stays in history as undone).",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
  {
    name: "resolve_duplicate",
    description: "Resolve a duplicate flag from get_status: merge (keep the earlier) or keep_both.",
    inputSchema: {
      type: "object",
      required: ["original", "duplicate", "resolution"],
      properties: { original: { type: "string" }, duplicate: { type: "string" }, resolution: { type: "string", enum: ["merge", "keep_both"] } },
    },
  },
];

async function loadAll(admin: SupabaseClient, household: string): Promise<LogEvent[]> {
  const rows: LogEvent[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("events").select("*").eq("household_id", household).order("seq").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as LogEvent[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function household(admin: SupabaseClient, id: string) {
  const { data: h } = await admin.from("households").select("id, name, settings").eq("id", id).single();
  const { data: baby } = await admin.from("babies").select("id, name, birth_date").eq("household_id", id).single();
  const { data: members } = await admin.from("members").select("user_id, display_name").eq("household_id", id);
  return { h, baby, members: members ?? [] };
}

async function callTool(name: string, args: Record<string, unknown>, caller: Caller, admin: SupabaseClient, clientName: string) {
  const { h, baby, members } = await household(admin, caller.householdId);
  const settings = (h?.settings ?? {}) as Record<string, unknown>;
  const bottleMl = Number(settings.bottle_ml ?? 120);
  const who = (id?: string | null) => members.find((m) => m.user_id === id)?.display_name ?? (id ? "someone" : null);

  const write = async (type: string, fields: Record<string, unknown>, occurredAt: string, supersedes?: string) => {
    if (caller.scope !== "write") throw new Error("this token is read-only");
    const err = validate(type, fields as never, settings.categories as string[] | undefined);
    if (err) throw new Error(err);
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(), household_id: caller.householdId, baby_id: baby!.id, type, fields, occurred_at: occurredAt,
      logged_at: now, logged_by: caller.userId, supersedes: supersedes ?? null,
      provenance: { surface: "mcp", input: "agent", caller: clientName },
    };
    const { error } = await admin.from("events").insert(row);
    if (error) throw new Error(error.message);
    return row;
  };

  switch (name) {
    case "get_status": {
      const d = derive(await loadAll(admin, caller.householdId));
      const { count } = await admin.from("captures").select("id", { count: "exact", head: true })
        .eq("household_id", caller.householdId).eq("status", "pending");
      const s = status(d, { pendingCaptures: count ?? 0 });
      const iso = (ms?: number) => (ms === undefined ? null : new Date(ms).toISOString());
      return {
        line: statusLine(s, Date.now()),
        last_feed_at: iso(s.last_feed_at), last_feed_kind: s.last_feed_kind ?? null,
        open_feed: s.open_feed_kind ? { kind: s.open_feed_kind, since: iso(s.open_feed_since) } : null,
        next_side: s.next_side ?? null, sleeping_since: iso(s.sleeping_since),
        last_diaper: s.last_diaper_at ? { at: iso(s.last_diaper_at), kind: s.last_diaper_kind } : null,
        on_duty: who(s.on_duty ?? null), pending_voice_captures: s.pending_captures,
        duplicates_to_review: d.duplicates.map((x) => ({ original: x.original, duplicate: x.duplicate })),
      };
    }
    case "get_baby_profile": {
      const birth = baby?.birth_date ? new Date(baby.birth_date) : null;
      return {
        name: baby?.name, birth_date: baby?.birth_date ?? null,
        age_days: birth ? Math.floor((Date.now() - birth.getTime()) / 86_400_000) : null,
        bottle_size_ml: bottleMl, tracking: settings.categories ?? null,
        caregivers: members.map((m) => m.display_name), household: h?.name,
      };
    }
    case "list_event_types":
      return eventTypes.map((t) => ({ type: t.id, category: t.category, label: t.label, fields: fieldDocs(t.id) }));
    case "list_events": {
      const d = derive(await loadAll(admin, caller.householdId));
      const since = Date.parse(String(args.since ?? new Date(Date.now() - 86_400_000).toISOString()));
      const until = Date.parse(String(args.until ?? new Date(Date.now() + 1).toISOString()));
      const types = (args.types as string[] | undefined) ?? [];
      const limit = Math.min(Number(args.limit ?? 500), 5000);
      return d.effective
        .filter((e) => d.status.get(e.id) === "active" || d.status.get(e.id) === "duplicate_unresolved")
        .filter((e) => Date.parse(e.occurred_at) >= since && Date.parse(e.occurred_at) < until)
        .filter((e) => types.length === 0 || types.some((p) => e.type === p || e.type.startsWith(p + ".") || e.type.startsWith(p)))
        .slice(0, limit)
        .map((e) => ({
          id: e.id, type: e.type, occurred_at: e.occurred_at, fields: e.fields,
          ml: typeof e.fields.consumed_ml === "number" ? e.fields.consumed_ml
            : typeof e.fields.consumed_fraction === "number" ? Math.round(e.fields.consumed_fraction * bottleMl)
            : typeof e.fields.amount_ml === "number" ? e.fields.amount_ml : undefined,
          logged_by: who(e.logged_by), via: `${e.provenance.surface}/${e.provenance.input}`,
          transcript: e.provenance.raw_transcript, duplicate_unresolved: d.status.get(e.id) === "duplicate_unresolved" || undefined,
        }));
    }
    case "log_event": {
      const row = await write(String(args.type), (args.fields as Record<string, unknown>) ?? {}, String(args.occurred_at ?? new Date().toISOString()));
      return { logged: row.id, type: row.type, occurred_at: row.occurred_at };
    }
    case "undo_event": {
      const row = await write("undo", {}, new Date().toISOString(), String(args.id));
      return { undone: args.id, event: row.id };
    }
    case "resolve_duplicate": {
      const row = await write("resolve", { original: String(args.original), duplicate: String(args.duplicate), resolution: String(args.resolution) },
        new Date().toISOString());
      return { resolved: row.id };
    }
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

function fieldDocs(type: string) {
  const s = typeSpec(type);
  const docs: Record<string, string> = {};
  for (const q of s?.questions ?? []) {
    if (q === "amount") docs.consumed_fraction = "0.25 | 0.5 | 0.75 | 1 (or consumed_ml: number)";
    if (q === "side") docs.side = "left | right | both";
    if (q === "contents") docs.contents = "formula | breast_milk";
    if (q === "diaper_kind") docs.kind = "wet | dirty | both | dry (required)";
    if (q === "solids_amount") docs.amount = "taste | some | most | all";
  }
  for (const n of (s as { numbers?: string[] } | undefined)?.numbers ?? []) {
    if (n === "ml") docs.amount_ml = "number";
    if (n === "grams") docs.grams = "number (required)";
  }
  return docs;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const base = `${url.origin}${url.pathname.replace(/\/\.well-known.*$/, "").replace(/\/$/, "")}`;
  if (url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return json({ resource: base, authorization_servers: [`${SUPABASE_URL}/auth/v1`], bearer_methods_supported: ["header"] });
  }
  if (req.method === "GET") {
    return json({ name: "newborn-log-mcp", transport: "streamable-http", post: base }, 200);
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const caller = await authenticate(req, admin);
  if (!caller) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized: use a session token or a personal access token (nbl_…)" } }, 401, {
      "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
    });
  }

  let msg: { id?: string | number; method: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const reply = (result: unknown) => json({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string) => json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "newborn-log", version: "0.1.0" },
        instructions:
          "Facts from one household's newborn log. Tools return raw entries and the current status; they do not summarize or give advice. Compute any totals yourself from list_events.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.filter((t) => caller.scope === "write" || t.annotations?.readOnlyHint) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const clientName = req.headers.get("User-Agent")?.slice(0, 60) ?? "mcp-client";
      try {
        const result = await callTool(name, args, caller, admin, clientName);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: Array.isArray(result) ? { items: result } : result });
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `method not found: ${msg.method}`);
  }
});
