package com.hejitech.core.data

import com.google.firebase.Timestamp
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.WeekFields
import java.util.Date

/**
 * ISO-8601 week id ("GGGG-Www", e.g. "2026-W33") for the current instant,
 * computed in UTC so every device + the backend agree on which week "now"
 * falls in regardless of local timezone. `WeekFields.ISO` is Monday-start,
 * week 1 = the week containing the year's first Thursday — the same rule
 * iOS's `Calendar(identifier: .iso8601)` and the backend's hand-rolled TS
 * helper (`backend/functions/src/tokenUsage.ts`) both implement, so all
 * three should agree; verified against ISO week-1 boundary dates as part of
 * this feature's rollout rather than assumed.
 */
fun currentIsoWeekId(): String {
    val today = LocalDate.now(ZoneOffset.UTC)
    val weekFields = WeekFields.ISO
    val year = today.get(weekFields.weekBasedYear())
    val week = today.get(weekFields.weekOfWeekBasedYear())
    return "%04d-W%02d".format(year, week)
}

/** Monday 00:00 UTC of the ISO week containing now — stored alongside the counters so Settings can show "week of ...". */
fun currentIsoWeekStart(): Timestamp {
    val today = LocalDate.now(ZoneOffset.UTC)
    val monday = today.with(WeekFields.ISO.dayOfWeek(), 1L)
    return Timestamp(Date.from(monday.atStartOfDay(ZoneOffset.UTC).toInstant()))
}
