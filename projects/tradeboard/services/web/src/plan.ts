// /plans/<id> — the collaborative plan document (§8.1), and /plan/?new=1 to write one. Top to bottom:
// header, order ticket, validity + quote, open-question banner, the owner's actions, the document
// sections with their comments, the thread and composer, then versions, receipts and the decision log.
// Refreshes every 5 s without touching what the owner is typing.
import { ANCHORS, describeTicket, ptEt, type OrderTicket, type Status } from "@tradeboard/core";
import { api, badge, chrome, confirmDialog, copyButton, el, every, failure, modeBadge, spinner, toast, when, who } from "./ui.ts";

interface Comment {
  comment_id: string; version: number; author_type: string; author_id: string; body: string; anchor: string; parent_comment_id: string | null;
  mentioned_agent_id: string | null; created_at: string; is_question: boolean; status?: "open" | "resolved"; resolved_at?: string | null; resolution_note?: string | null;
}
interface Receipt {
  receipt_id: string; version: number; executor_id: string; attempted_at: string; mode: string; outcome: string; reason_code: string | null; reason_text: string;
  robinhood_order_id: string | null; filled_quantity: number | null; filled_price: number | null; policy_snapshot_id: number | null;
  strategy_fit: { fit: string; note: string; strategy_version: number } | null;
}
interface Plan {
  plan_id: string; title: string; status: Status; is_demo: boolean; ticker: string; order: OrderTicket; thesis: string; evidence: string; risks_and_dissent: string; invalidation: string;
  fit_with_strategy: string; strategy_version: number | null; current_strategy_version: number | null;
  created_at: string; updated_at: string; last_activity_at: string; created_by: { type: string; id: string }; valid_from: string | null; valid_until: string; validity: string;
  quote_at: string | null; quote_price: number | null; quote_source: string | null; current_version: number; reason_code: string | null; reason_text: string | null; awaiting_manual: boolean;
  approval: { approval_id: string; version: number; approved_at: string; expires_at: string; note: string } | null;
  executor_claim: { executor_id: string; expires_at: string } | null;
  open_questions: { question_id: string; body: string; asked_by: string; asked_by_type: string; asked_at: string; blocking: boolean; awaiting: string | null; anchor: string }[];
  comments: Comment[];
  approvals: { approval_id: string; version: number; approved_at: string; expires_at: string; voided_at: string | null; void_reason: string | null; note: string }[];
  versions: { version: number; edited_by_type: string; edited_by_id: string; edited_at: string; diff_summary: string; current: boolean }[];
  decision_log: { event_id: number; actor_type: string; actor_id: string; action: string; details: Record<string, unknown>; at: string }[];
  receipts: Receipt[];
  policy: { policy_version: number; max_drift_pct: number; approval_ttl: string; max_plan_age_hours: number };
}

const root = document.getElementById("app")!;
const planId = location.pathname.match(/^\/plans\/([0-9a-f-]{36})/)?.[1] ?? null;
let plan: Plan | null = null;
let agents: string[] = [];
let editing = false;
let replyTo: Comment | null = null;

const SECTIONS: [keyof Plan & string, string][] = [["thesis", "Thesis"], ["evidence", "Evidence"], ["risks_and_dissent", "Risks & dissent"], ["invalidation", "Invalidation"], ["fit_with_strategy", "Fit with strategy"]];
const ANCHOR_LABEL: Record<string, string> = { thesis: "Thesis", evidence: "Evidence", risks_and_dissent: "Risks & dissent", invalidation: "Invalidation", fit_with_strategy: "Fit with strategy", order: "Order ticket", general: "General" };

/** Which strategy version the plan was written against, next to the user's current one. */
function strategyBadge(p: Plan): HTMLElement | null {
  if (p.current_strategy_version === null) return el("a", { class: "chip", href: "/strategy/" }, "no strategy yet");
  if (p.strategy_version === null) return el("a", { class: "chip", href: "/strategy/" }, `written before your strategy (now v${p.current_strategy_version})`);
  if (p.strategy_version < p.current_strategy_version) return el("a", { class: "chip", href: "/strategy/" }, `written against strategy v${p.strategy_version} (now v${p.current_strategy_version})`);
  return el("a", { class: "chip", href: "/strategy/" }, `strategy v${p.strategy_version}`);
}

