// The TypeScript twin of LogCore's derivation (apps/ios/LogCore/Sources/LogCore/Derive.swift and
// Status.swift). Used by the website, the MCP Worker and the glasses app. Both implementations run the
// same fixtures (spec/fixtures/status.json), so they cannot drift apart silently.
// No imports besides the spec JSON: this file runs in Workers and in the browser.

import spec from "./event-types.json" with { type: "json" };

export type FieldValue = string | number | boolean;

export interface Provenance {
  surface: "phone" | "watch" | "glasses" | "ring" | "mcp" | "widget" | "siri";
  input: "voice" | "gesture" | "tap" | "agent";
  raw_transcript?: string;
  confidence?: Record<string, number>;
  confidence_tier?: "auto" | "pick" | "full_list";
  model_version?: string;
  capture_id?: string;
  caller?: string;
}

export interface LogEvent {
  id: string;
  household_id: string;
  baby_id: string;
  type: string;
  fields: Record<string, FieldValue>;
  occurred_at: string;
  logged_at: string;
  logged_by: string;
  provenance: Provenance;
  supersedes?: string | null;
  session_id?: string | null;
}

export type EventStatus = "active" | "undone" | "superseded" | "merged" | "duplicate_unresolved";

export interface Session {
  kind: "bottle" | "breast" | "sleep";
  baby_id?: string;
  start?: number;
  end?: number;
  startEvent?: string;
  endEvent?: string;
  sides: string[];
  consumedFraction?: number;
  consumedMl?: number;
  contents?: string;
  abandoned?: boolean;
}

export const SYSTEM_TYPES = new Set(["note", "undo", "resolve", "duty", "settings"]);
export const registry = spec;
export const eventTypes = spec.types;

export function typeSpec(id: string) {
  return spec.types.find((t) => t.id === id);
}

const t = (iso: string) => Date.parse(iso);

export interface Derived {
  baby?: string;
  all: LogEvent[];
  status: Map<string, EventStatus>;
  effective: LogEvent[];
  duplicates: { original: string; duplicate: string }[];
  sessions: Session[];
  duty: { caregiver: string | null; since: number } | null;
}

/**
 * With `baby`, one child's log: their data events, sessions and duplicates (system events such as undo
 * and duty stay household-wide). Without it, the household's, with sessions paired per child. Undo,
 * edits and resolutions are resolved over the whole household (same as Derive.swift).
 */
