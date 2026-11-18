// The artifact workspace (/a/<slug>, /a/<slug>/v/<n>, /a/<slug>/s/<n>): the live artifact in a
// sandboxed frame, and beside it activity, suggestions, comments, files and history. Polls the
// activity feed so changes other agents make show up while you watch.
import { agentBadge, agentHue, api, ApiError, copyText, currentSession, download, el, signInView, spinner, timeAgo, toast } from "./common.ts";
import { diffView, type FileDiff } from "./diffview.ts";

const root = document.getElementById("app")!;
const m = location.pathname.match(/^\/a\/([^/]+)(?:\/(v|s)\/(\d+))?/);
const slug = m?.[1] ?? "";

type Role = "owner" | "editor" | "viewer";
interface FileInfo {
  path: string;
  type: string;
  size: number;
  text: boolean;
}
interface Data {
  artifact: { id: string; slug: string; title: string; description: string; visibility: "private" | "link"; head_version: number; forked_from: string | null; created_at: string; updated_at: string };
  role: Role;
  signed_in: boolean;
  head: { number: number; message: string; agent: string; model: string | null; kind: string; created_at: string };
  files: FileInfo[];
  open_suggestions: number;
  unresolved_comments: number;
  mcp_url: string;
}
interface Version {
  number: number;
  parent: number | null;
  message: string;
  agent: string;
  model: string | null;
  via: string;
  kind: string;
  restored_from: number | null;
  suggestion?: number | null;
  created_at: string;
  files: number;
}
interface Suggestion {
  number: number;
  base_version: number;
  title: string;
  rationale: string;
  status: "open" | "accepted" | "rejected" | "withdrawn";
  agent: string;
  model: string | null;
  resolved_agent: string | null;
  resolution_note: string | null;
  result_version: number | null;
  created_at: string;
  resolved_at: string | null;
  summary?: string;
}
interface Comment {
  id: string;
  body: string;
  agent: string;
  model: string | null;
  version: number | null;
  path: string | null;
  anchor: { selector?: string; text?: string; line?: number; end_line?: number } | null;
  reply_to: string | null;
  resolved: boolean;
  created_at: string;
  suggestion?: number;
  mine: boolean;
}
interface Ev {
  id: number;
  kind: string;
  version: number | null;
  suggestion_number: number | null;
  agent: string;
  summary: string;
  created_at: string;
}

type Showing = { kind: "version"; n: number } | { kind: "suggestion"; n: number };
type Tab = "activity" | "suggestions" | "comments" | "files" | "history";

const state = {
  data: null as Data | null,
  showing: (m?.[2] === "s" ? { kind: "suggestion", n: Number(m[3]) } : m?.[2] === "v" ? { kind: "version", n: Number(m[3]) } : null) as Showing | null,
  tab: (m?.[2] === "s" ? "suggestions" : m?.[2] === "v" ? "history" : "activity") as Tab,
  lastEvent: 0,
  openSuggestion: m?.[2] === "s" ? Number(m[3]) : (null as number | null),
  openVersion: m?.[2] === "v" ? Number(m[3]) : (null as number | null),
  openFile: null as string | null,
  editing: false,
  size: "desktop" as "desktop" | "tablet" | "phone",
  showResolved: false,
};

const canEdit = () => state.data?.role === "owner" || state.data?.role === "editor";
const isOwner = () => state.data?.role === "owner";
const signedIn = () => !!state.data?.signed_in;
const base = () => `/api/artifacts/${encodeURIComponent(slug)}`;
const showingHead = () => !state.showing || (state.showing.kind === "version" && state.showing.n === state.data?.artifact.head_version);

// ---------------------------------------------------------------- layout nodes

const titleEl = el("div", { class: "ws-title" });
const badges = el("div", { class: "row tight" });
const actions = el("div", { class: "row tight" });
const stageInfo = el("div", { class: "row tight", style: "min-width: 0; flex: 1" });
const frame = el("iframe", {
  class: "ws-frame",
  title: "Artifact",
  sandbox: "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads",
  referrerpolicy: "no-referrer",
});
const frameWrap = el("div", { class: "ws-frame-wrap", "data-size": "desktop" }, frame);
const tabs = el("div", { class: "tabs", role: "tablist" });
const sideBody = el("div", { class: "side-body" });
const side = el("aside", { class: "ws-side" });
const mobileToggle = el("button", { class: "ws-mobile-toggle", type: "button", onclick: () => side.classList.toggle("open") }, "Activity, suggestions & comments");
side.append(mobileToggle, tabs, sideBody);

function setUrl() {
  const s = state.showing;
  const path = !s || (s.kind === "version" && s.n === state.data?.artifact.head_version) ? `/a/${slug}` : s.kind === "version" ? `/a/${slug}/v/${s.n}` : `/a/${slug}/s/${s.n}`;
  if (location.pathname !== path) history.replaceState(null, "", path);
}

// ---------------------------------------------------------------- stage

