import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"

// Custom fixture for extension testing
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, "../../apps/extension/build/chrome-mv3-prod")
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-sandbox",
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers()
    if (!background) background = await context.waitForEvent("serviceworker")
    const id = background.url().split("/")[2]
    await use(id)
  },
})

test("side panel loads with calculator UI", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(page.locator("header span.text-lg.font-bold")).toContainText("Icecap")
  await expect(page.getByTestId("scrape-btn")).toBeVisible()
})

test("price input triggers metric recalculation", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Enter price
  const priceInput = page.locator("input[type='number']").first()
  await priceInput.fill("500000")
  await priceInput.press("Tab")

  // Enter rent
  const rentInput = page.locator("input[type='number']").nth(1)
  await rentInput.fill("3000")
  await rentInput.press("Tab")

  // The blue result card should show metrics
  await expect(page.getByTestId("result-card")).toBeVisible()
})

test("rental/flip mode toggle works", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Should start in rental mode
  const flipBtn = page.getByRole("button", { name: "Flip" })
  await flipBtn.click()

  // In flip mode, should show ARV field instead of rent
  await expect(page.getByText("ARV")).toBeVisible()
  await expect(page.getByText("70% Rule MAO")).toBeVisible()
})

test("assumptions sliders update display values", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Down payment slider
  const slider = page.locator("input[type='range']").first()
  await slider.fill("30")
  await expect(page.getByText("30%")).toBeVisible()
})

test("BRRRR mode shows extended metrics", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const brrrrBtn = page.getByRole("button", { name: "BRRRR" })
  await brrrrBtn.click()

  await expect(page.locator("h3").getByText("BRRRR Metrics")).toBeVisible()
})
