// OAuth consent for MCP clients. Supabase Auth's OAuth server sends the browser here
// (auth.oauth_server.authorization_url_path) with ?authorization_id=…; the user signs in if needed,
// sees which assistant is asking, and approves or denies.
import { currentSession, el, signInView, spinner, supabase } from "./supabase.ts";

const root = document.getElementById("app")!;
const authorizationId = new URLSearchParams(location.search).get("authorization_id");

function show(...nodes: (Node | false)[]) {
  root.replaceChildren(el("div", { class: "panel signin" }, ...nodes));
}

function problem(message: string) {
  show(el("h1", { style: "font-size: 26px" }, "Can't connect"), el("p", { class: "muted" }, message), el("a", { class: "btn secondary", href: "/agents/" }, "Agent setup guide"));
}

async function render() {
  root.replaceChildren(spinner());
  if (!authorizationId) return problem("This page opens when an AI assistant asks to connect to Wee Hours. Start from your assistant's connector settings.");

  if (!(await currentSession())) {
    root.replaceChildren(signInView({
      title: "Sign in to connect",
      message: "An AI assistant wants to connect to your Wee Hours log. Sign in first; you'll confirm on the next screen.",
      redirectTo: location.href,
      onSignedIn: render,
    }));
    return;
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return problem(error?.message ?? "This request has expired. Try connecting again from your assistant.");
  if (!("authorization_id" in data)) {
    location.replace(data.redirect_url); // already approved earlier
    return;
  }

  const { data: household } = await supabase.rpc("my_household");
  const client = data.client;
  const host = (() => { try { return new URL(data.redirect_uri).host; } catch { return data.redirect_uri; } })();
  const logo = client.logo_uri
    ? el("img", { src: client.logo_uri, alt: "", width: "52", height: "52", referrerpolicy: "no-referrer" })
    : el("div", { class: "ph" }, (client.name || "?").slice(0, 1).toUpperCase());

  const decide = (approve: boolean) => async () => {
    for (const b of buttons) b.disabled = true;
    const res = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (res.error || !res.data) return problem(res.error?.message ?? "Something went wrong. Try again from your assistant.");
    location.replace(res.data.redirect_url);
  };
  const buttons = [
    el("button", { class: "btn primary", type: "button", onclick: decide(true) }, "Allow"),
    el("button", { class: "btn secondary", type: "button", onclick: decide(false) }, "Deny"),
  ];

  const baby = (household as { baby_name?: string } | null)?.baby_name;
  show(
    el("div", { class: "client" }, logo, el("div", {}, el("div", { style: "font-weight: 700; font-size: 19px" }, client.name || "An AI assistant"), el("div", { class: "muted small" }, client.uri || host))),
    el("h1", { style: "font-size: 24px; text-align: left" }, `Connect to ${baby ? `${baby}'s` : "your"} log?`),
    el("ul", { class: "checks small", style: "text-align: left; margin: 14px 0 20px" },
      el("li", {}, el("span", {}, "Read feeds, diapers, sleep and other entries, and the status line")),
      el("li", {}, el("span", {}, "Add entries, undo them and resolve duplicates, marked as coming from this assistant")),
      el("li", {}, el("span", {}, "Your household's name, baby's name and birth date, and caregivers' names")),
    ),
    !household && el("p", { class: "error", style: "text-align: left" }, "This account has no household yet. Set one up in the iPhone app first, or the assistant will have nothing to read."),
    el("div", { style: "display: grid; gap: 10px" }, ...buttons),
    el("p", { class: "muted small", style: "margin: 16px 0 0; text-align: left" },
      `Signed in as ${data.user.email}. After approving, you'll return to ${host}. Disconnect any time from your `,
      el("a", { href: "/account/" }, "account page"), "."),
  );
}

render().catch((e) => problem((e as Error).message));