// ---------------------------------------------------------------- pieces

const doc = el("div", { class: "doc" });
const composer = el("form", { class: "panel stack", "aria-label": "Comment or ask" });
const editHost = el("div", {});
const histHost = el("div", {});

function ticketText(p: Plan) {
  return `${describeTicket(p.order)} — dedicated MCP account only (plan ${p.plan_id.slice(0, 8)}, v${p.current_version})`;
}

function header(p: Plan) {
  return el("header", { class: "panel" },
    el("div", { class: "row" }, badge(p.status), p.is_demo ? el("span", { class: "badge demo" }, "DEMO · dry-run only") : null, el("span", { class: "chip" }, `version ${p.current_version}`), el("span", { class: "chip" }, p.validity), strategyBadge(p)),
    el("h1", { style: "margin-top: 8px" }, el("span", { class: "mono" }, p.ticker), " · ", p.title),
    p.reason_code ? el("p", { class: ["rejected", "failed", "stale", "expired"].includes(p.status) ? "error" : "muted" }, `${p.reason_code}: ${p.reason_text ?? ""}`) : null,
    p.awaiting_manual ? el("p", { class: "warn" }, "Robinhood made this a proposal (trade approvals are on). Place it in the Robinhood app, then mark it manually filled here.") : null,
    el("dl", { class: "kv" },
      el("dt", {}, "Created"), el("dd", {}, when(p.created_at), ` by ${who(p.created_by.type, p.created_by.id)}`),
      el("dt", {}, "Last edited"), el("dd", {}, when(p.updated_at))));
}

function ticketCard(p: Plan) {
  const t = p.order;
  return el("section", { class: "ticket", "aria-label": "Order ticket" },
    el("div", { class: "spread" }, el("h2", {}, "Order ticket"), copyButton("Copy ticket", () => ticketText(p))),
    el("div", { class: "line" }, describeTicket(t)),
    el("dl", { class: "kv" },
      el("dt", {}, "Side"), el("dd", {}, t.side),
      el("dt", {}, "Type"), el("dd", {}, t.order_type),
      el("dt", {}, "Quantity"), el("dd", {}, t.quantity_shares !== null ? `${t.quantity_shares} shares` : `$${t.quantity_dollars?.toFixed(2)}`),
      t.limit_price !== null ? [el("dt", {}, "Limit price"), el("dd", {}, `$${t.limit_price.toFixed(2)}`)] : null,
      t.stop_price ? [el("dt", {}, "Stop price"), el("dd", {}, `$${t.stop_price.toFixed(2)}`)] : null,
      el("dt", {}, "Time in force"), el("dd", {}, t.time_in_force),
      el("dt", {}, "Account"), el("dd", {}, "dedicated MCP account only")),
    anchorLink("order", p));
}

function validityStrip(p: Plan) {
  const executed = [...p.receipts].reverse().find((r) => r.outcome === "executed" || r.outcome === "simulated");
  return el("section", { class: "panel", "aria-label": "Validity and quote" },
    el("h2", {}, "Validity and quote"),
    el("dl", { class: "kv" },
      el("dt", {}, "Valid from"), el("dd", {}, p.valid_from ? when(p.valid_from) : "now"),
      el("dt", {}, "Valid until"), el("dd", {}, when(p.valid_until), el("span", { class: "muted" }, ` (${p.validity})`)),
      el("dt", {}, "Quote snapshot"), el("dd", {}, p.quote_price !== null ? `$${p.quote_price.toFixed(2)} at ` : "none", p.quote_price !== null ? when(p.quote_at) : null, p.quote_source ? el("span", { class: "muted" }, ` · ${p.quote_source}`) : null),
      el("dt", {}, "Approved"), el("dd", {}, p.approval ? [when(p.approval.approved_at), el("span", { class: "muted" }, " · expires "), when(p.approval.expires_at)] : "not approved"),
      el("dt", {}, "Executed"), el("dd", {}, executed ? [when(executed.attempted_at), " ", modeBadge(executed.mode)] : "—")),
    el("p", { class: "small muted", style: "margin-top: 8px" }, `The executor re-quotes on Robinhood right before any order and aborts if the price moved more than ${p.policy.max_drift_pct}% (policy v${p.policy.policy_version}). It never chases the price.`));
}

