// The glasses plugin (PRD §7): runs in the Even app's WebView (bridge present: cards go to the
// glasses, R1 gestures come back) or in an ordinary browser (no bridge: the same page with the
// on-screen preview controls). The phone page pairs once with a 6-digit code from the web app, then
// mirrors the glasses and holds the few settings there are.
//
// Two pages on the glasses. The root page is the list of editions, newest first: the plugin opens
// on it, and a double tap there opens the system exit dialog (Even Hub review rule). Picking one
// opens its cards at the first card: a bordered text container across the display, with the
// position dots in a narrow container at its right edge. On the cards, a double tap with nothing
// playing (or swiping up past the End) goes back to the list. With no edition to read (not paired,
// nothing published, offline with nothing fetched) the built-in tour is the root page instead, so
// every gesture always answers and its last card says what to do.
//
// Offline, the list is the last one fetched and the latest edition is kept (bundles are
// self-contained); a revoked device fails closed into "pair again".
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
import { audioPaths, dateKicker, DISPLAY, DOTS_PX, FRAME, isTour, positionDots, screenText, tour, type Bundle, type Gesture, type TourReason } from "@g2digest/core";
import { AudioCache, HtmlAudio } from "./audio.ts";
import { mountPreview, previewStatus } from "./preview.ts";
import { Reader, type AudioMode } from "./reader.ts";

/** Wait this long for the Even bridge before deciding we're in a plain browser. */
export const BRIDGE_TIMEOUT_MS = 5000;
const CARD = { id: 1, name: "card" };
const LIST = { id: 2, name: "editions" };
const DOTS = { id: 3, name: "dots" };
/** Editions per page of the glasses' list (its rows share the frame's height). */
const LIST_PAGE = 8;
/** A list row holds at most 64 characters. */
const ROW_CHARS = 60;
/** Keep up to 5 recent editions offline for commutes and flights. */
const MAX_OFFLINE_EDITIONS = 5;
const K = {
  token: "g2digest:device_token",
  bundle: "g2digest:bundle",
  bundles: "g2digest:bundles_cache",
  list: "g2digest:editions",
  mode: "g2digest:audio_mode",
  read: "g2digest:read_dates",
  commute: "g2digest:auto_advance",
  pendingBookmarks: "g2digest:pending_bookmarks",
};

type MenuAction = Gesture | "exit" | "editions" | "bookmark" | "jump" | "commute";

/** Contextual menu (tap, then long-press on the R1 when the firmware routes it to a menu). */
const MENU: { id: number; name: string; gesture: MenuAction }[] = [
  { id: 1, name: "Deep dive", gesture: "long_press" },
  { id: 2, name: "Glance audio", gesture: "tap" },
  { id: 3, name: "Stop audio", gesture: "stop" },
  { id: 7, name: "Bookmark card", gesture: "bookmark" },
  { id: 8, name: "Jump to section", gesture: "jump" },
  { id: 9, name: "Commute mode", gesture: "commute" },
  { id: 4, name: "Next card", gesture: "next" },
  { id: 6, name: "All editions", gesture: "editions" },
  { id: 5, name: "Exit", gesture: "exit" },
];

