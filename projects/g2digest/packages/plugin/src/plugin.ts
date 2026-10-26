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
//
// Two pages on the glasses: the cards (the root page: a bordered text container across the whole
// display) and the past editions (a list container, opened by swiping down past the End card or
// from the menu; double tap goes back). A past edition stays on screen until the reader picks the
// latest again, so the periodic refresh doesn't swap it out.
import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  MenuContainerProperty,
  MenuItemProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { audioPaths, dateKicker, DISPLAY, FRAME, isTour, screenText, tour, type Bundle, type Gesture, type TourReason } from "@g2digest/core";
import { AudioCache, HtmlAudio } from "./audio.ts";
import { mountPreview, previewStatus } from "./preview.ts";
import { Reader, type AudioMode } from "./reader.ts";

/** Wait this long for the Even bridge before deciding we're in a plain browser. */
export const BRIDGE_TIMEOUT_MS = 5000;
const CONTAINER = { id: 1, name: "card" };
const LIST = { id: 2, name: "editions" };
/** Editions per page of the glasses' list (its rows share the frame's height). */
const LIST_PAGE = 8;
/** A list row holds at most 64 characters. */
const ROW_CHARS = 60;
const K = { token: "g2digest:device_token", bundle: "g2digest:bundle", pos: "g2digest:position", mode: "g2digest:audio_mode" };