let frameFor = "";
async function loadFrame(force = false) {
  const d = state.data!;
  const s = state.showing ?? { kind: "version", n: d.artifact.head_version };
  const key = `${s.kind}:${s.n}`;
  if (!force && key === frameFor) return;
  frameFor = key;
  const q = s.kind === "version" ? `version=${s.n}` : `suggestion=${s.n}`;
  const { url } = await api<{ url: string }>(`${base()}/render?${q}`);
  frame.src = url + (force ? `#r${Date.now()}` : "");
  frame.dataset.url = url;
}

function drawStageInfo() {
  const d = state.data!;
  const s = state.showing ?? { kind: "version", n: d.artifact.head_version };
  stageInfo.replaceChildren();
  if (s.kind === "suggestion") {
    stageInfo.append(el("span", { class: "pill warn" }, `Preview of suggestion #${s.n}`), el("span", { class: "muted" }, "not applied yet"));
  } else if (s.n === d.artifact.head_version) {
    stageInfo.append(el("span", { class: "pill ok" }, `v${s.n} · latest`), agentBadge(d.head.agent, d.head.model), el("span", { class: "muted", style: "overflow: hidden; text-overflow: ellipsis; white-space: nowrap" }, d.head.message));
  } else {
    stageInfo.append(el("span", { class: "pill" }, `v${s.n} of ${d.artifact.head_version}`), el("span", { class: "muted" }, "an earlier version"));
  }
  if (!showingHead()) {
    stageInfo.append(el("button", { class: "btn ghost small", type: "button", onclick: () => show({ kind: "version", n: state.data!.artifact.head_version }) }, "Back to latest"));
  }
}

function show(s: Showing) {
  state.showing = s;
  setUrl();
  drawStageInfo();
  void loadFrame();
}

function sizeButtons() {
  const group = el("div", { class: "row tight", role: "group", "aria-label": "Preview width" });
  for (const [k, label] of [["desktop", "Full"], ["tablet", "Tablet"], ["phone", "Phone"]] as const) {
    const b = el("button", { class: "btn ghost small", type: "button", "aria-pressed": String(state.size === k) }, label);
    b.addEventListener("click", () => {
      state.size = k;
      frameWrap.dataset.size = k;
      for (const x of group.children) x.setAttribute("aria-pressed", String(x === b));
    });
    group.append(b);
  }
  return group;
}

// ---------------------------------------------------------------- header bar

function drawBar() {
  const d = state.data!;
  titleEl.textContent = d.artifact.title;
  document.title = `${d.artifact.title} · Folio`;
  if (isOwner()) {
    titleEl.contentEditable = "true";
    titleEl.title = "Click to rename";
    titleEl.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      }
    };
    titleEl.onblur = async () => {
      const t = titleEl.textContent?.trim() ?? "";
      if (!t || t === d.artifact.title) return void (titleEl.textContent = d.artifact.title);
      await api(base(), { method: "PATCH", json: { title: t } });
      d.artifact.title = t;
      document.title = `${t} · Folio`;
      toast("Renamed");
    };
  }
  badges.replaceChildren(
    el("span", { class: "pill" }, d.role === "owner" ? "Owner" : d.role === "editor" ? "Editor" : "Viewer"),
    el("span", { class: `pill ${d.artifact.visibility === "link" ? "accent" : ""}` }, d.artifact.visibility === "link" ? "Anyone with the link" : "Private")
  );
  const share = el("button", { class: "btn secondary small", type: "button", onclick: () => openShare() }, isOwner() ? "Share" : "Link");
  const fork = el("button", { class: "btn ghost small", type: "button", title: "Copy into a new artifact you own" }, "Fork");
  fork.addEventListener("click", async () => {
    if (!signedIn()) return void (location.href = `/login/?next=${encodeURIComponent(location.pathname)}`);
    fork.disabled = true;
    try {
      const n = state.showing?.kind === "version" ? state.showing.n : undefined;
      const r = await api<{ slug: string }>(`${base()}/fork`, { method: "POST", json: { version: n } });
      location.href = `/a/${r.slug}`;
    } catch (e) {
      toast((e as Error).message, "error");
      fork.disabled = false;
    }
  });
  const dl = el("button", { class: "btn ghost small", type: "button", title: "Download this version as a .zip" }, "Download");
  dl.addEventListener("click", () => {
    const n = state.showing?.kind === "version" ? state.showing.n : d.artifact.head_version;
    download(`${base()}/export.zip?version=${n}`, `${slug}-v${n}.zip`).catch((e) => toast((e as Error).message, "error"));
  });
  const open = el("button", { class: "btn ghost small", type: "button", title: "Open the page on its own" }, "Open ↗");
  open.addEventListener("click", () => frame.dataset.url && window.open(frame.dataset.url, "_blank", "noopener"));
  actions.replaceChildren(open, dl, fork, share);
}

// ---------------------------------------------------------------- tabs