const GESTURES: Partial<Record<OsEventTypeList, Gesture>> = {
  [OsEventTypeList.CLICK_EVENT]: "tap",
  [OsEventTypeList.DOUBLE_CLICK_EVENT]: "double_tap",
  // Swipe up on the ring (SCROLL_TOP) moves on, like scrolling a page; swipe down goes back.
  [OsEventTypeList.SCROLL_TOP_EVENT]: "next",
  [OsEventTypeList.SCROLL_BOTTOM_EVENT]: "prev",
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

/** A row of the glasses' list: an edition, a page link, or a section jump target. */
type ListRow = { label: string; date?: string; page?: number; cardIndex?: number };

interface PendingBookmark {
  edition_date: string;
  card_slug: string;
  card_title: string;
  section_title?: string;
  body: string;
  source_url?: string;
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
  /** Which page the glasses show (null before the first one is drawn). */
  let page: "cards" | "list" | "sections" | null = null;
  /** The root page: the list of editions, or the tour when there's nothing to read. */
  let home: "list" | "tour" = "tour";
  let editions: EditionRow[] = [];
  let listOffset = 0;
  let listRows: ListRow[] = [];
  let shownRows = "";
  let readDates = new Set<string>(JSON.parse((await kv.get(K.read)) ?? "[]") as string[]);
  let lastText = "", lastDots = "", pushedText = "", pushedDots = "";
  // The card frame and the list share the same border, so both pages look like one app.
  const frame = {
    xPosition: 0, yPosition: 0, width: DISPLAY.width, height: DISPLAY.height,
    borderWidth: FRAME.border, borderColor: FRAME.color, borderRadius: FRAME.radius, paddingLength: FRAME.padding, isEventCapture: 1,
  };
  const inset = FRAME.border + FRAME.padding;
  const cardPage = () => ({
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({ ...frame, containerID: CARD.id, containerName: CARD.name, content: lastText, zOrderIndex: 0 }),
      // The dots: no border or padding of their own, lined up with the card's lines, on top of its right edge.
      new TextContainerProperty({
        containerID: DOTS.id, containerName: DOTS.name, xPosition: DISPLAY.width - inset - DOTS_PX, yPosition: inset,
        width: DOTS_PX, height: DISPLAY.height - 2 * inset, borderWidth: 0, paddingLength: 0, isEventCapture: 0, content: lastDots, zOrderIndex: 1,
      }),
    ],
    menuObject: new MenuContainerProperty({ menuItems: MENU.map((m) => new MenuItemProperty({ itemID: m.id, itemName: m.name })) }),
  });
  /** createStartUpPageContainer works once per session; every later page change rebuilds. */
  let started = false;
  async function draw(config: ConstructorParameters<typeof RebuildPageContainer>[0]) {
    if (!bridge) return;
    if (!started) {
      started = true;
      await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config));
    } else await bridge.rebuildPageContainer(new RebuildPageContainer(config));
  }
  async function push(text: string, dots: string) {
    lastText = text;
    lastDots = dots;
    if (!bridge || page !== "cards") return;
    if (text !== pushedText) {
      pushedText = text;
      await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: CARD.id, containerName: CARD.name, content: text }));
    }
    if (dots !== pushedDots) {
      pushedDots = dots;
      await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: DOTS.id, containerName: DOTS.name, content: dots }));
    }
  }
  /** Draw the cards page for what the reader holds. */
  async function showCards() {
    if (!bridge) return;
    page = "cards";
    pushedText = lastText;
    pushedDots = lastDots;
    shownRows = "";
    await draw(cardPage());
  }

  // ------------------------------------------------------------------ reader
  const cache = new AudioCache();
  const audio = new HtmlAudio({
    onRemote: (a) => void reader.gesture(a === "stop" ? "stop" : "tap"),
  });
  const reader: Reader = new Reader({
    audio,
    audioUrl: (p) => cache.resolve(p),
    onBack: () => void goHome(),
    onEditions: () => (home === "list" ? void showList(listOffset) : reader.flash("END OF THE TOUR")),
    onSignal: (ev) => {
      if (isTour(reader.bundle)) return;
      void sendAuthed("/api/signals", {
        edition_date: ev.date,
        card_slug: ev.slug,
        section_id: ev.section_id,
        signal: ev.signal,
        duration_ms: ev.duration_ms,
      });
    },
    onChange: (lines, r) => {
      const dots = positionDots(r.state.index, r.frames.length);
      void push(screenText(lines), dots.join("\n"));
      preview?.show(lines, dots);
      preview?.status(previewStatus(r));
      const card = r.bundle?.cards[r.state.index];
      if (card && r.state.audio) audio.setTitle(card.title);
    },
  });
  /** Leave the cards: the list, or (when the cards are the tour, the root page) the system exit dialog. */
  async function goHome() {
    if (home === "list") return showList(listOffset);
    // The system dialog: the user confirms on the glasses, then the host closes this WebView.
    await bridge?.shutDownPageContainer(1).catch(() => false);
  }

  // ------------------------------------------------------------------ phone page
  const ui = phonePage(opts.root, Boolean(bridge), api);
  const preview = mountPreview(ui.mirror, { onGesture: (g) => void reader.gesture(g), note: !bridge });

  if (bridge) {
    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      if (event.menuItemClickEvent?.itemID) {
        const m = MENU.find((x) => x.id === event.menuItemClickEvent!.itemID);
        if (m?.gesture === "exit") void bridge.shutDownPageContainer(1).catch(() => false);
        else if (m?.gesture === "editions") reader.gesture("stop").then(() => goHome());
        else if (m?.gesture === "bookmark") void bookmarkCurrentCard();
        else if (m?.gesture === "jump") void showSections();
        else if (m?.gesture === "commute") void toggleCommute();
        else if (m) void reader.gesture(m.gesture);
        return;
      }
      const sys = event.sysEvent ?? event.textEvent ?? event.listEvent;
      if (!sys) return;
      // A click's type (0) can be left out of the event, and so can the index of the first row.
      const type = OsEventTypeList.fromJson(sys.eventType ?? 0);
      if (type === OsEventTypeList.SYSTEM_EXIT_EVENT) {
        audio.stop();
        return;
      }
      if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
        void refresh();
        return;
      }
      if (page === "sections") {
        if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) void showCards();
        else if (type === OsEventTypeList.CLICK_EVENT && event.listEvent) void pickSectionRow(event.listEvent.currentSelectItemIndex ?? 0);
        return;
      }
      if (page === "list") {
        // The root page: a double tap asks to exit.
        if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) void bridge.shutDownPageContainer(1).catch(() => false);
        else if (type === OsEventTypeList.CLICK_EVENT && event.listEvent) void pickRow(event.listEvent.currentSelectItemIndex ?? 0);
        return;
      }
      const g = type === undefined ? undefined : GESTURES[type];
      if (g) void reader.gesture(g);
    });
  }

  reader.mode = ((await kv.get(K.mode)) as AudioMode | null) ?? "webview";
  reader.autoAdvance = (await kv.get(K.commute)) === "1";
  ui.setMode(reader.mode);
  ui.setCommute(reader.autoAdvance);
  ui.onMode(async (m) => {
    reader.mode = m;
    audio.stop();
    await kv.set(K.mode, m);
  });
  ui.onCommute(async (on) => {
    reader.autoAdvance = on;
    await kv.set(K.commute, on ? "1" : "0");
  });

  async function toggleCommute() {
    reader.autoAdvance = !reader.autoAdvance;
    ui.setCommute(reader.autoAdvance);
    await kv.set(K.commute, reader.autoAdvance ? "1" : "0");
    reader.flash(reader.autoAdvance ? "COMMUTE MODE ON" : "COMMUTE MODE OFF");
  }

  // ------------------------------------------------------------------ the list of editions
  const authed = async (path: string) => {
    const token = await kv.get(K.token);
    if (!token) return null;
    return fetch(`${api}${path}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  };
  const sendAuthed = async (path: string, body: unknown) => {
    const token = await kv.get(K.token);
    if (!token) return null;
    return fetch(`${api}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
  };
  async function loadCachedBundles(): Promise<Record<string, Stored>> {
    const map = JSON.parse((await kv.get(K.bundles)) ?? "{}") as Record<string, Stored>;
    const legacy = JSON.parse((await kv.get(K.bundle)) ?? "null") as Stored | null;
    if (legacy && !map[legacy.bundle.date]) map[legacy.bundle.date] = legacy;
    return map;
  }
  async function saveCachedBundle(stored: Stored) {
    const map = await loadCachedBundles();
    map[stored.bundle.date] = stored;
    const dates = Object.keys(map).sort().reverse().slice(0, MAX_OFFLINE_EDITIONS);
    const trimmed: Record<string, Stored> = {};
    for (const d of dates) trimmed[d] = map[d];
    await kv.set(K.bundles, JSON.stringify(trimmed));
    if (dates[0] === stored.bundle.date) await kv.set(K.bundle, JSON.stringify(stored));
    const keepAudio = dates.flatMap((d) => audioPaths(trimmed[d].bundle));
    await cache.prune(keepAudio);
  }
  async function markRead(date: string) {
    if (readDates.has(date)) return;
    readDates.add(date);
    const recent = [...readDates].sort().reverse().slice(0, 30);
    readDates = new Set(recent);
    await kv.set(K.read, JSON.stringify(recent));
    renderPhoneList();
  }
  async function bookmarkCurrentCard() {
    const b = reader.bundle;
    if (!b || isTour(b)) return reader.flash("PAIR TO BOOKMARK");
    const c = b.cards[reader.state.index];
    if (!c) return;
    const secTitle = c.section_id ? b.edition.sections.find((s) => s.section_id === c.section_id)?.title : undefined;
    const item: PendingBookmark = {
      edition_date: b.date,
      card_slug: c.slug,
      card_title: c.title,
      section_title: secTitle,
      body: c.body,
      source_url: c.source_url,
    };
    const res = await sendAuthed("/api/bookmarks", item);
    if (res?.ok) {
      reader.flash("BOOKMARKED");
    } else {
      const q = JSON.parse((await kv.get(K.pendingBookmarks)) ?? "[]") as PendingBookmark[];
      if (!q.some((x) => x.edition_date === item.edition_date && x.card_slug === item.card_slug)) q.push(item);
      await kv.set(K.pendingBookmarks, JSON.stringify(q));
      reader.flash("BOOKMARK QUEUED");
    }
  }
  async function flushPendingBookmarks() {
    const q = JSON.parse((await kv.get(K.pendingBookmarks)) ?? "[]") as PendingBookmark[];
    if (!q.length) return;
    const left: PendingBookmark[] = [];
    for (const item of q) {
      const res = await sendAuthed("/api/bookmarks", item);
      if (!res?.ok) left.push(item);
    }
    await kv.set(K.pendingBookmarks, JSON.stringify(left));
  }
  async function showSections() {
    const b = reader.bundle;
    if (!b || !bridge) return;
    const rows: ListRow[] = [];
    const firstAlert = b.cards.findIndex((c) => c.alert);
    if (firstAlert >= 0) rows.push({ label: "! Alerts", cardIndex: firstAlert });
    const seen = new Set<string>();
    b.cards.forEach((c, idx) => {
      if (c.kind === "section" && c.section_id && !seen.has(c.section_id)) {
        seen.add(c.section_id);
        const title = b.edition.sections.find((s) => s.section_id === c.section_id)?.title ?? c.section_id;
        rows.push({ label: title, cardIndex: idx });
      }
    });
    if (!rows.length) return reader.flash("NO SECTIONS");
    audio.stop();
    listRows = rows.slice(0, LIST_PAGE);
    shownRows = "";
    await draw({
      containerTotalNum: 1,
      listObject: [new ListContainerProperty({
        ...frame, containerID: LIST.id, containerName: LIST.name,
        itemContainer: new ListItemContainerProperty({ itemCount: listRows.length, itemWidth: 0, isItemSelectBorderEn: 1, itemName: listRows.map((r) => r.label) }),
      })],
    });
    page = "sections";
  }
  async function pickSectionRow(i: number) {
    const row = listRows[i];
    if (row?.cardIndex !== undefined) reader.jumpTo(row.cardIndex);
    await showCards();
  }
  const rowLabel = (e: EditionRow, i: number) => {
    const prefix = readDates.has(e.date) ? "" : "● ";
    const label = `${prefix}${dateKicker(e.date)} · ${e.title}${i === 0 ? " (latest)" : ""}`;
    return [...label].length > ROW_CHARS ? [...label].slice(0, ROW_CHARS - 1).join("") + "…" : label;
  };
  /** The glasses' list, newest first, a page at a time (redrawn only when it changes, so the highlight stays put). */
  async function showList(offset: number) {
    listOffset = offset;
    const rows: ListRow[] = [];
    if (offset > 0) rows.push({ label: "Newer editions", page: Math.max(0, offset - LIST_PAGE) });
    editions.slice(offset, offset + LIST_PAGE).forEach((e, i) => rows.push({ label: rowLabel(e, offset + i), date: e.date }));
    if (editions.length > offset + LIST_PAGE) rows.push({ label: "Older editions", page: offset + LIST_PAGE });
    ui.state("reading", "Pick an edition on the glasses or below.");
    if (!bridge || !rows.length) return;
    const key = rows.map((r) => r.label).join("\n");
    if (page === "list" && key === shownRows) return;
    audio.stop();
    listRows = rows;
    shownRows = key;
    await draw({
      containerTotalNum: 1,
      listObject: [new ListContainerProperty({
        ...frame, containerID: LIST.id, containerName: LIST.name,
        itemContainer: new ListItemContainerProperty({ itemCount: rows.length, itemWidth: 0, isItemSelectBorderEn: 1, itemName: rows.map((r) => r.label) }),
      })],
    });
    page = "list";
  }
  async function pickRow(i: number) {
    const row = listRows[i];
    if (!row) return;
    if (row.page !== undefined) return showList(row.page);
    if (row.date) await openEdition(row.date);
  }
  /** Open one edition at its first card, falling back to multi-edition offline cache when offline. */
  async function openEdition(date: string) {
    const res = await authed(`/api/editions/${date}`);
    let stored: Stored | null = null;
    if (res?.ok) {
      const body = (await res.json()) as { bundle: Bundle; audio: Record<string, string> };
      stored = { fetched_at: new Date().toISOString(), bundle: body.bundle, audio: body.audio };
      void saveCachedBundle(stored);
    } else {
      const map = await loadCachedBundles();
      stored = map[date] ?? null;
    }
    if (!stored) return ui.state("reading", "Offline: this edition isn't cached on the phone yet.");
    await markRead(stored.bundle.date);
    cache.setUrls(stored.audio);
    reader.load(stored.bundle, 0);
    ui.state("reading", `${stored.bundle.edition.title} · ${stored.bundle.date}${res?.ok ? "" : " · offline"}`);
    void cache.prefetch(audioPaths(stored.bundle)).then((n) => ui.cacheNote(n, audioPaths(stored.bundle).length));
    await showCards();
  }
  function renderPhoneList() {
    ui.setEditions(editions.map((e, i) => ({ date: e.date, label: rowLabel(e, i) })), (date) => void openEdition(date));
  }

  /** No edition to read: the tour is the root page, ending with what to do next. */
  async function showTour(reason: TourReason, message: string) {
    home = "tour";
    editions = [];
    renderPhoneList();
    ui.state(reason === "pair" ? "pair" : "reading", message);
    const t = tour(reason, today());
    if (!isTour(reader.bundle) || reader.bundle!.edition.sections.at(-1)!.body !== t.edition.sections.at(-1)!.body) reader.load(t);
    ui.cacheNote(0, 0);
    if (page !== "cards") await showCards();
  }

  /** Fetch the list (and keep the latest edition for offline); the reader isn't disturbed mid-edition. */
  async function refresh() {
    if (!(await kv.get(K.token))) return showTour("pair", "");
    const res = await authed("/api/editions");
    if (res?.status === 401) {
      // Revoked from the web app: fail closed.
      await kv.set(K.token, "");
      await kv.set(K.bundle, "");
      await kv.set(K.bundles, "");
      await kv.set(K.list, "");
      await kv.set(K.pendingBookmarks, "");
      return showTour("pair", "This device was unpaired. Pair it again with a new code.");
    }
    if (res?.status === 402) {
      // The account has no G2 Digest Pro (any store): the tour, ending with how to get it.
      await kv.set(K.bundle, "");
      await kv.set(K.bundles, "");
      await kv.set(K.list, "");
      return showTour("pro", "Your editions on these glasses need G2 Digest Pro: start a free week in the G2 Digest app or on the web.");
    }
    let list: EditionRow[] | null = null;
    if (res?.ok) {
      list = (await res.json()) as EditionRow[];
      await kv.set(K.list, JSON.stringify(list));
      void flushPendingBookmarks();
    } else {
      // Offline: show every edition cached on the phone (newest first).
      const map = await loadCachedBundles();
      const cachedList = Object.values(map)
        .sort((a, b) => b.bundle.date.localeCompare(a.bundle.date))
        .map((s) => ({ date: s.bundle.date, title: s.bundle.edition.title }));
      list = cachedList.length ? cachedList : null;
      if (!list) return showTour("offline", "Offline and nothing fetched yet.");
    }
    if (!list.length) return showTour("waiting", "Paired. No edition published yet: connect the agent that builds your editions (Agents on the web app).");
    const wasTour = home === "tour";
    home = "list";
    editions = list;
    renderPhoneList();
    if (res?.ok) void keepLatest(list[0].date);
    // Stay on the cards while an edition is being read; otherwise (re)draw the list.
    if (page !== "cards" || wasTour) await showList(wasTour ? 0 : listOffset);
  }
  /** Keep the newest edition and its audio on the phone for a commute without signal. */
  async function keepLatest(date: string) {
    const map = await loadCachedBundles();
    if (map[date]) return;
    const res = await authed("/api/editions/latest");
    if (!res?.ok) return;
    const body = (await res.json()) as { bundle: Bundle; audio: Record<string, string> };
    const stored: Stored = { fetched_at: new Date().toISOString(), bundle: body.bundle, audio: body.audio };
    await saveCachedBundle(stored);
    cache.setUrls(body.audio);
    void cache.prefetch(audioPaths(body.bundle));
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
    await kv.set(K.bundles, "");
    await kv.set(K.list, "");
    await kv.set(K.pendingBookmarks, "");
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
          <label><input type="checkbox" name="commute" /> Commute mode (auto-advance cards &amp; audio)</label>
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
    setCommute(on: boolean) {
      $<HTMLInputElement>("input[name=commute]").checked = on;
    },
    onCommute(cb: (on: boolean) => void) {
      const el = $<HTMLInputElement>("input[name=commute]");
      el.addEventListener("change", () => cb(el.checked));
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
