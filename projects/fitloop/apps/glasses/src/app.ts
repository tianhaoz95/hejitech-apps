// The plugin's logic without the Even SDK: today's plan from the Worker (cached for offline), check-ins
// and feedback applied at once and queued until they reach the Worker (gyms have bad signal), live
// heart rate during a workout, timers, pairing. main.ts wires it to the bridge and the phone page;
// tests drive it with fakes.
import { dayStateOf, Navigator, WEEKDAYS, type Checkin, type Command, type DayPlan, type Input, type Macros, type Plan, type World } from "@fitloop/core";
import example from "@fitloop/core/fixtures/example-plan.json";

export interface Store {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
}

export const K = { token: "fitloop:device_token", today: "fitloop:today", queue: "fitloop:queue", demo: "fitloop:demo_checkins" } as const;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** The Worker's /api/today, as cached. */
export interface TodayData {
  date: string;
  plan: { version: number; title: string; targets: Macros | null } | null;
  state: { day: DayPlan | null };
  checkins: Checkin[];
  live: { hr: number | null } | null;
  glasses: { show_hr: boolean; auto_rest_timer: boolean };
}

type Queued = { path: "/api/checkins" | "/api/feedback"; body: unknown };

export interface AppStatus {
  paired: boolean;
  online: boolean;
  queued: number;
  planTitle: string | null;
  message?: string;
}

export interface AppOptions {
  api: string;
  store: Store;
  fetch?: Fetch;
  now?: () => number;
  /** The user's local date (YYYY-MM-DD). */
  today?: () => string;
  onLines: (lines: string[]) => void;
  onStatus?: (s: AppStatus) => void;
  /** The user asked to leave (double tap on Today, or Exit in the menu): the system dialog. */
  onExit?: () => void;
}

/**
 * The built-in demo (not paired): the example plan's day for today's weekday (Monday's on a rest
 * day, so there's a workout to try). Check-ins stay on the glasses; nothing is sent.
 */
export function demoDay(date: string, checkins: Checkin[]): TodayData {
  const plan = example as unknown as Plan;
  const weekday = WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
  const day = plan.week[weekday].workouts.length ? plan.week[weekday] : plan.week.mon;
  return {
    date, plan: { version: 0, title: plan.title, targets: plan.targets ?? null }, state: { day }, checkins,
    live: null, glasses: { show_hr: true, auto_rest_timer: true },
  };
}

