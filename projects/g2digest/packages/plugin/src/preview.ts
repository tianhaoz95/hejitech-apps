// <G2Preview>: the browser stand-in for the glasses (PRD §6). A 576 × 288 monochrome green frame
// showing one card at a time, with simulated R1 controls that drive the same Reader (and so the
// same state machine) as the real gestures. Used by the web app's preview page and by the plugin's
// phone page as a mirror of what the glasses show.
import type { Gesture } from "@g2digest/core";
import type { Reader } from "./reader.ts";

export const FIDELITY_NOTE =
  "Faithful for layout and wrapping. Not for Bluetooth lag, the glasses' own font metrics, or hardware container limits. Check on the glasses before calling a layout change done.";

const CONTROLS: { g: Gesture; label: string; key: string; hint: string }[] = [
  { g: "prev", label: "Swipe up", key: "↑", hint: "previous card" },
  { g: "next", label: "Swipe down", key: "↓", hint: "next card" },
  { g: "tap", label: "Tap", key: "Space", hint: "play / pause glance" },
  { g: "long_press", label: "Tap, then hold", key: "L", hint: "deep dive" },
  { g: "double_tap", label: "Double tap", key: "Esc", hint: "stop audio / exit" },
];

const KEYS: Record<string, Gesture> = { ArrowDown: "next", j: "next", ArrowUp: "prev", k: "prev", " ": "tap", l: "long_press", L: "long_press", Escape: "double_tap" };

export interface PreviewHandle {
  root: HTMLElement;
  /** Draw these lines in the frame. */
  show(lines: string[]): void;
  /** Card n of N, under the frame. */
  status(text: string): void;
}

export function mountPreview(host: HTMLElement, opts: { onGesture: (g: Gesture) => void; controls?: boolean; keyboard?: boolean; note?: boolean }): PreviewHandle {
  const root = document.createElement("div");
  root.className = "g2-preview";
  const frame = document.createElement("div");
  frame.className = "g2-frame";
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", "Glasses display");
  const text = document.createElement("pre");
  text.className = "g2-text";
  frame.append(text);
  const scaler = document.createElement("div");
  scaler.className = "g2-scaler";
  scaler.append(frame);
  root.append(scaler);

  const status = document.createElement("div");
  status.className = "g2-status";
  root.append(status);

  if (opts.controls !== false) {
    const row = document.createElement("div");
    row.className = "g2-controls";
    row.setAttribute("aria-label", "Simulated R1 ring");
    for (const c of CONTROLS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `g2-btn g2-${c.g}`;
      b.title = `${c.hint} (${c.key})`;
      b.innerHTML = `<span></span><small></small>`;
      b.querySelector("span")!.textContent = c.label;
      b.querySelector("small")!.textContent = c.hint;
      b.addEventListener("click", () => opts.onGesture(c.g));
      row.append(b);
    }
    root.append(row);
  }
  if (opts.keyboard !== false) {
    window.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const g = KEYS[e.key];
      if (!g) return;
      e.preventDefault();
      opts.onGesture(g);
    });
  }
  if (opts.note !== false) {
    const note = document.createElement("p");
    note.className = "g2-note";
    note.textContent = FIDELITY_NOTE;
    root.append(note);
  }

  // The frame is laid out at the real 576 × 288 and scaled to the available width.
  const fit = () => {
    const w = scaler.clientWidth || 576;
    const s = Math.min(1, w / 576);
    frame.style.transform = `scale(${s})`;
    scaler.style.height = `${288 * s}px`;
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(fit).observe(scaler);
  host.append(root);
  fit();

  return {
    root,
    show(lines) {
      text.textContent = lines.join("\n");
    },
    status(t) {
      status.textContent = t;
    },
  };
}

/** Connects a preview to a reader: gestures in, lines out. */
export function previewStatus(reader: Reader): string {
  if (!reader.bundle) return "";
  const i = reader.state.index;
  const a = reader.state.audio;
  const playing = a ? ` · ${a.kind === "glance" ? "glance" : "deep dive"} ${a.playing ? "playing" : "paused"}` : "";
  return `Card ${i + 1} of ${reader.frames.length}${playing}`;
}
