// OAuth 2.1 consent for MCP clients connecting to HQ. Only the owner can approve (owner token).
import "./style.css";
import { api, el, setToken, token } from "./lib.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

const show = (...nodes: (Node | false | null)[]) => root.replaceChildren(el("div", { class: "panel signin" }, ...(nodes.filter(Boolean) as Node[])));
const problem = (m: string) => show(el("h1", {}, "Can't connect"), el("p", { class: "muted" }, m));

async function render() {
  if (params.get("error")) return problem(`${params.get("error")} Start the connection again from your agent.`);
  if (!handle) return problem("This page opens when an agent asks to connect to HQ. Start from your agent's MCP settings.");
  if (!token() || (await api("/api/me").catch(() => null))?.role !== "owner") {
    const input = el("input", { type: "password", placeholder: "Owner token", "aria-label": "Owner token" });
    return show(
      el("h1", {}, "Sign in to connect"),
      el("p", { class: "muted" }, "An agent wants to work with HQ. Sign in with the owner token; you'll confirm next."),
      el("form", { class: "stack", onsubmit: (e: Event) => { e.preventDefault(); setToken(input.value.trim()); render(); } }, input, el("button", { class: "btn primary", type: "submit" }, "Continue"))
    );
  }
  const client = params.get("client") || "An agent";
  const domain = params.get("domain");
  const host = params.get("redirect_host") ?? "";
  const decide = (decision: "approve" | "deny") => async () => {
    buttons.forEach((b) => (b.disabled = true));
    const res = await fetch("/authorize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify({ handle, decision }) });
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
    el("ul", {},
      el("li", {}, "Read HQ's policy, open cards and your recent decisions"),
      el("li", {}, "Propose cards, comment, attach evidence, rank cards"),
      el("li", {}, "Ask HQ to run verbs (HQ checks every request's tier and approval)")),
    el("p", { class: "muted small" }, "It can't approve cards, change policy, pause HQ or see tokens."),
    params.get("loopback") === "1" ? el("p", { class: "muted small" }, "It runs on this computer.") : el("p", { class: "muted small" }, `You'll be sent back to ${host}.`),
    el("div", { class: "actions" }, ...buttons)
  );
}
render();