function drawTabs() {
  const d = state.data!;
  const defs: [Tab, string, number][] = [
    ["activity", "Activity", 0],
    ["suggestions", "Suggestions", d.open_suggestions],
    ["comments", "Comments", d.unresolved_comments],
    ["files", "Files", 0],
    ["history", "History", 0],
  ];
  tabs.replaceChildren(
    ...defs.map(([k, label, n]) => {
      const b = el("button", { class: "tab", role: "tab", type: "button", "aria-selected": String(state.tab === k) }, label, n > 0 && el("span", { class: "count" }, n));
      b.addEventListener("click", () => {
        state.tab = k;
        drawTabs();
        void drawSide();
      });
      return b;
    })
  );
}

let sideToken = 0;
async function drawSide() {
  const token = ++sideToken;
  const nodes = await (async () => {
    switch (state.tab) {
      case "activity":
        return activityTab();
      case "suggestions":
        return state.openSuggestion ? suggestionDetail(state.openSuggestion) : suggestionsTab();
      case "comments":
        return commentsTab();
      case "files":
        return filesTab();
      case "history":
        return historyTab();
    }
  })().catch((e: Error) => [el("p", { class: "error" }, e.message)]);
  if (token !== sideToken) return;
  sideBody.replaceChildren(...nodes);
}

function needSignIn(what: string) {
  return el("p", { class: "muted small" }, el("a", { href: `/login/?next=${encodeURIComponent(location.pathname)}` }, "Sign in"), ` to ${what}.`);
}

// activity
async function activityTab(): Promise<Node[]> {
  const r = await api<{ events: Ev[] }>(`${base()}/events`);
  if (r.events.length) state.lastEvent = Math.max(state.lastEvent, r.events[r.events.length - 1].id);
  const list = el(
    "div",
    { class: "timeline" },
    ...[...r.events].reverse().map((e) => {
      const node = el(
        "div",
        { class: "event", style: `--h: ${agentHue(e.agent)}` },
        el("div", { class: "rail" }),
        el("div", { class: "text" }, el("div", { class: "row tight" }, agentBadge(e.agent), el("span", { class: "faint tiny" }, timeAgo(e.created_at))), el("div", {}, e.summary))
      );
      if (e.version || e.suggestion_number) {
        node.style.cursor = "pointer";
        node.addEventListener("click", () => {
          if (e.suggestion_number && e.kind.startsWith("suggest")) {
            state.tab = "suggestions";
            state.openSuggestion = e.suggestion_number;
          } else if (e.version) {
            state.tab = "history";
            state.openVersion = e.version;
            show({ kind: "version", n: e.version });
          }
          drawTabs();
          void drawSide();
        });
      }
      return node;
    })
  );
  return [
    el(
      "div",
      { class: "side-section" },
      el("p", { class: "muted small", style: "margin-bottom: 12px" }, "Everything you and your agents did here, newest first. Updates live."),
      r.events.length ? list : el("p", { class: "muted" }, "Nothing yet.")
    ),
    agentHint(),
  ];
}

function agentHint(): HTMLElement {
  const url = `${location.origin}/a/${slug}`;
  const prompt = `Open my Folio artifact ${url} and `;
  return el(
    "div",
    { class: "side-section item", style: "background: var(--surface-2)" },
    el("strong", { class: "small" }, "Bring in another agent"),
    el("p", { class: "muted small", style: "margin: 6px 0 8px" }, "Give any connected agent the link and what you want, for example “…suggest clearer copy”."),
    el("div", { class: "row tight" }, el("button", { class: "btn secondary small", type: "button", onclick: () => copyText(prompt, "Prompt copied") }, "Copy prompt"), el("a", { class: "btn ghost small", href: "/connect/" }, "Connect an agent"))
  );
}

// suggestions
async function suggestionsTab(): Promise<Node[]> {
  const all = await api<Suggestion[]>(`${base()}/suggestions?status=all`);
  const open = all.filter((s) => s.status === "open");
  const closed = all.filter((s) => s.status !== "open");
  const card = (s: Suggestion) => {
    const n = el(
      "div",
      { class: "item clickable" },
      el(
        "div",
        { class: "head" },
        el("strong", {}, `#${s.number}`),
        el("span", { style: "flex: 1; min-width: 0" }, s.title),
        el("span", { class: `pill ${s.status === "open" ? "accent" : s.status === "accepted" ? "ok" : ""}` }, s.status)
      ),
      el("div", { class: "row tight", style: "margin-top: 6px" }, agentBadge(s.agent, s.model), el("span", { class: "meta" }, `on v${s.base_version} · ${timeAgo(s.created_at)}`))
    );
    n.addEventListener("click", () => {
      state.openSuggestion = s.number;
      void drawSide();
    });
    return n;
  };
  return [
    el("p", { class: "muted small" }, "Changes agents (or people) proposed instead of editing directly. Preview, then accept or reject."),
    open.length ? el("div", {}, ...open.map(card)) : el("p", { class: "muted" }, "No open suggestions."),
    closed.length ? el("div", { class: "side-section" }, el("h3", { class: "muted" }, "Closed"), ...closed.map(card)) : false,
  ].filter(Boolean) as Node[];
}

