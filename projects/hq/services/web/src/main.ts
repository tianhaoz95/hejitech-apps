// The portal: sign in, pick a workspace (one repo + its members), then the inbox (decide, ready to
// ship, discussing, working, backlog), card detail with evidence and discussion, health, runs, and
// settings (members and invites, kill switch, tokens, connected agents, audit).
// Single page, hash routes: #/ · #/card/<id> · #/health · #/runs · #/run/<id> · #/settings ·
// #/new (create a workspace) · #/join/<code> (accept an invite).
import "./style.css";
import { ago, api, ApiError, currentWorkspaceId, el, fileUrl, session, setCurrentWorkspace, signInView, spinner, supabase, toast, type Workspace } from "./lib.ts";

const root = document.getElementById("app")!;
const nav = document.getElementById("nav")!;
const wsSlot = document.getElementById("ws")!;
let workspaces: Workspace[] = [];
let current: Workspace | null = null;
const canDecide = () => current?.role === "admin" || current?.role === "approver";
const isAdmin = () => current?.role === "admin";

type Card = {
  id: string; project: string; kind: string; title: string; why: string; plan: string; verify: string; tier: string;
  effort: string; risk: string; risk_reason: string | null; status: string; priority: number; evidence: Evidence[];
  verbs: string[]; source: { scout?: string; agent?: string; session?: string }; branch: string | null; pr_url: string | null;
  decided_by: string | null; created_at: string; updated_at: string; dedupe_key: string | null;
};
type Evidence = { type: string; ref?: string; text?: string; name?: string; value?: number; unit?: string; source?: string };

const TIER_HELP: Record<string, string> = {
  L0: "Just do it: built and merged on green CI",
  L1: "Build, then ask: a finished change waits for one tap",
  L2: "Ask, then build: approve before any work starts",
  L3: "Never autonomous: you run it yourself",
};

function view(...nodes: (Node | false | null)[]) {
  root.replaceChildren(...(nodes.filter(Boolean) as Node[]));
  window.scrollTo(0, 0);
}

function fail(e: unknown) {
  if (e instanceof ApiError && e.status === 401) return signIn();
  const msg = e instanceof ApiError ? e.message : String(e);
  view(el("div", { class: "panel" }, el("h1", {}, "Something went wrong"), el("p", { class: "muted" }, msg), el("a", { class: "btn", href: "#/" }, "Back to inbox")));
}

// ── sign-in ──────────────────────────────────────────────────────────────────────────────────

function signIn() {
  nav.hidden = true;
  wsSlot.replaceChildren();
  view(signInView({ title: "Sign in to HQ", message: "Your repo's autopilot: agents propose, your team decides.", redirectTo: location.href, onSignedIn: route }));
}

// ── inbox ────────────────────────────────────────────────────────────────────────────────────

const chip = (text: string, cls = "") => el("span", { class: `chip ${cls}` }, text);
const tierChip = (t: string) => el("span", { class: `chip tier ${t}`, title: TIER_HELP[t] ?? "" }, t);

function cardRow(c: Card) {
  return el("a", { class: "card-row", href: `#/card/${c.id}` },
    el("div", { class: "row-top" }, tierChip(c.tier), chip(c.project), chip(c.kind, "soft"), el("span", { class: "muted small grow right" }, ago(c.created_at))),
    el("div", { class: "row-title" }, c.title),
    el("div", { class: "row-why muted" }, c.why.split("\n")[0].slice(0, 180)),
    c.branch && el("div", { class: "small mono" }, `branch ${c.branch}`));
}

function section(title: string, cards: Card[], empty: string, note?: string) {
  return el("section", { class: "group" },
    el("h2", {}, title, el("span", { class: "count" }, String(cards.length))),
    note && el("p", { class: "muted small" }, note),
    cards.length ? el("div", { class: "list" }, cards.map(cardRow)) : el("p", { class: "empty" }, empty));
}

