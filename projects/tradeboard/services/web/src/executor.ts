// /executor — the executor's state from its heartbeats, the owner's switches (pause, resume, kill,
// dry-run), the live-mode gate (§12.2, §15) and executor credentials.
import { api, chrome, confirmDialog, copyButton, el, every, failure, modeBadge, toast, when } from "./ui.ts";

interface Exec {
  executor_id: string; last_heartbeat_at: string; online: boolean; mode: string; paused: boolean; dry_run: boolean; policy_version: number | null; local_model_id: string | null;
  model_check_enabled: boolean; local_live_allowed: boolean; robinhood_connected: boolean; trade_approvals: string; account_mask: string | null; account_matches: boolean | null; last_error: string | null; version: string | null;
}
interface Status {
  control: { paused: boolean; killed: boolean; dry_run: boolean; live_gate_complete: boolean; live_trial_pending: boolean; approvals_mode: string | null; confirmed_account_mask: string | null; gate: { complete: boolean; items: { id: string; label: string; done: boolean; detail: string }[] } };
  executors: Exec[];
  policy: { policy_version: number; allow_live_without_model_check: boolean; first_live_order_max_usd: number };
  tokens: { id: string; executor_id: string; label: string; created_at: string; last_used_at: string | null }[];
  last_receipt: { plan_id: string; attempted_at: string; mode: string; outcome: string; reason_code: string | null; reason_text: string } | null;
  events: { event_id: number; actor_type: string; actor_id: string; action: string; details_json: Record<string, unknown>; at: string }[];
}

const root = document.getElementById("app")!;
let last: Status | null = null;

async function control(action: string, confirm = false) {
  const r = await api<{ control: Status["control"] }>("/api/control", { body: { action, confirm } });
  toast(r.ok ? `Done: ${action.replace("_", " ")}` : failure(r), !r.ok);
  await load();
}

function switches(s: Status) {
  const c = s.control;
  const buttons: Node[] = [];
  if (!c.paused && !c.killed) buttons.push(el("button", { class: "btn", type: "button", onclick: () => control("pause") }, "Pause"));
  if (c.paused || c.killed) buttons.push(el("button", { class: "btn primary", type: "button", onclick: () => control("resume") }, c.killed ? "Resume (un-kill)" : "Resume"));
  if (!c.killed) buttons.push(el("button", {
    class: "btn danger", type: "button",
    onclick: async () => {
      if (await confirmDialog({ title: "Kill the executor?", body: ["It stops claiming plans within one poll (≤ 30 s) and any plan it holds stops before the order is placed. An order already placed on Robinhood isn't cancelled. It stays stopped until you resume it."], confirm: "Kill", danger: true })) await control("kill", true);
    },
  }, "Kill"));
  if (c.dry_run) buttons.push(el("button", {
    class: "btn danger", type: "button", disabled: !c.gate.complete,
    onclick: async () => {
      const ok = await confirmDialog({
        title: "Turn dry-run off?",
        body: [
          el("p", {}, el("strong", {}, "Live orders will place real-money trades in your dedicated Robinhood account. You remain responsible for every trade.")),
          `The executor still needs your approval for every plan, its own checks, and its local live opt-in. The first live order must be a limit order of at most $${s.policy.first_live_order_max_usd}; if it fails, the board goes back to dry-run.`,
        ],
        confirm: "Go live", danger: true,
      });
      if (ok) await control("dry_run_off", true);
    },
  }, "Turn dry-run off"));
  else buttons.push(el("button", { class: "btn", type: "button", onclick: () => control("dry_run_on") }, "Back to dry-run"));
  return el("section", { class: "panel" },
    el("h2", {}, "Your switches"),
    el("div", { class: "row" }, el("span", { class: `badge ${c.killed || c.paused ? "off" : "on"}` }, c.killed ? "Killed" : c.paused ? "Paused" : "Running"), modeBadge(c.dry_run ? "dry_run" : "live"), c.live_trial_pending ? el("span", { class: "chip" }, "first live order: small limit only") : null),
    el("div", { class: "row", style: "margin-top: 10px" }, ...buttons),
    c.dry_run && !c.gate.complete ? el("p", { class: "small muted", style: "margin: 8px 0 0" }, "Dry-run can be turned off once the live-mode checklist below is complete.") : null);
}

