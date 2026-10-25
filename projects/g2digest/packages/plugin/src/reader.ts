// Reader: one edition on screen. Binds the core render function and gesture state machine to an
// audio output, for both surfaces: the glasses plugin (gestures from the R1 ring) and the browser
// preview (on-screen controls). Whatever drives it, the same frames and the same state machine.
import { episodes, ended, initialState, render, step, view, type Bundle, type Frame, type Gesture, type PlayerCommand, type PlayerState } from "@g2digest/core";

export interface AudioOut {
  play(url: string): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  /** Called when the current file finishes. */
  onEnded(cb: () => void): void;
}

/** "webview": play in this page. "podcast": the native-player fallback (PRD §7.3) says which episode to play. */
export type AudioMode = "webview" | "podcast";

export interface ReaderOptions {
  audio: AudioOut;
  /** The lines to show (glasses text container and/or preview frame). */
  onChange: (lines: string[], reader: Reader) => void;
  /** Remember the position (bridge local storage), so reopening resumes there. */
  persist?: (date: string, index: number) => void;
  /** Resolves a bundle audio_path to a playable URL (signed URL or a cached copy). */
  audioUrl: (path: string) => Promise<string | null>;
  /** Double tap with nothing playing: open the system exit dialog (glasses only). */
  onExit?: () => void;
  now?: () => number;
}

export class Reader {
  bundle: Bundle | null = null;
  frames: Frame[] = [];
  state: PlayerState = initialState();
  mode: AudioMode = "webview";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private podcastFlash: string | null = null;

  constructor(private opts: ReaderOptions) {
    opts.audio.onEnded(() => {
      this.state = ended(this.state);
      this.emit();
    });
  }

  private now() {
    return this.opts.now?.() ?? Date.now();
  }

  load(bundle: Bundle, index = 0) {
    this.opts.audio.stop();
    this.bundle = bundle;
    this.frames = render(bundle);
    this.state = initialState(Math.max(0, Math.min(index, this.frames.length - 1)));
    this.emit();
  }

  lines(): string[] {
    if (!this.bundle) return ["G2 DIGEST", "No edition yet."];
    const lines = view(this.state, this.frames, this.now());
    if (this.podcastFlash && this.state.flash && this.state.flash.until > this.now()) lines[lines.length - 1] = `[ ${this.podcastFlash} ]`;
    return lines;
  }

  async gesture(g: Gesture) {
    if (!this.bundle) return;
    const { state, commands } = step(this.state, g, this.frames, this.now());
    this.state = state;
    this.podcastFlash = null;
    for (const c of commands) await this.run(c);
    this.emit();
  }

  private async run(c: PlayerCommand) {
    const a = this.opts.audio;
    switch (c.kind) {
      case "persist":
        if (this.bundle) this.opts.persist?.(this.bundle.date, c.index);
        return;
      case "pause":
        if (this.mode === "webview") a.pause();
        return;
      case "resume":
        if (this.mode === "webview") a.resume();
        return;
      case "stop":
        a.stop();
        return;
      case "exit":
        this.opts.onExit?.();
        return;
      case "play": {
        const card = this.bundle?.cards.find((x) => x.slug === c.slug);
        const path = card?.[c.audio]?.audio_path;
        if (!path) return;
        if (this.mode === "podcast") {
          const ep = episodes(this.bundle!).find((e) => e.slug === c.slug && e.kind === c.audio);
          this.state = { ...this.state, audio: null, flash: { text: "", until: this.now() + 4000 } };
          this.podcastFlash = `PODCAST EPISODE ${ep?.n ?? "?"}`;
          return;
        }
        const url = await this.opts.audioUrl(path);
        if (!url) {
          this.state = { ...this.state, audio: null, flash: { text: "AUDIO OFFLINE", until: this.now() + 1500 } };
          return;
        }
        await a.play(url).catch(() => {
          this.state = { ...this.state, audio: null, flash: { text: "CAN'T PLAY", until: this.now() + 1500 } };
        });
      }
    }
  }

  private emit() {
    this.opts.onChange(this.lines(), this);
    if (this.timer) clearTimeout(this.timer);
    const until = this.state.flash?.until;
    if (until && until > this.now()) this.timer = setTimeout(() => this.emit(), until - this.now() + 20);
  }
}