function questionBanner(p: Plan) {
  const blocking = p.open_questions.filter((q) => q.blocking);
  if (!blocking.length) return null;
  return el("div", { class: "banner block", role: "alert" },
    el("h3", {}, `Your ${blocking.length === 1 ? "question is" : `${blocking.length} questions are`} open: approval is blocked`),
    el("ul", {}, ...blocking.map((q) => el("li", {}, el("a", { href: `#c-${q.question_id}` }, q.body.length > 140 ? `${q.body.slice(0, 137)}…` : q.body), q.awaiting ? el("span", { class: "chip" }, ` awaiting @${q.awaiting}`) : null))),
    el("p", { class: "small", style: "margin: 6px 0 0" }, "Resolve each one in the thread when you're satisfied."));
}

function approveBlockers(p: Plan): string[] {
  const out: string[] = [];
  if (p.status !== "ready") out.push(p.status === "approved" ? "Already approved." : `Only a Ready plan can be approved (this one is ${p.status}).`);
  if (p.open_questions.some((q) => q.blocking)) out.push("You have open questions on it.");
  if (new Date(p.valid_until) <= new Date()) out.push("Its validity window has passed.");
  return out;
}

async function act(path: string, body: unknown, ok: (b: Record<string, unknown>) => string) {
  const r = await api<Record<string, unknown>>(`/api/plans/${planId}/${path}`, { body });
  if (r.ok) toast(ok(r.body));
  else toast(failure(r), true);
  await load(true);
  return r.ok;
}

function actions(p: Plan) {
  const blockers = approveBlockers(p);
  const closed = ["executed", "failed", "cancelled"].includes(p.status);
  const approve = el("button", {
    class: "btn primary", type: "button", disabled: blockers.length > 0, "aria-describedby": "approve-why",
    onclick: async () => {
      const f = await confirmDialog({
        title: `Approve version ${p.current_version}?`,
        body: [el("p", { class: "mono" }, describeTicket(p.order)),
          `The executor may place this order until the approval expires (${p.policy.approval_ttl === "until_market_close_et" ? "the next market close" : p.policy.approval_ttl}) or ${ptEt(p.valid_until)}, whichever is first, after its own checks. Any edit or new question voids it.`],
        confirm: "Approve",
        extra: el("label", {}, "Note (optional)", el("input", { name: "note" })),
      });
      if (f) await act("approve", { version: p.current_version, note: (f.elements.namedItem("note") as HTMLInputElement).value }, (b) => `Approved version ${b.version} · expires ${ptEt(String(b.expires_at))}`);
    },
  }, "Approve");
  const buttons: (Node | null)[] = [approve];
  if (p.status === "debated") buttons.push(el("button", { class: "btn", type: "button", onclick: () => act("ready", {}, () => "Marked ready") }, "Mark ready"));
  if (!closed && p.status !== "executing") buttons.push(el("button", { class: "btn", type: "button", onclick: () => { editing = true; render(); editHost.scrollIntoView({ behavior: "smooth" }); } }, "Edit plan"));
  if (!closed && p.status !== "rejected" && (p.status !== "executing" || p.awaiting_manual)) buttons.push(el("button", {
    class: "btn danger", type: "button",
    onclick: async () => {
      const f = await confirmDialog({ title: "Reject this plan?", body: ["It stays on the board with your reason; a new version can reopen it."], confirm: "Reject", danger: true, extra: el("label", {}, "Reason", el("input", { name: "reason", required: true })) });
      if (f) await act("reject", { reason: (f.elements.namedItem("reason") as HTMLInputElement).value }, () => "Rejected");
    },
  }, "Reject"));
  if (!closed && (!["validated", "executing"].includes(p.status) || p.awaiting_manual)) buttons.push(el("button", {
    class: "btn", type: "button",
    onclick: async () => {
      const f = await confirmDialog({
        title: "Mark manually filled",
        body: ["Use this when you placed the order yourself in Robinhood from this ticket. It records a manual receipt (no executor order id) and closes the plan."],
        confirm: "Record fill",
        extra: el("div", { class: "fields" }, el("label", {}, "Filled shares", el("input", { name: "qty", inputmode: "decimal" })), el("label", {}, "Fill price", el("input", { name: "price", inputmode: "decimal" })), el("label", {}, "Note", el("input", { name: "note" }))),
      });
      if (f) {
        const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim();
        await act("manual-fill", { filled_quantity: v("qty") || undefined, filled_price: v("price") || undefined, note: v("note") || undefined }, () => "Recorded as manually filled");
      }
    },
  }, "Mark manually filled"));
  if (!closed && (p.status !== "executing" || p.awaiting_manual)) buttons.push(el("button", {
    class: "btn danger", type: "button",
    onclick: async () => {
      const f = await confirmDialog({ title: "Cancel this plan?", body: ["Cancelled is final: the plan stays in the history but can't be edited or executed."], confirm: "Cancel plan", danger: true, extra: el("label", {}, "Reason (optional)", el("input", { name: "reason" })) });
      if (f) await act("cancel", { reason: (f.elements.namedItem("reason") as HTMLInputElement).value }, () => "Cancelled");
    },
  }, "Cancel plan"));
  return el("section", { class: "panel", "aria-label": "Your actions" },
    el("h2", {}, "Your actions"),
    el("div", { class: "row" }, ...buttons, copyButton("Copy ticket", () => ticketText(p))),
    el("p", { id: "approve-why", class: blockers.length ? "small warn" : "small muted", style: "margin: 8px 0 0" },
      blockers.length ? `Approve is unavailable: ${blockers.join(" ")}` : `Approving authorises version ${p.current_version} only.`));
}

