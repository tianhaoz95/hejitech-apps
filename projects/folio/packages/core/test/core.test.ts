import { describe, expect, it } from "vitest";
import {
  agentLabel,
  applyOps,
  can,
  checkManifest,
  contentTypeFor,
  crc32,
  describeOps,
  diffLines,
  diffText,
  entryFile,
  isTextType,
  newSlug,
  normalizePath,
  OpError,
  parseArtifactRef,
  parseOps,
  pathsToLoad,
  SLUG_RE,
  unifiedDiff,
  zip,
  type Manifest,
} from "../src/index.ts";

const m = (files: Record<string, string>): Manifest =>
  Object.fromEntries(Object.entries(files).map(([p, t]) => [p, { hash: `h-${p}`, size: t.length, type: contentTypeFor(p) }]));

describe("paths", () => {
  it("normalizes", () => {
    expect(normalizePath("./a//b.html")).toBe("a/b.html");
    expect(normalizePath("/index.html")).toBe("index.html");
    expect(normalizePath("a\\b.css")).toBe("a/b.css");
  });
  it("rejects traversal and junk", () => {
    expect(() => normalizePath("../x")).toThrow(/\.\./);
    expect(() => normalizePath(".folio/data.json")).toThrow(/Folio's own folder/);
    expect(() => normalizePath("./.folio/x.js")).toThrow(/Folio's own folder/);
    expect(normalizePath("docs/.folio/x.js")).toBe("docs/.folio/x.js");
    expect(() => normalizePath("a/./b")).toThrow();
    expect(() => normalizePath("")).toThrow(/empty/);
    expect(() => normalizePath("dir/")).toThrow(/folder/);
    expect(() => normalizePath("a\u0000b")).toThrow(/control/);
    expect(() => normalizePath(3)).toThrow();
  });
  it("types", () => {
    expect(contentTypeFor("x.HTML")).toMatch(/text\/html/);
    expect(contentTypeFor("a/b.png")).toBe("image/png");
    expect(contentTypeFor("noext")).toBe("application/octet-stream");
    expect(isTextType(contentTypeFor("data.json"))).toBe(true);
    expect(isTextType(contentTypeFor("logo.svg"))).toBe(true);
    expect(isTextType("image/png")).toBe(false);
  });
  it("entry file", () => {
    expect(entryFile(["b.css", "index.html"])).toBe("index.html");
    expect(entryFile(["pages/x.html", "home.html"])).toBe("home.html");
    expect(entryFile(["notes.md"])).toBe("notes.md");
    expect(entryFile([])).toBeNull();
  });
  it("manifest limits", () => {
    expect(checkManifest({})).toContain("an artifact needs at least one file");
    expect(checkManifest({ a: { hash: "x", size: 1, type: "text/plain" }, "a/b": { hash: "y", size: 1, type: "text/plain" } })[0]).toMatch(/is a file/);
    expect(checkManifest({ "big.txt": { hash: "x", size: 3 * 1024 * 1024, type: "text/plain" } })[0]).toMatch(/at most/);
    expect(checkManifest(m({ "index.html": "<h1>" }))).toEqual([]);
  });
});

describe("ops", () => {
  const base = m({ "index.html": "<h1>Hello</h1>\n<p>one</p>\n<p>one</p>\n", "app.js": "let x = 1;\n", "logo.png": "" });
  base["logo.png"].type = "image/png";
  const texts = { "index.html": "<h1>Hello</h1>\n<p>one</p>\n<p>one</p>\n", "app.js": "let x = 1;\n" };

  it("parses aliases", () => {
    const ops = parseOps([
      { op: "str_replace", path: "app.js", old_string: "1", new_string: "2" },
      { type: "create", file: "new.md", text: "# hi" },
      { op: "move", path: "new.md", new_path: "docs/new.md" },
      { op: "remove", path: "logo.png" },
    ]);
    expect(ops.map((o) => o.op)).toEqual(["replace", "write", "rename", "delete"]);
  });
  it("rejects bad ops with the index", () => {
    expect(() => parseOps([])).toThrow(/empty/);
    expect(() => parseOps([{ op: "replace", path: "a", old: "", new: "x" }])).toThrow(/ops\[0\].*old is empty/);
    expect(() => parseOps([{ op: "write", path: "a.txt" }])).toThrow(/content/);
    expect(() => parseOps([{ op: "zap", path: "a" }])).toThrow(/unknown op/);
    expect(() => parseOps([{ op: "write", path: "../a", content: "x" }])).toThrow(/ops\[0\]/);
  });
  it("applies replace, write, rename, delete", () => {
    const ops = parseOps([
      { op: "replace", path: "index.html", old: "Hello", new: "Hi" },
      { op: "write", path: "data.json", content: '{"a":1}' },
      { op: "rename", path: "app.js", to: "js/app.js" },
      { op: "replace", path: "js/app.js", old: "1", new: "2" },
      { op: "delete", path: "logo.png" },
    ]);
    expect(pathsToLoad(ops, base).sort()).toEqual(["app.js", "index.html"]);
    const { files, changed } = applyOps(base, ops, texts);
    expect(files["index.html"].text).toContain("<h1>Hi</h1>");
    expect(files["index.html"].hash).toBeUndefined();
    expect(files["js/app.js"].text).toBe("let x = 2;\n");
    expect(files["app.js"]).toBeUndefined();
    expect(files["logo.png"]).toBeUndefined();
    expect(files["data.json"].type).toMatch(/json/);
    expect(changed).toEqual(["app.js", "data.json", "index.html", "js/app.js", "logo.png"]);
  });
  it("requires a unique match unless all", () => {
    expect(() => applyOps(base, parseOps([{ op: "replace", path: "index.html", old: "one", new: "two" }]), texts)).toThrow(/matches 2 places/);
    const { files } = applyOps(base, parseOps([{ op: "replace", path: "index.html", old: "one", new: "two", all: true }]), texts);
    expect(files["index.html"].text).not.toContain("one");
  });
  it("explains a miss, including whitespace-only differences", () => {
    expect(() => applyOps(base, parseOps([{ op: "replace", path: "index.html", old: "Goodbye", new: "x" }]), texts)).toThrow(/not found/);
    expect(() => applyOps(base, parseOps([{ op: "replace", path: "index.html", old: "<h1>Hello</h1> <p>one</p>", new: "x" }]), texts)).toThrow(/whitespace/);
    expect(() => applyOps(base, parseOps([{ op: "replace", path: "nope.html", old: "a", new: "b" }]), texts)).toThrow(/no such file/);
  });
  it("$ patterns in new text are literal", () => {
    const { files } = applyOps(base, parseOps([{ op: "replace", path: "app.js", old: "1", new: "$&$1" }]), texts);
    expect(files["app.js"].text).toBe("let x = $&$1;\n");
  });
  it("binary writes", () => {
    const { files } = applyOps(base, parseOps([{ op: "write", path: "img/a.png", base64: "iVBORw0KGgo=" }]), texts);
    expect(files["img/a.png"].bytes?.length).toBe(8);
    expect(() => applyOps(base, parseOps([{ op: "write", path: "a.png", content: "x" }]), texts)).toThrow(/binary/);
    expect(() => applyOps(base, parseOps([{ op: "replace", path: "logo.png", old: "a", new: "b" }]), texts)).toThrow(/binary/);
  });
  it("rename onto an existing file fails", () => {
    expect(() => applyOps(base, parseOps([{ op: "rename", path: "app.js", to: "index.html" }]), texts)).toThrow(OpError);
  });
  it("describes", () => {
    expect(describeOps(parseOps([{ op: "replace", path: "a.html", old: "x", new: "y" }, { op: "replace", path: "a.html", old: "z", new: "y" }]))).toBe("edit a.html");
  });
});

describe("diff", () => {
  it("finds minimal line changes", () => {
    const { lines } = diffLines("a\nb\nc\nd\n", "a\nB\nc\nd\ne\n");
    expect(lines.filter((l) => l.kind !== "same").map((l) => `${l.kind}:${l.text}`)).toEqual(["del:b", "add:B", "add:e"]);
  });
  it("handles empty sides", () => {
    expect(diffLines("", "x\ny").lines.every((l) => l.kind === "add")).toBe(true);
    expect(diffLines("x\ny", "").lines.every((l) => l.kind === "del")).toBe(true);
    expect(diffLines("same", "same").lines.every((l) => l.kind === "same")).toBe(true);
  });
  it("hunks and unified output", () => {
    const a = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n");
    const b = a.replace("line 5", "line five").replace("line 25", "line twenty-five");
    const d = diffText("x.txt", a, b);
    expect(d.hunks).toHaveLength(2);
    expect(d.added).toBe(2);
    expect(d.removed).toBe(2);
    const u = unifiedDiff([d]);
    expect(u).toContain("--- a/x.txt");
    expect(u).toContain("@@ -2,7 +2,7 @@");
    expect(u).toContain("-line 5");
    expect(u).toContain("+line five");
  });
  it("random diffs reconstruct the target", () => {
    for (let t = 0; t < 50; t++) {
      const a = Array.from({ length: 40 }, () => String(Math.floor(Math.random() * 6))).join("\n");
      const b = Array.from({ length: 35 }, () => String(Math.floor(Math.random() * 6))).join("\n");
      const { lines } = diffLines(a, b);
      expect(lines.filter((l) => l.kind !== "add").map((l) => l.text).join("\n")).toBe(a);
      expect(lines.filter((l) => l.kind !== "del").map((l) => l.text).join("\n")).toBe(b);
    }
  });
});

describe("zip", () => {
  it("crc32 matches the reference value", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });
  it("writes a zip with a central directory", () => {
    const z = zip([{ path: "index.html", data: new TextEncoder().encode("<h1>x</h1>") }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(1);
  });
});

describe("model", () => {
  it("roles", () => {
    expect(can("viewer", "suggest")).toBe(true);
    expect(can("viewer", "edit")).toBe(false);
    expect(can("editor", "review")).toBe(true);
    expect(can("editor", "manage")).toBe(false);
    expect(can(null, "read")).toBe(false);
  });
  it("slugs and refs", () => {
    const s = newSlug();
    expect(s).toMatch(SLUG_RE);
    expect(parseArtifactRef(s)).toEqual({ slug: s });
    expect(parseArtifactRef(`https://folio.hejitech.workers.dev/a/${s}`)).toEqual({ slug: s });
    expect(parseArtifactRef(`https://folio.hejitech.workers.dev/a/${s}/v/7`)).toEqual({ slug: s, version: 7 });
    expect(parseArtifactRef("0f8fad5b-d9cb-469f-a165-70867728950e")).toEqual({ id: "0f8fad5b-d9cb-469f-a165-70867728950e" });
    expect(parseArtifactRef("not a ref!")).toBeNull();
  });
  it("agent labels", () => {
    expect(agentLabel({ declared: "  Gemini <b>3</b> ", client: "gemini-cli" })).toBe("Gemini b3/b");
    expect(agentLabel({ client: "claude-code" })).toBe("claude-code");
    expect(agentLabel({ connection: "My token" })).toBe("My token");
    expect(agentLabel({})).toBe("Agent");
  });
});
