// The MCP Worker's pure parts (the tools against a database are covered by scripts/test-mcp.mjs).
import { describe, expect, it } from "vitest";
import { caregivers, fieldDocs, TOOLS, toInstant, uuidFrom } from "../src/worker/mcp.ts";

describe("import_events helpers", () => {
  it("reads times with an offset as they are", () => {
    expect(toInstant("2026-01-05T14:30:00+02:00")).toBe("2026-01-05T12:30:00.000Z");
    expect(toInstant("2026-01-05T14:30:00Z")).toBe("2026-01-05T14:30:00.000Z");
  });

  it("reads local times in the export's zone, across daylight saving", () => {
    expect(toInstant("2026-01-05 14:30", "America/Los_Angeles")).toBe("2026-01-05T22:30:00.000Z");
    expect(toInstant("2026-07-05T14:30:00", "America/Los_Angeles")).toBe("2026-07-05T21:30:00.000Z");
    expect(toInstant("2026-03-08 03:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
    expect(toInstant("2026-11-01 00:30", "America/New_York")).toBe("2026-11-01T04:30:00.000Z");
    expect(toInstant("2026-01-05 09:00", "Asia/Kolkata")).toBe("2026-01-05T03:30:00.000Z");
  });

  it("refuses a local time without a zone, and nonsense", () => {
    expect(() => toInstant("2026-01-05 10:00")).toThrow(/no offset: pass timezone/);
    expect(() => toInstant("yesterday at noon", "UTC")).toThrow(/can't read time/);
  });

  it("gives the same row the same id, and different rows different ones", async () => {
    const a = await uuidFrom("household|Huckleberry|row-1|child");
    expect(a).toBe(await uuidFrom("household|Huckleberry|row-1|child"));
    expect(a).not.toBe(await uuidFrom("household|Huckleberry|row-2|child"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("list_event_types field docs", () => {
  it("documents the spec-described fields of the tap-logged types", () => {
    expect(fieldDocs("medication")).toEqual({ medicine: "text (required)", dose: "text" });
    expect(fieldDocs("temperature")).toEqual({ temp_c: "number, degrees Celsius (required)" });
    expect(fieldDocs("potty").result).toBe("pee | poop | both | tried (required)");
    expect(fieldDocs("diaper")).toEqual({
      kind: "wet | dirty | both | dry (required)",
      stool_color: "yellow | brown | green | black | red | white (optional, dirty diapers)",
    });
  });
});

describe("caregivers", () => {
  it("adds the role a caregiver gave themselves", () => {
    const members = [{ user_id: "a", display_name: "Sam" }, { user_id: "b", display_name: "Rita" }];
    expect(caregivers(members, { caregivers: [{ id: "a", role: "Dad" }, { id: "b", role: " " }] })).toEqual(["Sam (Dad)", "Rita"]);
    expect(caregivers(members, {})).toEqual(["Sam", "Rita"]);
  });
});

describe("tools", () => {
  // what the Claude and ChatGPT directories require of every tool
  it("each has a title and says whether it only reads or can destroy", () => {
    for (const t of TOOLS) {
      expect(t.title, t.name).toBeTruthy();
      expect(t.annotations?.title, t.name).toBe(t.title);
      const a = t.annotations as { readOnlyHint?: boolean; destructiveHint?: boolean };
      expect(a.readOnlyHint === true || typeof a.destructiveHint === "boolean", t.name).toBe(true);
    }
  });
});
