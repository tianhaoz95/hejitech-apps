package com.hejitech.contempo.auth

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.hejitech.core.supabase.ContempoBackend
import kotlinx.coroutines.flow.filter
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

private const val REQUEST_AUTH_TOKEN_PATH = "/requestAuthToken"
private const val AUTH_TOKEN_REPLY_PATH = "/requestAuthToken/reply"
private const val AUTH_TOKEN_DATA_PATH = "/authToken"

/**
 * Android/Wear OS equivalent of iOS's WatchAuthTokenRelay.swift — see that
 * file and backend/functions/src/watchAuth.ts's kdoc for the full reasoning
 * (originally written iOS-only because watchOS has no standalone Google
 * Sign-In; ported here after confirming live that Wear OS's Credential
 * Manager doesn't reliably support first-time sign-in either —
 * NoCredentialException even with a real account already on the watch. Same
 * underlying fix — a Firebase custom token relayed from an already-signed-in
 * phone — works for either platform's "no reliable standalone auth" gap).
 *
 * Two delivery paths, same as iOS's `sendMessage`/`updateApplicationContext`
 * pair: replies to the watch's on-demand `MessageClient` request when the
 * watch is actively asking, and separately pushes proactively via
 * `DataClient` whenever this phone's auth state changes to signed-in, so a
 * watch that becomes reachable later still picks it up without needing an
 * interactive round trip while both devices happen to be connected at once.
 */
class WatchAuthTokenRelay(
    private val context: Context,
    private val scope: CoroutineScope,
) : MessageClient.OnMessageReceivedListener {

    private val messageClient by lazy { Wearable.getMessageClient(context) }
    private val dataClient by lazy { Wearable.getDataClient(context) }

    fun start() {
        messageClient.addListener(this)
        scope.launch {
            ContempoBackend.signedIn.filter { it }.collect { pushTokenToDataLayer() }
        }
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != REQUEST_AUTH_TOKEN_PATH) return
        scope.launch {
            val payload = buildPayload()
            runCatching { messageClient.sendMessage(event.sourceNodeId, AUTH_TOKEN_REPLY_PATH, payload).await() }
        }
    }

    private suspend fun pushTokenToDataLayer() {
        val request = PutDataMapRequest.create(AUTH_TOKEN_DATA_PATH).apply {
            dataMap.putByteArray("payload", buildPayload())
            // A DataItem with identical bytes to last time doesn't trigger a
            // change event on the receiving side — this timestamp forces one
            // even when the same account signs in again (e.g. after a token
            // refresh), so a watch that missed the first push still gets one.
            dataMap.putLong("timestamp", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()
        runCatching { dataClient.putDataItem(request).await() }
    }

    /**
     * A one-time pairing code from the Contempo Worker (POST /api/watch/pair): the watch exchanges
     * it for its own Supabase session (verifyOtp with the token hash). Replaces the Firebase custom token.
     */
    private suspend fun buildPayload(): ByteArray {
        val json = if (ContempoBackend.uid == null) {
            JSONObject().put("error", "not_signed_in")
        } else {
            try {
                val result = ContempoBackend.api("watch/pair", JsonObject(emptyMap()))
                val tokenHash = (result["tokenHash"] as? JsonPrimitive)?.content
                if (tokenHash != null) {
                    JSONObject().put("tokenHash", tokenHash).put("type", (result["type"] as? JsonPrimitive)?.content ?: "magiclink")
                } else {
                    JSONObject().put("error", "mint_failed")
                }
            } catch (e: Exception) {
                JSONObject().put("error", e.message ?: "unknown")
            }
        }
        return json.toString().toByteArray(Charsets.UTF_8)
    }
}
