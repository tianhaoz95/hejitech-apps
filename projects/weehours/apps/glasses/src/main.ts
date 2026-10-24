import {
  AudioInputSource,
  CreateStartUpPageContainer,
  EventSourceType,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { derive, status, statusLine } from "@weehours/core";
import { Api, Unpaired, type KV } from "./api.ts";
import { GlassesController, LABELS, type Input, type World } from "./controller.ts";
import { concat, durationMs, wav } from "./wav.ts";

/** The Wee Hours Worker. Dev builds use the local `dev:worker`; `?api=` overrides either (simulator, tests). */
const PRODUCTION = "https://weehours.hejitech.workers.dev";
const LOCAL = "http://127.0.0.1:8788";
const BRIDGE_TIMEOUT_MS = 5_000;
const params = new URLSearchParams(location.search);
const apiBase = params.get("api") ?? (import.meta.env.DEV ? LOCAL : PRODUCTION);
const debug = params.has("debug") || import.meta.env.DEV;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let bridge: EvenAppBridge | null = null;
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

const api = new Api(apiBase, kv);
const controller = new GlassesController();
const UNPAIRED_HUD = "Wee Hours · not paired\nOn your phone: Wee Hours → Settings → Even G2 glasses";
let world: World = { statusLine: "Loading…", openFeed: null, sleeping: false, nextSide: null, defaultFeed: "bottle", me: "", onDuty: null, children: [], focus: null };
/** The child gestures act on (several children); kept across launches. */
let focus: string | null = null;
let queued = 0;
let frames: Uint8Array[] = [];
let recordingSurface: "glasses" | "ring" = "ring";

function log(msg: string) {
  console.log(`[wee-hours] ${msg}`);
  const el = $("log");
  if (el) el.textContent = `${new Date().toLocaleTimeString()} ${msg}\n${el.textContent}`.slice(0, 4000);
}

/** The Even app injects its WebView handler; the SDK hands out a bridge object in any browser, so check first. */
async function detectBridge(): Promise<EvenAppBridge | null> {
  const host = () => (globalThis as { flutter_inappwebview?: { callHandler?: unknown } }).flutter_inappwebview;
  for (let waited = 0; !host() && waited < BRIDGE_TIMEOUT_MS; waited += 250) await new Promise((r) => setTimeout(r, 250));
  if (!host()) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), BRIDGE_TIMEOUT_MS));
  return (await Promise.race([waitForEvenAppBridge().catch(() => null), timeout])) as EvenAppBridge | null;
}

let lastHud = "";
async function render() {
  const text = api.paired && api.state ? controller.hud(world, Date.now()) : api.paired ? "Wee Hours\nConnecting…" : UNPAIRED_HUD;
  $("hud").textContent = text;
  renderPage();
  if (!bridge || text === lastHud) return;
  lastHud = text;
  await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: "hud", contentOffset: 0, contentLength: text.length, content: text })).catch(() => false);
}

/** The phone-side page inside the Even app: pairing, or what's connected. */
function renderPage() {
  const paired = api.paired;
  $("pairing").hidden = paired;
  $("paired").hidden = !paired;
  if (!paired) return;
  const s = api.state;
  $("household").textContent = s ? s.household.name || "Your household" : "Connecting…";
  $("kids").textContent = s ? s.children.map((c) => c.name + (c.expected ? " (expected)" : "")).join(", ") : "";
  $("queue").textContent = queued ? `${queued} waiting to send (offline)` : "Everything is sent";
}

async function refresh() {
  if (!api.paired) return render();
  try {
    if (!api.state) await api.loadState();   // the outbox only sends this household's entries
    queued = await api.flush();
    const s0 = await api.loadState();
    const events = [...s0.events, ...(await api.queued())];
    const kids = api.loggable;
    if (!kids.some((c) => c.id === focus)) focus = kids[0]?.id ?? null;
    const d = derive(events, focus ?? undefined);
    const st = status(d, { pendingCaptures: s0.children.length > 1 ? 0 : s0.pending_captures });
    const child = kids.find((c) => c.id === focus);
    world = {
      statusLine: kids.length ? statusLine(st, Date.now()) + (queued ? ` · ${queued} offline` : "") : "Logging opens once your baby arrives",
      openFeed: (st.open_feed_kind as World["openFeed"]) ?? null,
      sleeping: st.sleeping_since !== undefined,
      nextSide: st.next_side ?? null,
      defaultFeed: child?.default_feed ?? s0.household.default_feed ?? "bottle",
      me: s0.me.id,
      onDuty: st.on_duty ?? null,
      children: kids.map((c) => ({ id: c.id, name: c.name })),
      focus,
    };
  } catch (e) {
    if (e instanceof Unpaired) log(`unpaired: ${e.message}`);
    else log(`offline: ${(e as Error).message}`);
  }
  await render();
}

