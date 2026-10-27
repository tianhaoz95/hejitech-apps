// /today: the day's plan with check-ins (sets, exercises, workouts, meals) and a note for the agent
// on any item. ?date=YYYY-MM-DD shows another day; the date is the browser's local date.
import { FEEDBACK_LABELS, FEEDBACK_TAGS, setTarget, type Checkin, type DayState, type MealState, type WorkoutState } from "@fitloop/core";
import { api, el, fill, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shift = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
let date = new URLSearchParams(location.search).get("date") ?? localToday();

interface Today {
  date: string;
  plan: { version: number; title: string; change_note: string; published_at: string } | null;
  state: DayState;
  live: { hr: number | null } | null;
}

async function checkin(c: Omit<Checkin, "plan_version">) {
  const r = await api("/api/checkins", { method: "POST", body: JSON.stringify(c) });
  if (!r.ok) alert((r.body as { error?: string }).error ?? "Couldn't save");
  await render();
}

function noteForm(ref: string | null, tags: readonly string[]) {
  const box = el("div", { class: "stack", hidden: true });
  const chosen = new Set<string>();
  const painWarn = el("p", { class: "small warn", hidden: true, style: "margin: 0" },
    "Stop if something hurts, you feel dizzy or have chest symptoms, and see a doctor or physio — your agent isn't a medical professional.");
  const chips = tags.map((t) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false" }, FEEDBACK_LABELS[t as keyof typeof FEEDBACK_LABELS]);
    b.addEventListener("click", () => {
      chosen.has(t) ? chosen.delete(t) : chosen.add(t);
      b.setAttribute("aria-pressed", String(chosen.has(t)));
      painWarn.hidden = !chosen.has("pain");
    });
    return b;
  });
  const text = el("textarea", { placeholder: "What should your agent know? (optional with a tag)" });
  const status = el("span", { class: "small muted" });
  const send = el("button", { class: "btn primary", type: "button" }, "Send to my agent");
  send.addEventListener("click", async () => {
    const r = await api("/api/feedback", { method: "POST", body: JSON.stringify({ date, ref, text: text.value, tags: [...chosen] }) });
    status.textContent = r.ok ? "Sent. Your agent sees it next time." : (r.body as { error?: string }).error ?? "Couldn't send";
    if (r.ok) { text.value = ""; chosen.clear(); painWarn.hidden = true; chips.forEach((c) => c.setAttribute("aria-pressed", "false")); }
  });
  box.append(el("div", { class: "row" }, ...chips), painWarn, text, el("div", { class: "row" }, send, status));
  const toggle = el("button", { class: "link", type: "button" }, "Note for my agent");
  toggle.addEventListener("click", () => (box.hidden = !box.hidden));
  return [toggle, box];
}

function workoutView(w: WorkoutState) {
  const x = w.workout;
  return el("li", { class: "item" },
    el("header", {},
      el("h3", {}, `${x.time ? x.time + " · " : ""}${x.title}`),
      el("span", { class: `status ${w.status}` }, w.status === "done" ? "Done" : w.status === "skipped" ? "Skipped" : `${w.setsDone}/${w.setsTotal} sets`)),
    x.notes ? el("p", { class: "small muted" }, x.notes) : null,
    el("div", {}, ...w.exercises.map((e) => {
      const ex = e.exercise;
      const sets = Array.from({ length: ex.sets }, (_, i) => {
        const n = i + 1;
        const b = el("button", { class: `set${n <= e.setsDone ? " done" : ""}`, type: "button", title: `Set ${n}` }, String(n));
        b.addEventListener("click", () => void checkin({ date, ref: `${e.ref}/${n}`, kind: "set", status: "done", data: typeof ex.reps === "number" ? { reps: ex.reps } : {} }));
        return b;
      });
      return el("div", { class: "ex" },
        el("div", { class: "row", style: "justify-content: space-between" },
          el("b", {}, ex.name), el("span", { class: "small muted" }, `${ex.sets} × ${setTarget(ex)} · rest ${ex.rest_sec}s`)),
        e.status === "skipped" || e.status === "swapped" ? el("span", { class: "status skipped" }, e.status) : el("div", { class: "sets" }, ...sets),
        ex.cues?.length ? el("p", { class: "small muted", style: "margin: 0" }, ex.cues.join(" · ")) : null,
        ex.instructions ? el("details", {}, el("summary", { class: "small" }, "How to"), el("p", { class: "small" }, ex.instructions)) : null,
        el("div", { class: "row" },
          el("button", { class: "link", type: "button", onclick: () => void checkin({ date, ref: e.ref, kind: "exercise", status: "skipped" }) }, "Skip"),
          el("button", { class: "link", type: "button", onclick: () => {
            const what = prompt(`What did you do instead of ${ex.name}?`, ex.alternative ?? "");
            if (what) void checkin({ date, ref: e.ref, kind: "exercise", status: "swapped", data: { swapped_for: what } });
          } }, "Swapped"),
          ...noteForm(e.ref, ["too_easy", "too_hard", "pain", "loved_it"])));
    })),
    el("div", { class: "row" },
      el("button", { class: "btn secondary", type: "button", onclick: () => void checkin({ date, ref: x.id, kind: "workout", status: w.setsDone >= w.setsTotal ? "done" : "partial" }) }, "Finish workout"),
      el("button", { class: "btn secondary", type: "button", onclick: () => void checkin({ date, ref: x.id, kind: "workout", status: "skipped" }) }, "Skip workout"),
      ...noteForm(x.id, ["too_easy", "too_hard", "no_time", "loved_it", "other"])));
}