function anchorLink(anchor: string, p: Plan) {
  const n = p.comments.filter((c) => c.anchor === anchor).length;
  return el("button", { class: "link small", type: "button", onclick: () => { setAnchor(anchor); (composer.elements.namedItem("body") as HTMLTextAreaElement).focus(); } },
    n ? `${n} comment${n > 1 ? "s" : ""} · comment here` : "Comment on this");
}

function sections(p: Plan) {
  return SECTIONS.map(([k, label]) => el("section", { class: "panel", id: `s-${k}` },
    el("h2", {}, label, anchorLink(k, p)),
    (p[k] as string) ? el("div", { class: "prose" }, p[k] as string) : el("p", { class: "muted" }, "Empty."),
    ...p.comments.filter((c) => c.anchor === k && !c.parent_comment_id).map((c) => el("p", { class: "small muted", style: "margin: 8px 0 0" }, `${who(c.author_type, c.author_id)}: `, el("a", { href: `#c-${c.comment_id}` }, c.body.slice(0, 120))))));
}

function commentView(c: Comment, all: Comment[], p: Plan): HTMLElement {
  const replies = all.filter((r) => r.parent_comment_id === c.comment_id);
  const head = el("div", { class: "row small" },
    el("span", { class: "who" }, who(c.author_type, c.author_id)),
    c.author_type === "agent" ? el("span", { class: "chip" }, "agent") : c.author_type === "human" ? el("span", { class: "chip" }, "owner") : el("span", { class: "chip" }, c.author_type),
    when(c.created_at),
    c.version !== p.current_version ? el("span", { class: "chip" }, `on v${c.version}`) : null,
    c.anchor !== "general" ? el("span", { class: "chip" }, ANCHOR_LABEL[c.anchor]) : null,
    c.is_question ? el("span", { class: `badge ${c.status === "open" ? "s-stale" : "s-executed"}` }, c.status === "open" ? (c.author_type === "human" ? "Open question · blocks approval" : "Open question") : "Resolved") : null,
    c.mentioned_agent_id ? el("span", { class: "chip" }, `@${c.mentioned_agent_id}`) : null);
  const controls = el("div", { class: "row", style: "margin-top: 4px" },
    el("button", { class: "link small", type: "button", onclick: () => { replyTo = c; renderComposer(); (composer.elements.namedItem("body") as HTMLTextAreaElement).focus(); } }, "Reply"),
    c.is_question && c.status === "open" ? el("button", { class: "link small", type: "button", onclick: () => resolve(c, true) }, "Resolve") : null,
    c.is_question && c.status === "resolved" ? el("button", { class: "link small", type: "button", onclick: () => resolve(c, false) }, "Reopen") : null);
  return el("li", { class: `c ${c.author_type}${c.is_question ? " question" : ""}`, id: `c-${c.comment_id}` },
    head, el("div", { class: "prose" }, c.body),
    c.resolution_note ? el("p", { class: "small muted" }, `Resolved: ${c.resolution_note}`) : null,
    controls,
    replies.length ? el("ul", { class: "replies" }, ...replies.map((r) => commentView(r, all, p))) : null);
}

