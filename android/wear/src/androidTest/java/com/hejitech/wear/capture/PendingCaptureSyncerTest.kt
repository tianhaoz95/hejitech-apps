package com.hejitech.wear.capture

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.hejitech.wear.data.WearServiceLocator
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.storage.storage
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Integration tests for PendingCaptureSyncer against the real Firebase
 * Storage + Firestore emulators — deliberately not mocked, since what this
 * class exists to get right (upload -> enqueue -> only then delete locally,
 * in that order) is precisely the kind of multi-service sequencing a mock
 * can't meaningfully verify. Requires the Firebase emulator suite running
 * and adb-reversed to the device under test.
 */
@RunWith(AndroidJUnit4::class)
class PendingCaptureSyncerTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val pendingCaptureStore get() = WearServiceLocator.pendingCaptureStore
    private val audioCaptureQueue get() = WearServiceLocator.audioCaptureQueue
    private val uploadStatsStore get() = WearServiceLocator.uploadStatsStore

    @Before
    fun resetState(): Unit = runBlocking {
        Firebase.auth.signOut()
        clearFirestoreEmulatorData()
        File(context.filesDir, "pendingCaptures").listFiles()?.forEach { it.delete() }
        context.getSharedPreferences("upload_stats", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun syncOne_uploadsEnqueuesDeletesLocallyAndRecordsStat() = runBlocking {
        WearServiceLocator.authManager.signIn()
        val wavBytes = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8)
        val pending = pendingCaptureStore.save(wavBytes, lat = 10.0, lng = 20.0)

        val result = PendingCaptureSyncer.syncOne(pending)

        assertTrue(result)
        assertTrue(pendingCaptureStore.listPending().isEmpty())

        val queued = audioCaptureQueue.listPending()
        assertEquals(1, queued.size)
        val uid = Firebase.auth.currentUser!!.uid
        val expectedPath = "users/$uid/audioCaptures/${pending.id}.wav"
        assertEquals(expectedPath, queued.first().storagePath)
        assertEquals(10.0, queued.first().lat!!, 0.000001)
        assertEquals(20.0, queued.first().lng!!, 0.000001)

        val downloaded = Firebase.storage.reference.child(expectedPath).getBytes(1024L * 1024).await()
        assertTrue(downloaded.contentEquals(wavBytes))

        assertEquals(1, uploadStatsStore.getUploadedTodayCount())
    }

    @Test
    fun syncOne_whenSignedOut_returnsFalseAndKeepsLocalCapture() = runBlocking {
        // Deliberately no sign-in — mirrors a capture recorded, then synced
        // before the watch ever authenticated (or after a sign-out).
        val pending = pendingCaptureStore.save(byteArrayOf(1))

        val result = PendingCaptureSyncer.syncOne(pending)

        assertFalse(result)
        assertEquals(1, pendingCaptureStore.listPending().size)
        assertEquals(0, uploadStatsStore.getUploadedTodayCount())
    }

    @Test
    fun syncAll_drainsEveryPendingCapture() = runBlocking {
        WearServiceLocator.authManager.signIn()
        repeat(3) { pendingCaptureStore.save(byteArrayOf(it.toByte())) }
        assertEquals(3, pendingCaptureStore.listPending().size)

        PendingCaptureSyncer.syncAll()

        assertTrue(pendingCaptureStore.listPending().isEmpty())
        assertEquals(3, audioCaptureQueue.listPending().size)
        assertEquals(3, uploadStatsStore.getUploadedTodayCount())
    }

    @Test
    fun syncAll_onEmptyBacklog_isNoOp() = runBlocking {
        WearServiceLocator.authManager.signIn()

        PendingCaptureSyncer.syncAll()

        assertTrue(audioCaptureQueue.listPending().isEmpty())
        assertEquals(0, uploadStatsStore.getUploadedTodayCount())
    }

    /** Best-effort — a failed clear (e.g. fresh/empty emulator) shouldn't fail the test. Same REST endpoint CoreFlowTest.kt/AudioCaptureQueueTest.kt already use. */
    private fun clearFirestoreEmulatorData() {
        runCatching {
            val url = URL("http://localhost:8080/emulator/v1/projects/contempo-platform/databases/(default)/documents")
            (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "DELETE"
                connectTimeout = 5_000
                connect()
                responseCode
                disconnect()
            }
        }
    }
}
