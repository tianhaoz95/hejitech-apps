package com.hejitech.core.data

import com.hejitech.core.model.Timestamp
import com.hejitech.core.supabase.ContempoBackend
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.put

data class PendingTextCapture(
    val id: String,
    val rawText: String,
    val capturedAt: Timestamp,
    val lat: Double?,
    val lng: Double?,
)

/** Quick Capture's typed text, saved immediately and parsed in the background: contempo.text_captures. */
class TextCaptureQueue {
    private val db get() = ContempoBackend.client

    suspend fun enqueue(rawText: String, capturedAt: Timestamp, lat: Double?, lng: Double?): String {
        val id = ContempoBackend.newId()
        db.from("text_captures").insert(
            buildJsonObject {
                put("id", id)
                put("user_id", ContempoBackend.requireUid())
                put("raw_text", rawText)
                put("captured_at", capturedAt.toIso())
                put("lat", lat)
                put("lng", lng)
            },
        )
        return id
    }

    suspend fun listPending(): List<PendingTextCapture> =
        db.from("text_captures").select { order("captured_at", Order.ASCENDING) }.decodeList<JsonObject>().mapNotNull(::toPending)

    fun observePending(): Flow<List<PendingTextCapture>> =
        ContempoBackend.liveRows("text_captures", "captured_at", ascending = true, map = ::toPending)

    private fun toPending(r: JsonObject): PendingTextCapture? {
        val id = (r["id"] as? JsonPrimitive)?.content ?: return null
        val text = (r["raw_text"] as? JsonPrimitive)?.content ?: return null
        val at = (r["captured_at"] as? JsonPrimitive)?.content?.let { runCatching { Timestamp.parse(it) }.getOrNull() } ?: return null
        return PendingTextCapture(id, text, at, (r["lat"] as? JsonPrimitive)?.doubleOrNull, (r["lng"] as? JsonPrimitive)?.doubleOrNull)
    }

    suspend fun remove(captureId: String) {
        db.from("text_captures").delete { filter { eq("id", captureId) } }
    }
}
