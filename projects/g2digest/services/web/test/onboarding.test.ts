import { describe, expect, it } from "vitest";
import { starterBrief } from "@g2digest/core";
import { checkDeliveryStatus } from "../src/worker/store.ts";

describe("checkDeliveryStatus", () => {
  it("marks missed when past delivery time + grace on a scheduled weekday with no edition", () => {
    const b = starterBrief();
    b.delivery = { time: "07:00", timezone: "UTC", days: ["mon", "tue", "wed", "thu", "fri"] };
    // Monday 2026-11-23 at 08:00 UTC (60m past 07:00)
    const now = new Date("2026-11-23T08:00:00Z");
    const status = checkDeliveryStatus(b, "2026-11-20", now);
    expect(status.missed).toBe(true);
    expect(status.expected_date).toBe("2026-11-23");
  });

  it("is not missed when today's edition is already published", () => {
    const b = starterBrief();
    b.delivery = { time: "07:00", timezone: "UTC", days: ["mon", "tue", "wed", "thu", "fri"] };
    const now = new Date("2026-11-23T08:00:00Z");
    expect(checkDeliveryStatus(b, "2026-11-23", now).missed).toBe(false);
  });

  it("is not missed before the grace window or on an unscheduled day", () => {
    const b = starterBrief();
    b.delivery = { time: "07:00", timezone: "UTC", days: ["mon", "tue", "wed", "thu", "fri"] };
    // Monday at 07:15 UTC (within 30m grace)
    expect(checkDeliveryStatus(b, "2026-11-20", new Date("2026-11-23T07:15:00Z")).missed).toBe(false);
    // Sunday 2026-11-22 at 10:00 UTC (not in days)
    expect(checkDeliveryStatus(b, "2026-11-20", new Date("2026-11-22T10:00:00Z")).missed).toBe(false);
  });
});