function mealView(m: MealState) {
  const x = m.meal;
  const mac = x.macros;
  const act = (status: Checkin["status"], portion?: "less" | "as_planned" | "more") => () => {
    if (status === "swapped") {
      const what = prompt(`What did you eat instead of ${x.name}?`);
      if (!what) return;
      return void checkin({ date, ref: x.id, kind: "meal", status, data: { swapped_for: what } });
    }
    void checkin({ date, ref: x.id, kind: "meal", status, data: portion ? { portion } : undefined });
  };
  return el("li", { class: "item" },
    el("header", {}, el("h3", {}, `${x.time ? x.time + " · " : ""}${x.name}`), el("span", { class: `status ${m.status}` }, m.status === "todo" ? "To do" : m.portion && m.portion !== "as_planned" ? `${m.status} (${m.portion})` : m.status)),
    el("ul", { class: "small", style: "margin: 0" }, ...x.items.map((i) => el("li", {}, `${i.name}: ${i.amount}`))),
    mac ? el("p", { class: "small muted", style: "margin: 0" }, [mac.calories && `${mac.calories} kcal`, mac.protein_g && `${mac.protein_g} g protein`, mac.carbs_g && `${mac.carbs_g} g carbs`, mac.fat_g && `${mac.fat_g} g fat`].filter(Boolean).join(" · ")) : null,
    x.prep?.length ? el("details", {}, el("summary", { class: "small" }, "Prep"), el("ol", { class: "small" }, ...x.prep.map((p) => el("li", {}, p)))) : null,
    el("div", { class: "row" },
      el("button", { class: "btn primary", type: "button", onclick: act("done", "as_planned") }, "Ate it"),
      el("button", { class: "btn secondary", type: "button", onclick: act("done", "less") }, "Less"),
      el("button", { class: "btn secondary", type: "button", onclick: act("done", "more") }, "More"),
      el("button", { class: "btn secondary", type: "button", onclick: act("swapped") }, "Something else"),
      el("button", { class: "btn secondary", type: "button", onclick: act("skipped") }, "Skipped")),
    el("div", {}, ...noteForm(x.id, ["hungry", "too_much_food", "loved_it", "other"])));
}

async function render() {
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<Today>(`/api/today?date=${date}`);
  if (!r.ok) {
    fill(root, el("p", { class: "error" }, "Couldn't load today. Reload to try again."));
    return;
  }
  const t = r.body;
  const s = t.state;
  const nav = el("div", { class: "row", style: "justify-content: space-between; margin-bottom: 10px" },
    el("button", { class: "btn secondary", type: "button", onclick: () => { date = shift(date, -1); void render(); } }, "← Previous"),
    el("b", {}, new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })),
    el("button", { class: "btn secondary", type: "button", onclick: () => { date = shift(date, 1); void render(); } }, "Next →"));
  if (!t.plan || !s.day) {
    fill(root, nav, el("section", { class: "panel" },
      el("h1", {}, t.plan ? "Nothing planned" : "No plan yet"),
      el("p", { class: "muted" }, t.plan ? "Your plan has nothing on this day." : "Ask your agent to build one: connect it in Settings → Agents, then say \"make me a FitLoop plan\"."),
      el("a", { class: "btn primary", href: "/settings/" }, "Connect your agent")));
    return;
  }
  const n = s.nutrition;
  const pct = Math.round(s.completion * 100);
  fill(root, nav,
    el("section", { class: "panel" },
      el("div", { class: "row", style: "justify-content: space-between" }, el("h1", { style: "margin: 0" }, s.day.title), el("span", { class: "badge" }, `Plan v${t.plan.version}`)),
      el("div", { class: "bar", style: "margin: 10px 0" }, el("span", { style: `width: ${pct}%` })),
      el("p", { class: "small muted" }, `${pct}% done${n.targets.calories ? ` · ${n.eaten.calories ?? 0} of ${n.targets.calories} kcal` : ""}${n.targets.protein_g ? ` · ${n.eaten.protein_g ?? 0} of ${n.targets.protein_g} g protein` : ""}${t.live?.hr ? ` · ♥ ${t.live.hr}` : ""}`),
      s.day.notes ? el("p", {}, s.day.notes) : null,
      t.plan.change_note ? el("p", { class: "small reply" }, `From your agent: ${t.plan.change_note}`) : null),
    s.workouts.length ? el("h2", { style: "margin-top: 18px" }, "Workouts") : null,
    s.workouts.length ? el("ul", { class: "items" }, ...s.workouts.map(workoutView)) : null,
    s.meals.length ? el("h2", { style: "margin-top: 18px" }, "Meals") : null,
    s.meals.length ? el("ul", { class: "items" }, ...s.meals.map(mealView)) : null,
    el("section", { class: "panel", style: "margin-top: 18px" }, el("h2", {}, "About today"), ...noteForm(null, FEEDBACK_TAGS)));
}

fill(root, spinner());
render().catch((e) => fill(root, el("p", { class: "error" }, (e as Error).message)));
