/**
 * Semi-automated listing screenshot capture for promo mockups.
 *
 * Usage:
 *   pnpm --filter @icecap/tests run capture:promo
 *
 * The browser opens visibly for each site. When the listing page is fully
 * loaded (scroll past any CAPTCHA or bot-check manually if needed), press
 * Enter in this terminal to capture the screenshot and move to the next site.
 *
 * Output:
 *   apps/promo/public/listing-redfin.png
 *   apps/promo/public/listing-zillow.png
 *   apps/promo/public/listing-realtor.png
 */

import { test } from "@playwright/test"
import path from "path"
import fs from "fs"
import readline from "readline"

// ─── Configure your listings here ────────────────────────────────────────────
const LISTINGS = {
  redfin: "https://www.redfin.com/CA/San-Jose/1287-Hazlett-Ct-95131/home/1166081",
  zillow: "https://www.zillow.com/homedetails/2015-Autumntree-Ct-San-Jose-CA-95131/19562816_zpid/",
  realtor: "https://www.realtor.com/realestateandhomes-detail/1022-Banyan-Ct_San-Jose_CA_95131_M22771-41153?from=srp_next",
}
// ─────────────────────────────────────────────────────────────────────────────

const OUT_DIR = path.resolve(__dirname, "../../apps/promo/public")

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
})

// Elements to hide before screenshotting — sticky navs, banners, chat widgets.
// We overlay our own branded nav on top in the mockup, so hiding the real one
// gives a cleaner result.
const HIDE_SELECTORS = [
  'header', 'nav',
  '[data-rf-test-id="top-nav"]',
  '[data-rf-test-id="SignInModal"]',
  '.site-header',
  '#intercom-container',
  '.intercom-lightweight-app',
  '[id^="hubspot"]',
  '[data-testid="auth-modal"]',
  '.FullscreenModal',
  '[class*="BannerWrapper"]',
  '[class*="StickyFooter"]',
  '[class*="toast"]',
  '[class*="Toast"]',
]

function waitForEnter(prompt: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, () => { rl.close(); resolve() })
  })
}

async function captureListing(page: any, site: string, url: string, outputPath: string) {
  console.log(`\n──────────────────────────────────────────`)
  console.log(`  Opening ${site}...`)
  console.log(`──────────────────────────────────────────`)

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })

  console.log(`  Browser is open. If you see a CAPTCHA or bot-check, solve it now.`)
  console.log(`  Scroll to the top of the listing so the hero photo is visible.`)
  await waitForEnter(`  Press Enter when the page looks good to capture → `)

  // Hide noisy fixed/sticky elements
  await page.evaluate((selectors: string[]) => {
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.setProperty("display", "none", "important")
      })
    })
    document.querySelectorAll("*").forEach(el => {
      const style = window.getComputedStyle(el)
      if (style.position === "fixed" || style.position === "sticky") {
        (el as HTMLElement).style.setProperty("display", "none", "important")
      }
    })
  }, HIDE_SELECTORS)

  // Scroll back to top after hiding elements
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)

  await page.screenshot({ path: outputPath, fullPage: false, type: "png" })
  console.log(`  ✓ Saved: ${outputPath}`)
}

test("capture Redfin listing", async ({ page }) => {
  await captureListing(page, "Redfin", LISTINGS.redfin, path.join(OUT_DIR, "listing-redfin.png"))
})

test("capture Zillow listing", async ({ page }) => {
  await captureListing(page, "Zillow", LISTINGS.zillow, path.join(OUT_DIR, "listing-zillow.png"))
})

test("capture Realtor.com listing", async ({ page }) => {
  await captureListing(page, "Realtor.com", LISTINGS.realtor, path.join(OUT_DIR, "listing-realtor.png"))
})
