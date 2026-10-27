// /settings: the commute (morning and evening legs), alerts, glasses pairing, iPhones, assistants
// and deleting Headway's data. Everything is saved through the Worker (checkSettings in @headway/core).
import { checkSettings, newLeg, STATIONS, type Leg, type Settings } from "@headway/core";
import { api, el, requireSession, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const stationName = (id: string) => STATIONS.find((s) => s.id === id)?.name ?? "";

function stationSelect(value: string | null, allowNone: boolean) {
  const s = el("select", {});
  if (allowNone) s.append(el("option", { value: "" }, "Select station…"));
  for (const st of STATIONS) s.append(el("option", { value: st.id }, st.name));
  s.value = value ?? "";
  return s;
}

const field = (label: string, input: HTMLElement, hint?: string) =>
  el("label", { class: "field" }, el("span", {}, label), input, hint ? el("span", { class: "hint" }, hint) : null);
const time = (v: string | null) => el("input", { type: "time", value: v ?? "" });
const num = (v: number, min: number, max: number, cls = "") =>
  el("input", { type: "number", min: String(min), max: String(max), value: String(v), inputmode: "numeric", ...(cls ? { class: cls } : {}) });
const toggle = (on: boolean, ariaLabel: string) => {
  const i = el("input", { type: "checkbox", class: "switch", "aria-label": ariaLabel });
  i.checked = on;
  return i;
};

interface LegEditor {
  node: HTMLElement;
  getFrom(): string;
  getTo(): string;
  setStations(fromId: string, toId: string): void;
  value(): Leg | null;
}

function legEditor(part: "morning" | "evening", leg: Leg | null, onMirror?: () => void): LegEditor {
  const isMorning = part === "morning";
  const base = leg ?? newLeg("", "", part);
  const enabled = toggle(Boolean(leg && (leg.from || leg.to)), `Enable ${part} commute`);
  const from = stationSelect(leg?.from ?? null, true);
  const to = stationSelect(leg?.to ?? null, true);
  const walk = num(base.walk_minutes, 0, 90);
  const usual = time(base.usual);
  const start = time(base.window.start);
  const end = time(base.window.end);
  const routeBadge = el("span", { class: "badge" });

  const swapBtn = el("button", { class: "btn secondary swap", type: "button", title: "Swap stations", "aria-label": "Swap stations" }, "⇄");
  swapBtn.addEventListener("click", () => {
    const tmp = from.value;
    from.value = to.value;
    to.value = tmp;
    syncState();
  });

  const mirrorBtn = !isMorning && onMirror
    ? el("button", { class: "btn sm", type: "button", onclick: onMirror }, "Mirror morning ⇄")
    : null;

  const node = el("div", { class: "panel leg" },
    el("div", { class: "panel-header", style: "margin-bottom: 0" },
      el("div", { class: "panel-title-group" },
        el("h2", {}, isMorning ? "Morning commute" : "Evening commute"),
        routeBadge),
      el("div", { class: "row" }, mirrorBtn, enabled)),
    el("div", { class: "leg-body" },
      el("div", { class: "pair-form", style: "margin: 0" },
        field("From", from),
        swapBtn,
        field("To", to)),
      el("div", { class: "leg-subgrid" },
        el("div", { class: "subcard" },
          el("div", { class: "subcard-title" }, "Leave-now & walk"),
          el("div", { class: "subcard-fields" },
            field("Usual train at or after", usual),
            field("Walk to station (min)", walk)),
          el("p", { class: "subcard-hint" }, "Leave-now reminder fires your walk time before this train leaves.")),
        el("div", { class: "subcard" },
          el("div", { class: "subcard-title" }, "Alert watch window"),
          el("div", { class: "subcard-fields" },
            field("Watch from", start),
            field("Until", end)),
          el("p", { class: "subcard-hint" }, "Delay, cancellation and service alerts only send in this window.")))));

  function syncState() {
    const active = enabled.checked;
    node.classList.toggle("is-disabled", !active);
    if (!active) {
      routeBadge.className = "badge";
      routeBadge.textContent = "Off";
    } else if (from.value && to.value) {
      routeBadge.className = "badge accent";
      routeBadge.textContent = `${stationName(from.value)} → ${stationName(to.value)}`;
    } else {
      routeBadge.className = "badge";
      routeBadge.textContent = "Pick stations";
    }
  }

  enabled.addEventListener("change", () => {
    if (enabled.checked && !from.value && !to.value) {
      from.value = isMorning ? "mountain_view" : "san_francisco";
      to.value = isMorning ? "san_francisco" : "mountain_view";
    }
    syncState();
  });
  from.addEventListener("change", () => {
    if (from.value || to.value) enabled.checked = true;
    syncState();
  });
  to.addEventListener("change", () => {
    if (from.value || to.value) enabled.checked = true;
    syncState();
  });
  syncState();

  return {
    node,
    getFrom: () => from.value,
    getTo: () => to.value,
    setStations(fromId: string, toId: string) {
      from.value = fromId;
      to.value = toId;
      enabled.checked = Boolean(fromId || toId);
      syncState();
    },
    value(): Leg | null {
      if (!enabled.checked || (!from.value && !to.value)) return null;
      return {
        from: from.value,
        to: to.value,
        walk_minutes: Number(walk.value),
        usual: usual.value || null,
        window: { start: start.value, end: end.value },
      };
    },
  };
}

function settingRow(title: string, desc: string, sw: HTMLInputElement, extraControl?: HTMLElement) {
  return el("div", { class: "setting-row" },
    el("div", { class: "setting-info" },
      el("div", { class: "setting-title" }, title),
      el("div", { class: "setting-desc" }, desc)),
    el("div", { class: "setting-controls" }, extraControl ?? null, sw));
}

async function section(title: string, badgeText: string | null, ...body: (Node | null)[]) {
  return el("section", { class: "panel stack" },
    el("div", { class: "panel-header", style: "margin-bottom: 0" },
      el("h2", {}, title),
      badgeText ? el("span", { class: "badge" }, badgeText) : null),
    ...body);
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
  const morning = legEditor("morning", s.morning);
  const evening = legEditor("evening", s.evening, () => {
    const mf = morning.getFrom();
    const mt = morning.getTo();
    if (mf || mt) evening.setStations(mt, mf);
  });

  const switchAt = time(s.switch_at);
  const dayBoxes = DAYS.map((d, i) => {
    const input = el("input", { type: "checkbox" });
    input.checked = s.days.includes(i);
    return { input, node: el("label", {}, input, el("span", {}, d)) };
  });

  const a = s.alerts;
  const delaySw = toggle(a.delay, "Train delay alerts");
  const threshold = num(a.delay_threshold, 1, 60, "num-inline");
  const cancelSw = toggle(a.cancellation, "Train cancellation alerts");
  const serviceSw = toggle(a.service, "Caltrain station service alerts");
  const leaveSw = toggle(a.leave_now, "Leave-now reminder");
  const arrivalSw = toggle(a.arrival, "Arrival alert for tracked train");
  const arrivalMin = num(a.arrival_minutes, 1, 60, "num-inline");

  const status = el("p", { class: "small muted", role: "status" }, "Changes apply to your glasses and iPhone on save.");
  const save = el("button", { class: "btn primary", type: "button" }, "Save commute & alerts");

  save.addEventListener("click", async () => {
    const next: Settings = {
      morning: morning.value(),
      evening: evening.value(),
      switch_at: switchAt.value,
      days: dayBoxes.flatMap((b, i) => (b.input.checked ? [i] : [])),
      alerts: {
        delay: delaySw.checked,
        delay_threshold: Number(threshold.value),
        cancellation: cancelSw.checked,
        service: serviceSw.checked,
        leave_now: leaveSw.checked,
        arrival: arrivalSw.checked,
        arrival_minutes: Number(arrivalMin.value),
      },
    };
    const issues = checkSettings(next);
    if (issues.length) {
      status.className = "small error";
      status.textContent = issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      return;
    }
    save.disabled = true;
    save.textContent = "Saving…";
    const res = await api("/api/settings", { method: "PUT", body: JSON.stringify({ settings: next }) });
    save.disabled = false;
    save.textContent = "Save commute & alerts";
    status.className = res.ok ? "saved" : "small error";
    status.textContent = res.ok ? "Saved. Your glasses and iPhone pick it up on their next refresh." : "Couldn't save. Try again.";
  });

  const [glasses, phones, assistants] = await Promise.all([glassesPanel(), phonesPanel(), assistantsPanel()]);

  root.replaceChildren(
    el("div", { class: "page-head" },
      el("div", { class: "page-head-top" },
        el("h1", {}, "Your commute"),
        r.body.email ? el("span", { class: "badge" }, r.body.email) : null),
      el("p", { class: "muted" }, "Before the switch time your glasses and the app open on your morning trains; after it, on your evening ones.")),
    morning.node,
    evening.node,
    el("section", { class: "panel" },
      el("div", { class: "panel-header" },
        el("h2", {}, "Daily schedule"),
        el("span", { class: "badge" }, "Pacific Time")),
      el("div", { class: "schedule-grid" },
        field("Switch to evening at", switchAt, "Default direction flips after this time"),
        el("div", { class: "field" },
          el("span", {}, "Commute alerts active on"),
          el("div", { class: "days" }, ...dayBoxes.map((b) => b.node)),
          el("span", { class: "hint" }, "Tap days to toggle when commute alerts are sent")))),
    el("section", { class: "panel stack" },
      el("div", { class: "panel-header", style: "margin-bottom: 2px" },
        el("h2", {}, "Alert me on my iPhone when"),
        el("span", { class: "badge" }, "Push notifications")),
      el("div", { class: "setting-list" },
        settingRow(
          "Train delayed",
          "Notify when a train in your watch window is running late",
          delaySw,
          el("span", { class: "inline-stepper" }, threshold, el("span", {}, "min+"))),
        settingRow(
          "Train cancelled",
          "Notify immediately when a scheduled commute train is cancelled",
          cancelSw),
        settingRow(
          "Caltrain service alerts",
          "Station advisories affecting your origin or destination",
          serviceSw),
        settingRow(
          "Leave-now reminder",
          "Fires your walk time before your usual train's predicted departure",
          leaveSw),
        settingRow(
          "Approaching my stop",
          "Follows any train you track from the app, glasses or assistant",
          arrivalSw,
          el("span", { class: "inline-stepper" }, arrivalMin, el("span", {}, "min before")))),
      el("p", { class: "small muted" }, "Commute alerts come only on the active days above and inside each leg's watch window. The arrival alert follows the train you track, any day.")),
    el("div", { class: "save-bar" }, status, save),
    el("div", { class: "cards-grid" }, glasses, phones),
    assistants,
    dangerPanel());
}

async function glassesPanel() {
  const list = el("ul", { class: "list" });
  const codeBox = el("div", {});
  const refresh = async () => {
    const r = await api<{ id: string; label: string; created_at: string; last_used_at: string | null }[]>("/api/devices");
    list.replaceChildren(...(r.ok && r.body.length
      ? r.body.map((d) => el("li", {},
        el("div", { class: "setting-info" },
          el("span", { class: "setting-title" }, d.label),
          el("span", { class: "muted small" }, `Paired ${new Date(d.created_at).toLocaleDateString()}${d.last_used_at ? ` · seen ${new Date(d.last_used_at).toLocaleString()}` : ""}`)),
        el("button", { class: "btn sm danger", type: "button", onclick: async () => { await api(`/api/devices/${d.id}`, { method: "DELETE" }); await refresh(); } }, "Unpair")))
      : [el("li", { class: "empty-item" }, "No glasses paired yet.")]));
  };
  await refresh();
  const get = el("button", { class: "btn secondary", type: "button" }, "Get a pairing code");
  get.addEventListener("click", async () => {
    get.disabled = true;
    const r = await api<{ code: string; expires_at: string }>("/api/pairing-code", { method: "POST" });
    get.disabled = false;
    codeBox.replaceChildren(r.ok
      ? el("div", { class: "code-box" },
        el("p", { class: "code" }, r.body.code),
        el("p", { class: "muted small" }, `Enter on the Headway plugin page in the Even app · expires ${new Date(r.body.expires_at).toLocaleTimeString()}`))
      : el("p", { class: "error small" }, "Couldn't make a code."));
  });
  return section("Even G2 glasses", "R1 Ring",
    el("p", { class: "muted small" }, "Pair the Even G2 plugin to open directly on your commute and track trains for your iPhone's arrival alert."),
    list,
    codeBox,
    el("div", { class: "row" }, get));
}

async function phonesPanel() {
  const r = await api<{ configured: boolean; devices: { id: string; label: string; environment: string; last_seen_at: string }[] }>("/api/push");
  const out = el("span", { class: "small muted" });
  const test = el("button", { class: "btn secondary", type: "button" }, "Send test alert");
  test.addEventListener("click", async () => {
    test.disabled = true;
    const t = await api<{ results?: string[]; error?: string }>("/api/push/test", { method: "POST" });
    test.disabled = false;
    out.textContent = t.ok ? `Sent: ${(t.body.results ?? []).join(", ")}` : t.body.error ?? "Couldn't send.";
  });
  const devices = r.ok ? r.body.devices : [];
  return section("iPhone alerts", devices.length ? `${devices.length} connected` : "APNs",
    el("p", { class: "muted small" }, "Alerts go to every iPhone where you've signed in to the Headway app and allowed notifications."),
    el("ul", { class: "list" }, ...(devices.length
      ? devices.map((d) => el("li", {},
        el("span", { class: "setting-title" }, d.label),
        el("span", { class: "muted small" }, `Seen ${new Date(d.last_seen_at).toLocaleDateString()}`)))
      : [el("li", { class: "empty-item" }, "No iPhone registered yet — sign in on the Headway iOS app.")])),
    r.ok && !r.body.configured ? el("p", { class: "warn small" }, "Server APNs keys are not configured in this environment.") : null,
    devices.length ? el("div", { class: "row" }, test, out) : null);
}

async function assistantsPanel() {
  const grants = el("ul", { class: "list" }), tokens = el("ul", { class: "list" }), fresh = el("div", {});
  const refresh = async () => {
    const [g, t] = await Promise.all([
      api<{ id: string; client_name: string | null; created_at: string }[]>("/api/grants"),
      api<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>("/api/tokens"),
    ]);
    grants.replaceChildren(...(g.ok && g.body.length
      ? g.body.map((x) => el("li", {},
        el("span", { class: "setting-title" }, x.client_name ?? "An assistant"),
        el("button", { class: "btn sm danger", type: "button", onclick: async () => { await api(`/api/grants/${encodeURIComponent(x.id)}`, { method: "DELETE" }); await refresh(); } }, "Disconnect")))
      : [el("li", { class: "empty-item" }, "No assistants connected via OAuth.")]));
    tokens.replaceChildren(...(t.ok
      ? t.body.map((x) => el("li", {},
        el("div", { class: "setting-info" },
          el("span", { class: "setting-title" }, x.name),
          el("span", { class: "muted small" }, x.last_used_at ? `Last used ${new Date(x.last_used_at).toLocaleString()}` : "Never used")),
        el("button", { class: "btn sm danger", type: "button", onclick: async () => { await api(`/api/tokens/${x.id}`, { method: "DELETE" }); await refresh(); } }, "Revoke")))
      : []));
  };
  await refresh();

  const mcpUrl = `${location.origin}/mcp`;
  const copyMcp = el("button", { class: "btn sm", type: "button" }, "Copy URL");
  copyMcp.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(mcpUrl).catch(() => {});
    copyMcp.textContent = "Copied";
    setTimeout(() => (copyMcp.textContent = "Copy URL"), 1800);
  });

  const make = el("button", { class: "btn secondary", type: "button" }, "Create personal token");
  make.addEventListener("click", async () => {
    make.disabled = true;
    const r = await api<{ token: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name: "Assistant" }) });
    make.disabled = false;
    if (r.ok) {
      const copyTok = el("button", { class: "btn sm", type: "button" }, "Copy");
      copyTok.addEventListener("click", async () => {
        await navigator.clipboard?.writeText(r.body.token).catch(() => {});
        copyTok.textContent = "Copied";
      });
      fresh.replaceChildren(
        el("p", { class: "small muted", style: "margin-bottom: 6px" }, "Copy your personal token now — it won't be shown again:"),
        el("div", { class: "secret-box" }, el("code", { class: "secret mono", style: "border:0;background:none;padding:0" }, r.body.token), copyTok));
    }
    await refresh();
  });

  return section("Assistants (MCP)", "Claude · Cursor · Agents",
    el("p", { class: "muted small" }, "Connect Claude or any MCP client to check live Caltrain departures or start tracking your train."),
    el("div", { class: "secret-box" },
      el("span", { class: "mono small" }, mcpUrl),
      copyMcp),
    grants,
    tokens,
    fresh,
    el("div", { class: "row" }, make));
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
  return el("section", { class: "panel row-between" },
    el("div", { class: "setting-info" },
      el("h2", { style: "margin-bottom: 4px" }, "Delete account data"),
      el("p", { class: "muted small" }, "Immediately removes your saved commute, paired glasses, iPhones and assistant grants.")),
    del);
}

render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
