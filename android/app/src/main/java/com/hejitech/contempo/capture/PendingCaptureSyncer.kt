package com.hejitech.contempo.capture

import android.util.Log
import com.hejitech.contempo.data.ServiceLocator
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.auth
import com.google.firebase.storage.storage
import com.google.firebase.storage.storageMetadata
import kotlinx.coroutines.tasks.await

private const val TAG = "ContempoQuickCapture"

/**
 * Uploads every recording still waiting in PendingCaptureStore to Firebase
 * Storage, then enqueues an AudioCaptureQueue doc pointing at it — the
 * phone-side twin of wear/capture/PendingCaptureSyncer.kt, writing to the
 * exact same users/{uid}/audioCaptures/ Storage path and AudioCaptureQueue
 * collection the watch already uses, so this phone's own quick captures are
 * picked up by the same existing AudioCaptureProcessor/
 * PendingAudioProcessWorker consumer pipeline with no changes needed there.
 * Shared by the expedited one-time request (right after recording) and the
 * periodic background fallback (ContempoApp's schedule) for whenever this
 * phone had no connectivity at record time.
 */
object PendingCaptureSyncer {
    suspend fun syncAll() {
        ServiceLocator.pendingCaptureStore.listPending().forEach { pending -> syncOne(pending) }
    }

    /** Returns whether this capture is now durably uploaded (and so removed from the local queue). */
    suspend fun syncOne(pending: PendingCapture): Boolean {
        val uid = Firebase.auth.currentUser?.uid ?: return false
        val wavBytes = runCatching { pending.file.readBytes() }.getOrNull() ?: return false

        val storagePath = "users/$uid/audioCaptures/${pending.id}.wav"
        val metadata = storageMetadata { contentType = "audio/wav" }
        val uploadResult = runCatching {
            Firebase.storage.reference.child(storagePath).putBytes(wavBytes, metadata).await()
        }
        if (uploadResult.isFailure) {
            Log.e(TAG, "upload failed for ${pending.id}", uploadResult.exceptionOrNull())
            return false
        }

        val capturedAt = Timestamp(pending.capturedAtEpochMillis / 1000, ((pending.capturedAtEpochMillis % 1000) * 1_000_000).toInt())
        runCatching {
            ServiceLocator.audioCaptureQueue.enqueue(storagePath, capturedAt, pending.lat, pending.lng)
        }.onFailure { e ->
            Log.e(TAG, "queue enqueue failed for ${pending.id}", e)
            return false
        }

        ServiceLocator.pendingCaptureStore.delete(pending)
        return true
    }
}
