// The plugin's logic without the Even SDK: where boards come from (the user's commute when paired,
// a pair picked on the glasses, the bundled timetable when offline), tracking, and what to show.
// main.ts wires it to the bridge (glasses + R1) and the phone page; tests drive it with fakes.
import { board as scheduleBoard, Navigator, progress, type Board, type Command, type Input, type Tracked, type TrainProgress, type World } from "@headway/core";

export interface Store {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
}

export const K = { token: "headway:device_token", pair: "headway:pair", last: "headway:last_pair", tracked: "headway:tracked" } as const;

type Pair = { from: string; to: string };
/** What the glasses show before anything is chosen: the length of the line, live. */
export const DEFAULT_PAIR: Pair = { from: "san_francisco", to: "sj_diridon" };
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface AppOptions {
  api: string;
  store: Store;
  fetch?: Fetch;
  now?: () => number;
  /** Called whenever the glasses' text changes. */
  onLines: (lines: string[]) => void;
  /** Called when pairing state or the source of the board changes (the phone page). */
  onStatus?: (s: AppStatus) => void;
  /** The user asked to leave (double tap on the board, or Exit in the menu): the system dialog. */
  onExit?: () => void;
  /** The phone's location, for a rough trip estimate to the station (null: unknown or not allowed). */
  locate?: () => Promise<{ lat: number; lon: number } | null>;
}

/** How long a location is reused before asking the phone again. */
const LOCATION_TTL_MS = 2 * 60_000;

export interface AppStatus {
  paired: boolean;
  source: "live" | "timetable" | "offline" | "none";
  board: Board | null;
  custom: boolean;
  message?: string;
}

const parse = <T>(s: string | null): T | null => {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
};

export class HeadwayApp {
  readonly nav = new Navigator();
  board: Board | null = null;
  hasCommute = false;
  tracked: Tracked | null = null;
  progress: TrainProgress | null = null;
  paired = false;
  note: string | undefined;
  private pair: Pair | null = null;
  private readonly fetch: Fetch;
  private readonly now: () => number;
  private located: { at: number; where: { lat: number; lon: number } | null } | null = null;

  constructor(private readonly opts: AppOptions) {
    this.fetch = opts.fetch ?? ((u, i) => fetch(u, i));
    this.now = opts.now ?? Date.now;
  }

  private async publicBoard(pair: Pair): Promise<Board> {
    const res = await this.get(`/api/board?from=${pair.from}&to=${pair.to}`, null);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Board;
  }

  world(): World {
    return { board: this.board, progress: this.progress, hasCommute: this.hasCommute, custom: Boolean(this.pair), now: this.now(), note: this.note };
  }

  render() {
    this.opts.onLines(this.nav.lines(this.world()));
  }

  private status(message?: string) {
    const source = !this.board ? "none" : this.note ? "offline" : this.board.live ? "live" : "timetable";
    this.opts.onStatus?.({ paired: this.paired, source, board: this.board, custom: Boolean(this.pair), message });
  }

  /** `&lat=…&lon=…` for the commute board, from a location at most two minutes old ("" without one). */
  private async locationQuery(): Promise<string> {
    if (!this.opts.locate) return "";
    if (!this.located || this.now() - this.located.at > LOCATION_TTL_MS) {
      const where = await this.opts.locate().catch(() => null);
      this.located = { at: this.now(), where };
    }
    const w = this.located.where;
    return w ? `lat=${w.lat.toFixed(4)}&lon=${w.lon.toFixed(4)}` : "";
  }

  private async token() {
    return (await this.opts.store.get(K.token)) || null;
  }