async function resolve(c: Comment, yes: boolean) {
  let note = "";
  if (yes) {
    const f = await confirmDialog({ title: "Resolve this question?", body: [c.body.slice(0, 300)], confirm: "Resolve", extra: el("label", {}, "Resolution note (optional)", el("input", { name: "note" })) });
    if (!f) return;
    note = (f.elements.namedItem("note") as HTMLInputElement).value;
  }
  const r = await api<{ status: string; open_human_questions: number }>(`/api/questions/${c.comment_id}/${yes ? "resolve" : "reopen"}`, { body: { note } });
  toast(r.ok ? (yes ? `Resolved · ${r.body.open_human_questions} of your questions still open` : `Reopened · plan is ${r.body.status}`) : failure(r), !r.ok);
  await load(true);
}

function thread(p: Plan) {
  const top = p.comments.filter((c) => !c.parent_comment_id);
  return el("section", { class: "panel", id: "thread" },
    el("h2", {}, `Thread (${p.comments.length})`),
    top.length ? el("ul", { class: "thread" }, ...top.map((c) => commentView(c, p.comments, p))) : el("p", { class: "muted" }, "No comments yet."));
}

let composerAnchor = "general";
function setAnchor(a: string) {
  composerAnchor = a;
  renderComposer();
}

function renderComposer() {
  const body = el("textarea", { name: "body", required: true, placeholder: "Comment, or ask a question. @claude mentions an agent.", "aria-label": "Message" });
  const prev = composer.elements.namedItem("body") as HTMLTextAreaElement | null;
  if (prev) body.value = prev.value;
  const anchor = el("select", { name: "anchor", "aria-label": "Section" }, ...ANCHORS.map((a) => el("option", { value: a }, ANCHOR_LABEL[a])));
  anchor.value = composerAnchor;
  anchor.addEventListener("change", () => (composerAnchor = anchor.value));
  const mention = el("select", { name: "mention", "aria-label": "Ask an agent" }, el("option", { value: "" }, "No agent"), ...agents.map((a) => el("option", { value: a }, `@${a}`)));
  const question = el("input", { type: "checkbox", name: "question" });
  composer.replaceChildren(
    el("h2", {}, replyTo ? `Reply to ${who(replyTo.author_type, replyTo.author_id)}` : "Comment or ask"),
    replyTo ? el("p", { class: "small muted" }, replyTo.body.slice(0, 160), " ", el("button", { class: "link small", type: "button", onclick: () => { replyTo = null; renderComposer(); } }, "Cancel reply")) : "",
    body,
    el("div", { class: "fields" },
      el("label", {}, "Section", anchor),
      el("label", {}, "Direct it to", mention),
      replyTo ? null : el("label", { class: "check", style: "align-self: end" }, question, "Ask as a question (blocks approval until you resolve it)")),
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit" }, replyTo ? "Reply" : "Post")));
}

composer.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = composer.elements;
  const body = (f.namedItem("body") as HTMLTextAreaElement).value.trim();
  if (!body) return;
  const isQ = !replyTo && (f.namedItem("question") as HTMLInputElement | null)?.checked === true;
  const r = await api<{ status: string; approval_voided: boolean; version: number }>(`/api/plans/${planId}/comments`, {
    body: { body, anchor: composerAnchor, parent_comment_id: replyTo?.comment_id, is_question: isQ, mentioned_agent_id: (f.namedItem("mention") as HTMLSelectElement).value || undefined },
  });
  if (!r.ok) return toast(failure(r), true);
  toast(isQ ? `Question asked · plan is ${r.body.status}${r.body.approval_voided ? " · approval voided" : ""}` : "Posted");
  replyTo = null;
  (f.namedItem("body") as HTMLTextAreaElement).value = "";
  renderComposer();
  await load(true);
});

