package com.hejitech.headway.core.sync

import com.hejitech.headway.core.model.Board
import com.hejitech.headway.core.model.ExpressPreference
import com.hejitech.headway.core.model.Station
import com.hejitech.headway.core.model.TrackedWithProgress
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class WatchSyncState(
    val board: Board? = null,
    val tracked: TrackedWithProgress? = null,
    val hasCommute: Boolean = false,
    val stations: List<Station> = emptyList(),
    val expressPreference: ExpressPreference = ExpressPreference.ALL,
    val authToken: String? = null,
    val timestampMs: Long = System.currentTimeMillis()
) {
    fun encode(): ByteArray {
        val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
        return json.encodeToString(this).toByteArray(Charsets.UTF_8)
    }

    companion object {
        fun decode(bytes: ByteArray): WatchSyncState? {
            return try {
                val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
                json.decodeFromString<WatchSyncState>(bytes.toString(Charsets.UTF_8))
            } catch (e: Exception) {
                null
            }
        }
    }
}

object WatchMessage {
    const val PATH_SYNC_STATE = "/headway/sync_state"
    const val PATH_ACTION = "/headway/action"

    // Action types sent from Watch to Phone
    const val ACTION_TRACK = "track"
    const val ACTION_UNTRACK = "untrack"
    const val ACTION_FLIP = "flip"
    const val ACTION_REFRESH = "refresh"
    const val ACTION_SELECT_STATIONS = "select_stations"
    const val ACTION_FILTER_EXPRESS = "filter_express"

    // Action payload keys
    const val KEY_ACTION = "action"
    const val KEY_TRIP_ID = "trip_id"
    const val KEY_SERVICE_DATE = "service_date"
    const val KEY_FROM = "from"
    const val KEY_TO = "to"
    const val KEY_EXPRESS = "express"
}
