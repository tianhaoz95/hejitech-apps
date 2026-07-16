package com.hejitech.core.data

import android.net.Uri
import com.hejitech.core.model.Entry
import com.hejitech.core.model.Property
import kotlinx.coroutines.flow.Flow

interface EntryRepository {
    /** Live stream of all entries for the current user, newest activity first. */
    fun observeEntries(): Flow<List<Entry>>

    fun observeProperties(): Flow<List<Property>>

    suspend fun createProperty(name: String): Property

    /** Writes a new entry (typically status = pending_review) and returns its assigned id. */
    suspend fun createEntry(entry: Entry): String

    /**
     * Looks up a single entry by id — used when resuming a pending_review
     * entry into Confirm, to preserve its original loggedAt (the
     * contemporaneity anchor) and photoUrls across the update rather than
     * clobbering them with updateEntry's full-document overwrite.
     */
    suspend fun getEntry(entryId: String): Entry?

    /** Applies edits and/or flips status to confirmed. */
    suspend fun updateEntry(entryId: String, entry: Entry)

    suspend fun deleteEntry(entryId: String)

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
}
