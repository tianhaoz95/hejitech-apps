// Account: the household at a glance, agent access (tokens and OAuth grants), CSV export and
// deleting the household's data. Everything goes through the same RPCs and RLS as the app.
import { derive, status, statusLine, type LogEvent } from "@weehours/core";
import { currentSession, el, signInView, spinner, supabase } from "./supabase.ts";

interface Household {
  id: string;
  name: string;
  baby_id: string;
  baby_name: string;
  birth_date: string | null;
  bottle_ml?: number;
  babies?: Child[];
  caregivers: { id: string; name: string; role?: string | null }[];
}

interface Child {
  id: string;
  name: string;
  birth_date: string | null;
  bottle_ml?: number;
  archived?: boolean;
}

/** The household's children that aren't archived (servers before several children: the one baby). */
function children(h: Household): Child[] {
  const active = (h.babies ?? []).filter((b) => !b.archived);
  return active.length ? active : [{ id: h.baby_id, name: h.baby_name, birth_date: h.birth_date }];
}

/** What deleting asks you to type: the child's name, or the household's when there are several. */
const confirmWord = (h: Household) => (children(h).length > 1 ? h.name : h.baby_name);

function ageText(birth: string | null) {
  const age = birth ? Math.floor((Date.now() - Date.parse(birth)) / DAY) : null;
  return age === null ? "" : age < 14 ? `${age} days old` : age < 120 ? `${Math.floor(age / 7)} weeks old` : `${Math.floor(age / 30)} months old`;
}

