package com.hejitech.core.data

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.Timestamp
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration tests for the watch/phone Quick-Capture processing queue
 * against the real Firestore emulator — see AudioCaptureQueue's kdoc. The
 * ordering guarantee (oldest capturedAt first) is the one real invariant
 * AudioCaptureProcessor depends on: a backlog must drain in the order it was
 * actually spoken, not insertion/write order.
 */
@RunWith(AndroidJUnit4::class)
class AudioCaptureQueueTest {

    private val queue = AudioCaptureQueue(FirebaseEmulatorTestEnv.firestore, FirebaseEmulatorTestEnv.auth)

    @Before
    fun setUp() = runBlocking {
        FirebaseEmulatorTestEnv.clearFirestoreEmulatorData()
        FirebaseEmulatorTestEnv.signIn()
    }

    @Test
    fun enqueue_thenListPending_roundTripsAllFields() = runBlocking {
        val capturedAt = Timestamp.now()
        val id = queue.enqueue("users/uid/audioCaptures/test.wav", capturedAt, 37.0, -122.0)

        val pending = queue.listPending()
        assertEquals(1, pending.size)
        val capture = pending.first()
        assertEquals(id, capture.id)
        assertEquals("users/uid/audioCaptures/test.wav", capture.storagePath)
        assertEquals(capturedAt.seconds, capture.capturedAt.seconds)
        assertEquals(37.0, capture.lat!!, 0.000001)
        assertEquals(-122.0, capture.lng!!, 0.000001)
    }

    @Test
    fun enqueue_withNoLocation_leavesLatLngNull() = runBlocking {
        queue.enqueue("users/uid/audioCaptures/no-location.wav", Timestamp.now(), null, null)

        val capture = queue.listPending().first()
        assertNull(capture.lat)
        assertNull(capture.lng)
    }

    @Test
    fun listPending_ordersOldestCapturedAtFirst_regardlessOfEnqueueOrder() = runBlocking {
        val now = Timestamp.now()
        val oldest = Timestamp(now.seconds - 3600, 0)
        val middle = Timestamp(now.seconds - 1800, 0)
        val newest = now

        // Enqueue deliberately out of chronological order.
        queue.enqueue("path/middle.wav", middle, null, null)
        queue.enqueue("path/newest.wav", newest, null, null)
        queue.enqueue("path/oldest.wav", oldest, null, null)

        val pending = queue.listPending()
        assertEquals(3, pending.size)
        assertEquals("path/oldest.wav", pending[0].storagePath)
        assertEquals("path/middle.wav", pending[1].storagePath)
        assertEquals("path/newest.wav", pending[2].storagePath)
    }

    @Test
    fun remove_deletesOnlyThatCapture() = runBlocking {
        val keepId = queue.enqueue("path/keep.wav", Timestamp.now(), null, null)
        val removeId = queue.enqueue("path/remove.wav", Timestamp.now(), null, null)

        queue.remove(removeId)

        val remaining = queue.listPending()
        assertEquals(1, remaining.size)
        assertEquals(keepId, remaining.first().id)
        assertTrue(remaining.none { it.id == removeId })
    }

    @Test
    fun listPending_onEmptyQueue_returnsEmptyList() = runBlocking {
        assertEquals(0, queue.listPending().size)
    }
}
