package com.hejitech.contempo.wear

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Periodic background attempt to drain the watch's pending-audio backlog —
 * without this, a capture uploaded while this phone app was closed would
 * only get transcribed/parsed the next time the user happened to open it.
 * Also run once on every app start (see MainActivity's resumed-loop) for the
 * common case where the app is opened not long after — see
 * AudioCaptureProcessor's kdoc and ContempoApp's kdoc for where this is
 * scheduled.
 */
class PendingAudioProcessWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        AudioCaptureProcessor.processPendingCaptures()
        return Result.success()
    }
}
