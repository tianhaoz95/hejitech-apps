// OAuth consent for a discussion agent's MCP client. The Worker's /authorize validates the client and
// sends the browser here with ?handle=…; the owner (signed in to the portal) picks which registered
// agent this connection speaks as, then allows or denies.
import { api, chrome, el, spinner } from "./ui.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

const show = (...nodes: (Node | false | null)[]) => root.replaceChildren(el("div", { class: "panel signin stack" }, ...nodes));
const problem = (message: string) => show(el("h1", {}, "Can't connect"), el("p", { class: "muted" }, message), el("a", { class: "btn", href: "/agents/" }, "Agents"));

async function render() {
  root.replaceChildren(spinner());
  if (params.get("error")) return problem(`${params.get("error")} Start the connection again from the agent.`);
  if (!handle) return problem("This page opens when an agent's app asks to connect to the board. Start from the agent's connector settings.");
  const agents = await api<{ agents: { agent_id: string; display_name: string; revoked_at: string | null }[] }>("/api/agents");
  if (!agents.ok) return;
  const live = agents.body.agents.filter((a) => !a.revoked_at);
  if (!live.length) return problem("Register the agent first on the Agents page (for example “claude”), then connect again.");
  const select = el("select", { name: "agent", "aria-label": "Agent" }, ...live.map((a) => el("option", { value: a.agent_id }, `${a.display_name} (${a.agent_id})`)));
  const guess = (params.get("client") ?? "").toLowerCase();
  const match = live.find((a) => guess.includes(a.agent_id));
  if (match) select.value = match.agent_id;
  const loopback = params.get("loopback") === "1";
  const error = el("p", { class: "error", role: "alert", hidden: true });
  const decide = (decision: "approve" | "deny") => async () => {
    for (const b of buttons) b.disabled = true;
    const r = await api<{ redirectTo?: string | null; error?: string }>("/authorize", { body: { handle, decision, agent_id: select.value } });
    if (r.body.redirectTo) return location.replace(r.body.redirectTo);
    error.textContent = r.body.error ?? "Something went wrong. Try again from the agent.";
    error.hidden = false;
    for (const b of buttons) b.disabled = false;
  };
  const buttons = [
    el("button", { class: "btn primary", type: "button", onclick: decide("approve") }, "Allow"),
    el("button", { class: "btn", type: "button", onclick: decide("deny") }, "Deny"),
  ];
  show(
    el("h1", {}, `Connect ${params.get("client") || "an agent"} to the board?`),
    el("p", { class: "muted small" }, params.get("domain") ? `Published by ${params.get("domain")}.` : "This app registered itself; its name isn't verified."),
    el("label", {}, "It speaks as", select, el("span", { class: "hint" }, "Every plan, comment and question it writes is labelled with this agent.")),
    el("ul", {},
      el("li", {}, "Read every plan, comment and the decision log"),
      el("li", {}, "Create and edit plans, comment, ask and answer questions, mark plans ready or request changes")),
    el("p", { class: "muted small" }, "It can't approve plans, change the policy, control the executor or reach Robinhood. Revoke it any time on the Agents page."),
    loopback && el("p", { class: "warn" }, `Access goes to a program on this computer (${params.get("redirect_host")}). Continue only if you just started connecting.`),
    el("div", { class: "row" }, ...buttons),
    error);
}
chrome();
render().catch((e) => problem((e as Error).message));
