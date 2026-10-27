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

class HeadwayApiException(val statusCode: Int, message: String) : Exception("HTTP $statusCode: $message")

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

    fun setSession(authSession: AuthSession?) {
        session = authSession
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
        express: ExpressPreference? = null
    ): MyBoard = withContext(Dispatchers.IO) {
        val params = mutableListOf<String>()
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

    suspend fun deleteAccount() = withContext(Dispatchers.IO) {
        val reqBuilder = Request.Builder()
            .url("${config.site}/api/account")
            .delete()
        addAuthHeader(reqBuilder)
        executeEmpty(reqBuilder.build())
        session = null
    }

    suspend fun signInEmail(email: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        val bodyObj = buildJsonObject {
            put("email", email)
            put("password", password)
        }
        val body = bodyObj.toString().toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("${config.supabaseUrl}/auth/v1/token?grant_type=password")
            .addHeader("apikey", config.anonKey)
            .post(body)
            .build()

        val resp = httpClient.newCall(request).execute()
        val respBody = resp.body?.string().orEmpty()
        if (!resp.isSuccessful) {
            throw HeadwayApiException(resp.code, respBody)
        }
        val parsed = json.parseToJsonElement(respBody).jsonObject
        val access = parsed["access_token"]?.jsonPrimitive?.content
            ?: throw HeadwayApiException(500, "Missing access_token")
        val refresh = parsed["refresh_token"]?.jsonPrimitive?.content ?: ""
        val userObj = parsed["user"]?.jsonObject
        val userId = userObj?.get("id")?.jsonPrimitive?.content ?: ""
        val userEmail = userObj?.get("email")?.jsonPrimitive?.content
        val expiresIn = parsed["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600L

        val authSession = AuthSession(
            accessToken = access,
            refreshToken = refresh,
            userId = userId,
            email = userEmail,
            expiresAtMs = System.currentTimeMillis() + (expiresIn * 1000)
        )
        session = authSession
        authSession
    }

    private fun addAuthHeader(builder: Request.Builder) {
        val token = session?.accessToken
        if (!token.isNullOrEmpty()) {
            builder.addHeader("Authorization", "Bearer $token")
        }
    }

    private inline fun <reified T> executeAndDecode(request: Request): T {
        val resp = httpClient.newCall(request).execute()
        val respBody = resp.body?.string().orEmpty()
        if (!resp.isSuccessful) {
            throw HeadwayApiException(resp.code, respBody)
        }
        return json.decodeFromString(respBody)
    }

    private fun executeEmpty(request: Request) {
        val resp = httpClient.newCall(request).execute()
        val respBody = resp.body?.string().orEmpty()
        if (!resp.isSuccessful) {
            throw HeadwayApiException(resp.code, respBody)
        }
    }
}
