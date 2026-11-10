import { describe, expect, it } from "vitest";
import {
  checkEmail, checkFamilyUpdate, checkStatus, commuteDisruption, defaultDisplayName, effectiveFollow, familyNotifications, liveFollowTrains, memberFromRow,
  memberView, myShares, pruneFollows, station, trainName, withoutMember, type FamilyMember, type RealtimeSnapshot, type SharerData, type Tracked,
} from "../src/index.ts";
import { at, commuter, firstTrain, SATURDAY, snapshot, WEEKDAY } from "./helpers.ts";

const MIN = 60_000;
const mv = station("mountain_view")!;
const t = firstTrain(WEEKDAY, "08:00");
const ride: Tracked = { trip_id: t.trip_id, service_date: t.service_date, from: "mountain_view", to: "san_francisco" };
const late = (min: number, now: number) => snapshot(now, { [t.trip_id]: { stops: { [mv.nb!]: { delay: min * 60 } } } });

function member(id: string, over: Partial<FamilyMember> = {}): FamilyMember {
  return { user_id: id, role: "member", display_name: id[0].toUpperCase() + id.slice(1), shares: {}, follows: {}, status: null, ...over };
}
const sam = (over: Partial<FamilyMember> = {}) => member("sam", over);
const alex = (over: Partial<FamilyMember> = {}) => member("alex", { role: "owner", ...over });
const riding = (tracked: Tracked | null = ride): SharerData => ({ tracked, ride: null, settings: commuter() });

describe("nothing is shared until the sharer says so", () => {
  it("shows a member by name only", () => {
    const now = t.dep + 5 * MIN;
    const v = memberView(alex(), sam(), riding(), now, null);
    expect(v).toMatchObject({ display_name: "Sam", shared_with_me: [], train: null, commute: null, status: null });
  });

  it("shows the train to the members picked, not the others", () => {
    const now = t.dep + 5 * MIN;
    const s = sam({ shares: { trip: ["alex"] } });
    expect(memberView(alex(), s, riding(), now, null).train).toMatchObject({ source: "trip", trip_id: t.trip_id, train: t.train });
    expect(memberView(member("kim"), s, riding(), now, null).train).toBeNull();
  });

  it("a ride counts only when Headway is sure, and only when that's shared", () => {
    const now = t.dep + 5 * MIN;
    const sure: SharerData = { tracked: null, ride: { trip_id: t.trip_id, service_date: t.service_date, confidence: "high" }, settings: commuter() };
    const guess: SharerData = { ...sure, ride: { ...sure.ride!, confidence: "low" } };
    expect(memberView(alex(), sam({ shares: { ride: ["alex"] } }), sure, now, null).train?.source).toBe("ride");
    expect(memberView(alex(), sam({ shares: { ride: ["alex"] } }), guess, now, null).train).toBeNull();
    expect(memberView(alex(), sam({ shares: { trip: ["alex"] } }), sure, now, null).train).toBeNull();
  });

  it("a status shows until it runs out", () => {
    const now = at(WEEKDAY, "08:00");
    const s = sam({ shares: { status: ["alex"] }, status: { code: "running_late", set_at: now, until: now + 30 * MIN } });
    expect(memberView(alex(), s, null, now + 10 * MIN, null).status).toMatchObject({ text: "Running late" });
    expect(memberView(alex(), s, null, now + 31 * MIN, null).status).toBeNull();
  });
});

describe("commute disruptions", () => {
  it("only for the usual train, late or cancelled, and without stations or times", () => {
    const now = t.dep - 20 * MIN;
    expect(commuteDisruption(commuter(), now, late(2, now))).toBeNull();
    const d = commuteDisruption(commuter(), now, late(9, now));
    expect(d).toMatchObject({ leg: "morning", trip_id: t.trip_id, cancelled: false, delay_min: 9 });
    const v = memberView(alex(), sam({ shares: { commute: ["alex"] } }), riding(null), now, late(9, now));
    expect(v.commute).toEqual({ leg: "morning", cancelled: false, delay_min: 9 });
    const c = commuteDisruption(commuter(), now, snapshot(now, { [t.trip_id]: { cancelled: true, stops: {} } }));
    expect(c?.cancelled).toBe(true);
  });

  it("not on their days off, outside the window, or without a usual time", () => {
    const sat = at(SATURDAY, "07:40");
    expect(commuteDisruption(commuter(), sat, late(9, sat))).toBeNull();
    const now = t.dep - 20 * MIN;
    const noUsual = commuter();
    noUsual.morning = { ...noUsual.morning!, usual: null };
    expect(commuteDisruption(noUsual, now, late(9, now))).toBeNull();
  });
});

