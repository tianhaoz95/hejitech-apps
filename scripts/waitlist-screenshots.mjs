// Captures YouTube ad images from the live waitlist page.
// Usage: node scripts/waitlist-screenshots.mjs
// Output: reports/screenshots/waitlist_landscape.png  (1200x628)
//         reports/screenshots/waitlist_square.png     (1200x1200)

import pkg from "../tests/node_modules/@playwright/test/index.js";
const { chromium } = pkg;
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../reports/screenshots");
const URL = "https://icecap-preview-list.web.app";

const browser = await chromium.launch();

async function capture(filename, width, height) {
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(URL, { waitUntil: "load", timeout: 60000 });
  // Wait for animations to settle
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, filename), fullPage: false });
  console.log(`✓ ${filename} (${width}x${height})`);
  await page.close();
}

// YouTube ad image specs
await capture("waitlist_landscape.png", 1200, 628);  // 1.91:1
await capture("waitlist_square.png",    1200, 1200); // 1:1

await browser.close();
