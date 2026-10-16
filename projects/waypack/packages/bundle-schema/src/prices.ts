// Price history and booking-timing signals (DECISIONS #67). Prices enter as snapshots the agent
// or user recorded (no scraping); the verdict is rule-based, deterministic and cites the snapshots
// it used. The server computes it when a price is recorded and when a trip is published, and embeds
// it in the manifest: bundles run offline, so pages only display `booking_signal`, never compute it.
import type { BookingSignal, BookingStatus, Manifest, Place, PriceSnapshot } from "./types.js";

export const BOOKING_STATUSES: BookingStatus[] = ["unbooked", "held", "booked"];

/** Signal thresholds (v1). */
export const PRICE_RULES = { deadlineDays: 7, trendPct: 5, proximityDays: 21 } as const;

/** A place is price-tracked once it has `price_snapshots` (even empty) or a `booking_status`. */
export function isTracked(p: Place): boolean {
  return Array.isArray(p.price_snapshots) || p.booking_status !== undefined;
}

// ------------------------------------------------------------------ deadlines

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const CUE = "(?:ends?|ending|expires?|expiring|until|thru|through|book by|deadline|last day)(?:\\s+on)?:?\\s+";
const DEADLINE_RES: { re: RegExp; parse: (m: RegExpExecArray) => [number | null, number, number] }[] = [
  // ends 2026-10-11
  { re: new RegExp(`${CUE}(\\d{4})-(\\d{2})-(\\d{2})`, "i"), parse: (m) => [+m[1], +m[2], +m[3]] },
  // ends Oct 11 / ends October 11, 2026 / ends Oct. 11th
  { re: new RegExp(`${CUE}${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"), parse: (m) => [m[3] ? +m[3] : null, monthOf(m[1]), +m[2]] },
  // ends 11 Oct / ends 11 October 2026
  { re: new RegExp(`${CUE}(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}(?:,?\\s+(\\d{4}))?\\b`, "i"), parse: (m) => [m[3] ? +m[3] : null, monthOf(m[2]), +m[1]] },
  // ends 10/11 or 10/11/2026 (US month/day)
  { re: new RegExp(`${CUE}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}))?\\b`, "i"), parse: (m) => [m[3] ? +m[3] : null, +m[1], +m[2]] },
];
const monthOf = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;

/**
 * Finds a promo/sale deadline in a snapshot note. Accepted forms: a cue word (ends, ends on,
 * expires, until, through, book by, deadline, last day) followed by `YYYY-MM-DD`, `Oct 11`,
 * `October 11, 2026`, `11 Oct` or `10/11[/2026]`. Without a year, the first such date on or after
 * the day it was observed (`fromDate`, YYYY-MM-DD).
 */
export function parseDeadline(note: string | undefined, fromDate: string): string | null {
  if (!note) return null;
  for (const { re, parse } of DEADLINE_RES) {
    const m = re.exec(note);
    if (!m) continue;
    const [y, mo, d] = parse(m);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    let year = y ?? +fromDate.slice(0, 4);
    let iso = ymd(year, mo, d);
    if (!isRealDate(iso)) continue;
    if (y === null && iso < fromDate) {
      year++;
      iso = ymd(year, mo, d);
    }
    return iso;
  }
  return null;
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function isRealDate(s: string): boolean {
  const t = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
}

// ------------------------------------------------------------------ privacy

const CODE_RE = /\b(?:confirmation|confirm|conf|booking|reservation|res|record locator|locator|pnr|itinerary|ticket|order)(?:\s*(?:number|no\.?|num|code|id|ref(?:erence)?|#))?\s*[:#.]?\s*#?([A-Z0-9][A-Z0-9-]{3,})/gi;

/** Why a price note can't go in a bundle (a booking code or card number), or null. */
export function privateDetailReason(text: string | undefined): string | null {
  if (!text) return null;
  for (const m of text.matchAll(CODE_RE)) if (/\d/.test(m[1])) return "it looks like a confirmation/booking number";
  if (/\b(?:\d[ -]?){13,19}\b/.test(text)) return "it looks like a card number";
  if (/\b(?:card|visa|mastercard|amex)\b[^.]{0,20}\b(?:ending|ends)\s+(?:in\s+)?\d{4}\b/i.test(text)) return "it mentions a payment card";
  return null;
}

// ------------------------------------------------------------------ signals

/** Today's date (YYYY-MM-DD) in the trip's time zone. */
export function localDate(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}`;
};
const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Change from the first observation to the latest, in percent (one decimal). */
export function priceChangePct(first: number, latest: number): number {
  return Math.round(((latest - first) / first) * 1000) / 10;
}

export interface TripDates { start_date: string; end_date: string; timezone: string }

