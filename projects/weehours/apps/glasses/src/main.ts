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
import { Api, type KV } from "./api.ts";
import { GlassesController, LABELS, type Input, type World } from "./controller.ts";
import { concat, durationMs, wav } from "./wav.ts";

const LOCAL = { url: "http://127.0.0.1:55421", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" };
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let bridge: EvenAppBridge | null = null;
const kv: KV = {
  async get(k) {
    if (bridge) return (await bridge.getLocalStorage(k)) || null;
    try { return localStorage.getItem(k); } catch { return null; }
  },
  async set(k, v) {
    if (bridge) { await bridge.setLocalStorage(k, v); return; }
    try { localStorage.setItem(k, v); } catch { /* preview without storage */ }
  },
};

const api = new Api({ url: params.get("url") ?? LOCAL.url, anonKey: params.get("key") ?? LOCAL.anonKey }, kv);
const controller = new GlassesController();
let world: World = { statusLine: "Sign in on the phone page", openFeed: null, sleeping: false, nextSide: null, defaultFeed: "bottle", me: "", onDuty: null, night: false };
let frames: Uint8Array[] = [];
let recordingSurface: "glasses" | "ring" = "ring";

function log(msg: string) {
  console.log(`[wee-hours] ${msg}`);
  const el = $("log");
  if (el) el.textContent = `${new Date().toLocaleTimeString()} ${msg}\n${el.textContent}`.slice(0, 4000);
}

async function render() {
  const text = controller.hud(world, Date.now());
  $("hud").textContent = text;
  if (!bridge) return;
  await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: "hud", contentOffset: 0, contentLength: text.length, content: text }));
}

async function refresh() {
  if (!api.session || !api.household) return;
  try {
    const remaining = await api.flush();
    const events = [...(await api.recentEvents()), ...(await api.queued())];
    const d = derive(events);
    const s = status(d, { pendingCaptures: (await api.pendingCaptures()) + 0 });
    const h = api.household.settings as Record<string, unknown>;
    world = {
      statusLine: statusLine(s, Date.now()) + (remaining ? ` · ${remaining} offline` : ""),
      openFeed: (s.open_feed_kind as World["openFeed"]) ?? null,
      sleeping: s.sleeping_since !== undefined,
      nextSide: s.next_side ?? null,
      defaultFeed: (h.default_feed as World["defaultFeed"]) ?? "bottle",
      me: api.session.user_id,
      onDuty: s.on_duty ?? null,
      night: false,
    };
  } catch (e) {
    log(`offline: ${(e as Error).message}`);
  }
  await render();
}

async function onInput(input: Input, surface: "glasses" | "ring") {
  if (!api.household) { log("not signed in"); return; }
  const commands = controller.handle(input, world, Date.now());
  for (const c of commands) {
    if (c.kind === "log" || c.kind === "undo") {
      const row = c.kind === "log" ? api.newEvent(c.type, c.fields, surface) : api.newEvent("undo", {}, surface, c.id);
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
        const id = await api.enqueueCapture(wav(audio), c.attachTo, recordingSurface);
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

async function signIn(email: string, password: string) {
  await api.signIn(email, password);
  await api.loadHousehold();
  $("who").textContent = `${email} · ${(api.household!.settings as { baby_name?: string }).baby_name ?? ""}`;
  log("signed in");
  await refresh();
}

async function boot() {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1500));
  bridge = (await Promise.race([waitForEvenAppBridge(), timeout])) as EvenAppBridge | null;
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
    log("no bridge: browser preview (use the buttons)");
  }

  document.querySelectorAll<HTMLButtonElement>("[data-input]").forEach((b) =>
    b.addEventListener("click", () => void onInput(b.dataset.input as Input, "ring")));
  $("signin").addEventListener("submit", (e) => {
    e.preventDefault();
    void signIn(($("email") as HTMLInputElement).value, ($("password") as HTMLInputElement).value).catch((err) => log(err.message));
  });

  await api.restore();
  const email = params.get("email"), password = params.get("password");
  if (email && password) await signIn(email, password).catch((e) => log(e.message));
  else if (api.session) await api.loadHousehold().then(refresh).catch((e) => log(e.message));
  await render();
  setInterval(() => void refresh(), 15_000);
  setInterval(() => void render(), 1_000);
}

void boot();