const parse = <T>(s: string | null): T | null => {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
};
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export class FitLoopApp {
  readonly nav = new Navigator();
  data: TodayData | null = null;
  hr: number | null = null;
  paired = false;
  online = true;
  workoutActive = false;
  private queue: Queued[] = [];
  private readonly fetch: Fetch;
  private readonly now: () => number;
  private readonly today: () => string;

  constructor(private readonly opts: AppOptions) {
    this.fetch = opts.fetch ?? ((u, i) => fetch(u, i));
    this.now = opts.now ?? Date.now;
    this.today = opts.today ?? (() => localDate());
  }

  world(): World {
    const d = this.data;
    return {
      date: d?.date ?? this.today(),
      now: this.now(),
      day: d?.plan ? dayStateOf(d.state.day, d.date, d.checkins, d.plan.targets ?? {}) : null,
      planVersion: d?.plan?.version ?? null,
      hr: this.hr,
      showHr: d?.glasses.show_hr ?? true,
      autoRest: d?.glasses.auto_rest_timer ?? true,
      note: !this.paired ? undefined : !this.online ? `Offline${this.queue.length ? `: ${this.queue.length} to send` : ""}` : undefined,
      demo: !this.paired,
    };
  }

  render() {
    this.opts.onLines(this.nav.lines(this.world()));
  }

  private status(message?: string) {
    this.opts.onStatus?.({ paired: this.paired, online: this.online, queued: this.queue.length, planTitle: this.data?.plan?.title ?? null, message });
  }

  private async token() {
    return (await this.opts.store.get(K.token)) || null;
  }

  async start() {
    this.queue = parse<Queued[]>(await this.opts.store.get(K.queue)) ?? [];
    const cached = parse<TodayData>(await this.opts.store.get(K.today));
    if (cached && cached.date === this.today()) this.data = cached;
    this.render();
    await this.refresh();
  }

  /** Sends what's queued, then fetches today. Offline: keeps the cached day and the queue. */
  async refresh(): Promise<void> {
    const token = await this.token();
    this.paired = Boolean(token);
    if (!token) {
      // A first launch or a reviewer: a working demo day, never a dead end.
      this.data = demoDay(this.today(), parse<Checkin[]>(await this.opts.store.get(K.demo)) ?? []);
      this.render();
      this.status();
      return;
    }
    try {
      await this.flush(token);
      const res = await this.fetch(`${this.opts.api}/api/today?date=${this.today()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        await this.opts.store.set(K.token, "");
        this.paired = false;
        this.data = null;
        this.render();
        this.status("These glasses were unpaired. Pair again with a new code.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.data = (await res.json()) as TodayData;
      // Keep what's still queued visible on top of the server's day.
      for (const q of this.queue) if (q.path === "/api/checkins") this.data.checkins.push(q.body as Checkin);
      this.hr = this.data.live?.hr ?? null;
      await this.opts.store.set(K.today, JSON.stringify(this.data));
      this.online = true;
    } catch {
      this.online = false;
    }
    this.render();
    this.status();
  }

  private async flush(token: string) {
    while (this.queue.length) {
      const q = this.queue[0];
      const res = await this.fetch(`${this.opts.api}${q.path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(q.body) });
      // 4xx: the server refused this one (e.g. the plan changed); drop it rather than retry forever.
      if (!res.ok && res.status < 400) throw new Error(`HTTP ${res.status}`);
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      this.queue.shift();
      await this.opts.store.set(K.queue, JSON.stringify(this.queue));
    }
  }

  private async send(q: Queued) {
    this.queue.push(q);
    await this.opts.store.set(K.queue, JSON.stringify(this.queue));
    const token = await this.token();
    if (!token) return;
    try {
      await this.flush(token);
      this.online = true;
    } catch {
      this.online = false;
    }
    this.status();
  }

  /** Live heart rate while a workout is open (the iPhone relays the Watch's). */
  async pollLive() {
    const token = await this.token();
    if (!token || !this.workoutActive || !(this.data?.glasses.show_hr ?? true)) return;
    try {
      const res = await this.fetch(`${this.opts.api}/api/live`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) this.hr = ((await res.json()) as { hr: number | null } | null)?.hr ?? null;
    } catch { /* keep the last value */ }
  }

  async input(i: Input) {
    const cmds = this.nav.input(i, this.world());
    // The glasses answer at once; the network catches up (or queues).
    this.render();
    await this.run(cmds);
    this.render();
  }

  async run(cmds: Command[]) {
    for (const c of cmds) {
      if (c.kind === "checkin") {
        const checkin: Checkin = { ...c.checkin, plan_version: this.data?.plan?.version ?? 0, at: new Date(this.now()).toISOString() };
        this.data?.checkins.push(checkin);
        this.render();
        if (!this.paired) await this.opts.store.set(K.demo, JSON.stringify(this.data?.checkins ?? []));
        else await this.send({ path: "/api/checkins", body: checkin });
      } else if (c.kind === "feedback") {
        if (this.paired) await this.send({ path: "/api/feedback", body: { date: c.date, ref: c.ref, tags: c.tags } });
      } else if (c.kind === "exit") {
        this.opts.onExit?.();
      } else if (c.kind === "workout") {
        this.workoutActive = c.active;
        if (!c.active) this.hr = null;
      } else if (c.kind === "refresh") {
        await this.refresh();
      }
    }
    if (this.data && this.paired) await this.opts.store.set(K.today, JSON.stringify(this.data));
  }

  /** Trades a 6-digit code for a glasses token. Returns a problem to show, or null. */
  currentExercise() {
    return this.nav.currentExercise(this.world());
  }

  async pairWith(code: string, label: string): Promise<string | null> {
    const res = await this.fetch(`${this.opts.api}/api/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.replace(/\D/g, ""), label }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { device_token?: string; error?: string };
    if (!res?.ok || !body.device_token) return body.error ?? "Couldn't reach FitLoop. Check the connection.";
    await this.opts.store.set(K.token, body.device_token);
    await this.refresh();
    return null;
  }

  async unpair() {
    await this.opts.store.set(K.token, "");
    await this.opts.store.set(K.today, "");
    await this.refresh();
  }
}
