package com.hejitech.headway.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Station(
    val id: String,
    val name: String,
    val short: String
)

@Serializable
data class StationRef(
    val id: String,
    val name: String,
    val short: String
)

@Serializable
enum class TrainStatus {
    @SerialName("on_time") ON_TIME,
    @SerialName("late") LATE,
    @SerialName("early") EARLY,
    @SerialName("cancelled") CANCELLED,
    @SerialName("scheduled") SCHEDULED;

    val displayTitle: String
        get() = when (this) {
            ON_TIME -> "ON TIME"
            LATE -> "LATE"
            EARLY -> "EARLY"
            CANCELLED -> "CANCELLED"
            SCHEDULED -> "SCHEDULED"
        }
}

@Serializable
enum class ExpressPreference(val value: String, val title: String) {
    @SerialName("all") ALL("all", "All trains"),
    @SerialName("prefer_express") PREFER_EXPRESS("prefer_express", "Prefer express"),
    @SerialName("express_only") EXPRESS_ONLY("express_only", "Express only");

    companion object {
        fun fromValue(v: String?): ExpressPreference =
            entries.firstOrNull { it.value == v } ?: ALL
    }
}

@Serializable
data class BoardTrain(
    @SerialName("trip_id") val tripId: String,
    val train: String,
    val kind: String,
    val dir: String,
    @SerialName("service_date") val serviceDate: String,
    val dep: Double,
    val arr: Double,
    @SerialName("pred_dep") val predDep: Double,
    @SerialName("pred_arr") val predArr: Double,
    @SerialName("delay_min") val delayMin: Int? = null,
    val status: TrainStatus,
    @SerialName("stops_between") val stopsBetween: Int = 0
) {
    val id: String get() = "$serviceDate:$tripId"

    val kindName: String
        get() = when (kind) {
            "LOC" -> "Local"
            "LTD" -> "Limited"
            "EXP" -> "Express"
            "SCC" -> "South County"
            else -> kind
        }

    val isExpress: Boolean get() = kind == "EXP"
}

@Serializable
data class ServiceAlert(
    val id: String,
    val header: String,
    val description: String = "",
    val url: String? = null
)

@Serializable
data class Board(
    val from: StationRef,
    val to: StationRef,
    val leg: String = "",
    @SerialName("generated_at") val generatedAt: Double = 0.0,
    val live: Boolean = false,
    val trains: List<BoardTrain> = emptyList(),
    val alerts: List<ServiceAlert> = emptyList(),
    @SerialName("express_preference") val expressPreference: String? = null
)

@Serializable
data class Tracked(
    @SerialName("trip_id") val tripId: String,
    @SerialName("service_date") val serviceDate: String,
    val from: String,
    val to: String
)

@Serializable
data class NextStop(
    val id: String,
    val name: String,
    val short: String,
    val pred: Double
)

@Serializable
data class TrainProgress(
    @SerialName("trip_id") val tripId: String,
    val train: String,
    val kind: String,
    @SerialName("service_date") val serviceDate: String,
    val to: StationRef,
    val next: NextStop? = null,
    @SerialName("pred_arr") val predArr: Double,
    val arr: Double,
    @SerialName("delay_min") val delayMin: Int? = null,
    @SerialName("stops_left") val stopsLeft: Int = 0,
    val cancelled: Boolean = false,
    val arrived: Boolean = false,
    val live: Boolean = false
)

@Serializable
data class TrackedWithProgress(
    @SerialName("trip_id") val tripId: String,
    @SerialName("service_date") val serviceDate: String,
    val from: String,
    val to: String,
    val progress: TrainProgress
)

@Serializable
data class MyBoard(
    val board: Board? = null,
    @SerialName("has_commute") val hasCommute: Boolean = false,
    val saved: Boolean = false,
    val tracked: TrackedWithProgress? = null
)

@Serializable
data class TimeWindow(
    val start: String,
    val end: String
)

@Serializable
data class Leg(
    val from: String,
    val to: String,
    @SerialName("walk_minutes") val walkMinutes: Int = 10,
    val usual: String? = null,
    val window: TimeWindow,
    @SerialName("express_preference") val expressPreference: ExpressPreference = ExpressPreference.ALL
) {
    companion object {
        fun morning(from: String, to: String) = Leg(
            from = from,
            to = to,
            walkMinutes = 10,
            window = TimeWindow(start = "06:00", end = "10:30")
        )

        fun evening(from: String, to: String) = Leg(
            from = from,
            to = to,
            walkMinutes = 10,
            window = TimeWindow(start = "15:30", end = "20:00")
        )
    }
}

@Serializable
data class AlertSettings(
    val delay: Boolean = true,
    @SerialName("delay_threshold") val delayThreshold: Int = 5,
    val cancellation: Boolean = true,
    val service: Boolean = true,
    @SerialName("leave_now") val leaveNow: Boolean = true,
    val arrival: Boolean = true,
    @SerialName("arrival_minutes") val arrivalMinutes: Int = 5
)

@Serializable
data class Settings(
    val morning: Leg? = null,
    val evening: Leg? = null,
    @SerialName("switch_at") val switchAt: String = "12:00",
    val days: List<Int> = listOf(0, 1, 2, 3, 4),
    val alerts: AlertSettings = AlertSettings(),
    @SerialName("express_preference") val expressPreference: ExpressPreference = ExpressPreference.ALL
) {
    companion object {
        val defaults = Settings()
    }
}

@Serializable
data class SettingsResponse(
    val settings: Settings,
    val saved: Boolean = false,
    val email: String? = null
)

@Serializable
data class PairingCode(
    val code: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class PairedDevice(
    val id: String,
    val label: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null
)

@Serializable
data class AuthSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("user_id") val userId: String,
    val email: String? = null,
    @SerialName("expires_at_ms") val expiresAtMs: Long
)
