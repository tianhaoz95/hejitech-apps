// /agents: how to connect the agent that builds editions (MCP), with the one prompt it runs.
import prompt from "../../../pipeline/build-prompt.md?raw";
import { api, el } from "./supabase.ts";

interface BuildRun {
  id: string;
  action: "validate" | "publish";
  edition_date: string | null;
  status: "ok" | "error";
  error_count: number;
  warning_count: number;
  errors: { code: string; message: string; card?: string }[];
  agent_name: string | null;
  created_at: string;
}

const root = document.getElementById("app")!;
const mcp = `${location.origin}/mcp`;
const config = JSON.stringify({ mcpServers: { g2digest: { type: "http", url: mcp, headers: { Authorization: "Bearer g2a_…" } } } }, null, 2);

const copy = (text: string) => el("button", { class: "btn secondary", type: "button", onclick: (e) => {
  void navigator.clipboard.writeText(text);
  (e.target as HTMLButtonElement).textContent = "Copied";
} }, "Copy");

const runsList = el("ul", { class: "list" }, el("li", { class: "muted small" }, "Sign in to view recent build runs."));
const runsPanel = el("section", { class: "panel stack" },
  el("h2", {}, "4. Recent build runs & diagnostics"),
  el("p", { class: "muted small" }, "Every validate_cards and publish_cards call is logged here so you can spot why an edition failed or hasn't arrived."),
  runsList);

root.replaceChildren(
  el("h1", {}, "Build agents"),
  el("p", { class: "muted" }, "An agent compiles each edition ahead of time: it reads your brief, researches each section, writes the full edition and the cards, makes the audio, checks everything and publishes. Any agent that can use an MCP server and produce audio can do it, on any schedule."),
  el("section", { class: "panel stack" },
    el("h2", {}, "1. Connect"),
    el("p", {}, "MCP server (Streamable HTTP): ", el("code", {}, mcp)),
    el("p", { class: "muted small" }, "Agents with OAuth support ask you to approve them here. Others use a token from the ", el("a", { href: "/pair/" }, "Pair page"), ":"),
    el("pre", { class: "block" }, config), el("div", {}, copy(config))),
  el("section", { class: "panel stack" },
    el("h2", {}, "2. The prompt"),
    el("p", { class: "muted small" }, "It carries no card rules and no topics: the agent fetches the card authoring guide and your brief live, so editing your brief changes tomorrow's edition with nothing else to update."),
    el("pre", { class: "block" }, prompt), el("div", {}, copy(prompt))),
  el("section", { class: "panel stack" },
    el("h2", {}, "3. Schedule it"),
    el("p", {}, "Run it on your delivery days, about an hour before the delivery time in your brief: a Claude routine, a cron job around another agent, anything that can run a prompt."),
    el("p", { class: "muted small" }, "Tools: get_card_authoring_guide, get_user_brief, create_audio_upload, validate_cards, publish_cards, get_last_cards, get_reader_signals. A publish needs the preview_hash of an error-free validation of that exact bundle.")),
  runsPanel,
);

void api<BuildRun[]>("/api/build-runs").then((r) => {
  if (!r.ok || !Array.isArray(r.body)) return;
  if (!r.body.length) {
    runsList.replaceChildren(el("li", { class: "muted small" }, "No agent runs recorded yet."));
    return;
  }
  runsList.replaceChildren(...r.body.map((run) => el("li", {},
    el("div", {},
      el("b", {}, `${run.action === "publish" ? "Publish" : "Validate"} · ${run.edition_date ?? "unknown date"}`),
      " ",
      el("span", { class: "badge" }, run.status === "ok" ? "ok" : `${run.error_count} error${run.error_count === 1 ? "" : "s"}`),
      run.warning_count ? el("span", { class: "muted small" }, ` · ${run.warning_count} warning${run.warning_count === 1 ? "" : "s"}`) : null,
      el("div", { class: "muted small" }, `${new Date(run.created_at).toLocaleString()}${run.agent_name ? ` · ${run.agent_name}` : ""}`),
      run.errors?.length ? el("ul", { class: "issues", style: "margin-top: 6px" }, ...run.errors.slice(0, 5).map((e) => el("li", { class: "small" }, `${e.code}${e.card ? ` (${e.card})` : ""}: ${e.message}`))) : null))));
}).catch(() => undefined);
