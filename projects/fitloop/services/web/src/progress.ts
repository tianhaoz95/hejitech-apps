// /progress: adherence over the last weeks, vitals (and a manual entry form when manual entries are
// on) and progress photos (when that option is on).
import { METRICS, type Adherence, type Metric, type Settings } from "@fitloop/core";
import { api, el, fill, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function render() {
  const session = await requireSession(root, render);
  if (!session) return;
  const to = iso(new Date()), from = iso(new Date(Date.now() - 27 * 86400_000));
  const [p, s] = await Promise.all([
    api<{ adherence: Adherence; vitals: { date: string; metric: Metric; value: number; source: string }[] }>(`/api/progress?from=${from}&to=${to}`),
    api<{ settings: Settings }>("/api/settings"),
  ]);
  if (!p.ok || !s.ok) {
    fill(root, el("p", { class: "error" }, "Couldn't load progress."));
    return;
  }
  const a = p.body.adherence;
  const settings = s.body.settings;
  const byMetric = new Map<string, { date: string; value: number; source: string }[]>();
  for (const v of p.body.vitals) byMetric.set(v.metric, [...(byMetric.get(v.metric) ?? []), v]);

  const manual = settings.vitals.manual ? manualForm() : null;
  fill(root, 
    el("h1", {}, "Progress"),
    el("section", { class: "panel" },
      el("h2", {}, "Last 4 weeks"),
      el("p", {}, `${Math.round(a.average * 100)}% of the plan done · workouts ${a.workouts.done}/${a.workouts.planned} · meals ${a.meals.done}/${a.meals.planned} · streak ${a.streak} day${a.streak === 1 ? "" : "s"}`),
      el("div", { class: "days-grid" }, ...a.days.map((d) => el("div", { class: "day-cell", title: d.date },
        el("div", { class: "muted" }, d.date.slice(5)),
        el("div", { class: "bar" }, el("span", { style: `width: ${Math.round(d.completion * 100)}%` })),
        d.workouts_planned + d.meals_planned ? `${Math.round(d.completion * 100)}%` : "rest")))),
    el("section", { class: "panel" },
      el("h2", {}, "Vitals"),
      byMetric.size ? el("table", { class: "small" },
        el("tr", {}, el("th", {}, "Metric"), el("th", {}, "Latest"), el("th", {}, "4 weeks ago"), el("th", {}, "Source")),
        ...[...byMetric].map(([m, rows]) => {
          const meta = METRICS[m as Metric];
          return el("tr", {}, el("td", {}, meta?.label ?? m), el("td", {}, `${rows.at(-1)!.value} ${meta?.unit ?? ""}`), el("td", {}, `${rows[0].value}`), el("td", {}, rows.at(-1)!.source));
        })) : el("p", { class: "muted" }, "Nothing yet. The iPhone app syncs Apple Health daily when that's on; add entries by hand below."),
      manual),
    settings.vitals.photos ? await photosPanel() : null);
}

function manualForm() {
  const metric = el("select", {}, ...(["weight", "waist", "body_fat", "energy", "mood", "soreness", "sleep_hours"] as Metric[]).map((m) => el("option", { value: m }, `${METRICS[m].label} (${METRICS[m].unit})`)));
  const value = el("input", { type: "number", step: "0.1", inputmode: "decimal", placeholder: "Value" });
  const status = el("span", { class: "small" });
  const save = el("button", { class: "btn primary", type: "button" }, "Add");
  save.addEventListener("click", async () => {
    const r = await api("/api/vitals", { method: "POST", body: JSON.stringify([{ date: iso(new Date()), metric: metric.value, value: Number(value.value), source: "manual" }]) });
    status.textContent = r.ok ? "Saved." : (r.body as { error?: string }).error ?? "Couldn't save";
    if (r.ok) void render();
  });
  return el("div", { class: "row", style: "margin-top: 12px" }, metric, value, save, status);
}

async function photosPanel() {
  const r = await api<{ id: string; taken_on: string; note: string | null; url: string | null }[]>("/api/photos");
  const file = el("input", { type: "file", accept: "image/jpeg,image/png" });
  const status = el("span", { class: "small" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    const { data } = await (await import("./supabase.ts")).supabase.auth.getSession();
    const res = await fetch(`/api/photos?taken_on=${iso(new Date())}`, { method: "POST", headers: { "Content-Type": f.type, Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: f });
    status.textContent = res.ok ? "Uploaded." : "Couldn't upload.";
    if (res.ok) void render();
  });
  return el("section", { class: "panel" },
    el("h2", {}, "Progress photos"),
    el("p", { class: "small muted" }, "Private to you. Your agent sees the dates, and the photos only if you allow it in Settings."),
    el("div", { class: "row" }, file, status),
    el("div", { class: "photos", style: "margin-top: 12px" }, ...(r.ok ? r.body : []).map((p) => el("figure", { style: "margin: 0" },
      p.url ? el("img", { src: p.url, alt: `Progress photo ${p.taken_on}` }) : null,
      el("figcaption", { class: "small muted" }, p.taken_on, " ",
        el("button", { class: "link", type: "button", onclick: async () => { if (confirm("Delete this photo?")) { await api(`/api/photos/${p.id}`, { method: "DELETE" }); void render(); } } }, "Delete"))))));
}

fill(root, spinner());
render().catch((e) => fill(root, el("p", { class: "error" }, (e as Error).message)));
