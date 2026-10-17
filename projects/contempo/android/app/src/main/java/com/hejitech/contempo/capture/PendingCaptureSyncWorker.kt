package com.hejitech.contempo.capture

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Periodic background attempt to drain this phone's own Quick Capture
 * backlog — without this, a capture made while offline would only upload
 * the next time the user happened to reopen the app. Also enqueued as a
 * one-time expedited request right after each quick capture (see
 * CaptureViewModel.stopQuickCaptureAndSave) for the common case where
 * connectivity is fine — see ContempoApp's kdoc for where the periodic
 * version is scheduled.
 */
class PendingCaptureSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        PendingCaptureSyncer.syncAll()
        return Result.success()
    }
}
