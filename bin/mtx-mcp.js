#!/usr/bin/env node
// mtx mcp — the `mtx` workspace tools as a stdio MCP server, for agents that
// prefer tools over shell commands. Run via `mtx mcp` (register with Claude Code
// using `mtx mcp --install`).
//
// A thin adapter: every tool is one HTTP call to the Meowtrix server's
// /api/mtx/* endpoints (mtx-service.js), exactly like the sh-based `mtx` CLI.
// $MEOWTRIX_URL and $MEOWTRIX_PTY_ID are inherited from the Meowtrix terminal the
// agent was started in, so tabs open beside that terminal. No dependencies: the
// MCP stdio transport is newline-delimited JSON-RPC 2.0.

'use strict';

const path = require('path');
const readline = require('readline');

const BASE = process.env.MEOWTRIX_URL || `http://127.0.0.1:${process.env.MEOWTRIX_PORT || 9123}`;
const PTY_ID = process.env.MEOWTRIX_PTY_ID || '';
let VERSION = '0.0.0';
try { VERSION = require(path.join(__dirname, '..', 'package.json')).version; } catch {}

const placementSchema = {
  type: 'string',
  description: 'Where to put a new tab. "auto" (default): the best pane other than your own terminal\'s — one already showing pages, else the largest; splits your pane if it is the only one. "split": always open a new pane beside your terminal. Or a pane id from get_layout.',
};

const TOOLS = [
  {
    name: 'open_url',
    description: 'Show a web page to the user in a Meowtrix browser tab, placed beside your terminal without stealing their keyboard focus. Use it whenever you produce or start something the user should look at: a local dev server (http://localhost:3000), a preview or report page, a PR or docs link. Pages on a local dev server reuse an existing tab for that server (reloading it) instead of piling up tabs. The page is fetched by the Meowtrix host, so localhost URLs work even when the user is on another device.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'http(s) URL; a bare host like localhost:5173 is fine.' },
        placement: placementSchema,
        reuse: { type: 'boolean', description: 'Reuse a tab already showing this URL (or this local dev server). Default true.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'open_file',
    description: 'Open a host file in a Meowtrix code-editor tab (optionally at a line), beside your terminal. Reuses an editor tab whose folder contains the file; otherwise opens one rooted at the file\'s git repo. Use it to point the user at code you want them to review.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path of the file.' },
        line: { type: 'integer', minimum: 1, description: '1-based line to reveal.' },
        placement: placementSchema,
      },
      required: ['path'],
    },
  },
  {
    name: 'get_layout',
    description: 'Describe the user\'s current Meowtrix workspace: the split tree of panes (sizes in px, row = side by side, column = stacked), each pane\'s tabs (type, title, URL/folder), which pane is focused, and which holds your terminal (containsCaller). Only needed to honour an explicit request like "open it in the right-hand pane" — open_url/open_file already place tabs sensibly.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'notify',
    description: 'Show the user a short notification in Meowtrix (a toast; a system notification if the page is in the background and allowed) and flag your terminal\'s tab until they look at it. Use when a long task finishes or you are blocked waiting for their input.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'One short sentence.' },
        title: { type: 'string', description: 'Optional title, e.g. the project name.' },
      },
      required: ['message'],
    },
  },
];

async function api(method, endpoint, params) {
  const body = { ...params, ptyId: PTY_ID };
  let url = `${BASE}/api/mtx/${endpoint}`;
  const init = { method, signal: AbortSignal.timeout(20000) };
  if (method === 'GET') {
    url += '?' + new URLSearchParams(Object.entries(body).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
  } else {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch (e) {
    return { ok: false, error: 'unreachable', message: `Cannot reach Meowtrix at ${BASE} (${e.message}). Is this agent running inside a Meowtrix terminal?` };
  }
}

function text(result, okText) {
  if (!result.ok) {
    return { isError: true, content: [{ type: 'text', text: `${result.message || 'Request failed'} (${result.error || 'error'})` }] };
  }
  return { content: [{ type: 'text', text: okText(result) }] };
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'open_url': {
      const r = await api('POST', 'open', { url: args.url, placement: args.placement, reuse: args.reuse });
      return text(r, (r) => `${r.action === 'reused' ? 'Reused an existing tab for' : 'Opened'} ${r.url} in Meowtrix (pane ${r.paneId}${r.action === 'opened-in-new-split' ? ', new split' : ''}).`);
    }
    case 'open_file': {
      const r = await api('POST', 'open-file', { path: args.path, line: args.line, placement: args.placement });
      return text(r, (r) => `Opened ${r.path}${r.line ? ':' + r.line : ''} in a Meowtrix editor tab (pane ${r.paneId}).`);
    }
    case 'get_layout': {
      const r = await api('GET', 'layout', {});
      return text(r, (r) => { const { ok, ...rest } = r; return JSON.stringify(rest, null, 2); });
    }
    case 'notify': {
      const r = await api('POST', 'notify', { message: args.message, title: args.title });
      return text(r, (r) => `Notified the user (${r.shown}).`);
    }
    default:
      return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }

async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => { if (id !== undefined) send({ jsonrpc: '2.0', id, result }); };
  const fail = (code, message) => { if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code, message } }); };
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'meowtrix', version: VERSION },
        instructions: 'You are running inside Meowtrix, a browser-based tiling workspace. When you produce something the user should see — a running dev server, a preview page, a link, a file to review — show it with open_url / open_file instead of asking them to open it. Use notify when a long task finishes or you need their input.',
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call':
      return reply(await callTool(params?.name, params?.arguments || {}));
    default:
      if (method?.startsWith('notifications/')) return;
      return fail(-32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  handle(msg).catch((e) => {
    if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } });
  });
});
rl.on('close', () => process.exit(0));
