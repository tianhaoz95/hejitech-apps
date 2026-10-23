// The glasses plugin (PRD §7): runs in the Even app's WebView (bridge present: cards go to the
// glasses, R1 gestures come back) or in an ordinary browser (no bridge: the same page with the
// on-screen preview controls). The phone page pairs once with a 6-digit code from the web app, then
// mirrors the glasses and holds the few settings there are.
//
// On open: fetch the latest edition with the device token; offline, play the last fetched bundle
// (bundles are self-contained); revoked, fail closed into "pair again". Position resumes per edition.
import {
  CreateStartUpPageContainer,
  MenuContainerProperty,
  MenuItemProperty,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { audioPaths, DISPLAY, type Bundle, type Gesture } from "@g2digest/core";
import { AudioCache, HtmlAudio } from "./audio.ts";
import { mountPreview, previewStatus } from "./preview.ts";
import { Reader, type AudioMode } from "./reader.ts";

/** Wait this long for the Even bridge before deciding we're in a plain browser. */
export const BRIDGE_TIMEOUT_MS = 5000;
const CONTAINER = { id: 1, name: "card" };
const K = { token: "g2digest:device_token", bundle: "g2digest:bundle", pos: "g2digest:position", mode: "g2digest:audio_mode" };

/** Contextual menu (tap, then long-press on the R1 when the firmware routes it to a menu). */
const MENU: { id: number; name: string; gesture: Gesture }[] = [
  { id: 1, name: "Deep dive", gesture: "long_press" },
  { id: 2, name: "Glance audio", gesture: "tap" },
  { id: 3, name: "Stop audio", gesture: "double_tap" },
  { id: 4, name: "Next card", gesture: "next" },
];

const GESTURES: Partial<Record<OsEventTypeList, Gesture>> = {
  [OsEventTypeList.CLICK_EVENT]: "tap",
  [OsEventTypeList.DOUBLE_CLICK_EVENT]: "double_tap",
  [OsEventTypeList.SCROLL_BOTTOM_EVENT]: "next",
  [OsEventTypeList.SCROLL_TOP_EVENT]: "prev",
  [OsEventTypeList.LONG_PRESS_EVENT]: "long_press",
};

interface Stored {
  fetched_at: string;
  bundle: Bundle;
  audio: Record<string, string>;
}

interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
}

export interface PluginOptions {
  /** Origin of the web app / API, e.g. https://g2digest.hejitech.workers.dev. */
  apiBase: string;
  root: HTMLElement;
}

/**
 * The Even app bridge, or null in an ordinary browser. The SDK hands out a bridge object either way,
 * so the host's WebView handler decides; then wait (up to the timeout) for the bridge to be ready.
 */
export async function detectBridge(): Promise<EvenAppBridge | null> {
  const host = (globalThis as { flutter_inappwebview?: { callHandler?: unknown } }).flutter_inappwebview;
  if (!host?.callHandler) {
    // The handler can be injected a moment after load: give it a short grace period.
    for (let waited = 0; waited < BRIDGE_TIMEOUT_MS && !(globalThis as { flutter_inappwebview?: unknown }).flutter_inappwebview; waited += 250)
      await new Promise((r) => setTimeout(r, 250));
    if (!(globalThis as { flutter_inappwebview?: unknown }).flutter_inappwebview) return null;
  }
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), BRIDGE_TIMEOUT_MS));
  return (await Promise.race([waitForEvenAppBridge().catch(() => null), timeout])) as EvenAppBridge | null;
}

