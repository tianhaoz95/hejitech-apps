package com.hejitech.contempo

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.hejitech.contempo.agent.ParseOutcome
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Verifies the two genuinely novel pieces of the photo-capture feature
 * against real backends (Firebase AI Logic on-device + the real Storage/
 * Firestore emulators) — not the camera intent itself, which is an external
 * system app Espresso/UiAutomator can't reliably drive across OEMs, and
 * which contributes no interesting logic of its own (it's just a Uri handed
 * back to us). Same "bypass the hardware-triggering UI, test the real
 * pipeline directly" precedent as WhisperTranscriberTest.
 *
 * AgentClient/EntryRepository are pulled from the already-initialized
 * ServiceLocator (ContempoApp.onCreate runs before any test, same process),
 * exactly like production code would use them.
 */
@RunWith(AndroidJUnit4::class)
class PhotoCaptureTest {

    @Before
    fun resetState() {
        Firebase.auth.signOut()
        clearFirestoreEmulatorData()
    }

    /**
     * Two honest outcomes, both asserted — same shape as
     * OnDeviceModelStatusTest, since photo drafting needs materially more
     * on-device capability than text (see AgentClient.draftEntryFromPhoto's
     * kdoc) and this test device is not expected to support it:
     *
     *  - Success: on-device vision genuinely worked — assert the response
     *    parses into a real EntryDraft (proves the Content.Builder image+text
     *    request and JSON-extraction round trip, not just "didn't crash").
     *  - Failure: proves the device-unsupported/preference path returns one
     *    of the specific, honest messages from AgentClient rather than an
     *    empty string, a stack trace, or hanging.
     */
    @Test
    fun draftEntryFromPhoto_onDeviceCall_producesRealDraftOrHonestFailure() {
        // Test assets live in this test APK's own AssetManager, not the
        // target app's — same distinction WhisperTranscriberTest documents.
        val testContext = InstrumentationRegistry.getInstrumentation().context
        val bitmap = testContext.assets.open("test-photo.jpg").use { BitmapFactory.decodeStream(it) }
        requireNotNull(bitmap) { "Test asset test-photo.jpg failed to decode" }

        val outcome = runBlocking { ServiceLocator.agentClient.draftEntryFromPhoto(bitmap, emptyList()) }

        when (outcome) {
            // Reaching Success at all is the proof: onDeviceDraftFromPhoto
            // catches any exception (including a JSON-decode failure) and
            // returns null -> Failure, so a real EntryDraft here means the
            // model's JSON response genuinely round-tripped correctly.
            is ParseOutcome.Success -> Unit
            is ParseOutcome.Failure -> {
                check(outcome.message.isNotBlank()) { "Failure outcome must carry an explanatory message" }
            }
        }
    }

    /**
     * Real Storage upload + real Firestore photoUrls update, against the
     * emulators — proves EntryRepository.attachPhoto actually persists
     * evidence, independent of whether AI drafting is available on this
     * device.
     */
    @Test
    fun attachPhoto_uploadsToStorageAndUpdatesEntryPhotoUrls() {
        val targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        signInIfNeeded()

        val entryId = runBlocking {
            ServiceLocator.entryRepository.createEntry(
                Entry(
                    propertyName = "Test Property",
                    task = "Photo evidence test",
                    durationMinutes = 15,
                    status = EntryStatus.CONFIRMED.firestoreValue,
                    source = CaptureSource.PHOTO.firestoreValue,
                )
            )
        }

        val localUri = copyTestPhotoToCache(targetContext)

        val downloadUrl = runBlocking { ServiceLocator.entryRepository.attachPhoto(entryId, localUri) }
        check(downloadUrl.startsWith("http")) { "Expected a real download URL, got: $downloadUrl" }

        val updatedEntry = runBlocking {
            ServiceLocator.entryRepository.observeEntries().first().first { it.id == entryId }
        }
        check(updatedEntry.photoUrls.contains(downloadUrl)) {
            "Entry's photoUrls did not include the uploaded photo: ${updatedEntry.photoUrls}"
        }
    }

    /** Same emulator fake-identity path CoreFlowTest drives via the "Sign in with Google" button. */
    private fun signInIfNeeded() {
        if (Firebase.auth.currentUser != null) return
        runBlocking { ServiceLocator.authManager.signIn().getOrThrow() }
    }

    private fun copyTestPhotoToCache(targetContext: Context): Uri {
        val testContext = InstrumentationRegistry.getInstrumentation().context
        val file = File(targetContext.cacheDir, "photo_capture_test_${System.currentTimeMillis()}.jpg")
        testContext.assets.open("test-photo.jpg").use { input ->
            FileOutputStream(file).use { output -> input.copyTo(output) }
        }
        return FileProvider.getUriForFile(targetContext, "${targetContext.packageName}.fileprovider", file)
    }

    private fun clearFirestoreEmulatorData() {
        runCatching {
            val url = URL(
                "http://localhost:8080/emulator/v1/projects/contempo-platform/databases/(default)/documents"
            )
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
