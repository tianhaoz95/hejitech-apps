// MCP server (Streamable HTTP, JSON responses) at /mcp: an assistant asks "when's my next train?"
// for the signed-in user. Authentication happens before this runs (index.ts): OAuth grants issued
// by this Worker, or personal access tokens `hwa_…` made in the Headway app or on the web.
import { atLocal, board, commuteBoard, departures, findStation, progress, STATIONS, station, zoned, type Board, type BoardTrain } from "@headway/core";
import { loadSettings, loadSnapshot, loadTracked, saveTracked, type Db } from "./store.ts";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "0.1.0";

export interface Caller {
  userId: string;
  via: "oauth" | "token";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const STATION_ARG = { type: "string", description: "A Caltrain station: id (mountain_view), name (Mountain View) or short name (MTN VIEW). list_stations has them all." };

export const TOOLS = [
  {
    name: "my_commute",
    title: "My commute",
    description: "The user's commute board right now: their morning leg before their switch time, the evening leg after, with the next trains, live delays (when Caltrain's feed is fresh) and service alerts for those stations. `leg` forces one.",
    inputSchema: { type: "object", properties: { leg: { type: "string", enum: ["auto", "morning", "evening"] } } },
    annotations: { title: "My commute", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "next_trains",
    title: "Next trains between two stations",
    description: "The next Caltrain departures from one station to another (direction follows from the pair), with live predictions and delays where available. `after` (HH:MM, Pacific, today) looks later in the day.",
    inputSchema: { type: "object", required: ["from", "to"], properties: { from: STATION_ARG, to: STATION_ARG, after: { type: "string", description: "Optional HH:MM, Pacific time today." }, limit: { type: "integer", minimum: 1, maximum: 20 } } },
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
];

const local = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
const trainFacts = (t: BoardTrain) => ({
  train: t.train, kind: t.kind, trip_id: t.trip_id, service_date: t.service_date, status: t.status, delay_min: t.delay_min,
  departs: local(t.pred_dep), arrives: local(t.pred_arr), scheduled_departure: local(t.dep), scheduled_arrival: local(t.arr), stops_between: t.stops_between,
});
const boardFacts = (b: Board) => ({
  from: b.from.name, to: b.to.name, leg: b.leg, live: b.live, as_of: local(b.generated_at),
  trains: b.trains.map(trainFacts), alerts: b.alerts.map((a) => ({ header: a.header, description: a.description, url: a.url })),
  note: b.live ? undefined : "No fresh live data: times are the timetable's.",
});

function stationArg(v: unknown, name: string) {
  const s = typeof v === "string" ? station(v) ?? findStation(v) : undefined;
  if (!s) throw new Error(`${name}: unknown station ${JSON.stringify(v)} (see list_stations)`);
  return s;
}

async function callTool(name: string, args: Record<string, unknown>, caller: Caller, db: Db): Promise<unknown> {
  const now = Date.now();
  switch (name) {
    case "my_commute": {
      const { settings } = await loadSettings(db, caller.userId);
      const leg = args.leg === "morning" || args.leg === "evening" ? settings[args.leg] : null;
      const b = leg ? board(leg.from, leg.to, now, await loadSnapshot(db), args.leg as "morning" | "evening") : commuteBoard(settings, now, await loadSnapshot(db));
      if (!b) return { commute: null, note: "No commute saved yet. The user sets morning and evening stations in the Headway app or at /settings/." };
      return boardFacts(b);
    }
    case "next_trains": {
      const from = stationArg(args.from, "from"), to = stationArg(args.to, "to");
      if (from.id === to.id) throw new Error("from and to are the same station");
      const snapshot = await loadSnapshot(db);
      const after = typeof args.after === "string" && /^\d{1,2}:\d{2}$/.test(args.after) ? args.after : null;
      const b = board(from.id, to.id, now, snapshot)!;
      if (after) {
        const t0 = atLocal(zoned(now).date, after);
        b.trains = departures(from.id, to.id, Math.max(now, t0), snapshot, { after: t0, limit: Number(args.limit ?? 8) });
      } else if (args.limit) b.trains = b.trains.slice(0, Number(args.limit));
      return boardFacts(b);
    }
    case "service_alerts": {
      const snapshot = await loadSnapshot(db);
      const st = args.station ? stationArg(args.station, "station") : null;
      const alerts = (snapshot?.alerts ?? []).filter((a) => !st || a.stations.length === 0 || a.stations.includes(st.id));
      return { as_of: snapshot ? local(snapshot.fetched_at) : null, alerts: alerts.map((a) => ({ header: a.header, description: a.description, stations: a.stations.map((s) => station(s)?.name ?? s), url: a.url })) };
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
  }
  throw new Error(`unknown tool ${name}`);
}

export async function handleMcp(req: Request, caller: Caller, db: Db): Promise<Response> {
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
        instructions: "Caltrain for one rider: my_commute answers \"when's my next train?\" from their saved morning/evening stations; next_trains for any pair; service_alerts; track_train to get an arrival alert on their iPhone. Times are Pacific. A board with live=false is the timetable only.",
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
        const result = await callTool(name, args, caller, db);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
}
