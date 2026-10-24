import { describe, expect, it } from "vitest";
import { Api, Unpaired, type KV, type State } from "../src/api.ts";

const memory = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, async get(k) { return data.get(k) ?? null; }, async set(k, v) { data.set(k, v); } };
};

const STATE: State = {
  me: { id: "u1", name: "Alex" },
  household: { id: "h1", name: "Home", default_feed: "bottle" },
  children: [{ id: "b1", name: "Mia", default_feed: null, expected: false }, { id: "b2", name: "Leo", default_feed: null, expected: true }],
  events: [],
  pending_captures: 0,
};

/** A fake Worker: records requests, answers from `routes`. */
function worker(routes: Record<string, (req: { url: string; init: RequestInit }) => Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const route = routes[`${init.method ?? "GET"} ${path}`];
    return route ? route({ url, init }) : new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("pairing", () => {
  it("trades the code for a token and keeps it", async () => {
    const kv = memory();
    const w = worker({ "POST /api/glasses/pair": () => ok({ token: "wh_abc", household: { name: "Home" } }) });
    const api = new Api("https://x.test/", kv, w.impl);
    expect(await api.pair("123 456")).toEqual({ name: "Home" });
    expect(JSON.parse(String(w.calls[0].init.body))).toEqual({ code: "123456", label: "Even G2" });
    expect(kv.data.get("device_token")).toBe("wh_abc");
    const again = new Api("https://x.test", kv, w.impl);
    await again.restore();
    expect(again.paired).toBe(true);
  });

  it("shows the server's reason for a wrong code", async () => {
    const w = worker({ "POST /api/glasses/pair": () => new Response(JSON.stringify({ error: "That code didn't work." }), { status: 400 }) });
    await expect(new Api("https://x.test", memory(), w.impl).pair("000000")).rejects.toThrow("That code didn't work.");
  });

  it("a revoked token unpairs the glasses", async () => {
    const kv = memory();
    kv.data.set("device_token", "wh_old");
    const w = worker({ "GET /api/glasses/state": () => new Response(JSON.stringify({ error: "pair again" }), { status: 401 }) });
    const api = new Api("https://x.test", kv, w.impl);
    await api.restore();
    await expect(api.loadState()).rejects.toBeInstanceOf(Unpaired);
    expect(api.paired).toBe(false);
    expect(kv.data.get("device_token")).toBe("");
  });
});

describe("outbox", () => {
  async function paired(routes: Parameters<typeof worker>[0]) {
    const kv = memory();
    kv.data.set("device_token", "wh_t");
    const w = worker({ "GET /api/glasses/state": () => ok(STATE), ...routes });
    const api = new Api("https://x.test", kv, w.impl);
    await api.restore();
    await api.loadState();
    return { api, kv, w };
  }

  it("only born children are loggable", async () => {
    const { api } = await paired({});
    expect(api.loggable.map((c) => c.id)).toEqual(["b1"]);
  });

  it("sends events in one batch with the device token, then captures as WAV", async () => {
    const { api, w } = await paired({
      "POST /api/glasses/events": () => ok({ accepted: [], rejected: [] }),
      "POST /api/glasses/captures": () => ok({ ok: true }),
    });
    const e1 = api.newEvent("feed.bottle.start", {}, "ring", "b1");
    const e2 = api.newEvent("diaper", { kind: "wet" }, "glasses", "b1");
    await api.enqueueEvent(e1);
    await api.enqueueEvent(e2);
    const cap = await api.enqueueCapture(new Uint8Array([1, 2, 3, 4]), e1.id, "ring", "b1");
    expect(await api.flush()).toBe(0);

    const ev = w.calls.find((c) => c.url.endsWith("/api/glasses/events"))!;
    expect((ev.init.headers as Record<string, string>).Authorization).toBe("Bearer wh_t");
    expect(JSON.parse(String(ev.init.body)).events.map((e: { id: string }) => e.id)).toEqual([e1.id, e2.id]);
    const up = w.calls.find((c) => c.url.includes("/api/glasses/captures"))!;
    const q = new URL(up.url).searchParams;
    expect(q.get("id")).toBe(cap);
    expect(q.get("attach_to")).toBe(e1.id);
    expect(q.get("baby_id")).toBe("b1"); // several children: the focused one travels with the capture
    expect([...(up.init.body as Uint8Array)]).toEqual([1, 2, 3, 4]);
    expect(await api.queued()).toEqual([]);
  });

  it("keeps everything when offline and sends it later", async () => {
    let online = false;
    const { api } = await paired({
      "POST /api/glasses/events": () => (online ? ok({ accepted: [], rejected: [] }) : new Response("down", { status: 503 })),
    });
    await api.enqueueEvent(api.newEvent("sleep.start", {}, "ring", "b1"));
    expect(await api.flush()).toBe(1);
    expect((await api.queued()).length).toBe(1);
    online = true;
    expect(await api.flush()).toBe(0);
  });

  it("drops entries queued for another household after re-pairing", async () => {
    const { api, kv } = await paired({ "POST /api/glasses/events": () => ok({ accepted: [], rejected: [] }) });
    const stale = { ...api.newEvent("diaper", { kind: "dry" }, "ring", "b1"), household_id: "other" };
    kv.data.set("outbox", JSON.stringify([{ kind: "event", row: stale }]));
    expect(await api.flush()).toBe(0);
    expect(await api.queued()).toEqual([]);
  });

  it("forget clears the token and the queue", async () => {
    const { api, kv } = await paired({});
    await api.enqueueEvent(api.newEvent("sleep.end", {}, "ring", "b1"));
    await api.forget();
    expect(api.paired).toBe(false);
    expect(kv.data.get("outbox")).toBe("[]");
  });
});
