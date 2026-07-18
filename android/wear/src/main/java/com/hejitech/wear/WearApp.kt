package com.hejitech.wear

import android.app.Application
import com.hejitech.wear.capture.PendingCaptureSyncWorker
import com.hejitech.wear.data.WearServiceLocator
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.memoryCacheSettings
import com.google.firebase.initialize
import com.google.firebase.storage.storage
import java.util.concurrent.TimeUnit

/**
 * Mirrors ContempoApp.kt's emulator wiring (same reasoning: talks to
 * "localhost" on the assumption `adb reverse` is already set up — see
 * scripts/run-android-with-emulators.sh, which reverses ports for whichever
 * device serial it's given, watch or phone). Trimmed to just the services
 * this module actually uses (no on-device LLM).
 */
class WearApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)

        if (BuildConfig.USE_FIREBASE_EMULATOR) {
            connectToEmulators()
            // See ContempoApp.kt's onCreate for why no App Check provider is
            // installed in debug builds.
        } else {
            Firebase.appCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }

        WearServiceLocator.initialize(this)
        schedulePendingCaptureSync()
    }

    /**
     * Without this, a recording made while the phone was unreachable would
     * only sync the next time the user happened to reopen the watch app —
     * see PendingCaptureSyncWorker's kdoc. KEEP (not REPLACE) so re-creating
     * the Application object (e.g. after a process restart) doesn't reset
     * the schedule's timing.
     */
    private fun schedulePendingCaptureSync() {
        val request = PeriodicWorkRequestBuilder<PendingCaptureSyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this)
            .enqueueUniquePeriodicWork("pending-capture-sync", ExistingPeriodicWorkPolicy.KEEP, request)
    }

    private fun connectToEmulators() {
        val host = EMULATOR_HOST
        Firebase.auth.useEmulator(host, 9099)
        Firebase.firestore.useEmulator(host, 8080)
        Firebase.firestore.firestoreSettings = firestoreSettings {
            setLocalCacheSettings(memoryCacheSettings {})
        }
        // Genuinely used now (audio upload), unlike before when Storage was
        // only obtained for FirestoreEntryRepository's unused attachPhoto.
        Firebase.storage.useEmulator(host, 9199)
    }

    companion object {
        private const val EMULATOR_HOST = "localhost"
    }
}
