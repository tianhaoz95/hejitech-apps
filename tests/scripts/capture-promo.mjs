/**
 * Semi-automated listing screenshot capture using your real Chrome profile.
 * Your existing cookies + browser fingerprint bypass most bot-detection.
 *
 * Usage:
 *   1. Close Chrome completely before running.
 *   2. pnpm --filter @icecap/tests run capture:promo
 *
 * For each site the browser opens. Solve any remaining checks manually,
 * scroll so the hero photo is at the top, then press Enter to capture.
 *
 * Output:
 *   apps/promo/public/listing-redfin.png
 *   apps/promo/public/listing-zillow.png
 *   apps/promo/public/listing-realtor.png
 */

import { chromium } from "@playwright/test"
import path from "path"
import fs from "fs"
import readline from "readline"
import os from "os"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Configure your listings here ────────────────────────────────────────────
const LISTINGS = [
  {
    site: "Redfin",
    url: "https://www.redfin.com/CA/San-Jose/1287-Hazlett-Ct-95131/home/1166081",
    output: "listing-redfin.png",
  },
  {
    site: "Zillow",
    url: "https://www.zillow.com/homedetails/2015-Autumntree-Ct-San-Jose-CA-95131/19562816_zpid/",
    output: "listing-zillow.png",
  },
  {
    site: "Realtor.com",
    url: "https://www.realtor.com/realestateandhomes-detail/1022-Banyan-Ct_San-Jose_CA_95131_M22771-41153?from=srp_next",
    output: "listing-realtor.png",
  },
]
// ─────────────────────────────────────────────────────────────────────────────

const CHROME_PROFILE = path.join(os.homedir(), "Library/Application Support/Google/Chrome")
const OUT_DIR = path.resolve(__dirname, "../../apps/promo/public")

const HIDE_SELECTORS = [
  "header", "nav",
  '[data-rf-test-id="top-nav"]',
  '[data-rf-test-id="SignInModal"]',
  ".site-header",
  "#intercom-container",
  ".intercom-lightweight-app",
  '[id^="hubspot"]',
  '[data-testid="auth-modal"]',
  ".FullscreenModal",
  '[class*="BannerWrapper"]',
  '[class*="StickyFooter"]',
  '[class*="toast"]',
  '[class*="Toast"]',
]

function waitForEnter(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, () => { rl.close(); resolve() })
  })
}

async function main() {
  if (!fs.existsSync(CHROME_PROFILE)) {
    console.error(`\n✗ Chrome profile not found at:\n  ${CHROME_PROFILE}`)
    console.error("  Install Google Chrome or update CHROME_PROFILE in this script.\n")
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log("\n  ⚠️  Make sure Chrome is fully closed before continuing.")
  await waitForEnter("  Press Enter when Chrome is closed to start → ")

  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    args: ["--start-maximized"],
  })

  const page = await context.newPage()

  for (const { site, url, output } of LISTINGS) {
    const outputPath = path.join(OUT_DIR, output)

    console.log(`\n──────────────────────────────────────────`)
    console.log(`  Opening ${site}...`)
    console.log(`──────────────────────────────────────────`)

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })

    console.log(`  Browser is open. Solve any CAPTCHA or bot-check if needed.`)
    console.log(`  Scroll to the top so the hero photo is visible.`)
    await waitForEnter(`  Press Enter when ready to capture ${site} → `)

    // Hide noisy fixed/sticky UI chrome
    await page.evaluate((selectors) => {
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty("display", "none", "important")
        })
      })
      document.querySelectorAll("*").forEach(el => {
        const style = window.getComputedStyle(el)
        if (style.position === "fixed" || style.position === "sticky") {
          el.style.setProperty("display", "none", "important")
        }
      })
    }, HIDE_SELECTORS)

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)

    await page.screenshot({ path: outputPath, fullPage: false, type: "png" })
    console.log(`  ✓ Saved: ${outputPath}`)
  }

  await context.close()
  console.log("\n✓ All screenshots captured. Rebuild the promo app to pick them up:\n")
  console.log("  pnpm --filter @icecap/promo run build\n")
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
