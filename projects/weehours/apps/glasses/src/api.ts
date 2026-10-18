// Minimal Supabase client (Auth + PostgREST + Storage over fetch) with an offline outbox.
// Glasses write typed events directly; voice is uploaded as a capture for a household phone.
import type { LogEvent } from "@weehours/core";

/** Wee Hours' Postgres schema in the shared Supabase project (PostgREST picks it from these headers). */
const PROFILE = { "Accept-Profile": "weehours", "Content-Profile": "weehours" };
/** Its Storage bucket, named after the project. */
const BUCKET = "weehours";

export interface Config {
  url: string;
  anonKey: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at: number;
}

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

type Pending =
  | { kind: "event"; row: LogEvent }
  | { kind: "capture"; row: Record<string, unknown>; audio: string /* base64 wav */ };

export class Api {
  session: Session | null = null;
  household: { id: string; baby_id: string; children: { id: string; name: string; default_feed?: string }[]; settings: Record<string, unknown> } | null = null;

  constructor(public config: Config, private kv: KV, private fetchImpl: typeof fetch = fetch.bind(globalThis)) {}

  async restore() {
    const s = await this.kv.get("session");
    if (s) this.session = JSON.parse(s);
  }

  private async auth(path: string, body: unknown) {
    const res = await this.fetchImpl(`${this.config.url}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: this.config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
    const j = await res.json();
    this.session = { access_token: j.access_token, refresh_token: j.refresh_token, user_id: j.user.id, expires_at: Date.now() + j.expires_in * 1000 };
    await this.kv.set("session", JSON.stringify(this.session));
  }

  signIn(email: string, password: string) {
    return this.auth("token?grant_type=password", { email, password });
  }

  async request(method: string, path: string, body?: BodyInit, headers: Record<string, string> = {}) {
    if (!this.session) throw new Error("not signed in");
    if (this.session.expires_at - Date.now() < 60_000) await this.auth("token?grant_type=refresh_token", { refresh_token: this.session.refresh_token });
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      method,
      headers: { apikey: this.config.anonKey, Authorization: `Bearer ${this.session.access_token}`, "Content-Type": "application/json", ...(path.startsWith("/rest/") ? PROFILE : {}), ...headers },
      body,
    });
    if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} → ${res.status} ${await res.text()}`);
    return res;
  }

  async loadHousehold() {
    const res = await this.request("POST", "/rest/v1/rpc/my_household", "{}");
    const h = await res.json();
    if (!h) throw new Error("no household: create one in the phone app first");
    const active = ((h.babies ?? []) as { id: string; name: string; archived?: boolean; default_feed?: string }[]).filter((b) => !b.archived);
    this.household = { id: h.id, baby_id: h.baby_id, children: active.length ? active : [{ id: h.baby_id, name: h.baby_name }], settings: h };
    return this.household;
  }

  /** Events from the last few days: enough to derive open sessions and the status line. */
  async recentEvents(days = 3): Promise<LogEvent[]> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const res = await this.request("GET", `/rest/v1/events?household_id=eq.${this.household!.id}&or=(occurred_at.gte.${since},logged_at.gte.${since})&order=seq.asc&limit=2000`);
    return res.json();
  }

  async pendingCaptures(): Promise<number> {
    const res = await this.request("GET", `/rest/v1/captures?household_id=eq.${this.household!.id}&status=eq.pending&select=id`);
    return (await res.json()).length;
  }

  newEvent(type: string, fields: Record<string, string | number>, surface: "glasses" | "ring", baby?: string | null, supersedes?: string): LogEvent {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(), household_id: this.household!.id, baby_id: baby ?? this.household!.baby_id, type, fields,
      occurred_at: now, logged_at: now, logged_by: this.session!.user_id,
      provenance: { surface, input: "gesture" }, supersedes: supersedes ?? null,
    };
  }

  // ---- outbox: everything is queued first, so a lost connection never loses an entry

  private async outbox(): Promise<Pending[]> {
    return JSON.parse((await this.kv.get("outbox")) ?? "[]");
  }

  private async saveOutbox(items: Pending[]) {
    await this.kv.set("outbox", JSON.stringify(items));
  }

  async enqueueEvent(row: LogEvent) {
    await this.saveOutbox([...(await this.outbox()), { kind: "event", row }]);
  }

  /** `baby`: the focused child (several children only); a name in the speech wins on the phone. */
  async enqueueCapture(wavBytes: Uint8Array, attachTo: string | null, surface: "glasses" | "ring", baby?: string | null) {
    const id = crypto.randomUUID();
    const row: Record<string, unknown> = {
      id, household_id: this.household!.id, surface, captured_at: new Date().toISOString(), logged_by: this.session!.user_id,
      audio_path: `${this.household!.id}/${id}.wav`, attach_to: attachTo, status: "pending",
    };
    if (baby && this.household!.children.length > 1) row.baby_id = baby;
    let bin = "";
    for (let i = 0; i < wavBytes.length; i += 0x8000) bin += String.fromCharCode(...wavBytes.subarray(i, i + 0x8000));
    await this.saveOutbox([...(await this.outbox()), { kind: "capture", row, audio: btoa(bin) }]);
    return id;
  }

  /** Sends what it can, keeps the rest. Returns the number still queued. */
  async flush(): Promise<number> {
    const items = await this.outbox();
    const left: Pending[] = [];
    for (const item of items) {
      try {
        if (item.kind === "event") {
          await this.request("POST", "/rest/v1/events?on_conflict=id", JSON.stringify(item.row), { Prefer: "resolution=ignore-duplicates,return=minimal" });
        } else {
          const bytes = Uint8Array.from(atob(item.audio), (c) => c.charCodeAt(0));
          await this.request("POST", `/storage/v1/object/${BUCKET}/${item.row.audio_path}`, bytes, { "Content-Type": "audio/wav", "x-upsert": "true" });
          await this.request("POST", "/rest/v1/captures?on_conflict=id", JSON.stringify(item.row), { Prefer: "resolution=ignore-duplicates,return=minimal" });
        }
      } catch (e) {
        console.warn("[outbox] kept for retry:", (e as Error).message);
        left.push(item);
      }
    }
    await this.saveOutbox(left);
    return left.length;
  }

  async queued(): Promise<LogEvent[]> {
    return (await this.outbox()).filter((p): p is { kind: "event"; row: LogEvent } => p.kind === "event").map((p) => p.row);
  }
}
