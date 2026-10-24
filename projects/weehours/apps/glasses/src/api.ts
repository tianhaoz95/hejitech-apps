// The glasses' client for the Wee Hours Worker (services/web/src/worker/glasses.ts) with an offline
// outbox. The glasses hold one device token from pairing, never a Supabase session: gestures are
// sent as typed events, and voice is uploaded as a capture for a household phone to process.
import type { LogEvent } from "@weehours/core";

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface Child {
  id: string;
  name: string;
  default_feed: "bottle" | "breast" | null;
  /** Not born yet: the glasses don't log for them (only movements, which the phone records). */
  expected: boolean;
}

export interface State {
  me: { id: string; name: string | null };
  household: { id: string; name: string; default_feed: "bottle" | "breast" };
  children: Child[];
  events: LogEvent[];
  pending_captures: number;
}

/** The token was revoked (or the person left the household): the glasses must be paired again. */
export class Unpaired extends Error {}

type Pending =
  | { kind: "event"; row: LogEvent }
  | { kind: "capture"; row: { id: string; household_id: string; surface: string; captured_at: string; attach_to: string | null; baby_id?: string }; audio: string /* base64 wav */ };

const TOKEN = "device_token";
const OUTBOX = "outbox";
const BATCH = 100;

export class Api {
  token: string | null = null;
  state: State | null = null;

  constructor(public base: string, private kv: KV, private fetchImpl: typeof fetch = fetch.bind(globalThis)) {
    this.base = base.replace(/\/$/, "");
  }

  get paired() {
    return this.token !== null;
  }

  async restore() {
    this.token = (await this.kv.get(TOKEN)) || null;
  }

  /** Trades the 6-digit code from the phone for this device's token. */
  async pair(code: string, label = "Even G2"): Promise<{ name: string }> {
    const res = await this.fetchImpl(`${this.base}/api/glasses/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.replace(/\D/g, ""), label }),
    });
    const j = (await res.json().catch(() => ({}))) as { token?: string; household?: { name: string }; error?: string };
    if (!res.ok || !j.token) throw new Error(j.error ?? `pairing failed (${res.status})`);
    this.token = j.token;
    this.state = null;
    await this.kv.set(TOKEN, j.token);
    return { name: j.household?.name ?? "" };
  }

  /** Forgets the token and anything still queued (the phone's token list keeps the revoke). */
  async forget() {
    this.token = null;
    this.state = null;
    await this.kv.set(TOKEN, "");
    await this.saveOutbox([]);
  }

  private async request(method: string, path: string, body?: BodyInit, contentType = "application/json") {
    if (!this.token) throw new Unpaired("not paired");
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": contentType },
      body,
    });
    if (res.status === 401) {
      this.token = null;
      this.state = null;
      await this.kv.set(TOKEN, "");
      throw new Unpaired((await res.json().catch(() => ({ error: "" }))).error || "not paired");
    }
    if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} → ${res.status} ${await res.text()}`);
    return res;
  }

  async loadState(): Promise<State> {
    const res = await this.request("GET", "/api/glasses/state");
    this.state = (await res.json()) as State;
    return this.state;
  }

  /** The children gestures can log for: active and born. */
  get loggable(): Child[] {
    return (this.state?.children ?? []).filter((c) => !c.expected);
  }

  newEvent(type: string, fields: Record<string, string | number>, surface: "glasses" | "ring", baby: string, supersedes?: string): LogEvent {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(), household_id: this.state!.household.id, baby_id: baby, type, fields,
      occurred_at: now, logged_at: now, logged_by: this.state!.me.id,
      provenance: { surface, input: "gesture" }, supersedes: supersedes ?? null,
    };
  }

  // ---- outbox: everything is queued first, so a lost connection never loses an entry

  private async outbox(): Promise<Pending[]> {
    try {
      return JSON.parse((await this.kv.get(OUTBOX)) || "[]");
    } catch {
      return [];
    }
  }

  private async saveOutbox(items: Pending[]) {
    await this.kv.set(OUTBOX, JSON.stringify(items));
  }

  async enqueueEvent(row: LogEvent) {
    await this.saveOutbox([...(await this.outbox()), { kind: "event", row }]);
  }

  /** `baby`: the focused child (several children only); a name in the speech wins on the phone. */
  async enqueueCapture(wavBytes: Uint8Array, attachTo: string | null, surface: "glasses" | "ring", baby?: string | null) {
    const id = crypto.randomUUID();
    const row: Extract<Pending, { kind: "capture" }>["row"] = {
      id, household_id: this.state!.household.id, surface, captured_at: new Date().toISOString(), attach_to: attachTo,
    };
    if (baby && this.state!.children.length > 1) row.baby_id = baby;
    let bin = "";
    for (let i = 0; i < wavBytes.length; i += 0x8000) bin += String.fromCharCode(...wavBytes.subarray(i, i + 0x8000));
    await this.saveOutbox([...(await this.outbox()), { kind: "capture", row, audio: btoa(bin) }]);
    return id;
  }

  /**
   * Sends what it can and keeps the rest. Events the server refuses (a malformed or stale entry)
   * are dropped, not retried forever; entries queued for another household (before re-pairing)
   * too. Returns the number still queued.
   */
  async flush(): Promise<number> {
    const household = this.state?.household.id;
    const items = (await this.outbox()).filter((p) => p.row.household_id === household);
    const left: Pending[] = [];
    const events = items.filter((p): p is Extract<Pending, { kind: "event" }> => p.kind === "event");
    for (let i = 0; i < events.length; i += BATCH) {
      const batch = events.slice(i, i + BATCH);
      try {
        const res = await this.request("POST", "/api/glasses/events", JSON.stringify({ events: batch.map((p) => p.row) }));
        const j = (await res.json()) as { rejected: { id: string; error: string }[] };
        for (const r of j.rejected) console.warn(`[outbox] dropped ${r.id}: ${r.error}`);
      } catch (e) {
        if (e instanceof Unpaired) throw e;
        console.warn("[outbox] kept for retry:", (e as Error).message);
        left.push(...batch);
      }
    }
    for (const item of items) {
      if (item.kind !== "capture") continue;
      const r = item.row;
      const q = new URLSearchParams({ id: r.id, surface: r.surface, captured_at: r.captured_at });
      if (r.attach_to) q.set("attach_to", r.attach_to);
      if (r.baby_id) q.set("baby_id", r.baby_id);
      try {
        const bytes = Uint8Array.from(atob(item.audio), (c) => c.charCodeAt(0));
        await this.request("POST", `/api/glasses/captures?${q}`, bytes, "audio/wav");
      } catch (e) {
        if (e instanceof Unpaired) throw e;
        console.warn("[outbox] kept for retry:", (e as Error).message);
        left.push(item);
      }
    }
    await this.saveOutbox(left);
    return left.length;
  }

  /** Queued events, shown on the HUD before they reach the server. */
  async queued(): Promise<LogEvent[]> {
    return (await this.outbox()).filter((p): p is Extract<Pending, { kind: "event" }> => p.kind === "event").map((p) => p.row);
  }
}
