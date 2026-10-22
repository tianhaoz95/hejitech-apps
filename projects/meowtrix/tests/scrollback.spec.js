const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Right-click a terminal tab → Export Scrollback... downloads its whole buffer.

test('Export Scrollback downloads what the terminal shows', async ({ page, request }) => {
  await request.post('/api/settings/reset');
  await request.post('/api/session', { data: { workspaces: [{ name: 'Workspace 1', layout: null }], activeWorkspaceIndex: 0 } });
  await page.goto('/');
  try {
    await page.locator('#btn-takeover').click({ timeout: 1500 });
  } catch (e) {}
  await expect(page.locator('#workspace')).toBeVisible();

  await page.locator('.tab-add').first().click();
  await page.locator('.tab-type-picker button:has-text("Terminal")').click();
  const view = page.locator('.terminal-view.active').first();
  await view.waitFor({ state: 'visible' });
  const text = () => page.evaluate(() => {
    const term = getAllPanes().map(p => p.activeTab).find(t => t && t.type === 'terminal')?.term;
    const buf = term?.buffer.active, out = [];
    for (let i = 0; buf && i < buf.length; i++) out.push(buf.getLine(i)?.translateToString(true) ?? '');
    return out.join('\n');
  });
  await expect.poll(async () => (await text()).trim().length, { timeout: 15000 }).toBeGreaterThan(0);
  await view.click();
  await page.keyboard.type('for i in $(seq 1 40); do echo "line-$((i*3))"; done');
  await page.keyboard.press('Enter');
  await expect.poll(text, { timeout: 10000 }).toContain('line-120');

  await page.locator('.tab').last().click({ button: 'right' });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.tab-context-menu-item:has-text("Export Scrollback")').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.log$/);
  const saved = fs.readFileSync(await download.path(), 'utf8');
  expect(saved).toContain('line-3\n');
  expect(saved).toContain('line-120');
});
