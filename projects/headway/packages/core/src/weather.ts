// Weather at Caltrain's stations from the National Weather Service (api.weather.gov: free, public
// domain, US only, which is all of Caltrain). Pure: the Worker fetches and stores (worker/weather.ts),
// this decides what to fetch when, reads NWS's JSON, and builds what riders see (every station's
// weather, the weather on a board: where you leave from now and where you get off when you arrive).
//
// Stations share NWS forecast cells (2.5 km grid; 31 stations, 29 cells), mapped once by
// scripts/build-weather-grid.mjs into weathergrid.gen.json. Each cell's hourly forecast is refreshed
// every WEATHER_REFRESH_MS, at most WEATHER_BATCH cells per cron minute, so a refresh spreads over a
// few minutes and a Worker invocation stays far below its subrequest limit.
import grid from "./weathergrid.gen.json" with { type: "json" };
import { STATIONS } from "./schedule.ts";
import type { Board, Station } from "./types.ts";

const MIN = 60_000;
const HOUR = 60 * MIN;
/** Forecasts are refreshed this often (NWS updates its grids a few times a day). */
export const WEATHER_REFRESH_MS = 2 * HOUR;
/** Weather alerts (one request for every station's zones) are refreshed this often. */
export const WEATHER_ALERTS_REFRESH_MS = 30 * MIN;
/** At most this many forecast cells are fetched in one cron minute. */
export const WEATHER_BATCH = 10;
/** After a failed fetch, wait this long before trying that cell again. */
export const WEATHER_RETRY_MS = 10 * MIN;
/** Hours kept per cell: the last hour (it's still "now" for a bit) through a day and a half ahead. */
const KEEP_BEHIND_MS = HOUR;
const KEEP_AHEAD_MS = 36 * HOUR;
/** Forecasts older than this aren't shown at all (better nothing than yesterday's weather). */
export const WEATHER_STALE_MS = 12 * HOUR;
/** "Rain later" looks this far ahead, at this chance or more. */
const RAIN_AHEAD_MS = 12 * HOUR;
const RAIN_POP = 40;

export const WEATHER_GRID = (grid as { stations: Record<string, { cell: string; zones: string[] }> }).stations;
/** Every forecast cell, once. */
export const WEATHER_CELLS: string[] = [...new Set(Object.values(WEATHER_GRID).map((s) => s.cell))];
/** Every alert zone (forecast zones and counties) along the line. */
export const WEATHER_ZONES: string[] = [...new Set(Object.values(WEATHER_GRID).flatMap((s) => s.zones))];
export const WEATHER_SOURCE = "National Weather Service";

export type WeatherCondition =
  | "clear" | "mostly_clear" | "partly_cloudy" | "cloudy" | "fog" | "haze" | "smoke"
  | "drizzle" | "rain" | "showers" | "thunder" | "snow" | "wind";

export interface WeatherHour {
  /** Start of the hour, epoch ms. */
  t: number;
  temp_f: number;
  /** Chance of precipitation, 0–100. */
  pop: number;
  wind_mph: number;
  cond: WeatherCondition;
  /** NWS's own words, e.g. "Patchy Fog". */
  text: string;
  day: boolean;
}

export interface CellForecast {
  fetched_at: number;
  hours: WeatherHour[];
}

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  /** Extreme | Severe | Moderate | Minor | Unknown */
  severity: string;
  /** Epoch ms, or null when NWS gives none. */
  starts: number | null;
  ends: number | null;
  /** UGC zone codes it covers (forecast zones and counties). */
  zones: string[];
}

/** What the Worker keeps (one KV value). */
export interface WeatherStore {
  cells: Record<string, CellForecast>;
  alerts: WeatherAlert[];
  alerts_at: number | null;
  /** Last attempt per cell (and "alerts"), so a failing one waits WEATHER_RETRY_MS. */
  tried: Record<string, number>;
}

export const emptyWeatherStore = (): WeatherStore => ({ cells: {}, alerts: [], alerts_at: null, tried: {} });

/** What this cron minute should fetch: the stalest due cells (a batch) and whether alerts are due. */
export function weatherWork(store: WeatherStore | null, now: number, batch = WEATHER_BATCH): { cells: string[]; alerts: boolean } {
  const s = store ?? emptyWeatherStore();
  const resting = (key: string) => now - (s.tried[key] ?? 0) < WEATHER_RETRY_MS;
  const cells = WEATHER_CELLS
    .filter((c) => now - (s.cells[c]?.fetched_at ?? 0) >= WEATHER_REFRESH_MS && !resting(c))
    .sort((a, b) => (s.cells[a]?.fetched_at ?? 0) - (s.cells[b]?.fetched_at ?? 0))
    .slice(0, batch);
  const alerts = now - (s.alerts_at ?? 0) >= WEATHER_ALERTS_REFRESH_MS && !resting("alerts");
  return { cells, alerts };
}

