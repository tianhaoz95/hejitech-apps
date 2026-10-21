package com.hejitech.core.model

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.math.ceil

/**
 * The owner's progress toward [MaterialParticipationTest] for the current tax year.
 *
 * The 100-hour/500-hour tests are annual: only hours whose *activity* falls in the tax year
 * (the calendar year, in the device's time zone) count, so a host who logged 100 hours last
 * year starts this year at zero. Mirrors iOS's `TestYearProgress.swift` and the web's
 * `testYearProgress` (services/web/src/lib/metrics.ts).
 */
data class TestYearProgress(
    val year: Int,
    /** The owner's confirmed hours with activity in [year]. */
    val ownerHours: Double,
    val pace: Pace,
) {
    sealed interface Pace {
        /** The year's hours already reach the threshold. */
        data object Met : Pace

        /** At the pace so far, the threshold is reached on [finish] (before the year ends). */
        data class OnPace(val finish: LocalDate) : Pace

        /** The pace so far (or no hours yet) misses the year end; this many hours a week from today reach the threshold by Dec 31. */
        data class Behind(val weeklyHoursNeeded: Double) : Pace
    }

    companion object {
        /** The pace is measured over at least this many days, so one long entry yesterday doesn't project the whole test done in a few weeks. */
        const val MINIMUM_PACE_WINDOW_DAYS = 14

        fun isInYear(entry: Entry, year: Int, zone: ZoneId = ZoneId.systemDefault()): Boolean =
            entry.activityDate.toLocalDate(zone).year == year

        fun compute(
            entries: List<Entry>,
            thresholdHours: Int = MaterialParticipationTest.THRESHOLD_HOURS,
            now: Instant = Instant.now(),
            zone: ZoneId = ZoneId.systemDefault(),
        ): TestYearProgress {
            val today = now.atZone(zone).toLocalDate()
            val year = today.year
            val counted = entries.filter {
                it.statusEnum == EntryStatus.CONFIRMED && it.isOwnerHours && isInYear(it, year, zone)
            }
            val hours = counted.sumOf { it.durationMinutes } / 60.0
            val threshold = thresholdHours.toDouble()
            if (hours >= threshold) return TestYearProgress(year, hours, Pace.Met)

            val remaining = threshold - hours
            val daysLeft = maxOf(1L, ChronoUnit.DAYS.between(today, LocalDate.of(year + 1, 1, 1)))

            val first = counted.minOfOrNull { it.activityDate.toLocalDate(zone) }
            if (first != null && hours > 0) {
                val firstDay = minOf(first, today)
                val window = maxOf(MINIMUM_PACE_WINDOW_DAYS.toLong(), ChronoUnit.DAYS.between(firstDay, today) + 1)
                val daysNeeded = ceil(remaining / (hours / window)).toLong()
                if (daysNeeded < daysLeft) return TestYearProgress(year, hours, Pace.OnPace(today.plusDays(daysNeeded)))
            }
            return TestYearProgress(year, hours, Pace.Behind(remaining / daysLeft * 7))
        }

        private fun Timestamp.toLocalDate(zone: ZoneId): LocalDate = toInstant().atZone(zone).toLocalDate()
    }
}
