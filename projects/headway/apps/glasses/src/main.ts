// The Even Hub plugin: HeadwayApp (app.ts) wired to the Even app bridge (one full-screen text
// container on the G2, R1 ring and temple gestures back) and to the phone page in the Even app
// (pairing, status, the same screen mirrored). In a plain browser the page drives the same app with
// buttons. `?api=http://<lan-ip>:8792` points a dev build at a local Worker; `?pair=<code>` pairs on
// launch (simulator automation, or a QR from `evenhub qr`).
import {
  AppLocationAccuracy,
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { DISPLAY, FRAME, type Input } from "@headway/core";
import { HeadwayApp, type AppStatus, type Store } from "./app.ts";
import "./style.css";

const PRODUCTION = "https://headway.hejitech.workers.dev";
const params = new URLSearchParams(location.search);
const api = (params.get("api") ?? (import.meta.env.VITE_API_BASE || PRODUCTION)).replace(/\/$/, "");
const BRIDGE_TIMEOUT_MS = 5000;
const POLL_MS = 30_000;
const TICK_MS = 15_000;

/** The Even bridge, or null in an ordinary browser (the SDK returns an object either way). */
async function detectBridge(): Promise<EvenAppBridge | null> {
  const has = () => Boolean((globalThis as { flutter_inappwebview?: { callHandler?: unknown } }).flutter_inappwebview);
  for (let waited = 0; waited < BRIDGE_TIMEOUT_MS && !has(); waited += 250) await new Promise((r) => setTimeout(r, 250));
  if (!has()) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), BRIDGE_TIMEOUT_MS));
  return (await Promise.race([waitForEvenAppBridge().catch(() => null), timeout])) as EvenAppBridge | null;
}

const GESTURES: Partial<Record<OsEventTypeList, Input>> = {
  [OsEventTypeList.CLICK_EVENT]: "tap",
  [OsEventTypeList.DOUBLE_CLICK_EVENT]: "double_tap",
  [OsEventTypeList.SCROLL_TOP_EVENT]: "up",
  [OsEventTypeList.SCROLL_BOTTOM_EVENT]: "down",
  [OsEventTypeList.LONG_PRESS_EVENT]: "long_press",
};

export function inputFrom(event: EvenHubEvent): Input | "foreground" | null {
  const sys = event.sysEvent ?? event.textEvent ?? event.listEvent;
  if (!sys) return null;
  // A click arrives without an eventType (CLICK_EVENT is 0 and dropped when serialized).
  const type = OsEventTypeList.fromJson(sys.eventType ?? 0);
  if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT) return "foreground";
  return type === undefined ? null : GESTURES[type] ?? null;
}

async function boot() {
  const root = document.getElementById("app")!;
  const bridge = await detectBridge();
  const store: Store = {
    async get(k) {
      if (bridge) return (await bridge.getLocalStorage(k).catch(() => "")) || null;
      try { return localStorage.getItem(k); } catch { return null; }
    },
    async set(k, v) {
      if (bridge) { await bridge.setLocalStorage(k, v).catch(() => false); return; }
      try { localStorage.setItem(k, v); } catch { /* storage blocked */ }
    },
  };

  // ------------------------------------------------------------------ glasses output
  let created = false, lastText = "";
  async function push(text: string) {
    if (!bridge || text === lastText) return;
    lastText = text;
    if (!created) {
      created = true;
      await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 1,
        // The bordered frame other G2 apps draw (FRAME in core's font.ts).
        textObject: [new TextContainerProperty({
          containerID: 1, containerName: "board", xPosition: 0, yPosition: 0, width: DISPLAY.width, height: DISPLAY.height,
          borderWidth: FRAME.border, borderColor: FRAME.color, borderRadius: FRAME.radius, paddingLength: FRAME.padding,
          content: text, isEventCapture: 1,
        })],
      }));
      return;
    }
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: "board", content: text })).catch(() => false);
  }

  const ui = phonePage(root, Boolean(bridge));
  const app = new HeadwayApp({
    api, store,
    onLines: (lines) => {
      const text = lines.join("\n");
      ui.mirror.textContent = text;
      void push(text);
    },
    onStatus: (s) => ui.status(s),
    // The system's exit dialog (Even Hub review requires it on the root page); the host closes the plugin.
    onExit: () => void bridge?.shutDownPageContainer(1).catch(() => false),
    // The phone's rough location (the `location` permission) for the trip estimate to the station.
    locate: async () => {
      const l = bridge ? await bridge.getAppLocation({ accuracy: AppLocationAccuracy.Low, timeoutMs: 4000 }).catch(() => null) : null;
      return l ? { lat: l.latitude, lon: l.longitude } : null;
    },
  });

  if (bridge) {
    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      const i = inputFrom(event);
      if (i === "foreground") { lastText = ""; void app.refresh(); }
      else if (i) void app.input(i);
    });
  }
  ui.onInput((i) => void app.input(i));
  ui.onPair((code) => app.pairWith(code, bridge ? "Even G2" : "Browser"));
  ui.onUnpair(() => void app.unpair());
  ui.onCommute(() => void app.useCommute());
  ui.onRefresh(() => void app.refresh());

  const launchCode = params.get("pair");
  if (launchCode && !(await store.get("headway:device_token"))) {
    const problem = await app.pairWith(launchCode, bridge ? "Even G2" : "Browser");
    if (problem) ui.problem(problem);
  }
  await app.start();
  setInterval(() => void app.refresh(), POLL_MS);
  // Countdowns ("12m") move on between fetches.
  setInterval(() => app.render(), TICK_MS);
}

