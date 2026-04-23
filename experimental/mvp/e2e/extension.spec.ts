import { test as base, chromium, type BrowserContext, expect } from '@playwright/test';
import path from 'path';

// Define the custom fixture that loads the extension
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    // Path to the manifest.json directory
    // Plasmo builds to build/chrome-mv3-dev (or similar)
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

test('should load the extension and show the Hub login page', async ({ page }) => {
  // Navigate to our local Hub (assuming it's running on 5173)
  await page.goto('http://localhost:5173');
  
  // Verify Hub is rendered
  await expect(page.locator('h1')).toContainText('Icecap Hub');
  await expect(page.getByText('Sign in with Google')).toBeVisible();
});

test('should interact with the side panel calculator', async ({ page, extensionId }) => {
  // Set viewport to match real side panel dimensions (usually narrow)
  await page.setViewportSize({ width: 400, height: 800 });
  
  // Navigate directly to the side panel page
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  
  // 1. Verify initial state
  await expect(page.locator('h1')).toContainText('Icecap');
  
  // 2. Input a custom price
  const priceInput = page.locator('input[type="number"]').first();
  await priceInput.fill('600000');
  
  // 3. Input custom rent
  const rentInput = page.locator('input[type="number"]').nth(1);
  await rentInput.fill('4000');
  
  // 4. Verify Metrics update (e.g. Cap Rate)
  // Our calculator updates instantly. Let's check for the big blue metrics card.
  const metricsCard = page.locator('.bg-blue-600');
  await expect(metricsCard).toBeVisible();
  
  // Check for some expected math results
  // With 600k price and 4k rent, 1% rule should be 0.67%
  await expect(page.getByText('0.67%')).toBeVisible();
  
  // 5. Test the Slider
  const slider = page.locator('input[type="range"]').first();
  await slider.fill('50'); // Change down payment to 50%
  
  // Cash flow should increase significantly
  // (We don't need exact math here, just that it's rendered)
  await expect(page.getByText('50%')).toBeVisible();
});

test('should inject cashflow badges into Redfin search page', async ({ page }) => {
  // Go to a Redfin search page
  await page.goto('https://www.redfin.com/city/17151/CA/San-Francisco');
  
  // Wait for the script to process prices (using our data-icecap-processed attribute)
  const badge = page.locator('[data-icecap-processed="true"]').first();
  
  // Increase timeout as Redfin can be slow to load
  await expect(badge).toBeVisible({ timeout: 15000 });
  
  // Verify it contains a + or - sign indicating cashflow math happened
  const text = await badge.innerText();
  expect(text).toMatch(/[+-]\$/);
});

