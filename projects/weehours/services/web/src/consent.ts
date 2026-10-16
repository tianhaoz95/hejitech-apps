// OAuth consent for MCP clients. This site's Worker (src/worker) is the authorization server: its
// /authorize validates the client's request and sends the browser here with ?handle=… plus the
// client details to show. The user signs in if needed (the same Supabase account as the app), sees
// which assistant is asking, and approves or denies; the Worker then redirects back to the client.
import { currentSession, el, signInView, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

function show(...nodes: (Node | false)[]) {
  root.replaceChildren(el("div", { class: "panel signin" }, ...nodes));
}

function problem(message: string) {
  show(el("h1", { style: "font-size: 26px" }, "Can't connect"), el("p", { class: "muted" }, message), el("a", { class: "btn secondary", href: "/agents/" }, "Agent setup guide"));
}

async function render() {
  root.replaceChildren(spinner());
  if (params.get("error")) return problem(`${params.get("error")} Start the connection again from your assistant.`);
  if (!handle) return problem("This page opens when an AI assistant asks to connect to Wee Hours. Start from your assistant's connector settings.");

  const session = await currentSession();
  if (!session) {
    root.replaceChildren(signInView({
      title: "Sign in to connect",
      message: "An AI assistant wants to connect to your Wee Hours log. Sign in first; you'll confirm on the next screen.",
      redirectTo: location.href,
      onSignedIn: render,
    }));
    return;
  }

  const { data: household } = await supabase.rpc("my_household");
  const clientName = params.get("client") || "An AI assistant";
  const domain = params.get("domain");
  const host = params.get("redirect_host") ?? "";
  const loopback = params.get("loopback") === "1";

  const decide = (decision: "approve" | "deny") => async () => {
    for (const b of buttons) b.disabled = true;
    const { data: fresh } = await supabase.auth.getSession();
    const res = await fetch("/authorize", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${fresh.session?.access_token ?? ""}` },
      body: JSON.stringify({ handle, decision }),
    });
    const body = (await res.json().catch(() => ({}))) as { redirectTo?: string | null; error?: string };
    if (body.redirectTo) return location.replace(body.redirectTo);
    problem(body.error ?? "Something went wrong. Try again from your assistant.");
  };
  const buttons = [
    el("button", { class: "btn primary", type: "button", onclick: decide("approve") }, "Allow"),
    el("button", { class: "btn secondary", type: "button", onclick: decide("deny") }, "Deny"),
  ];

  const baby = (household as { baby_name?: string } | null)?.baby_name;
  show(
    el("div", { class: "client" },
      el("div", { class: "ph" }, clientName.slice(0, 1).toUpperCase()),
      el("div", {},
        el("div", { style: "font-weight: 700; font-size: 19px" }, clientName),
        el("div", { class: "muted small" }, domain ? `Published by ${domain}` : "This app registered itself; its name isn't verified."))),
    el("h1", { style: "font-size: 24px; text-align: left" }, `Connect to ${baby ? `${baby}'s` : "your"} log?`),
    el("ul", { class: "checks small", style: "text-align: left; margin: 14px 0 20px" },
      el("li", {}, el("span", {}, "Read feeds, diapers, sleep and other entries, and the status line")),
      el("li", {}, el("span", {}, "Add entries, undo them and resolve duplicates, marked as coming from this assistant")),
      el("li", {}, el("span", {}, "Your household's name, baby's name and birth date, and caregivers' names")),
    ),
    loopback && el("p", { class: "error", style: "text-align: left" }, `Access will be sent to an app on this computer (${host}). Continue only if you just started connecting from your AI assistant.`),
    !household && el("p", { class: "error", style: "text-align: left" }, "This account has no household yet. Set one up in the iPhone app first, or the assistant will have nothing to read."),
    el("div", { style: "display: grid; gap: 10px" }, ...buttons),
    el("p", { class: "muted small", style: "margin: 16px 0 0; text-align: left" },
      `Signed in as ${session.user.email ?? "your account"}. After approving, you'll return to ${host}. Disconnect any time from your `,
      el("a", { href: "/account/" }, "account page"), "."),
  );
}

render().catch((e) => problem((e as Error).message));