interface Token {
  id: string;
  name: string;
  scope: "read" | "write";
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface Entitlement {
  trial_started_at: string;
  plan: "monthly" | "yearly" | "lifetime" | null;
  expires_at: string | null;
}

const root = document.getElementById("app")!;
const DAY = 86_400_000;

function show(...nodes: Node[]) {
  root.replaceChildren(...nodes);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function relative(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return fmtDate(iso);
}

/** Mirrors Entitlement.access(now:) in LogCore. */
function access(e: Entitlement | null): { label: string; active: boolean } {
  if (!e) return { label: "Free", active: false };
  if (e.plan === "lifetime") return { label: "Plus · lifetime", active: true };
  if (e.plan && e.expires_at && Date.parse(e.expires_at) > Date.now()) {
    return { label: `Plus · ${e.plan}, renews or ends ${fmtDate(e.expires_at)}`, active: true };
  }
  const trialEnd = Date.parse(e.trial_started_at) + 14 * DAY;
  if (trialEnd > Date.now()) {
    const days = Math.ceil((trialEnd - Date.now()) / DAY);
    return { label: `Plus trial · ${days} day${days === 1 ? "" : "s"} left`, active: true };
  }
  return { label: "Free · trial ended", active: false };
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function allEvents(householdId: string): Promise<LogEvent[]> {
  const out: LogEvent[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("events").select("*").eq("household_id", householdId).order("seq").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as LogEvent[]));
    if (data.length < 1000) return out;
  }
}

// ------------------------------------------------------------------ panels

function householdPanel(h: Household, ent: Entitlement | null, lines: { child: Child; line: string }[]) {
  const plan = access(ent);
  const one = lines.length === 1;
  const sub = [one ? ageText(lines[0].child.birth_date) : "", h.caregivers.map((c) => (c.role ? `${c.name} (${c.role})` : c.name)).join(", ")].filter(Boolean).join(" · ");
  return el(
    "div",
    { class: "panel" },
    el("div", { class: "head" },
      el("div", {}, el("h2", {}, one ? lines[0].child.name : h.name), el("div", { class: "muted small" }, sub)),
      el("span", { class: plan.active ? "pill write" : "pill" }, plan.label),
    ),
    ...(one
      ? [el("div", { class: "status-line" }, lines[0].line)]
      : lines.map(({ child, line }) =>
          el("div", { style: "margin-top: 14px" },
            el("div", { class: "small" }, el("b", {}, child.name), el("span", { class: "muted" }, ageText(child.birth_date) ? ` · ${ageText(child.birth_date)}` : "")),
            el("div", { class: "status-line", style: "margin-top: 4px" }, line)))),
    el("p", { class: "muted small", style: "margin: 12px 0 0" },
      "Logging happens in the app. Subscriptions are managed in the App Store: ",
      el("a", { href: "https://apps.apple.com/account/subscriptions", target: "_blank", rel: "noopener" }, "manage subscription"),
      ".",
    ),
  );
}

function tokensPanel(tokens: Token[], reload: () => void) {
  const name = el("input", { type: "text", value: "My assistant", "aria-label": "Token name", maxlength: "60" });
  const write = el("input", { type: "checkbox" });
  const result = el("div", { class: "secret", hidden: true });
  const error = el("p", { class: "error", hidden: true });

  const create = el("button", { class: "btn primary", type: "button" }, "Create token");
  create.addEventListener("click", async () => {
    error.hidden = true;
    create.disabled = true;
    try {
      const token = await rpc<string>("create_access_token", { p_name: name.value.trim() || "My assistant", p_scope: write.checked ? "write" : "read" });
      const code = el("code", { id: "new-token" }, token);
      result.replaceChildren(
        el("div", { class: "copybox" }, code, el("button", { class: "btn secondary small", "data-copy": "#new-token" }, "Copy")),
        el("p", { class: "small", style: "color: var(--feed); margin: 8px 0 0" }, "Copy it now. It's shown only once, and we store only a hash."),
      );
      result.hidden = false;
      list.replaceWith((list = tokenList(await loadTokens(), reload)));
    } catch (e) {
      error.textContent = (e as Error).message;
      error.hidden = false;
    } finally {
      create.disabled = false;
    }
  });

  let list = tokenList(tokens, reload);
  return el(
    "div",
    { class: "panel" },
    el("div", { class: "head" },
      el("div", {}, el("h2", {}, "Access tokens"), el("p", { class: "muted small", style: "margin: 0" }, "For assistants that can't sign in. ", el("a", { href: "/agents/" }, "Setup guide"))),
    ),
    el("div", { class: "row" }, el("div", { style: "flex: 1; min-width: 200px" }, name), create),
    el("label", { class: "check", style: "margin-top: 10px" }, write, "Allow logging (write access)"),
    result,
    error,
    el("div", { style: "margin-top: 18px" }, list),
  );
}

function tokenList(tokens: Token[], reload: () => void) {
  if (!tokens.length) return el("p", { class: "muted small" }, "No tokens yet.");
  return el(
    "div",
    { class: "list" },
    ...tokens.map((t) => {
      const meta = `${t.scope === "write" ? "read + write" : "read only"} · created ${fmtDate(t.created_at)} · ${t.last_used_at ? `used ${relative(t.last_used_at)}` : "never used"}`;
      const action = t.revoked_at
        ? el("span", {}, el("span", { class: "pill" }, "revoked"), " ", el("button", {
            class: "btn small",
            type: "button",
            onclick: async () => {
              await rpc("delete_access_token", { p_id: t.id }).catch((e) => alert(e.message));
              reload();
            },
          }, "Delete"))
        : el("button", {
            class: "btn danger small",
            type: "button",
            onclick: async () => {
              if (!confirm(`Revoke "${t.name}"? Assistants using it lose access immediately.`)) return;
              await rpc("revoke_access_token", { p_id: t.id }).catch((e) => alert(e.message));
              reload();
            },
          }, "Revoke");
      return el("div", { class: "item" }, el("div", {}, el("div", {}, t.name), el("div", { class: "muted small" }, meta)), action);
    }),
  );
}

interface Grant { id: string; client_name: string | null; client_uri: string | null; created_at: string }

/** OAuth grants live in this site's Worker (src/worker), not in Supabase: ask it with the session. */
async function grantsApi(method: "GET" | "DELETE", path = ""): Promise<Response> {
  const session = await currentSession();
  return fetch(`/api/grants${path}`, { method, headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } });
}

