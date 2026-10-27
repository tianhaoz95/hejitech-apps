// /feedback: every note left for the agent (from the glasses, phone or web) with the agent's
// replies, and a box for a new one.
import { FEEDBACK_LABELS, FEEDBACK_TAGS, type Feedback } from "@fitloop/core";
import { api, el, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;

async function render() {
  const session = await requireSession(root, render);
  if (!session) return;
  const r = await api<Feedback[]>("/api/feedback");
  const chosen = new Set<string>();
  const painWarn = el("p", { class: "small warn", hidden: true, style: "margin: 0" },
    "Stop if something hurts, you feel dizzy or have chest symptoms, and see a doctor or physio — your agent isn't a medical professional.");
  const chips = FEEDBACK_TAGS.map((t) => {
    const b = el("button", { class: "chip", type: "button", "aria-pressed": "false" }, FEEDBACK_LABELS[t]);
    b.addEventListener("click", () => {
      chosen.has(t) ? chosen.delete(t) : chosen.add(t);
      b.setAttribute("aria-pressed", String(chosen.has(t)));
      painWarn.hidden = !chosen.has("pain");
    });
    return b;
  });
  const text = el("textarea", { placeholder: "Anything about the plan: too much, too little, a new limit, a goal that changed…" });
  const send = el("button", { class: "btn primary", type: "button" }, "Send to my agent");
  const status = el("span", { class: "small" });
  send.addEventListener("click", async () => {
    const res = await api("/api/feedback", { method: "POST", body: JSON.stringify({ text: text.value, tags: [...chosen] }) });
    if (res.ok) return void render();
    status.textContent = (res.body as { error?: string }).error ?? "Couldn't send";
  });
  const items = r.ok ? r.body : [];
  root.replaceChildren(
    el("h1", {}, "Feedback for your agent"),
    el("p", { class: "muted" }, "Your agent reads open notes over MCP before it changes your plan, and replies here."),
    el("section", { class: "panel stack" }, el("div", { class: "row" }, ...chips), painWarn, text, el("div", { class: "row" }, send, status)),
    el("ul", { class: "items", style: "margin-top: 16px" }, ...(items.length ? items.map((f) => el("li", { class: "item" },
      el("header", {},
        el("span", { class: "small muted" }, `${new Date(f.created_at).toLocaleString()}${f.ref ? ` · ${f.ref}` : ""} · from ${f.source ?? "app"}`),
        el("span", { class: `status ${f.status === "addressed" ? "done" : ""}` }, f.status === "addressed" ? "Answered" : "Open")),
      f.tags.length ? el("div", { class: "row" }, ...f.tags.map((t) => el("span", { class: "badge" }, FEEDBACK_LABELS[t as keyof typeof FEEDBACK_LABELS] ?? t))) : null,
      f.text ? el("p", { style: "margin: 0" }, f.text) : null,
      f.agent_reply ? el("p", { class: "reply", style: "margin: 0" }, el("b", {}, "Your agent: "), f.agent_reply) : null,
      el("button", { class: "link", type: "button", onclick: async () => { await api(`/api/feedback/${f.id}`, { method: "DELETE" }); void render(); } }, "Delete"))) : [el("li", { class: "muted" }, "No notes yet. Leave one from any workout or meal, on the glasses, phone or here.")])));
}

root.replaceChildren(spinner());
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
