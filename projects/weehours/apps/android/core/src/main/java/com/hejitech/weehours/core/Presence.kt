package com.hejitech.weehours.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.net.URLEncoder
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.min

data class PartnerActivity(
    val caregiver: UUID,
    val kind: String,
    val babies: List<UUID>,
    val at: Date,
    val until: Date
) {
    val id: String get() = "$caregiver-$kind"
}

class PresenceChannel(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var retryJob: Job? = null
    private var ref = 0
    private var topic = ""
    private var wanted = false
    private var failures = 0
    private var config: Triple<String, String, String?>? = null

    var onActivity: ((PartnerActivity) -> Unit)? = null
    var onChanged: ((UUID?) -> Unit)? = null

    @Synchronized
    fun connect(household: UUID, url: String, anonKey: String, token: String?) {
        val newTopic = "realtime:weehours:${household.toString().lowercase(Locale.ROOT)}"
        if (wanted && newTopic == topic && webSocket != null) return
        disconnect()
        wanted = true
        topic = newTopic
        config = Triple(url, anonKey, token)
        open()
    }

    @Synchronized
    fun disconnect() {
        wanted = false
        retryJob?.cancel()
        heartbeatJob?.cancel()
        webSocket?.close(1000, "Going away")
        webSocket = null
    }

    @Synchronized
    fun send(event: String, payload: JsonObject) {
        if (webSocket == null) return
        val outer = buildJsonObject {
            put("type", JsonPrimitive("broadcast"))
            put("event", JsonPrimitive(event))
            put("payload", payload)
        }
        push(event = "broadcast", payload = outer)
    }

    @Synchronized
    private fun open() {
        val cfg = config ?: return
        val base = cfg.first.trimEnd('/')
        val wsBase = when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
            else -> base
        }
        val wsUrl = "$wsBase/realtime/v1/websocket?apikey=${URLEncoder.encode(cfg.second, "UTF-8")}&vsn=1.0.0"
        val req = Request.Builder().url(wsUrl).build()
        val ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                failures = 0
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                failures = 0
                handle(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                reconnectLater(webSocket)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                reconnectLater(webSocket)
            }
        })
        webSocket = ws
        val join = buildJsonObject {
            put(
                "config",
                buildJsonObject {
                    put("broadcast", buildJsonObject {
                        put("self", JsonPrimitive(false))
                        put("ack", JsonPrimitive(false))
                    })
                    put("presence", buildJsonObject {
                        put("key", JsonPrimitive(""))
                    })
                    put("private", JsonPrimitive(false))
                }
            )
            if (cfg.third != null) put("access_token", JsonPrimitive(cfg.third))
        }
        push(event = "phx_join", payload = join)
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(25_000L)
                if (!isActive) break
                push(topicOverride = "phoenix", event = "heartbeat", payload = JsonObject(emptyMap()))
            }
        }
    }

    @Synchronized
    private fun push(topicOverride: String? = null, event: String, payload: JsonObject) {
        ref += 1
        val msg = buildJsonObject {
            put("topic", JsonPrimitive(topicOverride ?: topic))
            put("event", JsonPrimitive(event))
            put("payload", payload)
            put("ref", JsonPrimitive(ref.toString()))
        }
        webSocket?.send(msg.toString())
    }

    @Synchronized
    private fun reconnectLater(failedSocket: WebSocket) {
        if (webSocket !== failedSocket) return
        webSocket = null
        heartbeatJob?.cancel()
        if (!wanted) return
        failures += 1
        val delaySec = min(60, 2 * failures)
        retryJob?.cancel()
        retryJob = scope.launch {
            delay(delaySec * 1000L)
            if (wanted && isActive) {
                open()
            }
        }
    }

    private fun handle(text: String) {
        val obj = try {
            LogCoding.json.parseToJsonElement(text).jsonObject
        } catch (_: Exception) {
            return
        }
        if (obj["event"]?.jsonPrimitive?.content != "broadcast") return
        val outer = obj["payload"] as? JsonObject ?: return
        val event = outer["event"]?.jsonPrimitive?.content ?: return
        val p = outer["payload"] as? JsonObject ?: return
        when (event) {
            "changed" -> {
                val who = p["caregiver"]?.jsonPrimitive?.content?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                onChanged?.invoke(who)
            }
            "activity" -> {
                val who = p["caregiver"]?.jsonPrimitive?.content?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: return
                val kind = p["kind"]?.jsonPrimitive?.content ?: return
                val atSec = p["at"]?.jsonPrimitive?.doubleOrNull ?: return
                val untilSec = p["until"]?.jsonPrimitive?.doubleOrNull ?: return
                val babiesArr = p["babies"] as? JsonArray ?: JsonArray(emptyList())
                val babies = babiesArr.mapNotNull {
                    runCatching { UUID.fromString(it.jsonPrimitive.content) }.getOrNull()
                }
                onActivity?.invoke(
                    PartnerActivity(
                        caregiver = who,
                        kind = kind,
                        babies = babies,
                        at = Date((atSec * 1000).toLong()),
                        until = Date((untilSec * 1000).toLong())
                    )
                )
            }
        }
    }
}