/**
 * The booking verdict for one place (v1 rules, spec §5). Precedence: completed trip / already
 * booked → none; mixed currencies → none; a deadline within 7 days → book_now; a ≥ 5% move since
 * the first observation → book_soon (up) or good_time (down); the trip starting within 21 days →
 * book_soon; otherwise stable. Undefined for places that aren't tracked.
 */
export function computeBookingSignal(p: Place, trip: TripDates, now: Date = new Date()): BookingSignal | undefined {
  if (!isTracked(p)) return undefined;
  const today = localDate(now, trip.timezone);
  const computed_at = now.toISOString();
  const signal = (verdict: BookingSignal["verdict"], reason: string): BookingSignal => ({ verdict, reason, computed_at });

  if (trip.end_date < today) return signal("none", "Trip completed.");
  const status = p.booking_status ?? "unbooked";
  if (status === "booked") return signal("none", "Already booked.");
  if (status === "held") return signal("none", "Already held.");

  const snaps = (p.price_snapshots ?? [])
    .filter((s) => s && typeof s.amount === "number" && s.amount > 0 && !Number.isNaN(Date.parse(s.observed_at)))
    .map((s) => ({ ...s, currency: s.currency ?? "USD", day: localDate(new Date(s.observed_at), trip.timezone), t: Date.parse(s.observed_at) }))
    .sort((a, b) => a.t - b.t);
  const untilStart = dayDiff(today, trip.start_date);
  const soon = untilStart <= PRICE_RULES.proximityDays;
  const startText = untilStart > 0 ? `Trip starts ${inDays(untilStart)} (${shortDate(trip.start_date)})` : "The trip has started";

  if (!snaps.length) {
    return soon ? signal("book_soon", `${startText} and this isn't booked; no prices recorded yet.`) : signal("none", "No prices recorded yet.");
  }
  const currencies = [...new Set(snaps.map((s) => s.currency))];
  if (currencies.length > 1) return signal("none", `Mixed currencies (${currencies.join(", ")}) — can't compare.`);

  const first = snaps[0];
  const latest = snaps[snaps.length - 1];
  const money = (s: (typeof snaps)[number]) => formatMoney(s.amount, s.currency);
  const at = (s: (typeof snaps)[number]) => `${money(s)} on ${shortDate(s.day)}${s.source ? ` (${s.source})` : ""}`;
  const single = snaps.length === 1;
  const pct = priceChangePct(first.amount, latest.amount);
  const compared = `${money(latest)} on ${shortDate(latest.day)} vs ${money(first)} first seen ${shortDate(first.day)}`;
  const trendText = single
    ? `Only one observation so far: ${at(first)}.`
    : `${compared} (${pct > 0 ? "+" : ""}${pct}%, ${snaps.length} observations).`;

  // The most recent note that names a deadline wins (a later check may show an extended promo).
  let deadline: { date: string; snap: (typeof snaps)[number] } | null = null;
  for (const s of snaps) {
    const d = parseDeadline(s.note, s.day);
    if (d) deadline = { date: d, snap: s };
  }
  const daysLeft = deadline ? dayDiff(today, deadline.date) : null;
  if (deadline && daysLeft !== null && daysLeft >= 0 && daysLeft <= PRICE_RULES.deadlineDays) {
    return signal("book_now", `Deadline ${shortDate(deadline.date)} (${inDays(daysLeft)}), noted on ${shortDate(deadline.snap.day)}: "${deadline.snap.note}". ${trendText}`);
  }
  const ended = deadline && daysLeft !== null && daysLeft < 0 ? ` The deadline noted on ${shortDate(deadline.snap.day)} (${shortDate(deadline.date)}) has passed.` : "";

  if (!single && pct >= PRICE_RULES.trendPct) return signal("book_soon", `Price up ${pct}% since ${shortDate(first.day)}: ${compared} (${snaps.length} observations).${ended}`);
  if (!single && pct <= -PRICE_RULES.trendPct) return signal("good_time", `Price down ${Math.abs(pct)}% since ${shortDate(first.day)}: ${compared} (${snaps.length} observations).${ended}`);
  if (soon) return signal("book_soon", `${startText} and this isn't booked. ${trendText}${ended}`);
  return signal("stable", `${single ? "" : `Within ±${PRICE_RULES.trendPct}%: `}${trendText}${ended}${deadline ? "" : " No deadline noted."}`);
}

/** Recomputes `booking_signal` for every tracked place. Returns a new manifest. */
export function applyBookingSignals<M extends Manifest>(m: M, now: Date = new Date()): M {
  return {
    ...m,
    places: m.places.map((p) => {
      const signal = computeBookingSignal(p, m, now);
      if (signal) return { ...p, booking_signal: signal };
      const { booking_signal: _drop, ...rest } = p;
      return rest;
    }),
  };
}

export type { BookingSignal, BookingStatus, PriceSnapshot };
