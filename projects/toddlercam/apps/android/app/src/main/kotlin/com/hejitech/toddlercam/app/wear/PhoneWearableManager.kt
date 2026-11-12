package com.hejitech.toddlercam.app.wear

import android.content.Context
import com.google.android.gms.wearable.Wearable
import com.hejitech.toddlercam.core.ToddlerState
import com.hejitech.toddlercam.core.WatchActionMessage
import com.hejitech.toddlercam.core.WatchConstants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class PhoneWearableManager(context: Context) {

    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val messageClient = Wearable.getMessageClient(appContext)
    private val nodeClient = Wearable.getNodeClient(appContext)

    companion object {
        @Volatile
        var instance: PhoneWearableManager? = null

        fun get(context: Context): PhoneWearableManager {
            return instance ?: synchronized(this) {
                instance ?: PhoneWearableManager(context).also { instance = it }
            }
        }

        private val actionListeners = mutableListOf<(WatchActionMessage) -> Unit>()

        fun addActionListener(listener: (WatchActionMessage) -> Unit) {
            synchronized(actionListeners) {
                actionListeners.add(listener)
            }
        }

        fun removeActionListener(listener: (WatchActionMessage) -> Unit) {
            synchronized(actionListeners) {
                actionListeners.remove(listener)
            }
        }

        fun dispatchAction(action: WatchActionMessage) {
            synchronized(actionListeners) {
                for (listener in actionListeners) {
                    listener(action)
                }
            }
        }
    }

    fun broadcastState(state: ToddlerState) {
        scope.launch {
            try {
                val nodes = nodeClient.connectedNodes.await()
                if (nodes.isEmpty()) return@launch
                val data = state.toJson().toByteArray(Charsets.UTF_8)
                for (node in nodes) {
                    messageClient.sendMessage(node.id, WatchConstants.PATH_STATE, data).await()
                }
            } catch (_: Exception) {}
        }
    }

    fun sendThumbnailToWatch(thumbnailBytes: ByteArray) {
        scope.launch {
            try {
                val nodes = nodeClient.connectedNodes.await()
                if (nodes.isEmpty()) return@launch
                for (node in nodes) {
                    messageClient.sendMessage(node.id, WatchConstants.PATH_THUMBNAIL, thumbnailBytes).await()
                }
            } catch (_: Exception) {}
        }
    }
}
