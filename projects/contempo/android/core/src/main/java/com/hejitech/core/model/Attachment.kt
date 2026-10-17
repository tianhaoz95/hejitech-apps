package com.hejitech.core.model


/**
 * Firestore document shape for
 * `users/{uid}/entries/{entryId}/attachments/{attachmentId}` — an arbitrary
 * (any file type, any count) piece of evidence attached to an entry, parallel
 * to but independent from [Entry.photoUrls] (image-only, a bare URL array).
 * Immutable once written except for [note] — see
 * FirestoreEntryRepository.uploadAttachment/deleteAttachment/
 * updateAttachmentNote and firestore.rules' isValidNoteUpdate; a changed
 * file is a new attachment doc, never an update.
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
    /** Free-form user note — what this evidence is for, or anything else worth recording alongside it. */
    val note: String = "",
)
