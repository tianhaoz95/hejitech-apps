package com.hejitech.core.data

import android.net.Uri
import com.hejitech.core.model.Entry
import com.hejitech.core.model.Property
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.storageMetadata
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

private const val FIRESTORE_BATCH_LIMIT = 500

class FirestoreEntryRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage,
) : EntryRepository {

    private val uid: String
        get() = auth.currentUser?.uid ?: error("FirestoreEntryRepository used before sign-in")

    private fun userDoc() = firestore.collection("users").document(uid)
    private fun entriesCollection() = userDoc().collection("entries")
    private fun propertiesCollection() = userDoc().collection("properties")
    private fun correctionsCollection() = userDoc().collection("corrections")

    override fun observeEntries(): Flow<List<Entry>> = callbackFlow {
        val registration = entriesCollection()
            .orderBy("activityDate", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val entries = snapshot?.documents.orEmpty().mapNotNull { doc ->
                    doc.toObject(Entry::class.java)?.copy(id = doc.id)
                }
                trySend(entries)
            }
        awaitClose { registration.remove() }
    }

    override fun observeProperties(): Flow<List<Property>> = callbackFlow {
        val registration = propertiesCollection()
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val properties = snapshot?.documents.orEmpty().mapNotNull { doc ->
                    doc.toObject(Property::class.java)?.copy(id = doc.id)
                }
                trySend(properties)
            }
        awaitClose { registration.remove() }
    }

    override suspend fun createProperty(name: String): Property {
        val property = Property(name = name)
        val ref = propertiesCollection().add(property).await()
        return property.copy(id = ref.id)
    }

    override suspend fun createEntry(entry: Entry): String {
        val ref = entriesCollection().add(entry).await()
        return ref.id
    }

    override fun newEntryId(): String = entriesCollection().document().id

    override suspend fun getEntry(entryId: String): Entry? {
        val doc = entriesCollection().document(entryId).get().await()
        return doc.toObject(Entry::class.java)?.copy(id = doc.id)
    }

    override suspend fun findOpenEntry(isTrip: Boolean): Entry? {
        val snapshot = entriesCollection()
            .whereEqualTo("inProgress", true)
            // Entry.isTrip carries explicit @PropertyName("isTrip")
            // annotations specifically so this literal field name is what's
            // actually stored — see Entry.kt's kdoc on that field for why
            // (Firestore's default Kotlin-boolean-getter convention would
            // otherwise silently store/query the wrong field name).
            .whereEqualTo("isTrip", isTrip)
            .limit(1)
            .get()
            .await()
        val doc = snapshot.documents.firstOrNull() ?: return null
        return doc.toObject(Entry::class.java)?.copy(id = doc.id)
    }

    override suspend fun updateEntry(entryId: String, entry: Entry) {
        entriesCollection().document(entryId).set(entry).await()
    }

    override suspend fun deleteEntry(entryId: String) {
        entriesCollection().document(entryId).delete().await()
    }

    override suspend fun deleteEntries(entryIds: List<String>) {
        entryIds.chunked(FIRESTORE_BATCH_LIMIT).forEach { chunk ->
            val batch = firestore.batch()
            chunk.forEach { entryId -> batch.delete(entriesCollection().document(entryId)) }
            batch.commit().await()
        }
    }

    override suspend fun attachPhoto(entryId: String, localUri: Uri): String {
        val photoRef = storage.reference.child("users/$uid/entries/$entryId/${System.currentTimeMillis()}.jpg")
        // Explicit rather than relying on putFile's ContentResolver-based
        // inference — storage.rules now validates contentType matches
        // image/*, and this guarantees that check has something real to
        // match regardless of the source URI's provider.
        val metadata = storageMetadata { contentType = "image/jpeg" }
        photoRef.putFile(localUri, metadata).await()
        val downloadUrl = photoRef.downloadUrl.await().toString()
        entriesCollection().document(entryId)
            .update("photoUrls", FieldValue.arrayUnion(downloadUrl))
            .await()
        return downloadUrl
    }

    override suspend fun recordCorrection(
        entryId: String,
        fieldName: String,
        aiValue: String,
        finalValue: String,
    ) {
        val correction = mapOf(
            "entryId" to entryId,
            "fieldName" to fieldName,
            "aiValue" to aiValue,
            "finalValue" to finalValue,
            "recordedAt" to com.google.firebase.Timestamp.now(),
        )
        correctionsCollection().add(correction).await()
    }
}