export async function bootPlugin(opts: PluginOptions) {
  const api = opts.apiBase.replace(/\/$/, "");
  const bridge = await detectBridge();

  const kv: KV = {
    async get(k) {
      if (bridge) return (await bridge.getLocalStorage(k).catch(() => "")) || null;
      try { return localStorage.getItem(k); } catch { return null; }
    },
    async set(k, v) {
      if (bridge) { await bridge.setLocalStorage(k, v).catch(() => false); return; }
      try { localStorage.setItem(k, v); } catch { /* preview without storage */ }
    },
  };

  // ------------------------------------------------------------------ glasses output
  let glassesReady = false;
  let lastPushed = "";
  async function push(text: string) {
    if (!bridge || text === lastPushed) return;
    lastPushed = text;
    if (!glassesReady) {
      glassesReady = true;
      await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [new TextContainerProperty({
          containerID: CONTAINER.id, containerName: CONTAINER.name, xPosition: 0, yPosition: 0,
          width: DISPLAY.width, height: DISPLAY.height, paddingLength: 8, content: text, isEventCapture: 1,
        })],
        menuObject: new MenuContainerProperty({ menuItems: MENU.map((m) => new MenuItemProperty({ itemID: m.id, itemName: m.name })) }),
      }));
      return;
    }
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: CONTAINER.id, containerName: CONTAINER.name, content: text }));
  }

  // ------------------------------------------------------------------ reader
  const cache = new AudioCache();
  const audio = new HtmlAudio({
    onRemote: (a) => void reader.gesture(a === "stop" ? "double_tap" : "tap"),
  });
  const reader: Reader = new Reader({
    audio,
    audioUrl: (p) => cache.resolve(p),
    persist: (date, index) => void kv.set(K.pos, JSON.stringify({ date, index })),
    onChange: (lines, r) => {
      const text = lines.join("\n");
      void push(text);
      preview?.show(lines);
      preview?.status(previewStatus(r));
      const card = r.bundle?.cards[r.state.index];
      if (card && r.state.audio) audio.setTitle(card.title);
    },
  });

  // ------------------------------------------------------------------ phone page
  const ui = phonePage(opts.root, Boolean(bridge));
  const preview = mountPreview(ui.mirror, { onGesture: (g) => void reader.gesture(g), note: !bridge });

  if (bridge) {
    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      if (event.menuItemClickEvent?.itemID) {
        const m = MENU.find((x) => x.id === event.menuItemClickEvent!.itemID);
        if (m) void reader.gesture(m.gesture);
        return;
      }
      const sys = event.sysEvent ?? event.textEvent ?? event.listEvent;
      if (!sys) return;
      const type = OsEventTypeList.fromJson(sys.eventType ?? 0);
      if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
        lastPushed = "";
        void refresh();
        return;
      }
      const g = type === undefined ? undefined : GESTURES[type];
      if (g) void reader.gesture(g);
    });
  }

  reader.mode = ((await kv.get(K.mode)) as AudioMode | null) ?? "webview";
  ui.setMode(reader.mode);
  ui.onMode(async (m) => {
    reader.mode = m;
    audio.stop();
    await kv.set(K.mode, m);
  });

  async function show(stored: Stored, note: string) {
    cache.setUrls(stored.audio);
    const pos = JSON.parse((await kv.get(K.pos)) ?? "null") as { date: string; index: number } | null;
    const resumeAt = pos && pos.date === stored.bundle.date ? pos.index : 0;
    if (reader.bundle?.date !== stored.bundle.date || reader.frames.length !== stored.bundle.cards.length) reader.load(stored.bundle, resumeAt);
    ui.state("reading", `${stored.bundle.edition.title} · ${stored.bundle.date}${note}`);
    void cache.prefetch(audioPaths(stored.bundle)).then((n) => ui.cacheNote(n, audioPaths(stored.bundle).length));
  }

  async function refresh() {
    const token = await kv.get(K.token);
    const cached = JSON.parse((await kv.get(K.bundle)) ?? "null") as Stored | null;
    if (!token) {
      ui.state("pair");
      await push("G2 DIGEST\n\nOpen G2 Digest on your\nphone and enter the\npairing code from the\nweb app.");
      return;
    }
    let res: Response | null = null;
    try {
      res = await fetch(`${api}/api/editions/latest`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      res = null;
    }
    if (res && res.status === 401) {
      // Revoked from the web app: fail closed.
      await kv.set(K.token, "");
      ui.state("pair", "This device was unpaired. Pair it again with a new code.");
      reader.bundle = null;
      await push("G2 DIGEST\n\nThis device was unpaired.\nPair again from your\nphone.");
      return;
    }
    if (res && res.ok) {
      const body = (await res.json()) as { bundle: Bundle; audio: Record<string, string> };
      const stored: Stored = { fetched_at: new Date().toISOString(), bundle: body.bundle, audio: body.audio };
      await kv.set(K.bundle, JSON.stringify(stored));
      void cache.prune(audioPaths(body.bundle));
      await show(stored, "");
      return;
    }
    if (res && res.status === 404 && !cached) {
      ui.state("reading", "Paired. No edition published yet.");
      await push("G2 DIGEST\n\nPaired. Your first\nedition isn't out yet.");
      return;
    }
    if (cached) return show(cached, ` · offline, fetched ${new Date(cached.fetched_at).toLocaleString()}`);
    ui.state("reading", "Offline and nothing fetched yet.");
    await push("G2 DIGEST\n\nOffline. Nothing fetched\nyet.");
  }

  async function pairWith(code: string, label: string): Promise<string | null> {
    const res = await fetch(`${api}/api/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, label }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { device_token?: string; error?: string };
    if (!res?.ok || !body.device_token) return body.error ?? "Couldn't reach G2 Digest. Check the connection.";
    await kv.set(K.token, body.device_token);
    return null;
  }
  ui.onPair(async (code, label) => {
    const problem = await pairWith(code, label);
    if (!problem) await refresh();
    return problem;
  });
  ui.onRefresh(() => void refresh());
  ui.onUnpair(async () => {
    audio.stop();
    await kv.set(K.token, "");
    await kv.set(K.bundle, "");
    reader.bundle = null;
    await refresh();
  });

  // `?pair=<code>` pairs on launch (simulator automation, or a QR made with `evenhub qr --url …/glasses/?pair=123456`).
  // A code is single-use and expires in ten minutes, so it's safe in a URL.
  const launchCode = new URLSearchParams(location.search).get("pair");
  if (launchCode && !(await kv.get(K.token))) {
    const problem = await pairWith(launchCode.replace(/\D/g, ""), bridge ? "Even G2" : "Browser");
    if (problem) ui.state("pair", problem);
  }
  await refresh();
  // Pick up a new edition while the plugin stays open.
  setInterval(() => void refresh(), 15 * 60_000);
  return { reader, bridge };
}

// ---------------------------------------------------------------------- phone page DOM

function phonePage(root: HTMLElement, onGlasses: boolean) {
  root.innerHTML = `
    <div class="plugin">
      <header><b>G2 Digest</b><span class="pill">${onGlasses ? "glasses connected" : "browser preview"}</span></header>
      <section class="pair" hidden>
        <h2>Pair your glasses</h2>
        <p class="muted msg">Sign in on the G2 Digest web app, open <b>Pair</b>, and type the 6-digit code here.</p>
        <form class="row">
          <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Pairing code" />
          <button class="primary">Pair</button>
        </form>
        <p class="error" role="alert" hidden></p>
      </section>
      <section class="reading" hidden>
        <p class="muted title"></p>
        <div class="mirror"></div>
        <p class="muted small cache"></p>
        <fieldset class="mode">
          <legend>Audio</legend>
          <label><input type="radio" name="mode" value="webview" /> Play here</label>
          <label><input type="radio" name="mode" value="podcast" /> In my podcast app (the glasses say which episode)</label>
        </fieldset>
        <div class="row">
          <button class="refresh">Check for a new edition</button>
          <button class="unpair">Unpair</button>
        </div>
      </section>
    </div>`;
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
  const pair = $<HTMLElement>(".pair"), reading = $<HTMLElement>(".reading");
  const err = $<HTMLElement>(".error");
  let pairHandler: ((code: string, label: string) => Promise<string | null>) | null = null;
  $<HTMLFormElement>(".pair form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("input[name=code]");
    err.hidden = true;
    const problem = await pairHandler?.(input.value.replace(/\D/g, ""), onGlasses ? "Even G2" : "Browser");
    if (problem) {
      err.textContent = problem;
      err.hidden = false;
    } else input.value = "";
  });
  return {
    mirror: $<HTMLElement>(".mirror"),
    state(s: "pair" | "reading", message?: string) {
      pair.hidden = s !== "pair";
      reading.hidden = s !== "reading";
      if (s === "pair" && message) $<HTMLElement>(".pair .msg").textContent = message;
      if (s === "reading") $<HTMLElement>(".reading .title").textContent = message ?? "";
    },
    cacheNote(n: number, of: number) {
      $<HTMLElement>(".cache").textContent = of ? `${n} of ${of} audio files saved for offline` : "";
    },
    setMode(m: AudioMode) {
      root.querySelectorAll<HTMLInputElement>("input[name=mode]").forEach((r) => (r.checked = r.value === m));
    },
    onMode(cb: (m: AudioMode) => void) {
      root.querySelectorAll<HTMLInputElement>("input[name=mode]").forEach((r) => r.addEventListener("change", () => r.checked && cb(r.value as AudioMode)));
    },
    onPair(cb: (code: string, label: string) => Promise<string | null>) {
      pairHandler = cb;
    },
    onRefresh(cb: () => void) {
      $<HTMLButtonElement>(".refresh").addEventListener("click", cb);
    },
    onUnpair(cb: () => void) {
      $<HTMLButtonElement>(".unpair").addEventListener("click", cb);
    },
  };
}
