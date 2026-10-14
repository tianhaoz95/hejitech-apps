const { test, expect } = require('@playwright/test');

// Native browser tabs (public/nativebrowser.js) in the desktop app. The Tauri
// IPC is stubbed: we check what the page asks the native side to do — create a
// view over the placeholder, keep it placed, hide it when DOM UI covers it,
// react to its events, close it with the tab. (The Rust side is exercised by
// `cargo test` and by hand in the app.)

test.describe('native browser tabs (desktop app, stubbed IPC)', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post('/api/settings/reset');
    await request.post('/api/session', { data: { workspaces: [{ name: 'Workspace 1', layout: null }], activeWorkspaceIndex: 0 } });
    await page.addInitScript(() => {
      window.__nbCalls = [];
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd, args) => {
          if (cmd.startsWith('nb_')) window.__nbCalls.push({ cmd, ...(args || {}) });
          if (cmd === 'nb_supported') return true;
          if (cmd === 'nb_hide_all') return [];
          if (cmd === 'nb_open') return args.url;
          return null;
        },
      };
    });
    await page.goto('/');
    try { await page.locator('#btn-takeover').click({ timeout: 1500 }); } catch (e) {}
    await expect.poll(() => page.evaluate(() => isActiveSession)).toBe(true);
  });

  const calls = (page, cmd) => page.evaluate((c) => window.__nbCalls.filter(x => x.cmd === c), cmd);
  const lastVisible = async (page, id) => {
    const v = (await calls(page, 'nb_set_visible')).filter(c => c.id === id);
    return v.length ? v[v.length - 1].visible : null;
  };

  test('creates a native view over the placeholder, hides it under the palette, follows events', async ({ page }) => {
    const id = await page.evaluate(() => addTab(activePane, 'browser', undefined, undefined, 'https://example.com/').id);
    // Native, not the proxy iframe.
    await expect(page.locator(`.pane-view[data-tab-id="${id}"] .native-browser-host`)).toBeVisible();
    await expect(page.locator(`.pane-view[data-tab-id="${id}"] iframe`)).toHaveCount(0);

    await expect.poll(async () => (await calls(page, 'nb_open')).length).toBe(1);
    const [open] = await calls(page, 'nb_open');
    expect(open).toMatchObject({ id, url: 'https://example.com/' });

    // Placed exactly over the placeholder and shown.
    const box = await page.locator(`.pane-view[data-tab-id="${id}"] .native-browser-host`).boundingBox();
    await expect.poll(() => lastVisible(page, id)).toBe(true);
    const bounds = (await calls(page, 'nb_set_bounds')).filter(c => c.id === id).pop();
    expect(bounds.x).toBeCloseTo(box.x, 0);
    expect(bounds.y).toBeCloseTo(box.y, 0);
    expect(bounds.width).toBeCloseTo(box.width, 0);
    expect(bounds.vw).toBe(await page.evaluate(() => window.innerWidth));

    // DOM UI drawn over the page hides the native view, and it comes back after.
    await page.evaluate(() => openPalette());
    await expect.poll(() => lastVisible(page, id)).toBe(false);
    await page.keyboard.press('Escape');
    await expect.poll(() => lastVisible(page, id)).toBe(true);

    // Splitting the pane moves/resizes the placeholder → new bounds.
    const before = (await calls(page, 'nb_set_bounds')).length;
    await page.evaluate(() => splitPane(activePane, 'vertical'));
    await expect.poll(async () => (await calls(page, 'nb_set_bounds')).length).toBeGreaterThan(before);

    // Events from the native side update the tab and the address bar.
    await page.evaluate((id) => {
      onNativeBrowserEvent({ id, kind: 'loading', url: 'https://example.com/next' });
      onNativeBrowserEvent({ id, kind: 'title', title: 'Next page' });
      onNativeBrowserEvent({ id, kind: 'loaded', url: 'https://example.com/next' });
    }, id);
    const tab = page.locator('.tab', { hasText: 'Next page' });
    await expect(tab).toBeVisible();
    await expect(page.locator(`.pane-view[data-tab-id="${id}"] .browser-url`)).toHaveValue('https://example.com/next');
    await expect.poll(() => page.evaluate((id) => getAllPanesAllWorkspaces().flatMap(p => p.tabs).find(t => t.id === id).currentUrl, id)).toBe('https://example.com/next');

    // target=_blank → a new native tab.
    await page.evaluate((id) => onNativeBrowserEvent({ id, kind: 'new-window', url: 'https://example.org/' }), id);
    await expect.poll(async () => (await calls(page, 'nb_open')).map(c => c.url)).toContain('https://example.org/');

    // Navigation from the address bar goes to the native view.
    const urlBar = page.locator(`.pane-view[data-tab-id="${id}"] .browser-url`);
    await page.evaluate((id) => { const p = getAllPanesAllWorkspaces().find(p => p.tabs.some(t => t.id === id)); activateTab(p, id); }, id);
    await urlBar.fill('example.net');
    await urlBar.press('Enter');
    await expect.poll(async () => (await calls(page, 'nb_navigate')).pop()?.url).toBe('https://example.net');

    // Closing the tab closes the native view.
    await page.evaluate((id) => { const p = getAllPanesAllWorkspaces().find(p => p.tabs.some(t => t.id === id)); closeTab(p, id); }, id);
    await expect.poll(async () => (await calls(page, 'nb_close')).map(c => c.id)).toContain(id);
  });

  test('the "proxy" engine setting keeps the iframe browser', async ({ page, request }) => {
    await request.post('/api/settings', { data: { browserEngine: 'proxy' } });
    await page.reload();
    try { await page.locator('#btn-takeover').click({ timeout: 1500 }); } catch (e) {}
    await expect.poll(() => page.evaluate(() => typeof getSettings === 'function' && getSettings().browserEngine)).toBe('proxy');
    const id = await page.evaluate(() => addTab(activePane, 'browser').id);
    await expect(page.locator(`.pane-view[data-tab-id="${id}"] iframe.browser-frame`)).toHaveCount(1);
    expect(await calls(page, 'nb_open')).toHaveLength(0);
  });
});
