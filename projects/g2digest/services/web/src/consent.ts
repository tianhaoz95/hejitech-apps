// OAuth consent for MCP clients (build agents). This site's Worker is the authorization server: its
// /authorize validates the client's request and sends the browser here with ?handle=… plus the
// client details to show. The user signs in if needed, sees which agent is asking, and approves or
// denies; the Worker then redirects back to the client.
import { currentSession, el, signInView, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

function show(...nodes: (Node | false)[]) {
  root.replaceChildren(el("div", { class: "panel signin" }, ...nodes));
}
function problem(message: string) {
  show(el("h1", {}, "Can't connect"), el("p", { class: "muted" }, message), el("a", { class: "btn secondary", href: "/agents/" }, "Build agents"));
}

async function render() {
  root.replaceChildren(spinner());
  if (params.get("error")) return problem(`${params.get("error")} Start the connection again from your agent.`);
  if (!handle) return problem("This page opens when an agent asks to connect to G2 Digest. Start from your agent's connector settings.");
  const session = await currentSession();
  if (!session) {
    root.replaceChildren(signInView({ title: "Sign in to connect", message: "An agent wants to build your G2 Digest editions. Sign in first; you'll confirm on the next screen.", redirectTo: location.href, onSignedIn: render }));
    return;
  }
  const client = params.get("client") || "An agent";
  const domain = params.get("domain");
  const host = params.get("redirect_host") ?? "";
  const loopback = params.get("loopback") === "1";
  const decide = (decision: "approve" | "deny") => async () => {
    for (const b of buttons) b.disabled = true;
    const { data: fresh } = await supabase.auth.getSession();
    const res = await fetch("/authorize", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${fresh.session?.access_token ?? ""}` },
      body: JSON.stringify({ handle, decision }),
    });
    const body = (await res.json().catch(() => ({}))) as { redirectTo?: string | null; error?: string };
    if (body.redirectTo) return location.replace(body.redirectTo);
    problem(body.error ?? "Something went wrong. Try again from your agent.");
  };
  const buttons = [
    el("button", { class: "btn primary", type: "button", onclick: decide("approve") }, "Allow"),
    el("button", { class: "btn secondary", type: "button", onclick: decide("deny") }, "Deny"),
  ];
  show(
    el("h1", {}, `Let ${client} build your editions?`),
    el("p", { class: "muted small" }, domain ? `Published by ${domain}.` : "This agent registered itself; its name isn't verified."),
    el("ul", {},
      el("li", {}, "Read your brief (sections, sources, instructions, delivery time)"),
      el("li", {}, "Upload audio and publish editions for you, replacing an edition for the same date")),
    el("p", { class: "muted small" }, "It can't change your brief, see your devices or read other apps' data."),
    loopback && el("p", { class: "error" }, `Access goes to a program on this computer (${host}). Continue only if you just started connecting.`),
    el("div", { class: "stack" }, ...buttons),
    el("p", { class: "muted small", style: "margin-top: 14px" }, `Signed in as ${session.user.email ?? "your account"}. Disconnect any time on the `, el("a", { href: "/pair/" }, "Pair page"), "."));
}
render().catch((e) => problem((e as Error).message));
