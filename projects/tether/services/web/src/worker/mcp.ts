// MCP server (Streamable HTTP, JSON responses) at /mcp: an assistant can inspect or configure the
// user's Tether workspace (pane tree, layout presets, non-secret SSH host metadata, bookmarks).
// Passwords, passphrases, and private keys are never accepted or stored here (PRD §14).
import {
  applyLayoutPreset,
  countPanes,
  createAndAddTab,
  listPanes,
  normalizeSshHost,
  splitFocusedPane,
  validatePaneTree,
  validateSshHost,
  type FilesMode,
  type LayoutPresetId,
  type SplitDirection,
  type TabType,
} from "@tether/core";
import {
  deleteBookmark,
  deleteHost,
  loadWorkspace,
  saveWorkspaceTreeAndSettings,
  upsertBookmark,
  upsertHost,
  type Db,
} from "./store.ts";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "0.1.0";

export interface Caller {
  userId: string;
  via: "oauth" | "token";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

export const TOOLS = [
  {
    name: "get_workspace",
    title: "Get Tether workspace",
    description:
      "Returns the user's current Tether tiling pane tree, open tabs (Web, SSH, Files), non-secret SSH host metadata, bookmarks, and settings.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "Get workspace", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "apply_layout_preset",
    title: "Apply a tiling layout preset",
    description:
      "Applies one of the 4 normative layout presets (`single`, `two_columns`, `three_columns`, `left_main_right_stack`), preserving and redistributing all open tabs across the panes.",
    inputSchema: {
      type: "object",
      required: ["preset"],
      properties: {
        preset: {
          type: "string",
          enum: ["single", "two_columns", "three_columns", "left_main_right_stack"],
        },
      },
    },
    annotations: { title: "Apply layout preset", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "split_focused_pane",
    title: "Split the focused pane",
    description:
      "Splits the focused pane horizontally (`horizontal`, new pane to the right) or vertically (`vertical`, new pane below). Maximum 4 panes.",
    inputSchema: {
      type: "object",
      required: ["direction"],
      properties: {
        direction: { type: "string", enum: ["horizontal", "vertical"] },
      },
    },
    annotations: { title: "Split pane", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "open_tab",
    title: "Open a tab in a pane",
    description:
      "Opens a new `web`, `ssh`, or `files` tab in the focused pane (or a specified `pane_id`).",
    inputSchema: {
      type: "object",
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["web", "ssh", "files"] },
        pane_id: { type: "string", description: "Optional target pane ID (defaults to focusedPaneId)." },
        url: { type: "string", description: "URL for a `web` tab." },
        host_id: { type: "string", description: "Saved SSH host ID for an `ssh` or `sftp` files tab." },
        files_mode: { type: "string", enum: ["local", "sftp"], description: "Mode for a `files` tab." },
        path: { type: "string", description: "Directory path for a `files` tab." },
      },
    },
    annotations: { title: "Open tab", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "list_hosts",
    title: "List saved SSH hosts",
    description:
      "Lists the user's saved SSH host metadata (id, hostname, port, username, auth type). Passwords and private keys live only in device Keychain/Keystore.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "List SSH hosts", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "upsert_host",
    title: "Add or update an SSH host entry",
    description:
      "Saves non-secret SSH host metadata (`id`, `host`, `port`, `username`, `auth`, `autoReconnectOnDisplayReconnect`). Never pass passwords or private keys.",
    inputSchema: {
      type: "object",
      required: ["id", "host", "username", "auth"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        host: { type: "string" },
        port: { type: "integer", minimum: 1, maximum: 65535 },
        username: { type: "string" },
        auth: { type: "string", enum: ["key", "password", "keyAndPassword"] },
        key_id: { type: "string" },
        auto_reconnect_on_display_reconnect: { type: "boolean" },
      },
    },
    annotations: { title: "Save SSH host", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "delete_host",
    title: "Delete an SSH host entry",
    description: "Deletes a saved SSH host metadata entry by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
    annotations: { title: "Delete SSH host", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "upsert_bookmark",
    title: "Add or update a browser bookmark",
    description: "Saves a browser bookmark (`id`, `title`, `url`).",
    inputSchema: {
      type: "object",
      required: ["title", "url"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
      },
    },
    annotations: { title: "Save bookmark", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "delete_bookmark",
    title: "Delete a browser bookmark",
    description: "Deletes a saved browser bookmark by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
    annotations: { title: "Delete bookmark", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
];

async function callTool(name: string, args: Record<string, unknown>, caller: Caller, db: Db): Promise<unknown> {
  switch (name) {
    case "get_workspace": {
      const ws = await loadWorkspace(db, caller.userId);
      return {
        pane_count: countPanes(ws.tree),
        focused_pane_id: ws.tree.focusedPaneId,
        panes: listPanes(ws.tree.root),
        tree: ws.tree,
        hosts: ws.hosts,
        bookmarks: ws.bookmarks,
        settings: ws.settings,
      };
    }
    case "apply_layout_preset": {
      const preset = String(args.preset ?? "") as LayoutPresetId;
      if (!["single", "two_columns", "three_columns", "left_main_right_stack"].includes(preset)) {
        throw new Error(`unknown preset: ${preset}`);
      }
      const ws = await loadWorkspace(db, caller.userId);
      const nextTree = applyLayoutPreset(ws.tree, preset);
      await saveWorkspaceTreeAndSettings(db, caller.userId, nextTree, ws.settings);
      return { preset, pane_count: countPanes(nextTree), tree: nextTree };
    }
    case "split_focused_pane": {
      const direction = String(args.direction ?? "") as SplitDirection;
      if (direction !== "horizontal" && direction !== "vertical") {
        throw new Error("direction must be horizontal or vertical");
      }
      const ws = await loadWorkspace(db, caller.userId);
      const res = splitFocusedPane(ws.tree, direction);
      if (res.notice) throw new Error(res.notice);
      await saveWorkspaceTreeAndSettings(db, caller.userId, res.tree, ws.settings);
      return { pane_count: countPanes(res.tree), focused_pane_id: res.tree.focusedPaneId, tree: res.tree };
    }
    case "open_tab": {
      const type = String(args.type ?? "") as TabType;
      if (!["web", "ssh", "files"].includes(type)) throw new Error("type must be web, ssh, or files");
      const ws = await loadWorkspace(db, caller.userId);
      const paneId = typeof args.pane_id === "string" && args.pane_id ? args.pane_id : ws.tree.focusedPaneId;
      const hostId = typeof args.host_id === "string" ? args.host_id : undefined;
      const host = hostId ? ws.hosts.find((h) => h.id === hostId) ?? null : null;
      const { tree: nextTree, tab } = createAndAddTab(
        ws.tree,
        type,
        {
          url: typeof args.url === "string" ? args.url : undefined,
          hostId,
          host,
          filesMode: (args.files_mode as FilesMode | undefined) ?? "local",
          path: typeof args.path === "string" ? args.path : "/",
        },
        paneId
      );
      const issues = validatePaneTree(nextTree);
      if (issues.length) throw new Error(issues[0].message);
      await saveWorkspaceTreeAndSettings(db, caller.userId, nextTree, ws.settings);
      return { tab, pane_id: paneId, tree: nextTree };
    }
    case "list_hosts": {
      const ws = await loadWorkspace(db, caller.userId);
      return { hosts: ws.hosts };
    }
    case "upsert_host": {
      const candidate = {
        id: String(args.id ?? ""),
        label: typeof args.label === "string" ? args.label : undefined,
        host: String(args.host ?? ""),
        port: args.port !== undefined ? Number(args.port) : 22,
        username: String(args.username ?? ""),
        auth: String(args.auth ?? "key") as "key" | "password" | "keyAndPassword",
        keyId: typeof args.key_id === "string" ? args.key_id : undefined,
        autoReconnectOnDisplayReconnect: Boolean(args.auto_reconnect_on_display_reconnect),
      };
      const issues = validateSshHost(candidate);
      if (issues.length) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
      const normalized = normalizeSshHost(candidate);
      await upsertHost(db, caller.userId, normalized);
      return { host: normalized };
    }
    case "delete_host": {
      const id = String(args.id ?? "").trim();
      if (!id) throw new Error("id is required");
      await deleteHost(db, caller.userId, id);
      return { deleted: id };
    }
    case "upsert_bookmark": {
      const url = String(args.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("url must start with http:// or https://");
      const bm = {
        id: typeof args.id === "string" && args.id.trim() ? args.id.trim() : `bm-${Date.now()}`,
        title: String(args.title ?? url).trim() || url,
        url,
      };
      await upsertBookmark(db, caller.userId, bm);
      return { bookmark: bm };
    }
    case "delete_bookmark": {
      const id = String(args.id ?? "").trim();
      if (!id) throw new Error("id is required");
      await deleteBookmark(db, caller.userId, id);
      return { deleted: id };
    }
  }
  throw new Error(`unknown tool ${name}`);
}

export async function handleMcp(req: Request, caller: Caller, db: Db): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return json({ name: "tether-mcp", transport: "streamable-http" });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let msg: { id?: string | number; method: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const reply = (result: unknown) => json({ jsonrpc: "2.0", id: msg.id ?? null, result });

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "tether", version: SERVER_VERSION },
        instructions:
          "Tether is a self-contained tiling desktop workspace for iPhone and Android over USB-C external monitors with three built-in tools: Browser (`web`), SSH Terminal (`ssh`), and Files (`files`). Use these tools to inspect or arrange the user's pane layout, tabs, bookmarks, and non-secret SSH host metadata. Never pass or store passwords or private keys.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, caller, db);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
}
