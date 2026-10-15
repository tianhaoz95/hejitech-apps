const { test, expect } = require('@playwright/test');
const path = require('path');

// The core user journey: open a terminal tab, run a command, see its output.
// Reads the xterm buffer directly (the WebGL renderer has no DOM rows), and
// matches a line that is *only* the file name, so the echoed command line
// (`ls …`) can't satisfy it — real output from a real shell is required.

const CDN = 'https://cdn.jsdelivr.net/npm/';
const NM = path.join(__dirname, '..', 'node_modules');
// CDN fallback URL → the same file in node_modules, so the fallback test is
// deterministic and offline-safe.
const CDN_TO_LOCAL = {
  'xterm@5.3.0/lib/xterm.js': 'xterm/lib/xterm.js',
  'xterm@5.3.0/css/xterm.css': 'xterm/css/xterm.css',
  'xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js': 'xterm-addon-fit/lib/xterm-addon-fit.js',
  '@xterm/addon-search@0.15.0/lib/addon-search.js': '@xterm/addon-search/lib/addon-search.js',
  '@xterm/addon-web-links@0.12.0/lib/addon-web-links.min.js': '@xterm/addon-web-links/lib/addon-web-links.js',
  'xterm-addon-webgl@0.16.0/lib/xterm-addon-webgl.js': 'xterm-addon-webgl/lib/xterm-addon-webgl.js',
};

async function resetServerState(request) {
  await request.post('/api/settings/reset');
  await request.post('/api/session', {
    data: { workspaces: [{ name: 'Workspace 1', layout: null }], activeWorkspaceIndex: 0 },
  });
}

async function openApp(page) {
  await page.goto('/');
  const takeoverBtn = page.locator('#btn-takeover');
  try {
    await takeoverBtn.waitFor({ state: 'visible', timeout: 1500 });
    await takeoverBtn.click();
  } catch (e) {}
  await expect(page.locator('#workspace')).toBeVisible();
}

function terminalLines(page) {
  return page.evaluate(() => {
    const term = getAllPanes().map(p => p.activeTab).find(t => t && t.type === 'terminal')?.term;
    if (!term) return null;
    const buf = term.buffer.active, out = [];
    for (let i = 0; i < buf.length; i++) out.push(buf.getLine(i)?.translateToString(true) ?? '');
    return out;
  });
}

async function runLsJourney(page) {
  // The shell creates the file itself (the e2e server may run in Docker, so
  // the host's filesystem isn't the shell's), and the name is built with
  // arithmetic so the literal only ever appears as `ls` output.
  const target = 'meow-ls-42.txt';
  await page.locator('.tab-add').first().click();
  await page.locator('.tab-type-picker button:has-text("Terminal")').click();
  const view = page.locator('.terminal-view.active').first();
  await view.waitFor({ state: 'visible' });
  // The shell is up once its prompt is in the buffer.
  await expect.poll(async () => (await terminalLines(page) || []).join('\n').trim().length, { timeout: 15000 }).toBeGreaterThan(0);
  await view.click();
  await page.keyboard.type('d=$(mktemp -d) && cd "$d" && touch meow-ls-$((6*7)).txt && ls');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await terminalLines(page) || []).some(l => l.trim() === target), { timeout: 10000 }).toBe(true);
}

test.describe('terminal tab journey', () => {
  test.beforeEach(async ({ request }) => { await resetServerState(request); });

  test('opens a terminal tab and runs ls', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openApp(page);
    await runLsJourney(page);
    expect(errors).toEqual([]);
  });

  test('still works when the server lacks the /vendor xterm routes (CDN fallback)', async ({ page }) => {
    // A server that lags public/ (pulled but not restarted) 404s /vendor/xterm*;
    // the page must fall back to the CDN copies instead of losing terminals.
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/\/vendor\/xterm/, r => r.fulfill({ status: 404, body: 'not found' }));
    await page.route(url => url.href.startsWith(CDN) && !!CDN_TO_LOCAL[url.href.slice(CDN.length)], r => {
      const file = CDN_TO_LOCAL[r.request().url().slice(CDN.length)];
      r.fulfill({ path: path.join(NM, file), contentType: file.endsWith('.css') ? 'text/css' : 'application/javascript' });
    });
    await openApp(page);
    await runLsJourney(page);
    expect(errors).toEqual([]);
  });

  test('an inactive window resizing does not shrink the active session\'s PTY', async ({ browser }) => {
    // Every window fits its own copy of the layout. An inactive one (another
    // browser, device or stale tab) used to send pty:resize too, shrinking the
    // PTY under the active session — whose xterm didn't change, so nothing
    // corrected it and a TUI launched later drew into a corner of the pane.
    const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    try {
      const a = await ctxA.newPage();
      await openApp(a);
      await runLsJourney(a);
      await a.evaluate(() => flushSessionState());

      const b = await ctxB.newPage();
      await openApp(b);
      await expect(a.locator('#inactive-overlay')).toBeVisible();
      await expect.poll(async () => (await terminalLines(b) || []).join('').trim().length, { timeout: 15000 }).toBeGreaterThan(0);

      await a.setViewportSize({ width: 700, height: 400 });
      await a.waitForTimeout(500); // past the fit settle + resize debounce

      const size = await b.evaluate(() => {
        const t = getAllPanes().map(p => p.activeTab).find(t => t && t.type === 'terminal');
        return `${t.term.rows} ${t.term.cols}`;
      });
      await b.locator('.terminal-view.active').first().click();
      await b.keyboard.type('echo "SZ=$(stty size)"');
      await b.keyboard.press('Enter');
      await expect.poll(async () => (await terminalLines(b) || []).find(l => /^SZ=\d/.test(l.trim()))?.trim(), { timeout: 10000 })
        .toBe(`SZ=${size}`);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
