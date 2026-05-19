/**
 * Captures real listing page screenshots for use as backgrounds in the promo mockups.
 *
 * Usage:
 *   pnpm --filter @icecap/tests run capture:promo
 *
 * Output:
 *   apps/promo/public/listing-redfin.png
 *   apps/promo/public/listing-zillow.png
 *   apps/promo/public/listing-realtor.png
 *
 * Before running:
 *   1. Replace the placeholder URLs in LISTINGS below with real listing URLs.
 *      Pick listings with strong metrics — cap rate 6%+, clean photos, no price reductions.
 *   2. Run from the repo root.
 */

import { test } from "@playwright/test"
import path from "path"
import fs from "fs"

// ─── Configure your listings here ────────────────────────────────────────────
const LISTINGS = {
  redfin: "https://www.redfin.com/TX/Austin/REPLACE-WITH-REAL-LISTING-PATH",
  zillow: "https://www.zillow.com/homedetails/REPLACE-WITH-REAL-LISTING-PATH",
  realtor: "https://www.realtor.com/realestateandhomes-detail/REPLACE-WITH-REAL-LISTING-PATH",
}
// ─────────────────────────────────────────────────────────────────────────────

const OUT_DIR = path.resolve(__dirname, "../../apps/promo/public")

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
})

// Selectors for cookie/consent banners and popups across all three sites
const DISMISS_SELECTORS = [
  // Generic consent buttons
  'button:has-text("Accept All")',
  'button:has-text("Accept Cookies")',
  'button:has-text("Accept")',
  'button:has-text("Agree")',
  'button:has-text("Got it")',
  'button:has-text("I Accept")',
  // Redfin
  '[data-rf-test-id="cookie-consent-accept"]',
  'button[aria-label="Close"]',
  // Zillow
  '[data-testid="close-button"]',
  '[aria-label="Close"]',
  // Realtor.com
  '[data-testid="cookie-policy-dialog-accept"]',
  '.onetrust-accept-btn-handler',
]

// Elements to hide before screenshotting — sticky headers, chat widgets, banners
const HIDE_SELECTORS = [
  // Sticky navs (we add our own)
  'header',
  'nav',
  '[data-rf-test-id="top-nav"]',                  // Redfin top nav
  '.site-header',
  // Chat / support widgets
  '#intercom-container',
  '.intercom-lightweight-app',
  '[id^="hubspot"]',
  // Sign-in / save prompts
  '[data-rf-test-id="SignInModal"]',
  '.Modal__content',
  // Zillow auth wall
  '[data-testid="auth-modal"]',
  // Floating overlays
  '.FullscreenModal',
  '[class*="BannerWrapper"]',
  '[class*="StickyFooter"]',
  '[class*="toast"]',
  '[class*="Toast"]',
]

async function captureListing(page: any, url: string, outputPath: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })

  // Give JS time to mount consent banners
  await page.waitForTimeout(2000)

  // Dismiss any popups / consent dialogs
  for (const sel of DISMISS_SELECTORS) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click()
        await page.waitForTimeout(400)
      }
    } catch {
      // selector not found — continue
    }
  }

  // Press Escape to close any remaining modal
  await page.keyboard.press("Escape")
  await page.waitForTimeout(500)

  // Wait for images to load
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})

  // Hide noisy elements via JS
  await page.evaluate((selectors: string[]) => {
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.setProperty("display", "none", "important")
      })
    })
    // Also remove position:fixed elements (sticky headers, chat bubbles)
    document.querySelectorAll("*").forEach(el => {
      const style = window.getComputedStyle(el)
      if (style.position === "fixed" || style.position === "sticky") {
        (el as HTMLElement).style.setProperty("display", "none", "important")
      }
    })
  }, HIDE_SELECTORS)

  // Scroll slightly to trigger lazy-load images
  await page.evaluate(() => window.scrollBy(0, 200))
  await page.waitForTimeout(800)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  // Screenshot the full viewport (1440x900 @ 2x device scale = 2880x1800px)
  await page.screenshot({
    path: outputPath,
    fullPage: false,
    type: "png",
  })

  console.log(`✓ Saved: ${outputPath}`)
}

test("capture Redfin listing", async ({ page }) => {
  await captureListing(page, LISTINGS.redfin, path.join(OUT_DIR, "listing-redfin.png"))
})

test("capture Zillow listing", async ({ page }) => {
  await captureListing(page, LISTINGS.zillow, path.join(OUT_DIR, "listing-zillow.png"))
})

test("capture Realtor.com listing", async ({ page }) => {
  await captureListing(page, LISTINGS.realtor, path.join(OUT_DIR, "listing-realtor.png"))
})