async function suggestionDetail(n: number): Promise<Node[]> {
  const r = await api<{ suggestion: Suggestion & { ops: unknown[] }; files: FileDiff[]; applies_to_head: boolean; head_version: number }>(`${base()}/suggestions/${n}`);
  const s = r.suggestion;
  const back = el("button", { class: "btn ghost small", type: "button" }, "← All suggestions");
  back.addEventListener("click", () => {
    state.openSuggestion = null;
    if (state.showing?.kind === "suggestion") show({ kind: "version", n: state.data!.artifact.head_version });
    void drawSide();
  });
  const preview = el("button", { class: "btn secondary small", type: "button" }, state.showing?.kind === "suggestion" && state.showing.n === n ? "Previewing" : "Preview");
  preview.addEventListener("click", () => {
    show({ kind: "suggestion", n });
    preview.textContent = "Previewing";
  });
  const note = el("textarea", { placeholder: "Note for the author (optional)", rows: 2 });
  const decide = (decision: "accept" | "reject" | "withdraw") => async (ev: Event) => {
    const b = ev.currentTarget as HTMLButtonElement;
    b.disabled = true;
    try {
      const res = await api<{ status: string; version: number | null }>(`${base()}/suggestions/${n}/review`, { method: "POST", json: { decision, note: note.value } });
      toast(decision === "accept" ? `Accepted as v${res.version}` : decision === "reject" ? "Rejected" : "Withdrawn");
      await refresh(true);
      if (decision === "accept" && res.version) show({ kind: "version", n: res.version });
      void drawSide();
    } catch (e) {
      b.disabled = false;
      toast((e as Error).message, "error");
    }
  };
  const controls: Node[] = [];
  if (s.status === "open") {
    if (canEdit()) {
      controls.push(
        el("div", { class: "composer" }, note, el("div", { class: "row tight" }, el("button", { class: "btn ok small", type: "button", onclick: decide("accept"), disabled: !r.applies_to_head }, "Accept"), el("button", { class: "btn danger small", type: "button", onclick: decide("reject") }, "Reject")))
      );
      if (!r.applies_to_head) controls.push(el("p", { class: "error small" }, `It no longer applies to v${r.head_version}: someone changed the same text. Ask its author to revise it.`));
    } else controls.push(el("p", { class: "muted small" }, "An editor or the owner can accept or reject it."));
  } else {
    controls.push(
      el(
        "p",
        { class: "muted small" },
        `${s.status[0].toUpperCase()}${s.status.slice(1)}${s.resolved_agent ? ` by ${s.resolved_agent === "Web" ? "you (web)" : s.resolved_agent}` : ""}${s.resolved_at ? ` ${timeAgo(s.resolved_at)}` : ""}${s.result_version ? ` as v${s.result_version}` : ""}.${s.resolution_note ? ` “${s.resolution_note}”` : ""}`
      )
    );
  }
  const comments = await api<Comment[]>(`${base()}/comments?resolved=1&suggestion=${n}`);
  return [
    back,
    el(
      "div",
      { class: "side-section" },
      el("h2", {}, `#${s.number} ${s.title}`),
      el("div", { class: "row tight" }, agentBadge(s.agent, s.model), el("span", { class: "meta faint tiny" }, `suggested on v${s.base_version} · ${timeAgo(s.created_at)}`), el("span", { class: `pill ${s.status === "open" ? "accent" : s.status === "accepted" ? "ok" : ""}` }, s.status)),
      s.rationale ? el("div", { class: "item", style: "margin-top: 10px; white-space: pre-wrap; font-size: 13.5px" }, s.rationale) : el("p", { class: "muted small", style: "margin-top: 10px" }, "No rationale given."),
      el("div", { class: "row tight", style: "margin: 10px 0" }, preview),
      ...controls
    ),
    el("div", { class: "side-section" }, el("h3", {}, "Changes"), diffView(r.files)),
    el("div", { class: "side-section" }, el("h3", {}, "Discussion"), ...threads(comments), composer({ suggestion: n })),
  ];
}

// comments
function threads(all: Comment[]): Node[] {
  const tops = all.filter((c) => !c.reply_to);
  if (!tops.length) return [el("p", { class: "muted small" }, "No comments.")];
  return tops.map((c) => {
    const replies = all.filter((r) => r.reply_to === c.id);
    return el("div", { class: "item" }, commentBody(c), ...replies.map((r) => el("div", { class: "item reply" }, commentBody(r))));
  });
}

