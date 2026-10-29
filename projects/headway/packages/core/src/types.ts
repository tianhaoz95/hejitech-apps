// Shared shapes: the compiled timetable, a live snapshot of Caltrain's realtime feeds, a user's
// settings, and the boards every surface (glasses, iPhone, web, MCP, alert engine) shows.

export type ServiceKind = "LOC" | "LTD" | "EXP" | "SCC";
export type ExpressPreference = "all" | "prefer_express" | "express_only";
/** N = toward San Francisco, S = toward San Jose / Gilroy. */
export type Direction = "N" | "S";

export interface Station {
  /** Stable id used by the API and saved settings, e.g. `mountain_view`. */
  id: string;
  name: string;
  /** Upper-case name for the glasses, ≤ 11 characters. */
  short: string;
  /** GTFS platform stop ids (northbound, southbound): realtime updates refer to these. */
  nb: string | null;
  sb: string | null;
  lat: number;
  lon: number;
}

export interface ServiceCalendar {
  /** Monday … Sunday. */
  days: number[];
  start: string | null;
  end: string | null;
  add: string[];
  remove: string[];
}

export interface Trip {
  id: string;
  train: string;
  kind: ServiceKind;
  svc: string;
  dir: Direction;
  /** Flat [stationIndex, arrivalMin, departureMin, …] in travel order; minutes after the service day's start. */
  stops: number[];
}

export interface Timetable {
  source: string;
  feed_version: string;
  feed_start: string;
  feed_end: string;
  stations: Station[];
  services: Record<string, ServiceCalendar>;
  trips: Trip[];
}

// ---------------------------------------------------------------- realtime

export interface RealtimeStop {
  /** Predicted times, epoch seconds. */
  arr?: number;
  dep?: number;
  /** Seconds late (negative: early). */
  delay?: number;
  skipped?: boolean;
}

export interface RealtimeTrip {
  cancelled?: boolean;
  /** Trip-level delay, seconds. */
  delay?: number;
  start_date?: string;
  /** Keyed by GTFS platform stop id. */
  stops: Record<string, RealtimeStop>;
}

export interface ServiceAlert {
  id: string;
  header: string;
  description: string;
  url?: string;
  /** Active period, epoch seconds (absent: open-ended). */
  start?: number;
  end?: number;
  /** Station ids it names; empty with `routes` empty: the whole system. */
  stations: string[];
  routes: string[];
  effect?: string;
}

export interface RealtimeSnapshot {
  /** When the Worker fetched it (epoch ms). */
  fetched_at: number;
  /** The feed's own timestamp (epoch seconds), when it had one. */
  feed_ts: number | null;
  trips: Record<string, RealtimeTrip>;
  alerts: ServiceAlert[];
}

// ---------------------------------------------------------------- settings

export interface Leg {
  from: string;
  to: string;
  /** Minutes from door to platform: the leave-now reminder fires this long before departure. */
  walk_minutes: number;
  /** The train you usually take, "HH:MM": the first train at or after it gets the leave-now reminder. */
  usual: string | null;
  /** When to watch this leg for alerts, "HH:MM" Pacific. */
  window: { start: string; end: string };
  /** Train filter/preference for this leg: all (default), prefer_express, or express_only. */
  express_preference?: ExpressPreference;
}

export interface AlertSettings {
  delay: boolean;
  /** Minutes late before a delay alert. */
  delay_threshold: number;
  cancellation: boolean;
  service: boolean;
  leave_now: boolean;
  arrival: boolean;
  /** Minutes before arriving at the tracked train's stop. */
  arrival_minutes: number;
  /** Alert when a later-departing train arrives sooner (overtakes your train). */
  better_train: boolean;
}

export interface Settings {
  morning: Leg | null;
  evening: Leg | null;
  /** Before this time ("HH:MM") the morning leg is the default view, after it the evening one. */
  switch_at: string;
  /** Days the legs are watched for alerts, 0 = Monday … 6 = Sunday. */
  days: number[];
  alerts: AlertSettings;
  /** Global default train filter/preference: all (default), prefer_express, or express_only. */
  express_preference?: ExpressPreference;
  /** Optional first name shown on shared live ETA pages (e.g. "Sam"). Max 20 chars. */
  share_name?: string | null;
}

