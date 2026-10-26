import { describe, expect, it } from "vitest";
import { atLocal, board, LINE_PX, textPx } from "@headway/core";
import { HeadwayApp, K, type Store } from "../src/app.ts";

const NOW = atLocal("20261027", "07:55");

function memory(init: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...init };
  return { data, async get(k) { return data[k] ?? null; }, async set(k, v) { data[k] = v; } };
}

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function setup(route: Route, store = memory()) {
  const calls: string[] = [];
  let lines: string[] = [];
  const app = new HeadwayApp({
    api: "https://hw.test", store, now: () => NOW,
    fetch: async (u, init) => { calls.push(`${init?.method ?? "GET"} ${new URL(u).pathname}${new URL(u).search}`); return route(new URL(u), init); },
    onLines: (l) => (lines = l),
  });
  return { app, store, calls, lines: () => lines };
}

describe("unpaired", () => {
  it("opens on a live default board (no dead end for a first launch), then any pair", async () => {
    const { app, calls, lines, store } = setup((u) => (u.pathname === "/api/board"
      ? json({ ...board(u.searchParams.get("from")!, u.searchParams.get("to")!, NOW, null)!, live: true }) : json({}, 404)));
    await app.start();
    expect(calls).toContain("GET /api/board?from=san_francisco&to=sj_diridon");
    expect(lines()[0]).toMatch(/^SF > SJ DIRIDON/);
    expect(lines().at(-2)).toBe("Pair in the Headway app for your commute");
    expect(lines().at(-1)).toBe("tap: flip  hold: menu  2x: exit");
    await app.run([{ kind: "show_pair", pair: { from: "palo_alto", to: "sj_diridon" } }]);
    expect(calls).toContain("GET /api/board?from=palo_alto&to=sj_diridon");
    expect(lines()[0]).toMatch(/^PALO ALTO > SJ DIRIDON/);
    expect(JSON.parse(store.data[K.pair])).toEqual({ from: "palo_alto", to: "sj_diridon" });
    for (const l of lines()) expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
  });
  it("falls back to the bundled timetable offline", async () => {
    const { app, lines } = setup(() => { throw new TypeError("offline"); }, memory({ [K.pair]: JSON.stringify({ from: "mountain_view", to: "san_francisco" }) }));
    await app.start();
    expect(lines()[0]).toMatch(/^MTN VIEW > SF/);
    expect(lines().at(-2)).toBe("Offline: timetable times");
    expect(app.board!.trains.length).toBeGreaterThan(0);
  });
  it("offline on the very first launch: the default board from the timetable", async () => {
    const { app, lines } = setup(() => { throw new TypeError("offline"); });
    await app.start();
    expect(lines()[0]).toMatch(/^SF > SJ DIRIDON/);
  });
  it("double tap on the board asks to exit", async () => {
    let exited = 0;
    const app = new HeadwayApp({ api: "https://hw.test", store: memory(), now: () => NOW, fetch: async () => { throw new TypeError("offline"); }, onLines: () => {}, onExit: () => exited++ });
    await app.start();
    await app.input("double_tap");
    expect(exited).toBe(1);
  });
});

describe("paired", () => {
  const commute = board("mountain_view", "san_francisco", NOW, null, "morning")!;
  it("shows the commute and tracks with the device token", async () => {
    const posts: unknown[] = [];
    const { app, calls, lines } = setup(async (u, init) => {
      if (u.pathname === "/api/me/board") return json({ board: commute, has_commute: true, tracked: null });
      if (u.pathname === "/api/track") { posts.push(JSON.parse(String(init?.body))); return json({}); }
      return json({}, 404);
    }, memory({ [K.token]: "hwd_x" }));
    await app.start();
    expect(app.paired).toBe(true);
    expect(lines()[0]).toMatch(/^MTN VIEW > SF/);
    await app.input("long_press"); // menu: "Track <train>" first
    await app.input("tap");
    expect(posts[0]).toMatchObject({ trip_id: commute.trains[0].trip_id, from: "mountain_view", to: "san_francisco" });
    expect(calls.filter((c) => c.startsWith("GET /api/me/board")).length).toBeGreaterThan(1);
  });
  it("unpaired from the app: forgets the token and carries on unpaired", async () => {
    const store = memory({ [K.token]: "hwd_gone" });
    const { app } = setup((u) => (u.pathname === "/api/me/board" ? json({ error: "x" }, 401) : json({}, 404)), store);
    await app.start();
    expect(store.data[K.token]).toBe("");
    expect(app.paired).toBe(false);
  });
  it("pairs with a code", async () => {
    const store = memory();
    const { app } = setup((u) => (u.pathname === "/api/pair" ? json({ device_token: "hwd_new" }) : u.pathname === "/api/me/board" ? json({ board: commute, has_commute: true, tracked: null }) : json({}, 404)), store);
    expect(await app.pairWith("123 456", "Even G2")).toBeNull();
    expect(store.data[K.token]).toBe("hwd_new");
    expect(app.board?.leg).toBe("morning");
  });
  it("shows a wrong code's reason", async () => {
    const { app } = setup(() => json({ error: "that code is wrong" }, 400));
    expect(await app.pairWith("000000", "Even G2")).toBe("that code is wrong");
  });
});
