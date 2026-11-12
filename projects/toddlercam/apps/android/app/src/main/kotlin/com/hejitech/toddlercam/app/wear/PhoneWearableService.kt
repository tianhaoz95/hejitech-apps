package com.hejitech.toddlercam.app.wear

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.toddlercam.core.WatchActionMessage
import com.hejitech.toddlercam.core.WatchConstants

class PhoneWearableService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == WatchConstants.PATH_ACTION) {
            val json = String(messageEvent.data, Charsets.UTF_8)
            val action = WatchActionMessage.fromJson(json)
            if (action != null) {
                PhoneWearableManager.dispatchAction(action)
            }
        }
    }
}
