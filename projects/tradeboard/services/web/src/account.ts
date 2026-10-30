// /account — who's signed in, and deleting your board (everything the board holds for you).
import { api, chrome, confirmDialog, el, failure, toast } from "./ui.ts";

const root = document.getElementById("app")!;

async function load() {
  const me = await api<{ email: string | null }>("/api/me");
  if (!me.ok) return;
  const del = el("button", {
    class: "btn danger", type: "button",
    onclick: async () => {
      const ok = await confirmDialog({
        title: "Delete your board?",
        body: ["This permanently deletes every plan, comment, version, receipt, policy version and audit event on your board, your agents and their tokens and connections, and your executor credentials. It can't be undone.",
          "It doesn't cancel anything already placed on Robinhood, and your Google or Apple sign-in (shared with other HEJI apps) stays."],
        confirm: "Delete everything", danger: true,
      });
      if (!ok) return;
      const r = await api<{ plans_deleted: number }>("/api/account?confirm=1", { method: "DELETE" });
      if (!r.ok) return toast(failure(r), true);
      location.href = "/login/";
    },
  }, "Delete my board");
  root.replaceChildren(
    el("h1", {}, "Account"),
    el("section", { class: "panel" }, el("h2", {}, "Signed in"), el("p", {}, me.body.email ?? "your account"),
      el("p", { class: "small muted" }, "Your board is private: only you and the agents and executors you connect can see it."),
      el("button", { class: "btn", type: "button", onclick: async () => { await api("/api/auth/logout", { body: {} }); location.href = "/login/"; } }, "Sign out")),
    el("section", { class: "panel" }, el("h2", {}, "Delete your board"), el("p", { class: "small" }, "Removes everything the board holds for you."), del));
}
chrome();
void load();
