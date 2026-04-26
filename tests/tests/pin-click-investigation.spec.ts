/**
 * Investigation test: diagnose why Redfin map pin clicks don't update the sidepanel.
 *
 * The test intercepts https://www.redfin.com/* and serves a mock page that
 * contains the exact pin HTML structure the user reported. It then instruments
 * both the page and the sidepanel to trace every step of the pipeline:
 *
 *   A) Does the document click listener fire when the pin is clicked?
 *   B) Does closest() resolve to the pin element?
 *   C) Is chrome.runtime.sendMessage called from the content script?
 *   D) Does the sidepanel's onMessage handler receive the message?
 */

import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, "../../apps/extension/build/chrome-mv3-prod")
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-sandbox",
        "--ignore-certificate-errors",
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers()
    if (!background) background = await context.waitForEvent("serviceworker")
    await use(background.url().split("/")[2])
  },
})

// ---------------------------------------------------------------------------
// Mock Redfin search page with the exact pin structure the user reported
// ---------------------------------------------------------------------------

const MOCK_REDFIN_SEARCH = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Redfin Mock</title></head>
<body style="margin:0;background:#e5e7eb">
  <h2 style="padding:16px">Mock Redfin Search Page</h2>
  <div id="map-container" style="position:relative;width:800px;height:500px;background:#d1fae5;margin:16px">
    <!-- Exact structure from user report -->
    <div
      class="bp-PushpinContent"
      data-dd-action-name="map_pushpin"
      data-rf-test-name="home-marker"
      data-rf-test-id="home-marker-110100954"
      aria-hidden="true"
      style="position:absolute;top:180px;left:260px;cursor:pointer;background:white;border:2px solid #3b82f6;border-radius:4px;padding:4px 8px;z-index:10;user-select:none"
    >
      <div class="inner-pushpin-content showMapPinPreview" data-rf-test-name="home-marker-content">
        <div class="price showMapPinPreview" data-rf-test-name="pushpin-price-text"
             style="font-size:13px;font-weight:bold">
          375K
        </div>
      </div>
    </div>
  </div>
  <p style="padding:16px;color:#6b7280">Click the blue pin above to test detection.</p>
</body>
</html>`

// ---------------------------------------------------------------------------
// Investigation test
// ---------------------------------------------------------------------------

test("diagnose pin click pipeline", async ({ page, context, extensionId }) => {
  // --- Route interception: serve mock HTML for all Redfin requests ----------
  await context.route("https://www.redfin.com/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: MOCK_REDFIN_SEARCH,
    })
  })

  // --- Open sidepanel so its onMessage listener is active -------------------
  const sidepanel = await context.newPage()
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sidepanel.waitForLoadState("domcontentloaded")

  // Inject a monitoring listener into the sidepanel's JS world.
  // Extension pages have chrome.runtime access, so this works.
  await sidepanel.evaluate(() => {
    ;(window as any).__icecap_received = []
    chrome.runtime.onMessage.addListener((msg: any) => {
      ;(window as any).__icecap_received.push(msg)
    })
  })

  // --- Navigate to mock Redfin page ----------------------------------------
  const pageLogs: string[] = []
  page.on("console", (m) => pageLogs.push(m.text()))

  await page.goto("https://www.redfin.com/city/27046/CA/San-Francisco/homes-for-sale")
  await page.waitForLoadState("domcontentloaded")

  // Allow content script to initialize
  await page.waitForTimeout(800)

  // --- Step A: check pin exists in DOM and its computed pointer-events ------
  const pinInfo = await page.evaluate(() => {
    const pin = document.querySelector('[data-rf-test-name="home-marker"]') as HTMLElement | null
    if (!pin) return { found: false }
    const style = window.getComputedStyle(pin)
    const rect = pin.getBoundingClientRect()
    return {
      found: true,
      pointerEvents: style.pointerEvents,
      visibility: style.visibility,
      display: style.display,
      ariaHidden: pin.getAttribute("aria-hidden"),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    }
  })
  console.log("\n=== Step A: Pin element info ===")
  console.log(JSON.stringify(pinInfo, null, 2))

  // --- Instrument the page world to trace what the click event sees ---------
  // (Content script runs in isolated world so we can't read its internals,
  //  but we CAN observe what the browser dispatches in the main world.)
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      (e: MouseEvent) => {
        const t = e.target as HTMLElement
        const closest = t.closest('[data-rf-test-name="home-marker"], [data-dd-action-name="map_pushpin"]')
        console.log(
          "PAGE_CLICK_TARGET:",
          t.tagName,
          "|attr:data-rf-test-name=", t.getAttribute("data-rf-test-name") ?? "none",
          "|closest-pin:", closest ? "FOUND" : "NOT_FOUND",
          "|pointerEvents:", window.getComputedStyle(t).pointerEvents
        )
      },
      true,
    )
  })

  // --- Step B: click the pin ------------------------------------------------
  await page.locator('[data-rf-test-name="home-marker"]').click({ force: true })
  console.log("\n=== Step B: Clicked pin ===")

  // Immediate-send fix: price should arrive at sidepanel within ~500ms of click.
  // Poll the sidepanel for the first message, then wait for retry upgrades.
  await sidepanel.waitForFunction(
    () => (window as any).__icecap_received?.length > 0,
    { polling: 100, timeout: 3000 }
  )
  // Extra wait for the retry chain to deliver upgraded data (address, taxes, etc.)
  await page.waitForTimeout(3000)

  // --- Step C: did sidepanel receive any message? ---------------------------
  const received = await sidepanel.evaluate(() => (window as any).__icecap_received ?? [])
  console.log("\n=== Step C: Messages received at sidepanel ===")
  console.log(JSON.stringify(received, null, 2))

  // --- Step D: did the store get updated? -----------------------------------
  const storePrice = await sidepanel.evaluate(() => {
    try {
      // Exposed in useEmulator/IS_DEV mode
      const s = (window as any).store
      return s ? s.price : "store_not_exposed"
    } catch {
      return "error"
    }
  })
  console.log("\n=== Step D: Sidepanel store.price ===", storePrice)

  // --- Report page console logs from content script -------------------------
  console.log("\n=== Page console logs ===")
  pageLogs.forEach((l) => console.log(l))

  // --- Assertions -----------------------------------------------------------
  expect(pinInfo.found, "Pin element not found in mock page DOM").toBe(true)

  // The most critical check: sidepanel must have received the message
  const pinMsg = received.find((m: any) => m?.action === "propertyDetected")
  expect(
    pinMsg,
    `No 'propertyDetected' message reached the sidepanel.\n` +
      `This means the content script's sendMessage never fired, OR the message ` +
      `was sent but the sidepanel listener didn't receive it.\n` +
      `Pin info: ${JSON.stringify(pinInfo)}\n` +
      `Page logs: ${pageLogs.join(" | ")}`
  ).toBeTruthy()

  expect(pinMsg?.data?.price).toBe(375000)
})
