const { test, expect } = require('@playwright/test');

// A terminal bell (\a) in a background tab makes that tab's header pulse; the
// chime can be turned off in Settings.

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

function activeTerminalText(page) {
  return page.evaluate(() => {
    const term = getAllPanes().map(p => p.activeTab).find(t => t && t.type === 'terminal')?.term;
    if (!term) return '';
    const buf = term.buffer.active, out = [];
    for (let i = 0; i < buf.length; i++) out.push(buf.getLine(i)?.translateToString(true) ?? '');
    return out.join('\n');
  });
}

async function newTerminal(page) {
  await page.locator('.tab-add').first().click();
  await page.locator('.tab-type-picker button:has-text("Terminal")').click();
  const view = page.locator('.terminal-view.active').first();
  await view.waitFor({ state: 'visible' });
  await expect.poll(async () => (await activeTerminalText(page)).trim().length, { timeout: 15000 }).toBeGreaterThan(0);
  await view.click();
}

test.describe('terminal bell', () => {
  test.beforeEach(async ({ request }) => { await resetServerState(request); });

  test('a bell in a background tab pulses that tab', async ({ page }) => {
    await openApp(page);
    await newTerminal(page);
    await newTerminal(page);
    const ringing = page.locator('.tab').last();
    await page.keyboard.type('sleep 2; printf "\\a"');
    await page.keyboard.press('Enter');
    await page.locator('.tab').first().click(); // look at another tab while it rings
    await expect(ringing).toHaveClass(/tab-bell-pulse/, { timeout: 8000 });
    await ringing.click(); // opening it clears the pulse
    await expect(ringing).not.toHaveClass(/tab-bell-pulse/);
  });

  test('the chime setting is saved', async ({ page, request }) => {
    await openApp(page);
    const settings = await (await request.get('/api/settings')).json();
    expect(settings.termBellSound).toBe(true);
    await page.evaluate(() => saveSetting('termBellSound', false));
    expect((await (await request.get('/api/settings')).json()).termBellSound).toBe(false);
  });
});
