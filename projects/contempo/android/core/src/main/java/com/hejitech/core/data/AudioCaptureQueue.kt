package com.hejitech.core.data

import com.hejitech.core.model.CaptureLanguage
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class PendingAudioCapture(
    val id: String,
    val storagePath: String,
    val capturedAt: Timestamp,
    val lat: Double?,
    val lng: Double?,
    // Defaults to AUTO for captures with no explicit selection (currently:
    // every watch-relayed capture, since the language toggle only exists on
    // the phone's Capture tab) — see CaptureLanguage's kdoc.
    val language: CaptureLanguage = CaptureLanguage.AUTO,
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

    suspend fun enqueue(
        storagePath: String,
        capturedAt: Timestamp,
        lat: Double?,
        lng: Double?,
        language: CaptureLanguage = CaptureLanguage.AUTO,
    ): String {
        val doc = mapOf(
            "storagePath" to storagePath,
            "capturedAt" to capturedAt,
            "lat" to lat,
            "lng" to lng,
            "language" to language.firestoreValue,
        )
        val ref = collection().add(doc).await()
        return ref.id
    }

    /** Oldest capturedAt first, so a backlog processes in the order it was actually spoken. */
    suspend fun listPending(): List<PendingAudioCapture> {
        val snapshot = collection().orderBy("capturedAt", Query.Direction.ASCENDING).get().await()
        return snapshot.documents.mapNotNull(::toPendingAudioCapture)
    }

    /**
     * Live twin of [listPending] — used by the Capture tab's Quick Capture
     * status indicator (see CaptureViewModel.quickCaptureStatus), which needs
     * to react instantly as items are enqueued/removed rather than on a poll
     * timer, the same way FirestoreEntryRepository.observeEntries() does for
     * entries.
     */
    fun observePending(): Flow<List<PendingAudioCapture>> = callbackFlow {
        val registration = collection()
            .orderBy("capturedAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.documents.orEmpty().mapNotNull(::toPendingAudioCapture))
            }
        awaitClose { registration.remove() }
    }

    private fun toPendingAudioCapture(doc: com.google.firebase.firestore.DocumentSnapshot): PendingAudioCapture? {
        val storagePath = doc.getString("storagePath") ?: return null
        val capturedAt = doc.getTimestamp("capturedAt") ?: return null
        return PendingAudioCapture(
            id = doc.id,
            storagePath = storagePath,
            capturedAt = capturedAt,
            lat = doc.getDouble("lat"),
            lng = doc.getDouble("lng"),
            // Missing on docs written before this field existed — AUTO matches
            // their actual prior behavior (the only mode that existed then).
            language = doc.getString("language")?.let(CaptureLanguage::fromFirestoreValue) ?: CaptureLanguage.AUTO,
        )
    }

    suspend fun remove(captureId: String) {
        collection().document(captureId).delete().await()
    }
}