async function inbox() {
  view(spinner());
  const [ib, dg] = await Promise.all([api("~/inbox"), api("~/digest")]);
  const needs = ib.decide.length + ib.ready.length + ib.discussing.length;
  view(
    el("div", { class: "digest" },
      el("div", {}, el("b", {}, String(needs)), el("span", {}, "need you")),
      el("div", {}, el("b", {}, String(dg.shipped)), el("span", {}, "shipped 24 h")),
      el("div", {}, el("b", {}, String(dg.proposed)), el("span", {}, "new 24 h")),
      el("div", { class: dg.failed + dg.runs_failed ? "bad" : "" }, el("b", {}, String(dg.failed + dg.runs_failed)), el("span", {}, "failed 24 h")),
      el("div", {}, el("b", {}, `$${dg.spent_this_week_usd.toFixed(2)}`), el("span", {}, "this week"))),
    dg.paused && el("div", { class: "banner" }, "HQ is paused. Nothing runs until you resume it in ", el("a", { href: "#/settings" }, "Settings"), "."),
    section("Decide", ib.decide, "Nothing to decide. HQ shows at most " + ib.cap + " at a time.", `Top ${ib.cap} by priority; the rest wait in the backlog.`),
    section("Ready to ship", ib.ready, "No finished builds waiting."),
    section("Discussing", ib.discussing, "No open discussions."),
    section("Working", ib.working, "Nothing being built."),
    ib.backlog.length ? section("Backlog", ib.backlog, "", "Ranked below the cap. The CEO re-ranks daily.") : null
  );
}

// ── card ─────────────────────────────────────────────────────────────────────────────────────

function evidenceItem(e: Evidence) {
  const link = e.ref && /^https?:\/\//.test(e.ref) ? el("a", { href: e.ref, target: "_blank", rel: "noopener" }, e.ref) : e.ref ? el("code", {}, e.ref) : null;
  return el("li", {},
    chip(e.type, "soft"),
    e.type === "metric" ? el("b", {}, ` ${e.name ?? "metric"}: ${e.value}${e.unit ? " " + e.unit : ""} `) : " ",
    link,
    e.text && el("div", { class: e.type === "log" ? "pre" : "" }, e.text),
    e.source && el("div", { class: "muted small" }, `source: ${e.source}`));
}

async function attachmentView(a: { phase: string; evidence: Evidence; file_key: string | null; by: string; at: string }) {
  if (a.file_key && a.evidence.type === "screenshot") {
    const img = el("img", { alt: a.evidence.text ?? "screenshot", loading: "lazy" });
    fileUrl(a.file_key).then((u) => (img.src = u)).catch(() => img.replaceWith(el("p", { class: "muted" }, "image unavailable")));
    return el("figure", { class: "shot" }, img, el("figcaption", { class: "small muted" }, `${a.phase} · ${a.evidence.text ?? ""} · ${a.by}`));
  }
  return el("ul", { class: "evidence" }, evidenceItem(a.evidence));
}

