// The glasses plugin (PRD §7): runs in the Even app's WebView (bridge present: cards go to the
// glasses, R1 gestures come back) or in an ordinary browser (no bridge: the same page with the
// on-screen preview controls). The phone page pairs once with a 6-digit code from the web app, then
// mirrors the glasses and holds the few settings there are.
//
// On open: fetch the latest edition with the device token; offline, play the last fetched bundle
// (bundles are self-contained); revoked, fail closed into "pair again". Position resumes per edition.
// With no edition to read (not paired, nothing published, offline with nothing fetched) the glasses
// play the built-in tour, so every gesture always answers and the last card says what to do.
// Double tap with nothing playing opens the system exit dialog (Even Hub review rule).
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
import { audioPaths, DISPLAY, isTour, tour, type Bundle, type Gesture, type TourReason } from "@g2digest/core";
import { AudioCache, HtmlAudio } from "./audio.ts";
import { mountPreview, previewStatus } from "./preview.ts";
import { Reader, type AudioMode } from "./reader.ts";

/** Wait this long for the Even bridge before deciding we're in a plain browser. */
export const BRIDGE_TIMEOUT_MS = 5000;
const CONTAINER = { id: 1, name: "card" };
const K = { token: "g2digest:device_token", bundle: "g2digest:bundle", pos: "g2digest:position", mode: "g2digest:audio_mode" };

/** Contextual menu (tap, then long-press on the R1 when the firmware routes it to a menu). */
const MENU: { id: number; name: string; gesture: Gesture | "exit" }[] = [
  { id: 1, name: "Deep dive", gesture: "long_press" },
  { id: 2, name: "Glance audio", gesture: "tap" },
  { id: 3, name: "Stop audio", gesture: "stop" },
  { id: 4, name: "Next card", gesture: "next" },
  { id: 5, name: "Exit", gesture: "exit" },
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
    onRemote: (a) => void reader.gesture(a === "stop" ? "stop" : "tap"),
  });
  const reader: Reader = new Reader({
    audio,
    audioUrl: (p) => cache.resolve(p),
    persist: (date, index) => void (isTour(reader.bundle) || kv.set(K.pos, JSON.stringify({ date, index }))),
    // The system dialog: the user confirms on the glasses, then the host closes this WebView.
    onExit: () => void bridge?.shutDownPageContainer(1).catch(() => false),
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
  const ui = phonePage(opts.root, Boolean(bridge), api);
  const preview = mountPreview(ui.mirror, { onGesture: (g) => void reader.gesture(g), note: !bridge });

  if (bridge) {
    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      if (event.menuItemClickEvent?.itemID) {
        const m = MENU.find((x) => x.id === event.menuItemClickEvent!.itemID);
        if (m?.gesture === "exit") void bridge.shutDownPageContainer(1).catch(() => false);
        else if (m) void reader.gesture(m.gesture);
        return;
      }
      const sys = event.sysEvent ?? event.textEvent ?? event.listEvent;
      if (!sys) return;
      const type = OsEventTypeList.fromJson(sys.eventType ?? 0);
      if (type === OsEventTypeList.SYSTEM_EXIT_EVENT) {
        audio.stop();
        return;
      }
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

  /** No edition to read: the tour, ending with what to do next. */
  function showTour(reason: TourReason, message: string) {
    ui.state(reason === "pair" ? "pair" : "reading", message);
    const t = tour(reason, today());
    if (!isTour(reader.bundle) || reader.bundle!.edition.sections.at(-1)!.body !== t.edition.sections.at(-1)!.body) reader.load(t);
    ui.cacheNote(0, 0);
  }

  async function refresh() {
    const token = await kv.get(K.token);
    const cached = JSON.parse((await kv.get(K.bundle)) ?? "null") as Stored | null;
    if (!token) {
      showTour("pair", "");
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
      await kv.set(K.bundle, "");
      showTour("pair", "This device was unpaired. Pair it again with a new code.");
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
      showTour("waiting", "Paired. No edition published yet: connect the agent that builds your editions (Agents on the web app).");
      return;
    }
    if (cached) return show(cached, ` · offline, fetched ${new Date(cached.fetched_at).toLocaleString()}`);
    showTour("offline", "Offline and nothing fetched yet.");
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

/** The local calendar date, YYYY-MM-DD (the tour's date). */
const today = () => new Date().toLocaleDateString("en-CA");

function phonePage(root: HTMLElement, onGlasses: boolean, api: string) {
  // Addresses as text, not links: a link would navigate the Even app's WebView away from the plugin.
  const site = api.replace(/^https?:\/\//, "");
  root.innerHTML = `
    <div class="plugin">
      <header><b>G2 Digest</b><span class="pill">${onGlasses ? "glasses connected" : "browser preview"}</span></header>
      <section class="pair" hidden>
        <h2>Pair your glasses</h2>
        <p class="muted">In your browser, sign in at <b class="addr">${site}</b>, open <b>Pair</b>, and type the 6-digit code here. Meanwhile, the glasses show a short tour.</p>
        <p class="msg" hidden></p>
        <form class="row">
          <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Pairing code" />
          <button class="primary">Pair</button>
        </form>
        <p class="error" role="alert" hidden></p>
      </section>
      <section class="reading" hidden>
        <p class="muted title"></p>
      </section>
      <div class="mirror"></div>
      <section class="reading-more" hidden>
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
      <p class="muted small">Help: <span class="addr">${site}/support</span> · Privacy: <span class="addr">${site}/privacy</span></p>
    </div>`;
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
  const pair = $<HTMLElement>(".pair"), reading = $<HTMLElement>(".reading"), more = $<HTMLElement>(".reading-more");
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
      reading.hidden = more.hidden = s !== "reading";
      const msg = $<HTMLElement>(".pair .msg");
      msg.textContent = s === "pair" ? message ?? "" : "";
      msg.hidden = !msg.textContent;
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