function executors(s: Status) {
  if (!s.executors.length) return el("section", { class: "panel" }, el("h2", {}, "Executor"), el("p", { class: "muted" }, "No executor has reported in yet. Set one up with a credential below (see the README)."));
  return el("section", { class: "panel" }, el("h2", {}, "Executor"), ...s.executors.map((e) => el("div", { class: "stack", style: "margin-bottom: 10px" },
    el("div", { class: "row" }, el("strong", {}, e.executor_id), el("span", { class: `badge ${e.online ? "on" : "off"}` }, e.online ? "Online" : "Offline"), modeBadge(e.mode), e.paused ? el("span", { class: "badge off" }, "Paused") : null),
    !e.model_check_enabled && s.policy.allow_live_without_model_check ? el("div", { class: "banner block" }, el("strong", {}, "Live without the model check is allowed by policy (allow_live_without_model_check = true), and this executor's model check is off.")) : null,
    !e.model_check_enabled ? el("p", { class: "warn" }, "Model check is off on this executor: it stays in dry-run unless the policy allows live without it.") : null,
    el("dl", { class: "kv" },
      el("dt", {}, "Last seen"), el("dd", {}, when(e.last_heartbeat_at)),
      el("dt", {}, "Mode"), el("dd", {}, e.mode === "live" ? "live" : "dry-run", e.local_live_allowed ? "" : " (live not enabled on the machine)"),
      el("dt", {}, "Policy in force"), el("dd", {}, e.policy_version ? `v${e.policy_version}` : "none loaded"),
      el("dt", {}, "Local model"), el("dd", {}, e.local_model_id ?? "—", e.model_check_enabled ? "" : " · check off"),
      el("dt", {}, "Robinhood"), el("dd", {}, e.robinhood_connected ? "connected" : "not connected", e.account_mask ? ` · account ${e.account_mask}` : "", e.account_matches === false ? " · doesn't match the configured account" : ""),
      el("dt", {}, "Trade approvals"), el("dd", {}, e.trade_approvals === "unknown" ? "unknown (treated as Mode B: no fill claimed without a read-back)" : `Robinhood approvals ${e.trade_approvals}`),
      el("dt", {}, "Last error"), el("dd", { class: e.last_error ? "error" : "muted" }, e.last_error ?? "none"),
      el("dt", {}, "Version"), el("dd", {}, e.version ?? "—")))),
    s.last_receipt ? el("p", { class: "small" }, "Last receipt: ", el("a", { href: `/plans/${s.last_receipt.plan_id}` }, `${s.last_receipt.outcome} (${s.last_receipt.mode})`), " · ", when(s.last_receipt.attempted_at), s.last_receipt.reason_code ? ` · ${s.last_receipt.reason_code}` : "") : null);
}

function gate(s: Status) {
  const c = s.control;
  const ex = s.executors.find((e) => e.online) ?? s.executors[0];
  const mask = el("input", { name: "mask", value: c.confirmed_account_mask ?? ex?.account_mask ?? "", placeholder: "••••1234" });
  const funding = el("input", { name: "funding", inputmode: "decimal", placeholder: "e.g. 2000" });
  const modeA = el("input", { type: "radio", name: "mode", value: "A", checked: c.approvals_mode !== "B" });
  const modeB = el("input", { type: "radio", name: "mode", value: "B", checked: c.approvals_mode === "B" });
  const ack = el("input", { type: "checkbox", required: true });
  const form = el("form", { class: "stack" },
    el("label", {}, "Dedicated account (as the executor reports it)", mask, el("span", { class: "hint" }, ex?.account_mask ? `The executor reports ${ex.account_mask}. Only the last four digits ever reach the board.` : "Start the executor with Robinhood connected so it can report the account.")),
    el("label", {}, "Funding cap, USD", funding, el("span", { class: "hint" }, "The most you'll keep in the dedicated account. The system never moves money into it.")),
    el("fieldset", { class: "stack", style: "border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px" },
      el("legend", { class: "small" }, "Robinhood trade approvals"),
      el("label", { class: "check" }, modeA, el("span", {}, el("strong", {}, "Mode A (recommended): "), "approvals OFF in the Robinhood app for the agentic account. Your approval here is the gate; the executor's order places directly.")),
      el("label", { class: "check" }, modeB, el("span", {}, el("strong", {}, "Mode B: "), "approvals ON. The executor's order becomes a proposal you approve in the Robinhood app; mark the plan manually filled afterwards."))),
    el("label", { class: "check" }, ack, `I've reviewed policy v${s.policy.policy_version} (max per trade, drift, validity) and remain responsible for every trade.`),
    el("button", { class: "btn primary", type: "submit" }, "Confirm checklist"));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const r = await api<{ gate: Status["control"]["gate"] }>("/api/live-gate", { body: { account_mask: mask.value.trim(), funding_usd: Number(funding.value), approvals_mode: modeB.checked ? "B" : "A", policy_version: s.policy.policy_version, acknowledge: ack.checked } });
    toast(r.ok ? (r.body.gate.complete ? "Checklist complete" : "Saved; some items are still pending") : failure(r), !r.ok);
    await load();
  });
  return el("section", { class: "panel" },
    el("h2", {}, "Live-mode checklist"),
    el("p", { class: "muted small" }, "Decisions only you can make (PRD §12.2, §15). Each stays pending until confirmed; editing the policy re-opens the policy item."),
    el("ul", { class: "log" }, ...c.gate.items.map((i) => el("li", {}, el("div", { class: "row" }, el("span", { class: `badge ${i.done ? "on" : "off"}` }, i.done ? "Done" : "Pending"), el("strong", {}, i.label)), el("span", { class: "small muted" }, i.detail))),
      el("li", {}, el("div", { class: "row" }, el("span", { class: "badge on" }, "Done"), el("strong", {}, "Board hosting")), el("span", { class: "small muted" }, "Cloudflare Worker + the shared Supabase database")),
      el("li", {}, el("div", { class: "row" }, el("span", { class: `badge ${ex?.local_model_id ? "on" : "off"}` }, ex?.local_model_id ? "Reported" : "Pending"), el("strong", {}, "Local model and runtime")), el("span", { class: "small muted" }, ex?.local_model_id ?? "set in the executor's config"))),
    form);
}

