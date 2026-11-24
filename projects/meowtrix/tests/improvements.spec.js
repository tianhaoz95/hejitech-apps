const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');

const REPO_DIR = path.resolve(__dirname, '..');

test.describe('1.36.0 improvements', () => {
  let ptyId;

  test.beforeEach(async ({ page, request }) => {
    await request.post('/api/settings/reset');
    await request.post('/api/session', {
      data: { workspaces: [{ name: 'Workspace 1', layout: null }], activeWorkspaceIndex: 0 },
    });
    await page.goto('/');
    const takeoverBtn = page.locator('#btn-takeover');
    try {
      await takeoverBtn.waitFor({ state: 'visible', timeout: 1500 });
      await takeoverBtn.click();
    } catch {}
    await expect(page.locator('#workspace')).toBeVisible();
    await expect.poll(() => page.evaluate(() => getAllPanes()[0]?.tabs[0]?.ptyId || null)).toBeTruthy();
    ptyId = await page.evaluate(() => getAllPanes()[0].tabs[0].ptyId);
    await expect.poll(() => page.evaluate(() => isActiveSession)).toBe(true);
  });

  test('agent-readable terminal output: REST API + MCP list_terminals/read_terminal', async ({ page, request, baseURL }) => {
    const marker = `MTX_TERM_MARKER_${Date.now()}`;
    // Echo a colored ANSI string into the active terminal.
    await page.evaluate(({ id, m }) => {
      wsSend({ type: 'pty:input', id, data: `printf '\\033[32m${m}\\033[0m\\n'\r` });
    }, { id: ptyId, m: marker });

    await expect.poll(async () => {
      const r = await request.get(`/api/mtx/terminals/${encodeURIComponent(ptyId)}/output?lines=50`);
      const j = await r.json();
      return j.ok && j.output.includes(marker);
    }, { timeout: 10000 }).toBe(true);

    // List terminals includes our live PTY and marks isCaller accurately.
    const listRes = await request.get(`/api/mtx/terminals?ptyId=${encodeURIComponent(ptyId)}`);
    expect(listRes.ok()).toBeTruthy();
    const listJson = await listRes.json();
    expect(listJson.ok).toBe(true);
    const mine = listJson.terminals.find(t => t.ptyId === ptyId);
    expect(mine).toBeTruthy();
    expect(mine.isCaller).toBe(true);
    expect(mine.bufferBytes).toBeGreaterThan(0);

    // Stripped output has no ANSI escape codes; raw=true preserves them.
    const strippedJson = await (await request.get(`/api/mtx/terminals/${encodeURIComponent(ptyId)}/output?lines=50`)).json();
    expect(strippedJson.output).toContain(marker);
    expect(strippedJson.output).not.toContain('\x1b[32m');

    const rawJson = await (await request.get(`/api/mtx/terminals/${encodeURIComponent(ptyId)}/output?lines=50&raw=true`)).json();
    expect(rawJson.output).toContain('\x1b[32m');

    // Verify mtx-mcp.js stdio tools `list_terminals` and `read_terminal`.
    const mcpProc = spawn(process.execPath, [path.join(REPO_DIR, 'bin', 'mtx-mcp.js')], {
      env: { ...process.env, MEOWTRIX_URL: baseURL, MEOWTRIX_PTY_ID: ptyId },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const responses = new Map();
    let buf = '';
    mcpProc.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined) responses.set(msg.id, msg);
      }
    });
    const callMcp = async (id, method, params = {}) => {
      mcpProc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      await expect.poll(() => responses.has(id), { timeout: 8000 }).toBe(true);
      return responses.get(id);
    };

    try {
      const toolsRes = await callMcp(1, 'tools/list');
      const names = toolsRes.result.tools.map(t => t.name);
      expect(names).toContain('list_terminals');
      expect(names).toContain('read_terminal');

      const ltRes = await callMcp(2, 'tools/call', { name: 'list_terminals', arguments: {} });
      expect(ltRes.result.isError).toBeFalsy();
      const parsedList = JSON.parse(ltRes.result.content[0].text);
      expect(parsedList.some(t => t.ptyId === ptyId)).toBe(true);

      const rtRes = await callMcp(3, 'tools/call', { name: 'read_terminal', arguments: { ptyId, lines: 50 } });
      expect(rtRes.result.isError).toBeFalsy();
      expect(rtRes.result.content[0].text).toContain(marker);
    } finally {
      mcpProc.kill();
    }
  });

  test('clickable file paths in terminals resolve and open in editor at line', async ({ page, request }) => {
    const targetFile = path.join(REPO_DIR, 'package.json');
    // Verify /api/fs/resolve works for absolute paths.
    const res = await request.get(`/api/fs/resolve?path=${encodeURIComponent(targetFile)}&ptyId=${encodeURIComponent(ptyId)}`);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.path).toBe(targetFile);

    // Write a stack-trace style path:line into the terminal and verify the registered link provider matches and activates it.
    const linkText = `${targetFile}:3`;
    await page.evaluate(({ id, txt }) => {
      wsSend({ type: 'pty:input', id, data: `echo "${txt}"\r` });
    }, { id: ptyId, txt: linkText });

    // Wait for the path to appear in the xterm buffer, then trigger the link provider directly.
    await expect.poll(async () => {
      return await page.evaluate((needle) => {
        const term = getAllPanes()[0]?.tabs[0]?.term;
        if (!term) return false;
        const buf = term.buffer.active;
        for (let i = 0; i < buf.length; i++) {
          const line = buf.getLine(i)?.translateToString(true) || '';
          if (line.includes(needle)) return true;
        }
        return false;
      }, linkText);
    }, { timeout: 10000 }).toBe(true);

    // Invoke xterm's registered link providers on the matching line and activate the link.
    const activated = await page.evaluate((needle) => {
      const term = getAllPanes()[0]?.tabs[0]?.term;
      const buf = term.buffer.active;
      let lineNum = -1;
      for (let i = buf.length - 1; i >= 0; i--) {
        const line = buf.getLine(i)?.translateToString(true) || '';
        if (line.includes(needle)) { lineNum = i + 1; break; }
      }
      if (lineNum === -1) return false;
      const providers = term._core?.linkifier2?._linkProviders || [];
      let foundLink = null;
      for (const p of providers) {
        p.provideLinks(lineNum, (links) => {
          if (!links) return;
          const hit = links.find(l => l.text === needle);
          if (hit) foundLink = hit;
        });
      }
      if (!foundLink) return false;
      foundLink.activate(new MouseEvent('click'), foundLink.text);
      return true;
    }, linkText);
    expect(activated).toBe(true);

    // Expect a sibling editor tab to open with package.json.
    await expect.poll(() => page.evaluate(() => {
      return getAllPanes().some(p => p.tabs.some(t => t.type === 'editor'));
    }), { timeout: 10000 }).toBe(true);
    await expect(page.locator('.editor-filetab')).toContainText('package.json', { timeout: 10000 });
  });

  test('fuzzy Quick Open (⌘P) lists files and opens target at :line', async ({ page, request }) => {
    // Verify /api/fs/files returns files in REPO_DIR.
    const filesRes = await request.get(`/api/fs/files?root=${encodeURIComponent(REPO_DIR)}`);
    const filesJson = await filesRes.json();
    expect(filesJson.ok).toBe(true);
    expect(filesJson.files).toContain('mtx-service.js');

    // Open an editor tab rooted at REPO_DIR.
    await page.evaluate((dir) => {
      const pane = getAllPanes()[0];
      addTab(pane, 'editor', undefined, undefined, undefined, dir);
    }, REPO_DIR);

    // Click the ⌘P quick-open button in the editor sidebar header.
    const quickBtn = page.locator('.editor-sidebar-quickopen');
    await expect(quickBtn).toBeVisible();
    await quickBtn.click();

    const input = page.locator('.quick-open-input');
    await expect(input).toBeVisible();
    await input.fill('mtxsvc:15');

    // Top match should be mtx-service.js with :15 indicator.
    const firstItem = page.locator('.quick-open-item').first();
    await expect(firstItem).toContainText('mtx-service.js');
    await expect(firstItem).toContainText(':15');

    await input.press('Enter');
    await expect(page.locator('.quick-open-overlay')).toBeHidden();
    await expect(page.locator('.editor-filetab')).toContainText('mtx-service.js', { timeout: 10000 });
  });

  test('optional access-token auth gates HTTP, WebSocket, and unlocks via cookie/Bearer', async () => {
    const port = 9456 + Math.floor(Math.random() * 200);
    const token = 'test-secret-token-abcdef123456';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meowtrix-auth-test-'));
    const srv = spawn(process.execPath, [path.join(REPO_DIR, 'server.js')], {
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        MEOWTRIX_TOKEN: token,
        MEOWTRIX_DATA_DIR: tmpDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const base = `http://127.0.0.1:${port}`;

    try {
      // Wait for server to listen.
      await expect.poll(async () => {
        try {
          const r = await fetch(`${base}/api/auth/status`);
          return r.ok;
        } catch { return false; }
      }, { timeout: 10000 }).toBe(true);

      // 1. Auth status reports enabled & unauthenticated.
      const st1 = await (await fetch(`${base}/api/auth/status`)).json();
      expect(st1).toEqual({ ok: true, enabled: true, authenticated: false });

      // 2. Unauthenticated API call returns 401.
      const apiUnauth = await fetch(`${base}/api/settings`);
      expect(apiUnauth.status).toBe(401);

      // 3. Unauthenticated GET / redirects to /auth.
      const rootUnauth = await fetch(`${base}/`, { redirect: 'manual' });
      expect(rootUnauth.status).toBe(302);
      expect(rootUnauth.headers.get('location')).toBe('/auth');

      // 4. Unauthenticated WebSocket upgrade is rejected with 401.
      const wsStatus = await new Promise((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
        ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
        ws.on('open', () => { ws.close(); resolve(101); });
        ws.on('error', () => {});
      });
      expect(wsStatus).toBe(401);

      // 5. Bearer token unlocks API & WebSocket.
      const apiBearer = await fetch(`${base}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(apiBearer.status).toBe(200);

      const wsBearer = await new Promise((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        ws.on('open', () => { ws.close(); resolve(101); });
        ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
        ws.on('error', () => {});
      });
      expect(wsBearer).toBe(101);

      // 6. Wrong token on POST /api/auth/login returns 401; right token sets cookie.
      const badLogin = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'wrong' }),
      });
      expect(badLogin.status).toBe(401);

      const goodLogin = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      expect(goodLogin.status).toBe(200);
      const setCookie = goodLogin.headers.get('set-cookie') || '';
      expect(setCookie).toContain('meowtrix_auth=');
      expect(setCookie).toContain('HttpOnly');

      const cookiePair = setCookie.split(';')[0];
      const apiCookie = await fetch(`${base}/api/settings`, {
        headers: { Cookie: cookiePair },
      });
      expect(apiCookie.status).toBe(200);

      // 7. Magic link GET /?token=... sets cookie and redirects to /.
      const magic = await fetch(`${base}/?token=${encodeURIComponent(token)}`, { redirect: 'manual' });
      expect(magic.status).toBe(302);
      expect(magic.headers.get('location')).toBe('/');
      expect(magic.headers.get('set-cookie')).toContain('meowtrix_auth=');
    } finally {
      srv.kill();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
