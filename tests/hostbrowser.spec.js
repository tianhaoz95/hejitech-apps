const { test, expect } = require('@playwright/test');
const http = require('http');

// Host-browser tabs (hostbrowser-service.js + public/hostbrowser.js): a real
// Chromium on the host, streamed into a canvas, with input forwarded back.
// Needs a Chromium-based browser on the host running the server; skipped when
// /api/hostbrowser/status reports none (e.g. a slim Docker image).

// A tiny site for the host browser to load. It must be reachable from the
// *server's* host, so it binds on all interfaces and the test addresses it by
// the same hostname as the Meowtrix server.
function startFixtureSite() {
  const server = http.createServer((req, res) => {
    if (req.url === '/login') {
      res.writeHead(302, { Location: '/', 'Set-Cookie': 'session=abc123; Path=/; HttpOnly' });
      return res.end();
    }
    if (req.url === '/popup') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<title>Popup page</title><h1>popup opened</h1>');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><title>Fixture</title>
      <style>body{margin:0;font:16px sans-serif} #q{position:fixed;left:10px;top:10px;width:300px;height:30px}
      #pop{position:fixed;left:10px;top:60px}</style>
      <input id="q" autocomplete="off">
      <a id="pop" href="/popup" target="_blank">open popup</a>
      <div id="out" style="margin-top:120px">typed:</div>
      <div id="cookie">server-cookie:${(req.headers.cookie || '').includes('session=abc123') ? 'yes' : 'no'}</div>
      <script>
        q.addEventListener('input', () => { out.textContent = 'typed:' + q.value; });
      </script>`);
  });
  return new Promise((resolve) => server.listen(0, '0.0.0.0', () => resolve(server)));
}

test.describe('host browser tab', () => {
  let site;
  let siteUrl;

  test.beforeAll(async ({ baseURL }) => {
    site = await startFixtureSite();
    const host = new URL(baseURL).hostname;
    siteUrl = `http://${host === 'localhost' ? '127.0.0.1' : host}:${site.address().port}`;
  });
  test.afterAll(() => new Promise(r => { site.close(r); site.closeAllConnections(); }));

  test.beforeEach(async ({ page, request }) => {
    const status = await (await request.get('/api/hostbrowser/status')).json();
    test.skip(!status.available, 'no Chromium-based browser on the server host');
    await request.post('/api/settings/reset');
    await request.post('/api/session', { data: { workspaces: [{ name: 'Workspace 1', layout: null }], activeWorkspaceIndex: 0 } });
    await page.goto('/');
    const takeoverBtn = page.locator('#btn-takeover');
    try {
      await takeoverBtn.waitFor({ state: 'visible', timeout: 1500 });
      await takeoverBtn.click();
    } catch (e) {}
    await expect.poll(() => page.evaluate(() => isActiveSession)).toBe(true);
  });

  const tabs = async (request) => (await (await request.get('/api/hostbrowser/tabs')).json()).tabs;
  const pageText = async (request, id) => (await request.get(`/api/hostbrowser/tabs/${id}/text`)).text();

  test('streams the page, forwards typing, keeps cookies, opens popups as tabs', async ({ page, request }) => {
    test.setTimeout(90000);
    const tabId = await page.evaluate((url) => addTab(activePane, 'hostbrowser', undefined, undefined, url).id, siteUrl + '/');

    // Frames arrive: the canvas gets a backing size and the overlay goes away.
    const stage = page.locator(`.pane-view[data-tab-id="${tabId}"] .hostbrowser-stage`);
    await expect(stage.locator('.hostbrowser-overlay')).toBeHidden({ timeout: 45000 });
    await expect.poll(() => stage.locator('canvas').evaluate(c => c.width)).toBeGreaterThan(100);
    await expect.poll(async () => (await tabs(request)).find(t => t.id === tabId)?.title).toBe('Fixture');

    // The address bar and tab label follow the page.
    await expect(page.locator(`.pane-view[data-tab-id="${tabId}"] .browser-url`)).toHaveValue(siteUrl + '/');

    // Click into the input (fixed at 10,10 in the page) and type.
    const box = await stage.boundingBox();
    await page.mouse.click(box.x + 60, box.y + 25);
    await page.keyboard.type('hello host');
    await expect.poll(() => pageText(request, tabId)).toContain('typed:hello host');

    // Backspace and shifted characters go through too.
    await page.keyboard.press('Backspace');
    await page.keyboard.type('T!');
    await expect.poll(() => pageText(request, tabId)).toContain('typed:hello hosT!');

    // A 302 + HttpOnly Set-Cookie sticks (it lives in the host browser's profile).
    await page.evaluate(({ id, url }) => {
      const t = getAllPanes().flatMap(p => p.tabs).find(t => t.id === id);
      t.navigate(url);
    }, { id: tabId, url: siteUrl + '/login' });
    await expect.poll(() => pageText(request, tabId)).toContain('server-cookie:yes');

    // target=_blank → a new host-browser tab beside it, attached to the popup page.
    const before = (await tabs(request)).length;
    await page.mouse.click(box.x + 40, box.y + 68);
    await expect.poll(async () => (await tabs(request)).length).toBe(before + 1);
    await expect.poll(() => page.evaluate(() => getAllPanes().flatMap(p => p.tabs).filter(t => t.type === 'hostbrowser').length)).toBe(2);
    const popup = (await tabs(request)).find(t => t.id !== tabId);
    await expect.poll(() => pageText(request, popup.id)).toContain('popup opened');

    // Refresh: the page survives and re-attaches (no reload of the site).
    await page.reload();
    try { await page.locator('#btn-takeover').click({ timeout: 1500 }); } catch (e) {}
    await expect(page.locator(`.pane-view[data-tab-id="${tabId}"] .hostbrowser-overlay`)).toBeHidden({ timeout: 30000 });
    expect((await tabs(request)).find(t => t.id === tabId)).toBeTruthy();

    // Closing the tabs closes the pages on the host.
    await page.evaluate(() => {
      for (const p of getAllPanes()) for (const t of [...p.tabs]) if (t.type === 'hostbrowser') closeTab(p, t.id);
    });
    await expect.poll(async () => (await tabs(request)).length).toBe(0);
  });

  test('agent surface: screenshot and mtx open --host', async ({ page, request }) => {
    test.setTimeout(60000);
    await expect.poll(() => page.evaluate(() => getAllPanes()[0]?.tabs[0]?.ptyId || null)).toBeTruthy();
    const ptyId = await page.evaluate(() => getAllPanes()[0].tabs[0].ptyId);
    const r = await request.post('/api/mtx/open', { data: { url: siteUrl + '/', ptyId, host: true } });
    expect((await r.json()).ok).toBe(true);
    await expect.poll(async () => (await tabs(request)).length).toBe(1);
    const [t] = await tabs(request);
    await expect.poll(() => pageText(request, t.id)).toContain('typed:');
    const shot = await request.get(`/api/hostbrowser/tabs/${t.id}/screenshot`);
    expect(shot.headers()['content-type']).toBe('image/png');
    expect((await shot.body()).length).toBeGreaterThan(1000);
    await page.evaluate(() => { for (const p of getAllPanes()) for (const x of [...p.tabs]) if (x.type === 'hostbrowser') closeTab(p, x.id); });
    await expect.poll(async () => (await tabs(request)).length).toBe(0);
  });
});
