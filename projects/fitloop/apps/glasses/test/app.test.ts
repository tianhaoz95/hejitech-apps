import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LINE_PX, textPx, type Plan } from "@fitloop/core";
import { FitLoopApp, K, type Store, type TodayData } from "../src/app.ts";

const plan: Plan = JSON.parse(readFileSync(new URL("../../../packages/core/fixtures/example-plan.json", import.meta.url), "utf8"));
const DATE = "2026-10-26"; // a Monday
const NOW = Date.UTC(2026, 9, 26, 19); // 12:00 Pacific

function memory(init: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...init };
  return { data, async get(k) { return data[k] ?? null; }, async set(k, v) { data[k] = v; } };
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const todayData = (): TodayData => ({
  date: DATE, plan: { version: 3, title: plan.title, targets: plan.targets ?? null }, state: { day: plan.week.mon }, checkins: [], live: { hr: 120 },
  glasses: { show_hr: true, auto_rest_timer: true },
});

function setup(route: (url: URL, init?: RequestInit) => Response | Promise<Response>, store = memory({ [K.token]: "fld_x" })) {
  const posts: { path: string; body: unknown }[] = [];
  let lines: string[] = [];
  let online = true;
  const app = new FitLoopApp({
    api: "https://fl.test", store, now: () => NOW, today: () => DATE,
    fetch: async (u, init) => {
      if (!online) throw new TypeError("offline");
      const url = new URL(u);
      if (init?.method === "POST") posts.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
      return route(url, init);
    },
    onLines: (l) => (lines = l),
  });
  return { app, store, posts, lines: () => lines, offline: (v: boolean) => (online = !v) };
}

describe("plugin", () => {
  it("without pairing: a working demo day that sends nothing (no dead end for a reviewer)", async () => {
    const store = memory();
    const { app, lines, posts } = setup(() => json({}, 404), store);
    await app.start();
    expect(lines()[0]).toMatch(/^DEMO: FULL BODY A/);
    expect(lines().at(-2)).toBe("Demo day: pair in the FitLoop app");
    expect(lines().at(-1)).toBe("tap: open  hold: menu  2x: exit");
    await app.input("tap"); // breakfast
    await app.input("tap"); // ate it
    expect(posts).toEqual([]);
    expect(JSON.parse(store.data[K.demo])[0]).toMatchObject({ ref: "breakfast", status: "done" });
    let exited = 0;
    const b = new FitLoopApp({ api: "https://fl.test", store: memory(), today: () => DATE, fetch: async () => json({}), onLines: () => {}, onExit: () => exited++ });
    await b.start();
    await b.input("double_tap");
    expect(exited).toBe(1);
  });
  it("shows today and checks a meal off through the Worker", async () => {
    const { app, lines, posts } = setup((u) => (u.pathname === "/api/today" ? json(todayData()) : json({ ok: true })));
    await app.start();
    expect(lines()[0]).toMatch(/^FULL BODY A +0%$/);
    for (const l of lines()) expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
    await app.input("tap"); // breakfast (07:30) is first
    await app.input("tap"); // ate it
    expect(posts[0]).toMatchObject({ path: "/api/checkins", body: { date: DATE, ref: "breakfast", kind: "meal", status: "done", plan_version: 3 } });
    expect(lines().at(-1)).toBe(">> BREAKFAST CHECKED OFF");
  });
  it("queues check-ins offline and sends them on the next refresh", async () => {
    const t = setup((u) => (u.pathname === "/api/today" ? json(todayData()) : json({ ok: true })));
    await t.app.start();
    t.offline(true);
    t.app.nav.cursor = 1;
    await t.app.input("tap"); // open the workout
    await t.app.input("tap"); // start the timed warm-up
    await t.app.input("tap"); // finish it
    expect(JSON.parse(t.store.data[K.queue])).toHaveLength(2);
    expect(t.app.world().day!.workouts[0].exercises[0].status).toBe("done"); // applied at once
    expect(t.lines().at(-2)).toMatch(/^Offline: 2 to send/);
    t.offline(false);
    await t.app.refresh();
    expect(t.posts.map((p) => (p.body as { ref: string }).ref)).toEqual(["full-body-a/bike/1", "full-body-a/bike"]);
    expect(JSON.parse(t.store.data[K.queue])).toEqual([]);
  });
  it("starts offline from the cached day", async () => {
    const store = memory({ [K.token]: "fld_x", [K.today]: JSON.stringify(todayData()) });
    const t = setup(() => json({}), store);
    t.offline(true);
    await t.app.start();
    expect(t.lines()[0]).toMatch(/^FULL BODY A/);
  });
  it("sends feedback from the workout menu", async () => {
    const t = setup((u) => (u.pathname === "/api/today" ? json(todayData()) : json({ ok: true })));
    await t.app.start();
    t.app.nav.cursor = 1;
    await t.app.input("tap");
    await t.app.input("long_press"); // the workout menu
    t.app.nav.menuIndex = 3; // How-to, Skip, Too hard, Too easy, It hurts…
    await t.app.input("tap");
    expect(t.posts.at(-1)).toEqual({ path: "/api/feedback", body: { date: DATE, ref: "full-body-a/bike", tags: ["too_easy"] } });
    expect(t.lines().at(-1)).toBe(">> SENT TO YOUR AGENT");
  });
  it("forgets a revoked token", async () => {
    const t = setup(() => json({ error: "x" }, 401));
    await t.app.start();
    expect(t.store.data[K.token]).toBe("");
    expect(t.app.paired).toBe(false);
  });
});
