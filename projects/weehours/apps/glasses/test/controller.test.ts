import { describe, expect, it } from "vitest";
import { GlassesController, type World } from "../src/controller.ts";

const world = (over: Partial<World> = {}): World => ({
  statusLine: "Fed 2h ago", openFeed: null, sleeping: false, nextSide: "left", defaultFeed: "bottle",
  me: "me", onDuty: null, night: false, ...over,
});

describe("ring gestures", () => {
  it("press starts the default feed, then finishes it", () => {
    const c = new GlassesController();
    expect(c.handle("click", world(), 0)).toEqual([{ kind: "log", type: "feed.bottle.start", fields: {} }]);
    expect(c.handle("click", world({ openFeed: "bottle" }), 0)).toEqual([{ kind: "log", type: "feed.bottle.finish", fields: {} }]);
    expect(c.handle("click", world({ defaultFeed: "breast", nextSide: "right" }), 0)[0]).toMatchObject({ type: "feed.breast.start", fields: { side: "right" } });
  });

  it("double press picks a diaper kind", () => {
    const c = new GlassesController();
    expect(c.handle("double_click", world(), 0)).toEqual([]);
    expect(c.hud(world(), 0)).toContain("[wet]");
    c.handle("down", world(), 0);
    expect(c.hud(world(), 0)).toContain("[dirty]");
    expect(c.handle("click", world(), 0)).toEqual([{ kind: "log", type: "diaper", fields: { kind: "dirty" } }]);
    expect(c.mode).toBe("status");
  });

  it("double press in the picker cancels", () => {
    const c = new GlassesController();
    c.handle("double_click", world(), 0);
    expect(c.handle("double_click", world(), 0)).toEqual([]);
    expect(c.mode).toBe("status");
  });

  it("hold records, release sends a capture attached to the entry just made", () => {
    const c = new GlassesController();
    c.committed({ id: "finish-1", type: "feed.bottle.finish", at: 1_000 }, "Bottle finished", 1_000);
    expect(c.handle("long_press", world(), 2_000)).toEqual([{ kind: "startRecording" }]);
    expect(c.hud(world(), 2_000)).toContain("Listening");
    expect(c.handle("long_press_release", world(), 5_000)).toEqual([{ kind: "stopRecording", attachTo: "finish-1" }]);
  });

  it("a capture long after the last entry stands alone", () => {
    const c = new GlassesController();
    c.committed({ id: "x", type: "diaper", at: 0 }, "Diaper", 0);
    c.handle("long_press", world(), 10 * 60_000);
    expect(c.handle("long_press_release", world(), 10 * 60_000 + 3_000)).toEqual([{ kind: "stopRecording", attachTo: null }]);
  });

  it("swipe opens the menu: sleep, switch side, duty, undo", () => {
    const c = new GlassesController();
    c.committed({ id: "e1", type: "feed.breast.start", at: 0 }, "Nursing", 0);
    const w = world({ openFeed: "breast", nextSide: "right" });
    c.handle("down", w, 0);
    expect(c.menu(w).map((m) => m.label)).toEqual(["Fell asleep", "Switch to right", "I'm on duty", "Undo last", "Back"]);
    c.handle("down", w, 0);
    expect(c.handle("click", w, 0)).toEqual([{ kind: "log", type: "feed.breast.switch", fields: { side: "right" } }]);
    c.handle("up", w, 0); // opens the menu at the first item
    c.handle("up", w, 0); // wraps to "Back"
    c.handle("up", w, 0); // "Undo last"
    expect(c.handle("click", w, 0)).toEqual([{ kind: "undo", id: "e1" }]);
  });

  it("confirmation shows briefly, then the hint", () => {
    const c = new GlassesController();
    c.committed({ id: "a", type: "diaper", at: 0 }, "Diaper", 0);
    expect(c.hud(world(), 1_000)).toContain("✓ Diaper");
    expect(c.hud(world(), 10_000)).toContain("hold: speak");
  });
});
