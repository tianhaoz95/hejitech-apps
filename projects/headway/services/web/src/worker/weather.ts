// Weather at the stations from the National Weather Service (api.weather.gov). The cron calls
// refreshWeather every minute; core's weatherWork decides what's due (each forecast cell every two
// hours, at most a batch a minute; alerts every 30 minutes), so riders' requests never reach NWS.
// One KV value holds it all: forecasts aren't personal, and KV keeps it beside the other short-lived
// state without a table.
import { cellPath, mergeWeather, parseAlerts, parseHourly, weatherWork, WEATHER_ZONES, type WeatherHour, type WeatherStore } from "@headway/core";
import type { Env } from "./store.ts";

const BASE = "https://api.weather.gov";
const KEY = "headway:weather:v1";
/** NWS asks every client to identify itself (no personal contact: the site's URL). */
const HEADERS = { "User-Agent": "Headway/1.0 (https://headway.hejitech.workers.dev)", Accept: "application/geo+json" };

let memo: { at: number; store: WeatherStore | null } | null = null;
/** Isolates keep the weather this long before reading KV again. */
const MEMO_MS = 60_000;

export async function loadWeather(env: Env): Promise<WeatherStore | null> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.store;
  const raw = await env.OAUTH_KV.get(KEY).catch(() => null);
  let store: WeatherStore | null = null;
  try { store = raw ? (JSON.parse(raw) as WeatherStore) : null; } catch { store = null; }
  memo = { at: Date.now(), store };
  return store;
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(BASE + path, { headers: HEADERS, cf: { cacheTtl: 300 } } as RequestInit);
  if (!res.ok) throw new Error(`NWS ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

export interface WeatherReport {
  cells: number;
  failed: number;
  alerts: boolean;
}

/** One cron tick: fetch what's due, merge, store. A failed cell keeps its last forecast and waits. */
export async function refreshWeather(env: Env, now: number): Promise<WeatherReport | null> {
  if (env.WEATHER_DISABLED === "1") return null;
  const store = await loadWeather(env);
  const work = weatherWork(store, now);
  if (!work.cells.length && !work.alerts) return null;
  const errors: string[] = [];
  const cells: Record<string, WeatherHour[] | null> = {};
  await Promise.all(work.cells.map(async (cell) => {
    cells[cell] = await getJson(cellPath(cell)).then((j) => parseHourly(j, now)).catch((e: Error) => (errors.push(`${cell}: ${e.message}`), null));
  }));
  const alerts = work.alerts
    ? await getJson(`/alerts/active?zone=${WEATHER_ZONES.join(",")}`).then(parseAlerts).catch((e: Error) => (errors.push(`alerts: ${e.message}`), null))
    : undefined;
  if (errors.length) console.error("weather:", errors.join("; "));
  const next = mergeWeather(store, now, { cells, ...(alerts !== undefined ? { alerts } : {}) });
  memo = { at: Date.now(), store: next };
  await env.OAUTH_KV.put(KEY, JSON.stringify(next));
  return { cells: work.cells.length, failed: Object.values(cells).filter((c) => !c).length, alerts: Boolean(alerts) };
}
