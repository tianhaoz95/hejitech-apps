// /settings: the commute (morning and evening legs), alerts, glasses pairing, iPhones, assistants
// and deleting Headway's data. Everything is saved through the Worker (checkSettings in @headway/core).
import { checkSettings, newLeg, STATIONS, type Leg, type Settings } from "@headway/core";
import { api, el, requireSession, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function stationSelect(value: string | null, allowNone: boolean) {
  const s = el("select", {});
  if (allowNone) s.append(el("option", { value: "" }, "—"));
  for (const st of STATIONS) s.append(el("option", { value: st.id }, st.name));
  s.value = value ?? "";
  return s;
}

const field = (label: string, input: HTMLElement, hint?: string) => el("label", { class: "field" }, el("span", {}, label), input, hint ? el("span", { class: "small" }, hint) : null);
const time = (v: string | null) => el("input", { type: "time", value: v ?? "" });
const num = (v: number, min: number, max: number) => el("input", { type: "number", min: String(min), max: String(max), value: String(v), inputmode: "numeric" });
const check = (label: string, on: boolean) => {
  const i = el("input", { type: "checkbox" });
  i.checked = on;
  return { input: i, node: el("label", { class: "check" }, i, label) };
};

function legEditor(part: "morning" | "evening", leg: Leg | null) {
  const from = stationSelect(leg?.from ?? null, true), to = stationSelect(leg?.to ?? null, true);
  const base = leg ?? newLeg("", "", part);
  const walk = num(base.walk_minutes, 0, 90), usual = time(base.usual), start = time(base.window.start), end = time(base.window.end);
  const node = el("div", { class: "panel leg" },
    el("h3", {}, part === "morning" ? "Morning" : "Evening"),
    el("div", { class: "fields" }, field("From", from), field("To", to)),
    el("div", { class: "fields" },
      field("Usual train at or after", usual, "Leave-now reminder for it"),
      field("Walk to the station (min)", walk),
      field("Watch from", start), field("until", end)));
  return {
    node,
    value(): Leg | null {
      if (!from.value && !to.value) return null;
      return { from: from.value, to: to.value, walk_minutes: Number(walk.value), usual: usual.value || null, window: { start: start.value, end: end.value } };
    },
  };
}

async function section(title: string, ...body: (Node | null)[]) {
  return el("section", { class: "panel" }, el("h2", {}, title), ...body);
}

async function render() {
  root.replaceChildren(spinner());
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<{ settings: Settings; saved: boolean; email: string | null }>("/api/settings");
  if (!r.ok) {
    root.replaceChildren(el("p", { class: "error" }, "Couldn't load your settings. Reload to try again."));
    return;
  }
  const s = r.body.settings;
  const morning = legEditor("morning", s.morning), evening = legEditor("evening", s.evening);
  const switchAt = time(s.switch_at);
  const dayBoxes = DAYS.map((d, i) => check(d, s.days.includes(i)));
  const a = s.alerts;
  const delay = check("A train is late by at least", a.delay), threshold = num(a.delay_threshold, 1, 60);
  const cancel = check("A train is cancelled", a.cancellation), service = check("Caltrain posts an alert for my stations", a.service);
  const leave = check("It's time to leave for my usual train", a.leave_now);
  const arrival = check("The train I'm tracking is this close to my stop:", a.arrival), arrivalMin = num(a.arrival_minutes, 1, 60);
  const status = el("p", { class: "small", role: "status" });
  const save = el("button", { class: "btn primary", type: "button" }, "Save");
  save.addEventListener("click", async () => {
    const next: Settings = {
      morning: morning.value(), evening: evening.value(), switch_at: switchAt.value,
      days: dayBoxes.flatMap((b, i) => (b.input.checked ? [i] : [])),
      alerts: {
        delay: delay.input.checked, delay_threshold: Number(threshold.value), cancellation: cancel.input.checked, service: service.input.checked,
        leave_now: leave.input.checked, arrival: arrival.input.checked, arrival_minutes: Number(arrivalMin.value),
      },
    };
    const issues = checkSettings(next);
    if (issues.length) {
      status.className = "small error";
      status.textContent = issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      return;
    }
    save.disabled = true;
    const res = await api("/api/settings", { method: "PUT", body: JSON.stringify({ settings: next }) });
    save.disabled = false;
    status.className = res.ok ? "small saved" : "small error";
    status.textContent = res.ok ? "Saved. Your glasses and iPhone pick it up on their next refresh." : "Couldn't save. Try again.";
  });

  root.replaceChildren(
    el("h1", {}, "Your commute"),
    el("p", { class: "muted" }, `Signed in as ${r.body.email ?? "you"}. Before the switch time the glasses open on your morning trains, after it on your evening ones.`),
    morning.node, evening.node,
    el("section", { class: "panel" },
      el("div", { class: "fields" }, field("Switch to evening at", switchAt)),
      el("p", { class: "small muted", style: "margin-top: 12px" }, "Commute alerts on"),
      el("div", { class: "days" }, ...dayBoxes.map((b) => b.node))),
    el("section", { class: "panel stack" },
      el("h2", {}, "Alert me on my iPhone when"),
      el("div", { class: "row" }, delay.node, threshold, el("span", { class: "small muted" }, "minutes")),
      cancel.node, service.node, leave.node,
      el("div", { class: "row" }, arrival.node, arrivalMin, el("span", { class: "small muted" }, "minutes")),
      el("p", { class: "small muted" }, "Commute alerts come only on the days above and inside each leg's watch window. The arrival alert follows the train you track, any time.")),
    el("div", { class: "row", style: "margin: 16px 0" }, save, status),
    await glassesPanel(), await phonesPanel(), await assistantsPanel(), dangerPanel());
}

async function glassesPanel() {
  const list = el("ul", { class: "list" });
  const codeBox = el("div", {});
  const refresh = async () => {
    const r = await api<{ id: string; label: string; created_at: string; last_used_at: string | null }[]>("/api/devices");
    list.replaceChildren(...(r.ok && r.body.length ? r.body.map((d) => el("li", {},
      el("span", {}, d.label, el("span", { class: "muted small" }, ` · paired ${new Date(d.created_at).toLocaleDateString()}${d.last_used_at ? `, last seen ${new Date(d.last_used_at).toLocaleString()}` : ""}`)),
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/devices/${d.id}`, { method: "DELETE" }); await refresh(); } }, "Unpair"))) : [el("li", { class: "muted" }, "No glasses paired.")]));
  };
  await refresh();
  const get = el("button", { class: "btn secondary", type: "button" }, "Get a pairing code");
  get.addEventListener("click", async () => {
    const r = await api<{ code: string; expires_at: string }>("/api/pairing-code", { method: "POST" });
    codeBox.replaceChildren(r.ok
      ? el("div", {}, el("p", { class: "code" }, r.body.code), el("p", { class: "muted small" }, `Type it on the Headway plugin page in the Even app. Valid until ${new Date(r.body.expires_at).toLocaleTimeString()}, once.`))
      : el("p", { class: "error" }, "Couldn't make a code."));
  });
  return section("Glasses", el("p", { class: "muted small" }, "Pair the Even G2 plugin to show your commute and track trains for your iPhone's arrival alert."), get, codeBox, list);
}

async function phonesPanel() {
  const r = await api<{ configured: boolean; devices: { id: string; label: string; environment: string; last_seen_at: string }[] }>("/api/push");
  const out = el("p", { class: "small" });
  const test = el("button", { class: "btn secondary", type: "button" }, "Send a test alert");
  test.addEventListener("click", async () => {
    const t = await api<{ results?: string[]; error?: string }>("/api/push/test", { method: "POST" });
    out.textContent = t.ok ? `Sent: ${(t.body.results ?? []).join(", ")}` : t.body.error ?? "Couldn't send.";
  });
  const devices = r.ok ? r.body.devices : [];
  return section("iPhone alerts",
    el("p", { class: "muted small" }, "Alerts go to every iPhone where you've signed in to the Headway app and allowed notifications."),
    el("ul", { class: "list" }, ...(devices.length ? devices.map((d) => el("li", {}, d.label, el("span", { class: "muted small" }, `last seen ${new Date(d.last_seen_at).toLocaleString()}`))) : [el("li", { class: "muted" }, "No iPhone yet: install Headway from the App Store / TestFlight and sign in.")])),
    r.ok && !r.body.configured ? el("p", { class: "warn small" }, "Alerts aren't switched on on the server yet.") : null,
    devices.length ? el("div", { class: "row", style: "margin-top: 10px" }, test, out) : null);
}

async function assistantsPanel() {
  const grants = el("ul", { class: "list" }), tokens = el("ul", { class: "list" }), fresh = el("div", {});
  const refresh = async () => {
    const [g, t] = await Promise.all([
      api<{ id: string; client_name: string | null; created_at: string }[]>("/api/grants"),
      api<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>("/api/tokens"),
    ]);
    grants.replaceChildren(...(g.ok && g.body.length ? g.body.map((x) => el("li", {}, x.client_name ?? "An assistant",
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/grants/${encodeURIComponent(x.id)}`, { method: "DELETE" }); await refresh(); } }, "Disconnect"))) : [el("li", { class: "muted" }, "No assistants connected.")]));
    tokens.replaceChildren(...(t.ok ? t.body.map((x) => el("li", {}, el("span", {}, x.name, el("span", { class: "muted small" }, x.last_used_at ? ` · used ${new Date(x.last_used_at).toLocaleString()}` : " · never used")),
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/tokens/${x.id}`, { method: "DELETE" }); await refresh(); } }, "Revoke"))) : []));
  };
  await refresh();
  const make = el("button", { class: "btn secondary", type: "button" }, "Make a personal token");
  make.addEventListener("click", async () => {
    const r = await api<{ token: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name: "Assistant" }) });
    if (r.ok) fresh.replaceChildren(el("p", { class: "small" }, "Copy it now; it isn't shown again:"), el("p", { class: "secret mono" }, r.body.token));
    await refresh();
  });
  return section("Assistants (MCP)",
    el("p", { class: "muted small" }, "Add ", el("code", {}, `${location.origin}/mcp`), " as a connector in Claude or another MCP client and sign in, or use a personal token as a Bearer token."),
    grants, el("div", { class: "row", style: "margin: 12px 0" }, make), fresh, tokens);
}

function dangerPanel() {
  const del = el("button", { class: "btn danger", type: "button" }, "Delete my Headway data");
  del.addEventListener("click", async () => {
    if (!confirm("Delete your commute, alerts, paired glasses, iPhones and assistant connections from Headway? Your Google sign-in stays.")) return;
    const r = await api("/api/account", { method: "DELETE" });
    if (r.ok) {
      await supabase.auth.signOut();
      location.href = "/";
    } else alert("Couldn't delete. Try again.");
  });
  return el("section", { class: "panel" }, el("h2", {}, "Delete"), el("p", { class: "muted small" }, "Removes everything Headway keeps about you, at once."), del);
}

render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
