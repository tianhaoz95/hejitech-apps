package com.hejitech.wear.auth

import android.content.Context
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume

private const val REQUEST_AUTH_TOKEN_PATH = "/requestAuthToken"
private const val AUTH_TOKEN_REPLY_PATH = "/requestAuthToken/reply"
private const val AUTH_TOKEN_DATA_PATH = "/authToken"
private const val REQUEST_TIMEOUT_MS = 15_000L

sealed class WatchAuthTokenResult {
    data class CustomToken(val token: String) : WatchAuthTokenResult()
    data object IsEmulator : WatchAuthTokenResult()
    data class PhoneError(val message: String) : WatchAuthTokenResult()
    data object PhoneUnreachable : WatchAuthTokenResult()
}

/**
 * Requests a Firebase custom token from the paired phone over the Wear Data
 * Layer API — see WatchAuthTokenRelay.kt (phone side) and its kdoc for the
 * full reasoning. Checks for an already-pushed DataItem first (the phone may
 * have proactively sent one via DataClient before the watch was ready to
 * ask), falling back to an interactive MessageClient request/reply with a
 * bounded wait if not.
 */
class WatchAuthTokenClient(private val context: Context) {

    private val messageClient by lazy { Wearable.getMessageClient(context) }
    private val dataClient by lazy { Wearable.getDataClient(context) }
    private val nodeClient by lazy { Wearable.getNodeClient(context) }

    suspend fun requestToken(): WatchAuthTokenResult {
        val persisted = readPersistedPayload()
        android.util.Log.d("WearAuthDiag", "readPersistedPayload: ${persisted?.let { String(it) }}")
        parsePayload(persisted)?.let { return it }

        val nodesResult = runCatching { nodeClient.connectedNodes.await() }
        android.util.Log.d("WearAuthDiag", "connectedNodes result: ${nodesResult.getOrNull()?.map { it.displayName + "/" + it.id }} exception=${nodesResult.exceptionOrNull()}")
        val nodes = nodesResult.getOrNull().orEmpty()
        if (nodes.isEmpty()) return WatchAuthTokenResult.PhoneUnreachable

        val payload = withTimeoutOrNull(REQUEST_TIMEOUT_MS) { requestOverMessageClient(nodes.first().id) }
        android.util.Log.d("WearAuthDiag", "requestOverMessageClient result: ${payload?.let { String(it) }}")
        if (payload == null) return WatchAuthTokenResult.PhoneUnreachable
        return parsePayload(payload) ?: WatchAuthTokenResult.PhoneError("Unexpected response from phone")
    }

    private suspend fun readPersistedPayload(): ByteArray? {
        val items = runCatching { dataClient.dataItems.await() }.getOrNull() ?: return null
        val item = items.firstOrNull { it.uri.path == AUTH_TOKEN_DATA_PATH } ?: return null
        return com.google.android.gms.wearable.DataMapItem.fromDataItem(item).dataMap.getByteArray("payload")
    }

    private suspend fun requestOverMessageClient(nodeId: String): ByteArray? = suspendCancellableCoroutine { cont ->
        val listener = object : MessageClient.OnMessageReceivedListener {
            override fun onMessageReceived(event: MessageEvent) {
                if (event.path != AUTH_TOKEN_REPLY_PATH) return
                messageClient.removeListener(this)
                if (cont.isActive) cont.resume(event.data)
            }
        }
        messageClient.addListener(listener)
        cont.invokeOnCancellation { messageClient.removeListener(listener) }
        messageClient.sendMessage(nodeId, REQUEST_AUTH_TOKEN_PATH, ByteArray(0))
            .addOnSuccessListener {
                android.util.Log.d("WearAuthDiag", "sendMessage succeeded to node $nodeId")
            }
            .addOnFailureListener { e ->
                android.util.Log.d("WearAuthDiag", "sendMessage FAILED to node $nodeId: $e")
                messageClient.removeListener(listener)
                if (cont.isActive) cont.resume(null)
            }
    }

    private fun parsePayload(payload: ByteArray?): WatchAuthTokenResult? {
        if (payload == null) return null
        val json = runCatching { JSONObject(String(payload, Charsets.UTF_8)) }.getOrNull() ?: return null
        return when {
            json.optBoolean("isEmulator", false) -> WatchAuthTokenResult.IsEmulator
            json.has("customToken") -> WatchAuthTokenResult.CustomToken(json.getString("customToken"))
            json.has("error") -> WatchAuthTokenResult.PhoneError(friendlyErrorMessage(json.getString("error")))
            else -> null
        }
    }

    private fun friendlyErrorMessage(rawError: String): String = when {
        rawError.contains("not_signed_in") -> "Sign in on your phone first"
        rawError.contains("mint_failed") -> "Couldn't complete sign-in — try again"
        else -> rawError
    }
}
