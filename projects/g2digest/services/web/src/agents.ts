// /agents: how to connect the agent that builds editions (MCP), with the one prompt it runs.
import prompt from "../../../pipeline/build-prompt.md?raw";
import { el } from "./supabase.ts";

const root = document.getElementById("app")!;
const mcp = `${location.origin}/mcp`;
const config = JSON.stringify({ mcpServers: { g2digest: { type: "http", url: mcp, headers: { Authorization: "Bearer g2a_…" } } } }, null, 2);

const copy = (text: string) => el("button", { class: "btn secondary", type: "button", onclick: (e) => {
  void navigator.clipboard.writeText(text);
  (e.target as HTMLButtonElement).textContent = "Copied";
} }, "Copy");

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
    el("p", { class: "muted small" }, "Tools: get_card_authoring_guide, get_user_brief, create_audio_upload, validate_cards, publish_cards, get_last_cards. A publish needs the preview_hash of an error-free validation of that exact bundle.")),
);