async function grantsPanel(reload: () => void) {
  const res = await grantsApi("GET");
  if (!res.ok) return null; // e.g. `npm run dev` (Vite only, no Worker)
  const data = (await res.json()) as Grant[];
  if (!data.length) return null;
  return el(
    "div",
    { class: "panel" },
    el("h2", {}, "Connected assistants"),
    el("p", { class: "muted small" }, "Assistants you approved by signing in."),
    el(
      "div",
      { class: "list" },
      ...data.map((g) =>
        el("div", { class: "item" },
          el("div", {}, el("div", {}, g.client_name || "Unnamed client"), el("div", { class: "muted small" }, `connected ${fmtDate(g.created_at)}`)),
          el("button", {
            class: "btn danger small",
            type: "button",
            onclick: async () => {
              if (!confirm(`Disconnect ${g.client_name || "this assistant"}?`)) return;
              const r = await grantsApi("DELETE", `/${encodeURIComponent(g.id)}`);
              if (!r.ok) alert(`Couldn't disconnect (${r.status})`);
              reload();
            },
          }, "Disconnect"),
        ),
      ),
    ),
  );
}

function csv(events: LogEvent[], h: Household): string {
  const d = derive(events);
  const names = new Map(h.caregivers.map((c) => [c.id, c.name]));
  const babies = h.babies ?? [{ id: h.baby_id, name: h.baby_name, birth_date: h.birth_date }];
  const child = (id: string) => babies.find((b) => b.id === id);
  const bottleFor = (id: string) => child(id)?.bottle_ml ?? h.bottle_ml ?? 120;
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
  const lines = ["occurred_at,child,type,details,ml,logged_by,surface,input,transcript,confidence_tier"];
  for (const e of d.effective) {
    if (d.status.get(e.id) !== "active") continue;
    const f = e.fields;
    const ml = typeof f.consumed_ml === "number" ? f.consumed_ml : typeof f.consumed_fraction === "number" ? Math.round(f.consumed_fraction * bottleFor(e.baby_id)) : null;
    const details = Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join(" ");
    const cols = [new Date(e.occurred_at).toISOString(), child(e.baby_id)?.name ?? h.baby_name, e.type, details, ml === null ? "" : String(Math.trunc(ml)), names.get(e.logged_by) ?? "someone",
      e.provenance.surface, e.provenance.input, e.provenance.raw_transcript ?? "", e.provenance.confidence_tier ?? ""];
    lines.push(cols.map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}

function dataPanel(h: Household, ent: Entitlement | null) {
  const exportBtn = el("button", { class: "btn secondary", type: "button" }, "Export CSV");
  const exportNote = el("p", { class: "muted small", style: "margin: 8px 0 0" }, "Every active entry, in the same format as the app's export.");
  if (!access(ent).active) {
    exportBtn.disabled = true;
    exportNote.textContent = "CSV export is part of Plus.";
  }
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      const blob = new Blob([csv(await allEvents(h.id), h)], { type: "text/csv" });
      const a = el("a", { href: URL.createObjectURL(blob), download: `${children(h).length > 1 ? h.name : h.baby_name}-log.csv` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      exportBtn.disabled = false;
    }
  });

  const word = confirmWord(h);
  const confirmInput = el("input", { type: "text", placeholder: `Type ${word}`, "aria-label": `Type ${word} to confirm`, autocomplete: "off" });
  const del = el("button", { class: "btn danger", type: "button", disabled: true }, "Delete all household data");
  confirmInput.addEventListener("input", () => (del.disabled = confirmInput.value.trim() !== word));
  del.addEventListener("click", async () => {
    del.disabled = true;
    try {
      // Storage only deletes through its API: remove the capture audio first, then the rows.
      const audio = supabase.storage.from("weehours");
      const { data: files } = await audio.list(h.id, { limit: 1000 });
      if (files?.length) await audio.remove(files.map((f) => `${h.id}/${f.name}`));
      await rpc("delete_household");
      await supabase.auth.signOut();
      show(el("div", { class: "panel signin" }, el("h1", { style: "font-size: 28px" }, "Deleted"), el("p", { class: "muted" }, "Your household's log, voice captures and access tokens have been deleted from our servers. Entries still on a phone stay there until you delete the app or its data.")));
    } catch (e) {
      alert((e as Error).message);
      del.disabled = false;
    }
  });

  return [
    el("div", { class: "panel" }, el("h2", {}, "Your data"), el("div", { style: "margin-top: 12px" }, exportBtn), exportNote),
    el(
      "div",
      { class: "panel danger-zone" },
      el("h2", {}, "Delete household data"),
      el("p", { class: "muted small" }, `This permanently deletes ${children(h).length > 1 ? "every child's" : `${h.baby_name}'s`} log, voice captures, invites and access tokens for everyone in the household. It can't be undone. Type `, el("b", {}, word), " to confirm."),
      el("div", { class: "row" }, el("div", { style: "flex: 1; min-width: 200px" }, confirmInput), del),
    ),
  ];
}

// ------------------------------------------------------------------ page

async function loadTokens(): Promise<Token[]> {
  const { data, error } = await supabase.from("access_tokens").select("id, name, scope, created_at, last_used_at, revoked_at").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Token[];
}

async function render() {
  show(spinner());
  const session = await currentSession();
  if (!session) {
    show(signInView({ title: "Your account", message: "Sign in to manage AI assistant access, export your log or delete your data.", redirectTo: location.href, onSignedIn: render }));
    return;
  }

  const signOut = el("button", { class: "btn secondary small", type: "button", onclick: async () => { await supabase.auth.signOut(); render(); } }, "Sign out");
  const header = el("div", { class: "head", style: "display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px" },
    el("div", {}, el("h1", { style: "font-size: 34px; margin: 0" }, "Account"), el("div", { class: "muted small" }, session.user.email ?? "")),
    signOut,
  );

  try {
    const h = await rpc<Household | null>("my_household");
    if (!h) {
      show(header, el("div", { class: "panel" }, el("h2", {}, "No household yet"), el("p", { class: "muted", style: "margin: 0" }, "Create your household in the Wee Hours iPhone app, or join your partner's with an invite code. Then come back here.")));
      return;
    }
    const since = new Date(Date.now() - 3 * DAY).toISOString();
    const [ent, recent, pending, picks, tokens] = await Promise.all([
      rpc<Entitlement | null>("my_entitlement"),
      supabase.from("events").select("*").eq("household_id", h.id).or(`occurred_at.gte.${since},logged_at.gte.${since}`).order("seq").limit(2000),
      supabase.from("captures").select("id", { count: "exact", head: true }).eq("household_id", h.id).eq("status", "pending"),
      supabase.from("captures").select("id", { count: "exact", head: true }).eq("household_id", h.id).eq("status", "needs_review"),
      loadTokens(),
    ]);
    const kids = children(h);
    const counts = kids.length === 1 ? { pendingCaptures: pending.count ?? 0, pendingPicks: picks.count ?? 0 } : {};
    const lines = kids.map((child) => ({ child, line: statusLine(status(derive((recent.data ?? []) as LogEvent[], child.id), counts), Date.now()) }));
    const grants = await grantsPanel(render).catch(() => null);
    show(header, householdPanel(h, ent, lines), tokensPanel(tokens, render), ...(grants ? [grants] : []), ...dataPanel(h, ent));
  } catch (e) {
    show(header, el("div", { class: "panel" }, el("p", { class: "error", style: "margin: 0" }, `Couldn't load your account: ${(e as Error).message}`)));
  }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" && location.search.includes("code=")) history.replaceState(null, "", location.pathname);
});
render();
