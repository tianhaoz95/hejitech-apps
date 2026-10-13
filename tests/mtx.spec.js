const { test, expect } = require('@playwright/test');
const { execFile, spawn } = require('child_process');
const path = require('path');

// The mtx agent bridge: `mtx open/edit/layout/notify` and `mtx mcp` call
// /api/mtx/*, which round-trips to the active session (public/mtx.js) to place
// tabs beside the calling terminal ($MEOWTRIX_PTY_ID) without stealing focus.
test.describe('mtx agent bridge', () => {
  let base;
  let ptyId;

  test.beforeEach(async ({ page, request, baseURL }) => {
    base = baseURL;
    await request.post('/api/settings/reset');
    await request.post('/api/session', {
      data: { workspaces: [{ name: 'Workspace 1', layout: null }], activeWorkspaceIndex: 0 },
    });
    await page.goto('/');
    const takeoverBtn = page.locator('#btn-takeover');
    try {
      await takeoverBtn.waitFor({ state: 'visible', timeout: 1500 });
      await takeoverBtn.click();
    } catch (e) {}
    await expect(page.locator('#workspace')).toBeVisible();
    // The single default pane's terminal plays the calling agent.
    await expect.poll(() => page.evaluate(() => getAllPanes()[0]?.tabs[0]?.ptyId || null)).toBeTruthy();
    ptyId = await page.evaluate(() => getAllPanes()[0].tabs[0].ptyId);
    await expect.poll(() => page.evaluate(() => isActiveSession)).toBe(true);
  });

  const paneSummary = (page) => page.evaluate(() => getAllPanes().map(p => ({
    types: p.tabs.map(t => t.type),
    active: p.activeTab?.type,
    url: p.activeTab?.currentUrl || null,
    focused: p === activePane,
  })));

  test('open: splits beside the caller, then reuses the dev-server tab', async ({ page, request }) => {
    const target = `${base}/meowtrix-version.js`;
    const r1 = await request.post('/api/mtx/open', { data: { url: target, ptyId } });
    expect(r1.ok()).toBeTruthy();
    const j1 = await r1.json();
    expect(j1.action).toBe('opened-in-new-split');

    let panes = await paneSummary(page);
    expect(panes).toHaveLength(2);
    expect(panes[0]).toMatchObject({ types: ['terminal'], focused: true }); // focus stays with the agent's terminal
    expect(panes[1]).toMatchObject({ types: ['browser'], active: 'browser' });
    expect(panes[1].url).toBe(new URL(target).href);

    // Same local origin → retarget the existing tab instead of adding another.
    const r2 = await request.post('/api/mtx/open', { data: { url: `${base}/favicon.ico`, ptyId } });
    expect((await r2.json()).action).toBe('reused');
    panes = await paneSummary(page);
    expect(panes).toHaveLength(2);
    expect(panes[1].types).toEqual(['browser']);
    expect(panes[1].url).toBe(`${base}/favicon.ico`);

    // reuse=false adds a tab to the other pane rather than splitting again.
    const r3 = await request.post('/api/mtx/open', { data: { url: target, ptyId, reuse: false } });
    expect((await r3.json()).action).toBe('opened');
    panes = await paneSummary(page);
    expect(panes).toHaveLength(2);
    expect(panes[1].types).toEqual(['browser', 'browser']);

    // An explicit pane id from the layout is honoured.
    const layout = await (await request.get(`/api/mtx/layout?ptyId=${ptyId}`)).json();
    expect(layout.ok).toBe(true);
    expect(layout.layout.type).toBe('split');
    expect(layout.layout.direction).toBe('row');
    const [mine, other] = layout.layout.children;
    expect(mine.containsCaller).toBe(true);
    expect(other.tabs.map(t => t.type)).toEqual(['browser', 'browser']);
    const r4 = await request.post('/api/mtx/open', { data: { url: 'https://example.com/', ptyId, placement: mine.id } });
    expect((await r4.json()).paneId).toBe(mine.id);
    panes = await paneSummary(page);
    expect(panes[0].types).toEqual(['terminal', 'browser']);
  });

  test('open: rejects non-http URLs', async ({ request }) => {
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', '']) {
      const r = await request.post('/api/mtx/open', { data: { url, ptyId } });
      expect(r.status()).toBe(400);
    }
  });

  test('open-file: opens an editor tab beside the caller at the file', async ({ page, request }) => {
    const { home } = await (await request.get('/api/fs/home')).json();
    const name = `mtx-e2e-${Date.now()}`;
    const dir = `${home.replace(/\/$/, '')}/${name}`;
    await request.post('/api/fs/create', { data: { path: home, name, type: 'dir' } });
    await request.post('/api/fs/create', { data: { path: dir, name: 'hello.txt', type: 'file' } });
    const file = `${dir}/hello.txt`;
    await request.put(`/api/fs/write?path=${encodeURIComponent(file)}`, { data: 'one\ntwo\nthree\n', headers: { 'Content-Type': 'text/plain' } });

    const r = await request.post('/api/mtx/open-file', { data: { path: file, line: 2, ptyId } });
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.action).toBe('opened-editor');
    const panes = await paneSummary(page);
    expect(panes).toHaveLength(2);
    expect(panes[1].types).toEqual(['editor']);
    await expect(page.locator('.editor-filetab', { hasText: 'hello.txt' })).toBeVisible();

    const missing = await request.post('/api/mtx/open-file', { data: { path: `${dir}/nope.txt`, ptyId } });
    expect(missing.status()).toBe(404);
  });

  test('notify: toast plus an attention dot on the caller tab', async ({ page, request }) => {
    // Move focus off the caller's tab so the dot is warranted.
    await request.post('/api/mtx/open', { data: { url: `${base}/meowtrix-version.js`, ptyId, placement: 'split' } });
    await page.evaluate(() => { const p = getAllPanes()[0]; addTab(p, 'browser'); });
    const r = await request.post('/api/mtx/notify', { data: { message: 'Build finished', title: 'demo', ptyId } });
    expect((await r.json()).ok).toBe(true);
    await expect(page.locator('#mtx-toast')).toHaveText('demo: Build finished');
    await expect(page.locator('.tab.mtx-attention')).toHaveCount(1);
    await page.locator('#mtx-toast').click();
    await expect.poll(() => page.evaluate(() => getAllPanes()[0].activeTab?.type)).toBe('terminal');
  });

  test('mtx CLI: open and layout', async ({ page }) => {
    const mtx = path.join(__dirname, '..', 'bin', 'mtx');
    const env = { ...process.env, MEOWTRIX_URL: base, MEOWTRIX_PTY_ID: ptyId };
    const run = (args) => new Promise((resolve) => {
      execFile(mtx, args, { env }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr }));
    });
    const open = await run(['open', `${base}/meowtrix-version.js`]);
    expect(open.code).toBe(0);
    expect(open.stdout).toContain('opened in new split');
    expect((await paneSummary(page))[1].types).toEqual(['browser']);

    const layout = await run(['layout']);
    expect(JSON.parse(layout.stdout).layout.children).toHaveLength(2);

    const bad = await run(['open', 'javascript:alert(1)']);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('http(s)');
  });

  test('mtx mcp: initialize, list tools, call open_url', async ({ page }) => {
    const proc = spawn(process.execPath, [path.join(__dirname, '..', 'bin', 'mtx-mcp.js')], {
      env: { ...process.env, MEOWTRIX_URL: base, MEOWTRIX_PTY_ID: ptyId },
    });
    const replies = new Map();
    let buf = '';
    proc.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        const msg = JSON.parse(line);
        replies.set(msg.id, msg);
      }
    });
    const call = async (id, method, params) => {
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      await expect.poll(() => replies.has(id), { timeout: 15000 }).toBe(true);
      return replies.get(id);
    };
    try {
      const init = await call(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } });
      expect(init.result.serverInfo.name).toBe('meowtrix');
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const list = await call(2, 'tools/list', {});
      expect(list.result.tools.map(t => t.name).sort()).toEqual(['get_layout', 'notify', 'open_file', 'open_url']);
      const res = await call(3, 'tools/call', { name: 'open_url', arguments: { url: `${base}/meowtrix-version.js` } });
      expect(res.result.isError).toBeFalsy();
      expect(res.result.content[0].text).toContain('Opened');
      expect((await paneSummary(page))[1].types).toEqual(['browser']);
      const bad = await call(4, 'tools/call', { name: 'open_url', arguments: { url: 'file:///etc/passwd' } });
      expect(bad.result.isError).toBe(true);
    } finally {
      proc.kill();
    }
  });
});
