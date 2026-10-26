// The Even G2 screens and the R1 ring's gesture state machine. Pure: inputs plus the current world
// (board, tracked train) in, commands and the screen's lines out. The plugin pushes the lines to
// the glasses; the web preview and the tests drive the same class. Lines are laid out by the
// glasses' measured glyph widths (font.ts): proportional, so columns are padded in pixels.
//
//   board (root)  swipe up/down   move the cursor through the next trains
//                 tap             flip direction (SF ⇄ your station)
//                 long press      menu: track the train under the cursor, commute, pick stations,
//                                 alerts, the tracked train, refresh, exit
//                 double tap      exit (the system dialog; Even Hub requires it on the root page)
//   menu          swipe moves, tap picks, double tap back to the board
//   pick          choose From, then To (swipe, tap); double tap back
//   track         tap refreshes, long press stops tracking, double tap back to the board
//   alerts        swipe pages, tap or double tap back
import { fitPx, LINE_PX, MAX_LINES, padPx, spreadPx, wrapPx } from "./font.ts";
import { STATIONS, stationIndex } from "./schedule.ts";
import { clock, clockAmPm, minutesUntil } from "./time.ts";
import type { Board, BoardTrain, TrainProgress } from "./types.ts";

/** Trains visible on the board at once (header and footer take two lines; the rest scroll). */
export const VISIBLE_TRAINS = MAX_LINES - 2;
export const FLASH_MS = 2500;

export type Input = "up" | "down" | "tap" | "double_tap" | "long_press";
export type Screen = "board" | "menu" | "pick" | "track" | "alerts";

export interface World {
  board: Board | null;
  progress: TrainProgress | null;
  /** A morning or evening leg is set (the "Commute" menu item depends on it). */
  hasCommute: boolean;
  /** Showing a pair picked on the glasses instead of the commute. */
  custom: boolean;
  now: number;
  /** One line about where the data came from or what to do next ("Offline: timetable times"). */
  note?: string;
}

export type Command =
  | { kind: "show_pair"; pair: { from: string; to: string } | null }
  | { kind: "track"; train: BoardTrain; from: string; to: string }
  | { kind: "untrack" }
  | { kind: "refresh" }
  /** Ask the system to close the plugin (its confirm dialog). */
  | { kind: "exit" };

interface MenuItem {
  label: string;
  run: (world: World) => Command[];
}

/** Kept for callers that lay out a line: `left` … `right` across the glasses' line. */
export const spread = (left: string, right: string) => spreadPx(left, right);
export const wrap = (text: string) => wrapPx(text);

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

/** Column widths of a train row, in pixels: cursor, number, kind, time, status. */
const COLS = [16, 48, 46, 62, 44] as const;

/** One train row: `> 152  LTD  8:14  +3 … 12m`, columns aligned in pixels. */
export function trainRow(t: BoardTrain, now: number, selected: boolean): string {
  const cells = [selected ? ">" : "", t.train, t.kind, clock(t.pred_dep), statusText(t)];
  const left = cells.map((c, i) => padPx(c, COLS[i])).join("");
  return spreadPx(left.trimEnd(), t.status === "cancelled" ? "" : untilText(t.pred_dep, now));
}

export function boardLines(world: World, cursor: number): string[] {
  const b = world.board;
  if (!b) return ["HEADWAY", "", "Loading trains...", "", "hold: menu  2x tap: exit"];
  const lines = [spreadPx(`${b.from.short} > ${b.to.short}`, b.live ? clockAmPm(world.now) : `SCHED ${clock(world.now)}`)];
  // The footer: an alert or a note (offline, pair, timetable only) above the gesture hint, which
  // always shows (a first-time user, or a reviewer, learns the ring from it).
  const footer = [b.alerts.length ? fitPx(`! ${b.alerts[0].header}`) : world.note ?? (!b.live ? "Timetable only, no live data" : null), "tap: flip  hold: menu  2x: exit"]
    .filter((l): l is string => Boolean(l));
  const rows = MAX_LINES - 1 - footer.length;
  if (!b.trains.length) lines.push("", "No more trains today.");
  const first = Math.max(0, Math.min(cursor - 1, b.trains.length - rows));
  b.trains.slice(first, first + rows).forEach((t, i) => lines.push(trainRow(t, world.now, first + i === cursor)));
  while (lines.length < 1 + rows) lines.push("");
  return [...lines, ...footer].slice(0, MAX_LINES);
}