function credentials(s: Status) {
  const id = el("input", { name: "executor_id", placeholder: "spark", value: "spark" });
  const out = el("div", {});
  const form = el("form", { class: "row" }, id, el("button", { class: "btn", type: "submit" }, "New executor credential"));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const r = await api<{ token: string; executor_id: string }>("/api/executor-tokens", { body: { executor_id: id.value.trim(), label: id.value.trim() } });
    if (!r.ok) return toast(failure(r), true);
    out.replaceChildren(el("div", { class: "banner note" }, el("p", {}, `Credential for ${r.body.executor_id}, shown once. Put it in the executor's config (`, el("code", {}, "tradeboard-executor setup"), ")."), el("pre", { class: "block" }, r.body.token), copyButton("Copy", () => r.body.token)));
    await load();
  });
  return el("section", { class: "panel" },
    el("h2", {}, "Executor credentials"),
    el("p", { class: "muted small" }, "A separate kind from agent tokens: it only reaches the executor's endpoints, never the MCP or this portal."),
    s.tokens.length ? el("ul", { class: "log" }, ...s.tokens.map((t) => el("li", {}, el("div", { class: "spread" }, el("span", {}, el("strong", {}, t.executor_id), " · issued ", when(t.created_at), " · last used ", when(t.last_used_at)),
      el("button", { class: "btn small danger", type: "button", onclick: async () => { if (await confirmDialog({ title: `Revoke ${t.executor_id}'s credential?`, body: ["That executor can no longer poll or post receipts."], confirm: "Revoke", danger: true })) { const r = await api(`/api/executor-tokens/${t.id}`, { method: "DELETE" }); toast(r.ok ? "Revoked" : failure(r), !r.ok); await load(); } } }, "Revoke"))))) : null,
    form, out);
}

function events(s: Status) {
  return el("section", { class: "panel" }, el("h2", {}, "Recent executor events"),
    el("ul", { class: "log" }, ...s.events.map((e) => el("li", {}, el("div", { class: "row small" }, el("strong", {}, e.action), e.actor_id, when(e.at)), Object.keys(e.details_json ?? {}).length ? el("span", { class: "small muted mono" }, JSON.stringify(e.details_json)) : null))));
}

const statusHost = el("div", {});
const gateHost = el("div", {});
const credHost = el("div", {});
let gateBuilt = false;

async function load() {
  const r = await api<Status>("/api/executor-status");
  if (!r.ok) return;
  last = r.body;
  statusHost.replaceChildren(switches(last), executors(last), events(last));
  // The checklist form and the credential panel are rebuilt only when nothing is being typed there.
  if (!gateBuilt || !gateHost.contains(document.activeElement)) { gateHost.replaceChildren(gate(last)); gateBuilt = true; }
  if (!credHost.contains(document.activeElement) && !credHost.querySelector(".banner")) credHost.replaceChildren(credentials(last));
}

chrome();
root.replaceChildren(el("h1", {}, "Executor"), statusHost, gateHost, credHost);
every(10_000, load);
