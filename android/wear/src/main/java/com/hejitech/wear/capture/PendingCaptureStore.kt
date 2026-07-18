package com.hejitech.wear.capture

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.util.UUID

data class PendingCapture(
    val id: String,
    val file: File,
    val capturedAtEpochMillis: Long,
    val lat: Double? = null,
    val lng: Double? = null,
)

/**
 * Durable local queue of recorded-but-not-yet-uploaded WAV files. A capture
 * is saved here the moment recording stops — before any attempt to upload it
 * — so a lack of connectivity right now, or the upload itself failing, never
 * loses what was said. Only deleted once it's durably in Firebase Storage
 * (see PendingCaptureSyncer). Location, if available at record time, is
 * persisted alongside in a small JSON sidecar file so it survives even if the
 * upload doesn't happen until a later app/process run.
 */
class PendingCaptureStore(context: Context) {
    private val dir = File(context.filesDir, "pendingCaptures").apply { mkdirs() }

    fun save(wavBytes: ByteArray, lat: Double? = null, lng: Double? = null): PendingCapture {
        val id = UUID.randomUUID().toString()
        val file = File(dir, "$id.wav")
        file.writeBytes(wavBytes)
        if (lat != null || lng != null) {
            metaFile(id).writeText(JSONObject().apply {
                if (lat != null) put("lat", lat)
                if (lng != null) put("lng", lng)
            }.toString())
        }
        return PendingCapture(id, file, file.lastModified(), lat, lng)
    }

    /** Oldest first, so a backlog syncs in the order it was actually spoken. */
    fun listPending(): List<PendingCapture> =
        (dir.listFiles { f -> f.extension == "wav" } ?: emptyArray())
            .sortedBy { it.lastModified() }
            .map { file ->
                val id = file.nameWithoutExtension
                val meta = runCatching { metaFile(id).takeIf { it.exists() }?.readText()?.let { JSONObject(it) } }.getOrNull()
                PendingCapture(
                    id = id,
                    file = file,
                    capturedAtEpochMillis = file.lastModified(),
                    lat = meta?.optDouble("lat")?.takeIf { !it.isNaN() },
                    lng = meta?.optDouble("lng")?.takeIf { !it.isNaN() },
                )
            }

    fun delete(capture: PendingCapture) {
        capture.file.delete()
        metaFile(capture.id).delete()
    }

    private fun metaFile(id: String) = File(dir, "$id.meta.json")
}
