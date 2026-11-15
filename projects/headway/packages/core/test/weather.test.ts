import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  boardWeather, conditionOf, rideTheme, emptyWeatherStore, mergeWeather, parseAlerts, parseHourly, STATIONS, weatherAt, weatherLine, weatherReport, weatherWork,
  WEATHER_BATCH, WEATHER_CELLS, WEATHER_GRID, WEATHER_REFRESH_MS, WEATHER_RETRY_MS, type BoardTrain, type WeatherHour, type WeatherStore,
} from "../src/index.ts";

// A real hourly forecast for San Francisco's cell (MTR/86,105), 2026-11-15 08:00 → 11-17 07:00 Pacific.
const SF_HOURLY = JSON.parse(readFileSync(new URL("./fixtures/nws-hourly-sf.json", import.meta.url), "utf8"));
const NOW = Date.parse("2026-11-15T08:20:00-08:00");
const MIN = 60_000;

function storeWith(cells: string[], at = NOW): WeatherStore {
  const hours = parseHourly(SF_HOURLY, at);
  return mergeWeather(null, at, { cells: Object.fromEntries(cells.map((c) => [c, hours])), alerts: [] });
}

describe("station grid", () => {
  it("maps every station to a forecast cell and its alert zones", () => {
    for (const s of STATIONS) {
      expect(WEATHER_GRID[s.id]?.cell, s.id).toMatch(/^[A-Z]{3}\/\d+,\d+$/);
      expect(WEATHER_GRID[s.id].zones.length, s.id).toBeGreaterThan(0);
    }
    expect(WEATHER_CELLS.length).toBeLessThanOrEqual(STATIONS.length);
  });
});

describe("weatherWork", () => {
  it("fetches in batches until every cell is fresh, then waits two hours", () => {
    let store: WeatherStore | null = null;
    let t = NOW;
    const fetched = new Set<string>();
    for (let minute = 0; minute < 10; minute++, t += MIN) {
      const w = weatherWork(store, t);
      expect(w.cells.length).toBeLessThanOrEqual(WEATHER_BATCH);
      if (minute === 0) expect(w.alerts).toBe(true);
      w.cells.forEach((c) => fetched.add(c));
      store = mergeWeather(store, t, { cells: Object.fromEntries(w.cells.map((c) => [c, parseHourly(SF_HOURLY, t)])), ...(w.alerts ? { alerts: [] } : {}) });
    }
    expect(fetched.size).toBe(WEATHER_CELLS.length);
    expect(weatherWork(store, t).cells).toEqual([]);
    expect(weatherWork(store, NOW + WEATHER_REFRESH_MS).cells.length).toBe(WEATHER_BATCH);
  });

  it("backs off a cell that failed and keeps its last forecast", () => {
    const cell = WEATHER_CELLS[0];
    const old = storeWith([cell], NOW - WEATHER_REFRESH_MS);
    const failed = mergeWeather(old, NOW, { cells: { [cell]: null } });
    expect(failed.cells[cell].fetched_at).toBe(NOW - WEATHER_REFRESH_MS);
    expect(weatherWork(failed, NOW + MIN, 99).cells).not.toContain(cell);
    expect(weatherWork(failed, NOW + WEATHER_RETRY_MS, 99).cells).toContain(cell);
  });
});

