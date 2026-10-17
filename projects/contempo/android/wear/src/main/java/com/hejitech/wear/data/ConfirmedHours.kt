package com.hejitech.wear.data

import com.hejitech.core.supabase.ContempoBackend
import io.github.jan.supabase.postgrest.from
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull

/** Sum of the signed-in user's confirmed entry minutes, in hours (contempo.entries, RLS-scoped); null if signed out. */
suspend fun fetchConfirmedHours(): Double? {
    if (ContempoBackend.uid == null) return null
    val rows = ContempoBackend.client.from("entries").select(io.github.jan.supabase.postgrest.query.Columns.list("duration_minutes")) {
        filter { eq("status", "confirmed") }
    }.decodeList<JsonObject>()
    return rows.sumOf { (it["duration_minutes"] as? JsonPrimitive)?.longOrNull ?: 0L } / 60.0
}
