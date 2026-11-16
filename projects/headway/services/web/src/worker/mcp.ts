// MCP server (Streamable HTTP, JSON responses) at /mcp: an assistant asks "when's my next train?"
// for the signed-in user. Authentication happens before this runs (index.ts): OAuth grants issued
// by this Worker, or personal access tokens `hwa_…` made in the Headway app or on the web.
import { atLocal, board, boardWeather, daysText, TRAVEL_MODES, commuteBoard, departures, findStation, progress, STATIONS, station, TIMETABLE, weatherLine, weatherReport, zoned, type Board, type BoardTrain, type ExpressPreference, type WeatherHour, type WeatherStore } from "@headway/core";
import { createEtaShare, loadSettings, loadSnapshot, loadTracked, saveTracked, type Db } from "./store.ts";
import { agentCanEdit, type EditResult } from "./agent.ts";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "0.1.0";

export interface Caller {
  userId: string;
  via: "oauth" | "token";
  /** The assistant's name, for the rider's notification and change list (null: unknown). */
  client?: string | null;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const LEG_PATCH = {
  type: ["object", "null"],
  description: "Fields of this leg to change (others stay as they are); null removes the leg. To add a missing leg, give from and to.",
  properties: {
    from: { type: "string", description: "Station you board at (id, name or short name)." },
    to: { type: "string", description: "Station you get off at." },
    usual: { type: ["string", "null"], description: "The train you usually take, HH:MM (24 h, Pacific): the first train at or after it gets the leave-now reminder. null: none." },
    walk_minutes: { type: "integer", minimum: 0, maximum: 90, description: "Minutes from door to platform (used for leave-by times when the phone's location isn't used)." },
    travel_mode: { type: "string", enum: ["walk", "bike", "ebike", "scooter", "drive"], description: "How the rider gets to the station." },
    window: { type: "object", description: "When this leg is watched for alerts, HH:MM (24 h).", properties: { start: { type: "string" }, end: { type: "string" } } },
    express_preference: { type: "string", enum: ["all", "prefer_express", "express_only"] },
  },
};

const STATION_ARG = { type: "string", description: "A Caltrain station: id (mountain_view), name (Mountain View) or short name (MTN VIEW). list_stations has them all." };

export const TOOLS = [
  {
    name: "my_commute",
    title: "My commute",
    description: "The user's commute board right now: their morning leg before their switch time, the evening leg after, with the next trains, live delays (when Caltrain's feed is fresh), leave-by times based on their walk, and service alerts for those stations. `leg` forces one. `express_preference` optionally filters or prioritizes express trains (all, prefer_express, express_only).",
    inputSchema: { type: "object", properties: { leg: { type: "string", enum: ["auto", "morning", "evening"] }, express_preference: { type: "string", enum: ["all", "prefer_express", "express_only"] } } },
    annotations: { title: "My commute", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "next_trains",
    title: "Next trains between two stations",
    description: "The next Caltrain departures from one station to another (direction follows from the pair), with live predictions and delays where available. `after` (HH:MM, Pacific, today) looks later in the day. `express_preference` filters or prioritizes express trains. `walk_minutes` calculates leave-by times and catch state for each train.",
    inputSchema: { type: "object", required: ["from", "to"], properties: { from: STATION_ARG, to: STATION_ARG, after: { type: "string", description: "Optional HH:MM, Pacific time today." }, limit: { type: "integer", minimum: 1, maximum: 20 }, express_preference: { type: "string", enum: ["all", "prefer_express", "express_only"] }, walk_minutes: { type: "integer", minimum: 0, maximum: 120 } } },
    annotations: { title: "Next trains", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "service_alerts",
    title: "Caltrain service alerts",
    description: "Caltrain's current service alerts, optionally only those affecting one station (system-wide alerts always included).",
    inputSchema: { type: "object", properties: { station: STATION_ARG } },
    annotations: { title: "Service alerts", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_stations",
    title: "List Caltrain stations",
    description: "Every Caltrain station north to south (San Francisco … Gilroy) with its id, name and the short name the glasses show.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "List stations", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "track_train",
    title: "Track a train",
    description: "Follow a train the user is on (or about to board): the glasses show its progress and the user's iPhone gets an alert before it reaches `to`. Use a trip_id and service_date from next_trains or my_commute. Replaces any train already tracked.",
    inputSchema: { type: "object", required: ["trip_id", "service_date", "from", "to"], properties: { trip_id: { type: "string" }, service_date: { type: "string", description: "YYYYMMDD from the board." }, from: STATION_ARG, to: STATION_ARG } },
    annotations: { title: "Track a train", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "tracked_train",
    title: "The train being tracked",
    description: "Where the tracked train is: next stop, predicted arrival at the user's stop, delay, stops left. Null when nothing is tracked.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "Tracked train", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "stop_tracking",
    title: "Stop tracking",
    description: "Stops following the tracked train (no arrival alert).",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "Stop tracking", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "station_weather",
    title: "Weather at Caltrain stations",
    description: "The weather at Caltrain stations from the National Weather Service: now, the next 12 hours, today's high and low, when rain starts, and weather alerts (heat, wind, flood…). One station, or every station north to south. Refreshed every two hours; Fahrenheit.",
    inputSchema: { type: "object", properties: { station: STATION_ARG } },
    annotations: { title: "Station weather", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_settings",
    title: "The rider's commute settings",
    description: "The rider's saved commute: morning and evening legs (stations, usual train, how they get to the station and how long it takes, alert window, express preference), the days they commute, when the board switches to the evening leg, and which alerts they get. Also says whether they allow assistants to change it (update_commute).",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "Commute settings", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "update_commute",
    title: "Change the rider's commute",
    description: "Changes the rider's saved commute settings, only if they turned on \"Let assistants change my commute\" in the Headway app (otherwise it fails and says so: tell the rider, don't retry). Send only the fields to change. Changes are PERMANENT, not for one day: for a one-off (\"I'm going in late tomorrow\") ask the rider first, since they would have to change it back. Call get_settings first. The rider's phone is notified of every change and can undo it. Can't change on-train/location mode, the name on shared ETA links, family or devices. Returns what changed, in words.",
    inputSchema: {
      type: "object",
      properties: {
        morning: LEG_PATCH,
        evening: LEG_PATCH,
        days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Days the commute is watched for alerts, 0 = Monday … 6 = Sunday (the whole list)." },
        switch_at: { type: "string", description: "HH:MM: before it the board shows the morning leg, after it the evening one." },
        express_preference: { type: "string", enum: ["all", "prefer_express", "express_only"], description: "Default train preference." },
        alerts: {
          type: "object",
          description: "Alert choices to change.",
          properties: {
            delay: { type: "boolean" }, delay_threshold: { type: "integer", minimum: 1, maximum: 60, description: "Minutes late before a delay alert." },
            cancellation: { type: "boolean" }, service: { type: "boolean", description: "Caltrain service alerts for the rider's stations." },
            leave_now: { type: "boolean" }, arrival: { type: "boolean" }, arrival_minutes: { type: "integer", minimum: 1, maximum: 60, description: "Minutes before reaching the stop." },
            better_train: { type: "boolean", description: "When a later train gets there sooner." },
            scope: { type: "string", enum: ["priority", "all"], description: "priority: only what affects the commute; all: also the rest, quietly." },
            stop_when_done: { type: "boolean", description: "Stop a leg's alerts for the day once the rider reached its stop." },
          },
        },
      },
    },
    annotations: { title: "Change commute", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "share_eta",
    title: "Share live train ETA",
    description: "Generates a shareable live web link (valid until 30 min after arrival) for the train the user is currently tracking.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Optional name to display on the link (e.g. 'Sam')." } } },
    annotations: { title: "Share ETA", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

const KIND_NAMES: Record<string, string> = { LOC: "Local", LTD: "Limited", EXP: "Express", SCC: "South County" };
const local = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
const trainFacts = (t: BoardTrain) => ({
  train: t.train, kind: t.kind, kind_name: KIND_NAMES[t.kind] ?? t.kind, is_express: t.kind === "EXP", trip_id: t.trip_id, service_date: t.service_date, status: t.status, delay_min: t.delay_min,
  departs: local(t.pred_dep), arrives: local(t.pred_arr), scheduled_departure: local(t.dep), scheduled_arrival: local(t.arr), stops_between: t.stops_between,
  ride_min: t.ride_min ?? undefined,
  overtaken_by: t.overtaken_by_train ?? undefined,
  first_in: t.first_in ?? undefined,
  shortest: t.shortest ?? undefined,
  leave_by: t.leave_by ? local(t.leave_by) : undefined, catch: t.catch ?? undefined,
});
const boardFacts = (b: Board) => ({
  from: b.from.name, to: b.to.name, leg: b.leg, live: b.live, as_of: local(b.generated_at), express_preference: b.express_preference ?? "all",
  walk_minutes: b.walk_minutes ?? undefined,
  tip: b.tip ? { wait_for: b.tip.wait_for, instead_of: b.tip.instead_of, saves_min: b.tip.saves_min } : undefined,
  trains: b.trains.map(trainFacts), alerts: b.alerts.map((a) => ({ header: a.header, description: a.description, url: a.url })),
  weather: b.weather ? {
    [b.from.name]: b.weather.from ? weatherLine(b.weather.from) : undefined,
    [`${b.to.name} on arrival${b.weather.to_at ? ` (${local(b.weather.to_at)})` : ""}`]: b.weather.to ? weatherLine(b.weather.to) : undefined,
    alerts: b.weather.alerts.length ? b.weather.alerts.map((a) => a.headline) : undefined,
  } : undefined,
  note: b.live ? undefined : "No fresh live data: times are the timetable's.",
});
const hourFacts = (h: WeatherHour) => ({ at: local(h.t), summary: weatherLine(h), temp_f: h.temp_f, chance_of_rain: h.pop, wind_mph: h.wind_mph, forecast: h.text });

function stationArg(v: unknown, name: string) {
  const s = typeof v === "string" ? station(v) ?? findStation(v) : undefined;
  if (!s) throw new Error(`${name}: unknown station ${JSON.stringify(v)} (see list_stations)`);
  return s;
}

const MODE_WORDS: Record<string, string> = { walk: "walk", bike: "bike", ebike: "e-bike", scooter: "scooter", drive: "drive" };
const hm = (s: string | null | undefined) => (s ? local(atLocal(zoned(Date.now()).date, s)) : null);

async function callTool(name: string, args: Record<string, unknown>, caller: Caller, db: Db, now: number, weather: () => Promise<WeatherStore | null>, editCommute: (patch: unknown) => Promise<EditResult>): Promise<unknown> {
  const withWeather = async (b: Board) => ((b.weather = boardWeather(await weather().catch(() => null), b, now)), b);
  switch (name) {
    case "my_commute": {
      const { settings } = await loadSettings(db, caller.userId);
      const leg = args.leg === "morning" || args.leg === "evening" ? settings[args.leg] : null;
      const expPref = (args.express_preference as ExpressPreference) || undefined;
      const b = leg
        ? board(leg.from, leg.to, now, await loadSnapshot(db), args.leg as "morning" | "evening", TIMETABLE, expPref ? { expressPreference: expPref } : {})
        : commuteBoard(settings, now, await loadSnapshot(db), undefined, expPref ? { expressPreference: expPref } : {});
      if (!b) return { commute: null, note: "No commute saved yet. The user sets morning and evening stations in the Headway app or at /settings/." };
      return boardFacts(await withWeather(b));
    }
    case "next_trains": {
      const from = stationArg(args.from, "from"), to = stationArg(args.to, "to");
      if (from.id === to.id) throw new Error("from and to are the same station");
      const snapshot = await loadSnapshot(db);
      const after = typeof args.after === "string" && /^\d{1,2}:\d{2}$/.test(args.after) ? args.after : null;
      const expPref = (args.express_preference as ExpressPreference) || undefined;
      const walk = typeof args.walk_minutes === "number" ? Number(args.walk_minutes) : undefined;
      const b = board(from.id, to.id, now, snapshot, "custom", TIMETABLE, {
        expressPreference: expPref,
        walkMinutes: walk,
      })!;
      if (after) {
        const t0 = atLocal(zoned(now).date, after);
        b.trains = departures(from.id, to.id, Math.max(now, t0), snapshot, { after: t0, limit: Number(args.limit ?? 8), expressPreference: expPref, walkMinutes: walk });
      } else if (args.limit) b.trains = b.trains.slice(0, Number(args.limit));
      return boardFacts(await withWeather(b));
    }
    case "service_alerts": {
      const snapshot = await loadSnapshot(db);
      const st = args.station ? stationArg(args.station, "station") : null;
      const alerts = (snapshot?.alerts ?? []).filter((a) => !st || a.stations.length === 0 || a.stations.includes(st.id));
      return { as_of: snapshot ? local(snapshot.fetched_at) : null, alerts: alerts.map((a) => ({ header: a.header, description: a.description, stations: a.stations.map((s) => station(s)?.name ?? s), url: a.url })) };
    }
    case "station_weather": {
      const st = args.station ? stationArg(args.station, "station") : null;
      const r = weatherReport(await weather(), now);
      const list = r.stations.filter((s) => !st || s.id === st.id);
      if (!r.updated_at) return { source: r.source, stations: [], note: "No forecast yet: the server fetches one within a few minutes." };
      return {
        source: r.source, as_of: local(r.updated_at),
        stations: list.map((s) => ({
          station: s.name, now: s.now ? hourFacts(s.now) : null, high_f: s.high_f, low_f: s.low_f,
          rain_starts: s.rain_at ? local(s.rain_at) : null,
          next_hours: st ? s.hours.map(hourFacts) : undefined,
          alerts: s.alert_ids.length ? r.alerts.filter((a) => s.alert_ids.includes(a.id)).map((a) => a.headline) : undefined,
        })),
      };
    }
    case "get_settings": {
      const [{ settings: s, saved }, canEdit] = await Promise.all([loadSettings(db, caller.userId), agentCanEdit(db, caller.userId)]);
      const leg = (l: typeof s.morning) => l && {
        from: station(l.from)?.name ?? l.from, to: station(l.to)?.name ?? l.to, from_id: l.from, to_id: l.to,
        usual: l.usual, usual_time: hm(l.usual), getting_there: `${MODE_WORDS[l.travel_mode ?? "walk"]}, ${l.walk_minutes} min`,
        travel_mode: l.travel_mode ?? "walk", walk_minutes: l.walk_minutes, alert_window: l.window, express_preference: l.express_preference ?? "all",
      };
      return {
        saved, assistant_can_edit: canEdit,
        note: canEdit ? undefined : "update_commute is off: the rider can turn on \"Let assistants change my commute\" in the Headway app (Settings › Assistants).",
        morning: leg(s.morning), evening: leg(s.evening), days: s.days, days_text: daysText(s.days), switch_at: s.switch_at,
        express_preference: s.express_preference ?? "all", alerts: s.alerts,
        travel_modes: TRAVEL_MODES,
      };
    }
    case "update_commute": {
      const r = await editCommute(args);
      if (!r.ok) throw new Error(r.error);
      if (!r.changes.length) return { changed: [], note: "That's how it was already: nothing changed." };
      return { changed: r.changes, note: "Saved. The rider's phone was told, and they can undo it in Settings › Assistants." };
    }
    case "list_stations":
      return { stations: STATIONS.map((s) => ({ id: s.id, name: s.name, short: s.short })) };
    case "track_train": {
      const from = stationArg(args.from, "from"), to = stationArg(args.to, "to");
      const t = { trip_id: String(args.trip_id ?? ""), service_date: String(args.service_date ?? ""), from: from.id, to: to.id };
      if (!/^\d{8}$/.test(t.service_date)) throw new Error("service_date must be YYYYMMDD");
      const p = progress(t, now, await loadSnapshot(db));
      if (!p) throw new Error("that train doesn't run to that station");
      await saveTracked(db, caller.userId, t);
      return { tracking: true, train: p.train, to: p.to.name, arrives: local(p.pred_arr), delay_min: p.delay_min };
    }
    case "tracked_train": {
      const t = await loadTracked(db, caller.userId);
      const p = t ? progress(t, now, await loadSnapshot(db)) : null;
      if (!p) return { tracked: null };
      return { tracked: { train: p.train, kind: p.kind, to: p.to.name, next_stop: p.next?.name ?? null, arrives: local(p.pred_arr), delay_min: p.delay_min, stops_left: p.stops_left, arrived: p.arrived, cancelled: p.cancelled, live: p.live } };
    }
    case "stop_tracking":
      await saveTracked(db, caller.userId, null);
      return { tracking: false };
    case "share_eta": {
      const t = await loadTracked(db, caller.userId);
      if (!t) throw new Error("no train currently tracked; call track_train first");
      const { settings } = await loadSettings(db, caller.userId);
      const name = typeof args.name === "string" ? args.name : settings.share_name;
      const share = await createEtaShare(db, caller.userId, t, name, "https://headway.hejitech.workers.dev");
      return { url: share.url, expires_at: share.expires_at, train: t.trip_id };
    }
  }
  throw new Error(`unknown tool ${name}`);
}

export async function handleMcp(
  req: Request, caller: Caller, db: Db, now = Date.now(), weather: () => Promise<WeatherStore | null> = async () => null,
  editCommute: (patch: unknown) => Promise<EditResult> = async () => ({ ok: false, status: 503, error: "not available" }),
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return json({ name: "headway-mcp", transport: "streamable-http" });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let msg: { id?: string | number; method: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const reply = (result: unknown) => json({ jsonrpc: "2.0", id: msg.id ?? null, result });

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "headway", version: SERVER_VERSION },
        instructions: "Caltrain for one rider: my_commute answers \"when's my next train?\" from their saved morning/evening stations; next_trains for any pair; service_alerts; track_train to get an arrival alert on their iPhone; station_weather for the weather at stations (boards also carry the weather where they leave and where they get off); get_settings for their saved commute, and update_commute to change it when they allow assistants to (changes are permanent and the rider is notified). Times are Pacific. A board with live=false is the timetable only.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, caller, db, now, weather, editCommute);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
}
