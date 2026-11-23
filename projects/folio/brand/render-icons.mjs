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

// The link-preview card (1200×630) for the site and for artifacts that aren't shared by link.
{
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<style>html,body{margin:0}body{width:1200px;height:630px;background:#f2ede4;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#1e2a78;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box}svg{width:300px;height:300px;flex:none;border-radius:66px}h1{font-size:92px;margin:0 0 18px;letter-spacing:-2px}p{font-size:38px;line-height:1.3;margin:0;color:#3a3f5c;max-width:620px}</style>${svg("icon.svg")}<div><h1>Folio</h1><p>Artifacts every AI agent can share: one page, its whole history, and who changed what.</p></div>`);
  await p.screenshot({ path: "services/web/public/og.png" });
  await p.close();
  console.log("wrote services/web/public/og.png");
}
await b.close();
