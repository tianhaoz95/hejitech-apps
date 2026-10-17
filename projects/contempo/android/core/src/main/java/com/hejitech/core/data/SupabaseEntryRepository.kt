package com.hejitech.core.data

import android.content.Context
import android.net.Uri
import com.hejitech.core.model.AppFeedback
import com.hejitech.core.model.Attachment
import com.hejitech.core.model.Category
import com.hejitech.core.model.Entry
import com.hejitech.core.model.FeedbackRegion
import com.hejitech.core.model.Property
import com.hejitech.core.model.Role
import com.hejitech.core.model.Timestamp
import com.hejitech.core.model.TokenUsageWeek
import com.hejitech.core.supabase.ContempoBackend
import com.hejitech.core.supabase.appFeedbackFromRow
import com.hejitech.core.supabase.attachmentFromRow
import com.hejitech.core.supabase.categoryFromRow
import com.hejitech.core.supabase.entryFromRow
import com.hejitech.core.supabase.entryToRow
import com.hejitech.core.supabase.propertyFromRow
import com.hejitech.core.supabase.roleFromRow
import com.hejitech.core.supabase.tokenUsageFromRow
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import kotlin.time.Duration.Companion.days

/**
 * EntryRepository on Supabase (schema contempo, bucket contempo), replacing
 * FirestoreEntryRepository. Rows are scoped to the signed-in user by RLS; files live under
 * `<uid>/…` in the private bucket and are shown through long-lived signed URLs, stored on the
 * row the way Firestore stored download URLs (photo_urls, download_url, audio_url).
 */
class SupabaseEntryRepository(private val context: Context) : EntryRepository {

    private val db get() = ContempoBackend.client
    private val bucket get() = db.storage.from(ContempoBackend.BUCKET)
    private val uid: String get() = ContempoBackend.requireUid()

    private fun sanitizeFileNameComponent(fileName: String) = fileName.replace(Regex("[^A-Za-z0-9.\\-_]"), "_")

    override fun observeEntries(): Flow<List<Entry>> =
        ContempoBackend.liveRows("entries", "activity_date", ascending = false, map = ::entryFromRow)

    override fun observeProperties(): Flow<List<Property>> =
        ContempoBackend.liveRows("properties", "created_at", ascending = true, map = ::propertyFromRow)

    override suspend fun createProperty(name: String): Property {
        val row = db.from("properties").insert(buildJsonObject { put("id", ContempoBackend.newId()); put("user_id", uid); put("name", name) }) { select() }
            .decodeSingle<JsonObject>()
        return propertyFromRow(row) ?: error("createProperty: no row returned")
    }

    override suspend fun deleteProperty(propertyId: String) {
        db.from("properties").delete { filter { eq("id", propertyId) } }
    }

    override fun observeRoles(): Flow<List<Role>> =
        ContempoBackend.liveRows("roles", "created_at", ascending = true, map = ::roleFromRow)

    override suspend fun createRole(name: String): Role {
        val row = db.from("roles").insert(buildJsonObject { put("id", ContempoBackend.newId()); put("user_id", uid); put("name", name) }) { select() }
            .decodeSingle<JsonObject>()
        return roleFromRow(row) ?: error("createRole: no row returned")
    }

    override suspend fun renameRole(roleId: String, name: String) {
        db.from("roles").update(buildJsonObject { put("name", name) }) { filter { eq("id", roleId) } }
    }

    override suspend fun deleteRole(roleId: String) {
        db.from("roles").delete { filter { eq("id", roleId) } }
    }

    override fun observeCategories(): Flow<List<Category>> =
        ContempoBackend.liveRows("categories", "created_at", ascending = true, map = ::categoryFromRow)

    override suspend fun createCategory(name: String): Category {
        val row = db.from("categories").insert(buildJsonObject { put("id", ContempoBackend.newId()); put("user_id", uid); put("name", name) }) { select() }
            .decodeSingle<JsonObject>()
        return categoryFromRow(row) ?: error("createCategory: no row returned")
    }

    override fun observeDeviceTokenUsage(): Flow<TokenUsageWeek?> = observeTokenUsageWeek("device")

    override suspend fun recordOnDeviceTokenUsage(inputTokens: Int, outputTokens: Int) {
        db.postgrest.rpc(
            "record_device_token_usage",
            buildJsonObject {
                put("p_week_id", currentIsoWeekId())
                put("p_week_start", currentIsoWeekStart().toIso())
                put("p_input", inputTokens.toLong())
                put("p_output", outputTokens.toLong())
            },
        )
    }

    private fun observeTokenUsageWeek(kind: String): Flow<TokenUsageWeek?> {
        val week = currentIsoWeekId()
        return ContempoBackend.liveRows("token_usage", "week_id", ascending = true) { row ->
            row.takeIf { (it["kind"] as? JsonPrimitive)?.content == kind && (it["week_id"] as? JsonPrimitive)?.content == week }
        }.map { rows -> rows.firstOrNull()?.let(::tokenUsageFromRow) }
    }

    override suspend fun createEntry(entry: Entry): String {
        val id = entry.id.ifBlank { newEntryId() }
        db.from("entries").insert(entryToRow(entry, uid, id))
        return id
    }

    override fun newEntryId(): String = ContempoBackend.newId()

    override suspend fun getEntry(entryId: String): Entry? =
        db.from("entries").select { filter { eq("id", entryId) } }.decodeList<JsonObject>().firstOrNull()?.let(::entryFromRow)

    override suspend fun findOpenEntry(isTrip: Boolean): Entry? =
        db.from("entries").select {
            filter {
                eq("in_progress", true)
                eq("is_trip", isTrip)
            }
            limit(1)
        }.decodeList<JsonObject>().firstOrNull()?.let(::entryFromRow)

