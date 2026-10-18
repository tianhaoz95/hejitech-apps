// Gesture state machine for the G2 HUD and R1 ring. Pure: it takes inputs plus a snapshot of the
// derived log and returns commands and the HUD text, so it is unit-tested without the SDK.
//
// Ring and temple touchpads share one map (the SDK reports which one; it is recorded as the
// event's surface):
//   press        no open feed → start the household's default feed; open feed → finish it
//   double press diaper → pick the kind (swipe to move, press to choose, double press to cancel)
//   swipe        open the quick menu: sleep, switch side, next child (several children), on duty, undo last, back
//
// With several children every gesture acts on the focused child, named on the HUD's first line;
// the menu's "Switch to <name>" moves the focus.
//   hold         speak while holding; release uploads the capture for the phone to process
//                (attached to the entry you just made, so "finish" + "drank half" becomes one entry)

export type Input = "click" | "double_click" | "up" | "down" | "long_press" | "long_press_release";

export interface World {
  statusLine: string;
  openFeed: "bottle" | "breast" | null;
  sleeping: boolean;
  nextSide: string | null;
  defaultFeed: "bottle" | "breast";
  me: string;
  onDuty: string | null;
  night: boolean;
  /** The household's children (in order) and the one gestures act on; one child: no names shown. */
  children: { id: string; name: string }[];
  focus: string | null;
}

export type Command =
  | { kind: "log"; type: string; fields: Record<string, string | number> }
  | { kind: "undo"; id: string }
  | { kind: "focus"; id: string }
  | { kind: "startRecording" }
  | { kind: "stopRecording"; attachTo: string | null };

type Mode = "status" | "menu" | "diaper" | "recording";

const DIAPER = ["wet", "dirty", "both", "dry"] as const;
const ATTACH_WINDOW_MS = 2 * 60_000;
const MESSAGE_MS = 4_000;

export interface Committed {
  id: string;
  type: string;
  at: number;
}

export class GlassesController {
  mode: Mode = "status";
  menuIndex = 0;
  diaperIndex = 0;
  message: { text: string; until: number } | null = null;
  lastCommit: Committed | null = null;

  menu(world: World): { label: string; command: () => Command | null }[] {
    const items: { label: string; command: () => Command | null }[] = [];
    items.push({ label: world.sleeping ? "Woke up" : "Fell asleep", command: () => ({ kind: "log", type: world.sleeping ? "sleep.end" : "sleep.start", fields: {} }) });
    if (world.openFeed === "breast") {
      const next = world.nextSide === "left" ? "left" : "right";
      items.push({ label: `Switch to ${next}`, command: () => ({ kind: "log", type: "feed.breast.switch", fields: { side: next } }) });
    }
    if (world.children.length > 1) {
      const i = Math.max(0, world.children.findIndex((c) => c.id === world.focus));
      const next = world.children[(i + 1) % world.children.length];
      items.push({ label: `Switch to ${next.name}`, command: () => ({ kind: "focus", id: next.id }) });
    }
    items.push({
      label: world.onDuty === world.me ? "Hand off duty" : "I'm on duty",
      command: () => ({ kind: "log", type: "duty", fields: world.onDuty === world.me ? ({} as Record<string, string>) : { caregiver: world.me } }),
    });
    if (this.lastCommit) {
      const last = this.lastCommit;
      items.push({ label: "Undo last", command: () => ({ kind: "undo", id: last.id }) });
    }
    items.push({ label: "Back", command: () => null });
    return items;
  }

  /** Returns the commands to execute for one input. */
  handle(input: Input, world: World, now: number): Command[] {
    switch (this.mode) {
      case "recording":
        if (input === "long_press_release") {
          this.mode = "status";
          const attach = this.lastCommit && now - this.lastCommit.at < ATTACH_WINDOW_MS ? this.lastCommit.id : null;
          this.flash("Captured ✓ · your phone will log it", now);
          return [{ kind: "stopRecording", attachTo: attach }];
        }
        return [];

      case "diaper":
        if (input === "up") this.diaperIndex = (this.diaperIndex + DIAPER.length - 1) % DIAPER.length;
        else if (input === "down") this.diaperIndex = (this.diaperIndex + 1) % DIAPER.length;
        else if (input === "double_click") this.mode = "status";
        else if (input === "click") {
          this.mode = "status";
          return [{ kind: "log", type: "diaper", fields: { kind: DIAPER[this.diaperIndex] } }];
        }
        return [];

      case "menu": {
        const items = this.menu(world);
        if (input === "up") this.menuIndex = (this.menuIndex + items.length - 1) % items.length;
        else if (input === "down") this.menuIndex = (this.menuIndex + 1) % items.length;
        else if (input === "double_click") this.mode = "status";
        else if (input === "click") {
          this.mode = "status";
          const c = items[this.menuIndex]?.command();
          return c ? [c] : [];
        }
        return [];
      }

      case "status":
        if (input === "long_press") {
          this.mode = "recording";
          return [{ kind: "startRecording" }];
        }
        if (input === "click") {
          if (world.openFeed === "bottle") return [{ kind: "log", type: "feed.bottle.finish", fields: {} }];
          if (world.openFeed === "breast") return [{ kind: "log", type: "feed.breast.finish", fields: {} }];
          if (world.defaultFeed === "breast") return [{ kind: "log", type: "feed.breast.start", fields: { side: world.nextSide ?? "left" } }];
          return [{ kind: "log", type: "feed.bottle.start", fields: {} }];
        }
        if (input === "double_click") {
          this.mode = "diaper";
          this.diaperIndex = 0;
          return [];
        }
        if (input === "up" || input === "down") {
          this.mode = "menu";
          this.menuIndex = 0;
          return [];
        }
        return [];
    }
  }

  committed(c: Committed, label: string, now: number) {
    if (c.type !== "undo" && c.type !== "duty") this.lastCommit = c;
    if (c.type === "undo") this.lastCommit = null;
    this.flash(`✓ ${label}`, now);
  }

  flash(text: string, now: number) {
    this.message = { text, until: now + MESSAGE_MS };
  }

  /** Two lines for the HUD: the status line, then the current prompt or confirmation. */
  hud(world: World, now: number): string {
    const focused = world.children.length > 1 ? world.children.find((c) => c.id === world.focus) : undefined;
    const top = focused ? `${focused.name} · ${world.statusLine}` : world.statusLine;
    let bottom: string;
    switch (this.mode) {
      case "recording":
        bottom = "● Listening… release to send";
        break;
      case "diaper":
        bottom = "Diaper: " + DIAPER.map((d, i) => (i === this.diaperIndex ? `[${d}]` : d)).join(" ");
        break;
      case "menu": {
        const items = this.menu(world);
        const i = Math.min(this.menuIndex, items.length - 1);
        bottom = `‹ ${items[i].label} ›  ${i + 1}/${items.length}`;
        break;
      }
      default:
        if (this.message && this.message.until > now) bottom = this.message.text;
        else bottom = world.openFeed ? "press: finish feed · hold: speak" : "press: feed · 2×: diaper · hold: speak";
    }
    return `${top}\n${bottom}`;
  }
}

export const LABELS: Record<string, string> = {
  "feed.bottle.start": "Bottle started",
  "feed.bottle.finish": "Bottle finished · hold to say how much",
  "feed.breast.start": "Nursing started",
  "feed.breast.switch": "Switched side",
  "feed.breast.finish": "Nursing finished",
  "sleep.start": "Asleep",
  "sleep.end": "Awake",
  diaper: "Diaper",
  duty: "Duty updated",
  undo: "Undone",
};
