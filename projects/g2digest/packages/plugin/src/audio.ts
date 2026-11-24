// Audio for the Reader: one HTMLAudioElement (with Media Session handlers, so headphone and
// lock-screen controls work where the WebView allows it), plus a best-effort offline cache of the
// edition's files in Cache Storage. Bundles are self-contained; this keeps a fetched edition's audio
// playable with no signal on the train.
import type { AudioOut } from "./reader.ts";

export class HtmlAudio implements AudioOut {
  readonly el: HTMLAudioElement;
  private ended: (() => void) | null = null;
  private objectUrl: string | null = null;
  private rate = 1;
  private timeListeners = new Set<(cur: number, dur: number, active: boolean) => void>();

  constructor(opts: { onRemote?: (action: "play" | "pause" | "stop") => void } = {}) {
    this.el = new Audio();
    this.el.preload = "auto";
    this.el.setAttribute("playsinline", "");
    this.el.addEventListener("ended", () => {
      this.notifyTime(false);
      this.ended?.();
    });
    const emit = () => this.notifyTime(Boolean(this.el.getAttribute("src")));
    this.el.addEventListener("timeupdate", emit);
    this.el.addEventListener("loadedmetadata", emit);
    this.el.addEventListener("play", emit);
    this.el.addEventListener("pause", emit);
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (ms && opts.onRemote) {
      ms.setActionHandler("play", () => opts.onRemote!("play"));
      ms.setActionHandler("pause", () => opts.onRemote!("pause"));
      ms.setActionHandler("stop", () => opts.onRemote!("stop"));
    }
  }

  async play(url: string) {
    this.release();
    if (url.startsWith("blob:")) this.objectUrl = url;
    this.el.src = url;
    this.el.playbackRate = this.rate;
    await this.el.play();
    this.notifyTime(true);
  }
  pause() {
    this.el.pause();
  }
  resume() {
    this.el.playbackRate = this.rate;
    void this.el.play();
  }
  stop() {
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    this.release();
    this.notifyTime(false);
  }
  get playbackRate(): number {
    return this.rate;
  }
  setRate(rate: number) {
    this.rate = rate;
    this.el.playbackRate = rate;
  }
  seek(seconds: number) {
    if (Number.isFinite(this.el.duration) && this.el.duration > 0) {
      this.el.currentTime = Math.max(0, Math.min(seconds, this.el.duration));
      this.notifyTime(true);
    }
  }
  onTimeUpdate(cb: (cur: number, dur: number, active: boolean) => void): () => void {
    this.timeListeners.add(cb);
    return () => this.timeListeners.delete(cb);
  }
  private notifyTime(active: boolean) {
    const dur = Number.isFinite(this.el.duration) ? this.el.duration : 0;
    const cur = Number.isFinite(this.el.currentTime) ? this.el.currentTime : 0;
    for (const cb of this.timeListeners) cb(cur, dur, active);
  }
  onEnded(cb: () => void) {
    this.ended = cb;
  }
  setTitle(title: string, artist = "G2 Digest") {
    if (typeof MediaMetadata !== "undefined" && navigator.mediaSession) navigator.mediaSession.metadata = new MediaMetadata({ title, artist });
  }
  private release() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}

const CACHE = "g2digest-audio-v1";
/** Stable cache keys: signed URLs change on every fetch, the audio_path doesn't. Uses our whitelisted origin so Even Hub's static scanner doesn't flag an undeclared domain. */
const keyFor = (path: string) => `https://g2digest.hejitech.workers.dev/cache/audio/${path}`;

export class AudioCache {
  private urls: Record<string, string> = {};

  /** Signed URLs from the latest fetch, keyed by audio_path. */
  /** Adds signed URLs (paths are per date, so editions never collide; the latest's are kept for offline). */
  setUrls(urls: Record<string, string>) {
    this.urls = { ...this.urls, ...urls };
  }

  /** Downloads every file not yet cached (in the background; failures just stay online-only). */
  async prefetch(paths: string[]): Promise<number> {
    if (typeof caches === "undefined") return 0;
    let n = 0;
    try {
      const cache = await caches.open(CACHE);
      for (const p of paths) {
        if (await cache.match(keyFor(p))) {
          n++;
          continue;
        }
        const url = this.urls[p];
        if (!url) continue;
        const res = await fetch(url).catch(() => null);
        if (res?.ok) {
          await cache.put(keyFor(p), res);
          n++;
        }
      }
    } catch {
      /* Cache Storage unavailable in this WebView: stream only */
    }
    return n;
  }

  /** A playable URL: the cached copy when there is one, else the signed URL, else null. */
  async resolve(path: string): Promise<string | null> {
    try {
      if (typeof caches !== "undefined") {
        const hit = await (await caches.open(CACHE)).match(keyFor(path));
        if (hit) return URL.createObjectURL(await hit.blob());
      }
    } catch {
      /* fall through */
    }
    return this.urls[path] ?? null;
  }

  /** Drops files that no fetched edition references any more. */
  async prune(keep: string[]) {
    if (typeof caches === "undefined") return;
    try {
      const cache = await caches.open(CACHE);
      const wanted = new Set(keep.map(keyFor));
      for (const req of await cache.keys()) if (!wanted.has(req.url)) await cache.delete(req);
    } catch {
      /* ignore */
    }
  }
}
