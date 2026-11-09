// OAuth 2.1 consent for MCP clients connecting to HQ: sign in, pick the workspace the agent will work
// in (one where you're an admin or approver), then allow or deny.
import "./style.css";
import { api, el, session, signInView, type Workspace } from "./lib.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

const show = (...nodes: (Node | false | null)[]) => root.replaceChildren(el("div", { class: "panel signin" }, ...(nodes.filter(Boolean) as Node[])));
const problem = (m: string) => show(el("h1", {}, "Can't connect"), el("p", { class: "muted" }, m));

async function render() {
  if (params.get("error")) return problem(`${params.get("error")} Start the connection again from your agent.`);
  if (!handle) return problem("This page opens when an agent asks to connect to HQ. Start from your agent's MCP settings.");
  if (!(await session())) {
    return root.replaceChildren(signInView({ title: "Sign in to connect", message: "An agent wants to work in one of your HQ workspaces. Sign in; you'll pick the workspace next.", redirectTo: location.href, onSignedIn: render }));
  }
  const all = (await api<{ workspaces: Workspace[] }>("/api/me")).workspaces.filter((w) => w.role === "admin" || w.role === "approver");
  if (!all.length) return problem("You're not an admin or approver of any workspace, so you can't connect an agent.");
  const client = params.get("client") || "An agent";
  const domain = params.get("domain");
  const pick = el("select", { "aria-label": "Workspace" }, all.map((w) => el("option", { value: w.id }, `${w.name} · ${w.repo}`)));
  const decide = (decision: "approve" | "deny") => async () => {
    buttons.forEach((b) => (b.disabled = true));
    const s = await session();
    const res = await fetch("/authorize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token ?? ""}` }, body: JSON.stringify({ handle, decision, workspace: (pick as HTMLSelectElement).value }) });
    const body = (await res.json().catch(() => ({}))) as { redirectTo?: string | null; error?: string };
    if (body.redirectTo) return location.replace(body.redirectTo);
    problem(body.error ?? "Something went wrong. Try again from your agent.");
  };
  const buttons = [
    el("button", { class: "btn primary", type: "button", onclick: decide("approve") }, "Allow"),
    el("button", { class: "btn", type: "button", onclick: decide("deny") }, "Deny"),
  ];
  show(
    el("h1", {}, `Let ${client} work with HQ?`),
    el("p", { class: "muted small" }, domain ? `Published by ${domain}.` : "This agent registered itself; its name isn't verified."),
    el("label", { class: "stack" }, el("span", { class: "small muted" }, "In workspace"), pick),
    el("ul", {},
      el("li", {}, "Read the workspace's policy, open cards and recent decisions"),
      el("li", {}, "Propose cards, comment, attach evidence, rank cards"),
      el("li", {}, "Ask HQ to run verbs (HQ checks every request's tier and approval)")),
    el("p", { class: "muted small" }, "It can't approve cards, change policy, pause HQ, manage members or see tokens. It stops working if you leave the workspace."),
    params.get("loopback") === "1" ? el("p", { class: "muted small" }, "It runs on this computer.") : el("p", { class: "muted small" }, `You'll be sent back to ${params.get("redirect_host") ?? ""}.`),
    el("div", { class: "actions" }, ...buttons)
  );
}
render();
