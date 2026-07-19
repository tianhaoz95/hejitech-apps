package com.hejitech.wear.capture

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker.Result
import androidx.work.testing.TestListenableWorkerBuilder
import com.hejitech.wear.data.WearServiceLocator
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Instrumented test for PendingCaptureSyncWorker — the thin CoroutineWorker
 * shell around PendingCaptureSyncer.syncAll() (see its kdoc: both the
 * periodic 15-minute background fallback and the immediate expedited
 * post-recording attempt run through this same worker class). Uses
 * TestListenableWorkerBuilder rather than actually enqueuing through
 * WorkManager's scheduler — that machinery (constraints, backoff, periodic
 * timing) isn't this class's own logic to verify; PendingCaptureSyncerTest
 * already covers syncAll() itself in depth, so this only needs to confirm
 * the worker actually calls it and reports success.
 */
@RunWith(AndroidJUnit4::class)
class PendingCaptureSyncWorkerTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Before
    fun resetState(): Unit = runBlocking {
        Firebase.auth.signOut()
        clearFirestoreEmulatorData()
        File(context.filesDir, "pendingCaptures").listFiles()?.forEach { it.delete() }
        WearServiceLocator.authManager.signIn()
    }

    @Test
    fun doWork_withPendingBacklog_drainsItAndSucceeds() = runBlocking {
        WearServiceLocator.pendingCaptureStore.save(byteArrayOf(1, 2, 3))
        assertEquals(1, WearServiceLocator.pendingCaptureStore.listPending().size)

        val worker = TestListenableWorkerBuilder<PendingCaptureSyncWorker>(context).build()
        val result = worker.startWork().get()

        assertEquals(Result.success(), result)
        assertTrue(WearServiceLocator.pendingCaptureStore.listPending().isEmpty())
        assertEquals(1, WearServiceLocator.audioCaptureQueue.listPending().size)
    }

    @Test
    fun doWork_withEmptyBacklog_stillSucceeds() {
        val worker = TestListenableWorkerBuilder<PendingCaptureSyncWorker>(context).build()

        val result = worker.startWork().get()

        assertEquals(Result.success(), result)
    }

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