/** Contextual menu (tap, then long-press on the R1 when the firmware routes it to a menu). */
const MENU: { id: number; name: string; gesture: Gesture | "exit" | "editions" }[] = [
  { id: 1, name: "Deep dive", gesture: "long_press" },
  { id: 2, name: "Glance audio", gesture: "tap" },
  { id: 3, name: "Stop audio", gesture: "stop" },
  { id: 4, name: "Next card", gesture: "next" },
  { id: 6, name: "Past editions", gesture: "editions" },
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

/** One edition in the list (GET /api/editions). */
interface EditionRow {
  date: string;
  title: string;
}

/** A row of the glasses' list: an edition, or a link to the next page of older/newer ones. */
type ListRow = { label: string; date?: string; page?: number };

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
  let lastText = "";
  let page: "cards" | "list" = "cards";
  let listRows: ListRow[] = [];
  /** The date of the past edition being read, or null for the latest. */
  let pinned: string | null = null;
  // The card frame and the list share the same border, so both pages look like one app.
  const frame = {
    xPosition: 0, yPosition: 0, width: DISPLAY.width, height: DISPLAY.height,
    borderWidth: FRAME.border, borderColor: FRAME.color, borderRadius: FRAME.radius, paddingLength: FRAME.padding, isEventCapture: 1,
  };
  const cardPage = (content: string) => ({
    containerTotalNum: 1,
    textObject: [new TextContainerProperty({ ...frame, containerID: CONTAINER.id, containerName: CONTAINER.name, content })],
    menuObject: new MenuContainerProperty({ menuItems: MENU.map((m) => new MenuItemProperty({ itemID: m.id, itemName: m.name })) }),
  });
  async function push(text: string) {
    lastText = text;
    if (!bridge || page !== "cards" || text === lastPushed) return;
    lastPushed = text;
    if (!glassesReady) {
      // createStartUpPageContainer works once per session; later layout changes rebuild the page.
      glassesReady = true;
      await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(cardPage(text)));
      return;
    }
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: CONTAINER.id, containerName: CONTAINER.name, content: text }));
  }
  /** Back from the list to the cards. */
  async function showCards() {
    if (!bridge || page === "cards") return;
    page = "cards";
    lastPushed = lastText;
    await bridge.rebuildPageContainer(new RebuildPageContainer(cardPage(lastText)));
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
    onEditions: () => void showList(0),
    onChange: (lines, r) => {
      void push(screenText(lines));
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
        else if (m?.gesture === "editions") void showList(0);
        else if (m) void reader.gesture(m.gesture);
        return;
      }
      const sys = event.sysEvent ?? event.textEvent ?? event.listEvent;
      if (!sys) return;
      // A click's type (0) can be left out of the event, and so can the index of the first row.
      const type = OsEventTypeList.fromJson(sys.eventType ?? 0);
      if (page === "list" && type !== OsEventTypeList.SYSTEM_EXIT_EVENT && type !== OsEventTypeList.FOREGROUND_ENTER_EVENT) {
        if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) void showCards();
        else if (type === OsEventTypeList.CLICK_EVENT && event.listEvent) void pickRow(event.listEvent.currentSelectItemIndex ?? 0);
        return;
      }
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

  // ------------------------------------------------------------------ past editions
  async function listEditions(): Promise<EditionRow[] | null> {
    const token = await kv.get(K.token);
    if (!token) return null;
    const res = await fetch(`${api}/api/editions`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res?.ok) return null;
    return (await res.json()) as EditionRow[];
  }
  const rowLabel = (e: EditionRow, i: number) => {
    const label = `${dateKicker(e.date)} · ${e.title}${i === 0 ? " (latest)" : ""}`;
    return [...label].length > ROW_CHARS ? [...label].slice(0, ROW_CHARS - 1).join("") + "…" : label;
  };
  /** The glasses' list of editions, newest first, a page at a time. */
  async function showList(offset: number) {
    if (!(await kv.get(K.token))) return reader.flash("PAIR TO SEE PAST EDITIONS");
    const all = await listEditions();
    if (!all) return reader.flash("OFFLINE: NO LIST");
    renderPhoneList(all);
    if (!bridge) return ui.focusEditions();
    const rows: ListRow[] = [];
    if (offset > 0) rows.push({ label: "Newer editions", page: Math.max(0, offset - LIST_PAGE) });
    all.slice(offset, offset + LIST_PAGE).forEach((e, i) => rows.push({ label: rowLabel(e, offset + i), date: offset + i === 0 ? "latest" : e.date }));
    if (all.length > offset + LIST_PAGE) rows.push({ label: "Older editions", page: offset + LIST_PAGE });
    if (!rows.length) return reader.flash("NO PAST EDITIONS");
    listRows = rows;
    page = "list";
    await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: 1,
      listObject: [new ListContainerProperty({
        ...frame, containerID: LIST.id, containerName: LIST.name,
        itemContainer: new ListItemContainerProperty({ itemCount: rows.length, itemWidth: 0, isItemSelectBorderEn: 1, itemName: rows.map((r) => r.label) }),
      })],
    }));
  }
  async function pickRow(i: number) {
    const row = listRows[i];
    if (!row) return;
    if (row.page !== undefined) return showList(row.page);
    if (row.date) await openEdition(row.date);
    await showCards();
  }
  /** Read one edition: "latest" goes back to following new editions. */
  async function openEdition(date: string) {
    if (date === "latest") {
      pinned = null;
      return refresh();
    }
    const token = await kv.get(K.token);
    const res = token ? await fetch(`${api}/api/editions/${date}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null) : null;
    if (!res?.ok) return reader.flash("OFFLINE");
    const body = (await res.json()) as { bundle: Bundle; audio: Record<string, string> };
    pinned = date;
    await show({ fetched_at: new Date().toISOString(), bundle: body.bundle, audio: body.audio }, " · past edition");
  }
  function renderPhoneList(all: EditionRow[]) {
    ui.setEditions(all.map((e, i) => ({ date: i === 0 ? "latest" : e.date, label: rowLabel(e, i) })), (date) => void openEdition(date));
  }

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
    if (pinned) return;
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
      void listEditions().then((all) => all && renderPhoneList(all));
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
    pinned = null;
    ui.setEditions([], () => {});
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
        <section class="past" hidden>
          <h3>Past editions</h3>
          <ul class="editions"></ul>
        </section>
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
    /** The same editions the glasses list, as buttons. */
    setEditions(rows: { date: string; label: string }[], pick: (date: string) => void) {
      const list = $<HTMLElement>(".editions");
      list.replaceChildren(...rows.map((row) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = row.label;
        b.addEventListener("click", () => pick(row.date));
        li.append(b);
        return li;
      }));
      $<HTMLElement>(".past").hidden = rows.length === 0;
    },
    focusEditions() {
      $<HTMLElement>(".past").scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };
}
