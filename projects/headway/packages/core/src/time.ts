// Pacific time without a date library: Caltrain's timetable, windows and alerts are all local.
// Works the same in the Worker, the Even app's WebView and Node (Intl with time zones).

export const TZ = "America/Los_Angeles";
const MIN = 60_000;

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
});
const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export interface Zoned {
  /** YYYYMMDD */
  date: string;
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  /** Minutes since local midnight. */
  minuteOfDay: number;
}

export function zoned(epochMs: number): Zoned {
  const p = Object.fromEntries(parts.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month), d = Number(p.day), h = Number(p.hour) % 24, mi = Number(p.minute);
  return { date: `${p.year}${p.month}${p.day}`, y, m, d, h, mi, weekday: WEEKDAY[p.weekday] ?? 0, minuteOfDay: h * 60 + mi };
}

/** Minutes the zone is ahead of UTC at that instant (−480 or −420). */
function offset(epochMs: number): number {
  const z = zoned(epochMs);
  const s = new Date(epochMs).getUTCSeconds();
  return Math.round((Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, s) - epochMs) / MIN);
}

/** The instant of a Pacific wall-clock time. */
export function zonedToEpoch(y: number, m: number, d: number, h: number, mi: number): number {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let t = wall - offset(wall) * MIN;
  t = wall - offset(t) * MIN;
  return t;
}

export function parseDate(date: string): { y: number; m: number; d: number } {
  return { y: Number(date.slice(0, 4)), m: Number(date.slice(4, 6)), d: Number(date.slice(6, 8)) };
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: string): number {
  const { y, m, d } = parseDate(date);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** GTFS times count from noon minus 12 hours (not midnight) so DST days still line up. */
export function serviceDayStart(date: string): number {
  const { y, m, d } = parseDate(date);
  return zonedToEpoch(y, m, d, 12, 0) - 12 * 60 * MIN;
}

/** "HH:MM" → minutes, or null. */
export function hhmm(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/** The instant of "HH:MM" on a local date. */
export function atLocal(date: string, time: string): number {
  const { y, m, d } = parseDate(date);
  const mins = hhmm(time) ?? 0;
  return zonedToEpoch(y, m, d, Math.floor(mins / 60), mins % 60);
}

/** "8:14" (12-hour, no suffix: the board's context says morning or evening). */
export function clock(epochMs: number): string {
  const z = zoned(epochMs);
  return `${z.h % 12 === 0 ? 12 : z.h % 12}:${String(z.mi).padStart(2, "0")}`;
}

/** "8:14 AM" */
export function clockAmPm(epochMs: number): string {
  return `${clock(epochMs)} ${zoned(epochMs).h < 12 ? "AM" : "PM"}`;
}

/** Whole minutes from `now` until `t` (rounded down, never below a minute's lateness). */
export function minutesUntil(t: number, now: number): number {
  return Math.floor((t - now) / MIN);
}
