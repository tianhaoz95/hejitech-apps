// `hq login` in the browser: the CLI opened this page with the hash of a secret it made. An admin
// signs in, checks the short code against their terminal, picks the workspace and allows it; the CLI
// (which holds the secret) then collects a runner token and an agent token from the Worker.
import "./style.css";
import { api, el, session, signInView, type Workspace } from "./lib.ts";

const root = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
const challenge = params.get("challenge") ?? "";
const host = (params.get("host") ?? "").slice(0, 40);
const repo = params.get("repo") ?? "";
/** The same code `hq login` prints: the first eight characters of the challenge. */
const code = `${challenge.slice(0, 4)}-${challenge.slice(4, 8)}`.toUpperCase();

const show = (...nodes: (Node | false | null)[]) => root.replaceChildren(el("div", { class: "panel signin" }, ...(nodes.filter(Boolean) as Node[])));
const done = (title: string, m: string) => show(el("h1", {}, title), el("p", { class: "muted" }, m));

async function render() {
  if (!/^[0-9a-f]{64}$/.test(challenge)) return done("Can't sign in", "This page opens when you run `hq login` in a repository. Start there.");
  if (!(await session())) {
    return root.replaceChildren(signInView({ title: "Sign in to connect the hq command", message: "The hq command on a computer wants to work with one of your HQ workspaces. Sign in; you'll confirm next.", redirectTo: location.href, onSignedIn: render }));
  }
  const admin = (await api<{ workspaces: Workspace[] }>("/api/me")).workspaces.filter((w) => w.role === "admin");
  const all = repo ? admin.filter((w) => w.repo === repo) : admin;
  if (!all.length) {
    return done("Can't sign in", repo
      ? `You're not an admin of a workspace for ${repo}. Ask an admin to run \`hq login\`, or to give you a runner token to paste.`
      : "You're not an admin of any workspace, so you can't create tokens for the hq command.");
  }
  const pick = el("select", { "aria-label": "Workspace" }, all.map((w) => el("option", { value: w.id }, `${w.name} · ${w.repo}`)));
  const allow = async () => {
    buttons.forEach((b) => (b.disabled = true));
    try {
      await api(`/api/w/${(pick as HTMLSelectElement).value}/cli-logins`, { method: "POST", json: { challenge, host, repo: repo || undefined } });
      done("Allowed", "Go back to your terminal: the hq command is signed in. You can close this tab.");
    } catch (e) {
      done("Can't sign in", `${(e as Error).message} Run \`hq login\` again.`);
    }
  };
  const buttons = [
    el("button", { class: "btn primary", type: "button", onclick: allow }, "Allow"),
    el("button", { class: "btn", type: "button", onclick: () => done("Not allowed", "Nothing was created. Stop `hq login` in your terminal with Ctrl-C.") }, "Deny"),
  ];
  show(
    el("h1", {}, `Sign in the hq command${host ? ` on ${host}` : ""}?`),
    el("p", {}, "The code in your terminal must be ", el("b", {}, el("code", {}, code)), "."),
    el("p", { class: "muted small" }, "If you didn't just run `hq login` yourself, or the code differs, choose Deny: someone else would get the tokens."),
    el("label", { class: "stack" }, el("span", { class: "small muted" }, "For workspace"), pick),
    el("ul", {},
      el("li", {}, "Creates a runner token: sync the repo's policy, claim and run work"),
      el("li", {}, "Creates an agent token: what the runner gives the agents it starts")),
    el("p", { class: "muted small" }, "Both are saved on that computer and listed in Settings → Tokens, where you can revoke them."),
    el("div", { class: "actions" }, ...buttons)
  );
}
render();