function commentBody(c: Comment): DocumentFragment {
  const f = document.createDocumentFragment();
  const where = [c.path, c.anchor?.selector, c.anchor?.line ? `line ${c.anchor.line}${c.anchor.end_line ? `–${c.anchor.end_line}` : ""}` : null, c.suggestion ? `#${c.suggestion}` : null].filter(Boolean).join(" · ");
  const tools = el("span", { class: "row tight", style: "margin-left: auto" });
  if (signedIn()) {
    if (!c.reply_to) {
      const reply = el("button", { class: "btn ghost small", type: "button" }, "Reply");
      reply.addEventListener("click", () => {
        const box = composer({ reply_to: c.id, suggestion: c.suggestion }, true);
        reply.closest(".item")!.append(box);
        reply.remove();
        box.querySelector("textarea")?.focus();
      });
      tools.append(reply);
    }
    if (c.mine || canEdit()) {
      const res = el("button", { class: "btn ghost small", type: "button" }, c.resolved ? "Reopen" : "Resolve");
      res.addEventListener("click", async () => {
        await api(`${base()}/comments/${c.id}/resolve`, { method: "POST", json: { resolved: !c.resolved } });
        await refresh(true);
        void drawSide();
      });
      tools.append(res);
    }
  }
  f.append(
    el("div", { class: "head" }, agentBadge(c.agent, c.model), el("span", { class: "meta" }, timeAgo(c.created_at)), c.resolved && el("span", { class: "pill ok" }, "resolved"), tools),
    where ? el("div", { class: "meta mono", style: "margin-top: 4px" }, where) : "",
    c.anchor?.text ? el("div", { class: "meta", style: "margin-top: 4px; font-style: italic" }, `“${c.anchor.text}”`) : "",
    el("div", { class: "body" }, c.body)
  );
  return f;
}

function composer(extra: { suggestion?: number; reply_to?: string; path?: string }, compact = false): HTMLElement {
  if (!signedIn()) return needSignIn("comment");
  const text = el("textarea", { placeholder: extra.reply_to ? "Reply…" : "Comment for people and agents…", rows: compact ? 2 : 3 });
  const fileSel = el("select", { "aria-label": "About file" }, el("option", { value: "" }, "Whole artifact"), ...state.data!.files.map((f) => el("option", { value: f.path, selected: extra.path === f.path }, f.path)));
  const send = el("button", { class: "btn primary small", type: "submit" }, extra.reply_to ? "Reply" : "Comment");
  const form = el("form", { class: "composer" }, text, !extra.reply_to && !extra.suggestion && fileSel, el("div", { class: "row tight" }, send));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!text.value.trim()) return;
    send.disabled = true;
    try {
      await api(`${base()}/comments`, {
        method: "POST",
        json: { body: text.value, suggestion: extra.suggestion, reply_to: extra.reply_to, path: extra.path ?? (fileSel.value || undefined), version: state.showing?.kind === "version" ? state.showing.n : undefined },
      });
      await refresh(true);
      void drawSide();
    } catch (err) {
      send.disabled = false;
      toast((err as Error).message, "error");
    }
  });
  return form;
}

async function commentsTab(): Promise<Node[]> {
  const all = await api<Comment[]>(`${base()}/comments?resolved=${state.showResolved ? 1 : 0}`);
  const toggle = el("label", { class: "row tight small muted" }, el("input", { type: "checkbox", checked: state.showResolved, style: "width: auto" }), "Show resolved");
  toggle.querySelector("input")!.addEventListener("change", (e) => {
    state.showResolved = (e.target as HTMLInputElement).checked;
    void drawSide();
  });
  return [el("div", { class: "row", style: "margin-bottom: 10px" }, el("span", { class: "muted small" }, "Notes from people and agents."), el("span", { class: "spacer" }), toggle), ...threads(all), composer({})];
}

