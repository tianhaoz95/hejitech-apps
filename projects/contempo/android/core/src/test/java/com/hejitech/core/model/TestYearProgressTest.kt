package com.hejitech.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/** Same cases as iOS's TestYearProgressTests.swift, so the two apps can't drift apart. */
class TestYearProgressTest {
    private val zone = ZoneId.of("America/Los_Angeles")

    private fun at(year: Int, month: Int, day: Int, hour: Int = 12) =
        LocalDateTime.of(year, month, day, hour, 0).atZone(zone).toInstant()

    private fun entry(minutes: Int, year: Int, month: Int, day: Int, roleId: String = "", status: EntryStatus = EntryStatus.CONFIRMED, hour: Int = 12) =
        Entry(
            task = "Turnover",
            durationMinutes = minutes,
            status = status.firestoreValue,
            activityDate = Timestamp.fromInstant(at(year, month, day, hour)),
            roleId = roleId,
            roleName = if (roleId.isEmpty()) "" else "Cleaner",
        )

    @Test
    fun onlyThisYearsHoursCount() {
        val progress = TestYearProgress.compute(
            listOf(entry(100 * 60, 2026, 11, 5), entry(90, 2027, 1, 1)),
            now = at(2027, 1, 2), zone = zone,
        )
        assertEquals(2027, progress.year)
        assertEquals(1.5, progress.ownerHours, 1e-9)
        assertTrue(progress.pace != TestYearProgress.Pace.Met)
    }

    @Test
    fun newYearsEveLateNightStaysInTheOldYear() {
        val progress = TestYearProgress.compute(listOf(entry(60, 2026, 12, 31, hour = 23)), now = at(2026, 12, 31, 23), zone = zone)
        assertEquals(2026, progress.year)
        assertEquals(1.0, progress.ownerHours, 1e-9)
    }

    @Test
    fun otherRolesAndPendingEntriesDontCount() {
        val progress = TestYearProgress.compute(
            listOf(
                entry(120, 2026, 10, 1),
                entry(600, 2026, 10, 1, roleId = "role-1"),
                entry(300, 2026, 10, 1, status = EntryStatus.PENDING_REVIEW),
            ),
            now = at(2026, 10, 21), zone = zone,
        )
        assertEquals(2.0, progress.ownerHours, 1e-9)
    }

    @Test
    fun thresholdReachedIsMet() {
        val progress = TestYearProgress.compute(listOf(entry(100 * 60, 2026, 6, 1)), now = at(2026, 10, 21), zone = zone)
        assertEquals(TestYearProgress.Pace.Met, progress.pace)
    }

    @Test
    fun slowPaceAsksForWeeklyHours() {
        val progress = TestYearProgress.compute(listOf(entry(50 * 60, 2026, 7, 1)), now = at(2026, 10, 21), zone = zone)
        // 72 days from Oct 21 to Jan 1, 50 hours left.
        val pace = progress.pace as TestYearProgress.Pace.Behind
        assertEquals(50.0 / 72.0 * 7.0, pace.weeklyHoursNeeded, 1e-9)
    }

    @Test
    fun fastPaceProjectsAFinishDate() {
        val progress = TestYearProgress.compute(listOf(entry(80 * 60, 2026, 7, 1)), now = at(2026, 10, 21), zone = zone)
        assertEquals(TestYearProgress.Pace.OnPace(LocalDate.of(2026, 11, 19)), progress.pace)
    }

    @Test
    fun paceWindowHasAMinimum() {
        val progress = TestYearProgress.compute(listOf(entry(10 * 60, 2026, 3, 1)), now = at(2026, 3, 2), zone = zone)
        assertEquals(TestYearProgress.Pace.OnPace(LocalDate.of(2026, 7, 6)), progress.pace)
    }

    @Test
    fun noHoursYetAsksForWeeklyHours() {
        val progress = TestYearProgress.compute(emptyList(), now = at(2026, 1, 1), zone = zone)
        val pace = progress.pace as TestYearProgress.Pace.Behind
        assertEquals(100.0 / 365.0 * 7.0, pace.weeklyHoursNeeded, 1e-9)
    }
}
