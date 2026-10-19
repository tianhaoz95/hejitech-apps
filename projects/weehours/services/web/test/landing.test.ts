// The static pages: every image keeps its own shape (a width/height that disagrees with the file,
// or a stylesheet that lets the height attribute win, stretched the phone screenshots).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;

function pages(dir = root): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (["node_modules", "dist", "src", "test", "public"].includes(name)) return [];
    if (statSync(p).isDirectory()) return pages(p);
    return name.endsWith(".html") ? [p] : [];
  });
}

/** A PNG's pixel size from its IHDR chunk. */
function pngSize(path: string) {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe("landing and static pages", () => {
  const html = pages();

  it("finds the pages", () => {
    expect(html.map((p) => p.slice(root.length))).toContain("index.html");
  });

  it("gives every local PNG the width and height of the file", () => {
    let checked = 0;
    for (const page of html) {
      for (const tag of readFileSync(page, "utf8").match(/<img\b[^>]*>/g) ?? []) {
        const src = tag.match(/src="\/([^"]+\.png)"/)?.[1];
        const w = tag.match(/width="(\d+)"/)?.[1];
        const h = tag.match(/height="(\d+)"/)?.[1];
        if (!src || !w || !h) continue;
        const file = pngSize(join(root, "public", src));
        expect(Math.abs(+h / +w - file.height / file.width), `${src} in ${page.slice(root.length)}`).toBeLessThan(0.01);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2);   // the two phone screenshots at least
  });

  it("lets images scale without stretching", () => {
    const css = readFileSync(join(root, "src", "style.css"), "utf8");
    const rule = css.match(/^img\s*\{([^}]*)\}/m)?.[1] ?? "";
    expect(rule).toMatch(/max-width:\s*100%/);
    expect(rule).toMatch(/height:\s*auto/);
  });
});
