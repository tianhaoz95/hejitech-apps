// Times and the market calendar (PRD §6, §6.5). Everything is stored and exchanged as UTC ISO-8601;
// people see Pacific (the owner) and Eastern (the market) side by side, never a bare time.
//
// The calendar is a table of NYSE full holidays and 1 p.m. early closes. Past its last year the
// market counts as closed (`calendarKnown` is false) so nothing executes on a guess: extend the
// table every year (docs/decisions.md).

export const OWNER_TZ = "America/Los_Angeles";
export const MARKET_TZ = "America/New_York";

/** Last date the tables below cover. */
export const CALENDAR_THROUGH = "2027-12-31";

/** NYSE full-day closures (observed dates). */
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** Sessions that close at 1:00 p.m. ET. */
export const NYSE_EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

export const iso = (d: Date) => d.toISOString();

/** Wall-clock parts of `d` in `tz`. */
export function zoned(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
    hour: Number(get("hour")), minute: Number(get("minute")), second: Number(get("second")), weekday: get("weekday"),
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** The UTC instant at wall-clock `ymd hh:mm` in `tz`. */
export function wallToUtc(ymd: string, hour: number, minute: number, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, hour, minute);
  // Two passes settle any offset, DST changes included.
  for (let i = 0; i < 2; i++) {
    const z = zoned(new Date(guess), tz);
    const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
    guess += Date.UTC(y, m - 1, d, hour, minute) - asUtc;
  }
  return new Date(guess);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The market's (Eastern) date of an instant. */
export const marketDate = (d: Date) => zoned(d, MARKET_TZ).ymd;

export function calendarKnown(ymd: string): boolean {
  return ymd >= "2026-01-01" && ymd <= CALENDAR_THROUGH;
}

export function isTradingDay(ymd: string): boolean {
  if (!calendarKnown(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow !== 0 && dow !== 6 && !NYSE_HOLIDAYS.has(ymd);
}

export interface Session {
  date: string;
  open: Date;
  close: Date;
  early: boolean;
}

/** The regular session (9:30–16:00 ET, 13:00 on early closes) of a market date, or null. */
export function regularSession(ymd: string): Session | null {
  if (!isTradingDay(ymd)) return null;
  const early = NYSE_EARLY_CLOSES.has(ymd);
  return { date: ymd, open: wallToUtc(ymd, 9, 30, MARKET_TZ), close: wallToUtc(ymd, early ? 13 : 16, 0, MARKET_TZ), early };
}

/** Extended hours as Robinhood offers them: 7:00–9:30 and close–20:00 ET on trading days. */
export function extendedWindow(ymd: string): { start: Date; end: Date } | null {
  if (!isTradingDay(ymd)) return null;
  return { start: wallToUtc(ymd, 7, 0, MARKET_TZ), end: wallToUtc(ymd, 20, 0, MARKET_TZ) };
}

export function inRegularHours(now: Date): boolean {
  const s = regularSession(marketDate(now));
  return !!s && now >= s.open && now < s.close;
}

export function inExtendedHours(now: Date): boolean {
  const w = extendedWindow(marketDate(now));
  return !!w && now >= w.start && now < w.end && !inRegularHours(now);
}

/** The next regular session whose close is after `now` (today's if it hasn't closed), or null past the calendar. */
export function nextSessionClosingAfter(now: Date): Session | null {
  let ymd = marketDate(now);
  for (let i = 0; i < 15 && calendarKnown(ymd); i++, ymd = addDays(ymd, 1)) {
    const s = regularSession(ymd);
    if (s && s.close > now) return s;
  }
  return null;
}

/** The UI's suggested `valid_until`: the close of the current (or next) trading day, ET. */
export function suggestedValidUntil(now: Date): Date | null {
  return nextSessionClosingAfter(now)?.close ?? null;
}

const fmt = (tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const PT = fmt(OWNER_TZ);
const ET = fmt(MARKET_TZ);

/** "Oct 29, 2026, 1:00 PM PDT · 4:00 PM EDT": both clocks, each with its zone. */
export function ptEt(when: string | Date): string {
  const d = typeof when === "string" ? new Date(when) : when;
  if (Number.isNaN(d.getTime())) return "—";
  const et = ET.format(d).replace(/^[A-Za-z]{3} \d{1,2}, \d{4}, /, "");
  return `${PT.format(d)} · ${et}`;
}

/** "3h 12m", "2d 4h", "45s". */
export function span(ms: number): string {
  const s = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

/** "valid for 3h 12m", "expired 2h ago", "starts in 20m". */
export function validity(validFrom: string | null, validUntil: string | null, now: Date): string {
  if (!validUntil) return "no validity window";
  const until = new Date(validUntil).getTime();
  if (validFrom && new Date(validFrom).getTime() > now.getTime()) return `starts in ${span(new Date(validFrom).getTime() - now.getTime())}`;
  return until > now.getTime() ? `valid for ${span(until - now.getTime())}` : `expired ${span(now.getTime() - until)} ago`;
}