// ---------------------------------------------------------------------- phone page

function phonePage(root: HTMLElement, onGlasses: boolean) {
  root.innerHTML = `
    <div class="plugin">
      <header><b>Headway</b><span class="pill">${onGlasses ? "on your G2" : "browser preview"}</span></header>
      <pre class="mirror" aria-label="What the glasses show"></pre>
      <div class="ring" ${onGlasses ? "hidden" : ""}>
        <button data-in="up">Swipe up</button><button data-in="down">Swipe down</button>
        <button data-in="tap">Tap</button><button data-in="double_tap">Double-tap</button><button data-in="long_press">Hold</button>
      </div>
      <p class="muted source"></p>
      <section class="pair">
        <h2>Pair with your Headway account</h2>
        <p class="muted">Pairing brings your morning and evening stations and lets your iPhone alert you before your stop. In the Headway iPhone app open <b>Glasses</b>, or at headway.hejitech.workers.dev/settings, get a code and type it here.</p>
        <form class="row">
          <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Pairing code" />
          <button class="primary">Pair</button>
        </form>
        <p class="error" role="alert" hidden></p>
      </section>
      <section class="paired" hidden>
        <p>Paired. The glasses show your commute; double-tap on the ring for the menu.</p>
        <div class="row"><button class="commute">Show my commute</button><button class="refresh">Refresh</button><button class="unpair">Unpair</button></div>
      </section>
      <details>
        <summary>Ring gestures</summary>
        <p class="muted small">Swipe: next trains · Tap: flip direction · Hold: menu (track the selected train, your commute, pick stations, alerts, the tracked train) · Double-tap: exit (on a train you track: back to the board).</p>
      </details>
    </div>`;
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
  const err = $<HTMLElement>(".error");
  let pairCb: ((code: string) => Promise<string | null>) | null = null;
  $<HTMLFormElement>(".pair form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("input[name=code]");
    err.hidden = true;
    const problem = await pairCb?.(input.value);
    if (problem) { err.textContent = problem; err.hidden = false; } else input.value = "";
  });
  return {
    mirror: $<HTMLElement>(".mirror"),
    status(s: AppStatus) {
      $<HTMLElement>(".pair").hidden = s.paired;
      $<HTMLElement>(".paired").hidden = !s.paired;
      $<HTMLButtonElement>(".commute").hidden = !s.custom;
      const src = { live: "Live times from Caltrain's feed.", timetable: "Timetable times (no fresh live data).", offline: "Offline: timetable times.", none: "" }[s.source];
      $<HTMLElement>(".source").textContent = src;
      if (s.message) { err.textContent = s.message; err.hidden = false; }
    },
    problem(text: string) { err.textContent = text; err.hidden = false; },
    onInput(cb: (i: Input) => void) { root.querySelectorAll<HTMLButtonElement>(".ring button").forEach((b) => b.addEventListener("click", () => cb(b.dataset.in as Input))); },
    onPair(cb: (code: string) => Promise<string | null>) { pairCb = cb; },
    onUnpair(cb: () => void) { $<HTMLButtonElement>(".unpair").addEventListener("click", cb); },
    onCommute(cb: () => void) { $<HTMLButtonElement>(".commute").addEventListener("click", cb); },
    onRefresh(cb: () => void) { $<HTMLButtonElement>(".refresh").addEventListener("click", cb); },
  };
}

if (typeof document !== "undefined" && document.getElementById("app")) void boot();
