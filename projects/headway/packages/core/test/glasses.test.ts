import { describe, expect, it } from "vitest";
import { board, checkSettings, commuteBoard, decodeFeed, defaultSettings, encode, LINE_PX, MAX_LINES, Navigator, onTrainLines, trainRow, textPx, progress, station, STATIONS, type World } from "../src/index.ts";
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
  it("shows the commute with a cursor, header row with type/dep/eta and fits the glasses", () => {
    const nav = new Navigator();
    const lines = nav.lines(world());
    fits(lines);
    expect(lines[0]).toMatch(/^MTN VIEW > SF/);
    expect(lines[0]).toContain("SCHED");
    expect(lines[1]).toContain("TRN");
    expect(lines[1]).toContain("TYPE");
    expect(lines[1]).toContain("DEP");
    expect(lines[1]).toContain("ETA");
    expect(lines[1]).toContain("STAT");
    expect(lines[1]).toContain("IN");
    expect(lines[3].startsWith(">")).toBe(true);
    expect(lines[3]).toContain("LOC");
    expect(lines[3]).toContain("8:16");
    expect(lines[3]).toContain("9:16");
    expect(lines.at(-2)).toBe("Leave in 11m for 113 (walk 10)");
    expect(lines.at(-1)).toBe("tap: flip  hold: menu  2x: exit");
  });
  it("names the estimated trip from the rider's location in the leave hint", () => {
    const mv = station("mountain_view")!;
    const b = commuteBoard(commuter(), now, null, undefined, { origin: { lat: mv.lat + 0.011, lon: mv.lon - 0.011 }, travelMode: "drive" });
    const lines = new Navigator().lines(world({ board: b }));
    fits(lines);
    expect(lines.at(-2)).toMatch(/^Leave (in \d+m|now) for \d+ \(drive ~\d+m\)$|^Hurry: \d+ is \d+m tight \(drive ~\d+m\)$/);
  });
  it("shows go Xm or RUN on rows when walk_minutes is set", () => {
    const nav = new Navigator();
    const lines = nav.lines(world());
    fits(lines);
    expect(lines[2]).toContain("RUN");
    expect(lines[3]).toMatch(/go \d+m/);
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
    expect(lines.at(-2)).toBe("Wait for 511 (EXP): beats 113 by 2m");
  });
  it("shows live delays and the first alert", () => {
    const t = firstTrain(WEEKDAY, "07:55");
    const snap = snapshot(now, { [t.trip_id]: { stops: { [station("mountain_view")!.nb!]: { delay: 240 } } } }, [{ id: "a", header: "Delays near Mountain View", description: "", stations: ["mountain_view"], routes: [] }]);
    const lines = new Navigator().lines(world({ board: commuteBoard(commuter(), now, snap) }));
    fits(lines);
    expect(lines[2]).toContain("+4");
    expect(lines.at(-2)).toBe("! Delays near Mountain View");
  });
  it("swipes move the cursor; tap flips; hold opens the menu whose first item tracks", () => {
    const nav = new Navigator(), w = world();
    nav.input("down", w);
    expect(nav.lines(w)[3].startsWith(">")).toBe(true);
    nav.input("long_press", w);
    expect(nav.screen).toBe("menu");
    const lines = nav.lines(w);
    fits(lines);
    expect(lines[1]).toMatch(/^> Track \d+/);
    expect(lines[1]).toContain("Dep");
    expect(lines[1]).toContain("ETA");
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

describe("on the train", () => {
  const card = (over = {}) => ({
    trip_id: "t1", service_date: "20261027", confidence: "high" as const, train: "513", kind: "EXP" as const, dir: "N" as const,
    from: { id: "mountain_view", name: "Mountain View", short: "MTN VIEW" }, to: { id: "san_francisco", name: "San Francisco", short: "SF" }, to_source: "commute" as const,
    next: { id: "palo_alto", name: "Palo Alto", short: "PALO ALTO", pred: 1_000_000 }, pred_arr: 3_000_000, arr: 3_000_000, delay_min: 4, stops_left: 4, stops: [], alerts: [], tracked: false, live: true, ...over,
  });
  const world = (onTrain: ReturnType<typeof card> | null) => ({ board: null, progress: null, onTrain, hasCommute: true, custom: false, now: 0 });

  it("opens once per ride, and backing out stays out", () => {
    const nav = new Navigator();
    expect(nav.lines(world(card())).join("\n")).toContain("ON 513 EXP");
    expect(nav.screen).toBe("on_train");
    nav.input("double_tap", world(card()));
    expect(nav.screen).toBe("board");
    nav.lines(world(card()));
    expect(nav.screen).toBe("board");
  });

  it("shows the next stop, the arrival, and what a tap does", () => {
    const text = onTrainLines(card(), 0).join("\n");
    expect(text).toContain("Next: PALO ALTO");
    expect(text).toContain("3 stops to go");
    expect(text).toContain("tap: track");
    expect(onTrainLines(card({ tracked: true }), 0).join("\n")).toContain("tap: refresh");
  });

  it("tracks on a tap, refreshes once tracked", () => {
    const nav = new Navigator();
    nav.lines(world(card()));
    expect(nav.input("tap", world(card()))[0]).toMatchObject({ kind: "track_on_train" });
    expect(nav.input("tap", world(card({ tracked: true })))[0]).toEqual({ kind: "refresh" });
  });

  it("goes back to the board when the ride ends", () => {
    const nav = new Navigator();
    nav.lines(world(card()));
    nav.lines(world(null));
    expect(nav.screen).toBe("board");
  });

  it("says a train is past its time", () => {
    const t = { trip_id: "x", train: "101", kind: "LOC", dir: "N", service_date: "20261027", dep: 0, arr: 60_000, pred_dep: 0, pred_arr: 60_000, delay_min: null, status: "scheduled", stops_between: 1, past_due: true } as const;
    expect(trainRow(t, 120_000, false)).toContain("due?");
  });
});
