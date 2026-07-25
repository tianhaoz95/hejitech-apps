package com.hejitech.core.data

import android.net.Uri
import com.hejitech.core.model.Attachment
import com.hejitech.core.model.Entry
import com.hejitech.core.model.Property
import com.hejitech.core.model.Role
import kotlinx.coroutines.flow.Flow
import java.io.File

interface EntryRepository {
    /** Live stream of all entries for the current user, newest activity first. */
    fun observeEntries(): Flow<List<Entry>>

    fun observeProperties(): Flow<List<Property>>

    suspend fun createProperty(name: String): Property

    /** Live stream of the user's role roster (Property Manager, Co-host, Cleaner, ...) managed in Settings. */
    fun observeRoles(): Flow<List<Role>>

    suspend fun createRole(name: String): Role

    suspend fun renameRole(roleId: String, name: String)

    suspend fun deleteRole(roleId: String)

    /** Writes a new entry (typically status = pending_review) and returns its assigned id. */
    suspend fun createEntry(entry: Entry): String

    /**
     * Allocates a new entry id locally, with no network call — lets a caller
     * commit to an id up front (e.g. ConfirmViewModel) so a retry after a
     * timed-out write becomes an idempotent overwrite via [updateEntry]
     * instead of risking a second document from a second createEntry call.
     */
    fun newEntryId(): String

    /**
     * Looks up a single entry by id — used when resuming a pending_review
     * entry into Confirm, to preserve its original loggedAt (the
     * contemporaneity anchor) and photoUrls across the update rather than
     * clobbering them with updateEntry's full-document overwrite.
     */
    suspend fun getEntry(entryId: String): Entry?

    /**
     * The single open entry of the given kind for this user, if any —
     * scoped by [isTrip] so a work timer (isTrip = false, see
     * TimerEntryCoordinator) and a mileage trip (isTrip = true, see
     * MileageTripCoordinator) can be open simultaneously without either
     * auto-closing the other. Within one kind, at most one entry ever has
     * inProgress = true by construction (a new "start" always closes the
     * previous one of the same kind first), so this is a plain existence
     * lookup, not a "most recent of many."
     */
    suspend fun findOpenEntry(isTrip: Boolean): Entry?

    /** Applies edits and/or flips status to confirmed. */
    suspend fun updateEntry(entryId: String, entry: Entry)

    suspend fun deleteEntry(entryId: String)

    /** Bulk delete — see Dashboard's multi-select. Atomic per underlying batch (chunked at Firestore's 500-write batch limit). */
    suspend fun deleteEntries(entryIds: List<String>)

    /**
     * Uploads a locally-captured photo to Storage under this entry and adds
     * its download URL to the entry's photoUrls — called after createEntry,
     * not as part of it, since Storage's path convention
     * (users/{uid}/entries/{entryId}/...) needs the entryId first. Returns
     * the download URL.
     */
    suspend fun attachPhoto(entryId: String, localUri: Uri): String

    /**
     * Records a correction for the feedback pipeline — see
     * reports/mvp-scope-v0.html Section 8 on why this is captured from day
     * one even though nothing consumes it yet.
     */
    suspend fun recordCorrection(entryId: String, fieldName: String, aiValue: String, finalValue: String)

    /** One-shot fetch of an entry's attachments, oldest first. */
    suspend fun listAttachments(entryId: String): List<Attachment>

    /**
     * Uploads an arbitrary local file (from a content:// Uri, e.g. from a
     * document/photo picker) to Storage under this entry's attachments/ path
     * and records it in Firestore. `onProgress` reports fractional completion
     * (0f..1f) for a progress UI. Separate Storage path
     * (`.../attachments/...`) and separate Firestore subcollection from
     * [attachPhoto]/[Entry.photoUrls] — this is the generic, any-file-type
     * counterpart, not a replacement.
     */
    suspend fun uploadAttachment(
        entryId: String,
        localUri: Uri,
        fileName: String,
        contentType: String,
        onProgress: (Float) -> Unit,
    ): Attachment

    /** Deletes both the Storage object and its Firestore doc. */
    suspend fun deleteAttachment(entryId: String, attachment: Attachment)

    /**
     * Downloads an attachment into [destinationDir] for in-app viewing/sharing
     * (skipping the download if already cached there). Returns the local file.
     */
    suspend fun downloadAttachment(
        entryId: String,
        attachment: Attachment,
        destinationDir: File,
        onProgress: (Float) -> Unit,
    ): File

    /**
     * Updates just the [Attachment.note] field on an already-uploaded
     * attachment — the one field on that doc that isn't immutable.
     */
    suspend fun updateAttachmentNote(entryId: String, attachmentId: String, note: String)
}
