package com.hejitech.core.model


/**
 * Firestore document shape for `users/{uid}/categories/{categoryId}` — a
 * user-managed roster of custom work categories, alongside the fixed
 * built-in ones in [EntryCategory]. Mirrors [Role] exactly (same shape,
 * same "add in place" UX from Confirm/EntryDetail — see
 * EntryCategory.displayName's kdoc for how a category value coming from
 * either source is rendered).
 */
data class Category(
    val id: String = "",
    val name: String = "",
    val createdAt: Timestamp = Timestamp.now(),
)