export function derive(events: LogEvent[], baby?: string): Derived {
  const ordered = [...events].sort((a, b) => t(a.logged_at) - t(b.logged_at) || a.id.localeCompare(b.id));
  const mine = (e: LogEvent) => baby === undefined || SYSTEM_TYPES.has(e.type) || e.baby_id === baby;
  const byId = new Map(ordered.map((e) => [e.id, e]));

  const undone = new Set<string>();
  for (const e of ordered) {
    if (e.type !== "undo" || !e.supersedes || undone.has(e.id)) continue;
    if (undone.has(e.supersedes)) undone.delete(e.supersedes);
    else undone.add(e.supersedes);
  }
  const superseded = new Set<string>();
  for (const e of ordered) {
    if (SYSTEM_TYPES.has(e.type) || undone.has(e.id)) continue;
    if (e.supersedes && byId.has(e.supersedes)) superseded.add(e.supersedes);
  }
  const merged = new Set<string>();
  const resolved = new Set<string>();
  for (const e of ordered) {
    if (e.type !== "resolve" || undone.has(e.id)) continue;
    const a = String(e.fields.original ?? ""), b = String(e.fields.duplicate ?? "");
    if (!a || !b) continue;
    resolved.add([a, b].sort().join("|"));
    if (e.fields.resolution === "merge") merged.add(b);
  }
  const status = new Map<string, EventStatus>();
  for (const e of ordered) {
    status.set(e.id, undone.has(e.id) ? "undone" : superseded.has(e.id) ? "superseded" : merged.has(e.id) ? "merged" : "active");
  }
  const data = ordered
    .filter((e) => !SYSTEM_TYPES.has(e.type) && status.get(e.id) === "active")
    .sort((a, b) => t(a.occurred_at) - t(b.occurred_at) || t(a.logged_at) - t(b.logged_at));

  // lineage root of each edit chain
  const root = new Map<string, string>();
  for (const e of ordered) {
    let cur = e, r = e.id, hops = 0;
    while (cur.supersedes && byId.has(cur.supersedes) && hops < 64) {
      cur = byId.get(cur.supersedes)!;
      r = cur.id;
      hops++;
    }
    root.set(e.id, r);
  }

  const windowDefault = spec.duplicateWindowsMinutes.default * 60_000;
  const windowStart = spec.duplicateWindowsMinutes.start * 60_000;
  const duplicates: { original: string; duplicate: string }[] = [];
  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    const window = typeSpec(a.type)?.session?.role === "start" ? windowStart : windowDefault;
    for (let j = i + 1; j < data.length; j++) {
      const b = data[j];
      if (t(b.occurred_at) - t(a.occurred_at) > window) break;
      if (a.type !== b.type || a.baby_id !== b.baby_id) continue;
      if (a.logged_by === b.logged_by && a.provenance.surface === b.provenance.surface) continue;
      if (root.get(a.id) === root.get(b.id)) continue;
      if (resolved.has([a.id, b.id].sort().join("|"))) continue;
      const [first, second] = t(a.logged_at) <= t(b.logged_at) ? [a, b] : [b, a];
      if (duplicates.some((d) => d.duplicate === second.id)) continue;
      duplicates.push({ original: first.id, duplicate: second.id });
      status.set(second.id, "duplicate_unresolved");
    }
  }

  const own = data.filter(mine);
  const ownIds = new Set(own.map((e) => e.id));
  const active = own.filter((e) => status.get(e.id) === "active");
  const children = new Map<string, LogEvent[]>();
  for (const e of active) children.set(e.baby_id, [...(children.get(e.baby_id) ?? []), e]);
  const sessions = children.size <= 1 ? pairSessions(active)
    : [...children.values()].flatMap(pairSessions).sort((a, b) => anchor(a) - anchor(b) || (a.baby_id ?? "").localeCompare(b.baby_id ?? ""));
  const dutyEvent = [...ordered].reverse().find((e) => e.type === "duty" && status.get(e.id) === "active");
  return {
    baby,
    all: ordered.filter(mine),
    status,
    effective: own,
    duplicates: duplicates.filter((d) => ownIds.has(d.duplicate)),
    sessions,
    duty: dutyEvent ? { caregiver: (dutyEvent.fields.caregiver as string) ?? null, since: t(dutyEvent.occurred_at) } : null,
  };
}

function sessionKind(type: string): Session["kind"] | null {
  if (type.startsWith("feed.bottle")) return "bottle";
  if (type.startsWith("feed.breast")) return "breast";
  if (type.startsWith("sleep")) return "sleep";
  return null;
}

function num(v: FieldValue | undefined) {
  return typeof v === "number" ? v : undefined;
}

export function pairSessions(events: LogEvent[]): Session[] {
  const sessions: Session[] = [];
  const open = new Map<string, number>();
  for (const e of events) {
    const k = sessionKind(e.type);
    if (!k) continue;
    const at = t(e.occurred_at);
    if (e.type === "feed.bottle.single") {
      sessions.push({ kind: "bottle", baby_id: e.baby_id, start: at, end: at, startEvent: e.id, endEvent: e.id, sides: [],
        consumedFraction: num(e.fields.consumed_fraction), consumedMl: num(e.fields.consumed_ml), contents: e.fields.contents as string });
      continue;
    }
    const role = typeSpec(e.type)?.session?.role ?? "start";
    const i = open.get(k);
    if (role === "start") {
      if (i !== undefined) sessions[i].abandoned = true;
      sessions.push({ kind: k, baby_id: e.baby_id, start: at, startEvent: e.id, sides: e.fields.side ? [String(e.fields.side)] : [],
        contents: e.fields.contents as string | undefined });
      open.set(k, sessions.length - 1);
    } else if (role === "switch") {
      if (i !== undefined) {
        if (e.fields.side) sessions[i].sides.push(String(e.fields.side));
      } else {
        sessions.push({ kind: k, baby_id: e.baby_id, start: at, startEvent: e.id, sides: e.fields.side ? [String(e.fields.side)] : [] });
        open.set(k, sessions.length - 1);
      }
    } else {
      if (i !== undefined) {
        Object.assign(sessions[i], { end: at, endEvent: e.id, consumedFraction: num(e.fields.consumed_fraction), consumedMl: num(e.fields.consumed_ml) });
        open.delete(k);
      } else {
        sessions.push({ kind: k, baby_id: e.baby_id, end: at, endEvent: e.id, sides: [], consumedFraction: num(e.fields.consumed_fraction), consumedMl: num(e.fields.consumed_ml) });
      }
    }
  }
  return sessions;
}

