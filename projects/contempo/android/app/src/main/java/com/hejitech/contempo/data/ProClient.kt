package com.hejitech.contempo.data

import com.hejitech.core.supabase.ContempoBackend
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class UnifiedProStatus(
    val pro: Boolean = false,
    val source: String? = null,
    val plan: String? = null,
    val until: String? = null,
)

/**
 * Talks to Contempo's Worker for unified cross-platform Pro (`GET /api/pro`, `POST /api/play/purchases`)
 * and FCM push device registration (`POST /api/push-devices`).
 */
object ProClient {
    private const val WORKER_BASE = "https://contempo.hejitech.workers.dev"

    suspend fun fetchProStatus(): UnifiedProStatus = withContext(Dispatchers.IO) {
        val token = ContempoBackend.client.auth.currentAccessTokenOrNull() ?: return@withContext UnifiedProStatus()
        runCatching {
            val conn = (URL("$WORKER_BASE/api/pro").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Authorization", "Bearer $token")
            }
            if (conn.responseCode !in 200..299) return@runCatching UnifiedProStatus()
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val j = JSONObject(body)
            UnifiedProStatus(
                pro = j.optBoolean("pro", false),
                source = j.optString("source").takeIf { it.isNotEmpty() && it != "null" },
                plan = j.optString("plan").takeIf { it.isNotEmpty() && it != "null" },
                until = j.optString("until").takeIf { it.isNotEmpty() && it != "null" },
            )
        }.getOrDefault(UnifiedProStatus())
    }

    suspend fun registerPlayPurchase(product: String, purchaseToken: String): Boolean = withContext(Dispatchers.IO) {
        val token = ContempoBackend.client.auth.currentAccessTokenOrNull() ?: return@withContext false
        runCatching {
            val payload = JSONObject().put("product", product).put("token", purchaseToken).toString()
            postJson("$WORKER_BASE/api/play/purchases", token, payload)
        }.getOrDefault(false)
    }

    suspend fun registerFcmToken(fcmToken: String, label: String = "Android"): Boolean = withContext(Dispatchers.IO) {
        val token = ContempoBackend.client.auth.currentAccessTokenOrNull() ?: return@withContext false
        runCatching {
            val payload = JSONObject().put("fcm_token", fcmToken).put("label", label).toString()
            postJson("$WORKER_BASE/api/push-devices", token, payload)
        }.getOrDefault(false)
    }

    private fun postJson(url: String, bearer: String, jsonBody: String): Boolean {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Authorization", "Bearer $bearer")
            setRequestProperty("Content-Type", "application/json")
        }
        conn.outputStream.use { it.write(jsonBody.toByteArray(Charsets.UTF_8)) }
        return conn.responseCode in 200..299
    }
}
