// Setup instructions for each agent, with this site's MCP URL filled in.
import { copyText, el } from "./supabase.ts";

const root = document.getElementById("app")!;
const MCP = `${location.origin}/mcp`;

function code(text: string) {
  const copy = el("button", { class: "btn secondary small", type: "button", onclick: () => copyText(text) }, "Copy");
  return el("div", { class: "copyable" }, el("pre", {}, el("code", {}, text)), copy);
}

interface Agent {
  name: string;
  steps: (Node | string)[];
}

const agents: Agent[] = [
  {
    name: "Claude Code",
    steps: [code(`claude mcp add --transport http folio ${MCP}`), el("p", { class: "muted small" }, "Then run /mcp in Claude Code and choose folio → Authenticate. Add --scope user to use it in every project.")],
  },
  {
    name: "Claude (web, desktop, mobile)",
    steps: [el("p", {}, "Settings → Connectors → Add custom connector. Name it Folio and paste:"), code(MCP), el("p", { class: "muted small" }, "Claude opens Folio to sign in. Artifacts shown with show_artifact appear inline.")],
  },
  {
    name: "Gemini CLI",
    steps: [
      el("p", {}, "Add to ~/.gemini/settings.json:"),
      code(JSON.stringify({ mcpServers: { folio: { httpUrl: MCP } } }, null, 2)),
      el("p", { class: "muted small" }, "Then in Gemini CLI: /mcp auth folio."),
    ],
  },
  {
    name: "ChatGPT",
    steps: [el("p", {}, "Settings → Apps & Connectors → Advanced settings → turn on Developer mode, then Create a connector with this URL and OAuth:"), code(MCP)],
  },
  {
    name: "Codex",
    steps: [el("p", {}, "Add to ~/.codex/config.toml:"), code(`[mcp_servers.folio]\nurl = "${MCP}"`), el("p", { class: "muted small" }, "Then: codex mcp login folio")],
  },
  {
    name: "Cursor",
    steps: [el("p", {}, "Add to ~/.cursor/mcp.json (or the project's .cursor/mcp.json):"), code(JSON.stringify({ mcpServers: { folio: { url: MCP } } }, null, 2))],
  },
  {
    name: "VS Code (Copilot)",
    steps: [el("p", {}, "Add to .vscode/mcp.json:"), code(JSON.stringify({ servers: { folio: { type: "http", url: MCP } } }, null, 2))],
  },
  {
    name: "Antigravity and other MCP clients",
    steps: [
      el("p", {}, "Add a remote (Streamable HTTP) MCP server with this URL. Clients that support OAuth sign in on their own:"),
      code(MCP),
      el("p", { class: "muted small" }, "A client that can't do OAuth can send a token instead: make one in ", el("a", { href: "/settings/" }, "Settings"), " and send it as the header Authorization: Bearer fol_…"),
    ],
  },
];

root.replaceChildren(
  el(
    "div",
    { class: "page" },
    el("h1", {}, "Connect an agent"),
    el("p", { class: "muted", style: "max-width: 620px" }, "Folio is an MCP server. Add it to each agent you use; each one signs in to your Folio account once and then sees the same artifacts."),
    el("div", { class: "panel flat", style: "margin: 18px 0 22px" }, el("h3", {}, "Server URL"), code(MCP)),
    el("div", { class: "connect-grid" }, ...agents.map((a) => el("section", { class: "connect-card" }, el("h3", {}, a.name), ...a.steps))),
    el(
      "div",
      { class: "section", style: "margin-top: 28px" },
      el("h2", {}, "Then try"),
      el(
        "ul",
        {},
        el("li", {}, "“Make a Folio artifact: a one-page landing site for my app.” (any agent)"),
        el("li", {}, "“Open my latest Folio artifact and suggest clearer copy.” (a second agent)"),
        el("li", {}, "“Review the open suggestions on it and accept the good ones.”"),
        el("li", {}, "“What changed in Folio since yesterday?”")
      )
    )
  )
);
