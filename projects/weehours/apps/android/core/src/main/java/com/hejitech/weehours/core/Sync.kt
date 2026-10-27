package com.hejitech.weehours.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

@Serializable
data class BackendConfig(
    val url: String,
    val anonKey: String
) {
    companion object {
        val local = BackendConfig(
            url = "http://10.0.2.2:55421",
            anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        )

        val production = BackendConfig(
            url = "https://jitdzllkxfhlrxxvljhp.supabase.co",
            anonKey = "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
        )

        const val schema = "weehours"
        const val bucket = "weehours"
        const val siteUrl = "https://weehours.app"
    }
}

@Serializable
data class AuthSession(
    @SerialName("access_token") var accessToken: String,
    @SerialName("refresh_token") var refreshToken: String,
    @SerialName("user_id") @Serializable(with = UUIDSerializer::class) var userId: UUID,
    var email: String? = null,
    @SerialName("expires_at") @Serializable(with = DateIsoSerializer::class) var expiresAt: Date
)

sealed class BackendError(message: String) : Exception(message) {
    class Http(val code: Int, val body: String) : BackendError("Server error $code: ${body.take(200)}")
    object NotSignedIn : BackendError("Not signed in")
    class Decode(val reason: String) : BackendError("Unexpected server response: $reason")
}

@Serializable
data class AccessToken(
    @Serializable(with = UUIDSerializer::class) val id: UUID,
    val name: String,
    val scope: String,
    @SerialName("created_at") @Serializable(with = DateIsoSerializer::class) val createdAt: Date,
    @SerialName("last_used_at") @Serializable(with = DateIsoSerializer::class) val lastUsedAt: Date? = null,
    @SerialName("revoked_at") @Serializable(with = DateIsoSerializer::class) val revokedAt: Date? = null
)

data class GlassesPairingCode(
    val code: String,
    val createdAt: Date,
    val expiresAt: Date
)

