import { describe, expect, it } from "vitest";
import { board, checkSettings, commuteBoard, decodeFeed, defaultSettings, encode, LINE_PX, MAX_LINES, Navigator, textPx, progress, station, STATIONS, type World } from "../src/index.ts";
import { at, commuter, firstTrain, snapshot, WEEKDAY } from "./helpers.ts";

const now = at(WEEKDAY, "07:55");
const world = (over: Partial<World> = {}): World => ({ board: commuteBoard(commuter(), now, null), progress: null, hasCommute: true, custom: false, now, ...over });
const fits = (lines: string[]) => {
  expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
  for (const l of lines) {
    expect(textPx(l)).toBeLessThanOrEqual(LINE_PX); // measured glyph widths, inside the frame
    expect(l).toMatch(/^[\x20-\x7e]*$/); // the G2 font: plain ASCII only
  }
};

describe("board screen", () => {
  it("shows the commute with a cursor and fits the glasses", () => {
    const nav = new Navigator();
    const lines = nav.lines(world());
    fits(lines);
    expect(lines[0]).toMatch(/^MTN VIEW > SF/);
    expect(lines[0]).toContain("SCHED");
    expect(lines[2].startsWith(">")).toBe(true);
    expect(lines.at(-2)).toBe("Leave in 11m for 113 (walk 10)");
    expect(lines.at(-1)).toBe("tap: flip  hold: menu  2x: exit");
  });
  it("shows go Xm or RUN on rows when walk_minutes is set", () => {
    const nav = new Navigator();
    const lines = nav.lines(world());
    fits(lines);
    expect(lines[1]).toContain("RUN");
    expect(lines[2]).toMatch(/go \d+m/);
  });
  it("shows timetable note when no commute leg walk is set", () => {
    const nav = new Navigator();
    const customWorld = world({ board: board("mountain_view", "san_francisco", now, null) });
    const lines = nav.lines(customWorld);
    fits(lines);
    expect(lines.at(-2)).toBe("Timetable only, no live data");
  });
  it("shows overtaking tip in footer when a train is overtaken", () => {
    const t113 = firstTrain(WEEKDAY, "08:15");
    const snap = snapshot(now, { [t113.trip_id]: { stops: { [station("mountain_view")!.nb!]: { delay: 480 } } } });
    const lines = new Navigator().lines(world({ board: commuteBoard(commuter(), now, snap) }));
    fits(lines);
    expect(lines.at(-2)).toBe("Wait for 511: beats 113 by 2m");
  });
  it("shows live delays and the first alert", () => {
    const t = firstTrain(WEEKDAY, "07:55");
    const snap = snapshot(now, { [t.trip_id]: { stops: { [station("mountain_view")!.nb!]: { delay: 240 } } } }, [{ id: "a", header: "Delays near Mountain View", description: "", stations: ["mountain_view"], routes: [] }]);
    const lines = new Navigator().lines(world({ board: commuteBoard(commuter(), now, snap) }));
    fits(lines);
    expect(lines[1]).toContain("+4");
    expect(lines.at(-2)).toBe("! Delays near Mountain View");
  });
  it("swipes move the cursor; tap flips; hold opens the menu whose first item tracks", () => {
    const nav = new Navigator(), w = world();
    nav.input("down", w);
    expect(nav.lines(w)[2].startsWith(">")).toBe(true);
    nav.input("long_press", w);
    expect(nav.screen).toBe("menu");
    const lines = nav.lines(w);
    fits(lines);
    expect(lines[1]).toMatch(/^> Track \d+/);
    const [track] = nav.input("tap", w);
    expect(track.kind).toBe("track");
    expect(nav.screen).toBe("track");
    fits(nav.lines(w));
    nav.input("double_tap", w);
    const [flip] = nav.input("tap", w);
    expect(flip).toEqual({ kind: "show_pair", pair: { from: "san_francisco", to: "mountain_view" } });
  });
  it("double tap on the board (the root page) exits; the menu offers it too", () => {
    const nav = new Navigator(), w = world();
    expect(nav.input("double_tap", w)).toEqual([{ kind: "exit" }]);
    nav.input("long_press", w);
    nav.menuIndex = nav.menu(w).findIndex((m) => m.label === "Exit Headway");
    expect(nav.input("tap", w)).toEqual([{ kind: "exit" }]);
  });
  it("every gesture answers, even at the end of the list", () => {
    const nav = new Navigator(), w = world();
    nav.input("up", w);
    expect(nav.lines(w).at(-1)).toBe(">> NEXT TRAIN IS FIRST");
    fits(new Navigator().lines(world({ board: null })));
  });
});

