// /settings: what your agent should know about you, every data option (on/off), what your agent
// may see, reminders (they ring on the iPhone), glasses, pairing, agents (MCP) and deleting data.
import { checkSettings, WEEKDAYS, type Settings } from "@fitloop/core";
import { api, el, requireSession, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;

const field = (label: string, input: HTMLElement, hint?: string) => el("label", { class: "field" }, el("span", {}, label), input, hint ? el("span", { class: "small" }, hint) : null);
function toggle(label: string, on: boolean, hint?: string) {
  const input = el("input", { type: "checkbox" });
  input.checked = on;
  return { input, node: el("label", { class: "check" }, input, el("span", {}, label, hint ? el("span", { class: "small muted" }, ` · ${hint}`) : null)) };
}
const section = (title: string, ...body: (Node | null)[]) => el("section", { class: "panel" }, el("h2", {}, title), ...body);

async function render() {
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<{ settings: Settings; saved: boolean; email: string | null }>("/api/settings");
  if (!r.ok) return void root.replaceChildren(el("p", { class: "error" }, "Couldn't load settings."));
  const s = r.body.settings;

  const about = Object.fromEntries((["goals", "restrictions", "equipment", "schedule", "diet", "notes"] as const).map((k) => [k, el("textarea", {}, s.about[k])])) as Record<keyof Settings["about"], HTMLTextAreaElement>;
  const v = {
    live_hr: toggle("Live heart rate in workouts", s.vitals.live_hr, "from your Apple Watch, shown on the glasses"),
    health_daily: toggle("Daily Apple Health summary", s.vitals.health_daily, "weight, resting HR, HRV, sleep, steps, active energy"),
    manual: toggle("Manual entries", s.vitals.manual, "weight, waist, energy, mood, soreness"),
    photos: toggle("Progress photos", s.vitals.photos, "private to you"),
  };
  const a = {
    checkins: toggle("Check-ins", s.agent_access.checkins),
    feedback: toggle("Feedback notes", s.agent_access.feedback),
    vitals: toggle("Vitals (the sources switched on above)", s.agent_access.vitals),
    photos: toggle("Progress photo images (otherwise dates only)", s.agent_access.photos),
  };
  const rw = toggle("Before a workout", s.reminders.workout.on), rwMin = el("input", { type: "number", min: "0", max: "180", value: String(s.reminders.workout.minutes_before) });
  const rm = toggle("At each meal", s.reminders.meals.on);
  const re = toggle("Evening check-in nudge", s.reminders.evening.on), reTime = el("input", { type: "time", value: s.reminders.evening.time });
  const rk = toggle("Weekly review for your agent", s.reminders.weekly.on), rkDay = el("select", {}, ...WEEKDAYS.map((d) => el("option", { value: d }, d))), rkTime = el("input", { type: "time", value: s.reminders.weekly.time });
  rkDay.value = s.reminders.weekly.weekday;
  const gHr = toggle("Show heart rate", s.glasses.show_hr), gRest = toggle("Start the rest timer when a set is done", s.glasses.auto_rest_timer);
  const units = el("select", {}, el("option", { value: "metric" }, "Metric (kg, cm)"), el("option", { value: "imperial" }, "Imperial (lb, in)"));
  units.value = s.units;
  const tz = el("input", { value: s.timezone });

  const status = el("p", { class: "small", role: "status" });
  const save = el("button", { class: "btn primary", type: "button" }, "Save");
  save.addEventListener("click", async () => {
    const next: Settings = {
      units: units.value as Settings["units"], timezone: tz.value.trim(),
      vitals: { live_hr: v.live_hr.input.checked, health_daily: v.health_daily.input.checked, manual: v.manual.input.checked, photos: v.photos.input.checked },
      agent_access: { checkins: a.checkins.input.checked, feedback: a.feedback.input.checked, vitals: a.vitals.input.checked, photos: a.photos.input.checked },
      reminders: {
        workout: { on: rw.input.checked, minutes_before: Number(rwMin.value) }, meals: { on: rm.input.checked },
        evening: { on: re.input.checked, time: reTime.value }, weekly: { on: rk.input.checked, weekday: rkDay.value as Settings["reminders"]["weekly"]["weekday"], time: rkTime.value },
      },
      glasses: { show_hr: gHr.input.checked, auto_rest_timer: gRest.input.checked },
      about: Object.fromEntries(Object.entries(about).map(([k, t]) => [k, t.value])) as Settings["about"],
    };
    const issues = checkSettings(next);
    if (issues.length) { status.className = "small error"; status.textContent = issues.map((i) => `${i.path}: ${i.message}`).join("; "); return; }
    const res = await api("/api/settings", { method: "PUT", body: JSON.stringify({ settings: next }) });
    status.className = res.ok ? "small saved" : "small error";
    status.textContent = res.ok ? "Saved." : "Couldn't save.";
  });

  root.replaceChildren(
    el("h1", {}, "Settings"),
    el("p", { class: "muted" }, `Signed in as ${r.body.email ?? "you"}. Every option is yours to switch; the defaults are a good start.`),
    section("About you (for your agent)",
      el("p", { class: "small muted" }, "Every agent you connect reads this first, and may add what it learns from you."),
      el("div", { class: "stack" }, field("Goals", about.goals), field("Injuries and limits", about.restrictions), field("Equipment", about.equipment), field("When you can train", about.schedule), field("Diet", about.diet), field("Anything else", about.notes))),
    section("Data FitLoop keeps", el("div", { class: "toggles" }, ...Object.values(v).map((t) => t.node))),
    section("What your agent may see", el("div", { class: "toggles" }, ...Object.values(a).map((t) => t.node))),
    section("Reminders",
      el("p", { class: "small muted" }, "They ring on your iPhone (and Watch), from the plan's times."),
      el("div", { class: "toggles" }, el("div", { class: "row" }, rw.node, rwMin, el("span", { class: "small muted" }, "minutes before")), rm.node, el("div", { class: "row" }, re.node, reTime), el("div", { class: "row" }, rk.node, rkDay, rkTime))),
    section("Glasses and units", el("div", { class: "toggles" }, gHr.node, gRest.node), el("div", { class: "fields", style: "margin-top: 10px" }, field("Units", units), field("Time zone", tz))),
    el("div", { class: "row", style: "margin: 16px 0" }, save, status),
    await glassesPanel(), await agentsPanel(), dangerPanel());
}

async function glassesPanel() {
  const list = el("ul", { class: "list" });
  const codeBox = el("div", {});
  const refresh = async () => {
    const r = await api<{ id: string; label: string; created_at: string; last_used_at: string | null }[]>("/api/devices");
    list.replaceChildren(...(r.ok && r.body.length ? r.body.map((d) => el("li", {},
      el("span", {}, d.label, el("span", { class: "muted small" }, d.last_used_at ? ` · last seen ${new Date(d.last_used_at).toLocaleString()}` : "")),
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/devices/${d.id}`, { method: "DELETE" }); await refresh(); } }, "Unpair"))) : [el("li", { class: "muted" }, "No glasses paired.")]));
  };
  await refresh();
  const get = el("button", { class: "btn secondary", type: "button" }, "Get a pairing code");
  get.addEventListener("click", async () => {
    const r = await api<{ code: string; expires_at: string }>("/api/pairing-code", { method: "POST" });
    codeBox.replaceChildren(r.ok ? el("div", {}, el("p", { class: "code" }, r.body.code), el("p", { class: "muted small" }, "Type it on the FitLoop plugin page in the Even app. Valid for ten minutes, once.")) : el("p", { class: "error" }, "Couldn't make a code."));
  });
  return section("Even G2 glasses", el("p", { class: "muted small" }, "Install FitLoop from the Even Hub, then pair it with a code."), get, codeBox, list);
}

async function agentsPanel() {
  const grants = el("ul", { class: "list" }), tokens = el("ul", { class: "list" }), fresh = el("div", {});
  const refresh = async () => {
    const [g, t] = await Promise.all([
      api<{ id: string; client_name: string | null }[]>("/api/grants"),
      api<{ id: string; name: string; last_used_at: string | null }[]>("/api/tokens"),
    ]);
    grants.replaceChildren(...(g.ok && g.body.length ? g.body.map((x) => el("li", {}, x.client_name ?? "An agent",
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/grants/${encodeURIComponent(x.id)}`, { method: "DELETE" }); await refresh(); } }, "Disconnect"))) : [el("li", { class: "muted" }, "No agents connected yet.")]));
    tokens.replaceChildren(...(t.ok ? t.body.map((x) => el("li", {}, el("span", {}, x.name, el("span", { class: "muted small" }, x.last_used_at ? ` · used ${new Date(x.last_used_at).toLocaleString()}` : " · never used")),
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/tokens/${x.id}`, { method: "DELETE" }); await refresh(); } }, "Revoke"))) : []));
  };
  await refresh();
  const make = el("button", { class: "btn secondary", type: "button" }, "Make a personal token");
  make.addEventListener("click", async () => {
    const r = await api<{ token: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name: "Agent" }) });
    if (r.ok) fresh.replaceChildren(el("p", { class: "small" }, "Copy it now; it isn't shown again:"), el("p", { class: "secret mono" }, r.body.token));
    await refresh();
  });
  return section("Agents (MCP)",
    el("p", { class: "muted small" }, "Add ", el("code", {}, `${location.origin}/mcp`), " as a custom connector in Claude (or any MCP client) and sign in. Agents that can't sign in use a personal token as a Bearer token."),
    grants, el("div", { class: "row", style: "margin: 12px 0" }, make), fresh, tokens);
}

function dangerPanel() {
  const del = el("button", { class: "btn danger", type: "button" }, "Delete my FitLoop data");
  del.addEventListener("click", async () => {
    if (!confirm("Delete your plans, check-ins, feedback, vitals, photos, paired glasses and agent connections from FitLoop? Your sign-in stays.")) return;
    const r = await api("/api/account", { method: "DELETE" });
    if (r.ok) { await supabase.auth.signOut(); location.href = "/"; } else alert("Couldn't delete. Try again.");
  });
  return section("Delete", el("p", { class: "muted small" }, "Removes everything FitLoop keeps about you, at once."), del);
}

root.replaceChildren(spinner());
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