export function trackLines(p: TrainProgress | null, now: number): string[] {
  if (!p) return ["TRACKING", "", "Loading the train...", "", "2x tap: back"];
  const head = spreadPx(`${p.train} ${p.kind} to ${p.to.short}`, p.cancelled ? "CXL" : p.delay_min === null ? "sched" : p.delay_min >= 2 ? `+${p.delay_min}` : "ok");
  if (p.arrived) return [head, "", `Arrived at ${p.to.short}.`, "", "hold: stop  2x tap: back"];
  const lines = [head, ""];
  if (p.next && p.next.id !== p.to.id) lines.push(spreadPx(`Next: ${p.next.short}`, clock(p.next.pred)));
  lines.push(spreadPx(`Arrive ${p.to.short} ${clock(p.pred_arr)}`, `in ${untilText(p.pred_arr, now)}`));
  lines.push(p.stops_left <= 1 ? "Your stop is next" : `${p.stops_left - 1} stops to go`);
  lines.push("", "hold: stop  2x tap: back");
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
    const t = b?.trains[this.cursor];
    if (b && t && t.status !== "cancelled") {
      items.push({
        label: `Track ${t.train} (${clock(t.pred_dep)})`,
        run: () => {
          this.screen = "track";
          this.say(`Tracking ${t.train} to ${b.to.short}`, world.now);
          return [{ kind: "track", train: t, from: b.from.id, to: b.to.id }];
        },
      });
    }
    if (world.progress) items.push({ label: `Train ${world.progress.train} to ${world.progress.to.short}`, run: () => { this.screen = "track"; return [{ kind: "refresh" }]; } });
    if (world.hasCommute && world.custom) items.push({ label: "My commute", run: () => [{ kind: "show_pair", pair: null }] });
    items.push({ label: "Pick stations", run: () => this.startPick(world) });
    if (b?.alerts.length) items.push({ label: `Alerts (${b.alerts.length})`, run: () => { this.screen = "alerts"; this.alertIndex = 0; return []; } });
    items.push({ label: "Refresh", run: () => [{ kind: "refresh" }] });
    items.push({ label: "Exit Headway", run: () => [{ kind: "exit" }] });
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
    this.flash = { text: text.toUpperCase(), until: now + FLASH_MS };
  }

  input(input: Input, world: World): Command[] {
    const now = world.now;
    this.flash = null;
    switch (this.screen) {
      case "board": {
        const trains = world.board?.trains ?? [];
        if (input === "up" || input === "down") {
          const next = Math.max(0, Math.min(trains.length - 1, this.cursor + (input === "down" ? 1 : -1)));
          // Every gesture answers: at either end, say so.
          if (next === this.cursor) this.say(trains.length ? (input === "down" ? "Last train shown" : "Next train is first") : "No trains to scroll", now);
          this.cursor = next;
          this.cursorTrip = trains[this.cursor]?.trip_id ?? null;
          return [];
        }
        if (input === "double_tap") return [{ kind: "exit" }];
        if (input === "long_press") { this.screen = "menu"; this.menuIndex = 0; return []; }
        if (input === "tap") {
          const b = world.board;
          if (!b) return this.startPick(world);
          this.cursor = 0;
          this.cursorTrip = null;
          return [{ kind: "show_pair", pair: { from: b.to.id, to: b.from.id } }];
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
          this.screen = "board";
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
          else this.screen = "board";
          return [];
        }
        if (input === "long_press") { this.screen = "board"; return []; }
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
          this.say("Stopped tracking", now);
          return [{ kind: "untrack" }];
        }
        if (input === "tap") { this.say("Refreshing", now); return [{ kind: "refresh" }]; }
        this.say("2x tap: back to the board", now);
        return [];
      }
      case "alerts": {
        const n = world.board?.alerts.length ?? 0;
        if ((input === "up" || input === "down") && n) {
          this.alertIndex = (this.alertIndex + (input === "down" ? 1 : -1) + n) % n;
          return [];
        }
        this.screen = "board";
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
        const rows = MAX_LINES - 1;
        const first = Math.max(0, Math.min(sel - 2, items.length - rows));
        lines = [spreadPx("HEADWAY", "2x tap: back"), ...items.slice(first, first + rows).map((m, i) => `${first + i === sel ? ">" : "  "} ${m.label}`)];
        break;
      }
      case "pick": {
        const from = this.pickFrom ? STATIONS[stationIndex(this.pickFrom)] : null;
        const head = from ? spreadPx(`TO? (from ${from.short})`, "tap: pick") : spreadPx("FROM?", "tap: pick");
        const n = STATIONS.length, rows = MAX_LINES - 1;
        const first = Math.max(0, Math.min(this.pickIndex - 3, n - rows));
        lines = [head, ...STATIONS.slice(first, first + rows).map((s, i) => `${first + i === this.pickIndex ? ">" : "  "} ${s.short}`)];
        break;
      }
      case "alerts": {
        const alerts = world.board?.alerts ?? [];
        const a = alerts[Math.min(this.alertIndex, alerts.length - 1)];
        if (!a) { lines = ["ALERTS", "", "No alerts for these stations.", "", "tap: back"]; break; }
        const body = wrapPx(`${a.header}${a.description && a.description !== a.header ? ". " + a.description : ""}`);
        lines = [spreadPx(`ALERT ${this.alertIndex + 1}/${alerts.length}`, "tap: back"), ...body.slice(0, MAX_LINES - 1)];
        break;
      }
    }
    if (this.flash && this.flash.until > now) lines = [...lines.slice(0, MAX_LINES - 1), `>> ${this.flash.text}`];
    // Plain ASCII, each line within the frame; no trailing empty lines (they'd scroll).
    const out = lines.slice(0, MAX_LINES).map((l) => fitPx(l.replace(/[^\x20-\x7e]/g, ""), LINE_PX));
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out;
  }
}