const isOpen = (s: Session) => s.start !== undefined && s.end === undefined && !s.abandoned;
const anchor = (s: Session) => s.start ?? s.end ?? 0;

export interface Status {
  last_feed_at?: number;
  last_feed_kind?: string;
  open_feed_kind?: string;
  open_feed_since?: number;
  next_side?: string;
  sleeping_since?: number;
  last_diaper_at?: number;
  last_diaper_kind?: string;
  to_review: number;
  pending_captures: number;
  on_duty?: string | null;
}

export function status(d: Derived, opts: { pendingCaptures?: number; pendingPicks?: number } = {}): Status {
  const counted = d.effective.filter((e) => d.status.get(e.id) === "active");
  const feeds = d.sessions.filter((s) => s.kind !== "sleep");
  const lastFeedSession = feeds.reduce<Session | undefined>((m, s) => (!m || anchor(s) > anchor(m) ? s : m), undefined);
  let lastFeedAt = lastFeedSession ? anchor(lastFeedSession) : undefined;
  let lastFeedKind: string | undefined = lastFeedSession?.kind;
  const solids = [...counted].reverse().find((e) => e.type === "feed.solids");
  if (solids && t(solids.occurred_at) > (lastFeedAt ?? 0)) {
    lastFeedAt = t(solids.occurred_at);
    lastFeedKind = "solids";
  }
  const openFeed = [...d.sessions].reverse().find((s) => isOpen(s) && s.kind !== "sleep");
  const lastSide = d.sessions.filter((s) => s.kind === "breast").flatMap((s) => s.sides).at(-1);
  const sleep = [...d.sessions].reverse().find((s) => isOpen(s) && s.kind === "sleep");
  const diaper = [...counted].reverse().find((e) => e.type === "diaper");
  return {
    last_feed_at: lastFeedAt,
    last_feed_kind: lastFeedKind,
    open_feed_kind: openFeed?.kind,
    open_feed_since: openFeed?.start,
    next_side: lastSide === "left" ? "right" : lastSide === "right" ? "left" : undefined,
    sleeping_since: sleep?.start,
    last_diaper_at: diaper ? t(diaper.occurred_at) : undefined,
    last_diaper_kind: diaper?.fields.kind as string | undefined,
    to_review: d.duplicates.length + (opts.pendingPicks ?? 0),
    pending_captures: opts.pendingCaptures ?? 0,
    on_duty: d.duty?.caregiver,
  };
}

