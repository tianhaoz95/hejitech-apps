package com.hejitech.core.supabase

import com.hejitech.core.model.Attachment
import com.hejitech.core.model.Category
import com.hejitech.core.model.Entry
import com.hejitech.core.model.Property
import com.hejitech.core.model.Role
import com.hejitech.core.model.Timestamp
import com.hejitech.core.model.TokenUsageWeek
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

/**
 * The models ↔ contempo.* rows (snake_case columns, timestamptz as ISO strings). One place, so
 * the tables in supabase/schemas/contempo/schema.sql and the Kotlin models stay in step.
 */

internal fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
internal fun JsonObject.int(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull
internal fun JsonObject.long(key: String): Long? = (this[key] as? JsonPrimitive)?.longOrNull
internal fun JsonObject.double(key: String): Double? = (this[key] as? JsonPrimitive)?.doubleOrNull
internal fun JsonObject.bool(key: String): Boolean? = (this[key] as? JsonPrimitive)?.booleanOrNull
internal fun JsonObject.time(key: String): Timestamp? = str(key)?.let { runCatching { Timestamp.parse(it) }.getOrNull() }
internal fun JsonObject.strings(key: String): List<String> =
    (this[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p !is JsonNull }?.content } ?: emptyList()

private fun JsonObjectBuilder.putTime(key: String, value: Timestamp?) = put(key, value?.toIso())
private fun JsonObjectBuilder.putNullable(key: String, value: Double?) = put(key, value)
private fun blankToNull(value: String): String? = value.ifBlank { null }

fun entryToRow(entry: Entry, userId: String, id: String = entry.id): JsonObject = buildJsonObject {
    put("id", id)
    put("user_id", userId)
    put("property_id", entry.propertyId)
    put("property_name", entry.propertyName)
    put("task", entry.task)
    put("duration_minutes", entry.durationMinutes)
    put("category", entry.category)
    put("status", entry.status)
    put("source", entry.source)
    putTime("activity_date", entry.activityDate)
    putTime("logged_at", entry.loggedAt)
    putTime("confirmed_at", entry.confirmedAt)
    put("is_vague", entry.isVague)
    put("is_backfilled", entry.isBackfilled)
    put("days_late", entry.daysLate)
    put("risk_reasons", JsonArray(entry.riskReasons.map(::JsonPrimitive)))
    put("photo_urls", JsonArray(entry.photoUrls.map(::JsonPrimitive)))
    put("in_progress", entry.inProgress)
    put("is_paused", entry.isPaused)
    putTime("paused_at", entry.pausedAt)
    put("paused_duration_seconds", entry.pausedDurationSeconds)
    put("is_trip", entry.isTrip)
    put("mileage_capture_method", entry.mileageCaptureMethod)
    put("miles", entry.miles)
    putNullable("odometer_start", entry.odometerStart)
    putNullable("odometer_end", entry.odometerEnd)
    putNullable("trip_start_lat", entry.tripStartLat)
    putNullable("trip_start_lng", entry.tripStartLng)
    putNullable("trip_end_lat", entry.tripEndLat)
    putNullable("trip_end_lng", entry.tripEndLng)
    putNullable("capture_lat", entry.captureLat)
    putNullable("capture_lng", entry.captureLng)
    put("audio_url", entry.audioUrl)
    put("raw_transcript", blankToNull(entry.rawTranscript))
    putTime("stopped_at", entry.stoppedAt)
    putNullable("stop_lat", entry.stopLat)
    putNullable("stop_lng", entry.stopLng)
    put("role_id", blankToNull(entry.roleId))
    put("role_name", blankToNull(entry.roleName))
}

fun entryFromRow(r: JsonObject): Entry? {
    val id = r.str("id") ?: return null
    return Entry(
        id = id,
        propertyId = r.str("property_id").orEmpty(),
        propertyName = r.str("property_name").orEmpty(),
        task = r.str("task").orEmpty(),
        durationMinutes = r.int("duration_minutes") ?: 0,
        category = r.str("category") ?: "other",
        status = r.str("status") ?: "pending_review",
        source = r.str("source") ?: "manual",
        activityDate = r.time("activity_date") ?: Timestamp.now(),
        loggedAt = r.time("logged_at") ?: Timestamp.now(),
        confirmedAt = r.time("confirmed_at"),
        isVague = r.bool("is_vague") ?: false,
        isBackfilled = r.bool("is_backfilled") ?: false,
        daysLate = r.int("days_late") ?: 0,
        riskReasons = r.strings("risk_reasons"),
        photoUrls = r.strings("photo_urls"),
        inProgress = r.bool("in_progress") ?: false,
        isPaused = r.bool("is_paused") ?: false,
        pausedAt = r.time("paused_at"),
        pausedDurationSeconds = r.int("paused_duration_seconds") ?: 0,
        isTrip = r.bool("is_trip") ?: false,
        mileageCaptureMethod = r.str("mileage_capture_method").orEmpty(),
        miles = r.double("miles") ?: 0.0,
        odometerStart = r.double("odometer_start"),
        odometerEnd = r.double("odometer_end"),
        tripStartLat = r.double("trip_start_lat"),
        tripStartLng = r.double("trip_start_lng"),
        tripEndLat = r.double("trip_end_lat"),
        tripEndLng = r.double("trip_end_lng"),
        captureLat = r.double("capture_lat"),
        captureLng = r.double("capture_lng"),
        audioUrl = r.str("audio_url").orEmpty(),
        rawTranscript = r.str("raw_transcript").orEmpty(),
        stoppedAt = r.time("stopped_at"),
        stopLat = r.double("stop_lat"),
        stopLng = r.double("stop_lng"),
        roleId = r.str("role_id").orEmpty(),
        roleName = r.str("role_name").orEmpty(),
    )
}

fun propertyFromRow(r: JsonObject): Property? =
    r.str("id")?.let { Property(id = it, name = r.str("name").orEmpty(), createdAt = r.time("created_at") ?: Timestamp.now()) }

fun roleFromRow(r: JsonObject): Role? =
    r.str("id")?.let { Role(id = it, name = r.str("name").orEmpty(), createdAt = r.time("created_at") ?: Timestamp.now()) }

fun categoryFromRow(r: JsonObject): Category? =
    r.str("id")?.let { Category(id = it, name = r.str("name").orEmpty(), createdAt = r.time("created_at") ?: Timestamp.now()) }

fun tokenUsageFromRow(r: JsonObject): TokenUsageWeek = TokenUsageWeek(
    inputTokens = r.long("input_tokens")?.toInt() ?: 0,
    outputTokens = r.long("output_tokens")?.toInt() ?: 0,
    requestCount = r.long("request_count")?.toInt() ?: 0,
    weekStart = r.time("week_start") ?: Timestamp.now(),
    updatedAt = r.time("updated_at") ?: Timestamp.now(),
)

fun attachmentFromRow(r: JsonObject): Attachment? = r.str("id")?.let {
    Attachment(
        id = it,
        fileName = r.str("file_name").orEmpty(),
        contentType = r.str("content_type").orEmpty(),
        fileSize = r.long("file_size") ?: 0,
        storagePath = r.str("storage_path").orEmpty(),
        downloadURL = r.str("download_url").orEmpty(),
        uploadedAt = r.time("uploaded_at") ?: Timestamp.now(),
        note = r.str("note").orEmpty(),
    )
}

internal fun JsonElement?.asObjectList(): List<JsonObject> = (this as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
internal fun JsonElement.firstObject(): JsonObject? = runCatching { jsonArray.firstOrNull() as? JsonObject }.getOrNull()
internal fun JsonElement.contentOrNull(): String? = runCatching { jsonPrimitive.content }.getOrNull()
