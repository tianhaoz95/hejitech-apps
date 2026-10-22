const { test, expect } = require('@playwright/test');

// When the control socket drops, a banner counts down to the next attempt and
// goes away once the socket is back.

test('a dropped connection shows the reconnect banner until it is back', async ({ page, request }) => {
  await request.post('/api/settings/reset');
  await page.goto('/');
  try {
    await page.locator('#btn-takeover').click({ timeout: 1500 });
  } catch (e) {}
  await expect(page.locator('#workspace')).toBeVisible();
  await expect.poll(() => page.evaluate(() => wsReady)).toBe(true);

  await page.evaluate(() => ws.close());
  const banner = page.locator('#reconnect-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Connection lost');
  await expect(banner.locator('#reconnect-banner-btn')).toHaveText('Reconnect Now');

  await expect(banner).toBeHidden({ timeout: 8000 });
  await expect.poll(() => page.evaluate(() => wsReady)).toBe(true);
});
