import { describe, expect, it } from "vitest";
import { starterBrief } from "@g2digest/core";
import { handleMcp, TOOLS } from "../src/worker/mcp.ts";
import type { Db } from "../src/worker/store.ts";

/** Lightweight in-memory Supabase table fake for hermetic MCP integration tests. */
function makeFakeDb() {
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [],
    briefs: [],
    bookmarks: [],
    reader_signals: [],
    editions: [],
    audio_meta: [],
  };

  function query(table: string) {
    let rows = [...(tables[table] ?? [])];
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let orderCol: string | null = null;
    let ascending = true;
    let lim: number | null = null;

    const execute = () => {
      let out = rows.filter((r) => filters.every((f) => f(r)));
      if (orderCol) {
        const col = orderCol;
        out.sort((a, b) => {
          const av = String(a[col] ?? "");
          const bv = String(b[col] ?? "");
          return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (lim !== null) out = out.slice(0, lim);
      return out;
    };

    const builder: Record<string, unknown> = {
      select() { return builder; },
      eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return builder; },
      gte(col: string, val: unknown) { filters.push((r) => String(r[col] ?? "") >= String(val)); return builder; },
      is(col: string, val: unknown) { filters.push((r) => (r[col] ?? null) === val); return builder; },
      order(col: string, opts?: { ascending?: boolean }) { orderCol = col; ascending = opts?.ascending !== false; return builder; },
      limit(n: number) { lim = n; return builder; },
      maybeSingle: async () => ({ data: execute()[0] ?? null, error: null }),
      single: async () => ({ data: execute()[0] ?? null, error: null }),
      upsert: async (row: Record<string, unknown>) => {
        tables[table] = [...(tables[table] ?? []), row];
        return { data: row, error: null };
      },
      then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
        resolve({ data: execute(), error: null });
      },
    };
    return builder;
  }

  const db = {
    from: (table: string) => query(table),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUploadUrl: async () => ({ data: { signedUrl: "https://storage.local/upload" }, error: null }),
      }),
    },
  } as unknown as Db;

  return { db, tables };
}

const fakeKv = {
  get: async () => null,
  put: async () => undefined,
} as unknown as KVNamespace;

async function rpc(db: Db, method: string, params?: Record<string, unknown>, httpMethod = "POST") {
  const req = new Request("https://g2digest.local/mcp", {
    method: httpMethod,
    headers: { "Content-Type": "application/json" },
    body: httpMethod === "POST" ? JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) : undefined,
  });
  const res = await handleMcp(req, { userId: "user-1", via: "token", agentName: "test-agent" }, db, fakeKv);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("MCP server integration", () => {
  it("answers GET /mcp with 405 and advertises all 8 tools", async () => {
    const { db } = makeFakeDb();
    const getRes = await rpc(db, "tools/list", undefined, "GET");
    expect(getRes.status).toBe(405);

    const init = await rpc(db, "initialize", { protocolVersion: "2025-06-18" });
    expect(init.status).toBe(200);
    const initResult = init.body.result as { instructions: string; serverInfo: { name: string } };
    expect(initResult.serverInfo.name).toBe("g2digest");
    expect(initResult.instructions).toContain("get_bookmarks");
    expect(initResult.instructions).toContain("get_reader_signals");

    const listed = await rpc(db, "tools/list");
    const tools = (listed.body.result as { tools: { name: string }[] }).tools;
    expect(tools).toHaveLength(TOOLS.length);
    expect(tools.map((t) => t.name).sort()).toEqual([
      "create_audio_upload",
      "get_bookmarks",
      "get_card_authoring_guide",
      "get_last_cards",
      "get_reader_signals",
      "get_user_brief",
      "publish_cards",
      "validate_cards",
    ]);
  });

  it("returns user bookmarks via get_bookmarks and isolates other users", async () => {
    const { db, tables } = makeFakeDb();
    tables.bookmarks.push(
      {
        user_id: "user-1",
        edition_date: "2026-11-22",
        card_slug: "solar-grid",
        card_title: "Grid storage milestone",
        section_title: "Energy",
        body: "Utility-scale batteries crossed 20 GW.",
        source_url: "https://example.com/energy",
        created_at: "2026-11-22T15:00:00Z",
      },
      {
        user_id: "user-2",
        edition_date: "2026-11-22",
        card_slug: "private-note",
        card_title: "Other user bookmark",
        section_title: "Private",
        body: "Must not leak.",
        source_url: null,
        created_at: "2026-11-22T16:00:00Z",
      },
    );

    const res = await rpc(db, "tools/call", { name: "get_bookmarks", arguments: { limit: 10 } });
    expect(res.status).toBe(200);
    const out = (res.body.result as { structuredContent: { count: number; bookmarks: { card_slug: string }[] } }).structuredContent;
    expect(out.count).toBe(1);
    expect(out.bookmarks[0].card_slug).toBe("solar-grid");
  });

  it("aggregates reader signals by section via get_reader_signals", async () => {
    const { db, tables } = makeFakeDb();
    const nowIso = new Date().toISOString();
    tables.reader_signals.push(
      { user_id: "user-1", edition_date: "2026-11-22", card_slug: "c1", section_id: "weather", signal: "glance_played", duration_ms: 18000, created_at: nowIso },
      { user_id: "user-1", edition_date: "2026-11-22", card_slug: "c2", section_id: "weather", signal: "deep_dive_played", duration_ms: 120000, created_at: nowIso },
      { user_id: "user-1", edition_date: "2026-11-22", card_slug: "c3", section_id: "transit", signal: "skipped_fast", duration_ms: 900, created_at: nowIso },
      { user_id: "user-2", edition_date: "2026-11-22", card_slug: "c4", section_id: "weather", signal: "deep_dive_played", duration_ms: 90000, created_at: nowIso },
    );

    const res = await rpc(db, "tools/call", { name: "get_reader_signals", arguments: { days: 7 } });
    expect(res.status).toBe(200);
    const out = (res.body.result as {
      structuredContent: {
        total_signals: number;
        by_section: Record<string, { deep_dive_played: number; glance_played: number; skipped_fast: number }>;
      };
    }).structuredContent;
    expect(out.total_signals).toBe(3);
    expect(out.by_section.weather).toEqual({ deep_dive_played: 1, glance_played: 1, bookmarked: 0, skipped_fast: 0 });
    expect(out.by_section.transit).toEqual({ deep_dive_played: 0, glance_played: 0, bookmarked: 0, skipped_fast: 1 });
  });

  it("returns the user's brief and refuses mismatched user_id", async () => {
    const { db, tables } = makeFakeDb();
    const brief = starterBrief();
    tables.briefs.push({ user_id: "user-1", brief_version: 2, config: brief });
    tables.profiles.push({
      user_id: "user-1",
      language: brief.language,
      units: brief.units,
      glossary: brief.glossary,
      delivery: brief.delivery,
    });

    const ok = await rpc(db, "tools/call", { name: "get_user_brief", arguments: {} });
    expect(ok.status).toBe(200);
    const content = (ok.body.result as { structuredContent: { user_id: string; brief_version: number } }).structuredContent;
    expect(content.user_id).toBe("user-1");
    expect(content.brief_version).toBe(2);

    const denied = await rpc(db, "tools/call", { name: "get_user_brief", arguments: { user_id: "someone-else" } });
    expect((denied.body.result as { isError: boolean }).isError).toBe(true);
  });
});
