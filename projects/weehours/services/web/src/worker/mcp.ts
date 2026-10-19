// MCP server (Streamable HTTP, JSON responses) over the household log, served at /mcp by this
// site's Worker. Authentication happens before this runs (index.ts): OAuth grants issued by the
// Worker itself, or personal access tokens `wh_…` created in the app for agents that cannot do
// OAuth. Either way the caller arrives as a user id plus a scope.
//
// The tools return facts (events, profile, the status line). They never aggregate or advise:
// interpretation is the job of the user's own agent.

import type { SupabaseClient } from "@supabase/supabase-js";

/** A service-role client on the `weehours` schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;
import { derive, eventTypes, fieldSpecs, registry, status, statusLine, typeSpec, validate, type LogEvent } from "@weehours/core";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "0.2.0";

export interface Caller {
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

const CHILD = {
  type: "string",
  description: "A child's name or id (see list_children). Required when the household has several children; \"all\" logs for every child.",
};

const TOOLS = [
  {
    name: "get_status",
    description:
      "Each child's one-line status (time since last feed, next breast side, last diaper, sleep state) with the raw status fields, plus the on-duty caregiver and unresolved duplicate flags. Pass child for one child only.",
    inputSchema: { type: "object", properties: { child: { type: "string", description: "A child's name or id. Default: every child." } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_children",
    description:
      "The household's children: id, name, birth date and age in days, and bottle size; plus enabled tracking categories and caregivers. Use birth dates to reason about age-specific questions.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_baby_profile",
    description: "One child's profile (the first child, or `child`): name, birth date, age in days, bottle size, tracking categories and caregivers. Prefer list_children.",
    inputSchema: { type: "object", properties: { child: { type: "string", description: "A child's name or id." } } },
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
        child: { type: "string", description: "Only this child's entries (name or id). Default: every child." },
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
        child: CHILD,
      },
    },
  },
  {
    name: "import_events",
    description:
      "Bulk-import history from another baby tracker's export (CSV, SQLite...), up to 500 entries per call; call it repeatedly for more. " +
      "Read the export, map each row to a Wee Hours type and fields (list_event_types), then: 1) call with dry_run: true and fix every error, " +
      "2) call set_tracking if a category you need is off, 3) import for real. Give every entry a stable source_id (the export's row id, or " +
      "type+timestamp): re-running the same import skips what's already there, so it is safe to retry. Mapping: Wee Hours stores sessions as " +
      "separate start and finish entries, so a feed or sleep row with a start and an end becomes two entries (feed.bottle.start + " +
      "feed.bottle.finish with consumed_ml, feed.breast.start with side + feed.breast.finish, sleep.start + sleep.end); a bottle with only one " +
      "time is feed.bottle.single with consumed_ml; breast feeds with time per side are start (first side), feed.breast.switch at the change, " +
      "finish; free-text notes are type \"note\" with fields {\"transcript\": text}. Times without an offset are read in `timezone` (ask the " +
      "user which zone the export is in). Everything one call writes shares an import_id that undo_import takes back.",
    inputSchema: {
      type: "object",
      required: ["source", "events"],
      properties: {
        source: { type: "string", description: "Where the data comes from, e.g. \"Huckleberry CSV export\"." },
        timezone: { type: "string", description: "IANA zone for times without an offset, e.g. \"America/Los_Angeles\"." },
        dry_run: { type: "boolean", description: "Validate and report without writing. Default false." },
        import_id: { type: "string", description: "Continue an earlier import (from its result) so undo_import covers every batch." },
        events: {
          type: "array",
          maxItems: 500,
          items: {
            type: "object",
            required: ["type", "occurred_at"],
            properties: {
              type: { type: "string" },
              occurred_at: { type: "string", description: "ISO time; with an offset, or local time read in `timezone`." },
              fields: { type: "object" },
              child: CHILD,
              source_id: { type: "string", description: "Stable id of the source row: makes re-imports skip it." },
            },
          },
        },
      },
    },
  },
  {
    name: "undo_import",
    description: "Take back every entry an import_events import_id wrote (they stay in history as undone).",
    inputSchema: { type: "object", required: ["import_id"], properties: { import_id: { type: "string" } } },
  },
  {
    name: "set_tracking",
    description: "Turn tracking categories on (or off) for the household, e.g. before importing pumping or growth history. Category ids are in list_event_types.",
    inputSchema: {
      type: "object",
      properties: {
        enable: { type: "array", items: { type: "string" } },
        disable: { type: "array", items: { type: "string" } },
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

async function loadAll(admin: Db, household: string): Promise<LogEvent[]> {
  const rows: LogEvent[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("events").select("*").eq("household_id", household).order("seq").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as LogEvent[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

interface Child {
  id: string;
  name: string;
  birth_date: string | null;
  settings: Record<string, unknown> | null;
  position: number;
  archived_at: string | null;
}

async function household(admin: Db, id: string) {
  const { data: h } = await admin.from("households").select("id, name, settings").eq("id", id).single();
  const { data: babies } = await admin.from("babies").select("id, name, birth_date, settings, position, archived_at")
    .eq("household_id", id).order("position").order("created_at");
  const { data: members } = await admin.from("members").select("user_id, display_name").eq("household_id", id);
  const all = (babies ?? []) as Child[];
  const active = all.filter((b) => !b.archived_at);
  return { h, all, children: active.length ? active : all.slice(0, 1), members: members ?? [] };
}

export async function callTool(name: string, args: Record<string, unknown>, caller: Caller, admin: Db, clientName: string) {
  const { h, all, children, members } = await household(admin, caller.householdId);
  const settings = (h?.settings ?? {}) as Record<string, unknown>;
  const bottleMlFor = (baby?: string) => Number(all.find((b) => b.id === baby)?.settings?.bottle_ml ?? settings.bottle_ml ?? 120);
  const who = (id?: string | null) => members.find((m) => m.user_id === id)?.display_name ?? (id ? "someone" : null);
  const several = children.length > 1;
  const childName = (id: string) => all.find((b) => b.id === id)?.name ?? null;

  /** The children an argument names: a name or id, "all", or (with one child) nothing. */
  const pick = (arg: unknown, required: boolean): Child[] => {
    const v = arg === undefined || arg === null ? "" : String(arg).trim();
    if (!v) {
      if (!several || !required) return children;
      throw new Error(`this household has several children (${children.map((c) => c.name).join(", ")}): pass child`);
    }
    if (["all", "both", "everyone"].includes(v.toLowerCase())) return children;
    const c = all.find((b) => b.id === v) ?? all.find((b) => b.name.toLowerCase() === v.toLowerCase());
    if (!c) throw new Error(`no child "${v}"; the household's children are ${children.map((x) => x.name).join(", ")}`);
    return [c];
  };

  const write = async (type: string, fields: Record<string, unknown>, occurredAt: string, baby: string, supersedes?: string) => {
    if (caller.scope !== "write") throw new Error("this token is read-only");
    const err = validate(type, fields as never, settings.categories as string[] | undefined);
    if (err) throw new Error(err);
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(), household_id: caller.householdId, baby_id: baby, type, fields, occurred_at: occurredAt,
      logged_at: now, logged_by: caller.userId, supersedes: supersedes ?? null,
      provenance: { surface: "mcp", input: "agent", caller: clientName },
    };
    const { error } = await admin.from("events").insert(row);
    if (error) throw new Error(error.message);
    return row;
  };

  const profile = (c: Child) => {
    const birth = c.birth_date ? new Date(c.birth_date) : null;
    return {
      id: c.id, name: c.name, birth_date: c.birth_date ?? null,
      age_days: birth ? Math.floor((Date.now() - birth.getTime()) / 86_400_000) : null,
      bottle_size_ml: bottleMlFor(c.id),
    };
  };

  switch (name) {
    case "get_status": {
      const events = await loadAll(admin, caller.householdId);
      const household = derive(events);
      const { count } = await admin.from("captures").select("id", { count: "exact", head: true })
        .eq("household_id", caller.householdId).eq("status", "pending");
      const iso = (ms?: number) => (ms === undefined ? null : new Date(ms).toISOString());
      const one = (c: Child) => {
        const s = status(derive(events, c.id), { pendingCaptures: several ? 0 : count ?? 0 });
        return {
          child: c.name, line: statusLine(s, Date.now()),
          last_feed_at: iso(s.last_feed_at), last_feed_kind: s.last_feed_kind ?? null,
          open_feed: s.open_feed_kind ? { kind: s.open_feed_kind, since: iso(s.open_feed_since) } : null,
          next_side: s.next_side ?? null, sleeping_since: iso(s.sleeping_since),
          last_diaper: s.last_diaper_at ? { at: iso(s.last_diaper_at), kind: s.last_diaper_kind } : null,
        };
      };
      const shared = {
        on_duty: who(household.duty?.caregiver ?? null), pending_voice_captures: count ?? 0,
        duplicates_to_review: household.duplicates.map((x) => ({ original: x.original, duplicate: x.duplicate })),
      };
      const chosen = pick(args.child, false);
      // one child (or one asked for): the flat shape older agents read; several: one entry each
      return chosen.length === 1 ? { ...one(chosen[0]), ...shared } : { children: chosen.map(one), ...shared };
    }
    case "list_children":
      return {
        children: children.map(profile), archived: all.filter((b) => b.archived_at).map((b) => b.name),
        tracking: settings.categories ?? null, caregivers: caregivers(members, settings), household: h?.name,
      };
    case "get_baby_profile": {
      const c = args.child ? pick(args.child, true)[0] : children[0];
      return { ...profile(c), tracking: settings.categories ?? null, caregivers: caregivers(members, settings), household: h?.name };
    }
    case "list_event_types":
      return eventTypes.map((t) => ({ type: t.id, category: t.category, label: t.label, fields: fieldDocs(t.id) }));
    case "list_events": {
      const only = args.child ? pick(args.child, true) : null;
      const d = derive(await loadAll(admin, caller.householdId), only?.length === 1 ? only[0].id : undefined);
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
          id: e.id, type: e.type, occurred_at: e.occurred_at, fields: e.fields, child: several ? childName(e.baby_id) : undefined,
          ml: typeof e.fields.consumed_ml === "number" ? e.fields.consumed_ml
            : typeof e.fields.consumed_fraction === "number" ? Math.round(e.fields.consumed_fraction * bottleMlFor(e.baby_id))
            : typeof e.fields.amount_ml === "number" ? e.fields.amount_ml : undefined,
          logged_by: who(e.logged_by), via: `${e.provenance.surface}/${e.provenance.input}`,
          transcript: e.provenance.raw_transcript, duplicate_unresolved: d.status.get(e.id) === "duplicate_unresolved" || undefined,
        }));
    }
    case "log_event": {
      const targets = pick(args.child, true);
      const fields = { ...((args.fields as Record<string, unknown>) ?? {}) };
      if (targets.length > 1) fields.group = crypto.randomUUID();   // logged together: the app undoes them together
      const at = String(args.occurred_at ?? new Date().toISOString());
      const rows = [];
      for (const c of targets) rows.push(await write(String(args.type), fields, at, c.id));
      const out = rows.map((r) => ({ logged: r.id, type: r.type, occurred_at: r.occurred_at, child: childName(r.baby_id) }));
      return out.length === 1 ? out[0] : { logged: out };
    }
    case "import_events": {
      if (caller.scope !== "write") throw new Error("this token is read-only");
      const events = (args.events as Record<string, unknown>[] | undefined) ?? [];
      if (events.length > 500) throw new Error("at most 500 events per call; split the import into batches");
      const source = String(args.source ?? "").trim();
      if (!source) throw new Error("source is required (where the data comes from)");
      const tz = args.timezone ? String(args.timezone) : undefined;
      if (tz && !validZone(tz)) throw new Error(`unknown timezone ${tz}; use an IANA name like America/New_York`);
      const importId = args.import_id ? String(args.import_id) : crypto.randomUUID();
      const enabled = settings.categories as string[] | undefined;
      const now = new Date().toISOString();
      const rows: Record<string, unknown>[] = [];
      const errors: { index: number; source_id?: string; error: string }[] = [];
      for (const [index, e] of events.entries()) {
        const sid = e.source_id === undefined ? undefined : String(e.source_id);
        try {
          const type = String(e.type ?? "");
          const fields = { ...((e.fields as Record<string, unknown>) ?? {}) };
          const err = type === "note" ? (typeof fields.transcript === "string" ? null : "note needs fields.transcript")
            : validate(type, fields as never, enabled);
          if (err) throw new Error(err);
          const at = toInstant(String(e.occurred_at ?? ""), tz);
          const targets = pick(e.child, true);
          if (targets.length > 1) fields.group = await uuidFrom(`${caller.householdId}|${source}|${sid ?? index}|group`);
          for (const c of targets) {
            // a stable source_id gives a stable event id: a re-run finds it and skips it
            const id = sid ? await uuidFrom(`${caller.householdId}|${source}|${sid}|${c.id}`) : crypto.randomUUID();
            rows.push({
              id, household_id: caller.householdId, baby_id: c.id, type, fields, occurred_at: at, logged_at: now,
              logged_by: caller.userId, supersedes: null,
              provenance: { surface: "mcp", input: "agent", caller: clientName, import_id: importId, import_source: source },
            });
          }
        } catch (x) {
          errors.push({ index, ...(sid ? { source_id: sid } : {}), error: (x as Error).message });
        }
      }
      const existing = new Set<string>();
      for (let i = 0; i < rows.length; i += 200) {
        const ids = rows.slice(i, i + 200).map((r) => r.id as string);
        const { data } = await admin.from("events").select("id").eq("household_id", caller.householdId).in("id", ids);
        for (const r of data ?? []) existing.add(r.id as string);
      }
      const fresh = rows.filter((r) => !existing.has(r.id as string));
      if (!args.dry_run && fresh.length) {
        const { error } = await admin.from("events").insert(fresh);
        if (error) throw new Error(error.message);
      }
      const byType: Record<string, number> = {};
      for (const r of fresh) byType[r.type as string] = (byType[r.type as string] ?? 0) + 1;
      return {
        dry_run: Boolean(args.dry_run), import_id: importId,
        [args.dry_run ? "would_import" : "imported"]: fresh.length, by_type: byType,
        skipped_already_imported: existing.size, errors,
        ...(errors.length ? { hint: "fix the rows in errors and send them again; rows without errors are unaffected" } : {}),
      };
    }
    case "undo_import": {
      const id = String(args.import_id ?? "");
      const { data } = await admin.from("events").select("id, baby_id").eq("household_id", caller.householdId)
        .eq("provenance->>import_id", id);
      const all = await loadAll(admin, caller.householdId);
      const undone = new Set(all.filter((e) => e.type === "undo" && e.supersedes).map((e) => e.supersedes as string));
      const targets = (data ?? []).filter((e) => !undone.has(e.id as string));
      if (caller.scope !== "write") throw new Error("this token is read-only");
      const now = new Date().toISOString();
      const rows = targets.map((t) => ({
        id: crypto.randomUUID(), household_id: caller.householdId, baby_id: t.baby_id, type: "undo", fields: {}, occurred_at: now,
        logged_at: now, logged_by: caller.userId, supersedes: t.id, provenance: { surface: "mcp", input: "agent", caller: clientName },
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from("events").insert(rows.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }
      return { import_id: id, undone: rows.length };
    }
    case "set_tracking": {
      if (caller.scope !== "write") throw new Error("this token is read-only");
      const known = new Set(registry.categories.map((c) => c.id));
      const enable = ((args.enable as string[] | undefined) ?? []).map(String);
      const disable = ((args.disable as string[] | undefined) ?? []).map(String);
      const unknown = [...enable, ...disable].filter((c) => !known.has(c));
      if (unknown.length) throw new Error(`unknown categories ${unknown.join(", ")}; use ${[...known].join(", ")}`);
      const current = new Set((settings.categories as string[] | undefined) ?? registry.categories.filter((c) => c.defaultEnabled).map((c) => c.id));
      for (const c of enable) current.add(c);
      for (const c of disable) current.delete(c);
      const next = { ...settings, categories: [...current].sort() };
      const { error } = await admin.from("households").update({ settings: next }).eq("id", caller.householdId);
      if (error) throw new Error(error.message);
      return { tracking: next.categories };
    }
    case "undo_event": {
      const { data: target } = await admin.from("events").select("baby_id").eq("household_id", caller.householdId).eq("id", String(args.id)).maybeSingle();
      const row = await write("undo", {}, new Date().toISOString(), target?.baby_id ?? children[0].id, String(args.id));
      return { undone: args.id, event: row.id };
    }
    case "resolve_duplicate": {
      const row = await write("resolve", { original: String(args.original), duplicate: String(args.duplicate), resolution: String(args.resolution) },
        new Date().toISOString(), children[0].id);
      return { resolved: row.id };
    }
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

/** A UUID derived from `key` (SHA-256, version-5 layout): the same import row always gets the same event id. */
export async function uuidFrom(key: string): Promise<string> {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Caregivers' names, with the role they gave themselves in the app ("Sam (Dad)"). */
export function caregivers(members: { user_id: string; display_name: string }[], settings: Record<string, unknown>): string[] {
  const listed = Array.isArray(settings.caregivers) ? (settings.caregivers as { id?: string; role?: string }[]) : [];
  return members.map((m) => {
    const role = listed.find((c) => c.id === m.user_id)?.role?.trim();
    return role ? `${m.display_name} (${role})` : m.display_name;
  });
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** An ISO time with an offset as is; a local one ("2026-01-05 14:30", "2026-01-05T14:30:00") read in `tz`. */
export function toInstant(text: string, tz?: string): string {
  const t = text.trim().replace(" ", "T");
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(t)) {
    const ms = Date.parse(t);
    if (Number.isNaN(ms)) throw new Error(`can't read time ${text}`);
    return new Date(ms).toISOString();
  }
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) throw new Error(`can't read time ${text}; use ISO 8601`);
  if (!tz) throw new Error(`time ${text} has no offset: pass timezone`);
  const [y, mo, d, h = "0", mi = "0", sec = "0"] = m.slice(1);
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
  // the zone's offset at that moment, found by formatting a guess back into wall time (twice, for DST edges)
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += wall - shown;
  }
  return new Date(guess).toISOString();
}

export function fieldDocs(type: string) {
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
    if (n === "height_cm") docs.height_cm = "number, centimeters (required)";
    if (n === "head_cm") docs.head_cm = "number, centimeters, head circumference (required)";
  }
  for (const f of fieldSpecs(type)) {
    const what = f.kind === "choice" ? f.options!.map((o) => o.key).join(" | ")
      : f.kind === "number" ? `number${f.unit === "celsius" ? ", degrees Celsius" : f.unit ? `, ${f.unit}` : ""}` : "text";
    docs[f.key] = what + (f.required ? " (required)" : "");
  }
  return docs;
}

/** One JSON-RPC request from an authenticated caller. */
export async function handleMcp(req: Request, caller: Caller, admin: Db): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return json({ name: "wee-hours-mcp", transport: "streamable-http" }, 200);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

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
        serverInfo: { name: "wee-hours", version: SERVER_VERSION },
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
}
