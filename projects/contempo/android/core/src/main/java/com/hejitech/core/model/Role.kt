package com.hejitech.core.model

import com.google.firebase.Timestamp

/**
 * Firestore document shape for `users/{uid}/roles/{roleId}` — a
 * user-managed roster of *other* people who work on a property (Property
 * Manager, Co-host, Cleaner, a contractor, ...). The user's own hours are
 * the implicit default and never get a doc here — see [Entry.roleId].
 */
data class Role(
    val id: String = "",
    val name: String = "",
    val createdAt: Timestamp = Timestamp.now(),
)