// files
async function filesTab(): Promise<Node[]> {
  const d = state.data!;
  const s = state.showing;
  if (s?.kind === "suggestion") return [el("p", { class: "muted" }, "Files of a suggestion are in its diff. "), el("button", { class: "btn secondary small", type: "button", onclick: () => show({ kind: "version", n: d.artifact.head_version }) }, "Back to latest")];
  const n = s?.n ?? d.artifact.head_version;
  const files = n === d.artifact.head_version ? d.files : (await api<{ files: FileInfo[] }>(`${base()}/versions/${n}`)).files;
  const head = n === d.artifact.head_version;
  const list = el(
    "div",
    { class: "files" },
    ...files.map((f) => {
      const row = el("div", { class: `file-row ${state.openFile === f.path ? "current" : ""}` }, el("span", {}, f.path), el("span", { class: "size" }, f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`));
      row.addEventListener("click", () => {
        state.openFile = f.path;
        state.editing = false;
        void drawSide();
      });
      return row;
    })
  );
  const out: Node[] = [el("div", { class: "row", style: "margin-bottom: 8px" }, el("span", { class: "muted small" }, `${files.length} file${files.length === 1 ? "" : "s"} in v${n}`), el("span", { class: "spacer" }), head && canEdit() && el("button", { class: "btn ghost small", type: "button", onclick: () => newFile() }, "New file")), list];
  const f = files.find((x) => x.path === state.openFile);
  if (f) {
    if (!f.text) out.push(el("p", { class: "muted small", style: "margin-top: 12px" }, `${f.path} is ${f.type}; it isn't shown as text.`));
    else {
      const r = await api<{ content: string }>(`${base()}/file?path=${encodeURIComponent(f.path)}&version=${n}`);
      if (state.editing && head && canEdit()) out.push(editor(f.path, r.content));
      else
        out.push(
          el(
            "div",
            { class: "side-section" },
            el("div", { class: "row", style: "margin-bottom: 6px" }, el("strong", { class: "mono small" }, f.path), el("span", { class: "spacer" }), el("button", { class: "btn ghost small", type: "button", onclick: () => copyText(r.content) }, "Copy"), head && canEdit() && el("button", { class: "btn secondary small", type: "button", onclick: () => ((state.editing = true), void drawSide()) }, "Edit")),
            el("pre", { class: "source" }, r.content)
          )
        );
    }
  }
  return out;
}

function editor(path: string, content: string, isNew = false): HTMLElement {
  const area = el("textarea", { class: "code", rows: 22, spellcheck: "false" });
  area.value = content;
  const pathInput = el("input", { value: path, placeholder: "path, e.g. about.html", class: "mono" });
  const msg = el("input", { placeholder: "What changed (optional)" });
  const save = el("button", { class: "btn primary small", type: "button" }, "Save version");
  const cancel = el("button", { class: "btn ghost small", type: "button" }, "Cancel");
  cancel.addEventListener("click", () => {
    state.editing = false;
    void drawSide();
  });
  const baseVersion = state.data!.artifact.head_version;
  save.addEventListener("click", async () => {
    const p = pathInput.value.trim();
    if (!p) return toast("Give the file a path", "error");
    save.disabled = true;
    try {
      const ops = isNew || p === path ? [{ op: "write", path: p, content: area.value }] : [{ op: "rename", path, to: p }, { op: "write", path: p, content: area.value }];
      const r = await api<{ version: number; rebased_from: number | null }>(`${base()}/edits`, { method: "POST", json: { base_version: baseVersion, ops, message: msg.value || (isNew ? `Add ${p}` : `Edit ${p}`) } });
      toast(r.rebased_from ? `Saved as v${r.version} (merged with newer changes)` : `Saved as v${r.version}`);
      state.editing = false;
      state.openFile = p;
      await refresh(true);
      show({ kind: "version", n: r.version });
      void drawSide();
    } catch (e) {
      save.disabled = false;
      const err = e as ApiError;
      toast(err.body?.code === "stale" ? "Someone saved this file meanwhile. Copy your text, reload and try again." : err.message, "error");
    }
  });
  return el("div", { class: "side-section stack" }, isNew || true ? pathInput : "", area, msg, el("div", { class: "row tight" }, save, cancel), el("p", { class: "muted tiny" }, `Editing on v${baseVersion}. Agents see your change as made by “Web”.`));
}

function newFile() {
  state.openFile = null;
  sideBody.replaceChildren(el("h3", {}, "New file"), editor("", "", true));
}

// history
async function historyTab(): Promise<Node[]> {
  const versions = await api<Version[]>(`${base()}/versions`);
  const head = state.data!.artifact.head_version;
  const out: Node[] = [];
  const sel = state.openVersion;
  if (sel) {
    const v = versions.find((x) => x.number === sel);
    const diff = await api<{ files: FileDiff[]; from: number }>(`${base()}/diff?to=${sel}`);
    const restore = el("button", { class: "btn secondary small", type: "button" }, `Restore v${sel}`);
    restore.addEventListener("click", async () => {
      if (!confirm(`Save a new version with the files of v${sel}? Nothing is lost; history keeps every version.`)) return;
      restore.disabled = true;
      try {
        const r = await api<{ version: number }>(`${base()}/restore`, { method: "POST", json: { version: sel } });
        toast(`Restored as v${r.version}`);
        await refresh(true);
        state.openVersion = r.version;
        show({ kind: "version", n: r.version });
        void drawSide();
      } catch (e) {
        restore.disabled = false;
        toast((e as Error).message, "error");
      }
    });
    out.push(
      el("button", { class: "btn ghost small", type: "button", onclick: () => ((state.openVersion = null), void drawSide()) }, "← All versions"),
      el(
        "div",
        { class: "side-section" },
        el("h2", {}, `Version ${sel}`),
        v && el("div", { class: "row tight" }, agentBadge(v.agent, v.model), el("span", { class: "meta faint tiny" }, timeAgo(v.created_at))),
        v && el("p", { style: "margin: 8px 0" }, v.message || "No message"),
        el("div", { class: "row tight" }, sel !== head && canEdit() && restore, el("span", { class: "muted small" }, diff.from ? `Changes since v${diff.from}` : "First version"))
      ),
      el("div", { class: "side-section" }, diffView(diff.files))
    );
    return out;
  }
  out.push(el("p", { class: "muted small" }, "Every version, with the agent that made it. Click one to see it and what changed."));
  for (const v of versions) {
    const kind = v.kind === "suggestion" ? `accepted #${v.suggestion ?? ""}` : v.kind === "restore" ? `restored v${v.restored_from}` : v.kind === "fork" ? "forked" : v.kind === "create" ? "created" : "";
    const cur = state.showing?.kind === "version" ? state.showing.n === v.number : v.number === head;
    const item = el(
      "div",
      { class: `item clickable ${cur ? "current" : ""}` },
      el("div", { class: "head" }, el("strong", {}, `v${v.number}`), agentBadge(v.agent, v.model), kind && el("span", { class: "pill" }, kind), el("span", { class: "meta", style: "margin-left: auto" }, timeAgo(v.created_at))),
      el("div", { class: "body muted" }, v.message || "No message")
    );
    item.addEventListener("click", () => {
      state.openVersion = v.number;
      show({ kind: "version", n: v.number });
      void drawSide();
    });
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------- share dialog

async function openShare() {
  const d = state.data!;
  const url = `${location.origin}/a/${slug}`;
  const dlg = el("dialog", {});
  const body = el("div", { class: "dialog-body" });
  const close = el("button", { class: "btn secondary", type: "button", onclick: () => dlg.close() }, "Done");
  dlg.append(body, el("div", { class: "dialog-foot" }, close));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();

  const draw = async () => {
    body.replaceChildren(spinner());
    const linkRow = el("div", { class: "row", style: "flex-wrap: nowrap" }, el("input", { value: url, readonly: true, class: "mono", onclick: (e: Event) => (e.target as HTMLInputElement).select() }), el("button", { class: "btn secondary", type: "button", onclick: () => copyText(url, "Link copied") }, "Copy"));
    if (!isOwner()) {
      const leave = signedIn() && el("button", { class: "btn danger small", type: "button" }, "Leave this artifact");
      if (leave)
        leave.addEventListener("click", async () => {
          if (!confirm("Leave? You (and your agents) will lose access until invited again.")) return;
          const me = await api<{ id: string }>("/api/me");
          await api(`${base()}/members/${me.id}`, { method: "DELETE" });
          location.href = "/app/";
        });
      body.replaceChildren(el("h2", {}, "Link"), el("p", { class: "muted small" }, d.artifact.visibility === "link" ? "Anyone with this link can view it." : "Only people the owner invited can open this link."), linkRow, el("hr", {}), leave || "");
      return;
    }
    const s = await api<{ owner: { email: string | null }; members: { user_id: string; role: string; email: string | null }[]; invites: { id: string; role: string; uses: number; expires_at: string | null; created_at: string }[]; visibility: string }>(`${base()}/sharing`);
    const vis = el("select", {}, el("option", { value: "private", selected: s.visibility === "private" }, "Private: only people invited"), el("option", { value: "link", selected: s.visibility === "link" }, "Anyone with the link can view"));
    vis.addEventListener("change", async () => {
      await api(base(), { method: "PATCH", json: { visibility: vis.value } });
      d.artifact.visibility = vis.value as "private" | "link";
      drawBar();
      frameFor = "";
      void loadFrame();
      toast(vis.value === "link" ? "Anyone with the link can view" : "Private");
    });
    const role = el("select", { style: "width: auto" }, el("option", { value: "editor" }, "Can edit"), el("option", { value: "viewer" }, "Can view, comment and suggest"));
    const made = el("div", {});
    const mk = el("button", { class: "btn secondary", type: "button" }, "Make invite link");
    mk.addEventListener("click", async () => {
      mk.disabled = true;
      const r = await api<{ url: string }>(`${base()}/invites`, { method: "POST", json: { role: role.value, expires_in_days: 30 } });
      made.replaceChildren(el("div", { class: "row", style: "flex-wrap: nowrap; margin-top: 8px" }, el("input", { value: r.url, readonly: true, class: "mono" }), el("button", { class: "btn primary", type: "button", onclick: () => copyText(r.url, "Invite link copied") }, "Copy")), el("p", { class: "muted tiny", style: "margin: 6px 0 0" }, "Works for 30 days for anyone signed in to Folio. Their agents get the same access."));
      mk.disabled = false;
    });
    const members = el(
      "div",
      { class: "list", style: "margin-top: 8px" },
      el("div", { class: "list-row" }, el("span", {}, s.owner.email ?? "You"), el("span", { class: "spacer" }), el("span", { class: "pill" }, "Owner")),
      ...s.members.map((mm) => {
        const sel = el("select", { style: "width: auto" }, el("option", { value: "editor", selected: mm.role === "editor" }, "Editor"), el("option", { value: "viewer", selected: mm.role === "viewer" }, "Viewer"));
        sel.addEventListener("change", async () => {
          await api(`${base()}/members/${mm.user_id}`, { method: "PATCH", json: { role: sel.value } });
          toast("Role changed");
        });
        const rm = el("button", { class: "btn ghost small", type: "button" }, "Remove");
        rm.addEventListener("click", async () => {
          await api(`${base()}/members/${mm.user_id}`, { method: "DELETE" });
          void draw();
        });
        return el("div", { class: "list-row" }, el("span", {}, mm.email ?? "Someone"), el("span", { class: "spacer" }), sel, rm);
      })
    );
    const invites = s.invites.length
      ? el(
          "div",
          { class: "list", style: "margin-top: 8px" },
          ...s.invites.map((i) => {
            const rv = el("button", { class: "btn ghost small", type: "button" }, "Turn off");
            rv.addEventListener("click", async () => {
              await api(`${base()}/invites/${i.id}`, { method: "DELETE" });
              void draw();
            });
            return el("div", { class: "list-row small" }, el("span", {}, `${i.role === "editor" ? "Editor" : "Viewer"} link · used ${i.uses}×`), el("span", { class: "muted" }, i.expires_at ? `until ${new Date(i.expires_at).toLocaleDateString()}` : "no expiry"), el("span", { class: "spacer" }), rv);
          })
        )
      : "";
    const del = el("button", { class: "btn danger small", type: "button" }, "Delete artifact");
    del.addEventListener("click", async () => {
      if (prompt(`Delete "${d.artifact.title}" with every version, suggestion and comment? This can't be undone.\n\nType DELETE to confirm.`) !== "DELETE") return;
      await api(base(), { method: "DELETE" });
      location.href = "/app/";
    });
    body.replaceChildren(
      el("h2", {}, "Share"),
      el("label", { class: "field" }, "Who can view", vis),
      el("div", { style: "margin-top: 10px" }, linkRow),
      el("hr", {}),
      el("h3", {}, "Invite people"),
      el("div", { class: "row", style: "flex-wrap: nowrap" }, role, mk),
      made,
      invites,
      el("h3", { style: "margin-top: 18px" }, "People"),
      members,
      el("hr", {}),
      el("div", { class: "row" }, el("span", { class: "muted small", style: "flex: 1" }, "Agents act with their person's access."), del)
    );
  };
  await draw();
}

// ---------------------------------------------------------------- data + polling

async function refresh(quiet = false) {
  const prevHead = state.data?.artifact.head_version;
  const d = await api<Data>(base());
  state.data = d;
  drawBar();
  drawTabs();
  if (!state.showing) state.showing = { kind: "version", n: d.artifact.head_version };
  else if (state.showing.kind === "version" && prevHead && state.showing.n === prevHead && d.artifact.head_version !== prevHead) {
    // We were watching the latest; follow it.
    state.showing = { kind: "version", n: d.artifact.head_version };
    if (!quiet) toast(`New version v${d.artifact.head_version} by ${d.head.agent === "Web" ? "you (web)" : d.head.agent}`);
  }
  drawStageInfo();
  void loadFrame();
}

async function poll() {
  if (document.hidden || !state.data) return;
  try {
    const r = await api<{ head_version: number; events: Ev[] }>(`${base()}/events?after=${state.lastEvent}`);
    if (!r.events.length) return;
    state.lastEvent = r.events[r.events.length - 1].id;
    await refresh();
    if (!state.editing) void drawSide();
  } catch {
    /* offline or signed out; try again later */
  }
}

async function start() {
  root.replaceChildren(spinner());
  if (!slug) return location.replace("/app/");
  try {
    await refresh(true);
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 404 && !(await currentSession())) {
      root.replaceChildren(el("div", { class: "wrap narrow" }, signInView({ title: "Sign in to open this", message: "This artifact is private. Sign in with an account it's shared with.", redirectTo: location.href, onSignedIn: start })));
      return;
    }
    root.replaceChildren(el("div", { class: "wrap narrow" }, el("div", { class: "panel signin" }, el("h1", {}, "Can't open this artifact"), el("p", { class: "muted" }, err.message), el("a", { class: "btn secondary", href: "/app/" }, "Your artifacts"))));
    return;
  }
  const stagebar = el("div", { class: "ws-stagebar" }, stageInfo, sizeButtons(), el("button", { class: "btn ghost small", type: "button", title: "Reload the page", onclick: () => loadFrame(true) }, "Reload"));
  root.replaceChildren(
    el("div", { class: "ws-bar" }, el("a", { href: "/app/", class: "btn ghost small", title: "All artifacts" }, "←"), titleEl, badges, el("span", { class: "spacer" }), actions),
    el("div", { class: "ws-body" }, el("section", { class: "ws-stage" }, stagebar, frameWrap), side)
  );
  setUrl();
  await drawSide();
  setInterval(poll, 5000);
  document.addEventListener("visibilitychange", () => !document.hidden && void poll());
}
void start();
