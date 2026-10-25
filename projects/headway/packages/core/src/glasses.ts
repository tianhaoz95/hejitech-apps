// The Even G2 screens and the R1 ring's gesture state machine. Pure: inputs plus the current world
// (board, tracked train) in, commands and the screen's lines out. The plugin pushes the lines to
// the glasses; the web preview and the tests drive the same class.
//
//   board    swipe up/down   move the cursor through the next trains
//            tap             flip direction (SF ⇄ your station)
//            long press      track the train under the cursor (arrival alert on the phone)
//            double tap      menu
//   menu     swipe moves, tap picks, double tap back to the board
//   pick     choose From, then To (swipe, tap); double tap back
//   track    tap refreshes, long press stops tracking, double tap back to the board
//   alerts   swipe pages, tap or double tap back
import { STATIONS, stationIndex } from "./schedule.ts";
import { clock, clockAmPm, minutesUntil } from "./time.ts";
import type { Board, BoardTrain, TrainProgress } from "./types.ts";

export const DISPLAY = { width: 576, height: 288 } as const;
export const LINE_WIDTH = 30;
export const MAX_LINES = 6;
/** Trains visible on the board at once (the rest scroll). */
export const VISIBLE_TRAINS = 4;
export const FLASH_MS = 2500;

export type Input = "up" | "down" | "tap" | "double_tap" | "long_press";
export type Screen = "board" | "menu" | "pick" | "track" | "alerts";

export interface World {
  board: Board | null;
  progress: TrainProgress | null;
  /** A morning or evening leg is set (the "Commute" menu item and the empty state depend on it). */
  hasCommute: boolean;
  /** Showing a pair picked on the glasses instead of the commute. */
  custom: boolean;
  now: number;
  /** One line about where the data came from when it isn't fresh ("offline · 8:01"). */
  note?: string;
}

export type Command =
  | { kind: "show_pair"; pair: { from: string; to: string } | null }
  | { kind: "track"; train: BoardTrain; from: string; to: string }
  | { kind: "untrack" }
  | { kind: "refresh" };

interface MenuItem {
  label: string;
  run: (world: World) => Command[];
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s + " ".repeat(n - s.length));
/** `left` and `right` on one line of LINE_WIDTH, `left` cut to make room. */
export function spread(left: string, right: string, width = LINE_WIDTH): string {
  const room = Math.max(0, width - right.length - 1);
  return pad(left, room) + " " + right;
}

export function wrap(text: string, width = LINE_WIDTH): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (!word) continue;
    if (!line) line = word.slice(0, width);
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else { out.push(line); line = word.slice(0, width); }
  }
  if (line) out.push(line);
  return out;
}

export function statusText(t: BoardTrain): string {
  switch (t.status) {
    case "cancelled": return "CXL";
    case "late": return `+${t.delay_min}`;
    case "early": return `${t.delay_min}`;
    case "on_time": return "ok";
    default: return "";
  }
}

