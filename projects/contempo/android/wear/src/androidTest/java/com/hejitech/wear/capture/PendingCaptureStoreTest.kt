package com.hejitech.wear.capture

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Instrumented tests for PendingCaptureStore — a plain Context/File-backed
 * durable queue, no Firebase involved. Runs against the real app's
 * filesDir/pendingCaptures directory (same as production), wiped in @Before
 * so leftovers from a previous run/manual testing session on this device
 * never leak between tests — same isolation approach CoreFlowTest.kt (app
 * module) uses for Firestore via clearFirestoreEmulatorData().
 */
@RunWith(AndroidJUnit4::class)
class PendingCaptureStoreTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val store = PendingCaptureStore(context)

    @Before
    fun clearPendingCapturesDir() {
        File(context.filesDir, "pendingCaptures").listFiles()?.forEach { it.delete() }
    }

    @Test
    fun save_thenListPending_roundTripsBytesAndId() {
        val bytes = byteArrayOf(1, 2, 3, 4, 5)
        val saved = store.save(bytes)

        val pending = store.listPending()
        assertEquals(1, pending.size)
        assertEquals(saved.id, pending.first().id)
        assertTrue(pending.first().file.readBytes().contentEquals(bytes))
    }

    @Test
    fun save_withLocation_roundTripsLatLngThroughSidecar() {
        store.save(byteArrayOf(9), lat = 37.7749, lng = -122.4194)

        val capture = store.listPending().first()
        assertEquals(37.7749, capture.lat!!, 0.000001)
        assertEquals(-122.4194, capture.lng!!, 0.000001)
    }

    @Test
    fun save_withNoLocation_leavesLatLngNull() {
        store.save(byteArrayOf(9))

        val capture = store.listPending().first()
        assertNull(capture.lat)
        assertNull(capture.lng)
    }

    @Test
    fun listPending_ordersOldestFirst_regardlessOfSaveOrder() {
        val newest = store.save(byteArrayOf(3))
        val oldest = store.save(byteArrayOf(1))
        val middle = store.save(byteArrayOf(2))

        // File.lastModified() granularity can be coarser than the
        // microseconds between these three save() calls on some
        // filesystems — force distinct, deliberately out-of-save-order
        // timestamps so the sort under test is exercised for real rather
        // than accidentally passing because the saves already landed in
        // order.
        val now = System.currentTimeMillis()
        oldest.file.setLastModified(now - 20_000)
        middle.file.setLastModified(now - 10_000)
        newest.file.setLastModified(now)

        val pending = store.listPending()
        assertEquals(listOf(oldest.id, middle.id, newest.id), pending.map { it.id })
    }

    @Test
    fun delete_removesWavAndSidecarFromDisk_andFromListPending() {
        val saved = store.save(byteArrayOf(7), lat = 1.0, lng = 2.0)
        val sidecarBeforeDelete = File(File(context.filesDir, "pendingCaptures"), "${saved.id}.meta.json")
        assertTrue(sidecarBeforeDelete.exists())

        store.delete(saved)

        assertTrue(store.listPending().isEmpty())
        assertTrue(!saved.file.exists())
        assertTrue(!sidecarBeforeDelete.exists())
    }

    @Test
    fun listPending_onEmptyStore_returnsEmptyList() {
        assertTrue(store.listPending().isEmpty())
    }
}
