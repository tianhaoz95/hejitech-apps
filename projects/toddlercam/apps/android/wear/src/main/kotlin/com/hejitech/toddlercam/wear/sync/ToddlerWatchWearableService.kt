package com.hejitech.toddlercam.wear.sync

import android.graphics.BitmapFactory
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.toddlercam.core.ToddlerState
import com.hejitech.toddlercam.core.WatchConstants
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object WearStore {
    private val _state = MutableStateFlow(ToddlerState())
    val state: StateFlow<ToddlerState> = _state.asStateFlow()

    private val _lastPhotoThumbnail = MutableStateFlow<android.graphics.Bitmap?>(null)
    val lastPhotoThumbnail: StateFlow<android.graphics.Bitmap?> = _lastPhotoThumbnail.asStateFlow()

    fun updateState(newState: ToddlerState) {
        _state.value = newState
    }

    fun updateThumbnail(bytes: ByteArray) {
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (bmp != null) {
            _lastPhotoThumbnail.value = bmp
        }
    }
}

class ToddlerWatchWearableService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {
        when (messageEvent.path) {
            WatchConstants.PATH_STATE -> {
                val json = String(messageEvent.data, Charsets.UTF_8)
                val state = ToddlerState.fromJson(json)
                if (state != null) {
                    WearStore.updateState(state)
                }
            }
            WatchConstants.PATH_THUMBNAIL -> {
                WearStore.updateThumbnail(messageEvent.data)
            }
        }
    }
}
