package com.hejitech.core.model


/**
 * Firestore document shape for `users/{uid}/properties/{propertyId}`.
 * All-default-args constructor so Firestore's `toObject()` mapping works.
 */
data class Property(
    val id: String = "",
    val name: String = "",
    val createdAt: Timestamp = Timestamp.now(),
)