function history(p: Plan) {
  const versionList = el("ul", { class: "log" }, ...[...p.versions].reverse().map((v) => el("li", {},
    el("div", { class: "row small" }, el("strong", {}, `v${v.version}`), v.current ? el("span", { class: "badge s-ready" }, "Current") : null, who(v.edited_by_type, v.edited_by_id), when(v.edited_at)),
    el("span", { class: "small" }, v.diff_summary),
    el("button", { class: "link small", type: "button", style: "justify-self: start; padding-left: 0", onclick: () => showVersion(v.version) }, "View snapshot"))));
  const receipts = p.receipts.length ? el("div", { class: "scroll" }, el("table", { class: "grid" },
    el("thead", {}, el("tr", {}, ...["When", "Mode", "Outcome", "Reason", "Order id", "Fill", "Policy"].map((h) => el("th", {}, h)))),
    el("tbody", {}, ...[...p.receipts].reverse().map((r) => el("tr", {},
      el("td", {}, when(r.attempted_at)), el("td", {}, modeBadge(r.mode)), el("td", {}, badge(r.outcome === "simulated" ? "executed" : r.outcome), r.outcome === "simulated" ? " (simulated)" : r.outcome === "proposed" ? " (proposal)" : ""),
      el("td", {}, r.reason_code ? `${r.reason_code}: ` : "", r.reason_text,
        r.strategy_fit ? el("div", { class: `small ${r.strategy_fit.fit === "no" ? "warn" : "muted"}` }, `Strategy v${r.strategy_fit.strategy_version} fit (advisory): ${r.strategy_fit.fit}. ${r.strategy_fit.note}`) : null), el("td", { class: "mono" }, r.robinhood_order_id ?? "—"),
      el("td", {}, r.filled_quantity !== null ? `${r.filled_quantity} @ $${r.filled_price?.toFixed(2)}` : "—"), el("td", {}, r.policy_snapshot_id ? `v${r.policy_snapshot_id}` : "—")))))) : el("p", { class: "muted" }, "No attempts yet.");
  const log = el("ul", { class: "log" }, ...[...p.decision_log].reverse().slice(0, 200).map((e) => el("li", {},
    el("div", { class: "row small" }, el("strong", {}, e.action), el("span", {}, who(e.actor_type, e.actor_id)), when(e.at)),
    Object.keys(e.details ?? {}).length ? el("span", { class: "small muted mono" }, JSON.stringify(e.details)) : null)));
  return [
    el("section", { class: "panel" }, el("h2", {}, "Versions"), versionList),
    el("section", { class: "panel" }, el("h2", {}, "Receipts"), receipts),
    el("section", { class: "panel" }, el("h2", {}, "Decision log"), log),
  ];
}

async function showVersion(v: number) {
  const r = await api<{ snapshot: Record<string, unknown>; edited_by_type: string; edited_by_id: string; edited_at: string; diff_summary: string }>(`/api/plans/${planId}/versions/${v}`);
  if (!r.ok) return toast(failure(r), true);
  const s = r.body.snapshot;
  await confirmDialog({
    title: `Version ${v} (read-only)`,
    body: [el("p", { class: "small muted" }, `${who(r.body.edited_by_type, r.body.edited_by_id)} · `, when(r.body.edited_at), ` · ${r.body.diff_summary}`),
      el("pre", { class: "block" }, JSON.stringify(s, null, 2))],
    confirm: "Close",
  });
}

