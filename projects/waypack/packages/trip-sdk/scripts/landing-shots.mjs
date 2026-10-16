// Dev helper: the landing page's phone screenshots (site/img/{today,plan,map,guide}.jpg), taken from
// the Sequoia example as the app shows it (SDK in app mode, mid-trip on Christmas morning).
//   node ../cli/dist/cli.js preview ../../examples/sequoia-winter --port 4199 &
//   node scripts/landing-shots.mjs [http://127.0.0.1:4199/t/local/] [../../site/img]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url = "http://127.0.0.1:4199/t/local/", out = new URL("../../../site/img", import.meta.url).pathname] = process.argv.slice(2);
const NOW = Date.parse("2026-12-25T10:05:00-08:00");
const tmp = mkdtempSync(join(tmpdir(), "landing-shots-"));

const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  colorScheme: "light", timezoneId: "America/Los_Angeles",
});
await ctx.addInitScript(`{const T=${NOW},S=Date.now(),D=Date;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:[T+(D.now()-S)]))}static now(){return T+(D.now()-S)}};
window.__WAYPACK_HOST__={platform:"ios"};window.flutter_inappwebview={callHandler:()=>Promise.resolve(true)};}`);
const p = await ctx.newPage();
// [tab, file, settle ms, element to scroll to just below the pinned bar]
for (const [tab, name, wait, section] of [["today", "today", 2500], ["plan", "plan", 1500], ["map", "map", 9000, "map-block"], ["guide", "guide", 1500, "g-packing"]]) {
  await p.goto(`${url}#${tab}`);
  await p.reload(); // a hash-only goto keeps the previous tab's scroll position
  await p.waitForTimeout(wait);
  if (section) await p.evaluate((id) => window.scrollTo(0, document.getElementById(id).getBoundingClientRect().top + scrollY - document.querySelector("[data-waypack-bar]").offsetHeight - 12), section);
  await p.waitForTimeout(300);
  const png = join(tmp, `${name}.png`);
  await p.screenshot({ path: png });
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-z", "1298", "600", png, "--out", join(out, `${name}.jpg`)], { stdio: "ignore" });
  console.log("wrote", join(out, `${name}.jpg`));
}
await b.close();
