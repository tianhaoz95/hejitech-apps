// /plan: the current plan (goals, what it planned around, targets, the week) and its versions with
// the agent's change notes.
import { setTarget, WEEKDAYS, type DayPlan, type PublishedPlan } from "@fitloop/core";
import { api, el, fill, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function dayView(name: string, d: DayPlan) {
  return el("details", { class: "item" },
    el("summary", {}, el("b", {}, name), ` · ${d.title}${d.workouts.length ? ` · ${d.workouts.length} workout${d.workouts.length > 1 ? "s" : ""}` : ""} · ${d.meals.length} meals`),
    ...d.workouts.map((w) => el("div", {},
      el("h3", {}, `${w.time ? w.time + " · " : ""}${w.title} (${w.duration_min} min, ${w.kind})`),
      el("ul", { class: "small" }, ...w.exercises.map((e) => el("li", {}, `${e.name}: ${e.sets} × ${setTarget(e)}, rest ${e.rest_sec}s`))))),
    ...d.meals.map((m) => el("p", { class: "small" }, el("b", {}, `${m.time ? m.time + " " : ""}${m.name}: `), m.items.map((i) => `${i.name} (${i.amount})`).join(", "), m.macros?.calories ? ` · ${m.macros.calories} kcal` : "")));
}

async function render() {
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<{ current: PublishedPlan | null; versions: { version: number; title: string; change_note: string; starts_on: string; published_at: string }[] }>("/api/plan");
  const cur = r.body.current;
  if (!r.ok || !cur) {
    fill(root, el("section", { class: "panel" }, el("h1", {}, "No plan yet"), el("p", { class: "muted" }, "Your agent publishes plans through FitLoop's MCP connector. Connect it in Settings, then ask it to build your plan."), el("a", { class: "btn primary", href: "/settings/" }, "Connect your agent")));
    return;
  }
  const p = cur.plan;
  const t = p.targets;
  fill(root, 
    el("h1", {}, p.title),
    el("p", { class: "muted" }, `Version ${cur.version} · from ${p.starts_on}${p.ends_on ? ` to ${p.ends_on}` : ""}`),
    el("section", { class: "panel" }, el("p", {}, p.summary), cur.change_note ? el("p", { class: "small reply" }, `What changed: ${cur.change_note}`) : null),
    el("section", { class: "panel" }, el("h2", {}, "Goals"), el("ul", {}, ...p.goals.map((g) => el("li", {}, g.text, g.target !== undefined ? el("span", { class: "muted small" }, ` (${g.metric ?? ""} ${g.target}${g.unit ? " " + g.unit : ""}${g.by ? " by " + g.by : ""})`) : null)))),
    p.constraints.length ? el("section", { class: "panel" }, el("h2", {}, "Planned around"), el("ul", {}, ...p.constraints.map((c) => el("li", {}, c)))) : null,
    t ? el("section", { class: "panel" }, el("h2", {}, "Daily targets"), el("p", {}, [t.calories && `${t.calories} kcal`, t.protein_g && `${t.protein_g} g protein`, t.carbs_g && `${t.carbs_g} g carbs`, t.fat_g && `${t.fat_g} g fat`, t.water_l && `${t.water_l} L water`].filter(Boolean).join(" · "))) : null,
    el("h2", { style: "margin-top: 18px" }, "The week"),
    el("div", { class: "stack" }, ...WEEKDAYS.map((d) => dayView(DAY_NAMES[d], p.week[d]))),
    p.overrides && Object.keys(p.overrides).length ? el("h2", { style: "margin-top: 18px" }, "Special days") : null,
    p.overrides ? el("div", { class: "stack" }, ...Object.entries(p.overrides).map(([d, day]) => dayView(d, day))) : null,
    el("h2", { style: "margin-top: 18px" }, "Versions"),
    el("ul", { class: "list" }, ...r.body.versions.map((v) => el("li", {}, el("span", {}, el("b", {}, `v${v.version} `), v.change_note || v.title), el("span", { class: "muted small" }, `from ${v.starts_on}`)))));
}

fill(root, spinner());
render().catch((e) => fill(root, el("p", { class: "error" }, (e as Error).message)));
