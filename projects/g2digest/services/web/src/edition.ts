// /edition/<date> (full edition: all text, methodology and sources; citations live here only) and
// /preview/<date> (the G2 preview next to it). Both render the bundle with the same function as the
// plugin, through the same Reader, so what this shows is the plugin's card sequence. `latest` is the
// newest edition; /preview/fixture shows the development fixture without signing in.
import { Reader, HtmlAudio, mountPreview, previewStatus } from "@g2digest/plugin";
import type { Bundle } from "@g2digest/core";
import fixture from "@g2digest/core/fixtures/2026-10-22/bundle.json";
import { api, el, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
const [page = "edition", which = "latest"] = location.pathname.split("/").filter(Boolean);
const isPreview = page === "preview";

interface EditionResponse { date: string; title: string; published_at: string; bundle: Bundle; audio: Record<string, string>; preview_snapshot: string }

function editionView(b: Bundle, meta: { published_at?: string; snapshot?: string }) {
  const sectionTitle = (id?: string) => b.edition.sections.find((s) => s.section_id === id)?.title ?? id ?? "";
  return el("article", { class: "panel edition" },
    el("p", { class: "muted small", style: "margin: 0" }, b.date, meta.published_at ? ` · published ${new Date(meta.published_at).toLocaleString()}` : "", ` · guide ${b.guide_version} · brief v${b.brief_version}`),
    el("h1", {}, b.edition.title),
    b.edition.intro ? el("p", { class: "muted" }, b.edition.intro) : null,
    ...b.edition.sections.flatMap((s) => [
      el("h2", {}, s.title),
      ...s.body.split(/\n{2,}/).map((p) => el("p", {}, p)),
      s.methodology ? el("div", { class: "method" }, el("h3", {}, "How it works"), ...s.methodology.split(/\n{2,}/).map((p) => el("p", {}, p))) : null,
      s.sources.length ? el("div", { class: "sources" }, el("b", {}, "Sources"),
        el("ol", {}, ...s.sources.map((x) => el("li", {}, el("a", { href: x.url, rel: "noopener noreferrer", target: "_blank" }, x.title))))) : null,
    ]),
    b.cut?.length ? el("details", {}, el("summary", {}, `Left out for budget (${b.cut.length})`),
      el("ul", {}, ...b.cut.map((c) => el("li", {}, `${sectionTitle(c.section_id)}${c.slug ? ` · ${c.slug}` : ""}: ${c.reason}`)))) : null,
    el("details", {}, el("summary", {}, "Audio scripts"),
      ...b.cards.filter((c) => c.glance || c.deep_dive).map((c) => el("div", {},
        el("h3", {}, `${c.kind === "section" ? `${sectionTitle(c.section_id)}: ` : ""}${c.title}`),
        c.glance ? el("p", {}, el("b", {}, `Glance (${Math.round(c.glance.duration_sec)} s): `), c.glance.script) : null,
        c.deep_dive ? el("div", {}, el("b", {}, `Deep dive (${Math.round(c.deep_dive.duration_sec / 60)} min)`), ...c.deep_dive.script.split(/\n{2,}/).map((p) => el("p", {}, p))) : null))),
    meta.snapshot ? el("details", {}, el("summary", {}, "Preview snapshot from the build"), el("pre", { class: "block" }, meta.snapshot)) : null);
}

function previewPanel(b: Bundle, audioUrl: (path: string) => string | null) {
  const host = el("section", { class: "panel" }, el("h2", {}, "On the glasses"));
  const audio = new HtmlAudio();
  const reader: Reader = new Reader({
    audio,
    audioUrl: async (p) => audioUrl(p),
    onChange: (lines, r) => { preview.show(lines); preview.status(previewStatus(r)); },
  });
  const preview = mountPreview(host, { onGesture: (g) => void reader.gesture(g) });
  host.append(el("p", { class: "muted small" }, "Keys: ↓ / ↑ swipe, Space tap, L tap-then-hold, Esc double tap. Or load this edition on real glasses: ",
    el("code", {}, `evenhub qr --url ${location.origin}/glasses/`), "."));
  reader.load(b);
  return host;
}

async function editionsPicker(current: string) {
  const r = await api<{ date: string; title: string }[]>("/api/editions");
  if (!r.ok || !r.body.length) return null;
  const s = el("select", { "aria-label": "Edition" }, ...r.body.map((e) => el("option", { value: e.date, ...(e.date === current ? { selected: true } : {}) }, `${e.date} · ${e.title}`)));
  s.addEventListener("change", () => (location.href = `/${page}/${s.value}`));
  return s;
}

async function render() {
  root.replaceChildren(spinner());
  if (which === "fixture") {
    const b = fixture as unknown as Bundle;
    const audioUrl = (p: string) => `/fixture/${p}`;
    const note = el("p", { class: "muted" }, "A synthetic sample edition (development fixture), not news. ", el("a", { href: "/login/" }, "Sign in"), " to see yours.");
    root.replaceChildren(el("div", { class: "stack" }, note, el("div", { class: "grid2" }, previewPanel(b, audioUrl), editionView(b, {}))));
    return;
  }
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<EditionResponse & { error?: string }>(`/api/editions/${which}`);
  if (!r.ok) {
    root.replaceChildren(el("div", { class: "panel narrow" },
      el("h1", {}, r.status === 404 ? "No edition yet" : "Couldn't load the edition"),
      el("p", { class: "muted" }, r.status === 404 ? "Your build agent hasn't published one for this date. Check your brief, connect an agent, or look at the sample." : r.body.error ?? ""),
      el("div", { class: "row" }, el("a", { class: "btn primary", href: "/brief/" }, "Your brief"), el("a", { class: "btn secondary", href: "/agents/" }, "Build agents"), el("a", { class: "btn secondary", href: "/preview/fixture" }, "Sample"))));
    return;
  }
  const b = r.body.bundle;
  const picker = await editionsPicker(r.body.date);
  const top = el("div", { class: "row", style: "justify-content: space-between; margin-bottom: 14px" },
    el("div", { class: "row" }, picker, el("a", { class: "btn secondary", href: `/${isPreview ? "edition" : "preview"}/${r.body.date}` }, isPreview ? "Full edition only" : "Preview")),
    isPreview ? el("a", { class: "btn secondary", href: "/pair/" }, "Pairing code") : null);
  const preview = previewPanel(b, (p) => r.body.audio[p] ?? null);
  const edition = editionView(b, { published_at: r.body.published_at, snapshot: r.body.preview_snapshot });
  root.replaceChildren(top, el("div", { class: isPreview ? "grid2" : "grid2 rev" }, ...(isPreview ? [preview, edition] : [edition, preview])));
}
void render();
