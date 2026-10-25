// A minimal GTFS-Realtime (protobuf) reader for Caltrain's TripUpdates and ServiceAlerts feeds
// from 511.org: only the fields Headway uses, no dependency. Field numbers are from
// gtfs-realtime.proto (https://gtfs.org/realtime/reference/).
import { STATIONS } from "./schedule.ts";
import type { RealtimeSnapshot, RealtimeTrip, ServiceAlert } from "./types.ts";

type Field = { no: number; wire: number; value: number | Uint8Array; lo?: number };

function* fields(buf: Uint8Array): Generator<Field> {
  let i = 0;
  let lo = 0;
  const varint = (): number => {
    let result = 0, shift = 0, b: number;
    lo = 0;
    do {
      if (i >= buf.length) throw new Error("truncated varint");
      b = buf[i++];
      result += (b & 0x7f) * 2 ** shift;
      if (shift < 32) lo = (lo | ((b & 0x7f) << shift)) >>> 0;
      shift += 7;
    } while (b & 0x80);
    return result;
  };
  while (i < buf.length) {
    const key = varint();
    const no = Math.floor(key / 8), wire = key & 7;
    if (wire === 0) {
      const value = varint();
      yield { no, wire, value, lo };
    }
    else if (wire === 2) {
      const len = varint();
      if (i + len > buf.length) throw new Error("truncated field");
      yield { no, wire, value: buf.subarray(i, i + len) };
      i += len;
    } else if (wire === 1) { i += 8; yield { no, wire, value: 0 }; }
    else if (wire === 5) { i += 4; yield { no, wire, value: 0 }; }
    else throw new Error(`unsupported wire type ${wire}`);
  }
}

const text = new TextDecoder();
const str = (v: Field["value"]) => (v instanceof Uint8Array ? text.decode(v) : String(v));
const msg = (v: Field["value"]) => (v instanceof Uint8Array ? v : new Uint8Array());
/** int32 as varint: negatives arrive as 10-byte two's complement, so read the low 32 bits signed. */
const int32 = (f: Field) => (f.lo ?? Number(f.value)) | 0;

interface Header { timestamp: number | null }

function header(b: Uint8Array): Header {
  let timestamp: number | null = null;
  for (const f of fields(b)) if (f.no === 3) timestamp = Number(f.value);
  return { timestamp };
}

function stopTimeEvent(b: Uint8Array): { delay?: number; time?: number } {
  const e: { delay?: number; time?: number } = {};
  for (const f of fields(b)) {
    if (f.no === 1) e.delay = int32(f);
    else if (f.no === 2) e.time = Number(f.value);
  }
  return e;
}

/** TripUpdate → [trip_id, entry]. */
function tripUpdate(b: Uint8Array): [string, RealtimeTrip] | null {
  let tripId = "", startDate: string | undefined, cancelled = false, delay: number | undefined;
  const stops: RealtimeTrip["stops"] = {};
  for (const f of fields(b)) {
    if (f.no === 1) {
      for (const t of fields(msg(f.value))) {
        if (t.no === 1) tripId = str(t.value);
        else if (t.no === 3) startDate = str(t.value);
        else if (t.no === 4 && Number(t.value) === 3) cancelled = true; // CANCELED
      }
    } else if (f.no === 2) {
      let stopId = "", arr: ReturnType<typeof stopTimeEvent> | null = null, dep: ReturnType<typeof stopTimeEvent> | null = null, skipped = false;
      for (const s of fields(msg(f.value))) {
        if (s.no === 2) arr = stopTimeEvent(msg(s.value));
        else if (s.no === 3) dep = stopTimeEvent(msg(s.value));
        else if (s.no === 4) stopId = str(s.value);
        else if (s.no === 5 && Number(s.value) === 1) skipped = true; // SKIPPED
      }
      if (!stopId) continue;
      const e: RealtimeTrip["stops"][string] = {};
      if (arr?.time) e.arr = arr.time;
      if (dep?.time) e.dep = dep.time;
      const d = dep?.delay ?? arr?.delay;
      if (d !== undefined) e.delay = d;
      if (skipped) e.skipped = true;
      stops[stopId] = e;
    } else if (f.no === 5) delay = int32(f);
  }
  if (!tripId) return null;
  const entry: RealtimeTrip = { stops };
  if (cancelled) entry.cancelled = true;
  if (delay !== undefined) entry.delay = delay;
  if (startDate) entry.start_date = startDate;
  return [tripId, entry];
}

function translated(b: Uint8Array): string {
  const all: { text: string; lang: string }[] = [];
  for (const f of fields(b)) {
    if (f.no !== 1) continue;
    let t = "", lang = "";
    for (const x of fields(msg(f.value))) {
      if (x.no === 1) t = str(x.value);
      else if (x.no === 2) lang = str(x.value);
    }
    all.push({ text: t, lang });
  }
  return (all.find((a) => a.lang.startsWith("en")) ?? all.find((a) => !a.lang) ?? all[0])?.text ?? "";
}

