package com.hejitech.core.model

import java.time.Instant
import java.util.Date

/**
 * A point in time with Firebase Timestamp's API (seconds + nanoseconds, now(), toDate(),
 * toInstant()), so the models and screens written against Firestore keep working unchanged after
 * the move to Supabase. Stored as Postgres timestamptz; on the wire it's an ISO-8601 string
 * (see SupabaseRows.kt).
 */
class Timestamp(val seconds: Long, val nanoseconds: Int) : Comparable<Timestamp> {
    constructor(date: Date) : this(Math.floorDiv(date.time, 1000L), (Math.floorMod(date.time, 1000L) * 1_000_000).toInt())

    fun toDate(): Date = Date(seconds * 1000 + nanoseconds / 1_000_000)
    fun toInstant(): Instant = Instant.ofEpochSecond(seconds, nanoseconds.toLong())
    fun toIso(): String = toInstant().toString()

    override fun compareTo(other: Timestamp): Int = compareValuesBy(this, other, { it.seconds }, { it.nanoseconds })
    override fun equals(other: Any?): Boolean = other is Timestamp && other.seconds == seconds && other.nanoseconds == nanoseconds
    override fun hashCode(): Int = 31 * seconds.hashCode() + nanoseconds
    override fun toString(): String = "Timestamp(${toIso()})"

    companion object {
        @JvmStatic fun now(): Timestamp = fromInstant(Instant.now())
        @JvmStatic fun fromInstant(instant: Instant): Timestamp = Timestamp(instant.epochSecond, instant.nano)
        @JvmStatic fun parse(iso: String): Timestamp = fromInstant(java.time.OffsetDateTime.parse(iso).toInstant())
    }
}
