#!/usr/bin/env node
// Compiles Caltrain's static GTFS (published by Trillium for Caltrain) into the compact timetable
// every Headway surface uses offline: packages/core/src/timetable.gen.json.
//
//   node projects/headway/scripts/build-timetable.mjs            # download the current feed
//   node projects/headway/scripts/build-timetable.mjs feed.zip   # or compile a local copy
//
// Run it when Caltrain publishes a new timetable (the feed's end date is in the output; the core
// tests fail 21 days before it runs out). Times are minutes after the service day's start (GTFS:
// noon minus 12 h), so trains after midnight keep counting past 1440.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FEED_URL = "https://data.trilliumtransit.com/gtfs/caltrain-ca-us/caltrain-ca-us.zip";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../packages/core/src/timetable.gen.json");

// Short names for the glasses (≤ 11 characters, upper case), keyed by GTFS parent station.
const SHORT = {
  san_francisco: "SF", "22nd_street": "22ND ST", bayshore: "BAYSHORE", south_sf: "S SF", san_bruno: "SAN BRUNO",
  place_MLBR: "MILLBRAE", broadway: "BROADWAY", burlingame: "BURLINGAME", san_mateo: "SAN MATEO", hayward_park: "HAYWARD PK",
  hillsdale: "HILLSDALE", belmont: "BELMONT", san_carlos: "SAN CARLOS", redwood_city: "REDWOOD CY", menlo_park: "MENLO PK",
  palo_alto: "PALO ALTO", stanford: "STANFORD", california_ave: "CAL AVE", san_antonio: "SAN ANTONIO", mountain_view: "MTN VIEW",
  sunnyvale: "SUNNYVALE", lawrence: "LAWRENCE", santa_clara: "SANTA CLARA", college_park: "COLLEGE PK", sj_diridon: "SJ DIRIDON",
  tamien: "TAMIEN", capitol: "CAPITOL", blossom_hill: "BLOSSOM HL", morgan_hill: "MORGAN HL", san_martin: "SAN MARTIN", gilroy: "GILROY",
};
// Stable ids for the API and saved settings (the GTFS parent ids, tidied).
const ID = { place_MLBR: "millbrae" };
const SERVICE_KIND = { "Local Weekday": "LOC", "Local Weekend": "LOC", Limited: "LTD", Express: "EXP", "South County": "SCC" };

function csv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  const keys = head.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const zip = process.argv[2] ?? join(mkdtempSync(join(tmpdir(), "headway-gtfs-")), "feed.zip");
if (!process.argv[2]) execFileSync("curl", ["-fsSL", "-o", zip, FEED_URL], { stdio: "inherit" });
const dir = mkdtempSync(join(tmpdir(), "headway-gtfs-x-"));
execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
const read = (f) => csv(readFileSync(join(dir, f), "utf8"));
if (!readdirSync(dir).includes("stop_times.txt")) throw new Error("not a GTFS feed");

const stops = read("stops.txt");
const feedInfo = read("feed_info.txt")[0] ?? {};
const parents = stops.filter((s) => s.location_type === "1" && SHORT[s.stop_id]);
const missing = stops.filter((s) => s.location_type === "0" && s.parent_station && !SHORT[s.parent_station] && /Caltrain/.test(s.stop_name));
if (missing.length) throw new Error(`stations without a short name: ${missing.map((s) => s.parent_station).join(", ")}`);

// North to south (latitude falls monotonically along the line from SF to Gilroy).
parents.sort((a, b) => Number(b.stop_lat) - Number(a.stop_lat));
const stations = parents.map((p) => {
  const platforms = stops.filter((s) => s.parent_station === p.stop_id && s.location_type === "0");
  const nb = platforms.find((s) => /Northbound/.test(s.stop_name))?.stop_id ?? null;
  const sb = platforms.find((s) => /Southbound/.test(s.stop_name))?.stop_id ?? null;
  const name = p.stop_name.replace(/ (Caltrain )?Station$/, "");
  return { id: ID[p.stop_id] ?? p.stop_id, name, short: SHORT[p.stop_id], nb, sb, lat: Number(Number(p.stop_lat).toFixed(5)), lon: Number(Number(p.stop_lon).toFixed(5)), gtfs: p.stop_id };
});
const stationOfStop = new Map();
stations.forEach((s, i) => { stationOfStop.set(s.gtfs, i); if (s.nb) stationOfStop.set(s.nb, i); if (s.sb) stationOfStop.set(s.sb, i); });

const routes = new Map(read("routes.txt").map((r) => [r.route_id, SERVICE_KIND[r.route_short_name] ?? "LOC"]));
const calendar = read("calendar.txt");
const dates = read("calendar_dates.txt");
const services = {};
const svc = (id) => (services[id] ??= { days: [0, 0, 0, 0, 0, 0, 0], start: null, end: null, add: [], remove: [] });
for (const c of calendar) {
  const s = svc(c.service_id);
  s.days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => Number(c[d]));
  s.start = c.start_date;
  s.end = c.end_date;
}
for (const d of dates) (d.exception_type === "1" ? svc(d.service_id).add : svc(d.service_id).remove).push(d.date);

const minutes = (t) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 60 + m + Math.round((s || 0) / 60);
};
const byTrip = new Map();
for (const st of read("stop_times.txt")) {
  if (!byTrip.has(st.trip_id)) byTrip.set(st.trip_id, []);
  byTrip.get(st.trip_id).push(st);
}
const trips = [];
for (const t of read("trips.txt")) {
  const times = (byTrip.get(t.trip_id) ?? []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  const flat = [];
  for (const st of times) {
    const i = stationOfStop.get(st.stop_id);
    if (i === undefined) continue; // shuttles and other non-rail stops
    if (st.pickup_type === "1" && st.drop_off_type === "1") continue;
    flat.push(i, minutes(st.arrival_time || st.departure_time), minutes(st.departure_time || st.arrival_time));
  }
  if (flat.length < 6) continue;
  trips.push({ id: t.trip_id, train: t.trip_short_name || t.trip_id, kind: routes.get(t.route_id) ?? "LOC", svc: t.service_id, dir: Number(t.direction_id) === 0 ? "N" : "S", stops: flat });
}
trips.sort((a, b) => a.stops[1] - b.stops[1]);
for (const id of Object.keys(services)) if (!trips.some((t) => t.svc === id)) delete services[id];

const timetable = {
  source: FEED_URL,
  feed_version: feedInfo.feed_version ?? "",
  feed_start: feedInfo.feed_start_date ?? "",
  feed_end: feedInfo.feed_end_date ?? "",
  stations: stations.map(({ gtfs, ...s }) => s),
  services,
  trips,
};
writeFileSync(out, JSON.stringify(timetable) + "\n");
console.log(`wrote ${out}: ${stations.length} stations, ${trips.length} trips, ${Object.keys(services).length} services, valid ${timetable.feed_start}–${timetable.feed_end}`);