describe("following", () => {
  it("only counts what's shared with you", () => {
    const viewer = alex({ follows: { sam: { notify: ["trip", "status"], live: true } } });
    expect(effectiveFollow(viewer, sam({ shares: { trip: ["alex"] } }))).toEqual({ notify: ["trip"], live: true });
    expect(effectiveFollow(viewer, sam({ shares: { status: ["alex"] } }))).toEqual({ notify: ["status"], live: false });
    expect(effectiveFollow(viewer, sam())).toEqual({ notify: [], live: false });
  });

  it("taking someone off a share ends their subscription to it", () => {
    const members = [sam({ shares: { trip: [], status: ["alex"] } }), alex({ follows: { sam: { notify: ["trip", "status"], live: true } } })];
    const changed = pruneFollows(members);
    expect(changed).toHaveLength(1);
    expect(changed[0].follows).toEqual({ sam: { notify: ["status"], live: false } });
    expect(pruneFollows([members[0], changed[0]])).toHaveLength(0);
  });

  it("the sharer sees who sees each share and who asked to be told", () => {
    const me = sam({ shares: { trip: ["alex", "kim"] } });
    const members = [me, alex({ follows: { sam: { notify: ["trip"], live: true } } }), member("kim")];
    const trip = myShares(me, members).find((s) => s.kind === "trip")!;
    expect(trip).toEqual({ kind: "trip", on: true, viewers: ["alex", "kim"], notified: ["alex"], live: ["alex"] });
    expect(myShares(me, members).find((s) => s.kind === "status")).toMatchObject({ on: false, viewers: [] });
  });

  it("someone leaving disappears from every share and follow", () => {
    const members = [sam({ shares: { trip: ["alex", "kim"] }, follows: { alex: { notify: ["status"], live: false } } }), alex(), member("kim")];
    const changed = withoutMember(members, "alex");
    expect(changed).toEqual([{ ...members[0], shares: { trip: ["kim"] }, follows: {} }]);
  });

  it("the Lock Screen follows a train only with live on", () => {
    const now = t.dep + 5 * MIN;
    const s = sam({ shares: { trip: ["alex"] } });
    const data = { sam: riding() };
    expect(liveFollowTrains(alex({ follows: { sam: { notify: [], live: true } } }), [s], data, now, null)[0].train.trip_id).toBe(t.trip_id);
    expect(liveFollowTrains(alex({ follows: { sam: { notify: ["trip"], live: false } } }), [s], data, now, null)).toHaveLength(0);
  });
});

