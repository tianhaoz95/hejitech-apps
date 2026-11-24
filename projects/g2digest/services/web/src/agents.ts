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

interface OnboardingStatus {
  brief_configured: boolean;
  agent_connected: boolean;
  first_validation_passed: boolean;
  first_edition_published: boolean;
  delivery: {
    missed: boolean;
    expected_date: string;
    delivery_time: string;
    timezone: string;
    latest_edition_date: string | null;
  };
}

const root = document.getElementById("app")!;
const mcp = `${location.origin}/mcp`;
const config = JSON.stringify({ mcpServers: { g2digest: { type: "http", url: mcp, headers: { Authorization: "Bearer g2a_…" } } } }, null, 2);

const copy = (text: string) => el("button", { class: "btn secondary", type: "button", onclick: (e) => {
  void navigator.clipboard.writeText(text);
  (e.target as HTMLButtonElement).textContent = "Copied";
} }, "Copy");

const missedBanner = el("div", { class: "panel", hidden: true, style: "border-color: var(--danger, #e5534b)" });
const checklist = el("ul", { class: "list" }, el("li", { class: "muted small" }, "Sign in to view your setup progress."));
const checklistPanel = el("section", { class: "panel stack" },
  el("h2", {}, "Setup checklist"),
  el("p", { class: "muted small" }, "Track your build agent from first configuration to daily delivery."),
  checklist);

const runsList = el("ul", { class: "list" }, el("li", { class: "muted small" }, "Sign in to view recent build runs."));
const runsPanel = el("section", { class: "panel stack" },
  el("h2", {}, "4. Recent build runs & diagnostics"),
  el("p", { class: "muted small" }, "Every validate_cards and publish_cards call is logged here so you can spot why an edition failed or hasn't arrived."),
  runsList);

root.replaceChildren(
  el("h1", {}, "Build agents"),
  el("p", { class: "muted" }, "An agent compiles each edition ahead of time: it reads your brief, researches each section, writes the full edition and the cards, makes the audio, checks everything and publishes. Any agent that can use an MCP server and produce audio can do it, on any schedule."),
  missedBanner,
  checklistPanel,
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
    el("p", { class: "muted small" }, "Tools: get_card_authoring_guide, get_user_brief, create_audio_upload, validate_cards, publish_cards, get_last_cards, get_reader_signals, get_bookmarks. A publish needs the preview_hash of an error-free validation of that exact bundle.")),
  runsPanel,
);

void api<OnboardingStatus>("/api/onboarding").then((r) => {
  if (!r.ok || !r.body) return;
  const s = r.body;
  const steps: { done: boolean; label: string; href?: string }[] = [
    { done: s.brief_configured, label: "Configure your brief", href: "/brief/" },
    { done: s.agent_connected, label: "Connect an agent (OAuth or g2a_ token)", href: "/pair/" },
    { done: s.first_validation_passed, label: "Pass first validate_cards dry-run" },
    { done: s.first_edition_published, label: "Publish first edition", href: "/edition/latest" },
  ];
  checklist.replaceChildren(...steps.map((step) => el("li", {},
    el("span", { class: "badge", style: step.done ? "background: var(--accent, #4ade80); color: #000" : "" }, step.done ? "✓" : "○"),
    " ",
    step.href ? el("a", { href: step.href }, step.label) : el("span", {}, step.label))));
  if (s.delivery?.missed) {
    missedBanner.hidden = false;
    missedBanner.replaceChildren(
      el("b", {}, `Missed delivery for ${s.delivery.expected_date}`),
      el("p", { class: "muted small", style: "margin: 4px 0 0" },
        `Expected by ${s.delivery.delivery_time} (${s.delivery.timezone}). Latest published edition: ${s.delivery.latest_edition_date ?? "none yet"}. Check recent build runs below.`));
  }
}).catch(() => undefined);

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
