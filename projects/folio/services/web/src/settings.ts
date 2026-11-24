// Settings: your plan, appearance, connected agents (OAuth grants), agent tokens, webhooks (Pro),
// and deleting everything Folio keeps.
import { api, copyText, el, requireSession, spinner, timeAgo, toast } from "./common.ts";
import { getTheme, THEME_OPTIONS } from "./theme.ts";

const root = document.getElementById("app")!;

async function render() {
  root.replaceChildren(spinner());
  const s = await requireSession(root, render);
  if (!s) return;
  const [grants, tokens, pro, hooks] = await Promise.all([
    api<{ id: string; client_name: string | null; created_at: string }[]>("/api/grants"),
    api<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>("/api/tokens"),
    api<{ pro: boolean; plan: string | null; until: string | null; artifacts: number; limits: { artifacts: number; webhooks: number } }>("/api/pro"),
    api<{ webhooks: Webhook[]; kinds: string[] }>("/api/webhooks"),
  ]);
  const planSection = el(
    "section",
    { class: "section" },
    el("h2", {}, "Plan"),
    el(
      "div",
      { class: "list-row" },
      el(
        "div",
        {},
        el("strong", {}, pro.pro ? "Folio Pro" : "Free"),
        el("div", { class: "muted small" }, `${pro.artifacts} of ${pro.limits.artifacts.toLocaleString()} artifacts${pro.pro && pro.until ? ` · renews or ends ${new Date(pro.until).toLocaleDateString()}` : pro.pro && pro.plan === "lifetime" ? " · for good" : ""}`)
      ),
      el("span", { class: "spacer" }),
      el("a", { class: "btn secondary small", href: "/pro/" }, pro.pro ? "Your plan" : "See Pro")
    )
  );
  const currentTheme = getTheme();
  const appearanceSection = el(
    "section",
    { class: "section" },
    el("h2", {}, "Appearance"),
    el(
      "div",
      { class: "list" },
      el(
        "div",
        { class: "list-row", style: "flex-wrap: wrap" },
        el(
          "div",
          {},
          el("strong", {}, "Theme"),
          el("div", { class: "muted small" }, "Device follows your browser or system setting.")
        ),
        el("span", { class: "spacer" }),
        el(
          "div",
          { class: "segmented", role: "radiogroup", "aria-label": "Theme" },
          ...THEME_OPTIONS.map((opt) =>
            el(
              "button",
              {
                type: "button",
                role: "radio",
                "aria-checked": opt.value === currentTheme ? "true" : "false",
                "data-theme-choice": opt.value,
              },
              opt.label
            )
          )
        )
      )
    )
  );

  const hookSection = webhooksSection(hooks.webhooks, hooks.kinds, pro.pro);

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
      planSection,
      appearanceSection,
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
      hookSection,
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
interface Webhook {
  id: string;
  url: string;
  artifact: string | null;
  kinds: string[];
  include_agents: boolean;
  last_status: number | null;
  last_error: string | null;
  last_sent_at: string | null;
  failures: number;
  paused: boolean;
}

const KIND_LABEL: Record<string, string> = {
  commented: "Comments",
  suggested: "New suggestions",
  suggestion_revised: "Revised suggestions",
  suggestion_accepted: "Accepted suggestions",
  suggestion_rejected: "Rejected suggestions",
  edited: "New versions",
  restored: "Restores",
  comment_resolved: "Resolved comments",
  created: "New artifacts",
  member_joined: "People joining",
};

/** Webhooks: Folio POSTs comments and suggestions to your own routine as they land (Pro). */
function webhooksSection(hooks: Webhook[], kinds: string[], pro: boolean): HTMLElement {
  const intro = el(
    "p",
    { class: "muted small" },
    "Folio sends a signed POST to your URL when someone comments or suggests a change, so your own routine, CI job or agent can answer right away. ",
    "Check the ",
    el("code", {}, "Folio-Signature"),
    " header (HMAC-SHA256 of ",
    el("code", {}, "<t>.<body>"),
    " with the secret). Agents can't add webhooks; they can wait for activity instead."
  );
  if (!pro && !hooks.length) {
    return el("section", { class: "section" }, el("h2", {}, "Webhooks"), intro, el("div", { class: "empty" }, "Webhooks are part of ", el("a", { href: "/pro/" }, "Folio Pro"), "."));
  }
  const list = el(
    "div",
    { class: "list" },
    hooks.length
      ? hooks.map((h) => {
          const state = h.paused
            ? `Paused after ${h.failures} failed deliveries · Test to resume`
            : h.last_sent_at
              ? `Last sent ${timeAgo(h.last_sent_at)} · ${h.last_error ?? `HTTP ${h.last_status}`}`
              : "Not sent yet";
          return el(
            "div",
            { class: "list-row" },
            el(
              "div",
              { style: "min-width: 0" },
              el("strong", { class: "webhook-secret" }, h.url),
              el("div", { class: "muted small" }, `${h.artifact ? `Only ${h.artifact}` : "All artifacts"} · ${h.kinds.map((k) => KIND_LABEL[k] ?? k).join(", ")}${h.include_agents ? " · agents' changes too" : ""}`),
              el("div", { class: "muted small" }, state)
            ),
            el("span", { class: "spacer" }),
            el(
              "button",
              {
                class: "btn secondary small",
                type: "button",
                onclick: async () => {
                  const r = await api<{ ok: boolean; status: number | null; error: string | null }>(`/api/webhooks/${h.id}/test`, { method: "POST" });
                  toast(r.ok ? `Delivered (HTTP ${r.status})` : `Failed: ${r.error ?? r.status}`, r.ok ? undefined : "error");
                  render();
                },
              },
              "Test"
            ),
            el(
              "button",
              {
                class: "btn danger small",
                type: "button",
                onclick: async () => {
                  if (!confirm(`Remove the webhook to ${h.url}?`)) return;
                  await api(`/api/webhooks/${h.id}`, { method: "DELETE" });
                  render();
                },
              },
              "Remove"
            )
          );
        })
      : el("div", { class: "empty" }, "No webhooks yet.")
  );
  const url = el("input", { type: "url", placeholder: "https://example.com/folio-hook" });
  const only = el("input", { placeholder: "Artifact link or slug (optional)", style: "max-width: 240px" });
  const checks = kinds.map((k) => {
    const box = el("input", { type: "checkbox", value: k }) as HTMLInputElement;
    box.checked = ["commented", "suggested", "suggestion_revised"].includes(k);
    return { k, box, label: el("label", { class: "small", style: "display: inline-flex; gap: 6px; align-items: center; margin: 4px 14px 4px 0" }, box, KIND_LABEL[k] ?? k) };
  });
  const agents = el("input", { type: "checkbox" }) as HTMLInputElement;
  const shown = el("div", { hidden: true });
  const add = el("button", { class: "btn secondary", type: "button" }, "Add webhook");
  add.addEventListener("click", async () => {
    add.disabled = true;
    try {
      const r = await api<{ secret: string }>("/api/webhooks", {
        method: "POST",
        json: { url: url.value, artifact: only.value.trim() || undefined, kinds: checks.filter((c) => c.box.checked).map((c) => c.k), include_agents: agents.checked },
      });
      shown.hidden = false;
      shown.replaceChildren(
        el(
          "div",
          { class: "panel flat", style: "margin-top: 12px" },
          el("strong", {}, "Signing secret: copy it now, it won't be shown again."),
          el("pre", { style: "margin: 10px 0" }, el("code", { class: "webhook-secret" }, r.secret)),
          el("button", { class: "btn secondary small", type: "button", onclick: () => copyText(r.secret) }, "Copy secret"),
          " ",
          el("button", { class: "btn small", type: "button", onclick: () => render() }, "Done")
        )
      );
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      add.disabled = false;
    }
  });
  return el(
    "section",
    { class: "section" },
    el("h2", {}, "Webhooks"),
    intro,
    list,
    pro
      ? el(
          "div",
          { style: "margin-top: 12px" },
          el("div", { class: "row", style: "flex-wrap: wrap; gap: 8px" }, url, only),
          el("div", { style: "margin-top: 8px" }, ...checks.map((c) => c.label)),
          el("label", { class: "small", style: "display: inline-flex; gap: 6px; align-items: center; margin: 4px 0 10px" }, agents, "Also send changes agents make"),
          el("div", {}, add),
          shown
        )
      : el("p", { class: "muted small" }, "Your plan has ended, so these are paused. ", el("a", { href: "/pro/" }, "Get Pro"), " to send them again.")
  );
}

render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
