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
    }
}