// ---------------------------------------------------------------- edit / create form

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function planForm(p: Plan | null, suggestedUntil: string | null) {
  const t = p?.order;
  const input = (name: string, value: string | number | null | undefined, attrs: Record<string, string | boolean> = {}) => el("input", { name, value: value === null || value === undefined ? "" : String(value), ...attrs });
  const area = (name: string, value: string) => { const a = el("textarea", { name }); a.value = value; return a; };
  const type = el("select", { name: "order_type" }, ...["limit", "market", "stop_limit", "stop_market"].map((o) => el("option", { value: o }, o)));
  type.value = t?.order_type ?? "limit";
  const qtyKind = el("select", { name: "qty_kind" }, el("option", { value: "shares" }, "shares"), el("option", { value: "dollars" }, "dollars"));
  qtyKind.value = t?.quantity_dollars !== null && t?.quantity_dollars !== undefined ? "dollars" : "shares";
  const until = input("valid_until", toLocal(p?.valid_until ?? suggestedUntil), { type: "datetime-local", required: true });
  const from = input("valid_from", toLocal(p?.valid_from ?? null), { type: "datetime-local" });
  const untilEcho = el("span", { class: "hint" });
  const echo = () => { untilEcho.textContent = until.value ? ptEt(new Date(until.value)) : "required"; };
  until.addEventListener("input", echo);
  echo();
  const confirmUntil = el("input", { type: "checkbox", name: "confirm_until", required: true });
  const err = el("p", { class: "error", role: "alert", hidden: true });
  const form = el("form", { class: "panel stack", "aria-label": p ? "Edit plan" : "New plan" },
    el("h2", {}, p ? `Edit plan (creates version ${p.current_version + 1})` : "New plan"),
    p ? el("p", { class: "small warn" }, "Saving voids any approval and sends the plan back to Debated.") : null,
    el("label", {}, "Title", input("title", p?.title, { required: true, maxlength: "120" })),
    el("div", { class: "fields" },
      el("label", {}, "Ticker", input("ticker", p?.ticker, { required: true, autocapitalize: "characters", pattern: "[A-Za-z]{1,5}(\\.[A-Za-z]{1,2})?" })),
      el("label", {}, "Order type", type),
      el("label", {}, "Quantity in", qtyKind),
      el("label", {}, "Quantity", input("qty", t ? (t.quantity_shares ?? t.quantity_dollars) : "", { required: true, inputmode: "decimal" })),
      el("label", {}, "Limit price", input("limit_price", t?.limit_price, { inputmode: "decimal" })),
      el("label", {}, "Stop price", input("stop_price", t?.stop_price ?? null, { inputmode: "decimal" }))),
    el("p", { class: "small muted" }, "Buy only, time in force day, the dedicated MCP account only (v1)."),
    el("label", {}, "Thesis", area("thesis", p?.thesis ?? "")),
    el("label", {}, "Evidence", area("evidence", p?.evidence ?? "")),
    el("label", {}, "Risks & dissent", area("risks_and_dissent", p?.risks_and_dissent ?? ""), el("span", { class: "hint" }, "Keep the agents' dissent: it isn't deleted when the plan is marked ready.")),
    el("label", {}, "Invalidation", area("invalidation", p?.invalidation ?? "")),
    el("label", {}, "Fit with strategy", area("fit_with_strategy", p?.fit_with_strategy ?? ""), el("span", { class: "hint" }, "How this plan fits your strategy, or why it departs from it.")),
    el("div", { class: "fields" },
      el("label", {}, "Valid from (your time, optional)", from),
      el("label", {}, "Valid until (your time)", until, untilEcho)),
    el("label", { class: "check" }, confirmUntil, "I've checked the valid-until time above (the default is the next market close)."),
    el("div", { class: "fields" },
      el("label", {}, "Quote price (optional)", input("quote_price", p?.quote_price ?? null, { inputmode: "decimal" })),
      el("label", {}, "Quote time (your time)", input("quote_at", toLocal(p?.quote_at ?? null), { type: "datetime-local" })),
      el("label", {}, "Quote source", input("quote_source", p?.quote_source ?? null))),
    err,
    el("div", { class: "row" },
      el("button", { class: "btn primary", type: "submit" }, p ? "Save new version" : "Create plan"),
      el("button", { class: "btn", type: "button", onclick: () => { if (p) { editing = false; render(); } else location.href = "/"; } }, "Cancel")));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement).value ?? "").trim();
    const num = (n: string) => (v(n) === "" ? null : Number(v(n)));
    const ticker = v("ticker").toUpperCase();
    const order = {
      ticker, side: "buy", order_type: v("order_type"),
      quantity_shares: v("qty_kind") === "shares" ? num("qty") : null, quantity_dollars: v("qty_kind") === "dollars" ? num("qty") : null,
      limit_price: num("limit_price"), stop_price: num("stop_price"), time_in_force: "day", account_scope: "dedicated_mcp_account_only",
    };
    const fields = {
      title: v("title"), ticker, order, thesis: v("thesis"), evidence: v("evidence"), risks_and_dissent: v("risks_and_dissent"), invalidation: v("invalidation"), fit_with_strategy: v("fit_with_strategy"),
      valid_from: fromLocal(v("valid_from")), valid_until: fromLocal(v("valid_until")), quote_price: num("quote_price"), quote_at: fromLocal(v("quote_at")), quote_source: v("quote_source") || null,
    };
    const r = p
      ? await api<{ version: number; status: string }>(`/api/plans/${p.plan_id}`, { method: "PUT", body: { expected_version: p.current_version, ...fields } })
      : await api<{ plan_id: string; version: number }>("/api/plans", { body: fields });
    if (!r.ok) {
      err.textContent = failure(r);
      err.hidden = false;
      return;
    }
    if (p) {
      toast(`Saved version ${(r.body as { version: number }).version} · plan is ${(r.body as { status: string }).status}`);
      editing = false;
      await load(true);
    } else {
      location.href = `/plans/${(r.body as { plan_id: string }).plan_id}`;
    }
  });
  return form;
}