describe("family notifications", () => {
  const shared = sam({ shares: { trip: ["alex"], commute: ["alex"], status: ["alex"] } });
  const run = (viewer: FamilyMember, now: number, data: SharerData = riding(), snap: RealtimeSnapshot | null = late(0, now), sent = new Set<string>(), s = shared) =>
    familyNotifications({ now, viewer, members: [s, viewer], data: { sam: data }, snapshot: snap, sent });

  it("sends nothing until the viewer subscribes", () => {
    expect(run(alex(), t.dep + 5 * MIN).notifications).toHaveLength(0);
  });

  it("on a train, then later, then arrived: once each", () => {
    const viewer = alex({ follows: { sam: { notify: ["trip"], live: false } } });
    const now = t.dep + 5 * MIN;
    const on = run(viewer, now).notifications;
    expect(on).toHaveLength(1);
    expect(on[0]).toMatchObject({ kind: "family", title: `Sam is on ${trainName(t)}`, thread: "family:sam" });
    const sent = new Set(on.map((n) => n.key));
    expect(run(viewer, now, riding(), late(0, now), sent).notifications).toHaveLength(0);
    const lateN = run(viewer, now, riding(), late(8, now), sent).notifications;
    expect(lateN).toHaveLength(1);
    expect(lateN[0].title).toBe("Sam's train is 8 min late");
    const after = t.arr + 2 * MIN;
    const arr = run(viewer, after, riding(), null, sent).notifications;
    expect(arr.map((n) => n.title)).toEqual(["Sam arrived at San Francisco"]);
  });

  it("boarding a late train says so once, not twice", () => {
    const viewer = alex({ follows: { sam: { notify: ["trip"], live: false } } });
    const now = t.dep + 5 * MIN;
    const r = run(viewer, now, riding(), late(8, now));
    expect(r.notifications).toHaveLength(1);
    expect(r.notifications[0].body).toContain("8 min late");
    expect(r.folded).toHaveLength(1);
    const again = run(viewer, now, riding(), late(9, now), new Set([...r.notifications.map((n) => n.key), ...r.folded]));
    expect(again.notifications).toHaveLength(0);
  });

  it("the usual train and a status", () => {
    const viewer = alex({ follows: { sam: { notify: ["commute", "status"], live: false } } });
    const now = t.dep - 20 * MIN;
    const s = sam({ ...shared, status: { code: "missed_train", set_at: now - MIN, until: now + 29 * MIN } });
    const titles = run(viewer, now, riding(null), late(12, now), new Set(), s).notifications.map((n) => n.title);
    expect(titles).toEqual(["Sam's usual morning train is 12 min late", "Sam: Missed my train, taking the next"]);
  });

  it("stops the moment the share is turned off", () => {
    const viewer = alex({ follows: { sam: { notify: ["trip"], live: false } } });
    expect(run(viewer, t.dep + 5 * MIN, riding(), null, new Set(), sam({ shares: { trip: [] } })).notifications).toHaveLength(0);
  });
});

describe("checks", () => {
  it("updates name only other members", () => {
    const ok = checkFamilyUpdate({ display_name: " Sam ", shares: { trip: ["alex", "alex"], status: null }, follows: { alex: { notify: ["status"], live: false } } }, "sam", ["sam", "alex"]);
    expect(ok.issues).toEqual([]);
    expect(ok.update).toEqual({ display_name: "Sam", shares: { trip: ["alex"] }, follows: { alex: { notify: ["status"], live: false } } });
    expect(checkFamilyUpdate({ shares: { trip: ["sam"] } }, "sam", ["sam", "alex"]).issues).toHaveLength(1);
    expect(checkFamilyUpdate({ shares: { location: ["alex"] } }, "sam", ["sam", "alex"]).issues).toHaveLength(1);
    expect(checkFamilyUpdate({ follows: { stranger: { notify: [], live: true } } }, "sam", ["sam", "alex"]).issues).toHaveLength(1);
    expect(checkFamilyUpdate({ display_name: "x".repeat(21) }, "sam", ["sam"]).issues).toHaveLength(1);
  });

  it("statuses, emails and names", () => {
    expect(checkStatus("home", undefined, 0)).toEqual({ code: "home", set_at: 0, until: 30 * MIN });
    expect(checkStatus("home", 60, 0)).toMatchObject({ until: 60 * MIN });
    expect(typeof checkStatus("home", 45, 0)).toBe("string");
    expect(typeof checkStatus("partying", 30, 0)).toBe("string");
    expect(checkEmail(" Sam@Example.com ")).toBe("sam@example.com");
    expect(checkEmail("not an email")).toBeNull();
    expect(defaultDisplayName(null, "", "sam.lee@example.com")).toBe("sam.lee");
    expect(defaultDisplayName("Sammy", "Sam Lee")).toBe("Sammy");
  });

  it("reads stored rows defensively", () => {
    const m = memberFromRow({ user_id: "u", role: "member", display_name: "U", shares: { trip: ["a", 3], bogus: ["b"] }, follows: { a: { notify: ["trip", "x"], live: "yes" } }, status: { code: "home", set_at: 0, until: 5 } }, 10);
    expect(m).toMatchObject({ shares: { trip: ["a"] }, follows: { a: { notify: ["trip"], live: false } }, status: null });
  });
});
