#!/usr/bin/env node
// Drives the Folio web app in headless Chromium against a local stack: signs in with the seed
// developer, opens an artifact, checks that the sandboxed preview renders with its CSS and JS,
// that the page can't reach Folio's storage, and saves screenshots.
//   node projects/folio/scripts/browser-check.mjs <slug> [outDir] [site]
import { chromium } from "playwright";

const [slug, out = ".", site = "http://127.0.0.1:8801"] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: process.env.SCHEME ?? "light" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${site}/login/?next=/app/`);
await page.fill('input[type="password"]', "folio-dev");
await page.click('form button[type="submit"]');
await page.waitForURL("**/app/");
await page.waitForSelector(".card");
await page.screenshot({ path: `${out}/dashboard.png` });
await page.goto(`${site}/a/${slug}`);
await page.waitForSelector("iframe.ws-frame");
const frame = page.frameLocator("iframe.ws-frame");
await frame.locator("h1").waitFor();
await page.waitForTimeout(800);
const f = page.frames().find((x) => x.url().includes("/r/"));
const probe = await f.evaluate(() => ({
  h1Color: getComputedStyle(document.querySelector("h1")).color,
  items: document.querySelectorAll("#items li").length,
  origin: self.origin,
  storage: (() => { try { return localStorage.length; } catch (e) { return "blocked: " + e.name; } })(),
}));
console.log(JSON.stringify(probe));
await page.screenshot({ path: `${out}/artifact.png` });

// Comment on a selection: select the heading in the preview, comment from the bar, then jump back
// to it from the comment's quote.
await f.evaluate(() => {
  const r = document.createRange();
  r.selectNodeContents(document.querySelector("h1"));
  getSelection().removeAllRanges();
  getSelection().addRange(r);
});
await page.waitForSelector(".ws-selbar:not([hidden]) button");
await page.screenshot({ path: `${out}/selection-bar.png` });
const heading = (await f.evaluate(() => document.querySelector("h1").textContent)).trim();
await page.click(".ws-selbar button");
await page.waitForSelector(".composer.anchored textarea");
await page.fill(".composer.anchored textarea", "Make this heading friendlier");
await page.screenshot({ path: `${out}/selection-composer.png` });
await page.click('.composer.anchored button[type="submit"]');
const quote = page.locator(".quote-link", { hasText: heading }).last();
await quote.waitFor();
await f.evaluate(() => getSelection().removeAllRanges());
await quote.click();
await page.waitForTimeout(800);
const reselected = await f.evaluate(() => getSelection().toString().trim());
const barAfterJump = await page.locator(".ws-selbar:not([hidden])").count();
console.log("selection comment:", JSON.stringify({ heading, reselected, ok: reselected === heading, barAfterJump }));
await page.screenshot({ path: `${out}/selection-comment.png` });
for (const tab of ["Suggestions", "History", "Files", "Comments"]) {
  await page.click(`.tab:has-text("${tab}")`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/tab-${tab.toLowerCase()}.png` });
}
await page.click('.tab:has-text("Suggestions")');
await page.click(".item.clickable");
await page.waitForSelector(".diff");
await page.click('button:has-text("Preview")');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/suggestion.png` });
await page.click('.tab:has-text("History")');
await page.waitForTimeout(500);
await page.locator(".item.clickable").nth(1).click();
await page.waitForSelector(".diff, .diff-note, p.muted");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/history-version.png` });
await page.click('button:has-text("Share")');
await page.waitForSelector("dialog h2");
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/share.png` });
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${site}/a/${slug}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/artifact-phone.png` });
console.log("phone frame box", JSON.stringify(await page.locator("iframe.ws-frame").boundingBox({ timeout: 3000 }).catch(() => null)), errors);
await page.screenshot({ path: `${out}/artifact-phone.png` });
await page.goto(`${site}/`);
await page.screenshot({ path: `${out}/home-phone.png`, fullPage: true });
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${site}/`);
await page.screenshot({ path: `${out}/home.png`, fullPage: true });
console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
await browser.close();
