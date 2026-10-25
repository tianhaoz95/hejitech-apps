// The Even Hub plugin: FitLoopApp (app.ts) wired to the Even app bridge (one full-screen text
// container on the G2, R1 ring and temple gestures back) and to the phone page in the Even app
// (pairing, status, the same screen mirrored). In a plain browser the page drives the same app with
// buttons. `?api=http://<lan-ip>:8794` points a dev build at a local Worker; `?pair=<code>` pairs on
// launch (simulator automation, or a QR from `evenhub qr`); `?date=YYYY-MM-DD` shows another day.
import {
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { DISPLAY, type Input } from "@fitloop/core";
import { FitLoopApp, K, type AppStatus, type Store } from "./app.ts";
import "./style.css";

const PRODUCTION = "https://fitloop.hejitech.workers.dev";
const params = new URLSearchParams(location.search);
const api = (params.get("api") ?? (import.meta.env.VITE_API_BASE || PRODUCTION)).replace(/\/$/, "");
const BRIDGE_TIMEOUT_MS = 5000;
const POLL_MS = 60_000;
const LIVE_MS = 4000;

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

  let created = false, lastText = "";
  async function push(text: string) {
    if (!bridge || text === lastText) return;
    lastText = text;
    if (!created) {
      created = true;
      await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [new TextContainerProperty({
          containerID: 1, containerName: "fitloop", xPosition: 0, yPosition: 0,
          width: DISPLAY.width, height: DISPLAY.height, paddingLength: 8, content: text, isEventCapture: 1,
        })],
      }));
      return;
    }
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: "fitloop", contentOffset: 0, contentLength: text.length, content: text })).catch(() => false);
  }

  const ui = phonePage(root, Boolean(bridge));
  const fixedDate = params.get("date");
  const app = new FitLoopApp({
    api, store, today: fixedDate && /^\d{4}-\d{2}-\d{2}$/.test(fixedDate) ? () => fixedDate : undefined,
    onLines: (lines) => {
      const text = lines.join("\n");
      if (params.has("debug")) console.log(`[fitloop] push ${JSON.stringify(text.split("\n").at(-1))}`);
      ui.mirror.textContent = text;
      void push(text);
    },
    onStatus: (s) => ui.status(s),
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
  ui.onRefresh(() => void app.refresh());

  const launchCode = params.get("pair");
  if (launchCode && !(await store.get(K.token))) {
    const problem = await app.pairWith(launchCode, bridge ? "Even G2" : "Browser");
    if (problem) ui.problem(problem);
  }
  await app.start();
  setInterval(() => void app.refresh(), POLL_MS);
  setInterval(() => { if (app.workoutActive) void app.pollLive().then(() => app.render()); }, LIVE_MS);
  // Timers count down on the glasses: re-render every second while one is showing.
  setInterval(() => { if (app.nav.ticking(Date.now())) app.render(); }, 1000);
}

function phonePage(root: HTMLElement, onGlasses: boolean) {
  root.innerHTML = `
    <div class="plugin">
      <header><b>FitLoop</b><span class="pill">${onGlasses ? "on your G2" : "browser preview"}</span></header>
      <pre class="mirror" aria-label="What the glasses show"></pre>
      <div class="ring" ${onGlasses ? "hidden" : ""}>
        <button data-in="up">Swipe up</button><button data-in="down">Swipe down</button>
        <button data-in="tap">Tap</button><button data-in="double_tap">Double-tap</button><button data-in="long_press">Hold</button>
      </div>
      <p class="muted source"></p>
      <section class="pair">
        <h2>Pair with your FitLoop account</h2>
        <p class="muted">In the FitLoop iPhone app open <b>Glasses</b> (or fitloop.hejitech.workers.dev → Settings), get a code and type it here.</p>
        <form class="row">
          <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Pairing code" />
          <button class="primary">Pair</button>
        </form>
        <p class="error" role="alert" hidden></p>
      </section>
      <section class="paired" hidden>
        <div class="row"><button class="refresh">Refresh</button><button class="unpair">Unpair</button></div>
      </section>
      <details>
        <summary>Ring gestures</summary>
        <p class="muted small">Today: swipe to choose, tap to open, hold for progress, double-tap for the menu. Workout: tap = set done (rest timer starts), swipe = next/previous exercise, hold = how-to, double-tap = skip, tell your agent, end. Meal: tap = ate it, hold = less / more / something else / skipped / a note.</p>
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
      $<HTMLElement>(".source").textContent = !s.paired ? "" : `${s.planTitle ?? "No plan yet"} · ${s.online ? "online" : "offline"}${s.queued ? ` · ${s.queued} check-in${s.queued === 1 ? "" : "s"} waiting to send` : ""}`;
      if (s.message) { err.textContent = s.message; err.hidden = false; }
    },
    problem(text: string) { err.textContent = text; err.hidden = false; },
    onInput(cb: (i: Input) => void) { root.querySelectorAll<HTMLButtonElement>(".ring button").forEach((b) => b.addEventListener("click", () => cb(b.dataset.in as Input))); },
    onPair(cb: (code: string) => Promise<string | null>) { pairCb = cb; },
    onUnpair(cb: () => void) { $<HTMLButtonElement>(".unpair").addEventListener("click", cb); },
    onRefresh(cb: () => void) { $<HTMLButtonElement>(".refresh").addEventListener("click", cb); },
  };
}

if (typeof document !== "undefined" && document.getElementById("app")) void boot();
