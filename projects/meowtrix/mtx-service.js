// mtx agent bridge — lets host processes (the `mtx` CLI, the `mtx mcp` server,
// any agent running in a Meowtrix terminal) act on the user's workspace: open a
// URL in a browser tab, open a file in the editor, read the pane layout, or post
// a notification.
//
// The workspace layout lives in the browser, not here, so every action is a
// request/response round trip to the *active* session client over its WebSocket
// (`mtx:rpc` → `mtx:rpc:result`). The client owns placement policy (which pane a
// new tab lands in — see public/mtx.js); callers only pass intent plus the PTY
// id they run in ($MEOWTRIX_PTY_ID), so "not the agent's own pane" is knowable.
//
// Same no-auth stance as the rest of the app: anything that can reach this
// server already has a shell on the host.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const RPC_TIMEOUT_MS = 8000;

// Accept `localhost:3000`, `example.com/x`, or a full http(s) URL. Anything with
// another scheme (file:, javascript:, data:, …) is refused.
function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || s.length > 8192) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) return null; // mailto:, javascript:, …
    s = 'http://' + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch { return null; }
}

// The folder an editor tab should be rooted at for `file`: the enclosing git
// repo if there is one, else the file's own directory.
function editorRootFor(file) {
  let d = path.dirname(file);
  while (true) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    const up = path.dirname(d);
    if (up === d) return path.dirname(file);
    d = up;
  }
}

