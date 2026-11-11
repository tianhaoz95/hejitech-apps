package com.hejitech.fitloop.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.TimeUnit

/**
 * Where the app talks to: the FitLoop Worker (every API call) and the shared Supabase project
 * (sign-in only). Release builds use production; debug builds the local stack unless launched with
 * `--ez production true`.
 */
data class BackendConfig(val site: String, val supabaseUrl: String, val anonKey: String) {
    companion object {
        /** The hosted FitLoop Worker and the Supabase project every HEJI app shares (publishable key: safe to ship). */
        val PRODUCTION = BackendConfig(
            site = "https://fitloop.hejitech.workers.dev",
            supabaseUrl = "https://jitdzllkxfhlrxxvljhp.supabase.co",
            anonKey = "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8",
        )

        /**
         * `npm run dev:worker -w @fitloop/web` and `supabase start` on the Mac. A device or emulator
         * reaches them through `adb reverse tcp:8794 tcp:8794` and `adb reverse tcp:55421 tcp:55421`.
         */
        val LOCAL = BackendConfig(
            site = "http://127.0.0.1:8794",
            supabaseUrl = "http://127.0.0.1:55421",
            anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
        )
    }
}

@Serializable
data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String? = null,
    /** Epoch milliseconds. */
    val expiresAt: Long,
)

sealed class BackendException(message: String) : Exception(message) {
    class Http(val code: Int, val body: String) : BackendException(messageOf(body))
    class NotSignedIn : BackendException("Not signed in")
    class Decode(detail: String) : BackendException("Unexpected server response: $detail")

    val isUnauthorized: Boolean get() = this is Http && code == 401

    companion object {
        /** The Worker's `{"error": "..."}`, else the start of the body. */
        fun messageOf(body: String): String =
            runCatching { Json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.contentOrNull }.getOrNull()
                ?: "Server error: ${body.take(160)}"
    }
}

/** A browser sign-in in progress: open [url], then hand the callback's `code` and [verifier] to `exchangeCode`. */
data class OAuthStart(val url: String, val verifier: String)

/**
 * Supabase Auth (Google through the browser with PKCE, refresh) and the Worker's API with the
 * session's access token. No SDK.
 */