// ---------------------------------------------------------------- boards

export type TrainStatus = "on_time" | "late" | "early" | "cancelled" | "scheduled";

export type CatchState = "later" | "leave" | "run" | "missed";

export interface BoardTrain {
  trip_id: string;
  train: string;
  kind: ServiceKind;
  dir: Direction;
  /** Service day, YYYYMMDD (trains after midnight belong to the day before). */
  service_date: string;
  /** Scheduled and predicted departure (from) and arrival (to), epoch ms. */
  dep: number;
  arr: number;
  pred_dep: number;
  pred_arr: number;
  /** Minutes late at the departure station; null when there's no live data for this train. */
  delay_min: number | null;
  status: TrainStatus;
  /** Stops between from and to, excluding both. */
  stops_between: number;
  /** When to walk out the door: pred_dep - (walk_minutes * 60_000). Set when board has walk_minutes. */
  leave_by?: number | null;
  /** Catch state relative to departure and walk time. */
  catch?: CatchState | null;
  /** Ride duration in minutes: (pred_arr - pred_dep) / 60_000. */
  ride_min?: number | null;
  /** Trip id of a later-departing train that arrives sooner, if overtaken. */
  overtaken_by?: string | null;
  /** Train number of the overtaker (e.g. "511"), if overtaken. */
  overtaken_by_train?: string | null;
  /** True if this train is the earliest predicted arrival among visible trains. */
  first_in?: boolean | null;
  /** True if this train has the shortest ride among visible non-cancelled trains. */
  shortest?: boolean | null;
}

export type LegName = "morning" | "evening" | "custom";

export interface BoardTip {
  wait_for: string;
  wait_for_kind: ServiceKind;
  wait_for_dep: number;
  wait_for_arr: number;
  instead_of: string;
  instead_of_arr: number;
  saves_min: number;
}

export interface Board {
  from: Pick<Station, "id" | "name" | "short">;
  to: Pick<Station, "id" | "name" | "short">;
  leg: LegName;
  /** epoch ms */
  generated_at: number;
  /** Live data was fresh when this board was made (otherwise every time is the timetable's). */
  live: boolean;
  trains: BoardTrain[];
  alerts: ServiceAlert[];
  /** Train filter/preference applied to this board: all, prefer_express, or express_only. */
  express_preference?: ExpressPreference;
  /** Walk time in minutes to the departure station for this commute leg. */
  walk_minutes?: number | null;
  /** Faster train recommendation when your next train is overtaken. */
  tip?: BoardTip | null;
}

/** A train someone follows on board, from the glasses or the iPhone: arrival alerts and the track view. */
export interface Tracked {
  trip_id: string;
  service_date: string;
  from: string;
  to: string;
}

export interface TrainProgress {
  trip_id: string;
  train: string;
  kind: ServiceKind;
  dir: Direction;
  service_date: string;
  to: Pick<Station, "id" | "name" | "short">;
  /** Next station the train hasn't left yet (null once it reached `to`). */
  next: { id: string; name: string; short: string; pred: number } | null;
  pred_arr: number;
  arr: number;
  delay_min: number | null;
  stops_left: number;
  cancelled: boolean;
  arrived: boolean;
  live: boolean;
}

/** One train on the "next trains" Live Activity (Lock Screen / Dynamic Island). */
export interface BoardActivityTrain {
  train: string;
  kind: ServiceKind;
  /** Predicted departure and arrival, epoch ms. */
  dep: number;
  arr: number;
  delay_min: number | null;
  cancelled: boolean;
}

/** ActivityKit content state of BoardActivityAttributes; pushed by the cron, mirrored in HeadwayKit. */
export interface BoardActivityState {
  trains: BoardActivityTrain[];
  live: boolean;
}
