#!/usr/bin/env node
// The development build of the extension in Chromium against the local stack: it loads, the id is the
// sideload one (on the redirect allow-list), the side panel signs in as the seeded test user, sees Pro, scores a listing
// and saves it to the account. Needs `supabase start`, the Worker on :8800 and
// `npm run build:dev -w @icecap/extension` first; Playwright's Chromium (`npx playwright install chromium`).
//
//   node projects/icecap/apps/extension/test/smoke.mjs [--headed] [--shots <dir>]
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const ID = "cljkjphaofjfagcekpbnkonpepdcciba"; // SIDELOAD_ID in manifest.config.ts

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "icecap-ext-")), {
  channel: "chromium",
  headless: !process.argv.includes("--headed"),
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  viewport: { width: 420, height: 900 },
});
try {
  let [worker] = ctx.serviceWorkers();
  worker ??= await ctx.waitForEvent("serviceworker");
  assert.equal(new URL(worker.url()).host, ID, "the manifest key pins the sideload id");
  console.log("ok  loads with id", ID);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${ID}/sidepanel.html`);
  await page.getByText("Sign in as the local test user").click();
  await page.getByText("pro@icecap.test").waitFor({ timeout: 15000 });
  await page.getByText(/^Pro/).first().waitFor();
  console.log("ok  signs in and sees Pro");
  if (shots) await page.screenshot({ path: join(shots, "extension-sidepanel.png") });

  // A listing as the content scripts would report it, through the store the side panel uses.
  await page.evaluate(() => {
    const store = (window).store;
    store.loadFromScrape({ price: 365000, address: "42 Smoke Test Rd, Austin, TX 78702", url: "https://www.redfin.com/smoke", taxes: 7000, hoa: 50, description: "Updated kitchen." });
  });
  await page.getByText("42 Smoke Test Rd").first().waitFor();
  await page.locator('button[title="Save"]').click();
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:55421/rest/v1/properties?select=data", {
      headers: { apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0", "Accept-Profile": "icecap", Authorization: `Bearer ${JSON.parse(Object.values(await chrome.storage.local.get(null)).find((v) => typeof v === "string" && v.includes("access_token"))).access_token}` },
    });
    return (await r.json()).map((x) => x.data.address);
  });
  assert.ok(saved.includes("42 Smoke Test Rd, Austin, TX 78702"), `saved: ${saved}`);
  console.log("ok  saves the deal to the account");
  if (shots) await page.screenshot({ path: join(shots, "extension-saved.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("\nextension smoke test passed");
} finally {
  await ctx.close();
}