    /** Full replace, like Firestore's set(): an upsert keeps "create with a known id" working too. */
    override suspend fun updateEntry(entryId: String, entry: Entry) {
        db.from("entries").upsert(entryToRow(entry, uid, entryId))
    }

    override suspend fun deleteEntry(entryId: String) {
        db.from("entries").delete { filter { eq("id", entryId) } }
    }

    override suspend fun deleteEntries(entryIds: List<String>) {
        entryIds.chunked(200).forEach { chunk -> db.from("entries").delete { filter { isIn("id", chunk) } } }
    }

    private suspend fun readBytes(uri: Uri): ByteArray = withContext(Dispatchers.IO) {
        context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Can't read $uri")
    }

    private suspend fun uploadAndSign(path: String, bytes: ByteArray, contentType: String): String {
        bucket.upload(path, bytes) {
            upsert = true
            this.contentType = ContentType.parse(contentType)
        }
        return bucket.createSignedUrl(path, 3650.days)
    }

    override suspend fun attachPhoto(entryId: String, localUri: Uri): String {
        val path = "$uid/entries/$entryId/${System.currentTimeMillis()}.jpg"
        val url = uploadAndSign(path, readBytes(localUri), "image/jpeg")
        val current = getEntry(entryId)?.photoUrls.orEmpty()
        db.from("entries").update(buildJsonObject { put("photo_urls", JsonArray((current + url).map(::JsonPrimitive))) }) {
            filter { eq("id", entryId) }
        }
        return url
    }

    override suspend fun recordCorrection(entryId: String, fieldName: String, aiValue: String, finalValue: String) {
        db.from("corrections").insert(
            buildJsonObject {
                put("id", ContempoBackend.newId())
                put("user_id", uid)
                put("entry_id", entryId)
                put("field_name", fieldName)
                put("ai_value", aiValue)
                put("final_value", finalValue)
            },
        )
    }

    override suspend fun listAttachments(entryId: String): List<Attachment> =
        db.from("attachments").select {
            filter { eq("entry_id", entryId) }
            order("uploaded_at", Order.ASCENDING)
        }.decodeList<JsonObject>().mapNotNull(::attachmentFromRow)

    override suspend fun uploadAttachment(
        entryId: String,
        localUri: Uri,
        fileName: String,
        contentType: String,
        onProgress: (Float) -> Unit,
    ): Attachment {
        onProgress(0f)
        val storagePath = "$uid/entries/$entryId/attachments/${System.currentTimeMillis()}_${sanitizeFileNameComponent(fileName)}"
        val bytes = readBytes(localUri)
        val url = uploadAndSign(storagePath, bytes, contentType)
        onProgress(1f)
        val row = db.from("attachments").insert(
            buildJsonObject {
                put("id", ContempoBackend.newId())
                put("user_id", uid)
                put("entry_id", entryId)
                put("file_name", fileName)
                put("content_type", contentType)
                put("file_size", bytes.size.toLong())
                put("storage_path", storagePath)
                put("download_url", url)
                put("note", "")
            },
        ) { select() }.decodeSingle<JsonObject>()
        return attachmentFromRow(row) ?: error("uploadAttachment: no row returned")
    }

    override suspend fun deleteAttachment(entryId: String, attachment: Attachment) {
        runCatching { bucket.delete(attachment.storagePath) }
        db.from("attachments").delete { filter { eq("id", attachment.id) } }
    }

    override suspend fun updateAttachmentNote(entryId: String, attachmentId: String, note: String) {
        db.from("attachments").update(buildJsonObject { put("note", note) }) { filter { eq("id", attachmentId) } }
    }

    override suspend fun downloadAttachment(
        entryId: String,
        attachment: Attachment,
        destinationDir: File,
        onProgress: (Float) -> Unit,
    ): File {
        destinationDir.mkdirs()
        val destination = File(destinationDir, "${attachment.id}_${sanitizeFileNameComponent(attachment.fileName)}")
        if (destination.exists()) return destination
        onProgress(0f)
        val bytes = bucket.downloadAuthenticated(attachment.storagePath)
        withContext(Dispatchers.IO) { destination.writeBytes(bytes) }
        onProgress(1f)
        return destination
    }

    override suspend fun submitFeedback(
        imageFile: File,
        region: FeedbackRegion?,
        description: String,
        screenName: String,
        appVersion: String,
        buildNumber: String,
        osVersion: String,
        deviceModel: String,
        locale: String,
    ): AppFeedback {
        val id = ContempoBackend.newId()
        // <uid>/feedback/… : admins may read this folder (storage policy "contempo: own files read").
        val storagePath = "$uid/feedback/$id/screenshot.jpg"
        val bytes = withContext(Dispatchers.IO) { imageFile.readBytes() }
        val url = uploadAndSign(storagePath, bytes, "image/jpeg")
        val row = db.from("app_feedback").insert(
            buildJsonObject {
                put("id", id)
                put("user_id", uid)
                put("description", description)
                put("screenshot_path", storagePath)
                put("download_url", url)
                put("app_version", appVersion)
                put("build_number", buildNumber)
                put("os_version", osVersion)
                put("device_model", deviceModel)
                put("screen_name", screenName)
                put("locale", locale)
                if (region != null) {
                    put("region", buildJsonObject { put("x", region.x); put("y", region.y); put("w", region.w); put("h", region.h) })
                }
            },
        ) { select() }.decodeSingle<JsonObject>()
        return appFeedbackFromRow(row) ?: error("submitFeedback: no row returned")
    }
}

