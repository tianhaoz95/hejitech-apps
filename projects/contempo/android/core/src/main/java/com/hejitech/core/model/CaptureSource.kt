package com.hejitech.core.model

/** How an entry was captured — kept even after confirmation, for the correction-feedback pipeline. */
enum class CaptureSource(val firestoreValue: String) {
    MANUAL("manual"),
    VOICE("voice"),
    TEXT("text"),
    PHOTO("photo");

    companion object {
        fun fromFirestoreValue(value: String): CaptureSource =
            entries.find { it.firestoreValue == value } ?: MANUAL
    }
}

/** Confirm/edit review state — nothing commits without the user, per the PRD's trust principle. */
enum class EntryStatus(val firestoreValue: String) {
    PENDING_REVIEW("pending_review"),
    CONFIRMED("confirmed");

    companion object {
        fun fromFirestoreValue(value: String): EntryStatus =
            entries.find { it.firestoreValue == value } ?: PENDING_REVIEW
    }
}
