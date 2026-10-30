// /agents — discussion agents: register a name, give it a bearer token or connect it by OAuth, revoke.
import { api, chrome, confirmDialog, copyButton, el, failure, toast, when } from "./ui.ts";

interface Data {
  agents: { agent_id: string; display_name: string; created_at: string; revoked_at: string | null }[];
  tokens: { id: string; agent_id: string; label: string; created_at: string; last_used_at: string | null }[];
  grants: { id: string; agent_id: string | null; client_name: string | null; created_at: string }[];
}

const root = document.getElementById("app")!;
const reveal = el("div", {});

async function revoke(title: string, path: string, method: "DELETE" | "POST") {
  if (!(await confirmDialog({ title, body: ["It stops working at once."], confirm: "Revoke", danger: true }))) return;
  const r = await api(path, { method, body: method === "POST" ? {} : undefined });
  toast(r.ok ? "Revoked" : failure(r), !r.ok);
  await load();
}

async function load() {
  const r = await api<Data>("/api/agents");
  if (!r.ok) return;
  const d = r.body;
  const mcp = `${location.origin}/mcp`;
  const id = el("input", { placeholder: "claude", "aria-label": "Agent id", pattern: "[a-z][a-z0-9_-]{1,31}", required: true });
  const name = el("input", { placeholder: "Claude", "aria-label": "Display name" });
  const add = el("form", { class: "toolbar" }, el("label", {}, "Agent id", id), el("label", {}, "Display name", name), el("button", { class: "btn", type: "submit" }, "Register agent"));
  add.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const res = await api("/api/agents", { body: { agent_id: id.value.trim(), display_name: name.value.trim() || id.value.trim() } });
    toast(res.ok ? `Registered ${id.value.trim()}` : failure(res), !res.ok);
    await load();
  });
  const cards = d.agents.map((a) => {
    const tokens = d.tokens.filter((t) => t.agent_id === a.agent_id);
    const grants = d.grants.filter((g) => g.agent_id === a.agent_id);
    return el("section", { class: "panel" },
      el("div", { class: "spread" }, el("h2", {}, a.display_name, " ", el("span", { class: "mono muted small" }, a.agent_id)),
        a.revoked_at ? el("span", { class: "badge off" }, "Revoked") : el("span", { class: "badge on" }, "Active")),
      el("ul", { class: "log" },
        ...tokens.map((t) => el("li", {}, el("div", { class: "spread" }, el("span", { class: "small" }, `Token “${t.label}” · issued `, when(t.created_at), " · last used ", when(t.last_used_at)), el("button", { class: "btn small danger", type: "button", onclick: () => revoke("Revoke this token?", `/api/agent-tokens/${t.id}`, "DELETE") }, "Revoke")))),
        ...grants.map((g) => el("li", {}, el("div", { class: "spread" }, el("span", { class: "small" }, `OAuth connection${g.client_name ? ` from ${g.client_name}` : ""} · `, when(g.created_at)), el("button", { class: "btn small danger", type: "button", onclick: () => revoke("Disconnect this app?", `/api/grants/${encodeURIComponent(g.id)}`, "DELETE") }, "Disconnect"))))),
      a.revoked_at ? null : el("div", { class: "row", style: "margin-top: 10px" },
        el("button", {
          class: "btn small", type: "button",
          onclick: async () => {
            const res = await api<{ token: string }>(`/api/agents/${a.agent_id}/tokens`, { body: { label: "token" } });
            if (!res.ok) return toast(failure(res), true);
            reveal.replaceChildren(el("div", { class: "banner note" }, el("p", {}, `Token for ${a.agent_id}, shown once. Use it as a bearer token for `, el("code", {}, mcp), "."), el("pre", { class: "block" }, res.body.token), copyButton("Copy", () => res.body.token)));
            reveal.scrollIntoView({ behavior: "smooth" });
            await load();
          },
        }, "New token"),
        el("button", { class: "btn small danger", type: "button", onclick: () => revoke(`Revoke ${a.agent_id}?`, `/api/agents/${a.agent_id}/revoke`, "POST") }, "Revoke agent")));
  });
  root.replaceChildren(
    el("h1", {}, "Agents"),
    el("p", { class: "muted" }, "Discussion agents draft and debate plans over MCP. They can't approve, change the policy, control the executor or reach Robinhood. Treat what they write as untrusted input."),
    el("section", { class: "panel" }, el("h2", {}, "Connect an agent"),
      el("p", {}, "Board MCP: ", el("code", {}, mcp), " ", copyButton("Copy URL", () => mcp)),
      el("ul", {},
        el("li", {}, "Apps with OAuth (Claude, ChatGPT, Gemini…): add a custom connector with that URL. You'll sign in here and pick which agent it speaks as."),
        el("li", {}, "Everything else: register the agent, make a token and send it as ", el("code", {}, "Authorization: Bearer tba_…"), ".")),
      add),
    reveal, ...cards);
}

chrome();
void load();
