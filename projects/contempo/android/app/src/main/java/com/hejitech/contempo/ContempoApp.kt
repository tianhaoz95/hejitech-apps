package com.hejitech.contempo

import android.app.Application
import com.hejitech.contempo.capture.PendingCaptureSyncWorker
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.supabase.ContempoBackend
import com.hejitech.contempo.timer.OngoingWorkNotificationService
import com.hejitech.contempo.wear.PendingAudioProcessWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.osmdroid.config.Configuration
import java.io.File
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
        // The shared HEJI Supabase project (projects/contempo/backend.env); OAuth returns to
        // com.hejitech.contempoapp://login-callback (AndroidManifest, MainActivity).
        ContempoBackend.init(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_PUBLISHABLE_KEY, scheme = "com.hejitech.contempoapp")
        ServiceLocator.initialize(this)
        // No anonymous sign-in here anymore — auth.currentUser stays null
        // until the user actually signs in via SignInScreen/AuthManager.

        configureOsmdroid()
        schedulePendingAudioProcessing()
        schedulePendingCaptureSync()
        resumeOngoingWorkNotificationIfNeeded()
        refreshRemoteConfig()
    }

    /**
     * osmdroid defaults to a public external-storage cache dir, which needs
     * WRITE_EXTERNAL_STORAGE on older API levels and fights scoped storage
     * on newer ones — pointed at the app's own private cache dir instead, no
     * extra permission needed. Also sets a real User-Agent (defaults to the
     * bare OS UA string otherwise), required by OSM's tile usage policy to
     * identify traffic per app rather than anonymously.
     */
    private fun configureOsmdroid() {
        val config = Configuration.getInstance()
        config.userAgentValue = packageName
        val osmdroidDir = File(cacheDir, "osmdroid")
        config.osmdroidBasePath = osmdroidDir
        config.osmdroidTileCache = File(osmdroidDir, "tiles")
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
        if (ContempoBackend.uid == null) return
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

}
