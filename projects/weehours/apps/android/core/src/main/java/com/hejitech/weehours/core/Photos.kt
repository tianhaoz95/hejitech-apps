package com.hejitech.weehours.core

import java.util.Date
import java.util.Locale
import java.util.UUID

data class EntryPhoto(
    val id: UUID,
    val entry: UUID,
    val householdId: UUID,
    val babyId: UUID,
    val path: String,
    val width: Int,
    val height: Int,
    val takenAt: Date,
    val addedBy: UUID,
) {
    val storageKey: String get() = "${householdId.toString().lowercase(Locale.US)}/$path"

    companion object {
        fun fromEvent(e: LogEvent): EntryPhoto? {
            if (e.type != SystemType.PHOTO) return null
            val entryStr = e.string(LogEvent.PHOTO_ENTRY) ?: return null
            val entryUuid = try { UUID.fromString(entryStr) } catch (_: Exception) { return null }
            val path = e.string("path") ?: return null
            if (path.isEmpty()) return null
            val width = e.number("width")?.toInt() ?: 0
            val height = e.number("height")?.toInt() ?: 0
            val takenAt = e.string("taken_at")?.let { LogCoding.parseISO(it) } ?: e.occurredAt
            return EntryPhoto(
                id = e.id,
                entry = entryUuid,
                householdId = e.householdId,
                babyId = e.babyId,
                path = path,
                width = width,
                height = height,
                takenAt = takenAt,
                addedBy = e.loggedBy
            )
        }

        fun path(forId: UUID): String = "photos/${forId.toString().lowercase(Locale.US)}.jpg"
    }
}
