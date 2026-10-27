package com.hejitech.weehours.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Date
import java.util.UUID
import kotlin.math.max

@Serializable
data class StatusSnapshot(
    @SerialName("last_feed_at") @Serializable(with = DateIsoSerializer::class) var lastFeedAt: Date? = null,
    @SerialName("last_feed_kind") var lastFeedKind: String? = null,
    @SerialName("open_feed_kind") var openFeedKind: String? = null,
    @SerialName("open_feed_since") @Serializable(with = DateIsoSerializer::class) var openFeedSince: Date? = null,
    @SerialName("next_side") var nextSide: String? = null,
    @SerialName("sleeping_since") @Serializable(with = DateIsoSerializer::class) var sleepingSince: Date? = null,
    @SerialName("last_wake_at") @Serializable(with = DateIsoSerializer::class) var lastWakeAt: Date? = null,
    @SerialName("last_diaper_at") @Serializable(with = DateIsoSerializer::class) var lastDiaperAt: Date? = null,
    @SerialName("last_diaper_kind") var lastDiaperKind: String? = null,
    @SerialName("last_movement_at") @Serializable(with = DateIsoSerializer::class) var lastMovementAt: Date? = null,
    @SerialName("last_kick_count") var lastKickCount: Int? = null,
    @SerialName("last_kick_minutes") var lastKickMinutes: Int? = null,
    @SerialName("to_review") var toReview: Int = 0,
    @SerialName("pending_captures") var pendingCaptures: Int = 0,
    @SerialName("on_duty") @Serializable(with = UUIDSerializer::class) var onDuty: UUID? = null,
    @SerialName("computed_at") @Serializable(with = DateIsoSerializer::class) var computedAt: Date = Date(),
) {
    constructor(
        log: DerivedLog,
        now: Date,
        pendingCaptures: Int = 0,
        pendingPicks: Int = 0,
    ) : this(computedAt = now) {
        val counted = log.counted
        val feedSessions = log.sessions.filter { it.kind == Session.Kind.BOTTLE || it.kind == Session.Kind.BREAST }
        val solids = counted.lastOrNull { it.type == "feed.solids" }

        var lastFeed: Pair<Date, String>? = feedSessions
            .maxByOrNull { it.anchor.time }
            ?.let { it.anchor to it.kind.rawValue }
        if (solids != null && solids.occurredAt.time > (lastFeed?.first?.time ?: Long.MIN_VALUE)) {
            lastFeed = solids.occurredAt to "solids"
        }
        lastFeedAt = lastFeed?.first
        lastFeedKind = lastFeed?.second

        log.openFeedSession()?.let { open ->
            openFeedKind = open.kind.rawValue
            openFeedSince = open.start
        }

        val lastSide = log.sessions.filter { it.kind == Session.Kind.BREAST }.flatMap { it.sides }.lastOrNull()
        nextSide = when (lastSide) {
            "left" -> "right"
            "right" -> "left"
            else -> null
        }

        log.openSession(Session.Kind.SLEEP)?.let { sleep ->
            sleepingSince = sleep.start
        }
        lastWakeAt = log.sessions.filter { it.kind == Session.Kind.SLEEP }.mapNotNull { it.end }.maxByOrNull { it.time }

        val diaper = counted.lastOrNull { it.type == "diaper" }
        lastDiaperAt = diaper?.occurredAt
        lastDiaperKind = diaper?.string("kind")

        val movement = counted.lastOrNull { it.type == "movement" || it.type == "kick_count" }
        lastMovementAt = movement?.occurredAt
        counted.lastOrNull { it.type == "kick_count" }?.let { kicks ->
            lastKickCount = kicks.number("count")?.toInt()
            lastKickMinutes = kicks.number("minutes")?.toInt()
        }

        toReview = log.duplicates.size + pendingPicks
        this.pendingCaptures = pendingCaptures
        onDuty = log.duty?.caregiver
        computedAt = now
    }

    fun nextFeedDue(feedEveryMinutes: Int?, adaptiveSuggestion: Int? = null): Date? {
        val interval = adaptiveSuggestion ?: feedEveryMinutes ?: return null
        if (interval <= 0) return null
        val last = lastFeedAt ?: return null
        return Date(last.time + interval * 60_000L)
    }

    fun line(now: Date): String {
        val parts = mutableListOf<String>()
        val sleepSince = sleepingSince
        val feedSince = openFeedSince
        val fedAt = lastFeedAt
        val movedAt = lastMovementAt
        when {
            sleepSince != null -> parts.add("Sleeping ${duration((now.time - sleepSince.time) / 1000.0)}")
            feedSince != null -> parts.add("Feeding ${duration((now.time - feedSince.time) / 1000.0)}")
            fedAt != null -> parts.add("Fed ${ago((now.time - fedAt.time) / 1000.0)}")
            movedAt != null && lastDiaperAt == null && lastWakeAt == null -> {
                parts.add("Moved ${ago((now.time - movedAt.time) / 1000.0)}")
                lastKickCount?.let { count ->
                    parts.add(lastKickMinutes?.let { "last count $count in ${it}m" } ?: "last count $count")
                }
            }
            else -> parts.add("No feeds yet")
        }
        nextSide?.let { parts.add("$it next") }
        lastDiaperAt?.let { d -> parts.add("diaper ${ago((now.time - d.time) / 1000.0)}") }
        if (pendingCaptures > 0) parts.add("$pendingCaptures pending")
        if (toReview > 0) parts.add("$toReview to review")
        return parts.joinToString(" · ")
    }

    fun line(now: Date, expecting: Boolean): String {
        val l = line(now)
        return if (expecting && l.startsWith("No feeds yet")) {
            "No movements yet" + l.removePrefix("No feeds yet")
        } else {
            l
        }
    }

    companion object {
        fun ago(seconds: Double): String =
            if (seconds < 60.0) "just now" else "${duration(seconds)} ago"

        fun duration(seconds: Double): String {
            val minutes = max(0, (seconds / 60.0).toInt())
            if (minutes < 60) return "${minutes}m"
            val hours = minutes / 60
            if (hours < 24) {
                return if (minutes % 60 == 0) "${hours}h" else "${hours}h${minutes % 60}m"
            }
            val days = hours / 24
            return if (hours % 24 == 0) "${days}d" else "${days}d${hours % 24}h"
        }
    }
}