describe("parsing NWS", () => {
  it("reads the hourly forecast", () => {
    const hours = parseHourly(SF_HOURLY, NOW);
    expect(hours[0]).toMatchObject({ t: Date.parse("2026-11-15T08:00:00-08:00"), temp_f: 59, pop: 8, wind_mph: 12, cond: "cloudy", day: true });
    expect(hours.every((h, i) => i === 0 || h.t > hours[i - 1].t)).toBe(true);
  });

  it("turns NWS's words into conditions, dry when rain is only a slight chance", () => {
    expect(conditionOf("Slight Chance Light Rain", 8)).toBe("cloudy");
    expect(conditionOf("Light Rain Likely", 63)).toBe("rain");
    expect(conditionOf("Showers And Thunderstorms", 60)).toBe("thunder");
    expect(conditionOf("Patchy Fog")).toBe("fog");
    expect(conditionOf("Mostly Sunny")).toBe("mostly_clear");
    expect(conditionOf("Partly Cloudy")).toBe("partly_cloudy");
    expect(conditionOf("Areas Of Smoke")).toBe("smoke");
  });

  it("keeps alerts for the line's zones and drops ocean ones", () => {
    const alerts = parseAlerts({
      features: [
        { properties: { id: "a", event: "High Surf Advisory", severity: "Minor", status: "Actual", geocode: { UGC: ["CAZ006"] } } },
        { properties: { id: "b", event: "Heat Advisory", headline: "Heat Advisory until 8 PM", severity: "Moderate", status: "Actual", ends: "2026-11-15T20:00:00-08:00", geocode: { UGC: ["CAZ513", "CAZ999"] } } },
        { properties: { id: "c", event: "Wind Advisory", severity: "Minor", status: "Actual", geocode: { UGC: ["NVZ001"] } } },
      ],
    });
    expect(alerts.map((a) => a.id)).toEqual(["b"]);
    expect(alerts[0].zones).toEqual(["CAZ513"]);
  });
});

describe("what riders see", () => {
  it("gives every station its weather now, the next hours and when rain starts", () => {
    const r = weatherReport(storeWith(WEATHER_CELLS), NOW);
    expect(r.stations.map((s) => s.id)).toEqual(STATIONS.map((s) => s.id));
    const sf = r.stations[0];
    expect(sf.now).toMatchObject({ temp_f: 59, cond: "cloudy" });
    expect(sf.hours).toHaveLength(12);
    expect(sf.rain_at).toBeGreaterThan(NOW);
    expect(sf.high_f).toBeGreaterThanOrEqual(sf.low_f!);
    expect(r.updated_at).toBe(NOW);
  });

  it("shows nothing for a station without a fresh forecast", () => {
    const store = storeWith([WEATHER_GRID.san_francisco.cell], NOW - 13 * 60 * MIN);
    expect(weatherAt(store, "san_francisco", NOW)).toBeNull();
    expect(weatherAt(emptyWeatherStore(), "mountain_view", NOW)).toBeNull();
  });

  it("puts the destination's weather at the next train's arrival on a board", () => {
    const store = storeWith(WEATHER_CELLS);
    const arr = Date.parse("2026-11-15T09:30:00-08:00");
    const train = (dep: number, status: BoardTrain["status"] = "on_time") => ({ pred_dep: dep, pred_arr: arr, status }) as BoardTrain;
    const w = boardWeather(store, {
      from: { id: "mountain_view", name: "Mountain View", short: "MTN VIEW" },
      to: { id: "san_francisco", name: "San Francisco", short: "SF" },
      trains: [train(NOW + 5 * MIN, "cancelled"), train(NOW + 12 * MIN)],
    }, NOW);
    expect(w?.to_at).toBe(arr);
    expect(w?.to?.t).toBe(Date.parse("2026-11-15T09:00:00-08:00"));
    expect(w?.from?.t).toBe(Date.parse("2026-11-15T08:00:00-08:00"));
    expect(weatherLine(w!.from!)).toBe("59° Cloudy");
    expect(w?.theme).toBe("cloudy");
  });

  it("themes a ride by its more eventful end, day or night", () => {
    const h = (cond: WeatherHour["cond"], day = true) => ({ t: 0, temp_f: 60, pop: 0, wind_mph: 0, cond, text: "", day });
    expect(rideTheme(h("clear"), h("rain"))).toBe("rain");
    expect(rideTheme(h("thunder"), h("snow"))).toBe("storm");
    expect(rideTheme(h("fog"), h("partly_cloudy"))).toBe("fog");
    expect(rideTheme(h("clear", false), null)).toBe("clear_night");
    expect(rideTheme(null, h("partly_cloudy"))).toBe("partly_day");
    expect(rideTheme(h("cloudy"), h("cloudy", false))).toBe("cloudy");
    expect(rideTheme(null, null)).toBeNull();
  });
});