async function card(id: string) {
  view(spinner());
  const d = await api(`~/cards/${id}`);
  const c: Card = d.card;
  const reasons: string[] = (await api("~/inbox").catch(() => ({ reject_reasons: [] }))).reject_reasons;
  const reload = () => card(id);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? `${e.message}${e.details.length ? ": " + e.details.join("; ") : ""}` : String(e), true);
    }
  };

  const rejectBox = el("div", { class: "reject", hidden: true },
    el("p", { class: "small muted" }, "Why? Your reason teaches the scouts."),
    el("div", { class: "chips" }, reasons.map((r) => el("button", { class: "chip btnchip", type: "button", onclick: () => act(() => api(`~/cards/${id}/decision`, { method: "POST", json: { decision: "rejected", reason: r } }), "Rejected") }, r))),
    (() => {
      const t = el("input", { placeholder: "Or write a reason…", "aria-label": "Reject reason" });
      return el("form", { class: "inline", onsubmit: (e: Event) => { e.preventDefault(); act(() => api(`~/cards/${id}/decision`, { method: "POST", json: { decision: "rejected", reason: t.value } }), "Rejected"); } }, t, el("button", { class: "btn danger", type: "submit" }, "Reject"));
    })());

  const actions: Node[] = [];
  if (!canDecide()) {
    // Viewers read and comment.
  } else if (c.status === "proposed" || c.status === "discussing") {
    actions.push(
      el("button", { class: "btn primary", onclick: () => act(() => api(`~/cards/${id}/decision`, { method: "POST", json: { decision: "approved" } }), "Approved: an executor will pick it up") }, "Approve"),
      el("button", { class: "btn", onclick: () => { rejectBox.hidden = !rejectBox.hidden; } }, "Reject…"),
      el("button", { class: "btn ghost", onclick: () => { document.getElementById("discuss")?.scrollIntoView({ behavior: "smooth" }); setTimeout(() => commentBox.focus(), 300); } }, "Discuss"));
  }
  if (canDecide() && c.status === "in_review") {
    actions.push(
      el("button", { class: "btn primary", onclick: () => act(() => api(`~/cards/${id}/status`, { method: "POST", json: { status: "shipped" } }), "Marked shipped") }, c.pr_url ? "Mark merged & shipped" : "Mark shipped"),
      el("button", { class: "btn", onclick: () => act(() => api(`~/cards/${id}/status`, { method: "POST", json: { status: "approved" } }), "Sent back for another build") }, "Build again"),
      el("button", { class: "btn", onclick: () => { rejectBox.hidden = !rejectBox.hidden; } }, "Reject…"));
  }
  if (canDecide() && c.status === "failed") {
    actions.push(el("button", { class: "btn primary", onclick: () => act(() => api(`~/cards/${id}/status`, { method: "POST", json: { status: "approved" } }), "Retrying") }, "Retry build"));
  }

  const attachments = await Promise.all(d.attachments.map(attachmentView));
  const commentBox = el("textarea", { placeholder: "Ask a question or suggest a change. The agent that wrote this card answers here.", rows: 3, "aria-label": "Comment" });

  const verbBar = c.verbs.length && canDecide()
    ? el("div", { class: "verbs" }, el("span", { class: "small muted" }, "Verbs: "),
        c.verbs.map((v) => el("span", { class: "verb" }, el("code", {}, v),
          el("button", { class: "btn tiny", onclick: () => act(() => api("~/verbs", { method: "POST", json: { project: c.project, verb: v, dry_run: true, card_id: id } }), `Dry run of ${v} queued`) }, "dry run"),
          el("button", { class: "btn tiny", onclick: () => confirm(`Run ${v} for ${c.project} for real?`) && act(() => api("~/verbs", { method: "POST", json: { project: c.project, verb: v, dry_run: false, card_id: id } }), `${v} queued`) }, "run"))))
    : null;

  view(
    el("a", { class: "back", href: "#/" }, "← Inbox"),
    el("article", { class: "panel card" },
      el("div", { class: "row-top" }, tierChip(c.tier), chip(c.project), chip(c.kind, "soft"), chip(c.status.replace("_", " "), `status ${c.status}`), el("span", { class: "muted small grow right mono" }, c.id)),
      el("h1", {}, c.title),
      el("p", { class: "muted small" }, TIER_HELP[c.tier], " · effort ", c.effort, " · risk ", c.risk, c.risk_reason ? ` (${c.risk_reason})` : "", " · from ", c.source.scout ?? c.source.agent ?? "unknown", " · ", ago(c.created_at)),
      actions.length ? el("div", { class: "actions" }, actions) : null,
      rejectBox,
      c.branch || c.pr_url ? el("p", { class: "small" }, c.pr_url ? el("a", { href: c.pr_url, target: "_blank", rel: "noopener" }, "Pull request") : null, c.branch ? el("span", { class: "mono" }, ` branch ${c.branch}`) : null) : null,
      el("h3", {}, "Why"), el("div", { class: "prose" }, c.why),
      el("h3", {}, "Evidence"), el("ul", { class: "evidence" }, c.evidence.map(evidenceItem)),
      el("h3", {}, "Plan"), el("div", { class: "prose" }, c.plan),
      el("h3", {}, "How we'll know it worked"), el("div", { class: "prose" }, c.verify),
      verbBar),
    attachments.length ? el("section", { class: "panel" }, el("h2", {}, "Build & review evidence"), attachments) : null,
    el("section", { class: "panel", id: "discuss" },
      el("h2", {}, "Discussion"),
      d.comments.length ? el("div", { class: "thread" }, d.comments.map((m: { author: string; body: string; created_at: string }) =>
        el("div", { class: `msg ${m.author === "owner" ? "me" : ""}` }, el("div", { class: "small muted" }, m.author === "owner" ? "You" : m.author, " · ", ago(m.created_at)), el("div", { class: "prose" }, m.body)))) : el("p", { class: "empty" }, "No discussion yet."),
      el("form", { class: "comment", onsubmit: (e: Event) => { e.preventDefault(); if (!commentBox.value.trim()) return; act(() => api(`~/cards/${id}/comments`, { method: "POST", json: { body: commentBox.value } }), "Sent: the agent will answer"); } },
        commentBox, el("button", { class: "btn", type: "submit" }, "Send"))),
    el("section", { class: "panel" },
      el("h2", {}, "History"),
      el("ul", { class: "history small" },
        d.decisions.map((x: { decision: string; reason: string | null; by: string; at: string }) => el("li", {}, `${x.decision} by ${x.by}${x.reason ? ` — “${x.reason}”` : ""} · ${ago(x.at)}`)),
        d.runs.map((r: { id: string; kind: string; status: string; summary: string | null; created_at: string; cost_usd: number }) =>
          el("li", {}, el("a", { href: `#/run/${r.id}` }, `${r.kind} run`), ` ${r.status}${r.summary ? `: ${r.summary}` : ""} · $${(r.cost_usd ?? 0).toFixed(2)} · ${ago(r.created_at)}`))))
  );
}

