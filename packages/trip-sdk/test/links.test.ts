import { describe, expect, it } from "vitest";
import { chooseApp, explicitApp } from "../src/links.js";

describe("chooseApp", () => {
  it("defaults to Apple Maps on iPhone, iPad and Mac, Google elsewhere", () => {
    expect(chooseApp(undefined, undefined, "ios")).toBe("apple");
    expect(chooseApp(undefined, undefined, "macos")).toBe("apple");
    expect(chooseApp(undefined, undefined, "android")).toBe("google");
    expect(chooseApp("auto", undefined, "web")).toBe("google");
  });
  it("explicit choice, then the app setting, then the manifest", () => {
    expect(chooseApp("google", "apple", "macos", "apple")).toBe("google");
    expect(chooseApp("auto", "apple", "android", "google")).toBe("google");
    expect(chooseApp(undefined, "google", "macos")).toBe("google");
  });
});

describe("explicitApp", () => {
  it("is undefined when nothing asked for an app, so the app can ask the user", () => {
    expect(explicitApp(undefined, undefined)).toBeUndefined();
    expect(explicitApp("auto", "waze")).toBeUndefined();
  });
  it("explicit choice, then the app setting, then the manifest", () => {
    expect(explicitApp("google", "apple", "apple")).toBe("google");
    expect(explicitApp("auto", "apple", "google")).toBe("google");
    expect(explicitApp(undefined, "apple")).toBe("apple");
  });
});
