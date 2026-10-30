// /trades — every receipt (§8.1), filterable by outcome, ticker and mode; each links to its plan.
import { api, badge, chrome, el, every, modeBadge, when } from "./ui.ts";

interface Receipt {
  receipt_id: string; plan_id: string; version: number; title: string; ticker: string; is_demo: boolean; executor_id: string; attempted_at: string;
  mode: string; outcome: string; reason_code: string | null; reason_text: string; robinhood_order_id: string | null; filled_quantity: number | null; filled_price: number | null; policy_snapshot_id: number | null;
}

const root = document.getElementById("app")!;
const outcome = el("select", { "aria-label": "Outcome" }, el("option", { value: "" }, "All outcomes"), ...["executed", "simulated", "proposed", "rejected", "failed"].map((o) => el("option", { value: o }, o)));
const mode = el("select", { "aria-label": "Mode" }, el("option", { value: "" }, "All modes"), el("option", { value: "dry_run" }, "Dry-run"), el("option", { value: "live" }, "Live"), el("option", { value: "manual" }, "Manual"));
const ticker = el("input", { placeholder: "Ticker", "aria-label": "Ticker", autocapitalize: "characters" });
const body = el("div", {});

async function load() {
  const qs = new URLSearchParams();
  if (outcome.value) qs.set("outcome", outcome.value);
  if (mode.value) qs.set("mode", mode.value);
  if (ticker.value.trim()) qs.set("ticker", ticker.value.trim().toUpperCase());
  const r = await api<{ receipts: Receipt[] }>(`/api/trades?${qs}`);
  if (!r.ok) return;
  const rows = r.body.receipts;
  body.replaceChildren(rows.length ? el("ul", { class: "plans" }, ...rows.map((x) => el("li", {}, el("a", { href: `/plans/${x.plan_id}` }, el("div", { class: "panel" },
    el("div", { class: "spread" },
      el("span", { class: "title" }, el("span", { class: "ticker" }, x.ticker), x.title),
      el("span", { class: "row" }, modeBadge(x.mode), badge(x.outcome === "simulated" ? "executed" : x.outcome), x.outcome === "simulated" ? el("span", { class: "chip" }, "simulated") : x.outcome === "proposed" ? el("span", { class: "chip" }, "proposal") : null)),
    el("div", { class: "meta" },
      when(x.attempted_at),
      el("span", {}, `plan v${x.version}`),
      el("span", {}, x.mode === "manual" ? "placed by you" : `executor ${x.executor_id}`),
      x.robinhood_order_id ? el("span", { class: "mono" }, `order ${x.robinhood_order_id}`) : null,
      x.filled_quantity !== null ? el("span", {}, `filled ${x.filled_quantity} @ $${x.filled_price?.toFixed(2)}`) : null,
      x.policy_snapshot_id ? el("span", {}, `policy v${x.policy_snapshot_id}`) : null,
      x.is_demo ? el("span", { class: "badge demo" }, "DEMO") : null),
    x.reason_code || x.reason_text ? el("p", { class: "small", style: "margin: 6px 0 0" }, x.reason_code ? `${x.reason_code}: ` : "", x.reason_text) : null))))) : el("p", { class: "muted" }, "No receipts match."));
}

for (const c of [outcome, mode, ticker]) c.addEventListener("change", () => void load());
chrome();
root.replaceChildren(el("h1", {}, "Trades"), el("p", { class: "muted" }, "Every attempt the executor made (dry-run, live) and every fill you recorded yourself. Live order ids come from Robinhood's read-back; the full id is on the plan's receipt."), el("div", { class: "toolbar" }, outcome, mode, ticker), body);
every(10_000, load);
