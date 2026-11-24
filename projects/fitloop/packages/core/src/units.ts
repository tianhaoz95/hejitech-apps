import { METRICS, type Metric, type Settings } from "./types.ts";

export type Units = Settings["units"];

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const FLOZ_PER_L = 33.8140227;

/** Display unit string for a vital metric in the user's chosen unit system. */
export function metricUnit(metric: Metric, units: Units): string {
  if (units === "imperial") {
    if (metric === "weight") return "lb";
    if (metric === "waist") return "in";
  }
  return METRICS[metric]?.unit ?? "";
}

/** Display label with unit (e.g. "Weight (lb)" or "Weight (kg)"). */
export function metricLabel(metric: Metric, units: Units): string {
  const label = METRICS[metric]?.label ?? metric;
  const unit = metricUnit(metric, units);
  return unit ? `${label} (${unit})` : label;
}

/** Convert a canonical metric vital value (stored in kg / cm) to the user's display units. */
export function toDisplayVital(metric: Metric, value: number, units: Units): number {
  if (units !== "imperial") return value;
  if (metric === "weight") return round1(value * LB_PER_KG);
  if (metric === "waist") return round1(value / CM_PER_IN);
  return value;
}

/** Convert a user-entered value in their display units back to canonical metric storage (kg / cm). */
export function fromDisplayVital(metric: Metric, value: number, units: Units): number {
  if (units !== "imperial") return value;
  if (metric === "weight") return round2(value / LB_PER_KG);
  if (metric === "waist") return round2(value * CM_PER_IN);
  return value;
}

/** Format a canonical metric vital value with its display unit. */
export function formatVital(metric: Metric, value: number, units: Units): string {
  const v = toDisplayVital(metric, value, units);
  const unit = metricUnit(metric, units);
  const text = Number.isInteger(v) ? String(v) : String(round1(v));
  return unit ? `${text} ${unit}` : text;
}

/** Format a daily water target (stored in liters) in L or fl oz. */
export function formatWater(liters: number, units: Units): string {
  if (units === "imperial") return `${Math.round(liters * FLOZ_PER_L)} fl oz water`;
  return `${round1(liters)} L water`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
