// /share/?t=g2s_… — public read-only view of a shared edition or single card (revocable by owner).
import type { Bundle, CardInput, EditionSection } from "@g2digest/core";
import { el, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;

interface SharedEdition {
  kind: "edition";
  date: string;
  title: string;
  label?: string | null;
  published_at?: string;
  bundle: Bundle;
  audio: Record<string, string>;
}
interface SharedCard {
  kind: "card";
  date: string;
  title: string;
  label?: string | null;
  card: CardInput;
  section: EditionSection | null;
  audio: Record<string, string>;
}

function audioBlock(label: string, path: string | undefined, audioMap: Record<string, string>) {
  if (!path || !audioMap[path]) return null;
  return el("div", { class: "stack", style: "margin: 8px 0" },
    el("span", { class: "small muted" }, label),
    el("audio", { controls: "", preload: "none", src: audioMap[path], style: "width: 100%" }));
}

async function render() {
  root.replaceChildren(spinner());
  const token = new URLSearchParams(location.search).get("t")?.trim() ?? "";
  if (!token) {
    root.replaceChildren(el("div", { class: "panel narrow" },
      el("h1", {}, "Missing share link"),
      el("p", { class: "muted" }, "This link doesn't include a share token.")));
    return;
  }
  const res = await fetch(`/api/shared/${encodeURIComponent(token)}`).catch(() => null);
  const body = (await res?.json().catch(() => ({}))) as (SharedEdition | SharedCard) & { error?: string };
  if (!res?.ok) {
    root.replaceChildren(el("div", { class: "panel narrow" },
      el("h1", {}, "Link unavailable"),
      el("p", { class: "muted" }, body.error ?? "This share link is invalid, expired, or revoked.")));
    return;
  }

  if (body.kind === "card") {
    const c = body.card;
    const s = body.section;
    root.replaceChildren(
      el("article", { class: "panel edition narrow" },
        el("p", { class: "muted small", style: "margin: 0" }, `Shared card · ${body.date} · ${body.title}`),
        el("h1", {}, c.title),
        el("p", {}, c.body),
        audioBlock("Glance audio", c.glance?.audio_path, body.audio),
        audioBlock("Deep dive audio", c.deep_dive?.audio_path, body.audio),
        s ? el("div", { style: "margin-top: 16px" },
          el("h2", {}, s.title),
          ...s.body.split(/\n{2,}/).map((p) => el("p", {}, p)),
          s.methodology ? el("div", { class: "method" }, el("h3", {}, "How it works"), ...s.methodology.split(/\n{2,}/).map((p) => el("p", {}, p))) : null,
          s.sources.length ? el("div", { class: "sources" }, el("b", {}, "Sources"),
            el("ol", {}, ...s.sources.map((x) => el("li", {}, el("a", { href: x.url, rel: "noopener noreferrer", target: "_blank" }, x.title))))) : null) : null));
    return;
  }

  const b = body.bundle;
  root.replaceChildren(
    el("article", { class: "panel edition" },
      el("p", { class: "muted small", style: "margin: 0" }, `Shared edition · ${body.date}`, body.label ? ` · ${body.label}` : ""),
      el("h1", {}, b.edition.title),
      b.edition.intro ? el("p", { class: "muted" }, b.edition.intro) : null,
      ...b.edition.sections.flatMap((s) => [
        el("h2", {}, s.title),
        ...s.body.split(/\n{2,}/).map((p) => el("p", {}, p)),
        s.methodology ? el("div", { class: "method" }, el("h3", {}, "How it works"), ...s.methodology.split(/\n{2,}/).map((p) => el("p", {}, p))) : null,
        s.sources.length ? el("div", { class: "sources" }, el("b", {}, "Sources"),
          el("ol", {}, ...s.sources.map((x) => el("li", {}, el("a", { href: x.url, rel: "noopener noreferrer", target: "_blank" }, x.title))))) : null,
      ])));
}

void render();
