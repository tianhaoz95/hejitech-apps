// OAuth 2.1 consent page for MCP assistants connecting to Tether.
import { currentSession, el, signInView, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

function show(...nodes: (Node | false)[]) {
  root.replaceChildren(el("div", { class: "panel signin" }, ...nodes));
}
function problem(message: string) {
  show(
    el("h1", {}, "Can't connect"),
    el("p", { class: "muted" }, message),
    el("a", { class: "btn secondary", href: "/settings/" }, "Settings")
  );
}

async function render() {
  root.replaceChildren(spinner());
  if (params.get("error")) return problem(`${params.get("error")} Start the connection again from your assistant.`);
  if (!handle) {
    return problem(
      "This page opens when an assistant asks to connect to Tether. Start from your assistant's connector settings."
    );
  }
  const session = await currentSession();
  if (!session) {
    root.replaceChildren(
      signInView({
        title: "Sign in to connect",
        message: "An assistant wants to inspect or arrange your Tether workspace. Sign in first; you'll confirm on the next screen.",
        redirectTo: location.href,
        onSignedIn: render,
      })
    );
    return;
  }
  const client = params.get("client") || "An assistant";
  const domain = params.get("domain");
  const host = params.get("redirect_host") ?? "";
  const loopback = params.get("loopback") === "1";
  const decide = (decision: "approve" | "deny") => async () => {
    for (const b of buttons) b.disabled = true;
    const { data: fresh } = await supabase.auth.getSession();
    const res = await fetch("/authorize", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fresh.session?.access_token ?? ""}`,
      },
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
  show(
    el("h1", {}, `Let ${client} use Tether?`),
    el(
      "p",
      { class: "muted small" },
      domain ? `Published by ${domain}.` : "This assistant registered itself; its name isn't verified."
    ),
    el(
      "ul",
      {},
      el("li", {}, "Read and arrange your tiling pane layout and open tabs"),
      el("li", {}, "Read and update non-secret SSH host metadata and browser bookmarks")
    ),
    el(
      "p",
      { class: "muted small" },
      "It never has access to your SSH private keys, passwords, or terminal session contents (which stay strictly on your phone)."
    ),
    loopback &&
      el(
        "p",
        { class: "error" },
        `Access goes to a program on this computer (${host}). Continue only if you just started connecting.`
      ),
    el("div", { class: "stack" }, ...buttons),
    el(
      "p",
      { class: "muted small", style: "margin-top: 14px" },
      `Signed in as ${session.user.email ?? "your account"}. Disconnect any time on `,
      el("a", { href: "/settings/" }, "Settings"),
      "."
    )
  );
}
render().catch((e) => problem((e as Error).message));
