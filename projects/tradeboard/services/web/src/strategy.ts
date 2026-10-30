// /strategy — the user's trading strategy document: write or edit it (each save is a version), adopt a
// draft an agent proposed after interviewing them, see which lines belong in the policy instead.
import { policyHints, type PolicyHint } from "@tradeboard/core";
import { api, chrome, confirmDialog, copyButton, el, failure, toast, when, who } from "./ui.ts";

interface Version { version: number; body: string; note: string; from_proposal: string | null; created_at: string }
interface Proposal { proposal_id: string; agent_id: string; body: string; summary: string; based_on_version: number | null; created_at: string; policy_hints: PolicyHint[] }
interface Data { current: (Version & { policy_hints: PolicyHint[] }) | null; history: Version[]; proposals: Proposal[]; template: string }

const root = document.getElementById("app")!;
const INTERVIEW_PROMPT = "Interview me to create my trading strategy on my Trading Plan Board (use its strategy interview guide), then propose the draft.";

let fromProposal: string | null = null;
const editor = el("textarea", { class: "mono", style: "min-height: 420px", spellcheck: true, "aria-label": "Strategy (Markdown)" });
const note = el("input", { placeholder: "What changed (optional)" });
const hintsBox = el("div", {});
const source = el("p", { class: "small muted" });

function hintsView(hints: PolicyHint[]) {
  if (!hints.length) return el("p", { class: "small muted" }, "No hard limits spotted. Limits you want enforced belong in the Policy.");
  return el("div", { class: "banner note" },
    el("h3", {}, "These read like hard limits: the strategy can't enforce them"),
    el("p", { class: "small" }, "Agents read the strategy as guidance. To have the executor refuse orders that break a rule, set it in the ", el("a", { href: "/policy/" }, "Policy"), "."),
    el("ul", {}, ...hints.map((h) => el("li", {}, `“${h.line}” → `, ...h.settings.flatMap((s, i) => [i ? ", " : "", el("code", {}, s)])))));
}

let hintTimer = 0;
editor.addEventListener("input", () => {
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => hintsBox.replaceChildren(hintsView(policyHints(editor.value))), 400);
});

function loadIntoEditor(text: string, label: string, proposalId: string | null) {
  editor.value = text;
  fromProposal = proposalId;
  source.textContent = label;
  hintsBox.replaceChildren(hintsView(policyHints(text)));
  editor.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function save() {
  const r = await api<{ version: number }>("/api/strategy", { body: { body: editor.value, note: note.value, from_proposal: fromProposal ?? undefined } });
  if (!r.ok) return toast(failure(r), true);
  toast(`Saved strategy v${r.body.version}. Agents read it from their next call.`);
  fromProposal = null;
  note.value = "";
  await load();
}

function proposalsView(d: Data) {
  return d.proposals.map((p) => el("div", { class: "banner good" },
    el("h3", {}, `${who("agent", p.agent_id)} drafted a strategy for you`),
    el("p", { class: "small" }, p.summary || "From your interview.", " · ", when(p.created_at), p.based_on_version ? ` · based on v${p.based_on_version}` : ""),
    el("p", { class: "small muted" }, "It does nothing until you adopt it. Review it in the editor, change anything, then save."),
    el("div", { class: "row" },
      el("button", { class: "btn primary", type: "button", onclick: () => loadIntoEditor(p.body, `Draft by ${who("agent", p.agent_id)}: saving adopts it.`, p.proposal_id) }, "Review in editor"),
      el("button", {
        class: "btn", type: "button",
        onclick: async () => {
          if (!(await confirmDialog({ title: "Dismiss this draft?", body: ["The agent's draft is set aside; nothing on your board changes."], confirm: "Dismiss" }))) return;
          const r = await api(`/api/strategy/proposals/${p.proposal_id}/dismiss`, { body: {} });
          toast(r.ok ? "Dismissed" : failure(r), !r.ok);
          await load();
        },
      }, "Dismiss"))));
}

async function load() {
  const r = await api<Data>("/api/strategy");
  if (!r.ok) return;
  const d = r.body;
  if (!editor.value || !fromProposal) loadIntoEditor(d.current?.body ?? d.template, d.current ? `Editing v${d.current.version}.` : "Starting from the template.", null);
  const intro = d.current
    ? el("p", { class: "muted" }, `Version ${d.current.version}, saved `, when(d.current.created_at), ". Every agent on your board reads it before drafting or debating a plan, and says how each plan fits it.")
    : el("div", { class: "panel stack" },
        el("h2", {}, "You don't have a strategy yet"),
        el("p", {}, "A strategy is your trading philosophy in your own words: goals, horizon, what you buy and avoid, sizing, entries, exits, temperament. Agents argue from it, so their plans start from how you think."),
        el("p", {}, "Easiest: ask one of your connected agents to interview you (about 10 minutes). It drafts the document and proposes it here for you to adopt."),
        el("div", { class: "row" }, el("code", {}, INTERVIEW_PROMPT), copyButton("Copy prompt", () => INTERVIEW_PROMPT)),
        el("p", { class: "small muted" }, "Or write it yourself below, starting from the template."));
  root.replaceChildren(
    el("h1", {}, "Strategy"),
    ...proposalsView(d),
    intro,
    el("section", { class: "panel stack" },
      el("h2", {}, d.current ? "Edit" : "Write it"),
      source, editor, note,
      el("div", { class: "row" }, el("button", { class: "btn primary", type: "button", onclick: save }, fromProposal ? "Adopt as my strategy" : "Save new version"),
        d.current ? el("button", { class: "btn", type: "button", onclick: () => loadIntoEditor(d.current!.body, `Editing v${d.current!.version}.`, null) }, "Discard changes") : null),
      hintsBox,
      el("p", { class: "small muted" }, "Guidance for agents, not rules: nothing here blocks an order. The Policy is what the executor enforces.")),
    d.history.length ? el("section", { class: "panel" }, el("h2", {}, "History"), el("ul", { class: "log" }, ...d.history.map((h) => el("li", {},
      el("div", { class: "row small" }, el("strong", {}, `v${h.version}`), when(h.created_at), h.from_proposal ? el("span", { class: "chip" }, "adopted from an agent's draft") : null, h.note ? el("span", { class: "muted" }, h.note) : null),
      el("details", {}, el("summary", { class: "small" }, "Show"), el("pre", { class: "block" }, h.body)))))) : "");
}

chrome();
void load();
