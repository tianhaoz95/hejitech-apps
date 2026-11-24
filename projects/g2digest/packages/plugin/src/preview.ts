// <G2Preview>: the browser stand-in for the glasses (PRD §6). A 576 × 288 monochrome green frame
// showing one card at a time, with simulated R1 controls that drive the same Reader (and so the
// same state machine) as the real gestures. Used by the web app's preview page and by the plugin's
// phone page as a mirror of what the glasses show.
import { screenText, type Gesture } from "@g2digest/core";
import type { Reader } from "./reader.ts";

export interface PreviewAudio {
  readonly playbackRate: number;
  setRate(rate: number): void;
  seek(seconds: number): void;
  onTimeUpdate(cb: (cur: number, dur: number, active: boolean) => void): () => void;
}

const RATES = [1, 1.25, 1.5, 2] as const;

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const FIDELITY_NOTE =
  "Faithful for layout and wrapping. Not for Bluetooth lag, the glasses' own font metrics, or hardware container limits. Check on the glasses before calling a layout change done.";

const CONTROLS: { g: Gesture; label: string; key: string; hint: string }[] = [
  { g: "prev", label: "Swipe down", key: "↑", hint: "previous card" },
  { g: "next", label: "Swipe up", key: "↓", hint: "next card" },
  { g: "tap", label: "Tap", key: "Space", hint: "play / pause glance" },
  { g: "long_press", label: "Tap, then hold", key: "L", hint: "deep dive" },
  { g: "double_tap", label: "Double tap", key: "Esc", hint: "stop audio / exit" },
];

const KEYS: Record<string, Gesture> = { ArrowDown: "next", j: "next", ArrowUp: "prev", k: "prev", " ": "tap", l: "long_press", L: "long_press", Escape: "double_tap" };

export interface PreviewHandle {
  root: HTMLElement;
  /** Draw these lines in the frame. */
  /** Draw these lines in the frame, with the position dots (one per card) at its right edge. */
  show(lines: string[], dots?: string[]): void;
  /** Card n of N, under the frame. */
  status(text: string): void;
}

export function mountPreview(host: HTMLElement, opts: { onGesture: (g: Gesture) => void; controls?: boolean; keyboard?: boolean; note?: boolean; audio?: PreviewAudio }): PreviewHandle {
  const root = document.createElement("div");
  root.className = "g2-preview";
  const frame = document.createElement("div");
  frame.className = "g2-frame";
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", "Glasses display");
  const text = document.createElement("pre");
  text.className = "g2-text";
  const dotsCol = document.createElement("pre");
  dotsCol.className = "g2-dots";
  dotsCol.setAttribute("aria-hidden", "true");
  frame.append(text, dotsCol);
  const scaler = document.createElement("div");
  scaler.className = "g2-scaler";
  scaler.append(frame);
  root.append(scaler);

  const status = document.createElement("div");
  status.className = "g2-status";
  root.append(status);

  if (opts.audio) {
    const audio = opts.audio;
    const bar = document.createElement("div");
    bar.className = "g2-audio-bar";
    bar.hidden = true;
    const scrub = document.createElement("input");
    scrub.type = "range";
    scrub.min = "0";
    scrub.max = "100";
    scrub.step = "0.25";
    scrub.value = "0";
    scrub.setAttribute("aria-label", "Audio position");
    const timeLabel = document.createElement("span");
    timeLabel.className = "g2-audio-time";
    timeLabel.textContent = "0:00 / 0:00";
    const speedBtn = document.createElement("button");
    speedBtn.type = "button";
    speedBtn.className = "g2-speed-btn";
    speedBtn.title = "Cycle playback speed";
    speedBtn.textContent = `${audio.playbackRate}x`;
    speedBtn.addEventListener("click", () => {
      const i = RATES.indexOf(audio.playbackRate as (typeof RATES)[number]);
      const next = RATES[(i + 1) % RATES.length];
      audio.setRate(next);
      speedBtn.textContent = `${next}x`;
    });
    let scrubbing = false;
    scrub.addEventListener("pointerdown", () => { scrubbing = true; });
    scrub.addEventListener("pointerup", () => { scrubbing = false; });
    scrub.addEventListener("input", () => audio.seek(Number(scrub.value)));
    audio.onTimeUpdate((cur, dur, active) => {
      bar.hidden = !active || dur <= 0;
      if (!active || dur <= 0) return;
      scrub.max = String(dur);
      if (!scrubbing) scrub.value = String(cur);
      timeLabel.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
    });
    bar.append(scrub, timeLabel, speedBtn);
    root.append(bar);
  }

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
    show(lines, dots = []) {
      text.textContent = screenText(lines);
      dotsCol.textContent = dots.join("\n");
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