// ── health ───────────────────────────────────────────────────────────────────────────────────

async function health() {
  view(spinner());
  const h = await api("~/health");
  view(
    el("h1", {}, "Health"),
    el("p", { class: "muted" }, `Spend this week: $${h.spent_this_week_usd.toFixed(2)}${h.weekly_budget_usd ? ` of $${h.weekly_budget_usd}` : ""}. Each project's .hq/bin/health reports here hourly.`),
    el("div", { class: "health" },
      h.projects.map((p: { project: string; tier_ceiling: string | null; open_cards: number; health: { ok: boolean; at: string; data: Record<string, unknown> } | null }) =>
        el("div", { class: `hcard ${p.health ? (p.health.ok ? "ok" : "bad") : "unknown"}` },
          el("div", { class: "row-top" }, el("b", {}, p.project), p.tier_ceiling ? tierChip(p.tier_ceiling) : null, el("span", { class: "grow right small muted" }, p.health ? ago(p.health.at) : "no report yet")),
          el("div", { class: "small" }, p.health ? (p.health.ok ? "Healthy" : "Needs attention") : "—", " · ", `${p.open_cards} open card${p.open_cards === 1 ? "" : "s"}`),
          p.health ? el("ul", { class: "small kv" }, Object.entries(p.health.data).filter(([k]) => k !== "ok").slice(0, 8).map(([k, v]) => el("li", {}, el("span", { class: "muted" }, k), " ", typeof v === "object" ? JSON.stringify(v) : String(v)))) : null)))
  );
}

// ── runs ─────────────────────────────────────────────────────────────────────────────────────

