package com.hejitech.headway.core.net

import com.hejitech.headway.core.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class HeadwayApiException(val statusCode: Int, val body: String) : Exception("HTTP $statusCode: $body") {
    val isUnauthorized: Boolean get() = statusCode == 401

    /** The Worker's `{ "error": "…" }`, or a short form of what came back. */
    val userMessage: String
        get() = runCatching { Json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull()
            ?: "Server error: ${body.take(160)}"
}

/** No session, or it could not be refreshed: the app goes back to sign-in. */
class NotSignedInException : Exception("Not signed in")

/** A browser sign-in to open, and the PKCE verifier to keep until the browser comes back. */
data class OAuthStart(val url: String, val verifier: String)

class HeadwayApiClient(
    var config: BackendConfig = BackendConfig.PRODUCTION,
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()
) {
    val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    @Volatile
    var session: AuthSession? = null
        private set

    /** Persist the session (the app keeps it encrypted): called on sign-in, refresh and sign-out. */
    var onSessionChange: ((AuthSession?) -> Unit)? = null

    fun setSession(authSession: AuthSession?) {
        session = authSession
        onSessionChange?.invoke(authSession)
    }

    /** Adopts a stored session without telling [onSessionChange] (it came from there). */
    fun restoreSession(authSession: AuthSession?) {
        session = authSession
    }

    fun signOut() = setSession(null)

    // ---------------------------------------------------------------- Supabase Auth (no SDK)

    /**
     * Browser sign-in (Google) with PKCE: open the URL, which returns to [redirect] with a `code`;
     * hand that and the verifier to [exchangeCode].
     */
    fun oauthStart(provider: String, redirect: String): OAuthStart {
        val verifier = b64url(ByteArray(48).also { java.security.SecureRandom().nextBytes(it) })
        val challenge = b64url(java.security.MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))
        val enc = { v: String -> java.net.URLEncoder.encode(v, "UTF-8") }
        return OAuthStart(
            "${config.supabaseUrl}/auth/v1/authorize?provider=${enc(provider)}&redirect_to=${enc(redirect)}&code_challenge=$challenge&code_challenge_method=s256",
            verifier
        )
    }

    suspend fun exchangeCode(code: String, verifier: String): AuthSession = withContext(Dispatchers.IO) {
        authRequest("token?grant_type=pkce", buildJsonObject { put("auth_code", code); put("code_verifier", verifier) })
    }

    /** Email and password for accounts Headway hands out (the store review demo account): checked by the Worker. Not a sign-up. */
    suspend fun reviewSignIn(email: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        val body = buildJsonObject { put("email", email); put("password", password) }.toString().toRequestBody(jsonMediaType)
        adopt(executeRaw(Request.Builder().url("${config.site}/api/review-sign-in").post(body).build()))
    }

    /** Gets a new access token when this one is about to expire. Blocking: call from an IO context. */
    private fun refreshIfNeeded() {
        val s = session ?: throw NotSignedInException()
        if (s.expiresAtMs - System.currentTimeMillis() > 60_000) return
        synchronized(refreshLock) {
            val now = session ?: throw NotSignedInException()
            if (now.expiresAtMs - System.currentTimeMillis() > 60_000) return
            try {
                authRequest("token?grant_type=refresh_token", buildJsonObject { put("refresh_token", now.refreshToken) })
            } catch (e: HeadwayApiException) {
                // A refused refresh token is a dead session; anything else (offline) keeps it for the next try.
                if (e.statusCode == 400 || e.statusCode == 401) {
                    setSession(null)
                    throw NotSignedInException()
                }
                throw e
            }
        }
    }

    private val refreshLock = Any()

    private fun authRequest(path: String, body: JsonObject): AuthSession {
        val request = Request.Builder()
            .url("${config.supabaseUrl}/auth/v1/$path")
            .addHeader("apikey", config.anonKey)
            .post(body.toString().toRequestBody(jsonMediaType))
            .build()
        return adopt(executeRaw(request))
    }

    /** Keeps the session from a Supabase token response (`access_token`, `refresh_token`, `user`, …). */
    private fun adopt(respBody: String): AuthSession {
        val parsed = runCatching { json.parseToJsonElement(respBody).jsonObject }.getOrNull()
        val access = parsed?.get("access_token")?.jsonPrimitive?.contentOrNull
        val refresh = parsed?.get("refresh_token")?.jsonPrimitive?.contentOrNull
        val user = parsed?.get("user") as? JsonObject
        val userId = user?.get("id")?.jsonPrimitive?.contentOrNull
        if (access == null || refresh == null || userId == null) throw HeadwayApiException(500, "Unexpected sign-in response")
        val expiresIn = parsed["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600L
        val authSession = AuthSession(
            accessToken = access,
            refreshToken = refresh,
            userId = userId,
            email = user["email"]?.jsonPrimitive?.contentOrNull,
            expiresAtMs = System.currentTimeMillis() + expiresIn * 1000
        )
        setSession(authSession)
        return authSession
    }

    private fun b64url(bytes: ByteArray): String = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    /** The local stack's demo clock (Debug builds on the local stack only): how far "now" is moved, in ms. */
    suspend fun devClockOffsetMs(): Long = withContext(Dispatchers.IO) {
        val obj: JsonObject = executeAndDecode(Request.Builder().url("${config.site}/api/dev/clock").get().build())
        obj["offset_ms"]?.jsonPrimitive?.doubleOrNull?.toLong() ?: 0L
    }

    suspend fun getStations(): List<Station> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${config.site}/api/stations")
            .get()
            .build()
        executeAndDecode(request)
    }

    suspend fun getBoard(
        from: String,
        to: String,
        express: ExpressPreference? = null
    ): Board = withContext(Dispatchers.IO) {
        val urlBuilder = StringBuilder("${config.site}/api/board?from=$from&to=$to")
        if (express != null && express != ExpressPreference.ALL) {
            urlBuilder.append("&express=${express.value}")
        }
        val request = Request.Builder()
            .url(urlBuilder.toString())
            .get()
            .build()
        executeAndDecode(request)
    }

    suspend fun getMyBoard(
        from: String? = null,
        to: String? = null,
        express: ExpressPreference? = null,
        /** The rider's location for a rough trip estimate to the departure station (not stored). */
        origin: Pair<Double, Double>? = null
    ): MyBoard = withContext(Dispatchers.IO) {
        val params = mutableListOf<String>()
        if (origin != null) params.add(String.format(java.util.Locale.US, "lat=%.4f&lon=%.4f", origin.first, origin.second))
        if (from != null && to != null) {
            params.add("from=$from&to=$to")
        }
        if (express != null && express != ExpressPreference.ALL) {
            params.add("express=${express.value}")
        }
        val query = if (params.isNotEmpty()) "?${params.joinToString("&")}" else ""
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/me/board$query")
            .get()
        addAuthHeader(reqBuilder)
        executeAndDecode(reqBuilder.build())
    }

    suspend fun getSettings(): SettingsResponse = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/settings")
            .get()
        addAuthHeader(reqBuilder)
        executeAndDecode(reqBuilder.build())
    }

    suspend fun saveSettings(settings: Settings): SettingsResponse = withContext(Dispatchers.IO) {
        val bodyObj = buildJsonObject {
            put("settings", json.encodeToJsonElement(settings))
        }
        val body = bodyObj.toString().toRequestBody(jsonMediaType)
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/settings")
            .put(body)
        addAuthHeader(reqBuilder)
        executeAndDecode(reqBuilder.build())
    }

    suspend fun track(tracked: Tracked) = withContext(Dispatchers.IO) {
        val body = json.encodeToString(tracked).toRequestBody(jsonMediaType)
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/track")
            .post(body)
        addAuthHeader(reqBuilder)
        executeEmpty(reqBuilder.build())
    }

    suspend fun untrack() = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/track")
            .delete()
        addAuthHeader(reqBuilder)
        executeEmpty(reqBuilder.build())
    }

    /** Asks which train these fixes are riding. [background] adds a notification if Headway starts tracking it. */
    suspend fun reportOnTrain(samples: List<OnTrainSample>, background: Boolean = false): OnTrainReport = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("samples", json.encodeToJsonElement(samples))
            put("background", background)
        }.toString().toRequestBody(jsonMediaType)
        val builder = Request.Builder().url("${config.site}/api/me/on-train").post(body)
        addAuthHeader(builder)
        executeAndDecode(builder.build())
    }

    /** "Not on this train": no card for a while. */
    suspend fun dismissOnTrain() = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${config.site}/api/me/on-train").delete()
        addAuthHeader(builder)
        executeEmpty(builder.build())
    }

    suspend fun createPairingCode(): PairingCode = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/pairing-code")
            .post("{}".toRequestBody(jsonMediaType))
        addAuthHeader(reqBuilder)
        executeAndDecode(reqBuilder.build())
    }

    suspend fun getDevices(): List<PairedDevice> = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/devices")
            .get()
        addAuthHeader(reqBuilder)
        executeAndDecode(reqBuilder.build())
    }

    suspend fun unpairDevice(id: String) = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/devices/$id")
            .delete()
        addAuthHeader(reqBuilder)
        executeEmpty(reqBuilder.build())
    }

    // ---------------------------------------------------------------- alerts (FCM)

    /** Registers this phone's FCM token for alerts; true when the server can send them. */
    suspend fun registerPush(token: String, label: String): Boolean = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("platform", "android")
            put("token", token)
            put("label", label)
        }.toString().toRequestBody(jsonMediaType)
        val builder = Request.Builder().url("${config.site}/api/push").post(body)
        addAuthHeader(builder)
        executeAndDecode<JsonObject>(builder.build())["configured"]?.jsonPrimitive?.booleanOrNull ?: false
    }

    suspend fun unregisterPush(token: String) = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${config.site}/api/push/${java.net.URLEncoder.encode(token, "UTF-8")}").delete()
        addAuthHeader(builder)
        executeEmpty(builder.build())
    }

    /** Asks the server to send a test alert to every phone of this account. */
    suspend fun testPush() = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${config.site}/api/push/test").post("{}".toRequestBody(jsonMediaType))
        addAuthHeader(builder)
        executeEmpty(builder.build())
    }

    /** "Keep alerting me today": the finished leg's alerts come back until tomorrow. */
    suspend fun resumeCommuteAlerts() = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${config.site}/api/me/commute-done").delete()
        addAuthHeader(builder)
        executeEmpty(builder.build())
    }

    /** A link to a page that follows the tracked train live. */
    suspend fun createEtaShare(name: String? = null): EtaShareResponse = withContext(Dispatchers.IO) {
        val body = buildJsonObject { put("name", name) }.toString().toRequestBody(jsonMediaType)
        val builder = Request.Builder().url("${config.site}/api/me/share").post(body)
        addAuthHeader(builder)
        executeAndDecode(builder.build())
    }

    /** Deletes everything Headway keeps about this account (not the HEJI sign-in itself), then signs out. */
    suspend fun deleteAccount() = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/account")
            .delete("{}".toRequestBody(jsonMediaType))
        addAuthHeader(reqBuilder)
        executeEmpty(reqBuilder.build())
        setSession(null)
    }

    /** Email and password straight to Supabase: the local seed account only (Debug builds). */
    suspend fun signInEmail(email: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        authRequest("token?grant_type=password", buildJsonObject { put("email", email); put("password", password) })
    }

    // ---------------------------------------------------------------- family group

    private suspend fun family(method: String, path: String = "", body: JsonElement? = null): FamilyState = withContext(Dispatchers.IO) {
        val reqBody = (body?.toString() ?: "{}").toRequestBody(jsonMediaType)
        val builder = Request.Builder().url("${config.site}/api/family$path")
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(reqBody)
            "PUT" -> builder.put(reqBody)
            "DELETE" -> builder.delete()
        }
        addAuthHeader(builder)
        executeAndDecode(builder.build())
    }

    suspend fun getFamily(): FamilyState = family("GET")

    suspend fun createFamily(name: String, displayName: String): FamilyState =
        family("POST", body = buildJsonObject { put("name", name); put("display_name", displayName) })

    suspend fun renameFamily(name: String): FamilyState = family("PUT", body = buildJsonObject { put("name", name) })

    /** Leaves the group; the owner leaving deletes it. */
    suspend fun leaveFamily(): FamilyState = family("DELETE")

    suspend fun invite(email: String): FamilyState = family("POST", "/invites", buildJsonObject { put("email", email) })
    suspend fun cancelInvite(id: String): FamilyState = family("DELETE", "/invites/$id")
    suspend fun acceptInvite(id: String): FamilyState = family("POST", "/invites/$id/accept")
    suspend fun declineInvite(id: String): FamilyState = family("POST", "/invites/$id/decline")
    suspend fun removeMember(userId: String): FamilyState = family("DELETE", "/members/$userId")

    /** Changes your own row: your name, who sees each share (absent: off), what you follow of whom. Null leaves a field as it is. */
    suspend fun updateFamily(
        displayName: String? = null,
        shares: Map<ShareKind, List<String>>? = null,
        follows: Map<String, FollowPrefs>? = null
    ): FamilyState = family("PUT", "/me", buildJsonObject {
        if (displayName != null) put("display_name", displayName)
        if (shares != null) put("shares", buildJsonObject { shares.forEach { (k, v) -> put(k.value, JsonArray(v.map { JsonPrimitive(it) })) } })
        if (follows != null) put("follows", buildJsonObject { follows.forEach { (id, f) -> put(id, json.encodeToJsonElement(f)) } })
    })

    suspend fun setStatus(code: StatusCode, minutes: Int): FamilyState =
        family("PUT", "/status", buildJsonObject { put("code", code.value); put("minutes", minutes) })

    suspend fun clearStatus(): FamilyState = family("DELETE", "/status")

    /** Every signed-in call goes through here (on an IO thread): refreshes the token first. */
    private fun addAuthHeader(builder: Request.Builder) {
        refreshIfNeeded()
        val token = session?.accessToken ?: throw NotSignedInException()
        builder.addHeader("Authorization", "Bearer $token")
    }

    private fun executeRaw(request: Request): String {
        httpClient.newCall(request).execute().use { resp ->
            val respBody = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw HeadwayApiException(resp.code, respBody)
            return respBody
        }
    }

    private inline fun <reified T> executeAndDecode(request: Request): T = json.decodeFromString(executeRaw(request))

    private fun executeEmpty(request: Request) {
        executeRaw(request)
    }
}
