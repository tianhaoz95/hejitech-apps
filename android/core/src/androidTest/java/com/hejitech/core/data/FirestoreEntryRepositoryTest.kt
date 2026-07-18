package com.hejitech.core.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.Timestamp
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
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
 * Integration tests for FirestoreEntryRepository against the real Firestore
 * emulator — deliberately not mocked, since the bugs this suite exists to
 * catch are round-tripping bugs through Firestore's actual reflection-based
 * (de)serialization, which a mock can't reproduce. Requires the Firebase
 * emulator suite running and adb-reversed to the device under test (see
 * scripts/run-android-with-emulators.sh), same as CoreFlowTest.kt in the app
 * module.
 *
 * Most load-bearing case: [isTrip]-style Kotlin Boolean properties silently
 * deserializing to false without an explicit @PropertyName annotation (see
 * Entry.kt's kdoc on isTrip) — isVague/isBackfilled were suspected to still
 * have this bug unfixed; see roundTrip_isVagueAndIsBackfilled_surviveThroughFirestore.
 */
@RunWith(AndroidJUnit4::class)
class FirestoreEntryRepositoryTest {

    private val repository = FirestoreEntryRepository(
        FirebaseEmulatorTestEnv.firestore,
        FirebaseEmulatorTestEnv.auth,
        FirebaseEmulatorTestEnv.storage,
    )

    @Before
    fun setUp() = runBlocking {
        FirebaseEmulatorTestEnv.clearFirestoreEmulatorData()
        FirebaseEmulatorTestEnv.signIn()
    }

    @Test
    fun createGetUpdateDelete_roundTripsExactly() = runBlocking {
        val original = Entry(
            propertyName = "Maple Cottage",
            task = "Cleaned the pool",
            durationMinutes = 45,
            source = CaptureSource.MANUAL.firestoreValue,
        )
        val id = repository.createEntry(original)

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertEquals("Maple Cottage", fetched!!.propertyName)
        assertEquals("Cleaned the pool", fetched.task)
        assertEquals(45, fetched.durationMinutes)
        assertEquals(id, fetched.id)

        repository.updateEntry(id, fetched.copy(durationMinutes = 60))
        assertEquals(60, repository.getEntry(id)!!.durationMinutes)

        repository.deleteEntry(id)
        assertNull(repository.getEntry(id))
    }

    /**
     * Regression test for the Kotlin-Boolean-property Firestore bug (see
     * Entry.kt kdoc on isTrip, which already carries the @get:PropertyName/
     * @set:PropertyName fix). isVague and isBackfilled are declared as plain
     * `val`, not `var` with those annotations — if Firestore's reflection
     * mapper strips their "is" prefix on write (isVague -> "vague") but does
     * NOT symmetrically strip it on read back (the exact failure mode
     * documented for isTrip), these would silently deserialize to false
     * regardless of what was actually stored, corrupting every risk-flag
     * read on this audit-record app.
     */
    @Test
    fun roundTrip_isVagueAndIsBackfilled_surviveThroughFirestore() = runBlocking {
        val entry = Entry(
            task = "Vague/backfilled regression check",
            isVague = true,
            isBackfilled = true,
            daysLate = 5,
        )
        val id = repository.createEntry(entry)

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertTrue("isVague should round-trip as true, not silently deserialize to false", fetched!!.isVague)
        assertTrue("isBackfilled should round-trip as true, not silently deserialize to false", fetched.isBackfilled)

        repository.deleteEntry(id)
    }

    /** Companion check: false must also round-trip as false (not e.g. always-true from a broken mapping in the other direction). */
    @Test
    fun roundTrip_isVagueAndIsBackfilled_falseStaysFalse() = runBlocking {
        val entry = Entry(task = "Not vague, not backfilled", isVague = false, isBackfilled = false)
        val id = repository.createEntry(entry)

        val fetched = repository.getEntry(id)
        assertFalse(fetched!!.isVague)
        assertFalse(fetched.isBackfilled)

        repository.deleteEntry(id)
    }

    @Test
    fun roundTrip_isTrip_surviveThroughFirestore() = runBlocking {
        val entry = Entry(task = "Trip check", isTrip = true, inProgress = true)
        val id = repository.createEntry(entry)

        val fetched = repository.getEntry(id)
        assertTrue("isTrip should round-trip as true", fetched!!.isTrip)

        repository.deleteEntry(id)
    }

    /** findOpenEntry must be scoped by isTrip so a work timer and a mileage trip can be open at the same time without colliding. */
    @Test
    fun findOpenEntry_scopesByIsTrip_independently() = runBlocking {
        val timerEntry = Entry(task = "Open timer", inProgress = true, isTrip = false)
        val tripEntry = Entry(task = "Open trip", inProgress = true, isTrip = true)
        val timerId = repository.createEntry(timerEntry)
        val tripId = repository.createEntry(tripEntry)

        val openTimer = repository.findOpenEntry(isTrip = false)
        val openTrip = repository.findOpenEntry(isTrip = true)

        assertNotNull(openTimer)
        assertEquals(timerId, openTimer!!.id)
        assertNotNull(openTrip)
        assertEquals(tripId, openTrip!!.id)

        repository.deleteEntries(listOf(timerId, tripId))
    }

    @Test
    fun findOpenEntry_returnsNull_whenNothingOpen() = runBlocking {
        assertNull(repository.findOpenEntry(isTrip = false))
        assertNull(repository.findOpenEntry(isTrip = true))
    }

    @Test
    fun deleteEntries_removesEveryEntryInTheList() = runBlocking {
        val ids = (1..5).map { i -> repository.createEntry(Entry(task = "Bulk delete candidate $i")) }

        repository.deleteEntries(ids)

        ids.forEach { id -> assertNull("Entry $id should have been deleted", repository.getEntry(id)) }
    }

    /**
     * newEntryId allocates with zero network calls, so a caller can commit to
     * an id up front and retry a failed write as an idempotent updateEntry
     * (via .set()) rather than risking a duplicate document from a second
     * createEntry call — see ConfirmViewModel.resolvedEntryId. This confirms
     * that pre-allocated id actually works as a real document id via set().
     */
    @Test
    fun newEntryId_thenUpdateEntry_createsDocumentAtThatExactId() = runBlocking {
        val id = repository.newEntryId()
        assertNull("A freshly allocated id should not already exist", repository.getEntry(id))

        repository.updateEntry(id, Entry(task = "Created via pre-allocated id"))

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertEquals(id, fetched!!.id)
        assertEquals("Created via pre-allocated id", fetched.task)

        repository.deleteEntry(id)
    }

    @Test
    fun stoppedAtAndStopLatLng_roundTripThroughFirestore() = runBlocking {
        // Regression test for this session's Quick-Complete feature (see
        // TimerEntryCoordinator.handleStop/CaptureViewModel.completeOpenTimer):
        // these are plain nullable fields, no Boolean-getter quirk involved,
        // but worth locking in given they're brand new.
        val stoppedAt = Timestamp.now()
        val entry = Entry(
            task = "Stop time/location check",
            status = EntryStatus.CONFIRMED.firestoreValue,
            stoppedAt = stoppedAt,
            stopLat = 37.3999578,
            stopLng = -122.0158063,
        )
        val id = repository.createEntry(entry)

        val fetched = repository.getEntry(id)
        assertNotNull(fetched)
        assertEquals(stoppedAt.seconds, fetched!!.stoppedAt!!.seconds)
        assertEquals(37.3999578, fetched.stopLat!!, 0.000001)
        assertEquals(-122.0158063, fetched.stopLng!!, 0.000001)

        repository.deleteEntry(id)
    }
}