class SupabaseClient(
    val config: BackendConfig = BackendConfig.production,
    initialSession: AuthSession? = null,
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()
) {
    private val lock = Any()
    var session: AuthSession? = initialSession
        private set
    var onSessionUpdated: ((AuthSession?) -> Unit)? = null

    private fun currentSession(): AuthSession? = synchronized(lock) { session }

    fun updateSession(s: AuthSession?) {
        synchronized(lock) { session = s }
        onSessionUpdated?.invoke(s)
    }

    suspend fun signUp(email: String, password: String): AuthSession {
        val body = buildJsonObject {
            put("email", JsonPrimitive(email))
            put("password", JsonPrimitive(password))
        }
        return authRequest("signup", body)
    }

    suspend fun signIn(email: String, password: String): AuthSession {
        val body = buildJsonObject {
            put("email", JsonPrimitive(email))
            put("password", JsonPrimitive(password))
        }
        return authRequest("token?grant_type=password", body)
    }

    suspend fun signIn(provider: String, idToken: String, nonce: String? = null): AuthSession {
        val body = buildJsonObject {
            put("provider", JsonPrimitive(provider))
            put("id_token", JsonPrimitive(idToken))
            if (nonce != null) put("nonce", JsonPrimitive(nonce))
        }
        return authRequest("token?grant_type=id_token", body)
    }

    fun oauthStart(provider: String, redirect: String): Pair<String, String> {
        val verifier = randomURLSafe(48)
        val challengeBytes = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.UTF_8))
        val challenge = base64UrlEncode(challengeBytes)
        val base = config.url.trimEnd('/')
        val url = "$base/auth/v1/authorize" +
            "?provider=${URLEncoder.encode(provider, "UTF-8")}" +
            "&redirect_to=${URLEncoder.encode(redirect, "UTF-8")}" +
            "&code_challenge=${URLEncoder.encode(challenge, "UTF-8")}" +
            "&code_challenge_method=s256"
        return url to verifier
    }

    suspend fun exchangeCode(code: String, verifier: String): AuthSession {
        val body = buildJsonObject {
            put("auth_code", JsonPrimitive(code))
            put("code_verifier", JsonPrimitive(verifier))
        }
        return authRequest("token?grant_type=pkce", body)
    }

    suspend fun refreshIfNeeded() {
        val s = currentSession() ?: throw BackendError.NotSignedIn
        if ((s.expiresAt.time - System.currentTimeMillis()) > 60_000L) return
        val body = buildJsonObject {
            put("refresh_token", JsonPrimitive(s.refreshToken))
        }
        authRequest("token?grant_type=refresh_token", body)
    }

    fun signOut() {
        updateSession(null)
    }

    suspend fun sessionToken(): String {
        refreshIfNeeded()
        val s = currentSession() ?: throw BackendError.NotSignedIn
        return s.accessToken
    }

    private suspend fun authRequest(path: String, body: JsonObject): AuthSession = withContext(Dispatchers.IO) {
        val base = config.url.trimEnd('/')
        val req = Request.Builder()
            .url("$base/auth/v1/$path")
            .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .header("apikey", config.anonKey)
            .header("Content-Type", "application/json")
            .build()
        http.newCall(req).execute().use { resp ->
            val data = resp.body?.bytes() ?: ByteArray(0)
            check(resp.code, data)
            val text = String(data, Charsets.UTF_8)
            val obj = try {
                LogCoding.json.parseToJsonElement(text).jsonObject
            } catch (_: Exception) {
                throw BackendError.Decode(text.take(200))
            }
            val access = obj["access_token"]?.jsonPrimitive?.content
            val refresh = obj["refresh_token"]?.jsonPrimitive?.content
            val user = obj["user"] as? JsonObject
            val idStr = user?.get("id")?.jsonPrimitive?.content
            if (access == null || refresh == null || idStr == null) {
                throw BackendError.Decode(text.take(200))
            }
            val expiresSec = obj["expires_in"]?.jsonPrimitive?.doubleOrNull?.toLong() ?: 3600L
            val email = user["email"]?.let { if (it is JsonNull) null else it.jsonPrimitive.content }
            val s = AuthSession(
                accessToken = access,
                refreshToken = refresh,
                userId = UUID.fromString(idStr),
                email = email,
                expiresAt = Date(System.currentTimeMillis() + expiresSec * 1000L)
            )
            updateSession(s)
            s
        }
    }

    suspend fun request(
        method: String,
        path: String,
        body: ByteArray? = null,
        prefer: String? = null,
        contentType: String = "application/json",
        headers: Map<String, String> = emptyMap()
    ): ByteArray = withContext(Dispatchers.IO) {
        refreshIfNeeded()
        val s = currentSession() ?: throw BackendError.NotSignedIn
        val base = config.url.trimEnd('/')
        val reqBody = body?.toRequestBody(contentType.toMediaType())
            ?: if (method == "POST" || method == "PUT" || method == "PATCH") ByteArray(0).toRequestBody(contentType.toMediaType()) else null
        val builder = Request.Builder()
            .url("$base$path")
            .method(method, reqBody)
            .header("apikey", config.anonKey)
            .header("Authorization", "Bearer ${s.accessToken}")
            .header("Content-Type", contentType)
        if (path.startsWith("/rest/")) {
            builder.header("Accept-Profile", BackendConfig.schema)
            builder.header("Content-Profile", BackendConfig.schema)
        }
        if (prefer != null) builder.header("Prefer", prefer)
        for ((k, v) in headers) builder.header(k, v)
        http.newCall(builder.build()).execute().use { resp ->
            val respBytes = resp.body?.bytes() ?: ByteArray(0)
            check(resp.code, respBytes)
            respBytes
        }
    }

    suspend fun rpc(fn: String, args: JsonObject = JsonObject(emptyMap())): ByteArray =
        request("POST", "/rest/v1/rpc/$fn", body = args.toString().toByteArray(Charsets.UTF_8))

    suspend fun pushEvents(events: List<LogEvent>) {
        for (batch in sameShapeBatches(events, LogEvent.serializer())) {
            request(
                method = "POST",
                path = "/rest/v1/events?on_conflict=id",
                body = batch.toByteArray(Charsets.UTF_8),
                prefer = "resolution=ignore-duplicates,return=minimal"
            )
        }
    }

    suspend fun pullEvents(household: UUID, after: Long, limit: Int = 500): Pair<List<LogEvent>, Long> {
        val hid = household.toString().lowercase(Locale.ROOT)
        val bytes = request("GET", "/rest/v1/events?household_id=eq.$hid&seq=gt.$after&order=seq.asc&limit=$limit")
        val text = String(bytes, Charsets.UTF_8)
        val events = LogCoding.json.decodeFromString(ListSerializer(LogEvent.serializer()), text)
        val arr = LogCoding.json.parseToJsonElement(text).jsonArray
        var maxSeq = after
        for (elem in arr) {
            val seq = elem.jsonObject["seq"]?.jsonPrimitive?.longOrNull ?: after
            if (seq > maxSeq) maxSeq = seq
        }
        return events to maxSeq
    }

    suspend fun pushCaptures(captures: List<Capture>) {
        for (batch in sameShapeBatches(captures, Capture.serializer())) {
            request(
                method = "POST",
                path = "/rest/v1/captures?on_conflict=id",
                body = batch.toByteArray(Charsets.UTF_8),
                prefer = "resolution=merge-duplicates,return=minimal"
            )
        }
    }

    suspend fun openCaptures(household: UUID): List<Capture> {
        val hid = household.toString().lowercase(Locale.ROOT)
        val bytes = request("GET", "/rest/v1/captures?household_id=eq.$hid&status=in.(pending,needs_review)&order=captured_at.asc")
        return LogCoding.json.decodeFromString(ListSerializer(Capture.serializer()), String(bytes, Charsets.UTF_8))
    }

    suspend fun downloadAudio(path: String): ByteArray =
        request("GET", "/storage/v1/object/${BackendConfig.bucket}/$path")

    suspend fun deleteAudio(path: String) {
        request("DELETE", "/storage/v1/object/${BackendConfig.bucket}/$path")
    }

    suspend fun uploadAudio(path: String, data: ByteArray, contentType: String = "audio/wav") {
        request("POST", "/storage/v1/object/${BackendConfig.bucket}/$path", body = data, contentType = contentType)
    }

    suspend fun uploadPhoto(key: String, data: ByteArray) {
        request(
            "POST",
            "/storage/v1/object/${BackendConfig.bucket}/$key",
            body = data,
            contentType = "image/jpeg",
            headers = mapOf("x-upsert" to "true")
        )
    }

    suspend fun downloadPhoto(key: String): ByteArray =
        request("GET", "/storage/v1/object/${BackendConfig.bucket}/$key")

    suspend fun deletePhoto(key: String) {
        request("DELETE", "/storage/v1/object/${BackendConfig.bucket}/$key")
    }

    suspend fun createHousehold(h: Household, displayName: String) {
        val args = buildJsonObject {
            put("p_id", JsonPrimitive(h.id.uuidString()))
            put("p_name", JsonPrimitive(h.name))
            put("p_baby_id", JsonPrimitive(h.babyId.uuidString()))
            put("p_baby_name", JsonPrimitive(h.babyName))
            put("p_birth_date", h.birthDate?.let { JsonPrimitive(LogCoding.dayString(it)) } ?: JsonNull)
            put("p_settings", settingsJSON(h))
            put("p_display_name", JsonPrimitive(displayName))
        }
        rpc("create_household", args)
        if (h.babies.size > 1) saveBabies(h)
    }

    suspend fun saveSettings(h: Household) {
        val args = buildJsonObject {
            put("p_id", JsonPrimitive(h.id.uuidString()))
            put("p_name", JsonPrimitive(h.name))
            put("p_baby_name", JsonPrimitive(h.babyName))
            put("p_birth_date", h.birthDate?.let { JsonPrimitive(LogCoding.dayString(it)) } ?: JsonNull)
            put("p_settings", settingsJSON(h))
        }
        rpc("update_household", args)
        saveBabies(h)
    }

    suspend fun saveBabies(h: Household) {
        val rows = JsonArray(
            h.babies.map { b ->
                buildJsonObject {
                    put("id", JsonPrimitive(b.id.uuidString()))
                    put("name", JsonPrimitive(b.name))
                    put("birth_date", b.birthDate?.let { JsonPrimitive(LogCoding.dayString(it)) } ?: JsonNull)
                    put("position", JsonPrimitive(b.position))
                    put("archived", JsonPrimitive(b.archived))
                    b.color?.let { put("color", JsonPrimitive(it)) }
                    b.bottleMl?.let { put("bottle_ml", JsonPrimitive(it)) }
                    b.defaultFeed?.let { put("default_feed", JsonPrimitive(it)) }
                    b.dueDate?.let { put("due_date", JsonPrimitive(LogCoding.dayString(it))) }
                }
            }
        )
        rpc("save_babies", buildJsonObject { put("p_babies", rows) })
    }

    suspend fun myHousehold(): Household? {
        val bytes = rpc("my_household")
        val text = String(bytes, Charsets.UTF_8).trim()
        if (text.isEmpty() || text == "null") return null
        return LogCoding.json.decodeFromString(Household.serializer(), text)
    }

    suspend fun createInvite(): String {
        val bytes = rpc("create_invite")
        val text = String(bytes, Charsets.UTF_8).trim()
        return text.removeSurrounding("\"")
    }

    suspend fun joinHousehold(code: String, displayName: String) {
        rpc("join_household", buildJsonObject {
            put("p_code", JsonPrimitive(code))
            put("p_display_name", JsonPrimitive(displayName))
        })
    }

    suspend fun deleteHouseholdData() {
        val idBytes = rpc("my_household_id")
        val hid = String(idBytes, Charsets.UTF_8).trim().removeSurrounding("\"")
        if (hid.isNotEmpty() && hid != "null") {
            for (folder in listOf(hid, "$hid/photos")) {
                while (true) {
                    val listBody = buildJsonObject {
                        put("prefix", JsonPrimitive(folder))
                        put("limit", JsonPrimitive(1000))
                    }
                    val listing = request(
                        "POST",
                        "/storage/v1/object/list/${BackendConfig.bucket}",
                        body = listBody.toString().toByteArray(Charsets.UTF_8)
                    )
                    val arr = LogCoding.json.parseToJsonElement(String(listing, Charsets.UTF_8)).jsonArray
                    val names = arr.mapNotNull { elem ->
                        val item = elem.jsonObject
                        val idElem = item["id"]
                        if (idElem != null && idElem !is JsonNull) {
                            item["name"]?.jsonPrimitive?.content
                        } else null
                    }
                    if (names.isEmpty()) break
                    val delBody = buildJsonObject {
                        put("prefixes", JsonArray(names.map { JsonPrimitive("$folder/$it") }))
                    }
                    request(
                        "DELETE",
                        "/storage/v1/object/${BackendConfig.bucket}",
                        body = delBody.toString().toByteArray(Charsets.UTF_8)
                    )
                    if (names.size < 1000) break
                }
            }
        }
        rpc("delete_household")
    }

    suspend fun fetchEntitlement(): Entitlement? {
        val bytes = rpc("my_entitlement")
        val text = String(bytes, Charsets.UTF_8).trim()
        if (text.isEmpty() || text == "null") return null
        return LogCoding.json.decodeFromString(Entitlement.serializer(), text)
    }

    suspend fun recordPurchase(plan: Plan, expiresAt: Date?) {
        val args = buildJsonObject {
            put("p_plan", JsonPrimitive(plan.rawValue))
            put("p_expires_at", expiresAt?.let { JsonPrimitive(LogCoding.isoString(it)) } ?: JsonNull)
        }
        rpc("record_purchase", args)
    }

    suspend fun createAccessToken(name: String, scope: String): String {
        val bytes = rpc("create_access_token", buildJsonObject {
            put("p_name", JsonPrimitive(name))
            put("p_scope", JsonPrimitive(scope))
        })
        return String(bytes, Charsets.UTF_8).trim().removeSurrounding("\"")
    }

    suspend fun accessTokens(): List<AccessToken> {
        val bytes = request("GET", "/rest/v1/access_tokens?select=id,name,scope,created_at,last_used_at,revoked_at&order=created_at.desc")
        return LogCoding.json.decodeFromString(ListSerializer(AccessToken.serializer()), String(bytes, Charsets.UTF_8))
    }

    suspend fun revokeAccessToken(id: UUID) {
        rpc("revoke_access_token", buildJsonObject { put("p_id", JsonPrimitive(id.uuidString())) })
    }

    suspend fun deleteAccessToken(id: UUID) {
        rpc("delete_access_token", buildJsonObject { put("p_id", JsonPrimitive(id.uuidString())) })
    }

    suspend fun setDisplayName(name: String) {
        rpc("set_display_name", buildJsonObject { put("p_name", JsonPrimitive(name)) })
    }

    suspend fun requestGlassesPairingCode(siteUrl: String = BackendConfig.siteUrl): GlassesPairingCode? = withContext(Dispatchers.IO) {
        val token = sessionToken()
        val req = Request.Builder()
            .url("${siteUrl.trimEnd('/')}/api/glasses/pairing-code")
            .post(ByteArray(0).toRequestBody("application/json".toMediaType()))
            .header("Authorization", "Bearer $token")
            .build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return@withContext null
            val bodyStr = resp.body?.string() ?: return@withContext null
            val obj = LogCoding.json.parseToJsonElement(bodyStr).jsonObject
            val code = obj["code"]?.jsonPrimitive?.content ?: return@withContext null
            val expiresStr = obj["expires_at"]?.jsonPrimitive?.content
            val expiresAt = (expiresStr?.let { LogCoding.parseISO(it) })
                ?: Date(System.currentTimeMillis() + 600_000L)
            GlassesPairingCode(code = code, createdAt = Date(), expiresAt = expiresAt)
        }
    }

    private fun settingsJSON(h: Household): JsonObject {
        val obj = LogCoding.json.encodeToJsonElement(Household.serializer(), h).jsonObject
        val filtered = obj.filterKeys { it !in setOf("babies", "baby_id", "baby_name", "birth_date") }
        return JsonObject(filtered)
    }

    companion object {
        fun check(code: Int, data: ByteArray) {
            if (code !in 200..299) {
                throw BackendError.Http(code, String(data, Charsets.UTF_8))
            }
        }

        fun <T> sameShapeBatches(items: List<T>, serializer: KSerializer<T>): List<String> {
            val runs = mutableListOf<Pair<List<String>, MutableList<JsonObject>>>()
            for (item in items) {
                val obj = LogCoding.json.encodeToJsonElement(serializer, item).jsonObject
                val keys = obj.keys.sorted()
                val last = runs.lastOrNull()
                if (last != null && last.first == keys) {
                    last.second.add(obj)
                } else {
                    runs.add(keys to mutableListOf(obj))
                }
            }
            return runs.map { JsonArray(it.second).toString() }
        }

        fun randomURLSafe(bytes: Int): String {
            val buf = ByteArray(bytes)
            SecureRandom().nextBytes(buf)
            return base64UrlEncode(buf)
        }

        fun base64UrlEncode(data: ByteArray): String =
            Base64.getUrlEncoder().withoutPadding().encodeToString(data)
    }
}
