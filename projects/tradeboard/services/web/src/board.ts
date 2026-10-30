// / — the board list (§8.1): every plan, filterable, the ones that need the owner first.
import { STATUSES, STATUS_LABEL, type Status } from "@tradeboard/core";
import { api, badge, chrome, el, every, modeBadge, when, who } from "./ui.ts";

interface Row {
  plan_id: string; title: string; status: Status; ticker: string; is_demo: boolean; author: { type: string; id: string };
  current_version: number; updated_at: string; last_activity_at: string; valid_until: string; validity: string; expires_in_ms: number;
  open_questions: number; open_human_questions: number; awaiting_agents: string[]; reason_code: string | null; awaiting_manual: boolean;
}
interface Board {
  plans: Row[];
  control: { paused: boolean; killed: boolean; dry_run: boolean; live_gate_complete: boolean };
  executors: { executor_id: string; online: boolean; mode: string }[];
}

const root = document.getElementById("app")!;
const ACTIVE: Status[] = ["draft", "debated", "ready", "approved", "validated", "executing"];
const state = { status: "", ticker: "", attention: false };
try {
  Object.assign(state, JSON.parse(sessionStorage.getItem("board-filter") ?? "{}"));
} catch { /* private mode */ }

const live = (r: Row) => ACTIVE.includes(r.status);
const expiringSoon = (r: Row) => live(r) && r.expires_in_ms > 0 && r.expires_in_ms < 2 * 3_600_000;
/** "Needs my attention" (§8.1): my open questions, plans expiring within 2 h, plans ready for approval, Mode B proposals. */
const attention = (r: Row) => r.open_human_questions > 0 || expiringSoon(r) || r.status === "ready" || r.awaiting_manual;
/** Urgency first (expiring, questions, ready), then recency. */
const urgency = (r: Row) => (expiringSoon(r) ? 0 : r.open_human_questions > 0 ? 1 : r.status === "ready" ? 2 : r.awaiting_manual ? 2 : live(r) ? 3 : 4);

function rowView(r: Row) {
  const flags: (Node | string)[] = [];
  if (r.is_demo) flags.push(el("span", { class: "badge demo" }, "DEMO"));
  if (r.open_human_questions) flags.push(el("span", { class: "chip" }, `${r.open_human_questions} question${r.open_human_questions > 1 ? "s" : ""} from you`));
  else if (r.open_questions) flags.push(el("span", { class: "chip" }, `${r.open_questions} open question${r.open_questions > 1 ? "s" : ""}`));
  for (const a of r.awaiting_agents) flags.push(el("span", { class: "chip" }, `awaiting @${a}`));
  if (r.status === "ready") flags.push(el("span", { class: "chip" }, "ready for your approval"));
  if (r.awaiting_manual) flags.push(el("span", { class: "chip" }, "place it in the Robinhood app"));
  return el("li", {}, el("a", { href: `/plans/${r.plan_id}` }, el("div", { class: "panel" },
    el("div", { class: "spread" }, el("span", { class: "title" }, el("span", { class: "mono" }, r.ticker), " · ", r.title), badge(r.status)),
    el("div", { class: "meta" },
      el("span", { class: expiringSoon(r) ? "warn" : "" }, live(r) || r.status === "expired" ? r.validity : "closed"),
      el("span", {}, `v${r.current_version}`),
      el("span", {}, `by ${who(r.author.type, r.author.id)}`),
      el("span", {}, "edited ", when(r.updated_at))),
    flags.length ? el("div", { class: "row", style: "margin-top: 8px" }, ...flags) : null)));
}

function filters() {
  const status = el("select", { "aria-label": "Status" }, el("option", { value: "" }, "All statuses"), ...STATUSES.map((s) => el("option", { value: s }, STATUS_LABEL[s])));
  status.value = state.status;
  const ticker = el("input", { placeholder: "Ticker", value: state.ticker, "aria-label": "Ticker", autocapitalize: "characters" });
  const att = el("input", { type: "checkbox", checked: state.attention });
  const apply = () => {
    state.status = status.value;
    state.ticker = ticker.value.trim().toUpperCase();
    state.attention = att.checked;
    try { sessionStorage.setItem("board-filter", JSON.stringify(state)); } catch { /* ignore */ }
    void load();
  };
  status.addEventListener("change", apply);
  ticker.addEventListener("change", apply);
  att.addEventListener("change", apply);
  return el("div", { class: "toolbar" }, status, ticker, el("label", { class: "check" }, att, "Needs my attention"));
}

const list = el("ul", { class: "plans", "aria-live": "polite" });
const summary = el("div", {});

async function load() {
  const qs = new URLSearchParams();
  if (state.status) qs.set("status", state.status);
  if (state.ticker) qs.set("ticker", state.ticker);
  const r = await api<Board>(`/api/board?${qs}`);
  if (!r.ok) return;
  const rows = r.body.plans.filter((p) => !state.attention || attention(p)).sort((a, b) => urgency(a) - urgency(b) || b.last_activity_at.localeCompare(a.last_activity_at));
  list.replaceChildren(...(rows.length ? rows.map(rowView) : [el("li", { class: "muted" }, state.status || state.ticker || state.attention ? "No plans match." : "No plans yet. Agents create them over MCP; you can too.")]));
  const c = r.body.control;
  const online = r.body.executors.filter((e) => e.online);
  summary.replaceChildren(el("div", { class: "row small", style: "margin-bottom: 12px" },
    el("span", { class: `badge ${online.length ? "on" : "off"}` }, online.length ? `Executor online (${online.map((e) => e.executor_id).join(", ")})` : "Executor offline"),
    modeBadge(c.dry_run ? "dry_run" : "live"),
    c.killed ? el("span", { class: "badge off" }, "Killed") : c.paused ? el("span", { class: "badge off" }, "Paused") : null,
    el("a", { href: "/executor/" }, "Executor →")));
}

chrome();
root.replaceChildren(
  el("div", { class: "spread" }, el("h1", {}, "Board"), el("a", { class: "btn small", href: "/plan/?new=1" }, "New plan")),
  summary, filters(), list);
every(10_000, load);