// Strip ANSI/VT escape sequences (CSI, OSC, 2-byte escapes, control chars) and
// normalize CRLF/CR so agents reading terminal scrollback get clean text.
const ANSI_ESCAPE_RE = /\x1b(?:\][^\x07\x1b]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/g;
function stripAnsi(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(ANSI_ESCAPE_RE, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

function mountMtxRoutes(app, { getActiveClient, ptys, getPtyCwd }) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false })); // the sh-based `mtx` posts forms

  const pending = new Map(); // reqId -> { ws, resolve, timer }

  // Ask the active session to run `method`. Resolves to the client's result, or
  // to { ok:false, error } when nobody is active / the client doesn't answer.
  function rpc(method, params) {
    const ws = getActiveClient();
    if (!ws) {
      return Promise.resolve({ ok: false, error: 'no-active-session', message: 'No active Meowtrix session is connected — show the user the link instead.' });
    }
    const reqId = uuidv4();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(reqId);
        resolve({ ok: false, error: 'timeout', message: 'The Meowtrix session did not respond.' });
      }, RPC_TIMEOUT_MS);
      pending.set(reqId, { ws, resolve, timer });
      ws.send(JSON.stringify({ type: 'mtx:rpc', reqId, method, params }));
    });
  }

  // Called from the WS message switch in server.js. Only the socket the request
  // was sent to may answer it.
  function handleRpcResult(ws, msg) {
    const p = pending.get(msg.reqId);
    if (!p || p.ws !== ws) return;
    clearTimeout(p.timer);
    pending.delete(msg.reqId);
    p.resolve(msg.result && typeof msg.result === 'object' ? msg.result : { ok: false, error: 'bad-result' });
  }

  function send(res, result) {
    const status = result.ok ? 200
      : result.error === 'no-active-session' ? 409
      : result.error === 'timeout' ? 504
      : 400;
    res.status(status).json(result);
  }

  const field = (req, name) => req.body?.[name] ?? req.query?.[name];
  const ptyIdOf = (req) => {
    const v = field(req, 'ptyId');
    return typeof v === 'string' && v ? v.slice(0, 200) : null;
  };
  const placementOf = (req) => {
    const v = field(req, 'placement');
    return typeof v === 'string' && v ? v.slice(0, 100) : 'auto';
  };
  const boolOf = (v, dflt) => (v === undefined || v === null || v === '' ? dflt : !(v === false || v === 'false' || v === '0' || v === 0));

  router.post('/open', async (req, res) => {
    const url = normalizeUrl(field(req, 'url'));
    if (!url) return res.status(400).json({ ok: false, error: 'bad-url', message: 'url must be an http(s) URL' });
    send(res, await rpc('open', {
      url,
      placement: placementOf(req),
      reuse: boolOf(field(req, 'reuse'), true),
      host: boolOf(field(req, 'host'), false),
      ptyId: ptyIdOf(req),
    }));
  });

  router.post('/open-file', async (req, res) => {
    const p = field(req, 'path');
    if (typeof p !== 'string' || !path.isAbsolute(p)) {
      return res.status(400).json({ ok: false, error: 'bad-path', message: 'path must be absolute' });
    }
    const file = path.resolve(p);
    let st;
    try { st = fs.statSync(file); } catch { return res.status(404).json({ ok: false, error: 'not-found', message: `${file}: no such file` }); }
    if (!st.isFile()) return res.status(400).json({ ok: false, error: 'not-a-file', message: `${file} is not a file` });
    const line = parseInt(field(req, 'line'), 10);
    send(res, await rpc('openFile', {
      path: file,
      root: editorRootFor(file),
      line: Number.isFinite(line) && line > 0 ? line : null,
      placement: placementOf(req),
      ptyId: ptyIdOf(req),
    }));
  });

  router.get('/layout', async (req, res) => {
    send(res, await rpc('layout', { ptyId: ptyIdOf(req) }));
  });

  router.post('/notify', async (req, res) => {
    const message = field(req, 'message');
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'bad-message', message: 'message required' });
    }
    const title = field(req, 'title');
    send(res, await rpc('notify', {
      message: message.trim().slice(0, 500),
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 100) : null,
      ptyId: ptyIdOf(req),
    }));
  });

  // List live PTYs directly from the server's `ptys` map so agents can inspect
  // sibling terminals (e.g. a dev server or test runner) even without a browser RPC.
  router.get('/terminals', async (req, res) => {
    if (!ptys) return res.status(501).json({ ok: false, error: 'unavailable', message: 'Terminal registry not configured' });
    const callerPtyId = ptyIdOf(req);
    const entries = [...ptys.entries()];
    const terminals = await Promise.all(entries.map(async ([id, entry]) => {
      let cwd = null;
      if (getPtyCwd && entry.proc?.pid) {
        try { cwd = await getPtyCwd(entry.proc.pid); } catch {}
      }
      return {
        ptyId: id,
        pid: entry.proc?.pid || null,
        cols: entry.cols || 80,
        rows: entry.rows || 24,
        cwd,
        sshHost: entry.sshHost || null,
        bufferBytes: typeof entry.buffer === 'string' ? entry.buffer.length : 0,
        isCaller: Boolean(callerPtyId && id === callerPtyId),
      };
    }));
    res.json({ ok: true, terminals });
  });

  // Read recent scrollback output from a live PTY (ANSI-stripped by default).
  router.get('/terminals/:ptyId/output', async (req, res) => {
    if (!ptys) return res.status(501).json({ ok: false, error: 'unavailable', message: 'Terminal registry not configured' });
    const id = req.params.ptyId;
    const entry = ptys.get(id);
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'not-found', message: `No live terminal with ptyId "${id}"` });
    }
    const raw = boolOf(req.query.raw, false);
    const requestedLines = parseInt(req.query.lines, 10);
    const maxLines = Number.isFinite(requestedLines) && requestedLines > 0 ? Math.min(requestedLines, 2000) : 100;
    const text = raw ? (entry.buffer || '') : stripAnsi(entry.buffer || '');
    const allLines = text.split('\n');
    const slice = allLines.slice(-maxLines);
    let cwd = null;
    if (getPtyCwd && entry.proc?.pid) {
      try { cwd = await getPtyCwd(entry.proc.pid); } catch {}
    }
    res.json({
      ok: true,
      ptyId: id,
      cwd,
      cols: entry.cols || 80,
      rows: entry.rows || 24,
      totalLines: allLines.length,
      lines: slice.length,
      output: slice.join('\n'),
    });
  });

  app.use('/api/mtx', router);
  return { handleRpcResult };
}

module.exports = { mountMtxRoutes, normalizeUrl, editorRootFor, stripAnsi };