export function untilText(t: number, now: number): string {
  const m = minutesUntil(t, now);
  if (m <= 0) return "now";
  if (m < 100) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** One train row: `>152 LTD  8:14 +3     12m`. */
export function trainRow(t: BoardTrain, now: number, selected: boolean): string {
  const left = `${selected ? ">" : " "}${pad(t.train, 4)}${t.kind} ${clock(t.pred_dep).padStart(5)} ${pad(statusText(t), 4)}`;
  return spread(left, t.status === "cancelled" ? "" : untilText(t.pred_dep, now));
}

export function boardLines(world: World, cursor: number): string[] {
  const b = world.board;
  if (!b) {
    return world.hasCommute
      ? ["HEADWAY", "", "Loading trains..."]
      : ["HEADWAY", "", "No commute saved yet.", "Set it in the Headway app,", "or double-tap: pick stations."];
  }
  const lines = [spread(`${b.from.short} > ${b.to.short}`, b.live ? clockAmPm(world.now) : `SCHED ${clock(world.now)}`)];
  if (!b.trains.length) lines.push("", "No more trains today.");
  const first = Math.max(0, Math.min(cursor - 1, b.trains.length - VISIBLE_TRAINS));
  b.trains.slice(first, first + VISIBLE_TRAINS).forEach((t, i) => lines.push(trainRow(t, world.now, first + i === cursor)));
  while (lines.length < 1 + VISIBLE_TRAINS && b.trains.length) lines.push("");
  if (b.alerts.length) lines.push(pad(`! ${b.alerts[0].header}`, LINE_WIDTH).trimEnd());
  else if (world.note) lines.push(world.note);
  else if (!b.live) lines.push("Timetable only, no live data");
  else lines.push("tap: flip  hold: track");
  return lines.slice(0, MAX_LINES);
}

export function trackLines(p: TrainProgress | null, now: number): string[] {
  if (!p) return ["TRACKING", "", "Loading the train..."];
  const head = spread(`${p.train} ${p.kind} to ${p.to.short}`, p.cancelled ? "CXL" : p.delay_min === null ? "sched" : p.delay_min >= 2 ? `+${p.delay_min}` : "ok");
  if (p.arrived) return [head, "", `Arrived at ${p.to.short}.`, "", "hold: stop tracking"];
  const lines = [head];
  if (p.next && p.next.id !== p.to.id) lines.push(spread(`Next  ${p.next.short}`, clock(p.next.pred)));
  lines.push(spread(`Arrive ${p.to.short} ${clock(p.pred_arr)}`, `in ${untilText(p.pred_arr, now)}`));
  lines.push(p.stops_left <= 1 ? "Your stop is next" : `${p.stops_left - 1} stops to go`);
  lines.push("hold: stop  2x tap: board");
  return lines.slice(0, MAX_LINES);
}

export class Navigator {
  screen: Screen = "board";
  cursor = 0;
  menuIndex = 0;
  pickIndex = 0;
  pickFrom: string | null = null;
  alertIndex = 0;
  flash: { text: string; until: number } | null = null;
  /** The board train the cursor was on, so a refresh keeps it selected. */
  private cursorTrip: string | null = null;

  menu(world: World): MenuItem[] {
    const items: MenuItem[] = [];
    const b = world.board;
    if (world.hasCommute && world.custom) items.push({ label: "My commute", run: () => [{ kind: "show_pair", pair: null }] });
    if (b) items.push({ label: `Flip: ${b.to.short} > ${b.from.short}`, run: () => [{ kind: "show_pair", pair: { from: b.to.id, to: b.from.id } }] });
    items.push({ label: "Pick stations", run: () => this.startPick(world) });
    if (b?.alerts.length) items.push({ label: `Alerts (${b.alerts.length})`, run: () => { this.screen = "alerts"; this.alertIndex = 0; return []; } });
    if (world.progress) items.push({ label: `Train ${world.progress.train} to ${world.progress.to.short}`, run: () => { this.screen = "track"; return [{ kind: "refresh" }]; } });
    items.push({ label: "Refresh", run: () => { this.screen = "board"; return [{ kind: "refresh" }]; } });
    return items;
  }

  private startPick(world: World): Command[] {
    this.screen = "pick";
    this.pickFrom = null;
    this.pickIndex = Math.max(0, world.board ? stationIndex(world.board.from.id) : 0);
    return [];
  }

  /** Keeps the cursor on the same train when a new board arrives. */
  boardChanged(world: World) {
    const trains = world.board?.trains ?? [];
    const i = this.cursorTrip ? trains.findIndex((t) => t.trip_id === this.cursorTrip) : -1;
    this.cursor = i >= 0 ? i : Math.min(this.cursor, Math.max(0, trains.length - 1));
    if (i < 0) this.cursorTrip = trains[this.cursor]?.trip_id ?? null;
  }

  private say(text: string, now: number) {
    this.flash = { text, until: now + FLASH_MS };
  }

  input(input: Input, world: World): Command[] {
    const now = world.now;
    this.flash = null;
    switch (this.screen) {
      case "board": {
        const trains = world.board?.trains ?? [];
        if (input === "up" || input === "down") {
          this.cursor = Math.max(0, Math.min(trains.length - 1, this.cursor + (input === "down" ? 1 : -1)));
          this.cursorTrip = trains[this.cursor]?.trip_id ?? null;
          return [];
        }
        if (input === "double_tap") { this.screen = "menu"; this.menuIndex = 0; return []; }
        if (input === "tap") {
          const b = world.board;
          if (!b) return this.startPick(world);
          this.cursor = 0;
          this.cursorTrip = null;
          return [{ kind: "show_pair", pair: { from: b.to.id, to: b.from.id } }];
        }
        if (input === "long_press") {
          const t = trains[this.cursor];
          if (!t || !world.board) return [];
          if (t.status === "cancelled") { this.say(`${t.train} is cancelled`, now); return []; }
          this.screen = "track";
          this.say(`TRACKING ${t.train} TO ${world.board.to.short}`, now);
          return [{ kind: "track", train: t, from: world.board.from.id, to: world.board.to.id }];
        }
        return [];
      }
      case "menu": {
        const items = this.menu(world);
        if (input === "up" || input === "down") {
          this.menuIndex = (this.menuIndex + (input === "down" ? 1 : -1) + items.length) % items.length;
          return [];
        }
        if (input === "double_tap") { this.screen = "board"; return []; }
        if (input === "tap" || input === "long_press") {
          const item = items[Math.min(this.menuIndex, items.length - 1)];
          if (this.screen === "menu") this.screen = "board";
          const cmds = item.run(world);
          if (cmds.some((c) => c.kind === "show_pair")) { this.cursor = 0; this.cursorTrip = null; }
          return cmds;
        }
        return [];
      }
      case "pick": {
        if (input === "up" || input === "down") {
          this.pickIndex = (this.pickIndex + (input === "down" ? 1 : -1) + STATIONS.length) % STATIONS.length;
          return [];
        }
        if (input === "double_tap") {
          if (this.pickFrom) { this.pickIndex = stationIndex(this.pickFrom); this.pickFrom = null; }
          else this.screen = "menu";
          return [];
        }
        if (input === "tap") {
          const s = STATIONS[this.pickIndex];
          if (!this.pickFrom) {
            this.pickFrom = s.id;
            this.pickIndex = (this.pickIndex + 1) % STATIONS.length;
            return [];
          }
          if (s.id === this.pickFrom) { this.say("Pick a different station", now); return []; }
          const pair = { from: this.pickFrom, to: s.id };
          this.pickFrom = null;
          this.screen = "board";
          this.cursor = 0;
          this.cursorTrip = null;
          return [{ kind: "show_pair", pair }];
        }
        return [];
      }
      case "track": {
        if (input === "double_tap") { this.screen = "board"; return []; }
        if (input === "long_press") {
          this.screen = "board";
          this.say("STOPPED TRACKING", now);
          return [{ kind: "untrack" }];
        }
        if (input === "tap") return [{ kind: "refresh" }];
        return [];
      }
      case "alerts": {
        const n = world.board?.alerts.length ?? 0;
        if ((input === "up" || input === "down") && n) {
          this.alertIndex = (this.alertIndex + (input === "down" ? 1 : -1) + n) % n;
          return [];
        }
        if (input === "tap" || input === "double_tap") this.screen = "board";
        return [];
      }
    }
  }

  lines(world: World): string[] {
    const now = world.now;
    let lines: string[];
    switch (this.screen) {
      case "board":
        lines = boardLines(world, this.cursor);
        break;
      case "track":
        lines = trackLines(world.progress, now);
        break;
      case "menu": {
        const items = this.menu(world);
        const sel = Math.min(this.menuIndex, items.length - 1);
        const first = Math.max(0, Math.min(sel - 2, items.length - (MAX_LINES - 1)));
        lines = ["HEADWAY", ...items.slice(first, first + MAX_LINES - 1).map((m, i) => `${first + i === sel ? ">" : " "} ${m.label}`)];
        break;
      }
      case "pick": {
        const from = this.pickFrom ? STATIONS[stationIndex(this.pickFrom)] : null;
        const head = from ? spread(`TO?  from ${from.short}`, "tap: pick") : spread("FROM?", "tap: pick");
        const n = STATIONS.length, rows = MAX_LINES - 1;
        const first = Math.max(0, Math.min(this.pickIndex - 2, n - rows));
        lines = [head, ...STATIONS.slice(first, first + rows).map((s, i) => `${first + i === this.pickIndex ? ">" : " "} ${s.short}`)];
        break;
      }
      case "alerts": {
        const alerts = world.board?.alerts ?? [];
        const a = alerts[Math.min(this.alertIndex, alerts.length - 1)];
        if (!a) { lines = ["ALERTS", "", "No alerts for these stations."]; break; }
        const body = wrap(`${a.header}${a.description && a.description !== a.header ? ". " + a.description : ""}`);
        lines = [spread(`ALERT ${this.alertIndex + 1}/${alerts.length}`, "tap: back"), ...body.slice(0, MAX_LINES - 1)];
        break;
      }
    }
    if (this.flash && this.flash.until > now) lines = [...lines.slice(0, MAX_LINES - 1), `>> ${this.flash.text}`];
    return lines.slice(0, MAX_LINES).map((l) => (l.length > LINE_WIDTH ? l.slice(0, LINE_WIDTH) : l));
  }
}
