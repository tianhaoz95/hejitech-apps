package com.hejitech.contempo

import android.app.Application
import com.hejitech.contempo.capture.PendingCaptureSyncWorker
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.timer.OngoingWorkNotificationService
import com.hejitech.contempo.wear.PendingAudioProcessWorker
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.auth.auth
import com.google.firebase.crashlytics.crashlytics
import com.google.firebase.perf.performance
import com.google.firebase.firestore.firestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.memoryCacheSettings
import com.google.firebase.functions.functions
import com.google.firebase.initialize
import com.google.firebase.storage.storage
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Emulator wiring lives here, gated by BuildConfig.USE_FIREBASE_EMULATOR
 * (true for debug builds — see app/build.gradle.kts). Talks to "localhost"
 * on the assumption that whatever launched the app has already run
 * `adb reverse tcp:PORT tcp:PORT` for each emulator port — that's what maps
 * the device/emulator's own "localhost" back to the host machine's, and
 * works identically for the AVD and a physical device over USB (see
 * scripts/run-android-with-emulators.sh).
 */
class ContempoApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)

        // Off for local/emulator dev builds so that dev-machine crashes and
        // the known emulator-only flakiness (see AuthAwareFlow.kt's kdoc)
        // don't pollute the real crash console — same "only the real path
        // talks to real backend services" split as the App Check branch
        // right below.
        Firebase.crashlytics.setCrashlyticsCollectionEnabled(!BuildConfig.USE_FIREBASE_EMULATOR)
        // Same reasoning — dev-loop traces (against a local emulator, on
        // whatever machine happens to be running it) aren't representative
        // of real device/network performance and would just muddy the real
        // trace data. See PerformanceTrace.kt for the actual custom traces.
        Firebase.performance.isPerformanceCollectionEnabled = !BuildConfig.USE_FIREBASE_EMULATOR

        if (BuildConfig.USE_FIREBASE_EMULATOR) {
            connectToEmulators()
            // No App Check provider installed here at all — Firestore/Auth
            // enforcement for App Check isn't turned on for this single-pilot
            // MVP yet, and DebugAppCheckProviderFactory still round-trips to
            // the real App Check backend for a debug token exchange even
            // when Firestore itself is pointed at the emulator. That
            // round-trip has caused multi-second stalls in the middle of
            // unrelated Firestore writes (e.g. the Confirm-screen "hangs
            // then times out" bug) whenever it overlapped with an Auth
            // token refresh. Revisit once App Check enforcement actually
            // matters and is deliberately being tested.
        } else {
            Firebase.appCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }

        ServiceLocator.initialize(this)
        // No anonymous sign-in here anymore — auth.currentUser stays null
        // until the user actually signs in via SignInScreen/AuthManager.

        schedulePendingAudioProcessing()
        schedulePendingCaptureSync()
        resumeOngoingWorkNotificationIfNeeded()
        refreshRemoteConfig()
    }

    /**
     * Best-effort, fire-and-forget — RemoteConfigStore.cloudAiEnabled
     * already defaults to "enabled" until this resolves (see its kdoc), so
     * there's nothing to block app startup on here; this just lets a
     * console-side kill switch take effect as soon as reasonably possible
     * after launch rather than waiting for AgentClient's first call.
     */
    private fun refreshRemoteConfig() {
        CoroutineScope(Dispatchers.Default).launch {
            ServiceLocator.remoteConfigStore.refresh()
        }
    }

    /**
     * Covers the case where the process was killed (or the app wasn't
     * running yet) while a work timer was still open — OngoingWorkNotificationService
     * is normally started right when the timer starts (CaptureViewModel/
     * AudioCaptureProcessor), but that notification doesn't survive a
     * process death (see that service's kdoc on why it's START_NOT_STICKY,
     * not START_STICKY). Re-detecting here means reopening the app after a
     * kill brings the notification back rather than losing it silently for
     * the rest of that timer's duration.
     */
    private fun resumeOngoingWorkNotificationIfNeeded() {
        if (Firebase.auth.currentUser == null) return
        CoroutineScope(Dispatchers.Default).launch {
            runCatching {
                if (ServiceLocator.entryRepository.findOpenEntry(isTrip = false) != null) {
                    OngoingWorkNotificationService.start(this@ContempoApp)
                }
            }
        }
    }

    /**
     * Background fallback for whenever this app isn't opened for a while —
     * see AudioCaptureProcessor's kdoc. MainActivity's resumed-loop is what
     * handles the common case (app opened not long after a watch capture);
     * this covers the rest. NetworkType.CONNECTED because — unlike the old
     * local-socket relay — this genuinely needs real internet (Storage +
     * Firestore). KEEP (not REPLACE) so re-creating the Application object
     * (e.g. after a process restart) doesn't reset the schedule's timing.
     */
    private fun schedulePendingAudioProcessing() {
        val request = PeriodicWorkRequestBuilder<PendingAudioProcessWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this)
            .enqueueUniquePeriodicWork("pending-audio-processing", ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /**
     * Background fallback for this phone's own Quick Capture backlog (see
     * CaptureViewModel.stopQuickCaptureAndSave and capture/PendingCaptureSyncer.kt)
     * — mirrors the wear module's identical schedule in WearApp.kt. The
     * expedited one-time request right after each capture handles the
     * common case; this covers whenever this phone had no connectivity at
     * record time.
     */
    private fun schedulePendingCaptureSync() {
        val request = PeriodicWorkRequestBuilder<PendingCaptureSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this)
            .enqueueUniquePeriodicWork("pending-capture-sync", ExistingPeriodicWorkPolicy.KEEP, request)
    }

    private fun connectToEmulators() {
        val host = EMULATOR_HOST
        com.google.firebase.firestore.FirebaseFirestore.setLoggingEnabled(true) // TEMP: diagnosing save-timeout bug
        Firebase.auth.useEmulator(host, 9099)
        Firebase.firestore.useEmulator(host, 8080)
        // Disk-persisted local cache would otherwise survive across app
        // launches/reinstalls and resurrect documents that were wiped
        // server-side via the emulator's REST clear endpoint (the SDK has no
        // way to know about a delete that bypassed it) — memory-only cache
        // keeps each emulator run's data scoped to that process lifetime.
        Firebase.firestore.firestoreSettings = firestoreSettings {
            setLocalCacheSettings(memoryCacheSettings {})
        }
        Firebase.storage.useEmulator(host, 9199)
        Firebase.functions.useEmulator(host, 5001)
    }

    companion object {
        private const val EMULATOR_HOST = "localhost"
    }
}
