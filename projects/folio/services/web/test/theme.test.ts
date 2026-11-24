import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, getTheme, parseTheme, setTheme, THEME_STORAGE_KEY } from "../src/theme.ts";

describe("theme", () => {
  const origDocument = globalThis.document;
  const origLocalStorage = globalThis.localStorage;

  afterEach(() => {
    globalThis.document = origDocument;
    globalThis.localStorage = origLocalStorage;
  });

  function setupDom() {
    const store = new Map<string, string>();
    const dataset: Record<string, string | undefined> = {};
    const lightMeta = { media: "(prefers-color-scheme: light)" };
    const darkMeta = { media: "(prefers-color-scheme: dark)" };
    const buttons = (["device", "light", "dark"] as const).map((choice) => {
      const attrs = new Map<string, string>();
      return {
        dataset: { themeChoice: choice },
        setAttribute(k: string, v: string) { attrs.set(k, v); },
        getAttribute(k: string) { return attrs.get(k) ?? null; },
      };
    });

    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    } as Storage;

    globalThis.document = {
      documentElement: { dataset },
      querySelector: (sel: string) => {
        if (sel.includes('data-theme-color="light"')) return lightMeta;
        if (sel.includes('data-theme-color="dark"')) return darkMeta;
        return null;
      },
      querySelectorAll: (sel: string) => (sel === "[data-theme-choice]" ? buttons : []),
    } as unknown as Document;

    return { store, dataset, lightMeta, darkMeta, buttons };
  }

  it("parses valid themes and falls back to device", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("device")).toBe("device");
    expect(parseTheme(null)).toBe("device");
    expect(parseTheme("sepia")).toBe("device");
  });

  it("applies light, dark, and device themes to root, theme-color metas, and radios", () => {
    const { store, dataset, lightMeta, darkMeta, buttons } = setupDom();

    expect(getTheme()).toBe("device");

    setTheme("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(dataset.theme).toBe("dark");
    expect(lightMeta.media).toBe("not all");
    expect(darkMeta.media).toBe("all");
    expect(buttons.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);

    setTheme("light");
    expect(store.get(THEME_STORAGE_KEY)).toBe("light");
    expect(dataset.theme).toBe("light");
    expect(lightMeta.media).toBe("all");
    expect(darkMeta.media).toBe("not all");
    expect(buttons.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);

    setTheme("device");
    expect(store.has(THEME_STORAGE_KEY)).toBe(false);
    expect("theme" in dataset).toBe(false);
    expect(lightMeta.media).toBe("(prefers-color-scheme: light)");
    expect(darkMeta.media).toBe("(prefers-color-scheme: dark)");
    expect(buttons.map((b) => b.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
  });

  it("applies cleanly when theme-color meta tags are absent", () => {
    const { dataset } = setupDom();
    globalThis.document.querySelector = () => null;
    applyTheme("dark");
    expect(dataset.theme).toBe("dark");
  });
});
