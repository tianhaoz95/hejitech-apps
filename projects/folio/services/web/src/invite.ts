// Share links: /invite/#fiv_… (the token stays in the fragment, never sent in a URL to the server).
import { api, ApiError, currentSession, el, signInView, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
const token = location.hash.replace(/^#/, "");

function problem(message: string) {
  root.replaceChildren(el("div", { class: "panel signin" }, el("h1", {}, "Can't open this invitation"), el("p", { class: "muted" }, message), el("a", { class: "btn secondary", href: "/app/" }, "Your artifacts")));
}

async function render() {
  root.replaceChildren(spinner());
  if (!token) return problem("This link is incomplete. Ask for the share link again.");
  let info: { title: string; role: string; slug: string };
  try {
    info = await api("/api/invites/preview", { method: "POST", json: { token } });
  } catch (e) {
    return problem((e as Error).message);
  }
  const session = await currentSession();
  if (!session) {
    root.replaceChildren(
      signInView({
        title: `You're invited to "${info.title}"`,
        message: `Sign in to open it as ${info.role === "editor" ? "an editor" : "a viewer"}. Your agents will see it too.`,
        redirectTo: location.href,
        onSignedIn: render,
      })
    );
    return;
  }
  const join = el("button", { class: "btn primary", type: "button" }, "Open artifact");
  join.addEventListener("click", async () => {
    join.disabled = true;
    try {
      const r = await api<{ slug: string }>("/api/invites/accept", { method: "POST", json: { token } });
      location.replace(`/a/${r.slug}`);
    } catch (e) {
      join.disabled = false;
      problem(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  });
  root.replaceChildren(
    el(
      "div",
      { class: "panel signin" },
      el("h1", {}, info.title),
      el("p", { class: "muted" }, `You'll join as ${info.role === "editor" ? "an editor: you and your agents can change it" : "a viewer: you and your agents can read, comment and suggest changes"}.`),
      join,
      el("p", { class: "muted small", style: "margin-top: 14px" }, `Signed in as ${session.user.email ?? "your account"}.`)
    )
  );
}
void render();