// ---------------------------------------------------------------- load and render

let lastKey = "";
function render() {
  if (!plan) return;
  const p = plan;
  doc.replaceChildren(header(p), questionBanner(p) ?? "", ticketCard(p), validityStrip(p), actions(p), ...sections(p), thread(p));
  // The edit form is built once per edit, so a refresh never wipes what the owner is typing.
  if (!editing) editHost.replaceChildren();
  else if (!editHost.firstChild) editHost.replaceChildren(planForm(p, null));
  histHost.replaceChildren(...history(p));
}

async function load(force = false) {
  const r = await api<Plan>(`/api/plans/${planId}`);
  if (!r.ok) {
    if (r.status === 404) root.replaceChildren(el("div", { class: "panel" }, el("h1", {}, "No such plan"), el("a", { href: "/" }, "Back to the board")));
    return;
  }
  const key = `${r.body.current_version}:${r.body.status}:${r.body.last_activity_at}:${r.body.validity}:${r.body.receipts.length}:${r.body.decision_log.length}`;
  plan = r.body;
  if (!force && key === lastKey) return;
  lastKey = key;
  document.title = `${plan.ticker} · ${plan.title} · Trading Plan Board`;
  render();
}

async function start() {
  chrome();
  root.replaceChildren(spinner());
  const a = await api<{ agents: { agent_id: string; revoked_at: string | null }[] }>("/api/agents");
  agents = a.ok ? a.body.agents.filter((x) => !x.revoked_at).map((x) => x.agent_id) : [];
  if (!planId) {
    const me = await api<{ suggested_valid_until: string | null }>("/api/me");
    root.replaceChildren(planForm(null, me.body.suggested_valid_until ?? null));
    return;
  }
  renderComposer();
  root.replaceChildren(doc, editHost, composer, histHost);
  every(5_000, () => load());
}
void start();
