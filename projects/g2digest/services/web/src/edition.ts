// /edition/<date> (full edition: all text, methodology and sources; citations live here only) and
// /preview/<date> (the G2 preview next to it). Both render the bundle with the same function as the
// plugin, through the same Reader, so what this shows is the plugin's card sequence. `latest` is the
// newest edition; /preview/fixture shows the development fixture without signing in.
import { Reader, HtmlAudio, mountPreview, previewStatus } from "@g2digest/plugin";
import { positionDots, type Bundle } from "@g2digest/core";
import fixture from "@g2digest/core/fixtures/2026-10-22/bundle.json";
import { api, el, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
const [page = "edition", which = "latest"] = location.pathname.split("/").filter(Boolean);
const isPreview = page === "preview";

interface EditionResponse {
  date: string;
  title: string;
  status?: "published" | "draft" | "scheduled";
  publish_at?: string | null;
  published_at: string;
  bundle: Bundle;
  audio: Record<string, string>;
  preview_snapshot: string;
}
interface SearchHit { date: string; edition_title: string; card_slug: string; card_title: string; section_title: string | null; snippet: string; source_url: string | null }
interface BookmarkRow { edition_date: string; card_slug: string; card_title: string; section_title: string | null; body: string; source_url: string | null; created_at: string }

interface SectionTrigger {
  jumpToSection: (sectionId: string, play?: "glance" | "deep_dive") => void;
}

function editionView(b: Bundle, meta: { published_at?: string; snapshot?: string }, trigger?: SectionTrigger) {
  const sectionTitle = (id?: string) => b.edition.sections.find((s) => s.section_id === id)?.title ?? id ?? "";
  return el("article", { class: "panel edition" },
    el("p", { class: "muted small", style: "margin: 0" }, b.date, meta.published_at ? ` · published ${new Date(meta.published_at).toLocaleString()}` : "", ` · guide ${b.guide_version} · brief v${b.brief_version}`),
    el("h1", {}, b.edition.title),
    b.edition.intro ? el("p", { class: "muted" }, b.edition.intro) : null,
    ...b.edition.sections.flatMap((s) => {
      const secCards = b.cards.filter((c) => c.section_id === s.section_id);
      const hasGlance = secCards.some((c) => c.glance);
      const hasDeep = secCards.some((c) => c.deep_dive);
      const secBar = trigger && secCards.length
        ? el("div", { class: "row edition-sec-actions" },
          el("button", { class: "btn sm secondary", type: "button", onclick: () => trigger.jumpToSection(s.section_id) }, "Show on glasses"),
          hasGlance ? el("button", { class: "btn sm secondary", type: "button", onclick: () => trigger.jumpToSection(s.section_id, "glance") }, "♪ Glance") : null,
          hasDeep ? el("button", { class: "btn sm secondary", type: "button", onclick: () => trigger.jumpToSection(s.section_id, "deep_dive") }, "♪ Deep dive") : null)
        : null;
      return [
        el("h2", { id: `sec-${s.section_id}` }, s.title),
        secBar,
        ...s.body.split(/\n{2,}/).map((p) => el("p", {}, p)),
        s.methodology ? el("div", { class: "method" }, el("h3", {}, "How it works"), ...s.methodology.split(/\n{2,}/).map((p) => el("p", {}, p))) : null,
        s.sources.length ? el("div", { class: "sources" }, el("b", {}, "Sources"),
          el("ol", {}, ...s.sources.map((x) => el("li", {}, el("a", { href: x.url, rel: "noopener noreferrer", target: "_blank" }, x.title))))) : null,
      ];
    }),
    b.cut?.length ? el("details", {}, el("summary", {}, `Left out for budget (${b.cut.length})`),
      el("ul", {}, ...b.cut.map((c) => el("li", {}, `${sectionTitle(c.section_id)}${c.slug ? ` · ${c.slug}` : ""}: ${c.reason}`)))) : null,
    el("details", {}, el("summary", {}, "Audio scripts"),
      ...b.cards.filter((c) => c.glance || c.deep_dive).map((c) => el("div", {},
        el("h3", {}, `${c.kind === "section" ? `${sectionTitle(c.section_id)}: ` : ""}${c.title}`),
        c.glance ? el("p", {}, el("b", {}, `Glance (${Math.round(c.glance.duration_sec)} s): `), c.glance.script) : null,
        c.deep_dive ? el("div", {}, el("b", {}, `Deep dive (${Math.round(c.deep_dive.duration_sec / 60)} min)`), ...c.deep_dive.script.split(/\n{2,}/).map((p) => el("p", {}, p))) : null))),
    meta.snapshot ? el("details", {}, el("summary", {}, "Preview snapshot from the build"), el("pre", { class: "block" }, meta.snapshot)) : null);
}

function previewPanel(b: Bundle, audioUrl: (path: string) => string | null, opts: { canBookmark?: boolean; bookmarkedSlugs?: Set<string>; initialSlug?: string } = {}) {
  const host = el("section", { class: "panel" }, el("h2", {}, "On the glasses"));
  const audio = new HtmlAudio();
  const bookmarked = opts.bookmarkedSlugs ?? new Set<string>();
  let bmBtn: HTMLButtonElement | null = null;
  const syncBookmarkBtn = (r: Reader) => {
    if (!bmBtn) return;
    const c = b.cards[r.state.index];
    const isBm = Boolean(c && bookmarked.has(c.slug));
    bmBtn.textContent = isBm ? "Bookmarked ✓" : "Bookmark card";
    bmBtn.setAttribute("aria-pressed", String(isBm));
  };
  const reader: Reader = new Reader({
    audio,
    audioUrl: async (p) => audioUrl(p),
    onChange: (lines, r) => {
      preview.show(lines, positionDots(r.state.index, r.frames.length));
      preview.status(previewStatus(r));
      syncBookmarkBtn(r);
    },
  });
  const preview = mountPreview(host, { onGesture: (g) => void reader.gesture(g), audio });
  const actions = el("div", { class: "row", style: "margin-top: 8px; flex-wrap: wrap" });
  const commuteCheck = el("input", { type: "checkbox" });
  commuteCheck.addEventListener("change", () => { reader.autoAdvance = commuteCheck.checked; });
  actions.append(el("label", { class: "check small" }, commuteCheck, "Commute mode (auto-advance)"));
  if (opts.canBookmark) {
    bmBtn = el("button", { class: "btn secondary", type: "button", onclick: async () => {
      const c = b.cards[reader.state.index];
      if (!c) return;
      if (bookmarked.has(c.slug)) {
        const res = await api(`/api/bookmarks/${b.date}/${c.slug}`, { method: "DELETE" });
        if (res.ok) {
          bookmarked.delete(c.slug);
          syncBookmarkBtn(reader);
        }
      } else {
        const sec = c.section_id ? b.edition.sections.find((s) => s.section_id === c.section_id)?.title : undefined;
        const r = await api("/api/bookmarks", {
          method: "POST",
          body: JSON.stringify({ edition_date: b.date, card_slug: c.slug, card_title: c.title, section_title: sec, body: c.body, source_url: c.source_url }),
        });
        if (r.ok) {
          bookmarked.add(c.slug);
          syncBookmarkBtn(reader);
        }
      }
    } }, "Bookmark card");
    actions.append(bmBtn);
  }
  host.append(actions, el("p", { class: "muted small" }, "Keys: ↓ / ↑ next / previous card, Space tap, L tap-then-hold, Esc double tap. Or load this edition on real glasses: ",
    el("code", {}, `evenhub qr --url ${location.origin}/glasses/`), "."));
  const startIdx = opts.initialSlug ? Math.max(0, b.cards.findIndex((c) => c.slug === opts.initialSlug)) : 0;
  reader.load(b, startIdx);
  const trigger: SectionTrigger = {
    jumpToSection(sectionId, play) {
      const idx = b.cards.findIndex((c) => c.section_id === sectionId && (!play || (play === "glance" ? Boolean(c.glance) : Boolean(c.deep_dive))));
      const target = idx >= 0 ? idx : b.cards.findIndex((c) => c.section_id === sectionId);
      if (target < 0) return;
      reader.jumpTo(target);
      host.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (play === "glance") void reader.gesture("tap");
      else if (play === "deep_dive") void reader.gesture("long_press");
    },
  };
  return { host, reader, trigger };
}

async function editionsPicker(current: string) {
  const r = await api<{ date: string; title: string; status?: string }[]>("/api/editions");
  if (!r.ok || !r.body.length) return null;
  const s = el("select", { "aria-label": "Edition" }, ...r.body.map((e) =>
    el("option", { value: e.date, ...(e.date === current ? { selected: true } : {}) },
      `${e.date} · ${e.title}${e.status && e.status !== "published" ? ` [${e.status}]` : ""}`)));
  s.addEventListener("change", () => (location.href = `/${page}/${s.value}`));
  return s;
}

function searchAndBookmarksBar() {
  const results = el("ul", { class: "list", hidden: true });
  const input = el("input", { type: "search", placeholder: "Search kept editions (titles, sources, numbers)…", style: "flex: 1; min-width: 220px" });
  const doSearch = async () => {
    const q = input.value.trim();
    if (!q) { results.hidden = true; results.replaceChildren(); return; }
    const r = await api<SearchHit[]>(`/api/editions/search?q=${encodeURIComponent(q)}`);
    results.hidden = false;
    if (!r.ok || !r.body.length) {
      results.replaceChildren(el("li", { class: "muted small" }, `No matches for "${q}".`));
      return;
    }
    results.replaceChildren(...r.body.map((h) => el("li", {},
      el("div", {},
        el("a", { href: `/${page}/${h.date}#${encodeURIComponent(h.card_slug)}` }, el("b", {}, `${h.date} · ${h.card_title}`)),
        h.section_title ? el("span", { class: "badge", style: "margin-left: 6px" }, h.section_title) : null,
        el("div", { class: "muted small" }, h.snippet)))));
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") void doSearch(); });

  const bmList = el("ul", { class: "list" });
  const bmDetails = el("details", { style: "margin-top: 8px" }, el("summary", {}, "Bookmarked cards"), bmList);
  bmDetails.addEventListener("toggle", async () => {
    if (!bmDetails.open) return;
    const r = await api<BookmarkRow[]>("/api/bookmarks");
    if (!r.ok || !r.body.length) {
      bmList.replaceChildren(el("li", { class: "muted small" }, "No bookmarked cards yet. Bookmark from your glasses, iPhone, or preview."));
      return;
    }
    bmList.replaceChildren(...r.body.map((m) => el("li", {},
      el("div", {},
        el("a", { href: `/${page}/${m.edition_date}#${encodeURIComponent(m.card_slug)}` }, el("b", {}, `${m.edition_date} · ${m.card_title}`)),
        m.section_title ? el("span", { class: "badge", style: "margin-left: 6px" }, m.section_title) : null,
        el("div", { class: "muted small" }, m.body),
        m.source_url ? el("a", { href: m.source_url, target: "_blank", rel: "noopener noreferrer", class: "small" }, "Source ↗") : null),
      el("button", { class: "btn danger", type: "button", onclick: async () => {
        await api(`/api/bookmarks/${m.edition_date}/${m.card_slug}`, { method: "DELETE" });
        bmDetails.open = false;
        bmDetails.open = true;
      } }, "Remove"))));
  });

  return el("section", { class: "panel stack", style: "margin-bottom: 14px" },
    el("div", { class: "row" }, input, el("button", { class: "btn secondary", type: "button", onclick: () => void doSearch() }, "Search")),
    results,
    bmDetails);
}

async function render() {
  root.replaceChildren(spinner());
  if (which === "fixture") {
    const b = fixture as unknown as Bundle;
    const audioUrl = (p: string) => `/fixture/${p}`;
    const note = el("p", { class: "muted" }, "A synthetic sample edition (development fixture), not news. ", el("a", { href: "/login/" }, "Sign in"), " to see yours.");
    const pv = previewPanel(b, audioUrl);
    root.replaceChildren(el("div", { class: "stack" }, note, el("div", { class: "grid2" }, pv.host, editionView(b, {}, pv.trigger))));
    return;
  }
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<EditionResponse & { error?: string }>(`/api/editions/${which}`);
  if (!r.ok) {
    root.replaceChildren(searchAndBookmarksBar(), el("div", { class: "panel narrow" },
      el("h1", {}, r.status === 404 ? "No edition yet" : "Couldn't load the edition"),
      el("p", { class: "muted" }, r.status === 404 ? "Your build agent hasn't published one for this date. Check your brief, connect an agent, or look at the sample." : r.body.error ?? ""),
      el("div", { class: "row" }, el("a", { class: "btn primary", href: "/brief/" }, "Your brief"), el("a", { class: "btn secondary", href: "/agents/" }, "Build agents"), el("a", { class: "btn secondary", href: "/preview/fixture" }, "Sample"))));
    return;
  }
  const b = r.body.bundle;
  const [picker, bmRes] = await Promise.all([editionsPicker(r.body.date), api<BookmarkRow[]>("/api/bookmarks")]);
  const bookmarkedSlugs = new Set<string>(
    bmRes.ok && Array.isArray(bmRes.body) ? bmRes.body.filter((m) => m.edition_date === b.date).map((m) => m.card_slug) : [],
  );
  const initialSlug = location.hash ? decodeURIComponent(location.hash.slice(1)) : undefined;
  const shareOut = el("div", { class: "small" });
  const shareBtn = el("button", { class: "btn secondary", type: "button", onclick: async () => {
    const res = await api<{ url?: string; error?: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify({ edition_date: r.body.date, label: b.edition.title }),
    });
    if (res.ok && res.body.url) {
      void navigator.clipboard.writeText(res.body.url).catch(() => undefined);
      shareOut.replaceChildren(el("span", { class: "muted" }, "Share link copied (14 days): "), el("a", { href: res.body.url, target: "_blank" }, res.body.url));
    } else {
      shareOut.textContent = res.body.error ?? "Couldn't create share link.";
    }
  } }, "Share link");

  const draftBanner = r.body.status && r.body.status !== "published"
    ? el("div", { class: "panel row", style: "justify-content: space-between; margin-bottom: 14px" },
      el("span", {}, el("b", {}, r.body.status === "scheduled" ? `Scheduled for ${r.body.publish_at ? new Date(r.body.publish_at).toLocaleString() : "later"}` : "Draft edition"), " — not yet visible on glasses or podcast feed."),
      el("button", { class: "btn primary", type: "button", onclick: async () => {
        const res = await api(`/api/editions/${r.body.date}/publish`, { method: "POST" });
        if (res.ok) location.reload();
      } }, "Publish now"))
    : null;

  const top = el("div", { class: "row", style: "justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px" },
    el("div", { class: "row" }, picker, el("a", { class: "btn secondary", href: `/${isPreview ? "edition" : "preview"}/${r.body.date}` }, isPreview ? "Full edition only" : "Preview"), shareBtn),
    isPreview ? el("a", { class: "btn secondary", href: "/pair/" }, "Pairing code") : null);
  const pv = previewPanel(b, (p) => r.body.audio[p] ?? null, { canBookmark: true, bookmarkedSlugs, initialSlug });
  const edition = editionView(b, { published_at: r.body.published_at, snapshot: r.body.preview_snapshot }, pv.trigger);
  const nodes: (Node | string)[] = [searchAndBookmarksBar()];
  if (draftBanner) nodes.push(draftBanner);
  nodes.push(top, shareOut, el("div", { class: isPreview ? "grid2" : "grid2 rev" }, ...(isPreview ? [pv.host, edition] : [edition, pv.host])));
  root.replaceChildren(...nodes);
  if (initialSlug) {
    const matched = b.cards.find((c) => c.slug === initialSlug);
    if (matched?.section_id) document.getElementById(`sec-${matched.section_id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
void render();
