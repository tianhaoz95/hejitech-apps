package com.hejitech.core.data

import com.hejitech.core.model.CaptureLanguage
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

data class PendingAudioCapture(
    val id: String,
    val storagePath: String,
    val capturedAt: Timestamp,
    val lat: Double?,
    val lng: Double?,
    val language: CaptureLanguage = CaptureLanguage.AUTO,
)

/**
 * Audio recorded on a device that can't transcribe it (the watch), waiting for the phone:
 * contempo.audio_captures, with the audio itself in Storage at `storagePath`.
 */
class AudioCaptureQueue {
    private val db get() = ContempoBackend.client

    suspend fun enqueue(
        storagePath: String,
        capturedAt: Timestamp,
        lat: Double?,
        lng: Double?,
        language: CaptureLanguage = CaptureLanguage.AUTO,
    ): String {
        val id = ContempoBackend.newId()
        db.from("audio_captures").insert(
            buildJsonObject {
                put("id", id)
                put("user_id", ContempoBackend.requireUid())
                put("storage_path", storagePath)
                put("captured_at", capturedAt.toIso())
                put("lat", lat)
                put("lng", lng)
                put("language", language.firestoreValue)
            },
        )
        return id
    }

    suspend fun listPending(): List<PendingAudioCapture> =
        db.from("audio_captures").select { order("captured_at", Order.ASCENDING) }.decodeList<JsonObject>().mapNotNull(::toPending)

    fun observePending(): Flow<List<PendingAudioCapture>> =
        ContempoBackend.liveRows("audio_captures", "captured_at", ascending = true, map = ::toPending)

    private fun toPending(r: JsonObject): PendingAudioCapture? {
        val id = (r["id"] as? JsonPrimitive)?.content ?: return null
        val path = (r["storage_path"] as? JsonPrimitive)?.content ?: return null
        val at = (r["captured_at"] as? JsonPrimitive)?.content?.let { runCatching { Timestamp.parse(it) }.getOrNull() } ?: return null
        return PendingAudioCapture(
            id = id,
            storagePath = path,
            capturedAt = at,
            lat = (r["lat"] as? JsonPrimitive)?.doubleOrNull,
            lng = (r["lng"] as? JsonPrimitive)?.doubleOrNull,
            language = (r["language"] as? JsonPrimitive)?.takeIf { !it.toString().equals("null") }?.content
                ?.let(CaptureLanguage::fromFirestoreValue) ?: CaptureLanguage.AUTO,
        )
    }

    suspend fun remove(captureId: String) {
        db.from("audio_captures").delete { filter { eq("id", captureId) } }
    }
}
