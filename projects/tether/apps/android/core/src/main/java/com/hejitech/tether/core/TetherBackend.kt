package com.hejitech.tether.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.TimeUnit

data class BackendConfig(
    val siteUrl: String,
    val supabaseUrl: String,
    val anonKey: String
) {
    companion object {
        val PRODUCTION = BackendConfig(
            siteUrl = "https://tether.hejitech.workers.dev",
            supabaseUrl = "https://jitdzllkxfhlrxxvljhp.supabase.co",
            anonKey = "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
        )

        val LOCAL = BackendConfig(
            siteUrl = "http://10.0.2.2:8796",
            supabaseUrl = "http://10.0.2.2:55421",
            anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        )
    }
}

@Serializable
data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String? = null,
    val expiresAtEpochMs: Long
)

class TetherBackend(
    val config: BackendConfig = BackendConfig.PRODUCTION,
    initialSession: AuthSession? = null
) {
    var session: AuthSession? = initialSession
        private set

    var onSessionChanged: ((AuthSession?) -> Unit)? = null

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    fun updateSession(newSession: AuthSession?) {
        session = newSession
        onSessionChanged?.invoke(newSession)
    }

    fun oauthStart(provider: String = "google", redirectUri: String = "tether://auth-callback"): Pair<String, String> {
        val randomBytes = ByteArray(48).also { SecureRandom().nextBytes(it) }
        val verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes)
        val challengeBytes = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.UTF_8))
        val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes)
        val url = "${config.supabaseUrl}/auth/v1/authorize?provider=$provider&redirect_to=$redirectUri&code_challenge=$challenge&code_challenge_method=s256"
        return url to verifier
    }

    suspend fun signInWithEmailPassword(email: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        val bodyStr = """{"email":"$email","password":"$password"}"""
        val req = Request.Builder()
            .url("${config.supabaseUrl}/auth/v1/token?grant_type=password")
            .addHeader("apikey", config.anonKey)
            .addHeader("Content-Type", "application/json")
            .post(bodyStr.toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(req).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("Sign-in failed (${resp.code}): $raw")
            val obj = json.parseToJsonElement(raw) as JsonObject
            val access = obj["access_token"]!!.jsonPrimitive.content
            val refresh = obj["refresh_token"]!!.jsonPrimitive.content
            val userObj = obj["user"] as JsonObject
            val uid = userObj["id"]!!.jsonPrimitive.content
            val userEmail = userObj["email"]?.jsonPrimitive?.content
            val expiresIn = obj["expires_in"]?.jsonPrimitive?.content?.toLongOrNull() ?: 3600L
            val authSession = AuthSession(
                accessToken = access,
                refreshToken = refresh,
                userId = uid,
                email = userEmail,
                expiresAtEpochMs = System.currentTimeMillis() + expiresIn * 1000L
            )
            updateSession(authSession)
            authSession
        }
    }

    suspend fun fetchWorkspace(): WorkspaceSnapshot = withContext(Dispatchers.IO) {
        val s = session ?: error("Not signed in")
        val req = Request.Builder()
            .url("${config.siteUrl}/api/workspace")
            .addHeader("Authorization", "Bearer ${s.accessToken}")
            .addHeader("X-Tether-Client", "android")
            .get()
            .build()
        http.newCall(req).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("Workspace fetch failed (${resp.code}): $raw")
            json.decodeFromString<WorkspaceSnapshot>(raw)
        }
    }

    suspend fun saveWorkspace(tree: PaneTree, settings: TetherSettings): WorkspaceSnapshot = withContext(Dispatchers.IO) {
        val s = session ?: error("Not signed in")
        @Serializable
        data class SavePayload(val tree: PaneTree, val settings: TetherSettings)
        val payloadStr = json.encodeToString(SavePayload(tree, settings))
        val parsed = json.parseToJsonElement(payloadStr)
        val forbidden = PaneTreeOps.findForbiddenSecretPath(parsed)
        if (forbidden != null) {
            error("Security policy (PRD §14): secret field '$forbidden' may not be synced.")
        }
        val req = Request.Builder()
            .url("${config.siteUrl}/api/workspace")
            .addHeader("Authorization", "Bearer ${s.accessToken}")
            .addHeader("X-Tether-Client", "android")
            .put(payloadStr.toRequestBody("application/json".toMediaType()))
            .build()
        http.newCall(req).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("Workspace save failed (${resp.code}): $raw")
            json.decodeFromString<WorkspaceSnapshot>(raw)
        }
    }
}
