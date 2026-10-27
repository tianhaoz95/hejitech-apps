// /settings: synced workspace layout, non-secret SSH host metadata, bookmarks, MCP assistants, and account data deletion.
import { type Bookmark, type SshHost, type WorkspaceSnapshot } from "@tether/core";
import { api, el, requireSession, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;

async function render() {
  root.replaceChildren(spinner());
  const session = await requireSession(root, render);
  if (!session) return;

  const r = await api<WorkspaceSnapshot & { saved: boolean; email: string | null }>("/api/workspace");
  if (!r.ok) {
    root.replaceChildren(el("p", { class: "error" }, "Couldn't load your workspace. Reload to try again."));
    return;
  }

  const hostsList = el("ul", { class: "list" });
  const refreshHosts = async () => {
    const hr = await api<SshHost[]>("/api/hosts");
    hostsList.replaceChildren(
      ...(hr.ok && hr.body.length
        ? hr.body.map((h) =>
            el(
              "li",
              {},
              el(
                "div",
                {},
                el("strong", { class: "mono" }, `${h.username}@${h.host}:${h.port}`),
                el("span", { class: "muted small", style: "margin-left: 8px" }, `auth: ${h.auth} (${h.id})`)
              ),
              el(
                "button",
                {
                  class: "btn sm danger",
                  type: "button",
                  onclick: async () => {
                    if (!confirm(`Delete SSH host metadata ${h.username}@${h.host}?`)) return;
                    await api(`/api/hosts/${encodeURIComponent(h.id)}`, { method: "DELETE" });
                    await refreshHosts();
                  },
                },
                "Delete"
              )
            )
          )
        : [el("li", {}, el("span", { class: "muted small" }, "No synced SSH hosts yet."))])
    );
  };
  await refreshHosts();

  const hostInput = el("input", { type: "text", placeholder: "Hostname or IP (e.g. dev.example.com)" });
  const userInput = el("input", { type: "text", placeholder: "Username (e.g. ubuntu)" });
  const portInput = el("input", { type: "number", value: "22", min: "1", max: "65535" });
  const addHostBtn = el("button", { class: "btn secondary", type: "button" }, "Add SSH Host Metadata");
  addHostBtn.addEventListener("click", async () => {
    if (!hostInput.value.trim() || !userInput.value.trim()) return;
    await api("/api/hosts", {
      method: "POST",
      body: JSON.stringify({
        id: `host-${Date.now()}`,
        host: hostInput.value.trim(),
        port: Number(portInput.value || 22),
        username: userInput.value.trim(),
        auth: "key",
        autoReconnectOnDisplayReconnect: false,
      }),
    });
    hostInput.value = "";
    userInput.value = "";
    await refreshHosts();
  });

  const bmList = el("ul", { class: "list" });
  const refreshBookmarks = async () => {
    const br = await api<Bookmark[]>("/api/bookmarks");
    bmList.replaceChildren(
      ...(br.ok && br.body.length
        ? br.body.map((b) =>
            el(
              "li",
              {},
              el("div", {}, el("strong", {}, b.title), el("span", { class: "muted small mono", style: "margin-left: 8px" }, b.url)),
              el(
                "button",
                {
                  class: "btn sm danger",
                  type: "button",
                  onclick: async () => {
                    await api(`/api/bookmarks/${encodeURIComponent(b.id)}`, { method: "DELETE" });
                    await refreshBookmarks();
                  },
                },
                "Remove"
              )
            )
          )
        : [el("li", {}, el("span", { class: "muted small" }, "No bookmarks saved yet."))])
    );
  };
  await refreshBookmarks();

  const assistants = await assistantsPanel();

  root.replaceChildren(
    el(
      "div",
      { class: "panel" },
      el(
        "div",
        { class: "panel-header" },
        el("h1", {}, "Workspace Sync & Hosts"),
        r.body.email ? el("span", { class: "badge accent" }, r.body.email) : null
      ),
      el(
        "p",
        { class: "muted small" },
        "Non-secret SSH host metadata, tiling layout presets, and bookmarks sync across your iPhone, Android phone, and MCP assistant. Private keys, passwords, passphrases, and known_hosts fingerprints never leave your device's Keychain / Keystore (PRD §14)."
      )
    ),
    el(
      "div",
      { class: "panel stack" },
      el("div", { class: "panel-header" }, el("h2", {}, "Saved SSH Hosts (Metadata Only)"), el("span", { class: "badge" }, "No secrets stored")),
      hostsList,
      el("div", { class: "row" }, hostInput, userInput, portInput, addHostBtn)
    ),
    el(
      "div",
      { class: "panel stack" },
      el("div", { class: "panel-header" }, el("h2", {}, "Browser Bookmarks")),
      bmList
    ),
    assistants,
    dangerPanel()
  );
}

async function assistantsPanel() {
  const grants = el("ul", { class: "list" });
  const tokens = el("ul", { class: "list" });
  const fresh = el("div", {});

  const refresh = async () => {
    const [g, t] = await Promise.all([
      api<{ id: string; client_name: string | null; created_at: string }[]>("/api/grants"),
      api<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>("/api/tokens"),
    ]);
    grants.replaceChildren(
      ...(g.ok && g.body.length
        ? g.body.map((x) =>
            el(
              "li",
              {},
              el("span", {}, x.client_name ?? "An assistant"),
              el(
                "button",
                {
                  class: "btn sm danger",
                  type: "button",
                  onclick: async () => {
                    await api(`/api/grants/${encodeURIComponent(x.id)}`, { method: "DELETE" });
                    await refresh();
                  },
                },
                "Disconnect"
              )
            )
          )
        : [el("li", {}, el("span", { class: "muted small" }, "No assistants connected via OAuth."))])
    );
    tokens.replaceChildren(
      ...(t.ok
        ? t.body.map((x) =>
            el(
              "li",
              {},
              el("span", {}, `${x.name} (${x.last_used_at ? `last used ${new Date(x.last_used_at).toLocaleString()}` : "never used"})`),
              el(
                "button",
                {
                  class: "btn sm danger",
                  type: "button",
                  onclick: async () => {
                    await api(`/api/tokens/${x.id}`, { method: "DELETE" });
                    await refresh();
                  },
                },
                "Revoke"
              )
            )
          )
        : [])
    );
  };
  await refresh();

  const mcpUrl = `${location.origin}/mcp`;
  const make = el("button", { class: "btn secondary", type: "button" }, "Create personal token");
  make.addEventListener("click", async () => {
    make.disabled = true;
    const r = await api<{ token: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name: "Assistant" }) });
    make.disabled = false;
    if (r.ok) {
      fresh.replaceChildren(
        el("p", { class: "small muted" }, "Copy your personal token now — it won't be shown again:"),
        el("div", { class: "secret-box" }, el("code", { class: "mono" }, r.body.token))
      );
    }
    await refresh();
  });

  return el(
    "section",
    { class: "panel stack" },
    el("div", { class: "panel-header" }, el("h2", {}, "Assistants (MCP)"), el("span", { class: "badge" }, "OAuth 2.1 · ttr_ tokens")),
    el("p", { class: "muted small" }, "Connect Claude, Cursor, or any MCP client to arrange your workspace layout and manage host entries:"),
    el("div", { class: "secret-box" }, el("span", { class: "mono small" }, mcpUrl)),
    grants,
    tokens,
    fresh,
    el("div", { class: "row" }, make)
  );
}

function dangerPanel() {
  const del = el("button", { class: "btn danger", type: "button" }, "Delete my Tether data");
  del.addEventListener("click", async () => {
    if (!confirm("Delete your synced workspace, SSH host metadata, bookmarks, and assistant connections from Tether?")) return;
    const r = await api("/api/account", { method: "DELETE" });
    if (r.ok) {
      await supabase.auth.signOut();
      location.href = "/";
    } else alert("Couldn't delete. Try again.");
  });
  return el(
    "section",
    { class: "panel row-between" },
    el(
      "div",
      {},
      el("h2", {}, "Delete account data"),
      el("p", { class: "muted small" }, "Immediately removes your synced workspace, host metadata, bookmarks, and assistant grants.")
    ),
    del
  );
}

render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
