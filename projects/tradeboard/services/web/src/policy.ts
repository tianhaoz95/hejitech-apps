// /policy — the policy in force as a readable table, its version history, and the editor. Saving makes
// a new version (history is never changed); executors pick it up between plans, never mid-flight.
import { POLICY_HELP, type Policy } from "@tradeboard/core";
import { api, chrome, confirmDialog, el, failure, toast, when } from "./ui.ts";

interface Row { policy_version: number; policy: Policy; created_at: string; created_by: string; note: string }

const root = document.getElementById("app")!;

const show = (v: unknown) => (v === null ? "null (any)" : Array.isArray(v) ? (v.length ? v.join(", ") : "none") : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

function table(p: Policy) {
  return el("div", { class: "scroll" }, el("table", { class: "grid" },
    el("thead", {}, el("tr", {}, el("th", {}, "Setting"), el("th", {}, "Value"), el("th", {}, "Meaning"))),
    el("tbody", {}, ...(Object.keys(POLICY_HELP) as (keyof Policy)[]).map((k) => el("tr", {}, el("td", { class: "mono" }, k), el("td", {}, el("strong", {}, show(p[k]))), el("td", { class: "muted" }, POLICY_HELP[k]))))));
}

async function load() {
  const r = await api<{ current: Row; history: Row[] }>("/api/policy");
  if (!r.ok) return;
  const cur = r.body.current;
  const editor = el("textarea", { class: "mono", style: "min-height: 360px", spellcheck: false, "aria-label": "Policy JSON" });
  const { policy_version: _v, ...editable } = cur.policy;
  editor.value = JSON.stringify(editable, null, 2);
  const note = el("input", { placeholder: "What changed and why" });
  const err = el("pre", { class: "block error", hidden: true });
  const save = el("button", {
    class: "btn primary", type: "button",
    onclick: async () => {
      let next: Policy;
      try {
        next = JSON.parse(editor.value);
      } catch (e) {
        err.textContent = `Not valid JSON: ${(e as Error).message}`;
        err.hidden = false;
        return;
      }
      const ok = await confirmDialog({ title: `Save as policy v${cur.policy_version + 1}?`, body: ["Executors switch to it before their next plan; a plan already in flight keeps the version it started with. If live mode is set up, you'll confirm the policy again on the Executor page."], confirm: "Save new version" });
      if (!ok) return;
      const res = await api<{ policy_version: number; changed: string[] }>("/api/policy", { body: { policy: next, note: note.value, confirm: true } });
      if (!res.ok) {
        err.textContent = failure(res);
        err.hidden = false;
        return;
      }
      toast(`Saved policy v${res.body.policy_version}${res.body.changed.length ? `: ${res.body.changed.join(", ")}` : ""}`);
      await load();
    },
  }, "Save new version");
  root.replaceChildren(
    el("h1", {}, "Policy"),
    el("p", { class: "muted" }, "The executor's deterministic rules: code checks every plan against them before anything reaches Robinhood. The defaults are starting points, not advice: review every value before live mode."),
    el("section", { class: "panel" }, el("h2", {}, `In force: v${cur.policy_version}`), el("p", { class: "small muted" }, `Saved `, when(cur.created_at), ` by ${cur.created_by === "system" ? "the board (defaults)" : "you"}${cur.note ? ` · ${cur.note}` : ""}`), table(cur.policy)),
    el("section", { class: "panel stack" }, el("h2", {}, "Edit"), el("p", { class: "small muted" }, "Approval is never optional (require_human_approval stays true), v1 buys only, and unknown settings are refused."), editor, note, err, el("div", { class: "row" }, save)),
    el("section", { class: "panel" }, el("h2", {}, "History"), el("ul", { class: "log" }, ...r.body.history.map((h) => el("li", {},
      el("div", { class: "row small" }, el("strong", {}, `v${h.policy_version}`), when(h.created_at), h.note ? el("span", { class: "muted" }, h.note) : null),
      el("details", {}, el("summary", { class: "small" }, "Show values"), el("pre", { class: "block" }, JSON.stringify(h.policy, null, 2))))))));
}

chrome();
void load();
