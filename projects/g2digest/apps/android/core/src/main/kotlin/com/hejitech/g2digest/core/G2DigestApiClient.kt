package com.hejitech.g2digest.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.TimeUnit

class G2DigestApiException(val statusCode: Int, message: String) : Exception(message)

class G2DigestApiClient(
    val baseUrl: String = PROD_BASE_URL,
    val supabaseUrl: String = PROD_SUPABASE_URL,
    val supabaseAnonKey: String = PROD_SUPABASE_ANON_KEY,
    private val bearerProvider: () -> String? = { null },
) {
    companion object {
        const val PROD_BASE_URL = "https://g2digest.hejitech.workers.dev"
        const val PROD_SUPABASE_URL = "https://jitdzllkxfhlrxxvljhp.supabase.co"
        const val PROD_SUPABASE_ANON_KEY = "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
        const val AUTH_REDIRECT = "g2digest://login-callback"

        val json = Json {
            ignoreUnknownKeys = true
            isLenient = true
            explicitNulls = false
        }

        fun generatePkce(): Pair<String, String> {
            val bytes = ByteArray(32)
            SecureRandom().nextBytes(bytes)
            val verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
            val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
            val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
            return verifier to challenge
        }
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    fun googleAuthUrl(codeChallenge: String): String {
        val redir = URLEncoder.encode(AUTH_REDIRECT, "UTF-8")
        return "$supabaseUrl/auth/v1/authorize?provider=google&redirect_to=$redir&code_challenge=$codeChallenge&code_challenge_method=S256"
    }

    suspend fun exchangePkceCode(code: String, verifier: String): AuthSession = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("auth_code", code)
            put("code_verifier", verifier)
        }.toString()
        val req = Request.Builder()
            .url("$supabaseUrl/auth/v1/token?grant_type=pkce")
            .header("apikey", supabaseAnonKey)
            .post(payload.toRequestBody(jsonMedia))
            .build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw G2DigestApiException(resp.code, "Sign-in exchange failed (${resp.code})")
            parseAuthSession(body)
        }
    }

    suspend fun signInWithPassword(email: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("email", email)
            put("password", password)
        }.toString()
        val req = Request.Builder()
            .url("$supabaseUrl/auth/v1/token?grant_type=password")
            .header("apikey", supabaseAnonKey)
            .post(payload.toRequestBody(jsonMedia))
            .build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw G2DigestApiException(resp.code, "Sign-in failed (${resp.code})")
            parseAuthSession(body)
        }
    }

    private fun parseAuthSession(raw: String): AuthSession {
        val obj = json.parseToJsonElement(raw) as JsonObject
        val access = obj["access_token"]?.jsonPrimitive?.content ?: error("missing access_token")
        val refresh = obj["refresh_token"]?.jsonPrimitive?.content ?: ""
        val expiresIn = obj["expires_in"]?.jsonPrimitive?.content?.toLongOrNull() ?: 3600L
        val userEmail = (obj["user"] as? JsonObject)?.get("email")?.jsonPrimitive?.content
        return AuthSession(access, refresh, (System.currentTimeMillis() / 1000L) + expiresIn, userEmail)
    }

    private suspend fun send(path: String, method: String = "GET", bodyJson: String? = null): String = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${baseUrl.trimEnd('/')}$path")
        bearerProvider()?.takeIf { it.isNotBlank() }?.let { builder.header("Authorization", "Bearer $it") }
        when (method) {
            "POST" -> builder.post((bodyJson ?: "{}").toRequestBody(jsonMedia))
            "PUT" -> builder.put((bodyJson ?: "{}").toRequestBody(jsonMedia))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }
        client.newCall(builder.build()).execute().use { resp ->
            val txt = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val msg = runCatching { (json.parseToJsonElement(txt) as? JsonObject)?.get("error")?.jsonPrimitive?.content }.getOrNull()
                throw G2DigestApiException(resp.code, msg ?: "Request failed (${resp.code})")
            }
            txt
        }
    }

    suspend fun redeemPairingCode(code: String, label: String = "Android App"): PairResult {
        val clean = code.filter { it.isDigit() }
        val payload = buildJsonObject { put("code", clean); put("label", label) }.toString()
        return json.decodeFromString(send("/api/pair", "POST", payload))
    }

    suspend fun fetchEditions(): List<EditionSummary> = json.decodeFromString(send("/api/editions"))
    suspend fun fetchEdition(date: String = "latest"): EditionResponse = json.decodeFromString(send("/api/editions/$date"))
    suspend fun fetchBookmarks(): List<BookmarkItem> = json.decodeFromString(send("/api/bookmarks"))
    suspend fun addBookmark(item: BookmarkItem) { send("/api/bookmarks", "POST", json.encodeToString(item)) }
    suspend fun removeBookmark(date: String, slug: String) { send("/api/bookmarks/$date/$slug", "DELETE") }
    suspend fun fetchBuildRuns(): List<BuildRunItem> = json.decodeFromString(send("/api/build-runs"))
    suspend fun searchEditions(query: String): List<SearchHitItem> {
        val q = URLEncoder.encode(query, "UTF-8")
        return json.decodeFromString(send("/api/editions/search?q=$q"))
    }
    suspend fun createShareLink(date: String, label: String? = null): ShareLinkResult {
        val payload = buildJsonObject { put("edition_date", date); if (label != null) put("label", label) }.toString()
        return json.decodeFromString(send("/api/shares", "POST", payload))
    }
    suspend fun createPairingCode(): PairingCode = json.decodeFromString(send("/api/pairing-code", "POST"))
    suspend fun fetchDevices(): List<PairedDevice> = json.decodeFromString(send("/api/devices"))
    suspend fun revokeDevice(id: String) { send("/api/devices/$id", "DELETE") }
    suspend fun createFeed(): FeedLinks = json.decodeFromString(send("/api/feeds", "POST"))
    suspend fun fetchTokens(): List<AgentToken> = json.decodeFromString(send("/api/tokens"))
    suspend fun createToken(name: String): String {
        val payload = buildJsonObject { put("name", name) }.toString()
        val obj = json.parseToJsonElement(send("/api/tokens", "POST", payload)) as JsonObject
        return obj["token"]?.jsonPrimitive?.content ?: ""
    }
    suspend fun revokeToken(id: String) { send("/api/tokens/$id", "DELETE") }
    suspend fun fetchProStatus(): ProStatus = json.decodeFromString(send("/api/pro"))
    suspend fun registerFcmToken(token: String) {
        val payload = buildJsonObject { put("token", token) }.toString()
        send("/api/push/fcm", "POST", payload)
    }
    suspend fun deleteAllData() { send("/api/account", "DELETE") }
}
