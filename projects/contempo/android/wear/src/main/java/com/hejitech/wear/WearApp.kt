package com.hejitech.wear

import com.hejitech.core.supabase.ContempoBackend
import android.app.Application
import com.hejitech.wear.capture.PendingCaptureSyncWorker
import com.hejitech.wear.data.WearServiceLocator
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
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
        // Same Supabase project as the phone (projects/contempo/backend.env). The watch never opens a
        // browser: it signs in with a pairing code from the phone (auth/WearAuthManager.kt).
        ContempoBackend.init(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_PUBLISHABLE_KEY, scheme = "com.hejitech.contempoappwear")

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
}