const EFFECTS = ["", "NO_SERVICE", "REDUCED_SERVICE", "SIGNIFICANT_DELAYS", "DETOUR", "ADDITIONAL_SERVICE", "MODIFIED_SERVICE", "OTHER_EFFECT", "UNKNOWN_EFFECT", "STOP_MOVED", "NO_EFFECT", "ACCESSIBILITY_ISSUE"];

const stationOfStop = new Map<string, string>();
for (const s of STATIONS) {
  stationOfStop.set(s.id, s.id);
  if (s.nb) stationOfStop.set(s.nb, s.id);
  if (s.sb) stationOfStop.set(s.sb, s.id);
}

function alert(id: string, b: Uint8Array): ServiceAlert {
  const a: ServiceAlert = { id, header: "", description: "", stations: [], routes: [] };
  let start: number | undefined, end: number | undefined;
  for (const f of fields(b)) {
    if (f.no === 1) {
      // Several active periods: keep the earliest start and the latest end.
      for (const p of fields(msg(f.value))) {
        if (p.no === 1) start = Math.min(start ?? Infinity, Number(p.value));
        else if (p.no === 2) end = Math.max(end ?? 0, Number(p.value));
      }
    } else if (f.no === 5) {
      for (const e of fields(msg(f.value))) {
        if (e.no === 2) a.routes.push(str(e.value));
        else if (e.no === 5) {
          const st = stationOfStop.get(str(e.value));
          if (st && !a.stations.includes(st)) a.stations.push(st);
        }
      }
    } else if (f.no === 7) a.effect = EFFECTS[Number(f.value)] || undefined;
    else if (f.no === 8) a.url = translated(msg(f.value)) || undefined;
    else if (f.no === 10) a.header = translated(msg(f.value)).trim();
    else if (f.no === 11) a.description = translated(msg(f.value)).trim();
  }
  if (start !== undefined && Number.isFinite(start) && start > 0) a.start = start;
  if (end !== undefined && end > 0) a.end = end;
  if (!a.url) delete a.url;
  if (!a.effect) delete a.effect;
  return a;
}

export interface DecodedFeed {
  timestamp: number | null;
  trips: Record<string, RealtimeTrip>;
  alerts: ServiceAlert[];
}

/** Decodes one FeedMessage (TripUpdates, ServiceAlerts, or both in one feed). */
export function decodeFeed(buf: Uint8Array): DecodedFeed {
  const out: DecodedFeed = { timestamp: null, trips: {}, alerts: [] };
  for (const f of fields(buf)) {
    if (f.no === 1) out.timestamp = header(msg(f.value)).timestamp;
    else if (f.no === 2) {
      let id = "", deleted = false;
      let tu: Uint8Array | null = null, al: Uint8Array | null = null;
      for (const e of fields(msg(f.value))) {
        if (e.no === 1) id = str(e.value);
        else if (e.no === 2) deleted = Boolean(e.value);
        else if (e.no === 3) tu = msg(e.value);
        else if (e.no === 5) al = msg(e.value);
      }
      if (deleted) continue;
      if (tu) {
        const t = tripUpdate(tu);
        if (t) out.trips[t[0]] = t[1];
      }
      if (al) {
        const a = alert(id, al);
        if (a.header || a.description) out.alerts.push(a);
      }
    }
  }
  return out;
}

/** One snapshot from the two feeds (either may be missing: then that half is empty). */
export function snapshotFrom(trips: DecodedFeed | null, alerts: DecodedFeed | null, fetchedAt: number): RealtimeSnapshot {
  return {
    fetched_at: fetchedAt,
    feed_ts: trips?.timestamp ?? alerts?.timestamp ?? null,
    trips: trips?.trips ?? {},
    alerts: alerts?.alerts ?? [],
  };
}

// ---------------------------------------------------------------- encoder (tests and fixtures)

type Value = number | string | Uint8Array | Msg | Msg[] | number[] | string[];
export interface Msg { [field: number]: Value }

/** Encodes a message given as { fieldNo: value }: numbers are varints, strings/bytes/messages length-delimited. */
export function encode(m: Msg): Uint8Array {
  const out: number[] = [];
  const varint = (num: number) => {
    let n = BigInt(num);
    if (n < 0n) n += 1n << 64n;
    do {
      let b = Number(n & 0x7fn);
      n >>= 7n;
      if (n > 0n) b |= 0x80;
      out.push(b);
    } while (n > 0n);
  };
  const put = (no: number, v: Value) => {
    if (Array.isArray(v)) return v.forEach((x) => put(no, x as Value));
    if (typeof v === "number") { varint(no * 8); varint(v); return; }
    const bytes = typeof v === "string" ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : encode(v);
    varint(no * 8 + 2);
    varint(bytes.length);
    out.push(...bytes);
  };
  for (const [k, v] of Object.entries(m)) put(Number(k), v);
  return new Uint8Array(out);
}
