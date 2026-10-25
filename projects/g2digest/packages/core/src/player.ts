// The gesture state machine (PRD §7.1), shared by the glasses plugin (R1 ring and temple events)
// and the web preview's simulated controls. Pure: gestures in, commands and the screen's lines
// out; the caller plays audio and pushes text.
//
//   swipe down / up     next / previous card (stops audio: audio belongs to the card on screen)
//   tap                 play / pause the current card's glance (or the deep dive already playing)
//   long press          play the current card's deep dive; none → "NO DEEP DIVE" flash
//   double tap          stop audio, back to skimming; with nothing playing, ask to exit (Even Hub
//                       review: a double tap on the root page opens the system exit dialog)
//   stop                stop audio only (the contextual menu, the lock screen's stop button)
import type { Frame } from "./types.ts";

export type Gesture = "next" | "prev" | "tap" | "long_press" | "double_tap" | "stop";
export type AudioKind = "glance" | "deep_dive";

export interface PlayerState {
  index: number;
  audio: { slug: string; kind: AudioKind; playing: boolean } | null;
  flash: { text: string; until: number } | null;
}

export type PlayerCommand =
  | { kind: "play"; slug: string; audio: AudioKind }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "stop" }
  /** Open the system exit dialog (the plugin calls shutDownPageContainer(1)). */
  | { kind: "exit" }
  /** Remember the position (bridge local storage) so reopening resumes here. */
  | { kind: "persist"; index: number };

export const FLASH_MS = 1500;
export const NO_DEEP_DIVE = "NO DEEP DIVE";
export const NO_GLANCE = "NO GLANCE AUDIO";

export const initialState = (index = 0): PlayerState => ({ index, audio: null, flash: null });

/** Applies one gesture. Returns the new state and what the caller must do. */
export function step(state: PlayerState, gesture: Gesture, frames: Frame[], now: number): { state: PlayerState; commands: PlayerCommand[] } {
  const commands: PlayerCommand[] = [];
  const s: PlayerState = { ...state, flash: state.flash && state.flash.until > now ? state.flash : null };
  const frame = frames[s.index];
  if (!frame) return { state: s, commands };
  const flash = (text: string) => (s.flash = { text, until: now + FLASH_MS });
  const stopAudio = () => {
    if (s.audio) commands.push({ kind: "stop" });
    s.audio = null;
  };

  switch (gesture) {
    case "next":
    case "prev": {
      const to = Math.max(0, Math.min(frames.length - 1, s.index + (gesture === "next" ? 1 : -1)));
      if (to === s.index) break;
      stopAudio();
      s.index = to;
      s.flash = null;
      commands.push({ kind: "persist", index: to });
      break;
    }
    case "tap":
      if (s.audio && s.audio.slug === frame.slug) {
        s.audio = { ...s.audio, playing: !s.audio.playing };
        commands.push({ kind: s.audio.playing ? "resume" : "pause" });
      } else if (frame.has_glance) {
        stopAudio();
        s.audio = { slug: frame.slug, kind: "glance", playing: true };
        commands.push({ kind: "play", slug: frame.slug, audio: "glance" });
      } else flash(NO_GLANCE);
      break;
    case "long_press":
      if (!frame.has_deep_dive) flash(NO_DEEP_DIVE);
      else if (s.audio?.slug === frame.slug && s.audio.kind === "deep_dive") {
        if (!s.audio.playing) {
          s.audio = { ...s.audio, playing: true };
          commands.push({ kind: "resume" });
        }
      } else {
        stopAudio();
        s.audio = { slug: frame.slug, kind: "deep_dive", playing: true };
        commands.push({ kind: "play", slug: frame.slug, audio: "deep_dive" });
      }
      break;
    case "double_tap":
      if (s.audio) stopAudio();
      else commands.push({ kind: "exit" });
      break;
    case "stop":
      stopAudio();
      break;
  }
  return { state: s, commands };
}

/** The player finished a file: back to skimming. */
export const ended = (state: PlayerState): PlayerState => ({ ...state, audio: null });

/** The lines on screen: the card, with its footer replaced by the player state or a flash. */
export function view(state: PlayerState, frames: Frame[], now: number): string[] {
  const frame = frames[state.index];
  if (!frame) return ["NO EDITION YET"];
  const lines = frame.lines.slice(0, -1);
  let footer = frame.footer;
  if (state.flash && state.flash.until > now) footer = `[ ${state.flash.text} ]`;
  else if (state.audio && state.audio.slug === frame.slug) {
    const what = state.audio.kind === "glance" ? "GLANCE" : "DEEP DIVE";
    footer = state.audio.playing ? `> ${what} PLAYING` : `|| ${what} PAUSED`;
  }
  return [...lines, footer];
}