/** The forecast URL path for a cell like `MTR/86,105`. */
export function cellPath(cell: string): string {
  const [office, xy] = cell.split("/");
  return `/gridpoints/${office}/${xy}/forecast/hourly`;
}

/** NWS's words → one of a few conditions every app draws the same way. */
export function conditionOf(text: string, pop = 0): WeatherCondition {
  const s = text.toLowerCase();
  const wet: [RegExp, WeatherCondition][] = [
    [/thunder|t-storm/, "thunder"],
    [/snow|sleet|flurr|ice|freezing/, "snow"],
    [/drizzle/, "drizzle"],
    [/shower/, "showers"],
    [/rain/, "rain"],
  ];
  for (const [re, c] of wet) {
    // "Slight Chance Light Rain" at 8% is a dry hour for a commuter: fall through to the sky.
    if (re.test(s) && pop >= 20) return c;
  }
  if (/fog/.test(s)) return "fog";
  if (/smoke/.test(s)) return "smoke";
  if (/haze|dust/.test(s)) return "haze";
  if (/partly|scattered/.test(s)) return "partly_cloudy";
  if (/mostly sunny|mostly clear|few clouds/.test(s)) return "mostly_clear";
  if (/cloud|overcast/.test(s)) return "cloudy";
  if (/sunny|clear|fair/.test(s)) return "clear";
  if (/wind|breez|blustery/.test(s)) return "wind";
  return wet.some(([re]) => re.test(s)) ? "cloudy" : "partly_cloudy";
}

interface NwsPeriod {
  startTime: string;
  isDaytime?: boolean;
  temperature: number;
  temperatureUnit?: string;
  probabilityOfPrecipitation?: { value: number | null } | null;
  windSpeed?: string;
  shortForecast?: string;
}

/** An hourly forecast response (`/gridpoints/…/forecast/hourly`) → the hours worth keeping. */
export function parseHourly(json: unknown, now: number): WeatherHour[] {
  const periods = (json as { properties?: { periods?: NwsPeriod[] } })?.properties?.periods;
  if (!Array.isArray(periods)) throw new Error("no forecast periods");
  const hours: WeatherHour[] = [];
  for (const p of periods) {
    const t = Date.parse(p.startTime);
    if (!Number.isFinite(t) || typeof p.temperature !== "number") continue;
    if (t < now - KEEP_BEHIND_MS || t > now + KEEP_AHEAD_MS) continue;
    const temp = p.temperatureUnit === "C" ? p.temperature * 9 / 5 + 32 : p.temperature;
    const pop = Math.max(0, Math.min(100, Math.round(p.probabilityOfPrecipitation?.value ?? 0)));
    const winds = (p.windSpeed ?? "").match(/\d+/g)?.map(Number) ?? [0];
    const text = (p.shortForecast ?? "").trim();
    hours.push({ t, temp_f: Math.round(temp), pop, wind_mph: Math.max(...winds), cond: conditionOf(text, pop), text, day: p.isDaytime !== false });
  }
  if (!hours.length) throw new Error("forecast has no hours around now");
  return hours.sort((a, b) => a.t - b.t);
}

/** Events that don't touch a station platform (ocean, beaches), left out. */
const OFFSHORE = /surf|rip current|beach|small craft|marine|gale|seas|hazardous seas|brisk wind|special marine|tsunami watch/i;

/** Active alerts (`/alerts/active?zone=…`) → those that cover a station's zone and matter on land. */
export function parseAlerts(json: unknown): WeatherAlert[] {
  const features = (json as { features?: { properties?: Record<string, unknown> }[] })?.features;
  if (!Array.isArray(features)) throw new Error("no alert features");
  const ours = new Set(WEATHER_ZONES);
  const out: WeatherAlert[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const event = String(p.event ?? "");
    if (!event || OFFSHORE.test(event)) continue;
    if (p.status && p.status !== "Actual") continue;
    const ugc = ((p.geocode as { UGC?: string[] } | undefined)?.UGC ?? []).filter((z) => ours.has(z));
    if (!ugc.length) continue;
    const time = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
    out.push({
      id: String(p.id ?? f.properties?.["@id"] ?? event),
      event,
      headline: String(p.headline ?? event),
      severity: String(p.severity ?? "Unknown"),
      starts: time(p.onset) ?? time(p.effective),
      ends: time(p.ends) ?? time(p.expires),
      zones: ugc,
    });
  }
  return out;
}