export function duration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days}d` : `${days}d${hours % 24}h`;
}

export const ago = (ms: number) => (ms < 60_000 ? "just now" : `${duration(ms)} ago`);

/** e.g. `Fed 2h40m ago · left next · diaper 1h10m ago` (identical to the Swift line). */
export function statusLine(s: Status, now: number): string {
  const parts: string[] = [];
  if (s.sleeping_since !== undefined) parts.push(`Sleeping ${duration(now - s.sleeping_since)}`);
  else if (s.open_feed_since !== undefined) parts.push(`Feeding ${duration(now - s.open_feed_since)}`);
  else if (s.last_feed_at !== undefined) parts.push(`Fed ${ago(now - s.last_feed_at)}`);
  else parts.push("No feeds yet");
  if (s.next_side) parts.push(`${s.next_side} next`);
  if (s.last_diaper_at !== undefined) parts.push(`diaper ${ago(now - s.last_diaper_at)}`);
  if (s.pending_captures > 0) parts.push(`${s.pending_captures} pending`);
  if (s.to_review > 0) parts.push(`${s.to_review} to review`);
  return parts.join(" · ");
}

const ALLOWED: Record<string, string[]> = {
  side: ["left", "right", "both"],
  contents: ["formula", "breast_milk"],
  kind: ["wet", "dirty", "both", "dry"],
  amount: ["taste", "some", "most", "all"],
  storage: ["fridge", "freezer", "fed"],
  reaction: ["none", "rash", "hives", "vomiting", "diarrhea", "gas", "spit_up"],
};

export interface ShiftSummary {
  caregiver: string | null;
  started_at: string;
  ended_at: string;
  feed_count: number;
  bottle_ml: number;
  wet_diapers: number;
  dirty_diapers: number;
  sleep_seconds: number;
  sleep_stretches: number;
  medications: { id: string; medicine: string; dose?: string; occurred_at: string }[];
  notes: { id: string; text: string; occurred_at: string; logged_by: string }[];
}

export function shiftSummary(d: Derived, bottleMlFor: (baby?: string) => number, now = Date.now()): ShiftSummary | null {
  const duties = d.all.filter((e) => e.type === "duty" && d.status.get(e.id) === "active").sort((a, b) => t(a.occurred_at) - t(b.occurred_at));
  if (duties.length === 0) return null;
  const startAt = duties.length >= 2 ? t(duties[duties.length - 2].occurred_at) : t(duties[duties.length - 1].occurred_at);
  const endAt = duties.length >= 2 ? t(duties[duties.length - 1].occurred_at) : now;
  const caregiver = ((duties.length >= 2 ? duties[duties.length - 2] : duties[duties.length - 1]).fields.caregiver as string | undefined) ?? null;
  const counted = d.effective.filter((e) => d.status.get(e.id) === "active");
  const inWindow = counted.filter((e) => t(e.occurred_at) >= startAt && t(e.occurred_at) <= endAt);
  const feedSessions = d.sessions.filter((s) => s.kind !== "sleep" && anchor(s) >= startAt && anchor(s) <= endAt);
  const solidsCount = inWindow.filter((e) => e.type === "feed.solids").length;
  const bottleMl = inWindow
    .filter((e) => e.type === "feed.bottle.finish" || e.type === "feed.bottle.single")
    .reduce((sum, e) => {
      const ml = typeof e.fields.consumed_ml === "number" ? e.fields.consumed_ml
        : typeof e.fields.consumed_fraction === "number" ? Math.round(e.fields.consumed_fraction * bottleMlFor(e.baby_id)) : 0;
      return sum + ml;
    }, 0);
  const diapers = inWindow.filter((e) => e.type === "diaper");
  const wetDiapers = diapers.filter((e) => e.fields.kind === "wet" || e.fields.kind === "both").length;
  const dirtyDiapers = diapers.filter((e) => e.fields.kind === "dirty" || e.fields.kind === "both").length;
  const sleepList = d.sessions.filter((s) => s.kind === "sleep" && (s.end ?? now) > startAt && (s.start ?? startAt) < endAt);
  const sleepSeconds = Math.round(
    sleepList.reduce((sum, s) => sum + Math.max(0, Math.min(s.end ?? now, endAt) - Math.max(s.start ?? startAt, startAt)) / 1000, 0),
  );
  const medications = inWindow
    .filter((e) => e.type === "medication")
    .map((e) => ({ id: e.id, medicine: String(e.fields.medicine ?? "Medication"), dose: e.fields.dose ? String(e.fields.dose) : undefined, occurred_at: e.occurred_at }));
  const notes = d.all
    .filter((e) => e.type === "note" && d.status.get(e.id) === "active" && t(e.occurred_at) >= startAt && t(e.occurred_at) <= endAt)
    .map((e) => ({ id: e.id, text: String(e.fields.transcript ?? e.provenance.raw_transcript ?? "").trim(), occurred_at: e.occurred_at, logged_by: e.logged_by }))
    .filter((n) => n.text.length > 0);
  return {
    caregiver,
    started_at: new Date(startAt).toISOString(),
    ended_at: new Date(endAt).toISOString(),
    feed_count: feedSessions.length + solidsCount,
    bottle_ml: bottleMl,
    wet_diapers: wetDiapers,
    dirty_diapers: dirtyDiapers,
    sleep_seconds: sleepSeconds,
    sleep_stretches: sleepList.length,
    medications,
    notes,
  };
}

export interface MilkStash {
  fridge_ml: number;
  freezer_ml: number;
  fridge_lots: number;
  freezer_bags: number;
  oldest_fridge_at: string | null;
  oldest_freezer_at: string | null;
}

export function milkStash(d: Derived, bottleMlFor: (baby?: string) => number): MilkStash {
  const fridge: { ml: number; at: string }[] = [];
  const freezer: { ml: number; at: string }[] = [];
  const startContents = new Map<string, string>();
  for (const s of d.sessions) {
    if (s.kind === "bottle" && s.endEvent && s.contents) startContents.set(s.endEvent, s.contents);
  }
  const counted = d.effective.filter((e) => d.status.get(e.id) === "active");
  for (const e of counted) {
    if (e.type === "pump") {
      const ml = typeof e.fields.amount_ml === "number" ? e.fields.amount_ml : bottleMlFor(e.baby_id);
      if (ml <= 0) continue;
      const storage = String(e.fields.storage ?? "fridge");
      if (storage === "freezer") {
        if (e.fields.from_fridge === true) {
          let rem = ml;
          while (rem > 0 && fridge.length > 0) {
            const take = Math.min(fridge[0].ml, rem);
            fridge[0].ml -= take;
            rem -= take;
            if (fridge[0].ml <= 0.1) fridge.shift();
          }
        }
        freezer.push({ ml, at: e.occurred_at });
      } else if (storage === "fridge") {
        fridge.push({ ml, at: e.occurred_at });
      }
    } else if (e.type === "feed.bottle.finish" || e.type === "feed.bottle.single") {
      const contents = (e.fields.contents as string | undefined) ?? startContents.get(e.id);
      if (contents !== "breast_milk") continue;
      let rem = typeof e.fields.consumed_ml === "number" ? e.fields.consumed_ml
        : typeof e.fields.consumed_fraction === "number" ? Math.round(e.fields.consumed_fraction * bottleMlFor(e.baby_id))
        : bottleMlFor(e.baby_id);
      while (rem > 0 && fridge.length > 0) {
        const take = Math.min(fridge[0].ml, rem);
        fridge[0].ml -= take;
        rem -= take;
        if (fridge[0].ml <= 0.1) fridge.shift();
      }
    }
  }
  return {
    fridge_ml: Math.round(fridge.reduce((s, l) => s + l.ml, 0)),
    freezer_ml: Math.round(freezer.reduce((s, l) => s + l.ml, 0)),
    fridge_lots: fridge.length,
    freezer_bags: freezer.length,
    oldest_fridge_at: fridge[0]?.at ?? null,
    oldest_freezer_at: freezer[0]?.at ?? null,
  };
}

/** Same validation rules as LogService.validate on the phone. Returns an error message or null. */
export function validate(type: string, fields: Record<string, FieldValue>, enabledCategories?: string[]): string | null {
  if (SYSTEM_TYPES.has(type)) return null;
  const spec = typeSpec(type);
  if (!spec) return `unknown type ${type}; use one of ${eventTypes.map((t) => t.id).join(", ")}`;
  if (enabledCategories && !enabledCategories.includes(spec.category)) return `${spec.category} logging is turned off for this household`;
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED[k] && !ALLOWED[k].includes(String(v))) return `invalid ${k}: ${v} (allowed: ${ALLOWED[k].join(", ")})`;
    if (k === "consumed_fraction" && !(typeof v === "number" && v > 0 && v <= 1)) return "consumed_fraction must be in (0, 1]";
    if (["consumed_ml", "amount_ml", "grams", "height_cm", "head_cm"].includes(k) && !(typeof v === "number" && v > 0)) return `${k} must be a positive number`;
  }
  if (type === "diaper" && fields.kind === undefined) return "diaper needs kind";
  if (type === "weight" && fields.grams === undefined) return "weight needs grams";
  if (type === "height" && fields.height_cm === undefined) return "height needs height_cm";
  if (type === "head" && fields.head_cm === undefined) return "head needs head_cm";
  for (const f of fieldSpecs(type)) {
    const v = fields[f.key];
    if (v === undefined) {
      if (f.required) return `${type} needs ${f.key}`;
      continue;
    }
    if (f.kind === "choice" && !f.options?.some((o) => o.key === v)) return `invalid ${f.key}: ${v} (allowed: ${f.options?.map((o) => o.key).join(", ")})`;
    if (f.kind === "number" && !(typeof v === "number" && v > 0)) return `${f.key} must be a positive number`;
    if (f.kind === "text" && !(typeof v === "string" && v.trim())) return `${f.key} must be non-empty text`;
  }
  return null;
}

/** A field of a type the spec describes field by field (`fields`; the tap-logged care, health and activity types). */
export interface FieldSpec {
  key: string;
  kind: "choice" | "number" | "text";
  required?: boolean;
  options?: { key: string; label: string }[];
  unit?: string;
  label?: string;
  presets?: number[];
}

export function fieldSpecs(type: string): FieldSpec[] {
  return ((typeSpec(type) as { fields?: FieldSpec[] } | undefined)?.fields ?? []) as FieldSpec[];
}