class Backend(
    val config: BackendConfig,
    session: AuthSession? = null,
    private val http: OkHttpClient = OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS).build(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    @Volatile
    var session: AuthSession? = session
        private set

    /** Persist the session (the app keeps it encrypted with an Android Keystore key). */
    var onSessionChange: ((AuthSession?) -> Unit)? = null

    private fun setSession(s: AuthSession?) {
        session = s
        onSessionChange?.invoke(s)
    }

    // ---- auth

    fun oauthStart(provider: String, redirect: String): OAuthStart {
        val verifier = randomUrlSafe(48)
        val challenge = base64Url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        val url = "${config.supabaseUrl}/auth/v1/authorize".toHttpUrl().newBuilder()
            .addQueryParameter("provider", provider)
            .addQueryParameter("redirect_to", redirect)
            .addQueryParameter("code_challenge", challenge)
            .addQueryParameter("code_challenge_method", "s256")
            .build()
        return OAuthStart(url.toString(), verifier)
    }

    suspend fun exchangeCode(code: String, verifier: String): AuthSession =
        authRequest("token?grant_type=pkce", mapOf("auth_code" to code, "code_verifier" to verifier))

    /** Email and password: the local seed account only (debug builds). */
    suspend fun signIn(email: String, password: String): AuthSession =
        authRequest("token?grant_type=password", mapOf("email" to email, "password" to password))

    /**
     * Email and password for accounts FitLoop hands out (the store reviewers' demo account): checked
     * by the Worker (`/api/review-sign-in`), which returns a normal Supabase session. Not a sign-up.
     */
    suspend fun reviewSignIn(email: String, password: String): AuthSession {
        val body = buildJsonObject { put("email", email); put("password", password) }.toString()
        return adopt(execute(Request.Builder().url("${config.site}/api/review-sign-in").post(body.toRequestBody(JSON_TYPE)).build()))
    }

    fun signOut() = setSession(null)

    suspend fun refreshIfNeeded() {
        val s = session ?: throw BackendException.NotSignedIn()
        if (s.expiresAt - now() > 60_000) return
        try {
            authRequest("token?grant_type=refresh_token", mapOf("refresh_token" to s.refreshToken))
        } catch (e: BackendException.Http) {
            if (e.code != 400 && e.code != 401) throw e
            setSession(null)
            throw BackendException.NotSignedIn()
        }
    }

    private suspend fun authRequest(path: String, body: Map<String, String>): AuthSession {
        val json = buildJsonObject { body.forEach { (k, v) -> put(k, v) } }.toString()
        val req = Request.Builder().url("${config.supabaseUrl}/auth/v1/$path").header("apikey", config.anonKey)
            .post(json.toRequestBody(JSON_TYPE)).build()
        return adopt(execute(req))
    }

    /** Keeps the session from a Supabase token response (`access_token`, `refresh_token`, `user`, …). */
    private fun adopt(text: String): AuthSession {
        val s = runCatching {
            val obj = Json.parseToJsonElement(text).jsonObject
            val user = obj.getValue("user").jsonObject
            AuthSession(
                accessToken = obj.getValue("access_token").jsonPrimitive.content,
                refreshToken = obj.getValue("refresh_token").jsonPrimitive.content,
                userId = user.getValue("id").jsonPrimitive.content,
                email = user["email"]?.jsonPrimitive?.contentOrNull,
                expiresAt = now() + ((obj["expires_in"]?.jsonPrimitive?.doubleOrNull ?: 3600.0) * 1000).toLong(),
            )
        }.getOrElse { throw BackendException.Decode(text.take(200)) }
        setSession(s)
        return s
    }

    private suspend fun execute(req: Request): String = withContext(Dispatchers.IO) {
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string() ?: ""
            if (!resp.isSuccessful) throw BackendException.Http(resp.code, text)
            text
        }
    }

    // ---- Worker API

    /** Calls the Worker with the session and returns the response body. */
    suspend fun raw(method: String, path: String, body: String? = null): String {
        refreshIfNeeded()
        val s = session ?: throw BackendException.NotSignedIn()
        val req = Request.Builder().url(config.site + path)
            .header("X-FitLoop-Client", "phone")
            .header("Authorization", "Bearer ${s.accessToken}")
            .method(method, body?.toRequestBody(JSON_TYPE) ?: if (method == "POST" || method == "PUT") "".toRequestBody(null) else null)
            .build()
        return execute(req)
    }

    private suspend inline fun <reified T> call(method: String, path: String, body: String? = null): T {
        val text = raw(method, path, body)
        return try {
            json.decodeFromString<T>(text)
        } catch (e: Exception) {
            throw BackendException.Decode(e.message?.take(200) ?: "")
        }
    }

    suspend fun today(date: String): TodayResponse = call("GET", "/api/today?date=$date")
    suspend fun plan(): PlanResponse = call("GET", "/api/plan")
    suspend fun checkin(c: List<NewCheckin>) { raw("POST", "/api/checkins", json.encodeToString(c)) }
    suspend fun feedback(): List<Feedback> = call("GET", "/api/feedback")
    suspend fun sendFeedback(f: NewFeedback) { raw("POST", "/api/feedback", json.encodeToString(f)) }
    suspend fun deleteFeedback(id: String) { raw("DELETE", "/api/feedback/$id") }
    suspend fun progress(from: String, to: String): ProgressResponse = call("GET", "/api/progress?from=$from&to=$to")
    suspend fun settings(): SettingsResponse = call("GET", "/api/settings")
    suspend fun save(settings: Settings): SettingsResponse =
        call("PUT", "/api/settings", JsonObject(mapOf("settings" to json.encodeToJsonElement(Settings.serializer(), settings))).toString())
    suspend fun sendVitals(v: List<Vital>) { raw("POST", "/api/vitals", json.encodeToString(v)) }
    suspend fun photos(): List<Photo> = call("GET", "/api/photos")
    suspend fun deletePhoto(id: String) { raw("DELETE", "/api/photos/$id") }

    /** Uploads a JPEG progress photo. */
    suspend fun uploadPhoto(jpeg: ByteArray, takenOn: String) {
        refreshIfNeeded()
        val s = session ?: throw BackendException.NotSignedIn()
        execute(
            Request.Builder().url("${config.site}/api/photos?taken_on=$takenOn")
                .header("Authorization", "Bearer ${s.accessToken}")
                .post(jpeg.toRequestBody("image/jpeg".toMediaType())).build(),
        )
    }

    suspend fun pairingCode(): PairingCode = call("POST", "/api/pairing-code")
    suspend fun devices(): List<PairedDevice> = call("GET", "/api/devices")
    suspend fun unpair(id: String) { raw("DELETE", "/api/devices/$id") }
    suspend fun deleteData() { raw("DELETE", "/api/account", "{}") }

    /** Downloads bytes (a progress photo's signed URL). */
    suspend fun download(url: String): ByteArray = withContext(Dispatchers.IO) {
        http.newCall(Request.Builder().url(url).build()).execute().use { resp ->
            if (!resp.isSuccessful) throw BackendException.Http(resp.code, "")
            resp.body?.bytes() ?: ByteArray(0)
        }
    }

    companion object {
        /** Unknown fields are ignored (the Worker may add some); nulls aren't sent; defaults are (settings go up whole). */
        val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = true
        }
        private val JSON_TYPE = "application/json".toMediaType()

        fun base64Url(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

        fun randomUrlSafe(bytes: Int): String = base64Url(ByteArray(bytes).also { SecureRandom().nextBytes(it) })
    }
}