/** Puts a fetch's results into the store (a failed cell keeps its last forecast). */
export function mergeWeather(
  store: WeatherStore | null,
  now: number,
  got: { cells?: Record<string, WeatherHour[] | null>; alerts?: WeatherAlert[] | null },
): WeatherStore {
  const s: WeatherStore = store ? { cells: { ...store.cells }, alerts: store.alerts, alerts_at: store.alerts_at, tried: { ...store.tried } } : emptyWeatherStore();
  for (const [cell, hours] of Object.entries(got.cells ?? {})) {
    s.tried[cell] = now;
    if (hours) s.cells[cell] = { fetched_at: now, hours };
  }
  if (got.alerts !== undefined) {
    s.tried.alerts = now;
    if (got.alerts) {
      s.alerts = got.alerts;
      s.alerts_at = now;
    }
  }
  // Drop cells no station uses any more (a re-gridded office).
  for (const c of Object.keys(s.cells)) if (!WEATHER_CELLS.includes(c)) delete s.cells[c];
  return s;
}

// ---------------------------------------------------------------- what riders see

function cellOf(store: WeatherStore | null, stationId: string, now: number): CellForecast | null {
  const g = WEATHER_GRID[stationId];
  const c = g && store?.cells[g.cell];
  return c && now - c.fetched_at < WEATHER_STALE_MS ? c : null;
}

/** The forecast hour that contains `t` at a station, or null (no forecast that far, or stale). */
export function weatherAt(store: WeatherStore | null, stationId: string, t: number, now = t): WeatherHour | null {
  const c = cellOf(store, stationId, now);
  if (!c) return null;
  return c.hours.find((h) => h.t <= t && t < h.t + HOUR) ?? null;
}

/** Alerts in effect (or starting within a day) at a station. */
export function stationAlerts(store: WeatherStore | null, stationId: string, now: number): WeatherAlert[] {
  const zones = new Set(WEATHER_GRID[stationId]?.zones ?? []);
  return (store?.alerts ?? []).filter((a) => a.zones.some((z) => zones.has(z)) && (a.ends == null || a.ends > now) && (a.starts == null || a.starts < now + 24 * HOUR));
}

export interface StationWeather {
  id: string;
  name: string;
  short: string;
  /** The hour now. Null when there's no fresh forecast for this station. */
  now: WeatherHour | null;
  /** The next 12 hours after this one. */
  hours: WeatherHour[];
  /** Highest and lowest over now + the next 12 hours. */
  high_f: number | null;
  low_f: number | null;
  /** The first hour in the next 12 with a good chance of rain (or snow), when now is dry. */
  rain_at: number | null;
  /** Ids of `WeatherReport.alerts` that cover this station. */
  alert_ids: string[];
  fetched_at: number | null;
}

export interface WeatherReport {
  source: string;
  /** The oldest forecast shown, epoch ms (null: none yet). */
  updated_at: number | null;
  /** North to south, as the line runs. */
  stations: StationWeather[];
  alerts: (WeatherAlert & { stations: string[] })[];
}

const WET: WeatherCondition[] = ["drizzle", "rain", "showers", "thunder", "snow"];
export const isWet = (h: WeatherHour | null | undefined) => Boolean(h && WET.includes(h.cond));

export function stationWeather(store: WeatherStore | null, st: Station, now: number): StationWeather {
  const c = cellOf(store, st.id, now);
  const current = weatherAt(store, st.id, now, now);
  const hours = c ? c.hours.filter((h) => h.t > now && h.t <= now + RAIN_AHEAD_MS).slice(0, 12) : [];
  const span = [current, ...hours].filter((h): h is WeatherHour => Boolean(h));
  const rain = !isWet(current) ? hours.find((h) => isWet(h) && h.pop >= RAIN_POP) : undefined;
  return {
    id: st.id,
    name: st.name,
    short: st.short,
    now: current,
    hours,
    high_f: span.length ? Math.max(...span.map((h) => h.temp_f)) : null,
    low_f: span.length ? Math.min(...span.map((h) => h.temp_f)) : null,
    rain_at: rain?.t ?? null,
    alert_ids: stationAlerts(store, st.id, now).map((a) => a.id),
    fetched_at: c?.fetched_at ?? null,
  };
}

