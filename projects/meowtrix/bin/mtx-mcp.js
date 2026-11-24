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
const TOKEN = process.env.MEOWTRIX_TOKEN || '';
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
        host: { type: 'boolean', description: 'Open in a host-browser tab: a real Chromium running on the Meowtrix host (keeps sign-ins, works with sites the embedded browser cannot show, and lets you take screenshots with host_browser_screenshot). Default false.' },
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
    name: 'host_browser_list',
    description: 'List the host-browser tabs (real Chromium pages on the Meowtrix host that the user is looking at): tab id, URL and title.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'host_browser_screenshot',
    description: 'Screenshot a host-browser tab — see exactly what the user sees, e.g. to check a page you are building. Get the tab id from host_browser_list (or open one with open_url host:true).',
    inputSchema: { type: 'object', properties: { tabId: { type: 'string' } }, required: ['tabId'] },
  },
  {
    name: 'host_browser_read',
    description: 'Read the visible text of a host-browser tab (document.body.innerText).',
    inputSchema: { type: 'object', properties: { tabId: { type: 'string' } }, required: ['tabId'] },
  },
  {
    name: 'list_terminals',
    description: 'List all live Meowtrix terminal PTYs across panes: ptyId, cwd, cols/rows, bufferBytes, and whether each is your own terminal (isCaller). Use this to find a sibling terminal (e.g. a dev server or test watcher) before calling read_terminal.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_terminal',
    description: 'Read the recent scrollback output of a live Meowtrix terminal PTY (ANSI escape codes stripped by default). Useful for inspecting dev-server logs, build errors, or test output in another pane without asking the user to copy-paste.',
    inputSchema: {
      type: 'object',
      properties: {
        ptyId: { type: 'string', description: 'PTY id from list_terminals.' },
        lines: { type: 'integer', minimum: 1, maximum: 2000, description: 'Number of trailing lines to return (default 100).' },
        raw: { type: 'boolean', description: 'Return raw output with ANSI escape codes intact. Default false.' },
      },
      required: ['ptyId'],
    },
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

function authHeaders(extra = {}) {
  return TOKEN ? { ...extra, Authorization: `Bearer ${TOKEN}` } : extra;
}

async function api(method, endpoint, params) {
  const body = { ...params, ptyId: PTY_ID };
  let url = `${BASE}/api/mtx/${endpoint}`;
  const init = { method, signal: AbortSignal.timeout(20000), headers: authHeaders() };
  if (method === 'GET') {
    url += '?' + new URLSearchParams(Object.entries(body).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
  } else {
    init.headers = authHeaders({ 'Content-Type': 'application/json' });
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, init);
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (data && typeof data === 'object') {
      if (!res.ok && data.ok === undefined) return { ok: false, error: `http_${res.status}`, ...data };
      return data;
    }
    if (!res.ok) {
      const snippet = raw.trim().slice(0, 200);
      return {
        ok: false,
        error: `http_${res.status}`,
        message: snippet ? `HTTP ${res.status}: ${snippet}` : `HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}`,
      };
    }
    return { ok: false, error: 'invalid_json', message: `Invalid JSON response from Meowtrix (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: 'unreachable', message: `Cannot reach Meowtrix at ${BASE} (${e.message}). Is this agent running inside a Meowtrix terminal?` };
  }
}

// GET /api/hostbrowser/tabs<suffix> → raw body (JSON list, PNG or text).
async function hostBrowser(suffix) {
  try {
    const res = await fetch(`${BASE}/api/hostbrowser/tabs${suffix}`, { signal: AbortSignal.timeout(30000), headers: authHeaders() });
    const body = Buffer.from(await res.arrayBuffer());
    if (!res.ok) return { ok: false, result: { isError: true, content: [{ type: 'text', text: res.status === 404 ? 'No such host-browser tab (see host_browser_list).' : `Request failed (HTTP ${res.status})` }] } };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, result: { isError: true, content: [{ type: 'text', text: `Cannot reach Meowtrix at ${BASE} (${e.message}).` }] } };
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
      const r = await api('POST', 'open', { url: args.url, placement: args.placement, reuse: args.reuse, host: args.host });
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
    case 'list_terminals': {
      const r = await api('GET', 'terminals', {});
      return text(r, (r) => JSON.stringify(r.terminals, null, 2));
    }
    case 'read_terminal': {
      const id = encodeURIComponent(args.ptyId || '');
      const r = await api('GET', `terminals/${id}/output`, { lines: args.lines, raw: args.raw });
      return text(r, (r) => r.output);
    }
    case 'host_browser_list': {
      const r = await hostBrowser('');
      if (!r.ok) return r.result;
      return { content: [{ type: 'text', text: r.body.toString('utf8') }] };
    }
    case 'host_browser_screenshot': {
      const r = await hostBrowser(`/${encodeURIComponent(args.tabId || '')}/screenshot`);
      if (!r.ok) return r.result;
      return { content: [{ type: 'image', data: r.body.toString('base64'), mimeType: 'image/png' }] };
    }
    case 'host_browser_read': {
      const r = await hostBrowser(`/${encodeURIComponent(args.tabId || '')}/text`);
      if (!r.ok) return r.result;
      return { content: [{ type: 'text', text: r.body.toString('utf8').slice(0, 200000) }] };
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

process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(0); });

let pending = 0;
let closed = false;
const maybeExit = () => { if (closed && pending === 0) process.exit(0); };

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  pending++;
  handle(msg)
    .catch((e) => {
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } });
    })
    .finally(() => {
      pending--;
      maybeExit();
    });
});
rl.on('close', () => {
  closed = true;
  maybeExit();
});