describe("menu and station picker", () => {
  it("picks a custom pair", () => {
    const nav = new Navigator(), w = world();
    nav.input("long_press", w);
    expect(nav.screen).toBe("menu");
    fits(nav.lines(w));
    const items = nav.menu(w).map((m) => m.label);
    nav.menuIndex = items.indexOf("Pick stations");
    nav.input("tap", w);
    expect(nav.screen).toBe("pick");
    nav.pickIndex = STATIONS.findIndex((s) => s.id === "palo_alto");
    nav.input("tap", w);
    fits(nav.lines(w));
    expect(nav.lines(w)[0]).toContain("from PALO ALTO");
    nav.pickIndex = STATIONS.findIndex((s) => s.id === "sj_diridon");
    const [cmd] = nav.input("tap", w);
    expect(cmd).toEqual({ kind: "show_pair", pair: { from: "palo_alto", to: "sj_diridon" } });
    expect(nav.screen).toBe("board");
  });
  it("offers the commute again from a custom pair", () => {
    const w = world({ custom: true, board: board("palo_alto", "sj_diridon", now, null) });
    expect(new Navigator().menu(w).map((m) => m.label)).toContain("My commute");
  });
});

describe("track screen", () => {
  it("counts down and fits", () => {
    const t = firstTrain(WEEKDAY, "08:00");
    const p = progress({ trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" }, t.dep + 60_000, null);
    const nav = new Navigator();
    nav.screen = "track";
    const lines = nav.lines(world({ progress: p, now: t.dep + 60_000 }));
    fits(lines);
    expect(lines[0]).toContain(`${t.train} ${t.kind} to SF`);
    expect(nav.input("long_press", world({ progress: p }))).toEqual([{ kind: "untrack" }]);
  });
});

describe("settings", () => {
  it("accepts defaults and a commute, rejects nonsense", () => {
    expect(checkSettings(defaultSettings())).toEqual([]);
    expect(checkSettings(commuter())).toEqual([]);
    const bad = commuter();
    bad.morning!.to = "mountain_view";
    bad.morning!.window = { start: "10:00", end: "09:00" };
    bad.alerts.delay_threshold = 0;
    expect(checkSettings(bad).map((i) => i.path).sort()).toEqual(["alerts.delay_threshold", "morning.to", "morning.window"]);
    expect(checkSettings({ ...commuter(), morning: { ...commuter().morning!, from: "atlantis" } })[0].path).toBe("morning.from");
  });
});

describe("GTFS-Realtime", () => {
  it("decodes trip updates and alerts", () => {
    const buf = encode({
      1: { 1: "2.0", 3: 1_793_000_000 },
      2: [
        { 1: "e1", 3: { 1: { 1: "152", 3: "20261027" }, 2: [{ 4: "70211", 3: { 1: 300 } }, { 4: "70011", 2: { 2: 1_793_003_000 } }, { 4: "70221", 5: 1 }] } },
        { 1: "e2", 3: { 1: { 1: "154", 4: 3 } } },
        { 1: "e3", 3: { 1: { 1: "156" }, 5: -120 } },
        { 1: "a1", 5: { 1: { 1: 1_792_990_000 }, 5: [{ 5: "70211" }, { 5: "70212" }], 7: 3, 10: { 1: [{ 1: "Delays at Mountain View", 2: "en" }] }, 11: { 1: { 1: "Up to 15 minutes." } } } },
      ],
    });
    const f = decodeFeed(buf);
    expect(f.timestamp).toBe(1_793_000_000);
    expect(f.trips["152"]).toEqual({ start_date: "20261027", stops: { "70211": { delay: 300 }, "70011": { arr: 1_793_003_000 }, "70221": { skipped: true } } });
    expect(f.trips["154"].cancelled).toBe(true);
    expect(f.trips["156"].delay).toBe(-120);
    expect(f.alerts).toEqual([{ id: "a1", header: "Delays at Mountain View", description: "Up to 15 minutes.", start: 1_792_990_000, stations: ["mountain_view"], routes: [], effect: "SIGNIFICANT_DELAYS" }]);
  });
});
