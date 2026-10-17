package com.hejitech.core.model

/**
 * Mirrors the `category` enum in backend/functions/src/schemas.ts
 * (EntrySchema). Keep the two in sync by hand — no shared-schema codegen at
 * MVP scale (see backend/README.md).
 */
enum class EntryCategory(val firestoreValue: String) {
    MAINTENANCE("maintenance"),
    TURNOVER("turnover"),
    GUEST_COMMUNICATION("guest_communication"),
    SUPPLY_RUN("supply_run"),
    ADMIN("admin"),
    OTHER("other");

    companion object {
        fun fromFirestoreValue(value: String): EntryCategory =
            entries.find { it.firestoreValue == value } ?: OTHER

        /**
         * Pretty label for a raw category value that might be one of this
         * enum's built-in [firestoreValue]s OR a free-form custom category
         * name from the user's own `users/{uid}/categories` roster (see
         * [Category]) — unlike [fromFirestoreValue], this never silently
         * collapses an unrecognized value down to "Other"; a custom name is
         * already human-typed, so it's returned as-is.
         */
        fun displayName(value: String): String =
            entries.find { it.firestoreValue == value }?.name?.lowercase()?.replace('_', ' ') ?: value
    }
}
