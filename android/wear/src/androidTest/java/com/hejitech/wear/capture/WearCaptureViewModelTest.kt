package com.hejitech.wear.capture

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.hejitech.wear.data.WearServiceLocator
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Instrumented tests for WearCaptureViewModel's non-audio flows (sign-in,
 * confirmed-hours progress, and the pending-upload backlog) against the real
 * Firebase emulator suite via WearServiceLocator — no mocks, same
 * conventions as CoreFlowTest.kt (app module). Mic-recording paths
 * (startRecording/stopRecordingAndSend, which need a real, permission-
 * granted AudioRecord) are exercised instead through MainActivityFlowTest,
 * which can drive the actual runtime-permission dialog via UiAutomator —
 * this class only constructs the ViewModel directly, with no Activity/
 * permission grant behind it.
 *
 * Constructs a fresh WearCaptureViewModel per test (matching how the real
 * app gets a new one per Activity/composition) rather than sharing one
 * instance — its constructor reads WearServiceLocator singletons and its
 * initial isSignedIn snapshot at construction time, so a fresh instance is
 * needed after each @Before's signOut() to see the correct starting state.
 */
@RunWith(AndroidJUnit4::class)
class WearCaptureViewModelTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Before
    fun resetState() {
        Firebase.auth.signOut()
        clearFirestoreEmulatorData()
        File(context.filesDir, "pendingCaptures").listFiles()?.forEach { it.delete() }
        context.getSharedPreferences("upload_stats", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun initialState_beforeSignIn_isNotSignedIn() {
        val viewModel = WearCaptureViewModel()

        assertFalse(viewModel.uiState.value.isSignedIn)
    }

    @Test
    fun signIn_updatesUiStateSignedIn_andObservesConfirmedHoursFromFirestore() {
        val viewModel = WearCaptureViewModel()

        viewModel.signIn()
        waitUntil(timeoutMs = 15_000) { viewModel.uiState.value.isSignedIn }
        assertFalse(viewModel.uiState.value.isSigningIn)

        runBlocking {
            WearServiceLocator.entryRepository.createEntry(
                Entry(
                    propertyName = "Wear Test Property",
                    task = "Confirmed hours regression",
                    durationMinutes = 120,
                    status = EntryStatus.CONFIRMED.firestoreValue,
                )
            )
        }

        assertTrue(
            "confirmedHours should reach 2.0 once a 120-minute confirmed entry exists",
            waitUntil(timeoutMs = 10_000) { viewModel.uiState.value.confirmedHours == 2.0 },
        )
    }

    @Test
    fun uploadPendingNow_withNoPendingCaptures_isNoOp() {
        val viewModel = WearCaptureViewModel()
        viewModel.signIn()
        waitUntil(timeoutMs = 15_000) { viewModel.uiState.value.isSignedIn }

        viewModel.uploadPendingNow()

        assertFalse(viewModel.uiState.value.isUploadingPending)
        assertNull(viewModel.uiState.value.lastSavedSummary)
    }

    @Test
    fun uploadPendingNow_withPendingCapture_drainsBacklogAndReportsAllUploaded() {
        val viewModel = WearCaptureViewModel()
        viewModel.signIn()
        waitUntil(timeoutMs = 15_000) { viewModel.uiState.value.isSignedIn }

        WearServiceLocator.pendingCaptureStore.save(byteArrayOf(1, 2, 3))
        assertTrue(
            "pollUploadStats should pick up the seeded pending capture",
            waitUntil(timeoutMs = 6_000) { viewModel.uiState.value.pendingCount == 1 },
        )

        viewModel.uploadPendingNow()

        assertTrue(waitUntil(timeoutMs = 15_000) { viewModel.uiState.value.lastSavedSummary == "All uploaded" })
        assertEquals(0, viewModel.uiState.value.pendingCount)
        assertEquals(1, viewModel.uiState.value.uploadedTodayCount)
        assertFalse(viewModel.uiState.value.isUploadingPending)

        viewModel.dismissMessages()
        assertNull(viewModel.uiState.value.lastSavedSummary)
        assertNull(viewModel.uiState.value.errorMessage)
    }

    private fun waitUntil(timeoutMs: Long, condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return true
            Thread.sleep(150)
        }
        return condition()
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
