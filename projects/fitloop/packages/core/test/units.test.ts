import { describe, expect, it } from "vitest";
import { formatVital, formatWater, fromDisplayVital, metricLabel, metricUnit, toDisplayVital } from "../src/units.ts";

describe("units", () => {
  it("keeps metric unchanged", () => {
    expect(metricUnit("weight", "metric")).toBe("kg");
    expect(metricLabel("weight", "metric")).toBe("Weight (kg)");
    expect(toDisplayVital("weight", 75, "metric")).toBe(75);
    expect(fromDisplayVital("weight", 75, "metric")).toBe(75);
    expect(formatVital("weight", 75, "metric")).toBe("75 kg");
    expect(formatWater(2.5, "metric")).toBe("2.5 L water");
  });

  it("converts weight, waist and water for imperial", () => {
    expect(metricUnit("weight", "imperial")).toBe("lb");
    expect(metricLabel("weight", "imperial")).toBe("Weight (lb)");
    expect(metricUnit("waist", "imperial")).toBe("in");
    expect(metricLabel("waist", "imperial")).toBe("Waist (in)");
    expect(toDisplayVital("weight", 75, "imperial")).toBe(165.3);
    expect(fromDisplayVital("weight", 165.3, "imperial")).toBe(74.98);
    expect(toDisplayVital("waist", 81.28, "imperial")).toBe(32);
    expect(fromDisplayVital("waist", 32, "imperial")).toBe(81.28);
    expect(formatVital("weight", 75, "imperial")).toBe("165.3 lb");
    expect(formatWater(2.5, "imperial")).toBe("85 fl oz water");
  });

  it("leaves non-length/mass metrics unchanged in imperial", () => {
    expect(metricUnit("sleep_hours", "imperial")).toBe("h");
    expect(toDisplayVital("sleep_hours", 7.5, "imperial")).toBe(7.5);
    expect(fromDisplayVital("resting_hr", 58, "imperial")).toBe(58);
  });
});