async function runs() {
  view(spinner());
  const [list, cfg] = await Promise.all([api("~/runs?limit=60"), api("~/config")]);
  const policy = cfg?.policy;
  const scouts: { name: string; project: string }[] = policy
    ? [...policy.scouts.map((s: { name: string }) => ({ name: s.name, project: "repo-wide" })),
       ...Object.values(policy.projects as Record<string, { name: string; scouts: { name: string }[] }>).flatMap((p) => p.scouts.map((s) => ({ name: s.name, project: p.name })))]
    : [];
  const start = (body: unknown, msg: string) => api("~/runs", { method: "POST", json: body }).then(() => { toast(msg); runs(); }).catch((e) => toast(String(e.message ?? e), true));
  view(
    el("h1", {}, "Runs"),
    el("p", { class: "muted" }, policy ? `Policy from ${policy.repo}, synced ${ago(cfg.synced_at)}${cfg.commit_sha ? ` at ${cfg.commit_sha.slice(0, 8)}` : ""}.` : "No policy yet: run `hq sync` in the repo."),
    el("div", { class: "actions wrap" },
      el("button", { class: "btn", onclick: () => start({ kind: "ceo" }, "CEO run queued") }, "Run CEO now"),
      el("button", { class: "btn", onclick: () => start({ kind: "health" }, "Health run queued") }, "Check health now"),
      scouts.map((s) => el("button", { class: "btn ghost", onclick: () => start({ kind: "scout", scout: s.name, project: s.project }, `${s.name} queued`) }, `${s.name} · ${s.project}`))),
    el("div", { class: "table" },
      list.map((r: { id: string; kind: string; project: string | null; scout: string | null; verb: string | null; status: string; agent: string | null; created_at: string; summary: string | null; cost_usd: number; card_id: string | null }) =>
        el("a", { class: `run ${r.status}`, href: `#/run/${r.id}` },
          el("span", { class: "chip soft" }, r.kind), el("span", { class: `chip status ${r.status}` }, r.status),
          el("span", { class: "grow" }, [r.scout, r.verb, r.project, r.card_id].filter(Boolean).join(" · ")),
          el("span", { class: "small muted" }, `$${(r.cost_usd ?? 0).toFixed(2)} · ${ago(r.created_at)}`),
          r.summary ? el("div", { class: "small muted full" }, r.summary) : null)))
  );
}

async function run(id: string) {
  view(spinner());
  const r = await api(`~/runs/${id}`);
  view(
    el("a", { class: "back", href: "#/runs" }, "← Runs"),
    el("article", { class: "panel" },
      el("div", { class: "row-top" }, chip(r.kind, "soft"), chip(r.status, `status ${r.status}`), el("span", { class: "grow right mono small" }, r.id)),
      el("h1", {}, [r.scout, r.verb, r.project].filter(Boolean).join(" · ") || r.kind),
      el("p", { class: "muted small" }, `agent ${r.agent ?? "—"} · runner ${r.runner ?? "—"} · requested by ${r.requested_by} · $${(r.cost_usd ?? 0).toFixed(2)}`),
      r.card_id ? el("p", {}, el("a", { href: `#/card/${r.card_id}` }, `Card ${r.card_id}`)) : null,
      r.summary ? el("div", { class: "prose" }, r.summary) : null,
      r.output ? el("pre", { class: "log" }, r.output) : el("p", { class: "empty" }, "No output yet."))
  );
}

// ── settings ─────────────────────────────────────────────────────────────────────────────────