  private async get(path: string, token: string | null) {
    return this.fetch(`${this.opts.api}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  }

  async start() {
    this.pair = parse<Pair>(await this.opts.store.get(K.pair));
    this.tracked = parse<Tracked>(await this.opts.store.get(K.tracked));
    // Something to show at once (and offline): the last pair, from the bundled timetable.
    await this.loadLastPair();
    this.render();
    await this.refresh();
  }

  /** Fetches the board (and the tracked train); offline, builds it from the bundled timetable. */
  async refresh(): Promise<void> {
    const token = await this.token();
    this.paired = Boolean(token);
    try {
      if (token) {
        const params = [this.pair ? `from=${this.pair.from}&to=${this.pair.to}` : "", await this.locationQuery()].filter(Boolean).join("&");
        const q = params ? `?${params}` : "";
        const res = await this.get(`/api/me/board${q}`, token);
        if (res.status === 401) {
          await this.opts.store.set(K.token, "");
          this.paired = false;
          this.status("These glasses were unpaired. Pair again with a new code.");
          return this.refresh();
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { board: Board | null; has_commute: boolean; tracked: (Tracked & { progress: TrainProgress }) | null };
        this.board = body.board;
        this.hasCommute = body.has_commute;
        // No commute saved yet: a live default board, never an empty screen.
        if (!this.board) this.board = await this.publicBoard(DEFAULT_PAIR);
        // The phone (or an assistant) may have started or stopped tracking.
        this.tracked = body.tracked ? { trip_id: body.tracked.trip_id, service_date: body.tracked.service_date, from: body.tracked.from, to: body.tracked.to } : null;
        this.progress = body.tracked?.progress ?? null;
        await this.opts.store.set(K.tracked, JSON.stringify(this.tracked));
      } else {
        this.hasCommute = false;
        // Unpaired (a reviewer, a first launch): a live board for any pair, the default one first.
        this.board = await this.publicBoard(this.pair ?? DEFAULT_PAIR);
        await this.refreshProgress(null);
      }
      this.note = !token ? "Pair in the Headway app for your commute" : !this.hasCommute && !this.pair ? "Set your commute in the Headway app" : undefined;
      if (this.board) await this.opts.store.set(K.last, JSON.stringify({ from: this.board.from.id, to: this.board.to.id }));
    } catch {
      this.offline();
    }
    if (this.progress?.arrived) await this.setTracked(null);
    this.nav.boardChanged(this.world());
    this.render();
    this.status();
  }

  private async refreshProgress(token: string | null) {
    if (!this.tracked) { this.progress = null; return; }
    const t = this.tracked;
    const res = await this.get(`/api/train?trip=${t.trip_id}&date=${t.service_date}&from=${t.from}&to=${t.to}`, token);
    this.progress = res.ok ? ((await res.json()) as TrainProgress) : null;
  }

  /** No network: the timetable bundled with the plugin, for the pair last shown. */
  private offline() {
    const now = this.now();
    const pair = this.pair ?? (this.board ? { from: this.board.from.id, to: this.board.to.id } : DEFAULT_PAIR);
    if (pair) this.board = scheduleBoard(pair.from, pair.to, now, null, this.pair ? "custom" : this.board?.leg ?? "custom");
    if (this.tracked) this.progress = progress(this.tracked, now, null);
    this.note = "Offline: timetable times";
  }

  async loadLastPair() {
    if (this.board || this.pair) return;
    const last = parse<Pair>(await this.opts.store.get(K.last));
    if (last) this.board = scheduleBoard(last.from, last.to, this.now(), null);
  }

  private async setTracked(t: Tracked | null) {
    this.tracked = t;
    if (!t) this.progress = null;
    await this.opts.store.set(K.tracked, JSON.stringify(t));
  }

  async input(i: Input) {
    const cmds = this.nav.input(i, this.world());
    this.render();
    await this.run(cmds);
  }

  async run(cmds: Command[]) {
    for (const c of cmds) {
      if (c.kind === "show_pair") {
        // null = back to the commute (which follows the time of day); a pair stays until changed.
        this.pair = c.pair;
        await this.opts.store.set(K.pair, JSON.stringify(c.pair));
        if (c.pair && this.board) this.board = scheduleBoard(c.pair.from, c.pair.to, this.now(), null, "custom") ?? this.board;
        this.render();
        await this.refresh();
      } else if (c.kind === "track") {
        const t: Tracked = { trip_id: c.train.trip_id, service_date: c.train.service_date, from: c.from, to: c.to };
        await this.setTracked(t);
        this.progress = progress(t, this.now(), null);
        this.render();
        const token = await this.token();
        if (token) {
          await this.fetch(`${this.opts.api}/api/track`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(t) }).catch(() => null);
        }
        await this.refresh();
      } else if (c.kind === "untrack") {
        await this.setTracked(null);
        const token = await this.token();
        if (token) await this.fetch(`${this.opts.api}/api/track`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
        this.render();
      } else if (c.kind === "refresh") {
        await this.refresh();
      } else if (c.kind === "exit") {
        this.opts.onExit?.();
      }
    }
  }

  /** Trades a 6-digit code for a glasses token. Returns a problem to show, or null. */
  async pairWith(code: string, label: string): Promise<string | null> {
    const res = await this.fetch(`${this.opts.api}/api/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.replace(/\D/g, ""), label }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { device_token?: string; error?: string };
    if (!res?.ok || !body.device_token) return body.error ?? "Couldn't reach Headway. Check the connection.";
    await this.opts.store.set(K.token, body.device_token);
    // A fresh pairing shows the commute.
    this.pair = null;
    await this.opts.store.set(K.pair, "null");
    await this.refresh();
    return null;
  }

  async unpair() {
    await this.opts.store.set(K.token, "");
    await this.refresh();
  }

  async useCommute() {
    await this.run([{ kind: "show_pair", pair: null }]);
  }
}
