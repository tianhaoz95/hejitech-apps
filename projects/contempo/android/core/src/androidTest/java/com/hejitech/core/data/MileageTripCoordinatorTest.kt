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
 * Integration tests for the odometer-photo/GPS mileage-trip flow against the
 * real Firestore emulator — structurally parallel to
 * TimerEntryCoordinatorTest, scoped by isTrip = true instead.
 */
@RunWith(AndroidJUnit4::class)
class MileageTripCoordinatorTest {

    private val entryRepository = FirestoreEntryRepository(
        FirebaseEmulatorTestEnv.firestore,
        FirebaseEmulatorTestEnv.auth,
        FirebaseEmulatorTestEnv.storage,
    )
    private val coordinator = MileageTripCoordinator(entryRepository)

    @Before
    fun setUp() = runBlocking {
        FirebaseEmulatorTestEnv.clearFirestoreEmulatorData()
        FirebaseEmulatorTestEnv.signIn()
    }

    @Test
    fun handleStartTrip_thenHandleEndTrip_computesMilesFromOdometerDiff() = runBlocking {
        val started = coordinator.handleStartTrip(
            property = "Lakeview Cabin",
            task = "Supply run",
            category = null,
            source = CaptureSource.MANUAL,
            startedAt = Timestamp.now(),
            captureMethod = "photo",
            odometerStart = 10_000.0,
        )

        val ended = coordinator.handleEndTrip(
            endedAt = Timestamp.now(),
            captureMethod = "photo",
            odometerEnd = 10_042.5,
        )

        assertNotNull(ended)
        assertEquals(started.entryId, ended!!.entryId)
        assertEquals(42.5, ended.miles, 0.001)

        val closed = entryRepository.getEntry(started.entryId)
        assertNotNull(closed)
        assertFalse(closed!!.inProgress)
        assertEquals(EntryStatus.CONFIRMED.firestoreValue, closed.status)
        assertEquals(10_000.0, closed.odometerStart!!, 0.001)
        assertEquals(10_042.5, closed.odometerEnd!!, 0.001)

        entryRepository.deleteEntry(started.entryId)
    }

    /** A GPS trip's directMiles (continuously accumulated) wins over any odometer-diff computation — see closeTrip's kdoc. */
    @Test
    fun handleEndTrip_withDirectMiles_winsOverOdometerDiff() = runBlocking {
        val started = coordinator.handleStartTrip(
            property = "Property",
            task = "Driving to hardware store",
            category = null,
            source = CaptureSource.MANUAL,
            startedAt = Timestamp.now(),
            captureMethod = "gps",
            startLat = 37.0,
            startLng = -122.0,
        )

        val ended = coordinator.handleEndTrip(
            endedAt = Timestamp.now(),
            captureMethod = "gps",
            endLat = 37.1,
            endLng = -122.1,
            directMiles = 12.34,
        )

        assertNotNull(ended)
        assertEquals(12.34, ended!!.miles, 0.001)

        entryRepository.deleteEntry(started.entryId)
    }

    @Test
    fun handleEndTrip_withNothingOpen_returnsNull() = runBlocking {
        assertNull(coordinator.handleEndTrip(endedAt = Timestamp.now(), captureMethod = "gps"))
    }

    /**
     * Starting a new trip while one is already open auto-closes the previous
     * one as "abandoned" (no mileage data to close it with) rather than
     * leaving two trips open simultaneously — see handleStartTrip's kdoc.
     */
    @Test
    fun handleStartTrip_autoClosesA_previouslyOpenTrip_asAbandoned() = runBlocking {
        val first = coordinator.handleStartTrip(
            property = "Property A", task = "Trip A", category = null,
            source = CaptureSource.MANUAL, startedAt = Timestamp.now(), captureMethod = "gps",
        )
        val second = coordinator.handleStartTrip(
            property = "Property B", task = "Trip B", category = null,
            source = CaptureSource.MANUAL, startedAt = Timestamp.now(), captureMethod = "gps",
        )

        val firstEntry = entryRepository.getEntry(first.entryId)
        assertNotNull(firstEntry)
        assertFalse(firstEntry!!.inProgress)
        assertTrue("abandoned trip should be flagged vague", firstEntry.isVague)
        assertTrue(firstEntry.riskReasons.isNotEmpty())
        assertEquals(EntryStatus.PENDING_REVIEW.firestoreValue, firstEntry.status)

        val openNow = entryRepository.findOpenEntry(isTrip = true)
        assertNotNull(openNow)
        assertEquals(second.entryId, openNow!!.id)

        entryRepository.deleteEntries(listOf(first.entryId, second.entryId))
    }

    /** A live checkpoint updates miles on the open trip without closing it — used on every GPS location fix. */
    @Test
    fun updateTripDistance_checkpointsWithoutClosingTheTrip() = runBlocking {
        val started = coordinator.handleStartTrip(
            property = "Property", task = "Task", category = null,
            source = CaptureSource.MANUAL, startedAt = Timestamp.now(), captureMethod = "gps",
        )

        coordinator.updateTripDistance(5.0)
        coordinator.updateTripDistance(9.5)

        val stillOpen = entryRepository.findOpenEntry(isTrip = true)
        assertNotNull(stillOpen)
        assertEquals(started.entryId, stillOpen!!.id)
        assertTrue(stillOpen.inProgress)
        assertEquals(9.5, stillOpen.miles, 0.001)

        entryRepository.deleteEntry(started.entryId)
    }

    /** A checkpoint arriving after the trip already ended (e.g. a queued location fix) must be a no-op, not resurrect/corrupt a closed entry. */
    @Test
    fun updateTripDistance_afterTripAlreadyEnded_isANoOp() = runBlocking {
        val started = coordinator.handleStartTrip(
            property = "Property", task = "Task", category = null,
            source = CaptureSource.MANUAL, startedAt = Timestamp.now(), captureMethod = "gps",
        )
        coordinator.handleEndTrip(endedAt = Timestamp.now(), captureMethod = "gps", directMiles = 3.0)

        coordinator.updateTripDistance(999.0)

        val closed = entryRepository.getEntry(started.entryId)
        assertNotNull(closed)
        assertFalse(closed!!.inProgress)
        assertEquals(3.0, closed.miles, 0.001)

        entryRepository.deleteEntry(started.entryId)
    }
}
