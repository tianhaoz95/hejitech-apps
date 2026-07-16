package com.hejitech.core.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.Exclude

/**
 * Firestore document shape for `users/{uid}/entries/{entryId}`. Mirrors
 * EntrySchema in backend/functions/src/schemas.ts, plus the bookkeeping
 * fields (status, source, timestamps, riskFlags) that only exist client/
 * Firestore-side, not in the parsing schema.
 *
 * All-default-args constructor so Firestore's `toObject()` mapping works.
 */
data class Entry(
    val id: String = "",
    val propertyId: String = "",
    val propertyName: String = "",
    val task: String = "",
    val durationMinutes: Int = 0,
    val category: String = EntryCategory.OTHER.firestoreValue,
    val status: String = EntryStatus.PENDING_REVIEW.firestoreValue,
    val source: String = CaptureSource.MANUAL.firestoreValue,
    /** When the work actually happened — set by the user, not "now." */
    val activityDate: Timestamp = Timestamp.now(),
    /** When this entry was first written to Firestore — the contemporaneity anchor. */
    val loggedAt: Timestamp = Timestamp.now(),
    val confirmedAt: Timestamp? = null,
    val isVague: Boolean = false,
    val isBackfilled: Boolean = false,
    val daysLate: Int = 0,
    val riskReasons: List<String> = emptyList(),
    val photoUrls: List<String> = emptyList(),
) {
    // @get:Exclude — computed, not stored: without this Firestore's reflection-based
    // mapper tries to find a matching field/setter for these and logs a harmless
    // but noisy "No setter/field found" warning on every read.
    @get:Exclude val categoryEnum: EntryCategory get() = EntryCategory.fromFirestoreValue(category)
    @get:Exclude val statusEnum: EntryStatus get() = EntryStatus.fromFirestoreValue(status)
    @get:Exclude val sourceEnum: CaptureSource get() = CaptureSource.fromFirestoreValue(source)
    @get:Exclude val riskFlags: RiskFlags get() = RiskFlags(isVague, isBackfilled, daysLate, riskReasons)
}