async function onInput(input: Input, surface: "glasses" | "ring") {
  if (!api.state) { log(api.paired ? "still connecting" : "not paired"); return; }
  if (!focus) {
    controller.flash("Nothing to log until your baby arrives", Date.now());
    return render();
  }
  const commands = controller.handle(input, world, Date.now());
  for (const c of commands) {
    if (c.kind === "focus") {
      focus = c.id;
      await kv.set("focus", c.id);
      controller.flash(`Logging for ${api.loggable.find((k) => k.id === c.id)?.name ?? ""}`, Date.now());
    } else if (c.kind === "log" || c.kind === "undo") {
      const row = c.kind === "log" ? api.newEvent(c.type, c.fields, surface, focus) : api.newEvent("undo", {}, surface, focus, c.id);
      await api.enqueueEvent(row);
      controller.committed({ id: row.id, type: row.type, at: Date.now() }, LABELS[row.type] ?? row.type, Date.now());
      log(`logged ${row.type} ${JSON.stringify(row.fields)}`);
    } else if (c.kind === "startRecording") {
      frames = [];
      recordingSurface = surface;
      if (bridge) await bridge.audioControl(true, AudioInputSource.Glasses);
      log("recording");
    } else if (c.kind === "stopRecording") {
      if (bridge) await bridge.audioControl(false);
      const pcm = concat(frames);
      frames = [];
      if (durationMs(pcm) < 300 && !params.has("fakeaudio")) {
        controller.flash("Too short, hold while you speak", Date.now());
      } else {
        const audio = pcm.length ? pcm : new Uint8Array(3200);
        const id = await api.enqueueCapture(wav(audio), c.attachTo, recordingSurface, focus);
        log(`capture ${id} (${Math.round(durationMs(audio))} ms) attach_to=${c.attachTo ?? "-"}`);
      }
    }
  }
  await render();
  if (commands.length) await refresh();
}

function inputFrom(event: EvenHubEvent): { input: Input; surface: "glasses" | "ring" } | null {
  const sys = event.sysEvent ?? event.textEvent ?? event.listEvent;
  const type = OsEventTypeList.fromJson(sys?.eventType ?? (sys ? 0 : undefined));
  const source = event.sysEvent?.eventSource;
  const surface = source === EventSourceType.TOUCH_EVENT_FROM_RING ? "ring" : "glasses";
  const map: Partial<Record<OsEventTypeList, Input>> = {
    [OsEventTypeList.CLICK_EVENT]: "click",
    [OsEventTypeList.DOUBLE_CLICK_EVENT]: "double_click",
    [OsEventTypeList.SCROLL_TOP_EVENT]: "up",
    [OsEventTypeList.SCROLL_BOTTOM_EVENT]: "down",
    [OsEventTypeList.LONG_PRESS_EVENT]: "long_press",
    [OsEventTypeList.LONG_PRESS_RELEASE_EVENT]: "long_press_release",
  };
  const input = type === undefined ? undefined : map[type];
  return input ? { input, surface } : null;
}

async function pair(code: string) {
  const error = $("pair-error");
  error.textContent = "";
  try {
    const { name } = await api.pair(code);
    log(`paired with ${name || "household"}`);
    ($("code") as HTMLInputElement).value = "";
    controller.flash("Paired ✓", Date.now());
    await refresh();
  } catch (e) {
    error.textContent = (e as Error).message;
    log(`pairing failed: ${(e as Error).message}`);
  }
}

async function boot() {
  bridge = await detectBridge();
  if (bridge) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({ containerID: 1, containerName: "hud", xPosition: 8, yPosition: 96, width: 560, height: 96, content: "Wee Hours", isEventCapture: 1 })],
    }));
    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      if (event.audioEvent) {
        if (controller.mode === "recording") frames.push(event.audioEvent.audioPcm);
        return;
      }
      const i = inputFrom(event);
      if (i) void onInput(i.input, i.surface);
    });
    log("bridge connected");
  } else {
    log("no bridge: browser preview");
  }

  $("debug").hidden = !debug;
  document.querySelectorAll<HTMLButtonElement>("[data-input]").forEach((b) =>
    b.addEventListener("click", () => void onInput(b.dataset.input as Input, "ring")));
  $("pair-form").addEventListener("submit", (e) => {
    e.preventDefault();
    void pair(($("code") as HTMLInputElement).value);
  });
  // Two taps (a WebView may not show confirm()).
  const unpair = $("unpair") as HTMLButtonElement;
  let armed = 0;
  unpair.addEventListener("click", () => {
    if (Date.now() - armed > 4_000) {
      armed = Date.now();
      unpair.textContent = "Tap again to unpair";
      setTimeout(() => { unpair.textContent = "Unpair these glasses"; }, 4_000);
      return;
    }
    armed = 0;
    unpair.textContent = "Unpair these glasses";
    void api.forget().then(() => { log("unpaired"); return render(); });   // the phone's list keeps the token until it's unpaired there
  });

  await api.restore();
  focus = await kv.get("focus");
  const code = params.get("pair");
  if (code) await pair(code);   // ?pair= (simulator, tests) re-pairs even when already paired
  else await refresh();
  setInterval(() => void refresh(), 15_000);
  setInterval(() => void render(), 1_000);
}

void boot();
