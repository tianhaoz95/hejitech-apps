// Settings: connected agents (OAuth grants), agent tokens, and deleting everything Folio keeps.
import { api, copyText, el, requireSession, spinner, timeAgo, toast } from "./common.ts";

const root = document.getElementById("app")!;

async function render() {
  root.replaceChildren(spinner());
  const s = await requireSession(root, render);
  if (!s) return;
  const [grants, tokens] = await Promise.all([
    api<{ id: string; client_name: string | null; created_at: string }[]>("/api/grants"),
    api<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>("/api/tokens"),
  ]);

  const grantList = el(
    "div",
    { class: "list" },
    grants.length
      ? grants.map((g) =>
          el(
            "div",
            { class: "list-row" },
            el("div", {}, el("strong", {}, g.client_name ?? "Unnamed agent"), el("div", { class: "muted small" }, `Connected ${timeAgo(g.created_at)}`)),
            el("span", { class: "spacer" }),
            el(
              "button",
              {
                class: "btn danger small",
                type: "button",
                onclick: async () => {
                  if (!confirm(`Disconnect ${g.client_name ?? "this agent"}? It will have to sign in again.`)) return;
                  await api(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE" });
                  toast("Disconnected");
                  render();
                },
              },
              "Disconnect"
            )
          )
        )
      : el("div", { class: "empty" }, "No agents connected yet. ", el("a", { href: "/connect/" }, "Connect one"), ".")
  );

  const tokenName = el("input", { placeholder: "Token name, e.g. My script", maxlength: 60 });
  const newToken = el("div", { hidden: true });
  const tokenList = el(
    "div",
    { class: "list" },
    tokens.length
      ? tokens.map((t) =>
          el(
            "div",
            { class: "list-row" },
            el("div", {}, el("strong", {}, t.name), el("div", { class: "muted small" }, `Made ${timeAgo(t.created_at)} · ${t.last_used_at ? `last used ${timeAgo(t.last_used_at)}` : "never used"}`)),
            el("span", { class: "spacer" }),
            el(
              "button",
              {
                class: "btn danger small",
                type: "button",
                onclick: async () => {
                  if (!confirm(`Delete the token "${t.name}"? Anything using it stops working.`)) return;
                  await api(`/api/tokens/${t.id}`, { method: "DELETE" });
                  render();
                },
              },
              "Delete"
            )
          )
        )
      : el("div", { class: "empty" }, "No tokens. Most agents sign in with OAuth and don't need one.")
  );
  const make = el("button", { class: "btn secondary", type: "button" }, "Make token");
  make.addEventListener("click", async () => {
    make.disabled = true;
    try {
      const r = await api<{ token: string }>("/api/tokens", { method: "POST", json: { name: tokenName.value || "Agent" } });
      newToken.hidden = false;
      newToken.replaceChildren(
        el(
          "div",
          { class: "panel flat", style: "margin-top: 12px" },
          el("strong", {}, "Copy it now: it won't be shown again."),
          el("pre", { style: "margin: 10px 0" }, el("code", {}, r.token)),
          el("div", { class: "row" }, el("button", { class: "btn secondary small", type: "button", onclick: () => copyText(r.token) }, "Copy token"), el("span", { class: "muted small" }, "Send it as Authorization: Bearer <token> to ", el("code", {}, `${location.origin}/mcp`)))
        )
      );
      tokenName.value = "";
    } finally {
      make.disabled = false;
    }
  });

  const del = el("button", { class: "btn danger", type: "button" }, "Delete my Folio data");
  del.addEventListener("click", async () => {
    const typed = prompt("This deletes every artifact you own (all versions, files, suggestions and comments), your memberships, tokens and agent connections. It can't be undone.\n\nType DELETE to confirm.");
    if (typed !== "DELETE") return;
    del.disabled = true;
    await api("/api/account", { method: "DELETE" });
    toast("Your Folio data was deleted");
    setTimeout(() => (location.href = "/"), 800);
  });

  root.replaceChildren(
    el(
      "div",
      { class: "page" },
      el("h1", {}, "Settings"),
      el("p", { class: "muted" }, `Signed in as ${s.user.email ?? "your account"}.`),
      el("section", { class: "section" }, el("h2", {}, "Connected agents"), el("p", { class: "muted small" }, "Agents that signed in to Folio with OAuth."), grantList),
      el(
        "section",
        { class: "section" },
        el("h2", {}, "Agent tokens"),
        el("p", { class: "muted small" }, "For agents and scripts that can't sign in with OAuth. A token can do everything a connected agent can."),
        tokenList,
        el("div", { class: "row", style: "margin-top: 10px; flex-wrap: nowrap" }, tokenName, make),
        newToken
      ),
      el(
        "section",
        { class: "section" },
        el("h2", {}, "Delete my data"),
        el("p", { class: "muted small" }, "Removes everything Folio keeps for you. Your HEJI account itself stays, so other HEJI apps keep working."),
        del
      )
    )
  );
}
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