/** Every station's weather (GET /api/weather). */
export function weatherReport(store: WeatherStore | null, now: number, stations: Station[] = STATIONS): WeatherReport {
  const list = stations.map((st) => stationWeather(store, st, now));
  const fetched = list.map((s) => s.fetched_at).filter((t): t is number => t != null);
  const alerts = (store?.alerts ?? [])
    .map((a) => ({ ...a, stations: list.filter((s) => s.alert_ids.includes(a.id)).map((s) => s.id) }))
    .filter((a) => a.stations.length);
  return { source: WEATHER_SOURCE, updated_at: fetched.length ? Math.min(...fetched) : null, stations: list, alerts };
}

/**
 * The animated backdrop behind a board, one of a few the apps draw. It follows whichever end of the
 * ride has the more eventful weather (a storm at either end beats sun at the other), so a glance at
 * the Trains tab says what you're heading into.
 */
export type WeatherTheme = "clear_day" | "clear_night" | "partly_day" | "partly_night" | "cloudy" | "fog" | "rain" | "storm" | "snow";

/** How eventful a condition is: the higher one picks the theme. */
const EVENTFUL: Record<WeatherCondition, number> = {
  clear: 0, mostly_clear: 0, partly_cloudy: 1, wind: 1, cloudy: 2, haze: 3, smoke: 3, fog: 3, drizzle: 4, rain: 5, showers: 5, snow: 6, thunder: 7,
};

export function themeOf(h: Pick<WeatherHour, "cond" | "day">): WeatherTheme {
  switch (h.cond) {
    case "clear": case "mostly_clear": return h.day ? "clear_day" : "clear_night";
    case "partly_cloudy": case "wind": return h.day ? "partly_day" : "partly_night";
    case "cloudy": return "cloudy";
    case "fog": case "haze": case "smoke": return "fog";
    case "drizzle": case "rain": case "showers": return "rain";
    case "snow": return "snow";
    case "thunder": return "storm";
  }
}

/** The theme for a ride: the more eventful end; on a tie, where you are now. */
export function rideTheme(from: WeatherHour | null, to: WeatherHour | null): WeatherTheme | null {
  const pick = !from ? to : !to ? from : EVENTFUL[to.cond] > EVENTFUL[from.cond] ? to : from;
  return pick ? themeOf(pick) : null;
}

/** The weather on a board: at the departure station now, and at the destination when the next train gets there. */
export interface BoardWeather {
  /** The backdrop the apps animate behind this board. */
  theme: WeatherTheme;
  from: WeatherHour | null;
  to: WeatherHour | null;
  /** When `to` applies: the next (not cancelled) train's predicted arrival, epoch ms. */
  to_at: number | null;
  /** Weather alerts at either end, headline only. */
  alerts: { event: string; headline: string; severity: string }[];
}

export function boardWeather(store: WeatherStore | null, b: Pick<Board, "from" | "to" | "trains">, now: number): BoardWeather | null {
  if (!store) return null;
  const next = b.trains.find((t) => t.status !== "cancelled" && t.pred_dep >= now - MIN);
  const toAt = next ? next.pred_arr : null;
  const from = weatherAt(store, b.from.id, now, now);
  const to = weatherAt(store, b.to.id, toAt ?? now, now);
  if (!from && !to) return null;
  const seen = new Set<string>();
  const alerts = [...stationAlerts(store, b.from.id, now), ...stationAlerts(store, b.to.id, now)]
    .filter((a) => !seen.has(a.id) && seen.add(a.id))
    .map(({ event, headline, severity }) => ({ event, headline, severity }));
  return { theme: rideTheme(from, to)!, from, to, to_at: to ? toAt : null, alerts };
}

const WORDS: Record<WeatherCondition, string> = {
  clear: "Clear", mostly_clear: "Mostly clear", partly_cloudy: "Partly cloudy", cloudy: "Cloudy", fog: "Fog", haze: "Haze",
  smoke: "Smoke", drizzle: "Drizzle", rain: "Rain", showers: "Showers", thunder: "Thunderstorms", snow: "Snow", wind: "Windy",
};
/** Daytime words say "sunny" where it's clear. */
export function conditionWords(h: Pick<WeatherHour, "cond" | "day">): string {
  if (h.day && h.cond === "clear") return "Sunny";
  if (h.day && h.cond === "mostly_clear") return "Mostly sunny";
  return WORDS[h.cond];
}

/** One short line, e.g. "58° Fog" or "54° Rain 70%" (glasses, MCP, notifications). */
export function weatherLine(h: WeatherHour): string {
  const chance = isWet(h) && h.pop > 0 ? ` ${h.pop}%` : "";
  return `${h.temp_f}° ${conditionWords(h)}${chance}`;
}
