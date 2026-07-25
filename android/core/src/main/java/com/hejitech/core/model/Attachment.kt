package com.hejitech.core.model

import com.google.firebase.Timestamp

/**
 * Firestore document shape for
 * `users/{uid}/entries/{entryId}/attachments/{attachmentId}` — an arbitrary
 * (any file type, any count) piece of evidence attached to an entry, parallel
 * to but independent from [Entry.photoUrls] (image-only, a bare URL array).
 * Immutable once written — see FirestoreEntryRepository.uploadAttachment/
 * deleteAttachment; a changed file is a new attachment doc, never an update.
 *
 * [storagePath] is stored explicitly rather than derived from [downloadURL]
 * so delete/re-download can build a `StorageReference` directly
 * (`storage.reference.child(storagePath)`) without parsing a signed/download
 * URL back into a path.
 */
data class Attachment(
    val id: String = "",
    val fileName: String = "",
    val contentType: String = "",
    val fileSize: Long = 0,
    val storagePath: String = "",
    val downloadURL: String = "",
    val uploadedAt: Timestamp = Timestamp.now(),
)
