package com.hejitech.headway.wear

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.Wearable
import com.hejitech.headway.core.model.*
import com.hejitech.headway.core.net.BackendConfig
import com.hejitech.headway.core.net.HeadwayApiClient
import com.hejitech.headway.core.sync.WatchMessage
import com.hejitech.headway.core.sync.WatchSyncState
import com.hejitech.headway.wear.sync.WearStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class WearViewModel(application: Application) : AndroidViewModel(application) {

    private val apiClient = HeadwayApiClient(BackendConfig.PRODUCTION)

    val syncState: StateFlow<WatchSyncState?> = WearStore.syncState

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        WearStore.init(application)
        if (syncState.value == null) {
            refresh()
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // First try sending refresh request to phone
                sendActionToPhone(buildJsonObject {
                    put(WatchMessage.KEY_ACTION, WatchMessage.ACTION_REFRESH)
                }.toString())

                // Also fetch standalone directly from API if no cached board yet
                val current = syncState.value?.board
                val from = current?.from?.id ?: CaltrainStations.defaultMorningFrom.id
                val to = current?.to?.id ?: CaltrainStations.defaultMorningTo.id
                val board = apiClient.getBoard(from, to)

                val newState = (syncState.value ?: WatchSyncState()).copy(
                    board = board,
                    hasCommute = true
                )
                WearStore.updateState(getApplication(), newState)
            } catch (_: Exception) {
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun flipStations() {
        viewModelScope.launch {
            val current = syncState.value?.board ?: return@launch
            val from = current.to.id
            val to = current.from.id

            sendActionToPhone(buildJsonObject {
                put(WatchMessage.KEY_ACTION, WatchMessage.ACTION_SELECT_STATIONS)
                put(WatchMessage.KEY_FROM, from)
                put(WatchMessage.KEY_TO, to)
            }.toString())

            try {
                val board = apiClient.getBoard(from, to)
                val newState = (syncState.value ?: WatchSyncState()).copy(board = board)
                WearStore.updateState(getApplication(), newState)
            } catch (_: Exception) {}
        }
    }

    fun trackTrain(train: BoardTrain) {
        viewModelScope.launch {
            val board = syncState.value?.board ?: return@launch
            sendActionToPhone(buildJsonObject {
                put(WatchMessage.KEY_ACTION, WatchMessage.ACTION_TRACK)
                put(WatchMessage.KEY_TRIP_ID, train.tripId)
                put(WatchMessage.KEY_SERVICE_DATE, train.serviceDate)
                put(WatchMessage.KEY_FROM, board.from.id)
                put(WatchMessage.KEY_TO, board.to.id)
            }.toString())

            refresh()
        }
    }

    fun untrackTrain() {
        viewModelScope.launch {
            sendActionToPhone(buildJsonObject {
                put(WatchMessage.KEY_ACTION, WatchMessage.ACTION_UNTRACK)
            }.toString())

            val newState = syncState.value?.copy(tracked = null)
            if (newState != null) {
                WearStore.updateState(getApplication(), newState)
            }
        }
    }

    private suspend fun sendActionToPhone(payload: String) {
        try {
            val context = getApplication<Application>()
            val nodeClient = Wearable.getNodeClient(context)
            val messageClient = Wearable.getMessageClient(context)
            val nodes = nodeClient.connectedNodes.await()
            val bytes = payload.toByteArray(Charsets.UTF_8)
            for (node in nodes) {
                messageClient.sendMessage(node.id, WatchMessage.PATH_ACTION, bytes).await()
            }
        } catch (_: Exception) {}
    }
}
