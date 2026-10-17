package com.hejitech.wear.capture

import com.hejitech.core.supabase.ContempoBackend
import android.util.Log
import com.hejitech.wear.data.WearServiceLocator
import com.hejitech.core.model.Timestamp

private const val TAG = "ContempoUpload"

/**
 * Uploads every recording still waiting in PendingCaptureStore to Firebase
 * Storage, then enqueues a small AudioCaptureQueue doc pointing at it —
 * shared by WearCaptureViewModel (the immediate, right-after-recording
 * expedited attempt) and PendingCaptureSyncWorker (the periodic background
 * fallback for whenever the watch had no connectivity at record time).
 * Deliberately does NOT transcribe/parse/build an Entry here anymore — only
 * the phone can do that (Whisper + the parsing model), and there's no
 * back-channel to return a result to the watch, so that whole pipeline now
 * runs entirely on the phone (see app/wear/AudioCaptureProcessor.kt) once it
 * picks up the queue doc this writes.
 */
object PendingCaptureSyncer {
    suspend fun syncAll() {
        WearServiceLocator.pendingCaptureStore.listPending().forEach { pending -> syncOne(pending) }
    }

    /** Returns whether this capture is now durably uploaded (and so removed from the local queue). */
    suspend fun syncOne(pending: PendingCapture): Boolean {
        val uid = ContempoBackend.uid ?: return false
        val wavBytes = runCatching { pending.file.readBytes() }.getOrNull() ?: return false

        val storagePath = "$uid/audio/${pending.id}.wav"
        // Explicit content type — previously unset (defaulted to
        // application/octet-stream), which meant storage.rules had nothing
        // real to validate against for this path. Also lets anything that
        // downloads/plays this back later (a browser, a future admin tool)
        // treat it as audio without guessing from the .wav extension alone.
        val uploadResult = runCatching {
            ContempoBackend.uploadFile(storagePath, wavBytes, "audio/wav")
        }
        if (uploadResult.isFailure) {
            Log.e(TAG, "upload failed for ${pending.id}", uploadResult.exceptionOrNull())
            return false
        }

        val capturedAt = Timestamp(pending.capturedAtEpochMillis / 1000, ((pending.capturedAtEpochMillis % 1000) * 1_000_000).toInt())
        runCatching {
            WearServiceLocator.audioCaptureQueue.enqueue(storagePath, capturedAt, pending.lat, pending.lng)
        }.onFailure { e ->
            Log.e(TAG, "queue enqueue failed for ${pending.id}", e)
            return false
        }

        WearServiceLocator.pendingCaptureStore.delete(pending)
        WearServiceLocator.uploadStatsStore.recordUpload()
        return true
    }
}
