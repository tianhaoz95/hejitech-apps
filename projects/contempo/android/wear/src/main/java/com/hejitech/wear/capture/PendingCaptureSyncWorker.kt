package com.hejitech.wear.capture

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Periodic background attempt to drain the pending-capture backlog — without
 * this, a recording made while this watch had no internet connectivity at
 * record time would only upload the next time the user happened to reopen
 * the watch app. Also enqueued as a one-time expedited request right after
 * each recording (see WearCaptureViewModel) for the common case where
 * connectivity is fine and there's no reason to wait on this 15-minute
 * floor — see WearApp's kdoc for where the periodic version is scheduled.
 */
class PendingCaptureSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        PendingCaptureSyncer.syncAll()
        return Result.success()
    }
}
