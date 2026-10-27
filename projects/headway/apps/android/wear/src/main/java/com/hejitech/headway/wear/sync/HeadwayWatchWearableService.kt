package com.hejitech.headway.wear.sync

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.headway.core.sync.WatchMessage
import com.hejitech.headway.core.sync.WatchSyncState

class HeadwayWatchWearableService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == WatchMessage.PATH_SYNC_STATE) {
            val state = WatchSyncState.decode(messageEvent.data)
            if (state != null) {
                WearStore.updateState(applicationContext, state)
            }
        }
    }
}
