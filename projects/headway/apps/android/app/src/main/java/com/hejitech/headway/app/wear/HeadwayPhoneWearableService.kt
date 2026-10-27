package com.hejitech.headway.app.wear

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.headway.core.model.CaltrainStations
import com.hejitech.headway.core.model.ExpressPreference
import com.hejitech.headway.core.model.Tracked
import com.hejitech.headway.core.net.BackendConfig
import com.hejitech.headway.core.net.HeadwayApiClient
import com.hejitech.headway.core.sync.WatchMessage
import com.hejitech.headway.core.sync.WatchSyncState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class HeadwayPhoneWearableService : WearableListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = HeadwayApiClient(BackendConfig.PRODUCTION)
    private val json = Json { ignoreUnknownKeys = true }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == WatchMessage.PATH_ACTION) {
            val payload = String(messageEvent.data, Charsets.UTF_8)
            scope.launch {
                handleWatchAction(payload)
            }
        }
    }

    private suspend fun handleWatchAction(payload: String) {
        try {
            val obj = json.parseToJsonElement(payload).jsonObject
            val action = obj[WatchMessage.KEY_ACTION]?.jsonPrimitive?.content ?: return

            when (action) {
                WatchMessage.ACTION_TRACK -> {
                    val tripId = obj[WatchMessage.KEY_TRIP_ID]?.jsonPrimitive?.content ?: return
                    val serviceDate = obj[WatchMessage.KEY_SERVICE_DATE]?.jsonPrimitive?.content ?: return
                    val from = obj[WatchMessage.KEY_FROM]?.jsonPrimitive?.content ?: return
                    val to = obj[WatchMessage.KEY_TO]?.jsonPrimitive?.content ?: return
                    client.track(Tracked(tripId, serviceDate, from, to))
                }
                WatchMessage.ACTION_UNTRACK -> {
                    client.untrack()
                }
                WatchMessage.ACTION_REFRESH -> {
                    // Triggers board re-sync
                }
            }
        } catch (_: Exception) {}
    }
}
