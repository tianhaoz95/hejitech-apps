package com.hejitech.fitloop

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.wear.remote.interactions.RemoteActivityHelper
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import com.hejitech.fitloop.core.WatchWorkout
import com.hejitech.fitloop.core.WearProtocol
import kotlinx.coroutines.tasks.await

/**
 * The phone's side of the Wear OS watch (the Android counterpart of the iPhone app's WatchLink):
 * tells the watch which workout is open and opens the watch app when one starts; hears back heart
 * rate, Set done, and "send it again" when the watch app opens. Nothing happens without a watch.
 */
class WearLink(private val context: Context) {
    var onHeartRate: ((Int) -> Unit)? = null
    var onSetDone: (() -> Unit)? = null
    /** The watch app opened: what to send it. */
    var current: () -> WatchWorkout = { WatchWorkout() }
    private var started = false

    private val messages by lazy { Wearable.getMessageClient(context) }
    private val nodes by lazy { Wearable.getNodeClient(context) }
    private val listener = MessageClient.OnMessageReceivedListener { e ->
        when (e.path) {
            WearProtocol.PATH_HR -> WearProtocol.hrOf(e.data)?.let { onHeartRate?.invoke(it) }
            WearProtocol.PATH_SET_DONE -> onSetDone?.invoke()
            WearProtocol.PATH_HELLO -> sendTo(e.sourceNodeId, current())
        }
    }

    fun start() {
        if (started) return
        started = true
        runCatching { messages.addListener(listener) }
    }

    private suspend fun watches(): List<String> = runCatching { nodes.connectedNodes.await().map { it.id } }.getOrDefault(emptyList())

    private fun sendTo(node: String, w: WatchWorkout) {
        runCatching { messages.sendMessage(node, WearProtocol.PATH_WORKOUT, WearProtocol.encode(w)) }
    }

    suspend fun send(w: WatchWorkout) {
        for (n in watches()) sendTo(n, w)
    }

    /** Opens FitLoop on each connected watch (when a workout starts). */
    suspend fun openOnWatch() {
        val ids = watches()
        if (ids.isEmpty()) return
        val helper = RemoteActivityHelper(context)
        val intent = Intent(Intent.ACTION_VIEW).addCategory(Intent.CATEGORY_BROWSABLE).setData(Uri.parse(WearProtocol.OPEN_URI))
        for (id in ids) runCatching { helper.startRemoteActivity(intent, id) }
    }
}
