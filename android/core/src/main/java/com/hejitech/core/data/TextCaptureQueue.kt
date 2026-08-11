package com.hejitech.core.data

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class PendingTextCapture(
    val id: String,
    val rawText: String,
    val capturedAt: Timestamp,
    val lat: Double?,
    val lng: Double?,
)

/**
 * Quick Capture's typed-text counterpart to [AudioCaptureQueue] — same
 * "immediate local save, background parse" shape, but text is small enough
 * that it doesn't need Storage/an upload stage: the raw text is written
 * directly onto the queue doc, and Firestore's own offline persistence is
 * durability enough (unlike audio, which needs a real local file since a
 * large binary upload isn't covered by the SDK's offline write queue the
 * same way). The phone drains this queue (see AudioCaptureProcessor),
 * turning each into a real Entry and removing the queue doc.
 */
class TextCaptureQueue(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    private val uid: String
        get() = auth.currentUser?.uid ?: error("TextCaptureQueue used before sign-in")

    private fun collection() = firestore.collection("users").document(uid).collection("textCaptures")

    suspend fun enqueue(rawText: String, capturedAt: Timestamp, lat: Double?, lng: Double?): String {
        val doc = mapOf(
            "rawText" to rawText,
            "capturedAt" to capturedAt,
            "lat" to lat,
            "lng" to lng,
        )
        val ref = collection().add(doc).await()
        return ref.id
    }

    /** Oldest capturedAt first, so a backlog processes in the order it was actually typed. */
    suspend fun listPending(): List<PendingTextCapture> {
        val snapshot = collection().orderBy("capturedAt", Query.Direction.ASCENDING).get().await()
        return snapshot.documents.mapNotNull(::toPendingTextCapture)
    }

    /**
     * Live twin of [listPending] — used by the Capture tab's Quick Capture
     * status indicator (see CaptureViewModel.quickCaptureStatus), which needs
     * to react instantly as items are enqueued/removed rather than on a poll
     * timer, the same way AudioCaptureQueue.observePending() does.
     */
    fun observePending(): Flow<List<PendingTextCapture>> = callbackFlow {
        val registration = collection()
            .orderBy("capturedAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.documents.orEmpty().mapNotNull(::toPendingTextCapture))
            }
        awaitClose { registration.remove() }
    }

    private fun toPendingTextCapture(doc: com.google.firebase.firestore.DocumentSnapshot): PendingTextCapture? {
        val rawText = doc.getString("rawText") ?: return null
        val capturedAt = doc.getTimestamp("capturedAt") ?: return null
        return PendingTextCapture(
            id = doc.id,
            rawText = rawText,
            capturedAt = capturedAt,
            lat = doc.getDouble("lat"),
            lng = doc.getDouble("lng"),
        )
    }

    suspend fun remove(captureId: String) {
        collection().document(captureId).delete().await()
    }
}