async function settings() {
  view(spinner());
  const admin = isAdmin();
  const [h, members, tokens, grants, log] = await Promise.all([
    api("~/health"),
    api("~/members"),
    admin ? api("~/tokens") : Promise.resolve([]),
    api("/api/grants").catch(() => []),
    admin ? api("~/audit?limit=60") : Promise.resolve([]),
  ]);
  const me = (await session())?.user.id;
  const ws = current!;
  const inviteRole = el("select", { "aria-label": "Invite role" }, el("option", { value: "approver" }, "approver"), el("option", { value: "viewer" }, "viewer"), el("option", { value: "admin" }, "admin"));
  const inviteOut = el("div");
  const name = el("input", { placeholder: "Name, e.g. mac-runner or codex", "aria-label": "Token name" });
  const role = el("select", { "aria-label": "Token role" }, el("option", { value: "runner" }, "runner (claims work, runs verbs)"), el("option", { value: "agent" }, "agent (MCP: propose, comment)"));
  const created = el("div");
  const roleSelect = (m: { user_id: string; role: string }) => {
    const sel = el("select", { "aria-label": "Role", onchange: async (e: Event) => {
      try { await api(`~/members/${m.user_id}`, { method: "PATCH", json: { role: (e.target as HTMLSelectElement).value } }); toast("Role changed"); }
      catch (err) { toast(String((err as Error).message), true); settings(); }
    } }, ["admin", "approver", "viewer"].map((r) => el("option", { value: r }, r)));
    (sel as HTMLSelectElement).value = m.role;
    return sel;
  };
  view(
    el("h1", {}, "Settings"),
    el("p", { class: "muted" }, `${ws.name} · `, el("code", {}, ws.repo), ` · you're ${ws.role === "admin" ? "an" : "an"} ${ws.role}`),
    el("section", { class: "panel" },
      el("h2", {}, "Members"),
      el("ul", { class: "list-plain" },
        members.map((m: { user_id: string; role: string; email: string | null; created_at: string }) =>
          el("li", { class: "member" }, el("span", { class: "grow" }, m.email ?? m.user_id, m.user_id === me ? el("span", { class: "muted" }, " (you)") : null),
            admin ? roleSelect(m) : el("span", { class: "chip soft" }, m.role),
            admin || m.user_id === me ? el("button", { class: "btn tiny", onclick: async () => {
              if (!confirm(m.user_id === me ? "Leave this workspace?" : `Remove ${m.email ?? "this member"}?`)) return;
              try { await api(`~/members/${m.user_id}`, { method: "DELETE" }); if (m.user_id === me) { setCurrentWorkspace(""); route(); } else settings(); }
              catch (err) { toast(String((err as Error).message), true); }
            } }, m.user_id === me ? "Leave" : "Remove") : null))),
      admin ? el("form", { class: "inline", onsubmit: async (e: Event) => {
        e.preventDefault();
        const inv = await api("~/invites", { method: "POST", json: { role: (inviteRole as HTMLSelectElement).value } });
        const link = `${location.origin}/#/join/${inv.code}`;
        inviteOut.replaceChildren(el("div", { class: "banner" }, `Invite link for one ${inv.role}, valid until ${inv.expires_at.slice(0, 10)}: `, el("code", { class: "select" }, link)));
        navigator.clipboard?.writeText(link).then(() => toast("Invite link copied"), () => {});
      } }, el("span", { class: "small muted" }, "Invite someone as"), inviteRole, el("button", { class: "btn", type: "submit" }, "Create invite link")) : null,
      inviteOut,
      el("p", { class: "small muted" }, "admin: members, tokens, kill switch · approver: approve, reject, ship, run verbs · viewer: read and comment")),
    el("section", { class: "panel" },
      el("h2", {}, "Kill switch"),
      el("p", { class: "muted" }, h.paused ? "HQ is paused in this workspace: no scouts, no builds, no verbs except ones a person starts." : "HQ is running."),
      admin ? el("button", { class: `btn ${h.paused ? "primary" : "danger"}`, onclick: () => api("~/settings", { method: "POST", json: { paused: !h.paused } }).then(() => { toast(h.paused ? "Resumed" : "Paused"); settings(); }) }, h.paused ? "Resume HQ" : "Pause everything") : el("p", { class: "small muted" }, "Only admins can pause.")),
    el("section", { class: "panel" },
      el("h2", {}, "Connect agents and runners"),
      el("p", {}, "MCP server: ", el("code", {}, `${location.origin}/mcp`)),
      el("p", { class: "muted small" }, "Assistants that support OAuth connect with that URL; an admin or approver picks this workspace and approves. Runners and headless agents use a token."),
      admin ? el("form", { class: "inline", onsubmit: async (e: Event) => {
        e.preventDefault();
        try {
          const t = await api("~/tokens", { method: "POST", json: { name: name.value, role: (role as HTMLSelectElement).value } });
          created.replaceChildren(el("div", { class: "banner" }, "Copy it now; it isn't shown again: ", el("code", { class: "select" }, t.token)));
          name.value = "";
        } catch (err) { toast(String((err as Error).message), true); }
      } }, name, role, el("button", { class: "btn", type: "submit" }, "Create token")) : null,
      created,
      el("ul", { class: "small list-plain" },
        tokens.map((t: { id: string; name: string; role: string; last_used_at: string | null; revoked_at: string | null }) =>
          el("li", {}, el("b", {}, t.name), ` ${t.role} · ${t.revoked_at ? "revoked" : t.last_used_at ? "used " + ago(t.last_used_at) : "never used"} `,
            !t.revoked_at && el("button", { class: "btn tiny", onclick: () => api(`~/tokens/${t.id}`, { method: "DELETE" }).then(settings) }, "Revoke"))),
        grants.filter((g: { workspace: string | null }) => g.workspace === ws.id).map((g: { id: string; client_name: string | null; created_at: string }) =>
          el("li", {}, el("b", {}, g.client_name ?? "MCP client"), ` connected by you · ${ago(g.created_at)} `,
            el("button", { class: "btn tiny", onclick: () => api(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE" }).then(settings) }, "Disconnect"))))),
    admin ? el("section", { class: "panel" },
      el("h2", {}, "Audit log"),
      el("ul", { class: "small mono audit" }, log.map((a: { at: string; actor: string; action: string; target: string | null }) => el("li", {}, `${a.at.slice(5, 16).replace("T", " ")} ${a.actor} ${a.action} ${a.target ?? ""}`)))) : null,
    el("p", { class: "actions" },
      el("a", { class: "btn ghost", href: "#/new" }, "New workspace"),
      el("button", { class: "btn ghost", onclick: async () => { await supabase.auth.signOut(); setCurrentWorkspace(""); signIn(); } }, "Sign out"),
      el("button", { class: "btn danger", onclick: async () => {
        if (!confirm("Delete your HQ account? This removes your memberships and every workspace where you're the only member. Team workspaces keep their history, and another member becomes admin if you were the only one. This can't be undone.")) return;
        try { await api("/api/me", { method: "DELETE", json: {} }); await supabase.auth.signOut(); setCurrentWorkspace(""); toast("Your HQ account was deleted"); signIn(); }
        catch (err) { toast(String((err as Error).message), true); }
      } }, "Delete account"))
  );
}

// ── workspaces: create, join, switch ─────────────────────────────────────────────────────────

function newWorkspace(first: boolean) {
  nav.hidden = !current;
  const name = el("input", { placeholder: "Name, e.g. Acme", "aria-label": "Workspace name", required: true });
  const repo = el("input", { placeholder: "owner/repo on GitHub", "aria-label": "Repository", required: true });
  view(el("form", { class: "panel signin", onsubmit: async (e: Event) => {
    e.preventDefault();
    try {
      const ws = await api<Workspace>("/api/workspaces", { method: "POST", json: { name: name.value, repo: repo.value } });
      setCurrentWorkspace(ws.id);
      location.hash = "#/settings";
      route();
    } catch (err) { toast(String((err as Error).message), true); }
  } },
    el("div", { class: "logo big" }, "HQ"),
    el("h1", {}, first ? "Set up your workspace" : "New workspace"),
    el("p", { class: "muted" }, "A workspace is one repository and the people who work on it. HQ is built for a monorepo: one ", el("code", {}, ".hq/"), " at the root and one per project."),
    name, repo,
    el("button", { class: "btn primary", type: "submit" }, "Create workspace"),
    first ? el("p", { class: "small muted" }, "Joining a team instead? Open the invite link they sent you.") : el("a", { href: "#/" }, "Cancel")));
  name.focus();
}

async function join(code: string) {
  view(spinner());
  try {
    const ws = await api<Workspace>("/api/invites/accept", { method: "POST", json: { code } });
    setCurrentWorkspace(ws.id);
    toast(`You joined ${ws.name} as ${ws.role}`);
    location.hash = "#/";
  } catch (e) {
    view(el("div", { class: "panel signin" }, el("h1", {}, "Can't join"), el("p", { class: "muted" }, (e as Error).message), el("a", { class: "btn", href: "#/" }, "Continue")));
  }
}

function switcher() {
  if (!current) return wsSlot.replaceChildren();
  const sel = el("select", { "aria-label": "Workspace", class: "ws", onchange: (e: Event) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v === "+") { location.hash = "#/new"; return; }
    setCurrentWorkspace(v);
    location.hash = "#/";
    route();
  } },
    workspaces.map((w) => el("option", { value: w.id }, `${w.name} · ${w.repo}`)),
    el("option", { value: "+" }, "+ New workspace"));
  (sel as HTMLSelectElement).value = current.id;
  wsSlot.replaceChildren(sel);
}

// ── router ───────────────────────────────────────────────────────────────────────────────────

async function route() {
  const h = location.hash.replace(/^#/, "") || "/";
  if (!(await session())) {
    if (h.startsWith("/join/")) sessionStorage.setItem("hq.pending-join", h.slice(6));
    return signIn();
  }
  const pending = sessionStorage.getItem("hq.pending-join");
  if (pending) { sessionStorage.removeItem("hq.pending-join"); return join(pending); }
  let m;
  if ((m = h.match(/^\/join\/(.+)$/))) return join(m[1]);
  try {
    workspaces = (await api<{ workspaces: Workspace[] }>("/api/me")).workspaces;
  } catch (e) {
    return fail(e);
  }
  current = workspaces.find((w) => w.id === currentWorkspaceId()) ?? workspaces[0] ?? null;
  setCurrentWorkspace(current?.id ?? "");
  switcher();
  if (!current || h === "/new") return newWorkspace(!current);
  nav.hidden = false;
  if (!current.synced_at && h !== "/settings") return notSynced();
  for (const a of nav.querySelectorAll("a")) a.classList.toggle("on", a.getAttribute("href") === `#${h}` || (h.startsWith("/card") && a.getAttribute("href") === "#/"));
  try {
    if ((m = h.match(/^\/card\/([\w-]+)/))) await card(m[1]);
    else if ((m = h.match(/^\/run\/([\w-]+)/))) await run(m[1]);
    else if (h === "/health") await health();
    else if (h === "/runs") await runs();
    else if (h === "/settings") await settings();
    else await inbox();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && /no policy yet/.test(e.message)) return notSynced();
    fail(e);
  }
}

/** A new workspace before its first `hq sync`: what to do next. */
function notSynced() {
  view(el("section", { class: "panel" },
    el("h1", {}, `Connect ${current!.repo}`),
    el("p", { class: "muted" }, "HQ hasn't seen this repo's policy yet. Three steps:"),
    el("ol", { class: "steps" },
      el("li", {}, "Install the command: ", el("code", {}, "npm install -g @hejitech/hq"), ". Add ", el("code", {}, ".hq/HQ.md"), " at the repo root (", el("code", {}, `hq init --repo ${current!.repo}`), " writes one), and one per project you want HQ to manage."),
      el("li", {}, "In the repo, run ", el("code", {}, "hq login"), isAdmin() ? " and allow it in the browser: it creates and saves the runner and agent tokens." : ": ask an admin for a runner token to paste, or to run it for you."),
      el("li", {}, "Still in the repo: ", el("code", {}, "hq sync"), ", then start ", el("code", {}, "hq runner"), " on a machine that has the repo checked out. A headless machine takes ", el("code", {}, "HQ_URL"), ", ", el("code", {}, "HQ_TOKEN"), " and ", el("code", {}, "HQ_AGENT_TOKEN"), " from ", isAdmin() ? el("a", { href: "#/settings" }, "Settings") : "an admin", " instead."))));
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") route();
});
window.addEventListener("hashchange", route);
route();
