package com.hejitech.core.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.Timestamp
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.EntryStatus
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration tests for the voice start/stop work-timer flow against the
 * real Firestore emulator — see TimerEntryCoordinator's kdoc for the
 * invariant this exists to protect: at most one entry ever has
 * inProgress = true (isTrip = false) for a user, enforced here rather than
 * by a Firestore rule.
 */
@RunWith(AndroidJUnit4::class)
class TimerEntryCoordinatorTest {

    private val entryRepository = FirestoreEntryRepository(
        FirebaseEmulatorTestEnv.firestore,
        FirebaseEmulatorTestEnv.auth,
        FirebaseEmulatorTestEnv.storage,
    )
    private val coordinator = TimerEntryCoordinator(entryRepository)

    @Before
    fun setUp() = runBlocking {
        FirebaseEmulatorTestEnv.clearFirestoreEmulatorData()
        FirebaseEmulatorTestEnv.signIn()
    }

    @Test
    fun handleStart_thenHandleStop_closesTheSameEntryWithComputedDuration() = runBlocking {
        val startedAt = Timestamp(Timestamp.now().seconds - 30 * 60, 0) // 30 minutes ago
        val started = coordinator.handleStart(
            property = "Lakeview Cabin",
            task = "Cleaning turnover",
            category = null,
            source = CaptureSource.VOICE,
            startedAt = startedAt,
        )

        val openBeforeStop = entryRepository.findOpenEntry(isTrip = false)
        assertNotNull(openBeforeStop)
        assertEquals(started.entryId, openBeforeStop!!.id)
        assertTrue(openBeforeStop.inProgress)

        val stoppedAt = Timestamp.now()
        val stopped = coordinator.handleStop(null, null, stoppedAt, stopLat = 37.0, stopLng = -122.0)

        assertNotNull(stopped)
        assertEquals(started.entryId, stopped!!.entryId)
        // ~30 minutes elapsed — allow a small margin for real wall-clock time spent in this test.
        assertTrue("expected duration near 30 minutes, was ${stopped.durationMinutes}", stopped.durationMinutes in 29..31)

        val closed = entryRepository.getEntry(started.entryId)
        assertNotNull(closed)
        assertFalse(closed!!.inProgress)
        assertEquals(EntryStatus.CONFIRMED.firestoreValue, closed.status)
        assertNotNull(closed.confirmedAt)
        assertNotNull(closed.stoppedAt)
        assertEquals(stoppedAt.seconds, closed.stoppedAt!!.seconds)
        assertEquals(37.0, closed.stopLat!!, 0.000001)
        assertEquals(-122.0, closed.stopLng!!, 0.000001)

        assertNull(entryRepository.findOpenEntry(isTrip = false))

        entryRepository.deleteEntry(started.entryId)
    }

    @Test
    fun handleStop_withNothingOpen_returnsNull() = runBlocking {
        assertNull(coordinator.handleStop(null, null, Timestamp.now()))
    }

    /**
     * Starting a new timer while one is already open must auto-close the
     * previous one first (see TimerEntryCoordinator.handleStart's kdoc) —
     * a host can't honestly claim overlapping hours across two tasks, and
     * this is enforced here, not by a Firestore rule.
     */
    @Test
    fun handleStart_autoClosesA_previouslyOpenTimer() = runBlocking {
        val first = coordinator.handleStart("Property A", "Task A", null, CaptureSource.VOICE, Timestamp.now())
        val second = coordinator.handleStart("Property B", "Task B", null, CaptureSource.VOICE, Timestamp.now())

        val firstEntry = entryRepository.getEntry(first.entryId)
        assertNotNull(firstEntry)
        assertFalse(firstEntry!!.inProgress)

        val openNow = entryRepository.findOpenEntry(isTrip = false)
        assertNotNull(openNow)
        assertEquals(second.entryId, openNow!!.id)

        entryRepository.deleteEntries(listOf(first.entryId, second.entryId))
    }

    /** Incomplete data at stop time (no property/task ever supplied) must leave the entry PENDING_REVIEW, not silently CONFIRMED. */
    @Test
    fun handleStop_withNoPropertyOrTask_leavesEntryPendingReview() = runBlocking {
        val started = coordinator.handleStart(property = null, task = null, category = null, source = CaptureSource.VOICE, startedAt = Timestamp.now())

        coordinator.handleStop(property = null, task = null, stoppedAt = Timestamp.now())

        val closed = entryRepository.getEntry(started.entryId)
        assertNotNull(closed)
        assertEquals(EntryStatus.PENDING_REVIEW.firestoreValue, closed!!.status)
        assertNull(closed.confirmedAt)

        entryRepository.deleteEntry(started.entryId)
    }

    /**
     * A timer left open far beyond MAX_OPEN_TIMER_MINUTES (12h) is almost
     * certainly a forgotten "stop" — closeEntry caps the recorded duration
     * and flags it vague rather than trusting an implausible elapsed time.
     */
    @Test
    fun handleStop_afterExcessivelyLongElapsedTime_capsAndFlagsAsVague() = runBlocking {
        val startedAt = Timestamp(Timestamp.now().seconds - 20 * 60 * 60, 0) // 20 hours ago
        val started = coordinator.handleStart("Property", "Task", null, CaptureSource.VOICE, startedAt)

        val stopped = coordinator.handleStop("Property", "Task", Timestamp.now())

        assertNotNull(stopped)
        assertEquals(TimerEntryCoordinator.MAX_OPEN_TIMER_MINUTES, stopped!!.durationMinutes)

        val closed = entryRepository.getEntry(started.entryId)
        assertNotNull(closed)
        assertTrue("stale timer should be flagged vague", closed!!.isVague)
        assertTrue(closed.riskReasons.isNotEmpty())

        entryRepository.deleteEntry(started.entryId)
    }
}
