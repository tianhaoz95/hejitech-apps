package com.hejitech.core.data

import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.memoryCacheSettings
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await
import java.net.HttpURLConnection
import java.net.URL

/**
 * Shared Firebase-emulator harness for core's androidTest suite. Mirrors the
 * app module's real emulator wiring (ContempoApp.connectToEmulators, the
 * fake-identity Google-Sign-In JSON from AuthManager.fakeEmulatorIdToken,
 * memory-only Firestore cache) but built by hand: this module has no
 * google-services.json of its own (only app/wear apply the google-services
 * plugin), so FirebaseOptions are constructed directly here instead of read
 * from a generated resource. Uses the same "contempo-str" project id
 * app/src/androidTest/CoreFlowTest.kt already assumes for its emulator REST
 * calls — the values below are never sent to a real backend (useEmulator is
 * called before any use), only used to address the local emulator suite.
 *
 * Requires the Firebase emulator suite running and adb-reversed to the
 * device under test (see scripts/run-android-with-emulators.sh) — same
 * assumption every other emulator-backed test in this repo already makes.
 */
object FirebaseEmulatorTestEnv {
    private const val PROJECT_ID = "contempo-str"
    private const val EMULATOR_HOST = "localhost"

    private val app: FirebaseApp by lazy {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        FirebaseApp.getApps(context).firstOrNull()
            ?: FirebaseApp.initializeApp(
                context,
                FirebaseOptions.Builder()
                    .setProjectId(PROJECT_ID)
                    .setApplicationId("1:000000000000:android:0000000000000000")
                    .setApiKey("test-api-key")
                    .setStorageBucket("$PROJECT_ID.appspot.com")
                    .build(),
            )
    }

    val firestore: FirebaseFirestore by lazy {
        FirebaseFirestore.getInstance(app).apply {
            useEmulator(EMULATOR_HOST, 8080)
            // Disk-persisted cache would otherwise survive across test runs
            // and resurrect documents wiped server-side via clearEmulatorData's
            // REST call — same reasoning as ContempoApp.connectToEmulators.
            firestoreSettings = firestoreSettings { setLocalCacheSettings(memoryCacheSettings {}) }
        }
    }

    val auth: FirebaseAuth by lazy {
        FirebaseAuth.getInstance(app).apply { useEmulator(EMULATOR_HOST, 9099) }
    }

    val storage: FirebaseStorage by lazy {
        FirebaseStorage.getInstance(app).apply { useEmulator(EMULATOR_HOST, 9199) }
    }

    /**
     * Same fake-identity JSON as AuthManager.fakeEmulatorIdToken() — the
     * emulator never verifies it, and the stable "sub" gives every test run
     * the same uid, so Firestore security rules (ownership-only) are
     * exercised the same way the real app exercises them.
     */
    suspend fun signIn() {
        if (auth.currentUser != null) return
        val idToken = """{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"""
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential).await()
    }

    /** Best-effort — a failed clear (e.g. a fresh/empty emulator) shouldn't fail the test. Same REST endpoint CoreFlowTest.kt already uses. */
    fun clearFirestoreEmulatorData() {
        runCatching {
            val url = URL("http://$EMULATOR_HOST:8080/emulator/v1/projects/$PROJECT_ID/databases/(default)/documents")
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
