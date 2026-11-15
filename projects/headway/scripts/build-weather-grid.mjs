#!/usr/bin/env node
// Maps every Caltrain station to its National Weather Service forecast cell and alert zones, once,
// into packages/core/src/weathergrid.gen.json. The Worker then fetches one hourly forecast per cell
// (several stations share a cell) and never calls /points at runtime.
//
//   node projects/headway/scripts/build-weather-grid.mjs
//
// Run it after build-timetable.mjs adds a station, or if a forecast URL starts answering 404 (NWS
// re-gridded an office). api.weather.gov wants an identifying User-Agent and coordinates with at
// most four decimals (more answers 301 "Adjusting Precision Of Point Coordinate").
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const timetable = JSON.parse(readFileSync(join(here, "../packages/core/src/timetable.gen.json"), "utf8"));
const out = join(here, "../packages/core/src/weathergrid.gen.json");
const headers = { "User-Agent": "Headway/1.0 (https://headway.hejitech.workers.dev)", Accept: "application/geo+json" };

const stations = {};
for (const s of timetable.stations) {
  const res = await fetch(`https://api.weather.gov/points/${s.lat.toFixed(4)},${s.lon.toFixed(4)}`, { headers });
  if (!res.ok) throw new Error(`${s.id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const p = (await res.json()).properties;
  const zone = (u) => String(u).split("/").pop();
  stations[s.id] = { cell: `${p.gridId}/${p.gridX},${p.gridY}`, zones: [zone(p.forecastZone), zone(p.county)] };
  console.log(s.id, stations[s.id].cell, stations[s.id].zones.join(" "));
}
const cells = new Set(Object.values(stations).map((s) => s.cell));
writeFileSync(out, JSON.stringify({ source: "api.weather.gov /points", stations }, null, 1) + "\n");
console.log(`${Object.keys(stations).length} stations, ${cells.size} forecast cells → ${out}`);
