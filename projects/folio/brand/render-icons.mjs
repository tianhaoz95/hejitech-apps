// Renders the Folio icon masters (brand/*.svg) into every PNG the apps ship. Run from projects/folio.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const svg = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const xc = "apps/ios/App/Resources/Assets.xcassets";
const jobs = [
  [svg("icon.svg"), 1024, 0, `${xc}/AppIcon.appiconset/AppIcon.png`],
  [svg("icon-dark.svg"), 1024, 0, `${xc}/AppIcon.appiconset/AppIcon-dark.png`],
  [svg("icon-tinted.svg"), 1024, 0, `${xc}/AppIcon.appiconset/AppIcon-tinted.png`],
  [svg("icon.svg"), 300, 0, `${xc}/AppMark.imageset/AppMark.png`],
  [svg("icon.svg"), 512, 0.22, "docs/public/icon.png"],
];
const b = await chromium.launch();
for (const [s, size, radius, out] of jobs) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px;border-radius:${radius * size}px}</style>${s}`);
  await p.screenshot({ path: out, omitBackground: radius > 0 });
  await p.close();
  console.log("wrote", out);
}
await b.close();
