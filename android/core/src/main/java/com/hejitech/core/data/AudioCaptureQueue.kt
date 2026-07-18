package com.hejitech.core.data

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

data class PendingAudioCapture(
    val id: String,
    val storagePath: String,
    val capturedAt: Timestamp,
    val lat: Double?,
    val lng: Double?,
)

/**
 * Lightweight processing queue for audio recorded on a device that can't
 * transcribe/parse it itself (the watch) — a recording device uploads its
 * WAV to Firebase Storage, then writes one of these docs pointing at it;
 * the phone drains the queue (see AudioCaptureProcessor), turning each into
 * a real Entry and removing the queue doc. The audio file in Storage is
 * never deleted by this class — only the queue bookkeeping is, once a
 * capture has been durably turned into an Entry.
 *
 * Deliberately its own small class rather than a method on EntryRepository:
 * a queue entry isn't an Entry (no property/task/category yet), it's a
 * distinct, narrower concern. Same constructor shape as
 * FirestoreEntryRepository so both ServiceLocators can build one the same way.
 */
class AudioCaptureQueue(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    private val uid: String
        get() = auth.currentUser?.uid ?: error("AudioCaptureQueue used before sign-in")

    private fun collection() = firestore.collection("users").document(uid).collection("audioCaptures")

    suspend fun enqueue(storagePath: String, capturedAt: Timestamp, lat: Double?, lng: Double?): String {
        val doc = mapOf(
            "storagePath" to storagePath,
            "capturedAt" to capturedAt,
            "lat" to lat,
            "lng" to lng,
        )
        val ref = collection().add(doc).await()
        return ref.id
    }

    /** Oldest capturedAt first, so a backlog processes in the order it was actually spoken. */
    suspend fun listPending(): List<PendingAudioCapture> {
        val snapshot = collection().orderBy("capturedAt", Query.Direction.ASCENDING).get().await()
        return snapshot.documents.mapNotNull { doc ->
            val storagePath = doc.getString("storagePath") ?: return@mapNotNull null
            val capturedAt = doc.getTimestamp("capturedAt") ?: return@mapNotNull null
            PendingAudioCapture(
                id = doc.id,
                storagePath = storagePath,
                capturedAt = capturedAt,
                lat = doc.getDouble("lat"),
                lng = doc.getDouble("lng"),
            )
        }
    }

    suspend fun remove(captureId: String) {
        collection().document(captureId).delete().await()
    }
}
