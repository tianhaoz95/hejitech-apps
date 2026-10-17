package com.hejitech.core.supabase

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import kotlin.time.Duration.Companion.days
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Contempo's backend: the shared HEJI Supabase project, schema `contempo`
 * (projects/contempo/backend.env), plus the Contempo Worker's API for what needs a server
 * (cloud AI, account deletion, watch pairing). Replaces Firebase Auth/Firestore/Storage/Functions.
 * The phone and the watch each call [init] once at startup.
 */
object ContempoBackend {
    const val SCHEMA = "contempo"
    const val BUCKET = "contempo"
    const val WORKER_URL = "https://contempo.hejitech.workers.dev"

    lateinit var client: SupabaseClient
        private set

    /** [scheme]/[host] form the OAuth redirect (com.hejitech.contempoapp://login-callback). */
    fun init(url: String, publishableKey: String, scheme: String, host: String = "login-callback") {
        if (::client.isInitialized) return
        client = createSupabaseClient(url, publishableKey) {
            install(Auth) {
                this.scheme = scheme
                this.host = host
            }
            install(Postgrest) { defaultSchema = SCHEMA }
            install(Storage)
            install(Realtime)
        }
    }

    val uid: String? get() = client.auth.currentUserOrNull()?.id
    fun requireUid(): String = uid ?: error("Contempo backend used before sign-in")
    val email: String? get() = client.auth.currentUserOrNull()?.email

    /** True while signed in; replaces Firebase's AuthStateListener. */
    val signedIn: Flow<Boolean>
        get() = client.auth.sessionStatus.map { it is SessionStatus.Authenticated }.distinctUntilChanged()

    fun newId(): String = UUID.randomUUID().toString()

    /**
     * The signed-in user's rows of [table], kept live: an initial select, then a reload on every
     * Realtime change to that table (RLS scopes both to the user). Replaces Firestore snapshot listeners.
     */
    fun <T> liveRows(table: String, orderColumn: String, ascending: Boolean, map: (JsonObject) -> T?): Flow<List<T>> = callbackFlow {
        val userId = requireUid()
        suspend fun load() {
            val rows = client.from(table).select {
                order(orderColumn, if (ascending) Order.ASCENDING else Order.DESCENDING)
            }.decodeList<JsonObject>()
            trySend(rows.mapNotNull(map))
        }
        val channel = client.channel("contempo-$table-${UUID.randomUUID()}")
        val changes = channel.postgresChangeFlow<PostgresAction>(schema = SCHEMA) {
            this.table = table
            filter("user_id", io.github.jan.supabase.postgrest.query.filter.FilterOperator.EQ, userId)
        }
        val job = launch {
            try {
                load()
                launch { changes.collect { runCatching { load() } } }
                channel.subscribe()
            } catch (e: Exception) {
                close(e)
            }
        }
        awaitClose {
            job.cancel()
            kotlinx.coroutines.GlobalScope.launch { runCatching { client.realtime.removeChannel(channel) } }
        }
    }

    /** Uploads [bytes] to the private bucket at [path] (must start with the user's id) and returns a long-lived signed URL. */
    suspend fun uploadFile(path: String, bytes: ByteArray, contentType: String): String {
        val bucket = client.storage.from(BUCKET)
        bucket.upload(path, bytes) {
            upsert = true
            this.contentType = ContentType.parse(contentType)
        }
        return bucket.createSignedUrl(path, 3650.days)
    }

    suspend fun downloadFile(path: String): ByteArray = client.storage.from(BUCKET).downloadAuthenticated(path)

    suspend fun signedUrl(path: String): String = client.storage.from(BUCKET).createSignedUrl(path, 3650.days)

    /** POST to the Contempo Worker's API as the signed-in user (see services/web/src/worker/index.ts). */
    suspend fun api(path: String, body: JsonObject): JsonObject = withContext(Dispatchers.IO) {
        val token = client.auth.currentAccessTokenOrNull() ?: error("Sign in first")
        val conn = (URL("$WORKER_URL/api/$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 90_000
            setRequestProperty("content-type", "application/json")
            setRequestProperty("authorization", "Bearer $token")
        }
        try {
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val ok = conn.responseCode in 200..299
            val text = (if (ok) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: JsonObject(emptyMap())
            if (!ok) throw WorkerApiException(conn.responseCode, json["error"]?.toString()?.trim('"') ?: "HTTP ${conn.responseCode}")
            json
        } finally {
            conn.disconnect()
        }
    }
}

class WorkerApiException(val status: Int, message: String) : Exception(message)
