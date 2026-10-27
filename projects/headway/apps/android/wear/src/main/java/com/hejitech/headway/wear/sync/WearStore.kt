package com.hejitech.headway.wear.sync

import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import android.content.ComponentName
import com.hejitech.headway.core.model.*
import com.hejitech.headway.core.sync.WatchSyncState
import com.hejitech.headway.wear.complication.NextTrainComplicationService
import com.hejitech.headway.wear.tile.HeadwayBoardTileService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object WearStore {
    private const val PREFS_NAME = "headway_wear_prefs"
    private const val KEY_CACHED_STATE = "cached_state"

    private val _syncState = MutableStateFlow<WatchSyncState?>(null)
    val syncState: StateFlow<WatchSyncState?> = _syncState.asStateFlow()

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cached = prefs.getString(KEY_CACHED_STATE, null)
        if (cached != null) {
            val state = WatchSyncState.decode(cached.toByteArray(Charsets.UTF_8))
            _syncState.value = state
        }
    }

    fun updateState(context: Context, state: WatchSyncState) {
        _syncState.value = state
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_CACHED_STATE, String(state.encode(), Charsets.UTF_8)).apply()

        // Request tile update
        try {
            TileService.getUpdater(context).requestUpdate(HeadwayBoardTileService::class.java)
        } catch (_: Exception) {}

        // Request complication update
        try {
            val requester = ComplicationDataSourceUpdateRequester.create(
                context,
                ComponentName(context, NextTrainComplicationService::class.java)
            )
            requester.requestUpdateAll()
        } catch (_: Exception) {}
    }
}
